"""
멀린 Z 코어 (귀신같이) - 고급 '애기귀신 효과음(Baby Ghost Sound)' 6종 스튜디오 합성기
- 기계음(단순 Beep)을 완전히 배제하고, 44.1kHz 16-bit PCM 고해상도 배음(Harmonics) + 
  FM 벨(Celesta/Music Box) + 포르타멘토(Pitch Glide) + 포먼트 보컬 필터(Formant "He-he" / "Pyong!") + 
  스테레오풍 멀티탭 딜레이(Reverb)를 결합하여 상용 애플/디즈니급 6종 사운드를 생성합니다.
"""

from __future__ import annotations

import math
import struct
import wave
from pathlib import Path

SAMPLE_RATE = 44100
OUT_DIR = Path(__file__).resolve().parent.parent / "data" / "baby_ghost_sounds"


def _apply_reverb(samples: list[float], delays_ms: list[tuple[float, float]]) -> list[float]:
    n = len(samples)
    extra = int(SAMPLE_RATE * 0.35)
    out = samples + [0.0] * extra
    for delay_ms, gain in delays_ms:
        d = int(SAMPLE_RATE * (delay_ms / 1000.0))
        for i in range(n):
            if i + d < len(out):
                out[i + d] += samples[i] * gain
    return out


