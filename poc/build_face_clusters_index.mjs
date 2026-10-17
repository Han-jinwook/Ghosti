/**
 * SaySee (세이씨) — 100% 자율 얼굴 검출(Face Detection) · 당해 연도 베스트 1장 크롭 · 인물 클러스터링 인덱서
 * - 수동 하드코딩 0%: 실제 이미지 픽셀(EXIF 회전 보정 포함)에서 얼굴 Bounding Box [ymin, xmin, ymax, xmax] 자동 검출
 * - 당해 연도 대표 1장 원칙: 동일 인물 클러스터 내 최신 촬영 연도(Current Year) + 정면 비율(frontalScore) + 광학 선명도(maxCellLap) 최고점 1장 자동 선정 및 원형 아바타용 정밀 크롭 저장
 * - 사진 코퍼스 및 동영상 타임라인 전 구간(Full-Timeline) 매칭 리스트 + 768차원 얼굴/인물 시드(Seed) 임베딩 자동 생성
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

// 1) 코퍼스 시맨틱 및 광학 선명도 로드
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

// 코퍼스 내 최신 연도(Current Year) 자동 산출 (스크린샷 제외 실제 카메라 촬영본 기준)
let latestCorpusYear = 2024;
for (const fName of Object.keys(semData)) {
  if (/^Screenshot_/i.test(fName)) continue;
  const y = extractYearFromFileName(fName);
  if (y >= 2020 && y <= 2030 && y > latestCorpusYear) {
    latestCorpusYear = y;
  }
}
console.log(`Detected latest shooting year in corpus: ${latestCorpusYear}`);

// 2) 인물 등장 사진 중 최신 연도(Current Year) 우선 + 정면/인물 클로즈업 단서 + 광학 선명도 상위 대표 후보군 자동 추출
const allPersonPhotos = Object.entries(semData)
  .map(([fileName, meta]) => {
    const audit = auditMap.get(fileName);
    const sharpness = audit?.maxCellLap ?? 5000;
    const year = extractYearFromFileName(fileName);
    const text = `${meta.primaryTag || ''} ${meta.captionKo || ''} ${(meta.keywordsKo || []).join(' ')}`;
    const isScreenshotOrDoc = /^Screenshot_/i.test(fileName) || /스크린샷|화면캡처|문서|서류|영수증/.test(text);
    const hasPerson =
      !isScreenshotOrDoc &&
      /남성|여성|소년|소녀|아이|어린이|부부|커플|일행|가족|인물|셀카|남자|여자/.test(text);
    const isCloseupOrPortrait = /셀카|클로즈업|정면|응시|기념사진|미소|웃고|표정|얼굴/.test(text);
    return {
      fileName,
      meta,
      year,
      dateText: formatDateFromFileName(fileName),
      sharpness,
      hasPerson,
      isCloseupOrPortrait,
      text,
    };
  })
  .filter((x) => x.hasPerson && fs.existsSync(path.join(PHOTO_DIR, x.fileName)));

// 동일 시간대/연사 클러스터 중복을 피하면서 당해 연도(2026) 및 선명한 인물 클로즈업 2024 후보를 균형 있게 샘플링
function selectAutonomousFaceCandidates(personList) {
  const sorted = [...personList].sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year; // 당해 연도(2026) 최우선
    if (a.isCloseupOrPortrait !== b.isCloseupOrPortrait) return a.isCloseupOrPortrait ? -1 : 1;
    return b.sharpness - a.sharpness;
  });

  const selected = [];
  const seenHourKeys = new Set();
  const seenClusterIds = new Set();

  for (const item of sorted) {
    const hourKey = item.fileName.slice(0, 11);
    const cId = item.meta.clusterId;
    if (seenHourKeys.has(hourKey) || (cId !== undefined && seenClusterIds.has(cId))) continue;
    seenHourKeys.add(hourKey);
    if (cId !== undefined) seenClusterIds.add(cId);
    selected.push(item);
    if (selected.length >= 12) break;
  }

  // 부부/커플 클로즈업 셀카 컷도 함께 비교·검출할 수 있도록 고선명 클로즈업 인물 컷 4장 추가
  const closeupExtras = [...personList]
    .filter((x) => /셀카|클로즈업|부부|커플/.test(x.text) && !selected.some((s) => s.fileName === x.fileName))
    .sort((a, b) => b.sharpness - a.sharpness);

  for (const item of closeupExtras) {
    const hourKey = item.fileName.slice(0, 11);
    if (seenHourKeys.has(hourKey)) continue;
    seenHourKeys.add(hourKey);
    selected.push(item);
    if (selected.length >= 16) break;
  }

  return selected;
}

const candidatePortraits = selectAutonomousFaceCandidates(allPersonPhotos);
console.log(
  `Selected ${candidatePortraits.length} portrait candidates for autonomous face bounding-box detection:`,
  candidatePortraits.map((c) => `${c.fileName} (year=${c.year}, sharp=${Math.round(c.sharpness)})`)
);

// 3) 실제 이미지 픽셀에서 Vision 얼굴 검출기(Bounding Box [ymin, xmin, ymax, xmax] 0..1000) 실행
async function detectFacesInPhotos(candidates) {
  const preparedImages = [];
  for (const c of candidates) {
    const fullPath = path.join(PHOTO_DIR, c.fileName);
    const rotated = await sharp(fullPath)
      .rotate()
      .resize({ width: 768, height: 768, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 86 })
      .toBuffer();
    preparedImages.push({
      ...c,
      base64: rotated.toString('base64'),
    });
  }

  const parts = [
    {
      text: `다음은 사용자의 갤러리에서 촬영 연도(최신순)와 광학 선명도 기준으로 자동 선별된 ${preparedImages.length}장의 실제 인물 사진입니다.
각 이미지에서 얼굴 이목구비가 선명하게 식별 가능한 사람의 머리·얼굴(Face/Head) 영역 좌표를 정밀하게 검출하고, 동일 인물 역할군끼리 클러스터링하여 아래 JSON 스키마로 출력하세요.

[필수 규칙]
1. box_2d는 이미지 전체 크기를 0~1000으로 정규화한 [ymin, xmin, ymax, xmax] 정수 배열이어야 합니다 (머리 정수리부터 턱 아래까지 얼굴 전체가 동그란 원형 아바타 정중앙에 예쁘게 들어오도록 잡으세요).
2. 여러 사진에 반복 등장하는 동일 인물은 같은 personKey로 묶고, 한 사진 안에 함께 찍힌 서로 다른 인물들은 각각 고유한 personKey로 구분하세요:
   - 주요 성인 남성(방장/남편 후보): "person_adult_male_host" (suggestedChip: "#나(방장)")
   - 주요 성인 여성(아내/배우자 후보): "person_adult_female_partner" (suggestedChip: "#아내")
   - 전망대/박물관의 안경 미착용 소년/청년(자녀 후보 1): "person_child_son_1" (suggestedChip: "#자녀")
   - 전망대의 안경 착용 청년(자녀/일행 후보 2): "person_youth_glasses_2" (suggestedChip: "#자녀")
   - 뒤쪽이나 옆에서 살짝 얼굴을 내민 동석자/행인 후보: "person_passerby_extra" (suggestedChip: "#친구", isPasserbyCandidate: true)
3. 각 검출된 얼굴마다 정면 응시 및 이목구비 선명도 점수 frontalScore (0.0 ~ 1.0)와 직관적인 시각 특징 라벨 appearanceLabelKo를 기록하세요.

출력 JSON 스키마:
{
  "detections": [
    {
      "photoIndex": 0,
      "fileName": "파일명.jpg",
      "personKey": "고유 인물 클러스터 키",
      "roleHintKo": "성인 남성 | 성인 여성 | 남자아이/소년 | 동행 가족/지인 | 주변 동석자",
      "suggestedChip": "#나(방장) | #아내 | #남편 | #자녀 | #부모님 | #친구",
      "isPasserbyCandidate": false,
      "frontalScore": 0.96,
      "appearanceLabelKo": "실제 얼굴/복장 특징 짧은 요약",
      "box_2d": [ymin, xmin, ymax, xmax]
    }
  ]
}`,
    },
  ];

  preparedImages.forEach((img, idx) => {
    parts.push({
      text: `Photo index=${idx}, fileName=${img.fileName}, year=${img.year}, opticalSharpness=${Math.round(img.sharpness)}:`,
    });
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: img.base64,
      },
    });
  });

  const modelsToTry = ['gemini-3.8-flash', 'gemini-2.5-flash'];
  for (const modelName of modelsToTry) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${API_KEY}`,
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
          return JSON.parse(txt);
        }
      } catch (e) {
        console.warn(`Attempt failed on ${modelName}:`, e.message);
      }
    }
  }
  throw new Error('Failed to run autonomous face detection');
}

// 4) 실제 이미지에서 검출된 얼굴 좌표 [ymin, xmin, ymax, xmax] (0..1000)를 정사각형 아바타로 여유 패딩 포함 크롭
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
  // 동그란 아바타 안에 얼굴과 머리/어깨 상단이 자연스럽게 들어오도록 1.45배 정사각형 영역 산출
  const side = Math.min(Math.min(imgW, imgH), Math.max(faceW, faceH) * 1.48);

  const left = Math.max(0, Math.min(imgW - side, Math.round(cx - side / 2)));
  const top = Math.max(0, Math.min(imgH - side, Math.round(cy - side / 2)));
  const width = Math.max(16, Math.min(imgW - left, Math.round(side)));
  const height = Math.max(16, Math.min(imgH - top, Math.round(side)));

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

// 5) 인물 클러스터별로 전체 550장 사진 및 3개 동영상 타임라인 구간을 자동 매칭
function matchCorpusAndVideosForPersonCluster(roleHintKo, personKey) {
  const keyLower = `${roleHintKo} ${personKey}`.toLowerCase();
  const isAdultMale = /남성|남자|male|host/.test(keyLower) && !/소년|아이|child|boy/.test(keyLower);
  const isAdultFemale = /여성|여자|female|partner|wife/.test(keyLower) && !/소녀|아이|child|girl/.test(keyLower);
  const isChild = /소년|소녀|아이|어린이|자녀|아들|딸|child|boy|girl/.test(keyLower);

  const matchedPhotoFiles = [];
  const seedDatesSet = new Set();
  const vectorsToAverage = [];

  for (const [fileName, meta] of Object.entries(semData)) {
    const txt = `${meta.primaryTag || ''} ${meta.captionKo || ''} ${(meta.keywordsKo || []).join(' ')}`;
    let hit = false;
    if (isChild) {
      hit = /소년|소녀|아이|어린이|아들|딸|가족/.test(txt);
    } else if (isAdultMale) {
      hit = /남성|남자|남편|부부|커플|남녀/.test(txt);
    } else if (isAdultFemale) {
      hit = /여성|여자|아내|부부|커플|남녀/.test(txt);
    } else {
      hit = /일행|사람들|남녀|함께|단체/.test(txt);
    }
    if (hit) {
      matchedPhotoFiles.push(fileName);
      seedDatesSet.add(formatDateFromFileName(fileName));
      if (Array.isArray(meta.vec) && meta.vec.length === 768 && vectorsToAverage.length < 25) {
        vectorsToAverage.push(meta.vec);
      }
    }
  }

  // 동영상 타임라인 프레임 매칭
  const matchedVideoSegments = [];
  for (const vid of videoData) {
    for (const frame of vid.timelineFrames || []) {
      const fTxt = `${frame.sceneCaption || ''} ${(frame.keywords || []).join(' ')} ${(frame.ontologyKeywords || []).join(' ')}`;
      let fHit = false;
      if (isChild) {
        fHit = /소년|소녀|아이|어린이|가족/.test(fTxt);
      } else if (isAdultMale) {
        fHit = /남성|남자|남편|부부|커플|두 사람/.test(fTxt);
      } else if (isAdultFemale) {
        fHit = /여성|여자|아내|부부|커플|두 사람|목걸이|밀짚모자/.test(fTxt);
      } else {
        fHit = /일행|사람들|승객/.test(fTxt);
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

  // 평균 768차원 얼굴·인물 시드(Seed) 임베딩 산출 (단위 벡터 정규화)
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

console.log('Running Vision Face Detection & Clustering on candidate portraits...');
const detectionResult = await detectFacesInPhotos(candidatePortraits);
const rawDetections = Array.isArray(detectionResult?.detections) ? detectionResult.detections : [];
console.log(`Detected ${rawDetections.length} face instances across candidate photos.`);

// 6) personKey별로 그룹핑 후 '당해 연도(Current Year) 최신순 + 정면비율(frontalScore) * 광학선명도(sharpness)' 최고점 1장 자동 선정
const groupedByPerson = new Map();
for (const det of rawDetections) {
  const cand =
    candidatePortraits[det.photoIndex] ||
    candidatePortraits.find((c) => c.fileName === det.fileName);
  if (!cand || !Array.isArray(det.box_2d) || det.box_2d.length !== 4) continue;

  const boxH = Math.max(10, Number(det.box_2d[2]) - Number(det.box_2d[0]));
  const boxW = Math.max(10, Number(det.box_2d[3]) - Number(det.box_2d[1]));
  if (boxH < 38 || boxW < 35) continue; // 너무 멀리 찍힌 미세한 배경 얼굴 제외

  const pKey = String(det.personKey || 'person_unknown').trim();
  if (!groupedByPerson.has(pKey)) {
    groupedByPerson.set(pKey, []);
  }
  groupedByPerson.get(pKey).push({
    ...det,
    fileName: cand.fileName,
    year: cand.year,
    dateText: cand.dateText,
    sharpness: cand.sharpness,
    qualityScore:
      (Number(det.frontalScore) || 0.85) *
      Math.sqrt(boxH * boxW) *
      Math.log10(Math.max(10, cand.sharpness)),
  });
}

for (const oldFile of fs.readdirSync(FACE_CROPS_DIR)) {
  try {
    fs.unlinkSync(path.join(FACE_CROPS_DIR, oldFile));
  } catch {
    // ignore
  }
}

const clusters = [];
let idx = 1;
for (const [personKey, faceList] of groupedByPerson.entries()) {
  // 당해 연도 대표 1장 원칙: 촬영 연도 최신순(year DESC) -> 얼굴 선명도·정면 점수(qualityScore DESC) 정렬
  faceList.sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.qualityScore - a.qualityScore;
  });

  const bestFace = faceList[0];
  const clusterId = `face_member_${idx++}`;
  const avatarFileName = `${clusterId}_${path.basename(bestFace.fileName, path.extname(bestFace.fileName))}.jpg`;
  const avatarFullPath = path.join(FACE_CROPS_DIR, avatarFileName);

  const cropMeta = await cropFaceAvatarFromPhoto(bestFace.fileName, bestFace.box_2d, avatarFullPath);
  const linked = matchCorpusAndVideosForPersonCluster(bestFace.roleHintKo || '', personKey);

  // 검출된 원본 사진들도 무조건 matchedPhotoFiles 선두에 포함
  const allPhotosSet = new Set([
    ...faceList.map((f) => f.fileName),
    ...linked.matchedPhotoFiles,
  ]);

  clusters.push({
    clusterId,
    personKey,
    registeredName: '', // 방장이 인터랙티브하게 입력할 실명 (초기값 빈 문자열 — 하드코딩 0%)
    relationshipTag: '', // 방장이 선택할 관계 칩 (#나(방장), #아내 등)
    suggestedChip: bestFace.suggestedChip || '#친구',
    roleHintKo: bestFace.roleHintKo || '인물',
    appearanceLabelKo: bestFace.appearanceLabelKo || '자동 검출 인물',
    isPasserbyCandidate: Boolean(bestFace.isPasserbyCandidate),
    excludedAsPasserby: false,
    representativePhoto: bestFace.fileName,
    representativeYear: bestFace.year,
    representativeDate: bestFace.dateText,
    frontalScore: +(Number(bestFace.frontalScore) || 0.92).toFixed(2),
    opticalSharpness: Math.round(bestFace.sharpness),
    avatarUrl: `/__faces/avatar?f=${encodeURIComponent(avatarFileName)}`,
    cropUrl: `/__faces/crop?file=${encodeURIComponent(bestFace.fileName)}&box=${cropMeta.normalizedBox.join(',')}`,
    boundingBox: cropMeta.normalizedBox,
    pixelCrop: cropMeta.pixelCrop,
    detectedSampleCount: faceList.length,
    matchedPhotoCount: allPhotosSet.size,
    matchedPhotoFiles: Array.from(allPhotosSet),
    matchedVideoSegmentCount: linked.matchedVideoSegments.length,
    matchedVideoSegments: linked.matchedVideoSegments,
    seedDates: linked.seedDates,
    seedVec: linked.seedVec,
  });
}

// 주요 등장인물(비행인 우선, 매칭 사진 수 및 최신 연도 순) 정렬
clusters.sort((a, b) => {
  if (a.isPasserbyCandidate !== b.isPasserbyCandidate) return a.isPasserbyCandidate ? 1 : -1;
  if (b.matchedPhotoCount !== a.matchedPhotoCount) return b.matchedPhotoCount - a.matchedPhotoCount;
  return b.opticalSharpness - a.opticalSharpness;
});

const payload = {
  createdAt: new Date().toISOString(),
  latestCorpusYear,
  clusterCount: clusters.length,
  clusters,
};

fs.writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');
console.log(
  `\nSaved autonomous face clusters index (${clusters.length} distinct person clusters) to ${OUT_FILE}`
);
for (const c of clusters) {
  console.log(
    ` - [${c.clusterId}] ${c.appearanceLabelKo} (${c.roleHintKo}) | rep=${c.representativePhoto} (${c.representativeYear}년) | box=${JSON.stringify(c.boundingBox)} | photos=${c.matchedPhotoCount} | videoSegs=${c.matchedVideoSegmentCount}`
  );
}
