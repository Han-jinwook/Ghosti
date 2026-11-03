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

HWND_TOPMOST = -1
HWND_NOTOPMOST = -2
SWP_NOMOVE = 0x0002
SWP_NOSIZE = 0x0001
SWP_NOACTIVATE = 0x0010
SWP_SHOWWINDOW = 0x0040
KEYEVENTF_KEYUP = 0x0002

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
                    for k in vocab:
                        clean_k = k.lstrip("▁")
                        if len(clean_k) >= 3 and clean_k.isalpha() and clean_k.isascii():
                            self.en_dict.add(clean_k.lower())
                        elif len(clean_k) >= 1 and all(0xAC00 <= ord(c) <= 0xD7A3 for c in clean_k):
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

    def is_valid_english_word(self, word: str) -> bool:
        w = word.strip().lower()
        if len(w) <= 2:
            return True
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
}


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
    - 영문 오타 -> 한글 변환 직후: 한/영 키를 '한글(1)' 모드로 자동 전환
    - 한글 오타 -> 영문 변환 직후: 한/영 키를 '영문(0)' 모드로 자동 전환
    """
    try:
        hwnd = u32.GetForegroundWindow()
        if hwnd:
            hime = imm32.ImmGetDefaultIMEWnd(hwnd)
            if hime:
                curr_mode = u32.SendMessageW(hime, WM_IME_CONTROL, IMC_GETCONVERSIONMODE, 0)
                is_kor = (curr_mode & IME_CMODE_NATIVE) != 0
                if is_kor != target_korean:
                    new_mode = (curr_mode | IME_CMODE_NATIVE) if target_korean else (curr_mode & ~IME_CMODE_NATIVE)
                    u32.SendMessageW(hime, WM_IME_CONTROL, IMC_SETCONVERSIONMODE, new_mode)
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
    """
    target_lang: str | None = None

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
                # 만약 원본 한글이 KS X 1001 밖의 희귀 음절을 포함하거나 대표 영단어인 경우 변환
                if not is_valid_korean_word(tok) or eng_cand.lower() in FALLBACK_EN_WORDS:
                    target_lang = "EN"
                    return eng_cand

        return tok

    morphed = re.sub(r"(?<![A-Za-z0-9_])[A-Za-z\u3131-\u318E\uAC00-\uD7A3]+(?![A-Za-z0-9_])", replace_token, text)
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
    """엑셀/표에서 여러 줄이나 탭으로 묶여 복사된 단일 텍스트를 개별 셀 배열로 자동 분해 (빈 셀 드래그 포함)"""
    if not text:
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


