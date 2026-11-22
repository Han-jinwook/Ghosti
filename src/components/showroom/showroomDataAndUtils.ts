// 특허 출원번호(10-2026-XXXXXXX) 확보 전까지 허위표시 리스크 및 출원 전 공지(신규성 상실) 방지를 위해 false 유지
export const PATENTS_FILED = false;

// 정식 출시 스위치: 출시 전(false)에는 일반 방문자에게 본진 개발 화면을 100% 잠그고 사전 가입(이메일 인증) 모드로 동작하며,
// 정식 출시일(true 전환 시)에는 커다란 [🚀 귀신같이 본 앱 바로 시작하기] 버튼이 활성화된 영구 하이브리드 온보딩 대문으로 작동합니다.
export const OFFICIAL_LAUNCH_LIVE = false;

export interface GhostiShowroomLandingProps {
  onEnterWorkspace: (forceAllow?: boolean) => void;
  isDevAuthorized?: boolean;
}

export interface ShortsItem {
  id: string;
  category: 'video' | 'doc' | 'clean' | 'typo';
  searchKeyword?: '귀신비서' | '귀신검색' | '귀신창';
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

// ============================================================================
// 0.2ms Real-Time QWERTY (영타) -> Hangul (한글 두벌식) Buttonless Auto Engine
// ============================================================================
const CHO = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const JUNG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
const JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

const KEY_TO_JAMO: Record<string, string> = {
  q: 'ㅂ', Q: 'ㅃ', w: 'ㅈ', W: 'ㅉ', e: 'ㄷ', E: 'ㄸ', r: 'ㄱ', R: 'ㄲ', t: 'ㅅ', T: 'ㅆ',
  y: 'ㅛ', u: 'ㅕ', i: 'ㅑ', o: 'ㅐ', O: 'ㅒ', p: 'ㅔ', P: 'ㅖ',
  a: 'ㅁ', s: 'ㄴ', d: 'ㅇ', f: 'ㄹ', g: 'ㅎ', h: 'ㅗ', j: 'ㅓ', k: 'ㅏ', l: 'ㅣ',
  z: 'ㅋ', x: 'ㅌ', c: 'ㅊ', v: 'ㅍ', b: 'ㅠ', n: 'ㅜ', m: 'ㅡ',
  Y: 'ㅛ', U: 'ㅕ', I: 'ㅑ', A: 'ㅁ', S: 'ㄴ', D: 'ㅇ', F: 'ㄹ', G: 'ㅎ', H: 'ㅗ', J: 'ㅓ', K: 'ㅏ', L: 'ㅣ',
  Z: 'ㅋ', X: 'ㅌ', C: 'ㅊ', V: 'ㅍ', B: 'ㅠ', N: 'ㅜ', M: 'ㅡ',
};

const COMBO_JUNG: Record<string, string> = {
  'ㅗㅏ': 'ㅘ', 'ㅗㅐ': 'ㅙ', 'ㅗㅣ': 'ㅚ',
  'ㅜㅓ': 'ㅝ', 'ㅜㅔ': 'ㅞ', 'ㅜㅣ': 'ㅟ',
  'ㅡㅣ': 'ㅢ',
};

const COMBO_JONG: Record<string, string> = {
  'ㄱㅅ': 'ㄳ', 'ㄴㅈ': 'ㄵ', 'ㄴㅎ': 'ㄶ',
  'ㄹㄱ': 'ㄺ', 'ㄹㅁ': 'ㄻ', 'ㄹㅂ': 'ㄼ', 'ㄹㅅ': 'ㄽ', 'ㄹㅌ': 'ㄾ', 'ㄹㅍ': 'ㄿ', 'ㄹㅎ': 'ㅀ',
  'ㅂㅅ': 'ㅄ',
};

const SPLIT_JONG: Record<string, [string, string]> = {
  'ㄳ': ['ㄱ', 'ㅅ'], 'ㄵ': ['ㄴ', 'ㅈ'], 'ㄶ': ['ㄴ', 'ㅎ'],
  'ㄺ': ['ㄹ', 'ㄱ'], 'ㄻ': ['ㄹ', 'ㅁ'], 'ㄼ': ['ㄹ', 'ㅂ'], 'ㄽ': ['ㄹ', 'ㅅ'], 'ㄾ': ['ㄹ', 'ㅌ'], 'ㄿ': ['ㄹ', 'ㅍ'], 'ㅀ': ['ㄹ', 'ㅎ'],
  'ㅄ': ['ㅂ', 'ㅅ'],
};

function assembleJamos(jamos: string[]): string {
  let result = '';
  let cho = -1;
  let jung = -1;
  let jong = 0;

  const flush = () => {
    if (cho !== -1 && jung !== -1) {
      result += String.fromCharCode(0xac00 + (cho * 21 + jung) * 28 + jong);
    } else if (cho !== -1) {
      result += CHO[cho];
    } else if (jung !== -1) {
      result += JUNG[jung];
    }
    cho = -1;
    jung = -1;
    jong = 0;
  };

  for (const j of jamos) {
    const isVowel = JUNG.includes(j);
    if (!isVowel) {
      if (cho === -1) {
        cho = CHO.indexOf(j);
      } else if (jung === -1) {
        flush();
        cho = CHO.indexOf(j);
      } else if (jong === 0) {
        const jIdx = JONG.indexOf(j);
        if (jIdx !== -1) {
          jong = jIdx;
        } else {
          flush();
          cho = CHO.indexOf(j);
        }
      } else {
        const prevJong = JONG[jong];
        const combined = COMBO_JONG[prevJong + j];
        if (combined && JONG.indexOf(combined) !== -1) {
          jong = JONG.indexOf(combined);
        } else {
          flush();
          cho = CHO.indexOf(j);
        }
      }
    } else {
      if (cho === -1) {
        if (jung === -1) {
          jung = JUNG.indexOf(j);
        } else {
          const prevJung = JUNG[jung];
          const combined = COMBO_JUNG[prevJung + j];
          if (combined) {
            jung = JUNG.indexOf(combined);
          } else {
            flush();
            jung = JUNG.indexOf(j);
          }
        }
      } else if (jung === -1) {
        jung = JUNG.indexOf(j);
      } else if (jong === 0) {
        const prevJung = JUNG[jung];
        const combined = COMBO_JUNG[prevJung + j];
        if (combined) {
          jung = JUNG.indexOf(combined);
        } else {
          flush();
          jung = JUNG.indexOf(j);
        }
      } else {
        const prevJong = JONG[jong];
        const split = SPLIT_JONG[prevJong];
        if (split) {
          jong = JONG.indexOf(split[0]);
          const nextCho = split[1];
          flush();
          cho = CHO.indexOf(nextCho);
          jung = JUNG.indexOf(j);
        } else {
          jong = 0;
          flush();
          cho = CHO.indexOf(prevJong);
          jung = JUNG.indexOf(j);
        }
      }
    }
  }
  flush();
  return result;
}

export function convertEngTypoToKor(input: string): string {
  const KEEP_ENG = new Set(['PC', 'AI', 'PDF', 'USB', 'OK', 'SNS', 'VIP', 'B2B', 'IT', 'OS', 'RAM', 'SSD', 'CCTV']);
  return input.replace(/[A-Za-z]+/g, (word) => {
    if (KEEP_ENG.has(word.toUpperCase())) return word;
    const jamos: string[] = [];
    for (const ch of word) {
      const mapped = KEY_TO_JAMO[ch];
      if (mapped) jamos.push(mapped);
    }
    return assembleJamos(jamos);
  });
}

export const DEFAULT_SHORTS_DATA: ShortsItem[] = [
  {
    id: 'video-552',
    category: 'video',
    searchKeyword: '귀신검색',
    title: '동영상 천 개 중에 아기 첫 걸음마 장면, 일일이 돌려보느라 밤새우셨죠?',
    hookTime: '00:00 ~ 00:03 (훅)',
    hookLine: '“영상이 수백 개인데 일일이 재생해서 탐색바를 넘기다 보면 몇 시간이 훌쩍 날아갑니다.”',
    solutionLine: '『귀신검색』에 "아기 걸음마"만 치면 안 틀어보고도 03분 15초로 1초 만에 점프하고 화면 속 글자까지 뽑아냅니다!',
    recommendedKeyword: '귀신같이 귀신검색',
    tag: '🎬 #귀신검색 · 영상 글자·장면 1초 소환',
    youtubeId: '_nZRnipuiuw',
    videoUrl: '/showroom/shorts/ghosti_short_sc552_1793284451.mp4',
    thumbnailBg: 'from-cyan-950 via-teal-900 to-slate-900',
    isNew: true,
  },
  {
    id: 'doc-555',
    category: 'doc',
    searchKeyword: '귀신검색',
    title: '최종_진짜최종 엑셀 파일 수십 개, 내용 찾으려고 하나씩 다 열어보느라 야근하셨죠?',
    hookTime: '00:00 ~ 00:03 (훅)',
    hookLine: '“기존 검색은 파일 제목만 찾아줘서 문서 안의 표나 단어를 찾으려면 파일을 전부 열어봐야 했습니다.”',
    solutionLine: '엑셀·한글·PDF를 열지 않고도 본문 속 글자와 숫자를 1초 만에 한눈에 찾아냅니다.',
    recommendedKeyword: '귀신같이 귀신검색',
    tag: '📊 #귀신검색 · 엑셀·문서 1초 소환',
    youtubeId: 'zeOS7G54Leo',
    videoUrl: '/showroom/shorts/ghosti_short_sc555_1793284492.mp4',
    thumbnailBg: 'from-blue-950 via-indigo-950 to-slate-900',
    isNew: true,
  },
  {
    id: 'clean-558',
    category: 'clean',
    searchKeyword: '귀신비서',
    title: '사진 찍을 때마다 저장공간 부족 경고? 눈 뜬 사진 1장만 1초 Pick!',
    hookTime: '00:00 ~ 00:03 (훅)',
    hookLine: '“비슷한 사진 수십 장 중에 흔들리고 눈 감은 사진을 사람 눈으로 일일이 골라 지우기는 불가능합니다.”',
    solutionLine: '『귀신비서』가 흔들린 사진과 중복 파일을 1초 만에 골라내어 안전 휴지통으로 깔끔히 비워줍니다.',
    recommendedKeyword: '귀신같이 귀신비서',
    tag: '🧹 #귀신비서 · 중복 연사 사진 1초 선별',
    youtubeId: 'ajAdvM6eDrk',
    videoUrl: '/showroom/shorts/ghosti_short_sc558_261106.mp4',
    thumbnailBg: 'from-amber-950 via-teal-950 to-slate-900',
    isNew: true,
  },
  {
    id: 'clean-674',
    category: 'clean',
    searchKeyword: '귀신비서',
    title: '청소해도 PC·폰이 느리다면? 은행 보안프로그램 안 지우고 재우기 & 숨은 캐시 5GB 1클릭 정리!',
    hookTime: '00:00 ~ 00:03 (훅)',
    hookLine: '“저장공간 98% 꽉 참 경고! 은행 들어갈 때 깔린 보안프로그램 20개와 숨은 캐시가 범인입니다.”',
    solutionLine: '클릭 한 번이면 안 쓰는 은행 보안프로그램은 안 지우고 재우고(은행 접속 시 자동 기상), 숨은 캐시 5.4GB를 안전 휴지통으로 정리합니다.',
    recommendedKeyword: '귀신같이 귀신비서',
    tag: '🛡️ #귀신비서 · 클릭 한 번에 새것처럼',
    videoUrl: '/showroom/shorts/ghosti_백신돌려도PC폰이느_261110.mp4',
    thumbnailBg: 'from-emerald-950 via-slate-900 to-teal-950',
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
      transcript: '“우와~ 우리 아기 두 발로 아장아장 걷는다! 여보 빨리 찍어!”',
      sceneDesc: '잔디밭에서 손을 잡고 아장아장 걸음마를 떼는 하이라이트 장면 포착',
      latency: '1초',
      screenOcrLines: [
        '[00:14] 2025.09.14 송도 센트럴파크 잔디광장 산책',
        '[03:12] 우리 아기 생애 첫 걸음마 성공! (D+342)',
      ],
    },
    {
      query: '여행 맛집 고기상',
      file: 'VID_20250502_가족여행.mp4 (08분 45초)',
      timestamp: '05분 41초',
      progressPct: 65,
      thumbUrl: '/sample_photos_301/TRV_20250720_1139.jpg',
      transcript: '“이 집 플레이팅이랑 육즙이 진짜 대박이네, 인생 맛집 인정!”',
      sceneDesc: '식당 테이블 위 메인 요리 클로즈업 구간 및 메뉴판 글자 자동 인식',
      latency: '1초',
      screenOcrLines: [
        '[01:05] 제주 흑돼지 본가 간판 · 예약문의 064-712-8890',
        '[05:41] 메뉴판: 흑돼지 오겹 한상 68,000원 / 김치찌개 8,000원',
      ],
    },
    {
      query: '노을 바다 가족사진',
      file: 'MOV_20250720_여름휴가.mov (06분 10초)',
      timestamp: '02분 19초',
      progressPct: 38,
      thumbUrl: '/sample_photos_301/TRV_20250720_1136.jpg',
      transcript: '“해 질 녘 파도 색깔 너무 예쁘다~ 다 같이 바다 보면서 하나 둘 셋!”',
      sceneDesc: '황금빛 석양과 에메랄드 파도가 만나는 해변 하이라이트 구간',
      latency: '1초',
      screenOcrLines: [
        '[00:22] 해안가 낙조 전망대 안내 표지판 (일몰 19:42)',
        '[02:19] 2025 SUMMER FAMILY VACATION · 서해안 해변',
      ],
    },
  ],
  doc: [
    {
      query: '지체상금 0.15%',
      docType: 'PDF 계약서',
      badgeColor: '#EF4444',
      file: 'D:\\업무문서\\2026_물품공급_표준계약서_최종수정3.pdf (24p)',
      location: '제14조 (지체상금) · 9페이지 12행',
      highlightKey: '0.15%',
      previewSnippet: '“을이 납품기한 내에 물품을 납품하지 못할 때에는 매 1일당 계약금액의 [0.15%] 지체상금을...”',
      latency: '1초 무열람 소환',
      thumbUrl: '',
    },
    {
      query: '부가세 환급 428만',
      docType: 'XLSX 정산표',
      badgeColor: '#10B981',
      file: 'D:\\세무자료\\2026_상반기_매입매출_정산_진짜최종.xlsx (시트 4개)',
      location: '[2분기_세금계산서] 시트 · E28 셀',
      highlightKey: '4,280,000원',
      previewSnippet: '“공급가액 합계: 42,800,000원 | 부가세 환급 예정액: [4,280,000원] (대조 완료)”',
      latency: '1초 표·숫자 소환',
      thumbUrl: '',
    },
    {
      query: '영수증 사업자번호',
      docType: 'IMG 스캔본',
      badgeColor: '#F59E0B',
      file: 'D:\\영수증보관함\\IMG_20250815_1008.jpg (실물 영수증 촬영본)',
      location: '사진 속 글자 인식 · 상단 2행 & 결제금액',
      highlightKey: '123-86-49201',
      previewSnippet: '“청라 한우·삼겹살 명가 | 사업자: [123-86-49201] | 합계 결제금액: 128,000원”',
      latency: '1초 사진 글자 소환',
      thumbUrl: '/sample_photos_301/IMG_20250815_1008.jpg',
    },
  ],
};

