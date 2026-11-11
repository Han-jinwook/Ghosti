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
    solutionLine: '『귀신검색』에 "아기 걸음마"만 치면 안 틀어보고도 03분 15초로 1초 만에 즉시 점프!',
    recommendedKeyword: '귀신같이 귀신검색',
    tag: '🎬 #귀신검색 · 동영상 장면 1초 소환',
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
    solutionLine: '엑셀·한글·PDF를 열지 않고도 본문 속 글자와 숫자를 0.1초 만에 투시해 찾아냅니다.',
    recommendedKeyword: '귀신같이 귀신검색',
    tag: '📊 #귀신검색 · 엑셀·문서 무열람 투시',
    youtubeId: 'zeOS7G54Leo',
    videoUrl: '/showroom/shorts/ghosti_short_sc555_1793284492.mp4',
    thumbnailBg: 'from-blue-950 via-indigo-950 to-slate-900',
    isNew: true,
  },
  {
    id: 'typo-756',
    category: 'typo',
    searchKeyword: '귀신창',
    title: 'dkssudgktpdy 치고 백스페이스 누르지 마세요! 무버튼 0.2ms 자동 성형!',
    hookTime: '00:00 ~ 00:03 (훅)',
    hookLine: '“급하게 메신저나 보고서 쓰다가 한영키 안 눌러서 영타 외계어 치고 다 지우셨죠?”',
    solutionLine: '버튼 누를 필요 ZERO! 치기만 하면 귀신창이 영타 오타와 깨진 줄바꿈을 0.2ms 만에 무버튼 자동 다림질!',
    recommendedKeyword: '귀신같이 귀신창',
    tag: '⌨️ #귀신창 · 무버튼 0.2ms 자동 한영성형',
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
    solutionLine: '『귀신비서』가 흔들린 사진과 중복 파일을 1초 만에 골라내어 터치 한 번으로 용량을 확 비워줍니다.',
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
    title: '백신 돌려도 PC·폰이 느리다면? 구라 보안프로그램 & 숨은 캐시 5GB 1클릭 소탕!',
    hookTime: '00:00 ~ 00:03 (훅)',
    hookLine: '“저장공간 98% 꽉 참 경고! 은행 들어갈 때 깔린 보안프로그램 20개와 숨은 캐시가 범인입니다.”',
    solutionLine: '진단 버튼 한 번이면 미사용 보안모듈 동결과 숨은 미디어 캐시 5.4GB를 안전 휴지통으로 정리합니다.',
    recommendedKeyword: '귀신같이 귀신비서',
    tag: '🛡️ #귀신비서 · 보안모듈 동결 & 5GB 청소',
    videoUrl: '/showroom/shorts/ghosti_백신돌려도PC폰이느_261110.mp4',
    thumbnailBg: 'from-emerald-950 via-slate-900 to-teal-950',
    isNew: true,
  },
  {
    id: 'clean-673',
    category: 'clean',
    searchKeyword: '귀신비서',
    title: '부모님 폰 수상한 청소앱 당장 지우세요! 말 한마디로 왕 아이콘 1초 세팅',
    hookTime: '00:00 ~ 00:03 (훅)',
    hookLine: '“어머니, 폰에 깔린 앱 300개 중 진짜 쓰는 건 딱 8개입니다.”',
    solutionLine: '“카톡이랑 유튜브만 크게 해줘” 말 한마디면 0.5초 만에 3x4 왕 아이콘 모드로 깔끔하게 정리됩니다.',
    recommendedKeyword: '귀신같이 귀신비서',
    tag: '📱 #귀신비서 · 효도폰 왕 아이콘 1초 세팅',
    videoUrl: '/showroom/shorts/ghosti_부모님폰수상한청소앱_261110.mp4',
    thumbnailBg: 'from-rose-950 via-slate-900 to-teal-950',
    isNew: true,
  },
];

const INTERACTIVE_SCENARIOS = {
  video: [
    {
      query: '아기 첫 걸음마',
      file: 'VID_20250914_거실촬영.mp4 (14분 20초)',
      timestamp: '03분 12초',
      transcript: '“우와~ 우리 아기 혼자 두 발로 걷는다! 여보 빨리 봐봐!”',
      sceneDesc: '거실 매트 위에서 아기가 소파를 잡고 일어서서 세 걸음 내딛는 순간 포착',
      latency: '0.008초',
    },
    {
      query: '제주도 갈치조림',
      file: 'VID_20250502_가족여행.mp4 (08분 45초)',
      timestamp: '05분 41초',
      transcript: '“이 집 갈치조림 양념이 진짜 대박이네, 밥 두 공기 각이다!”',
      sceneDesc: '식당 테이블 위 보글보글 끓는 통갈치조림 클로즈업 장면 및 식당 간판 인식',
      latency: '0.011초',
    },
    {
      query: '생일 케이크 촛불',
      file: 'MOV_20251224_파티.mov (06분 10초)',
      timestamp: '02분 19초',
      transcript: '“생일 축하합니다~ 자 이제 소원 빌고 후 불어!”',
      sceneDesc: '초코 케이크 위 숫자 초를 온 가족이 박수치며 부는 하이라이트 구간',
      latency: '0.007초',
    },
  ],
  doc: [
    {
      query: '지체상금 0.15%',
      file: 'D:\\업무문서\\2026_물품공급_표준계약서_최종수정3.pdf (24페이지)',
      location: '제14조 (지체상금 및 면책) — 9페이지 12번째 줄',
      previewSnippet: '“을이 납품기한 내에 물품을 납품하지 못할 때에는 지체일수 매 1일당 계약금액의 0.15%(천분의 1.5)에 해당하는 지체상금을...”',
      latency: '0.006초 (파일 안 열고 즉시 포착)',
    },
    {
      query: '부가세 환급 내역',
      file: 'D:\\세무자료\\2026_상반기_매입매출_정산_진짜최종.xlsx (시트 4개)',
      location: '[2분기_세금계산서] 시트 — E28 셀',
      previewSnippet: '“공급가액 합계: 42,800,000원 | 부가세 환급 예정액: 4,280,000원 (홈택스 전자세금계산서 대조 완료)”',
      latency: '0.005초 (엑셀 실행 없이 셀 값 직독)',
    },
    {
      query: '사업자등록번호',
      file: 'D:\\스캔보관함\\scan_20260311_004.jpg (스캔 이미지)',
      location: '온디바이스 OCR 판독 — 상단 3번째 줄',
      previewSnippet: '“상호: (주)썬드림스튜디오 | 등록번호: 123-86-XXXXX | 개업연월일: 2026년...”',
      latency: '0.012초 (이미지 속 글자 즉시 추출)',
    },
  ],
};

const QUICK_EMAIL_DOMAINS = ['@naver.com', '@gmail.com', '@daum.net', '@kakao.com'];

type OnboardingWeaponTab = 'video' | 'doc' | 'clean' | 'superpower';

interface SafeOnboardingChatMsg {
  id: string;
  role: 'secretary' | 'user';
  text: string;
  timestamp: string;
}

const WEAPON_META: Record<
  OnboardingWeaponTab,
  {
    chipLabel: string;
    keywordBadge: string;
    userBubble: string;
    secretaryReply: string;
    stageTitle: string;
    stageBadge: string;
    shortVideoUrl: string;
  }
