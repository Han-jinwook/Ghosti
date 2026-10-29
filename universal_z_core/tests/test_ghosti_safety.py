# -*- coding: utf-8 -*-
"""귀신같이 Z-코어 안전 회귀 테스트 (실행: python -m unittest universal_z_core/tests/test_ghosti_safety.py -v)
- 모든 테스트는 임시 폴더에서만 동작하며 유저 실제 폴더를 건드리지 않습니다.
"""
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

OS_AGENT = Path(__file__).resolve().parents[1] / "os_agent"
sys.path.insert(0, str(OS_AGENT))

import plugin_ghosti_os as pg  # noqa: E402

JPEG_BYTES = b"\xff\xd8\xff\xe0" + b"\x00" * 8192 + b"\xff\xd9"


class PhotoListNeverDeletesTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="ghosti_safety_"))
        self._orig_roots = pg._get_user_scan_roots

    def tearDown(self):
        pg._get_user_scan_roots = self._orig_roots
        shutil.rmtree(self.tmp, ignore_errors=True)

    def _make(self, folder: str, name: str) -> Path:
        d = self.tmp / folder
        d.mkdir(parents=True, exist_ok=True)
        p = d / name
        p.write_bytes(JPEG_BYTES)
        return p

    def test_samsung_style_names_in_user_folders_survive_and_are_listed(self):
        files = [
            self._make("Pictures", "20241029_123456.jpg"),
            self._make("Desktop", "20260101_090000.jpg"),
            self._make("Downloads", "Screenshot_20260102.jpg"),
            self._make("Pictures/Camera", "1721441387443.jpg"),
        ]
        pg._get_user_scan_roots = lambda extra="": [self.tmp / "Pictures", self.tmp / "Desktop", self.tmp / "Downloads"]
        out = pg.list_local_photos({})
        for f in files:
            self.assertTrue(f.exists(), f"파일이 삭제됨: {f}")
        listed = {x.get("path") or x.get("name") for x in out.get("files", [])}
        self.assertIn("20241029_123456.jpg", listed)
        self.assertIn("20260101_090000.jpg", listed)

    def test_legacy_names_inside_sample_folder_hidden_but_not_deleted(self):
        legacy = self._make("sample_photos_301", "1721441387443.jpg")
        normal = self._make("sample_photos_301", "IMG_20250510_1001.jpg")
        pg._get_user_scan_roots = lambda extra="": [self.tmp / "sample_photos_301"]
        out = pg.list_local_photos({})
        self.assertTrue(legacy.exists(), "샘플 폴더의 파일도 삭제되면 안 됨")
        listed = {x.get("path") or x.get("name") for x in out.get("files", [])}
        self.assertNotIn("1721441387443.jpg", listed)
        self.assertIn(normal.name, listed)


if __name__ == "__main__":
    unittest.main()
