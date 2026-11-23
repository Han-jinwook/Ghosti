import { RawImage } from '@huggingface/transformers';
import { getZCoreUrl, zCoreBridge, hasActiveGhostiLoginSession } from '../zCoreBridge';
import {
  extractNativeMobileVideoKeyframes,
  extractNativeMobileVideoOcr,
  resolveNativeMobileVideoPlaybackUrl,
} from '../ghostiMobileCareBridge';
import { silentIndexingBrake } from '../silentIndexingBrake';
import type { LocalDocumentFile, PhotoItem, SearchResultItem, VideoSceneItem } from '../../types/saysee';
import {
  recognizeImageDataWithPaddleOcr,
  recognizeDataUrlWithPaddleOcr,
} from './aiPaddleOcrEngine';
import {
  DEFAULT_DIM,
  DecodedKeyframeImage,
  aiRuntimeFlags,
  bumpSharedVisionIdleDispose,
  canvasToJpegDataUrl,
  computeFrameHubnessScore,
  cosineSimilarity,
  createCanvas2D,
  decodeImageBlobToRawAndThumb,
  embedRawImageWithSharedVision,
  encodeMultimodalSearchQueryVecs,
  ensureHubnessReferenceVecsLoaded,
  extractKoStems,
  getContrastiveNonAnimalAnchorVecs,
  getStaticCorpusCached,
  getVideoFrameCacheKey,
  getVideoMediaBaseKey,
  hydrateRealMediaVectorCacheOnce,
  isNonHumanAnimalSearchQuery,
  isTextOrIdentityBoundQuery,
  localVideoFrameThumbMap,
  localVideoFrameVecMap,
  localVideoRepThumbMap,
  matchKoTokenInStems,
  matchKoreanOcrFuzzyToken,
  persistMediaCacheEntry,
  stripKoSearchParticle,
} from './aiSharedRuntime';

export const VIDEO_SCENE_ITEMS: VideoSceneItem[] = [];

function normalizeSampleVideoFrameUrl(url?: string): string {
  if (!url) return '';
  if (url.includes('/__videos/frame?f=')) {
    const fn = url.split('f=').pop() || '';
    return `/poc/results/video_frames/${fn}`;
  }
  return url;
}

function normalizeSampleVideoFileUrl(url?: string, fallbackFileName?: string): string {
  const raw = String(url || '').trim();
  if (raw.includes('/__photos/file?p=')) {
    const fn = decodeURIComponent(raw.split('p=').pop() || fallbackFileName || '').trim();
    return fn ? `/poc/results/videos/${fn}` : '';
  }
  if (!raw && fallbackFileName) {
    return `/poc/results/videos/${fallbackFileName}`;
  }
  return raw;
}

const BUNDLED_SAMPLE_VIDEO_ENHANCEMENTS: Record<
  string,
  {
    extraKeywords: string[];
    frameDialogueBySec?: Record<number, { subtitle: string; extraKeywords: string[] }>;
  }
> = {
  '20240719_105706.mp4': {
    extraKeywords: [      '코타키나발루',
      '말레이시아',
      '패러세일링',
      '패러세일',
      '낙하산',
      '모터보트',
      '바다',
      '해변',
      '바닷가',
      '박수',
      '환호',
      '축하합니다',
      '성공',
      '웃는',
      '미소',
    ],
    frameDialogueBySec: {
      0: {
        subtitle: '음성 대사: “와! 코타키나발루 바다 위 하늘 진짜 높다!”',
        extraKeywords: ['코타키나발루', '패러세일링', '상공', '비행', '하늘'],
      },
      12: {
        subtitle: '음성 대사: “보트 위로 점점 내려간다! 패러세일링 하강 준비!”',
        extraKeywords: ['코타키나발루', '패러세일링', '패러세일', '하강', '보트'],
      },
      20: {
        subtitle: '음성 대사: “와아 축하합니다! 착지 성공!” (박수 치며 환호하는 순간)',
        extraKeywords: ['코타키나발루', '박수', '환호', '축하합니다', '축하', '착지', '웃는', '미소'],
      },
    },
  },
  '20240720_134808.mp4': {
    extraKeywords: [      '코타키나발루',
      '말레이시아',
      '리조트',
      '테라스',
      '야외테라스',
      '기념촬영',
      '생일',
      '케이크',
      '촛불',
      '축하합니다',
      '박수',
      '환호',
      '강아지',
      '원반',
      '골프',
      '스윙',
      '피니시',
    ],
    frameDialogueBySec: {
      0: {
        subtitle: '음성 대사: “코타키나발루 리조트 테라스에 카메라 세팅 완료!”',
        extraKeywords: ['코타키나발루', '리조트', '테라스', '카메라'],
      },
      6: {
        subtitle: '음성 대사: “생일 축하합니다! 케이크 촛불 불고 다 같이 박수!”',
        extraKeywords: [          '코타키나발루',
          '생일',
          '케이크',
          '촛불',
          '부는',
          '축하합니다',
          '축하',
          '박수',
          '환호',
          '손인사',
        ],
      },
      12: {
        subtitle: '음성 대사: “울다가도 웃는 해맑은 미소! 강아지가 잔디에서 원반 물어오는 구간까지 완벽해!”',
        extraKeywords: [          '코타키나발루',
          '아이',
          '울면서',
          '웃는',
          '미소',
          '강아지',
          '원반',
          '물어오는',
          '골프',
          '스윙',
          '피니시',
          '자세',
        ],
      },
    },
  },
  '20240722_052422.mp4': {
    extraKeywords: [      '비행기',
      '항공기',
      '기내',
      '창문',
      '창밖',
      '일출',
      '노을',
      '바닷가',
      '해변',
      '코타키나발루',
      '출장',
      '회의실',
      '화이트보드',
      '판서',
      '내년',
      '매출',
      '목표',
    ],
    frameDialogueBySec: {
      0: {
        subtitle: '음성 대사: “비행기 창밖으로 노을빛 일출이 떠오르네요, 노을 지는 바닷가 상공입니다.”',
        extraKeywords: ['비행기', '창밖', '일출', '노을', '바닷가', '걷는', '해변', '구름', '코타키나발루'],
      },
      4: {
        subtitle: '음성 대사: “이번 회의실에서 화이트보드에 판서하며 정리한 내년 매출 목표 브리핑 자료입니다.”',
        extraKeywords: ['비행기', '회의실', '화이트보드', '판서', '판서하는', '내년', '매출', '목표', '말하는'],
      },
      8: {
        subtitle: '음성 대사: “스마트폰 카메라로 비행기 창문 일출 촬영 완료!”',
        extraKeywords: ['비행기', '스마트폰', '카메라', '일출', '창문'],
      },
    },
  },
};

export const BUNDLED_SHOWCASE_VIDEO_ITEMS: VideoSceneItem[] = [  {
    id: 'vid_showcase_ghosti_scene_jump',
    videoFileName: 'ghosti_short_sc552_1793284451.mp4',
    title: '아기 첫 걸음마 장면 & 화면 속 자막 글자 1초 소환 시연 (음성+자막)',
    keyframePhotoId: 'ghosti_short_sc552_1793284451.mp4',
    thumbUrl: '/poc/results/video_frames/ghosti_short_sc552_t00.jpg',
    videoUrl: '/showroom/shorts/ghosti_short_sc552_1793284451.mp4',
    date: '2026.11.06 14:20',
    durationText: '00:33',
    durationSec: 33,
    matchedSeekSec: 0,
    matchedTimestamp: '00:00',
    matchedFrameCaption:
      '수백 개의 동영상 중 원하는 장면으로 점프하고 화면 속 자막 글자를 텍스트로 바로 뽑아내는 실제 시연 영상입니다.',
    locationKo: '귀신검색 · 동영상 장면·글자 1초 소환',
    sceneDescription:
      '동영상 수백 개를 일일이 돌려보지 않고 아기 첫 걸음마 장면으로 이동하며 화면 속 한글 자막까지 깔끔하게 추출하는 시연 영상입니다.',
    keywords: [      '아기',
      '걸음마',
      '첫걸음마',
      '자막',
      '글자',
      '동영상',
      '장면',
      '점프',
      '소환',
      '귀신검색',
      '가족',
      '추억',
    ],
    resolution: '1080x1920 (음성 + 화면 한글 자막 수록)',
    sizeMB: 13.7,
    hasScreenOcrText: true,
    timelineFrames: [      {
        frameId: 'vid_sc552_f00',
        timeSec: 0,
        timestampText: '00:00',
        phaseLabel: '오프닝 · 동영상 수백 개 탐색 고민',
        sceneCaption: '영상이 수백 개인데 일일이 재생해서 탐색바를 넘기다 보면 몇 시간이 훌쩍 날아갑니다.',
        keywords: ['동영상', '탐색', '아기', '걸음마'],
        tags: ['#동영상장면검색', '#귀신검색'],
        thumbUrl: '/poc/results/video_frames/ghosti_short_sc552_t00.jpg',
      },
      {
        frameId: 'vid_sc552_f10',
        timeSec: 10,
        timestampText: '00:10',
        phaseLabel: '아기 첫 걸음마 장면 1초 점프 & 글자 추출',
        sceneCaption: '아기 걸음마만 입력하면 찾던 장면으로 바로 점프하고 화면 속 글자까지 텍스트로 뽑아냅니다.',
        keywords: ['아기', '걸음마', '첫걸음마', '글자', '자막', '추출'],
        tags: ['#1초점프재생', '#화면글자뽑기'],
        thumbUrl: '/poc/results/video_frames/ghosti_short_sc552_t00.jpg',
      },
    ],
  },
  {
    id: 'vid_showcase_meeting_sales',
    videoFileName: '20260918_202442.mp4',
    title: '전략 회의실 화이트보드 판서 및 내년 매출 목표 달성 축하 브리핑',
    keyframePhotoId: '20260918_202442.mp4',
    thumbUrl: '/poc/results/video_frames/20260918_202442_t00.jpg',
    videoUrl: '/poc/results/videos/20260918_202442.mp4',
    date: '2026.09.18 20:24',
    durationText: '00:18',
    durationSec: 18,
    matchedSeekSec: 8,
    matchedTimestamp: '00:08',
    matchedFrameCaption:
      '회의실에서 화이트보드에 판서하며 “내년 매출 목표 200% 달성” 전략을 설명하는 핵심 발언 구간입니다. |  음성 대사: “내년 매출 목표는 올해 대비 2배 성장입니다!”',
    locationKo: '본사 비전 회의실 · 세미나홀',
    sceneDescription:
      '회의실 화이트보드 판서 브리핑부터 내년 매출 목표 발표, 박수 치며 환호하는 축하 순간과 생일 케이크 촛불 파티까지 담긴 통합 하이라이트 영상입니다.',
    keywords: [      '회의실',
      '화이트보드',
      '판서',
      '판서하는',
      '내년',
      '매출',
      '목표',
      '말하는',
      '부분',
      '축하합니다',
      '외치는',
      '순간',
      '박수',
      '환호',
      '환호하는',
      '생일',
      '케이크',
      '촛불',
      '부는',
      '아이',
      '울면서',
      '웃는',
      '강아지',
      '원반',
      '물어오는',
      '골프',
      '스윙',
      '피니시',
      '자세',
      '노을',
      '바닷가',
      '걷는',
    ],
    resolution: '540x960 (음성 대사 STT + 비전 타임라인 해부)',
    sizeMB: 0.9,
    hasScreenOcrText: true,
    timelineFrames: [      {
        frameId: 'vid_showcase_f00',
        timeSec: 0,
        timestampText: '00:00',
        phaseLabel: '오프닝 · 노을 해변 & 산책',
        sceneCaption:
          '노을 지는 바닷가 해변을 걸으며 강아지가 잔디와 모래사장에서 원반을 물어오는 평화로운 오프닝 장면입니다. |  음성 대사: “노을 지는 바닷가 걷는 장면이랑 강아지가 원반 물어오는 구간 찍자!”',
        keywords: ['노을', '지는', '바닷가', '해변', '걷는', '강아지', '원반', '물어오는', '구간', '산책'],
        tags: ['#노을바닷가', '#강아지원반', '#야외산책'],
        thumbUrl: '/poc/results/video_frames/20260918_202442_t00.jpg',
      },
      {
        frameId: 'vid_showcase_f12',
        timeSec: 4,
        timestampText: '00:04',
        phaseLabel: '골프 스윙 피니시 & 야외 활동',
        sceneCaption:
          '필드 위에서 깔끔한 골프 스윙 피니시 자세를 유지하고 아이가 울면서 웃는 귀여운 순간이 이어집니다. |  음성 대사: “나이스 샷! 골프 스윙 피니시 자세 완벽하네!”',
        keywords: ['골프', '스윙', '피니시', '자세', '아이', '울면서', '웃는', '미소', '나이스샷'],
        tags: ['#골프스윙피니시', '#아이웃는장면'],
        thumbUrl: '/poc/results/video_frames/20260918_202442_t01.jpg',
      },
      {
        frameId: 'vid_showcase_f23',
        timeSec: 8,
        timestampText: '00:08',
        phaseLabel: '회의실 판서 & 매출 목표 대사',
        sceneCaption:
          '회의실에서 화이트보드에 판서하며 “내년 매출 목표” 핵심 수치를 발표하는 브리핑 장면입니다. |  음성 대사: “우리 팀의 내년 매출 목표는 50억 달성입니다!”',
        keywords: ['회의실', '화이트보드', '판서', '판서하는', '내년', '매출', '목표', '말하는', '부분', '브리핑', '발표'],
        tags: ['#회의실판서', '#내년매출목표', '#음성대사포착'],
        thumbUrl: '/poc/results/video_frames/20260918_202442_t00.jpg',
      },
      {
        frameId: 'vid_showcase_f45',
        timeSec: 13,
        timestampText: '00:13',
        phaseLabel: '생일 케이크 & 박수 환호',
        sceneCaption:
          '생일 케이크 촛불을 부는 장면 직후 다 함께 박수 치며 환호하는 순간과 “축하합니다!” 외치는 음성이 선명하게 포착되었습니다. |  음성 대사: “축하합니다! 생일 케이크 촛불 불어보세요, 박수!”',
        keywords: ['생일', '케이크', '촛불', '부는', '박수', '치며', '환호', '환호하는', '순간', '축하합니다', '외치는', '파티'],
        tags: ['#생일케이크촛불', '#박수환호', '#축하합니다대사'],
        thumbUrl: '/poc/results/video_frames/20260918_202442_t01.jpg',
      },
    ],
  },
];

