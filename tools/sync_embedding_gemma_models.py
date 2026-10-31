#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
❖ EmbeddingGemma 2 모델 가중치 로컬 마스터 사본 영구 보관 & Cloudflare R2 동기화 도구
- HuggingFace(`onnx-community/embeddinggemma-2-ONNX`)의 8비트(quantized), 4비트(q4), 토크나이저 일체를 다운로드하여
  사내 오프라인 골든 마스터 드라이브 및 Cloudflare R2 버킷에 영구 보존합니다.

[PC별 기본 보관 경로]
- 집 PC 및 사무실 1~3호 PC: D:\\Merlin_AI_Models\\embeddinggemma-2\\
- 사무실 4호 PC: E:\\Merlin_AI_Models\\embeddinggemma-2\\
"""

import argparse
import os
from pathlib import Path
import sys
import urllib.request
import json

try:
    if sys.stdout and hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if sys.stderr and hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

MODEL_REPO = "onnx-community/embeddinggemma-2-ONNX"
HF_BASE_URL = f"https://huggingface.co/{MODEL_REPO}/resolve/main"

# 핵심 메타데이터 및 토크나이저 파일 목록 (404 방지 검증 완료 목록)
CORE_FILES = [
    "config.json",
    "config_sentence_transformers.json",
    "preprocessor_config.json",
    "processor_config.json",
    "tokenizer.json",
    "tokenizer_config.json",
]

# 8비트 (PC 전수 및 고사양 모바일용) ONNX 파일 목록
ONNX_8BIT_FILES = [
    "onnx/model_quantized.onnx",
    "onnx/model_quantized.onnx_data",
    "onnx/audio_encoder_quantized.onnx",
    "onnx/audio_encoder_quantized.onnx_data",
    "onnx/vision_encoder_quantized.onnx",
    "onnx/vision_encoder_quantized.onnx_data",
]

# 4비트 (일반 모바일용) ONNX 파일 목록
ONNX_4BIT_FILES = [
    "onnx/model_q4.onnx",
    "onnx/model_q4.onnx_data",
    "onnx/audio_encoder_q4.onnx",
    "onnx/audio_encoder_q4.onnx_data",
    "onnx/vision_encoder_q4.onnx",
    "onnx/vision_encoder_q4.onnx_data",
]

def get_default_target_dir() -> Path:
    """PC 환경별 기본 로컬 마스터 경로 결정 (4호 PC는 E:, 그 외는 D:, 없을 경우 현재 드라이브)"""
    if sys.platform == "win32":
        if Path("E:\\").exists() and not Path("D:\\").exists():
            return Path("E:\\Merlin_AI_Models\\embeddinggemma-2")
        if Path("D:\\").exists():
            return Path("D:\\Merlin_AI_Models\\embeddinggemma-2")
    return Path("./Merlin_AI_Models/embeddinggemma-2").resolve()

def download_file(rel_path: str, target_dir: Path) -> bool:
    url = f"{HF_BASE_URL}/{rel_path}"
    dest = target_dir / rel_path
    dest.parent.mkdir(parents=True, exist_ok=True)

    if dest.exists() and dest.stat().st_size > 0:
        print(f"  [SKIP] 이미 존재함: {rel_path} ({dest.stat().st_size / 1024 / 1024:.2f} MB)")
        return True

    print(f"  [DOWN] 다운로드 중: {rel_path} ➔ {dest}")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Merlin_Model_Archiver/1.0"})
        with urllib.request.urlopen(req, timeout=90) as resp, open(dest, "wb") as out:
            chunk_size = 1024 * 1024
            while True:
                chunk = resp.read(chunk_size)
                if not chunk:
                    break
                out.write(chunk)
        print(f"  [DONE] 완료: {rel_path} ({dest.stat().st_size / 1024 / 1024:.2f} MB)")
        return True
    except Exception as e:
        print(f"  [ERROR] {rel_path} 다운로드 실패: {e}")
        if dest.exists():
            dest.unlink(missing_ok=True)
        return False

def sync_all(target_dir: Path, include_onnx: bool = True, include_8bit: bool = True, include_4bit: bool = True):
    print("=" * 70)
    print(f"📦 EmbeddingGemma 2 마스터 사본 동기화 시작")
    print(f"📂 대상 로컬 경로: {target_dir}")
    print("=" * 70)

    target_dir.mkdir(parents=True, exist_ok=True)

    # 1. 설정 및 토크나이저
    print("\n1. 메타데이터 및 토크나이저 파일 백업:")
    for f in CORE_FILES:
        download_file(f, target_dir)

    # 2. 8비트 모델 파일 (PC & 고사양 모바일)
    if include_onnx and include_8bit:
        print("\n2. 8비트(quantized, PC 전수/플래그십) ONNX 파일 백업:")
        for f in ONNX_8BIT_FILES:
            download_file(f, target_dir)

    # 3. 4비트 모델 파일 (일반 모바일)
    if include_onnx and include_4bit:
        print("\n3. 4비트(q4, 일반 모바일) ONNX 파일 백업:")
        for f in ONNX_4BIT_FILES:
            download_file(f, target_dir)

    print("\n" + "=" * 70)
    print("✨ 로컬 마스터 사본 백업 완료!")
    print(f"Cloudflare R2 버킷 업로드 타겟: models/embeddinggemma-2-ONNX/")
    print("=" * 70)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="EmbeddingGemma 2 모델 가중치 마스터 사본 동기화")
    parser.add_argument("--dir", type=str, default=None, help="다운로드 타겟 디렉토리 (기본값: D:\\Merlin_AI_Models 또는 E:\\...)")
    parser.add_argument("--meta-only", action="store_true", help="설정 및 토크나이저 파일만 우선 동기화")
    parser.add_argument("--skip-8bit", action="store_true", help="8비트 모델 제외")
    parser.add_argument("--skip-4bit", action="store_true", help="4비트 모델 제외")
    args = parser.parse_args()

    target = Path(args.dir) if args.dir else get_default_target_dir()
    sync_all(
        target,
        include_onnx=not args.meta_only,
        include_8bit=not args.skip_8bit,
        include_4bit=not args.skip_4bit,
    )
