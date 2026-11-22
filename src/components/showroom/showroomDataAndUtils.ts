export const PATENTS_FILED = false;
export const OFFICIAL_LAUNCH_LIVE = false;

export interface GhostiShowroomLandingProps {
  onEnterWorkspace: (forceAllow?: boolean) => void;
  isDevAuthorized?: boolean;
}

export interface ShortsItem {
  id: string;
  category: 'video' | 'doc' | 'clean';
  searchKeyword?: '귀신비서' | '귀신검색';
  title: string;
  hookTime: string;
  hookLine: string;
  solutionLine: string;
  recommendedKeyword: string;
  tag: string;
  youtubeId?: string;
  videoUrl?: string;
  thumbnailBg: string;
  publishedAt?: string;
  isNew?: boolean;
}

export const DEFAULT_SHORTS_DATA: ShortsItem[] = [
  {
    id: 'video-552',
    category: 'video',
    searchKeyword: '귀신검색',
    title: '수백 개의 동영상 중 원하는 장면을 탐색바 이동 없이 바로 찾기',
    hookTime: '00:00 ~ 00:03',
    hookLine: '영상을 하나씩 재생해 원하는 장면을 찾으려면 많은 시간이 걸립니다.',
    solutionLine: '『귀신검색』에 장면 내용을 입력하면 해당 구간(03분 15초)으로 바로 이동하고 화면 속 글자도 함께 확인합니다.',
    recommendedKeyword: '귀신같이 귀신검색',
    tag: '귀신검색 · 동영상 장면 탐색',
    youtubeId: '_nZRnipuiuw',
    videoUrl: '/showroom/shorts/ghosti_short_sc552_1793284451.mp4',
    thumbnailBg: 'from-slate-900 via-slate-800 to-slate-900',
    isNew: true,
  },
  {
    id: 'doc-555',
    category: 'doc',
    searchKeyword: '귀신검색',
    title: '파일 이름을 기억하지 못해도 엑셀·PDF 본문 내용으로 찾기',
    hookTime: '00:00 ~ 00:03',
    hookLine: '문서 제목만으로는 파일 안의 표나 조항을 찾기 위해 문서를 일일이 열어봐야 합니다.',
    solutionLine: '엑셀·한글·PDF 문서를 열지 않고 본문 속 단어와 수치로 필요한 문서를 찾습니다.',
    recommendedKeyword: '귀신같이 귀신검색',
    tag: '귀신검색 · 문서 본문 검색',
    youtubeId: 'zeOS7G54Leo',
    videoUrl: '/showroom/shorts/ghosti_short_sc555_1793284492.mp4',
    thumbnailBg: 'from-slate-900 via-slate-800 to-slate-900',
    isNew: true,
  },
  {
    id: 'clean-558',
    category: 'clean',
    searchKeyword: '귀신비서',
    title: '중복·연사 사진과 흔들린 사진을 선별해 깔끔하게 정리하기',
    hookTime: '00:00 ~ 00:03',
    hookLine: '비슷한 연사 사진 수십 장 중 선명한 한 장만 직접 골라내기는 번거롭습니다.',
    solutionLine: '『귀신비서』가 선명한 원본 1장을 추천하고 나머지 중복·흐린 사진은 휴지통으로 안전하게 이동합니다.',
    recommendedKeyword: '귀신같이 귀신비서',
    tag: '귀신비서 · 중복 사진 정리',
    youtubeId: 'ajAdvM6eDrk',
    videoUrl: '/showroom/shorts/ghosti_short_sc558_261106.mp4',
    thumbnailBg: 'from-slate-900 via-slate-800 to-slate-900',
    isNew: true,
  },
  {
    id: 'clean-674',
    category: 'clean',
    searchKeyword: '귀신비서',
    title: '미사용 보안프로그램 절전 전환과 임시 캐시 정리로 PC 속도 관리',
    hookTime: '00:00 ~ 00:03',
    hookLine: '백그라운드에서 상시 실행되는 보안 모듈과 누적된 임시 파일이 시스템을 무겁게 만듭니다.',
    solutionLine: '은행 보안프로그램을 삭제하지 않고 절전 상태로 두었다가 필요할 때만 깨우며, 불필요한 캐시는 안전하게 정리합니다.',
    recommendedKeyword: '귀신같이 귀신비서',
    tag: '귀신비서 · PC 상태 점검',
    videoUrl: '/showroom/shorts/ghosti_백신돌려도PC폰이느_261110.mp4',
    thumbnailBg: 'from-slate-900 via-slate-800 to-slate-900',
    isNew: true,
  },
];

