/**
 * 귀신같이 (Ghosti) — 100% 자율 동영상 전 구간(Full-Timeline) 해부 인덱서
 * - 수동 개입/하드코딩 0%: 디스크(test_photos)의 실제 .mp4 비디오 파일을 자동 탐색
 * - HTML5 Video + Canvas 디코더(Headless Chrome)로 실제 재생시간(duration)·해상도 측정 및 2~3초 간격 키프레임 이미지 자동 추출
 * - 멀티모달 비전 엔진 + 한국어 시각 개념 온톨로지(koreanPhotoOntology.json) + 768차원 EmbeddingGemma 2 벡터 자동 산출
 */
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { AutoConfig, AutoModel, AutoTokenizer } from '@huggingface/transformers';

const ROOT_DIR = process.cwd();
const PHOTO_DIR = path.resolve(ROOT_DIR, 'test_photos');
const RESULTS_DIR = path.resolve(ROOT_DIR, 'poc/results');
const FRAMES_DIR = path.resolve(RESULTS_DIR, 'video_frames');
const PHOTO_SEMANTIC_PATH = path.resolve(RESULTS_DIR, 'corpus_550_semantic_index.json');
const ONTOLOGY_PATH = path.resolve(ROOT_DIR, 'src/data/koreanPhotoOntology.json');
const OUT_FILE = path.resolve(RESULTS_DIR, 'video_timeline_index.json');

function resolveGeminiApiKey() {
  const candidates = [
    path.resolve(ROOT_DIR, '.env.local'),
    path.resolve(ROOT_DIR, '.env'),
    'D:/Bes2-Marketer/.env',
    'D:/Bes2/.env',
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
  console.error('No GEMINI_API_KEY found');
  process.exit(1);
}

fs.mkdirSync(FRAMES_DIR, { recursive: true });

function parseFileTimestampMs(name, fallbackMs) {
  const m = name.match(/(20\d{2})(\d{2})(\d{2})[_-](\d{2})(\d{2})(\d{2})/);
  if (m) {
    return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  }
  return fallbackMs;
}

function formatDateText(name, fallbackMs) {
  const m = name.match(/(20\d{2})(\d{2})(\d{2})[_-](\d{2})(\d{2})(\d{2})/);
  if (m) {
    return `${m[1]}.${m[2]}.${m[3]} ${m[4]}:${m[5]}`;
  }
  const d = new Date(fallbackMs);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function formatMMSS(sec) {
  const s = Math.max(0, Math.round(sec));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

// 1) 디스크에서 실제 .mp4 비디오 스캔 후 연속 촬영 세션(1시간 이내 동일 세션) 클러스터링 -> 세션별 대표 클립 선정
const allVideoFiles = fs
  .readdirSync(PHOTO_DIR)
  .filter((f) => /\.mp4$/i.test(f))
  .map((f) => {
    const full = path.join(PHOTO_DIR, f);
    const st = fs.statSync(full);
    return {
      name: f,
      full,
      size: st.size,
      mtimeMs: st.mtimeMs,
      tsMs: parseFileTimestampMs(f, st.mtimeMs),
      dateText: formatDateText(f, st.mtimeMs),
    };
  })
  // 모바일/일반 촬영 영상(80MB 이하) 대상 정렬
  .filter((v) => v.size <= 80 * 1024 * 1024)
  .sort((a, b) => a.tsMs - b.tsMs);

// 동일 세션(촬영 간격 30분 이내) 클립들을 묶고, 각 세션에서 가장 용량/길이가 풍부한 대표 클립 1개씩 자동 추출
const sessions = [];
for (const v of allVideoFiles) {
  const lastSession = sessions[sessions.length - 1];
  if (lastSession && Math.abs(v.tsMs - lastSession[lastSession.length - 1].tsMs) <= 30 * 60 * 1000) {
    lastSession.push(v);
  } else {
    sessions.push([v]);
  }
}

const representativeVideos = sessions.map((sess) => {
  const sorted = [...sess].sort((a, b) => b.size - a.size);
  return sorted[0];
});

console.log(
  `Discovered ${allVideoFiles.length} video files across ${sessions.length} distinct shooting sessions:`,
  representativeVideos.map((v) => `${v.name} (${(v.size / 1024 / 1024).toFixed(1)}MB)`)
);

// 사진 코퍼스의 EXIF GPS 위치 인덱스를 참조하여 인접 촬영 시각의 지명 자동 연결
const photoSemMap = fs.existsSync(PHOTO_SEMANTIC_PATH)
  ? JSON.parse(fs.readFileSync(PHOTO_SEMANTIC_PATH, 'utf-8')).photos || {}
  : {};
const photoWithTs = Object.entries(photoSemMap).map(([fName, meta]) => ({
  fName,
  tsMs: parseFileTimestampMs(fName, 0),
  locationKo: meta.locationKo || '',
  locationKeywords: meta.locationKeywords || [],
}));

function inferLocationFromNearbyPhotos(videoTsMs) {
  if (!videoTsMs) return { locationKo: '촬영 장소 자동 분석', locationKeywords: [] };
  let best = null;
  let minDiff = Infinity;
  for (const p of photoWithTs) {
    if (!p.tsMs || !p.locationKo) continue;
    const diff = Math.abs(p.tsMs - videoTsMs);
    if (diff < minDiff && diff <= 6 * 3600 * 1000) {
      minDiff = diff;
      best = p;
    }
  }
  return best
    ? { locationKo: best.locationKo, locationKeywords: best.locationKeywords }
    : { locationKo: '현장 촬영 영상', locationKeywords: [] };
}

// 2) Headless Chrome HTML5 Video + Canvas 디코더로 실제 메타데이터 및 타임라인 프레임 JPEG 추출
const CHROME_PATH = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => fs.existsSync(p));

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH,
  headless: true,
  args: ['--ignore-certificate-errors', '--autoplay-policy=no-user-gesture-required'],
});

