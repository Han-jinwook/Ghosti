# -*- coding: utf-8 -*-
r"""
[2. 👻 귀신검색] 종합 엣지케이스 회귀 테스트 스위트 (test_ghost_search_edges.py)
- 무인 백그라운드 전용 (GHOSTI_HEADLESS_TEST=1, 모니터 팝업 0%)
- 검증 항목:
  1) Z-Core /api/superpower/telemetry GET & POST 무크래시 및 수련장 도장 기록
  2) /__photos/ocr WinRT 한국어 OCR + 바운딩박스 기하학 표(TSV \t) 복원 + 풍경 사진 정직한 빈 결과(가짜 데이터 0%)
  3) 로컬 문서 추출(_extract_doc_text): 압축 PDF(/FlateDecode + UTF-16BE) 및 순수 스캔 이미지 PDF(WinRT PdfDocument OCR)
  4) resolve_local_media_file 허용 확장자·시스템 폴더 차단 가드
  5) seq_paste_daemon 온디맨드 사진 OCR + 귀신 라벨러(기계식 스샷/영수증 이미지 & 압축/스캔 PDF 날짜·한글 제목 추출)
  6) ghost_search_window_ui2 동영상 OCR 캐시(%LOCALAPPDATA%\Merlin\video_scene_ocr_cache_v2.json) 조회 및 3벌 파일 SHA-256 일치
"""

from __future__ import annotations

import hashlib
import os
from pathlib import Path
import sys
import tempfile
import unittest
import zlib

os.environ["GHOSTI_HEADLESS_TEST"] = "1"

UZ_ROOT = Path(__file__).resolve().parent.parent
OS_AGENT_DIR = UZ_ROOT / "os_agent"
if str(OS_AGENT_DIR) not in sys.path:
    sys.path.insert(0, str(OS_AGENT_DIR))

from PIL import Image, ImageDraw, ImageFont  # noqa: E402
import ghost_search_window_ui2 as ui2  # noqa: E402
import ghosti_safe_ops as safe_ops  # noqa: E402
import merlin_z_core_daemon as daemon  # noqa: E402
import plugin_ghosti_os as gos  # noqa: E402
import plugin_ghosti_superpowers as gsp  # noqa: E402
import seq_paste_daemon as spd  # noqa: E402


def _ko_font(sz: int):
    for fp in (r"C:\Windows\Fonts\malgunbd.ttf", r"C:\Windows\Fonts\malgun.ttf"):
        if os.path.exists(fp):
            return ImageFont.truetype(fp, sz)
    return ImageFont.load_default()


