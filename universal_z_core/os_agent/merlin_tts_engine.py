# -*- coding: utf-8 -*-
"""
[🎙️ Z-Eye 전 영역 무료 무제한 Neural TTS 엔진 — MS 신경망 '현수(Hyunsu) & 선희(SunHi)' 투톱 체제]
- 유료 Typecast(필재/유진) 전면 배제 -> 실시간 합성 시에도 API 과금 평생 0원 & 일일 횟수 제한(10회 제한) 전면 폐지!
- 2대 전속 성우 역할 분담:
  1. 기본 브리핑 성우 (`ko-KR-HyunsuNeural` — 남성 중저음 '현수'):
     - 설정몬스터/클린몬스터 전체 안내, 주치의 대화창 브리핑, 투시검색 짧은 결과 답변, 고난도 질문 AI 바톤터치 안내
  2. 문서 낭독 전담 성우 (`ko-KR-SunHiNeural` — 여성 아나운서 '선희'):
     - 스마트 서류함 문서 사전 요약본 읽어주기("요약해서 읽어줘"), 특정 키워드 포함 문장 연속 낭독("'위약금' 나오는 문장 다 읽어줘"), 문서 전체 낭독
- 3단 무지연 무과금 캐시 구조:
  ① Cache Hit: tts_cache/{hash}.mp3 존재 시 네트워크 호출 0회, 비용 0원, 0.001초 즉시 반환
  ② Cache Miss: edge-tts 무료 신경망 합성 -> tts_cache/{hash}.mp3 자동 저장 (Write-Through)
  ③ Pre-warming: 고정 가이드 멘트 백그라운드 사전 합성 (`ko-KR-HyunsuNeural`)
"""

import asyncio
import hashlib
import json
import os
import sys
import time
from pathlib import Path
from typing import Dict, List

ROOT_DIR = Path(__file__).resolve().parents[2]
TTS_CACHE_DIR = ROOT_DIR / "tts_cache"
TTS_CACHE_DIR.mkdir(parents=True, exist_ok=True)

VOICE_EDGE_HYUNSU = "ko-KR-HyunsuNeural"
VOICE_EDGE_SUNHI = "ko-KR-SunHiNeural"
VOICE_EDGE_INJOON = "ko-KR-InJoonNeural"

DEFAULT_VOICE = VOICE_EDGE_HYUNSU
DEFAULT_RATE = "+0%"

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
    "깊은 분석이 필요한 질문이네요! 평소 쓰시는 AI 입력창에 이 문서와 질문을 바로 넣어 띄워드릴게요. 전송 버튼을 누르신 뒤 바로 옆 라이브 음성 버튼을 누르시면 말로 편하게 상담하실 수 있습니다.",
]


def normalize_text(text: str) -> str:
    return " ".join(str(text or "").strip().split())


def resolve_voice_id(voice: str = DEFAULT_VOICE) -> str:
    """유료 Typecast 레거시 키나 별칭이 들어와도 100% 무료 MS 신경망 '현수 & 선희' 투톱으로 매핑합니다."""
    v = (voice or "").strip().lower()
    if v in ("sunhi", "female", "doc", "doc_reader", "summary", "typecast_yujin", "ko-kr-sunhineural"):
        return VOICE_EDGE_SUNHI
    if v in ("injoon", "ko-kr-injoonneural"):
        return VOICE_EDGE_INJOON
    return VOICE_EDGE_HYUNSU


def resolve_voice_actor_label(edge_voice: str) -> str:
    if edge_voice == VOICE_EDGE_SUNHI:
        return "선희 (ko-KR-SunHiNeural · 문서 낭독 전담 여성 아나운서)"
    return "현수 (ko-KR-HyunsuNeural · 기본 브리핑 남성 중저음)"


def compute_tts_hash(text: str, voice: str = DEFAULT_VOICE, rate: str = DEFAULT_RATE) -> str:
    norm = normalize_text(text)
    resolved_voice = resolve_voice_id(voice)
    key = f"{resolved_voice}|{rate}|{norm}"
    return hashlib.sha256(key.encode("utf-8")).hexdigest()[:24]


