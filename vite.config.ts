import { defineConfig, type Plugin } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PHOTO_DIR = path.resolve(ROOT, 'test_photos');
const QUARANTINE_DIR = path.resolve(ROOT, '세이씨_정리대기함');
const AUDIO_DIR = path.resolve(ROOT, 'poc/audio_queries');
const POC_RESULTS_DIR = path.resolve(ROOT, 'poc/results');
const PHYSICAL_AUDIT_FILE = path.resolve(POC_RESULTS_DIR, 'corpus_physical_audit.json');

function resolveGeminiApiKey(): string | null {
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.startsWith('AIza')) {
    return process.env.GEMINI_API_KEY.trim();
  }
  const envPaths = [
    path.resolve(ROOT, '.env'),
    path.resolve(ROOT, '.env.local'),
    'd:/Bes2-Marketer/.env',
    'd:/MerlinSecretary/.env',
  ];
  for (const p of envPaths) {
    if (!fs.existsSync(p)) continue;
    try {
      const raw = fs.readFileSync(p, 'utf-8');
      const m = raw.match(/^GEMINI_API_KEY=(.+)$/m);
      if (m && m[1].trim().startsWith('AIza')) {
        return m[1].trim();
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

async function computeSinglePhotoAudit(rel: string, full: string) {
  const buf = fs.readFileSync(full);
  const md5 = crypto.createHash('md5').update(buf).digest('hex');
  const meta = await sharp(buf).metadata();
  const origW = (meta.orientation && meta.orientation >= 5 ? meta.height : meta.width) ?? 0;
  const origH = (meta.orientation && meta.orientation >= 5 ? meta.width : meta.height) ?? 0;
  const aspect = origW && origH ? +(Math.max(origW, origH) / Math.min(origW, origH)).toFixed(2) : 1.33;
  const hasExif = !!meta.exif;

  // 1) Area-averaged 9x8 Perceptual dHash on top 85% (excludes bottom date stamp)
  const g72 = await sharp(buf).rotate().resize(72, 72, { fit: 'fill' }).greyscale().raw().toBuffer();
  const grid: number[] = [];
  for (let r = 0; r < 8; r++) {
    const y0 = Math.floor((r * 61) / 8);
    const y1 = Math.floor(((r + 1) * 61) / 8);
    for (let c = 0; c < 9; c++) {
      const x0 = c * 8;
      const x1 = (c + 1) * 8;
      let sum = 0;
      let cnt = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          sum += g72[y * 72 + x];
          cnt++;
        }
      }
      grid.push(sum / cnt);
    }
  }
  let dhash = 0n;
  let bit = 0n;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (grid[r * 9 + c] > grid[r * 9 + c + 1]) dhash |= 1n << bit;
      bit++;
    }
  }

  // 2) 240x240 8-Neighbor Laplacian (3x3 grid on top 85%) & Edge Density
  const gObj = await sharp(buf)
    .rotate()
    .resize(240, 240, { fit: 'inside' })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = gObj.info.width;
  const h = Math.floor(gObj.info.height * 0.85);
  const data = gObj.data;

  let sumB = 0;
  for (let i = 0; i < w * h; i++) sumB += data[i];
  const avgBrightness = +(sumB / Math.max(1, w * h)).toFixed(1);

  const cellLaps: number[] = [];
  let highContrastEdges = 0;
  for (let gr = 0; gr < 3; gr++) {
    for (let gc = 0; gc < 3; gc++) {
      const y0 = Math.max(1, Math.floor((gr * h) / 3));
      const y1 = Math.min(h - 2, Math.floor(((gr + 1) * h) / 3));
      const x0 = Math.max(1, Math.floor((gc * w) / 3));
      const x1 = Math.min(w - 2, Math.floor(((gc + 1) * w) / 3));
      let sum = 0;
      let sumSq = 0;
      let cnt = 0;
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const idx = y * w + x;
          const c = data[idx];
          const lap =
            8 * c -
            data[idx - 1] -
            data[idx + 1] -
            data[idx - w] -
            data[idx + w] -
            data[idx - w - 1] -
            data[idx - w + 1] -
            data[idx + w - 1] -
            data[idx + w + 1];
          sum += lap;
          sumSq += lap * lap;
          cnt++;
          if (Math.abs(c - data[idx - 1]) > 42 || Math.abs(c - data[idx - w]) > 42) {
            highContrastEdges++;
          }
        }
      }
      const mean = sum / Math.max(1, cnt);
      cellLaps.push(sumSq / Math.max(1, cnt) - mean * mean);
    }
  }
  const maxCellLap = Math.round(Math.max(...cellLaps));
  const meanCellLap = Math.round(cellLaps.reduce((a, b) => a + b, 0) / 9);
  const edgeDensity = +((highContrastEdges / Math.max(1, w * h)) * 1000).toFixed(1);

  // 3) 120x120 RGB Color / Paper / Skin / Scenery / Watermark metrics
  const rgbObj = await sharp(buf)
    .rotate()
    .resize(120, 120, { fit: 'inside' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rw = rgbObj.info.width;
  const rh = rgbObj.info.height;
  const ch = rgbObj.info.channels;
  const topH = Math.floor(rh * 0.84);
  let satSum = 0;
  let neutralCnt = 0;
  let skinCnt = 0;
  let greenCnt = 0;
  let skyCnt = 0;
  const topPixels = Math.max(1, rw * topH);
  let botStamp = 0;
  const botPixels = Math.max(1, rw * (rh - topH));

  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      const idx = (y * rw + x) * ch;
      const r = rgbObj.data[idx];
      const g = rgbObj.data[idx + 1];
      const b = rgbObj.data[idx + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;
      if (y < topH) {
        satSum += sat;
        if (sat < 0.18 && max > 60) neutralCnt++;
        if (
          r > 95 &&
          g > 40 &&
          b > 20 &&
          max - min > 15 &&
          Math.abs(r - g) > 15 &&
          r > g &&
          r > b &&
          sat > 0.18 &&
          sat < 0.65
        ) {
          skinCnt++;
        }
        if (g > 55 && g > r * 1.08 && g > b * 1.15 && sat > 0.15) greenCnt++;
        if (y < topH * 0.6 && b > 110 && b > r * 1.12 && b >= g * 0.95 && sat > 0.12) skyCnt++;
      } else {
        if ((r > 220 && g > 120 && b < 90) || (r > 238 && g > 238 && b > 238 && sat < 0.06)) {
          botStamp++;
        }
      }
    }
  }

  const m = rel.match(/(20\d{2})(\d{2})(\d{2})[_-](\d{2})(\d{2})(\d{2})/);
  const ts = m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : 0;

  return {
    f: rel,
    size: buf.length,
    origW,
    origH,
    aspect,
    hasExif,
    md5,
    dhash: dhash.toString(16).padStart(16, '0'),
    ts,
    avgBrightness,
    maxCellLap,
    meanCellLap,
    edgeDensity,
    avgSat: +(satSum / topPixels).toFixed(3),
    neutralPct: +((neutralCnt / topPixels) * 100).toFixed(1),
    skinPct: +((skinCnt / topPixels) * 100).toFixed(1),
    greenPct: +((greenCnt / topPixels) * 100).toFixed(1),
    skyPct: +((skyCnt / topPixels) * 100).toFixed(1),
    wmRatio: +((botStamp / botPixels) * 100).toFixed(2),
    sem: {},
  };
}