export const INTERACTIVE_SCENARIOS = {
  video: [
    {
      query: '아기 첫 걸음마',
      file: 'VID_20250914_가족산책.mp4 (14분 20초)',
      timestamp: '03분 12초',
      progressPct: 24,
      thumbUrl: '/sample_photos_301/IMG_20250515_1053.jpg',
      transcript: '“우리 아기 두 발로 걷는다!”',
      sceneDesc: '잔디밭에서 걸음마를 떼는 장면 구간',
      latency: '즉시 이동',
      screenOcrLines: [
        '[00:14] 2025.09.14 송도 센트럴파크 산책',
        '[03:12] 첫 걸음마 기록 (D+342)',
      ],
    },
    {
      query: '여행 맛집 고기상',
      file: 'VID_20250502_가족여행.mp4 (08분 45초)',
      timestamp: '05분 41초',
      progressPct: 65,
      thumbUrl: '/sample_photos_301/TRV_20250720_1139.jpg',
      transcript: '“여기 상차림이 정말 깔끔하네.”',
      sceneDesc: '식당 테이블 메인 요리 구간 및 메뉴판 텍스트 인식',
      latency: '즉시 이동',
      screenOcrLines: [
        '[01:05] 제주 흑돼지 본가 · 예약문의 064-712-8890',
        '[05:41] 메뉴판: 흑돼지 오겹 한상 68,000원 / 김치찌개 8,000원',
      ],
    },
    {
      query: '노을 바다 가족사진',
      file: 'MOV_20250720_여름휴가.mov (06분 10초)',
      timestamp: '02분 19초',
      progressPct: 38,
      thumbUrl: '/sample_photos_301/TRV_20250720_1136.jpg',
      transcript: '“해 질 녘 바다 색감이 참 좋다.”',
      sceneDesc: '석양과 해변 풍경 구간',
      latency: '즉시 이동',
      screenOcrLines: [
        '[00:22] 해안가 낙조 전망대 안내판 (일몰 19:42)',
        '[02:19] 2025 여름 가족 휴가 · 서해안 해변',
      ],
    },
  ],
  doc: [
    {
      query: '지체상금 0.15%',
      docType: 'PDF 계약서',
      badgeColor: '#334155',
      file: 'D:\\업무문서\\2026_물품공급_표준계약서_최종수정3.pdf (24p)',
      location: '제14조 (지체상금) · 9페이지 12행',
      highlightKey: '0.15%',
      previewSnippet: '“을이 납품기한 내에 물품을 납품하지 못할 때에는 매 1일당 계약금액의 [0.15%] 지체상금을...”',
      latency: '본문 미리보기',
      thumbUrl: '',
    },
    {
      query: '부가세 환급 428만',
      docType: 'XLSX 정산표',
      badgeColor: '#334155',
      file: 'D:\\세무자료\\2026_상반기_매입매출_정산_진짜최종.xlsx (시트 4개)',
      location: '[2분기_세금계산서] 시트 · E28 셀',
      highlightKey: '4,280,000원',
      previewSnippet: '“공급가액 합계: 42,800,000원 | 부가세 환급 예정액: [4,280,000원] (대조 완료)”',
      latency: '표 수치 확인',
      thumbUrl: '',
    },
    {
      query: '영수증 사업자번호',
      docType: 'IMG 스캔본',
      badgeColor: '#334155',
      file: 'D:\\영수증보관함\\IMG_20250815_1008.jpg (실물 영수증 촬영본)',
      location: '사진 속 글자 인식 · 상단 2행 & 결제금액',
      highlightKey: '123-86-49201',
      previewSnippet: '“청라 한우·삼겹살 명가 | 사업자: [123-86-49201] | 합계 결제금액: 128,000원”',
      latency: '사진 글자 인식',
      thumbUrl: '/sample_photos_301/IMG_20250815_1008.jpg',
    },
  ],
};

export const QUICK_EMAIL_DOMAINS = ['@naver.com', '@gmail.com', '@daum.net', '@kakao.com'];

export interface SamplePcProgram {
  id: string;
  name: string;
  memMb: number;
  neededForBank: boolean;
}

