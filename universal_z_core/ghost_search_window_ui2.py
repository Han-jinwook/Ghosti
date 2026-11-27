#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
❖ [창 UI ②] 👻 귀신검색창 (Ghosti 본진 전담 모듈 — ghost_search_window_ui2.py)
- 관할 분담:
  * [창 UI ① 기본 귀신창] & [창 UI ③ 사진·OCR 창]: Secretary(전속비서) 전담
  * [창 UI ② 👻 귀신검색창]: Ghosti(귀신같이 본진) 전담
- 핵심 기능:
  1) 단일 51988 프로세스 내 동일 Tkinter 메인루프(ctx 주입) 위에서 0.05초 즉시 렌더링 (프로세스/포트 추가 0)
  2) [⤢ 크게(갤러리) / ⤡ 작게] 2모드 단일 토글 + 작게 모드 내 검색량·미리보기 반응형 자율 크기 조절 (520px ↔ 960×640, 120ms 디바운스)
  3) 로컬 Z-코어(5199) 동영상 화면 글자(WinRT OCR) 캐시 연동:
     - 글자 많은 영상 감지 시 👻 아기귀신 1줄 안내 메시지 자동 점등
     - 영상 카드 우측 [📝글자뽑기] 원클릭 텍스트 통째 추출 · 클립보드 복사 · 현재 커서 즉시 주입
  4) 사진 결과 [📝OCR] 클릭 시 __UI3_OCR__ 큐 규약으로 비서 전담 사진·OCR 창(창 UI ③) 즉시 연동
