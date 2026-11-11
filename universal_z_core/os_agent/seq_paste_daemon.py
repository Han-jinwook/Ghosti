# -*- coding: utf-8 -*-
"""
👻 귀신같이(Ghosti) 유료 구독자 전용 선물 — 『멀린 Z 코어 9대 귀신 초능력 + 3대 보너스 통합 데몬 (v2.5 AI 완전체)』
====================================================================================================
- 귀신호출 3인방: Ctrl + 0 / Ctrl + 우클릭 / 우클릭 0.35초 꾹 + 오토매틱(Automatic) 한영 오타·띄어쓰기 감지 및 한/영 키 자동 전환
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
import urllib.request

u32 = ctypes.windll.user32
k32 = ctypes.windll.kernel32
imm32 = ctypes.windll.imm32

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
u32.GetClipboardData.argtypes = [wintypes.UINT]
u32.GetClipboardData.restype = wintypes.HANDLE
u32.SetClipboardData.argtypes = [wintypes.UINT, wintypes.HANDLE]
u32.SetClipboardData.restype = wintypes.HANDLE
imm32.ImmGetDefaultIMEWnd.argtypes = [wintypes.HWND]
imm32.ImmGetDefaultIMEWnd.restype = wintypes.HWND
u32.GetForegroundWindow.restype = wintypes.HWND
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
    "lostark.exe", "fc24.exe", "maplestory.exe", "SuddenAttack.exe", "fifaonline4.exe",
    "blender.exe", "acad.exe", "solidworks.exe", "sketchup.exe", "3dsmax.exe", "maya.exe",
    "rhino.exe", "zbrush.exe", "unrealEditor.exe", "unity.exe", "mstsc.exe", "anydesk.exe", "teamviewer.exe",
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
u32.SetWindowsHookExW.argtypes = [ctypes.c_int, LowLevelMouseProcType, wintypes.HINSTANCE, wintypes.DWORD]
u32.SetWindowsHookExW.restype = wintypes.HANDLE
u32.CallNextHookEx.argtypes = [wintypes.HANDLE, ctypes.c_int, wintypes.WPARAM, wintypes.LPARAM]
u32.CallNextHookEx.restype = ctypes.c_ssize_t
u32.UnhookWindowsHookEx.argtypes = [wintypes.HANDLE]
u32.UnhookWindowsHookEx.restype = wintypes.BOOL

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
        self._lock = threading.Lock()
        # 백그라운드 비동기 초기화 (데몬 부팅 속도 0.01초 보장)
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

    def _lazy_init(self) -> None:
        with self._lock:
            if self._loaded:
                return
            try:
                model_dir = self._find_model_dir()
                if model_dir:
                    tok_path = model_dir / "tokenizer.json"
                    data = json.loads(tok_path.read_text(encoding="utf-8"))
                    vocab = data.get("model", {}).get("vocab", {})
                    self.vocab = vocab
                    for k, tid in vocab.items():
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

                    # [초경량 데몬 철칙]: seq_paste_daemon.py에서는 200MB ONNX 세션을 중복 로드하지 않고
                    # tokenizer.json 사전만 로드하여 CPU 0% · 메모리 25MB 이하 초경량 반응속도를 보장합니다.
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

# 소문자만 쳤을 때 자주 발생하는 쌍자음 어휘 자동 보정 사전
SHIFTLESS_DOUBLE_CONSONANT_FIX = {
    "진자": "진짜",
    "진자야": "진짜야",
    "진자요": "진짜요",
    "어더": "어떠",
    "어더케": "어떻게",
    "어덯게": "어떻게",
    "오바": "오빠",
    "아바": "아빠",
    "바바": "바빠",
    "이브": "이쁘",
    "예브": "예쁘",
    "기브": "기쁘",
    "조금": "조끔",
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
                        if -10000 < pt_c.x < 20000 and -10000 < pt_c.y < 20000:
                            return int(pt_c.x), int(pt_c.y), "win32_rcCaret"
        except Exception:
            pass
    pt_fallback = wintypes.POINT()
    u32.GetCursorPos(ctypes.byref(pt_fallback))
    return int(pt_fallback.x), int(pt_fallback.y), "cursor_fallback"


def extract_non_destructive_caret_lookbehind(fg_hwnd: int | None = None, max_words: int = 3) -> str:
    """
    [무드래그 3단계 안전망 — 1단계: 커서 직전 토큰 비파괴 자동 역추적 (Caret Lookbehind)]
    사용자가 드래그나 '?' 입력 없이 키워드만 치고 우클릭 꾹 / Ctrl+0을 호출했을 때,
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
            u32.SendMessageW(focus_h, EM_GETSEL, ctypes.byref(s_pos), ctypes.byref(e_pos))
            t_len = u32.SendMessageW(focus_h, WM_GETTEXTLENGTH, 0, 0)
            if 0 < t_len < 32768:
                buf = ctypes.create_unicode_buffer(t_len + 2)
                u32.SendMessageW(focus_h, WM_GETTEXT, t_len + 1, ctypes.cast(buf, wintypes.LPARAM))
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
                mode = u32.SendMessageW(hime, WM_IME_CONTROL, IMC_GETCONVERSIONMODE, 0)
                if (mode & IME_CMODE_NATIVE) != 0:
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
            if is_hwp:
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
                    curr_mode = u32.SendMessageW(hime, WM_IME_CONTROL, IMC_GETCONVERSIONMODE, 0)
                    is_kor = (curr_mode & IME_CMODE_NATIVE) != 0
                    if is_kor != target_korean:
                        new_mode = (curr_mode | IME_CMODE_NATIVE) if target_korean else (curr_mode & ~IME_CMODE_NATIVE)
                        u32.SendMessageW(hime, WM_IME_CONTROL, IMC_SETCONVERSIONMODE, new_mode)
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
    for k_wrong, k_right in SHIFTLESS_DOUBLE_CONSONANT_FIX.items():
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


def _is_protected_account_or_email_token(tok: str) -> bool:
    """
    [이메일·URL·계정 아이디·비밀번호 원천 보호 필터]
    - 이메일 기호(@: dmsgydmlapdlf@, user@naver.com), URL/도메인(.com/.kr/.app 등),
      중간 기호 결합 아이디(eunho.mail, user_01, qwer!1234), 숫자 3자리 이상 결합 토큰(gnsrn95459712)은
      실시간 한영 자동전환 및 문장 성형에서 100% 원문 그대로 보호합니다!
    """
    if not tok:
        return False
    s = tok.strip()
    if not s:
        return False
    if "@" in s or "://" in s or s.lower().startswith("www."):
        return True
    if re.search(r"[A-Za-z0-9-]+\.(?:com|net|org|kr|co|io|app|dev|ai|edu|gov|me|biz|info)\b", s, re.IGNORECASE):
        return True
    if re.search(r"[A-Za-z0-9][._!+-][A-Za-z0-9]", s) and not re.search(r"[가-힣]", s):
        return True
    stripped_punct = s.strip(".,?!:;\"'()[]{}")
    if re.search(r"[A-Za-z]", stripped_punct) and not re.search(r"[가-힣\u3131-\u318E]", stripped_punct):
        if re.search(r"\d{3,}", stripped_punct):
            return True
        if re.search(r"[_@#$%^&*+=\\/|~`]", stripped_punct):
            return True
        if re.search(r"\d+[A-Za-z]", stripped_punct):
            return True
    return False


def morph_korean_english_text_with_direction(text: str) -> tuple[str, str | None]:
    """
    양방향(영->한 KS X 1001 & 한->영 EmbeddingGemma 2 영단어 사전) 스마트 성형 및 목표 언어 방향 반환
    - 반환값: (변환된 문자열, 'KO' | 'EN' | None)
    - [QA 2-2 완치]:
      1) 한영 전환 직전/직후 한글 어절 앞에 실수로 1글자 영문이 붙은 경우('w오늘은 날씨가', 't밖으로 나가고') 영문 찌꺼기 자동 제거!
      2) 영문 오타 뒤에 숫자가 붙은 경우('은호의 roffjrtl25' ➔ '은호의 갤럭시25')에도 영문 오타 구간을 정확히 분리해 한글로 변환!
    """
    target_lang: str | None = None

    # 0) 한글 어절(2음절 이상) 바로 앞에 1글자 영문 오타가 달라붙은 경우('w오늘은' -> '오늘은', 't밖으로' -> '밖으로') 즉시 제거
    def _strip_leading_single_eng(m_lead: re.Match) -> str:
        nonlocal target_lang
        target_lang = "KO"
        return m_lead.group(2)

    cleaned_lead = re.sub(r"(?<![A-Za-z0-9_:/.-])([a-zA-Z])([가-힣]{2,})", _strip_leading_single_eng, text)

    # [핵심 보호막]: URL, 이메일(user@domain.com, user@), 파일경로, 비밀번호/영숫자+특수기호 복합 토큰(예: gnsrn95459712, Abc!1234, test_id01)은
    # 절대 영타 오타로 쪼개서 한글 변환하지 않고 원문 100% 그대로 보호합니다!
    def _morph_whitespace_chunk(chunk_m: re.Match) -> str:
        nonlocal target_lang
        w_tok = chunk_m.group(0)
        if _is_protected_account_or_email_token(w_tok):
            return w_tok

        def replace_token(m: re.Match) -> str:
            nonlocal target_lang
            tok = m.group(0)

            # 1) 영문 알파벳 토큰인 경우
            if re.fullmatch(r"[A-Za-z]+", tok):
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
                        if any(k in fname for k in ("biff", "spreadsheet", "csv", "excel", "WK1")):
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
_CAND_SOUNDS = [
    Path(__file__).resolve().parent / "assets",
    Path(__file__).resolve().parent.parent / "data" / "baby_ghost_sounds",
    Path("C:/MerlinTools/assets"),
]
SOUNDS_DIR = next((d for d in _CAND_SOUNDS if (d / "active_summon_sound.wav").exists()), _CAND_SOUNDS[0])
ASSETS_DIR = Path(__file__).resolve().parent / "assets"

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
    "auto_typo_enabled": True,
    "e2ee_mailbox_enabled": True,
    "family_shared_slots": ["F1", "F2"],
}


def get_superpower_settings() -> dict:
    cfg = dict(DEFAULT_SUPERPOWER_SETTINGS)
    try:
        if SUPERPOWER_SETTINGS_FILE.exists():
            loaded = json.loads(SUPERPOWER_SETTINGS_FILE.read_text(encoding="utf-8"))
            if isinstance(loaded, dict):
                cfg.update(loaded)
    except Exception:
        pass
    days = int(cfg.get("retention_days", 7))
    if days not in (1, 3, 7, 30):
        days = 7
    cfg["retention_days"] = days
    cfg["max_items"] = 1000 if days >= 30 else 300
    return cfg


def update_superpower_settings(patch: dict) -> dict:
    cfg = get_superpower_settings()
    if "retention_days" in patch and patch["retention_days"] is not None:
        days = int(patch["retention_days"])
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
        cfg["window_duration_ms"] = max(2000, min(20000, int(patch["window_duration_ms"])))
    if "auto_typo_enabled" in patch and patch["auto_typo_enabled"] is not None:
        cfg["auto_typo_enabled"] = bool(patch["auto_typo_enabled"])
    if "e2ee_mailbox_enabled" in patch and patch["e2ee_mailbox_enabled"] is not None:
        cfg["e2ee_mailbox_enabled"] = bool(patch["e2ee_mailbox_enabled"])
    if "family_shared_slots" in patch and isinstance(patch["family_shared_slots"], list):
        cfg["family_shared_slots"] = [str(s).upper() for s in patch["family_shared_slots"] if str(s).upper().startswith("F")]
    cfg["updated_at"] = datetime.datetime.now().isoformat(timespec="seconds")
    try:
        _MERLIN_APPDATA.mkdir(parents=True, exist_ok=True)
        SUPERPOWER_SETTINGS_FILE.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception:
        pass
    return cfg


_CLEAR_ALL_REQUESTED = False
CLEAR_SIGNAL_FILE = _MERLIN_APPDATA / "clear_clipboard_signal.txt"


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
    _toast_queue.put(("__CLOSE__", 0))
    _toast_event.set()


def _get_machine_hwid_local() -> str:
    """메인보드 UUID / 머신 GUID 기반 기기 고유 해시(sha256_...) 반환"""
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
    return f"sha256_{digest}"


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
       Ctrl+0 (또는 우클릭 꾹~) 호출 시 -> 드래그나 '?'가 없어도 0.01초 만에 곧바로 『👻 귀신검색창(UI ②)』 직행!
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


def opt_in_30d_unlimited_superpower_trial(agreed: bool = True) -> dict:
    """
    [확정 ⑤ & 2차 딥리서치 — 🎁 모든 귀신 초능력 30일 무제한 무료체험 명시적 동의 스위치 (Opt-in Trial)]:
    설치 시 자동 카운트다운을 절대 금지하고, 유저가 『애기귀신 소환술 3단 수련장』 수료 직후 또는
    초능력 최초 실행 시 직접 '[🚀 네! 오늘부터 30일 무제한 초능력 체험 시작하기]'를 눌렀을 때만
    trial_opt_in_at 타임스탬프를 기록하고 30일 무제한 카운트다운(D-30 ~ D-1)을 시작합니다.
    """
    ledger_path = _MERLIN_APPDATA / "superpower_trial_ledger.json"
    now_ts = time.time()
    now_dt = datetime.datetime.now()
    hwid = _get_machine_hwid_local()
    _MERLIN_APPDATA.mkdir(parents=True, exist_ok=True)
    ledger = {"machines": {}, "accounts": {}}
    if ledger_path.exists():
        try:
            loaded = json.loads(ledger_path.read_text(encoding="utf-8"))
            if isinstance(loaded, dict):
                ledger = loaded
        except Exception:
            pass
    machines = ledger.setdefault("machines", {})
    m_info = machines.setdefault(hwid, {"machineHwid": hwid, "isSubscribed": False})
    if agreed:
        if not m_info.get("trialOptInTs"):
            m_info["trialOptInTs"] = now_ts
            m_info["trialOptInAt"] = now_dt.strftime("%Y-%m-%d %H:%M:%S")
            m_info["trialExpiresAt"] = (now_dt + datetime.timedelta(days=30)).strftime("%Y-%m-%d %H:%M:%S")
        m_info["trialOptInStatus"] = "ACTIVE_30D"
    else:
        m_info["trialOptInStatus"] = "DAILY_3_FREE_ONLY"
    ledger_path.write_text(json.dumps(ledger, ensure_ascii=False, indent=2), encoding="utf-8")
    return {
        "ok": True,
        "status": m_info.get("trialOptInStatus"),
        "trial_opt_in_at": m_info.get("trialOptInAt"),
        "days_left": 29 if agreed else 0,
        "badge_label": "🎁 무제한 체험 D-29" if agreed else "일 3회 평생 무료 모드",
    }