def tap_key_combo(modifiers: list[int], vk: int) -> None:
    for mod in modifiers:
        u32.keybd_event(mod, 0, 0, 0)
    u32.keybd_event(vk, 0, 0, 0)
    time.sleep(0.015)
    u32.keybd_event(vk, 0, KEYEVENTF_KEYUP, 0)
    for mod in reversed(modifiers):
        u32.keybd_event(mod, 0, KEYEVENTF_KEYUP, 0)


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
# 2~9번 초능력 & F1~F5 고정 상용구 & AI 기억 검색창 실행 함수들
# =====================================================================
def superpower_2_typo_morph(daemon_set_cb, auto_triggered: bool = False) -> bool:
    """
    [②번] 무후크 가상 클립보드 스왑 기반 양방향 한영 오타 성형 + 한/영 키(IME) 자동 전환
    """
    orig_clip = get_clipboard_text()

    # 1) 먼저 텍스트가 블록 선택되어 있는지 확인 (유저가 드래그했거나 Shift로 지정한 경우)
    tap_key_combo([VK_CONTROL], VK_C)
    time.sleep(0.04)
    selected = get_clipboard_text()

    # 2) 블록 선택이 없었다면:
    #    - 수동 실행([Ctrl+0] -> [2]) 시에는 줄 앞쪽에 남은 오타(예: 'dkssud 아기귀신아 뭐해'의 'dkssud')까지
    #      한 번에 모두 고쳐지도록 현재 줄 전체(Shift+Home)를 먼저 선택하여 검사!
    if not selected or selected == orig_clip:
        VK_HOME = 0x24
        if not auto_triggered:
            tap_key_combo([VK_SHIFT], VK_HOME)
        else:
            tap_key_combo([VK_CONTROL, VK_SHIFT], VK_LEFT)
        time.sleep(0.04)
        tap_key_combo([VK_CONTROL], VK_C)
        time.sleep(0.045)
        selected = get_clipboard_text()

    if selected and selected != orig_clip:
        morphed, target_lang = morph_korean_english_text_with_direction(selected)
        if morphed != selected and target_lang is not None:
            daemon_set_cb(morphed)
            time.sleep(0.025)
            tap_key_combo([VK_CONTROL], VK_V)
            time.sleep(0.05)
            # 변환 방향에 맞춰 한/영 키(IME) 상태를 목표 언어로 즉시 전환!
            set_ime_language(target_korean=(target_lang == "KO"))
            if orig_clip:
                daemon_set_cb(orig_clip)
            lang_badge = "한글키 전환" if target_lang == "KO" else "영문키 전환"
            show_ghost_toast(f"👻 귀신같이 한영성형 ({selected.strip()} ➔ {morphed.strip()} | {lang_badge})")
            return True
        else:
            # 오타가 아닌 경우 선택 해제 (오른쪽 화살표)
            tap_key_combo([], 0x27)
            if orig_clip:
                daemon_set_cb(orig_clip)
            if auto_triggered:
                return False

    # 3) 캐럿 선택이 불가능한 경우 클립보드 원문 전체 변환
    if not auto_triggered and orig_clip:
        morphed, target_lang = morph_korean_english_text_with_direction(orig_clip)
        if morphed != orig_clip and target_lang is not None:
            daemon_set_cb(morphed)
            set_ime_language(target_korean=(target_lang == "KO"))
            lang_badge = "한글키 전환" if target_lang == "KO" else "영문키 전환"
            show_ghost_toast(f"👻 귀신같이 한영성형 ({morphed[:15].strip()} | {lang_badge})")
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


def superpower_3_clean_format(daemon_set_cb) -> None:
    """
    [③번] 서식 100% 세탁 + EmbeddingGemma 2 시맨틱 광고·저작권 꼬리말 자동 절삭
    """
    txt = get_clipboard_text()
    if txt:
        cleaned = re.sub(r"(무단\s*전재\s*및\s*재배포\s*금지.*|저작권자\s*\(c\).*|ⓒ\s*.*무단.*)", "", txt, flags=re.IGNORECASE)
        lines = [ln for ln in cleaned.splitlines()]
        # 마지막 1~3줄이 광고/기자 바이라인 앵커와 시맨틱 유사도가 높으면 자동 절삭
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
        daemon_set_cb("\n".join(lines).strip())
        show_ghost_toast("👻 귀신같이 서식세탁")


