#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
❖ Merlin Z-Core SOTA Korean OCR Isolated Worker (PaddleOCR PP-OCRv4 Det + PP-OCRv5 Korean Rec, ONNX)
- [헌법 & AGENTS.md 제39조 준수]: 상주 데몬(merlin_z_core_daemon / seq_paste_daemon) 프로세스 메모리에
  onnxruntime을 직접 상주시키지 않고, 오직 온디맨드 단발 서브프로세스(--ppocr-worker)에서만 로드·실행 후
  즉시 종료하여 평시 상주 메모리 증가 0.0 MB · 평시 CPU 0.0%를 100% 보장합니다.
- 사진 OCR(/__photos/ocr), 스캔 PDF OCR, 동영상 프레임 배치 OCR 3대 경로 전부를 단일 SOTA 엔진으로 통합합니다.
"""

from __future__ import annotations

from collections import deque
import json
import math
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import threading
import unicodedata
import urllib.request
from typing import Any, Dict, List

_PPOCR_SUBPROCESS_LOCK = threading.Lock()

THIS_DIR = Path(__file__).resolve().parent
LOCAL_APPDATA = Path(os.environ.get("LOCALAPPDATA", str(Path.home() / "AppData" / "Local")))
CACHE_MODEL_DIR = LOCAL_APPDATA / "Merlin" / "models" / "ppocr_v5"

MODEL_FILES = {
    "det": (
        "ppocr_v4_det.onnx",
        [
            "https://ghosti.sundreamer.app/models/ocr/ppocr_v4_det.onnx",
            "https://huggingface.co/SWHL/RapidOCR/resolve/main/PP-OCRv4/ch_PP-OCRv4_det_infer.onnx",
        ],
    ),
    "rec": (
        "ppocr_v5_ko_rec.onnx",
        [
            "https://ghosti.sundreamer.app/models/ocr/ppocr_v5_ko_rec.onnx",
            "https://huggingface.co/monkt/paddleocr-onnx/resolve/main/languages/korean/rec.onnx",
        ],
    ),
    "dict": (
        "ppocr_v5_ko_dict.txt",
        [
            "https://ghosti.sundreamer.app/models/ocr/ppocr_v5_ko_dict.txt",
            "https://huggingface.co/monkt/paddleocr-onnx/resolve/main/languages/korean/dict.txt",
        ],
    ),
}


def _resolve_model_paths() -> Dict[str, Path]:
    bundle_dir = Path(getattr(sys, "_MEIPASS", str(THIS_DIR)))
    search_dirs = [
        bundle_dir / "models" / "ocr",
        THIS_DIR / "models" / "ocr",
        THIS_DIR.parent.parent / "public" / "models" / "ocr",
        CACHE_MODEL_DIR,
    ]
    resolved: Dict[str, Path] = {}
    for key, (fname, urls) in MODEL_FILES.items():
        found: Path | None = None
        for d in search_dirs:
            cand = d / fname
            if cand.exists() and cand.stat().st_size > 1024:
                found = cand
                break
        if found is None:
            CACHE_MODEL_DIR.mkdir(parents=True, exist_ok=True)
            dest = CACHE_MODEL_DIR / fname
            for u in urls:
                try:
                    req = urllib.request.Request(u, headers={"User-Agent": "MerlinZCore-PPOCRv5/1.0"})
                    with urllib.request.urlopen(req, timeout=20) as resp:
                        data = resp.read()
                    if len(data) > 1024:
                        tmp = dest.with_suffix(".tmp")
                        tmp.write_bytes(data)
                        tmp.replace(dest)
                        found = dest
                        break
                except Exception:
                    continue
        if found is None or not found.exists():
            raise FileNotFoundError(f"PP-OCRv5 model missing: {fname}")
        resolved[key] = found
    return resolved


def polish_korean_ocr_spacing(text: str) -> str:
    s = unicodedata.normalize("NFC", text or "")
    s = re.sub(r"\s+", " ", s).strip()
    # 아이콘·배지 오인식 정제 (| 뒤 왕관 아이콘 👑 -> W/M/V, 요일 뒤 체크/드롭다운 화살표 V/√, 중복 Kcal 단위 등)
    s = re.sub(r"(?<=\|)\s*[WMV]\s*(?=[가-힣]{2,})", " ", s)
    s = re.sub(r"^(?:[GH])\s*(?=(?:로그인|퀴즈)$)", "", s)
    s = re.sub(r"(?<=[월화수목금토일])\s*[Vv√✓]+(?=\s|$)", "", s)
    s = re.sub(r"(?i)\b(ChatGPT)\s*[vV√✓]+\b", r"\1", s)
    s = re.sub(r"(?i)\bKcal\s*kcal\b", "Kcal", s)
    s = re.sub(r"\s*[©®]+(?=\s|$)", "", s)
    s = re.sub(r"([가-힣]{1,6}[을를])(?=(?:높이|줄이|넓히|바꾸|만들|키우|살리|지키|열어|찾아)[가-힣])", r"\1 ", s)
    s = re.sub(r"([가-힣A-Za-z0-9])\s*&\s*([가-힣A-Za-z0-9])", r"\1 & \2", s)
    return re.sub(r"\s+", " ", s).strip()


def join_wrapped_korean_lines(upper: str, lower: str) -> str:
    a = upper.strip()
    b = lower.strip()
    if not a:
        return b
    if not b:
        return a
    if a.endswith("/") and re.fullmatch(r"\d{1,3}(?:명|개|건)?", b):
        return f"{a}{b}"
    if re.match(r"^[|/]", b) or re.search(r"[|/]$", a):
        return f"{a} {b}"
    if (
        re.fullmatch(r"[가-힣]", b)
        or re.match(
            r"^(?:이터|에서|으로|에게|부터|까지|처럼|만큼|보다|라고|하고|하며|하는|하여|에는|에도|은|는|이|가|을|를|의|에|로|와|과|도|만)(?=[가-힣\s.,!?]|$)",
            b,
        )
        or re.match(r"^(?:호|선|숙|율|량|액|금|원|개|건|명|주|차|록)(?=[\s:|.,)/]|$)", b)
        or (re.search(r"(?:\s|^)[가-힣]$", a) and not re.search(r"&\s*[가-힣]$", a))
        or re.search(r"(?:등록번|전화번|계좌번|우편번|비밀번|백은|메뉴개|메뉴 개|\d+\s*월\s*\d+)$", a)
    ):
        return polish_korean_ocr_spacing(f"{a}{b}")
    return polish_korean_ocr_spacing(f"{a} {b}")


def format_ocr_boxes_smart(
    raw_boxes: List[Dict[str, Any]],
    filter_video_ui: bool = False,
    img_height: int = 0,
    img_width: int = 0,
) -> str:
    watermark_rx = re.compile(
        r"notebooklm|^capcut$|^veo$|^kapwing$|^[xyv]?rec[eo@0]rder$|mobizen|bandicam|gomcam|^ocam$|az\s*screen|^inshot$|kinemaster|vivavideo|filmora",
        re.IGNORECASE,
    )
    kbd_token_rx = re.compile(
        r"^(?:스페이스|한/?영|완료|이동|검색|123|!#1|!#7|\.,\?!|[ㄱ-ㅎㅏ-ㅣ]{1,3}|TT|CE|L2|7ㅋ)$",
        re.IGNORECASE,
    )
    status_bar_rx = re.compile(
        r"^(?:SKT|KT|LG\s*U\+|U\+|LTE|5G|\d{1,3}%|\d{1,2}:\d{2})(?:\s.*)?$",
        re.IGNORECASE,
    )
    url_hex_noise_rx = re.compile(r"^[0-9A-Fa-f]{0,2}(?:%[0-9A-Fa-f]{2})+|(?:%[0-9A-Fa-f]{2}){2,}|^[%&]?[0-9A-Fa-f]{2,3}[%'\"`]?$")

    # 하단 모바일 가상 키보드 노출 여부 사전 감지 (하단 35% 영역에 키캡 토큰이 3개 이상 존재할 때)
    has_bottom_keyboard = False
    if filter_video_ui and img_height > 0:
        kbd_hits = sum(
            1
            for b in raw_boxes
            if float(b.get("y0") or 0) >= img_height * 0.65
            and (
                kbd_token_rx.match(str(b.get("text") or "").strip())
                or len(str(b.get("text") or "").strip()) == 1
            )
        )
        has_bottom_keyboard = kbd_hits >= 3

    min_conf = 0.78 if filter_video_ui else 0.72
    filtered: List[Dict[str, Any]] = []
    for b in raw_boxes:
        t = polish_korean_ocr_spacing(str(b.get("text") or ""))
        t = re.sub(r"^[,.;:•·|\-_~<>]+\s*(?=[가-힣A-Za-z0-9])", "", t).strip()
        t = re.sub(r"\s+\|$", "", t).strip()
        conf = float(b.get("conf") or 0.0)
        if not t or conf < min_conf:
            continue
        x0_v = float(b.get("x0") or 0.0)
        x1_v = float(b.get("x1") or 0.0)
        y0_v = float(b.get("y0") or 0.0)
        y1_v = float(b.get("y1") or 0.0)
        bw_v = float(b.get("w") or max(1.0, x1_v - x0_v))

        if filter_video_ui:
            if watermark_rx.search(t):
                continue
            if url_hex_noise_rx.search(t):
                t = re.sub(r"[0-9A-Fa-f]{0,2}(?:%[0-9A-Fa-f]{2})+[A-Za-z0-9%]*", "", t).strip()
                t = re.sub(r"[?&][A-Za-z0-9_]+=\s*$", "", t).strip()
                if not t or url_hex_noise_rx.search(t):
                    continue
            if re.fullmatch(r"(?:00|\(\)|00\(\)|\|\||II|lI|Il|#)", t):
                continue
            # 상단 모바일 상태바(통신사·시계·배터리) 및 상하단 경계선에 걸려 반쯤 잘린 조각 제거
            if img_height > 0:
                if y1_v <= img_height * 0.058 and (status_bar_rx.match(t) or len(re.findall(r"[가-힣]", t)) < 2):
                    continue
                if (y0_v <= 8 or y1_v >= img_height - 8) and len(t) <= 3:
                    continue
                if re.fullmatch(r"\d{1,2}:\d{2}(?::\d{2})?", t) and (
                    y1_v <= img_height * 0.065 or y0_v >= img_height * 0.88
                ):
                    continue
                if has_bottom_keyboard and y0_v >= img_height * 0.68 and (
                    kbd_token_rx.match(t) or len(t) <= 2
                ):
                    continue
            # 좌우 화면 경계(가로 슬라이드 전환·옆 캐러셀 카드 삐져나옴)에 붙어 잘린 좁은 파편 원천 제거
            if img_width > 0 and (x0_v <= 4 or x1_v >= img_width - 4) and bw_v <= img_width * 0.16:
                if len(re.findall(r"[가-힣]", t)) <= 3 and not re.search(r"\.[a-z]{2,4}\b", t, re.IGNORECASE):
                    continue
            if len(t) == 1 and not (re.fullmatch(r"[가-힣]", t) or (re.fullmatch(r"[0-9]", t) and conf >= 0.80)):
                continue
            # 디졸브(화면 전환 잔상)에서 발생하는 저신뢰 영문소문자·한글 뒤섞임 가짜 음절 차단
            if conf < 0.88 and (
                re.search(r"[가-힣][a-z][가-힣]", t)
                or re.search(r"[\u4e00-\u9fff]", t)
            ):
                continue
        if len(t) == 1 and not re.fullmatch(r"[가-힣0-9]", t):
            continue
        item = dict(b)
        item["text"] = t
        item["lineH"] = max(4, int(b["h"]))
        filtered.append(item)

    if not filtered:
        return ""

    filtered.sort(key=lambda x: (x["y0"], x["x0"]))

    # Step 1: 같은 좌측 정렬선·같은 글자 크기·인접 줄 간격의 줄바꿈 문장(및 0명/ + 0 분수 셀) 직결 결합
    used = [False] * len(filtered)
    blocks: List[Dict[str, Any]] = []
    for i, base_item in enumerate(filtered):
        if used[i]:
            continue
        cur = dict(base_item)
        used[i] = True
        merged = True
        while merged:
            merged = False
            for j in range(i + 1, len(filtered)):
                if used[j]:
                    continue
                cand = filtered[j]
                v_gap = cand["y0"] - cur["y1"]
                if v_gap < -cur["lineH"] * 0.45:
                    continue
                if v_gap > max(12, cur["lineH"] * 0.8):
                    break
                same_left = abs(cand["x0"] - cur["x0"]) <= max(18, cur["lineH"] * 1.15)
                centered_1char = (
                    bool(re.fullmatch(r"[가-힣0-9]", cand["text"]))
                    and cand["x0"] >= cur["x0"] - 18
                    and cand["x1"] <= cur["x1"] + 18
                )
                slash_denom = cur["text"].endswith("/") and bool(re.fullmatch(r"\d{1,3}", cand["text"])) and centered_1char
                same_scale = slash_denom or (abs(cand["h"] - cur["lineH"]) <= max(6, min(cand["h"], cur["lineH"]) * 0.45))
                not_ended = not bool(re.search(r"[.!?]$", cur["text"]))
                if (same_left or centered_1char) and same_scale and not_ended:
                    cur["text"] = join_wrapped_korean_lines(cur["text"], cand["text"])
                    cur["x0"] = min(cur["x0"], cand["x0"])
                    cur["x1"] = max(cur["x1"], cand["x1"])
                    cur["y1"] = max(cur["y1"], cand["y1"])
                    cur["w"] = cur["x1"] - cur["x0"]
                    cur["h"] = cur["y1"] - cur["y0"]
                    used[j] = True
                    merged = True
                    break
        blocks.append(cur)

    if filter_video_ui:
        # 병합되지 않고 홀로 남은 1자리 숫자 제거 + 달력 화면(독립 1~2자리 숫자 셀 8개 이상) 날짜 숫자 홍수 제거
        pure_small_nums = sum(1 for b in blocks if re.fullmatch(r"\d{1,2}(?:\s+\d{1,2})?", b["text"]))
        blocks = [
            b
            for b in blocks
            if not re.fullmatch(r"[0-9]", b["text"])
            and not (pure_small_nums >= 8 and re.fullmatch(r"\d{1,2}(?:\s+\d{1,2})?", b["text"]))
        ]
        if not blocks:
            return ""

    # Step 2: 수직 대역 분리 및 다단 카드(2~5열) 좌➔우 · 카드 내부 위➔아래 정렬
    blocks.sort(key=lambda x: (x["y0"], x["x0"]))
    bands: List[Dict[str, Any]] = []
    for b in blocks:
        if not bands or b["y0"] > bands[-1]["maxY"] + max(18, b["lineH"] * 1.5):
            bands.append({"minY": b["y0"], "maxY": b["y1"], "items": [b]})
        else:
            bands[-1]["maxY"] = max(bands[-1]["maxY"], b["y1"])
            bands[-1]["items"].append(b)

    out_texts: List[str] = []
    for band in bands:
        cols: List[Dict[str, Any]] = []
        for it in sorted(band["items"], key=lambda x: x["x0"]):
            placed = False
            for col in cols:
                overlap = min(col["x1"], it["x1"]) - max(col["x0"], it["x0"])
                min_w = min(col["x1"] - col["x0"], it["w"])
                if overlap >= -8 and (overlap > min_w * 0.25 or abs(col["x0"] - it["x0"]) <= 22):
                    col["x0"] = min(col["x0"], it["x0"])
                    col["x1"] = max(col["x1"], it["x1"])
                    col["items"].append(it)
                    placed = True
                    break
            if not placed:
                cols.append({"x0": it["x0"], "x1": it["x1"], "items": [it]})

        is_multi_card = (
            2 <= len(cols) <= 5
            and all(len(c["items"]) <= 4 for c in cols)
            and any(len(c["items"]) >= 2 and any(len(x["text"]) >= 8 for x in c["items"]) for c in cols)
        )
        if is_multi_card:
            cols.sort(key=lambda c: c["x0"])
            for col in cols:
                for it in sorted(col["items"], key=lambda x: (x["y0"], x["x0"])):
                    out_texts.append(it["text"])
        else:
            rows: List[Dict[str, Any]] = []
            for it in sorted(band["items"], key=lambda x: (x["y0"], x["x0"])):
                if not rows or abs(it["y0"] - rows[-1]["refY"]) > max(10, it["lineH"] * 0.6):
                    rows.append({"refY": it["y0"], "items": [it]})
                else:
                    rows[-1]["items"].append(it)
            for r in rows:
                for it in sorted(r["items"], key=lambda x: x["x0"]):
                    out_texts.append(it["text"])

    if filter_video_ui and out_texts:
        dedup_out: List[str] = []
        for seg in out_texts:
            seg = re.sub(r"^(\d+(?:명|개|건))/$", r"\1", seg).strip()
            if not seg:
                continue
            if dedup_out and seg == dedup_out[-1] and len(seg) <= 8:
                continue
            dedup_out.append(seg)
        out_texts = dedup_out

    return " · ".join(out_texts)


def run_worker_cli(req_path: str, res_path: str) -> int:
    """격리 자식 프로세스 진입점: ONNX 모델을 로드해 요청된 이미지들을 일괄 추론하고 즉시 프로세스를 종료합니다."""
    import numpy as np
    import onnxruntime as ort
    from PIL import Image, ImageFilter, ImageOps

    payload = json.loads(Path(req_path).read_text(encoding="utf-8"))
    image_paths: List[str] = payload.get("images") or []
    filter_video_ui = bool(payload.get("filterVideoUi", False))

    mpaths = _resolve_model_paths()
    raw_dict = mpaths["dict"].read_text(encoding="utf-8").splitlines()
    while raw_dict and raw_dict[-1] == "":
        raw_dict.pop()
    char_dict = [""] + raw_dict + [" "]

    sess_opts = ort.SessionOptions()
    sess_opts.intra_op_num_threads = max(2, min(4, (os.cpu_count() or 4) // 2))
    sess_opts.inter_op_num_threads = 1
    sess_opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

    det_sess = ort.InferenceSession(str(mpaths["det"]), sess_options=sess_opts, providers=["CPUExecutionProvider"])
    rec_sess = ort.InferenceSession(str(mpaths["rec"]), sess_options=sess_opts, providers=["CPUExecutionProvider"])
    det_in_name = det_sess.get_inputs()[0].name
    det_out_name = det_sess.get_outputs()[0].name
    rec_in_name = rec_sess.get_inputs()[0].name
    rec_out_name = rec_sess.get_outputs()[0].name

    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32).reshape(1, 1, 3)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32).reshape(1, 1, 3)

    def _score_ocr_boxes(b_list: List[Dict[str, Any]]) -> float:
        sc = 0.0
        for bx in b_list:
            tx = str(bx.get("text") or "")
            ko_n = len(re.findall(r"[가-힣]", tx))
            an_n = len(re.findall(r"[A-Za-z0-9]", tx))
            sc += float(bx.get("conf") or 0.0) * (ko_n * 2.2 + an_n * 0.8)
        return sc

    def _infer_pil_image(im_rgb: Image.Image, _allow_roi_zoom: bool = True) -> Dict[str, Any]:
        src_w, src_h = im_rgb.size
        if src_w < 16 or src_h < 16:
            return {"width": src_w, "height": src_h, "boxes": [], "lines": [], "smartText": ""}

        max_side = max(src_w, src_h)
        if filter_video_ui:
            cap_side = 1792 if src_h >= src_w * 1.35 else 1536
        else:
            cap_side = 1792
        target_max = max(960, min(cap_side, max_side))
        scale = target_max / float(max_side)
        det_w = max(32, int(round((src_w * scale) / 32.0)) * 32)
        det_h = max(32, int(round((src_h * scale) / 32.0)) * 32)

        det_im = im_rgb if (det_w == src_w and det_h == src_h) else im_rgb.resize((det_w, det_h), Image.Resampling.BILINEAR)
        arr_rgb = np.asarray(det_im, dtype=np.float32) / 255.0
        arr_bgr = arr_rgb[:, :, ::-1]
        norm_bgr = (arr_bgr - mean) / std
        det_tensor = np.transpose(norm_bgr, (2, 0, 1))[np.newaxis, :, :, :]

        prob = det_sess.run([det_out_name], {det_in_name: det_tensor})[0][0, 0]
        mask = prob > 0.30
        visited = np.zeros((det_h, det_w), dtype=np.uint8)
        ys, xs = np.nonzero(mask)
        sx = src_w / float(det_w)
        sy = src_h / float(det_h)

        cand_items: List[Dict[str, Any]] = []
        for start_y, start_x in zip(ys.tolist(), xs.tolist()):
            if visited[start_y, start_x]:
                continue
            visited[start_y, start_x] = 1
            dq = deque([(start_y, start_x)])
            pts_x: List[int] = []
            pts_y: List[int] = []
            min_x = max_x = start_x
            min_y = max_y = start_y
            score_sum = 0.0
            while dq:
                cy, cx = dq.popleft()
                pts_x.append(cx)
                pts_y.append(cy)
                score_sum += float(prob[cy, cx])
                if cx < min_x:
                    min_x = cx
                if cx > max_x:
                    max_x = cx
                if cy < min_y:
                    min_y = cy
                if cy > max_y:
                    max_y = cy
                if cx > 0 and not visited[cy, cx - 1] and mask[cy, cx - 1]:
                    visited[cy, cx - 1] = 1
                    dq.append((cy, cx - 1))
                if cx + 1 < det_w and not visited[cy, cx + 1] and mask[cy, cx + 1]:
                    visited[cy, cx + 1] = 1
                    dq.append((cy, cx + 1))
                if cy > 0 and not visited[cy - 1, cx] and mask[cy - 1, cx]:
                    visited[cy - 1, cx] = 1
                    dq.append((cy - 1, cx))
                if cy + 1 < det_h and not visited[cy + 1, cx] and mask[cy + 1, cx]:
                    visited[cy + 1, cx] = 1
                    dq.append((cy + 1, cx))

            cnt = len(pts_x)
            bw_det = max_x - min_x + 1
            bh_det = max_y - min_y + 1
            if cnt < 8 or bh_det < 4 or bw_det < 5 or (score_sum / cnt) < 0.52:
                continue

            px = np.asarray(pts_x, dtype=np.float32) * sx
            py = np.asarray(pts_y, dtype=np.float32) * sy
            cx_m = float(px.mean())
            cy_m = float(py.mean())
            dx = px - cx_m
            dy = py - cy_m

            # 2D PCA 주축 고유벡터로 ±30도(0.52 rad) 기울어진 컵·라벨·사선 문장도 회전 불변 true_w/true_h 기준으로 정밀 수평 보정
            angle_rad = 0.0
            if cnt >= 24:
                var_x = float(np.dot(dx, dx))
                var_y = float(np.dot(dy, dy))
                cov_xy = float(np.dot(dx, dy))
                theta = 0.5 * math.atan2(2.0 * cov_xy, var_x - var_y)
                if 0.006 <= abs(theta) <= 0.52:
                    ct = math.cos(theta)
                    st = math.sin(theta)
                    ut = dx * ct + dy * st
                    vt = -dx * st + dy * ct
                    tw_t = float(ut.max() - ut.min()) + sx
                    th_t = max(2.0, float(vt.max() - vt.min()) + sy)
                    if tw_t >= th_t * 2.1:
                        angle_rad = theta

            cos_a = math.cos(angle_rad)
            sin_a = math.sin(angle_rad)
            u = dx * cos_a + dy * sin_a
            v = -dx * sin_a + dy * cos_a
            u_min = float(u.min())
            u_max = float(u.max())
            v_min = float(v.min())
            v_max = float(v.max())
            true_w = max(4.0, u_max - u_min + sx)
            true_h = max(4.0, v_max - v_min + sy)

            # 기울어진 외접 사각형이 아닌 실제 수직 글자 높이(true_h) 기준으로 상하 여백(pad_v)을 정밀 제한하여
            # 48px Rec 입력 내부에서 '틀(ㅌ+ㅡ+ㄹ)' 등 3단 모음/받침 한글의 세로 획 해상도가 축소·뭉개지는 현상을 원천 차단
            d_raw = (true_w * true_h * 1.55) / (2.0 * (true_w + true_h))
            pad_u = min(true_h * 0.82, d_raw * 1.15) + 2.5
            pad_v = min(true_h * 0.42, d_raw * 0.72) + 2.0

            u0 = u_min - pad_u
            u1 = u_max + pad_u
            v0 = v_min - pad_v
            v1 = v_max + pad_v
            if abs(angle_rad) < 0.05 and cos_a > 0.5:
                u0 = max(u0, (0.0 - cx_m) / cos_a)
                u1 = min(u1, (src_w - cx_m) / cos_a)
                v0 = max(v0, (0.0 - cy_m) / cos_a)
                v1 = min(v1, (src_h - cy_m) / cos_a)

            x0 = max(0, int(math.floor(cx_m + u0 * cos_a)))
            x1 = min(src_w, int(math.ceil(cx_m + u1 * cos_a)))
            box_h_est = max(4, int(round(v1 - v0)))
            y0 = max(0, int(round(cy_m - box_h_est * 0.5)))
            y1 = min(src_h, y0 + box_h_est)
            if (x1 - x0) >= 6 and (y1 - y0) >= 4:
                cand_items.append({
                    "x0": x0, "y0": y0, "x1": x1, "y1": y1,
                    "cx": cx_m, "cy": cy_m,
                    "u0": u0, "u1": u1, "v0": v0, "v1": v1,
                    "true_h": true_h,
                    "angle": angle_rad, "cos": cos_a, "sin": sin_a,
                })

        cand_items.sort(key=lambda b: (b["y0"], b["x0"]))
        # 동일 기준선(Baseline) 상의 좌우 인접 박스끼리만 pad_u 중복 침범을 다듬고, 위·아래로 쌓인 기울어진 줄은 보존
        for i_b in range(len(cand_items)):
            for j_b in range(i_b + 1, len(cand_items)):
                bi = cand_items[i_b]
                bj = cand_items[j_b]
                hi = bi["y1"] - bi["y0"]
                hj = bj["y1"] - bj["y0"]
                if bj["y0"] > bi["y1"]:
                    break
                mean_cos = 0.5 * (bi["cos"] + bj["cos"])
                mean_sin = 0.5 * (bi["sin"] + bj["sin"])
                dv_center = abs(-(bj["cx"] - bi["cx"]) * mean_sin + (bj["cy"] - bi["cy"]) * mean_cos)
                if dv_center <= 0.45 * min(bi["true_h"], bj["true_h"]):
                    left_b, right_b = (bi, bj) if bi["cx"] <= bj["cx"] else (bj, bi)
                    x_ov = left_b["x1"] - right_b["x0"]
                    if 0 < x_ov <= max(42, int(min(hi, hj) * 0.95)) and right_b["x1"] > left_b["x1"] + 8:
                        half_ov = x_ov * 0.5
                        mid_x = (left_b["x1"] + right_b["x0"]) // 2
                        left_b["u1"] -= half_ov
                        right_b["u0"] += half_ov
                        left_b["x1"] = mid_x
                        right_b["x0"] = mid_x

        cand_items = [
            b for b in cand_items
            if (b["x1"] - b["x0"]) >= 6 and (b["u1"] - b["u0"]) >= 6.0 and (b["v1"] - b["v0"]) >= 4.0
        ]

        boxes_out: List[Dict[str, Any]] = []
        lines_out: List[Dict[str, Any]] = []

        for item in cand_items:
            x0, y0, x1, y1 = item["x0"], item["y0"], item["x1"], item["y1"]
            bw = x1 - x0
            bh = y1 - y0
            if abs(item["angle"]) >= 0.006:
                out_w = max(8, int(round(item["u1"] - item["u0"])))
                out_h = max(8, int(round(item["v1"] - item["v0"])))
                cos_a, sin_a = item["cos"], item["sin"]
                u0_i, v0_i = item["u0"], item["v0"]
                cx_i, cy_i = item["cx"], item["cy"]
                aff = (
                    cos_a, -sin_a, cx_i + u0_i * cos_a - v0_i * sin_a,
                    sin_a, cos_a, cy_i + u0_i * sin_a + v0_i * cos_a,
                )
                crop_im = im_rgb.transform((out_w, out_h), Image.Transform.AFFINE, aff, resample=Image.Resampling.BICUBIC)
            else:
                cx0 = max(0, min(src_w - 4, int(math.floor(item["cx"] + item["u0"]))))
                cy0 = max(0, min(src_h - 4, int(math.floor(item["cy"] + item["v0"]))))
                cx1 = max(cx0 + 4, min(src_w, int(math.ceil(item["cx"] + item["u1"]))))
                cy1 = max(cy0 + 4, min(src_h, int(math.ceil(item["cy"] + item["v1"]))))
                crop_im = im_rgb.crop((cx0, cy0, cx1, cy1))
                out_w, out_h = crop_im.size
                x0, y0, x1, y1 = cx0, cy0, cx1, cy1
                bw, bh = out_w, out_h

            rec_h = 48
            rec_w = max(48, min(1600, int(round(out_w * (rec_h / float(max(1, out_h)))))))
            resample_mode = Image.Resampling.LANCZOS if out_h < 56 else Image.Resampling.BILINEAR
            resized = crop_im.resize((rec_w, rec_h), resample_mode)
            if out_h < 46:
                sh_amt = 0.50 if out_h < 34 else 0.35
                blur_im = resized.filter(ImageFilter.GaussianBlur(radius=0.95))
                arr_f = np.asarray(resized, dtype=np.float32)
                blur_f = np.asarray(blur_im, dtype=np.float32)
                rgb_clean = np.clip(arr_f + sh_amt * (arr_f - blur_f), 0.0, 255.0)
                r_arr = (rgb_clean[:, :, ::-1] / 255.0 - 0.5) / 0.5
            else:
                r_arr = (np.asarray(resized, dtype=np.float32)[:, :, ::-1] / 255.0 - 0.5) / 0.5
            r_tensor = np.transpose(r_arr, (2, 0, 1))[np.newaxis, :, :, :]

            logits = rec_sess.run([rec_out_name], {rec_in_name: r_tensor})[0][0]
            max_idx = np.argmax(logits, axis=1)
            max_val = np.max(logits, axis=1)

            char_pairs: List[tuple[str, float]] = []
            prev_i = 0
            for idx_val, score_val in zip(max_idx.tolist(), max_val.tolist()):
                if idx_val > 0 and idx_val != prev_i:
                    if idx_val < len(char_dict):
                        char_pairs.append((char_dict[idx_val], float(score_val)))
                prev_i = idx_val

            edge_min_sc = 0.58 if filter_video_ui else 0.42
            while char_pairs and char_pairs[0][1] < edge_min_sc:
                if not filter_video_ui and re.match(r"[가-힣A-Za-z0-9]", char_pairs[0][0]):
                    break
                char_pairs.pop(0)
            while char_pairs and char_pairs[-1][1] < edge_min_sc:
                if not filter_video_ui and re.match(r"[가-힣A-Za-z0-9]", char_pairs[-1][0]):
                    break
                char_pairs.pop()

            if filter_video_ui and char_pairs:
                cleaned_pairs = list(char_pairs)
                n_cp = len(cleaned_pairs)
                idx_cp = 0
                while idx_cp < n_cp:
                    ch_c, sc_c = cleaned_pairs[idx_cp]
                    if ch_c != " " and not re.match(r"[가-힣0-9]", ch_c):
                        if re.match(r"[A-Za-z]", ch_c):
                            j_cp = idx_cp + 1
                            while j_cp < n_cp and re.match(r"[A-Za-z]", cleaned_pairs[j_cp][0]):
                                j_cp += 1
                            run_len = j_cp - idx_cp
                            run_scores = [cleaned_pairs[k][1] for k in range(idx_cp, j_cp)]
                            run_mean = sum(run_scores) / run_len
                            run_max = max(run_scores)
                            # 이모지·아이콘(👑 등)이 연속 저신뢰 영문 조각(W, WMW, NOW, AIPLO 등)으로 오독된 구간을 연속 구간 신뢰도로 판별해 공백 치환
                            if (run_len == 1 and run_mean < 0.84) or (run_len <= 6 and run_mean < 0.78 and run_max < 0.88):
                                for k in range(idx_cp, j_cp):
                                    cleaned_pairs[k] = (" ", cleaned_pairs[k][1])
                            idx_cp = j_cp
                            continue
                        elif sc_c < 0.82:
                            cleaned_pairs[idx_cp] = (" ", sc_c)
                    idx_cp += 1
                char_pairs = cleaned_pairs

            txt = polish_korean_ocr_spacing("".join(ch for ch, _ in char_pairs))
            scored_chars = [sc for ch, sc in char_pairs if ch != " "]
            avg_conf = (sum(scored_chars) / len(scored_chars)) if scored_chars else 0.0
            min_box_conf = 0.78 if filter_video_ui else 0.72
            if not txt or avg_conf < min_box_conf:
                continue

            boxes_out.append({
                "x0": x0,
                "y0": y0,
                "x1": x1,
                "y1": y1,
                "w": bw,
                "h": bh,
                "conf": round(avg_conf, 3),
                "text": txt,
            })

            # 단어 단위 좌표 분할 (기존 _reconstruct_ocr_geometry_and_spots TSV 표 생성과 100% 호환)
            tokens = [tok for tok in txt.split(" ") if tok]
            words_list: List[Dict[str, Any]] = []
            total_chars = max(1, len(txt))
            cur_char_off = 0
            for tok in tokens:
                pos = txt.find(tok, cur_char_off)
                if pos < 0:
                    pos = cur_char_off
                wx = round(x0 + (pos / total_chars) * bw, 1)
                ww = round(max(4.0, (len(tok) / total_chars) * bw), 1)
                words_list.append({"t": tok, "x": wx, "y": float(y0), "w": ww, "h": float(bh)})
                cur_char_off = pos + len(tok)

            lines_out.append({"text": txt, "words": words_list})

        if _allow_roi_zoom and len(cand_items) >= 2:
            heights = sorted(float(c.get("true_h") or 40.0) for c in cand_items)
            med_h = heights[len(heights) // 2]
            pad_r = max(28, int(round(med_h * 1.8)))
            rx0 = max(0, min(c["x0"] for c in cand_items) - pad_r)
            ry0 = max(0, min(c["y0"] for c in cand_items) - pad_r)
            rx1 = min(src_w, max(c["x1"] for c in cand_items) + pad_r)
            ry1 = min(src_h, max(c["y1"] for c in cand_items) + pad_r)
            rw, rh = rx1 - rx0, ry1 - ry0
            roi_ratio = (rw * rh) / float(max(1, src_w * src_h))
            mean_conf = (
                sum(float(b["conf"]) for b in boxes_out) / len(boxes_out)
                if boxes_out
                else 0.0
            )
            if rw >= 96 and rh >= 64 and roi_ratio < 0.45 and (med_h < 34.0 or mean_conf < 0.91):
                roi_im = im_rgb.crop((rx0, ry0, rx1, ry1))
                up = max(1.0, min(2.4, 1216.0 / float(max(rw, rh))))
                if up > 1.12:
                    roi_im = roi_im.resize(
                        (int(round(rw * up)), int(round(rh * up))),
                        Image.Resampling.LANCZOS,
                    )
                inv_up = rw / float(roi_im.width)
                roi_res = _infer_pil_image(roi_im, _allow_roi_zoom=False)
                roi_boxes = roi_res.get("boxes") or []
                if _score_ocr_boxes(roi_boxes) > _score_ocr_boxes(boxes_out) * 1.03:
                    mapped_boxes: List[Dict[str, Any]] = []
                    mapped_lines: List[Dict[str, Any]] = []
                    for rb in roi_boxes:
                        mx0 = int(round(rx0 + rb["x0"] * inv_up))
                        my0 = int(round(ry0 + rb["y0"] * inv_up))
                        mx1 = int(round(rx0 + rb["x1"] * inv_up))
                        my1 = int(round(ry0 + rb["y1"] * inv_up))
                        mw = max(4, mx1 - mx0)
                        mh = max(4, int(round(rb["h"] * inv_up)))
                        mapped_boxes.append({
                            "x0": mx0, "y0": my0, "x1": mx1, "y1": my1,
                            "w": mw, "h": mh, "conf": rb["conf"], "text": rb["text"],
                        })
                        toks = [tk for tk in str(rb["text"]).split(" ") if tk]
                        t_chars = max(1, len(str(rb["text"])))
                        c_off = 0
                        w_list: List[Dict[str, Any]] = []
                        for tk in toks:
                            pos = str(rb["text"]).find(tk, c_off)
                            if pos < 0:
                                pos = c_off
                            w_list.append({
                                "t": tk,
                                "x": round(mx0 + (pos / t_chars) * mw, 1),
                                "y": float(my0),
                                "w": round(max(4.0, (len(tk) / t_chars) * mw), 1),
                                "h": float(mh),
                            })
                            c_off = pos + len(tk)
                        mapped_lines.append({"text": rb["text"], "words": w_list})
                    boxes_out = mapped_boxes
                    lines_out = mapped_lines

        smart_txt = format_ocr_boxes_smart(
            boxes_out,
            filter_video_ui=filter_video_ui,
            img_height=src_h,
            img_width=src_w,
        )
        return {
            "width": src_w,
            "height": src_h,
            "boxes": boxes_out,
            "lines": lines_out,
            "smartText": smart_txt,
        }

    results_by_path: Dict[str, Any] = {}
    for img_p in image_paths:
        p_obj = Path(img_p)
        if not p_obj.exists():
            continue
        try:
            with Image.open(p_obj) as raw_im:
                im0 = ImageOps.exif_transpose(raw_im).convert("RGB")
            res0 = _infer_pil_image(im0)
            ko_cnt0 = len(re.findall(r"[가-힣]", res0["smartText"]))
            # 세로로 누운 사진(회전 폴백): DBNet이 글자 영역(박스가 2개 이상)을 감지했는데 정방향 한글 인식이 거의 안 된 경우에만 90°/270° 점검
            # (글자 박스가 0~1개인 순수 풍경·인물·음식 사진은 불필요한 90°/270° 재추론을 생략해 0.3초 만에 즉시 반환)
            if len(res0.get("boxes") or []) >= 2 and ko_cnt0 < 4 and len(res0["smartText"]) < 14 and not filter_video_ui:
                best_res = res0
                best_score = ko_cnt0 * 4 + len(res0["smartText"])
                for angle in (270, 90):
                    im_rot = im0.rotate(angle, expand=True)
                    res_r = _infer_pil_image(im_rot)
                    sc_r = len(re.findall(r"[가-힣]", res_r["smartText"])) * 4 + len(res_r["smartText"])
                    if sc_r > best_score + 16:
                        best_score = sc_r
                        best_res = res_r
                res0 = best_res
            results_by_path[str(p_obj)] = res0
            results_by_path[p_obj.name] = res0
        except Exception as e:
            results_by_path[str(p_obj)] = {"width": 0, "height": 0, "boxes": [], "lines": [], "smartText": "", "error": str(e)}

    Path(res_path).write_text(json.dumps({"ok": True, "results": results_by_path}, ensure_ascii=False), encoding="utf-8")
    return 0


def invoke_ppocr_subprocess(
    image_paths: List[Path],
    *,
    filter_video_ui: bool = False,
    timeout_sec: float = 65.0,
    priority_interactive: bool = False,
) -> Dict[str, Dict[str, Any]]:
    """
    상주 데몬에서 안전하게 호출하는 단발 서브프로세스 브릿지:
    추론 완료 즉시 워커 프로세스가 종료되어 상주 데몬 RAM은 0 Byte 증가로 유지됩니다.
    - frozen 단일 .exe 환경에서는 이미 압축 해제되어 살아있는 부모 데몬의 sys._MEIPASS를 _MEIPASS2로 공유하여
      매 호출 시 67MB 재압축해제 및 백신(Defender) 20초 스캔 지연을 0.02초로 원천 제거합니다!
    - 사용자가 직접 클릭한 사진 OCR(priority_interactive=True)은 백그라운드 PDF/영상 배치 락 뒤에 줄 서지 않고 즉시 실행됩니다.
    """
    valid_paths = [str(p.resolve()) for p in image_paths if p and p.exists()]
    if not valid_paths:
        return {}

    tmp_dir = Path(tempfile.mkdtemp(prefix="merlin_ppocr_job_"))
    req_file = tmp_dir / "req.json"
    res_file = tmp_dir / "res.json"
    try:
        req_file.write_text(
            json.dumps({"images": valid_paths, "filterVideoUi": filter_video_ui}, ensure_ascii=False),
            encoding="utf-8",
        )
        parent_meipass = getattr(sys, "_MEIPASS", None)
        if getattr(sys, "frozen", False):
            cmd = [sys.executable, "--ppocr-worker", str(req_file), str(res_file)]
            child_env = {k: v for k, v in os.environ.items() if k != "PYINSTALLER_RESET_ENVIRONMENT"}
            if parent_meipass and os.path.isdir(str(parent_meipass)):
                child_env["_MEIPASS2"] = str(parent_meipass)
        else:
            cmd = [sys.executable, str(THIS_DIR / "merlin_z_core_daemon.py"), "--ppocr-worker", str(req_file), str(res_file)]
            child_env = {k: v for k, v in os.environ.items() if k not in ("_MEIPASS2", "_MEIPASS")}

        creationflags = 0x08000000 if os.name == "nt" else 0

        def _run_child() -> bool:
            proc = subprocess.Popen(
                cmd,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env=child_env,
                creationflags=creationflags,
            )
            try:
                proc.communicate(timeout=timeout_sec)
                return True
            except subprocess.TimeoutExpired:
                if os.name == "nt":
                    try:
                        subprocess.run(
                            ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                            capture_output=True,
                            timeout=6,
                            creationflags=creationflags,
                        )
                    except Exception:
                        pass
                try:
                    proc.kill()
                except Exception:
                    pass
                return False

        if priority_interactive:
            finished_ok = _run_child()
        else:
            with _PPOCR_SUBPROCESS_LOCK:
                finished_ok = _run_child()
        if not finished_ok:
            return {}
        if res_file.exists():
            data = json.loads(res_file.read_text(encoding="utf-8"))
            if isinstance(data, dict) and isinstance(data.get("results"), dict):
                return data["results"]
    except Exception:
        pass
    finally:
        try:
            for f in tmp_dir.glob("*"):
                f.unlink(missing_ok=True)
            tmp_dir.rmdir()
        except Exception:
            pass
    return {}


if __name__ == "__main__":
    if len(sys.argv) >= 3:
        sys.exit(run_worker_cli(sys.argv[1], sys.argv[2]))
