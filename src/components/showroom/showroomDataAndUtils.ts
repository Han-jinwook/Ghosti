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
    chipSub: '재생 없이 원하는 구간 바로 이동',
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

export interface ShowroomBeforeAfterMenuCase {
  id: string;
  menuTag: string;
  title: string;
  targetSituation: string;
  beforeItems: string[];
  afterItems: string[];
  hookLine: string;
  hideInStoreMode?: boolean;
}

export interface ShowroomBeforeAfterJobCase {
  rank: string;
  persona: string;
  combo: string;
  before: string;
  after: string;
  hookLine: string;
}

export const SHOWROOM_BEFORE_AFTER_MENU_CASES: ShowroomBeforeAfterMenuCase[] = [
  {
    id: 'work-share-s',
    menuTag: '5. 업무 공유 (S:)',
    title: "소기업 사장님의 '구글 드라이브 고정비 절감' & 퇴사자 1초 차단",
    targetSituation: '직원 3~10명 규모 소기업·스마트스토어·세무/디자인 사무실에서 클라우드 드라이브로 폴더를 공유할 때',
    beforeItems: [
      '파일 이름을 모르면 4단계 폴더를 뒤져도 못 찾고, 한글(HWP)·PDF·스캔 사진 속 글자는 검색이 안 됨',
      '퇴사한 직원 PC에 동기화 파일이 그대로 남거나 공유 해지를 깜빡해 자료 유출이 불안함',
      '신입 직원 올 때마다 계정 발급·동기화 앱 설치·로그인을 일일이 세팅해 줘야 함',
    ],
    afterItems: [
      '파일 안 본문·표·HWP·스캔 글자 1초 소환: "부평구 견적서", "345,000원"만 치면 파일을 열지 않고도 우측 미리보기로 즉시 확인',
      '대표 PC 1대에만 G:가 연결돼 있으면 직원 PC엔 별도 설치 없이 초대 링크 1번으로 탐색기 S: 드라이브가 즉시 생성됨',
      '퇴사자 1초 강퇴·격리로 S: 드라이브가 즉시 닫히며, 쓰던 클라우드 폴더를 그대로 S:에 꽂아 쓰다가 언제든 내 PC 폴더(D:\\회사공유폴더)로 1클릭 전환 가능',
    ],
    hookLine: '“쓰던 구글 드라이브 폴더 그대로 S:에 꽂아 1초 본문 검색부터 써보고, 버튼 1번으로 내 PC 공용 폴더로 전환하세요!”',
    hideInStoreMode: true,
  },
  {
    id: 'device-pro',
    menuTag: '4. 내 기기 통합',
    title: "카톡 '나에게 보내기' 7단계 ➔ 무화면 2탭 직송 & 외출 중 회사 PC 파일 1초 소환",
    targetSituation: '폰에서 본 계좌번호·영수증·사진을 PC로 옮기거나, 외출 중에 회사 PC에 있는 견적서·구글시트 내용을 급하게 확인할 때',
    beforeItems: [
      '폰 사진/글자를 PC로 보내려면 [공유 ➔ 카톡 ➔ 내 프로필 ➔ 전송 ➔ PC 카톡 열기 ➔ 다운로드/복사] 최소 6~7단계 반복',
      "PC에서 폰으로 주소·문구를 보낼 때도 카톡 '나에게 보내기' 창이 온갖 메모와 사진으로 도배됨",
      '외출 중 거래처에서 "아까 그 견적서 금액 얼마였죠?" 전화가 오면 사무실에 들어갈 때까지 확인 불가',
    ],
    afterItems: [
      '폰 ➔ PC 무화면 1~2탭 직송: 안드로이드 글자 드래그 ➔ [PC로 보내기] 1탭, 아이폰·사진 [공유 ➔ 귀신같이] 2탭이면 앱 화면도 안 열리고 0.3초 만에 PC Ctrl+V에 즉시 장착',
      'PC ➔ 폰 알림바 1탭 복사: PC에서 [폰으로 보내기] 1클릭 ➔ 폰 상단 알림의 [복사] 1탭으로 앱을 열지 않고 바로 붙여넣기',
      '외출 중에도 스마트폰에서 "견적서" 검색 한 번이면 사무실 PC 하드와 연결된 클라우드 드라이브 파일까지 1초 원격 확인',
    ],
    hookLine: "“아직도 카톡 '나에게 보내기'로 사진·글자 옮기세요? 공유 2번만 누르면 앱도 안 열리고 PC Ctrl+V에 바로 꽂힙니다!”",
  },
  {
    id: 'ghost-search',
    menuTag: '2. 귀신검색',
    title: '“파일 이름 몰라도 OK” — 수만 장 사진·HWP·PDF·구글시트 속 단어 1초 소환',
    targetSituation: '몇 달 전 찍어둔 주차 위치, 영수증, 계약서 조항, 구글시트 속 거래처 번호를 급하게 찾아야 할 때',
    beforeItems: [
      '스마트폰 갤러리 스크롤을 5분 넘게 올리다가 결국 못 찾고 포기함',
      'PC 탐색기 검색은 파일 이름만 찾고 느려서 한글(HWP)·PDF·구글 드라이브(G:)·마이박스 속 문서 본문은 파일 20개를 일일이 열어봐야 함',
    ],
    afterItems: [
      '"주차장 B2", "보증금 반환", "박민정"처럼 기억나는 단어 하나만 치면 내 PC 하드 + 구글 드라이브(G:) + 마이박스 + 수만 장 사진 속 글자까지 외부 서버 업로드 0%로 1초 만에 소환',
      '문서 요약이나 긴 글은 신경망 성우(현수·선희)가 읽어주고, 심층 분석은 버튼 1번으로 평소 쓰는 AI(제미나이 등)에 본문을 채워 바로 질문',
    ],
    hookLine: '“파일 이름 기억 안 나도 됩니다. 계약서 안의 단어 하나, 영수증 숫자 하나만 치면 내 기기 안에서 1초 만에 찾아냅니다!”',
  },
  {
    id: 'ghost-secretary',
    menuTag: '1. 귀신비서',
    title: '은행 보안프로그램 지우지 않고 재우기 & 10년 치 중복 사진 1분 정리',
    targetSituation: '은행·관공서 사이트 접속 후 PC가 무거워지고, 스마트폰 용량이 흔들린 사진·연사·스크린샷으로 가득 찼을 때',
    beforeItems: [
      '은행 보안프로그램을 지워버리면 다음 달 은행 사이트에 들어갈 때 또 10분 동안 다시 설치해야 함',
      '무료 압축·백신 프로그램을 깔면 화면 구석에 광고 팝업이 수시로 뜸',
      '사진첩 중복 사진 수천 장을 지우려니 손가락이 아프고, 실수로 중요한 사진을 영구 삭제할까 봐 걱정됨',
    ],
    afterItems: [
      '무삭제 보안모듈 수면: 보안프로그램을 지우지 않고 평소엔 잠재워 PC 속도를 살려두고, 은행 사이트를 켤 때만 필요한 모듈을 알아서 깨움',
      '광고 없는 1초 압축 & 복원 기록: 모든 정리 작업은 OS 휴지통과 [복원 기록]에 남아 1초 만에 원래 위치로 복구 가능',
      '갤러리 4대 AI 정리: 중복·연사 베스트컷, 영수증, 스크린샷, 흔들린 사진을 AI가 선별해 용량을 빠르게 확보 (기본 무료)',
    ],
    hookLine: '“은행 보안프로그램 지우지 마세요! 지우면 또 깔아야 하잖아요. 귀신비서가 평소엔 재워두고 은행 갈 때만 깨워드립니다!”',
  },
  {
    id: 'photo-share',
    menuTag: '3. 사진 공유',
    title: '가족·동창회·여행 사진방 — 만료 기간 없음 · 원본 화질 · 인원/장수 무제한',
    targetSituation: '가족 여행, 아이 성장 사진, 동창회·등산 모임 사진을 단톡방에 올렸더니 화질이 깨지고 2주 뒤 만료되어 사라질 때',
    beforeItems: [
      '메신저로 보낸 사진은 압축되어 화질이 저하되고, 일정 기간이 지나면 "만료된 파일입니다"가 떠서 다운로드 불가',
      '클라우드 공유 앨범은 용량이 차면 매달 추가 요금이 들고 어르신들이 로그인·업로드하기 복잡함',
    ],
    afterItems: [
      '만료 없는 원본 화질 공유방: 내 PC에 원본을 보관하고 가족·모임원 폰에는 13KB 초경량 썸네일로 0.1초 만에 열람(원할 때 원본 화질 1탭 저장)',
      '얼굴 여권 자동 분류: 내 얼굴과 가족 얼굴을 한 번만 등록해 두면 수천 장 모임 사진 속에서 우리 가족이 나온 사진만 1초 만에 모아봄',
    ],
    hookLine: '“단톡방 사진 2주 지나면 다 날아가죠? 가족·동창회 원본 사진방, 인원·장수 제한 없이 만료 걱정 없이 쓰세요!”',
  },
];

