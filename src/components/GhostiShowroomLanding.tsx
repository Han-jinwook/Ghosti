import React, { useEffect, useRef, useState } from 'react';
import { useHub } from '../services/merlin-hub-sdk/react';
import { useHubAuth } from '../services/merlin-hub-sdk/Auth/useHubAuth';
import { syncHubUserToLocalSupabase } from '../services/supabaseClient';
import { useSaySeeStore } from '../store/useSaySeeStore';
import { Z_CORE_ZIP_URL, LATEST_Z_CORE_VERSION } from '../services/zCoreBridge';
import { playBabyGhostChime } from './OnboardingModal';
import { silencePendingEnterGiggleOnLogoClick } from '../services/babyGhostSound';
import { GhostSuperpowerDojo } from './ghostDojo/GhostSuperpowerDojo';

// 특허 출원번호(10-2026-XXXXXXX) 확보 전까지 허위표시 리스크 및 출원 전 공지(신규성 상실) 방지를 위해 false 유지
export const PATENTS_FILED = false;

// 정식 출시 스위치: 출시 전(false)에는 일반 방문자에게 본진 개발 화면을 100% 잠그고 사전 가입(이메일 인증) 모드로 동작하며,
// 정식 출시일(true 전환 시)에는 커다란 [🚀 귀신같이 본 앱 바로 시작하기] 버튼이 활성화된 영구 하이브리드 온보딩 대문으로 작동합니다.
export const OFFICIAL_LAUNCH_LIVE = false;

interface GhostiShowroomLandingProps {
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

function convertEngTypoToKor(input: string): string {
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

const DEFAULT_SHORTS_DATA: ShortsItem[] = [
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
    id: 'typo-756',
    category: 'typo',
    searchKeyword: '귀신창',
    title: 'dkssudgktpdy 치고 백스페이스 누르지 마세요! 무버튼 1초 자동 변환!',
    hookTime: '00:00 ~ 00:03 (훅)',
    hookLine: '“급하게 메신저나 보고서 쓰다가 한영키 안 눌러서 영타 외계어 치고 다 지우셨죠?”',
    solutionLine: '영타·띄어쓰기는 치기만 하면 1초 무버튼 자동 변환! 깨진 줄바꿈·서식은 Ctrl+0 한 번으로 1초 다림질(평소 복붙은 원문 100% 보존)!',
    recommendedKeyword: '귀신같이 귀신창',
    tag: '⌨️ #귀신창 · 쓰던 자리에서 1초면 끝',
    youtubeId: 'tVZ_J4sGJPw',
    videoUrl: '/showroom/shorts/ghosti_dkssudgktp_261110.mp4',
    thumbnailBg: 'from-fuchsia-950 via-purple-950 to-slate-900',
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

const INTERACTIVE_SCENARIOS = {
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

const QUICK_EMAIL_DOMAINS = ['@naver.com', '@gmail.com', '@daum.net', '@kakao.com'];

// ============================================================================
// [샘플 체험 A] 👻 귀신비서 — 샘플 PC 살려보기 (실측 X · 리얼 샘플 O)
// ⚠️ 웹 온보딩에서는 방문자 PC를 실제로 진단하지 않습니다. 실제 진단은 본 앱 『👻 귀신비서』 방에서
//    『내 컴퓨터 연결』 후에만 진행합니다. 타사 상표 분쟁 방지를 위해 제품 실명 대신 일반 명칭만 사용합니다.
// ============================================================================
interface SamplePcProgram {
  id: string;
  name: string;
  memMb: number;
  neededForBank: boolean;
}

const SAMPLE_PC_PROGRAMS: SamplePcProgram[] = [
  { id: 'kb1', name: '○○은행 키보드 보안', memMb: 210, neededForBank: true },
  { id: 'cert', name: '공동인증서 실행 플러그인', memMb: 240, neededForBank: true },
  { id: 'kb2', name: '△△은행 키보드 보안', memMb: 180, neededForBank: false },
  { id: 'pay', name: '쇼핑몰 결제 보안 모듈', memMb: 150, neededForBank: false },
  { id: 'fw', name: '개인 방화벽 에이전트', memMb: 190, neededForBank: false },
  { id: 'term', name: '접속 단말 정보 수집기', memMb: 130, neededForBank: false },
  { id: 'sign', name: '전자서명 실행기', memMb: 160, neededForBank: false },
  { id: 'upd', name: '금융 보안 업데이트 도우미', memMb: 120, neededForBank: false },
];
const SAMPLE_PC_BASE_PCT = 61;
const SAMPLE_PC_REVIVED_PCT = 93;

// ============================================================================
// [샘플 체험 B] 📸 사진공유 — 샘플 가족방 들어가 보기 (public/shared_family_host_thumbs 실사진 36장)
// ============================================================================
const SAMPLE_FAMILY_PHOTOS: string[] = [
  '1721441387443.jpg', '1721441536389.jpg', '1721636228992.jpg',
  '20240719_105510.jpg', '20240719_112207_080.jpg', '20240719_113139_006.jpg', '20240719_114640.jpg',
  '20240719_125448.jpg', '20240719_182503.jpg', '20240720_111405.jpg', '20240720_114310_073.jpg',
  '20240720_122940.jpg', '20240720_134949.jpg', '20240720_141110.jpg', '20240720_180506.jpg',
  '20240720_182145.jpg', '20240720_182931.jpg', '20240720_184012.jpg', '20240720_194823.jpg',
  '20240720_211702.jpg', '20240721_114134.jpg', '20240721_123014.jpg', '20240721_160251.jpg',
  '20240721_183234.jpg', '20240721_183540.jpg',
  '20260525_193249.jpg', '20260525_193442.jpg', '20260613_201138.jpg', '20260815_172840.jpg',
  '20260815_180439.jpg', '20260829_203811.jpg', '20260924_145618.jpg', '20260926_131113.jpg',
  '20260926_131159.jpg', '20260926_131225.jpg', '20260926_160221.jpg',
];
const SAMPLE_FAMILY_GROUPS: { key: 'summer2024' | 'outing2026'; label: string; photos: string[] }[] = [
  {
    key: 'summer2024',
    label: '📅 2024년 7월 여름 휴양지 여행',
    photos: SAMPLE_FAMILY_PHOTOS.filter((p) => !p.startsWith('2026')),
  },
  {
    key: 'outing2026',
    label: '📅 2026년 가족 나들이',
    photos: SAMPLE_FAMILY_PHOTOS.filter((p) => p.startsWith('2026')),
  },
];
const SAMPLE_FAMILY_THUMB_BASE = '/shared_family_host_thumbs/';

type OnboardingWeaponTab = 'video' | 'doc' | 'clean' | 'share' | 'superpower';
type FreeOrDevToolbarKey = 'auto' | 'seq' | '1' | 'snip' | 'zip' | 'dev_2' | 'dev_3' | 'dev_5';

interface SafeOnboardingChatMsg {
  id: string;
  role: 'secretary' | 'user';
  text: string;
  timestamp: string;
}

const WEAPON_META: Record<
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
    stageBadge: '축 B · #귀신검색 (내 PC 평생 무료)',
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
    stageBadge: '축 B · #귀신검색 (내 PC 평생 무료)',
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
    stageBadge: '축 A · #귀신비서 (샘플 체험 · 평생 무료)',
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
    stageBadge: '축 D · #사진공유 (샘플 체험 · 인원·장수 무제한 0원)',
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
    stageBadge: '축 C · #귀신창 (Ctrl+0 / 보조 Ctrl+우클릭 · 기본기 평생 무료)',
    shortVideoUrl: '/showroom/shorts/ghosti_dkssudgktp_261110.mp4',
  },
};

function nowTimeStr(): string {
  return new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

export const GhostiShowroomLanding: React.FC<GhostiShowroomLandingProps> = ({
  onEnterWorkspace,
  isDevAuthorized = false,
}) => {
  const { user, isLoggedIn, refreshSession } = useHub();
  const { status: otpStatus, sendOtp, verifyOtp, formatTimer, error: otpError, reset: resetOtp } = useHubAuth();

  // 출시 모드 상태 및 개발자 전체보기(DEV) 스위치
  const [isLaunched, setIsLaunched] = useState<boolean>(OFFICIAL_LAUNCH_LIVE);
  const [devFullView, setDevFullView] = useState<boolean>(false);

  // 본 앱(👻 귀신비서 방)에서 구경하러 나온 유저인지 감지하여 왕복 복귀 버튼 제공
  // ⚠️ [출시 전 잠금 철칙]: `?view=showroom`은 루트 접속 시 히스토리 라우터가 자동으로 붙이는 파라미터이므로
  //    복귀 버튼 노출 근거로 쓰면 첫 방문자에게도 버튼이 보이고 forceAllow로 개발 워크스페이스 잠금이 뚫립니다.
  //    오직 ① 본 앱에서 [온보딩 구경하기]로 나온 세션 플래그 또는 ② 개발자 권한(isDevAuthorized)일 때만 노출합니다.
  const [canReturnToWorkspace] = useState<boolean>(() => {
    try {
      if (sessionStorage.getItem('ghosti_entered_showroom_from_app') === '1') return true;
      return Boolean(isDevAuthorized);
    } catch {
      return Boolean(isDevAuthorized);
    }
  });

  const [shortsList, setShortsList] = useState<ShortsItem[]>(DEFAULT_SHORTS_DATA);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'video' | 'doc' | 'clean' | 'typo'>('all');
  const [activeShortsModal, setActiveShortsModal] = useState<ShortsItem | null>(null);

  // 공식 보증서 모달 상태 & B2B 영업 유입(?from=b2b / #work-share) 직통 포커싱 상태
  const [certModalOpen, setCertModalOpen] = useState<boolean>(false);
  const [b2bFocused, setB2bFocused] = useState<boolean>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('from') === 'b2b' || window.location.hash === '#work-share';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const syncB2bFocus = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const isB2b = params.get('from') === 'b2b' || window.location.hash === '#work-share';
        if (isB2b) {
          setB2bFocused(true);
          // [SSOT v2.2 ③] 중간으로 강제 스크롤하지 않고 최상단 B2B 전용 요약 뷰를 우선 노출
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      } catch {
        // ignore
      }
    };
    syncB2bFocus();
    window.addEventListener('hashchange', syncB2bFocus);
    return () => window.removeEventListener('hashchange', syncB2bFocus);
  }, []);

  // 좌측 귀신비서 채팅창 ⇄ 우측 단일 인터랙티브 체험 스테이지 상태 (100% 독립 안전 상태)
  const [demoTab, setDemoTab] = useState<OnboardingWeaponTab>('video');
  const [showStageShortVideo, setShowStageShortVideo] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<SafeOnboardingChatMsg[]>(() => [
    {
      id: 'init-welcome',
      role: 'secretary',
      text: '반가워요! 전속 『👻 귀신비서』가 대기 중이에요 ✨\n아래 무료 초능력 카드를 톡 누르면 오른쪽에서 샘플로 바로 체험해 보실 수 있어요! (가입·설치 없이)',
      timestamp: nowTimeStr(),
    },
  ]);
  const [chatInput, setChatInput] = useState<string>('');
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // 우측 단일 스테이지 내부 시뮬레이터 상태
  const [selectedVideoScenarioIdx, setSelectedVideoScenarioIdx] = useState(0);
  const [videoOcrExtracted, setVideoOcrExtracted] = useState(false);
  const [selectedDocScenarioIdx, setSelectedDocScenarioIdx] = useState(0);
  const [cleanDemoDone, setCleanDemoDone] = useState(false);

  // [샘플 체험 A] 귀신비서 샘플 PC 살려보기: 0 대기 → 1 진단 → 2 재우기 → 3 은행 접속(필요한 것만 기상) → 4 원상복구
  const [cleanSubTab, setCleanSubTab] = useState<'speed' | 'photo'>('speed');
  const [speedStep, setSpeedStep] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [sleptCount, setSleptCount] = useState<number>(0);
  const sleepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // [샘플 체험 B] 사진공유 샘플 가족방: 0 카톡 만료 공감 → 1 초대 링크로 가족방 입장 → 2 사진 원본 받기 비교
  const [shareStep, setShareStep] = useState<0 | 1 | 2>(0);
  const [shareGroupKey, setShareGroupKey] = useState<'summer2024' | 'outing2026'>('summer2024');
  const [sharePickedPhoto, setSharePickedPhoto] = useState<string | null>(null);
  const [shareUploadHint, setShareUploadHint] = useState<boolean>(false);

  useEffect(() => {
    return () => {
      if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
    };
  }, []);

  const runSpeedDiagnose = () => {
    playBabyGhostChime();
    if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
    setSleptCount(0);
    setSpeedStep(1);
    const ts = nowTimeStr();
    setChatMessages((prev) => [
      ...prev.slice(-6),
      {
        id: `s-diag-${Date.now()}`,
        role: 'secretary',
        text: '🔍 1초 진단 완료! 은행·결제 보안프로그램 8개가 뒤에서 돌아가며 원래 속도의 61%만 쓰고 있어요. 이제 [💤 안 지우고 재우기]를 눌러볼까요? 👻',
        timestamp: ts,
      },
    ]);
  };

  const runSpeedSleep = () => {
    playBabyGhostChime();
    if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
    setSpeedStep(2);
    setSleptCount(0);
    let n = 0;
    sleepTimerRef.current = setInterval(() => {
      n += 1;
      setSleptCount(n);
      if (n >= SAMPLE_PC_PROGRAMS.length && sleepTimerRef.current) {
        clearInterval(sleepTimerRef.current);
        sleepTimerRef.current = null;
      }
    }, 140);
    const ts = nowTimeStr();
    setChatMessages((prev) => [
      ...prev.slice(-6),
      {
        id: `s-sleep-${Date.now()}`,
        role: 'secretary',
        text: '💤 프로그램은 하나도 안 지우고 8개 모두 잠만 재웠더니 속도가 61% → 93%로 살아났어요! 이제 [🏦 은행 사이트 열어보기]를 눌러보세요~ ✨',
        timestamp: ts,
      },
    ]);
  };

  const runSpeedBankOpen = () => {
    playBabyGhostChime();
    if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
    setSleptCount(SAMPLE_PC_PROGRAMS.length);
    setSpeedStep(3);
    const ts = nowTimeStr();
    setChatMessages((prev) => [
      ...prev.slice(-6),
      {
        id: `s-bank-${Date.now()}`,
        role: 'secretary',
        text: '🏦 은행 사이트를 열면 은행 업무에 꼭 필요한 2개만 ⚡1초 만에 깨어나고(속도 85%), 나머지 6개는 계속 쿨쿨 자고 있어요! 마지막으로 [↩️ 전부 원래대로]를 눌러보세요!',
        timestamp: ts,
      },
    ]);
  };

  const runSpeedRestore = () => {
    playBabyGhostChime();
    if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
    setSleptCount(0);
    setSpeedStep(4);
    const ts = nowTimeStr();
    setChatMessages((prev) => [
      ...prev.slice(-6),
      {
        id: `s-restore-${Date.now()}`,
        role: 'secretary',
        text: '↩️ 61% 처음 상태로 1초 만에 완벽 복구됐어요! 지운 프로그램 0개 · 언제든 1초 원상복구되니 안심하고 쓰실 수 있어요~ 👻💚',
        timestamp: ts,
      },
    ]);
  };

