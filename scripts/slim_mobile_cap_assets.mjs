import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const MOBILE_PUBLIC_TARGETS = [
  path.join(ROOT, 'android', 'app', 'src', 'main', 'assets', 'public'),
  path.join(ROOT, 'ios', 'App', 'App', 'public'),
];

// PC 웹 쇼룸·윈도우 설치파일 전용 대용량 에셋 (모바일 스토어 앱에서는 미사용 · 번들 약 200MB 절감)
const RELATIVE_PATHS_TO_REMOVE = [
  'Merlin_Z_Core.zip',
  'showroom',
  'poc',
  'images',
];

let totalSavedBytes = 0;

function getPathSize(targetPath) {
  if (!fs.existsSync(targetPath)) return 0;
  const stat = fs.statSync(targetPath);
  if (stat.isFile()) return stat.size;
  let sum = 0;
  for (const entry of fs.readdirSync(targetPath)) {
    sum += getPathSize(path.join(targetPath, entry));
  }
  return sum;
}

for (const pubDir of MOBILE_PUBLIC_TARGETS) {
  if (!fs.existsSync(pubDir)) continue;

  for (const rel of RELATIVE_PATHS_TO_REMOVE) {
    const full = path.join(pubDir, rel);
    if (fs.existsSync(full)) {
      totalSavedBytes += getPathSize(full);
      fs.rmSync(full, { recursive: true, force: true });
    }
  }

  // 모바일은 WebGPU(JSEP) 대신 순수 WASM 런타임만 사용하므로 중복 27MB JSEP WASM 제거
  const assetsDir = path.join(pubDir, 'assets');
  if (fs.existsSync(assetsDir)) {
    for (const file of fs.readdirSync(assetsDir)) {
      if (file.startsWith('ort-wasm-simd-threaded.jsep') && file.endsWith('.wasm')) {
        const fullWasm = path.join(assetsDir, file);
        totalSavedBytes += getPathSize(fullWasm);
        fs.rmSync(fullWasm, { force: true });
      }
    }
  }
}

if (totalSavedBytes > 0) {
  console.log(
    `[Ghosti Mobile Slimmer] Stripped ${(totalSavedBytes / 1024 / 1024).toFixed(1)} MB of desktop-only assets from mobile bundle.`
  );
}