const page = await browser.newPage();
await page.goto('https://localhost:5199', { waitUntil: 'domcontentloaded' });

async function extractVideoFramesInBrowser(videoName) {
  const url = `/__photos/file?p=${encodeURIComponent(videoName)}`;
  const extracted = await page.evaluate(async (videoUrl) => {
    const v = document.createElement('video');
    v.src = videoUrl;
    v.muted = true;
    v.playsInline = true;
    v.crossOrigin = 'anonymous';

    await new Promise((resolve, reject) => {
      v.onloadedmetadata = () => resolve();
      v.onerror = () => reject(new Error('Failed to load video: ' + videoUrl));
    });

    const duration = v.duration || 10;
    const width = v.videoWidth || 1920;
    const height = v.videoHeight || 1080;

    // 영상 길이에 맞춰 약 2~3초 간격으로 타임스탬프 배열 자동 생성 (6~8개 구간)
    const step = duration <= 12 ? 2 : duration <= 25 ? 3 : Math.max(3, Math.floor(duration / 7));
    const timestamps = [];
    for (let t = 0; t < duration - 0.4; t += step) {
      timestamps.push(Math.round(t));
    }
    const lastSec = Math.max(0, Math.floor(duration - 0.6));
    if (timestamps[timestamps.length - 1] !== lastSec && lastSec - timestamps[timestamps.length - 1] >= 1) {
      timestamps.push(lastSec);
    }

    const scale = Math.min(1, 512 / Math.max(width, height));
    const cw = Math.max(1, Math.round(width * scale));
    const ch = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');

    const frames = [];
    for (const sec of timestamps) {
      v.currentTime = Math.min(duration - 0.1, sec);
      await new Promise((resolve) => {
        const onSeek = () => {
          v.removeEventListener('seeked', onSeek);
          resolve();
        };
        v.addEventListener('seeked', onSeek);
      });
      ctx.drawImage(v, 0, 0, cw, ch);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.84);
      frames.push({
        timeSec: sec,
        base64: dataUrl.split(',')[1],
      });
    }

    return {
      durationSec: Math.round(duration),
      width,
      height,
      frames,
    };
  }, url);

  return extracted;
}

