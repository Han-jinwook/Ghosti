/**
 * 👻 귀신창 초능력 수련장 & 도장깨기 체험관 엔진 (순수 로직 — UI 비의존)
 *
 * 정본: Secretary 마스터기획서 5장 5) 「게이밍 감성 2단계 온보딩」
 *  - 1단계: 애기귀신 소환술 기본기 3단 수련 (우클릭 0.35초 꾹 근육 기억 각인)
 *  - 2단계: 출시 초능력 전 종목(9종) 도장깨기 체험관 (Before → After + ✨성공 효과음 + 도장)
 *  - 최종 보상: 30일 무제한 초능력 체험 명시적 동의(Opt-in)
 * 공문: 20261107_2053(2단계 확장), 20261107_2056(4분 30초 ROI 배너 · 상시 연습장)
 */

/** 우클릭 꾹 소환 판정 시간 (ms) — 데몬 우클릭 0.35초 홀드 규격과 동일 */
export const SUMMON_HOLD_MS = 350;

/** 공문 2056 지정 문구 (토씨 그대로 유지) */
export const DOJO_ROI_BANNER_TEXT =
  '⏱️ 총 예상 소요시간: 딱 4분 30초! — 지금 4분 투자하고 1년 중 27일(209시간)을 아끼세요!';

export type BasicStepId = 'b1' | 'b2' | 'b3';
export type DojoItemId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface DojoItemMeta {
  id: DojoItemId;
  icon: string;
  title: string;
  /** 한 줄 미션 안내 (TMI 금지 — 1문장) */
  mission: string;
}

export const BASIC_STEPS: Array<{ id: BasicStepId; title: string; mission: string }> = [
  { id: 'b1', title: '우클릭 꾹~ 소환', mission: '아래 칸에서 마우스 오른쪽 버튼을 0.35초 꾹 누르세요' },
  { id: 'b2', title: '단가? 무오픈 소환', mission: '「샘플 견적서?」 위에서 우클릭 꾹 → 단가를 콕' },
  { id: 'b3', title: '폰 영수증 단어칩', mission: '영수증 사진에서 사업자번호 칩을 콕' },
];

export const DOJO_ITEMS: DojoItemMeta[] = [
  { id: 1, icon: '⌨️', title: '영타➔한타 1초 자동성형', mission: '영문으로 친 문장 끝에서 스페이스바를 누르세요' },
  { id: 2, icon: '🧺', title: '줄바꿈·띄어쓰기 1초 다림질', mission: '뚝뚝 끊긴 문단을 한 번에 펴세요' },
  { id: 3, icon: '🔫', title: '1➔2➔3 연속 복사 순차발사', mission: '빈칸을 차례로 우클릭해 줄줄이 꽂으세요' },
  { id: 4, icon: '🧼', title: '시커먼 배경·광고꼬리말 서식 세탁기', mission: '지저분한 글을 순수 텍스트로 세탁하세요' },
  { id: 5, icon: '🔑', title: 'F1~F6 내 상용구 & F7~F12 팀 상용구', mission: '칸을 누르고 F1, F7을 차례로 누르세요' },
  { id: 6, icon: '📋', title: '최근 5개 & 한 달 치 클립보드 검색', mission: '「우리」를 검색해 옛날 계좌를 찾으세요' },
  { id: 7, icon: '📊', title: '화면 캡처 표 ➔ 엑셀 표(TSV) 직행', mission: '드래그 막힌 단가표를 엑셀 표로 바꾸세요' },
  { id: 8, icon: '🏷️', title: '귀신 라벨러 (깡통 파일명 자동 작명)', mission: '암호 같은 파일명을 한 번에 바꾸세요' },
  { id: 9, icon: '💬', title: '귀신 말풍선 (마우스 호버 3줄 요약)', mission: '계약서 아이콘 위에 마우스를 올려 보세요' },
];

// ─────────────────────────────────────────────────────────────
// 종목별 샘플(Before) & 결과(After) 로직
// ─────────────────────────────────────────────────────────────

/** ① 영타 예제 (공문 원문) — 변환 결과 '한글이 안 쳐져' */
export const DOJO1_TYPO_SAMPLE = 'gksrmfdl dks cuwu';
export const DOJO1_TYPO_EXPECTED = '한글이 안 쳐져';

