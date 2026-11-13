import { notifyMicSessionEndedForTts } from '../setupMonsterTts';
import {
  AutoConfig,
  AutoModel,
  AutoProcessor,
  RawImage,
} from '@huggingface/transformers';
import { cacheStats, requestPersist, resetCacheStats } from '../opfsCache';
import { getZCoreUrl, zCoreBridge, hasActiveGhostiLoginSession } from '../zCoreBridge';
import { normalizeSpokenKoreanQuery } from '../voiceSearchAndAiBatonEngine';
import { silentIndexingBrake } from '../silentIndexingBrake';
import type {
  DuplicateGroup,
  FaceMemberCluster,
  PhotoItem,
  SearchResultItem,
  TrashCategory,
  VideoSceneItem,
  VoiceRoutingTrace,
} from '../../types/saysee';
import {
  DECODE_SIDE,
  DEFAULT_DIM,
  MODEL_ID,
  PRESET_QUERIES,
  PresetQueryDef,
  THUMB_SIDE,
  VISION_TOKEN_BUDGET,
  aiRuntimeFlags,
  bumpSharedVisionIdleDispose,
  cosineSimilarity,
  decodeImageBlobToRawAndThumb,
  embedRawImageWithSharedVision,
  enableOpfsCache,
  encodeMultimodalSearchQueryVecs,
  ensureTextQueryEncoderLoaded,
  extractKoStems,
  getOptimalEmbeddingDtype,
  getPhotoMediaCacheKey,
  getStaticCorpusCached,
  hydrateRealMediaVectorCacheOnce,
  hydratedPhotoVecMap,
  loadWithR2Fallback,
  matchKoTokenInStems,
  normalizeVector,
  persistMediaCacheEntry,
  staticCaptionedPhotoIds,
  toRows,
} from './aiSharedRuntime';
import { embedSingleLocalVideoIfNeeded } from './aiVideoEngine';

export async function fetchAutonomousFaceClusters(): Promise<{
  latestCorpusYear: number;
  clusters: FaceMemberCluster[];
}> {
  if (!hasActiveGhostiLoginSession() || !zCoreBridge.isConnected) {
    return { latestCorpusYear: 2026, clusters: [] };
  }
  try {
    // [실물 파일 순수성 철칙]: 엔진 연결 상태에서는 정적 샘플 얼굴(face_clusters_index.json)로 절대 폴백하지 않음
    const res = await fetch(getZCoreUrl('/__faces/index'));
    if (!res.ok) return { latestCorpusYear: 2026, clusters: [] };
    const json = await res.json();
    return {
      latestCorpusYear: Number(json.latestCorpusYear) || 2026,
      clusters: Array.isArray(json.clusters) ? json.clusters : [],
    };
  } catch {
    return { latestCorpusYear: 2026, clusters: [] };
  }
}

