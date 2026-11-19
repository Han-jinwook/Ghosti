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
    s = re.sub(r"([가-힣]{1,6}[을를])(?=(?:높이|줄이|넓히|바꾸|만들|키우|살리|지키|열어|찾아)[가-힣])", r"\1 ", s)
    s = re.sub(r"([가-힣A-Za-z0-9])\s*&\s*([가-힣A-Za-z0-9])", r"\1 & \2", s)
    return s


def join_wrapped_korean_lines(upper: str, lower: str) -> str:
    a = upper.strip()
    b = lower.strip()
    if not a:
        return b
    if not b:
        return a
    if re.match(r"^[|/]", b) or re.search(r"[|/]$", a):
        return f"{a} {b}"
    if (
        re.fullmatch(r"[가-힣]", b)
        or re.match(
            r"^(?:이터|에서|으로|에게|부터|까지|처럼|만큼|보다|라고|하고|하며|하는|하여|에는|에도|은|는|이|가|을|를|의|에|로|와|과|도|만)(?=[가-힣\s.,!?]|$)",
            b,
        )
        or re.match(r"^(?:호|선|숙|율|량|액|금|원|개|건|명)(?=[\s:|.,)/]|$)", b)
        or (re.search(r"(?:\s|^)[가-힣]$", a) and not re.search(r"&\s*[가-힣]$", a))
        or re.search(r"(?:등록번|전화번|계좌번|우편번|비밀번|백은|메뉴개|메뉴 개)$", a)
    ):
        return polish_korean_ocr_spacing(f"{a}{b}")
    return polish_korean_ocr_spacing(f"{a} {b}")


def format_ocr_boxes_smart(raw_boxes: List[Dict[str, Any]], filter_video_ui: bool = False, img_height: int = 0) -> str:
    watermark_rx = re.compile(
        r"notebooklm|^capcut$|^veo$|^kapwing$|^[xyv]?rec[eo]rder$|mobizen|bandicam|gomcam|^ocam$|az\s*screen|^inshot$|kinemaster|vivavideo|filmora",
        re.IGNORECASE,
    )
    min_conf = 0.78 if filter_video_ui else 0.72
    filtered: List[Dict[str, Any]] = []
    for b in raw_boxes:
        t = polish_korean_ocr_spacing(str(b.get("text") or ""))
        t = re.sub(r"^[,.;:•·|\-_~]+\s*(?=[가-힣A-Za-z0-9])", "", t).strip()
        conf = float(b.get("conf") or 0.0)
        if not t or conf < min_conf:
            continue
        if filter_video_ui:
            if watermark_rx.search(t):
                continue
            if re.fullmatch(r"(?:10|0|00|\(\)|00\(\)|\|\||II|lI|Il)", t):
                continue
            if img_height > 0 and re.fullmatch(r"\d{1,2}:\d{2}(?::\d{2})?", t):
                if float(b.get("y1") or 0) <= img_height * 0.065 or float(b.get("y0") or 0) >= img_height * 0.88:
                    continue
            if len(t) == 1 and not re.fullmatch(r"[가-힣]", t):
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

    # Step 1: 같은 좌측 정렬선·같은 글자 크기·인접 줄 간격의 줄바꿈 문장 직결 결합
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
                    bool(re.fullmatch(r"[가-힣]", cand["text"]))
                    and cand["x0"] >= cur["x0"] - 18
                    and cand["x1"] <= cur["x1"] + 18
                )
                same_scale = abs(cand["h"] - cur["lineH"]) <= max(4, min(cand["h"], cur["lineH"]) * 0.35)
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

    return " · ".join(out_texts)


