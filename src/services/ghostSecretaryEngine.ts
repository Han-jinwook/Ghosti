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

/** 대본집 avatar 경로(/assets/baby_ghost_3d_icon.png)가 public 에 없으므로 공식 애기귀신 앱 아이콘으로 대체 */
export const GHOST_SECRETARY_AVATAR_SRC = '/gwisinkachi_app_icon_512.png';
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

/** 별명 답변 정제: "저는 멀린이에요", "멀린이라고 불러줘" → "멀린" */
export function sanitizeNicknameAnswer(raw: string): string {
  let s = raw.trim().replace(/[!.~?？！。"'`]+/g, '').trim();
  s = s.replace(/^(저는|전|나는|난|제\s*이름은|제\s*별명은|별명은)\s*/, '');
  s = s.replace(/\s*(이라고|라고)\s*(불러\s*(줘|주세요|줘요)?|해\s*(줘|주세요)?)?\s*$/, '');
  s = s.replace(/\s*(이에요|예요|입니다|이야|야|요)$/, '');
  s = s.replace(/님$/, '');
  return s.trim().slice(0, 12);
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
export interface GhostSecretaryTurn {
  scenarioId: string;
  text: string;
  followUps?: string[];
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

export function resolveGhostSecretaryTurn(rawText: string, st: GhostSecretaryState): GhostSecretaryTurn | null {
  const text = rawText.trim();
  if (!text) return null;
  const nickname = st.nickname || '';

  // ① 첫인사 별명 답변
  if (st.awaitingNickname && !st.nickname) {
    const nick = sanitizeNicknameAnswer(text);
    if (nick) {
      return {
        scenarioId: 'nickname_registered',
        text: `${nick}님! 이름 예쁘네요, 평생 이렇게 불러드릴게요. 🪪 귀신계 여권(나)에도 새겨뒀어요!`,
        nextState: { ...st, nickname: nick, awaitingNickname: false },
        needsColdReading: true,
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

  // ⑤ 로드맵 키워드 (대본집 text_contains 자동 반영)
  for (const list of Object.values(GHOST_SECRETARY_PLAYBOOK.categories)) {
    for (const sc of list) {
      if (sc.id === 'impatient_user_wants_search_now') continue;
      const kws = extractTextContainsKeywords(sc.trigger);
      if (kws.length && kws.some((k) => text.includes(k))) {
        return { scenarioId: sc.id, text: renderPlaybookText(sc.response, { nickname }), nextState: st };
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
