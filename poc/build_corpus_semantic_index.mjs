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

function hDist(a, b) {
  if (!a || !b || a.length !== b.length) return 64;
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      d += x & 1;
      x >>= 1;
    }
  }
  return d;
}

const auditData = JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf-8'));
const items = [...auditData.items].sort((a, b) => a.f.localeCompare(b.f));
const auditMap = new Map(items.map((x) => [x.f, x]));

const existingData = fs.existsSync(OUT_FILE)
  ? JSON.parse(fs.readFileSync(OUT_FILE, 'utf-8'))
  : { photos: {} };
const existingPhotos = existingData.photos || {};

// Identify which photos were already the true keyframe (mid) of their previous cluster
const prevByCluster = new Map();
for (const [f, m] of Object.entries(existingPhotos)) {
  if (!prevByCluster.has(m.clusterId)) prevByCluster.set(m.clusterId, []);
  prevByCluster.get(m.clusterId).push(f);
}
const alreadyVerifiedKeyframes = new Set();
for (const [, files] of prevByCluster.entries()) {
  files.sort();
  const mid = files[Math.floor(files.length / 2)];
  const midA = auditMap.get(mid);
  for (const f of files) {
    const a = auditMap.get(f);
    if (f === mid || hDist(midA?.dhash, a?.dhash) <= 6) {
      alreadyVerifiedKeyframes.add(f);
    }
  }
}

// Group remaining unverified photos ONLY when they are true identical bursts (dhash <= 6, dt <= 3s, skinDiff <= 4%)
const unverifiedItems = items.filter((it) => !alreadyVerifiedKeyframes.has(it.f));
const burstGroups = [];
for (const it of unverifiedItems) {
  const last = burstGroups[burstGroups.length - 1];
  if (!last) {
    burstGroups.push([it]);
    continue;
  }
  const prev = last[last.length - 1];
  const dist = hDist(prev.dhash, it.dhash);
  const dt = it.ts && prev.ts ? Math.abs(it.ts - prev.ts) / 1000 : 999999;
  const skinDiff = Math.abs((it.skinPct || 0) - (prev.skinPct || 0));
  if (last.length < 6 && dist <= 6 && dt <= 3 && skinDiff <= 4.0 && it.ts > 0) {
    last.push(it);
  } else {
    burstGroups.push([it]);
  }
}

const nextClusterStartId = 200;
const keyframesToAnalyze = burstGroups.map((g, idx) => ({
  clusterId: nextClusterStartId + idx,
  file: g[0].f,
  members: g.map((x) => x.f),
}));

console.log(
  `Already verified keyframes/identical bursts: ${alreadyVerifiedKeyframes.size}, New distinct scenes to analyze individually: ${keyframesToAnalyze.length} (covering ${unverifiedItems.length} photos)`
);

async function analyzeBatch(batch) {
  const parts = [];
  parts.push({
    text: `Analyze each of the following ${batch.length} photos (numbered 0 to ${batch.length - 1}).
Ignore any camera date watermark text at the bottom corner (like "2026년 10월 02일...").
Focus strictly on the actual visual content of EACH individual photo (exact person gender/age, clothing color/type, place, bridge/beach/tree/indoors, objects, actions).
Pay special attention to distinguish:
- Adult male (남성) vs Adult female (여성) vs Couple together (남녀/부부) vs Boy/Youth with glasses (안경 쓴 소년/청년) vs Young boy without glasses (소년/아이) vs Young female/daughter with long hair (소녀/딸).
Return a JSON array of ${batch.length} objects with this exact schema:
[
  {
    "idx": 0,
    "captionKo": "한국어 상세 시각 묘사 (장소, 성별/인물 수, 옷차림/색상, 행동, 사물 포함 1문장)",
    "captionEn": "Detailed English visual description for semantic search (place, exact people/gender, clothing, action, objects)",
    "keywordsKo": ["핵심키워드1", "핵심키워드2", "핵심키워드3", "핵심키워드4", "핵심키워드5", "핵심키워드6"],
    "primaryTag": "#해변·물놀이"
  }
]`,
  });

  for (let i = 0; i < batch.length; i++) {
    const kf = batch[i];
    const fullPath = path.join(PHOTO_DIR, kf.file);
    const jpegBuf = await sharp(fullPath)
      .rotate()
      .resize({ width: 320, height: 320, fit: 'inside' })
      .jpeg({ quality: 75 })
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
              temperature: 0.15,
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
    } catch {
      // retry
    }
  }
  return [];
}

const BATCH_SIZE = 10;
const batches = [];
for (let i = 0; i < keyframesToAnalyze.length; i += BATCH_SIZE) {
  batches.push(keyframesToAnalyze.slice(i, i + BATCH_SIZE));
}

console.log(`Running ${batches.length} batches (concurrency 8)...`);
const newClusterMeta = new Map();

let idxPtr = 0;
async function worker() {
  while (idxPtr < batches.length) {
    const bIdx = idxPtr++;
    const batch = batches[bIdx];
    const res = await analyzeBatch(batch);
    for (let i = 0; i < batch.length; i++) {
      const found = res.find((r) => r.idx === i) || res[i] || {};
      newClusterMeta.set(batch[i].clusterId, {
        captionKo: found.captionKo || '',
        captionEn: found.captionEn || '',
        keywordsKo: Array.isArray(found.keywordsKo) ? found.keywordsKo : [],
        primaryTag: found.primaryTag || '#추억사진',
      });
    }
    process.stdout.write(`.`);
  }
}

if (batches.length > 0) {
  await Promise.all(Array.from({ length: 8 }, () => worker()));
  console.log('\nPer-photo vision analysis complete! Computing 768-dim EmbeddingGemma 2 vectors...');

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

  const clusterTexts = keyframesToAnalyze.map((kf) => {
    const m = newClusterMeta.get(kf.clusterId) || {};
    return `title: none | text: ${m.captionEn || ''} | ${m.captionKo || ''} | ${(m.keywordsKo || []).join(', ')}`;
  });

  const clusterVecs = [];
  for (let i = 0; i < clusterTexts.length; i += 24) {
    const slice = clusterTexts.slice(i, i + 24);
    const inp = await tokenizer(slice, { padding: true, truncation: true });
    const out = await model(inp);
    const rows = out.sentence_embedding.tolist();
    for (const r of rows) {
      clusterVecs.push(normalize64(r));
    }
  }

  keyframesToAnalyze.forEach((kf, i) => {
    const meta = newClusterMeta.get(kf.clusterId) || {};
    const vec = clusterVecs[i] || [];
    for (const memberFile of kf.members) {
      const prevEntry = existingPhotos[memberFile] || {};
      existingPhotos[memberFile] = {
        ...prevEntry,
        clusterId: kf.clusterId,
        captionKo: meta.captionKo || prevEntry.captionKo || '',
        captionEn: meta.captionEn || prevEntry.captionEn || '',
        keywordsKo: meta.keywordsKo?.length ? meta.keywordsKo : prevEntry.keywordsKo || [],
        primaryTag: meta.primaryTag || prevEntry.primaryTag || '#추억사진',
        vec: vec.length === 768 ? vec : prevEntry.vec || [],
      };
    }
  });
}

fs.writeFileSync(
  OUT_FILE,
  JSON.stringify({
    ...existingData,
    updatedAt: new Date().toISOString(),
    photoCount: Object.keys(existingPhotos).length,
    photos: existingPhotos,
  })
);
console.log(`Saved ${Object.keys(existingPhotos).length} individually verified photo semantic records to ${OUT_FILE}`);