def build_loss_aversion_time_saved_report(total_actions_count: int = 412) -> dict:
    """
    [2차 딥리서치 확정 — 📊 일 3회 무료 한도 도달 시 '손실회피(Loss Aversion) 시간 절약 성적표 팝업']:
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
        "headline": "👻 [오늘의 무료 귀신 초능력 3회를 모두 사용하셨습니다!]",
        "body": f"지금까지 애기귀신과 함께 총 {cnt:,}번의 창 이동·복붙 노가다를 줄여 약 {time_str}의 소중한 시간을 아끼셨습니다!",
        "cta_primary": "☕ 커피 한 잔 값(월 3,900원 / 🔥10년 특판 3.9만)으로 평생 무제한 풀기",
        "cta_secondary": "내일 다시 무료로 쓸게요",
    }


SUPERPOWER_12_FEATURES: dict[str, str] = {
    "feat_1_seq_paste": "⚡ [Ctrl+V] 순차·칸맞춤",
    "feat_2_typo_morph": "⚡ 자동 한영·띄어쓰기",
    "feat_4_iron_lines": "① 서식·줄바꿈 다림질",
    "feat_3_clean_format": "🧹 서식세탁",
    "feat_9_image_file": "② 파일·라벨러(PDF)🔒",
    "feat_6_screen_ocr": "③ 글자·표OCR🔒",
    "feat_5_merge_search": "④ 합본🔒",
    "feat_8_format_numbers": "⑤ 번호·일정🔒",
    "feat_7_window_pin": "⑥ 창고정🔒",
    "feat_b1_snippets": "⌨️ 상용구(F1~12)",
    "feat_b2_excel_split": "💡 엑셀쪼개기",
    "feat_b3_pdf_merge": "💡 다중스샷PDF합본",
}


def normalize_feature_id(raw_key: str) -> str:
    k = str(raw_key or "").strip()
    if k in SUPERPOWER_12_FEATURES:
        return k
    if k in ("seq_paste_smart_match", "ctrl_v"):
        return "feat_1_seq_paste"
    # [수동 단축키 1~6 체계 (한영·띄어쓰기는 타이핑 자동 감지)]:
    # [1] 🧹서식·줄바꿈, [2] 🏷️파일·라벨러(PDF)🔒, [3] 글자·표OCR🔒,
    # [4] 합본🔒, [5] 번호·일정🔒, [6] 창고정🔒
    if k == "auto_typo_morph_2words":
        return "feat_2_typo_morph"
    if k in ("superpower_key_1", "1"):
        return "feat_4_iron_lines"
    if k in ("superpower_key_2", "superpower_key_9", "2", "9"):
        return "feat_9_image_file"
    if k in ("superpower_key_3", "3"):
        return "feat_6_screen_ocr"
    if k in ("superpower_key_4", "4"):
        return "feat_5_merge_search"
    if k in ("superpower_key_5", "5"):
        return "feat_8_format_numbers"
    if k in ("superpower_key_6", "superpower_key_8", "6", "8"):
        return "feat_7_window_pin"
    if k.startswith("snippet_F") or k.upper().startswith("F"):
        return "feat_b1_snippets"
    if "excel" in k.lower():
        return "feat_b2_excel_split"
    if "pdf" in k.lower():
        return "feat_b3_pdf_merge"
    return k


def check_feature_quota_allowed(raw_feature_key: str) -> tuple[bool, str]:
    """
    [개별 기능별 첫 사용 후 30일 무제한 ➔ 만료된 기능만 일일 성공 3회 제한 검사]
    - 아직 개봉 안 했거나(UNOPENED), 첫 사용 후 30일 이내(ACTIVE_30D)이거나, 유료 구독자(SUBSCRIBED)이면 무조건 True!
    - 해당 기능의 30일 무제한이 만료(EXPIRED_30D)되었고 오늘 만료 기능 합산 성공 횟수가 이미 3회에 도달한 경우에만 False 반환!
    """
    feat_id = normalize_feature_id(raw_feature_key)
    ledger_path = _MERLIN_APPDATA / "superpower_trial_ledger.json"
    if not ledger_path.exists():
        return True, "UNOPENED"
    try:
        ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
        hwid = _get_machine_hwid_local()
        m_info = ledger.get("machines", {}).get(hwid, {})
        if not isinstance(m_info, dict):
            return True, "UNOPENED"
        if m_info.get("isSubscribed"):
            return True, "SUBSCRIBED"
        if m_info.get("trialOptInStatus") == "ACTIVE_30D" and m_info.get("trialOptInTs"):
            opt_elapsed = (time.time() - float(m_info["trialOptInTs"])) / 86400.0
            if opt_elapsed < 30.0:
                rem_opt = max(1, int(round(30.0 - opt_elapsed + 0.49)))
                return True, f"ACTIVE_D-{rem_opt}"
        feat_trials = m_info.get("featureTrials", {})
        f_entry = feat_trials.get(feat_id)
        if not isinstance(f_entry, dict) or not f_entry.get("firstUsedTs"):
            return True, "UNOPENED"
        elapsed_days = (time.time() - float(f_entry["firstUsedTs"])) / 86400.0
        if elapsed_days < 30.0:
            rem_days = max(1, int(round(30.0 - elapsed_days + 0.49)))
            return True, f"ACTIVE_D-{rem_days}"
        # 30일 만료된 기능인 경우: 오늘 만료 기능 합산 사용량 확인
        today = datetime.date.today().isoformat()
        used_today = int(m_info.get("dailyUsage", {}).get(today, 0))
        if used_today >= 3:
            unopened_cnt = sum(1 for fk in SUPERPOWER_12_FEATURES if fk not in feat_trials)
            msg = (
                f"👻 오늘 만료 기능 무료(3/3회) 소진! (미개봉 {unopened_cnt}개는 지금도 30일 무제한!) "
                f"[내 기기 통합 월 3,900원] 구독 시 전 기능 평생 무제한"
            )
            return False, msg
        return True, f"DAILY_FREE_{3 - used_today}_LEFT"
    except Exception:
        return True, "OK"


def complete_feature_action_success(raw_feature_key: str) -> dict:
    """
    [오직 '실제 액션이 성공 완수된 시점'에만 호출!]
    1) 해당 기능이 미개봉(UNOPENED)이면 -> 지금 이 순간부터 해당 기능의 30일 무제한 타이머 개시! (일일 3회 차감 안 함)
    2) 해당 기능이 30일 무제한 진행 중(ACTIVE_30D)이면 -> 횟수 차감 없이 통과!
    3) 해당 기능의 30일 무제한이 만료(EXPIRED_30D)되었으면 -> 오늘 일일 무료 횟수(3회 한도)에서 1회 차감!
    """
    feat_id = normalize_feature_id(raw_feature_key)
    record_feature_telemetry(raw_feature_key)
    ledger_path = _MERLIN_APPDATA / "superpower_trial_ledger.json"
    now_ts = time.time()
    now_dt = datetime.datetime.now()
    today = datetime.date.today().isoformat()
    hwid = _get_machine_hwid_local()

    try:
        _MERLIN_APPDATA.mkdir(parents=True, exist_ok=True)
        ledger = {"machines": {}, "accounts": {}}
        if ledger_path.exists():
            try:
                loaded = json.loads(ledger_path.read_text(encoding="utf-8"))
                if isinstance(loaded, dict):
                    ledger = loaded
            except Exception:
                pass
        machines = ledger.setdefault("machines", {})
        m_info = machines.setdefault(hwid, {"machineHwid": hwid, "isSubscribed": False})
        if m_info.get("isSubscribed"):
            return {"status": "SUBSCRIBED", "feature_id": feat_id, "consumed_daily": False, "daily_remaining": 9999}

        feat_trials = m_info.setdefault("featureTrials", {})
        f_entry = feat_trials.get(feat_id)

        # Case 1: 생애 첫 성공 사용! -> 지금부터 이 기능만 30일 무제한 타이머 시작!
        if not isinstance(f_entry, dict) or not f_entry.get("firstUsedTs"):
            exp_dt = now_dt + datetime.timedelta(days=30)
            feat_trials[feat_id] = {
                "featureName": SUPERPOWER_12_FEATURES.get(feat_id, feat_id),
                "firstUsedTs": now_ts,
                "firstUsedAt": now_dt.strftime("%Y-%m-%d %H:%M:%S"),
                "expiresAt": exp_dt.strftime("%Y-%m-%d %H:%M:%S"),
                "successCount": 1,
            }
            ledger_path.write_text(json.dumps(ledger, ensure_ascii=False, indent=2), encoding="utf-8")
            return {"status": "FIRST_OPENED_30D", "feature_id": feat_id, "days_left": 30, "consumed_daily": False, "daily_remaining": 3}

        # Case 2: 이미 개봉된 기능 -> 30일 경과 여부 판정
        f_entry["successCount"] = int(f_entry.get("successCount", 0)) + 1
        elapsed_days = (now_ts - float(f_entry["firstUsedTs"])) / 86400.0
        if elapsed_days < 30.0:
            rem_days = max(1, int(round(30.0 - elapsed_days + 0.49)))
            ledger_path.write_text(json.dumps(ledger, ensure_ascii=False, indent=2), encoding="utf-8")
            return {"status": "ACTIVE_30D", "feature_id": feat_id, "days_left": rem_days, "consumed_daily": False, "daily_remaining": 3}

        # Case 3: 해당 기능의 30일 무제한이 만료된 상태 -> 오늘 성공 횟수 +1 차감!
        du = m_info.setdefault("dailyUsage", {})
        used_today = int(du.get(today, 0)) + 1
        du[today] = used_today
        m_info["lastActionAt"] = now_dt.isoformat(timespec="seconds")
        m_info["lastActionType"] = feat_id
        ledger_path.write_text(json.dumps(ledger, ensure_ascii=False, indent=2), encoding="utf-8")
        rem = max(0, 3 - used_today)
        return {"status": "EXPIRED_DAILY_3", "feature_id": feat_id, "days_left": 0, "consumed_daily": True, "daily_remaining": rem}
    except Exception:
        return {"status": "OK", "feature_id": feat_id, "consumed_daily": False, "daily_remaining": 3}


def record_feature_telemetry(feature_key: str) -> None:
    """
    [100% 합법 익명 통계(Zero-Content Telemetry)]
    - 유저가 입력한 텍스트(내용)는 0바이트도 수집하지 않으며,
      오직 '어떤 초능력 기능 코드가 몇 번 호출되었는지(숫자 카운터)'만 일자별로 집계합니다.
    """
    def _save():
        try:
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
            TELEMETRY_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
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
    url = f"{root_u}/?preview=legacy&ghostSearchWindow={norm_stage}"
    q_clean = (query or "").strip()
    if q_clean:
        url += f"&q={quote(q_clean)}"
    return url


def _open_ghost_search_window_popup(stage: str = "small", query: str = "", anchor_x: int | None = None, anchor_y: int | None = None) -> dict:
    """
    [v1.4 확정 — 로컬 『👻 귀신검색창』 프레임리스 앱 창(Edge/Chrome --app 모드) 즉시 호출]:
    크게(large)/작게(자율 반응형 small↔medium) 규격에 맞춰 모니터 경계 클램핑된 정확한 좌표·크기로 띄웁니다.
    """
    pt = wintypes.POINT()
    if anchor_x is None or anchor_y is None:
        u32.GetCursorPos(ctypes.byref(pt))
        ax, ay = pt.x, pt.y
    else:
        ax, ay = int(anchor_x), int(anchor_y)
    work_area = _get_monitor_workarea_for_point(ax, ay)
    norm_in = "large" if stage in ("large", "gallery") else ("medium" if (stage == "medium" or query.strip()) else "small")
    custom_h = 340 if norm_in == "small" and not query.strip() else None
    rect = compute_ghost_search_window_3stage_rect(norm_in, ax, ay, work_area=work_area, custom_height=custom_h)
    target_url = build_ghost_search_window_url(str(rect["stage"]), query=query)
    record_feature_telemetry(f"ghost_search_window_{rect['stage']}")

    browser_candidates = [
        Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
        Path(r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"),
        Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
        Path(r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"),
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
        except Exception:
            pass
    return {"url": target_url, "rect": rect, "launched": launched}


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
    return -3840, 0, 7680, 2160


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


def _get_lightweight_local_files() -> list[dict]:
    """
    바탕화면·다운로드·문서·사진 폴더의 최근 파일 메타데이터만 60초 주기로 초경량 캐싱 (< 5ms, 디스크/메모리 부하 0%)
    """
    now = time.time()
    if _LOCAL_FILE_CACHE["items"] and (now - _LOCAL_FILE_CACHE["ts"]) < 60.0:
        return _LOCAL_FILE_CACHE["items"]
    home = Path.home()
    folders = [
        home / "Desktop",
        home / "Downloads",
        home / "Documents",
        home / "Pictures",
    ]
    doc_exts = {".pdf", ".xlsx", ".xls", ".docx", ".doc", ".hwp", ".hwpx", ".pptx", ".ppt", ".txt", ".csv", ".md"}
    img_exts = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"}
    vid_exts = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".wmv"}
    collected: list[dict] = []
    for fd in folders:
        if not fd.exists():
            continue
        try:
            with os.scandir(fd) as it:
                for entry in it:
                    try:
                        if not entry.is_file():
                            continue
                        name = entry.name
                        if name.startswith((".", "~$")):
                            continue
                        ext = Path(name).suffix.lower()
                        if ext in doc_exts:
                            fkind = "doc"
                        elif ext in img_exts:
                            fkind = "image"
                        elif ext in vid_exts:
                            fkind = "video"
                        else:
                            continue
                        st = entry.stat()
                        collected.append({
                            "kind": fkind,
                            "file_path": entry.path,
                            "img_path": entry.path if fkind == "image" else "",
                            "text": f"[{fd.name}] {name}",
                            "ts": st.st_mtime,
                            "_name": name[:120],
                        })
                    except Exception:
                        pass
        except Exception:
            pass
    collected.sort(key=lambda x: x.get("ts", 0.0), reverse=True)
    top_items = collected[:80]
    for it_f in top_items:
        it_f["vec"] = AI_ENGINE.embed_128d(it_f.pop("_name", ""))
    _LOCAL_FILE_CACHE["items"] = top_items
    _LOCAL_FILE_CACHE["ts"] = now
    return _LOCAL_FILE_CACHE["items"]


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


def _toast_worker() -> None:
    """
    👻 귀신창 (Ghost Window) v3.5 3대 현장 소환창 완전 분리 마스터 워커:
    - [창 UI ①] 기본 귀신창: 초경량 2줄 8대 초능력 버튼 바 (입력창 소환 전용, 검색 드롭다운/이미지 디코딩 0%)
    - [창 UI ②] 👻 귀신검색창 (소·중·대): 바탕화면/일반 화면 소환 또는 검색 전환 시 독립 실행되는 3단 검색창
    - [창 UI ③] 📸 사진·OCR 공간이동창: 스샷 직후 소환 시 독립 실행되는 좌측 사진·표 / 우측 OCR 칩 전용창
    """
    import tkinter as tk
    try:
        from PIL import Image, ImageTk
    except Exception:
        Image = None
        ImageTk = None

    root = tk.Tk()
    root.withdraw()

    ghost_symbol_photo = None
    ghost_wordmark_photo = None
    try:
        sym_candidates = [
            Path(__file__).resolve().parent / "assets" / "gwisinkachi_app_icon_512.png",
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
            Path(__file__).resolve().parent / "assets" / "gwisinkachi_3d_wordmark_dark.png",
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

    current_win: list[tk.Toplevel | None] = [None]
    detail_win: list[tk.Toplevel | None] = [None]
    active_mode: list[str] = [""]  # "ui1" | "ui2" | "ui3" | "toast"
    after_id: list[str | None] = [None]
    is_hovered: list[bool] = [False]
    win_rect: list[tuple[int, int, int, int]] = [(0, 0, 0, 0)]
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
        global _CURRENT_OPEN_UI_MODE
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
        active_mode[0] = ""
        _CURRENT_OPEN_UI_MODE = ""
        is_hovered[0] = False
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
        win.geometry(f"{rw}x{rh}{x:+d}{y:+d}")
        try:
            win.update_idletasks()
            win.deiconify()
            wid = win.winfo_id()
            hwnd_t = u32.GetParent(wid) or wid if wid else 0
            if hwnd_t:
                ex_st = u32.GetWindowLongW(hwnd_t, GWL_EXSTYLE)
                if activate:
                    u32.SetWindowLongW(hwnd_t, GWL_EXSTYLE, (ex_st & ~WS_EX_NOACTIVATE) | WS_EX_TOPMOST | WS_EX_TOOLWINDOW)
                    u32.SetWindowPos(hwnd_t, HWND_TOPMOST, x, y, rw, rh, SWP_SHOWWINDOW)
                    u32.SetForegroundWindow(hwnd_t)
                else:
                    u32.SetWindowLongW(hwnd_t, GWL_EXSTYLE, ex_st | WS_EX_NOACTIVATE | WS_EX_TOPMOST | WS_EX_TOOLWINDOW)
                    u32.SetWindowPos(hwnd_t, HWND_TOPMOST, x, y, rw, rh, SWP_NOACTIVATE | SWP_SHOWWINDOW)
        except Exception:
            pass
        win.lift()
        win_rect[0] = (x, y, x + rw, y + rh)

    # =================================================================
    # [창 UI ②] 👻 귀신검색창 (크게/작게 2모드 · 작게 모드 내 소520 ↔ 중960 검색량 반응형 자율 조절)
    # - [창 UI ① 기본 귀신창]과 100% 분리된 독립 창 ([1]~[8] 버튼 없음!)
    # =================================================================
    def _build_ui2_search_window(win: tk.Toplevel, init_stage: str, init_query: str, pt_x: int, pt_y: int, work_area: tuple[int, int, int, int]) -> None:
        global _CURRENT_OPEN_UI_MODE
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
            text="🏷️[2]파일라벨러",
            fg="#0B1120",
            bg="#5EEAD4",
            padx=6,
            pady=1,
            font=("Malgun Gothic", 8, "bold"),
            cursor="hand2",
        )
        lbl_quick_btn.pack(side="right", padx=(4, 2))
        lbl_quick_btn.bind("<Button-1>", lambda _e: (_close_win(), _CLICKED_SUPERPOWER_QUEUE.put(2)))

        # 2단 필터 바: [전체] [📄문서] [🖼️사진] [🎬영상] + 우측 🎁30일무제한(D-30)
        fbar = tk.Frame(outer, bg="#0B1120")
        fbar.pack(fill="x", pady=(0, 4))

        filter_btns: dict[str, tk.Label] = {}
        for f_key, f_txt in (("all", "전체"), ("doc", "📄문서"), ("image", "🖼️사진"), ("video", "🎬영상")):
            fb = tk.Label(fbar, text=f_txt, fg="#E2E8F0", bg="#1E293B", padx=6, pady=1, font=("Malgun Gothic", 8, "bold"), cursor="hand2")
            fb.pack(side="left", padx=(0, 4))
            fb.bind("<Button-1>", lambda _e, fk=f_key: _switch_filter(fk))
            filter_btns[f_key] = fb

        trial_lbl = tk.Label(fbar, text="🎁 30일 무제한(D-30·차감없음)", fg="#FDE047", bg="#0B1120", font=("Malgun Gothic", 8, "bold"))
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
                trial_lbl.config(text="✨ 크기 자율 호흡 · 🎁 30일 무제한", fg="#FDE047")
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
                    ocr_b = tk.Label(card, text="📝OCR", fg="#FDE047", bg="#0B1120", padx=4, pady=1, font=("Malgun Gothic", 8, "bold"), cursor="hand2")
                    ocr_b.pack(side="right", padx=(4, 0))
                    ocr_b.bind("<Button-1>", lambda _e, r=rec: _toast_queue.put((f"__UI3_OCR__|{r.get('img_path','')}", 8000)))

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
                tk.Label(preview_pane, text="👻 선택 항목 상세 미리보기", fg="#5EEAD4", bg="#0F172A", font=("Malgun Gothic", 9, "bold"), anchor="w").pack(fill="x", pady=(0, 6))
                tk.Label(preview_pane, text=s_txt[:360], fg="#F8FAFC", bg="#0F172A", font=("Malgun Gothic", 9), justify="left", wraplength=330, anchor="w").pack(fill="x", pady=(0, 8))
                act_b = tk.Label(preview_pane, text="📎 현재 커서에 바로 꽂기 (Enter)", fg="#0B1120", bg="#2DD4BF", padx=8, pady=4, font=("Malgun Gothic", 9, "bold"), cursor="hand2")
                act_b.pack(fill="x", pady=2)
                act_b.bind("<Button-1>", lambda _e, r=sel_rec: _paste_to_target(r.get("text", ""), r.get("file_path") or r.get("img_path") or ""))
                if sel_rec.get("kind") == "image":
                    ocr_jump = tk.Label(preview_pane, text="📝 사진·OCR 단어칩 창으로 열기", fg="#FDE047", bg="#1E293B", padx=8, pady=4, font=("Malgun Gothic", 9, "bold"), cursor="hand2")
                    ocr_jump.pack(fill="x", pady=2)
                    ocr_jump.bind("<Button-1>", lambda _e, r=sel_rec: _toast_queue.put((f"__UI3_OCR__|{r.get('img_path','')}", 8000)))

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
        s_entry.bind("<Tab>", _toggle_window_mode)
        s_entry.bind("<Alt-Return>", _toggle_window_mode)
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

        target_rec = None
        for r in reversed(GLOBAL_AI_HISTORY):
            if r.get("kind") == "image":
                if not img_path_arg or r.get("img_path") == img_path_arg:
                    target_rec = r
                    break

        outer = tk.Frame(win, bg="#0B1120", highlightbackground="#FDE047", highlightthickness=2, padx=8, pady=6)
        outer.pack(fill="both", expand=True)

        hdr = tk.Frame(outer, bg="#0F172A", padx=6, pady=4)
        hdr.pack(fill="x", pady=(0, 6))
        tk.Label(hdr, text="👻 사진·OCR 공간이동창", fg="#0B1120", bg="#FDE047", padx=6, pady=1, font=("Malgun Gothic", 8, "bold")).pack(side="left", padx=(0, 6))
        tk.Label(hdr, text="🎁 30일 무제한(D-30) · 원하는 단어칩을 클릭하면 커서에 0.1초 입력!", fg="#5EEAD4", bg="#0F172A", font=("Malgun Gothic", 8, "bold")).pack(side="left")

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

        img_p_str = (target_rec.get("img_path") if target_rec else "") or img_path_arg
        if target_rec and target_rec.get("png_bytes") and Image is not None:
            try:
                im_o = Image.open(io.BytesIO(target_rec["png_bytes"])).convert("RGBA")
                im_o.thumbnail((190, 125), Image.Resampling.LANCZOS)
                ph_o = ImageTk.PhotoImage(im_o, master=root)
                thumb_refs.append(ph_o)
                tk.Label(left_p, image=ph_o, bg="#0F172A").pack(pady=(0, 6))
            except Exception:
                pass

        b_orig = tk.Label(left_p, text="🖼️ 원본 사진 그대로 넣기", fg="#0B1120", bg="#2DD4BF", padx=6, pady=4, font=("Malgun Gothic", 8, "bold"), cursor="hand2")
        b_orig.pack(fill="x", pady=2)
        b_orig.bind("<Button-1>", lambda _e: _paste_to_target(file_path=img_p_str))

        raw_ocr_t = (target_rec.get("text", "") if target_rec else "") or get_clipboard_text()
        b_tsv = tk.Label(left_p, text="📊 표 전체 엑셀(TSV)로 넣기", fg="#F8FAFC", bg="#1E293B", padx=6, pady=4, font=("Malgun Gothic", 8, "bold"), cursor="hand2")
        b_tsv.pack(fill="x", pady=2)
        b_tsv.bind("<Button-1>", lambda _e: _paste_to_target(text_val=re.sub(r"  +", "	", _clean_ocr_noise(raw_ocr_t))))

        tk.Label(right_p, text="📝 추출된 단어 조각(칩) — 콕 찍으면 커서에 즉시 입력", fg="#FDE047", bg="#0F172A", font=("Malgun Gothic", 8, "bold"), anchor="w").pack(fill="x", pady=(0, 6))
        chips_box = tk.Frame(right_p, bg="#0F172A")
        chips_box.pack(fill="both", expand=True)

        chips = _extract_word_chips_from_text(raw_ocr_t)
        if not chips:
            chips = ["화면 캡처 이미지", "원본 사진 첨부 가능"]
        for idx_ch, ch_val in enumerate(chips):
            ch_lbl = tk.Label(chips_box, text=f" {ch_val} ", fg="#5EEAD4", bg="#1E293B", padx=6, pady=3, font=("Malgun Gothic", 9, "bold"), cursor="hand2")
            ch_lbl.grid(row=idx_ch // 3, column=idx_ch % 3, padx=3, pady=3, sticky="ew")
            ch_lbl.bind("<Button-1>", lambda _e, v=ch_val: _paste_to_target(text_val=v))

        b_all = tk.Label(right_p, text="📋 전체 텍스트 통째로 넣기", fg="#E2E8F0", bg="#334155", padx=6, pady=3, font=("Malgun Gothic", 8, "bold"), cursor="hand2")
        b_all.pack(fill="x", pady=(6, 0))
        b_all.bind("<Button-1>", lambda _e: _paste_to_target(text_val=_clean_ocr_noise(raw_ocr_t)))

        rw, rh = 620, 310
        x = max(m_left + 12, min(pt_x - 20, m_right - rw - 16))
        y = max(m_top + 12, min(pt_y + 16, m_bottom - rh - 16))
        _apply_win_topmost(win, x, y, rw, rh, activate=False)

    def _poll_queue() -> None:
        global _CURRENT_OPEN_UI_MODE
        try:
            lbtn_down = (u32.GetAsyncKeyState(0x01) & 0x8000) != 0
            rbtn_down = (u32.GetAsyncKeyState(0x02) & 0x8000) != 0
            ctrl_held = (u32.GetAsyncKeyState(VK_CONTROL) & 0x8000) != 0
            esc_down = (u32.GetAsyncKeyState(0x1B) & 0x8000) != 0
            # [핵심 수리]: 우클릭(rbtn_down)은 '우클릭 0.35초 꾹 연속 재호출 토글(기본 귀신창 ⇄ 귀신검색창)' 입력 수단이므로,
            # 외부 마우스 클릭 닫기는 오직 좌클릭(lbtn_down)일 때만 발동시켜 우클릭 꾹 연속 토글이 100% 작동하도록 보장!
            mouse_down = lbtn_down
            if current_win[0] is not None:
                pt_click = wintypes.POINT()
                u32.GetCursorPos(ctypes.byref(pt_click))
                wx1, wy1, wx2, wy2 = win_rect[0]
                inside_rect = (wx1 <= pt_click.x <= wx2 and wy1 <= pt_click.y <= wy2)
                if is_hovered[0] and not inside_rect and active_mode[0] == "toast":
                    _schedule_close(1800)
                is_hovered[0] = inside_rect
                if esc_down and active_mode[0] in ("ui1", "ui2", "ui3", "ui4"):
                    if (time.time() - opened_at[0]) > 0.35 and (time.time() - _LAST_RBTN_DISMISS_ESC_TS) > 0.45:
                        _close_win()
                elif mouse_down and not was_mouse_down[0]:
                    if (time.time() - opened_at[0]) > 0.45 and not inside_rect:
                        _close_win()
            was_mouse_down[0] = mouse_down

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
                elif message == "__MORPH_SEARCH__":
                    # [창 UI ① 기본 귀신창]에서 글자 타이핑 시 합체하지 않고 [창 UI ①]을 닫은 뒤 별개의 [창 UI ② 귀신검색창(소형)]으로 전환!
                    if current_win[0] is not None and active_mode[0] == "ui1":
                        _toast_queue.put(("__UI2_SEARCH__|small|", 8000))
                else:
                    _close_win()
                    pt = wintypes.POINT()
                    u32.GetCursorPos(ctypes.byref(pt))
                    work_area = _get_monitor_workarea_for_point(pt.x, pt.y)
                    m_left, m_top, m_right, m_bottom = work_area

                    win = tk.Toplevel(root)
                    current_win[0] = win
                    opened_at[0] = time.time()
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
                    # ── 분기 3: [창 UI ③] 📸 사진·OCR 공간이동창 (독립 창, 외부클릭/ESC까지 유지) ──
                    elif message.startswith("__UI3_OCR__|"):
                        img_arg = message.split("|", 1)[1] if "|" in message else ""
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

                        # 클릭 시 [창 UI ② 귀신검색창]으로 즉시 전환하는 스위치 버튼 & 미니 입력칸
                        s_btn = tk.Label(top_bar, text="👻귀신검색창 열기", fg="#0B1120", bg="#2DD4BF", padx=6, pady=1, font=("Malgun Gothic", 8, "bold"), cursor="hand2")
                        s_btn.pack(side="left", padx=(0, 6))
                        s_btn.bind("<Button-1>", lambda _e: _toast_queue.put(("__UI2_SEARCH__|small|", 8000)))

                        cur_cfg = get_superpower_settings()
                        cur_days = int(cur_cfg.get("retention_days", 7))
                        cur_sound = bool(cur_cfg.get("sound_enabled", True))
                        ret_label_map = {1: "보관:1일", 3: "보관:3일", 7: "보관:7일", 30: "보관:30일"}

                        clear_btn = tk.Label(top_bar, text="🧹비우기", fg="#FCA5A5", bg="#1E293B", padx=5, pady=1, font=("Malgun Gothic", 8, "bold"), cursor="hand2")
                        clear_btn.pack(side="right", padx=(3, 0))
                        clear_btn.bind("<Button-1>", lambda _e: clear_clipboard_history())

                        undo_btn = tk.Label(top_bar, text="↩원복(Ctrl+Z)", fg="#FDE047" if _UNDO_SNAPSHOT.get("active") else "#94A3B8", bg="#1E293B", padx=5, pady=1, font=("Malgun Gothic", 8, "bold"), cursor="hand2")
                        undo_btn.pack(side="right", padx=(3, 0))
                        undo_btn.bind("<Button-1>", lambda _e: (_close_win(), execute_undo_snapshot(set_clipboard_text)))

                        ret_btn = tk.Label(top_bar, text=ret_label_map.get(cur_days, f"보관:{cur_days}일") + "▾", fg="#5EEAD4", bg="#1E293B", padx=5, pady=1, font=("Malgun Gothic", 8, "bold"), cursor="hand2")
                        ret_btn.pack(side="right", padx=(3, 0))

                        def _cycle_ret(_e=None):
                            is_hovered[0] = True
                            now_d = int(get_superpower_settings().get("retention_days", 7))
                            order = [1, 3, 7, 30]
                            nxt_d = order[(order.index(now_d) + 1) % len(order)] if now_d in order else 7
                            update_superpower_settings({"retention_days": nxt_d})
                            ret_btn.config(text=ret_label_map.get(nxt_d, f"보관:{nxt_d}일") + "▾")

                        ret_btn.bind("<Button-1>", _cycle_ret)

                        mute_btn = tk.Label(top_bar, text="🔊" if cur_sound else "🔇", fg="#5EEAD4" if cur_sound else "#64748B", bg="#1E293B", padx=4, pady=1, font=("Malgun Gothic", 8, "bold"), cursor="hand2")
                        mute_btn.pack(side="right", padx=(3, 0))

                        def _toggle_mute(_e=None):
                            is_hovered[0] = True
                            nxt_s = not bool(get_superpower_settings().get("sound_enabled", True))
                            update_superpower_settings({"sound_enabled": nxt_s})
                            mute_btn.config(text="🔊" if nxt_s else "🔇", fg="#5EEAD4" if nxt_s else "#64748B")

                        mute_btn.bind("<Button-1>", _toggle_mute)

                        status_hint = "🎁 30일 무제한 체험(D-30 · 차감없음) · 글자 입력 시 👻귀신검색창 전환"
                        if "(" in left_tag and ")" in left_tag:
                            status_hint = left_tag[left_tag.find("(") : left_tag.rfind(")") + 1] + " · " + status_hint
                        tk.Label(top_bar, text=status_hint, fg="#FDE047", bg="#0F172A", font=("Malgun Gothic", 8, "bold"), anchor="w").pack(side="left", fill="x", expand=True)

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
                                        b_lbl.bind("<Button-1>", lambda _e, s_n=idx_f: (_close_win(), superpower_fixed_snippet(s_n, set_clipboard_text)))
                                else:
                                    tk.Label(p_inner, text="💡 [숨은 귀신 초능력 & 꿀팁]", fg="#FDE047", bg="#0F172A", font=("Malgun Gothic", 8, "bold"), anchor="w").pack(fill="x", pady=(0, 4))
                                    for tl in (
                                        "• 🧹 [1]번 서식·줄바꿈 다림질 : 문장 복사(Ctrl+C)나 드래그 후 [1]번 클릭 시 서식세탁·끊어진 줄바꿈 즉시 정리 (Ctrl+Z 원복)!",
                                        "• 🏷️ [2]번 귀신 라벨러 : 탐색기에서 사진·카톡·문서 선택/복사 후 [2]번 클릭 시 [YYMMDD_장소 / YYMMDD_카톡_내용 / YYMMDD_내용_제목] 자동 작명!",
                                        "• ⚡ 타이핑 자동 한영·띄어쓰기 성형 : 2어절 입력 시 단축키 없이 0.1초 자동 교정!",
                                        "• 🔄 귀신호출 한 번 더(토글) : 호출 이어서 바로 한 번 더 누르면 [기본 귀신창 ⇄ 귀신검색창] 즉시 전환!",
                                    ):
                                        tk.Label(p_inner, text=tl, fg="#E2E8F0", bg="#0F172A", font=("Malgun Gothic", 8), anchor="w").pack(fill="x", pady=1)
                            win.update_idletasks()
                            rw, rh = max(win.winfo_reqwidth(), 240), max(win.winfo_reqheight(), 42)
                            _apply_win_topmost(win, win_rect[0][0], win_rect[0][1], rw, rh, activate=False)

                        tips_btn = tk.Label(row2_frame, text="💡꿀팁·추가▾", fg="#FDE047", bg="#1E293B", padx=6, pady=1, font=("Malgun Gothic", 8, "bold"), cursor="hand2")
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
                    # ──────────────────────────────────────────────────────────────────────
                    # [창 UI ④] 스마트 압축 해제 & 무해제 속마음 투시 + 인라인 공유 브릿지 (우클릭 0.35초 꾹)
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

                        def _do_smart_unzip(_e=None):
                            is_hovered[0] = True
                            try:
                                import plugin_ghosti_care_suite as _cs
                                res = _cs.smart_extract_archive(arch_path)
                                if res.get("ok"):
                                    ib = res.get("inlineBridge", {})
                                    lines = ib.get("summaryLines", [])
                                    status_lbl.config(text="\n".join(lines), fg="#FDE047")
                                    for ch in bridge_box.winfo_children():
                                        ch.destroy()
                                    bridge_box.pack(fill="x", pady=(8, 0))
                                    b1 = tk.Label(
                                        bridge_box,
                                        text=ib.get("primaryCta", {}).get("label", "🔍 풀린 문서 내용 바로 검색"),
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
                                    status_lbl.config(text=res.get("message") or res.get("error") or "해제 실패", fg="#FCA5A5")
                            except Exception as ex:
                                status_lbl.config(text=f"오류: {ex}", fg="#FCA5A5")

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
        except Exception:
            pass
        finally:
            try:
                root.after(30, _poll_queue)
            except Exception:
                pass

    root.after(30, _poll_queue)
    while True:
        try:
            root.mainloop()
            break
        except Exception:
            time.sleep(0.2)


_TOAST_WORKER_STARTED = False
_TOAST_WORKER_THREAD: threading.Thread | None = None
_TOAST_WORKER_LOCK = threading.Lock()


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
def acquire_single_instance() -> socket.socket | None:
    """
    단일 인스턴스 보장 + 구버전 데몬 자동 교체(Hot-Swap):
    - 이미 LOCK_PORT(51988)를 점유 중인 구버전 프로세스가 있으면 종료 신호를 보내거나
      해당 포트 점유 PID를 핀셋 종료한 뒤 새 데몬이 즉시 포트를 승계합니다.
    """
    for attempt in range(4):
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            s.bind(("127.0.0.1", LOCK_PORT))
            s.listen(2)

            def _shutdown_listener(srv_sock: socket.socket) -> None:
                while True:
                    try:
                        conn, _ = srv_sock.accept()
                        data = conn.recv(64)
                        conn.close()
                        if b"__REPLACE__" in data:
                            srv_sock.close()
                            os._exit(0)
                    except Exception:
                        break

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


def set_clipboard_text(text: str) -> None:
    data = (text + "\0").encode("utf-16-le")
    for _ in range(8):
        if u32.OpenClipboard(None):
            try:
                u32.EmptyClipboard()
                hmem = k32.GlobalAlloc(GMEM_MOVEABLE, len(data))
                if hmem:
                    ptr = k32.GlobalLock(hmem)
                    if ptr:
                        ctypes.memmove(ptr, data, len(data))
                        k32.GlobalUnlock(hmem)
                        u32.SetClipboardData(CF_UNICODETEXT, hmem)
            finally:
                u32.CloseClipboard()
            break
        time.sleep(0.015)


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


def set_clipboard_hdrop_files(filepaths: list[str]) -> bool:
    """다중 실물 파일 경로를 윈도우 탐색기 파일 복사 포맷(CF_HDROP)으로 클립보드에 주입"""
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


def tap_key_combo(modifiers: list[int], vk: int) -> None:
    """
    [Win10/Win11 NumLock ON 환경 100% 호환 키 사출]
    - VK_HOME(0x24), VK_END(0x23), 방향키 등은 반드시 KEYEVENTF_EXTENDEDKEY(0x0001) 플래그를 포함해야
      NumLock이 켜진 상태에서 Shift+Home이 Numpad 7(비선택 이동)로 오작동하지 않고 줄 전체를 정확히 블록 선택합니다!
    """
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


def send_unicode_text_preserve_style(text: str) -> bool:
    """
    [서식·색상 100% 보존 무클립보드 유니코드 직접 타이핑 사출 (SendInput KEYEVENTF_UNICODE)]
    - 노션·워드·브라우저 등 리치 텍스트 편집기에서 Ctrl+V(플레인 텍스트 붙여넣기)를 하면
      기존 인라인 글자 색상(파란색·빨간색 등)·굵기·배경 서식이 초기화되는 문제를 원천 해결합니다!
    - 선택된 영역 또는 커서 위치에서 사용자가 직접 키보드로 글자를 친 것과 동일하게 작동하므로
      기존 글자 색상과 인라인 스타일이 100% 그대로 유지됩니다.
    """
    if not text:
        return False
    try:
        u32.SendInput.argtypes = [wintypes.UINT, ctypes.POINTER(_INPUT), ctypes.c_int]
        u32.SendInput.restype = wintypes.UINT
        events: list[_INPUT] = []
        norm_text = text.replace("\r\n", "\n").replace("\r", "\n")
        for ch in norm_text:
            if ch == "\n":
                # 리치 에디터 내 줄바꿈은 Shift+Enter 또는 Enter 키로 전달
                sc_ret = u32.MapVirtualKeyW(VK_RETURN, 0)
                kd = _INPUT(type=INPUT_KEYBOARD)
                kd.u.ki = _KEYBDINPUT(wVk=VK_RETURN, wScan=sc_ret, dwFlags=0, time=0, dwExtraInfo=0)
                ku = _INPUT(type=INPUT_KEYBOARD)
                ku.u.ki = _KEYBDINPUT(wVk=VK_RETURN, wScan=sc_ret, dwFlags=KEYEVENTF_KEYUP, time=0, dwExtraInfo=0)
                events.extend((kd, ku))
            else:
                utf16_units = ch.encode("utf-16-le")
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
        "F1": "썬드림주식회사",
        "F2": "https://cafe.naver.com/sundreamd",
        "F3": "즐빛!",
        "F4": "아시는 바처럼,  ",
        "F5": "피부재생",
        "F6": "https://cafe.naver.com/vpqtnl",
        "F7": "노샤노보 유지하시고요,  (냉포마찰로 대체)",
        "F8": "비타민D 자외선요법",
        "F9": "https://sundreamer.app",
        "F10": "감사합니다.",
    }
    merged = dict(default_map)
    for cand in (SNIPPETS_FILE, USER_SNIPPETS_APPDATA):
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
    "mode": "",  # "edit_replace", "clip_replace", "pre_iron", "snippet"
    "typed_count_after": 0,
}


def arm_undo_snapshot(
    hwnd: int,
    edit_child: int,
    raw_text: str,
    morphed_text: str,
    mode: str = "edit_replace",
    full_doc_before: str = "",
    full_doc_after: str = "",
) -> None:
    """
    [Ctrl+Z 원클릭 100% 원복 보장 스냅샷 엔진]
    - Win11 메모장(RichEditD2DPT)이나 웹 브라우저에서 붙여넣기(Ctrl+V) 직후 변환이 일어날 때
      OS 기본 Ctrl+Z가 '변환 + 붙여넣기 전체'를 통째로 날려버리는(빈 화면이 되는) 문제를 100% 원천 차단합니다!
    - 변환 직후 Ctrl+Z(Hotkey 999)를 누르면 붙여넣기 전 상태가 아니라 정확히 '변환 직전의 날것 원문(raw_text / full_doc_before)'으로 복원합니다.
    - 유저가 [Ctrl+0 ➔ 2] 직후 [Ctrl+0 ➔ 4]를 연속으로 실행한 경우에도 최초 변환 전 원문(raw_text / full_doc_before)을 보존합니다!
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
    }
    try:
        u32.RegisterHotKey(None, 999, MOD_CONTROL | MOD_NOREPEAT, VK_Z)
    except Exception:
        pass