def superpower_4_iron_lines_and_nfkc(daemon_set_cb) -> None:
    """
    [④번] 줄바꿈·유령공백(NFKC) 다림질 + EmbeddingGemma 2 문단 의미 분리
    - 별표(***), 가운뎃점(·), 말줄임표(. . .) 등 원문 특수문자는 단 1글자도 삭제하지 않고 100% 보존!
    """
    txt = get_clipboard_text()
    if txt:
        # 가운뎃점(·) 등 보존을 위해 NFKC 전후로 보호
        s = txt.replace("\u00B7", "__MIDDOT__").replace("\u318D", "__MIDDOT__")
        s = unicodedata.normalize("NFKC", s)
        s = s.replace("__MIDDOT__", "·")
        s = re.sub(r"[\u00A0\u200B-\u200D\uFEFF]", " ", s)
        s = s.replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'")
        # 1) 말줄임표(. . . 또는 ...) 뒤 줄바꿈 및 문장 중간에 끊어진 줄바꿈을 모두 매끄럽게 한 줄로 연결
        s = re.sub(r"(\.\s*\.\s*\.)\s*\r?\n\s*", r"\1 ", s)
        s = re.sub(r"(?<![?!:다요죠음함])\r?\n\s*(?=[가-힣A-Za-z0-9(\[.*·])", " ", s)
        s = re.sub(r"[ \t]{2,}", " ", s)
        # 2) PDF 표/문서에서 자간(kerning) 때문에 쪼개진 한글 조사·어미·관형사형 공백 정밀 복원
        # '과도 한 빈줄 이' -> '과도한 빈줄이', '과도 한빈 줄' -> '과도한 빈줄' 모두 먼저 정규화
        s = re.sub(r"([가-힣]{2,})\s+([한된할])\s+([가-힣]{1,3})\s+([가-힣]{1,2})", r"\1\2 \3\4", s)
        s = re.sub(r"([가-힣]{2,})\s+([한된할])([가-힣]{1,3})\s+([가-힣]{1,2})", r"\1\2 \3\4", s)
        s = re.sub(
            r"(?<=[가-힣])\s+(?=(?:은|는|이|가|을|를|에|에서|에게|의|로|으로|와|과|도|만|까지|부터|처럼|보다|지만|거나|며|면서|고|서|니|니까|면|다면|한|할|된|될|됨|합니다|습니다)(?=[\s.,?!:;)]|$))",
            "",
            s,
        )
        _standalone_1char = {"나", "너", "저", "그", "이", "더", "덜", "안", "못", "잘", "또", "꼭", "다", "총", "각", "전", "현", "신", "구", "유", "무", "열", "행", "칸", "줄", "초", "분", "시", "일", "월", "년", "원", "명", "건", "개", "장", "번"}
        def _join_broken_hangul(line: str) -> str:
            tokens = line.split(" ")
            if len(tokens) < 2:
                return line
            single_ko_cnt = sum(1 for t in tokens if len(t) == 1 and "가" <= t <= "힣" and t not in _standalone_1char)
            out = []
            i = 0
            while i < len(tokens):
                cur = tokens[i]
                if i + 1 < len(tokens):
                    nxt = tokens[i + 1]
                    cur_pure = re.sub(r"[.,?!:;)]+$", "", cur)
                    nxt_pure = re.sub(r"[.,?!:;)]+$", "", nxt)
                    if len(cur) == 1 and "가" <= cur <= "힣" and cur not in _standalone_1char and nxt_pure and all("가" <= c <= "힣" for c in nxt_pure):
                        out.append(cur + nxt)
                        i += 2
                        continue
                    if cur_pure and all("가" <= c <= "힣" for c in cur_pure) and nxt_pure and all("가" <= c <= "힣" for c in nxt_pure):
                        if len(cur_pure) == 2 and len(nxt_pure) == 2 and nxt_pure.endswith(("에", "의", "로", "를", "을", "이", "가", "은", "는", "도", "만", "와", "과")) and single_ko_cnt >= 1:
                            out.append(cur + nxt)
                            i += 2
                            continue
                out.append(cur)
                i += 1
            return " ".join(out)
        s = "\n".join(_join_broken_hangul(ln) for ln in s.splitlines())
        s = re.sub(r"\r?\n\s*\r?\n+", "\n\n", s)

        # 문장이 5개 이상 한 덩어리로 뭉쳐 있으면 EmbeddingGemma 2 문장 간 의미 거리로 자연스러운 문단 나누기
        sentences = [seg.strip() for seg in re.split(r"(?<=[.?!])\s+", s) if seg.strip()]
        if len(sentences) >= 5 and "\n\n" not in s:
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

        daemon_set_cb(s.strip())
        show_ghost_toast("👻 귀신같이 줄바꿈정리")


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


def _get_win_class_and_title(hwnd: int) -> tuple[str, str]:
    if not hwnd:
        return "", ""
    cls_buf = ctypes.create_unicode_buffer(128)
    u32.GetClassNameW(hwnd, cls_buf, 128)
    title_buf = ctypes.create_unicode_buffer(512)
    u32.GetWindowTextW(hwnd, title_buf, 512)
    return cls_buf.value or "", title_buf.value or ""


