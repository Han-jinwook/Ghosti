/**
 * 👻 귀신비서 대화 엔진 (v1.3) — 7대 영역 마스터 대본집(ghost_secretary_playbook.json) 기반 무토큰 즉답
 *
 * 정본: Secretary 마스터기획서 7장 2)·3)·5), 공문 20261108_1600
 *  - 첫인사 별명 수집 → 매운맛 무당 콜드리딩(JS 실측 수치) → 손보기·복원·냉정한 사양 처방 → 홀림 퀘스트 → 귀신계 여권
 *  - 기각 항목(넣지 말 것): ① 점괘의 '귀신의 촉' 류 변명 문구 ② 1관문 급행 스킵 버튼
 *  - 금기: 다크모드 언급 배제(시간대만 사용) / 저사양 핀잔 금지 / 구매처·쇼핑몰 링크 제공 금지
 *  - 대본집에 없는 질문은 unmatched_questions 큐에 적재(주 1회 비서 정기 감사로 대본집 편입)
 */
import playbookJson from '../data/ghost_secretary_playbook.json';

// ─────────────────────────────────────────────────────────────
// 대본집 타입 & 로딩
// ─────────────────────────────────────────────────────────────
export interface PlaybookScenario {
  id: string;
  trigger: string;
  response: string;
}
export interface GhostSecretaryPlaybook {
  version: string;
  updated_at: string;
  persona: { name: string; avatar: string; tone: string; strict_rules: string[] };
  categories: Record<string, PlaybookScenario[]>;
}

export const GHOST_SECRETARY_PLAYBOOK = playbookJson as unknown as GhostSecretaryPlaybook;

/** 말풍선 애기귀신 아이콘 — 대본집 v1.3.1 persona.avatar(실제 파일 /gwisinkachi_app_icon_512.png) 우선, 비어 있으면 공식 앱 아이콘 */
export const GHOST_SECRETARY_AVATAR_SRC =
  (playbookJson as { persona?: { avatar?: string } }).persona?.avatar || '/gwisinkachi_app_icon_512.png';

/** 손보기 명령 문장 판별 — '보안프로그램 정리해줘' 같은 실행 요청이 FAQ(보안·요금) 키워드에 가로채이지 않도록 보호 */
const CARE_COMMAND_RE = /(정리|지워|삭제|청소|검진|느려|느린|빨라|고쳐|치워|꺼줘|최적화|점검해)/;
export const GHOST_SECRETARY_NAME = '귀신비서';

export function findScenario(id: string, pb: GhostSecretaryPlaybook = GHOST_SECRETARY_PLAYBOOK): PlaybookScenario | null {
  for (const list of Object.values(pb.categories)) {
    const hit = list.find((s) => s.id === id);
    if (hit) return hit;
  }
  return null;
}

/** trigger 문자열의 text_contains(['a','b']) 키워드 목록 추출 (대본집 갱신 시 코드 수정 없이 자동 반영) */
export function extractTextContainsKeywords(trigger: string): string[] {
  const m = trigger.match(/text_contains\(\[(.*?)\]\)/);
  if (!m) return [];
  return Array.from(m[1].matchAll(/['"]([^'"]+)['"]/g)).map((x) => x[1]);
}