> = {
  video: {
    chipLabel: '🎬 영상 속 대사 1초 점프',
    keywordBadge: '#귀신검색',
    userBubble: '동영상 수백 개 중에 아기 첫 걸음마 장면이 몇 분 몇 초에 나오는지 찾아줘!',
    secretaryReply:
      '영상이 수백 개라도 일일이 틀어보실 필요 없어요! 오른쪽 화면에서 찾고 싶은 장면 키워드(“아기 첫 걸음마”, “제주도 갈치조림”)를 눌러보세요. 0.008초 만에 해당 초(Sec) 구간으로 바로 점프해 드릴게요!',
    stageTitle: '🎬 동영상 안 틀어보고 대사·장면 1초 타임스탬프 점프',
    stageBadge: '무기 1 · #귀신검색 (평생 무료)',
    shortVideoUrl: '/showroom/shorts/ghosti_short_sc552_1793284451.mp4',
  },
  doc: {
    chipLabel: '📊 엑셀·문서 안 열고 찾기',
    keywordBadge: '#귀신검색',
    userBubble: '최종_진짜최종.xlsx 파일 안 열고 표 안의 숫자나 계약서 조항 바로 찾아줘!',
    secretaryReply:
      '엑셀이나 PDF 파일을 더블클릭해서 열지 마세요! 오른쪽 화면에서 찾을 단어를 누르면 닫힌 파일 내부의 몇 번째 시트, 몇 번 셀인지 0.005초 만에 투시해서 바로 보여드립니다!',
    stageTitle: '📊 엑셀·PDF·스캔 서류 더블클릭 없이 본문 0.01초 투시',
    stageBadge: '무기 2 · #귀신검색 (평생 무료)',
    shortVideoUrl: '/showroom/shorts/ghosti_short_sc555_1793284492.mp4',
  },
  clean: {
    chipLabel: '🧹 눈 뜬 사진 1장만 Pick',
    keywordBadge: '#귀신비서',
    userBubble: '비슷한 연사 사진 중에 눈 뜬 베스트 1장만 남기고, 안 쓰는 은행 보안프로그램은 조용히 재워줘!',
    secretaryReply:
      '눈 감고 흔들린 연사 사진은 걸러서 가장 잘 나온 베스트 1장만 남겨드리고(나머지는 Windows 정식 휴지통 안전 격리), 안 쓰는 은행 보안프로그램은 삭제하지 않고 평소엔 조용히 재워두었다가 은행 갈 때만 자동 기상시켜 드려요!',
    stageTitle: '🧹 눈 뜬 인생샷 1장 Pick & 보안모듈 수면 관리 (1초 복원)',
    stageBadge: '무기 3 · #귀신비서 (평생 무료)',
    shortVideoUrl: '/showroom/shorts/ghosti_short_sc558_261106.mp4',
  },
  superpower: {
    chipLabel: '⌨️ 영타 오타 1초 한글 둔갑',
    keywordBadge: '#귀신창',
    userBubble: 'dkssudgktpdy 영타 오타랑 깨진 줄바꿈, 백스페이스 안 누르고 고쳐줘!',
    secretaryReply:
      '버튼 누를 필요 없어요! 예문 칩에서 전/후 비교를 한눈에 보시거나, 입력칸을 클릭해 직접 영타를 치고 스페이스바를 누르면 0.2초 만에 무버튼 자동으로 다림질해 줍니다! 하단에는 Ctrl+V 순차복사와 [1] 파일·라벨러(PDF) ~ [5] 창고정 미니 버튼이 대기해요!',
    stageTitle: '⌨️ dkssud 영타·줄바꿈 0.2초 무버튼 완전 자동(Auto) 성형',
    stageBadge: '무기 4 · #귀신창 v1.4 (평생 무료)',
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

  const [shortsList, setShortsList] = useState<ShortsItem[]>(DEFAULT_SHORTS_DATA);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'video' | 'doc' | 'clean' | 'typo'>('all');
  const [activeShortsModal, setActiveShortsModal] = useState<ShortsItem | null>(null);

  // 공식 보증서 모달 상태
  const [certModalOpen, setCertModalOpen] = useState<boolean>(false);

  // 좌측 귀신비서 채팅창 ⇄ 우측 단일 인터랙티브 체험 스테이지 상태 (100% 독립 안전 상태)
  const [demoTab, setDemoTab] = useState<OnboardingWeaponTab>('video');
  const [showStageShortVideo, setShowStageShortVideo] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<SafeOnboardingChatMsg[]>(() => [
    {
      id: 'init-welcome',
      role: 'secretary',
      text: '반가워요! 저는 컴퓨터·폰 손보기부터 파일 찾기까지 평생 무료로 챙겨드리는 전속 『👻 귀신비서』예요!\n예고편 영상에서 보신 마법 중 어떤 걸 제일 먼저 직접 눌러보고 싶으세요? 아래 4가지 무료 무기 칩 중 하나를 톡 눌러보세요!',
      timestamp: nowTimeStr(),
    },
  ]);
  const [chatInput, setChatInput] = useState<string>('');
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // 우측 단일 스테이지 내부 시뮬레이터 상태
  const [selectedVideoScenarioIdx, setSelectedVideoScenarioIdx] = useState(0);
  const [selectedDocScenarioIdx, setSelectedDocScenarioIdx] = useState(0);
  const [cleanDemoDone, setCleanDemoDone] = useState(false);

  // 무기 4 (귀신창 v1.4 — 100% 무버튼 자동 성형 체험 상태)
  const [typoSampleIdx, setTypoSampleIdx] = useState<number>(0);
  const [typoInput, setTypoInput] = useState<string>('dkssudgktpdy! 오늘 회의자료 rkatkgkqslek. 내일 오전 10시에 뵙겠습니다.');
  const [typoOriginalBackup, setTypoOriginalBackup] = useState<string>('dkssudgktpdy! 오늘 회의자료 rkatkgkqslek. 내일 오전 10시에 뵙겠습니다.');
  const [typoConverted, setTypoConverted] = useState<boolean>(false);
  const [typoIsPresetSample, setTypoIsPresetSample] = useState<boolean>(true);
  const typoDemoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedToolbarKey, setSelectedToolbarKey] = useState<'seq' | '1' | '2' | '3' | '4' | '5'>('1');
  const [labelerDemoApplied, setLabelerDemoApplied] = useState<boolean>(false);

  // DEV 전체보기 전용 내부 상태 보존 (코드 삭제 없이 일반 방문자에게만 은닉)
  const {
    trialScanPermissions,
    setTrialScanPermission,
    pcAgentPairedMobile,
    setPcAgentPairedMobile,
  } = useSaySeeStore();
  const [telemetryEnabled, setTelemetryEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ghosti_telemetry_enabled') !== 'false';
    } catch {
      return true;
    }
  });
  const [showTermsClause, setShowTermsClause] = useState(false);

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

  const handleSelectWeaponChip = (tab: OnboardingWeaponTab) => {
    playBabyGhostChime();
    setDemoTab(tab);
    setShowStageShortVideo(false);
    const meta = WEAPON_META[tab];
    const ts = nowTimeStr();
    setChatMessages((prev) => [
      ...prev.slice(-6),
      { id: `u-${Date.now()}`, role: 'user', text: meta.userBubble, timestamp: ts },
      { id: `s-${Date.now() + 1}`, role: 'secretary', text: meta.secretaryReply, timestamp: ts },
    ]);
  };

  const handleChatFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = chatInput.trim();
    if (!q) return;
    setChatInput('');
    playBabyGhostChime();

    let matchedTab: OnboardingWeaponTab = demoTab;
    if (/영상|동영상|걸음마|대사|장면|초/.test(q)) {
      matchedTab = 'video';
    } else if (/엑셀|문서|계약서|표|단가|pdf|한글/i.test(q)) {
      matchedTab = 'doc';
    } else if (/사진|청소|보안|느려|용량|정리|복원/.test(q)) {
      matchedTab = 'clean';
    } else if (/영타|오타|한영|줄바꿈|귀신창|라벨러|합본|창고정|순차|dkssud/i.test(q)) {
      matchedTab = 'superpower';
      if (/라벨러|파일명|pdf/i.test(q)) setSelectedToolbarKey('1');
      else if (/ocr|표/i.test(q)) setSelectedToolbarKey('2');
      else if (/합본/i.test(q)) setSelectedToolbarKey('3');
      else if (/번호|일정/i.test(q)) setSelectedToolbarKey('4');
      else if (/창고정|고정/i.test(q)) setSelectedToolbarKey('5');
      else if (/순차/i.test(q)) setSelectedToolbarKey('seq');
    }

    setDemoTab(matchedTab);
    setShowStageShortVideo(false);
    const meta = WEAPON_META[matchedTab];
    const ts = nowTimeStr();
    setChatMessages((prev) => [
      ...prev.slice(-6),
      { id: `u-${Date.now()}`, role: 'user', text: q, timestamp: ts },
      { id: `s-${Date.now() + 1}`, role: 'secretary', text: meta.secretaryReply, timestamp: ts },
    ]);
  };

  const TYPO_SAMPLES = [
    {
      label: '⚡ 예문 1: dkssudgktpdy 영타 무버튼 자동성형',
      raw: 'dkssudgktpdy! 오늘 회의자료 rkatkgkqslek. 내일 오전 10시에 뵙겠습니다.',
    },
    {
      label: '⚡ 예문 2: 카톡 영타 외계어 0.2초 자동교정',
      raw: 'rmqgkRp 카톡 Tmr다가 gksdudzl 안 눌러서 멘붕...',
    },
    {
      label: '⚡ 예문 3: PDF 깨진 줄바꿈 무버튼 다림질',
      raw: '계약서에서 복사할 때마다\n\n줄바꿈이 마구 깨져서\n\n일일이 백스페이스 누르셨죠?',
    },
  ];

  const formatTypoAfterPreview = (rawText: string) =>
    convertEngTypoToKor(rawText)
      .replace(/\n{2,}/g, ' ')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();

  // 무기 4 (귀신창 v1.4) 예문 칩 클릭 시 Before ➔ After 비교 배너 표시 + 여유 있는 0.9초 시연
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
    }, 850);
  };

  // superpower 탭 진입 시 먼저 영타 원문을 보여준 뒤 850ms 후 자동으로 무버튼 변환 시연 (상단 Before ➔ After 동시 제공)
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
    }, 850);
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

      {/* 1. 최상단 마스터 GNB */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#070B11]/85 border-b border-white/10 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between gap-4">
          {/* 좌측 브랜드 로고 & 권위 배지 */}
          <div className="flex items-center gap-3">
            <div
              data-ghosti-brand-logo="true"
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => {
                silencePendingEnterGiggleOnLogoClick();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              <img
                src="/gwisinkachi_3d_wordmark_light.png"
                alt="귀신같이 3D 로고"
                className="h-10 w-auto object-contain drop-shadow-[0_2px_12px_rgba(0,240,181,0.4)]"
              />
            </div>
            <div className="hidden xl:flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-[#00F0B5] text-[11px] font-bold whitespace-nowrap shrink-0">
              <span>✓</span>
              <span>개인·기업 PC 기본 기능 영구 무료</span>
            </div>
          </div>

          {/* 중앙 검색 유입 키워드 바로가기 배지 */}
          <nav className="hidden md:flex items-center gap-2 text-xs font-extrabold whitespace-nowrap shrink-0">
            <button
              type="button"
              onClick={() => handleSelectWeaponChip('clean')}
              className={`px-3.5 py-1.5 rounded-full border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                demoTab === 'clean'
                  ? 'bg-[#00F0B5] text-slate-950 border-[#00F0B5]'
                  : 'bg-zinc-900/90 text-zinc-300 border-white/10 hover:border-teal-400/50'
              }`}
            >
              #귀신비서
            </button>
            <button
              type="button"
              onClick={() => handleSelectWeaponChip('video')}
              className={`px-3.5 py-1.5 rounded-full border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                demoTab === 'video' || demoTab === 'doc'
                  ? 'bg-[#00F0B5] text-slate-950 border-[#00F0B5]'
                  : 'bg-zinc-900/90 text-zinc-300 border-white/10 hover:border-teal-400/50'
              }`}
            >
              #귀신검색
            </button>
            <button
              type="button"
              onClick={() => handleSelectWeaponChip('superpower')}
              className={`px-3.5 py-1.5 rounded-full border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                demoTab === 'superpower'
                  ? 'bg-amber-400 text-slate-950 border-amber-400'
                  : 'bg-zinc-900/90 text-zinc-300 border-white/10 hover:border-amber-400/50'
              }`}
            >
              #귀신창
            </button>
            <button
              type="button"
              onClick={() => setCertModalOpen(true)}
              className="px-3.5 py-1.5 rounded-full bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/40 text-amber-300 cursor-pointer whitespace-nowrap shrink-0"
            >
              📜 무료 공식 보증서
            </button>
          </nav>

          {/* 우측 액션 영역 */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {!isLaunched ? (
              verifiedUserEmail ? (
                <div className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 text-xs font-extrabold flex items-center gap-1.5 whitespace-nowrap shrink-0">
                  <span>✅</span>
                  <span className="max-w-[140px] truncate">{verifiedUserEmail}</span>
                  <span className="hidden sm:inline">알림 예약됨</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={scrollToEmailBox}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#00F0B5] to-teal-400 hover:from-teal-300 hover:to-emerald-300 text-slate-950 text-xs sm:text-[13px] font-black shadow-[0_0_20px_rgba(0,240,181,0.35)] transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <span>🔔</span>
                  <span>출시 알림받기</span>
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={() => onEnterWorkspace(true)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#00F0B5] to-teal-400 hover:from-teal-300 hover:to-emerald-300 text-slate-950 text-xs sm:text-[13px] font-black shadow-[0_0_24px_rgba(0,240,181,0.45)] transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <span>🚀</span>
                <span>본 앱 바로 시작하기</span>
              </button>
            )}

            {/* ⚠️ ?dev=true / localhost 접속 시에만 나타나는 개발자 컨트롤 */}
            {isDevAuthorized && (
              <div className="flex items-center gap-1.5 pl-2 border-l border-white/15">
                <button
                  type="button"
                  onClick={() => setDevFullView((v) => !v)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black border transition-all cursor-pointer ${
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
                  className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-teal-300 border border-teal-400/30 text-[11px] font-bold transition-all cursor-pointer"
                >
                  {isLaunched ? '🚀 출시후 뷰' : '⏳ 출시전 뷰'}
                </button>
                <button
                  type="button"
                  onClick={() => onEnterWorkspace(true)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-[#00F0B5] border border-teal-500/40 text-[11px] font-extrabold transition-all cursor-pointer flex items-center gap-1"
                >
                  <span>🧪</span>
                  <span className="hidden sm:inline">본진 워크스페이스</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* =====================================================================
          2. 메인 온보딩 섹션: 좌측 친근한 『👻 귀신비서 채팅창 (5)』 ⇄ 우측 『단일 인터랙티브 스테이지 (7)』
         ===================================================================== */}
      <section className="relative pt-8 pb-16 px-4 sm:px-6 max-w-7xl mx-auto space-y-8">
        {/* 상단 헤드라인 */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-black mb-3">
              <span className="animate-pulse">●</span>
              <span>✓ 개인·기업 PC 기본 기능(내 기기 찾기·손보기·귀신창) 영구 무료 (단속 걱정 ZERO)</span>
            </div>
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight break-keep">
              예고편에서 보신 그 마법,{' '}
              <span className="inline-block text-[#00F0B5]" style={{ color: '#0F766E' }}>
                『👻 귀신비서』와 지금 바로 눌러보세요!
              </span>
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 font-semibold max-w-md break-keep">
            복잡한 가입이나 설치 없이 왼쪽 <b className="text-[#00F0B5]">귀신비서 대화창</b>의 4가지 무료 무기를 누르면 오른쪽 도화지에 즉시 펼쳐집니다.
          </p>
        </div>

        {/* 2단 분할 온보딩 그리드 (좌측 5 : 우측 7) */}
        <div id="interactive-demo" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* -----------------------------------------------------------------
              👈 좌측 (5칸): 친근한 『👻 귀신비서』 표준 채팅창 (100% 안전 격리 복제본)
             ----------------------------------------------------------------- */}
          <aside className="lg:col-span-5 flex flex-col rounded-3xl border border-teal-500/35 bg-zinc-950/95 shadow-[0_20px_60px_rgba(0,0,0,0.65)] overflow-hidden">
            {/* 상단 배너 1: 수요 손 없는 날 & 과부하 자동 검진 (본진 채팅창 동일 스타일) */}
            <div className="px-4 py-2.5 border-b border-emerald-500/20 bg-emerald-950/40 flex flex-wrap items-center justify-between gap-1.5 text-[11.5px] font-extrabold text-emerald-300">
              <span>🗓️ 매주 수요일 오후 1시 「수요 손 없는 날」</span>
              <span className="text-teal-300 font-bold">⚡ 20% 과부하 시 자동 검진</span>
            </div>

            {/* 상단 배너 2: 복원 안전 보장 & 공식 무료 보증서 버튼 */}
            <div className="px-4 py-2 bg-zinc-900/90 border-b border-white/10 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 min-w-0 text-emerald-200 font-bold truncate">
                <span>🛡️</span>
                <span className="truncate">내 파일 외부 서버 전송 0 Byte · 1초 타임머신 복원</span>
              </div>
              <button
                type="button"
                onClick={() => setCertModalOpen(true)}
                className="px-2.5 py-1 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/40 text-amber-300 text-[11px] font-extrabold shrink-0 cursor-pointer whitespace-nowrap"
              >
                📜 무료 보증서
              </button>
            </div>

            {/* 대화 스트림 영역 (노션 스타일 미니멀 버블) */}
            <div
              ref={chatScrollRef}
              className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5 min-h-[250px] max-h-[340px] bg-zinc-950/80"
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
                          <span className="text-[10.5px] text-zinc-500">{msg.timestamp}</span>
                          <span className="text-xs font-bold text-teal-300">나</span>
                        </>
                      ) : (
                        <>
                          <span className="text-xs font-extrabold text-[#00F0B5] flex items-center gap-1.5">
                            <img
                              src="/gwisinkachi_app_icon_512.png"
                              alt="귀신비서"
                              className="w-6 h-6 rounded-full object-cover shadow-sm ring-1 ring-[#00F0B5]/50"
                            />
                            귀신비서
                          </span>
                          <span className="text-[10.5px] text-zinc-500">{msg.timestamp}</span>
                        </>
                      )}
                    </div>
                    <div
                      data-keep-dark={isUser ? 'true' : undefined}
                      style={isUser ? { backgroundColor: '#0D9488', color: '#FFFFFF' } : undefined}
                      className={`max-w-[94%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed whitespace-pre-line shadow-sm break-keep ${
                        isUser
                          ? 'bg-teal-600 text-white rounded-tr-sm border border-teal-500 font-bold'
                          : 'bg-zinc-900 border border-white/10 text-zinc-100 rounded-tl-sm font-medium'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 4대 무료 핵심 무기 선택 칩 (클릭 시 우측 단일 스테이지 즉시 전환) */}
            <div className="p-3.5 bg-zinc-900/90 border-t border-white/10 space-y-2">
              <div className="text-[11px] font-extrabold text-teal-300 flex items-center justify-between px-1">
                <span>👇 4가지 무료 초능력 중 하나를 눌러보세요!</span>
                <span className="text-zinc-400">우측 화면에 즉시 펼쳐집니다</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(['video', 'doc', 'clean', 'superpower'] as OnboardingWeaponTab[]).map((tabKey) => {
                  const item = WEAPON_META[tabKey];
                  const isActive = demoTab === tabKey;
                  return (
                    <button
                      key={tabKey}
                      type="button"
                      onClick={() => handleSelectWeaponChip(tabKey)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1 ${
                        isActive
                          ? 'bg-teal-950/80 border-[#00F0B5] shadow-[0_0_20px_rgba(0,240,181,0.25)] scale-[1.01]'
                          : 'bg-zinc-950/80 hover:bg-zinc-900 border-white/10 hover:border-white/25'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-black text-white truncate">
                          {item.chipLabel}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-black shrink-0 ${
                            isActive
                              ? 'bg-[#00F0B5] text-slate-950'
                              : 'bg-white/10 text-zinc-300'
                          }`}
                        >
                          {item.keywordBadge}
                        </span>
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
                placeholder="귀신비서에게 물어보세요 (예: 엑셀 안 열고 찾기, 영타 자동성형)"
                className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-zinc-900 border border-white/15 focus:border-[#00F0B5] text-xs sm:text-[13px] text-white placeholder-zinc-500 outline-none"
              />
              <button
                type="submit"
                className="px-3.5 py-2 rounded-xl bg-[#00F0B5] hover:bg-teal-300 text-slate-950 font-black text-xs shrink-0 cursor-pointer"
              >
                전송
              </button>
            </form>
          </aside>

          {/* -----------------------------------------------------------------
              👉 우측 (7칸): 단일 인터랙티브 체험 스테이지 (클릭한 1개만 큼직하게 펼침 + 사전등록 직결)
             ----------------------------------------------------------------- */}
          <div className="lg:col-span-7 flex flex-col justify-between rounded-3xl bg-gradient-to-b from-zinc-900/95 to-zinc-950/95 border-2 border-teal-500/40 p-5 sm:p-7 shadow-[0_25px_70px_rgba(0,0,0,0.65)] space-y-6">
            {/* 스테이지 상단 헤더 */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
              <div>
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#00F0B5]/20 text-[#00F0B5] text-[11px] font-black mb-1">
                  {activeMeta.stageBadge}
                </span>
                <h2 className="text-lg sm:text-2xl font-black text-white">
                  {activeMeta.stageTitle}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setShowStageShortVideo((v) => !v)}
                className={`px-3.5 py-2 rounded-xl text-xs font-black border transition-all cursor-pointer flex items-center gap-1.5 ${
                  showStageShortVideo
                    ? 'bg-[#00F0B5] text-slate-950 border-[#00F0B5]'
                    : 'bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 border-amber-400/40'
                }`}
              >
                <span>▶</span>
                <span>{showStageShortVideo ? '⚡ 직접 눌러보는 체험 모드로 복귀' : '🎥 15초 실제 예고편 영상 보기'}</span>
              </button>
            </div>

            {/* 스테이지 본문: 15초 예고편 비디오 뷰 또는 단일 인터랙티브 체험 */}
            {showStageShortVideo ? (
              <div className="rounded-2xl bg-black/80 border border-white/15 p-4 flex flex-col sm:flex-row items-center gap-5">
                <div className="w-52 sm:w-56 aspect-[9/16] rounded-xl overflow-hidden border border-white/20 shrink-0 bg-zinc-950">
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
                  <span className="px-2.5 py-1 rounded-full bg-teal-500/20 text-[#00F0B5] text-xs font-black">
                    🎬 공식 15초 쇼츠 예고편 ({activeMeta.keywordBadge})
                  </span>
                  <h3 className="text-lg font-black text-white leading-snug">
                    {activeMeta.stageTitle}
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                    클라우드 업로드 0 Byte! 내 PC와 스마트폰 안에서 100% 무료로 즉시 작동합니다.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowStageShortVideo(false)}
                    className="px-4 py-2.5 rounded-xl bg-[#00F0B5] hover:bg-teal-300 text-slate-950 font-black text-xs cursor-pointer"
                  >
                    ⚡ 내가 직접 버튼 눌러서 체험해 보기 ➔
                  </button>
                </div>
              </div>
            ) : (
              <div>
                {/* ① 동영상 장면 1초 점프 (#귀신검색) */}
                {demoTab === 'video' && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-zinc-400 mr-1">
                        🔍 찾을 대사·장면 클릭:
                      </span>
                      {INTERACTIVE_SCENARIOS.video.map((item, idx) => (
                        <button
                          key={item.query}
                          type="button"
                          onClick={() => {
                            playBabyGhostChime();
                            setSelectedVideoScenarioIdx(idx);
                          }}
                          className={`px-3.5 py-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                            selectedVideoScenarioIdx === idx
                              ? 'bg-[#00F0B5] text-slate-950 border-[#00F0B5] shadow-[0_0_15px_rgba(0,240,181,0.35)]'
                              : 'bg-zinc-900 text-zinc-300 border-white/10 hover:border-white/30'
                          }`}
                        >
                          “{item.query}”
                        </button>
                      ))}
                    </div>

                    <div className="rounded-2xl bg-zinc-950 border border-teal-500/40 p-5 shadow-inner space-y-3">
                      <div className="flex items-center justify-between text-xs text-zinc-400 pb-2.5 border-b border-white/10">
                        <span className="font-mono text-teal-300 font-bold truncate">
                          📁 {INTERACTIVE_SCENARIOS.video[selectedVideoScenarioIdx].file}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-extrabold shrink-0">
                          ⚡ {INTERACTIVE_SCENARIOS.video[selectedVideoScenarioIdx].latency} 포착
                        </span>
                      </div>
                      <div className="rounded-xl bg-gradient-to-br from-teal-950/90 via-slate-900 to-zinc-950 border border-teal-500/30 p-4 space-y-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00F0B5] text-slate-950 text-xs font-black">
                          <span>▶</span>
                          <span>
                            정확히 {INTERACTIVE_SCENARIOS.video[selectedVideoScenarioIdx].timestamp} 구간으로 자동 점프!
                          </span>
                        </div>
                        <p className="text-white font-black text-sm sm:text-base">
                          {INTERACTIVE_SCENARIOS.video[selectedVideoScenarioIdx].transcript}
                        </p>
                        <p className="text-xs text-teal-300 font-bold">
                          🎯 AI 장면 인식: {INTERACTIVE_SCENARIOS.video[selectedVideoScenarioIdx].sceneDesc}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ② 엑셀·문서 안 열고 찾기 (#귀신검색) */}
                {demoTab === 'doc' && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-zinc-400 mr-1">
                        📄 파일 안 열고 찾을 단어 클릭:
                      </span>
                      {INTERACTIVE_SCENARIOS.doc.map((item, idx) => (
                        <button
                          key={item.query}
                          type="button"
                          onClick={() => {
                            playBabyGhostChime();
                            setSelectedDocScenarioIdx(idx);
                          }}
                          className={`px-3.5 py-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                            selectedDocScenarioIdx === idx
                              ? 'bg-[#00F0B5] text-slate-950 border-[#00F0B5] shadow-[0_0_15px_rgba(0,240,181,0.35)]'
                              : 'bg-zinc-900 text-zinc-300 border-white/10 hover:border-white/30'
                          }`}
                        >
                          “{item.query}”
                        </button>
                      ))}
                    </div>

                    <div className="rounded-2xl bg-zinc-950 border border-teal-500/40 p-5 shadow-inner space-y-3">
                      <div className="flex items-center justify-between text-xs text-zinc-400 pb-2.5 border-b border-white/10">
                        <span className="font-mono text-teal-300 font-bold truncate">
                          📄 {INTERACTIVE_SCENARIOS.doc[selectedDocScenarioIdx].file}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-extrabold shrink-0">
                          ⚡ {INTERACTIVE_SCENARIOS.doc[selectedDocScenarioIdx].latency}
                        </span>
                      </div>
                      <div className="rounded-xl bg-gradient-to-br from-blue-950/70 via-slate-900 to-zinc-950 border border-teal-500/30 p-4 space-y-2">
                        <span className="inline-block px-2.5 py-1 rounded bg-amber-400/20 text-amber-300 text-xs font-extrabold">
                          📍 발견 위치: {INTERACTIVE_SCENARIOS.doc[selectedDocScenarioIdx].location}
                        </span>
                        <p className="text-white font-bold text-xs sm:text-sm leading-relaxed bg-black/50 p-3.5 rounded-xl border border-white/10">
                          {INTERACTIVE_SCENARIOS.doc[selectedDocScenarioIdx].previewSnippet}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ③ 눈 뜬 사진 1장만 Pick (#귀신비서) */}
                {demoTab === 'clean' && (
                  <div className="rounded-2xl bg-zinc-950 border border-teal-500/40 p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm sm:text-base font-black text-white">
                          🧹 연속 촬영한 비슷한 사진 6장 중 눈 뜬 『베스트 1장』만 남기기
                        </h4>
                        <p className="text-xs text-zinc-400 mt-0.5 break-keep">
                          흔들린 5장은 <b>Windows 정식 휴지통($Recycle.Bin)</b>에 안전 격리되어 1초 만에 복원되며, 안 쓰는 은행 보안프로그램은 삭제하지 않고 평소엔 조용히 재워두었다가 은행 갈 때만 자동 기상시킵니다.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          playBabyGhostChime();
                          setCleanDemoDone(!cleanDemoDone);
                        }}
                        className={`px-4 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer shrink-0 ${
                          cleanDemoDone
                            ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-lg'
                            : 'bg-[#00F0B5] hover:bg-teal-300 text-slate-950 shadow-[0_0_20px_rgba(0,240,181,0.4)]'
                        }`}
                      >
                        {cleanDemoDone ? '↩️ 1초 타임머신으로 5장 복원하기' : '✨ 베스트 1장만 남기고 5장 정리 체험'}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
                      {[
                        { id: 1, label: '컷 #1 (흔들림)', best: false },
                        { id: 2, label: '컷 #2 (눈 감음)', best: false },
                        { id: 3, label: '컷 #3 (베스트!)', best: true },
                        { id: 4, label: '컷 #4 (초점 흐림)', best: false },
                        { id: 5, label: '컷 #5 (고개 돌아감)', best: false },
                        { id: 6, label: '컷 #6 (역광)', best: false },
                      ].map((shot) => {
                        const isMovedToTrash = cleanDemoDone && !shot.best;
                        return (
                          <div
                            key={shot.id}
                            className={`p-2.5 rounded-xl border text-center transition-all duration-300 ${
                              shot.best
                                ? 'bg-teal-950/70 border-2 border-[#00F0B5] shadow-[0_0_15px_rgba(0,240,181,0.25)] scale-[1.02]'
                                : isMovedToTrash
                                ? 'bg-zinc-900/30 border-white/5 opacity-35 scale-95'
                                : 'bg-zinc-900/80 border-white/10'
                            }`}
                          >
                            <div className="text-xl mb-1">
                              {shot.best ? '👑' : isMovedToTrash ? '🗑️' : '🖼️'}
                            </div>
                            <div className="text-[11px] font-extrabold text-white">
                              {shot.best ? '베스트 Pick' : isMovedToTrash ? '휴지통 격리' : `연사 #${shot.id}`}
                            </div>
                            <div className="text-[10px] text-zinc-400 mt-0.5">{shot.label}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ④ 귀신창 v1.4 — 100% 무버튼 완전 자동(Auto) 한영·줄바꿈 성형 체험 */}
                {demoTab === 'superpower' && (
                  <div className="rounded-2xl bg-zinc-950 border border-amber-400/40 p-5 space-y-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-zinc-300">
                        ⌨️ <strong className="text-amber-300">수동 버튼 ZERO!</strong> 예문 칩에서 전·후 변화를 한눈에 보시거나, 아래 입력칸을 클릭해 직접 영타를 치고 스페이스바만 눌러보세요:
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-[11px] font-black text-emerald-300">
                        ⚡ 100% 무버튼 Auto 성형 가동 중
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {TYPO_SAMPLES.map((sample, sIdx) => {
                        const isSelectedSample = typoSampleIdx === sIdx && typoIsPresetSample;
                        return (
                          <button
                            key={sIdx}
                            type="button"
                            onClick={() => triggerTypoAutoIron(sample.raw, sIdx)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
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

                    {/* Before ➔ After 한눈에 비교하는 상시 프리뷰 배너 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 rounded-2xl bg-zinc-900/90 border border-white/10 p-3 text-xs">
                      <div className="rounded-xl bg-zinc-950/90 border border-rose-400/25 p-2.5 space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-extrabold text-rose-300">
                          <span>Before · 영타/깨진 줄바꿈 원문</span>
                          <span className="text-[10px] text-zinc-500">한영키 실수</span>
                        </div>
                        <p className="font-mono text-zinc-300 font-semibold whitespace-pre-line leading-relaxed break-keep">
                          {typoOriginalBackup || TYPO_SAMPLES[typoSampleIdx].raw}
                        </p>
                      </div>
                      <div className="rounded-xl bg-emerald-950/45 border border-[#00F0B5]/40 p-2.5 space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-extrabold text-[#00F0B5]">
                          <span>After · 0.2초 무버튼 자동 성형</span>
                          <span>✨ 스페이스바 즉시</span>
                        </div>
                        <p className="text-emerald-100 font-extrabold leading-relaxed break-keep">
                          {formatTypoAfterPreview(typoOriginalBackup || TYPO_SAMPLES[typoSampleIdx].raw)}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between px-1 text-[11px]">
                        <span className="font-extrabold text-amber-300">
                          👇 직접 테스트 입력칸 {typoIsPresetSample ? '(마우스로 클릭하면 예시가 지워지고 바로 입력할 수 있어요!)' : '(영타 입력 후 스페이스바를 탁 눌러보세요!)'}
                        </span>
                        {!typoIsPresetSample && typoInput && (
                          <button
                            type="button"
                            onClick={() => {
                              setTypoInput('');
                              setTypoConverted(false);
                            }}
                            className="text-zinc-400 hover:text-white underline font-bold cursor-pointer"
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
                        className={`w-full rounded-2xl p-3.5 text-sm sm:text-base font-extrabold transition-all outline-none border-2 ${
                          typoConverted
                            ? 'bg-emerald-950/60 border-[#00F0B5] text-emerald-100 shadow-[0_0_20px_rgba(0,240,181,0.15)]'
                            : 'bg-zinc-900 border-amber-400/40 focus:border-[#00F0B5] text-white placeholder-zinc-500'
                        }`}
                      />
                    </div>

                    {/* 확정 기준점 한 줄 핵심 요약 안내 */}
                    <div className="rounded-xl bg-emerald-950/35 border border-emerald-500/30 px-3 py-2 text-[11.5px] text-emerald-200 font-bold leading-relaxed break-keep">
                      🛡️ <span className="text-[#00F0B5] font-extrabold">2어절 연속 오타 시 Space/0.55초 자동전환</span> · <span className="text-amber-300 font-extrabold">9타/4음절 긴 오타는 Space 시 전환</span> · <span className="text-white font-extrabold">이메일(@)/복붙/비번 100% 보호</span>
                    </div>

                    {/* 귀신창 v1.4 표준 하단 미니 툴바 ([1]파일·라벨러 ~ [5]창고정 인터랙티브 클릭 탭 + 실물 예시 패널) */}
                    <div className="rounded-2xl bg-zinc-900/95 border border-white/15 p-3 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="귀신창 미니 툴바 기능 설명">
                          {(
                            [
                              { key: 'seq', label: '📋 Ctrl+V 순차복사' },
                              { key: '1', label: '[1] 🏷️파일·라벨러(PDF)' },
                              { key: '2', label: '[2] 글자·표OCR' },
                              { key: '3', label: '[3] 합본' },
                              { key: '4', label: '[4] 번호·일정' },
                              { key: '5', label: '[5] 창고정' },
                            ] as const
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
                                  if (item.key !== '1') setLabelerDemoApplied(false);
                                }}
                                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer border ${
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
                            <span className="text-xs font-black text-[#00F0B5]">
                              ✨ 무버튼 0.2초 자동 성형 완료!
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={handleTypoUndo}
                            className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-bold cursor-pointer"
                          >
                            ↩️ 원본 보기(Ctrl+Z)
                          </button>
                        </div>
                      </div>

                      {/* 선택된 미니 툴바 번호의 상세 설명 + Before ➔ After 실물 예시 카드 */}
                      {selectedToolbarKey === '1' && (
                        <div className="rounded-xl bg-zinc-950/95 border border-amber-400/35 p-3 space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-xs sm:text-[13px] font-black text-amber-300">
                              🏷️ [1] 파일·라벨러(PDF) — 사진·카톡·문서 날짜별 파일명 1초 자동 정리 & 스샷 PDF 합본
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                playBabyGhostChime();
                                setLabelerDemoApplied((prev) => !prev);
                              }}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                                labelerDemoApplied
                                  ? 'bg-[#00F0B5] text-slate-950'
                                  : 'bg-amber-400/20 hover:bg-amber-400 hover:text-slate-950 text-amber-200 border border-amber-400/40'
                              }`}
                            >
                              {labelerDemoApplied ? '✨ 3건 일괄 작명 완료! (원본 비교)' : '⚡ 숫자 [1]키 눌러 이름 변환 체험'}
                            </button>
                          </div>
                          <p className="text-[11.5px] text-zinc-300 leading-relaxed font-semibold">
                            탐색기에서 사진·문서 선택(또는 <span className="text-white font-extrabold">Ctrl+C</span> 복사) 후 귀신창 호출(<span className="text-amber-300 font-extrabold">Ctrl+0</span> / <span className="text-amber-300 font-extrabold">우클릭 꾹</span>) ➔ <span className="text-[#00F0B5] font-extrabold">숫자 1키!</span> (스샷 2장 이상 캡처 후 1키를 누르면 고화질 PDF 1개로 합본 변환)
                          </p>
                          <div className="grid grid-cols-1 gap-1.5 pt-0.5">
                            {[
                              {
                                badge: '① 직접 찍은 사진 (EXIF 촬영일)',
                                before: 'IMG_4821.JPG',
                                after: '261107_제주가족여행.jpg',
                              },
                              {
                                badge: '② 카톡 수신 사진 (파일명 날짜 인식)',
                                before: 'KakaoTalk_20261106_1422.jpg',
                                after: '261106_카톡_영수증.jpg',
                              },
                              {
                                badge: '③ 일반 문서 (본문 첫 날짜 추출 · 전화번호 010-2026-1234/금액 오인 방어)',
                                before: '문서_001.txt',
                                after: '250315_내용_임대차계약서.txt',
                              },
                            ].map((row, idx) => (
                              <div
                                key={idx}
                                className="rounded-lg bg-zinc-900/90 border border-white/10 px-2.5 py-1.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]"
                              >
                                <span className="text-zinc-400 font-bold">{row.badge}</span>
                                <div className="flex items-center gap-1.5 font-mono font-bold">
                                  <span className={labelerDemoApplied ? 'line-through text-zinc-500' : 'text-zinc-300'}>
                                    {row.before}
                                  </span>
                                  <span className="text-amber-400">➔</span>
                                  <span className="text-[#00F0B5] font-extrabold">{row.after}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {selectedToolbarKey !== '1' && (
                        <div className="rounded-xl bg-zinc-950/95 border border-white/15 p-3 space-y-1.5">
                          {selectedToolbarKey === 'seq' && (
                            <>
                              <div className="text-xs sm:text-[13px] font-black text-amber-300">
                                📋 Ctrl+V 순차·칸맞춤 복사 — 여러 줄 복사해 두고 Ctrl+V만 연타하면 순서대로 착착!
                              </div>
                              <p className="text-[11.5px] text-zinc-300 font-semibold">
                                이름·연락처·주소를 차례대로 <span className="text-white font-extrabold">Ctrl+C</span> 해 두면 창을 왔다 갔다 할 필요 없이 입력칸마다 <span className="text-[#00F0B5] font-extrabold">Ctrl+V</span>만 눌러 순서대로 자동 입력합니다.
                              </p>
                              <div className="text-[11px] font-mono font-bold bg-zinc-900 rounded-lg px-2.5 py-1.5 border border-white/10 flex flex-wrap items-center gap-1.5">
                                <span className="text-zinc-400">홍길동 · 010-1234-5678 · 강남구 연속 복사</span>
                                <span className="text-amber-400">➔</span>
                                <span className="text-[#00F0B5]">신청서 빈칸마다 Ctrl+V 3번으로 1초 입력 끝</span>
                              </div>
                            </>
                          )}
                          {selectedToolbarKey === '2' && (
                            <>
                              <div className="text-xs sm:text-[13px] font-black text-amber-300">
                                🔍 [2] 글자·표OCR — 복사 막힌 이미지·스캔 표도 드래그 한 번에 텍스트 추출
                              </div>
                              <p className="text-[11.5px] text-zinc-300 font-semibold">
                                귀신창 호출 후 <span className="text-[#00F0B5] font-extrabold">숫자 2키</span>를 누르고 화면의 이미지·스캔 문서 영역을 드래그하면 표와 글자를 1초 만에 추출해 복사합니다.
                              </p>
                              <div className="text-[11px] font-mono font-bold bg-zinc-900 rounded-lg px-2.5 py-1.5 border border-white/10 flex flex-wrap items-center gap-1.5">
                                <span className="text-zinc-400">드래그 안 되는 스캔 견적서·이미지 표</span>
                                <span className="text-amber-400">➔</span>
                                <span className="text-[#00F0B5]">엑셀·메모장에 바로 붙여넣는 깔끔한 표·글자 변환</span>
                              </div>
                            </>
                          )}
                          {selectedToolbarKey === '3' && (
                            <>
                              <div className="text-xs sm:text-[13px] font-black text-amber-300">
                                📎 [3] 합본 — 여러 번 따로 복사한 문장 조각들을 깔끔한 1개 본문으로 합치기
                              </div>
                              <p className="text-[11.5px] text-zinc-300 font-semibold">
                                문서 여러 곳에서 <span className="text-white font-extrabold">Ctrl+C</span>로 모아 둔 문장 조각들을 귀신창 <span className="text-[#00F0B5] font-extrabold">숫자 3키</span> 한 번으로 줄바꿈 정리된 단일 문단으로 합칩니다.
                              </p>
                              <div className="text-[11px] font-mono font-bold bg-zinc-900 rounded-lg px-2.5 py-1.5 border border-white/10 flex flex-wrap items-center gap-1.5">
                                <span className="text-zinc-400">보고서·기사 핵심 문단 3곳 각각 복사</span>
                                <span className="text-amber-400">➔</span>
                                <span className="text-[#00F0B5]">숫자 3키 한 번에 1개의 통합 본문으로 완성</span>
                              </div>
                            </>
                          )}
                          {selectedToolbarKey === '4' && (
                            <>
                              <div className="text-xs sm:text-[13px] font-black text-amber-300">
                                📅 [4] 번호·일정 — 기존 글자 색상·굵기 서식 100% 보존 하이픈·요일 자동 성형
                              </div>
                              <p className="text-[11.5px] text-zinc-300 font-semibold">
                                연달아 친 전화번호·날짜 위에서 귀신창 <span className="text-[#00F0B5] font-extrabold">숫자 4키</span>를 누르면 노션·워드의 파란색/빨간색 글자 서식을 그대로 유지한 채 표준 형식으로 바꿉니다.
                              </p>
                              <div className="text-[11px] font-mono font-bold bg-zinc-900 rounded-lg px-2.5 py-1.5 border border-white/10 flex flex-wrap items-center gap-1.5">
                                <span className="text-zinc-400">01012345678 / 20260508</span>
                                <span className="text-amber-400">➔</span>
                                <span className="text-[#00F0B5]">010-1234-5678 / 2026-05-08(금)</span>
                              </div>
                            </>
                          )}
                          {selectedToolbarKey === '5' && (
                            <>
                              <div className="text-xs sm:text-[13px] font-black text-amber-300">
                                📌 [5] 창고정 — 참고 중인 창이 절대 뒤로 숨지 않게 화면 맨 위에 압정 고정
                              </div>
                              <p className="text-[11.5px] text-zinc-300 font-semibold">
                                계산기·영수증·메모장 창 위에서 귀신창 <span className="text-[#00F0B5] font-extrabold">숫자 5키</span>를 누르면 다른 프로그램에 타이핑해도 창이 가려지지 않도록 최상단에 고정(재입력 시 해제)합니다.
                              </p>
                              <div className="text-[11px] font-mono font-bold bg-zinc-900 rounded-lg px-2.5 py-1.5 border border-white/10 flex flex-wrap items-center gap-1.5">
                                <span className="text-zinc-400">타이핑할 때마다 뒤로 숨는 참고 창</span>
                                <span className="text-amber-400">➔</span>
                                <span className="text-[#00F0B5]">숫자 5키로 화면 맨 위 고정(📌) 후 편하게 대조 입력</span>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ===============================================================
                [2턴 즉시 전환 영역] 체험 직후 바로 이어지는 이메일 10초 사전등록 / 출시 후 시작 박스
               =============================================================== */}
            <div ref={heroCtaRef} className="pt-2 border-t border-white/10">
              {!isLaunched ? (
                <div className="rounded-2xl bg-zinc-950/95 border border-teal-500/40 p-4 sm:p-5">
                  {verifiedUserEmail ? (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="text-xs sm:text-sm font-black text-[#00F0B5] flex items-center gap-1.5">
                          <span>🎉</span>
                          <span>
                            {dbSyncStatus === 'syncing'
                              ? '알림 예약 등록 중...'
                              : `${verifiedUserEmail} 님, 사전 무료 가입 & 출시 1순위 알림 예약 완료!`}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-300 mt-1">
                          정식 오픈 당일 가장 먼저 시작 링크를 보내드립니다. 회사·매장 비치용 무료 보증서도 미리 확인해 보세요!
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setCertModalOpen(true)}
                          className="px-3.5 py-2 rounded-xl bg-amber-400 text-slate-950 font-black text-xs cursor-pointer"
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
                            resetOtp();
                          }}
                          className="px-2.5 py-2 text-[11px] text-zinc-400 hover:text-zinc-200 underline cursor-pointer"
                        >
                          이메일 변경
                        </button>
                      </div>
                    </div>
                  ) : otpStatus === 'sent' || otpStatus === 'verifying' ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs sm:text-sm font-extrabold text-[#00F0B5]">
                          📩 {emailInput.trim().toLowerCase()}로 발송된 인증번호 6자리를 입력해 주세요!
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-mono font-bold">
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
                      {otpError && <p className="text-xs text-rose-400 font-bold text-center">⚠️ {otpError}</p>}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={otpStatus === 'verifying' || otpDigits.join('').length < 6}
                          onClick={() => void handleVerifyOtpCode(otpDigits.join(''))}
                          className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#00F0B5] to-teal-400 text-slate-950 font-black text-xs sm:text-sm cursor-pointer"
                        >
                          {otpStatus === 'verifying' ? '인증 확인 중...' : '✅ 인증 완료하고 출시 1순위 알림 예약하기'}
                        </button>
                        <button
                          type="button"
                          onClick={() => resetOtp()}
                          className="px-3 py-3 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold cursor-pointer"
                        >
                          다시 입력
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleRequestEmailVerification} className="space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5">
                          <span>🔔</span>
                          <span>방금 눌러보신 『귀신같이』, 정식 오픈 당일 1순위로 받아보실래요?</span>
                        </span>
                        <span className="text-[11px] font-extrabold text-[#00F0B5]">
                          신용카드 등록 없음 · 10초 사전등록
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
                          className="flex-1 px-4 py-3 rounded-xl bg-zinc-900 border border-white/15 focus:border-[#00F0B5] text-white placeholder-zinc-500 text-xs sm:text-sm font-medium outline-none"
                        />
                        <button
                          type="submit"
                          disabled={otpStatus === 'sending'}
                          className="px-5 py-3 rounded-xl bg-gradient-to-r from-[#00F0B5] via-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 text-slate-950 font-black text-xs sm:text-sm shadow-[0_4px_20px_rgba(0,240,181,0.35)] shrink-0 cursor-pointer"
                        >
                          {otpStatus === 'sending' ? '발송 중...' : '🔔 출시 알림받기 (10초 인증)'}
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-400">
                        <span>원터치 도메인:</span>
                        {QUICK_EMAIL_DOMAINS.map((domain) => (
                          <button
                            key={domain}
                            type="button"
                            onClick={() => applyQuickDomain(domain)}
                            className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-[#00F0B5] border border-white/10 font-mono cursor-pointer"
                          >
                            {domain}
                          </button>
                        ))}
                      </div>
                      {(formNotice || otpError) && (
                        <p className="text-xs text-rose-400 font-bold">⚠️ {formNotice || otpError}</p>
                      )}
                    </form>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl bg-zinc-950/95 border border-[#00F0B5]/50 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-extrabold text-[#00F0B5] mb-1">
                      🎉 정식 무료 배포 오픈! 내 PC 속 진짜 파일을 1초 만에 찾아보세요
                    </div>
                    <p className="text-xs text-zinc-300">
                      원클릭으로 본 앱 워크스페이스에 입장하거나 Windows PC 엔진(Z-코어)을 받을 수 있습니다.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onEnterWorkspace(true)}
                      className="px-5 py-3 rounded-xl bg-gradient-to-r from-[#00F0B5] to-teal-400 text-slate-950 font-black text-xs sm:text-sm cursor-pointer shadow-lg"
                    >
                      🚀 본 앱 바로 시작하기 ➔
                    </button>
                    <a
                      href="/Merlin_Z_Core.zip"
                      download="Merlin_Z_Core.zip"
                      className="px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-[#00F0B5]/40 text-[#00F0B5] font-extrabold text-xs"
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
                <div className="font-black text-[#00F0B5]">🟢 1단계 무료 오픈 (현재 일반 노출)</div>
                <p className="text-zinc-300 leading-relaxed">
                  내 PC·폰 로컬 검색 + 내 기기 스마트 청소/보안관 + 귀신창 v1.4 (무버튼 자동 한영·띄어쓰기·줄바꿈 성형 + Ctrl+V 순차복사 + [1]파일·라벨러 ~ [5]창고정)
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-zinc-950 border border-white/10 space-y-1.5">
                <div className="font-black text-amber-300">🔒 2단계 유료/확장 티어 (일반 유저 은닉)</div>
                <p className="text-zinc-300 leading-relaxed">
                  • 무기 1 확장 (유료 개인 구독): 폰 ⇄ 집·회사 PC 원격 파일 찾기 & 열람<br />
                  • 무기 4 확장 (유료 B2B 팀 플랜): 사내 업무 공유 (S: 드라이브 팀 세팅 & 권한 관리)
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
                  <span className="text-[11px] font-extrabold text-teal-300">📱 스마트폰 QR 연결</span>
                  <button
                    type="button"
                    onClick={() => setPcAgentPairedMobile(!pcAgentPairedMobile)}
                    className="text-left text-[10.5px] text-emerald-400 font-bold cursor-pointer"
                  >
                    {pcAgentPairedMobile ? '● 내 폰 연결됨' : '○ 연결 상태 토글'}
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11.5px]">
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
          3. 중단 공식 15초 쇼츠 예고편 영상관 (#귀신비서 · #귀신검색 · #귀신창)
         ===================================================================== */}
      <section id="shorts" className="py-16 px-4 sm:px-6 max-w-7xl mx-auto border-t border-white/5">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/10 text-teal-400 text-xs font-bold mb-3">
            <span>🎬</span>
            <span>유튜브·인스타·네이버 화제의 15초 공식 예고편 쇼룸</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black tracking-tight mb-3 break-keep">
            15초만 보면 바로 이해되는 『귀신같이』 핵심 예고편
          </h2>
          <p className="text-zinc-400 text-xs sm:text-sm break-keep">
            영상에서 보신 <b className="text-[#00F0B5]">#귀신비서 · #귀신검색 · #귀신창</b> 6편의 쇼츠를 한자리에서 바로 재생해 보세요.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
            {[
              { id: 'all', label: `전체 예고편 (${shortsList.length})` },
              { id: 'video', label: '🎬 동영상 1초 점프 (#귀신검색)' },
              { id: 'doc', label: '📊 엑셀·문서 투시 (#귀신검색)' },
              { id: 'clean', label: '🧹 사진·보안앱 청소 (#귀신비서)' },
              { id: 'typo', label: '⌨️ 무버튼 자동 한영성형 (#귀신창)' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedCategory(tab.id as any)}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
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
                        className="text-[11px] font-extrabold px-3 py-1 rounded-full border border-teal-400/50 shadow"
                      >
                        15초 영상 바로 재생
                      </span>
                    </div>
                    <span
                      style={{ backgroundColor: 'rgba(15, 23, 42, 0.88)', color: '#FFFFFF' }}
                      className="absolute top-2.5 left-2.5 text-[10.5px] font-extrabold px-2.5 py-1 rounded-md shadow"
                    >
                      {item.tag}
                    </span>
                  </div>

                  <h3 className="font-black text-base text-zinc-100 group-hover:text-[#00F0B5] transition-colors leading-snug mb-2 break-keep">
                    {item.title}
                  </h3>
                  <div className="text-xs text-zinc-300 font-semibold mb-1.5 line-clamp-2 break-keep">
                    {item.hookLine}
                  </div>
                  <div className="text-xs text-teal-300 font-extrabold mb-3 line-clamp-2 break-keep">
                    👉 {item.solutionLine}
                  </div>
                </div>

                <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-400">
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
          4. 📜 개인·기업 PC 기본 기능 영구 무료 공식 보증서 배너 (#security)
         ===================================================================== */}
      <section id="security" className="py-12 px-4 sm:px-6 max-w-7xl mx-auto border-t border-white/5">
        <div className="rounded-3xl bg-gradient-to-r from-zinc-900 via-teal-950/60 to-zinc-900 border-2 border-amber-400/40 p-6 sm:p-9 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center shadow-2xl">
          <div className="lg:col-span-8 space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-black">
              <span>📜</span>
              <span>대표이사 직인 날인 · 법적 효력 공식 보증서 발급</span>
            </div>
            <h3 className="text-xl sm:text-3xl font-black text-white leading-tight">
              “회사 컴퓨터에 깔아도 저작권 단속 안 오나요?”<br />
              <span className="text-[#00F0B5]">
                ✓ 개인·기업 PC 기본 기능(내 기기 찾기·손보기·귀신창) 영구 무료 (단속 걱정 ZERO)
              </span>
            </h3>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
              개인 사용자는 물론 <b>민간 기업(법인·개인사업자·소상공인·병원·세무회계사무소 등)</b>의 사내 업무용 PC에서도 내 기기 로컬 기본 기능(찾기·손보기·귀신창)은 라이선스 비용 0원, 광고 0%, 내용증명·법무법인 단속 영구 0건을 공식 보증합니다. (※ 사내 다자간 팀 서버 공유 등 별도 확장 옵션 및 공공기관 제외)
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setCertModalOpen(true)}
                className="px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs sm:text-sm cursor-pointer shadow-lg"
              >
                📜 공식 무료 라이선스 보증서 크게 보기
              </button>
              <a
                href="/showroom/certificates/ghosti_b2b_free_certificate.html"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs sm:text-sm"
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
                src="/showroom/certificates/ghosti_b2b_free_certificate.png"
                alt="귀신같이 무료 공식 보증서"
                className="w-full h-auto object-contain"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 5. 최하단 마스터 푸터 */}
      <footer className="border-t border-white/10 py-10 px-4 sm:px-6 max-w-7xl mx-auto text-xs text-zinc-500">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <img
              src="/gwisinkachi_3d_wordmark_light.png"
              alt="귀신같이 3D 로고"
              className="h-7 w-auto object-contain opacity-90"
            />
            <p className="font-bold text-zinc-400">
              (주)썬드림 · 온디바이스 로컬 AI 『귀신같이(Ghosti)』 · 상표출원 제40-2026-0229386호 · Zero-Server 프라이버시 보장
            </p>
          </div>
          <span className="select-none">© 2026 Sundreamer Studio. All rights reserved.</span>
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
                <span className="px-2 py-0.5 rounded bg-teal-500/20 text-[#00F0B5] text-[11px] font-extrabold">
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
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#00F0B5] to-teal-400 text-slate-950 font-black text-xs sm:text-sm cursor-pointer"
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
              <span className="text-amber-300 font-black text-sm">
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
                src="/showroom/certificates/ghosti_b2b_free_certificate.png"
                alt="귀신같이 무료 공식 보증서"
                className="w-full h-auto object-contain"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <a
                href="/showroom/certificates/ghosti_b2b_free_certificate.html"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-xl bg-amber-400 text-slate-950 font-black text-xs"
              >
                🖨️ 인쇄·PDF 저장용 페이지 열기 ↗
              </a>
              <button
                type="button"
                onClick={() => setCertModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-200 font-bold text-xs cursor-pointer"
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