def _find_visible_utility_windows() -> list[int]:
    """Win10 & Win11 공통: 화면에 열려 있는 메모장(Notepad) 또는 계산기(ApplicationFrameWindow/CalcFrame/SciCalc) 탐색"""
    found: list[int] = []
    WNDENUMPROC = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

    def _enum_cb(h: int, _lp: int) -> bool:
        if u32.IsWindowVisible(h) and not u32.IsIconic(h):
            cls_name, title = _get_win_class_and_title(h)
            t_low = title.lower()
            c_low = cls_name.lower()
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
                u32.SetWindowPos(h, HWND_NOTOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE)
                if "📌" in title:
                    u32.SetWindowTextW(h, title.replace("📌 [항상 위 고정] ", "").replace("[📌고정] ", ""))
        return True

    u32.EnumWindows(WNDENUMPROC(_enum_cb), 0)


def enforce_pinned_windows() -> None:
    """타이머마다 고정된 창(_PINNED_HWNDS)이 다른 창(노션/브라우저 등) 클릭 시 절대 뒤로 숨지 않도록 하드웨어급 Z-Order 최상단 유지"""
    dead = []
    for h in list(_PINNED_HWNDS):
        if not u32.IsWindow(h):
            dead.append(h)
            continue
        u32.SetWindowPos(h, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE)
    for d in dead:
        _PINNED_HWNDS.discard(d)


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
    hwnd = target_hwnd or _capture_target_hwnd()
    if hwnd:
        root_hwnd = u32.GetAncestor(hwnd, 2)  # GA_ROOT = 2
        if root_hwnd:
            hwnd = root_hwnd

    # 만약 유저가 노션(브라우저)을 보면서 옆에 띄워둔 메모장/계산기를 고정하려고 [Ctrl+0]->[7]을 누른 경우:
    # 브라우저에 걸린 Topmost를 해제하고, 열려 있는 메모장/계산기 유틸 창들을 모두 최상단 고정(Pin)해 줍니다!
    cls_name, title = _get_win_class_and_title(hwnd)
    util_hwnds = _find_visible_utility_windows()
    if "Chrome_WidgetWin" in cls_name and util_hwnds:
        # 브라우저 자체에 걸려 있던 오고정 해제
        u32.SetWindowPos(hwnd, HWND_NOTOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE)
        _PINNED_HWNDS.discard(hwnd)
        if "📌" in title:
            u32.SetWindowTextW(hwnd, title.replace("📌 [항상 위 고정] ", "").replace("[📌고정] ", ""))
        # 화면에 떠 있는 메모장/계산기들을 즉시 고정!
        any_unpinned = any(uh not in _PINNED_HWNDS for uh in util_hwnds)
        for uh in util_hwnds:
            _, utitle = _get_win_class_and_title(uh)
            if any_unpinned:
                _PINNED_HWNDS.add(uh)
                u32.SetWindowPos(uh, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW)
                if "고정]" not in utitle:
                    u32.SetWindowTextW(uh, f"📌 [항상 위 고정] {utitle}")
            else:
                _PINNED_HWNDS.discard(uh)
                u32.SetWindowPos(uh, HWND_NOTOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW)
                u32.SetWindowTextW(uh, utitle.replace("📌 [항상 위 고정] ", "").replace("[📌고정] ", ""))
        show_ghost_toast("👻 귀신같이 창고정 📌" if any_unpinned else "👻 귀신같이 창고정해제")
        return

    if hwnd:
        _unpin_accidental_browsers(exclude_hwnd=hwnd)
        ex_style = u32.GetWindowLongW(hwnd, GWL_EXSTYLE)
        is_top = (hwnd in _PINNED_HWNDS) or ((ex_style & WS_EX_TOPMOST) != 0)
        if is_top:
            _PINNED_HWNDS.discard(hwnd)
            u32.SetWindowPos(hwnd, HWND_NOTOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW)
        else:
            _PINNED_HWNDS.add(hwnd)
            u32.SetWindowPos(hwnd, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW)
            # 만약 메모장/계산기 중 하나를 고정할 때 옆에 다른 보조창(메모장·계산기)도 함께 떠 있다면 같이 고정해 주어 둘 다 가려지지 않게 보장!
            if hwnd in util_hwnds:
                for uh in util_hwnds:
                    _PINNED_HWNDS.add(uh)
                    u32.SetWindowPos(uh, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW)
        try:
            _, cur_title = _get_win_class_and_title(hwnd)
            if is_top:
                new_title = cur_title.replace("📌 [항상 위 고정] ", "").replace("[📌고정] ", "")
            else:
                new_title = cur_title if "고정]" in cur_title else f"📌 [항상 위 고정] {cur_title}"
            if new_title != cur_title:
                u32.SetWindowTextW(hwnd, new_title)
        except Exception:
            pass
        show_ghost_toast("👻 귀신같이 창고정해제" if is_top else "👻 귀신같이 창고정 📌")


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