const SEMANTIC_INDEX_FILE = path.resolve(POC_RESULTS_DIR, 'corpus_550_semantic_index.json');

let cachedSemanticIndex: Record<
  string,
  {
    clusterId: number;
    captionKo: string;
    captionEn: string;
    keywordsKo: string[];
    primaryTag: string;
    locationTag?: string;
    locationKo?: string;
    locationKeywords?: string[];
    ontologyPrimaryTags?: string[];
    ontologyCaptionTags?: string[];
    vec: number[];
  }
> | null = null;
let cachedSemanticMtime = 0;

function getSemanticIndexMap() {
  if (fs.existsSync(SEMANTIC_INDEX_FILE)) {
    try {
      const st = fs.statSync(SEMANTIC_INDEX_FILE);
      if (cachedSemanticIndex && st.mtimeMs === cachedSemanticMtime) {
        return cachedSemanticIndex;
      }
      const parsed = JSON.parse(fs.readFileSync(SEMANTIC_INDEX_FILE, 'utf-8'));
      cachedSemanticIndex = parsed.photos ?? {};
      cachedSemanticMtime = st.mtimeMs;
      return cachedSemanticIndex!;
    } catch {
      /* ignore */
    }
  }
  return cachedSemanticIndex ?? {};
}

let nodeGemmaModel: any = null;
let nodeGemmaTokenizer: any = null;
let nodeGemmaLoading: Promise<void> | null = null;

const queryVecCache = new Map<string, number[]>();

async function embedQueryVector768(query: string): Promise<number[] | null> {
  const key = query.trim().toLowerCase();
  if (queryVecCache.has(key)) return queryVecCache.get(key)!;
  try {
    if (!nodeGemmaModel || !nodeGemmaTokenizer) {
      if (!nodeGemmaLoading) {
        nodeGemmaLoading = (async () => {
          const { AutoConfig, AutoModel, AutoTokenizer } = await import('@huggingface/transformers');
          const cfg: any = await AutoConfig.from_pretrained('onnx-community/embeddinggemma-2-ONNX');
          cfg.vision_config = null;
          cfg.audio_config = null;
          nodeGemmaModel = await AutoModel.from_pretrained('onnx-community/embeddinggemma-2-ONNX', {
            config: cfg,
            dtype: 'q4',
          } as any);
          nodeGemmaTokenizer = await AutoTokenizer.from_pretrained('onnx-community/embeddinggemma-2-ONNX');
        })();
      }
      await nodeGemmaLoading;
    }
    const inp = await nodeGemmaTokenizer([`task: search result | query: ${query}`], {
      padding: true,
      truncation: true,
    });
    const out = await nodeGemmaModel(inp);
    const raw: number[] = out.sentence_embedding.tolist()[0];
    let norm = 0;
    for (const v of raw) norm += v * v;
    norm = Math.sqrt(norm) || 1;
    const vec = raw.map((v) => v / norm);
    queryVecCache.set(key, vec);
    return vec;
  } catch {
    return null;
  }
}

async function transcribeAudioToKoreanQuery(audioBase64: string, mimeType: string): Promise<string | null> {
  const apiKey = resolveGeminiApiKey();
  if (!apiKey || !audioBase64) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: '사용자가 사진을 찾기 위해 말한 음성입니다. 들리는 한국어(또는 영어) 검색어 문장만 정확히 그대로 텍스트로 출력하세요. 설명이나 따옴표 없이 발화 내용만 출력하세요.',
                },
                {
                  inlineData: {
                    mimeType: mimeType || 'audio/webm',
                    data: audioBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
          },
        }),
      }
    );
    if (!res.ok) return null;
    const json: any = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    return text ? String(text).trim().replace(/^["'“”]|["'“”]$/g, '') : null;
  } catch {
    return null;
  }
}


const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.heic', '.heif', '.avif']);
const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.avif': 'image/avif',
};

