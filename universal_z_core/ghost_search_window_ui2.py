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


def _load_local_video_ocr_by_name() -> dict[str, dict[str, Any]]:
    """로컬 video_scene_ocr_cache_v2.json을 15초 주기로 초경량 조회하여 파일명별 화면 글자 데이터를 반환합니다."""
    now = time.time()
    if _VIDEO_OCR_UI_CACHE["by_name"] and (now - float(_VIDEO_OCR_UI_CACHE["ts"])) < 15.0:
        return _VIDEO_OCR_UI_CACHE["by_name"]

    candidates = [
        Path(os.environ.get("LOCALAPPDATA") or (Path.home() / "AppData" / "Local"))
        / "Programs"
        / "MerlinFamily"
        / "video_scene_ocr_cache_v2.json",
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
                    if not fname:
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
            break
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
        req = urllib.request.Request(url, method="GET")
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
    extract_chosung = ctx["extract_chosung"]
    eng_to_kor = ctx["eng_to_kor"]
    kor_to_eng = ctx["kor_to_eng"]
    clean_ocr_noise = ctx["clean_ocr_noise"]
    format_rel_time = ctx["format_rel_time"]
    make_context_snippet = ctx["make_context_snippet"]
    toast_queue = ctx["toast_queue"]
    paste_to_target = ctx["paste_to_target"]
    get_last_rbtn_dismiss_esc_ts = ctx["get_last_rbtn_dismiss_esc_ts"]

    active_mode[0] = "ui2"
    set_current_open_ui_mode("ui2")
    init_mode = "large" if init_stage in ("large", "gallery") else "compact"
    st_state: dict[str, Any] = {
        "mode": init_mode,
        "stage": "large" if init_mode == "large" else ("medium" if init_query.strip() else "small"),
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

    mode_toggle_btn = tk.Label(
        hdr,
        text="⤡ 작게" if init_mode == "large" else "⤢ 크게(갤러리)",
        fg="#0B1120" if init_mode == "large" else "#5EEAD4",
        bg="#2DD4BF" if init_mode == "large" else "#1E293B",
        padx=5,
        pady=1,
        font=("Malgun Gothic", 8, "bold"),
        cursor="hand2",
    )
    mode_toggle_btn.pack(side="right", padx=(2, 0))
    mode_toggle_btn.bind("<Button-1>", lambda _e: _toggle_window_mode())

    lbl_quick_btn = tk.Label(
        hdr,
        text="🏷️파일라벨러",
        fg="#0B1120",
        bg="#5EEAD4",
        padx=5,
        pady=1,
        font=("Malgun Gothic", 8, "bold"),
        cursor="hand2",
    )
    lbl_quick_btn.pack(side="right", padx=(4, 2))
    lbl_quick_btn.bind("<Button-1>", lambda _e: (close_win(), clicked_superpower_queue.put(2)))

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

    trial_lbl = tk.Label(
        fbar,
        text="🎁 30일 무제한(D-30·차감없음)",
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
            ext_q_file = (
                Path(os.environ.get("LOCALAPPDATA") or (Path.home() / "AppData" / "Local"))
                / "Ghosti"
                / "data"
                / "extracted_files_index_queue.json"
            )
            if ext_q_file.exists():
                ext_q_data = json.loads(ext_q_file.read_text(encoding="utf-8", errors="ignore"))
                for erec in (ext_q_data.get("indexedFiles") or [])[:120]:
                    if not isinstance(erec, dict):
                        continue
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
                        "ts": float(erec.get("indexedTs") or time.time()),
                        "text": f"📦 {efn}" + (f" — {esnip}" if esnip else f" ({Path(efp).parent.name})"),
                    })
        except Exception:
            pass

        for frec in get_lightweight_local_files():
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
            q_cho = extract_chosung(q_low)
            q_kor_alt = eng_to_kor(q) if re.search(r"[A-Za-z]", q) else ""
            q_eng_alt = kor_to_eng(q) if re.search(r"[가-힣ㄱ-ㅎㅏ-ㅣ]", q) else ""
            for idx_p, r in enumerate(pool):
                raw_t = r.get("text", "")
                clean_t = clean_ocr_noise(raw_t) if r.get("kind") == "image" else raw_t
                t_low = clean_t.lower()
                t_cho = extract_chosung(t_low)
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
        snip_len = 34 if st_now == "small" else (46 if st_now == "medium" else 32)

        if not q:
            candidates = pool[:max_cnt]
            trial_lbl.config(
                text="✨ 자율크기 · 🎁 30일 체험" if st_now == "small" else "✨ 크기 자율 호흡 · 🎁 30일 무제한 체험",
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
                text="👻 영상 속 화면 글자 발견! 멈춰 적지 말고 우측 [📝글자뽑기]를 눌러보세요!",
                fg="#5EEAD4",
                bg="#132A2E",
                font=("Malgun Gothic", 8, "bold"),
            ).pack(side="left")
            quick_extract = tk.Label(
                tip_bar,
                text="📝 바로 뽑기",
                fg="#0B1120",
                bg="#FDE047",
                padx=5,
                pady=1,
                font=("Malgun Gothic", 8, "bold"),
                cursor="hand2",
            )
            quick_extract.pack(side="right")
            quick_extract.bind("<Button-1>", lambda _e, r=rich_ocr_vid: _open_video_ocr_extractor(r))
        elif flt_now == "video" and any_vid is not None:
            tip_bar = tk.Frame(smart_tip_frame, bg="#132A2E", highlightbackground="#334155", highlightthickness=1, padx=6, pady=3)
            tip_bar.pack(fill="x", pady=(0, 4))
            tk.Label(
                tip_bar,
                text="👻 강의·회의·자막 영상은 우측 [📝글자뽑기]로 화면 속 글자만 1초 만에 뽑아 복사할 수 있어요!",
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
                text="표시할 항목이 없습니다.",
                fg="#94A3B8",
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
            disp_txt = clean_ocr_noise(raw_txt) if kind == "image" else raw_txt
            snip = make_context_snippet(disp_txt, q, max_len=snip_len)

            num_l = tk.Label(
                card,
                text=f"[{idx_c + 1}] {icon_ch}",
                fg="#5EEAD4" if is_sel else "#94A3B8",
                bg=c_bg,
                font=("Malgun Gothic", 8, "bold"),
            )
            num_l.pack(side="left", padx=(0, 5))

            if st_now != "medium" and kind == "image" and rec.get("thumb_bytes") and Image is not None and ImageTk is not None:
                try:
                    im_p = Image.open(io.BytesIO(rec["thumb_bytes"]))
                    th_p = ImageTk.PhotoImage(im_p, master=root)
                    thumb_refs.append(th_p)
                    tl = tk.Label(card, image=th_p, bg=c_bg, bd=0)
                    tl.pack(side="left", padx=(0, 5))
                except Exception:
                    pass

            if kind == "image":
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
                    lambda _e, r=rec: toast_queue.put((f"__UI3_OCR__|{r.get('img_path','')}", 8000)),
                )
            elif kind == "video":
                has_v_ocr = bool(rec.get("video_ocr_full"))
                vocr_b = tk.Label(
                    card,
                    text="✨글자뽑기" if has_v_ocr else "📝글자뽑기",
                    fg="#0B1120" if has_v_ocr else "#FDE047",
                    bg="#FDE047" if has_v_ocr else "#0B1120",
                    padx=5,
                    pady=1,
                    font=("Malgun Gothic", 8, "bold"),
                    cursor="hand2",
                )
                vocr_b.pack(side="right", padx=(4, 0))
                vocr_b.bind("<Button-1>", lambda _e, r=rec: _open_video_ocr_extractor(r))

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

            # [핵심 보완]: 중형(960x640) 우측 상세 미리보기 칸에 실제 큰 사진/캡처 이미지 미리보기를 선명하게 렌더링!
            if s_kind == "image" and Image is not None and ImageTk is not None:
                big_photo = None
                img_dim_str = ""
                try:
                    if s_fpath and os.path.isfile(s_fpath):
                        with Image.open(s_fpath) as raw_im:
                            img_dim_str = f"{raw_im.width}×{raw_im.height}px"
                            im_copy = raw_im.convert("RGB")
                            im_copy.thumbnail((352, 220))
                            big_photo = ImageTk.PhotoImage(im_copy, master=root)
                    elif sel_rec.get("thumb_bytes"):
                        with Image.open(io.BytesIO(sel_rec["thumb_bytes"])) as raw_tb:
                            im_copy = raw_tb.convert("RGB")
                            im_copy = im_copy.resize((260, 165))
                            big_photo = ImageTk.PhotoImage(im_copy, master=root)
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

            disp_preview_txt = clean_ocr_noise(str(s_txt)) if s_kind == "image" else str(s_txt)
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
                    lambda _e, r=sel_rec: toast_queue.put((f"__UI3_OCR__|{r.get('img_path','')}", 8000)),
                )
            elif sel_rec.get("kind") == "video":
                vocr_jump = tk.Label(
                    preview_pane,
                    text="📝 영상 속 화면 글자 전체 뽑아 복사하기",
                    fg="#0B1120",
                    bg="#FDE047",
                    padx=8,
                    pady=4,
                    font=("Malgun Gothic", 9, "bold"),
                    cursor="hand2",
                )
                vocr_jump.pack(fill="x", pady=2)
                vocr_jump.bind("<Button-1>", lambda _e, r=sel_rec: _open_video_ocr_extractor(r))

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

    _render_search_results()
    _resize_for_stage()
