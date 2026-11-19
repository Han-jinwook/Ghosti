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

  // 실제 빌드된 JS 번들에서 참조하지 않는 미사용 중복 JSEP WASM만 안전하게 제거 (참조 중인 WASM 삭제 시 OCR/비전 404 발생 원천 방지)
  const assetsDir = path.join(pubDir, 'assets');
  if (fs.existsSync(assetsDir)) {
    const jsContents = fs
      .readdirSync(assetsDir)
      .filter((f) => f.endsWith('.js') || f.endsWith('.mjs'))
      .map((f) => fs.readFileSync(path.join(assetsDir, f), 'utf8'))
      .join('\n');
    for (const file of fs.readdirSync(assetsDir)) {
      if (
        file.startsWith('ort-wasm-simd-threaded.jsep') &&
        file.endsWith('.wasm') &&
        !jsContents.includes(file)
      ) {
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
