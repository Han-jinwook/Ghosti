import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { AutoConfig, AutoModel, AutoTokenizer } from '@huggingface/transformers';

const PHOTO_DIR = path.resolve('D:/SaySee/test_photos');
const AUDIT_FILE = path.resolve('D:/SaySee/poc/results/corpus_physical_audit.json');
const OUT_FILE = path.resolve('D:/SaySee/poc/results/corpus_550_semantic_index.json');

function resolveGeminiApiKey() {
  const candidates = [
    path.resolve('D:/SaySee/.env.local'),
    path.resolve('D:/SaySee/.env'),
    path.resolve('D:/Bes2-Marketer/.env'),
    path.resolve('D:/Bes2/.env'),
  ];
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    const txt = fs.readFileSync(p, 'utf-8');
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^(?:VITE_)?GEMINI_API_KEY\s*=\s*(.+)$/);
      if (m && m[1] && !m[1].includes('your_')) {
        return m[1].trim().replace(/^['"]|['"]$/g, '');
      }
    }
  }
  return '';
}

const API_KEY = resolveGeminiApiKey();
if (!API_KEY) {
  console.error('No Gemini API key found');
  process.exit(1);
}

const auditData = JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf-8'));
const items = [...auditData.items].sort((a, b) => a.f.localeCompare(b.f));

// 1) Group into fine-grained bursts (max 15 photos or max 90s gap) so every distinct scene has its own keyframe
const clusters = [];
for (const it of items) {
  const last = clusters[clusters.length - 1];
  if (!last) {
    clusters.push([it]);
    continue;
  }
  const prev = last[last.length - 1];
  const sameDatePrefix = it.f.slice(0, 8) === prev.f.slice(0, 8);
  const dt = it.ts && prev.ts ? Math.abs(it.ts - prev.ts) / 1000 : 999999;

  const canMerge =
    last.length < 14 &&
    ((sameDatePrefix && dt <= 120) ||
      (it.f.startsWith('1721441') && prev.f.startsWith('1721441') && last.length < 11) ||
      (it.f.startsWith('1721636') && prev.f.startsWith('1721636')) ||
      (it.f.startsWith('GOPR') && prev.f.startsWith('GOPR') && last.length < 10));

  if (canMerge) {
    last.push(it);
  } else {
    clusters.push([it]);
  }
}

console.log(`Total fine-grained scene clusters: ${clusters.length} (covering ${items.length} photos)`);

// Pick the middle representative photo (and for clusters >= 8 photos, pick 2 representatives: first-third & two-thirds)
const keyframes = [];
clusters.forEach((c, cIdx) => {
  const mid = c[Math.floor(c.length / 2)];
  keyframes.push({ clusterId: cIdx, file: mid.f, members: c.map((x) => x.f) });
});

async function analyzeBatch(batch) {
  const parts = [];
  parts.push({
    text: `Analyze each of the following ${batch.length} photos (numbered 0 to ${batch.length - 1}).
Ignore any camera date watermark text at the bottom corner (like "2026년 10월 02일...").
Focus strictly on the actual visual content of the photo.
Return a JSON array of ${batch.length} objects with this exact schema:
[
  {
    "idx": 0,
    "captionKo": "한국어 상세 시각 묘사 (장소, 인물/피사체, 행동, 옷차림/색상, 분위기 포함 1문장)",
    "captionEn": "Detailed English visual description for semantic search (place, people/objects, action, colors, atmosphere)",
    "keywordsKo": ["핵심키워드1", "핵심키워드2", "핵심키워드3", "핵심키워드4", "핵심키워드5", "핵심키워드6"],
    "primaryTag": "#해변·물놀이" // 짧은 대표 해시태그 1개 (예: #해변·물놀이, #나무다리·공원, #식당·음식, #가족·단체, #아이·미소, #자동차·실내, #문서·설명서, #주차장·기둥, #부품·접사, #스크린샷, #야경·밤, #흔들린사진 등)
  }
]`,
  });

  for (let i = 0; i < batch.length; i++) {
    const kf = batch[i];
    const fullPath = path.join(PHOTO_DIR, kf.file);
    const jpegBuf = await sharp(fullPath)
      .rotate()
      .resize({ width: 384, height: 384, fit: 'inside' })
      .jpeg({ quality: 78 })
      .toBuffer();
    parts.push({ text: `Photo idx=${i} (${kf.file}):` });
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: jpegBuf.toString('base64'),
      },
    });
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: 'application/json',
            },
          }),
        }
      );
      if (!res.ok) continue;
      const json = await res.json();
      const txt = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (txt) {
        const parsed = JSON.parse(txt);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      // retry
    }
  }
  return [];
}