async function analyzeVideoTimelineWithVision(videoName, frames, locationKo) {
  const parts = [
    {
      text: `다음은 하나의 동영상(${videoName})에서 시간 순서대로 추출한 ${frames.length}개의 실제 타임라인 프레임 이미지입니다.
참고 촬영 지역 정보: ${locationKo}

어떠한 추측이나 과장 없이 오직 각 프레임 이미지에 실제로 보이는 시각적 팩트(인물, 옷차림/색상, 장신구/액세서리, 사물, 배경, 행동, 카메라 구도 변화)만 정밀하게 분석하여 아래 JSON 스키마로 출력하세요:
{
  "videoTitleKo": "영상 전체의 핵심 장면 흐름을 요약한 자연스러운 한국어 제목 (1문장)",
  "sceneSummaryKo": "초반부터 후반까지 시간 순서대로 변화하는 주요 장면 요약 (1~2문장)",
  "frames": [
    {
      "frameIdx": 0,
      "phaseLabel": "구간 짧은 요약 (예: 초반 야외 착석 / 중반 카메라 접근 / 후반 클로즈업 등 12자 이내)",
      "sceneCaption": "해당 프레임에 실제로 보이는 인물·의상·사물·장신구·배경·행동을 구체적으로 묘사한 한국어 1문장",
      "captionEn": "Detailed English visual description of this exact frame for semantic vector indexing",
      "keywords": ["핵심명사1", "핵심명사2", "핵심명사3", "핵심명사4", "핵심명사5", "핵심명사6", "핵심명사7"],
      "tags": ["#대표태그1", "#대표태그2", "#대표태그3"]
    }
  ]
}`,
    },
  ];

  frames.forEach((f, idx) => {
    parts.push({
      text: `Frame idx=${idx} (timestamp=${formatMMSS(f.timeSec)}, ${f.timeSec}s):`,
    });
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: f.base64,
      },
    });
  });

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
        return JSON.parse(txt);
      }
    } catch {
      // retry
    }
  }
  return null;
}

// 온톨로지 로드 (프레임별 상·하위 개념 자동 상속용)
const ontologyNodes = fs.existsSync(ONTOLOGY_PATH)
  ? JSON.parse(fs.readFileSync(ONTOLOGY_PATH, 'utf-8')).nodes || []
  : [];

const KEEP_STEM_WORDS = new Set([
  '아이', '어린이', '바닷가', '창가', '물가', '길가', '목걸이', '귀걸이', '물놀이', '나들이', '비행기', '종로', '을지로',
]);
const KO_PARTICLE_RX =
  /(?:들)?(?:에서부터|으로부터|에게서|에서|에게|으로|이랑|하고|부터|까지|처럼|보다|마다|대로|밖에|마저|조차|이나|이란|이고|이며|하는|있는|없는|되는|했던|하던|해서|하며|된|한|할|님|씨|이|가|은|는|을|를|의|에|로|와|과|랑|도|만|나|란|다)$/;
const LOAN_TAILS = /^(이크|패드|디어|라인|스크림|언맨|사이트|이드|이즈|이트)$/;