async def _synthesize_with_edge_tts(
    text: str,
    voice: str = VOICE_EDGE_HYUNSU,
    rate: str = "+0%",
    output_path: Path = None,
) -> bool:
    """100% 무과금 MS 신경망(edge-tts)으로 즉시 합성합니다."""
    try:
        import edge_tts

        edge_voice = resolve_voice_id(voice)
        tmp_path = output_path.with_suffix(f".{os.getpid()}.edge.tmp.mp3")
        communicate = edge_tts.Communicate(text, voice=edge_voice, rate=rate)
        await communicate.save(str(tmp_path))
        if tmp_path.exists() and tmp_path.stat().st_size > 256:
            os.replace(str(tmp_path), str(output_path))
            return True
        return False
    except Exception:
        # ko-KR-HyunsuNeural 미지원 구형 edge-tts 환경 시 ko-KR-InJoonNeural 자동 폴백
        try:
            import edge_tts

            tmp_path = output_path.with_suffix(f".{os.getpid()}.edge.fallback.tmp.mp3")
            communicate = edge_tts.Communicate(text, voice=VOICE_EDGE_INJOON, rate=rate)
            await communicate.save(str(tmp_path))
            if tmp_path.exists() and tmp_path.stat().st_size > 256:
                os.replace(str(tmp_path), str(output_path))
                return True
        except Exception:
            pass
        return False


async def synthesize_one(
    text: str,
    voice: str = DEFAULT_VOICE,
    rate: str = DEFAULT_RATE,
) -> Dict[str, object]:
    t0 = time.perf_counter()
    norm = normalize_text(text)
    if not norm:
        return {"ok": False, "error": "EMPTY_TEXT"}

    normalized_voice = resolve_voice_id(voice)
    actor_label = resolve_voice_actor_label(normalized_voice)
    h = compute_tts_hash(norm, normalized_voice, rate)
    mp3_path = TTS_CACHE_DIR / f"{h}.mp3"

    # ① [Cache Hit — 이미 캐싱된 문장]: 네트워크 호출 0, 비용 0원, 0.001초 즉시 반환
    if mp3_path.exists() and mp3_path.stat().st_size > 256:
        elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)
        return {
            "ok": True,
            "cacheStatus": "HIT",
            "hash": h,
            "voice": normalized_voice,
            "voiceActor": actor_label,
            "costWon": 0,
            "dailyQuotaLimit": "UNLIMITED",
            "rate": rate,
            "text": norm,
            "filePath": str(mp3_path),
            "audioUrl": f"/__setup-monster/tts-audio?hash={h}",
            "fileSize": mp3_path.stat().st_size,
            "elapsedMs": elapsed_ms,
        }

    # ② [Cache Miss — 무료 MS 신경망(현수/선희) 실시간 합성 & Write-Through 캐시 저장]
    success = await _synthesize_with_edge_tts(norm, normalized_voice, rate, mp3_path)
    elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)

    if success and mp3_path.exists() and mp3_path.stat().st_size > 256:
        return {
            "ok": True,
            "cacheStatus": "MISS",
            "hash": h,
            "voice": normalized_voice,
            "voiceActor": actor_label,
            "costWon": 0,
            "dailyQuotaLimit": "UNLIMITED",
            "rate": rate,
            "text": norm,
            "filePath": str(mp3_path),
            "audioUrl": f"/__setup-monster/tts-audio?hash={h}",
            "fileSize": mp3_path.stat().st_size,
            "elapsedMs": elapsed_ms,
        }

    return {
        "ok": False,
        "cacheStatus": "ERROR",
        "hash": h,
        "voice": normalized_voice,
        "rate": rate,
        "text": norm,
        "error": "SYNTHESIS_FAILED",
    }


async def prewarm_all(
    phrases: List[str] = PREWARM_PHRASES,
    voice: str = DEFAULT_VOICE,
    rate: str = DEFAULT_RATE,
) -> Dict[str, object]:
    t0 = time.perf_counter()
    resolved_voice = resolve_voice_id(voice)
    results = []

    for p in phrases:
        if normalize_text(p):
            res = await synthesize_one(p, voice=resolved_voice, rate=rate)
            results.append(res)

    hit_count = sum(1 for r in results if r.get("cacheStatus") == "HIT")
    miss_baked_count = sum(1 for r in results if r.get("cacheStatus") == "MISS")
    elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)
    return {
        "ok": True,
        "voice": resolved_voice,
        "voiceActor": resolve_voice_actor_label(resolved_voice),
        "costWon": 0,
        "dailyQuotaLimit": "UNLIMITED",
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
