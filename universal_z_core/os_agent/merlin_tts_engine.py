# -*- coding: utf-8 -*-
"""
[🛠️ Z-Eye 설정몬스터 Neural TTS 엔진 — 카페브레이크 전속 성우 '필재(Piljae)' + 무지연 Write-Through 캐시 큐]
- 주 성우 (시그니처): Typecast '필재' (Voice ID: tc_68257f68bc6e3c161ab5078d, 모델: ssfm-v30)
- 보조 성우: Typecast '유진' (Voice ID: tc_600697fd8a8ea9b977284703)
- 비상 폴백 성우: edge-tts 'ko-KR-InJoonNeural' (네트워크/크레딧 장애 시 자동 대체)
- 3단 무지연 무과금 캐시 구조:
  ① Cache Hit: tts_cache/{hash}.mp3 존재 시 네트워크/API 호출 0회, 비용 0원, 0.001초 즉시 반환
  ② Cache Miss: Typecast 필재 성우 최초 1회 발화 합성 -> imageio_ffmpeg 고음질 MP3 변환/음량정규화 -> tts_cache/{hash}.mp3 자동 저장 (Write-Through)
  ③ Pre-warming: 고정 가이드 멘트 13종 백그라운드 사전 합성 (최초 1회만 캐싱 후 영구 무과금 즉각 재생)
"""

import asyncio
import hashlib
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional

ROOT_DIR = Path(__file__).resolve().parents[2]
TTS_CACHE_DIR = ROOT_DIR / "tts_cache"
TTS_CACHE_DIR.mkdir(parents=True, exist_ok=True)

# 전속 성우 키 식별자
VOICE_TYPECAST_PILJAE = "typecast_piljae"
VOICE_TYPECAST_YUJIN = "typecast_yujin"
VOICE_EDGE_INJOON = "ko-KR-InJoonNeural"
VOICE_EDGE_HYUNSU = "ko-KR-HyunsuNeural"

DEFAULT_VOICE = VOICE_TYPECAST_PILJAE
DEFAULT_RATE = "+0%"

PILJAE_VOICE_ID_DEFAULT = "tc_68257f68bc6e3c161ab5078d"
YUJIN_VOICE_ID_DEFAULT = "tc_600697fd8a8ea9b977284703"

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


def load_environment_keys() -> None:
    """Typecast API 키 및 설정을 탐색하여 로드합니다."""
    candidate_paths = [
        ROOT_DIR / ".env.local",
        ROOT_DIR / ".env",
        Path("d:/CafeBreaker/.env"),
        Path("d:/Bes2-Marketer/.env"),
        Path("d:/MerlinSecretary/.env"),
        Path("d:/Cafe_writer/.env"),
    ]
    for env_path in candidate_paths:
        if not env_path.exists():
            continue
        try:
            with open(env_path, "r", encoding="utf-8", errors="ignore") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    k, v = line.split("=", 1)
                    key = k.strip()
                    val = v.strip().strip('"').strip("'")
                    if key and val and not os.environ.get(key):
                        os.environ[key] = val
        except Exception:
            pass


load_environment_keys()


def normalize_text(text: str) -> str:
    return " ".join(str(text or "").strip().split())


def compute_tts_hash(text: str, voice: str = DEFAULT_VOICE, rate: str = DEFAULT_RATE) -> str:
    norm = normalize_text(text)
    key = f"{voice}|{rate}|{norm}"
    return hashlib.sha256(key.encode("utf-8")).hexdigest()[:24]


def _get_ffmpeg_executable() -> Optional[str]:
    """imageio_ffmpeg 또는 시스템 PATH에서 ffmpeg 바이너리 경로를 찾습니다."""
    try:
        import imageio_ffmpeg

        exe = imageio_ffmpeg.get_ffmpeg_exe()
        if exe and os.path.exists(exe):
            return exe
    except Exception:
        pass
    return "ffmpeg"


def convert_wav_to_mp3(wav_bytes: bytes, output_mp3_path: Path) -> bool:
    """WAV 바이너리를 음량 정규화(loudnorm) 적용된 고품질 MP3로 변환합니다."""
    tmp_wav = output_mp3_path.with_suffix(f".{os.getpid()}.tmp.wav")
    tmp_mp3 = output_mp3_path.with_suffix(f".{os.getpid()}.tmp.mp3")
    try:
        tmp_wav.write_bytes(wav_bytes)
        ffmpeg_exe = _get_ffmpeg_executable()
        cmd = [
            ffmpeg_exe,
            "-y",
            "-i",
            str(tmp_wav),
            "-filter:a",
            "loudnorm=I=-16:TP=-1.5:LRA=11",
            "-b:a",
            "192k",
            str(tmp_mp3),
        ]
        res = subprocess.run(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
            timeout=15,
        )
        if res.returncode == 0 and tmp_mp3.exists() and tmp_mp3.stat().st_size > 256:
            os.replace(str(tmp_mp3), str(output_mp3_path))
            return True
        # ffmpeg 변환 실패 시 순수 wav 데이터를 mp3 파일명으로라도 보존 (브라우저 mime 호환)
        os.replace(str(tmp_wav), str(output_mp3_path))
        return True
    except Exception:
        if tmp_wav.exists():
            try:
                os.replace(str(tmp_wav), str(output_mp3_path))
                return True
            except Exception:
                pass
        return False
    finally:
        for p in (tmp_wav, tmp_mp3):
            if p.exists():
                try:
                    p.unlink()
                except Exception:
                    pass