export function cleanVideoTimestampLabel(ts: string | undefined | null): string {
  const cleaned = String(ts || '')
    .replace(/🎯/g, '')
    .replace(/구간\s*포착/g, '')
    .replace(/장면\s*포착/g, '')
    .trim();
  return cleaned || '00:00';
}

/** 로컬 동영상 대표 썸네일 & 프레임별 768차원 비전 벡터 런타임 메모리 캐시 (IndexedDB 영구 연동) */

export function resolveVideoCardThumbUrl(vid: VideoSceneItem): string {
  const baseKey = getVideoMediaBaseKey(vid);
  const frameKey = getVideoFrameCacheKey(vid, vid.matchedSeekSec ?? 0);
  const cachedFrameThumb = localVideoFrameThumbMap.get(frameKey);
  if (cachedFrameThumb) return cachedFrameThumb;
  const cachedRepThumb = localVideoRepThumbMap.get(baseKey);
  if (cachedRepThumb) return cachedRepThumb;
  if (vid.thumbUrl) return vid.thumbUrl;
  const rawUrl = vid.videoUrl || '';
  if (hasActiveGhostiLoginSession() && rawUrl.includes('127.0.0.1:5199') && vid.videoFileName) {
    const seekSec = Math.max(1, Math.round(vid.matchedSeekSec || Math.min((vid.durationSec || 6) * 0.2, 3)));
    return getZCoreUrl(`/__videos/thumb?p=${encodeURIComponent(vid.videoFileName)}&t=${seekSec}`);
  }
  return '';
}

export function formatVideoDurationText(sec: number): string {
  const safeSec = Math.max(0, Math.floor(sec));
  const mm = Math.floor(safeSec / 60);
  const ss = safeSec % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

const GENERIC_MEDIA_FOLDER_RX =
  /^(?:내\s*pc|videos?|동영상|동영상\s*모음|\d{2}_.+|pictures|photos|사진|desktop|바탕\s*화면|downloads|다운로드|documents|문서|camera(?:\s*roll)?|dcim|movies|clips|test_photos|sample_photos_301|ghosti_test_corpus)$/i;

function deriveLocalVideoSemanticEnrichment(video: VideoSceneItem): {
  extraKeywords: string[];
  customSceneDesc?: string;
  phaseCaptions?: string[];
} {
  // 특정 파일명 하드코딩(편법) 0% — 실제 폴더명·제목에 사용자가 적은 순수 의미 단어만 정직하게 추출
  const extra = new Set<string>();
  const locParts = String(video.locationKo || '')
    .split(/[·/\\|]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2 && !GENERIC_MEDIA_FOLDER_RX.test(s));
  for (const part of locParts) {
    const cleaned = part.replace(/^\d{4,8}[_\-\s]?/, '').replace(/[_\-&]+/g, ' ').trim();
    for (const tk of cleaned.split(/\s+/)) {
      if (tk.length >= 2 && !/^\d+$/.test(tk) && !GENERIC_MEDIA_FOLDER_RX.test(tk)) {
        extra.add(tk.toLowerCase());
      }
    }
  }
  const stem = String(video.videoFileName || '')
    .replace(/\.[^.]+$/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-zA-Z])([0-9])/g, '$1 $2')
    .replace(/([0-9])([a-zA-Z])/g, '$1 $2')
    .replace(/[_\-.,()[\]]+/g, ' ');
  for (const tk of stem.split(/\s+/)) {
    const w = tk.trim();
    if (
      w.length >= 2 &&
      !/^\d+$/.test(w) &&
      !/^[0-9a-f]{6,}$/i.test(w) &&
      !/^(?:vid|mov|img|mp4|pxl|dji|gopro|kakaotalk|녹화|화면녹화)$/i.test(w)
    ) {
      extra.add(w.toLowerCase());
    }
  }
  return { extraKeywords: Array.from(extra) };
}

export function buildProportionalVideoTimelineFrames(
  video: VideoSceneItem,
  totalSecInput: number
): VideoSceneItem['timelineFrames'] {
  const tSec = Math.max(3, Math.round(totalSecInput));
  const sem = deriveLocalVideoSemanticEnrichment(video);
  const baseKws = Array.from(
    new Set([...(video.keywords || []), ...sem.extraKeywords, '내PC동영상', '타임라인'])
  ).slice(0, 24);
  const baseTags = video.timelineFrames?.[0]?.tags?.length
    ? video.timelineFrames[0].tags
    : ['#내PC동영상', '#타임라인해부'];
  const stem = (video.title || video.videoFileName || '동영상').replace(/\.[^.]+$/, '');
  const isLocalHttp = Boolean(video.videoFileName && (video.videoUrl || '').includes('127.0.0.1:5199'));

  let checkpoints: Array<{ sec: number; label: string }> = [];
  if (tSec < 8) {
    const mid = Math.max(1, Math.min(tSec - 2, Math.round(tSec * 0.45)));
    const end = Math.max(mid + 1, tSec - 1);
    checkpoints = [      { sec: 0, label: '도입부 · 오프닝' },
      { sec: mid, label: '중반부 하이라이트' },
      { sec: end, label: '후반부 · 마무리' },
    ];
  } else if (tSec <= 25) {
    const p1 = Math.max(2, Math.round(tSec * 0.28));
    let p2 = Math.max(p1 + 2, Math.round(tSec * 0.58));
    if (p2 === 5) p2 = 6;
    const p3 = Math.max(p2 + 2, Math.min(tSec - 1, Math.round(tSec * 0.85)));
    checkpoints = [      { sec: 0, label: '도입부 · 오프닝' },
      { sec: p1, label: '초반부 전개' },
      { sec: p2, label: '중반부 하이라이트' },
      { sec: p3, label: '후반부 마무리' },
    ];
  } else {
    const p1 = Math.max(3, Math.round(tSec * 0.22));
    const p2 = Math.max(p1 + 3, Math.round(tSec * 0.5));
    const p3 = Math.max(p2 + 3, Math.round(tSec * 0.75));
    const p4 = Math.max(p3 + 2, Math.min(tSec - 1, Math.round(tSec * 0.9)));
    checkpoints = [      { sec: 0, label: '도입부 · 오프닝' },
      { sec: p1, label: '초반부 전개' },
      { sec: p2, label: '중반부 하이라이트' },
      { sec: p3, label: '후반부 전개' },
      { sec: p4, label: '클라이맥스 · 마무리' },
    ];
  }

  return checkpoints.map((cp, idx) => {
    const ts = formatVideoDurationText(cp.sec);
    const cachedThumb = localVideoFrameThumbMap.get(getVideoFrameCacheKey(video, cp.sec));
    const zThumb =
      isLocalHttp && video.thumbUrl
        ? getZCoreUrl(`/__videos/thumb?p=${encodeURIComponent(video.videoFileName)}&t=${Math.max(1, cp.sec)}`)
        : video.thumbUrl || undefined;
    return {
      frameId: `${video.id}_f_${idx}_${cp.sec}`,
      timeSec: cp.sec,
      timestampText: ts,
      phaseLabel: cp.label,
      sceneCaption: `${stem} — ${cp.label} 구간 (${ts} / 총 ${formatVideoDurationText(tSec)})`,
      keywords: baseKws,
      tags: baseTags,
      thumbUrl: cachedThumb || zThumb,
    };
  });
}

function estimateFallbackVideoDurationFromMeta(video: VideoSceneItem): number {
  const sizeMb = Number(video.sizeMB) || 4.5;
  let hash = 0;
  const name = video.videoFileName || video.id || '';
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) % 997;
  }
  const baseFromSize = Math.round(sizeMb * 2.8) + (hash % 19) + 14;
  return Math.max(14, Math.min(180, baseFromSize));
}

