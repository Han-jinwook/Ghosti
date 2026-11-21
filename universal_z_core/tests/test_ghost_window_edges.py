#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
귀신창(Ghost Window) 풀스택 & Z-코어(.exe) 엣지케이스 무결성 자동 검증 스위트
- 모니터 팝업 0% (GHOSTI_HEADLESS_TEST=1 + 임시 샌드박스 원장 격리)
- 검증 항목:
  1) Merlin_Z_Core_Setup.exe CArchive 에셋 번들링 (사전·3D 로고·사운드·PIL.ImageTk/ImageGrab)
  2) kiwipiepy 미설치(.exe) 환경 초경량 한국어 띄어쓰기 폴백(_fix_korean_spacing_general)
  3) 무스페이스 1.0초 자동성형 임계치 (영문 3음절 성명 ID 오변환 방어 vs 실전 문장 통과)
  4) [1] 서식·줄바꿈 다림질 엣지케이스 ('갑과 을' 공백 보존 · ①~⑳ / ⓒ / © NFKC 보존)
  5) Opt-in 30일 무료체험 단일 원장(5199 API ↔ 51988 데몬 SSOT 일치, 하루 3회 잔재 0%)
  6) F1~F6 내 상용구 양방향 저장·빈 슬롯("") 유지·사내 개인정보 기본값 혼입 0%
  7) Wave 1 기본 귀신창 번호 연속성 ([1]~[4] 연속 배치, 결번 [5] 제거)