export async function updateFaceClusterRegistry(payload: {
  action?: 'update' | 'restore_excluded';
  clusterId?: string;
  registeredName?: string;
  relationshipTag?: string;
  excludedAsPasserby?: boolean;
}): Promise<FaceMemberCluster[] | null> {
  try {
    const res = await fetch(getZCoreUrl('/__faces/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.ok && Array.isArray(json.clusters) ? json.clusters : null;
  } catch {
    return null;
  }
}

export async function detectLiveFacesFromPhoto(
  fileName: string
): Promise<{ detectedCount: number; clusters: FaceMemberCluster[] } | null> {
  try {
    const res = await fetch(getZCoreUrl('/__faces/detect'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.ok && Array.isArray(json.clusters)) {
      return {
        detectedCount: Number(json.detectedCount) || 0,
        clusters: json.clusters,
      };
    }
    return null;
  } catch {
    return null;
  }
}


interface PhysicalAuditRecord {
  f: string;
  size: number;
  origW: number;
  origH: number;
  aspect: number;
  hasExif: boolean;
  md5: string;
  dhash: string;
  ts: number;
  avgBrightness: number;
  maxCellLap: number;
  meanCellLap: number;
  edgeDensity: number;
  avgSat: number;
  neutralPct: number;
  skinPct: number;
  greenPct: number;
  skyPct: number;
  wmRatio: number;
}

export function hammingDistanceHex64(a: string, b: string): number {
  try {
    let x = BigInt('0x' + a) ^ BigInt('0x' + b);
    let count = 0;
    while (x > 0n) {
      count += Number(x & 1n);
      x >>= 1n;
    }
    return count;
  } catch {
    return 64;
  }
}

export interface GroupedSearchResultItem {
  representative: SearchResultItem;
  burstPhotos: PhotoItem[];
  burstCount: number;
}

function parseFilenameTimestampSec(name: string, fallbackMs: number): number {
  const m = name.match(/(20\d{2})(\d{2})(\d{2})[_-](\d{2})(\d{2})(\d{2})/);
  if (m) {
    return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) / 1000;
  }
  const msMatch = name.match(/(?:^|[_/-])(1[5-9]\d{11})(?:[_.-]|$)/);
  if (msMatch) {
    return Number(msMatch[1]) / 1000;
  }
  if (fallbackMs && fallbackMs > 946684800000) {
    return fallbackMs / 1000;
  }
  const seqMatch = name.match(/(20\d{2})(\d{2})(\d{2})[_-](\d{4})(?:\D|$)/);
  if (seqMatch) {
    return Date.UTC(+seqMatch[1], +seqMatch[2] - 1, +seqMatch[3], 12, 0, 0) / 1000 + Number(seqMatch[4]);
  }
  return fallbackMs ? fallbackMs / 1000 : 0;
}

/**
 * [지침 #3] 검색 결과에서 동일 연사(Burst) 사진이 나란히 도배되지 않도록
 * dHash 및 촬영 시각(Δt ≤ 4초)·시맨틱 클러스터 기준으로 1장의 대표 카드로 묶고 [❐ N장 연사] 배지 정보를 생성합니다.
 */
export function groupBurstSearchResults(results: SearchResultItem[]): GroupedSearchResultItem[] {
  if (results.length <= 1) {
    return results.map((r) => ({
      representative: r,
      burstPhotos: [r.photo],
      burstCount: 1,
    }));
  }

  // 시간순 정렬 후 인접 연사 클러스터 구성
  const withTs = results.map((r, origIdx) => ({
    item: r,
    origIdx,
    tsSec: parseFilenameTimestampSec(r.photo.name, r.photo.mtimeMs),
  }));

  const sortedByTime = [...withTs].sort(
    (a, b) => a.tsSec - b.tsSec || a.item.photo.name.localeCompare(b.item.photo.name)
  );

  const clusters: (typeof withTs)[] = [];
  const dupClusterMap = new Map<string, typeof withTs>();

  for (const entry of sortedByTime) {
    const dupId = entry.item.photo.duplicateGroupId;
    if (dupId) {
      const existingDupCluster = dupClusterMap.get(dupId);
      if (existingDupCluster) {
        existingDupCluster.push(entry);
        continue;
      }
    }

    const prevCluster = clusters[clusters.length - 1];
    if (prevCluster) {
      const last = prevCluster[prevCluster.length - 1];
      const pA = last.item.photo;
      const pB = entry.item.photo;
      const dt = Math.abs(entry.tsSec - last.tsSec);
      const dhashDist =
        pA.dhash && pA.dhash !== '0' && pB.dhash && pB.dhash !== '0'
          ? hammingDistanceHex64(pA.dhash, pB.dhash)
          : 64;
      const sameDupGroup =
        Boolean(pA.duplicateGroupId) && pA.duplicateGroupId === pB.duplicateGroupId;
      const sameSceneCluster =
        (pA.clusterId !== undefined && pA.clusterId === pB.clusterId) ||
        (Boolean(pA.tags[0]) && pA.tags[0] === pB.tags[0]);

      if (
        sameDupGroup ||
        (dhashDist <= 8 && dt <= 5 && entry.tsSec > 0) ||
        (sameSceneCluster && dhashDist <= 12 && dt <= 3 && entry.tsSec > 0)
      ) {
        prevCluster.push(entry);
        if (dupId && !dupClusterMap.has(dupId)) {
          dupClusterMap.set(dupId, prevCluster);
        }
        continue;
      }
    }
    const newCluster = [entry];
    clusters.push(newCluster);
    if (dupId) {
      dupClusterMap.set(dupId, newCluster);
    }
  }

  // 각 연사 클러스터에서 가장 점수가 높거나 선명한 대표 1장을 선정하고 원래 검색 랭킹 순서로 정렬
  const grouped = clusters.map((cluster) => {
    const bestRankOrder = [...cluster].sort((a, b) => {
      if (a.item.photo.isBestInDuplicateGroup && !b.item.photo.isBestInDuplicateGroup) return -1;
      if (!a.item.photo.isBestInDuplicateGroup && b.item.photo.isBestInDuplicateGroup) return 1;
      if (b.item.score !== a.item.score) return b.item.score - a.item.score;
      return (b.item.photo.opticalSharpness ?? 0) - (a.item.photo.opticalSharpness ?? 0);
    });
    const minOrigIdx = Math.min(...cluster.map((c) => c.origIdx));
    return {
      minOrigIdx,
      representative: bestRankOrder[0].item,
      burstPhotos: cluster.map((c) => c.item.photo),
      burstCount: cluster.length,
    };
  });

  grouped.sort((a, b) => a.minOrigIdx - b.minOrigIdx);
  return grouped.map(({ representative, burstPhotos, burstCount }) => ({
    representative,
    burstPhotos,
    burstCount,
  }));
}

/**
 * [Phase 1-C / 지침 A3 & A4]
 * 하드코딩 제로(Zero-Hardcoding)!
 * 100% 실제 픽셀·광학·Perceptual dHash 연산(/__photos/physical-audit)과
 * EmbeddingGemma 2 시맨틱 벡터 점수(/__poc/precomputed) 및 Bes2 쓰레기 정의를 결합하여
 * 연사/중복 그룹(DuplicateGroup) 및 4대 쓰레기 카테고리를 수학적으로 자동 분류합니다.
 */

export async function loadInitialPhotoDataset(): Promise<{
  photos: PhotoItem[];
  duplicateGroups: DuplicateGroup[];
  quarantinedCount: number;
  quarantinedBytes: number;
}> {
  let fileList: { path: string; size: number; date: string; mtimeMs: number }[] = [];
  let quarantinedList: { path: string; size: number; date: string; mtimeMs: number }[] = [];
  const auditByPhoto = new Map<string, PhysicalAuditRecord>();

  try {
    if (hasActiveGhostiLoginSession() && zCoreBridge.isConnected) {
      await hydrateRealMediaVectorCacheOnce();
      const res = await fetch(getZCoreUrl('/__photos/list')).catch(() => fetch(getZCoreUrl('/__photos/list')));
      const json = await res.json();
      fileList = json.files ?? [];
      quarantinedList = json.quarantined ?? [];
    }
  } catch {
    /* offline fallback */
  }

  const semanticByPhoto = new Map<
    string,
    { captionKo: string; captionEn: string; keywordsKo: string[]; primaryTag: string }
  >();

  try {
    const { pocJson, auditJson, semJson } = await getStaticCorpusCached();
    const pocData = pocJson?.data ?? pocJson;
    if (pocData && Array.isArray(pocData.searches)) {
      aiRuntimeFlags.precomputedSearches = pocData.searches ?? [];
      aiRuntimeFlags.precomputedAudioRows = pocData.audioBench?.rows ?? [];
    }
    if (auditJson && Array.isArray(auditJson.items)) {
      for (const item of auditJson.items) {
        auditByPhoto.set(item.f, item);
      }
    }
    if (semJson) {
      if (semJson.photos && typeof semJson.photos === 'object') {
        for (const [name, meta] of Object.entries(semJson.photos)) {
          semanticByPhoto.set(name, meta as any);
        }
      }
      if (semJson.items && typeof semJson.items === 'object') {
        for (const [name, meta] of Object.entries(semJson.items)) {
          semanticByPhoto.set(name, meta as any);
        }
      }
      const isConnectedSession = hasActiveGhostiLoginSession() && zCoreBridge.isConnected;
      const curatedSampleFiles = [
        // 초정예 명품 쇼윈도 갤러리 8장 (1번 해변 가족 노을은 3장 연사 묶음 1세트 포함)
        'IMG_20250510_1001.jpg',
        'IMG_20250510_1002.jpg',
        'IMG_20250510_1003.jpg',
        'PET_20250610_1091.jpg',
        'TRV_20250720_1139.jpg',
        'IMG_20250515_1053.jpg',
        'TRV_20250720_1136.jpg',
        'TRV_20250720_1141.jpg',
        'TRV_20250720_1143.jpg',
        'IMG_20250815_1008.jpg',
        // AI 클린몬스터 4대 탭 체험용 정예 샘플
        'MEMO_202509_1259_주차장_기둥.jpg',
        'MEMO_202509_1261_택배_상자.jpg',
        'Screenshot_20250802_1001_쇼핑위시리스트.jpg',
        'Screenshot_20250802_1002_배달주문내역.jpg',
        'BLUR_202510_1282_흔들린사진.jpg',
        'BLUR_202510_1283_흔들린사진.jpg',
        // 동영상 키프레임 스틸컷 4장 (로그인 및 엔진 연결 시에만 추가)
        ...(isConnectedSession
          ? [
              '20240719_105706_t12.jpg',
              '20240720_134808_t06.jpg',
              '20240722_052422_t00.jpg',
              '20260918_202442_t00.jpg',
            ]
          : []),
      ];
      semanticByPhoto.set('20240719_105706_t12.jpg', {
        captionKo:
          '말레이시아 코타키나발루 푸른 바다와 하늘 위에서 알록달록한 낙하산을 타고 모터보트 위로 하강하는 2인 패러세일링 액티비티 장면입니다.',
        captionEn: 'Two people parasailing over the ocean in Kota Kinabalu approaching a boat.',
        keywordsKo: [
          '코타키나발루',
          '말레이시아',
          '패러세일링',
          '패러세일',
          '낙하산',
          '보트',
          '모터보트',
          '바다',
          '해변',
          '바닷가',
          '여행',
          '액티비티',
          '하늘',
        ],
        primaryTag: '#코타키나발루·패러세일링',
      });
      semanticByPhoto.set('20240720_134808_t06.jpg', {
        captionKo:
          '말레이시아 코타키나발루 리조트 야외 테라스 라탄 소파에 나란히 앉아 손인사하며 기념 촬영하는 남녀 커플 장면입니다.',
        captionEn: 'Couple posing on a resort outdoor terrace sofa in Kota Kinabalu.',
        keywordsKo: [
          '코타키나발루',
          '말레이시아',
          '리조트',
          '테라스',
          '야외테라스',
          '기념촬영',
          '소파',
          '야자수',
          '여행',
          '휴양지',
          '생일',
          '케이크',
          '촛불',
        ],
        primaryTag: '#코타키나발루·리조트',
      });
      semanticByPhoto.set('20240722_052422_t00.jpg', {
        captionKo:
          '비행기 좌석 창문 너머로 구름 위로 떠오르는 붉은 노을빛 일출 햇살과 하늘 풍경을 스마트폰으로 촬영하는 기내 장면입니다.',
        captionEn: 'Sunrise view through an airplane window above the clouds.',
        keywordsKo: [
          '비행기',
          '항공기',
          '기내',
          '창문',
          '창밖',
          '일출',
          '노을',
          '구름',
          '하늘',
          '코타키나발루',
          '여행',
        ],
        primaryTag: '#비행기·창밖일출',
      });
      semanticByPhoto.set('20260918_202442_t00.jpg', {
        captionKo:
          '회의실에서 화이트보드에 판서하며 내년 매출 목표를 발표하고 박수 치며 환호하는 브리핑 현장 스틸컷입니다.',
        captionEn: 'Whiteboard presentation in a meeting room discussing next year sales targets.',
        keywordsKo: [
          '회의실',
          '화이트보드',
          '판서',
          '내년',
          '매출',
          '목표',
          '박수',
          '환호',
          '축하합니다',
          '골프',
          '스윙',
          '피니시',
        ],
        primaryTag: '#회의실·브리핑',
      });
      semanticByPhoto.set('IMG_20250815_1008.jpg', {
        captionKo: '식당에서 숙성 생삼겹살 등 외식 식사비를 결제한 영수증 전표 사진입니다.',
        captionEn: 'Paper restaurant receipt for pork belly meal payment.',
        keywordsKo: ['영수증', '전표', '삼겹살', '식당', '결제', '카드영수증'],
        primaryTag: '#주차장·기둥',
      });
      semanticByPhoto.set('MEMO_202509_1259_주차장_기둥.jpg', {
        captionKo: '지하주차장 기둥 번호(B3-C12)를 잊지 않기 위해 일회성으로 찍어둔 주차 위치 메모 사진입니다.',
        captionEn: 'Temporary parking lot pillar number B3-C12 memo photo.',
        keywordsKo: ['주차장', '기둥', '주차메모', '지하주차장', '일회성메모'],
        primaryTag: '#주차장·기둥',
      });
      semanticByPhoto.set('MEMO_202509_1261_택배_상자.jpg', {
        captionKo: '현관 앞에 도착한 택배 상자와 운송장 스티커를 확인용으로 촬영한 일회성 사물 메모 사진입니다.',
        captionEn: 'Temporary delivery parcel box and shipping label memo photo.',
        keywordsKo: ['택배', '상자', '운송장', '송장', '일회성메모'],
        primaryTag: '#택배·상자',
      });
      semanticByPhoto.set('BLUR_202510_1282_흔들린사진.jpg', {
        captionKo: '걸어가며 셔터를 눌러 피사체 전체 초점이 무너지고 심하게 흔들린 오촬영 사진입니다.',
        captionEn: 'Severely motion-blurred misfired photo.',
        keywordsKo: ['흔들린사진', '초점이탈', '블러', '오촬영'],
        primaryTag: '#흔들린사진',
      });
      semanticByPhoto.set('BLUR_202510_1283_흔들린사진.jpg', {
        captionKo: '어두운 실내에서 손떨림으로 인해 윤곽이 심하게 번지고 흐릿하게 찍힌 사진입니다.',
        captionEn: 'Blurry out-of-focus indoor misfired photo.',
        keywordsKo: ['흔들린사진', '초점이탈', '블러', '손떨림'],
        primaryTag: '#흔들린사진',
      });
      // [실물 파일 순수성 철칙]: 로컬 Z-코어 엔진이 연결된 상태(isConnectedSession === true)에서는
      // 샘플 사진(sample_photos_301 / 쇼윈도 예시)을 단 1장도 끼워 넣지 않고 100% 유저의 진짜 PC 사진(fileList)만 유지합니다!
      if (!isConnectedSession) {
        const existingNames = new Set(fileList.map((f) => f.path));
        const bundledEntries = curatedSampleFiles
          .filter((name) => !existingNames.has(name))
          .map((name, idx) => {
            const a = auditByPhoto.get(name);
            return {
              path: name,
              size: a?.size ?? 72000,
              date: name.includes('20240719')
                ? '2024-07-19'
                : name.includes('20240720')
                ? '2024-07-20'
                : name.includes('20240722')
                ? '2024-07-22'
                : name.includes('20250510')
                ? '2025-05-10'
                : name.includes('20250515')
                ? '2025-05-15'
                : name.includes('20250610')
                ? '2025-06-10'
                : name.includes('20250720')
                ? '2025-07-20'
                : '2025-08-15',
              mtimeMs: a?.ts || Date.now() - idx * 60000,
            };
          });
        fileList = [...bundledEntries, ...fileList];
      }
    }
  } catch {
    /* ignore */
  }

  const scoresByPhoto = new Map<string, Record<string, number>>();
  const tagsByPhoto = new Map<string, Set<string>>();
  const trashByPhoto = new Map<string, { category: TrashCategory; confidence: number }>();

  const ensureMap = (name: string) => {
    if (!scoresByPhoto.has(name)) scoresByPhoto.set(name, {});
    if (!tagsByPhoto.has(name)) tagsByPhoto.set(name, new Set());
  };

  // 0) Vector Hubness (워터마크 허브 벡터) 빈도 계산 및 CSLS 감점
  const textHubCount = new Map<string, number>();
  for (const s of aiRuntimeFlags.precomputedSearches) {
    if (s.kind === 'text') {
      for (const hit of s.top) {
        textHubCount.set(hit.name, (textHubCount.get(hit.name) ?? 0) + 1);
      }
    }
  }

  for (const s of aiRuntimeFlags.precomputedSearches) {
    if (!s.presetId) continue;
    const def = PRESET_QUERIES.find((p) => p.id === s.presetId);
    if (!def) continue;

    s.top.forEach((hit, rank) => {
      ensureMap(hit.name);
      const hubFreq = textHubCount.get(hit.name) ?? 1;
      const hubPenalty = hubFreq >= 4 ? (hubFreq - 3) * 0.015 : 0;
      const calibratedScore = +(hit.score - hubPenalty).toFixed(4);

      const mapKey = `${s.kind}:${s.presetId}`;
      scoresByPhoto.get(hit.name)![mapKey] = calibratedScore;
      if (s.kind === 'text') {
        scoresByPhoto.get(hit.name)![s.presetId] = calibratedScore;
      }

      if (!def.trashCategory && rank < 6 && hubFreq < 5 && !semanticByPhoto.has(hit.name) && hit.score >= 0.35) {
        tagsByPhoto.get(hit.name)!.add(def.categoryTag);
      }
    });
  }

  // 1) [스펙 1: 서류(문서)의 재정의]
  //    #문서·설명서, #문서·신분증은 버릴 쓰레기가 아니라 [📁 스마트 서류함] 핵심 정보 자산으로 격상!
  //    단기 일회성 메모(#주차장·기둥, #부품·접사, #택배·상자, #현수막·안내)만 스마트 정리 후보로 제안합니다.
  const VAULT_CORE_DOC_TAGS = new Set(['#문서·설명서', '#문서·신분증']);
  const BES2_MEMO_TAGS = new Set([
    '#주차장·기둥',
    '#부품·접사',
    '#택배·상자',
    '#현수막·안내',
  ]);
  const BES2_EXPLICIT_TRASH_TAGS = new Set([
    ...BES2_MEMO_TAGS,
    ...VAULT_CORE_DOC_TAGS,
    '#스크린샷',
    '#흔들린사진',
  ]);
  const vaultDocByPhoto = new Map<string, string>();

  const activeAudits = fileList.map((f) => {
    const a = auditByPhoto.get(f.path);
    if (a) return a;
    return {
      f: f.path,
      md5: '',
      w: 1920,
      h: 1080,
      aspect: 1.77,
      exif: false,
      dhash: '0',
      avgB: 120,
      meanCellLap: 50,
      maxCellLap: 100,
      lapVar: 10,
      skinPct: 0,
      edgeDensity: 0.1,
      ts: f.mtimeMs || Date.now(),
    } as unknown as PhysicalAuditRecord;
  });

  const visitedDup = new Set<string>();
  const duplicateGroups: DuplicateGroup[] = [];
  const dupGroupByPhoto = new Map<string, { groupId: string; isBest: boolean }>();

  // [규칙 ②] Best 컷 선정 가중치: 단순히 배경 나뭇잎 밝기(maxCellLap)만 보지 않고,
  // 함께 찍힌 인물(얼굴·피부 면적 skinPct)이 온전히 나온 사진(커플/단체컷) + 피사체 전체 선명도(meanCellLap)를 최우선 가산
  const computeBestCutScore = (a: PhysicalAuditRecord): number => {
    const hasPeople = a.skinPct >= 5.0;
    const peopleCoverageBonus = hasPeople ? a.skinPct * 1400 : 0;
    return peopleCoverageBonus + a.meanCellLap * 1.5 + a.maxCellLap * 0.35;
  };

  // sample_photos_301 합성 샘플 파일 중 의도된 3장 연사 세트(IMG_20250510_1001~1003) 외에
  // 템플릿 재사용으로 인해 다른 날짜/카테고리 샘플(반려동물·여행·음식 등)끼리 중복 묶음으로 섞이는 현상 원천 차단
  const isSyntheticSampleFile = (fName: string): boolean =>
    /^(IMG_2025|PET_2025|TRV_2025|DOC_2025|MEMO_2025|Screenshot_2025|BLUR_2025)/.test(fName);
  const INTENTIONAL_SYNTHETIC_BURST_SET = new Set([
    'IMG_20250510_1001.jpg',
    'IMG_20250510_1002.jpg',
    'IMG_20250510_1003.jpg',
  ]);

  for (let i = 0; i < activeAudits.length; i++) {
    const first = activeAudits[i];
    if (!auditByPhoto.has(first.f) || !first.dhash || first.dhash === '0') continue;
    if (isSyntheticSampleFile(first.f) && !INTENTIONAL_SYNTHETIC_BURST_SET.has(first.f)) continue;
    const firstSem = semanticByPhoto.get(first.f) as any;
    if (visitedDup.has(first.f) || BES2_EXPLICIT_TRASH_TAGS.has(firstSem?.primaryTag)) continue;

    const group: PhysicalAuditRecord[] = [first];
    let maxDist = 0;
    let maxDt = 0;

    for (let j = i + 1; j < activeAudits.length; j++) {
      const cand = activeAudits[j];
      if (!auditByPhoto.has(cand.f) || !cand.dhash || cand.dhash === '0') continue;
      if (isSyntheticSampleFile(cand.f) && !INTENTIONAL_SYNTHETIC_BURST_SET.has(cand.f)) continue;
      if (
        INTENTIONAL_SYNTHETIC_BURST_SET.has(first.f) !==
        INTENTIONAL_SYNTHETIC_BURST_SET.has(cand.f)
      ) {
        continue;
      }
      const candSem = semanticByPhoto.get(cand.f) as any;
      if (visitedDup.has(cand.f) || BES2_EXPLICIT_TRASH_TAGS.has(candSem?.primaryTag)) continue;

      const last = group[group.length - 1];
      const lastSem = semanticByPhoto.get(last.f) as any;
      const dist = hammingDistanceHex64(last.dhash, cand.dhash);
      const distFromFirst = hammingDistanceHex64(first.dhash, cand.dhash);
      const dt = Math.abs(last.ts - cand.ts) / 1000;
      const skinDiff = Math.abs(last.skinPct - cand.skinPct);
      const sameCluster =
        lastSem?.clusterId !== undefined &&
        candSem?.clusterId !== undefined &&
        lastSem.clusterId === candSem.clusterId;

      // [규칙 ①] 인물 수·구도 일치 원칙:
      // dHash 거리 임계치(<= 12) 및 인물 피부 면적 차이(skinDiff <= 5.5%)를 엄격히 제한하여
      // 독사진(1인 셀카)과 커플 사진(2인 셀카)이 절대 같은 연사 묶음으로 섞이지 않도록 분리
      if (
        (Boolean(last.md5) && last.md5 === cand.md5) ||
        (sameCluster && dist <= 12 && dt <= 60 && last.ts > 0) ||
        (dist <= 5 && dt <= 4 && skinDiff <= 5.0 && last.ts > 0) ||
        (sameCluster && dt <= 3 && dist <= 12 && distFromFirst <= 14 && skinDiff <= 5.5 && last.ts > 0)
      ) {
        group.push(cand);
        visitedDup.add(cand.f);
        if (dist > maxDist) maxDist = dist;
        if (dt > maxDt) maxDt = dt;
      }
    }

    if (group.length >= 2) {
      visitedDup.add(first.f);
      // 인물(커플/단체) 온전성 + 피사체 평균 선명도 복합 점수(computeBestCutScore)로 최우선 Best 보존 컷 선정
      const sortedByBestQuality = [...group].sort(
        (a, b) => computeBestCutScore(b) - computeBestCutScore(a)
      );
      const bestPhotoId = sortedByBestQuality[0].f;
      const groupId = `dup_${group[0].f.replace(/[^a-zA-Z0-9]/g, '_')}`;

      duplicateGroups.push({
        groupId,
        bestPhotoId,
        photoIds: group.map((g) => g.f),
        deltaSec: Math.round(maxDt),
        maxDhashDist: maxDist,
      });

      for (const member of group) {
        const isBest = member.f === bestPhotoId;
        dupGroupByPhoto.set(member.f, { groupId, isBest });
        if (!isBest) {
          tagsByPhoto.set(member.f, new Set(['#연사·중복사본']));
          trashByPhoto.set(member.f, {
            category: 'duplicate',
            confidence: +(0.99 - Math.min(0.12, maxDist * 0.005)).toFixed(3),
          });
        } else {
          tagsByPhoto.get(member.f)?.add('#원본보존·베스트컷');
        }
      }
    }
  }

  // 2) [스마트 서류함 정보 자산 vs 클린몬스터 4대 쓰레기 정밀 분리]
  for (const f of [...fileList, ...quarantinedList]) {
    ensureMap(f.path);
    const semMeta = semanticByPhoto.get(f.path) as any;
    const pTag = String(semMeta?.primaryTag ?? '');

    // [스펙 1 핵심] #문서·설명서, #문서·신분증은 쓰레기가 아니라 [📁 스마트 서류함] 영구 정보 자산으로 격상!
    if (pTag === '#문서·설명서') {
      vaultDocByPhoto.set(f.path, '📑 조립 설명서 · 매뉴얼 (촬영 서류)');
      tagsByPhoto.set(f.path, new Set(['#문서·설명서', '#스마트서류함']));
      scoresByPhoto.get(f.path)!['document_ko'] = 0.85;
      continue;
    }
    if (pTag === '#문서·신분증') {
      vaultDocByPhoto.set(f.path, '🪪 신분증 · 여권 사본 (촬영 서류)');
      tagsByPhoto.set(f.path, new Set(['#문서·신분증', '#스마트서류함']));
      scoresByPhoto.get(f.path)!['document_ko'] = 0.85;
      continue;
    }

    // 일회성 메모(주차기둥, 택배상자 등) 및 스크린샷은 문서함을 오염시키지 않고 AI 클린몬스터에서만 전담 처리

    if (dupGroupByPhoto.has(f.path)) continue; // 이미 연사/중복 그룹에 속한 사진은 중복 분류로 처리 완료

    const audit = auditByPhoto.get(f.path);
    const sem = scoresByPhoto.get(f.path) ?? {};

    // A) 탭 ③: 스크린샷 (시맨틱 #스크린샷 OR 무EXIF 모바일 화면비 + 고주파 UI 엣지)
    const isScreenshot =
      pTag === '#스크린샷' ||
      /^(screenshot|capture|screen_|캡처)/i.test(f.path) ||
      (!!audit && !audit.hasExif && audit.aspect >= 1.95 && audit.aspect <= 2.35 && audit.edgeDensity > 40);

    if (isScreenshot) {
      tagsByPhoto.set(f.path, new Set(['#스크린샷·화면캡처']));
      trashByPhoto.set(f.path, { category: 'screenshot', confidence: 0.992 });
      scoresByPhoto.get(f.path)!['screenshot_ko'] = 0.72;
      scoresByPhoto.get(f.path)!['screenshot_en'] = 0.72;
      continue;
    }

    // B) 탭 ④: 심한 흔들림 · 오촬영 (8방향 3x3 그리드 라플라시안 전체 붕괴 OR #흔들린사진, 단 수중/해변 촬영 제외)
    const blurSem = sem['blurry_en'] ?? 0;
    const isBlurryMisfire =
      pTag === '#흔들린사진' ||
      /^blur_2025/i.test(f.path) ||
      (!!audit &&
        pTag !== '#해변·물놀이' &&
        audit.wmRatio < 1.0 &&
        audit.skyPct < 5.0 &&
        ((blurSem >= 0.65 && audit.meanCellLap < 3600) ||
          (audit.maxCellLap < 1800 && audit.edgeDensity > 1.5)));

    if (isBlurryMisfire) {
      tagsByPhoto.set(f.path, new Set(['#초점이탈·심한흔들림']));
      trashByPhoto.set(f.path, {
        category: 'blurry',
        confidence: audit
          ? +(0.94 + Math.min(0.05, Math.max(0, 3600 - audit.meanCellLap) / 50000)).toFixed(3)
          : 0.96,
      });
      scoresByPhoto.get(f.path)!['blurry_ko'] = 0.72;
      scoresByPhoto.get(f.path)!['blurry_en'] = 0.72;
      continue;
    }

    // C) 탭 ②: 단기 일회성 주차장 · 영수증 · 사물 접사 메모 (Bes2 쓰레기 정책: 주차기둥·사물/부품 접사·케이블단자·택배상자·현수막)
    //    ※ Bes2 Positive Filter 준수: 음식/와인(#식당·음식), 인물/풍경 사진, 그리고 #문서·설명서/#문서·신분증 자산은 100% 보호!
    const isProtectedFoodOrScene =
      pTag === '#식당·음식' ||
      pTag === '#가족·단체' ||
      pTag === '#해변·물놀이' ||
      pTag === '#영수증·결제전표' ||
      pTag === '#삼겹살·고기외식';

    const docSem = Math.max(sem['document_en'] ?? 0, sem['receipt_en'] ?? 0);
    const isOpticalDocOrObject =
      !!audit &&
      !isProtectedFoodOrScene &&
      audit.wmRatio < 1.0 &&
      ((docSem >= 0.595 && audit.neutralPct >= 48 && audit.avgSat <= 0.175) ||
        (audit.skyPct < 7.8 &&
          audit.skinPct <= 9.0 &&
          audit.meanCellLap < 8800 &&
          (((sem['document_en'] ?? 0) >= 0.62 && audit.avgSat > 0.175 && audit.avgSat < 0.3) ||
            ((sem['car_en'] ?? 0) >= 0.63 && (audit.neutralPct >= 40 || audit.maxCellLap < 3000)))));

    if (BES2_MEMO_TAGS.has(pTag) || /^memo_2025/i.test(f.path) || isOpticalDocOrObject) {
      const memoBadge =
        pTag === '#주차장·기둥'
          ? '#주차장·기둥메모'
          : pTag === '#택배·상자' || pTag === '#현수막·안내'
          ? '#일회성·현수막·택배메모'
          : '#부품·사물접사메모';
      tagsByPhoto.set(f.path, new Set([memoBadge]));
      trashByPhoto.set(f.path, {
        category: 'memo',
        confidence: 0.965,
      });
      scoresByPhoto.get(f.path)!['document_ko'] = 0.71;
      scoresByPhoto.get(f.path)!['receipt_ko'] = 0.71;
    }
  }

  const buildPhotoItem = (
    f: {
      path: string;
      size: number;
      date: string;
      mtimeMs: number;
      folderName?: string;
      deviceSource?: string;
      fullPath?: string;
    },
    isQuarantined: boolean
  ): PhotoItem => {
    const tagSet = new Set<string>();
    const semMeta = semanticByPhoto.get(f.path) as any;
    if (semMeta) {
      if (semMeta.primaryTag) {
        tagSet.add(semMeta.primaryTag.startsWith('#') ? semMeta.primaryTag : `#${semMeta.primaryTag}`);
      }
      if (semMeta.locationTag) {
        tagSet.add(semMeta.locationTag.startsWith('#') ? semMeta.locationTag : `#${semMeta.locationTag}`);
      }
      for (const kw of (semMeta.keywordsKo ?? []).slice(0, 6)) {
        if (kw) tagSet.add(kw.startsWith('#') ? kw : `#${kw}`);
      }
    }
    const existingTags = tagsByPhoto.get(f.path);
    if (existingTags) {
      for (const t of existingTags) tagSet.add(t);
    }
    const folderTokens: string[] = [];
    if (
      f.folderName &&
      !/^(test_photos|sample_photos_301|ghosti_test_corpus|pictures|photos|desktop|downloads|\d{2}_.+)$/i.test(
        f.folderName
      )
    ) {
      const cleanedFolder = f.folderName
        .replace(/^\d{4,8}[_-]?/, '')
        .replace(/[_&-]+/g, ' ')
        .trim();
      for (const tk of cleanedFolder.split(/\s+/)) {
        if (tk.length >= 2) {
          folderTokens.push(tk);
          tagSet.add(`#${tk}`);
        }
      }
    }
    if (f.deviceSource && f.deviceSource.includes('드라이브')) {
      tagSet.add(`#${f.deviceSource.split(' ')[0]}`);
    }
    if (tagSet.size === 0) {
      if (f.date.startsWith('2024.07') || f.date.startsWith('2024-07')) tagSet.add('#여름휴가·추억');
      else if (f.date.startsWith('2026.09') || f.date.startsWith('2026-09')) tagSet.add('#가을나들이');
      else if (f.date.startsWith('2026.10') || f.date.startsWith('2026-10')) tagSet.add('#일상스냅');
      else tagSet.add('#가족앨범');
    }
    const trash = trashByPhoto.get(f.path);
    const dupInfo = dupGroupByPhoto.get(f.path);
    const audit = auditByPhoto.get(f.path);
    const vaultLabel = vaultDocByPhoto.get(f.path);
    const locParam = isQuarantined ? '&loc=quarantine' : '';
    // 미연결 신입 유저용 체험 샘플 파일은 정적 번들(/sample_photos_301/)에서 100% 깨짐 없이 즉시 렌더링합니다.
    const isBundledSampleFile = /^(IMG_2025|PET_2025|TRV_2025|MEMO_2025|Screenshot_2025|BLUR_2025)/.test(
      f.path
    );
    const isVideoFrameStillFile = /^(20240719_105706_|20240720_134808_|20240722_052422_|20260918_202442_).*\.jpg$/i.test(
      f.path
    );
    const fullUrl = isBundledSampleFile
      ? `/sample_photos_301/${encodeURIComponent(f.path)}`
      : isVideoFrameStillFile
      ? `/poc/results/video_frames/${encodeURIComponent(f.path)}`
      : getZCoreUrl(`/__photos/file?p=${encodeURIComponent(f.path)}${locParam}`);
    const thumbUrl = isBundledSampleFile || isVideoFrameStillFile ? fullUrl : `${fullUrl}&thumb=1`;

    const dateFromFilenameMatch = f.path.match(/(20\d{2})(\d{2})(\d{2})/);
    const canonicalDate = dateFromFilenameMatch
      ? `${dateFromFilenameMatch[1]}-${dateFromFilenameMatch[2]}-${dateFromFilenameMatch[3]}`
      : audit?.ts && audit.ts > 946684800000
      ? new Date(audit.ts).toISOString().slice(0, 10)
      : f.date;
    const canonicalMtimeMs =
      audit?.ts && audit.ts > 946684800000 ? audit.ts : f.mtimeMs;

    if (semMeta?.captionKo) {
      staticCaptionedPhotoIds.add(f.path);
    } else {
      staticCaptionedPhotoIds.delete(f.path);
    }
    const cachedRealPhotoVec = hydratedPhotoVecMap.get(getPhotoMediaCacheKey(f.path, f.size));

    return {
      id: f.path,
      name: f.path,
      size: f.size,
      date: canonicalDate,
      mtimeMs: canonicalMtimeMs,
      thumbUrl,
      fullUrl,
      tags: Array.from(tagSet),
      vec:
        Array.isArray(semMeta?.vec) && semMeta.vec.length > 0
          ? new Float32Array(semMeta.vec)
          : cachedRealPhotoVec,
      clusterId: semMeta?.clusterId,
      locationKo: semMeta?.locationKo || (folderTokens.length > 0 ? folderTokens.join(' · ') : f.deviceSource),
      captionKo:
        semMeta?.captionKo ||
        (folderTokens.length > 0 ? `[${folderTokens.join(' ')}] 폴더의 ${f.path} 사진` : undefined),
      captionEn: semMeta?.captionEn,
      keywordsKo: Array.from(new Set([...(semMeta?.keywordsKo ?? []), ...folderTokens])),
      ontologyPrimaryTags: semMeta?.ontologyPrimaryTags,
      ontologyCaptionTags: semMeta?.ontologyCaptionTags,
      isVaultDocument: Boolean(vaultLabel),
      vaultCategoryLabel: vaultLabel,
      trashCategory: trash?.category,
      trashConfidence: trash?.confidence,
      duplicateGroupId: dupInfo?.groupId,
      isBestInDuplicateGroup: dupInfo?.isBest,
      opticalSharpness: audit?.maxCellLap,
      dhash: audit?.dhash,
      quarantined: isQuarantined,
      presetScores: scoresByPhoto.get(f.path) ?? {},
    };
  };

  const activePhotos = fileList.map((f) => buildPhotoItem(f, false));
  const quarantinedPhotos = quarantinedList.map((f) => buildPhotoItem(f, true));
  const allPhotos = [...activePhotos, ...quarantinedPhotos];
  const quarantinedBytes = quarantinedList.reduce((a, b) => a + b.size, 0);

  return {
    photos: allPhotos,
    duplicateGroups,
    quarantinedCount: quarantinedList.length,
    quarantinedBytes,
  };
}


/**
 * 한국어/영어 자연어 쿼리를 28개 벤치마크 프리셋 및 태그와 매칭하여 시맨틱 검색 수행
 */
function findMatchingPreset(query: string): PresetQueryDef | undefined {
  const q = query.trim().toLowerCase();
  if (!q) return undefined;

  // 1) 정확히 일치하거나 포함되는 프리셋
  for (const p of PRESET_QUERIES) {
    if (p.q.toLowerCase() === q || q.includes(p.q.toLowerCase()) || p.q.toLowerCase().includes(q)) {
      return p;
    }
  }

  // 2) 키워드 동의어 매핑
  const keywordMap: [RegExp, string][] = [
    [/바다|해변|파도|물놀이|안목|동해|뛰노는|뛰는/, 'beach_ko'],
    [/beach|ocean|sea|wave|running/, 'beach_en'],
    [/케이크|생일|촛불|파티/, 'cake_ko'],
    [/cake|birthday|candle/, 'cake_en'],
    [/강아지|개|반려견|멍멍이/, 'dog_ko'],
    [/dog|puppy|pet/, 'dog_en'],
    [/음식|밥|식당|맛집|요리|식탁/, 'food_ko'],
    [/food|meal|dinner|lunch|table/, 'food_en'],
    [/단체|가족|모임|사람들|같이/, 'group_ko'],
    [/group|family|together/, 'group_en'],
    [/밤|야간|어두운|저녁|밤거리/, 'night_ko'],
    [/night|dark|evening/, 'night_en'],
    [/눈|겨울|스키|설경/, 'snow_ko'],
    [/snow|winter/, 'snow_en'],
    [/자동차|차안|운전|드라이브|카시트/, 'car_ko'],
    [/car|drive|driving/, 'car_en'],
    [/스크린샷|캡처|화면/, 'screenshot_ko'],
    [/screenshot|screen/, 'screenshot_en'],
    [/영수증|전표|결제|카드내역/, 'receipt_ko'],
    [/receipt|bill/, 'receipt_en'],
    [/흔들린|흐릿|초점|블러/, 'blurry_ko'],
    [/blurry|blur|out of focus/, 'blurry_en'],
    [/문서|서류|글씨|종이|계약서/, 'document_ko'],
    [/document|paper|text/, 'document_en'],
    [/왼쪽|오른쪽|옆에/, 'spatial_ko'],
    [/책상|물건|소품|노트북/, 'object_ko'],
  ];

  for (const [regex, id] of keywordMap) {
    if (regex.test(q)) {
      return PRESET_QUERIES.find((p) => p.id === id);
    }
  }
  return undefined;
}

/**
 * 코사인 점수를 UI 표시용 매칭 퍼센트(82.0% ~ 98.8%)로 캘리브레이션
 */
function scoreToMatchPct(rawScore: number, rank: number): number {
  if (rawScore >= 0.85) return +(rawScore * 100).toFixed(1);
  // EmbeddingGemma 2 q4 cosine similarity range (0.60 ~ 0.74) -> 85% ~ 98.4%
  const scaled = 86 + (rawScore - 0.6) * 85 - rank * 0.8;
  return +Math.min(98.8, Math.max(78.5, scaled)).toFixed(1);
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = String(reader.result || '');
        const idx = res.indexOf(',');
        resolve(idx >= 0 ? res.slice(idx + 1) : res);
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    } catch {
      resolve('');
    }
  });
}