export const SHOWROOM_BEFORE_AFTER_JOB_CASES: ShowroomBeforeAfterJobCase[] = [
  {
    rank: '🥇 1',
    persona: '자영업 · 쇼핑몰 셀러 · 경리',
    combo: '2. 귀신검색 + 4. 내 기기 통합',
    before:
      '세무사·거래처에서 "작년 8월 OOO 거래명세표/사업자등록증 보내주세요" 전화 오면 폴더 10개 뒤지고 폰 사진첩 5분 스크롤 ➔ 카톡 나에게 보내기로 PC 옮겨 재전송 (5~10분 소요)',
    after:
      '"OOO", "사업자등록증" 1초 검색 ➔ 파일을 열지 않고도 우측 미리보기로 바로 확인 ➔ 메신저 거래처 방에 즉시 첨부·전송 끝!',
    hookLine: '“거래처 전화 왔을 때 아직도 폴더 10개 뒤지세요? 단어 하나 치면 1초 만에 찾아 바로 보내드립니다!”',
  },
  {
    rank: '🥈 2',
    persona: '육아맘 · 가족',
    combo: '3. 사진 공유 + 1. 귀신비서 + 귀신여권',
    before:
      '아이 사진 2만 장으로 스마트폰 용량이 꽉 차고, 양가 부모님 단톡방에 올린 손주 사진은 2주만 지나면 "만료된 파일"로 열리지 않음',
    after:
      '1분 AI 정리로 중복·흔들린 사진을 비우고 집 PC에 원본 보관 + 양가 부모님 폰에 만료 없는 가족 사진방 연결(아이 얼굴만 1초 만에 모아보기)',
    hookLine: '“양가 부모님 단톡방 만료 없는 가족 사진방, 아이 얼굴 나온 사진만 1초 만에 쏙 골라 모아봅니다!”',
  },
  {
    rank: '🥉 3',
    persona: '직장인 · 프리랜서',
    combo: '1. 귀신비서 + 2. 귀신검색',
    before:
      '연말정산·홈택스·은행 다녀오면 보안모듈 8종 때문에 PC가 무거워지고, 지우면 다음 달 또 재설치 + 한글/PDF 제안서 50개를 일일이 더블클릭해 내용 확인',
    after:
      '보안모듈을 지우지 않고 평소엔 절전 수면(은행 켤 때만 자동 기상) + 한글/PDF 본문 1초 검색 + 신경망 성우(현수·선희) 문서 낭독',
    hookLine: '“은행 보안프로그램 지우지 마세요! 평소엔 재워두고 은행 갈 때만 깨워드립니다!”',
  },
  {
    rank: '4',
    persona: '외근직 · 영업 · 부동산 중개사',
    combo: '4. 내 기기 통합',
    before:
      '현장에서 계약서·신분증·매물 사진 찍어 사무실 PC로 옮기려면 카톡 나에게 보내기 7단계 + 화질 저하 + 파일 이름이 뒤죽박죽 섞임',
    after:
      '갤러리에서 [공유 ➔ 귀신같이] 2탭이면 앱 화면이 열리지도 않고 사무실 PC Ctrl+V에 원본 화질 그대로 도착',
    hookLine: "“현장 사진 아직도 카톡 '나에게 보내기'로 옮기세요? 공유 2번이면 앱 안 열리고 사무실 PC Ctrl+V에 바로 꽂힙니다!”",
  },
  {
    rank: '5',
    persona: '동창회 · 산악회 · 동호회 총무',
    combo: '3. 사진 공유 + 귀신여권',
    before:
      '여행·등산 다녀오면 단톡방에 사진 300장 알림이 쏟아져 폰 용량이 차고, 정작 내 얼굴이 나온 사진만 골라 찾느라 눈이 피로함',
    after:
      '모임 사진방 링크 1개 공유 ➔ 귀신여권으로 내 얼굴 나온 사진만 1초 만에 골라 원본 저장 (폰 용량 부담 없는 13KB 초경량 썸네일)',
    hookLine: '“등산·동창회 사진 300장 단톡방 폭탄 끝! 내 얼굴 나온 사진만 1초 만에 골라 원본으로 저장하세요!”',
  },
];