export const SAMPLE_PC_PROGRAMS: SamplePcProgram[] = [
  { id: 'kb1', name: '○○은행 키보드 보안', memMb: 210, neededForBank: true },
  { id: 'cert', name: '공동인증서 실행 플러그인', memMb: 240, neededForBank: true },
  { id: 'kb2', name: '△△은행 키보드 보안', memMb: 180, neededForBank: false },
  { id: 'pay', name: '쇼핑몰 결제 보안 모듈', memMb: 150, neededForBank: false },
  { id: 'fw', name: '개인 방화벽 에이전트', memMb: 190, neededForBank: false },
  { id: 'term', name: '접속 단말 정보 수집기', memMb: 130, neededForBank: false },
  { id: 'sign', name: '전자서명 실행기', memMb: 160, neededForBank: false },
  { id: 'upd', name: '금융 보안 업데이트 도우미', memMb: 120, neededForBank: false },
];
export const SAMPLE_PC_BASE_PCT = 61;
export const SAMPLE_PC_REVIVED_PCT = 93;

export type OnboardingWeaponTab = 'video' | 'doc' | 'clean' | 'share';

export interface SafeOnboardingChatMsg {
  id: string;
  role: 'secretary' | 'user';
  text: string;
  timestamp: string;
}

export const WEAPON_META: Record<
  OnboardingWeaponTab,
  {
    icon: string;
    chipLabel: string;
    chipSub: string;
    keywordBadge: string;
    userBubble: string;
    secretaryReply: string;
    stageTitle: string;
    stageBadge: string;
    shortVideoUrl: string;
  }
> = {
  video: {
    icon: '',
    chipLabel: '동영상 장면 · 화면 글자 찾기',
    chipSub: '재생하지 않고 원하는 구간으로 이동',
    keywordBadge: '귀신검색',
    userBubble: '동영상 수백 개 중에 아기 첫 걸음마 장면이랑 화면 글자 찾아줘',
    secretaryReply:
      '영상을 일일이 돌려보실 필요 없어요.\n기기 안에서 색인한 뒤 검색어만 입력하면 해당 장면(03분 12초)과 화면 속 글자를 바로 보여드립니다.',
    stageTitle: '파일 이름을 몰라도 내용으로 찾는 동영상 검색',
    stageBadge: '귀신검색 · 기본 무료',
    shortVideoUrl: '/showroom/shorts/ghosti_short_sc552_1793284451.mp4',
  },
  doc: {
    icon: '',
    chipLabel: '계약서 표 · 영수증 글자 찾기',
    chipSub: '문서를 열지 않고 본문 내용 확인',
    keywordBadge: '귀신검색',
    userBubble: '엑셀 정산표랑 영수증 사진 열지 않고 내용 바로 찾아줘',
    secretaryReply:
      '파일을 하나씩 열어보실 필요 없어요.\n계약서 조항과 정산표 수치, 촬영한 영수증 속 글자까지 본문 기준으로 바로 찾아드립니다.',
    stageTitle: '문서를 열지 않고 확인하는 본문 · 표 · 영수증 검색',
    stageBadge: '귀신검색 · 기본 무료',
    shortVideoUrl: '/showroom/shorts/ghosti_short_sc555_1793284492.mp4',
  },
  clean: {
    icon: '',
    chipLabel: 'PC 상태 점검 · 중복 사진 정리',
    chipSub: '미사용 보안모듈 절전 · 휴지통 복원',
    keywordBadge: '귀신비서',
    userBubble: '느려진 컴퓨터 정리하고 중복 사진도 추려줘. 실수로 지워지진 않지?',
    secretaryReply:
      '파일이나 프로그램을 임의로 영구 삭제하지 않아요.\n오른쪽 샘플 화면에서 보안프로그램을 절전 모드로 전환해 보고 언제든 원래 상태로 되돌려 보세요.',
    stageTitle: '안전하게 점검하고 언제든 복원하는 기기 관리',
    stageBadge: '귀신비서 · 샘플 체험',
    shortVideoUrl: '/showroom/shorts/ghosti_short_sc558_261106.mp4',
  },
  share: {
    icon: '',
    chipLabel: '가족 · 모임 원본 사진 공유',
    chipSub: '만료 기간 없는 공유 앨범',
    keywordBadge: '사진 공유',
    userBubble: '단톡방에 올린 여행 사진이 만료돼서 안 보여. 원본 화질로 모을 수 있어?',
    secretaryReply:
      '유효기간 만료나 화질 압축 없이 원본 그대로 공유방에 모아둘 수 있어요.\n오른쪽에서 샘플 가족방 화면을 둘러보세요.',
    stageTitle: '가족 · 동호회 · 동창회 사진 공유방',
    stageBadge: '사진 공유 · 기본 무료',
    shortVideoUrl: '',
  },
};

export function nowTimeStr(): string {
  return new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}
