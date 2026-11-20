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

import io
import json
import os
from pathlib import Path
import re
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

_VIDEO_OCR_UI_CACHE: dict[str, Any] = {"ts": 0.0, "by_name": {}}
_UI2_SMALL_THUMB_CACHE: dict[str, bytes] = {}
_UI2_SMALL_THUMB_BY_PATH: dict[str, bytes] = {}
_UI2_THUMB_INFLIGHT: set[str] = set()
_UI2_PREVIEW_BYTES_CACHE: dict[str, tuple[bytes, str]] = {}
_UI2_PREVIEW_INFLIGHT: set[str] = set()
_EXTRACTED_QUEUE_UI_CACHE: dict[str, Any] = {"mtime_ns": -1, "size": -1, "items": []}


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
    return _UI2_SMALL_THUMB_BY_PATH.get(norm_p)


def _get_or_make_small_thumb_bytes(img_path_str: str) -> bytes:
    if not img_path_str or Image is None:
        return b""
    try:
        norm_p = os.path.normcase(os.path.abspath(img_path_str))
        if not os.path.isfile(img_path_str):
            return b""
        st = os.stat(img_path_str)
        if st.st_size <= 0 or st.st_size > 25 * 1024 * 1024:
            return b""
        sig = f"{norm_p}|{st.st_size}|{int(st.st_mtime)}"
        cached = _UI2_SMALL_THUMB_CACHE.get(sig)
        if cached is not None:
            _UI2_SMALL_THUMB_BY_PATH[norm_p] = cached
            return cached
        with Image.open(img_path_str) as raw_im:
            im_c = raw_im.convert("RGBA")
            resamp = getattr(getattr(Image, "Resampling", Image), "BILINEAR", Image.NEAREST)
            im_c.thumbnail((42, 28), resamp)
            bio = io.BytesIO()
            im_c.save(bio, "PNG")
            tb = bio.getvalue()
        if len(_UI2_SMALL_THUMB_CACHE) > 320:
            _UI2_SMALL_THUMB_CACHE.clear()
            _UI2_SMALL_THUMB_BY_PATH.clear()
        _UI2_SMALL_THUMB_CACHE[sig] = tb
        _UI2_SMALL_THUMB_BY_PATH[norm_p] = tb
        return tb
    except Exception:
        return b""


def _get_or_make_preview_bytes(img_path_str: str) -> tuple[bytes, str]:
    """중형(960x640) 우측 미리보기 이미지(352x220)를 백그라운드 스레드에서 디코딩해 LRU 캐싱합니다."""
    if not img_path_str or Image is None:
        return b"", ""
    try:
        norm_p = os.path.normcase(os.path.abspath(img_path_str))
        cached = _UI2_PREVIEW_BYTES_CACHE.get(norm_p)
        if cached is not None:
            return cached
        if not os.path.isfile(img_path_str):
            return b"", ""
        with Image.open(img_path_str) as raw_im:
            dim_str = f"{raw_im.width}×{raw_im.height}px"
            im_copy = raw_im.convert("RGB")
            resamp = getattr(getattr(Image, "Resampling", Image), "BILINEAR", Image.NEAREST)
            im_copy.thumbnail((352, 220), resamp)
            bio = io.BytesIO()
            im_copy.save(bio, "JPEG", quality=84)
            out = (bio.getvalue(), dim_str)
        if len(_UI2_PREVIEW_BYTES_CACHE) > 64:
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


