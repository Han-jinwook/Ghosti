#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
❖ EmbeddingGemma 2 모델 가중치 로컬 마스터 사본 영구 보관 & GitHub Releases 무제한 무료 CDN 업로드 도구
- 카드 등록 허들이 있는 외부 클라우드 대신, 이미 인증된 당사 GitHub Releases(`Han-jinwook/Ghosti`, tag: `models-embeddinggemma2-v1`)에
  8비트(quantized), 4비트(q4), 토크나이저 및 SHA-256 무결성 원장 전체(19개 파일, 1.29GB)를 100% 무인 업로드합니다.

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
import urllib.error
import urllib.parse
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
GH_REPO = "Han-jinwook/Ghosti"
GH_RELEASE_TAG = "models-embeddinggemma2-v1"
GH_RELEASE_DOWNLOAD_BASE = f"https://github.com/{GH_REPO}/releases/download/{GH_RELEASE_TAG}"

CORE_FILES = [
    "config.json",
    "config_sentence_transformers.json",
    "preprocessor_config.json",
    "processor_config.json",
    "tokenizer.json",
    "tokenizer_config.json",
]

ONNX_8BIT_FILES = [
    "onnx/model_quantized.onnx",
    "onnx/model_quantized.onnx_data",
    "onnx/audio_encoder_quantized.onnx",
    "onnx/audio_encoder_quantized.onnx_data",
    "onnx/vision_encoder_quantized.onnx",
    "onnx/vision_encoder_quantized.onnx_data",
]

ONNX_4BIT_FILES = [
    "onnx/model_q4.onnx",
    "onnx/model_q4.onnx_data",
    "onnx/audio_encoder_q4.onnx",
    "onnx/audio_encoder_q4.onnx_data",
    "onnx/vision_encoder_q4.onnx",
    "onnx/vision_encoder_q4.onnx_data",
]


def rel_to_asset_name(rel_path: str) -> str:
    """GitHub Release 에셋 이름은 슬래시(/)를 허용하지 않으므로 'onnx/...' -> 'onnx__...'로 매핑합니다."""
    return rel_path.replace("/", "__")


def get_default_target_dir() -> Path:
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
    dest = target_dir / rel_path
    dest.parent.mkdir(parents=True, exist_ok=True)

    # 1순위: HuggingFace 공식 CDN, 2순위: 당사 GitHub Releases 무제한 무료 미러
    candidate_urls = [
        f"{HF_BASE_URL}/{rel_path}",
        f"{GH_RELEASE_DOWNLOAD_BASE}/{rel_to_asset_name(rel_path)}",
    ]

    if dest.exists() and dest.stat().st_size > 0:
        print(f"  [SKIP] 이미 존재함: {rel_path} ({dest.stat().st_size / 1024 / 1024:.2f} MB)")
        return True

    for url in candidate_urls:
        print(f"  [DOWN] 다운로드 시도: {rel_path} <- {url}")
        tmp_dest = dest.with_suffix(dest.suffix + ".part")
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Merlin_Model_Archiver/3.0"})
            with urllib.request.urlopen(req, timeout=180) as resp, open(tmp_dest, "wb") as out:
                while True:
                    chunk = resp.read(4 * 1024 * 1024)
                    if not chunk:
                        break
                    out.write(chunk)
            tmp_dest.replace(dest)
            print(f"  [DONE] 저장 완료: {rel_path} ({dest.stat().st_size / 1024 / 1024:.2f} MB)")
            return True
        except Exception as e:
            print(f"  [WARN] {url} 실패: {e}")
            if tmp_dest.exists():
                tmp_dest.unlink(missing_ok=True)
    return False


def write_sha256_manifest(target_dir: Path, files: list[str]) -> Path:
    manifest = {
        "modelRepo": MODEL_REPO,
        "mirrorRelease": f"https://github.com/{GH_REPO}/releases/tag/{GH_RELEASE_TAG}",
        "targetDir": str(target_dir),
        "files": {},
        "totalBytes": 0,
    }
    for rel in files:
        p = target_dir / rel
        if p.exists() and p.is_file():
            sz = p.stat().st_size
            asset_name = rel_to_asset_name(rel)
            manifest["files"][rel] = {
                "sizeBytes": sz,
                "sizeMB": round(sz / 1024 / 1024, 2),
                "sha256": compute_sha256(p),
                "mirrorUrl": f"{GH_RELEASE_DOWNLOAD_BASE}/{asset_name}",
            }
            manifest["totalBytes"] += sz
    manifest["totalMB"] = round(manifest["totalBytes"] / 1024 / 1024, 2)
    manifest_path = target_dir / "manifest_sha256.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n🛡️ SHA-256 무결성 원장 생성 완료: {manifest_path} (총 {len(manifest['files'])}개 파일, {manifest['totalMB']} MB)")
    return manifest_path


def get_github_token() -> str:
    env_tok = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if env_tok:
        return env_tok.strip()
    p = subprocess.run(
        ["git", "credential", "fill"],
        input="protocol=https\nhost=github.com\n\n",
        capture_output=True,
        text=True,
    )
    for line in (p.stdout or "").splitlines():
        if line.startswith("password="):
            return line.split("=", 1)[1].strip()
    raise RuntimeError("GitHub 인증 토큰을 찾을 수 없습니다.")