def run_worker_cli(req_path: str, res_path: str) -> int:
    """격리 자식 프로세스 진입점: ONNX 모델을 로드해 요청된 이미지들을 일괄 추론하고 즉시 프로세스를 종료합니다."""
    import numpy as np
    import onnxruntime as ort
    from PIL import Image, ImageOps

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

    def _infer_pil_image(im_rgb: Image.Image) -> Dict[str, Any]:
        src_w, src_h = im_rgb.size
        if src_w < 16 or src_h < 16:
            return {"width": src_w, "height": src_h, "boxes": [], "lines": [], "smartText": ""}

        max_side = max(src_w, src_h)
        cap_side = 1280 if filter_video_ui else 1600
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

        cand_boxes: List[tuple[int, int, int, int]] = []
        for start_y, start_x in zip(ys.tolist(), xs.tolist()):
            if visited[start_y, start_x]:
                continue
            visited[start_y, start_x] = 1
            dq = deque([(start_y, start_x)])
            min_x = max_x = start_x
            min_y = max_y = start_y
            score_sum = 0.0
            cnt = 0
            while dq:
                cy, cx = dq.popleft()
                score_sum += float(prob[cy, cx])
                cnt += 1
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

            bw = max_x - min_x + 1
            bh = max_y - min_y + 1
            if cnt < 8 or bh < 4 or bw < 5 or (score_sum / cnt) < 0.52:
                continue
            area = bw * bh
            perim = 2 * (bw + bh)
            pad_x = int(round((area * 1.65) / perim)) + 2
            pad_y = int(round((area * 1.60) / perim)) + 1
            x0 = max(0, int(math.floor(((min_x - pad_x) / det_w) * src_w)))
            y0 = max(0, int(math.floor(((min_y - pad_y) / det_h) * src_h)))
            x1 = min(src_w, int(math.ceil(((max_x + pad_x) / det_w) * src_w)))
            y1 = min(src_h, int(math.ceil(((max_y + pad_y) / det_h) * src_h)))
            if (x1 - x0) >= 4 and (y1 - y0) >= 4:
                cand_boxes.append((x0, y0, x1, y1))

        cand_boxes.sort(key=lambda b: (b[1], b[0]))
        boxes_out: List[Dict[str, Any]] = []
        lines_out: List[Dict[str, Any]] = []

        for (x0, y0, x1, y1) in cand_boxes:
            bw = x1 - x0
            bh = y1 - y0
            crop_im = im_rgb.crop((x0, y0, x1, y1))
            rec_h = 48
            rec_w = max(48, min(1600, int(round(bw * (rec_h / float(bh))))))
            resample_mode = Image.Resampling.BICUBIC if bh < 36 else Image.Resampling.BILINEAR
            resized = crop_im.resize((rec_w, rec_h), resample_mode)
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

            while char_pairs and char_pairs[0][1] < 0.42 and not re.match(r"[가-힣A-Za-z0-9]", char_pairs[0][0]):
                char_pairs.pop(0)
            while char_pairs and char_pairs[-1][1] < 0.42 and not re.match(r"[가-힣A-Za-z0-9]", char_pairs[-1][0]):
                char_pairs.pop()

            txt = unicodedata.normalize("NFC", "".join(ch for ch, _ in char_pairs)).strip()
            avg_conf = (sum(sc for _, sc in char_pairs) / len(char_pairs)) if char_pairs else 0.0
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

        smart_txt = format_ocr_boxes_smart(boxes_out, filter_video_ui=filter_video_ui, img_height=src_h)
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
            # 세로로 누운 사진(회전 폴백): 한글이 거의 없을 때만 90°/270° 점검
            if ko_cnt0 < 4 and len(res0["smartText"]) < 14 and not filter_video_ui:
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
) -> Dict[str, Dict[str, Any]]:
    """
    상주 데몬에서 안전하게 호출하는 단발 서브프로세스 브릿지:
    추론 완료 즉시 워커 프로세스가 종료되어 상주 데몬 RAM은 0 Byte 증가로 유지됩니다.
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
        if getattr(sys, "frozen", False):
            cmd = [sys.executable, "--ppocr-worker", str(req_file), str(res_file)]
        else:
            cmd = [sys.executable, str(THIS_DIR / "merlin_z_core_daemon.py"), "--ppocr-worker", str(req_file), str(res_file)]

        creationflags = 0x08000000 if os.name == "nt" else 0
        clean_env = {k: v for k, v in os.environ.items() if k not in ("_MEIPASS2", "_MEIPASS")}
        clean_env["PYINSTALLER_RESET_ENVIRONMENT"] = "1"
        with _PPOCR_SUBPROCESS_LOCK:
            proc = subprocess.Popen(
                cmd,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env=clean_env,
                creationflags=creationflags,
            )
            try:
                proc.communicate(timeout=timeout_sec)
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
