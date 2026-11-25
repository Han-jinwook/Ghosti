#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
귀신같이 (Ghosti) 1~4귀신 · 귀신Key 공용 엔진/브릿지 작업 문패 장부 (zcore_board.py)
- 목적:
  4개 귀신 창(1~4귀신 및 귀신Key)이 단일 본진(D:\\Ghosti)에서 공용 엔진(universal_z_core/**)이나
  공용 코어 브릿지(zCoreBridge.ts, GhostiHubInfraBridge.tsx 등)를 동시에 수정·리베이스하다가
  코드가 꼬이는 현상을 100% 원천 차단합니다.
- 핵심 안전핀:
  1) 착수 전 문패 걸기(claim): 비어 있으면 즉시 문패 게시(Exit 0), 타 귀신 작업 중이면 대기열(queue) 자동 등록(Exit 2).
  2) 완료 즉시 문패 내리기(release): 미커밋 엔진 파일 잔존 시 해제 거부(Exit 1), 깨끗하면 문패 하강 + 대기 1순위 대화ID 출력.
  3) 문패 미해제 퇴근 0% 강제(z_core_watcher.py 연동):
     - 문패 걸어둔 채 미커밋 상태로 감시병(--watch) 기동 시 즉시 Exit 1 차단!
     - 커밋 완료 후 release만 깜빡한 경우 감시병이 0.01초 만에 자동 하강!
     - 대기 1순위 창의 감시병은 문패가 비는 즉시 자동으로 에이전트를 깨움(send_message 이중 안전망)!
"""

from __future__ import annotations

import argparse
from contextlib import contextmanager
import json
import os
from pathlib import Path
import subprocess
import sys
import time
from typing import Any, Dict, Iterator, List, Tuple

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

ROOT_DIR = Path(__file__).resolve().parent
ZCORE_DIR = ROOT_DIR / "universal_z_core"
BOARD_FILE = ZCORE_DIR / ".zcore_work_board.json"
LOCK_FILE = ZCORE_DIR / ".zcore_work_board.lock"

SHARED_GUARDED_PATHS = (
    "universal_z_core/",
    "src/services/zCoreBridge.ts",
    "src/components/GhostiHubInfraBridge.tsx",
    "public/z_core_version.json",
)

IGNORED_DIRTY_SUFFIXES = (
    "Merlin_Z_Core_Setup.exe",
    "Merlin_Z_Core.zip",
    ".zcore_work_board.json",
    ".zcore_work_board.lock",
    ".zcore_deploy.lock",
)


def _norm_role(raw: str) -> str:
    val = (raw or "").strip().lower()
    if "key" in val or "귀신키" in val:
        return "key"
    for r in ("1", "2", "3", "4"):
        if r in val:
            return r
    return val or "unknown"


def _role_badge(role: str) -> str:
    r = _norm_role(role)
    if r == "key":
        return "귀신Key"
    if r in ("1", "2", "3", "4"):
        return f"{r}귀신"
    return r


@contextmanager
def _board_file_lock(timeout_sec: float = 8.0) -> Iterator[None]:
    ZCORE_DIR.mkdir(parents=True, exist_ok=True)
    fh = open(LOCK_FILE, "a+b")
    locked = False
    deadline = time.time() + timeout_sec
    try:
        if os.name == "nt":
            import msvcrt

            while True:
                try:
                    fh.seek(0)
                    msvcrt.locking(fh.fileno(), msvcrt.LK_NBLCK, 1)
                    locked = True
                    break
                except OSError:
                    if time.time() >= deadline:
                        break
                    time.sleep(0.05)
        yield
    finally:
        if locked and os.name == "nt":
            import msvcrt

            try:
                fh.seek(0)
                msvcrt.locking(fh.fileno(), msvcrt.LK_UNLCK, 1)
            except OSError:
                pass
        fh.close()


def _load_board_unlocked() -> Dict[str, Any]:
    if not BOARD_FILE.exists():
        return {"active": None, "queue": [], "history": []}
    try:
        raw = json.loads(BOARD_FILE.read_text(encoding="utf-8", errors="ignore"))
        if isinstance(raw, dict):
            return {
                "active": raw.get("active") if isinstance(raw.get("active"), dict) else None,
                "queue": raw.get("queue") if isinstance(raw.get("queue"), list) else [],
                "history": raw.get("history") if isinstance(raw.get("history"), list) else [],
            }
    except Exception:
        pass
    return {"active": None, "queue": [], "history": []}


def _save_board_unlocked(board: Dict[str, Any]) -> None:
    tmp = BOARD_FILE.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(board, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, BOARD_FILE)


def get_dirty_shared_engine_files() -> List[str]:
    """미커밋 상태인 공용 엔진(.py 등) 및 코어 브릿지 파일 목록을 반환합니다 (실행 중 잠긴 .exe/.zip 바이너리 제외)."""
    try:
        res = subprocess.run(
            ["git", "status", "--porcelain"],
            cwd=str(ROOT_DIR),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="ignore",
            timeout=5,
            creationflags=0x08000000 if os.name == "nt" else 0,
        )
        if res.returncode != 0:
            return []
        dirty: List[str] = []
        for line in res.stdout.splitlines():
            if len(line) < 4:
                continue
            rel = line[3:].strip().strip('"').replace("\\", "/")
            if " -> " in rel:
                rel = rel.split(" -> ", 1)[1].strip()
            if any(rel.endswith(suf) for suf in IGNORED_DIRTY_SUFFIXES):
                continue
            if any(rel.startswith(p) or rel == p for p in SHARED_GUARDED_PATHS):
                dirty.append(rel)
        return dirty
    except Exception:
        return []


def _is_engine_build_process_running() -> bool:
    if os.name != "nt":
        return False
    try:
        res = subprocess.run(
            [
                "powershell",
                "-NoProfile",
                "-Command",
                "Get-CimInstance Win32_Process -Filter \"Name LIKE 'python%' OR Name LIKE 'pyinstaller%'\" | Select-Object -ExpandProperty CommandLine",
            ],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="ignore",
            timeout=4,
            creationflags=0x08000000,
        )
        out = (res.stdout or "").lower()
        return any(
            kw in out
            for kw in (
                "deploy_z_core_cluster.py",
                "build_signed_merlin_z_core.py",
                "pyinstaller",
            )
        )
    except Exception:
        return False


def _reclaim_abandoned_owner_unlocked(board: Dict[str, Any]) -> str | None:
    """창 강제종료 등으로 실제 수정본도 없고 빌드 프로세스도 없는데 90초 이상 방치된 비정상 문패를 즉시 자동 회수합니다."""
    active = board.get("active")
    if not isinstance(active, dict):
        return None
    now = time.time()
    hb = float(active.get("heartbeatAt") or active.get("claimedAt") or 0)
    elapsed = now - hb
    if elapsed < 90:
        return None
    dirty = get_dirty_shared_engine_files()
    if dirty or _is_engine_build_process_running():
        # 실제로 수정 중이거나 빌드 중이면 절대 뺏지 않고 보호 (단, 30분 이상 완전 정지 시에만 예외 회수)
        if elapsed < 1800:
            return None
    old_role = _role_badge(str(active.get("role") or ""))
    hist = board.get("history") or []
    hist.insert(
        0,
        {
            **active,
            "releasedAt": time.strftime("%Y-%m-%d %H:%M:%S"),
            "releaseReason": f"auto_reclaimed_idle_{int(elapsed)}s",
        },
    )
    board["history"] = hist[:20]
    board["active"] = None
    _save_board_unlocked(board)
    return old_role


def enforce_doorplate_before_watch(active_role: str) -> Tuple[bool, str]:
    """
    z_core_watcher.py --watch 진입 직전 호출되는 0초 강제 관문:
    - 내 역할의 문패가 걸려 있는데 미커밋 엔진 파일이 남아 있으면 (False, 차단 사유) 반환 ➔ 감시병 즉시 Exit 1 거부!
    - 커밋은 다 끝냈는데 release만 깜빡했으면 0.01초 만에 자동 하강 후 (True, 자동해제 안내) 반환!
    """
    roles_in_window = [r.strip() for r in (active_role or "").split(",") if r.strip() and r.strip() != "all"]
    if not roles_in_window:
        return True, ""

    with _board_file_lock():
        board = _load_board_unlocked()
        _reclaim_abandoned_owner_unlocked(board)
        active = board.get("active")
        if not isinstance(active, dict):
            return True, ""
        owner_role = _norm_role(str(active.get("role") or ""))
        if owner_role not in [_norm_role(r) for r in roles_in_window]:
            return True, ""

        dirty = get_dirty_shared_engine_files()
        if dirty:
            msg = (
                "\n" + "🚨" * 24 + "\n"
                f"🛑 [문패 미해제 퇴근 차단!] [{_role_badge(owner_role)}] 문패가 아직 걸려 있고 미커밋 공용/엔진 파일이 남아 있습니다!\n"
                f"   • 걸려 있는 작업: {active.get('task')}\n"
                f"   • 미커밋 파일({len(dirty)}개): {', '.join(dirty[:6])}\n"
                f"👉 반드시 변경사항을 git commit & push 한 뒤 `python zcore_board.py release --role {owner_role}`로 문패를 내리고 다시 감시병을 기동하세요!\n"
                + "🚨" * 24
            )
            return False, msg

        # git 상태가 깨끗하면 깜빡한 문패를 0.01초 만에 자동 철거!
        queue = board.get("queue") or []
        next_waiter = queue[0] if queue else None
        hist = board.get("history") or []
        hist.insert(
            0,
            {
                **active,
                "releasedAt": time.strftime("%Y-%m-%d %H:%M:%S"),
                "releaseReason": "watcher_auto_release_clean",
            },
        )
        board["history"] = hist[:20]
        board["active"] = None
        _save_board_unlocked(board)
        extra = ""
        if isinstance(next_waiter, dict):
            extra = (
                f" (대기 1순위 [{_role_badge(str(next_waiter.get('role') or ''))}] "
                f"conv={next_waiter.get('conversationId')} 감시병이 즉시 자동 인계받습니다)"
            )
        return True, f"🪧 [문패 자동 하강 완료] 커밋 완료 확인 후 [{_role_badge(owner_role)}] 문패를 자동 철거했습니다.{extra}"


def check_queue_turn_ready(active_role: str) -> Dict[str, Any] | None:
    """
    대기열에 등록해 두고 대기 중인 창의 감시병(--watch)이 호출:
    - 문패가 비었고 대기열 1순위가 내 역할이면 즉시 정보를 반환해 에이전트를 자동 기상시킵니다!
    """
    roles_in_window = [_norm_role(r) for r in (active_role or "").split(",") if r.strip() and r.strip() != "all"]
    if not roles_in_window:
        return None

    with _board_file_lock():
        board = _load_board_unlocked()
        _reclaim_abandoned_owner_unlocked(board)
        if board.get("active") is not None:
            return None
        queue = board.get("queue") or []
        if not queue:
            return None
        first = queue[0]
        if isinstance(first, dict) and _norm_role(str(first.get("role") or "")) in roles_in_window:
            return first
    return None


def cmd_status() -> int:
    with _board_file_lock():
        board = _load_board_unlocked()
        reclaimed = _reclaim_abandoned_owner_unlocked(board)
        if reclaimed:
            print(f"🧹 [방치 문패 자동 회수] 비활성 상태였던 [{reclaimed}] 문패를 자동 철거했습니다.")
        active = board.get("active")
        queue = board.get("queue") or []

    print("=" * 68)
    print("🪧 [Ghosti 공용 엔진·브릿지 작업 문패 장부 현황]")
    print("=" * 68)
    if isinstance(active, dict):
        elapsed = int(max(0, time.time() - float(active.get("claimedAt") or time.time())))
        print(
            f"🔴 현재 작업중: [{_role_badge(str(active.get('role')))}] | 경과: {elapsed}초 | 작업: {active.get('task')}\n"
            f"   대화 ID  : {active.get('conversationId') or '(미기재)'}\n"
            f"   시작 시각: {active.get('claimedAtStr')}"
        )
    else:
        print("🟢 현재 문패 비어 있음 (즉시 claim 후 작업 가능)")

    if queue:
        print(f"\n⏳ 대기열 ({len(queue)}건):")
        for idx, q in enumerate(queue, start=1):
            print(
                f"   [{idx}순위] [{_role_badge(str(q.get('role')))}] 작업: {q.get('task')} "
                f"(conv={q.get('conversationId') or '-'}, 등록={q.get('queuedAtStr')})"
            )
    else:
        print("⏳ 대기열: 없음 (0건)")
    print("=" * 68)
    return 0


def cmd_claim(role: str, conv_id: str, task: str, files: str) -> int:
    norm_r = _norm_role(role)
    now = time.time()
    now_str = time.strftime("%Y-%m-%d %H:%M:%S")

    with _board_file_lock():
        board = _load_board_unlocked()
        reclaimed = _reclaim_abandoned_owner_unlocked(board)
        if reclaimed:
            print(f"🧹 [방치 문패 자동 회수] 무응답 종료된 [{reclaimed}] 문패를 정리하고 진입합니다.")

        active = board.get("active")
        queue: List[Dict[str, Any]] = board.get("queue") or []

        if isinstance(active, dict) and _norm_role(str(active.get("role") or "")) != norm_r:
            # 다른 귀신이 현재 작업 중 -> 대기열에 내 이름 올리고 Exit 2 반환!
            existing_pos = None
            for i, q in enumerate(queue):
                if _norm_role(str(q.get("role") or "")) == norm_r:
                    q["conversationId"] = conv_id or q.get("conversationId") or ""
                    q["task"] = task or q.get("task") or ""
                    existing_pos = i + 1
                    break
            if existing_pos is None:
                queue.append(
                    {
                        "role": norm_r,
                        "conversationId": conv_id,
                        "task": task,
                        "files": files,
                        "queuedAt": now,
                        "queuedAtStr": now_str,
                    }
                )
                existing_pos = len(queue)
            board["queue"] = queue
            _save_board_unlocked(board)

            owner_badge = _role_badge(str(active.get("role") or ""))
            elapsed = int(max(0, now - float(active.get("claimedAt") or now)))
            print("⏳" * 24)
            print(
                f"🛑 [문패 사용중 — 진입 보류 & 대기열 {existing_pos}순위 등록 완료!]\n"
                f"   • 현재 작업 주체: [{owner_badge}] (경과 {elapsed}초, 작업: '{active.get('task')}')\n"
                f"   • 내 대기 순번  : {existing_pos}순위 ([{_role_badge(norm_r)}], conv={conv_id or '미기재'})\n"
                f"👉 지금 공용 엔진/브릿지 파일을 수정하지 말고 감시병(`python z_core_watcher.py --watch --role {norm_r}`)을 켠 채 턴을 마치고 대기하세요!\n"
                f"   [{owner_badge}]이 문패를 내리는 즉시 send_message 및 감시병 자동 기상으로 바로 깨워드립니다."
            )
            print("⏳" * 24)
            return 2

        # 대기열에 있던 내 항목 제거 후 문패 게시!
        board["queue"] = [q for q in queue if _norm_role(str(q.get("role") or "")) != norm_r]
        board["active"] = {
            "role": norm_r,
            "conversationId": conv_id,
            "task": task,
            "files": files,
            "claimedAt": active.get("claimedAt", now) if isinstance(active, dict) else now,
            "claimedAtStr": active.get("claimedAtStr", now_str) if isinstance(active, dict) else now_str,
            "heartbeatAt": now,
        }
        _save_board_unlocked(board)

    print(
        f"🪧 [문패 게시 완료!] [{_role_badge(norm_r)}] 단독 작업 시작 ('{task}')\n"
        f"   ⚠️ 작업·커밋·푸시 완료 즉시 반드시 `python zcore_board.py release --role {norm_r}`로 문패를 내리세요!"
    )
    return 0


def cmd_heartbeat(role: str) -> int:
    norm_r = _norm_role(role)
    with _board_file_lock():
        board = _load_board_unlocked()
        active = board.get("active")
        if isinstance(active, dict) and _norm_role(str(active.get("role") or "")) == norm_r:
            active["heartbeatAt"] = time.time()
            _save_board_unlocked(board)
            print(f"💓 [{_role_badge(norm_r)}] 문패 생존 신호 갱신 완료")
            return 0
    print(f"ℹ️ 현재 [{_role_badge(norm_r)}] 명의로 걸린 문패가 없습니다.")
    return 0


def cmd_release(role: str, force: bool = False) -> int:
    norm_r = _norm_role(role)
    if not force:
        dirty = get_dirty_shared_engine_files()
        if dirty:
            print("🚨" * 24)
            print(
                f"🛑 [문패 하강 거부!] 아직 커밋하지 않은 공용 엔진/브릿지 파일({len(dirty)}개)이 남아 있습니다!\n"
                f"   • 미커밋 파일: {', '.join(dirty[:8])}\n"
                f"👉 먼저 git commit & push 까지 완료하여 다음 대기자가 깨끗한 상태에서 이어받도록 한 뒤 다시 release를 실행하세요!"
            )
            print("🚨" * 24)
            return 1

    with _board_file_lock():
        board = _load_board_unlocked()
        active = board.get("active")
        queue: List[Dict[str, Any]] = board.get("queue") or []

        if isinstance(active, dict):
            cur_owner = _norm_role(str(active.get("role") or ""))
            if cur_owner != norm_r and not force:
                print(
                    f"⚠️ 현재 문패 주인은 [{_role_badge(cur_owner)}]입니다. "
                    f"[{_role_badge(norm_r)}]의 대기열 등록만 취소합니다."
                )
                board["queue"] = [q for q in queue if _norm_role(str(q.get("role") or "")) != norm_r]
                _save_board_unlocked(board)
                return 0

            hist = board.get("history") or []
            hist.insert(
                0,
                {
                    **active,
                    "releasedAt": time.strftime("%Y-%m-%d %H:%M:%S"),
                    "releaseReason": "explicit_release",
                },
            )
            board["history"] = hist[:20]
            board["active"] = None
        else:
            board["queue"] = [q for q in queue if _norm_role(str(q.get("role") or "")) != norm_r]
            _save_board_unlocked(board)
            print(f"✅ 현재 걸려 있는 문패가 없습니다. ([{_role_badge(norm_r)}] 대기열 정리 완료)")
            return 0

        next_waiter = queue[0] if queue else None
        _save_board_unlocked(board)

    print(f"✅ [문패 정상 하강 완료!] [{_role_badge(norm_r)}] 작업 종료 확인 (저장소 깨끗함)")
    if isinstance(next_waiter, dict):
        next_badge = _role_badge(str(next_waiter.get("role") or ""))
        next_conv = str(next_waiter.get("conversationId") or "").strip()
        next_task = str(next_waiter.get("task") or "").strip()
        print("\n" + "🔔" * 24)
        print(f"👉 [다음 대기자 즉시 깨우기 필수!] 대기 1순위로 [{next_badge}]이 기다리고 있습니다!")
        print(f"   • 대기 작업  : {next_task}")
        print(f"   • 대화 ID    : {next_conv or '(감시병 자동 기상 대기중)'}")
        if next_conv:
            print(
                f"   • 즉시 실행할 툴: send_message(Recipient=\"{next_conv}\", "
                f"Message=\"[{_role_badge(norm_r)}] 엔진 작업 및 커밋 완료되어 문패 내렸습니다! git pull 후 바로 claim 해서 작업 진행하세요.\")"
            )
        print("🔔" * 24)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Ghosti 1~4귀신 공용 엔진 작업 문패 장부")
    sub = parser.add_subparsers(dest="cmd")

    sub.add_parser("status", help="현재 문패 및 대기열 조회")

    p_claim = sub.add_parser("claim", help="작업 착수 전 문패 걸기 (사용중이면 대기열 자동 등록 후 Exit 2)")
    p_claim.add_argument("--role", required=True, help="담당 귀신 번호 (1 | 2 | 3 | 4 | key)")
    p_claim.add_argument("--conv", default="", help="현재 에이전트 Conversation ID (바톤터치 수신용)")
    p_claim.add_argument("--task", required=True, help="짧은 작업 요약 (예: Z-코어 백업폴더 분리)")
    p_claim.add_argument("--files", default="", help="수정 예정 파일 요약")

    p_hb = sub.add_parser("heartbeat", help="장시간 빌드 중 문패 생존 신호 갱신")
    p_hb.add_argument("--role", required=True, help="담당 귀신 번호")

    p_rel = sub.add_parser("release", help="커밋·푸시 완료 후 문패 내리기 및 다음 대기자 안내")
    p_rel.add_argument("--role", required=True, help="담당 귀신 번호")
    p_rel.add_argument("--force", action="store_true", help="강제 해제 (비상용)")

    args = parser.parse_args()
    if args.cmd == "claim":
        return cmd_claim(args.role, args.conv, args.task, args.files)
    if args.cmd == "heartbeat":
        return cmd_heartbeat(args.role)
    if args.cmd == "release":
        return cmd_release(args.role, args.force)
    return cmd_status()


if __name__ == "__main__":
    sys.exit(main())