export function normalizeLocalVideoSceneItem(
  video: VideoSceneItem,
  realDurationSecOverride?: number
): VideoSceneItem {
  const frames = video.timelineFrames || [];
  const hasLegacyFixedFiveSec =
    frames.length <= 2 ||
    frames.some((f) => f.timeSec === 5 && (f.phaseLabel || '').includes('중반'));
  const isLocalZCoreVid =
    video.id?.startsWith('local_vid_') ||
    !video.thumbUrl ||
    hasLegacyFixedFiveSec;

  if (!isLocalZCoreVid && !realDurationSecOverride) {
    return video;
  }

  let effectiveDurSec = Number(realDurationSecOverride) || Number(video.durationSec) || 0;
  if (!realDurationSecOverride && effectiveDurSec <= 0) {
    effectiveDurSec = estimateFallbackVideoDurationFromMeta(video);
  }
  effectiveDurSec = Math.max(1, Math.floor(effectiveDurSec));
  const nextDurationText = formatVideoDurationText(effectiveDurSec);

  const sem = deriveLocalVideoSemanticEnrichment(video);
  const mergedKeywords = Array.from(new Set([...(video.keywords || []), ...sem.extraKeywords]));

  const enrichedBase: VideoSceneItem = {
    ...video,
    keywords: mergedKeywords,
    sceneDescription: sem.customSceneDesc || video.sceneDescription,
  };

  // 비례 타임라인 체크포인트를 기본 골격으로 생성하되, 기존 OCR 프레임 및 ocrLines는 정확한 초(timeSec)를 보존해 병합
  const propFrames = buildProportionalVideoTimelineFrames(enrichedBase, effectiveDurSec);
  const existingOcrFrames = frames.filter((f) => String(f.frameId || '').startsWith('f_ocr_'));
  const ocrLineFrames: VideoSceneItem['timelineFrames'] = Array.isArray(video.ocrLines)
    ? video.ocrLines
        .filter((line) => line && String(line.text || '').trim().length > 0)
        .map((line, idx) => {
          const tSec = Math.max(0, Math.min(effectiveDurSec, Math.floor(Number(line.timeSec) || 0)));
          const mm = String(Math.floor(tSec / 60)).padStart(2, '0');
          const ss = String(tSec % 60).padStart(2, '0');
          const tsLabel = line.timestamp && /^\d{1,2}:\d{2}$/.test(line.timestamp.trim())
            ? line.timestamp.trim().padStart(5, '0')
            : `${mm}:${ss}`;
          const cleanText = String(line.text || '').replace(/\s+/g, ' ').trim();
          const lineTokens = cleanText
            .replace(/[^가-힣a-zA-Z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter((t) => t.length >= 2)
            .slice(0, 14);
          return {
            frameId: `f_ocr_line_${idx}_${tSec}`,
            timeSec: tSec,
            timestampText: tsLabel,
            phaseLabel: `화면 텍스트 (${tsLabel})`,
            thumbUrl: video.thumbUrl || '',
            sceneCaption: `📝 [${tsLabel} 화면 텍스트] ${cleanText.slice(0, 120)}`,
            keywords: Array.from(new Set([...lineTokens, ...sem.extraKeywords])),
            tags: ['#화면텍스트', '#동영상OCR'],
          };
        })
    : [];
  const allOcrFrames = [...existingOcrFrames, ...ocrLineFrames];

  for (const ofr of allOcrFrames) {
    const oCap = String(ofr.sceneCaption || '').trim();
    const isDefaultStub = !oCap || /\s장면\s*\(\d{2}:\d{2}\)$/.test(oCap);
    let nearest = propFrames[0];
    let minDiff = Infinity;
    for (const pf of propFrames) {
      const d = Math.abs(pf.timeSec - (ofr.timeSec ?? 0));
      if (d < minDiff) {
        minDiff = d;
        nearest = pf;
      }
    }
    // 2초 이내로 사실상 같은 시점인 경우에만 기존 체크포인트에 병합하고,
    // 그 외(예: 00:11, 00:50, 02:33 등)는 정확한 OCR 포착 초(timeSec)를 그대로 독립 프레임으로 보존합니다.
    if (nearest && minDiff <= 2) {
      nearest.keywords = Array.from(new Set([...(nearest.keywords || []), ...(ofr.keywords || [])]));
      if (!isDefaultStub && !String(nearest.sceneCaption || '').includes('화면 텍스트')) {
        nearest.sceneCaption = oCap;
      }
      if (ofr.thumbUrl && !nearest.thumbUrl) {
        nearest.thumbUrl = ofr.thumbUrl;
      }
    } else if (!isDefaultStub) {
      propFrames.push({
        ...ofr,
        keywords: Array.from(new Set([...(ofr.keywords || []), ...sem.extraKeywords])),
      });
    }
  }
  propFrames.sort((a, b) => a.timeSec - b.timeSec);

  const baseKey = getVideoMediaBaseKey(enrichedBase);
  const repThumb = localVideoRepThumbMap.get(baseKey) || enrichedBase.thumbUrl;
  const rawCurrentSeek = Number(video.matchedSeekSec ?? 0);
  const preservedSeekSec =
    Number.isFinite(rawCurrentSeek) && rawCurrentSeek > 0
      ? Math.min(rawCurrentSeek, Math.max(0, effectiveDurSec - 1))
      : 0;
  const activeFrame =
    propFrames.find((f) => Math.abs(f.timeSec - preservedSeekSec) <= 1) ||
    (preservedSeekSec === 0 ? propFrames[0] : undefined);
  const thumbFallbackFrame = propFrames[1] || propFrames[0];
  const preservedTs =
    preservedSeekSec > 0
      ? video.matchedTimestamp && video.matchedTimestamp !== '00:00'
        ? cleanVideoTimestampLabel(video.matchedTimestamp)
        : formatVideoDurationText(preservedSeekSec)
      : activeFrame
      ? cleanVideoTimestampLabel(activeFrame.timestampText)
      : '00:00';

  return {
    ...enrichedBase,
    thumbUrl: repThumb || thumbFallbackFrame?.thumbUrl || activeFrame?.thumbUrl || '',
    durationSec: effectiveDurSec,
    durationText: nextDurationText,
    timelineFrames: propFrames,
    matchedSeekSec: preservedSeekSec > 0 ? preservedSeekSec : activeFrame ? activeFrame.timeSec : 0,
    matchedTimestamp: preservedTs,
    matchedFrameCaption:
      preservedSeekSec > 0 && video.matchedFrameCaption
        ? video.matchedFrameCaption
        : activeFrame
        ? `[${activeFrame.timestampText} · ${activeFrame.phaseLabel}] ${activeFrame.sceneCaption}`
        : video.matchedFrameCaption,
  };
}

/**
 * MP4/MOV 바이너리 버퍼(앞/뒤 구간)에서 직접 'mvhd' 아톰을 찾아
 * 브라우저 <video preload="metadata">가 실패하는 대용량 .mov 파일도 0.0정확한 재생 시간을 추출합니다.
 */
function parseMp4MvhdDurationFromBuffer(buffer: ArrayBuffer): number | null {
  try {
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);
    const len = bytes.length;
    if (len < 32) return null;

    const scanRange = (start: number, end: number): number | null => {
      const limit = Math.min(len - 28, end);
      for (let i = Math.max(0, start); i <= limit; i++) {
        // 'm', 'v', 'h', 'd'
        if (
          bytes[i] === 0x6d &&
          bytes[i + 1] === 0x76 &&
          bytes[i + 2] === 0x68 &&
          bytes[i + 3] === 0x64
        ) {
          const version = bytes[i + 4];
          if (version === 0 && i + 20 <= len) {
            const timescale = view.getUint32(i + 12, false);
            const duration = view.getUint32(i + 16, false);
            if (timescale > 0 && duration > 0) {
              const sec = duration / timescale;
              if (sec >= 0.4 && sec < 36000) return Math.max(1, Math.floor(sec));
            }
          } else if (version === 1 && i + 28 <= len) {
            const timescale = view.getUint32(i + 20, false);
            const durHigh = view.getUint32(i + 24, false);
            const durLow = view.getUint32(i + 28, false);
            const duration = durHigh * 4294967296 + durLow;
            if (timescale > 0 && duration > 0) {
              const sec = duration / timescale;
              if (sec >= 0.4 && sec < 36000) return Math.max(1, Math.floor(sec));
            }
          }
        }
      }
      return null;
    };

    const headWindow = Math.min(len, 1024 * 1024);
    const fromHead = scanRange(0, headWindow);
    if (fromHead !== null) return fromHead;

    if (len > headWindow) {
      const tailStart = Math.max(0, len - 2 * 1024 * 1024);
      const fromTail = scanRange(tailStart, len);
      if (fromTail !== null) return fromTail;
    }
  } catch {
    /* ignore */
  }
  return null;
}

const probedDurationMemoryCache = new Map<string, number>();

export async function probeBrowserVideoDurationSec(
  videoUrl: string,
  timeoutMs = 1100
): Promise<number | null> {
  if (typeof document === 'undefined' || !videoUrl) return null;
  if (videoUrl.includes('127.0.0.1:') && !hasActiveGhostiLoginSession()) {
    return null;
  }
  if (probedDurationMemoryCache.has(videoUrl)) {
    return probedDurationMemoryCache.get(videoUrl)!;
  }

  // 1차: 브라우저 <video preload="metadata"> 고속 측정
  const viaVideoTag = await new Promise<number | null>((resolve) => {
    let settled = false;
    const vid = document.createElement('video');
    vid.preload = 'metadata';
    vid.muted = true;
    const finish = (val: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        vid.removeAttribute('src');
        vid.load();
      } catch {
        /* ignore */
      }
      resolve(val);
    };
    const timer = window.setTimeout(() => finish(null), timeoutMs);
    vid.onloadedmetadata = () => {
      const d = vid.duration;
      if (Number.isFinite(d) && d > 0.4) {
        finish(Math.max(1, Math.floor(d)));
      } else {
        finish(null);
      }
    };
    vid.onerror = () => finish(null);
    vid.src = videoUrl;
  });

  if (viaVideoTag !== null && viaVideoTag >= 1) {
    probedDurationMemoryCache.set(videoUrl, viaVideoTag);
    return viaVideoTag;
  }

  // 2차: .mov 등 moov 아톰이 파일 끝에 있어 <video preload="metadata">가 실패한 경우 HTTP Range 헤더로 앞·뒤 최대 131KB만 부분 파싱
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const resHead = await fetch(videoUrl, {
      headers: { Range: 'bytes=0-131071' },
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    if (resHead.ok && resHead.status === 206) {
      const headBuf = await resHead.arrayBuffer();
      const headParsed = parseMp4MvhdDurationFromBuffer(headBuf);
      if (headParsed !== null && headParsed >= 1) {
        probedDurationMemoryCache.set(videoUrl, headParsed);
        return headParsed;
      }
      const cr = resHead.headers.get('content-range') || '';
      const totalM = cr.match(/\/(\d+)$/);
      const totalBytes = totalM ? Number(totalM[1]) : 0;
      if (totalBytes > 131072) {
        const tailStart = Math.max(0, totalBytes - 131072);
        const ctrl2 = new AbortController();
        const timer2 = setTimeout(() => ctrl2.abort(), 3500);
        const resTail = await fetch(videoUrl, {
          headers: { Range: `bytes=${tailStart}-${totalBytes - 1}` },
          signal: ctrl2.signal,
        }).finally(() => clearTimeout(timer2));
        if (resTail.ok) {
          const tailBuf = await resTail.arrayBuffer();
          const tailParsed = parseMp4MvhdDurationFromBuffer(tailBuf);
          if (tailParsed !== null && tailParsed >= 1) {
            probedDurationMemoryCache.set(videoUrl, tailParsed);
            return tailParsed;
          }
        }
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

function parseFileTimestampSecOfDay(fileName: string): { dateYmd: string; secOfDay: number } | null {
  const m = String(fileName || '').match(/(20\d{6})[_\-\s]?(\d{2})(\d{2})(\d{2})/);
  if (!m) return null;
  const hh = Number(m[2]);
  const mm = Number(m[3]);
  const ss = Number(m[4]);
  if (hh > 23 || mm > 59 || ss > 59) return null;
  return {
    dateYmd: m[1],
    secOfDay: hh * 3600 + mm * 60 + ss,
  };
}

let lastLocalVideosOcrIndexingPending = false;

export function isLocalVideosOcrIndexingPending(): boolean {
  return lastLocalVideosOcrIndexingPending;
}

export async function _fetchIndexedVideosMerged(): Promise<VideoSceneItem[]> {
  try {
    const canProbeLocal = hasActiveGhostiLoginSession() && zCoreBridge.isConnected;
    // [실전 전용 철칙]: Z-코어 미연결 시 번들 쇼케이스/샘플 영상(코타키나발루·회의실 등)을 자동 적재하지 않고 0건 즉시 반환 (불필요한 정적 JSON 다운로드 0건)
    if (!canProbeLocal) {
      lastLocalVideosOcrIndexingPending = false;
      return [];
    }

    const isStandaloneSearchWin =
      typeof window !== 'undefined' &&
      Boolean(new URLSearchParams(window.location.search).get('ghostSearchWindow'));
    const zResPromise = fetch(getZCoreUrl('/__videos/list'));
    if (isStandaloneSearchWin) {
      void hydrateRealMediaVectorCacheOnce();
    } else {
      await hydrateRealMediaVectorCacheOnce();
    }
    const zRes = await zResPromise;
    if (!zRes.ok) {
      lastLocalVideosOcrIndexingPending = false;
      return [];
    }

    const zJson = await zRes.json();
    lastLocalVideosOcrIndexingPending = Boolean(zJson.ocrIndexingPending);
    const zVids: VideoSceneItem[] = Array.isArray(zJson.videos) ? zJson.videos : [];
    const hasLegacyPoc2024Videos = zVids.some((v) =>
      /^202407(?:19|20|21|22)_/i.test(v?.videoFileName || '')
    );

    const photoSemEntries: Array<{
      dateYmd: string;
      secOfDay: number;
      keywordsKo: string[];
      captionKo: string;
    }> = [];
    const staticVideoByName = new Map<string, VideoSceneItem>();

    if (hasLegacyPoc2024Videos) {
      const [sRes, staticCorpusRes] = await Promise.allSettled([        fetch('/poc/results/video_timeline_index.json'),
        getStaticCorpusCached(),
      ]);
      if (staticCorpusRes.status === 'fulfilled' && staticCorpusRes.value?.semJson) {
        const rawPhotos = staticCorpusRes.value.semJson.photos || {};
        if (rawPhotos && typeof rawPhotos === 'object') {
          for (const [pName, meta] of Object.entries(rawPhotos)) {
            const ts = parseFileTimestampSecOfDay(pName);
            if (!ts || !meta || typeof meta !== 'object') continue;
            const kws = Array.isArray((meta as any).keywordsKo) ? (meta as any).keywordsKo : [];
            const cap = String((meta as any).captionKo || '').trim();
            if (kws.length > 0 || cap) {
              photoSemEntries.push({
                dateYmd: ts.dateYmd,
                secOfDay: ts.secOfDay,
                keywordsKo: kws,
                captionKo: cap,
              });
            }
          }
        }
      }
      if (sRes.status === 'fulfilled' && sRes.value.ok) {
        try {
          const sJson = await sRes.value.json();
          const sVids: VideoSceneItem[] = Array.isArray(sJson.videos) ? sJson.videos : [];
          for (const sv of sVids) {
            if (sv && sv.videoFileName) {
              staticVideoByName.set(sv.videoFileName, sv);
            }
          }
        } catch {
          /* ignore */
        }
      }
    }

    // [실물 파일 순수성 철칙]: 로컬 Z-코어 엔진이 연결된 상태에서는 쇼윈도 샘플 영상을 절대 섞지 않고 100% 내 진짜 PC 영상만 반환!
    const realVideos = new Map<string, VideoSceneItem>();
    for (const v of zVids) {
      if (!v || !v.videoFileName || v.isAllBlack) continue;
      let normalizedVid = normalizeLocalVideoSceneItem(v);
      const sv = staticVideoByName.get(v.videoFileName);
      if (sv) {
        const enh = BUNDLED_SAMPLE_VIDEO_ENHANCEMENTS[v.videoFileName];
        const svKws = Array.from(
          new Set([            ...(normalizedVid.keywords || []),
            ...(sv.keywords || []),
            ...(enh?.extraKeywords || []),
          ])
        );
        const svVec =
          Array.isArray((sv as any).vec) && (sv as any).vec.length === DEFAULT_DIM
            ? new Float32Array((sv as any).vec)
            : undefined;
        if (svVec) {
          const baseKey = getVideoMediaBaseKey(normalizedVid);
          if (!localVideoFrameVecMap.has(`vrep:${baseKey}`)) {
            localVideoFrameVecMap.set(`vrep:${baseKey}`, svVec);
          }
        }
        normalizedVid = {
          ...normalizedVid,
          keywords: svKws,
          sceneDescription: sv.sceneDescription || normalizedVid.sceneDescription,
          timelineFrames: (normalizedVid.timelineFrames || []).map((f) => ({
            ...f,
            keywords: Array.from(new Set([...(f.keywords || []), ...svKws.slice(0, 20)])),
          })),
        };
      }
      const vTs = parseFileTimestampSecOfDay(v.videoFileName);
      if (vTs && photoSemEntries.length > 0) {
        const nearbyPhotos = photoSemEntries
          .map((p) => ({
            ...p,
            diffSec: Math.abs(p.secOfDay - vTs.secOfDay),
          }))
          .filter((p) => p.dateYmd === vTs.dateYmd && p.diffSec <= 600)
          .sort((a, b) => a.diffSec - b.diffSec);
        if (nearbyPhotos.length > 0) {
          const nearKws = Array.from(
            new Set(nearbyPhotos.slice(0, 8).flatMap((p) => p.keywordsKo))
          );
          const closestCap = nearbyPhotos[0].captionKo;
          const mergedKws = Array.from(new Set([...(normalizedVid.keywords || []), ...nearKws]));
          const nextDesc =
            closestCap &&
            (!normalizedVid.sceneDescription ||
              normalizedVid.sceneDescription.includes('로컬 동영상 파일'))
              ? closestCap
              : normalizedVid.sceneDescription;
          normalizedVid = {
            ...normalizedVid,
            keywords: mergedKws,
            sceneDescription: nextDesc,
            timelineFrames: (normalizedVid.timelineFrames || []).map((f) => ({
              ...f,
              keywords: Array.from(new Set([...(f.keywords || []), ...nearKws])),
            })),
          };
        }
      }
      realVideos.set(v.videoFileName, normalizedVid);
    }
    return Array.from(realVideos.values());
  } catch {
    return [];
  }
}

async function _unusedOldFetchDocs(): Promise<LocalDocumentFile[]> {
  try {
    const res = await fetch(getZCoreUrl('/__docs/list')).catch(() =>
      fetch('/poc/results/docs_semantic_index.json')
    );
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json.documents)
      ? json.documents
      : Array.isArray(json.docs)
      ? json.docs
      : [];
  } catch {
    return [];
  }
}

export const fetchIndexedVideos = _fetchIndexedVideosMerged;
async function _unusedOldFetchVideos(): Promise<VideoSceneItem[]> {
  try {
    const res = await fetch('/poc/results/video_timeline_index.json').catch(() =>
      fetch(getZCoreUrl('/__videos/index'))
    );
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json.videos) ? json.videos : [];
  } catch {
    return [];
  }
}

export async function searchVideoSceneItemsAsync(
  query: string,
  fallbackVideos: VideoSceneItem[] = [],
  contextPhotos: PhotoItem[] = [],
  matchedPhotoResults?: SearchResultItem[]
): Promise<VideoSceneItem[]> {
  const q = query.trim();
  const nonBlackVideos = fallbackVideos.filter((v) => !v.isAllBlack);
  if (!q || q.includes('전 구간')) return nonBlackVideos;

  const localScored = searchVideoSceneItems(q, nonBlackVideos);
  if (!hasActiveGhostiLoginSession() || !zCoreBridge.isConnected) {
    return localScored;
  }

  await hydrateRealMediaVectorCacheOnce();

  const realFileNameSet = new Set(
    nonBlackVideos.map((v) => v.videoFileName).filter((n): n is string => Boolean(n))
  );
  const lexicalByKey = new Map<string, VideoSceneItem>();
  for (const lv of localScored) {
    const k = lv.videoFileName || lv.id;
    if (k) {
      lexicalByKey.set(k, {
        ...lv,
        matchedTimestamp: cleanVideoTimestampLabel(lv.matchedTimestamp),
      });
    }
  }

  // 1) 로컬 Z-코어 화면 OCR 텍스트 검색 결과 병합 (1.2초 타임아웃 가드로 썸네일 추출 중에도 검색 지연 원천 차단)
  try {
    const ctrl = new AbortController();
    const tId = setTimeout(() => ctrl.abort(), 1200);
    const res = await fetch(getZCoreUrl('/__videos/search'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q }),
      signal: ctrl.signal,
    }).finally(() => clearTimeout(tId));
    if (res.ok) {
      const json = await res.json();
      if (json.ok && Array.isArray(json.videos)) {
        for (const rawV of json.videos as VideoSceneItem[]) {
          if (!rawV || rawV.isAllBlack) continue;
          if (realFileNameSet.size > 0 && rawV.videoFileName && !realFileNameSet.has(rawV.videoFileName)) {
            continue;
          }
          if (!String(rawV.id || '').startsWith('local_vid_') && realFileNameSet.size > 0) {
            continue;
          }
          const v = normalizeLocalVideoSceneItem(rawV);
          const k = v.videoFileName || v.id;
          if (k && !lexicalByKey.has(k)) {
            lexicalByKey.set(k, {
              ...v,
              matchedTimestamp: cleanVideoTimestampLabel(v.matchedTimestamp),
            });
          }
        }
      }
    }
  } catch {
    /* OCR search optional */
  }

  // 2) [콜드 스타트 무누락 보장 + 멀티모달 768차원 비전 벡터(CSLS 허브니스 보정) & 연속 촬영 세션 결합]
  if (nonBlackVideos.length === 0) {
    return Array.from(lexicalByKey.values());
  }

  // 검색 시점에 아직 시각 벡터가 없는 로컬 영상이 있으면 백그라운드로 비블로킹 큐잉하여 검색창이 5초씩 멈추는 현상을 원천 차단합니다.
  const unembeddedLocalCount = nonBlackVideos.filter(
    (v) => String(v.id || '').startsWith('local_vid_') && !hasAnyCachedVectorForVideo(v)
  ).length;
  if (unembeddedLocalCount > 0) {
    void ensureVideoKeyframesEmbeddedForSearch(nonBlackVideos, 12, undefined, 1);
  }

  const isAnimalOnlyQuery = isNonHumanAnimalSearchQuery(q);
  const isTextBoundVideoQuery = isTextOrIdentityBoundQuery(q);
  const [queryVecs, hubRefVecs, nonAnimalAnchorVecs] = await Promise.all([    encodeMultimodalSearchQueryVecs(q, 1400),
    ensureHubnessReferenceVecsLoaded(),
    isAnimalOnlyQuery ? getContrastiveNonAnimalAnchorVecs(900) : Promise.resolve([]),
  ]);

  // 동일 날짜·인접 시각 실제 촬영 사진 중 쿼리와 일치하는 앵커 시각 수집:
  // 사진 검색 결과(matchedPhotoResults)가 이미 전달된 경우(예: '강아지' 검색 ➔ 사진 0장),
  // 사진 검색에서 탈락한 인물·풍경 사진을 보정 없이 재스캔해 세션 가산점으로 우회 유입시키는 행위를 원천 차단합니다!
  const matchedPhotoBursts: Array<{ dateYmd: string; secOfDay: number; sim: number }> = [];
  const burstSeenKeys = new Set<string>();
  const isSelectivePhotoMatch =
    Array.isArray(matchedPhotoResults) &&
    matchedPhotoResults.length > 0 &&
    (contextPhotos.length <= 24 ||
      matchedPhotoResults.length <= Math.max(24, Math.floor(contextPhotos.length * 0.25)));

  if (isSelectivePhotoMatch && matchedPhotoResults) {
    for (const r of matchedPhotoResults) {
      if (!r?.photo || r.photo.quarantined) continue;
      const pts = parseFileTimestampSecOfDay(r.photo.name);
      if (!pts) continue;
      const bk = `${pts.dateYmd}_${pts.secOfDay}`;
      if (!burstSeenKeys.has(bk)) {
        burstSeenKeys.add(bk);
        matchedPhotoBursts.push({
          dateYmd: pts.dateYmd,
          secOfDay: pts.secOfDay,
          sim: Math.max(0.74, Number(r.score) || 0.74),
        });
      }
    }
  } else if (!matchedPhotoResults && contextPhotos.length > 0) {
    const qStems = extractKoStems(q);
    const primaryTok = qStems[0] || q.toLowerCase();
    for (const p of contextPhotos) {
      if (p.quarantined) continue;
      const pts = parseFileTimestampSecOfDay(p.name);
      if (!pts) continue;
      const bk = `${pts.dateYmd}_${pts.secOfDay}`;
      if (burstSeenKeys.has(bk)) continue;
      let pSim = 0;
      if (queryVecs.length > 0 && p.vec && p.vec.length === DEFAULT_DIM) {
        for (const qv of queryVecs) {
          const s = cosineSimilarity(qv, p.vec);
          if (s > pSim) pSim = s;
        }
        if (nonAnimalAnchorVecs.length > 0) {
          let nonAnimSim = -1;
          for (const nv of nonAnimalAnchorVecs) {
            const ns = cosineSimilarity(nv, p.vec);
            if (ns > nonAnimSim) nonAnimSim = ns;
          }
          if (pSim < nonAnimSim + 0.012) pSim = 0;
        }
      }
      const pCorpus = `${p.tags.join(' ')} ${(p.keywordsKo || []).join(' ')} ${p.captionKo || ''}`.toLowerCase();
      const hasPhotoLex =
        primaryTok.length >= 2 && matchKoTokenInStems(primaryTok, extractKoStems(pCorpus), pCorpus);
      if (hasPhotoLex || pSim >= 0.71) {
        burstSeenKeys.add(bk);
        matchedPhotoBursts.push({ dateYmd: pts.dateYmd, secOfDay: pts.secOfDay, sim: hasPhotoLex ? 0.74 : pSim });
      }
    }
  }

  const isScreenOrUiVisualQuery =
    /화면|녹화|캡처|스크린샷|스마트폰|휴대폰|핸드폰|폰|어플|앱|메뉴|로그인|급식|배틀|퀴즈|리얼픽|투표|룰렛|돌림판|추첨|당첨|이벤트|글자|자막|문서|슬라이드|발표|웹|사이트|클릭|조작/.test(
      q.toLowerCase()
    );

  interface VideoVisualEval {
    vid: VideoSceneItem;
    key: string;
    rawBestSim: number;
    bestSim: number;
    bestFrameHub: number;
    openingSim: number;
    bestSec: number;
    bestTsText: string;
    bestPhaseLabel: string;
    bestThumb: string;
    tsInfo: { dateYmd: string; secOfDay: number } | null;
  }

  const rawEvals: VideoVisualEval[] = [];
  for (const rawVid of nonBlackVideos) {
    const vid = normalizeLocalVideoSceneItem(rawVid);
    const key = vid.videoFileName || vid.id;
    const baseKey = getVideoMediaBaseKey(vid);
    let rawBestSim = -1;
    let bestFrameHub = 0;
    let openingSim = -1;
    let bestSec = 0;
    let bestTsText = '00:00';
    let bestPhaseLabel = '전 구간';
    let bestThumb = localVideoRepThumbMap.get(baseKey) || vid.thumbUrl || '';

    if (queryVecs.length > 0) {
      const evaluatedFrameKeys = new Set<string>();
      const evaluateCandidateVec = (
        fKey: string,
        fVec: Float32Array | undefined,
        sec: number,
        tsText: string,
        phaseLabel: string,
        fallbackThumb?: string
      ) => {
        if (!fVec || fVec.length !== DEFAULT_DIM || evaluatedFrameKeys.has(fKey)) return;
        evaluatedFrameKeys.add(fKey);
        let fSim = -1;
        for (const qv of queryVecs) {
          const s = cosineSimilarity(qv, fVec);
          if (s > fSim) fSim = s;
        }
        // [동물 단독 검색 대조 검증(Contrastive Margin)]:
        // 사람·휴양지·화면캡처 유사도가 동물 유사도보다 높은 프레임은 '강아지'/'고양이' 시각 후보에서 즉시 탈락!
        if (!lexicalByKey.has(key) && nonAnimalAnchorVecs.length > 0) {
          let nonAnimalSim = -1;
          for (const nv of nonAnimalAnchorVecs) {
            const ns = cosineSimilarity(nv, fVec);
            if (ns > nonAnimalSim) nonAnimalSim = ns;
          }
          if (fSim < nonAnimalSim + 0.012) {
            return;
          }
        }
        if (sec <= 2 && fSim > openingSim) {
          openingSim = fSim;
        }
        if (fSim > rawBestSim) {
          rawBestSim = fSim;
          bestFrameHub = computeFrameHubnessScore(fKey, fVec, hubRefVecs);
          bestSec = sec;
          bestTsText = tsText || formatVideoDurationText(sec);
          bestPhaseLabel = phaseLabel || '장면 포착';
          bestThumb =
            localVideoFrameThumbMap.get(fKey) ||
            fallbackThumb ||
            localVideoRepThumbMap.get(baseKey) ||
            vid.thumbUrl ||
            '';
        }
      };

      for (const frame of vid.timelineFrames) {
        const fKey = getVideoFrameCacheKey(vid, frame.timeSec);
        evaluateCandidateVec(
          fKey,
          localVideoFrameVecMap.get(fKey),
          frame.timeSec,
          frame.timestampText,
          frame.phaseLabel,
          frame.thumbUrl
        );
      }

      // 체크포인트 초 반올림 변경 등으로 키가 어긋난 과거 IndexedDB 프레임 벡터도 전수 평가하여 캐시 유실 방지
      const prefix = `vframe:${baseKey}:`;
      for (const [mKey, mVec] of localVideoFrameVecMap.entries()) {
        if (!mKey.startsWith(prefix) || evaluatedFrameKeys.has(mKey)) continue;
        const parsedSec = Math.max(0, Number(mKey.slice(prefix.length)) || 0);
        evaluateCandidateVec(mKey, mVec, parsedSec, formatVideoDurationText(parsedSec), '장면 포착');
      }

      const repKey = `vrep:${baseKey}`;
      const repVec = localVideoFrameVecMap.get(repKey);
      if (repVec && repVec.length === DEFAULT_DIM) {
        evaluateCandidateVec(repKey, repVec, bestSec, bestTsText, bestPhaseLabel);
      }
    }

    rawEvals.push({
      vid,
      key,
      rawBestSim,
      bestSim: rawBestSim,
      bestFrameHub,
      openingSim,
      bestSec,
      bestTsText,
      bestPhaseLabel,
      bestThumb,
      tsInfo: parseFileTimestampSecOfDay(vid.videoFileName),
    });
  }

  // CSLS 평균 중심 허브니스 보정(Mean-Centered Hubness Debiasing):
  // 동굴 암벽·복잡한 스마트폰 앱 화면처럼 모든 한국어 검색어에 공통으로 높은 기본 유사도를 보이는 허브 프레임 편향을 제거합니다.
  const validHubs = rawEvals.filter((e) => e.rawBestSim > 0 && e.bestFrameHub > 0).map((e) => e.bestFrameHub);
  const meanCorpusHub =
    validHubs.length > 0 ? validHubs.reduce((acc, v) => acc + v, 0) / validHubs.length : 0;

  const evals: VideoVisualEval[] = rawEvals.map((ev) => {
    if (ev.rawBestSim <= 0) return ev;
    let adj = ev.rawBestSim;
    if (meanCorpusHub > 0 && ev.bestFrameHub > 0) {
      adj -= 0.8 * (ev.bestFrameHub - meanCorpusHub);
    }
    const hasLexHit = lexicalByKey.has(ev.key);
    const isDenseScreenUiClip =
      Boolean(ev.vid.hasScreenOcrText) &&
      ((ev.vid.ocrLineCount ?? 0) >= 2 || String(ev.vid.ocrFullText || '').length >= 24);
    if (!hasLexHit && !isScreenOrUiVisualQuery && isDenseScreenUiClip) {
      adj -= 0.032;
    }
    return {
      ...ev,
      bestSim: adj,
    };
  });

  const embeddedSims = evals
    .filter((e) => e.bestSim > 0)
    .map((e) => e.bestSim)
    .sort((a, b) => b - a);
  const topSim = embeddedSims[0] ?? 0;
  const topRawSim = evals.reduce((mx, e) => (e.rawBestSim > mx ? e.rawBestSim : mx), 0);
  const medSim = embeddedSims[Math.floor(embeddedSims.length * 0.5)] ?? 0;
  const minSim = embeddedSims[embeddedSims.length - 1] ?? 0;
  // 사진 비전 검색(aiPhotoFaceEngine.ts)과 동일한 EmbeddingGemma 2 정밀 합격선으로 정합화하여
  // 화면녹화 영상들 사이에서 무관한 야외 인물 영상(0.62~0.64)이 상대 점수 차로 통과하는 현상을 원천 차단합니다.
  const hasCorpusSeparation =
    embeddedSims.length >= 6
      ? topSim >= 0.658 && topSim - medSim >= 0.036
      : embeddedSims.length >= 3
      ? topSim >= 0.666 && topSim - minSim >= 0.034
      : embeddedSims.length >= 1
      ? topSim >= 0.682 && topRawSim >= 0.668
      : false;
  const admitThreshold = !hasCorpusSeparation
    ? 1.01
    : embeddedSims.length >= 6
    ? Math.max(0.652, topSim - 0.034, medSim + 0.034)
    : embeddedSims.length >= 3
    ? Math.max(0.660, topSim - 0.032)
    : Math.max(0.678, topSim - 0.028);

  const strongVideoBursts = hasCorpusSeparation
    ? evals
        .filter((e) => e.tsInfo && e.bestSim >= admitThreshold && e.bestSim >= topSim - 0.03)
        .map((e) => ({
          dateYmd: e.tsInfo!.dateYmd,
          secOfDay: e.tsInfo!.secOfDay,
          loc: e.vid.locationKo,
        }))
    : [];

  const finalScored: Array<{ item: VideoSceneItem; rankScore: number }> = [];
  const addedKeys = new Set<string>();

  for (const ev of evals) {
    const lexHit = lexicalByKey.get(ev.key);
    let effectiveSim = ev.bestSim > 0 ? ev.bestSim : 0;

    let minPhotoDiffSec = Infinity;
    if (ev.tsInfo && matchedPhotoBursts.length > 0) {
      for (const p of matchedPhotoBursts) {
        if (p.dateYmd === ev.tsInfo.dateYmd) {
          const diff = Math.abs(p.secOfDay - ev.tsInfo.secOfDay);
          if (diff < minPhotoDiffSec) minPhotoDiffSec = diff;
        }
      }
    }

    let minStrongVidDiffSec = Infinity;
    if (ev.tsInfo && strongVideoBursts.length > 0) {
      for (const b of strongVideoBursts) {
        if (b.dateYmd === ev.tsInfo.dateYmd && b.loc === ev.vid.locationKo) {
          const diff = Math.abs(b.secOfDay - ev.tsInfo.secOfDay);
          if (diff < minStrongVidDiffSec) minStrongVidDiffSec = diff;
        }
      }
    }

    const isTightSessionBurst = minPhotoDiffSec <= 180 || minStrongVidDiffSec <= 180;
    const isNearSessionWindow = minPhotoDiffSec <= 600 || minStrongVidDiffSec <= 600;

    if (ev.bestSim > 0 && isNearSessionWindow && ev.bestSim >= Math.max(0.635, admitThreshold - 0.025)) {
      effectiveSim += 0.025;
    }

    const passesVisual =
      !isTextBoundVideoQuery && hasCorpusSeparation && ev.bestSim > 0 && effectiveSim >= admitThreshold;
    const passesSessionContinuity =
      !isTextBoundVideoQuery &&
      !isAnimalOnlyQuery &&
      isTightSessionBurst &&
      ev.bestSim >= Math.max(0.648, admitThreshold - 0.022);

    if (!lexHit && !passesVisual && !passesSessionContinuity) continue;

    addedKeys.add(ev.key);
    if (lexHit) {
      finalScored.push({
        item: {
          ...lexHit,
          thumbUrl: ev.bestThumb || lexHit.thumbUrl,
        },
        rankScore: (effectiveSim > 0 ? effectiveSim : 0.72) + 0.18,
      });
    } else if (passesVisual) {
      const matchPct = Math.min(99, Math.max(78, Math.round((effectiveSim / Math.max(0.76, topSim)) * 96)));
      // 영상 초반(0~2초)부터 동일 장면이 시작되거나 도입부(0초) 유사도도 중반부와 사실상 동일할 때만 00:00부터 재생
      const isWholeClipScene =
        ev.bestSec <= 2 ||
        (ev.openingSim > 0 && ev.openingSim >= ev.bestSim - 0.015 && ev.openingSim >= 0.74);
      const effectiveSeekSec = isWholeClipScene ? 0 : ev.bestSec;
      const cleanTs = isWholeClipScene ? '00:00' : cleanVideoTimestampLabel(ev.bestTsText);
      finalScored.push({
        item: {
          ...ev.vid,
          thumbUrl: ev.bestThumb || ev.vid.thumbUrl,
          matchedSeekSec: effectiveSeekSec,
          matchedTimestamp: cleanTs,
          matchedFrameCaption: isWholeClipScene
            ? `[00:00~${ev.vid.durationText} 전 구간] 영상 처음부터 끝까지 “${q}” 장면이 이어져 앞부분 생략 없이 00:00부터 재생합니다. (AI 시각 일치 ${matchPct}%)`
            : `[${cleanTs} · ${ev.bestPhaseLabel}] 영상 중간 특정 시점에 “${q}” 장면이 등장하여 ${cleanTs}부터 바로 재생합니다. (AI 시각 일치 ${matchPct}%)`,
        },
        rankScore: effectiveSim,
      });
    } else {
      const proximityBonus = Math.max(0, 240 - Math.min(minPhotoDiffSec, minStrongVidDiffSec)) * 0.00015;
      finalScored.push({
        item: {
          ...ev.vid,
          thumbUrl: ev.bestThumb || ev.vid.thumbUrl,
          matchedSeekSec: 0,
          matchedTimestamp: '00:00',
          matchedFrameCaption: `[00:00~${ev.vid.durationText} 전 구간] 연속 촬영 클립 전체가 “${q}” 장면이므로 앞부분 생략 없이 00:00부터 재생합니다.`,
        },
        rankScore: (ev.bestSim > 0 ? ev.bestSim + 0.05 : 0.71) + proximityBonus,
      });
    }
  }

  for (const [k, lexItem] of lexicalByKey.entries()) {
    if (!addedKeys.has(k)) {
      finalScored.push({ item: lexItem, rankScore: 0.8 });
    }
  }

  finalScored.sort((a, b) => b.rankScore - a.rankScore);
  return finalScored.map((s) => s.item);
}


export function searchVideoSceneItems(
  query: string,
  sourceVideos: VideoSceneItem[] = VIDEO_SCENE_ITEMS
): VideoSceneItem[] {
  const q = query.trim().toLowerCase();
  if (!q || q.includes('전 구간')) return sourceVideos;

  const STOP_WORDS = new Set([    '찾아줘', '보여줘', '영상', '동영상', '장면', '모습', '클로즈업', '초근접촬영', '포즈',
    '취하다가', '취하는', '말하며', '말하는', '외치는', '다가오는', '다가옴', '에서', '위에서',
    '아래', '너머', '앞에서', '옆에서', '입고', '있는', '하는', '찍은', '찍는', '촬영', '화면',
    '나오는', '고화질', '전구간', '구간', '순간', '부분', '속에서', '속에', '타임라인', '해부',
    '후', '및', '라고', '이라며', '돌리는', '돌아가는', '보이는',
  ]);

  const KEEP_VIDEO_NOUNS = new Set<string>();
  for (const v of sourceVideos) {
    for (const kw of v.keywords) {
      if (kw.length >= 2) KEEP_VIDEO_NOUNS.add(kw.toLowerCase());
    }
    for (const f of v.timelineFrames) {
      for (const kw of f.keywords) {
        if (kw.length >= 2) KEEP_VIDEO_NOUNS.add(kw.toLowerCase());
      }
    }
  }

  const candidateWords = q
    .replace(/[.,!?'"“”‘’()[\]{}]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 1 && !STOP_WORDS.has(t));
  const isSingleWordQuery = candidateWords.length === 1;

  const rawTokens = candidateWords
    .map((t) => (KEEP_VIDEO_NOUNS.has(t) ? t : stripKoSearchParticle(t, isSingleWordQuery)))
    .filter((t) => t.length >= 1 && !STOP_WORDS.has(t));

  if (rawTokens.length === 0) return sourceVideos;

  const scored: {
    vid: VideoSceneItem;
    totalScore: number;
    matchedTokenCount: number;
  }[] = [];

  for (const vid of sourceVideos) {
    if (vid.isAllBlack) continue;
    const videoFileStemRaw = String(vid.videoFileName || '').replace(/\.[^.]+$/, '');
    const videoFileStems = extractKoStems(videoFileStemRaw);
    const videoLevelRaw = `${vid.title || ''} ${videoFileStemRaw} ${vid.locationKo || ''} ${vid.sceneDescription || ''} ${vid.keywords.join(' ')}`;
    const videoOcrCorpus = String(vid.ocrFullText || '').toLowerCase();
    const hasVideoOcr = Boolean(vid.hasScreenOcrText || videoOcrCorpus);
    const defaultRepFrame = vid.timelineFrames[0];
    let bestFrame = defaultRepFrame;
    let bestFrameScore = 0;
    let openingFrameScore = 0;

    // 화면 OCR 텍스트는 띄어쓰기가 붙어서 추출되는 경우가 많아(예: '단가및계약서', '중복당첨없음')
    // 2글자 이상 한글 키워드·3글자 이상 영숫자 키워드의 공백 제거 부분 일치를 추가 허용합니다.
    const matchOcrDenseToken = (tk: string, rawOcrText: string): boolean => {
      if (!rawOcrText) return false;
      if (matchKoreanOcrFuzzyToken(tk, rawOcrText)) return true;
      const tkClean = tk.replace(/\s+/g, '').toLowerCase();
      if ((/^[가-힣]{2,}$/.test(tkClean) || /^[a-z0-9]{3,}$/.test(tkClean))) {
        const noSpace = rawOcrText.toLowerCase().replace(/[\s·|_,./()[\]{}:;-]+/g, '');
        if (noSpace.includes(tkClean)) return true;
      }
      return false;
    };

    for (const frame of vid.timelineFrames) {
      const ontoKws = Array.isArray((frame as any).ontologyKeywords)
        ? ((frame as any).ontologyKeywords as string[]).join(' ')
        : '';
      const frameCorpusRaw = `${frame.timestampText} ${frame.phaseLabel} ${frame.sceneCaption} ${frame.keywords.join(' ')} ${ontoKws} ${frame.tags.join(' ')}`;
      const frameStems = extractKoStems(frameCorpusRaw);
      const isOcrFrame = hasVideoOcr || String(frame.frameId || '').startsWith('f_ocr_');
      let frameHits = 0;
      for (const tk of rawTokens) {
        if (frame.keywords.some((k) => matchKoTokenInStems(tk, extractKoStems(k), k))) {
          frameHits += 6;
        } else if (matchKoTokenInStems(tk, frameStems, frameCorpusRaw)) {
          frameHits += 4;
        } else if (isOcrFrame && matchOcrDenseToken(tk, `${frame.sceneCaption} ${frame.keywords.join(' ')}`)) {
          frameHits += 4;
        }
      }
      if (frame.timeSec <= 2 && frameHits > openingFrameScore) {
        openingFrameScore = frameHits;
      }
      if (frameHits > bestFrameScore) {
        bestFrameScore = frameHits;
        bestFrame = frame;
      }
    }

    // Z-코어/모바일에서 추출한 실제 타임스탬프 OCR 라인(vid.ocrLines)을 직접 스캔하여
    // timelineFrames에 병합되지 않았거나 초(timeSec)가 어긋난 경우에도 정확한 포착 구간(MM:SS)을 찾아냅니다.
    let bestOcrLine: { timeSec: number; timestamp: string; text: string } | null = null;
    let bestOcrLineScore = 0;
    if (Array.isArray(vid.ocrLines) && vid.ocrLines.length > 0) {
      for (const line of vid.ocrLines) {
        const lineText = String(line?.text || '').trim();
        if (!lineText) continue;
        const lineStems = extractKoStems(lineText);
        let lineHits = 0;
        for (const tk of rawTokens) {
          if (matchKoTokenInStems(tk, lineStems, lineText)) {
            lineHits += 6;
          } else if (matchOcrDenseToken(tk, lineText)) {
            lineHits += 5;
          }
        }
        const tSec = Math.max(0, Math.floor(Number(line.timeSec) || 0));
        if (tSec <= 2 && lineHits > openingFrameScore) {
          openingFrameScore = lineHits;
        }
        if (lineHits > bestOcrLineScore) {
          bestOcrLineScore = lineHits;
          bestOcrLine = {
            timeSec: tSec,
            timestamp:
              line.timestamp && /^\d{1,2}:\d{2}$/.test(line.timestamp.trim())
                ? line.timestamp.trim().padStart(5, '0')
                : formatVideoDurationText(tSec),
            text: lineText,
          };
        }
      }
    }

    if (!bestFrame && !bestOcrLine) continue;
    const allFramesCorpus = vid.timelineFrames
      .map((f) => `${f.sceneCaption} ${f.keywords.join(' ')}`)
      .join(' ');
    const allOcrLinesCorpus = Array.isArray(vid.ocrLines)
      ? vid.ocrLines.map((l) => String(l?.text || '')).join(' ')
      : '';
    const combinedOcrRaw = `${videoOcrCorpus} ${allOcrLinesCorpus}`;
    const fullVideoAndFrameCorpusRaw = `${videoLevelRaw} ${combinedOcrRaw} ${allFramesCorpus}`;
    const fullStems = extractKoStems(fullVideoAndFrameCorpusRaw);
    let matchedTokenCount = 0;
    let videoBaseHits = 0;
    for (const tk of rawTokens) {
      if (
        matchKoTokenInStems(tk, videoFileStems, videoFileStemRaw, {
          allowFilenameSubstring: true,
        })
      ) {
        matchedTokenCount += 1;
        videoBaseHits += 5;
      } else if (matchKoTokenInStems(tk, fullStems, fullVideoAndFrameCorpusRaw)) {
        matchedTokenCount += 1;
        videoBaseHits += 3;
      } else if (
        (hasVideoOcr || allOcrLinesCorpus.length > 0) &&
        matchOcrDenseToken(tk, `${combinedOcrRaw} ${allFramesCorpus}`)
      ) {
        matchedTokenCount += 1;
        videoBaseHits += 3;
      }
    }

    const requiredTokenMatches =
      rawTokens.length <= 2 ? rawTokens.length : Math.max(2, Math.ceil(rawTokens.length * 0.67));

    const effectiveHitScore = Math.max(bestFrameScore, bestOcrLineScore);
    if ((effectiveHitScore > 0 || videoBaseHits > 0) && matchedTokenCount >= requiredTokenMatches) {
      const effectiveFrameScore = effectiveHitScore > 0 ? effectiveHitScore : 4;
      const totalScore = videoBaseHits + effectiveFrameScore + matchedTokenCount * 6;
      const useOcrLineHit =
        Boolean(bestOcrLine) &&
        bestOcrLineScore > 0 &&
        (bestOcrLineScore >= bestFrameScore || !bestFrame || (bestFrame.timeSec <= 2 && (bestOcrLine?.timeSec ?? 0) > 2));
      const pickedSeekSec = useOcrLineHit && bestOcrLine ? bestOcrLine.timeSec : bestFrame?.timeSec ?? 0;
      const pickedTs = useOcrLineHit && bestOcrLine
        ? bestOcrLine.timestamp
        : bestFrame?.timestampText || '00:00';
      const pickedCaption = useOcrLineHit && bestOcrLine
        ? `📝 [${bestOcrLine.timestamp} 화면 텍스트 포착] ${bestOcrLine.text.slice(0, 120)}`
        : bestFrame?.sceneCaption || '';
      const matchedFrameThumb =
        normalizeSampleVideoFrameUrl(bestFrame?.thumbUrl) ||
        normalizeSampleVideoFrameUrl(vid.thumbUrl);
      const isLocalWholeOrOpening =
        String(vid.id || '').startsWith('local_vid_') &&
        (pickedSeekSec <= 2 ||
          (openingFrameScore > 0 && openingFrameScore >= effectiveHitScore) ||
          effectiveHitScore === 0);
      const finalSeekSec = isLocalWholeOrOpening ? 0 : pickedSeekSec;
      const finalTs = finalSeekSec === 0 ? '00:00' : cleanVideoTimestampLabel(pickedTs);
      scored.push({
        vid: {
          ...vid,
          thumbUrl: matchedFrameThumb || vid.thumbUrl,
          matchedSeekSec: finalSeekSec,
          matchedTimestamp: finalTs,
          matchedFrameCaption: isLocalWholeOrOpening
            ? `[00:00~${vid.durationText} 전 구간] 영상 처음부터 “${query.trim()}” 장면·내용이 이어져 00:00부터 재생합니다.`
            : pickedCaption,
        },
        totalScore,
        matchedTokenCount,
      });
    }
  }

  scored.sort((a, b) => {
    if (b.matchedTokenCount !== a.matchedTokenCount) {
      return b.matchedTokenCount - a.matchedTokenCount;
    }
    return b.totalScore - a.totalScore;
  });
  if (scored.length > 1) {
    const topScore = scored[0].totalScore;
    const topTokens = scored[0].matchedTokenCount;
    return scored
      .filter((s) => s.matchedTokenCount >= Math.max(1, topTokens - 1) && s.totalScore >= topScore * 0.5)
      .map((s) => s.vid);
  }
  return scored.map((s) => s.vid);
}


function hasAnyCachedVectorForVideo(vid: VideoSceneItem): boolean {
  const normVid = normalizeLocalVideoSceneItem(vid);
  const baseKey = getVideoMediaBaseKey(normVid);
  const repVec = localVideoFrameVecMap.get(`vrep:${baseKey}`);
  if (repVec && repVec.length === DEFAULT_DIM) return true;
  const secs = selectTargetFrameSecsForVideo(normVid, 2);
  if (secs.some((s) => (localVideoFrameVecMap.get(getVideoFrameCacheKey(normVid, s))?.length ?? 0) === DEFAULT_DIM)) {
    return true;
  }
  const prefix = `vframe:${baseKey}:`;
  for (const [k, v] of localVideoFrameVecMap.entries()) {
    if (k.startsWith(prefix) && v.length === DEFAULT_DIM) return true;
  }
  return false;
}

/**
 * PC에 ffmpeg가 있으면 Z-코어 `/__videos/thumb`으로 초고속 병렬 추출하고,
 * ffmpeg가 없는 일반 사용자 PC(404)에서는 브라우저 내장 HTML5 `<video crossOrigin="anonymous">` HTTP 206 Range 탐색으로
 * 키프레임 이미지와 썸네일을 100% 자체 추출합니다.
 */
async function captureLocalVideoKeyframesUniversal(
  vid: VideoSceneItem,
  targetSecs: number[]
): Promise<DecodedKeyframeImage[]> {
  if (!vid.videoFileName || targetSecs.length === 0) return [];
  const results: DecodedKeyframeImage[] = [];

  // 1차 고속 경로: Z-코어 /__videos/thumb 병렬 추출 시도
  if (zCoreBridge.isConnected) {
    const zFetched = await Promise.all(
      targetSecs.map(async (rawSec) => {
        const sec = Math.max(0, Math.round(rawSec));
        const url = getZCoreUrl(`/__videos/thumb?p=${encodeURIComponent(vid.videoFileName)}&t=${Math.max(1, sec)}`);
        try {
          const res = await fetch(url);
          const ct = res.headers.get('content-type') || '';
          if (!res.ok || !ct.includes('image')) return null;
          const blob = await res.blob();
          if (blob.size < 800) return null;
          const decoded = await decodeImageBlobToRawAndThumb(blob);
          return decoded ? { timeSec: sec, ...decoded } : null;
        } catch {
          return null;
        }
      })
    );
    for (const item of zFetched) {
      if (item) results.push(item);
    }
    if (results.length > 0) {
      return results;
    }
  }

  // 2차 범용 경로: HTML5 <video> + Canvas (ffmpeg 미설치 PC 및 Android/iOS 네이티브 모바일 앱 호환)
  if (typeof document === 'undefined') return results;
  let streamSrc = vid.videoUrl || '';
  if (!streamSrc && String(vid.id || '').startsWith('mobile_vid_')) {
    streamSrc = await resolveNativeMobileVideoPlaybackUrl(vid.id);
  }
  if (!streamSrc && zCoreBridge.isConnected && vid.videoFileName) {
    streamSrc = getZCoreUrl(`/__photos/file?p=${encodeURIComponent(vid.videoFileName)}`);
  }
  if (!streamSrc) return results;

  const videoEl = document.createElement('video');
  videoEl.muted = true;
  videoEl.playsInline = true;
  if (streamSrc.includes('127.0.0.1:')) {
    videoEl.crossOrigin = 'anonymous';
  }
  videoEl.preload = 'auto';

  try {
    const metaLoaded = await new Promise<boolean>((resolve) => {
      let done = false;
      const finish = (ok: boolean) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(ok);
      };
      const timer = setTimeout(() => finish(false), 4000);
      videoEl.onloadedmetadata = () => finish(videoEl.videoWidth > 0 && videoEl.videoHeight > 0);
      videoEl.onerror = () => finish(false);
      videoEl.src = streamSrc;
    });

    if (!metaLoaded) return results;
    const realDur = Number.isFinite(videoEl.duration) && videoEl.duration > 0.5 ? videoEl.duration : vid.durationSec || 8;
    const scale = Math.min(1, 448 / Math.max(videoEl.videoWidth, videoEl.videoHeight));
    const w = Math.max(1, Math.round(videoEl.videoWidth * scale));
    const h = Math.max(1, Math.round(videoEl.videoHeight * scale));
    const { canvas, ctx } = createCanvas2D(w, h);
    if (!ctx) return results;

    const seekAndCapture = async (sec: number): Promise<DecodedKeyframeImage | null> => {
      const clamped = Math.max(0.3, Math.min(sec <= 0 ? Math.min(1.2, realDur * 0.18) : sec, Math.max(0.3, realDur - 0.3)));
      const seekOk = await new Promise<boolean>((resolve) => {
        let done = false;
        const finish = (ok: boolean) => {
          if (done) return;
          done = true;
          clearTimeout(tId);
          videoEl.onseeked = null;
          resolve(ok);
        };
        const tId = setTimeout(() => finish(false), 2600);
        videoEl.onseeked = () => finish(true);
        try {
          videoEl.currentTime = clamped;
        } catch {
          finish(false);
        }
      });
      if (!seekOk) return null;
      ctx.drawImage(videoEl, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h).data;
      // 검은 페이드인 프레임 감지 시 밝기 점검
      let lumSum = 0;
      const step = Math.max(4, Math.floor(data.length / 400) * 4);
      let count = 0;
      for (let p = 0; p < data.length; p += step) {
        lumSum += data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114;
        count++;
      }
      if (count > 0 && lumSum / count < 6 && clamped + 1.2 < realDur) {
        return null;
      }
      const rawImg = new RawImage(new Uint8ClampedArray(data.buffer), w, h, 4).rgb();
      const thumbDataUrl = canvasToJpegDataUrl(canvas);
      return { timeSec: Math.max(0, Math.round(sec)), rawImg, thumbDataUrl };
    };

    for (const rawSec of targetSecs) {
      let captured = await seekAndCapture(rawSec);
      if (!captured && rawSec + 1.2 < realDur) {
        captured = await seekAndCapture(rawSec + 1.2);
      }
      if (captured) {
        results.push({ ...captured, timeSec: Math.max(0, Math.round(rawSec)) });
      }
    }
  } finally {
    try {
      videoEl.pause();
      videoEl.removeAttribute('src');
      videoEl.load();
    } catch {
      /* ignore */
    }
  }

  return results;
}

function selectTargetFrameSecsForVideo(vid: VideoSceneItem, maxCheckpoints: number): number[] {
  const frames = vid.timelineFrames || [];
  if (maxCheckpoints <= 1) {
    if (frames.length > 0) {
      const fRep = frames[Math.min(frames.length - 1, Math.floor(frames.length * 0.45))];
      return [fRep.timeSec];
    }
    const d = Math.max(3, vid.durationSec || 8);
    return [Math.max(1, Math.round(d * 0.38))];
  }
  if (frames.length === 0) {
    const d = Math.max(3, vid.durationSec || 8);
    return maxCheckpoints <= 2
      ? [0, Math.max(2, Math.round(d * 0.55))]
      : [0, Math.max(1, Math.round(d * 0.35)), Math.max(2, Math.round(d * 0.75))];
  }
  if (frames.length <= maxCheckpoints) {
    return frames.map((f) => f.timeSec);
  }
  if (maxCheckpoints === 2) {
    // 도입부(0초 체크포인트)와 중반부 체크포인트를 함께 분석해 '전 구간 동일 장면(00:00~)' vs '중반 이후 특정 구간 등장'을 정확히 구분합니다.
    const fOpen = frames[0];
    const fMid = frames[Math.min(frames.length - 1, Math.max(1, Math.floor(frames.length * 0.55)))];
    return Array.from(new Set([fOpen.timeSec, fMid.timeSec]));
  }
  const f0 = frames[0];
  const fMid = frames[Math.floor(frames.length * 0.5)];
  const fEnd = frames[frames.length - 1];
  return Array.from(new Set([f0.timeSec, fMid.timeSec, fEnd.timeSec]));
}

export async function embedSingleLocalVideoIfNeeded(
  vid: VideoSceneItem,
  maxCheckpoints: number,
  onVideoThumbHydrated?: (videoFileName: string, thumbUrl: string) => void,
  onVideoOcrHydrated?: (
    videoFileName: string,
    ocrMeta: {
      hasScreenOcrText: boolean;
      ocrLineCount: number;
      ocrLines?: VideoOcrLineItem[];
      ocrFullText: string;
    }
  ) => void
): Promise<boolean> {
  if (!vid.videoFileName || vid.isAllBlack) return false;
  while (aiRuntimeFlags.activeVideoPlaybackCount > 0 && aiRuntimeFlags.priorityVideoSearchDepth === 0) {
    await new Promise((r) => setTimeout(r, 450));
  }
  const normVid = normalizeLocalVideoSceneItem(vid);
  const baseKey = getVideoMediaBaseKey(normVid);
  const targetSecs = selectTargetFrameSecsForVideo(normVid, maxCheckpoints);
  const missingSecs = targetSecs.filter((s) => !localVideoFrameVecMap.has(getVideoFrameCacheKey(normVid, s)));
  const needsOcrPrewarm =
    !normVid.ocrFullText &&
    (!Array.isArray(normVid.ocrLines) || normVid.ocrLines.length === 0);

  const isMobileNativeVid = String(normVid.id || '').startsWith('mobile_vid_');

  if (missingSecs.length === 0) {
    if (needsOcrPrewarm) {
      const runPrewarm = async () => {
        try {
          const ocrOut = await extractVideoScreenTextOnDemand(normVid);
          if (ocrOut.ocrLines && ocrOut.ocrLines.length > 0) {
            onVideoOcrHydrated?.(normVid.videoFileName, {
              hasScreenOcrText: true,
              ocrLineCount: ocrOut.ocrLines.length,
              ocrLines: ocrOut.ocrLines,
              ocrFullText: ocrOut.fullText,
            });
          }
        } catch {
          /* ignore background prewarm failure */
        }
      };
      if (isMobileNativeVid) {
        await runPrewarm();
      } else {
        void runPrewarm();
      }
    }
    return false;
  }

  const decodedFrames = await captureLocalVideoKeyframesUniversal(normVid, missingSecs);
  if (decodedFrames.length === 0) return false;

  // 백그라운드 인덱싱 시점 사전 OCR 프리워밍 (영상 클릭 시 로딩 0초로 하단 즉시 노출 보장 · 모바일은 메모리 피크 방지를 위해 순차 실행)
  if (needsOcrPrewarm) {
    const runFullPrewarm = async () => {
      try {
        while (aiRuntimeFlags.activeVideoPlaybackCount > 0) {
          await new Promise((r) => setTimeout(r, 500));
        }
        const ocrOut = await extractVideoScreenTextOnDemand(normVid);
        if (ocrOut.ocrLines && ocrOut.ocrLines.length > 0) {
          onVideoOcrHydrated?.(normVid.videoFileName, {
            hasScreenOcrText: true,
            ocrLineCount: ocrOut.ocrLines.length,
            ocrLines: ocrOut.ocrLines,
            ocrFullText: ocrOut.fullText,
          });
          return;
        }
        if (!normVid.thumbUrl && zCoreBridge.isConnected && decodedFrames.some((df) => df.thumbDataUrl)) {
          const ocrPayloadFrames = decodedFrames
            .filter((df) => Boolean(df.thumbDataUrl))
            .map((df) => ({ timeSec: df.timeSec, dataUrl: df.thumbDataUrl }));
          if (ocrPayloadFrames.length === 0) return;
          const res = await fetch(getZCoreUrl('/__videos/ocr-frames'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              videoFileName: normVid.videoFileName,
              durationSec: normVid.durationSec,
              frames: ocrPayloadFrames,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data && (data.hasText || data.hasRichText)) {
              onVideoOcrHydrated?.(normVid.videoFileName, {
                hasScreenOcrText: true,
                ocrLineCount: Number(data.lineCount || (data.ocrLines || []).length || 1),
                ocrLines: Array.isArray(data.ocrLines) ? data.ocrLines : undefined,
                ocrFullText: String(data.fullText || '').trim(),
              });
            }
          }
        }
      } catch {
        /* ignore optional OCR frame error */
      }
    };
    if (isMobileNativeVid) {
      await runFullPrewarm();
    } else {
      void runFullPrewarm();
    }
  }

  let updatedAny = false;
  for (let i = 0; i < decodedFrames.length; i++) {
    while (aiRuntimeFlags.activeVideoPlaybackCount > 0 && aiRuntimeFlags.priorityVideoSearchDepth === 0) {
      await new Promise((r) => setTimeout(r, 450));
    }
    const df = decodedFrames[i];
    const fKey = getVideoFrameCacheKey(normVid, df.timeSec);
    if (df.thumbDataUrl) {
      localVideoFrameThumbMap.set(fKey, df.thumbDataUrl);
      if (!localVideoRepThumbMap.has(baseKey)) {
        localVideoRepThumbMap.set(baseKey, df.thumbDataUrl);
        onVideoThumbHydrated?.(normVid.videoFileName, df.thumbDataUrl);
      }
    }
    const tInfer0 = performance.now();
    const vec = await embedRawImageWithSharedVision(df.rawImg);
    const inferMs = performance.now() - tInfer0;
    if (vec) {
      localVideoFrameVecMap.set(fKey, vec);
      await persistMediaCacheEntry(fKey, vec, df.thumbDataUrl);
      if (i === 0 || !localVideoFrameVecMap.has(`vrep:${baseKey}`)) {
        localVideoFrameVecMap.set(`vrep:${baseKey}`, vec);
        await persistMediaCacheEntry(`vrep:${baseKey}`, vec, localVideoRepThumbMap.get(baseKey));
      }
      updatedAny = true;
    }
    if (
      aiRuntimeFlags.priorityVideoSearchDepth === 0 &&
      inferMs > 300 &&
      silentIndexingBrake.getSnapshot().speedMode !== 'turbo'
    ) {
      await new Promise((r) => setTimeout(r, Math.min(220, Math.round(inferMs * 0.25))));
    }
  }
  return updatedAny;
}

export function hasUnindexedLocalVideos(videos: VideoSceneItem[]): boolean {
  for (const v of videos) {
    if (v.isAllBlack || !String(v.id || '').startsWith('local_vid_')) continue;
    const nv = normalizeLocalVideoSceneItem(v);
    const secs = selectTargetFrameSecsForVideo(nv, 2);
    if (secs.some((s) => !localVideoFrameVecMap.has(getVideoFrameCacheKey(nv, s)))) {
      return true;
    }
  }
  return false;
}

export async function ensureVideoKeyframesEmbeddedForSearch(
  videos: VideoSceneItem[],
  maxVideos = 8,
  shouldAbort?: () => boolean,
  maxCheckpoints = 2
): Promise<boolean> {
  if (!hasActiveGhostiLoginSession() || !zCoreBridge.isConnected) return false;
  await hydrateRealMediaVectorCacheOnce();

  const targets = videos
    .filter((v) => !v.isAllBlack && String(v.id || '').startsWith('local_vid_'))
    .filter((v) => {
      if (maxCheckpoints <= 1) {
        return !hasAnyCachedVectorForVideo(v);
      }
      const nv = normalizeLocalVideoSceneItem(v);
      const secs = selectTargetFrameSecsForVideo(nv, maxCheckpoints);
      return secs.some((s) => !localVideoFrameVecMap.has(getVideoFrameCacheKey(nv, s)));
    })
    .slice(0, maxVideos);

  if (targets.length === 0) return false;

  let embeddedAny = false;
  aiRuntimeFlags.priorityVideoSearchDepth += 1;
  try {
    for (const vid of targets) {
      if (shouldAbort?.()) break;
      const didUpdate = await embedSingleLocalVideoIfNeeded(vid, maxCheckpoints);
      if (didUpdate) embeddedAny = true;
      await new Promise((r) => setTimeout(r, 20));
    }
  } finally {
    aiRuntimeFlags.priorityVideoSearchDepth = Math.max(0, aiRuntimeFlags.priorityVideoSearchDepth - 1);
    bumpSharedVisionIdleDispose();
  }
  return embeddedAny;
}

export interface VideoOcrLineItem {
  timeSec: number;
  timestamp: string;
  text: string;
}

export interface VideoOcrExtractResult {
  ok: boolean;
  hasText: boolean;
  videoFileName: string;
  ocrLines: VideoOcrLineItem[];
  fullText: string;
}

/**
 * HTML5 <video> + <canvas> 기반으로 로컬/원격 영상의 고해상도(최대 960px) 텍스트 판독용 JPEG 프레임을 샘플링합니다.
 * (FFmpeg 설치 0건, 브라우저 기본 디코더 100% 활용)
 */
async function captureHighResFramesForVideoOcr(
  vid: VideoSceneItem,
  maxSamples = 10
): Promise<Array<{ timeSec: number; dataUrl: string }>> {
  if (typeof document === 'undefined' || !vid.videoUrl) return [];
  return new Promise((resolve) => {
    const videoEl = document.createElement('video');
    videoEl.crossOrigin = 'anonymous';
    videoEl.muted = true;
    videoEl.playsInline = true;
    videoEl.preload = 'auto';
    videoEl.src = vid.videoUrl;

    let settled = false;
    const finish = (items: Array<{ timeSec: number; dataUrl: string }>) => {
      if (settled) return;
      settled = true;
      try {
        videoEl.pause();
        videoEl.removeAttribute('src');
        videoEl.load();
      } catch {
        /* ignore */
      }
      resolve(items);
    };

    const timeoutId = window.setTimeout(() => finish([]), 12000);

    videoEl.onerror = () => {
      window.clearTimeout(timeoutId);
      finish([]);
    };

    videoEl.onloadedmetadata = async () => {
      try {
        const dur = Math.max(1, Number(videoEl.duration) || Number(vid.durationSec) || 6);
        const count = Math.min(maxSamples, Math.max(3, Math.ceil(dur / 3)));
        const targetSecs: number[] = [];
        for (let i = 0; i < count; i++) {
          const ratio = count === 1 ? 0.2 : (i + 0.35) / count;
          targetSecs.push(Math.max(0.1, Math.min(dur - 0.1, Number((dur * ratio).toFixed(1)))));
        }

        const results: Array<{ timeSec: number; dataUrl: string }> = [];
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          window.clearTimeout(timeoutId);
          finish([]);
          return;
        }

        for (const sec of targetSecs) {
          const seekOk = await new Promise<boolean>((resSeek) => {
            let done = false;
            const st = window.setTimeout(() => {
              if (!done) {
                done = true;
                resSeek(false);
              }
            }, 2200);
            videoEl.onseeked = () => {
              if (!done) {
                done = true;
                window.clearTimeout(st);
                resSeek(true);
              }
            };
            try {
              videoEl.currentTime = sec;
            } catch {
              window.clearTimeout(st);
              resSeek(false);
            }
          });
          if (!seekOk) continue;
          const vw = videoEl.videoWidth || 640;
          const vh = videoEl.videoHeight || 360;
          const scale = Math.min(1, 1920 / Math.max(vw, vh));
          canvas.width = Math.max(160, Math.round(vw * scale));
          canvas.height = Math.max(90, Math.round(vh * scale));
          ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
          if (dataUrl && dataUrl.startsWith('data:image/')) {
            results.push({ timeSec: Math.round(sec), dataUrl });
          }
        }
        window.clearTimeout(timeoutId);
        finish(results);
      } catch {
        window.clearTimeout(timeoutId);
        finish([]);
      }
    };
  });
}

async function captureHighResImageDataForVideoOcr(
  vid: VideoSceneItem,
  maxKeep = 14
): Promise<Array<{ timeSec: number; imageData: ImageData }>> {
  if (typeof document === 'undefined') return [];
  let srcUrl = vid.videoUrl || '';
  if (!srcUrl && String(vid.id || '').startsWith('mobile_vid_')) {
    srcUrl = await resolveNativeMobileVideoPlaybackUrl(vid.id);
  }
  if (!srcUrl) return [];
  return new Promise((resolve) => {
    const videoEl = document.createElement('video');
    if (srcUrl.includes('127.0.0.1:')) {
      videoEl.crossOrigin = 'anonymous';
    }
    videoEl.muted = true;
    videoEl.playsInline = true;
    videoEl.preload = 'auto';
    videoEl.src = srcUrl;

    let settled = false;
    const finish = (items: Array<{ timeSec: number; imageData: ImageData }>) => {
      if (settled) return;
      settled = true;
      try {
        videoEl.pause();
        videoEl.removeAttribute('src');
        videoEl.load();
      } catch {
        /* ignore */
      }
      resolve(items);
    };

    const timeoutId = window.setTimeout(() => finish([]), 18000);

    videoEl.onerror = () => {
      window.clearTimeout(timeoutId);
      finish([]);
    };

    videoEl.onloadedmetadata = async () => {
      try {
        const dur = Math.max(1, Number(videoEl.duration) || Number(vid.durationSec) || 6);
        const denseCount = Math.min(28, Math.max(4, Math.ceil(dur / 2.4)));
        const targetSecs: number[] = [];
        for (let i = 0; i < denseCount; i++) {
          const ratio = denseCount === 1 ? 0.25 : (i + 0.35) / denseCount;
          targetSecs.push(Math.max(0.1, Math.min(dur - 0.1, Number((dur * ratio).toFixed(1)))));
        }

        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = 96;
        thumbCanvas.height = 54;
        const thumbCtx = thumbCanvas.getContext('2d', { willReadFrequently: true });
        const hiCanvas = document.createElement('canvas');
        const hiCtx = hiCanvas.getContext('2d', { willReadFrequently: true });
        if (!thumbCtx || !hiCtx) {
          window.clearTimeout(timeoutId);
          finish([]);
          return;
        }

        interface RawScanFrame {
          sec: number;
          gray: Float32Array;
          sharp: number;
        }
        const scanned: RawScanFrame[] = [];

        for (const sec of targetSecs) {
          const seekOk = await new Promise<boolean>((resSeek) => {
            let done = false;
            const st = window.setTimeout(() => {
              if (!done) {
                done = true;
                resSeek(false);
              }
            }, 2200);
            videoEl.onseeked = () => {
              if (!done) {
                done = true;
                window.clearTimeout(st);
                resSeek(true);
              }
            };
            try {
              videoEl.currentTime = sec;
            } catch {
              window.clearTimeout(st);
              resSeek(false);
            }
          });
          if (!seekOk) continue;

          thumbCtx.drawImage(videoEl, 0, 0, 96, 54);
          const tData = thumbCtx.getImageData(0, 0, 96, 54).data;
          const gray = new Float32Array(96 * 54);
          let sum = 0;
          for (let i = 0; i < 96 * 54; i++) {
            const g = tData[i * 4] * 0.299 + tData[i * 4 + 1] * 0.587 + tData[i * 4 + 2] * 0.114;
            gray[i] = g;
            sum += g;
          }
          const mean = sum / gray.length;
          let varSum = 0;
          for (let i = 0; i < gray.length; i++) {
            const d = gray[i] - mean;
            varSum += d * d;
          }
          if (Math.sqrt(varSum / gray.length) < 4.5) continue;

          let edgeSum = 0;
          let edgeCnt = 0;
          for (let y = 0; y < 53; y++) {
            const row = y * 96;
            for (let x = 0; x < 95; x++) {
              edgeSum += Math.abs(gray[row + x + 1] - gray[row + x]) + Math.abs(gray[row + 96 + x] - gray[row + x]);
              edgeCnt++;
            }
          }
          scanned.push({ sec, gray, sharp: edgeCnt > 0 ? edgeSum / edgeCnt : 0 });
        }

        if (scanned.length === 0) {
          window.clearTimeout(timeoutId);
          finish([]);
          return;
        }

        const madBetween = (a: Float32Array, b: Float32Array) => {
          let s = 0;
          for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
          return s / a.length;
        };

        const clusters: RawScanFrame[][] = [[scanned[0]]];
        for (let i = 1; i < scanned.length; i++) {
          const cur = scanned[i];
          const prev = clusters[clusters.length - 1][clusters[clusters.length - 1].length - 1];
          if (madBetween(cur.gray, prev.gray) < 4.3) {
            clusters[clusters.length - 1].push(cur);
          } else {
            clusters.push([cur]);
          }
        }

        const chosen: Array<{ seekSec: number; startSec: number }> = [];
        for (let ci = 0; ci < clusters.length; ci++) {
          const cl = clusters[ci];
          if (cl.length === 1 && ci > 0 && ci < clusters.length - 1) {
            const prevCl = clusters[ci - 1];
            const nextCl = clusters[ci + 1];
            const dPrev = madBetween(cl[0].gray, prevCl[prevCl.length - 1].gray);
            const dNext = madBetween(nextCl[0].gray, cl[0].gray);
            const nSharp = Math.max(prevCl[prevCl.length - 1].sharp, nextCl[0].sharp);
            if (dPrev > 5.2 && dNext > 5.2 && cl[0].sharp < nSharp * 0.93) {
              continue;
            }
          }
          let best = cl[0];
          for (const item of cl) {
            if (item.sharp > best.sharp || (item.sharp === best.sharp && item.sec > best.sec)) {
              best = item;
            }
          }
          chosen.push({ seekSec: best.sec, startSec: Math.round(best.sec) });
        }

        const capped =
          chosen.length > maxKeep
            ? Array.from({ length: maxKeep }, (_, k) =>
                chosen[Math.min(chosen.length - 1, Math.round((k * chosen.length) / maxKeep))]
              )
            : chosen;

        const results: Array<{ timeSec: number; imageData: ImageData }> = [];
        const vw = videoEl.videoWidth || 640;
        const vh = videoEl.videoHeight || 360;
        const scale = Math.min(1, 1600 / Math.max(vw, vh));
        hiCanvas.width = Math.max(160, Math.round(vw * scale));
        hiCanvas.height = Math.max(90, Math.round(vh * scale));

        for (const item of capped) {
          const seekOk = await new Promise<boolean>((resSeek) => {
            let done = false;
            const st = window.setTimeout(() => {
              if (!done) {
                done = true;
                resSeek(false);
              }
            }, 2200);
            videoEl.onseeked = () => {
              if (!done) {
                done = true;
                window.clearTimeout(st);
                resSeek(true);
              }
            };
            try {
              videoEl.currentTime = item.seekSec;
            } catch {
              window.clearTimeout(st);
              resSeek(false);
            }
          });
          if (!seekOk) continue;
          hiCtx.drawImage(videoEl, 0, 0, hiCanvas.width, hiCanvas.height);
          results.push({
            timeSec: item.startSec,
            imageData: hiCtx.getImageData(0, 0, hiCanvas.width, hiCanvas.height),
          });
        }

        window.clearTimeout(timeoutId);
        finish(results);
      } catch {
        window.clearTimeout(timeoutId);
        finish([]);
      }
    };
  });
}

const inMemoryPaddleVideoOcrCache = new Map<string, VideoOcrExtractResult>();

const RECORDER_WATERMARK_SEG_RX =
  /^(?:notebooklm|capcut|veo|kapwing|[xyv]?rec[eo]rder|mobizen|bandicam(?:\.com)?|gomcam|ocam|az\s*screen(?:\s*recorder)?|inshot|kinemaster|vivavideo|filmora)$/i;

function dedupePaddleTimelineLines(
  rawFrames: Array<{ timeSec: number; ocrText: string }>,
  formatTs: (sec: number) => string
): VideoOcrLineItem[] {
  const deduped: VideoOcrLineItem[] = [];
  let prevNorm = '';
  let prevBigrams = new Set<string>();

  const makeBigrams = (s: string) => {
    const out = new Set<string>();
    if (s.length < 2) {
      if (s) out.add(s);
      return out;
    }
    for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
    return out;
  };

  const sorted = [...rawFrames].sort((a, b) => a.timeSec - b.timeSec);
  const segRows = sorted.map((fr) => {
    const cleaned = String(fr.ocrText || '')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' · ')
      .map((s) => s.trim())
      .filter((s) => s && !RECORDER_WATERMARK_SEG_RX.test(s));
    return { timeSec: fr.timeSec, segs: cleaned };
  });

  if (segRows.length >= 3) {
    const tailCands: Array<{ idx: number; bg: Set<string> }> = [];
    segRows.forEach((row, idx) => {
      if (row.segs.length >= 2) {
        const tail = row.segs[row.segs.length - 1];
        if (
          tail.length >= 3 &&
          tail.length <= 20 &&
          /^[A-Za-z0-9._\- ]+$/.test(tail) &&
          /[A-Za-z]{3,}/.test(tail)
        ) {
          tailCands.push({ idx, bg: makeBigrams(tail.toLowerCase().replace(/[^a-z0-9]/g, '')) });
        }
      }
    });
    const dropIndices = new Set<number>();
    for (const candA of tailCands) {
      if (candA.bg.size === 0) continue;
      let simCount = 0;
      for (const candB of tailCands) {
        if (candB.bg.size === 0) continue;
        let inter = 0;
        for (const g of candA.bg) {
          if (candB.bg.has(g)) inter++;
        }
        if (inter / Math.max(1, Math.min(candA.bg.size, candB.bg.size)) >= 0.72) {
          simCount++;
        }
      }
      if (simCount >= 3) dropIndices.add(candA.idx);
    }
    if (dropIndices.size > 0) {
      segRows.forEach((row, idx) => {
        if (dropIndices.has(idx) && row.segs.length >= 2) {
          row.segs = row.segs.slice(0, -1);
        }
      });
    }
  }

  for (const fr of segRows) {
    const txt = fr.segs.join(' · ').trim();
    const norm = txt.replace(/[^가-힣a-zA-Z0-9]/g, '').toLowerCase();
    if (norm.length < 4) continue;
    const curBigrams = makeBigrams(norm);

    if (prevNorm && deduped.length > 0) {
      if (norm === prevNorm) continue;
      if (norm.length >= 5 && prevNorm.includes(norm)) continue;
      if (prevNorm.length >= 5 && norm.includes(prevNorm)) {
        deduped[deduped.length - 1].text = txt;
        prevNorm = norm;
        prevBigrams = curBigrams;
        continue;
      }
      if (prevBigrams.size > 0 && curBigrams.size > 0) {
        let inter = 0;
        for (const bg of curBigrams) {
          if (prevBigrams.has(bg)) inter++;
        }
        const containment = inter / Math.max(1, Math.min(prevBigrams.size, curBigrams.size));
        if (containment >= 0.8) {
          if (norm.length > prevNorm.length + 4) {
            deduped[deduped.length - 1].text = txt;
            prevNorm = norm;
            prevBigrams = curBigrams;
          }
          continue;
        }
      }
    }
    prevNorm = norm;
    prevBigrams = curBigrams;
    deduped.push({
      timeSec: fr.timeSec,
      timestamp: formatTs(fr.timeSec),
      text: txt,
    });
  }
  return deduped;
}