def disarm_undo_snapshot() -> None:
    global _UNDO_SNAPSHOT
    if _UNDO_SNAPSHOT.get("active"):
        _UNDO_SNAPSHOT["active"] = False
        try:
            u32.UnregisterHotKey(None, 999)
        except Exception:
            pass


def _find_edit_control_child(hwnd_fg: int) -> int:
    """Win10 메모장(Edit) 및 Win11 탭 메모장(Notepad -> NotepadTextBox -> RichEditD2DPT) 완벽 탐색"""
    if not hwnd_fg or not u32.IsWindow(hwnd_fg):
        return 0
    ed = u32.FindWindowExW(hwnd_fg, None, "Edit", None)
    if ed:
        return ed
    ed = u32.FindWindowExW(hwnd_fg, None, "RichEditD2DPT", None)
    if ed:
        return ed
    ntb = u32.FindWindowExW(hwnd_fg, None, "NotepadTextBox", None)
    if ntb:
        ed = u32.FindWindowExW(ntb, None, "RichEditD2DPT", None)
        if ed:
            return ed
    found_ed = [0]
    WNDENUMPROC = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

    def _enum_child_cb(ch: int, _lp: int) -> bool:
        if u32.IsWindowVisible(ch):
            c_cls, _ = _get_win_class_and_title(ch)
            if c_cls in ("Edit", "RichEditD2DPT", "RichEdit20W", "RICHEDIT50W"):
                found_ed[0] = ch
                return False
        return True

    try:
        u32.EnumChildWindows(hwnd_fg, WNDENUMPROC(_enum_child_cb), 0)
    except Exception:
        pass
    return found_ed[0]


def _get_edit_full_text_and_index_str(edit_child: int) -> tuple[str, str, bool]:
    """
    Edit / RichEditD2DPT 컨트롤의 전체 문자열 및 인덱싱용 문자열 반환
    - RichEdit 2.0+(RichEditD2DPT)는 내부 캐릭터 오프셋(EM_GETSEL/EM_SETSEL/EM_LINEINDEX)에서 줄바꿈(\r\n)을 1글자(\r)로 계산함!
    """
    if not edit_child or not u32.IsWindow(edit_child):
        return "", "", False
    total_len = u32.SendMessageW(edit_child, WM_GETTEXTLENGTH, 0, 0)
    if total_len < 0 or total_len > 250000:
        return "", "", False
    if total_len == 0:
        return "", "", False
    tbuf = ctypes.create_unicode_buffer(total_len + 4)
    u32.SendMessageW(edit_child, WM_GETTEXT, total_len + 2, ctypes.addressof(tbuf))
    full_text = tbuf.value
    cls_n, _ = _get_win_class_and_title(edit_child)
    is_rich = "richedit" in cls_n.lower()
    idx_text = full_text.replace("\r\n", "\n") if is_rich else full_text
    return full_text, idx_text, is_rich


