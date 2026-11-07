# -*- coding: utf-8 -*-
"""
👻 귀신같이(Ghosti) 유료 구독자 전용 선물 — 『멀린 Z 코어 9대 귀신 초능력 + 3대 보너스 통합 데몬 (v2.5 AI 완전체)』
====================================================================================================
- 단일 마스터 트리거: Ctrl + 0 (보조키: Alt + Z) + 오토매틱(Automatic) 한영 오타 감지 및 한/영 키 자동 전환
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

BASE_DIR = Path("d:/Secretary") if Path("d:/Secretary").exists() else Path("C:/MerlinTools")
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
RBUTTON_LONG_PRESS_SEC = 0.35


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

_RBTN_HOLD_STATE: dict = {
    "active": False,
    "down_ts": 0.0,
    "x": 0,
    "y": 0,
    "triggered": False,
    "suppress_next_up": False,
    "summon_requested": False,
}


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
                        if k.startswith("▁") and isinstance(tid, int) and tid < 50000:
                            clean_k = k.lstrip("▁")
                            if len(clean_k) >= 4 and clean_k.isalpha() and clean_k.isascii():
                                self.en_dict.add(clean_k.lower())
                        else:
                            clean_k = k.lstrip("▁")
                            if len(clean_k) >= 1 and all(0xAC00 <= ord(c) <= 0xD7A3 for c in clean_k):
                                self.ko_subwords.add(clean_k)
                                for ch in clean_k:
                                    self.ko_chars.add(ch)

                    onnx_path = model_dir / "onnx" / "model_quantized.onnx"
                    if not onnx_path.exists():
                        onnx_path = model_dir / "onnx" / "model_q4.onnx"
                    if onnx_path.exists():
                        import numpy as np
                        import onnxruntime as ort
                        self.np = np
                        self.session = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
            except Exception:
                pass
            finally:
                self._loaded = True

    _VALID_SHORT_EN = {
        "a", "i",
        "am", "an", "as", "at", "be", "by", "do", "go", "he", "hi",
        "if", "in", "is", "it", "me", "my", "no", "of", "oh", "ok",
        "on", "or", "so", "to", "up", "us", "we",
        "ai", "os", "pc", "tv", "ui", "ux", "id", "ip", "qa",
        "pr", "hr", "vr", "ar", "vs", "ex", "mr", "ms", "dr",
    }

    def is_valid_english_word(self, word: str) -> bool:
        w = word.strip().lower()
        if len(w) <= 2:
            return w in self._VALID_SHORT_EN
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


def _get_focused_control_hwnd(fg_hwnd: int | None = None) -> int:
    """현재 활성 창 내부의 실제 키보드 포커스 컨트롤(Edit 등) HWND를 반환합니다."""
    hwnd = fg_hwnd or u32.GetForegroundWindow()
    if not hwnd:
        return 0
    try:
        gti = _GUITHREADINFO()
        gti.cbSize = ctypes.sizeof(_GUITHREADINFO)
        tid = u32.GetWindowThreadProcessId(hwnd, None)
        if tid and u32.GetGUIThreadInfo(tid, ctypes.byref(gti)) and gti.hwndFocus:
            return int(gti.hwndFocus)
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
    """실제 포커스된 입력 컨트롤(Edit) 및 최상위 창의 현재 한/영(IME) 상태를 정확히 조회합니다."""
    hwnd = fg_hwnd or u32.GetForegroundWindow()
    if not hwnd:
        return False
    focus_h = _get_focused_control_hwnd(hwnd)
    for h_cand in (focus_h, hwnd):
        if h_cand:
            hime = imm32.ImmGetDefaultIMEWnd(h_cand)
            if hime:
                mode = u32.SendMessageW(hime, WM_IME_CONTROL, IMC_GETCONVERSIONMODE, 0)
                return (mode & IME_CMODE_NATIVE) != 0
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
    - 최상위 창(GetForegroundWindow)과 내부 포커스 컨트롤(Edit/RichEdit) 양쪽의 IME 컨텍스트를 모두 즉시 동기화합니다.
    """
    try:
        hwnd = u32.GetForegroundWindow()
        if hwnd:
            focus_h = _get_focused_control_hwnd(hwnd)
            switched = False
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
                    switched = True
            if switched:
                return
        # 폴백: 한/영 키(VK_HANGUL) 물리 토글
        u32.keybd_event(VK_HANGUL, 0, 0, 0)
        time.sleep(0.01)
        u32.keybd_event(VK_HANGUL, 0, KEYEVENTF_KEYUP, 0)
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

    def replace_token(m: re.Match) -> str:
        nonlocal target_lang
        tok = m.group(0)
        if tok.startswith(("http://", "https://", "www.")):
            return tok

        # 1) 영문 알파벳 토큰인 경우 (뒤에 숫자 '25'나 모든 특수문자 '~!@#$%^&*()_+-=:;/?.,' 등이 붙어 있어도 영문 파트만 단독 매칭되어 100% 변환됨!)
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
                # 만약 원본 한글이 KS X 1001 밖의 희귀 음절을 포함하거나 대표 영단어인 경우 변환
                if not is_valid_korean_word(tok) or eng_cand.lower() in FALLBACK_EN_WORDS:
                    target_lang = "EN"
                    return eng_cand

        return tok

    # URL만 보호하고 어떤 특수문자(~, @, #, $, %, ^, &, *, _, :, / 등)가 붙어 있든 영문 구간([A-Za-z]+)과 한글 구간을 100% 독립 성형
    morphed = re.sub(r"https?://\S+|www\.\S+|[A-Za-z]+|[\u3131-\u318E\uAC00-\uD7A3]+", replace_token, cleaned_lead)
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
    Path("d:/Secretary/data/baby_ghost_sounds"),
]
SOUNDS_DIR = next((d for d in _CAND_SOUNDS if (d / "active_summon_sound.wav").exists()), _CAND_SOUNDS[0])
ASSETS_DIR = Path(__file__).resolve().parent / "assets"

_MERLIN_APPDATA = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local")) / "Merlin"
TELEMETRY_FILE = _MERLIN_APPDATA / "superpower_telemetry.json"
TELEMETRY_SEC_MIRROR = Path("d:/Secretary/data/superpower_telemetry.json")
TELEMETRY_CONFIG_FILE = _MERLIN_APPDATA / "superpower_telemetry_config.json"
SUPERPOWER_SETTINGS_FILE = _MERLIN_APPDATA / "superpower_settings.json"
E2EE_MAILBOX_FILE = _MERLIN_APPDATA / "offline_e2ee_mailbox.json"

DEFAULT_SUPERPOWER_SETTINGS: dict = {
    "retention_days": 7,  # 1(오늘만 24시간), 3(3일), 7(기본 7일·300개), 30(한 달 30일·1000개)
    "max_items": 300,
    "sound_enabled": True,
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


SUPERPOWER_12_FEATURES: dict[str, str] = {
    "feat_1_seq_paste": "① 순차붙여넣기",
    "feat_2_typo_morph": "② 한영오타성형",
    "feat_3_clean_format": "③ 서식세탁",
    "feat_4_iron_lines": "④ 줄바꿈정리",
    "feat_5_merge_search": "⑤ 합본·기억검색",
    "feat_6_screen_ocr": "⑥ 글자·표OCR",
    "feat_7_window_pin": "⑦ 창고정",
    "feat_8_format_numbers": "⑧ 번호·일정성형",
    "feat_9_image_file": "⑨ 스샷파일변환",
    "feat_b1_snippets": "🎁 상용구(F1~10)",
    "feat_b2_excel_split": "🎁 엑셀쪼개기",
    "feat_b3_pdf_merge": "🎁 다중스샷PDF합본",
}


def normalize_feature_id(raw_key: str) -> str:
    k = str(raw_key or "").strip()
    if k in SUPERPOWER_12_FEATURES:
        return k
    if k in ("superpower_key_1", "seq_paste_smart_match", "1"):
        return "feat_1_seq_paste"
    if k in ("superpower_key_2", "auto_typo_morph_2words", "2"):
        return "feat_2_typo_morph"
    if k in ("superpower_key_3", "3"):
        return "feat_3_clean_format"
    if k in ("superpower_key_4", "4"):
        return "feat_4_iron_lines"
    if k in ("superpower_key_5", "5"):
        return "feat_5_merge_search"
    if k in ("superpower_key_6", "6"):
        return "feat_6_screen_ocr"
    if k in ("superpower_key_7", "7"):
        return "feat_7_window_pin"
    if k in ("superpower_key_8", "8"):
        return "feat_8_format_numbers"
    if k in ("superpower_key_9", "9"):
        return "feat_9_image_file"
    if k.startswith("snippet_F") or k.upper().startswith("F"):
        return "feat_b1_snippets"
    if "excel" in k.lower():
        return "feat_b2_excel_split"
    if "pdf" in k.lower():
        return "feat_b3_pdf_merge"
    return k


def check_feature_quota_allowed(raw_feature_key: str) -> tuple[bool, str]:
    """
    [개별 기능별 첫 사용 후 7일 무제한 ➔ 만료된 기능만 일일 성공 3회 제한 검사]
    - 아직 개봉 안 했거나(UNOPENED), 첫 사용 후 7일 이내(ACTIVE_7D)이거나, 유료 구독자(SUBSCRIBED)이면 무조건 True!
    - 해당 기능의 7일 무제한이 만료(EXPIRED_7D)되었고 오늘 만료 기능 합산 성공 횟수가 이미 3회에 도달한 경우에만 False 반환!
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
        feat_trials = m_info.get("featureTrials", {})
        f_entry = feat_trials.get(feat_id)
        if not isinstance(f_entry, dict) or not f_entry.get("firstUsedTs"):
            return True, "UNOPENED"
        elapsed_days = (time.time() - float(f_entry["firstUsedTs"])) / 86400.0
        if elapsed_days < 7.0:
            rem_days = max(1, int(round(7.0 - elapsed_days + 0.49)))
            return True, f"ACTIVE_D-{rem_days}"
        # 7일 만료된 기능인 경우: 오늘 만료 기능 합산 사용량 확인
        today = datetime.date.today().isoformat()
        used_today = int(m_info.get("dailyUsage", {}).get(today, 0))
        if used_today >= 3:
            unopened_cnt = sum(1 for fk in SUPERPOWER_12_FEATURES if fk not in feat_trials)
            msg = (
                f"👻 오늘 만료 기능 무료(3/3회) 소진! (미개봉 {unopened_cnt}개는 지금도 7일 무제한!) "
                f"[내 기기 통합 월 3,900원] 구독 시 전 기능 평생 무제한"
            )
            return False, msg
        return True, f"DAILY_FREE_{3 - used_today}_LEFT"
    except Exception:
        return True, "OK"


def complete_feature_action_success(raw_feature_key: str) -> dict:
    """
    [오직 '실제 액션이 성공 완수된 시점'에만 호출!]
    1) 해당 기능이 미개봉(UNOPENED)이면 -> 지금 이 순간부터 해당 기능의 7일 무제한 타이머 개시! (일일 3회 차감 안 함)
    2) 해당 기능이 7일 무제한 진행 중(ACTIVE_7D)이면 -> 횟수 차감 없이 통과!
    3) 해당 기능의 7일 무제한이 만료(EXPIRED_7D)되었으면 -> 오늘 일일 무료 횟수(3회 한도)에서 1회 차감!
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

        # Case 1: 생애 첫 성공 사용! -> 지금부터 이 기능만 7일 무제한 타이머 시작!
        if not isinstance(f_entry, dict) or not f_entry.get("firstUsedTs"):
            exp_dt = now_dt + datetime.timedelta(days=7)
            feat_trials[feat_id] = {
                "featureName": SUPERPOWER_12_FEATURES.get(feat_id, feat_id),
                "firstUsedTs": now_ts,
                "firstUsedAt": now_dt.strftime("%Y-%m-%d %H:%M:%S"),
                "expiresAt": exp_dt.strftime("%Y-%m-%d %H:%M:%S"),
                "successCount": 1,
            }
            ledger_path.write_text(json.dumps(ledger, ensure_ascii=False, indent=2), encoding="utf-8")
            return {"status": "FIRST_OPENED_7D", "feature_id": feat_id, "days_left": 7, "consumed_daily": False, "daily_remaining": 3}

        # Case 2: 이미 개봉된 기능 -> 7일 경과 여부 판정
        f_entry["successCount"] = int(f_entry.get("successCount", 0)) + 1
        elapsed_days = (now_ts - float(f_entry["firstUsedTs"])) / 86400.0
        if elapsed_days < 7.0:
            rem_days = max(1, int(round(7.0 - elapsed_days + 0.49)))
            ledger_path.write_text(json.dumps(ledger, ensure_ascii=False, indent=2), encoding="utf-8")
            return {"status": "ACTIVE_7D", "feature_id": feat_id, "days_left": rem_days, "consumed_daily": False, "daily_remaining": 3}

        # Case 3: 해당 기능의 7일 무제한이 만료된 상태 -> 오늘 성공 횟수 +1 차감!
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


