# -*- coding: utf-8 -*-
"""귀신같이 Z-코어 치우기·고치기 실물 동작 통합 테스트
실행: python -m unittest universal_z_core/tests/test_safe_ops.py -v
- 임시 폴더만 사용합니다. 휴지통으로 보낸 테스트 파일은 테스트 안에서 다시 복원하여 휴지통에 흔적을 남기지 않습니다.
"""
import os
import shutil
import sys
import tempfile
import time
import unittest
from pathlib import Path

OS_AGENT = Path(__file__).resolve().parents[1] / "os_agent"
sys.path.insert(0, str(OS_AGENT))

import ghosti_safe_ops as safe  # noqa: E402
import plugin_ghosti_os as pg  # noqa: E402
import merlin_z_core_daemon as daemon  # noqa: E402


class _TempEnv(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="ghosti_ops_"))
        self.desktop = self.tmp / "Desktop"
        self.downloads = self.tmp / "Downloads"
        self.desktop.mkdir()
        self.downloads.mkdir()
        self._orig = (safe.known_folder, safe.RESTORE_POINTS_FILE, safe.RECYCLE_LEDGER_FILE)
        safe.known_folder = lambda name: self.desktop if name == "desktop" else self.downloads
        safe.RESTORE_POINTS_FILE = self.tmp / "restore_points.json"
        safe.RECYCLE_LEDGER_FILE = self.tmp / "ledger.json"

    def tearDown(self):
        safe.known_folder, safe.RESTORE_POINTS_FILE, safe.RECYCLE_LEDGER_FILE = self._orig
        shutil.rmtree(self.tmp, ignore_errors=True)

    def make(self, folder: Path, name: str, data: bytes = b"ghosti-test", age_days: float = 0) -> Path:
        p = folder / name
        p.write_bytes(data)
        if age_days:
            t = time.time() - age_days * 86400
            os.utime(p, (t, t))
        return p


class RecycleBinRoundTripTest(_TempEnv):
    def test_send_to_recycle_bin_and_restore(self):
        f = self.make(self.tmp, "ghosti_recycle_probe.txt", b"round-trip-content")
        res = safe.send_to_recycle_bin(f)
        self.assertTrue(res["ok"], res)
        self.assertFalse(f.exists())
        self.assertTrue(res["locatedInRecycleBin"], "휴지통 안 $I 위치를 찾지 못함")
        back = safe.restore_from_recycle_bin(res["recycleMetaFile"])
        self.assertTrue(back["ok"], back)
        self.assertEqual(Path(back["restoredPath"]).read_bytes(), b"round-trip-content")
        self.assertFalse(Path(res["recycleMetaFile"]).exists(), "$I 메타가 휴지통에 남음")

    def test_restore_never_overwrites(self):
        f = self.make(self.tmp, "ghosti_overwrite_probe.txt", b"old")
        res = safe.send_to_recycle_bin(f)
        self.assertTrue(res["ok"], res)
        self.make(self.tmp, "ghosti_overwrite_probe.txt", b"new-file-same-name")
        back = safe.restore_from_recycle_bin(res["recycleMetaFile"])
        self.assertTrue(back["ok"], back)
        self.assertTrue(back["renamed"])
        self.assertEqual((self.tmp / "ghosti_overwrite_probe.txt").read_bytes(), b"new-file-same-name")
        self.assertEqual(Path(back["restoredPath"]).read_bytes(), b"old")

    def test_restore_rejects_foreign_paths(self):
        fake = self.make(self.tmp, "$Ifake.txt", b"x" * 40)
        self.assertFalse(safe.restore_from_recycle_bin(str(fake))["ok"])

    def test_photo_recycle_ledger_round_trip(self):
        photo = self.make(self.tmp, "20241029_123456.jpg", b"\xff\xd8photo")
        resolver = lambda n: photo if n == photo.name else None
        out = safe.recycle_photos([photo.name, "unknown.jpg"], resolver)
        self.assertEqual(out["moved"], [photo.name])
        self.assertEqual(len(out["errors"]), 1)
        self.assertFalse(photo.exists())
        entries = safe.recycled_photo_entries()
        self.assertEqual([e["path"] for e in entries], [photo.name])
        back = safe.restore_photos([photo.name])
        self.assertEqual(back["restored"], [photo.name], back)
        self.assertTrue(photo.exists())
        self.assertEqual(safe.recycled_photo_entries(), [])