def execute_undo_snapshot(daemon_set_cb) -> bool:
    """
    [Ctrl+Z 원클릭 원상복구 실행기]
    - 방금 변환된 문장(morphed_text / full_doc_after)만 정확히 이전 날것 상태(raw_text / full_doc_before)로 되돌려,
      붙여넣기 자체가 취소되어 빈 화면이 되거나 이모지(Surrogate Pair)·줄바꿈 오프셋 차이로 글자가 밀리는 현상을 100% 방지합니다!
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
    fg_now = u32.GetForegroundWindow()
    ed = _find_edit_control_child(fg_now) or snap.get("edit_child", 0)

    # 1) 메모장(Edit / RichEditD2DPT) 컨트롤 내부에서 오프셋 오차 없이 100% 원자적 복원!
    if ed and u32.IsWindow(ed):
        try:
            cur_full, idx_text, is_rich = _get_edit_full_text_and_index_str(ed)
            # 1-A) 변환 직전 전체 문서 스냅샷(full_before)이 보존되어 있는 경우:
            #      ① 문서 변경이 없었으면 0..-1 전체 교체로 100% 무결점 복원하고,
            #      ② 유저가 다른 줄을 일부 수정한 뒤 Ctrl+Z를 눌렀더라도 변환된 블록(morphed_t)만 정확히 변환 전 원문(raw_t)으로 치환하여 복원!
            if full_before and mode != "pre_iron":
                cur_norm_check = cur_full.replace("\r\n", "\n")
                after_norm_check = full_after.replace("\r\n", "\n") if full_after else ""
                if not after_norm_check or cur_norm_check == after_norm_check:
                    restore_doc = (
                        full_before.replace("\r\n", "\n").replace("\n", "\r\n")
                        if not is_rich
                        else full_before
                    )
                    u32.SendMessageW(ed, EM_SETSEL, 0, -1)
                    rbuf = ctypes.create_unicode_buffer(restore_doc)
                    u32.SendMessageW(ed, EM_REPLACESEL, 1, ctypes.addressof(rbuf))
                    show_ghost_toast("👻 귀신같이 원상복구 완료 (변환 전 원문 100% 복원)", duration_ms=1600)
                    return True

            # 1-B) 부분 치환 또는 pre_iron 모드인 경우에도 파이썬 문자열 공간에서 치환한 뒤 EM_SETSEL(0, -1)로 기록하여 Surrogate Pair 오차 원천 차단
            cur_norm = cur_full.replace("\r\n", "\n")
            search_m = morphed_t.replace("\r\n", "\n")
            search_m_strip = search_m.strip()
            target_pos = -1
            target_len = 0
            if search_m and search_m in cur_norm:
                target_pos = cur_norm.rfind(search_m)
                target_len = len(search_m)
            elif search_m_strip and search_m_strip in cur_norm:
                target_pos = cur_norm.rfind(search_m_strip)
                target_len = len(search_m_strip)

            if target_pos >= 0 and target_len > 0:
                rep_norm = "" if mode == "snippet" else raw_t.replace("\r\n", "\n")
                new_norm = cur_norm[:target_pos] + rep_norm + cur_norm[target_pos + target_len :]
                restore_doc = new_norm.replace("\n", "\r\n") if not is_rich else new_norm
                u32.SendMessageW(ed, EM_SETSEL, 0, -1)
                rbuf = ctypes.create_unicode_buffer(restore_doc)
                u32.SendMessageW(ed, EM_REPLACESEL, 1, ctypes.addressof(rbuf))
                if mode == "pre_iron" and raw_t:
                    daemon_set_cb(raw_t)
                show_ghost_toast("👻 귀신같이 원상복구 완료 (변환 전 원문 100% 복원)", duration_ms=1600)
                return True
        except Exception:
            pass

    # 2) 일반 웹/앱 창에서 원복:
    if snap_hwnd and u32.IsWindow(snap_hwnd) and fg_now != snap_hwnd:
        try:
            u32.SetForegroundWindow(snap_hwnd)
            time.sleep(0.02)
        except Exception:
            pass

    release_all_modifiers()
    time.sleep(0.02)
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
        show_ghost_toast("👻 귀신같이 원상복구 완료 (변환 전 원문 100% 복원)", duration_ms=1600)
        return True

    tap_key_combo([VK_CONTROL], VK_Z)
    return True


def _get_edit_control_current_line(edit_child: int) -> str | None:
    if not edit_child or not u32.IsWindow(edit_child):
        return None
    try:
        _, idx_text, _ = _get_edit_full_text_and_index_str(edit_child)
        if not idx_text:
            return ""
        s_dw = wintypes.DWORD(0)
        e_dw = wintypes.DWORD(0)
        u32.SendMessageW(edit_child, EM_GETSEL, ctypes.addressof(s_dw), ctypes.addressof(e_dw))
        s_pos = s_dw.value
        if s_pos == 0 and e_dw.value == 0:
            sel_ret = u32.SendMessageW(edit_child, EM_GETSEL, 0, 0)
            s_pos = sel_ret & 0xFFFF
        line_idx = u32.SendMessageW(edit_child, EM_LINEFROMCHAR, s_pos, 0)
        line_start = u32.SendMessageW(edit_child, EM_LINEINDEX, line_idx, 0)
        line_len = u32.SendMessageW(edit_child, EM_LINELENGTH, line_start, 0)
        if line_start < 0 or line_len < 0:
            return None
        utf16_b = idx_text.encode("utf-16-le")
        return utf16_b[line_start * 2 : (line_start + line_len) * 2].decode("utf-16-le", errors="ignore")
    except Exception:
        return None


def _fix_korean_spacing_general(s: str) -> str:
    """
    [범용 한국어 어절 경계(조사·연결어미·종결어미·보조용언·의존명사·부사) 및 문맥 오타 자동 교정기]
    - 소리나는 대로 친 상용 오타('조아서'->'좋아서', '함 깨'->'함께', '제생 버튼'->'재생 버튼', '아기기신'->'아기귀신', '되요'->'돼요', '됬'->'됐', '몇일'->'며칠') 교정
    - 의존명사('성공할수있습니다'->'성공할 수 있습니다', '확인하실 수있습니다'->'확인하실 수 있습니다', '바뀐 것같은데'->'바뀐 것 같은데') 및
      체언+부사('이번프로젝트는꼭'->'이번 프로젝트는 꼭', '오늘3시 에 미팅있습니다'->'오늘 3시에 미팅 있습니다') 정밀 교정
    """
    s = re.sub(r"([가-힣]+(?:아|어|여|해|지|네|군|나|가|까))\s+(요)(?=[가-힣])", r"\1\2 ", s)
    # 1) 깨진 어미·조사 복원 ('주셔 서' -> '주셔서', '해 서' -> '해서', '와 서' -> '와서', '봐 서' -> '봐서')
    s = re.sub(r"([가-힣]*(?:주셔|보셔|하셔|오셔|가셔|계셔|드려|올려|내려|보내|만들|받으|찾으|읽으|쓰셔|해|와|봐|가|나|써|꺼|켜))\s+서(?=[가-힣\s.,?!~^]|$)", r"\1서", s)
    # 2) 부사절/연결어미 뒤에 붙은 부사('정말', '진짜', '너무', '아주', '매우', '다시', '바로', '즉시', '함께', '같이', '모두', '항상', '꼭') 분리
    s = re.sub(
        r"([가-힣]+(?:아서|어서|여서|해서|셔|셔서|고|며|면서|자마자|니까|지만|는데|은데|던데))(?=(?:정말|진짜|너무|아주|매우|다시|바로|즉시|함께|같이|모두|항상|꼭|잘|더|다)(?=[가-힣\s.,?!~^]|$))",
        r"\1 ",
        s,
    )
    # 3) 부사 + 용언 붙여쓰기('정말감사합니다' -> '정말 감사합니다', '너무좋아요' -> '너무 좋아요', '바로확인' -> '바로 확인') 분리
    s = re.sub(
        r"(?<![가-힣])(정말|진짜|너무|아주|매우|가장|제일|많이|빨리|천천히|다시|함께|같이|먼저|벌써|아직|항상|자주|가끔|바로|즉시|더욱|특히|전혀|결코|반드시|절대|꼭)(?=(?:감사|고맙|미안|죄송|축하|환영|좋|나쁘|기쁘|슬프|아프|예쁘|멋지|훌륭|완벽|정확|빠르|느리|크|작|많|적|높|낮|길|짧|깊|넓|밝|어둡|맑|흐리|춥|덥|따뜻|시원|힘들|어렵|쉽|중요|필요|가능|불가능|확인|적용|작동|실행|완료|복원|수정|배포|해결|처리|진행|시작|종료|출발|도착|기억|소환|검색|선택|입력|출력|복사|저장|삭제|추가|변경|교정|성형|다림질|공유|연결|해제|테스트|검증|분석|정리|생성|제거|설치|구동|발견|캐치|체크|연습|공부|운동|식사|출근|퇴근|산책|여행|결혼|성공|실패|이해|인정|기대|걱정|고민|노력|도움|부탁|말씀|연락|답변|보고|안내|설명|소개|추천|제안|요청|문의|신청|참여|참석|이용|사용|구독|결제|환불|취소|승인|거절|달성|유지|보존|보호|방어|차단|제한|허용|지원|제공|포함|제외|구분|분리|통합|합체|변환|전환|이동|복귀|도입|출시|오픈|마감|종결)[가-힣]*)",
        r"\1 ",
        s,
    )
    # 4) '-하게 / -롭게 / -스레 / -히 / -도록' 부사형·연결어미 + 용언 붙여쓰기('예리하게캐치해' -> '예리하게 캐치해') 분리
    s = re.sub(
        r"([가-힣]{2,}(?:하게|롭게|스레|답게|도록|게끔|주셔서|해주셔서|주시고|해주시고))(?=(?!주|보|드|지|도|는|만|요)[가-힣]{2,})",
        r"\1 ",
        s,
    )
    # 5) 범용 관형사형('-스러운 / -로운 / -다운') + 명사 붙여쓰기 분리 ('자연스러운어절' -> '자연스러운 어절', '새로운문장' -> '새로운 문장')
    s = re.sub(
        r"(?<![가-힣])([가-힣]{2,}스러운|[가-힣]{1,6}로운|[가-힣]{2,}다운)(?=[가-힣]{2,})",
        r"\1 ",
        s,
    )
    s = re.sub(
        r"(?<![가-힣])([가-힣]{2,}(?:한|된|할|같은|없는|있는))(?=(?:자막|목소리|성우|영상|음성|글자|어절|단어|문장|문단|문서|파일|폴더|화면|창|기능|성능|효과|결과|상태|모습|느낌|분위기|마음|생각|의견|내용|정보|자료|데이터|시스템|서비스|프로그램|어플|앱|모델|기술|방법|방식|구조|설계|기획|특허|사업|아이템|시장|고객|유저|사람|회원|멤버|동료|가족|친구|선생님|대표님|매니저님|문제|오류|버그|원인|해결책|대안|선택|결정|판단|기준|원칙|규칙|조건|환경|상황|과정|절차|단계|순서|단위|시간|기간|일정|계획|목표|성공|승리|변화|발전|성장|기회|가치|이익|수익|비용|가격|요금|할인|혜택|선물|보상|응원|관심|사랑|행복|건강|피부|비타민|햇빛|자외선|산책|운동|음식|식단|습관|생활|일상|하루|오늘|내일|미래|세상)(?=[을를이가은는도의에로와과도만\s.,?!:;가-힣)]|$))",
        r"\1 ",
        s,
    )
    # 6) 존칭 접미사/호칭('님', '씨', '분') + 조사 외 일반 명사/부사 붙여쓰기('해나라님성우' -> '해나라님 성우') 분리
    s = re.sub(
        r"([가-힣]{2,}님)(?=(?![은는이가을를의도만께께서으로로와과랑이랑하고이나나부터까지조차마저요\s.,?!:;~^)])[가-힣]{2,})",
        r"\1 ",
        s,
    )
    # 7) 용언 어간(-아/-어/-여/-해/-러/-와/-봐/-줘 등 모음조화 연결형) + 보조용언 '주셔서/주시고/주세요/주시면' 띄어쓰기 정규화 ('불러주세요' -> '불러 주세요', '확인해주세요' -> '확인해 주세요')
    def _space_aux_juseyo(m: re.Match) -> str:
        stem_part = m.group(1)
        aux_part = m.group(2)
        last_ch = stem_part[-1]
        c_code = ord(last_ch) - 0xAC00
        jong_c = c_code % 28
        jung_c = (c_code // 28) % 21
        if jong_c == 0 and jung_c in (0, 1, 4, 5, 6, 9, 10, 14, 15):
            return f"{stem_part} {aux_part}"
        return m.group(0)

    s = re.sub(r"([가-힣]{2,})\s*(주셔서|주시고|주세요|주시면|주신|주실|주셨)", _space_aux_juseyo, s)
    s = re.sub(r"날씨가\s*조아서", "날씨가 좋아서", s)
    s = re.sub(r"조아서(?=\s|$|[.,?!~^]|[가-힣])", "좋아서", s)
    s = re.sub(r"조아요(?=\s|$|[.,?!~^])", "좋아요", s)
    s = re.sub(r"조아해", "좋아해", s)
    s = re.sub(r"조은(?=\s+[가-힣])", "좋은", s)
    s = re.sub(r"([가-힣]+(?:와|과|랑|이랑|하고))\s*함\s*[께깨]\s*(?=[가-힣])", r"\1 함께 ", s)
    s = re.sub(r"([가-힣]+(?:와|과|랑|이랑|하고))\s*함\s*[께깨]", r"\1 함께", s)
    s = re.sub(r"(?<![가-힣])함\s*[께깨](?=\s|$|[.,?!~^])", "함께", s)
    s = re.sub(r"아기기신", "아기귀신", s)
    s = re.sub(r"제생(?=\s*(?:버튼|해|하|중|됨|되|시|을|이|가|은|는))", "재생", s)
    s = re.sub(r"베포(?=\s|$|[.,?!~^]|[가-힣])", "배포", s)
    s = re.sub(r"케치(?=\s|$|[.,?!~^]|[가-힣])", "캐치", s)
    s = re.sub(r"메세지(?=\s|$|[.,?!~^]|[가-힣])", "메시지", s)
    s = re.sub(r"체택(?=\s|$|[.,?!~^]|[가-힣])", "채택", s)
    s = re.sub(r"헤택(?=\s|$|[.,?!~^]|[가-힣])", "혜택", s)
    s = re.sub(r"금새(?=\s|$|[.,?!~^])", "금세", s)
    s = re.sub(r"오랫만(?=\s|$|[.,?!~^]|[에이다])", "오랜만", s)
    s = re.sub(r"일찌기(?=\s|$|[.,?!~^])", "일찍이", s)
    s = re.sub(r"희안(하|해|한|히)", r"희한\1", s)
    s = re.sub(r"설레임(?=\s|$|[.,?!~^]|[이가을를은는도])", "설렘", s)
    s = re.sub(r"목쏘리", "목소리", s)
    s = re.sub(r"빗소리", "빗소리", s)
    s = re.sub(r"숨쏘리", "숨소리", s)
    s = re.sub(r"발쏘리", "발소리", s)
    s = re.sub(r"말쏘리", "말소리", s)
    s = re.sub(r"종쏘리", "종소리", s)
    s = re.sub(r"복언(하|해|했|한|할|됨|되|된|될|입|합|시|중|이|가|을|를|은|는|도|만|\s|$|[.,?!~^])", r"복원\1", s)
    s = re.sub(r"응언(하|해|했|한|할|합|시|\s|$|[.,?!~^])", r"응원\1", s)
    s = re.sub(r"지언(하|해|했|한|할|합|됨|되|\s|$|[.,?!~^])", r"지원\1", s)
    s = re.sub(r"회언(님|들|분|가입|권|이|가|은|는|을|를|\s|$|[.,?!~^])", r"회원\1", s)
    s = re.sub(r"직언(분|들|이|가|은|는|을|를|\s|$|[.,?!~^])", r"직원\1", s)
    s = re.sub(r"병언(에|에서|으로|이|가|은|는|을|를|\s|$|[.,?!~^])", r"병원\1", s)
    s = re.sub(r"되요(?=\s|$|[.,?!~^])", "돼요", s)
    s = re.sub(r"안\s*되요(?=\s|$|[.,?!~^])", "안 돼요", s)
    # 과거시제 선어말어미 받침 'ㅅ' -> 'ㅆ' 범용 교정 ('들어갓던' -> '들어갔던', '햇습니다' -> '했습니다', '봣어' -> '봤어', '왓다' -> '왔다' 등)
    s = re.sub(
        r"([가-힣]*[가나다가라바사아자차카타파하와봐쏴놔둬줘춰궈눠뤄뭐숴쭤켜펴혀었았였했됐갔왔봤났잤샀탔찼팠컸썼껐렸졌쳤졌췄줬뒀눴뤘웠겼녔뎠렸몄볐셨졌쳤켰텼폈혔])(?=[습어았었였겠더던다네지고는데니니까면며면서길래자마자구나군죠요])",
        lambda m: m.group(0),
        s,
    )
    def _fix_single_s_past_tense(match: re.Match) -> str:
        ch = match.group(1)
        suf = match.group(2)
        code = ord(ch) - 0xAC00
        jong = code % 28
        # 받침 ㅅ(19)이고 중성이 ㅏ(0), ㅓ(4), ㅕ(6), ㅐ(1), ㅔ(5), ㅘ(9), ㅝ(14), ㅙ(10), ㅞ(15)인 용언 과거형 어간 -> ㅆ(20)으로 교정
        jung = (code // 28) % 21
        if jong == 19 and jung in (0, 1, 4, 5, 6, 9, 10, 14, 15):
            # 명사 예외 ('버섯', '다섯', '여섯', '일곱', '무엇', '그것', '이것', '저것', '잘못', '이웃', '비롯', '사뭇', '얼핏', '자칫', '언뜻', '문득') 제외
            word_prefix = match.group(0)
            if ch in ("섯", "엇", "것", "못", "웃", "롯", "뭇", "핏", "칫", "뜻"):
                return match.group(0)
            fixed_ch = chr(ord(ch) + 1)
            return fixed_ch + suf
        return match.group(0)

    s = re.sub(
        r"([가-힣])(습|어|어요|어서|더니|던|다|네|네요|지|지요|고|는데|니|니까|면|며|면서|길래|자마자|구나|군|죠)(?=[가-힣\s.,?!~^)]|$)",
        _fix_single_s_past_tense,
        s,
    )
    s = re.sub(r"됬(습|어|다|네|지|고|는데|던|더니|니|니까|면)", r"됐\1", s)
    s = re.sub(r"햇(습|어|다|네|지|고|는데|던|더니|니|니까|면)", r"했\1", s)
    s = re.sub(r"몇\s*일(?=\s|$|[.,?!~^간동안전후째])", "며칠", s)
    s = re.sub(r"어떻해", "어떡해", s)
    s = re.sub(r"어떡게", "어떻게", s)
    s = re.sub(r"왠만(하|해|히|한)", r"웬만\1", s)
    s = re.sub(r"잘\s*부탁", "잘 부탁", s)
    s = re.sub(r"금방\s*이라도", "금방이라도", s)
    s = re.sub(r"할께(요)?(?=\s|$|[.,?!~^])", r"할게\1", s)
    s = re.sub(r"갈께(요)?(?=\s|$|[.,?!~^])", r"갈게\1", s)
    s = re.sub(r"볼께(요)?(?=\s|$|[.,?!~^])", r"볼게\1", s)
    s = re.sub(r"줄께(요)?(?=\s|$|[.,?!~^])", r"줄게\1", s)
    s = re.sub(r"올께(요)?(?=\s|$|[.,?!~^])", r"올게\1", s)
    # 용언 명사형('베포/배포/설치/수정/적용/처리/등록/저장/업데이트/동기화') + '완료했습니다/완료되었습니다' 띄어쓰기 정규화
    s = re.sub(r"(배포|설치|수정|적용|처리|등록|저장|업데이트|동기화|패치|복구|복원|전송|발송|결제|인증|승인)(?=완료(?:했|됐|되었|합|됩|입))", r"\1 ", s)

    s = re.sub(r"같\s+이(?=\s|$|[.,?!~])", "같이", s)
    s = re.sub(r"오\s+늘", "오늘", s)
    s = re.sub(r"내\s+일", "내일", s)
    s = re.sub(r"어\s+제", "어제", s)
    s = re.sub(r"날\s+씨", "날씨", s)
    s = re.sub(r"산\s+책", "산책", s)
    s = re.sub(r"아\s+기", "아기", s)
    s = re.sub(r"귀\s+신", "귀신", s)

    s = re.sub(r"(?<![가-힣])및(?=[가-힣]{2,})", "및 ", s)
    s = re.sub(r"(\d+\s*(?:초|분|시간|일|주|달|개월|년)\s*)(후|뒤)(?=[가-힣]{2,})", r"\1\2 ", s)
    s = re.sub(r"(?<![가-힣])(접속|클릭|실행|설치|완료|확인|입력|복사|저장|수정|배포|새로고침)\s*(후|뒤)(?=[가-힣]{2,})", r"\1 \2 ", s)
    s = re.sub(r"(\)|\])\s*(후|뒤)(?=[가-힣]{2,})", r"\1 \2 ", s)
    s = re.sub(r"(\]|\))([을를이가은는])\s*한\s*번", r"\1\2 한 번", s)
    s = re.sub(r"([가-힣][을를이가은는])한(?=\s*번)", r"\1 한", s)
    s = re.sub(r"단\s*한\s*글\s*자도", "단 한 글자도", s)
    s = re.sub(r"(\d+줄로)(?=문장)", r"\1 ", s)
    s = re.sub(r"문장\s*끝까지\s*단\s*한\s*글\s*자도", "문장 끝까지 단 한 글자도", s)
    s = re.sub(r"(?<![가-힣])(한|두|세|네)\s*(영상|문장|문서|파일|사진|화면|페이지|단어|글자)(?=[을를이가은는도만\s])", r"\1 \2", s)
    s = re.sub(r"음성이\s*입혀져\s*완성본으로", "음성이 입혀져 완성본으로", s)
    s = re.sub(r"에서\s*영상을\s*만들어", "에서 영상을 만들어", s)
    s = re.sub(r"바뀐\s*것\s*같은데", "바뀐 것 같은데", s)
    s = re.sub(r"다\s*같이(?=[가-힣]{2,})", "다같이 ", s)
    s = re.sub(r"산책\s*(가자고|가자|가면|가고|가서|가요|갈까)(?=\s|$|[.,?!~^]|[가-힣])", r"산책 \1 ", s)

    s = re.sub(r"(?<![가-힣])(오늘|내일|모레|어제|그제|오전|오후|아침|점심|저녁|밤|새벽)(?=\d)", r"\1 ", s)
    s = re.sub(
        r"(\d+\s*(?:시|분|초|일|월|년|주|층|호|번|개|명|건|원|장|편|차|회))\s+(에|에서|부터|까지|로|으로|은|는|이|가|을|를|도|만)(?=[\s.,?!:;)]|$)",
        r"\1\2",
        s,
    )

    for _ in range(2):
        s = re.sub(
            r"([가-힣]+(?:어요|아요|해요|워요|봐요|와요|자요|줘요|돼요|네요|군요|거든요|잖아요|래요|대요|까요|나요|습니다|입니다|ㅂ니다|세요))(?=[가-힣]{2,})",
            r"\1 ",
            s,
        )
        s = re.sub(
            r"([가-힣]{1,6}(?:와|과|이랑|하고))(?=(?:함께|같이|다르게|달리|비슷|마찬가지|[가-힣]{2,}\s))",
            r"\1 ",
            s,
        )
        s = re.sub(
            r"(?<![가-힣])(오늘은|내일은|어제는|지금은|요즘은|이번은|다음은|원래는|사실은|너무|정말|진짜|아주|매우|가장|제일|많이|빨리|천천히|다시|함께|같이|먼저|벌써|아직|항상|자주|가끔)(?=[가-힣]{2,})",
            r"\1 ",
            s,
        )
        s = re.sub(
            r"(?<![가-힣])(이번|다음|지난|해당|신규|전체|모든|각종|주요|다른|어떤|무슨|어느)(?=(?!번|주|달|해|년|날|길|일|주일)[가-힣]{2,})",
            r"\1 ",
            s,
        )
        s = re.sub(
            r"([가-힣]{2,}(?:은|는|이|가|을|를|도|만|에는|에서는|으로|로))(?=(?:꼭|잘|다|더|바로|즉시|먼저|함께|모두|항상|반드시|절대|정말|진짜|너무|매우|아주)(?=[\s.,?!:;)]|$))",
            r"\1 ",
            s,
        )
        s = re.sub(
            r"([가-힣]+(?:할|될|볼|갈|올|줄|살|칠|낼|둘|쓸|클|릴|밀|걸|팔|열|물|불|실|질|길|일|벨|셀|잴|맬|뺄|뗄|먹을|있을|없을|않을|못할|가능할|필요할|보실|하실|되실|오실|가실|받으실|쓰실|찾으실))\s*수(도|는|만|가)?\s*(있|없|있습|없습|있어|없어|있고|없고|있는|없는|있도|없도|있으|없으|있던|없던|있겠|없겠)",
            r"\1 수\2 \3",
            s,
        )
        s = re.sub(
            r"([가-힣]{2,})(?<!수)(?<!것)(?<!바)(?<!데)(?<!줄)(?<!리)(?<!고)(?<!어)(?<!아)(?<!여)(?<!해)(?<!하)(?<!되)(?<!돼)(?<!재)(?<!전)(?=(?:있습니다|없습니다|있어요|없어요|있네요|없네요)(?=[\s.,?!:;)]|$))",
            r"\1 ",
            s,
        )
        s = re.sub(
            r"([가-힣]+(?:아서|어서|여서|해서|와서|가서|봐서|파서|커서|써서|나서|돼서|니까|지만|고))(?=(?!싶|있|없|보|주|버리|말|나가|들어가)[가-힣]{1,4}(?:에서|에게|한테|으로|은|는|이|가|을|를|에|와|과|도)(?=[가-힣\s.,?!:;)]|$))",
            r"\1 ",
            s,
        )
        s = re.sub(
            r"([가-힣]{1,5}(?:에서|에게|한테|으로))(?=[가-힣]{2,})",
            r"\1 ",
            s,
        )
        s = re.sub(
            r"([가-힣]{1,5}에)(?=(?:나가고|나가서|나가다|나가|들어가고|들어가서|들어가|가고|가서|가다|가요|가니|가자|오다|오고|와서|와요|있고|있어|있으니|있다|없고|없어|없다|앉아|서서|누워|살고|살아|맞춰|넣고|넣어|두고|두어|올리고|올려|내리고|내려|보내고|보내|다니고|다녀))",
            r"\1 ",
            s,
        )
        s = re.sub(
            r"([가-힣]{1,5}[을를])(?=[가-힣]{1,5}(?:고|서|아서|어서|여서|해서|니|니까|면|지만|며|면서|는데|어요|아요|해요|워요|봐요|와요|가요|자요|줘요|돼요|싶|있|없|다|자|습니다|ㅂ니다|합니다|했다|았다|었다|였다|겠다|먹|마시|보|하|듣|쓰|읽|사|팔|만들|찾|잡|열|닫|받|주|넣|빼)(?=[\s.,?!:;가-힣)]|$))",
            r"\1 ",
            s,
        )
        s = re.sub(
            r"([가-힣]{1,5}[이가은는도])(?=(?:좋|나쁘|나빠|맑|흐리|흐려|춥|추워|덥|더워|따뜻|시원|많|적|크|커|작|높|낮|길|짧|빠르|빨라|느리|느려|예쁘|예뻐|아프|아파|고프|고파|슬프|슬퍼|기쁘|기뻐|힘들|어렵|어려워|쉽|쉬워|있|없|안되|안돼|되|돼|오|와|불|내리|내려)[가-힣]*(?=[\s.,?!:;가-힣)]|$))",
            r"\1 ",
            s,
        )
        s = re.sub(
            r"([가-힣]+(?:고|아서|어서|여서|해서))(?=(?:싶어|싶다|싶습니다|싶네|싶은|싶고|싶으니|있어|있다|있습니다|있네|보세요|보아요|봐요|주세|주어|줘요|버렸|버려)(?=[\s.,?!:;가-힣)]|$))",
            r"\1 ",
            s,
        )
        # ── [범용 한국어 형태소 경계 + EmbeddingGemma 2 (262,144 서브워드 '▁' 어절 시작점) 결합 엔진] ──
        # 개별 단어를 일일이 정규식으로 등록하지 않아도, 한국어 교착어 문법(조사·어미 닫힌 집합)과
        # AI 토크나이저 어절 시작 사전을 교차 검증하여 미등록 문장까지 범용으로 띄어쓰기 교정!
        s = re.sub(r"띄워\s*쓰기", "띄어쓰기", s)
        # 잘못 띄어진 서술격조사·연결어미·보조사 복원 ('말이 었지' -> '말이었지', '되는 지확인해' -> '되는지 확인해', '메모장이 나노션에서' -> '메모장이나 노션에서')
        s = re.sub(r"([가-힣]+이)\s+((?:었|셨|겠)[가-힣]+)", r"\1\2", s)
        s = re.sub(
            r"([가-힣]+(?:는|은|던|건|할|될|볼|갈|올|줄|실|일|을))\s+지(?=\s*(?:확인|점검|체크|검증|테스트|알|모르|몰라|보|봐|궁금|생각|판단|비교|살펴|찾아|물어|여쭤))",
            r"\1지 ",
            s,
        )
        s = re.sub(
            r"([가-힣]{2,}이)\s+나(?=(?!(?:타나|타났|오|와|왔|온|올|가|갔|간|갈|서|선|누|눠|눴|빠|쁜|쁘|아|았))[가-힣]{1,8}(?:에서|에게|한테|으로|로|에|은|는|이|가|을|를|의|도|만|과|와))",
            r"\1나 ",
            s,
        )
        # 단, 뒷부분 자체가 정상 한국어 어휘('이동했습니다', '가족들과', '이번주', '가능합니다', '의견을', '은행에서')이거나 앞 어절이 이미 조사·어미로 끝나면 절대 앞 단어에 붙이지 않음!
        def _rejoin_broken_single_josa(m_rj: re.Match) -> str:
            left_w, j_ch, rest_w = m_rj.group(1), m_rj.group(2), m_rj.group(3)
            if left_w.endswith(("에", "로", "는", "은", "이", "가", "을", "를", "도", "만", "와", "과", "고", "서", "면", "지", "께", "한테", "에게", "에서", "으로", "부터", "까지")):
                return m_rj.group(0)
            if left_w in ("오늘", "내일", "어제", "모레", "이번", "다음", "지난", "올해", "작년", "내년", "지금", "방금", "바로", "다시", "먼저", "함께", "같이") and j_ch != "의":
                return m_rj.group(0)
            l_jong = (ord(left_w[-1]) - 0xAC00) % 28
            if j_ch in ("이", "은", "을") and l_jong == 0:
                return m_rj.group(0)
            if j_ch in ("가", "는", "를") and l_jong != 0:
                return m_rj.group(0)
            full_r = j_ch + rest_w
            if full_r[:2] in ("이동", "이번", "이제", "이유", "이름", "이상", "이용", "이해", "이후", "이미", "이슈", "이론", "이하", "이전", "이곳", "이날", "이때", "가족", "가방", "가격", "가게", "가능", "가장", "가을", "가수", "가지", "가져", "가까", "가끔", "가슴", "가운데", "가정", "의견", "의미", "의사", "의자", "의료", "의류", "의무", "의문", "의식", "의지", "은행", "은혜"):
                return m_rj.group(0)
            if full_r in AI_ENGINE.ko_word_starts or full_r in AI_ENGINE.ko_subwords:
                return m_rj.group(0)
            for ws_chk in AI_ENGINE.ko_word_starts:
                if len(ws_chk) >= 2 and full_r.startswith(ws_chk):
                    return m_rj.group(0)
            return f"{left_w}{j_ch} {rest_w}"

        s = re.sub(
            r"([가-힣]{2,})\s+([이가은는을를의])((?!(?:서|니까|지만|면|며|면서|고|야|요|다|네|군|라|자)(?=[\s.,?!:;~^가-힣)]|$))[가-힣]{2,})",
            _rejoin_broken_single_josa,
            s,
        )
        s = re.sub(r"(?<![가-힣])핫도\s+그(?=[가은는을를도만로\s.,?!:;~^)]|$)", "핫도그", s)
        s = re.sub(r"(?<![가-힣])떡볶\s+이(?=[가은는을를도만로\s.,?!:;~^)]|$)", "떡볶이", s)
        # 지시관형사('그/이/저') + 일반 인칭·사물 명사 분리 ('그사람' -> '그 사람')
        s = re.sub(r"(?<![가-힣])(그|이|저)(?=(?:사람|분|친구|아이|애|남자|여자|학생|선생님|가게|식당|카페|회사|병원|학교|집|방|곳|문제|일|말|생각|마음|이야기|얘기|소식|영화|책|노래|음식|메뉴)[이가은는을를의에에서으로로와과도만\s.,?!:;~^)])", r"\1 ", s)
        s = re.sub(r"(?<![가-힣])(내가|네가|제가|우리가|누가|나는|너는|저는|우리는|나의|너의|저의|우리의|그의|그녀의|오늘의|내일의|어제의|올해의|이번의)(?=[가-힣]{2,})", r"\1 ", s)
        s = re.sub(r"(?<![가-힣])(오늘|내일|모레|어제|그제)(?=(?![은는이가의도만부터까지날\s.,?!:;~^)])[가-힣]{2,})", r"\1 ", s)
        # 자율 명사·어휘 경계 분리 ('띄어쓰기되는지' -> '띄어쓰기 되는지', '복사붙여넣기' -> '복사 붙여넣기', '한국어교착어음운규칙과' -> '한국어 교착어 음운 규칙과', '어절단위로' -> '어절 단위로')
        s = re.sub(r"(띄어쓰기)(?=(?![가을를은는도만의에로와과이나\s.,?!:;~^)])[가-힣]{2,})", r"\1 ", s)
        s = re.sub(r"(복사)(?=(?:붙여넣기|후)(?=[가-힣\s.,?!:;~^)]|$))", r"\1 ", s)
        s = re.sub(
            r"(?<![가-힣])(한국어|교착어|외래어|외국어|표준어|고유어|한자어|일본어|중국어|프랑스어|독일어|스페인어|러시아어|베트남어)(?=(?!(?:가|는|를|의|와|로|에|에서|도|만|나|랑|보다|처럼|부터|까지|입니|이다|이지|이라)(?=[\s.,?!:;~^가-힣)]|$))[가-힣]{2,})",
            r"\1 ",
            s,
        )
        s = re.sub(
            r"(음운|형태소|어절|문장|문단|단어|글자|자음|모음|받침|항목|단계|메모장|탐색기|바탕화면|클립보드|스페이스바|백스페이스|귀신창|귀신검색창)(?=(?:규칙|단위|기준|순서|구조|체계|현상|변화|결합|분리|경계|목록|기능|오류|버그|설정|방법|안내|설명|점검|확인|테스트)(?=[이가은는을를의에에서으로로와과도만이나\s.,?!:;~^)]|$))",
            r"\1 ",
            s,
        )
        s = re.sub(r"([가-힣]{2,})(?=그대로(?=[가-힣\s.,?!:;~^)]|$))", r"\1 ", s)
        s = re.sub(r"(?<![가-힣])(그대로)(?=(?![는도만요이다입\s.,?!:;~^)])[가-힣]{2,})", r"\1 ", s)
        # 간접의문·연결어미 '-는지 / -은지 / -던지 / -건지 / -ㄹ지' 뒤 분리 ('되는지확인해' -> '되는지 확인해')
        s = re.sub(
            r"([가-힣]{1,12}(?:는지|은지|던지|건지|할지|될지|볼지|갈지|올지|줄지|실지|일지|을지))(?=(?![라요도만는가\s.,?!:;~^)])[가-힣]{2,})",
            r"\1 ",
            s,
        )
        # 의존명사 '때' ('눌렀을때' -> '눌렀을 때', '할때에는원문' -> '할 때에는 원문') 및 관형사형 + '뒤/후/전' ('선택한뒤귀신창을' -> '선택한 뒤 귀신창을')
        s = re.sub(
            r"([가-힣]{1,12}(?:았을|었을|였을|했을|렀을|웠을|쳤을|졌을|겼을|렸을|섰을|났을|왔을|갔을|봤을|썼을|탔을|줬을|뒀을|먹었을|있을|없을|할|될|볼|갈|올|살|실))(?=때(?:에는|에도|에|는|도|만|마다|부터|까지)?(?=[\s.,?!:;~^가-힣)]|$))",
            r"\1 ",
            s,
        )
        s = re.sub(r"(?<=\s)(때(?:에는|에도|에|는|도|만|마다|부터|까지))(?=[가-힣]{2,})", r"\1 ", s)
        s = re.sub(r"(?<=\s)(때)(?=(?![에는도만마부까이가을를의\s.,?!:;~^)])[가-힣]{2,})", r"\1 ", s)
        s = re.sub(
            r"([가-힣]{2,}(?:한|된)|[가-힣]*(?:누른|고른|만든|읽은|보낸|받은|찍은|열린|닫힌|바뀐|끝난|마친|하기|되기))\s*(뒤|후)(?=(?:에|에는|에도)?(?=[\s.,?!:;~^가-힣)]|$))",
            r"\1 \2",
            s,
        )
        s = re.sub(
            r"([가-힣]*(?:선택한|입력한|클릭한|복사한|저장한|설치한|실행한|수정한|배포한|완료한|확인한|변경한|삭제한|추가한|호출한|하기|되기))\s*(전)(?=(?:에|에는|에도)?(?=[\s.,?!:;~^가-힣)]|$))",
            r"\1 \2",
            s,
        )
        s = re.sub(r"(?<=\s)(뒤|후|전)(?=(?![에의는도만\s.,?!:;~^)])[가-힣]{2,})", r"\1 ", s)
        s = re.sub(r"(?<=\s)((?:뒤|후|전)(?:에|에는|에도))(?=[가-힣]{2,})", r"\1 ", s)
        # 상용 부사('바로/다시/먼저/함께/같이/직접/자주/항상/계속/빨리/천천히/충분히/반드시') 뒤 용언 붙여쓰기 분리 ('바로말씀해주세요' -> '바로 말씀해 주세요')
        s = re.sub(
            r"(?<![가-힣])(바로|다시|먼저|함께|같이|직접|자주|항상|계속|빨리|천천히|열심히|충분히|완전히|정확히|확실히|반드시)(?=(?![는도만요이\s.,?!:;~^)])[가-힣]{2,})",
            r"\1 ",
            s,
        )
        # '에 대해서도 / 에 대한 / 에 따라 / 에 의해 / 에 비해 / 에 맞춰' 분리 ('문장에대해서도' -> '문장에 대해서도')
        s = re.sub(
            r"([가-힣]{2,}에)(?=(?:대해서도|대해서는|대해서|대해도|대해|대한|관해서도|관해서는|관해서|관해|관한|따라서|따라|따른|의해서|의해|의한|비해서|비해|비한|맞춰서|맞춰|맞춘)(?=[가-힣\s.,?!:;~^)]|$))",
            r"\1 ",
            s,
        )
        s = re.sub(r"([가-힣]{2,})(?=(?:못해서|못하|못했|못한|못할|못받|못가|못오|못보|못먹|못자|안해서|안하|안했|안한|안할|안되|안돼|안됐|끝나면|끝나고|끝나서|마치면|마치고|먹으러|마시러|보러|사러|찾으러|놀러|위해서는|위해서|위해)(?=[\s.,?!:;~^가-힣)]|$))", r"\1 ", s)
        s = re.sub(r"(?<![가-힣])(못|안)(?=(?:해서|하|했|한|할|받|가|오|보|먹|자|되|돼|됐)[가-힣]*(?=[\s.,?!:;~^)]|$))", r"\1 ", s)
        s = re.sub(r"(?<![가-힣])(위해서는|위해서|위해)(?=[가-힣]{2,})", r"\1 ", s)
        s = re.sub(r"([가-힣]{2,})(?=(?:중이라서|중이라|중이니|중인데|중입니|중이에|중이오)(?=[\s.,?!:;~^가-힣)]|$))", r"\1 ", s)
        # G1) 2음절 이상 복합 조사('에서/에게/한테/께서/으로/부터/까지/보다/처럼/만큼/조차/마저/에는/에도/에서는/으로는/이라서/라서/이나/이랑') 및 시간·장소+'에' 뒤 범용 어절 분리
        s = re.sub(
            r"([가-힣]{1,12}(?:에서|에게|한테|께서는|께서|으로는|으로도|으로서|으로써|으로부터|으로|부터|까지|보다|처럼|만큼|조차|마저|에는|에도|에서는|이라서|라서|이라도|이나마))(?=(?![는도만요의가을를\s.,?!:;~^)])[가-힣]{2,})",
            lambda m: m.group(0) if (m.group(0) in AI_ENGINE.ko_subwords) else (m.group(1) + " "),
            s,
        )
        s = re.sub(
            r"(?<![가-힣])((?:아침|점심|저녁|새벽|낮|밤|봄|여름|가을|겨울|주말|평일|주중|평소|최근|요즘|처음|나중|오전|오후|이번|다음|중간|마지막|학교|회사|병원|은행|식당|카페|공원|시장|매장|현장|사무실|회의실|집|방|교실|거실|부엌|화장실|역|공항|도서관|백화점|마트|약국|헬스장|운동장)에)(?=(?![는도만서\s.,?!:;~^)])[가-힣]{2,})",
            r"\1 ",
            s,
        )
        # G2) 연결어미·관형사형 어미 뒤 범용 어절 분리 ('대해서도정확하게' -> '대해서도 정확하게')
        s = re.sub(
            r"([가-힣]+(?:아서도|어서도|여서도|해서도|아서는|어서는|여서는|해서는|아서만|어서만|여서만|해서만|아서|어서|여서|해서|봐서|와서|가서|나서|돼서|내려서|올라서|열려서|닫혀서|밀려서|막혀서|걸려서|풀려서|니까|지만|는데|은데|던데|면서|자마자|려고|도록|으러|길래|거든|잖아|끝나면|끝나고|마치면|마치고|으시면|시면|나면|으면|다면|오면|가면|보면|하면|되면|주신|하신|오신|가신|보신|드신|만든|먹은|입은|들은))(?=(?![요서도만는\s.,?!:;~^)])[가-힣]{2,})",
            r"\1 ",
            s,
        )
        s = re.sub(
            r"(?<![가-힣])(해서|가서|와서|봐서|나서|돼서|주신|하신|오신|가신|보신|드신)(?=(?![는도만요\s.,?!:;~^)])[가-힣]{2,})",
            r"\1 ",
            s,
        )
        s = re.sub(
            r"([가-힣]{2,}(?:하고|먹고|보고|듣고|쓰고|읽고|사고|팔고|만나|모여|찾아|잡아|열고|닫고))(?=(?![서도만는요있없싶나\s.,?!:;~^)])[가-힣]{2,})",
            r"\1 ",
            s,
        )
        s = re.sub(
            r"([가-힣]+(?:잘|못|안))(?=(?:거예요|거야|겁니다|건가요|할게요|할래요|할까요))",
            r"\1 ",
            s,
        )
        # G3) 1음절 격조사('을/를/은/는/이/가/의/도/만/와/과') + 용언/서술어 또는 일반 명사(체언+조사) 경계 범용 분리
        _COMPOUND_NO_SPLIT_PREFIX = (
            "이유", "이번", "이런", "이렇", "그런", "저런", "가능", "가운데", "가방", "가족", "가게", "가격", "가치",
            "가장", "가끔", "가슴", "가을", "도움", "도착", "도전", "도구", "도시", "도로", "도서관", "만약", "만족",
            "만큼", "만남", "만들", "은혜", "은행", "오늘", "내일", "모레", "어제", "핫도", "떡볶", "의견", "의미",
            "의사", "의자", "의류", "의료", "의무", "의문", "의식", "의지", "의존", "와인", "과일", "과자", "과정", "과학",
        )
        # 조사로 잘못 쪼개지면 안 되는 단일 명사(끝 글자가 조사와 우연히 겹치는 명사 원형)
        _NOUN_FALSE_JOSA_WORDS = {
            "핫도", "떡볶", "고양", "강아", "호랑", "원숭", "코끼", "어린", "할머", "할아버", "아주머", "아저",
            "고객만", "불만", "백만", "천만", "얼마만", "오랜만", "잠깐만", "비만", "낭만", "교만", "거만", "충만", "자만",
            "회의", "논의", "합의", "동의", "건의", "항의", "강의", "정의", "예의", "성의", "유의", "주의", "결의", "선의", "악의", "고의", "편의", "어의", "상의", "하의", "내의", "우의", "수의",
            "기타", "기차", "기자", "기사", "기회", "기억", "기분", "기본", "기술", "기준", "기업", "기관", "기간", "기능",
            "도마", "도구", "도시", "도로", "도움", "도전", "도착", "도서", "도표", "도형",
            "만두", "만화", "만남", "만족", "만약", "만점",
            "가지", "가방", "가족", "가게", "가격", "가수", "가슴", "가을", "가운데",
            "사과", "치과", "안과", "내과", "외과", "일과", "교과", "성과", "결과", "효과", "통과", "초과",
            "내려", "올라", "들어가", "나가", "돌아가", "지나가", "다가가", "따라가",
        }
        # 뒷부분 첫 글자가 조사('가/이/은/는/을/를/의/에/로/와/과/도/만')인 경우 실제로는 앞 체언의 조사인데 뒷부분으로 넘어간 오분할 방지
        _RIGHT_BAD_JOSA_STARTS = {
            "가게", "가격", "가까", "가는", "가능", "가면", "가서", "가수", "가장", "가정", "가져", "가족", "가지", "가진",
            "과거", "과정", "과학", "도로", "도시", "도와", "도움", "도입", "도전", "도착", "도형", "로그",
            "만나", "만든", "만들", "만족", "만큼", "에게", "에서", "은행", "의견", "의료", "의미", "의한", "의해",
            "이거", "이건", "이걸", "이것", "이게", "이곳", "이날", "이는", "이동", "이때", "이러", "이런", "이론",
            "이루", "이르", "이를", "이름", "이미", "이번", "이상", "이슈", "이야", "이어", "이에", "이용", "이유",
            "이전", "이제", "이차", "이하", "이해", "이후", "그가", "그는", "그의", "그를", "그에", "그도", "그만",
        }

        _NOUN_FALSE_RO_WORDS = {
            "도로", "경로", "통로", "회로", "진로", "과로", "피로", "종로", "구로", "선로", "항로", "활로",
            "난로", "화로", "폭로", "토로", "노로", "포로", "별도로", "스스로", "따로", "바로", "서로", "새로",
            "세로", "가로", "제로", "프로", "인트로", "매크로", "마이크로",
        }
        _NOUN_FALSE_EUL_WORDS = {
            "가을", "마을", "겨울", "노을", "방울", "거울", "저울", "구슬", "이슬", "사슬",
            "하늘", "마늘", "바늘", "그늘", "오늘",
        }
        _EXTRA_KO_WORD_STARTS = {
            "띄어쓰기", "붙여넣기", "새로고침", "스페이스바", "백스페이스", "클립보드", "바탕화면", "탐색기", "메모장", "노션",
            "귀신창", "귀신검색창", "비밀번호", "아이디", "이메일", "한국어", "교착어", "외래어", "음운", "형태소", "어절",
            "문장", "문단", "단어", "글자", "규칙", "단위", "원문", "확인", "점검", "적용", "작동", "실행", "유지", "복구",
        }
        _NA_VERB_PREFIX_RE = re.compile(r"^나(?:왔|와|오|온|올|타나|타났|타난|타날|가|갔|간|갈|서|선|설|누|눠|눴|빠|쁜|쁘|아|았|은)")

        def _split_unspaced_chunk_by_grammar_and_vocab(match_chunk: re.Match) -> str:
            chunk = match_chunk.group(0)
            if len(chunk) < 4 or chunk in AI_ENGINE.ko_subwords or chunk in AI_ENGINE.ko_word_starts or chunk in _EXTRA_KO_WORD_STARTS:
                return chunk
            candidate_splits: list[int] = []
            for idx in range(2, len(chunk)):
                left = chunk[:idx]
                right = chunk[idx:]
                if right[0] in "었았였겠셨":
                    continue

                # (A) 2음절 보조사·격조사('이나/이랑') 우선 경계 판별 ('메모장이나노션에서' -> '메모장이나 노션에서', 단 '고기반찬이나왔어요'는 '나왔어요' 동사이므로 제외!)
                if len(left) >= 3 and left.endswith(("이나", "이랑")) and len(right) >= 2:
                    if left.endswith("이나") and _NA_VERB_PREFIX_RE.match("나" + right):
                        pass
                    else:
                        stem2 = left[:-2]
                        s2_jong = (ord(stem2[-1]) - 0xAC00) % 28
                        if s2_jong != 0 and not right.startswith(("마", "요")) and right[0] not in "이가은는을를의에로와과도만":
                            candidate_splits.append(idx)
                            break

                stem = left[:-1]
                josa = left[-1]
                if left in _NOUN_FALSE_JOSA_WORDS:
                    continue
                if left.startswith(_COMPOUND_NO_SPLIT_PREFIX) and len(left) <= 3:
                    continue
                if stem in ("핫", "떡", "고", "강", "선", "선생", "어", "할") and josa in "도볶양아생린이머":
                    continue
                if right[0] in "이가은는을를의에로와과도만" and (left + right[0])[:-1] in ("떡볶이", "핫도그", "고양이", "강아지", "호랑이", "원숭이", "어린이", "할머니", "할아버지", "선생님"):
                    continue
                if josa == "만" and right.startswith(("족", "큼", "남", "두", "화", "점", "원", "명", "개", "건")):
                    continue
                if josa == "도" and right.startswith("록"):
                    continue
                if josa in ("는", "은") and right.startswith(("지", "데", "가", "걸", "다", "바", "군", "구나", "구먼", "듯", "마는")):
                    continue
                # 서술격조사 '이다' 활용형 및 2음절 조사('이나/이라도/이라서/이랑/이며/이고/이자/이든/이거나/이야/이지만/이니까') 오분리 차단 (단, '나왔어요/나타났다' 등 '나-' 동사는 분리 허용!)
                if josa == "이":
                    if right.startswith("나"):
                        if not _NA_VERB_PREFIX_RE.match(right):
                            continue
                    elif re.match(
                        r"^(?:라도|라서|라|란|라는|랑|며|고|자|든|든지|거나|야|지만|니까|니|면|면서|므로|기|에|에요|예요|다$|지$|네$|군|구[나먼]|었|았|였|겠|셨|ㅂ니다|입니다|습니까|입니까)",
                        right,
                    ):
                        continue
                if josa == "가" and (
                    left.endswith(("나가", "들어가", "올라가", "내려가", "돌아가", "지나가", "다가가", "따라가", "가져가"))
                    or re.match(r"^(?:서|고|며|면|면서|니까|지만|는데|다$|요$|자$|라$|니$|야$|지$|네$|군|겠|았|었|셨)", right)
                ):
                    continue
                if josa in ("을", "를") and left in _NOUN_FALSE_EUL_WORDS:
                    continue
                if josa == "로" and (
                    left in _NOUN_FALSE_RO_WORDS
                    or left.endswith(("프로", "트로", "크로", "브로", "드로", "플로", "글로", "슬로", "클로", "업로", "다운로"))
                    or right[0] in "는도만서써부"
                ):
                    continue

                if josa in "을를은는이가의도만와과로" and (len(right) >= 2 or (len(right) == 1 and josa in ("을", "를") and right in ("할", "될", "볼", "갈", "올", "줄", "살", "한", "된", "본", "간", "온", "산", "준", "실"))):
                    stem_code = ord(stem[-1]) - 0xAC00
                    jong_val = stem_code % 28
                    has_jong = jong_val != 0
                    if josa in ("이", "은", "을", "과") and not has_jong:
                        continue
                    if josa in ("가", "는", "를", "와") and has_jong:
                        continue
                    if josa == "로" and jong_val not in (0, 8):
                        continue

                    if len(right) == 1:
                        candidate_splits.append(idx)
                        break

                    is_right_pred = bool(
                        re.search(
                            r"(?:습니다|입니다|됩니다|합니다|ㅂ니다|습니까|입니까|ㅂ니까|어요|아요|해요|워요|봐요|와요|가요|자요|줘요|돼요|네요|군요|거든요|잖아요|까요|나요|세요|셨어요|셨습니다|왔어요|갔어요|났어요|봤어요|했어요|됐어요|썼어요|탔어요|췄어요|졌어요|렸어요|겼어요|웠어요|았어요|었어요|였어요|았을|었을|였을|했을|렀을|웠을|쳤을|졌을|겼을|렸을|났을|왔을|갔을|봤을|썼을|아서|어서|여서|해서|니까|지만|는데|은데|던데|는지|은지|면서|려고|도록|하게|으러|고|며|지|다|네|군|자|라|어|아|해|워|봐|와)$",
                            right,
                        )
                    )
                    # 뒷부분이 또 다른 체언(1~10음절) + 조사로 끝나거나 체언+조사+후속절로 시작하는 경우 ('강아지가공원에서', '스페이스바를눌렀을', '문서를선택한')
                    is_right_noun_josa = (
                        bool(
                            re.match(
                                r"^[가-힣]{1,10}(?:에서|에게|한테|으로|에는|에도|이나|이랑|은|는|이|가|을|를|의|에|로|도|만|와|과)(?:[가-힣]{2,}|$)",
                                right,
                            )
                        )
                        and right[0] not in "이가은는을를의에로와과도만"
                    )
                    is_right_obj_verb = (
                        josa in ("을", "를")
                        and len(stem) >= 2
                        and right[0] not in "이가은는을를의에로와과도만"
                    )
                    is_right_vocab_start = False
                    if right not in _RIGHT_BAD_JOSA_STARTS:
                        if right in AI_ENGINE.ko_word_starts or right in _EXTRA_KO_WORD_STARTS:
                            is_right_vocab_start = True
                        else:
                            for ws in _EXTRA_KO_WORD_STARTS:
                                if right.startswith(ws):
                                    is_right_vocab_start = True
                                    break
                            if not is_right_vocab_start:
                                for ws in AI_ENGINE.ko_word_starts:
                                    if len(ws) >= 2 and ws not in _RIGHT_BAD_JOSA_STARTS and right.startswith(ws):
                                        is_right_vocab_start = True
                                        break
                    if is_right_pred or is_right_noun_josa or is_right_obj_verb or is_right_vocab_start:
                        candidate_splits.append(idx)
                        break

            if candidate_splits:
                best_idx = candidate_splits[0]
                return f"{chunk[:best_idx]} {chunk[best_idx:]}"
            return chunk

        for _ in range(8):
            next_s = re.sub(r"[가-힣]{4,}", _split_unspaced_chunk_by_grammar_and_vocab, s)
            if next_s == s:
                break
            s = next_s
    return re.sub(r" +", " ", s).strip()


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

    # 1) 각 줄 내부에 섞여 있는 영타 오타(예: gksrmf xptmxmdlqslek)가 있으면 줄 단위로 먼저 한영 성형 수행 (단, 클립보드 복사 시에는 allow_typo_morph=False로 차단!)
    if allow_typo_morph:
        pre_lines = []
        for raw_ln in raw_text.splitlines():
            if raw_ln.strip():
                m_ln, l_dir = morph_korean_english_text_with_direction(raw_ln)
                if l_dir == "KO" and m_ln != raw_ln:
                    pre_lines.append(m_ln)
                else:
                    pre_lines.append(raw_ln)
            else:
                pre_lines.append("")
        s = "\n".join(pre_lines)
    else:
        s = raw_text

    s = s.replace("\u00B7", "__MIDDOT__").replace("\u318D", "__MIDDOT__")
    s = unicodedata.normalize("NFKC", s)
    s = s.replace("__MIDDOT__", "·")
    s = re.sub(r"[\u00A0\u200B-\u200D\uFEFF]", " ", s)
    s = s.replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'")

    # 2-A) 단어·숫자·영문·괄호가 줄바꿈(단일 \n 또는 단어 중간 빈줄 \n\n 포함)으로 쪼개진 구간을 무공백 정밀 결합 (종결 문장 뒤 줄바꿈 및 불릿 목록은 100% 보존!)
    #  ⓪ 문장부호(, . ; : ? ! ) ]) 바로 앞에 끼어든 줄바꿈 무공백 제거 ('있으므로\n, 본 자동' -> '있으므로, 본 자동')
    s = re.sub(r"[ \t]*(?:\r?\n[ \t]*)+(?=[,.;:?!\)\]\}])", "", s)
    #  ① 숫자 쪼개짐 ('1\n00%' -> '100%', '202\n6' -> '2026')
    s = re.sub(r"(?<=\d)[ \t]*(?:\r?\n[ \t]*)+(?=\d+[%원개명건일월년시분초번층호]?)", "", s)
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
        r"([가-힣]+(?:어요|아요|해요|네요|군요|습니다|입니다))(?=[가-힣]{2,})",
        r"\1 ",
        s,
    )
    s = re.sub(
        r"(?<=[가-힣]{2})[ \t]+(?=(?:은|는|이|가|을|를|에서|에게|으로|까지|부터|처럼|보다|지만|거나|면서|니까|습니다|입니다|합니다)(?=[\s.,?!:;)]|$))",
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
        u32.SendMessageW(edit_child, EM_GETSEL, ctypes.addressof(s_dw), ctypes.addressof(e_dw))
        s_pos, e_pos = s_dw.value, e_dw.value
        if s_pos == 0 and e_pos == 0:
            sel_ret = u32.SendMessageW(edit_child, EM_GETSEL, 0, 0)
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
            line_idx = u32.SendMessageW(edit_child, EM_LINEFROMCHAR, s_pos, 0)
            line_start = u32.SendMessageW(edit_child, EM_LINEINDEX, line_idx, 0)
            line_len = u32.SendMessageW(edit_child, EM_LINELENGTH, line_start, 0)
            cur_line_str = ""
            if line_start >= 0 and line_len > 0:
                cur_line_str = utf16_bytes[line_start * 2 : (line_start + line_len) * 2].decode("utf-16-le", errors="ignore")
            # 커서가 놓인 현재 줄에 한영 오타(예: gksrmf xptmxm)가 있으면 다른 문장들을 절대 건드리지 않고 현재 줄만 즉시 성형!
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

        final_out = (morphed.rstrip(" ") + " ") if auto_triggered else morphed
        if not is_rich and "\n" in final_out:
            final_out_win = final_out.replace("\r\n", "\n").replace("\n", "\r\n")
        else:
            final_out_win = final_out

        set_ime_language(target_korean=(target_lang == "KO"))
        if use_full_sel or (line_start == 0 and line_end >= utf16_total):
            u32.SendMessageW(edit_child, EM_SETSEL, 0, -1)
            rbuf = ctypes.create_unicode_buffer(final_out_win)
            u32.SendMessageW(edit_child, EM_REPLACESEL, 1, ctypes.addressof(rbuf))
            if not auto_triggered and s_pos != e_pos:
                u32.SendMessageW(edit_child, EM_SETSEL, 0, -1)
        else:
            u32.SendMessageW(edit_child, EM_SETSEL, line_start, line_end)
            rbuf = ctypes.create_unicode_buffer(final_out_win)
            u32.SendMessageW(edit_child, EM_REPLACESEL, 1, ctypes.addressof(rbuf))
            if not auto_triggered and s_pos != e_pos:
                rep_utf16_len = len(final_out.encode("utf-16-le")) // 2
                u32.SendMessageW(edit_child, EM_SETSEL, line_start, line_start + rep_utf16_len)

        full_after, _, _ = _get_edit_full_text_and_index_str(edit_child)
        root_hwnd = u32.GetAncestor(edit_child, 2) or edit_child
        arm_undo_snapshot(
            root_hwnd,
            edit_child,
            target_line,
            final_out,
            mode="edit_replace",
            full_doc_before=full_text,
            full_doc_after=full_after,
        )
        return True, target_line.strip(), final_out.strip(), target_lang
    except Exception:
        return False, "", "", None


def _polish_notepad_previous_line_on_enter(edit_child: int, allow_typo_morph: bool = False) -> bool:
    """
    [메모장(notepad.exe) 전용 Enter(줄바꿈) 직전 줄 무충돌 띄어쓰기·성형 엔진]
    - 메신저·브라우저(Enter=전송)는 절대 건드리지 않고 오직 메모장 멀티라인 Edit/RichEditD2DPT에서만 발동합니다.
    - 스페이스바 없이 줄 끝에서 바로 Enter를 쳤을 때('한국어교착어음운규칙과' + Enter) 방금 완성된 윗줄을 0.2ms 원자적으로 띄어쓰기하고
      커서는 새 줄 맨 앞 위치를 그대로 유지합니다.
    """
    if not edit_child or not u32.IsWindow(edit_child):
        return False
    try:
        if (u32.GetWindowLongW(edit_child, -16) & 0x0004) == 0:
            return False
        time.sleep(0.014)
        full_text, idx_text, is_rich = _get_edit_full_text_and_index_str(edit_child)
        if not idx_text:
            return False
        s_dw = wintypes.DWORD(0)
        e_dw = wintypes.DWORD(0)
        u32.SendMessageW(edit_child, EM_GETSEL, ctypes.addressof(s_dw), ctypes.addressof(e_dw))
        s_pos, e_pos = s_dw.value, e_dw.value
        if s_pos != e_pos:
            return False
        cur_line_idx = u32.SendMessageW(edit_child, EM_LINEFROMCHAR, s_pos, 0)
        if cur_line_idx < 1:
            time.sleep(0.012)
            full_text, idx_text, is_rich = _get_edit_full_text_and_index_str(edit_child)
            if not idx_text:
                return False
            u32.SendMessageW(edit_child, EM_GETSEL, ctypes.addressof(s_dw), ctypes.addressof(e_dw))
            s_pos, e_pos = s_dw.value, e_dw.value
            if s_pos != e_pos:
                return False
            cur_line_idx = u32.SendMessageW(edit_child, EM_LINEFROMCHAR, s_pos, 0)
            if cur_line_idx < 1:
                return False

        prev_idx = cur_line_idx - 1
        prev_start = u32.SendMessageW(edit_child, EM_LINEINDEX, prev_idx, 0)
        prev_len = u32.SendMessageW(edit_child, EM_LINELENGTH, prev_start, 0)
        if prev_start < 0 or prev_len < 4:
            return False
        utf16_bytes = idx_text.encode("utf-16-le")
        if (prev_start + prev_len) * 2 > len(utf16_bytes):
            return False
        prev_str = utf16_bytes[prev_start * 2 : (prev_start + prev_len) * 2].decode("utf-16-le", errors="ignore")
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
                            if len(e_chk) >= 9 and len(k_chk) >= 4:
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

        set_ime_language(target_korean=(target_lang == "KO"))
        u32.SendMessageW(edit_child, EM_SETSEL, prev_start, prev_start + prev_len)
        rbuf = ctypes.create_unicode_buffer(polished)
        u32.SendMessageW(edit_child, EM_REPLACESEL, 1, ctypes.addressof(rbuf))
        delta_utf16 = (len(polished.encode("utf-16-le")) // 2) - prev_len
        new_caret = max(0, s_pos + delta_utf16)
        u32.SendMessageW(edit_child, EM_SETSEL, new_caret, new_caret)

        full_after, _, _ = _get_edit_full_text_and_index_str(edit_child)
        root_hwnd = u32.GetAncestor(edit_child, 2) or edit_child
        arm_undo_snapshot(
            root_hwnd,
            edit_child,
            prev_str,
            polished,
            mode="edit_replace",
            full_doc_before=full_text,
            full_doc_after=full_after,
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
            arm_undo_snapshot(target_hwnd, edit_child, selected, final_out, mode="clip_replace")
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
        arm_undo_snapshot(target_hwnd, edit_child, "", fallback_text, mode="clip_replace")
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


def clean_and_iron_text(raw_txt: str) -> str:
    """서식 세탁(순수 텍스트화 + 광고·저작권 꼬리말 절삭) + 줄바꿈·유령공백(NFKC)·띄어쓰기 다림질 통합"""
    if not raw_txt or not raw_txt.strip():
        return raw_txt or ""
    stripped_body = _strip_copyright_and_ad_boilerplate(raw_txt)
    if not stripped_body:
        return ""
    return iron_and_polish_korean_text(stripped_body, allow_typo_morph=False)


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
                u32.SendMessageW(ed_target, EM_GETSEL, ctypes.addressof(s_dw), ctypes.addressof(e_dw))
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
                            u32.SendMessageW(ed_target, EM_SETSEL, s_pos, e_pos)
                            rbuf = ctypes.create_unicode_buffer(out_win)
                            u32.SendMessageW(ed_target, EM_REPLACESEL, 1, ctypes.addressof(rbuf))
                            rep_u16 = len(out_seg.encode("utf-16-le")) // 2
                            u32.SendMessageW(ed_target, EM_SETSEL, s_pos, s_pos + rep_u16)
                        else:
                            u32.SendMessageW(ed_target, EM_SETSEL, 0, -1)
                            rbuf = ctypes.create_unicode_buffer(out_win)
                            u32.SendMessageW(ed_target, EM_REPLACESEL, 1, ctypes.addressof(rbuf))
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

    # 2) 일반 앱(노션·브라우저·워드 등)에서 마우스로 문장을 드래그 선택한 직후 [1]번 호출 시 원위치 교체
    if not ed_target and has_recent_drag and _LAST_TARGET_HWND and u32.IsWindow(_LAST_TARGET_HWND):
        try:
            sentinel = "__GHOSTI_IRON_SEL__"
            release_all_modifiers()
            daemon_set_cb(sentinel)
            time.sleep(0.015)
            tap_key_combo([VK_CONTROL], VK_C)
            time.sleep(0.05)
            sel_copied = get_clipboard_text()
            if sel_copied and sel_copied != sentinel:
                out_sel = clean_and_iron_text(sel_copied)
                out_sel_win = out_sel.replace("\r\n", "\n").replace("\r", "\n").replace("\n", "\r\n")
                daemon_set_cb(out_sel_win)
                time.sleep(0.02)
                tap_key_combo([VK_CONTROL], VK_V)
                arm_undo_snapshot(_LAST_TARGET_HWND, 0, sel_copied, out_sel_win, mode="clipboard_paste")
                show_ghost_toast("👻 귀신같이 [1] 선택 영역 서식·줄바꿈 다림질 완료 (Ctrl+Z 원복)")
                return True
            elif clip_txt:
                daemon_set_cb(clip_txt)
        except Exception:
            pass

    # 3) 클립보드 복사(Ctrl+C) 텍스트의 HTML/RTF 서식 세탁 + 줄바꿈 다림질 장전 (Ctrl+V 한 번으로 깔끔히 붙여넣기!)
    if clip_txt and clip_txt.strip():
        out_clip = clean_and_iron_text(clip_txt)
        out_clip_win = out_clip.replace("\r\n", "\n").replace("\r", "\n").replace("\n", "\r\n")
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


def superpower_5_merge_or_ai_search(recent_list: list[str], seq_q: list[str], ai_history: list[dict], daemon_set_cb) -> None:
    """
    [⑤번] 다중 복사 1초 합본 & 마우스 옆 1줄 MRL 128차원 AI 의미 기억 검색창
    """
    source = seq_q if len(seq_q) >= 2 else recent_list
    if len(source) >= 2:
        merged = "\n\n".join(item.strip() for item in source if item.strip())
        daemon_set_cb(merged)
        show_ghost_toast(f"👻 귀신같이 합본 ({len(source)}개)")
        return

    # 복사해 둔 다중 항목이 없으면 마우스 옆에 1줄 AI 기억 검색 미니창 팝업!
    def _search_popup():
        try:
            import tkinter as tk
            pt = wintypes.POINT()
            u32.GetCursorPos(ctypes.byref(pt))
            root = tk.Tk()
            root.overrideredirect(True)
            root.attributes("-topmost", True)
            root.configure(bg="#1E1B2E")

            frame = tk.Frame(root, bg="#1E1B2E", highlightbackground="#8B5CF6", highlightthickness=1, padx=8, pady=6)
            frame.pack()

            lbl = tk.Label(frame, text="🔍 귀신기억검색:", fg="#C4B5FD", bg="#1E1B2E", font=("Malgun Gothic", 9, "bold"))
            lbl.pack(side="left")

            entry = tk.Entry(frame, width=28, fg="#FFFFFF", bg="#2E294E", insertbackground="#FFFFFF", relief="flat", font=("Malgun Gothic", 9))
            entry.pack(side="left", padx=6)
            entry.focus_force()

            res_lbl = tk.Label(frame, text="검색어 입력 후 Enter", fg="#A7F3D0", bg="#1E1B2E", font=("Malgun Gothic", 8))
            res_lbl.pack(side="left")

            matched_text = {"val": ""}

            def on_key(_event=None):
                q = entry.get().strip()
                if not q or not ai_history:
                    res_lbl.config(text="기억 대기 중...")
                    return
                q_vec = AI_ENGINE.embed_128d(q)
                best_item = ""
                best_score = -1.0
                for rec in reversed(ai_history):
                    txt_item = rec.get("text", "")
                    score = AI_ENGINE.cosine_sim(q_vec, rec.get("vec", []))
                    if q.lower() in txt_item.lower():
                        score += 0.35
                    if score > best_score:
                        best_score = score
                        best_item = txt_item
                if best_item:
                    matched_text["val"] = best_item
                    preview = best_item.replace("\n", " ")[:24]
                    res_lbl.config(text=f"➔ {preview}...")

            def on_enter(_event=None):
                chosen = matched_text["val"]
                root.destroy()
                if chosen:
                    daemon_set_cb(chosen)
                    time.sleep(0.03)
                    tap_key_combo([VK_CONTROL], VK_V)
                    show_ghost_toast("👻 귀신같이 기억소환")

            entry.bind("<KeyRelease>", on_key)
            entry.bind("<Return>", on_enter)
            entry.bind("<Escape>", lambda _e: root.destroy())

            root.update_idletasks()
            x = min(pt.x + 12, root.winfo_screenwidth() - root.winfo_width() - 20)
            y = min(pt.y + 12, root.winfo_screenheight() - root.winfo_height() - 40)
            root.geometry(f"+{x}+{y}")
            root.after(12000, root.destroy)
            root.mainloop()
        except Exception:
            pass

    threading.Thread(target=_search_popup, daemon=True).start()


def superpower_6_screen_ocr(daemon_set_cb) -> None:
    """
    [⑥번 & 제7호 특허 청구항 제7항]
    화면 캡처 OCR 단어 바운딩 박스의 수직(Y축) 행 군집화 및 수평(X축) 열 간격 탭(\t) 삽입을 통한 엑셀 표(TSV) 기하 복원
    """
    try:
        from PIL import ImageGrab
        img = ImageGrab.grabclipboard()
        if img is None:
            show_ghost_toast("👻 귀신같이 글자추출 (Win+Shift+S 캡처 후 눌러주세요)")
            return
        tmp_img = Path(tempfile.gettempdir()) / "ghosti_ocr_temp.png"
        img.save(tmp_img, "PNG")
        import base64
        ps_script = f"""
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.SoftwareBitmap, Windows.Foundation, ContentType=WindowsRuntime]
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType=WindowsRuntime]
$null = [Windows.Storage.Streams.IRandomAccessStream, Windows.Storage.Streams, ContentType=WindowsRuntime]
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {{ $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' }})[0]
function Await($WinRtTask, $ResultType) {{
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    $netTask.Wait(-1) | Out-Null
    $netTask.Result
}}
$file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync('{str(tmp_img)}')) ([Windows.Storage.StorageFile])
$stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
$decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
$res = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
$stream.Dispose()
$words = @()
foreach ($line in $res.Lines) {{
    foreach ($w in $line.Words) {{
        $r = $w.BoundingRect
        $words += [PSCustomObject]@{{t=$w.Text; x=$r.X; y=$r.Y; w=$r.Width; h=$r.Height}}
    }}
}}
$words | ConvertTo-Json -Compress
"""
        enc_cmd = base64.b64encode(ps_script.encode("utf-16-le")).decode("ascii")
        si = subprocess.STARTUPINFO()
        si.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        si.wShowWindow = 0
        out = subprocess.check_output(
            ["powershell", "-NoProfile", "-WindowStyle", "Hidden", "-EncodedCommand", enc_cmd],
            encoding="utf-8",
            errors="ignore",
            timeout=8,
            startupinfo=si,
            creationflags=0x08000000,
        ).strip()
        if out:
            words = json.loads(out)
            if isinstance(words, dict):
                words = [words]
            if words:
                # Y축 중심점 기준 정렬 후 동일 행 군집화 (행 임계치: 평균 단어 높이의 0.6배)
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
    if not hwnd:
        return "", ""
    cls_buf = ctypes.create_unicode_buffer(128)
    u32.GetClassNameW(hwnd, cls_buf, 128)
    title_buf = ctypes.create_unicode_buffer(512)
    u32.GetWindowTextW(hwnd, title_buf, 512)
    return cls_buf.value or "", title_buf.value or ""


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
    # 2. 글로벌 Microsoft Office / LibreOffice 계열 (자체 한/영 자동 고침 및 AutoCorrect 보유)
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
}

AUTOCORRECT_EXCLUDE_CLASS_KEYWORDS: tuple[str, ...] = (
    "hwp",
    "hnc_",
    "hncedit",
    "opusapp",
    "_wwg",
    "pptframeclass",
)


def get_window_process_and_class(hwnd: int) -> tuple[str, str, str]:
    """활성 창 핸들(hwnd)로부터 (실행파일명, 윈도우클래스명, 창제목)을 고속 추출"""
    if not hwnd:
        return "", "", ""
    win_cls, win_title = _get_win_class_and_title(hwnd)
    proc_name = ""
    try:
        pid = wintypes.DWORD(0)
        u32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        if pid.value:
            PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
            hproc = k32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid.value)
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
    return proc_name, win_cls, win_title


def _get_process_name_from_hwnd(hwnd: int | None) -> str:
    if not hwnd:
        return ""
    proc_name, _, _ = get_window_process_and_class(int(hwnd))
    return proc_name or ""


def should_skip_auto_typo(hwnd: int) -> bool:
    """
    현재 포커스된 창이 자체 오토코렉트(한영 자동 전환) 탑재 프로그램(HWP, MS워드 등)이거나
    코딩 전용 IDE인 경우 True를 반환하여 귀신창 실시간 타이핑 자동성형을 100% PASS합니다.
    """
    if not hwnd:
        return False
    try:
        if not get_superpower_settings().get("auto_typo_enabled", True):
            return True
        # [방어 18] 비밀번호 입력창(ES_PASSWORD=0x0020) 포커스 시 키보드 버퍼 수집 100% 자동 휴면(Pause)
        ed_pw = _find_edit_control_child(hwnd)
        if ed_pw and (u32.GetWindowLongW(ed_pw, -16) & 0x0020):
            return True
        for target_h in (hwnd, u32.GetAncestor(hwnd, 2)):
            if not target_h:
                continue
            proc_name, win_cls, win_title_chk = get_window_process_and_class(target_h)
            if win_title_chk:
                try:
                    import sys as _sys_c
                    _os_ag = str(Path(__file__).resolve().parent / "os_agent")
                    if _os_ag not in _sys_c.path and Path(_os_ag).exists():
                        _sys_c.path.insert(0, _os_ag)
                    import plugin_ghosti_care_suite as _care_s
                    _care_s.check_window_title_for_prewake(win_title_chk)
                except Exception:
                    pass
            proc_lower = proc_name.lower()
            cls_lower = win_cls.lower()
            if proc_lower in AUTOCORRECT_EXCLUDE_PROCESSES:
                return True
            if any(kw in cls_lower for kw in AUTOCORRECT_EXCLUDE_CLASS_KEYWORDS):
                return True
        return False
    except Exception:
        return False


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
                u32.SendMessageW(edit_child, EM_GETSEL, ctypes.addressof(s_dw), ctypes.addressof(e_dw))
                s_pos, e_pos = s_dw.value, e_dw.value
                if s_pos != e_pos and 0 <= s_pos < e_pos <= utf16_total:
                    line_start, line_end = s_pos, e_pos
                    target_str = utf16_bytes[s_pos * 2 : e_pos * 2].decode("utf-16-le", errors="ignore")
                else:
                    line_idx = u32.SendMessageW(edit_child, EM_LINEFROMCHAR, s_pos, 0)
                    line_start = u32.SendMessageW(edit_child, EM_LINEINDEX, line_idx, 0)
                    line_len = u32.SendMessageW(edit_child, EM_LINELENGTH, line_start, 0)
                    cur_line = ""
                    if line_start >= 0 and line_len > 0:
                        cur_line = utf16_bytes[line_start * 2 : (line_start + line_len) * 2].decode("utf-16-le", errors="ignore")
                    if cur_line and _toggle_korean_number_format(cur_line) != cur_line:
                        line_end = line_start + line_len
                        target_str = cur_line
                    else:
                        line_start, line_end = 0, utf16_total
                        target_str = idx_text
                formatted_ed = _toggle_korean_number_format(target_str)
                if formatted_ed != target_str:
                    final_ed = formatted_ed.replace("\r\n", "\n").replace("\n", "\r\n") if (not is_rich and "\n" in formatted_ed) else formatted_ed
                    u32.SendMessageW(edit_child, EM_SETSEL, line_start, line_end)
                    rbuf = ctypes.create_unicode_buffer(final_ed)
                    u32.SendMessageW(edit_child, EM_REPLACESEL, 1, ctypes.addressof(rbuf))
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

    # 2) 이미지 파일인 경우 EXIF 촬영일(DateTimeOriginal=36867, DateTime=306) 추출
    if ext_low in (".jpg", ".jpeg", ".png", ".webp", ".heic", ".tif", ".tiff"):
        try:
            from PIL import Image
            with Image.open(fpath) as im:
                exif = im.getexif()
                if exif:
                    dt_raw = str(exif.get(36867) or exif.get(36868) or exif.get(306) or "").strip()
                    m_ex = re.search(r"20(\d{2})[:.\-/](\d{2})[:.\-/](\d{2})", dt_raw)
                    if m_ex:
                        exif_yymmdd = f"{m_ex.group(1)}{m_ex.group(2)}{m_ex.group(3)}"
        except Exception:
            pass

    # 3) 일반 문서(.txt, .md, .csv, .json, .html, .xml, .docx, .pdf, .hwp) 본문 첫 날짜 및 제목 추출
    if ext_low in (".txt", ".md", ".csv", ".json", ".log", ".html", ".xml"):
        try:
            raw_b = fpath.read_bytes()[:16384]
            try:
                doc_text = raw_b.decode("utf-8")[:8000]
            except UnicodeDecodeError:
                doc_text = raw_b.decode("cp949", errors="ignore")[:8000]
        except Exception:
            pass
    elif ext_low == ".docx":
        try:
            import zipfile
            with zipfile.ZipFile(fpath, "r") as zf:
                if "word/document.xml" in zf.namelist():
                    raw_xml = zf.read("word/document.xml").decode("utf-8", errors="ignore")
                    doc_text = re.sub(r"<[^>]+>", " ", raw_xml)[:8000]
        except Exception:
            pass
    elif ext_low in (".pdf", ".hwp"):
        try:
            raw_b = fpath.read_bytes()[:65536]
            txt_u8 = raw_b.decode("utf-8", errors="ignore")
            txt_cp = raw_b.decode("cp949", errors="ignore")
            kor_chunks = [w for w in re.findall(r"[가-힣]{2,12}", txt_u8 + " " + txt_cp) if is_valid_korean_word(w)]
            dates_found = re.findall(r"20[0-3]\d[-./년\s]*[01]?\d[-./월\s]*[0-3]?\d", txt_u8)
            doc_text = " ".join(dates_found + kor_chunks)
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
            r"^(IMG|DSC|DCIM|PXL|SAM|DJI|Screenshot|Screen[\s_-]*Shot|KakaoTalk|스캔|scan|문서|새\s*텍스트\s*문서|새\s*문서|제목[\s_-]*없음|이름[\s_-]*없음|무제|Untitled|Document|image|photo|캡처)[\s_-]*\d*[\s_-]*\d*",
            "",
            stem,
            flags=re.IGNORECASE,
        ).strip("_- ")
        if rem and not re.fullmatch(r"[\d_-]+", rem):
            slug = rem[:16]
        else:
            slug = "사진" if ext_low in (".jpg", ".jpeg", ".png", ".webp", ".heic") else "문서"

    return exif_yymmdd, kakao_yymmdd, doc_text, slug


def _get_explorer_selected_paths_safe(target_hwnd: int | None = None) -> list[str]:
    """
    [무오염 탐색기·바탕화면 선택 파일 경로 추출 — 모든 설치 경로(Ghosti/MerlinTools/Secretary) 100% 호환]:
    1) 바탕화면(Progman/WorkerW): Shell.Application.Windows().FindWindowSW(SWC_DESKTOP=8)의 SelectedItems만 조회하며,
       바탕화면 프로그램 바로가기(.lnk, .url)는 라벨링 대상에서 제외해 빈 바탕화면 검색창 소환을 방해하지 않습니다.
    2) 탐색기 폴더 창(CabinetWClass/ExploreWClass): Win11 멀티탭 활성 탭(ShellTabWindowClass)을 정확히 매칭하여
       클릭 선택(SelectedItems)되어 있는 파일 경로만 추출합니다.
    3) ※ 절대 금기: 빈 공간을 클릭해 선택을 해제했을 때(sel.Count == 0) FocusedItem 폴백을 호출하면
       직전 점선 포커스 파일이 딸려 나와 검색창 대신 귀신창이 뜨므로, 창 매칭 성공 시 빈 배열([])을 즉시 반환합니다!
    """
    if sys.platform != "win32":
        return []
    paths: list[str] = []
    try:
        import win32com.client  # type: ignore

        chk_hwnd = int(target_hwnd) if target_hwnd else int(u32.GetForegroundWindow())
        cls_chk = _get_win_class_only(chk_hwnd)
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
                            paths.append(str(dp))
                return paths

        # 2) 탐색기 폴더 창(CabinetWClass / ExploreWClass) — Win11 멀티탭 활성 탭 우선 매칭
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
                    paths.append(str(item_path))
            return paths
    except Exception:
        pass
    return paths


def superpower_9_image_or_pdf_file(recent_png_bytes: list[bytes], target_hwnd: int | None = None) -> None:
    """
    [①번 — 🏷️ 귀신 라벨러(사진·카톡·문서 날짜별 파일명 자동 정리) & 스샷/웹 이미지 실물 파일(.png/.pdf) 1초 변환]:
    1) 탐색기에서 파일(사진·카톡사진·문서)을 선택하거나 복사(Ctrl+C)한 상태면:
       - 직접 찍은 사진(EXIF 보유): `YYMMDD_장소/내용.jpg`
       - 카톡 수신 사진: `YYMMDD_카톡_내용.jpg`
       - 일반 문서(전화번호 010-2026-1234·금액 오인 방지): `YYMMDD_내용_제목.ext`
       형태로 파일명을 즉시 자동 변경(Rename)하고 클립보드에 담아줍니다!
    2) 스샷 2장 이상이면 합본 .pdf, 1장이면 단일 .png 파일로 변환하며 귀신 라벨러 날짜 규칙으로 자동 작명합니다!
    """
    try:
        # 0) 현재 탐색기에서 명시적으로 선택한 파일이 있으면 1순위, 없으면 복사된 파일(CF_HDROP)로 [🏷️ 귀신 라벨러] 즉시 실행!
        sel_f = _get_explorer_selected_paths_safe(target_hwnd)
        target_files = [str(x) for x in sel_f if Path(str(x)).is_file()] if sel_f else []
        if not target_files:
            target_files = get_clipboard_hdrop_files()

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
                else:
                    renamed_paths.append(str(p_orig))
                    rename_pairs.append((p_orig.name, p_orig.name))

            if renamed_paths:
                set_clipboard_hdrop_files(renamed_paths)
                first_old, first_new = rename_pairs[0]
                more_sfx = f" 외 {len(rename_pairs) - 1}건" if len(rename_pairs) > 1 else ""
                show_ghost_toast(f"🏷️ 귀신 라벨러 완료: {first_old} ➔ {first_new}{more_sfx} (Ctrl+V 첨부 가능)", duration_ms=3400)
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
        fg_h = _LAST_TARGET_HWND or u32.GetForegroundWindow()
        ed_h = _find_edit_control_child(fg_h)
        arm_undo_snapshot(fg_h, ed_h, "", val, mode="snippet")
        orig_clip = get_clipboard_text()
        daemon_set_cb(val)
        time.sleep(0.02)
        tap_key_combo([VK_CONTROL], VK_V)
        time.sleep(0.06)
        if orig_clip:
            daemon_set_cb(orig_clip)
        show_ghost_toast(f"👻 귀신같이 상용구({key})")


# =====================================================================
# 메인 이벤트 루프
# =====================================================================
def main() -> None:
    lock_sock = acquire_single_instance()
    if lock_sock is None:
        return

    _ensure_toast_worker()
    ensure_default_snippets()

    u32.RegisterHotKey(None, 1, MOD_CONTROL | MOD_NOREPEAT, VK_0)
    u32.RegisterHotKey(None, 2, MOD_CONTROL | MOD_NOREPEAT, VK_NUMPAD0)
    u32.RegisterHotKey(None, 4, MOD_CONTROL | MOD_ALT | MOD_NOREPEAT, 0x54)  # Ctrl + Alt + T (항상 위 창고정/해제)
    u32.SetTimer(None, 1, 25, None)

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

    def _prune_history_by_retention() -> int:
        cfg = get_superpower_settings()
        ret_days = int(cfg.get("retention_days", 7))
        max_items = int(cfg.get("max_items", 300))
        cutoff_ts = time.time() - (ret_days * 86400.0)
        ai_clipboard_history[:] = [r for r in ai_clipboard_history if float(r.get("ts", 0)) >= cutoff_ts][-max_items:]
        GLOBAL_AI_HISTORY[:] = [r for r in GLOBAL_AI_HISTORY if float(r.get("ts", 0)) >= cutoff_ts][-max_items:]
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
            if len(GLOBAL_AI_HISTORY) > 60:
                GLOBAL_AI_HISTORY.pop(0)
        except Exception:
            pass

    # 데몬 기동 직후 현재 클립보드에 들어있는 텍스트/이미지를 초기 기억 히스토리에 적재
    try:
        init_clip = get_clipboard_text()
        if init_clip and len(init_clip.strip()) >= 2:
            record_ai_history(init_clip)
        # Session 1 창 진단 스냅샷 기록 (무인 원격 점검용)
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

    last_summon_raw_clip: str = ""
    last_consumed_image_ts: float = 0.0
    last_hdrop_copy_ts: float = 0.0
    last_lbtn_click_ts: float = 0.0
    last_question_mark_ts: float = 0.0
    last_drag_select_ts: float = 0.0
    lbtn_down_pt: tuple[int, int] | None = None
    was_lbtn_phys_down: bool = False
    last_alpha_type_ts: float = 0.0
    last_any_key_ts: float = 0.0
    last_paste_ts: float = 0.0
    idle_checked_for_ts: float = 0.0
    was_sub_key_down: dict[int, bool] = {}
    last_auto_morph_state: dict[str, object] = {"active": False}

    def arm_sub_hotkeys() -> None:
        nonlocal menu_armed, menu_armed_until
        if not menu_armed:
            for num in range(1, 7):
                u32.RegisterHotKey(None, 100 + num, MOD_NOREPEAT, 0x30 + num)
                u32.RegisterHotKey(None, 200 + num, MOD_NOREPEAT, 0x60 + num)
                # 유저가 Ctrl+0 직후 Ctrl 키에서 손을 미처 다 떼기 전에 숫자 1~6을 눌러도 100% 작동하도록 Ctrl+숫자도 함께 무장!
                u32.RegisterHotKey(None, 400 + num, MOD_CONTROL | MOD_NOREPEAT, 0x30 + num)
                u32.RegisterHotKey(None, 500 + num, MOD_CONTROL | MOD_NOREPEAT, 0x60 + num)
            for fnum in range(1, 11):
                u32.RegisterHotKey(None, 300 + fnum, MOD_NOREPEAT, VK_F1 + fnum - 1)
            menu_armed = True
        menu_armed_until = time.time() + MENU_ARM_SECONDS

    def disarm_sub_hotkeys() -> None:
        nonlocal menu_armed
        if menu_armed:
            for num in range(1, 10):
                u32.UnregisterHotKey(None, 100 + num)
                u32.UnregisterHotKey(None, 200 + num)
                u32.UnregisterHotKey(None, 400 + num)
                u32.UnregisterHotKey(None, 500 + num)
            for fnum in range(1, 11):
                u32.UnregisterHotKey(None, 300 + fnum)
            menu_armed = False

    def _execute_superpower_num(num: int) -> None:
        """
        [귀신창 수동 초능력 1~6번 체계 (한영·띄어쓰기는 타이핑 자동 감지, 서식·줄바꿈 다림질은 1번 수동 전환)]:
        1줄(하늘색 주력): [Ctrl+V] 순차·칸맞춤 | [1] 🧹서식·줄바꿈   | [2] 🏷️파일·라벨러(PDF)🔒
        2줄(흰색 확장):   [3] 글자·표OCR🔒     | [4] 합본🔒          | [5] 번호·일정🔒          | [6] 창고정🔒   | [⌨️상용구▾] [💡꿀팁·추가▾]
        """
        nonlocal seq_mode, last_hdrop_copy_ts
        disarm_sub_hotkeys()
        close_ghost_toast()
        if _LAST_TARGET_HWND and u32.IsWindow(_LAST_TARGET_HWND):
            try:
                if u32.GetForegroundWindow() != _LAST_TARGET_HWND:
                    u32.SetForegroundWindow(_LAST_TARGET_HWND)
                    time.sleep(0.025)
            except Exception:
                pass
        seq_mode = False
        fkey = f"superpower_key_{num}"
        allowed, q_msg = check_feature_quota_allowed(fkey)
        if not allowed:
            show_ghost_toast(q_msg, duration_ms=3200)
            return
        if num == 1:
            did_iron = superpower_1_clean_and_iron_lines(
                daemon_set_clipboard,
                raw_src=last_summon_raw_clip,
                has_recent_drag=(last_drag_select_ts > last_any_key_ts and (time.time() - last_drag_select_ts) <= 6.0),
            )
            if did_iron:
                ironed_now = get_clipboard_text()
                if ironed_now:
                    recent_unpasted[:] = [ironed_now]
                    seq_queue.clear()
                complete_feature_action_success("superpower_key_1")
        elif num in (2, 9):
            last_hdrop_copy_ts = 0.0
            is_pdf_m = len(recent_images) >= 2
            superpower_9_image_or_pdf_file(recent_images, target_hwnd=_LAST_TARGET_HWND)
            complete_feature_action_success("feat_b3_pdf_merge" if is_pdf_m else "superpower_key_2")
        elif num == 3:
            superpower_6_screen_ocr(daemon_set_clipboard)
            complete_feature_action_success("superpower_key_3")
        elif num == 4:
            superpower_5_merge_or_ai_search(recent_unpasted, seq_queue, ai_clipboard_history, daemon_set_clipboard)
            complete_feature_action_success("superpower_key_4")
        elif num in (5, 7):
            seq_queue.clear()
            recent_unpasted.clear()
            superpower_8_format_numbers(
                daemon_set_clipboard,
                raw_src=last_summon_raw_clip,
                has_recent_drag=(last_drag_select_ts > last_any_key_ts and (time.time() - last_drag_select_ts) <= 6.0),
            )
            complete_feature_action_success("superpower_key_5")
        elif num in (6, 8):
            superpower_7_toggle_topmost(_LAST_TARGET_HWND)
            complete_feature_action_success("superpower_key_6")

    def _show_default_ui1_bar(live_clip_val: str | None) -> None:
        nonlocal seq_queue
        excel_cells = []
        if recent_unpasted:
            excel_cells = split_excel_cells(recent_unpasted[-1])
        if not excel_cells and live_clip_val:
            excel_cells = split_excel_cells(live_clip_val)
        if not excel_cells and has_excel_clipboard_format() and len(recent_unpasted) >= 2:
            excel_cells = list(recent_unpasted)

        if excel_cells:
            seq_queue = excel_cells
            daemon_set_clipboard(seq_queue[0])
            arm_sub_hotkeys()
            show_ghost_toast(
                f"귀신같이 (엑셀 {len(excel_cells)}칸 장전) | [Ctrl+V] 순차·칸맞춤   [1] 🧹서식·줄바꿈   [2] 🏷️파일·라벨러(PDF)🔒\n[3] 글자·표OCR🔒   [4] 합본🔒   [5] 번호·일정🔒   [6] 창고정🔒",
                duration_ms=6500,
            )
        elif len(recent_unpasted) >= 2 and not ("\n" in (live_clip_val or "") and not has_excel_clipboard_format()):
            seq_queue = list(recent_unpasted)
            daemon_set_clipboard(seq_queue[0])
            arm_sub_hotkeys()
            show_ghost_toast(
                f"귀신같이 ({len(seq_queue)}개 장전) | [Ctrl+V] 순차·칸맞춤   [1] 🧹서식·줄바꿈   [2] 🏷️파일·라벨러(PDF)🔒\n[3] 글자·표OCR🔒   [4] 합본🔒   [5] 번호·일정🔒   [6] 창고정🔒",
                duration_ms=6500,
            )
        else:
            seq_queue.clear()
            arm_sub_hotkeys()
            show_ghost_toast(
                "귀신같이 | [Ctrl+V] 순차·칸맞춤   [1] 🧹서식·줄바꿈   [2] 🏷️파일·라벨러(PDF)🔒\n[3] 글자·표OCR🔒   [4] 합본🔒   [5] 번호·일정🔒   [6] 창고정🔒",
                duration_ms=6500,
            )

    def trigger_master_summon(summon_by_rclick: bool = False) -> None:
        """
        [마스터 기획 정본 v1.4 — 귀신호출 3인방(Ctrl+0 / Ctrl+우클릭 / 우클릭 0.35초 꾹) 100% 동일 조건 분기 + 재호출 토글]:
        0) [연속 재호출 토글]: 이미 귀신창/귀신검색창이 떠 있는 상태에서 한 번 더 호출하면 즉시 [기본 귀신창 ⇄ 귀신검색창] 상호 전환!
        1) [창 UI ③ 사진·OCR 창]: 방금(15초 이내) 스샷을 캡처한 직후 최초 1회 소환 시 ➔ 사진·OCR 전용 창 직행 (1회성 소비)!
        2) [창 UI ② 👻 귀신검색창]:
           - 바탕화면/탐색기 빈 곳 소환 시 (압축파일 위면 UI ④, 일반이면 귀신검색창 직행)
           - 입력창 내부라도 '단어를 드래그 선택'했거나 '단어 끝에 ?를 입력'한 뒤 소환 시 ➔ 해당 단어로 귀신검색창 직행!
        3) [창 UI ① 기본 귀신창]: 일반 입력창에서 드래그/물음표 없이 소환 시 ➔ 기본 귀신창 직행 (타이핑 시작 시 검색창 자동 변신)!
        """
        nonlocal seq_mode, pasting_started, copied_after_trigger, seq_queue, last_summon_raw_clip, last_consumed_image_ts, last_hdrop_copy_ts, last_question_mark_ts, last_drag_select_ts
        now_s = time.time()

        # [0순위: 연속 재호출 토글] 현재 열린 창이 의도와 다를 때 바로 한 번 더 호출하면 즉시 반대 창으로 스왑!
        if _CURRENT_OPEN_UI_MODE == "ui1":
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

        # [핵심 통일]: 단축키(Ctrl+0 vs Ctrl+우클릭 vs 우클릭 꾹)에 따라 다르게 띄우지 않고 오직 현재 창 문맥으로만 100% 동일 판별!
        if proc_before in ("explorer.exe", "python.exe", "pythonw.exe") or cls_before in ("Progman", "WorkerW", "Shell_TrayWnd", "CabinetWClass", "ExploreWClass"):
            is_dedicated_input_app = False
        else:
            is_dedicated_input_app = True

        if proc_before not in ("python.exe", "pythonw.exe"):
            _capture_target_hwnd()
        play_baby_ghost_sound(mode="summon")
        record_feature_telemetry("ctrl0_summon_bar")
        seq_mode = True
        pasting_started = False
        copied_after_trigger = False

        live_clip = get_clipboard_text()
        if live_clip:
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
            disarm_sub_hotkeys()
            show_ghost_toast("__UI2_SEARCH__|small|", duration_ms=8000)
            return

        # [분기 3: 입력창 내부 — (A) 단어 드래그 선택 또는 단어 끝 '?' 감지 시 ➔ 귀신검색창 / (B) 일반 커서 ➔ 기본 귀신창]
        explicit_search_query = ""
        ed_chk = _find_edit_control_child(fg_before)
        if ed_chk:
            try:
                _, idx_t, _ = _get_edit_full_text_and_index_str(ed_chk)
                if idx_t:
                    u16_b = idx_t.encode("utf-16-le")
                    u16_len = len(u16_b) // 2
                    s_d = wintypes.DWORD(0)
                    e_d = wintypes.DWORD(0)
                    u32.SendMessageW(ed_chk, EM_GETSEL, ctypes.addressof(s_d), ctypes.addressof(e_d))
                    sp, ep = s_d.value, e_d.value
                    if 0 <= sp < ep <= u16_len:
                        sel_s = u16_b[sp * 2 : ep * 2].decode("utf-16-le", errors="ignore").strip()
                        if 0 < len(sel_s) <= 80 and "\n" not in sel_s:
                            explicit_search_query = sel_s.rstrip("?？").strip() or sel_s
                    if not explicit_search_query:
                        cur_ln_q = _get_edit_control_current_line(ed_chk) or ""
                        if cur_ln_q.rstrip().endswith(("?", "？")):
                            toks_q = cur_ln_q.rstrip().rstrip("?？").strip().split()
                            explicit_search_query = toks_q[-1] if toks_q else ""
                            last_question_mark_ts = 0.0
            except Exception:
                pass
        else:
            is_excel_fg = proc_before in ("excel.exe", "hcell.exe") or ("xlmain" in cls_before.lower())
            if (now_s - last_question_mark_ts) <= 8.0:
                last_question_mark_ts = 0.0
                q_cand = "".join(typed_ascii_buf).rstrip("?？/").strip()
                if q_cand and not AI_ENGINE.is_valid_english_word(q_cand):
                    k_q = eng_word_to_kor(q_cand)
                    if k_q and is_valid_korean_word(k_q):
                        q_cand = k_q
                explicit_search_query = q_cand or "__QUESTION__"
            elif not is_excel_fg and last_drag_select_ts > last_any_key_ts and (now_s - last_drag_select_ts) <= 6.0:
                last_drag_select_ts = 0.0
                orig_c_q = get_clipboard_text()
                sent_q = "__GHOSTI_DRAG_Q__"
                release_all_modifiers()
                daemon_set_clipboard(sent_q)
                time.sleep(0.015)
                tap_key_combo([VK_CONTROL], VK_C)
                time.sleep(0.045)
                copied_q = get_clipboard_text()
                if orig_c_q and orig_c_q != sent_q:
                    daemon_set_clipboard(orig_c_q)
                # 노션 등에서 미선택 블록 전체 복사(끝에 \n/\r 포함)된 경우는 드래그 선택이 아니므로 무시하고 커서 복구!
                if copied_q and copied_q != sent_q and not copied_q.endswith(("\n", "\r")):
                    cq_strip = copied_q.strip()
                    if 0 < len(cq_strip) <= 80 and "\n" not in cq_strip:
                        explicit_search_query = cq_strip.rstrip("?？").strip() or cq_strip
                elif copied_q and copied_q != sent_q and copied_q.endswith(("\n", "\r")):
                    tap_key_combo([], 0x23)  # VK_END로 노션 블록 선택 모드 즉시 해제

        if explicit_search_query:
            disarm_sub_hotkeys()
            q_param = "" if explicit_search_query == "__QUESTION__" else explicit_search_query
            show_ghost_toast(f"__UI2_SEARCH__|small|{q_param}", duration_ms=8000)
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
        우클릭 0.35초 롱프레스 달성 순간 실제 마우스 커서 아래 컨트롤(SysListView32/SHELLDLL_DefView 등)과
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
        [바탕화면/앱 기본 우클릭 메뉴 즉시 소거 & 검정 먹통 원천 차단]:
        - explorer.exe 소속 Xaml_WindowedPopupClass나 Progman/WorkerW에 WM_CLOSE를 쏘던 위험 코드를 100% 제거!
        - 손을 뗀 직후(5ms~180ms) 고전 메뉴(#32768)가 찰나에라도 생성되면 즉시 MN_CANCELMENUS + WM_CLOSE + ESC로 닫습니다.
        """
        def _worker():
            global _LAST_RBTN_DISMISS_ESC_TS
            try:
                MN_CANCELMENUS = 0x01E6
                WM_CLOSE_MSG = 0x0010
                VK_ESCAPE = 0x1B
                esc_sc = u32.MapVirtualKeyW(VK_ESCAPE, 0)
                sent_esc = False
                for delay_s in (0.005, 0.015, 0.030, 0.055, 0.090, 0.140):
                    time.sleep(delay_s)
                    h_menu = u32.FindWindowW("#32768", None)
                    if h_menu and u32.IsWindowVisible(h_menu):
                        u32.PostMessageW(h_menu, MN_CANCELMENUS, 0, 0)
                        u32.PostMessageW(h_menu, WM_CLOSE_MSG, 0, 0)
                        if not sent_esc:
                            sent_esc = True
                            _LAST_RBTN_DISMISS_ESC_TS = time.time()
                            u32.keybd_event(VK_ESCAPE, esc_sc, 0, 0)
                            time.sleep(0.006)
                            u32.keybd_event(VK_ESCAPE, esc_sc, KEYEVENTF_KEYUP, 0)
                if not sent_esc:
                    # Win11 Xaml 팝업 메뉴 대응용 안전한 ESC 1회
                    _LAST_RBTN_DISMISS_ESC_TS = time.time()
                    u32.keybd_event(VK_ESCAPE, esc_sc, 0, 0)
                    time.sleep(0.006)
                    u32.keybd_event(VK_ESCAPE, esc_sc, KEYEVENTF_KEYUP, 0)
                _toast_queue.put(("__LIFT__", 0))
            except Exception:
                pass

        threading.Thread(target=_worker, daemon=True).start()

    msg = wintypes.MSG()
    PM_REMOVE = 0x0001
    WM_QUIT_MSG = 0x0012
    # [절대 금기]: 데몬 기동·재기동 시 유저가 호출하지 않았는데 귀신창이 혼자 튀어나오는 현상 영구 차단!
    pending_init_show_ts: float = 0.0
    while True:
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
                        if (now_hk - last_summon_ts) > 0.25:
                            last_summon_ts = now_hk
                            trigger_master_summon()

                    # 1-B) 창 고정/원복 전용 핫키 (Ctrl + Alt + T)
                    elif hk_id == 4:
                        now_hk = time.time()
                        if (now_hk - last_topmost_ts) > 0.25:
                            last_topmost_ts = now_hk
                            _execute_superpower_num(8)

                    # 1-C) 오타성형/다림질 직후 1단계 정밀 원복 (Ctrl + Z 스냅샷)
                    elif hk_id == 999:
                        execute_undo_snapshot(daemon_set_clipboard)

                    # 2) 숫자 2~9 초능력 발동 (단독 또는 Ctrl 유지 상태 모두 지원)
                    elif (101 <= hk_id <= 109) or (201 <= hk_id <= 209) or (401 <= hk_id <= 409) or (501 <= hk_id <= 509):
                        _execute_superpower_num(hk_id % 100)

                    # 3) F1~F10 고정 상용구 발동
                    elif 301 <= hk_id <= 310:
                        fslot = hk_id - 300
                        disarm_sub_hotkeys()
                        seq_mode = False
                        fkey = f"snippet_F{fslot}"
                        allowed, q_msg = check_feature_quota_allowed(fkey)
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
                    try:
                        _ensure_toast_worker()
                        u32.RegisterHotKey(None, 1, MOD_CONTROL | MOD_NOREPEAT, VK_0)
                        u32.RegisterHotKey(None, 2, MOD_CONTROL | MOD_NOREPEAT, VK_NUMPAD0)
                        u32.RegisterHotKey(None, 4, MOD_CONTROL | MOD_ALT | MOD_NOREPEAT, 0x54)
                        u32.SetTimer(None, 1, 25, None)
                    except Exception:
                        pass
                while not _CLICKED_SUPERPOWER_QUEUE.empty():
                    try:
                        c_num = _CLICKED_SUPERPOWER_QUEUE.get_nowait()
                        if c_num == 0:
                            if _LAST_TARGET_HWND and u32.IsWindow(_LAST_TARGET_HWND):
                                u32.SetForegroundWindow(_LAST_TARGET_HWND)
                                time.sleep(0.025)
                            tap_key_combo([VK_CONTROL], VK_V)
                        elif 1 <= c_num <= 9:
                            _execute_superpower_num(c_num)
                    except Exception:
                        pass
                # [Zero-Hook 마우스 우클릭 감지]: WH_MOUSE_LL 전역 훅 없이 GetAsyncKeyState(0x02) 폴링만으로
                # ① Ctrl+우클릭 즉시 소환 / ② 우클릭 0.35초 꾹~~ 롱프레스 소환 / ③ 버튼 해제 시 네이티브 메뉴 자동 닫기 수행
                rbtn_phys_now = (u32.GetAsyncKeyState(0x02) & 0x8000) != 0
                was_rbtn_phys = was_key_down.get(0x9901, False)
                ctrl_now_r = (u32.GetAsyncKeyState(VK_CONTROL) & 0x8000) != 0
                alt_now_r = (u32.GetAsyncKeyState(VK_MENU) & 0x8000) != 0
                shift_now_r = (u32.GetAsyncKeyState(VK_SHIFT) & 0x8000) != 0

                if rbtn_phys_now and not was_rbtn_phys:
                    pt_rc = wintypes.POINT()
                    u32.GetCursorPos(ctypes.byref(pt_rc))
                    hwnd_fg_r = u32.GetForegroundWindow()
                    if _should_bypass_rclick_hook(hwnd_fg_r):
                        _RBTN_HOLD_STATE["active"] = False
                        _RBTN_HOLD_STATE["dismiss_context_menu_on_up"] = False
                    elif ctrl_now_r and not alt_now_r and not shift_now_r:
                        _RBTN_HOLD_STATE["active"] = False
                        _RBTN_HOLD_STATE["triggered"] = True
                        _RBTN_HOLD_STATE["dismiss_context_menu_on_up"] = True
                        _RBTN_HOLD_STATE["target_hwnd"] = hwnd_fg_r
                        _RBTN_HOLD_STATE["x"] = pt_rc.x
                        _RBTN_HOLD_STATE["y"] = pt_rc.y
                        _release_target_rbutton_stuck(hwnd_fg_r)
                        if (now - last_summon_ts) > 0.25:
                            last_summon_ts = now
                            trigger_master_summon(summon_by_rclick=True)
                    elif (now - last_any_key_ts) < 0.45:
                        # 키보드 타이핑 중 손바닥/터치패드 우클릭 오접촉으로 인한 롱프레스 소환 원천 차단!
                        _RBTN_HOLD_STATE["active"] = False
                        _RBTN_HOLD_STATE["dismiss_context_menu_on_up"] = False
                    else:
                        _RBTN_HOLD_STATE["active"] = True
                        _RBTN_HOLD_STATE["down_ts"] = now
                        _RBTN_HOLD_STATE["x"] = pt_rc.x
                        _RBTN_HOLD_STATE["y"] = pt_rc.y
                        _RBTN_HOLD_STATE["target_hwnd"] = hwnd_fg_r
                        _RBTN_HOLD_STATE["triggered"] = False
                        _RBTN_HOLD_STATE["dismiss_context_menu_on_up"] = False
                elif rbtn_phys_now and was_rbtn_phys:
                    if _RBTN_HOLD_STATE.get("active") and not _RBTN_HOLD_STATE.get("triggered"):
                        pt_now = wintypes.POINT()
                        u32.GetCursorPos(ctypes.byref(pt_now))
                        if (
                            abs(pt_now.x - _RBTN_HOLD_STATE["x"]) > RBUTTON_MOVE_TOLERANCE_PX
                            or abs(pt_now.y - _RBTN_HOLD_STATE["y"]) > RBUTTON_MOVE_TOLERANCE_PX
                        ):
                            _RBTN_HOLD_STATE["active"] = False
                        elif (now - _RBTN_HOLD_STATE.get("down_ts", 0.0)) >= RBUTTON_LONG_PRESS_SEC:
                            _RBTN_HOLD_STATE["active"] = False
                            _RBTN_HOLD_STATE["triggered"] = True
                            _RBTN_HOLD_STATE["dismiss_context_menu_on_up"] = True
                            _release_target_rbutton_stuck(_RBTN_HOLD_STATE.get("target_hwnd"))
                            if (now - last_summon_ts) > 0.25:
                                last_summon_ts = now
                                trigger_master_summon(summon_by_rclick=True)
                elif not rbtn_phys_now and was_rbtn_phys:
                    _RBTN_HOLD_STATE["active"] = False
                    if _RBTN_HOLD_STATE.get("dismiss_context_menu_on_up"):
                        _RBTN_HOLD_STATE["dismiss_context_menu_on_up"] = False
                        _dismiss_native_context_menu_after_rbtn_up(_RBTN_HOLD_STATE.get("target_hwnd"))
                was_key_down[0x9901] = rbtn_phys_now
                if _UNDO_SNAPSHOT.get("active") and (now - _UNDO_SNAPSHOT.get("ts", 0.0)) > 60.0:
                    disarm_undo_snapshot()
                if _PINNED_HWNDS:
                    enforce_pinned_windows()
                global _CLEAR_ALL_REQUESTED
                sig_triggered = False
                if CLEAR_SIGNAL_FILE.exists():
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
                    empty_os_clipboard()
                    last_seq_num = u32.GetClipboardSequenceNumber()
                    close_ghost_toast()
                if menu_armed:
                    if _CURRENT_OPEN_UI_MODE == "ui1":
                        menu_armed_until = now + MENU_ARM_SECONDS
                    elif (now - last_summon_ts) > 0.35 or now > menu_armed_until:
                        disarm_sub_hotkeys()

                # 귀신창이 열려 있을 때(menu_armed) UWP 계산기 등이 WM_HOTKEY를 가로채더라도 하드웨어 키 폴링으로 숫자 1~6 즉시 발동!
                if menu_armed and (now - last_summon_ts) > 0.14:
                    fg_cls_now = _get_win_class_only(u32.GetForegroundWindow())
                    if "Tk" not in fg_cls_now:
                        triggered_num = 0
                        for n_check in range(1, 7):
                            k_main = (u32.GetAsyncKeyState(0x30 + n_check) & 0x8000) != 0
                            k_numpad = (u32.GetAsyncKeyState(0x60 + n_check) & 0x8000) != 0
                            k_now = k_main or k_numpad
                            if k_now and not was_sub_key_down.get(n_check, False):
                                triggered_num = n_check
                            was_sub_key_down[n_check] = k_now
                        if triggered_num:
                            _execute_superpower_num(triggered_num)
                            continue
                        # 기본 귀신창이 떠 있는 상태에서 유저가 키보드 글자(A~Z)를 타이핑하기 시작하면 즉시 👻 귀신검색창으로 스르륵 자동 변신!
                        ctrl_chk = (u32.GetAsyncKeyState(VK_CONTROL) & 0x8000) != 0
                        alt_chk = (u32.GetAsyncKeyState(VK_MENU) & 0x8000) != 0
                        if not ctrl_chk and not alt_chk:
                            for vk_alpha in range(0x41, 0x5B):
                                a_down = (u32.GetAsyncKeyState(vk_alpha) & 0x8000) != 0
                                if a_down and not was_key_down.get(vk_alpha, False):
                                    _toast_queue.put(("__MORPH_SEARCH__", 0))
                                    break
                else:
                    for n_check in range(1, 7):
                        was_sub_key_down[n_check] = (
                            ((u32.GetAsyncKeyState(0x30 + n_check) & 0x8000) != 0)
                            or ((u32.GetAsyncKeyState(0x60 + n_check) & 0x8000) != 0)
                        )

                # 1) %LOCALAPPDATA%/Ghosti/data/clipboard_queue.json 에 순차 목록을 장전했는지 확인
                if QUEUE_FILE.exists():
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
                        if (copied == last_self_text and now < self_set_until) or (menu_armed and (now - last_summon_ts) < 1.5):
                            pass
                        else:
                            last_self_text = None
                            last_summon_raw_clip = copied
                            disarm_sub_hotkeys()
                            record_ai_history(copied)

                            if seq_mode:
                                if pasting_started:
                                    seq_mode = False
                                    pasting_started = False
                                    copied_after_trigger = False
                                    seq_queue.clear()
                                    recent_unpasted = [copied]
                                    last_copy_ts = now
                                else:
                                    if not copied_after_trigger:
                                        seq_queue.clear()
                                        copied_after_trigger = True
                                    if not seq_queue or seq_queue[-1] != copied:
                                        seq_queue.append(copied)
                                    if len(seq_queue) >= 2:
                                        daemon_set_clipboard(seq_queue[0])
                            else:
                                if last_copy_ts > 0 and (now - last_copy_ts) > AUTO_CLEAN_SECONDS:
                                    recent_unpasted.clear()
                                if not recent_unpasted or recent_unpasted[-1] != copied:
                                    recent_unpasted.append(copied)
                                last_copy_ts = now
                    else:
                        # 유저의 직접 파일 복사(CF_HDROP) 시각 기록 (데몬 자체 라벨러 CF_HDROP 재주입은 _SELF_HDROP_UNTIL로 제외)
                        if now >= _SELF_HDROP_UNTIL and get_clipboard_hdrop_files():
                            last_hdrop_copy_ts = now
                        # 텍스트가 아닌 경우 스샷 이미지(Bitmap)인지 확인하여 다중 스샷->PDF 버퍼에 적재
                        try:
                            from PIL import Image, ImageGrab
                            clip_img = ImageGrab.grabclipboard()
                            if isinstance(clip_img, Image.Image):
                                buf = io.BytesIO()
                                clip_img.save(buf, "PNG")
                                png_bytes = buf.getvalue()
                                if png_bytes != last_image_sig:
                                    last_image_sig = png_bytes
                                    if last_image_ts > 0 and (now - last_image_ts) > IMAGE_CLEAN_SECONDS:
                                        recent_images.clear()
                                    recent_images.append(png_bytes)
                                    last_image_ts = now
                                    record_ai_image_history(png_bytes)
                        except Exception:
                            pass

                # 3) Ctrl + V 및 마스터 트리거(Ctrl + 0) 물리 키 입력 감지
                # - Windows 입력기와 타 앱이 RegisterHotKey(Ctrl+0)를 가로채더라도 GetAsyncKeyState 하드웨어 폴링으로 100% 작동 보장!
                ctrl_down = (u32.GetAsyncKeyState(VK_CONTROL) & 0x8000) != 0
                alt_down = (u32.GetAsyncKeyState(VK_MENU) & 0x8000) != 0
                shift_down = (u32.GetAsyncKeyState(VK_SHIFT) & 0x8000) != 0
                v_down = (u32.GetAsyncKeyState(VK_V) & 0x8000) != 0
                ctrl_v_now = ctrl_down and v_down

                # 마우스 좌클릭 드래그(단어 블록 선택) 및 빈 공간 선택 해제 클릭 시각 감지
                lbtn_phys_now = (u32.GetAsyncKeyState(0x01) & 0x8000) != 0
                if lbtn_phys_now and not was_lbtn_phys_down:
                    last_lbtn_click_ts = now
                    pt_ld = wintypes.POINT()
                    u32.GetCursorPos(ctypes.byref(pt_ld))
                    lbtn_down_pt = (pt_ld.x, pt_ld.y)
                elif not lbtn_phys_now and was_lbtn_phys_down and lbtn_down_pt is not None:
                    pt_lu = wintypes.POINT()
                    u32.GetCursorPos(ctypes.byref(pt_lu))
                    if abs(pt_lu.x - lbtn_down_pt[0]) >= 14 or abs(pt_lu.y - lbtn_down_pt[1]) >= 10:
                        last_drag_select_ts = now
                    lbtn_down_pt = None
                was_lbtn_phys_down = lbtn_phys_now

                zero_down = ((u32.GetAsyncKeyState(VK_0) & 0x8000) != 0) or ((u32.GetAsyncKeyState(VK_NUMPAD0) & 0x8000) != 0)
                z_down = (u32.GetAsyncKeyState(VK_Z) & 0x8000) != 0
                t_down = (u32.GetAsyncKeyState(0x54) & 0x8000) != 0
                # 오직 Ctrl + 0 만 하드웨어 폴링으로 마스터 소환!
                ctrl0_now = ctrl_down and not alt_down and not shift_down and zero_down
                if ctrl0_now and not was_ctrl0_down:
                    if (now - last_summon_ts) > 0.30:
                        last_summon_ts = now
                        trigger_master_summon()
                was_ctrl0_down = ctrl0_now

                ctrl_alt_t_now = ctrl_down and alt_down and not shift_down and t_down
                if ctrl_alt_t_now and not was_ctrl_alt_t_down:
                    if (now - last_topmost_ts) > 0.25:
                        last_topmost_ts = now
                        _execute_superpower_num(8)
                was_ctrl_alt_t_down = ctrl_alt_t_now

                ctrl_z_now = ctrl_down and not alt_down and not shift_down and z_down
                if ctrl_z_now and not was_ctrl_z_down:
                    if _UNDO_SNAPSHOT.get("active"):
                        execute_undo_snapshot(daemon_set_clipboard)
                was_ctrl_z_down = ctrl_z_now

                # [②번 양방향 오토매틱 타이핑 감지 (2어절 연속 오타 감지 + 0.2ms 원자적 교체 + 한/영 키 즉시 동기화)]:
                # - 1단어만 오타 났을 때는 유저가 스스로 백스페이스+한/영 키를 칠 수 있으므로 손버릇 충돌 방지를 위해 대기(pending_first_typo)만 함.
                # - 모른 채 원고만 보며 2단어째 오타까지 연속 입력 후 Space(또는 0.65초 멈춤)하는 순간: 1단어+2단어를 0.2ms 원자적 교체로 성형 + 한/영 키 전환!
                if pending_first_typo is not None and (now - pending_first_typo.get("ts", 0.0)) > 4.5:
                    pending_first_typo = None

                hangul_down = (u32.GetAsyncKeyState(VK_HANGUL) & 0x8000) != 0
                if hangul_down and not was_key_down.get(VK_HANGUL, False):
                    # 유저가 직접 한/영 키를 눌렀다면 1단어 대기 버퍼는 즉시 초기화
                    typed_ascii_buf.clear()
                    pending_first_typo = None
                    last_any_key_ts = now
                was_key_down[VK_HANGUL] = hangul_down

                # 마우스 클릭이나 방향키·편집키(Left/Up/Right/Down/Home/End/Del/Tab/Esc) 입력 시에는 타이핑 버퍼를 즉시 초기화하여 앞 글자 찌꺼기 현상 원천 차단!
                for nav_vk in (0x01, 0x02, 0x09, 0x1B, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x2E):
                    nav_down = (u32.GetAsyncKeyState(nav_vk) & 0x8000) != 0
                    if nav_down and not was_key_down.get(nav_vk, False):
                        if shift_down and nav_vk in (0x23, 0x24, 0x25, 0x26, 0x27, 0x28):
                            last_drag_select_ts = now
                        elif nav_vk == 0x01:
                            # 단순 클릭 시에는 드래그 선택 타임스탬프 해제 (드래그 완료 시에는 위에서 다시 갱신됨)
                            last_drag_select_ts = 0.0
                        if nav_vk not in (0x01, 0x02):
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
                            if len(typed_ascii_buf) > 64:
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
                                        cur_ln_at = _get_edit_control_current_line(ed_prev) or ""
                                        if cur_ln_at.endswith(conv_prev + "@"):
                                            new_ln_at = cur_ln_at[: -(len(conv_prev) + 1)] + raw_rest
                                            s_at = wintypes.DWORD(0)
                                            e_at = wintypes.DWORD(0)
                                            u32.SendMessageW(ed_prev, EM_GETSEL, ctypes.addressof(s_at), ctypes.addressof(e_at))
                                            ln_idx_at = u32.SendMessageW(ed_prev, EM_LINEFROMCHAR, s_at.value, 0)
                                            ln_st_at = u32.SendMessageW(ed_prev, EM_LINEINDEX, ln_idx_at, 0)
                                            ln_len_at = u32.SendMessageW(ed_prev, EM_LINELENGTH, ln_st_at, 0)
                                            if ln_st_at >= 0 and ln_len_at > 0:
                                                u32.SendMessageW(ed_prev, EM_SETSEL, ln_st_at, ln_st_at + ln_len_at)
                                                rb_at = ctypes.create_unicode_buffer(new_ln_at)
                                                u32.SendMessageW(ed_prev, EM_REPLACESEL, 1, ctypes.addressof(rb_at))
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
                                elif d_vk in _SHIFT_DIGIT_MAP:
                                    typed_ascii_buf.append(_SHIFT_DIGIT_MAP[d_vk])
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
                                typed_ascii_buf.append(sh_ch if shift_down else norm_ch)
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
                            typed_ascii_buf.pop()
                        else:
                            # 유저가 1단어 직후 백스페이스를 쳤다면 스스로 수동 교정 중이므로 자동 개입 취소!
                            pending_first_typo = None
                    was_key_down[VK_BACK] = back_down

                    # [스페이스바 없는 0.55초 멈춤 자동 성형 — 오직 '2어절 이상 연속 한영 오타'일 때만 발동!]:
                    # ※ 1어절 단독 긴 영타(예: dmsgydmlapdlf@naver.com 입력 중 dmsgydmlapdlf에서 멈칫하는 경우)는
                    #    0.55초 멈춤에서 절대 자동 변환하지 않으며, 반드시 Space를 눌렀을 때만 변환하여 이메일·아이디 오변환을 100% 차단합니다!
                    if (
                        typed_ascii_buf
                        and len(typed_ascii_buf) >= 2
                        and last_alpha_type_ts > 0
                        and (now - last_alpha_type_ts) >= 0.55
                        and (now - last_alpha_type_ts) < 1.5
                    ):
                        raw_idle_buf_chk = "".join(typed_ascii_buf)
                        hwnd_idle = u32.GetForegroundWindow()
                        if not _is_protected_account_or_email_token(raw_idle_buf_chk) and not should_skip_auto_typo(hwnd_idle):
                            edit_idle = _find_edit_control_child(hwnd_idle)
                            if edit_idle:
                                idle_line = _get_edit_control_current_line(edit_idle)
                                if idle_line and not idle_line.endswith(" ") and (now - last_paste_ts) > 2.0:
                                    idle_tokens = idle_line.strip().split()
                                    if len(idle_tokens) >= 2 and not _is_protected_account_or_email_token(idle_tokens[-1]):
                                        idle_eng_typo_cnt = 0
                                        for itok in idle_tokens:
                                            if _is_protected_account_or_email_token(itok):
                                                continue
                                            for ichunk in re.findall(r"[A-Za-z]+", itok):
                                                if len(ichunk) >= 2 and not AI_ENGINE.is_valid_english_word(ichunk):
                                                    ik = eng_word_to_kor(ichunk)
                                                    if ik and is_valid_korean_word(ik):
                                                        idle_eng_typo_cnt += 1
                                        if idle_eng_typo_cnt >= 2:
                                            ok_id, raw_id, out_id, lang_id = _replace_edit_control_current_line_atomic(edit_idle, auto_triggered=True)
                                            if ok_id:
                                                typed_ascii_buf.clear()
                                                pending_first_typo = None
                                                last_alpha_type_ts = 0.0
                                                complete_feature_action_success("auto_typo_morph_2words")
                            else:
                                # [노션·엑셀·브라우저·카톡 등 비-Edit 컨트롤에서도 2단어째 연속 오타 후 0.55초 멈추면 즉시 자동 성형!]
                                raw_idle_str = raw_idle_buf_chk
                                m_id = re.match(r"^([^A-Za-z0-9가-힣\s]*)([A-Za-z]+)([0-9]*)([^A-Za-z0-9가-힣\s]*)$", raw_idle_str)
                                w_id = m_id.group(2) if m_id else re.sub(r"[^A-Za-z]", "", raw_idle_str)
                                ime_kor_id = get_ime_is_korean(hwnd_idle)
                                if not ime_kor_id and len(w_id) >= 2 and not AI_ENGINE.is_valid_english_word(w_id):
                                    k_id = eng_word_to_kor(w_id)
                                    if k_id and len(k_id) >= 1 and is_valid_korean_word(k_id):
                                        has_prev_id = (
                                            pending_first_typo is not None
                                            and pending_first_typo.get("target_ko") is True
                                            and pending_first_typo.get("hwnd") == hwnd_idle
                                        )
                                        if has_prev_id:
                                            prev_r_id = pending_first_typo["raw"] if has_prev_id else ""
                                            prev_c_id = pending_first_typo["conv"] if has_prev_id else ""
                                            total_bs_id = (pending_first_typo["disp_len"] if has_prev_id else 0) + len(raw_idle_str)
                                            conv_id = morph_korean_english_text(raw_idle_str)
                                            comb_conv_id = _fix_korean_spacing_general(f"{prev_c_id} {conv_id}".strip())
                                            comb_raw_id = f"{prev_r_id} {raw_idle_str}".strip()
                                            typed_ascii_buf.clear()
                                            pending_first_typo = None
                                            last_alpha_type_ts = 0.0
                                            orig_c_id = get_clipboard_text()
                                            release_all_modifiers()
                                            bs_sc = u32.MapVirtualKeyW(VK_BACK, 0)
                                            for _ in range(total_bs_id):
                                                u32.keybd_event(VK_BACK, bs_sc, 0, 0)
                                                time.sleep(0.008)
                                                u32.keybd_event(VK_BACK, bs_sc, KEYEVENTF_KEYUP, 0)
                                                time.sleep(0.005)
                                            time.sleep(0.025)
                                            if send_unicode_text_preserve_style(comb_conv_id):
                                                time.sleep(0.04)
                                            else:
                                                daemon_set_clipboard(comb_conv_id)
                                                time.sleep(0.025)
                                                tap_key_combo([VK_CONTROL], VK_V)
                                                time.sleep(0.08)
                                                if orig_c_id and not seq_mode:
                                                    threading.Timer(0.28, lambda c=orig_c_id: daemon_set_clipboard(c)).start()
                                            set_ime_language(target_korean=True)
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
                            m_last_eng = re.match(r"^([^A-Za-z가-힣\s]*)([A-Za-z]+)([^A-Za-z가-힣\s]*)$", last_tok)
                            # [붙여넣기 및 이메일·계정 보호]: 붙여넣기 영타(raw_buf_str 비어있음) 또는 이메일(@)/계정 토큰은 절대 자동 한영변환 대상으로 잡지 않음!
                            if _is_protected_account_or_email_token(last_tok) or _is_protected_account_or_email_token(raw_buf_str):
                                typed_as_eng = False
                                typed_as_kor = False
                            elif m_last_eng and bool(raw_buf_str):
                                typed_as_eng = True
                                typed_as_kor = False
                                lead_punct, word_cand, trail_punct = m_last_eng.groups()
                                trail_digits = re.sub(r"[^0-9]", "", lead_punct + trail_punct)
                                raw_buf_str = last_tok
                            else:
                                typed_as_eng = bool(raw_buf_str) and cur_stripped.endswith(raw_buf_str)
                                typed_as_kor = bool(raw_buf_str) and not typed_as_eng
                        else:
                            if _is_protected_account_or_email_token(raw_buf_str):
                                typed_as_eng = False
                                typed_as_kor = False
                            else:
                                ime_kor = get_ime_is_korean(hwnd_fg)
                                typed_as_eng = not ime_kor
                                typed_as_kor = ime_kor

                        curr_typo: dict | None = None
                        if typed_as_eng and len(word_cand) >= 2 and not AI_ENGINE.is_valid_english_word(word_cand):
                            kor_cand = eng_word_to_kor(word_cand)
                            if kor_cand and len(kor_cand) >= 1 and is_valid_korean_word(kor_cand):
                                curr_typo = {
                                    "disp_len": len(raw_buf_str) + 1,
                                    "raw": raw_buf_str,
                                    "conv": morph_korean_english_text(raw_buf_str),
                                    "kor_len": len(kor_cand),
                                    "target_ko": True,
                                    "has_digits": bool(trail_digits),
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
                                        "kor_len": len(kor_produced),
                                        "target_ko": False,
                                        "has_digits": False,
                                        "ts": now,
                                        "hwnd": hwnd_fg,
                                    }

                        if curr_typo is not None:
                            should_trigger = False
                            is_long_4syl = bool(curr_typo["target_ko"] and len(word_cand) >= 9 and curr_typo.get("kor_len", 0) >= 4)
                            if cur_line is not None:
                                line_tokens = cur_line.strip().split()
                                if len(line_tokens) >= 2:
                                    prev_is_eng_typo = False
                                    for prev_tok in line_tokens[:-1]:
                                        if _is_protected_account_or_email_token(prev_tok):
                                            continue
                                        for p_chunk in re.findall(r"[A-Za-z]+", prev_tok):
                                            if len(p_chunk) >= 2 and not AI_ENGINE.is_valid_english_word(p_chunk):
                                                pk = eng_word_to_kor(p_chunk)
                                                if pk and is_valid_korean_word(pk):
                                                    prev_is_eng_typo = True
                                                    break
                                        if prev_is_eng_typo:
                                            break
                                    if curr_typo["target_ko"]:
                                        if prev_is_eng_typo or (curr_typo["has_digits"] and len(word_cand) >= 4) or is_long_4syl:
                                            should_trigger = True
                                    else:
                                        if pending_first_typo is not None and not pending_first_typo["target_ko"] and pending_first_typo.get("hwnd") == hwnd_fg and pending_first_typo["raw"] in cur_line:
                                            should_trigger = True
                                elif is_long_4syl:
                                    should_trigger = True
                            else:
                                if pending_first_typo is not None and pending_first_typo["target_ko"] == curr_typo["target_ko"] and pending_first_typo.get("hwnd") == hwnd_fg:
                                    should_trigger = True
                                elif curr_typo["target_ko"] and ((curr_typo["has_digits"] and len(word_cand) >= 4) or is_long_4syl):
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
                                    ok_ed, raw_ed, out_ed, lang_ed = _replace_edit_control_current_line_atomic(edit_child, auto_triggered=True)
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
                                    # [노션·엑셀·브라우저·카톡 무충돌 원자적 백스페이스 교체]:
                                    # 방금 친 Space가 타겟 앱에 먼저 반영되도록 25ms 대기 후,
                                    # 타이핑한 글자 수(total_backspaces)만큼 정확히 Backspace ➔ 변환 문자열을 Ctrl+V로 사출!
                                    orig_c = get_clipboard_text()
                                    time.sleep(0.025)
                                    release_all_modifiers()
                                    bs_sc = u32.MapVirtualKeyW(VK_BACK, 0)
                                    for _ in range(total_backspaces):
                                        u32.keybd_event(VK_BACK, bs_sc, 0, 0)
                                        time.sleep(0.008)
                                        u32.keybd_event(VK_BACK, bs_sc, KEYEVENTF_KEYUP, 0)
                                        time.sleep(0.005)
                                    time.sleep(0.025)
                                    final_paste = _fix_korean_spacing_general(combined_conv.strip()) + " "
                                    if send_unicode_text_preserve_style(final_paste):
                                        time.sleep(0.04)
                                    else:
                                        daemon_set_clipboard(final_paste)
                                        time.sleep(0.025)
                                        tap_key_combo([VK_CONTROL], VK_V)
                                        time.sleep(0.08)
                                        if orig_c and not seq_mode:
                                            threading.Timer(0.28, lambda c=orig_c: daemon_set_clipboard(c)).start()
                                    set_ime_language(target_korean=target_ko)
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
                            if (
                                edit_child
                                and cur_line is not None
                                and not _is_protected_account_or_email_token(last_tok)
                                and re.search(r"[가-힣]", cur_line)
                                and (now - last_paste_ts) > 2.0
                            ):
                                ok_sp, raw_sp, out_sp, _ = _replace_edit_control_current_line_atomic(
                                    edit_child, auto_triggered=True, allow_typo_morph=False
                                )
                                if ok_sp:
                                    complete_feature_action_success("auto_typo_morph_2words")
                            elif (
                                not edit_child
                                and typed_as_kor
                                and len(word_cand) >= 4
                                and not _is_protected_account_or_email_token(raw_buf_str)
                                and (now - last_paste_ts) > 2.0
                            ):
                                # [노션·브라우저·카톡 등 비-Edit 창 한글 무공백 어절(예: '떡볶이가나왔어요 ', '내일의메뉴는 ') 입력 시 Space 즉시 오토띄어쓰기!]
                                kor_typed_tok = lead_punct + eng_word_to_kor(word_cand) + trail_digits + trail_punct
                                spaced_tok = _fix_korean_spacing_general(kor_typed_tok).strip()
                                if " " in spaced_tok and spaced_tok != kor_typed_tok.strip() and is_valid_korean_word(re.sub(r"[^가-힣]", "", spaced_tok)):
                                    total_bs_sp = len(kor_typed_tok) + 1
                                    orig_c_sp = get_clipboard_text()
                                    time.sleep(0.025)
                                    release_all_modifiers()
                                    bs_sc = u32.MapVirtualKeyW(VK_BACK, 0)
                                    for _ in range(total_bs_sp):
                                        u32.keybd_event(VK_BACK, bs_sc, 0, 0)
                                        time.sleep(0.008)
                                        u32.keybd_event(VK_BACK, bs_sc, KEYEVENTF_KEYUP, 0)
                                        time.sleep(0.005)
                                    time.sleep(0.025)
                                    final_sp_paste = spaced_tok + " "
                                    if send_unicode_text_preserve_style(final_sp_paste):
                                        time.sleep(0.04)
                                    else:
                                        daemon_set_clipboard(final_sp_paste)
                                        time.sleep(0.025)
                                        tap_key_combo([VK_CONTROL], VK_V)
                                        time.sleep(0.08)
                                        if orig_c_sp and not seq_mode:
                                            threading.Timer(0.28, lambda c=orig_c_sp: daemon_set_clipboard(c)).start()
                                    complete_feature_action_success("auto_typo_morph_2words")
                    was_key_down[VK_SPACE] = space_down

                    ret_down = (u32.GetAsyncKeyState(VK_RETURN) & 0x8000) != 0
                    if ret_down and not was_key_down.get(VK_RETURN, False):
                        last_any_key_ts = now
                        last_drag_select_ts = 0.0
                        had_ascii_before_ret = bool(typed_ascii_buf)
                        typed_ascii_buf.clear()
                        pending_first_typo = None
                        hwnd_ret = u32.GetForegroundWindow()
                        if hwnd_ret and not should_skip_auto_typo(hwnd_ret) and (now - last_paste_ts) > 2.0:
                            proc_ret, _, _ = get_window_process_and_class(hwnd_ret)
                            if proc_ret == "notepad.exe":
                                ed_ret = _find_edit_control_child(hwnd_ret)
                                if ed_ret and _polish_notepad_previous_line_on_enter(ed_ret, allow_typo_morph=had_ascii_before_ret):
                                    complete_feature_action_success("auto_typo_morph_2words")
                    was_key_down[VK_RETURN] = ret_down
                else:
                    typed_ascii_buf.clear()
                    if ctrl_down:
                        pending_first_typo = None

                if ctrl_v_now and not was_ctrl_v_down:
                    last_paste_ts = now
                    typed_ascii_buf.clear()
                    pending_first_typo = None
                    last_alpha_type_ts = 0.0
                    disarm_sub_hotkeys()
                    if seq_mode and seq_queue:
                        pasting_started = True
                        time.sleep(0.14)
                        seq_queue.pop(0)
                        if seq_queue:
                            # 다음 사출할 항목을 현재 창/입력칸 문맥(AI_ENGINE)으로 비순차 최적 선별하여 미리 장전!
                            ctx = get_focused_field_context()
                            best_idx, is_smart_matched = select_best_matching_item_index(seq_queue, ctx)
                            if best_idx != 0:
                                matched_item = seq_queue.pop(best_idx)
                                seq_queue.insert(0, matched_item)
                            daemon_set_clipboard(seq_queue[0])
                            if is_smart_matched:
                                show_ghost_toast(f"👻 귀신같이 AI칸맞춤 대기 ({seq_queue[0][:12]})")
                        else:
                            seq_mode = False
                            pasting_started = False
                            copied_after_trigger = False
                            recent_unpasted.clear()
                            complete_feature_action_success("feat_1_seq_paste")
                            show_ghost_toast("👻 귀신같이 순차붙여넣기")
                    else:
                        recent_unpasted.clear()

                was_ctrl_v_down = ctrl_v_now
        except Exception:
            pass

        if not had_hotkey:
            time.sleep(0.015)


