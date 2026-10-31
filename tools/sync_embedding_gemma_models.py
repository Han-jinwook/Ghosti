#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
❖ EmbeddingGemma 2 모델 가중치 로컬 마스터 사본 영구 보관 & Cloudflare R2 업로드 마스터 도구
- HuggingFace(`onnx-community/embeddinggemma-2-ONNX`)의 8비트(quantized), 4비트(q4), 토크나이저 일체를 다운로드하여
  사내 오프라인 골든 마스터 드라이브에 SHA-256 검증과 함께 영구 보존하고, Cloudflare R2 버킷으로 일괄 업로드합니다.

[PC별 기본 보관 경로]
- 집 PC 및 사무실 1~3호 PC: D:\\Merlin_AI_Models\\embeddinggemma-2\\
- 사무실 4호 PC: E:\\Merlin_AI_Models\\embeddinggemma-2\\
"""

import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import urllib.request

try:
    if sys.stdout and hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if sys.stderr and hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

MODEL_REPO = "onnx-community/embeddinggemma-2-ONNX"
HF_BASE_URL = f"https://huggingface.co/{MODEL_REPO}/resolve/main"
DEFAULT_R2_BUCKET = "merlin-ai-models"
R2_KEY_PREFIX = "onnx-community/embeddinggemma-2-ONNX/resolve/main"

# 핵심 메타데이터 및 토크나이저 파일 목록
CORE_FILES = [
    "config.json",
    "config_sentence_transformers.json",
    "preprocessor_config.json",
    "processor_config.json",
    "tokenizer.json",
    "tokenizer_config.json",
]

# 8비트 (PC 데스크톱 100% 통일 & 고사양 모바일용 — dtype: 'q8' -> '_quantized')
ONNX_8BIT_FILES = [
    "onnx/model_quantized.onnx",
    "onnx/model_quantized.onnx_data",
    "onnx/audio_encoder_quantized.onnx",
    "onnx/audio_encoder_quantized.onnx_data",
    "onnx/vision_encoder_quantized.onnx",
    "onnx/vision_encoder_quantized.onnx_data",
]

# 4비트 (일반/보급형 모바일용 — dtype: 'q4' -> '_q4')
ONNX_4BIT_FILES = [
    "onnx/model_q4.onnx",
    "onnx/model_q4.onnx_data",
    "onnx/audio_encoder_q4.onnx",
    "onnx/audio_encoder_q4.onnx_data",
    "onnx/vision_encoder_q4.onnx",
    "onnx/vision_encoder_q4.onnx_data",
]


def get_default_target_dir() -> Path:
    """PC 환경별 기본 로컬 마스터 경로 결정 (4호 PC는 E:, 집 및 1~3호 PC는 D:)"""
    if sys.platform == "win32":
        if Path("E:\\").exists() and not Path("D:\\").exists():
            return Path("E:\\Merlin_AI_Models\\embeddinggemma-2")
        if Path("D:\\").exists():
            return Path("D:\\Merlin_AI_Models\\embeddinggemma-2")
    return Path("./Merlin_AI_Models/embeddinggemma-2").resolve()


def compute_sha256(file_path: Path) -> str:
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        while True:
            chunk = f.read(4 * 1024 * 1024)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def download_file(rel_path: str, target_dir: Path) -> bool:
    url = f"{HF_BASE_URL}/{rel_path}"
    dest = target_dir / rel_path
    dest.parent.mkdir(parents=True, exist_ok=True)

    # 원격 Content-Length 확인하여 중단된 파일 이어받기/재다운로드 보장
    expected_size = 0
    try:
        head_req = urllib.request.Request(
            url, method="HEAD", headers={"User-Agent": "Merlin_Model_Archiver/2.0"}
        )
        with urllib.request.urlopen(head_req, timeout=20) as resp:
            expected_size = int(resp.headers.get("Content-Length") or 0)
    except Exception:
        expected_size = 0

    if dest.exists() and dest.stat().st_size > 0:
        if expected_size == 0 or dest.stat().st_size == expected_size:
            print(
                f"  [SKIP] 이미 검증 완료: {rel_path} ({dest.stat().st_size / 1024 / 1024:.2f} MB)"
            )
            return True

    print(
        f"  [DOWN] 다운로드 시작: {rel_path}"
        + (f" ({expected_size / 1024 / 1024:.2f} MB)" if expected_size else "")
    )
    tmp_dest = dest.with_suffix(dest.suffix + ".part")
    try:
        req = urllib.request.Request(
            url, headers={"User-Agent": "Merlin_Model_Archiver/2.0"}
        )
        with urllib.request.urlopen(req, timeout=180) as resp, open(tmp_dest, "wb") as out:
            chunk_size = 4 * 1024 * 1024
            downloaded = 0
            while True:
                chunk = resp.read(chunk_size)
                if not chunk:
                    break
                out.write(chunk)
                downloaded += len(chunk)
        tmp_dest.replace(dest)
        print(f"  [DONE] 저장 완료: {rel_path} ({dest.stat().st_size / 1024 / 1024:.2f} MB)")
        return True
    except Exception as e:
        print(f"  [ERROR] {rel_path} 다운로드 실패: {e}")
        if tmp_dest.exists():
            tmp_dest.unlink(missing_ok=True)
        return False


def write_sha256_manifest(target_dir: Path, files: list[str]) -> Path:
    manifest = {
        "modelRepo": MODEL_REPO,
        "targetDir": str(target_dir),
        "files": {},
        "totalBytes": 0,
    }
    for rel in files:
        p = target_dir / rel
        if p.exists() and p.is_file():
            sz = p.stat().st_size
            manifest["files"][rel] = {
                "sizeBytes": sz,
                "sizeMB": round(sz / 1024 / 1024, 2),
                "sha256": compute_sha256(p),
            }
            manifest["totalBytes"] += sz
    manifest["totalMB"] = round(manifest["totalBytes"] / 1024 / 1024, 2)
    manifest_path = target_dir / "manifest_sha256.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(
        f"\n🛡️ SHA-256 무결성 원장 생성 완료: {manifest_path} (총 {len(manifest['files'])}개 파일, {manifest['totalMB']} MB)"
    )
    return manifest_path


def upload_to_cloudflare_r2(target_dir: Path, files: list[str], bucket: str = DEFAULT_R2_BUCKET) -> bool:
    print("\n" + "=" * 70)
    print(f"☁️ Cloudflare R2 버킷({bucket}) 업로드 시작")
    print("=" * 70)

    npx_cmd = "npx.cmd" if sys.platform == "win32" else "npx"
    # 1. 로그인 상태 확인
    whoami = subprocess.run([npx_cmd, "wrangler", "whoami"], capture_output=True, text=True, encoding="utf-8", errors="replace")
    if "You are not authenticated" in (whoami.stdout or "") + (whoami.stderr or ""):
        print("⚠️ Cloudflare 로그인이 필요합니다. 먼저 `npx wrangler login`을 1회 실행해 주세요.")
        return False

    # 2. 버킷 생성 시도 (이미 있으면 무시)
    subprocess.run([npx_cmd, "wrangler", "r2", "bucket", "create", bucket], capture_output=True)

    # 3. 전체 파일 업로드
    all_to_upload = list(files) + ["manifest_sha256.json"]
    success_count = 0
    for rel in all_to_upload:
        local_file = target_dir / rel
        if not local_file.exists():
            continue
        r2_key = f"{bucket}/{R2_KEY_PREFIX}/{rel}"
        print(f"  [R2 PUT] {rel} ({local_file.stat().st_size / 1024 / 1024:.2f} MB) ➔ {r2_key}")
        res = subprocess.run(
            [npx_cmd, "wrangler", "r2", "object", "put", r2_key, "--file", str(local_file), "--remote"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        if res.returncode == 0:
            success_count += 1
        else:
            print(f"  [R2 ERROR] {rel}: {(res.stderr or res.stdout).strip()}")

    print(f"\n✅ Cloudflare R2 업로드 완료: {success_count}/{len(all_to_upload)}개 파일")
    return success_count == len(all_to_upload)


def sync_all(
    target_dir: Path,
    include_onnx: bool = True,
    include_8bit: bool = True,
    include_4bit: bool = True,
    upload_r2: bool = False,
    r2_bucket: str = DEFAULT_R2_BUCKET,
):
    print("=" * 70)
    print("📦 EmbeddingGemma 2 마스터 사본 동기화 시작")
    print(f"📂 대상 로컬 경로: {target_dir}")
    print("=" * 70)

    target_dir.mkdir(parents=True, exist_ok=True)
    target_files: list[str] = list(CORE_FILES)

    print("\n1. 메타데이터 및 토크나이저 파일 백업:")
    for f in CORE_FILES:
        download_file(f, target_dir)

    if include_onnx and include_8bit:
        print("\n2. 8비트(q8 / quantized — PC 100% 통일 & 고사양 모바일용) ONNX 파일 백업:")
        for f in ONNX_8BIT_FILES:
            download_file(f, target_dir)
            target_files.append(f)

    if include_onnx and include_4bit:
        print("\n3. 4비트(q4 — 일반/보급형 모바일용) ONNX 파일 백업:")
        for f in ONNX_4BIT_FILES:
            download_file(f, target_dir)
            target_files.append(f)

    write_sha256_manifest(target_dir, target_files)

    if upload_r2:
        upload_to_cloudflare_r2(target_dir, target_files, bucket=r2_bucket)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="EmbeddingGemma 2 모델 가중치 마스터 사본 동기화 및 R2 업로드")
    parser.add_argument("--dir", type=str, default=None, help="다운로드 타겟 디렉토리 (기본값: D:\\Merlin_AI_Models 또는 E:\\...)")
    parser.add_argument("--meta-only", action="store_true", help="설정 및 토크나이저 파일만 우선 동기화")
    parser.add_argument("--skip-8bit", action="store_true", help="8비트 모델 제외")
    parser.add_argument("--skip-4bit", action="store_true", help="4비트 모델 제외")
    parser.add_argument("--upload-r2", action="store_true", help="로컬 마스터 사본을 Cloudflare R2 버킷에 업로드")
    parser.add_argument("--r2-bucket", type=str, default=DEFAULT_R2_BUCKET, help="Cloudflare R2 버킷 이름")
    args = parser.parse_args()

    target = Path(args.dir) if args.dir else get_default_target_dir()
    sync_all(
        target,
        include_onnx=not args.meta_only,
        include_8bit=not args.skip_8bit,
        include_4bit=not args.skip_4bit,
        upload_r2=args.upload_r2,
        r2_bucket=args.r2_bucket,
    )