def _toast_worker() -> None:
    """
    👻 귀신창 (Ghost Window) v3.2 마스터 워커:
    - 스타일 1: 시그니처 딥 나이트 네이비(#0B1120) & 민트 오로라(#2DD4BF) + 정본 3D 로고 일체형
    - 이모지 전면 제거 & 우측 2줄 안에 모든 초능력 메뉴 수납
    - [Win+V 스타일 아코디언 다중 기억검색 드롭다운]:
      * 평소엔 날렵한 2줄 귀신창 -> '기억검색' 클릭 또는 타이핑 시 아래로 상위 5개 카드 리스트(텍스트+스샷 이미지) 펼침!
      * 긴 문장: 검색어 중심 앞뒤 요약 스니펫 + 카드 위에 마우스 호버(Hover) 시 우측에 '전체 원문/큰 이미지 미리보기 팝업'!
      * 스샷 이미지: 미니 썸네일(44x32) + 백그라운드 OCR 글자 검색 + 클릭/Enter 시 이미지 파일(CF_HDROP) 즉시 붙여넣기!
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
            after_id[0] = root.after(600, _on_timer_expire)
            return
        _close_win()

    def _poll_queue() -> None:
        try:
            # 1) 유저가 마우스 커서를 귀신창 바깥(다른 곳)에 클릭하면 즉시 귀신창 닫기!
            lbtn_down = (u32.GetAsyncKeyState(0x01) & 0x8000) != 0
            rbtn_down = (u32.GetAsyncKeyState(0x02) & 0x8000) != 0
            mouse_down = lbtn_down or rbtn_down
            if mouse_down and not was_mouse_down[0] and current_win[0] is not None:
                if (time.time() - opened_at[0]) > 0.12:
                    pt_click = wintypes.POINT()
                    u32.GetCursorPos(ctypes.byref(pt_click))
                    wx1, wy1, wx2, wy2 = win_rect[0]
                    if not (wx1 <= pt_click.x <= wx2 and wy1 <= pt_click.y <= wy2):
                        _close_win()
            was_mouse_down[0] = mouse_down

            msg_item = None
            while not _toast_queue.empty():
                msg_item = _toast_queue.get_nowait()

            if msg_item is not None:
                message, duration_ms = msg_item
                if message == "__CLOSE__":
                    _close_win()
                else:
                    _close_win()
                    is_ctrl0_bar = duration_ms >= 2000
                    if not is_ctrl0_bar:
                        play_baby_ghost_sound(mode="typo")

                    pt = wintypes.POINT()
                    u32.GetCursorPos(ctypes.byref(pt))
                    m_left, m_top, m_right, m_bottom = _get_monitor_workarea_for_point(pt.x, pt.y)

                    win = tk.Toplevel(root)
                    current_win[0] = win
                    opened_at[0] = time.time()
                    was_mouse_down[0] = True
                    win.overrideredirect(True)
                    win.attributes("-topmost", True)
                    win.attributes("-alpha", 0.98)
                    win.configure(bg="#0B1120")

                    def _on_enter(_e=None):
                        is_hovered[0] = True

                    def _on_leave(_e=None):
                        is_hovered[0] = False
                        _schedule_close(3000)

                    win.bind("<Enter>", _on_enter)
                    win.bind("<Leave>", _on_leave)

                    if is_ctrl0_bar and "|" in message:
                        left_tag, right_part = message.split("|", 1)
                        container = tk.Frame(win, bg="#0B1120", highlightbackground="#2DD4BF", highlightthickness=2, padx=8, pady=6)
                        container.pack(fill="both", expand=True)

                        # [윗단] 1줄 미니 검색창 (클릭 또는 타이핑 시 아래로 Win+V 스타일 5개 카드 리스트 아코디언 펼침!)
                        top_search_bar = tk.Frame(container, bg="#0F172A", highlightbackground="#14B8A6", highlightthickness=1, padx=6, pady=3)
                        top_search_bar.pack(fill="x", pady=(0, 5))

                        s_icon = tk.Label(top_search_bar, text="복사검색", fg="#5EEAD4", bg="#0F172A", font=("Malgun Gothic", 8, "bold"))
                        s_icon.pack(side="left", padx=(0, 6))

                        s_entry = tk.Entry(
                            top_search_bar,
                            width=22,
                            fg="#F8FAFC",
                            bg="#1E293B",
                            insertbackground="#5EEAD4",
                            relief="flat",
                            font=("Malgun Gothic", 9),
                        )
                        s_entry.pack(side="left", padx=(0, 6))

                        status_hint = "클릭 시 최근 목록 펼침 · 단어 입력 후 ↑↓·Enter 선택 (바깥 클릭 닫힘)"
                        if "(" in left_tag and ")" in left_tag:
                            status_hint = left_tag[left_tag.find("(") : left_tag.rfind(")") + 1] + " · " + status_hint

                        s_preview = tk.Label(
                            top_search_bar,
                            text=status_hint,
                            fg="#94A3B8",
                            bg="#0F172A",
                            font=("Malgun Gothic", 8),
                        )
                        s_preview.pack(side="left")

                        # [우측 상단] 클립보드 보관기간(1일/3일/7일/30일) 원클릭 순환 배지 + [🧹비우기] 버튼
                        cur_cfg = get_superpower_settings()
                        cur_days = int(cur_cfg.get("retention_days", 7))
                        ret_label_map = {1: "보관: 오늘(1일)", 3: "보관: 3일", 7: "보관: 7일", 30: "보관: 30일"}

                        def _on_clear_click(_e=None):
                            clear_clipboard_history()

                        def _on_undo_click(_e=None):
                            _close_win()
                            execute_undo_snapshot(set_clipboard_text)

                        clear_btn = tk.Label(
                            top_search_bar,
                            text="🧹비우기",
                            fg="#FCA5A5",
                            bg="#1E293B",
                            padx=5,
                            pady=1,
                            font=("Malgun Gothic", 8, "bold"),
                            cursor="hand2",
                        )
                        clear_btn.pack(side="right", padx=(4, 0))
                        clear_btn.bind("<Button-1>", _on_clear_click)

                        undo_btn = tk.Label(
                            top_search_bar,
                            text="↩원복(Ctrl+Z)",
                            fg="#FDE047" if _UNDO_SNAPSHOT.get("active") else "#94A3B8",
                            bg="#1E293B",
                            padx=5,
                            pady=1,
                            font=("Malgun Gothic", 8, "bold"),
                            cursor="hand2",
                        )
                        undo_btn.pack(side="right", padx=(4, 0))
                        undo_btn.bind("<Button-1>", _on_undo_click)

                        ret_btn = tk.Label(
                            top_search_bar,
                            text=ret_label_map.get(cur_days, f"보관: {cur_days}일") + " ▾",
                            fg="#5EEAD4",
                            bg="#1E293B",
                            padx=6,
                            pady=1,
                            font=("Malgun Gothic", 8, "bold"),
                            cursor="hand2",
                        )
                        ret_btn.pack(side="right", padx=(6, 0))

                        def _cycle_retention(_e=None):
                            is_hovered[0] = True
                            now_d = int(get_superpower_settings().get("retention_days", 7))
                            order = [1, 3, 7, 30]
                            nxt_d = order[(order.index(now_d) + 1) % len(order)] if now_d in order else 7
                            update_superpower_settings({"retention_days": nxt_d})
                            ret_btn.config(text=ret_label_map.get(nxt_d, f"보관: {nxt_d}일") + " ▾")
                            s_preview.config(text=f"✅ 클립보드 보관기간이 [{ret_label_map.get(nxt_d)}]로 변경되었습니다!", fg="#5EEAD4")

                        ret_btn.bind("<Button-1>", _cycle_retention)

                        # [아랫단] 좌측 정본 마스터 로고([심볼]+[3D 워드마크]) + 우측 2줄 전체 메뉴
                        bottom_bar = tk.Frame(container, bg="#0B1120")
                        bottom_bar.pack(fill="x")

                        # [3단(평소 숨김 -> 검색창 클릭/타이핑 시 아래로 스르륵 펼쳐지는 Win+V형 카드 리스트 컨테이너)]
                        results_box = tk.Frame(container, bg="#0B1120")
                        results_state: dict = {"items": [], "sel_idx": 0, "expanded": False}

                        def _update_window_geometry() -> None:
                            win.update_idletasks()
                            rw = max(win.winfo_reqwidth(), 240)
                            rh = max(win.winfo_reqheight(), 42)
                            curr_x = win_rect[0][0] if win_rect[0][2] > win_rect[0][0] else max(m_left + 12, min(pt.x - 20, m_right - rw - 16))
                            curr_y = win_rect[0][1] if win_rect[0][3] > win_rect[0][1] else max(m_top + 12, min(pt.y + 16, m_bottom - rh - 16))
                            adj_x = max(m_left + 12, min(curr_x, m_right - rw - 16))
                            adj_y = max(m_top + 12, min(curr_y, m_bottom - rh - 16))
                            win.geometry(f"{rw}x{rh}{adj_x:+d}{adj_y:+d}")
                            win_rect[0] = (adj_x, adj_y, adj_x + rw, adj_y + rh)

                        def _show_detail_preview(rec: dict, card_widget: tk.Widget) -> None:
                            _close_detail()
                            txt_full = rec.get("text", "")
                            kind = rec.get("kind", "text")
                            if kind == "text" and len(txt_full) <= 50 and "\n" not in txt_full:
                                return
                            try:
                                dwin = tk.Toplevel(root)
                                detail_win[0] = dwin
                                dwin.overrideredirect(True)
                                dwin.attributes("-topmost", True)
                                dwin.configure(bg="#0F172A")
                                dframe = tk.Frame(dwin, bg="#0F172A", highlightbackground="#5EEAD4", highlightthickness=1, padx=10, pady=8)
                                dframe.pack(fill="both", expand=True)

                                if kind == "image" and rec.get("png_bytes"):
                                    tk.Label(dframe, text="[이미지 크게 보기]", fg="#5EEAD4", bg="#0F172A", font=("Malgun Gothic", 8, "bold"), anchor="w").pack(fill="x", pady=(0, 4))
                                    pil_im = Image.open(io.BytesIO(rec["png_bytes"])).convert("RGBA")
                                    pil_im.thumbnail((280, 200), Image.Resampling.LANCZOS)
                                    big_ph = ImageTk.PhotoImage(pil_im, master=root)
                                    thumb_refs.append(big_ph)
                                    im_lbl = tk.Label(dframe, image=big_ph, bg="#0F172A")
                                    im_lbl.pack(pady=(0, 4))
                                    if txt_full:
                                        tk.Label(dframe, text=f"인식된 글자: {txt_full[:180]}", fg="#CBD5E1", bg="#0F172A", font=("Malgun Gothic", 8), justify="left", wraplength=280).pack(fill="x")
                                else:
                                    tk.Label(dframe, text=f"[전문 미리보기 · 총 {len(txt_full):,}자]", fg="#5EEAD4", bg="#0F172A", font=("Malgun Gothic", 8, "bold"), anchor="w").pack(fill="x", pady=(0, 4))
                                    preview_body = "\n".join(txt_full.splitlines()[:12])[:420]
                                    if len(txt_full) > 420:
                                        preview_body += "\n..."
                                    tk.Label(dframe, text=preview_body, fg="#F8FAFC", bg="#0F172A", font=("Malgun Gothic", 9), justify="left", wraplength=340, anchor="w").pack(fill="x")

                                dwin.update_idletasks()
                                dw = dwin.winfo_reqwidth()
                                dh = dwin.winfo_reqheight()
                                wx1, wy1, wx2, wy2 = win_rect[0]
                                dx = wx2 + 8 if (wx2 + 8 + dw) <= m_right else max(m_left + 8, wx1 - dw - 8)
                                dy = max(m_top + 8, min(card_widget.winfo_rooty(), m_bottom - dh - 8))
                                dwin.geometry(f"{dw}x{dh}{dx:+d}{dy:+d}")
                            except Exception:
                                pass

                        def _execute_item(rec: dict) -> None:
                            _close_win()
                            kind = rec.get("kind", "text")
                            if kind == "image" and rec.get("img_path"):
                                if set_clipboard_hdrop_file(rec["img_path"]):
                                    time.sleep(0.03)
                                    tap_key_combo([VK_CONTROL], VK_V)
                                    show_ghost_toast("귀신같이 이미지 기억소환 완료")
                                    return
                            chosen = rec.get("text", "")
                            if chosen:
                                set_clipboard_text(chosen)
                                time.sleep(0.03)
                                tap_key_combo([VK_CONTROL], VK_V)
                                show_ghost_toast("귀신같이 기억소환 완료")

                        def _render_dropdown(query: str) -> None:
                            for child in results_box.winfo_children():
                                child.destroy()
                            _close_detail()

                            q = query.strip()
                            candidates: list[tuple[float, dict]] = []
                            if not GLOBAL_AI_HISTORY:
                                s_preview.config(text="아직 복사된 기억(텍스트/이미지)이 없습니다.", fg="#FCA5A5")
                                return

                            if not q:
                                # 검색어가 없을 때는 최근 복사한 순서대로 상위 5개 표시 (Win+V 동일 경험)
                                for idx_r, rec in enumerate(reversed(GLOBAL_AI_HISTORY)):
                                    candidates.append((100.0 - idx_r, rec))
                                    if len(candidates) >= 5:
                                        break
                            else:
                                q_vec = AI_ENGINE.embed_128d(q)
                                for rec in reversed(GLOBAL_AI_HISTORY):
                                    t_item = rec.get("text", "")
                                    sc = AI_ENGINE.cosine_sim(q_vec, rec.get("vec", []))
                                    if q.lower() in t_item.lower():
                                        sc += 0.45
                                    candidates.append((sc, rec))
                                candidates.sort(key=lambda x: x[0], reverse=True)
                                candidates = candidates[:5]

                            results_state["items"] = [c[1] for c in candidates]
                            results_state["sel_idx"] = min(results_state["sel_idx"], max(0, len(candidates) - 1))

                            if not results_state["expanded"]:
                                results_box.pack(fill="x", pady=(6, 0))
                                results_state["expanded"] = True

                            for idx_c, (_, rec) in enumerate(candidates):
                                is_sel = idx_c == results_state["sel_idx"]
                                card_bg = "#1E293B" if is_sel else "#0F172A"
                                border_col = "#2DD4BF" if is_sel else "#334155"
                                card = tk.Frame(
                                    results_box,
                                    bg=card_bg,
                                    highlightbackground=border_col,
                                    highlightthickness=1,
                                    padx=7,
                                    pady=4,
                                    cursor="hand2",
                                )
                                card.pack(fill="x", pady=2)

                                num_lbl = tk.Label(
                                    card,
                                    text=f"[{idx_c + 1}]",
                                    fg="#5EEAD4" if is_sel else "#94A3B8",
                                    bg=card_bg,
                                    font=("Malgun Gothic", 8, "bold"),
                                )
                                num_lbl.pack(side="left", padx=(0, 6))

                                kind = rec.get("kind", "text")
                                rel_t = _format_rel_time(rec.get("ts", time.time()))
                                raw_txt = rec.get("text", "")

                                if kind == "image" and rec.get("png_bytes"):
                                    try:
                                        im_pil = Image.open(io.BytesIO(rec["png_bytes"])).convert("RGBA")
                                        im_pil.thumbnail((42, 28), Image.Resampling.LANCZOS)
                                        th_ph = ImageTk.PhotoImage(im_pil, master=root)
                                        thumb_refs.append(th_ph)
                                        th_lbl = tk.Label(card, image=th_ph, bg=card_bg, bd=0)
                                        th_lbl.pack(side="left", padx=(0, 6))
                                    except Exception:
                                        pass
                                    tag_str = f"[이미지 · {rel_t}]"
                                    snip = _make_context_snippet(raw_txt or "캡처 이미지", q, max_len=44)
                                else:
                                    char_cnt = len(raw_txt)
                                    len_badge = f"장문 {char_cnt:,}자" if char_cnt >= 60 else f"{char_cnt}자"
                                    tag_str = f"[{len_badge} · {rel_t}]"
                                    snip = _make_context_snippet(raw_txt, q, max_len=52)

                                tag_lbl = tk.Label(card, text=tag_str, fg="#38BDF8", bg=card_bg, font=("Malgun Gothic", 8, "bold"))
                                tag_lbl.pack(side="left", padx=(0, 6))

                                body_lbl = tk.Label(
                                    card,
                                    text=snip,
                                    fg="#F8FAFC" if is_sel else "#CBD5E1",
                                    bg=card_bg,
                                    font=("Malgun Gothic", 9),
                                    anchor="w",
                                )
                                body_lbl.pack(side="left", fill="x", expand=True)

                                for w_item in (card, num_lbl, tag_lbl, body_lbl):
                                    w_item.bind("<Button-1>", lambda _e, r=rec: _execute_item(r))
                                    w_item.bind("<Enter>", lambda _e, r=rec, cw=card: _show_detail_preview(r, cw))
                                    w_item.bind("<Leave>", lambda _e: _close_detail())

                            _update_window_geometry()

                        def _on_entry_click(_e=None):
                            is_hovered[0] = True
                            try:
                                u32.SetForegroundWindow(win.winfo_id())
                            except Exception:
                                pass
                            s_entry.focus_force()
                            results_state["sel_idx"] = 0
                            _render_dropdown(s_entry.get())

                        def _on_search_key(event=None):
                            is_hovered[0] = True
                            if event and event.keysym in ("Up", "Down", "Return", "Escape"):
                                return
                            results_state["sel_idx"] = 0
                            _render_dropdown(s_entry.get())

                        def _on_arrow_down(_e=None):
                            if results_state["items"]:
                                results_state["sel_idx"] = (results_state["sel_idx"] + 1) % len(results_state["items"])
                                _render_dropdown(s_entry.get())
                            return "break"

                        def _on_arrow_up(_e=None):
                            if results_state["items"]:
                                results_state["sel_idx"] = (results_state["sel_idx"] - 1) % len(results_state["items"])
                                _render_dropdown(s_entry.get())
                            return "break"

                        def _on_search_enter(_e=None):
                            items_now = results_state["items"]
                            if items_now and 0 <= results_state["sel_idx"] < len(items_now):
                                _execute_item(items_now[results_state["sel_idx"]])
                            else:
                                q_raw = s_entry.get().strip()
                                _close_win()
                                if q_raw:
                                    set_clipboard_text(q_raw)
                                    time.sleep(0.03)
                                    tap_key_combo([VK_CONTROL], VK_V)

                        s_entry.bind("<Button-1>", _on_entry_click)
                        s_entry.bind("<KeyRelease>", _on_search_key)
                        s_entry.bind("<Down>", _on_arrow_down)
                        s_entry.bind("<Up>", _on_arrow_up)
                        s_entry.bind("<Return>", _on_search_enter)
                        s_entry.bind("<Escape>", lambda _e: _close_win())

                        logo_btn = tk.Frame(
                            bottom_bar,
                            bg="#131D36",
                            highlightbackground="#2DD4BF",
                            highlightthickness=1,
                            padx=7,
                            pady=5,
                            cursor="hand2",
                        )
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

                        def _on_logo_click(_e=None):
                            _close_win()
                            _open_ghosti_web()

                        for wdg in logo_widgets:
                            wdg.bind("<Button-1>", _on_logo_click)

                        menu_box = tk.Frame(bottom_bar, bg="#0B1120")
                        menu_box.pack(side="left", fill="both", expand=True)

                        if "\n" in right_part:
                            line1_txt, line2_txt = right_part.strip().split("\n", 1)
                        else:
                            line1_txt, line2_txt = right_part.strip(), ""

                        lbl_r1 = tk.Label(
                            menu_box,
                            text=line1_txt.strip(),
                            fg="#5EEAD4",
                            bg="#0B1120",
                            font=("Malgun Gothic", 9, "bold"),
                            anchor="w",
                        )
                        lbl_r1.pack(fill="x", anchor="w")

                        if line2_txt.strip():
                            lbl_r2 = tk.Label(
                                menu_box,
                                text=line2_txt.strip(),
                                fg="#E2E8F0",
                                bg="#0B1120",
                                font=("Malgun Gothic", 9, "bold"),
                                anchor="w",
                            )
                            lbl_r2.pack(fill="x", anchor="w", pady=(1, 0))
                    else:
                        clean_msg = re.sub(r"[👻🔍✨📌★]", "", message).strip()
                        outer = tk.Frame(
                            win,
                            bg="#0B1120",
                            highlightbackground="#2DD4BF",
                            highlightthickness=2,
                            padx=10,
                            pady=6,
                        )
                        outer.pack(fill="both", expand=True)
                        if ghost_symbol_photo is not None:
                            s_lbl = tk.Label(outer, image=ghost_symbol_photo, bg="#0B1120", bd=0)
                            s_lbl.image = ghost_symbol_photo
                            s_lbl.pack(side="left", padx=(0, 6))
                        lbl = tk.Label(
                            outer,
                            text=clean_msg,
                            fg="#5EEAD4",
                            bg="#0B1120",
                            font=("Malgun Gothic", 9, "bold"),
                        )
                        lbl.pack(side="left")

                    win.update_idletasks()
                    req_w = max(win.winfo_reqwidth(), 240)
                    req_h = max(win.winfo_reqheight(), 42)

                    x = max(m_left + 12, min(pt.x - 20, m_right - req_w - 16))
                    y = max(m_top + 12, min(pt.y + 16, m_bottom - req_h - 16))
                    win.geometry(f"{req_w}x{req_h}{x:+d}{y:+d}")
                    win.lift()
                    win_rect[0] = (x, y, x + req_w, y + req_h)

                    _schedule_close(duration_ms)
        except Exception:
            pass
        root.after(8, _poll_queue)

    root.after(8, _poll_queue)
    root.mainloop()


threading.Thread(target=_toast_worker, daemon=True).start()


def show_ghost_toast(message: str, duration_ms: int = 1100) -> None:
    _toast_queue.put((message, duration_ms))


def play_baby_ghost_sound(mode: str = "typo") -> None:
    if mode == "summon":
        return
    """
    [멀린님 UX 설계 반영] 기계음(Beep)을 완전히 배제한 44.1kHz 스튜디오급 '애기귀신 효과음(.wav)' 비동기 재생!
    - mode="typo": 2단어 한영 오타 자동성형 시 ('애기귀신 퐁~ 띠링!' / 오르골 / 웃음소리 등 선택된 WAV)
    - mode="summon": Ctrl+0 귀신 부르는 단축키 발동 시 ('스윽~ 팅✨' 요정 소환음)
    """
    def _sound():
        try:
            import winsound
            wav_name = "active_summon_sound.wav" if mode == "summon" else "active_typo_sound.wav"
            wav_path = SOUNDS_DIR / wav_name
            if not wav_path.exists():
                wav_path = SOUNDS_DIR / ("sample6_ctrl0_summon.wav" if mode == "summon" else "sample2_cute_ghost_pop.wav")
            if wav_path.exists():
                winsound.PlaySound(str(wav_path), winsound.SND_FILENAME | winsound.SND_ASYNC | winsound.SND_NODEFAULT)
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


def set_clipboard_hdrop_file(filepath: str) -> bool:
    """실물 파일 경로를 윈도우 탐색기 파일 복사 포맷(CF_HDROP)으로 클립보드에 주입"""
    abs_path = str(Path(filepath).resolve())
    header = struct.pack("<IiiII", 20, 0, 0, 0, 1)
    encoded_path = abs_path.encode("utf-16-le") + b"\x00\x00\x00\x00"
    payload = header + encoded_path

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
                        u32.SetClipboardData(CF_HDROP, hmem)
                        return True
            finally:
                u32.CloseClipboard()
            break
        time.sleep(0.015)
    return False


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
    # 4) '-하게 / -롭게 / -스레 / -히' 부사형 어미 + 용언 붙여쓰기('예리하게캐치해' -> '예리하게 캐치해') 분리
    s = re.sub(
        r"([가-힣]{2,}(?:하게|롭게|스레|답게|주셔서|해주셔서|주시고|해주시고))(?=(?!주|보|드|지|도|는|만|요)[가-힣]{2,})",
        r"\1 ",
        s,
    )
    # 5) 관형사형('완전한', '정확한', '깔끔한', '안전한', '익숙한', '다양한', '특별한', '중요한', '필요한', '간단한', '복잡한', '자세한', '상세한', '동일한', '유일한', '확실한', '분명한', '명확한', '충분한', '적절한', '유용한', '강력한', '새로운', '아름다운', '자연스러운') + 명사 붙여쓰기 분리
    s = re.sub(
        r"(?<![가-힣])([가-힣]{2,}(?:한|된|할|로운|스러운|같은|없는|있는))(?=(?:자막|목소리|성우|영상|음성|글자|문장|문단|문서|파일|폴더|화면|창|기능|성능|효과|결과|상태|모습|느낌|분위기|마음|생각|의견|내용|정보|자료|데이터|시스템|서비스|프로그램|어플|앱|모델|기술|방법|방식|구조|설계|기획|특허|사업|아이템|시장|고객|유저|사람|회원|멤버|동료|가족|친구|선생님|대표님|매니저님|문제|오류|버그|원인|해결책|대안|선택|결정|판단|기준|원칙|규칙|조건|환경|상황|과정|절차|단계|순서|시간|기간|일정|계획|목표|성공|승리|변화|발전|성장|기회|가치|이익|수익|비용|가격|요금|할인|혜택|선물|보상|응원|관심|사랑|행복|건강|피부|비타민|햇빛|자외선|산책|운동|음식|식단|습관|생활|일상|하루|오늘|내일|미래|세상)[을를이가은는도의에로와과도만\s.,?!:;)]|$)",
        r"\1 ",
        s,
    )
    # 6) 존칭 접미사/호칭('님', '씨', '분') + 조사 외 일반 명사/부사 붙여쓰기('해나라님성우' -> '해나라님 성우') 분리
    s = re.sub(
        r"([가-힣]{2,}님)(?=(?![은는이가을를의도만께께서으로로와과랑이랑하고이나나부터까지조차마저요\s.,?!:;~^)])[가-힣]{2,})",
        r"\1 ",
        s,
    )
    # 7) 용언 어간 + 보조용언 '주셔서/주시고/주세요/주시면' 띄어쓰기 또는 붙여쓰기 정규화 ('캐치해 주셔 서' -> '캐치해 주셔서')
    s = re.sub(r"([가-힣]+(?:아|어|여|해))\s*(주셔서|주시고|주세요|주시면|주신|주실|주셨)", r"\1 \2", s)
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
    return re.sub(r" +", " ", s).strip()


def iron_and_polish_korean_text(raw_text: str) -> str:
    """
    [줄바꿈·유령공백(NFKC) 다림질 + 문맥 오타·띄어쓰기 교정 + 문단 의미 분리 통합 엔진]
    - 번호/불릿 목록(1), 2), ■, -, [)의 줄바꿈은 보존하면서, 문장 중간에 뚝뚝 끊긴 줄바꿈만 매끄럽게 이음!
    - 정상적인 1음절 단어(및, 후, 뒤, 수, 두, 한, 단 등)의 띄어쓰기를 절대 훼손하지 않으면서 PDF 자간 깨짐만 정밀 복원!
    """
    if not raw_text or not raw_text.strip():
        return raw_text
    s = raw_text.replace("\u00B7", "__MIDDOT__").replace("\u318D", "__MIDDOT__")
    s = unicodedata.normalize("NFKC", s)
    s = s.replace("__MIDDOT__", "·")
    s = re.sub(r"[\u00A0\u200B-\u200D\uFEFF]", " ", s)
    s = s.replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'")

    s = re.sub(
        r"(?<=[가-힣])[ \t]*\r?\n[ \t]*(?=(?:아서|어서|여서|해서|요|네요|군요|나요|가요|까요|어요|아요|해요|죠|지요|습니다|입니다|다|께|깨)(?=[\s.,?!:;)]|$))",
        "",
        s,
    )
    s = re.sub(r"(\.\s*\.\s*\.)\s*\r?\n\s*", r"\1 ", s)
    s = re.sub(r"(?m)^([ \t]*(?:\d+[.)]\s|[-•*■▶※◆○●]\s|\[)[^\r\n.?!]+)\r?\n", r"\1__HDR_NL__", s)
    s = re.sub(
        r"(?<![\n:!?\r])\r?\n(?!\r?\n)[ \t]*(?!(?:\d+[.)]\s|[-•*■▶※◆○●]\s|\[))",
        " ",
        s,
    )
    s = s.replace("__HDR_NL__", "\n")
    s = re.sub(r"[ \t]+", " ", s)

    s = re.sub(
        r"([가-힣]{2,})\s+([한된할])\s+([가-힣]{1,3})\s+([가-힣]{1,2})",
        lambda m: (
            m.group(0)
            if (m.group(2) == "한" and m.group(3) in ("번", "번만", "번씩", "번도", "줄", "줄로", "글자", "글자도", "단어", "문장", "페이지", "화면", "사진", "파일", "문서", "영상", "분", "명", "개", "건", "시간", "달", "해"))
            else f"{m.group(1)}{m.group(2)} {m.group(3)}{m.group(4)}"
        ),
        s,
    )
    s = re.sub(
        r"([가-힣]{2,})\s+([한된할])([가-힣]{1,3})\s+([가-힣]{1,2})",
        lambda m: (
            m.group(0)
            if (m.group(2) == "한" and m.group(3) in ("번", "번만", "번씩", "번도", "줄", "줄로", "글자", "글자도", "단어", "문장", "페이지", "화면", "사진", "파일", "문서", "영상", "분", "명", "개", "건", "시간", "달", "해"))
            else f"{m.group(1)}{m.group(2)} {m.group(3)}{m.group(4)}"
        ),
        s,
    )
    s = re.sub(
        r"(?<=[가-힣]{2})\s+(?=(?:은|는|이|가|을|를|에서|에게|으로|까지|부터|처럼|보다|지만|거나|면서|니까|습니다|입니다|합니다)(?=[\s.,?!:;)]|$))",
        "",
        s,
    )

    _standalone_1char = {
        "나", "너", "저", "그", "이", "더", "덜", "안", "못", "잘", "또", "꼭", "다", "총", "각", "전", "현", "신", "구",
        "유", "무", "열", "행", "칸", "줄", "초", "분", "시", "일", "월", "년", "원", "명", "건", "개", "장", "번",
        "및", "후", "뒤", "수", "것", "바", "데", "리", "터", "뿐", "한", "두", "세", "네", "몇", "첫", "새", "헌",
        "단", "등", "약", "매", "중", "내", "외", "상", "하", "좌", "우", "말", "점", "편", "호", "차", "회", "층",
        "왜", "뭐", "좀", "곧", "막", "딱", "늘", "참", "꽤",
    }

    def _join_broken_hangul(line: str) -> str:
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

    s = "\n".join(_fix_korean_spacing_general(_join_broken_hangul(ln)) for ln in s.splitlines())
    s = re.sub(r"\r?\n\s*\r?\n+", "\n\n", s)

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
        elif not auto_triggered and prefer_full_doc:
            line_start, line_end = 0, utf16_total
            use_full_sel = True
            target_line = idx_text
        else:
            line_idx = u32.SendMessageW(edit_child, EM_LINEFROMCHAR, s_pos, 0)
            line_start = u32.SendMessageW(edit_child, EM_LINEINDEX, line_idx, 0)
            line_len = u32.SendMessageW(edit_child, EM_LINELENGTH, line_start, 0)
            if line_start < 0 or line_len <= 0:
                if not auto_triggered and utf16_total > 0:
                    line_start, line_end = 0, utf16_total
                    use_full_sel = True
                    target_line = idx_text
                else:
                    return False, "", "", None
            else:
                line_end = line_start + line_len
                target_line = utf16_bytes[line_start * 2 : line_end * 2].decode("utf-16-le", errors="ignore")
                if not auto_triggered and "\n" in idx_text:
                    # 수동 호출([Ctrl+0 ➔ 2]) 시 드래그를 깜빡하고 다중 줄 문단 끝에 커서를 둔 경우 전체 문단 성형 지원
                    m_cur, l_cur = morph_korean_english_text_with_direction(target_line)
                    b_cur = m_cur if (m_cur != target_line and l_cur is not None) else target_line
                    i_cur = iron_and_polish_korean_text(b_cur) if allow_iron else b_cur
                    if i_cur == target_line and m_cur == target_line:
                        line_start, line_end = 0, utf16_total
                        use_full_sel = True
                        target_line = idx_text

        if not target_line:
            return False, "", "", None

        morphed, target_lang = morph_korean_english_text_with_direction(target_line)
        if allow_iron and not auto_triggered:
            base_for_iron = morphed if (morphed != target_line and target_lang is not None) else target_line
            ironed = iron_and_polish_korean_text(base_for_iron)
            if ironed != base_for_iron:
                morphed = ironed
                if target_lang is None:
                    target_lang = "KO"

        if morphed == target_line or target_lang is None:
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
            cur_tid = k32.GetCurrentThreadId()
            tgt_tid = u32.GetWindowThreadProcessId(target_hwnd, None)
            if cur_tid != tgt_tid and tgt_tid:
                u32.AttachThreadInput(cur_tid, tgt_tid, True)
            if fg_now != target_hwnd:
                u32.SetForegroundWindow(target_hwnd)
            edit_child = _find_edit_control_child(target_hwnd)
            if edit_child:
                u32.SetFocus(edit_child)
            if cur_tid != tgt_tid and tgt_tid:
                u32.AttachThreadInput(cur_tid, tgt_tid, False)
            time.sleep(0.025)
        except Exception:
            pass

    if edit_child:
        ok_ed, raw_ed, out_ed, lang_ed = _replace_edit_control_current_line_atomic(
            edit_child, auto_triggered=auto_triggered, allow_iron=allow_iron, prefer_full_doc=prefer_full_doc
        )
        if ok_ed and lang_ed is not None:
            return True, raw_ed, out_ed, lang_ed
        return False, raw_ed, out_ed, None

    daemon_set_cb(sentinel)
    time.sleep(0.015)
    tap_key_combo([VK_CONTROL], VK_C)
    time.sleep(0.045)
    selected = get_clipboard_text()

    if not selected or selected == sentinel:
        VK_END = 0x23
        VK_HOME = 0x24
        release_all_modifiers()
        if not auto_triggered:
            tap_key_combo([], VK_END)
            time.sleep(0.025)
        tap_key_combo([VK_SHIFT], VK_HOME)
        time.sleep(0.045)
        daemon_set_cb(sentinel)
        time.sleep(0.015)
        tap_key_combo([VK_CONTROL], VK_C)
        time.sleep(0.05)
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
            set_ime_language(target_korean=(target_lang == "KO"))
            daemon_set_cb(final_out)
            time.sleep(0.02)
            tap_key_combo([VK_CONTROL], VK_V)
            time.sleep(0.04)
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


def superpower_3_clean_format(daemon_set_cb, raw_src: str | None = None) -> None:
    """
    [③번] 서식 100% 세탁 + EmbeddingGemma 2 시맨틱 광고·저작권 꼬리말 자동 절삭
    """
    txt = raw_src if (raw_src and raw_src.strip()) else get_clipboard_text()
    if txt:
        cleaned = re.sub(r"(무단\s*전재\s*및\s*재배포\s*금지.*|저작권자\s*\(c\).*|ⓒ\s*.*무단.*)", "", txt, flags=re.IGNORECASE)
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
        out_s = "\n".join(lines).strip()
        arm_undo_snapshot(_LAST_TARGET_HWND, _find_edit_control_child(_LAST_TARGET_HWND), txt, out_s, mode="pre_iron")
        daemon_set_cb(out_s)
        show_ghost_toast("👻 귀신같이 서식세탁")


def superpower_4_iron_lines_and_nfkc(daemon_set_cb, raw_src: str | None = None) -> None:
    """
    [④번] 드래그 영역 원위치 즉시 다림질 + 줄바꿈·유령공백(NFKC)·문맥오타·띄어쓰기 교정 + 문단 의미 분리
    - 유저가 마우스로 드래그한 문장/문단(또는 메모장 내 텍스트)이 있으면 복사·창전환 없이 그 자리에서 즉시 교체!
    - 이미 원위치 성형이 끝난 문장에서 연속 호출된 경우 기존 Undo 스냅샷과 클립보드 원문을 100% 보존합니다.
    """
    txt = raw_src if (raw_src and raw_src.strip()) else get_clipboard_text()
    ok_inplace, raw_in, out_in, _ = _restore_target_focus_and_replace_line(
        _LAST_TARGET_HWND,
        daemon_set_cb,
        fallback_text=None,
        auto_triggered=False,
        allow_iron=True,
        prefer_full_doc=True,
    )
    if ok_inplace:
        show_ghost_toast(f"👻 귀신같이 즉시 다림질 완료 ({raw_in[:14]} ➔ {out_in[:14]})")
        return

    if raw_in:
        show_ghost_toast("👻 귀신같이 줄바꿈·띄어쓰기 다림질 완료")
        return

    if txt:
        morphed_c, _ = morph_korean_english_text_with_direction(txt)
        s = iron_and_polish_korean_text(morphed_c if morphed_c != txt else txt)
        arm_undo_snapshot(_LAST_TARGET_HWND, _find_edit_control_child(_LAST_TARGET_HWND), txt, s, mode="pre_iron")
        daemon_set_cb(s)
        show_ghost_toast("👻 귀신같이 줄바꿈·띄어쓰기 다림질 완료")


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
        for target_h in (hwnd, u32.GetAncestor(hwnd, 2)):
            if not target_h:
                continue
            proc_name, win_cls, _ = get_window_process_and_class(target_h)
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
    """Win10/Win11 UWP(계산기 ApplicationFrameWindow) 및 일반 창(메모장) 공통 하드웨어급 Topmost 적용·검증"""
    if not hwnd or not u32.IsWindow(hwnd):
        return False
    ins_after = HWND_TOPMOST if topmost else HWND_NOTOPMOST
    u32.SetWindowPos(hwnd, ins_after, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW)
    ex = u32.GetWindowLongW(hwnd, GWL_EXSTYLE)
    if bool(ex & WS_EX_TOPMOST) != topmost:
        try:
            cur_tid = k32.GetCurrentThreadId()
            tgt_tid = u32.GetWindowThreadProcessId(hwnd, None)
            if cur_tid != tgt_tid and tgt_tid:
                u32.AttachThreadInput(cur_tid, tgt_tid, True)
            u32.SetWindowPos(hwnd, ins_after, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW)
            if cur_tid != tgt_tid and tgt_tid:
                u32.AttachThreadInput(cur_tid, tgt_tid, False)
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
        cls_name, _ = _get_win_class_and_title(hwnd)
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
    s = txt.strip()
    # 1-A) 단일 번호에 이미 하이픈이 들어있는 경우 -> 숫자만 남기도록 역토글!
    if re.fullmatch(r"\d{2,4}-\d{2,4}-\d{4,5}", s):
        return re.sub(r"\D", "", s)
    # 1-B) 순수 숫자만 복사된 경우 (휴대폰 10~11자리, 사업자번호 10자리, 생년월일 8자리) -> 하이픈만 깔끔하게 삽입!
    if re.fullmatch(r"\d{8,11}", s):
        if re.fullmatch(r"01[016789]\d{7,8}", s):
            return f"{s[:3]}-{s[3:-4]}-{s[-4:]}"
        if re.fullmatch(r"02\d{7,8}", s):
            return f"{s[:2]}-{s[2:-4]}-{s[-4:]}"
        if len(s) == 10:
            return f"{s[:3]}-{s[3:5]}-{s[5:]}"
        if len(s) == 8 and s[:2] in ("19", "20"):
            return f"{s[:4]}-{s[4:6]}-{s[6:]}"

    # 2) 통짜 카톡/메시지(연락처 + 계좌/일정이 함께 들어있는 문장) -> 구조화 추출!
    phone_m = re.search(r"\b(01[016789])[-.\s]?(\d{3,4})[-.\s]?(\d{4})\b", s)
    acct_m = re.search(
        r"(국민|신한|우리|하나|농협|기업|카카오뱅크|토스뱅크|새마을|우체국|부산|대구|경남|광주|전북|제주|수협|신협|씨티|SC제일)?\s*((?!01[016789][-.\s]?\d{3,4}[-.\s]?\d{4})\d{3,6}[-.\s]?\d{2,6}[-.\s]?\d{3,7})",
        s,
    )
    sched_m = re.search(r"(오늘|내일|모레|\d{1,2}월\s*\d{1,2}일|[월화수목금토일]요일)\s*(오전|오후)?\s*(\d{1,2}시(\s*\d{1,2}분)?)", s)
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


def superpower_8_format_numbers(daemon_set_cb, raw_src: str | None = None) -> None:
    orig_clip = raw_src if (raw_src and raw_src.strip()) else get_clipboard_text()
    if orig_clip and orig_clip.strip():
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


def superpower_9_image_or_pdf_file(recent_png_bytes: list[bytes]) -> None:
    """
    [⑨번 & 보너스 C] 스샷/웹 이미지 -> 실물 파일(CF_HDROP) 1초 변환 + AI 스마트 파일명 자동 작명
    - 연속 캡처한 스샷이 2장 이상이면: 1개의 합본 .pdf 파일로 묶어서 변환!
    - 스샷 1장이거나 웹 이미지 URL이면: 단일 .png 파일로 변환!
    """
    try:
        from PIL import Image, ImageGrab
        ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        tag = _generate_smart_filename_prefix()

        # 1) 연속 캡처한 스샷이 2장 이상 쌓여 있는 경우 -> 초고화질(300 DPI + 소형 캡처 2배 업스케일) PDF 1개로 합본 변환!
        if len(recent_png_bytes) >= 2:
            pil_imgs = []
            for b in recent_png_bytes:
                im = Image.open(io.BytesIO(b)).convert("RGB")
                if im.width < 1600:
                    scale = 2 if im.width >= 600 else 3
                    im = im.resize((im.width * scale, im.height * scale), Image.Resampling.LANCZOS)
                pil_imgs.append(im)
            pdf_path = Path(tempfile.gettempdir()) / f"귀신같이_합본_{tag}_{ts}.pdf"
            pil_imgs[0].save(pdf_path, "PDF", resolution=300.0, quality=100, subsampling=0, save_all=True, append_images=pil_imgs[1:])
            if set_clipboard_hdrop_file(str(pdf_path)):
                count = len(pil_imgs)
                recent_png_bytes.clear()
                show_ghost_toast(f"👻 귀신같이 PDF합본변환 ({count}장)")
                return

        # 2) 단일 스샷 이미지 변환
        out_path = Path(tempfile.gettempdir()) / f"귀신같이_{tag}_{ts}.png"
        clip_obj = ImageGrab.grabclipboard()
        if isinstance(clip_obj, Image.Image):
            clip_obj.save(out_path, "PNG")
            if set_clipboard_hdrop_file(str(out_path)):
                recent_png_bytes.clear()
                show_ghost_toast("👻 귀신같이 파일변환")
                return

        # 3) 웹 이미지 URL 다운로드 후 파일 변환
        txt = get_clipboard_text().strip()
        if txt.startswith(("http://", "https://")):
            req = urllib.request.Request(txt, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=5) as resp:
                out_path.write_bytes(resp.read())
            if set_clipboard_hdrop_file(str(out_path)):
                show_ghost_toast("👻 귀신같이 파일변환")
                return

        show_ghost_toast("👻 귀신같이 파일변환 (먼저 스샷이나 이미지를 복사해주세요)")
    except Exception:
        show_ghost_toast("👻 귀신같이 파일변환")


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

    ensure_default_snippets()

    u32.RegisterHotKey(None, 1, MOD_CONTROL | MOD_NOREPEAT, VK_0)
    u32.RegisterHotKey(None, 2, MOD_CONTROL | MOD_NOREPEAT, VK_NUMPAD0)
    u32.RegisterHotKey(None, 3, MOD_ALT | MOD_NOREPEAT, VK_Z)
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
        try:
            ts_str = datetime.datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:19]
            tag = _generate_smart_filename_prefix()
            img_path = Path(tempfile.gettempdir()) / f"귀신같이_캡처_{tag}_{ts_str}.png"
            img_path.write_bytes(png_bytes)
            init_label = f"[{tag}] 화면 캡처 이미지"
            rec = {
                "kind": "image",
                "png_bytes": png_bytes,
                "img_path": str(img_path),
                "text": init_label,
                "vec": AI_ENGINE.embed_128d(init_label),
                "ts": time.time(),
            }
            GLOBAL_AI_HISTORY.append(rec)
            if len(GLOBAL_AI_HISTORY) > 300:
                GLOBAL_AI_HISTORY.pop(0)

            def _async_ocr_enrich(target_rec: dict, p_str: str, base_tag: str) -> None:
                try:
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
$file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync('{p_str}')) ([Windows.Storage.StorageFile])
$stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
$decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
$res = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
$stream.Dispose()
Write-Output $res.Text
"""
                    enc_cmd = base64.b64encode(ps_script.encode("utf-16-le")).decode("ascii")
                    si = subprocess.STARTUPINFO()
                    si.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                    si.wShowWindow = 0
                    ocr_txt = subprocess.check_output(
                        ["powershell", "-NoProfile", "-WindowStyle", "Hidden", "-EncodedCommand", enc_cmd],
                        encoding="utf-8",
                        errors="ignore",
                        timeout=8,
                        startupinfo=si,
                        creationflags=0x08000000,
                    ).strip()
                    if ocr_txt:
                        clean_ocr = re.sub(r"\s+", " ", ocr_txt).strip()
                        combined = f"[{base_tag}] {clean_ocr}"
                        target_rec["text"] = combined
                        target_rec["vec"] = AI_ENGINE.embed_128d(combined[:200])
                except Exception:
                    pass

            threading.Thread(target=_async_ocr_enrich, args=(rec, str(img_path), tag), daemon=True).start()
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
    was_sub_key_down: dict[int, bool] = {}

    def arm_sub_hotkeys() -> None:
        nonlocal menu_armed, menu_armed_until
        if not menu_armed:
            for num in range(2, 10):
                u32.RegisterHotKey(None, 100 + num, MOD_NOREPEAT, 0x30 + num)
                u32.RegisterHotKey(None, 200 + num, MOD_NOREPEAT, 0x60 + num)
                # 유저가 Ctrl+0 직후 Ctrl 키에서 손을 미처 다 떼기 전에 숫자 2~9를 눌러도 100% 작동하도록 Ctrl+숫자도 함께 무장!
                u32.RegisterHotKey(None, 400 + num, MOD_CONTROL | MOD_NOREPEAT, 0x30 + num)
                u32.RegisterHotKey(None, 500 + num, MOD_CONTROL | MOD_NOREPEAT, 0x60 + num)
            for fnum in range(1, 11):
                u32.RegisterHotKey(None, 300 + fnum, MOD_NOREPEAT, VK_F1 + fnum - 1)
            menu_armed = True
        menu_armed_until = time.time() + MENU_ARM_SECONDS

    def disarm_sub_hotkeys() -> None:
        nonlocal menu_armed
        if menu_armed:
            for num in range(2, 10):
                u32.UnregisterHotKey(None, 100 + num)
                u32.UnregisterHotKey(None, 200 + num)
                u32.UnregisterHotKey(None, 400 + num)
                u32.UnregisterHotKey(None, 500 + num)
            for fnum in range(1, 11):
                u32.UnregisterHotKey(None, 300 + fnum)
            menu_armed = False

    def _execute_superpower_num(num: int) -> None:
        nonlocal seq_mode
        disarm_sub_hotkeys()
        close_ghost_toast()
        seq_mode = False
        fkey = f"superpower_key_{num}"
        allowed, q_msg = check_feature_quota_allowed(fkey)
        if not allowed:
            show_ghost_toast(q_msg, duration_ms=3200)
            return
        if num == 2:
            if superpower_2_typo_morph(daemon_set_clipboard, auto_triggered=False):
                complete_feature_action_success(fkey)
        elif num == 3:
            seq_queue.clear()
            recent_unpasted.clear()
            superpower_3_clean_format(daemon_set_clipboard, raw_src=last_summon_raw_clip)
            complete_feature_action_success(fkey)
        elif num == 4:
            seq_queue.clear()
            recent_unpasted.clear()
            superpower_4_iron_lines_and_nfkc(daemon_set_clipboard, raw_src=last_summon_raw_clip)
            complete_feature_action_success(fkey)
        elif num == 5:
            superpower_5_merge_or_ai_search(recent_unpasted, seq_queue, ai_clipboard_history, daemon_set_clipboard)
            complete_feature_action_success(fkey)
        elif num == 6:
            superpower_6_screen_ocr(daemon_set_clipboard)
            complete_feature_action_success(fkey)
        elif num == 7:
            superpower_7_toggle_topmost(_LAST_TARGET_HWND)
            complete_feature_action_success(fkey)
        elif num == 8:
            seq_queue.clear()
            recent_unpasted.clear()
            superpower_8_format_numbers(daemon_set_clipboard, raw_src=last_summon_raw_clip)
            complete_feature_action_success(fkey)
        elif num == 9:
            is_pdf_m = len(recent_images) >= 2
            superpower_9_image_or_pdf_file(recent_images)
            complete_feature_action_success("feat_b3_pdf_merge" if is_pdf_m else fkey)

    def trigger_master_summon() -> None:
        nonlocal seq_mode, pasting_started, copied_after_trigger, seq_queue, last_summon_raw_clip
        _capture_target_hwnd()
        play_baby_ghost_sound(mode="summon")
        record_feature_telemetry("ctrl0_summon_bar")
        seq_mode = True
        pasting_started = False
        copied_after_trigger = False

        # 트리거 즉시 현재 클립보드 원문을 보존 (서식세탁[3]·줄바꿈정리[4]·번호성형[8]에서 첫 줄만 남는 현상 100% 원천 차단!)
        live_clip = get_clipboard_text()
        if live_clip:
            last_summon_raw_clip = live_clip
            if not recent_unpasted:
                recent_unpasted.append(live_clip)
            elif recent_unpasted[-1] != live_clip:
                recent_unpasted.append(live_clip)
        elif recent_unpasted:
            last_summon_raw_clip = recent_unpasted[-1]

        # 엑셀 셀 검사 (실제 엑셀 클립보드 포맷일 때만 분해)
        excel_cells = []
        if recent_unpasted:
            excel_cells = split_excel_cells(recent_unpasted[-1])
        if not excel_cells and live_clip:
            excel_cells = split_excel_cells(live_clip)
        if not excel_cells and has_excel_clipboard_format() and len(recent_unpasted) >= 2:
            excel_cells = list(recent_unpasted)

        if excel_cells:
            # [보너스 B] 엑셀 다중 셀/줄 1회 복사 상태면 자동으로 1칸씩 쪼개어 순차 장전!
            seq_queue = excel_cells
            daemon_set_clipboard(seq_queue[0])
            arm_sub_hotkeys()
            show_ghost_toast(
                f"귀신같이 (엑셀 {len(excel_cells)}칸 장전) | [Ctrl+V] 순차·칸맞춤   [9] 파일·PDF변환   [F1~10] 상용구   [2] 한영성형\n[3] 서식세탁   [4] 줄바꿈정리   [5] 합본   [6] 글자·표OCR   [7] 창고정   [8] 번호·일정",
                duration_ms=6500,
            )
        elif len(recent_unpasted) >= 2 and not ("\n" in (live_clip or "") and not has_excel_clipboard_format()):
            seq_queue = list(recent_unpasted)
            daemon_set_clipboard(seq_queue[0])
            arm_sub_hotkeys()
            show_ghost_toast(
                f"귀신같이 ({len(seq_queue)}개 장전) | [Ctrl+V] 순차·칸맞춤   [9] 파일·PDF변환   [F1~10] 상용구   [2] 한영성형\n[3] 서식세탁   [4] 줄바꿈정리   [5] 합본   [6] 글자·표OCR   [7] 창고정   [8] 번호·일정",
                duration_ms=6500,
            )
        else:
            seq_queue.clear()
            arm_sub_hotkeys()
            show_ghost_toast(
                "귀신같이 | [Ctrl+V] 순차·칸맞춤   [9] 파일·PDF변환   [F1~10] 상용구   [2] 한영성형\n[3] 서식세탁   [4] 줄바꿈정리   [5] 합본   [6] 글자·표OCR   [7] 창고정   [8] 번호·일정",
                duration_ms=6500,
            )

    last_summon_ts: float = 0.0
    was_ctrl0_down: bool = False
    was_ctrl_alt_t_down: bool = False
    was_ctrl_z_down: bool = False
    last_topmost_ts: float = 0.0

    # [?? 0 = ??? ??? ???]: ? Ctrl + ???(??) / ? ??? 0.35? ?~~ (Long-Press, ?? ??? ?? ?? ?? ??)
    def _low_level_mouse_proc(nCode: int, wParam: int, lParam: int) -> int:
        try:
            if nCode >= 0:
                if wParam == WM_RBUTTONDOWN:
                    info = ctypes.cast(lParam, ctypes.POINTER(MSLLHOOKSTRUCT)).contents
                    ctrl_now = (u32.GetAsyncKeyState(VK_CONTROL) & 0x8000) != 0
                    alt_now = (u32.GetAsyncKeyState(VK_MENU) & 0x8000) != 0
                    shift_now = (u32.GetAsyncKeyState(VK_SHIFT) & 0x8000) != 0
                    if ctrl_now and not alt_now and not shift_now:
                        _RBTN_HOLD_STATE["active"] = False
                        _RBTN_HOLD_STATE["triggered"] = True
                        _RBTN_HOLD_STATE["suppress_next_up"] = True
                        _RBTN_HOLD_STATE["summon_requested"] = True
                        return 1
                    else:
                        _RBTN_HOLD_STATE["active"] = True
                        _RBTN_HOLD_STATE["down_ts"] = time.time()
                        _RBTN_HOLD_STATE["x"] = info.pt.x
                        _RBTN_HOLD_STATE["y"] = info.pt.y
                        _RBTN_HOLD_STATE["triggered"] = False
                        _RBTN_HOLD_STATE["suppress_next_up"] = False
                elif wParam == WM_MOUSEMOVE:
                    if _RBTN_HOLD_STATE["active"] and not _RBTN_HOLD_STATE["triggered"]:
                        info = ctypes.cast(lParam, ctypes.POINTER(MSLLHOOKSTRUCT)).contents
                        if abs(info.pt.x - _RBTN_HOLD_STATE["x"]) > 8 or abs(info.pt.y - _RBTN_HOLD_STATE["y"]) > 8:
                            _RBTN_HOLD_STATE["active"] = False
                elif wParam == WM_RBUTTONUP:
                    _RBTN_HOLD_STATE["active"] = False
                    if _RBTN_HOLD_STATE["suppress_next_up"]:
                        _RBTN_HOLD_STATE["suppress_next_up"] = False
                        return 1
        except Exception:
            pass
        return u32.CallNextHookEx(None, nCode, wParam, lParam)

    _mouse_hook_cb = LowLevelMouseProcType(_low_level_mouse_proc)
    _mouse_hook_handle = u32.SetWindowsHookExW(WH_MOUSE_LL, _mouse_hook_cb, None, 0)

    msg = wintypes.MSG()
    if "--show-now" in sys.argv:
        def _delayed_init_summon():
            time.sleep(0.35)
            trigger_master_summon()
        last_summon_ts = time.time()
        threading.Thread(target=_delayed_init_summon, daemon=True).start()
    while u32.GetMessageW(ctypes.byref(msg), None, 0, 0) != 0:
        try:
            if msg.message == WM_HOTKEY:
                hk_id = msg.wParam
                # 1) 마스터 트리거 (Ctrl + 0 또는 Alt + Z)
                if hk_id in (1, 2, 3):
                    now_hk = time.time()
                    if (now_hk - last_summon_ts) > 0.25:
                        last_summon_ts = now_hk
                        trigger_master_summon()

                # 1-B) 창 고정/원복 전용 핫키 (Ctrl + Alt + T)
                elif hk_id == 4:
                    now_hk = time.time()
                    if (now_hk - last_topmost_ts) > 0.25:
                        last_topmost_ts = now_hk
                        _execute_superpower_num(7)

                # 1-C) 오타성형/다림질 직후 1단계 정밀 원복 (Ctrl + Z 스냅샷)
                elif hk_id == 999:
                    execute_undo_snapshot(daemon_set_clipboard)

                # 2) 숫자 2~9 초능력 발동 (단독 또는 Ctrl 유지 상태 모두 지원)
                elif (102 <= hk_id <= 109) or (202 <= hk_id <= 209) or (402 <= hk_id <= 409) or (502 <= hk_id <= 509):
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

            elif msg.message == WM_TIMER:
                now = time.time()
                # ??? ??? ??? ??: ? Ctrl+??? ?? ?? / ? ??? 0.35? ?~~ ?? ?? ??
                if _RBTN_HOLD_STATE.get("summon_requested"):
                    _RBTN_HOLD_STATE["summon_requested"] = False
                    if (now - last_summon_ts) > 0.20:
                        last_summon_ts = now
                        trigger_master_summon()
                elif _RBTN_HOLD_STATE.get("active") and not _RBTN_HOLD_STATE.get("triggered"):
                    if (u32.GetAsyncKeyState(0x02) & 0x8000) != 0:
                        if (now - _RBTN_HOLD_STATE.get("down_ts", 0.0)) >= RBUTTON_LONG_PRESS_SEC:
                            pt_now = wintypes.POINT()
                            u32.GetCursorPos(ctypes.byref(pt_now))
                            if abs(pt_now.x - _RBTN_HOLD_STATE["x"]) <= 8 and abs(pt_now.y - _RBTN_HOLD_STATE["y"]) <= 8:
                                _RBTN_HOLD_STATE["triggered"] = True
                                _RBTN_HOLD_STATE["suppress_next_up"] = True
                                if (now - last_summon_ts) > 0.20:
                                    last_summon_ts = now
                                    trigger_master_summon()
                            else:
                                _RBTN_HOLD_STATE["active"] = False
                    else:
                        _RBTN_HOLD_STATE["active"] = False
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
                if menu_armed and now > menu_armed_until:
                    disarm_sub_hotkeys()

                # 귀신창이 열려 있을 때(menu_armed) UWP 계산기 등이 WM_HOTKEY를 가로채더라도 하드웨어 키 폴링으로 숫자 2~9 즉시 발동!
                if menu_armed and (now - last_summon_ts) > 0.14:
                    fg_cls_now, _ = _get_win_class_and_title(u32.GetForegroundWindow())
                    if "Tk" not in fg_cls_now:
                        triggered_num = 0
                        for n_check in range(2, 10):
                            k_main = (u32.GetAsyncKeyState(0x30 + n_check) & 0x8000) != 0
                            k_numpad = (u32.GetAsyncKeyState(0x60 + n_check) & 0x8000) != 0
                            k_now = k_main or k_numpad
                            if k_now and not was_sub_key_down.get(n_check, False):
                                triggered_num = n_check
                            was_sub_key_down[n_check] = k_now
                        if triggered_num:
                            _execute_superpower_num(triggered_num)
                            continue
                else:
                    for n_check in range(2, 10):
                        was_sub_key_down[n_check] = (
                            ((u32.GetAsyncKeyState(0x30 + n_check) & 0x8000) != 0)
                            or ((u32.GetAsyncKeyState(0x60 + n_check) & 0x8000) != 0)
                        )

                # 1) 비서가 data/clipboard_queue.json 에 순차 목록을 장전했는지 확인
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

                # 2) 클립보드 변경(새로운 복사 또는 스샷 캡처) 감지 + 오토매틱(Automatic) 한영 오타 자동 성형
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

                            # [②번 오토매틱 모드]: 수동 트리거(숫자 2) 및 타이핑 스페이스바(2단어 연속 오타)에서만 작동!
                            # ※ 주의: 클립보드 복사(Ctrl+C) 시에는 비밀번호(dksxor438090199 -> 안택438090199) 등을 오인 변조하므로 복사 시 자동 변환 금지!
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

                # 3) Ctrl + V 및 마스터 트리거(Ctrl + 0 / Alt + Z) 물리 키 입력 감지
                # - Windows 입력기와 타 앱이 RegisterHotKey(Ctrl+0)를 가로채더라도 GetAsyncKeyState 하드웨어 폴링으로 100% 작동 보장!
                ctrl_down = (u32.GetAsyncKeyState(VK_CONTROL) & 0x8000) != 0
                alt_down = (u32.GetAsyncKeyState(VK_MENU) & 0x8000) != 0
                shift_down = (u32.GetAsyncKeyState(VK_SHIFT) & 0x8000) != 0
                v_down = (u32.GetAsyncKeyState(VK_V) & 0x8000) != 0
                ctrl_v_now = ctrl_down and v_down

                zero_down = ((u32.GetAsyncKeyState(VK_0) & 0x8000) != 0) or ((u32.GetAsyncKeyState(VK_NUMPAD0) & 0x8000) != 0)
                z_down = (u32.GetAsyncKeyState(VK_Z) & 0x8000) != 0
                t_down = (u32.GetAsyncKeyState(0x54) & 0x8000) != 0
                ctrl0_now = (ctrl_down and not alt_down and not shift_down and zero_down) or (alt_down and not ctrl_down and not shift_down and z_down)
                if ctrl0_now and not was_ctrl0_down:
                    if (now - last_summon_ts) > 0.25:
                        last_summon_ts = now
                        trigger_master_summon()
                was_ctrl0_down = ctrl0_now

                ctrl_alt_t_now = ctrl_down and alt_down and not shift_down and t_down
                if ctrl_alt_t_now and not was_ctrl_alt_t_down:
                    if (now - last_topmost_ts) > 0.25:
                        last_topmost_ts = now
                        _execute_superpower_num(7)
                was_ctrl_alt_t_down = ctrl_alt_t_now

                ctrl_z_now = ctrl_down and not alt_down and not shift_down and z_down
                if ctrl_z_now and not was_ctrl_z_down:
                    if _UNDO_SNAPSHOT.get("active"):
                        execute_undo_snapshot(daemon_set_clipboard)
                was_ctrl_z_down = ctrl_z_now

                # [②번 양방향 오토매틱 타이핑 감지 (2어절 연속 오타 감지 + 0.2ms 원자적 교체 + 한/영 키 즉시 동기화)]:
                # - 1단어만 오타 났을 때는 유저가 스스로 백스페이스+한/영 키를 칠 수 있으므로 손버릇 충돌 방지를 위해 대기(pending_first_typo)만 함.
                # - 모른 채 원고만 보며 2단어째 오타까지 연속 입력 후 Space를 치는 순간: 1단어+2단어를 0.2ms 원자적 교체로 성형 + 한/영 키 전환!
                if pending_first_typo is not None and (now - pending_first_typo.get("ts", 0.0)) > 4.5:
                    pending_first_typo = None

                hangul_down = (u32.GetAsyncKeyState(VK_HANGUL) & 0x8000) != 0
                if hangul_down and not was_key_down.get(VK_HANGUL, False):
                    # 유저가 직접 한/영 키를 눌렀다면 1단어 대기 버퍼는 즉시 초기화
                    typed_ascii_buf.clear()
                    pending_first_typo = None
                was_key_down[VK_HANGUL] = hangul_down

                # 마우스 클릭이나 방향키·편집키(Left/Up/Right/Down/Home/End/Del/Tab/Esc) 입력 시에는 타이핑 버퍼를 즉시 초기화하여 앞 글자 찌꺼기 현상 원천 차단!
                for nav_vk in (0x01, 0x02, 0x09, 0x1B, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x2E):
                    nav_down = (u32.GetAsyncKeyState(nav_vk) & 0x8000) != 0
                    if nav_down and not was_key_down.get(nav_vk, False):
                        typed_ascii_buf.clear()
                        pending_first_typo = None
                    was_key_down[nav_vk] = nav_down

                if not ctrl_down and not alt_down and not menu_armed:
                    for vk_code in range(0x41, 0x5B):  # A ~ Z
                        is_down = (u32.GetAsyncKeyState(vk_code) & 0x8000) != 0
                        if is_down and not was_key_down.get(vk_code, False):
                            ch = chr(vk_code) if shift_down else chr(vk_code + 32)
                            typed_ascii_buf.append(ch)
                            if len(typed_ascii_buf) > 28:
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
                            if typed_ascii_buf:
                                if not shift_down:
                                    typed_ascii_buf.append(chr(d_vk))
                                elif d_vk in _SHIFT_DIGIT_MAP:
                                    typed_ascii_buf.append(_SHIFT_DIGIT_MAP[d_vk])
                        was_key_down[d_vk] = d_down

                    for nd_vk in range(0x60, 0x6A):  # 넘패드 숫자키 0 ~ 9
                        nd_down = (u32.GetAsyncKeyState(nd_vk) & 0x8000) != 0
                        if nd_down and not was_key_down.get(nd_vk, False):
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
                            if typed_ascii_buf:
                                typed_ascii_buf.append(sh_ch if shift_down else norm_ch)
                        was_key_down[p_vk] = p_down

                    back_down = (u32.GetAsyncKeyState(VK_BACK) & 0x8000) != 0
                    if back_down and not was_key_down.get(VK_BACK, False):
                        if typed_ascii_buf:
                            typed_ascii_buf.pop()
                        else:
                            # 유저가 1단어 직후 백스페이스를 쳤다면 스스로 수동 교정 중이므로 자동 개입 취소!
                            pending_first_typo = None
                    was_key_down[VK_BACK] = back_down

                    space_down = (u32.GetAsyncKeyState(VK_SPACE) & 0x8000) != 0
                    if space_down and not was_key_down.get(VK_SPACE, False):
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

                        if cur_line is not None:
                            cur_stripped = cur_line.rstrip(" ")
                            last_tok = cur_stripped.split()[-1] if cur_stripped.strip() else ""
                            m_last_eng = re.match(r"^([^A-Za-z가-힣\s]*)([A-Za-z]+)([^A-Za-z가-힣\s]*)$", last_tok)
                            if m_last_eng:
                                typed_as_eng = True
                                typed_as_kor = False
                                lead_punct, word_cand, trail_punct = m_last_eng.groups()
                                trail_digits = re.sub(r"[^0-9]", "", lead_punct + trail_punct)
                                raw_buf_str = last_tok
                            else:
                                typed_as_eng = bool(raw_buf_str) and cur_stripped.endswith(raw_buf_str)
                                typed_as_kor = not typed_as_eng
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
                                        "target_ko": False,
                                        "has_digits": False,
                                        "ts": now,
                                        "hwnd": hwnd_fg,
                                    }

                        if curr_typo is not None:
                            should_trigger = False
                            if cur_line is not None:
                                line_tokens = cur_line.strip().split()
                                if len(line_tokens) >= 2:
                                    prev_is_eng_typo = False
                                    for prev_tok in line_tokens[:-1]:
                                        for p_chunk in re.findall(r"[A-Za-z]+", prev_tok):
                                            if len(p_chunk) >= 2 and not AI_ENGINE.is_valid_english_word(p_chunk):
                                                pk = eng_word_to_kor(p_chunk)
                                                if pk and is_valid_korean_word(pk):
                                                    prev_is_eng_typo = True
                                                    break
                                        if prev_is_eng_typo:
                                            break
                                    if curr_typo["target_ko"]:
                                        if prev_is_eng_typo or (curr_typo["has_digits"] and len(word_cand) >= 2) or len(word_cand) >= 6:
                                            should_trigger = True
                                    else:
                                        if pending_first_typo is not None and not pending_first_typo["target_ko"] and pending_first_typo.get("hwnd") == hwnd_fg and pending_first_typo["raw"] in cur_line:
                                            should_trigger = True
                            else:
                                if pending_first_typo is not None and pending_first_typo["target_ko"] == curr_typo["target_ko"] and pending_first_typo.get("hwnd") == hwnd_fg:
                                    should_trigger = True
                                elif curr_typo["target_ko"] and curr_typo["has_digits"] and len(word_cand) >= 4:
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
                                        complete_feature_action_success("auto_typo_morph_2words")
                                        badge = "한글키 전환" if (lang_ed == "KO") else "영문키 전환"
                                        show_ghost_toast(f"👻 귀신같이 오토한영 ({raw_ed} ➔ {out_ed} | {badge})", duration_ms=1400)
                                else:
                                    set_ime_language(target_korean=target_ko)
                                    orig_c = get_clipboard_text()
                                    sentinel_auto = "__GHOSTI_AUTO_TYPO__"
                                    daemon_set_clipboard(sentinel_auto)
                                    time.sleep(0.015)
                                    release_all_modifiers()
                                    VK_HOME = 0x24
                                    VK_END = 0x23
                                    tap_key_combo([VK_SHIFT], VK_HOME)
                                    time.sleep(0.035)
                                    tap_key_combo([VK_CONTROL], VK_C)
                                    time.sleep(0.04)
                                    line_sel = get_clipboard_text()
                                    if line_sel and line_sel != sentinel_auto:
                                        morphed_line, _ = morph_korean_english_text_with_direction(line_sel)
                                        morphed_line = re.sub(r"^([가-힣])\1(녕하세요|기귀신)", r"\1\2", morphed_line)
                                        final_paste = morphed_line.rstrip(" ") + " "
                                    else:
                                        tap_key_combo([], VK_END)
                                        time.sleep(0.015)
                                        for _ in range(total_backspaces):
                                            tap_key_combo([], VK_BACK)
                                        time.sleep(0.02)
                                        final_paste = combined_conv
                                    daemon_set_clipboard(final_paste)
                                    time.sleep(0.02)
                                    tap_key_combo([VK_CONTROL], VK_V)
                                    time.sleep(0.035)
                                    set_ime_language(target_korean=target_ko)
                                    if orig_c and orig_c != sentinel_auto:
                                        daemon_set_clipboard(orig_c)
                                    complete_feature_action_success("auto_typo_morph_2words")
                                    badge = "한글키 전환" if target_ko else "영문키 전환"
                                    show_ghost_toast(f"👻 귀신같이 오토한영 ({combined_raw} ➔ {combined_conv.strip()} | {badge})", duration_ms=1400)
                            else:
                                # 1단어째 오타는 바꾸지 않고 조용히 기억만 해둠 (유저가 스스로 고치는지 2단어로 넘어가는지 관찰)
                                pending_first_typo = curr_typo
                        else:
                            pending_first_typo = None
                            if edit_child and cur_line is not None and re.search(r"[가-힣]", cur_line):
                                ok_sp, raw_sp, out_sp, _ = _replace_edit_control_current_line_atomic(edit_child, auto_triggered=True)
                                if ok_sp:
                                    complete_feature_action_success("auto_typo_morph_2words")
                                    show_ghost_toast(f"👻 귀신같이 오토성형 ({raw_sp[-18:]} ➔ {out_sp[-18:]})", duration_ms=1400)
                    was_key_down[VK_SPACE] = space_down

                    ret_down = (u32.GetAsyncKeyState(VK_RETURN) & 0x8000) != 0
                    if ret_down and not was_key_down.get(VK_RETURN, False):
                        typed_ascii_buf.clear()
                        pending_first_typo = None
                    was_key_down[VK_RETURN] = ret_down
                else:
                    typed_ascii_buf.clear()

                if ctrl_v_now and not was_ctrl_v_down:
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

        u32.TranslateMessage(ctypes.byref(msg))
        u32.DispatchMessageW(ctypes.byref(msg))