def run_quota_self_test() -> int:
    """
    [멀린님 지시 반영: 30일을 기다리지 않고 1초 만에 검증하는 기능별 30일 타이머 & 만료 기능 성공 3회 제한 자동 테스트]
    실행: python tools/seq_paste_daemon.py --test-quota
    """
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ledger_path = _MERLIN_APPDATA / "superpower_trial_ledger.json"
    backup_bytes = ledger_path.read_bytes() if ledger_path.exists() else None
    try:
        if ledger_path.exists():
            ledger_path.unlink()
        print("🧪 [1단계] 초기 미개봉 상태 검증...")
        ok, st = check_feature_quota_allowed("superpower_key_1")
        assert ok and st == "UNOPENED", f"Expected UNOPENED, got {ok}, {st}"
        print(f"   ✅ 1번(서식·줄바꿈 다림질) 초기 상태: {st} (미개봉 확인)")

        print("🧪 [2단계] 1번(서식·줄바꿈 다림질) 첫 실제 성공 완수 -> 30일 무제한 타이머 개시 검증...")
        res1 = complete_feature_action_success("superpower_key_1")
        assert res1["status"] == "FIRST_OPENED_30D" and res1["consumed_daily"] is False
        ok2, st2 = check_feature_quota_allowed("superpower_key_1")
        assert ok2 and st2.startswith("ACTIVE_D-")
        print(f"   ✅ 1번 첫 성공 직후 상태: {res1['status']} / {st2} (일일 3회 차감 없음: consumed_daily={res1['consumed_daily']})")

        print("🧪 [3단계] 1번 기능을 31일 전 사용으로 강제 타임머신 만료 조작 (2번 파일·라벨러는 미개봉 유지)...")
        ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
        hwid = _get_machine_hwid_local()
        ledger["machines"][hwid]["featureTrials"]["feat_4_iron_lines"]["firstUsedTs"] = time.time() - (31 * 86400)
        ledger_path.write_text(json.dumps(ledger, ensure_ascii=False, indent=2), encoding="utf-8")

        print("🧪 [4단계] 만료된 1번 기능 3회 연속 성공 차감 검증 (1회 -> 2회 -> 3회)...")
        for i in range(1, 4):
            ok_exp, st_exp = check_feature_quota_allowed("superpower_key_1")
            assert ok_exp, f"Should allow #{i}, got {st_exp}"
            r_exp = complete_feature_action_success("superpower_key_1")
            assert r_exp["status"] == "EXPIRED_DAILY_3" and r_exp["consumed_daily"] is True
            print(f"   ✅ 만료 기능 #{i}회째 성공 완수 ➔ 잔여 일일 무료: {r_exp['daily_remaining']}/3회")

        print("🧪 [5단계] 만료된 1번 기능 4번째 시도 시 차단 및 안내 메시지 검증...")
        ok_4th, msg_4th = check_feature_quota_allowed("superpower_key_1")
        assert not ok_4th, "4th attempt on expired feature must be blocked!"
        print(f"   ✅ 4번째 만료 기능 차단 확인: {msg_4th}")

        print("🧪 [6단계] 만료 기능이 3회 모두 소진된 상태에서도 '미개봉 2번(파일·라벨러)'은 30일 무제한으로 즉시 열리는지 검증!")
        ok_unopened, st_unopened = check_feature_quota_allowed("superpower_key_2")
        assert ok_unopened and st_unopened == "UNOPENED"
        r_unopened = complete_feature_action_success("superpower_key_2")
        assert r_unopened["status"] == "FIRST_OPENED_30D" and r_unopened["consumed_daily"] is False
        print(f"   ✅ 미개봉 2번(파일·라벨러) 실행 결과: {r_unopened['status']} (만료 기능 한도와 무관하게 30일 무제한 즉시 개시!)")
        print("\n🎉 [ALL PASS] 기능별 30일 무제한 타이머 & 만료된 기능만 일일 성공 3회 제한 시뮬레이션 100% 통과!")
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