async def _synthesize_with_typecast(
    text: str,
    voice_type: str = VOICE_TYPECAST_PILJAE,
) -> Optional[bytes]:
    """Typecast API를 호출하여 고품질 음성 바이너리(WAV)를 반환합니다."""
    api_key = os.environ.get("TYPECAST_API_KEY")
    if not api_key:
        return None

    if voice_type == VOICE_TYPECAST_YUJIN:
        voice_id = os.environ.get("TYPECAST_FEMALE_VOICE_ID", YUJIN_VOICE_ID_DEFAULT)
    else:
        voice_id = os.environ.get("TYPECAST_MALE_VOICE_ID", PILJAE_VOICE_ID_DEFAULT)

    def _sync_call() -> Optional[bytes]:
        from typecast import Typecast
        from typecast.models import TTSRequest

        client = Typecast(api_key=api_key)
        resp = client.text_to_speech(
            TTSRequest(
                text=text,
                model="ssfm-v30",
                voice_id=voice_id,
            )
        )
        if resp and resp.audio_data:
            return resp.audio_data
        return None

    for attempt in range(3):
        try:
            return await asyncio.to_thread(_sync_call)
        except Exception as e:
            err_str = str(e)
            if ("RATE_LIMIT" in err_str or "Too many requests" in err_str or "429" in err_str) and attempt < 2:
                await asyncio.sleep((attempt + 1) * 1.5)
            else:
                return None
    return None


async def _synthesize_with_edge_tts(
    text: str,
    voice: str = VOICE_EDGE_INJOON,
    rate: str = "+5%",
    output_path: Path = None,
) -> bool:
    """비상 상황 시 edge-tts로 무과금 즉시 합성합니다."""
    try:
        import edge_tts

        edge_voice = voice if "Neural" in voice else VOICE_EDGE_INJOON
        tmp_path = output_path.with_suffix(f".{os.getpid()}.edge.tmp.mp3")
        communicate = edge_tts.Communicate(text, voice=edge_voice, rate=rate)
        await communicate.save(str(tmp_path))
        if tmp_path.exists() and tmp_path.stat().st_size > 256:
            os.replace(str(tmp_path), str(output_path))
            return True
        return False
    except Exception:
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

    # 성우 식별자 정규화
    if voice in ("piljae", "typecast", "default", "male", VOICE_TYPECAST_PILJAE):
        normalized_voice = VOICE_TYPECAST_PILJAE
    elif voice in ("yujin", "female", VOICE_TYPECAST_YUJIN):
        normalized_voice = VOICE_TYPECAST_YUJIN
    elif "InJoon" in voice or "Hyunsu" in voice:
        normalized_voice = voice
    else:
        normalized_voice = VOICE_TYPECAST_PILJAE

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
            "voiceActor": "필재 (카페브레이크 전속)" if "piljae" in normalized_voice else normalized_voice,
            "rate": rate,
            "text": norm,
            "filePath": str(mp3_path),
            "audioUrl": f"/__setup-monster/tts-audio?hash={h}",
            "fileSize": mp3_path.stat().st_size,
            "elapsedMs": elapsed_ms,
        }

    # ② [Cache Miss — Typecast 필재 전속 성우 최초 1회 발화 합성 & Write-Through 캐시 저장]
    is_typecast = normalized_voice.startswith("typecast")
    success = False

    if is_typecast:
        wav_data = await _synthesize_with_typecast(norm, normalized_voice)
        if wav_data:
            success = convert_wav_to_mp3(wav_data, mp3_path)

    # Typecast 실패 시 edge-tts 안전 폴백
    if not success:
        fallback_voice = VOICE_EDGE_INJOON
        success = await _synthesize_with_edge_tts(norm, fallback_voice, rate, mp3_path)
        if success:
            normalized_voice = fallback_voice

    elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)
    if success and mp3_path.exists() and mp3_path.stat().st_size > 256:
        return {
            "ok": True,
            "cacheStatus": "MISS",
            "hash": h,
            "voice": normalized_voice,
            "voiceActor": "필재 (카페브레이크 전속)" if "piljae" in normalized_voice else normalized_voice,
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
    results = []

    # Typecast API 호출 안정성을 위해 순차적으로 프리워밍 진행
    for p in phrases:
        if normalize_text(p):
            res = await synthesize_one(p, voice=voice, rate=rate)
            results.append(res)
            # 캐시 미스 시 API 연속 호출 속도 조절
            if res.get("cacheStatus") == "MISS":
                await asyncio.sleep(0.3)

    hit_count = sum(1 for r in results if r.get("cacheStatus") == "HIT")
    miss_baked_count = sum(1 for r in results if r.get("cacheStatus") == "MISS")
    elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)
    return {
        "ok": True,
        "voice": voice,
        "voiceActor": "필재 (카페브레이크 전속)",
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