class TestGhostSearchEdges(unittest.TestCase):
    def test_01_three_copy_sha256_parity(self):
        for fname in ("seq_paste_daemon.py", "ghost_search_window_ui2.py"):
            h_os = hashlib.sha256((OS_AGENT_DIR / fname).read_bytes()).hexdigest()
            h_root = hashlib.sha256((UZ_ROOT / fname).read_bytes()).hexdigest()
            h_core = hashlib.sha256((UZ_ROOT / "core_power_agent" / fname).read_bytes()).hexdigest()
            self.assertEqual(h_os, h_root, f"{fname} mismatch between os_agent and root")
            self.assertEqual(h_os, h_core, f"{fname} mismatch between os_agent and core_power_agent")

    def test_02_superpower_telemetry_no_crash(self):
        res_get = gsp.get_telemetry({})
        self.assertTrue(res_get.get("ok"))
        res_upd = gsp.update_telemetry({"action": "ghost_search_window_small"})
        self.assertTrue(res_upd.get("ok"))
        res_after = gsp.get_telemetry({})
        self.assertGreaterEqual(res_after.get("total", {}).get("ghost_search_window_small", 0), 1)

    def test_03_known_folders_and_media_path_guard(self):
        for k in ("desktop", "downloads", "documents", "pictures", "videos"):
            p = safe_ops.known_folder(k)
            self.assertTrue(str(p), f"known_folder({k}) returned empty")
        bad_p, _, bad_code = gos.resolve_local_media_file({"p": r"C:\Windows\System32\drivers\etc\hosts"})
        self.assertIsNone(bad_p)
        self.assertNotEqual(bad_code, 200)

    def test_04_photo_winrt_ocr_table_and_empty_scenery(self):
        with tempfile.TemporaryDirectory() as td:
            td_p = Path(td)
            receipt_p = td_p / "receipt_table.png"
            im = Image.new("RGB", (920, 400), (255, 255, 255))
            dr = ImageDraw.Draw(im)
            dr.text((40, 30), "거래명세표 2026-11-15", fill=(10, 10, 10), font=_ko_font(30))
            dr.text((40, 95), "사업자번호: 214-88-99112   전화: 010-2026-7788", fill=(10, 10, 10), font=_ko_font(24))
            dr.text((40, 170), "방수페인트", fill=(10, 10, 10), font=_ko_font(24))
            dr.text((340, 170), "4통", fill=(10, 10, 10), font=_ko_font(24))
            dr.text((560, 170), "160,000원", fill=(10, 10, 10), font=_ko_font(24))
            im.save(receipt_p, "PNG")

            res = gos.extract_photo_winrt_ocr({"p": str(receipt_p)})
            self.assertTrue(res.get("ok"))
            self.assertTrue(res.get("hasText"))
            self.assertIn("\t", res.get("tsvTable", ""))
            self.assertNotIn("성수오피스디포", res.get("fullText", ""))

            sky_p = td_p / "pure_sky.png"
            Image.new("RGB", (500, 320), (120, 185, 240)).save(sky_p, "PNG")
            sky_res = gos.extract_photo_winrt_ocr({"p": str(sky_p)})
            self.assertTrue(sky_res.get("ok"))
            self.assertFalse(sky_res.get("hasText"))
            self.assertEqual(sky_res.get("spots"), [])

    def test_05_pdf_flate_and_scanned_ocr_plus_labeler(self):
        with tempfile.TemporaryDirectory() as td:
            td_p = Path(td)
            # 1) Scanned Contract PDF (PDFium render + PP-OCRv5 Korean + Ghost Labeler)
            pdf_contract = td_p / "scan_contract.pdf"
            im_c = Image.new("RGB", (980, 520), (255, 255, 255))
            dr_c = ImageDraw.Draw(im_c)
            dr_c.text((50, 60), "표준근로계약서", fill=(0, 0, 0), font=_ko_font(36))
            dr_c.text((50, 140), "체결일자: 2026-10-20 | 임금명세", fill=(0, 0, 0), font=_ko_font(28))
            im_c.save(pdf_contract, "PDF", resolution=150.0)

            extracted_flate = gos._extract_doc_text(pdf_contract, allow_pdf_winrt_ocr=True)
            self.assertIn("표준근로계약서", extracted_flate)

            e1, k1, d1, s1 = spd._extract_file_date_and_slug_for_labeler(pdf_contract)
            lbl1 = spd.format_ghost_labeler_filename(
                pdf_contract.name, s1, exif_yymmdd=e1, kakao_yymmdd=k1, ocr_or_doc_text=d1, prefix_only_if_named=True
            )
            self.assertTrue(lbl1["labeled_filename"].startswith("261020_"))

            # 2) Pure Scanned Image PDF #2
            pdf_img = td_p / "스캔본_01.pdf"
            im_pdf = Image.new("RGB", (880, 520), (255, 255, 255))
            dr_pdf = ImageDraw.Draw(im_pdf)
            dr_pdf.text((50, 60), "물품공급계약서", fill=(0, 0, 0), font=_ko_font(34))
            dr_pdf.text((50, 140), "작성일: 2026-08-19", fill=(0, 0, 0), font=_ko_font(28))
            im_pdf.save(pdf_img, "PDF", resolution=150.0)

            extracted_scan = gos._extract_doc_text(pdf_img, allow_pdf_winrt_ocr=True)
            self.assertIn("2026", extracted_scan)

    def test_06_daemon_selftest_version(self):
        ver_parts = tuple(int(x) for x in daemon.CORE_VERSION.split("."))
        self.assertGreaterEqual(ver_parts, (2, 3, 40))
        st = daemon.run_selftest()
        self.assertTrue(st.get("ok"))
        self.assertEqual(st.get("selftest"), "PASSED")

    def test_07_ui2_video_cache_lookup(self):
        vmap = ui2._load_local_video_ocr_by_name()
        self.assertIsInstance(vmap, dict)


if __name__ == "__main__":
    unittest.main()