def _load_local_video_ocr_by_name() -> dict[str, dict[str, Any]]:
    """로컬 video_scene_ocr_cache_v2.json을 15초 주기로 초경량 조회하여 파일명별 화면 글자 데이터를 반환합니다."""
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
    by_name: dict[str, dict[str, Any]] = {}
    for p in candidates:
        if not p.exists():
            continue
        try:
            raw = json.loads(p.read_text(encoding="utf-8", errors="ignore"))
            if isinstance(raw, dict):
                for sig_key, val in raw.items():
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
        except Exception:
            pass

    _VIDEO_OCR_UI_CACHE["ts"] = now
    _VIDEO_OCR_UI_CACHE["by_name"] = by_name
    return by_name


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
    get_last_rbtn_dismiss_esc_ts = ctx["get_last_rbtn_dismiss_esc_ts"]
    get_trial_badge_summary = ctx.get("get_trial_badge_summary")

    active_mode[0] = "ui2"
    set_current_open_ui_mode("ui2")
    init_mode = "large" if init_stage in ("large", "gallery") else "compact"
    st_state: dict[str, Any] = {
        "mode": init_mode,
        "stage": "large" if init_mode == "large" else ("medium" if init_stage == "medium" or init_query.strip() else "small"),
        "manual_stage": "medium" if init_stage == "medium" else ("large" if init_mode == "large" else None),
        "custom_h": None if init_mode == "large" else 330,
        "filter": "all",
        "sel_idx": 0,
        "items": [],
        "debounce_job": None,
        "video_ocr_modal_rec": None,
        "video_ocr_loading": False,
        "video_ocr_result_text": "",
        "video_ocr_copied_msg": "",
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

    stage_btns: dict[str, tk.Label] = {}
    for st_k, st_txt in (("large", "크게"), ("medium", "중간"), ("small", "작게")):
        sb = tk.Label(
            hdr,
            text=st_txt,
            fg="#0B1120" if st_state["stage"] == st_k else "#5EEAD4",
            bg="#2DD4BF" if st_state["stage"] == st_k else "#1E293B",
            padx=4,
            pady=1,
            font=("Malgun Gothic", 8, "bold"),
            cursor="hand2",
        )
        sb.pack(side="right", padx=(2, 0))
        sb.bind("<Button-1>", lambda _e, sk=st_k: _set_explicit_stage(sk))
        stage_btns[st_k] = sb

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
        close_win()
        clicked_superpower_queue.put((2, sel_fp, True) if sel_fp else 2)

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
        opened_at[0] = time.time()
        was_mouse_down[0] = True
        apply_win_topmost(win, int(r3["x"]), int(r3["y"]), int(r3["width"]), int(r3["height"]), activate=activate)
        if activate:
            try:
                s_entry.focus_force()
            except Exception:
                pass

    def _set_explicit_stage(target_st: str) -> str:
        is_hovered[0] = True
        opened_at[0] = time.time()
        was_mouse_down[0] = True
        st_state["manual_stage"] = target_st
        st_state["mode"] = "large" if target_st == "large" else "compact"
        st_state["stage"] = target_st
        st_state["custom_h"] = 330 if target_st == "small" else None
        record_feature_telemetry(f"ghost_search_window_{target_st}")
        _render_search_results()
        _resize_for_stage(activate=True)
        return "break"

    def _toggle_window_mode(_e=None) -> str:
        order = ("small", "medium", "large")
        cur_s = str(st_state.get("stage") or "small")
        nxt_s = order[(order.index(cur_s) + 1) % len(order)] if cur_s in order else "medium"
        return _set_explicit_stage(nxt_s)

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
            ft = str(res.get("fullText") or "").strip() if res.get("ok") else ""
            if not ft:
                ft = "이 영상에서는 추출 가능한 화면 글자(자막·발표자료·표지판)가 감지되지 않았어요."
            else:
                rec["video_ocr_full"] = ft
                rec["video_ocr_lines"] = int(res.get("lineCount") or len(ft.splitlines()))

            def _apply_ui() -> None:
                if current_win[0] is not win:
                    return
                st_state["video_ocr_loading"] = False
                st_state["video_ocr_result_text"] = ft
                _render_search_results()

            try:
                win.after(0, _apply_ui)
            except Exception:
                pass

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
            can_copy = (not st_state.get("video_ocr_loading")) and ("감지되지 않았어요" not in res_str)
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

        q = s_entry.get().strip()
        vid_ocr_map = _load_local_video_ocr_by_name()

        pool: list[dict] = []
        seen_fpaths: set[str] = set()
        for rec in reversed(global_ai_history):
            fp_hist = str(rec.get("file_path") or "")
            if fp_hist:
                seen_fpaths.add(fp_hist.lower())
            pool.append(rec)

        # [봉인 존중 연동] 사용자가 더블클릭·우클릭으로 직접 압축을 푼 직후 등록된 문서·본문 스니펫 0.05초 즉시 편입
        try:
            for erec in _load_extracted_queue_fast():
                efp = str(erec.get("filePath") or "").strip()
                if not efp or efp.lower() in seen_fpaths or not os.path.exists(efp):
                    continue
                seen_fpaths.add(efp.lower())
                efn = str(erec.get("fileName") or Path(efp).name)
                esnip = str(erec.get("textSnippet") or "").strip()
                ext_sfx = Path(efp).suffix.lower()
                ekind = (
                    "image"
                    if ext_sfx in (".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp")
                    else ("video" if ext_sfx in (".mp4", ".mov", ".mkv", ".avi", ".webm") else "doc")
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

        local_files_ready = True
        if callable(peek_lightweight_local_files):
            local_files_list, local_files_ready = peek_lightweight_local_files()
            if not local_files_ready and callable(refresh_lightweight_local_files_async) and not st_state.get("bg_scan_scheduled"):
                st_state["bg_scan_scheduled"] = True

                def _on_bg_files_ready() -> None:
                    def _rerender_after_warm() -> None:
                        st_state["bg_scan_scheduled"] = False
                        if current_win[0] is win:
                            _render_search_results()

                    try:
                        win.after(0, _rerender_after_warm)
                    except Exception:
                        pass

                refresh_lightweight_local_files_async(_on_bg_files_ready)
        else:
            local_files_list = get_lightweight_local_files()

        for frec in local_files_list:
            fp_loc = str(frec.get("file_path") or "")
            if fp_loc and fp_loc.lower() in seen_fpaths:
                continue
            if frec.get("kind") == "video":
                v_fname = Path(str(frec.get("file_path") or "")).name
                ocr_info = vid_ocr_map.get(v_fname)
                if ocr_info and ocr_info.get("fullText"):
                    enriched = dict(frec)
                    enriched["video_ocr_full"] = ocr_info["fullText"]
                    enriched["video_ocr_lines"] = ocr_info["lineCount"]
                    flat_ocr = re.sub(r"\[\d{2}:\d{2}\]\s*", "", ocr_info["fullText"]).replace("\n", " · ")
                    enriched["text"] = f"{frec.get('text', '')} | 📝화면글자: {flat_ocr[:180]}"
                    pool.append(enriched)
                    continue
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
                    r["_search_src_len"] = len(raw_t)
                t_low = cached_low
                sc = 0.0
                if q_low in t_low:
                    sc = 1.0
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

        has_rich = any(m[1].get("kind") in ("image", "doc", "video") for m in matched[:5]) or (
            flt_now in ("image", "video") and len(pool) > 0 and bool(q)
        )
        auto_stage, auto_slim_h = resolve_ghost_search_auto_stage(
            mode=st_state["mode"],
            has_query=bool(q),
            matched_count=len(matched) if q else len(pool[:5]),
            has_rich_preview=has_rich,
        )
        prev_stage = st_state["stage"]
        prev_h = st_state.get("custom_h")
        if st_state.get("manual_stage") in ("small", "medium", "large"):
            st_state["stage"] = st_state["manual_stage"]
            st_state["custom_h"] = 330 if st_state["stage"] == "small" else None
        else:
            st_state["stage"] = auto_stage
            st_state["custom_h"] = auto_slim_h
            if auto_stage == "medium" and prev_stage != "medium":
                record_feature_telemetry("ghost_search_window_medium")

        st_now = st_state["stage"]
        for sk_b, sb_w in stage_btns.items():
            is_act = sk_b == st_now
            sb_w.config(
                fg="#0B1120" if is_act else "#5EEAD4",
                bg="#2DD4BF" if is_act else "#1E293B",
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
            candidates = pool[:max_cnt]
            trial_lbl.config(text=f"🔍 '{q[:6]}' 일치 없음(최근목록)", fg="#FDE047")

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

        if (prev_stage != st_now or prev_h != auto_slim_h) and current_win[0] is win:
            _resize_for_stage(activate=False)

        st_state["items"] = candidates
        st_state["sel_idx"] = min(st_state["sel_idx"], max(0, len(candidates) - 1))

        if not candidates:
            tk.Label(
                body_frame,
                text="⚡ 내 컴퓨터 최근 파일을 불러오는 중..." if not local_files_ready else "표시할 항목이 없습니다.",
                fg="#5EEAD4" if not local_files_ready else "#94A3B8",
                bg="#0B1120",
                font=("Malgun Gothic", 9),
            ).pack(pady=20)
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

            if st_now != "medium" and kind == "image" and Image is not None and ImageTk is not None:
                try:
                    img_cand_p = str(rec.get("img_path") or rec.get("file_path") or "").strip()
                    tb_raw = rec.get("thumb_bytes")
                    if not tb_raw and img_cand_p:
                        tb_raw = _peek_cached_small_thumb_bytes(img_cand_p)
                        if tb_raw is None and img_cand_p not in _UI2_THUMB_INFLIGHT and img_cand_p not in pending_thumb_paths:
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
                    lambda _e, fp=row_fp: (close_win(), clicked_superpower_queue.put((2, fp, True))),
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
                if st_now == "medium" and st_state["sel_idx"] != i_row:
                    st_state["sel_idx"] = i_row
                    _render_search_results()
                    return
                fpath = r.get("file_path") or r.get("img_path") or ""
                paste_to_target(text_val=r.get("text", ""), file_path=fpath)

            def _on_dbl_pick(_e=None, r=rec):
                fpath = r.get("file_path") or r.get("img_path") or ""
                paste_to_target(text_val=r.get("text", ""), file_path=fpath)

            for w_it in (card, num_l, body_l, time_l):
                w_it.bind("<Button-1>", _on_pick)
                w_it.bind("<Double-Button-1>", _on_dbl_pick)

        if pending_thumb_paths:
            for _ptp in pending_thumb_paths:
                _UI2_THUMB_INFLIGHT.add(_ptp)

            def _decode_thumbs_bg(paths_to_load: list[str]) -> None:
                any_decoded = False
                for p_load in paths_to_load:
                    try:
                        if _get_or_make_small_thumb_bytes(p_load):
                            any_decoded = True
                    finally:
                        _UI2_THUMB_INFLIGHT.discard(p_load)
                if any_decoded:
                    try:
                        win.after(0, lambda: _render_search_results() if current_win[0] is win else None)
                    except Exception:
                        pass

            threading.Thread(target=_decode_thumbs_bg, args=(list(pending_thumb_paths),), daemon=True).start()

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

            # [타이핑 버벅임 0% 보장]: UI 메인 스레드에서 5~15MB 원본 사진을 동기 디스크 오픈·디코딩하지 않고,
            # 메모리 LRU 캐시(352x220) 또는 소형 썸네일을 0.2ms 내에 즉시 그린 뒤 미캐싱 고화질 미리보기만 백그라운드 스레드에서 디코드합니다!
            if s_kind == "image" and Image is not None and ImageTk is not None:
                big_photo = None
                img_dim_str = ""
                try:
                    norm_sfp = os.path.normcase(os.path.abspath(s_fpath)) if s_fpath else ""
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
                        if s_fpath and norm_sfp and norm_sfp not in _UI2_PREVIEW_INFLIGHT:
                            _UI2_PREVIEW_INFLIGHT.add(norm_sfp)

                            def _decode_preview_bg(target_fp: str, target_norm: str) -> None:
                                try:
                                    pv_bytes, _ = _get_or_make_preview_bytes(target_fp)
                                    if pv_bytes:
                                        win.after(
                                            0,
                                            lambda: _render_search_results() if current_win[0] is win else None,
                                        )
                                except Exception:
                                    pass
                                finally:
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
                    meta_line = f"🖼️ {fname_only}" + (f" ({img_dim_str})" if img_dim_str else "")
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
            act_b = tk.Label(
                preview_pane,
                text="📎 현재 커서에 바로 꽂기 (Enter)",
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
                    text="📝 사진·OCR 창으로 열기",
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
            elif sel_rec.get("kind") == "video" and sel_rec.get("video_ocr_full"):
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
                    lambda _e, fp=s_fpath: (close_win(), clicked_superpower_queue.put((2, fp, True))),
                )

    def _on_key_rel(event=None):
        is_hovered[0] = True
        if event and event.keysym in ("Up", "Down", "Return", "Escape", "Tab"):
            return
        if st_state["mode"] == "compact":
            st_state["manual_stage"] = None
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

        st_state["debounce_job"] = win.after(55, _apply_debounced)

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
            paste_to_target(r.get("text", ""), r.get("file_path") or r.get("img_path") or "")
        return "break"

    s_entry.bind("<KeyRelease>", _on_key_rel)
    s_entry.bind("<Down>", _on_down)
    s_entry.bind("<Up>", _on_up)
    s_entry.bind("<Return>", _on_ret)
    s_entry.bind("<Tab>", _toggle_window_mode)
    s_entry.bind("<Alt-Return>", _toggle_window_mode)
    s_entry.bind(
        "<Escape>",
        lambda _e: None if (time.time() - get_last_rbtn_dismiss_esc_ts()) < 0.45 else close_win(),
    )

    # [즉시 표시 보장]: 창 위치·포커스를 먼저 즉시 노출한 뒤 결과를 그려 체감 초기 오픈 지연 0ms 달성
    _resize_for_stage(activate=True)
    _render_search_results()

    # [열려 있는 동안 파일 추가·변경 실시간 자동 반영 (닫혀 있을 때는 타이머 0개로 CPU 0.00%)]
    if callable(check_local_files_changed_async):
        def _notify_fs_changed() -> None:
            def _rerender_if_alive() -> None:
                try:
                    if current_win[0] is win and win.winfo_exists():
                        _VIDEO_OCR_UI_CACHE["ts"] = 0.0
                        _render_search_results()
                except Exception:
                    pass
            try:
                win.after(0, _rerender_if_alive)
            except Exception:
                pass

        def _poll_open_window_fs_changes() -> None:
            try:
                if current_win[0] is not win or not win.winfo_exists():
                    return
                check_local_files_changed_async(_notify_fs_changed)
                win.after(2000, _poll_open_window_fs_changes)
            except Exception:
                pass

        win.bind("<FocusIn>", lambda _e: check_local_files_changed_async(_notify_fs_changed), add="+")
        win.after(400, _poll_open_window_fs_changes)