/** {nickname} 등 치환. 값이 없는 자리표시자는 안전한 기본값 또는 빈 문자열로 처리(중괄호 노출 방지) */
export function renderPlaybookText(template: string, vars: Record<string, string | number | undefined>): string {
  return template
    .replace(/\{(\w+)\}/g, (_, key: string) => {
      const v = vars[key];
      return v === undefined || v === null ? '' : String(v);
    })
    .replace(/\(\s*\)/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

// ─────────────────────────────────────────────────────────────
// 콜드리딩 컨텍스트 (순수 JS Web API 실측)
// ─────────────────────────────────────────────────────────────
export type TimeBand = '새벽' | '출근길' | '오전' | '오후' | '저녁' | '심야';

export interface ColdReadingContext {
  device: 'desktop' | 'mobile';
  os: 'Windows' | 'Mac' | 'Other';
  cores: number;
  /** navigator.deviceMemory (크롬은 개인정보 보호로 최대 8 로 상한) — 미지원 시 0 */
  ramGb: number;
  screenRes: string;
  hour: number;
  batteryPct: number | null;
  charging: boolean | null;
}

export function timeBandOf(hour: number): TimeBand {
  if (hour <= 4) return '새벽';
  if (hour <= 8) return '출근길';
  if (hour <= 11) return '오전';
  if (hour <= 17) return '오후';
  if (hour <= 21) return '저녁';
  return '심야';
}

export async function collectColdReadingContext(): Promise<ColdReadingContext> {
  const nav = (typeof navigator !== 'undefined' ? navigator : {}) as Navigator & {
    deviceMemory?: number;
    getBattery?: () => Promise<{ level: number; charging: boolean }>;
  };
  const ua = nav.userAgent || '';
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const sw = typeof screen !== 'undefined' ? Math.round(screen.width * dpr) : 1920;
  const sh = typeof screen !== 'undefined' ? Math.round(screen.height * dpr) : 1080;
  let batteryPct: number | null = null;
  let charging: boolean | null = null;
  try {
    if (nav.getBattery) {
      const b = await nav.getBattery();
      batteryPct = Math.round(b.level * 100);
      charging = b.charging;
    }
  } catch {
    /* 배터리 API 미지원 브라우저 */
  }
  return {
    device: isMobile ? 'mobile' : 'desktop',
    os: /Windows/i.test(ua) ? 'Windows' : /Mac OS/i.test(ua) ? 'Mac' : 'Other',
    cores: nav.hardwareConcurrency || 0,
    ramGb: nav.deviceMemory || 0,
    screenRes: `${sw}×${sh}`,
    hour: new Date().getHours(),
    batteryPct,
    charging,
  };
}

/**
 * 점괘 시나리오 선택 (우선순위: 모바일 → 심야 → 일반 고성능 → 저사양 공감)
 * - 크롬 deviceMemory 는 최대 8 이므로 '고성능(코어≥6 && 램≥8)'을 저사양(램≤8)보다 먼저 판정해야 대부분의 PC가 저사양으로 오판되지 않는다.
 * - 수치를 읽지 못한(0) 경우는 핀잔 위험이 없는 일반 점괘로 처리.
 */
export function pickColdReadingScenarioId(ctx: ColdReadingContext): string {
  if (ctx.device === 'mobile') return 'cold_reading_mobile';
  if (ctx.hour >= 22 || ctx.hour <= 4) return 'cold_reading_late_night_battery';
  if (ctx.cores === 0 || ctx.ramGb === 0) return 'cold_reading_desktop_standard';
  if (ctx.cores >= 6 && ctx.ramGb >= 8) return 'cold_reading_desktop_standard';
  if (ctx.cores <= 4 || ctx.ramGb <= 8) return 'cold_reading_low_spec_empathy';
  return 'cold_reading_desktop_standard';
}

export function buildColdReadingText(nickname: string, ctx: ColdReadingContext): { id: string; text: string } {
  const id = pickColdReadingScenarioId(ctx);
  const sc = findScenario(id);
  const batteryMsg =
    ctx.batteryPct !== null && ctx.charging === false && ctx.batteryPct <= 30
      ? `(배터리도 ${ctx.batteryPct}% 남았어요!)`
      : '';
  const text = renderPlaybookText(sc?.response || '', {
    nickname,
    screen_res: ctx.screenRes,
    cores: ctx.cores || '여러',
    hour: ctx.hour,
    battery: ctx.batteryPct ?? '—',
    battery_msg: batteryMsg,
  });
  return { id, text };
}

// ─────────────────────────────────────────────────────────────
// 의도 판별
// ─────────────────────────────────────────────────────────────
const STORE_LINK_RE = /(어디서\s*(사|구매|팔|파)|구매\s*(처|링크|사이트)|링크\s*(줘|좀|주세요|보내)|쇼핑몰|최저가|어디\s*파)/;
const FEATURE_REQUEST_RE = /기능.*(안\s*돼|안돼|없어|없나|있어\?|있나|되나|돼\?|가능)|(안\s*돼|안돼|없어|되나)\??\s*$/;
const YES_RE = /^(응|네|넹|예|좋아|좋아요|ㅇㅇ|ㅇㅋ|오케이|ok|그래|켜|해줘|부탁)/i;
const NO_RE = /^(아니|괜찮|됐어|다음에|싫어|ㄴㄴ|no|안\s*할)/i;

export function isStoreLinkIntent(text: string): boolean {
  return STORE_LINK_RE.test(text);
}
export function isImpatientIntent(text: string): boolean {
  const sc = findScenario('impatient_user_wants_search_now');
  const kws = sc ? extractTextContainsKeywords(sc.trigger) : ['급해', '검색부터', '나중에', '바빠'];
  return kws.some((k) => text.includes(k));
}
export function isYes(text: string): boolean {
  return YES_RE.test(text.trim());
}
export function isNo(text: string): boolean {
  return NO_RE.test(text.trim());
}

/** 별명 답변 정제: "저는 멀린이에요", "멀린이라고 불러줘", "아냐 으노 말고 은호라고 해" → "멀린", "은호" */
export function sanitizeNicknameAnswer(raw: string): string {
  let s = raw.trim().replace(/[!.~?？！。"'`]+/g, '').trim();
  s = s.replace(/^(아냐|아니야|아니|잠깐|저기)\s*,?\s*/, '');
  s = s.replace(/^.+?\s*말고\s+/, '');
  s = s.replace(/^(저는|전|나는|난|제\s*이름은|내\s*이름은|제\s*별명은|내\s*별명은|이름은|별명은|호칭은|앞으로는|앞으로|이제부터는|이제부터|그냥|다시)\s*/, '');
  s = s.replace(/\s*(이라고|라고|으로|로)\s*(불러\s*(줘|주세요|줘요|라)?|해\s*(줘|주세요|줘요|라)?|바꿔\s*(줘|주세요|줘요|라)?|변경\s*(해\s*줘|해\s*주세요|해)?|수정\s*(해\s*줘|해\s*주세요|해)?|저장\s*(해\s*줘|해\s*주세요|해)?)?\s*$/, '');
  s = s.replace(/\s*(이에요|예요|입니다|이야|야|요)$/, '');
  s = s.replace(/님$/, '');
  return s.trim().slice(0, 12);
}

/** 일반 지시대명사·의문사·명령어가 새 별명으로 오인식되지 않도록 차단하는 금지어 정규식 */
const INVALID_NICKNAME_CANDIDATE_RE =
  /^(불러|바꿔|변경|수정|이름|별명|닉네임|호칭|뭐|뭘|무엇|다시|새로|다른|다른걸|다른것|다른거|다른이름|다른별명|다른닉네임|딴거|딴걸|아무거나|그거|이거|저거|누구|나|저)$/;

/**
 * 별명(호칭) 변경·수정·조회 의도 판별 (무토큰 대본 DB 1단계)
 * - change: 새 별명이 문장 안에 함께 들어있는 경우 ("아냐 으노 말고 은호라고 해", "은숙을 은호로 바꿔줘", "은호로 변경해줘", "내 별명 은호로 수정해줘")
 * - ask: 별명을 바꾸고 싶다고만 말한 경우 ("별명 바꿀래", "내 이름 수정해줘", "이름 다른걸로 바꿔줘", "닉네임 다른 것으로 변경해줘")
 * - query: 현재 저장된 내 이름/별명을 물어본 경우 ("내 이름이 뭐야?", "내 별명 기억해?")
 */
export function parseNicknameSettingIntent(
  raw: string,
  currentNickname?: string
): { kind: 'change'; newNickname: string } | { kind: 'ask' } | { kind: 'query' } | null {
  const t = raw.trim();
  if (!t || t.length > 50) return null;
  // 파일·폴더·요일·시간·귀신창·여권 설정 명령과 혼동 방지
  if (/파일|폴더|사진|문서|여권|\d+\s*번|요일|시간|소리|효과음|라벨러|검진|알림|귀신창|단축키|상용구/.test(t)) return null;

  // 1) 내 이름/별명 조회 ("내 이름이 뭐야?", "내 별명 뭐라고 했지?", "나 누구야?")
  if (
    /(?:내|제)\s*(?:이름|별명|닉네임|호칭).*?(?:뭐|뭔지|누구|알아|기억|뭐라고)/i.test(t) ||
    /^(?:내가\s*누구게|나\s*누구야|내\s*이름\s*뭐야|내\s*별명\s*뭐야)\??$/i.test(t)
  ) {
    return { kind: 'query' };
  }

  // 2) "이름/별명/닉네임 다른 걸로 바꿔줘/변경해줘/수정해줘" 또는 새 이름 없이 "별명 바꿔줘"만 말한 경우 (최우선 판별하여 '다른걸'님이 되는 사고 원천 차단!)
  if (
    /(?:다른\s*(?:걸|것|거|이름|별명|닉네임)|딴\s*(?:걸|거|이름|별명)|새\s*(?:이름|별명|닉네임))(?:으로|로)?\s*(?:바꿔|바꿀|변경|수정|다시|새로|해)/i.test(t) ||
    /(?:내\s*|제\s*)?(?:이름|별명|닉네임|호칭)(?:은|을|이|가)?\s*(?:좀\s*)?(?:다시\s*|새로\s*)?(?:바꿔|바꿀|변경|수정|다시\s*설정|새로\s*설정)(?:줘|주세요|줘요|할래|할게|해줘|해주세요|해)?[.!~?]*$/i.test(t)
  ) {
    return { kind: 'ask' };
  }

  // 3) "A 말고 B라고 해/불러/바꿔/변경/수정" 또는 "A가 아니라 B로 바꿔줘"
  const malgoMatch = t.match(
    /(?:말고|아닌|아니고|아니라)\s+([가-힣a-zA-Z0-9]{1,12}?)(?:님)?\s*(?:이라고|라고|으로|로)\s*(?:불러|해|바꿔|변경|수정|할게|할래)/i
  );
  if (malgoMatch) {
    const nick = sanitizeNicknameAnswer(malgoMatch[1]);
    if (nick && !INVALID_NICKNAME_CANDIDATE_RE.test(nick)) {
      return { kind: 'change', newNickname: nick };
    }
  }

  // 4) "A(을/를/에서) B(으)로 바꿔줘/변경해줘/수정해줘" (예: "은숙을 은호로 바꿔줘", "은숙에서 은호로 변경해줘")
  const fromToChangeMatch = t.match(
    /^(?:아냐\s*|아니야\s*)?(?:내\s*|제\s*)?(?:이름|별명|닉네임|호칭)?\s*([가-힣a-zA-Z0-9]{1,12}?)(?:님)?(?:을|를|에서| 말고)\s*([가-힣a-zA-Z0-9]{1,12}?)(?:님)?\s*(?:으로|로|이라고|라고)\s*(?:바꿔|변경|수정|설정|저장|불러|해)/i
  );
  if (fromToChangeMatch) {
    const nick = sanitizeNicknameAnswer(fromToChangeMatch[2]);
    if (nick && !INVALID_NICKNAME_CANDIDATE_RE.test(nick)) {
      return { kind: 'change', newNickname: nick };
    }
  }

  // 5) "내 별명(이름/닉네임)을 B(으)로 바꿔줘/변경해줘/수정해줘/설정해줘"
  const explicitChangeMatch = t.match(
    /(?:내\s*|제\s*)?(?:이름|별명|닉네임|호칭)(?:은|을|이|가)?\s*(?:.+?\s*말고\s*)?([가-힣a-zA-Z0-9]{1,12}?)(?:님)?\s*(?:으로|로|이라고|라고)\s*(?:바꿔|변경|수정|등록|설정|저장|불러|해)/i
  );
  if (explicitChangeMatch) {
    const nick = sanitizeNicknameAnswer(explicitChangeMatch[1]);
    if (nick && !INVALID_NICKNAME_CANDIDATE_RE.test(nick)) {
      return { kind: 'change', newNickname: nick };
    }
  }

  // 6) "(앞으로는/그냥) B라고 불러줘 / B로 바꿔줘 / B로 변경해줘 / B로 수정해줘" (단독 문장)
  const directCallMatch = t.match(
    /^(?:아냐\s*|아니야\s*|아니\s*)?(?:앞으로는?\s*|이제부터는?\s*)?(?:내\s*이름(?:은|을)?\s*|제\s*이름(?:은|을)?\s*|내\s*별명(?:은|을)?\s*|별명(?:은|을)?\s*|닉네임(?:은|을)?\s*|호칭(?:은|을)?\s*|그냥\s*)?([가-힣a-zA-Z0-9]{1,12}?)(?:님)?\s*(?:이라고|라고|으로|로)\s*(?:불러\s*(?:줘|주세요|줘요|라)?|바꿔\s*(?:줘|주세요|줘요|라)?|변경\s*(?:해\s*줘|해\s*주세요|해)?|수정\s*(?:해\s*줘|해\s*주세요|해)?|해\s*(?:줘|주세요|줘요|라)?|할게|할래)[.!~?]*$/i
  );
  if (directCallMatch) {
    const nick = sanitizeNicknameAnswer(directCallMatch[1]);
    if (nick && !INVALID_NICKNAME_CANDIDATE_RE.test(nick)) {
      return { kind: 'change', newNickname: nick };
    }
  }

  // 7) 현재 저장된 별명이 포함된 변경 문장 (예: 현재 '은숙'인데 "은숙 말고 은호", "은숙을 은호로 해줘")
  if (currentNickname && t.includes(currentNickname)) {
    const curEsc = currentNickname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const curMatch = t.match(
      new RegExp(`${curEsc}(?:님)?(?:을|를|에서|말고|\s)+([가-힣a-zA-Z0-9]{1,12}?)(?:님)?(?:으로|로|이라고|라고)?\s*(?:바꿔|변경|수정|불러|해)`, 'i')
    );
    if (curMatch) {
      const nick = sanitizeNicknameAnswer(curMatch[1]);
      if (nick && !INVALID_NICKNAME_CANDIDATE_RE.test(nick)) {
        return { kind: 'change', newNickname: nick };
      }
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────
// 귀신비서 상태 & 귀신계 여권 저장
// ─────────────────────────────────────────────────────────────
export type QuestStep = 'labeler' | 'son_free' | 'voice' | 'done';

export interface GhostSecretaryState {
  nickname?: string;
  awaitingNickname?: boolean;
  coldReadingShownAt?: string;
  questStep?: QuestStep;
  consents?: { labeler?: boolean; sonFreeAndSpeedAlert?: boolean };
  /** 1일 1회 노크: 마지막으로 먼저 말 건 날짜(YYYY-MM-DD) */
  lastKnockDate?: string;
  /** 냉정한 사양 처방에서 안내한 부품 규격 (예: DDR3 PC3-12800 8GB) — 구매처 질문 시 복사 대상 */
  lastRecommendedSpec?: string;
  /** 🪪 귀신계 여권 발급 대행 진행 단계 */
  passportStep?: 'ask_hint' | 'naming' | 'done' | 'skipped';
  /** 모바일 옛날 사진 마저 스캔 시점 선택 (30분 뒤 안내 vs 저녁 유휴) */
  mobileRemainingScanChoice?: 'now_30min' | 'evening';
  /** 모바일 징검다리 스캔 결과 (100 → 300 → 500장 탐색 창 및 남은 옛날 사진 수) */
  mobileSteppingStoneScanned?: number;
  mobileRemainingOldPhotos?: number;
}

export const GHOST_SECRETARY_STATE_KEY = 'ghosti_ghost_secretary_state_v1';
export const GHOST_PASSPORT_KEY = 'ghosti_ghost_passport_v1';
export const UNMATCHED_QUESTIONS_KEY = 'ghosti_unmatched_questions_v1';
const TEST_ACCOUNT_NICKNAMES = new Set(['AppReviewer', 'KCP심사관']);

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function loadGhostSecretaryState(): GhostSecretaryState {
  const st = readJson<GhostSecretaryState>(GHOST_SECRETARY_STATE_KEY, {});
  if (!st.nickname) {
    try {
      const hubNick = localStorage.getItem('userNickname');
      if (hubNick && !TEST_ACCOUNT_NICKNAMES.has(hubNick)) st.nickname = hubNick;
    } catch {
      /* ignore */
    }
  }
  return st;
}
export function saveGhostSecretaryState(st: GhostSecretaryState): void {
  writeJson(GHOST_SECRETARY_STATE_KEY, st);
  try {
    window.dispatchEvent(new CustomEvent('ghosti_ghost_secretary_state_updated', { detail: st }));
  } catch {
    /* ignore */
  }
}

/**
 * 🪪 귀신계 여권 저장 표준 (v1.3 수정 채택)
 *  - 관계도 꼬리표('와이프','아들') / 관계 칩 버튼 폐지
 *  - 타인: 실제 이름(realName)만 / 나(본인): isSelf + nickname + realName 세트
 */
export interface GhostPassportSelf {
  isSelf: true;
  nickname: string;
  realName?: string;
}
export interface GhostPassportMember {
  realName: string;
  createdAt: string;
}
export interface GhostPassportBook {
  self?: GhostPassportSelf;
  members: GhostPassportMember[];
}

export function loadGhostPassportBook(): GhostPassportBook {
  const b = readJson<GhostPassportBook>(GHOST_PASSPORT_KEY, { members: [] });
  return { self: b.self, members: Array.isArray(b.members) ? b.members : [] };
}
export function saveGhostPassportBook(b: GhostPassportBook): void {
  writeJson(GHOST_PASSPORT_KEY, b);
  try {
    window.dispatchEvent(new CustomEvent('ghosti_ghost_passport_updated', { detail: b }));
  } catch {
    /* ignore */
  }
}

/** 관계 꼬리표가 섞인 입력을 거른다 (실명 원칙 위반 방지) */
const RELATION_TAG_RE = /^(와이프|아내|남편|아들|딸|엄마|아빠|어머니|아버지|할머니|할아버지|형|누나|오빠|언니|동생|자녀|애기|아기|첫째|둘째|막내)$/;
export function isRelationTagOnly(name: string): boolean {
  return RELATION_TAG_RE.test(name.trim());
}

export function upsertPassportMember(book: GhostPassportBook, realName: string, now = new Date()): GhostPassportBook {
  const name = realName.trim();
  if (!name || isRelationTagOnly(name)) return book;
  if (book.members.some((m) => m.realName === name)) return book;
  return { ...book, members: [...book.members, { realName: name, createdAt: now.toISOString() }] };
}

export function setPassportSelf(book: GhostPassportBook, nickname: string, realName?: string): GhostPassportBook {
  return { ...book, self: { isSelf: true, nickname, realName: realName ?? book.self?.realName } };
}

// ─────────────────────────────────────────────────────────────
// 미등록 질문 포집 (unmatched_questions)
// ─────────────────────────────────────────────────────────────
export interface UnmatchedQuestion {
  text: string;
  at: string;
  reason: 'no_playbook_match' | 'feature_request';
}
export function logUnmatchedQuestion(text: string, reason: UnmatchedQuestion['reason'], now = new Date()): void {
  const list = readJson<UnmatchedQuestion[]>(UNMATCHED_QUESTIONS_KEY, []);
  list.push({ text: text.slice(0, 300), at: now.toISOString(), reason });
  writeJson(UNMATCHED_QUESTIONS_KEY, list.slice(-200));
}
export function loadUnmatchedQuestions(): UnmatchedQuestion[] {
  return readJson<UnmatchedQuestion[]>(UNMATCHED_QUESTIONS_KEY, []);
}

// ─────────────────────────────────────────────────────────────
// 1일 1회 노크
// ─────────────────────────────────────────────────────────────
export function todayKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
export function canKnockToday(st: GhostSecretaryState, now = new Date()): boolean {
  return st.lastKnockDate !== todayKey(now);
}

// ─────────────────────────────────────────────────────────────
// 대화 턴 해석 (대본집 우선 → 없으면 null 반환하여 기존 손보기 라우터로 위임)
// ─────────────────────────────────────────────────────────────
export interface PassportNamingResult {
  selfIndex?: number;
  names: Array<{ index: number; realName: string }>;
  rejectedRelationTags: string[];
}

export interface GhostSecretaryTurn {
  scenarioId: string;
  text: string;
  followUps?: string[];
  /** 여권 후보 번호별 실명 등록 지시 (컴포넌트가 store.registerFaceMember 로 실제 등록) */
  passportNaming?: PassportNamingResult;
  /** 여권에 등록된 첫 가족 실명 (가족 카톡방 1초 구경시켜 주기 바이럴 브릿지용) */
  passportViralFamilyName?: string;
  nextState: GhostSecretaryState;
  /** 응답과 함께 실제로 클립보드에 복사할 텍스트 (대본이 '복사해 드렸다'고 말하는 경우) */
  clipboardText?: string;
  /** 별명 확정 직후 → 콜드리딩 컨텍스트로 점괘를 이어 붙여야 함 */
  needsColdReading?: boolean;
}

export const QUEST_YES_LABELER = '좋아요, 예쁘게 바꿔줘';
export const QUEST_YES_ALERT = '좋아요, 알려줘';
export const QUEST_NO = '다음에요';

export function questPromptFor(
  step: QuestStep,
  nickname: string
): { id: string; text: string; followUps?: string[] } | null {
  const map: Record<QuestStep, { id: string; followUps?: string[] } | null> = {
    labeler: { id: 'quest_ghost_labeler', followUps: [QUEST_YES_LABELER, QUEST_NO] },
    son_free: { id: 'quest_son_free_day_and_speed_alert', followUps: [QUEST_YES_ALERT, QUEST_NO] },
    voice: { id: 'quest_mobile_voice_search' },
    done: null,
  };
  const m = map[step];
  if (!m) return null;
  const sc = findScenario(m.id);
  return sc ? { id: m.id, text: renderPlaybookText(sc.response, { nickname }), followUps: m.followUps } : null;
}

function nextQuest(step: QuestStep): QuestStep {
  return step === 'labeler' ? 'son_free' : step === 'son_free' ? 'voice' : 'done';
}

export function resolveGhostSecretaryTurn(
  rawText: string,
  st: GhostSecretaryState,
  ctx: { passportClusterCount?: number } = {}
): GhostSecretaryTurn | null {
  const text = rawText.trim();
  if (!text) return null;
  const nickname = st.nickname || '';

  // ⓪ 🪪 귀신계 여권 발급 대행 (성별·나이대 힌트 → 후보 번호별 실명 입력)
  if (st.passportStep === 'ask_hint') {
    const sc = findScenario('passport_show_top_candidates_ask_real_name');
    if (sc) {
      return {
        scenarioId: sc.id,
        text: renderPlaybookText(sc.response, { nickname, cluster_count: ctx.passportClusterCount || 0 }),
        nextState: { ...st, passportStep: 'naming' },
      };
    }
  }
  if (st.passportStep === 'naming') {
    const parsed = parsePassportNamingAnswer(text);
    if (parsed.names.length || parsed.selfIndex !== undefined) {
      const firstFamily = parsed.names[0]?.realName;
      const sc = findScenario('passport_complete_suggest_natural_search');
      const done = firstFamily && sc
        ? renderPlaybookText(sc.response, { nickname, registered_family_name: firstFamily })
        : `${nickname}님 본인 여권을 새겨뒀어요! 이제 왼쪽 두 번째 메뉴인 『👻 귀신검색』에서 직접 불러보는 마법을 따라 해볼까요?`;
      const viralAsk = firstFamily
        ? `\n\n방금 찾아낸 『${firstFamily}』 사진들을 가족 카톡방에 로그인 없이 1초 만에 구경시켜 드릴까요?`
        : '';
      const warn = parsed.rejectedRelationTags.length
        ? `\n(『${parsed.rejectedRelationTags.join('』, 『')}』처럼 관계로만 말씀하신 분은 진짜 이름을 알려주시면 여권을 찍어드릴게요!)`
        : '';
      return {
        scenarioId: sc?.id || 'passport_self_only_done',
        text: done + viralAsk + warn,
        passportNaming: parsed,
        passportViralFamilyName: firstFamily,
        nextState: { ...st, passportStep: 'done' },
      };
    }
    if (parsed.rejectedRelationTags.length) {
      return {
        scenarioId: 'passport_need_real_name',
        text: `${nickname}님, 『${parsed.rejectedRelationTags.join('』, 『')}』 말고 진짜 여권처럼 실제 이름으로 알려주세요! (예: 2번은 한치우)`,
        nextState: st,
      };
    }
  }

  // ⓪-2 모바일 옛날 사진 스캔 시점 선택 응답
  if (/30\s*분|지금\s*(천천히|돌려)/.test(text) && /사진|스캔|돌려|천천히|30\s*분/.test(text) && st.passportStep === 'done' && !st.mobileRemainingScanChoice) {
    return { scenarioId: 'mobile_scan_choice_now', text: '좋아요! 뒤에서 천천히 찾아두고 약 30분 뒤에 채팅으로 알려드릴게요.', nextState: { ...st, mobileRemainingScanChoice: 'now_30min' } };
  }
  if (/저녁/.test(text) && st.passportStep === 'done' && !st.mobileRemainingScanChoice) {
    return { scenarioId: 'mobile_scan_choice_evening', text: '알겠어요! 저녁에 쉬실 때 조용히 해두고, 다음 날 한 번만 채팅으로 알려드릴게요.', nextState: { ...st, mobileRemainingScanChoice: 'evening' } };
  }

  // ① 첫인사 별명 답변 또는 별명 재설정 대기 중인 경우
  if (st.awaitingNickname) {
    const nick = sanitizeNicknameAnswer(text);
    if (nick) {
      const isFirstTime = !st.nickname;
      return {
        scenarioId: isFirstTime ? 'nickname_registered' : 'profile_change_nickname',
        text: isFirstTime
          ? `${nick}님! 이름 예쁘네요, 평생 이렇게 불러드릴게요. 🪪 귀신계 여권(나)에도 새겨뒀어요!`
          : renderPlaybookText(findScenario('profile_change_nickname')?.response || '', { nickname: nick }),
        nextState: { ...st, nickname: nick, awaitingNickname: false },
        needsColdReading: isFirstTime,
      };
    }
  }

  // ①-2 프로필 별명(호칭) 변경·수정·조회 (언제든 무토큰 즉시 반영)
  const nickIntent = parseNicknameSettingIntent(text, nickname);
  if (nickIntent) {
    if (nickIntent.kind === 'change') {
      const newNick = nickIntent.newNickname;
      const sc = findScenario('profile_change_nickname');
      saveGhostPassportBook(setPassportSelf(loadGhostPassportBook(), newNick));
      try {
        localStorage.setItem('userNickname', newNick);
      } catch {
        /* ignore */
      }
      return {
        scenarioId: sc?.id || 'profile_change_nickname',
        text: sc
          ? renderPlaybookText(sc.response, { nickname: newNick })
          : `앗, 알겠어요! 앞으로는 『${newNick}』님이라고 꼭 기억해서 불러드릴게요! 프로필과 🪪 귀신계 여권(나) 이름도 『${newNick}』님으로 바로 바꿔뒀어요!`,
        nextState: { ...st, nickname: newNick, awaitingNickname: false },
      };
    }
    if (nickIntent.kind === 'ask') {
      const sc = findScenario('profile_ask_new_nickname');
      return {
        scenarioId: sc?.id || 'profile_ask_new_nickname',
        text: sc?.response || '좋아요! 앞으로 제가 뭐라고 불러드리면 될까요? 바꾸고 싶으신 새 별명(호칭)을 편하게 말씀해 주세요!',
        nextState: { ...st, awaitingNickname: true },
      };
    }
    if (nickIntent.kind === 'query') {
      const sc = findScenario('profile_query_my_nickname');
      if (nickname) {
        return {
          scenarioId: sc?.id || 'profile_query_my_nickname',
          text: sc
            ? renderPlaybookText(sc.response, { nickname })
            : `지금 제 마음속과 🪪 귀신계 여권(나)에는 『${nickname}』님으로 저장되어 있어요! 다른 이름으로 바꾸고 싶으시면 '은호라고 불러줘'처럼 언제든 말씀해 주세요!`,
          nextState: st,
        };
      }
      const askFirst = findScenario('ask_nickname_first');
      return {
        scenarioId: askFirst?.id || 'ask_nickname_first',
        text: askFirst?.response || '아직 별명을 안 알려주셨어요! 제가 앞으로 뭐라고 불러드리면 좋을까요?',
        nextState: { ...st, awaitingNickname: true },
      };
    }
  }

  // ② 구매처·쇼핑몰 링크 요구 → 절대 거절 + 외부 바톤터치
  //    대본은 '규격 이름을 복사해 드렸으니'라고 말하므로, 실제 처방 규격을 알 때만 대본을 쓰고 클립보드 복사를 함께 수행한다.
  //    규격을 모르면(엔진 미연결·사양 미진단) 복사했다는 거짓 안내 대신 정직한 대체 문구로 응대한다.
  if (isStoreLinkIntent(text)) {
    const sc = findScenario('refuse_store_link_strictly');
    if (sc && st.lastRecommendedSpec) {
      return {
        scenarioId: sc.id,
        text: renderPlaybookText(sc.response, { nickname, recommended_ram_spec: st.lastRecommendedSpec }),
        clipboardText: st.lastRecommendedSpec,
        nextState: st,
      };
    }
    return {
      scenarioId: 'refuse_store_link_no_spec_yet',
      text: `에이~ ${nickname ? `${nickname}님, ` : ''}저 부품 장사꾼 아니에요! 저희는 부품이나 쇼핑몰 광고를 절대 팔지 않아요. 엔진을 연결해 주시면 내 PC에 딱 맞는 정확한 부품 규격 이름을 알려드릴게요. 그 이름으로 바깥 AI(제미나이/네이버)에서 직접 찾아보시면 돼요!`,
      nextState: st,
    };
  }

  // ③ 홀림 퀘스트 응답
  if (st.questStep && st.questStep !== 'done' && (isYes(text) || isNo(text) || text === QUEST_YES_LABELER || text === QUEST_YES_ALERT || text === QUEST_NO)) {
    const yes = text === QUEST_YES_LABELER || text === QUEST_YES_ALERT || (isYes(text) && text !== QUEST_NO);
    const consents = { ...(st.consents || {}) };
    if (st.questStep === 'labeler') consents.labeler = yes;
    if (st.questStep === 'son_free') consents.sonFreeAndSpeedAlert = yes;
    const step = nextQuest(st.questStep);
    const prompt = questPromptFor(step, nickname);
    const ack = yes ? '좋아요, 켜뒀어요! ' : '알겠어요, 언제든 말씀만 하세요! ';
    const after: QuestStep = step === 'voice' ? 'done' : step;
    // 대본 첫머리 '좋아요!'와 ack 중복 방지
    const promptBody = prompt ? prompt.text.replace(/^좋아요!\s*/, '') : '';
    return {
      scenarioId: prompt?.id || 'quest_done',
      text: prompt ? `${ack}${promptBody}` : `${ack}`.trim(),
      followUps: prompt?.followUps,
      nextState: { ...st, consents, questStep: after },
    };
  }

  // ④ 급한 유저 → 채팅으로 말 걸었을 때만 귀신검색 안내 (버튼 없음)
  if (isImpatientIntent(text)) {
    const sc = findScenario('impatient_user_wants_search_now');
    if (sc) return { scenarioId: sc.id, text: renderPlaybookText(sc.response, { nickname }), nextState: st };
  }

  // ④-2 귀신창 음소거/소리 켜기 즉시 제어 (cmd_unmute_ghost_sound / cmd_mute_ghost_sound 우선 처리)
  if (/(귀신\s*소리|귀신창\s*소리|소리|효과음|음소거|무음|조용히|시끄러)/.test(text)) {
    const isUnmute = /켜|음소거\s*해제|다시\s*나게/.test(text);
    const isMute = !isUnmute && /꺼|끄|음소거|무음|조용히|시끄러|안\s*나게/.test(text);
    if (isMute || isUnmute) {
      const sc = findScenario(isMute ? 'cmd_mute_ghost_sound' : 'cmd_unmute_ghost_sound');
      try {
        if (typeof fetch !== 'undefined') {
          void fetch('http://127.0.0.1:5199/api/superpower/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sound_enabled: !isMute }),
          }).catch(() => {});
        }
      } catch {
        /* ignore */
      }
      if (sc) {
        return {
          scenarioId: sc.id,
          text: renderPlaybookText(sc.response, { nickname }),
          nextState: st,
        };
      }
    }
  }

  // ⑤ 로드맵 및 앱 설정 키워드 (대본집 text_contains 자동 반영)
  for (const list of Object.values(GHOST_SECRETARY_PLAYBOOK.categories)) {
    for (const sc of list) {
      if (sc.id === 'impatient_user_wants_search_now') continue;
      if (sc.id.startsWith('faq_') && CARE_COMMAND_RE.test(text)) continue;
      const kws = extractTextContainsKeywords(sc.trigger);
      if (kws.length && kws.some((k) => text.includes(k))) {
        const isTurnOff = /꺼|끄|해제|중지|안\s*받|안\s*할/.test(text);
        const toggleState = isTurnOff ? 'OFF(해제)' : 'ON(켜짐)';
        let updatedState = st;
        if (sc.id === 'settings_labeler_toggle') {
          updatedState = { ...st, consents: { ...(st.consents || {}), labeler: !isTurnOff } };
        } else if (sc.id === 'settings_son_free_day_toggle') {
          updatedState = { ...st, consents: { ...(st.consents || {}), sonFreeAndSpeedAlert: !isTurnOff } };
        }
        return {
          scenarioId: sc.id,
          text: renderPlaybookText(sc.response, { nickname, toggle_state: toggleState }),
          nextState: updatedState,
        };
      }
    }
  }

  // ⑥ 대본집에 없는 기능 요청 → VOC 포집 + 희망 답변
  if (FEATURE_REQUEST_RE.test(text)) {
    const sc = findScenario('roadmap_unknown_feature_voc_capture');
    if (sc) {
      logUnmatchedQuestion(text, 'feature_request');
      return { scenarioId: sc.id, text: renderPlaybookText(sc.response, { nickname }), nextState: st };
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────
// 🪪 귀신계 여권 발급 대행 보조 로직
// ─────────────────────────────────────────────────────────────

/** 업무용 PC 자동 패스 기준: 인물 사진 20장 미만이면 여권 질문 생략 (마스터기획서 7장 3)-1) */
export const PASSPORT_MIN_FACE_PHOTOS = 20;

export function decidePassportEntry(facePhotoCount: number, passportInitialized: boolean): 'ask' | 'skip' {
  if (passportInitialized) return 'skip';
  return facePhotoCount >= PASSPORT_MIN_FACE_PHOTOS ? 'ask' : 'skip';
}

const NAME_DESCRIPTOR_RE = /^(우리\s*)?(강아지|고양이|댕댕이|멍멍이|냥이|반려견|반려묘)\s+/;
const NAME_TAIL_RE = /(이야|야|예요|이에요|입니다|이고|고|임|요)$/;

/** "1번은 나고, 2번은 한치우, 3번은 강아지 초코야" → selfIndex 1, names [2:한치우, 3:초코] (관계 꼬리표만 말하면 거절 목록) */
export function parsePassportNamingAnswer(text: string): PassportNamingResult {
  const result: PassportNamingResult = { names: [], rejectedRelationTags: [] };
  const re = /(\d+)\s*번\s*(?:은|는|이|가)?\s*([^,，.\n]+?)(?=\s*(?:,|，|\.|\n|\s\d+\s*번|$))/g;
  for (const m of text.matchAll(re)) {
    const index = Number(m[1]);
    let name = m[2].trim().replace(/[!?~]+$/, '').trim();
    name = name.replace(NAME_TAIL_RE, '').trim();
    name = name.replace(NAME_DESCRIPTOR_RE, '').trim();
    if (!name) continue;
    if (/^(나|저|본인|내\s*얼굴)$/.test(name)) {
      result.selfIndex = index;
    } else if (isRelationTagOnly(name)) {
      result.rejectedRelationTags.push(name);
    } else {
      result.names.push({ index, realName: name.slice(0, 20) });
    }
  }
  return result;
}

/** 모바일 단독(무료) 징검다리 탐색 창: 100 → 300 → 500장 (인물 미발견 시 다음 창, 500장 이후 중단) */
export const MOBILE_STEPPING_STONE_WINDOWS = [100, 300, 500] as const;
export function nextMobileScanWindow(scannedSoFar: number): number | null {
  return MOBILE_STEPPING_STONE_WINDOWS.find((w) => w > scannedSoFar) ?? null;
}

export interface MobileSteppingStoneScanResult {
  windowsTried: number[];
  scannedPhotos: number;
  foundFacesCount: number;
  stoppedAtWindow: number;
  remainingOldPhotos: number;
  shouldAskRemainingChoice: boolean;
}

/**
 * [v1.3 모바일 징검다리 스캔 루프]
 * - 모바일 단독(무료) 환경에서 처음부터 수천 장을 한꺼번에 돌리지 않고,
 *   nextMobileScanWindow(scanned)로 100장 → (미발견 시) 300장 → 500장 순서로 징검다리 탐색을 수행한다.
 * - 인물 후보가 발견되거나 500장 상한에 도달하면 즉시 멈추고,
 *   남은 사진(remainingOldPhotos)이 있으면 1차 여권 발급 직후 귀신비서가
 *   "지금 천천히 찾아두고 약 30분 뒤에 알려드릴까요, 아니면 저녁에 쉬실 때 조용히 해둘까요?" 선택권을 제안한다.
 */
export function executeMobileSteppingStoneScan(params: {
  totalPhotoCount: number;
  countFacesInWindow: (windowLimit: number) => number;
  minFacesToStop?: number;
}): MobileSteppingStoneScanResult {
  const total = Math.max(0, Math.floor(params.totalPhotoCount));
  const minFaces = params.minFacesToStop ?? 1;
  const windowsTried: number[] = [];
  let scanned = 0;
  let foundFaces = 0;
  let stoppedWindow = 0;

  while (true) {
    const nextWin = nextMobileScanWindow(scanned);
    if (nextWin === null) break;
    stoppedWindow = nextWin;
    windowsTried.push(nextWin);
    const effectiveLimit = total > 0 ? Math.min(total, nextWin) : nextWin;
    scanned = nextWin;
    foundFaces = params.countFacesInWindow(effectiveLimit);
    if (foundFaces >= minFaces) break;
    if (total > 0 && effectiveLimit >= total) break;
  }

  const actualScanned = total > 0 ? Math.min(total, stoppedWindow || 100) : stoppedWindow || 100;
  const remainingOldPhotos = Math.max(0, total - actualScanned);
  return {
    windowsTried,
    scannedPhotos: actualScanned,
    foundFacesCount: foundFaces,
    stoppedAtWindow: stoppedWindow || 100,
    remainingOldPhotos,
    shouldAskRemainingChoice: remainingOldPhotos > 0,
  };
}

/** 모바일에서 1차 여권 등록 직후 남은 옛날 사진 스캔 시점 선택 질문 생성 */
export function buildMobileRemainingPhotosChoicePrompt(
  nickname: string,
  remainingPhotos: number
): { scenarioId: string; text: string; followUps: string[] } | null {
  if (remainingPhotos <= 0) return null;
  const sc = findScenario('passport_mobile_remaining_photos_choice');
  if (!sc) return null;
  return {
    scenarioId: sc.id,
    text: renderPlaybookText(sc.response, {
      nickname,
      remaining_photos: remainingPhotos.toLocaleString('ko-KR'),
    }),
    followUps: ['지금 천천히 돌려줘 (30분 뒤 안내)', '저녁에 쉴 때 조용히 해줘'],
  };
}

/**
 * [전환율 보강 ③] 모바일 온보딩 말미 『모바일 ➔ PC 회수 브릿지』 안내 문구 생성
 */
export const MOBILE_TO_PC_BRIDGE_TEXT =
  '지금 스마트폰으로 들어오셨네요! 내일 출근해서 PC로 켜시면 카톡·엑셀 작업 시간을 반으로 줄여주는 『⚡ 귀신창 초능력』을 바로 쓰실 수 있게 카톡(나에게 보내기)에 PC 실행 링크를 넣어두실래요?';

export function buildMobileToPcBridgePrompt(nickname?: string): {
  scenarioId: string;
  text: string;
} {
  const prefix = nickname ? `${nickname}님, ` : '';
  return {
    scenarioId: 'mobile_to_pc_recovery_bridge',
    text: `${prefix}${MOBILE_TO_PC_BRIDGE_TEXT}`,
  };
}

/** 첫 환영 문구: 별명이 없으면 대본집 ask_nickname_first, 있으면 별명 호칭 인사 */
export function buildWelcomeTurn(st: GhostSecretaryState): { text: string; nextState: GhostSecretaryState } {
  if (!st.nickname) {
    const sc = findScenario('ask_nickname_first');
    return { text: sc?.response || '', nextState: { ...st, awaitingNickname: true } };
  }
  return {
    text: `${st.nickname}님, 다시 오셨네요! 컴퓨터·휴대폰 손보기, 복원, 귀신계 여권까지 편하게 말씀해 주세요.`,
    nextState: st,
  };
}