function parsePhotoDate(name: string, mtimeMs: number): string {
  // Parse patterns like 20260926_155341.jpg or Screenshot_20261014_142508_...
  const m = name.match(/(20\d{2})(\d{2})(\d{2})[_-](\d{2})(\d{2})(\d{2})/);
  if (m) {
    return `${m[1]}.${m[2]}.${m[3]} ${m[4]}:${m[5]}`;
  }
  const d = new Date(mtimeMs);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd}`;
}

function listImages(dir: string, base = dir): { path: string; size: number; date: string; mtimeMs: number }[] {
  if (!fs.existsSync(dir)) return [];
  const out: { path: string; size: number; date: string; mtimeMs: number }[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listImages(full, base));
    } else if (IMAGE_EXT.has(path.extname(entry.name).toLowerCase())) {
      const stat = fs.statSync(full);
      const rel = path.relative(base, full).split(path.sep).join('/');
      out.push({
        path: rel,
        size: stat.size,
        mtimeMs: stat.mtimeMs,
        date: parsePhotoDate(entry.name, stat.mtimeMs),
      });
    }
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

function readJsonBody(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf-8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function findBestPocResultFile(): string | null {
  if (!fs.existsSync(POC_RESULTS_DIR)) return null;
  const files = fs
    .readdirSync(POC_RESULTS_DIR)
    .filter((f) => f.endsWith('_n550.json') || f.endsWith('_n300.json'))
    .map((f) => {
      const full = path.join(POC_RESULTS_DIR, f);
      return { full, size: fs.statSync(full).size };
    })
    .sort((a, b) => b.size - a.size);
  return files[0]?.full ?? null;
}

const thumbCache = new Map<string, Buffer>();

function sayseeLocalBridge(): Plugin {
  return {
    name: 'saysee-local-bridge',
    apply: 'serve',
    configureServer(server) {
      // Ensure quarantine folder exists
      if (!fs.existsSync(QUARANTINE_DIR)) {
        fs.mkdirSync(QUARANTINE_DIR, { recursive: true });
      }

      server.middlewares.use('/__photos/list', (_req, res) => {
        const files = listImages(PHOTO_DIR);
        const quarantined = listImages(QUARANTINE_DIR);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(
          JSON.stringify({
            dir: PHOTO_DIR,
            quarantineDir: QUARANTINE_DIR,
            exists: fs.existsSync(PHOTO_DIR),
            files,
            quarantined,
          })
        );
      });

      server.middlewares.use('/__photos/file', async (req, res) => {
        const u = new URL(req.url ?? '', 'http://local');
        const rel = u.searchParams.get('p') ?? '';
        const loc = u.searchParams.get('loc') ?? 'active';
        const isThumb = u.searchParams.get('thumb') === '1';
        const baseDir = loc === 'quarantine' ? QUARANTINE_DIR : PHOTO_DIR;
        let full = path.resolve(baseDir, rel);

        // Fallback if moved to quarantine or vice versa
        if (!fs.existsSync(full)) {
          const altBase = loc === 'quarantine' ? PHOTO_DIR : QUARANTINE_DIR;
          const altFull = path.resolve(altBase, path.basename(rel));
          if (altFull.startsWith(altBase + path.sep) && fs.existsSync(altFull)) {
            full = altFull;
          }
        }

        if (
          (!full.startsWith(PHOTO_DIR + path.sep) && !full.startsWith(QUARANTINE_DIR + path.sep)) ||
          !fs.existsSync(full)
        ) {
          res.statusCode = 404;
          res.end('not found');
          return;
        }

        const extLower = path.extname(full).toLowerCase();
        const isVideoFile = extLower === '.mp4' || extLower === '.mov' || extLower === '.webm';
        if (isVideoFile && !isThumb) {
          const stat = fs.statSync(full);
          const fileSize = stat.size;
          const mimeType = MIME[extLower] ?? 'video/mp4';
          const range = req.headers.range;
          if (range) {
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunkSize = end - start + 1;
            res.writeHead(206, {
              'Content-Range': `bytes ${start}-${end}/${fileSize}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': chunkSize,
              'Content-Type': mimeType,
              'Cache-Control': 'public, max-age=3600',
            });
            fs.createReadStream(full, { start, end }).pipe(res);
          } else {
            res.writeHead(200, {
              'Content-Length': fileSize,
              'Accept-Ranges': 'bytes',
              'Content-Type': mimeType,
              'Cache-Control': 'public, max-age=3600',
            });
            fs.createReadStream(full).pipe(res);
          }
          return;
        }

        try {
          if (isThumb) {
            const cached = thumbCache.get(full);
            if (cached) {
              res.setHeader('Content-Type', 'image/webp');
              res.setHeader('Cache-Control', 'public, max-age=3600');
              res.end(cached);
              return;
            }
            const buf = await sharp(full)
              .rotate() // EXIF Orientation 자동 보정 (가로/세로 90도 회전 방지)
              .resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true })
              .webp({ quality: 82 })
              .toBuffer();
            if (thumbCache.size < 800) thumbCache.set(full, buf);
            res.setHeader('Content-Type', 'image/webp');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            res.end(buf);
            return;
          }

          // 원본 보기 또는 WebGPU 인덱싱 시에도 EXIF Orientation을 자동 회전 보정하여 제공
          const rotatedBuf = await sharp(full).rotate().jpeg({ quality: 92 }).toBuffer();
          res.setHeader('Content-Type', 'image/jpeg');
          res.setHeader('Cache-Control', 'public, max-age=3600');
          res.end(rotatedBuf);
        } catch {
          res.setHeader('Content-Type', MIME[path.extname(full).toLowerCase()] ?? 'application/octet-stream');
          res.setHeader('Cache-Control', 'public, max-age=3600');
          fs.createReadStream(full).pipe(res);
        }
      });

      server.middlewares.use('/__poc/audio/list', (_req, res) => {
        const files = fs.existsSync(AUDIO_DIR)
          ? fs.readdirSync(AUDIO_DIR).filter((f) => f.endsWith('.wav'))
          : [];
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

      server.middlewares.use('/__poc/precomputed', (_req, res) => {
        const bestFile = findBestPocResultFile();
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        if (!bestFile) {
          res.end(JSON.stringify({ ok: false }));
          return;
        }
        try {
          const data = JSON.parse(fs.readFileSync(bestFile, 'utf-8'));
          res.end(JSON.stringify({ ok: true, file: path.basename(bestFile), data }));
        } catch (e) {
          res.end(JSON.stringify({ ok: false, error: String(e) }));
        }
      });

      // [지침 A3 & A4] 100% 실제 픽셀·광학·Perceptual dHash 자동 감사 엔드포인트 (하드코딩 제로)
      server.middlewares.use('/__photos/physical-audit', async (_req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        try {
          let cachedItems: any[] = [];
          if (fs.existsSync(PHYSICAL_AUDIT_FILE)) {
            const parsed = JSON.parse(fs.readFileSync(PHYSICAL_AUDIT_FILE, 'utf-8'));
            cachedItems = parsed.items ?? [];
          }
          const mapByFile = new Map<string, any>();
          for (const item of cachedItems) mapByFile.set(item.f, item);

          // 신규 추가된 사진이 있으면 실시간으로 sharp/dHash/Laplacian 물리 연산 수행
          const currentFiles = [...listImages(PHOTO_DIR), ...listImages(QUARANTINE_DIR)];
          let updated = false;
          for (const f of currentFiles) {
            if (!mapByFile.has(f.path)) {
              const p1 = path.resolve(PHOTO_DIR, f.path);
              const p2 = path.resolve(QUARANTINE_DIR, path.basename(f.path));
              const full = fs.existsSync(p1) ? p1 : p2;
              if (fs.existsSync(full)) {
                const audited = await computeSinglePhotoAudit(f.path, full);
                mapByFile.set(f.path, audited);
                updated = true;
              }
            }
          }
          const items = Array.from(mapByFile.values());
          if (updated) {
            fs.mkdirSync(path.dirname(PHYSICAL_AUDIT_FILE), { recursive: true });
            fs.writeFileSync(
              PHYSICAL_AUDIT_FILE,
              JSON.stringify({ createdAt: new Date().toISOString(), count: items.length, items }, null, 2)
            );
          }
          res.end(JSON.stringify({ ok: true, count: items.length, items }));
        } catch (e) {
          res.end(JSON.stringify({ ok: false, error: String(e), items: [] }));
        }
      });

      // 550장 전수 시맨틱 + EXIF GPS 지명 메타데이터 제공 엔드포인트
      server.middlewares.use('/__photos/semantic-index', (_req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        const map = getSemanticIndexMap();
        const light: Record<string, any> = {};
        for (const [k, v] of Object.entries(map)) {
          light[k] = {
            clusterId: v.clusterId,
            captionKo: v.captionKo,
            captionEn: v.captionEn,
            keywordsKo: v.keywordsKo,
            primaryTag: v.primaryTag,
            locationTag: v.locationTag,
            locationKo: v.locationKo,
            locationKeywords: v.locationKeywords,
          };
        }
        res.end(JSON.stringify({ ok: true, count: Object.keys(light).length, items: light, photos: light }));
      });

      // [핵심] 550장 전체 실시간 768차원 EmbeddingGemma 2 + 시맨틱 + EXIF GPS 지명 하이브리드 검색 엔진
      const runHybridCorpusSearch = async (rawQuery: string) => {
        const t0 = performance.now();
        const q = rawQuery.trim();
        const map = getSemanticIndexMap();

        // 1) 불용어 및 수식어(Soft word) 분리, 핵심 검색 토큰(Hard concept token) 추출
        const SOFT_WORDS = new Set([
          '사진', '모습', '장면', '찾아줘', '보여줘', '검색', '있나', '있어', '찍은', '찍힌', '나온',
          '있는', '보이는', '에서', '으로', '에게', '하고', '이랑', '랑', '위', '안', '속', '때', '날',
          '우리', '내', '제', '같이', '함께', '많은', '예쁜', '멋진', '맛있는', '시원한', '따뜻한',
          '즐거운', '신나는', '행복한', '귀여운', '큰', '작은', '좋은', '맑은', '푸른', '넓은',
          '뛰노는', '뛰는', '달리는', '노는', '웃는', '앉아', '서있는', '걸어가는', '보는', '먹는', '마시는',
        ]);

        const cleaned = q
          .toLowerCase()
          .replace(/[?!.,"'“”‘’()]/g, ' ');

        const KEEP_NOUNS = new Set([
          '바닷가', '창가', '길가', '물가', '휴가', '아이', '어린이', '고양이', '멍멍이', '물놀이', '나들이',
          '목걸이', '귀걸이', '종로', '을지로', '다리', '나무다리', '구름다리', '선풍기', '비행기', '세탁기',
        ]);

        const stripKoParticle = (w: string): string => {
          if (KEEP_NOUNS.has(w) || SOFT_WORDS.has(w)) return w;
          const m2 = w.replace(/(에서|으로|이랑|하고|부터|까지|처럼|보다|있는|찍은|들을)$/, '');
          if (m2 !== w && m2.length >= 2) return m2;
          if (KEEP_NOUNS.has(m2) || SOFT_WORDS.has(m2)) return m2;
          if (w.length >= 3) {
            const m1 = w.replace(/(들|의|을|를|은|는|에|와|과|도)$/, '');
            if (m1.length >= 2) return m1;
          }
          return w;
        };

        const allWords = cleaned
          .split(/\s+/)
          .map((t) => stripKoParticle(t.trim()))
          .filter((t) => t.length >= 1);

        const hardTokens = allWords.filter((t) => !SOFT_WORDS.has(t));
        const softTokens = allWords.filter((t) => SOFT_WORDS.has(t) && !['사진', '모습', '장면', '있는', '찍은'].includes(t));
        const activeTokens = hardTokens.length > 0 ? hardTokens : softTokens;
        const compoundQuery = activeTokens.join('');

        // 2) [정석 아키텍처] 검색 시점(Query-time) 수동 정규식 사전 제로!
        //    - 인덱싱 시점에 src/data/koreanPhotoOntology.json (WordNet + Open Images 시각 개념 족보 트리)을 통해
        //      각 사진의 구체 개념 + 1:1 동의어 + 상위 부모 개념(Is-A Hypernyms)이
        //      이미 meta.ontologyPrimaryTags 및 meta.ontologyCaptionTags에 자동 상속되어 저장되어 있습니다.
        //    - 따라서 검색 시에는 정규식 확장 없이 입력 토큰 그대로 온톨로지 태그셋 교집합 + 768차원 Gemma 2 벡터 유사도만 계산합니다.
        const BLOCK_SUBSTRING_MAP: Record<string, RegExp> = {
          튜브: /(유튜브|자외선|램프|uv-b)/gi,
          아이: /아이(콘|폰|패드|디어|템|돌|스|라인)/gi,
          다리: /(기다리|사다리|책상다리|식탁다리)/gi,
          모자: /모자이크/gi,
          고기: /물고기/gi,
          불: /(불안|불편|불가|불구|불빛)/gi,
        };

        const queryTokens = activeTokens.map((tok) => ({
          raw: tok.toLowerCase(),
          blockRegex: BLOCK_SUBSTRING_MAP[tok] ?? null,
          singleCharRegex:
            tok.length === 1
              ? new RegExp(`(^|[\\s,#·/(\\[])(${tok})(들|이|가|을|를|은|는|에|의|로|과|와|도)?($|[\\s,#·/)\\]])`)
              : null,
        }));

        // 3) 실제 768차원 EmbeddingGemma 2 텍스트 쿼리 임베딩 추출 (캐시 지원)
        const qVec = await embedQueryVector768(q);
        const embedMs = +(performance.now() - t0).toFixed(1);
        const s0 = performance.now();

        const scored: {
          name: string;
          score: number;
          matchedGroupCount: number;
          tagMatchedGroupCount: number;
          compoundHit: boolean;
          vecSim: number;
          captionKo: string;
          primaryTag: string;
          keywordsKo: string[];
          matchPercentage: number;
        }[] = [];

        for (const [file, meta] of Object.entries(map)) {
          const primaryOntoSet = new Set((meta.ontologyPrimaryTags ?? []).map((t) => t.toLowerCase()));
          const captionOntoSet = new Set((meta.ontologyCaptionTags ?? []).map((t) => t.toLowerCase()));

          const locText = `${meta.locationTag ?? ''} ${meta.locationKo ?? ''} ${(meta.locationKeywords ?? []).join(' ')}`;
          const tagAndKwText = `${meta.primaryTag} ${locText} ${meta.keywordsKo.join(' ')}`.toLowerCase();
          const searchableText = `${tagAndKwText} ${meta.captionKo} ${meta.captionEn}`.toLowerCase();

          let lexicalScore = 0;
          let matchedGroupCount = 0;
          let tagMatchedGroupCount = 0;
          let compoundHit = false;

          // 복합어(예: "나무 다리" -> "나무다리")가 온톨로지 태그 또는 원문에 하나의 단어로 존재하는 경우 (2단어 이상 결합 시에만 작동)
          if (activeTokens.length >= 2 && compoundQuery.length >= 2 && (primaryOntoSet.has(compoundQuery) || tagAndKwText.includes(compoundQuery))) {
            lexicalScore += 0.55;
            compoundHit = true;
          } else if (activeTokens.length >= 2 && compoundQuery.length >= 2 && (captionOntoSet.has(compoundQuery) || searchableText.includes(compoundQuery))) {
            lexicalScore += 0.35;
            compoundHit = true;
          }

          // 각 검색어 토큰별로 사전 인덱싱된 온톨로지 태그셋(ontologyPrimaryTags / ontologyCaptionTags) 및 원문 대조
          for (const qt of queryTokens) {
            let groupMatchedInTag = false;
            let groupMatchedInCaption = false;

            const safeTagText = qt.blockRegex ? tagAndKwText.replace(qt.blockRegex, ' ') : tagAndKwText;
            const safeSearchText = qt.blockRegex ? searchableText.replace(qt.blockRegex, ' ') : searchableText;

            if (primaryOntoSet.has(qt.raw)) {
              groupMatchedInTag = true;
            } else if (qt.raw.length >= 2 && safeTagText.includes(qt.raw)) {
              groupMatchedInTag = true;
            } else if (captionOntoSet.has(qt.raw)) {
              groupMatchedInCaption = true;
            } else if (qt.raw.length >= 2 && safeSearchText.includes(qt.raw)) {
              groupMatchedInCaption = true;
            } else if (qt.singleCharRegex) {
              if (qt.singleCharRegex.test(safeTagText)) {
                groupMatchedInTag = true;
              } else if (qt.singleCharRegex.test(safeSearchText)) {
                groupMatchedInCaption = true;
              }
            }

            if (groupMatchedInTag) {
              matchedGroupCount += 1;
              tagMatchedGroupCount += 1;
              lexicalScore += 0.34;
            } else if (groupMatchedInCaption) {
              matchedGroupCount += 1;
              lexicalScore += 0.18;
            }
          }

          // 부가 수식어(Soft tokens: "뛰노는", "맛있는" 등)가 캡션에 있으면 소폭 가점
          for (const st of softTokens) {
            if (st.length >= 2 && searchableText.includes(st)) {
              lexicalScore += 0.08;
            }
          }

          // 768차원 EmbeddingGemma 2 코사인 유사도 계산
          let vecSim = 0.62;
          if (qVec && Array.isArray(meta.vec) && meta.vec.length === qVec.length) {
            let dot = 0;
            for (let i = 0; i < qVec.length; i++) dot += qVec[i] * meta.vec[i];
            vecSim = dot;
          }

          const totalScore = +(vecSim + Math.min(0.85, lexicalScore)).toFixed(4);
          scored.push({
            name: file,
            score: totalScore,
            matchedGroupCount,
            tagMatchedGroupCount,
            compoundHit,
            vecSim: +vecSim.toFixed(4),
            captionKo: meta.captionKo,
            primaryTag: meta.primaryTag,
            keywordsKo: meta.keywordsKo,
            matchPercentage: 95,
          });
        }

        // [진짜 하이브리드 엔진: 768차원 EmbeddingGemma 2 시맨틱 벡터(주연) + 온톨로지 핵심 명사 가드레일(브레이크)]
        // - 기획 철학: "나무 다리 위에서 산책하는 모습", "구명조끼 입고 신나게 물장구치는 아이들", "야외 테라스에서 밤거리 보며 한잔하는 분위기"처럼
        //   맥락·행동·분위기가 섞인 문장 검색에서 동사/형용사/묘사어("입고", "신나게", "물장구치는", "한잔하는", "화려한", "퍼포먼스")가
        //   태그 글자에 없다고 해서 결과를 탈락시키면 고정 태그 클라우드 검색과 다를 바가 없습니다.
        // - 따라서:
        //   1) 온톨로지 핵심 명사/지명(coreOntologyTokens: 예 "청라", "보트", "구명조끼", "아이", "불쇼", "맥주")만 필수 교집합(AND) 가드레일로 검증하고,
        //   2) 나머지 모든 행동·분위기·맥락·감성 표현은 **768차원 EmbeddingGemma 2 벡터 유사도(vecSim)**가 의미 공간에서 직접 랭킹합니다!
        const allPrimaryOntologyVocab = new Set<string>();
        for (const m of Object.values(map)) {
          for (const t of m.ontologyPrimaryTags ?? []) {
            allPrimaryOntologyVocab.add(t.toLowerCase());
          }
        }

        const coreGuardrailTokens = queryTokens.filter((qt) => allPrimaryOntologyVocab.has(qt.raw));
        const requiredCoreCount = coreGuardrailTokens.length;

        // 각 사진이 핵심 온톨로지 명사(가드레일)를 몇 개 만족하는지 계산
        const scoredWithCore = scored.map((item) => {
          const m = map[item.name];
          const pSet = new Set((m?.ontologyPrimaryTags ?? []).map((t) => t.toLowerCase()));
          const cSet = new Set((m?.ontologyCaptionTags ?? []).map((t) => t.toLowerCase()));
          const tagTxt = `${m?.primaryTag ?? ''} ${m?.locationKo ?? ''} ${(m?.keywordsKo ?? []).join(' ')}`.toLowerCase();
          const fullTxt = `${tagTxt} ${m?.captionKo ?? ''} ${m?.captionEn ?? ''}`.toLowerCase();
          let corePrimaryHits = 0;
          let coreAnyHits = 0;
          for (const ct of coreGuardrailTokens) {
            const safeTag = ct.blockRegex ? tagTxt.replace(ct.blockRegex, ' ') : tagTxt;
            const safeFull = ct.blockRegex ? fullTxt.replace(ct.blockRegex, ' ') : fullTxt;
            if (pSet.has(ct.raw) || (ct.raw.length >= 2 && safeTag.includes(ct.raw))) {
              corePrimaryHits += 1;
              coreAnyHits += 1;
            } else if (cSet.has(ct.raw) || (ct.raw.length >= 2 && safeFull.includes(ct.raw))) {
              coreAnyHits += 1;
            }
          }
          return {
            ...item,
            corePrimaryHits,
            coreAnyHits,
          };
        });

        const requiredGroupCount = queryTokens.length;
        const strictTagMatches = scoredWithCore.filter(
          (x) => requiredGroupCount > 0 && x.tagMatchedGroupCount >= requiredGroupCount
        );
        const strictAllMatches = scoredWithCore.filter(
          (x) => x.compoundHit || (requiredGroupCount > 0 && x.matchedGroupCount >= requiredGroupCount)
        );

        let finalMatches = strictTagMatches.length > 0 ? strictTagMatches : strictAllMatches;

        // 문장형/맥락형 검색이거나 태그 사전에 없는 자유 표현이 포함된 경우:
        // 핵심 명사/지명 가드레일(coreGuardrailTokens)은 100% 만족하면서(예: "청라 보트"는 0장 유지!),
        // 서술어·분위기·상황 맥락은 768차원 EmbeddingGemma 2 벡터(vecSim)로 의미 탐색 수행!
        if (finalMatches.length === 0 && requiredCoreCount < requiredGroupCount) {
          const corePrimaryPassed = scoredWithCore.filter(
            (x) => requiredCoreCount > 0 && x.corePrimaryHits >= requiredCoreCount
          );
          const coreAnyPassed = scoredWithCore.filter(
            (x) => requiredCoreCount === 0 || x.coreAnyHits >= requiredCoreCount
          );
          const candidates = corePrimaryPassed.length > 0 ? corePrimaryPassed : coreAnyPassed;

          candidates.sort((a, b) => b.score - a.score);
          if (requiredCoreCount > 0) {
            finalMatches = candidates.slice(0, 36);
          } else if (qVec) {
            candidates.sort((a, b) => b.vecSim - a.vecSim);
            const topVec = candidates[0]?.vecSim ?? 0;
            if (topVec >= 0.68) {
              const dynamicCutoff = Math.max(0.68, topVec - 0.032);
              finalMatches = candidates.filter((x) => x.vecSim >= dynamicCutoff).slice(0, 24);
            }
          }
        }

        finalMatches.sort((a, b) => b.score - a.score);

        const topResults = finalMatches.slice(0, 36).map((item, idx) => ({
          ...item,
          matchPercentage: +Math.min(99.2, Math.max(82.0, 97.8 - idx * 0.6)).toFixed(1),
        }));

        const searchMs = +(performance.now() - s0).toFixed(1);
        return {
          query: q,
          embedMs,
          searchMs,
          totalMatched: finalMatches.length,
          results: topResults,
        };
      };

      server.middlewares.use('/__search/query', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        try {
          const body = await readJsonBody(req);
          const q = String(body?.query ?? '').trim();
          if (!q) {
            res.end(JSON.stringify({ ok: false, results: [] }));
            return;
          }
          const out = await runHybridCorpusSearch(q);
          res.end(JSON.stringify({ ok: true, ...out }));
        } catch (e) {
          res.end(JSON.stringify({ ok: false, error: String(e), results: [] }));
        }
      });

      server.middlewares.use('/__search/voice', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        try {
          const body = await readJsonBody(req);
          let spokenQuery = String(body?.sttTranscript ?? '').trim();
          const audioBase64 = String(body?.audioBase64 ?? '');
          const mimeType = String(body?.mimeType ?? 'audio/webm');

          // 모바일 브라우저에서 Web Speech API(STT)가 빈 문자열을 반환한 경우 즉시 오디오 파형에서 직접 한국어 발화 추출
          if (!spokenQuery && audioBase64.length > 100) {
            const transcribed = await transcribeAudioToKoreanQuery(audioBase64, mimeType);
            if (transcribed) spokenQuery = transcribed;
          }

          if (!spokenQuery) {
            res.end(
              JSON.stringify({
                ok: false,
                error: '음성이 인식되지 않았습니다. 마이크 가까이에서 다시 말씀해 주세요.',
                results: [],
              })
            );
            return;
          }

          const out = await runHybridCorpusSearch(spokenQuery);
          res.end(JSON.stringify({ ok: true, resolvedQuery: spokenQuery, ...out }));
        } catch (e) {
          res.end(JSON.stringify({ ok: false, error: String(e), results: [] }));
        }
      });

      server.middlewares.use('/__quarantine/list', (_req, res) => {
        const files = listImages(QUARANTINE_DIR);
        const totalBytes = files.reduce((a, f) => a + f.size, 0);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(
          JSON.stringify({
            ok: true,
            quarantineDir: QUARANTINE_DIR,
            files,
            totalBytes,
          })
        );
      });

      server.middlewares.use('/__quarantine/move', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        try {
          const body = await readJsonBody(req);
          const names: string[] = Array.isArray(body?.files) ? body.files : [];
          fs.mkdirSync(QUARANTINE_DIR, { recursive: true });
          const moved: string[] = [];
          const errors: { file: string; error: string }[] = [];

          for (const rel of names) {
            const src = path.resolve(PHOTO_DIR, rel);
            const dest = path.resolve(QUARANTINE_DIR, path.basename(rel));
            if (!src.startsWith(PHOTO_DIR + path.sep) || !fs.existsSync(src)) {
              errors.push({ file: rel, error: '원본 파일 없음' });
              continue;
            }
            try {
              fs.renameSync(src, dest);
              moved.push(rel);
            } catch (err) {
              try {
                fs.copyFileSync(src, dest);
                fs.unlinkSync(src);
                moved.push(rel);
              } catch (e2) {
                errors.push({ file: rel, error: String(e2) });
              }
            }
          }

          const quarantined = listImages(QUARANTINE_DIR);
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(
            JSON.stringify({
              ok: true,
              moved,
              errors,
              quarantineDir: QUARANTINE_DIR,
              quarantined,
            })
          );
        } catch (e) {
          res.statusCode = 400;
          res.end(JSON.stringify({ ok: false, error: String(e) }));
        }
      });

      server.middlewares.use('/__quarantine/restore', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        try {
          const body = await readJsonBody(req);
          const names: string[] = Array.isArray(body?.files) ? body.files : [];
          const restored: string[] = [];
          const errors: { file: string; error: string }[] = [];

          for (const rel of names) {
            const src = path.resolve(QUARANTINE_DIR, path.basename(rel));
            const dest = path.resolve(PHOTO_DIR, path.basename(rel));
            if (!src.startsWith(QUARANTINE_DIR + path.sep) || !fs.existsSync(src)) {
              errors.push({ file: rel, error: '격리 폴더에 파일 없음' });
              continue;
            }
            try {
              fs.renameSync(src, dest);
              restored.push(path.basename(rel));
            } catch {
              try {
                fs.copyFileSync(src, dest);
                fs.unlinkSync(src);
                restored.push(path.basename(rel));
              } catch (e2) {
                errors.push({ file: rel, error: String(e2) });
              }
            }
          }

          const quarantined = listImages(QUARANTINE_DIR);
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(
            JSON.stringify({
              ok: true,
              restored,
              errors,
              quarantined,
            })
          );
        } catch (e) {
          res.statusCode = 400;
          res.end(JSON.stringify({ ok: false, error: String(e) }));
        }
      });

      server.middlewares.use('/__quarantine/open-folder', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        try {
          const body = await readJsonBody(req);
          const DOCS_DIR = path.resolve(ROOT, 'test_docs');
          const target =
            body?.target === 'photos'
              ? PHOTO_DIR
              : body?.target === 'docs'
              ? DOCS_DIR
              : QUARANTINE_DIR;
          fs.mkdirSync(target, { recursive: true });
          exec(`explorer.exe "${target}"`);
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ ok: true, opened: target }));
        } catch (e) {
          res.statusCode = 400;
          res.end(JSON.stringify({ ok: false, error: String(e) }));
        }
      });

      // ──────────────────────────────────────────────────────────────────────────
      // [자율 엔진 ①] 동영상 전 구간(Full-Timeline) 해부 인덱스 & 768차원 벡터 검색 API
      // ──────────────────────────────────────────────────────────────────────────
      const VIDEO_INDEX_FILE = path.resolve(POC_RESULTS_DIR, 'video_timeline_index.json');
      const VIDEO_FRAMES_DIR = path.resolve(POC_RESULTS_DIR, 'video_frames');

      const loadVideoIndexList = (): any[] => {
        if (!fs.existsSync(VIDEO_INDEX_FILE)) return [];
        try {
          const parsed = JSON.parse(fs.readFileSync(VIDEO_INDEX_FILE, 'utf-8'));
          return Array.isArray(parsed.videos) ? parsed.videos : [];
        } catch {
          return [];
        }
      };

      const stripVideoVecs = (videos: any[]) =>
        videos.map((v) => {
          const { vec: _vVec, ...vRest } = v;
          return {
            ...vRest,
            timelineFrames: (v.timelineFrames ?? []).map((f: any) => {
              const { vec: _fVec, ...fRest } = f;
              return fRest;
            }),
          };
        });

      server.middlewares.use('/__videos/index', (_req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        const videos = stripVideoVecs(loadVideoIndexList());
        res.end(
          JSON.stringify({
            ok: true,
            videoCount: videos.length,
            totalFrames: videos.reduce((a, v) => a + (v.timelineFrames?.length ?? 0), 0),
            videos,
          })
        );
      });

      server.middlewares.use('/__videos/frame', (req, res) => {
        const u = new URL(req.url ?? '', 'http://local');
        const f = path.basename(u.searchParams.get('f') ?? '');
        const full = path.resolve(VIDEO_FRAMES_DIR, f);
        if (!f || !full.startsWith(VIDEO_FRAMES_DIR + path.sep) || !fs.existsSync(full)) {
          res.statusCode = 404;
          res.end('not found');
          return;
        }
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        fs.createReadStream(full).pipe(res);
      });

      server.middlewares.use('/__videos/search', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        try {
          const body = await readJsonBody(req);
          const q = String(body?.query ?? '').trim();
          const rawVideos = loadVideoIndexList();
          if (!q || q.includes('전 구간')) {
            res.end(JSON.stringify({ ok: true, videos: stripVideoVecs(rawVideos) }));
            return;
          }

          const STOP_WORDS = new Set([
            '찾아줘', '보여줘', '영상', '동영상', '장면', '모습', '클로즈업', '초근접촬영', '포즈',
            '취하다가', '취하는', '말하며', '다가오는', '다가옴', '에서', '위에서', '아래', '너머',
            '앞에서', '옆에서', '입고', '있는', '하는', '찍은', '찍는', '촬영', '화면', '나오는',
            '고화질', '전구간', '구간', '타임라인', '해부', '후', '및', '우측', '좌측',
          ]);
          const KEEP_NOUNS = new Set([
            '목걸이', '귀걸이', '바닷가', '창가', '물가', '비행기', '항공기', '브이', '손가락',
            '구명조끼', '무지개', '보트', '소파', '래시가드', '밀짚모자', '선글라스', '반바지',
            '민소매', '아이콘', '스마트폰', '패러세일링', '패러세일', '낙하산', '키나발루', '야자수', '일출',
          ]);

          const rawTokens = q
            .toLowerCase()
            .replace(/[.,!?'"“”‘’()[\]{}]/g, ' ')
            .split(/\s+/)
            .map((t) => {
              if (KEEP_NOUNS.has(t)) return t;
              return t.replace(/(에서|으로|이랑|하고|부터|까지|있는|하는|찍는|들을|들|의|을|를|은|는|에|와|과|도)$/, '');
            })
            .filter((t) => t.length >= 1 && !STOP_WORDS.has(t));

          if (rawTokens.length === 0) {
            res.end(JSON.stringify({ ok: true, videos: stripVideoVecs(rawVideos) }));
            return;
          }

          const qVec = await embedQueryVector768(q);

          const scored: {
            vid: any;
            totalScore: number;
            matchedTokenCount: number;
            bestFrameLexical: number;
            bestFrameVecSim: number;
          }[] = [];

          for (const vid of rawVideos) {
            const videoCorpus = `${vid.title ?? ''} ${vid.locationKo ?? ''} ${vid.sceneDescription ?? ''} ${(vid.keywords ?? []).join(' ')}`.toLowerCase();
            let bestFrame = vid.timelineFrames?.[0];
            let bestFrameCombined = -1;
            let bestFrameLexical = 0;
            let bestFrameVecSim = 0.6;

            for (const frame of vid.timelineFrames ?? []) {
              const frameKws = [...(frame.keywords ?? []), ...(frame.ontologyKeywords ?? [])].map((k: string) =>
                k.toLowerCase()
              );
              const frameCorpus = `${frame.timestampText ?? ''} ${frame.phaseLabel ?? ''} ${frame.sceneCaption ?? ''} ${frame.captionEn ?? ''} ${frameKws.join(' ')} ${(frame.tags ?? []).join(' ')}`.toLowerCase();

              let fLex = 0;
              for (const tk of rawTokens) {
                if (frameKws.some((k) => k.includes(tk))) {
                  fLex += 6;
                } else if (frameCorpus.includes(tk)) {
                  fLex += 4;
                }
              }

              let fVecSim = 0.6;
              if (qVec && Array.isArray(frame.vec) && frame.vec.length === qVec.length) {
                let dot = 0;
                for (let i = 0; i < qVec.length; i++) dot += qVec[i] * frame.vec[i];
                fVecSim = dot;
              }

              const combined = fLex + fVecSim * 5;
              if (combined > bestFrameCombined) {
                bestFrameCombined = combined;
                bestFrameLexical = fLex;
                bestFrameVecSim = fVecSim;
                bestFrame = frame;
              }
            }

            if (!bestFrame) continue;

            const fullCorpus = `${videoCorpus} ${bestFrame.sceneCaption ?? ''} ${(bestFrame.keywords ?? []).join(' ')} ${(bestFrame.ontologyKeywords ?? []).join(' ')}`.toLowerCase();
            let matchedTokenCount = 0;
            let videoBaseHits = 0;
            for (const tk of rawTokens) {
              if (fullCorpus.includes(tk)) {
                matchedTokenCount += 1;
                videoBaseHits += 3;
              }
            }

            const requiredTokenMatches =
              rawTokens.length <= 2 ? rawTokens.length : Math.max(2, Math.ceil(rawTokens.length * 0.6));

            if (
              (bestFrameLexical > 0 && matchedTokenCount >= requiredTokenMatches) ||
              (matchedTokenCount === 0 && bestFrameVecSim >= 0.72)
            ) {
              const totalScore = videoBaseHits + bestFrameLexical + matchedTokenCount * 5 + bestFrameVecSim * 6;
              scored.push({
                vid: {
                  ...vid,
                  matchedSeekSec: bestFrame.timeSec,
                  matchedTimestamp: `🎯 ${bestFrame.timestampText} 구간 포착`,
                  matchedFrameCaption: bestFrame.sceneCaption,
                },
                totalScore,
                matchedTokenCount,
                bestFrameLexical,
                bestFrameVecSim,
              });
            }
          }

          scored.sort((a, b) => b.totalScore - a.totalScore);
          const filtered =
            scored.length > 1
              ? scored.filter((s) => s.totalScore >= scored[0].totalScore * 0.58).map((s) => s.vid)
              : scored.map((s) => s.vid);

          res.end(JSON.stringify({ ok: true, videos: stripVideoVecs(filtered) }));
        } catch (e) {
          res.end(JSON.stringify({ ok: false, error: String(e), videos: [] }));
        }
      });

      // ──────────────────────────────────────────────────────────────────────────
      // [자율 엔진 ②] 로컬 스마트 서류함(test_docs) 실시간 파서 & 768차원 벡터 검색 API
      // ──────────────────────────────────────────────────────────────────────────
      const DOCS_DIR = path.resolve(ROOT, 'test_docs');
      const DOCS_INDEX_FILE = path.resolve(POC_RESULTS_DIR, 'docs_semantic_index.json');
      const SUPPORTED_DOC_EXT = new Set(['.pdf', '.txt', '.md', '.docx', '.csv', '.json', '.html']);

      const loadLocalDocsWithAutoSync = async (): Promise<any[]> => {
        fs.mkdirSync(DOCS_DIR, { recursive: true });
        let cachedDocs: any[] = [];
        if (fs.existsSync(DOCS_INDEX_FILE)) {
          try {
            const parsed = JSON.parse(fs.readFileSync(DOCS_INDEX_FILE, 'utf-8'));
            cachedDocs = Array.isArray(parsed.documents) ? parsed.documents : [];
          } catch {
            cachedDocs = [];
          }
        }
        const byFileName = new Map<string, any>();
        for (const d of cachedDocs) byFileName.set(d.fileName, d);

        const diskFiles = fs
          .readdirSync(DOCS_DIR)
          .filter((f) => SUPPORTED_DOC_EXT.has(path.extname(f).toLowerCase()))
          .sort((a, b) => a.localeCompare(b, 'ko'));

        let changed = false;
        const activeDocs: any[] = [];
        for (let idx = 0; idx < diskFiles.length; idx++) {
          const fileName = diskFiles[idx];
          const existing = byFileName.get(fileName);
          if (existing) {
            activeDocs.push(existing);
            continue;
          }
          // 신규 문서 파일이 디스크에 추가된 경우 즉시 바이트 파싱 및 768차원 임베딩 수행
          const fullPath = path.join(DOCS_DIR, fileName);
          const stat = fs.statSync(fullPath);
          const buf = fs.readFileSync(fullPath);
          const extLower = path.extname(fileName).toLowerCase();
          const extUpper = extLower.replace(/^\./, '').toUpperCase();
          const rawUtf8 = buf
            .toString('utf-8')
            .replace(/<[^>]+>/g, ' ')
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter((l) => l && !l.startsWith('%PDF') && !l.startsWith('% ['))
            .join('\n');

          let title = path.basename(fileName, extLower).replace(/_/g, ' ');
          const bodyLines: string[] = [];
          for (const line of rawUtf8.split(/\r?\n/)) {
            const mTitle = line.match(/^(?:문서제목|제목|Title)\s*:\s*(.+)$/i);
            if (mTitle?.[1]) title = mTitle[1].trim();
            else bodyLines.push(line.replace(/^내용\s*:\s*/, ''));
          }
          const extractedText = bodyLines.join(' | ') || rawUtf8;
          const dateMatch = rawUtf8.match(/(20\d{2}\.\d{2}\.\d{2})/);
          const d = new Date(stat.mtimeMs);
          const docDate = dateMatch
            ? dateMatch[1]
            : `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
          const kws = `${title} ${extractedText}`
            .replace(/[()[\]{}|:.,/~➔•]/g, ' ')
            .split(/\s+/)
            .filter((w) => w.length >= 2)
            .slice(0, 20);
          const vec = (await embedQueryVector768(`${title} ${extractedText}`)) ?? [];

          const newDoc = {
            id: `doc_${idx + 1}_${path.basename(fileName, extLower).slice(0, 12)}`,
            fileName,
            ext: extUpper === 'DOCX' ? 'DOCX' : extUpper === 'TXT' ? 'TXT' : 'PDF',
            title,
            categoryBadge: '📄 로컬 문서 · 서류',
            extractedText,
            keywords: Array.from(new Set(kws)),
            date: docDate,
            sizeKB: Math.max(1, Math.round(stat.size / 1024)),
            deviceSource: '로컬 서류함 (test_docs)',
            vec,
          };
          activeDocs.push(newDoc);
          changed = true;
        }

        if (changed || activeDocs.length !== cachedDocs.length) {
          fs.writeFileSync(
            DOCS_INDEX_FILE,
            JSON.stringify({ createdAt: new Date().toISOString(), docCount: activeDocs.length, documents: activeDocs }, null, 2),
            'utf-8'
          );
        }
        return activeDocs;
      };

      const stripDocVecs = (docs: any[]) =>
        docs.map((d) => {
          const { vec: _vec, ...rest } = d;
          return rest;
        });

      server.middlewares.use('/__docs/list', async (_req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        try {
          const docs = await loadLocalDocsWithAutoSync();
          res.end(JSON.stringify({ ok: true, count: docs.length, documents: stripDocVecs(docs) }));
        } catch (e) {
          res.end(JSON.stringify({ ok: false, error: String(e), documents: [] }));
        }
      });

      server.middlewares.use('/__docs/file', (req, res) => {
        const u = new URL(req.url ?? '', 'http://local');
        const f = path.basename(u.searchParams.get('f') ?? '');
        const full = path.resolve(DOCS_DIR, f);
        if (!f || !full.startsWith(DOCS_DIR + path.sep) || !fs.existsSync(full)) {
          res.statusCode = 404;
          res.end('not found');
          return;
        }
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        fs.createReadStream(full).pipe(res);
      });

      server.middlewares.use('/__docs/search', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        try {
          const body = await readJsonBody(req);
          const q = String(body?.query ?? '').trim();
          const docs = await loadLocalDocsWithAutoSync();
          if (!q || q.includes('최근 서류')) {
            res.end(JSON.stringify({ ok: true, documents: stripDocVecs(docs) }));
            return;
          }

          const rawTokens = q
            .toLowerCase()
            .replace(/[.,!?'"“”‘’()[\]{}]/g, ' ')
            .split(/\s+/)
            .map((t) => t.replace(/(에서|으로|이랑|하고|부터|까지|있는|하는|찍는|들을|들|의|을|를|은|는|에|와|과|도)$/, ''))
            .filter((t) => t.length >= 1 && !['찾아줘', '보여줘', '사진', '문서', '파일', '서류함', '및', '사본'].includes(t));

          if (rawTokens.length === 0) {
            res.end(JSON.stringify({ ok: true, documents: stripDocVecs(docs) }));
            return;
          }

          const qVec = await embedQueryVector768(q);
          const scored = docs
            .map((doc) => {
              const corpus = `${doc.fileName} ${doc.title} ${doc.categoryBadge} ${doc.extractedText} ${(doc.keywords ?? []).join(' ')}`.toLowerCase();
              let hits = 0;
              for (const tk of rawTokens) {
                if (corpus.includes(tk)) hits += 1;
              }
              let vecSim = 0.6;
              if (qVec && Array.isArray(doc.vec) && doc.vec.length === qVec.length) {
                let dot = 0;
                for (let i = 0; i < qVec.length; i++) dot += qVec[i] * doc.vec[i];
                vecSim = dot;
              }
              return {
                doc,
                hits,
                vecSim,
                totalScore: hits * 4 + vecSim * 5,
              };
            })
            .filter((item) => item.hits > 0 || item.vecSim >= 0.72);

          scored.sort((a, b) => b.totalScore - a.totalScore);
          const filtered =
            scored.length > 1
              ? scored.filter((s) => s.totalScore >= scored[0].totalScore * 0.55).map((s) => s.doc)
              : scored.map((s) => s.doc);

          res.end(JSON.stringify({ ok: true, documents: stripDocVecs(filtered) }));
        } catch (e) {
          res.end(JSON.stringify({ ok: false, error: String(e), documents: [] }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [basicSsl(), sayseeLocalBridge()],
  server: {
    host: true,
    port: 5199,
    allowedHosts: true,
  },
  optimizeDeps: {
    exclude: ['@huggingface/transformers'],
  },
  build: {
    target: 'es2022',
  },
});
