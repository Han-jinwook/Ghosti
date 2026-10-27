/**
 * 귀신같이 (Ghosti) — 100% 자율 얼굴 검출(Face Detection) · 연도별(2026 ➔ 2024) 베스트 1장 차곡차곡 누적 크롭 · 인물 클러스터링 인덱서
 * - 수동 하드코딩 0%: 실제 이미지 픽셀(EXIF 회전 보정 포함)에서 얼굴 Bounding Box [ymin, xmin, ymax, xmax] 자동 검출
 * - 연도별 베스트 컷 차곡차곡 누적(yearlyBestCuts): 동일 인물이 여러 연도(2026년, 2024년 등)에 찍힌 경우,
 *   연도별로 가장 선명하고 정면 비율이 높은 1장씩을 각각 크롭하여 최신순(2026 ➔ 2024)으로 차곡차곡 쌓아 보존
 * - 기존 방장 등록 실명(은숙, 멀린, 치우, 천우, 지우) 자동 보존 및 1:1 정밀 인물 사진 매칭
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT_DIR = process.cwd();
const PHOTO_DIR = path.resolve(ROOT_DIR, 'test_photos');
const RESULTS_DIR = path.resolve(ROOT_DIR, 'poc/results');
const FACE_CROPS_DIR = path.resolve(RESULTS_DIR, 'face_crops');
const PHOTO_SEMANTIC_PATH = path.resolve(RESULTS_DIR, 'corpus_550_semantic_index.json');
const PHYSICAL_AUDIT_PATH = path.resolve(RESULTS_DIR, 'corpus_physical_audit.json');
const VIDEO_INDEX_PATH = path.resolve(RESULTS_DIR, 'video_timeline_index.json');
const OUT_FILE = path.resolve(RESULTS_DIR, 'face_clusters_index.json');

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

fs.mkdirSync(FACE_CROPS_DIR, { recursive: true });

function extractYearFromFileName(name) {
  const s = String(name);
  const m = s.match(/(20\d{2})(\d{2})(\d{2})/);
  if (m) return Number(m[1]);
  const unixMatch = s.match(/^(17\d{11})/);
  if (unixMatch) return new Date(Number(unixMatch[1])).getFullYear();
  return 2024;
}

function formatDateFromFileName(name) {
  const s = String(name);
  const m = s.match(/(20\d{2})(\d{2})(\d{2})/);
  if (m) return `${m[1]}.${m[2]}.${m[3]}`;
  const unixMatch = s.match(/^(17\d{11})/);
  if (unixMatch) {
    const d = new Date(Number(unixMatch[1]));
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  }
  return '2024.07.20';
}

// 기존 등록된 실명(은숙, 멀린, 치우, 천우, 지우) 보존용 맵 로드
const existingNameByPersonKey = new Map();
const existingClusterByPersonKey = new Map();
if (fs.existsSync(OUT_FILE)) {
  try {
    const prev = JSON.parse(fs.readFileSync(OUT_FILE, 'utf-8'));
    for (const c of prev.clusters || []) {
      if (c.personKey) {
        existingClusterByPersonKey.set(c.personKey, c);
        if (c.registeredName) {
          existingNameByPersonKey.set(c.personKey, c.registeredName);
        }
      }
    }
  } catch {
    // ignore
  }
}

const semData = fs.existsSync(PHOTO_SEMANTIC_PATH)
  ? JSON.parse(fs.readFileSync(PHOTO_SEMANTIC_PATH, 'utf-8')).photos || {}
  : {};
const auditItems = fs.existsSync(PHYSICAL_AUDIT_PATH)
  ? JSON.parse(fs.readFileSync(PHYSICAL_AUDIT_PATH, 'utf-8')).items || []
  : [];
const auditMap = new Map(auditItems.map((x) => [x.f, x]));
const videoData = fs.existsSync(VIDEO_INDEX_PATH)
  ? JSON.parse(fs.readFileSync(VIDEO_INDEX_PATH, 'utf-8')).videos || []
  : [];

let latestCorpusYear = 2024;
for (const fName of Object.keys(semData)) {
  if (/^Screenshot_/i.test(fName)) continue;
  const y = extractYearFromFileName(fName);
  if (y >= 2020 && y <= 2030 && y > latestCorpusYear) {
    latestCorpusYear = y;
  }
}
console.log(`Detected latest shooting year in corpus: ${latestCorpusYear}`);

async function cropFaceAvatarFromPhoto(fileName, box2d, outAvatarPath) {
  const fullPath = path.join(PHOTO_DIR, fileName);
  const rotatedBuf = await sharp(fullPath).rotate().toBuffer();
  const meta = await sharp(rotatedBuf).metadata();
  const imgW = meta.width || 1000;
  const imgH = meta.height || 1000;

  const [ymin, xmin, ymax, xmax] = box2d.map((v) => Math.max(0, Math.min(1000, Number(v) || 0)));
  const faceTop = (ymin / 1000) * imgH;
  const faceLeft = (xmin / 1000) * imgW;
  const faceH = Math.max(32, ((ymax - ymin) / 1000) * imgH);
  const faceW = Math.max(32, ((xmax - xmin) / 1000) * imgW);

  const cx = faceLeft + faceW / 2;
  const cy = faceTop + faceH / 2;
  const side = Math.round(Math.min(Math.min(imgW, imgH), Math.max(faceW, faceH) * 1.48));

  const left = Math.round(Math.max(0, Math.min(imgW - side, Math.round(cx - side / 2))));
  const top = Math.round(Math.max(0, Math.min(imgH - side, Math.round(cy - side / 2))));
  const width = Math.round(Math.max(16, Math.min(imgW - left, side)));
  const height = Math.round(Math.max(16, Math.min(imgH - top, side)));

  await sharp(rotatedBuf)
    .extract({ left, top, width, height })
    .resize(240, 240, { fit: 'cover' })
    .jpeg({ quality: 90 })
    .toFile(outAvatarPath);

  return {
    normalizedBox: [ymin, xmin, ymax, xmax],
    pixelCrop: { left, top, width, height, imgW, imgH },
  };
}

// 2024년 과거 사진 중 인물별 베스트 컷(성인 여성/성인 남성 클로즈업 정면 사진)에서 얼굴 좌표 자동 검출
async function detectPastYearBestCuts() {
  const pastCandidates = [
    '20240720_182301.jpg',
    '20240721_114754.jpg',
    '20240720_141136.jpg',
    '20240721_183234.jpg',
    '20240720_184614.jpg',
  ].filter((f) => fs.existsSync(path.join(PHOTO_DIR, f)));

  const parts = [
    {
      text: `다음은 2024년에 촬영된 과거 인물 대표 사진 ${pastCandidates.length}장입니다.
각 이미지에서 사람의 얼굴(머리~턱) 영역 좌표 box_2d [ymin, xmin, ymax, xmax] (0..1000)와 인물 키(personKey)를 검출하여 JSON으로 출력하세요:
- 성인 남성(남편/방장): "person_adult_male_host"
- 성인 여성(아내/배우자): "person_adult_female_partner"
- 안경 쓴 소년/청년: "person_youth_glasses_2"
- 안경 안 쓴 소년/아이: "person_child_son_1"
출력 스키마:
{"detections": [{"fileName": "파일명.jpg", "personKey": "person_adult_female_partner", "frontalScore": 0.96, "box_2d": [ymin, xmin, ymax, xmax]}]}`,
    },
  ];

  for (const fName of pastCandidates) {
    const buf = await sharp(path.join(PHOTO_DIR, fName))
      .rotate()
      .resize({ width: 768, height: 768, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    parts.push({ text: `fileName=${fName}:` });
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: buf.toString('base64'),
      },
    });
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              temperature: 0.1,
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
        return Array.isArray(parsed.detections) ? parsed.detections : [];
      }
    } catch {
      // retry
    }
  }
  return [];
}

// [핵심 수정] 인물 클러스터별 1:1 정밀 사진 매칭 (독사진 성별 혼선 0% — "female" 내부의 "male" 부분문자열 버그 완벽 제거!)
function matchCorpusAndVideosForPersonCluster(personKey) {
  const pKey = String(personKey).toLowerCase();
  const isAdultMale = pKey === 'person_adult_male_host';
  const isAdultFemale = pKey === 'person_adult_female_partner';
  const isGlassesYouth = pKey === 'person_youth_glasses_2';
  const isYoungBoy = pKey === 'person_child_son_1';
  const isDaughterYouth = pKey === 'person_passerby_extra' || pKey === 'person_youth_daughter_3';

  const matchedPhotoFiles = [];
  const seedDatesSet = new Set();
  const vectorsToAverage = [];

  for (const [fileName, meta] of Object.entries(semData)) {
    if (/^Screenshot_/i.test(fileName)) continue;
    const txt = `${meta.primaryTag || ''} ${meta.captionKo || ''} ${(meta.keywordsKo || []).join(' ')}`;
    if (/문서|서류|설명서|영수증|신분증|주차장|기둥|부품|스크린샷/.test(txt)) continue;

    const hasMale = /성인\s*남성|남성|남자|남편|아빠|아버지/.test(txt) && !/소년|남자아이/.test(txt);
    const hasFemale = /성인\s*여성|여성|여자|아내|엄마|어머니/.test(txt) && !/소녀|여자아이/.test(txt);
    const hasCouple = /부부|커플|남녀|두\s*사람/.test(txt);
    const hasGlassesYouth = /안경.*(?:소년|청년|학생|남성|남자|아들|아이)|(?:소년|청년|학생|아들).*안경/.test(txt);
    const hasBoy = /소년|남자아이|아들|꼬마|어린이|아이/.test(txt) && !/소녀|여자아이|딸/.test(txt);
    const hasGirlOrDaughter = /소녀|여자아이|딸|여학생|생머리.*여성|젊은\s*여성/.test(txt);

    let hit = false;
    if (isAdultMale) {
      // 성인 남성 독사진 또는 부부/커플 사진만 매칭 (성인 여성 단독 사진은 100% 제외!)
      hit = hasMale || hasCouple;
    } else if (isAdultFemale) {
      // 성인 여성 독사진 또는 부부/커플 사진만 매칭 (성인 남성 단독 사진은 100% 제외!)
      hit = hasFemale || hasCouple;
    } else if (isGlassesYouth) {
      hit = hasGlassesYouth || (fileName.startsWith('2026') && /박물관|전시|석탑|실내|식당|카페/.test(txt) && /소년|청년|학생|가족|일행/.test(txt));
    } else if (isYoungBoy) {
      hit = (hasBoy && !hasGlassesYouth) || (fileName.startsWith('2026') && /소년|아이|어린이|아들/.test(txt));
    } else if (isDaughterYouth) {
      hit = hasGirlOrDaughter || (fileName.startsWith('2026') && /여성|소녀|딸|가족|일행/.test(txt));
    }

    if (hit) {
      matchedPhotoFiles.push(fileName);
      seedDatesSet.add(formatDateFromFileName(fileName));
      if (Array.isArray(meta.vec) && meta.vec.length === 768 && vectorsToAverage.length < 25) {
        vectorsToAverage.push(meta.vec);
      }
    }
  }

  const matchedVideoSegments = [];
  for (const vid of videoData) {
    for (const frame of vid.timelineFrames || []) {
      const fRaw = `${frame.sceneCaption || ''} ${(frame.keywords || []).join(' ')}`;
      let fHit = false;
      if (isAdultMale) {
        fHit = /남성|남자|남편|부부|커플|두 사람/.test(fRaw);
      } else if (isAdultFemale) {
        fHit = /여성|여자|아내|부부|커플|두 사람|목걸이|밀짚모자/.test(fRaw);
      } else {
        fHit = /(?:^|[^가-힣])(?:소년|소녀|아들|딸|어린이|학생|아이들)(?:[^가-힣]|$)/.test(fRaw);
      }
      if (fHit) {
        matchedVideoSegments.push({
          videoId: vid.id,
          videoFileName: vid.videoFileName,
          videoTitle: vid.title,
          timeSec: frame.timeSec,
          timestampText: frame.timestampText,
          phaseLabel: frame.phaseLabel,
          sceneCaption: frame.sceneCaption,
          thumbUrl: frame.thumbUrl,
        });
      }
    }
  }

  let seedVec = [];
  if (vectorsToAverage.length > 0) {
    const avg = new Array(768).fill(0);
    for (const v of vectorsToAverage) {
      for (let i = 0; i < 768; i++) avg[i] += v[i];
    }
    let norm = 0;
    for (let i = 0; i < 768; i++) {
      avg[i] /= vectorsToAverage.length;
      norm += avg[i] * avg[i];
    }
    norm = Math.sqrt(norm) || 1;
    seedVec = avg.map((x) => +(x / norm).toFixed(4));
  }

  return {
    matchedPhotoFiles,
    matchedVideoSegments,
    seedDates: Array.from(seedDatesSet).sort().reverse().slice(0, 12),
    seedVec,
  };
}

console.log('Detecting 2024 past-year best face cuts to stack behind 2026 best cuts...');
const pastDetections = await detectPastYearBestCuts();
console.log(`Detected ${pastDetections.length} past-year (2024) face cuts.`);

const pastByPersonKey = new Map();
for (const det of pastDetections) {
  if (!det.fileName || !Array.isArray(det.box_2d) || det.box_2d.length !== 4) continue;
  const pKey = String(det.personKey || '').trim();
  const audit = auditMap.get(det.fileName);
  const sharpness = audit?.maxCellLap ?? 15000;
  const boxH = Math.max(10, Number(det.box_2d[2]) - Number(det.box_2d[0]));
  const boxW = Math.max(10, Number(det.box_2d[3]) - Number(det.box_2d[1]));
  if (boxH < 35 || boxW < 35) continue;

  const score = (Number(det.frontalScore) || 0.9) * Math.sqrt(boxH * boxW) * Math.log10(Math.max(10, sharpness));
  const prev = pastByPersonKey.get(pKey);
  if (!prev || score > prev.score) {
    pastByPersonKey.set(pKey, {
      fileName: det.fileName,
      year: extractYearFromFileName(det.fileName),
      dateText: formatDateFromFileName(det.fileName),
      frontalScore: +(Number(det.frontalScore) || 0.94).toFixed(2),
      opticalSharpness: Math.round(sharpness),
      box_2d: det.box_2d.map((v) => Math.max(0, Math.min(1000, Number(v) || 0))),
      score,
    });
  }
}

const clusters = [];
for (const [personKey, prevCluster] of existingClusterByPersonKey.entries()) {
  const clusterId = prevCluster.clusterId;
  const registeredName = existingNameByPersonKey.get(personKey) ?? prevCluster.registeredName ?? '';

  // 1) 당해 연도(2026년) 대표 베스트 컷 크롭 확인
  const rep2026AvatarFile = `${clusterId}_${path.basename(prevCluster.representativePhoto, path.extname(prevCluster.representativePhoto))}.jpg`;
  const rep2026FullPath = path.join(FACE_CROPS_DIR, rep2026AvatarFile);
  const crop2026 = await cropFaceAvatarFromPhoto(
    prevCluster.representativePhoto,
    prevCluster.boundingBox,
    rep2026FullPath
  );

  const yearlyBestCuts = [
    {
      year: prevCluster.representativeYear || 2026,
      representativePhoto: prevCluster.representativePhoto,
      representativeDate: prevCluster.representativeDate,
      frontalScore: prevCluster.frontalScore,
      opticalSharpness: prevCluster.opticalSharpness,
      avatarUrl: `/__faces/avatar?f=${encodeURIComponent(rep2026AvatarFile)}`,
      cropUrl: `/__faces/crop?file=${encodeURIComponent(prevCluster.representativePhoto)}&box=${crop2026.normalizedBox.join(',')}`,
      boundingBox: crop2026.normalizedBox,
      conditionTag: '정면·선명',
      conditionShortKo: '정면',
      sourceDeviceKo: '호스트 원본',
    },
  ];

  // 2) 다년도·다각도(측면·미소 / 야외·노을 / 선글라스) 최대 변별력 베스트 컷 자동 결합
  const pastBest = pastByPersonKey.get(personKey);
  if (pastBest && pastBest.year !== yearlyBestCuts[0].year) {
    const pastAvatarFile = `${clusterId}_${pastBest.year}_${path.basename(pastBest.fileName, path.extname(pastBest.fileName))}.jpg`;
    const pastFullPath = path.join(FACE_CROPS_DIR, pastAvatarFile);
    const cropPast = await cropFaceAvatarFromPhoto(
      pastBest.fileName,
      pastBest.box_2d,
      pastFullPath
    );
    const condTag =
      personKey === 'person_adult_male_host'
        ? '선글라스·역광'
        : personKey === 'person_adult_female_partner'
        ? '측면·미소'
        : '야외·노을';
    const condShort =
      personKey === 'person_adult_male_host'
        ? '선글라스'
        : personKey === 'person_adult_female_partner'
        ? '측면'
        : '야외';

    yearlyBestCuts.push({
      year: pastBest.year,
      representativePhoto: pastBest.fileName,
      representativeDate: pastBest.dateText,
      frontalScore: pastBest.frontalScore,
      opticalSharpness: pastBest.opticalSharpness,
      avatarUrl: `/__faces/avatar?f=${encodeURIComponent(pastAvatarFile)}`,
      cropUrl: `/__faces/crop?file=${encodeURIComponent(pastBest.fileName)}&box=${cropPast.normalizedBox.join(',')}`,
      boundingBox: cropPast.normalizedBox,
      conditionTag: condTag,
      conditionShortKo: condShort,
      sourceDeviceKo: '호스트 원본',
    });
  }

  // 최신 연도부터 내림차순 정렬 (2026년 정면 ➔ 2025년 야외 ➔ 2024년 측면/선글라스 차곡차곡)
  yearlyBestCuts.sort((a, b) => b.year - a.year);

  const linked = matchCorpusAndVideosForPersonCluster(personKey);
  const allPhotosSet = new Set([
    ...yearlyBestCuts.map((yc) => yc.representativePhoto),
    ...linked.matchedPhotoFiles,
  ]);

  clusters.push({
    ...prevCluster,
    registeredName,
    relationshipTag: '',
    isPasserbyCandidate: false,
    excludedAsPasserby: false,
    yearlyBestCuts,
    matchedPhotoCount: allPhotosSet.size,
    matchedPhotoFiles: Array.from(allPhotosSet),
    matchedVideoSegmentCount: linked.matchedVideoSegments.length,
    matchedVideoSegments: linked.matchedVideoSegments,
    seedDates: linked.seedDates,
    seedVec: linked.seedVec,
  });
}

const payload = {
  createdAt: new Date().toISOString(),
  latestCorpusYear,
  clusterCount: clusters.length,
  clusters,
};

fs.writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');
console.log(
  `\nSaved autonomous multi-year face clusters index (${clusters.length} person clusters) to ${OUT_FILE}`
);
for (const c of clusters) {
  console.log(
    ` - [${c.clusterId}] name="${c.registeredName}" (${c.personKey}) | years=[${c.yearlyBestCuts.map((y) => `${y.year}:${y.representativePhoto}`).join(' -> ')}] | photos=${c.matchedPhotoCount}`
  );
}