"""

from __future__ import annotations

import ctypes
from ctypes import wintypes
import io
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import threading
import time
import tkinter as tk
from typing import Any
import urllib.parse
import urllib.request

try:
    from PIL import Image, ImageTk
except Exception:
    Image = None
    ImageTk = None


class _UI2_GUID(ctypes.Structure):
    _fields_ = [
        ("Data1", wintypes.DWORD),
        ("Data2", wintypes.WORD),
        ("Data3", wintypes.WORD),
        ("Data4", ctypes.c_ubyte * 8),
    ]


class _UI2_SIZE(ctypes.Structure):
    _fields_ = [("cx", ctypes.c_long), ("cy", ctypes.c_long)]


class _UI2_BITMAPINFOHEADER(ctypes.Structure):
    _fields_ = [
        ("biSize", wintypes.DWORD),
        ("biWidth", ctypes.c_long),
        ("biHeight", ctypes.c_long),
        ("biPlanes", wintypes.WORD),
        ("biBitCount", wintypes.WORD),
        ("biCompression", wintypes.DWORD),
        ("biSizeImage", wintypes.DWORD),
        ("biXPelsPerMeter", ctypes.c_long),
        ("biYPelsPerMeter", ctypes.c_long),
        ("biClrUsed", wintypes.DWORD),
        ("biClrImportant", wintypes.DWORD),
    ]


class _UI2_BITMAP(ctypes.Structure):
    _fields_ = [
        ("bmType", ctypes.c_long),
        ("bmWidth", ctypes.c_long),
        ("bmHeight", ctypes.c_long),
        ("bmWidthBytes", ctypes.c_long),
        ("bmPlanes", wintypes.WORD),
        ("bmBitsPixel", wintypes.WORD),
        ("bmBits", ctypes.c_void_p),
    ]


_IID_UI2_ShellItemImageFactory = _UI2_GUID(
    0xBCC18B79,
    0xBA16,
    0x442F,
    (ctypes.c_ubyte * 8)(0x80, 0xC4, 0x8A, 0x59, 0xC3, 0x0C, 0x46, 0x3B),
)


def _extract_win32_shell_pil_image(file_path_str: str, max_px: int = 360) -> Any:
    """Windows IShellItemImageFactory로 동영상·이미지 썸네일 PIL.Image를 0-Subprocess로 고속 추출합니다."""
    if os.name != "nt" or Image is None or not file_path_str or not os.path.isfile(file_path_str):
        return None
    try:
        ole32 = ctypes.windll.ole32
        shell32 = ctypes.windll.shell32
        gdi32 = ctypes.windll.gdi32
        user32 = ctypes.windll.user32
        try:
            ole32.CoInitialize(None)
        except Exception:
            pass
        shell32.SHCreateItemFromParsingName.argtypes = [
            wintypes.LPCWSTR,
            ctypes.c_void_p,
            ctypes.POINTER(_UI2_GUID),
            ctypes.POINTER(ctypes.c_void_p),
        ]
        shell32.SHCreateItemFromParsingName.restype = ctypes.c_long
        ppv = ctypes.c_void_p()
        hr = shell32.SHCreateItemFromParsingName(
            os.path.abspath(file_path_str),
            None,
            ctypes.byref(_IID_UI2_ShellItemImageFactory),
            ctypes.byref(ppv),
        )
        if hr != 0 or not ppv.value:
            return None
        try:
            vtbl = ctypes.cast(
                ctypes.cast(ppv, ctypes.POINTER(ctypes.c_void_p))[0],
                ctypes.POINTER(ctypes.c_void_p),
            )
            GetImageProto = ctypes.WINFUNCTYPE(
                ctypes.c_long,
                ctypes.c_void_p,
                _UI2_SIZE,
                ctypes.c_int,
                ctypes.POINTER(wintypes.HBITMAP),
            )
            get_image = GetImageProto(vtbl[3])
            hbm = wintypes.HBITMAP()
            hr_img = get_image(ppv, _UI2_SIZE(max_px, max_px), 0x08, ctypes.byref(hbm))
            if hr_img != 0 or not hbm.value:
                hr_img = get_image(ppv, _UI2_SIZE(max_px, max_px), 0x00, ctypes.byref(hbm))
            if hr_img != 0 or not hbm.value:
                return None
            try:
                bm = _UI2_BITMAP()
                gdi32.GetObjectW(hbm, ctypes.sizeof(_UI2_BITMAP), ctypes.byref(bm))
                w, h = int(bm.bmWidth), int(bm.bmHeight)
                if w <= 0 or h <= 0:
                    return None
                bmi = _UI2_BITMAPINFOHEADER()
                bmi.biSize = ctypes.sizeof(_UI2_BITMAPINFOHEADER)
                bmi.biWidth = w
                bmi.biHeight = -h
                bmi.biPlanes = 1
                bmi.biBitCount = 32
                bmi.biCompression = 0
                buf = ctypes.create_string_buffer(w * h * 4)
                hdc = user32.GetDC(None)
                try:
                    gdi32.GetDIBits(hdc, hbm, 0, h, buf, ctypes.byref(bmi), 0)
                finally:
                    user32.ReleaseDC(None, hdc)
                return Image.frombuffer("RGBA", (w, h), buf, "raw", "BGRA", 0, 1).convert("RGB")
            finally:
                gdi32.DeleteObject(hbm)
        finally:
            ReleaseProto = ctypes.WINFUNCTYPE(ctypes.c_ulong, ctypes.c_void_p)
            ReleaseProto(vtbl[2])(ppv)
    except Exception:
        return None

_VIDEO_OCR_UI_CACHE: dict[str, Any] = {"ts": 0.0, "mtime_sig": "", "loading": False, "by_name": {}}
_VIDEO_OCR_LOCK = threading.Lock()
_UI2_CACHE_LOCK = threading.Lock()
_UI2_SMALL_THUMB_CACHE: dict[str, bytes] = {}
_UI2_SMALL_THUMB_BY_PATH: dict[str, bytes] = {}
_UI2_THUMB_INFLIGHT: set[str] = set()
_UI2_PREVIEW_BYTES_CACHE: dict[str, tuple[bytes, str]] = {}
_UI2_PREVIEW_INFLIGHT: set[str] = set()
_EXTRACTED_QUEUE_UI_CACHE: dict[str, Any] = {"mtime_ns": -1, "size": -1, "items": []}
_UI2_LIVE_EXISTS_CACHE: dict[str, tuple[float, bool]] = {}
_UI2_LOCAL_NAMES_CACHE: dict[str, Any] = {"list_id": 0, "list_len": -1, "names": set()}
_UI2_THUMB_BG_PENDING: list[str] = []
_UI2_THUMB_BG_NOTIFY_CBS: list[Any] = []
_UI2_THUMB_BG_EVENT = threading.Event()
_UI2_THUMB_BG_STARTED = False


def _enqueue_ui2_thumbs_bg(paths_to_load: list[str], on_any_decoded: Any) -> None:
    """단일 백그라운드 워커 스레드에서 최신 노출 썸네일부터 순차 디코딩해 필터·갤러리 고속 전환 시 스레드 폭주와 GIL 경합을 0%로 차단합니다."""
    global _UI2_THUMB_BG_STARTED
    with _UI2_CACHE_LOCK:
        for p_it in paths_to_load:
            if p_it not in _UI2_THUMB_INFLIGHT:
                _UI2_THUMB_INFLIGHT.add(p_it)
                _UI2_THUMB_BG_PENDING.append(p_it)
        if callable(on_any_decoded) and on_any_decoded not in _UI2_THUMB_BG_NOTIFY_CBS:
            _UI2_THUMB_BG_NOTIFY_CBS.append(on_any_decoded)
        need_start = not _UI2_THUMB_BG_STARTED
        if need_start:
            _UI2_THUMB_BG_STARTED = True
    _UI2_THUMB_BG_EVENT.set()
    if need_start:
        def _thumb_worker_loop() -> None:
            if sys.platform == "win32":
                try:
                    ctypes.windll.kernel32.SetThreadPriority(ctypes.windll.kernel32.GetCurrentThread(), -1)
                except Exception:
                    pass
            while True:
                _UI2_THUMB_BG_EVENT.wait(timeout=5.0)
                _UI2_THUMB_BG_EVENT.clear()
                any_ok = False
                while True:
                    with _UI2_CACHE_LOCK:
                        if not _UI2_THUMB_BG_PENDING:
                            break
                        # 가장 최근 화면에 필요한 항목부터(LIFO 묶음) 처리하고 오래된 대기열은 최대 24개로 제한
                        if len(_UI2_THUMB_BG_PENDING) > 24:
                            dropped = _UI2_THUMB_BG_PENDING[:-24]
                            del _UI2_THUMB_BG_PENDING[:-24]
                            for dp in dropped:
                                _UI2_THUMB_INFLIGHT.discard(dp)
                        cur_p = _UI2_THUMB_BG_PENDING.pop(0)
                    try:
                        if _get_or_make_small_thumb_bytes(cur_p):
                            any_ok = True
                    except Exception:
                        pass
                    finally:
                        with _UI2_CACHE_LOCK:
                            _UI2_THUMB_INFLIGHT.discard(cur_p)
                    time.sleep(0.002)
                if any_ok:
                    with _UI2_CACHE_LOCK:
                        cbs = list(_UI2_THUMB_BG_NOTIFY_CBS)
                        _UI2_THUMB_BG_NOTIFY_CBS.clear()
                    for cb in cbs:
                        try:
                            cb()
                        except Exception:
                            pass

        threading.Thread(target=_thumb_worker_loop, daemon=True).start()


def _expand_camel_search_text(src: str) -> str:
    if not src:
        return ""
    s = re.sub(r"([a-z])([A-Z])", r"\1 \2", src)
    s = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1 \2", s)
    s = re.sub(r"([a-zA-Z])([0-9])", r"\1 \2", s)
    s = re.sub(r"([0-9])([a-zA-Z])", r"\1 \2", s)
    return s.lower()


def _mask_sensitive_doc_text(text: str) -> str:
    """[멀린님 확정 정책] 내 PC 로컬 파일 검색 시 비밀번호·주민번호·계좌번호를 별표로 가리지 않고 원본 그대로 즉시 표시합니다."""
    if not text:
        return ""
    return str(text)


def _peek_cached_small_thumb_bytes(img_path_str: str) -> bytes | None:
    """디스크 I/O(stat/open) 0회로 이미 메모리에 캐싱된 소형 썸네일(42x28) 바이트만 0.001ms 내에 조회합니다."""
    if not img_path_str or Image is None:
        return b""
    norm_p = os.path.normcase(os.path.abspath(img_path_str))
    with _UI2_CACHE_LOCK:
        return _UI2_SMALL_THUMB_BY_PATH.get(norm_p)


def _get_or_make_small_thumb_bytes(img_path_str: str) -> bytes:
    if not img_path_str or Image is None:
        return b""
    try:
        norm_p = os.path.normcase(os.path.abspath(img_path_str))
        if not os.path.isfile(img_path_str):
            return b""
        st = os.stat(img_path_str)
        ext_low = os.path.splitext(norm_p)[1].lower()
        is_vid = ext_low in (".mp4", ".mov", ".wmv", ".avi", ".mkv", ".webm", ".m4v", ".3gp", ".ts", ".mts", ".flv")
        max_sz = (800 * 1024 * 1024) if is_vid else (35 * 1024 * 1024)
        if st.st_size <= 0 or st.st_size > max_sz:
            return b""
        sig = f"{norm_p}|{st.st_size}|{int(st.st_mtime)}"
        with _UI2_CACHE_LOCK:
            cached = _UI2_SMALL_THUMB_CACHE.get(sig)
            if cached is not None:
                _UI2_SMALL_THUMB_BY_PATH[norm_p] = cached
                return cached
        tb = b""
        if is_vid or ext_low == ".heic":
            sh_im = _extract_win32_shell_pil_image(img_path_str, max_px=120)
            if sh_im is not None:
                resamp = getattr(getattr(Image, "Resampling", Image), "BILINEAR", Image.NEAREST)
                sh_im.thumbnail((42, 28), resamp)
                bio = io.BytesIO()
                sh_im.save(bio, "PNG")
                tb = bio.getvalue()
        else:
            try:
                with Image.open(img_path_str) as raw_im:
                    im_c = raw_im.convert("RGBA")
                    resamp = getattr(getattr(Image, "Resampling", Image), "BILINEAR", Image.NEAREST)
                    im_c.thumbnail((42, 28), resamp)
                    bio = io.BytesIO()
                    im_c.save(bio, "PNG")
                    tb = bio.getvalue()
            except Exception:
                sh_im = _extract_win32_shell_pil_image(img_path_str, max_px=120)
                if sh_im is not None:
                    resamp = getattr(getattr(Image, "Resampling", Image), "BILINEAR", Image.NEAREST)
                    sh_im.thumbnail((42, 28), resamp)
                    bio = io.BytesIO()
                    sh_im.save(bio, "PNG")
                    tb = bio.getvalue()
        if not tb:
            return b""
        with _UI2_CACHE_LOCK:
            if len(_UI2_SMALL_THUMB_CACHE) > 360:
                _UI2_SMALL_THUMB_CACHE.clear()
                _UI2_SMALL_THUMB_BY_PATH.clear()
            _UI2_SMALL_THUMB_CACHE[sig] = tb
            _UI2_SMALL_THUMB_BY_PATH[norm_p] = tb
        return tb
    except Exception:
        return b""


def _get_or_make_preview_bytes(img_path_str: str) -> tuple[bytes, str]:
    """중형(960x640) 우측 미리보기 이미지(352x220)를 백그라운드 스레드에서 디코딩해 LRU 캐싱합니다 (동영상·HEIC 포함)."""
    if not img_path_str or Image is None:
        return b"", ""
    try:
        norm_p = os.path.normcase(os.path.abspath(img_path_str))
        with _UI2_CACHE_LOCK:
            cached = _UI2_PREVIEW_BYTES_CACHE.get(norm_p)
            if cached is not None:
                return cached
        if not os.path.isfile(img_path_str):
            return b"", ""
        ext_low = os.path.splitext(norm_p)[1].lower()
        is_vid = ext_low in (".mp4", ".mov", ".wmv", ".avi", ".mkv", ".webm", ".m4v", ".3gp", ".ts", ".mts", ".flv")
        out = (b"", "")
        if is_vid or ext_low == ".heic":
            sh_im = _extract_win32_shell_pil_image(img_path_str, max_px=380)
            if sh_im is not None:
                dim_str = "동영상 미리보기" if is_vid else f"{sh_im.width}×{sh_im.height}px"
                resamp = getattr(getattr(Image, "Resampling", Image), "BILINEAR", Image.NEAREST)
                sh_im.thumbnail((352, 220), resamp)
                bio = io.BytesIO()
                sh_im.save(bio, "JPEG", quality=84)
                out = (bio.getvalue(), dim_str)
        else:
            try:
                from PIL import ImageFile as _ImgFile, ImageOps as _ImgOps
                _ImgFile.LOAD_TRUNCATED_IMAGES = True
            except Exception:
                _ImgOps = None
            try:
                with Image.open(img_path_str) as raw_im:
                    try:
                        if _ImgOps is not None:
                            raw_im = _ImgOps.exif_transpose(raw_im)
                    except Exception:
                        pass
                    dim_str = f"{raw_im.width}×{raw_im.height}px"
                    im_copy = raw_im.convert("RGB")
                    resamp = getattr(getattr(Image, "Resampling", Image), "BILINEAR", Image.NEAREST)
                    im_copy.thumbnail((352, 220), resamp)
                    bio = io.BytesIO()
                    im_copy.save(bio, "JPEG", quality=84)
                    out = (bio.getvalue(), dim_str)
            except Exception:
                sh_im = _extract_win32_shell_pil_image(img_path_str, max_px=380)
                if sh_im is not None:
                    dim_str = f"{sh_im.width}×{sh_im.height}px"
                    resamp = getattr(getattr(Image, "Resampling", Image), "BILINEAR", Image.NEAREST)
                    sh_im.thumbnail((352, 220), resamp)
                    bio = io.BytesIO()
                    sh_im.save(bio, "JPEG", quality=84)
                    out = (bio.getvalue(), dim_str)
        if not out[0]:
            return b"", ""
        with _UI2_CACHE_LOCK:
            if len(_UI2_PREVIEW_BYTES_CACHE) > 80:
                _UI2_PREVIEW_BYTES_CACHE.clear()
            _UI2_PREVIEW_BYTES_CACHE[norm_p] = out
        return out
    except Exception:
        return b"", ""


def _load_extracted_queue_fast() -> list[dict[str, Any]]:
    """압축 해제 직후 등록된 파일 큐(extracted_files_index_queue.json)를 mtime 캐시로 무부하 조회합니다."""
    try:
        ext_q_file = (
            Path(os.environ.get("LOCALAPPDATA") or (Path.home() / "AppData" / "Local"))
            / "Ghosti"
            / "data"
            / "extracted_files_index_queue.json"
        )
        if not ext_q_file.exists():
            return []
        st_q = ext_q_file.stat()
        if (
            _EXTRACTED_QUEUE_UI_CACHE["mtime_ns"] == int(st_q.st_mtime_ns)
            and _EXTRACTED_QUEUE_UI_CACHE["size"] == int(st_q.st_size)
        ):
            return _EXTRACTED_QUEUE_UI_CACHE["items"]
        ext_q_data = json.loads(ext_q_file.read_text(encoding="utf-8", errors="ignore"))
        parsed_items: list[dict[str, Any]] = []
        for erec in (ext_q_data.get("indexedFiles") or [])[:120]:
            if isinstance(erec, dict):
                parsed_items.append(erec)
        _EXTRACTED_QUEUE_UI_CACHE["mtime_ns"] = int(st_q.st_mtime_ns)
        _EXTRACTED_QUEUE_UI_CACHE["size"] = int(st_q.st_size)
        _EXTRACTED_QUEUE_UI_CACHE["items"] = parsed_items
        return parsed_items
    except Exception:
        return []


def _load_local_video_ocr_by_name(on_async_updated: Any = None) -> dict[str, dict[str, Any]]:
    """
    [UI 스레드 0.00ms 무블로킹 조회 + mtime 기반 백그라운드 갱신]:
    - 장시간 유휴 후 첫 귀신검색창 호출 시에도 Tkinter UI 스레드에서 1MB+ video_scene_ocr_cache_v2.json을
      동기 디스크 오픈·JSON 파싱하지 않고 즉시 메모리 캐시를 반환합니다.
    - 실제 파일 mtime/size가 바뀐 경우에만 백그라운드 워커 스레드에서 파싱 후 UI를 갱신합니다.
    """
    now = time.time()
    if float(_VIDEO_OCR_UI_CACHE["ts"]) > 0.0 and (now - float(_VIDEO_OCR_UI_CACHE["ts"])) < 15.0:
        return _VIDEO_OCR_UI_CACHE["by_name"]

    local_appdata = Path(os.environ.get("LOCALAPPDATA") or (Path.home() / "AppData" / "Local"))
    candidates = [
        local_appdata / "Merlin" / "video_scene_ocr_cache_v2.json",
        local_appdata / "Ghosti" / "data" / "video_scene_ocr_cache_v2.json",
        local_appdata / "Programs" / "MerlinFamily" / "video_scene_ocr_cache_v2.json",
        Path.home() / ".merlin_z_core" / "video_scene_ocr_cache_v2.json",
    ]
    sig_parts: list[str] = []
    existing_paths: list[Path] = []
    for p in candidates:
        try:
            if p.exists():
                st_p = p.stat()
                sig_parts.append(f"{p}:{st_p.st_mtime_ns}:{st_p.st_size}")
                existing_paths.append(p)
        except Exception:
            pass
    cur_sig = "|".join(sig_parts)
    if cur_sig == _VIDEO_OCR_UI_CACHE.get("mtime_sig") and float(_VIDEO_OCR_UI_CACHE["ts"]) > 0.0:
        _VIDEO_OCR_UI_CACHE["ts"] = now
        return _VIDEO_OCR_UI_CACHE["by_name"]

    if not existing_paths:
        _VIDEO_OCR_UI_CACHE["ts"] = now
        _VIDEO_OCR_UI_CACHE["mtime_sig"] = ""
        _VIDEO_OCR_UI_CACHE["by_name"] = {}
        return _VIDEO_OCR_UI_CACHE["by_name"]

    with _VIDEO_OCR_LOCK:
        if _VIDEO_OCR_UI_CACHE.get("loading"):
            return _VIDEO_OCR_UI_CACHE["by_name"]
        _VIDEO_OCR_UI_CACHE["loading"] = True

    def _bg_load_video_ocr() -> None:
        by_name: dict[str, dict[str, Any]] = {}
        try:
            for p in existing_paths:
                try:
                    raw = json.loads(p.read_text(encoding="utf-8", errors="ignore"))
                    if isinstance(raw, dict):
                        for _idx_v, (sig_key, val) in enumerate(raw.items()):
                            if not isinstance(val, dict):
                                continue
                            fname = str(val.get("videoFileName") or sig_key.split("|", 1)[0]).strip()
                            if not fname or fname in by_name:
                                continue
                            frames = val.get("frames") if isinstance(val.get("frames"), list) else []
                            full_txt = str(val.get("fullText") or "").strip()
                            if not full_txt and frames:
                                parts = []
                                for fr in frames:
                                    t_str = str(fr.get("ocrText") or "").strip()
                                    if t_str:
                                        s_v = int(fr.get("timeSec") or 0)
                                        parts.append(f"[{s_v // 60:02d}:{s_v % 60:02d}] {t_str}")
                                full_txt = "\n".join(parts)
                            if full_txt:
                                by_name[fname] = {
                                    "fullText": full_txt,
                                    "lineCount": int(val.get("lineCount") or len(full_txt.splitlines())),
                                    "keywords": val.get("keywords") or [],
                                }
                            if (_idx_v & 63) == 63:
                                time.sleep(0.001)
                except Exception:
                    pass
            _VIDEO_OCR_UI_CACHE["by_name"] = by_name
            _VIDEO_OCR_UI_CACHE["mtime_sig"] = cur_sig
            _VIDEO_OCR_UI_CACHE["ts"] = time.time()
            if callable(on_async_updated):
                try:
                    on_async_updated()
                except Exception:
                    pass
        finally:
            with _VIDEO_OCR_LOCK:
                _VIDEO_OCR_UI_CACHE["loading"] = False

    threading.Thread(target=_bg_load_video_ocr, daemon=True).start()
    return _VIDEO_OCR_UI_CACHE["by_name"]


def _fetch_video_ocr_from_zcore(file_path_or_name: str) -> dict[str, Any]:
    """5199 Z-코어의 /__videos/extract-ocr-text를 호출해 영상 속 화면 글자 전체를 추출합니다."""
    q = urllib.parse.quote(file_path_or_name)
    url = f"http://127.0.0.1:5199/__videos/extract-ocr-text?p={q}"
    try:
        req = urllib.request.Request(url, headers={"Origin": "http://127.0.0.1:5199"}, method="GET")
        with urllib.request.urlopen(req, timeout=25.0) as resp:
            data = json.loads(resp.read().decode("utf-8", errors="replace"))
            if isinstance(data, dict):
                _VIDEO_OCR_UI_CACHE["ts"] = 0.0  # 다음 렌더링 시 최신 캐시 반영
                return data
    except Exception as exc:
        return {"ok": False, "error": str(exc)}
    return {"ok": False, "error": "UNKNOWN"}


def build_ui2_search_window(
    ctx: dict[str, Any],
    win: tk.Toplevel,
    init_stage: str,
    init_query: str,
    pt_x: int,
    pt_y: int,
    work_area: tuple[int, int, int, int],
) -> None:
    """
    seq_paste_daemon.py로부터 Tkinter 컨텍스트(ctx)를 주입받아 [창 UI ② 👻 귀신검색창]을 렌더링합니다.
    """
    root = ctx["root"]
    active_mode = ctx["active_mode"]
    set_current_open_ui_mode = ctx["set_current_open_ui_mode"]
    ghost_symbol_photo = ctx.get("ghost_symbol_photo")
    close_win = ctx["close_win"]
    get_superpower_settings = ctx["get_superpower_settings"]
    update_superpower_settings = ctx["update_superpower_settings"]
    clicked_superpower_queue = ctx["clicked_superpower_queue"]
    compute_ghost_search_window_3stage_rect = ctx["compute_ghost_search_window_3stage_rect"]
    resolve_ghost_search_auto_stage = ctx["resolve_ghost_search_auto_stage"]
    opened_at = ctx["opened_at"]
    was_mouse_down = ctx["was_mouse_down"]
    is_hovered = ctx["is_hovered"]
    current_win = ctx["current_win"]
    win_rect_ref = ctx.get("win_rect")
    ui_dragging_ref = ctx.get("ui_dragging")
    apply_win_topmost = ctx["apply_win_topmost"]
    record_feature_telemetry = ctx["record_feature_telemetry"]
    thumb_refs = ctx["thumb_refs"]
    global_ai_history = ctx["global_ai_history"]
    get_lightweight_local_files = ctx["get_lightweight_local_files"]
    peek_lightweight_local_files = ctx.get("peek_lightweight_local_files")
    refresh_lightweight_local_files_async = ctx.get("refresh_lightweight_local_files_async")
    check_local_files_changed_async = ctx.get("check_local_files_changed_async")
    extract_chosung = ctx["extract_chosung"]
    eng_to_kor = ctx["eng_to_kor"]
    kor_to_eng = ctx["kor_to_eng"]
    clean_ocr_noise = ctx["clean_ocr_noise"]
    format_rel_time = ctx["format_rel_time"]
    make_context_snippet = ctx["make_context_snippet"]
    toast_queue = ctx["toast_queue"]
    paste_to_target = ctx["paste_to_target"]
    is_input_context = bool(ctx.get("is_input_context", True))
    daemon_set_clipboard = ctx.get("daemon_set_clipboard")
    daemon_copy_file = ctx.get("daemon_copy_file")
    get_last_rbtn_dismiss_esc_ts = ctx["get_last_rbtn_dismiss_esc_ts"]
    get_trial_badge_summary = ctx.get("get_trial_badge_summary")
    get_external_drive_banner = ctx.get("get_external_drive_banner")
    decide_external_drive = ctx.get("decide_external_drive")
    get_target_ime_korean = ctx.get("get_target_ime_korean")
    report_ui2_ime_korean = ctx.get("report_ui2_ime_korean")

    def _fast_ui2_file_exists(fp_chk: str) -> bool:
        if not fp_chk:
            return False
        now_e = time.monotonic()
        hit_e = _UI2_LIVE_EXISTS_CACHE.get(fp_chk)
        if hit_e is not None and (now_e - hit_e[0]) < 2.5:
            return hit_e[1]
        ok_e = os.path.exists(fp_chk)
        if len(_UI2_LIVE_EXISTS_CACHE) > 512:
            _UI2_LIVE_EXISTS_CACHE.clear()
        _UI2_LIVE_EXISTS_CACHE[fp_chk] = (now_e, ok_e)
        return ok_e

    def _resolve_google_workspace_web_url(fpath: str, text_hint: str = "") -> tuple[str, bool]:
        """
        .gsheet / .gdoc / .gslides 바로가기 파일에서 정식 Google Docs/Sheets 웹 URL을 추출합니다.
        반환값: (url, is_direct_doc_url)
        """
        if not fpath:
            return ("", False)
        ext_l = Path(fpath).suffix.lower()
        if ext_l not in (".gsheet", ".gdoc", ".gslides"):
            return ("", False)
        raw_txt = ""
        try:
            if os.path.isfile(fpath):
                with open(fpath, "rb") as gf:
                    raw_txt = gf.read(32768).decode("utf-8-sig", errors="ignore")
        except Exception:
            raw_txt = ""
        if raw_txt.strip():
            try:
                meta = json.loads(raw_txt)
                if isinstance(meta, dict):
                    g_url = str(meta.get("url") or "").strip()
                    doc_id = str(meta.get("doc_id") or meta.get("resource_id") or "").strip()
                    if g_url.startswith(("https://", "http://")):
                        return (g_url, True)
                    if doc_id:
                        if ext_l == ".gsheet":
                            return (f"https://docs.google.com/spreadsheets/d/{doc_id}/edit", True)
                        if ext_l == ".gslides":
                            return (f"https://docs.google.com/presentation/d/{doc_id}/edit", True)
                        return (f"https://docs.google.com/document/d/{doc_id}/edit", True)
            except Exception:
                pass
        for cand_src in (raw_txt, text_hint or ""):
            m_u = re.search(r"https://(?:docs|drive)\.google\.com/[^\s\"'<>]+", cand_src)
            if m_u:
                return (m_u.group(0), True)
        import urllib.parse as _up_g
        stem_q = _up_g.quote(Path(fpath).stem or Path(fpath).name)
        return (f"https://drive.google.com/drive/search?q={stem_q}", False)

    def _launch_url_in_default_browser(target_url: str) -> bool:
        if not target_url:
            return False
        if sys.platform == "win32":
            com_inited = False
            try:
                hr = ctypes.windll.ole32.CoInitializeEx(None, 0x2)
                com_inited = hr in (0, 1)
            except Exception:
                pass
            try:
                shell32 = ctypes.windll.shell32
                shell32.ShellExecuteW.argtypes = [
                    wintypes.HWND,
                    wintypes.LPCWSTR,
                    wintypes.LPCWSTR,
                    wintypes.LPCWSTR,
                    wintypes.LPCWSTR,
                    ctypes.c_int,
                ]
                shell32.ShellExecuteW.restype = ctypes.c_void_p
                rc = int(shell32.ShellExecuteW(None, "open", target_url, None, None, 1) or 0)
                if rc > 32:
                    return True
            except Exception:
                pass
            finally:
                if com_inited:
                    try:
                        ctypes.windll.ole32.CoUninitialize()
                    except Exception:
                        pass
        try:
            import webbrowser
            return bool(webbrowser.open(target_url))
        except Exception:
            return False

    def _open_google_workspace_web(fpath: str, text_hint: str = "") -> str:
        abs_fp = os.path.abspath(fpath) if fpath else ""
        if not abs_fp or not os.path.exists(abs_fp):
            toast_queue.put(("⚠️ 이미 삭제되었거나 이동된 파일입니다.", 2200))
            return "break"
        resolved_url, is_direct = _resolve_google_workspace_web_url(abs_fp, text_hint)
        close_win()

        def _bg_open_gweb() -> None:
            if is_direct and resolved_url:
                if _launch_url_in_default_browser(resolved_url):
                    return
            # 직접 URL이 없는 수동 생성 .gsheet 파일 등은 OS 기본 연결 앱 시도 후 브라우저 드라이브 검색 폴백
            if sys.platform == "win32":
                try:
                    rc = int(ctypes.windll.shell32.ShellExecuteW(None, "open", abs_fp, None, os.path.dirname(abs_fp) or None, 1) or 0)
                    if rc > 32:
                        return
                except Exception:
                    pass
            if resolved_url:
                _launch_url_in_default_browser(resolved_url)

        threading.Thread(target=_bg_open_gweb, daemon=True).start()
        return "break"

    def _open_file_in_os(fpath: str) -> str:
        abs_fp = os.path.abspath(fpath) if fpath else ""
        if not abs_fp or not os.path.exists(abs_fp):
            _UI2_LIVE_EXISTS_CACHE[fpath] = (time.monotonic(), False)
            _UI2_LIVE_EXISTS_CACHE[abs_fp] = (time.monotonic(), False)
            if callable(refresh_lightweight_local_files_async):
                refresh_lightweight_local_files_async(
                    lambda: st_state.update({"bg_ui_dirty": True}),
                    force=True,
                )
            st_state["bg_ui_dirty"] = True
            toast_queue.put(("⚠️ 이미 삭제되었거나 이동된 파일이라 목록에서 정리했습니다.", 2200))
            return "break"
        if Path(abs_fp).suffix.lower() in (".gsheet", ".gdoc", ".gslides"):
            return _open_google_workspace_web(abs_fp)

        def _launch_worker(target_p: str) -> None:
            opened = False
            if sys.platform == "win32":
                com_inited = False
                try:
                    # Windows ShellExecuteW(한컴PDF/사진앱/DDE 핸들러 포함)는 STA COM 초기화가 필수이며
                    # DETACHED_PROCESS 데몬 스레드에서 단순 os.startfile이 무응답 실패하는 문제를 원천 차단합니다.
                    hr = ctypes.windll.ole32.CoInitializeEx(None, 0x2)  # COINIT_APARTMENTTHREADED
                    com_inited = hr in (0, 1)
                except Exception:
                    pass
                try:
                    shell32 = ctypes.windll.shell32
                    shell32.ShellExecuteW.argtypes = [
                        wintypes.HWND,
                        wintypes.LPCWSTR,
                        wintypes.LPCWSTR,
                        wintypes.LPCWSTR,
                        wintypes.LPCWSTR,
                        ctypes.c_int,
                    ]
                    shell32.ShellExecuteW.restype = ctypes.c_void_p
                    rc = int(
                        shell32.ShellExecuteW(
                            None,
                            "open",
                            target_p,
                            None,
                            os.path.dirname(target_p) or None,
                            1,  # SW_SHOWNORMAL
                        )
                        or 0
                    )
                    if rc > 32:
                        opened = True
                except Exception:
                    pass
                finally:
                    if com_inited:
                        try:
                            ctypes.windll.ole32.CoUninitialize()
                        except Exception:
                            pass
                if not opened:
                    try:
                        os.startfile(target_p)
                        opened = True
                    except Exception:
                        pass
                if not opened:
                    try:
                        subprocess.Popen(
                            ["cmd.exe", "/c", "start", "", target_p],
                            creationflags=0x08000000,
                            close_fds=True,
                        )
                        opened = True
                    except Exception:
                        pass
            else:
                try:
                    os.startfile(target_p)
                    opened = True
                except Exception:
                    pass
            if not opened:
                toast_queue.put(("⚠️ 파일 열기에 실패했습니다.", 2200))

        try:
            threading.Thread(target=_launch_worker, args=(abs_fp,), daemon=True).start()
            close_win()
        except Exception:
            toast_queue.put(("⚠️ 파일 열기에 실패했습니다.", 2200))
        return "break"

    def _copy_item_to_clipboard(text_val: str = "", file_path: str = "") -> None:
        fp = (file_path or "").strip()
        if fp and os.path.exists(fp) and callable(daemon_copy_file):
            if daemon_copy_file(fp):
                close_win()
                toast_queue.put((f"📋 [{Path(fp).name}] 복사 완료! 원하는 곳에서 Ctrl+V 하세요", 2200))
                return
        t_clean = str(text_val or "").strip() or (fp if fp else "")
        if not t_clean:
            return
        if callable(daemon_set_clipboard):
            daemon_set_clipboard(t_clean)
        else:
            try:
                root.clipboard_clear()
                root.clipboard_append(t_clean)
                root.update_idletasks()
            except Exception:
                pass
        close_win()
        toast_queue.put(("📋 클립보드에 복사했습니다! (Ctrl+V)", 2000))

    active_mode[0] = "ui2"
    set_current_open_ui_mode("ui2")
    pinned_sel_file = ""
    pinned_sel_rec: dict[str, Any] | None = None
    if init_query.startswith("__SEL_FILE__:"):
        cand_sel = init_query[len("__SEL_FILE__:"):].strip()
        if cand_sel and os.path.exists(cand_sel):
            pinned_sel_file = cand_sel
            try:
                p_sel_obj = Path(pinned_sel_file)
                ext_sel = p_sel_obj.suffix.lower()
                kind_sel = (
                    "image"
                    if ext_sel in (".png", ".jpg", ".jpeg", ".jfif", ".webp", ".gif", ".bmp", ".heic", ".heif")
                    else ("video" if ext_sel in (".mp4", ".mov", ".mkv", ".avi", ".webm", ".wmv") else "doc")
                )
                pinned_sel_rec = {
                    "kind": kind_sel,
                    "file_path": pinned_sel_file,
                    "img_path": pinned_sel_file if kind_sel == "image" else "",
                    "ts": float(p_sel_obj.stat().st_mtime),
                    "text": f"📌 선택한 파일 · {p_sel_obj.name} ({p_sel_obj.parent.name})",
                }
            except Exception:
                pinned_sel_rec = None
        init_query = ""
    _local_names_cache = _UI2_LOCAL_NAMES_CACHE
    _ext_exists_cache: dict[str, tuple[float, bool]] = {}

    init_mode = "large" if init_stage in ("large", "gallery") else "compact"
    st_state: dict[str, Any] = {
        "mode": init_mode,
        "stage": "large" if init_mode == "large" else ("medium" if pinned_sel_file or init_stage == "medium" or init_query.strip() else "small"),
        "manual_stage": "large" if init_mode == "large" else ("medium" if pinned_sel_file else None),
        "custom_h": None if (init_mode == "large" or pinned_sel_file) else 330,
        "filter": "all",
        "sel_idx": 0,
        "items": [],
        "debounce_job": None,
        "resize_job": None,
        "last_typing_ts": 0.0,
        "video_ocr_modal_rec": None,
        "video_ocr_loading": False,
        "video_ocr_result_text": "",
        "video_ocr_copied_msg": "",
        "bg_ui_dirty": False,
        "bg_ocr_done_payload": None,
        "user_pos": None,
    }
    try:
        record_feature_telemetry(f"ghost_search_window_{st_state['stage']}")
    except Exception:
        pass

    outer = tk.Frame(win, bg="#0B1120", highlightbackground="#38BDF8", highlightthickness=2, padx=8, pady=6)
    outer.pack(fill="both", expand=True)

    # 1단 헤더: 👻귀신검색창 + 라이브 검색창 + 우측 [🏷️[2]파일라벨러][⤢ 크게(갤러리) / ⤡ 작게][🔊][✕]
    hdr = tk.Frame(outer, bg="#0F172A", highlightbackground="#14B8A6", highlightthickness=1, padx=6, pady=4)
    hdr.pack(fill="x", pady=(0, 4))

    if ghost_symbol_photo is not None:
        ic_lbl = tk.Label(hdr, image=ghost_symbol_photo, bg="#0F172A", bd=0)
        ic_lbl.image = ghost_symbol_photo
        ic_lbl.pack(side="left", padx=(0, 4))

    title_badge = tk.Label(
        hdr,
        text="👻귀신검색창",
        fg="#0B1120",
        bg="#2DD4BF",
        padx=5,
        pady=1,
        font=("Malgun Gothic", 8, "bold"),
        cursor="fleur",
    )
    title_badge.pack(side="left", padx=(0, 6))

    # [Tkinter 레이아웃 철칙]: 우측 고정 버튼들(✕, 🔊, ⤢크게, 🏷️파일라벨러)을 먼저 side="right"로 pack한 뒤
    # 검색 입력창(s_entry)을 마지막에 expand=True로 pack해야 520px 슬림 창(및 125~150% 배율)에서도 버튼 글자가 단 1px도 잘리지 않습니다!
    close_btn = tk.Label(
        hdr,
        text="✕",
        fg="#94A3B8",
        bg="#1E293B",
        padx=5,
        pady=1,
        font=("Malgun Gothic", 8, "bold"),
        cursor="hand2",
    )
    close_btn.pack(side="right", padx=(2, 0))
    close_btn.bind("<Button-1>", lambda _e: close_win())

    cur_sound = bool(get_superpower_settings().get("sound_enabled", True))
    mute_btn = tk.Label(
        hdr,
        text="🔊" if cur_sound else "🔇",
        fg="#5EEAD4" if cur_sound else "#64748B",
        bg="#1E293B",
        padx=4,
        pady=1,
        font=("Malgun Gothic", 8, "bold"),
        cursor="hand2",
    )
    mute_btn.pack(side="right", padx=(2, 0))

    def _toggle_snd(_e=None):
        nxt = not bool(get_superpower_settings().get("sound_enabled", True))
        update_superpower_settings({"sound_enabled": nxt})
        mute_btn.config(text="🔊" if nxt else "🔇", fg="#5EEAD4" if nxt else "#64748B")

    mute_btn.bind("<Button-1>", _toggle_snd)

    toggle_mode_btn = tk.Label(
        hdr,
        text="⤡ 작게" if st_state["mode"] == "large" else "⤢ 크게(갤러리)",
        fg="#0B1120" if st_state["mode"] == "large" else "#5EEAD4",
        bg="#2DD4BF" if st_state["mode"] == "large" else "#1E293B",
        padx=6,
        pady=1,
        font=("Malgun Gothic", 8, "bold"),
        cursor="hand2",
    )
    toggle_mode_btn.pack(side="right", padx=(2, 0))
    toggle_mode_btn.bind("<Button-1>", lambda _e: _toggle_window_mode())

    lbl_quick_btn = tk.Label(
        hdr,
        text="🏷️ 이 파일 귀신라벨링🔒",
        fg="#0B1120",
        bg="#5EEAD4",
        padx=5,
        pady=1,
        font=("Malgun Gothic", 8, "bold"),
        cursor="hand2",
    )
    lbl_quick_btn.pack(side="right", padx=(4, 2))

    def _on_hdr_labeler(_e=None) -> None:
        sel_fp = ""
        if st_state["items"]:
            cur_r = st_state["items"][min(st_state["sel_idx"], len(st_state["items"]) - 1)]
            sel_fp = str(cur_r.get("file_path") or cur_r.get("img_path") or "").strip()
        if not sel_fp or not os.path.exists(sel_fp):
            toast_queue.put(("🏷️ 먼저 목록에서 실제 파일을 하나 선택해 주세요.", 2200))
            return
        close_win()
        clicked_superpower_queue.put(("labeler", sel_fp))

    lbl_quick_btn.bind("<Button-1>", _on_hdr_labeler)

    s_entry = tk.Entry(
        hdr,
        width=6,
        fg="#F8FAFC",
        bg="#1E293B",
        insertbackground="#5EEAD4",
        relief="flat",
        font=("Malgun Gothic", 9),
    )
    s_entry.pack(side="left", fill="x", expand=True, padx=(0, 4))
    if init_query:
        s_entry.insert(0, init_query)

    # [유저 키보드 한/영 상태 100% 동기화]:
    # Windows는 Tkinter 새 창에 기본 영문 IME(0)를 할당하므로, 소환 직전 활성 창(또는 마지막 설정)의
    # 한/영 상태를 s_entry의 IMM32 컨텍스트 및 DefaultIMEWnd에 즉시 동기화하여 영타 강제 전환을 원천 해소합니다.
    _ime_sync_state: dict[str, Any] = {
        "user_toggled_in_ui2": False,
        "last_observed_kor": None,
    }

    def _read_entry_ime_is_korean() -> bool | None:
        if sys.platform != "win32":
            return None
        try:
            hwnd_e = s_entry.winfo_id()
            if not hwnd_e:
                return None
            imm32 = ctypes.windll.imm32
            imm32.ImmGetContext.argtypes = [wintypes.HWND]
            imm32.ImmGetContext.restype = wintypes.HANDLE
            imm32.ImmReleaseContext.argtypes = [wintypes.HWND, wintypes.HANDLE]
            imm32.ImmReleaseContext.restype = wintypes.BOOL
            imm32.ImmGetConversionStatus.argtypes = [
                wintypes.HANDLE,
                ctypes.POINTER(wintypes.DWORD),
                ctypes.POINTER(wintypes.DWORD),
            ]
            imm32.ImmGetConversionStatus.restype = wintypes.BOOL
            himc = imm32.ImmGetContext(hwnd_e)
            if himc:
                try:
                    conv = wintypes.DWORD(0)
                    sent = wintypes.DWORD(0)
                    if imm32.ImmGetConversionStatus(himc, ctypes.byref(conv), ctypes.byref(sent)):
                        return bool(conv.value & 0x0001)
                finally:
                    imm32.ImmReleaseContext(hwnd_e, himc)
        except Exception:
            pass
        return None

    def _apply_entry_ime_korean(target_korean: bool) -> None:
        if sys.platform != "win32":
            return
        try:
            if current_win[0] is not win or not win.winfo_exists():
                return
            hwnd_e = s_entry.winfo_id()
            if not hwnd_e:
                return
            u32_i = ctypes.windll.user32
            imm32 = ctypes.windll.imm32
            imm32.ImmGetContext.argtypes = [wintypes.HWND]
            imm32.ImmGetContext.restype = wintypes.HANDLE
            imm32.ImmReleaseContext.argtypes = [wintypes.HWND, wintypes.HANDLE]
            imm32.ImmReleaseContext.restype = wintypes.BOOL
            imm32.ImmGetConversionStatus.argtypes = [
                wintypes.HANDLE,
                ctypes.POINTER(wintypes.DWORD),
                ctypes.POINTER(wintypes.DWORD),
            ]
            imm32.ImmGetConversionStatus.restype = wintypes.BOOL
            imm32.ImmSetConversionStatus.argtypes = [wintypes.HANDLE, wintypes.DWORD, wintypes.DWORD]
            imm32.ImmSetConversionStatus.restype = wintypes.BOOL
            imm32.ImmSetOpenStatus.argtypes = [wintypes.HANDLE, wintypes.BOOL]
            imm32.ImmSetOpenStatus.restype = wintypes.BOOL
            imm32.ImmGetDefaultIMEWnd.argtypes = [wintypes.HWND]
            imm32.ImmGetDefaultIMEWnd.restype = wintypes.HWND

            hwnd_top = int(u32_i.GetParent(hwnd_e) or win.winfo_id() or 0)
            for h_cand in (hwnd_e, hwnd_top):
                if not h_cand:
                    continue
                himc = imm32.ImmGetContext(h_cand)
                if himc:
                    try:
                        conv = wintypes.DWORD(0)
                        sent = wintypes.DWORD(0)
                        imm32.ImmGetConversionStatus(himc, ctypes.byref(conv), ctypes.byref(sent))
                        new_conv = (conv.value | 0x0001) if target_korean else (conv.value & ~0x0001)
                        imm32.ImmSetOpenStatus(himc, 1)
                        imm32.ImmSetConversionStatus(himc, new_conv, sent.value)
                    finally:
                        imm32.ImmReleaseContext(h_cand, himc)
                hime = imm32.ImmGetDefaultIMEWnd(h_cand)
                if hime:
                    out_r = ctypes.c_size_t(0)
                    u32_i.SendMessageTimeoutW(
                        wintypes.HWND(hime),
                        0x0283,  # WM_IME_CONTROL
                        wintypes.WPARAM(0x0002),  # IMC_SETCONVERSIONMODE
                        wintypes.LPARAM(1 if target_korean else 0),
                        0x0002,
                        80,
                        ctypes.byref(out_r),
                    )
            _ime_sync_state["last_observed_kor"] = bool(target_korean)
        except Exception:
            pass

    def _get_live_entry_query() -> str:
        """
        [Windows 한글 IME 조합 중 마지막 글자 실시간 결합 — '바다' 입력 시 '바'만 검색되던 근본 결함 영구 해소]:
        - Tkinter Entry.get()은 Windows 한글 IME가 조합 중인 마지막 음절('다')을 확정(Space/Enter/클릭) 전까지
          반환하지 않아, 화면에는 '바다'가 보이는데 '바' 결과가 뜨고 클릭 순간 목록이 뒤바뀌는 버그가 발생합니다.
        - imm32.ImmGetCompositionStringW(GCS_COMPSTR)로 조합 중인 음절을 실시간 읽어 커서 위치에 합쳐 반환합니다.
        """
        base_txt = s_entry.get()
        if sys.platform != "win32":
            return base_txt
        try:
            hwnd_e = s_entry.winfo_id()
            if not hwnd_e:
                return base_txt
            imm32 = ctypes.windll.imm32
            imm32.ImmGetContext.argtypes = [wintypes.HWND]
            imm32.ImmGetContext.restype = wintypes.HANDLE
            imm32.ImmReleaseContext.argtypes = [wintypes.HWND, wintypes.HANDLE]
            imm32.ImmReleaseContext.restype = wintypes.BOOL
            imm32.ImmGetCompositionStringW.argtypes = [
                wintypes.HANDLE,
                wintypes.DWORD,
                ctypes.c_void_p,
                wintypes.DWORD,
            ]
            imm32.ImmGetCompositionStringW.restype = ctypes.c_long
            himc = imm32.ImmGetContext(hwnd_e)
            if not himc:
                return base_txt
            try:
                cb = imm32.ImmGetCompositionStringW(himc, 0x0008, None, 0)  # GCS_COMPSTR
                if cb and cb > 0:
                    buf = ctypes.create_unicode_buffer(cb // 2 + 1)
                    got = imm32.ImmGetCompositionStringW(himc, 0x0008, buf, cb)
                    if got > 0 and buf.value:
                        try:
                            ins_idx = int(s_entry.index(tk.INSERT))
                        except Exception:
                            ins_idx = len(base_txt)
                        return base_txt[:ins_idx] + buf.value + base_txt[ins_idx:]
            finally:
                imm32.ImmReleaseContext(hwnd_e, himc)
        except Exception:
            pass
        return base_txt

    # 2단 필터 바: [전체] [📄문서] [🖼️사진] [🎬영상] + 우측 안내
    fbar = tk.Frame(outer, bg="#0B1120")
    fbar.pack(fill="x", pady=(0, 3))

    filter_btns: dict[str, tk.Label] = {}
    for f_key, f_txt in (("all", "전체"), ("doc", "📄문서"), ("image", "🖼️사진"), ("video", "🎬영상")):
        fb = tk.Label(
            fbar,
            text=f_txt,
            fg="#E2E8F0",
            bg="#1E293B",
            padx=6,
            pady=1,
            font=("Malgun Gothic", 8, "bold"),
            cursor="hand2",
        )
        fb.pack(side="left", padx=(0, 4))
        fb.bind("<Button-1>", lambda _e, fk=f_key: _switch_filter(fk))
        filter_btns[f_key] = fb

    def _resolve_ui2_trial_text(stage_name: str = "small") -> str:
        if callable(get_trial_badge_summary):
            try:
                ts = get_trial_badge_summary() or {}
                hint = str(ts.get("ui2_hint") or "").strip()
                if hint:
                    return hint
            except Exception:
                pass
        return "✨ 자율크기 검색 평생 0원"

    trial_lbl = tk.Label(
        fbar,
        text=_resolve_ui2_trial_text(st_state["stage"]),
        fg="#FDE047",
        bg="#0B1120",
        font=("Malgun Gothic", 8, "bold"),
    )
    trial_lbl.pack(side="right")

    # 2.5단 스마트 알림 슬롯 (글자 많은 영상 감지 시 👻 아기귀신 1줄 메시지 자동 노출)
    smart_tip_frame = tk.Frame(outer, bg="#0B1120")
    smart_tip_frame.pack(fill="x")

    # 3단 결과 영역
    body_frame = tk.Frame(outer, bg="#0B1120")
    body_frame.pack(fill="both", expand=True)

    def _resize_for_stage(activate: bool = True) -> None:
        st_now = st_state["stage"]
        r3 = compute_ghost_search_window_3stage_rect(
            st_now,
            pt_x,
            pt_y,
            work_area=work_area,
            margin_px=16,
            custom_height=st_state.get("custom_h"),
        )
        rw_t = int(r3["width"])
        rh_t = int(r3["height"])
        tx = int(r3["x"])
        ty = int(r3["y"])
        # 사용자가 드래그로 옮겨놓은 위치가 있으면 열려 있는 동안 확장/필터 전환 시 옮긴 자리를 유지
        user_pos = st_state.get("user_pos")
        if isinstance(user_pos, tuple) and len(user_pos) == 2:
            ux, uy = int(user_pos[0]), int(user_pos[1])
            if sys.platform == "win32":
                try:
                    u32_r = ctypes.windll.user32
                    vx = int(u32_r.GetSystemMetrics(76))  # SM_XVIRTUALSCREEN
                    vy = int(u32_r.GetSystemMetrics(77))  # SM_YVIRTUALSCREEN
                    vw = int(u32_r.GetSystemMetrics(78)) or 1920  # SM_CXVIRTUALSCREEN
                    vh = int(u32_r.GetSystemMetrics(79)) or 1080  # SM_CYVIRTUALSCREEN
                    tx = max(vx + 4, min(ux, vx + vw - rw_t - 4))
                    ty = max(vy + 4, min(uy, vy + vh - rh_t - 4))
                except Exception:
                    tx, ty = ux, uy
            else:
                tx, ty = ux, uy
        if activate:
            was_mouse_down[0] = True
        apply_win_topmost(win, tx, ty, rw_t, rh_t, activate=activate)
        if activate:
            try:
                s_entry.focus_force()
            except Exception:
                pass

    # [상단 헤더·필터바 드래그 자유 이동 (멀티모니터 지원 · 바깥 클릭 오닫힘 0%)]:
    # 버튼·검색 입력칸을 제외한 헤더(로고·배지·빈 공간)·필터바 빈 공간을 좌클릭 드래그해 원하는 위치로 즉시 이동합니다.
    _drag_state: dict[str, Any] = {"active": False, "dx": 0, "dy": 0, "w": 520, "h": 330, "hwnd": 0}

    def _on_drag_start(event) -> None:
        try:
            if current_win[0] is not win or not win.winfo_exists():
                return
            is_hovered[0] = True
            was_mouse_down[0] = True
            opened_at[0] = time.time()
            if isinstance(ui_dragging_ref, list) and ui_dragging_ref:
                ui_dragging_ref[0] = True
            wx = int(win.winfo_x())
            wy = int(win.winfo_y())
            ww = max(120, int(win.winfo_width() or 520))
            wh = max(80, int(win.winfo_height() or 330))
            hwnd_d = 0
            if sys.platform == "win32":
                try:
                    u32_d = ctypes.windll.user32
                    wid_d = win.winfo_id()
                    hwnd_d = int(u32_d.GetParent(wid_d) or wid_d) if wid_d else 0
                    if hwnd_d and u32_d.IsWindow(hwnd_d):
                        rc_d = wintypes.RECT()
                        if u32_d.GetWindowRect(hwnd_d, ctypes.byref(rc_d)) and rc_d.right > rc_d.left and rc_d.bottom > rc_d.top:
                            wx, wy = int(rc_d.left), int(rc_d.top)
                            ww, wh = int(rc_d.right - rc_d.left), int(rc_d.bottom - rc_d.top)
                except Exception:
                    hwnd_d = 0
            _drag_state["active"] = True
            _drag_state["dx"] = int(event.x_root) - wx
            _drag_state["dy"] = int(event.y_root) - wy
            _drag_state["w"] = ww
            _drag_state["h"] = wh
            _drag_state["hwnd"] = hwnd_d
        except Exception:
            pass

    def _on_drag_motion(event) -> None:
        if not _drag_state.get("active"):
            return
        try:
            if current_win[0] is not win or not win.winfo_exists():
                _drag_state["active"] = False
                return
            is_hovered[0] = True
            was_mouse_down[0] = True
            nx = int(event.x_root) - int(_drag_state["dx"])
            ny = int(event.y_root) - int(_drag_state["dy"])
            ww = int(_drag_state["w"])
            wh = int(_drag_state["h"])
            if sys.platform == "win32":
                try:
                    u32_m = ctypes.windll.user32
                    vx = int(u32_m.GetSystemMetrics(76))
                    vy = int(u32_m.GetSystemMetrics(77))
                    vw = int(u32_m.GetSystemMetrics(78)) or 1920
                    vh = int(u32_m.GetSystemMetrics(79)) or 1080
                    nx = max(vx - ww + 100, min(nx, vx + vw - 100))
                    ny = max(vy, min(ny, vy + vh - 48))
                except Exception:
                    pass
            st_state["user_pos"] = (nx, ny)
            hwnd_d = int(_drag_state.get("hwnd") or 0)
            if sys.platform == "win32" and hwnd_d:
                try:
                    u32_m = ctypes.windll.user32
                    # HWND_TOPMOST(-1), SWP_NOSIZE(0x0001) | SWP_NOACTIVATE(0x0010) | SWP_SHOWWINDOW(0x0040)
                    u32_m.SetWindowPos(hwnd_d, -1, nx, ny, 0, 0, 0x0001 | 0x0010 | 0x0040)
                except Exception:
                    win.geometry(f"+{nx:+d}+{ny:+d}")
            else:
                win.geometry(f"+{nx:+d}+{ny:+d}")
            if isinstance(win_rect_ref, list) and win_rect_ref:
                win_rect_ref[0] = (nx, ny, nx + ww, ny + wh)
        except Exception:
            pass

    def _on_drag_end(_event=None) -> None:
        if not _drag_state.get("active"):
            return
        _drag_state["active"] = False
        opened_at[0] = time.time()
        was_mouse_down[0] = True
        is_hovered[0] = True
        if isinstance(ui_dragging_ref, list) and ui_dragging_ref:
            ui_dragging_ref[0] = False
        user_p = st_state.get("user_pos")
        if isinstance(user_p, tuple) and len(user_p) == 2:
            try:
                win.geometry(f"+{int(user_p[0]):+d}+{int(user_p[1]):+d}")
            except Exception:
                pass

    _drag_widgets: list[Any] = [hdr, title_badge, fbar, trial_lbl, outer]
    if ghost_symbol_photo is not None:
        try:
            ic_lbl.config(cursor="fleur")
            _drag_widgets.append(ic_lbl)
        except Exception:
            pass
    for _dw in _drag_widgets:
        try:
            if _dw in (hdr, fbar, trial_lbl):
                _dw.config(cursor="fleur")
            _dw.bind("<ButtonPress-1>", _on_drag_start, add="+")
            _dw.bind("<B1-Motion>", _on_drag_motion, add="+")
            _dw.bind("<ButtonRelease-1>", _on_drag_end, add="+")
        except Exception:
            pass

    def _set_explicit_stage(target_st: str) -> str:
        is_hovered[0] = True
        opened_at[0] = time.time()
        was_mouse_down[0] = True
        is_large = target_st == "large"
        st_state["mode"] = "large" if is_large else "compact"
        st_state["manual_stage"] = "large" if is_large else None
        st_state["stage"] = "large" if is_large else "small"
        st_state["custom_h"] = None if is_large else 330
        record_feature_telemetry(f"ghost_search_window_{'large' if is_large else 'small'}")
        _render_search_results()
        _resize_for_stage(activate=True)
        return "break"

    def _toggle_window_mode(_e=None) -> str:
        return _set_explicit_stage("small" if st_state["mode"] == "large" else "large")

    def _switch_filter(new_flt: str) -> None:
        is_hovered[0] = True
        st_state["video_ocr_modal_rec"] = None
        st_state["filter"] = new_flt
        st_state["sel_idx"] = 0
        _render_search_results()
        _resize_for_stage(activate=False)

    def _open_video_ocr_extractor(rec: dict[str, Any]) -> None:
        """선택한 동영상에서 화면 속 글자 전체를 추출하여 바로 복사·커서 주입할 수 있는 인라인 뷰를 엽니다."""
        is_hovered[0] = True
        opened_at[0] = time.time()
        st_state["video_ocr_modal_rec"] = rec
        st_state["video_ocr_copied_msg"] = ""
        cached_txt = str(rec.get("video_ocr_full") or "").strip()
        if cached_txt and len(cached_txt.splitlines()) >= 2:
            st_state["video_ocr_loading"] = False
            st_state["video_ocr_result_text"] = cached_txt
            if st_state["mode"] == "compact" and st_state["stage"] == "small":
                st_state["stage"] = "medium"
                st_state["custom_h"] = 460
            _render_search_results()
            _resize_for_stage(activate=False)
            return

        st_state["video_ocr_loading"] = True
        st_state["video_ocr_result_text"] = "👻 아기귀신이 영상 구간별 화면 글자(자막·발표자료·간판)를 싹 긁어오는 중이에요..."
        if st_state["mode"] == "compact" and st_state["stage"] == "small":
            st_state["stage"] = "medium"
            st_state["custom_h"] = 460
        _render_search_results()
        _resize_for_stage(activate=False)

        target_fp = str(rec.get("file_path") or "").strip()

        def _bg_job() -> None:
            res = _fetch_video_ocr_from_zcore(target_fp)
            if not res.get("ok"):
                err_s = str(res.get("error") or "UNKNOWN")
                ft = f"⚠️ 영상 글자 추출에 실패했습니다 ({err_s})."
            else:
                ft = str(res.get("fullText") or "").strip()
                if not ft:
                    ft = "이 영상에서는 추출 가능한 화면 글자(자막·발표자료·표지판)가 감지되지 않았어요."
                else:
                    rec["video_ocr_full"] = ft
                    rec["video_ocr_lines"] = int(res.get("lineCount") or len(ft.splitlines()))
            st_state["bg_ocr_done_payload"] = ft
            st_state["bg_ui_dirty"] = True

        threading.Thread(target=_bg_job, daemon=True).start()

    def _copy_video_ocr_text(txt: str) -> None:
        if not txt or st_state.get("video_ocr_loading"):
            return
        try:
            root.clipboard_clear()
            root.clipboard_append(txt)
            root.update_idletasks()
            st_state["video_ocr_copied_msg"] = "✓ 클립보드에 전체 복사 완료!"
            _render_search_results()
        except Exception:
            pass

    def _render_search_results() -> None:
        for ch in smart_tip_frame.winfo_children():
            ch.destroy()
        for ch in body_frame.winfo_children():
            ch.destroy()
        thumb_refs.clear()

        flt_now = st_state["filter"]
        for k, b in filter_btns.items():
            b.config(fg="#0B1120" if k == flt_now else "#E2E8F0", bg="#5EEAD4" if k == flt_now else "#1E293B")

        # 동영상 OCR 추출 결과 전용 뷰가 열려 있는 경우
        active_vid_rec = st_state.get("video_ocr_modal_rec")
        if active_vid_rec is not None:
            v_title = Path(str(active_vid_rec.get("file_path") or "동영상")).name
            hdr_box = tk.Frame(body_frame, bg="#0F172A", highlightbackground="#2DD4BF", highlightthickness=1, padx=8, pady=6)
            hdr_box.pack(fill="x", pady=(2, 6))
            tk.Label(
                hdr_box,
                text=f"📝 영상 속 글자 뽑기: {v_title[:42]}",
                fg="#5EEAD4",
                bg="#0F172A",
                font=("Malgun Gothic", 9, "bold"),
            ).pack(side="left")
            back_b = tk.Label(
                hdr_box,
                text="← 검색 목록으로",
                fg="#E2E8F0",
                bg="#1E293B",
                padx=6,
                pady=2,
                font=("Malgun Gothic", 8, "bold"),
                cursor="hand2",
            )
            back_b.pack(side="right")
            back_b.bind(
                "<Button-1>",
                lambda _e: (st_state.update({"video_ocr_modal_rec": None}), _render_search_results()),
            )

            txt_box = tk.Text(
                body_frame,
                height=11,
                fg="#F8FAFC",
                bg="#0F172A",
                insertbackground="#5EEAD4",
                relief="flat",
                padx=8,
                pady=6,
                wrap="word",
                font=("Malgun Gothic", 9),
            )
            txt_box.pack(fill="both", expand=True, pady=(0, 6))
            txt_box.insert("1.0", st_state.get("video_ocr_result_text") or "")
            txt_box.config(state="disabled")

            act_row = tk.Frame(body_frame, bg="#0B1120")
            act_row.pack(fill="x")
            res_str = str(st_state.get("video_ocr_result_text") or "")
            can_copy = (
                (not st_state.get("video_ocr_loading"))
                and ("감지되지 않았어요" not in res_str)
                and ("실패했습니다" not in res_str)
            )
            if can_copy:
                cp_b = tk.Label(
                    act_row,
                    text=st_state.get("video_ocr_copied_msg") or "📋 추출된 글자 전체 복사",
                    fg="#0B1120",
                    bg="#FDE047",
                    padx=10,
                    pady=4,
                    font=("Malgun Gothic", 9, "bold"),
                    cursor="hand2",
                )
                cp_b.pack(side="left", padx=(0, 6))
                cp_b.bind("<Button-1>", lambda _e, t=res_str: _copy_video_ocr_text(t))

                ins_b = tk.Label(
                    act_row,
                    text="📎 작업 중이던 커서에 바로 붙여넣기",
                    fg="#0B1120",
                    bg="#2DD4BF",
                    padx=10,
                    pady=4,
                    font=("Malgun Gothic", 9, "bold"),
                    cursor="hand2",
                )
                ins_b.pack(side="left")
                ins_b.bind("<Button-1>", lambda _e, t=res_str: paste_to_target(text_val=t, file_path=""))
            return

        q = _get_live_entry_query().strip()
        vid_ocr_map = _load_local_video_ocr_by_name(
            on_async_updated=lambda: st_state.update({"bg_ui_dirty": True})
        )

        pool: list[dict] = []
        seen_fpaths: set[str] = set()
        # [탐색기·바탕화면 선택 파일 [1]번 최상단 고정]: 창 열기 시 1회 캐싱한 레코드를 즉시 편입하되 삭제된 파일은 즉시 제외
        if pinned_sel_rec is not None and pinned_sel_file and _fast_ui2_file_exists(pinned_sel_file):
            seen_fpaths.add(pinned_sel_file.lower())
            pool.append(pinned_sel_rec)
        local_files_ready = True
        if callable(peek_lightweight_local_files):
            local_files_list, local_files_ready = peek_lightweight_local_files()
            if not local_files_ready and callable(refresh_lightweight_local_files_async) and not st_state.get("bg_scan_scheduled"):
                st_state["bg_scan_scheduled"] = True

                def _on_bg_files_ready() -> None:
                    st_state["bg_scan_scheduled"] = False
                    st_state["bg_ui_dirty"] = True

                refresh_lightweight_local_files_async(_on_bg_files_ready)
        else:
            local_files_list = get_lightweight_local_files()

        # [UI 스레드 O(1) 파일명 셋 캐시]: 14,000건에 대해 매 타수마다 Path() 객체를 생성하던 병목 제거
        _lf_id = id(local_files_list)
        _lf_len = len(local_files_list)
        if _local_names_cache["list_id"] == _lf_id and _local_names_cache["list_len"] == _lf_len:
            local_file_names_low = _local_names_cache["names"]
        else:
            _new_names: set[str] = set()
            for _fl in local_files_list:
                _fp0 = _fl.get("file_path")
                if _fp0:
                    _s0 = str(_fp0)
                    _bn = _s0.rsplit("\\", 1)[-1]
                    if "/" in _bn:
                        _bn = _bn.rsplit("/", 1)[-1]
                    if _bn:
                        _new_names.add(_bn.lower())
            _local_names_cache["list_id"] = _lf_id
            _local_names_cache["list_len"] = _lf_len
            _local_names_cache["names"] = _new_names
            local_file_names_low = _new_names

        _CLIP_FNAME_RE = re.compile(
            r"^[^\r\n\\/:*?\"<>|]{1,180}\.(?:jpg|jpeg|jfif|png|webp|gif|bmp|heic|heif|mp4|mov|avi|mkv|wmv|pdf|docx?|xlsx?|pptx?|hwpx?|txt|csv)$",
            re.IGNORECASE,
        )
        seen_clip_texts: set[str] = set()
        for rec in reversed(global_ai_history):
            fp_hist = str(rec.get("file_path") or "").strip()
            if fp_hist:
                fp_low = fp_hist.lower()
                if fp_low in seen_fpaths:
                    continue
                if not _fast_ui2_file_exists(fp_hist):
                    continue
                seen_fpaths.add(fp_low)
                pool.append(rec)
                continue
            # [가짜 JPG 파일 오인 및 클립보드 텍스트 중복 노출 원천 차단]:
            # 귀신라벨링 등으로 복사한 파일명 문자열('260525_193256_공원길_가로수.jpg')이
            # file_path 없는 텍스트 기록으로 여러 번 중복 쌓여 실제 사진 파일처럼 보이던 버그 근본 교정!
            raw_clip_t = str(rec.get("text") or "").strip()
            if not raw_clip_t:
                continue
            norm_clip_t = re.sub(r"\s+", " ", raw_clip_t).lower()
            if norm_clip_t in seen_clip_texts:
                continue
            seen_clip_texts.add(norm_clip_t)
            if rec.get("kind", "text") == "text" and _CLIP_FNAME_RE.match(raw_clip_t):
                # 내 PC 실제 파일 목록에 같은 이름의 파일이 있으면 가짜 텍스트 대신 실제 파일(미리보기 포함)만 표시
                if raw_clip_t.lower() in local_file_names_low:
                    continue
                labeled_rec = dict(rec)
                labeled_rec["text"] = f"[📋 복사한 이름] {raw_clip_t}"
                labeled_rec["_is_copied_filename_text"] = True
                pool.append(labeled_rec)
                continue
            pool.append(rec)

        # [봉인 존중 연동] 사용자가 더블클릭·우클릭으로 직접 압축을 푼 직후 등록된 문서·본문 스니펫 0.05초 즉시 편입 (30초 존재 캐시로 UI I/O 블로킹 0%)
        try:
            _now_ex = time.time()
            for erec in _load_extracted_queue_fast()[:30]:
                efp = str(erec.get("filePath") or "").strip()
                if not efp or efp.lower() in seen_fpaths:
                    continue
                _ex_hit = _ext_exists_cache.get(efp)
                if _ex_hit is not None and (_now_ex - _ex_hit[0]) < 30.0:
                    _efp_ok = _ex_hit[1]
                else:
                    _efp_ok = os.path.exists(efp)
                    _ext_exists_cache[efp] = (_now_ex, _efp_ok)
                if not _efp_ok:
                    continue
                seen_fpaths.add(efp.lower())
                efn = str(erec.get("fileName") or Path(efp).name)
                esnip = str(erec.get("textSnippet") or "").strip()
                ext_sfx = Path(efp).suffix.lower()
                ekind = (
                    "image"
                    if ext_sfx in (".png", ".jpg", ".jpeg", ".jfif", ".webp", ".gif", ".bmp", ".heic", ".heif")
                    else ("video" if ext_sfx in (".mp4", ".mov", ".mkv", ".avi", ".webm", ".wmv") else "doc")
                )
                pool.append({
                    "kind": ekind,
                    "file_path": efp,
                    "img_path": efp if ekind == "image" else "",
                    "ts": float(erec.get("indexedTs") or time.time()),
                    "text": f"📦 {efn}" + (f" — {esnip}" if esnip else f" ({Path(efp).parent.name})"),
                })
        except Exception:
            pass

        def _kind_matches_filter(k_val: Any) -> bool:
            if flt_now == "all":
                return True
            if flt_now == "doc":
                return k_val in ("text", "doc")
            if flt_now == "image":
                return k_val == "image"
            if flt_now == "video":
                return k_val == "video"
            return True

        def _enrich_video_rec(frec_in: dict) -> dict:
            if frec_in.get("kind") != "video" or not vid_ocr_map:
                return frec_in
            v_fname = frec_in.get("_fname")
            if not v_fname:
                _raw_vp = str(frec_in.get("file_path") or "")
                v_fname = _raw_vp.rsplit("\\", 1)[-1].rsplit("/", 1)[-1]
            ocr_info = vid_ocr_map.get(v_fname) if v_fname else None
            if ocr_info and ocr_info.get("fullText"):
                enriched = dict(frec_in)
                enriched["video_ocr_full"] = ocr_info["fullText"]
                enriched["video_ocr_lines"] = ocr_info["lineCount"]
                flat_ocr = re.sub(r"\[\d{2}:\d{2}\]\s*", "", ocr_info["fullText"]).replace("\n", " · ")
                enriched["text"] = f"{frec_in.get('text', '')} | 📝화면글자: {flat_ocr[:180]}"
                return enriched
            return frec_in

        if flt_now != "all":
            pool = [r for r in pool if _kind_matches_filter(r.get("kind"))]

        if not q:
            # [무검색어(열기·필터전환·크게/작게 토글) O(1) Top-K 패스트패스]:
            # 이미 최신순 정렬된 local_files_list(최대 3.6만 건) 전체를 매 클릭마다 복사·순회하지 않고 상위 표시분(최대 12건)만 0.2ms 내에 즉시 추출!
            for frec in local_files_list:
                if len(pool) >= 12:
                    break
                if not _kind_matches_filter(frec.get("kind")):
                    continue
                fp_loc = str(frec.get("file_path") or "")
                if fp_loc and fp_loc.lower() in seen_fpaths:
                    continue
                pool.append(_enrich_video_rec(frec))
        else:
            for frec in local_files_list:
                if not _kind_matches_filter(frec.get("kind")):
                    continue
                fp_loc = str(frec.get("file_path") or "")
                if fp_loc and fp_loc.lower() in seen_fpaths:
                    continue
                pool.append(_enrich_video_rec(frec))

        matched: list[tuple[float, dict]] = []
        if q:
            q_exp = _expand_camel_search_text(q)
            q_terms = [t for t in re.split(r"\s+", q_exp) if t]
            q_low = q.lower()
            has_explicit_chosung = bool(re.search(r"[ㄱ-ㅎ]", q_low))
            q_cho = extract_chosung(q_low) if has_explicit_chosung else ""
            q_kor_alt = eng_to_kor(q) if re.search(r"[A-Za-z]", q) else ""
            q_eng_alt = kor_to_eng(q) if re.search(r"[가-힣ㄱ-ㅎㅏ-ㅣ]", q) else ""
            q_kor_alt_low = q_kor_alt.lower() if q_kor_alt else ""
            q_eng_alt_low = q_eng_alt.lower() if (q_eng_alt and len(q_eng_alt) >= 2) else ""
            for idx_p, r in enumerate(pool):
                raw_t = r.get("text", "")
                cached_low = r.get("_search_low")
                if cached_low is None or r.get("_search_src_len") != len(raw_t):
                    clean_t = clean_ocr_noise(raw_t) if r.get("kind") == "image" else raw_t
                    cached_low = clean_t.lower()
                    r["_search_low"] = cached_low
                    r["_search_exp"] = _expand_camel_search_text(clean_t)
                    r["_search_src_len"] = len(raw_t)
                    r.pop("_search_cho", None)
                t_low = cached_low
                t_exp = r.get("_search_exp") or t_low
                fp_stem_low = r.get("_stem_low")
                if fp_stem_low is None:
                    _fp_any = r.get("file_path") or r.get("img_path") or ""
                    if _fp_any:
                        _bn_s = str(_fp_any).rsplit("\\", 1)[-1]
                        if "/" in _bn_s:
                            _bn_s = _bn_s.rsplit("/", 1)[-1]
                        _dot_s = _bn_s.rfind(".")
                        fp_stem_raw = _bn_s[:_dot_s] if _dot_s > 0 else _bn_s
                        fp_stem_low = fp_stem_raw.lower()
                        fp_stem_exp = _expand_camel_search_text(fp_stem_raw)
                    else:
                        fp_stem_low = ""
                        fp_stem_exp = ""
                    r["_stem_low"] = fp_stem_low
                    r["_stem_exp"] = fp_stem_exp
                else:
                    fp_stem_exp = r.get("_stem_exp") or fp_stem_low
                sc = 0.0
                if fp_stem_low and (q_low in fp_stem_low or (len(q_terms) > 1 and all(tm in fp_stem_exp for tm in q_terms))):
                    sc = 1.15
                elif q_low in t_low or (len(q_terms) > 1 and all(tm in t_exp for tm in q_terms)):
                    sc = 1.0
                elif q_terms and all(tm in fp_stem_exp for tm in q_terms):
                    sc = 1.08
                elif q_terms and all(tm in t_exp for tm in q_terms):
                    sc = 0.95
                elif q_cho:
                    t_cho = r.get("_search_cho")
                    if t_cho is None:
                        t_cho = extract_chosung(t_low)
                        r["_search_cho"] = t_cho
                    if q_cho in t_cho:
                        sc = 1.0
                elif q_kor_alt_low and q_kor_alt_low in t_low:
                    sc = 0.85
                elif q_eng_alt_low and q_eng_alt_low in t_low:
                    sc = 0.85
                if sc > 0:
                    matched.append((sc - idx_p * 0.0001, r))
            if matched:
                matched.sort(key=lambda x: x[0], reverse=True)

        has_rich = any(m[1].get("kind") in ("image", "doc", "video") for m in matched[:5])
        auto_stage, _auto_slim_h = resolve_ghost_search_auto_stage(
            mode=st_state["mode"],
            has_query=bool(q),
            matched_count=len(matched) if q else len(pool[:5]),
            has_rich_preview=has_rich,
        )
        # [타이핑 중 창 크기 요요(커졌다 작아졌다 반복) 원천 차단]:
        # 1) 소형(small) 상태에서는 결과 건수 변동에 따라 높이를 매 글자마다 들썩이지 않고 330px로 안정 유지.
        # 2) 검색어 입력 중(q != "") 이미 medium(960x640)으로 확장된 상태라면 한글 조합 중간(0건) 등에
        #    절대 small로 다시 쪼그라들지 않고(래치 유지) 검색어를 완전히 비웠을 때만 small로 복귀.
        # 3) small -> medium 자동 확장은 타이핑이 멈춘 뒤(260ms) 단 1회만 부드럽게 실행.
        stable_small_h = 330
        prev_stage = st_state["stage"]
        prev_h = st_state.get("custom_h")
        pending_auto_expand = False
        if st_state.get("manual_stage") in ("large", "medium"):
            st_state["stage"] = st_state["manual_stage"]
            st_state["custom_h"] = None
        elif st_state["mode"] == "large":
            st_state["stage"] = "large"
            st_state["custom_h"] = None
        elif not q:
            st_state["stage"] = "small"
            st_state["custom_h"] = stable_small_h
        else:
            if prev_stage == "medium":
                # 이미 중형이면 입력 도중 절대 소형으로 축소하지 않음 (요요 0%)
                st_state["stage"] = "medium"
                st_state["custom_h"] = None
            elif auto_stage == "medium":
                since_type = time.time() - float(st_state.get("last_typing_ts") or 0.0)
                if since_type >= 0.25:
                    st_state["stage"] = "medium"
                    st_state["custom_h"] = None
                    record_feature_telemetry("ghost_search_window_medium")
                else:
                    # 아직 타이핑 중이면 현재 소형(520x330)을 유지하고 입력 멈춤 260ms 후 1회만 확장 예약
                    st_state["stage"] = "small"
                    st_state["custom_h"] = stable_small_h
                    pending_auto_expand = True
            else:
                st_state["stage"] = "small"
                st_state["custom_h"] = stable_small_h

        prev_rjob = st_state.get("resize_job")
        if prev_rjob is not None:
            try:
                win.after_cancel(prev_rjob)
            except Exception:
                pass
            st_state["resize_job"] = None
        if pending_auto_expand and current_win[0] is win:
            def _apply_delayed_auto_expand() -> None:
                st_state["resize_job"] = None
                if current_win[0] is win:
                    _render_search_results()
            st_state["resize_job"] = win.after(260, _apply_delayed_auto_expand)

        st_now = st_state["stage"]
        cur_h = st_state.get("custom_h")
        is_lg_mode = st_state["mode"] == "large"
        toggle_mode_btn.config(
            text="⤡ 작게" if is_lg_mode else "⤢ 크게(갤러리)",
            fg="#0B1120" if is_lg_mode else "#5EEAD4",
            bg="#2DD4BF" if is_lg_mode else "#1E293B",
        )

        max_cnt = 5 if st_now == "small" else (8 if st_now == "medium" else 10)
        snip_len = 34 if st_now == "small" else (46 if st_now == "medium" else 32)

        if not q:
            candidates = pool[:max_cnt]
            trial_lbl.config(
                text=_resolve_ui2_trial_text(st_now),
                fg="#FDE047",
            )
        elif matched:
            candidates = [m[1] for m in matched[:max_cnt]]
            trial_lbl.config(
                text=f"🔍 '{q[:8]}' {len(matched)}건" + (" · 우측 상세미리보기" if st_now == "medium" else ""),
                fg="#5EEAD4",
            )
        else:
            # [무관한 파일 오노출 원천 차단]: 검색어(q)와 일치하는 파일이 0건일 때 최근 파일 목록(pool[:max_cnt])을
            # 검색 결과처럼 억지로 띄우지 않고, 깔끔한 '일치 결과 없음' 빈 상태를 표시합니다.
            candidates = []
            trial_lbl.config(text=f"🔍 '{q[:10]}' 일치하는 파일 없음", fg="#FBBF24")

        # 🔌 [외장/USB 드라이브 생애 1회 질문 · 인덱싱 중 탈착 금지 · 완료 안내 배너]:
        ext_banner = get_external_drive_banner() if callable(get_external_drive_banner) else None
        if isinstance(ext_banner, dict):
            ext_st = str(ext_banner.get("status") or "")
            ext_drv = str(ext_banner.get("drive") or "")
            if ext_st == "indexing":
                ext_pct = int(ext_banner.get("pct") or 10)
                ext_min = int(ext_banner.get("est_min") or 1)
                ext_bar = tk.Frame(smart_tip_frame, bg="#2A1C08", highlightbackground="#F59E0B", highlightthickness=1, padx=6, pady=4)
                ext_bar.pack(fill="x", pady=(0, 4))
                tk.Label(
                    ext_bar,
                    text=f"⏳ 외장({ext_drv}) 인덱싱 중 ({ext_pct}% · 약 {ext_min}분 소요) — 완료 안내 전까지 절대 USB를 뽑지 마세요!",
                    fg="#FDE047",
                    bg="#2A1C08",
                    font=("Malgun Gothic", 8, "bold"),
                ).pack(side="left")
            elif ext_st == "completed":
                ext_cnt = int(ext_banner.get("count") or 0)
                ext_bar = tk.Frame(smart_tip_frame, bg="#0D2824", highlightbackground="#10B981", highlightthickness=1, padx=6, pady=4)
                ext_bar.pack(fill="x", pady=(0, 4))
                tk.Label(
                    ext_bar,
                    text=f"✅ 외장({ext_drv} · {ext_cnt}건) 인덱싱 완료! 캐시는 내 PC에만 안전 보관되었으며 이제 뽑으셔도 됩니다.",
                    fg="#5EEAD4",
                    bg="#0D2824",
                    font=("Malgun Gothic", 8, "bold"),
                ).pack(side="left")
            elif ext_st == "prompt":
                ext_vid = str(ext_banner.get("vol_id") or "")
                ext_files = int(ext_banner.get("est_files") or 0)
                ext_min = int(ext_banner.get("est_min") or 1)
                ext_bar = tk.Frame(smart_tip_frame, bg="#132A2E", highlightbackground="#2DD4BF", highlightthickness=1, padx=6, pady=4)
                ext_bar.pack(fill="x", pady=(0, 4))

                def _on_ext_decide(dec_val: str, vid_target: str = ext_vid) -> None:
                    is_hovered[0] = True
                    opened_at[0] = time.time()
                    if callable(decide_external_drive):
                        decide_external_drive(vid_target, dec_val)
                    _render_search_results()

                btn_no = tk.Label(
                    ext_bar,
                    text="제외(다시 묻지 않음)",
                    fg="#CBD5E1",
                    bg="#1E293B",
                    padx=6,
                    pady=1,
                    font=("Malgun Gothic", 8, "bold"),
                    cursor="hand2",
                )
                btn_no.pack(side="right", padx=(3, 0))
                btn_no.bind("<Button-1>", lambda _e: _on_ext_decide("excluded"))

                btn_yes = tk.Label(
                    ext_bar,
                    text="검색에 포함",
                    fg="#0B1120",
                    bg="#2DD4BF",
                    padx=6,
                    pady=1,
                    font=("Malgun Gothic", 8, "bold"),
                    cursor="hand2",
                )
                btn_yes.pack(side="right", padx=(4, 0))
                btn_yes.bind("<Button-1>", lambda _e: _on_ext_decide("included"))

                tk.Label(
                    ext_bar,
                    text=f"🔌 외장({ext_drv} · 약 {ext_files}건)도 검색할까요? (약 {ext_min}분 · 완료 전 탈착 금지)",
                    fg="#5EEAD4",
                    bg="#132A2E",
                    font=("Malgun Gothic", 8, "bold"),
                ).pack(side="left")

        # 👻 [글자 많은 영상 감지 메시지]: 노출된 영상 중 화면 글자(OCR)가 있거나 영상 필터일 때 1줄 팁 표시!
        rich_ocr_vid = next(
            (c for c in candidates if c.get("kind") == "video" and len(str(c.get("video_ocr_full") or "")) >= 12),
            None,
        )
        any_vid = next((c for c in candidates if c.get("kind") == "video"), None)
        if rich_ocr_vid is not None:
            tip_bar = tk.Frame(smart_tip_frame, bg="#132A2E", highlightbackground="#2DD4BF", highlightthickness=1, padx=6, pady=3)
            tip_bar.pack(fill="x", pady=(0, 4))
            tk.Label(
                tip_bar,
                text="👻 영상 속 화면 글자 발견! 영상을 클릭하면 하단에 추출된 글자가 바로 표시됩니다!",
                fg="#5EEAD4",
                bg="#132A2E",
                font=("Malgun Gothic", 8, "bold"),
            ).pack(side="left")
        elif flt_now == "video" and any_vid is not None:
            tip_bar = tk.Frame(smart_tip_frame, bg="#132A2E", highlightbackground="#334155", highlightthickness=1, padx=6, pady=3)
            tip_bar.pack(fill="x", pady=(0, 4))
            tk.Label(
                tip_bar,
                text="👻 강의·회의·자막 영상은 클릭하면 화면 속 글자가 하단에 바로 표시되어 즉시 복사할 수 있어요!",
                fg="#5EEAD4",
                bg="#132A2E",
                font=("Malgun Gothic", 8, "bold"),
            ).pack(side="left")

        if st_state.get("initial_mapped") and (prev_stage != st_now or prev_h != cur_h) and current_win[0] is win:
            _resize_for_stage(activate=False)

        st_state["items"] = candidates
        locked_fp = str(st_state.get("selected_fp_lock") or "").strip().lower()
        if locked_fp and candidates:
            for _ci, _crec in enumerate(candidates):
                _cfp = str(_crec.get("img_path") or _crec.get("file_path") or "").strip().lower()
                if _cfp and _cfp == locked_fp:
                    st_state["sel_idx"] = _ci
                    break
        st_state["sel_idx"] = min(st_state["sel_idx"], max(0, len(candidates) - 1))

        if not candidates:
            empty_msg = (
                "⚡ 내 컴퓨터 최근 파일을 불러오는 중..."
                if not local_files_ready
                else (
                    f"🔍 '{q[:20]}'와(과) 일치하는 파일이 없습니다.\n다른 검색어나 상단 탭(전체 · 문서 · 사진 · 영상)을 확인해 보세요."
                    if q
                    else "표시할 항목이 없습니다."
                )
            )
            tk.Label(
                body_frame,
                text=empty_msg,
                fg="#5EEAD4" if not local_files_ready else "#94A3B8",
                bg="#0B1120",
                font=("Malgun Gothic", 9),
                justify="center",
            ).pack(pady=28)
            return

        list_parent = body_frame
        preview_pane = None
        if st_now == "medium":
            # [우측 상세 미리보기 고정 배치]: 우측 상세 미리보기 패널(width=380)을 먼저 side="right"로 고정 배치하고
            # 좌측에는 검색 결과 목록만 깔끔하게 배치하여 960x640 확장 시 우측에 큰 이미지·문서 상세 미리보기가 즉시 펼쳐지게 함
            preview_pane = tk.Frame(
                body_frame,
                bg="#0F172A",
                highlightbackground="#2DD4BF",
                highlightthickness=1,
                padx=10,
                pady=8,
                width=380,
            )
            preview_pane.pack(side="right", fill="y", padx=(6, 0))
            preview_pane.pack_propagate(False)

            list_parent = tk.Frame(body_frame, bg="#0B1120")
            list_parent.pack(side="left", fill="both", expand=True)
        elif st_now == "large":
            list_parent.grid_columnconfigure(0, weight=1, uniform="gcol")
            list_parent.grid_columnconfigure(1, weight=1, uniform="gcol")

        pending_thumb_paths: list[str] = []
        for idx_c, rec in enumerate(candidates):
            is_sel = idx_c == st_state["sel_idx"]
            c_bg = "#1E293B" if is_sel else "#0F172A"
            b_col = "#2DD4BF" if is_sel else "#334155"
            card = tk.Frame(
                list_parent,
                bg=c_bg,
                highlightbackground=b_col,
                highlightthickness=1,
                padx=6,
                pady=4,
                cursor="hand2",
            )
            if st_now == "large":
                card.grid(row=idx_c // 2, column=idx_c % 2, padx=3, pady=3, sticky="nsew")
            else:
                card.pack(fill="x", pady=2)

            kind = rec.get("kind", "text")
            icon_ch = "🖼️" if kind == "image" else ("🎬" if kind == "video" else ("📄" if kind == "doc" else "📋"))
            rel_t = format_rel_time(rec.get("ts", time.time()))
            raw_txt = rec.get("text", "")
            disp_txt = _mask_sensitive_doc_text(clean_ocr_noise(raw_txt) if kind == "image" else raw_txt)
            snip = make_context_snippet(disp_txt, q, max_len=snip_len)

            num_l = tk.Label(
                card,
                text=f"[{idx_c + 1}] {icon_ch}",
                fg="#5EEAD4" if is_sel else "#94A3B8",
                bg=c_bg,
                font=("Malgun Gothic", 8, "bold"),
            )
            num_l.pack(side="left", padx=(0, 5))

            if st_now != "medium" and kind in ("image", "video") and Image is not None and ImageTk is not None:
                try:
                    img_cand_p = str(rec.get("img_path") or rec.get("file_path") or "").strip()
                    tb_raw = rec.get("thumb_bytes")
                    if not tb_raw and img_cand_p:
                        tb_raw = _peek_cached_small_thumb_bytes(img_cand_p)
                        if tb_raw is None:
                            with _UI2_CACHE_LOCK:
                                if img_cand_p not in _UI2_THUMB_INFLIGHT and img_cand_p not in pending_thumb_paths:
                                    pending_thumb_paths.append(img_cand_p)
                    if tb_raw:
                        im_p = Image.open(io.BytesIO(tb_raw))
                        th_p = ImageTk.PhotoImage(im_p, master=root)
                        thumb_refs.append(th_p)
                        tl = tk.Label(card, image=th_p, bg=c_bg, bd=0)
                        tl.pack(side="left", padx=(0, 5))
                except Exception:
                    pass

            row_fp = str(rec.get("img_path") or rec.get("file_path") or "").strip()
            if row_fp:
                lbl_row_b = tk.Label(
                    card,
                    text="🏷️귀신라벨링🔒",
                    fg="#0B1120",
                    bg="#5EEAD4",
                    padx=4,
                    pady=1,
                    font=("Malgun Gothic", 8, "bold"),
                    cursor="hand2",
                )
                lbl_row_b.pack(side="right", padx=(3, 0))
                lbl_row_b.bind(
                    "<Button-1>",
                    lambda _e, fp=row_fp: (close_win(), clicked_superpower_queue.put(("labeler", fp))),
                )

            if kind == "image":
                img_ref_p = row_fp
                ocr_b = tk.Label(
                    card,
                    text="📝OCR",
                    fg="#FDE047",
                    bg="#0B1120",
                    padx=4,
                    pady=1,
                    font=("Malgun Gothic", 8, "bold"),
                    cursor="hand2",
                )
                ocr_b.pack(side="right", padx=(4, 0))
                ocr_b.bind(
                    "<Button-1>",
                    lambda _e, ip=img_ref_p: toast_queue.put((f"__UI3_OCR__|{ip}", 8000)),
                )
            elif kind == "video":
                if bool(rec.get("video_ocr_full")):
                    vocr_b = tk.Label(
                        card,
                        text="✨글자감지",
                        fg="#0B1120",
                        bg="#FDE047",
                        padx=5,
                        pady=1,
                        font=("Malgun Gothic", 8, "bold"),
                    )
                    vocr_b.pack(side="right", padx=(4, 0))

            time_l = tk.Label(card, text=rel_t, fg="#64748B", bg=c_bg, font=("Malgun Gothic", 8))
            time_l.pack(side="right", padx=(4, 0))

            body_l = tk.Label(
                card,
                text=snip,
                fg="#F8FAFC" if is_sel else "#CBD5E1",
                bg=c_bg,
                font=("Malgun Gothic", 9),
                anchor="w",
            )
            body_l.pack(side="left", fill="x", expand=True)

            def _on_pick(_e=None, r=rec, i_row=idx_c):
                if r.get("kind") == "video" and r.get("video_ocr_full") and st_now != "medium":
                    _open_video_ocr_extractor(r)
                    return
                need_preview_expand = st_state["mode"] == "compact" and st_state["stage"] == "small"
                if st_state["sel_idx"] != i_row or need_preview_expand:
                    st_state["sel_idx"] = i_row
                    st_state["selected_fp_lock"] = str(r.get("img_path") or r.get("file_path") or "").strip()
                    if st_state["mode"] == "compact" and (r.get("file_path") or r.get("img_path") or r.get("text")):
                        st_state["stage"] = "medium"
                        st_state["manual_stage"] = "medium"
                        st_state["custom_h"] = None
                        _resize_for_stage(activate=False)
                    _render_search_results()
                    return "break"
                fpath = str(r.get("file_path") or r.get("img_path") or "").strip()
                if fpath and not is_input_context:
                    _open_file_in_os(fpath)
                elif is_input_context:
                    paste_to_target(text_val=r.get("text", ""), file_path=fpath)
                else:
                    _copy_item_to_clipboard(text_val=r.get("text", ""), file_path=fpath)

            def _on_dbl_pick(_e=None, r=rec):
                fpath = str(r.get("file_path") or r.get("img_path") or "").strip()
                if fpath:
                    _open_file_in_os(fpath)
                elif is_input_context:
                    paste_to_target(text_val=r.get("text", ""), file_path="")
                else:
                    _copy_item_to_clipboard(text_val=r.get("text", ""), file_path="")

            for w_it in (card, num_l, body_l, time_l):
                w_it.bind("<Button-1>", _on_pick)
                w_it.bind("<Double-Button-1>", _on_dbl_pick)

        if pending_thumb_paths:
            _enqueue_ui2_thumbs_bg(
                list(pending_thumb_paths),
                lambda: st_state.update({"bg_ui_dirty": True}),
            )

        if preview_pane is not None and candidates:
            sel_rec = candidates[st_state["sel_idx"]]
            s_kind = sel_rec.get("kind", "text")
            s_fpath = str(sel_rec.get("img_path") or sel_rec.get("file_path") or "").strip()
            s_txt = sel_rec.get("video_ocr_full") or sel_rec.get("text", "")
            tk.Label(
                preview_pane,
                text="👻 선택 항목 상세 미리보기",
                fg="#5EEAD4",
                bg="#0F172A",
                font=("Malgun Gothic", 9, "bold"),
                anchor="w",
            ).pack(fill="x", pady=(0, 6))

            # [타이핑 버벅임 0% 보장]: UI 메인 스레드에서 5~15MB 원본 사진/동영상을 동기 디스크 오픈·디코딩하지 않고,
            # 메모리 LRU 캐시(352x220) 또는 소형 썸네일을 0.2ms 내에 즉시 그린 뒤 미캐싱 고화질 미리보기만 백그라운드 스레드에서 디코드합니다!
            if s_kind in ("image", "video") and Image is not None and ImageTk is not None:
                big_photo = None
                img_dim_str = ""
                try:
                    norm_sfp = os.path.normcase(os.path.abspath(s_fpath)) if s_fpath else ""
                    with _UI2_CACHE_LOCK:
                        cached_prev = _UI2_PREVIEW_BYTES_CACHE.get(norm_sfp) if norm_sfp else None
                    if cached_prev and cached_prev[0]:
                        img_dim_str = cached_prev[1]
                        with Image.open(io.BytesIO(cached_prev[0])) as pv_im:
                            big_photo = ImageTk.PhotoImage(pv_im.copy(), master=root)
                    else:
                        quick_tb = sel_rec.get("thumb_bytes") or (_peek_cached_small_thumb_bytes(s_fpath) if s_fpath else b"")
                        if quick_tb:
                            with Image.open(io.BytesIO(quick_tb)) as raw_tb:
                                im_copy = raw_tb.convert("RGB").resize((260, 165))
                                big_photo = ImageTk.PhotoImage(im_copy, master=root)
                        should_spawn_pv = False
                        if s_fpath and norm_sfp:
                            with _UI2_CACHE_LOCK:
                                if norm_sfp not in _UI2_PREVIEW_INFLIGHT:
                                    _UI2_PREVIEW_INFLIGHT.add(norm_sfp)
                                    should_spawn_pv = True
                        if should_spawn_pv:
                            def _decode_preview_bg(target_fp: str, target_norm: str) -> None:
                                try:
                                    pv_bytes, _ = _get_or_make_preview_bytes(target_fp)
                                    if pv_bytes:
                                        st_state["bg_ui_dirty"] = True
                                except Exception:
                                    pass
                                finally:
                                    with _UI2_CACHE_LOCK:
                                        _UI2_PREVIEW_INFLIGHT.discard(target_norm)

                            threading.Thread(
                                target=_decode_preview_bg,
                                args=(s_fpath, norm_sfp),
                                daemon=True,
                            ).start()
                except Exception:
                    big_photo = None

                if big_photo is not None:
                    thumb_refs.append(big_photo)
                    img_holder = tk.Frame(
                        preview_pane,
                        bg="#020617",
                        highlightbackground="#334155",
                        highlightthickness=1,
                        height=228,
                    )
                    img_holder.pack(fill="x", pady=(0, 6))
                    img_holder.pack_propagate(False)
                    tk.Label(img_holder, image=big_photo, bg="#020617", bd=0).pack(expand=True)

                if s_fpath:
                    fname_only = Path(s_fpath).name
                    icon_m = "🎬" if s_kind == "video" else "🖼️"
                    meta_line = f"{icon_m} {fname_only}" + (f" ({img_dim_str})" if img_dim_str else "")
                    tk.Label(
                        preview_pane,
                        text=meta_line[:48],
                        fg="#94A3B8",
                        bg="#0F172A",
                        font=("Malgun Gothic", 8),
                        anchor="w",
                    ).pack(fill="x", pady=(0, 4))
            elif s_fpath:
                tk.Label(
                    preview_pane,
                    text=f"📂 {Path(s_fpath).name}"[:48],
                    fg="#94A3B8",
                    bg="#0F172A",
                    font=("Malgun Gothic", 8, "bold"),
                    anchor="w",
                ).pack(fill="x", pady=(0, 4))
            elif sel_rec.get("_is_copied_filename_text"):
                tk.Label(
                    preview_pane,
                    text="📋 클립보드에 복사해 둔 이름(글자)입니다 — 실제 사진 파일이 아님",
                    fg="#FBBF24",
                    bg="#0F172A",
                    font=("Malgun Gothic", 8, "bold"),
                    anchor="w",
                    wraplength=350,
                    justify="left",
                ).pack(fill="x", pady=(0, 4))

            disp_preview_txt = _mask_sensitive_doc_text(
                clean_ocr_noise(str(s_txt)) if s_kind == "image" else str(s_txt)
            )
            tk.Label(
                preview_pane,
                text=disp_preview_txt[:220],
                fg="#F8FAFC",
                bg="#0F172A",
                font=("Malgun Gothic", 9),
                justify="left",
                wraplength=350,
                anchor="w",
            ).pack(fill="x", pady=(0, 8))
            if s_fpath:
                if Path(s_fpath).suffix.lower() in (".gsheet", ".gdoc", ".gslides"):
                    gweb_b = tk.Label(
                        preview_pane,
                        text="🌐 Google 문서·시트 웹에서 열기 ↗",
                        fg="#FFFFFF",
                        bg="#059669",
                        padx=8,
                        pady=5,
                        font=("Malgun Gothic", 9, "bold"),
                        cursor="hand2",
                    )
                    gweb_b.pack(fill="x", pady=(0, 3))
                    gweb_b.bind(
                        "<Button-1>",
                        lambda _e, fp=s_fpath, t=str(s_txt): _open_google_workspace_web(fp, t),
                    )
                exp_row = tk.Frame(preview_pane, bg="#0F172A")
                exp_row.pack(fill="x", pady=2)
                exp_row.grid_columnconfigure(0, weight=1, uniform="actbtn")
                exp_row.grid_columnconfigure(1, weight=1, uniform="actbtn")
                open_b = tk.Label(
                    exp_row,
                    text="📂 원본 열기",
                    fg="#0B1120",
                    bg="#38BDF8",
                    padx=6,
                    pady=4,
                    font=("Malgun Gothic", 9, "bold"),
                    cursor="hand2",
                )
                open_b.grid(row=0, column=0, sticky="ew", padx=(0, 3))
                open_b.bind("<Button-1>", lambda _e, fp=s_fpath: _open_file_in_os(fp))
                copy_b = tk.Label(
                    exp_row,
                    text="📋 복사하기",
                    fg="#F8FAFC",
                    bg="#1E293B",
                    padx=6,
                    pady=4,
                    font=("Malgun Gothic", 9, "bold"),
                    cursor="hand2",
                )
                copy_b.grid(row=0, column=1, sticky="ew", padx=(3, 0))
                copy_b.bind("<Button-1>", lambda _e, t=str(s_txt), fp=s_fpath: _copy_item_to_clipboard(t, fp))
            else:
                copy_b = tk.Label(
                    preview_pane,
                    text="📋 클립보드에 복사하기",
                    fg="#F8FAFC",
                    bg="#1E293B",
                    padx=8,
                    pady=4,
                    font=("Malgun Gothic", 9, "bold"),
                    cursor="hand2",
                )
                copy_b.pack(fill="x", pady=2)
                copy_b.bind("<Button-1>", lambda _e, t=str(s_txt): _copy_item_to_clipboard(t, ""))

            if is_input_context or not s_fpath:
                act_b = tk.Label(
                    preview_pane,
                    text="📎 현재 커서에 바로 꽂기 (Enter)" if is_input_context else "📎 바로 붙여넣기",
                    fg="#0B1120",
                    bg="#2DD4BF",
                    padx=8,
                    pady=4,
                    font=("Malgun Gothic", 9, "bold"),
                    cursor="hand2",
                )
                act_b.pack(fill="x", pady=2)
                act_b.bind(
                    "<Button-1>",
                    lambda _e, r=sel_rec: paste_to_target(
                        r.get("text", ""), r.get("file_path") or r.get("img_path") or ""
                    ),
                )

            if sel_rec.get("kind") == "image":
                ocr_jump = tk.Label(
                    preview_pane,
                    text="📝 사진·표 OCR 창으로 열기",
                    fg="#FDE047",
                    bg="#1E293B",
                    padx=8,
                    pady=4,
                    font=("Malgun Gothic", 9, "bold"),
                    cursor="hand2",
                )
                ocr_jump.pack(fill="x", pady=2)
                ocr_jump.bind(
                    "<Button-1>",
                    lambda _e, ip=s_fpath: toast_queue.put((f"__UI3_OCR__|{ip}", 8000)),
                )
            elif sel_rec.get("kind") == "video":
                vocr_extract_b = tk.Label(
                    preview_pane,
                    text="📝 영상 속 글자 뽑기" if not sel_rec.get("video_ocr_full") else "📝 추출된 영상 글자 보기",
                    fg="#FDE047",
                    bg="#1E293B",
                    padx=8,
                    pady=4,
                    font=("Malgun Gothic", 9, "bold"),
                    cursor="hand2",
                )
                vocr_extract_b.pack(fill="x", pady=2)
                vocr_extract_b.bind("<Button-1>", lambda _e, r=sel_rec: _open_video_ocr_extractor(r))
                if sel_rec.get("video_ocr_full"):
                    vocr_copy_b = tk.Label(
                        preview_pane,
                        text="📋 추출된 영상 글자 전체 복사하기",
                        fg="#0B1120",
                        bg="#FDE047",
                        padx=8,
                        pady=4,
                        font=("Malgun Gothic", 9, "bold"),
                        cursor="hand2",
                    )
                    vocr_copy_b.pack(fill="x", pady=2)
                    vocr_copy_b.bind(
                        "<Button-1>",
                        lambda _e, t=str(sel_rec.get("video_ocr_full") or ""): _copy_video_ocr_text(t),
                    )
            if s_fpath:
                lbl_jump = tk.Label(
                    preview_pane,
                    text="🏷️ 이 파일 귀신라벨링🔒",
                    fg="#0B1120",
                    bg="#5EEAD4",
                    padx=8,
                    pady=4,
                    font=("Malgun Gothic", 9, "bold"),
                    cursor="hand2",
                )
                lbl_jump.pack(fill="x", pady=2)
                lbl_jump.bind(
                    "<Button-1>",
                    lambda _e, fp=s_fpath: (close_win(), clicked_superpower_queue.put(("labeler", fp))),
                )

    last_typed_q = [_get_live_entry_query()]

    def _schedule_query_render(cur_q: str) -> None:
        last_typed_q[0] = cur_q
        st_state["selected_fp_lock"] = ""
        st_state["last_typing_ts"] = time.time()
        if st_state["mode"] == "compact":
            st_state["manual_stage"] = None
        st_state["sel_idx"] = 0
        prev_rjob_k = st_state.get("resize_job")
        if prev_rjob_k is not None:
            try:
                win.after_cancel(prev_rjob_k)
            except Exception:
                pass
            st_state["resize_job"] = None
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

        st_state["debounce_job"] = win.after(75, _apply_debounced)

    def _on_key_rel(event=None):
        is_hovered[0] = True
        if event and event.keysym in (
            "Up", "Down", "Return", "Escape", "Tab",
            "Control_L", "Control_R", "Shift_L", "Shift_R",
            "Alt_L", "Alt_R", "Super_L", "Super_R", "Win_L", "Win_R", "Caps_Lock",
        ):
            return
        cur_q = _get_live_entry_query()
        if cur_q == last_typed_q[0]:
            return
        _schedule_query_render(cur_q)

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
            fpath = str(r.get("file_path") or r.get("img_path") or "").strip()
            if fpath and not is_input_context:
                _open_file_in_os(fpath)
            elif is_input_context:
                paste_to_target(r.get("text", ""), fpath)
            else:
                _copy_item_to_clipboard(r.get("text", ""), fpath)
        return "break"

    s_entry.bind("<KeyRelease>", _on_key_rel)
    win.bind("<Down>", _on_down)
    win.bind("<Up>", _on_up)
    win.bind("<Return>", _on_ret)
    win.bind(
        "<Escape>",
        lambda _e: None if (time.time() - get_last_rbtn_dismiss_esc_ts()) < 0.45 else close_win(),
    )

    # [원자적 페인팅 & 첫 실행 0.05초 즉시 오픈]:
    # withdraw 상태에서 메모리 캐시 기반 결과 위젯을 먼저 조립한 뒤(_render_search_results < 1ms)
    # _resize_for_stage(activate=True)로 ShowWindow + SetForegroundWindow를 한 번에 수행해 빈 창 깜빡임과 포커스 누락을 원천 차단합니다.
    _render_search_results()
    _resize_for_stage(activate=True)
    st_state["initial_mapped"] = True
    # 소환 직전 사용자가 설정해 둔 키보드 한/영 상태를 검색 입력창에 즉시 동기화 (영타 강제 초기화 차단)
    _want_ime_kor = get_target_ime_korean() if callable(get_target_ime_korean) else None
    if _want_ime_kor is not None:
        _apply_entry_ime_korean(bool(_want_ime_kor))

        def _reverify_initial_ime(target_k: bool = bool(_want_ime_kor)) -> None:
            if current_win[0] is not win or _ime_sync_state.get("user_toggled_in_ui2"):
                return
            cur_k = _read_entry_ime_is_korean()
            if cur_k is not None and cur_k != target_k:
                _apply_entry_ime_korean(target_k)

        try:
            win.after(28, _reverify_initial_ime)
        except Exception:
            pass

    # [열려 있는 동안 파일 추가·변경·백그라운드 썸네일 디코딩 실시간 자동 반영 (메인 스레드 폴링으로 Tcl 스레드 충돌 0%, 닫혀 있을 때는 타이머 0개로 CPU 0.00%)]
    last_ext_banner_sig = [""]

    def _poll_main_thread_ui2_updates() -> None:
        try:
            if current_win[0] is not win or not win.winfo_exists():
                return
            if callable(get_external_drive_banner):
                eb_now = get_external_drive_banner()
                eb_sig = (
                    f"{eb_now.get('status')}|{eb_now.get('vol_id','')}|{eb_now.get('pct','')}"
                    if isinstance(eb_now, dict)
                    else ""
                )
                if eb_sig != last_ext_banner_sig[0]:
                    last_ext_banner_sig[0] = eb_sig
                    st_state["bg_ui_dirty"] = True
            if st_state.get("bg_ocr_done_payload") is not None:
                ft_done = st_state["bg_ocr_done_payload"]
                st_state["bg_ocr_done_payload"] = None
                st_state["video_ocr_loading"] = False
                st_state["video_ocr_result_text"] = ft_done
                st_state["bg_ui_dirty"] = True
            # [한글 IME 조합음 실시간 감시]: KeyRelease가 누락되거나 IME 조합 중 음절이 바뀐 경우도 75ms 디바운스 경유 동기화(UI 프리징 0%)
            live_q_poll = _get_live_entry_query()
            if live_q_poll != last_typed_q[0]:
                _schedule_query_render(live_q_poll)
            # 사용자가 귀신검색창 안에서 직접 한/영 키를 눌러 바꾼 언어 상태도 실시간 추적해 다음 소환 시 일관 유지
            cur_ime_k = _read_entry_ime_is_korean()
            if cur_ime_k is not None and cur_ime_k != _ime_sync_state.get("last_observed_kor"):
                if _ime_sync_state.get("last_observed_kor") is not None:
                    _ime_sync_state["user_toggled_in_ui2"] = True
                _ime_sync_state["last_observed_kor"] = cur_ime_k
                if callable(report_ui2_ime_korean):
                    report_ui2_ime_korean(cur_ime_k)
            if st_state.get("bg_ui_dirty"):
                st_state["bg_ui_dirty"] = False
                _render_search_results()
            win.after(70, _poll_main_thread_ui2_updates)
        except Exception:
            pass

    win.after(70, _poll_main_thread_ui2_updates)

    if callable(check_local_files_changed_async):
        def _notify_fs_changed() -> None:
            _VIDEO_OCR_UI_CACHE["ts"] = 0.0
            st_state["bg_ui_dirty"] = True

        def _poll_open_window_fs_changes() -> None:
            try:
                if current_win[0] is not win or not win.winfo_exists():
                    return
                check_local_files_changed_async(_notify_fs_changed)
                win.after(850, _poll_open_window_fs_changes)
            except Exception:
                pass

        win.after(450, _poll_open_window_fs_changes)