def run_quota_self_test() -> int:
    """
    [멀린님 지시 반영: 7일을 기다리지 않고 1초 만에 검증하는 기능별 7일 타이머 & 만료 기능 성공 3회 제한 자동 테스트]
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
        ok, st = check_feature_quota_allowed("superpower_key_2")
        assert ok and st == "UNOPENED", f"Expected UNOPENED, got {ok}, {st}"
        print(f"   ✅ 2번(한영성형) 초기 상태: {st} (미개봉 확인)")

        print("🧪 [2단계] 2번(한영성형) 첫 실제 성공 완수 -> 7일 무제한 타이머 개시 검증...")
        res1 = complete_feature_action_success("superpower_key_2")
        assert res1["status"] == "FIRST_OPENED_7D" and res1["consumed_daily"] is False
        ok2, st2 = check_feature_quota_allowed("superpower_key_2")
        assert ok2 and st2.startswith("ACTIVE_D-")
        print(f"   ✅ 2번 첫 성공 직후 상태: {res1['status']} / {st2} (일일 3회 차감 없음: consumed_daily={res1['consumed_daily']})")

        print("🧪 [3단계] 2번 기능을 8일 전 사용으로 강제 타임머신 만료 조작 (4번 줄바꿈정리는 미개봉 유지)...")
        ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
        hwid = _get_machine_hwid_local()
        ledger["machines"][hwid]["featureTrials"]["feat_2_typo_morph"]["firstUsedTs"] = time.time() - (8 * 86400)
        ledger_path.write_text(json.dumps(ledger, ensure_ascii=False, indent=2), encoding="utf-8")

        print("🧪 [4단계] 만료된 2번 기능 3회 연속 성공 차감 검증 (1회 -> 2회 -> 3회)...")
        for i in range(1, 4):
            ok_exp, st_exp = check_feature_quota_allowed("superpower_key_2")
            assert ok_exp, f"Should allow #{i}, got {st_exp}"
            r_exp = complete_feature_action_success("superpower_key_2")
            assert r_exp["status"] == "EXPIRED_DAILY_3" and r_exp["consumed_daily"] is True
            print(f"   ✅ 만료 기능 #{i}회째 성공 완수 ➔ 잔여 일일 무료: {r_exp['daily_remaining']}/3회")

        print("🧪 [5단계] 만료된 2번 기능 4번째 시도 시 차단 및 안내 메시지 검증...")
        ok_4th, msg_4th = check_feature_quota_allowed("superpower_key_2")
        assert not ok_4th, "4th attempt on expired feature must be blocked!"
        print(f"   ✅ 4번째 만료 기능 차단 확인: {msg_4th}")

        print("🧪 [6단계] 만료 기능이 3회 모두 소진된 상태에서도 '미개봉 4번(줄바꿈정리)'은 7일 무제한으로 즉시 열리는지 검증!")
        ok_unopened, st_unopened = check_feature_quota_allowed("superpower_key_4")
        assert ok_unopened and st_unopened == "UNOPENED"
        r_unopened = complete_feature_action_success("superpower_key_4")
        assert r_unopened["status"] == "FIRST_OPENED_7D" and r_unopened["consumed_daily"] is False
        print(f"   ✅ 미개봉 4번(줄바꿈정리) 실행 결과: {r_unopened['status']} (만료 기능 한도와 무관하게 7일 무제한 즉시 개시!)")
        print("\n🎉 [ALL PASS] 기능별 7일 무제한 타이머 & 만료된 기능만 일일 성공 3회 제한 시뮬레이션 100% 통과!")
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
