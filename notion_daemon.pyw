# -*- coding: utf-8 -*-
"""
Merlin Notion QA 상시 무토큰 감시 & 정돈 통합 데몬 (notion_daemon.pyw)
1) 15초 주기: '발견된 버그'([귀신같이]) 신규 티켓 감시 (AI 토큰 소모 0원)
   - 새 버그 발견 시 윈도우 네이티브 토스트 알림 / 로그 기록 및 알림
2) 60초 주기: '완료(Done)' 컬럼 최신 7건 유지 (초과분 자동 노션 보관함 archived: true + 로컬 백업)
3) 윈도우 백그라운드 pythonw.exe 구동 (콘솔 창 없음, CPU 0%)
4) 단일 인스턴스 소켓 락(127.0.0.1:51987)
"""

import os
import socket
import sys
import time
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT_DIR))

LOCK_PORT = 51987


def acquire_single_instance_lock() -> socket.socket | None:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.bind(("127.0.0.1", LOCK_PORT))
        s.listen(1)
        return s
    except OSError:
        return None


def notify_windows(title: str, message: str) -> None:
    """윈도우 파워쉘 알림 발송"""
    try:
        clean_msg = message.replace('"', "'")[:200]
        cmd = f'powershell -Command "[reflection.assembly]::loadwithpartialname(\'System.Windows.Forms\') | Out-Null; [System.Windows.Forms.MessageBox]::Show(\'{clean_msg}\', \'{title}\')"'
        # 비차단으로 실행
        import subprocess
        subprocess.Popen(cmd, shell=True)
    except Exception:
        pass


def main() -> None:
    lock_sock = acquire_single_instance_lock()
    if lock_sock is None:
        return

    import notion_qa

    seen_bug_ids = set()
    try:
        initial_bugs = notion_qa.query_bugs_raw()
        for b in initial_bugs:
            seen_bug_ids.add(b["page_id"])
    except Exception:
        pass

    tick = 0
    while True:
        try:
            # 1) 15초 주기: 신규 발견된 버그 감시
            current_bugs = notion_qa.query_bugs_raw()
            new_bugs = [b for b in current_bugs if b["page_id"] not in seen_bug_ids]
            if new_bugs:
                for b in new_bugs:
                    seen_bug_ids.add(b["page_id"])
                bug_titles = " / ".join(b["title"] for b in new_bugs)
                print(f"🚨 [노션 신규 버그 감지]: {bug_titles}")
                notify_windows("Ghosti 노션 QA 신규 버그 알림", f"테스터가 새 버그를 등록했습니다:\n{bug_titles}")

            # 2) 60초 주기 (매 4회 틱): 완료 컬럼 최신 7건 유지
            if tick % 4 == 0:
                notion_qa.trim_done_cards(7)

        except Exception as e:
            pass

        tick += 1
        time.sleep(15)


if __name__ == "__main__":
    main()
