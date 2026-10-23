# -*- coding: utf-8 -*-
"""
[🛠️ Z-Eye 설정몬스터 Neural TTS 엔진 — ko-KR-InJoonNeural + 무지연 Write-Through 캐시 큐]
- 기본 성우: ko-KR-InJoonNeural (옵션: ko-KR-HyunsuNeural)
- 기본 속도: rate="+5%"
- 3단 구조:
  ① Cache Hit: tts_cache/{hash}.mp3 존재 시 네트워크 호출 없이 0.01초 즉시 반환
  ② Cache Miss: edge-tts 실시간 합성 후 tts_cache/{hash}.mp3 자동 저장 (Write-Through)
  ③ Pre-warming: 고정 가이드 멘트 백그라운드 일괄 사전 합성
"""

import asyncio
import hashlib
import json
import os
import sys
import time
from pathlib import Path
from typing import Dict, List

import edge_tts

ROOT_DIR = Path(__file__).resolve().parents[2]
TTS_CACHE_DIR = ROOT_DIR / "tts_cache"
TTS_CACHE_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_VOICE = "ko-KR-InJoonNeural"
ALT_VOICE = "ko-KR-HyunsuNeural"
DEFAULT_RATE = "+5%"

# 설정몬스터 고정 가이드 멘트 (서버/앱 시작 시 백그라운드 자동 프리워밍 대상)
PREWARM_PHRASES: List[str] = [
    "끊어졌던 업무용 S 드라이브를 다시 연결하고 폴더 창을 열어 드렸습니다.",
    "수리하기 전 원래 설정 상태로 깔끔하게 되돌렸습니다.",
    "두 번 이상 길을 헤매게 해드려 죄송합니다. 이번 수리비는 받지 않고 전액 환불해 드렸습니다.",
    "문제가 해결되지 않아 원래 설정으로 되돌리고 코인을 전액 환불해 드렸습니다.",
    "내 컴퓨터 시작프로그램 중 부팅을 느리게 하던 불필요한 항목을 정리했습니다.",
    "컴퓨터 뒤에서 계속 돌아가던 보안 프로그램들을 은행을 쓸 때만 켜지도록 정리했습니다.",
    "막혀 있던 프린터 인쇄 대기 목록을 비우고 바로 인쇄가 되도록 다시 연결했습니다.",
    "노트북 뚜껑을 덮어도 꺼지지 않고 계속 작동하도록 전원 설정을 변경했습니다.",
    "어르신께서 보시기 편하도록 글자 크기를 시원하게 키우고 눈 보호 모드를 켰습니다.",
    "오른쪽 위에 있는 톱니바퀴 모양 설정 버튼을 눌러주세요.",
    "세 번째 줄에 있는 알림 스위치를 눌러 꺼주시면 완료됩니다.",
    "화살표가 가리키는 상단 보기 메뉴를 먼저 클릭해 주세요.",
    "이제 바로 아래에 열린 첫 행 고정 버튼을 누르시면 세팅이 끝납니다.",
]


def normalize_text(text: str) -> str:
    return " ".join(str(text or "").strip().split())


def compute_tts_hash(text: str, voice: str = DEFAULT_VOICE, rate: str = DEFAULT_RATE) -> str:
    norm = normalize_text(text)
    key = f"{voice}|{rate}|{norm}"
    return hashlib.sha256(key.encode("utf-8")).hexdigest()[:24]


async def synthesize_one(
    text: str,
    voice: str = DEFAULT_VOICE,
    rate: str = DEFAULT_RATE,
) -> Dict[str, object]:
    t0 = time.perf_counter()
    norm = normalize_text(text)
    if not norm:
        return {"ok": False, "error": "EMPTY_TEXT"}

    if voice not in (DEFAULT_VOICE, ALT_VOICE):
        voice = DEFAULT_VOICE

    h = compute_tts_hash(norm, voice, rate)
    mp3_path = TTS_CACHE_DIR / f"{h}.mp3"

    # ① [Cache Hit — 이미 캐싱된 문장]: 0.01초 즉시 반환
    if mp3_path.exists() and mp3_path.stat().st_size > 256:
        elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)
        return {
            "ok": True,
            "cacheStatus": "HIT",
            "hash": h,
            "voice": voice,
            "rate": rate,
            "text": norm,
            "filePath": str(mp3_path),
            "audioUrl": f"/__setup-monster/tts-audio?hash={h}",
            "fileSize": mp3_path.stat().st_size,
            "elapsedMs": elapsed_ms,
        }

    # ② [Cache Miss — 최초 발화 시 즉시 합성 & Write-Through 캐시 저장]
    tmp_path = TTS_CACHE_DIR / f"{h}.{os.getpid()}.tmp.mp3"
    try:
        communicate = edge_tts.Communicate(norm, voice=voice, rate=rate)
        await communicate.save(str(tmp_path))
        if tmp_path.exists() and tmp_path.stat().st_size > 256:
            os.replace(str(tmp_path), str(mp3_path))
        elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)
        return {
            "ok": True,
            "cacheStatus": "MISS",
            "hash": h,
            "voice": voice,
            "rate": rate,
            "text": norm,
            "filePath": str(mp3_path),
            "audioUrl": f"/__setup-monster/tts-audio?hash={h}",
            "fileSize": mp3_path.stat().st_size if mp3_path.exists() else 0,
            "elapsedMs": elapsed_ms,
        }
    except Exception as e:
        if tmp_path.exists():
            try:
                tmp_path.unlink()
            except Exception:
                pass
        return {
            "ok": False,
            "cacheStatus": "ERROR",
            "hash": h,
            "voice": voice,
            "rate": rate,
            "text": norm,
            "error": str(e),
        }


async def prewarm_all(
    phrases: List[str] = PREWARM_PHRASES,
    voice: str = DEFAULT_VOICE,
    rate: str = DEFAULT_RATE,
) -> Dict[str, object]:
    t0 = time.perf_counter()
    sem = asyncio.Semaphore(4)
    results = []

    async def _worker(p: str):
        async with sem:
            res = await synthesize_one(p, voice=voice, rate=rate)
            results.append(res)

    await asyncio.gather(*[_worker(p) for p in phrases if normalize_text(p)])
    hit_count = sum(1 for r in results if r.get("cacheStatus") == "HIT")
    miss_baked_count = sum(1 for r in results if r.get("cacheStatus") == "MISS")
    elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)
    return {
        "ok": True,
        "voice": voice,
        "rate": rate,
        "totalPhrases": len(results),
        "cacheHitCount": hit_count,
        "newlyBakedCount": miss_baked_count,
        "elapsedMs": elapsed_ms,
        "cacheDir": str(TTS_CACHE_DIR),
    }


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    cmd = sys.argv[1] if len(sys.argv) > 1 else "prewarm"
    if cmd == "speak":
        text = sys.argv[2] if len(sys.argv) > 2 else ""
        voice = sys.argv[3] if len(sys.argv) > 3 else DEFAULT_VOICE
        rate = sys.argv[4] if len(sys.argv) > 4 else DEFAULT_RATE
        out = asyncio.run(synthesize_one(text, voice=voice, rate=rate))
        print(json.dumps(out, ensure_ascii=False))
    elif cmd == "prewarm":
        voice = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_VOICE
        rate = sys.argv[3] if len(sys.argv) > 3 else DEFAULT_RATE
        out = asyncio.run(prewarm_all(voice=voice, rate=rate))
        print(json.dumps(out, ensure_ascii=False))
    else:
        print(json.dumps({"ok": False, "error": f"Unknown command: {cmd}"}, ensure_ascii=False))


if __name__ == "__main__":
    main()
