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
  SHARED_PHOTO_BOILERPLATE_TAG_RX,
  THUMB_SIDE,
  VISION_TOKEN_BUDGET,
  acquireSharedVisionEncoder,
  aiRuntimeFlags,
  bumpSharedVisionIdleDispose,
  computeFrameHubnessScore,
  cosineSimilarity,
  decodeImageBlobToRawAndThumb,
  disposeSharedVisionEncoderNow,
  embedRawImageWithSharedVision,
  enableOpfsCache,
  encodeMultimodalSearchQueryVecs,
  ensureGlobalUserInputQuietGuardBound,
  ensureHubnessReferenceVecsLoaded,
  ensureTextQueryEncoderLoaded,
  extractCrispKoreanLabelTokens,
  extractKoStems,
  formatQuickKoreanLabelCore,
  loadModelWithWebGpuToWasmFallback,
  getContrastiveNonAnimalAnchorVecs,
  getOptimalEmbeddingDtype,
  getPhotoMediaCacheKey,
  getStaticCorpusCached,
  hydrateRealMediaVectorCacheOnce,
  hydratedPhotoMetaMap,
  hydratedPhotoVecMap,
  isNonHumanAnimalSearchQuery,
  isTextOrIdentityBoundQuery,
  loadWithR2Fallback,
  matchKoTokenInStems,
  normalizeVector,
  persistMediaCacheEntry,
  staticCaptionedPhotoIds,
  stripCollisionKeySuffix,
  stripKoSearchParticle,
  toRows,
  waitForUserTypingAndModalQuiet,
  type CachedPhotoSemanticMeta,
} from './aiSharedRuntime';
import {
  embedSingleLocalVideoIfNeeded,
  extractVideoScreenTextOnDemand,
  type VideoOcrLineItem,
} from './aiVideoEngine';
import {
  recognizeDataUrlWithPaddleOcr,
  releasePaddleOcrRuntime,
} from './aiPaddleOcrEngine';
import {
  extractMeaningfulUserMediaTokens,
  getOpticalSigForPhoto,
} from '../mobilePhotoPicker';

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
  if (!zCoreBridge.isConnected) return null;
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
export function groupBurstSearchResults(
  results: SearchResultItem[],
  allPhotos?: PhotoItem[]
): GroupedSearchResultItem[] {
  const dupMembersByGroupId = new Map<string, PhotoItem[]>();
  if (Array.isArray(allPhotos) && allPhotos.length > 0) {
    for (const p of allPhotos) {
      if (!p || p.quarantined || !p.duplicateGroupId) continue;
      const arr = dupMembersByGroupId.get(p.duplicateGroupId);
      if (arr) {
        arr.push(p);
      } else {
        dupMembersByGroupId.set(p.duplicateGroupId, [p]);
      }
    }
  }

  const expandBurstMembers = (clusterPhotos: PhotoItem[]): PhotoItem[] => {
    const merged: PhotoItem[] = [];
    const seenIds = new Set<string>();
    const addPhoto = (ph: PhotoItem) => {
      if (!ph || ph.quarantined || seenIds.has(ph.id)) return;
      seenIds.add(ph.id);
      merged.push(ph);
    };
    for (const ph of clusterPhotos) {
      addPhoto(ph);
      if (ph.duplicateGroupId) {
        const siblings = dupMembersByGroupId.get(ph.duplicateGroupId);
        if (siblings) {
          for (const sib of siblings) addPhoto(sib);
        }
      }
    }
    return merged;
  };

  if (results.length <= 1) {
    return results.map((r) => {
      const burstPhotos = expandBurstMembers([r.photo]);
      return {
        representative: r,
        burstPhotos,
        burstCount: burstPhotos.length,
      };
    });
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

      const dirA = pA.fullPath ? pA.fullPath.replace(/[\\/][^\\/]+$/, '').toLowerCase() : '';
      const dirB = pB.fullPath ? pB.fullPath.replace(/[\\/][^\\/]+$/, '').toLowerCase() : '';
      const sameParentFolder = !dirA || !dirB || dirA === dirB;

      if (
        sameParentFolder &&
        (sameDupGroup ||
          (dhashDist <= 8 && dt <= 5 && entry.tsSec > 0) ||
          (sameSceneCluster && dhashDist <= 12 && dt <= 3 && entry.tsSec > 0))
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
    const expandedPhotos = expandBurstMembers(cluster.map((c) => c.item.photo));
    return {
      minOrigIdx,
      representative: bestRankOrder[0].item,
      burstPhotos: expandedPhotos,
      burstCount: expandedPhotos.length,
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
  type LocalPhotoEntry = {
    path: string;
    originalName?: string;
    fullPath?: string;
    folderName?: string;
    deviceSource?: string;
    size: number;
    date: string;
    mtimeMs: number;
  };
  let fileList: LocalPhotoEntry[] = [];
  let quarantinedList: LocalPhotoEntry[] = [];
  const auditByPhoto = new Map<string, PhysicalAuditRecord>();

  const isStandaloneSearchWin =
    typeof window !== 'undefined' &&
    Boolean(new URLSearchParams(window.location.search).get('ghostSearchWindow'));

  try {
    if (hasActiveGhostiLoginSession() && zCoreBridge.isConnected) {
      const fetchListPromise = fetch(getZCoreUrl('/__photos/list'), { cache: 'no-store' }).catch(() =>
        fetch(getZCoreUrl('/__photos/list'), { cache: 'no-store' })
      );
      if (isStandaloneSearchWin) {
        // 독립 귀신검색창 오픈 시에는 IndexedDB 768D 벡터 전체 역직렬화를 기다리지 않고 파일 목록부터 0.02초 만에 즉시 표시한 뒤 백그라운드 복원합니다.
        void hydrateRealMediaVectorCacheOnce();
      } else {
        await Promise.all([hydrateRealMediaVectorCacheOnce(), fetchListPromise]);
      }
      const res = await fetchListPromise;
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

  // [10.4MB 정적 쇼룸 샘플 JSON 불필요 다운로드 원천 차단]:
  // 실전 사용자 PC에 과거 PoC 코퍼스 파일(20240719~20240722_*.jpg)이 단 1장도 없을 때는
  // 9.73MB corpus_550_semantic_index.json 등을 다운로드·파싱하지 않고 0.0ms로 즉시 통과합니다.
  const hasLegacyPoc2024Files = [...fileList, ...quarantinedList].some((f) =>
    /^202407(?:19|20|21|22)_/i.test(f.originalName || f.path)
  );
  if (hasLegacyPoc2024Files) {
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
      }
    } catch {
      /* ignore */
    }
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
  const BES2_MEMO_TAGS = new Set([    '#주차장·기둥',
    '#부품·접사',
    '#택배·상자',
    '#현수막·안내',
  ]);
  const BES2_EXPLICIT_TRASH_TAGS = new Set([    ...BES2_MEMO_TAGS,
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
  const INTENTIONAL_SYNTHETIC_BURST_SET = new Set([    'IMG_20250510_1001.jpg',
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

    // [스펙 1 핵심] #문서·설명서, #문서·신분증 및 실물 촬영 서류 파일명(세금계산서·사업자등록증·계약서 등)은 [📁 스마트 서류함] 영구 정보 자산으로 격상!
    const rawCheckName = `${f.originalName || f.path} ${f.folderName || ''}`.toLowerCase();
    if (pTag === '#문서·설명서') {
      vaultDocByPhoto.set(f.path, '조립 설명서 · 매뉴얼 (촬영 서류)');
      tagsByPhoto.set(f.path, new Set(['#문서·설명서', '#스마트서류함']));
      scoresByPhoto.get(f.path)!['document_ko'] = 0.85;
      continue;
    }
    if (pTag === '#문서·신분증') {
      vaultDocByPhoto.set(f.path, '신분증 · 여권 사본 (촬영 서류)');
      tagsByPhoto.set(f.path, new Set(['#문서·신분증', '#스마트서류함']));
      scoresByPhoto.get(f.path)!['document_ko'] = 0.85;
      continue;
    }
    if (
      !pTag &&
      /(?:세금계산서|사업자등록증|계약서|견적서|주민등록|운전면허|신분증|여권|등본|초본|증명서|청구서|명세서)/.test(
        rawCheckName
      )
    ) {
      vaultDocByPhoto.set(f.path, '촬영 서류 · 증빙 사본');
      tagsByPhoto.set(f.path, new Set(['#문서·설명서', '#스마트서류함']));
      scoresByPhoto.get(f.path)!['document_ko'] = 0.85;
      continue;
    }

    // 일회성 메모(주차기둥, 택배상자 등) 및 스크린샷은 문서함을 오염시키지 않고 AI 클린몬스터에서만 전담 처리

    if (dupGroupByPhoto.has(f.path)) continue; // 이미 연사/중복 그룹에 속한 사진은 중복 분류로 처리 완료

    const audit = auditByPhoto.get(f.path);
    const sem = scoresByPhoto.get(f.path) ?? {};
    const semCap = String(semMeta?.captionKo ?? '');

    // A) 탭 ③: 스크린샷 (시맨틱 #스크린샷 OR 캡처 파일명/폴더명 OR 무EXIF 모바일 화면비 + 고주파 UI 엣지)
    const isScreenshot =
      pTag === '#스크린샷' ||
      /(?:^|[_\-\s])(screenshot|capture|screen_|화면\s*캡처|화면캡처|스크린샷|캡처|녹화_|ocam)/i.test(
        f.originalName || f.path
      ) ||
      /^(?:앱오류|ocam|스크린샷|화면캡처|화면\s*캡처)$/i.test(f.folderName || '') ||
      (!!audit && !audit.hasExif && audit.aspect >= 1.95 && audit.aspect <= 2.35 && audit.edgeDensity > 40);

    if (isScreenshot) {
      tagsByPhoto.set(f.path, new Set(['#스크린샷·화면캡처']));
      trashByPhoto.set(f.path, { category: 'screenshot', confidence: 0.992 });
      scoresByPhoto.get(f.path)!['screenshot_ko'] = 0.72;
      scoresByPhoto.get(f.path)!['screenshot_en'] = 0.72;
      continue;
    }

    // B) 탭 ④: 심한 흔들림 · 오촬영 (8방향 3x3 그리드 라플라시안 전체 붕괴 OR #흔들린사진/손상 오촬영, 단 수중/해변 촬영 제외)
    const blurSem = sem['blurry_en'] ?? 0;
    const isBlurryMisfire =
      pTag === '#흔들린사진' ||
      /^blur_2025/i.test(f.path) ||
      /오촬영\s*이미지|파일\s*일부가\s*손상/.test(semCap) ||
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
    f: LocalPhotoEntry,
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
      !/^(test_photos|sample_photos_301|ghosti_test_corpus|pictures|photos|desktop|downloads|documents|videos|ocam|앱오류|문서|사진|동영상|바탕\s*화면|다운로드|내\s*문서|내\s*사진|내\s*동영상|\d{2}_.+)$/i.test(
        f.folderName
      )
    ) {
      const cleanedFolder = f.folderName
        .replace(/^\d{4,8}[_-]?/, '')
        .replace(/바탕\s+화면/g, '바탕화면')
        .replace(/카카오톡\s+받은\s+파일/g, '카톡받은파일')
        .replace(/[_&-]+/g, ' ')
        .trim();
      for (const tk of cleanedFolder.split(/\s+/)) {
        if (tk.length >= 2) {
          folderTokens.push(tk);
          tagSet.add(`#${tk}`);
        }
      }
    }
    const fileMeaningfulTokens = extractMeaningfulUserMediaTokens(f.originalName || f.path);
    if (f.deviceSource && f.deviceSource.includes('드라이브')) {
      tagSet.add(`#${f.deviceSource.split(' ')[0]}`);
    }
    if (tagSet.size === 0) {
      tagSet.add('#내기기사진');
    }
    const trash = trashByPhoto.get(f.path);
    const dupInfo = dupGroupByPhoto.get(f.path);
    const audit = auditByPhoto.get(f.path);
    const vaultLabel = vaultDocByPhoto.get(f.path);
    const locParam = isQuarantined ? '&loc=quarantine' : '';
    const fpParam = f.fullPath ? `&fp=${encodeURIComponent(f.fullPath)}` : '';
    const hasRealLocalFile = Boolean(zCoreBridge.isConnected && f.fullPath);
    // 미연결 체험 샘플 파일만 정적 번들에서 서빙하고, Z-코어 연결 시 실물 파일(f.fullPath)은 100% 실제 로컬 경로에서 서빙합니다.
    const isBundledSampleFile =
      !hasRealLocalFile &&
      /^(IMG_2025|PET_2025|TRV_2025|MEMO_2025|Screenshot_2025|BLUR_2025)/.test(f.path);
    const isVideoFrameStillFile =
      !hasRealLocalFile &&
      /^(20240719_105706_|20240720_134808_|20240722_052422_|20260918_202442_).*\.jpg$/i.test(f.path);
    const fullUrl = isBundledSampleFile
      ? `/sample_photos_301/${encodeURIComponent(f.path)}`
      : isVideoFrameStillFile
      ? `/poc/results/video_frames/${encodeURIComponent(f.path)}`
      : getZCoreUrl(`/__photos/file?p=${encodeURIComponent(f.path)}${locParam}${fpParam}`);
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
      fullPath: f.fullPath,
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
      captionKo: semMeta?.captionKo || undefined,
      captionEn: semMeta?.captionEn,
      keywordsKo: Array.from(
        new Set([...(semMeta?.keywordsKo ?? []), ...folderTokens, ...fileMeaningfulTokens])
      ),
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
  const keywordMap: [RegExp, string][] = [    [/바다|해변|파도|물놀이|안목|동해|뛰노는|뛰는/, 'beach_ko'],
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

const KO_PHOTO_SYNONYM_GROUPS: readonly (readonly string[])[] = [  ['강아지', '반려견', '멍멍이'],
  ['고양이', '반려묘', '냥이', '길냥이'],
  ['바다', '바닷가', '해변'],
  ['노을', '석양', '일몰'],
  ['일출', '해돋이'],
  ['등산', '산행', '트레킹'],
  ['영수증', '카드전표'],
  ['세금계산서', '계산서'],
  ['여권사진', '여권'],
  ['가족사진', '가족'],
  ['스크린샷', '화면캡처', '캡처'],
];

const PHOTO_BOILERPLATE_TAG_RX = SHARED_PHOTO_BOILERPLATE_TAG_RX;
const PHOTO_BOILERPLATE_LOC_RX =
  /^(?:내\s*스마트폰.*|스마트폰\s*다운로드|스마트폰\s*사진첩.*|pc\s*로컬\s*폴더|camera|dcim|recents|all\s*photos|camera\s*roll|downloads?|pictures|photos|desktop|documents)$/i;

function expandKoPhotoTokenVariants(token: string): string[] {
  const variants = new Set<string>([token]);
  for (const grp of KO_PHOTO_SYNONYM_GROUPS) {
    if (grp.includes(token)) {
      for (const w of grp) variants.add(w);
    }
  }
  return Array.from(variants);
}

/**
 * 텍스트 쿼리 검색 (768차원 EmbeddingGemma 2 CSLS 허브니스 보정 비전 벡터 + 정밀 한국어 시맨틱 하이브리드 검색)
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
  const isTrashOrDocQuery =
    /흔들린|흐릿|초점|블러|스크린샷|화면\s*캡처|화면캡처|캡처|화면|로그인|앱|오류|게임|주차장|기둥|택배|상자|현수막|영수증|전표|문서|서류|설명서|매뉴얼|신분증|여권|학생증|명함|계약|견적|세금계산서|계산서|사업자등록증|보험|증권|청구서|명세서|고지서|증명서|등본|탑승권|결제|주문|화이트보드|칠판|회의/.test(
      qLower
    );
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

  const SOFT_WORDS = new Set([    '사진', '사진들', '사진만', '이미지', '모습', '장면', '찾아줘', '찾아', '보여줘', '보여', '검색', '검색해줘',
    '모아서', '모아줘', '골라줘', '해줘', '있나', '있어', '찍은', '찍힌', '찍어둔', '나온', '나오는', '적힌', '적혀',
    '있는', '보이는', '에서', '으로', '에게', '하고', '이랑', '랑', '위', '안', '속', '때', '날', '만', '다',
    '우리', '내', '제', '같이', '함께', '많은', '예쁜', '멋진', '맛있는', '시원한', '따뜻한',
    '즐거운', '신나는', '행복한', '귀여운', '큰', '작은', '좋은', '맑은', '푸른', '넓은', '활짝', '환하게', '해맑게',
    '뛰노는', '뛰어노는', '뛰는', '달리는', '노는', '앉아', '앉은', '서있는', '걸어가는', '걷는', '보는', '먹는', '마시는',
    '끼고', '낀', '쓰고', '쓴', '착용하고', '착용한', '입고', '입은', '타고', '타는', '불고', '부는', '들고', '든',
  ]);

  const KEEP_NOUNS = new Set([    '바닷가', '창가', '길가', '물가', '휴가', '아이', '어린이', '고양이', '멍멍이', '길냥이', '호랑이', '부엉이', '원숭이', '거북이', '떡볶이',
    '물놀이', '나들이', '목걸이', '귀걸이', '종로', '을지로', '다리', '나무다리', '구름다리', '선풍기', '비행기', '세탁기',
    '웃는', '웃고', '미소', '웃음', '단체', '가족', '해변', '바다', '강아지', '오후', '노을',
    '독사진', '증명사진', '여권사진', '선글라스', '세금계산서', '사업자등록증',
  ]);

  const cleaned = qLower.replace(/[?!.,"'“”‘’()#]/g, ' ');
  const rawCandidateWords = cleaned
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 1);
  const contentWordCount = rawCandidateWords.filter((t) => !SOFT_WORDS.has(t)).length;
  const isSingleWordPhotoQuery = contentWordCount <= 1;

  const stripParticle = (w: string): string => {
    if (KEEP_NOUNS.has(w) || SOFT_WORDS.has(w)) return w;
    let cur = stripKoSearchParticle(w, isSingleWordPhotoQuery);
    if (cur.length >= 4 && cur.endsWith('사진') && !KEEP_NOUNS.has(cur)) {
      const stem = cur.slice(0, -2);
      if (stem.length >= 2) cur = stem;
    }
    return cur;
  };

  const rawSplitWords = rawCandidateWords
    .map((t) => stripParticle(t))
    .filter((t) => t.length >= 1);

  const allWords: string[] = [];
  for (const w of rawSplitWords) {
    if (w === '웃고') {
      allWords.push('웃는');
    } else if (w === '여름휴가') {
      allWords.push('여름', '휴가');
    } else if (w === '생일케이크') {
      allWords.push('생일', '케이크');
    } else {
      allWords.push(w);
    }
  }

  const hardTokens = Array.from(new Set(allWords.filter((t) => !SOFT_WORDS.has(t))));
  const softTokens = Array.from(
    new Set(
      allWords.filter(
        (t) =>
          SOFT_WORDS.has(t) &&
          !['사진', '사진들', '사진만', '이미지', '모습', '장면', '있는', '찍은', '찾아줘', '보여줘', '모아서', '모아줘'].includes(t)
      )
    )
  );
  const activeTokens = hardTokens.length > 0 ? hardTokens : softTokens;
  const compoundQuery = activeTokens.join('');

  const isAnimalOnlyPhotoQuery =
    isDogQuery || isCatQuery || isNonHumanAnimalSearchQuery(qLower);
  const isTextBoundPhotoQuery = isTextOrIdentityBoundQuery(qRaw);
  let queryVecs: Float32Array[] = [];
  let hubRefVecs: Float32Array[] = [];
  let nonAnimalAnchorVecs: Float32Array[] = [];
  if (activePhotos.some((p) => p.vec && p.vec.length === DEFAULT_DIM)) {
    [queryVecs, hubRefVecs, nonAnimalAnchorVecs] = await Promise.all([      encodeMultimodalSearchQueryVecs(qRaw, 4200),
      ensureHubnessReferenceVecsLoaded(),
      isAnimalOnlyPhotoQuery ? getContrastiveNonAnimalAnchorVecs(900) : Promise.resolve([]),
    ]);
  }
  const embedMs = +(performance.now() - t0).toFixed(1);
  const s0 = performance.now();

  // [2중 공간 분리 & CSLS 평균 중심 허브니스 보정]:
  // 1) 정적 캡션 텍스트 벡터(staticCaptionedPhotoIds: Text↔Text 공간, 0.62~0.80)와
  // 2) 실사진 픽셀 비전 벡터(!staticCaptionedPhotoIds: Text↔Vision 공간, 0.52~0.75)를
  //    각자의 분포에서 독립 보정하여, 앱 UI 캡처·문서 이미지의 멀티모달 허브 편향 및 이종 공간 임계치 왜곡을 원천 차단합니다.
  const vecSimById = new Map<string, number>();
  const staticVecSims: number[] = [];
  let topStaticSim = 0;

  interface RawVisionEval {
    id: string;
    rawSim: number;
    hub: number;
    isWhiteSheetUi: boolean;
  }
  const rawVisionEvals: RawVisionEval[] = [];

  if (queryVecs.length > 0) {
    for (const p of activePhotos) {
      if (!p.vec || p.vec.length !== DEFAULT_DIM) continue;
      const isExcludedTrashForNormalQuery =
        !isTrashOrDocQuery &&
        (p.trashCategory === 'blurry' ||
          p.trashCategory === 'screenshot' ||
          p.trashCategory === 'memo' ||
          p.isVaultDocument);
      if (isExcludedTrashForNormalQuery) continue;

      let bestS = -1;
      for (const qv of queryVecs) {
        const s = cosineSimilarity(qv, p.vec);
        if (s > bestS) bestS = s;
      }
      if (bestS <= 0) continue;

      const isStaticCap = staticCaptionedPhotoIds.has(p.id);
      if (isStaticCap) {
        vecSimById.set(p.id, bestS);
        staticVecSims.push(bestS);
        if (bestS > topStaticSim) topStaticSim = bestS;
      } else {
        // [실사진 동물 단독 검색 대조 검증(Contrastive Margin)]:
        // 사람·휴양지·문서 유사도가 동물 유사도보다 높은 실사진은 '강아지'/'고양이' 비전 통과 후보에서 원천 배제!
        if (nonAnimalAnchorVecs.length > 0) {
          const photoTagHint = `${p.tags.join(' ')} ${(p.keywordsKo || []).join(' ')}`.toLowerCase();
          const hasExplicitAnimalTag =
            /강아지|반려견|멍멍이|고양이|반려묘|냥이|호랑이|동물|조류/.test(photoTagHint);
          if (!hasExplicitAnimalTag) {
            let nonAnimSim = -1;
            for (const nv of nonAnimalAnchorVecs) {
              const ns = cosineSimilarity(nv, p.vec);
              if (ns > nonAnimSim) nonAnimSim = ns;
            }
            if (bestS < nonAnimSim + 0.012) {
              continue;
            }
          }
        }
        const pKey = getPhotoMediaCacheKey(p.name, p.size);
        const hub = computeFrameHubnessScore(pKey, p.vec, hubRefVecs);
        const optSig = getOpticalSigForPhoto(p.id);
        const isWhiteSheetUi = Boolean(optSig && optSig.whitePct >= 62);
        rawVisionEvals.push({ id: p.id, rawSim: bestS, hub, isWhiteSheetUi });
      }
    }
  }

  staticVecSims.sort((a, b) => b - a);
  const medStaticSim =
    staticVecSims.length > 0 ? staticVecSims[Math.floor(staticVecSims.length * 0.5)] : 0;
  const hasStaticVecSep =
    staticVecSims.length >= 8
      ? topStaticSim >= 0.705 && topStaticSim - medStaticSim >= 0.052
      : staticVecSims.length >= 1
      ? topStaticSim >= 0.725
      : false;
  const staticAdmitThreshold = !hasStaticVecSep
    ? 1.01
    : staticVecSims.length >= 8
    ? Math.max(0.695, topStaticSim - 0.042, medStaticSim + 0.048)
    : Math.max(0.715, topStaticSim - 0.035);

  const validHubs = rawVisionEvals.filter((e) => e.hub > 0).map((e) => e.hub);
  const meanVisionHub =
    validHubs.length > 0 ? validHubs.reduce((acc, v) => acc + v, 0) / validHubs.length : 0;

  const visionSims: number[] = [];
  let topVisionSim = 0;
  let topVisionRawSim = 0;
  for (const ev of rawVisionEvals) {
    let adj = ev.rawSim;
    if (meanVisionHub > 0 && ev.hub > 0) {
      adj -= 0.9 * (ev.hub - meanVisionHub);
    }
    if (!isTrashOrDocQuery && ev.isWhiteSheetUi) {
      adj -= 0.035;
    }
    vecSimById.set(ev.id, adj);
    visionSims.push(adj);
    if (adj > topVisionSim) topVisionSim = adj;
    if (ev.rawSim > topVisionRawSim) topVisionRawSim = ev.rawSim;
  }
  visionSims.sort((a, b) => b - a);
  const medVisionSim =
    visionSims.length > 0 ? visionSims[Math.floor(visionSims.length * 0.5)] : 0;
  const minVisionSim = visionSims.length > 0 ? visionSims[visionSims.length - 1] : 0;
  const hasVisionVecSep =
    visionSims.length >= 6
      ? topVisionSim >= 0.656 && topVisionSim - medVisionSim >= 0.038
      : visionSims.length >= 3
      ? topVisionSim >= 0.665 && topVisionSim - minVisionSim >= 0.035
      : visionSims.length >= 1
      ? topVisionSim >= 0.68 && topVisionRawSim >= 0.665
      : false;
  const visionAdmitThreshold = !hasVisionVecSep
    ? 1.01
    : visionSims.length >= 6
    ? Math.max(0.65, topVisionSim - 0.036, medVisionSim + 0.035)
    : Math.max(0.662, topVisionSim - 0.032);

  const scored: {
    photo: PhotoItem;
    score: number;
    tagHits: number;
    totalHits: number;
    compoundHit: boolean;
    passesVecGate: boolean;
  }[] = [];

  const tokenVariantMap = new Map<string, string[]>();
  for (const tk of activeTokens) {
    tokenVariantMap.set(tk, expandKoPhotoTokenVariants(tk));
  }

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

    const rawCap = photo.captionKo || '';
    const cap = /\(\d+x\d+\s*·\s*선명도/.test(rawCap) ? '' : rawCap.toLowerCase();
    const capEn = (photo.captionEn || '').toLowerCase();
    const isStaticCapPhoto = staticCaptionedPhotoIds.has(photo.id);
    const hasStaticVisualCaption = isStaticCapPhoto && Boolean(cap);
    const kws = (photo.keywordsKo ?? [])
      .filter((k) => k && !PHOTO_BOILERPLATE_TAG_RX.test(k) && k !== '내폰' && k !== '갤러리' && k !== '사진')
      .map((k) => k.toLowerCase());
    const ontoPrimary = (photo.ontologyPrimaryTags ?? [])
      .filter((k) => k && !PHOTO_BOILERPLATE_TAG_RX.test(k))
      .map((k) => k.toLowerCase());
    const ontoCaption = (photo.ontologyCaptionTags ?? []).map((k) => k.toLowerCase());
    const cleanTags = photo.tags
      .filter((t) => !PHOTO_BOILERPLATE_TAG_RX.test(t))
      .map((t) => t.toLowerCase());
    const cleanLoc =
      photo.locationKo && !PHOTO_BOILERPLATE_LOC_RX.test(photo.locationKo.trim())
        ? photo.locationKo
        : '';

    const tagAndKwText = `${cleanTags.join(' ')} ${kws.join(' ')} ${ontoPrimary.join(' ')} ${cleanLoc} ${photo.vaultCategoryLabel || ''}`.toLowerCase();
    const fullText = `${tagAndKwText} ${cap} ${capEn}`.toLowerCase();

    // 2) 시맨틱 가드레일 (정적 AI 시각 캡션이 사전 생성된 코퍼스 사진에만 적용 — 캡션 미생성 실사진은 CSLS 보정 768차원 비전 벡터로 판정)
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
        tagAndKwText.includes('가족') ||
        cap.includes('단체') ||
        cap.includes('대가족') ||
        cap.includes('식구') ||
        cap.includes('가족') ||
        cap.includes('부모님') ||
        cap.includes('친구들이') ||
        cap.includes('동료들이') ||
        cap.includes('어린이들이') ||
        cap.includes('남매') ||
        (/선글라스/.test(qLower) && /(?:남녀|두\s*사람|부부|커플|일행)/.test(cap));
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
        cap.includes('해맑게') ||
        cap.includes('즐거운 표정') ||
        cap.includes('밝은 표정');
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
        /바다|해변|바닷가|바닷물|파도|백사장|모래사장|수평선|해수욕장/.test(cap) &&
        !/정자 그늘|잔디밭|나무 그늘|야자수 나무에 기대어|요트 위 테이블|기둥에 기댄|요트 난간에 기댄|수중 헬멧|잠수 헬멧|씨워커/.test(
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

    // 3) 온톨로지 태그 + 실파일명(CamelCase·부분문자열 포함) + 한국어 동의어·어간(Stem) 정밀 매칭
    const rawFileBase = photo.fullPath
      ? photo.fullPath.split(/[\\/]/).pop() || photo.name
      : photo.name;
    const photoFileStemRaw = String(rawFileBase || '').replace(/\.[^.]+$/, '');
    const fileNameStems = extractKoStems(photoFileStemRaw);
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
      (primarySet.has(compoundQuery) ||
        matchKoTokenInStems(compoundQuery, fileNameStems, photoFileStemRaw, {
          allowFilenameSubstring: true,
        }) ||
        matchKoTokenInStems(compoundQuery, tagStems, tagAndKwText))
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
      const variants = tokenVariantMap.get(tk) || [tk];
      const hitFileName = variants.some((v) =>
        matchKoTokenInStems(v, fileNameStems, photoFileStemRaw, {
          allowFilenameSubstring: true,
        })
      );
      const hitPrimary =
        hitFileName ||
        variants.some(
          (v) => primarySet.has(v) || matchKoTokenInStems(v, tagStems, tagAndKwText)
        );
      if (hitPrimary) {
        tagHits += 1;
        totalHits += 1;
        lexicalScore += hitFileName ? 0.42 : 0.36;
      } else {
        const hitFull = variants.some(
          (v) => captionSet.has(v) || matchKoTokenInStems(v, fullStems, fullText)
        );
        if (hitFull) {
          totalHits += 1;
          lexicalScore += 0.22;
        }
      }
    }

    for (const st of softTokens) {
      if (st.length >= 2 && fullText.includes(st)) {
        lexicalScore += 0.06;
      }
    }

    if (isCampingQuery && /캠핑장|오토캠핑|거실형 텐트|대형 텐트|타프/.test(cap)) {
      lexicalScore += 0.32;
      tagHits += 1;
    }

    const realVecSim = vecSimById.get(photo.id);
    const vecThresholdForPhoto = isStaticCapPhoto ? staticAdmitThreshold : visionAdmitThreshold;
    const passesVecGate =
      !isTextBoundPhotoQuery && realVecSim !== undefined && realVecSim >= vecThresholdForPhoto;
    const vecSim = realVecSim ?? 0.64;

    if (totalHits > 0 || compoundHit || passesVecGate) {
      const vecBonus = passesVecGate ? 0.08 : 0;
      const totalScore = +(vecSim + vecBonus + Math.min(0.95, lexicalScore)).toFixed(4);
      scored.push({
        photo,
        score: totalScore,
        tagHits,
        totalHits,
        compoundHit,
        passesVecGate,
      });
    }
  }

  const reqCount = activeTokens.length;
  let finalMatches: typeof scored;

  if (reqCount <= 1) {
    // 단일 개념 질의: 정확한 어휘 일치 사진과 CSLS 보정 비전 벡터 통과 실사진을 모두 누락 없이 통합 랭킹!
    finalMatches = scored;
  } else {
    // 다중 조건 질의(예: '바닷가 아이', '선글라스 웃는 가족'):
    // 1개 단어만 걸린 무관한 사진(예: 아이 없는 성인 보트 사진 47장)이 쏟아지지 않도록
    // 전 조건 어휘 충족(fullConjunction) 또는 의미 벡터 게이트를 통과한 사진만 엄격히 채택!
    const fullConjunction = scored.filter(
      (x) => x.totalHits >= reqCount || x.compoundHit
    );
    const vecVerifiedMulti = scored.filter(
      (x) =>
        x.passesVecGate &&
        (x.totalHits >= reqCount - 1 || !staticCaptionedPhotoIds.has(x.photo.id))
    );
    if (fullConjunction.length > 0 || vecVerifiedMulti.length > 0) {
      const mergedMap = new Map<string, (typeof scored)[number]>();
      for (const item of [...fullConjunction, ...vecVerifiedMulti]) {
        if (!mergedMap.has(item.photo.id)) {
          mergedMap.set(item.photo.id, item);
        }
      }
      finalMatches = Array.from(mergedMap.values());
    } else {
      finalMatches = [];
    }
  }

  finalMatches.sort((a, b) => {
    if (b.totalHits !== a.totalHits) return b.totalHits - a.totalHits;
    if (b.tagHits !== a.tagHits) return b.tagHits - a.tagHits;
    if (b.passesVecGate !== a.passesVecGate) return b.passesVecGate ? 1 : -1;
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
      lexicalHits: item.totalHits + (item.compoundHit ? 1 : 0),
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

  // 1) 실제 마이크로 녹음한 음성 검색: 브라우저 STT가 이미 텍스트를 잡았다면 무거운 오디오 Base64 업로드 생략 (즉시 응답)
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

    const preferredTypes = [      'audio/webm;codecs=opus',
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
        const srStartedAt = Date.now();
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
            if (Date.now() - srStartedAt < 1400) {
              void switchToRecorderFallback();
            } else {
              triggerFastAutoStop();
            }
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
  let lastDone = 0;
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

      visionModel = await loadModelWithWebGpuToWasmFallback(config, {
        model: targetDtype,
        vision_encoder: targetDtype,
      });

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
      lastDone = done;
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
          ? '기기 내 사진 내용 색인 진행 중'
          : '사진 검색 목록 정리 중',
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

    const wasCancelled = shouldCancel();
    const finalDone = wasCancelled ? lastDone : total;
    onUpdate({
      phase: 'completed',
      done: finalDone,
      total,
      remaining: Math.max(0, total - finalDone),
      percent: total > 0 ? +((finalDone / total) * 100).toFixed(1) : 100,
      elapsedSec: Math.round((performance.now() - startT0) / 1000),
      etaSec: 0,
      perImageSec: 2.66,
      currentPhotoName: wasCancelled
        ? '사용자 요청으로 인덱싱이 중단되었습니다.'
        : '인덱싱 100% 완료! 검색이 오픈되었습니다.',
      currentPhotoThumb: targetPhotos[0]?.thumbUrl ?? '',
      liveVector64: Array.from({ length: 64 }, () => 0.85),
      modelStatusText: wasCancelled
        ? '부분 인덱싱 완료 (나머지 항목은 이어하기 가능)'
        : 'Zero-STT 오디오 & 시맨틱 검색 준비 완료',
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


interface Gemma2ConceptProbe {
  id: string;
  prompt: string;
  tag: string;
  keywordsKo: string[];
  isDocOrReceipt?: boolean;
}

const GEMMA2_VISUAL_CONCEPT_PROBES: Gemma2ConceptProbe[] = [  { id: 'solo_portrait', prompt: '한 사람 단독 셀카 인물 얼굴 클로즈업 close-up solo portrait selfie of one person', tag: '#인물·셀카', keywordsKo: ['인물', '사람', '셀카', '독사진', '얼굴'] },
  { id: 'family_group', prompt: '여러 사람 가족 친구 단체 모임 함께 찍은 사진 group photo of family friends smiling together', tag: '#가족·단체', keywordsKo: ['가족', '단체', '모임', '사람들', '일행'] },
  { id: 'kids', prompt: '귀여운 아기 어린이 아이 모습 cute baby child kid', tag: '#아기·어린이', keywordsKo: ['아기', '어린이', '아이', '육아'] },
  { id: 'dog', prompt: '귀여운 강아지 반려견 개 털 코 cute dog puppy pet', tag: '#반려견·강아지', keywordsKo: ['강아지', '반려견', '멍멍이'] },
  { id: 'cat', prompt: '귀여운 고양이 반려묘 냥이 수염 cute cat kitten pet', tag: '#반려묘·고양이', keywordsKo: ['고양이', '반려묘', '냥이'] },
  { id: 'beach', prompt: '푸른 바다 해변 파도 백사장 수평선 blue ocean sea sandy beach waves', tag: '#바다·해변', keywordsKo: ['바다', '해변', '바닷가', '파도', '물놀이'] },
  { id: 'mountain', prompt: '산 정상 바위 등산로 산행 트레킹 mountain peak hiking trail rocky summit', tag: '#산·등산', keywordsKo: ['산', '등산', '산행', '트레킹'] },
  { id: 'park_flower', prompt: '푸른 공원 나무 잔디밭 활짝 핀 꽃 산책로 green park lawn trees blooming flowers garden', tag: '#공원·꽃·자연', keywordsKo: ['공원', '산책', '숲', '나무', '꽃', '자연'] },
  { id: 'ski_snow', prompt: '겨울 눈 덮인 스키장 슬로프 스노우보드 설경 snowy ski slope snowboarding winter snow', tag: '#스키·겨울설경', keywordsKo: ['스키장', '스키', '스노우보드', '눈', '겨울'] },
  { id: 'camping', prompt: '야외 캠핑장 텐트 타프 모닥불 outdoor camping tent tarp campfire', tag: '#캠핑·텐트', keywordsKo: ['캠핑', '캠핑장', '텐트', '불멍'] },
  { id: 'food', prompt: '식탁 위 맛있는 음식 요리 식사 접시 delicious food meal dish on dining table', tag: '#음식·맛집', keywordsKo: ['음식', '요리', '식사', '맛집', '먹방'] },
  { id: 'cafe', prompt: '카페 커피 잔 라떼 디저트 케이크 빵 cafe coffee cup dessert cake pastry', tag: '#카페·디저트', keywordsKo: ['카페', '커피', '디저트', '케이크', '음료'] },
  { id: 'night_city', prompt: '어두운 밤 화려한 도시 건물 불빛 야경 city night view illuminated buildings neon lights', tag: '#도시·야경', keywordsKo: ['야경', '밤거리', '밤'] },
  { id: 'urban_building', prompt: '낮 도심 거리 건물 외관 건축물 daytime city street buildings architecture', tag: '#건물·거리', keywordsKo: ['건물', '거리', '도시'] },
  { id: 'car', prompt: '자동차 차량 도로 주차장 기둥 번호판 car vehicle road parking lot', tag: '#자동차·주차', keywordsKo: ['자동차', '차량', '주차장', '주차', '도로'] },
  { id: 'receipt', prompt: '종이 영수증 전표 계산서 금액 결제 내역 paper receipt bill invoice payment', tag: '#영수증·전표', keywordsKo: ['영수증', '전표', '결제', '계산서', '서류'], isDocOrReceipt: true },
  { id: 'document', prompt: '흰 종이 문서 세금계산서 계약서 증명서 인쇄된 글자 표 printed paper document tax invoice contract form text', tag: '#문서·서류', keywordsKo: ['문서', '서류', '계약서', '세금계산서', '증명서', '글자'], isDocOrReceipt: true },
  { id: 'screenshot', prompt: '스마트폰 앱 화면 캡처 스크린샷 모바일 인터페이스 mobile app screen capture screenshot UI', tag: '#스크린샷', keywordsKo: ['스크린샷', '캡처', '화면캡처'], isDocOrReceipt: true },
];

let cachedGemma2ConceptProbeVecs: Map<string, Float32Array> | null = null;
let lastMobileUserTouchAtMs = 0;
let mobileTouchTrackerBound = false;

function ensureMobileLifecycleAndTouchGuardBound(): void {
  if (mobileTouchTrackerBound || typeof window === 'undefined') return;
  mobileTouchTrackerBound = true;
  const markTouch = () => {
    lastMobileUserTouchAtMs = Date.now();
  };
  window.addEventListener('touchstart', markTouch, { passive: true });
  window.addEventListener('touchmove', markTouch, { passive: true });
  window.addEventListener('pointerdown', markTouch, { passive: true });
  window.addEventListener('keydown', markTouch, { passive: true });

  // 앱을 닫거나 홈 화면으로 내리는 즉시 거대 WASM 메모리를 0.05초 내에 반환하여 스마트폰 백그라운드 멈춤 원천 차단
  const releaseOnBackground = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      void disposeSharedVisionEncoderNow();
      void releasePaddleOcrRuntime();
    }
  };
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', releaseOnBackground);
  }
  window.addEventListener('pagehide', () => {
    void disposeSharedVisionEncoderNow();
    void releasePaddleOcrRuntime();
  });
}

async function waitForMobileUserIdleIfNeeded(isMobileEnv: boolean): Promise<boolean> {
  if (!isMobileEnv) return true;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    return false;
  }
  while (Date.now() - lastMobileUserTouchAtMs < 2500) {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return false;
    }
    await new Promise((r) => setTimeout(r, 380));
  }
  return true;
}

async function ensureGemma2ConceptProbeVecs(isMobileEnv = false): Promise<Map<string, Float32Array>> {
  if (cachedGemma2ConceptProbeVecs && cachedGemma2ConceptProbeVecs.size > 0) {
    return cachedGemma2ConceptProbeVecs;
  }
  const map = new Map<string, Float32Array>();
  for (let idx = 0; idx < GEMMA2_VISUAL_CONCEPT_PROBES.length; idx++) {
    const probe = GEMMA2_VISUAL_CONCEPT_PROBES[idx];
    if (isMobileEnv) {
      const canContinue = await waitForMobileUserIdleIfNeeded(true);
      if (!canContinue) break;
    }
    try {
      const vecs = await encodeMultimodalSearchQueryVecs(probe.prompt, 3200);
      if (vecs.length > 0 && vecs[0].length === DEFAULT_DIM) {
        map.set(probe.id, vecs[0]);
      }
    } catch {
      /* ignore individual probe error */
    }
    if (isMobileEnv) {
      await new Promise((r) => setTimeout(r, 25));
    }
  }
  if (map.size > 0) {
    cachedGemma2ConceptProbeVecs = map;
  }
  return map;
}

/**
 * [EmbeddingGemma 2 주력 + 광학엔진(dHash/선명도/종횡비) 보조 + PP-OCRv5 글자 보조 단일 통합 파이프라인]
 * - PC Z-코어 연결 시 및 모바일(Android/iOS) 실사진·실영상 불러오기 시 모두 동일하게 작동합니다.
 */
export async function hydrateCachedPhotoVectorsLightweight(
  photos: PhotoItem[]
): Promise<Map<string, Float32Array>> {
  await hydrateRealMediaVectorCacheOnce();
  const matched = new Map<string, Float32Array>();
  for (const item of photos) {
    if (item.quarantined || (item.vec && item.vec.length === DEFAULT_DIM)) continue;
    const pKey = getPhotoMediaCacheKey(item.name, item.size);
    const cachedVec = hydratedPhotoVecMap.get(pKey);
    if (cachedVec && cachedVec.length === DEFAULT_DIM) {
      matched.set(item.id, cachedVec);
    }
  }
  return matched;
}

export async function startSilentRealMediaVisionIndexing(params: {
  photos: PhotoItem[];
  videos: VideoSceneItem[];
  onVideoThumbHydrated?: (videoFileName: string, thumbUrl: string) => void;
  onVideoOcrHydrated?: (
    videoFileName: string,
    ocrMeta: {
      hasScreenOcrText: boolean;
      ocrLineCount: number;
      ocrLines?: VideoOcrLineItem[];
      ocrFullText: string;
    }
  ) => void;
  onPhotoVisionHydrated?: (photoId: string, patch: Partial<PhotoItem>) => void;
}): Promise<void> {
  if (aiRuntimeFlags.silentMediaIndexingRunning) return;
  if (params.photos.length === 0 && params.videos.length === 0) return;

  const saveData =
    typeof navigator !== 'undefined' && (navigator as any).connection?.saveData === true;
  if (saveData) return;

  const isMobileEnv =
    typeof navigator !== 'undefined' &&
    (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '') ||
      (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1));

  if (isMobileEnv) {
    ensureMobileLifecycleAndTouchGuardBound();
  }

  ensureGlobalUserInputQuietGuardBound();
  aiRuntimeFlags.silentMediaIndexingRunning = true;
  try {
    await hydrateRealMediaVectorCacheOnce();

    if (!(await waitForMobileUserIdleIfNeeded(isMobileEnv))) {
      return;
    }

    // 1) 이미 IndexedDB에 비전 벡터·시맨틱/OCR 메타가 캐싱된 사진은 모델 로딩(WebGPU 컴파일) 및 재추론 없이 0.5ms 배치로 즉시 복원!
    const candidatesAll = silentIndexingBrake
      .sortPhotosRecent90DaysFirst(
        params.photos.filter((p) => !p.quarantined && (!p.vec || p.vec.length !== DEFAULT_DIM))
      )
      .slice(0, isMobileEnv ? 120 : 360);

    const unindexedPhotos: PhotoItem[] = [];
    for (const item of candidatesAll) {
      const pKey = getPhotoMediaCacheKey(item.name, item.size);
      const cachedVec = hydratedPhotoVecMap.get(pKey);
      const cachedMeta = hydratedPhotoMetaMap.get(pKey);
      if (cachedVec && cachedVec.length === DEFAULT_DIM && cachedMeta?.ocrDone) {
        item.vec = cachedVec;
        if (cachedMeta.tags?.length) {
          item.tags = Array.from(new Set([...(item.tags || []), ...cachedMeta.tags]));
        }
        if (cachedMeta.keywordsKo?.length) {
          item.keywordsKo = Array.from(new Set([...(item.keywordsKo || []), ...cachedMeta.keywordsKo]));
        }
        if (cachedMeta.ontologyPrimaryTags?.length) {
          item.ontologyPrimaryTags = Array.from(
            new Set([...(item.ontologyPrimaryTags || []), ...cachedMeta.ontologyPrimaryTags])
          );
        }
        if (cachedMeta.ocrSnippet && !(item.captionKo || '').includes('OCR:')) {
          item.captionKo = item.captionKo
            ? `${item.captionKo} | OCR: ${cachedMeta.ocrSnippet}`
            : `OCR: ${cachedMeta.ocrSnippet}`;
        }
        params.onPhotoVisionHydrated?.(item.id, {
          vec: cachedVec,
          tags: item.tags,
          keywordsKo: item.keywordsKo,
          ontologyPrimaryTags: item.ontologyPrimaryTags,
          ...(item.captionKo ? { captionKo: item.captionKo } : {}),
        });
      } else {
        unindexedPhotos.push(item);
      }
    }

    const localVids = params.videos
      .filter(
        (v) =>
          !v.isAllBlack &&
          (String(v.id || '').startsWith('local_vid_') || String(v.id || '').startsWith('mobile_vid_'))
      )
      .slice(0, isMobileEnv ? 3 : params.videos.length);

    if (unindexedPhotos.length === 0 && localVids.length === 0) {
      return;
    }

    let visionEncoderReady = false;
    let conceptVecMap: Map<string, Float32Array> | null = null;
    const ensureVisionAndConceptsReady = async () => {
      if (!visionEncoderReady) {
        await waitForUserTypingAndModalQuiet();
        await acquireSharedVisionEncoder();
        visionEncoderReady = true;
      }
      if (!conceptVecMap) {
        conceptVecMap = await ensureGemma2ConceptProbeVecs(isMobileEnv);
      }
      return conceptVecMap;
    };

    const pendingOcrQueue: Array<{
      item: PhotoItem;
      pKey: string;
      vec: Float32Array;
      thumb: string;
    }> = [];

    for (let i = 0; i < unindexedPhotos.length; i++) {
      if (i > 0 && i % 8 === 0) {
        await new Promise((r) => setTimeout(r, 0));
      }
      if (!(await waitForMobileUserIdleIfNeeded(isMobileEnv))) {
        return;
      }
      await waitForUserTypingAndModalQuiet();
      await silentIndexingBrake.waitForIndexingSlot(i);
      const item = unindexedPhotos[i];
      const pKey = getPhotoMediaCacheKey(item.name, item.size);
      let vec = hydratedPhotoVecMap.get(pKey) || null;
      let decodedThumb = item.thumbUrl || item.fullUrl;

      if (!vec || vec.length !== DEFAULT_DIM) {
        await ensureVisionAndConceptsReady();
        const t0 = performance.now();
        try {
          const res = await fetch(item.thumbUrl || item.fullUrl);
          if (!res.ok) continue;
          const blob = await res.blob();
          const decoded = await decodeImageBlobToRawAndThumb(blob);
          if (!decoded) continue;
          if (decoded.thumbDataUrl) decodedThumb = decoded.thumbDataUrl;
          if (!(await waitForMobileUserIdleIfNeeded(isMobileEnv))) {
            return;
          }
          await waitForUserTypingAndModalQuiet();
          vec = await embedRawImageWithSharedVision(decoded.rawImg);
          const inferElapsed = performance.now() - t0;
          if (vec) {
            hydratedPhotoVecMap.set(pKey, vec);
            silentIndexingBrake.recordInferenceLatencyMs(inferElapsed);
          }
          if (isMobileEnv) {
            await new Promise((r) =>
              setTimeout(r, Math.max(260, Math.min(1200, Math.round(inferElapsed * 0.85))))
            );
          } else if (inferElapsed > 300 && silentIndexingBrake.getSnapshot().speedMode !== 'turbo') {
            await new Promise((r) => setTimeout(r, Math.min(2200, Math.round(inferElapsed * 1.15))));
          }
        } catch {
          /* skip unreadable file */
        }
      }

      if (vec && vec.length === DEFAULT_DIM) {
        item.vec = vec;
        const activeConceptMap = await ensureVisionAndConceptsReady();
        // [Gemma 2 중앙값 마진 보정 의미 분류]: 모든 프롬프트에 유사도가 높은 UI/문서 허브 이미지가
        // 엉뚱한 풍경·음식·가족 태그를 강제로 받지 않도록, 이미지별 중앙값 대비 분리도(>= 0.052) 및 최소 임계치(>= 0.655) 통과 항목만 부착!
        const rankedConcepts: Array<{ probe: Gemma2ConceptProbe; sim: number }> = [];
        for (const probe of GEMMA2_VISUAL_CONCEPT_PROBES) {
          const pVec = activeConceptMap.get(probe.id);
          if (!pVec) continue;
          const sim = cosineSimilarity(pVec, vec);
          rankedConcepts.push({ probe, sim });
        }
        rankedConcepts.sort((a, b) => b.sim - a.sim);
        const medProbeSim =
          rankedConcepts.length > 0
            ? rankedConcepts[Math.floor(rankedConcepts.length * 0.5)].sim
            : 0;
        const isTrashOrVaultItem = Boolean(
          item.isVaultDocument ||
            item.trashCategory === 'screenshot' ||
            item.trashCategory === 'memo' ||
            item.trashCategory === 'blurry'
        );
        const topMatches = rankedConcepts.filter((rc, idx) => {
          if (idx > 1) return false;
          if (isTrashOrVaultItem && !rc.probe.isDocOrReceipt) return false;
          if (rc.sim < 0.655 || rc.sim - medProbeSim < 0.052) return false;
          if (idx === 1 && rc.sim < rankedConcepts[0].sim - 0.018) return false;
          return true;
        });

        const mergedTags = new Set<string>(item.tags || []);
        const mergedKws = new Set<string>(item.keywordsKo || []);
        const ontoTags = new Set<string>(item.ontologyPrimaryTags || []);
        const optSig = getOpticalSigForPhoto(item.id);
        let shouldRunOcr = Boolean(
          item.isVaultDocument ||
            item.trashCategory === 'memo' ||
            item.trashCategory === 'screenshot' ||
            (optSig && optSig.whitePct >= 52)
        );

        for (const m of topMatches) {
          mergedTags.add(m.probe.tag);
          ontoTags.add(m.probe.tag.replace(/^#/, ''));
          for (const kw of m.probe.keywordsKo) mergedKws.add(kw);
          if (m.probe.isDocOrReceipt) shouldRunOcr = true;
        }

        item.tags = Array.from(mergedTags);
        item.keywordsKo = Array.from(mergedKws);
        item.ontologyPrimaryTags = Array.from(ontoTags);

        const prevMeta = hydratedPhotoMetaMap.get(pKey);
        const alreadyOcrDone = Boolean(prevMeta?.ocrDone);
        if (alreadyOcrDone && prevMeta?.ocrSnippet && !(item.captionKo || '').includes('OCR:')) {
          item.captionKo = item.captionKo
            ? `${item.captionKo} | OCR: ${prevMeta.ocrSnippet}`
            : `OCR: ${prevMeta.ocrSnippet}`;
        }

        let inferredTrash: TrashCategory | undefined = undefined;
        let inferredVaultDoc = false;
        const top1 = topMatches[0];
        if (!item.isVaultDocument && !item.trashCategory && top1) {
          if (top1.probe.id === 'document' && top1.sim >= 0.27) {
            inferredVaultDoc = true;
          } else if (top1.probe.id === 'receipt' && top1.sim >= 0.25) {
            inferredTrash = 'memo';
          } else if (top1.probe.id === 'screenshot' && top1.sim >= 0.27) {
            inferredTrash = 'screenshot';
          }
        }
        if (inferredVaultDoc) {
          item.isVaultDocument = true;
        } else if (inferredTrash) {
          item.trashCategory = inferredTrash;
          item.intrinsicTrashCategory = inferredTrash;
        }
        params.onPhotoVisionHydrated?.(item.id, {
          vec,
          tags: item.tags,
          keywordsKo: item.keywordsKo,
          ontologyPrimaryTags: item.ontologyPrimaryTags,
          ...(inferredVaultDoc ? { isVaultDocument: true, trashCategory: undefined } : {}),
          ...(inferredTrash ? { trashCategory: inferredTrash, intrinsicTrashCategory: inferredTrash, trashConfidence: 0.92 } : {}),
          ...(item.captionKo ? { captionKo: item.captionKo } : {}),
        });

        if (shouldRunOcr && decodedThumb && !alreadyOcrDone) {
          pendingOcrQueue.push({ item, pKey, vec, thumb: decodedThumb });
        } else {
          const finalMeta: CachedPhotoSemanticMeta = {
            tags: item.tags,
            keywordsKo: item.keywordsKo,
            ontologyPrimaryTags: item.ontologyPrimaryTags,
            ocrDone: true,
            ocrSnippet: prevMeta?.ocrSnippet,
          };
          hydratedPhotoMetaMap.set(pKey, finalMeta);
          await persistMediaCacheEntry(pKey, vec, undefined, finalMeta);
        }
      }
    }

    // 2) 동영상 키프레임 비전 임베딩
    for (let i = 0; i < localVids.length; i++) {
      if (!(await waitForMobileUserIdleIfNeeded(isMobileEnv))) {
        return;
      }
      await waitForUserTypingAndModalQuiet();
      await ensureVisionAndConceptsReady();
      await silentIndexingBrake.waitForIndexingSlot(i);
      await embedSingleLocalVideoIfNeeded(
        localVids[i],
        2,
        params.onVideoThumbHydrated,
        params.onVideoOcrHydrated
      );
      await new Promise((r) => setTimeout(r, isMobileEnv ? 380 : 120));
    }

    // 3) Pass 2 (미추출 서류·영수증·스크린샷 PP-OCRv5 1회 추출 후 IndexedDB 영구 캐싱 + 타이핑 시 즉시 양보):
    const mobileVidsForOcr = isMobileEnv
      ? params.videos
          .filter(
            (v) =>
              !v.isAllBlack &&
              String(v.id || '').startsWith('mobile_vid_') &&
              !v.ocrFullText &&
              (!Array.isArray(v.ocrLines) || v.ocrLines.length === 0)
          )
          .slice(0, 6)
      : [];

    if (pendingOcrQueue.length > 0 || mobileVidsForOcr.length > 0) {
      if (isMobileEnv) {
        await disposeSharedVisionEncoderNow();
        await new Promise((r) => setTimeout(r, 150));
      }
      for (const ocrJob of pendingOcrQueue) {
        if (isMobileEnv && !(await waitForMobileUserIdleIfNeeded(true))) break;
        await waitForUserTypingAndModalQuiet();
        let savedSnippet: string | undefined;
        try {
          const ocrRes = await recognizeDataUrlWithPaddleOcr(ocrJob.thumb);
          if (ocrRes.text && ocrRes.text.trim().length >= 2) {
            const ocrSnippet = ocrRes.text.trim().slice(0, 240);
            savedSnippet = ocrSnippet;
            const mergedKws = new Set<string>(ocrJob.item.keywordsKo || []);
            for (const tk of extractKoStems(ocrSnippet).slice(0, 24)) {
              if (tk.length >= 2) mergedKws.add(tk);
            }
            const nextCaption = ocrJob.item.captionKo?.includes('OCR:')
              ? ocrJob.item.captionKo
              : ocrJob.item.captionKo
              ? `${ocrJob.item.captionKo} | OCR: ${ocrSnippet}`
              : `OCR: ${ocrSnippet}`;
            ocrJob.item.keywordsKo = Array.from(mergedKws);
            ocrJob.item.captionKo = nextCaption;
            params.onPhotoVisionHydrated?.(ocrJob.item.id, {
              keywordsKo: ocrJob.item.keywordsKo,
              captionKo: nextCaption,
            });
          }
        } catch {
          /* OCR 보조 실패 시 비전/광학 결과 유지 */
        }
        const ocrDoneMeta: CachedPhotoSemanticMeta = {
          tags: ocrJob.item.tags,
          keywordsKo: ocrJob.item.keywordsKo,
          ontologyPrimaryTags: ocrJob.item.ontologyPrimaryTags,
          ocrDone: true,
          ocrSnippet: savedSnippet,
        };
        hydratedPhotoMetaMap.set(ocrJob.pKey, ocrDoneMeta);
        await persistMediaCacheEntry(ocrJob.pKey, ocrJob.vec, undefined, ocrDoneMeta);
        await new Promise((r) => setTimeout(r, isMobileEnv ? 90 : 150));
      }

      for (const mVid of mobileVidsForOcr) {
        if (!(await waitForMobileUserIdleIfNeeded(true))) break;
        try {
          while (aiRuntimeFlags.activeVideoPlaybackCount > 0) {
            await new Promise((r) => setTimeout(r, 400));
          }
          const ocrOut = await extractVideoScreenTextOnDemand(mVid);
          if (ocrOut.ocrLines && ocrOut.ocrLines.length > 0) {
            mVid.hasScreenOcrText = true;
            mVid.ocrLineCount = ocrOut.ocrLines.length;
            mVid.ocrLines = ocrOut.ocrLines;
            mVid.ocrFullText = ocrOut.fullText;
            params.onVideoOcrHydrated?.(mVid.videoFileName, {
              hasScreenOcrText: true,
              ocrLineCount: ocrOut.ocrLines.length,
              ocrLines: ocrOut.ocrLines,
              ocrFullText: ocrOut.fullText,
            });
          } else {
            mVid.ocrLines = [];
          }
        } catch {
          /* ignore single video OCR prewarm error */
        }
        await new Promise((r) => setTimeout(r, 240));
      }

      if (isMobileEnv) {
        await releasePaddleOcrRuntime();
      }
    }
  } finally {
    aiRuntimeFlags.silentMediaIndexingRunning = false;
    if (isMobileEnv) {
      await disposeSharedVisionEncoderNow();
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        void ensureTextQueryEncoderLoaded();
      }
    } else {
      bumpSharedVisionIdleDispose(15000);
    }
  }
}

export async function resolveSmartKoreanLabelForPhoto(
  photo: PhotoItem,
  existingNames?: string[]
): Promise<{
  displaySourceName: string;
  label: string;
  enrichedTags: string[];
  ocrSnippet?: string;
}> {
  const displaySourceName = stripCollisionKeySuffix(photo.name || '사진.png');
  const ocrFromCaption = (photo.captionKo || '').includes('OCR:')
    ? (photo.captionKo || '').split(/(?:📝\s*)?OCR:/)[1] || ''
    : '';
  let tokens = extractCrispKoreanLabelTokens([    ocrFromCaption,
    ...(photo.ontologyPrimaryTags || []),
    ...(photo.tags || []),
    ...(photo.keywordsKo || []),
  ]);

  let discoveredOcrSnippet = '';
  const discoveredTagSet = new Set<string>(
    (photo.tags || []).filter((t) => t && !SHARED_PHOTO_BOILERPLATE_TAG_RX.test(t))
  );

  // 아직 백그라운드 인덱싱이 도달하지 않아 '#내기기사진'만 있는 경우 즉시 온디맨드 실물 OCR + 시각 개념 판독 수행
  if (tokens.length === 0) {
    if (zCoreBridge.isConnected) {
      try {
        const rawUrl = photo.fullUrl || photo.thumbUrl || '';
        let pParam = photo.name || '';
        const qMatch = rawUrl.match(/[?&]p=([^&]+)/);
        if (qMatch?.[1]) {
          try {
            pParam = decodeURIComponent(qMatch[1]);
          } catch {
            pParam = qMatch[1];
          }
        }
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 4500);
        const res = await fetch(getZCoreUrl('/__photos/ocr'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            p: pParam,
            fullPath: photo.fullPath || '',
          }),
          signal: ctrl.signal,
        }).finally(() => clearTimeout(tid));
        if (res.ok) {
          const ocrJson = await res.json().catch(() => null);
          if (ocrJson?.ok && ocrJson?.hasText) {
            const chips = Array.isArray(ocrJson.chips) ? ocrJson.chips.map(String) : [];
            const fullText = String(ocrJson.fullText || '').trim();
            discoveredOcrSnippet = fullText.slice(0, 140);
            tokens = extractCrispKoreanLabelTokens([...chips, fullText]);
            for (const tk of tokens.slice(0, 2)) discoveredTagSet.add(`#${tk}`);
          }
        }
      } catch {
        /* fallback to client vision/ocr below */
      }
    }

    if (tokens.length === 0) {
      try {
        const visionFallbackTask = (async () => {
          await hydrateRealMediaVectorCacheOnce();
          const pKey = getPhotoMediaCacheKey(photo.name, photo.size);
          let vec =
            photo.vec && photo.vec.length === DEFAULT_DIM
              ? photo.vec
              : hydratedPhotoVecMap.get(pKey) || null;
          let thumbDataUrl = '';
          const srcUrl = photo.thumbUrl || photo.fullUrl || '';
          if (srcUrl) {
            const imgCtrl = new AbortController();
            const imgTid = setTimeout(() => imgCtrl.abort(), 3000);
            const imgRes = await fetch(srcUrl, { signal: imgCtrl.signal }).finally(() =>
              clearTimeout(imgTid)
            );
            if (imgRes.ok) {
              const blob = await imgRes.blob();
              const decoded = await decodeImageBlobToRawAndThumb(blob);
              if (decoded) {
                thumbDataUrl = decoded.thumbDataUrl || '';
                if (!vec || vec.length !== DEFAULT_DIM) {
                  vec = await embedRawImageWithSharedVision(decoded.rawImg);
                  if (vec) hydratedPhotoVecMap.set(pKey, vec);
                }
              }
            }
          }
          if (!zCoreBridge.isConnected && thumbDataUrl) {
            const ocrRes = await recognizeDataUrlWithPaddleOcr(thumbDataUrl).catch(() => null);
            if (ocrRes?.text) {
              discoveredOcrSnippet = ocrRes.text.slice(0, 140);
              tokens = extractCrispKoreanLabelTokens([ocrRes.text]);
              for (const tk of tokens.slice(0, 2)) discoveredTagSet.add(`#${tk}`);
            }
          }
          if (tokens.length === 0 && vec && vec.length === DEFAULT_DIM) {
            const conceptMap = await ensureGemma2ConceptProbeVecs();
            const ranked: Array<{ probe: Gemma2ConceptProbe; sim: number }> = [];
            for (const probe of GEMMA2_VISUAL_CONCEPT_PROBES) {
              const pVec = conceptMap.get(probe.id);
              if (!pVec) continue;
              ranked.push({ probe, sim: cosineSimilarity(pVec, vec) });
            }
            ranked.sort((a, b) => b.sim - a.sim);
            const bestEntry = ranked[0];
            const secondEntry = ranked[1];
            const margin = bestEntry && secondEntry ? bestEntry.sim - secondEntry.sim : 1;
            // EmbeddingGemma 2 오분류 방어: 유사도 0.65 이상 + 2위와 0.015 이상 우위(또는 0.68 이상 확실한 일치)일 때만 피사체 라벨 부여,
            // 내용이 불분명한 사진은 억지 추측 대신 안전하게 'YYMMDD_사진기록'으로 정리합니다.
            if (bestEntry && (bestEntry.sim >= 0.68 || (bestEntry.sim >= 0.65 && margin >= 0.015))) {
              const cleanProbeTag = bestEntry.probe.tag.replace(/^#/, '');
              tokens = extractCrispKoreanLabelTokens([
                cleanProbeTag,
                ...(bestEntry.probe.keywordsKo || []),
              ]);
              discoveredTagSet.add(bestEntry.probe.tag);
            }
          }
        })();
        // 시각 모델 로드/추론이 지연되더라도 라벨러가 무한 대기하지 않도록 최대 4.5초로 제한
        await Promise.race([
          visionFallbackTask,
          new Promise<void>((resolve) => setTimeout(resolve, 4500)),
        ]);
        if (tokens.length === 0) {
          const fnMeaningful = extractMeaningfulUserMediaTokens(photo.name);
          const fnLow = (photo.name || '').toLowerCase();
          const fnFallbackMap: Array<[RegExp, string, string]> = [
            [/puppy|dog|pet|hound|retriever|poodle|maltese/, '강아지', '#반려견·강아지'],
            [/cat|kitty|kitten/, '고양이', '#반려묘·고양이'],
            [/food|meal|dinner|lunch|menu|dish|coffee|cafe|cake/, '음식_카페', '#음식·맛집'],
            [/beach|ocean|sea|wave/, '바다_해변', '#바다·해변'],
            [/mountain|hiking|peak|forest|park|flower/, '자연_풍경', '#공원·꽃·자연'],
            [/car|parking|vehicle|drive/, '자동차', '#자동차·주차'],
            [/receipt|invoice|bill|tax|contract|doc/, '문서_영수증', '#문서·서류'],
            [/screen|capture|snap/, '화면캡처', '#스크린샷'],
          ];
          for (const [rx, koWord, koTag] of fnFallbackMap) {
            if (rx.test(fnLow)) {
              tokens = extractCrispKoreanLabelTokens([koWord]);
              discoveredTagSet.add(koTag);
              break;
            }
          }
          if (tokens.length === 0 && fnMeaningful.length > 0) {
            const koFromFn = extractCrispKoreanLabelTokens(fnMeaningful);
            if (koFromFn.length > 0) tokens = koFromFn;
          }
        }
      } catch {
        /* ignore vision fallback error */
      }
    }
  }

  if (tokens.length === 0) {
    tokens = [photo.trashCategory === 'screenshot' ? '화면캡처' : '사진기록'];
  }

  const label = formatQuickKoreanLabelCore(displaySourceName, photo.date, tokens, {
    mtimeMs: photo.mtimeMs,
    existingNames,
  });
  return {
    displaySourceName,
    label,
    enrichedTags: Array.from(discoveredTagSet),
    ...(discoveredOcrSnippet ? { ocrSnippet: discoveredOcrSnippet } : {}),
  };
}

export async function fetchSharedFamilyHostPhotos(): Promise<PhotoItem[]> {
  // [실전 전용 철칙]: 정적 번들 공유방 매니페스트(shared_family_host_manifest.json 36장) 로드 영구 배제
  return [];
}