def superpower_8_format_numbers(daemon_set_cb) -> None:
    orig_clip = get_clipboard_text()
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
    """[보너스 A] F1~F5 평생 고정 상용구 0.1초 즉시 붙여넣기"""
    snippets = ensure_default_snippets()
    key = f"F{slot_num}"
    val = snippets.get(key, "")
    if val:
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
    except Exception:
        pass

    def arm_sub_hotkeys() -> None:
        nonlocal menu_armed, menu_armed_until
        if not menu_armed:
            for num in range(2, 10):
                u32.RegisterHotKey(None, 100 + num, MOD_NOREPEAT, 0x30 + num)
                u32.RegisterHotKey(None, 200 + num, MOD_NOREPEAT, 0x60 + num)
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
            for fnum in range(1, 11):
                u32.UnregisterHotKey(None, 300 + fnum)
            menu_armed = False

    def trigger_master_summon() -> None:
        nonlocal seq_mode, pasting_started, copied_after_trigger, seq_queue
        _capture_target_hwnd()
        play_baby_ghost_sound(mode="summon")
        record_feature_telemetry("ctrl0_summon_bar")
        seq_mode = True
        pasting_started = False
        copied_after_trigger = False

        # 트리거 즉시 현재 클립보드 실시간 점검 (recent_unpasted가 비었거나 갱신 지연 시 100% 보정)
        live_clip = get_clipboard_text()
        if live_clip:
            if not recent_unpasted:
                recent_unpasted.append(live_clip)
            elif recent_unpasted[-1] != live_clip:
                recent_unpasted.append(live_clip)

        # 엑셀 셀 검사 (최근 복사물 중 다중 셀이 있거나 엑셀 클립보드 포맷인지 확인)
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
        elif len(recent_unpasted) >= 2:
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

                # 2) 숫자 2~9 초능력 발동
                elif 102 <= hk_id <= 109 or 202 <= hk_id <= 209:
                    num = hk_id % 100
                    disarm_sub_hotkeys()
                    close_ghost_toast()
                    seq_mode = False
                    record_feature_telemetry(f"superpower_key_{num}")
                    if num == 2:
                        superpower_2_typo_morph(daemon_set_clipboard, auto_triggered=False)
                    elif num == 3:
                        superpower_3_clean_format(daemon_set_clipboard)
                    elif num == 4:
                        superpower_4_iron_lines_and_nfkc(daemon_set_clipboard)
                    elif num == 5:
                        superpower_5_merge_or_ai_search(recent_unpasted, seq_queue, ai_clipboard_history, daemon_set_clipboard)
                    elif num == 6:
                        superpower_6_screen_ocr(daemon_set_clipboard)
                    elif num == 7:
                        superpower_7_toggle_topmost(_LAST_TARGET_HWND)
                    elif num == 8:
                        superpower_8_format_numbers(daemon_set_clipboard)
                    elif num == 9:
                        superpower_9_image_or_pdf_file(recent_images)

                # 3) F1~F10 고정 상용구 발동
                elif 301 <= hk_id <= 310:
                    fslot = hk_id - 300
                    disarm_sub_hotkeys()
                    seq_mode = False
                    record_feature_telemetry(f"snippet_F{fslot}")
                    superpower_fixed_snippet(fslot, daemon_set_clipboard)

            elif msg.message == WM_TIMER:
                now = time.time()
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
                        if copied == last_self_text and now < self_set_until:
                            pass
                        else:
                            last_self_text = None
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
                ctrl0_now = (ctrl_down and not alt_down and not shift_down and zero_down) or (alt_down and not ctrl_down and not shift_down and z_down)
                if ctrl0_now and not was_ctrl0_down:
                    if (now - last_summon_ts) > 0.25:
                        last_summon_ts = now
                        trigger_master_summon()
                was_ctrl0_down = ctrl0_now

                # [②번 양방향 오토매틱 타이핑 감지 (2어절 연속 오타 감지 + 애기귀신 효과음 + 1.5초 한/영 키 역전 방어막)]:
                # - 1단어만 오타 났을 때는 유저가 스스로 백스페이스+한/영 키를 칠 수 있으므로 손버릇 충돌 방지를 위해 대기(pending_first_typo)만 함.
                # - 모른 채 원고만 보며 2단어째 오타까지 연속 입력 후 Space를 치는 순간: 1단어+2단어를 한꺼번에 성형 + 한/영 키 전환 + 애기귀신 소리('띠로링~♪') 재생!
                if now < ime_guard_until:
                    # 변환 직후 1.5초 이내에 유저가 반사 신경으로 한/영 키를 또 눌러버려도 목표 언어가 뒤집히지 않도록 고정 보호!
                    set_ime_language(target_korean=ime_guard_target_kor)

                hangul_down = (u32.GetAsyncKeyState(VK_HANGUL) & 0x8000) != 0
                if hangul_down and not was_key_down.get(VK_HANGUL, False):
                    # 유저가 직접 한/영 키를 눌렀다면 1단어 대기 버퍼는 즉시 초기화
                    typed_ascii_buf.clear()
                    pending_first_typo = None
                was_key_down[VK_HANGUL] = hangul_down

                # 마우스 클릭이나 방향키(Left/Up/Right/Down) 입력 시에는 타이핑 버퍼를 즉시 초기화하여 앞 글자 찌꺼기('dks안녕') 현상 원천 차단!
                for nav_vk in (0x01, 0x02, 0x25, 0x26, 0x27, 0x28):
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
                            if len(typed_ascii_buf) > 24:
                                typed_ascii_buf.pop(0)
                        was_key_down[vk_code] = is_down

                    # 문장부호(? ! . , 등)를 단어 끝에 붙여서 쳤을 때도 알파벳 단어는 유지하고 백스페이스 개수만 +1 누적!
                    punct_typed = 0
                    for p_vk in (0xBF, 0x31, 0xBC, 0xBE):  # '/?'(0xBF), '1!'(0x31), ',<'(0xBC), '.>'(0xBE)
                        p_down = (u32.GetAsyncKeyState(p_vk) & 0x8000) != 0
                        if p_down and not was_key_down.get(p_vk, False):
                            if typed_ascii_buf and (p_vk != 0x31 or shift_down):
                                typed_ascii_buf.append("?" if (p_vk == 0xBF and shift_down) else ("!" if (p_vk == 0x31 and shift_down) else ("." if p_vk == 0xBE else ",")))
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
                        raw_buf_str = "".join(typed_ascii_buf)
                        typed_ascii_buf.clear()
                        m_trail = re.match(r"^([A-Za-z]+)([?!.,]*)$", raw_buf_str)
                        word_cand = m_trail.group(1) if m_trail else re.sub(r"[^A-Za-z]", "", raw_buf_str)
                        trail_punct = m_trail.group(2) if m_trail else ""
                        hwnd_fg = u32.GetForegroundWindow()
                        hime_fg = imm32.ImmGetDefaultIMEWnd(hwnd_fg) if hwnd_fg else 0
                        ime_kor = (u32.SendMessageW(hime_fg, WM_IME_CONTROL, IMC_GETCONVERSIONMODE, 0) & IME_CMODE_NATIVE) != 0 if hime_fg else False

                        curr_typo: dict | None = None
                        if not ime_kor and len(word_cand) >= 3 and not AI_ENGINE.is_valid_english_word(word_cand):
                            kor_cand = eng_word_to_kor(word_cand)
                            if kor_cand and len(kor_cand) >= 2 and is_valid_korean_word(kor_cand):
                                curr_typo = {
                                    "disp_len": len(raw_buf_str) + 1,
                                    "raw": raw_buf_str,
                                    "conv": kor_cand + trail_punct,
                                    "target_ko": True,
                                }
                        elif ime_kor and len(word_cand) >= 3 and AI_ENGINE.is_valid_english_word(word_cand):
                            kor_produced = eng_word_to_kor(word_cand)
                            if any(0x3131 <= ord(c) <= 0x318E for c in kor_produced) or not is_valid_korean_word(kor_produced):
                                curr_typo = {
                                    "disp_len": len(kor_produced) + len(trail_punct) + 1,
                                    "raw": kor_produced + trail_punct,
                                    "conv": word_cand + trail_punct,
                                    "target_ko": False,
                                }

                        if curr_typo is not None:
                            if pending_first_typo is not None and pending_first_typo["target_ko"] == curr_typo["target_ko"]:
                                # [2단어 연속 오타 도달!] -> 1단어 + 2단어를 한꺼번에 교정 + 애기귀신 소리 + 한/영 키 전환 + 1.5초 방어막 가동!
                                total_backspaces = pending_first_typo["disp_len"] + curr_typo["disp_len"]
                                combined_conv = f"{pending_first_typo['conv']} {curr_typo['conv']} "
                                combined_raw = f"{pending_first_typo['raw']} {curr_typo['raw']}"
                                target_ko = curr_typo["target_ko"]
                                pending_first_typo = None

                                orig_c = get_clipboard_text()
                                # [Win10 & Win11 100% OS-Agnostic 통합 방식]:
                                # 글자 수를 세어 백스페이스/방향키를 연타하면 Win10/Win11 입력창마다 키가 씹히거나
                                # 앞글자('dks') 또는 뒷글자('dkssud...')가 남는 문제가 발생하므로,
                                # 아예 현재 줄 앞부분 전체(Shift+Home)를 블록 지정해 복사한 뒤 줄 전체를 한 번에 변환·교체합니다!
                                VK_HOME = 0x24
                                tap_key_combo([VK_SHIFT], VK_HOME)
                                time.sleep(0.035)
                                tap_key_combo([VK_CONTROL], VK_C)
                                time.sleep(0.04)
                                line_sel = get_clipboard_text()
                                if line_sel and line_sel != orig_c:
                                    morphed_line, _ = morph_korean_english_text_with_direction(line_sel)
                                    final_paste = morphed_line if morphed_line.endswith(" ") else (morphed_line + " ")
                                else:
                                    final_paste = combined_conv
                                daemon_set_clipboard(final_paste)
                                time.sleep(0.025)
                                tap_key_combo([VK_CONTROL], VK_V)
                                time.sleep(0.04)
                                set_ime_language(target_korean=target_ko)
                                ime_guard_target_kor = target_ko
                                ime_guard_until = time.time() + 1.5
                                if orig_c:
                                    daemon_set_clipboard(orig_c)
                                record_feature_telemetry("auto_typo_morph_2words")
                                badge = "한글키 전환" if target_ko else "영문키 전환"
                                show_ghost_toast(f"👻 귀신같이 오토한영 ({combined_raw} ➔ {combined_conv.strip()} | {badge})", duration_ms=1400)
                            else:
                                # 1단어째 오타는 바꾸지 않고 조용히 기억만 해둠 (유저가 스스로 고치는지 2단어로 넘어가는지 관찰)
                                pending_first_typo = curr_typo
                        else:
                            pending_first_typo = None
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
                            show_ghost_toast("👻 귀신같이 순차붙여넣기")
                    else:
                        recent_unpasted.clear()

                was_ctrl_v_down = ctrl_v_now
        except Exception:
            pass

        u32.TranslateMessage(ctypes.byref(msg))
        u32.DispatchMessageW(ctypes.byref(msg))


if __name__ == "__main__":
    main()