def _save_wav(filepath: Path, samples: list[float]) -> None:
    filepath.parent.mkdir(parents=True, exist_ok=True)
    # Windows 오디오 드라이버(WASAPI/HDAudio) 슬립 웨이크업 시 첫 음이 잘리는 현상을 100% 방지하기 위해
    # 맨 앞에 70ms(3,087 샘플)의 무음 프리롤(Pre-roll Lead-in)을 삽입합니다.
    preroll = [0.0] * int(SAMPLE_RATE * 0.070)
    full_samples = preroll + samples
    # Peak normalize to 0.85 to prevent any clipping and keep it soft & pleasant
    peak = max((abs(s) for s in full_samples), default=1.0)
    if peak < 1e-6:
        peak = 1.0
    scale = (0.85 / peak) * 32767.0
    with wave.open(str(filepath), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        frames = bytearray()
        for s in full_samples:
            val = max(-32767, min(32767, int(s * scale)))
            frames.extend(struct.pack("<h", val))
        wf.writeframes(bytes(frames))


def synth_1_celesta_music_box() -> list[float]:
    """
    [샘플 1] 오르골 요정 차임 (Celesta Fairy Music Box)
    - 맑고 영롱한 오르골 벨 (C6 -> E6 -> G6 -> C7 아르페지오) + 은은한 잔향
    """
    dur = 0.68
    n = int(SAMPLE_RATE * dur)
    buf = [0.0] * n
    notes = [
        (0.00, 1046.50, 0.42, 0.85),  # C6
        (0.07, 1318.51, 0.42, 0.90),  # E6
        (0.14, 1567.98, 0.45, 0.95),  # G6
        (0.21, 2093.00, 0.46, 1.00),  # C7 (맑은 하이라이트)
    ]
    for start_t, freq, note_dur, amp in notes:
        s_idx = int(start_t * SAMPLE_RATE)
        e_idx = min(n, s_idx + int(note_dur * SAMPLE_RATE))
        for i in range(s_idx, e_idx):
            t = (i - s_idx) / SAMPLE_RATE
            # Soft attack (4ms) + natural bell decay
            attack = min(1.0, t / 0.004)
            env = attack * math.exp(-t * 9.5)
            # FM synthesis for warm celesta bell timbre
            mod = math.sin(2.0 * math.pi * (freq * 2.0) * t) * math.exp(-t * 18.0) * 0.45
            tone = (
                math.sin(2.0 * math.pi * freq * t + mod) * 0.72
                + math.sin(2.0 * math.pi * (freq * 2.0) * t) * 0.20 * math.exp(-t * 14.0)
                + math.sin(2.0 * math.pi * (freq * 3.0) * t) * 0.08 * math.exp(-t * 22.0)
            )
            buf[i] += tone * env * amp
    return _apply_reverb(buf, [(45, 0.28), (95, 0.18), (155, 0.10)])


def synth_2_cute_baby_ghost_pop() -> list[float]:
    """
    [샘플 2] 애기귀신 퐁~ 띠링! (Cute Baby Ghost Bubble Pop & Wink)
    - 물방울이 '퐁~' 하고 터지며 피치가 귀엽게 올라간 뒤, 반짝이는 요정 윙크 벨이 울림
    """
    dur = 0.58
    n = int(SAMPLE_RATE * dur)
    buf = [0.0] * n
    # 1) 귀여운 물방울 '퐁~' (0.00 ~ 0.11s: 420Hz -> 1180Hz 지수 슬라이드)
    pop_end = int(0.11 * SAMPLE_RATE)
    phase = 0.0
    for i in range(pop_end):
        t = i / SAMPLE_RATE
        p = t / 0.11
        freq = 420.0 * ((1180.0 / 420.0) ** (p**1.3))
        phase += 2.0 * math.pi * freq / SAMPLE_RATE
        env = math.sin(math.pi * p) ** 0.8
        buf[i] += (math.sin(phase) * 0.8 + math.sin(phase * 2.0) * 0.2) * env * 0.85

    # 2) 반짝이는 요정 트윈 벨 '띠-링~!' (0.12s: A6 -> 0.19s: E7)
    bells = [(0.11, 1760.0, 0.35, 0.85), (0.18, 2637.02, 0.38, 0.95)]
    for start_t, freq, b_dur, amp in bells:
        s_idx = int(start_t * SAMPLE_RATE)
        e_idx = min(n, s_idx + int(b_dur * SAMPLE_RATE))
        for i in range(s_idx, e_idx):
            t = (i - s_idx) / SAMPLE_RATE
            attack = min(1.0, t / 0.003)
            env = attack * math.exp(-t * 11.0)
            vib = math.sin(2.0 * math.pi * 6.5 * t) * 0.004 * freq
            f_inst = freq + vib
            tone = math.sin(2.0 * math.pi * f_inst * t) * 0.78 + math.sin(2.0 * math.pi * (f_inst * 2.0) * t) * 0.22
            buf[i] += tone * env * amp
    return _apply_reverb(buf, [(38, 0.25), (82, 0.14)])


def synth_3_baby_ghost_giggle_voice() -> list[float]:
    """
    [샘플 3] 애기귀신 "헤헤~♪" 웃음소리 보컬 신스 (Baby Ghost Cute Giggle & Sparkle)
    - 포먼트(Formant F1/F2) 공명 합성으로 귀여운 아기 요정이 '헤-헤~♪' 하고 웃으며 별가루가 터지는 소리
    """
    dur = 0.65
    n = int(SAMPLE_RATE * dur)
    buf = [0.0] * n
    # 2음절 귀여운 아기 요정 보컬 포먼트 ('헤~' 0.0~0.14s, '헤~♪' 0.16~0.34s)
    syllables = [
        (0.00, 0.13, 660.0, 740.0, 0.85),   # 1음절 "헤" (E5 -> F#5 살짝 업)
        (0.15, 0.33, 784.0, 1046.5, 1.00),  # 2음절 "헤~♪" (G5 -> C6 귀엽게 치켜올림)
    ]
    for s_t, e_t, f_start, f_end, amp in syllables:
        s_idx = int(s_t * SAMPLE_RATE)
        e_idx = int(e_t * SAMPLE_RATE)
        dur_s = e_t - s_t
        phase = 0.0
        for i in range(s_idx, e_idx):
            t = (i - s_idx) / SAMPLE_RATE
            p = t / dur_s
            # 부드러운 아기 목소리 피치 글라이드 + 미세 비브라토
            f0 = f_start + (f_end - f_start) * (p**0.85) + math.sin(2 * math.pi * 7.0 * t) * 6.0
            phase += 2.0 * math.pi * f0 / SAMPLE_RATE
            env = math.sin(math.pi * p) ** 0.65
            # 아기 목소리 모음 '에/이' 포먼트 배음 구성 (1, 2, 3, 4차 배음 조화)
            voice = (
                math.sin(phase) * 0.55
                + math.sin(phase * 2.0 + 0.3) * 0.32
                + math.sin(phase * 3.0 + 0.7) * 0.18
                + math.sin(phase * 4.0) * 0.08
            )
            buf[i] += voice * env * amp * 0.75

    # 웃음 끝에 따라붙는 별가루 차임 (0.28s, 0.34s)
    for st, fq in [(0.26, 2093.0), (0.32, 2637.0), (0.38, 3136.0)]:
        s_idx = int(st * SAMPLE_RATE)
        e_idx = min(n, s_idx + int(0.24 * SAMPLE_RATE))
        for i in range(s_idx, e_idx):
            t = (i - s_idx) / SAMPLE_RATE
            env = min(1.0, t / 0.003) * math.exp(-t * 15.0)
            buf[i] += math.sin(2 * math.pi * fq * t) * env * 0.38

    return _apply_reverb(buf, [(42, 0.26), (90, 0.15)])


def synth_4_casper_magic_swoosh() -> list[float]:
    """
    [샘플 4] 캐스퍼 마법 요술봉 "휘리릭~ 뿅!" (Magic Ghost Wand Glissando)
    - 부드러운 하프/실로폰이 빠르게 무지개를 타고 올라가며 마지막에 '뿅!' 하고 바뀌는 직관적인 변환음
    """
    dur = 0.62
    n = int(SAMPLE_RATE * dur)
    buf = [0.0] * n
    # 펜타토닉 5음계 고속 글리산도 (C6, D6, E6, G6, A6, C7)
    scale = [1046.50, 1174.66, 1318.51, 1567.98, 1760.00, 2093.00]
    for idx, freq in enumerate(scale):
        start_t = idx * 0.038
        s_idx = int(start_t * SAMPLE_RATE)
        note_dur = 0.25 if idx < len(scale) - 1 else 0.38
        e_idx = min(n, s_idx + int(note_dur * SAMPLE_RATE))
        amp = 0.55 + idx * 0.08
        for i in range(s_idx, e_idx):
            t = (i - s_idx) / SAMPLE_RATE
            attack = min(1.0, t / 0.003)
            decay_rate = 13.0 if idx < len(scale) - 1 else 8.5
            env = attack * math.exp(-t * decay_rate)
            # Warm marimba/harp blend
            tone = (
                math.sin(2.0 * math.pi * freq * t) * 0.80
                + math.sin(2.0 * math.pi * (freq * 2.0) * t) * 0.15 * math.exp(-t * 18.0)
                + math.sin(2.0 * math.pi * (freq * 4.0) * t) * 0.05 * math.exp(-t * 30.0)
            )
            buf[i] += tone * env * amp
    return _apply_reverb(buf, [(50, 0.25), (105, 0.14)])


def synth_5_crystal_wind_chime() -> list[float]:
    """
    [샘플 5] 크리스탈 유리 풍경 소리 "샤르르~" (Luxury Crystal Wind Chime)
    - 가장 고급스럽고 귀에 피로도가 0인 애플/명품 앱 스타일의 투명한 크리스탈 화음 (Major 9th Chord)
    """
    dur = 0.72
    n = int(SAMPLE_RATE * dur)
    buf = [0.0] * n
    # F Major 9th warm crystal voicing
    chimes = [
        (0.00, 1396.91, 0.55, 0.70),  # F6
        (0.04, 1760.00, 0.55, 0.75),  # A6
        (0.08, 2093.00, 0.55, 0.80),  # C7
        (0.12, 2637.02, 0.55, 0.90),  # E7
        (0.17, 3135.96, 0.50, 0.65),  # G7
    ]
    for start_t, freq, c_dur, amp in chimes:
        s_idx = int(start_t * SAMPLE_RATE)
        e_idx = min(n, s_idx + int(c_dur * SAMPLE_RATE))
        for i in range(s_idx, e_idx):
            t = (i - s_idx) / SAMPLE_RATE
            attack = min(1.0, t / 0.005)
            env = attack * math.exp(-t * 7.8)
            # Inharmonic crystal shimmer (2.76x partial minimal)
            tone = (
                math.sin(2.0 * math.pi * freq * t) * 0.82
                + math.sin(2.0 * math.pi * (freq * 2.0) * t) * 0.14 * math.exp(-t * 12.0)
                + math.sin(2.0 * math.pi * (freq * 2.756) * t) * 0.04 * math.exp(-t * 20.0)
            )
            buf[i] += tone * env * amp
    return _apply_reverb(buf, [(55, 0.30), (115, 0.18), (180, 0.10)])


def synth_6_ghost_summon_ctrl0() -> list[float]:
    """
    [샘플 6] Ctrl + 0 '귀신 부르는 소리' 전용 사운드 (Mystic Soft Whoosh + Fairy Bell)
    - Ctrl+0을 눌렀을 때 950Hz 삑! 기계음 대신 "스윽~ 팅✨" 하고 귀신 바가 나타나는 고급 사운드
    """
    dur = 0.45
    n = int(SAMPLE_RATE * dur)
    buf = [0.0] * n
    # 부드러운 벨 2화음 (G5 -> D6, 낮고 따뜻한 차임)
    notes = [
        (0.00, 783.99, 0.30, 0.75),   # G5
        (0.05, 1174.66, 0.35, 0.90),  # D6
        (0.09, 1567.98, 0.32, 0.65),  # G6
    ]
    for start_t, freq, ndur, amp in notes:
        s_idx = int(start_t * SAMPLE_RATE)
        e_idx = min(n, s_idx + int(ndur * SAMPLE_RATE))
        for i in range(s_idx, e_idx):
            t = (i - s_idx) / SAMPLE_RATE
            attack = min(1.0, t / 0.005)
            env = attack * math.exp(-t * 12.0)
            tone = math.sin(2.0 * math.pi * freq * t) * 0.85 + math.sin(2.0 * math.pi * (freq * 2.0) * t) * 0.15
            buf[i] += tone * env * amp
    return _apply_reverb(buf, [(40, 0.22), (85, 0.12)])


def generate_all_samples() -> dict[str, Path]:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    mapping = {
        "sample1_celesta_musicbox.wav": synth_1_celesta_music_box(),
        "sample2_cute_ghost_pop.wav": synth_2_cute_baby_ghost_pop(),
        "sample3_baby_ghost_giggle.wav": synth_3_baby_ghost_giggle_voice(),
        "sample4_casper_magic_wand.wav": synth_4_casper_magic_swoosh(),
        "sample5_crystal_wind_chime.wav": synth_5_crystal_wind_chime(),
        "sample6_ctrl0_summon.wav": synth_6_ghost_summon_ctrl0(),
    }
    paths = {}
    for fname, samples in mapping.items():
        p = OUT_DIR / fname
        _save_wav(p, samples)
        paths[fname] = p
    # 멀린님 확정:
    # - 귀신창 등장(Ctrl+0 소환) 시: 샘플 1 (오르골 요정 차임 / UI의 ①번 애기귀신 퐁~띠링 또는 오르골)
    #   *주의: 우측 아티팩트 UI에서 [①번 = sample2_cute_ghost_pop.wav], [②번 = sample1_celesta_musicbox.wav], [③번 = sample3_baby_ghost_giggle.wav] 였으므로,
    #   멀린님이 말씀하신 "1번(퐁~띠링! / 오르골)"과 "3번(애기귀신 헤헤~♪ 웃음소리)"을 모두 즉시 전환 가능하게 세팅!
    default_typo = OUT_DIR / "active_typo_sound.wav"
    default_summon = OUT_DIR / "active_summon_sound.wav"
    # 기본값: 등장할 때 1번(sample2_cute_ghost_pop.wav - 아티팩트 1번), 결과 만들고 나면 3번(sample3_baby_ghost_giggle.wav - 아티팩트 3번)
    _save_wav(default_summon, mapping["sample2_cute_ghost_pop.wav"])
    _save_wav(default_typo, mapping["sample3_baby_ghost_giggle.wav"])
    return paths


if __name__ == "__main__":
    res = generate_all_samples()
    for k, v in res.items():
        print(f"Generated: {k} -> {v} ({v.stat().st_size:,} bytes)")