/** ② PDF 복사로 줄이 끊긴 문단 */
export const DOJO2_BROKEN_PARAGRAPH =
  '본 계약은 갑과 을 사이의\n임대차에 관한 사항을 정\n하며, 계약 기간은 2026\n년 11월 14일부터 2년으\n로 한다.';

/**
 * 줄바꿈 다림질: 줄 끝의 단순 개행을 제거하여 한 문단으로 편다.
 * - 한글/숫자 사이에서 단어가 잘린 경우(정\n하며 / 2026\n년)는 공백 없이 붙이고,
 * - 문장부호·조사 경계(사이의\n임대차)는 공백 1칸으로 잇는다.
 * - 빈 줄(문단 구분)은 유지한다.
 */
export function ironLineBreaks(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((para) =>
      para
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .reduce((acc, line) => {
          if (!acc) return line;
          const prev = acc[acc.length - 1];
          const next = line[0];
          const wordCut =
            (/[가-힣]/.test(prev) && /[가-힣]/.test(next) && !/[의를을이가은는에와과도로]$/.test(acc)) ||
            (/[0-9]/.test(prev) && /[년월일원%]/.test(next));
          return wordCut ? acc + line : `${acc} ${line}`;
        }, '')
    )
    .join('\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/** ③ 순차발사 큐 (샘플 명함) */
export const DOJO3_SEQUENCE = ['홍길동', '010-1234-5678', '역삼동'] as const;

/** ④ 뉴스 글 (시커먼 배경 + 광고 꼬리말) */
export const DOJO4_DIRTY_TEXT =
  '정부가 내년부터 소상공인 디지털 전환 지원금을 2배로 늘린다.\n' +
  '▶ 관련기사 더보기\n' +
  '홍길동 기자 hong@news.example\n' +
  'ⓒ 귀신일보, 무단전재 및 재배포 금지';

const NEWS_TAIL_PATTERNS: RegExp[] = [
  /^▶.*$/,
  /^[가-힣]{2,4}\s?기자(\s|$).*$/, // JS \b는 한글 경계를 인식 못하므로 공백/끝으로 판정
  /^ⓒ.*$/,
  /^.*무단\s?전재.*$/,
  /^.*재배포\s?금지.*$/,
  /^\s*\[.*(광고|AD).*\]\s*$/i,
];

/** 서식 세탁기: 광고·기자·저작권 꼬리말 줄을 제거하고 순수 본문만 남긴다. */
export function launderNewsText(text: string): string {
  return text
    .split('\n')
    .map((l) => l.replace(/\u00a0/g, ' ').trim())
    .filter((l) => l && !NEWS_TAIL_PATTERNS.some((re) => re.test(l)))
    .join('\n');
}

/** ⑤ 상용구 샘플 */
export const DOJO5_SNIPPETS: Record<'F1' | 'F7', { label: string; text: string }> = {
  F1: { label: 'F1 · 내 계좌', text: '국민은행 123-45-678910 (예금주: 홍길동)' },
  F7: { label: 'F7 · 회사 법인계좌', text: '신한은행 140-012-345678 ((주)썬드림)' },
};

/** ⑥ 한 달 치 클립보드 샘플 (최근 → 과거 순) */
export const DOJO6_CLIPBOARD_HISTORY: Array<{ text: string; when: string }> = [
  { text: '오늘 오후 3시 회의실 B', when: '방금' },
  { text: '서울특별시 강남구 테헤란로 123', when: '1시간 전' },
  { text: 'contact@sundreamer.app', when: '어제' },
  { text: '010-9876-5432', when: '3일 전' },
  { text: '견적 단가 145,000원 (VAT 별도)', when: '1주 전' },
  { text: '우리은행 1002-345-678901 (예금주: 김대리)', when: '3주 전' },
  { text: '택배 송장 6543-2109-8765', when: '4주 전' },
];
export const DOJO6_TARGET_QUERY = '우리';

/** 공백 무시 · 대소문자 무시 부분일치 클립보드 검색 */
export function searchClipboardHistory(
  history: Array<{ text: string; when: string }>,
  query: string
): Array<{ text: string; when: string }> {
  const q = query.replace(/\s+/g, '').toLowerCase();
  if (!q) return history.slice(0, 5);
  return history.filter((h) => h.text.replace(/\s+/g, '').toLowerCase().includes(q));
}

/** ⑦ 드래그 막힌 이미지 단가표 샘플 */
export const DOJO7_TABLE: string[][] = [
  ['품목', '수량', '단가', '금액'],
  ['A4 복사용지', '10', '4,500', '45,000'],
  ['토너 카트리지', '2', '50,000', '100,000'],
];

/** 표 → 엑셀 붙여넣기용 TSV (탭 구분 · 줄바꿈 행 구분) */
export function tableToTsv(rows: string[][]): string {
  return rows.map((r) => r.map((c) => c.replace(/[\t\n]/g, ' ')).join('\t')).join('\n');
}

/** ⑧ 귀신 라벨러 샘플 (공문 원문 예시 기준) */
export const DOJO8_LABELER_SAMPLES: Array<{ before: string; after: string; dateRule: string }> = [
  { before: 'IMG_4821.jpg', after: '261107_김대리_영수증_145,000원.jpg', dateRule: '촬영일' },
  { before: 'KakaoTalk_20261106.jpg', after: '261106_카톡_거래처명함.jpg', dateRule: '카톡 수신일' },
  { before: 'scan_001.pdf', after: '250315_임대차계약서_역삼동.pdf', dateRule: '문서 내용 날짜' },
];

/** ⑨ 귀신 말풍선 샘플 */
export const DOJO9_HOVER_FILE = '임대차계약서.pdf';
export const DOJO9_SUMMARY_LINES = ['보증금 5,000만', '월세 320만', '만기 28.11.14'];
export const DOJO9_HOVER_DELAY_MS = 400;

/** 기본기 ② 샘플 */
export const BASIC2_QUERY = '샘플 견적서?';
export const BASIC2_RESULT = { file: '샘플_견적서.xlsx', value: '145,000원' };

/** 기본기 ③ 샘플 (영수증 OCR 단어칩) */
export const BASIC3_TARGET_CHIP = '사업자번호: 123-45-67890';
export const BASIC3_CHIPS = ['상호: 썬드림카페', BASIC3_TARGET_CHIP, '합계: 48,000원', '2026-11-07 14:22'];

// ─────────────────────────────────────────────────────────────
// 진행도 (도장) 저장 — 언제든 다시 들어와 이어서/골라서 연습
// ─────────────────────────────────────────────────────────────

export const DOJO_PROGRESS_STORAGE_KEY = 'ghosti_dojo_progress_v1';
export const DOJO_TRIAL_CHOICE_STORAGE_KEY = 'ghosti_dojo_trial_choice_v2';

export interface DojoProgress {
  basics: Partial<Record<BasicStepId, boolean>>;
  dojo: Partial<Record<DojoItemId, boolean>>;
}

export const EMPTY_DOJO_PROGRESS: DojoProgress = { basics: {}, dojo: {} };

export function loadDojoProgress(): DojoProgress {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(DOJO_PROGRESS_STORAGE_KEY) : null;
    if (!raw) return { basics: {}, dojo: {} };
    const parsed = JSON.parse(raw) as Partial<DojoProgress>;
    return { basics: { ...(parsed.basics || {}) }, dojo: { ...(parsed.dojo || {}) } };
  } catch {
    return { basics: {}, dojo: {} };
  }
}

export function saveDojoProgress(p: DojoProgress): void {
  try {
    localStorage.setItem(DOJO_PROGRESS_STORAGE_KEY, JSON.stringify(p));
    window.dispatchEvent(new CustomEvent('ghosti_dojo_progress_updated', { detail: p }));
  } catch {
    /* ignore */
  }
}

export function countBasicsDone(p: DojoProgress): number {
  return BASIC_STEPS.filter((s) => p.basics[s.id]).length;
}

export function countDojoDone(p: DojoProgress): number {
  return DOJO_ITEMS.filter((d) => p.dojo[d.id]).length;
}

export function isAllDojoDone(p: DojoProgress): boolean {
  return countBasicsDone(p) === BASIC_STEPS.length && countDojoDone(p) === DOJO_ITEMS.length;
}
