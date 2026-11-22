#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
❖ Ghosti 본진 [1. 👻 귀신비서] & Merlin_Z_Core v2.3.8 전수 엣지케이스 검증 스위트
- 무팝업(headless=True) 환경에서 가짜 .gsheet 제거, 동명 사진 폴더 충돌 방지 키 & Windows 휴지통 왕복 복원,
  sys.frozen .exe `--gui-task-runner` CLI 라우팅, 플레이북·카드 SSOT 무결성을 전수 검증합니다.
"""

from __future__ import annotations

import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

REPO_ROOT = Path(__file__).resolve().parents[2]
OS_AGENT_DIR = REPO_ROOT / "universal_z_core" / "os_agent"
if str(OS_AGENT_DIR) not in sys.path:
    sys.path.insert(0, str(OS_AGENT_DIR))

import ghosti_safe_ops as safe  # noqa: E402
import merlin_z_core_daemon as zdaemon  # noqa: E402
import merlin_z_core_os as zos  # noqa: E402
import plugin_ghosti_os as gos  # noqa: E402


class GhostSecretaryEdgeAuditTest(unittest.TestCase):
    def test_01_version_parity(self) -> None:
        ver = zdaemon.CORE_VERSION
        self.assertEqual(gos.PLUGIN_METADATA.get("version"), ver)
        zcore_ts = (REPO_ROOT / "src" / "services" / "zCoreBridge.ts").read_text(encoding="utf-8")
        self.assertIn(f"LATEST_Z_CORE_VERSION = '{ver}'", zcore_ts)

    def test_02_zero_hardcoded_fake_gdocs_and_samples(self) -> None:
        res = gos.scan_g_drive_google_docs_and_sheets()
        self.assertTrue(res.get("ok"))
        blob = json.dumps(res, ensure_ascii=False)
        legacy_acct = "merlin_family" + "@" + "sundreamer.app"
        legacy_sheet = "사내_통합_계정관리표"
        legacy_bank = "110-482-" + "992018"
        for forbidden in (legacy_acct, legacy_sheet, legacy_bank, "2026_거래처_미수금_정산표"):
            self.assertNotIn(forbidden, blob)

        os_src = (OS_AGENT_DIR / "merlin_z_core_os.py").read_text(encoding="utf-8")
        gos_src = (OS_AGENT_DIR / "plugin_ghosti_os.py").read_text(encoding="utf-8")
        for forbidden in (legacy_acct, legacy_sheet, legacy_bank, "QUARANTINE_DIR"):
            self.assertNotIn(forbidden, os_src)
            self.assertNotIn(forbidden, gos_src)
        self.assertNotIn("test_docs", os_src)

    def test_03_duplicate_basename_collision_and_recycle_bin_roundtrip(self) -> None:
        tmp_root = Path(tempfile.mkdtemp(prefix="ghosti_dup_edge_"))
        orig_ledger = safe.RECYCLE_LEDGER_FILE
        try:
            safe.RECYCLE_LEDGER_FILE = tmp_root / "temp_recycle_ledger.json"
            folder_a = tmp_root / "KakaoTalk_2025"
            folder_b = tmp_root / "Camera_Backup"
            folder_a.mkdir(parents=True, exist_ok=True)
            folder_b.mkdir(parents=True, exist_ok=True)

            bytes_a = b"\xff\xd8\xff\xe0" + (b"A_PHOTO_PAYLOAD_" * 400) + b"\xff\xd9"
            bytes_b = b"\xff\xd8\xff\xe0" + (b"B_PHOTO_PAYLOAD_" * 450) + b"\xff\xd9"
            file_a = folder_a / "IMG_0001.jpg"
            file_b = folder_b / "IMG_0001.jpg"
            file_a.write_bytes(bytes_a)
            file_b.write_bytes(bytes_b)

            with mock.patch.object(gos, "_get_user_scan_roots", return_value=[tmp_root]):
                listed = gos.list_local_photos({"dir": str(tmp_root)})
                self.assertTrue(listed.get("ok"))
                files = listed.get("files", [])
                self.assertEqual(len(files), 2)

                keys = [f["path"] for f in files]
                self.assertEqual(len(set(keys)), 2)
                for k in keys:
                    self.assertNotIn("/", k)
                    self.assertNotIn("\\", k)
                    self.assertNotIn("..", k)
                    self.assertTrue(k.endswith(".jpg"))

                key_by_full = {Path(f["fullPath"]).resolve(): f["path"] for f in files}
                key_a = key_by_full[file_a.resolve()]
                key_b = key_by_full[file_b.resolve()]

                gos._PHOTO_PATH_INDEX.clear()
                res_a, mime_a, code_a = gos.resolve_local_media_file({"p": key_a})
                res_b, mime_b, code_b = gos.resolve_local_media_file({"p": key_b})
                self.assertEqual(code_a, 200)
                self.assertEqual(code_b, 200)
                self.assertEqual(mime_a, "image/jpeg")
                self.assertEqual(mime_b, "image/jpeg")
                self.assertEqual(res_a.read_bytes(), bytes_a)
                self.assertEqual(res_b.read_bytes(), bytes_b)

                mv = gos.handle_quarantine("move", {"files": [key_b]})
                self.assertTrue(mv.get("ok"), mv)
                self.assertEqual(mv.get("moved"), [key_b], mv)
                self.assertTrue(file_a.exists())
                self.assertFalse(file_b.exists())

                res_q, _, code_q = gos.resolve_local_media_file({"p": key_b, "loc": "quarantine"})
                self.assertEqual(code_q, 200)
                self.assertEqual(res_q.read_bytes(), bytes_b)

                rs = gos.handle_quarantine("restore", {"files": [key_b]})
                self.assertTrue(rs.get("ok"), rs)
                self.assertTrue(file_b.exists())
                self.assertEqual(file_b.read_bytes(), bytes_b)
        finally:
            safe.RECYCLE_LEDGER_FILE = orig_ledger
            shutil.rmtree(tmp_root, ignore_errors=True)

    def test_04_frozen_exe_gui_task_runner_command_no_window(self) -> None:
        fake_exe = r"C:\Users\merlincode\AppData\Local\Programs\MerlinZCore\Merlin_Z_Core.exe"
        with mock.patch.object(sys, "frozen", True, create=True), mock.patch.object(
            sys, "executable", fake_exe
        ):
            cmd_str = zos.build_gui_task_runner_command()
            self.assertEqual(cmd_str, f'"{fake_exe}" --gui-task-runner')

        with mock.patch.object(sys, "frozen", False, create=True):
            cmd_str_py = zos.build_gui_task_runner_command()
            self.assertIn("merlin_z_core_os.py", cmd_str_py)
            self.assertIn("gui-task-runner", cmd_str_py)

    def test_05_playbook_and_ui_scrub_assertions(self) -> None:
        playbook = (REPO_ROOT / "src" / "data" / "ghost_secretary_playbook.json").read_text(encoding="utf-8")
        engine_ts = (REPO_ROOT / "src" / "services" / "ghostSecretaryEngine.ts").read_text(encoding="utf-8")
        cards_tsx = (REPO_ROOT / "src" / "components" / "MonsterInteractiveCards.tsx").read_text(encoding="utf-8")
        router_ts = (REPO_ROOT / "src" / "services" / "monsterChatRouter.ts").read_text(encoding="utf-8")
        gos_src = (OS_AGENT_DIR / "plugin_ghosti_os.py").read_text(encoding="utf-8")

        self.assertNotIn("한치우", playbook)
        self.assertNotIn("한치우", engine_ts)
        self.assertNotIn("F1~F10", playbook)
        self.assertNotIn("F1~F6", playbook)
        self.assertNotIn("귀신창", playbook)
        self.assertNotIn("5,900원", cards_tsx)
        self.assertNotIn("🎯 [찾기] 탭에서 바로 열기", cards_tsx)
        self.assertNotIn("http://127.0.0.1:5199/api/care/", router_ts)
        self.assertNotIn("[🎯 찾기]", gos_src)

    def test_06_superpower_routes_enforce_reject_untrusted(self) -> None:
        daemon_src = (OS_AGENT_DIR / "merlin_z_core_daemon.py").read_text(encoding="utf-8")
        cp_daemon_src = (
            REPO_ROOT / "universal_z_core" / "core_power_agent" / "merlin_z_core_daemon.py"
        ).read_text(encoding="utf-8")
        self.assertIn("if self._reject_untrusted():", daemon_src)
        self.assertEqual(
            daemon_src.count('if path.startswith("/api/superpower/")'),
            cp_daemon_src.count('if path.startswith("/api/superpower/")'),
        )
        # Ensure both GET and POST superpower blocks begin with _reject_untrusted()
        for src_label, src_txt in (("os_agent", daemon_src), ("core_power_agent", cp_daemon_src)):
            idx = 0
            while True:
                pos = src_txt.find('if path.startswith("/api/superpower/")', idx)
                if pos == -1:
                    break
                snippet = src_txt[pos : pos + 260]
                self.assertIn(
                    "self._reject_untrusted()",
                    snippet,
                    f"{src_label} superpower route missing _reject_untrusted() guard!",
                )
                idx = pos + 40


if __name__ == "__main__":
    unittest.main(verbosity=2)