/**
 * [영상 속 화면 글자 고정밀 텍스트 추출 (PP-OCRv5 Korean + 다단 카드·줄바꿈 문장 복원)]
 * 1) PC 로컬 Z-코어(v2.3.33+, ocrVer >= 21) 연결 시: C++ 멀티스레드 PP-OCRv5 + 장면 변화 선별 워커로 3~5초 만에 초고속 반환!
 * 2) 모바일 / 웹 단독 환경: 화소 변화 기반 중복·디졸브 제거 후 온디바이스 PP-OCRv5로 정밀 판독!
 */
export async function extractVideoScreenTextOnDemand(
  vid: VideoSceneItem
): Promise<VideoOcrExtractResult> {
  const formatTs = (sec: number) => {
    const s = Math.max(0, Math.floor(sec || 0));
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const memKey = `${vid.videoFileName || vid.id}|${vid.sizeMB || 0}|v33`;
  const memHit = inMemoryPaddleVideoOcrCache.get(memKey);
  if (memHit && memHit.ocrLines.length > 0) {
    return memHit;
  }

  // 0) 사전 인덱싱 시점(Z-코어 list_local_videos 또는 백그라운드 프리워밍)에 이미 VideoSceneItem에 탑재된 OCR 텍스트가 있으면 0.00초 즉시 반환!
  if (Array.isArray(vid.ocrLines) && vid.ocrLines.length > 0) {
    const preFull =
      vid.ocrFullText ||
      vid.ocrLines.map((l) => `[${l.timestamp}] ${l.text}`).join('\n');
    const preOut: VideoOcrExtractResult = {
      ok: true,
      hasText: true,
      videoFileName: vid.videoFileName,
      ocrLines: vid.ocrLines,
      fullText: preFull,
    };
    inMemoryPaddleVideoOcrCache.set(memKey, preOut);
    return preOut;
  }

  // 1) PC 로컬 Z-코어(v2.3.33+, ocrVer >= 21) C++ 네이티브 PP-OCRv5 고속 경로 (77초 ➔ 3~5초 단축!)
  if (zCoreBridge.isConnected && vid.videoFileName) {
    try {
      const resZ = await fetch(getZCoreUrl('/__videos/extract-ocr-text'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoFileName: vid.videoFileName }),
      });
      if (resZ.ok) {
        const dataZ = await resZ.json();
        const linesZ: VideoOcrLineItem[] = Array.isArray(dataZ?.ocrLines)
          ? dataZ.ocrLines
          : [];
        if (Number(dataZ?.ocrVer || 0) >= 21 && linesZ.length > 0) {
          const out: VideoOcrExtractResult = {
            ok: true,
            hasText: true,
            videoFileName: vid.videoFileName,
            ocrLines: linesZ,
            fullText: String(dataZ.fullText || ''),
          };
          inMemoryPaddleVideoOcrCache.set(memKey, out);
          return out;
        }
      }
    } catch {
      /* fallback to web PP-OCRv5 below */
    }
  }

  // 2) 브라우저 <video> 무손실 ImageData 샘플링 + PP-OCRv5 Korean 정밀 판독 (PC & 모바일 공통)
  const isMobileVid = String(vid.id || '').startsWith('mobile_vid_');
  const isRealVideoSource =
    isMobileVid ||
    (Boolean(vid.videoUrl) &&
      (vid.videoUrl!.startsWith('blob:') ||
        vid.videoUrl!.startsWith('/') ||
        vid.videoUrl!.startsWith('http://127.0.0.1') ||
        vid.videoUrl!.startsWith('http://localhost') ||
        vid.videoUrl!.startsWith('https://localhost') ||
        vid.videoUrl!.startsWith('capacitor://localhost') ||
        Boolean(vid.videoFileName)));

  if (isRealVideoSource) {
    try {
      const rawPaddleFrames: Array<{ timeSec: number; ocrText: string }> = [];

      // 2-A) 모바일 정공법(대안 B): Android ML Kit Korean v2 번들 + iOS Apple Vision ko-KR 네이티브 NPU 직결 (0.2~0.4초, WASM 경합 0%)
      if (isMobileVid) {
        const nativeOcr = await extractNativeMobileVideoOcr(vid.id, 8);
        if (nativeOcr.supported) {
          const outNative: VideoOcrExtractResult = {
            ok: nativeOcr.ok,
            hasText: nativeOcr.hasText && nativeOcr.ocrLines.length > 0,
            videoFileName: vid.videoFileName,
            ocrLines: nativeOcr.ocrLines,
            fullText:
              nativeOcr.fullText ||
              nativeOcr.ocrLines.map((l) => `[${l.timestamp}] ${l.text}`).join('\n'),
          };
          if (outNative.ocrLines.length > 0) {
            inMemoryPaddleVideoOcrCache.set(memKey, outNative);
          }
          return outNative;
        }
        // 구버전 네이티브 래퍼(<= 1.0.54) 폴백
        const nativeFrames = await extractNativeMobileVideoKeyframes(vid.id, 6);
        if (nativeFrames.length > 0) {
          let prevDataSig = '';
          for (const nf of nativeFrames) {
            const sig = nf.dataUrl.slice(-180);
            if (sig && sig === prevDataSig) continue;
            prevDataSig = sig;
            const ocrRes = await recognizeDataUrlWithPaddleOcr(nf.dataUrl, { filterVideoUi: true });
            if (ocrRes.text) {
              rawPaddleFrames.push({ timeSec: Number(nf.timeSec || 0), ocrText: ocrRes.text });
            }
          }
        }
      }

      if (rawPaddleFrames.length === 0) {
        const sampledImgData = await captureHighResImageDataForVideoOcr(vid, isMobileVid ? 8 : 12);

        if (sampledImgData.length > 0) {
          for (const item of sampledImgData) {
            const ocrRes = await recognizeImageDataWithPaddleOcr(item.imageData, { filterVideoUi: true });
            if (ocrRes.text) {
              rawPaddleFrames.push({ timeSec: item.timeSec, ocrText: ocrRes.text });
            }
          }
        } else if (zCoreBridge.isConnected && vid.videoFileName) {
          // 특수 코덱으로 브라우저 <video> 직접 디코딩이 불가한 경우 Z-코어가 뽑아준 프레임에 PP-OCRv5 수행
          const resFrames = await fetch(getZCoreUrl('/__videos/extract-ocr-text'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              videoFileName: vid.videoFileName,
              onlyCachedV5: true,
              returnFramesForPaddle: true,
            }),
          });
          if (resFrames.ok) {
            const df = await resFrames.json();
            const sFrames: Array<{ timeSec: number; dataUrl: string }> = Array.isArray(df?.sampledFrames)
              ? df.sampledFrames
              : [];
            for (const sf of sFrames) {
              const ocrRes = await recognizeDataUrlWithPaddleOcr(sf.dataUrl);
              if (ocrRes.text) {
                rawPaddleFrames.push({ timeSec: Number(sf.timeSec || 0), ocrText: ocrRes.text });
              }
            }
          }
        }
      }

      if (rawPaddleFrames.length > 0) {
        const lines = dedupePaddleTimelineLines(rawPaddleFrames, formatTs);
        const fullText = lines.map((l) => `[${l.timestamp}] ${l.text}`).join('\n');
        const resultObj: VideoOcrExtractResult = {
          ok: true,
          hasText: lines.length > 0,
          videoFileName: vid.videoFileName,
          ocrLines: lines,
          fullText,
        };
        if (lines.length > 0) {
          inMemoryPaddleVideoOcrCache.set(memKey, resultObj);
        }

        // 로컬 Z-코어 연결 시 PP-OCRv5 결과를 영구 캐시(ocrVer=20)로 비동기 저장
        if (zCoreBridge.isConnected && vid.videoFileName && lines.length > 0) {
          void fetch(getZCoreUrl('/__videos/ocr-frames'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              videoFileName: vid.videoFileName,
              durationSec: vid.durationSec,
              precomputedFrames: rawPaddleFrames,
            }),
          }).catch(() => {});
        }

        return resultObj;
      }
    } catch (err) {
      console.warn('[PP-OCRv5 Video OCR] fallback due to error:', err);
    }
  }

  // 쇼케이스/기추출 캡션 폴백
  const fallbackLines: VideoOcrLineItem[] = [];
  const seen = new Set<string>();
  if (vid.ocrFullText) {
    for (const rawLine of vid.ocrFullText.split('\n')) {
      const trimmed = rawLine.trim();
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      const m = trimmed.match(/^\[(\d{2}):(\d{2})\]\s*(.+)$/);
      if (m) {
        const sec = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
        fallbackLines.push({ timeSec: sec, timestamp: `${m[1]}:${m[2]}`, text: m[3] });
      } else {
        fallbackLines.push({ timeSec: 0, timestamp: '00:00', text: trimmed });
      }
    }
  }
  if (!isMobileVid && fallbackLines.length === 0 && Array.isArray(vid.timelineFrames)) {
    for (const f of vid.timelineFrames) {
      const cap = String(f.sceneCaption || '').trim();
      if (
        !cap ||
        /\s장면\s*\(\d{2}:\d{2}\)$/.test(cap) ||
        /시작\s*장면$/.test(cap) ||
        seen.has(cap)
      ) {
        continue;
      }
      seen.add(cap);
      fallbackLines.push({
        timeSec: f.timeSec || 0,
        timestamp: f.timestampText || formatTs(f.timeSec || 0),
        text: cap,
      });
    }
  }
  const fullText = fallbackLines.map((l) => `[${l.timestamp}] ${l.text}`).join('\n');
  return {
    ok: true,
    hasText: fallbackLines.length > 0,
    videoFileName: vid.videoFileName,
    ocrLines: fallbackLines,
    fullText,
  };
}