  // 무기 4 (귀신창 v1.4 — 100% 무버튼 자동 성형 & 평생 무료 5총사 체험 상태)
  const [typoSampleIdx, setTypoSampleIdx] = useState<number>(0);
  const [typoInput, setTypoInput] = useState<string>('dkssudgktpdy! 오늘 회의자료 rkatkgkqslek. 내일 오전 10시에 뵙겠습니다.');
  const [typoOriginalBackup, setTypoOriginalBackup] = useState<string>('dkssudgktpdy! 오늘 회의자료 rkatkgkqslek. 내일 오전 10시에 뵙겠습니다.');
  const [typoConverted, setTypoConverted] = useState<boolean>(false);
  const [typoIsPresetSample, setTypoIsPresetSample] = useState<boolean>(true);
  const typoDemoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedToolbarKey, setSelectedToolbarKey] = useState<FreeOrDevToolbarKey>('1');
  const [zipDemoApplied, setZipDemoApplied] = useState<boolean>(false);

  // DEV 전체보기 전용 내부 상태 보존 (코드 삭제 없이 일반 방문자에게만 은닉)
  const {
    trialScanPermissions,
    setTrialScanPermission,
    pcAgentPairedMobile,
    setPcAgentPairedMobile,
    merlinAuth,
    isStoreAppMode,
  } = useSaySeeStore();
  const [telemetryEnabled, setTelemetryEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ghosti_telemetry_enabled') !== 'false';
    } catch {
      return true;
    }
  });
  const [showTermsClause, setShowTermsClause] = useState(false);
  const isCompactH1Slot = React.useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('h1') === 'compact';
  }, []);

  // 사전 가입 & 출시 알림 이메일 인증 상태
  const [emailInput, setEmailInput] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [localVerifiedEmail, setLocalVerifiedEmail] = useState<string>(() => {
    try {
      return (
        localStorage.getItem('ghosti_prelaunch_verified_email') ||
        localStorage.getItem('userEmail') ||
        ''
      );
    } catch {
      return '';
    }
  });
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const [dbSyncStatus, setDbSyncStatus] = useState<'idle' | 'syncing' | 'synced'>('idle');
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const heroCtaRef = useRef<HTMLDivElement | null>(null);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const verifiedUserEmail = isLoggedIn && user?.email ? user.email : localVerifiedEmail;

  // 쇼츠 피드 자동 로드
  useEffect(() => {
    let cancelled = false;
    const loadShortsFeed = async () => {
      try {
        const res = await fetch(`/data/ghosti_shorts_feed.json?t=${Date.now()}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data?.items) && data.items.length > 0) {
          setShortsList(data.items);
        }
      } catch {
        // 기본 내장 데이터 유지
      }
    };
    void loadShortsFeed();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleSelectWeaponChip = (tab: OnboardingWeaponTab, scrollToDemo = false) => {
    playBabyGhostChime();
    setDemoTab(tab);
    setShowStageShortVideo(false);
    if (tab === 'clean') {
      setCleanSubTab('speed');
    }
    if (tab === 'share') {
      setShareStep(0);
      setSharePickedPhoto(null);
      setShareUploadHint(false);
    }
    const meta = WEAPON_META[tab];
    const ts = nowTimeStr();
    setChatMessages((prev) => [
      ...prev.slice(-6),
      { id: `u-${Date.now()}`, role: 'user', text: meta.userBubble, timestamp: ts },
      { id: `s-${Date.now() + 1}`, role: 'secretary', text: meta.secretaryReply, timestamp: ts },
    ]);
    if (scrollToDemo) {
      document.getElementById('interactive-demo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleChatFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = chatInput.trim();
    if (!q) return;
    setChatInput('');
    playBabyGhostChime();
    const ts = nowTimeStr();

    // 4대 초능력(영상 글자·장면 / 문서·영수증 / 사진정리·공유·보안 / 영타·귀신창) 키워드 정밀 매칭
    let matchedTab: OnboardingWeaponTab | null = null;
    let customReply: string | null = null;

    if (
      /영수증|사업자|엑셀|xlsx|문서|계약서|지체상금|부가세|환급|세금계산서|정산|단가|pdf|한글|hwp|본문|직독/i.test(
        q,
      ) &&
      !/라벨러|파일명|합본/.test(q)
    ) {
      matchedTab = 'doc';
      if (/영수증|사업자/.test(q)) {
        setSelectedDocScenarioIdx(2);
        customReply =
          '찍어둔 영수증 사진을 일일이 열어보실 필요 없어요~ 🧾✨\n오른쪽 체험 화면에 [영수증 사업자번호] 스캔 결과를 바로 띄워두었어요! 상호명·사업자번호·결제금액까지 1초 만에 뽑아드릴게요!';
      } else if (/부가세|환급|정산|엑셀|xlsx|세금/i.test(q)) {
        setSelectedDocScenarioIdx(1);
      } else if (/계약서|지체상금|pdf/i.test(q)) {
        setSelectedDocScenarioIdx(0);
      }
    } else if (/영상|동영상|걸음마|대사|장면|점프|타임라인|고기상|노을|휴가|비디오|mp4|mov|글자\s*뽑기|자막/i.test(q)) {
      matchedTab = 'video';
      if (/고기|맛집|식당/.test(q)) setSelectedVideoScenarioIdx(1);
      else if (/노을|바다|휴가|가족사진/.test(q)) setSelectedVideoScenarioIdx(2);
      else setSelectedVideoScenarioIdx(0);
    } else if (/공유|가족방|가족\s*사진|모임|동창|카톡|만료|원본|앨범|초대/i.test(q)) {
      matchedTab = 'share';
      setShareStep(0);
      setSharePickedPhoto(null);
      setShareUploadHint(false);
    } else if (/사진|연사|인생샷|청소|보안|백신|느려|용량|정리|복원|휴지통|효도|캐시|속도|재우/i.test(q)) {
      matchedTab = 'clean';
      if (/사진|연사|인생샷|휴지통/.test(q)) {
        setCleanSubTab('photo');
      } else {
        setCleanSubTab('speed');
      }
    } else if (
      /영타|오타|한영|서식|줄바꿈|다림질|귀신창|순차|복붙|상용구|f1|압축|zip|dkssud|rkatk|rmqgk/i.test(
        q,
      )
    ) {
      matchedTab = 'superpower';
      if (/서식|줄바꿈|다림질/i.test(q)) setSelectedToolbarKey('1');
      else if (/순차|복붙/i.test(q)) setSelectedToolbarKey('seq');
      else if (/상용구|f1/i.test(q)) setSelectedToolbarKey('snip');
      else if (/압축|zip/i.test(q)) setSelectedToolbarKey('zip');
      else setSelectedToolbarKey('auto');
    } else if (/무료|가격|유료|보증서|기업|회사|라이선스|결제/.test(q)) {
      customReply =
        '개인 PC는 물론 민간 기업 업무용 PC까지 기본 4대 핵심 기능 100% 영구 무료예요! 📜✨\n상단 [📜 무료 공식 보증서] 버튼을 누르면 대표이사 직인이 찍힌 공식 보증서도 바로 확인하실 수 있어요~';
    }

    if (matchedTab) {
      setDemoTab(matchedTab);
      setShowStageShortVideo(false);
      const replyText = customReply || WEAPON_META[matchedTab].secretaryReply;
      setChatMessages((prev) => [
        ...prev.slice(-6),
        { id: `u-${Date.now()}`, role: 'user', text: q, timestamp: ts },
        { id: `s-${Date.now() + 1}`, role: 'secretary', text: replyText, timestamp: ts },
      ]);
      return;
    }

    if (customReply) {
      setChatMessages((prev) => [
        ...prev.slice(-6),
        { id: `u-${Date.now()}`, role: 'user', text: q, timestamp: ts },
        { id: `s-${Date.now() + 1}`, role: 'secretary', text: customReply, timestamp: ts },
      ]);
      return;
    }

    // 4대 초능력과 무관한 일상 질문(예: 오늘 점심, 날씨 알려줘 등) 입력 시 친절한 역할 안내 문구 출력
    const guideReply =
      `앗, 저는 일상 대화 대신 내 PC·모바일의 4가지 초능력을 체험해 드리는 『👻 귀신비서』예요~ ✨\n` +
      `아래 초능력 카드를 톡 눌러보시거나 「영상 글자」, 「영수증 찾기」, 「PC 속도」, 「가족 사진 공유」, 「영타 변환」처럼 궁금한 기능을 말씀해 주세요!`;

    setChatMessages((prev) => [
      ...prev.slice(-6),
      { id: `u-${Date.now()}`, role: 'user', text: q, timestamp: ts },
      { id: `s-${Date.now() + 1}`, role: 'secretary', text: guideReply, timestamp: ts },
    ]);
  };

  const TYPO_SAMPLES = [
    {
      label: '⚡ 예문 1: dkssudgktpdy 영타 무버튼 자동성형',
      raw: 'dkssudgktpdy! 오늘 회의자료 rkatkgkqslek. 내일 오전 10시에 뵙겠습니다.',
    },
    {
      label: '⚡ 예문 2: 카톡 영타 외계어 1초 자동교정',
      raw: 'rmqgkRp 카톡 Tmr다가 gksdudzl 안 눌러서 멘붕...',
    },
    {
      label: '🧹 예문 3: PDF 깨진 줄바꿈 (1초 줄바꿈 다림질)',
      raw: '계약서에서 복사할 때마다\n\n줄바꿈이 마구 깨져서\n\n일일이 백스페이스 누르셨죠?',
    },
  ];

  const formatTypoAfterPreview = (rawText: string) =>
    convertEngTypoToKor(rawText)
      .replace(/\n{2,}/g, ' ')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();

  // 무기 4 (귀신창 v1.4) 예문 칩 클릭 시 Before ➔ After 비교 배너 표시 + 0.45초 즉시 자동 성형 시연 (Show & Try)
  const triggerTypoAutoIron = (rawText: string, sIdx = 0) => {
    if (typoDemoTimerRef.current) clearTimeout(typoDemoTimerRef.current);
    playBabyGhostChime();
    setTypoSampleIdx(sIdx);
    setTypoOriginalBackup(rawText);
    setTypoInput(rawText);
    setTypoConverted(false);
    setTypoIsPresetSample(true);
    typoDemoTimerRef.current = setTimeout(() => {
      const converted = formatTypoAfterPreview(rawText);
      setTypoInput(converted);
      setTypoConverted(true);
    }, 450);
  };

  // superpower 탭 진입 시 먼저 영타 원문을 보여준 뒤 450ms 후 저절로 한글로 변환되는 자동 시연(Show) 후 직접 입력(Try) 유도
  useEffect(() => {
    if (demoTab !== 'superpower') return;
    const defaultRaw = TYPO_SAMPLES[0].raw;
    setTypoSampleIdx(0);
    setTypoOriginalBackup(defaultRaw);
    setTypoInput(defaultRaw);
    setTypoConverted(false);
    setTypoIsPresetSample(true);
    const timer = setTimeout(() => {
      const converted = formatTypoAfterPreview(defaultRaw);
      setTypoInput(converted);
      setTypoConverted(true);
    }, 450);
    typoDemoTimerRef.current = timer;
    return () => clearTimeout(timer);
  }, [demoTab]);

  const handleTypoTextareaFocus = () => {
    if (typoIsPresetSample) {
      if (typoDemoTimerRef.current) {
        clearTimeout(typoDemoTimerRef.current);
        typoDemoTimerRef.current = null;
      }
      setTypoInput('');
      setTypoConverted(false);
      setTypoIsPresetSample(false);
    }
  };

  const handleTypoInputChange = (val: string) => {
    if (typoDemoTimerRef.current) {
      clearTimeout(typoDemoTimerRef.current);
      typoDemoTimerRef.current = null;
    }
    setTypoIsPresetSample(false);

    // 이메일(@), URL, 도메인, 숫자 3자리 이상 계정/비번 토큰은 확정 보호막에 따라 자동 변환하지 않음
    const trimmed = val.trim();
    const hasProtectedToken =
      /@|:\/\/|www\.|\.(com|kr|net|org|app|io)\b|[A-Za-z]{2,}\d{3,}/i.test(trimmed);

    if (!hasProtectedToken && (val.endsWith(' ') || val.endsWith('\n')) && !typoInput.endsWith(' ')) {
      const converted = convertEngTypoToKor(val)
        .replace(/\n{2,}/g, ' ')
        .replace(/[ \t]{2,}/g, ' ');
      if (converted !== val) {
        playBabyGhostChime();
        setTypoOriginalBackup(val);
        setTypoInput(converted);
        setTypoConverted(true);
        return;
      }
    }
    setTypoInput(val);
    setTypoConverted(false);
  };

  const handleTypoUndo = () => {
    if (typoDemoTimerRef.current) {
      clearTimeout(typoDemoTimerRef.current);
      typoDemoTimerRef.current = null;
    }
    setTypoInput(typoOriginalBackup);
    setTypoConverted(false);
  };

  const filteredShorts =
    selectedCategory === 'all'
      ? shortsList
      : shortsList.filter((s) => s.category === selectedCategory);

  const scrollToEmailBox = () => {
    heroCtaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => {
      emailInputRef.current?.focus();
    }, 450);
  };

  const applyQuickDomain = (domain: string) => {
    const clean = emailInput.trim();
    const localPart = clean.split('@')[0] || '';
    const nextEmail = localPart ? `${localPart}${domain}` : domain;
    setEmailInput(nextEmail);
    emailInputRef.current?.focus();
  };

  const handleRequestEmailVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormNotice(null);
    const cleanEmail = emailInput.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setFormNotice('알림을 받으실 올바른 이메일 주소를 입력해 주세요. (예: name@naver.com)');
      emailInputRef.current?.focus();
      return;
    }
    setOtpDigits(['', '', '', '', '', '']);
    await sendOtp(cleanEmail);
    setTimeout(() => {
      otpInputRefs.current[0]?.focus();
    }, 100);
  };

  const handleOtpDigitChange = (index: number, rawValue: string) => {
    const digitsOnly = rawValue.replace(/\D/g, '');
    if (digitsOnly.length > 1) {
      const pasted = digitsOnly.slice(0, 6).split('');
      const next = [...otpDigits];
      pasted.forEach((d, i) => {
        if (i < 6) next[i] = d;
      });
      setOtpDigits(next);
      if (pasted.length === 6) {
        void handleVerifyOtpCode(pasted.join(''));
      } else {
        otpInputRefs.current[Math.min(pasted.length, 5)]?.focus();
      }
      return;
    }

    const next = [...otpDigits];
    next[index] = digitsOnly.slice(-1);
    setOtpDigits(next);

    if (digitsOnly && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }

    if (next.every((d) => d !== '') && next.join('').length === 6) {
      void handleVerifyOtpCode(next.join(''));
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      e.preventDefault();
      setOtpDigits(pasted.split(''));
      void handleVerifyOtpCode(pasted);
    }
  };

  const handleVerifyOtpCode = async (fullCode: string) => {
    if (otpStatus === 'verifying') return;
    const cleanEmail = emailInput.trim().toLowerCase();
    const res = await verifyOtp(fullCode, cleanEmail);
    if (res && res.success) {
      try {
        localStorage.setItem('ghosti_prelaunch_verified_email', cleanEmail);
        localStorage.setItem('userEmail', cleanEmail);
        localStorage.setItem('ghosti_onboarding_seen_v1', 'true');
      } catch {}
      setLocalVerifiedEmail(cleanEmail);
      setIsChangingEmail(false);
      void refreshSession();
      if (res.userId && cleanEmail) {
        setDbSyncStatus('syncing');
        const synced = await syncHubUserToLocalSupabase({
          userId: res.userId,
          email: cleanEmail,
          nickname: res.nickname,
          hubToken: (res as any).token || localStorage.getItem('merlin_session_token') || '',
          signupSource: isLaunched ? 'onboarding_showroom_launch' : 'onboarding_showroom_prelaunch',
          launchNotifyOptIn: true,
          forceSync: true,
        });
        setDbSyncStatus(synced ? 'synced' : 'idle');
      }
    }
  };

  const activeMeta = WEAPON_META[demoTab];

  return (
    <div className="min-h-screen bg-[#070B11] text-zinc-100 font-sans selection:bg-[#00F0B5]/30 selection:text-[#00F0B5] relative overflow-x-hidden">
      {/* 백그라운드 앰비언트 글로우 */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[550px] bg-gradient-to-b from-[#00F0B5]/10 via-[#0D9488]/5 to-transparent blur-[120px] pointer-events-none -z-10" />

      {/* 3종 서체 로드 (타이틀: Jua / 포인트 감성체: Gowun Batang / 영문·수치: JetBrains Mono + 한글 맑은고딕 폴백으로 굴림체 자간 벌어짐 원천 차단) */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@700&family=Jua&family=JetBrains+Mono:wght@600;800&display=swap');
        .font-display-kr { font-family: 'Jua', 'Malgun Gothic', sans-serif; letter-spacing: 0.01em; }
        .font-story-kr { font-family: 'Gowun Batang', 'Batang', serif; }
        .font-code-kr { font-family: 'JetBrains Mono', 'Pretendard', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; letter-spacing: 0; }
        .borderless-shape { border: none !important; }
      `}</style>
      {/* 1. 최상단 마스터 GNB */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#070B11]/85 border-b border-white/10 transition-all">
        <div
          style={{ minHeight: '68px', paddingTop: '12px', paddingBottom: '12px' }}
          className="max-w-7xl mx-auto px-4 sm:px-6 min-h-[68px] py-3 flex items-center justify-between gap-3"
        >
          {/* 좌측 브랜드 로고 (아기귀신 심볼 + 캘리그라피 워드마크) & 권위 배지 */}
          <div className="flex items-center gap-2.5 shrink-0 py-0.5">
            <div
              data-ghosti-brand-logo="true"
              className="flex items-center gap-2.5 cursor-pointer group shrink-0 py-0.5"
              onClick={() => {
                silencePendingEnterGiggleOnLogoClick();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              <img
                src="/gwisinkachi_app_icon_512.png"
                alt="대표 아기귀신 마스코트"
                style={{ width: '42px', height: '42px', minWidth: '42px', minHeight: '42px' }}
                className="w-[42px] h-[42px] rounded-xl object-cover border-2 border-[#00F0B5] shadow-md shrink-0 group-hover:scale-105 transition-transform"
              />
              <img
                src="/gwisinkachi_wordmark_dark_ink.png"
                alt="귀신같이 캘리그라피 로고"
                style={{ height: '32px', width: 'auto', minWidth: '90px' }}
                className="h-8 w-auto object-contain shrink-0"
              />
            </div>
            <div className="hidden 2xl:flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/15 borderless-shape text-[#00F0B5] text-[13px] font-bold whitespace-nowrap shrink-0">
              <span>✓</span>
              <span>개인·기업 PC 기본 기능 영구 무료</span>
            </div>
          </div>

          {/* 중앙 4알약 GNB 복원 (SSOT v2.3: 브랜드 색채가 살아있는 4알약 & 1280~1366px 노트북 우측 단일 CTA 집중) */}
          <nav className="hidden md:flex items-center gap-2 text-[13px] font-extrabold whitespace-nowrap shrink-0">
            <button
              type="button"
              onClick={() =>
                document.getElementById('interactive-demo')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
              className="px-3.5 py-1.5 rounded-full bg-[#00F0B5]/15 hover:bg-[#00F0B5]/25 text-[#00F0B5] border border-[#00F0B5]/50 transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              ⚡ 4대 무료 초능력
            </button>
            {!isStoreAppMode && (
              <button
                type="button"
                onClick={() => {
                  setB2bFocused(true);
                  document.getElementById('extensions')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="px-3.5 py-1.5 rounded-full bg-zinc-900/90 hover:bg-zinc-800 text-amber-300 border border-amber-400/35 hover:border-amber-400/60 transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                💼 기기·업무 확장
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                document.getElementById('shorts')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
              className="px-3.5 py-1.5 rounded-full bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 border border-white/10 hover:border-teal-400/50 cursor-pointer whitespace-nowrap shrink-0"
            >
              🎬 15초 예고편
            </button>
            <button
              type="button"
              onClick={() =>
                document.getElementById('manifesto')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
              className="px-3.5 py-1.5 rounded-full bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 border border-white/10 hover:border-teal-400/50 cursor-pointer whitespace-nowrap shrink-0"
            >
              📜 브랜드 선언문
            </button>
          </nav>

          {/* 우측 액션 영역 (단일 CTA 집중 · 모바일 390px에서도 CTA가 화면 밖으로 밀리지 않도록 축약 라벨) */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {canReturnToWorkspace && (
              <button
                type="button"
                onClick={() => onEnterWorkspace(true)}
                title="귀신비서 방으로 돌아가기"
                className="px-2.5 sm:px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-[#00F0B5] border-2 border-[#00F0B5]/60 text-[13px] font-black shadow-[0_0_16px_rgba(0,240,181,0.2)] transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <span>👻</span>
                <span className="hidden sm:inline">귀신비서 방으로 돌아가기 ➔</span>
                <span className="sm:hidden">➔</span>
              </button>
            )}

            {!isLaunched ? (
              verifiedUserEmail ? (
                <div className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 text-[13px] font-extrabold flex items-center gap-1.5 whitespace-nowrap shrink-0">
                  <span>✅</span>
                  <span className="max-w-[90px] sm:max-w-[140px] truncate">{verifiedUserEmail}</span>
                  <span className="hidden sm:inline">알림 예약됨</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={scrollToEmailBox}
                  data-keep-dark="true"
                  style={{ background: 'linear-gradient(90deg, #00F0B5 0%, #2DD4BF 100%)', color: '#020617' }}
                  className="px-3 sm:px-4 py-2 rounded-xl text-[13px] sm:text-sm font-black shadow-[0_0_20px_rgba(0,240,181,0.35)] transition-all hover:opacity-90 cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <span>🔔</span>
                  <span className="sm:hidden">알림받기</span>
                  <span className="hidden sm:inline">출시 알림 10초 예약</span>
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={() => onEnterWorkspace(true)}
                data-keep-dark="true"
                style={{ background: 'linear-gradient(90deg, #00F0B5 0%, #2DD4BF 100%)', color: '#020617' }}
                className="px-3 sm:px-4 py-2 rounded-xl text-[13px] sm:text-sm font-black shadow-[0_0_24px_rgba(0,240,181,0.45)] transition-all hover:opacity-90 cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <span>⚡</span>
                <span className="sm:hidden">무료 시작</span>
                <span className="hidden sm:inline">10초 만에 무료로 시작하기</span>
              </button>
            )}

            {/* ⚠️ ?dev=true / localhost 접속 시에만 나타나는 개발자 컨트롤 */}
            {isDevAuthorized && (
              <div className="hidden xl:flex items-center gap-1.5 pl-2 border-l border-white/15">
                <button
                  type="button"
                  onClick={() => setDevFullView((v) => !v)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-black border transition-all cursor-pointer ${
                    devFullView
                      ? 'bg-amber-400 text-slate-950 border-amber-300'
                      : 'bg-zinc-900 hover:bg-zinc-800 text-amber-300 border-amber-400/30'
                  }`}
                >
                  🧪 DEV 전체보기 {devFullView ? 'ON' : 'OFF'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsLaunched(!isLaunched)}
                  className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-teal-300 border border-teal-400/30 text-xs font-bold transition-all cursor-pointer"
                >
                  {isLaunched ? '🚀 출시후 뷰' : '⏳ 출시전 뷰'}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* =====================================================================
          2. 메인 온보딩 섹션: ?from=b2b 상단 전용 뷰 + 대표 히어로 + 좌측 『👻 귀신비서(5)』 ⇄ 우측 『단일 스테이지(7)』
         ===================================================================== */}
      <section className="relative pt-6 pb-16 px-4 sm:px-6 max-w-7xl mx-auto space-y-7">
        {/* [SSOT v2.2 ③] ?from=b2b (또는 #work-share) 진입 시 중간 강제 스크롤 대신 최상단 B2B 전용 요약 뷰 우선 노출 */}
        {b2bFocused && !isStoreAppMode && (
          <div
            data-keep-dark="true"
            style={{
              background: 'linear-gradient(135deg, #0A1526 0%, #112433 55%, #0B1626 100%)',
            }}
            className="rounded-3xl border-2 border-amber-400/70 p-6 sm:p-8 shadow-[0_20px_60px_rgba(251,191,36,0.18)] space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex flex-wrap items-center gap-2 px-3.5 py-1 rounded-full bg-amber-400/20 border border-amber-300/50 text-amber-200 text-xs sm:text-[13px] font-black">
                <span>🏢 기업·사무실 전용 안내</span>
                <span>·</span>
                <span>소기업 5인·30GB 평생 0원 보증</span>
              </div>
              <button
                type="button"
                onClick={() => setB2bFocused(false)}
                className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-zinc-200 text-xs font-bold cursor-pointer"
              >
                개인용 기본 소개로 보기 ✕
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
              <div className="lg:col-span-8 space-y-2.5">
                <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight break-keep">
                  클라우드 월세 0원, 우리 팀 PC를 <span className="text-amber-300">공용 폴더(S: 드라이브)</span> 하나로
                </h2>
                <p className="text-sm sm:text-[15px] text-zinc-200 font-semibold leading-relaxed break-keep">
                  비싼 서버나 클라우드 구독 없이 사내 문서·현장 사진을 공유 드라이브(S:) 하나로 묶어 1초 만에 찾고 씁니다. (소기업 5인·30GB 평생 0원 보증 · 추가 팀 월 9,900원~)
                </p>
                <div className="flex flex-wrap gap-2 pt-1 text-xs font-extrabold text-teal-100">
                  <span className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/15">🔒 종단간 암호화(E2EE) 및 퇴사자 권한 즉시 회수</span>
                  <span className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/15">🛡️ 랜섬웨어 전염 격리 · 팀원 PC 오프 시 스마트 캐시 열람</span>
                  <span className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/15">🧾 법인 세금계산서 즉시 발행</span>
                  <span className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/15">🏢 썬드림주식회사 공식 고객지원</span>
                </div>
              </div>
              <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => (isLaunched ? onEnterWorkspace(true) : scrollToEmailBox())}
                  className="w-full px-5 py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-yellow-200 text-slate-950 font-black text-sm shadow-lg cursor-pointer"
                >
                  ⚡ 우리 팀 공용 폴더 {isLaunched ? '무료로 시작하기' : '출시 알림받기'}
                </button>
                <button
                  type="button"
                  onClick={() => setCertModalOpen(true)}
                  className="w-full px-4 py-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-amber-400/60 text-amber-300 font-black text-xs sm:text-[13px] cursor-pointer"
                >
                  📜 민간 기업 영구 무료 보증서 보기
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 🎨 대표 아기귀신 마스코트 & 3D·캘리 타이포그래피 메인 비주얼 쇼케이스 배너 */}
        <div
          data-keep-dark="true"
          style={{
            background: 'linear-gradient(135deg, #060D1A 0%, #0A242C 52%, #071222 100%)',
          }}
          className="relative rounded-3xl border-2 border-teal-400/35 p-6 sm:p-8 lg:p-9 shadow-[0_24px_65px_rgba(6,13,26,0.28)] overflow-hidden"
        >
          {/* 배경 오로라 글로우 */}
          <div
            data-keep-dark="true"
            className="pointer-events-none absolute -top-24 -right-16 w-80 h-80 rounded-full bg-[#00F0B5]/20 blur-[90px]"
          />
          <div
            data-keep-dark="true"
            className="pointer-events-none absolute -bottom-24 -left-16 w-72 h-72 rounded-full bg-amber-400/10 blur-[80px]"
          />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
            {/* 좌측 (7칸): 임팩트 타이포그래피 & 한눈에 보는 무료 핵심 4종 스탯 카드 */}
            <div className="lg:col-span-7 space-y-4">
              <div className="inline-flex flex-wrap items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-[#00F0B5]/40 text-[#00F0B5] text-[13px] font-black">
                <span>⚡</span>
                <span>광고 0% · 클라우드 월세 0원 · PC·모바일 초능력</span>
              </div>

              {/* 붓글씨 캘리그라피 + 대표 헤드라인(H1 18자 심장 타격) + 서브 헤드라인(H2) */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <img
                    src="/gwisinkachi_wordmark_white_ink.png"
                    alt="귀신같이 붓글씨 타이포그래피"
                    className="h-11 sm:h-14 lg:h-16 w-auto object-contain drop-shadow-[0_4px_18px_rgba(0,240,181,0.35)]"
                  />
                  <span
                    data-keep-dark="true"
                    style={{ backgroundColor: 'rgba(251, 191, 36, 0.2)', color: '#FDE68A' }}
                    className="px-3.5 py-1.5 rounded-xl border-2 border-amber-400/60 text-sm sm:text-base font-black tracking-tight shadow-[0_0_18px_rgba(251,191,36,0.22)]"
                  >
                    PC·모바일 초능력
                  </span>
                </div>

                <h1 className="text-2xl sm:text-4xl lg:text-[42px] font-black tracking-tight leading-[1.2] text-white break-keep">
                  {isCompactH1Slot ? (
                    <span>
                      느린 PC·폰 정리와 1초 내용 검색{' '}
                      <span style={{ color: '#00F0B5' }} className="underline decoration-[#00F0B5]/50 underline-offset-4">
                        초능력
                      </span>
                    </span>
                  ) : (
                    <span>
                      내 PC와 모바일에{' '}
                      <span style={{ color: '#00F0B5' }} className="underline decoration-[#00F0B5]/50 underline-offset-4">
                        1초 초능력을
                      </span>
                    </span>
                  )}
                </h1>

                <h2 className="text-base sm:text-lg lg:text-[18.5px] font-extrabold text-zinc-100 leading-snug break-keep max-w-2xl">
                  {isCompactH1Slot
                    ? '서버 전송과 광고 0%, 열지 않고 문서·사진·영상을 찾고 내 기기와 팀을 하나로 잇습니다.'
                    : '느려진 PC는 새것처럼 깨우고, 숨은 파일·사진·영상은 열지 않고 1초 만에 찾아냅니다.'}
                </h2>
              </div>

              {/* 단일 행동 버튼 (Single CTA) + 안심 보증 문구
                  ⚠️ [약속-동선 일치 철칙]: 출시 전에는 실제로 가입 없이 가능한 행동(아래 체험 스테이지)으로 연결하고,
                     이메일 출시 알림은 보조 버튼으로 분리합니다. 출시 후(isLaunched)에는 SSOT v2.3 원문 그대로 노출합니다. */}
              <div className="space-y-2 pt-0.5">
                <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      isLaunched
                        ? onEnterWorkspace(true)
                        : document
                            .getElementById('interactive-demo')
                            ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }
                    data-keep-dark="true"
                    style={{
                      background: 'linear-gradient(90deg, #00F0B5 0%, #2DD4BF 55%, #34D399 100%)',
                      color: '#020617',
                    }}
                    className="px-6 py-3.5 rounded-2xl font-black text-sm sm:text-base shadow-[0_6px_28px_rgba(0,240,181,0.38)] transition-all hover:scale-[1.02] hover:opacity-95 cursor-pointer flex items-center gap-2"
                  >
                    <span>⚡</span>
                    <span>{isLaunched ? '10초 만에 무료로 시작하기' : '가입 없이 바로 체험해 보기'}</span>
                  </button>
                  {!isLaunched && !verifiedUserEmail && (
                    <button
                      type="button"
                      onClick={scrollToEmailBox}
                      data-keep-dark="true"
                      style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#E2E8F0' }}
                      className="px-4 py-3 rounded-2xl border border-white/20 hover:border-[#00F0B5]/60 font-extrabold text-[13px] sm:text-sm cursor-pointer flex items-center gap-1.5"
                    >
                      <span>🔔</span>
                      <span>출시 알림 10초 예약</span>
                    </button>
                  )}
                </div>
                <p className="text-[12.5px] sm:text-[13.5px] text-teal-200/95 font-bold break-keep">
                  {isLaunched
                    ? '✓ 가입·카드 등록 없이 즉시 시작 · 서버 전송 0% · 광고 0% 평생 무료'
                    : '✓ 가입·카드 등록 없이 바로 체험 · 서버 전송 0% · 광고 0% 평생 무료'}
                </p>
              </div>

              {/* 한눈에 쏙 들어오는 4대 무료 코어 카드 (축 A~D) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                {[
                  {
                    key: 'secretary',
                    tab: 'clean' as OnboardingWeaponTab,
                    stat: '클릭 한 번',
                    title: '#귀신비서',
                    sub: '보안앱 재우기·PC 새것처럼',
                    accent: '#34D399',
                  },
                  {
                    key: 'search',
                    tab: 'video' as OnboardingWeaponTab,
                    stat: '1초 소환',
                    title: '#귀신검색',
                    sub: '열지 않고 본문·장면 소환',
                    accent: '#00F0B5',
                  },
                  {
                    key: 'window',
                    tab: 'superpower' as OnboardingWeaponTab,
                    stat: '1초면 끝',
                    title: '#귀신창',
                    sub: 'Ctrl+0 쓰던 자리 즉시 해결',
                    accent: '#FBBF24',
                  },
                  {
                    key: 'share',
                    tab: 'share' as OnboardingWeaponTab,
                    stat: '평생 0원',
                    title: '#사진공유',
                    sub: '가족·모임 원본 사진 모음',
                    accent: '#38BDF8',
                  },
                ].map((card) => {
                  const active =
                    card.key === 'search'
                      ? demoTab === 'video' || demoTab === 'doc'
                      : card.key === 'window'
                      ? demoTab === 'superpower'
                      : card.key === 'share'
                      ? demoTab === 'share'
                      : demoTab === 'clean';
                  return (
                    <button
                      key={card.key}
                      type="button"
                      onClick={() => handleSelectWeaponChip(card.tab, true)}
                      data-keep-dark="true"
                      style={{
                        backgroundColor: active ? 'rgba(0, 240, 181, 0.16)' : 'rgba(255, 255, 255, 0.06)',
                        borderColor: active ? card.accent : 'rgba(255, 255, 255, 0.14)',
                      }}
                      className="p-3 rounded-2xl border text-left transition-all hover:scale-[1.02] cursor-pointer group"
                    >
                      <div
                        style={{ color: card.accent }}
                        className="text-base sm:text-xl font-black tracking-tight leading-none mb-1"
                      >
                        {card.stat}
                      </div>
                      <div className="text-[13px] sm:text-sm font-black text-white">{card.title}</div>
                      <div className="text-xs text-zinc-300 font-semibold line-clamp-2 break-keep leading-snug mt-0.5">
                        {card.sub}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 우측 (5칸): 대표 3D 『아기귀신』 캐릭터 & 3D 네온 로고 쇼케이스 아트 */}
            <div className="lg:col-span-5 flex flex-col items-center">
              <div
                data-keep-dark="true"
                onClick={() => handleSelectWeaponChip('video', true)}
                style={{ backgroundColor: '#050914' }}
                className="relative w-full max-w-md rounded-2xl overflow-hidden border-2 border-[#00F0B5]/50 shadow-[0_0_40px_rgba(0,240,181,0.28)] cursor-pointer group"
              >
                <img
                  src="/gwisinkachi_hero_banner_neon_after.jpg"
                  alt="대표 3D 아기귀신 캐릭터와 귀신같이 입체 타이포그래피"
                  className="w-full h-auto object-cover animate-float-slow group-hover:scale-105 transition-transform duration-500"
                />
                {/* 은은한 레이저 스캔 효과 */}
                <div
                  data-keep-dark="true"
                  className="pointer-events-none absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-[#00F0B5]/80 to-transparent animate-scan-beam"
                />
                <div
                  data-keep-dark="true"
                  style={{ backgroundColor: 'rgba(5, 9, 20, 0.86)' }}
                  className="px-3.5 py-2.5 border-t border-white/15 flex items-center justify-between gap-2 text-[13px]"
                >
                  <span className="font-black text-[#00F0B5] flex items-center gap-1.5">
                    <span>👻</span>
                    <span>귀신비서 스탠바이!</span>
                  </span>
                  <span className="text-amber-300 font-extrabold whitespace-nowrap">
                    클릭해서 바로 체험 👇
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2단 분할 온보딩 그리드 (좌측 5 : 우측 7) */}
        <div id="interactive-demo" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* -----------------------------------------------------------------
              👈 좌측 (5칸): 친근한 『👻 귀신비서』 캐릭터 채팅창 (100% 안전 격리 복제본)
             ----------------------------------------------------------------- */}
          <aside className="lg:col-span-5 flex flex-col rounded-3xl border border-teal-500/35 bg-zinc-950/95 shadow-[0_20px_60px_rgba(0,0,0,0.65)] overflow-hidden">
            {/* 캐릭터 프로필 비주얼 헤더 */}
            <div
              data-keep-dark="true"
              style={{
                background: 'linear-gradient(135deg, #071923 0%, #0D2E33 100%)',
              }}
              className="px-4 py-3.5 border-b border-teal-400/30 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <img
                    src="/gwisinkachi_app_icon_512.png"
                    alt="귀신비서 프로필"
                    className="w-12 h-12 rounded-2xl object-cover border-2 border-[#00F0B5] shadow-[0_0_16px_rgba(0,240,181,0.4)] animate-float-slow"
                  />
                  <span
                    style={{ backgroundColor: '#00F0B5' }}
                    className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-slate-950"
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[15px] font-black text-white truncate">👻 귀신비서</span>
                    <span
                      style={{ backgroundColor: 'rgba(0, 240, 181, 0.2)', color: '#5EEAD4' }}
                      className="px-2 py-0.5 rounded-full text-xs font-black shrink-0"
                    >
                      평생 무료
                    </span>
                  </div>
                  <div className="text-[13px] text-teal-200 font-bold truncate mt-0.5">
                    🛡️ 서버 전송 0% 로컬 실행 · 휴지통 안전 복구
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCertModalOpen(true)}
                data-keep-dark="true"
                style={{ backgroundColor: '#FBBF24', color: '#020617' }}
                className="px-3 py-1.5 rounded-xl font-black text-xs shrink-0 cursor-pointer whitespace-nowrap shadow hover:opacity-90"
              >
                📜 무료 보증서
              </button>
            </div>

            {/* 대화 스트림 영역 (짧고 경쾌한 메신저 버블) */}
            <div
              ref={chatScrollRef}
              className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-[220px] max-h-[300px] bg-zinc-950/80"
            >
              {chatMessages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 px-1">
                      {isUser ? (
                        <>
                          <span className="text-xs text-zinc-500">{msg.timestamp}</span>
                          <span className="text-[13px] font-bold text-teal-300">나</span>
                        </>
                      ) : (
                        <>
                          <span className="text-[13px] font-extrabold text-[#00F0B5] flex items-center gap-1.5">
                            <img
                              src="/gwisinkachi_app_icon_512.png"
                              alt="귀신비서"
                              className="w-6 h-6 rounded-full object-cover shadow-sm border border-[#00F0B5]/60"
                            />
                            👻 귀신비서
                          </span>
                          <span className="text-xs text-zinc-500">{msg.timestamp}</span>
                        </>
                      )}
                    </div>
                    <div
                      data-keep-dark={isUser ? 'true' : undefined}
                      style={isUser ? { backgroundColor: '#0D9488', color: '#FFFFFF' } : undefined}
                      className={`max-w-[94%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-line shadow-sm break-keep ${
                        isUser
                          ? 'bg-teal-600 text-white rounded-tr-sm border border-teal-500 font-bold'
                          : 'bg-zinc-900 border border-white/10 text-zinc-100 rounded-tl-sm font-semibold'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 4대 무료 핵심 무기 스킬 카드 (클릭 시 우측 단일 스테이지 즉시 전환) */}
            <div className="p-3.5 bg-zinc-900/90 border-t border-white/10 space-y-2">
              <div className="text-[13px] font-extrabold text-teal-300 flex items-center justify-between px-1">
                <span>👇 보고 싶은 초능력 카드를 톡 눌러보세요!</span>
                <span className="text-zinc-400">우측 즉시 시연</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(['video', 'doc', 'clean', 'share', 'superpower'] as OnboardingWeaponTab[]).map((tabKey, chipIdx, arr) => {
                  const item = WEAPON_META[tabKey];
                  const isActive = demoTab === tabKey;
                  const isLastOdd = arr.length % 2 === 1 && chipIdx === arr.length - 1;
                  return (
                    <button
                      key={tabKey}
                      type="button"
                      onClick={() => handleSelectWeaponChip(tabKey)}
                      className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between gap-1 ${
                        isLastOdd ? 'col-span-2' : ''
                      } ${
                        isActive
                          ? 'bg-teal-950/80 border-[#00F0B5] shadow-[0_6px_20px_rgba(13,148,136,0.2)] scale-[1.01]'
                          : 'bg-zinc-950/80 hover:bg-zinc-900 border-white/10 hover:border-teal-400/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-base leading-none">{item.icon}</span>
                        <span
                          style={
                            isActive
                              ? { backgroundColor: '#0D9488', color: '#FFFFFF' }
                              : undefined
                          }
                          className={`px-2 py-0.5 rounded-md text-xs font-black shrink-0 ${
                            isActive ? '' : 'bg-white/10 text-zinc-300'
                          }`}
                        >
                          {item.keywordBadge}
                        </span>
                      </div>
                      <div className="text-[13.5px] font-black text-white line-clamp-2 break-keep leading-snug mt-0.5">
                        {item.chipLabel}
                      </div>
                      <div className="text-xs text-zinc-400 font-semibold line-clamp-2 break-keep leading-snug">
                        {item.chipSub}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 하단 대화 입력창 */}
            <form
              onSubmit={handleChatFormSubmit}
              className="px-3.5 py-3 border-t border-white/10 bg-zinc-950 flex items-center gap-2"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="궁금한 기능 입력 (예: 영상 점프, 영수증 찾기, 영타)"
                className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-zinc-900 border border-white/15 focus:border-[#00F0B5] text-[13px] sm:text-sm text-white placeholder-zinc-500 outline-none"
              />
              <button
                type="submit"
                style={{ backgroundColor: '#0D9488', color: '#FFFFFF' }}
                className="px-4 py-2 rounded-xl hover:opacity-90 font-black text-[13px] shrink-0 cursor-pointer"
              >
                전송
              </button>
            </form>
          </aside>

          {/* -----------------------------------------------------------------
              👉 우측 (7칸): 비주얼 인터랙티브 체험 스테이지 (실제 사진·프리뷰 탑재)
             ----------------------------------------------------------------- */}
          <div className="lg:col-span-7 flex flex-col justify-between rounded-3xl bg-gradient-to-b from-zinc-900/95 to-zinc-950/95 border-2 border-teal-500/40 px-6 py-12 sm:px-8 sm:py-14 lg:px-9 lg:py-16 shadow-[0_25px_70px_rgba(0,0,0,0.65)] space-y-7">
            {/* 스테이지 상단 헤더 */}
            <div className="flex flex-wrap items-center justify-between gap-3.5 pb-4 border-b border-white/10">
              <div>
                <span className="inline-block px-3 py-0.5 rounded-full bg-[#00F0B5]/20 text-[#00F0B5] text-[13px] font-black mb-1">
                  {activeMeta.stageBadge}
                </span>
                <h2 className="text-lg sm:text-2xl font-black text-white break-keep">
                  {activeMeta.stageTitle}
                </h2>
              </div>

              {activeMeta.shortVideoUrl && (
              <button
                type="button"
                onClick={() => setShowStageShortVideo((v) => !v)}
                style={
                  showStageShortVideo
                    ? { backgroundColor: '#0D9488', color: '#FFFFFF' }
                    : undefined
                }
                className={`px-3.5 py-2 rounded-xl text-[13px] font-black border transition-all cursor-pointer flex items-center gap-1.5 ${
                  showStageShortVideo
                    ? 'border-teal-600 shadow'
                    : 'bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 border-amber-400/40'
                }`}
              >
                <span>▶</span>
                <span>{showStageShortVideo ? '⚡ 체험 화면으로 돌아가기' : '🎥 15초 예고편 영상 보기'}</span>
              </button>
              )}
            </div>

            {/* 스테이지 본문: 15초 미리보기 비디오 뷰 또는 비주얼 인터랙티브 체험 */}
            {showStageShortVideo && activeMeta.shortVideoUrl ? (
              <div
                data-keep-dark="true"
                style={{ backgroundColor: '#070D19' }}
                className="rounded-2xl border border-teal-400/30 p-4 flex flex-col sm:flex-row items-center gap-5"
              >
                <div
                  data-keep-dark="true"
                  style={{ backgroundColor: '#000000' }}
                  className="w-52 sm:w-56 aspect-[9/16] rounded-xl overflow-hidden border border-white/20 shrink-0"
                >
                  <video
                    key={activeMeta.shortVideoUrl}
                    src={activeMeta.shortVideoUrl}
                    controls
                    autoPlay
                    playsInline
                    loop
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="space-y-3 text-left">
                  <span
                    style={{ backgroundColor: 'rgba(0, 240, 181, 0.18)', color: '#5EEAD4' }}
                    className="inline-block px-3 py-1 rounded-full text-[13px] font-black"
                  >
                    🎬 공식 15초 쇼츠 예고편 ({activeMeta.keywordBadge})
                  </span>
                  <h3 className="text-lg font-black text-white leading-snug break-keep">
                    {activeMeta.stageTitle}
                  </h3>
                  <p className="text-[13px] sm:text-sm text-zinc-300 leading-relaxed break-keep">
                    클라우드 업로드 0 Byte! 내 PC와 스마트폰 안에서 100% 무료로 즉시 작동합니다.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowStageShortVideo(false)}
                    style={{ backgroundColor: '#00F0B5', color: '#020617' }}
                    className="px-4 py-2.5 rounded-xl font-black text-[13px] cursor-pointer shadow-lg"
                  >
                    ⚡ 직접 버튼 눌러서 체험해 보기 ➔
                  </button>
                </div>
              </div>
            ) : (
              <div>
                {/* ① 동영상 장면 1초 점프 (#귀신검색) — 실제 프레임 썸네일 & 타임라인 스크러버 */}
                {demoTab === 'video' && (
                  <div className="space-y-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-extrabold text-zinc-400 mr-1">
                        🔍 찾을 장면 클릭:
                      </span>
                      {INTERACTIVE_SCENARIOS.video.map((item, idx) => {
                        const active = selectedVideoScenarioIdx === idx;
                        return (
                          <button
                            key={item.query}
                            type="button"
                            onClick={() => {
                              playBabyGhostChime();
                              setSelectedVideoScenarioIdx(idx);
                              setVideoOcrExtracted(false);
                            }}
                            style={
                              active
                                ? { backgroundColor: '#0D9488', color: '#FFFFFF' }
                                : undefined
                            }
                            className={`px-3.5 py-2 rounded-xl text-[13px] font-black border transition-all cursor-pointer ${
                              active
                                ? 'border-teal-600 shadow-md scale-[1.02]'
                                : 'bg-zinc-900 text-zinc-300 border-white/10 hover:border-teal-400/50'
                            }`}
                          >
                            “{item.query}”
                          </button>
                        );
                      })}
                    </div>

                    <div
                      data-keep-dark="true"
                      style={{
                        background: 'linear-gradient(145deg, #07131E 0%, #0B1F2A 100%)',
                      }}
                      className="rounded-2xl border border-teal-400/40 p-5 sm:p-7 shadow-lg space-y-4"
                    >
                      <div className="flex items-center justify-between gap-2 text-[13px] pb-2.5 border-b border-white/15">
                        <span className="font-sans tracking-normal text-teal-300 font-bold truncate">
                          🎬 {INTERACTIVE_SCENARIOS.video[selectedVideoScenarioIdx].file}
                        </span>
                        <span
                          style={{ backgroundColor: 'rgba(16, 185, 129, 0.22)', color: '#6EE7B7' }}
                          className="px-2.5 py-0.5 rounded-full font-black shrink-0"
                        >
                          ⚡ {INTERACTIVE_SCENARIOS.video[selectedVideoScenarioIdx].latency} 포착
                        </span>
                      </div>

                      {/* 비주얼 비디오 프레임 + 타임라인 바 */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                        <div
                          data-keep-dark="true"
                          className="sm:col-span-5 relative aspect-[16/10] rounded-xl overflow-hidden border-2 border-[#00F0B5] shadow-[0_0_20px_rgba(0,240,181,0.25)]"
                        >
                          <img
                            src={INTERACTIVE_SCENARIOS.video[selectedVideoScenarioIdx].thumbUrl}
                            alt={INTERACTIVE_SCENARIOS.video[selectedVideoScenarioIdx].query}
                            className="w-full h-full object-cover"
                          />
                          <div
                            data-keep-dark="true"
                            className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/30"
                          />
                          <span
                            style={{ backgroundColor: '#00F0B5', color: '#020617' }}
                            className="absolute top-2 left-2 px-2.5 py-0.5 rounded-md text-xs font-black shadow"
                          >
                            ▶ {INTERACTIVE_SCENARIOS.video[selectedVideoScenarioIdx].timestamp} 점프!
                          </span>
                          <img
                            src="/gwisinkachi_app_icon_512.png"
                            alt="아기귀신 포착"
                            className="absolute bottom-2 right-2 w-8 h-8 rounded-full border-2 border-[#00F0B5] shadow-lg"
                          />
                        </div>

                        <div className="sm:col-span-7 space-y-2.5">
                          <div
                            style={{ backgroundColor: 'rgba(255, 255, 255, 0.07)' }}
                            className="rounded-xl p-3.5 border border-white/15 space-y-1.5"
                          >
                            <div className="text-[13px] font-extrabold text-[#00F0B5]">
                              🗣️ 음성·대사 자동 매칭
                            </div>
                            <p className="text-white font-black text-sm sm:text-base leading-snug break-keep">
                              {INTERACTIVE_SCENARIOS.video[selectedVideoScenarioIdx].transcript}
                            </p>
                            <p className="text-[13px] text-zinc-300 font-semibold break-keep">
                              🎯 {INTERACTIVE_SCENARIOS.video[selectedVideoScenarioIdx].sceneDesc}
                            </p>
                          </div>

                          {/* 시각적 재생 타임라인 스크러버 */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs font-mono text-zinc-400">
                              <span>00:00</span>
                              <span style={{ color: '#00F0B5' }} className="font-black">
                                📍 {INTERACTIVE_SCENARIOS.video[selectedVideoScenarioIdx].timestamp} 하이라이트
                              </span>
                              <span>END</span>
                            </div>
                            <div
                              style={{ backgroundColor: 'rgba(255,255,255,0.14)' }}
                              className="relative h-2.5 rounded-full overflow-hidden"
                            >
                              <div
                                style={{
                                  width: `${INTERACTIVE_SCENARIOS.video[selectedVideoScenarioIdx].progressPct}%`,
                                  backgroundColor: '#00F0B5',
                                }}
                                className="h-full rounded-full transition-all duration-300"
                              />
                            </div>
                          </div>

                          {/* 👻 영상 속 화면 글자 발견! & [📝 글자 뽑기] 1초 텍스트 추출 체험 */}
                          <div
                            style={{ backgroundColor: 'rgba(13, 148, 136, 0.16)', border: 'none' }}
                            className="rounded-xl p-3 space-y-2 borderless-shape"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-1.5 text-[13px] font-black text-[#00F0B5]">
                                <span>👻 영상 속 화면 글자 발견!</span>
                                <span className="text-xs text-zinc-300 font-bold">(멈춰 적지 말고 1초 추출)</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  playBabyGhostChime();
                                  setVideoOcrExtracted((prev) => !prev);
                                }}
                                style={{
                                  backgroundColor: videoOcrExtracted ? '#00F0B5' : '#FBBF24',
                                  color: '#020617',
                                }}
                                className="px-3 py-1 rounded-lg text-xs font-black cursor-pointer shadow-sm transition-transform hover:scale-105 whitespace-nowrap shrink-0"
                              >
                                {videoOcrExtracted ? '✅ 화면 글자 1초 추출 완료!' : '📝 글자 뽑기'}
                              </button>
                            </div>
                            {videoOcrExtracted && (
                              <div
                                style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)', border: 'none' }}
                                className="rounded-lg p-2.5 font-code-kr text-[13px] text-emerald-200 space-y-1 borderless-shape"
                              >
                                {INTERACTIVE_SCENARIOS.video[selectedVideoScenarioIdx].screenOcrLines.map((ln, lIdx) => (
                                  <div key={lIdx}>{ln}</div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ② 엑셀·문서·영수증 안 열고 찾기 (#귀신검색) — 1초 소환 비주얼 카드 */}
                {demoTab === 'doc' && (
                  <div className="space-y-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-extrabold text-zinc-400 mr-1">
                        📄 닫힌 파일 속 찾을 키워드:
                      </span>
                      {INTERACTIVE_SCENARIOS.doc.map((item, idx) => {
                        const active = selectedDocScenarioIdx === idx;
                        return (
                          <button
                            key={item.query}
                            type="button"
                            onClick={() => {
                              playBabyGhostChime();
                              setSelectedDocScenarioIdx(idx);
                            }}
                            style={
                              active
                                ? { backgroundColor: '#0D9488', color: '#FFFFFF' }
                                : undefined
                            }
                            className={`px-3.5 py-2 rounded-xl text-[13px] font-black border transition-all cursor-pointer ${
                              active
                                ? 'border-teal-600 shadow-md scale-[1.02]'
                                : 'bg-zinc-900 text-zinc-300 border-white/10 hover:border-teal-400/50'
                            }`}
                          >
                            “{item.query}”
                          </button>
                        );
                      })}
                    </div>

                    <div
                      data-keep-dark="true"
                      style={{
                        background: 'linear-gradient(145deg, #081224 0%, #0C2130 100%)',
                      }}
                      className="rounded-2xl border border-teal-400/40 p-5 sm:p-7 shadow-lg space-y-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] pb-2.5 border-b border-white/15">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            style={{
                              backgroundColor: INTERACTIVE_SCENARIOS.doc[selectedDocScenarioIdx].badgeColor,
                              color: '#FFFFFF',
                            }}
                            className="px-2 py-0.5 rounded font-black text-xs shrink-0"
                          >
                            {INTERACTIVE_SCENARIOS.doc[selectedDocScenarioIdx].docType}
                          </span>
                          <span className="font-sans tracking-normal text-teal-200 font-bold truncate">
                            {INTERACTIVE_SCENARIOS.doc[selectedDocScenarioIdx].file}
                          </span>
                        </div>
                        <span
                          style={{ backgroundColor: 'rgba(16, 185, 129, 0.22)', color: '#6EE7B7' }}
                          className="px-2.5 py-0.5 rounded-full font-black shrink-0"
                        >
                          ⚡ {INTERACTIVE_SCENARIOS.doc[selectedDocScenarioIdx].latency}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                        {/* 좌측 닫힌 문서 내부 / 실물 영수증 미니 뷰 */}
                        <div
                          data-keep-dark="true"
                          style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
                          className="sm:col-span-4 rounded-xl border border-[#00F0B5]/40 p-3 flex flex-col items-center justify-center relative overflow-hidden min-h-[136px]"
                        >
                          {INTERACTIVE_SCENARIOS.doc[selectedDocScenarioIdx].thumbUrl ? (
                            <img
                              src={INTERACTIVE_SCENARIOS.doc[selectedDocScenarioIdx].thumbUrl}
                              alt="영수증 OCR 스캔"
                              className="w-full h-28 object-cover rounded-lg border border-white/20"
                            />
                          ) : (
                            <div className="w-full space-y-1.5 text-left font-sans tracking-normal text-xs">
                              <div className="flex items-center justify-between text-zinc-400">
                                <span>🔒 닫힌 파일 내부</span>
                                <span style={{ color: '#00F0B5' }}>⚡ 1초 소환</span>
                              </div>
                              <div
                                style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
                                className="p-2 rounded border border-white/10 text-zinc-400 truncate"
                              >
                                ── 상단 조항 생략 ──
                              </div>
                              <div
                                style={{ backgroundColor: 'rgba(251, 191, 36, 0.22)', color: '#FDE68A' }}
                                className="p-2 rounded border border-amber-400 font-black truncate"
                              >
                                🎯 {INTERACTIVE_SCENARIOS.doc[selectedDocScenarioIdx].highlightKey}
                              </div>
                            </div>
                          )}
                          <img
                            src="/gwisinkachi_app_icon_512.png"
                            alt="아기귀신 스캔"
                            className="absolute bottom-2 right-2 w-7 h-7 rounded-full border-2 border-amber-400 shadow"
                          />
                        </div>

                        {/* 우측 하이라이트 본문 발췌 */}
                        <div className="sm:col-span-8 space-y-2">
                          <span
                            style={{ backgroundColor: 'rgba(251, 191, 36, 0.2)', color: '#FCD34D' }}
                            className="inline-block px-3 py-1 rounded-lg text-[13px] font-black"
                          >
                            📍 {INTERACTIVE_SCENARIOS.doc[selectedDocScenarioIdx].location}
                          </span>
                          <p
                            style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)' }}
                            className="text-white font-bold text-[13.5px] sm:text-sm leading-relaxed p-3.5 rounded-xl border border-white/15 break-keep"
                          >
                            {INTERACTIVE_SCENARIOS.doc[selectedDocScenarioIdx].previewSnippet}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ③ #귀신비서 샘플 체험 — [⚡ 느려진 PC 살리기(샘플 PC)] + [📸 사진 정리·휴지통 복원] 2단 하위 탭 */}
                {demoTab === 'clean' && (
                  <div className="space-y-4">
                    {/* 하위 탭 스위처 */}
                    <div className="flex flex-wrap items-center gap-2">
                      {(
                        [
                          { key: 'speed' as const, label: '⚡ 느려진 PC 살리기' },
                          { key: 'photo' as const, label: '📸 사진 정리·휴지통 복원' },
                        ]
                      ).map((st) => {
                        const on = cleanSubTab === st.key;
                        return (
                          <button
                            key={st.key}
                            type="button"
                            onClick={() => {
                              playBabyGhostChime();
                              setCleanSubTab(st.key);
                            }}
                            style={on ? { backgroundColor: '#0D9488', color: '#FFFFFF' } : undefined}
                            className={`px-4 py-2 rounded-xl text-[13px] font-black border transition-all cursor-pointer ${
                              on ? 'border-teal-600 shadow-md' : 'bg-zinc-900 text-zinc-300 border-white/10 hover:border-teal-400/50'
                            }`}
                          >
                            {st.label}
                          </button>
                        );
                      })}
                      <span className="text-xs text-zinc-500 font-bold ml-auto">※ 샘플 화면 체험 (내 PC는 건드리지 않아요)</span>
                    </div>

                    {/* ⚡ 샘플 PC 살려보기 (진단 → 안 지우고 재우기 → 은행 접속 시 필요한 것만 기상 → 1초 원상복구) */}
                    {cleanSubTab === 'speed' && (() => {
                      const total = SAMPLE_PC_PROGRAMS.length;
                      const neededCount = SAMPLE_PC_PROGRAMS.filter((p) => p.neededForBank).length;
                      const totalMemGb = (SAMPLE_PC_PROGRAMS.reduce((s, p) => s + p.memMb, 0) / 1024).toFixed(1);
                      const isAsleep = (p: SamplePcProgram, idx: number) => {
                        if (speedStep === 2) return idx < sleptCount;
                        if (speedStep === 3) return !p.neededForBank;
                        return false;
                      };
                      const sleepingNow = SAMPLE_PC_PROGRAMS.filter((p, i) => isAsleep(p, i)).length;
                      const gaugePct =
                        speedStep === 0
                          ? null
                          : Math.round(SAMPLE_PC_BASE_PCT + ((SAMPLE_PC_REVIVED_PCT - SAMPLE_PC_BASE_PCT) * sleepingNow) / total);
                      const deletedCount = 0;
                      const stepMsg =
                        speedStep === 0
                          ? '👇 먼저 [🔍 1초 진단]을 눌러 샘플 PC를 누가 느리게 만드는지 확인해 보세요.'
                          : speedStep === 1
                          ? `은행·결제 때 한 번 쓰고 마는 보안프로그램 ${total}개가 늘 켜져서 메모리 ${totalMemGb}GB를 차지하고 있어요. 지우지 말고 재워볼까요?`
                          : speedStep === 2
                          ? sleptCount < total
                            ? '💤 하나씩 재우는 중… 프로그램 파일은 그대로 두고 잠만 재워요.'
                            : `💤 ${total}개 모두 재웠어요! 지운 건 하나도 없어요. 은행 갈 땐 어떻게 될까요?`
                          : speedStep === 3
                          ? `🏦 은행 사이트를 여니 꼭 필요한 ${neededCount}개만 1초 만에 저절로 깨어났어요. 나머지는 계속 쿨쿨~`
                          : '↩️ 전부 처음 상태 그대로 되돌렸어요. 이렇게 언제든 1초 만에 원래대로 돌릴 수 있어요!';
                      return (
                        <div
                          data-keep-dark="true"
                          style={{ background: 'linear-gradient(145deg, #07131E 0%, #0B1F2A 100%)' }}
                          className="rounded-2xl border border-teal-400/40 p-5 sm:p-6 space-y-4"
                        >
                          {/* 샘플 PC 라벨 + 속도 게이지 */}
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="space-y-0.5">
                              <div className="text-[13px] font-black text-teal-200">🖥️ 샘플 PC · 사무실 4년 차 노트북</div>
                              <div className="text-xs text-zinc-400 font-semibold break-keep">
                                진짜 내 PC 진단은 『👻 귀신비서』 방에서 『내 컴퓨터 연결』 후 1초 만에 해드려요
                              </div>
                            </div>
                            <div className="min-w-[180px] flex-1 max-w-[260px] space-y-1">
                              <div className="flex items-center justify-between text-xs font-black">
                                <span className="text-zinc-300">원래 속도 대비</span>
                                <span
                                  style={{
                                    color:
                                      gaugePct === null ? '#A1A1AA' : gaugePct >= 85 ? '#34D399' : gaugePct >= 75 ? '#FBBF24' : '#F87171',
                                  }}
                                >
                                  {gaugePct === null ? '진단 전' : `${gaugePct}%`}
                                </span>
                              </div>
                              <div style={{ backgroundColor: 'rgba(255,255,255,0.14)' }} className="h-2.5 rounded-full overflow-hidden">
                                <div
                                  style={{
                                    width: `${gaugePct ?? 0}%`,
                                    backgroundColor: gaugePct !== null && gaugePct >= 85 ? '#34D399' : gaugePct !== null && gaugePct >= 75 ? '#FBBF24' : '#F87171',
                                  }}
                                  className="h-full rounded-full transition-all duration-300"
                                />
                              </div>
                            </div>
                          </div>

                          {/* 프로그램 목록 (진단 후 노출) */}
                          {speedStep > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {SAMPLE_PC_PROGRAMS.map((p, idx) => {
                                const asleep = isAsleep(p, idx);
                                const wokeForBank = speedStep === 3 && p.neededForBank;
                                return (
                                  <div
                                    key={p.id}
                                    style={{
                                      backgroundColor: asleep ? 'rgba(255,255,255,0.03)' : wokeForBank ? 'rgba(0,240,181,0.12)' : 'rgba(248,113,113,0.10)',
                                    }}
                                    className={`rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-[13px] border transition-all duration-300 ${
                                      asleep ? 'border-white/10 opacity-60' : wokeForBank ? 'border-[#00F0B5]/60' : 'border-rose-400/30'
                                    }`}
                                  >
                                    <span className="font-bold text-zinc-100 truncate">
                                      {asleep ? '💤' : wokeForBank ? '⚡' : '🔥'} {p.name}
                                    </span>
                                    <span className={`text-xs font-black shrink-0 ${asleep ? 'text-zinc-500' : wokeForBank ? 'text-[#00F0B5]' : 'text-rose-300'}`}>
                                      {asleep ? '수면 중' : wokeForBank ? '은행용 기상' : `${p.memMb}MB 상주`}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* 아기귀신 안내 1줄 */}
                          <div
                            style={{ backgroundColor: 'rgba(13,148,136,0.16)' }}
                            className="rounded-xl px-4 py-3 text-[13px] text-zinc-100 font-bold leading-relaxed break-keep flex items-start gap-2.5"
                          >
                            <img src="/gwisinkachi_app_icon_512.png" alt="아기귀신" className="w-7 h-7 rounded-full object-cover shrink-0" />
                            <span>{stepMsg}</span>
                          </div>

                          {/* 4단계 버튼 */}
                          <div className="flex flex-wrap items-center gap-2">
                            {[
                              { label: '🔍 1초 진단', onClick: runSpeedDiagnose, enabled: true, active: speedStep === 0 || speedStep === 4 },
                              { label: '💤 안 지우고 재우기', onClick: runSpeedSleep, enabled: speedStep >= 1, active: speedStep === 1 },
                              { label: '🏦 은행 사이트 열어보기', onClick: runSpeedBankOpen, enabled: speedStep >= 2, active: speedStep === 2 && sleptCount >= total },
                              { label: '↩️ 전부 원래대로', onClick: runSpeedRestore, enabled: speedStep >= 2 && speedStep !== 4, active: speedStep === 3 },
                            ].map((b) => (
                              <button
                                key={b.label}
                                type="button"
                                disabled={!b.enabled}
                                onClick={b.onClick}
                                style={
                                  !b.enabled
                                    ? { backgroundColor: 'rgba(255,255,255,0.03)', color: '#52525B' }
                                    : b.active
                                    ? { backgroundColor: '#00F0B5', color: '#020617' }
                                    : { backgroundColor: 'rgba(255,255,255,0.07)', color: '#E4E4E7' }
                                }
                                className={`px-3.5 py-2 rounded-xl text-[13px] font-black border transition-all ${
                                  !b.enabled
                                    ? 'border-white/5 cursor-not-allowed'
                                    : b.active
                                    ? 'border-[#00F0B5] shadow-[0_0_14px_rgba(0,240,181,0.35)] cursor-pointer animate-pulse'
                                    : 'border-white/15 hover:border-teal-400/50 cursor-pointer'
                                }`}
                              >
                                {b.label}
                              </button>
                            ))}
                          </div>

                          {/* 상시 안심 고정 문구 */}
                          <div className="flex flex-wrap gap-2 text-xs font-extrabold">
                            <span className="px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-200 border border-emerald-400/30">
                              🔒 지운 프로그램 {deletedCount}개 · 1초 원상복구
                            </span>
                            <span className="px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-200 border border-emerald-400/30">
                              ✋ 마음대로 지우지 않고 내가 고른 것만
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    {cleanSubTab === 'photo' && (
                  <div className="rounded-2xl bg-zinc-950 border border-teal-500/40 p-6 sm:p-7 space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <h4 className="text-[15px] sm:text-base font-black text-white break-keep">
                          📸 연속 촬영 6장 중 가장 선명한 『인생샷 1장』만 1초 Pick!
                        </h4>
                        <p className="text-[13px] text-zinc-400 leading-relaxed break-keep">
                          흔들린 5장은 <b>Windows 정식 휴지통</b>으로 안전 격리(1초 복원)됩니다.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          playBabyGhostChime();
                          setCleanDemoDone(!cleanDemoDone);
                        }}
                        style={
                          cleanDemoDone
                            ? { backgroundColor: '#FBBF24', color: '#020617' }
                            : { backgroundColor: '#0D9488', color: '#FFFFFF' }
                        }
                        className="px-4 py-2.5 rounded-xl font-black text-[13px] transition-all cursor-pointer shrink-0 shadow-md hover:opacity-95"
                      >
                        {cleanDemoDone ? '↩️ 휴지통에서 1초 복원' : '✨ 베스트 1장만 남기고 정리 체험'}
                      </button>
                    </div>

                    {/* 실제 샘플 사진 6장 비교 그리드 */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                      {[
                        {
                          id: 1,
                          label: '연사 #1 · 흔들림',
                          img: '/sample_photos_301/BLUR_202510_1282_흔들린사진.jpg',
                          imgClass: '',
                          best: false,
                        },
                        {
                          id: 2,
                          label: '연사 #2 · 어두움',
                          img: '/sample_photos_301/IMG_20250510_1001.jpg',
                          imgClass: 'brightness-50 contrast-75',
                          best: false,
                        },
                        {
                          id: 3,
                          label: '👑 베스트 인생샷!',
                          img: '/sample_photos_301/IMG_20250510_1002.jpg',
                          imgClass: 'brightness-105 saturate-125',
                          best: true,
                        },
                        {
                          id: 4,
                          label: '연사 #4 · 초점 나감',
                          img: '/sample_photos_301/BLUR_202510_1283_흔들린사진.jpg',
                          imgClass: '',
                          best: false,
                        },
                        {
                          id: 5,
                          label: '연사 #5 · 구도 흔들림',
                          img: '/sample_photos_301/IMG_20250510_1003.jpg',
                          imgClass: 'blur-[2px] scale-105',
                          best: false,
                        },
                        {
                          id: 6,
                          label: '연사 #6 · 빛 번짐',
                          img: '/sample_photos_301/BLUR_202510_1282_흔들린사진.jpg',
                          imgClass: 'brightness-125',
                          best: false,
                        },
                      ].map((shot) => {
                        const isMovedToTrash = cleanDemoDone && !shot.best;
                        return (
                          <div
                            key={shot.id}
                            data-keep-dark="true"
                            style={{ backgroundColor: '#09111E' }}
                            className={`relative rounded-xl overflow-hidden border-2 transition-all duration-300 ${
                              shot.best
                                ? 'border-[#00F0B5] shadow-[0_0_20px_rgba(0,240,181,0.35)] ring-2 ring-[#00F0B5]/40 scale-[1.02]'
                                : isMovedToTrash
                                ? 'border-white/10 opacity-35 scale-95 grayscale'
                                : 'border-white/15'
                            }`}
                          >
                            <div className="aspect-[16/10] w-full overflow-hidden">
                              <img
                                src={shot.img}
                                alt={shot.label}
                                className={`w-full h-full object-cover transition-all ${shot.imgClass}`}
                              />
                            </div>
                            <div
                              data-keep-dark="true"
                              style={{
                                backgroundColor: shot.best
                                  ? 'rgba(6, 78, 59, 0.92)'
                                  : 'rgba(9, 17, 30, 0.88)',
                              }}
                              className="px-2.5 py-1.5 flex items-center justify-between gap-1 text-xs"
                            >
                              <span
                                style={{ color: shot.best ? '#5EEAD4' : '#E2E8F0' }}
                                className="font-black truncate"
                              >
                                {isMovedToTrash ? '🗑️ 휴지통 안전 격리' : shot.label}
                              </span>
                              {shot.best && (
                                <span
                                  style={{ backgroundColor: '#00F0B5', color: '#020617' }}
                                  className="px-1.5 py-0.5 rounded text-xs font-black shrink-0"
                                >
                                  보존
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* 상시 안심 고정 문구 (사진 정리) */}
                    <div className="flex flex-wrap gap-2 text-xs font-extrabold">
                      <span className="px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-200 border border-emerald-400/30">
                        🗑️ 바로 지우지 않고 Windows 휴지통으로
                      </span>
                      <span className="px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-200 border border-emerald-400/30">
                        ↩️ 언제든 1초 복원
                      </span>
                      <span className="px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-200 border border-emerald-400/30">
                        ✋ 내가 확인한 것만 정리
                      </span>
                    </div>
                  </div>
                    )}
                  </div>
                )}

                {/* ⑤ #사진공유 샘플 체험 — 카톡 만료 공감 → 초대 링크로 샘플 가족방 입장 → 원본 그대로 받기 비교 → 올리기는 앱에서 */}
                {demoTab === 'share' && (() => {
                  const group = SAMPLE_FAMILY_GROUPS.find((g) => g.key === shareGroupKey) || SAMPLE_FAMILY_GROUPS[0];
                  const katalkSample = SAMPLE_FAMILY_PHOTOS.slice(9, 12);
                  return (
                    <div
                      data-keep-dark="true"
                      style={{ background: 'linear-gradient(145deg, #071523 0%, #0B1D2E 100%)' }}
                      className="rounded-2xl border border-sky-400/40 p-5 sm:p-6 space-y-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-[13px] font-black text-sky-200">🏠 샘플 가족방 · 우리집 패밀리 앨범 (실제 가족 여행 사진 36장)</div>
                        <span className="text-xs text-zinc-500 font-bold">※ 샘플 화면 체험 (가입 없이 구경)</span>
                      </div>

                      {/* STEP 0: 카톡 만료 공감 */}
                      {shareStep === 0 && (
                        <div className="space-y-3">
                          <div
                            style={{ backgroundColor: '#B2C7D9' }}
                            data-keep-dark="true"
                            className="rounded-2xl p-4 space-y-2.5"
                          >
                            <div className="text-xs font-black text-slate-700">💬 가족 단톡방 · 32일 전에 올린 여행 사진</div>
                            <div className="grid grid-cols-3 gap-2">
                              {katalkSample.map((p) => (
                                <div key={p} className="relative aspect-square rounded-lg overflow-hidden bg-slate-300">
                                  <img
                                    src={`${SAMPLE_FAMILY_THUMB_BASE}${p}`}
                                    alt="만료된 사진"
                                    className="w-full h-full object-cover blur-md grayscale opacity-60"
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center p-1.5 text-center">
                                    <span className="text-[11px] font-black text-slate-800 bg-white/85 rounded px-1.5 py-0.5 leading-tight break-keep">
                                      보관 기간이 만료된 사진
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="text-xs font-bold text-slate-700 break-keep">
                              😢 겨우 받은 사진도 화질 압축 (원본 4.8MB → 0.4MB)
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              playBabyGhostChime();
                              setShareStep(1);
                            }}
                            data-keep-dark="true"
                            style={{ backgroundColor: '#38BDF8', color: '#020617' }}
                            className="w-full px-4 py-3 rounded-xl font-black text-sm cursor-pointer shadow-lg hover:opacity-90 animate-pulse"
                          >
                            🔗 엄마가 보낸 귀신같이 가족방 초대 링크 눌러보기
                          </button>
                        </div>
                      )}

                      {/* STEP 1~2: 샘플 가족방 입장 */}
                      {shareStep >= 1 && (
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            {SAMPLE_FAMILY_GROUPS.map((g) => {
                              const on = g.key === shareGroupKey;
                              return (
                                <button
                                  key={g.key}
                                  type="button"
                                  onClick={() => {
                                    playBabyGhostChime();
                                    setShareGroupKey(g.key);
                                    setSharePickedPhoto(null);
                                    setShareStep(1);
                                  }}
                                  style={
                                    on
                                      ? { backgroundColor: '#0EA5E9', color: '#FFFFFF' }
                                      : { backgroundColor: 'rgba(255,255,255,0.06)', color: '#CBD5E1' }
                                  }
                                  className={`px-3.5 py-1.5 rounded-xl text-[13px] font-black border transition-all cursor-pointer break-keep ${
                                    on ? 'border-sky-400 shadow-md' : 'border-white/15 hover:border-sky-400/50'
                                  }`}
                                >
                                  {g.label} ({g.photos.length}장)
                                </button>
                              );
                            })}
                          </div>

                          {shareStep === 1 && (
                            <>
                              <div className="text-[13px] font-bold text-sky-100 break-keep">
                                👇 가입 없이 바로 열렸어요! 마음에 드는 사진을 하나 눌러보세요.
                              </div>
                              <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 max-h-[260px] overflow-y-auto pr-1">
                                {group.photos.map((p) => (
                                  <button
                                    key={p}
                                    type="button"
                                    onClick={() => {
                                      playBabyGhostChime();
                                      setSharePickedPhoto(p);
                                      setShareStep(2);
                                    }}
                                    className="relative aspect-square rounded-lg overflow-hidden border border-white/10 hover:border-sky-400 hover:scale-[1.03] transition-all cursor-pointer"
                                  >
                                    <img
                                      src={`${SAMPLE_FAMILY_THUMB_BASE}${p}`}
                                      alt="샘플 가족 사진"
                                      loading="lazy"
                                      className="w-full h-full object-cover"
                                    />
                                  </button>
                                ))}
                              </div>
                            </>
                          )}

                          {shareStep === 2 && sharePickedPhoto && (
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-start">
                              <div className="sm:col-span-5 space-y-2">
                                <div className="relative rounded-xl overflow-hidden border-2 border-sky-400">
                                  <img
                                    src={`${SAMPLE_FAMILY_THUMB_BASE}${sharePickedPhoto}`}
                                    alt="선택한 샘플 사진"
                                    className="w-full h-auto object-cover"
                                  />
                                  <span
                                    style={{ backgroundColor: '#38BDF8', color: '#020617' }}
                                    className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-xs font-black"
                                  >
                                    ✨ 원본 그대로
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    playBabyGhostChime();
                                    setSharePickedPhoto(null);
                                    setShareStep(1);
                                  }}
                                  className="text-xs text-zinc-400 hover:text-white underline font-bold cursor-pointer"
                                >
                                  ← 다른 사진 고르기
                                </button>
                              </div>
                              <div className="sm:col-span-7 space-y-2.5">
                                <div className="grid grid-cols-2 gap-2 text-[12.5px] sm:text-[13px] break-keep">
                                  <div style={{ backgroundColor: 'rgba(244,63,94,0.10)' }} className="rounded-xl p-3 border border-rose-400/30 space-y-1">
                                    <div className="font-black text-rose-300">💬 카톡 단톡방</div>
                                    <div className="text-zinc-300 font-semibold leading-relaxed">
                                      화질 압축
                                      <br />
                                      30일 지나면 만료
                                      <br />
                                      지난 사진 찾기 어려움
                                    </div>
                                  </div>
                                  <div style={{ backgroundColor: 'rgba(14,165,233,0.10)' }} className="rounded-xl p-3 border border-sky-400/40 space-y-1">
                                    <div className="font-black text-sky-300">👻 귀신같이 가족방</div>
                                    <div className="text-zinc-100 font-bold leading-relaxed">
                                      원본 화질 그대로
                                      <br />
                                      만료 없이 평생
                                      <br />
                                      날짜별 자동 정리 · 0원
                                    </div>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    playBabyGhostChime();
                                    setShareUploadHint(true);
                                  }}
                                  data-keep-dark="true"
                                  style={{ backgroundColor: '#38BDF8', color: '#020617' }}
                                  className="w-full px-4 py-2.5 rounded-xl font-black text-[13px] cursor-pointer hover:opacity-90"
                                >
                                  📸 내 사진도 이 방에 올려보기
                                </button>
                                {shareUploadHint && (
                                  <div
                                    style={{ backgroundColor: 'rgba(14,165,233,0.14)' }}
                                    className="rounded-xl px-3.5 py-3 text-[13px] text-sky-100 font-bold leading-relaxed break-keep space-y-2"
                                  >
                                    <div>
                                      👻 사진 올리기는 귀신같이 앱에서 해요! 내 폰·PC에서 가족 기기로 직접 전달돼 클라우드 서버에 쌓이지 않아요.
                                    </div>
                                    {!isLaunched && (
                                      <button
                                        type="button"
                                        onClick={scrollToEmailBox}
                                        className="text-[#00F0B5] underline font-black cursor-pointer"
                                      >
                                        🔔 출시되면 가족방 바로 만들 수 있게 알림받기 ➔
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 상시 안심 고정 문구 */}
                      <div className="flex flex-wrap gap-2 text-xs font-extrabold">
                        <span className="px-3 py-1.5 rounded-xl bg-sky-500/15 text-sky-200 border border-sky-400/30">
                          🔒 클라우드 서버에 안 올라가요
                        </span>
                        <span className="px-3 py-1.5 rounded-xl bg-sky-500/15 text-sky-200 border border-sky-400/30">
                          👨‍👩‍👧 초대받은 사람만
                        </span>
                        <span className="px-3 py-1.5 rounded-xl bg-sky-500/15 text-sky-200 border border-sky-400/30">
                          📷 개인 사진·영상 전용
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* ④ 귀신창 v1.4 — 100% 무버튼 완전 자동(Auto) 한영 성형 & 평생 무료 5총사 체험 */}
                {demoTab === 'superpower' && (
                  <div className="rounded-2xl bg-zinc-950 border border-amber-400/40 p-6 sm:p-7 space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-[13px] font-bold text-zinc-300 leading-relaxed break-keep">
                        ⌨️ <strong className="text-amber-300">수동 버튼 ZERO!</strong> 방금 저절로 한글로 바뀐 예시를 보신 뒤, 아래 칸에 직접 영타를 치고 스페이스바만 눌러보세요:
                      </span>
                      <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-xs font-black text-emerald-300 whitespace-nowrap shrink-0">
                        ⚡ 1초 무버튼 자동 변환 가동 중
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {TYPO_SAMPLES.map((sample, sIdx) => {
                        const isSelectedSample = typoSampleIdx === sIdx && typoIsPresetSample;
                        return (
                          <button
                            key={sIdx}
                            type="button"
                            onClick={() => triggerTypoAutoIron(sample.raw, sIdx)}
                            className={`px-3 py-1.5 rounded-xl text-[13px] font-extrabold border transition-all cursor-pointer ${
                              isSelectedSample
                                ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.35)]'
                                : 'bg-zinc-900 hover:bg-amber-400 hover:text-slate-950 text-zinc-200 border-white/15'
                            }`}
                          >
                            {sample.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Before ➔ After 한눈에 비교하는 상시 프리뷰 배너 (테두리 제거 · 도형 블록 + 필 하단 배치 + 본문 서체 통일 + 넉넉한 상하좌우 여백) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-3xl bg-zinc-900/60 borderless-shape p-4 sm:p-5 text-[13px]">
                      <div
                        style={{ backgroundColor: 'rgba(244, 63, 94, 0.11)', border: 'none' }}
                        className="rounded-2xl borderless-shape p-5 sm:p-6 space-y-3 relative overflow-hidden"
                      >
                        <div className="flex flex-col items-start gap-1.5">
                          <span className="font-display-kr text-lg sm:text-[19px] leading-snug font-extrabold text-rose-300">
                            Before · 영타 원문
                          </span>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-rose-500/15 text-xs text-rose-300 font-bold whitespace-nowrap">
                            한영키 실수
                          </span>
                        </div>
                        <p className="font-sans text-zinc-200 font-bold whitespace-pre-line leading-relaxed tracking-normal break-keep text-sm sm:text-[14.5px]">
                          {typoOriginalBackup || TYPO_SAMPLES[typoSampleIdx].raw}
                        </p>
                      </div>
                      <div
                        style={{ backgroundColor: 'rgba(16, 185, 129, 0.14)', border: 'none' }}
                        className="rounded-2xl borderless-shape p-5 sm:p-6 space-y-3 relative overflow-hidden"
                      >
                        <img
                          src="/gwisinkachi_app_icon_512.png"
                          alt=""
                          aria-hidden="true"
                          style={{ width: '34px', height: '34px' }}
                          className="w-[34px] h-[34px] rounded-full object-cover absolute right-2.5 bottom-2.5 opacity-80 shadow-sm pointer-events-none select-none"
                        />
                        <div className="flex flex-col items-start gap-1.5">
                          <span className="font-display-kr text-lg sm:text-[19px] leading-snug font-extrabold text-[#00F0B5]">
                            After · 1초 자동 변환
                          </span>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-xs text-[#00F0B5] font-bold whitespace-nowrap">
                            ✨ 스페이스바 즉시
                          </span>
                        </div>
                        <p className="font-sans text-emerald-100 font-bold whitespace-pre-line leading-relaxed tracking-normal break-keep text-sm sm:text-[14.5px] pr-9">
                          {formatTypoAfterPreview(typoOriginalBackup || TYPO_SAMPLES[typoSampleIdx].raw)}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between px-1 text-[13px]">
                        <span className="font-display-kr text-amber-300 text-[13.5px] sm:text-sm">
                          👇 직접 테스트 입력칸 {typoIsPresetSample ? '(방금 자동 변환 시연 완료! 클릭하면 바로 직접 쳐보실 수 있어요)' : '(영타 입력 후 스페이스바를 탁 눌러보세요!)'}
                        </span>
                        {!typoIsPresetSample && typoInput && (
                          <button
                            type="button"
                            onClick={() => {
                              setTypoInput('');
                              setTypoConverted(false);
                            }}
                            className="text-zinc-400 hover:text-white underline font-bold cursor-pointer whitespace-nowrap shrink-0"
                          >
                            비우기
                          </button>
                        )}
                      </div>
                      <textarea
                        value={typoInput}
                        onFocus={handleTypoTextareaFocus}
                        onChange={(e) => handleTypoInputChange(e.target.value)}
                        rows={2}
                        placeholder="직접 영타를 치고 스페이스바를 눌러보세요! (예: dkssudgktpdy ␣ 또는 gksrmf xptmxm ␣)"
                        style={{
                          border: 'none',
                          backgroundColor: typoConverted ? 'rgba(16, 185, 129, 0.16)' : 'rgba(245, 158, 11, 0.10)',
                        }}
                        className={`w-full rounded-2xl p-4 text-sm sm:text-[15px] font-sans font-bold leading-relaxed tracking-normal transition-all outline-none borderless-shape shadow-inner ${
                          typoConverted
                            ? 'text-emerald-100 shadow-[0_6px_20px_rgba(16,185,129,0.12)]'
                            : 'text-white placeholder-zinc-500'
                        }`}
                      />
                    </div>

                    {/* 확정 기준점 한 줄 핵심 요약 안내 (테두리 없는 도형 캡슐 + 아기귀신 미니 일러스트 + 단일 서체·단일 색상 통일) */}
                    <div
                      style={{ backgroundColor: 'rgba(20, 184, 166, 0.12)', border: 'none' }}
                      className="rounded-2xl borderless-shape px-5 py-3.5 font-sans tracking-normal text-[13px] text-zinc-100 font-bold leading-relaxed break-keep flex items-center gap-3"
                    >
                      <img
                        src="/gwisinkachi_app_icon_512.png"
                        alt="아기귀신"
                        style={{ width: '30px', height: '30px', minWidth: '30px' }}
                        className="w-[30px] h-[30px] rounded-full object-cover shrink-0 shadow-sm"
                      />
                      <div className="font-sans tracking-normal text-[13px] text-zinc-100 font-bold leading-relaxed break-keep">
                        🛡️ 모를 땐 그냥 Ctrl + 0(또는 Ctrl + 우클릭) 하나만 누르세요! 평소 복붙(Ctrl+C/V)은 원문 서식을 100% 보존하고, 줄바꿈 다림질은 눈앞에 뜬 버튼을 찍을 때만 작동합니다.
                      </div>
                    </div>

                    {/* 귀신창 v2.1 표준 하단 미니 툴바 (일반 유저: 단축키 숫자 나열 없이 100% 직관 결과어 5총사 / DEV 전체보기 ON 시 유료 확장 [2]·[3]·[5] 표시) */}
                    <div className="rounded-2xl bg-zinc-900/95 border border-white/15 p-4 sm:p-5 space-y-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="귀신창 평생 무료 5총사 설명">
                          {(
                            [
                              { key: 'auto' as FreeOrDevToolbarKey, label: '⚡ 무버튼 한영·띄어쓰기' },
                              { key: 'seq' as FreeOrDevToolbarKey, label: '📋 Ctrl+V 순차·칸맞춤 복붙' },
                              { key: '1' as FreeOrDevToolbarKey, label: '🧹 서식·줄바꿈 다림질' },
                              { key: 'snip' as FreeOrDevToolbarKey, label: '⌨️ 자주 쓰는 문구 1초 입력' },
                              { key: 'zip' as FreeOrDevToolbarKey, label: '📦 더블클릭·우클릭 1초 압축' },
                              ...(isDevAuthorized && devFullView
                                ? ([
                                    { key: 'dev_2' as FreeOrDevToolbarKey, label: '[2] 스샷·PDF변환 🔒' },
                                    { key: 'dev_3' as FreeOrDevToolbarKey, label: '[3] 다중합본 🔒' },
                                    { key: 'dev_5' as FreeOrDevToolbarKey, label: '[5] 창고정 🔒' },
                                  ] as const)
                                : []),
                            ]
                          ).map((item) => {
                            const isSelected = selectedToolbarKey === item.key;
                            return (
                              <button
                                key={item.key}
                                type="button"
                                role="tab"
                                aria-selected={isSelected}
                                onClick={() => {
                                  playBabyGhostChime();
                                  setSelectedToolbarKey(item.key);
                                  if (item.key !== 'zip') setZipDemoApplied(false);
                                }}
                                className={`px-2.5 py-1.5 rounded-lg text-[13px] font-black transition-all cursor-pointer border whitespace-nowrap ${
                                  isSelected
                                    ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-[0_0_14px_rgba(251,191,36,0.35)] scale-[1.02]'
                                    : 'bg-zinc-950 hover:bg-zinc-800 border-white/15 text-zinc-200 hover:border-amber-400/50'
                                }`}
                              >
                                {item.label}
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex items-center gap-2">
                          {typoConverted && (
                            <span className="text-[13px] font-black text-[#00F0B5]">
                              ✨ 무버튼 1초 자동 변환 완료!
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={handleTypoUndo}
                            className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold cursor-pointer whitespace-nowrap"
                          >
                            ↩️ 원본 보기(Ctrl+Z)
                          </button>
                        </div>
                      </div>

                      {/* 선택된 평생 무료 기본기(및 DEV 유료 확장)의 상세 설명 + Before ➔ After 실물 예시 카드 */}
                      <div className="rounded-xl bg-zinc-950/95 border border-amber-400/35 p-4 sm:p-5 space-y-3 font-sans tracking-normal">
                        {selectedToolbarKey === 'auto' && (
                          <>
                            <div className="text-[13.5px] sm:text-sm font-black text-amber-300 break-keep">
                              ⚡ 무버튼 한영·띄어쓰기 변환 — 한영키 안 눌러도 1초 만에 자연스러운 한글로 자동 전환!
                            </div>
                            <p className="text-[13px] text-zinc-300 leading-relaxed font-semibold break-keep">
                              2어절 연속 영타 실수 시 스페이스바만 누르면 백스페이스 없이 즉시 한글로 고쳐주며, 이메일(<span className="text-white font-extrabold">@</span>)·웹주소(<span className="text-white font-extrabold">URL</span>)·영문 약어(<span className="text-white font-extrabold">PDF·AI·PC</span>)는 똑똑하게 원문 그대로 보호합니다.
                            </p>
                            <div className="grid grid-cols-1 gap-1.5 pt-0.5">
                              <div className="rounded-lg bg-zinc-900/90 border border-white/10 px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-[13px]">
                                <span className="text-zinc-400 font-bold break-keep">dkssudgktpdy 회의 PDF rkatkgkqslek</span>
                                <div className="flex items-center gap-1.5 font-sans font-bold tracking-normal text-[13px] shrink-0">
                                  <span className="text-amber-400">➔</span>
                                  <span className="text-[#00F0B5] font-extrabold">안녕하세요 회의 PDF 감사합니다 (평생 무료)</span>
                                </div>
                              </div>
                            </div>
                          </>
                        )}

                        {selectedToolbarKey === 'seq' && (
                          <>
                            <div className="text-[13.5px] sm:text-sm font-black text-amber-300 break-keep">
                              📋 Ctrl+V 순차붙여넣기 — 여러 줄 복사해 두고 Ctrl+V만 연타하면 순서대로 착착!
                            </div>
                            <p className="text-[13px] text-zinc-300 leading-relaxed font-semibold break-keep">
                              이름·연락처·주소를 차례대로 <span className="text-white font-extrabold">Ctrl+C</span> 해 두면 창을 왔다 갔다 할 필요 없이 입력칸마다 <span className="text-[#00F0B5] font-extrabold">Ctrl+V</span>만 눌러 순서대로 자동 입력합니다.
                            </p>
                            <div className="grid grid-cols-1 gap-1.5 pt-0.5">
                              <div className="rounded-lg bg-zinc-900/90 border border-white/10 px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-[13px]">
                                <span className="text-zinc-400 font-bold break-keep">홍길동 · 010-1234-5678 · 강남구 연속 복사</span>
                                <div className="flex items-center gap-1.5 font-sans font-bold tracking-normal text-[13px] shrink-0">
                                  <span className="text-amber-400">➔</span>
                                  <span className="text-[#00F0B5] font-extrabold">신청서 빈칸마다 Ctrl+V 3번으로 1초 입력 끝</span>
                                </div>
                              </div>
                            </div>
                          </>
                        )}

                        {selectedToolbarKey === '1' && (
                          <>
                            <div className="text-[13.5px] sm:text-sm font-black text-amber-300 break-keep">
                              🧹 서식·줄바꿈 다림질 — 평소 복붙은 원문 100% 보존, 원할 때만 버튼 한 번으로 1초 다림질!
                            </div>
                            <p className="text-[13px] text-zinc-300 leading-relaxed font-semibold break-keep">
                              일반 <span className="text-white font-extrabold">Ctrl+C ➔ Ctrl+V</span> 시에는 원문 줄바꿈과 서식을 그대로 지켜주고, PDF 깨진 줄바꿈이나 뉴스 광고 꼬리말을 펴고 싶을 때만 <span className="text-[#00F0B5] font-extrabold">Ctrl+0</span>으로 부른 뒤 다림질 버튼을 누르면 제자리에서 깔끔하게 정돈(<span className="text-amber-300 font-extrabold">Ctrl+Z</span> 원복 지원)합니다.
                            </p>
                            <div className="grid grid-cols-1 gap-1.5 pt-0.5">
                              <div className="rounded-lg bg-zinc-900/90 border border-white/10 px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-[13px]">
                                <span className="text-zinc-400 font-bold break-keep">PDF 끊어진 문단 · 시커먼 배경 서식 · 광고 꼬리말</span>
                                <div className="flex items-center gap-1.5 font-sans font-bold tracking-normal text-[13px] shrink-0">
                                  <span className="text-amber-400">➔</span>
                                  <span className="text-[#00F0B5] font-extrabold">클릭 한 번에 매끈한 순수 본문으로 1초 다림질</span>
                                </div>
                              </div>
                            </div>
                          </>
                        )}

                        {selectedToolbarKey === 'snip' && (
                          <>
                            <div className="text-[13.5px] sm:text-sm font-black text-amber-300 break-keep">
                              ⌨️ 자주 쓰는 문구 1초 입력 — 계좌번호·사업자번호·배송지 주소를 키 한 번으로 자동 입력!
                            </div>
                            <p className="text-[13px] text-zinc-300 leading-relaxed font-semibold break-keep">
                              매일 똑같이 타이핑하는 계좌번호·이메일·단골 인사말을 한 번만 등록해 두면 메신저나 문서 어디서든 <span className="text-[#00F0B5] font-extrabold">단축키 한 번</span>으로 오타 없이 즉시 입력됩니다.
                            </p>
                            <div className="grid grid-cols-1 gap-1.5 pt-0.5">
                              <div className="rounded-lg bg-zinc-900/90 border border-white/10 px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-[13px]">
                                <span className="text-zinc-400 font-bold break-keep">입금 계좌 · 회사 주소 · 고객 안내 멘트</span>
                                <div className="flex items-center gap-1.5 font-sans font-bold tracking-normal text-[13px] shrink-0">
                                  <span className="text-amber-400">➔</span>
                                  <span className="text-[#00F0B5] font-extrabold">키 한 번으로 1초 무오타 자동 입력 (평생 무료)</span>
                                </div>
                              </div>
                            </div>
                          </>
                        )}

                        {selectedToolbarKey === 'zip' && (
                          <>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="text-[13.5px] sm:text-sm font-black text-amber-300 break-keep">
                                📦 [꿀팁] 더블클릭·우클릭 1초 스마트 압축 — 상업광고 0% · 깨진 한글 이름표 자동 복원!
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  playBabyGhostChime();
                                  setZipDemoApplied((prev) => !prev);
                                }}
                                className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                                  zipDemoApplied
                                    ? 'bg-[#00F0B5] text-slate-950'
                                    : 'bg-amber-400/20 hover:bg-amber-400 hover:text-slate-950 text-amber-200 border border-amber-400/40'
                                }`}
                              >
                                {zipDemoApplied ? '✨ 1초 ZIP 압축 완료! (원본 비교)' : '⚡ 1초 스마트 ZIP 압축 체험'}
                              </button>
                            </div>
                            <p className="text-[13px] text-zinc-300 leading-relaxed font-semibold break-keep">
                              무거운 광고성 압축 프로그램 없이도 탐색기에서 파일·폴더를 선택해 우클릭하면 오늘 날짜와 대표 파일명이 깔끔하게 붙은 <span className="text-[#00F0B5] font-extrabold">.zip</span> 파일로 1초 만에 묶어줍니다.
                            </p>
                            <div className="grid grid-cols-1 gap-1.5 pt-0.5">
                              <div className="rounded-lg bg-zinc-900/90 border border-white/10 px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-[13px]">
                                <span className="text-zinc-400 font-bold break-keep">세금계산서_1.pdf 외 첨부 서류 4개 선택</span>
                                <div className="flex items-center gap-1.5 font-sans font-bold tracking-normal text-[13px] shrink-0">
                                  <span className={zipDemoApplied ? 'line-through text-zinc-500' : 'text-zinc-300'}>
                                    새 압축.zip
                                  </span>
                                  <span className="text-amber-400">➔</span>
                                  <span className="text-[#00F0B5] font-extrabold">261114_세금계산서_외4건.zip</span>
                                </div>
                              </div>
                            </div>
                          </>
                        )}

                        {selectedToolbarKey.startsWith('dev_') && (
                          <>
                            <div className="text-[13.5px] sm:text-sm font-black text-amber-300 break-keep">
                              🔒 [DEV 전용 프리뷰] 귀신창 유료 확장 슬롯 ([2] 스샷·PDF변환 · [3] 다중합본 · [5] 창고정)
                            </div>
                            <p className="text-[13px] text-zinc-300 leading-relaxed font-semibold break-keep">
                              정식 출시 후 사용자가 명시적으로 동의(Opt-in)했을 때만 <span className="text-[#00F0B5] font-extrabold">30일 무제한 체험</span>이 열리며, 만료 후에는 자동 결제 없이 유료 구독 전까지 깔끔하게 잠금(<span className="text-amber-300 font-extrabold">🔒/OFF</span>) 처리됩니다. (파일·라벨러 및 사진·표 OCR은 『2. 👻 귀신검색』 유료 티어 소속)
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ===============================================================
                [2턴 즉시 전환 영역] 체험 직후 바로 이어지는 이메일 10초 사전등록 / 출시 후 시작 박스
               =============================================================== */}
            <div ref={heroCtaRef} className="pt-3 border-t border-white/10">
              {!isLaunched ? (
                <div className="rounded-2xl bg-zinc-950/95 borderless-shape p-5 sm:p-6">
                  {verifiedUserEmail && !isChangingEmail ? (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="text-[13.5px] sm:text-sm font-black text-[#00F0B5] flex items-center gap-1.5">
                          <span>🎉</span>
                          <span>
                            {dbSyncStatus === 'syncing'
                              ? '알림 예약 등록 중...'
                              : `${verifiedUserEmail} 님, 사전 무료 가입 & 출시 1순위 알림 예약 완료!`}
                          </span>
                        </div>
                        <p className="text-[13px] text-zinc-300 mt-1 break-keep">
                          정식 오픈 당일 가장 먼저 시작 링크를 보내드립니다. 회사·매장 비치용 무료 보증서도 미리 확인해 보세요!
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setCertModalOpen(true)}
                          className="px-3.5 py-2 rounded-xl bg-amber-400 text-slate-950 font-black text-[13px] cursor-pointer"
                        >
                          📜 무료 보증서 열기
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            try {
                              localStorage.removeItem('ghosti_prelaunch_verified_email');
                            } catch {}
                            setLocalVerifiedEmail('');
                            setIsChangingEmail(true);
                            setEmailInput('');
                            resetOtp();
                            setTimeout(() => emailInputRef.current?.focus(), 60);
                          }}
                          className="px-2.5 py-2 text-[13px] text-zinc-400 hover:text-zinc-200 underline cursor-pointer"
                        >
                          이메일 변경
                        </button>
                      </div>
                    </div>
                  ) : otpStatus === 'sent' || otpStatus === 'verifying' ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13.5px] sm:text-sm font-extrabold text-[#00F0B5]">
                          📩 {emailInput.trim().toLowerCase()}로 발송된 인증번호 6자리를 입력해 주세요!
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[13px] font-mono font-bold">
                          ⏱ {formatTimer()}
                        </span>
                      </div>
                      <div className="flex items-center justify-center gap-2" onPaste={handleOtpPaste}>
                        {otpDigits.map((digit, idx) => (
                          <input
                            key={idx}
                            ref={(el) => {
                              otpInputRefs.current[idx] = el;
                            }}
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={digit}
                            onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                            onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                            className="w-10 h-12 sm:w-12 sm:h-13 rounded-xl bg-zinc-900 border-2 border-teal-500/40 focus:border-[#00F0B5] text-center text-lg sm:text-xl font-black text-white outline-none"
                          />
                        ))}
                      </div>
                      {otpError && <p className="text-[13px] text-rose-400 font-bold text-center">⚠️ {otpError}</p>}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={otpStatus === 'verifying' || otpDigits.join('').length < 6}
                          onClick={() => void handleVerifyOtpCode(otpDigits.join(''))}
                          data-keep-dark="true"
                          style={{ background: 'linear-gradient(90deg, #00F0B5 0%, #2DD4BF 100%)', color: '#020617' }}
                          className="flex-1 py-3 rounded-xl font-black text-[13px] sm:text-sm cursor-pointer disabled:opacity-60"
                        >
                          {otpStatus === 'verifying' ? '인증 확인 중...' : '✅ 인증 완료하고 출시 1순위 알림 예약하기'}
                        </button>
                        <button
                          type="button"
                          onClick={() => resetOtp()}
                          className="px-3 py-3 rounded-xl bg-zinc-800 text-zinc-300 text-[13px] font-bold cursor-pointer"
                        >
                          다시 입력
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleRequestEmailVerification} className="space-y-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[13.5px] sm:text-sm font-black text-white flex items-center gap-1.5">
                          <span>🔔</span>
                          <span>방금 눌러보신 『귀신같이』, 정식 오픈 당일 1순위로 받아보실래요?</span>
                        </span>
                        <span className="text-[12.5px] sm:text-[13px] font-extrabold text-[#00F0B5] break-keep">
                          체험은 지금 가입 없이 · 오픈 당일 시작 링크만 이메일로 가장 먼저
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          ref={emailInputRef}
                          type="email"
                          value={emailInput}
                          onChange={(e) => {
                            setEmailInput(e.target.value);
                            if (formNotice) setFormNotice(null);
                          }}
                          placeholder="이메일 주소 입력 (예: myid@naver.com)"
                          className="flex-1 px-4 py-3 rounded-xl bg-zinc-900 border border-white/15 focus:border-[#00F0B5] text-white placeholder-zinc-500 text-[13.5px] sm:text-sm font-medium outline-none"
                        />
                        <button
                          type="submit"
                          disabled={otpStatus === 'sending'}
                          data-keep-dark="true"
                          style={{ background: 'linear-gradient(90deg, #00F0B5 0%, #2DD4BF 55%, #34D399 100%)', color: '#020617' }}
                          className="px-5 py-3 rounded-xl hover:opacity-90 font-black text-[13.5px] sm:text-sm shadow-[0_4px_20px_rgba(0,240,181,0.35)] shrink-0 cursor-pointer"
                        >
                          {otpStatus === 'sending' ? '발송 중...' : '🔔 출시 알림받기 (10초 인증)'}
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[13px] text-zinc-400">
                        <span>원터치 도메인:</span>
                        {QUICK_EMAIL_DOMAINS.map((domain) => (
                          <button
                            key={domain}
                            type="button"
                            onClick={() => applyQuickDomain(domain)}
                            className="px-2.5 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-[#00F0B5] border border-white/10 font-mono text-xs cursor-pointer"
                          >
                            {domain}
                          </button>
                        ))}
                      </div>
                      {(formNotice || otpError) && (
                        <p className="text-[13px] text-rose-400 font-bold">⚠️ {formNotice || otpError}</p>
                      )}
                    </form>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl bg-zinc-950/95 border border-[#00F0B5]/50 p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <div className="text-[13.5px] font-extrabold text-[#00F0B5] mb-1">
                      🎉 정식 무료 배포 오픈! 내 PC와 모바일에 1초 초능력을
                    </div>
                    <p className="text-[13px] text-zinc-300 break-keep">
                      가입·카드 등록 없이 즉시 시작 · 서버 전송 0% · 광고 0% 평생 무료 (원클릭 입장 또는 Windows Z-코어 다운로드)
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onEnterWorkspace(true)}
                      data-keep-dark="true"
                      style={{ background: 'linear-gradient(90deg, #00F0B5 0%, #2DD4BF 100%)', color: '#020617' }}
                      className="px-5 py-3 rounded-xl font-black text-[13.5px] sm:text-sm cursor-pointer shadow-lg hover:opacity-90"
                    >
                      🚀 본 앱 바로 시작하기 ➔
                    </button>
                    <a
                      href="/Merlin_Z_Core.zip"
                      download="Merlin_Z_Core.zip"
                      className="px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-[#00F0B5]/40 text-[#00F0B5] font-extrabold text-[13px]"
                    >
                      💻 Z-코어 받기
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ===================================================================
            🧪 개발자 전용(`DEV 전체보기 ON`) 은닉 패널 — 일반 방문자에게는 100% 비노출!
           =================================================================== */}
        {isDevAuthorized && devFullView && (
          <div className="mt-8 rounded-3xl bg-zinc-900/95 border-2 border-amber-400/50 p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-white/10">
              <span className="px-3 py-1 rounded-full bg-amber-400 text-slate-950 text-xs font-black">
                🧪 DEV 전체보기 ON (일반 방문자에게는 100% 은닉된 개발자·QA 점검 영역)
              </span>
              <span className="text-xs text-zinc-400 font-bold">
                귀신창 v1.4 수련장 · 2단계 유료/확장 티어 · Z-코어 폴더 권한 및 QR 테스트
              </span>
            </div>

            {/* 최신 v1.4 및 2단계 유료 티어 구분 안내 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-zinc-950 border border-white/10 space-y-1.5">
                <div className="font-black text-[#00F0B5]">🟢 1단계 평생 무료 4대 코어 (현재 일반 노출)</div>
                <p className="text-zinc-300 leading-relaxed">
                  내 PC·폰 로컬 검색(영상 글자·문서) + 귀신비서(인생샷·보안앱 절전) + 무료 사진공유 + 귀신창 기본기 5총사(무버튼 한영·띄어쓰기 성형 · 순차붙여넣기 · [1] 서식·줄바꿈 · F1~F6 상용구 · 우클릭 ZIP 압축)
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-zinc-950 border border-white/10 space-y-1.5">
                <div className="font-black text-amber-300">🔒 2단계 Opt-in 30일 체험 ➔ 유료 잠금 (일반 은닉)</div>
                <p className="text-zinc-300 leading-relaxed">
                  • 귀신창 확장 ([2]스샷·PDF · [3]다중합본 · [5]창고정) &amp; 귀신검색 확장 (파일·라벨러, 사진·표 OCR)<br />
                  • 내 기기 통합 (폰 ⇄ 집·회사 PC 원격 열람) &amp; B2B 업무 공유
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-zinc-950 border border-white/10 space-y-1.5">
                <div className="font-black text-purple-300">💳 예약·결제 (정식 오픈 전 비노출)</div>
                <p className="text-zinc-300 leading-relaxed">
                  얼리버드 유료 플랜 및 크레딧 스토어는 정식 오픈 전까지 일반 유저 화면에서 비노출 처리하여 무료 온보딩 몰입도를 100% 유지합니다.
                </p>
              </div>
            </div>

            {/* 보존된 초능력 수련장 & 폴더 체크박스 & QR (DEV 모드에서만 렌더링) */}
            <GhostSuperpowerDojo variant="full" />

            <div className="p-4 rounded-2xl bg-zinc-950/90 border border-white/10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex flex-col gap-2 flex-1">
                <div className="text-xs font-extrabold text-white">
                  🔒 [DEV 테스트] 내 PC 안전 검진 구역 &amp; Z-코어 1회 연결
                </div>
                <div className="text-[11.5px] font-bold text-teal-200 break-keep">
                  ⚡ 내 파일이 외부 클라우드 서버로 절대 전송되지 않도록, 내 PC 전용 초경량 로컬 엔진(3초 연결)을 켭니다.
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-white/10 flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={trialScanPermissions.gallery}
                      onChange={(e) => setTrialScanPermission('gallery', e.target.checked)}
                      className="accent-teal-400"
                    />
                    <span>☑️ 사진첩(갤러리)</span>
                  </label>
                  <label className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-white/10 flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={trialScanPermissions.downloads}
                      onChange={(e) => setTrialScanPermission('downloads', e.target.checked)}
                      className="accent-amber-400"
                    />
                    <span>☑️ 다운로드 폴더</span>
                  </label>
                  <label className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-white/10 flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={trialScanPermissions.desktop}
                      onChange={(e) => setTrialScanPermission('desktop', e.target.checked)}
                      className="accent-emerald-400"
                    />
                    <span>☑️ 바탕화면 폴더</span>
                  </label>
                  <a
                    href={Z_CORE_ZIP_URL}
                    download="Merlin_Z_Core.zip"
                    className="px-3 py-1.5 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 border border-teal-400/40 text-teal-300 font-extrabold text-xs transition-all"
                  >
                    📥 PC Z-코어 1회 설치파일 받기 (v{LATEST_Z_CORE_VERSION})
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 bg-zinc-900/90 p-2.5 rounded-2xl border border-teal-400/30">
                <img
                  src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=6&data=https%3A%2F%2Fghosti.sundreamer.app"
                  alt="스마트폰 앱 1초 설치 QR 코드"
                  className="w-16 h-16 rounded-xl bg-white p-1 shrink-0"
                />
                <div className="flex flex-col gap-1 max-w-[200px]">
                  <span className="text-[13px] font-extrabold text-teal-300">📱 스마트폰 QR 연결</span>
                  <button
                    type="button"
                    onClick={() => {
                      const isAuthed = Boolean(
                        merlinAuth?.email && merlinAuth.userId && merlinAuth.userId !== 'guest'
                      );
                      if (!isAuthed) {
                        window.dispatchEvent(new CustomEvent('openLoginModal'));
                        return;
                      }
                      setPcAgentPairedMobile(!pcAgentPairedMobile);
                    }}
                    className="text-left text-xs text-emerald-400 font-bold cursor-pointer"
                  >
                    {merlinAuth?.email && merlinAuth.userId !== 'guest' && pcAgentPairedMobile
                      ? '● 내 폰 연결됨'
                      : merlinAuth?.email && merlinAuth.userId !== 'guest'
                      ? '○ 연결 상태 토글'
                      : '🔑 먼저 로그인하기'}
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[13px]">
              <label className="flex items-center gap-2 text-zinc-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={telemetryEnabled}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setTelemetryEnabled(next);
                    try {
                      localStorage.setItem('ghosti_telemetry_enabled', String(next));
                    } catch {}
                  }}
                  className="w-4 h-4 accent-teal-400 rounded"
                />
                <span className="font-bold text-zinc-200">
                  ✔ 서비스 개선을 위한 익명 사용 통계 보내기 (원문·파일 0 Byte 수집)
                </span>
              </label>
              <button
                type="button"
                onClick={() => setShowTermsClause((v) => !v)}
                className="text-teal-300 hover:text-teal-200 font-bold underline cursor-pointer"
              >
                {showTermsClause ? '📜 약관 접기 ▴' : '📜 약관 보기 ▾'}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* =====================================================================
          3. 중단 공식 15초 예고편 영상관 (#귀신비서 · #귀신검색 · #귀신창)
         ===================================================================== */}
      <section id="shorts" className="py-16 px-4 sm:px-6 max-w-7xl mx-auto border-t border-white/5">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-teal-500/10 border border-teal-500/25 text-teal-400 text-[13px] font-black mb-3">
            <img
              src="/gwisinkachi_app_icon_512.png"
              alt="아기귀신"
              className="w-5 h-5 rounded-full object-cover"
            />
            <span>15초 공식 예고편 쇼룸</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2.5 mb-2">
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight break-keep">
              15초면 끝! 한눈에 보는
            </h2>
            <img
              src="/gwisinkachi_wordmark_dark_ink.png"
              alt="귀신같이 캘리그라피"
              className="h-8 sm:h-11 w-auto object-contain"
            />
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight break-keep">
              핵심 예고편
            </h2>
          </div>
          <p className="text-zinc-400 text-[13.5px] sm:text-sm font-semibold break-keep">
            글 대신 영상으로 가볍게 확인하세요! <b className="text-[#00F0B5]">#귀신비서 · #귀신검색 · #귀신창</b> {shortsList.length}편 즉시 재생
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
            {[
              { id: 'all', label: `전체 미리보기 (${shortsList.length})` },
              { id: 'video', label: '🎬 영상 글자·장면 소환 (#귀신검색)' },
              { id: 'doc', label: '📊 엑셀·문서 내용 찾기 (#귀신검색)' },
              { id: 'clean', label: '🧹 사진·보안앱 청소 (#귀신비서)' },
              { id: 'typo', label: '⌨️ 무버튼 자동 한영성형 (#귀신창)' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedCategory(tab.id as any)}
                className={`px-4 py-2 rounded-xl text-[13px] sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                  selectedCategory === tab.id
                    ? 'bg-[#00F0B5] text-slate-950 shadow-[0_0_20px_rgba(0,240,181,0.4)]'
                    : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredShorts.map((item) => {
            const posterUrl = item.videoUrl ? item.videoUrl.replace(/\.mp4(\?.*)?$/, '.jpg') : '';
            return (
              <div
                key={item.id}
                onClick={() => setActiveShortsModal(item)}
                className="group rounded-2xl bg-zinc-900/60 border border-white/10 hover:border-teal-400/50 p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_15px_40px_rgba(0,240,181,0.15)] cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div
                    data-keep-dark="true"
                    className={`relative aspect-[9/16] max-h-64 w-full rounded-xl bg-slate-950 border border-white/15 mb-4 overflow-hidden flex items-center justify-center p-4 text-center`}
                  >
                    {posterUrl ? (
                      <img
                        src={posterUrl}
                        alt={item.title}
                        loading="lazy"
                        className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : item.youtubeId ? (
                      <img
                        src={`https://i.ytimg.com/vi/${item.youtubeId}/hqdefault.jpg`}
                        alt={item.title}
                        loading="lazy"
                        className="absolute inset-0 w-full h-full object-cover opacity-85 group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : null}
                    <div
                      data-keep-dark="true"
                      className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/40 group-hover:bg-black/20 transition-colors"
                    />
                    <div className="relative z-10">
                      <div className="w-12 h-12 rounded-full bg-[#00F0B5] flex items-center justify-center mx-auto mb-2 text-slate-950 text-xl font-black shadow-lg group-hover:scale-110 transition-transform">
                        ▶
                      </div>
                      <span
                        style={{ backgroundColor: 'rgba(15, 23, 42, 0.88)', color: '#5EEAD4' }}
                        className="text-xs font-extrabold px-3 py-1 rounded-full border border-teal-400/50 shadow"
                      >
                        15초 영상 바로 재생
                      </span>
                    </div>
                    <span
                      style={{ backgroundColor: 'rgba(15, 23, 42, 0.88)', color: '#FFFFFF' }}
                      className="absolute top-2.5 left-2.5 text-xs font-extrabold px-2.5 py-1 rounded-md shadow"
                    >
                      {item.tag}
                    </span>
                  </div>

                  <h3 className="font-black text-base text-zinc-100 group-hover:text-[#00F0B5] transition-colors leading-snug mb-2 break-keep">
                    {item.title}
                  </h3>
                  <div className="text-[13px] text-zinc-300 font-semibold mb-1.5 line-clamp-2 break-keep">
                    {item.hookLine}
                  </div>
                  <div className="text-[13px] text-teal-300 font-extrabold mb-3 line-clamp-2 break-keep">
                    👉 {item.solutionLine}
                  </div>
                </div>

                <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[13px] text-zinc-400">
                  <span className="truncate">
                    검색 키워드: <b className="text-amber-300">{item.recommendedKeyword}</b>
                  </span>
                  <span className="text-[#00F0B5] font-extrabold shrink-0 ml-2 whitespace-nowrap">재생 ➔</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* =====================================================================
          4. 🛡️ 보안·로컬 작동 원리 3원칙 & 개인·기업 PC 영구 무료 공식 보증서 (#security)
         ===================================================================== */}
      <section id="security" className="py-12 px-4 sm:px-6 max-w-7xl mx-auto border-t border-white/5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          <div className="rounded-2xl bg-zinc-900/80 border border-teal-400/30 p-5 space-y-1.5">
            <div className="text-sm font-black text-[#00F0B5]">🖥️ 외부 서버 전송 0% 로컬 실행</div>
            <p className="text-[13px] text-zinc-300 font-medium leading-relaxed break-keep">
              문서·사진·영상 원문은 외부 클라우드 서버로 단 1바이트도 업로드되지 않고 오직 내 PC와 모바일 안에서만 안전하게 색인·처리됩니다.
            </p>
          </div>
          <div className="rounded-2xl bg-zinc-900/80 border border-teal-400/30 p-5 space-y-1.5">
            <div className="text-sm font-black text-[#00F0B5]">🛡️ 은행 보안앱 안 지우고 재우기 &amp; 휴지통 복구</div>
            <p className="text-[13px] text-zinc-300 font-medium leading-relaxed break-keep">
              은행 보안프로그램은 안 지우고 조용히 재워뒀다가 은행 켜는 순간 1초 만에 깨우며, 중복·정리 파일도 휴지통 안전 격리로 언제든 되살립니다.
            </p>
          </div>
          <div className="rounded-2xl bg-zinc-900/80 border border-amber-400/30 p-5 space-y-1.5">
            <div className="text-sm font-black text-amber-300">🔐 종단간 암호화(E2EE) 직결</div>
            <p className="text-[13px] text-zinc-300 font-medium leading-relaxed break-keep">
              내 기기 통합 및 팀 공용 폴더(S: 드라이브) 연결 시 중앙 서버 저장 없이 종단간 암호화로 직결하며, 퇴사자 권한 즉시 회수와 랜섬웨어 격리를 지원합니다.
            </p>
          </div>
        </div>

        <div
          data-keep-dark="true"
          style={{
            background: 'linear-gradient(135deg, #07131E 0%, #0D292C 55%, #091322 100%)',
          }}
          className="rounded-3xl border-2 border-amber-400/50 p-6 sm:p-9 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center shadow-2xl"
        >
          <div className="lg:col-span-8 space-y-4">
            <div
              style={{ backgroundColor: 'rgba(251, 191, 36, 0.18)', color: '#FCD34D' }}
              className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-amber-400/40 text-[13px] font-black"
            >
              <span>📜</span>
              <span>대표이사 직인 날인 · 무료 사용 공식 확인서</span>
            </div>
            <h3 className="text-xl sm:text-3xl font-black text-white leading-tight break-keep">
              “회사 컴퓨터에 깔아도 저작권 단속 안 오나요?”<br />
              <span style={{ color: '#00F0B5' }}>
                ✓ 개인·기업 PC 기본 기능 영구 무료! (라이선스 비용 0원)
              </span>
            </h3>

            {/* 빽빽한 줄글 대신 한눈에 읽히는 3대 안심 체크 배지 (우리가 책임질 수 있는 범위만 명시) */}
            <div className="flex flex-wrap gap-2 text-[13px] font-extrabold">
              {[
                '🏢 법인·개인사업자·병원·세무사 사내 PC 무료',
                '🛡️ 라이선스 비용 0원 · 광고 0%',
                '📜 회사 PC 무료 사용 허용 공식 확인서 발급',
              ].map((pill) => (
                <span
                  key={pill}
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.08)', color: '#E2E8F0' }}
                  className="px-3 py-1.5 rounded-xl border border-white/15"
                >
                  {pill}
                </span>
              ))}
            </div>
            <p className="text-[13px] text-zinc-300 font-semibold break-keep">
              ※ 내 기기 로컬 기본 기능(귀신비서·귀신검색·귀신창·사진공유) 영구 무료 (내 기기 통합·팀 공용 폴더 등 확장 옵션 및 공공기관 제외)
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setCertModalOpen(true)}
                style={{ backgroundColor: '#FBBF24', color: '#020617' }}
                className="px-5 py-3 rounded-xl hover:opacity-95 font-black text-[13.5px] sm:text-sm cursor-pointer shadow-lg"
              >
                📜 공식 무료 라이선스 보증서 크게 보기
              </button>
              <a
                href="/showroom/certificates/ghosti_b2b_free_certificate.html"
                target="_blank"
                rel="noopener noreferrer"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', color: '#FFFFFF' }}
                className="px-4 py-3 rounded-xl hover:opacity-90 border border-white/25 font-bold text-[13.5px] sm:text-sm"
              >
                🖨️ 인쇄·비치용 보증서 새 창 열기 ↗
              </a>
            </div>
          </div>

          <div className="lg:col-span-4 flex justify-center">
            <div
              onClick={() => setCertModalOpen(true)}
              className="w-44 sm:w-52 rounded-2xl overflow-hidden border-2 border-amber-400/60 shadow-2xl cursor-pointer hover:scale-105 transition-transform bg-white"
            >
              <img
                src="/showroom/certificates/ghosti_b2b_free_certificate.png?v=20261113v2"
                alt="귀신같이 무료 공식 보증서"
                className="w-full h-auto object-contain"
              />
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          4-B. 📱·💼 유료 확장 2종 간판 · 원가 투명화 · B2B 4대 신뢰 보증 섹션 (SSOT v2.3)
               ※ 모바일 스토어 클린 모드(isStoreAppMode)에서는 Anti-Steering 헌법에 따라 100% 비노출
         ===================================================================== */}
      {!isStoreAppMode && (
        <section id="extensions" className="py-10 px-4 sm:px-6 max-w-7xl mx-auto border-t border-white/5">
          <div
            data-keep-dark="true"
            style={{
              background: 'linear-gradient(135deg, #070E1B 0%, #0C1C29 55%, #08121E 100%)',
            }}
            className="rounded-3xl border border-teal-400/30 p-6 sm:p-8 space-y-5 shadow-xl"
          >
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
              <div className="space-y-1.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/15 border border-teal-400/35 text-teal-300 text-xs font-extrabold">
                  🔗 기기 통합 &amp; 팀 공용 폴더 확장 (카드 등록 없는 30일 무료체험)
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight break-keep">
                  클라우드 월세 0원, 내 모든 기기와 우리 팀을 1초 만에 하나로
                </h3>
              </div>
              <p className="text-[13px] text-zinc-400 font-semibold break-keep">
                기본 4대 초능력은 평생 0원이며, 내 기기 직결이나 팀 공용 폴더가 필요하신 분만 투명한 정찰제로 이용하세요.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 5. 📱 내 기기 통합 — 핵심 가격 상시 노출 */}
              <div className="rounded-2xl bg-zinc-950/90 border border-white/12 hover:border-teal-400/45 p-5 transition-all space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-black text-[#00F0B5]">5. 📱 내 기기 통합</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-teal-500/15 text-teal-200 text-xs font-extrabold">
                    30일 무료체험 · 월 3,900원
                  </span>
                </div>
                <div className="text-base sm:text-lg font-black text-white break-keep">
                  카톡 ‘나에게 보내기’ 끝, 내 모든 기기를 하나로
                </div>
                <p className="text-[13px] text-zinc-200 font-semibold leading-relaxed break-keep">
                  매달 내는 클라우드 월세 없이 내 폰·집컴·회사컴을 1초 만에 직결합니다. <span className="text-teal-300 font-bold">(카드 등록 없는 30일 무료체험 · 월 3,900원)</span>
                </p>
                <details className="pt-1 text-xs text-zinc-400">
                  <summary className="cursor-pointer font-bold text-teal-300 hover:text-teal-200 select-none">
                    상세 연동 방식 보기 ▾
                  </summary>
                  <p className="mt-2 leading-relaxed text-zinc-300 break-keep">
                    동일 이메일 하나로 내 스마트폰 사진·영수증과 집·회사 PC 문서를 중앙 클라우드 업로드 없이 직접 암호화 연결합니다(연간 결제 시 월 3,250원꼴). 체험 만료 시에도 자동 결제 없이 유료 기능만 잠기며 내 PC 원본 파일은 그대로 보존됩니다.
                  </p>
                </details>
              </div>

              {/* 6. 💼 업무 공유 (공용 폴더 S:) — 공용 폴더 병기 & 핵심 요금·보안 상시 노출 */}
              <div
                id="work-share"
                className={`rounded-2xl bg-zinc-950/90 p-5 transition-all space-y-2.5 ${
                  b2bFocused
                    ? 'border-2 border-amber-400 ring-4 ring-amber-400/25 shadow-[0_0_32px_rgba(251,191,36,0.3)]'
                    : 'border border-white/12 hover:border-amber-400/45'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-black text-amber-300">6. 💼 업무 공유 (공용 폴더 S:)</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCertModalOpen(true)}
                      className={`px-2.5 py-0.5 rounded-full text-xs font-black transition-all cursor-pointer ${
                        b2bFocused
                          ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-200 shadow-md'
                          : 'bg-amber-400/20 hover:bg-amber-400 hover:text-slate-950 text-amber-200 border border-amber-400/45'
                      }`}
                    >
                      📜 민간 기업 영구 무료 보증서
                    </button>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-400/15 text-amber-200 text-xs font-extrabold">
                      5인·30GB 평생 0원 보증
                    </span>
                  </div>
                </div>
                <div className="text-base sm:text-lg font-black text-white break-keep">
                  클라우드 월세 0원, 우리 팀 PC를 공용 폴더(S: 드라이브) 하나로
                </div>
                <p className="text-[13px] text-zinc-200 font-semibold leading-relaxed break-keep">
                  비싼 서버나 클라우드 구독 없이 사내 문서·현장 사진을 공유 드라이브(S:) 하나로 묶어 1초 만에 찾고 씁니다. <span className="text-amber-300 font-bold">(소기업 5인·30GB 평생 0원 보증 · 추가 팀 월 9,900원~)</span>
                </p>
                <details open={b2bFocused || undefined} className="pt-1 text-xs text-zinc-400">
                  <summary className="cursor-pointer font-bold text-amber-300 hover:text-amber-200 select-none">
                    사내 공용 폴더(S: 드라이브) 도입 &amp; 팀 요금 안내 보기 ▾
                  </summary>
                  <p className="mt-2 leading-relaxed text-zinc-300 break-keep">
                    NAS 장비 도입이나 인당 클라우드 월세 부담 없이 사무실 대표 PC 한 대를 사내 공용 폴더(S: 드라이브)로 종단간 암호화(E2EE) 연결해, 계약서·단가표·현장 시공 사진을 전 직원이 1초 만에 함께 찾고 활용합니다. 5인 이하·30GB 이하 민간 소기업은 평생 0원 보증서가 발급되며, 6인 이상·용량 확장 팀은 월 9,900원~ 정찰제로 운영됩니다.
                  </p>
                </details>
              </div>
            </div>

            {/* 상시 노출: 원가 투명화 1줄 + B2B 4대 신뢰 보증 배지 (SSOT v2.3) */}
            <div className="rounded-2xl bg-zinc-950/90 border border-white/12 p-4 sm:p-5 space-y-3">
              <p className="text-[12.5px] sm:text-[13px] text-zinc-200 font-semibold leading-relaxed break-keep">
                <strong className="text-[#00F0B5]">💡 기본 4대 초능력은 외부 클라우드 서버 없이 내 기기 안에서만 작동해 서버 비용이 0원이므로 평생 무료로 제공됩니다.</strong>
              </p>
              <div className="flex flex-wrap gap-2 text-xs font-extrabold text-zinc-200">
                <span className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
                  🔒 종단간 암호화(E2EE)
                </span>
                <span className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
                  🛡️ 랜섬웨어 격리·스마트 캐시
                </span>
                <span className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
                  🧾 법인 세금계산서 발행
                </span>
                <span className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
                  🏢 썬드림(주) 공식 고객지원
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          4-C. 📜 About Ghosti · 국문 & Global Brand Manifesto (SSOT v2.3 고유 정체성 복원)
         ===================================================================== */}
      <section id="manifesto" className="py-10 px-4 sm:px-6 max-w-7xl mx-auto border-t border-white/5">
        <div className="rounded-3xl bg-zinc-900/50 border border-white/10 p-6 sm:p-8 space-y-5">
          <div className="space-y-1.5">
            <span className="text-xs font-extrabold tracking-wider uppercase text-[#00F0B5]">
              📜 About Ghosti · Brand Manifesto
            </span>
            <p className="text-sm sm:text-base font-black text-zinc-100 break-keep">
              귀신같이(Ghosti)는 지금 쓰는 내 PC와 모바일의 모든 답답함을 1초 만에 풀어내는 광고 0%·클라우드 월세 0원 초능력입니다.
            </p>
            <p className="text-xs sm:text-[13px] font-bold text-teal-300/90 break-keep">
              평소엔 내 PC와 폰 속에 유령처럼 조용히 숨어 있다가, 부르면 광고도 월세도 없이 1초 만에 나타나 뭐든 해결하는 PC·모바일 초능력입니다.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-2 border-t border-white/10 text-[13px] leading-relaxed">
            <p className="text-zinc-300 font-medium break-keep">
              당신이 지금 쓰고 있는 PC와 모바일은 더 빠르고 똑똑해질 자격이 있습니다. 그동안 수많은 프로그램이 해결사를 자처하며 내 기기를 무겁게 만들고, 시도 때도 없이 광고를 띄우며, 매달 클라우드 월세를 요구해 왔습니다. 그래서 우리는 평소엔 아무것도 차지하지 않는 투명한 유령처럼 조용히 숨어 있다가, 당신이 부르는 단 1초의 순간에만 나타나 모든 답답함을 풀어내는 ‘귀신같이(Ghosti)’를 만들었습니다. 수십 개의 복잡한 도구를 깔고 배울 필요 없이, 지금 내 기기 안에서만 조용히 깨어나는 작지만 강력한 PC·모바일 초능력—광고 공해도, 클라우드 월세도, 끝없는 기다림도 없는 내 기기의 진짜 주권을 이제 귀신같이 누리세요.
            </p>
            <p className="text-zinc-400 font-normal">
              The PC and mobile devices you already use every day deserve to feel effortless again. For too long, bloated software has slowed down your machines, hijacked your screen with relentless ads, and locked your memories and work behind monthly cloud rent. That is why we created Ghosti—a tiny, friendly ghost that rests quietly inside your devices with zero background drag, zero ads, and zero cloud storage fees, appearing the exact second you summon it to solve everything in a flash. No steep learning curve, no clutter, and no waiting: Ghosti is the quiet everyday superpower that gives your devices, your focus, and your time back to you.
            </p>
          </div>
        </div>
      </section>

      {/* 5. 최하단 마스터 푸터 */}
      <footer className="border-t border-white/10 py-10 px-4 sm:px-6 max-w-7xl mx-auto text-[13px] text-zinc-500">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-3.5 text-center sm:text-left">
            <div className="flex items-center gap-2">
              <img
                src="/gwisinkachi_app_icon_512.png"
                alt="아기귀신 심볼"
                className="w-7 h-7 rounded-lg object-cover shadow-sm"
              />
              <img
                src="/gwisinkachi_wordmark_dark_ink.png"
                alt="귀신같이 로고"
                className="h-6 w-auto object-contain opacity-90"
              />
            </div>
            <p className="font-bold text-zinc-400 break-keep">
              (주)썬드림 · PC·모바일 초능력 『귀신같이(Ghosti)』 · 상표출원 제40-2026-0229386호 · 외부 서버 전송 0 Byte 프라이버시 보장
            </p>
          </div>
          <span className="select-none">© 2026 (주)썬드림 · Sundreamer Studio. All rights reserved.</span>
        </div>
      </footer>

      {/* 6. 세로형 15초 쇼츠 재생 모달 팝업 */}
      {activeShortsModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setActiveShortsModal(null)}
        >
          <div
            className="relative w-full max-w-sm rounded-3xl bg-zinc-950 border border-teal-500/40 p-5 shadow-2xl flex flex-col justify-between max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActiveShortsModal(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm font-bold z-20 cursor-pointer"
            >
              ✕
            </button>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2.5 py-0.5 rounded bg-teal-500/20 text-[#00F0B5] text-xs font-extrabold">
                  {activeShortsModal.tag}
                </span>
              </div>

              {activeShortsModal.videoUrl ? (
                <div className="relative aspect-[9/16] rounded-2xl overflow-hidden bg-black border border-white/10 mb-4 shadow-inner">
                  <video
                    src={activeShortsModal.videoUrl}
                    controls
                    autoPlay
                    playsInline
                    loop
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : activeShortsModal.youtubeId ? (
                <div className="relative aspect-[9/16] rounded-2xl overflow-hidden bg-black border border-white/10 mb-4 shadow-inner">
                  <iframe
                    src={`https://www.youtube.com/embed/${activeShortsModal.youtubeId}?autoplay=1&rel=0&playsinline=1`}
                    title={activeShortsModal.title}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => {
                setActiveShortsModal(null);
                scrollToEmailBox();
              }}
              data-keep-dark="true"
              style={{ background: 'linear-gradient(90deg, #00F0B5 0%, #2DD4BF 100%)', color: '#020617' }}
              className="w-full py-3.5 rounded-xl font-black text-[13.5px] sm:text-sm cursor-pointer hover:opacity-90"
            >
              {verifiedUserEmail ? '✅ 출시 알림 예약됨 (다른 기능 체험하기)' : '🔔 이 기능 정식 출시 1순위 알림받기'}
            </button>
          </div>
        </div>
      )}

      {/* 7. 공식 무료 보증서 라이트박스 모달 */}
      {certModalOpen && (
        <div
          className="fixed inset-0 z-[110] bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setCertModalOpen(false)}
        >
          <div
            className="relative max-w-2xl w-full max-h-[92vh] overflow-y-auto rounded-3xl bg-zinc-950 border-2 border-amber-400 p-4 sm:p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between text-white">
              <span className="text-amber-300 font-black text-sm sm:text-base">
                📜 개인 및 민간 기업 PC 기본 기능 영구 무료 공식 보증서
              </span>
              <button
                type="button"
                onClick={() => setCertModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden bg-white">
              <img
                src="/showroom/certificates/ghosti_b2b_free_certificate.png?v=20261113v2"
                alt="귀신같이 무료 공식 보증서"
                className="w-full h-auto object-contain"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <a
                href="/showroom/certificates/ghosti_b2b_free_certificate.html"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-xl bg-amber-400 text-slate-950 font-black text-[13px]"
              >
                🖨️ 인쇄·PDF 저장용 페이지 열기 ↗
              </a>
              <button
                type="button"
                onClick={() => setCertModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-200 font-bold text-[13px] cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