"""

from __future__ import annotations

import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
import time
import unittest

os.environ["GHOSTI_HEADLESS_TEST"] = "1"

ROOT_DIR = Path(__file__).resolve().parents[2]
UZC_DIR = ROOT_DIR / "universal_z_core"
OS_AGENT_DIR = UZC_DIR / "os_agent"
DIST_EXE = OS_AGENT_DIR / "dist" / "Merlin_Z_Core_Setup.exe"

if str(OS_AGENT_DIR) not in sys.path:
    sys.path.insert(0, str(OS_AGENT_DIR))

import seq_paste_daemon as spd  # noqa: E402
import plugin_ghosti_superpowers as pgs  # noqa: E402


class TestGhostWindowEdges(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp_dir = Path(tempfile.mkdtemp(prefix="ghosti_gw_edge_"))
        self._orig_merlin_appdata = spd._MERLIN_APPDATA
        self._orig_pgs_merlin_dir = pgs.MERLIN_DIR
        self._orig_pgs_ledger = pgs.TRIAL_LEDGER_FILE
        self._orig_pgs_user_snip = pgs.USER_SNIPPETS_FILE
        self._orig_spd_snip = spd.SNIPPETS_FILE
        self._orig_spd_user_snip = spd.USER_SNIPPETS_APPDATA

        sandbox_data = self._tmp_dir / "Ghosti" / "data"
        sandbox_data.mkdir(parents=True, exist_ok=True)
        spd._MERLIN_APPDATA = sandbox_data
        spd.SNIPPETS_FILE = sandbox_data / "fixed_snippets.json"
        spd.USER_SNIPPETS_APPDATA = sandbox_data / "user_snippets.json"
        pgs.MERLIN_DIR = sandbox_data
        pgs.TRIAL_LEDGER_FILE = sandbox_data / "superpower_trial_ledger.json"
        pgs.USER_SNIPPETS_FILE = spd.USER_SNIPPETS_APPDATA

    def tearDown(self) -> None:
        spd._MERLIN_APPDATA = self._orig_merlin_appdata
        spd.SNIPPETS_FILE = self._orig_spd_snip
        spd.USER_SNIPPETS_APPDATA = self._orig_spd_user_snip
        pgs.MERLIN_DIR = self._orig_pgs_merlin_dir
        pgs.TRIAL_LEDGER_FILE = self._orig_pgs_ledger
        pgs.USER_SNIPPETS_FILE = self._orig_pgs_user_snip
        shutil.rmtree(self._tmp_dir, ignore_errors=True)

    def test_01_exe_carchive_assets_and_modules(self) -> None:
        self.assertTrue(DIST_EXE.exists(), f"Missing built exe: {DIST_EXE}")
        from PyInstaller.archive.readers import CArchiveReader, ZlibArchiveReader

        pkg = CArchiveReader(str(DIST_EXE))
        toc_names = set(pkg.toc.keys())
        norm_names = {n.replace("\\", "/") for n in toc_names}

        required_assets = [
            "assets/ko_en_lexicon.zlib",
            "assets/gwisinkachi_app_icon_512.png",
            "assets/gwisinkachi_3d_wordmark_dark.png",
        ]
        for req in required_assets:
            self.assertIn(req, norm_names, f"Missing bundled asset in exe: {req}")

        wav_entries = [n for n in norm_names if n.startswith("baby_ghost_sounds/") and n.endswith(".wav")]
        self.assertGreaterEqual(len(wav_entries), 3, f"Expected >=3 wav files in exe, got {wav_entries}")

        pyz_name = next((n for n in toc_names if n.endswith(".pyz")), None)
        self.assertIsNotNone(pyz_name, "PYZ archive not found in exe")
        pyz: ZlibArchiveReader = pkg.open_embedded_archive(pyz_name)
        pyz_mods = set(pyz.toc.keys())
        for mod in (
            "seq_paste_daemon",
            "ghost_search_window_ui2",
            "plugin_ghosti_superpowers",
            "PIL.ImageGrab",
            "PIL.ImageTk",
        ):
            self.assertIn(mod, pyz_mods, f"Missing Python module in PYZ: {mod}")

    def test_02_korean_spacing_fallback_without_kiwi(self) -> None:
        orig_kiwi = spd._KIWI_ENGINE
        try:
            spd._KIWI_ENGINE = False
            s1 = spd._fix_korean_spacing_general("안녕하세요반갑습니다")
            self.assertEqual(s1, "안녕하세요 반갑습니다")

            s2 = spd._fix_korean_spacing_general("오늘오후3시에강남역에서회의합니다")
            self.assertIn("오늘 ", s2)
            self.assertIn("3시에 ", s2)
            self.assertIn("강남역에서 ", s2)

            s3 = spd._fix_korean_spacing_general("파일을보내드립니다확인부탁드립니다")
            self.assertIn("파일을 ", s3)
            self.assertIn("보내드립니다 ", s3)
        finally:
            spd._KIWI_ENGINE = orig_kiwi

    def test_03_1sec_nospace_id_protection_vs_real_sentence(self) -> None:
        def _would_trigger_1s(raw_ascii: str) -> bool:
            cand = spd.eng_word_to_kor(raw_ascii)
            if not cand or not spd.is_valid_korean_word(cand):
                return False
            polite_end = cand.endswith(("요", "다", "까", "죠", "네", "어", "야", "지", "음", "함", "됨"))
            return (len(raw_ascii) >= 10 and len(cand) >= 4) or (
                len(raw_ascii) >= 7 and len(cand) >= 3 and polite_end
            )

        # 3음절 성명 기반 영문 ID 오변환 방어
        for safe_id in ("ghdrlfehd", "qkrwlstn", "rlacjftn"):
            self.assertFalse(_would_trigger_1s(safe_id), f"ID {safe_id} should NOT auto-morph on 1s pause!")

        # 실전 한국어 문장·인사말 1초 자동변환 통과
        for typo_phrase in ("dkssudgktpdy", "whgdkdy", "dhsmfghldmltlrks", "gksrmfdldkscuwu"):
            self.assertTrue(_would_trigger_1s(typo_phrase), f"Phrase {typo_phrase} SHOULD auto-morph on 1s pause!")

    def test_04_iron_and_polish_preserves_particles_and_symbols(self) -> None:
        broken_contract = "본 계약은 갑과 을 사이의\n임대차에 관한 사항을 정\n하며, 계약 기간은 2026\n년 11월 15일로 한다."
        ironed = spd.iron_and_polish_korean_text(broken_contract)
        self.assertIn("갑과 을", ironed)
        self.assertNotIn("갑과을", ironed)
        self.assertIn("정하며", ironed)
        self.assertIn("2026년", ironed)

        special_symbols = "① 제1조 목적\n② 권리 표시 ⓒ 썬드림 © All Rights Reserved ® ™"
        ironed_sym = spd.iron_and_polish_korean_text(special_symbols)
        for sym in ("①", "②", "ⓒ", "©", "®", "™"):
            self.assertIn(sym, ironed_sym, f"Symbol {sym} was corrupted by NFKC normalization!")

    def test_05_unified_opt_in_30d_trial_ledger_and_no_daily3(self) -> None:
        # 1) 초기 미시작 상태: 몰래 자동 카운트다운 0%, 유료 도구 차단, 무료 도구 통과
        st0 = pgs.get_superpower_status({"accountId": "qa_tester", "isSubscribed": False})
        self.assertEqual(st0["trial_status"], "NOT_STARTED")
        self.assertEqual(st0["daily_free_limit"], 0)

        ok_free, tag_free = spd.check_feature_quota_allowed("superpower_1", interactive_opt_in=False)
        self.assertTrue(ok_free)
        self.assertEqual(tag_free, "FREE_FOREVER")

        for locked_key in ("superpower_2", "superpower_3", "superpower_4", "superpower_5", "ui3_photo_ocr", "feat_b3_pdf_merge"):
            ok_lk, msg_lk = spd.check_feature_quota_allowed(locked_key, interactive_opt_in=False)
            self.assertFalse(ok_lk, f"{locked_key} must NOT pass before explicit Opt-in!")
            self.assertNotIn("하루 3회", msg_lk)

        # 2) '나중에 시작할게요(agreed=False)' 선택 시 여전히 NOT_STARTED / DEFERRED 유지
        st_defer = pgs.start_superpower_trial({"accountId": "qa_tester", "agreed": False})
        self.assertEqual(st_defer["trial_status"], "NOT_STARTED")
        self.assertEqual(st_defer["trial_opt_in_status"], "DEFERRED")

        # 3) 명시적 동의(agreed=True) 직후 5199 API와 51988 데몬 배지 동시 ACTIVE_30D 전환
        st_act = pgs.start_superpower_trial({"accountId": "qa_tester", "agreed": True})
        self.assertEqual(st_act["trial_status"], "ACTIVE_30D")
        self.assertEqual(spd.get_trial_badge_summary()["status"], "ACTIVE_30D")
        for locked_key in ("superpower_2", "superpower_3", "superpower_4", "superpower_5", "ui3_photo_ocr", "feat_b3_pdf_merge"):
            ok_lk2, _ = spd.check_feature_quota_allowed(locked_key, interactive_opt_in=False)
            self.assertTrue(ok_lk2, f"{locked_key} must pass during ACTIVE_30D!")

        # 4) 31일 경과 만료 시 하루 3회 없이 깔끔 잠금(EXPIRED_LOCKED) & 무료 기본기 영구 보존
        ledger_data = json.loads(pgs.TRIAL_LEDGER_FILE.read_text(encoding="utf-8"))
        hwid = pgs.get_machine_hwid()
        past_ts = time.time() - (31 * 86400)
        ledger_data["machines"][hwid]["trialOptInTs"] = past_ts
        ledger_data["machines"][hwid]["startedAtTs"] = past_ts
        pgs.TRIAL_LEDGER_FILE.write_text(json.dumps(ledger_data, ensure_ascii=False), encoding="utf-8")

        st_exp = pgs.get_superpower_status({"accountId": "qa_tester", "isSubscribed": False})
        self.assertEqual(st_exp["trial_status"], "EXPIRED_LOCKED")
        self.assertEqual(spd.get_trial_badge_summary()["status"], "EXPIRED_LOCKED")
        ok_lk3, msg_lk3 = spd.check_feature_quota_allowed("ui3_photo_ocr", interactive_opt_in=False)
        self.assertFalse(ok_lk3)
        self.assertNotIn("하루 3회", msg_lk3)
        ok_free_after, _ = spd.check_feature_quota_allowed("superpower_1", interactive_opt_in=False)
        self.assertTrue(ok_free_after)

    def test_06_snippets_roundtrip_empty_slot_and_clean_defaults(self) -> None:
        defaults = pgs.get_snippets()
        joined_defaults = " ".join(defaults.values())
        self.assertNotIn("박은숙", joined_defaults)
        self.assertNotIn("백은숙", joined_defaults)
        self.assertNotIn("썬드림", joined_defaults)

        res = pgs.save_snippets({"snippets": {"F1": "신한 110-999-888888", "F2": ""}})
        self.assertTrue(res["ok"])
        reloaded = spd.ensure_default_snippets()
        self.assertEqual(reloaded["F1"], "신한 110-999-888888")
        self.assertEqual(reloaded["F2"], "", "Cleared empty slot must remain empty instead of resurrecting default!")

    def test_07_mirror_parity_and_wave1_menu_numbering(self) -> None:
        master_spd = (UZC_DIR / "seq_paste_daemon.py").read_text(encoding="utf-8")
        os_spd = (OS_AGENT_DIR / "seq_paste_daemon.py").read_text(encoding="utf-8")
        cp_spd = (UZC_DIR / "core_power_agent" / "seq_paste_daemon.py").read_text(encoding="utf-8")
        self.assertEqual(master_spd, os_spd, "os_agent/seq_paste_daemon.py out of sync with master!")
        self.assertEqual(master_spd, cp_spd, "core_power_agent/seq_paste_daemon.py out of sync with master!")

        self.assertIn("[1] 🧹서식·줄바꿈", master_spd)
        self.assertIn("[2] 📄스샷·PDF변환🔒", master_spd)
        self.assertIn("[3] 🔗다중합본🔒", master_spd)
        self.assertIn("[4] 🔢번호·일정🔒", master_spd)
        self.assertIn("[5] 📌창고정🔒", master_spd)


if __name__ == "__main__":
    unittest.main(verbosity=2)
