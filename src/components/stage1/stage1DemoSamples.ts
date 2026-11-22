import type { LocalDocumentFile, PhotoItem, VideoSceneItem } from '../../types/saysee';

/**
 * 🧪 1단계 [🎯 찾기] 미니멀 프리뷰 컴포넌트
 * - 기존 상단 검색 구도 + 하단 샘플 사진·영상·문서 바둑판 100% 보존
 * - 1) 검색창 내부 10초 롤링 플레이스홀더 + 포커스/타이핑 시 즉시 정지 + [예시 바로 검색 ↵] 원클릭 체험 버튼
 * - 2) [❐ 동일 연사 묶어보기 ON] 스위치 버튼 삭제 & "전체 사진 목록 · 총 N장" 단순화 (썸네일 클릭 시 상세 모달에서 연사 나란히 비교 보장)
 * - 3) 문서·영상 목록 상단 TMI 설명 배지("실생활 필수 문서 N건 · 별표 가림 없이...") -> "총 N건" 단순화
 */
export const DEMO_SEARCH_SAMPLE_PHOTOS_2: PhotoItem[] = [
  {
    id: 'demo_sample_photo_1',
    name: 'IMG_20250510_1001.jpg',
    size: 1840000,
    date: '2025-05-10',
    mtimeMs: 1746840000000,
    thumbUrl: '/sample_photos_301/IMG_20250510_1001.jpg',
    fullUrl: '/sample_photos_301/IMG_20250510_1001.jpg',
    tags: ['#가족·나들이', '#해변', '#일몰', '#연사베스트컷'],
    captionKo: '[체험 샘플 1/2] 해변 노을 아래 가족이 함께 웃으며 산책하는 기념 사진입니다.',
    captionEn: 'Family walking on the beach at sunset.',
    keywordsKo: ['가족', '해변', '바다', '노을', '산책', '여행'],
  },
  {
    id: 'demo_sample_photo_2',
    name: 'TRV_20250720_1139.jpg',
    size: 2150000,
    date: '2025-07-20',
    mtimeMs: 1752970000000,
    thumbUrl: '/sample_photos_301/TRV_20250720_1139.jpg',
    fullUrl: '/sample_photos_301/TRV_20250720_1139.jpg',
    tags: ['#여름휴가·바다', '#패러세일링', '#코타키나발루'],
    captionKo: '[체험 샘플 2/2] 푸른 바다 위에서 패러세일링 낙하산을 타고 하늘을 나는 여름휴가 사진입니다.',
    captionEn: 'Parasailing over the blue ocean.',
    keywordsKo: ['패러세일링', '바다', '여름휴가', '여행', '하늘', '보트'],
  },
];

export const DEMO_SEARCH_SAMPLE_VIDEOS_2: VideoSceneItem[] = [
  {
    id: 'demo_sample_video_1',
    title: '[체험 샘플 1/2] 코타키나발루 바다 패러세일링 하이라이트.mp4',
    videoFileName: '20240719_105706.mp4',
    keyframePhotoId: '20240719_105706_t12.jpg',
    durationText: '00:18',
    durationSec: 18,
    date: '2025-07-19',
    locationKo: '코타키나발루 해변',
    resolution: '1920x1080',
    sizeMB: 14.2,
    matchedTimestamp: '00:12',
    matchedSeekSec: 12,
    matchedFrameCaption: '모터보트 뒤에서 낙하산을 타고 바다 위로 떠오르는 하이라이트 장면',
    sceneDescription: '푸른 바다 위 패러세일링 액티비티 촬영 영상 (샘플)',
    thumbUrl: '/poc/results/video_frames/20240719_105706_t12.jpg',
    videoUrl: '',
    keywords: ['패러세일링', '바다', '보트', '여행', '하늘'],
    hasScreenOcrText: true,
    ocrLineCount: 2,
    ocrFullText: 'KOTA KINABALU PARASAILING TOUR / 2인 탑승 완료',
    timelineFrames: [
      {
        frameId: 'demo_v1_f1',
        timeSec: 12,
        timestampText: '00:12',
        phaseLabel: '하이라이트',
        sceneCaption: '패러세일링 낙하산 활강 장면',
        keywords: ['패러세일링', '바다', '보트'],
        tags: ['#패러세일링', '#바다'],
        thumbUrl: '/poc/results/video_frames/20240719_105706_t12.jpg',
      },
    ],
  },
  {
    id: 'demo_sample_video_2',
    title: '[체험 샘플 2/2] 팀 주간 회의 화이트보드 매출 목표 브리핑.mp4',
    videoFileName: '20260918_202442.mp4',
    keyframePhotoId: '20260918_202442_t00.jpg',
    durationText: '00:24',
    durationSec: 24,
    date: '2025-09-18',
    locationKo: '본사 대회의실',
    resolution: '1920x1080',
    sizeMB: 18.6,
    matchedTimestamp: '00:08',
    matchedSeekSec: 8,
    matchedFrameCaption: '회의실 화이트보드 판서 및 내년 매출 목표 발표 장면',
    sceneDescription: '회의실 화이트보드 브리핑 녹화 영상 (샘플)',
    thumbUrl: '/poc/results/video_frames/20260918_202442_t00.jpg',
    videoUrl: '',
    keywords: ['회의실', '화이트보드', '매출', '목표', '발표'],
    hasScreenOcrText: true,
    ocrLineCount: 3,
    ocrFullText: '2026 목표 매출 35억 달성 로드맵 / Q4 핵심 과제',
    timelineFrames: [
      {
        frameId: 'demo_v2_f1',
        timeSec: 8,
        timestampText: '00:08',
        phaseLabel: '브리핑',
        sceneCaption: '화이트보드 매출 목표 판서 장면',
        keywords: ['회의실', '화이트보드', '매출'],
        tags: ['#회의실', '#화이트보드'],
        thumbUrl: '/poc/results/video_frames/20260918_202442_t00.jpg',
      },
    ],
  },
];

export const DEMO_SEARCH_SAMPLE_DOCS_2: LocalDocumentFile[] = [
  {
    id: 'demo_sample_doc_1',
    fileName: '2026_표준_사무실임대차계약서_샘플.pdf',
    title: '[체험 샘플 1/2] 2026 표준 사무실 임대차계약서 (보증금·월세 특약)',
    ext: 'PDF',
    categoryBadge: '계약·법무 샘플',
    date: '2025-08-12',
    sizeKB: 420,
    deviceSource: '체험판 샘플 문서',
    extractedText:
      '제3조(보증금 및 월세) 보증금 금 오천만원정(50,000,000원), 월 차임 금 삼백이십만원정(3,200,000원, 매월 25일 지급)으로 한다.',
    keywords: ['계약서', '임대차', '보증금', '월세', '특약'],
  },
  {
    id: 'demo_sample_doc_2',
    fileName: '2026_하반기_거래처_납품견적서_샘플.xlsx',
    title: '[체험 샘플 2/2] 2026 하반기 거래처별 자재 납품견적서',
    ext: 'XLSX',
    categoryBadge: '견적·단가 샘플',
    date: '2025-09-03',
    sizeKB: 185,
    deviceSource: '체험판 샘플 문서',
    extractedText:
      '품목: 고효율 LED 모듈 A형 | 공급단가: 145,000원(VAT 별도) | 최소 발주수량: 50EA | 담당: 한일건재 김대리',
    keywords: ['견적서', '문서', '납품', '한일건재', '엑셀'],
  },
];
