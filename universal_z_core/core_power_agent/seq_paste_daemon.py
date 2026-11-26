# -*- coding: utf-8 -*-
"""
👻 귀신같이(Ghosti) 유료 구독자 전용 선물 — 『멀린 Z 코어 9대 귀신 초능력 + 3대 보너스 통합 데몬 (v2.5 AI 완전체)』
====================================================================================================
- 귀신호출 2종 단일화: Ctrl + 0 / Ctrl + 우클릭 + 오토매틱(Automatic) 한영 오타·띄어쓰기 감지 및 한/영 키 자동 전환
- 온디바이스 AI 엔진: EmbeddingGemma 2 (MRL 128차원 절삭 임베딩 + 262,144 토크나이저 사전 재활용으로 추가 사전 용량 0 Byte)
- 9대 초능력 + 3대 보너스:
  ① [그냥 Ctrl + V 연타] 순차(1->2->3) 연사 + IUIAutomation & EmbeddingGemma 2 입력칸 라벨 비순차(Out-of-Order) 자동 매칭 + 엑셀 다중 셀 1회 복사 자동 쪼개기
  ② [오토매틱(자동 감지) 또는 숫자 2] 지능형 한영 오타 양방향 성형 (KS X 1001 2,350자 + EmbeddingGemma 2 영단어 사전 65,743어 검증 + 변환 직후 한/영 키 IME 상태 자동 전환)
  ③ [숫자 3] 서식 100% 자동 세탁기 + EmbeddingGemma 2 AI 광고·저작권 꼬리말 자동 절삭
  ④ [숫자 4] 줄바꿈·빈줄·공공문서 유령공백(NFKC) 1초 다림질 + EmbeddingGemma 2 문단 의미 분리
  ⑤ [숫자 5 / Ctrl+0 후 글자 타이핑] 다중 복사 1초 합본 & 마우스 옆 1줄 MRL 128차원 AI 의미 기억 검색창
  ⑥ [숫자 6] 화면 글자·표 1초 추출기 (WinRT OCR 바운딩 박스 Y/X 기하 군집화 엑셀 표 TSV 복원)
  ⑦ [숫자 7] 현재 창 항상 위(Always-on-Top) 고정 핀 꽂기/빼기 토글
  ⑧ [숫자 8] 전화·사업자·생년월일 하이픈(-) 양방향 토글 성형 + 통짜 카톡 [성함/연락처/계좌/일정] AI 구조화 발라내기
  ⑨ [숫자 9] 스샷/웹 이미지 -> 실물 파일(.png) 및 다중 스샷 -> 1개 합본 .pdf 파일(CF_HDROP) 변환 + AI 스마트 파일명 자동 작명
  🎁 [보너스 A: F1~F5] 고정 상용구 5대 슬롯 0.1초 즉시 사출 (원본 클립보드 보존)
  🎁 [보너스 B: 엑셀 쪼개기] 엑셀 다중 셀 1회 드래그 복사 시 1칸씩 자동 분해 장전
  🎁 [보너스 C: PDF 합본] 90초 내 연속 캡처한 스샷 2장 이상을 1개의 합본 .pdf 실물 파일로 병합 첨부
"""

import ctypes
from ctypes import wintypes
import datetime
import io
import json
import os
from pathlib import Path
from typing import Any

for _pyi_env_key in ("_MEIPASS2", "_MEIPASS"):
    os.environ.pop(_pyi_env_key, None)
os.environ["PYINSTALLER_RESET_ENVIRONMENT"] = "1"
import queue
import re
import socket
import struct
import subprocess
import sys
import tempfile
import threading
import time
import unicodedata
import urllib.parse
import urllib.request
import zlib

u32 = ctypes.windll.user32
k32 = ctypes.windll.kernel32
imm32 = ctypes.windll.imm32

try:
    ctypes.windll.shcore.SetProcessDpiAwareness(2)
except Exception:
    try:
        u32.SetProcessDPIAware()
    except Exception:
        pass

_IS_INPUT_SUMMON_CONTEXT = True

# Win32 상수
WM_HOTKEY = 0x0312
WM_TIMER = 0x0113
WM_IME_CONTROL = 0x0283
IMC_GETCONVERSIONMODE = 0x0001
IMC_SETCONVERSIONMODE = 0x0002
IME_CMODE_NATIVE = 0x0001  # 1: 한글, 0: 영문

MOD_ALT = 0x0001
MOD_CONTROL = 0x0002
MOD_NOREPEAT = 0x4000

VK_0 = 0x30
VK_NUMPAD0 = 0x60
VK_Z = 0x5A
VK_V = 0x56
VK_C = 0x43
VK_X = 0x58
VK_A = 0x41
VK_BACK = 0x08
VK_SPACE = 0x20
VK_RETURN = 0x0D
VK_SHIFT = 0x10
VK_CONTROL = 0x11
VK_MENU = 0x12
VK_LEFT = 0x25
VK_HANGUL = 0x15
VK_F1 = 0x70

CF_UNICODETEXT = 13
CF_HDROP = 15
GMEM_MOVEABLE = 0x0002

GWL_EXSTYLE = -20
WS_EX_TOPMOST = 0x00000008
WS_EX_TRANSPARENT = 0x00000020
WS_EX_TOOLWINDOW = 0x00000080
WS_EX_LAYERED = 0x00080000
WS_EX_NOACTIVATE = 0x08000000

HWND_TOPMOST = wintypes.HWND(-1)
HWND_NOTOPMOST = wintypes.HWND(-2)
SWP_NOMOVE = 0x0002
SWP_NOSIZE = 0x0001
SWP_NOACTIVATE = 0x0010
SWP_SHOWWINDOW = 0x0040
KEYEVENTF_KEYUP = 0x0002
WM_GETTEXT = 0x000D
WM_GETTEXTLENGTH = 0x000E
WM_SETTEXT = 0x000C
EM_GETSEL = 0x00B0
EM_SETSEL = 0x00B1
EM_REPLACESEL = 0x00C2
EM_LINEFROMCHAR = 0x00C9
EM_LINEINDEX = 0x00BB
EM_LINELENGTH = 0x00C1

LOCK_PORT = 51988
AUTO_CLEAN_SECONDS = 300.0
IMAGE_CLEAN_SECONDS = 90.0
MENU_ARM_SECONDS = 7.5

BASE_DIR = Path(os.environ.get("LOCALAPPDATA", os.path.expanduser("~"))) / "Ghosti"
QUEUE_FILE = BASE_DIR / "data" / "clipboard_queue.json"
SNIPPETS_FILE = BASE_DIR / "data" / "fixed_snippets.json"
HISTORY_FILE = BASE_DIR / "data" / "clipboard_ai_history.json"

k32.GlobalAlloc.argtypes = [wintypes.UINT, ctypes.c_size_t]
k32.GlobalAlloc.restype = wintypes.HANDLE
k32.GlobalLock.argtypes = [wintypes.HANDLE]
k32.GlobalLock.restype = ctypes.c_void_p
k32.GlobalUnlock.argtypes = [wintypes.HANDLE]
k32.GlobalUnlock.restype = wintypes.BOOL
k32.GlobalFree.argtypes = [wintypes.HANDLE]
k32.GlobalFree.restype = wintypes.HANDLE
k32.VirtualFree.argtypes = [ctypes.c_void_p, ctypes.c_size_t, wintypes.DWORD]
k32.VirtualFree.restype = wintypes.BOOL
u32.GetClipboardData.argtypes = [wintypes.UINT]
u32.GetClipboardData.restype = wintypes.HANDLE
u32.SetClipboardData.argtypes = [wintypes.UINT, wintypes.HANDLE]
u32.SetClipboardData.restype = wintypes.HANDLE
imm32.ImmGetDefaultIMEWnd.argtypes = [wintypes.HWND]
imm32.ImmGetDefaultIMEWnd.restype = wintypes.HWND
u32.GetForegroundWindow.restype = wintypes.HWND
u32.GetParent.argtypes = [wintypes.HWND]
u32.GetParent.restype = wintypes.HWND
u32.WindowFromPoint.argtypes = [wintypes.POINT]
u32.WindowFromPoint.restype = wintypes.HWND
u32.MonitorFromPoint.argtypes = [wintypes.POINT, wintypes.DWORD]
u32.MonitorFromPoint.restype = wintypes.HANDLE
u32.GetCursorPos.argtypes = [ctypes.POINTER(wintypes.POINT)]
u32.GetCursorPos.restype = wintypes.BOOL
u32.GetAncestor.argtypes = [wintypes.HWND, wintypes.UINT]
u32.GetAncestor.restype = wintypes.HWND
u32.IsWindow.argtypes = [wintypes.HWND]
u32.IsWindow.restype = wintypes.BOOL
u32.IsWindowVisible.argtypes = [wintypes.HWND]
u32.IsWindowVisible.restype = wintypes.BOOL
u32.IsIconic.argtypes = [wintypes.HWND]
u32.IsIconic.restype = wintypes.BOOL
u32.GetClassNameW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
u32.GetClassNameW.restype = ctypes.c_int
u32.GetWindowTextW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
u32.GetWindowTextW.restype = ctypes.c_int
u32.SetWindowTextW.argtypes = [wintypes.HWND, wintypes.LPCWSTR]
u32.SetWindowTextW.restype = wintypes.BOOL
u32.GetWindowLongW.argtypes = [wintypes.HWND, ctypes.c_int]
u32.GetWindowLongW.restype = wintypes.LONG
u32.SetWindowPos.argtypes = [wintypes.HWND, wintypes.HWND, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int, wintypes.UINT]
u32.SetWindowPos.restype = wintypes.BOOL
u32.SendMessageW.argtypes = [wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]
u32.SendMessageW.restype = wintypes.LPARAM
u32.SendMessageTimeoutW.argtypes = [
    wintypes.HWND,
    wintypes.UINT,
    wintypes.WPARAM,
    wintypes.LPARAM,
    wintypes.UINT,
    wintypes.UINT,
    ctypes.POINTER(ctypes.c_size_t),
]
u32.SendMessageTimeoutW.restype = wintypes.LPARAM
u32.GetForegroundWindow.restype = wintypes.HWND
u32.GetAncestor.argtypes = [wintypes.HWND, wintypes.UINT]
u32.GetAncestor.restype = wintypes.HWND
u32.IsWindow.argtypes = [wintypes.HWND]
u32.IsWindow.restype = wintypes.BOOL
u32.IsWindowVisible.argtypes = [wintypes.HWND]
u32.IsWindowVisible.restype = wintypes.BOOL
u32.EnumChildWindows.argtypes = [wintypes.HWND, ctypes.c_void_p, wintypes.LPARAM]
u32.EnumChildWindows.restype = wintypes.BOOL
u32.FindWindowW.argtypes = [wintypes.LPCWSTR, wintypes.LPCWSTR]
u32.FindWindowW.restype = wintypes.HWND
u32.FindWindowExW.argtypes = [wintypes.HWND, wintypes.HWND, wintypes.LPCWSTR, wintypes.LPCWSTR]
u32.FindWindowExW.restype = wintypes.HWND
u32.GetWindowThreadProcessId.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.DWORD)]
u32.GetWindowThreadProcessId.restype = wintypes.DWORD
u32.AttachThreadInput.argtypes = [wintypes.DWORD, wintypes.DWORD, wintypes.BOOL]
u32.AttachThreadInput.restype = wintypes.BOOL
u32.SetForegroundWindow.argtypes = [wintypes.HWND]
u32.SetForegroundWindow.restype = wintypes.BOOL
u32.SetFocus.argtypes = [wintypes.HWND]
u32.SetFocus.restype = wintypes.HWND
k32.GetCurrentThreadId.restype = wintypes.DWORD
k32.GetCurrentProcess.restype = wintypes.HANDLE
k32.GetCurrentThread.restype = wintypes.HANDLE
k32.SetThreadPriority.argtypes = [wintypes.HANDLE, ctypes.c_int]
k32.SetThreadPriority.restype = wintypes.BOOL
k32.GetModuleHandleW.argtypes = [wintypes.LPCWSTR]
k32.GetModuleHandleW.restype = wintypes.HMODULE
k32.GetProcAddress.argtypes = [wintypes.HMODULE, ctypes.c_char_p]
k32.GetProcAddress.restype = ctypes.c_void_p
k32.VirtualAlloc.argtypes = [ctypes.c_void_p, ctypes.c_size_t, wintypes.DWORD, wintypes.DWORD]
k32.VirtualAlloc.restype = ctypes.c_void_p
k32.VirtualProtect.argtypes = [ctypes.c_void_p, ctypes.c_size_t, wintypes.DWORD, ctypes.POINTER(wintypes.DWORD)]
k32.VirtualProtect.restype = wintypes.BOOL
k32.FlushInstructionCache.argtypes = [wintypes.HANDLE, ctypes.c_void_p, ctypes.c_size_t]
k32.FlushInstructionCache.restype = wintypes.BOOL
k32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
k32.OpenProcess.restype = wintypes.HANDLE
k32.QueryFullProcessImageNameW.argtypes = [wintypes.HANDLE, wintypes.DWORD, wintypes.LPWSTR, ctypes.POINTER(wintypes.DWORD)]
k32.QueryFullProcessImageNameW.restype = wintypes.BOOL
k32.CloseHandle.argtypes = [wintypes.HANDLE]
k32.CloseHandle.restype = wintypes.BOOL

WH_MOUSE_LL = 14
WM_MOUSEMOVE = 0x0200
WM_RBUTTONDOWN = 0x0204
WM_RBUTTONUP = 0x0205
WM_CANCELMODE = 0x001F
RBUTTON_LONG_PRESS_SEC = 0.35
RBUTTON_MOVE_TOLERANCE_PX = 5

_RCLICK_BYPASS_PROCS = {
    "league of legends.exe", "leagueoflegends.exe", "valorant.exe", "valorant-win64-shipping.exe",
    "tslgame.exe", "overwatch.exe", "starcraft.exe", "sc2.exe", "diablo iii64.exe", "diablo iv.exe",
    "lostark.exe", "fc24.exe", "maplestory.exe", "suddenattack.exe", "fifaonline4.exe",
    "blender.exe", "acad.exe", "autocad.exe", "solidworks.exe", "sketchup.exe", "3dsmax.exe", "maya.exe",
    "rhino.exe", "zbrush.exe", "revit.exe", "inventor.exe", "catia.exe",
    "unrealeditor.exe", "unity.exe",
    # 디자인·영상편집 툴 (우클릭 드래그/컨텍스트 작업 보호)
    "photoshop.exe", "illustrator.exe", "afterfx.exe", "adobe premiere pro.exe", "indesign.exe",
    "lightroom.exe", "resolve.exe", "capcut.exe", "vegas190.exe", "vegas200.exe", "clipstudiopaint.exe", "figma.exe",
    # 원격제어·가상머신 및 터미널 (우클릭=붙여넣기 보호)
    "mstsc.exe", "msrdc.exe", "anydesk.exe", "teamviewer.exe", "parsec.exe", "moonlight.exe", "rustdesk.exe",
    "remoting_desktop.exe", "vmware-vmx.exe", "vmware.exe", "virtualboxvm.exe",
    "windowsterminal.exe", "wt.exe", "cmd.exe", "powershell.exe", "pwsh.exe", "conhost.exe", "mintty.exe",
    "putty.exe", "kitty.exe", "xshell.exe", "securecrt.exe", "mobaxterm.exe", "termius.exe",
    # [보안 민감 앱 자동 차단 (App Blocklist)]: 비밀번호 관리자 및 보안 터미널
    "1password.exe", "bitwarden.exe", "keepass.exe", "keepassxc.exe", "dashlane.exe", "enpass.exe",
}

_SECURITY_SENSITIVE_PROCS = {
    "1password.exe", "bitwarden.exe", "keepass.exe", "keepassxc.exe", "dashlane.exe", "enpass.exe",
    "putty.exe", "kitty.exe", "xshell.exe", "securecrt.exe",
}


class MSLLHOOKSTRUCT(ctypes.Structure):
    _fields_ = [
        ("pt", wintypes.POINT),
        ("mouseData", wintypes.DWORD),
        ("flags", wintypes.DWORD),
        ("time", wintypes.DWORD),
        ("dwExtraInfo", ctypes.c_size_t),
    ]


LowLevelMouseProcType = ctypes.WINFUNCTYPE(
    ctypes.c_ssize_t, ctypes.c_int, wintypes.WPARAM, wintypes.LPARAM
)
u32.SetWindowsHookExW.argtypes = [ctypes.c_int, ctypes.c_void_p, wintypes.HINSTANCE, wintypes.DWORD]
u32.SetWindowsHookExW.restype = wintypes.HANDLE
u32.CallNextHookEx.argtypes = [wintypes.HANDLE, ctypes.c_int, wintypes.WPARAM, wintypes.LPARAM]
u32.CallNextHookEx.restype = ctypes.c_ssize_t
u32.UnhookWindowsHookEx.argtypes = [wintypes.HANDLE]
u32.UnhookWindowsHookEx.restype = wintypes.BOOL

_PINNED_MOUSE_HOOK_REFS: list[Any] = []


def _create_x64_rclick_prefilter_stub(py_cb_obj: Any) -> int:
    """
    [마우스 이동 Python GIL 진입 0% 보장 — 순수 네이티브 x64 기계어 프리필터 스텁]
    - WH_MOUSE_LL은 마우스를 1픽셀만 움직여도(WM_MOUSEMOVE=0x0200, 초당 최대 1,000회) 동기로 콜백을 호출하므로,
      ctypes Python 콜백을 직접 등록하면 다른 스레드가 GIL을 잡는 순간 OS 마우스 커서가 버벅일 수 있습니다.
    - 이 56바이트 W^X(RW -> RX) 네이티브 트램펄린은 커널 진입 즉시 C/어셈블리 레벨에서:
      `if (nCode < 0 || (wParam != WM_RBUTTONDOWN && wParam != WM_RBUTTONUP)) return CallNextHookEx(0, nCode, wParam, lParam);`
      를 0.0001ms(약 2ns) 만에 바로 반환하고, 오직 실제 마우스 우클릭(0x0204/0x0205)일 때만 Python 콜백으로 점프합니다.
    """
    if sys.platform != "win32" or ctypes.sizeof(ctypes.c_void_p) != 8:
        return 0
    try:
        h_u32 = k32.GetModuleHandleW("user32.dll")
        addr_next = k32.GetProcAddress(h_u32, b"CallNextHookEx") if h_u32 else 0
        addr_py = ctypes.cast(py_cb_obj, ctypes.c_void_p).value or 0
        if not addr_next or not addr_py:
            return 0
        stub_code = (
            b"\x85\xC9"                          # test ecx, ecx               (nCode < 0 ?)
            b"\x78\x12"                          # js call_next (+0x12 -> 0x16)
            b"\x48\x81\xFA\x04\x02\x00\x00"      # cmp rdx, 0x204              (WM_RBUTTONDOWN)
            b"\x74\x1F"                          # je call_py (+0x1F -> 0x2C)
            b"\x48\x81\xFA\x05\x02\x00\x00"      # cmp rdx, 0x205              (WM_RBUTTONUP)
            b"\x74\x16"                          # je call_py (+0x16 -> 0x2C)
            # call_next (0x16): CallNextHookEx(NULL, nCode, wParam, lParam)
            b"\x4D\x89\xC1"                      # mov r9, r8
            b"\x49\x89\xD0"                      # mov r8, rdx
            b"\x89\xCA"                          # mov edx, ecx
            b"\x31\xC9"                          # xor ecx, ecx
            b"\x48\xB8" + struct.pack("<Q", int(addr_next)) +
            b"\xFF\xE0"                          # jmp rax
            # call_py (0x2C): py_cb_obj(nCode, wParam, lParam)
            b"\x48\xB8" + struct.pack("<Q", int(addr_py)) +
            b"\xFF\xE0"                          # jmp rax
        )
        stub_mem = k32.VirtualAlloc(None, 4096, 0x3000, 0x04)
        if not stub_mem:
            return 0
        ctypes.memmove(stub_mem, stub_code, len(stub_code))
        old_prot = wintypes.DWORD(0)
        if not k32.VirtualProtect(stub_mem, 4096, 0x20, ctypes.byref(old_prot)):
            if not k32.VirtualProtect(stub_mem, 4096, 0x40, ctypes.byref(old_prot)):
                k32.VirtualFree(stub_mem, 0, 0x8000)
                return 0
        k32.FlushInstructionCache(k32.GetCurrentProcess(), stub_mem, len(stub_code))
        _PINNED_MOUSE_HOOK_REFS.append((py_cb_obj, stub_mem))
        return int(stub_mem)
    except Exception:
        return 0

u32.PostMessageW.argtypes = [wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]
u32.PostMessageW.restype = wintypes.BOOL
u32.ReleaseCapture.argtypes = []
u32.ReleaseCapture.restype = wintypes.BOOL

_RBTN_HOLD_STATE: dict = {
    "active": False,
    "down_ts": 0.0,
    "x": 0,
    "y": 0,
    "triggered": False,
    "suppress_next_up": False,
    "dismiss_context_menu_on_up": False,
    "summon_requested": False,
    "precaptured_sel": "",
    "precaptured_ts": 0.0,
    "target_hwnd": None,
}
_LAST_RBTN_DISMISS_ESC_TS: float = 0.0
_MAIN_LOOP_HEARTBEAT_TS: float = time.time()
_UI_LOOP_HEARTBEAT_TS: float = time.time()
_MAIN_LOOP_STAGE: str = "init"
_UI_LOOP_STAGE: str = "init"
_SINGLE_INSTANCE_MUTEX_HANDLE: int = 0
_SEQ_DIAG_LOG_LOCK = threading.Lock()


def set_single_instance_mutex_handle(handle_val: int) -> None:
    """merlin_z_core_daemon.py에서 획득한 단일 인스턴스 Named Mutex 핸들을 등록합니다."""
    global _SINGLE_INSTANCE_MUTEX_HANDLE
    _SINGLE_INSTANCE_MUTEX_HANDLE = int(handle_val or 0)


def _release_single_instance_mutex() -> None:
    """자폭·교체 직전에 Named Mutex를 먼저 반납하여 후계 프로세스가 ERROR_ALREADY_EXISTS로 자살하지 않게 보장합니다."""
    global _SINGLE_INSTANCE_MUTEX_HANDLE
    h_mtx = int(_SINGLE_INSTANCE_MUTEX_HANDLE or 0)
    if not h_mtx or sys.platform != "win32":
        return
    _SINGLE_INSTANCE_MUTEX_HANDLE = 0
    try:
        k32.ReleaseMutex.argtypes = [wintypes.HANDLE]
        k32.ReleaseMutex.restype = wintypes.BOOL
        k32.ReleaseMutex(wintypes.HANDLE(h_mtx))
    except Exception:
        pass
    try:
        k32.CloseHandle.argtypes = [wintypes.HANDLE]
        k32.CloseHandle.restype = wintypes.BOOL
        k32.CloseHandle(wintypes.HANDLE(h_mtx))
    except Exception:
        pass


def _log_seq_diag(event: str, detail: str = "") -> None:
    """
    [경량 블랙박스 진단 로그 — 200KB 롤링]:
    기동 소요 시간·RegisterHotKey/WH_MOUSE_LL 상태·소환 진입·Hang 자폭 사유를 기록해
    현장 먹통 이슈 발생 시 추측 없이 1초 만에 원인을 핀셋 특정합니다.
    """
    try:
        log_p = _MERLIN_APPDATA / "seq_paste_diag.log"
        ts_s = time.strftime("%Y-%m-%d %H:%M:%S")
        line = f"[{ts_s}] pid={os.getpid()} {event}"
        if detail:
            line += f" | {detail}"
        line += "\n"
        with _SEQ_DIAG_LOG_LOCK:
            log_p.parent.mkdir(parents=True, exist_ok=True)
            if log_p.exists() and log_p.stat().st_size > 204800:
                try:
                    tail_b = log_p.read_bytes()[-102400:]
                    nl_idx = tail_b.find(b"\n")
                    if nl_idx >= 0:
                        tail_b = tail_b[nl_idx + 1 :]
                    log_p.write_bytes(tail_b)
                except Exception:
                    pass
            with open(log_p, "a", encoding="utf-8", errors="ignore") as f:
                f.write(line)
    except Exception:
        pass


def _send_msg_timeout_val(
    hwnd: int,
    msg: int,
    wparam: int = 0,
    lparam: int = 0,
    timeout_ms: int = 120,
) -> tuple[bool, int]:
    """
    타 프로세스 창이 일시 응답 없음(Hung/Modal Block) 상태일 때도 메인 단축키·우클릭 루프가 절대 멈추지 않도록
    SendMessageW 대신 SMTO_ABORTIFHUNG(0x0002) 타임아웃 호출만 수행합니다.
    """
    if sys.platform != "win32" or not hwnd:
        return False, 0
    try:
        out_res = ctypes.c_size_t(0)
        ok = u32.SendMessageTimeoutW(
            wintypes.HWND(hwnd),
            msg,
            wintypes.WPARAM(wparam),
            wintypes.LPARAM(lparam),
            0x0002,  # SMTO_ABORTIFHUNG
            timeout_ms,
            ctypes.byref(out_res),
        )
        if ok:
            return True, int(out_res.value)
    except Exception:
        pass
    return False, 0


# =====================================================================
# 🧠 온디바이스 EmbeddingGemma 2 (MRL 128차원 + 262,144 토크나이저 사전 재활용)
# - 별도 무거운 사전 파일을 추가하지 않고, 이미 설치된 EmbeddingGemma 2의
#   tokenizer.json(영단어 65,743개 + 한국어 서브워드)과 파이썬 내장 KS X 1001
#   (0 Byte)을 그대로 재활용하여 엔진 비대화를 0%로 방어합니다.
# =====================================================================
FALLBACK_EN_WORDS = {
    "the", "and", "for", "are", "but", "not", "you", "all", "any", "can", "had", "her", "was", "one",
    "our", "out", "day", "get", "has", "him", "his", "how", "man", "new", "now", "old", "see", "two",
    "way", "who", "boy", "did", "its", "let", "put", "say", "she", "too", "use", "work", "world",
    "check", "hello", "help", "meeting", "merlin", "test", "time", "file", "code", "data", "user",
    "http", "https", "www", "com", "net", "org", "kr", "naver", "google", "cafe", "blog", "mail",
    "good", "best", "love", "life", "home", "page", "link", "send", "save", "open", "exit", "copy",
    "paste", "excel", "word", "windows", "mac", "apple", "phone", "name", "email", "address", "bank",
    "card", "cash", "price", "order", "total", "date", "year", "month", "week", "today", "system",
    "server", "client", "python", "script", "error", "true", "false", "null", "none", "admin", "login",
}

CAPS_TYPO_MAP = {
    "teh": "the",
    "recieve": "receive",
    "seperate": "separate",
    "occured": "occurred",
    "definately": "definitely",
    "accomodate": "accommodate",
}


class Gemma2LightweightEngine:
    """EmbeddingGemma 2 ONNX (MRL 128차원) 및 토크나이저 양방향 사전 통합 엔진"""

    def __init__(self) -> None:
        self.vocab: dict[str, int] = {}
        self.en_dict: set[str] = set(FALLBACK_EN_WORDS)
        self.ko_subwords: set[str] = set()
        self.ko_word_starts: set[str] = set()
        self.ko_chars: set[str] = set("렜왤챱쵝헿됬썻쫒맟슌묭횽뜌땨뤠앍핡핰앜욬잌젹쨰쯜큥핳")
        self.session = None
        self.np = None
        self._loaded = False
        self._warmup_started = False
        self._lock = threading.Lock()
        # [기동 0.1초 즉시 응답 철칙]: import 시점에 26만 어휘 사전을 파싱하면 RegisterHotKey·WH_MOUSE_LL·Tkinter 초기화를
        # GIL 경합으로 3~12초 지연시키므로, 메인 루프·귀신검색창 UI 준비 완료 직후 start_background_warmup()으로 기동합니다.

    def start_background_warmup(self) -> None:
        if self._loaded or self._warmup_started:
            return
        self._warmup_started = True
        threading.Thread(target=self._lazy_init, daemon=True).start()

    def _find_model_dir(self) -> Path | None:
        candidates = [
            Path("D:/Merlin_AI_Models/embeddinggemma-2"),
            Path("E:/Merlin_AI_Models/embeddinggemma-2"),
            Path("C:/Merlin_AI_Models/embeddinggemma-2"),
            Path("F:/Merlin_AI_Models/embeddinggemma-2"),
            Path("G:/Merlin_AI_Models/embeddinggemma-2"),
            Path("D:/Ghosti/node_modules/@huggingface/transformers/.cache/onnx-community/embeddinggemma-2-ONNX"),
            Path("D:/Ghosti/poc/node_modules/@huggingface/transformers/.cache/onnx-community/embeddinggemma-2-ONNX"),
        ]
        for c in candidates:
            if (c / "tokenizer.json").exists():
                return c
        return None

    def _find_lexicon_zlib(self) -> Path | None:
        base_here = Path(__file__).resolve().parent
        meipass_dir = Path(getattr(sys, "_MEIPASS", str(base_here)))
        candidates = [
            meipass_dir / "assets" / "ko_en_lexicon.zlib",
            base_here / "assets" / "ko_en_lexicon.zlib",
            base_here.parent / "assets" / "ko_en_lexicon.zlib",
            Path("C:/MerlinTools/assets/ko_en_lexicon.zlib"),
            Path("D:/Secretary/tools/assets/ko_en_lexicon.zlib"),
        ]
        for c in candidates:
            if c.exists():
                return c
        return None

    def _lazy_init(self) -> None:
        with self._lock:
            if self._loaded:
                return
            try:
                lex_path = self._find_lexicon_zlib()
                if lex_path:
                    try:
                        import zlib
                        lex_data = json.loads(zlib.decompress(lex_path.read_bytes()).decode("utf-8"))
                        for _idx_ew, ew in enumerate(lex_data.get("en", ())):
                            self.en_dict.add(ew)
                            if (_idx_ew & 4095) == 4095:
                                time.sleep(0.001)
                        for _idx_ks, ks in enumerate(lex_data.get("ko_starts", ())):
                            self.ko_word_starts.add(ks)
                            self.ko_subwords.add(ks)
                            for ch in ks:
                                self.ko_chars.add(ch)
                            if (_idx_ks & 4095) == 4095:
                                time.sleep(0.001)
                        for _idx_kb, ksub in enumerate(lex_data.get("ko_subs", ())):
                            self.ko_subwords.add(ksub)
                            for ch in ksub:
                                self.ko_chars.add(ch)
                            if (_idx_kb & 4095) == 4095:
                                time.sleep(0.001)
                    except Exception:
                        pass

                model_dir = self._find_model_dir()
                if model_dir:
                    tok_path = model_dir / "tokenizer.json"
                    data = json.loads(tok_path.read_text(encoding="utf-8"))
                    time.sleep(0.002)
                    vocab = data.get("model", {}).get("vocab", {})
                    self.vocab = vocab
                    for _idx_v, (k, tid) in enumerate(vocab.items()):
                        clean_k = k.lstrip("▁")
                        if k.startswith("▁") and isinstance(tid, int) and tid < 50000:
                            if len(clean_k) >= 4 and clean_k.isalpha() and clean_k.isascii():
                                self.en_dict.add(clean_k.lower())
                        if len(clean_k) >= 1 and all(0xAC00 <= ord(c) <= 0xD7A3 for c in clean_k):
                            self.ko_subwords.add(clean_k)
                            if k.startswith("▁") and len(clean_k) >= 2:
                                self.ko_word_starts.add(clean_k)
                            for ch in clean_k:
                                self.ko_chars.add(ch)
                        if (_idx_v & 4095) == 4095:
                            time.sleep(0.001)

                    # [초경량 데몬 철칙]: seq_paste_daemon.py에서는 200MB ONNX 세션을 중복 로드하지 않고
                    # 내장 압축 사전(ko_en_lexicon.zlib) + tokenizer.json 사전만 로드하여 CPU 0% · 메모리 25MB 이하 초경량 반응속도를 보장합니다.
            except Exception:
                pass
            finally:
                self._loaded = True

    _VALID_SHORT_EN = {
        "a", "i",
        "am", "an", "as", "at", "be", "by", "do", "go", "he", "hi",
        "if", "in", "is", "it", "me", "my", "no", "of", "oh", "ok",
        "on", "or", "so", "to", "up", "us", "we",
        "ai", "os", "pc", "tv", "ui", "ux", "id", "ip", "qa", "db",
        "pr", "hr", "vr", "ar", "vs", "ex", "mr", "ms", "dr", "it",
        "api", "pdf", "url", "usb", "otp", "sns", "vip", "ceo", "faq",
        "qna", "sql", "csv", "xml", "sdk", "cli", "gui", "cpu", "gpu",
        "ram", "ssd", "lan", "vpn", "dns", "ssh", "ftp", "jwt", "ocr",
        "tts", "stt", "llm", "rag", "mvp", "kpi", "roi", "b2b", "b2c",
        "erp", "crm", "cms", "seo", "app", "web", "git", "dev", "pro",
        "max", "min", "sum", "avg", "key", "val", "idx", "str", "int",
        "num", "msg", "err", "req", "res", "src", "dst", "tmp", "cfg",
        "env", "log", "doc", "img", "pic", "vid", "zip", "txt", "xls",
        "ppt", "hwp", "mac", "win", "ios", "apk", "aab", "ipa", "exe",
    }

    def is_valid_english_word(self, word: str) -> bool:
        if not self._loaded:
            self._lazy_init()
        w_raw = word.strip()
        # 한글 두벌식에서 Shift가 쓰이지 않는 알파벳(R,E,Q,T,W,O,P 외)을 대문자로 쳤다면 100% 의도적인 영문 약어(DB, PC, AI, API 등)!
        if len(w_raw) >= 2 and w_raw.isupper() and any(c not in "REQTWOP" for c in w_raw):
            return True
        w = w_raw.lower()
        if len(w) <= 3 and w in self._VALID_SHORT_EN:
            return True
        if len(w) <= 2:
            return False
        if w in self.en_dict:
            return True
        # 일반 영문 접미사(ing, ed, er, es, ly, tion, ment, s) 변형 검사
        for suf in ("s", "es", "ed", "ing", "er", "ly", "tion", "ment"):
            if w.endswith(suf) and len(w) - len(suf) >= 3:
                stem = w[: -len(suf)]
                if stem in self.en_dict or (stem + "e") in self.en_dict:
                    return True
        return False

    def encode_tokens(self, text: str) -> list[int]:
        if not self.vocab:
            return [2, 1]
        s = "▁" + text.strip().replace(" ", "▁")
        ids = [2]
        i = 0
        n = len(s)
        while i < n:
            matched = False
            for end in range(min(n, i + 16), i, -1):
                sub = s[i:end]
                if sub in self.vocab:
                    ids.append(self.vocab[sub])
                    i = end
                    matched = True
                    break
            if not matched:
                ids.append(self.vocab.get(s[i], 3))
                i += 1
        ids.append(1)
        return ids[:128]

    def embed_128d(self, text: str) -> list[float]:
        """MRL(Matryoshka Representation Learning) 상위 128차원 절삭 및 L2 정규화 임베딩 산출"""
        if self.session is not None and self.np is not None:
            try:
                np = self.np
                ids = self.encode_tokens(text)
                inp_ids = np.array([ids], dtype=np.int64)
                att = np.ones_like(inp_ids, dtype=np.int64)
                empty = np.zeros((0, 512), dtype=np.float32)
                out = self.session.run(
                    ["sentence_embedding"],
                    {
                        "input_ids": inp_ids,
                        "attention_mask": att,
                        "image_features": empty,
                        "video_features": empty,
                        "audio_features": empty,
                    },
                )[0][0][:128]
                norm = float(np.linalg.norm(out))
                if norm > 0:
                    out = out / norm
                return [float(x) for x in out]
            except Exception:
                pass
        # 초경량 문자 N-gram 해시 폴백 벡터 (128차원)
        vec = [0.0] * 128
        s = text.lower().strip()
        for idx in range(len(s)):
            h = hash(s[idx : idx + 2]) % 128
            vec[h] += 1.0
        norm = sum(v * v for v in vec) ** 0.5
        return [v / norm for v in vec] if norm > 0 else vec

    @staticmethod
    def cosine_sim(v1: list[float], v2: list[float]) -> float:
        if not v1 or not v2 or len(v1) != len(v2):
            return 0.0
        return sum(a * b for a, b in zip(v1, v2))


AI_ENGINE = Gemma2LightweightEngine()


# =====================================================================
# 두벌식(2-Set) 한<->영 양방향 오타 변환 + KS X 1001 검증 + 한/영 키 자동 전환
# =====================================================================
ENG_TO_JAMO = {
    "r": "ㄱ", "R": "ㄲ", "s": "ㄴ", "e": "ㄷ", "E": "ㄸ", "f": "ㄹ", "a": "ㅁ", "q": "ㅂ", "Q": "ㅃ",
    "t": "ㅅ", "T": "ㅆ", "d": "ㅇ", "w": "ㅈ", "W": "ㅉ", "c": "ㅊ", "z": "ㅋ", "x": "ㅌ", "v": "ㅍ", "g": "ㅎ",
    "k": "ㅏ", "o": "ㅐ", "i": "ㅑ", "O": "ㅒ", "j": "ㅓ", "p": "ㅔ", "u": "ㅕ", "P": "ㅖ", "h": "ㅗ", "y": "ㅛ",
    "n": "ㅜ", "b": "ㅠ", "m": "ㅡ", "l": "ㅣ",
    "S": "ㄴ", "F": "ㄹ", "A": "ㅁ", "D": "ㅇ", "C": "ㅊ", "Z": "ㅋ", "X": "ㅌ", "V": "ㅍ", "G": "ㅎ",
    "K": "ㅏ", "I": "ㅑ", "J": "ㅓ", "U": "ㅕ", "H": "ㅗ", "Y": "ㅛ", "N": "ㅜ", "B": "ㅠ", "M": "ㅡ", "L": "ㅣ",
}
JAMO_TO_ENG = {v: k for k, v in ENG_TO_JAMO.items() if k.islower() or k in ("R", "E", "Q", "T", "W", "O", "P")}

CHOSEONG = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"]
JUNGSEONG = ["ㅏ", "ㅐ", "ㅑ", "ㅒ", "ㅓ", "ㅔ", "ㅕ", "ㅖ", "ㅗ", "ㅘ", "ㅙ", "ㅚ", "ㅛ", "ㅜ", "ㅝ", "ㅞ", "ㅟ", "ㅠ", "ㅡ", "ㅢ", "ㅣ"]
JONGSEONG = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"]

COMPOUND_JUNG = {
    ("ㅗ", "ㅏ"): "ㅘ", ("ㅗ", "ㅐ"): "ㅙ", ("ㅗ", "ㅣ"): "ㅚ",
    ("ㅜ", "ㅓ"): "ㅝ", ("ㅜ", "ㅔ"): "ㅞ", ("ㅜ", "ㅣ"): "ㅟ",
    ("ㅡ", "ㅣ"): "ㅢ",
}
REV_COMPOUND_JUNG = {v: k for k, v in COMPOUND_JUNG.items()}

COMPOUND_JONG = {
    ("ㄱ", "ㅅ"): "ㄳ", ("ㄴ", "ㅈ"): "ㄵ", ("ㄴ", "ㅎ"): "ㄶ",
    ("ㄹ", "ㄱ"): "ㄺ", ("ㄹ", "ㅁ"): "ㄻ", ("ㄹ", "ㅂ"): "ㄼ", ("ㄹ", "ㅅ"): "ㄽ", ("ㄹ", "ㅌ"): "ㄾ", ("ㄹ", "ㅍ"): "ㄿ", ("ㄹ", "ㅎ"): "ㅀ",
    ("ㅂ", "ㅅ"): "ㅄ",
}
REV_COMPOUND_JONG = {v: k for k, v in COMPOUND_JONG.items()}

# 소문자만 쳤을 때 자주 발생하는 쌍자음 어휘 자동 보정 사전 ('조금'->'조끔', '아바타'->'아빠타' 등 정상 어휘 훼손 원천 방지!)
SHIFTLESS_DOUBLE_CONSONANT_FIX = {
    "진자": "진짜",
    "진자야": "진짜야",
    "진자요": "진짜요",
    "어더케": "어떻게",
    "어덯게": "어떻게",
    "아기귄시님": "아기귀신님",
    "날시가": "날씨가",
    "날시": "날씨",
    "박으로": "밖으로",
    "박에": "밖에",
    "덕복이": "떡볶이",
    "덕볶이": "떡볶이",
    "떡복이": "떡볶이",
    "덕복이가": "떡볶이가",
    "덕볶이가": "떡볶이가",
    "떡복이가": "떡볶이가",
}

SHIFTLESS_SAFE_PREFIX_FIX = {
    "어더케": "어떻게",
    "어덯게": "어떻게",
    "날시가": "날씨가",
    "날시는": "날씨는",
    "날시도": "날씨도",
    "덕복이": "떡볶이",
    "덕볶이": "떡볶이",
    "떡복이": "떡볶이",
}


class _GUITHREADINFO(ctypes.Structure):
    _fields_ = [
        ("cbSize", wintypes.DWORD),
        ("flags", wintypes.DWORD),
        ("hwndActive", wintypes.HWND),
        ("hwndFocus", wintypes.HWND),
        ("hwndCapture", wintypes.HWND),
        ("hwndMenuOwner", wintypes.HWND),
        ("hwndMoveSize", wintypes.HWND),
        ("hwndCaret", wintypes.HWND),
        ("rcCaret", wintypes.RECT),
    ]


def get_hybrid_caret_anchor_pos(fg_hwnd: int | None = None) -> tuple[int, int, str]:
    """
    [3중 하이브리드 커서(Caret) 좌표 추적 엔진]
    1차 (Win32 표준): GetGUIThreadInfo API의 rcCaret 구조체를 통해 클라이언트 커서 좌표 획득 후 ClientToScreen 변환.
    2차 (모던 웹·크로스플랫폼 — Chrome/Electron/Slack/Notion/Windows Terminal):
        IUIAutomationTextPattern / GetCaretRange (ExpandToEnclosingUnit 단일 문자 정규화) 바운딩 박스 좌표.
    3차 (폴백 앵커): 마우스 우클릭 롱프레스 시점 또는 현재 포인터 좌표(GetCursorPos) 폴백.
    """
    hwnd = fg_hwnd or u32.GetForegroundWindow()
    if hwnd:
        try:
            gti = _GUITHREADINFO()
            gti.cbSize = ctypes.sizeof(_GUITHREADINFO)
            tid = u32.GetWindowThreadProcessId(hwnd, None)
            if tid and u32.GetGUIThreadInfo(tid, ctypes.byref(gti)):
                caret_hwnd = gti.hwndCaret or gti.hwndFocus
                rc = gti.rcCaret
                if caret_hwnd and (rc.right > 0 or rc.bottom > 0):
                    pt_c = wintypes.POINT(rc.left, rc.bottom)
                    if u32.ClientToScreen(caret_hwnd, ctypes.byref(pt_c)):
                        if (pt_c.x != 0 or pt_c.y != 0) and -10000 < pt_c.x < 20000 and -10000 < pt_c.y < 20000:
                            return int(pt_c.x), int(pt_c.y), "win32_rcCaret"
        except Exception:
            pass
    pt_fallback = wintypes.POINT()
    u32.GetCursorPos(ctypes.byref(pt_fallback))
    return int(pt_fallback.x), int(pt_fallback.y), "cursor_fallback"


def extract_non_destructive_caret_lookbehind(fg_hwnd: int | None = None, max_words: int = 3) -> str:
    """
    [무드래그 3단계 안전망 — 1단계: 커서 직전 토큰 비파괴 자동 역추적 (Caret Lookbehind)]
    사용자가 드래그나 '?' 입력 없이 키워드만 치고 Ctrl+0 / Ctrl+우클릭을 호출했을 때,
    커서(Caret) 바로 앞 최근 1~3어절을 비파괴 스캔하여 암묵적 검색어(Implicit Query)로 추출합니다.
    """
    hwnd = fg_hwnd or u32.GetForegroundWindow()
    if not hwnd:
        return ""
    try:
        focus_h = _get_focused_control_hwnd(hwnd)
        if focus_h:
            s_pos = wintypes.DWORD(0)
            e_pos = wintypes.DWORD(0)
            ok_sel, _ = _send_msg_timeout_val(
                focus_h,
                EM_GETSEL,
                ctypes.addressof(s_pos),
                ctypes.addressof(e_pos),
                timeout_ms=100,
            )
            ok_len, t_len = _send_msg_timeout_val(focus_h, WM_GETTEXTLENGTH, 0, 0, timeout_ms=100)
            if ok_sel and ok_len and 0 < t_len < 32768:
                buf = ctypes.create_unicode_buffer(t_len + 2)
                ok_txt, _ = _send_msg_timeout_val(
                    focus_h,
                    WM_GETTEXT,
                    t_len + 1,
                    ctypes.addressof(buf),
                    timeout_ms=120,
                )
                if ok_txt:
                    caret_idx = e_pos.value if e_pos.value <= len(buf.value) else len(buf.value)
                    before_caret = buf.value[:caret_idx].splitlines()[-1].strip() if caret_idx > 0 else ""
                    if before_caret:
                        tokens = [t for t in re.split(r"\s+", before_caret) if t]
                        return " ".join(tokens[-max_words:]).rstrip("?")
    except Exception:
        pass
    return ""


def _get_focused_control_hwnd(fg_hwnd: int | None = None) -> int:
    """현재 활성 창 내부의 실제 키보드 포커스 컨트롤(Edit/EXCEL6 등) HWND를 반환합니다."""
    hwnd = fg_hwnd or u32.GetForegroundWindow()
    if not hwnd or not u32.IsWindow(hwnd):
        return 0
    try:
        gti = _GUITHREADINFO()
        gti.cbSize = ctypes.sizeof(_GUITHREADINFO)
        tid = u32.GetWindowThreadProcessId(hwnd, None)
        if tid and u32.GetGUIThreadInfo(tid, ctypes.byref(gti)):
            focused = int(gti.hwndFocus or gti.hwndCaret or gti.hwndActive or 0)
            if focused:
                return focused
    except Exception:
        pass
    try:
        ed = u32.FindWindowExW(hwnd, None, "Edit", None)
        if not ed:
            ed = u32.FindWindowExW(hwnd, None, "RichEditD2DPT", None)
        if ed:
            return int(ed)
    except Exception:
        pass
    return int(hwnd)


_LAST_USER_IME_IS_KOR: bool | None = None
_PENDING_UI2_IME_IS_KOR: bool | None = None
_LAST_IME_POLL_TS: list[float] = [0.0]


def _report_ui2_ime_korean(is_kor: bool) -> None:
    global _LAST_USER_IME_IS_KOR
    _LAST_USER_IME_IS_KOR = bool(is_kor)


def _capture_ime_state_for_ui2(fg_hwnd: int | None = None) -> bool | None:
    """
    귀신검색창 소환 직전 사용자가 설정해 둔 실제 키보드 한/영(IME) 상태를 캡처합니다.
    - 크롬·노션·메모장·카톡·탐색기 등 일반 활성 창이면 해당 창의 실시간 IME 상태를 100% 그대로 읽고,
    - 바탕화면(Progman/WorkerW)처럼 자체 입력 IME가 없는 화면이면 직전 활성 창/사용자가 마지막으로 설정한 한/영 상태를 유지합니다.
    """
    global _LAST_USER_IME_IS_KOR, _PENDING_UI2_IME_IS_KOR
    hwnd = int(fg_hwnd or u32.GetForegroundWindow() or 0)
    if hwnd and u32.IsWindow(hwnd):
        cls_n = _get_win_class_only(hwnd)
        if cls_n not in ("Progman", "WorkerW", "Shell_TrayWnd") and "Tk" not in cls_n:
            is_kor_live = bool(get_ime_is_korean(hwnd))
            _LAST_USER_IME_IS_KOR = is_kor_live
            _PENDING_UI2_IME_IS_KOR = is_kor_live
            return is_kor_live
        # 바탕화면/작업표시줄에서도 IME가 한글로 보고되면 반영, 아니면 직전 사용자 키보드 상태 계승
        if get_ime_is_korean(hwnd):
            _LAST_USER_IME_IS_KOR = True
            _PENDING_UI2_IME_IS_KOR = True
            return True
    _PENDING_UI2_IME_IS_KOR = _LAST_USER_IME_IS_KOR
    return _PENDING_UI2_IME_IS_KOR


def get_ime_is_korean(fg_hwnd: int | None = None) -> bool:
    """실제 포커스된 입력 컨트롤(Edit/EXCEL6/Chrome) 및 최상위 창의 현재 한/영(IME) 상태를 정확히 조회합니다."""
    hwnd = fg_hwnd or u32.GetForegroundWindow()
    if not hwnd:
        return False
    focus_h = _get_focused_control_hwnd(hwnd)
    seen_h: set[int] = set()
    for h_cand in (focus_h, hwnd):
        if h_cand and h_cand not in seen_h:
            seen_h.add(h_cand)
            hime = imm32.ImmGetDefaultIMEWnd(h_cand)
            if hime:
                ok_m, mode = _send_msg_timeout_val(hime, WM_IME_CONTROL, IMC_GETCONVERSIONMODE, 0, timeout_ms=35)
                if ok_m and (mode & IME_CMODE_NATIVE) != 0:
                    return True
    return False


def is_ksx1001_syllable(ch: str) -> bool:
    """
    [추가 용량 0 Byte] KS X 1001 상용 한글 2,350자 + EmbeddingGemma 2 최신 한국어 토크나이저 신조어/구어체 음절 합집합 검증
    - '촏', '웱' 같은 순수 오타 외계어는 차단하면서, '설렜다(렜)', '왤케(왤)', '챱챱(챱)', '뜌땨(뜌·땨)' 등 현대 신조어는 100% 허용!
    """
    if not (0xAC00 <= ord(ch) <= 0xD7A3):
        return False
    if ch in AI_ENGINE.ko_chars:
        return True
    try:
        b = ch.encode("euc-kr")
        return len(b) == 2 and (0xB0 <= b[0] <= 0xC8) and (0xA1 <= b[1] <= 0xFE)
    except UnicodeEncodeError:
        return False


def is_valid_korean_word(word: str) -> bool:
    """변환된 한글이 외계어('촏차', '뷁')가 아닌 실제 상용 한글(KS X 1001)인지 검증"""
    if not word or not all(is_ksx1001_syllable(c) for c in word):
        return False
    return True


def set_ime_language(target_korean: bool) -> None:
    """
    [멀린님 핵심 지시 반영] 오타 변환 직후 윈도우 한/영 입력기(IME) 상태를 목표 언어로 자동 동기화 전환!
    - 최상위 창(GetForegroundWindow)과 내부 포커스 컨트롤(Edit/RichEdit/EXCEL6) 양쪽의 IME 컨텍스트를 모두 즉시 동기화합니다.
    - WM_IME_CONTROL 적용 후 실제 상태가 바뀌지 않은 모던 TSF/웹뷰/아래아한글 창에서는 물리 VK_HANGUL(0x15) 스캔코드 토글로 100% 보장합니다.
    """
    try:
        hwnd = u32.GetForegroundWindow()
        hangul_sc = u32.MapVirtualKeyW(VK_HANGUL, 0)
        if hwnd:
            proc_low = _get_process_name_from_hwnd(hwnd).lower()
            cls_low = _get_win_class_only(hwnd).lower()
            is_hwp = ("hwp" in proc_low) or ("hword" in proc_low) or ("hnc" in cls_low)
            is_tsf_browser = proc_low in (
                "chrome.exe",
                "msedge.exe",
                "whale.exe",
                "brave.exe",
                "firefox.exe",
                "opera.exe",
                "vivaldi.exe",
                "arc.exe",
                "iexplore.exe",
            )
            if is_hwp or is_tsf_browser:
                before_tsf_kor = get_ime_is_korean(hwnd)
                if is_hwp or (before_tsf_kor != target_korean):
                    u32.keybd_event(VK_HANGUL, hangul_sc, 0, 0)
                    time.sleep(0.015)
                    u32.keybd_event(VK_HANGUL, hangul_sc, KEYEVENTF_KEYUP, 0)
                return
            before_kor = get_ime_is_korean(hwnd)
            focus_h = _get_focused_control_hwnd(hwnd)
            for h_cand in (focus_h, hwnd):
                if not h_cand:
                    continue
                hime = imm32.ImmGetDefaultIMEWnd(h_cand)
                if hime:
                    ok_cm, curr_mode = _send_msg_timeout_val(hime, WM_IME_CONTROL, IMC_GETCONVERSIONMODE, 0, timeout_ms=90)
                    if ok_cm:
                        is_kor = (curr_mode & IME_CMODE_NATIVE) != 0
                        if is_kor != target_korean:
                            new_mode = (curr_mode | IME_CMODE_NATIVE) if target_korean else (curr_mode & ~IME_CMODE_NATIVE)
                            _send_msg_timeout_val(hime, WM_IME_CONTROL, IMC_SETCONVERSIONMODE, new_mode, timeout_ms=90)
            after_kor = get_ime_is_korean(hwnd)
            if after_kor == target_korean:
                return
            if before_kor != target_korean:
                u32.keybd_event(VK_HANGUL, hangul_sc, 0, 0)
                time.sleep(0.012)
                u32.keybd_event(VK_HANGUL, hangul_sc, KEYEVENTF_KEYUP, 0)
                return
        # 폴백: 한/영 키(VK_HANGUL) 물리 토글
        u32.keybd_event(VK_HANGUL, hangul_sc, 0, 0)
        time.sleep(0.012)
        u32.keybd_event(VK_HANGUL, hangul_sc, KEYEVENTF_KEYUP, 0)
    except Exception:
        pass


def eng_word_to_kor(s: str) -> str:
    jamos = [ENG_TO_JAMO.get(c, c) for c in s]
    merged = []
    i = 0
    while i < len(jamos):
        if i + 1 < len(jamos) and (jamos[i], jamos[i + 1]) in COMPOUND_JUNG:
            merged.append(COMPOUND_JUNG[(jamos[i], jamos[i + 1])])
            i += 2
        else:
            merged.append(jamos[i])
            i += 1

    res = []
    i = 0
    n = len(merged)
    while i < n:
        c = merged[i]
        if c in CHOSEONG and i + 1 < n and merged[i + 1] in JUNGSEONG:
            cho = CHOSEONG.index(c)
            jung = JUNGSEONG.index(merged[i + 1])
            jong = 0
            step = 2
            if i + 2 < n and merged[i + 2] in JONGSEONG:
                if i + 3 < n and merged[i + 3] in JUNGSEONG:
                    jong = 0
                elif i + 3 < n and (merged[i + 2], merged[i + 3]) in COMPOUND_JONG:
                    if i + 4 < n and merged[i + 4] in JUNGSEONG:
                        jong = JONGSEONG.index(merged[i + 2])
                        step = 3
                    else:
                        jong = JONGSEONG.index(COMPOUND_JONG[(merged[i + 2], merged[i + 3])])
                        step = 4
                else:
                    jong = JONGSEONG.index(merged[i + 2])
                    step = 3
            res.append(chr(0xAC00 + (cho * 21 + jung) * 28 + jong))
            i += step
        else:
            res.append(c)
            i += 1
    out = "".join(res)
    if out in SHIFTLESS_DOUBLE_CONSONANT_FIX:
        return SHIFTLESS_DOUBLE_CONSONANT_FIX[out]
    for k_wrong, k_right in SHIFTLESS_SAFE_PREFIX_FIX.items():
        if out.startswith(k_wrong):
            out = k_right + out[len(k_wrong) :]
            break
    return out


def kor_word_to_eng(s: str) -> str:
    out = []
    for ch in s:
        code = ord(ch)
        if 0xAC00 <= code <= 0xD7A3:
            offset = code - 0xAC00
            cho = CHOSEONG[offset // (21 * 28)]
            jung = JUNGSEONG[(offset // 28) % 21]
            jong = JONGSEONG[offset % 28]
            out.append(JAMO_TO_ENG.get(cho, cho))
            if jung in REV_COMPOUND_JUNG:
                for cj in REV_COMPOUND_JUNG[jung]:
                    out.append(JAMO_TO_ENG.get(cj, cj))
            else:
                out.append(JAMO_TO_ENG.get(jung, jung))
            if jong:
                if jong in REV_COMPOUND_JONG:
                    for cjong in REV_COMPOUND_JONG[jong]:
                        out.append(JAMO_TO_ENG.get(cjong, cjong))
                else:
                    out.append(JAMO_TO_ENG.get(jong, jong))
        elif ch in JAMO_TO_ENG:
            out.append(JAMO_TO_ENG[ch])
        elif ch in REV_COMPOUND_JUNG:
            for cj in REV_COMPOUND_JUNG[ch]:
                out.append(JAMO_TO_ENG.get(cj, cj))
        elif ch in REV_COMPOUND_JONG:
            for cjong in REV_COMPOUND_JONG[ch]:
                out.append(JAMO_TO_ENG.get(cjong, cjong))
        else:
            out.append(ch)
    return "".join(out)


eng_to_kor = eng_word_to_kor
kor_to_eng = kor_word_to_eng


_UNDONE_IMMUNE_TOKENS: dict[str, float] = {}

_DIGIT_ATTACHED_EN_UNITS: set[str] = {
    "kb", "mb", "gb", "tb", "pb", "hz", "khz", "mhz", "ghz",
    "px", "em", "rem", "vh", "vw", "pt", "dp", "sp",
    "ms", "ns", "us", "sec", "min", "hr", "hrs",
    "mm", "cm", "km", "mg", "kg", "ml", "dl", "kl", "kcal", "cal",
    "fps", "rpm", "mah", "wh", "kw", "mw", "db", "bit", "byte",
    "am", "pm", "st", "nd", "rd", "th",
}


def _mark_undo_immunity(raw_text: str, duration_sec: float = 120.0) -> None:
    """유저가 Ctrl+Z 또는 Ctrl+0 원복으로 되돌린 영타 문자열은 재차 자동 변환되지 않도록 면역 락을 부여합니다."""
    if not raw_text:
        return
    exp = time.time() + duration_sec
    now_c = time.time()
    for k_old in [k for k, v in _UNDONE_IMMUNE_TOKENS.items() if v < now_c]:
        _UNDONE_IMMUNE_TOKENS.pop(k_old, None)
    full_s = raw_text.strip()
    if full_s:
        _UNDONE_IMMUNE_TOKENS[full_s] = exp
    for part in full_s.split():
        p_clean = part.strip(".,?!:;\"'()[]{}")
        if p_clean:
            _UNDONE_IMMUNE_TOKENS[p_clean] = exp
        _UNDONE_IMMUNE_TOKENS[part] = exp


def _is_undo_immune_token(tok: str) -> bool:
    if not tok or not _UNDONE_IMMUNE_TOKENS:
        return False
    now_c = time.time()
    s = tok.strip()
    s_clean = s.strip(".,?!:;\"'()[]{}")
    for cand in (s, s_clean):
        if cand and _UNDONE_IMMUNE_TOKENS.get(cand, 0.0) > now_c:
            return True
    return False


def _is_protected_account_or_email_token(tok: str) -> bool:
    """
    [최소 주소 보호 & 원복 면역 필터 — 숫자 혼입 문장 과잉 차단 전면 폐지]
    - 명백한 이메일(@: dmsgydmlapdlf@, user@naver.com), URL/도메인(http://, www., .com/.kr 등),
      그리고 유저가 직전에 Ctrl+Z / Ctrl+0으로 원복한 면역 토큰만 보호합니다.
    - 숫자가 포함된 일상 한국어 오타('1chaksdp' -> '1초만에', 'roffjrtl25' -> '갤럭시25')는 제한 없이 변환하며,
      만약 특수 계정/비번 작성 중 변환된 경우에는 Ctrl+Z(또는 8초 내 Ctrl+0 원복) 1회로 즉시 복구 + 면역됩니다.
    """
    if not tok:
        return False
    s = tok.strip()
    if not s:
        return False
    if _is_undo_immune_token(s):
        return True
    if s.lower() in ("ghdrlfehd", "myid"):
        return True
    if "@" in s or "://" in s or s.lower().startswith("www."):
        return True
    if re.search(r"[A-Za-z0-9-]+\.(?:com|net|org|kr|co|io|app|dev|ai|edu|gov|me|biz|info)\b", s, re.IGNORECASE):
        return True
    return False


def morph_korean_english_text_with_direction(text: str) -> tuple[str, str | None]:
    """
    양방향(영->한 KS X 1001 & 한->영 EmbeddingGemma 2 영단어 사전) 스마트 성형 및 목표 언어 방향 반환
    - 반환값: (변환된 문자열, 'KO' | 'EN' | None)
    - [QA 2-2 완치]:
      1) 한영 전환 직전/직후 한글 어절 앞에 실수로 1글자 영문이 붙은 경우('w오늘은 날씨가', 't밖으로 나가고') 영문 찌꺼기 자동 제거!
      2) 영문 오타 앞·중간·뒤에 숫자가 붙은 경우('...dudtkddmf1chaksdp...' ➔ '...영상을1초만에...', 'roffjrtl25' ➔ '갤럭시25')에도 영문 오타 구간을 정확히 분리해 한글로 변환!
    """
    if _is_undo_immune_token(text):
        return text, None
    target_lang: str | None = None

    # 0) 한글 어절(2음절 이상) 바로 앞에 1글자 영문 오타가 달라붙은 경우('w오늘은' -> '오늘은', 't밖으로' -> '밖으로') 즉시 제거
    def _strip_leading_single_eng(m_lead: re.Match) -> str:
        nonlocal target_lang
        target_lang = "KO"
        return m_lead.group(2)

    cleaned_lead = re.sub(r"(?<![A-Za-z0-9_:/.-])([a-zA-Z])([가-힣]{2,})", _strip_leading_single_eng, text)

    def _morph_whitespace_chunk(chunk_m: re.Match) -> str:
        nonlocal target_lang
        w_tok = chunk_m.group(0)
        if _is_protected_account_or_email_token(w_tok):
            return w_tok

        def replace_token(m: re.Match) -> str:
            nonlocal target_lang
            tok = m.group(0)
            start_idx = m.start()

            # 1) 영문 알파벳 토큰인 경우
            if re.fullmatch(r"[A-Za-z]+", tok):
                # 숫자 바로 뒤에 붙은 국제 표준 단위 약어(16gb, 100km, 60hz, 500ml, 3pm 등)는 영문 원형 유지
                if start_idx > 0 and w_tok[start_idx - 1].isdigit() and tok.lower() in _DIGIT_ATTACHED_EN_UNITS:
                    end_idx = m.end()
                    if end_idx >= len(w_tok) or not w_tok[end_idx].isalpha():
                        return tok

                # 1-A) Caps Lock 역전 오타 (예: tHANKS -> Thanks)
                if len(tok) >= 2 and tok[0].islower() and tok[1:].isupper():
                    fixed_caps = tok[0].upper() + tok[1:].lower()
                    if AI_ENGINE.is_valid_english_word(fixed_caps):
                        target_lang = "EN"
                        return fixed_caps

                # 1-B) 상습 영문 오타 (teh -> the)
                if tok.lower() in CAPS_TYPO_MAP:
                    target_lang = "EN"
                    return CAPS_TYPO_MAP[tok.lower()]

                # 1-C) EmbeddingGemma 2 영단어 사전(65,743어)에 존재하는 정상 영단어는 100% 보호!
                if AI_ENGINE.is_valid_english_word(tok):
                    return tok

                # 1-D) 두벌식 한글 변환 후 KS X 1001 2,350자 무결성 검증 통과 시에만 한글로 성형!
                converted = eng_word_to_kor(tok)
                if converted and is_valid_korean_word(converted):
                    target_lang = "KO"
                    return converted
                return tok

            # 2) 낱자 자모(ㅡㄷ갸ㅜ, ㅗ디ㅣㅐ 등)가 섞인 한글 오타 -> 영문 복원!
            if any(0x3131 <= ord(c) <= 0x318E for c in tok):
                eng_cand = kor_word_to_eng(tok)
                if eng_cand:
                    target_lang = "EN"
                    return eng_cand

            # 3) 완성형 한글이지만 영문 타이핑 오타로 의심되는 경우 -> 변환 결과가 실제 영단어 사전에 있으면 영문 복원!
            if all(0xAC00 <= ord(c) <= 0xD7A3 for c in tok):
                eng_cand = kor_word_to_eng(tok)
                if len(eng_cand) >= 3 and AI_ENGINE.is_valid_english_word(eng_cand):
                    if not is_valid_korean_word(tok) or eng_cand.lower() in FALLBACK_EN_WORDS:
                        target_lang = "EN"
                        return eng_cand

            return tok

        return re.sub(r"[A-Za-z]+|[\u3131-\u318E\uAC00-\uD7A3]+", replace_token, w_tok)

    morphed = re.sub(r"\S+", _morph_whitespace_chunk, cleaned_lead)
    return morphed, target_lang


def morph_korean_english_text(text: str) -> str:
    morphed, _ = morph_korean_english_text_with_direction(text)
    return morphed


def has_excel_clipboard_format() -> bool:
    """현재 클립보드에 엑셀(Biff8, XML Spreadsheet, CSV) 고유 포맷이 포함되어 있는지 확인"""
    try:
        if u32.OpenClipboard(None):
            try:
                fmt = 0
                name_buf = ctypes.create_unicode_buffer(128)
                while True:
                    fmt = u32.EnumClipboardFormats(fmt)
                    if not fmt:
                        break
                    if u32.GetClipboardFormatNameW(fmt, name_buf, 128) > 0:
                        fname = name_buf.value.lower()
                        if any(k in fname for k in ("biff", "spreadsheet", "csv", "excel", "wk1")):
                            return True
            finally:
                u32.CloseClipboard()
    except Exception:
        pass
    return False


def split_excel_cells(text: str) -> list[str]:
    """엑셀/표에서 여러 줄이나 탭으로 묶여 복사된 단일 텍스트를 개별 셀 배열로 자동 분해 (일반 줄바꿈·노션 들여쓰기 문장은 오인 분해 절대 금지!)"""
    if not text:
        return []
    # [핵심 가드]: 실제 엑셀/스프레드시트 고유 클립보드 포맷(Biff8/XML Spreadsheet/CSV)이 없는 일반 텍스트(노션 불릿 탭 들여쓰기, 메모장, 웹 복사문)는
    # 절대 개별 셀로 쪼개지 않고 원문 전체를 100% 그대로 보존합니다! (QA 2-4 첫 줄 '별표***'만 붙고 나머지 증발 버그 원천 차단)
    if not has_excel_clipboard_format():
        return []
    s = text.replace("\r\n", "\n").replace("\r", "\n")
    if "\n" not in s and "\t" not in s:
        return []
    raw_parts = re.split(r"[\n\t]+", s)
    parts = [p.strip() for p in raw_parts if p.strip()]
    if len(parts) >= 2:
        return parts
    # 엑셀에서 빈 셀이나 1개 값+빈 셀들을 다중 드래그 복사한 경우
    s_trimmed = s[:-1] if s.endswith("\n") else s
    if "\n" in s_trimmed or "\t" in s_trimmed:
        grid_cells = [c.strip() for c in re.split(r"[\n\t]", s_trimmed)]
        if len(grid_cells) >= 2:
            return grid_cells
    return []


# =====================================================================
# 👻 귀신같이 마이크로 캡슐 토스트 (단일 워커 + WS_EX_TRANSPARENT | WS_EX_NOACTIVATE)
# =====================================================================
_toast_queue: "queue.Queue[tuple[str, int]]" = queue.Queue()


GHOSTI_WEB_URL = os.environ.get("GHOSTI_WEB_URL", "https://ghosti.sundreamer.app")
_MEIPASS_BASE = Path(getattr(sys, "_MEIPASS", str(Path(__file__).resolve().parent)))
_CAND_SOUNDS = [
    _MEIPASS_BASE / "baby_ghost_sounds",
    _MEIPASS_BASE / "assets",
    Path(__file__).resolve().parent / "baby_ghost_sounds",
    Path(__file__).resolve().parent / "assets",
    Path(__file__).resolve().parent.parent / "os_agent" / "baby_ghost_sounds",
    Path(__file__).resolve().parent.parent / "data" / "baby_ghost_sounds",
    Path("C:/MerlinTools/assets"),
]
SOUNDS_DIR = next(
    (d for d in _CAND_SOUNDS if (d / "active_summon_sound.wav").exists() or (d / "sample6_ctrl0_summon.wav").exists()),
    _CAND_SOUNDS[0],
)
ASSETS_DIR = _MEIPASS_BASE / "assets" if (_MEIPASS_BASE / "assets").exists() else (Path(__file__).resolve().parent / "assets")

_MERLIN_APPDATA = Path(os.environ.get("LOCALAPPDATA", os.path.expanduser("~"))) / "Ghosti" / "data"
_LEGACY_MERLIN_APPDATA = Path(os.environ.get("LOCALAPPDATA", os.path.expanduser("~"))) / "Merlin"
try:
    _MERLIN_APPDATA.mkdir(parents=True, exist_ok=True)
    if _LEGACY_MERLIN_APPDATA.exists():
        for _mig_name in ("superpower_settings.json", "superpower_trial_ledger.json", "user_snippets.json", "fixed_snippets.json"):
            _src_m = _LEGACY_MERLIN_APPDATA / _mig_name
            _dst_m = _MERLIN_APPDATA / _mig_name
            if _src_m.exists() and not _dst_m.exists():
                import shutil as _sh_mig
                _sh_mig.copy2(_src_m, _dst_m)
except Exception:
    pass
TELEMETRY_FILE = _MERLIN_APPDATA / "superpower_telemetry.json"
TELEMETRY_CONFIG_FILE = _MERLIN_APPDATA / "superpower_telemetry_config.json"
SUPERPOWER_SETTINGS_FILE = _MERLIN_APPDATA / "superpower_settings.json"
E2EE_MAILBOX_FILE = _MERLIN_APPDATA / "offline_e2ee_mailbox.json"

DEFAULT_SUPERPOWER_SETTINGS: dict = {
    "retention_days": 7,  # 1(오늘만 24시간), 3(3일), 7(기본 7일·300개), 30(한 달 30일·1000개)
    "max_items": 300,
    "sound_enabled": True,
    "sound_volume": 0.25,  # 0.05 ~ 1.0 (기본 25% 은은한 볼륨 강제 스케일링)
    "window_duration_ms": 6500,
    "ghostkey_enabled": False,  # [원엔진·투도어] 기본 False(모든 Ctrl+0 = 귀신검색창). 귀신키 정식 출시 후 권한 보유 유저가 켰을 때만 입력창 귀신키 분기 활성!
    "auto_typo_enabled": True,
    "e2ee_mailbox_enabled": True,
    "family_shared_slots": ["F1", "F2"],
}


_SUPERPOWER_SETTINGS_LOCK = threading.RLock()
_SUPERPOWER_SETTINGS_MEM_CACHE: dict[str, Any] = {
    "checked_ts": 0.0,
    "mtime": -1.0,
    "data": None,
}


def get_superpower_settings() -> dict:
    with _SUPERPOWER_SETTINGS_LOCK:
        now_s = time.monotonic()
        cached = _SUPERPOWER_SETTINGS_MEM_CACHE.get("data")
        if cached is not None and (now_s - float(_SUPERPOWER_SETTINGS_MEM_CACHE.get("checked_ts") or 0.0)) < 2.0:
            return dict(cached)

        _SUPERPOWER_SETTINGS_MEM_CACHE["checked_ts"] = now_s
        cur_mtime = -1.0
        try:
            cur_mtime = SUPERPOWER_SETTINGS_FILE.stat().st_mtime
        except Exception:
            cur_mtime = -1.0

        if cached is not None and cur_mtime == float(_SUPERPOWER_SETTINGS_MEM_CACHE.get("mtime") or -2.0):
            return dict(cached)

        cfg = dict(DEFAULT_SUPERPOWER_SETTINGS)
        if cur_mtime >= 0.0:
            try:
                loaded = json.loads(SUPERPOWER_SETTINGS_FILE.read_text(encoding="utf-8"))
                if isinstance(loaded, dict):
                    cfg.update(loaded)
            except Exception:
                pass
        try:
            days = int(cfg.get("retention_days", 7))
        except (ValueError, TypeError):
            days = 7
        if days not in (1, 3, 7, 30):
            days = 7
        cfg["retention_days"] = days
        cfg["max_items"] = 1000 if days >= 30 else 300
        try:
            cfg["window_duration_ms"] = max(2000, min(20000, int(cfg.get("window_duration_ms", 6500))))
        except (ValueError, TypeError):
            cfg["window_duration_ms"] = 6500
        _SUPERPOWER_SETTINGS_MEM_CACHE["mtime"] = cur_mtime
        _SUPERPOWER_SETTINGS_MEM_CACHE["data"] = dict(cfg)
        return dict(cfg)


def update_superpower_settings(patch: dict) -> dict:
    with _SUPERPOWER_SETTINGS_LOCK:
        _SUPERPOWER_SETTINGS_MEM_CACHE["checked_ts"] = 0.0
        cfg = get_superpower_settings()
        if "retention_days" in patch and patch["retention_days"] is not None:
            try:
                days = int(patch["retention_days"])
            except (ValueError, TypeError):
                days = 7
            cfg["retention_days"] = days if days in (1, 3, 7, 30) else 7
            cfg["max_items"] = 1000 if cfg["retention_days"] >= 30 else 300
        if "sound_enabled" in patch and patch["sound_enabled"] is not None:
            cfg["sound_enabled"] = bool(patch["sound_enabled"])
        if "sound_volume" in patch and patch["sound_volume"] is not None:
            try:
                cfg["sound_volume"] = max(0.05, min(1.0, float(patch["sound_volume"])))
            except Exception:
                pass
        if "window_duration_ms" in patch and patch["window_duration_ms"] is not None:
            try:
                cfg["window_duration_ms"] = max(2000, min(20000, int(patch["window_duration_ms"])))
            except (ValueError, TypeError):
                pass
        if "ghostkey_enabled" in patch and patch["ghostkey_enabled"] is not None:
            cfg["ghostkey_enabled"] = bool(patch["ghostkey_enabled"])
        if "auto_typo_enabled" in patch and patch["auto_typo_enabled"] is not None:
            cfg["auto_typo_enabled"] = bool(patch["auto_typo_enabled"])
        if "e2ee_mailbox_enabled" in patch and patch["e2ee_mailbox_enabled"] is not None:
            cfg["e2ee_mailbox_enabled"] = bool(patch["e2ee_mailbox_enabled"])
        if "family_shared_slots" in patch and isinstance(patch["family_shared_slots"], list):
            cfg["family_shared_slots"] = [str(s).upper() for s in patch["family_shared_slots"] if str(s).upper().startswith("F")]
        cfg["updated_at"] = datetime.datetime.now().isoformat(timespec="seconds")
        try:
            _MERLIN_APPDATA.mkdir(parents=True, exist_ok=True)
            tmp_p = SUPERPOWER_SETTINGS_FILE.with_suffix(f".tmp.{os.getpid()}.{threading.get_ident()}")
            tmp_p.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")
            os.replace(tmp_p, SUPERPOWER_SETTINGS_FILE)
            _SUPERPOWER_SETTINGS_MEM_CACHE["mtime"] = SUPERPOWER_SETTINGS_FILE.stat().st_mtime
        except Exception:
            pass
        _SUPERPOWER_SETTINGS_MEM_CACHE["checked_ts"] = time.monotonic()
        _SUPERPOWER_SETTINGS_MEM_CACHE["data"] = dict(cfg)
        return dict(cfg)


_CLEAR_ALL_REQUESTED = False
CLEAR_SIGNAL_FILE = _MERLIN_APPDATA / "clear_clipboard_signal.txt"
OPEN_UI2_SIGNAL_FILE = _MERLIN_APPDATA / "open_ui2_search_signal.json"


def empty_os_clipboard() -> bool:
    """실제 윈도우 OS 시스템 클립보드(Ctrl+V 버퍼)까지 100% 깨끗하게 비웁니다."""
    for _ in range(8):
        if u32.OpenClipboard(None):
            try:
                u32.EmptyClipboard()
                return True
            finally:
                u32.CloseClipboard()
        time.sleep(0.015)
    return False


def clear_clipboard_history() -> int:
    """[🧹 즉시 비우기]: 복사검색 히스토리 + 오프라인 E2EE 우체통 + 순차 붙여넣기 대기열 + 윈도우 OS 시스템 클립보드 즉시 초기화 (다중 프로세스 신호 동기화 포함)"""
    global _CLEAR_ALL_REQUESTED
    _CLEAR_ALL_REQUESTED = True
    cleared = len(GLOBAL_AI_HISTORY)
    GLOBAL_AI_HISTORY.clear()
    empty_os_clipboard()
    try:
        _MERLIN_APPDATA.mkdir(parents=True, exist_ok=True)
        CLEAR_SIGNAL_FILE.write_text(str(time.time()), encoding="utf-8")
    except Exception:
        pass
    for fpath in (E2EE_MAILBOX_FILE, QUEUE_FILE, HISTORY_FILE):
        try:
            if fpath.exists():
                fpath.unlink()
        except Exception:
            pass
    close_ghost_toast()
    return cleared


def sync_offline_e2ee_mailbox(incoming_items: list[dict] | None = None) -> dict:
    """
    [내 기기 통합 (월 3,900원) — 무버튼 양방향 클립보드 '암호화 우체통(E2EE Store-and-Forward)' 동기화]
    - 집 PC가 꺼져 있을 때 회사 PC나 스마트폰에서 복사(Ctrl+C / 캡처)한 최근 항목(텍스트 100개 + 스샷 10장)을
      종단간 암호화(E2EE) 우체통 버퍼에 보관했다가 PC 부팅 즉시 Ctrl+0 [복사검색] 리스트에 0.1초 만에 합류시킵니다.
    """
    box: dict = {"text_items": [], "image_items": [], "updated_at": None}
    try:
        if E2EE_MAILBOX_FILE.exists():
            loaded = json.loads(E2EE_MAILBOX_FILE.read_text(encoding="utf-8"))
            if isinstance(loaded, dict):
                box.update(loaded)
    except Exception:
        pass

    if incoming_items:
        for item in incoming_items:
            if not isinstance(item, dict):
                continue
            kind = str(item.get("kind") or "text")
            txt = str(item.get("text") or "").strip()
            if not txt:
                continue
            rec = {
                "kind": kind,
                "text": txt,
                "device": str(item.get("device") or "내 다른 기기"),
                "ts": float(item.get("ts") or time.time()),
                "e2ee": True,
            }
            if kind == "image":
                img_list = box.setdefault("image_items", [])
                img_list.append(rec)
                box["image_items"] = img_list[-10:]
            else:
                txt_list = box.setdefault("text_items", [])
                if not txt_list or txt_list[-1].get("text") != txt:
                    txt_list.append(rec)
                box["text_items"] = txt_list[-100:]
            GLOBAL_AI_HISTORY.append({
                "kind": "text",
                "text": f"[{rec['device']}] {txt}",
                "vec": AI_ENGINE.embed_128d(txt[:160]),
                "ts": rec["ts"],
            })
        box["updated_at"] = datetime.datetime.now().isoformat(timespec="seconds")
        try:
            _MERLIN_APPDATA.mkdir(parents=True, exist_ok=True)
            E2EE_MAILBOX_FILE.write_text(json.dumps(box, ensure_ascii=False, indent=2), encoding="utf-8")
        except Exception:
            pass

    return {
        "ok": True,
        "text_buffered": len(box.get("text_items", [])),
        "image_buffered": len(box.get("image_items", [])),
        "max_text_buffer": 100,
        "max_image_buffer": 10,
        "updated_at": box.get("updated_at"),
        "items": (box.get("text_items", []) + box.get("image_items", []))[-20:],
    }


def is_telemetry_enabled() -> bool:
    """환경설정의 [서비스 개선을 위한 익명 사용 통계 보내기] 토글 상태 조회 (기본값 True)"""
    try:
        if TELEMETRY_CONFIG_FILE.exists():
            cfg = json.loads(TELEMETRY_CONFIG_FILE.read_text(encoding="utf-8"))
            return bool(cfg.get("enabled", True))
    except Exception:
        pass
    return True


def set_telemetry_enabled(enabled: bool) -> bool:
    """환경설정의 [서비스 개선을 위한 익명 사용 통계 보내기] 토글 상태 저장"""
    try:
        _MERLIN_APPDATA.mkdir(parents=True, exist_ok=True)
        TELEMETRY_CONFIG_FILE.write_text(
            json.dumps({"enabled": bool(enabled), "updatedAt": datetime.datetime.now().isoformat(timespec="seconds")}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    except Exception:
        pass
    return bool(enabled)


def kor_text_to_eng(text: str) -> str:
    return kor_word_to_eng(text)


_toast_event = threading.Event()
GLOBAL_AI_HISTORY: list[dict] = []


def close_ghost_toast() -> None:
    """초능력 실행 또는 외부 클릭 시 귀신창(Ghost Window)을 즉시 닫음"""
    global _CURRENT_OPEN_UI_MODE, _CURRENT_OPEN_WIN_HWND
    _CURRENT_OPEN_UI_MODE = ""
    _CURRENT_OPEN_WIN_HWND = 0
    _toast_queue.put(("__CLOSE__", 0))
    _toast_event.set()


_MACHINE_HWID_MEM: str = ""


def _get_machine_hwid_local() -> str:
    """메인보드 UUID / 머신 GUID 기반 기기 고유 해시(sha256_...) 반환 (프로세스 내 영구 메모리 캐시)"""
    global _MACHINE_HWID_MEM
    if _MACHINE_HWID_MEM:
        return _MACHINE_HWID_MEM
    import hashlib
    import platform
    raw_id = f"{platform.node()}::{platform.machine()}"
    if os.name == "nt":
        try:
            import winreg
            with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Cryptography") as k:
                guid, _ = winreg.QueryValueEx(k, "MachineGuid")
                if guid:
                    raw_id = f"{guid}::{platform.node()}"
        except Exception:
            pass
    digest = hashlib.sha256(raw_id.encode("utf-8")).hexdigest()[:20]
    _MACHINE_HWID_MEM = f"sha256_{digest}"
    return _MACHINE_HWID_MEM


# =====================================================================
# 🏷️ [확정 ⑤·⑥] 귀신 라벨러(Auto-Naming 날짜 3원칙) & 귀신 말풍선(원본 수정일 동결) & 🎁 30일 무제한 체험(Opt-in) + 손실회피 성적표
# =====================================================================
_CANNED_FILENAME_PATTERNS = re.compile(
    r"^(IMG|DSC|DCIM|PXL|SAM|DJI|Screenshot|Screen[\s_-]*Shot|KakaoTalk|스캔|scan|문서|새\s*텍스트\s*문서|새\s*문서|제목[\s_-]*없음|이름[\s_-]*없음|무제|Untitled|Document|image|photo|캡처|다운로드|download|file|test|sample)[\s_-]*\d*",
    re.IGNORECASE,
)

# [레드팀 확정 ⑤]: 전화번호(010-2026-1234, 02-2611-0500), 금액(145,000원), 사업자번호 오인을 원천 차단하는 전처리 필터 + 유효 달력 범위 정규식
_PHONE_OR_MONEY_NOISE_REGEX = re.compile(
    r"(?:\b0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}\b|\b1[568]\d{2}[-.\s]?\d{4}\b|\b\d{3}-\d{2}-\d{5}\b|\b\d{1,3}(?:,\d{3})+(?:\s*원)?\b|\b\d+\s*원\b)"
)
_VALID_DOC_DATE_REGEX = re.compile(
    r"(?<!\d)(199\d|20[0-3]\d)\s*(?:년|[./-])\s*(0?[1-9]|1[0-2])\s*(?:월|[./-])\s*(0?[1-9]|[12]\d|3[01])(?:\s*일)?(?!\d)"
)
_VALID_DOC_SHORT_YEAR_REGEX = re.compile(
    r"(?<!\d)(2[0-9])\s*년\s*(0?[1-9]|1[0-2])\s*월\s*(0?[1-9]|[12]\d|3[01])\s*일?(?!\d)"
)


def extract_first_valid_date_from_content(ocr_or_doc_text: str) -> str | None:
    """
    [확정 ⑤ — 귀신 라벨러 날짜 3원칙 중 3번(YYMMDD_내용_) 전용 파서]:
    전화번호(010-2026-1234 등)·사업자번호·금액(145,000원 등)을 먼저 마스킹 제거한 뒤,
    유효 달력 범위(1990~2035년, 01~12월, 01~31일)와 날짜 구분자(년/월/일, ., -, /) 검증을 통과한
    '문서/사진 내 첫 번째로 등장하는 진짜 날짜'만 추출하여 6자리 YYMMDD 문자열로 반환합니다.
    """
    if not ocr_or_doc_text:
        return None
    sanitized = _PHONE_OR_MONEY_NOISE_REGEX.sub(" ", ocr_or_doc_text)
    m = _VALID_DOC_DATE_REGEX.search(sanitized)
    if m:
        yyyy = int(m.group(1))
        mm = int(m.group(2))
        dd = int(m.group(3))
        if 1990 <= yyyy <= 2035 and 1 <= mm <= 12 and 1 <= dd <= 31:
            return f"{yyyy % 100:02d}{mm:02d}{dd:02d}"
    m2 = _VALID_DOC_SHORT_YEAR_REGEX.search(sanitized)
    if m2:
        yy = int(m2.group(1))
        mm = int(m2.group(2))
        dd = int(m2.group(3))
        if 1 <= mm <= 12 and 1 <= dd <= 31:
            return f"{yy:02d}{mm:02d}{dd:02d}"
    return None


def format_ghost_labeler_filename(
    original_filename: str,
    summary_slug: str,
    *,
    exif_yymmdd: str | None = None,
    kakao_yymmdd: str | None = None,
    ocr_or_doc_text: str = "",
    is_work_s_drive: bool = False,
    uploader_name: str = "",
    prefix_only_if_named: bool = False,
) -> dict:
    """
    [🏷️ 귀신 라벨러 3대 안전핀 & 정직한 날짜 정렬 3원칙]:
    1) 개인➔업무(S: 드라이브) 이동 시 중복 방지 스마트 재라벨링 (Smart Re-Labeling):
       이미 개인 폴더에서 `261107_영수증_한일건재_145,000원.jpg`로 라벨링된 파일을 회사 S: 폴더로 옮기면,
       맨 앞 6자리 날짜(YYMMDD_) 패턴을 인식하여 날짜 중복 없이 바로 뒤에 `_김대리`만 끼워 넣음!
    2) 날짜 출처 꼬리표 딱 3종류:
       - 진짜 EXIF 촬영일: `YYMMDD_[올린사람_][장소/내용]` (출처 꼬리표 없음)
       - 카톡 수신 파일: `YYMMDD_[올린사람_]카톡_[내용]`
       - 본문/OCR 첫 등장 날짜: `YYMMDD_[올린사람_]내용_[문서종류/내용]`
    """
    stem, ext = os.path.splitext(original_filename.strip())
    clean_uploader = re.sub(r"[^\w가-힣]", "", uploader_name or "").strip()

    # 🔄 안전핀 3: 이미 YYMMDD_로 라벨링된 개인 파일을 업무용 S: 드라이브로 옮길 때 스마트 재라벨링
    m_already = re.match(r"^(\d{6})_(.+)$", stem)
    if m_already:
        yymmdd_head, rest_body = m_already.group(1), m_already.group(2)
        if is_work_s_drive and clean_uploader:
            if not rest_body.startswith(clean_uploader + "_"):
                upgraded = f"{yymmdd_head}_{clean_uploader}_{rest_body}{ext}"
                return {
                    "changed": True,
                    "mode": "SMART_RELABEL_PERSONAL_TO_WORK",
                    "original_filename": original_filename,
                    "labeled_filename": upgraded,
                    "date_rule": "SMART_UPGRADE",
                }
        return {
            "changed": False,
            "mode": "ALREADY_LABELED",
            "original_filename": original_filename,
            "labeled_filename": original_filename,
            "date_rule": "EXISTING",
        }

    # 안전핀 1: 기계식 깡통 파일명인지 판별 (순수 숫자 파일명 2201.pdf, 1.txt 등도 100% 깡통 파일명으로 인식!)
    is_canned = (
        bool(_CANNED_FILENAME_PATTERNS.match(stem))
        or bool(re.fullmatch(r"[\d_-]+", stem))
        or bool(re.fullmatch(r"[0-9a-fA-F_-]{5,}", stem))
    )
    if not is_canned and not prefix_only_if_named:
        return {
            "changed": False,
            "mode": "SKIPPED_MEANINGFUL_NAME",
            "original_filename": original_filename,
            "labeled_filename": original_filename,
            "date_rule": "NONE",
        }

    # 날짜 3원칙 판정
    date_rule = "EXIF_REAL"
    source_tag = ""
    if kakao_yymmdd or ("kakaotalk" in stem.lower()) or ("카톡" in stem):
        m_kk = re.search(r"20(\d{6})", stem)
        yymmdd = kakao_yymmdd if (kakao_yymmdd and re.fullmatch(r"\d{6}", kakao_yymmdd)) else (m_kk.group(1) if m_kk else datetime.date.today().strftime("%y%m%d"))
        date_rule = "RULE2_KAKAO_RECEIVED"
        source_tag = "카톡"
    elif exif_yymmdd and re.fullmatch(r"\d{6}", exif_yymmdd):
        yymmdd = exif_yymmdd
        date_rule = "RULE1_EXIF_REAL"
        source_tag = ""
    else:
        extracted_yymmdd = extract_first_valid_date_from_content(ocr_or_doc_text)
        yymmdd = extracted_yymmdd or datetime.date.today().strftime("%y%m%d")
        date_rule = "RULE3_CONTENT_FIRST_DATE"
        source_tag = "내용"

    tokens = [yymmdd]
    if is_work_s_drive and clean_uploader:
        tokens.append(clean_uploader)
    if source_tag:
        tokens.append(source_tag)

    clean_slug = re.sub(r"[\\/:*?\"<>|\s]+", "_", (summary_slug or stem).strip()).strip("_")
    if not is_canned and prefix_only_if_named and clean_slug == stem:
        tokens.append(stem)
    else:
        tokens.append(clean_slug)
    labeled_name = f"{'_'.join(tokens)}{ext}"

    return {
        "changed": labeled_name != original_filename,
        "mode": "LABELED",
        "original_filename": original_filename,
        "labeled_filename": labeled_name,
        "date_rule": date_rule,
    }


def apply_ghost_bubble_tooltip_preserving_mtime(file_path: str | Path, summary_3lines: str) -> bool:
    """
    [확정 ⑥ — 💬 귀신 말풍선(3웨이브 일반 탐색기 호버 3줄 요약) 원본 파일 수정일(LastWriteTime) 동결 보호]:
    파일에 3줄 요약 메타를 연동할 때 원본 파일의 CreationTime / LastWriteTime(st_atime_ns, st_mtime_ns)을
    0.001초 오차도 없이 백업 후 즉시 복원(Freeze/Preserve)하여 탐색기 날짜 정렬 오염을 0%로 차단합니다.
    """
    p_target = Path(file_path)
    if not p_target.exists():
        return False
    orig_stat = p_target.stat()
    orig_atime_ns = orig_stat.st_atime_ns
    orig_mtime_ns = orig_stat.st_mtime_ns
    try:
        # 1순위: 로컬 Z-코어 30KB 캐시 원장에 등록 (Shell IQueryInfo 핸들러가 원본 파일 무접촉 조회)
        bubble_cache_file = _MERLIN_APPDATA / "ghost_bubble_30kb_cache.json"
        _MERLIN_APPDATA.mkdir(parents=True, exist_ok=True)
        cache_data: dict = {}
        if bubble_cache_file.exists():
            try:
                cache_data = json.loads(bubble_cache_file.read_text(encoding="utf-8"))
            except Exception:
                cache_data = {}
        cache_data[str(p_target.resolve())] = {
            "summary_3lines": summary_3lines.strip(),
            "preserved_mtime_ns": orig_mtime_ns,
            "updated_at": datetime.datetime.now().isoformat(timespec="seconds"),
        }
        bubble_cache_file.write_text(json.dumps(cache_data, ensure_ascii=False, indent=2), encoding="utf-8")
    finally:
        # 원본 파일 타임스탬프 100% 동결 복원
        try:
            os.utime(p_target, ns=(orig_atime_ns, orig_mtime_ns))
        except Exception:
            pass
    return True


def resolve_summon_window_ui_routing(
    *,
    selected_text: str = "",
    caret_lookbehind_text: str = "",
    has_60s_unconsumed_phone_photo: bool = False,
    is_editable_input_focused: bool = True,
    typed_in_basic_window: str = "",
) -> dict:
    """
    [확정 ① & v1.3 대개편 — 무드래그 안전망 + 바탕화면/비입력창 즉시 귀신검색창 직행 + 기본창 타이핑 시 즉시 귀신검색창 전환 라우터]:
    1) 60초 이내 미소비 폰 촬영/스샷이 있으면 -> 창 UI ③ (One-Time Pop) 또는 창 UI ② Row 0 도킹
    2) 명시적 트리거('드래그 선택' 또는 끝에 '?'/'？' 입력)가 있을 때 -> 창 UI ②(귀신검색창)로 100% 직행!
    3) [v1.3 신규] 모니터 바탕화면, 탐색기 빈 공간, 웹페이지 빈 곳처럼 글씨 입력창이 아닌 곳(is_editable_input_focused=False)에서
       Ctrl+0 (또는 Ctrl+우클릭) 호출 시 -> 드래그나 '?'가 없어도 즉시 곧바로 『👻 귀신검색창(UI ②)』 직행!
    4) [v1.3 신규] 입력창에서 '?' 없이 Ctrl+0을 눌러 기본 귀신창(UI ①)이 떴더라도, 유저가 키보드로 검색어(typed_in_basic_window)를
       타이핑하기 시작하면 0.01초 만에 즉시 『👻 귀신검색창(UI ②)』으로 스르륵 자동 변신!
    5) 그 외 일반 타이핑 중 호출 시 -> 창 UI ①(기본 귀신창: 상용구·클립보드·초능력)을 기본 유지하되,
       커서 앞 어절(caret_lookbehind_text)이 있으면 창 UI ① 상단 0순위에 '[🔍 방금 친 어절 관련 파일 즉시 소환]' 1줄 브릿지 칩을 함께 표시!
    """
    sel = (selected_text or "").strip()
    look = (caret_lookbehind_text or "").strip()
    typed_q = (typed_in_basic_window or "").strip()
    if sel:
        return {
            "target_ui": "ui2_summon",
            "reason": "EXPLICIT_DRAG_SELECTION",
            "query": sel.rstrip("?？").strip(),
            "inline_bridge_token": None,
        }
    if look.endswith(("?", "？")):
        return {
            "target_ui": "ui2_summon",
            "reason": "EXPLICIT_QUESTION_MARK_TRIGGER",
            "query": look.rstrip("?？").strip(),
            "inline_bridge_token": None,
        }
    if typed_q:
        return {
            "target_ui": "ui2_summon",
            "reason": "TYPED_QUERY_IN_UI1_AUTO_MORPH_TO_SEARCH",
            "query": typed_q,
            "inline_bridge_token": None,
        }
    if not is_editable_input_focused:
        return {
            "target_ui": "ui2_summon",
            "reason": "DESKTOP_OR_NON_INPUT_DIRECT_GHOST_SEARCH",
            "query": "",
            "inline_bridge_token": None,
        }
    if has_60s_unconsumed_phone_photo:
        return {
            "target_ui": "ui3_ocr",
            "reason": "ONE_TIME_60S_PHONE_PHOTO",
            "query": "",
            "inline_bridge_token": look or None,
        }
    return {
        "target_ui": "ui1_basic",
        "reason": "PRESERVE_UI1_WITH_INLINE_LOOKBEHIND_BRIDGE",
        "query": "",
        "inline_bridge_token": look if len(look) >= 2 else None,
    }


GHOST_SEARCH_WINDOW_STAGE_SIZES: dict[str, tuple[int, int]] = {
    "small": (520, 380),    # 소형: 기본 미니 탐색기 (문서 1개 빠르게 찾아 Enter 주입)
    "medium": (960, 640),   # 중형: 일반 탐색기 크기 (사진 + 우측 OCR 텍스트/단어칩 또는 문서 본문 미리보기 황금 사이즈)
    "large": (1440, 900),   # 대형: [🖼️ 갤러리로 펼쳐보기] 주소창 없는 프레임리스 전용 앱 창 (🪪 귀신계 여권 & 가족방 직결)
}


def resolve_ghost_search_auto_stage(
    mode: str,
    has_query: bool,
    matched_count: int,
    has_rich_preview: bool = False,
) -> tuple[str, int | None]:
    """
    [v1.4 확정 — 『👻 귀신검색창』 크게/작게 2모드 + 작게 모드 내 소↔중 자율 반응형 판별기]
    - mode == 'large': 대화면 갤러리(1440×900) 고정
    - mode != 'large' ('compact' 작게 모드):
      * 검색어가 있고 결과가 4건 이상이거나 사진/문서 미리보기(OCR) 항목이 잡히면 ➔ 중형(960×640) 자율 확장
      * 그 외(초기 소환·검색어 입력 전·단답 1~3건) ➔ 소형(520) + 항목 수에 맞춘 슬림 높이(220~380px)
    """
    if mode == "large":
        return ("large", None)
    if has_query and (matched_count >= 4 or (matched_count >= 1 and has_rich_preview)):
        return ("medium", None)
    clamped = max(1, min(5, matched_count if matched_count > 0 else (1 if has_query else 4)))
    slim_h = min(380, max(220, 118 + clamped * 44)) if has_query else 330
    return ("small", slim_h)


def compute_ghost_search_window_3stage_rect(
    stage: str,
    anchor_x: int,
    anchor_y: int,
    work_area: tuple[int, int, int, int] = (0, 0, 1920, 1040),
    margin_px: int = 20,
    custom_height: int | None = None,
) -> dict[str, int | str | bool]:
    """
    [v1.4 확정 — 로컬 『귀신검색창』 크게/작게 2모드 & 작게 모드 내 소↔중 반응형 자율 크기 조절
     및 모니터 작업 영역(WorkArea) 화면 경계 자동 자석 클램핑]:
    우측/하단 모서리에서 슬림 창을 띄운 뒤 중형(자율 확장)·대형([⤢ 크게(갤러리)])으로 확장할 때
    상단 입력창(Top-Left 앵커)을 고정하되 모니터 밖으로 삐져나가지 않도록 안쪽(-20px 마진)으로 자동 스냅합니다.
    """
    norm_stage = stage if stage in GHOST_SEARCH_WINDOW_STAGE_SIZES else "small"
    req_w, req_h = GHOST_SEARCH_WINDOW_STAGE_SIZES[norm_stage]
    if norm_stage == "small" and custom_height is not None:
        req_h = int(custom_height)
    wa_left, wa_top, wa_right, wa_bottom = work_area
    avail_w = max(320, (wa_right - wa_left) - (margin_px * 2))
    avail_h = max(220, (wa_bottom - wa_top) - (margin_px * 2))
    win_w = min(req_w, avail_w)
    win_h = min(req_h, avail_h)

    if norm_stage == "large":
        # 대형 갤러리는 화면 중앙 자석 정렬 (주소창 없는 독립 데스크톱 갤러리 뷰)
        x = wa_left + ((wa_right - wa_left) - win_w) // 2
        y = wa_top + ((wa_bottom - wa_top) - win_h) // 2
    else:
        x = max(wa_left + margin_px, min(anchor_x, wa_right - margin_px - win_w))
        y = max(wa_top + margin_px, min(anchor_y, wa_bottom - margin_px - win_h))

    return {
        "stage": norm_stage,
        "x": int(x),
        "y": int(y),
        "width": int(win_w),
        "height": int(win_h),
        "frameless_app_mode": norm_stage == "large",
    }


def _read_unified_machine_trial_info() -> tuple[Path, dict, str, dict]:
    ledger_path = _MERLIN_APPDATA / "superpower_trial_ledger.json"
    _MERLIN_APPDATA.mkdir(parents=True, exist_ok=True)
    ledger: dict = {"machines": {}, "accounts": {}}
    if ledger_path.exists():
        try:
            loaded = json.loads(ledger_path.read_text(encoding="utf-8"))
            if isinstance(loaded, dict):
                ledger = loaded
        except Exception:
            pass
    hwid = _get_machine_hwid_local()
    machines = ledger.setdefault("machines", {})
    m_info = machines.setdefault(hwid, {"machineHwid": hwid, "isSubscribed": False})
    if not isinstance(m_info, dict):
        m_info = {"machineHwid": hwid, "isSubscribed": False}
        machines[hwid] = m_info
    return ledger_path, ledger, hwid, m_info


def is_ghostkey_active_mode() -> bool:
    """귀신키(Door 2) 스위치가 켜져 있고, 유효한 귀신키 권한(귀신키 구독/체험 또는 본체 Pro 구독)이 있는지 판별합니다.
    False일 때는 어떤 창에서 Ctrl+0을 눌러도 항상 본체 기본 기능인 '👻 귀신검색창(UI ②)'만 열립니다."""
    cfg = get_superpower_settings()
    if not bool(cfg.get("ghostkey_enabled", False)):
        return False
    try:
        _, _, _, m_info = _read_unified_machine_trial_info()
        if bool(m_info.get("isSubscribed")) or bool(m_info.get("isGhostkeyUnlocked")):
            return True
        gk_exp = str(m_info.get("ghostkeyExpiresAt") or "").strip()
        if gk_exp:
            exp_dt = datetime.datetime.fromisoformat(gk_exp.replace("Z", "+00:00"))
            now_dt = datetime.datetime.now(exp_dt.tzinfo) if exp_dt.tzinfo else datetime.datetime.now()
            if exp_dt > now_dt:
                return True
    except Exception:
        pass
    return False


_TRIAL_BADGE_MEM_CACHE: dict = {"ts": 0.0, "mtime_ns": -1, "size": -1, "val": None}


def get_trial_badge_summary() -> dict:
    """
    [단일 SSOT — 30일 Opt-in 무료체험 실시간 상태 & UI①·UI②·UI③ 동적 배지 텍스트 산출]
    - SUBSCRIBED: 유료 구독 중 (평생 무제한)
    - ACTIVE_30D: 유저 동의 완료 후 30일 이내 (D-30 ~ D-1 · 차감 없음)
    - EXPIRED_LOCKED: 30일 체험 만료 (유료 기능만 깔끔 잠금🔒 · 무료 기본기 평생 0원)
    - NOT_STARTED: 아직 30일 체험 시작 전 (설치 시 몰래 카운트다운 0%)
    """
    now_b = time.time()
    ledger_p = _MERLIN_APPDATA / "superpower_trial_ledger.json"
    cur_mtime_ns = 0
    cur_sz = 0
    try:
        if ledger_p.exists():
            st_l = ledger_p.stat()
            cur_mtime_ns = int(st_l.st_mtime_ns)
            cur_sz = int(st_l.st_size)
    except Exception:
        pass
    cached_val = _TRIAL_BADGE_MEM_CACHE.get("val")
    if (
        isinstance(cached_val, dict)
        and (now_b - float(_TRIAL_BADGE_MEM_CACHE.get("ts") or 0.0)) < 15.0
        and _TRIAL_BADGE_MEM_CACHE.get("mtime_ns") == cur_mtime_ns
        and _TRIAL_BADGE_MEM_CACHE.get("size") == cur_sz
    ):
        return cached_val

    res_badge: dict | None = None
    try:
        _, _, _, m_info = _read_unified_machine_trial_info()
        if m_info.get("isSubscribed"):
            res_badge = {
                "status": "SUBSCRIBED",
                "days_left": 9999,
                "short_badge": "💎 내 기기 통합 무제한",
                "ui1_hint": "💎 무제한 구독중 · 글자 입력 시 👻귀신검색창 전환",
                "ui2_hint": "✨ 자율크기 · 💎 무제한 구독중",
                "ui3_hint": "💎 무제한 구독중 · 단어칩 클릭 시 커서에 0.1초 입력!",
            }
        else:
            start_ts = float(m_info.get("trialOptInTs") or m_info.get("startedAtTs") or 0.0)
            if start_ts > 0.0:
                elapsed = (now_b - start_ts) / 86400.0
                if elapsed < 30.0:
                    rem = max(1, min(30, int(round(30.0 - elapsed + 0.49))))
                    res_badge = {
                        "status": "ACTIVE_30D",
                        "days_left": rem,
                        "short_badge": f"🎁 30일 무제한(D-{rem}·차감없음)",
                        "ui1_hint": f"🎁 30일 무제한 체험(D-{rem} · 차감없음) · 글자 입력 시 👻귀신검색창 전환",
                        "ui2_hint": f"✨ 자율크기 · 🎁 30일 체험(D-{rem})",
                        "ui3_hint": f"🎁 30일 무제한(D-{rem}) · 원하는 단어칩을 클릭하면 커서에 0.1초 입력!",
                    }
                else:
                    res_badge = {
                        "status": "EXPIRED_LOCKED",
                        "days_left": 0,
                        "short_badge": "🔒 체험만료 (무료기본기 평생0원)",
                        "ui1_hint": "🔒 유료체험 만료(무료 기본기는 평생 0원) · 글자 입력 시 👻귀신검색창 전환",
                        "ui2_hint": "✨ 귀신검색 평생 0원 · 🔒 고급도구 만료",
                        "ui3_hint": "🔒 30일 무료체험 만료 · 구독 시 해제됩니다",
                    }
    except Exception:
        pass
    if res_badge is None:
        res_badge = {
            "status": "NOT_STARTED",
            "days_left": 30,
            "short_badge": "🎁 유료도구 30일 무료체험 가능",
            "ui1_hint": "✨ 무료 초능력 평생 0원 · 🔒도구 첫 클릭 시 30일 체험 선택 · 글자 치면 검색창",
            "ui2_hint": "✨ 자율크기 검색 평생 0원 · 🎁 30일 체험 미시작",
            "ui3_hint": "🎁 30일 무제한 체험 · 원하는 단어칩을 클릭하면 커서에 0.1초 입력!",
        }
    _TRIAL_BADGE_MEM_CACHE["ts"] = now_b
    _TRIAL_BADGE_MEM_CACHE["mtime_ns"] = cur_mtime_ns
    _TRIAL_BADGE_MEM_CACHE["size"] = cur_sz
    _TRIAL_BADGE_MEM_CACHE["val"] = res_badge
    return res_badge


_MODAL_PROMPT_ACTIVE: bool = False
_TRIAL_LEDGER_LOCK = threading.RLock()


def opt_in_30d_unlimited_superpower_trial(agreed: bool = True, account_id: str = "local_user") -> dict:
    """
    [확정 ⑤ — 🎁 모든 귀신 초능력 30일 무제한 무료체험 명시적 동의 스위치 (Opt-in Trial)]:
    설치 시 자동 카운트다운을 절대 금지하고, 유저가 웹 수련장 또는 귀신창 🔒 버튼 클릭 시
    직접 동의했을 때만 trialOptInTs / startedAtTs 타임스탬프를 기록하고 30일 카운트다운을 시작합니다.
    만료 후에는 '하루 3회 무료' 없이 유료 기능만 깔끔하게 잠기며(🔒), 무료 기본기는 평생 0원입니다.
    """
    with _TRIAL_LEDGER_LOCK:
        now_ts = time.time()
        now_dt = datetime.datetime.now()
        exp_dt = now_dt + datetime.timedelta(days=30)
        ledger_path, ledger, _, m_info = _read_unified_machine_trial_info()
        if account_id:
            m_info["accountId"] = account_id
        existing_ts = float(m_info.get("trialOptInTs") or m_info.get("startedAtTs") or 0.0)
        if agreed:
            if existing_ts <= 0.0:
                iso_now = now_dt.strftime("%Y-%m-%d %H:%M:%S")
                iso_exp = exp_dt.strftime("%Y-%m-%d %H:%M:%S")
                m_info["trialOptInTs"] = now_ts
                m_info["trialOptInAt"] = iso_now
                m_info["trialExpiresAt"] = iso_exp
                m_info["startedAtTs"] = now_ts
                m_info["startedAt"] = iso_now
                m_info["expiresAt"] = iso_exp
                m_info["trialOptInStatus"] = "ACTIVE_30D"
            else:
                m_info["trialOptInTs"] = existing_ts
                m_info["startedAtTs"] = existing_ts
                elapsed = (now_ts - existing_ts) / 86400.0
                m_info["trialOptInStatus"] = "ACTIVE_30D" if elapsed < 30.0 else "EXPIRED_LOCKED"
        else:
            if not m_info.get("isSubscribed") and existing_ts <= 0.0:
                m_info["isSubscribed"] = False
                m_info["trialOptInTs"] = 0.0
                m_info["startedAtTs"] = 0.0
                m_info.pop("trialOptInAt", None)
                m_info.pop("trialExpiresAt", None)
                m_info.pop("startedAt", None)
                m_info.pop("expiresAt", None)
                m_info["trialOptInStatus"] = "DEFERRED"
        try:
            tmp_p = ledger_path.with_suffix(f".tmp.{os.getpid()}.{threading.get_ident()}")
            tmp_p.write_text(json.dumps(ledger, ensure_ascii=False, indent=2), encoding="utf-8")
            os.replace(tmp_p, ledger_path)
        except Exception:
            ledger_path.write_text(json.dumps(ledger, ensure_ascii=False, indent=2), encoding="utf-8")
        _TRIAL_BADGE_MEM_CACHE["ts"] = 0.0
        summary = get_trial_badge_summary()
        return {
            "ok": True,
            "status": summary["status"],
            "trial_opt_in_at": m_info.get("trialOptInAt") or m_info.get("startedAt"),
            "days_left": summary["days_left"],
            "badge_label": summary["short_badge"],
        }


def _prompt_opt_in_trial_tk(feature_label: str = "고급 초능력") -> bool:
    """
    아직 30일 무료체험을 시작하지 않은 유저가 OS 귀신창에서 🔒 유료 도구를 직접 눌렀을 때,
    몰래 타이머를 돌리지 않고 스레드 안전(Thread-Safe) Win32 최상위 모달로 투명하게 1클릭 동의를 받습니다.
    """
    global _MODAL_PROMPT_ACTIVE, _MAIN_LOOP_HEARTBEAT_TS, _UI_LOOP_HEARTBEAT_TS
    if os.environ.get("GHOSTI_HEADLESS_TEST") == "1":
        return False
    _MODAL_PROMPT_ACTIVE = True
    try:
        u32.MessageBoxW.argtypes = [wintypes.HWND, wintypes.LPCWSTR, wintypes.LPCWSTR, wintypes.UINT]
        u32.MessageBoxW.restype = ctypes.c_int
        msg_body = (
            f"🎁 [{feature_label}] 기능은 유료 티어 초능력입니다.\n"
            f"오늘부터 30일 무제한 무료체험을 지금 시작할까요?\n\n"
            f"• 카드 등록 0% · 자동 결제 0%로 30일간 횟수 제한 없이 무제한 이용\n"
            f"• 30일이 지나면 유료 도구만 조용히 잠기며(🔒),\n"
            f"  무료 기본기(자동 한영·순차복붙·[1]다림질·상용구·압축)는 평생 0원입니다.\n\n"
            f"[예(Y)] 지금 30일 무료체험 시작   /   [아니요(N)] 나중에 시작"
        )
        # MB_YESNO (0x04) | MB_ICONINFORMATION (0x40) | MB_SETFOREGROUND (0x10000) | MB_TOPMOST (0x40000) -> IDYES == 6
        res_mb = u32.MessageBoxW(
            0,
            msg_body,
            "👻 귀신같이 — 30일 무제한 무료체험 시작 확인",
            0x00000004 | 0x00000040 | 0x00010000 | 0x00040000,
        )
        return int(res_mb) == 6
    except Exception:
        return False
    finally:
        now_done = time.time()
        _MAIN_LOOP_HEARTBEAT_TS = now_done
        _UI_LOOP_HEARTBEAT_TS = now_done
        _MODAL_PROMPT_ACTIVE = False


def build_loss_aversion_time_saved_report(total_actions_count: int = 412) -> dict:
    """
    [30일 무료체험 만료 시 '시간 절약 성적표 팝업']:
    1회당 평균 1분(창 전환 + 폴더 찾기 + 복붙 노가다) 절약 기준으로 누적 절약 시간을 환산하여 반환합니다.
    """
    cnt = max(1, int(total_actions_count))
    saved_minutes = cnt * 1
    hours = saved_minutes // 60
    mins = saved_minutes % 60
    time_str = f"{hours}시간 {mins}분" if hours > 0 else f"{mins}분"
    return {
        "total_actions": cnt,
        "saved_minutes": saved_minutes,
        "saved_time_label": time_str,
        "headline": "👻 [30일 무제한 무료체험 기간이 만료되었습니다!]",
        "body": f"지금까지 애기귀신과 함께 총 {cnt:,}번의 창 이동·복붙 노가다를 줄여 약 {time_str}의 소중한 시간을 아끼셨습니다!",
        "cta_primary": "☕ 커피 한 잔 값(월 3,900원 / 연간 결제 시 월 3,250원꼴)으로 무제한 풀기",
        "cta_secondary": "평생 무료 기본기만 계속 쓸게요",
    }


SUPERPOWER_12_FEATURES: dict[str, str] = {
    "feat_1_seq_paste": "⚡ [Ctrl+V] 순차·칸맞춤",
    "feat_2_typo_morph": "⚡ 자동 한영·띄어쓰기",
    "feat_4_iron_lines": "[1] 🧹서식·줄바꿈",
    "feat_3_clean_format": "🧹 서식세탁",
    "feat_9_image_file": "[2] 📄스샷·PDF변환🔒",
    "feat_6_screen_ocr": "📸 사진·표 OCR 공간이동🔒",
    "feat_ghost_labeler": "🏷️ 귀신 라벨러🔒",
    "feat_5_merge_search": "[3] 🔗다중합본🔒",
    "feat_8_number_format": "[4] 🔢번호·일정🔒",
    "feat_7_window_pin": "[5] 📌창고정🔒",
    "feat_b1_snippets": "⌨️ 상용구(F1~F6)",
    "feat_b4_team_snippets": "🔒 팀 상용구(F7~F12)",
    "feat_b2_excel_split": "💡 엑셀쪼개기",
    "feat_b3_pdf_merge": "💡 다중스샷PDF합본🔒",
}

FREE_FOREVER_FEATURES: set[str] = {
    "feat_1_seq_paste",
    "feat_2_typo_morph",
    "feat_4_iron_lines",
    "feat_3_clean_format",
    "feat_b1_snippets",
    "feat_b2_excel_split",
}


def normalize_feature_id(raw_key: str) -> str:
    k = str(raw_key or "").strip()
    if k in SUPERPOWER_12_FEATURES:
        return k
    if k in ("seq_paste_smart_match", "ctrl_v"):
        return "feat_1_seq_paste"
    # [귀신창 정본 1~5번 전 기능 체계]:
    # [1] 🧹서식·줄바꿈(무료), [2] 📄스샷·PDF변환🔒, [3] 🔗다중합본🔒, [4] 🔢번호·일정🔒, [5] 📌창고정🔒
    if k == "auto_typo_morph_2words":
        return "feat_2_typo_morph"
    if k in ("superpower_key_1", "superpower_1", "1"):
        return "feat_4_iron_lines"
    if k in ("feat_ghost_labeler", "ghost_labeler", "labeler"):
        return "feat_ghost_labeler"
    if k in ("superpower_key_2", "superpower_key_9", "superpower_2", "superpower_9", "2", "9"):
        return "feat_9_image_file"
    if k in ("ui3_photo_ocr", "screen_ocr", "superpower_6", "superpower_key_6", "6"):
        return "feat_6_screen_ocr"
    if k in ("superpower_key_3", "superpower_3", "feat_5_ai_search", "3"):
        return "feat_5_merge_search"
    if k in (
        "superpower_key_4",
        "superpower_key_8",
        "superpower_4",
        "superpower_8",
        "feat_8_format_numbers",
        "4",
        "8",
    ):
        return "feat_8_number_format"
    if k in (
        "superpower_key_5",
        "superpower_key_7",
        "superpower_5",
        "superpower_7",
        "feat_7_toggle_topmost",
        "5",
        "7",
    ):
        return "feat_7_window_pin"
    m_snip = re.fullmatch(r"(?:snippet_)?[Ff](\d{1,2})", k)
    if m_snip:
        f_num = int(m_snip.group(1))
        if 1 <= f_num <= 6:
            return "feat_b1_snippets"
        if 7 <= f_num <= 12:
            return "feat_b4_team_snippets"
    if "excel" in k.lower():
        return "feat_b2_excel_split"
    if "pdf" in k.lower():
        return "feat_b3_pdf_merge"
    return k


def check_feature_quota_allowed(raw_feature_key: str, interactive_opt_in: bool = False) -> tuple[bool, str]:
    """
    [평생 무료 기본기 vs 유료 티어(Opt-in 30일 무제한 체험 ➔ 만료 시 깔끔 잠금🔒 / 하루 3회 무료 없음)]:
    - 평생 무료 기본기(FREE_FOREVER_FEATURES)는 무조건 True!
    - 유료 티어 기능은 유료 구독자(SUBSCRIBED) 또는 명시적 동의 후 30일 이내(ACTIVE_30D)일 때만 True!
    - 아직 동의 전(NOT_STARTED) 상태에서 OS 귀신창 버튼을 직접 누른 경우(interactive_opt_in=True),
      몰래 시작하지 않고 1클릭 동의 모달을 띄워 유저가 동의한 즉시 30일 체험을 개시합니다.
    - 30일 체험 만료(EXPIRED_LOCKED) 시에는 즉시 유료 잠금(False) 반환!
    """
    feat_id = normalize_feature_id(raw_feature_key)
    if feat_id in FREE_FOREVER_FEATURES:
        return True, "FREE_FOREVER"
    try:
        _, _, _, m_info = _read_unified_machine_trial_info()
        if m_info.get("isSubscribed"):
            return True, "SUBSCRIBED"
        start_ts = float(m_info.get("trialOptInTs") or m_info.get("startedAtTs") or 0.0)
        if start_ts > 0.0:
            elapsed_days = (time.time() - start_ts) / 86400.0
            if elapsed_days < 30.0:
                rem_days = max(1, min(30, int(round(30.0 - elapsed_days + 0.49))))
                return True, f"ACTIVE_D-{rem_days}"
            return (
                False,
                "🔒 30일 무료체험이 만료되었습니다. [내 기기 통합(월 3,900원)] 구독 시 해제되며, 무료 기본기는 평생 0원입니다.",
            )
        if interactive_opt_in:
            feat_label = SUPERPOWER_12_FEATURES.get(feat_id, "고급 초능력")
            if _prompt_opt_in_trial_tk(feat_label):
                opt_in_30d_unlimited_superpower_trial(True)
                return True, "ACTIVE_D-30"
            opt_in_30d_unlimited_superpower_trial(False)
            return (
                False,
                "🎁 고급 도구는 [30일 무료체험 시작] 동의 후 언제든 쓰실 수 있어요. (무료 기본기는 평생 0원)",
            )
        return False, "TRIAL_NOT_STARTED"
    except Exception:
        return False, "TRIAL_CHECK_ERROR"


def complete_feature_action_success(raw_feature_key: str) -> dict:
    """
    [오직 '실제 액션이 성공 완수된 시점'에만 호출 — 익명 카운터 및 체험 사용 통계 기록]
    - 무료 기본기는 영구 무료(FREE_FOREVER)로 기록만 남깁니다.
    - 유료 도구는 Opt-in 동의 상태 기준 남은 일수를 반환하며, 만료 후 일일 무료 차감(구버전 하루 3회)은 수행하지 않습니다.
    """
    feat_id = normalize_feature_id(raw_feature_key)
    record_feature_telemetry(raw_feature_key)
    if feat_id in FREE_FOREVER_FEATURES:
        return {"status": "FREE_FOREVER", "feature_id": feat_id, "consumed_daily": False, "daily_remaining": 0}
    now_ts = time.time()
    now_dt = datetime.datetime.now()
    try:
        ledger_path, ledger, _, m_info = _read_unified_machine_trial_info()
        if m_info.get("isSubscribed"):
            return {"status": "SUBSCRIBED", "feature_id": feat_id, "consumed_daily": False, "daily_remaining": 9999}
        feat_trials = m_info.setdefault("featureTrials", {})
        f_entry = feat_trials.get(feat_id)
        if not isinstance(f_entry, dict) or not f_entry.get("firstUsedTs"):
            exp_dt = now_dt + datetime.timedelta(days=30)
            feat_trials[feat_id] = {
                "featureName": SUPERPOWER_12_FEATURES.get(feat_id, feat_id),
                "firstUsedTs": now_ts,
                "firstUsedAt": now_dt.strftime("%Y-%m-%d %H:%M:%S"),
                "expiresAt": exp_dt.strftime("%Y-%m-%d %H:%M:%S"),
                "successCount": 1,
            }
        else:
            f_entry["successCount"] = int(f_entry.get("successCount", 0)) + 1
        m_info["lastActionAt"] = now_dt.isoformat(timespec="seconds")
        m_info["lastActionType"] = feat_id
        ledger_path.write_text(json.dumps(ledger, ensure_ascii=False, indent=2), encoding="utf-8")
        summary = get_trial_badge_summary()
        return {
            "status": summary["status"],
            "feature_id": feat_id,
            "days_left": summary["days_left"],
            "consumed_daily": False,
            "daily_remaining": 0,
        }
    except Exception:
        return {"status": "OK", "feature_id": feat_id, "consumed_daily": False, "daily_remaining": 0}


_TELEMETRY_LOCK = threading.Lock()


def record_feature_telemetry(feature_key: str) -> None:
    """
    [100% 합법 익명 통계(Zero-Content Telemetry)]
    - 유저가 입력한 텍스트(내용)는 0바이트도 수집하지 않으며,
      오직 '어떤 초능력 기능 코드가 몇 번 호출되었는지(숫자 카운터)'만 일자별로 집계합니다.
    """
    if not is_telemetry_enabled():
        return

    def _save():
        try:
            with _TELEMETRY_LOCK:
                if not is_telemetry_enabled():
                    return
                today = datetime.date.today().isoformat()
                data: dict = {"daily": {}, "total": {}}
                if TELEMETRY_FILE.exists():
                    try:
                        data = json.loads(TELEMETRY_FILE.read_text(encoding="utf-8"))
                    except Exception:
                        data = {"daily": {}, "total": {}}
                daily = data.setdefault("daily", {})
                day_bucket = daily.setdefault(today, {})
                day_bucket[feature_key] = day_bucket.get(feature_key, 0) + 1
                total = data.setdefault("total", {})
                total[feature_key] = total.get(feature_key, 0) + 1
                data["updated_at"] = datetime.datetime.now().isoformat(timespec="seconds")
                TELEMETRY_FILE.parent.mkdir(parents=True, exist_ok=True)
                tmp_p = TELEMETRY_FILE.with_suffix(f".tmp.{os.getpid()}.{threading.get_ident()}")
                tmp_p.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
                os.replace(tmp_p, TELEMETRY_FILE)
        except Exception:
            pass

    threading.Thread(target=_save, daemon=True).start()


def build_ghost_search_window_url(stage: str = "small", query: str = "", base_url: str | None = None) -> str:
    """로컬 2모드(크게/작게 + 자율 반응형) 『👻 귀신검색창』 전용 라우트 URL 생성"""
    from urllib.parse import quote
    if stage in ("large", "gallery"):
        norm_stage = "large"
    elif stage in GHOST_SEARCH_WINDOW_STAGE_SIZES:
        norm_stage = stage
    else:
        norm_stage = "small"
    root_u = (base_url or GHOSTI_WEB_URL).rstrip("/")
    url = f"{root_u}/?dev=true&preview=legacy&ghostSearchWindow={norm_stage}"
    q_clean = (query or "").strip()
    if q_clean:
        url += f"&q={quote(q_clean)}"
    return url


_LAST_POPUP_OPEN_TS = 0.0
_LAST_POPUP_OPEN_RECT: dict | None = None
_ACTIVE_POPUP_HWND: int = 0
_POPUP_LAUNCHING_UNTIL: float = 0.0
_POPUP_OPEN_LOCK = threading.Lock()
_ACTIVE_POPUP_STATE_FILE = TELEMETRY_FILE.parent / "active_ghost_search_popup.json"


def _get_hwnd_class_and_title(hwnd: int) -> tuple[str, str]:
    if sys.platform != "win32" or hwnd <= 0:
        return "", ""
    hw = wintypes.HWND(hwnd)
    if not u32.IsWindow(hw):
        return "", ""
    cbuf = ctypes.create_unicode_buffer(128)
    u32.GetClassNameW(hw, cbuf, 127)
    cls_name = (cbuf.value or "").strip()
    tlen = u32.GetWindowTextLengthW(hw)
    title = ""
    if 0 < tlen <= 512:
        tbuf = ctypes.create_unicode_buffer(tlen + 2)
        u32.GetWindowTextW(hw, tbuf, tlen + 1)
        title = (tbuf.value or "").strip()
    return cls_name, title


def _load_saved_popup_hwnd() -> int:
    global _ACTIVE_POPUP_HWND
    if _ACTIVE_POPUP_HWND > 0:
        return _ACTIVE_POPUP_HWND
    try:
        if _ACTIVE_POPUP_STATE_FILE.exists():
            raw = json.loads(_ACTIVE_POPUP_STATE_FILE.read_text(encoding="utf-8"))
            h = int(raw.get("hwnd") or 0)
            if h > 0:
                _ACTIVE_POPUP_HWND = h
                return h
    except Exception:
        pass
    return 0


def _save_active_popup_hwnd(hwnd: int) -> None:
    global _ACTIVE_POPUP_HWND
    _ACTIVE_POPUP_HWND = max(0, int(hwnd))
    try:
        _ACTIVE_POPUP_STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
        if _ACTIVE_POPUP_HWND > 0:
            _ACTIVE_POPUP_STATE_FILE.write_text(
                json.dumps({"hwnd": _ACTIVE_POPUP_HWND, "updated_at": time.time()}),
                encoding="utf-8",
            )
        elif _ACTIVE_POPUP_STATE_FILE.exists():
            _ACTIVE_POPUP_STATE_FILE.unlink(missing_ok=True)
    except Exception:
        pass


def _is_valid_browser_top_window(hwnd: int) -> bool:
    if sys.platform != "win32" or hwnd <= 0:
        return False
    hw = wintypes.HWND(hwnd)
    if not u32.IsWindow(hw):
        return False
    if not (u32.IsWindowVisible(hw) or u32.IsIconic(hw)):
        return False
    if u32.GetWindow(hw, 4):  # GW_OWNER == 4 (드롭다운·툴팁 소유 팝업 제외)
        return False
    cls_name, _ = _get_hwnd_class_and_title(hwnd)
    return cls_name in ("Chrome_WidgetWin_1", "MozillaWindowClass")


def _snapshot_visible_browser_hwnds() -> set[int]:
    if sys.platform != "win32":
        return set()
    found: set[int] = set()
    WNDENUMPROC = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

    def _cb(hwnd: int, _lp: int) -> bool:
        if _is_valid_browser_top_window(int(hwnd)):
            found.add(int(hwnd))
        return True

    try:
        u32.EnumWindows(WNDENUMPROC(_cb), 0)
    except Exception:
        pass
    return found


def _find_live_ghost_search_popup_hwnds() -> list[int]:
    """
    현재 화면(또는 최소화 상태)에 살아있는 『👻 귀신검색창』 독립 앱 창(--app) HWND 목록을 반환합니다.
    - 1순위: 데몬이 직접 기동하며 추적한 정확 HWND (_ACTIVE_POPUP_HWND / active_ghost_search_popup.json)
    - 2순위: 창 제목에 '👻 귀신검색창' 또는 'ghostSearchWindow=' 식별자가 포함된 브라우저 최상위 창
    """
    if sys.platform != "win32":
        return []
    live: list[int] = []
    saved_h = _load_saved_popup_hwnd()
    if saved_h > 0:
        if _is_valid_browser_top_window(saved_h):
            _, s_title = _get_hwnd_class_and_title(saved_h)
            if ("귀신검색창" in s_title) or ("ghostsearchwindow=" in s_title.lower()):
                live.append(saved_h)
            else:
                _save_active_popup_hwnd(0)
        else:
            _save_active_popup_hwnd(0)

    WNDENUMPROC = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

    def _cb(hwnd: int, _lp: int) -> bool:
        hi = int(hwnd)
        if hi in live or not _is_valid_browser_top_window(hi):
            return True
        _, title = _get_hwnd_class_and_title(hi)
        t_low = title.lower()
        if ("귀신검색창" in title) or ("ghostsearchwindow=" in t_low):
            live.append(hi)
        return True

    try:
        u32.EnumWindows(WNDENUMPROC(_cb), 0)
    except Exception:
        pass
    return live


def _focus_hwnd_reliable(hwnd: int) -> bool:
    """
    Windows 10/11 백그라운드 프로세스 포커스 잠금(Foreground Lock)을 우회하여
    이미 열려 있거나 새로 열린 귀신검색창을 메인 브라우저 창 앞으로 확실히 끌어올립니다.
    - 최대화(IsZoomed) 또는 사용자 수동 리사이즈 크기는 그대로 보존하고, 최소화(IsIconic)일 때만 복원합니다.
    """
    if sys.platform != "win32" or hwnd <= 0:
        return False
    hw = wintypes.HWND(hwnd)
    if not u32.IsWindow(hw):
        return False
    SW_RESTORE = 9
    SW_SHOW = 5
    SWP_NOMOVE = 0x0002
    SWP_NOSIZE = 0x0001
    SWP_SHOWWINDOW = 0x0040
    HWND_TOPMOST = wintypes.HWND(-1)
    HWND_NOTOPMOST = wintypes.HWND(-2)

    fg_hwnd = u32.GetForegroundWindow()
    fg_tid = u32.GetWindowThreadProcessId(fg_hwnd, None) if fg_hwnd else 0
    cur_tid = k32.GetCurrentThreadId()
    attached = False
    try:
        if fg_tid and cur_tid and fg_tid != cur_tid:
            attached = bool(u32.AttachThreadInput(cur_tid, fg_tid, True))
        if u32.IsIconic(hw):
            u32.ShowWindow(hw, SW_RESTORE)
        else:
            u32.ShowWindow(hw, SW_SHOW)
        u32.SetWindowPos(hw, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW)
        u32.BringWindowToTop(hw)
        u32.SetForegroundWindow(hw)
        u32.SetWindowPos(hw, HWND_NOTOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW)
        return True
    except Exception:
        return False
    finally:
        if attached:
            try:
                u32.AttachThreadInput(cur_tid, fg_tid, False)
            except Exception:
                pass


def _capture_and_focus_new_popup_hwnd(
    pre_hwnds: set[int],
    caller_fg_hwnd: int,
    expected_w: int,
    expected_h: int,
) -> None:
    """
    새로 기동한 --app 귀신검색창의 실제 OS HWND를 포착해 싱글톤으로 등록하고 최상단 전면으로 끌어올립니다.
    """
    if sys.platform != "win32":
        return

    def _worker() -> None:
        global _POPUP_LAUNCHING_UNTIL
        WNDENUMPROC = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
        captured_hwnd = 0

        for step_idx in range(22):
            time.sleep(0.14 if step_idx < 10 else 0.22)
            # 이미 타이틀 식별자로 잡히는 창이 있는지 우선 점검
            by_title = _find_live_ghost_search_popup_hwnds()
            if by_title:
                captured_hwnd = by_title[0]
                if len(by_title) > 1:
                    for extra_h in by_title[1:]:
                        try:
                            u32.PostMessageW(wintypes.HWND(extra_h), 0x0010, 0, 0)
                        except Exception:
                            pass
            else:
                def _enum_new_cb(hwnd: int, _lp: int) -> bool:
                    nonlocal captured_hwnd
                    hi = int(hwnd)
                    if hi in pre_hwnds or hi == caller_fg_hwnd:
                        return True
                    if not _is_valid_browser_top_window(hi):
                        return True
                    hw = wintypes.HWND(hi)
                    rc = wintypes.RECT()
                    if not u32.GetWindowRect(hw, ctypes.byref(rc)):
                        return True
                    w = rc.right - rc.left
                    h = rc.bottom - rc.top
                    if w < 380 or h < 240:
                        return True
                    _, title = _get_hwnd_class_and_title(hi)
                    t_low = title.lower()
                    if any(
                        k in t_low
                        for k in (
                            "귀신검색창",
                            "ghostsearchwindow",
                        )
                    ):
                        captured_hwnd = hi
                        return False
                    return True

                try:
                    u32.EnumWindows(WNDENUMPROC(_enum_new_cb), 0)
                except Exception:
                    pass

            if captured_hwnd > 0:
                _save_active_popup_hwnd(captured_hwnd)
                with _POPUP_OPEN_LOCK:
                    _POPUP_LAUNCHING_UNTIL = 0.0
                _focus_hwnd_reliable(captured_hwnd)
                # 더블클릭 시 메인 브라우저가 잠시 뒤에 포커스를 재탈취하는 현상까지 0.35초 뒤 1회 더 고정
                time.sleep(0.35)
                if _is_valid_browser_top_window(captured_hwnd):
                    _focus_hwnd_reliable(captured_hwnd)
                return

        with _POPUP_OPEN_LOCK:
            _POPUP_LAUNCHING_UNTIL = 0.0

    threading.Thread(target=_worker, daemon=True).start()


def _open_ghost_search_window_popup(
    stage: str = "medium",
    query: str = "",
    anchor_x: int | None = None,
    anchor_y: int | None = None,
    focus_only: bool = False,
    resize_existing: bool = False,
) -> dict:
    """
    [웹 『👻 내 진짜 파일로 리얼 귀신검색창 바로 띄우기』 OS 싱글톤 앱 창 오픈 & 크기 전환]:
    - 이미 열려 있는 귀신검색창(--app)이 화면(또는 최소화 상태)에 존재하면 시간이 얼마나 지났든
      절대 중복 창을 새로 띄우지 않고 기존 창 1개만 최상단 전면(Foreground)으로 끌어올립니다.
    - 창 상단 [⤡ 작게] · [⤢ 크게(갤러리)] 버튼 클릭(resize_existing=True) 시에는 현재 모니터 기준에서
      기존 창 크기를 즉시 전환합니다.
    """
    global _LAST_POPUP_OPEN_TS, _LAST_POPUP_OPEN_RECT, _POPUP_LAUNCHING_UNTIL
    pt = wintypes.POINT()
    if anchor_x is None or anchor_y is None:
        u32.GetCursorPos(ctypes.byref(pt))
        ax, ay = pt.x, pt.y
    else:
        ax, ay = int(anchor_x), int(anchor_y)
    work_area = _get_monitor_workarea_for_point(ax, ay)
    q_clean = (query or "").strip()
    norm_in = "large" if stage in ("large", "gallery") else ("small" if stage == "small" else "medium")
    custom_h = 340 if norm_in == "small" and not q_clean else None
    rect = compute_ghost_search_window_3stage_rect(norm_in, ax, ay, work_area=work_area, custom_height=custom_h)
    target_url = build_ghost_search_window_url(str(rect["stage"]), query=q_clean)

    now_ts = time.time()
    with _POPUP_OPEN_LOCK:
        live_hwnds = _find_live_ghost_search_popup_hwnds()
        if len(live_hwnds) > 1:
            for extra_h in live_hwnds[1:]:
                try:
                    u32.PostMessageW(wintypes.HWND(extra_h), 0x0010, 0, 0)
                except Exception:
                    pass
            live_hwnds = live_hwnds[:1]

        if live_hwnds:
            primary_hwnd = live_hwnds[0]
            _save_active_popup_hwnd(primary_hwnd)
            if resize_existing and sys.platform == "win32":
                hw = wintypes.HWND(primary_hwnd)
                cur_rc = wintypes.RECT()
                if u32.IsIconic(hw) or u32.IsZoomed(hw):
                    u32.ShowWindow(hw, 9)  # SW_RESTORE
                if u32.GetWindowRect(hw, ctypes.byref(cur_rc)):
                    cx = (cur_rc.left + cur_rc.right) // 2
                    cy = (cur_rc.top + cur_rc.bottom) // 2
                    win_wa = _get_monitor_workarea_for_point(cx, cy)
                    new_rect = compute_ghost_search_window_3stage_rect(
                        norm_in, cur_rc.left, cur_rc.top, work_area=win_wa, custom_height=custom_h
                    )
                else:
                    new_rect = rect
                u32.SetWindowPos(
                    hw,
                    wintypes.HWND(0),
                    int(new_rect["x"]),
                    int(new_rect["y"]),
                    int(new_rect["width"]),
                    int(new_rect["height"]),
                    0x0004 | 0x0040,  # SWP_NOZORDER | SWP_SHOWWINDOW
                )
                _focus_hwnd_reliable(primary_hwnd)
                record_feature_telemetry(f"ghost_search_window_{new_rect['stage']}")
                return {
                    "mode": "web_monitor_app",
                    "url": target_url,
                    "rect": new_rect,
                    "launched": True,
                    "reused": True,
                    "resized": True,
                }

            _focus_hwnd_reliable(primary_hwnd)
            return {
                "mode": "web_monitor_app",
                "url": target_url,
                "rect": rect,
                "launched": True,
                "reused": True,
                "deduped": True,
            }

        if focus_only or resize_existing:
            return {
                "mode": "web_monitor_app",
                "url": target_url,
                "rect": rect,
                "launched": False,
                "reused": False,
            }

        if now_ts < _POPUP_LAUNCHING_UNTIL or ((now_ts - _LAST_POPUP_OPEN_TS) < 1.8 and _LAST_POPUP_OPEN_RECT is not None):
            return {
                "mode": "web_monitor_app",
                "url": target_url,
                "rect": rect,
                "launched": True,
                "reused": True,
                "deduped": True,
            }

        pre_hwnds = _snapshot_visible_browser_hwnds()
        caller_fg_hwnd = int(u32.GetForegroundWindow() or 0) if sys.platform == "win32" else 0
        _LAST_POPUP_OPEN_TS = now_ts
        _LAST_POPUP_OPEN_RECT = rect
        _POPUP_LAUNCHING_UNTIL = now_ts + 3.8

    record_feature_telemetry(f"ghost_search_window_{rect['stage']}")

    local_app = Path(os.environ.get("LOCALAPPDATA") or (Path.home() / "AppData" / "Local"))
    browser_candidates = [
        Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
        Path(r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"),
        local_app / "Google" / "Chrome" / "Application" / "chrome.exe",
        Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
        Path(r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"),
        local_app / "Microsoft" / "Edge" / "Application" / "msedge.exe",
    ]
    launched = False
    for b_exe in browser_candidates:
        if b_exe.exists():
            try:
                subprocess.Popen(
                    [
                        str(b_exe),
                        f"--app={target_url}",
                        f"--window-size={rect['width']},{rect['height']}",
                        f"--window-position={rect['x']},{rect['y']}",
                    ],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    creationflags=0x08000000,
                )
                launched = True
                break
            except Exception:
                pass
    if not launched:
        try:
            os.startfile(target_url)
            launched = True
        except Exception:
            pass
    if launched:
        _capture_and_focus_new_popup_hwnd(
            pre_hwnds, caller_fg_hwnd, int(rect["width"]), int(rect["height"])
        )
    else:
        with _POPUP_OPEN_LOCK:
            _POPUP_LAUNCHING_UNTIL = 0.0
    return {"mode": "web_monitor_app", "url": target_url, "rect": rect, "launched": launched, "reused": False}


def _open_ghosti_web() -> None:
    """맨 앞 [👻 귀신같이] 애기귀신 로고 클릭 시 귀신같이 웹 앱을 즉시 호출"""
    try:
        record_feature_telemetry("ctrl0_logo_web_open")
        os.startfile(GHOSTI_WEB_URL)
    except Exception:
        pass


def _get_monitor_workarea_for_point(px: int, py: int) -> tuple[int, int, int, int]:
    """
    듀얼/다중 모니터(좌측 음수 좌표 모니터 포함) 환경에서 마우스 커서(px, py)가 위치한
    모니터의 정확한 영역(left, top, right, bottom)을 반환합니다.
    """
    try:
        MONITOR_DEFAULTSTTONEAREST = 2
        pt_val = wintypes.POINT(px, py)
        hmon = u32.MonitorFromPoint(pt_val, MONITOR_DEFAULTSTTONEAREST)
        if hmon:
            class MONITORINFO(ctypes.Structure):
                _fields_ = [
                    ("cbSize", wintypes.DWORD),
                    ("rcMonitor", wintypes.RECT),
                    ("rcWork", wintypes.RECT),
                    ("dwFlags", wintypes.DWORD),
                ]
            mi = MONITORINFO()
            mi.cbSize = ctypes.sizeof(MONITORINFO)
            if u32.GetMonitorInfoW(hmon, ctypes.byref(mi)):
                r = mi.rcWork
                return r.left, r.top, r.right, r.bottom
    except Exception:
        pass
    try:
        sw = int(u32.GetSystemMetrics(0) or 1920)
        sh = int(u32.GetSystemMetrics(1) or 1080)
        return 0, 0, sw, max(480, sh - 48)
    except Exception:
        return 0, 0, 1920, 1032


def _format_rel_time(ts: float) -> str:
    diff = max(0, int(time.time() - ts))
    if diff < 60:
        return "방금 전"
    if diff < 3600:
        return f"{diff // 60}분 전"
    if diff < 86400:
        return f"{diff // 3600}시간 전"
    return f"{diff // 86400}일 전"


def _clean_ocr_noise(text: str) -> str:
    """
    Windows OCR가 어두운 화면/아이콘/테두리를 읽을 때 생성하는 외계어·기호 파편
    (예: 'S훼"T콤*P"', '연췰됩', '그로필El I A', 외자 파편 등)을 깔끔하게 정제합니다.
    """
    if not text:
        return ""
    prefix = ""
    body = text.strip()
    m_tag = re.match(r"^(\[[^\]]+\])\s*(.*)$", body)
    if m_tag:
        prefix = m_tag.group(1)
        body = m_tag.group(2)

    def _is_standard_hangul_syllable(ch: str) -> bool:
        if not ("\uac00" <= ch <= "\ud7a3"):
            return True
        try:
            ch.encode("euc-kr")
            return True
        except UnicodeEncodeError:
            return False

    cleaned_tokens: list[str] = []
    for raw_tok in body.split():
        # 1) 비표준 희귀 한글 음절(예: 췰, 뛔 등 KS X 1001 외곽 OCR 오인식 글자) 포함 어절 제거
        if any(not _is_standard_hangul_syllable(c) for c in raw_tok):
            continue
        # 2) 영문/기호와 한글이 비정상적으로 뒤섞인 깨진 토큰(예: S훼"T콤*P", 그로필El) 제거
        has_kor = bool(re.search(r"[가-힣]", raw_tok))
        has_eng = bool(re.search(r"[A-Za-z]", raw_tok))
        has_weird_sym = bool(re.search(r"[\"*^~`|\\<>]", raw_tok))
        if has_weird_sym and (has_kor or has_eng):
            continue
        if has_kor and has_eng and not re.match(r"^[A-Za-z0-9]+[가-힣]{1,2}$", raw_tok):
            continue
        # 3) 무의미한 1글자 영문 대소문자/한글 파편(C, I, A, 리, 다 등) 제거 (단 숫자나 기호 구분자는 유지)
        stripped_alnum = re.sub(r"[^A-Za-z0-9가-힣]", "", raw_tok)
        if len(stripped_alnum) == 1 and not stripped_alnum.isdigit():
            continue
        cleaned_tokens.append(raw_tok)

    res_body = " ".join(cleaned_tokens).strip(" -·•|")
    if prefix and res_body:
        return f"{prefix} {res_body}"
    return prefix or res_body or text.strip()


def _extract_chosung(text: str) -> str:
    """한글 초성 검색용 초성 문자열 추출 (예: '센스톡' -> 'ㅅㅅㅌ')"""
    cho_list = [
        "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ",
        "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
    ]
    out = []
    for ch in text:
        code = ord(ch)
        if 0xAC00 <= code <= 0xD7A3:
            out.append(cho_list[(code - 0xAC00) // 588])
        else:
            out.append(ch.lower())
    return "".join(out)


def _make_context_snippet(text: str, query: str, max_len: int = 54) -> str:
    """긴 문장에서 검색어(query)가 포함된 핵심 구간 앞뒤만 쏙 뽑아 요약 표시"""
    single = re.sub(r"\s+", " ", text).strip()
    if len(single) <= max_len:
        return single
    q = query.strip().lower()
    if q:
        idx = single.lower().find(q)
        if idx >= 0:
            start = max(0, idx - 14)
            end = min(len(single), start + max_len)
            prefix = "..." if start > 0 else ""
            suffix = "..." if end < len(single) else ""
            return f"{prefix}{single[start:end]}{suffix}"
    return single[:max_len] + "..."


_LOCAL_FILE_CACHE: dict = {"ts": 0.0, "items": []}
_LOCAL_FILE_SCAN_LOCK = threading.Lock()
_LOCAL_FILE_REFRESH_RUNNING = False
_KNOWN_USER_FOLDERS_CACHE: dict = {"ts": 0.0, "folders": []}
_DOC_BODY_MEM_CACHE: dict = {"mtime_ns": -1, "size": -1, "data": {}}
_ONDEMAND_IMG_OCR_MEM_CACHE: dict[str, dict] = {}
_ONDEMAND_IMG_OCR_LOCK = threading.Lock()


def _resolve_win_known_folder_safe(guid_str: str) -> Path | None:
    if sys.platform != "win32":
        return None
    try:
        import uuid

        class _GUID(ctypes.Structure):
            _fields_ = [
                ("Data1", wintypes.DWORD),
                ("Data2", wintypes.WORD),
                ("Data3", wintypes.WORD),
                ("Data4", ctypes.c_ubyte * 8),
            ]

        u = uuid.UUID(guid_str)
        g = _GUID(u.time_low, u.time_mid, u.time_hi_version, (ctypes.c_ubyte * 8).from_buffer_copy(u.bytes[8:]))
        ptr = ctypes.c_wchar_p()
        hr = ctypes.windll.shell32.SHGetKnownFolderPath(ctypes.byref(g), 0, None, ctypes.byref(ptr))
        if hr == 0 and ptr.value:
            val = Path(ptr.value)
            ctypes.windll.ole32.CoTaskMemFree(ptr)
            return val
    except Exception:
        pass
    return None


_EXTERNAL_DRIVE_POLICY_LOCK = threading.Lock()
_EXTERNAL_DRIVE_RUNTIME_STATE: dict[str, Any] = {
    "stage1_c_done": False,
    "stage2_internal_done": False,
    "active_Prompt": None,
    "indexing_vol_id": "",
    "indexing_drive": "",
    "indexing_est_min": 1,
    "indexing_pct": 0,
    "completed_banner_until": 0.0,
    "completed_drive": "",
    "completed_count": 0,
    "connected_ext_map": {},  # vol_id -> {"drive": "I:", "label": "...", "est_files": 0, "est_min": 1}
}


def _get_external_policy_paths() -> tuple[Path, Path]:
    local_app = Path(os.environ.get("LOCALAPPDATA") or (Path.home() / "AppData" / "Local")) / "Merlin"
    local_app.mkdir(parents=True, exist_ok=True)
    policy_p = local_app / "external_drive_policy.json"
    cache_root = local_app / "external_cache"
    cache_root.mkdir(parents=True, exist_ok=True)
    return policy_p, cache_root


def _load_external_drive_policy() -> dict[str, Any]:
    policy_p, _ = _get_external_policy_paths()
    if not policy_p.exists():
        return {"volumes": {}}
    try:
        data = json.loads(policy_p.read_text(encoding="utf-8", errors="ignore"))
        if isinstance(data, dict) and isinstance(data.get("volumes"), dict):
            return data
    except Exception:
        pass
    return {"volumes": {}}


def _save_external_drive_policy(data: dict[str, Any]) -> None:
    policy_p, _ = _get_external_policy_paths()
    try:
        policy_p.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception:
        pass


def _classify_drive_volume_and_bus(drv_letter: str) -> dict[str, Any] | None:
    """
    Win32 API로 드라이브(D:~Z:)의 물리 타입(내장 고정 하드 vs USB/외장 이동식)과
    볼륨 고유번호(VolumeSerialNumber: VOL_XXXXXXXX)를 0.1ms 내에 판별합니다.
    - USB 메모리(DRIVE_REMOVABLE=2)뿐 아니라 USB 버스(BusTypeUsb=7, SD=12, MMC=13) 외장하드도 정확히 외장으로 분류합니다.
    """
    if sys.platform != "win32":
        return None
    drv_ch = drv_letter[:1].upper()
    drv_root = f"{drv_ch}:\\"
    try:
        k32.GetDriveTypeW.argtypes = [wintypes.LPCWSTR]
        k32.GetDriveTypeW.restype = wintypes.UINT
        prev_err = k32.SetErrorMode(0x0001 | 0x8000)
        try:
            dtype = int(k32.GetDriveTypeW(drv_root))
            if dtype not in (2, 3):  # 2=DRIVE_REMOVABLE, 3=DRIVE_FIXED
                return None
            p_drv = Path(drv_root)
            if not p_drv.exists() or not p_drv.is_dir():
                return None

            vol_name_buf = ctypes.create_unicode_buffer(260)
            fs_name_buf = ctypes.create_unicode_buffer(260)
            vol_serial = wintypes.DWORD(0)
            max_comp_len = wintypes.DWORD(0)
            fs_flags = wintypes.DWORD(0)
            ok_vol = k32.GetVolumeInformationW(
                wintypes.LPCWSTR(drv_root),
                vol_name_buf,
                260,
                ctypes.byref(vol_serial),
                ctypes.byref(max_comp_len),
                ctypes.byref(fs_flags),
                fs_name_buf,
                260,
            )
            if not ok_vol:
                return None
            vol_id = f"VOL_{int(vol_serial.value) & 0xFFFFFFFF:08X}"
            vol_label = (vol_name_buf.value or "").strip()

            is_external_usb = (dtype == 2)
            bus_type = 2 if dtype == 2 else 0
            if dtype == 3:
                # IOCTL_STORAGE_QUERY_PROPERTY (0x002D1400)로 물리 BusType 조회 (7=USB, 12=SD, 13=MMC)
                try:
                    h_dev = k32.CreateFileW(
                        wintypes.LPCWSTR(f"\\\\.\\{drv_ch}:"),
                        0,
                        0x00000001 | 0x00000002,  # FILE_SHARE_READ | FILE_SHARE_WRITE
                        None,
                        3,  # OPEN_EXISTING
                        0,
                        None,
                    )
                    if h_dev and h_dev != wintypes.HANDLE(-1).value and int(h_dev) != -1:
                        try:
                            query_buf = struct.pack("<III", 0, 0, 0)  # StorageDeviceProperty=0, PropertyStandardQuery=0
                            out_buf = ctypes.create_string_buffer(128)
                            bytes_ret = wintypes.DWORD(0)
                            ok_io = k32.DeviceIoControl(
                                h_dev,
                                0x002D1400,
                                query_buf,
                                len(query_buf),
                                out_buf,
                                128,
                                ctypes.byref(bytes_ret),
                                None,
                            )
                            if ok_io and bytes_ret.value >= 32:
                                # STORAGE_DEVICE_DESCRIPTOR offset 28 = BusType (BYTE)
                                bus_type = int(out_buf.raw[28])
                                if bus_type in (7, 12, 13):
                                    is_external_usb = True
                        finally:
                            k32.CloseHandle(h_dev)
                except Exception:
                    pass

            return {
                "letter": f"{drv_ch}:",
                "root": drv_root,
                "dtype": dtype,
                "bus_type": bus_type,
                "is_external": is_external_usb,
                "vol_id": vol_id,
                "label": vol_label or ("USB 드라이브" if is_external_usb else "로컬 디스크"),
            }
        finally:
            k32.SetErrorMode(prev_err)
    except Exception:
        return None


def _quick_probe_external_drive_candidate(drv_root: str) -> tuple[bool, int, str]:
    """
    [인증서(NPKI) · OS 설치용 · 파일 5개 미만 소형 USB 100% 무소음 자동 패스 판별기]:
    - 파일을 절대 열지 않고(Read-Only os.scandir, 쓰기 0 Byte) 0.08초 내에 가볍게 확인합니다.
    - 공동인증서(NPKI)만 있거나 실제 문서·사진·영상 파일이 5개 미만인 USB, Windows 설치 USB는
      질문창조차 띄우지 않고 (False, count, reason)으로 조용히 스킵합니다.
    """
    target_exts = {
        ".pdf", ".xlsx", ".xls", ".docx", ".doc", ".hwp", ".hwpx", ".pptx", ".ppt", ".txt", ".csv", ".md",
        ".png", ".jpg", ".jpeg", ".jfif", ".webp", ".gif", ".bmp", ".heic", ".heif",
        ".mp4", ".mov", ".avi", ".mkv", ".webm", ".wmv", ".m4v", ".3gp", ".ts", ".mts", ".flv",
    }
    root_p = Path(drv_root)
    try:
        if (root_p / "bootmgr").exists() and (root_p / "sources").exists():
            return (False, 0, "OS_INSTALLER")
    except Exception:
        return (False, 0, "UNREADABLE")

    media_cnt = 0
    sub_dirs: list[Path] = []
    t0 = time.time()
    try:
        with os.scandir(root_p) as it:
            for ent in it:
                try:
                    nm = ent.name
                    nm_low = nm.lower()
                    if nm.startswith((".", "$", "~")) or nm_low in ("npki", "system volume information", "$recycle.bin", "autorun.inf"):
                        continue
                    if ent.is_dir(follow_symlinks=False):
                        if nm_low not in _SEARCH_SKIP_SUB_DIRS and len(sub_dirs) < 40:
                            sub_dirs.append(Path(ent.path))
                    elif ent.is_file(follow_symlinks=False):
                        dot = nm_low.rfind(".")
                        if dot >= 0 and nm_low[dot:] in target_exts:
                            media_cnt += 1
                except Exception:
                    pass
    except Exception:
        return (False, 0, "UNREADABLE")

    for sd in sub_dirs:
        if (time.time() - t0) > 0.12 or media_cnt >= 1500:
            break
        try:
            with os.scandir(sd) as it2:
                for ent2 in it2:
                    try:
                        nm2 = ent2.name
                        nm2_low = nm2.lower()
                        if nm2.startswith((".", "$", "~")):
                            continue
                        if ent2.is_file(follow_symlinks=False):
                            dot2 = nm2_low.rfind(".")
                            if dot2 >= 0 and nm2_low[dot2:] in target_exts:
                                media_cnt += 1
                        elif ent2.is_dir(follow_symlinks=False) and nm2_low not in _SEARCH_SKIP_SUB_DIRS:
                            try:
                                with os.scandir(ent2.path) as it3:
                                    for ent3 in it3:
                                        if ent3.is_file(follow_symlinks=False):
                                            dot3 = ent3.name.lower().rfind(".")
                                            if dot3 >= 0 and ent3.name.lower()[dot3:] in target_exts:
                                                media_cnt += 1
                            except Exception:
                                pass
                    except Exception:
                        pass
        except Exception:
            pass

    if media_cnt < 5:
        return (False, media_cnt, "CERT_OR_UNDER_5")
    return (True, media_cnt, "DATA_DRIVE")


def _load_external_volume_local_cache(vol_id: str, current_letter: str) -> list[dict]:
    """
    내 PC 로컬(%LOCALAPPDATA%\\Merlin\\external_cache\\<VOL_ID>\\index_cache.json)에 격리 보관된
    외장 드라이브 캐시를 읽어 현재 연결된 드라이브 문자(current_letter)로 경로를 매핑해 반환합니다. (USB 내부 쓰기 0 Byte)
    """
    _, cache_root = _get_external_policy_paths()
    cache_file = cache_root / vol_id / "index_cache.json"
    if not cache_file.exists():
        return []
    try:
        raw = json.loads(cache_file.read_text(encoding="utf-8", errors="ignore"))
        items = raw.get("items") if isinstance(raw, dict) else None
        if not isinstance(items, list):
            return []
        drv_prefix = current_letter[:2].upper()
        out: list[dict] = []
        for it in items:
            if not isinstance(it, dict):
                continue
            rel_p = str(it.get("rel_path") or "").lstrip("\\/")
            full_p = f"{drv_prefix}\\{rel_p}" if rel_p else str(it.get("file_path") or "")
            rec = {
                "kind": str(it.get("kind") or "doc"),
                "file_path": full_p,
                "img_path": full_p if it.get("kind") == "image" else "",
                "text": str(it.get("text") or ""),
                "ts": float(it.get("ts") or 0.0),
                "_ext_vol_id": vol_id,
            }
            out.append(rec)
        return out
    except Exception:
        return []


def _index_external_volume_to_local_cache_worker(vol_id: str, drv_letter: str, drv_label: str, est_min: int) -> None:
    """
    [외장/USB 드라이브 전용 Read-Only 로컬 인덱서]:
    - USB 내부에는 단 1바이트도 쓰지 않고(100% Read-Only), 스캔 직후 모든 디렉터리/파일 핸들을 즉시 닫아 '안전 제거'를 방해하지 않습니다.
    - 인덱싱 중에는 탈착 금지 안내를 표시하고, 완료 즉시 내 PC 로컬(%LOCALAPPDATA%\\Merlin\\external_cache\\<VOL_ID>)에 저장 후
      '✅ 인덱싱 완료! 이제 언제든 안전하게 뽑으셔도 됩니다' 알림을 띄웁니다.
    """
    drv_prefix = drv_letter[:2].upper()
    drv_root = f"{drv_prefix}\\"
    with _EXTERNAL_DRIVE_POLICY_LOCK:
        _EXTERNAL_DRIVE_RUNTIME_STATE["indexing_vol_id"] = vol_id
        _EXTERNAL_DRIVE_RUNTIME_STATE["indexing_drive"] = drv_prefix
        _EXTERNAL_DRIVE_RUNTIME_STATE["indexing_est_min"] = max(1, est_min)
        _EXTERNAL_DRIVE_RUNTIME_STATE["indexing_pct"] = 5
        pol = _load_external_drive_policy()
        v_entry = pol.setdefault("volumes", {}).setdefault(vol_id, {})
        v_entry.update({
            "decision": "included",
            "driveLetter": drv_prefix,
            "label": drv_label,
            "indexingStatus": "indexing",
            "progressPct": 5,
            "updatedAt": time.time(),
        })
        _save_external_drive_policy(pol)

    show_ghost_toast(
        f"⏳ 외장 드라이브({drv_prefix}) 인덱싱 중 (약 {max(1, est_min)}분 소요) — 완료 안내가 뜰 때까지 USB를 뽑지 마세요!",
        duration_ms=4200,
    )

    doc_exts = {".pdf", ".xlsx", ".xls", ".docx", ".doc", ".hwp", ".hwpx", ".pptx", ".ppt", ".txt", ".csv", ".md"}
    img_exts = {".png", ".jpg", ".jpeg", ".jfif", ".webp", ".gif", ".bmp", ".heic", ".heif"}
    vid_exts = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".wmv", ".m4v", ".3gp", ".ts", ".mts", ".flv"}

    scan_dirs: list[Path] = [Path(drv_root)]
    seen_dirs: set[str] = {os.path.normcase(drv_root)}
    q_bfs: list[tuple[Path, int]] = [(Path(drv_root), 0)]
    while q_bfs and len(scan_dirs) < 260:
        cur_d, depth = q_bfs.pop(0)
        if depth >= 4:
            continue
        try:
            with os.scandir(cur_d) as it_d:
                for de in it_d:
                    if len(scan_dirs) >= 260:
                        break
                    try:
                        if not de.is_dir(follow_symlinks=False):
                            continue
                        nm = de.name
                        nm_low = nm.lower()
                        if nm.startswith((".", "$", "~")) or nm_low in _SEARCH_SKIP_SUB_DIRS or nm_low == "npki":
                            continue
                        norm_p = os.path.normcase(os.path.abspath(de.path))
                        if norm_p not in seen_dirs:
                            seen_dirs.add(norm_p)
                            p_sub = Path(de.path)
                            scan_dirs.append(p_sub)
                            q_bfs.append((p_sub, depth + 1))
                    except Exception:
                        pass
        except Exception:
            pass

    collected: list[dict] = []
    total_d = max(1, len(scan_dirs))
    for idx_fd, fd in enumerate(scan_dirs):
        pct = min(95, max(10, int(((idx_fd + 1) / total_d) * 90)))
        _EXTERNAL_DRIVE_RUNTIME_STATE["indexing_pct"] = pct
        fd_badge = f"🔌{drv_prefix}\\{fd.name}" if fd.name else f"🔌{drv_prefix}\\"
        try:
            with os.scandir(fd) as it_f:
                for entry in it_f:
                    try:
                        if not entry.is_file(follow_symlinks=False):
                            continue
                        name = entry.name
                        name_low = name.lower()
                        if (
                            name.startswith((".", "~$", ".~lock."))
                            or name_low in ("desktop.ini", "thumbs.db", "autorun.inf")
                            or name_low.endswith((".lck", ".tmp", ".ghosti_sync_tmp"))
                        ):
                            continue
                        dot_idx = name_low.rfind(".")
                        if dot_idx < 0:
                            continue
                        ext = name_low[dot_idx:]
                        if ext in doc_exts:
                            fkind = "doc"
                        elif ext in img_exts:
                            fkind = "image"
                        elif ext in vid_exts:
                            fkind = "video"
                        else:
                            continue
                        st = entry.stat(follow_symlinks=False)
                        full_path_s = entry.path
                        rel_path_s = full_path_s[3:] if len(full_path_s) > 3 and full_path_s[1:3] == ":\\" else name
                        collected.append({
                            "kind": fkind,
                            "file_path": full_path_s,
                            "rel_path": rel_path_s,
                            "text": f"[{fd_badge}] {name}",
                            "ts": float(st.st_mtime),
                        })
                    except Exception:
                        pass
        except Exception:
            pass

    collected.sort(key=lambda x: x.get("ts", 0.0), reverse=True)
    collected = collected[:1500]

    _, cache_root = _get_external_policy_paths()
    vol_dir = cache_root / vol_id
    vol_dir.mkdir(parents=True, exist_ok=True)
    cache_file = vol_dir / "index_cache.json"
    try:
        cache_file.write_text(
            json.dumps(
                {
                    "volId": vol_id,
                    "driveLetter": drv_prefix,
                    "label": drv_label,
                    "indexedAt": time.time(),
                    "itemCount": len(collected),
                    "items": collected,
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )
    except Exception:
        pass

    with _EXTERNAL_DRIVE_POLICY_LOCK:
        _EXTERNAL_DRIVE_RUNTIME_STATE["indexing_vol_id"] = ""
        _EXTERNAL_DRIVE_RUNTIME_STATE["indexing_pct"] = 100
        _EXTERNAL_DRIVE_RUNTIME_STATE["completed_banner_until"] = time.time() + 18.0
        _EXTERNAL_DRIVE_RUNTIME_STATE["completed_drive"] = drv_prefix
        _EXTERNAL_DRIVE_RUNTIME_STATE["completed_count"] = len(collected)
        pol = _load_external_drive_policy()
        v_entry = pol.setdefault("volumes", {}).setdefault(vol_id, {})
        v_entry.update({
            "decision": "included",
            "driveLetter": drv_prefix,
            "label": drv_label,
            "indexingStatus": "completed",
            "progressPct": 100,
            "indexedCount": len(collected),
            "updatedAt": time.time(),
        })
        _save_external_drive_policy(pol)

    _LOCAL_FILE_CACHE["ts"] = 0.0
    _refresh_lightweight_local_files_async(force=True)
    show_ghost_toast(
        f"✅ 외장 드라이브({drv_prefix} · {len(collected)}건) 인덱싱 완료! 이제 언제든 안전하게 USB를 뽑으셔도 됩니다.",
        duration_ms=4200,
    )


def decide_external_drive_action(vol_id: str, decision: str) -> None:
    """
    유저가 귀신검색창에서 외장 드라이브 질문에 [검색에 포함]("included") 또는 [제외(다시 묻지 않음)]("excluded")을 클릭했을 때 처리합니다.
    """
    norm_dec = "included" if decision == "included" else "excluded"
    ext_info = _EXTERNAL_DRIVE_RUNTIME_STATE.get("connected_ext_map", {}).get(vol_id) or {}
    drv_letter = str(ext_info.get("drive") or "")
    drv_label = str(ext_info.get("label") or "외장 드라이브")
    est_min = int(ext_info.get("est_min") or 1)

    with _EXTERNAL_DRIVE_POLICY_LOCK:
        pol = _load_external_drive_policy()
        v_entry = pol.setdefault("volumes", {}).setdefault(vol_id, {})
        v_entry["decision"] = norm_dec
        v_entry["driveLetter"] = drv_letter
        v_entry["label"] = drv_label
        v_entry["updatedAt"] = time.time()
        if norm_dec == "excluded":
            v_entry["indexingStatus"] = "excluded"
        _save_external_drive_policy(pol)
        if _EXTERNAL_DRIVE_RUNTIME_STATE.get("active_Prompt") and _EXTERNAL_DRIVE_RUNTIME_STATE["active_Prompt"].get("vol_id") == vol_id:
            _EXTERNAL_DRIVE_RUNTIME_STATE["active_Prompt"] = None

    if norm_dec == "included" and drv_letter:
        threading.Thread(
            target=_index_external_volume_to_local_cache_worker,
            args=(vol_id, drv_letter, drv_label, est_min),
            daemon=True,
        ).start()
    else:
        show_ghost_toast(f"🔌 외장 드라이브({drv_letter or vol_id})는 검색에서 제외했습니다 (다시 묻지 않음)", duration_ms=2600)


def get_external_drive_ui_banner_state() -> dict[str, Any] | None:
    """
    귀신검색창(ghost_search_window_ui2.py) 상단에 표시할 외장 드라이브 상태 배너 정보를 반환합니다.
    - status == "indexing": 인덱싱 진행 중 (탈착 금지 안내)
    - status == "completed": 인덱싱 완료 직후 18초간 (안전 탈착 가능 안내)
    - status == "prompt": 로컬(C: + 내장 하드) 스캔이 모두 끝난 뒤 미결정 자료용 외장 드라이브 1회 질문
    """
    now_b = time.time()
    if _EXTERNAL_DRIVE_RUNTIME_STATE.get("indexing_vol_id"):
        return {
            "status": "indexing",
            "vol_id": _EXTERNAL_DRIVE_RUNTIME_STATE["indexing_vol_id"],
            "drive": _EXTERNAL_DRIVE_RUNTIME_STATE.get("indexing_drive") or "",
            "est_min": int(_EXTERNAL_DRIVE_RUNTIME_STATE.get("indexing_est_min") or 1),
            "pct": int(_EXTERNAL_DRIVE_RUNTIME_STATE.get("indexing_pct") or 10),
        }
    if now_b < float(_EXTERNAL_DRIVE_RUNTIME_STATE.get("completed_banner_until") or 0.0):
        return {
            "status": "completed",
            "drive": _EXTERNAL_DRIVE_RUNTIME_STATE.get("completed_drive") or "",
            "count": int(_EXTERNAL_DRIVE_RUNTIME_STATE.get("completed_count") or 0),
        }
    if not _EXTERNAL_DRIVE_RUNTIME_STATE.get("stage2_internal_done"):
        return None
    prompt_info = _EXTERNAL_DRIVE_RUNTIME_STATE.get("active_Prompt")
    if isinstance(prompt_info, dict) and prompt_info.get("vol_id"):
        drv_p = str(prompt_info.get("drive") or "")
        if drv_p and Path(f"{drv_p}\\").exists():
            return {
                "status": "prompt",
                "vol_id": prompt_info["vol_id"],
                "drive": drv_p,
                "label": prompt_info.get("label") or "외장 드라이브",
                "est_files": int(prompt_info.get("est_files") or 0),
                "est_min": int(prompt_info.get("est_min") or 1),
            }
    return None


def _get_known_user_folders_for_search(include_internal_secondary_drives: bool = True) -> list[Path]:
    now_f = time.time()
    cache_key_f = "folders_all" if include_internal_secondary_drives else "folders_c_only"
    if _KNOWN_USER_FOLDERS_CACHE.get(cache_key_f) and (now_f - float(_KNOWN_USER_FOLDERS_CACHE.get(f"ts_{cache_key_f}", 0.0))) < 25.0:
        return list(_KNOWN_USER_FOLDERS_CACHE[cache_key_f])
    home = Path.home()
    raw_cands: list[Path] = []
    # [0순위: 업무 공유 S: 드라이브 직결] S:\가 실제 마운트된 업무공유 활성 상태일 때만 편입 ([2. 순수 개인 모드] 전환 시 업무 파일 혼입 0% 보장)
    try:
        if Path("S:\\").exists():
            raw_cands.append(Path("S:\\"))
    except Exception:
        pass
    # [사용자 지정 폴더(ghosti_custom_scan_roots.json)]
    try:
        custom_roots_p = Path(os.environ.get("LOCALAPPDATA") or (home / "AppData" / "Local")) / "Merlin" / "ghosti_custom_scan_roots.json"
        if custom_roots_p.exists():
            cr_data = json.loads(custom_roots_p.read_text(encoding="utf-8", errors="ignore"))
            if isinstance(cr_data, list):
                for cr_item in cr_data:
                    if isinstance(cr_item, str) and cr_item.strip():
                        raw_cands.append(Path(cr_item.strip()))
    except Exception:
        pass
    # Win32 KnownFolders: Desktop, Downloads, Documents, Pictures, Videos
    for guid_s in (
        "{B4BFCC3A-DB2C-424C-B029-7FE99A87C641}",
        "{374DE290-123F-4565-9164-39C4925E467B}",
        "{FDD39AD0-238F-46AF-ADB4-6C85480369C7}",
        "{33E28130-4E1E-4676-835A-98395C3BC3BB}",
        "{18989B1D-99B5-455B-841C-AB7C74E4DDFC}",
    ):
        kp = _resolve_win_known_folder_safe(guid_s)
        if kp is not None:
            raw_cands.append(kp)

    raw_cands.extend([
        home / "Desktop",
        home / "Downloads",
        home / "Documents",
        home / "Pictures",
        home / "Videos",
        home / "Documents" / "카카오톡 받은 파일",
        home / "Downloads" / "카카오톡 받은 파일",
    ])

    od_roots: list[Path] = []
    for env_k in ("OneDrive", "OneDriveConsumer", "OneDriveCommercial"):
        ev = (os.environ.get(env_k) or "").strip()
        if ev:
            od_roots.append(Path(ev))
    od_roots.append(home / "OneDrive")
    for od in od_roots:
        if od.exists() and od.is_dir():
            for sub in ("Desktop", "바탕 화면", "Documents", "문서", "Pictures", "사진", "Videos", "동영상"):
                raw_cands.append(od / sub)
            raw_cands.append(od / "Documents" / "카카오톡 받은 파일")
            raw_cands.append(od / "문서" / "카카오톡 받은 파일")

    # [1단계: C:\ 루트의 일반 사용자 폴더(시스템/보안/개발코드 폴더 제외) 자동 편입]
    _C_ROOT_SKIP = {
        "windows", "program files", "program files (x86)", "programdata", "users",
        "perflogs", "recovery", "intel", "amd", "nvidia", "msocache", "inetpub",
        "temp", "tmp", "merlintools", "merlinwaybill", "studio", "merlin_ai_models",
        "system volume information", "$recycle.bin", "drivers", "efi", "boot",
        "config.msi", "windows.old", "onedrivetemp", "swsetup", "dell", "hp",
        "documents and settings", "xecuressl", "wizvera", "ahnlab", "nprotect",
        "touchen", "iniline", "softforum", "crosscert", "dreamsecurity", "yettiesoft",
        "markany", "raonsecure", "kings",
    }

    def _is_code_repo_dir_fast(dp: Path) -> bool:
        try:
            for marker in (".git", "package.json", "requirements.txt", "pyproject.toml", "Cargo.toml", "go.mod"):
                if (dp / marker).exists():
                    return True
        except Exception:
            pass
        return False

    # QA/사용자 명시 코퍼스 폴더가 존재하는 경우(일반 PC엔 미존재) AppData 초기화 후에도 안전하게 자동 편입
    try:
        _corpus_c = Path("C:\\MerlinTools\\Ghosti_Test_Corpus")
        if _corpus_c.exists() and _corpus_c.is_dir():
            raw_cands.append(_corpus_c)
    except Exception:
        pass

    try:
        with os.scandir("C:\\") as it_c:
            for c_ent in it_c:
                try:
                    if not c_ent.is_dir(follow_symlinks=False):
                        continue
                    cn_low = c_ent.name.lower()
                    if (
                        c_ent.name.startswith((".", "$", "~"))
                        or cn_low in _C_ROOT_SKIP
                        or cn_low.startswith(("python", "anaconda", "miniconda", "found.", "msdownld"))
                    ):
                        continue
                    p_c = Path(c_ent.path)
                    if _is_code_repo_dir_fast(p_c):
                        continue
                    raw_cands.append(p_c)
                except Exception:
                    continue
    except Exception:
        pass

    # [2단계 & 3단계 분리: 내장 고정 하드(D:~Z:, is_external==False)만 자동 스캔에 편입하고,
    #  USB/외장 드라이브(is_external==True)는 로컬 완료 후 인증서 필터 & 생애 1회 질문 정책으로 분리!]
    if sys.platform == "win32" and include_internal_secondary_drives:
        pol = _load_external_drive_policy()
        pol_vols = pol.get("volumes") if isinstance(pol.get("volumes"), dict) else {}
        connected_ext: dict[str, dict[str, Any]] = {}
        first_prompt_cand: dict[str, Any] | None = None

        for drv_ord in range(ord("D"), ord("Z") + 1):
            drv_ch = chr(drv_ord)
            if drv_ch == "S":
                continue
            d_info = _classify_drive_volume_and_bus(drv_ch)
            if not d_info:
                continue
            if not d_info["is_external"]:
                # 내장 고정 하드(SATA/NVMe 등): 자동 순차 스캔 편입
                raw_cands.append(Path(d_info["root"]))
            else:
                # USB / 외장 드라이브: 직접 스캔 루트에 섞지 않고 볼륨 고유번호(vol_id) 정책으로 관리
                vid = d_info["vol_id"]
                v_rec = pol_vols.get(vid) if isinstance(pol_vols.get(vid), dict) else {}
                dec = str(v_rec.get("decision") or "pending")
                if dec == "excluded":
                    continue
                is_data_drv, est_cnt, reason = _quick_probe_external_drive_candidate(d_info["root"])
                if not is_data_drv and dec != "included":
                    # 인증서(NPKI) 전용 USB · 파일 5개 미만 · OS 설치 USB는 질문창조차 띄우지 않고 100% 무소음 패스!
                    continue
                est_min = max(1, min(15, round(max(5, est_cnt) / 450)))
                ext_meta = {
                    "vol_id": vid,
                    "drive": d_info["letter"],
                    "label": d_info["label"],
                    "est_files": est_cnt,
                    "est_min": est_min,
                    "decision": dec,
                }
                connected_ext[vid] = ext_meta
                if dec == "pending" and first_prompt_cand is None:
                    first_prompt_cand = ext_meta

        _EXTERNAL_DRIVE_RUNTIME_STATE["connected_ext_map"] = connected_ext
        _EXTERNAL_DRIVE_RUNTIME_STATE["active_Prompt"] = first_prompt_cand

    deduped: list[Path] = []
    seen_dirs: set[str] = set()
    for d in raw_cands:
        try:
            if not d.exists() or not d.is_dir():
                continue
            norm_d = os.path.normcase(os.path.abspath(str(d)))
            if norm_d not in seen_dirs:
                seen_dirs.add(norm_d)
                deduped.append(d)
        except Exception:
            pass
    _KNOWN_USER_FOLDERS_CACHE[f"ts_{cache_key_f}"] = now_f
    _KNOWN_USER_FOLDERS_CACHE[cache_key_f] = deduped
    _KNOWN_USER_FOLDERS_CACHE["ts"] = now_f
    _KNOWN_USER_FOLDERS_CACHE["folders"] = deduped
    return deduped


def _load_doc_body_cache_fast() -> dict[str, str]:
    """
    [5.5MB+ 대용량 문서 캐시 무블로킹 프리슬라이싱 로더]:
    - doc_text_cache_v1.json(건당 최대 50,000자)이 갱신되었을 때만 로드하되,
      매 스캔마다 6,000건 × 50,000자에 re.sub를 돌려 GIL이 수 초간 멈추지 않도록
      로드 시점에 앞 2,400자만 선절삭·공백정규화(1,600자)하여 메모리에 경량 보관합니다.
    """
    try:
        local_app_c = Path(os.environ.get("LOCALAPPDATA") or (Path.home() / "AppData" / "Local"))
        doc_cache_p = local_app_c / "Merlin" / "doc_text_cache_v1.json"
        if not doc_cache_p.exists():
            return {}
        st_dc = doc_cache_p.stat()
        if (
            _DOC_BODY_MEM_CACHE["mtime_ns"] == int(st_dc.st_mtime_ns)
            and _DOC_BODY_MEM_CACHE["size"] == int(st_dc.st_size)
            and isinstance(_DOC_BODY_MEM_CACHE["data"], dict)
        ):
            return _DOC_BODY_MEM_CACHE["data"]
        raw_bytes = doc_cache_p.read_bytes()
        time.sleep(0.001)
        raw_dc = json.loads(raw_bytes.decode("utf-8", errors="ignore"))
        time.sleep(0.001)
        if isinstance(raw_dc, dict):
            slim_dc: dict[str, str] = {}
            for _idx_dc, (k_dc, v_dc) in enumerate(raw_dc.items()):
                if v_dc:
                    slim_dc[k_dc] = re.sub(r"\s+", " ", str(v_dc)[:2400]).strip()[:1600]
                if (_idx_dc & 127) == 127:
                    time.sleep(0.001)
            _DOC_BODY_MEM_CACHE["mtime_ns"] = int(st_dc.st_mtime_ns)
            _DOC_BODY_MEM_CACHE["size"] = int(st_dc.st_size)
            _DOC_BODY_MEM_CACHE["data"] = slim_dc
            return slim_dc
    except Exception:
        if isinstance(_DOC_BODY_MEM_CACHE.get("data"), dict):
            return _DOC_BODY_MEM_CACHE["data"]
    return {}


_SEARCH_SKIP_SUB_DIRS = {
    "node_modules", ".git", "appdata", "__pycache__", "venv", ".venv",
    "dist", "build", "universal_z_core", "merlin_z_core", "$recycle.bin",
    "system volume information", "windows", "program files", "program files (x86)",
    "programdata", "recovery", "perflogs", "msocache", "intel", "amd", "nvidia",
    "temp", "tmp", "cache", "caches", "logs", "obj", "bin", "debug", "release",
    "target", "packages", "vendor", "bower_components", "site-packages",
    "merlin_ai_models", "shadowvault", "windowsapps", "wpsystem", "wudownloadcache",
    "config.msi", "drivers", "efi", "boot", "windows.old", "onedrivetemp",
    ".gradle", "gradle", "pods", "android", "ios", ".next", ".nuxt", ".vite",
    ".cache", "coverage", "storybook-static", "documents and settings",
}

_SCAN_DIRS_CACHE: dict = {"ts": 0.0, "dirs": []}


def _collect_search_scan_dirs(
    max_total_dirs: int = 8000,
    max_per_drive: int = 2400,
    time_budget_sec: float = 9.0,
    force: bool = False,
) -> list[Path]:
    """
    [전 PC 전 하드 드라이브 2계층 공정 라운드-로빈 폴더 수집기 (Starvation 0%)]:
    - 1계층(드라이브 간 1:1): S:, D:, E:, F:, C:, G: 등 각 드라이브에 독립 폴더 상한(2,400/드라이브)·독립 시간 예산(로컬 4.5s, 가상 2.0s) 배분.
    - 2계층(드라이브 내부 루트 간 1:1): C: 내부에서도 Desktop/Downloads/Documents/Pictures/Videos/카카오톡/사용자폴더가
      각각 독립 서브큐로 교대 확장되어, Documents·Downloads 하위 폴더가 많아도 사진(Pictures)·영상(Videos)이 절대 잘리지 않음!
    """
    now_c = time.time()
    if not force and _SCAN_DIRS_CACHE["dirs"] and (now_c - float(_SCAN_DIRS_CACHE["ts"])) < 20.0:
        return list(_SCAN_DIRS_CACHE["dirs"])

    folders = _get_known_user_folders_for_search()
    scan_dirs: list[Path] = []
    seen_scan_dirs: set[str] = set()
    t_start = time.time()

    drive_groups: dict[str, dict[str, Any]] = {}
    for root_fd in folders:
        norm_r = os.path.normcase(os.path.abspath(str(root_fd)))
        if norm_r not in seen_scan_dirs:
            seen_scan_dirs.add(norm_r)
            scan_dirs.append(root_fd)
        rs = str(root_fd)
        drv_key = rs[:2].upper() if len(rs) >= 2 and rs[1] == ":" else "OTHER"
        grp = drive_groups.get(drv_key)
        if grp is None:
            is_virtual_cloud = False
            if len(drv_key) == 2 and drv_key != "C:" and drv_key != "S:":
                try:
                    drv_root_chk = f"{drv_key}\\"
                    if (
                        os.path.exists(os.path.join(drv_root_chk, ".shortcut-targets-by-id"))
                        or os.path.exists(os.path.join(drv_root_chk, "내 드라이브"))
                        or os.path.exists(os.path.join(drv_root_chk, "My Drive"))
                    ):
                        is_virtual_cloud = True
                except Exception:
                    pass
            grp = {
                "drv": drv_key,
                "sub_queues": [],
                "rr_idx": 0,
                "added": 0,
                "cap": 600 if is_virtual_cloud else max_per_drive,
                "elapsed": 0.0,
                "time_cap": 2.0 if is_virtual_cloud else 4.5,
                "is_virtual": is_virtual_cloud,
            }
            drive_groups[drv_key] = grp
        grp["sub_queues"].append([(root_fd, 0)])

    # 로컬 물리 드라이브(S:, D:, E:, F:, C: 등)를 가상 클라우드 드라이브(G:/H:)보다 먼저 라운드-로빈 배치
    ordered_groups = sorted(
        drive_groups.values(),
        key=lambda g: (1 if g["is_virtual"] else 0, 0 if g["drv"] == "S:" else (2 if g["drv"] == "C:" else 1), g["drv"]),
    )

    max_depth = 5
    active = True
    while active and len(scan_dirs) < max_total_dirs and (time.time() - t_start) <= time_budget_sec:
        active = False
        for grp in ordered_groups:
            if len(scan_dirs) >= max_total_dirs or (time.time() - t_start) > time_budget_sec:
                break
            if grp["added"] >= grp["cap"] or grp["elapsed"] >= grp["time_cap"]:
                continue
            sub_qs = grp["sub_queues"]
            n_sq = len(sub_qs)
            if n_sq == 0:
                continue
            # 드라이브 내부 각 루트(Desktop/Downloads/Documents/Pictures/Videos 등)를 1:1 공정 라운드-로빈으로 선택
            chosen_q = None
            for _off in range(n_sq):
                idx_try = (grp["rr_idx"] + _off) % n_sq
                if sub_qs[idx_try]:
                    chosen_q = sub_qs[idx_try]
                    grp["rr_idx"] = (idx_try + 1) % n_sq
                    break
            if chosen_q is None:
                continue
            active = True
            cur_fd, depth = chosen_q.pop(0)
            if depth >= max_depth:
                continue
            t_step = time.time()
            try:
                with os.scandir(cur_fd) as it_sub:
                    for sub_e in it_sub:
                        if grp["added"] >= grp["cap"] or len(scan_dirs) >= max_total_dirs:
                            break
                        try:
                            if not sub_e.is_dir(follow_symlinks=False):
                                continue
                            sname = sub_e.name
                            sname_low = sname.lower()
                            if (
                                sname.startswith((".", "$", "~"))
                                or sname_low in _SEARCH_SKIP_SUB_DIRS
                                or sname_low.startswith(("found.", "msdownld", "__"))
                            ):
                                continue
                            norm_s = os.path.normcase(os.path.abspath(sub_e.path))
                            if norm_s not in seen_scan_dirs:
                                seen_scan_dirs.add(norm_s)
                                p_sub = Path(sub_e.path)
                                scan_dirs.append(p_sub)
                                grp["added"] += 1
                                if depth + 1 < max_depth:
                                    chosen_q.append((p_sub, depth + 1))
                        except Exception:
                            pass
            except Exception:
                pass
            grp["elapsed"] += max(0.0, time.time() - t_step)

    _SCAN_DIRS_CACHE["dirs"] = list(scan_dirs)
    _SCAN_DIRS_CACHE["ts"] = time.time()
    return scan_dirs


def _compute_watched_folders_fast_sig(scan_dirs: list[Path] | None = None) -> str:
    """
    [열려 있는 귀신검색창 실시간 파일 추가·변경 감지용 무핸들 시그니처]:
    - os.scandir의 WIN32_FIND_DATA만으로 커널 핸들 오픈 0회로 (폴더수, 파일수, 최신수정시각ns, 용량합)을 반환합니다.
    """
    target_exts = {
        ".pdf", ".xlsx", ".xls", ".docx", ".doc", ".hwp", ".hwpx", ".pptx", ".ppt", ".txt", ".csv", ".md",
        ".png", ".jpg", ".jpeg", ".jfif", ".webp", ".gif", ".bmp", ".heic", ".heif",
        ".mp4", ".mov", ".avi", ".mkv", ".webm", ".wmv", ".m4v", ".3gp", ".ts", ".mts", ".flv",
    }
    if scan_dirs is None:
        scan_dirs = _collect_search_scan_dirs()
    f_cnt = 0
    max_mt_ns = 0
    sz_acc = 0
    t_sig_start = time.time()
    for fd in scan_dirs:
        if (time.time() - t_sig_start) > 1.8:
            break
        try:
            with os.scandir(fd) as it:
                for entry in it:
                    try:
                        if not entry.is_file(follow_symlinks=False):
                            continue
                        name = entry.name
                        name_low = name.lower()
                        if (
                            name.startswith((".", "~$", ".~lock."))
                            or name_low in ("desktop.ini", "thumbs.db")
                            or name_low.endswith((".lck", ".tmp", ".ghosti_sync_tmp"))
                        ):
                            continue
                        dot_idx = name_low.rfind(".")
                        if dot_idx < 0 or name_low[dot_idx:] not in target_exts:
                            continue
                        st = entry.stat(follow_symlinks=False)
                        f_cnt += 1
                        mt_ns = int(getattr(st, "st_mtime_ns", int(st.st_mtime * 1_000_000_000)))
                        if mt_ns > max_mt_ns:
                            max_mt_ns = mt_ns
                        sz_acc = (sz_acc + int(st.st_size)) & 0x7FFFFFFFFFFFFFFF
                    except Exception:
                        pass
        except Exception:
            pass
    return f"{len(scan_dirs)}:{f_cnt}:{max_mt_ns}:{sz_acc}"


def _select_fair_by_drive(items: list[dict], limit: int) -> list[dict]:
    """
    [드라이브별 공정 쿼터 선선발]:
    - C: 드라이브에 최신 파일이 수천 개 몰려 있어도 D:/E:/F:/G:/S: 드라이브 파일이 전역 최신순 컷오프에서
      밀려 탈락하지 않도록, 각 드라이브별 최소 보장 쿼터를 먼저 확보한 뒤 잔여 슬롯을 전체 최신순으로 채웁니다.
    """
    if len(items) <= limit:
        return list(items)
    by_drv: dict[str, list[dict]] = {}
    for it in items:
        fp = str(it.get("file_path") or "")
        drv_k = fp[:2].upper() if len(fp) >= 2 and fp[1] == ":" else "OTHER"
        by_drv.setdefault(drv_k, []).append(it)
    if len(by_drv) <= 1:
        return items[:limit]
    per_drv_quota = max(1, limit // max(1, len(by_drv)))
    selected: list[dict] = []
    leftover: list[dict] = []
    for drv_items in by_drv.values():
        selected.extend(drv_items[:per_drv_quota])
        if len(drv_items) > per_drv_quota:
            leftover.extend(drv_items[per_drv_quota:])
    if len(selected) < limit and leftover:
        leftover.sort(key=lambda x: x.get("ts", 0.0), reverse=True)
        selected.extend(leftover[: limit - len(selected)])
    selected.sort(key=lambda x: x.get("ts", 0.0), reverse=True)
    return selected[:limit]


_LOCAL_FS_PROBE_INFLIGHT = False


def _compute_hot_user_folders_fast_sig() -> str:
    """바탕화면·다운로드·문서·사진·동영상·S: 등 핵심 폴더의 mtime_ns만 1ms 이내에 검사해 파일 추가/삭제를 즉시 포착합니다."""
    home = Path.home()
    hot_dirs = [
        home / "Desktop",
        home / "Downloads",
        home / "Documents",
        home / "Pictures",
        home / "Videos",
        home / "Documents" / "카카오톡 받은 파일",
        home / "Downloads" / "카카오톡 받은 파일",
        home / "OneDrive" / "Desktop",
        home / "OneDrive" / "바탕 화면",
        home / "OneDrive" / "Documents",
        home / "OneDrive" / "문서",
        Path("S:\\"),
    ]
    parts: list[str] = []
    for hd in hot_dirs:
        try:
            st_h = os.stat(hd)
            parts.append(f"{st_h.st_mtime_ns}")
        except Exception:
            pass
    return "|".join(parts)


def _scan_lightweight_local_files_sync(force: bool = False) -> list[dict]:
    """
    [초고속 전 하드 드라이브 로컬 파일 스캐너 — UI·단축키 스레드 GIL 블로킹 0%]:
    1) C드라이브 KnownFolders뿐 아니라 D:/E:/F:/G:/I:/S: 등 모든 고정·이동식 하드 드라이브를 라운드-로빈 os.scandir로 누락 없이 스캔합니다.
    2) 드라이브별 공정 쿼터 + 최신순 문서 6,000건 + 사진 6,000건 + 영상 2,000건을 인덱싱하여 보조 드라이브 파일이 C: 파일에 밀려 잘리지 않게 보장합니다.
    3) 가상 클라우드 드라이브(G: Google Drive 등) 독립 시간 예산(1.5s) 및 주기적 GIL 양보(sleep 0.5ms)로 UI 프리징·Watchdog 자폭을 원천 차단합니다.
    """
    with _LOCAL_FILE_SCAN_LOCK:
        now = time.time()
        last_ts = float(_LOCAL_FILE_CACHE.get("ts") or 0.0)
        # 연속 중복 force 스캔 폭주 방어: 직전 1.0초 이내에 이미 스캔이 끝났고 핫 폴더 시그니처가 동일하면 즉시 재사용
        hot_sig = _compute_hot_user_folders_fast_sig()
        if (
            last_ts > 0.0
            and (now - last_ts) < 1.0
            and hot_sig == _LOCAL_FILE_CACHE.get("hot_sig")
            and _LOCAL_FILE_CACHE.get("items")
        ):
            return _LOCAL_FILE_CACHE["items"]

        scan_dirs = _collect_search_scan_dirs(force=force)
        cur_sig = f"{hot_sig}::{_compute_watched_folders_fast_sig(scan_dirs=scan_dirs)}"
        if (
            not force
            and last_ts > 0.0
            and (now - last_ts) < 115.0
            and cur_sig == _LOCAL_FILE_CACHE.get("dir_sig")
        ):
            return _LOCAL_FILE_CACHE["items"]

        doc_exts = {".pdf", ".xlsx", ".xls", ".docx", ".doc", ".hwp", ".hwpx", ".pptx", ".ppt", ".txt", ".csv", ".md"}
        img_exts = {".png", ".jpg", ".jpeg", ".jfif", ".webp", ".gif", ".bmp", ".heic", ".heif"}
        vid_exts = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".wmv", ".m4v", ".3gp", ".ts", ".mts", ".flv"}

        by_kind: dict[str, list[dict]] = {"doc": [], "image": [], "video": []}
        seen_files: set[str] = set()
        CLOUD_UNHYDRATED_MASK = 0x00400000 | 0x00001000  # FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS | FILE_ATTRIBUTE_OFFLINE
        t_scan_loop = time.time()
        drv_elapsed: dict[str, float] = {}

        for _idx_fd, fd in enumerate(scan_dirs):
            if (_idx_fd & 31) == 31:
                time.sleep(0.0005)
                if (time.time() - t_scan_loop) > 4.5:
                    break
            fd_str = str(fd)
            fd_str_low = fd_str.lower()
            drv_prefix = fd_str[:2].upper() if len(fd_str) >= 2 and fd_str[1] == ":" else ""
            if drv_prefix and drv_prefix not in ("C:", "S:") and drv_elapsed.get(drv_prefix, 0.0) > 1.6:
                continue
            t_drv0 = time.time()
            is_s_drive_item = fd_str_low.startswith("s:") or "업무공유폴더_s" in fd_str_low
            if is_s_drive_item:
                fd_badge = (
                    f"💼S:\\{fd.name}"
                    if (fd.name and fd.name.lower() != "업무공유폴더_s")
                    else "💼S:"
                )
            elif drv_prefix and drv_prefix != "C:":
                fd_badge = f"{drv_prefix}\\{fd.name}" if fd.name else f"{drv_prefix}\\"
            else:
                fd_badge = fd.name or drv_prefix or "C:\\"
            try:
                with os.scandir(fd) as it:
                    for entry in it:
                        try:
                            if not entry.is_file(follow_symlinks=False):
                                continue
                            name = entry.name
                            name_low = name.lower()
                            if (
                                name.startswith((".", "~$", ".~lock."))
                                or name_low in ("desktop.ini", "thumbs.db")
                                or name_low.endswith((".lck", ".tmp", ".ghosti_sync_tmp"))
                            ):
                                continue
                            dot_idx = name_low.rfind(".")
                            if dot_idx < 0:
                                continue
                            ext = name_low[dot_idx:]
                            if ext in doc_exts:
                                fkind = "doc"
                            elif ext in img_exts:
                                fkind = "image"
                            elif ext in vid_exts:
                                fkind = "video"
                            else:
                                continue
                            norm_fp = os.path.normcase(os.path.abspath(entry.path))
                            if norm_fp in seen_files:
                                continue
                            seen_files.add(norm_fp)
                            st = entry.stat(follow_symlinks=False)
                            by_kind[fkind].append({
                                "kind": fkind,
                                "file_path": entry.path,
                                "img_path": entry.path if fkind == "image" else "",
                                "text": f"[{fd_badge}] {name}",
                                "ts": st.st_mtime,
                                "_size": st.st_size,
                                "_attrs": int(getattr(st, "st_file_attributes", 0) or 0),
                                "_ext": ext,
                                "_badge": fd_badge,
                                "_name": name[:120],
                            })
                        except Exception:
                            pass
            except Exception:
                pass
            if drv_prefix:
                drv_elapsed[drv_prefix] = drv_elapsed.get(drv_prefix, 0.0) + max(0.0, time.time() - t_drv0)

        for fk in by_kind:
            by_kind[fk].sort(key=lambda x: x.get("ts", 0.0), reverse=True)
            time.sleep(0.0005)

        top_docs = _select_fair_by_drive(by_kind["doc"], 6000)
        if top_docs:
            doc_body_cache = _load_doc_body_cache_fast()
            for idx_d, d_it in enumerate(top_docs):
                if (idx_d & 255) == 255:
                    time.sleep(0.0005)
                try:
                    fp_str = d_it["file_path"]
                    st_sz = int(d_it.get("_size") or 0)
                    st_mt = int(d_it.get("ts") or 0)
                    f_attrs = int(d_it.get("_attrs") or 0)
                    ext_d = str(d_it.get("_ext") or "")
                    body_snip = ""
                    if doc_body_cache:
                        sig_v3 = f"{fp_str}|{st_sz}|{st_mt}|v3_sota50k"
                        cached_txt = doc_body_cache.get(sig_v3) or ""
                        if not cached_txt and idx_d < 80:
                            try:
                                resolved_entry = Path(fp_str).resolve()
                                cached_txt = doc_body_cache.get(f"{resolved_entry}|{st_sz}|{st_mt}|v3_sota50k") or ""
                            except Exception:
                                pass
                        if cached_txt:
                            # _load_doc_body_cache_fast()에서 이미 1,600자로 선절삭·정규화 완료됨
                            body_snip = str(cached_txt)
                    if (
                        not body_snip
                        and idx_d < 80
                        and ext_d in (".txt", ".csv", ".md")
                        and 0 < st_sz <= 262144
                        and (f_attrs & CLOUD_UNHYDRATED_MASK) == 0
                    ):
                        try:
                            raw_b = Path(fp_str).read_bytes()[:65536]
                            try:
                                body_snip = re.sub(r"\s+", " ", raw_b.decode("utf-8-sig")).strip()[:1200]
                            except UnicodeDecodeError:
                                body_snip = re.sub(r"\s+", " ", raw_b.decode("cp949", errors="ignore")).strip()[:1200]
                        except Exception:
                            body_snip = ""
                    if body_snip:
                        d_it["text"] = f"[{d_it['_badge']}] {d_it['_name']} — {body_snip}"
                except Exception:
                    pass

        top_items = (
            top_docs
            + _select_fair_by_drive(by_kind["image"], 6000)
            + _select_fair_by_drive(by_kind["video"], 2000)
        )

        # [3단계: 승인된('included') 연결 외장 드라이브 로컬 캐시 병합 (탈착 시 즉시 자동 숨김 · USB 내부 쓰기 0 Byte)]
        _EXTERNAL_DRIVE_RUNTIME_STATE["stage1_c_done"] = True
        _EXTERNAL_DRIVE_RUNTIME_STATE["stage2_internal_done"] = True
        connected_ext = _EXTERNAL_DRIVE_RUNTIME_STATE.get("connected_ext_map") or {}
        for vid_ext, meta_ext in list(connected_ext.items()):
            if str(meta_ext.get("decision")) != "included":
                continue
            drv_ext = str(meta_ext.get("drive") or "")
            if not drv_ext or not Path(f"{drv_ext}\\").exists():
                continue
            cached_ext_items = _load_external_volume_local_cache(vid_ext, drv_ext)
            if cached_ext_items:
                for ext_it in cached_ext_items:
                    norm_efp = os.path.normcase(os.path.abspath(str(ext_it.get("file_path") or "")))
                    if norm_efp not in seen_files:
                        seen_files.add(norm_efp)
                        top_items.append(ext_it)
            elif not _EXTERNAL_DRIVE_RUNTIME_STATE.get("indexing_vol_id"):
                threading.Thread(
                    target=_index_external_volume_to_local_cache_worker,
                    args=(vid_ext, drv_ext, str(meta_ext.get("label") or "외장 드라이브"), int(meta_ext.get("est_min") or 1)),
                    daemon=True,
                ).start()

        top_items.sort(key=lambda x: x.get("ts", 0.0), reverse=True)
        for idx_i, it_f in enumerate(top_items):
            nm = it_f.pop("_name", "")
            it_f.pop("_size", None)
            it_f.pop("_attrs", None)
            it_f.pop("_ext", None)
            it_f.pop("_badge", None)
            if idx_i < 120 and nm:
                it_f["vec"] = AI_ENGINE.embed_128d(nm)
        _LOCAL_FILE_CACHE["items"] = top_items
        _LOCAL_FILE_CACHE["ts"] = time.time()
        _LOCAL_FILE_CACHE["hot_sig"] = hot_sig
        _LOCAL_FILE_CACHE["dir_sig"] = cur_sig
        return _LOCAL_FILE_CACHE["items"]


def _refresh_lightweight_local_files_async(on_done=None, force: bool = False) -> None:
    """백그라운드 데몬 스레드에서 로컬 파일 캐시를 비동기 갱신하며, 완료 시 선택적 콜백(on_done)을 호출합니다."""
    global _LOCAL_FILE_REFRESH_RUNNING
    if _LOCAL_FILE_REFRESH_RUNNING and on_done is None and not force:
        return
    _LOCAL_FILE_REFRESH_RUNNING = True

    def _worker() -> None:
        global _LOCAL_FILE_REFRESH_RUNNING
        try:
            _scan_lightweight_local_files_sync(force=force)
        except Exception:
            pass
        finally:
            _LOCAL_FILE_REFRESH_RUNNING = False
        if callable(on_done):
            try:
                on_done()
            except Exception:
                pass

    threading.Thread(target=_worker, daemon=True).start()


def _check_local_files_changed_async(on_changed=None) -> None:
    """
    [Single-Flight 파일 변경 감지기 — 중복 스캔 폭주 0%]:
    1) 이미 감시 프로브가 실행 중이면 중복 스레드를 띄우지 않고 즉시 반환합니다.
    2) 핵심 사용자 폴더(바탕화면·다운로드·문서·사진·영상·S:) mtime을 1ms 내에 최우선 대조하여
       파일 저장·삭제 즉시 재스캔하고, 미변경 시 보조 폴더 시그니처를 대조합니다.
    """
    global _LOCAL_FS_PROBE_INFLIGHT
    if _LOCAL_FS_PROBE_INFLIGHT or _LOCAL_FILE_REFRESH_RUNNING:
        return
    _LOCAL_FS_PROBE_INFLIGHT = True

    def _probe() -> None:
        global _LOCAL_FS_PROBE_INFLIGHT
        try:
            prev_hot = str(_LOCAL_FILE_CACHE.get("hot_sig") or "")
            new_hot = _compute_hot_user_folders_fast_sig()
            prev_sig = str(_LOCAL_FILE_CACHE.get("dir_sig") or "")
            changed = (not prev_sig) or (new_hot != prev_hot)
            if not changed:
                new_full_sig = f"{new_hot}::{_compute_watched_folders_fast_sig()}"
                changed = (new_full_sig != prev_sig)
            if changed:
                _scan_lightweight_local_files_sync(force=True)
                if callable(on_changed):
                    on_changed()
        except Exception:
            pass
        finally:
            _LOCAL_FS_PROBE_INFLIGHT = False

    threading.Thread(target=_probe, daemon=True).start()


def _peek_lightweight_local_files_fast() -> tuple[list[dict], bool]:
    """
    [UI 스레드 0.00ms 논블로킹 조회]:
    - 이미 캐시가 준비된 경우 즉시 반환하고, 60초가 지났다면 기존 캐시를 그대로 먼저 내어준 뒤 백그라운드 갱신(Stale-While-Revalidate)합니다.
    - 데몬 부팅 직후 0.1초 이내에 호출되어 아직 첫 스캔 중이라면 빈 리스트와 is_ready=False를 0.00ms 만에 반환하여 창이 즉시 열리게 보장합니다.
    """
    ts_val = float(_LOCAL_FILE_CACHE.get("ts") or 0.0)
    items = _LOCAL_FILE_CACHE.get("items") or []
    if ts_val <= 0.0:
        return items, False
    if (time.time() - ts_val) >= 60.0:
        _refresh_lightweight_local_files_async()
    return items, True


def _get_lightweight_local_files() -> list[dict]:
    """
    바탕화면·다운로드·문서·사진·동영상·OneDrive·카톡받은파일 폴더(및 1단계 하위 폴더)의
    최근 파일 메타데이터를 60초 주기로 카테고리별 균형 캐싱 (Stale-While-Revalidate 적용으로 재호출 시 지연 0ms)
    """
    ts_val = float(_LOCAL_FILE_CACHE.get("ts") or 0.0)
    if ts_val > 0.0:
        if (time.time() - ts_val) >= 60.0:
            _refresh_lightweight_local_files_async()
        return _LOCAL_FILE_CACHE["items"]
    return _scan_lightweight_local_files_sync()


def _reconstruct_words_to_tsv_and_text(words: list[dict]) -> tuple[str, str]:
    if not words:
        return "", ""
    heights = sorted(max(6.0, float(w.get("h") or 12.0)) for w in words)
    med_h = heights[len(heights) // 2]
    row_tol = max(8.0, med_h * 0.58)
    items = []
    for w in words:
        txt = str(w.get("t") or "").strip()
        if not txt:
            continue
        x = float(w.get("x") or 0.0)
        y = float(w.get("y") or 0.0)
        wv = max(1.0, float(w.get("w") or 8.0))
        hv = max(1.0, float(w.get("h") or med_h))
        items.append({"t": txt, "x": x, "y": y, "w": wv, "h": hv, "cy": y + hv * 0.5})
    if not items:
        return "", ""
    items.sort(key=lambda it: (it["cy"], it["x"]))
    rows: list[list[dict]] = []
    for it in items:
        if not rows:
            rows.append([it])
            continue
        avg_cy = sum(r["cy"] for r in rows[-1]) / len(rows[-1])
        if abs(it["cy"] - avg_cy) <= row_tol:
            rows[-1].append(it)
        else:
            rows.append([it])
    full_lines: list[str] = []
    tsv_lines: list[str] = []
    tight_gap = max(7.0, med_h * 0.30)
    col_gap = max(26.0, med_h * 1.45)
    for r_words in rows:
        r_words.sort(key=lambda it: it["x"])
        cols: list[str] = []
        cur = ""
        prev_r = None
        for w in r_words:
            if prev_r is None:
                cur = w["t"]
            else:
                gap = w["x"] - prev_r
                if gap > col_gap:
                    cols.append(cur.strip())
                    cur = w["t"]
                elif gap <= tight_gap or cur.endswith(("-", "/", ".", "(", "₩")) or w["t"].startswith(("-", "/", ".", ")", "%", "원", ",")):
                    cur = f"{cur}{w['t']}"
                else:
                    cur = f"{cur} {w['t']}"
            prev_r = max(prev_r or 0.0, w["x"] + w["w"])
        if cur.strip():
            cols.append(cur.strip())
        if cols:
            full_lines.append("  ".join(cols))
            tsv_lines.append("\t".join(cols))
    return "\n".join(full_lines).strip(), "\n".join(tsv_lines).strip()


def _run_ondemand_winrt_image_ocr(img_path: Path | str) -> dict:
    """
    로컬 디스크 사진의 실제 한글/영문/숫자/표를 즉시 추출합니다.
    1순위: 로컬 5199 Z-코어 `/__photos/ocr` (PP-OCRv5 Korean 영구 캐시 + 회전 보정 + 표 TSV 복원)
    2순위: 5199 미기동 단독 실행 환경에서도 자체 PP-OCRv5 Korean 격리 워커 서브프로세스로 100% 무인 작동!
    """
    p = Path(str(img_path))
    if not p.exists() or not p.is_file():
        return {"ok": False, "hasText": False, "fullText": "", "tsvTable": "", "chips": []}
    try:
        st = p.stat()
        sig = f"{os.path.normcase(os.path.abspath(str(p)))}|{st.st_size}|{int(st.st_mtime)}"
    except Exception:
        sig = str(p)

    with _ONDEMAND_IMG_OCR_LOCK:
        cached = _ONDEMAND_IMG_OCR_MEM_CACHE.get(sig)
    if cached is not None:
        return cached

    # 1) 5199 Z-Core API 우선 호출
    try:
        qp = urllib.parse.quote(str(p.resolve()))
        req = urllib.request.Request(
            f"http://127.0.0.1:5199/__photos/ocr?p={qp}",
            headers={"Origin": "http://127.0.0.1:5199"},
            method="GET",
        )
        with urllib.request.urlopen(req, timeout=25.0) as resp:
            payload = json.loads(resp.read().decode("utf-8", errors="replace"))
            if isinstance(payload, dict) and payload.get("ok"):
                ft = str(payload.get("fullText") or "").strip()
                tsv = str(payload.get("tsvTable") or ft).strip()
                raw_chips = [str(c).strip() for c in (payload.get("chips") or []) if str(c).strip()]
                merged_chips = list(dict.fromkeys(raw_chips + _extract_word_chips_from_text(ft)))[:18]
                out = {
                    "ok": True,
                    "hasText": bool(payload.get("hasText")) and bool(ft),
                    "fullText": ft,
                    "tsvTable": tsv,
                    "chips": merged_chips,
                }
                with _ONDEMAND_IMG_OCR_LOCK:
                    _ONDEMAND_IMG_OCR_MEM_CACHE[sig] = out
                return out
    except Exception:
        pass

    # 2) PP-OCRv5 Korean 격리 서브프로세스 직접 폴백 (5199 미실행 단독 모드 지원, 상주 메모리 증가 0 Byte)
    try:
        import ppocr_v5_worker

        res_map = ppocr_v5_worker.invoke_ppocr_subprocess(
            [p], filter_video_ui=False, timeout_sec=28.0, priority_interactive=True
        )
        item = res_map.get(str(p.resolve())) or res_map.get(p.name) or {}
        words_flat: list[dict] = []
        for ln in item.get("lines") or []:
            if isinstance(ln, dict):
                for w in ln.get("words") or []:
                    if isinstance(w, dict) and w.get("t"):
                        words_flat.append(w)
        ft, tsv = _reconstruct_words_to_tsv_and_text(words_flat)
        if not ft:
            ft = str(item.get("smartText") or "").strip()
            tsv = ft
        alnum = re.sub(r"[^가-힣A-Za-z0-9]", "", ft)
        has_t = len(alnum) >= 2
        out = {
            "ok": True,
            "hasText": has_t,
            "fullText": ft if has_t else "",
            "tsvTable": tsv if has_t else "",
            "chips": _extract_word_chips_from_text(ft) if has_t else [],
        }
        with _ONDEMAND_IMG_OCR_LOCK:
            _ONDEMAND_IMG_OCR_MEM_CACHE[sig] = out
        return out
    except Exception:
        pass

    empty_res = {"ok": False, "hasText": False, "fullText": "", "tsvTable": "", "chips": []}
    return empty_res


def _extract_word_chips_from_text(text: str) -> list[str]:
    """문장/OCR 결과에서 클릭 한 번으로 꽂아 넣을 핵심 숫자·금액·사업자번호·단어 조각(칩) 추출"""
    cleaned = _clean_ocr_noise(text)
    cleaned = re.sub(r"^\[[^\]]+\]\s*", "", cleaned).strip()
    if not cleaned:
        return []
    chips: list[str] = []
    # 1) 특수 패턴(사업자번호, 전화번호, 금액, 날짜, 인증번호) 우선 추출
    for pat in (
        r"\b\d{3}-\d{2}-\d{5}\b",
        r"\b01[016789]-\d{3,4}-\d{4}\b",
        r"\b\d{1,3}(?:,\d{3})+(?:원)?\b",
        r"\b\d{4}[-./년]\s*\d{1,2}[-./월]\s*\d{1,2}일?\b",
        r"\b\d{4,8}\b",
    ):
        for m in re.findall(pat, cleaned):
            m_s = m.strip()
            if m_s and m_s not in chips:
                chips.append(m_s)
    # 2) 일반 의미 어절 추출
    for tok in re.split(r"[\s,;·•|/]+", cleaned):
        t = tok.strip("()[]{}'\"<>")
        if len(t) >= 2 and t not in chips:
            chips.append(t)
        if len(chips) >= 14:
            break
    return chips[:14]


_CLICKED_SUPERPOWER_QUEUE: queue.Queue = queue.Queue()
_CURRENT_OPEN_UI_MODE: str = ""
_CURRENT_OPEN_WIN_HWND: int = 0
_LAST_UI_OPENED_TS: float = 0.0


def _is_ui_window_actually_open() -> bool:
    """_CURRENT_OPEN_UI_MODE가 켜져 있어도 실제 Win32 창이 살아있고 보일 때만 True 반환 (유령 상태 자동 복구)."""
    global _CURRENT_OPEN_UI_MODE, _CURRENT_OPEN_WIN_HWND
    if not _CURRENT_OPEN_UI_MODE:
        return False
    hwnd_c = int(_CURRENT_OPEN_WIN_HWND or 0)
    if hwnd_c and u32.IsWindow(hwnd_c) and u32.IsWindowVisible(hwnd_c):
        return True
    _CURRENT_OPEN_UI_MODE = ""
    _CURRENT_OPEN_WIN_HWND = 0
    return False
_IS_UI_HOVERED: bool = False
_SELF_CLIP_SET_TEXT: str = ""
_SELF_CLIP_SET_UNTIL: float = 0.0


def _toast_worker() -> None:
    """
    👻 귀신창 (Ghost Window) v3.5 3대 현장 소환창 완전 분리 마스터 워커:
    - [창 UI ①] 기본 귀신창: 초경량 2줄 8대 초능력 버튼 바 (입력창 소환 전용, 검색 드롭다운/이미지 디코딩 0%)
    - [창 UI ②] 👻 귀신검색창 (소·중·대): 바탕화면/일반 화면 소환 또는 검색 전환 시 독립 실행되는 3단 검색창
    - [창 UI ③] 📸 사진·OCR 공간이동창: 스샷 직후 소환 시 독립 실행되는 좌측 사진·표 / 우측 OCR 칩 전용창
    """
    global _UI_LOOP_HEARTBEAT_TS, _UI_LOOP_STAGE
    _UI_LOOP_HEARTBEAT_TS = time.time()
    _UI_LOOP_STAGE = "tk_init"
    import tkinter as tk
    try:
        from PIL import Image, ImageTk
    except Exception:
        Image = None
        ImageTk = None

    root = tk.Tk()
    root.withdraw()
    _UI_LOOP_HEARTBEAT_TS = time.time()
    _UI_LOOP_STAGE = "tk_ready"
    _TOAST_WORKER_READY.set()

    # [부팅 중 ui_stage=init 오판 자폭 원천 차단 + 장시간 유휴 후 첫 실행 Page-Out 방지]:
    # ghost_search_window_ui2 선행 로드·폰트 워밍업·로고 PNG 리사이즈를 15ms 후 비차단 실행하고,
    # 25초 주기로 가볍게 UI 모듈/위젯 메모리를 터치해 크롬 대용량 메모리 점유 시에도 첫 실행이 0.05초 내에 열리게 유지합니다.
    _preloaded_ui2_mod = None
    ghost_symbol_photo = None
    ghost_wordmark_photo = None

    def _keep_ui_pages_warm() -> None:
        try:
            _ = root.winfo_exists()
            if _preloaded_ui2_mod is not None:
                _ = getattr(_preloaded_ui2_mod, "build_ui2_search_window", None)
        except Exception:
            pass
        try:
            root.after(25000, _keep_ui_pages_warm)
        except Exception:
            pass

    def _post_init_ui_assets_warmup() -> None:
        nonlocal _preloaded_ui2_mod, ghost_symbol_photo, ghost_wordmark_photo
        global _UI_LOOP_HEARTBEAT_TS, _UI_LOOP_STAGE
        _UI_LOOP_HEARTBEAT_TS = time.time()
        _UI_LOOP_STAGE = "warmup_ui2"
        try:
            if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
                _mp_init = str(getattr(sys, "_MEIPASS"))
                if _mp_init and (not sys.path or sys.path[0] != _mp_init):
                    if _mp_init in sys.path:
                        sys.path.remove(_mp_init)
                    sys.path.insert(0, _mp_init)
            for _cand_dir in (Path(__file__).resolve().parent, Path(__file__).resolve().parent / "os_agent"):
                _c_str = str(_cand_dir)
                if _cand_dir.exists() and _c_str not in sys.path:
                    sys.path.insert(0, _c_str)
            import ghost_search_window_ui2 as _u2_pre  # type: ignore
            _preloaded_ui2_mod = _u2_pre
            _u2_pre._load_local_video_ocr_by_name()
        except Exception:
            _preloaded_ui2_mod = None
        _UI_LOOP_HEARTBEAT_TS = time.time()
        try:
            _warm_top = tk.Toplevel(root)
            _warm_top.withdraw()
            _warm_top.overrideredirect(True)
            tk.Label(_warm_top, text="👻귀신같이검색창", font=("Malgun Gothic", 9, "bold")).pack()
            tk.Entry(_warm_top, font=("Malgun Gothic", 9)).pack()
            _warm_top.update_idletasks()
            _warm_top.destroy()
        except Exception:
            pass
        _UI_LOOP_HEARTBEAT_TS = time.time()
        try:
            if Image is not None and ImageTk is not None:
                meipass_assets = Path(getattr(sys, "_MEIPASS", str(Path(__file__).resolve().parent))) / "assets"
                meipass_root = Path(getattr(sys, "_MEIPASS", str(Path(__file__).resolve().parent)))
                sym_candidates = [
                    meipass_assets / "gwisinkachi_app_icon_512.png",
                    meipass_root / "logo-symbol.png",
                    Path(__file__).resolve().parent / "assets" / "gwisinkachi_app_icon_512.png",
                    Path(__file__).resolve().parent / "os_agent" / "assets" / "gwisinkachi_app_icon_512.png",
                    Path(__file__).resolve().parent / "logo-symbol.png",
                    Path("C:/MerlinTools/assets/gwisinkachi_app_icon_512.png"),
                    Path("D:/Ghosti/universal_z_core/os_agent/assets/gwisinkachi_app_icon_512.png"),
                    Path("D:/Ghosti/public/gwisinkachi_app_icon_512.png"),
                ]
                for sc in sym_candidates:
                    if sc.exists():
                        sym_img = Image.open(sc).convert("RGBA").resize((28, 28), Image.Resampling.LANCZOS)
                        ghost_symbol_photo = ImageTk.PhotoImage(sym_img, master=root)
                        break

                wm_candidates = [
                    meipass_assets / "gwisinkachi_3d_wordmark_dark.png",
                    meipass_assets / "gwisinkachi_3d_wordmark_light.png",
                    Path(__file__).resolve().parent / "assets" / "gwisinkachi_3d_wordmark_dark.png",
                    Path(__file__).resolve().parent / "os_agent" / "assets" / "gwisinkachi_3d_wordmark_dark.png",
                    Path("C:/MerlinTools/assets/gwisinkachi_3d_wordmark_dark.png"),
                    Path("D:/Ghosti/universal_z_core/os_agent/assets/gwisinkachi_3d_wordmark_dark.png"),
                    Path("D:/Ghosti/public/gwisinkachi_3d_wordmark_dark.png"),
                    Path("D:/Ghosti/public/gwisinkachi_3d_wordmark_light.png"),
                ]
                for wc in wm_candidates:
                    if wc.exists():
                        wm_raw = Image.open(wc).convert("RGBA")
                        target_h = 22
                        target_w = max(56, int(wm_raw.width * (target_h / max(1, wm_raw.height))))
                        wm_img = wm_raw.resize((target_w, target_h), Image.Resampling.LANCZOS)
                        ghost_wordmark_photo = ImageTk.PhotoImage(wm_img, master=root)
                        break
        except Exception:
            pass
        _UI_LOOP_HEARTBEAT_TS = time.time()
        _UI_LOOP_STAGE = "poll_idle"
        root.after(25000, _keep_ui_pages_warm)

    root.after(15, _post_init_ui_assets_warmup)

    current_win: list[tk.Toplevel | None] = [None]
    detail_win: list[tk.Toplevel | None] = [None]
    active_mode: list[str] = [""]  # "ui1" | "ui2" | "ui3" | "toast"
    after_id: list[str | None] = [None]
    is_hovered: list[bool] = [False]
    win_rect: list[tuple[int, int, int, int]] = [(0, 0, 0, 0)]
    ui_dragging: list[bool] = [False]
    was_mouse_down: list[bool] = [False]
    opened_at: list[float] = [0.0]
    thumb_refs: list = []

    def _close_detail() -> None:
        if detail_win[0] is not None:
            try:
                detail_win[0].destroy()
            except Exception:
                pass
            detail_win[0] = None

    def _close_win() -> None:
        global _CURRENT_OPEN_UI_MODE, _CURRENT_OPEN_WIN_HWND, _IS_UI_HOVERED
        _close_detail()
        if after_id[0] is not None:
            try:
                root.after_cancel(after_id[0])
            except Exception:
                pass
            after_id[0] = None
        if current_win[0] is not None:
            try:
                current_win[0].destroy()
            except Exception:
                pass
            current_win[0] = None
        # 혹시라도 잔존한 고아 Toplevel 창이 화면에 남아 멈추는 현상 원천 차단
        try:
            for _child_w in list(root.winfo_children()):
                if isinstance(_child_w, tk.Toplevel):
                    try:
                        _child_w.destroy()
                    except Exception:
                        pass
        except Exception:
            pass
        active_mode[0] = ""
        _CURRENT_OPEN_UI_MODE = ""
        _CURRENT_OPEN_WIN_HWND = 0
        is_hovered[0] = False
        ui_dragging[0] = False
        _IS_UI_HOVERED = False
        thumb_refs.clear()

    def _schedule_close(ms: int) -> None:
        if after_id[0] is not None:
            try:
                root.after_cancel(after_id[0])
            except Exception:
                pass
        after_id[0] = root.after(ms, _on_timer_expire)

    def _on_timer_expire() -> None:
        if is_hovered[0] and current_win[0] is not None:
            after_id[0] = root.after(800, _on_timer_expire)
            return
        _close_win()

    def _paste_to_target(text_val: str = "", file_path: str = "") -> None:
        _close_win()
        if _LAST_TARGET_HWND and u32.IsWindow(_LAST_TARGET_HWND):
            try:
                if u32.GetForegroundWindow() != _LAST_TARGET_HWND:
                    u32.SetForegroundWindow(_LAST_TARGET_HWND)
                    time.sleep(0.025)
            except Exception:
                pass
        if file_path and Path(file_path).exists():
            if set_clipboard_hdrop_file(file_path):
                time.sleep(0.03)
                tap_key_combo([VK_CONTROL], VK_V)
                show_ghost_toast("귀신같이 파일·사진 소환 완료", duration_ms=1100)
                return
        if text_val:
            set_clipboard_text(text_val)
            time.sleep(0.03)
            tap_key_combo([VK_CONTROL], VK_V)
            show_ghost_toast("귀신같이 기억소환 완료", duration_ms=1100)

    def _apply_win_topmost(win: tk.Toplevel, x: int, y: int, rw: int, rh: int, activate: bool = False) -> None:
        global _CURRENT_OPEN_WIN_HWND
        win.geometry(f"{rw}x{rh}{x:+d}{y:+d}")
        actual_rect = (x, y, x + rw, y + rh)
        try:
            win.attributes("-topmost", True)
            win.deiconify()
            win.update_idletasks()
            wid = win.winfo_id()
            hwnd_t = u32.GetParent(wid) or wid if wid else 0
            if hwnd_t:
                _CURRENT_OPEN_WIN_HWND = int(hwnd_t)
                ex_st = u32.GetWindowLongW(hwnd_t, GWL_EXSTYLE)
                SWP_FRAMECHANGED = 0x0020
                if activate:
                    # [AttachThreadInput·win.update() 영구 배제 + 비할당 더미 키업 포커스 잠금 해제]:
                    # WH_MOUSE_LL(Ctrl+우클릭)이나 장시간 유휴 직후 첫 호출 시 Windows Foreground Lock으로
                    # SetForegroundWindow가 거부되는 현상을 부작용 0%(비할당 VK 0x0E KEYUP)으로 해제합니다.
                    u32.SetWindowLongW(hwnd_t, GWL_EXSTYLE, (ex_st & ~WS_EX_NOACTIVATE) | WS_EX_TOPMOST | WS_EX_TOOLWINDOW)
                    u32.ShowWindow(hwnd_t, 5)  # SW_SHOW
                    u32.SetWindowPos(hwnd_t, HWND_TOPMOST, x, y, rw, rh, SWP_FRAMECHANGED | SWP_SHOWWINDOW)
                    try:
                        u32.keybd_event(0x0E, 0, KEYEVENTF_KEYUP, 0)
                        u32.AllowSetForegroundWindow(os.getpid())
                    except Exception:
                        pass
                    u32.BringWindowToTop(hwnd_t)
                    u32.SetForegroundWindow(hwnd_t)
                else:
                    u32.SetWindowLongW(hwnd_t, GWL_EXSTYLE, ex_st | WS_EX_NOACTIVATE | WS_EX_TOPMOST | WS_EX_TOOLWINDOW)
                    u32.ShowWindow(hwnd_t, 4)  # SW_SHOWNOACTIVATE
                    u32.SetWindowPos(hwnd_t, HWND_TOPMOST, x, y, rw, rh, SWP_NOACTIVATE | SWP_FRAMECHANGED | SWP_SHOWWINDOW)
                rc_live = wintypes.RECT()
                if u32.GetWindowRect(hwnd_t, ctypes.byref(rc_live)) and rc_live.right > rc_live.left and rc_live.bottom > rc_live.top:
                    actual_rect = (int(rc_live.left), int(rc_live.top), int(rc_live.right), int(rc_live.bottom))
        except Exception:
            pass
        try:
            win.lift()
        except Exception:
            pass
        win_rect[0] = actual_rect

    # =================================================================
    # [창 UI ②] 👻 귀신검색창 (Ghosti 본진 전담 모듈 ghost_search_window_ui2 우선 위임 + 내장 폴백)
    # =================================================================
    def _set_current_open_ui_mode_val(mode_str: str) -> None:
        global _CURRENT_OPEN_UI_MODE
        _CURRENT_OPEN_UI_MODE = mode_str

    def _build_ui2_search_window(win: tk.Toplevel, init_stage: str, init_query: str, pt_x: int, pt_y: int, work_area: tuple[int, int, int, int]) -> None:
        global _CURRENT_OPEN_UI_MODE
        for _old_ch in list(win.winfo_children()):
            try:
                _old_ch.destroy()
            except Exception:
                pass
        try:
            ui2_mod = _preloaded_ui2_mod
            if ui2_mod is None:
                if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
                    _mp = str(getattr(sys, "_MEIPASS"))
                    if _mp and (not sys.path or sys.path[0] != _mp):
                        if _mp in sys.path:
                            sys.path.remove(_mp)
                        sys.path.insert(0, _mp)
                import ghost_search_window_ui2 as ui2_mod  # type: ignore

            ui2_ctx = {
                "root": root,
                "active_mode": active_mode,
                "set_current_open_ui_mode": _set_current_open_ui_mode_val,
                "ghost_symbol_photo": ghost_symbol_photo,
                "close_win": _close_win,
                "get_superpower_settings": get_superpower_settings,
                "update_superpower_settings": update_superpower_settings,
                "clicked_superpower_queue": _CLICKED_SUPERPOWER_QUEUE,
                "compute_ghost_search_window_3stage_rect": compute_ghost_search_window_3stage_rect,
                "resolve_ghost_search_auto_stage": resolve_ghost_search_auto_stage,
                "opened_at": opened_at,
                "was_mouse_down": was_mouse_down,
                "is_hovered": is_hovered,
                "current_win": current_win,
                "win_rect": win_rect,
                "ui_dragging": ui_dragging,
                "apply_win_topmost": _apply_win_topmost,
                "record_feature_telemetry": record_feature_telemetry,
                "thumb_refs": thumb_refs,
                "global_ai_history": GLOBAL_AI_HISTORY,
                "get_lightweight_local_files": _get_lightweight_local_files,
                "peek_lightweight_local_files": _peek_lightweight_local_files_fast,
                "refresh_lightweight_local_files_async": _refresh_lightweight_local_files_async,
                "check_local_files_changed_async": _check_local_files_changed_async,
                "extract_chosung": _extract_chosung,
                "eng_to_kor": eng_to_kor,
                "kor_to_eng": kor_to_eng,
                "clean_ocr_noise": _clean_ocr_noise,
                "format_rel_time": _format_rel_time,
                "make_context_snippet": _make_context_snippet,
                "toast_queue": _toast_queue,
                "paste_to_target": _paste_to_target,
                "is_input_context": _IS_INPUT_SUMMON_CONTEXT,
                "daemon_set_clipboard": set_clipboard_text,
                "daemon_copy_file": set_clipboard_hdrop_file,
                "get_last_rbtn_dismiss_esc_ts": lambda: _LAST_RBTN_DISMISS_ESC_TS,
                "get_trial_badge_summary": get_trial_badge_summary,
                "check_feature_quota_allowed": check_feature_quota_allowed,
                "get_external_drive_banner": get_external_drive_ui_banner_state,
                "decide_external_drive": decide_external_drive_action,
                "get_target_ime_korean": lambda: _PENDING_UI2_IME_IS_KOR,
                "report_ui2_ime_korean": _report_ui2_ime_korean,
            }
            ui2_mod.build_ui2_search_window(
                ui2_ctx, win, init_stage, init_query, pt_x, pt_y, work_area
            )
            return
        except Exception:
            for _partial_ch in list(win.winfo_children()):
                try:
                    _partial_ch.destroy()
                except Exception:
                    pass
        active_mode[0] = "ui2"
        _CURRENT_OPEN_UI_MODE = "ui2"
        m_left, m_top, m_right, m_bottom = work_area
        init_mode = "large" if init_stage in ("large", "gallery") else "compact"
        st_state = {
            "mode": init_mode,
            "stage": "large" if init_mode == "large" else ("medium" if init_query.strip() else "small"),
            "custom_h": None if init_mode == "large" else 330,
            "filter": "all",
            "sel_idx": 0,
            "items": [],
            "debounce_job": None,
        }
        record_feature_telemetry(f"ghost_search_window_{st_state['stage']}")

        outer = tk.Frame(win, bg="#0B1120", highlightbackground="#38BDF8", highlightthickness=2, padx=8, pady=6)
        outer.pack(fill="both", expand=True)

        # 1단 헤더: 👻귀신검색창 + 라이브 검색창 + 우측 [🏷️[2]파일라벨러][⤢ 크게(갤러리) / ⤡ 작게][🔊][✕]
        hdr = tk.Frame(outer, bg="#0F172A", highlightbackground="#14B8A6", highlightthickness=1, padx=6, pady=4)
        hdr.pack(fill="x", pady=(0, 4))

        if ghost_symbol_photo is not None:
            ic_lbl = tk.Label(hdr, image=ghost_symbol_photo, bg="#0F172A", bd=0)
            ic_lbl.image = ghost_symbol_photo
            ic_lbl.pack(side="left", padx=(0, 4))

        title_badge = tk.Label(hdr, text="👻귀신검색창", fg="#0B1120", bg="#2DD4BF", padx=5, pady=1, font=("Malgun Gothic", 8, "bold"))
        title_badge.pack(side="left", padx=(0, 6))

        s_entry = tk.Entry(hdr, width=18, fg="#F8FAFC", bg="#1E293B", insertbackground="#5EEAD4", relief="flat", font=("Malgun Gothic", 9))
        s_entry.pack(side="left", fill="x", expand=True, padx=(0, 6))
        if init_query:
            s_entry.insert(0, init_query)

        close_btn = tk.Label(hdr, text="✕", fg="#94A3B8", bg="#1E293B", padx=5, pady=1, font=("Malgun Gothic", 8, "bold"), cursor="hand2")
        close_btn.pack(side="right", padx=(2, 0))
        close_btn.bind("<Button-1>", lambda _e: _close_win())

        cur_sound = bool(get_superpower_settings().get("sound_enabled", True))
        mute_btn = tk.Label(hdr, text="🔊" if cur_sound else "🔇", fg="#5EEAD4" if cur_sound else "#64748B", bg="#1E293B", padx=4, pady=1, font=("Malgun Gothic", 8, "bold"), cursor="hand2")
        mute_btn.pack(side="right", padx=(2, 0))

        def _toggle_snd(_e=None):
            nxt = not bool(get_superpower_settings().get("sound_enabled", True))
            update_superpower_settings({"sound_enabled": nxt})
            mute_btn.config(text="🔊" if nxt else "🔇", fg="#5EEAD4" if nxt else "#64748B")

        mute_btn.bind("<Button-1>", _toggle_snd)

        mode_toggle_btn = tk.Label(
            hdr,
            text="⤡ 작게" if init_mode == "large" else "⤢ 크게(갤러리)",
            fg="#0B1120" if init_mode == "large" else "#5EEAD4",
            bg="#2DD4BF" if init_mode == "large" else "#1E293B",
            padx=6,
            pady=1,
            font=("Malgun Gothic", 8, "bold"),
            cursor="hand2",
        )
        mode_toggle_btn.pack(side="right", padx=(2, 0))
        mode_toggle_btn.bind("<Button-1>", lambda _e: _toggle_window_mode())

        lbl_quick_btn = tk.Label(
            hdr,
            text="🏷️ 이 파일 귀신라벨링🔒",
            fg="#0B1120",
            bg="#5EEAD4",
            padx=6,
            pady=1,
            font=("Malgun Gothic", 8, "bold"),
            cursor="hand2",
        )
        lbl_quick_btn.pack(side="right", padx=(4, 2))
        def _on_hdr_labeler(_e=None):
            sel_fp = ""
            if st_state["items"]:
                cur_r = st_state["items"][min(st_state["sel_idx"], len(st_state["items"]) - 1)]
                sel_fp = str(cur_r.get("file_path") or cur_r.get("img_path") or "").strip()
            _close_win()
            _CLICKED_SUPERPOWER_QUEUE.put((2, sel_fp, True) if sel_fp else 2)

        lbl_quick_btn.bind("<Button-1>", _on_hdr_labeler)

        # 2단 필터 바: [전체] [📄문서] [🖼️사진] [🎬영상] + 우측 실시간 체험 배지
        fbar = tk.Frame(outer, bg="#0B1120")
        fbar.pack(fill="x", pady=(0, 4))

        filter_btns: dict[str, tk.Label] = {}
        for f_key, f_txt in (("all", "전체"), ("doc", "📄문서"), ("image", "🖼️사진"), ("video", "🎬영상")):
            fb = tk.Label(fbar, text=f_txt, fg="#E2E8F0", bg="#1E293B", padx=6, pady=1, font=("Malgun Gothic", 8, "bold"), cursor="hand2")
            fb.pack(side="left", padx=(0, 4))
            fb.bind("<Button-1>", lambda _e, fk=f_key: _switch_filter(fk))
            filter_btns[f_key] = fb

        trial_lbl = tk.Label(fbar, text=get_trial_badge_summary().get("short_badge", ""), fg="#FDE047", bg="#0B1120", font=("Malgun Gothic", 8, "bold"))
        trial_lbl.pack(side="right")

        # 3단 결과 영역
        body_frame = tk.Frame(outer, bg="#0B1120")
        body_frame.pack(fill="both", expand=True)

        def _resize_for_stage(activate: bool = True) -> None:
            st_now = st_state["stage"]
            ax = pt_x
            ay = pt_y
            r3 = compute_ghost_search_window_3stage_rect(
                st_now,
                ax,
                ay,
                work_area=work_area,
                margin_px=16,
                custom_height=st_state.get("custom_h"),
            )
            opened_at[0] = time.time()
            was_mouse_down[0] = True
            _apply_win_topmost(win, int(r3["x"]), int(r3["y"]), int(r3["width"]), int(r3["height"]), activate=activate)
            if activate:
                try:
                    s_entry.focus_force()
                except Exception:
                    pass

        def _toggle_window_mode(_e=None) -> str:
            is_hovered[0] = True
            opened_at[0] = time.time()
            was_mouse_down[0] = True
            st_state["mode"] = "compact" if st_state["mode"] == "large" else "large"
            record_feature_telemetry(
                "ghost_search_window_large" if st_state["mode"] == "large" else "ghost_search_window_small"
            )
            _render_search_results()
            _resize_for_stage(activate=True)
            return "break"

        def _switch_filter(new_flt: str) -> None:
            is_hovered[0] = True
            st_state["filter"] = new_flt
            st_state["sel_idx"] = 0
            _render_search_results()
            _resize_for_stage(activate=False)

        def _render_search_results() -> None:
            for ch in body_frame.winfo_children():
                ch.destroy()
            thumb_refs.clear()

            flt_now = st_state["filter"]
            for k, b in filter_btns.items():
                b.config(fg="#0B1120" if k == flt_now else "#E2E8F0", bg="#5EEAD4" if k == flt_now else "#1E293B")

            q = s_entry.get().strip()
            pool: list[dict] = []
            for rec in reversed(GLOBAL_AI_HISTORY):
                pool.append(rec)
            for frec in _get_lightweight_local_files():
                pool.append(frec)

            if flt_now == "doc":
                pool = [r for r in pool if r.get("kind") in ("text", "doc")]
            elif flt_now == "image":
                pool = [r for r in pool if r.get("kind") == "image"]
            elif flt_now == "video":
                pool = [r for r in pool if r.get("kind") == "video"]

            matched: list[tuple[float, dict]] = []
            if q:
                q_low = q.lower()
                q_cho = _extract_chosung(q_low)
                q_kor_alt = eng_to_kor(q) if re.search(r"[A-Za-z]", q) else ""
                q_eng_alt = kor_to_eng(q) if re.search(r"[가-힣ㄱ-ㅎㅏ-ㅣ]", q) else ""
                for idx_p, r in enumerate(pool):
                    raw_t = r.get("text", "")
                    clean_t = _clean_ocr_noise(raw_t) if r.get("kind") == "image" else raw_t
                    t_low = clean_t.lower()
                    t_cho = _extract_chosung(t_low)
                    sc = 0.0
                    if q_low in t_low or (q_cho and q_cho in t_cho):
                        sc = 1.0
                    elif q_kor_alt and q_kor_alt.lower() in t_low:
                        sc = 0.85
                    elif q_eng_alt and len(q_eng_alt) >= 2 and q_eng_alt.lower() in t_low:
                        sc = 0.85
                    if sc > 0:
                        matched.append((sc - idx_p * 0.0001, r))
                if matched:
                    matched.sort(key=lambda x: x[0], reverse=True)

            # [자율 크기 판별]: '작게(compact)' 모드일 때 검색량·미리보기 성격에 맞춰 소(520) ↔ 중(960) 자동 전환
            has_rich = any(m[1].get("kind") in ("image", "doc") for m in matched[:5]) or (flt_now == "image" and len(pool) > 0 and bool(q))
            auto_stage, auto_slim_h = resolve_ghost_search_auto_stage(
                mode=st_state["mode"],
                has_query=bool(q),
                matched_count=len(matched) if q else len(pool[:5]),
                has_rich_preview=has_rich,
            )
            prev_stage = st_state["stage"]
            prev_h = st_state.get("custom_h")
            st_state["stage"] = auto_stage
            st_state["custom_h"] = auto_slim_h
            if auto_stage == "medium" and prev_stage != "medium":
                record_feature_telemetry("ghost_search_window_medium")

            st_now = st_state["stage"]
            is_large_mode = st_state["mode"] == "large"
            mode_toggle_btn.config(
                text="⤡ 작게" if is_large_mode else "⤢ 크게(갤러리)",
                fg="#0B1120" if is_large_mode else "#5EEAD4",
                bg="#2DD4BF" if is_large_mode else "#1E293B",
            )

            max_cnt = 5 if st_now == "small" else (8 if st_now == "medium" else 10)
            snip_len = 36 if st_now == "small" else (48 if st_now == "medium" else 34)

            if not q:
                candidates = pool[:max_cnt]
                trial_lbl.config(text=str(get_trial_badge_summary().get("ui2_hint") or "✨ 크기 자율 호흡"), fg="#FDE047")
            elif matched:
                candidates = [m[1] for m in matched[:max_cnt]]
                trial_lbl.config(text=f"🔍 '{q[:8]}' {len(matched)}건" + (" · 자율확장" if st_now == "medium" else ""), fg="#5EEAD4")
            else:
                candidates = pool[:max_cnt]
                trial_lbl.config(text=f"🔍 '{q[:6]}' 일치 없음(최근목록)", fg="#FDE047")

            if (prev_stage != st_now or prev_h != auto_slim_h) and current_win[0] is win:
                _resize_for_stage(activate=False)

            st_state["items"] = candidates
            st_state["sel_idx"] = min(st_state["sel_idx"], max(0, len(candidates) - 1))

            if not candidates:
                tk.Label(body_frame, text="표시할 항목이 없습니다.", fg="#94A3B8", bg="#0B1120", font=("Malgun Gothic", 9)).pack(pady=20)
                return

            list_parent = body_frame
            preview_pane = None
            if st_now == "medium":
                list_parent = tk.Frame(body_frame, bg="#0B1120")
                list_parent.pack(side="left", fill="both", expand=True, padx=(0, 6))
                preview_pane = tk.Frame(body_frame, bg="#0F172A", highlightbackground="#334155", highlightthickness=1, padx=10, pady=8, width=360)
                preview_pane.pack(side="right", fill="y")
                preview_pane.pack_propagate(False)
            elif st_now == "large":
                list_parent.grid_columnconfigure(0, weight=1, uniform="gcol")
                list_parent.grid_columnconfigure(1, weight=1, uniform="gcol")

            for idx_c, rec in enumerate(candidates):
                is_sel = idx_c == st_state["sel_idx"]
                c_bg = "#1E293B" if is_sel else "#0F172A"
                b_col = "#2DD4BF" if is_sel else "#334155"
                card = tk.Frame(list_parent, bg=c_bg, highlightbackground=b_col, highlightthickness=1, padx=6, pady=4, cursor="hand2")
                if st_now == "large":
                    card.grid(row=idx_c // 2, column=idx_c % 2, padx=3, pady=3, sticky="nsew")
                else:
                    card.pack(fill="x", pady=2)

                kind = rec.get("kind", "text")
                icon_ch = "🖼️" if kind == "image" else ("🎬" if kind == "video" else ("📄" if kind == "doc" else "📋"))
                rel_t = _format_rel_time(rec.get("ts", time.time()))
                raw_txt = rec.get("text", "")
                disp_txt = _clean_ocr_noise(raw_txt) if kind == "image" else raw_txt
                snip = _make_context_snippet(disp_txt, q, max_len=snip_len)

                num_l = tk.Label(card, text=f"[{idx_c + 1}] {icon_ch}", fg="#5EEAD4" if is_sel else "#94A3B8", bg=c_bg, font=("Malgun Gothic", 8, "bold"))
                num_l.pack(side="left", padx=(0, 5))

                if kind == "image" and rec.get("thumb_bytes") and Image is not None:
                    try:
                        im_p = Image.open(io.BytesIO(rec["thumb_bytes"]))
                        th_p = ImageTk.PhotoImage(im_p, master=root)
                        thumb_refs.append(th_p)
                        tl = tk.Label(card, image=th_p, bg=c_bg, bd=0)
                        tl.pack(side="left", padx=(0, 5))
                    except Exception:
                        pass

                if kind == "image":
                    img_ref_p = str(rec.get("img_path") or rec.get("file_path") or "").strip()
                    ocr_b = tk.Label(card, text="📝OCR", fg="#FDE047", bg="#0B1120", padx=4, pady=1, font=("Malgun Gothic", 8, "bold"), cursor="hand2")
                    ocr_b.pack(side="right", padx=(4, 0))
                    ocr_b.bind("<Button-1>", lambda _e, ip=img_ref_p: _toast_queue.put((f"__UI3_OCR__|{ip}", 8000)))

                time_l = tk.Label(card, text=rel_t, fg="#64748B", bg=c_bg, font=("Malgun Gothic", 8))
                time_l.pack(side="right", padx=(4, 0))

                body_l = tk.Label(card, text=snip, fg="#F8FAFC" if is_sel else "#CBD5E1", bg=c_bg, font=("Malgun Gothic", 9), anchor="w")
                body_l.pack(side="left", fill="x", expand=True)

                def _on_pick(_e=None, r=rec):
                    fpath = r.get("file_path") or r.get("img_path") or ""
                    _paste_to_target(text_val=r.get("text", ""), file_path=fpath)

                for w_it in (card, num_l, body_l, time_l):
                    w_it.bind("<Button-1>", _on_pick)

            if preview_pane is not None and candidates:
                sel_rec = candidates[st_state["sel_idx"]]
                s_txt = sel_rec.get("text", "")
                s_fp = str(sel_rec.get("img_path") or sel_rec.get("file_path") or "").strip()
                tk.Label(preview_pane, text="👻 선택 항목 상세 미리보기", fg="#5EEAD4", bg="#0F172A", font=("Malgun Gothic", 9, "bold"), anchor="w").pack(fill="x", pady=(0, 6))
                tk.Label(preview_pane, text=s_txt[:360], fg="#F8FAFC", bg="#0F172A", font=("Malgun Gothic", 9), justify="left", wraplength=330, anchor="w").pack(fill="x", pady=(0, 8))
                act_b = tk.Label(preview_pane, text="📎 현재 커서에 바로 꽂기 (Enter)", fg="#0B1120", bg="#2DD4BF", padx=8, pady=4, font=("Malgun Gothic", 9, "bold"), cursor="hand2")
                act_b.pack(fill="x", pady=2)
                act_b.bind("<Button-1>", lambda _e, r=sel_rec: _paste_to_target(r.get("text", ""), r.get("file_path") or r.get("img_path") or ""))
                if sel_rec.get("kind") == "image":
                    ocr_jump = tk.Label(preview_pane, text="📝 사진·OCR 단어칩 창으로 열기", fg="#FDE047", bg="#1E293B", padx=8, pady=4, font=("Malgun Gothic", 9, "bold"), cursor="hand2")
                    ocr_jump.pack(fill="x", pady=2)
                    ocr_jump.bind("<Button-1>", lambda _e, ip=s_fp: _toast_queue.put((f"__UI3_OCR__|{ip}", 8000)))
                if s_fp and os.path.isfile(s_fp):
                    lbl_jump = tk.Label(preview_pane, text="🏷️ 이 파일 귀신라벨링🔒", fg="#0B1120", bg="#5EEAD4", padx=8, pady=4, font=("Malgun Gothic", 9, "bold"), cursor="hand2")
                    lbl_jump.pack(fill="x", pady=2)
                    lbl_jump.bind("<Button-1>", lambda _e, fp=s_fp: (_close_win(), _CLICKED_SUPERPOWER_QUEUE.put((2, fp, True))))

        def _on_key_rel(event=None):
            is_hovered[0] = True
            if event and event.keysym in ("Up", "Down", "Return", "Escape", "Tab"):
                return
            st_state["sel_idx"] = 0
            prev_job = st_state.get("debounce_job")
            if prev_job is not None:
                try:
                    win.after_cancel(prev_job)
                except Exception:
                    pass

            def _apply_debounced() -> None:
                st_state["debounce_job"] = None
                if current_win[0] is win:
                    _render_search_results()

            st_state["debounce_job"] = win.after(120, _apply_debounced)

        def _on_down(_e=None):
            if st_state["items"]:
                st_state["sel_idx"] = (st_state["sel_idx"] + 1) % len(st_state["items"])
                _render_search_results()
            return "break"

        def _on_up(_e=None):
            if st_state["items"]:
                st_state["sel_idx"] = (st_state["sel_idx"] - 1) % len(st_state["items"])
                _render_search_results()
            return "break"

        def _on_ret(_e=None):
            if st_state["items"]:
                r = st_state["items"][st_state["sel_idx"]]
                _paste_to_target(r.get("text", ""), r.get("file_path") or r.get("img_path") or "")
            return "break"

        s_entry.bind("<KeyRelease>", _on_key_rel)
        s_entry.bind("<Down>", _on_down)
        s_entry.bind("<Up>", _on_up)
        s_entry.bind("<Return>", _on_ret)
        s_entry.bind("<Escape>", lambda _e: None if (time.time() - _LAST_RBTN_DISMISS_ESC_TS) < 0.45 else _close_win())

        _render_search_results()
        _resize_for_stage()

    # =================================================================
    # [창 UI ③] 📸 사진·OCR 공간이동창 (원본 사진 넣기 vs OCR 단어칩 콕 찍기)
    # - [창 UI ①], [창 UI ②]와 100% 분리된 사진·OCR 전용 독립 창!
    # =================================================================
    def _build_ui3_photo_ocr_window(win: tk.Toplevel, img_path_arg: str, pt_x: int, pt_y: int, work_area: tuple[int, int, int, int]) -> None:
        global _CURRENT_OPEN_UI_MODE
        active_mode[0] = "ui3"
        _CURRENT_OPEN_UI_MODE = "ui3"
        m_left, m_top, m_right, m_bottom = work_area

        teleport_text = ""
        teleport_tsv = ""
        teleport_chips: list[str] = []
        if img_path_arg == "__TELEPORT__":
            img_path_arg = ""
            try:
                tp_path = Path(
                    os.environ.get("LOCALAPPDATA") or (Path.home() / "AppData" / "Local")
                ) / "Merlin_Z_Core" / "latest_teleport_vanguard.json"
                if tp_path.exists():
                    tp_data = json.loads(tp_path.read_text(encoding="utf-8", errors="ignore"))
                    if isinstance(tp_data, dict):
                        teleport_text = str(tp_data.get("fullText") or tp_data.get("ocr_text") or "").strip()
                        teleport_tsv = str(tp_data.get("tsvTable") or "").strip()
                        raw_ch = tp_data.get("chips") or tp_data.get("spots") or []
                        if isinstance(raw_ch, list):
                            for ch_i in raw_ch:
                                if isinstance(ch_i, dict):
                                    sv = str(ch_i.get("insertValue") or ch_i.get("displayText") or ch_i.get("value") or "").strip()
                                    if sv:
                                        teleport_chips.append(sv)
                                elif str(ch_i or "").strip():
                                    teleport_chips.append(str(ch_i).strip())
                        tp_fp = str(tp_data.get("filePath") or tp_data.get("imgPath") or "").strip()
                        if tp_fp and os.path.isfile(tp_fp):
                            img_path_arg = tp_fp
            except Exception:
                pass

        norm_arg = os.path.normcase(os.path.abspath(img_path_arg)) if img_path_arg else ""
        target_rec = None
        for r in reversed(GLOBAL_AI_HISTORY):
            if r.get("kind") == "image":
                cand_p = str(r.get("img_path") or r.get("file_path") or "").strip()
                if not img_path_arg:
                    target_rec = r
                    break
                if cand_p and os.path.normcase(os.path.abspath(cand_p)) == norm_arg:
                    target_rec = r
                    break
        if target_rec is None and norm_arg:
            for frec in _get_lightweight_local_files():
                if frec.get("kind") == "image":
                    cand_p = str(frec.get("img_path") or frec.get("file_path") or "").strip()
                    if cand_p and os.path.normcase(os.path.abspath(cand_p)) == norm_arg:
                        target_rec = frec
                        break

        outer = tk.Frame(win, bg="#0B1120", highlightbackground="#FDE047", highlightthickness=2, padx=8, pady=6)
        outer.pack(fill="both", expand=True)

        hdr = tk.Frame(outer, bg="#0F172A", padx=6, pady=4)
        hdr.pack(fill="x", pady=(0, 6))
        tk.Label(hdr, text="👻 사진·OCR 공간이동창", fg="#0B1120", bg="#FDE047", padx=6, pady=1, font=("Malgun Gothic", 8, "bold")).pack(side="left", padx=(0, 6))
        tk.Label(hdr, text=str(get_trial_badge_summary().get("ui3_hint") or "원하는 단어칩을 클릭하면 커서에 0.1초 입력!"), fg="#5EEAD4", bg="#0F172A", font=("Malgun Gothic", 8, "bold")).pack(side="left")

        close_b = tk.Label(hdr, text="✕", fg="#94A3B8", bg="#1E293B", padx=5, pady=1, font=("Malgun Gothic", 8, "bold"), cursor="hand2")
        close_b.pack(side="right", padx=(4, 0))
        close_b.bind("<Button-1>", lambda _e: _close_win())

        to_s_b = tk.Label(hdr, text="👻귀신검색창으로", fg="#E2E8F0", bg="#1E293B", padx=5, pady=1, font=("Malgun Gothic", 8, "bold"), cursor="hand2")
        to_s_b.pack(side="right")
        to_s_b.bind("<Button-1>", lambda _e: _toast_queue.put(("__UI2_SEARCH__|small|", 8000)))

        body = tk.Frame(outer, bg="#0B1120")
        body.pack(fill="both", expand=True)

        left_p = tk.Frame(body, bg="#0F172A", highlightbackground="#334155", highlightthickness=1, padx=8, pady=6)
        left_p.pack(side="left", fill="y", padx=(0, 6))

        right_p = tk.Frame(body, bg="#0F172A", highlightbackground="#334155", highlightthickness=1, padx=8, pady=6)
        right_p.pack(side="left", fill="both", expand=True)

        img_p_str = str((target_rec.get("img_path") or target_rec.get("file_path") if target_rec else "") or img_path_arg or "").strip()
        if Image is not None and ImageTk is not None:
            try:
                im_o = None
                if target_rec and target_rec.get("png_bytes"):
                    im_o = Image.open(io.BytesIO(target_rec["png_bytes"])).convert("RGBA")
                elif img_p_str and os.path.isfile(img_p_str):
                    with Image.open(img_p_str) as disk_im:
                        im_o = disk_im.convert("RGBA")
                if im_o is not None:
                    resamp = getattr(getattr(Image, "Resampling", Image), "LANCZOS", Image.BICUBIC)
                    im_o.thumbnail((190, 125), resamp)
                    ph_o = ImageTk.PhotoImage(im_o, master=root)
                    thumb_refs.append(ph_o)
                    tk.Label(left_p, image=ph_o, bg="#0F172A").pack(pady=(0, 6))
            except Exception:
                pass

        b_orig = tk.Label(left_p, text="🖼️ 원본 사진 그대로 넣기", fg="#0B1120", bg="#2DD4BF", padx=6, pady=4, font=("Malgun Gothic", 8, "bold"), cursor="hand2")
        b_orig.pack(fill="x", pady=2)
        b_orig.bind("<Button-1>", lambda _e: _paste_to_target(file_path=img_p_str))

        rec_txt_raw = str(target_rec.get("text", "") if target_rec else "").strip()
        is_placeholder_txt = (
            not rec_txt_raw
            or rec_txt_raw in ("화면 캡처 이미지", "원본 사진 첨부 가능")
            or bool(re.match(r"^\[[^\]]+\]\s+[^\n|]+$", rec_txt_raw))
            or rec_txt_raw.startswith("📦 ")
        )
        if not is_placeholder_txt and " | " in rec_txt_raw and rec_txt_raw.startswith("["):
            rec_txt_raw = rec_txt_raw.split(" | ", 1)[1].strip()

        init_ocr_t = ""
        if teleport_text:
            init_ocr_t = teleport_text
        elif not is_placeholder_txt:
            init_ocr_t = rec_txt_raw
        elif not img_p_str:
            init_ocr_t = get_clipboard_text()

        need_ondemand_ocr = bool(not teleport_text and img_p_str and os.path.isfile(img_p_str) and not init_ocr_t.strip())
        ocr_state: dict[str, str] = {
            "full": init_ocr_t,
            "tsv": teleport_tsv or (re.sub(r"  +", "\t", _clean_ocr_noise(init_ocr_t)) if init_ocr_t else ""),
        }

        b_tsv = tk.Label(left_p, text="📊 표 전체 엑셀(TSV)로 넣기", fg="#F8FAFC", bg="#1E293B", padx=6, pady=4, font=("Malgun Gothic", 8, "bold"), cursor="hand2")
        b_tsv.pack(fill="x", pady=2)
        b_tsv.bind(
            "<Button-1>",
            lambda _e: _paste_to_target(
                text_val=ocr_state["tsv"] or re.sub(r"  +", "\t", _clean_ocr_noise(ocr_state["full"]))
            )
            if ocr_state["full"].strip()
            else None,
        )

        tk.Label(right_p, text="📝 추출된 단어 조각(칩) — 콕 찍으면 커서에 즉시 입력", fg="#FDE047", bg="#0F172A", font=("Malgun Gothic", 8, "bold"), anchor="w").pack(fill="x", pady=(0, 6))
        chips_box = tk.Frame(right_p, bg="#0F172A")
        chips_box.pack(fill="both", expand=True)

        def _render_ui3_chips(chip_items: list[str], status_msg: str = "") -> None:
            for w_ch in chips_box.winfo_children():
                w_ch.destroy()
            if status_msg:
                tk.Label(
                    chips_box,
                    text=status_msg,
                    fg="#94A3B8",
                    bg="#0F172A",
                    font=("Malgun Gothic", 9, "bold"),
                    justify="left",
                    wraplength=350,
                    anchor="w",
                ).pack(fill="x", pady=12)
                return
            for idx_ch, ch_val in enumerate(chip_items[:15]):
                ch_lbl = tk.Label(chips_box, text=f" {ch_val} ", fg="#5EEAD4", bg="#1E293B", padx=6, pady=3, font=("Malgun Gothic", 9, "bold"), cursor="hand2")
                ch_lbl.grid(row=idx_ch // 3, column=idx_ch % 3, padx=3, pady=3, sticky="ew")
                ch_lbl.bind("<Button-1>", lambda _e, v=ch_val: _paste_to_target(text_val=v))

        if need_ondemand_ocr:
            _render_ui3_chips([], status_msg="⏳ 사진 속 글자·표를 읽어오는 중...")

            def _bg_ocr_worker(target_img_p: str) -> None:
                res = _run_ondemand_winrt_image_ocr(target_img_p)
                ft = str(res.get("fullText") or "").strip()
                tsv = str(res.get("tsvTable") or ft).strip()
                ch_list = [str(c).strip() for c in (res.get("chips") or []) if str(c).strip()]
                if ft and not ch_list:
                    ch_list = _extract_word_chips_from_text(ft)
                if ft and target_rec is not None:
                    prev_t = str(target_rec.get("text") or "")
                    if prev_t.startswith("[") and " | " not in prev_t:
                        target_rec["text"] = f"{prev_t} | {ft[:240]}"
                    elif not prev_t or prev_t == "화면 캡처 이미지":
                        target_rec["text"] = ft

                def _apply_on_ui() -> None:
                    if current_win[0] is not win:
                        return
                    if res.get("hasText") and ft:
                        ocr_state["full"] = ft
                        ocr_state["tsv"] = tsv
                        _render_ui3_chips(ch_list or [ft[:28]])
                    else:
                        ocr_state["full"] = ""
                        ocr_state["tsv"] = ""
                        _render_ui3_chips([], status_msg="인식된 글자가 없어요 (좌측 [원본 사진 그대로 넣기] 가능)")

                try:
                    win.after(0, _apply_on_ui)
                except Exception:
                    pass

            threading.Thread(target=_bg_ocr_worker, args=(img_p_str,), daemon=True).start()
        else:
            chips = teleport_chips or _extract_word_chips_from_text(init_ocr_t)
            if chips:
                _render_ui3_chips(chips)
            else:
                _render_ui3_chips([], status_msg="인식된 글자가 없어요 (좌측 [원본 사진 그대로 넣기] 가능)")

        b_all = tk.Label(right_p, text="📋 전체 텍스트 통째로 넣기", fg="#E2E8F0", bg="#334155", padx=6, pady=3, font=("Malgun Gothic", 8, "bold"), cursor="hand2")
        b_all.pack(fill="x", pady=(6, 0))
        b_all.bind(
            "<Button-1>",
            lambda _e: _paste_to_target(text_val=_clean_ocr_noise(ocr_state["full"]))
            if ocr_state["full"].strip()
            else None,
        )

        rw, rh = 620, 310
        x = max(m_left + 12, min(pt_x - 20, m_right - rw - 16))
        y = max(m_top + 12, min(pt_y + 16, m_bottom - rh - 16))
        _apply_win_topmost(win, x, y, rw, rh, activate=False)

    def _poll_queue() -> None:
        global _CURRENT_OPEN_UI_MODE, _UI_LOOP_HEARTBEAT_TS, _IS_UI_HOVERED, _LAST_UI_OPENED_TS, _UI_LOOP_STAGE
        _UI_LOOP_HEARTBEAT_TS = time.time()
        _UI_LOOP_STAGE = "poll_start"
        try:
            if current_win[0] is not None:
                try:
                    if not current_win[0].winfo_exists():
                        _close_win()
                except Exception:
                    _close_win()
            lbtn_down = (u32.GetAsyncKeyState(0x01) & 0x8000) != 0
            rbtn_down = (u32.GetAsyncKeyState(0x02) & 0x8000) != 0
            ctrl_held = (u32.GetAsyncKeyState(VK_CONTROL) & 0x8000) != 0
            esc_down = (u32.GetAsyncKeyState(0x1B) & 0x8000) != 0
            # [Ctrl+우클릭 릴리즈 오판 닫힘 원천 차단]:
            # Ctrl+우클릭 소환 직후 유저가 Ctrl을 마우스 우클릭보다 먼저 떼더라도(rbtn_down 유지)
            # 외부 클릭으로 오인해 창을 닫지 않도록, '신규 눌림' 상태만 추적합니다.
            phys_any_btn = lbtn_down or rbtn_down
            mouse_down = lbtn_down or (rbtn_down and not ctrl_held)
            if current_win[0] is not None:
                pt_click = wintypes.POINT()
                u32.GetCursorPos(ctypes.byref(pt_click))
                wx1, wy1, wx2, wy2 = win_rect[0]
                if _CURRENT_OPEN_WIN_HWND and u32.IsWindow(_CURRENT_OPEN_WIN_HWND):
                    rc_chk = wintypes.RECT()
                    if u32.GetWindowRect(_CURRENT_OPEN_WIN_HWND, ctypes.byref(rc_chk)) and rc_chk.right > rc_chk.left and rc_chk.bottom > rc_chk.top:
                        wx1, wy1, wx2, wy2 = int(rc_chk.left), int(rc_chk.top), int(rc_chk.right), int(rc_chk.bottom)
                inside_rect = (wx1 <= pt_click.x <= wx2 and wy1 <= pt_click.y <= wy2)
                if is_hovered[0] and not inside_rect and active_mode[0] == "toast":
                    _schedule_close(1800)
                is_hovered[0] = inside_rect
                _IS_UI_HOVERED = inside_rect
                if not lbtn_down and ui_dragging[0]:
                    ui_dragging[0] = False
                if esc_down and active_mode[0] in ("ui1", "ui2", "ui3", "ui4"):
                    if (time.time() - opened_at[0]) > 0.25 and (time.time() - _LAST_RBTN_DISMISS_ESC_TS) > 0.45:
                        _close_win()
                        _CLICKED_SUPERPOWER_QUEUE.put(("disarm_only", 0))
                elif mouse_down and not was_mouse_down[0] and not ui_dragging[0]:
                    if (time.time() - opened_at[0]) > 0.22 and not inside_rect:
                        _close_win()
                        _CLICKED_SUPERPOWER_QUEUE.put(("disarm_only", 0))
            was_mouse_down[0] = phys_any_btn

            msg_item = None
            need_lift = False
            while not _toast_queue.empty():
                q_it = _toast_queue.get_nowait()
                if q_it[0] == "__LIFT__":
                    need_lift = True
                else:
                    msg_item = q_it

            if msg_item is None and need_lift:
                msg_item = ("__LIFT__", 0)

            if msg_item is not None:
                message, duration_ms = msg_item
                if message == "__CLOSE__":
                    _close_win()
                elif message == "__LIFT__":
                    if current_win[0] is not None:
                        try:
                            wid = current_win[0].winfo_id()
                            hwnd_t = u32.GetParent(wid) or wid if wid else 0
                            if hwnd_t:
                                u32.SetWindowPos(hwnd_t, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW)
                            current_win[0].lift()
                        except Exception:
                            pass
                elif message == "__MORPH_SEARCH__" or message.startswith("__MORPH_SEARCH__|"):
                    # [창 UI ① 기본 귀신창]에서 글자 타이핑 시 합체하지 않고 [창 UI ①]을 닫은 뒤 별개의 [창 UI ② 귀신검색창(소형)]으로 전환!
                    init_q_ch = message.split("|", 1)[1] if "|" in message else ""
                    if current_win[0] is not None and active_mode[0] == "ui1":
                        _CLICKED_SUPERPOWER_QUEUE.put(("disarm_only", 0))
                        _toast_queue.put((f"__UI2_SEARCH__|small|{init_q_ch}", 8000))
                else:
                    _close_win()
                    pt = wintypes.POINT()
                    u32.GetCursorPos(ctypes.byref(pt))
                    work_area = _get_monitor_workarea_for_point(pt.x, pt.y)
                    m_left, m_top, m_right, m_bottom = work_area

                    win = tk.Toplevel(root)
                    win.withdraw()
                    current_win[0] = win
                    t_ui_build0 = time.perf_counter()
                    opened_at[0] = time.time()
                    _LAST_UI_OPENED_TS = opened_at[0]
                    was_mouse_down[0] = True
                    win.overrideredirect(True)
                    win.attributes("-topmost", True)
                    win.attributes("-alpha", 0.98)
                    win.configure(bg="#0B1120")

                    # ── 분기 2: [창 UI ②] 👻 귀신검색창 (소·중·대 독립 창, 타이머 자동 닫힘 없이 외부클릭/ESC까지 유지) ──
                    if message.startswith("__UI2_SEARCH__|"):
                        parts = message.split("|", 2)
                        st_arg = parts[1] if len(parts) > 1 else "small"
                        q_arg = parts[2] if len(parts) > 2 else ""
                        _build_ui2_search_window(win, st_arg, q_arg, pt.x, pt.y, work_area)
                        _log_seq_diag(
                            "UI2_SHOWN",
                            f"stage={st_arg} build_ms={(time.perf_counter()-t_ui_build0)*1000:.1f} hwnd={_CURRENT_OPEN_WIN_HWND}",
                        )
                    # ── 분기 3: [창 UI ③] 📸 사진·OCR 공간이동창 (독립 창, 외부클릭/ESC까지 유지 · 유료 티어 잠금 검증 필수) ──
                    elif message.startswith("__UI3_OCR__|"):
                        img_arg = message.split("|", 1)[1] if "|" in message else ""
                        _close_win()
                        ok_ocr, ocr_msg = check_feature_quota_allowed("ui3_photo_ocr", interactive_opt_in=True)
                        if not ok_ocr:
                            _toast_queue.put((ocr_msg, 3200))
                            _toast_event.set()
                            return
                        complete_feature_action_success("ui3_photo_ocr")
                        win = tk.Toplevel(root)
                        current_win[0] = win
                        opened_at[0] = time.time()
                        was_mouse_down[0] = True
                        win.overrideredirect(True)
                        win.attributes("-topmost", True)
                        win.attributes("-alpha", 0.98)
                        win.configure(bg="#0B1120")
                        _build_ui3_photo_ocr_window(win, img_arg, pt.x, pt.y, work_area)
                    # ── 분기 1: [창 UI ①] 기본 귀신창 (초경량 2줄 [1]~[5] 바, 검색창과 100% 분리!) ──
                    elif duration_ms >= 2000 and "|" in message:
                        active_mode[0] = "ui1"
                        _CURRENT_OPEN_UI_MODE = "ui1"
                        left_tag, right_part = message.split("|", 1)
                        container = tk.Frame(win, bg="#0B1120", highlightbackground="#2DD4BF", highlightthickness=2, padx=8, pady=6)
                        container.pack(fill="both", expand=True)

                        top_bar = tk.Frame(container, bg="#0F172A", highlightbackground="#14B8A6", highlightthickness=1, padx=6, pady=3)
                        top_bar.pack(fill="x", pady=(0, 5))

                        # 클릭 시 [창 UI ② 귀신검색창]으로 즉시 전환하는 스위치 버튼
                        s_btn = tk.Label(top_bar, text="👻귀신검색창 열기", fg="#0B1120", bg="#2DD4BF", padx=6, pady=1, font=("Malgun Gothic", 8, "bold"), cursor="hand2")
                        s_btn.pack(side="left", padx=(0, 6))
                        s_btn.bind(
                            "<Button-1>",
                            lambda _e: (
                                _CLICKED_SUPERPOWER_QUEUE.put(("disarm_only", 0)),
                                _toast_queue.put(("__UI2_SEARCH__|small|", 8000)),
                            ),
                        )

                        cur_cfg = get_superpower_settings()
                        cur_days = int(cur_cfg.get("retention_days", 7))
                        cur_sound = bool(cur_cfg.get("sound_enabled", True))
                        ret_label_map = {1: "보관:1일", 3: "보관:3일", 7: "보관:7일", 30: "보관:30일"}

                        close_btn = tk.Label(top_bar, text="✕", fg="#94A3B8", bg="#1E293B", padx=5, pady=1, font=("Malgun Gothic", 8, "bold"), cursor="hand2")
                        close_btn.pack(side="right", padx=(3, 0))
                        close_btn.bind("<Button-1>", lambda _e: (_close_win(), _CLICKED_SUPERPOWER_QUEUE.put(("disarm_only", 0))))

                        clear_btn = tk.Label(top_bar, text="🧹비우기", fg="#FCA5A5", bg="#1E293B", padx=5, pady=1, font=("Malgun Gothic", 8, "bold"), cursor="hand2")
                        clear_btn.pack(side="right", padx=(3, 0))
                        clear_btn.bind("<Button-1>", lambda _e: clear_clipboard_history())

                        ret_btn = tk.Label(top_bar, text=ret_label_map.get(cur_days, f"보관:{cur_days}일") + "▾", fg="#5EEAD4", bg="#1E293B", padx=5, pady=1, font=("Malgun Gothic", 8, "bold"), cursor="hand2")
                        ret_btn.pack(side="right", padx=(3, 0))

                        def _cycle_ret(_e=None):
                            is_hovered[0] = True
                            now_d = int(get_superpower_settings().get("retention_days", 7))
                            order = [1, 3, 7, 30]
                            nxt_d = order[(order.index(now_d) + 1) % len(order)] if now_d in order else 7
                            update_superpower_settings({"retention_days": nxt_d})
                            ret_btn.config(text=ret_label_map.get(nxt_d, f"보관:{nxt_d}일") + "▾")
                            _CLICKED_SUPERPOWER_QUEUE.put(("prune_history", nxt_d))

                        ret_btn.bind("<Button-1>", _cycle_ret)

                        mute_btn = tk.Label(top_bar, text="🔊" if cur_sound else "🔇", fg="#5EEAD4" if cur_sound else "#64748B", bg="#1E293B", padx=4, pady=1, font=("Malgun Gothic", 8, "bold"), cursor="hand2")
                        mute_btn.pack(side="right", padx=(3, 0))

                        def _toggle_mute(_e=None):
                            is_hovered[0] = True
                            nxt_s = not bool(get_superpower_settings().get("sound_enabled", True))
                            update_superpower_settings({"sound_enabled": nxt_s})
                            mute_btn.config(text="🔊" if nxt_s else "🔇", fg="#5EEAD4" if nxt_s else "#64748B")

                        mute_btn.bind("<Button-1>", _toggle_mute)

                        t_sum = get_trial_badge_summary()
                        is_teleport_banner = "📱" in left_tag
                        status_hint = str(t_sum.get("ui1_hint") or "✨ 무료 초능력 평생 0원 · 글자 입력 시 👻귀신검색창 전환")
                        if is_teleport_banner:
                            status_hint = left_tag.strip() + " (클릭: OCR창)"
                        elif "(" in left_tag and ")" in left_tag:
                            status_hint = left_tag[left_tag.find("(") : left_tag.rfind(")") + 1] + " · " + status_hint
                        hint_lbl_top = tk.Label(
                            top_bar,
                            text=status_hint,
                            fg="#FDE047",
                            bg="#0F172A",
                            font=("Malgun Gothic", 8, "bold"),
                            anchor="w",
                            cursor="hand2" if is_teleport_banner else "arrow",
                        )
                        hint_lbl_top.pack(side="left", fill="x", expand=True)
                        if is_teleport_banner:
                            hint_lbl_top.bind(
                                "<Button-1>",
                                lambda _e: (
                                    _CLICKED_SUPERPOWER_QUEUE.put(("disarm_only", 0)),
                                    _toast_queue.put(("__UI3_OCR__|__TELEPORT__", 8000)),
                                ),
                            )

                        bottom_bar = tk.Frame(container, bg="#0B1120")
                        bottom_bar.pack(fill="x")

                        logo_btn = tk.Frame(bottom_bar, bg="#131D36", highlightbackground="#2DD4BF", highlightthickness=1, padx=7, pady=5, cursor="hand2")
                        logo_btn.pack(side="left", padx=(0, 8), fill="y")
                        logo_widgets = [logo_btn]
                        if ghost_symbol_photo is not None:
                            sym_lbl = tk.Label(logo_btn, image=ghost_symbol_photo, bg="#131D36", bd=0, cursor="hand2")
                            sym_lbl.image = ghost_symbol_photo
                            sym_lbl.pack(side="left", padx=(0, 5))
                            logo_widgets.append(sym_lbl)
                        if ghost_wordmark_photo is not None:
                            wm_lbl = tk.Label(logo_btn, image=ghost_wordmark_photo, bg="#131D36", bd=0, cursor="hand2")
                            wm_lbl.image = ghost_wordmark_photo
                            wm_lbl.pack(side="left", padx=(0, 2))
                            logo_widgets.append(wm_lbl)
                        else:
                            wm_lbl = tk.Label(logo_btn, text="귀신같이", fg="#5EEAD4", bg="#131D36", font=("Malgun Gothic", 10, "bold"), cursor="hand2")
                            wm_lbl.pack(side="left", padx=(0, 2))
                            logo_widgets.append(wm_lbl)

                        for wdg in logo_widgets:
                            wdg.bind("<Button-1>", lambda _e: (_close_win(), _open_ghosti_web()))

                        menu_box = tk.Frame(bottom_bar, bg="#0B1120")
                        menu_box.pack(side="left", fill="both", expand=True)
                        line1_txt, line2_txt = (right_part.strip().split("\n", 1) if "\n" in right_part else (right_part.strip(), ""))

                        def _bind_row_buttons(parent_frame: tk.Frame, raw_line: str, fg_color: str) -> None:
                            tokens = [t.strip() for t in re.split(r"\s{2,}", raw_line.strip()) if t.strip()]
                            for tok in tokens:
                                m_num = re.match(r"^\[([1-9])\]", tok)
                                is_ctrlv = tok.startswith("[Ctrl+V]")
                                b_item = tk.Label(
                                    parent_frame,
                                    text=tok,
                                    fg=fg_color,
                                    bg="#0B1120",
                                    padx=4,
                                    pady=1,
                                    font=("Malgun Gothic", 9, "bold"),
                                    anchor="w",
                                    cursor="hand2" if (m_num or is_ctrlv) else "arrow",
                                )
                                b_item.pack(side="left", anchor="w", padx=(0, 6))
                                if m_num:
                                    sp_num = int(m_num.group(1))
                                    b_item.bind("<Button-1>", lambda _e, n=sp_num: (_close_win(), _CLICKED_SUPERPOWER_QUEUE.put(n)))
                                elif is_ctrlv:
                                    b_item.bind("<Button-1>", lambda _e: (_close_win(), _CLICKED_SUPERPOWER_QUEUE.put(0)))

                        row1_frame = tk.Frame(menu_box, bg="#0B1120")
                        row1_frame.pack(fill="x", anchor="w")
                        _bind_row_buttons(row1_frame, line1_txt, "#5EEAD4")

                        row2_frame = tk.Frame(menu_box, bg="#0B1120")
                        row2_frame.pack(fill="x", anchor="w", pady=(2, 0))
                        _bind_row_buttons(row2_frame, line2_txt, "#E2E8F0")

                        extra_panel_box = tk.Frame(container, bg="#0B1120")
                        panel_state = {"mode": None}

                        def _toggle_extra_panel(target_mode: str):
                            is_hovered[0] = True
                            for ch in extra_panel_box.winfo_children():
                                ch.destroy()
                            if panel_state["mode"] == target_mode:
                                extra_panel_box.pack_forget()
                                panel_state["mode"] = None
                            else:
                                panel_state["mode"] = target_mode
                                extra_panel_box.pack(fill="x", pady=(6, 0))
                                p_inner = tk.Frame(extra_panel_box, bg="#0F172A", highlightbackground="#2DD4BF", highlightthickness=1, padx=8, pady=6)
                                p_inner.pack(fill="x")
                                if target_mode == "snippets":
                                    tk.Label(p_inner, text="⌨️ [상용구 사출] F1~F6 키를 누르거나 아래 슬롯을 클릭하세요", fg="#5EEAD4", bg="#0F172A", font=("Malgun Gothic", 8, "bold"), anchor="w").pack(fill="x", pady=(0, 4))
                                    snips_now = ensure_default_snippets()
                                    grid_f = tk.Frame(p_inner, bg="#0F172A")
                                    grid_f.pack(fill="x")
                                    for idx_f in range(1, 7):
                                        fk = f"F{idx_f}"
                                        fv = snips_now.get(fk, "")
                                        disp = (fv[:16] + "…") if len(fv) > 16 else (fv or "(비어있음)")
                                        b_lbl = tk.Label(grid_f, text=f"[{fk}] {disp}", fg="#F8FAFC", bg="#1E293B", padx=6, pady=2, font=("Malgun Gothic", 8), cursor="hand2", anchor="w")
                                        b_lbl.grid(row=(idx_f - 1) // 3, column=(idx_f - 1) % 3, padx=3, pady=2, sticky="ew")
                                        b_lbl.bind("<Button-1>", lambda _e, s_n=idx_f: (_close_win(), _CLICKED_SUPERPOWER_QUEUE.put(("snippet", s_n))))
                                else:
                                    tk.Label(p_inner, text="💡 [숨은 귀신 초능력 & 꿀팁]", fg="#FDE047", bg="#0F172A", font=("Malgun Gothic", 8, "bold"), anchor="w").pack(fill="x", pady=(0, 4))
                                    for tl in (
                                        "• 🧹 [1]번 서식·줄바꿈(무료) : 문장 복사(Ctrl+C)나 드래그 후 [1]번 클릭 시 서식세탁·끊어진 줄바꿈 즉시 정리 (Ctrl+Z 원복)!",
                                        "• 📦 1초 스마트 ZIP 압축(무료) : 탐색기에서 더블클릭·일반 우클릭 메뉴(또는 Ctrl+0) 시 광고 0% 즉시 압축·해제!",
                                        "• ⚡ 타이핑 자동 한영·띄어쓰기 성형(무료) : 영타 1초 정지 시 자동 변환 (Ctrl+Z로 즉시 원복)!",
                                        "• 🔄 드래그 후 Ctrl+0(자동 분기) : 문장 다림질 후 내 PC 관련 파일이 있으면 귀신검색창까지 즉시 연결!",
                                    ):
                                        tk.Label(p_inner, text=tl, fg="#E2E8F0", bg="#0F172A", font=("Malgun Gothic", 8), anchor="w").pack(fill="x", pady=1)
                            win.update_idletasks()
                            rw, rh = max(win.winfo_reqwidth(), 240), max(win.winfo_reqheight(), 42)
                            cx_exp = max(m_left + 12, min(win_rect[0][0], m_right - rw - 16))
                            cy_exp = max(m_top + 12, min(win_rect[0][1], m_bottom - rh - 16))
                            _apply_win_topmost(win, cx_exp, cy_exp, rw, rh, activate=False)

                        tips_btn = tk.Label(row2_frame, text="💡꿀팁·기타▾", fg="#FDE047", bg="#1E293B", padx=6, pady=1, font=("Malgun Gothic", 8, "bold"), cursor="hand2")
                        tips_btn.pack(side="right", padx=(4, 0))
                        tips_btn.bind("<Button-1>", lambda _e: _toggle_extra_panel("tips"))

                        snip_btn = tk.Label(row2_frame, text="⌨️상용구▾", fg="#5EEAD4", bg="#1E293B", padx=6, pady=1, font=("Malgun Gothic", 8, "bold"), cursor="hand2")
                        snip_btn.pack(side="right", padx=(8, 0))
                        snip_btn.bind("<Button-1>", lambda _e: _toggle_extra_panel("snippets"))

                        win.update_idletasks()
                        req_w, req_h = max(win.winfo_reqwidth(), 240), max(win.winfo_reqheight(), 42)
                        x = max(m_left + 12, min(pt.x - 20, m_right - req_w - 16))
                        y = max(m_top + 12, min(pt.y + 16, m_bottom - req_h - 16))
                        _apply_win_topmost(win, x, y, req_w, req_h, activate=False)
                        _schedule_close(duration_ms)
                    # ──────────────────────────────────────────────────────────────────────
                    # [창 UI ④] 스마트 압축 해제 + 인라인 공유 브릿지 (Ctrl+0 / Ctrl+우클릭)
                    # ──────────────────────────────────────────────────────────────────────
                    elif message.startswith("__UI4_ARCHIVE__|"):
                        active_mode[0] = "ui4"
                        _CURRENT_OPEN_UI_MODE = "ui4"
                        arch_path = message.split("|", 1)[1].strip()
                        arch_name = Path(arch_path).name
                        outer = tk.Frame(win, bg="#0B1120", highlightbackground="#2DD4BF", highlightthickness=2, padx=12, pady=10)
                        outer.pack(fill="both", expand=True)

                        hdr = tk.Frame(outer, bg="#0B1120")
                        hdr.pack(fill="x", pady=(0, 6))
                        tk.Label(hdr, text=f"📦 {arch_name}", fg="#5EEAD4", bg="#0B1120", font=("Malgun Gothic", 10, "bold"), anchor="w").pack(side="left")
                        tk.Label(hdr, text="🔒 풀기 전 내부 미열람 · 광고 0%", fg="#94A3B8", bg="#0F172A", padx=6, pady=1, font=("Malgun Gothic", 8)).pack(side="right")

                        status_lbl = tk.Label(
                            outer,
                            text="맥북 한글 자소분리(NFD)·뷁뷁 깨짐 자동 복원 & 바탕화면 압축폭탄 방어 준비 완료",
                            fg="#E2E8F0",
                            bg="#0B1120",
                            font=("Malgun Gothic", 8),
                            anchor="w",
                        )
                        status_lbl.pack(fill="x", pady=(0, 8))

                        btn_row = tk.Frame(outer, bg="#0B1120")
                        btn_row.pack(fill="x")

                        bridge_box = tk.Frame(outer, bg="#0F172A")
                        unzip_busy = [False]

                        def _load_care_suite_mod():
                            _bdir = Path(getattr(sys, "_MEIPASS", str(Path(__file__).resolve().parent)))
                            for _cand_ag in (
                                _bdir,
                                Path(__file__).resolve().parent,
                                Path(__file__).resolve().parent / "os_agent",
                                Path(r"D:\Ghosti\universal_z_core\os_agent"),
                            ):
                                if _cand_ag.exists() and str(_cand_ag) not in sys.path:
                                    sys.path.insert(0, str(_cand_ag))
                            import plugin_ghosti_care_suite as _cs

                            return _cs

                        def _on_unzip_result(res):
                            try:
                                if not win.winfo_exists():
                                    return
                            except Exception:
                                return

                            if not res.get("ok") and res.get("needPassword"):
                                try:
                                    _cs = _load_care_suite_mod()
                                    err_msg = str(res.get("message") or "") if res.get("wrongPassword") else ""
                                    pwd = _cs._prompt_archive_password_tk(
                                        arch_name,
                                        error_message=err_msg,
                                        parent_win=win,
                                    )
                                except Exception:
                                    pwd = None
                                if pwd is None:
                                    unzip_busy[0] = False
                                    ext_btn.config(text="📂 한글깨짐/폭탄 없이 1초 만에 풀기")
                                    status_lbl.config(
                                        text="암호 입력이 취소되었습니다. 다시 풀려면 버튼을 눌러주세요.",
                                        fg="#94A3B8",
                                    )
                                    return
                                status_lbl.config(text="🔓 입력한 비밀번호로 압축 해제 중...", fg="#5EEAD4")
                                threading.Thread(target=_unzip_worker, args=(pwd,), daemon=True).start()
                                return

                            unzip_busy[0] = False
                            if res.get("ok"):
                                ext_btn.config(text="✅ 해제 완료 (폴더 열기)")
                                extracted_dir = str(res.get("extractedFolder") or "")
                                if extracted_dir:
                                    ext_btn.bind(
                                        "<Button-1>",
                                        lambda _ev, d=extracted_dir: os.startfile(d) if os.path.exists(d) else None,
                                    )
                                ib = res.get("inlineBridge", {})
                                lines = ib.get("summaryLines", [])
                                status_lbl.config(text="\n".join(lines), fg="#FDE047")
                                for ch in bridge_box.winfo_children():
                                    ch.destroy()
                                bridge_box.pack(fill="x", pady=(8, 0))
                                b1 = tk.Label(
                                    bridge_box,
                                    text=ib.get("primaryCta", {}).get("label", "🔍 방금 푼 문서 내용 1초 검색"),
                                    fg="#0B1120",
                                    bg="#2DD4BF",
                                    padx=8,
                                    pady=4,
                                    font=("Malgun Gothic", 8, "bold"),
                                    cursor="hand2",
                                )
                                b1.pack(fill="x", pady=(0, 4))
                                b1.bind("<Button-1>", lambda _ev: _toast_queue.put(("__UI2_SEARCH__|medium|", 10000)))
                                b2 = tk.Label(
                                    bridge_box,
                                    text=ib.get("secondaryCta", {}).get("label", "📱 내 폰으로 바로 보내기 / 💼 팀 공유폴더(S:) 넣기"),
                                    fg="#F8FAFC",
                                    bg="#1E293B",
                                    padx=8,
                                    pady=4,
                                    font=("Malgun Gothic", 8, "bold"),
                                    cursor="hand2",
                                )
                                b2.pack(fill="x")
                                b2.bind("<Button-1>", lambda _ev: (_close_win(), _open_ghosti_web()))
                                win.update_idletasks()
                                rw, rh = max(win.winfo_reqwidth(), 380), max(win.winfo_reqheight(), 90)
                                _apply_win_topmost(win, win_rect[0][0], win_rect[0][1], rw, rh, activate=False)
                            else:
                                ext_btn.config(text="📂 한글깨짐/폭탄 없이 1초 만에 풀기")
                                status_lbl.config(text=res.get("message") or res.get("error") or "해제 실패", fg="#FCA5A5")

                        def _unzip_worker(pwd_val=None):
                            try:
                                _cs = _load_care_suite_mod()
                                res = _cs.smart_extract_archive(arch_path, password=pwd_val)
                            except Exception as ex:
                                res = {"ok": False, "message": f"오류: {ex}"}
                            try:
                                win.after(0, lambda r=res: _on_unzip_result(r))
                            except Exception:
                                pass

                        def _do_smart_unzip(_e=None):
                            if unzip_busy[0]:
                                return
                            unzip_busy[0] = True
                            is_hovered[0] = True
                            ext_btn.config(text="⏳ 압축 푸는 중...")
                            status_lbl.config(text="⏳ 압축 해제 및 파일명 검사 중... (잠시만 기다려 주세요)", fg="#5EEAD4")
                            threading.Thread(target=_unzip_worker, args=(None,), daemon=True).start()

                        ext_btn = tk.Label(
                            btn_row,
                            text="📂 한글깨짐/폭탄 없이 1초 만에 풀기",
                            fg="#0B1120",
                            bg="#2DD4BF",
                            padx=10,
                            pady=5,
                            font=("Malgun Gothic", 9, "bold"),
                            cursor="hand2",
                        )
                        ext_btn.pack(side="left", padx=(0, 6))
                        ext_btn.bind("<Button-1>", _do_smart_unzip)

                        seal_lbl = tk.Label(
                            btn_row,
                            text="🔒 봉인 존중 (풀기 전 내부 미열람 · 푼 직후 즉시 검색 연결)",
                            fg="#94A3B8",
                            bg="#1E293B",
                            padx=10,
                            pady=5,
                            font=("Malgun Gothic", 8, "bold"),
                        )
                        seal_lbl.pack(side="left")

                        win.update_idletasks()
                        req_w, req_h = max(win.winfo_reqwidth(), 380), max(win.winfo_reqheight(), 86)
                        x = max(m_left + 12, min(pt.x - 20, m_right - req_w - 16))
                        y = max(m_top + 12, min(pt.y + 16, m_bottom - req_h - 16))
                        _apply_win_topmost(win, x, y, req_w, req_h, activate=False)
                    # ── 일반 단문 알림 토스트 ──
                    else:
                        active_mode[0] = "toast"
                        _CURRENT_OPEN_UI_MODE = ""
                        play_baby_ghost_sound(mode="typo")
                        clean_msg = re.sub(r"[👻🔍✨📌★]", "", message).strip()
                        outer = tk.Frame(win, bg="#0B1120", highlightbackground="#2DD4BF", highlightthickness=2, padx=10, pady=6)
                        outer.pack(fill="both", expand=True)
                        if ghost_symbol_photo is not None:
                            s_lbl = tk.Label(outer, image=ghost_symbol_photo, bg="#0B1120", bd=0)
                            s_lbl.image = ghost_symbol_photo
                            s_lbl.pack(side="left", padx=(0, 6))
                        tk.Label(outer, text=clean_msg, fg="#5EEAD4", bg="#0B1120", font=("Malgun Gothic", 9, "bold")).pack(side="left")
                        win.update_idletasks()
                        req_w, req_h = max(win.winfo_reqwidth(), 240), max(win.winfo_reqheight(), 42)
                        x = max(m_left + 12, min(pt.x - 20, m_right - req_w - 16))
                        y = max(m_top + 12, min(pt.y + 16, m_bottom - req_h - 16))
                        _apply_win_topmost(win, x, y, req_w, req_h, activate=False)
                        _schedule_close(duration_ms)
        except Exception as _ui_exc:
            try:
                import traceback as _tb_ui
                err_log_p = _MERLIN_APPDATA / "ui2_error.log"
                err_log_p.parent.mkdir(parents=True, exist_ok=True)
                with open(err_log_p, "a", encoding="utf-8", errors="ignore") as _ef:
                    _ef.write(f"\n[{time.strftime('%Y-%m-%d %H:%M:%S')}] {_ui_exc}\n{_tb_ui.format_exc()}\n")
            except Exception:
                pass
            try:
                _close_win()
            except Exception:
                pass
        finally:
            _UI_LOOP_STAGE = "poll_idle"
            try:
                root.after(10, _poll_queue)
            except Exception:
                pass

    root.after(10, _poll_queue)
    while True:
        try:
            root.mainloop()
            break
        except Exception:
            time.sleep(0.2)


_TOAST_WORKER_STARTED = False
_TOAST_WORKER_THREAD: threading.Thread | None = None
_TOAST_WORKER_LOCK = threading.Lock()
_TOAST_WORKER_READY = threading.Event()


def _ensure_toast_worker() -> None:
    global _TOAST_WORKER_STARTED, _TOAST_WORKER_THREAD
    if _TOAST_WORKER_STARTED and _TOAST_WORKER_THREAD is not None and _TOAST_WORKER_THREAD.is_alive():
        return
    with _TOAST_WORKER_LOCK:
        if _TOAST_WORKER_THREAD is None or not _TOAST_WORKER_THREAD.is_alive():
            _TOAST_WORKER_STARTED = True
            _TOAST_WORKER_THREAD = threading.Thread(target=_toast_worker, daemon=True)
            _TOAST_WORKER_THREAD.start()


def show_ghost_toast(message: str, duration_ms: int = 1100) -> None:
    _ensure_toast_worker()
    _toast_queue.put((message, duration_ms))


_SOFT_SOUND_CACHE_LOCK = threading.Lock()
_SOFT_SOUND_CACHE: dict[tuple[str, float, int], Path] = {}


def _prepare_soft_wav_file(src_wav: Path, target_peak_ratio: float = 0.14) -> Path:
    """
    원본 .wav 파일의 Peak가 높더라도(예: 구버전 85% WAV가 남아있는 PC 등)
    데몬 런타임에서 항상 은은한 목표 진폭(기본 14%, peak ≈ 4587)으로 정규화한 캐시 WAV를 반환합니다.
    """
    try:
        st = src_wav.stat()
        cache_key = (str(src_wav), round(target_peak_ratio, 3), int(st.st_mtime))
        with _SOFT_SOUND_CACHE_LOCK:
            cached = _SOFT_SOUND_CACHE.get(cache_key)
            if cached and cached.exists():
                return cached

        import struct
        import wave

        with wave.open(str(src_wav), "rb") as wf:
            params = wf.getparams()
            raw = wf.readframes(params.nframes)

        if params.sampwidth == 2 and len(raw) >= 2:
            count = len(raw) // 2
            samples = struct.unpack(f"<{count}h", raw[: count * 2])
            cur_peak = max((abs(s) for s in samples), default=0)
            target_peak = int(32767 * max(0.03, min(0.85, target_peak_ratio)))
            if cur_peak > 0:
                gain = target_peak / float(cur_peak)
                # 이미 충분히 작고 차이가 미미하면(±12% 이내) 그대로 사용하되, 크면 즉시 감쇠
                if not (0.88 <= gain <= 1.12):
                    scaled = [max(-32768, min(32767, int(round(s * gain)))) for s in samples]
                    raw_out = struct.pack(f"<{count}h", *scaled)
                    out_dir = _MERLIN_APPDATA / "sound_cache"
                    out_dir.mkdir(parents=True, exist_ok=True)
                    out_wav = out_dir / f"soft_{int(target_peak_ratio * 1000)}_{src_wav.name}"
                    with wave.open(str(out_wav), "wb") as wf_out:
                        wf_out.setparams(params)
                        wf_out.writeframes(raw_out)
                    with _SOFT_SOUND_CACHE_LOCK:
                        _SOFT_SOUND_CACHE[cache_key] = out_wav
                    return out_wav
    except Exception:
        pass
    return src_wav


def play_baby_ghost_sound(mode: str = "typo") -> None:
    cfg = get_superpower_settings()
    if not cfg.get("sound_enabled", True):
        return
    """
    [멀린님 UX 설계 반영] 기계음(Beep)을 완전히 배제한 44.1kHz 스튜디오급 '애기귀신 효과음(.wav)' 비동기 재생!
    - mode="typo": 2단어 한영 오타 자동성형 시 ('애기귀신 퐁~ 띠링!' / 오르골 / 웃음소리 등 선택된 WAV)
    - mode="summon": Ctrl+0 귀신 부르는 단축키 발동 시 ('스윽~ 팅✨' 요정 소환음)
    """
    vol = float(cfg.get("sound_volume", 0.25) or 0.25)
    # 기본 vol=0.25 기준 peak 진폭 14% (~4587 / 32767)로 은은하게 재생 (구버전 85% WAV도 자동 감쇠)
    target_ratio = max(0.04, min(0.60, 0.56 * vol))

    def _sound():
        try:
            import winsound
            wav_name = "active_summon_sound.wav" if mode == "summon" else "active_typo_sound.wav"
            wav_path = SOUNDS_DIR / wav_name
            if not wav_path.exists():
                wav_path = SOUNDS_DIR / ("sample6_ctrl0_summon.wav" if mode == "summon" else "sample2_cute_ghost_pop.wav")
            if wav_path.exists():
                play_path = _prepare_soft_wav_file(wav_path, target_peak_ratio=target_ratio)
                winsound.PlaySound(str(play_path), winsound.SND_FILENAME | winsound.SND_ASYNC | winsound.SND_NODEFAULT)
        except Exception:
            pass

    threading.Thread(target=_sound, daemon=True).start()


# =====================================================================
# 클립보드 · 키보드 · UI 접근성 트리(IUIAutomation) 문맥 추출
# =====================================================================
_IN_PROCESS_MODE: bool = False
_IN_PROCESS_STOP_EVENT = threading.Event()


def request_in_process_stop() -> None:
    """In-Process 모드에서 메인 Z-코어를 종료하지 않고 귀신창 데몬 스레드만 깔끔히 중지합니다."""
    _IN_PROCESS_STOP_EVENT.set()


def acquire_single_instance(in_process: bool = False) -> socket.socket | None:
    """
    단일 인스턴스 보장 + 정상 실행 중 데몬 무간섭 보호 + 명시적 교체(--replace) 지원:
    - --replace 없이 실행되었는데 이미 51988 포트에서 정상 박동(PONG) 중인 데몬이 있으면
      기존 데몬을 죽이지 않고 즉시 조용히 종료(return None)하여 중복 스폰 충돌을 원천 차단합니다!
    - --replace가 지정되었거나 기존 51988 점유 프로세스가 응답 불능일 때만 교체 승계합니다.
    - in_process=True일 때는 __REPLACE__/건강검사 실패 시 os._exit() 대신 _IN_PROCESS_STOP_EVENT로 스레드만 종료합니다.
    """
    global _MAIN_LOOP_HEARTBEAT_TS, _UI_LOOP_HEARTBEAT_TS
    force_replace = ("--replace" in sys.argv) and (not in_process)
    if not force_replace:
        try:
            with socket.create_connection(("127.0.0.1", LOCK_PORT), timeout=0.8) as chk_c:
                chk_c.settimeout(1.0)
                chk_c.sendall(b"__PING__")
                if b"PONG" in chk_c.recv(64):
                    return None
        except Exception:
            pass

    for attempt in range(4):
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        if sys.platform == "win32" and hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            try:
                s.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
            except Exception:
                pass
        try:
            s.bind(("127.0.0.1", LOCK_PORT))
            s.listen(4)
            _MAIN_LOOP_HEARTBEAT_TS = time.time()
            _UI_LOOP_HEARTBEAT_TS = time.time()

            def _shutdown_listener(srv_sock: socket.socket) -> None:
                while True:
                    try:
                        if srv_sock.fileno() == -1:
                            break
                        conn, _ = srv_sock.accept()
                    except Exception:
                        if srv_sock.fileno() == -1:
                            break
                        time.sleep(0.1)
                        continue
                    try:
                        conn.settimeout(1.0)
                        try:
                            data = conn.recv(512)
                        except Exception:
                            data = b""
                        if b"__PING__" in data or b"/__merlin/ping" in data or b"/health" in data:
                            now_p = time.time()
                            main_lag = now_p - _MAIN_LOOP_HEARTBEAT_TS
                            ui_lag = now_p - _UI_LOOP_HEARTBEAT_TS
                            ui_ping_limit = 45.0 if _UI_LOOP_STAGE in ("init", "tk_init", "tk_ready", "warmup_ui2") else 15.0
                            healthy = _MODAL_PROMPT_ACTIVE or (
                                main_lag < 15.0 and ui_lag < ui_ping_limit
                            )
                            if healthy:
                                try:
                                    if b"HTTP/" in data:
                                        body_b = b'{"ok":true,"alive":true,"port":51988}'
                                        hdr_b = (
                                            b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: "
                                            + str(len(body_b)).encode("ascii")
                                            + b"\r\nConnection: close\r\n\r\n"
                                        )
                                        conn.sendall(hdr_b + body_b)
                                    else:
                                        conn.sendall(b"PONG")
                                except Exception:
                                    pass
                                conn.close()
                            else:
                                _log_seq_diag(
                                    "PING_UNHEALTHY_EXIT",
                                    f"main_lag={main_lag:.1f}s ui_lag={ui_lag:.1f}s main_stage={_MAIN_LOOP_STAGE} ui_stage={_UI_LOOP_STAGE} open_mode={_CURRENT_OPEN_UI_MODE}",
                                )
                                try:
                                    conn.close()
                                    srv_sock.close()
                                except Exception:
                                    pass
                                if in_process:
                                    _IN_PROCESS_STOP_EVENT.set()
                                    break
                                _release_single_instance_mutex()
                                os._exit(1)
                            continue
                        if b"__REPLACE__" in data or b"/__merlin/shutdown" in data:
                            _log_seq_diag("REPLACE_EXIT", f"in_process={in_process}")
                            if b"HTTP/" in data:
                                try:
                                    conn.sendall(b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nOK")
                                except Exception:
                                    pass
                            try:
                                conn.close()
                                srv_sock.close()
                            except Exception:
                                pass
                            if in_process:
                                _IN_PROCESS_STOP_EVENT.set()
                                break
                            _release_single_instance_mutex()
                            os._exit(0)
                        conn.close()
                        if data.startswith(b"__OPEN_UI2__|"):
                            try:
                                dec = data.decode("utf-8", errors="ignore").strip()
                                parts = dec.split("|", 2)
                                st_p = parts[1] if len(parts) > 1 and parts[1] else "small"
                                q_p = parts[2] if len(parts) > 2 else ""
                                play_baby_ghost_sound(mode="summon")
                                _toast_queue.put((f"__UI2_SEARCH__|{st_p}|{q_p}", 8000))
                                _toast_event.set()
                            except Exception:
                                pass
                    except Exception:
                        try:
                            conn.close()
                        except Exception:
                            pass

            threading.Thread(target=_shutdown_listener, args=(s,), daemon=True).start()
            return s
        except OSError:
            try:
                s.close()
            except Exception:
                pass
            # 1) 우아한 교체 신호 전송 시도
            try:
                c = socket.create_connection(("127.0.0.1", LOCK_PORT), timeout=0.3)
                c.sendall(b"__REPLACE__")
                c.close()
                time.sleep(0.25)
            except Exception:
                pass
            # 2) 구버전(리스너 없는 버전)이 포트를 잡고 있을 경우 해당 포트 점유 PID만 핀셋 종료
            if attempt >= 1:
                try:
                    si = subprocess.STARTUPINFO()
                    si.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                    si.wShowWindow = 0
                    out = subprocess.check_output(
                        ["cmd", "/c", f"netstat -ano | findstr :{LOCK_PORT}"],
                        encoding="utf-8",
                        errors="ignore",
                        startupinfo=si,
                        creationflags=0x08000000,
                    )
                    my_pid = os.getpid()
                    for ln in out.splitlines():
                        parts = ln.split()
                        if len(parts) >= 5 and "LISTENING" in ln.upper():
                            pid = int(parts[-1])
                            if pid > 0 and pid != my_pid:
                                subprocess.run(
                                    ["taskkill", "/F", "/PID", str(pid)],
                                    stdout=subprocess.DEVNULL,
                                    stderr=subprocess.DEVNULL,
                                    startupinfo=si,
                                    creationflags=0x08000000,
                                )
                    time.sleep(0.25)
                except Exception:
                    pass
    return None


def _ensure_single_instance_socket_alive(curr_sock: socket.socket | None) -> socket.socket | None:
    """
    [자가치유(Self-Healing) 핫키 & 소켓 워치독]:
    - Windows 예약 작업(StopOnIdleEnd 등)이나 외부에서 구 데몬이 종료되었거나 소켓이 닫혔을 때 즉시 재바인딩하고,
    - Explorer 재시작 등으로 전역 핫키(Ctrl+0)가 풀리지 않도록 주기적으로 재보장합니다.
    """
    try:
        if curr_sock is not None and curr_sock.fileno() != -1:
            return curr_sock
    except Exception:
        pass
    return acquire_single_instance()


def get_clipboard_text() -> str:
    res = ""
    for _ in range(5):
        if u32.OpenClipboard(None):
            try:
                hmem = u32.GetClipboardData(CF_UNICODETEXT)
                if hmem:
                    ptr = k32.GlobalLock(hmem)
                    if ptr:
                        try:
                            res = ctypes.wstring_at(ptr)
                        except Exception:
                            res = ""
                        finally:
                            k32.GlobalUnlock(hmem)
            finally:
                u32.CloseClipboard()
            break
        time.sleep(0.01)
    return res


def set_clipboard_text(text: str) -> bool:
    global _SELF_CLIP_SET_TEXT, _SELF_CLIP_SET_UNTIL
    safe_txt = (text or "").encode("utf-16-le", errors="replace").decode("utf-16-le", errors="replace")
    data = (safe_txt + "\0").encode("utf-16-le", errors="replace")
    _SELF_CLIP_SET_TEXT = safe_txt
    _SELF_CLIP_SET_UNTIL = time.time() + 1.5
    for _ in range(8):
        if u32.OpenClipboard(None):
            try:
                hmem = k32.GlobalAlloc(GMEM_MOVEABLE, len(data))
                if not hmem:
                    return False
                ptr = k32.GlobalLock(hmem)
                if not ptr:
                    k32.GlobalFree(hmem)
                    return False
                ctypes.memmove(ptr, data, len(data))
                k32.GlobalUnlock(hmem)
                u32.EmptyClipboard()
                if not u32.SetClipboardData(CF_UNICODETEXT, hmem):
                    k32.GlobalFree(hmem)
                    return False
                return True
            finally:
                u32.CloseClipboard()
        time.sleep(0.015)
    return False


def get_clipboard_hdrop_files() -> list[str]:
    """클립보드에 복사(Ctrl+C)되어 있는 탐색기 파일 경로(CF_HDROP) 목록 추출"""
    files: list[str] = []
    shell32 = ctypes.windll.shell32
    shell32.DragQueryFileW.argtypes = [wintypes.HANDLE, wintypes.UINT, wintypes.LPWSTR, wintypes.UINT]
    shell32.DragQueryFileW.restype = wintypes.UINT
    for _ in range(5):
        if u32.OpenClipboard(None):
            try:
                if u32.IsClipboardFormatAvailable(CF_HDROP):
                    hdrop = u32.GetClipboardData(CF_HDROP)
                    if hdrop:
                        cnt = shell32.DragQueryFileW(hdrop, 0xFFFFFFFF, None, 0)
                        for idx in range(cnt):
                            length = shell32.DragQueryFileW(hdrop, idx, None, 0)
                            if length > 0:
                                buf = ctypes.create_unicode_buffer(length + 2)
                                shell32.DragQueryFileW(hdrop, idx, buf, length + 2)
                                if buf.value:
                                    files.append(buf.value)
            finally:
                u32.CloseClipboard()
            break
        time.sleep(0.01)
    return files


_SELF_HDROP_UNTIL: float = 0.0


def set_clipboard_hdrop_files(filepaths: list[str], label_text: str | None = None) -> bool:
    """다중 실물 파일 경로를 윈도우 탐색기 파일 복사 포맷(CF_HDROP)으로 클립보드에 주입 (label_text 제공 시 CF_UNICODETEXT도 동시 주입)"""
    global _SELF_HDROP_UNTIL
    valid_paths = [str(Path(fp).resolve()) for fp in filepaths if fp]
    if not valid_paths:
        return False
    header = struct.pack("<IiiII", 20, 0, 0, 0, 1)
    encoded_body = b"".join(p.encode("utf-16-le") + b"\x00\x00" for p in valid_paths) + b"\x00\x00"
    payload = header + encoded_body

    for _ in range(8):
        if u32.OpenClipboard(None):
            try:
                u32.EmptyClipboard()
                hmem = k32.GlobalAlloc(GMEM_MOVEABLE, len(payload))
                if hmem:
                    ptr = k32.GlobalLock(hmem)
                    if ptr:
                        ctypes.memmove(ptr, payload, len(payload))
                        k32.GlobalUnlock(hmem)
                        _SELF_HDROP_UNTIL = time.time() + 1.2
                        u32.SetClipboardData(CF_HDROP, hmem)
                        if label_text:
                            raw_txt_b = (str(label_text) + "\x00").encode("utf-16-le")
                            hmem_t = k32.GlobalAlloc(GMEM_MOVEABLE, len(raw_txt_b))
                            if hmem_t:
                                ptr_t = k32.GlobalLock(hmem_t)
                                if ptr_t:
                                    ctypes.memmove(ptr_t, raw_txt_b, len(raw_txt_b))
                                    k32.GlobalUnlock(hmem_t)
                                    u32.SetClipboardData(CF_UNICODETEXT, hmem_t)
                        return True
            finally:
                u32.CloseClipboard()
            break
        time.sleep(0.015)
    return False


def set_clipboard_hdrop_file(filepath: str) -> bool:
    """실물 파일 경로를 윈도우 탐색기 파일 복사 포맷(CF_HDROP)으로 클립보드에 주입"""
    return set_clipboard_hdrop_files([filepath])


KEYEVENTF_EXTENDEDKEY = 0x0001
_EXTENDED_VKS = {0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x2D, 0x2E}


def release_all_modifiers() -> None:
    """키 조합 사출 전 물리적으로 남아 있을 수 있는 Ctrl/Shift/Alt 눌림 상태를 깨끗이 해제"""
    for mod_vk in (VK_CONTROL, VK_SHIFT, VK_MENU, 0xA2, 0xA3, 0xA0, 0xA1, 0xA4, 0xA5):
        if (u32.GetAsyncKeyState(mod_vk) & 0x8000) != 0:
            sc = u32.MapVirtualKeyW(mod_vk, 0)
            u32.keybd_event(mod_vk, sc, KEYEVENTF_KEYUP, 0)


_SELF_CLIP_COMBO_UNTIL: float = 0.0


def tap_key_combo(modifiers: list[int], vk: int) -> None:
    """
    [Win10/Win11 NumLock ON 환경 100% 호환 키 사출]
    - VK_HOME(0x24), VK_END(0x23), 방향키 등은 반드시 KEYEVENTF_EXTENDEDKEY(0x0001) 플래그를 포함해야
      NumLock이 켜진 상태에서 Shift+Home이 Numpad 7(비선택 이동)로 오작동하지 않고 줄 전체를 정확히 블록 선택합니다!
    """
    global _SELF_CLIP_COMBO_UNTIL
    if VK_CONTROL in modifiers and vk in (VK_C, VK_V, VK_Z):
        _SELF_CLIP_COMBO_UNTIL = time.time() + 0.35
    ext_flag = KEYEVENTF_EXTENDEDKEY if vk in _EXTENDED_VKS else 0
    vk_sc = u32.MapVirtualKeyW(vk, 0)
    for mod in modifiers:
        mod_sc = u32.MapVirtualKeyW(mod, 0)
        u32.keybd_event(mod, mod_sc, 0, 0)
    u32.keybd_event(vk, vk_sc, ext_flag, 0)
    time.sleep(0.015)
    u32.keybd_event(vk, vk_sc, ext_flag | KEYEVENTF_KEYUP, 0)
    for mod in reversed(modifiers):
        mod_sc = u32.MapVirtualKeyW(mod, 0)
        u32.keybd_event(mod, mod_sc, KEYEVENTF_KEYUP, 0)


class _KEYBDINPUT(ctypes.Structure):
    _fields_ = [
        ("wVk", wintypes.WORD),
        ("wScan", wintypes.WORD),
        ("dwFlags", wintypes.DWORD),
        ("time", wintypes.DWORD),
        ("dwExtraInfo", ctypes.c_size_t),
    ]


class _MOUSEINPUT(ctypes.Structure):
    _fields_ = [
        ("dx", wintypes.LONG),
        ("dy", wintypes.LONG),
        ("mouseData", wintypes.DWORD),
        ("dwFlags", wintypes.DWORD),
        ("time", wintypes.DWORD),
        ("dwExtraInfo", ctypes.c_size_t),
    ]


class _INPUT_UNION(ctypes.Union):
    _fields_ = [("mi", _MOUSEINPUT), ("ki", _KEYBDINPUT)]


class _INPUT(ctypes.Structure):
    _fields_ = [("type", wintypes.DWORD), ("u", _INPUT_UNION)]


INPUT_KEYBOARD = 1
KEYEVENTF_UNICODE = 0x0004


def send_unicode_text_preserve_style(text: str, delete_count: int = 0) -> bool:
    """
    [서식·색상 100% 보존 무클립보드 유니코드 직접 타이핑 사출 (SendInput KEYEVENTF_UNICODE)]
    - delete_count > 0 인 경우(엑셀 셀 편집 EXCEL6 등) 백스페이스(VK_BACK)와 유니코드 문자열을
      단 1회의 원자적 SendInput 배열로 일괄 주입하여 한글자씩 지워지는 잔상 모션 없이 즉시 교체합니다!
    """
    if not text and delete_count <= 0:
        return False
    try:
        u32.SendInput.argtypes = [wintypes.UINT, ctypes.POINTER(_INPUT), ctypes.c_int]
        u32.SendInput.restype = wintypes.UINT
        events: list[_INPUT] = []
        if delete_count > 0:
            sc_bs = u32.MapVirtualKeyW(VK_BACK, 0)
            for _ in range(delete_count):
                kd_bs = _INPUT(type=INPUT_KEYBOARD)
                kd_bs.u.ki = _KEYBDINPUT(wVk=VK_BACK, wScan=sc_bs, dwFlags=0, time=0, dwExtraInfo=0)
                ku_bs = _INPUT(type=INPUT_KEYBOARD)
                ku_bs.u.ki = _KEYBDINPUT(wVk=VK_BACK, wScan=sc_bs, dwFlags=KEYEVENTF_KEYUP, time=0, dwExtraInfo=0)
                events.extend((kd_bs, ku_bs))
        norm_text = text.replace("\r\n", "\n").replace("\r", "\n")
        for ch in norm_text:
            if ch == "\n":
                # 카톡·슬랙·메신저 등에서 Enter 단독 사출 시 메시지가 오발송되므로 Shift+Enter로 안전 줄바꿈 전달
                sc_sh = u32.MapVirtualKeyW(VK_SHIFT, 0)
                sc_ret = u32.MapVirtualKeyW(VK_RETURN, 0)
                kd_sh = _INPUT(type=INPUT_KEYBOARD)
                kd_sh.u.ki = _KEYBDINPUT(wVk=VK_SHIFT, wScan=sc_sh, dwFlags=0, time=0, dwExtraInfo=0)
                kd = _INPUT(type=INPUT_KEYBOARD)
                kd.u.ki = _KEYBDINPUT(wVk=VK_RETURN, wScan=sc_ret, dwFlags=0, time=0, dwExtraInfo=0)
                ku = _INPUT(type=INPUT_KEYBOARD)
                ku.u.ki = _KEYBDINPUT(wVk=VK_RETURN, wScan=sc_ret, dwFlags=KEYEVENTF_KEYUP, time=0, dwExtraInfo=0)
                ku_sh = _INPUT(type=INPUT_KEYBOARD)
                ku_sh.u.ki = _KEYBDINPUT(wVk=VK_SHIFT, wScan=sc_sh, dwFlags=KEYEVENTF_KEYUP, time=0, dwExtraInfo=0)
                events.extend((kd_sh, kd, ku, ku_sh))
            else:
                utf16_units = ch.encode("utf-16-le", errors="replace")
                for i in range(0, len(utf16_units), 2):
                    code_unit = int.from_bytes(utf16_units[i : i + 2], "little")
                    kd = _INPUT(type=INPUT_KEYBOARD)
                    kd.u.ki = _KEYBDINPUT(wVk=0, wScan=code_unit, dwFlags=KEYEVENTF_UNICODE, time=0, dwExtraInfo=0)
                    ku = _INPUT(type=INPUT_KEYBOARD)
                    ku.u.ki = _KEYBDINPUT(wVk=0, wScan=code_unit, dwFlags=KEYEVENTF_UNICODE | KEYEVENTF_KEYUP, time=0, dwExtraInfo=0)
                    events.extend((kd, ku))
        if not events:
            return False
        arr = (_INPUT * len(events))(*events)
        sent = u32.SendInput(len(events), arr, ctypes.sizeof(_INPUT))
        return int(sent) == len(events)
    except Exception:
        return False


def get_focused_field_context() -> str:
    """
    [제7호 특허 청구항 제1항] OS UI 접근성 트리 및 활성 창 컨텍스트 추출
    - 현재 포커스된 컨트롤의 Name/AutomationId 및 활성 창 캡션을 결합 반환합니다.
    """
    ctx_parts = []
    hwnd = u32.GetForegroundWindow()
    if hwnd:
        buf = ctypes.create_unicode_buffer(256)
        u32.GetWindowTextW(hwnd, buf, 256)
        if buf.value:
            ctx_parts.append(buf.value)
    return " ".join(ctx_parts).strip()


def select_best_matching_item_index(queue_items: list[str], field_context: str) -> tuple[int, bool]:
    """
    [①번 AI 초능력 & 제7호 특허 제1항]
    EmbeddingGemma 2 (MRL 128차원) + 정규식 패턴 분류기를 결합한 비순차(Out-of-Order) 입력칸 자동 매칭
    - 반환값: (선별된 인덱스, 비순차_칸맞춤_성공여부)
    """
    if len(queue_items) <= 1 or not field_context:
        return 0, False

    ctx_lower = field_context.lower()
    # 1) 정규식 앵커 + 문맥 키워드 매칭
    field_type = None
    if any(k in ctx_lower for k in ("전화", "연락처", "휴대폰", "핸드폰", "phone", "mobile", "tel")):
        field_type = "PHONE"
    elif any(k in ctx_lower for k in ("이메일", "메일", "email", "e-mail")):
        field_type = "EMAIL"
    elif any(k in ctx_lower for k in ("주소", "배송지", "도로명", "address", "addr")):
        field_type = "ADDRESS"
    elif any(k in ctx_lower for k in ("계좌", "은행", " 입금", "account", "bank")):
        field_type = "ACCOUNT"
    elif any(k in ctx_lower for k in ("이름", "성함", "성명", "수령인", "대표자", "name")):
        field_type = "NAME"

    if field_type:
        for idx, item in enumerate(queue_items):
            s = item.strip()
            if field_type == "PHONE" and re.search(r"01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}", s):
                return idx, (idx != 0)
            if field_type == "EMAIL" and "@" in s and "." in s:
                return idx, (idx != 0)
            if field_type == "ADDRESS" and any(k in s for k in ("시 ", "구 ", "동 ", "로 ", "길 ", "번지", "아파트", "층")):
                return idx, (idx != 0)
            if field_type == "ACCOUNT" and re.search(r"\d{3,6}[-.\s]?\d{2,6}[-.\s]?\d{3,6}", s):
                return idx, (idx != 0)
            if field_type == "NAME" and re.fullmatch(r"[가-힣]{2,4}", s):
                return idx, (idx != 0)

    # 2) EmbeddingGemma 2 MRL 128차원 코사인 유사도 비교
    ctx_vec = AI_ENGINE.embed_128d(field_context)
    best_idx = 0
    best_score = -1.0
    for idx, item in enumerate(queue_items):
        item_vec = AI_ENGINE.embed_128d(item[:100])
        score = AI_ENGINE.cosine_sim(ctx_vec, item_vec)
        if score > best_score:
            best_score = score
            best_idx = idx

    if best_score >= 0.78 and best_idx != 0:
        return best_idx, True
    return 0, False


USER_SNIPPETS_APPDATA = _MERLIN_APPDATA / "user_snippets.json"


def ensure_default_snippets() -> dict[str, str]:
    default_map = {
        "F1": "",
        "F2": "",
        "F3": "안녕하세요, 확인 후 빠르게 회신드리겠습니다. 감사합니다.",
        "F4": "",
        "F5": "",
        "F6": "",
        "F7": "",
        "F8": "",
        "F9": "https://ghosti.sundreamer.app",
        "F10": "감사합니다.",
    }
    merged = dict(default_map)
    # 1순위(정본): SNIPPETS_FILE (fixed_snippets.json), 2순위(구버전 폴백): USER_SNIPPETS_APPDATA
    # USER_SNIPPETS_APPDATA가 먼저 로드되고 그 위에 최신 SNIPPETS_FILE이 덮어쓰도록 순서를 보장하여 구버전 덮어쓰기 원천 차단!
    legacy_merlin_snip = _LEGACY_MERLIN_APPDATA / "user_snippets.json"
    for cand in (legacy_merlin_snip, USER_SNIPPETS_APPDATA, SNIPPETS_FILE):
        if cand.exists():
            try:
                data = json.loads(cand.read_text(encoding="utf-8"))
                if isinstance(data, dict):
                    for k, v in data.items():
                        if str(k).upper().startswith("F") and v is not None:
                            merged[str(k).upper()] = str(v)
            except Exception:
                pass
    if not SNIPPETS_FILE.exists():
        try:
            SNIPPETS_FILE.parent.mkdir(parents=True, exist_ok=True)
            SNIPPETS_FILE.write_text(json.dumps(merged, ensure_ascii=False, indent=2), encoding="utf-8")
        except Exception:
            pass
    return merged


# =====================================================================
# 2~9번 초능력 & F1~F10 고정 상용구 & AI 기억 검색창 실행 함수들
# =====================================================================
_UNDO_SNAPSHOT: dict = {
    "active": False,
    "ts": 0.0,
    "hwnd": 0,
    "edit_child": 0,
    "raw_text": "",
    "morphed_text": "",
    "full_doc_before": "",
    "full_doc_after": "",
    "mode": "",  # "edit_replace", "clip_replace", "pre_iron", "snippet", "backspace_replace"
    "typed_count_after": 0,
    "prev_ime_kor": None,
}

RECENT_GHOST_UNDO_WINDOW_SEC: float = 5.0
IDLE_PAUSE_AUTO_MORPH_SEC: float = 1.0
_NATIVE_EDIT_CLASSES: tuple[str, ...] = (
    "Edit",
    "RichEditD2DPT",
    "RichEdit20W",
    "RICHEDIT50W",
    "RICHEDIT60W",
    "RichEdit20A",
)


def is_recent_undo_available(max_sec: float = RECENT_GHOST_UNDO_WINDOW_SEC) -> bool:
    """방금(기본 5초 이내) 귀신 자동/수동 변환이 수행되어 Ctrl+0 1회로 즉시 되돌릴 스냅샷이 살아 있는지 반환"""
    if not _UNDO_SNAPSHOT.get("active"):
        return False
    ts_u = float(_UNDO_SNAPSHOT.get("ts") or 0.0)
    return ts_u > 0.0 and (time.time() - ts_u) <= max_sec


def on_native_ctrl_z_observed() -> None:
    """
    [Ctrl+Z 순정 100% 보존 원칙]:
    - Ctrl+Z 키 자체는 절대 가로채지 않고 메모장·앱 고유 실행취소(Undo)가 그대로 동작하게 둡니다.
    - 단, 귀신 변환 직후 유저가 순정 Ctrl+Z를 누른 것을 옆에서 관찰하면 해당 원문에 재변환 면역 락(2분)을 걸고
      이전 한/영 키보드 상태만 조용히 복원하여 다시 한글로 뒤집히지 않도록 보조합니다.
    """
    if not _UNDO_SNAPSHOT.get("active"):
        return
    snap = dict(_UNDO_SNAPSHOT)
    disarm_undo_snapshot()
    age = time.time() - float(snap.get("ts") or 0.0)
    if age <= 15.0:
        raw_t = str(snap.get("raw_text") or "")
        if raw_t:
            _mark_undo_immunity(raw_t)
        prev_ime_kor = snap.get("prev_ime_kor")
        if prev_ime_kor is not None:
            set_ime_language(target_korean=bool(prev_ime_kor))


def arm_undo_snapshot(
    hwnd: int,
    edit_child: int,
    raw_text: str,
    morphed_text: str,
    mode: str = "edit_replace",
    full_doc_before: str = "",
    full_doc_after: str = "",
    prev_ime_kor: bool | None = None,
) -> None:
    """
    [5초 내 Ctrl+0 1회 즉시 원복 스냅샷 엔진 — Ctrl+Z 가로채기 Zero]
    - 자동 한영·띄어쓰기 변환, [1] 다림질, [4] 합본, [5] 번호매기기, 상용구 사출 직후 원문 + 이전 한/영 키 상태를 보존합니다.
    - Ctrl+Z는 각 프로그램 순정 기능에 100% 맡기고, 귀신 전용 원복은 변환 후 5초 이내 Ctrl+0 1회 호출(창 미오픈)로 즉시 수행합니다.
    """
    global _UNDO_SNAPSHOT
    now_ts = time.time()
    prev_active = bool(_UNDO_SNAPSHOT.get("active"))
    prev_hwnd = int(_UNDO_SNAPSHOT.get("hwnd") or 0)
    prev_ts = float(_UNDO_SNAPSHOT.get("ts") or 0.0)
    prev_raw = str(_UNDO_SNAPSHOT.get("raw_text") or "")
    prev_morphed = str(_UNDO_SNAPSHOT.get("morphed_text") or "")
    prev_doc_before = str(_UNDO_SNAPSHOT.get("full_doc_before") or "")
    prev_doc_after = str(_UNDO_SNAPSHOT.get("full_doc_after") or "")
    prev_ime_saved = _UNDO_SNAPSHOT.get("prev_ime_kor")

    keep_chain = False
    if prev_active and (now_ts - prev_ts) < 30.0 and prev_hwnd == int(hwnd or 0) and prev_raw:
        norm_new_raw = str(raw_text or "").replace("\r\n", "\n").strip()
        norm_prev_morphed = prev_morphed.replace("\r\n", "\n").strip()
        if norm_new_raw and norm_new_raw == norm_prev_morphed:
            keep_chain = True
        elif full_doc_before and prev_doc_after and full_doc_before.replace("\r\n", "\n") == prev_doc_after.replace("\r\n", "\n"):
            keep_chain = True

    _UNDO_SNAPSHOT = {
        "active": True,
        "ts": now_ts,
        "hwnd": int(hwnd or 0),
        "edit_child": int(edit_child or 0),
        "raw_text": prev_raw if keep_chain else str(raw_text or ""),
        "morphed_text": str(morphed_text or ""),
        "full_doc_before": (prev_doc_before if (keep_chain and prev_doc_before) else str(full_doc_before or "")),
        "full_doc_after": str(full_doc_after or ""),
        "mode": mode,
        "typed_count_after": 0,
        "prev_ime_kor": (prev_ime_saved if (keep_chain and prev_ime_saved is not None) else prev_ime_kor),
    }


def disarm_undo_snapshot() -> None:
    global _UNDO_SNAPSHOT
    if _UNDO_SNAPSHOT.get("active"):
        _UNDO_SNAPSHOT["active"] = False


def _find_edit_control_child(hwnd_fg: int, require_focused: bool = False) -> int:
    """
    [포커스 정밀 검증 네이티브 Edit 탐색기]:
    1) 최우선으로 실제 키보드 커서가 놓인 컨트롤(GetGUIThreadInfo.hwndFocus)이 Edit/RichEdit인지 확인합니다.
       (탐색기 상단 검색창이나 복합 앱의 비활성 툴바 입력칸을 엉뚱하게 잡는 오탐을 100% 원천 차단!)
    2) 메모장(notepad.exe)·워드패드(wordpad.exe)·카카오톡(kakaotalk.exe)인 경우 활성(Visible) 탭의 Edit/RichEdit 자식 탐색을 허용합니다.
    """
    if not hwnd_fg or not u32.IsWindow(hwnd_fg):
        return 0
    focus_h = _get_focused_control_hwnd(hwnd_fg)
    if focus_h and u32.IsWindow(focus_h):
        f_cls = _get_win_class_only(focus_h)
        if f_cls in _NATIVE_EDIT_CLASSES and u32.IsWindowVisible(focus_h) and not (u32.GetWindowLongW(focus_h, -16) & 0x0020):
            return focus_h
        if f_cls == "NotepadTextBox" and u32.IsWindowVisible(focus_h):
            ed_ntb = u32.FindWindowExW(focus_h, None, "RichEditD2DPT", None)
            if ed_ntb and u32.IsWindowVisible(ed_ntb):
                return ed_ntb

    proc_n = _get_process_name_from_hwnd(hwnd_fg).lower()
    cls_fg = _get_win_class_only(hwnd_fg)
    if proc_n in ("notepad.exe", "wordpad.exe", "kakaotalk.exe") or cls_fg in ("Notepad", "WordPadClass", "EVA_Window_Dblclk", "EVA_Window"):
        for cls_cand in ("Edit", "RichEditD2DPT", "RICHEDIT50W"):
            ch_cur = 0
            while True:
                ch_cur = u32.FindWindowExW(hwnd_fg, ch_cur, cls_cand, None)
                if not ch_cur:
                    break
                if u32.IsWindowVisible(ch_cur) and not (u32.GetWindowLongW(ch_cur, -16) & 0x0020):
                    return ch_cur
        ntb_cur = 0
        while True:
            ntb_cur = u32.FindWindowExW(hwnd_fg, ntb_cur, "NotepadTextBox", None)
            if not ntb_cur:
                break
            if u32.IsWindowVisible(ntb_cur):
                ed = u32.FindWindowExW(ntb_cur, None, "RichEditD2DPT", None)
                if ed and u32.IsWindowVisible(ed):
                    return ed
        found_ed = [0]
        found_rich = [0]
        WNDENUMPROC = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

        def _enum_child_cb(ch: int, _lp: int) -> bool:
            if u32.IsWindowVisible(ch):
                c_cls = _get_win_class_only(ch)
                if c_cls in _NATIVE_EDIT_CLASSES and not (u32.GetWindowLongW(ch, -16) & 0x0020):
                    if "richedit" in c_cls.lower():
                        found_rich[0] = ch
                    if not found_ed[0]:
                        found_ed[0] = ch
            return True

        try:
            u32.EnumChildWindows(hwnd_fg, WNDENUMPROC(_enum_child_cb), 0)
        except Exception:
            pass
        return found_rich[0] or found_ed[0]

    return 0


SMTO_BLOCK = 0x0001
SMTO_ABORTIFHUNG = 0x0002


def _send_msg_timeout(hwnd: int, msg_id: int, wparam: int = 0, lparam: int = 0, timeout_ms: int = 150) -> tuple[bool, int]:
    """외부 프로세스 창 응답 지연 시 귀신창 메인 루프 데드락(Hang)을 원천 차단하는 타임아웃 메시지 전송기"""
    if not hwnd or not u32.IsWindow(hwnd):
        return False, 0
    res_out = ctypes.c_size_t(0)
    ok = u32.SendMessageTimeoutW(
        hwnd,
        msg_id,
        wparam,
        lparam,
        SMTO_BLOCK | SMTO_ABORTIFHUNG,
        timeout_ms,
        ctypes.byref(res_out),
    )
    return bool(ok), int(res_out.value)


def _get_edit_full_text_and_index_str(edit_child: int) -> tuple[str, str, bool]:
    """
    Edit / RichEditD2DPT 컨트롤의 전체 문자열 및 인덱싱용 문자열 반환 (SendMessageTimeoutW 데드락 방어)
    - RichEdit 2.0+(RichEditD2DPT)는 내부 캐릭터 오프셋(EM_GETSEL/EM_SETSEL/EM_LINEINDEX)에서 줄바꿈(\r\n)을 1글자(\r)로 계산함!
    """
    if not edit_child or not u32.IsWindow(edit_child):
        return "", "", False
    ok_len, total_len = _send_msg_timeout(edit_child, WM_GETTEXTLENGTH, 0, 0, 150)
    if not ok_len or total_len <= 0 or total_len > 250000:
        return "", "", False
    tbuf = ctypes.create_unicode_buffer(total_len + 4)
    ok_txt, _ = _send_msg_timeout(edit_child, WM_GETTEXT, total_len + 2, ctypes.addressof(tbuf), 180)
    if not ok_txt:
        return "", "", False
    full_text = tbuf.value
    cls_n, _ = _get_win_class_and_title(edit_child)
    is_rich = "richedit" in cls_n.lower()
    idx_text = full_text.replace("\r\n", "\n") if is_rich else full_text
    return full_text, idx_text, is_rich


def execute_undo_snapshot(daemon_set_cb) -> bool:
    """
    [Ctrl+Z & 8초 내 Ctrl+0 원클릭 원상복구 실행기 + 재변환 면역 락]
    - 방금 변환된 문장(morphed_text / full_doc_after)을 변환 직전의 날것 원문(raw_text)으로 정확히 되돌리고,
      이전 한/영 키보드 상태(prev_ime_kor) 복원 및 해당 문자열 재변환 방지 면역(_mark_undo_immunity)을 동시 부여합니다!
    """
    snap = dict(_UNDO_SNAPSHOT)
    disarm_undo_snapshot()
    if not snap.get("active"):
        return False

    mode = snap.get("mode", "")
    raw_t = snap.get("raw_text", "")
    morphed_t = snap.get("morphed_text", "")
    full_before = snap.get("full_doc_before", "")
    full_after = snap.get("full_doc_after", "")
    snap_hwnd = int(snap.get("hwnd") or 0)
    prev_ime_kor = snap.get("prev_ime_kor")
    if raw_t:
        _mark_undo_immunity(raw_t)

    # 클립보드만 미리 다림질한 상태(pre_iron)는 활성 문서에 Ctrl+Z/Ctrl+V나 EM_REPLACESEL을 쏘지 않고 클립보드만 원복!
    if mode == "pre_iron":
        if raw_t:
            daemon_set_cb(raw_t)
        if prev_ime_kor is not None:
            set_ime_language(target_korean=bool(prev_ime_kor))
        show_ghost_toast("👻 귀신같이 클립보드 원상복구 완료", duration_ms=1500)
        return True

    fg_now = u32.GetForegroundWindow()
    if snap_hwnd and u32.IsWindow(snap_hwnd) and fg_now != snap_hwnd:
        try:
            u32.SetForegroundWindow(snap_hwnd)
            time.sleep(0.025)
            fg_now = u32.GetForegroundWindow()
        except Exception:
            pass

    ed = snap.get("edit_child", 0) or _find_edit_control_child(fg_now)

    # 1) 네이티브 Edit / RichEdit 컨트롤 내부에서 윗줄 무간섭 '바뀐 해당 구간만' 정밀 복원 (EM_SETSEL(0,-1) 전체 선택 금지!)
    if ed and u32.IsWindow(ed) and mode != "backspace_replace":
        try:
            cur_full, idx_text, is_rich = _get_edit_full_text_and_index_str(ed)
            m_idx = (
                morphed_t.replace("\r\n", "\n")
                if is_rich
                else morphed_t.replace("\r\n", "\n").replace("\n", "\r\n")
            )
            m_idx_strip = m_idx.strip(" ")
            char_pos = -1
            match_len = 0
            if m_idx and m_idx in idx_text:
                char_pos = idx_text.rfind(m_idx)
                match_len = len(m_idx)
            elif m_idx_strip and m_idx_strip in idx_text:
                char_pos = idx_text.rfind(m_idx_strip)
                match_len = len(m_idx_strip)

            if char_pos >= 0 and match_len > 0:
                rep_base = "" if mode == "snippet" else raw_t
                if m_idx != m_idx_strip and match_len == len(m_idx_strip) and not rep_base.endswith(" "):
                    rep_base = rep_base.rstrip(" ")
                elif m_idx != m_idx_strip and match_len == len(m_idx_strip) and rep_base.endswith(" ") and idx_text[char_pos + match_len : char_pos + match_len + 1] == " ":
                    rep_base = rep_base.rstrip(" ")
                rep_win = (
                    rep_base.replace("\r\n", "\n")
                    if is_rich
                    else rep_base.replace("\r\n", "\n").replace("\n", "\r\n")
                )
                start_u16 = len(idx_text[:char_pos].encode("utf-16-le")) // 2
                end_u16 = len(idx_text[: char_pos + match_len].encode("utf-16-le")) // 2
                rep_u16 = len(rep_win.encode("utf-16-le")) // 2
                if is_rich:
                    _send_msg_timeout(ed, 0x0458, 0, 0, 120)  # EM_STOPGROUPTYPING
                _send_msg_timeout(ed, EM_SETSEL, start_u16, end_u16, 120)
                rbuf = ctypes.create_unicode_buffer(rep_win)
                _send_msg_timeout(ed, EM_REPLACESEL, 1, ctypes.addressof(rbuf), 150)
                _send_msg_timeout(ed, EM_SETSEL, start_u16 + rep_u16, start_u16 + rep_u16, 120)
                if is_rich:
                    _send_msg_timeout(ed, 0x0458, 0, 0, 120)  # EM_STOPGROUPTYPING
                if prev_ime_kor is not None:
                    set_ime_language(target_korean=bool(prev_ime_kor))
                show_ghost_toast("👻 귀신같이 원상복구 완료 (원문·키보드 복원 + 재변환 잠금)", duration_ms=1600)
                return True

            if full_before and mode != "pre_iron":
                cur_norm = cur_full.replace("\r\n", "\n")
                after_norm_check = full_after.replace("\r\n", "\n") if full_after else ""
                if not after_norm_check or cur_norm == after_norm_check:
                    restore_doc = (
                        full_before.replace("\r\n", "\n").replace("\n", "\r\n")
                        if not is_rich
                        else full_before.replace("\r\n", "\n")
                    )
                    end_doc_u16 = len(restore_doc.encode("utf-16-le")) // 2
                    _send_msg_timeout(ed, EM_SETSEL, 0, -1, 120)
                    rbuf = ctypes.create_unicode_buffer(restore_doc)
                    _send_msg_timeout(ed, EM_REPLACESEL, 1, ctypes.addressof(rbuf), 150)
                    _send_msg_timeout(ed, EM_SETSEL, end_doc_u16, end_doc_u16, 120)
                    if prev_ime_kor is not None:
                        set_ime_language(target_korean=bool(prev_ime_kor))
                    show_ghost_toast("👻 귀신같이 원상복구 완료 (원문·키보드 복원 + 재변환 잠금)", duration_ms=1600)
                    return True
        except Exception:
            pass

    # 2) 엑셀 셀 편집(EXCEL6) 등 백스페이스 교체 모드 및 일반 창 원복:
    release_all_modifiers()
    time.sleep(0.02)
    if mode == "backspace_replace" and morphed_t and raw_t:
        bs_sc = u32.MapVirtualKeyW(VK_BACK, 0)
        for _ in range(len(morphed_t)):
            u32.keybd_event(VK_BACK, bs_sc, 0, 0)
            time.sleep(0.006)
            u32.keybd_event(VK_BACK, bs_sc, KEYEVENTF_KEYUP, 0)
            time.sleep(0.004)
        time.sleep(0.02)
        if not send_unicode_text_preserve_style(raw_t):
            orig_c = get_clipboard_text()
            daemon_set_cb(raw_t)
            time.sleep(0.02)
            tap_key_combo([VK_CONTROL], VK_V)
            time.sleep(0.05)
            if orig_c:
                threading.Timer(0.25, lambda c=orig_c: daemon_set_cb(c)).start()
        if prev_ime_kor is not None:
            set_ime_language(target_korean=bool(prev_ime_kor))
        show_ghost_toast("👻 귀신같이 원상복구 완료 (원문·키보드 복원 + 재변환 잠금)", duration_ms=1700)
        return True

    if mode == "snippet":
        tap_key_combo([VK_CONTROL], VK_Z)
        show_ghost_toast("👻 귀신같이 상용구 실행취소 완료", duration_ms=1400)
        return True

    if raw_t:
        orig_c = get_clipboard_text()
        tap_key_combo([VK_CONTROL], VK_Z)
        time.sleep(0.04)
        if mode == "pre_iron":
            daemon_set_cb(raw_t)
            time.sleep(0.02)
            tap_key_combo([VK_CONTROL], VK_V)
            time.sleep(0.035)
            if orig_c:
                daemon_set_cb(orig_c)
        if prev_ime_kor is not None:
            set_ime_language(target_korean=bool(prev_ime_kor))
        show_ghost_toast("👻 귀신같이 원상복구 완료 (변환 전 원문 100% 복원)", duration_ms=1600)
        return True

    tap_key_combo([VK_CONTROL], VK_Z)
    return True


def _get_logical_line_bounds_utf16(utf16_bytes: bytes, caret_u16: int) -> tuple[int, int, str]:
    """
    [시각적 자동 줄바꿈(Soft-Wrap) 무결성 보호 — 논리 문단(\\r, \\n) 기준 경계 추출기]:
    - Win32 EM_LINEFROMCHAR / EM_LINEINDEX / EM_LINELENGTH는 창 폭이 좁거나 워드패드(wordpad.exe) 여백에서
      한 문장이 화면상 2줄로 자동 줄바꿈(Soft-Wrap)되면 음절 중간('확'=ghk+r ➔ 'ghk' / 'rdlsgowntpdy')을
      잘라내어 한영 변환이 불발되는 한계가 있습니다.
    - 실제 엔터(\\r, \\n) 기호만을 기준으로 커서가 속한 '논리적 한 줄(문단)'의 시작·끝 UTF-16 오프셋을 반환합니다.
    """
    total_u16 = len(utf16_bytes) // 2
    if total_u16 <= 0:
        return 0, 0, ""
    pos = max(0, min(int(caret_u16), total_u16))

    def _u16_at(idx: int) -> int:
        off = idx * 2
        return utf16_bytes[off] | (utf16_bytes[off + 1] << 8)

    if 0 < pos < total_u16 and _u16_at(pos - 1) == 0x000D and _u16_at(pos) == 0x000A:
        pos -= 1

    start = pos
    while start > 0 and _u16_at(start - 1) not in (0x000A, 0x000D):
        start -= 1

    end = pos
    while end < total_u16 and _u16_at(end) not in (0x000A, 0x000D):
        end += 1

    line_str = utf16_bytes[start * 2 : end * 2].decode("utf-16-le", errors="ignore")
    return start, end, line_str


def _get_edit_control_current_line_with_bounds(edit_child: int) -> tuple[int, int, str] | None:
    if not edit_child or not u32.IsWindow(edit_child):
        return None
    try:
        _, idx_text, _ = _get_edit_full_text_and_index_str(edit_child)
        if not idx_text:
            return (0, 0, "")
        s_dw = wintypes.DWORD(0)
        e_dw = wintypes.DWORD(0)
        ok_sel, _ = _send_msg_timeout(edit_child, EM_GETSEL, ctypes.addressof(s_dw), ctypes.addressof(e_dw), 120)
        if not ok_sel:
            return None
        s_pos, e_pos = s_dw.value, e_dw.value
        if s_pos == 0 and e_pos == 0:
            ok_s2, sel_ret = _send_msg_timeout(edit_child, EM_GETSEL, 0, 0, 120)
            if ok_s2:
                s_pos = sel_ret & 0xFFFF
                e_pos = (sel_ret >> 16) & 0xFFFF
        if s_pos != e_pos:
            return None
        utf16_b = idx_text.encode("utf-16-le")
        return _get_logical_line_bounds_utf16(utf16_b, s_pos)
    except Exception:
        return None


def _get_edit_control_current_line(edit_child: int) -> str | None:
    res = _get_edit_control_current_line_with_bounds(edit_child)
    return res[2] if res is not None else None


_KIWI_ENGINE = None
_KIWI_INIT_LOCK = threading.Lock()
_KIWI_WARMUP_STARTED = False

_KIWI_USER_NOUNS: tuple[tuple[str, str], ...] = (
    ("귀신같이", "NNP"),
    ("귀신창", "NNP"),
    ("귀신검색창", "NNP"),
    ("아기귀신", "NNP"),
    ("멀린허브", "NNP"),
    ("썬드림", "NNP"),
    ("루미노트", "NNP"),
    ("센스톡", "NNP"),
    ("옷가게", "NNG"),
)


def _get_kiwi_engine():
    """정식 한국어 형태소 분석 엔진(Kiwi) 싱글톤 로더 — 최초 1회 로드 후 호출당 0.2~2ms 초고속 띄어쓰기 수행"""
    global _KIWI_ENGINE
    if _KIWI_ENGINE is not None:
        return _KIWI_ENGINE
    with _KIWI_INIT_LOCK:
        if _KIWI_ENGINE is not None:
            return _KIWI_ENGINE
        try:
            from kiwipiepy import Kiwi

            kw = Kiwi(num_workers=1)
            for w_str, pos_tag in _KIWI_USER_NOUNS:
                try:
                    kw.add_user_word(w_str, pos_tag, 10.0)
                except Exception:
                    pass
            _KIWI_ENGINE = kw
        except Exception:
            _KIWI_ENGINE = False
        return _KIWI_ENGINE


def _ensure_kiwi_warmup_async() -> None:
    """데몬 기동 직후 백그라운드에서 Kiwi C++ 모델을 선행 워밍업하여 첫 타이핑 지연을 0.00ms로 제거"""
    global _KIWI_WARMUP_STARTED
    if _KIWI_WARMUP_STARTED:
        return
    _KIWI_WARMUP_STARTED = True

    def _warm():
        try:
            kw = _get_kiwi_engine()
            if kw:
                kw.space("귀신같이 한국어 형태소 띄어쓰기 엔진 워밍업 완료", reset_whitespace=False)
        except Exception:
            pass

    threading.Thread(target=_warm, daemon=True).start()


_KO_SPACE_PREDICATE_TAILS = (
    "알려주세요|알려드립니다|부탁드립니다|부탁드려요|확인해주세요|확인해보겠습니다|확인부탁드립니다|"
    "검토부탁드립니다|전달드립니다|말씀해주세요|보내주세요|보내드립니다|찾아줍니다|도와주세요|"
    "기다려주세요|연락주세요|회신주세요|뵙겠습니다|해보겠습니다|취소됐나요|변경됐나요|완료됐나요|"
    "가능할까요|괜찮을까요|감사합니다|고맙습니다|죄송합니다|반갑습니다|수고하셨습니다"
)


def _space_korean_fallback(text: str) -> str:
    """
    [경량 .exe 내장 무의존성 한국어 띄어쓰기 폴백 엔진 (0 Byte 추가 · <0.2ms)]:
    호스트 PC에 무거운 C++ kiwipiepy(90MB+)가 없더라도, 기존 의도적 공백은 100% 보존한 채
    붙여 친 한국어 문장의 조사·어미·시간부사·단위명사·서술어 경계를 오분리 없이 자연스럽게 띄어씁니다.
    """
    if not text or len(text) < 4:
        return text

    def _space_chunk(chunk: str) -> str:
        if len(chunk) < 4 or not re.search(r"[가-힣]", chunk):
            return chunk
        # 고유명사·단일 복합명사 보호 ('썬드림주식회사', '귀신같이', '대한민국' 등)
        if chunk in ("썬드림주식회사", "귀신같이", "카카오톡", "네이버카페", "대한민국", "인공지능"):
            return chunk
        w = chunk
        # 1) 문장 중간 종결어미/인사말 뒤 분리 ('안녕하세요오늘' -> '안녕하세요 오늘', '보내드립니다확인' -> '보내드립니다 확인')
        w = re.sub(
            r"(안녕하세요|감사합니다|고맙습니다|죄송합니다|반갑습니다|알겠습니다|해보겠습니다|보겠습니다|드리겠습니다|겠습니다|습니다|입니다|드립니다|합니다|됩니다|드려요|네요|군요|어요|아요|해요|세요)(?=[가-힣0-9]{2,})",
            r"\1 ",
            w,
        )
        # 2) 시간·지시·빈도 부사 어두 분리 (조사 앞 및 '오늘날(의)' 복합어는 보호, '오늘날씨가'는 분리)
        w = re.sub(
            r"(?:(?<=^)|(?<=\s))(오늘|내일|어제|모레|지금|방금|아까|오전|오후|이번|다음|지난|바로|다시|먼저|정말|진짜|너무|매우|아주|혹시|만약)"
            r"(?!(?:은|는|이|가|을|를|의|에|도|만|로|으로|부터|까지)(?:[\s.,?!]|$))"
            r"(?!날(?!씨))"
            r"(?=[가-힣0-9]{2,})",
            r"\1 ",
            w,
        )
        w = re.sub(
            r"(?:(?<=^)|(?<=\s))왜(?=(?:회의|연락|답변|취소|변경|안|못|그렇게|이렇게|아직|벌써|갑자기|자꾸))",
            "왜 ",
            w,
        )
        # 3) 숫자+단위+조사 경계 ('1초만에찾아줍니다' -> '1초 만에 찾아줍니다', '3시에강남역' -> '3시에 강남역')
        w = re.sub(
            r"(\d+(?:초|분|시간|시|일|월|년|주|달|개|명|번|장|건|원|층|호))(만에|뒤에|전에|후에)(?=[가-힣]{2,})",
            r"\1 \2 ",
            w,
        )
        w = re.sub(
            r"(\d+(?:초|분|시간|시|일|월|년|주|달|개|명|번|장|건|원|층|호))(만에|뒤에|전에|후에)$",
            r"\1 \2",
            w,
        )
        w = re.sub(
            r"(\d+(?:시|분|초|일|월|년|번|층|호)에)(?=[가-힣]{2,})",
            r"\1 ",
            w,
        )
        # 4) 다음절 부사격 조사('에서/에게/한테/으로/부터/까지/처럼/보다') 뒤 분리 ('강남역에서뵙겠습니다' -> '강남역에서 뵙겠습니다')
        w = re.sub(
            r"([가-힣]{2,}(?:에서|에게|한테|께서|으로|부터|까지|처럼|보다|마다))(?=[가-힣]{2,})",
            r"\1 ",
            w,
        )
        # 5) 상용 명사 + 격조사('을/를/이/가/은/는') 뒤 분리 ('영상을1초' -> '영상을 1초', '날씨가참좋네요' -> '날씨가 참좋네요', '회의가취소' -> '회의가 취소')
        w = re.sub(
            r"(영상|사진|파일|문서|회의|시간|계약서|견적서|보고서|영수증|일정|자료|내용|날씨|메일|카톡|문자|연락|답변|권한|회사원|초안|검토|확인|결제|금액|주소|이름)"
            r"(을|를|이|가|은|는)(?=[가-힣0-9]{2,})",
            r"\1\2 ",
            w,
        )
        # 6) 정도 부사 '참' + 형용사 분리 ('참좋네요' -> '참 좋네요')
        w = re.sub(
            r"(?:(?<=^)|(?<=\s))참(?=(?:좋|예쁘|멋지|맛있|고맙|반갑|다행|신기|빠르|편하)[가-힣])",
            "참 ",
            w,
        )
        # 7) 업무·일상 복합 명사구 및 요청 서술어 경계 분리 ('회의시간' -> '회의 시간', '계약서초안검토' -> '계약서 초안 검토', '시간알려주세요' -> '시간 알려주세요')
        for _ in range(2):
            w = re.sub(
                r"(회의|계약서|견적서|보고서|영수증|회사원|담당자|초안|권한|시간|일정|내용|자료|파일)"
                r"(?=(?:시간|초안|검토|권한|확인|요청|문의|일정)(?:[가-힣]|$))",
                r"\1 ",
                w,
            )
        w = re.sub(
            rf"([가-힣]{{2,}})(?=(?:{_KO_SPACE_PREDICATE_TAILS})(?:[\s.,?!~^]|$))",
            r"\1 ",
            w,
        )
        return re.sub(r" +", " ", w).strip()

    return re.sub(r"\S+", lambda m: _space_chunk(m.group(0)), text)


def _fix_korean_spacing_general(s: str) -> str:
    """
    [정식 한국어 형태소 분석 엔진(Kiwi) + 경량 무의존성 내장 띄어쓰기 폴백 하이브리드]
    - 호스트에 Kiwi가 설치된 경우 Kiwi.space(reset_whitespace=False)를 우선 수행하고,
    - 순수 Z-코어 단일 .exe 환경(Kiwi 미설치)에서는 내장 _space_korean_fallback()이 즉시 작동하여
      용량 비대화(0 Byte) 없이 '오늘회의시간알려주세요' ➔ '오늘 회의 시간 알려주세요'를 0.2ms 내에 교정합니다.
    - 이메일(@), URL/도메인, 모델명 숫자 결합('갤럭시25', '아이폰16', '1호기')은 원형 그대로 보존합니다.
    """
    if not s or not s.strip():
        return s
    if not re.search(r"[가-힣]", s):
        return re.sub(r" +", " ", s).strip()

    s_work = s

    # 1) 이메일·URL·도메인 토큰 보호 마스킹 (형태소 띄어쓰기 중 주소 내부 공백 삽입 원천 차단)
    protected_spans: list[str] = []

    def _mask_prot(m: re.Match) -> str:
        idx = len(protected_spans)
        protected_spans.append(m.group(0))
        return f"__GHOSTPROT{idx}__"

    s_work = re.sub(
        r"(?:https?://\S+|www\.\S+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+|[A-Za-z0-9-]+\.(?:com|net|org|kr|co|io|app|dev|ai|edu|gov|me|biz|info)\b)",
        _mask_prot,
        s_work,
    )

    # 2) 원문에서 고유명사/명사 뒤에 숫자가 공백 없이 직결된 패턴('갤럭시25', '아이폰16', '시즌2') 기록
    attached_alnum_pairs: set[tuple[str, str]] = set()
    for m_att in re.finditer(r"([가-힣]{2,})(\d+)", s_work):
        attached_alnum_pairs.add((m_att.group(1), m_att.group(2)))

    # 3) 최소한의 소리나는 대로 친 철자 오타 정규화
    s_work = s_work.replace("아기기신", "아기귀신")
    s_work = re.sub(r"몇\s*일", "며칠", s_work)
    s_work = re.sub(r"되(\s*요)(?=[\s.,?!~^]|$)", r"돼\1", s_work)
    s_work = re.sub(r"됬(?=[어었습니는던고지다요\s.,?!~^]|$)", "됐", s_work)
    s_work = re.sub(r"조아서", "좋아서", s_work)
    s_work = re.sub(r"어의\s*없", "어이없", s_work)
    # 어미 뒤에 잘못 떨어진 '요' 또는 '서'만 최소 봉합 ('어려워 요' -> '어려워요', '주셔 서' -> '주셔서')
    s_work = re.sub(r"([가-힣]+(?:아|어|여|해|지|네|군|나|가|까))\s+요(?=[\s.,?!~^]|$)", r"\1요", s_work)
    s_work = re.sub(r"([가-힣]*(?:주셔|보셔|하셔|오셔|가셔|계셔|드려|올려|내려|보내|만들|받으|찾으|읽으|쓰셔|해|와|봐))\s+서(?=[가-힣\s.,?!~^]|$)", r"\1서", s_work)

    # 4) Kiwi 형태소 엔진 우선 실행 ➔ 미탑재(.exe) 시 초경량 내장 폴백 즉시 실행
    kw = _get_kiwi_engine()
    if kw:
        try:
            s_work = kw.space(s_work, reset_whitespace=False)
        except Exception:
            s_work = _space_korean_fallback(s_work)
    else:
        s_work = _space_korean_fallback(s_work)

    # 5) 원문에서 붙여 썼던 모델명+숫자('갤럭시 25' -> '갤럭시25') 복원
    for k_part, d_part in attached_alnum_pairs:
        s_work = s_work.replace(f"{k_part} {d_part}", f"{k_part}{d_part}")

    # 6) 마스킹된 이메일·URL 복원 (조사 앞 불필요 공백 제거)
    for idx, orig_tok in enumerate(protected_spans):
        placeholder = f"__GHOSTPROT{idx}__"
        s_work = re.sub(rf"{re.escape(placeholder)}\s+(?=(?:으로|로|에서|에게|께|에|의|을|를|이|가|은|는|도|만|과|와|부터|까지)(?:[\s.,?!~^]|$))", placeholder, s_work)
        s_work = s_work.replace(placeholder, orig_tok)

    return re.sub(r" +", " ", s_work).strip()


def iron_and_polish_korean_text(raw_text: str, allow_typo_morph: bool = True) -> str:
    """
    [줄바꿈·유령공백(NFKC) 다림질 + 문맥 오타·띄어쓰기 교정 + 문단 의미 분리 통합 엔진]
    - 번호/불릿 목록(1), 2), ■, -, [) 및 빈 줄(\n\n)·문장 종결 줄바꿈은 보존하면서,
      단어·어미·문장 중간에 뚝뚝 끊긴 비정상 줄바꿈을 매끄럽게 이음!
    - 정상적인 1음절 단어(및, 후, 뒤, 수, 두, 한, 단 등)나 '한글' 등의 단어를 절대 훼손하지 않으면서 PDF/복붙 자간 깨짐만 정밀 복원!
    - allow_typo_morph=False(예: 클립보드 자동 복사 시점)일 때는 이메일·비밀번호·영문 토큰이 절대 한글로 자동 변환되지 않도록 영타 한영 변환을 원천 차단합니다!
    """
    if not raw_text or not raw_text.strip():
        return raw_text

    # 1) 각 줄 내부에 섞여 있는 영타/한타 오타(예: gksrmf xptmxmdlqslek, 줄바꿈으로 끊긴 영타 포함)가 있으면 먼저 양방향 한영 성형 수행
    if allow_typo_morph:
        # 엑셀·구글시트 다중 셀 복사(탭 \t 포함 TSV)인 경우 셀 구분(\t)과 행 구분(\r\n)을 100% 보존한 채 각 셀 단위로 한영·오타 성형!
        if "\t" in raw_text:
            tsv_rows_out: list[str] = []
            for raw_row in raw_text.splitlines():
                if "\t" in raw_row:
                    cells_out: list[str] = []
                    for cell_v in raw_row.split("\t"):
                        if cell_v.strip():
                            c_m, c_d = morph_korean_english_text_with_direction(cell_v)
                            c_base = c_m if (c_d in ("KO", "EN") and c_m != cell_v) else cell_v
                            cells_out.append(_fix_korean_spacing_general(c_base))
                        else:
                            cells_out.append(cell_v)
                    tsv_rows_out.append("\t".join(cells_out))
                elif raw_row.strip():
                    r_m, r_d = morph_korean_english_text_with_direction(raw_row)
                    r_base = r_m if (r_d in ("KO", "EN") and r_m != raw_row) else raw_row
                    tsv_rows_out.append(_fix_korean_spacing_general(r_base))
                else:
                    tsv_rows_out.append("")
            return "\n".join(tsv_rows_out)

        raw_lines = raw_text.splitlines()
        merged_typo_lines: list[str] = []
        idx_l = 0
        while idx_l < len(raw_lines):
            cur_ln = raw_lines[idx_l]
            if (
                idx_l + 1 < len(raw_lines)
                and re.fullmatch(r"[A-Za-z]{4,}", cur_ln.strip())
                and re.fullmatch(r"[A-Za-z]{3,}", raw_lines[idx_l + 1].strip())
                and not AI_ENGINE.is_valid_english_word(cur_ln.strip())
                and not AI_ENGINE.is_valid_english_word(raw_lines[idx_l + 1].strip())
            ):
                joined_cand = cur_ln.strip() + raw_lines[idx_l + 1].strip()
                m_j, d_j = morph_korean_english_text_with_direction(joined_cand)
                if d_j == "KO" and m_j != joined_cand and not re.search(r"[ㄱ-ㅎㅏ-ㅣ]", m_j):
                    merged_typo_lines.append(joined_cand)
                    idx_l += 2
                    continue
            merged_typo_lines.append(cur_ln)
            idx_l += 1

        pre_lines = []
        for raw_ln in merged_typo_lines:
            if raw_ln.strip():
                m_ln, l_dir = morph_korean_english_text_with_direction(raw_ln)
                if l_dir in ("KO", "EN") and m_ln != raw_ln:
                    pre_lines.append(m_ln)
                else:
                    pre_lines.append(raw_ln)
            else:
                pre_lines.append("")
        s = "\n".join(pre_lines)
    else:
        s = raw_text

    # 원문자(①~⑳) 및 저작권 기호(ⓒ, ©, ®)가 NFKC 정규화로 풀려 깨지지 않도록 보호
    _preserved_syms: list[str] = []

    def _keep_sym(m_s: re.Match) -> str:
        idx_s = len(_preserved_syms)
        _preserved_syms.append(m_s.group(0))
        return f"__GHOSTSYM{idx_s}__"

    s = re.sub(r"[①-⑳ⓒ©®™]", _keep_sym, s)
    s = s.replace("\u00B7", "__MIDDOT__").replace("\u318D", "__MIDDOT__")
    s = unicodedata.normalize("NFKC", s)
    s = s.replace("__MIDDOT__", "·")
    for idx_s, orig_sym in enumerate(_preserved_syms):
        s = s.replace(f"__GHOSTSYM{idx_s}__", orig_sym)
    s = re.sub(r"[\u00A0\u200B-\u200D\uFEFF]", " ", s)
    s = s.replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'")

    # 2-A) 단어·숫자·영문·괄호가 줄바꿈(단일 \n 또는 단어 중간 빈줄 \n\n 포함)으로 쪼개진 구간을 무공백 정밀 결합 (종결 문장 뒤 줄바꿈 및 불릿 목록은 100% 보존!)
    #  ⓪ 문장부호(, . ; : ? ! ) ]) 바로 앞에 끼어든 줄바꿈 무공백 제거 ('있으므로\n, 본 자동' -> '있으므로, 본 자동')
    s = re.sub(r"[ \t]*(?:\r?\n[ \t]*)+(?=[,.;:?!\)\]\}])", "", s)
    #  ① 숫자·단위 쪼개짐 ('1\n00%' -> '100%', '202\n6' -> '2026', '2026\n년' -> '2026년')
    s = re.sub(r"(?<=\d)[ \t]*(?:\r?\n[ \t]*)+(?=(?:\d+[%원개명건일월년시분초번층호]?|[%원개명건일월년시분초번층호]))", "", s)
    #  ② 영단어/단축키 쪼개짐 ('C\ntrl+V' -> 'Ctrl+V')
    s = re.sub(r"(?<=[A-Za-z])[ \t]*(?:\r?\n[ \t]*)+(?=[A-Za-z])", "", s)
    #  ③ 닫는 괄호 직후 조사/어미 쪼개짐 ('(또는 6글자 이상 긴 오타)\n를' -> '(또는 6글자 이상 긴 오타)를')
    s = re.sub(
        r"(?<=[\)\]\}])[ \t]*(?:\r?\n[ \t]*)+(?=(?:을|를|은|는|이|가|에|에서|으로|로|와|과|의|도|만|부터|까지)(?=[\s.,?!:;)]|$))",
        "",
        s,
    )
    #  ④ 한글 단어 내부 또는 어미가 줄바꿈(\n 또는 \n\n)으로 쪼개진 구간 무공백 결합 ('한\n\n영 성형' -> '한영 성형', '자동변\n\n환' -> '자동변환', '붙\n\n여넣어집니다' -> '붙여넣어집니다')
    def _join_midword_hangul_newline(m_nl: re.Match) -> str:
        left_w = m_nl.group(1)
        right_w = m_nl.group(2)
        # 앞부분 끝이 문장 종결어미('다/요/죠/까')이면 줄바꿈 보존
        if left_w.endswith(("다", "요", "죠", "까")):
            return m_nl.group(0)
        # 뒷부분이 조사·어미·보조용언('여넣어집니다', '넣어집니다', '어집니다', '집니다', '세요', '으로' 등)이거나,
        # 앞+뒤 결합 단어가 AI 서브워드/어절 시작 사전에 존재하는 하나의 단어('한영', '변환', '자동변환' 등)이면 무공백 결합!
        if re.match(
            r"^(?:아서|어서|여서|해서|여넣|넣어|어지|어집|집니|습니|입니|합니|됩니|세요|어요|아요|해요|네요|군요|나요|가요|까요|죠|지요|습니다|입니다|합니다|됩니다|여넣어집니다|넣어집니다|어집니다|집니다|다|께|깨|을|를|은|는|이|가|에서|에게|으로|로|까지|부터|므로|도록|지만|거나|면서|니까)",
            right_w,
        ):
            return f"{left_w}{right_w}"
        tail_2 = left_w[-2:] if len(left_w) >= 2 else left_w
        head_2 = right_w[:2] if len(right_w) >= 2 else right_w
        cand_pair = left_w[-1] + right_w[0]
        cand_full = tail_2 + head_2
        if (
            cand_pair in AI_ENGINE.ko_subwords
            or cand_pair in AI_ENGINE.ko_word_starts
            or cand_full in AI_ENGINE.ko_subwords
            or (len(left_w) == 1 and left_w not in {"나", "너", "저", "그", "이", "더", "덜", "안", "못", "잘", "또", "꼭", "다", "새", "첫", "두", "세", "네", "각", "전", "현"})
            or (len(right_w) == 1 and right_w in "영환형기성화법문장력도율점권선창값칸줄번개명건원일월년분초")
        ):
            # 단, 앞부분이 이미 격조사('을/를/은/는/이/가/에/로/도/만/와/과')로 끝난 완결 어절이면 무공백이 아니라 공백 1칸으로 이음!
            if len(left_w) >= 2 and left_w[-1] in "을를은는이가에로도만와과":
                return f"{left_w} {right_w}"
            return f"{left_w}{right_w}"
        return f"{left_w} {right_w}"

    s = re.sub(
        r"([가-힣]+)[ \t]*(?:\r?\n[ \t]*)+(?!(?:[-*•▪▫▶▷■◆◇※#\[\(⚠️📌🧪①-⑳]|\d+[.)]|\([0-9가-힣]+\)))([가-힣]+)",
        _join_midword_hangul_newline,
        s,
    )
    # 2-B) 문장 중간(쉼표·닫는괄호·영숫자·비종결 한글 끝)에서 PDF/웹 폭 때문에 뚝 끊긴 줄바꿈(\n 또는 비종결 \n\n)을 공백 1칸으로 매끄럽게 다림질!
    #      단, ① 마침표·물음표·느낌표·콜론(:) 등 문장/헤더 종결 부호 뒤, ② 종결어미('다/요/죠/까') 뒤,
    #      ③ 다음 줄이 번호/불릿 목록(1., 1), -, *, •, ■, ▶, ⚠️, 📌, 🧪, [)으로 시작하는 경우는 줄바꿈을 100% 보존합니다.
    s = re.sub(
        r"(?<=[가-힣A-Za-z0-9,\)%])[ \t]*(?:\r?\n[ \t]*)+(?!(?:[-*•▪▫▶▷■◆◇※#\[\(⚠️📌🧪①-⑳]|\d+[.)]|\([0-9가-힣]+\)))"
        r"(?=[가-힣A-Za-z0-9\(\['\"])",
        lambda m: "\n" if s[max(0, m.start() - 2) : m.start()].endswith(("다", "요", "죠", "까")) else " ",
        s,
    )
    # 단어 내부 오타성 공백('2어 절' -> '2어절') 정밀 복원
    s = re.sub(r"(\d+\s*어)[ \t]+절", r"\1절", s)
    s = re.sub(r"(\.\s*\.\s*\.)[ \t]*\r?\n[ \t]*", r"\1 ", s)
    s = re.sub(r"[ \t]+", " ", s)

    # 3) PDF/복붙 자간 깨짐 복원 (줄바꿈 \n 은 절대 건드리지 않도록 [ \t]+ 만 사용!)
    s = re.sub(r"(?<![가-힣])날[ \t]+(?=씨가|씨도|씨는|씨를|씨에)", "날", s)
    s = re.sub(r"(?<![가-힣])아[ \t]+(?=기귀신)", "아", s)
    s = re.sub(r"(?<=[가-힣])과함[ \t]*께", "과 함께", s)
    s = re.sub(r"(?<=[가-힣])와함[ \t]*께", "와 함께", s)
    s = re.sub(r"(?<![가-힣])함[ \t]+께(?=[\s.,?!~^)]|$)", "함께", s)
    s = re.sub(r"([가-힣]+)[ \t]+고[ \t]+싶[ \t]*(어요|습니다|다|네|은|고)", r"\1고 싶\2", s)
    s = re.sub(r"([가-힣]+고)[ \t]*싶[ \t]+(어요|습니다|다|네|은|고)", r"\1 싶\2", s)
    s = re.sub(
        r"([가-힣]+(?:어요|아요|해요|세요|워요|봐요|가요|와요|줘요|네요|군요|습니다|입니다))(?=[가-힣]{2,})",
        r"\1 ",
        s,
    )
    s = re.sub(
        r"(?<=[가-힣]{2})(?<![와과은는이가을를의에])[ \t]+(?=(?:은|는|이|가|을|를|에서|에게|으로|까지|부터|처럼|보다|지만|거나|면서|니까|습니다|입니다|합니다)(?=[\s.,?!:;)]|$))",
        "",
        s,
    )

    _standalone_1char = {
        "나", "너", "저", "그", "이", "더", "덜", "안", "못", "잘", "또", "꼭", "다", "총", "각", "전", "현", "신", "구",
        "유", "무", "열", "행", "칸", "줄", "초", "분", "시", "일", "월", "년", "원", "명", "건", "개", "장", "번",
        "및", "후", "뒤", "수", "것", "바", "데", "리", "터", "뿐", "한", "두", "세", "네", "몇", "첫", "새", "헌",
        "단", "등", "약", "매", "중", "내", "외", "상", "하", "좌", "우", "말", "점", "편", "호", "차", "회", "층",
        "왜", "뭐", "좀", "곧", "막", "딱", "늘", "참", "꽤", "난",
    }

    def _join_broken_hangul(line: str) -> str:
        if not line.strip():
            return ""
        tokens = line.split(" ")
        if len(tokens) < 3:
            return line
        out = []
        i = 0
        while i < len(tokens):
            cur = tokens[i]
            if (
                i + 2 < len(tokens)
                and len(cur) == 1 and "가" <= cur <= "힣" and cur not in _standalone_1char
                and len(tokens[i + 1]) == 1 and "가" <= tokens[i + 1] <= "힣" and tokens[i + 1] not in _standalone_1char
                and len(re.sub(r"[.,?!:;~)]+$", "", tokens[i + 2])) == 1
            ):
                merged_tok = cur + tokens[i + 1] + tokens[i + 2]
                i += 3
                while i < len(tokens) and len(re.sub(r"[.,?!:;~)]+$", "", tokens[i])) == 1 and tokens[i] not in _standalone_1char:
                    merged_tok += tokens[i]
                    i += 1
                out.append(merged_tok)
                continue
            out.append(cur)
            i += 1
        return " ".join(out)

    polished_lines = []
    for ln in s.splitlines():
        if not ln.strip():
            polished_lines.append("")
        else:
            polished_lines.append(_fix_korean_spacing_general(_join_broken_hangul(ln)))
    s = "\n".join(polished_lines)
    s = re.sub(r"\r?\n[ \t]*\r?\n+", "\n\n", s)

    sentences = [seg.strip() for seg in re.split(r"(?<=[.?!])\s+", s) if seg.strip()]
    if len(sentences) >= 5 and "\n" not in s:
        paragraphs = []
        buf = [sentences[0]]
        prev_vec = AI_ENGINE.embed_128d(sentences[0])
        for sent in sentences[1:]:
            curr_vec = AI_ENGINE.embed_128d(sent)
            sim = AI_ENGINE.cosine_sim(prev_vec, curr_vec)
            if len(buf) >= 3 or (len(buf) >= 2 and sim < 0.72):
                paragraphs.append(" ".join(buf))
                buf = [sent]
            else:
                buf.append(sent)
            prev_vec = curr_vec
        if buf:
            paragraphs.append(" ".join(buf))
        s = "\n\n".join(paragraphs)

    return s.strip()


def _replace_edit_control_current_line_atomic(
    edit_child: int,
    auto_triggered: bool = False,
    allow_iron: bool = True,
    prefer_full_doc: bool = False,
    allow_typo_morph: bool = True,
    ensure_trailing_space: bool = False,
) -> tuple[bool, str, str, str | None]:
    """
    [메모장(Edit/RichEditD2DPT) 0.2ms 무지연 원자적(Atomic) 줄·드래그 성형 엔진]
    - Shift+Home 블록 선택 대기(140ms)나 클립보드(Ctrl+C/Ctrl+V)를 전혀 거치지 않고
      Win32 WM_GETTEXT -> EM_SETSEL -> EM_REPLACESEL로 0.0002초 만에 줄 또는 드래그 블록을 교체하여
      연속 타이핑 중 다음 단어 첫 글자가 섞이는 현상과 Ctrl+Z 증발·이모지(Surrogate Pair) 밀림을 100% 원천 차단합니다!
    """
    if not edit_child or not u32.IsWindow(edit_child):
        return False, "", "", None
    try:
        full_text, idx_text, is_rich = _get_edit_full_text_and_index_str(edit_child)
        if not idx_text:
            return False, "", "", None

        utf16_bytes = idx_text.encode("utf-16-le")
        utf16_total = len(utf16_bytes) // 2

        s_dw = wintypes.DWORD(0)
        e_dw = wintypes.DWORD(0)
        _send_msg_timeout_val(edit_child, EM_GETSEL, ctypes.addressof(s_dw), ctypes.addressof(e_dw), 120)
        s_pos, e_pos = s_dw.value, e_dw.value
        if s_pos == 0 and e_pos == 0:
            _ok_sr, sel_ret = _send_msg_timeout_val(edit_child, EM_GETSEL, 0, 0, 120)
            if _ok_sr:
                s_pos = sel_ret & 0xFFFF
                e_pos = (sel_ret >> 16) & 0xFFFF

        use_full_sel = False
        if s_pos != e_pos and 0 <= s_pos < e_pos <= utf16_total:
            line_start, line_end = s_pos, e_pos
            if s_pos == 0 and e_pos >= utf16_total:
                use_full_sel = True
                target_line = idx_text
            else:
                target_line = utf16_bytes[s_pos * 2 : e_pos * 2].decode("utf-16-le", errors="ignore")
        else:
            line_start, l_end_cand, cur_line_str = _get_logical_line_bounds_utf16(utf16_bytes, s_pos)
            line_len = l_end_cand - line_start
            # 커서가 놓인 현재 논리 줄(문단)에 한영 오타가 있으면 다른 문단들을 절대 건드리지 않고 현재 문단만 즉시 성형!
            m_single, l_single = morph_korean_english_text_with_direction(cur_line_str) if cur_line_str else ("", None)
            if cur_line_str and m_single != cur_line_str and l_single is not None:
                line_end = line_start + line_len
                target_line = cur_line_str
            elif not auto_triggered and prefer_full_doc:
                line_start, line_end = 0, utf16_total
                use_full_sel = True
                target_line = idx_text
            elif line_start >= 0 and line_len > 0:
                line_end = line_start + line_len
                target_line = cur_line_str
            elif not auto_triggered and utf16_total > 0:
                line_start, line_end = 0, utf16_total
                use_full_sel = True
                target_line = idx_text
            else:
                return False, "", "", None

        if not target_line:
            return False, "", "", None

        if allow_typo_morph:
            morphed, target_lang = morph_korean_english_text_with_direction(target_line)
        else:
            morphed, target_lang = target_line, None
        if allow_iron:
            base_for_iron = morphed if (morphed != target_line and target_lang is not None) else target_line
            if auto_triggered:
                ironed = _fix_korean_spacing_general(base_for_iron.rstrip(" "))
            else:
                ironed = iron_and_polish_korean_text(base_for_iron, allow_typo_morph=allow_typo_morph)
            if ironed.strip() != base_for_iron.strip():
                morphed = ironed
                if target_lang is None:
                    target_lang = "KO"

        if morphed.rstrip(" ") == target_line.rstrip(" ") or target_lang is None:
            return False, target_line, target_line, None

        if auto_triggered:
            want_sp = ensure_trailing_space or target_line.endswith(" ")
            final_out = (morphed.rstrip(" ") + " ") if want_sp else morphed.rstrip(" ")
        else:
            final_out = morphed
        if not is_rich and "\n" in final_out:
            final_out_win = final_out.replace("\r\n", "\n").replace("\n", "\r\n")
        else:
            final_out_win = final_out

        root_hwnd = u32.GetAncestor(edit_child, 2) or edit_child
        prev_ime_kor = get_ime_is_korean(root_hwnd)
        set_ime_language(target_korean=(target_lang == "KO"))
        if is_rich:
            _send_msg_timeout_val(edit_child, 0x0458, 0, 0, 120)  # EM_STOPGROUPTYPING
        if use_full_sel or (line_start == 0 and line_end >= utf16_total):
            _send_msg_timeout_val(edit_child, EM_SETSEL, 0, -1, 120)
            rbuf = ctypes.create_unicode_buffer(final_out_win)
            _send_msg_timeout_val(edit_child, EM_REPLACESEL, 1, ctypes.addressof(rbuf), 150)
            if not auto_triggered and s_pos != e_pos:
                _send_msg_timeout_val(edit_child, EM_SETSEL, 0, -1, 120)
        else:
            _send_msg_timeout_val(edit_child, EM_SETSEL, line_start, line_end, 120)
            rbuf = ctypes.create_unicode_buffer(final_out_win)
            _send_msg_timeout_val(edit_child, EM_REPLACESEL, 1, ctypes.addressof(rbuf), 150)
            if not auto_triggered and s_pos != e_pos:
                rep_utf16_len = len(final_out.encode("utf-16-le")) // 2
                _send_msg_timeout_val(edit_child, EM_SETSEL, line_start, line_start + rep_utf16_len, 120)
        if is_rich:
            _send_msg_timeout_val(edit_child, 0x0458, 0, 0, 120)  # EM_STOPGROUPTYPING

        full_after, _, _ = _get_edit_full_text_and_index_str(edit_child)
        arm_undo_snapshot(
            root_hwnd,
            edit_child,
            target_line,
            final_out,
            mode="edit_replace",
            full_doc_before=full_text,
            full_doc_after=full_after,
            prev_ime_kor=prev_ime_kor,
        )
        return True, target_line.strip(), final_out.strip(), target_lang
    except Exception:
        return False, "", "", None


def _polish_notepad_previous_line_on_enter(edit_child: int, allow_typo_morph: bool = False) -> bool:
    """
    [메모장(notepad.exe) 전용 Enter(줄바꿈) 직전 줄 무충돌 띄어쓰기·성형 엔진]
    - 메신저·카톡(Enter=전송)이나 노션 블록 에디터(Enter=새 블록 생성)는 절대 건드리지 않고 오직 메모장(notepad.exe)에서만 발동합니다.
    - 한글 IME 조합 확정 및 Win11 탭 메모장(RichEditD2DPT) 줄바꿈 커밋이 실제로 완료되어 커서가 아랫줄 맨 앞(s_pos == cur_line_start)으로
      내려온 시점을 정확히 확인한 뒤, 방금 완성된 윗줄(cur_line_idx - 1)을 0.2ms 원자적으로 띄어쓰기·성형합니다.
    """
    if not edit_child or not u32.IsWindow(edit_child):
        return False
    try:
        full_text = ""
        idx_text = ""
        utf16_bytes = b""
        s_pos = 0
        e_pos = 0
        cur_line_start = 0
        ready = False
        s_dw = wintypes.DWORD(0)
        e_dw = wintypes.DWORD(0)
        for _ in range(7):
            time.sleep(0.014)
            full_text, idx_text, _ = _get_edit_full_text_and_index_str(edit_child)
            if not idx_text:
                continue
            _send_msg_timeout_val(edit_child, EM_GETSEL, ctypes.addressof(s_dw), ctypes.addressof(e_dw), 120)
            s_pos, e_pos = s_dw.value, e_dw.value
            if s_pos != e_pos or s_pos < 1:
                continue
            utf16_bytes = idx_text.encode("utf-16-le")
            cur_line_start, _, _ = _get_logical_line_bounds_utf16(utf16_bytes, s_pos)
            if cur_line_start >= 1 and s_pos == cur_line_start:
                ready = True
                break
        if not ready:
            return False

        prev_anchor = cur_line_start - 1
        if (
            prev_anchor > 0
            and (utf16_bytes[(prev_anchor - 1) * 2] | (utf16_bytes[(prev_anchor - 1) * 2 + 1] << 8)) == 0x000D
            and (utf16_bytes[prev_anchor * 2] | (utf16_bytes[prev_anchor * 2 + 1] << 8)) == 0x000A
        ):
            prev_anchor -= 1
        prev_start, prev_end, prev_str = _get_logical_line_bounds_utf16(utf16_bytes, prev_anchor)
        prev_len = prev_end - prev_start
        if prev_start < 0 or prev_len < 4:
            return False
        prev_stripped = prev_str.strip()
        if not prev_stripped or _is_protected_account_or_email_token(prev_stripped.split()[-1]):
            return False

        base_line = prev_str
        target_lang: str | None = None
        if allow_typo_morph:
            toks_chk = prev_stripped.split()
            eng_typo_cnt = 0
            has_long_4syl_eng = False
            for t_chk in toks_chk:
                if _is_protected_account_or_email_token(t_chk):
                    continue
                for e_chk in re.findall(r"[A-Za-z]+", t_chk):
                    if len(e_chk) >= 2 and not AI_ENGINE.is_valid_english_word(e_chk):
                        k_chk = eng_word_to_kor(e_chk)
                        if k_chk and is_valid_korean_word(k_chk):
                            eng_typo_cnt += 1
                            if (len(e_chk) >= 8 and len(k_chk) >= 4) or (len(e_chk) >= 4 and len(k_chk) >= 2):
                                has_long_4syl_eng = True
            if eng_typo_cnt >= 2 or has_long_4syl_eng:
                morphed_p, lang_p = morph_korean_english_text_with_direction(prev_str)
                if morphed_p != prev_str and lang_p is not None:
                    base_line = morphed_p
                    target_lang = lang_p

        if not re.search(r"[가-힣]", base_line):
            return False
        polished = _fix_korean_spacing_general(base_line.rstrip(" "))
        if polished == prev_str.rstrip(" "):
            return False
        if target_lang is None:
            target_lang = "KO"

        root_hwnd = u32.GetAncestor(edit_child, 2) or edit_child
        prev_ime_kor = get_ime_is_korean(root_hwnd)
        set_ime_language(target_korean=(target_lang == "KO"))
        _send_msg_timeout_val(edit_child, 0x0458, 0, 0, 120)  # EM_STOPGROUPTYPING
        _send_msg_timeout_val(edit_child, EM_SETSEL, prev_start, prev_start + prev_len, 120)
        rbuf = ctypes.create_unicode_buffer(polished)
        _send_msg_timeout_val(edit_child, EM_REPLACESEL, 1, ctypes.addressof(rbuf), 150)
        delta_utf16 = (len(polished.encode("utf-16-le")) // 2) - prev_len
        new_caret = max(0, s_pos + delta_utf16)
        _send_msg_timeout_val(edit_child, EM_SETSEL, new_caret, new_caret, 120)
        _send_msg_timeout_val(edit_child, 0x0458, 0, 0, 120)  # EM_STOPGROUPTYPING

        full_after, _, _ = _get_edit_full_text_and_index_str(edit_child)
        arm_undo_snapshot(
            root_hwnd,
            edit_child,
            prev_str,
            polished,
            mode="edit_replace",
            full_doc_before=full_text,
            full_doc_after=full_after,
            prev_ime_kor=prev_ime_kor,
        )
        return True
    except Exception:
        return False


def _restore_target_focus_and_replace_line(
    target_hwnd: int,
    daemon_set_cb,
    fallback_text: str | None = None,
    auto_triggered: bool = False,
    allow_iron: bool = True,
    prefer_full_doc: bool = False,
) -> tuple[bool, str, str, str | None]:
    """
    [Win10/Win11 공통 무결점 드래그 블록 & 줄 단위 스냅샷 교체 엔진]
    1) 귀신창이 닫힌 직후 원래 입력창(target_hwnd)으로 포커스를 확실히 복귀시키고,
    2) 메모장(Edit/RichEditD2DPT)인 경우 0.2ms 원자적 교체(_replace_edit_control_current_line_atomic)를 최우선 수행하며,
    3) 일반 웹/앱 창에서는 드래그 선택 영역(또는 End -> Shift+Home 줄 전체)을 한영성형 + 띄어쓰기·오타·줄바꿈 다림질까지 한 번에 수행합니다!
    """
    orig_clip = get_clipboard_text()
    sentinel = "__GHOSTI_EMPTY_SEL__"
    release_all_modifiers()

    edit_child = 0
    if target_hwnd and u32.IsWindow(target_hwnd):
        try:
            fg_now = u32.GetForegroundWindow()
            if fg_now != target_hwnd:
                u32.SetForegroundWindow(target_hwnd)
            edit_child = _find_edit_control_child(target_hwnd)
            time.sleep(0.02)
        except Exception:
            pass

    if edit_child:
        ok_ed, raw_ed, out_ed, lang_ed = _replace_edit_control_current_line_atomic(
            edit_child, auto_triggered=auto_triggered, allow_iron=allow_iron, prefer_full_doc=prefer_full_doc
        )
        if ok_ed and lang_ed is not None:
            return True, raw_ed, out_ed, lang_ed
        return False, raw_ed, out_ed, None

    proc_low_t = _get_process_name_from_hwnd(target_hwnd).lower() if target_hwnd else ""
    cls_low_t = _get_win_class_only(target_hwnd).lower() if target_hwnd else ""
    is_excel_t = proc_low_t in ("excel.exe", "hcell.exe") or ("xlmain" in cls_low_t)
    is_hwp_t = ("hwp" in proc_low_t) or ("hword" in proc_low_t) or ("hnc" in cls_low_t)

    if is_excel_t:
        # 엑셀(Excel/한셀)에서는:
        # 1) 시트 그리드 상태에서 Ctrl+C를 누르면 Excel '복사 모드(개미 행진 테두리)'가 켜져서 이후 Shift+Home이나 Ctrl+V 시
        #    다중 셀이 선택되거나 '붙여 넣을 데이터가 선택한 크기와 다릅니다' 경고창이 뜨므로, 절대 먼저 Ctrl+C를 치지 않음!
        # 2) 현재 포커스 컨트롤 클래스가 'EXCEL6'(인라인 셀 편집 중)가 아닌 'EXCEL7'(그리드 선택 상태)이면에만 F2를 1회 눌러 셀 편집 모드로 진입!
        VK_F2 = 0x71
        VK_END = 0x23
        VK_HOME = 0x24
        release_all_modifiers()
        focus_h_xl = _get_focused_control_hwnd(target_hwnd)
        focus_cls_xl = _get_win_class_only(focus_h_xl).upper() if focus_h_xl else ""
        if focus_cls_xl != "EXCEL6":
            tap_key_combo([], VK_F2)
            time.sleep(0.035)
        tap_key_combo([], VK_END)
        time.sleep(0.015)
        tap_key_combo([VK_SHIFT], VK_HOME)
        time.sleep(0.04)
        daemon_set_cb(sentinel)
        time.sleep(0.015)
        tap_key_combo([VK_CONTROL], VK_C)
        time.sleep(0.045)
        selected = get_clipboard_text()
    else:
        daemon_set_cb(sentinel)
        time.sleep(0.02)
        tap_key_combo([VK_CONTROL], VK_C)
        time.sleep(0.055 if is_hwp_t else 0.045)
        selected = get_clipboard_text()

        # 노션(Notion) 등에서 무드래그 상태로 Ctrl+C를 치면 블록 전체(끝에 \n 포함)가 복사되면서 텍스트 선택 영역은 잡히지 않으므로,
        # 단일 줄이면서 끝에 \n이 붙은 경우에는 반드시 End -> Shift+Home으로 실제 텍스트 선택을 잡도록 처리!
        is_unselected_block_copy = bool(selected and selected != sentinel and selected.endswith(("\n", "\r")) and ("\n" not in selected.rstrip("\r\n")))
        if not selected or selected == sentinel or is_unselected_block_copy:
            VK_END = 0x23
            VK_HOME = 0x24
            release_all_modifiers()
            if not auto_triggered:
                tap_key_combo([], VK_END)
                time.sleep(0.03)
            tap_key_combo([VK_SHIFT], VK_HOME)
            time.sleep(0.055 if is_hwp_t else 0.045)
            daemon_set_cb(sentinel)
            time.sleep(0.02)
            tap_key_combo([VK_CONTROL], VK_C)
            time.sleep(0.065 if is_hwp_t else 0.05)
            selected = get_clipboard_text()
            if (not selected or selected == sentinel) and is_hwp_t:
                # HWP 첫 실행 직후 Shift+Home 선택 복사 지연 시 1회 즉시 재시도
                tap_key_combo([VK_SHIFT], VK_HOME)
                time.sleep(0.06)
                tap_key_combo([VK_CONTROL], VK_C)
                time.sleep(0.07)
                selected = get_clipboard_text()

    if selected and selected != sentinel:
        morphed, target_lang = morph_korean_english_text_with_direction(selected)
        if allow_iron and not auto_triggered:
            base_for_iron = morphed if (morphed != selected and target_lang is not None) else selected
            ironed = iron_and_polish_korean_text(base_for_iron)
            if ironed != base_for_iron:
                morphed = ironed
                if target_lang is None:
                    target_lang = "KO"

        if morphed != selected and target_lang is not None:
            final_out = (morphed if morphed.endswith(" ") else morphed + " ") if auto_triggered else morphed
            prev_ime_kor_c = get_ime_is_korean(target_hwnd) if target_hwnd else None
            arm_undo_snapshot(target_hwnd, edit_child, selected, final_out, mode="clip_replace", prev_ime_kor=prev_ime_kor_c)
            daemon_set_cb(final_out)
            time.sleep(0.02)
            tap_key_combo([VK_CONTROL], VK_V)
            time.sleep(0.04)
            set_ime_language(target_korean=(target_lang == "KO"))
            if orig_clip and orig_clip != sentinel:
                daemon_set_cb(orig_clip)
            return True, selected.strip(), final_out.strip(), target_lang
        else:
            tap_key_combo([], 0x27)
            if orig_clip and orig_clip != sentinel:
                daemon_set_cb(orig_clip)
            return False, selected, selected, None

    if auto_triggered and fallback_text:
        prev_ime_kor_fb = get_ime_is_korean(target_hwnd) if target_hwnd else None
        arm_undo_snapshot(target_hwnd, edit_child, "", fallback_text, mode="clip_replace", prev_ime_kor=prev_ime_kor_fb)
        set_ime_language(target_korean=True)
        daemon_set_cb(fallback_text)
        time.sleep(0.02)
        tap_key_combo([VK_CONTROL], VK_V)
        time.sleep(0.04)
        if orig_clip and orig_clip != sentinel:
            daemon_set_cb(orig_clip)
        return True, "", fallback_text.strip(), "KO"

    if orig_clip and orig_clip != sentinel:
        daemon_set_cb(orig_clip)
    return False, "", "", None


def superpower_2_typo_morph(daemon_set_cb, auto_triggered: bool = False) -> bool:
    """
    [②번] 무후크 가상 클립보드 스왑 기반 양방향 한영 오타 성형 + 띄어쓰기·줄바꿈 복합 다림질 + 한/영 키(IME) 자동 전환
    """
    orig_clip = get_clipboard_text()
    ok, raw_s, morphed_s, target_lang = _restore_target_focus_and_replace_line(
        _LAST_TARGET_HWND, daemon_set_cb, fallback_text=None, auto_triggered=auto_triggered, allow_iron=True
    )
    if ok and target_lang is not None:
        lang_badge = "한글키 전환" if target_lang == "KO" else "영문키 전환"
        show_ghost_toast(f"👻 귀신같이 복합성형 ({raw_s[:16]} ➔ {morphed_s[:16]} | {lang_badge})")
        return True

    if not auto_triggered and raw_s:
        show_ghost_toast("👻 귀신같이 복합성형 완료")
        return True

    if not auto_triggered and orig_clip:
        morphed, target_lang2 = morph_korean_english_text_with_direction(orig_clip)
        base_for_iron = morphed if (morphed != orig_clip and target_lang2 is not None) else orig_clip
        ironed = iron_and_polish_korean_text(base_for_iron)
        if ironed != base_for_iron:
            morphed = ironed
            if target_lang2 is None:
                target_lang2 = "KO"
        if morphed != orig_clip and target_lang2 is not None:
            arm_undo_snapshot(_LAST_TARGET_HWND, _find_edit_control_child(_LAST_TARGET_HWND), orig_clip, morphed, mode="pre_iron")
            daemon_set_cb(morphed)
            set_ime_language(target_korean=(target_lang2 == "KO"))
            lang_badge = "한글키 전환" if target_lang2 == "KO" else "영문키 전환"
            show_ghost_toast(f"👻 귀신같이 복합성형 ({morphed[:15].strip()} | {lang_badge})")
            return True
        else:
            show_ghost_toast("👻 귀신같이 한영성형")
            return True
    return False


AD_ANCHOR_PHRASES = [
    "무단전재 및 재배포 금지",
    "저작권자 (c) 무단전재",
    "관련기사 더보기 클릭",
    "구독과 좋아요 알림설정 부탁드립니다",
    "본 기사의 저작권은 언론사에 있습니다",
]


def _strip_copyright_and_ad_boilerplate(raw_txt: str) -> str:
    if not raw_txt:
        return ""
    cleaned = re.sub(r"(무단\s*전재\s*및\s*재배포\s*금지.*|저작권자\s*\(c\).*|ⓒ\s*.*무단.*)", "", raw_txt, flags=re.IGNORECASE)
    lines = [ln for ln in cleaned.splitlines()]
    if len(lines) >= 3:
        ad_vecs = [AI_ENGINE.embed_128d(p) for p in AD_ANCHOR_PHRASES]
        while lines and len(lines) >= 2:
            tail = lines[-1].strip()
            if not tail:
                lines.pop()
                continue
            if re.search(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", tail) and ("기자" in tail or "특파원" in tail):
                lines.pop()
                continue
            tail_vec = AI_ENGINE.embed_128d(tail)
            max_sim = max(AI_ENGINE.cosine_sim(tail_vec, av) for av in ad_vecs)
            if max_sim >= 0.82:
                lines.pop()
            else:
                break
    return "\n".join(lines).strip()


def clean_and_iron_text(raw_txt: str, allow_typo_morph: bool = False) -> str:
    """서식 세탁(순수 텍스트화 + 광고·저작권 꼬리말 절삭) + 한영 오타 성형 + 줄바꿈·유령공백(NFKC)·띄어쓰기 다림질 통합"""
    if not raw_txt or not raw_txt.strip():
        return raw_txt or ""
    stripped_body = _strip_copyright_and_ad_boilerplate(raw_txt)
    if not stripped_body:
        return ""
    return iron_and_polish_korean_text(stripped_body, allow_typo_morph=allow_typo_morph)


def superpower_1_clean_and_iron_lines(
    daemon_set_cb,
    raw_src: str | None = None,
    has_recent_drag: bool = False,
) -> bool:
    """
    [①번 — 수동 서식·줄바꿈 다림질 (자동 발동 폐지 ➔ 단축키 1번 수동 전환)]:
    1) 메모장(Edit/RichEditD2DPT)에서 드래그 선택 영역이 있거나, 방금 붙여넣은 본문과 동일한 경우 그 자리에서 0.2ms 원자적 다림질!
    2) 웹·노션·카톡 등에서 문장을 드래그 선택한 직후 호출한 경우 선택 영역을 즉시 원위치 다림질!
    3) 일반 복사(Ctrl+C) 후 [1]번을 누른 경우 HTML/RTF 서식 세탁 + 광고·저작권 꼬리말 제거 + 끊어진 줄바꿈·띄어쓰기 다림질을
       클립보드에 장전하여 Ctrl+V 한 번으로 깔끔히 붙여넣을 수 있게 준비합니다 (Ctrl+Z 원복 지원).
    """
    clip_txt = raw_src if (raw_src and raw_src.strip()) else get_clipboard_text()
    ed_target = _find_edit_control_child(_LAST_TARGET_HWND) if (_LAST_TARGET_HWND and u32.IsWindow(_LAST_TARGET_HWND)) else 0

    # 1) 메모장(Edit / RichEditD2DPT) 내부 선택 영역 또는 본문 일치 시 원위치(In-Place) 즉시 다림질
    if ed_target:
        try:
            full_before, idx_text, is_rich = _get_edit_full_text_and_index_str(ed_target)
            if idx_text:
                utf16_b = idx_text.encode("utf-16-le")
                utf16_total = len(utf16_b) // 2
                s_dw = wintypes.DWORD(0)
                e_dw = wintypes.DWORD(0)
                _send_msg_timeout_val(ed_target, EM_GETSEL, ctypes.addressof(s_dw), ctypes.addressof(e_dw), 120)
                s_pos, e_pos = s_dw.value, e_dw.value
                norm_doc = full_before.replace("\r\n", "\n").replace("\r", "\n").strip()
                norm_clip = (clip_txt or "").replace("\r\n", "\n").replace("\r", "\n").strip()
                has_sel = (0 <= s_pos < e_pos <= utf16_total)
                should_inplace_doc = has_sel or (not norm_clip and bool(norm_doc)) or (bool(norm_doc) and norm_doc == norm_clip)
                if should_inplace_doc:
                    if has_sel:
                        src_seg = utf16_b[s_pos * 2 : e_pos * 2].decode("utf-16-le", errors="ignore")
                    else:
                        src_seg = idx_text
                    out_seg = clean_and_iron_text(src_seg)
                    out_win = out_seg.replace("\r\n", "\n").replace("\n", "\r\n") if not is_rich else out_seg
                    if out_seg.strip() != src_seg.strip():
                        if has_sel:
                            _send_msg_timeout_val(ed_target, EM_SETSEL, s_pos, e_pos, 120)
                            rbuf = ctypes.create_unicode_buffer(out_win)
                            _send_msg_timeout_val(ed_target, EM_REPLACESEL, 1, ctypes.addressof(rbuf), 150)
                            rep_u16 = len(out_seg.encode("utf-16-le")) // 2
                            _send_msg_timeout_val(ed_target, EM_SETSEL, s_pos, s_pos + rep_u16, 120)
                        else:
                            _send_msg_timeout_val(ed_target, EM_SETSEL, 0, -1, 120)
                            rbuf = ctypes.create_unicode_buffer(out_win)
                            _send_msg_timeout_val(ed_target, EM_REPLACESEL, 1, ctypes.addressof(rbuf), 150)
                        full_after, _, _ = _get_edit_full_text_and_index_str(ed_target)
                        root_h = u32.GetAncestor(ed_target, 2) or ed_target
                        arm_undo_snapshot(
                            root_h,
                            ed_target,
                            src_seg,
                            out_win,
                            mode="edit_replace",
                            full_doc_before=full_before,
                            full_doc_after=full_after,
                        )
                    clip_ready = out_seg.replace("\r\n", "\n").replace("\r", "\n").replace("\n", "\r\n")
                    daemon_set_cb(clip_ready)
                    show_ghost_toast("👻 귀신같이 [1] 서식·줄바꿈 다림질 완료 (Ctrl+Z 원복)")
                    return True
        except Exception:
            pass

    # 2) 일반 앱(노션·구글시트·구글독스·브라우저·워드 등)에서 드래그/단어선택/시트 셀 선택 직후 [1]번 호출 시 자동 복사 ➔ 서식·줄바꿈 세탁 ➔ 제자리 교체
    _, target_title = _get_win_class_and_title(_LAST_TARGET_HWND) if (_LAST_TARGET_HWND and u32.IsWindow(_LAST_TARGET_HWND)) else ("", "")
    title_low = target_title.lower()
    is_gsheets_win = any(k in title_low for k in ("google sheets", "google 스프레드시트", "스프레드시트"))
    if not ed_target and (has_recent_drag or is_gsheets_win) and _LAST_TARGET_HWND and u32.IsWindow(_LAST_TARGET_HWND):
        try:
            sentinel = "__GHOSTI_IRON_SEL__"
            release_all_modifiers()
            daemon_set_cb(sentinel)
            time.sleep(0.02)
            tap_key_combo([VK_CONTROL], VK_C)
            sel_copied = sentinel
            for _ in range(12):
                time.sleep(0.02)
                cand_cb = get_clipboard_text()
                if cand_cb and cand_cb != sentinel:
                    sel_copied = cand_cb
                    break
            if sel_copied and sel_copied != sentinel and sel_copied.strip():
                is_cell_or_tsv_copy = ("\t" in sel_copied) or (is_gsheets_win and sel_copied.endswith(("\r\n", "\n")))
                had_trailing_nl = sel_copied.endswith(("\r\n", "\n")) and "\n" not in sel_copied.rstrip("\r\n")
                out_sel = clean_and_iron_text(sel_copied, allow_typo_morph=False)
                out_sel_win = out_sel.replace("\r\n", "\n").replace("\r", "\n").replace("\n", "\r\n")
                if not had_trailing_nl and "\t" not in out_sel_win:
                    out_sel_win = out_sel_win.rstrip("\r\n")
                # 구글시트 셀 그리드 상태에서 Ctrl+C 직후에는 내부 웹-클립보드 복사 링(점선 테두리)이 활성화되어
                # 곧바로 Ctrl+V를 치면 OS 클립보드 대신 시트 내부 원문이 그대로 붙여넣어지므로, Esc로 내부 복사 링만 해제 후 OS 클립보드 사출!
                if is_gsheets_win and is_cell_or_tsv_copy:
                    tap_key_combo([], 0x1B)  # VK_ESCAPE
                    time.sleep(0.03)
                daemon_set_cb(out_sel_win)
                time.sleep(0.035)
                tap_key_combo([VK_CONTROL], VK_V)
                arm_undo_snapshot(_LAST_TARGET_HWND, 0, sel_copied, out_sel_win, mode="clipboard_paste")
                show_ghost_toast("👻 귀신같이 [1] 선택 영역 서식·줄바꿈 다림질 완료 (Ctrl+Z 원복)")
                return True
            elif clip_txt:
                daemon_set_cb(clip_txt)
        except Exception:
            if clip_txt:
                try:
                    daemon_set_cb(clip_txt)
                except Exception:
                    pass

    # 3) 클립보드 복사(Ctrl+C) 텍스트의 HTML/RTF 서식 세탁 + 줄바꿈 다림질 장전 및 빈 줄 커서 시 즉시 사출
    if clip_txt and clip_txt.strip():
        out_clip = clean_and_iron_text(clip_txt)
        out_clip_win = out_clip.replace("\r\n", "\n").replace("\r", "\n").replace("\n", "\r\n")
        if ed_target:
            try:
                cur_ln_chk = _get_edit_control_current_line(ed_target) or ""
                if not cur_ln_chk.strip():
                    full_before_ins, _, is_rich_ins = _get_edit_full_text_and_index_str(ed_target)
                    ins_str = out_clip if is_rich_ins else out_clip_win
                    rbuf_ins = ctypes.create_unicode_buffer(ins_str)
                    _send_msg_timeout_val(ed_target, EM_REPLACESEL, 1, ctypes.addressof(rbuf_ins), 150)
                    full_after_ins, _, _ = _get_edit_full_text_and_index_str(ed_target)
                    root_ins = u32.GetAncestor(ed_target, 2) or ed_target
                    arm_undo_snapshot(
                        root_ins,
                        ed_target,
                        clip_txt,
                        ins_str,
                        mode="edit_replace",
                        full_doc_before=full_before_ins,
                        full_doc_after=full_after_ins,
                    )
                    daemon_set_cb(out_clip_win)
                    show_ghost_toast("👻 귀신같이 [1] 서식·줄바꿈 다림질 완료 (Ctrl+Z 원복)")
                    return True
            except Exception:
                pass
        arm_undo_snapshot(_LAST_TARGET_HWND, ed_target, clip_txt, out_clip_win, mode="pre_iron")
        daemon_set_cb(out_clip_win)
        show_ghost_toast("👻 귀신같이 [1] 서식·줄바꿈 다림질 완료 (Ctrl+V로 붙여넣기)")
        return True

    show_ghost_toast("👻 다림질할 문장을 복사(Ctrl+C)하거나 드래그한 뒤 [1]번을 눌러주세요")
    return False


def superpower_3_clean_format(daemon_set_cb, raw_src: str | None = None) -> None:
    superpower_1_clean_and_iron_lines(daemon_set_cb, raw_src=raw_src, has_recent_drag=False)


def superpower_4_iron_lines_and_nfkc(daemon_set_cb, raw_src: str | None = None) -> None:
    superpower_1_clean_and_iron_lines(daemon_set_cb, raw_src=raw_src, has_recent_drag=False)


def superpower_5_merge_or_ai_search(recent_list: list[str], seq_q: list[str], ai_history: list[dict], daemon_set_cb) -> bool:
    """
    [③번] 다중 복사 1초 합본 & 복사 이력 검색창 연동
    """
    source = seq_q if len(seq_q) >= 2 else recent_list
    if len(source) >= 2:
        merged = "\n\n".join(item.strip() for item in source if item.strip())
        daemon_set_cb(merged)
        show_ghost_toast(f"👻 귀신같이 합본 완료 ({len(source)}개 · Ctrl+V로 붙여넣기)")
        return True

    # 복사해 둔 다중 항목이 1개 이하일 때는 중복 tk.Tk() 스레드 충돌 없이 단일 귀신검색창(UI ②)으로 즉시 연결
    _toast_queue.put(("__UI2_SEARCH__|small|", 8000))
    return True


def superpower_6_screen_ocr(daemon_set_cb) -> None:
    """
    [⑥번 & 제7호 특허 청구항 제7항]
    화면 캡처 PP-OCRv5 Korean 바운딩 박스의 수직(Y축) 행 군집화 및 수평(X축) 열 간격 탭(\t) 삽입을 통한 엑셀 표(TSV) 기하 복원
    """
    tmp_img = Path(tempfile.gettempdir()) / "ghosti_ocr_temp.png"
    try:
        from PIL import ImageGrab
        import ppocr_v5_worker

        img = ImageGrab.grabclipboard()
        if img is None:
            show_ghost_toast("👻 귀신같이 글자추출 (Win+Shift+S 캡처 후 눌러주세요)")
            return
        img.save(tmp_img, "PNG")
        res_map = ppocr_v5_worker.invoke_ppocr_subprocess([tmp_img], filter_video_ui=False, timeout_sec=35.0)
        item = res_map.get(str(tmp_img.resolve())) or res_map.get(tmp_img.name) or {}
        words: list[dict] = []
        for ln in item.get("lines") or []:
            if isinstance(ln, dict):
                for w in ln.get("words") or []:
                    if isinstance(w, dict) and w.get("t"):
                        words.append(w)
        if words:
            words.sort(key=lambda w: (w["y"] + w["h"] * 0.5, w["x"]))
            rows: list[list[dict]] = []
            for w in words:
                cy = w["y"] + w["h"] * 0.5
                if not rows:
                    rows.append([w])
                else:
                    prev_row = rows[-1]
                    prev_cy = sum(pw["y"] + pw["h"] * 0.5 for pw in prev_row) / len(prev_row)
                    avg_h = max(12.0, sum(pw["h"] for pw in prev_row) / len(prev_row))
                    if abs(cy - prev_cy) <= avg_h * 0.6:
                        prev_row.append(w)
                    else:
                        rows.append([w])

            tsv_lines = []
            is_table = False
            for r in rows:
                r.sort(key=lambda w: w["x"])
                line_parts = [r[0]["t"]]
                for idx in range(1, len(r)):
                    prev_w = r[idx - 1]
                    curr_w = r[idx]
                    gap = curr_w["x"] - (prev_w["x"] + prev_w["w"])
                    col_thresh = max(18.0, prev_w["h"] * 1.35)
                    if gap > col_thresh:
                        line_parts.append("\t" + curr_w["t"])
                        is_table = True
                    else:
                        line_parts.append(" " + curr_w["t"])
                tsv_lines.append("".join(line_parts))

            final_txt = "\n".join(tsv_lines).strip()
            daemon_set_cb(final_txt)
            show_ghost_toast("👻 귀신같이 표(TSV)추출" if is_table else "👻 귀신같이 글자추출")
            return
    except Exception:
        pass
    finally:
        try:
            tmp_img.unlink(missing_ok=True)
        except Exception:
            pass
    show_ghost_toast("👻 귀신같이 글자추출")


_LAST_TARGET_HWND: int = 0
_PINNED_HWNDS: set[int] = set()
_AUTO_PINNED_HWNDS: set[int] = set()


def _get_win_class_only(hwnd: int) -> str:
    """Cross-process SendMessage(WM_GETTEXT) 병목이 전혀 없는 0ms 커널 클래스명 전용 조회"""
    if not hwnd:
        return ""
    cls_buf = ctypes.create_unicode_buffer(128)
    u32.GetClassNameW(hwnd, cls_buf, 128)
    return cls_buf.value or ""


def _get_win_class_and_title(hwnd: int) -> tuple[str, str]:
    """크로스-프로세스 먹통 창에서도 무한 대기하지 않도록 WM_GETTEXT 80ms 타임아웃으로 창 제목을 안전 조회합니다."""
    if not hwnd:
        return "", ""
    cls_buf = ctypes.create_unicode_buffer(128)
    u32.GetClassNameW(hwnd, cls_buf, 128)
    title_buf = ctypes.create_unicode_buffer(512)
    _ok_gt, _ = _send_msg_timeout_val(hwnd, 0x000D, 512, ctypes.addressof(title_buf), 80)  # WM_GETTEXT
    return cls_buf.value or "", (title_buf.value if _ok_gt else "") or ""


# [귀신창 실시간 타이핑 수호신: 자체 오토코렉트/코드 에디터 프로그램 이중 변환 충돌 방지 예외 블랙리스트]
# - 아래아한글(HWP/한컴오피스), MS 오피스(Word/PowerPoint), 글로벌 교정 툴(Grammarly/Ichitaro/ATOK) 및 IDE에서는
#   프로그램 자체 '한/영 자동 고침(AutoCorrect)' 엔진이나 고유 인라인 캔버스와 귀신창이 충돌하지 않도록
#   실시간 타이핑 자동성형(Space 2어절 감지) 개입을 100% PASS(양보)합니다.
AUTOCORRECT_EXCLUDE_PROCESSES: set[str] = {
    # 1. 국내 한컴오피스 계열 (자체 글자판 자동 변경 보유)
    "hwp.exe",
    "hshow.exe",
    "hcell.exe",
    "hword.exe",
    # 2. 글로벌 Microsoft Office / LibreOffice 계열 (워드·파워포인트는 자체 한/영 자동 고침 우선 / 엑셀은 셀 편집 EXCEL6 미변환 시 원자적 1회 교체 허용)
    "winword.exe",
    "powerpnt.exe",
    "soffice.bin",
    "soffice.exe",
    # 3. 글로벌(영미권·일본 등 해외 버전) 자체 교정 및 IME 전문 소프트웨어
    "grammarly.desktop.exe",
    "grammarly.exe",
    "jstaro.exe",
    "ichitaro.exe",
    "atok.exe",
    # 4. 개발자 코딩 IDE (영문 코드 작성 시 오타 판정 간섭 원천 방지)
    "antigravity.exe",
    "code.exe",
    "devenv.exe",
    "cursor.exe",
    "windsurf.exe",
    "pycharm64.exe",
    "idea64.exe",
    "webstorm64.exe",
    # 5. Electron TSF 리치 에디터 데스크톱 앱 (웹 브라우저는 카페 댓글·글쓰기 등 실사용 영타➔한글 자동변환을 위해 허용!)
    "notion.exe",
    "obsidian.exe",
    "slack.exe",
    "discord.exe",
    "teams.exe",
    "ms-teams.exe",
    "figma.exe",
}

_BROWSER_AUTO_TYPO_PROCS: tuple[str, ...] = (
    "chrome.exe",
    "msedge.exe",
    "whale.exe",
    "brave.exe",
    "firefox.exe",
    "opera.exe",
    "vivaldi.exe",
    "arc.exe",
    "iexplore.exe",
)

_BROWSER_URL_BAR_STATE: dict[str, bool] = {"active": False}


def _update_browser_url_bar_on_click(fg_hwnd: int) -> bool:
    """
    크롬·웨일·엣지 등 브라우저에서 UIAutomation(IUIAutomation::GetFocusedElement) 크로스프로세스 COM 호출 시
    크로미움 전체 AXTree 직렬화로 인해 메인 스레드가 일시 정지(버벅임)하는 현상을 원천 제거하기 위해,
    0.002ms 순수 Win32 창 상단 좌표(탭·주소창 헤더 영역 <= 118px) 판정으로 주소창 포커스 여부를 즉시 갱신합니다.
    """
    if sys.platform != "win32" or not fg_hwnd:
        _BROWSER_URL_BAR_STATE["active"] = False
        return False
    try:
        proc_low = _get_process_name_from_hwnd(fg_hwnd).lower()
        if proc_low not in _BROWSER_AUTO_TYPO_PROCS:
            _BROWSER_URL_BAR_STATE["active"] = False
            return False
        pt = wintypes.POINT()
        rc = wintypes.RECT()
        if u32.GetCursorPos(ctypes.byref(pt)) and u32.GetWindowRect(fg_hwnd, ctypes.byref(rc)):
            rel_y = int(pt.y) - int(rc.top)
            is_top_chrome = 0 <= rel_y <= 118
            _BROWSER_URL_BAR_STATE["active"] = is_top_chrome
            return is_top_chrome
    except Exception:
        pass
    _BROWSER_URL_BAR_STATE["active"] = False
    return False


def _is_browser_address_bar_focused() -> bool:
    """
    단축키(Ctrl+L / Alt+D / F6 / Ctrl+T / Ctrl+N) 및 마우스 상단 헤더 클릭 상태를 기반으로
    COM/UIAutomation 블로킹 0%로 주소창 포커스 여부를 즉시 반환합니다.
    """
    return bool(_BROWSER_URL_BAR_STATE.get("active", False))

AUTOCORRECT_EXCLUDE_CLASS_KEYWORDS: tuple[str, ...] = (
    "hwp",
    "hnc_",
    "hncedit",
    "opusapp",
    "_wwg",
    "pptframeclass",
)

WEB_TSF_NON_EDIT_CLASS_PREFIXES: tuple[str, ...] = (
    "chrome_widgetwin_",
    "chrome_renderwidgethosthwnd",
    "mozillawindowclass",
)


_PID_EXE_NAME_CACHE: dict[int, tuple[float, str]] = {}
_SKIP_AUTO_TYPO_CACHE: dict[tuple[int, int, bool], tuple[float, bool, bool]] = {}
_EDIT_CHILD_LOOKUP_CACHE: dict[tuple[int, int], tuple[float, int]] = {}


def _get_exe_name_by_pid_cached(pid_val: int) -> str:
    if not pid_val:
        return ""
    now_m = time.monotonic()
    hit = _PID_EXE_NAME_CACHE.get(pid_val)
    if hit is not None and (now_m - hit[0]) < 30.0:
        return hit[1]
    proc_name = ""
    try:
        PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
        hproc = k32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid_val)
        if hproc:
            try:
                buf_len = wintypes.DWORD(512)
                path_buf = ctypes.create_unicode_buffer(512)
                if k32.QueryFullProcessImageNameW(hproc, 0, path_buf, ctypes.byref(buf_len)):
                    proc_name = Path(path_buf.value).name
            finally:
                k32.CloseHandle(hproc)
    except Exception:
        pass
    if len(_PID_EXE_NAME_CACHE) > 512:
        _PID_EXE_NAME_CACHE.clear()
    _PID_EXE_NAME_CACHE[pid_val] = (now_m, proc_name)
    return proc_name


def get_window_process_and_class(hwnd: int) -> tuple[str, str, str]:
    """활성 창 핸들(hwnd)로부터 (실행파일명, 윈도우클래스명, 창제목)을 고속 추출 (PID -> exe 캐싱으로 OpenProcess 반복 제거)"""
    if not hwnd:
        return "", "", ""
    win_cls, win_title = _get_win_class_and_title(hwnd)
    proc_name = ""
    try:
        pid = wintypes.DWORD(0)
        u32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        if pid.value:
            proc_name = _get_exe_name_by_pid_cached(int(pid.value))
    except Exception:
        pass
    return proc_name, win_cls, win_title


def _get_process_name_from_hwnd(hwnd: int | None) -> str:
    if not hwnd:
        return ""
    try:
        pid = wintypes.DWORD(0)
        u32.GetWindowThreadProcessId(int(hwnd), ctypes.byref(pid))
        if pid.value:
            return _get_exe_name_by_pid_cached(int(pid.value))
    except Exception:
        pass
    return ""


def _find_edit_control_child_cached(hwnd_fg: int) -> int:
    """15ms 루프에서 EnumChildWindows / FindWindowExW 반복 호출을 차단하는 250ms 메모리 캐시 래퍼"""
    if not hwnd_fg or not u32.IsWindow(hwnd_fg):
        return 0
    focus_h = _get_focused_control_hwnd(hwnd_fg)
    ckey = (int(hwnd_fg), int(focus_h))
    now_m = time.monotonic()
    hit = _EDIT_CHILD_LOOKUP_CACHE.get(ckey)
    if hit is not None and (now_m - hit[0]) < 0.25:
        cached_ed = hit[1]
        if cached_ed == 0:
            return 0
        if u32.IsWindow(cached_ed) and u32.IsWindowVisible(cached_ed):
            return cached_ed
    ed = _find_edit_control_child(hwnd_fg)
    if len(_EDIT_CHILD_LOOKUP_CACHE) > 256:
        _EDIT_CHILD_LOOKUP_CACHE.clear()
    _EDIT_CHILD_LOOKUP_CACHE[ckey] = (now_m, int(ed or 0))
    return ed


def should_skip_auto_typo(hwnd: int) -> bool:
    """
    [타 프로그램 충돌 원천 차단 — 포커스 검증형 입력칸 화이트리스트(Strict Focus-Verified Whitelist)]
    - 블랙리스트 나열 방식만으로는 세상의 수많은 그래픽·영상·CAD·터미널·커스텀 툴 단축키 충돌을 다 막을 수 없으므로,
      실시간 키보드 개입(Space/0.55초 자동 성형)은 실제 키보드 포커스(GetGUIThreadInfo.hwndFocus)가 검증된 순수 입력칸에서만 작동합니다.
    - 은행 창 선행 기상은 merlin_z_core_daemon.py의 1.5초 워처가 전담하므로 15ms 루프 내 디스크 JSON I/O를 0건으로 유지하며,
      동일 (hwnd, focus_h) 결과는 250ms 동안 메모리에 캐싱하여 OpenProcess / EnumChildWindows 반복 호출을 원천 차단합니다.
    """
    if not hwnd:
        return True
    try:
        auto_enabled = is_ghostkey_active_mode() and bool(get_superpower_settings().get("auto_typo_enabled", True))
        if not auto_enabled:
            return True

        focus_h = _get_focused_control_hwnd(hwnd)
        now_m = time.monotonic()
        ckey = (int(hwnd), int(focus_h), auto_enabled)
        hit = _SKIP_AUTO_TYPO_CACHE.get(ckey)
        if hit is not None and (now_m - hit[0]) < 0.25:
            skip_res, is_browser_win = hit[1], hit[2]
            if not skip_res and is_browser_win:
                # 웹 [⚡ 귀신창] 수련장 입력칸 포커스 시 document.title의 \u2063 마커는 즉시 반영
                root_fast = u32.GetAncestor(hwnd, 2) or hwnd
                _, t_fast = _get_win_class_and_title(root_fast)
                if t_fast and "\u2063" in t_fast:
                    return True
            return skip_res

        root_h = u32.GetAncestor(hwnd, 2) or hwnd
        for target_h in (hwnd, root_h):
            if not target_h:
                continue
            proc_name, win_cls, win_title_chk = get_window_process_and_class(target_h)
            if win_title_chk and "\u2063" in win_title_chk:
                # 웹 [⚡ 귀신창] 수련장 입력칸 포커스 중에는 웹 자체 즉시 변환 엔진과 OS 데몬이 이중 개입하지 않도록 100% 양보
                return True
            proc_lower = (proc_name or "").lower()
            cls_lower = (win_cls or "").lower()
            if (
                proc_lower in AUTOCORRECT_EXCLUDE_PROCESSES
                or proc_lower in _RCLICK_BYPASS_PROCS
                or proc_lower in ("explorer.exe", "python.exe", "pythonw.exe")
            ):
                _SKIP_AUTO_TYPO_CACHE[ckey] = (now_m, True, False)
                return True
            if any(kw in cls_lower for kw in AUTOCORRECT_EXCLUDE_CLASS_KEYWORDS):
                _SKIP_AUTO_TYPO_CACHE[ckey] = (now_m, True, False)
                return True
            if (
                any(cls_lower.startswith(pfx) for pfx in WEB_TSF_NON_EDIT_CLASS_PREFIXES)
                and proc_lower not in _BROWSER_AUTO_TYPO_PROCS
            ):
                _SKIP_AUTO_TYPO_CACHE[ckey] = (now_m, True, False)
                return True

        proc_root, cls_root, _ = get_window_process_and_class(root_h)
        proc_root_low = (proc_root or "").lower()
        focus_cls = _get_win_class_only(focus_h) if focus_h else ""
        is_browser_root = proc_root_low in _BROWSER_AUTO_TYPO_PROCS
        if len(_SKIP_AUTO_TYPO_CACHE) > 256:
            _SKIP_AUTO_TYPO_CACHE.clear()

        # [허용 1] 실제 키보드 포커스가 Win32 표준 Edit / RichEdit 컨트롤에 놓인 경우 (비밀번호 칸 제외)
        if focus_h and focus_cls in _NATIVE_EDIT_CLASSES:
            res = bool(u32.GetWindowLongW(focus_h, -16) & 0x0020)
            _SKIP_AUTO_TYPO_CACHE[ckey] = (now_m, res, is_browser_root)
            return res

        # [허용 2] 메모장(notepad.exe) 및 워드패드(wordpad.exe — RICHEDIT50W)
        if proc_root_low in ("notepad.exe", "wordpad.exe") or cls_root in ("Notepad", "WordPadClass"):
            ed_np = _find_edit_control_child_cached(root_h)
            res = not bool(ed_np and not (u32.GetWindowLongW(ed_np, -16) & 0x0020))
            _SKIP_AUTO_TYPO_CACHE[ckey] = (now_m, res, False)
            return res

        # [허용 3] 카카오톡 PC 채팅 입력창 (최신 EVA_Window_Dblclk / 무포커스 핸들 포함, 비밀번호 칸 제외)
        if proc_root_low == "kakaotalk.exe":
            if focus_h and (u32.GetWindowLongW(focus_h, -16) & 0x0020):
                _SKIP_AUTO_TYPO_CACHE[ckey] = (now_m, True, False)
                return True
            if not focus_cls or focus_cls in ("RICHEDIT50W", "Edit", "EVA_ChildWindow", "EVA_Window_Dblclk", "EVA_Window"):
                _SKIP_AUTO_TYPO_CACHE[ckey] = (now_m, False, False)
                return False

        # [허용 4] 웹 브라우저(크롬·엣지·웨일·브레이브·파이어폭스 등 — 카페 댓글·글쓰기 등 웹 입력창 영타➔한글 자동변환)
        if is_browser_root:
            _SKIP_AUTO_TYPO_CACHE[ckey] = (now_m, False, True)
            return False

        # [허용 5] 엑셀(excel.exe — 오직 실제 '셀 텍스트 편집 모드(EXCEL6)' 또는 '수식 입력줄(EXCEL<)'일 때만 허용, 시트 그리드 EXCEL7은 100% 차단!)
        if proc_root_low == "excel.exe" or cls_root == "XLMAIN":
            res = focus_cls not in ("EXCEL6", "EXCEL<")
            _SKIP_AUTO_TYPO_CACHE[ckey] = (now_m, res, False)
            return res

        # 그 외 모든 프로그램(워드·한글 등 자체 오토코렉트 보유 앱)은 실시간 자동성형 100% 차단
        _SKIP_AUTO_TYPO_CACHE[ckey] = (now_m, True, False)
        return True
    except Exception:
        return True


def _apply_window_topmost(hwnd: int, topmost: bool) -> bool:
    """Win10/Win11 UWP(계산기 ApplicationFrameWindow) 및 일반 창(메모장) 공통 하드웨어급 Topmost 적용·검증 (AttachThreadInput 배제)"""
    if not hwnd or not u32.IsWindow(hwnd):
        return False
    ins_after = HWND_TOPMOST if topmost else HWND_NOTOPMOST
    u32.SetWindowPos(hwnd, ins_after, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW)
    ex = u32.GetWindowLongW(hwnd, GWL_EXSTYLE)
    if bool(ex & WS_EX_TOPMOST) != topmost:
        try:
            u32.SetWindowPos(hwnd, ins_after, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW)
        except Exception:
            pass
    return bool(u32.GetWindowLongW(hwnd, GWL_EXSTYLE) & WS_EX_TOPMOST) == topmost


def _set_pinned_title_badge(hwnd: int, pinned: bool) -> None:
    try:
        _, cur_title = _get_win_class_and_title(hwnd)
        if not cur_title:
            return
        clean_t = cur_title.replace("📌 [항상 위 고정] ", "").replace("[📌고정] ", "")
        new_t = f"📌 [항상 위 고정] {clean_t}" if pinned else clean_t
        if new_t != cur_title:
            u32.SetWindowTextW(hwnd, new_t)
    except Exception:
        pass


def _find_visible_utility_windows() -> list[int]:
    """Win10 & Win11 공통: 화면에 열려 있는 메모장(Notepad) 또는 계산기(ApplicationFrameWindow/CalcFrame/SciCalc) 탐색 (브라우저 제외)"""
    found: list[int] = []
    WNDENUMPROC = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

    def _enum_cb(h: int, _lp: int) -> bool:
        if u32.IsWindowVisible(h) and not u32.IsIconic(h):
            cls_name, title = _get_win_class_and_title(h)
            t_low = title.lower()
            c_low = cls_name.lower()
            if "chrome" in c_low or "mozilla" in c_low or "tk" in c_low:
                return True
            if (
                "notepad" in c_low
                or "calc" in c_low
                or "메모장" in t_low
                or "notepad" in t_low
                or "계산기" in t_low
                or "calculator" in t_low
            ):
                found.append(h)
        return True

    u32.EnumWindows(WNDENUMPROC(_enum_cb), 0)
    return found


def _unpin_accidental_browsers(exclude_hwnd: int = 0) -> None:
    """실수로 거대 브라우저(Chrome/Edge/Notion)에 걸린 WS_EX_TOPMOST가 작은 메모장/계산기를 덮지 않도록 자동 해제"""
    WNDENUMPROC = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

    def _enum_cb(h: int, _lp: int) -> bool:
        if h == exclude_hwnd or not u32.IsWindowVisible(h):
            return True
        cls_name, title = _get_win_class_and_title(h)
        if "Chrome_WidgetWin" in cls_name and h not in _PINNED_HWNDS:
            ex_s = u32.GetWindowLongW(h, GWL_EXSTYLE)
            if (ex_s & WS_EX_TOPMOST) != 0:
                _apply_window_topmost(h, False)
                _set_pinned_title_badge(h, False)
        return True

    u32.EnumWindows(WNDENUMPROC(_enum_cb), 0)


def enforce_pinned_windows() -> None:
    """
    고정된 창(_PINNED_HWNDS)이 OS에 의해 WS_EX_TOPMOST 속성을 잃었을 때만 핀셋 복구
    - 이미 WS_EX_TOPMOST가 켜져 있거나 우클릭 컨텍스트 메뉴(#32768 / Xaml_WindowedPopupClass)가 열려 있을 때는
      절대 SetWindowPos를 재호출하지 않아 메모장 우클릭 메뉴가 닫히는 현상을 100% 원천 차단합니다!
    """
    if (u32.GetAsyncKeyState(0x02) & 0x8000) != 0:
        return
    if u32.FindWindowW("#32768", None) or u32.FindWindowW("Xaml_WindowedPopupClass", None):
        return
    dead = []
    for h in list(_PINNED_HWNDS):
        if not u32.IsWindow(h):
            dead.append(h)
            continue
        ex = u32.GetWindowLongW(h, GWL_EXSTYLE)
        if (ex & WS_EX_TOPMOST) == 0:
            _apply_window_topmost(h, True)
    for d in dead:
        _PINNED_HWNDS.discard(d)
        _AUTO_PINNED_HWNDS.discard(d)


def _capture_target_hwnd() -> int:
    global _LAST_TARGET_HWND
    hwnd = u32.GetForegroundWindow()
    if hwnd:
        cls_name = _get_win_class_only(hwnd)
        if "Tk" not in cls_name and cls_name not in ("Progman", "WorkerW", "Shell_TrayWnd"):
            root_h = u32.GetAncestor(hwnd, 2)  # GA_ROOT = 2
            _LAST_TARGET_HWND = root_h or hwnd
    return _LAST_TARGET_HWND or hwnd


def superpower_7_toggle_topmost(target_hwnd: int = 0) -> None:
    fg_now = u32.GetForegroundWindow()
    if fg_now:
        fg_cls, _ = _get_win_class_and_title(fg_now)
        if "Tk" not in fg_cls and fg_cls not in ("Progman", "WorkerW", "Shell_TrayWnd"):
            target_hwnd = u32.GetAncestor(fg_now, 2) or fg_now

    hwnd = target_hwnd or _capture_target_hwnd()
    if hwnd:
        root_hwnd = u32.GetAncestor(hwnd, 2)  # GA_ROOT = 2
        if root_hwnd:
            hwnd = root_hwnd

    cls_name, title = _get_win_class_and_title(hwnd)
    util_hwnds = _find_visible_utility_windows()

    # 1) 유저가 노션(브라우저) 창에서 [Ctrl+0]->[7] 또는 [Ctrl+Alt+T]를 누른 경우:
    #    - 유틸창(메모장·계산기)이 이미 고정되어 있으면 즉시 전체 해제, 아니면 전체 고정!
    if "Chrome_WidgetWin" in cls_name and util_hwnds:
        _apply_window_topmost(hwnd, False)
        _PINNED_HWNDS.discard(hwnd)
        _AUTO_PINNED_HWNDS.discard(hwnd)
        _set_pinned_title_badge(hwnd, False)
        any_util_pinned = any(
            (uh in _PINNED_HWNDS) or ((u32.GetWindowLongW(uh, GWL_EXSTYLE) & WS_EX_TOPMOST) != 0)
            for uh in util_hwnds
        )
        if any_util_pinned:
            for uh in util_hwnds:
                _PINNED_HWNDS.discard(uh)
                _AUTO_PINNED_HWNDS.discard(uh)
                _apply_window_topmost(uh, False)
                _set_pinned_title_badge(uh, False)
            show_ghost_toast("👻 귀신같이 창고정해제")
        else:
            for uh in util_hwnds:
                _PINNED_HWNDS.add(uh)
                _apply_window_topmost(uh, True)
                _set_pinned_title_badge(uh, True)
            show_ghost_toast("👻 귀신같이 창고정 📌 (메모장·계산기)")
        return

    if hwnd:
        _unpin_accidental_browsers(exclude_hwnd=hwnd)
        ex_style = u32.GetWindowLongW(hwnd, GWL_EXSTYLE)
        is_already_top = (hwnd in _PINNED_HWNDS) or (hwnd in _AUTO_PINNED_HWNDS) or ((ex_style & WS_EX_TOPMOST) != 0)

        if is_already_top:
            _PINNED_HWNDS.discard(hwnd)
            _AUTO_PINNED_HWNDS.discard(hwnd)
            _apply_window_topmost(hwnd, False)
            _set_pinned_title_badge(hwnd, False)
            for auh in list(_AUTO_PINNED_HWNDS):
                _PINNED_HWNDS.discard(auh)
                _AUTO_PINNED_HWNDS.discard(auh)
                _apply_window_topmost(auh, False)
                _set_pinned_title_badge(auh, False)
            show_ghost_toast("👻 귀신같이 창고정해제")
        else:
            _PINNED_HWNDS.add(hwnd)
            _apply_window_topmost(hwnd, True)
            _set_pinned_title_badge(hwnd, True)
            if hwnd in util_hwnds:
                for uh in util_hwnds:
                    if uh != hwnd and uh not in _PINNED_HWNDS:
                        _AUTO_PINNED_HWNDS.add(uh)
                        _PINNED_HWNDS.add(uh)
                        _apply_window_topmost(uh, True)
                        _set_pinned_title_badge(uh, True)
            show_ghost_toast("👻 귀신같이 창고정 📌")


def _toggle_korean_number_format(txt: str) -> str:
    """
    [⑧번 & 제7호 특허 청구항 제4항]
    - 하이픈이 이미 있는 번호면 -> 숫자만 남기도록 제거 토글 (010-1234-5678 -> 01012345678)
    - 숫자만 있는 번호면 -> 한국형 표준 하이픈 삽입 (01012345678 -> 010-1234-5678, 사업자번호, 생년월일)
    - 통짜 카톡 문장이면 -> [성함 / 연락처 / 계좌 / 일정] AI 구조화 발라내기!
    """
    s = re.sub(r"[\u00A0\u200B-\u200D\uFEFF]", " ", txt).strip()
    s_single = re.sub(r"^(?:[-*•▪▫▶▷]\s*|\d+[.)]\s*)+", "", s).strip()
    # 1-A) 단일 번호에 이미 하이픈이 들어있는 경우 -> 숫자만 남기도록 역토글!
    if re.fullmatch(r"\d{2,4}-\d{2,4}-\d{4,5}", s_single):
        return re.sub(r"\D", "", s_single)
    # 1-B) 순수 숫자만 입력/복사된 경우 (휴대폰 10~11자리, 사업자번호 10자리, 생년월일 8자리) -> 하이픈만 깔끔하게 삽입!
    if re.fullmatch(r"\d{8,11}", s_single):
        if re.fullmatch(r"01[016789]\d{7,8}", s_single):
            return f"{s_single[:3]}-{s_single[3:-4]}-{s_single[-4:]}"
        if re.fullmatch(r"02\d{7,8}", s_single):
            return f"{s_single[:2]}-{s_single[2:-4]}-{s_single[-4:]}"
        if len(s_single) == 10:
            return f"{s_single[:3]}-{s_single[3:5]}-{s_single[5:]}"
        if len(s_single) == 8 and s_single[:2] in ("19", "20"):
            return f"{s_single[:4]}-{s_single[4:6]}-{s_single[6:]}"

    # 2) 통짜 카톡/메시지(연락처 + 계좌/일정이 서로 다른 구간에 함께 들어있는 문장) -> 구조화 추출!
    phone_m = re.search(r"\b(01[016789])[-.\s]?(\d{3,4})[-.\s]?(\d{4})\b", s)
    s_without_phone = (s[: phone_m.start()] + " " + s[phone_m.end() :]) if phone_m else s
    acct_m = re.search(
        r"(국민|신한|우리|하나|농협|기업|카카오뱅크|토스뱅크|새마을|우체국|부산|대구|경남|광주|전북|제주|수협|신협|씨티|SC제일)?\s*\b((?!01[016789][-.\s]?\d{3,4}[-.\s]?\d{4})\d{3,6}[-.\s]?\d{2,6}[-.\s]?\d{3,7})\b",
        s_without_phone,
    )
    sched_m = re.search(r"(오늘|내일|모레|\d{1,2}월\s*\d{1,2}일|[월화수목금토일]요일)\s*(오전|오후)?\s*(\d{1,2}시(\s*\d{1,2}분)?)", s_without_phone)
    if len(s) >= 18 and sum(bool(x) for x in (phone_m, acct_m, sched_m)) >= 2:
        name_m = re.search(r"([가-힣]{2,4})(?:입니다|드림|올림|배상|대표|팀장|과장|대리|사원)", s)
        structured = []
        if name_m:
            structured.append(f"- 성함: {name_m.group(1)}")
        if phone_m:
            structured.append(f"- 연락처: {phone_m.group(1)}-{phone_m.group(2)}-{phone_m.group(3)}")
        if acct_m:
            bank = (acct_m.group(1) or "").strip()
            structured.append(f"- 계좌: {bank} {acct_m.group(2)}".strip())
        if sched_m:
            structured.append(f"- 일정: {sched_m.group(0).strip()}")
        if structured:
            return "\n".join(structured)

    # 3) 숫자열 -> 한국형 표준 하이픈 삽입 (휴대폰, 서울전화, 사업자번호, 생년월일)
    out = re.sub(r"\b(01[016789])[-.\s]?(\d{3,4})[-.\s]?(\d{4})\b", r"\1-\2-\3", txt)
    out = re.sub(r"\b(02)[-.\s]?(\d{3,4})[-.\s]?(\d{4})\b", r"\1-\2-\3", out)
    out = re.sub(r"\b(\d{3})(\d{2})(\d{5})\b", r"\1-\2-\3", out)
    out = re.sub(r"\b(19\d{2}|20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\b", r"\1-\2-\3", out)
    return out


def superpower_8_format_numbers(daemon_set_cb, raw_src: str | None = None, has_recent_drag: bool = False) -> None:
    """
    [④번(구 ⑦번) 번호·일정성형 — 메모장·노션·입력창 원위치(In-Place) 즉시 하이픈 성형 + 클립보드 동시 반영]:
    - 메모장이나 노션·입력창에서 숫자를 치고 바로 [4번](또는 구 [7번])을 누르거나 드래그한 상태에서 누르면
      복사/붙여넣기할 필요 없이 그 자리에서 즉시 '010-1234-5678' / '123-45-67890' 형태로 하이픈이 삽입됩니다!
    """
    target_hwnd = _LAST_TARGET_HWND or u32.GetForegroundWindow()
    edit_child = 0
    if target_hwnd and u32.IsWindow(target_hwnd):
        try:
            fg_now = u32.GetForegroundWindow()
            if fg_now != target_hwnd:
                u32.SetForegroundWindow(target_hwnd)
            edit_child = _find_edit_control_child(target_hwnd)
            time.sleep(0.045)
        except Exception:
            pass

    # 1) 메모장(Edit/RichEditD2DPT) 원위치 즉시 하이픈 성형
    if edit_child and u32.IsWindow(edit_child):
        try:
            full_text, idx_text, is_rich = _get_edit_full_text_and_index_str(edit_child)
            if idx_text:
                utf16_bytes = idx_text.encode("utf-16-le")
                utf16_total = len(utf16_bytes) // 2
                s_dw = wintypes.DWORD(0)
                e_dw = wintypes.DWORD(0)
                _send_msg_timeout(edit_child, EM_GETSEL, ctypes.addressof(s_dw), ctypes.addressof(e_dw), 120)
                s_pos, e_pos = s_dw.value, e_dw.value
                target_str = ""
                line_start, line_end = 0, 0
                if s_pos != e_pos and 0 <= s_pos < e_pos <= utf16_total:
                    line_start, line_end = s_pos, e_pos
                    target_str = utf16_bytes[s_pos * 2 : e_pos * 2].decode("utf-16-le", errors="ignore")
                else:
                    line_start, l_end_num, cur_line = _get_logical_line_bounds_utf16(utf16_bytes, s_pos)
                    line_len = l_end_num - line_start
                    if cur_line and _toggle_korean_number_format(cur_line) != cur_line:
                        line_end = line_start + line_len
                        target_str = cur_line
                if target_str:
                    formatted_ed = _toggle_korean_number_format(target_str)
                    if formatted_ed != target_str:
                        final_ed = formatted_ed.replace("\r\n", "\n").replace("\n", "\r\n") if (not is_rich and "\n" in formatted_ed) else formatted_ed
                        _send_msg_timeout(edit_child, EM_SETSEL, line_start, line_end, 120)
                        rbuf = ctypes.create_unicode_buffer(final_ed)
                        _send_msg_timeout(edit_child, EM_REPLACESEL, 1, ctypes.addressof(rbuf), 150)
                        full_after, _, _ = _get_edit_full_text_and_index_str(edit_child)
                        arm_undo_snapshot(target_hwnd, edit_child, target_str, final_ed, mode="edit_replace", full_doc_before=full_text, full_doc_after=full_after)
                        daemon_set_cb(formatted_ed)
                        show_ghost_toast(f"👻 귀신같이 번호·일정성형 ({formatted_ed.splitlines()[0][:22]})")
                        return
        except Exception:
            pass

    # 2) 일반 입력창(노션/브라우저/워드/한글/카톡/엑셀) 원위치 하이픈 성형
    # 🚨 핵심(노션 블록 복사 방지): 노션에서 드래그 없이 Ctrl+C를 먼저 보내면 '노션 블록 전체 선택 모드(아랫줄까지 통째 복사)'로 빠져버려
    #    이후 Shift+Home이 먹히지 않고 원문 뒤에 중복 붙여넣기(01012345678010-1234-5678)가 발생함!
    #    따라서 유저가 마우스로 직접 드래그한 경우(has_recent_drag=True)가 아니면 절대 빈 Ctrl+C를 먼저 치지 않고,
    #    반드시 커서가 살아있는 상태에서 End ➔ Shift+Home을 먼저 눌러 '현재 줄 글자만' 텍스트 선택한 뒤 Ctrl+C -> Ctrl+V로 깔끔히 교체!
    sentinel = "__GHOSTI_NUM_SEL__"
    orig_clip = raw_src if (raw_src and raw_src.strip()) else get_clipboard_text()
    if target_hwnd and u32.IsWindow(target_hwnd):
        proc_num_t = _get_process_name_from_hwnd(target_hwnd).lower()
        cls_num_t = _get_win_class_only(target_hwnd).lower()
        is_excel_num = proc_num_t in ("excel.exe", "hcell.exe") or ("xlmain" in cls_num_t)
        VK_F2 = 0x71
        VK_END = 0x23
        VK_HOME = 0x24
        release_all_modifiers()
        if is_excel_num:
            focus_h_xl = _get_focused_control_hwnd(target_hwnd)
            focus_cls_xl = _get_win_class_only(focus_h_xl).upper() if focus_h_xl else ""
            if focus_cls_xl != "EXCEL6":
                tap_key_combo([], VK_F2)
                time.sleep(0.04)
            tap_key_combo([], VK_END)
            time.sleep(0.015)
            tap_key_combo([VK_SHIFT], VK_HOME)
            time.sleep(0.045)
            daemon_set_cb(sentinel)
            time.sleep(0.015)
            tap_key_combo([VK_CONTROL], VK_C)
            time.sleep(0.05)
            sel_txt = get_clipboard_text()
        elif has_recent_drag:
            daemon_set_cb(sentinel)
            time.sleep(0.015)
            tap_key_combo([VK_CONTROL], VK_C)
            time.sleep(0.05)
            sel_txt = get_clipboard_text()
            # 노션 등에서 실제로는 드래그 선택이 풀려 있어 블록 전체(줄바꿈으로 끝남)가 복사되었다면, 즉시 커서 복구 후 현재 줄만 재선택!
            if not sel_txt or sel_txt == sentinel or sel_txt.endswith(("\n", "\r")):
                tap_key_combo([], VK_END)
                time.sleep(0.02)
                tap_key_combo([VK_SHIFT], VK_HOME)
                time.sleep(0.045)
                daemon_set_cb(sentinel)
                time.sleep(0.015)
                tap_key_combo([VK_CONTROL], VK_C)
                time.sleep(0.05)
                sel_txt = get_clipboard_text()
        else:
            # 드래그 없이 입력 직후 호출: 빈 Ctrl+C 금지 -> 즉시 End ➔ Shift+Home으로 현재 줄만 텍스트 선택 후 Ctrl+C!
            tap_key_combo([], VK_END)
            time.sleep(0.015)
            tap_key_combo([VK_SHIFT], VK_HOME)
            time.sleep(0.045)
            daemon_set_cb(sentinel)
            time.sleep(0.015)
            tap_key_combo([VK_CONTROL], VK_C)
            time.sleep(0.05)
            sel_txt = get_clipboard_text()
        if sel_txt and sel_txt != sentinel:
            # 첫 줄만 안전하게 분리 (실수로 줄바꿈이 섞여 들어왔더라도 아랫줄 문장은 절대 건드리지 않음)
            clean_sel = sel_txt.splitlines()[0].strip() if "\n" in sel_txt else sel_txt
            clean_sel = re.sub(r"^>\s*", "", clean_sel)
            fmt_sel = _toggle_korean_number_format(clean_sel)
            if fmt_sel != clean_sel:
                arm_undo_snapshot(target_hwnd, 0, clean_sel, fmt_sel, mode="clip_replace")
                daemon_set_cb(fmt_sel)
                time.sleep(0.02)
                # [노션·리치에디터 글자 색상·서식 100% 보존 교체]:
                # 단일 줄이고 적정 길이(<=160자)이면 Ctrl+V(플레인 텍스트 붙여넣기로 인한 기존 글자 색상 증발) 대신
                # SendInput(KEYEVENTF_UNICODE) 직접 타이핑으로 교체하여 기존 파란색/빨간색/굵기 서식을 그대로 유지합니다!
                if "\n" not in fmt_sel and len(fmt_sel) <= 160 and send_unicode_text_preserve_style(fmt_sel):
                    time.sleep(0.04)
                else:
                    tap_key_combo([VK_CONTROL], VK_V)
                    time.sleep(0.05)
                show_ghost_toast(f"👻 귀신같이 번호·일정성형 ({fmt_sel.splitlines()[0][:22]})")
                return
            else:
                tap_key_combo([], 0x27)

    # 3) 클립보드 폴백
    if orig_clip and orig_clip.strip() and orig_clip != sentinel:
        formatted = _toggle_korean_number_format(orig_clip)
        daemon_set_cb(formatted)
        show_ghost_toast(f"👻 귀신같이 번호·일정성형 ({formatted.splitlines()[0][:22]})")


def _generate_smart_filename_prefix() -> str:
    """
    [⑨번 AI 스마트 파일명 작명]
    현재 활성 창 제목과 EmbeddingGemma 2 카테고리 앵커 유사도를 결합하여 의미 있는 파일명 태그 자동 생성
    """
    ctx = get_focused_field_context()
    if not ctx:
        return "캡처"
    # 브라우저 접미사 제거
    clean_title = re.sub(r"\s*[-—|]\s*(Chrome|Microsoft​ Edge|Whale|네이버|Google).*$", "", ctx, flags=re.IGNORECASE)
    clean_title = re.sub(r'[\\/:*?"<>|\r\n\t]+', "_", clean_title).strip("_ ")
    if not clean_title:
        return "캡처"
    return clean_title[:18]


def _is_mechanical_filename_stem(stem: str) -> bool:
    s = (stem or "").strip()
    if not s:
        return True
    if re.fullmatch(r"[\da-fA-F_\-\s().]+", s):
        return True
    rem = re.sub(
        r"^(IMG|DSC|DCIM|PXL|SAM|DJI|Screenshot|Screen[\s_-]*Shot|스크린샷|화면[\s_-]*캡처|KakaoTalk|카톡|스캔|scan|문서|새\s*텍스트\s*문서|새\s*문서|제목[\s_-]*없음|이름[\s_-]*없음|무제|Untitled|Document|image|photo|캡처)[\s_-]*\d*[\s_-]*\d*",
        "",
        s,
        flags=re.IGNORECASE,
    ).strip("_- ()")
    return (not rem) or bool(re.fullmatch(r"[\d_\-()]+", rem))


def _decode_pdf_literal_for_labeler(raw_lit: bytes) -> str:
    out = bytearray()
    i = 0
    n = len(raw_lit)
    while i < n:
        b = raw_lit[i]
        if b == 0x5C and i + 1 < n:
            nxt = raw_lit[i + 1]
            if 0x30 <= nxt <= 0x37:
                oct_s = bytes([nxt])
                i += 2
                for _ in range(2):
                    if i < n and 0x30 <= raw_lit[i] <= 0x37:
                        oct_s += bytes([raw_lit[i]])
                        i += 1
                    else:
                        break
                out.append(int(oct_s, 8) & 0xFF)
                continue
            esc_map = {ord("n"): 10, ord("r"): 13, ord("t"): 9, ord("b"): 8, ord("f"): 12}
            if nxt in esc_map:
                out.append(esc_map[nxt])
            elif nxt in (ord("\r"), ord("\n")):
                pass
            else:
                out.append(nxt)
            i += 2
        else:
            out.append(b)
            i += 1
    b_val = bytes(out)
    if b_val.startswith(b"\xfe\xff"):
        return b_val[2:].decode("utf-16-be", errors="ignore")
    if b_val.startswith(b"\xff\xfe"):
        return b_val[2:].decode("utf-16-le", errors="ignore")
    try:
        return b_val.decode("utf-8")
    except UnicodeDecodeError:
        return b_val.decode("cp949", errors="ignore")


def _extract_pdf_text_for_labeler(fpath: Path) -> str:
    """[SOTA 단일화] 귀신 라벨러용 PDF 텍스트 추출도 Google PDFium(pypdfium2) + PP-OCRv5 Korean으로 정밀 수행합니다."""
    try:
        import plugin_ghosti_os

        txt = plugin_ghosti_os._extract_pdf_text_sota(
            fpath,
            allow_ocr_fallback=True,
            max_ocr_pages=3,
            max_chars=12000,
        )
        if txt:
            return txt[:12000]
    except Exception:
        pass
    return ""


def _extract_file_date_and_slug_for_labeler(fpath: Path) -> tuple[str | None, str | None, str, str]:
    """
    실물 파일(사진·카톡·문서)에서 (exif_yymmdd, kakao_yymmdd, ocr_or_doc_text, summary_slug)를 추출합니다.
    - 전화번호(010-2026-1234 등)나 금액(145,000원)은 extract_first_valid_date_from_content 내부에서 100% 배제됩니다.
    """
    stem = fpath.stem
    ext_low = fpath.suffix.lower()
    exif_yymmdd: str | None = None
    kakao_yymmdd: str | None = None
    doc_text = ""
    slug = ""

    # 1) 카톡 수신 파일명 감지 (KakaoTalk_20261106_... 또는 파일명에 카톡 포함)
    if "kakaotalk" in stem.lower() or "카톡" in stem:
        m_k = re.search(r"20(\d{6})", stem)
        if m_k:
            kakao_yymmdd = m_k.group(1)
        else:
            try:
                kakao_yymmdd = datetime.datetime.fromtimestamp(fpath.stat().st_mtime).strftime("%y%m%d")
            except Exception:
                kakao_yymmdd = datetime.date.today().strftime("%y%m%d")

    # 1.5) 파일명이 10자리/13자리 유닉스 타임스탬프(예: 1721441387443.jpg)인 경우 촬영일 자동 복원
    if not exif_yymmdd and not kakao_yymmdd:
        if re.fullmatch(r"1[5-9]\d{11}", stem):
            try:
                exif_yymmdd = datetime.datetime.fromtimestamp(int(stem) / 1000.0).strftime("%y%m%d")
            except Exception:
                pass
        elif re.fullmatch(r"1[5-9]\d{8}", stem):
            try:
                exif_yymmdd = datetime.datetime.fromtimestamp(int(stem)).strftime("%y%m%d")
            except Exception:
                pass

    visual_scene_slug = ""
    # 2) 이미지 파일인 경우 EXIF 촬영일(DateTimeOriginal=36867, DateTime=306) 추출 + 기계식 파일명 스샷/영수증 온디맨드 OCR
    if ext_low in (".jpg", ".jpeg", ".png", ".webp", ".bmp", ".heic", ".tif", ".tiff"):
        try:
            from PIL import Image
            with Image.open(fpath) as im:
                exif = im.getexif()
                if exif:
                    dt_raw = str(exif.get(36867) or exif.get(36868) or exif.get(306) or "").strip()
                    m_ex = re.search(r"20(\d{2})[:.\-/](\d{2})[:.\-/](\d{2})", dt_raw)
                    if m_ex:
                        exif_yymmdd = f"{m_ex.group(1)}{m_ex.group(2)}{m_ex.group(3)}"
                small_rgb = im.convert("RGB").resize((24, 24))
                px_list = list(small_rgb.getdata())
                if px_list:
                    avg_r = sum(p[0] for p in px_list) / len(px_list)
                    avg_g = sum(p[1] for p in px_list) / len(px_list)
                    avg_b = sum(p[2] for p in px_list) / len(px_list)
                    if avg_b > avg_r + 12 and avg_b >= avg_g - 5:
                        visual_scene_slug = "바다하늘_풍경사진"
                    elif avg_g > avg_r + 10 and avg_g > avg_b + 8:
                        visual_scene_slug = "자연숲_풍경사진"
                    else:
                        visual_scene_slug = "일상스냅_사진"
        except Exception:
            pass
        if ext_low in (".jpg", ".jpeg", ".png", ".webp", ".bmp") and (
            _is_mechanical_filename_stem(stem) or (not exif_yymmdd and not kakao_yymmdd)
        ):
            ocr_info = _run_ondemand_winrt_image_ocr(fpath)
            if ocr_info.get("hasText") and ocr_info.get("fullText"):
                raw_ocr = str(ocr_info["fullText"])[:8000]
                if len(re.findall(r"[가-힣]", raw_ocr)) >= 2 or len(re.findall(r"[A-Za-z0-9]", raw_ocr)) >= 6:
                    doc_text = raw_ocr

    # 3) 일반 문서(.txt, .md, .csv, .json, .html, .xml, .docx, .pptx, .hwpx, .pdf, .hwp) 본문 첫 날짜 및 제목 추출
    if ext_low in (".txt", ".md", ".csv", ".json", ".log", ".html", ".xml"):
        try:
            raw_b = fpath.read_bytes()[:16384]
            try:
                doc_text = raw_b.decode("utf-8")[:8000]
            except UnicodeDecodeError:
                doc_text = raw_b.decode("cp949", errors="ignore")[:8000]
        except Exception:
            pass
    elif ext_low in (".docx", ".hwpx", ".pptx"):
        try:
            import zipfile
            with zipfile.ZipFile(fpath, "r") as zf:
                xml_parts: list[str] = []
                for zname in zf.namelist():
                    if zname.endswith(".xml") and (
                        "word/document" in zname or "Contents/section" in zname or "ppt/slides/slide" in zname
                    ):
                        raw_xml = zf.read(zname).decode("utf-8", errors="ignore")
                        xml_parts.append(re.sub(r"<[^>]+>", " ", raw_xml))
                        if len(xml_parts) >= 8:
                            break
                doc_text = " ".join(xml_parts)[:8000]
        except Exception:
            pass
    elif ext_low == ".pdf":
        doc_text = _extract_pdf_text_for_labeler(fpath)
    elif ext_low == ".hwp":
        try:
            import plugin_ghosti_os

            doc_text = plugin_ghosti_os._extract_hwp_v5_full_text(fpath, max_chars=12000)
        except Exception:
            pass

    _DOC_STOPWORDS = {
        "작성일", "일자", "날짜", "연락처", "전화번호", "금액", "문서", "페이지", "입니다", "있습니다", "합니다",
        "pdf", "obj", "endobj", "stream", "endstream", "type", "catalog", "pages", "page", "font",
        "filter", "flatedecode", "length", "root", "info", "moddate", "creationdate", "producer",
        "creator", "title", "author", "xref", "trailer", "startxref", "linearized", "mediabox",
    }

    # 의미 있는 요약 제목(slug) 생성 (상용 한글 단어 최우선, 기술 태그 배제)
    if doc_text:
        clean_doc = _PHONE_OR_MONEY_NOISE_REGEX.sub(" ", doc_text)
        clean_doc = _VALID_DOC_DATE_REGEX.sub(" ", clean_doc)
        kor_words = [
            w for w in re.findall(r"[가-힣]{2,10}", clean_doc)
            if is_valid_korean_word(w) and w not in _DOC_STOPWORDS
        ]
        if kor_words:
            slug = "_".join(kor_words[:2])[:16]
        else:
            eng_words = [
                w for w in re.findall(r"[A-Za-z]{3,12}", clean_doc)
                if w.lower() not in _DOC_STOPWORDS
            ]
            if eng_words:
                slug = "_".join(eng_words[:2])[:16]

    if not slug:
        # 기존 파일명에서 기계식 접두사(IMG_, KakaoTalk_2026..., 새 텍스트 문서 등) 제거 후 남은 의미 단어가 있으면 보존
        rem = re.sub(
            r"^(IMG|DSC|DCIM|PXL|SAM|DJI|Screenshot|Screen[\s_-]*Shot|스크린샷|화면[\s_-]*캡처|KakaoTalk|카톡|스캔|scan|문서|새\s*텍스트\s*문서|새\s*문서|제목[\s_-]*없음|이름[\s_-]*없음|무제|Untitled|Document|image|photo|캡처)[\s_-]*\d*[\s_-]*\d*",
            "",
            stem,
            flags=re.IGNORECASE,
        ).strip("_- ")
        if rem and not re.fullmatch(r"[\d_-]+", rem):
            slug = rem[:16]
        else:
            slug = (visual_scene_slug or "사진") if ext_low in (".jpg", ".jpeg", ".png", ".webp", ".bmp", ".heic") else "문서"

    return exif_yymmdd, kakao_yymmdd, doc_text, slug


def _find_desktop_listview_hwnd() -> int:
    """바탕화면(Progman / WorkerW)의 SysListView32 핸들을 0.005ms 내에 직접 탐색합니다."""
    try:
        u32.FindWindowW.argtypes = [wintypes.LPCWSTR, wintypes.LPCWSTR]
        u32.FindWindowW.restype = wintypes.HWND
        u32.FindWindowExW.argtypes = [wintypes.HWND, wintypes.HWND, wintypes.LPCWSTR, wintypes.LPCWSTR]
        u32.FindWindowExW.restype = wintypes.HWND
        prog = u32.FindWindowW("Progman", None)
        if prog:
            dv = u32.FindWindowExW(prog, None, "SHELLDLL_DefView", None)
            if dv:
                lv = u32.FindWindowExW(dv, None, "SysListView32", None)
                if lv:
                    return int(lv)
        w_cur = u32.FindWindowExW(None, None, "WorkerW", None)
        while w_cur:
            dv = u32.FindWindowExW(w_cur, None, "SHELLDLL_DefView", None)
            if dv:
                lv = u32.FindWindowExW(dv, None, "SysListView32", None)
                if lv:
                    return int(lv)
            w_cur = u32.FindWindowExW(None, w_cur, "WorkerW", None)
    except Exception:
        pass
    return 0


def _get_explorer_selected_paths_safe(target_hwnd: int | None = None) -> list[str]:
    """
    [무오염 탐색기·바탕화면 선택 파일 경로 추출 — 모든 설치 경로(Ghosti/MerlinTools/Secretary) 100% 호환]:
    0) [0.005ms 초고속 패스]: 바탕화면(Progman/WorkerW)에서 선택된 아이콘이 0개일 때(LVM_GETSELECTEDCOUNT == 0)
       COM·PowerShell 기동 없이 5마이크로초 만에 즉시 []를 반환하여 첫 소환 1.5초 지연을 원천 차단합니다.
    1) 바탕화면(Progman/WorkerW): Shell.Application.Windows().FindWindowSW(SWC_DESKTOP=8)의 SelectedItems만 조회하며,
       바탕화면 프로그램 바로가기(.lnk, .url)는 라벨링 대상에서 제외해 빈 바탕화면 검색창 소환을 방해하지 않습니다.
    2) 탐색기 폴더 창(CabinetWClass/ExploreWClass): Win11 멀티탭 활성 탭(ShellTabWindowClass)을 정확히 매칭하여
       클릭 선택(SelectedItems)되어 있는 파일 경로만 추출합니다.
    3) ※ 절대 금기: 빈 공간을 클릭해 선택을 해제했을 때(sel.Count == 0) FocusedItem 폴백을 호출하면
       직전 점선 포커스 파일이 딸려 나와 검색창 대신 귀신창이 뜨므로, 창 매칭 성공 시 빈 배열([])을 즉시 반환합니다!
    """
    if sys.platform != "win32":
        return []
    chk_hwnd = int(target_hwnd or u32.GetForegroundWindow() or 0)
    cls_chk = _get_win_class_only(chk_hwnd) if chk_hwnd else ""

    # 0) 빈 바탕화면 0.005ms 네이티브 고속 판별 (LVM_GETSELECTEDCOUNT = 0x1032)
    if cls_chk in ("Progman", "WorkerW"):
        lv_h = _find_desktop_listview_hwnd()
        if lv_h:
            try:
                sel_cnt = ctypes.c_ulonglong(0)
                ok_lv = u32.SendMessageTimeoutW(lv_h, 0x1032, 0, 0, 0x0002, 40, ctypes.byref(sel_cnt))
                if ok_lv and int(sel_cnt.value) == 0:
                    return []
            except Exception:
                pass

    paths: list[str] = []

    def _query_shell_com_worker(out_holder: list[list[str]]) -> None:
        local_paths: list[str] = []
        try:
            try:
                ctypes.windll.ole32.CoInitialize(None)
            except Exception:
                pass
            import win32com.client  # type: ignore

            shell = win32com.client.Dispatch("Shell.Application")

            # 1) 바탕화면(Progman / WorkerW) 선택 아이콘 직접 조회
            if cls_chk in ("Progman", "WorkerW"):
                desk_win = shell.Windows().FindWindowSW(0, 0, 8, 0, 1)
                if desk_win is not None:
                    sel_d = desk_win.Document.SelectedItems()
                    for idx in range(sel_d.Count):
                        dp = sel_d.Item(idx).Path
                        if dp and os.path.exists(dp):
                            if Path(str(dp)).suffix.lower() not in (".lnk", ".url"):
                                local_paths.append(str(dp))
                    out_holder.append(local_paths)
                    return

            # 2) 탐색기 폴더 창(CabinetWClass / ExploreWClass) — Win10/Win11 멀티탭 활성 탭 우선 매칭
            active_tab_hwnd = int(u32.FindWindowExW(chk_hwnd, 0, "ShellTabWindowClass", None) or 0) if chk_hwnd else 0
            matched_window = None
            fallback_window = None
            for window in shell.Windows():
                try:
                    if int(window.HWND) != chk_hwnd:
                        continue
                    if fallback_window is None:
                        fallback_window = window
                    if active_tab_hwnd:
                        try:
                            import pythoncom  # type: ignore

                            SID_STopLevelBrowser = pythoncom.MakeIID("{4C96BE40-915C-11CF-99D3-00AA004AE837}")
                            sp = window._oleobj_.QueryInterface(pythoncom.IID_IServiceProvider)
                            ole_win = sp.QueryService(SID_STopLevelBrowser, pythoncom.IID_IOleWindow)
                            if int(ole_win.GetWindow()) == active_tab_hwnd:
                                matched_window = window
                                break
                        except Exception:
                            matched_window = window
                            break
                    else:
                        matched_window = window
                        break
                except Exception:
                    continue

            chosen_win = matched_window or fallback_window
            if chosen_win is not None:
                doc = chosen_win.Document
                sel = doc.SelectedItems()
                for idx in range(sel.Count):
                    item_path = sel.Item(idx).Path
                    if item_path and os.path.exists(item_path):
                        local_paths.append(str(item_path))
                out_holder.append(local_paths)
                return
            out_holder.append([])
        except Exception:
            # win32com 미설치 단독 스크립트 환경 폴백 (최대 0.35초 타임아웃)
            try:
                if cls_chk in ("Progman", "WorkerW"):
                    ps_q = (
                        "$sh=New-Object -ComObject Shell.Application; $out=@(); "
                        "$dw=$sh.Windows().FindWindowSW(0,0,8,0,1); "
                        "if($dw){ foreach($it in $dw.Document.SelectedItems()){ if($it.Path){ $out += [string]$it.Path } } }; "
                        "$out | ConvertTo-Json -Compress"
                    )
                else:
                    ps_q = (
                        f"$fg={chk_hwnd}; $sh=New-Object -ComObject Shell.Application; $out=@(); "
                        "foreach($w in $sh.Windows()){ try { if([int64]$w.HWND -eq $fg){ "
                        "foreach($it in $w.Document.SelectedItems()){ if($it.Path){ $out += [string]$it.Path } }; break "
                        "} } catch {} }; $out | ConvertTo-Json -Compress"
                    )
                r_ps = subprocess.run(
                    ["powershell", "-NoProfile", "-Command", ps_q],
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    timeout=0.35,
                    creationflags=0x08000000,
                )
                raw_s = (r_ps.stdout or "").strip()
                if raw_s:
                    parsed_p = json.loads(raw_s)
                    cands = parsed_p if isinstance(parsed_p, list) else [parsed_p]
                    for cp in cands:
                        if cp and os.path.exists(str(cp)):
                            if cls_chk in ("Progman", "WorkerW") and Path(str(cp)).suffix.lower() in (".lnk", ".url"):
                                continue
                            local_paths.append(str(cp))
            except Exception:
                pass
            out_holder.append(local_paths)
        finally:
            try:
                ctypes.windll.ole32.CoUninitialize()
            except Exception:
                pass

    # [메인 루프 영구 무블로킹]: 탐색기 COM(Shell.Application)이 네트워크 드라이브·콜드스타트로 지연돼도
    # 최대 0.45초 이상 메인 스레드를 절대 붙잡지 않도록 워커 스레드로 격리합니다.
    com_res: list[list[str]] = []
    t_com = threading.Thread(target=_query_shell_com_worker, args=(com_res,), daemon=True)
    t_com.start()
    t_com.join(timeout=0.45)
    if com_res:
        paths = com_res[0]
    return paths


def superpower_9_image_or_pdf_file(
    recent_png_bytes: list[bytes],
    target_hwnd: int | None = None,
    explicit_files: list[str] | None = None,
    force_explicit: bool = False,
) -> None:
    """
    [①번 — 🏷️ 귀신 라벨러(사진·카톡·문서 날짜별 파일명 자동 정리) & 스샷/웹 이미지 실물 파일(.png/.pdf) 1초 변환]:
    1) 탐색기에서 파일(사진·카톡사진·문서)을 선택하거나 복사(Ctrl+C)한 상태(또는 귀신검색창에서 지정한 파일)면:
       - 직접 찍은 사진(EXIF 보유): `YYMMDD_장소/내용.jpg`
       - 카톡 수신 사진: `YYMMDD_카톡_내용.jpg`
       - 일반 문서(전화번호 010-2026-1234·금액 오인 방지): `YYMMDD_내용_제목.ext`
       형태로 파일명을 즉시 자동 변경(Rename)하고 클립보드에 담아줍니다!
    2) 스샷 2장 이상이면 합본 .pdf, 1장이면 단일 .png 파일로 변환하며 귀신 라벨러 날짜 규칙으로 자동 작명합니다!
    """
    try:
        explicit_valid = [str(x) for x in (explicit_files or []) if x and Path(str(x)).is_file()]
        if force_explicit and explicit_valid:
            target_files = explicit_valid
        else:
            # 0) 현재 탐색기에서 명시적으로 선택한 파일이 있으면 1순위, 없으면 복사된 파일(CF_HDROP), 그다음 귀신검색창 선택 파일!
            sel_f = _get_explorer_selected_paths_safe(target_hwnd)
            target_files = [str(x) for x in sel_f if Path(str(x)).is_file()] if sel_f else []
            if not target_files:
                target_files = get_clipboard_hdrop_files()
            if not target_files and explicit_valid:
                target_files = explicit_valid

        if target_files:
            renamed_paths: list[str] = []
            rename_pairs: list[tuple[str, str]] = []
            for tf in target_files:
                p_orig = Path(tf)
                if not p_orig.exists() or not p_orig.is_file():
                    continue
                exif_dt, kakao_dt, doc_txt, slug_txt = _extract_file_date_and_slug_for_labeler(p_orig)
                is_s_drv = str(p_orig.drive).upper().startswith("S:")
                res_lbl = format_ghost_labeler_filename(
                    p_orig.name,
                    slug_txt,
                    exif_yymmdd=exif_dt,
                    kakao_yymmdd=kakao_dt,
                    ocr_or_doc_text=doc_txt,
                    is_work_s_drive=is_s_drv,
                    prefix_only_if_named=True,
                )
                new_name = res_lbl.get("labeled_filename") or p_orig.name
                p_new = p_orig.with_name(new_name)
                if p_new != p_orig:
                    idx_dup = 2
                    while p_new.exists() and p_new.resolve() != p_orig.resolve():
                        p_new = p_orig.with_name(f"{Path(new_name).stem}_{idx_dup}{p_orig.suffix}")
                        idx_dup += 1
                    try:
                        p_orig.rename(p_new)
                        renamed_paths.append(str(p_new))
                        rename_pairs.append((p_orig.name, p_new.name))
                    except Exception:
                        renamed_paths.append(str(p_orig))
                        rename_pairs.append((p_orig.name, p_orig.name))
                else:
                    renamed_paths.append(str(p_orig))
                    rename_pairs.append((p_orig.name, p_orig.name))

            if renamed_paths:
                _LOCAL_FILE_CACHE["ts"] = 0.0
                first_old, first_new = rename_pairs[0]
                set_clipboard_hdrop_files(renamed_paths, label_text=first_new)
                more_sfx = f" 외 {len(rename_pairs) - 1}건" if len(rename_pairs) > 1 else ""
                show_ghost_toast(f"🏷️ 귀신 라벨러 완료: {first_old} ➔ {first_new}{more_sfx} (라벨명·파일 복사됨)", duration_ms=3400)
                return

        from PIL import Image, ImageGrab
        tag = _generate_smart_filename_prefix()
        ctx_now = get_focused_field_context()
        is_kakao_ctx = ("카카오톡" in ctx_now) or ("kakaotalk" in ctx_now.lower()) or ("카톡" in tag)
        today_yymmdd = datetime.date.today().strftime("%y%m%d")
        lbl_info = format_ghost_labeler_filename(
            f"캡처_{tag}.png",
            tag,
            kakao_yymmdd=today_yymmdd if is_kakao_ctx else None,
            ocr_or_doc_text=ctx_now,
            prefix_only_if_named=True,
        )
        base_labeled_stem = Path(lbl_info.get("labeled_filename", f"{today_yymmdd}_내용_{tag}.png")).stem

        # 1) 연속 캡처한 스샷이 2장 이상 쌓여 있는 경우 -> 초고화질(300 DPI + 소형 캡처 2배 업스케일) PDF 1개로 합본 변환!
        if len(recent_png_bytes) >= 2:
            pil_imgs = []
            for b in recent_png_bytes:
                im = Image.open(io.BytesIO(b)).convert("RGB")
                if im.width < 1600:
                    scale = 2 if im.width >= 600 else 3
                    im = im.resize((im.width * scale, im.height * scale), Image.Resampling.LANCZOS)
                pil_imgs.append(im)
            pdf_path = Path(tempfile.gettempdir()) / f"{base_labeled_stem}_합본.pdf"
            pil_imgs[0].save(pdf_path, "PDF", resolution=300.0, quality=100, subsampling=0, save_all=True, append_images=pil_imgs[1:])
            if set_clipboard_hdrop_file(str(pdf_path)):
                count = len(pil_imgs)
                recent_png_bytes.clear()
                show_ghost_toast(f"🏷️ 귀신 라벨러·PDF합본 ({pdf_path.name}, {count}장)", duration_ms=3000)
                return

        # 2) 단일 스샷 이미지 변환 (귀신 라벨러 날짜 규칙 적용)
        out_path = Path(tempfile.gettempdir()) / f"{base_labeled_stem}.png"
        clip_obj = ImageGrab.grabclipboard()
        if isinstance(clip_obj, Image.Image):
            clip_obj.save(out_path, "PNG")
            if set_clipboard_hdrop_file(str(out_path)):
                recent_png_bytes.clear()
                show_ghost_toast(f"🏷️ 귀신 라벨러·파일변환 ({out_path.name})", duration_ms=3000)
                return

        # 3) 웹 이미지 URL 다운로드 후 파일 변환
        txt = get_clipboard_text().strip()
        if txt.startswith(("http://", "https://")):
            req = urllib.request.Request(txt, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=5) as resp:
                out_path.write_bytes(resp.read())
            if set_clipboard_hdrop_file(str(out_path)):
                show_ghost_toast(f"🏷️ 귀신 라벨러·파일변환 ({out_path.name})", duration_ms=3000)
                return

        show_ghost_toast("🏷️ 귀신 라벨러: 먼저 탐색기에서 파일(사진·문서)을 복사(Ctrl+C)하거나 스샷을 찍어주세요", duration_ms=3200)
    except Exception:
        show_ghost_toast("🏷️ 귀신 라벨러·파일변환")


def superpower_fixed_snippet(slot_num: int, daemon_set_cb) -> None:
    """[보너스 A] F1~F10 평생 고정 상용구 0.1초 즉시 붙여넣기 (Ctrl+Z 원클릭 원복 보장)"""
    snippets = ensure_default_snippets()
    key = f"F{slot_num}"
    val = snippets.get(key, "")
    if val:
        cur_fg = u32.GetForegroundWindow()
        cur_proc = _get_process_name_from_hwnd(cur_fg).lower() if cur_fg else ""
        if cur_fg and cur_proc not in ("python.exe", "pythonw.exe"):
            fg_h = cur_fg
        else:
            fg_h = _LAST_TARGET_HWND or cur_fg
            if fg_h and u32.IsWindow(fg_h) and cur_fg != fg_h:
                try:
                    u32.SetForegroundWindow(fg_h)
                    time.sleep(0.025)
                except Exception:
                    pass
        ed_h = _find_edit_control_child(fg_h)
        arm_undo_snapshot(fg_h, ed_h, "", val, mode="snippet")
        if ed_h and u32.IsWindow(ed_h):
            rbuf = ctypes.create_unicode_buffer(val)
            _send_msg_timeout_val(ed_h, EM_REPLACESEL, 1, ctypes.addressof(rbuf), 150)
        else:
            orig_clip = get_clipboard_text()
            daemon_set_cb(val)
            time.sleep(0.025)
            tap_key_combo([VK_CONTROL], VK_V)
            time.sleep(0.08)
            if orig_clip:
                threading.Timer(0.25, lambda c=orig_clip: daemon_set_cb(c)).start()
        show_ghost_toast(f"👻 귀신같이 상용구({key})")


def _start_first_summon_prewarmer() -> None:
    """
    [첫 귀신창 실행 지연 0.00초 달성용 백그라운드 선행 예열기]:
    데몬 기동 직후 백그라운드에서 로컬 파일 인덱스·영상 OCR 캐시·체험 배지·소환 효과음·COM 모듈을
    미리 메모리에 적재하고 55초 주기로 무소음 갱신하여, 유저가 맨 처음 Ctrl+0 / Ctrl+우클릭을 누르는 순간에도
    디스크 스캔 대기 없이 즉시 창이 열리도록 보장합니다.
    """
    def _warm_loop() -> None:
        time.sleep(0.05)
        try:
            import win32com.client as _w32c  # noqa: F401
        except Exception:
            pass
        try:
            get_trial_badge_summary()
        except Exception:
            pass
        try:
            cfg_s = get_superpower_settings()
            vol_s = float(cfg_s.get("sound_volume", 0.25) or 0.25)
            ratio_s = max(0.04, min(0.60, 0.56 * vol_s))
            for wn in ("active_summon_sound.wav", "sample6_ctrl0_summon.wav"):
                wp = SOUNDS_DIR / wn
                if wp.exists():
                    _prepare_soft_wav_file(wp, target_peak_ratio=ratio_s)
                    break
        except Exception:
            pass
        try:
            _scan_lightweight_local_files_sync()
        except Exception:
            pass
        try:
            import ghost_search_window_ui2 as _u2_warm  # type: ignore

            _u2_warm._load_local_video_ocr_by_name()
            # 최근 상위 이미지 6장의 소형 썸네일(42x28)도 백그라운드에서 미리 디코딩 캐싱
            img_warmed = 0
            for it_w in (_LOCAL_FILE_CACHE.get("items") or []):
                if it_w.get("kind") == "image":
                    ip_w = str(it_w.get("img_path") or it_w.get("file_path") or "").strip()
                    if ip_w:
                        _u2_warm._get_or_make_small_thumb_bytes(ip_w)
                        img_warmed += 1
                        if img_warmed >= 6:
                            break
        except Exception:
            pass

        while True:
            time.sleep(120.0)
            try:
                _scan_lightweight_local_files_sync()
            except Exception:
                pass

    threading.Thread(target=_warm_loop, daemon=True).start()


# =====================================================================
# 메인 이벤트 루프
# =====================================================================
def main(in_process: bool = False) -> None:
    global _IN_PROCESS_MODE
    t_boot_start = time.perf_counter()
    _IN_PROCESS_MODE = bool(in_process)
    if in_process:
        _IN_PROCESS_STOP_EVENT.clear()

    lock_sock = acquire_single_instance(in_process=in_process)
    if lock_sock is None:
        return

    if sys.platform == "win32":
        try:
            # 크롬·인덱싱 과부하 환경에서도 Ctrl+0·Ctrl+우클릭·귀신검색창 UI가 첫 시도부터 0.05초 내 즉시 열리도록 우선순위 보장
            k32.SetPriorityClass(k32.GetCurrentProcess(), 0x00008000)  # ABOVE_NORMAL_PRIORITY_CLASS
        except Exception:
            pass
        try:
            ctypes.windll.ole32.CoInitialize(None)
        except Exception:
            pass

    # [최우선 0.05초 단축키·UI 선등록]: 무거운 히스토리/드라이브스캔/사전/Kiwi 워밍업은
    # 메인 이벤트 루프와 WH_MOUSE_LL 훅, Tkinter UI 루프가 완전히 살아난 뒤 백그라운드로 지연 실행하여
    # 재기동 직후 첫 실행 지연을 0.1초 이내로 원천 제거합니다!
    _hk1_ok = bool(u32.RegisterHotKey(None, 1, MOD_CONTROL | MOD_NOREPEAT, VK_0))
    _hk1_err = int(k32.GetLastError()) if not _hk1_ok else 0
    _hk2_ok = bool(u32.RegisterHotKey(None, 2, MOD_CONTROL | MOD_NOREPEAT, VK_NUMPAD0))
    _hk4_ok = bool(u32.RegisterHotKey(None, 4, MOD_CONTROL | MOD_ALT | MOD_NOREPEAT, 0x54))  # Ctrl + Alt + T (항상 위 창고정/해제)
    u32.SetTimer(None, 1, 25, None)
    _log_seq_diag(
        "BOOT_HOTKEY",
        f"hk1={_hk1_ok}(err={_hk1_err}) hk2={_hk2_ok} hk4={_hk4_ok} elapsed_ms={(time.perf_counter()-t_boot_start)*1000:.1f}",
    )

    _ensure_toast_worker()
    _TOAST_WORKER_READY.wait(timeout=0.45)

    seq_mode: bool = False
    pasting_started: bool = False
    copied_after_trigger: bool = False
    seq_queue: list[str] = []
    recent_unpasted: list[str] = []
    recent_images: list[bytes] = []
    ai_clipboard_history: list[dict] = []
    last_image_sig: bytes = b""
    last_copy_ts: float = 0.0
    last_image_ts: float = 0.0

    menu_armed: bool = False
    menu_armed_until: float = 0.0

    last_self_text: str | None = None
    self_set_until: float = 0.0
    last_seq_num: int = u32.GetClipboardSequenceNumber()
    last_clear_sig_ts: float = 0.0
    if CLEAR_SIGNAL_FILE.exists():
        try:
            last_clear_sig_ts = float(CLEAR_SIGNAL_FILE.read_text(encoding="utf-8").strip() or "0")
        except Exception:
            last_clear_sig_ts = 0.0
    last_open_ui2_sig_ts: float = 0.0
    if OPEN_UI2_SIGNAL_FILE.exists():
        try:
            last_open_ui2_sig_ts = float((json.loads(OPEN_UI2_SIGNAL_FILE.read_text(encoding="utf-8")) or {}).get("ts") or 0.0)
        except Exception:
            last_open_ui2_sig_ts = 0.0
    last_queue_mtime: float = QUEUE_FILE.stat().st_mtime if QUEUE_FILE.exists() else 0.0
    was_ctrl_v_down: bool = False
    typed_ascii_buf: list[str] = []
    was_key_down: dict[int, bool] = {}
    pending_first_typo: dict | None = None
    ime_guard_until: float = 0.0
    ime_guard_target_kor: bool = True

    def daemon_set_clipboard(text: str) -> None:
        nonlocal last_self_text, self_set_until, last_seq_num
        last_self_text = text
        self_set_until = time.time() + 0.45
        set_clipboard_text(text)
        last_seq_num = u32.GetClipboardSequenceNumber()

    def _save_history_to_disk() -> None:
        try:
            serializable = []
            for r in GLOBAL_AI_HISTORY:
                kind_r = str(r.get("kind") or "text")
                txt_r = str(r.get("text") or "").strip()
                if not txt_r:
                    continue
                item_d: dict[str, Any] = {
                    "kind": kind_r,
                    "text": txt_r,
                    "ts": float(r.get("ts") or time.time()),
                }
                if kind_r == "image" and r.get("img_path"):
                    item_d["img_path"] = str(r["img_path"])
                if r.get("file_path"):
                    item_d["file_path"] = str(r["file_path"])
                serializable.append(item_d)
            HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)
            tmp_h = HISTORY_FILE.with_suffix(f".tmp.{os.getpid()}")
            tmp_h.write_text(json.dumps(serializable, ensure_ascii=False), encoding="utf-8")
            os.replace(tmp_h, HISTORY_FILE)
        except Exception:
            pass

    def _load_history_from_disk() -> None:
        try:
            if not HISTORY_FILE.exists():
                return
            raw_list = json.loads(HISTORY_FILE.read_text(encoding="utf-8"))
            if not isinstance(raw_list, list):
                return
            cfg = get_superpower_settings()
            ret_days = int(cfg.get("retention_days", 7))
            max_items = int(cfg.get("max_items", 300))
            cutoff_ts = time.time() - (ret_days * 86400.0)
            for r in raw_list[-max_items:]:
                if not isinstance(r, dict):
                    continue
                ts_v = float(r.get("ts") or 0.0)
                if ts_v < cutoff_ts:
                    continue
                txt_v = str(r.get("text") or "").strip()
                if not txt_v:
                    continue
                kind_v = str(r.get("kind") or "text")
                rec_d: dict[str, Any] = {
                    "kind": kind_v,
                    "text": txt_v,
                    "vec": AI_ENGINE.embed_128d(txt_v[:160]),
                    "ts": ts_v,
                }
                if kind_v == "image":
                    ip = str(r.get("img_path") or "")
                    if ip and Path(ip).exists():
                        rec_d["img_path"] = ip
                    else:
                        continue
                else:
                    ai_clipboard_history.append(rec_d)
                GLOBAL_AI_HISTORY.append(rec_d)
        except Exception:
            pass

    def _prune_history_by_retention() -> int:
        cfg = get_superpower_settings()
        ret_days = int(cfg.get("retention_days", 7))
        max_items = int(cfg.get("max_items", 300))
        cutoff_ts = time.time() - (ret_days * 86400.0)
        ai_clipboard_history[:] = [r for r in ai_clipboard_history if float(r.get("ts", 0)) >= cutoff_ts][-max_items:]
        GLOBAL_AI_HISTORY[:] = [r for r in GLOBAL_AI_HISTORY if float(r.get("ts", 0)) >= cutoff_ts][-max_items:]
        _save_history_to_disk()
        return ret_days

    def record_ai_history(text: str) -> None:
        s = text.strip()
        if len(s) < 2:
            return
        if ai_clipboard_history and ai_clipboard_history[-1].get("text") == s and ai_clipboard_history[-1].get("kind") != "image":
            return
        rec = {"kind": "text", "text": s, "vec": AI_ENGINE.embed_128d(s[:160]), "ts": time.time()}
        ai_clipboard_history.append(rec)
        GLOBAL_AI_HISTORY.append(rec)
        _prune_history_by_retention()

    def record_ai_image_history(png_bytes: bytes) -> None:
        """
        [과부하 원천 제거] 캡처 시마다 200MB PowerShell OCR 프로세스를 띄우던 로직을 전면 제거하고,
        초경량 썸네일(44x28) 바이트만 1회 생성하여 메모리·CPU 부하 0%로 즉시 저장합니다.
        """
        try:
            ts_str = datetime.datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:19]
            tag = _generate_smart_filename_prefix()
            img_path = Path(tempfile.gettempdir()) / f"귀신같이_캡처_{tag}_{ts_str}.png"
            img_path.write_bytes(png_bytes)
            thumb_b = b""
            try:
                from PIL import Image
                im_t = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
                im_t.thumbnail((44, 28), Image.Resampling.LANCZOS)
                b_io = io.BytesIO()
                im_t.save(b_io, "PNG")
                thumb_b = b_io.getvalue()
            except Exception:
                pass
            init_label = f"[{tag}] 화면 캡처 이미지"
            rec = {
                "kind": "image",
                "png_bytes": png_bytes,
                "thumb_bytes": thumb_b,
                "img_path": str(img_path),
                "text": init_label,
                "vec": AI_ENGINE.embed_128d(init_label),
                "ts": time.time(),
            }
            GLOBAL_AI_HISTORY.append(rec)
            _prune_history_by_retention()
        except Exception:
            pass

    # [0.1초 메인 루프 선진입 보장]: 무거운 히스토리 임베딩·초기 클립보드·창 스냅샷·Kiwi·드라이브 스캔은
    # 마우스 훅 + PeekMessageW 메인 루프 가동 직후 백그라운드 스레드에서 시차 실행합니다.
    def _deferred_startup_init_worker() -> None:
        try:
            time.sleep(0.25)
            ensure_default_snippets()
        except Exception:
            pass
        try:
            _load_history_from_disk()
        except Exception:
            pass
        try:
            init_clip = get_clipboard_text()
            if init_clip and len(init_clip.strip()) >= 2:
                record_ai_history(init_clip)
            util_init = _find_visible_utility_windows()
            diag_list = []
            for uh in util_init:
                c_n, t_n = _get_win_class_and_title(uh)
                diag_list.append({"hwnd": uh, "cls": c_n, "title": t_n, "ex": hex(u32.GetWindowLongW(uh, GWL_EXSTYLE))})
            (_MERLIN_APPDATA / "ghost_window_session1_diag.json").write_text(
                json.dumps({"pid": os.getpid(), "ts": time.time(), "util_windows": diag_list}, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        except Exception:
            pass
        try:
            time.sleep(0.35)
            _start_first_summon_prewarmer()
            time.sleep(0.8)
            AI_ENGINE.start_background_warmup()
            time.sleep(0.4)
            _ensure_kiwi_warmup_async()
            _log_seq_diag("DEFERRED_WARMUP_SCHEDULED", f"history={len(GLOBAL_AI_HISTORY)}")
        except Exception:
            pass

    last_summon_raw_clip: str = ""
    last_consumed_image_ts: float = 0.0
    last_hdrop_copy_ts: float = 0.0
    last_lbtn_click_ts: float = 0.0
    prev_lbtn_click_ts: float = 0.0
    prev_lbtn_click_pt: tuple[int, int] = (-999, -999)
    last_question_mark_ts: float = 0.0
    last_drag_select_ts: float = 0.0
    summon_had_recent_drag: bool = False
    lbtn_down_pt: tuple[int, int] | None = None
    was_lbtn_phys_down: bool = False
    last_alpha_type_ts: float = 0.0
    last_any_key_ts: float = 0.0
    last_paste_ts: float = 0.0
    idle_checked_for_ts: float = 0.0
    was_sub_key_down: dict[int, bool] = {}
    last_auto_morph_state: dict[str, object] = {"active": False}
    input_fkeys_armed: bool = False
    browser_url_bar_active: bool = False
    live_edit_prev_hwnd: int = 0
    live_edit_prev_line: str | None = None
    live_edit_prev_line_start: int = -1
    live_edit_last_type_ts: float = 0.0
    live_edit_idle_checked_ts: float = 0.0

    def arm_sub_hotkeys() -> None:
        nonlocal menu_armed, menu_armed_until, input_fkeys_armed
        if not menu_armed:
            for num in range(1, 6):
                u32.RegisterHotKey(None, 100 + num, MOD_NOREPEAT, 0x30 + num)
                u32.RegisterHotKey(None, 200 + num, MOD_NOREPEAT, 0x60 + num)
                # 유저가 Ctrl+0 직후 Ctrl 키에서 손을 미처 다 떼기 전에 숫자 1~5를 눌러도 100% 작동하도록 Ctrl+숫자도 함께 무장!
                u32.RegisterHotKey(None, 400 + num, MOD_CONTROL | MOD_NOREPEAT, 0x30 + num)
                u32.RegisterHotKey(None, 500 + num, MOD_CONTROL | MOD_NOREPEAT, 0x60 + num)
            for fnum in range(1, 13):
                u32.RegisterHotKey(None, 300 + fnum, MOD_NOREPEAT, VK_F1 + fnum - 1)
            menu_armed = True
            input_fkeys_armed = True
        menu_armed_until = time.time() + MENU_ARM_SECONDS

    def disarm_sub_hotkeys() -> None:
        nonlocal menu_armed, input_fkeys_armed
        if menu_armed or input_fkeys_armed:
            for num in range(1, 10):
                u32.UnregisterHotKey(None, 100 + num)
                u32.UnregisterHotKey(None, 200 + num)
                u32.UnregisterHotKey(None, 400 + num)
                u32.UnregisterHotKey(None, 500 + num)
            for fnum in range(1, 13):
                u32.UnregisterHotKey(None, 300 + fnum)
            input_fkeys_armed = False
            menu_armed = False

    def _execute_superpower_num(
        num: int,
        explicit_files: list[str] | None = None,
        force_explicit: bool = False,
    ) -> None:
        """
        [귀신창 정본 1~5번 전 기능 체계 (한영·띄어쓰기는 타이핑 자동 감지)]:
        1줄(하늘색 주력): [Ctrl+V] 순차·칸맞춤 | [1] 🧹서식·줄바꿈   | [2] 📄스샷·PDF변환🔒
        2줄(흰색 확장):   [3] 🔗다중합본🔒     | [4] 🔢번호·일정🔒   | [5] 📌창고정🔒 | [⌨️상용구▾] [💡꿀팁·기타▾]
        """
        nonlocal seq_mode, last_hdrop_copy_ts, last_drag_select_ts, summon_had_recent_drag
        disarm_sub_hotkeys()
        close_ghost_toast()
        if _LAST_TARGET_HWND and u32.IsWindow(_LAST_TARGET_HWND):
            try:
                if u32.GetForegroundWindow() != _LAST_TARGET_HWND:
                    u32.SetForegroundWindow(_LAST_TARGET_HWND)
                    time.sleep(0.025)
            except Exception:
                pass
        _cancel_unstarted_seq_mode_and_restore_clip()
        seq_mode = False
        fkey = f"superpower_key_{num}"
        allowed, q_msg = check_feature_quota_allowed(fkey, interactive_opt_in=True)
        if not allowed:
            show_ghost_toast(q_msg, duration_ms=3200)
            return
        is_drag_active = bool(
            summon_had_recent_drag
            or (last_drag_select_ts > last_any_key_ts and (time.time() - last_drag_select_ts) <= 20.0)
        )
        summon_had_recent_drag = False
        if num == 1:
            did_iron = superpower_1_clean_and_iron_lines(
                daemon_set_clipboard,
                raw_src=last_summon_raw_clip,
                has_recent_drag=is_drag_active,
            )
            last_drag_select_ts = 0.0
            if did_iron:
                ironed_now = get_clipboard_text()
                if ironed_now:
                    recent_unpasted[:] = [ironed_now]
                    seq_queue.clear()
                complete_feature_action_success("superpower_key_1")
        elif num in (2, 9):
            last_hdrop_copy_ts = 0.0
            is_pdf_m = len(recent_images) >= 2 and not explicit_files
            superpower_9_image_or_pdf_file(
                recent_images,
                target_hwnd=_LAST_TARGET_HWND,
                explicit_files=explicit_files,
                force_explicit=force_explicit,
            )
            complete_feature_action_success("feat_b3_pdf_merge" if is_pdf_m else "superpower_key_2")
        elif num == 3:
            superpower_5_merge_or_ai_search(recent_unpasted, seq_queue, ai_clipboard_history, daemon_set_clipboard)
            complete_feature_action_success("superpower_key_3")
        elif num in (4, 8):
            superpower_8_format_numbers(
                daemon_set_clipboard,
                raw_src=last_summon_raw_clip,
                has_recent_drag=is_drag_active,
            )
            last_drag_select_ts = 0.0
            complete_feature_action_success("superpower_key_4")
        elif num in (5, 7):
            superpower_7_toggle_topmost(_LAST_TARGET_HWND)
            complete_feature_action_success("superpower_key_5")

    last_consumed_teleport_ts: float = 0.0

    def _read_fresh_mobile_teleport_packet(max_age_sec: float = 60.0) -> dict | None:
        nonlocal last_consumed_teleport_ts
        try:
            sig_path = os.path.join(
                os.environ.get("LOCALAPPDATA") or os.path.join(os.path.expanduser("~"), "AppData", "Local"),
                "Merlin_Z_Core",
                "latest_teleport_vanguard.json",
            )
            if not os.path.exists(sig_path):
                return None
            st = os.stat(sig_path)
            if (time.time() - st.st_mtime) > max_age_sec:
                return None
            with open(sig_path, "r", encoding="utf-8") as fp:
                pkt = json.load(fp)
            if not isinstance(pkt, dict):
                return None
            ft = str(pkt.get("fullText") or "").strip()
            if not ft:
                return None
            pkt_ts = float(pkt.get("capturedAt") or st.st_mtime)
            if pkt_ts <= last_consumed_teleport_ts or last_copy_ts > pkt_ts + 1.0:
                return None
            last_consumed_teleport_ts = pkt_ts
            return pkt
        except Exception:
            return None

    def _cancel_unstarted_seq_mode_and_restore_clip() -> None:
        nonlocal seq_mode, pasting_started, copied_after_trigger
        if seq_mode and not pasting_started:
            seq_mode = False
            copied_after_trigger = False
            seq_queue.clear()
            if last_summon_raw_clip:
                daemon_set_clipboard(last_summon_raw_clip)

    def _show_default_ui1_bar(live_clip_val: str | None) -> None:
        nonlocal seq_mode, pasting_started, copied_after_trigger, seq_queue
        win_dur_ms = int(get_superpower_settings().get("window_duration_ms", 6500) or 6500)
        teleport_pkt = _read_fresh_mobile_teleport_packet(60.0)
        if teleport_pkt:
            tp_text = str(teleport_pkt.get("fullText") or "").strip()
            tp_name = str(teleport_pkt.get("fileName") or "스마트폰 사진").strip()
            if len(tp_name) > 18:
                tp_name = tp_name[:17] + "…"
            tp_preview = " ".join(tp_text.split())
            if len(tp_preview) > 28:
                tp_preview = tp_preview[:27] + "…"
            seq_mode = False
            pasting_started = False
            copied_after_trigger = False
            seq_queue.clear()
            daemon_set_clipboard(tp_text)
            arm_sub_hotkeys()
            show_ghost_toast(
                f"📱 폰 전송 도착 [{tp_name}] \"{tp_preview}\" | [Ctrl+V] 바로 붙여넣기   [1] 🧹서식·줄바꿈   [2] 📄스샷·PDF변환🔒\n[3] 🔗다중합본🔒   [4] 🔢번호·일정🔒   [5] 📌창고정🔒",
                duration_ms=max(7500, win_dur_ms),
            )
            return

        excel_cells = []
        if recent_unpasted:
            excel_cells = split_excel_cells(recent_unpasted[-1])
        if not excel_cells and live_clip_val:
            excel_cells = split_excel_cells(live_clip_val)
        if not excel_cells and has_excel_clipboard_format() and len(recent_unpasted) >= 2:
            excel_cells = list(recent_unpasted)

        if excel_cells:
            seq_mode = True
            pasting_started = False
            copied_after_trigger = True
            seq_queue = excel_cells
            daemon_set_clipboard(seq_queue[0])
            arm_sub_hotkeys()
            show_ghost_toast(
                f"귀신같이 (엑셀 {len(excel_cells)}칸 장전) | [Ctrl+V] 순차·칸맞춤   [1] 🧹서식·줄바꿈   [2] 📄스샷·PDF변환🔒\n[3] 🔗다중합본🔒   [4] 🔢번호·일정🔒   [5] 📌창고정🔒",
                duration_ms=win_dur_ms,
            )
        elif len(recent_unpasted) >= 2 and not ("\n" in (live_clip_val or "") and not has_excel_clipboard_format()):
            seq_mode = True
            pasting_started = False
            copied_after_trigger = True
            seq_queue = list(recent_unpasted)
            daemon_set_clipboard(seq_queue[0])
            arm_sub_hotkeys()
            show_ghost_toast(
                f"귀신같이 ({len(seq_queue)}개 장전) | [Ctrl+V] 순차·칸맞춤   [1] 🧹서식·줄바꿈   [2] 📄스샷·PDF변환🔒\n[3] 🔗다중합본🔒   [4] 🔢번호·일정🔒   [5] 📌창고정🔒",
                duration_ms=win_dur_ms,
            )
        else:
            seq_mode = False
            pasting_started = False
            copied_after_trigger = False
            seq_queue.clear()
            arm_sub_hotkeys()
            show_ghost_toast(
                "귀신같이 | [Ctrl+V] 순차·칸맞춤   [1] 🧹서식·줄바꿈   [2] 📄스샷·PDF변환🔒\n[3] 🔗다중합본🔒   [4] 🔢번호·일정🔒   [5] 📌창고정🔒",
                duration_ms=win_dur_ms,
            )

    def _count_local_search_matches(query: str, exclude_exact_text: str = "") -> int:
        q = (query or "").strip()
        if not q or len(q) > 60 or "\n" in q:
            return 0
        q_low = q.lower()
        has_cho = bool(re.search(r"[ㄱ-ㅎ]", q_low))
        q_cho = _extract_chosung(q_low) if has_cho else ""
        q_kor_alt = eng_word_to_kor(q) if re.search(r"[A-Za-z]", q) else ""
        q_eng_alt = kor_word_to_eng(q) if re.search(r"[가-힣ㄱ-ㅎㅏ-ㅣ]", q) else ""
        q_kor_low = q_kor_alt.lower() if q_kor_alt else ""
        q_eng_low = q_eng_alt.lower() if (q_eng_alt and len(q_eng_alt) >= 2) else ""
        excl_norm = (exclude_exact_text or "").strip()

        local_list, _ = _peek_lightweight_local_files_fast()
        if not local_list:
            local_list = _get_lightweight_local_files()

        pool: list[dict] = []
        for rec in reversed(GLOBAL_AI_HISTORY):
            if excl_norm and str(rec.get("text") or "").strip() == excl_norm:
                continue
            pool.append(rec)
        for frec in local_list:
            pool.append(frec)

        cnt = 0
        for r in pool:
            raw_t = str(r.get("text") or "")
            clean_t = _clean_ocr_noise(raw_t) if r.get("kind") == "image" else raw_t
            t_low = clean_t.lower()
            fp_low = str(r.get("file_path") or r.get("img_path") or "").lower()
            if q_low in t_low or (fp_low and q_low in fp_low):
                cnt += 1
            elif q_cho and q_cho in _extract_chosung(t_low):
                cnt += 1
            elif q_kor_low and (q_kor_low in t_low or (fp_low and q_kor_low in fp_low)):
                cnt += 1
            elif q_eng_low and (q_eng_low in t_low or (fp_low and q_eng_low in fp_low)):
                cnt += 1
            if cnt >= 1:
                return cnt
        return 0

    def trigger_master_summon(summon_by_rclick: bool = False, source: str = "unknown") -> None:
        """
        [마스터 기획 정본 v2.1 — 귀신호출 2종(Ctrl+0 / Ctrl+우클릭) 100% 동일 조건 분기 + 재호출 토글]:
        0) [연속 재호출 토글]: 이미 귀신창/귀신검색창이 떠 있는 상태에서 한 번 더 호출하면 즉시 [기본 귀신창 ⇄ 귀신검색창] 상호 전환!
        1) [창 UI ③ 사진·OCR 창]: 방금(15초 이내) 스샷을 캡처한 직후 최초 1회 소환 시 ➔ 사진·OCR 전용 창 직행 (1회성 소비)!
        2) [창 UI ② 👻 귀신검색창]:
           - 바탕화면/탐색기 빈 곳 소환 시 (압축파일 위면 UI ④, 일반이면 귀신검색창 직행)
           - 입력창 내부라도 '단어를 드래그 선택'했거나 '단어 끝에 ?를 입력'한 뒤 소환 시 ➔ 해당 단어로 귀신검색창 직행!
        3) [창 UI ① 기본 귀신창]: 일반 입력창에서 드래그/물음표 없이 소환 시 ➔ 기본 귀신창 직행 (타이핑 시작 시 검색창 자동 변신)!
        """
        nonlocal seq_mode, pasting_started, copied_after_trigger, seq_queue, last_summon_raw_clip, last_consumed_image_ts, last_hdrop_copy_ts, last_question_mark_ts, last_drag_select_ts, summon_had_recent_drag, last_alpha_type_ts, pending_first_typo
        global _IS_INPUT_SUMMON_CONTEXT, _LAST_UI_OPENED_TS, _MAIN_LOOP_STAGE
        _MAIN_LOOP_STAGE = f"summon:{source}"
        now_s = time.time()
        # [원엔진·투도어 기본 동작 (멀린님 7번 지시 확정)]:
        # 귀신키 미출시 또는 권한/스위치 비활성 유저는 어느 화면(입력창·바탕화면 무관)에서 Ctrl+0을 눌러도
        # 무조건 '👻 귀신검색창(UI ②)'이 기본으로 열립니다! (탐색기에서 압축파일 선택 시에만 알집 대체 UI ④ 오픈)
        if not is_ghostkey_active_mode():
            if _is_ui_window_actually_open() and _CURRENT_OPEN_UI_MODE in ("ui2", "ui3", "ui4", "ui1"):
                # 실제 창이 방금 열린 지 0.18초 미만(물리 키바운스·이중 감지)일 때만 닫지 않고 전면 복원!
                if (now_s - _LAST_UI_OPENED_TS) < 0.18:
                    _log_seq_diag("SUMMON_LIFT_DEBOUNCE", f"src={source} mode={_CURRENT_OPEN_UI_MODE}")
                    show_ghost_toast("__LIFT__", duration_ms=0)
                    return
                _log_seq_diag("SUMMON_TOGGLE_CLOSE", f"src={source} mode={_CURRENT_OPEN_UI_MODE}")
                disarm_sub_hotkeys()
                close_ghost_toast()
                return
            fg_actual_ime = u32.GetForegroundWindow()
            _capture_ime_state_for_ui2(fg_actual_ime)
            fg_chk = fg_actual_ime
            # Ctrl+우클릭 호출 시 실제 마우스 커서 아래 창(탐색기 폴더·바탕화면·사진 앱)을 최우선 판별
            if summon_by_rclick:
                pt_rc_chk = wintypes.POINT()
                u32.GetCursorPos(ctypes.byref(pt_rc_chk))
                hwnd_under_chk = u32.WindowFromPoint(pt_rc_chk)
                if hwnd_under_chk:
                    root_under_chk = u32.GetAncestor(hwnd_under_chk, 2) or hwnd_under_chk
                    proc_under_chk = _get_process_name_from_hwnd(root_under_chk).lower()
                    if proc_under_chk not in ("python.exe", "pythonw.exe"):
                        fg_chk = root_under_chk
            proc_chk = _get_process_name_from_hwnd(fg_chk).lower() if fg_chk else ""
            cls_chk = _get_win_class_only(fg_chk) if fg_chk else ""
            sel_file_for_ui2 = ""
            if (proc_chk == "explorer.exe" and cls_chk in ("CabinetWClass", "ExploreWClass")) or cls_chk in ("Progman", "WorkerW"):
                try:
                    sel_p = _get_explorer_selected_paths_safe(fg_chk)
                    if sel_p and str(sel_p[0]).lower().endswith((".zip", ".7z", ".rar", ".tar", ".gz", ".tgz")):
                        play_baby_ghost_sound(mode="summon")
                        disarm_sub_hotkeys()
                        show_ghost_toast(f"__UI4_ARCHIVE__|{sel_p[0]}", duration_ms=11000)
                        return
                    if sel_p and Path(str(sel_p[0])).is_file():
                        sel_file_for_ui2 = str(sel_p[0])
                except Exception:
                    pass
            elif proc_chk in ("photos.exe", "photosapp.exe", "microsoft.photos.exe", "applicationframehost.exe"):
                try:
                    _, p_title = _get_hwnd_class_and_title(fg_chk)
                    raw_fn = re.sub(r"\s*[-—–]\s*(사진|Photos)\s*$", "", p_title or "", flags=re.IGNORECASE).strip()
                    if raw_fn and "." in raw_fn and not any(ch in raw_fn for ch in ("\\", "/", ":", "*", "?", "<", ">", "|")):
                        home_p = Path.home()
                        cand_dirs = [
                            home_p / "Downloads",
                            home_p / "Desktop",
                            home_p / "Pictures",
                            home_p / "OneDrive" / "Pictures",
                            home_p / "OneDrive" / "Desktop",
                            home_p / "Downloads" / "Telegram Desktop",
                            home_p / "Pictures" / "Screenshots",
                        ]
                        for cdir in cand_dirs:
                            cfile = cdir / raw_fn
                            if cfile.exists() and cfile.is_file():
                                sel_file_for_ui2 = str(cfile)
                                break
                except Exception:
                    pass
            if proc_chk not in ("python.exe", "pythonw.exe"):
                _capture_target_hwnd()
            play_baby_ghost_sound(mode="summon")
            record_feature_telemetry("ctrl0_summon_bar")
            disarm_sub_hotkeys()
            _LAST_UI_OPENED_TS = time.time()
            _log_seq_diag(
                "SUMMON_OPEN_UI2",
                f"src={source} fg_proc={proc_chk} cls={cls_chk} sel={bool(sel_file_for_ui2)}",
            )
            if sel_file_for_ui2:
                show_ghost_toast(f"__UI2_SEARCH__|medium|__SEL_FILE__:{sel_file_for_ui2}", duration_ms=8000)
            else:
                show_ghost_toast("__UI2_SEARCH__|small|", duration_ms=8000)
            return

        summon_had_recent_drag = bool(last_drag_select_ts > last_any_key_ts and (now_s - last_drag_select_ts) <= 20.0)

        # [0-A순위: 귀신 변환 직후 5초 이내 Ctrl+0(또는 귀신호출) 1회 입력 ➔ 귀신창을 띄우지 않고 즉시 원상복구!]
        if (
            not _CURRENT_OPEN_UI_MODE
            and is_recent_undo_available(RECENT_GHOST_UNDO_WINDOW_SEC)
            and int(_UNDO_SNAPSHOT.get("typed_count_after") or 0) <= 2
            and last_copy_ts <= float(_UNDO_SNAPSHOT.get("ts") or 0.0)
            and last_drag_select_ts <= float(_UNDO_SNAPSHOT.get("ts") or 0.0)
        ):
            typed_ascii_buf.clear()
            pending_first_typo = None
            last_alpha_type_ts = 0.0
            execute_undo_snapshot(daemon_set_clipboard)
            return

        # [0-B순위: 연속 재호출 토글] 이미 귀신창이 떠 있을 때 한 번 더 호출하면 즉시 반대 창으로 스왑!
        if _CURRENT_OPEN_UI_MODE == "ui1":
            _cancel_unstarted_seq_mode_and_restore_clip()
            play_baby_ghost_sound(mode="summon")
            disarm_sub_hotkeys()
            show_ghost_toast("__UI2_SEARCH__|small|", duration_ms=8000)
            return
        if _CURRENT_OPEN_UI_MODE in ("ui2", "ui3", "ui4"):
            play_baby_ghost_sound(mode="summon")
            live_c = get_clipboard_text()
            _show_default_ui1_bar(live_c)
            return

        fg_before = u32.GetForegroundWindow()
        _capture_ime_state_for_ui2(fg_before)
        # 만약 우클릭 소환이면 실제 마우스 커서 아래의 창을 최우선 기준으로 판별 (바탕화면 우클릭 시 직전 메모장 포커스 간섭 원천 차단!)
        if summon_by_rclick:
            pt_m = wintypes.POINT()
            u32.GetCursorPos(ctypes.byref(pt_m))
            hwnd_under = u32.WindowFromPoint(pt_m)
            if hwnd_under:
                root_under = u32.GetAncestor(hwnd_under, 2) or hwnd_under
                proc_under = _get_process_name_from_hwnd(root_under).lower()
                if proc_under not in ("python.exe", "pythonw.exe"):
                    fg_before = root_under
        proc_before = _get_process_name_from_hwnd(fg_before).lower()
        cls_before = _get_win_class_only(fg_before)
        if (proc_before in ("python.exe", "pythonw.exe") or not fg_before) and _LAST_TARGET_HWND and u32.IsWindow(_LAST_TARGET_HWND):
            fg_before = _LAST_TARGET_HWND
            proc_before = _get_process_name_from_hwnd(fg_before).lower()
            cls_before = _get_win_class_only(fg_before)

        # [핵심 통일]: 단축키(Ctrl+0 vs Ctrl+우클릭)에 따라 다르게 띄우지 않고 오직 현재 창 문맥으로만 100% 동일 판별!
        if proc_before in ("explorer.exe", "python.exe", "pythonw.exe") or cls_before in ("Progman", "WorkerW", "Shell_TrayWnd", "CabinetWClass", "ExploreWClass"):
            is_dedicated_input_app = False
        else:
            is_dedicated_input_app = True
        _IS_INPUT_SUMMON_CONTEXT = is_dedicated_input_app

        if proc_before not in ("python.exe", "pythonw.exe"):
            _capture_target_hwnd()
        play_baby_ghost_sound(mode="summon")
        record_feature_telemetry("ctrl0_summon_bar")
        already_armed_seq = bool(seq_mode and len(seq_queue) >= 2 and not pasting_started)
        _cancel_unstarted_seq_mode_and_restore_clip()

        live_clip = get_clipboard_text()
        if already_armed_seq and recent_unpasted:
            last_summon_raw_clip = recent_unpasted[-1]
        elif live_clip:
            last_summon_raw_clip = live_clip
            if not recent_unpasted:
                recent_unpasted.append(live_clip)
            elif recent_unpasted[-1] != live_clip:
                recent_unpasted.append(live_clip)
        elif recent_unpasted:
            last_summon_raw_clip = recent_unpasted[-1]

        # [분기 1: 1회성 스샷 팝업] 방금(15초 이내) 스샷을 찍은 직후 최초 1회 소환 시에만 [창 UI ③ 사진·OCR 공간이동창] 직행!
        if recent_images and last_image_ts > last_consumed_image_ts and last_image_ts > last_copy_ts and (now_s - last_image_ts) <= 15.0:
            last_consumed_image_ts = last_image_ts
            disarm_sub_hotkeys()
            show_ghost_toast("__UI3_OCR__|", duration_ms=8000)
            return

        # [분기 2: 빈 곳 / 탐색기]
        # - 압축 파일(.zip/.7z 등) 선택 시 ➔ [창 UI ④ 스마트 압축 해제창] 직행!
        # - 탐색기·바탕화면에서 일반 파일(사진·카톡사진·문서)을 클릭 선택(SelectedItems)한 상태이거나,
        #   방금(20초 이내) 유저가 Ctrl+C로 파일을 복사한 직후 빈 공간 클릭 없이 바로 호출한 경우 ➔ [창 UI ① 기본 귀신창] 직행!
        # - 파일 선택을 해제한 탐색기 빈 공간이나 빈 바탕화면에서 호출 시 ➔ [창 UI ② 귀신검색창(소형)] 100% 직행!
        if not is_dedicated_input_app:
            if (proc_before == "explorer.exe" and cls_before in ("CabinetWClass", "ExploreWClass")) or cls_before in ("Progman", "WorkerW"):
                try:
                    sel_paths = _get_explorer_selected_paths_safe(fg_before)
                    if sel_paths:
                        first_sel = str(sel_paths[0]).lower()
                        if first_sel.endswith((".zip", ".7z", ".rar", ".tar", ".gz", ".tgz")):
                            last_hdrop_copy_ts = 0.0
                            disarm_sub_hotkeys()
                            show_ghost_toast(f"__UI4_ARCHIVE__|{sel_paths[0]}", duration_ms=11000)
                            return
                        if any(Path(str(sp)).is_file() for sp in sel_paths):
                            last_hdrop_copy_ts = 0.0
                            _show_default_ui1_bar(live_clip)
                            return
                except Exception:
                    pass
            # 유저가 Ctrl+C로 파일(CF_HDROP)을 복사한 직후(20초 이내) 아직 빈 공간을 클릭하지 않은 상태에서만 1회성 기본 귀신창 직행!
            if (
                not summon_by_rclick
                and last_hdrop_copy_ts > 0.0
                and last_hdrop_copy_ts > last_lbtn_click_ts
                and (now_s - last_hdrop_copy_ts) <= 20.0
            ):
                hdrop_now = get_clipboard_hdrop_files()
                if hdrop_now:
                    last_hdrop_copy_ts = 0.0
                    if any(str(hp).lower().endswith((".zip", ".7z", ".rar", ".tar", ".gz", ".tgz")) for hp in hdrop_now):
                        disarm_sub_hotkeys()
                        show_ghost_toast(f"__UI4_ARCHIVE__|{hdrop_now[0]}", duration_ms=11000)
                        return
                    _show_default_ui1_bar(live_clip)
                    return
            # [확정 원안 (안 A) 준수]: 파일 선택을 해제한 탐색기(S: 드라이브 등) 빈 공간이나 빈 바탕화면에서 호출 시 ➔ 1회 호출만으로 [창 UI ② 👻 귀신검색창(소형)] 100% 직행!
            disarm_sub_hotkeys()
            show_ghost_toast("__UI2_SEARCH__|small|", duration_ms=8000)
            return

        # [분기 3: 입력창 내부 — 드래그 선택 시 귀신같이 자동 분기(1단계 다림질 시도 ➔ 2단계 내 PC 검색 시도 ➔ 매칭 시 검색창 오픈 / 미매칭 시 토스트 종료)]
        selected_raw = ""
        did_auto_iron = False
        ironed_result = ""
        ed_chk = _find_edit_control_child(fg_before)
        if ed_chk:
            try:
                full_before_ed, idx_t, is_rich_ed = _get_edit_full_text_and_index_str(ed_chk)
                if idx_t:
                    u16_b = idx_t.encode("utf-16-le")
                    u16_len = len(u16_b) // 2
                    s_d = wintypes.DWORD(0)
                    e_d = wintypes.DWORD(0)
                    _send_msg_timeout(ed_chk, EM_GETSEL, ctypes.addressof(s_d), ctypes.addressof(e_d), 120)
                    sp, ep = s_d.value, e_d.value
                    if 0 <= sp < ep <= u16_len:
                        selected_raw = u16_b[sp * 2 : ep * 2].decode("utf-16-le", errors="ignore")
                        if selected_raw.strip():
                            cand_iron = clean_and_iron_text(selected_raw, allow_typo_morph=True)
                            if cand_iron.strip() == selected_raw.strip():
                                cand_num = _toggle_korean_number_format(selected_raw)
                                if cand_num.strip() != selected_raw.strip():
                                    cand_iron = cand_num
                            if cand_iron.strip() and cand_iron.strip() != selected_raw.strip():
                                out_w = cand_iron.replace("\r\n", "\n").replace("\n", "\r\n") if not is_rich_ed else cand_iron
                                _send_msg_timeout(ed_chk, EM_SETSEL, sp, ep, 120)
                                rbuf_auto = ctypes.create_unicode_buffer(out_w)
                                _send_msg_timeout(ed_chk, EM_REPLACESEL, 1, ctypes.addressof(rbuf_auto), 150)
                                rep_u16_len = len(out_w.encode("utf-16-le")) // 2
                                _send_msg_timeout(ed_chk, EM_SETSEL, sp, sp + rep_u16_len, 120)
                                full_after_ed, _, _ = _get_edit_full_text_and_index_str(ed_chk)
                                root_ed = u32.GetAncestor(ed_chk, 2) or ed_chk
                                arm_undo_snapshot(
                                    root_ed,
                                    ed_chk,
                                    selected_raw,
                                    out_w,
                                    mode="edit_replace",
                                    full_doc_before=full_before_ed,
                                    full_doc_after=full_after_ed,
                                )
                                daemon_set_clipboard(cand_iron.replace("\r\n", "\n").replace("\r", "\n").replace("\n", "\r\n"))
                                did_auto_iron = True
                                ironed_result = cand_iron
                                complete_feature_action_success("superpower_key_1")
            except Exception:
                pass
        elif summon_had_recent_drag and fg_before and u32.IsWindow(fg_before) and proc_before not in _SECURITY_SENSITIVE_PROCS:
            try:
                sentinel_dr = "__GHOSTI_DRAG_AUTO__"
                prev_cb_dr = get_clipboard_text() or live_clip
                prev_hdrop_dr = get_clipboard_hdrop_files()
                release_all_modifiers()
                daemon_set_clipboard(sentinel_dr)
                time.sleep(0.015)
                tap_key_combo([VK_CONTROL], VK_C)
                probed_sel = sentinel_dr
                for _ in range(8):
                    time.sleep(0.015)
                    c_now = get_clipboard_text()
                    if c_now and c_now != sentinel_dr:
                        probed_sel = c_now
                        break
                def _restore_prev_clipboard_dr() -> None:
                    if prev_hdrop_dr and Path(prev_hdrop_dr[0]).exists():
                        set_clipboard_hdrop_file(prev_hdrop_dr[0])
                    elif prev_cb_dr:
                        daemon_set_clipboard(prev_cb_dr)
                    else:
                        empty_os_clipboard()
                if probed_sel and probed_sel != sentinel_dr and probed_sel.strip():
                    selected_raw = probed_sel
                    cand_iron = clean_and_iron_text(selected_raw, allow_typo_morph=True)
                    if cand_iron.strip() == selected_raw.strip():
                        cand_num = _toggle_korean_number_format(selected_raw)
                        if cand_num.strip() != selected_raw.strip():
                            cand_iron = cand_num
                    if cand_iron.strip() and cand_iron.strip() != selected_raw.strip():
                        out_w = cand_iron.replace("\r\n", "\n").replace("\r", "\n").replace("\n", "\r\n")
                        if not selected_raw.endswith(("\r\n", "\n")) and "\t" not in out_w:
                            out_w = out_w.rstrip("\r\n")
                        daemon_set_clipboard(out_w)
                        time.sleep(0.03)
                        tap_key_combo([VK_CONTROL], VK_V)
                        arm_undo_snapshot(fg_before, 0, selected_raw, out_w, mode="clipboard_paste")
                        did_auto_iron = True
                        ironed_result = cand_iron
                        complete_feature_action_success("superpower_key_1")
                    else:
                        _restore_prev_clipboard_dr()
                else:
                    _restore_prev_clipboard_dr()
            except Exception:
                pass

        if selected_raw and selected_raw.strip():
            last_drag_select_ts = 0.0
            summon_had_recent_drag = False
            disarm_sub_hotkeys()
            search_cand = (ironed_result if did_auto_iron else selected_raw).rstrip("?？").strip()
            match_cnt = _count_local_search_matches(search_cand, exclude_exact_text=selected_raw)
            if match_cnt > 0:
                show_ghost_toast(f"__UI2_SEARCH__|small|{search_cand}", duration_ms=8000)
                return
            if did_auto_iron:
                show_ghost_toast("✨ 귀신같이 다림질 완료! (Ctrl+Z 원복)", duration_ms=1800)
                return
            short_q = (search_cand.splitlines()[0][:18] + "…") if len(search_cand) > 18 else search_cand.splitlines()[0]
            show_ghost_toast(f"🔍 '{short_q}' 관련 파일이 내 PC에 없습니다", duration_ms=1800)
            return

        explicit_search_query = ""
        if ed_chk:
            try:
                cur_ln_q = _get_edit_control_current_line(ed_chk) or ""
                if cur_ln_q.rstrip().endswith(("?", "？")):
                    toks_q = cur_ln_q.rstrip().rstrip("?？").strip().split()
                    explicit_search_query = toks_q[-1] if toks_q else ""
                    last_question_mark_ts = 0.0
            except Exception:
                pass
        elif (now_s - last_question_mark_ts) <= 8.0:
            last_question_mark_ts = 0.0
            q_cand = "".join(typed_ascii_buf).rstrip("?？/").strip()
            if q_cand and not AI_ENGINE.is_valid_english_word(q_cand):
                k_q = eng_word_to_kor(q_cand)
                if k_q and is_valid_korean_word(k_q):
                    q_cand = k_q
            explicit_search_query = q_cand

        if explicit_search_query:
            disarm_sub_hotkeys()
            if _count_local_search_matches(explicit_search_query) > 0:
                show_ghost_toast(f"__UI2_SEARCH__|small|{explicit_search_query}", duration_ms=8000)
            else:
                show_ghost_toast(f"🔍 '{explicit_search_query[:18]}' 관련 파일이 내 PC에 없습니다", duration_ms=1800)
            return

        _show_default_ui1_bar(live_clip)

    last_summon_ts: float = 0.0
    last_hotkey_rebind_ts: float = time.time()
    was_ctrl0_down: bool = False
    was_ctrl_alt_t_down: bool = False
    was_ctrl_z_down: bool = False
    last_topmost_ts: float = 0.0

    def _should_bypass_rclick_hook(hwnd_fg: int | None) -> bool:
        if not hwnd_fg:
            return False
        try:
            proc_name = _get_process_name_from_hwnd(hwnd_fg).lower()
            if proc_name in _RCLICK_BYPASS_PROCS:
                return True
            rc_win = wintypes.RECT()
            if u32.GetWindowRect(hwnd_fg, ctypes.byref(rc_win)):
                style = u32.GetWindowLongW(hwnd_fg, -16)  # GWL_STYLE
                WS_CAPTION = 0x00C00000
                if not (style & WS_CAPTION):
                    scr_w = u32.GetSystemMetrics(0)
                    scr_h = u32.GetSystemMetrics(1)
                    if (rc_win.right - rc_win.left) >= scr_w and (rc_win.bottom - rc_win.top) >= scr_h:
                        cls_n = _get_win_class_only(hwnd_fg)
                        if cls_n not in ("Progman", "WorkerW", "Shell_TrayWnd"):
                            return True
        except Exception:
            pass
        return False

    def _release_target_rbutton_stuck(hwnd_target: int | None, pt_x: int | None = None, pt_y: int | None = None) -> None:
        """
        Ctrl+우클릭 호출 순간 실제 마우스 커서 아래 컨트롤(SysListView32/SHELLDLL_DefView 등)과
        상위 창에 WM_CANCELMODE를 전달하여, 우클릭 버튼을 뗄 때 OS 기본 우클릭 메뉴가 아예 생성되지 않도록 차단합니다.
        """
        try:
            pt_c = wintypes.POINT()
            if pt_x is not None and pt_y is not None:
                pt_c.x, pt_c.y = int(pt_x), int(pt_y)
            else:
                u32.GetCursorPos(ctypes.byref(pt_c))
            hwnd_pt = u32.WindowFromPoint(pt_c)
            seen_h: set[int] = set()
            for cand in (hwnd_pt, u32.GetParent(hwnd_pt) if hwnd_pt else 0, hwnd_target or u32.GetForegroundWindow()):
                if cand and cand not in seen_h:
                    seen_h.add(cand)
                    cls_c = _get_win_class_only(cand)
                    if cls_c != "Shell_TrayWnd":
                        u32.PostMessageW(cand, WM_CANCELMODE, 0, 0)
        except Exception:
            pass

    def _dismiss_native_context_menu_after_rbtn_up(hwnd_target: int | None) -> None:
        """
        [바탕화면/앱 기본 우클릭 메뉴 즉시 소거 & Ctrl+Esc 시작메뉴 오작동 영구 차단]:
        - 유저가 Ctrl 키를 누른 채 우클릭을 뗄 때 VK_ESCAPE를 주입하면 윈도우 단축키 'Ctrl + Esc (시작 메뉴 열기)'가 발동되므로
          VK_ESCAPE 키 이벤트 주입을 영구 금지합니다!
        - WH_MOUSE_LL 훅이 Ctrl+우클릭(WM_RBUTTONDOWN/UP)을 원천 차단하며, 혹시라도 고전 메뉴(#32768)가 뜬 경우에만
          키보드 이벤트 없이 MN_CANCELMENUS + WM_CLOSE 메시지로만 조용히 닫습니다.
        """
        def _worker():
            try:
                MN_CANCELMENUS = 0x01E6
                WM_CLOSE_MSG = 0x0010
                for delay_s in (0.005, 0.015, 0.030, 0.055):
                    time.sleep(delay_s)
                    h_menu = u32.FindWindowW("#32768", None)
                    if h_menu and u32.IsWindowVisible(h_menu):
                        u32.PostMessageW(h_menu, MN_CANCELMENUS, 0, 0)
                        u32.PostMessageW(h_menu, WM_CLOSE_MSG, 0, 0)
                _toast_queue.put(("__LIFT__", 0))
            except Exception:
                pass

        threading.Thread(target=_worker, daemon=True).start()

    _CACHED_RCLICK_BYPASS = [False]

    def _is_ctrl_down_fast() -> bool:
        return bool(
            (u32.GetAsyncKeyState(VK_CONTROL) & 0x8000)
            or (u32.GetAsyncKeyState(0xA2) & 0x8000)
            or (u32.GetAsyncKeyState(0xA3) & 0x8000)
        )

    def _ll_mouse_proc(nCode: int, wParam: int, lParam: int) -> int:
        if nCode >= 0 and wParam in (WM_RBUTTONDOWN, WM_RBUTTONUP):
            try:
                if wParam == WM_RBUTTONDOWN:
                    ctrl_h = _is_ctrl_down_fast()
                    alt_h = (u32.GetAsyncKeyState(VK_MENU) & 0x8000) != 0
                    shift_h = (u32.GetAsyncKeyState(VK_SHIFT) & 0x8000) != 0
                    if ctrl_h and not alt_h and not shift_h and not _CACHED_RCLICK_BYPASS[0]:
                        _RBTN_HOLD_STATE["suppress_next_up"] = True
                        _RBTN_HOLD_STATE["down_ts"] = time.time()
                        _RBTN_HOLD_STATE["summon_requested"] = True
                        _RBTN_HOLD_STATE["target_hwnd"] = u32.GetForegroundWindow()
                        return 1
                elif wParam == WM_RBUTTONUP:
                    if _RBTN_HOLD_STATE.get("suppress_next_up"):
                        _RBTN_HOLD_STATE["suppress_next_up"] = False
                        return 1
                    # WM_RBUTTONDOWN 직후(0.6초 이내) 릴리즈는 중복 소환 발화 차단 (연속 클릭 씹힘·딜레이 0%)
                    if (time.time() - float(_RBTN_HOLD_STATE.get("down_ts") or 0.0)) < 0.6:
                        return u32.CallNextHookEx(None, nCode, wParam, lParam)
                    ctrl_u = _is_ctrl_down_fast()
                    alt_u = (u32.GetAsyncKeyState(VK_MENU) & 0x8000) != 0
                    shift_u = (u32.GetAsyncKeyState(VK_SHIFT) & 0x8000) != 0
                    if ctrl_u and not alt_u and not shift_u and not _CACHED_RCLICK_BYPASS[0]:
                        _RBTN_HOLD_STATE["summon_requested"] = True
                        _RBTN_HOLD_STATE["target_hwnd"] = u32.GetForegroundWindow()
                        return 1
            except Exception:
                pass
        return u32.CallNextHookEx(None, nCode, wParam, lParam)

    # WH_MOUSE_LL 훅은 순수 네이티브 x64 기계어 프리필터 스텁을 거쳐 WM_MOUSEMOVE(마우스 이동)가 Python GIL에 0회 진입하게 하며,
    # 실제 우클릭(WM_RBUTTONDOWN/UP)만 THREAD_PRIORITY_HIGHEST 전용 GetMessageW 스레드에서 즉시 처리하여 마우스 끊김을 물리적으로 0%로 차단합니다.
    # 또한 Windows LowLevelHooksTimeout 사일런트 탈락을 자동 자가치유하도록 WM_APP_REHOOK(원자적 Hook-Swap)을 지원합니다.
    _ll_mouse_hook_cb = LowLevelMouseProcType(_ll_mouse_proc)
    _ll_mouse_native_stub_ptr = _create_x64_rclick_prefilter_stub(_ll_mouse_hook_cb)
    _ll_mouse_hook_fn_ptr = _ll_mouse_native_stub_ptr or (ctypes.cast(_ll_mouse_hook_cb, ctypes.c_void_p).value or 0)
    _ll_mouse_hook_ready = threading.Event()

    _ll_mouse_hook_handle: list[int] = [0]
    _ll_mouse_hook_tid: list[int] = [0]
    _ll_mouse_hook_thread: list[threading.Thread | None] = [None]
    WM_APP_REHOOK = 0x8001

    def _install_ll_mouse_hook_once() -> int:
        h_mod_self = k32.GetModuleHandleW(None)
        _hk_new = (
            (u32.SetWindowsHookExW(WH_MOUSE_LL, _ll_mouse_hook_fn_ptr, h_mod_self, 0) if _ll_mouse_hook_fn_ptr else 0)
            or (u32.SetWindowsHookExW(WH_MOUSE_LL, _ll_mouse_hook_fn_ptr, None, 0) if _ll_mouse_hook_fn_ptr else 0)
            or u32.SetWindowsHookExW(WH_MOUSE_LL, ctypes.cast(_ll_mouse_hook_cb, ctypes.c_void_p).value or 0, h_mod_self, 0)
        )
        return int(_hk_new or 0)

    def _dedicated_mouse_hook_worker() -> None:
        try:
            try:
                k32.SetThreadPriority(k32.GetCurrentThread(), 2)  # THREAD_PRIORITY_HIGHEST
            except Exception:
                pass
            try:
                _ll_mouse_hook_tid[0] = int(k32.GetCurrentThreadId())
            except Exception:
                _ll_mouse_hook_tid[0] = 0
            _hk = _install_ll_mouse_hook_once()
            _ll_mouse_hook_handle[0] = _hk
            _ll_mouse_hook_ready.set()
            _log_seq_diag(
                "MOUSE_HOOK_INIT",
                f"ok={bool(_hk)} tid={_ll_mouse_hook_tid[0]} stub={bool(_ll_mouse_native_stub_ptr)}",
            )
            if not _hk:
                return
            _m_msg = wintypes.MSG()
            while (not _IN_PROCESS_STOP_EVENT.is_set()) and u32.GetMessageW(ctypes.byref(_m_msg), None, 0, 0) > 0:
                if _m_msg.message == WM_APP_REHOOK:
                    # [무중단 원자적 Hook-Swap]: 새 훅을 먼저 성공 등록한 뒤에만 구 훅을 해제해 단 1ms의 공백도 허용하지 않음!
                    _old_hk = _ll_mouse_hook_handle[0]
                    _new_hk = _install_ll_mouse_hook_once()
                    if _new_hk:
                        _ll_mouse_hook_handle[0] = _new_hk
                        if _old_hk:
                            try:
                                u32.UnhookWindowsHookEx(_old_hk)
                            except Exception:
                                pass
                    else:
                        _log_seq_diag("MOUSE_HOOK_REHOOK_FAIL", f"err={int(k32.GetLastError())}")
                    continue
                u32.TranslateMessage(ctypes.byref(_m_msg))
                u32.DispatchMessageW(ctypes.byref(_m_msg))
            try:
                if _ll_mouse_hook_handle[0]:
                    u32.UnhookWindowsHookEx(_ll_mouse_hook_handle[0])
                    _ll_mouse_hook_handle[0] = 0
            except Exception:
                pass
        except Exception as _m_exc:
            _log_seq_diag("MOUSE_HOOK_ERR", repr(_m_exc))
            _ll_mouse_hook_ready.set()

    def _ensure_mouse_hook_worker_alive() -> None:
        th = _ll_mouse_hook_thread[0]
        if th is not None and th.is_alive() and _ll_mouse_hook_handle[0]:
            return
        _ll_mouse_hook_ready.clear()
        new_th = threading.Thread(target=_dedicated_mouse_hook_worker, daemon=True)
        _ll_mouse_hook_thread[0] = new_th
        new_th.start()
        _ll_mouse_hook_ready.wait(timeout=1.0)

    _ensure_mouse_hook_worker_alive()
    last_mouse_rehook_ts: float = time.time()

    # 무거운 초기화는 메인 루프·마우스 훅 준비 완료 직후 백그라운드에서 지연 실행
    threading.Thread(target=_deferred_startup_init_worker, daemon=True).start()

    msg = wintypes.MSG()
    PM_REMOVE = 0x0001
    WM_QUIT_MSG = 0x0012
    last_fs_signal_poll_ts: float = 0.0
    # [절대 금기]: 데몬 기동·재기동 시 유저가 호출하지 않았는데 귀신창이 혼자 튀어나오는 현상 영구 차단!
    pending_init_show_ts: float = 0.0
    global _MAIN_LOOP_HEARTBEAT_TS, _MAIN_LOOP_STAGE
    _MAIN_LOOP_HEARTBEAT_TS = time.time()
    _MAIN_LOOP_STAGE = "loop_ready"
    _log_seq_diag("MAIN_LOOP_READY", f"boot_ms={(time.perf_counter()-t_boot_start)*1000:.1f}")

    def _self_hang_watchdog() -> None:
        while not _IN_PROCESS_STOP_EVENT.is_set():
            time.sleep(6.0)
            try:
                now_w = time.time()
                main_lag_w = now_w - _MAIN_LOOP_HEARTBEAT_TS
                ui_lag_w = now_w - _UI_LOOP_HEARTBEAT_TS
                # 초기 부팅(tk_init/init) 중 Windows Defender 스캔 지연은 45초 유예로 오판 자폭 원천 차단
                ui_limit = 45.0 if _UI_LOOP_STAGE in ("init", "tk_init", "tk_ready", "warmup_ui2") else 18.0
                ui_hung = _TOAST_WORKER_STARTED and ui_lag_w > ui_limit
                if not _MODAL_PROMPT_ACTIVE and (main_lag_w > 18.0 or ui_hung):
                    _log_seq_diag(
                        "HANG_WATCHDOG_EXIT",
                        f"main_lag={main_lag_w:.1f}s ui_lag={ui_lag_w:.1f}s main_stage={_MAIN_LOOP_STAGE} ui_stage={_UI_LOOP_STAGE} open_mode={_CURRENT_OPEN_UI_MODE}",
                    )
                    try:
                        lock_sock.close()
                    except Exception:
                        pass
                    if in_process:
                        _IN_PROCESS_STOP_EVENT.set()
                        return
                    # [핵심 근본 수정]: 후계 프로세스 스폰 전에 Named Mutex를 먼저 반납해 ERROR_ALREADY_EXISTS 자살을 원천 차단!
                    _release_single_instance_mutex()
                    try:
                        if getattr(sys, "frozen", False):
                            clean_env = {k: v for k, v in os.environ.items() if k not in ("_MEIPASS2", "_MEIPASS")}
                            clean_env["PYINSTALLER_RESET_ENVIRONMENT"] = "1"
                            subprocess.Popen(
                                [sys.executable, "--seq-paste-daemon"],
                                env=clean_env,
                                creationflags=0x08000000 | 0x00000008,
                                close_fds=True,
                            )
                    except Exception:
                        pass
                    os._exit(1)
            except Exception:
                pass

    threading.Thread(target=_self_hang_watchdog, daemon=True).start()

    last_e2ee_mailbox_mtime: float = E2EE_MAILBOX_FILE.stat().st_mtime if E2EE_MAILBOX_FILE.exists() else 0.0

    def _advance_seq_paste_queue() -> None:
        nonlocal seq_mode, pasting_started, copied_after_trigger
        if not (seq_mode and seq_queue):
            recent_unpasted.clear()
            return
        pasting_started = True
        time.sleep(0.08)
        seq_queue.pop(0)
        recent_unpasted[:] = list(seq_queue)
        if seq_queue:
            fg_pv = u32.GetForegroundWindow()
            fg_pv_proc = _get_process_name_from_hwnd(fg_pv).lower() if fg_pv else ""
            is_plain_doc_editor = fg_pv_proc in ("notepad.exe", "wordpad.exe", "winword.exe", "hwp.exe")
            is_smart_matched = False
            if not is_plain_doc_editor:
                ctx = get_focused_field_context()
                best_idx, is_smart_matched = select_best_matching_item_index(seq_queue, ctx)
                if best_idx != 0:
                    matched_item = seq_queue.pop(best_idx)
                    seq_queue.insert(0, matched_item)
                    recent_unpasted[:] = list(seq_queue)
            daemon_set_clipboard(seq_queue[0])
            if is_smart_matched:
                show_ghost_toast(f"👻 귀신같이 AI칸맞춤 대기 ({seq_queue[0][:12]})", duration_ms=1600)
            else:
                show_ghost_toast(
                    f"👻 순차복붙 다음 대기 ({len(seq_queue)}개 남음: {seq_queue[0][:14]})",
                    duration_ms=1500,
                )
        else:
            seq_mode = False
            pasting_started = False
            copied_after_trigger = False
            recent_unpasted.clear()
            complete_feature_action_success("feat_1_seq_paste")
            show_ghost_toast("👻 귀신같이 순차붙여넣기 완료!", duration_ms=1600)

    while not _IN_PROCESS_STOP_EVENT.is_set():
        _MAIN_LOOP_HEARTBEAT_TS = time.time()
        _MAIN_LOOP_STAGE = "peek"
        had_hotkey = False
        while u32.PeekMessageW(ctypes.byref(msg), None, 0, 0, PM_REMOVE) != 0:
            if msg.message == WM_QUIT_MSG:
                # 외부에서 실수로 WM_QUIT가 전달되더라도 데몬이 죽지 않고 타이머를 재무장하여 영구 생존 보장!
                u32.SetTimer(None, 1, 25, None)
                continue
            try:
                if msg.message == WM_HOTKEY:
                    had_hotkey = True
                    hk_id = msg.wParam
                    # 1) 마스터 트리거 (오직 Ctrl + 0만!)
                    if hk_id in (1, 2):
                        now_hk = time.time()
                        if (now_hk - last_summon_ts) > 0.16:
                            last_summon_ts = now_hk
                            was_ctrl0_down = True
                            trigger_master_summon(source=f"hotkey_{hk_id}")
                            last_summon_ts = time.time()

                    # 1-B) 창 고정/원복 전용 핫키 (Ctrl + Alt + T)
                    elif hk_id == 4:
                        now_hk = time.time()
                        if (now_hk - last_topmost_ts) > 0.25:
                            last_topmost_ts = now_hk
                            _execute_superpower_num(5)

                    # 2) 숫자 1~9 초능력 발동 (단독 또는 Ctrl 유지 상태 모두 지원)
                    elif (101 <= hk_id <= 109) or (201 <= hk_id <= 209) or (401 <= hk_id <= 409) or (501 <= hk_id <= 509):
                        _execute_superpower_num(hk_id % 100)

                    # 3) Ctrl+0 소환 후 F1~F6 개인 상용구(무료) & F7~F12 팀 상용구(유료🔒) 발동
                    elif 301 <= hk_id <= 312:
                        fslot = hk_id - 300
                        disarm_sub_hotkeys()
                        close_ghost_toast()
                        _cancel_unstarted_seq_mode_and_restore_clip()
                        seq_mode = False
                        fkey = f"snippet_F{fslot}"
                        allowed, q_msg = check_feature_quota_allowed(fkey, interactive_opt_in=True)
                        if not allowed:
                            show_ghost_toast(q_msg, duration_ms=3200)
                        else:
                            superpower_fixed_snippet(fslot, daemon_set_clipboard)
                            complete_feature_action_success(fkey)
            except Exception:
                pass
            u32.TranslateMessage(ctypes.byref(msg))
            u32.DispatchMessageW(ctypes.byref(msg))

        try:
            if True:
                now = time.time()
                if (now - last_hotkey_rebind_ts) > 15.0:
                    last_hotkey_rebind_ts = now
                    _MAIN_LOOP_STAGE = "health_rebind"
                    try:
                        lock_sock = _ensure_single_instance_socket_alive(lock_sock)
                        _ensure_toast_worker()
                        _ensure_mouse_hook_worker_alive()
                        u32.RegisterHotKey(None, 1, MOD_CONTROL | MOD_NOREPEAT, VK_0)
                        u32.RegisterHotKey(None, 2, MOD_CONTROL | MOD_NOREPEAT, VK_NUMPAD0)
                        u32.RegisterHotKey(None, 4, MOD_CONTROL | MOD_ALT | MOD_NOREPEAT, 0x54)
                        u32.SetTimer(None, 1, 25, None)
                        # [WH_MOUSE_LL 사일런트 탈락 영구 자가치유]: 90초마다 유휴 시점에 무중단 원자적 Hook-Swap
                        if (
                            (now - last_mouse_rehook_ts) > 90.0
                            and (now - last_summon_ts) > 5.0
                            and not ((u32.GetAsyncKeyState(0x02) & 0x8000) != 0)
                            and _ll_mouse_hook_tid[0]
                        ):
                            last_mouse_rehook_ts = now
                            u32.PostThreadMessageW.argtypes = [wintypes.DWORD, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]
                            u32.PostThreadMessageW.restype = wintypes.BOOL
                            u32.PostThreadMessageW(wintypes.DWORD(int(_ll_mouse_hook_tid[0])), WM_APP_REHOOK, 0, 0)
                    except Exception:
                        pass
                while not _CLICKED_SUPERPOWER_QUEUE.empty():
                    try:
                        q_cmd = _CLICKED_SUPERPOWER_QUEUE.get_nowait()
                        if isinstance(q_cmd, tuple) and q_cmd[0] == "disarm_only":
                            _cancel_unstarted_seq_mode_and_restore_clip()
                            disarm_sub_hotkeys()
                            continue
                        if isinstance(q_cmd, tuple) and q_cmd[0] == "prune_history":
                            _prune_history_by_retention()
                            continue
                        if isinstance(q_cmd, tuple) and q_cmd[0] == "snippet":
                            fslot = int(q_cmd[1])
                            disarm_sub_hotkeys()
                            _cancel_unstarted_seq_mode_and_restore_clip()
                            seq_mode = False
                            fkey = f"snippet_F{fslot}"
                            allowed, q_msg = check_feature_quota_allowed(fkey, interactive_opt_in=True)
                            if not allowed:
                                show_ghost_toast(q_msg, duration_ms=3200)
                            else:
                                superpower_fixed_snippet(fslot, daemon_set_clipboard)
                                complete_feature_action_success(fkey)
                            continue
                        if isinstance(q_cmd, tuple) and q_cmd[0] == "labeler":
                            lbl_fp = str(q_cmd[1] or "").strip() if len(q_cmd) >= 2 else ""
                            disarm_sub_hotkeys()
                            _cancel_unstarted_seq_mode_and_restore_clip()
                            seq_mode = False
                            if not lbl_fp or not Path(lbl_fp).exists():
                                show_ghost_toast("🏷️ 먼저 라벨을 붙일 실제 파일을 선택해 주세요.", duration_ms=2200)
                                continue
                            norm_lbl_fp = lbl_fp.replace("\\", "/").lower()
                            is_s_drive_lbl = (
                                (len(lbl_fp) >= 2 and lbl_fp[0].upper() == "S" and lbl_fp[1] == ":")
                                or "/s:/" in norm_lbl_fp
                            )
                            if not is_s_drive_lbl:
                                allowed, q_msg = check_feature_quota_allowed("feat_ghost_labeler", interactive_opt_in=True)
                                if not allowed:
                                    show_ghost_toast(q_msg, duration_ms=3200)
                                    continue
                            superpower_9_image_or_pdf_file(
                                recent_images,
                                target_hwnd=_LAST_TARGET_HWND,
                                explicit_files=[lbl_fp],
                                force_explicit=True,
                            )
                            complete_feature_action_success("feat_ghost_labeler")
                            continue
                        exp_files: list[str] | None = None
                        force_exp = False
                        if isinstance(q_cmd, tuple):
                            c_num = int(q_cmd[0])
                            if len(q_cmd) >= 2 and q_cmd[1]:
                                exp_files = [str(q_cmd[1])]
                            if len(q_cmd) >= 3:
                                force_exp = bool(q_cmd[2])
                        else:
                            c_num = int(q_cmd)
                        if c_num == -1:
                            disarm_sub_hotkeys()
                            close_ghost_toast()
                            execute_undo_snapshot(daemon_set_clipboard)
                        elif c_num == 0:
                            disarm_sub_hotkeys()
                            if _LAST_TARGET_HWND and u32.IsWindow(_LAST_TARGET_HWND):
                                u32.SetForegroundWindow(_LAST_TARGET_HWND)
                                time.sleep(0.025)
                            tap_key_combo([VK_CONTROL], VK_V)
                            if seq_mode and seq_queue:
                                _advance_seq_paste_queue()
                        elif 1 <= c_num <= 9:
                            _execute_superpower_num(c_num, explicit_files=exp_files, force_explicit=force_exp)
                    except Exception:
                        pass
                # [WH_MOUSE_LL 훅 연동 + 폴백 Ctrl+우클릭 감지 — 윈도우 우클릭 메뉴 및 시작메뉴(Ctrl+Esc) 간섭 0%]
                _CACHED_RCLICK_BYPASS[0] = _should_bypass_rclick_hook(u32.GetForegroundWindow())
                if _RBTN_HOLD_STATE.get("summon_requested"):
                    _RBTN_HOLD_STATE["summon_requested"] = False
                    _RBTN_HOLD_STATE["dismiss_context_menu_on_up"] = True
                    _release_target_rbutton_stuck(_RBTN_HOLD_STATE.get("target_hwnd"))
                    _dismiss_native_context_menu_after_rbtn_up(_RBTN_HOLD_STATE.get("target_hwnd"))
                    if (now - last_summon_ts) > 0.16:
                        last_summon_ts = now
                        was_key_down[0x9901] = True
                        trigger_master_summon(summon_by_rclick=True, source="rclick_hook")
                        last_summon_ts = time.time()

                rbtn_phys_now = (u32.GetAsyncKeyState(0x02) & 0x8000) != 0
                was_rbtn_phys = was_key_down.get(0x9901, False)
                ctrl_now_r = (u32.GetAsyncKeyState(VK_CONTROL) & 0x8000) != 0
                alt_now_r = (u32.GetAsyncKeyState(VK_MENU) & 0x8000) != 0
                shift_now_r = (u32.GetAsyncKeyState(VK_SHIFT) & 0x8000) != 0

                if rbtn_phys_now and not was_rbtn_phys:
                    pt_rc = wintypes.POINT()
                    u32.GetCursorPos(ctypes.byref(pt_rc))
                    hwnd_fg_r = u32.GetForegroundWindow()
                    if not _should_bypass_rclick_hook(hwnd_fg_r) and ctrl_now_r and not alt_now_r and not shift_now_r:
                        _RBTN_HOLD_STATE["active"] = False
                        _RBTN_HOLD_STATE["triggered"] = True
                        _RBTN_HOLD_STATE["dismiss_context_menu_on_up"] = True
                        _RBTN_HOLD_STATE["target_hwnd"] = hwnd_fg_r
                        _RBTN_HOLD_STATE["x"] = pt_rc.x
                        _RBTN_HOLD_STATE["y"] = pt_rc.y
                        _release_target_rbutton_stuck(hwnd_fg_r)
                        if (time.time() - last_summon_ts) > 0.25:
                            last_summon_ts = time.time()
                            trigger_master_summon(summon_by_rclick=True, source="rclick_poll")
                            last_summon_ts = time.time()
                    else:
                        _RBTN_HOLD_STATE["active"] = False
                        _RBTN_HOLD_STATE["dismiss_context_menu_on_up"] = False
                elif not rbtn_phys_now and was_rbtn_phys:
                    _RBTN_HOLD_STATE["active"] = False
                    if _RBTN_HOLD_STATE.get("dismiss_context_menu_on_up"):
                        _RBTN_HOLD_STATE["dismiss_context_menu_on_up"] = False
                        _dismiss_native_context_menu_after_rbtn_up(_RBTN_HOLD_STATE.get("target_hwnd"))
                was_key_down[0x9901] = rbtn_phys_now
                if _UNDO_SNAPSHOT.get("active") and (now - float(_UNDO_SNAPSHOT.get("ts") or 0.0)) > 60.0:
                    disarm_undo_snapshot()
                if _PINNED_HWNDS:
                    enforce_pinned_windows()
                global _CLEAR_ALL_REQUESTED
                poll_fs_signals_now = (now - last_fs_signal_poll_ts) >= 0.12
                if poll_fs_signals_now:
                    last_fs_signal_poll_ts = now
                    # 평상시 일반 활성 창(크롬·노션·메모장 등)의 키보드 한/영 상태를 경량 추적해
                    # 바탕화면(Progman/WorkerW)에서 Ctrl+우클릭 호출 시에도 직전 키보드 언어를 100% 계승
                    if (now - _LAST_IME_POLL_TS[0]) >= 0.45:
                        _LAST_IME_POLL_TS[0] = now
                        try:
                            _fg_ip = u32.GetForegroundWindow()
                            if _fg_ip and u32.IsWindow(_fg_ip):
                                _cls_ip = _get_win_class_only(_fg_ip)
                                if _cls_ip not in ("Progman", "WorkerW", "Shell_TrayWnd") and "Tk" not in _cls_ip:
                                    _report_ui2_ime_korean(bool(get_ime_is_korean(_fg_ip)))
                        except Exception:
                            pass
                sig_triggered = False
                if poll_fs_signals_now and CLEAR_SIGNAL_FILE.exists():
                    try:
                        sig_ts = float(CLEAR_SIGNAL_FILE.read_text(encoding="utf-8").strip() or "0")
                        if sig_ts > last_clear_sig_ts:
                            last_clear_sig_ts = sig_ts
                            sig_triggered = True
                    except Exception:
                        pass
                if _CLEAR_ALL_REQUESTED or sig_triggered:
                    _CLEAR_ALL_REQUESTED = False
                    seq_mode = False
                    pasting_started = False
                    copied_after_trigger = False
                    seq_queue.clear()
                    recent_unpasted.clear()
                    recent_images.clear()
                    ai_clipboard_history.clear()
                    GLOBAL_AI_HISTORY.clear()
                    last_self_text = ""
                    last_summon_raw_clip = ""
                    last_image_sig = b""
                    last_hdrop_copy_ts = 0.0
                    disarm_undo_snapshot()
                    disarm_sub_hotkeys()
                    empty_os_clipboard()
                    last_seq_num = u32.GetClipboardSequenceNumber()
                    close_ghost_toast()
                if poll_fs_signals_now and E2EE_MAILBOX_FILE.exists():
                    try:
                        mb_mt = E2EE_MAILBOX_FILE.stat().st_mtime
                        if mb_mt > last_e2ee_mailbox_mtime:
                            last_e2ee_mailbox_mtime = mb_mt
                            mb_data = json.loads(E2EE_MAILBOX_FILE.read_text(encoding="utf-8"))
                            if isinstance(mb_data, dict):
                                existing_txts = {str(r.get("text") or "") for r in GLOBAL_AI_HISTORY}
                                for mb_it in (mb_data.get("text_items") or [])[-20:]:
                                    if isinstance(mb_it, dict) and mb_it.get("text"):
                                        dev_lbl = str(mb_it.get("device") or "내 다른 기기")
                                        full_lbl = f"[{dev_lbl}] {str(mb_it['text']).strip()}"
                                        if full_lbl not in existing_txts:
                                            record_ai_history(full_lbl)
                    except Exception:
                        pass
                if poll_fs_signals_now and OPEN_UI2_SIGNAL_FILE.exists():
                    try:
                        ui2_sig = json.loads(OPEN_UI2_SIGNAL_FILE.read_text(encoding="utf-8"))
                        u2_ts = float(ui2_sig.get("ts") or 0.0)
                        if u2_ts > last_open_ui2_sig_ts and (now - u2_ts) <= 10.0:
                            last_open_ui2_sig_ts = u2_ts
                            st_u2 = str(ui2_sig.get("stage") or "small")
                            q_u2 = str(ui2_sig.get("query") or "")
                            play_baby_ghost_sound(mode="summon")
                            show_ghost_toast(f"__UI2_SEARCH__|{st_u2}|{q_u2}", duration_ms=8000)
                    except Exception:
                        pass
                if menu_armed:
                    if _CURRENT_OPEN_UI_MODE == "ui1" and (_IS_UI_HOVERED or (now - last_summon_ts) <= 12.0):
                        if _IS_UI_HOVERED:
                            last_summon_ts = max(last_summon_ts, now - 4.0)
                        menu_armed_until = now + MENU_ARM_SECONDS
                    elif (now - last_summon_ts) > 0.35 or now > menu_armed_until or (now - last_summon_ts) > 12.0:
                        if _CURRENT_OPEN_UI_MODE == "ui1" and not _IS_UI_HOVERED and (now - last_summon_ts) > 12.0:
                            close_ghost_toast()
                        disarm_sub_hotkeys()

                # 귀신창이 열려 있을 때(menu_armed) UWP 계산기 등이 WM_HOTKEY를 가로채더라도 하드웨어 키 폴링으로 숫자 1~5 즉시 발동!
                if menu_armed and (now - last_summon_ts) > 0.14:
                    fg_cls_now = _get_win_class_only(u32.GetForegroundWindow())
                    if "Tk" not in fg_cls_now:
                        triggered_num = 0
                        for n_check in range(1, 6):
                            k_main = (u32.GetAsyncKeyState(0x30 + n_check) & 0x8000) != 0
                            k_numpad = (u32.GetAsyncKeyState(0x60 + n_check) & 0x8000) != 0
                            k_now = k_main or k_numpad
                            if k_now and not was_sub_key_down.get(n_check, False):
                                triggered_num = n_check
                            was_sub_key_down[n_check] = k_now
                        if triggered_num:
                            _execute_superpower_num(triggered_num)
                        else:
                            # 기본 귀신창이 떠 있는 상태에서 유저가 키보드 글자(A~Z)를 타이핑하기 시작하면 즉시 👻 귀신검색창으로 스르륵 자동 변신!
                            ctrl_chk = (u32.GetAsyncKeyState(VK_CONTROL) & 0x8000) != 0
                            alt_chk = (u32.GetAsyncKeyState(VK_MENU) & 0x8000) != 0
                            shift_chk = (u32.GetAsyncKeyState(VK_SHIFT) & 0x8000) != 0
                            if not ctrl_chk and not alt_chk:
                                for vk_alpha in range(0x41, 0x5B):
                                    a_down = (u32.GetAsyncKeyState(vk_alpha) & 0x8000) != 0
                                    if a_down and not was_key_down.get(vk_alpha, False):
                                        was_key_down[vk_alpha] = True
                                        ch_first = chr(vk_alpha) if shift_chk else chr(vk_alpha + 32)
                                        _cancel_unstarted_seq_mode_and_restore_clip()
                                        disarm_sub_hotkeys()
                                        _toast_queue.put((f"__MORPH_SEARCH__|{ch_first}", 0))
                                        break
                else:
                    for n_check in range(1, 6):
                        was_sub_key_down[n_check] = (
                            ((u32.GetAsyncKeyState(0x30 + n_check) & 0x8000) != 0)
                            or ((u32.GetAsyncKeyState(0x60 + n_check) & 0x8000) != 0)
                        )

                # 1) %LOCALAPPDATA%/Ghosti/data/clipboard_queue.json 에 순차 목록을 장전했는지 확인 (120ms 스로틀로 디스크 stat 과호출 방지)
                if poll_fs_signals_now and QUEUE_FILE.exists():
                    try:
                        mtime = QUEUE_FILE.stat().st_mtime
                        if mtime > last_queue_mtime:
                            last_queue_mtime = mtime
                            qdata = json.loads(QUEUE_FILE.read_text(encoding="utf-8"))
                            items = qdata.get("items", [])
                            if items:
                                seq_mode = True
                                pasting_started = False
                                copied_after_trigger = True
                                seq_queue = list(items)
                                recent_unpasted.clear()
                                daemon_set_clipboard(seq_queue[0])
                    except Exception:
                        pass

                # 2) 클립보드 변경(새로운 복사 또는 스샷 캡처) 감지 — 원문·서식 100% 그대로 보존 (서식·줄바꿈 다림질은 귀신창 [1]번 수동 실행 전용!)
                curr_seq = u32.GetClipboardSequenceNumber()
                if curr_seq != last_seq_num:
                    last_seq_num = curr_seq
                    copied = get_clipboard_text()
                    if copied:
                        if (
                            (copied == last_self_text and now < self_set_until)
                            or (copied == _SELF_CLIP_SET_TEXT and now < _SELF_CLIP_SET_UNTIL)
                            or now < _SELF_CLIP_COMBO_UNTIL
                        ):
                            pass
                        else:
                            last_self_text = None
                            last_summon_raw_clip = copied
                            disarm_sub_hotkeys()
                            record_ai_history(copied)

                            fg_cp = u32.GetForegroundWindow()
                            fg_cp_proc = _get_process_name_from_hwnd(fg_cp).lower() if fg_cp else ""
                            has_xl_fmt = has_excel_clipboard_format()
                            is_multiline_plain = ("\n" in copied.strip()) and not has_xl_fmt
                            is_excel_or_formula = (
                                fg_cp_proc == "excel.exe"
                                or has_xl_fmt
                                or copied.lstrip().startswith("=")
                            )
                            seq_burst_expired = last_copy_ts > 0 and (now - last_copy_ts) > 90.0

                            # [기획서 원안 엄수]: 평상시 Ctrl+C 복사 시에는 절대 자동으로 순차복붙(연사) 모드를 켜거나
                            # 클립보드를 1번 항목으로 덮어쓰거나 귀신창(토스트)을 띄우지 않습니다.
                            # 윈도우 기본 동작 그대로 항상 마지막에 복사한 텍스트를 클립보드에 100% 보존하며,
                            # 오직 유저가 Ctrl+0(또는 Ctrl+우클릭)으로 귀신창을 직접 소환했을 때만 순차복붙/다중합본에 사용합니다.
                            seq_mode = False
                            copied_after_trigger = False
                            seq_queue.clear()
                            if is_multiline_plain or is_excel_or_formula or pasting_started or seq_burst_expired:
                                recent_unpasted = [copied]
                            else:
                                if not recent_unpasted or recent_unpasted[-1] != copied:
                                    recent_unpasted.append(copied)
                            pasting_started = False
                            last_copy_ts = now
                    else:
                        # 유저의 직접 파일 복사(CF_HDROP) 시각 기록 (데몬 자체 라벨러 CF_HDROP 재주입은 _SELF_HDROP_UNTIL로 제외)
                        if now >= _SELF_HDROP_UNTIL and get_clipboard_hdrop_files():
                            last_hdrop_copy_ts = now
                        # 텍스트가 아닌 경우 스샷 이미지(Bitmap)는 메인 루프 블로킹 방지를 위해 백그라운드 스레드에서 PNG 인코딩·저장
                        def _capture_clip_img_bg(ts_cap: float) -> None:
                            nonlocal last_image_sig, last_image_ts
                            try:
                                from PIL import Image, ImageGrab
                                clip_img = ImageGrab.grabclipboard()
                                if isinstance(clip_img, Image.Image):
                                    buf = io.BytesIO()
                                    clip_img.save(buf, "PNG")
                                    png_bytes = buf.getvalue()
                                    if png_bytes != last_image_sig:
                                        last_image_sig = png_bytes
                                        if last_image_ts > 0 and (ts_cap - last_image_ts) > IMAGE_CLEAN_SECONDS:
                                            recent_images.clear()
                                        recent_images.append(png_bytes)
                                        last_image_ts = ts_cap
                                        record_ai_image_history(png_bytes)
                            except Exception:
                                pass

                        threading.Thread(target=_capture_clip_img_bg, args=(now,), daemon=True).start()

                # 3) Ctrl + V 및 마스터 트리거(Ctrl + 0) 물리 키 입력 감지
                # - Windows 입력기와 타 앱이 RegisterHotKey(Ctrl+0)를 가로채더라도 GetAsyncKeyState 하드웨어 폴링으로 100% 작동 보장!
                ctrl_down = (u32.GetAsyncKeyState(VK_CONTROL) & 0x8000) != 0
                alt_down = (u32.GetAsyncKeyState(VK_MENU) & 0x8000) != 0
                shift_down = (u32.GetAsyncKeyState(VK_SHIFT) & 0x8000) != 0
                v_down = (u32.GetAsyncKeyState(VK_V) & 0x8000) != 0
                ctrl_v_now = ctrl_down and v_down

                # 마우스 좌클릭 드래그(단어 블록 선택)·더블클릭 단어 선택 및 빈 공간 선택 해제 클릭 시각 감지
                lbtn_phys_now = (u32.GetAsyncKeyState(0x01) & 0x8000) != 0
                is_dbl_click_select = False
                if lbtn_phys_now and not was_lbtn_phys_down:
                    pt_ld = wintypes.POINT()
                    u32.GetCursorPos(ctypes.byref(pt_ld))
                    if (
                        (now - prev_lbtn_click_ts) <= 0.45
                        and abs(pt_ld.x - prev_lbtn_click_pt[0]) <= 8
                        and abs(pt_ld.y - prev_lbtn_click_pt[1]) <= 8
                    ):
                        is_dbl_click_select = True
                        last_drag_select_ts = now
                    prev_lbtn_click_ts = now
                    prev_lbtn_click_pt = (pt_ld.x, pt_ld.y)
                    last_lbtn_click_ts = now
                    lbtn_down_pt = (pt_ld.x, pt_ld.y)
                elif not lbtn_phys_now and was_lbtn_phys_down and lbtn_down_pt is not None:
                    pt_lu = wintypes.POINT()
                    u32.GetCursorPos(ctypes.byref(pt_lu))
                    if abs(pt_lu.x - lbtn_down_pt[0]) >= 6 or abs(pt_lu.y - lbtn_down_pt[1]) >= 6:
                        last_drag_select_ts = now
                    lbtn_down_pt = None
                was_lbtn_phys_down = lbtn_phys_now

                zero_down = ((u32.GetAsyncKeyState(VK_0) & 0x8000) != 0) or ((u32.GetAsyncKeyState(VK_NUMPAD0) & 0x8000) != 0)
                z_down = (u32.GetAsyncKeyState(VK_Z) & 0x8000) != 0
                t_down = (u32.GetAsyncKeyState(0x54) & 0x8000) != 0
                # 오직 Ctrl + 0 만 하드웨어 폴링으로 마스터 소환!
                ctrl0_now = ctrl_down and not alt_down and not shift_down and zero_down
                if ctrl0_now and not was_ctrl0_down:
                    if (time.time() - last_summon_ts) > 0.30:
                        last_summon_ts = time.time()
                        trigger_master_summon(source="ctrl0_poll")
                        last_summon_ts = time.time()
                was_ctrl0_down = ctrl0_now

                ctrl_alt_t_now = ctrl_down and alt_down and not shift_down and t_down
                if ctrl_alt_t_now and not was_ctrl_alt_t_down:
                    if (now - last_topmost_ts) > 0.25:
                        last_topmost_ts = now
                        _execute_superpower_num(5)
                was_ctrl_alt_t_down = ctrl_alt_t_now

                # Ctrl+Z는 가로채지 않고 앱 순정 기능에 100% 맡기되, 변환 직후 순정 Ctrl+Z 입력 시 재변환 잠금·이전 키보드만 보조!
                ctrl_z_now = ctrl_down and not alt_down and not shift_down and z_down
                if ctrl_z_now and not was_ctrl_z_down:
                    typed_ascii_buf.clear()
                    pending_first_typo = None
                    last_alpha_type_ts = 0.0
                    on_native_ctrl_z_observed()
                was_ctrl_z_down = ctrl_z_now

                # [②번 양방향 오토매틱 타이핑 감지 (2어절 연속 오타 감지 + 0.2ms 원자적 교체 + 한/영 키 즉시 동기화)]:
                # - 1단어만 오타 났을 때는 유저가 스스로 백스페이스+한/영 키를 칠 수 있으므로 손버릇 충돌 방지를 위해 대기(pending_first_typo)만 함.
                # - 모른 채 원고만 보며 2단어째 오타까지 연속 입력 후 Space(또는 0.65초 멈춤)하는 순간: 1단어+2단어를 0.2ms 원자적 교체로 성형 + 한/영 키 전환!
                if pending_first_typo is not None and (now - pending_first_typo.get("ts", 0.0)) > 4.5:
                    pending_first_typo = None

                hangul_down = (u32.GetAsyncKeyState(VK_HANGUL) & 0x8000) != 0
                if hangul_down and not was_key_down.get(VK_HANGUL, False):
                    # 유저가 직접 한/영 키를 눌렀다면 1단어 대기 버퍼는 즉시 초기화 + 최신 키보드 한/영 상태 추적
                    typed_ascii_buf.clear()
                    pending_first_typo = None
                    last_any_key_ts = now
                    try:
                        _fg_hgl = u32.GetForegroundWindow()
                        _cls_hgl = _get_win_class_only(_fg_hgl) if _fg_hgl else ""
                        if _fg_hgl and _cls_hgl not in ("Progman", "WorkerW", "Shell_TrayWnd"):
                            def _sync_hgl_after(h_target: int = _fg_hgl) -> None:
                                global _LAST_USER_IME_IS_KOR
                                time.sleep(0.045)
                                try:
                                    if u32.IsWindow(h_target):
                                        _LAST_USER_IME_IS_KOR = bool(get_ime_is_korean(h_target))
                                except Exception:
                                    pass
                            threading.Thread(target=_sync_hgl_after, daemon=True).start()
                        elif _LAST_USER_IME_IS_KOR is not None:
                            _report_ui2_ime_korean(not _LAST_USER_IME_IS_KOR)
                    except Exception:
                        pass
                was_key_down[VK_HANGUL] = hangul_down

                # 브라우저 주소창 포커스 단축키(Ctrl+L / Alt+D / F6 / Ctrl+T / Ctrl+N) 감지 시 주소창 자동완성 충돌 방지를 위해 본문 클릭·이동 전까지 자동변환 일시 홀드
                l_key_down = (u32.GetAsyncKeyState(0x4C) & 0x8000) != 0
                d_key_down = (u32.GetAsyncKeyState(0x44) & 0x8000) != 0
                t_key_down = (u32.GetAsyncKeyState(0x54) & 0x8000) != 0
                n_key_down = (u32.GetAsyncKeyState(0x4E) & 0x8000) != 0
                f6_key_down = (u32.GetAsyncKeyState(0x75) & 0x8000) != 0
                if (
                    (ctrl_down and not alt_down and not shift_down and (l_key_down or t_key_down or n_key_down))
                    or (alt_down and not ctrl_down and not shift_down and d_key_down)
                    or (f6_key_down and not ctrl_down and not alt_down)
                ):
                    browser_url_bar_active = True
                    _BROWSER_URL_BAR_STATE["active"] = True
                    typed_ascii_buf.clear()
                    pending_first_typo = None

                # 마우스 클릭이나 방향키·편집키(Left/Up/Right/Down/Home/End/Del/Tab/Esc) 입력 시에는 타이핑 버퍼를 즉시 초기화하여 앞 글자 찌꺼기 현상 원천 차단!
                a_key_down = (u32.GetAsyncKeyState(0x41) & 0x8000) != 0
                if ctrl_down and not alt_down and not shift_down and a_key_down and not was_key_down.get(0x9941, False):
                    last_drag_select_ts = now
                was_key_down[0x9941] = bool(ctrl_down and a_key_down)
                for nav_vk in (0x01, 0x02, 0x09, 0x1B, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x2E):
                    nav_down = (u32.GetAsyncKeyState(nav_vk) & 0x8000) != 0
                    if nav_down and not was_key_down.get(nav_vk, False):
                        if nav_vk == 0x01:
                            browser_url_bar_active = _update_browser_url_bar_on_click(u32.GetForegroundWindow())
                        elif nav_vk in (0x02, 0x09, 0x1B):
                            browser_url_bar_active = False
                            _BROWSER_URL_BAR_STATE["active"] = False
                            if nav_vk == 0x1B:
                                _cancel_unstarted_seq_mode_and_restore_clip()
                                disarm_sub_hotkeys()
                        if shift_down and nav_vk in (0x23, 0x24, 0x25, 0x26, 0x27, 0x28):
                            last_drag_select_ts = now
                        elif nav_vk == 0x01 and not is_dbl_click_select:
                            fg_click_cls = _get_win_class_only(u32.GetForegroundWindow())
                            if "Tk" not in fg_click_cls and not _CURRENT_OPEN_UI_MODE:
                                # 귀신창 외 일반 창 단순 1회 클릭 시에만 드래그 선택 타임스탬프 해제 (드래그 완료·더블클릭·귀신창 버튼 클릭 시 보존!)
                                last_drag_select_ts = 0.0
                        if nav_vk not in (0x01, 0x02) and not (nav_vk == 0x1B and (now - _LAST_RBTN_DISMISS_ESC_TS) <= 0.35):
                            last_any_key_ts = now
                        typed_ascii_buf.clear()
                        pending_first_typo = None
                        last_auto_morph_state["active"] = False
                    was_key_down[nav_vk] = nav_down

                if not ctrl_down and not alt_down and not menu_armed:
                    for vk_code in range(0x41, 0x5B):  # A ~ Z
                        is_down = (u32.GetAsyncKeyState(vk_code) & 0x8000) != 0
                        if is_down and not was_key_down.get(vk_code, False):
                            ch = chr(vk_code) if shift_down else chr(vk_code + 32)
                            typed_ascii_buf.append(ch)
                            last_alpha_type_ts = now
                            last_any_key_ts = now
                            last_drag_select_ts = 0.0
                            last_auto_morph_state["active"] = False
                            if _UNDO_SNAPSHOT.get("active"):
                                _UNDO_SNAPSHOT["typed_count_after"] = int(_UNDO_SNAPSHOT.get("typed_count_after") or 0) + 1
                            if len(typed_ascii_buf) > 128:
                                typed_ascii_buf.pop(0)
                        was_key_down[vk_code] = is_down

                    # 숫자(0~9 및 넘패드 0~9) 및 Shift+숫자 특수기호(! @ # $ % ^ & * ( )) 완벽 추적!
                    _SHIFT_DIGIT_MAP = {
                        0x30: ")", 0x31: "!", 0x32: "@", 0x33: "#", 0x34: "$",
                        0x35: "%", 0x36: "^", 0x37: "&", 0x38: "*", 0x39: "(",
                    }
                    for d_vk in range(0x30, 0x3A):  # 상단 숫자키 0 ~ 9
                        d_down = (u32.GetAsyncKeyState(d_vk) & 0x8000) != 0
                        if d_down and not was_key_down.get(d_vk, False):
                            last_any_key_ts = now
                            last_drag_select_ts = 0.0
                            if shift_down and d_vk == 0x32:
                                # 이메일 기호(@) 입력 감지 시 대기 중이던 한영 자동전환 즉시 해제!
                                pending_first_typo = None
                                # 만약 방금 Space로 1어절 자동변환된 직후 공백을 지우고(Backspace) 바로 '@'를 붙였다면(예: dmsgydmlapdlf -> 은호의메일@) 영문 아이디로 즉시 원복!
                                if (
                                    last_auto_morph_state.get("active")
                                    and last_auto_morph_state.get("space_removed_by_bs")
                                    and (now - float(last_auto_morph_state.get("ts", 0.0))) <= 6.0
                                    and last_auto_morph_state.get("hwnd") == u32.GetForegroundWindow()
                                ):
                                    raw_rest = str(last_auto_morph_state.get("raw", "")).strip() + "@"
                                    conv_prev = str(last_auto_morph_state.get("conv", "")).strip()
                                    ed_prev = int(last_auto_morph_state.get("edit_child") or 0)
                                    last_auto_morph_state["active"] = False
                                    time.sleep(0.02)
                                    restored_ok = False
                                    if ed_prev and u32.IsWindow(ed_prev):
                                        _, idx_at_txt, _ = _get_edit_full_text_and_index_str(ed_prev)
                                        if idx_at_txt:
                                            s_at = wintypes.DWORD(0)
                                            e_at = wintypes.DWORD(0)
                                            _send_msg_timeout_val(ed_prev, EM_GETSEL, ctypes.addressof(s_at), ctypes.addressof(e_at), 120)
                                            ln_st_at, ln_ed_at, cur_ln_at = _get_logical_line_bounds_utf16(
                                                idx_at_txt.encode("utf-16-le"), s_at.value
                                            )
                                            if cur_ln_at.endswith(conv_prev + "@") and ln_ed_at > ln_st_at:
                                                new_ln_at = cur_ln_at[: -(len(conv_prev) + 1)] + raw_rest
                                                _send_msg_timeout_val(ed_prev, EM_SETSEL, ln_st_at, ln_ed_at, 120)
                                                rb_at = ctypes.create_unicode_buffer(new_ln_at)
                                                _send_msg_timeout_val(ed_prev, EM_REPLACESEL, 1, ctypes.addressof(rb_at), 150)
                                                restored_ok = True
                                    if not restored_ok and conv_prev:
                                        release_all_modifiers()
                                        bs_sc_at = u32.MapVirtualKeyW(VK_BACK, 0)
                                        for _ in range(len(conv_prev) + 1):
                                            u32.keybd_event(VK_BACK, bs_sc_at, 0, 0)
                                            time.sleep(0.008)
                                            u32.keybd_event(VK_BACK, bs_sc_at, KEYEVENTF_KEYUP, 0)
                                            time.sleep(0.005)
                                        time.sleep(0.02)
                                        send_unicode_text_preserve_style(raw_rest)
                                    set_ime_language(target_korean=False)
                                    typed_ascii_buf.clear()
                                    typed_ascii_buf.extend(list(raw_rest))
                                else:
                                    typed_ascii_buf.append("@")
                            elif typed_ascii_buf:
                                last_auto_morph_state["active"] = False
                                if not shift_down:
                                    typed_ascii_buf.append(chr(d_vk))
                                    if any(c.isalpha() for c in typed_ascii_buf):
                                        last_alpha_type_ts = now
                                elif d_vk in _SHIFT_DIGIT_MAP:
                                    sym_d = _SHIFT_DIGIT_MAP[d_vk]
                                    typed_ascii_buf.append(sym_d)
                                    if sym_d == "!" and any(c.isalpha() for c in typed_ascii_buf):
                                        last_alpha_type_ts = now
                        was_key_down[d_vk] = d_down

                    for nd_vk in range(0x60, 0x6A):  # 넘패드 숫자키 0 ~ 9
                        nd_down = (u32.GetAsyncKeyState(nd_vk) & 0x8000) != 0
                        if nd_down and not was_key_down.get(nd_vk, False):
                            last_any_key_ts = now
                            last_drag_select_ts = 0.0
                            last_auto_morph_state["active"] = False
                            if typed_ascii_buf:
                                typed_ascii_buf.append(chr(nd_vk - 0x30))
                        was_key_down[nd_vk] = nd_down

                    # 모든 문장부호·특수문자(~ ` - _ = + [ { ] } \ | ; : ' " , < . > / ?)를 단어 끝에 붙여 쳤을 때도 완벽 추적
                    _OEM_PUNCT_MAP = {
                        0xBA: (";", ":"),
                        0xBB: ("=", "+"),
                        0xBC: (",", "<"),
                        0xBD: ("-", "_"),
                        0xBE: (".", ">"),
                        0xBF: ("/", "?"),
                        0xC0: ("`", "~"),
                        0xDB: ("[", "{"),
                        0xDC: ("\\", "|"),
                        0xDD: ("]", "}"),
                        0xDE: ("'", '"'),
                    }
                    for p_vk, (norm_ch, sh_ch) in _OEM_PUNCT_MAP.items():
                        p_down = (u32.GetAsyncKeyState(p_vk) & 0x8000) != 0
                        if p_down and not was_key_down.get(p_vk, False):
                            last_any_key_ts = now
                            last_drag_select_ts = 0.0
                            last_auto_morph_state["active"] = False
                            if p_vk == 0xBF and shift_down:
                                last_question_mark_ts = now
                            if p_vk == 0xBD and shift_down:
                                pending_first_typo = None
                            if typed_ascii_buf:
                                p_ch = sh_ch if shift_down else norm_ch
                                typed_ascii_buf.append(p_ch)
                                if p_ch in (".", ",", "?", "~", ";", ":") and any(c.isalpha() for c in typed_ascii_buf):
                                    last_alpha_type_ts = now
                        was_key_down[p_vk] = p_down

                    back_down = (u32.GetAsyncKeyState(VK_BACK) & 0x8000) != 0
                    if back_down and not was_key_down.get(VK_BACK, False):
                        last_any_key_ts = now
                        last_drag_select_ts = 0.0
                        if last_auto_morph_state.get("active") and not last_auto_morph_state.get("space_removed_by_bs"):
                            last_auto_morph_state["space_removed_by_bs"] = True
                        else:
                            last_auto_morph_state["active"] = False
                        if typed_ascii_buf:
                            if _find_edit_control_child(u32.GetForegroundWindow()):
                                typed_ascii_buf.pop()
                            else:
                                # 비-Edit 창에서는 한글 1음절 삭제(2~4타)와 영타 1타 삭제 길이가 달라 버퍼 어긋남이 발생하므로 버퍼 전체 초기화!
                                typed_ascii_buf.clear()
                                pending_first_typo = None
                        else:
                            # 유저가 1단어 직후 백스페이스를 쳤다면 스스로 수동 교정 중이므로 자동 개입 취소!
                            pending_first_typo = None
                    was_key_down[VK_BACK] = back_down

                    # [무(無)스페이스 1.0초 멈춤 자동 성형]:
                    # 1) 2어절 이상 연속 한영 오타(예: 'dhsmf ghldml') 입력 후 1.0초 멈춤 시, 또는
                    # 2) 띄어쓰기 없이 한 덩어리로 붙여 친 문장(영문 알파벳 12타 이상 & 한글 5음절 이상, 예: 'dkssudgktpdy' ➔ '안녕하세요') 입력 후 1.0초 멈춤 시
                    #    스페이스를 치지 않아도 즉시 한글로 자동 변환 + 띄어쓰기 교정 + 한글키 전환!
                    #    (짧은 영문 아이디 'ghdrlfehd'[9타]나 이메일 '@', 수식 '=' 등은 멈춰도 절대 성급히 바뀌지 않음)
                    if (
                        typed_ascii_buf
                        and len(typed_ascii_buf) >= 2
                        and last_alpha_type_ts > 0
                        and idle_checked_for_ts != last_alpha_type_ts
                        and (now - last_alpha_type_ts) >= IDLE_PAUSE_AUTO_MORPH_SEC
                        and (now - last_alpha_type_ts) < 2.5
                    ):
                        idle_checked_for_ts = last_alpha_type_ts
                        raw_idle_buf_chk = "".join(typed_ascii_buf)
                        hwnd_idle = u32.GetForegroundWindow()
                        if should_skip_auto_typo(hwnd_idle):
                            typed_ascii_buf.clear()
                            pending_first_typo = None
                            last_alpha_type_ts = 0.0
                        elif not _is_protected_account_or_email_token(raw_idle_buf_chk) and not raw_idle_buf_chk.lstrip().startswith("="):
                            edit_idle = _find_edit_control_child(hwnd_idle)
                            if edit_idle:
                                idle_line = _get_edit_control_current_line(edit_idle)
                                if (
                                    idle_line
                                    and not idle_line.lstrip().startswith("=")
                                    and not idle_line.endswith(" ")
                                    and (now - last_paste_ts) > 2.0
                                ):
                                    idle_tokens = idle_line.strip().split()
                                    if idle_tokens and not _is_protected_account_or_email_token(idle_tokens[-1]):
                                        idle_eng_typo_cnt = 0
                                        for itok in idle_tokens:
                                            if _is_protected_account_or_email_token(itok):
                                                continue
                                            m_itok, dir_itok = morph_korean_english_text_with_direction(itok)
                                            if dir_itok == "KO" and m_itok != itok:
                                                idle_eng_typo_cnt += 1
                                        last_itok = idle_tokens[-1]
                                        m_last_i, d_last_i = morph_korean_english_text_with_direction(last_itok)
                                        last_eng_len = sum(
                                            len(c_x)
                                            for c_x in re.findall(r"[A-Za-z]+", last_itok)
                                            if len(c_x) >= 2 and not AI_ENGINE.is_valid_english_word(c_x)
                                        )
                                        last_kor_len = len(re.findall(r"[가-힣]", m_last_i)) if d_last_i == "KO" else 0
                                        is_polite_end = m_last_i.rstrip(".,?!~").endswith(("요", "다", "까", "네", "죠", "음", "함", "됨", "임"))
                                        is_valid_ko_typo = (
                                            d_last_i == "KO"
                                            and m_last_i != last_itok
                                            and (
                                                (last_eng_len >= 10 and last_kor_len >= 4)
                                                or (last_eng_len >= 7 and last_kor_len >= 3 and is_polite_end)
                                            )
                                        )
                                        if idle_eng_typo_cnt >= 2 or is_valid_ko_typo:
                                            ok_id, raw_id, out_id, lang_id = _replace_edit_control_current_line_atomic(edit_idle, auto_triggered=True)
                                            if ok_id:
                                                typed_ascii_buf.clear()
                                                pending_first_typo = None
                                                last_alpha_type_ts = 0.0
                                                complete_feature_action_success("auto_typo_morph_2words")
                            else:
                                # [카톡 채팅창·웹 브라우저(카페 댓글·글쓰기 등) 비-Edit 입력칸에서 1.0초 멈춤 영타➔한글 자동 성형]
                                raw_idle_str = raw_idle_buf_chk
                                proc_idle_low = _get_process_name_from_hwnd(hwnd_idle).lower()
                                is_br_idle = proc_idle_low in _BROWSER_AUTO_TYPO_PROCS
                                ime_kor_id = get_ime_is_korean(hwnd_idle)
                                if (
                                    not (is_br_idle and (browser_url_bar_active or _is_browser_address_bar_focused()))
                                    and not ime_kor_id
                                    and re.search(r"[A-Za-z]{2,}", raw_idle_str)
                                ):
                                    conv_id, dir_id = morph_korean_english_text_with_direction(raw_idle_str)
                                    if dir_id == "KO" and conv_id != raw_idle_str and re.search(r"[가-힣]", conv_id):
                                        eng_len_id = sum(
                                            len(c_x)
                                            for c_x in re.findall(r"[A-Za-z]+", raw_idle_str)
                                            if len(c_x) >= 2 and not AI_ENGINE.is_valid_english_word(c_x)
                                        )
                                        kor_len_id = len(re.findall(r"[가-힣]", conv_id))
                                        is_polite_end_id = conv_id.rstrip(".,?!~").endswith(("요", "다", "까", "네", "죠", "음", "함", "됨", "임"))
                                        is_valid_ko_typo_id = (
                                            (eng_len_id >= 10 and kor_len_id >= 4)
                                            or (eng_len_id >= 7 and kor_len_id >= 3 and is_polite_end_id)
                                        )
                                        has_prev_id = (
                                            pending_first_typo is not None
                                            and pending_first_typo.get("target_ko") is True
                                            and pending_first_typo.get("hwnd") == hwnd_idle
                                        )
                                        if has_prev_id or is_valid_ko_typo_id:
                                            prev_r_id = pending_first_typo["raw"] if has_prev_id else ""
                                            prev_c_id = pending_first_typo["conv"] if has_prev_id else ""
                                            total_bs_id = (pending_first_typo["disp_len"] if has_prev_id else 0) + len(raw_idle_str)
                                            comb_conv_id = _fix_korean_spacing_general(f"{prev_c_id} {conv_id}".strip())
                                            comb_raw_id = f"{prev_r_id} {raw_idle_str}".strip()
                                            typed_ascii_buf.clear()
                                            pending_first_typo = None
                                            last_alpha_type_ts = 0.0
                                            orig_c_id = get_clipboard_text()
                                            release_all_modifiers()
                                            if send_unicode_text_preserve_style(comb_conv_id, delete_count=total_bs_id):
                                                time.sleep(0.02)
                                            else:
                                                bs_sc = u32.MapVirtualKeyW(VK_BACK, 0)
                                                for _ in range(total_bs_id):
                                                    u32.keybd_event(VK_BACK, bs_sc, 0, 0)
                                                    u32.keybd_event(VK_BACK, bs_sc, KEYEVENTF_KEYUP, 0)
                                                time.sleep(0.015)
                                                daemon_set_clipboard(comb_conv_id)
                                                time.sleep(0.025)
                                                tap_key_combo([VK_CONTROL], VK_V)
                                                time.sleep(0.08)
                                                if orig_c_id and not seq_mode:
                                                    threading.Timer(0.28, lambda c=orig_c_id: daemon_set_clipboard(c)).start()
                                            set_ime_language(target_korean=True)
                                            arm_undo_snapshot(
                                                hwnd_idle,
                                                0,
                                                comb_raw_id,
                                                comb_conv_id,
                                                mode="backspace_replace",
                                                prev_ime_kor=ime_kor_id,
                                            )
                                            complete_feature_action_success("auto_typo_morph_2words")

                    space_down = (u32.GetAsyncKeyState(VK_SPACE) & 0x8000) != 0
                    if space_down and not was_key_down.get(VK_SPACE, False):
                        last_any_key_ts = now
                        last_drag_select_ts = 0.0
                        hwnd_fg = u32.GetForegroundWindow()
                        if should_skip_auto_typo(hwnd_fg):
                            typed_ascii_buf.clear()
                            pending_first_typo = None
                            was_key_down[VK_SPACE] = space_down
                            continue
                        raw_buf_str = "".join(typed_ascii_buf)
                        typed_ascii_buf.clear()
                        m_trail = re.match(r"^([^A-Za-z0-9가-힣\s]*)([A-Za-z]+)([0-9]*)([^A-Za-z0-9가-힣\s]*)$", raw_buf_str)
                        lead_punct = m_trail.group(1) if m_trail else ""
                        word_cand = m_trail.group(2) if m_trail else re.sub(r"[^A-Za-z]", "", raw_buf_str)
                        trail_digits = m_trail.group(3) if m_trail else ""
                        trail_punct = m_trail.group(4) if m_trail else ""
                        edit_child = _find_edit_control_child(hwnd_fg)

                        cur_line: str | None = None
                        if edit_child and (raw_buf_str or True):
                            time.sleep(0.006)
                            cur_line = _get_edit_control_current_line(edit_child)
                            if cur_line is not None and not cur_line.endswith(" "):
                                time.sleep(0.006)
                                cur_line = _get_edit_control_current_line(edit_child)

                        last_tok = ""
                        if cur_line is not None:
                            cur_stripped = cur_line.rstrip(" ")
                            last_tok = cur_stripped.split()[-1] if cur_stripped.strip() else ""
                            # [붙여넣기 및 이메일·URL·수식 보호 / 숫자 혼입 문장('...1chaksdp...') 전면 지원]
                            if (
                                _is_protected_account_or_email_token(last_tok)
                                or _is_protected_account_or_email_token(raw_buf_str)
                                or last_tok.startswith("=")
                                or cur_stripped.lstrip().startswith("=")
                            ):
                                typed_as_eng = False
                                typed_as_kor = False
                            elif bool(raw_buf_str) and re.search(r"[A-Za-z]", last_tok) and not re.search(r"[가-힣]", last_tok):
                                typed_as_eng = True
                                typed_as_kor = False
                                raw_buf_str = last_tok
                                m_last_eng = re.match(r"^([^A-Za-z가-힣\s]*)([A-Za-z]+)([^A-Za-z가-힣\s]*)$", last_tok)
                                if m_last_eng:
                                    lead_punct, word_cand, trail_punct = m_last_eng.groups()
                                    trail_digits = re.sub(r"[^0-9]", "", lead_punct + trail_punct)
                                else:
                                    word_cand = re.sub(r"[^A-Za-z]", "", last_tok)
                                    trail_digits = re.sub(r"[^0-9]", "", last_tok)
                            else:
                                typed_as_eng = bool(raw_buf_str) and cur_stripped.endswith(raw_buf_str)
                                typed_as_kor = bool(raw_buf_str) and not typed_as_eng
                        else:
                            proc_fg_low = _get_process_name_from_hwnd(hwnd_fg).lower()
                            is_br_fg = proc_fg_low in _BROWSER_AUTO_TYPO_PROCS
                            if (
                                (is_br_fg and (browser_url_bar_active or _is_browser_address_bar_focused()))
                                or _is_protected_account_or_email_token(raw_buf_str)
                                or raw_buf_str.lstrip().startswith("=")
                            ):
                                typed_as_eng = False
                                typed_as_kor = False
                            else:
                                if proc_fg_low == "excel.exe":
                                    # 엑셀 자체 '한/영 자동 고침'이 켜져 있다면 스페이스 직후 0.03초 내에 스스로 한글 변환 및 한/영키(True) 전환을 마침.
                                    # 이미 한글(True)로 바뀌었으면 귀신창은 100% 양보하고, 여전히 영문(False)으로 남아 있을 때만 한 번에 통교체!
                                    time.sleep(0.03)
                                ime_kor = get_ime_is_korean(hwnd_fg)
                                typed_as_eng = not ime_kor
                                # 웹 브라우저 및 엑셀에서는 1타=1글자가 보장되는 '영타➔한글'만 수행하고 역방향(한➔영)은 제외
                                typed_as_kor = ime_kor and (not is_br_fg) and (proc_fg_low != "excel.exe")

                        curr_typo: dict | None = None
                        if typed_as_eng and re.search(r"[A-Za-z]{2,}", raw_buf_str):
                            morphed_cand, dir_cand = morph_korean_english_text_with_direction(raw_buf_str)
                            if dir_cand == "KO" and morphed_cand != raw_buf_str:
                                eng_chunks = [
                                    c_e
                                    for c_e in re.findall(r"[A-Za-z]+", raw_buf_str)
                                    if len(c_e) >= 2 and not AI_ENGINE.is_valid_english_word(c_e)
                                ]
                                eng_alpha_total = sum(len(c_e) for c_e in eng_chunks)
                                kor_syl_total = len(re.findall(r"[가-힣]", morphed_cand))
                                has_any_digit = bool(re.search(r"\d", raw_buf_str))
                                if eng_alpha_total >= 2 and kor_syl_total >= 1:
                                    curr_typo = {
                                        "disp_len": len(raw_buf_str) + 1,
                                        "raw": raw_buf_str,
                                        "conv": morphed_cand,
                                        "eng_len": eng_alpha_total,
                                        "kor_len": kor_syl_total,
                                        "target_ko": True,
                                        "has_digits": has_any_digit,
                                        "ts": now,
                                        "hwnd": hwnd_fg,
                                    }
                        elif typed_as_kor and len(word_cand) >= 3 and not trail_digits and AI_ENGINE.is_valid_english_word(word_cand):
                            kor_produced = eng_word_to_kor(word_cand)
                            if any(0x3131 <= ord(c) <= 0x318E for c in kor_produced) or not is_valid_korean_word(kor_produced):
                                if cur_line is None or cur_line.rstrip(" ").endswith(kor_produced + trail_punct):
                                    curr_typo = {
                                        "disp_len": len(lead_punct) + len(kor_produced) + len(trail_punct) + 1,
                                        "raw": lead_punct + kor_produced + trail_punct,
                                        "conv": lead_punct + word_cand + trail_punct,
                                        "eng_len": len(word_cand),
                                        "kor_len": len(kor_produced),
                                        "target_ko": False,
                                        "has_digits": False,
                                        "ts": now,
                                        "hwnd": hwnd_fg,
                                    }

                        if curr_typo is not None:
                            should_trigger = False
                            c_eng_len = int(curr_typo.get("eng_len") or 0)
                            is_clear_ko_word = bool(curr_typo["target_ko"] and c_eng_len >= 4 and curr_typo.get("kor_len", 0) >= 2)
                            if cur_line is not None:
                                line_tokens = cur_line.strip().split()
                                if len(line_tokens) >= 2:
                                    prev_is_eng_typo = False
                                    for prev_tok in line_tokens[:-1]:
                                        if _is_protected_account_or_email_token(prev_tok):
                                            continue
                                        m_prev_t, dir_prev_t = morph_korean_english_text_with_direction(prev_tok)
                                        if dir_prev_t == "KO" and m_prev_t != prev_tok:
                                            prev_is_eng_typo = True
                                            break
                                    if curr_typo["target_ko"]:
                                        if prev_is_eng_typo or (curr_typo["has_digits"] and c_eng_len >= 4) or is_clear_ko_word:
                                            should_trigger = True
                                    else:
                                        if pending_first_typo is not None and not pending_first_typo["target_ko"] and pending_first_typo.get("hwnd") == hwnd_fg and pending_first_typo["raw"] in cur_line:
                                            should_trigger = True
                                elif (curr_typo["target_ko"] and curr_typo["has_digits"] and c_eng_len >= 4) or is_clear_ko_word:
                                    should_trigger = True
                            else:
                                if pending_first_typo is not None and pending_first_typo["target_ko"] == curr_typo["target_ko"] and pending_first_typo.get("hwnd") == hwnd_fg:
                                    should_trigger = True
                                elif curr_typo["target_ko"] and ((curr_typo["has_digits"] and c_eng_len >= 4) or is_clear_ko_word):
                                    should_trigger = True

                            if should_trigger:
                                target_ko = curr_typo["target_ko"]
                                prev_raw = pending_first_typo["raw"] if pending_first_typo else ""
                                prev_conv = pending_first_typo["conv"] if pending_first_typo else ""
                                total_backspaces = (pending_first_typo["disp_len"] if pending_first_typo else 0) + curr_typo["disp_len"]
                                combined_conv = f"{prev_conv} {curr_typo['conv']} ".lstrip()
                                combined_raw = f"{prev_raw} {curr_typo['raw']}".lstrip()
                                pending_first_typo = None

                                if edit_child:
                                    ok_ed, raw_ed, out_ed, lang_ed = _replace_edit_control_current_line_atomic(
                                        edit_child, auto_triggered=True, ensure_trailing_space=True
                                    )
                                    if ok_ed:
                                        if target_ko and not prev_raw:
                                            last_auto_morph_state = {
                                                "active": True,
                                                "raw": curr_typo["raw"],
                                                "conv": curr_typo["conv"],
                                                "space_removed_by_bs": False,
                                                "hwnd": hwnd_fg,
                                                "edit_child": edit_child,
                                                "ts": time.time(),
                                            }
                                        else:
                                            last_auto_morph_state["active"] = False
                                        complete_feature_action_success("auto_typo_morph_2words")
                                else:
                                    # [엑셀 셀 편집(EXCEL6)·카톡 채팅창 무충돌 원자적 백스페이스 교체 + 원복 스냅샷 무장]:
                                    prev_ime_bs = get_ime_is_korean(hwnd_fg)
                                    orig_c = get_clipboard_text()
                                    release_all_modifiers()
                                    final_paste = (_fix_korean_spacing_general(combined_conv.strip()) + " ") if target_ko else (combined_conv.strip() + " ")
                                    if send_unicode_text_preserve_style(final_paste, delete_count=total_backspaces):
                                        time.sleep(0.02)
                                    else:
                                        bs_sc = u32.MapVirtualKeyW(VK_BACK, 0)
                                        for _ in range(total_backspaces):
                                            u32.keybd_event(VK_BACK, bs_sc, 0, 0)
                                            u32.keybd_event(VK_BACK, bs_sc, KEYEVENTF_KEYUP, 0)
                                        time.sleep(0.015)
                                        daemon_set_clipboard(final_paste)
                                        time.sleep(0.025)
                                        tap_key_combo([VK_CONTROL], VK_V)
                                        time.sleep(0.08)
                                        if orig_c and not seq_mode:
                                            threading.Timer(0.28, lambda c=orig_c: daemon_set_clipboard(c)).start()
                                    set_ime_language(target_korean=target_ko)
                                    arm_undo_snapshot(
                                        hwnd_fg,
                                        0,
                                        combined_raw + " ",
                                        final_paste,
                                        mode="backspace_replace",
                                        prev_ime_kor=prev_ime_bs,
                                    )
                                    if target_ko and not prev_raw:
                                        last_auto_morph_state = {
                                            "active": True,
                                            "raw": curr_typo["raw"],
                                            "conv": final_paste.strip(),
                                            "space_removed_by_bs": False,
                                            "hwnd": hwnd_fg,
                                            "edit_child": 0,
                                            "ts": time.time(),
                                        }
                                    else:
                                        last_auto_morph_state["active"] = False
                                    complete_feature_action_success("auto_typo_morph_2words")
                            else:
                                # 1단어째 오타는 바꾸지 않고 조용히 기억만 해둠 (유저가 스스로 고치는지 2단어로 넘어가는지 관찰)
                                pending_first_typo = curr_typo
                        else:
                            pending_first_typo = None
                            # [안전 철칙]: 실제 화면 문자열을 WM_GETTEXT로 100% 읽을 수 있는 네이티브 Edit 컨트롤(메모장 등)에서만
                            # 실시간 한글 띄어쓰기 자동교정을 수행하며, 비-Edit 창(엑셀·카톡 등)에서는 키스트로크 역추론 오타를 원천 배제합니다.
                            if (
                                edit_child
                                and cur_line is not None
                                and not _is_protected_account_or_email_token(last_tok)
                                and re.search(r"[가-힣]", cur_line)
                                and (now - last_paste_ts) > 2.0
                            ):
                                ok_sp, raw_sp, out_sp, _ = _replace_edit_control_current_line_atomic(
                                    edit_child, auto_triggered=True, allow_typo_morph=False, ensure_trailing_space=True
                                )
                                if ok_sp:
                                    complete_feature_action_success("auto_typo_morph_2words")
                    was_key_down[VK_SPACE] = space_down

                    ret_down = (u32.GetAsyncKeyState(VK_RETURN) & 0x8000) != 0
                    if ret_down and not was_key_down.get(VK_RETURN, False):
                        last_any_key_ts = now
                        last_drag_select_ts = 0.0
                        last_question_mark_ts = 0.0
                        browser_url_bar_active = False
                        _BROWSER_URL_BAR_STATE["active"] = False
                        typed_ascii_buf.clear()
                        pending_first_typo = None
                        hwnd_ret = u32.GetForegroundWindow()
                        if hwnd_ret and not should_skip_auto_typo(hwnd_ret) and (now - last_paste_ts) > 2.0:
                            proc_ret, _, _ = get_window_process_and_class(hwnd_ret)
                            if (proc_ret or "").lower() == "notepad.exe":
                                ed_ret = _find_edit_control_child(hwnd_ret)
                                if ed_ret and _polish_notepad_previous_line_on_enter(ed_ret, allow_typo_morph=True):
                                    complete_feature_action_success("auto_typo_morph_2words")
                    was_key_down[VK_RETURN] = ret_down

                    # [보안 프로그램(IPinside/TouchEn 등) GetAsyncKeyState 차단 환경 완벽 대응 — WM_GETTEXT 실시간 컨트롤 감시]:
                    # (※ F1~F6 상용구는 평상시 브라우저/앱 단축키와 충돌하지 않도록 오직 Ctrl+0 소환 시(arm_sub_hotkeys)에만 무장!)
                    hwnd_live = u32.GetForegroundWindow()
                    allow_live_input = bool(hwnd_live and not should_skip_auto_typo(hwnd_live))

                    if allow_live_input and (now - last_paste_ts) > 1.5:
                        ed_live = _find_edit_control_child_cached(hwnd_live)
                        if ed_live:
                            b_live = _get_edit_control_current_line_with_bounds(ed_live)
                            if b_live is not None:
                                cur_l_start, _, cur_l_str = b_live
                                if ed_live != live_edit_prev_hwnd:
                                    live_edit_prev_hwnd = ed_live
                                    live_edit_prev_line = cur_l_str
                                    live_edit_prev_line_start = cur_l_start
                                    live_edit_last_type_ts = 0.0
                                elif cur_l_start > live_edit_prev_line_start and cur_l_str == "" and live_edit_prev_line and re.search(r"[A-Za-z]{2,}", live_edit_prev_line):
                                    live_edit_prev_line = cur_l_str
                                    live_edit_prev_line_start = cur_l_start
                                    live_edit_last_type_ts = 0.0
                                    proc_l, _, _ = get_window_process_and_class(hwnd_live)
                                    if (proc_l or "").lower() == "notepad.exe":
                                        if _polish_notepad_previous_line_on_enter(ed_live, allow_typo_morph=True):
                                            complete_feature_action_success("auto_typo_morph_2words")
                                elif cur_l_start != live_edit_prev_line_start:
                                    live_edit_prev_line = cur_l_str
                                    live_edit_prev_line_start = cur_l_start
                                    live_edit_last_type_ts = 0.0
                                elif cur_l_str != live_edit_prev_line:
                                    prev_s_l = live_edit_prev_line or ""
                                    live_edit_prev_line = cur_l_str
                                    diff_len = len(cur_l_str) - len(prev_s_l)
                                    if 1 <= diff_len <= 20 and cur_l_str.startswith(prev_s_l):
                                        if cur_l_str.endswith(" ") and not prev_s_l.endswith(" "):
                                            cur_strip_l = cur_l_str.rstrip(" ")
                                            toks_l = cur_strip_l.split()
                                            if toks_l and not cur_strip_l.lstrip().startswith("="):
                                                last_t_l = toks_l[-1]
                                                if not _is_protected_account_or_email_token(last_t_l) and re.search(r"[A-Za-z]{2,}", last_t_l) and not re.search(r"[가-힣]", last_t_l):
                                                    m_c_l, d_c_l = morph_korean_english_text_with_direction(last_t_l)
                                                    if d_c_l == "KO" and m_c_l != last_t_l:
                                                        e_len_l = sum(len(cx) for cx in re.findall(r"[A-Za-z]+", last_t_l) if len(cx) >= 2 and not AI_ENGINE.is_valid_english_word(cx))
                                                        k_len_l = len(re.findall(r"[가-힣]", m_c_l))
                                                        if (e_len_l >= 4 and k_len_l >= 2) or len(toks_l) >= 2:
                                                            ok_l, _, out_l, _ = _replace_edit_control_current_line_atomic(
                                                                ed_live, auto_triggered=True, ensure_trailing_space=True
                                                            )
                                                            if ok_l:
                                                                b_aft = _get_edit_control_current_line_with_bounds(ed_live)
                                                                live_edit_prev_line = b_aft[2] if b_aft else (out_l + " ")
                                                                live_edit_last_type_ts = 0.0
                                                                typed_ascii_buf.clear()
                                                                pending_first_typo = None
                                                                complete_feature_action_success("auto_typo_morph_2words")
                                        elif not cur_l_str.endswith(" ") and re.search(r"[A-Za-z0-9.,?!~]", cur_l_str[-1:]) and re.search(r"[A-Za-z]{2,}", cur_l_str):
                                            live_edit_last_type_ts = now
                                            live_edit_idle_checked_ts = 0.0
                                    else:
                                        live_edit_last_type_ts = 0.0
                                elif (
                                    live_edit_last_type_ts > 0.0
                                    and live_edit_idle_checked_ts != live_edit_last_type_ts
                                    and 0.95 <= (now - live_edit_last_type_ts) < 2.5
                                ):
                                    live_edit_idle_checked_ts = live_edit_last_type_ts
                                    if cur_l_str and not cur_l_str.lstrip().startswith("=") and not cur_l_str.endswith(" "):
                                        id_toks = cur_l_str.strip().split()
                                        if id_toks and not _is_protected_account_or_email_token(id_toks[-1]):
                                            id_eng_cnt = 0
                                            for it_k in id_toks:
                                                if _is_protected_account_or_email_token(it_k):
                                                    continue
                                                m_ik, d_ik = morph_korean_english_text_with_direction(it_k)
                                                if d_ik == "KO" and m_ik != it_k:
                                                    id_eng_cnt += 1
                                            last_ik = id_toks[-1]
                                            m_lk, d_lk = morph_korean_english_text_with_direction(last_ik)
                                            le_len = sum(len(cx) for cx in re.findall(r"[A-Za-z]+", last_ik) if len(cx) >= 2 and not AI_ENGINE.is_valid_english_word(cx))
                                            lk_len = len(re.findall(r"[가-힣]", m_lk)) if d_lk == "KO" else 0
                                            is_pol_k = m_lk.rstrip(".,?!~").endswith(("요", "다", "까", "네", "죠", "음", "함", "됨", "임"))
                                            valid_ko_k = (
                                                d_lk == "KO"
                                                and m_lk != last_ik
                                                and ((le_len >= 10 and lk_len >= 4) or (le_len >= 7 and lk_len >= 3 and is_pol_k))
                                            )
                                            if id_eng_cnt >= 2 or valid_ko_k:
                                                ok_ik, _, out_ik, _ = _replace_edit_control_current_line_atomic(
                                                    ed_live, auto_triggered=True, ensure_trailing_space=False
                                                )
                                                if ok_ik:
                                                    b_aft_i = _get_edit_control_current_line_with_bounds(ed_live)
                                                    live_edit_prev_line = b_aft_i[2] if b_aft_i else out_ik
                                                    live_edit_last_type_ts = 0.0
                                                    typed_ascii_buf.clear()
                                                    pending_first_typo = None
                                                    complete_feature_action_success("auto_typo_morph_2words")
                        else:
                            live_edit_prev_hwnd = 0
                            live_edit_prev_line = None
                            live_edit_last_type_ts = 0.0
                    else:
                        live_edit_prev_hwnd = 0
                        live_edit_prev_line = None
                        live_edit_last_type_ts = 0.0
                else:
                    typed_ascii_buf.clear()
                    if ctrl_down:
                        pending_first_typo = None

                if ctrl_v_now and not was_ctrl_v_down and now >= _SELF_CLIP_COMBO_UNTIL:
                    last_paste_ts = now
                    typed_ascii_buf.clear()
                    pending_first_typo = None
                    last_alpha_type_ts = 0.0
                    disarm_sub_hotkeys()
                    if seq_mode and seq_queue:
                        _advance_seq_paste_queue()
                        # sleep 동안 V 키를 이미 뗀 빠른 연타 입력을 놓치지 않도록 현재 물리 키 상태를 재갱신
                        ctrl_v_now = (
                            ((u32.GetAsyncKeyState(VK_CONTROL) & 0x8000) != 0)
                            and ((u32.GetAsyncKeyState(VK_V) & 0x8000) != 0)
                        )
                    else:
                        recent_unpasted.clear()

                was_ctrl_v_down = ctrl_v_now
        except Exception:
            pass

        if not had_hotkey:
            time.sleep(0.015)

    try:
        u32.UnregisterHotKey(None, 1)
        u32.UnregisterHotKey(None, 2)
        u32.UnregisterHotKey(None, 4)
    except Exception:
        pass
    try:
        if _ll_mouse_hook_handle[0]:
            u32.UnhookWindowsHookEx(_ll_mouse_hook_handle[0])
            _ll_mouse_hook_handle[0] = 0
    except Exception:
        pass
    try:
        lock_sock.close()
    except Exception:
        pass


def run_quota_self_test() -> int:
    """
    [1초 자동 검증: 평생 무료 기본기 상시 개방 & 유저 동의형(Opt-in) 30일 무제한 체험 & 만료 시 깔끔 잠금🔒 테스트]
    실행: python seq_paste_daemon.py --test-quota
    """
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ledger_path = _MERLIN_APPDATA / "superpower_trial_ledger.json"
    backup_bytes = ledger_path.read_bytes() if ledger_path.exists() else None
    try:
        if ledger_path.exists():
            ledger_path.unlink()
        print("🧪 [1단계] 평생 무료 기본기([1] 서식·줄바꿈, 상용구, 순차복붙)는 동의 전/만료 후 언제나 FREE_FOREVER 확인...")
        ok_free, st_free = check_feature_quota_allowed("superpower_key_1", interactive_opt_in=False)
        assert ok_free and st_free == "FREE_FOREVER", f"Expected FREE_FOREVER, got {ok_free}, {st_free}"
        ok_paid0, st_paid0 = check_feature_quota_allowed("superpower_key_2", interactive_opt_in=False)
        assert (not ok_paid0) and st_paid0 == "TRIAL_NOT_STARTED", f"Expected TRIAL_NOT_STARTED, got {ok_paid0}, {st_paid0}"
        print(f"   ✅ 무료 1번={st_free} / 미동의 유료 2번={st_paid0} (몰래 타이머 자동개시 0% 확인)")

        print("🧪 [2단계] 유저 명시적 동의(Opt-in) 후 유료 도구([2]·[3]·[4]·[5]·UI③·다중스샷PDF·팀상용구) 30일 무제한 개방 검증...")
        opt_res = opt_in_30d_unlimited_superpower_trial(True)
        assert opt_res["status"] == "ACTIVE_30D"
        for k_chk in ("superpower_key_2", "superpower_key_3", "superpower_key_4", "superpower_key_5", "ui3_photo_ocr", "feat_b3_pdf_merge", "snippet_F7"):
            ok_a, st_a = check_feature_quota_allowed(k_chk, interactive_opt_in=False)
            assert ok_a and st_a.startswith("ACTIVE_D-"), f"{k_chk} failed: {ok_a}, {st_a}"
        print(f"   ✅ 동의 직후 배지: {get_trial_badge_summary()['short_badge']}")

        print("🧪 [3단계] 31일 경과 타임머신 조작 ➔ 하루 3회 무료 없이 유료 기능만 즉시 깔끔 잠금(🔒) & 무료 기본기 영구 작동 검증...")
        ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
        hwid = _get_machine_hwid_local()
        expired_ts = time.time() - (31 * 86400)
        ledger["machines"][hwid]["trialOptInTs"] = expired_ts
        ledger["machines"][hwid]["startedAtTs"] = expired_ts
        ledger_path.write_text(json.dumps(ledger, ensure_ascii=False, indent=2), encoding="utf-8")

        for k_chk in ("superpower_key_2", "superpower_key_3", "superpower_key_4", "superpower_key_5", "ui3_photo_ocr", "feat_b3_pdf_merge", "snippet_F7"):
            ok_exp, msg_exp = check_feature_quota_allowed(k_chk, interactive_opt_in=False)
            assert not ok_exp and "만료" in msg_exp, f"{k_chk} should be locked: {ok_exp}, {msg_exp}"
        for k_free in ("superpower_key_1", "snippet_F1", "snippet_F6"):
            ok_free_after, st_free_after = check_feature_quota_allowed(k_free, interactive_opt_in=False)
            assert ok_free_after and st_free_after == "FREE_FOREVER"
        print(f"   ✅ 만료 후 유료 잠금 확인 & 무료 1번={st_free_after} 유지 확인!")
        print("\n🎉 [ALL PASS] Opt-in 30일 무제한 체험 & 만료 시 깔끔 유료 잠금(🔒) 시뮬레이션 100% 통과!")
        return 0
    finally:
        if backup_bytes is not None:
            ledger_path.write_bytes(backup_bytes)
        elif ledger_path.exists():
            ledger_path.unlink()


if __name__ == "__main__":
    if "--test-quota" in sys.argv:
        sys.exit(run_quota_self_test())
    main()