export const QUICK_EMAIL_DOMAINS = ['@naver.com', '@gmail.com', '@daum.net', '@kakao.com'];

// ============================================================================
// [샘플 체험 A] 👻 귀신비서 — 샘플 PC 살려보기 (실측 X · 리얼 샘플 O)
// ⚠️ 웹 온보딩에서는 방문자 PC를 실제로 진단하지 않습니다. 실제 진단은 본 앱 『👻 귀신비서』 방에서
//    『내 컴퓨터 연결』 후에만 진행합니다. 타사 상표 분쟁 방지를 위해 제품 실명 대신 일반 명칭만 사용합니다.
// ============================================================================
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

export type OnboardingWeaponTab = 'video' | 'doc' | 'clean' | 'share' | 'superpower';
export type FreeOrDevToolbarKey = 'auto' | 'seq' | '1' | 'snip' | 'zip' | 'dev_2' | 'dev_3' | 'dev_5';

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
    icon: '🎬',
    chipLabel: '파일 이름 몰라도, 열지 않고 1초 소환',
    chipSub: '동영상 속 찾던 장면·글자 1초 점프',
    keywordBadge: '#귀신검색',
    userBubble: '동영상 수백 개 중에 아기 첫 걸음마 장면이랑 화면 글자 바로 찾아줘!',
    secretaryReply:
      '일일이 돌려보실 필요 없어요~ 👻\n내 기기 안에서만 안전하게 색인해 키워드만 누르면 그 장면(03분 12초)으로 1초 만에 소환하고 화면 속 글자도 찾아드려요!',
    stageTitle: '🎬 파일 이름 몰라도, 열지 않고 1초 소환 (동영상 장면 · 글자)',
    stageBadge: '#귀신검색 (내 PC 평생 무료)',
    shortVideoUrl: '/showroom/shorts/ghosti_short_sc552_1793284451.mp4',
  },
  doc: {
    icon: '📊',
    chipLabel: '계약서·사진 글자 1초 소환',
    chipSub: '계약서 속 숫자·표 · 사진 속 글자',
    keywordBadge: '#귀신검색',
    userBubble: '최종_진짜최종 엑셀이랑 영수증 사진 안 열고 내용 바로 찾아줘!',
    secretaryReply:
      '파일 더블클릭하실 필요 없어요! 🔍\n계약서 속 숫자·표, 사진 속 글자, 동영상 속 찾던 장면까지 열지 않고 1초 만에 찾아줍니다~ 👻',
    stageTitle: '📊 파일 이름 몰라도, 열지 않고 1초 소환 (계약서 표 · 사진 글자)',
    stageBadge: '#귀신검색 (내 PC 평생 무료)',
    shortVideoUrl: '/showroom/shorts/ghosti_short_sc555_1793284492.mp4',
  },
  clean: {
    icon: '🧹',
    chipLabel: '느려진 내 PC·폰, 클릭 한 번에 새것처럼',
    chipSub: '샘플 PC로 보안앱 재우기 · 1초 원상복구',
    keywordBadge: '#귀신비서',
    userBubble: '느려진 컴퓨터 속도 살려주고 중복 사진도 정리해줘! 근데 막 지우는 거 아니지?',
    secretaryReply:
      '걱정 마세요, 마음대로 지우는 건 하나도 없어요! 🔒\n오른쪽 샘플 PC에서 은행 보안프로그램을 안 지우고 재워보고, 언제든 1초 만에 원래대로 돌려보세요~ ✨',
    stageTitle: '👻 느려진 내 PC·폰, 클릭 한 번에 새것처럼',
    stageBadge: '#귀신비서 (샘플 체험 · 평생 무료)',
    shortVideoUrl: '/showroom/shorts/ghosti_short_sc558_261106.mp4',
  },
  share: {
    icon: '📸',
    chipLabel: '가족·모임 원본 사진, 만료 없이 평생 0원',
    chipSub: '샘플 가족방 들어가 보기',
    keywordBadge: '#사진공유',
    userBubble: '카톡방에 올린 가족여행 사진이 만료돼서 안 보여… 원본 그대로 모을 수 없어?',
    secretaryReply:
      '카톡 30일 만료와 화질 저하 없이 원본 그대로 모을 수 있어요! 📸\n오른쪽에서 샘플 가족방 초대 링크를 눌러 가입 없이 바로 구경해 보세요~',
    stageTitle: '📸 가족·모임 원본 사진, 만료 없이 평생 0원',
    stageBadge: '#사진공유 (샘플 체험 · 인원·장수 무제한 0원)',
    shortVideoUrl: '',
  },
  superpower: {
    icon: '⚡',
    chipLabel: '하던 일 멈추지 마세요, 쓰던 자리에서 1초면 끝',
    chipSub: '영타 자동 변환 · 칸 맞춤 복붙',
    keywordBadge: '#귀신창',
    userBubble: 'dkssudgktpdy 영타 오타랑 PDF 깨진 줄바꿈, 창 안 바꾸고 그 자리에서 고쳐줘!',
    secretaryReply:
      '하던 일 멈추지 마세요! 창을 오가며 헤매지 않고 영타 자동 변환부터 칸 맞춤 복붙까지 Ctrl+0 하나로 일하던 커서 위에서 1초 만에 끝냅니다~ ⚡',
    stageTitle: '⚡ 하던 일 멈추지 마세요, 쓰던 자리에서 1초면 끝',
    stageBadge: '#귀신창 (Ctrl+0 / 보조 Ctrl+우클릭 · 기본기 평생 무료)',
    shortVideoUrl: '/showroom/shorts/ghosti_dkssudgktp_261110.mp4',
  },
};

export function nowTimeStr(): string {
  return new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}
