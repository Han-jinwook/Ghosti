# -*- coding: utf-8 -*-
"""
Merlin Notion QA '완료(Done)' 컬럼 상시 자동 정돈 데몬 (notion_done_trimmer_daemon.pyw)
- IDE(Antigravity) 채팅창을 모두 닫아도 윈도우 백그라운드(pythonw.exe, 창 없음)에서 상시 구동됩니다.
- 60초마다 노션 QA 보드(400f9ffd2c1d807fa3e7c705d2b0ceab)의 '완료' 컬럼을 확인하여,
  최신 7개만 남기고 8번째부터는 노션 보관함(archived: true)으로 자동 이동 + 로컬 JSON 백업합니다.
- 중복 실행 방지를 위해 로컬 소켓 포트(127.0.0.1:51987) 단일 인스턴스 락을 사용합니다.
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


def main() -> None:
    lock_sock = acquire_single_instance_lock()
    if lock_sock is None:
        # 이미 백그라운드에서 실행 중이면 조용히 종료
        return

    import notion_qa

    while True:
        try:
            notion_qa.trim_done_cards(7)
        except Exception:
            pass
        time.sleep(60)


if __name__ == "__main__":
    main()