class CleanupAndRestorePointTest(_TempEnv):
    def test_scan_preview_execute_and_rollback(self):
        old_installer = self.make(self.downloads, "Setup_old.exe", b"MZ" * 100, age_days=30)
        self.make(self.downloads, "Setup_new.exe", b"MZ", age_days=0)  # 최근 파일은 후보 아님
        self.make(self.downloads, "report.docx", b"doc", age_days=30)  # 업무 문서는 후보 아님
        scan = safe.scan_cleanup_candidates("DOWNLOAD_INSTALLERS")
        names = [i["name"] for i in scan["items"]]
        self.assertEqual(names, ["Setup_old.exe"])
        res = safe.execute_cleanup_move([i["fullPath"] for i in scan["items"]], "설치파일 정리", "다운로드 정리해줘", "이동 1건")
        self.assertTrue(res["ok"], res)
        self.assertFalse(old_installer.exists())
        moved = self.downloads / safe.CLEANUP_FOLDER_NAME / "Setup_old.exe"
        self.assertTrue(moved.exists())
        pre = safe.precheck_restore_points()
        self.assertEqual(pre["restorePoints"][0]["integrityStatus"], "FULL_RESTORABLE")
        rb = safe.rollback_restore_point(res["restoreId"])
        self.assertTrue(rb["ok"], rb)
        self.assertTrue(old_installer.exists())
        self.assertFalse(moved.exists())
        # 두 번 되돌리기는 아무것도 하지 않음
        self.assertFalse(safe.rollback_restore_point(res["restoreId"])["ok"])

    def test_cleanup_rejects_paths_outside_allowed_roots(self):
        outside = self.make(self.tmp, "important.exe", b"MZ")
        sub = self.downloads / "sub"
        sub.mkdir()
        nested = self.make(sub, "nested.exe", b"MZ")
        res = safe.execute_cleanup_move([str(outside), str(nested)], "x", "x", "x")
        self.assertFalse(res["ok"])
        self.assertTrue(outside.exists() and nested.exists())

    def test_legacy_demo_restore_point_is_purged(self):
        safe.RESTORE_POINTS_FILE.write_text(
            '[{"restoreId":"#104","operations":[{"op":"MOVE","toPath":"C:/x/CleanMonster_Sandbox/a.jpg"}]}]',
            encoding="utf-8",
        )
        self.assertEqual(safe.load_restore_points(), [])

    def test_shortcut_created_on_desktop_and_rollback_recycles(self):
        recycled = []
        orig_send = safe.send_to_recycle_bin

        def fake_send(p):
            recycled.append(Path(p).name)
            Path(p).unlink()
            return {"ok": True}

        safe.send_to_recycle_bin = fake_send
        try:
            self.assertFalse(safe.create_desktop_shortcut("x", "javascript:alert(1)")["ok"])
            res = safe.create_desktop_shortcut("네이버", "https://www.naver.com")
            self.assertTrue(res["ok"], res)
            self.assertTrue((self.desktop / "네이버.url").exists())
            res2 = safe.create_desktop_shortcut("네이버", "https://www.naver.com")
            self.assertNotEqual(res["shortcutPath"], res2["shortcutPath"], "같은 이름 덮어쓰기 금지")
            rb = safe.rollback_restore_point(res["restoreId"])
            self.assertTrue(rb["ok"], rb)
            self.assertEqual(recycled, ["네이버.url"])
            self.assertTrue(Path(res2["shortcutPath"]).exists())
        finally:
            safe.send_to_recycle_bin = orig_send


class RoutingAndSecurityTest(unittest.TestCase):
    def test_frontend_action_aliases_are_routed(self):
        for act in ("restore-rollback", "record-cleanup", "omni-trace", "cleanup-scan", "pc-spec"):
            out = pg.handle_request(act, {})
            self.assertNotIn("UNKNOWN_ACTION", str(out.get("error", "")), act)

    def test_unknown_action_is_rejected_not_executed(self):
        out = pg.handle_request("definitely-not-an-action", {})
        self.assertFalse(out["ok"])
        self.assertIn("UNKNOWN_ACTION", out["error"])

    def test_quarantine_unknown_action_is_not_fake_success(self):
        self.assertFalse(pg.handle_quarantine("zzz", {})["ok"])

    def test_trusted_origins(self):
        ok = [None, "https://ghosti.sundreamer.app", "https://sundreamer.app", "http://localhost:5173", "http://127.0.0.1:4173", "capacitor://localhost"]
        bad = ["https://evil.com", "https://sundreamer.app.evil.com", "http://ghosti.sundreamer.app.attacker.io", "https://someone.netlify.app", "null"]
        for o in ok:
            self.assertTrue(daemon.is_trusted_origin(o), o)
        for o in bad:
            self.assertFalse(daemon.is_trusted_origin(o), o)

    def test_trace_keywords(self):
        self.assertIn("영수증", pg._extract_trace_keywords("영수증 사진 어디갔어?"))
        self.assertEqual(pg._extract_trace_keywords("파일 없어졌어"), [])

    def test_pc_spec_is_real_measurement(self):
        spec = safe.measure_pc_spec()
        self.assertTrue(spec["ok"])
        self.assertIsNotNone(spec["ramTotalGb"])
        self.assertGreater(spec["ramTotalGb"], 0)
        self.assertIsNotNone(spec["diskFreeGb"])


if __name__ == "__main__":
    unittest.main()