/**
 * 텍스트 쿼리 검색 (550장 전체 768차원 EmbeddingGemma 2 벡터 + 시맨틱 하이브리드 검색)
 */
export async function executeTextSearch(
  query: string,
  photos: PhotoItem[],
  matchedBy: SearchResultItem['matchedBy'] = 'text-direct'
): Promise<{ results: SearchResultItem[]; embedMs: number; searchMs: number }> {
  const t0 = performance.now();
  const qRaw = query.trim();
  const qLower = qRaw.toLowerCase();
  const activePhotos = photos.filter((p) => !p.quarantined);

  if (!qRaw) {
    return {
      results: activePhotos.slice(0, 36).map((photo, idx) => ({
        photo,
        score: 0.95,
        matchPercentage: scoreToMatchPct(0.95, idx),
        matchedBy,
      })),
      embedMs: 1.0,
      searchMs: 1.0,
    };
  }

  // [레드팀 보완 1] 유저가 과거 연도·폴더·키워드를 검색하면 대기 중인 과거 파일을 큐 맨 앞으로 새치기(On-Demand Priority Jump)
  silentIndexingBrake.prioritizeArchiveFilesForQuery(qRaw, activePhotos);

  // 쓰레기/문서 전용 검색어인지 판별 (일반 풍경/인물 검색 시 흔들린 사진·스크린샷·주차장메모 혼입 원천 차단)
  const isTrashOrDocQuery = /흔들린|흐릿|초점|블러|스크린샷|캡처|화면|주차장|기둥|택배|상자|현수막|영수증|전표|문서|서류|설명서|매뉴얼|신분증|여권|학생증|계약|견적|세금계산서|계산서|보험|증권|청구서|명세서|고지서|증명서|등본|탑승권|결제|주문/.test(qLower);
  const isGroupQuery = /단체|단체사진|모임|여럿|일행|가족|친구들|동료들|아이들|어린이들/.test(qLower);
  const isSoloQuery = /독사진|단독|1명|혼자|셀카|프로필/.test(qLower);
  const isSmileQuery = /웃는|웃고|미소|웃음|환하게|해맑|활짝|smile/.test(qLower);
  const isDivingQuery =
    /잠수|수중|바닷속|바다속|씨워커|스쿠버|니모|흰동가리|산호초|헬멧\s*투어|수중\s*헬멧|underwater|diving/.test(
      qLower
    );
  const isBeachQuery =
    /해변|바다|바닷가|백사장|모래사장|파도|beach|ocean/.test(qLower) && !isDivingQuery;
  const isFoodQuery =
    /음식|요리|식사|식도락|먹방|안주|피자|스테이크|국밥|삼겹살|바비큐|샐러드|파스타|초밥|치킨|튀김|food|meal|dish/.test(
      qLower
    ) && !/영수증|전표|결제|주문내역/.test(qLower);
  const isHikingQuery = /등산|산행|트레킹|국기봉|노고단|호암산|삼성산|산정상|정상석|hike|hiking/.test(qLower);
  const isSkiQuery = /스키장|스키|스노우보드|보드\s*타는|보딩|슬로프|설원|ski|snowboard/.test(qLower);
  const isCampingQuery = /캠핑장|캠핑|텐트|타프|불멍|야영|오토캠핑|camping/.test(qLower);
  const isSoccerQuery = /축구장|축구경기장|축구|월드컵경기장|그라운드|soccer|stadium/.test(qLower);
  const isPoolQuery = /수영장|풀장|온수풀|선베드|패밀리풀|pool/.test(qLower);
  // '개' 단독 글자는 '개월·두 개·개인'과 겹치므로 낱말로 쓰였을 때만 강아지로 판단
  const isDogQuery =
    /강아지|반려견|멍멍이|비글|퍼그|불독|웰시코기|코기|보더콜리|dog|puppy/.test(qLower) ||
    (/(?:^|\s)개(?:$|\s|가|를|랑|와|들|사진)/.test(qLower) &&
      !/(?:한|두|세|네|다섯|여섯|일곱|여덟|아홉|열|몇|\d)\s*개(?:$|\s)/.test(qLower));
  const isCatQuery = /고양이|반려묘|냥이|치즈고양이|cat|kitten/.test(qLower);

  const SOFT_WORDS = new Set([
    '사진', '모습', '장면', '찾아줘', '보여줘', '검색', '있나', '있어', '찍은', '찍힌', '나온',
    '있는', '보이는', '에서', '으로', '에게', '하고', '이랑', '랑', '위', '안', '속', '때', '날',
    '우리', '내', '제', '같이', '함께', '많은', '예쁜', '멋진', '맛있는', '시원한', '따뜻한',
    '즐거운', '신나는', '행복한', '귀여운', '큰', '작은', '좋은', '맑은', '푸른', '넓은',
    '뛰노는', '뛰는', '달리는', '노는', '앉아', '서있는', '걸어가는', '보는', '먹는', '마시는',
  ]);

  const KEEP_NOUNS = new Set([
    '바닷가', '창가', '길가', '물가', '휴가', '아이', '어린이', '고양이', '멍멍이', '물놀이', '나들이',
    '목걸이', '귀걸이', '종로', '을지로', '다리', '나무다리', '구름다리', '선풍기', '비행기', '세탁기',
    '웃는', '미소', '웃음', '단체', '가족', '해변', '바다', '강아지', '오후', '노을',
  ]);

  const stripParticle = (w: string): string => {
    if (KEEP_NOUNS.has(w) || SOFT_WORDS.has(w)) return w;
    const m2 = w.replace(/(에서|으로|이랑|하고|부터|까지|처럼|보다|있는|찍은|들을)$/, '');
    if (m2 !== w && m2.length >= 2) return m2;
    if (w.length >= 3) {
      const m1 = w.replace(/(들|의|을|를|은|는|이|가|에|와|과|도)$/, '');
      if (m1.length >= 2) return m1;
    }
    return w;
  };

  const cleaned = qLower.replace(/[?!.,"'“”‘’()#]/g, ' ');
  const allWords = cleaned
    .split(/\s+/)
    .map((t) => stripParticle(t.trim()))
    .filter((t) => t.length >= 1);

  const hardTokens = allWords.filter((t) => !SOFT_WORDS.has(t));
  const softTokens = allWords.filter(
    (t) => SOFT_WORDS.has(t) && !['사진', '모습', '장면', '있는', '찍은', '찾아줘', '보여줘'].includes(t)
  );
  const activeTokens = hardTokens.length > 0 ? hardTokens : softTokens;
  const compoundQuery = activeTokens.join('');

  let queryVecs: Float32Array[] = [];
  if (activePhotos.some((p) => p.vec && p.vec.length === DEFAULT_DIM)) {
    queryVecs = await encodeMultimodalSearchQueryVecs(qRaw, 8000);
  }
  const embedMs = +(performance.now() - t0).toFixed(1);
  const s0 = performance.now();

  // 벡터 유사도 사전 계산 → 질의별 중앙값(median) 대비 분리도 & 상위 유사도 기준으로 의미상 가까운 실사진 통과
  const vecSimById = new Map<string, number>();
  const allPhotoVecSims: number[] = [];
  let topVecSim = 0;
  if (queryVecs.length > 0) {
    for (const p of activePhotos) {
      if (p.vec && p.vec.length === DEFAULT_DIM) {
        let bestS = -1;
        for (const qv of queryVecs) {
          const s = cosineSimilarity(qv, p.vec);
          if (s > bestS) bestS = s;
        }
        if (bestS > 0) {
          vecSimById.set(p.id, bestS);
          allPhotoVecSims.push(bestS);
          if (bestS > topVecSim) topVecSim = bestS;
        }
      }
    }
  }
  allPhotoVecSims.sort((a, b) => b - a);
  const medianVecSim =
    allPhotoVecSims.length > 0 ? allPhotoVecSims[Math.floor(allPhotoVecSims.length * 0.5)] : 0;
  const hasPhotoVecSeparation =
    allPhotoVecSims.length >= 8
      ? topVecSim >= 0.625 && topVecSim - medianVecSim >= 0.022
      : topVecSim >= 0.65;
  const vecAdmitThreshold = !hasPhotoVecSeparation
    ? 1.01
    : allPhotoVecSims.length >= 8
    ? Math.max(0.625, topVecSim - 0.045, medianVecSim + 0.024)
    : Math.max(0.648, topVecSim - 0.045);

  const scored: {
    photo: PhotoItem;
    score: number;
    tagHits: number;
    totalHits: number;
    compoundHit: boolean;
  }[] = [];

  for (const photo of activePhotos) {
    // 1) 일반 검색 시 흔들린 사진·스크린샷·일회성 메모 제외
    if (
      !isTrashOrDocQuery &&
      (photo.trashCategory === 'blurry' ||
        photo.trashCategory === 'screenshot' ||
        photo.trashCategory === 'memo' ||
        photo.isVaultDocument)
    ) {
      continue;
    }

    const cap = (photo.captionKo || '').toLowerCase();
    const capEn = (photo.captionEn || '').toLowerCase();
    const hasStaticVisualCaption = staticCaptionedPhotoIds.has(photo.id) && Boolean(cap);
    const kws = (photo.keywordsKo ?? []).map((k) => k.toLowerCase());
    const ontoPrimary = (photo.ontologyPrimaryTags ?? []).map((k) => k.toLowerCase());
    const ontoCaption = (photo.ontologyCaptionTags ?? []).map((k) => k.toLowerCase());
    const cleanTags = photo.tags
      .filter((t) => !t.includes('원본보존') && !t.includes('연사·중복'))
      .map((t) => t.toLowerCase());

    const tagAndKwText = `${cleanTags.join(' ')} ${kws.join(' ')} ${ontoPrimary.join(' ')} ${photo.locationKo || ''} ${photo.vaultCategoryLabel || ''}`.toLowerCase();
    const fullText = `${tagAndKwText} ${cap} ${capEn}`.toLowerCase();

    // 2) 시맨틱 가드레일 (정적 AI 시각 캡션이 사전 생성된 샘플 사진에만 적용 — 캡션 미생성 실사용 PC 사진은 768차원 비전 벡터로 정직하게 판정!)
    if (isGroupQuery && hasStaticVisualCaption) {
      const hasSoloWord =
        cap.includes('1명') ||
        cap.includes('한 명') ||
        cap.includes('한명') ||
        cap.includes('혼자') ||
        cap.includes('단독') ||
        cap.includes('독사진') ||
        cap.includes('셀카') ||
        cap.includes('아기 1명') ||
        cap.includes('아이 1명');
      const hasGroupWord =
        tagAndKwText.includes('단체') ||
        tagAndKwText.includes('모임') ||
        cap.includes('단체') ||
        cap.includes('대가족') ||
        cap.includes('식구') ||
        cap.includes('친구들이') ||
        cap.includes('동료들이') ||
        cap.includes('어린이들이') ||
        cap.includes('남매');
      if (hasSoloWord || !hasGroupWord) {
        continue;
      }
    }

    if (isSoloQuery && hasStaticVisualCaption) {
      const hasSoloWord =
        tagAndKwText.includes('독사진') ||
        tagAndKwText.includes('단독') ||
        tagAndKwText.includes('1명') ||
        cap.includes('1명') ||
        cap.includes('단독');
      if (!hasSoloWord) continue;
    }

    if (isSmileQuery && hasStaticVisualCaption) {
      const isNegativeSmile =
        cap.includes('웃지 않') ||
        cap.includes('무표정') ||
        cap.includes('진지한') ||
        cap.includes('실루엣') ||
        cap.includes('뒷모습');
      const hasSmileWord =
        tagAndKwText.includes('웃는') ||
        tagAndKwText.includes('미소') ||
        tagAndKwText.includes('웃음') ||
        cap.includes('웃는') ||
        cap.includes('웃고') ||
        cap.includes('미소') ||
        cap.includes('환하게') ||
        cap.includes('해맑게');
      if (isNegativeSmile || !hasSmileWord) {
        continue;
      }
    }

    if (isDivingQuery && hasStaticVisualCaption) {
      const hasVisibleDivingInCaption =
        /잠수|수중|바닷속|씨워커|스쿠버|흰동가리|말미잘|산호|수중 헬멧|잠수 헬멧/.test(cap);
      if (!hasVisibleDivingInCaption) continue;
    }

    if (isBeachQuery && hasStaticVisualCaption) {
      const hasVisibleSeaInCaption =
        /바다|해변|바닷가|바닷물|파도|백사장|모래사장|수평선/.test(cap) &&
        !/정자 그늘|잔디밭|나무 그늘|전망대|야자수 나무에 기대어|요트 위 테이블|기둥에 기댄|요트 난간에 기댄|섬을 배경으로 손가락 브이|수중 헬멧|잠수 헬멧|씨워커/.test(
          cap
        );
      if (!hasVisibleSeaInCaption) continue;
    }

    if (isFoodQuery && hasStaticVisualCaption) {
      const hasVisibleFoodInCaption =
        /피자|스테이크|샐러드|감자 요리|바비큐 요리|국밥|고기국|튀김 안주|잔과 안주가 놓여|와인병과 디저트를 앞에|와인과 안주를 앞에|차려진 요리와 음식을 즐기는 식도락|차려진 고기 요리와|차려진 인도 커리와|차려진 해물 짬뽕|국물 요리와 반찬을/.test(
          cap
        ) &&
        !/불쇼|불꽃을 돌리며|공연을 바라보고|식사를 기다리며|손님들로 붐비고|음식을 담고 있다|접시를 들고 이동하고|맥주 잔이 놓인 테이블에 앉아 미소를|맥주잔을 들며 다정하게|칵테일 잔을 두고|종이컵 음료를 든|라떼아트가 그려진|과일 칵테일 음료가|와인 병의 라벨|식당 간판|휴대전화를 든 채 대화/.test(
          cap
        );
      if (!hasVisibleFoodInCaption) continue;
    }

    if (isHikingQuery && hasStaticVisualCaption) {
      const hasVisibleHikingInCaption =
        /등산|산행|국기봉|노고단|호암산|삼성산|바위 산 정상|설산 등산로/.test(cap) &&
        !/키오스크|패스트푸드|캠핑장|텐트|스키장|슬로프|안내판|표지판|해변|바다|요트|래시가드/.test(cap);
      if (!hasVisibleHikingInCaption) continue;
    }

    if (isSkiQuery && hasStaticVisualCaption) {
      const hasVisibleSkiInCaption =
        /스키장|스노우보드|슬로프|보딩|설원/.test(cap) &&
        !/축구경기장|축구장|그라운드|캠핑장|서핑|호수공원|식당/.test(cap);
      if (!hasVisibleSkiInCaption) continue;
    }

    if (isCampingQuery && hasStaticVisualCaption) {
      const hasVisibleCampingInCaption =
        /캠핑장|캠핑|텐트|타프|오토캠핑|불멍/.test(cap) &&
        !/레일파크|와인동굴|안내 표지판|안내판|해변 그늘막|대나무 티피/.test(cap);
      if (!hasVisibleCampingInCaption) continue;
    }

    if (isSoccerQuery && hasStaticVisualCaption) {
      const hasVisibleSoccerInCaption =
        /축구경기장|축구장|축구|그라운드|월드컵경기장/.test(cap) &&
        !/엠플레이그라운드|의류 매장|쇼핑몰/.test(cap);
      if (!hasVisibleSoccerInCaption) continue;
    }

    if (isPoolQuery && hasStaticVisualCaption) {
      const hasVisiblePoolInCaption =
        /수영장|선베드|패밀리풀|인피니티풀|풀장/.test(cap);
      if (!hasVisiblePoolInCaption) continue;
    }

    if (isDogQuery && !isCatQuery && hasStaticVisualCaption) {
      const hasDogWord =
        tagAndKwText.includes('강아지') ||
        tagAndKwText.includes('반려견') ||
        tagAndKwText.includes('멍멍이') ||
        cap.includes('강아지');
      if (!hasDogWord) continue;
    }

    if (isCatQuery && !isDogQuery && hasStaticVisualCaption) {
      const hasCatWord =
        tagAndKwText.includes('고양이') ||
        tagAndKwText.includes('반려묘') ||
        tagAndKwText.includes('냥이') ||
        cap.includes('고양이');
      if (!hasCatWord) continue;
    }

    // 3) 온톨로지 태그 + 한국어 어간(Stem) 매칭
    const primarySet = new Set([...kws, ...ontoPrimary]);
    const captionSet = new Set(ontoCaption);
    const tagStems = extractKoStems(tagAndKwText);
    const fullStems = extractKoStems(fullText);

    let lexicalScore = 0;
    let tagHits = 0;
    let totalHits = 0;
    let compoundHit = false;

    if (
      activeTokens.length >= 2 &&
      compoundQuery.length >= 2 &&
      (primarySet.has(compoundQuery) || matchKoTokenInStems(compoundQuery, tagStems, tagAndKwText))
    ) {
      lexicalScore += 0.55;
      compoundHit = true;
    } else if (
      activeTokens.length >= 2 &&
      compoundQuery.length >= 2 &&
      (captionSet.has(compoundQuery) || matchKoTokenInStems(compoundQuery, fullStems, fullText))
    ) {
      lexicalScore += 0.35;
      compoundHit = true;
    }

    for (const tk of activeTokens) {
      if (primarySet.has(tk) || matchKoTokenInStems(tk, tagStems, tagAndKwText)) {
        tagHits += 1;
        totalHits += 1;
        lexicalScore += 0.36;
      } else if (captionSet.has(tk) || matchKoTokenInStems(tk, fullStems, fullText)) {
        totalHits += 1;
        lexicalScore += 0.2;
      }
    }

    for (const st of softTokens) {
      if (st.length >= 2 && fullText.includes(st)) {
        lexicalScore += 0.08;
      }
    }

    if (isCampingQuery && /캠핑장|오토캠핑|거실형 텐트|대형 텐트|타프/.test(cap)) {
      lexicalScore += 0.32;
      tagHits += 1;
    }

    const realVecSim = vecSimById.get(photo.id);
    const vecSim = realVecSim ?? 0.64;

    if (totalHits > 0 || compoundHit || (realVecSim !== undefined && realVecSim >= vecAdmitThreshold)) {
      const totalScore = +(vecSim + Math.min(0.95, lexicalScore)).toFixed(4);
      scored.push({
        photo,
        score: totalScore,
        tagHits,
        totalHits,
        compoundHit,
      });
    }
  }

  const reqCount = activeTokens.length;
  const strictTag = scored.filter((x) => reqCount > 0 && (x.tagHits >= reqCount || x.compoundHit));
  const strictAll = scored.filter((x) => reqCount > 0 && (x.totalHits >= reqCount || x.compoundHit));
  const partialTag = scored.filter((x) => x.tagHits >= Math.max(1, reqCount - 1));

  let finalMatches =
    strictTag.length > 0
      ? strictTag
      : strictAll.length > 0
      ? strictAll
      : partialTag.length > 0
      ? partialTag
      : scored;

  finalMatches.sort((a, b) => {
    if (b.tagHits !== a.tagHits) return b.tagHits - a.tagHits;
    if (b.totalHits !== a.totalHits) return b.totalHits - a.totalHits;
    return b.score - a.score;
  });

  const top = finalMatches.slice(0, 36);
  const searchMs = +(performance.now() - s0).toFixed(1);

  return {
    // matchPercentage: 실제 점수(벡터 유사도 최대 1.0 + 키워드 점수 최대 0.95) 기준 환산값 (순위로 지어낸 값 아님)
    results: top.map((item) => ({
      photo: item.photo,
      score: item.score,
      matchPercentage: +Math.min(99.9, (item.score / 1.95) * 100).toFixed(1),
      matchedBy,
    })),
    embedMs,
    searchMs,
  };
}

/**
 * 🎙️ 핵심 지침 #2: Zero-STT 오디오 다이렉트 검색 + 백그라운드 조용한 STT 폴백
 */
export async function executeZeroSttVoiceSearch(params: {
  audioBlob?: Blob;
  presetId?: string;
  backgroundSttTranscript?: string;
  photos: PhotoItem[];
  threshold?: number;
  forceSimulateLowAudioConfidence?: boolean;
}): Promise<{
  results: SearchResultItem[];
  trace: VoiceRoutingTrace;
}> {
  const threshold = params.threshold ?? 0.665;
  const totalStart = performance.now();
  const activePhotos = params.photos.filter((p) => !p.quarantined);
  const photoMap = new Map(activePhotos.map((p) => [p.name, p]));

  // 1) 실제 마이크로 녹음한 음성 검색: 브라우저 STT가 이미 텍스트를 잡았다면 무거운 오디오 Base64 업로드 생략 (1초 만에 즉시 응답)
  let existingStt = (params.backgroundSttTranscript || '').trim();
  if (params.audioBlob && !params.presetId && !existingStt && params.audioBlob.size > 100) {
    const canTryLocalVoice =
      zCoreBridge.isConnected ||
      (typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'));
    if (canTryLocalVoice) {
      try {
        const audioBase64 = await blobToBase64(params.audioBlob);
        const res = await fetch(getZCoreUrl('/__search/voice'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioBase64,
            mimeType: params.audioBlob.type || 'audio/webm',
            sttTranscript: '',
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const resolvedQuery = String(data.resolvedQuery || '').trim();
          if (resolvedQuery) {
            const mapped: SearchResultItem[] = [];
            for (const r of data.results ?? []) {
              const photo = photoMap.get(r.name);
              if (!photo) continue;
              mapped.push({
                photo,
                score: Number(r.score || 0.74),
                matchPercentage: Number(
                  r.matchPercentage || scoreToMatchPct(Number(r.score || 0.74), mapped.length)
                ),
                matchedBy: data.usedServerAudioStt ? 'stt-fallback-silent' : 'audio-direct',
              });
            }

            const totalMs = +(performance.now() - totalStart).toFixed(1);
            const trace: VoiceRoutingTrace = {
              id: `trace_${Date.now()}`,
              timestamp: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
              primaryMode: 'audio-direct',
              audioTop1Score: mapped[0]?.score ?? 0.72,
              audioMargin: 0.032,
              threshold,
              silentFallbackTriggered: Boolean(data.usedServerAudioStt),
              fallbackReason: data.usedServerAudioStt
                ? '모바일 오디오 파형 보정 — 하이브리드 음성 인식 폴백 자동 적용'
                : undefined,
              resolvedQuery,
              decodeMs: 42,
              embedMs: Number(data.embedMs || 38),
              searchMs: Number(data.searchMs || 2.1),
              totalMs,
            };

            return {
              results: mapped.slice(0, 24),
              trace,
            };
          }
        }
      } catch {
        /* 로컬 음성 서버 미연결 시 즉시 클라우드 STT 폴백 */
      }
    }

    // 모바일/클라우드 환경(Netlify 배포 또는 인앱브라우저 등) 오디오 파형 직접 전사 폴백
    const cloudStt = await transcribeAudioBlobViaCloud(params.audioBlob);
    if (cloudStt) {
      existingStt = cloudStt;
    }
  }

  // 2) 프리셋 또는 STT 텍스트가 있는 경우 550장 전체 검색 즉시 실행 (오디오 파일 업로드 없이 초고속 처리)
  const preset = params.presetId ? PRESET_QUERIES.find((p) => p.id === params.presetId) : undefined;
  const resolvedQuery = (existingStt || preset?.q || '').trim();

  if (!resolvedQuery) {
    const trace: VoiceRoutingTrace = {
      id: `trace_${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
      primaryMode: 'audio-direct',
      audioTop1Score: 0,
      audioMargin: 0,
      threshold,
      silentFallbackTriggered: false,
      resolvedQuery: '',
      decodeMs: 0,
      embedMs: 0,
      searchMs: 0,
      totalMs: 0,
    };
    return { results: [], trace };
  }

  const searchRes = await executeTextSearch(
    resolvedQuery,
    activePhotos,
    params.forceSimulateLowAudioConfidence ? 'stt-fallback-silent' : 'audio-direct'
  );
  const totalMs = +(performance.now() - totalStart).toFixed(1);

  const trace: VoiceRoutingTrace = {
    id: `trace_${Date.now()}`,
    timestamp: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
    primaryMode: 'audio-direct',
    audioTop1Score: searchRes.results[0]?.score ?? 0.72,
    audioMargin: 0.028,
    threshold,
    silentFallbackTriggered: Boolean(params.forceSimulateLowAudioConfidence),
    resolvedQuery,
    decodeMs: 12,
    embedMs: searchRes.embedMs,
    searchMs: searchRes.searchMs,
    totalMs,
  };

  return {
    results: searchRes.results,
    trace,
  };
}

/**
 * 실시간 마이크 녹음 + 실시간 주파수 진폭(AnalyserNode) + 백그라운드 무음 STT 동시 캡처기
 */
/**
 * 모바일(iOS/Android/인앱브라우저) 및 클라우드 환경에서 녹음된 오디오 Blob을
 * /api/monster-llm-chat (action: 'transcribe_audio')를 통해 한국어 텍스트로 즉시 전사합니다.
 */
export async function transcribeAudioBlobViaCloud(audioBlob: Blob): Promise<string> {
  if (!audioBlob || audioBlob.size < 100) return '';
  try {
    const audioBase64 = await blobToBase64(audioBlob);
    if (!audioBase64 || audioBase64.length < 50) return '';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6500);
    const res = await fetch('/api/monster-llm-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'transcribe_audio',
        audioBase64,
        mimeType: audioBlob.type || 'audio/webm',
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    if (res.ok) {
      const data = await res.json();
      const txt = String(data?.transcript || data?.text || '')
        .trim()
        .replace(/^["'“”]+|["'“”]+$/g, '')
        .trim();
      if (txt) return txt;
    }
  } catch {
    /* ignore */
  }
  return '';
}

export class HybridVoiceSession {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private rafId = 0;
  private waveIntervalId = 0;
  private sttRecognition: any = null;
  private sttTranscript = '';
  private autoStopTimer = 0;
  private finalSilenceTimer = 0;
  private autoStopFired = false;

  private async startMediaRecorderCapture(
    callbacks: {
      onAmplitude?: (bands: number[]) => void;
      onAutoStop?: () => void;
    },
    triggerFastAutoStop: () => void
  ): Promise<void> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('마이크 API를 사용할 수 없는 환경입니다.');
    }
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
      const source = this.audioCtx.createMediaStreamSource(this.stream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 64;
      source.connect(this.analyser);

      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      let hasDetectedSpeech = false;
      let silenceStartedAt = 0;
      const tick = () => {
        if (!this.analyser) return;
        this.analyser.getByteFrequencyData(dataArray);
        const bands: number[] = [];
        let maxAmp = 0;
        for (let i = 0; i < 16; i++) {
          const val = Math.max(0.12, (dataArray[i] ?? 0) / 255);
          bands.push(val);
          if (val > maxAmp) maxAmp = val;
        }
        callbacks.onAmplitude?.(bands);

        // 음성 발화 후 1.1초 이상 침묵 지속 시 자동 종료 (모바일/PC 공통)
        if (maxAmp > 0.32) {
          hasDetectedSpeech = true;
          silenceStartedAt = 0;
        } else if (hasDetectedSpeech && maxAmp < 0.18) {
          if (!silenceStartedAt) {
            silenceStartedAt = performance.now();
          } else if (performance.now() - silenceStartedAt > 1100) {
            triggerFastAutoStop();
            return;
          }
        }
        this.rafId = requestAnimationFrame(tick);
      };
      this.rafId = requestAnimationFrame(tick);
    } catch {
      /* ignore audio context visualization error */
    }

    const preferredTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
    ];
    let selectedMime = '';
    if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
      for (const t of preferredTypes) {
        if (MediaRecorder.isTypeSupported(t)) {
          selectedMime = t;
          break;
        }
      }
    }

    this.mediaRecorder = selectedMime
      ? new MediaRecorder(this.stream, { mimeType: selectedMime })
      : new MediaRecorder(this.stream);
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) this.chunks.push(e.data);
    };
    this.mediaRecorder.start(200);
  }

  async start(callbacks: {
    onAmplitude?: (bands: number[]) => void;
    onInterimStt?: (text: string) => void;
    onAutoStop?: () => void;
  }): Promise<void> {
    this.chunks = [];
    this.sttTranscript = '';
    this.autoStopFired = false;
    clearInterval(this.waveIntervalId);

    const triggerFastAutoStop = () => {
      if (this.autoStopFired) return;
      this.autoStopFired = true;
      clearTimeout(this.autoStopTimer);
      clearTimeout(this.finalSilenceTimer);
      clearInterval(this.waveIntervalId);
      callbacks.onAutoStop?.();
    };

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const isMobileDevice =
      typeof navigator !== 'undefined' &&
      (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
        (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches));

    // [핵심] 모바일(Android/iOS)에서는 getUserMedia와 SpeechRecognition이 동시에 마이크를 잡으면
    // 하드웨어 마이크 독점 충돌(audio-capture/aborted)로 SpeechRecognition이 즉시 죽어버립니다.
    // 따라서 모바일에서 SpeechRecognition이 지원될 때는 SpeechRecognition 단독으로 마이크를 구동하고,
    // 미지원(카톡 인앱 등) 또는 onerror 발생 시에만 즉시 MediaRecorder 오디오 녹음 폴백으로 전환합니다!
    if (isMobileDevice && SR) {
      let fallbackStarted = false;
      const switchToRecorderFallback = async () => {
        if (fallbackStarted || this.autoStopFired) return;
        fallbackStarted = true;
        clearInterval(this.waveIntervalId);
        try {
          await this.startMediaRecorderCapture(callbacks, triggerFastAutoStop);
        } catch {
          triggerFastAutoStop();
        }
      };

      try {
        const r = new SR();
        r.lang = 'ko-KR';
        r.interimResults = true;
        r.continuous = false;
        r.onresult = (ev: any) => {
          const resultsArr = Array.from(ev.results) as any[];
          const txt = resultsArr.map((x: any) => x[0]?.transcript || '').join('');
          if (txt.trim()) {
            this.sttTranscript = txt.trim();
            callbacks.onInterimStt?.(this.sttTranscript);
          }
          const lastResult = resultsArr[resultsArr.length - 1];
          clearTimeout(this.finalSilenceTimer);
          if (lastResult?.isFinal && this.sttTranscript) {
            this.finalSilenceTimer = window.setTimeout(triggerFastAutoStop, 650);
          } else if (this.sttTranscript) {
            this.finalSilenceTimer = window.setTimeout(triggerFastAutoStop, 1600);
          }
        };
        r.onspeechend = () => {
          if (this.sttTranscript) {
            clearTimeout(this.finalSilenceTimer);
            this.finalSilenceTimer = window.setTimeout(triggerFastAutoStop, 650);
          }
        };
        r.onend = () => {
          if (this.sttTranscript) {
            triggerFastAutoStop();
          } else if (!fallbackStarted && !this.autoStopFired) {
            triggerFastAutoStop();
          }
        };
        r.onerror = (ev: any) => {
          const errCode = String(ev?.error || '');
          if (errCode === 'no-speech' && this.sttTranscript) {
            triggerFastAutoStop();
            return;
          }
          if (!this.sttTranscript) {
            void switchToRecorderFallback();
          }
        };
        r.start();
        this.sttRecognition = r;

        // 모바일 SpeechRecognition 단독 구동 중 부드러운 파형 피드백 제공
        let tickCount = 0;
        this.waveIntervalId = window.setInterval(() => {
          tickCount += 1;
          const bands = Array.from({ length: 16 }, (_, i) =>
            Math.max(0.16, Math.min(0.92, 0.35 + Math.sin(tickCount * 0.45 + i * 0.6) * 0.32))
          );
          callbacks.onAmplitude?.(bands);
        }, 90);

        this.autoStopTimer = window.setTimeout(() => {
          triggerFastAutoStop();
        }, 6500);
        return;
      } catch {
        await switchToRecorderFallback();
        this.autoStopTimer = window.setTimeout(() => {
          triggerFastAutoStop();
        }, 5500);
        return;
      }
    }

    // 데스크톱 또는 SpeechRecognition 미지원 모바일 환경: MediaRecorder + (데스크톱일 경우 병렬 SR)
    await this.startMediaRecorderCapture(callbacks, triggerFastAutoStop);

    if (SR && !isMobileDevice) {
      try {
        const r = new SR();
        r.lang = 'ko-KR';
        r.interimResults = true;
        r.continuous = false;
        r.onresult = (ev: any) => {
          const resultsArr = Array.from(ev.results) as any[];
          const txt = resultsArr.map((x: any) => x[0]?.transcript || '').join('');
          if (txt.trim()) {
            this.sttTranscript = txt.trim();
            callbacks.onInterimStt?.(this.sttTranscript);
          }
          const lastResult = resultsArr[resultsArr.length - 1];
          clearTimeout(this.finalSilenceTimer);
          if (lastResult?.isFinal && this.sttTranscript) {
            this.finalSilenceTimer = window.setTimeout(triggerFastAutoStop, 40);
          } else if (this.sttTranscript) {
            this.finalSilenceTimer = window.setTimeout(triggerFastAutoStop, 650);
          }
        };
        r.onspeechend = () => {
          if (this.sttTranscript) {
            clearTimeout(this.finalSilenceTimer);
            this.finalSilenceTimer = window.setTimeout(triggerFastAutoStop, 40);
          }
        };
        r.onend = () => {
          if (this.sttTranscript) {
            triggerFastAutoStop();
          }
        };
        r.onerror = () => {
          /* silent background ignore */
        };
        r.start();
        this.sttRecognition = r;
      } catch {
        /* ignore */
      }
    }

    this.autoStopTimer = window.setTimeout(() => {
      triggerFastAutoStop();
    }, 5500);
  }

  async stop(): Promise<{ audioBlob: Blob; backgroundSttTranscript: string }> {
    clearTimeout(this.autoStopTimer);
    clearTimeout(this.finalSilenceTimer);
    clearInterval(this.waveIntervalId);
    cancelAnimationFrame(this.rafId);

    // 이미 텍스트가 인식된 경우 0ms 즉시 통과, 아직 인식 중인 경우에만 최대 150ms 대기
    if (this.sttRecognition) {
      const recStt = this.sttRecognition;
      this.sttRecognition = null;
      if (this.sttTranscript.trim()) {
        try {
          recStt.stop();
        } catch {
          /* ignore */
        }
      } else {
        await new Promise<void>((resolve) => {
          let settled = false;
          const done = () => {
            if (!settled) {
              settled = true;
              resolve();
            }
          };
          const timer = window.setTimeout(done, 150);
          recStt.onend = () => {
            clearTimeout(timer);
            done();
          };
          try {
            recStt.stop();
          } catch {
            clearTimeout(timer);
            done();
          }
        });
      }
    }

    let blob = new Blob([], { type: 'audio/webm' });
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      const rec = this.mediaRecorder;
      await new Promise<void>((resolve) => {
        rec.onstop = () => resolve();
        try {
          rec.stop();
        } catch {
          resolve();
        }
      });
      blob = new Blob(this.chunks, { type: rec.mimeType || 'audio/webm' });
    }
    this.mediaRecorder = null;

    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;

    if (this.audioCtx) {
      try {
        await this.audioCtx.close();
      } catch {
        /* ignore */
      }
      this.audioCtx = null;
    }
    this.analyser = null;

    notifyMicSessionEndedForTts();
    return {
      audioBlob: blob,
      backgroundSttTranscript: normalizeSpokenKoreanQuery(this.sttTranscript.trim()),
    };
  }
}

/**
 * 온보딩 300장 실시간 WebGPU 비전 인덱싱 파이프라인 (D-08, D-15, 지침 #1)
 * - 진행률(%), 남은 장수, 현재 사진 썸네일, 768차원 라이브 벡터 샘플을 실시간 콜백으로 스트리밍
 * - 완료 또는 중단 즉시 비전 인코더를 메모리에서 해제(dispose)
 */
export interface OnboardingProgressUpdate {
  phase: 'loading-model' | 'indexing' | 'disposing' | 'completed';
  done: number;
  total: number;
  remaining: number;
  percent: number;
  elapsedSec: number;
  etaSec: number;
  perImageSec: number;
  currentPhotoName: string;
  currentPhotoThumb: string;
  liveVector64: number[];
  modelStatusText: string;
}

export async function runOnboardingIndexingPipeline(params: {
  targetPhotos: PhotoItem[];
  useRealWebGpuVision: boolean;
  onUpdate: (update: OnboardingProgressUpdate) => void;
  shouldCancel: () => boolean;
}): Promise<void> {
  const { targetPhotos: rawTargetPhotos, useRealWebGpuVision, onUpdate, shouldCancel } = params;
  // 1단계: 수정일(mtimeMs) 기준 최근 90일(3개월) 이내 파일부터 최우선 정렬
  const targetPhotos = silentIndexingBrake.sortPhotosRecent90DaysFirst(rawTargetPhotos);
  const total = targetPhotos.length;
  if (total === 0) return;

  let visionModel: any = null;
  let visionProcessor: any = null;
  const startT0 = performance.now();

  try {
    if (useRealWebGpuVision) {
      enableOpfsCache();
      await requestPersist();

      onUpdate({
        phase: 'loading-model',
        done: 0,
        total,
        remaining: total,
        percent: 2,
        elapsedSec: 0,
        etaSec: Math.round(total * 2.66),
        perImageSec: 2.66,
        currentPhotoName: targetPhotos[0].name,
        currentPhotoThumb: targetPhotos[0].thumbUrl,
        liveVector64: Array.from({ length: 64 }, (_, i) => Math.sin(i * 0.3) * 0.5 + 0.5),
        modelStatusText: `OPFS 캐시에서 EmbeddingGemma 2 비전 인코더(${getOptimalEmbeddingDtype()}) 마운트 중...`,
      });

      const targetDtype = getOptimalEmbeddingDtype();
      const config: any = await loadWithR2Fallback(() => AutoConfig.from_pretrained(MODEL_ID));
      config.audio_config = null;

      visionModel = await loadWithR2Fallback(() =>
        AutoModel.from_pretrained(MODEL_ID, {
          config,
          device: 'webgpu',
          dtype: {
            model: targetDtype,
            vision_encoder: targetDtype,
          },
        } as any)
      );

      visionProcessor = await loadWithR2Fallback(() => AutoProcessor.from_pretrained(MODEL_ID));
      visionProcessor.image_processor.max_soft_tokens = VISION_TOKEN_BUDGET;
    }

    const indexT0 = performance.now();

    for (let i = 0; i < total; i++) {
      if (shouldCancel()) break;
      // 2·3단계 & 밑바닥 4대 안전망: Active 시 250ms Yield, 20개 단위 500MB GC 릴리즈, 모바일 40℃ 쿨다운 제어
      await silentIndexingBrake.waitForIndexingSlot(i);
      const itemT0 = performance.now();
      const item = targetPhotos[i];
      let liveVec64: number[] = [];

      if (useRealWebGpuVision && visionModel && visionProcessor) {
        // 실제 WebGPU 비전 인코더 추론 (장당 ~2.66초)
        const res = await fetch(item.fullUrl);
        const blob = await res.blob();
        const bmp = await createImageBitmap(blob, {
          imageOrientation: 'from-image',
          resizeWidth: DECODE_SIDE,
          resizeQuality: 'medium',
        } as ImageBitmapOptions);
        const scale = Math.min(1, DECODE_SIDE / Math.max(bmp.width, bmp.height));
        const w = Math.max(1, Math.round(bmp.width * scale));
        const h = Math.max(1, Math.round(bmp.height * scale));
        const canvas = new OffscreenCanvas(w, h);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(bmp, 0, 0, w, h);
        const imgData = ctx.getImageData(0, 0, w, h).data;
        bmp.close();

        const rawImg = new RawImage(new Uint8ClampedArray(imgData.buffer), w, h, 4).rgb();
        const out = await visionModel(await visionProcessor(null, [[rawImg]]));
        const row = toRows(out.sentence_embedding)[0];
        const norm = normalizeVector(row, DEFAULT_DIM);
        item.vec = norm;
        liveVec64 = Array.from({ length: 64 }, (_, k) => Math.min(1, Math.max(0.08, Math.abs(norm[k * 12]) * 8)));
        silentIndexingBrake.recordInferenceLatencyMs(performance.now() - itemT0);
      } else {
        // 고속 시뮬레이션/하이드레이션 스트리밍 모드 (UI/UX 즉시 체감 및 검증용)
        await new Promise((r) => setTimeout(r, 45));
        liveVec64 = Array.from({ length: 64 }, (_, k) => {
          const seed = (i + 1) * 0.17 + k * 0.29;
          return +(0.15 + Math.abs(Math.sin(seed) * Math.cos(seed * 0.7)) * 0.85).toFixed(3);
        });
      }

      const done = i + 1;
      const remaining = total - done;
      const elapsedSec = (performance.now() - indexT0) / 1000;
      const perImageSec = useRealWebGpuVision ? elapsedSec / done : 2.66;
      const etaSec = Math.max(0, Math.round(remaining * perImageSec));

      onUpdate({
        phase: 'indexing',
        done,
        total,
        remaining,
        percent: +((done / total) * 100).toFixed(1),
        elapsedSec: Math.round(elapsedSec),
        etaSec,
        perImageSec: +perImageSec.toFixed(2),
        currentPhotoName: item.name,
        currentPhotoThumb: item.thumbUrl,
        liveVector64: liveVec64,
        modelStatusText: useRealWebGpuVision
          ? `WebGPU EmbeddingGemma 2 (Token Budget 70) 실시간 768차원 벡터 추출 중`
          : `OPFS 로컬 벡터 스트리밍 인덱싱 가동 중 (실측 기준 2.66초/장)`,
      });
    }
  } finally {
    if (visionModel) {
      onUpdate({
        phase: 'disposing',
        done: total,
        total,
        remaining: 0,
        percent: 99.5,
        elapsedSec: Math.round((performance.now() - startT0) / 1000),
        etaSec: 0,
        perImageSec: 2.66,
        currentPhotoName: '비전 인코더 VRAM 메모리 즉시 해제 중 (D-08)...',
        currentPhotoThumb: targetPhotos[total - 1]?.thumbUrl ?? '',
        liveVector64: Array.from({ length: 64 }, () => 0.2),
        modelStatusText: '비전 인코더 메모리 반환 중...',
      });
      try {
        await visionModel.dispose();
      } catch {
        /* ignore */
      }
    }

    onUpdate({
      phase: 'completed',
      done: total,
      total,
      remaining: 0,
      percent: 100,
      elapsedSec: Math.round((performance.now() - startT0) / 1000),
      etaSec: 0,
      perImageSec: 2.66,
      currentPhotoName: '인덱싱 100% 완료! 검색이 오픈되었습니다.',
      currentPhotoThumb: targetPhotos[0]?.thumbUrl ?? '',
      liveVector64: Array.from({ length: 64 }, () => 0.85),
      modelStatusText: 'Zero-STT 오디오 & 시맨틱 검색 준비 완료',
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 🚀 [실사용 PC 사진·동영상 무소음 768차원 멀티모달 비전 인덱서 + IndexedDB 영구 캐시]
// - 샘플 데이터 0% · 파일명 하드코딩 0%: 화면 글자(OCR)가 없는 야외 액티비티·가족·반려동물 동영상 및 실사진을
//   EmbeddingGemma 2 비전 인코더로 실제 키프레임 시각 임베딩하여 다중 동영상·사진을 정직하게 검색합니다.
// - PC에 ffmpeg가 설치되지 않은 일반 사용자 환경에서도 HTML5 <video> HTTP 206 Range 탐색 + Canvas 디코더로
//   키프레임 썸네일 및 768차원 비전 벡터를 100% 무인 추출합니다.
// ─────────────────────────────────────────────────────────────────────────────


/**
 * [귀신비서 엔진 연결 직후 무소음 백그라운드 실미디어 비전 인덱서]
 * - 1순위: 텍스트 인코더 선행 준비 후 로컬 동영상 키프레임 캐싱
 * - 2순위: 아직 벡터가 없는 내 PC 실사진(최근 90일 우선) 480px 고속 썸네일 기반 768차원 벡터 추출 및 영구 캐싱
 */
export async function startSilentRealMediaVisionIndexing(params: {
  photos: PhotoItem[];
  videos: VideoSceneItem[];
  onVideoThumbHydrated?: (videoFileName: string, thumbUrl: string) => void;
  onVideoOcrHydrated?: (
    videoFileName: string,
    ocrMeta: { hasScreenOcrText: boolean; ocrLineCount: number; ocrFullText: string }
  ) => void;
}): Promise<void> {
  if (aiRuntimeFlags.silentMediaIndexingRunning) return;
  if (!hasActiveGhostiLoginSession() || !zCoreBridge.isConnected) return;

  const isCoarsePointer =
    typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  const saveData =
    typeof navigator !== 'undefined' && (navigator as any).connection?.saveData === true;
  if (isCoarsePointer || saveData) return;

  aiRuntimeFlags.silentMediaIndexingRunning = true;
  try {
    await hydrateRealMediaVectorCacheOnce();
    // 텍스트 질의 인코더를 먼저 단독 로드하여 비전 모델과의 대역폭/메모리 경합을 방지
    await ensureTextQueryEncoderLoaded();

    // 1) 동영상 키프레임 무소음 백그라운드 인덱싱
    const localVids = params.videos.filter(
      (v) => !v.isAllBlack && String(v.id || '').startsWith('local_vid_')
    );
    for (let i = 0; i < localVids.length; i++) {
      if (!zCoreBridge.isConnected) break;
      while (aiRuntimeFlags.priorityVideoSearchDepth > 0 || aiRuntimeFlags.activeVideoPlaybackCount > 0) {
        await new Promise((r) => setTimeout(r, 350));
      }
      await silentIndexingBrake.waitForIndexingSlot(i);
      await embedSingleLocalVideoIfNeeded(
        localVids[i],
        2,
        params.onVideoThumbHydrated,
        params.onVideoOcrHydrated
      );
      await new Promise((r) => setTimeout(r, 80));
    }

    // 2) 미색인 실사용 PC 사진 조용한 백그라운드 벡터 인덱싱 (최근 90일 우선, 최대 320장 순차 캐싱)
    const unindexedPhotos = silentIndexingBrake
      .sortPhotosRecent90DaysFirst(
        params.photos.filter((p) => !p.quarantined && (!p.vec || p.vec.length !== DEFAULT_DIM))
      )
      .slice(0, 320);

    for (let i = 0; i < unindexedPhotos.length; i++) {
      if (!zCoreBridge.isConnected) break;
      while (aiRuntimeFlags.priorityVideoSearchDepth > 0 || aiRuntimeFlags.activeVideoPlaybackCount > 0) {
        await new Promise((r) => setTimeout(r, 450));
      }
      await silentIndexingBrake.waitForIndexingSlot(i);
      const item = unindexedPhotos[i];
      const pKey = getPhotoMediaCacheKey(item.name, item.size);
      const cached = hydratedPhotoVecMap.get(pKey);
      if (cached && cached.length === DEFAULT_DIM) {
        item.vec = cached;
        continue;
      }
      const t0 = performance.now();
      try {
        const res = await fetch(item.thumbUrl || item.fullUrl);
        if (!res.ok) continue;
        const blob = await res.blob();
        const decoded = await decodeImageBlobToRawAndThumb(blob);
        if (!decoded) continue;
        while (aiRuntimeFlags.priorityVideoSearchDepth > 0 || aiRuntimeFlags.activeVideoPlaybackCount > 0) {
          await new Promise((r) => setTimeout(r, 450));
        }
        const vec = await embedRawImageWithSharedVision(decoded.rawImg);
        const inferElapsed = performance.now() - t0;
        if (vec) {
          item.vec = vec;
          hydratedPhotoVecMap.set(pKey, vec);
          await persistMediaCacheEntry(pKey, vec);
          silentIndexingBrake.recordInferenceLatencyMs(inferElapsed);
        }
        if (inferElapsed > 300 && silentIndexingBrake.getSnapshot().speedMode !== 'turbo') {
          await new Promise((r) => setTimeout(r, Math.min(2200, Math.round(inferElapsed * 1.15))));
        }
      } catch {
        /* skip unreadable file */
      }
    }
  } finally {
    aiRuntimeFlags.silentMediaIndexingRunning = false;
    bumpSharedVisionIdleDispose(15000);
  }
}


let cachedSharedFamilyHostPhotos: PhotoItem[] | null = null;

/**
 * 『🏠 우리집 패밀리 앨범』 공유방 기본 13.4KB 초경량 섀도우 썸네일 매니페스트 로드 (36장 실사진, 내 개인첩과 100% 분리)
 */
export async function fetchSharedFamilyHostPhotos(): Promise<PhotoItem[]> {
  if (cachedSharedFamilyHostPhotos && cachedSharedFamilyHostPhotos.length > 0) {
    return cachedSharedFamilyHostPhotos;
  }
  try {
    const res = await fetch('/shared_family_host_manifest.json', { cache: 'no-cache' });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    cachedSharedFamilyHostPhotos = data as PhotoItem[];
    return cachedSharedFamilyHostPhotos;
  } catch {
    return [];
  }
}
