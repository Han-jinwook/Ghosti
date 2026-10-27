#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
멀린 Z 코어 (Universal Merlin Z-Core) 전사 공용 로컬 브릿지 서버 (z_core_bridge_server.py)
- 포트: http://127.0.0.1:5198
- 역할:
  16개 프로젝트 에이전트(Python / Node.js / CLI)가 POST /__zcore/command 로 보낸 명령을
  크로미움 브라우저(크롬·엣지·웨일·브레이브)의 core_power_agent 확장팩으로 전달하고,
  실행 결과를 즉시 응답합니다.
"""

import json
import sys
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Dict, List

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

HOST = "127.0.0.1"
PORT = 5198

LOCK = threading.Lock()
PENDING_QUEUE: List[Dict[str, Any]] = []
COMPLETED_RESULTS: Dict[str, Dict[str, Any]] = {}
WAIT_EVENTS: Dict[str, threading.Event] = {}


class ZCoreBridgeHandler(BaseHTTPRequestHandler):
    def log_message(self, format: str, *args: Any) -> None:
        # 폴링 로그 소음 방지
        pass

    def _send_json(self, status: int, data: Dict[str, Any]) -> None:
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        self._send_json(200, {"ok": True})

    def do_GET(self) -> None:
        if self.path == "/__zcore/health":
            with LOCK:
                q_len = len(PENDING_QUEUE)
            self._send_json(
                200,
                {
                    "ok": True,
                    "service": "Universal Merlin Z-Core Local Bridge",
                    "port": PORT,
                    "pendingTasks": q_len,
                },
            )
            return

        if self.path == "/__zcore/next-task":
            with LOCK:
                if PENDING_QUEUE:
                    task = PENDING_QUEUE.pop(0)
                    self._send_json(200, task)
                    return
            self._send_json(200, {"taskId": None})
            return

        self._send_json(404, {"ok": False, "error": "Not found"})

    def do_POST(self) -> None:
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length).decode("utf-8") if length > 0 else "{}"
        try:
            payload = json.loads(raw)
        except Exception:
            payload = {}

        # 1) 브라우저 확장팩이 작업 완료 결과를 보고하는 엔드포인트
        if self.path == "/__zcore/complete-task":
            task_id = payload.get("taskId")
            result = payload.get("result", {"ok": False, "error": "Empty result"})
            if task_id:
                with LOCK:
                    COMPLETED_RESULTS[task_id] = result
                    ev = WAIT_EVENTS.get(task_id)
                    if ev:
                        ev.set()
            self._send_json(200, {"ok": True})
            return

        # 2) 외부 에이전트(Python/Node)가 Z-Core 명령을 요청하는 엔드포인트
        if self.path == "/__zcore/command":
            command = payload.get("command")
            params = payload.get("params", {})
            timeout_sec = float(payload.get("timeoutSec", 15.0))

            if not command:
                self._send_json(400, {"ok": False, "error": "command 필드가 필요합니다."})
                return

            task_id = str(uuid.uuid4())
            ev = threading.Event()

            with LOCK:
                WAIT_EVENTS[task_id] = ev
                PENDING_QUEUE.append(
                    {
                        "taskId": task_id,
                        "command": command,
                        "params": params,
                        "createdAt": time.time(),
                    }
                )

            finished = ev.wait(timeout=timeout_sec)
            with LOCK:
                WAIT_EVENTS.pop(task_id, None)
                result = COMPLETED_RESULTS.pop(task_id, None)

            if not finished or result is None:
                self._send_json(
                    504,
                    {
                        "ok": False,
                        "error": (
                            f"Z-Core 응답 시간 초과 ({timeout_sec}초). "
                            "브라우저에 D:\\Ghosti\\universal_z_core\\core_power_agent 확장팩이 켜져 있는지 확인해 주세요."
                        ),
                    },
                )
                return

            self._send_json(200, result)
            return

        self._send_json(404, {"ok": False, "error": "Not found"})


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), ZCoreBridgeHandler)
    print(f"🚀 [Universal Merlin Z-Core Bridge] Listening on http://{HOST}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 Z-Core Bridge 종료")


if __name__ == "__main__":
    main()
