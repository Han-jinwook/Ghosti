import { defineConfig, type Plugin } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
// 대표님이 제공하는 실제 가족사진 폴더 (D-11). 저장소 커밋/외부 전송 금지.
const PHOTO_DIR = path.resolve(ROOT, '../test_photos');
// 측정 리포트 저장 폴더 (PC 디스크에만 저장)
const RESULT_DIR = path.resolve(ROOT, 'results');
// TTS로 합성한 음성 질의 WAV (scripts/make-audio-queries.ps1)
const AUDIO_DIR = path.resolve(ROOT, 'audio_queries');

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.heic', '.heif', '.avif']);
const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.gif': 'image/gif', '.bmp': 'image/bmp', '.heic': 'image/heic', '.heif': 'image/heif', '.avif': 'image/avif',
};

function listImages(dir: string, base = dir): { path: string; size: number }[] {
  if (!fs.existsSync(dir)) return [];
  const out: { path: string; size: number }[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listImages(full, base));
    else if (IMAGE_EXT.has(path.extname(entry.name).toLowerCase())) {
      out.push({ path: path.relative(base, full).split(path.sep).join('/'), size: fs.statSync(full).size });
    }
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * 개발 서버 전용 미들웨어 (LAN 내부에서만 동작, 프로덕션 빌드에 포함되지 않음)
 * - GET  /__photos/list        : ../test_photos 목록
 * - GET  /__photos/file?p=...  : 사진 파일 스트리밍 (폰에서 PC 사진 폴더로 테스트할 때 사용)
 * - POST /__poc/report         : 측정 리포트를 poc/results/ 에 저장
 */
function localBridge(): Plugin {
  return {
    name: 'saysee-poc-local-bridge',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__photos/list', (_req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ dir: PHOTO_DIR, exists: fs.existsSync(PHOTO_DIR), files: listImages(PHOTO_DIR) }));
      });

      server.middlewares.use('/__photos/file', (req, res) => {
        const rel = new URL(req.url ?? '', 'http://local').searchParams.get('p') ?? '';
        const full = path.resolve(PHOTO_DIR, rel);
        // 경로 탈출 방지
        if (!full.startsWith(PHOTO_DIR + path.sep) || !fs.existsSync(full)) {
          res.statusCode = 404;
          res.end('not found');
          return;
        }
        res.setHeader('Content-Type', MIME[path.extname(full).toLowerCase()] ?? 'application/octet-stream');
        res.setHeader('Cache-Control', 'no-store');
        fs.createReadStream(full).pipe(res);
      });

      server.middlewares.use('/__poc/audio/list', (_req, res) => {
        const files = fs.existsSync(AUDIO_DIR) ? fs.readdirSync(AUDIO_DIR).filter((f) => f.endsWith('.wav')) : [];
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ files }));
      });

      server.middlewares.use('/__poc/audio/file', (req, res) => {
        const f = new URL(req.url ?? '', 'http://local').searchParams.get('f') ?? '';
        const full = path.resolve(AUDIO_DIR, f);
        if (!full.startsWith(AUDIO_DIR + path.sep) || !fs.existsSync(full)) {
          res.statusCode = 404;
          res.end('not found');
          return;
        }
        res.setHeader('Content-Type', 'audio/wav');
        fs.createReadStream(full).pipe(res);
      });

      server.middlewares.use('/__poc/report', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
            fs.mkdirSync(RESULT_DIR, { recursive: true });
            const safeLabel = String(body?.label ?? 'run').replace(/[^\w.-]+/g, '_').slice(0, 60);
            const stamp = new Date().toISOString().replace(/[:.]/g, '-');
            const file = path.join(RESULT_DIR, `${stamp}_${safeLabel}.json`);
            fs.writeFileSync(file, JSON.stringify(body, null, 2), 'utf-8');
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, file: path.relative(ROOT, file) }));
          } catch (e) {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: String(e) }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  // 모바일 WebGPU는 보안 컨텍스트(HTTPS)가 필요 → 자체 서명 인증서 (I-19)
  plugins: [basicSsl(), localBridge()],
  server: {
    host: true, // 같은 WiFi의 폰에서 접속 가능
    port: 5199,
  },
  optimizeDeps: {
    // onnxruntime-web의 wasm/worker 경로 문제 방지
    exclude: ['@huggingface/transformers'],
  },
  build: { target: 'es2022' },
});