def upload_to_github_release(target_dir: Path, files: list[str]) -> bool:
    print("\n" + "=" * 70)
    print(f"🚀 GitHub Releases 무제한 무료 CDN ({GH_REPO} @ {GH_RELEASE_TAG}) 무인 업로드 시작")
    print("=" * 70)

    token = get_github_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "Ghosti-Model-Uploader",
    }

    # 1. 릴리스 조회 또는 생성
    rel_url = f"https://api.github.com/repos/{GH_REPO}/releases/tags/{GH_RELEASE_TAG}"
    try:
        with urllib.request.urlopen(urllib.request.Request(rel_url, headers=headers), timeout=20) as resp:
            rel_data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        if e.code == 404:
            create_body = json.dumps(
                {
                    "tag_name": GH_RELEASE_TAG,
                    "name": "EmbeddingGemma 2 ONNX Master Mirror (Q8 & Q4)",
                    "body": "Master backup mirror of onnx-community/embeddinggemma-2-ONNX (8-bit quantized & 4-bit q4) with SHA-256 verification.",
                    "draft": False,
                    "prerelease": False,
                }
            ).encode("utf-8")
            create_req = urllib.request.Request(
                f"https://api.github.com/repos/{GH_REPO}/releases",
                data=create_body,
                headers={**headers, "Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(create_req, timeout=20) as resp:
                rel_data = json.loads(resp.read().decode("utf-8"))
        else:
            raise

    release_id = rel_data["id"]
    existing_assets = {a["name"]: a for a in rel_data.get("assets", [])}

    all_to_upload = list(files) + ["manifest_sha256.json"]
    uploaded_count = 0

    for rel in all_to_upload:
        local_file = target_dir / rel
        if not local_file.exists():
            continue
        asset_name = rel_to_asset_name(rel)
        local_size = local_file.stat().st_size

        if asset_name in existing_assets and existing_assets[asset_name].get("size") == local_size:
            print(f"  [SKIP] 이미 업로드 완료: {asset_name} ({local_size / 1024 / 1024:.2f} MB)")
            uploaded_count += 1
            continue

        if asset_name in existing_assets:
            del_id = existing_assets[asset_name]["id"]
            del_req = urllib.request.Request(
                f"https://api.github.com/repos/{GH_REPO}/releases/assets/{del_id}",
                headers=headers,
                method="DELETE",
            )
            try:
                urllib.request.urlopen(del_req, timeout=20).close()
            except Exception:
                pass

        upload_url = (
            f"https://uploads.github.com/repos/{GH_REPO}/releases/{release_id}/assets?name="
            + urllib.parse.quote(asset_name)
        )
        print(f"  [UPLOAD] {rel} ({local_size / 1024 / 1024:.2f} MB) ➔ {asset_name}")
        with open(local_file, "rb") as f:
            up_req = urllib.request.Request(
                upload_url,
                data=f,
                headers={
                    **headers,
                    "Content-Type": "application/octet-stream",
                    "Content-Length": str(local_size),
                },
                method="POST",
            )
            with urllib.request.urlopen(up_req, timeout=600) as resp:
                if resp.status in (200, 201):
                    uploaded_count += 1
                    print(f"  [OK] 업로드 완료: {asset_name}")

    print(f"\n✅ GitHub Releases 무인 업로드 완료: {uploaded_count}/{len(all_to_upload)}개 파일")
    print(f"🔗 마스터 릴리스 URL: https://github.com/{GH_REPO}/releases/tag/{GH_RELEASE_TAG}")
    return uploaded_count == len(all_to_upload)


def sync_all(
    target_dir: Path,
    include_onnx: bool = True,
    include_8bit: bool = True,
    include_4bit: bool = True,
    upload_mirror: bool = False,
):
    print("=" * 70)
    print("📦 EmbeddingGemma 2 마스터 사본 동기화 시작")
    print(f"📂 대상 로컬 경로: {target_dir}")
    print("=" * 70)

    target_dir.mkdir(parents=True, exist_ok=True)
    target_files: list[str] = list(CORE_FILES)

    for f in CORE_FILES:
        download_file(f, target_dir)

    if include_onnx and include_8bit:
        for f in ONNX_8BIT_FILES:
            download_file(f, target_dir)
            target_files.append(f)

    if include_onnx and include_4bit:
        for f in ONNX_4BIT_FILES:
            download_file(f, target_dir)
            target_files.append(f)

    manifest_file = target_dir / "manifest_sha256.json"
    if not manifest_file.exists():
        write_sha256_manifest(target_dir, target_files)

    if upload_mirror:
        upload_to_github_release(target_dir, target_files)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="EmbeddingGemma 2 모델 가중치 마스터 사본 동기화 및 GitHub Releases 무인 업로드")
    parser.add_argument("--dir", type=str, default=None)
    parser.add_argument("--meta-only", action="store_true")
    parser.add_argument("--skip-8bit", action="store_true")
    parser.add_argument("--skip-4bit", action="store_true")
    parser.add_argument("--upload-mirror", action="store_true", help="GitHub Releases 무제한 무료 CDN에 업로드")
    parser.add_argument("--upload-r2", action="store_true", help="(하위 호환) GitHub Releases 미러로 자동 업로드")
    args = parser.parse_args()

    target = Path(args.dir) if args.dir else get_default_target_dir()
    sync_all(
        target,
        include_onnx=not args.meta_only,
        include_8bit=not args.skip_8bit,
        include_4bit=not args.skip_4bit,
        upload_mirror=bool(args.upload_mirror or args.upload_r2),
    )