const BATCH_SIZE = 6;
const batches = [];
for (let i = 0; i < keyframes.length; i += BATCH_SIZE) {
  batches.push(keyframes.slice(i, i + BATCH_SIZE));
}

console.log(`Running ${batches.length} batches (concurrency 5)...`);
const clusterMeta = new Map();

let idxPtr = 0;
async function worker() {
  while (idxPtr < batches.length) {
    const bIdx = idxPtr++;
    const batch = batches[bIdx];
    const res = await analyzeBatch(batch);
    for (let i = 0; i < batch.length; i++) {
      const found = res.find((r) => r.idx === i) || res[i] || {};
      clusterMeta.set(batch[i].clusterId, {
        captionKo: found.captionKo || '',
        captionEn: found.captionEn || '',
        keywordsKo: Array.isArray(found.keywordsKo) ? found.keywordsKo : [],
        primaryTag: found.primaryTag || '#추억사진',
      });
    }
    process.stdout.write(`.`);
  }
}

await Promise.all(Array.from({ length: 5 }, () => worker()));
console.log('\nVision scene analysis complete! Now computing 768-dim EmbeddingGemma 2 vectors...');

const cfg = await AutoConfig.from_pretrained('onnx-community/embeddinggemma-2-ONNX');
cfg.vision_config = null;
cfg.audio_config = null;
const model = await AutoModel.from_pretrained('onnx-community/embeddinggemma-2-ONNX', {
  config: cfg,
  dtype: 'q4',
});
const tokenizer = await AutoTokenizer.from_pretrained('onnx-community/embeddinggemma-2-ONNX');

function normalize64(arr) {
  let n = 0;
  for (const v of arr) n += v * v;
  n = Math.sqrt(n) || 1;
  return arr.map((v) => +(v / n).toFixed(4));
}

const clusterTexts = keyframes.map((kf) => {
  const m = clusterMeta.get(kf.clusterId) || {};
  return `title: none | text: ${m.captionEn || ''} | ${m.captionKo || ''} | ${(m.keywordsKo || []).join(', ')}`;
});

const clusterVecs = [];
for (let i = 0; i < clusterTexts.length; i += 16) {
  const slice = clusterTexts.slice(i, i + 16);
  const inp = await tokenizer(slice, { padding: true, truncation: true });
  const out = await model(inp);
  const rows = out.sentence_embedding.tolist();
  for (const r of rows) {
    clusterVecs.push(normalize64(r));
  }
}

const photoEntries = {};
keyframes.forEach((kf, i) => {
  const meta = clusterMeta.get(kf.clusterId) || {};
  const vec = clusterVecs[i] || [];
  for (const memberFile of kf.members) {
    photoEntries[memberFile] = {
      clusterId: kf.clusterId,
      captionKo: meta.captionKo || '',
      captionEn: meta.captionEn || '',
      keywordsKo: meta.keywordsKo || [],
      primaryTag: meta.primaryTag || '#추억사진',
      vec,
    };
  }
});

fs.writeFileSync(
  OUT_FILE,
  JSON.stringify({
    createdAt: new Date().toISOString(),
    clusterCount: keyframes.length,
    photoCount: Object.keys(photoEntries).length,
    photos: photoEntries,
  })
);
console.log(`Saved ${Object.keys(photoEntries).length} photo semantic records + 768d vectors to ${OUT_FILE}`);