function extractKoStems(text) {
  const eojeols = String(text || '')
    .toLowerCase()
    .replace(/[^가-힣a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const stems = new Set();
  for (const raw of eojeols) {
    if (KEEP_STEM_WORDS.has(raw)) {
      stems.add(raw);
      continue;
    }
    const next = raw.replace(KO_PARTICLE_RX, '');
    stems.add(next && next.length >= 1 ? next : raw);
  }
  return Array.from(stems);
}

function matchKoTokenInStems(token, stems, rawText) {
  const tk = String(token || '').toLowerCase().trim();
  if (!tk) return false;
  for (const st of stems) {
    if (st === tk) return true;
    if (tk.length === 1) continue;
    if (tk.length === 2) {
      if (st.startsWith(tk)) {
        const rem = st.slice(tk.length);
        if (rem.length >= 2 && !LOAN_TAILS.test(rem)) return true;
      }
      if (st.endsWith(tk)) {
        const rem = st.slice(0, st.length - tk.length);
        if (rem.length >= 2) return true;
      }
      continue;
    }
    if (st.includes(tk)) return true;
  }
  if (tk.length >= 3 && rawText) {
    const noSpace = String(rawText).toLowerCase().replace(/\s+/g, '');
    if (noSpace.includes(tk.replace(/\s+/g, ''))) return true;
  }
  return false;
}

function expandOntologyTerms(textAndKeywords) {
  const stems = extractKoStems(textAndKeywords);
  const expanded = new Set();
  for (const node of ontologyNodes) {
    let hit = false;
    for (const trig of node.triggers || []) {
      const t = trig.toLowerCase();
      if (t.length >= 2 && matchKoTokenInStems(t, stems, textAndKeywords)) {
        expanded.add(t);
        hit = true;
      }
    }
    if (hit) {
      for (const eq of node.equivalents || []) expanded.add(eq.toLowerCase());
      for (const p of node.parents || []) expanded.add(p.toLowerCase());
    }
  }
  return Array.from(expanded);
}

console.log('Loading local 768-dim EmbeddingGemma 2 ONNX model for frame vectorization...');
const cfg = await AutoConfig.from_pretrained('onnx-community/embeddinggemma-2-ONNX');
cfg.vision_config = null;
cfg.audio_config = null;
const gemmaModel = await AutoModel.from_pretrained('onnx-community/embeddinggemma-2-ONNX', {
  config: cfg,
  dtype: 'q4',
});
const gemmaTokenizer = await AutoTokenizer.from_pretrained('onnx-community/embeddinggemma-2-ONNX');

function normalizeVec(arr) {
  let n = 0;
  for (const v of arr) n += v * v;
  n = Math.sqrt(n) || 1;
  return arr.map((v) => +(v / n).toFixed(4));
}

async function embedTexts768(texts) {
  const inp = await gemmaTokenizer(texts, { padding: true, truncation: true });
  const out = await gemmaModel(inp);
  return out.sentence_embedding.tolist().map(normalizeVec);
}

const indexedVideos = [];

for (let vIdx = 0; vIdx < representativeVideos.length; vIdx++) {
  const v = representativeVideos[vIdx];
  console.log(`\n[${vIdx + 1}/${representativeVideos.length}] Extracting frames from ${v.name}...`);
  const decoded = await extractVideoFramesInBrowser(v.name);
  const { locationKo, locationKeywords } = inferLocationFromNearbyPhotos(v.tsMs);

  // 추출된 실제 프레임 이미지를 디스크에 저장
  const baseId = path.basename(v.name, path.extname(v.name));
  const savedFrames = decoded.frames.map((f) => {
    const fileName = `${baseId}_t${String(f.timeSec).padStart(2, '0')}.jpg`;
    const filePath = path.join(FRAMES_DIR, fileName);
    fs.writeFileSync(filePath, Buffer.from(f.base64, 'base64'));
    return {
      ...f,
      frameFile: fileName,
      thumbUrl: `/__videos/frame?f=${encodeURIComponent(fileName)}`,
    };
  });

  console.log(`  -> Extracted ${savedFrames.length} frames (${decoded.width}x${decoded.height}, ${decoded.durationSec}s). Running Vision analysis...`);
  const visionResult = await analyzeVideoTimelineWithVision(v.name, savedFrames, locationKo);

  const rawFramesMeta = Array.isArray(visionResult?.frames) ? visionResult.frames : [];
  const frameEmbedInputs = savedFrames.map((sf, idx) => {
    const fm = rawFramesMeta.find((x) => x.frameIdx === idx) || rawFramesMeta[idx] || {};
    const kws = Array.isArray(fm.keywords) ? fm.keywords : [];
    return `title: ${visionResult?.videoTitleKo || v.name} | text: ${fm.captionEn || ''} | ${fm.sceneCaption || ''} | ${kws.join(', ')}`;
  });

  const frameVecs = await embedTexts768(frameEmbedInputs);

  const allVideoKeywordSet = new Set(locationKeywords);
  const timelineFrames = savedFrames.map((sf, idx) => {
    const fm = rawFramesMeta.find((x) => x.frameIdx === idx) || rawFramesMeta[idx] || {};
    const kws = (Array.isArray(fm.keywords) ? fm.keywords : [])
      .map((k) => String(k).trim())
      .filter(Boolean);
    const tags = (Array.isArray(fm.tags) ? fm.tags : [])
      .map((t) => (String(t).startsWith('#') ? String(t) : `#${t}`));
    const sceneCaption = String(fm.sceneCaption || '').trim();
    const captionEn = String(fm.captionEn || '').trim();
    const phaseLabel = String(fm.phaseLabel || `${formatMMSS(sf.timeSec)} 구간`).trim();

    const ontoTerms = expandOntologyTerms(`${sceneCaption} ${captionEn} ${kws.join(' ')} ${tags.join(' ')}`);
    const mergedKeywords = Array.from(new Set([...kws, ...ontoTerms]));
    mergedKeywords.forEach((k) => allVideoKeywordSet.add(k));

    return {
      frameId: `${baseId}_f${String(sf.timeSec).padStart(2, '0')}`,
      timeSec: sf.timeSec,
      timestampText: formatMMSS(sf.timeSec),
      phaseLabel,
      sceneCaption,
      captionEn,
      keywords: kws,
      ontologyKeywords: ontoTerms,
      tags: tags.length > 0 ? tags : [`#${kws[0] || '장면'}`],
      thumbUrl: sf.thumbUrl,
      vec: frameVecs[idx] || [],
    };
  });

  const midFrame = timelineFrames[Math.floor(timelineFrames.length / 2)] || timelineFrames[0];
  const videoTitle = String(visionResult?.videoTitleKo || `${v.dateText} 촬영 영상`).trim();
  const sceneDesc = String(
    visionResult?.sceneSummaryKo ||
      timelineFrames.map((tf) => `${tf.timestampText} ${tf.phaseLabel}`).join(' ➔ ')
  ).trim();

  const [videoVec] = await embedTexts768([
    `title: ${videoTitle} | text: ${sceneDesc} | ${Array.from(allVideoKeywordSet).slice(0, 25).join(', ')}`,
  ]);

  indexedVideos.push({
    id: `vid_${baseId}`,
    videoFileName: v.name,
    title: videoTitle,
    keyframePhotoId: v.name,
    thumbUrl: midFrame?.thumbUrl || `/__videos/frame?f=${encodeURIComponent(savedFrames[0]?.frameFile || '')}`,
    videoUrl: `/__photos/file?p=${encodeURIComponent(v.name)}`,
    date: v.dateText,
    durationText: formatMMSS(decoded.durationSec),
    durationSec: decoded.durationSec,
    matchedSeekSec: midFrame?.timeSec ?? 0,
    matchedTimestamp: `🎯 ${midFrame?.timestampText ?? '00:00'} 구간 포착`,
    matchedFrameCaption: midFrame?.sceneCaption ?? videoTitle,
    locationKo,
    sceneDescription: sceneDesc,
    keywords: Array.from(allVideoKeywordSet),
    resolution: `${decoded.width}x${decoded.height} (전 구간 ${timelineFrames.length}개 프레임 자동 해부)`,
    sizeMB: +(v.size / 1024 / 1024).toFixed(1),
    vec: videoVec,
    timelineFrames,
  });

  console.log(`  -> Indexed ${v.name}: "${videoTitle}" (${timelineFrames.length} frames)`);
}

await browser.close();

const payload = {
  createdAt: new Date().toISOString(),
  videoCount: indexedVideos.length,
  totalFrames: indexedVideos.reduce((a, v) => a + v.timelineFrames.length, 0),
  videos: indexedVideos,
};

fs.writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');
console.log(`\nSaved autonomous video timeline index (${payload.videoCount} videos, ${payload.totalFrames} frames) to ${OUT_FILE}`);
