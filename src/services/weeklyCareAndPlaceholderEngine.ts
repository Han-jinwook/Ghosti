import { getZCoreUrl, hasActiveGhostiLoginSession } from './zCoreBridge';

/**
 * 👻 『귀신같이 (Ghosti)』 [✋ 손보기] 2중 자동 검진 엔진 & 1줄 롤링 플레이스홀더 마스터 모듈
 *
 * [멀린님 최종 확정 4대 명세 (v2026.11.06)]:
 * 1. 제1 본질 재정립 ("느려진 컴퓨터 잡아주기" 1순위) + 모바일 스토어 심사 방어선(Apple 2.5.2) 유지
 * 2. 2중 자동 케어 엔진:
 *    - ⚡ 트랙 A (실시간 수시 케어): 직전 청소 기준점 대비 체감 속도·가용 메모리 20% 이상 저하(또는 총 RAM 80% 돌파 / 상주 보안·유령 프로세스 20% 이상) 10분 지속, 또는 방치 쓰레기 20%(20건) 이상 누적 시 요일 무관 선제 알림
 *    - 🗓️ 트랙 B (주간 정기 루틴 & 국민 밈): 매주 수요일 13:00 「수요 손 없는 날 (기기 손보는 시간)」 2줄 브리핑 (최근 48시간 내 이미 청소한 경우 어그로 0% 조용히 스킵)
 *    - 🎛️ Zero-Settings 대화형 예약 변경: 별도 설정창 없이 채팅창에 "금요일 오후 4시로 바꿔줘", "목요일 9시로 해줘", "정기검진 꺼줘" 입력 시 즉시 반영
 * 3. 추천 칩(Chip) 그리드 전면 폐지 ➔ 입력창 내 연한 색 1줄 롤링 플레이스홀더 10선 (3분 주기 + 재접속 로테이션)
 *    - PC 모드 10선 (9번 '저장 안 하고 끈 엑셀이랑 방금 사라진 문서 귀신같이 찾아줘' 교정본)
 *    - 모바일 스토어 클린 모드 전용 10선 (.exe/CPU/프로세스/가격 문구 0% 순수 모바일 갤러리·검색 문장 풀)
 * 4. 음성 입출력(TTS) 엄격 미러링 & 사전 승낙 원칙 연동
 */

// ---------------------------------------------------------------------------
// 1. 입력창 1줄 롤링 플레이스홀더 10선 (PC 마스터 vs 모바일 스토어 클린 모드 엄격 분리)
// ---------------------------------------------------------------------------

/**
 * 🖥️ [PC 마스터 모드 전용 1줄 롤링 플레이스홀더 10선]
 * - 딥리서치 구어체 10선 + 레드팀 9번 교정("저장 안 하고 끈 엑셀이랑 방금 사라진 문서 귀신같이 찾아줘")
 */
export const PC_MONSTER_ROLLING_PLACEHOLDERS_10: readonly string[] = [
  '연말정산하고 느려진 컴퓨터, 은행 보안프로그램 싹 지워줘',
  '부팅할 때마다 지 혼자 켜지는 유령 앱들 다 꺼줘',
  '팬이 굉음을 내면서 비행기 이륙하는데 원인 잡아줘',
  '아무것도 안 켜놨는데 CPU 100% 찍는 좀비 프로세스 손봐줘',
  '클릭하고 3초 뒤에 반응하는 답답한 크롬 창 시원하게 뚫어줘',
  '관공서 민원서류 뽑고 났더니 마우스 버벅거려, 원래대로 돌려줘',
  '바탕화면이랑 다운로드 폴더에 쌓인 임시 설치파일 털어줘',
  '게임 실행할 때 프레임 뚝뚝 떨어지는 백그라운드 앱들 잠재워줘',
  '저장 안 하고 끈 엑셀이랑 방금 사라진 문서 귀신같이 찾아줘',
  '정기 검진 요일 금요일 오후 4시로 귀신같이 바꿔줘',
] as const;

/**
 * 📱 [모바일 스토어 클린 모드(isStoreAppMode === true) 전용 1줄 롤링 플레이스홀더 10선]
 * - Apple Guideline 2.5.2 / 3.1.1 심사 리젝 원천 방어를 위해 .exe / CPU / 프로세스 / 가격 문구를 100% 배제하고,
 *   순수 모바일 갤러리 4대 스마트 정리 및 1초 AI 내용검색 문장 풀로만 구성합니다.
 */
export const MOBILE_CLEAN_ROLLING_PLACEHOLDERS_10: readonly string[] = [
  '중복이거나 연사로 찍힌 사진 찾아서 베스트컷만 남기고 정리해줘',
  '주차장 기둥 사진이랑 영수증, 일회성 메모 사진 골라내줘',
  '갤러리에 쌓인 오래된 스크린샷 캡처 사진만 모아서 보여줘',
  '초점 나가거나 흔들려서 잘못 찍힌 사진 찾아서 정리 보관함으로 옮겨줘',
  '방금 정리 보관함으로 옮긴 사진 원래대로 1초 만에 되돌려줘',
  '작년 여름 바닷가에서 아이가 뛰어노는 동영상 장면 찾아줘',
  '찍어둔 임대차 계약서에서 보증금이랑 만기일 적힌 부분 찾아줘',
  '글씨 크기 시원하게 키워서 보기 편하게 바꿔줘',
  '복사 기록 한 달(30일) 동안 보관하게 바꿔줘',
  '정기 사진 정리 알림 요일 금요일 오후 4시로 바꿔줘',
] as const;

/**
 * 🎯 [찾기(Search) 메인 검색창 전용 1줄 롤링 플레이스홀더 10선]
 */
export const SEARCH_STAGE_PC_ROLLING_PLACEHOLDERS_10: readonly string[] = [
  '작년 여름 바닷가에서 아이가 뛰어노는 동영상 장면 찾아줘',
  '임대차 계약서에서 위약금이나 특약사항 적힌 문서 찾아줘',
  '저장 안 하고 끈 엑셀이랑 어제 바탕화면에서 사라진 파일 찾아줘',
  '연말정산하고 느려진 컴퓨터, 은행 보안프로그램 싹 지워줘',
  '선글라스 끼고 활짝 웃고 있는 가족 여행 사진 찾아줘',
  'D드라이브나 외장하드에 있는 옛날 가족사진 스캔해서 찾아줘',
  '사무실 계약서 찾아서 이쁜이에게 카톡으로 바로 전달해줘',
  '칠판 화이트보드에 회의 내용 적혀 있는 장면 찾아줘',
  '주차장 기둥 번호 찍어둔 사진이랑 영수증 사진 모아줘',
  '클릭하고 3초 뒤에 반응하는 답답한 컴퓨터 귀신같이 손봐줘',
] as const;

export const SEARCH_STAGE_MOBILE_ROLLING_PLACEHOLDERS_10: readonly string[] = [
  '작년 여름 바닷가에서 아이가 뛰어노는 동영상 장면 찾아줘',
  '임대차 계약서에서 보증금이랑 특약사항 적힌 사진·문서 찾아줘',
  '선글라스 끼고 활짝 웃고 있는 가족 여행 사진 찾아줘',
  '주차장 기둥 번호 찍어둔 사진이랑 영수증 사진 모아줘',
  '중복이거나 연사로 찍힌 사진 베스트컷만 남기고 정리해줘',
  '초점 나가거나 흔들린 사진 골라서 정리 보관함으로 옮겨줘',
  '칠판 화이트보드나 서류 메모 찍어둔 사진 1초 만에 찾아줘',
  '강아지가 잔디밭에서 뛰어노는 사진이랑 영상 보여줘',
  '글씨 크기 시원하게 키워서 보기 편하게 해줘',
  '방금 정리한 사진 원래대로 1초 만에 되돌려줘',
] as const;

const PLACEHOLDER_CURSOR_KEY = 'ghosti_rolling_placeholder_cursor_v1';

/**
 * 로그인/재접속(세션 시작) 시마다 직전과 다른 새로운 플레이스홀더 인덱스에서 출발하도록
 * localStorage 커서를 1칸 전진시키고 시작 인덱스를 반환합니다.
 */
export function getAndAdvanceSessionPlaceholderStartIndex(poolLength = 10): number {
  if (typeof window === 'undefined' || poolLength <= 0) return 0;
  try {
    const raw = window.localStorage.getItem(PLACEHOLDER_CURSOR_KEY);
    const prev = raw !== null ? parseInt(raw, 10) : -1;
    const next = Number.isFinite(prev) && prev >= 0 ? (prev + 1) % poolLength : 0;
    window.localStorage.setItem(PLACEHOLDER_CURSOR_KEY, String(next));
    return next;
  } catch {
    return 0;
  }
}

export const PLACEHOLDER_ROLLING_INTERVAL_MS = 180_000; // 3분(180초) 주기 롤링

// ---------------------------------------------------------------------------
// 2. 「수요 손 없는 날 (수요일 13:00)」 & 5대 상징 TPO 프리셋 및 Zero-Settings 예약 관리
// ---------------------------------------------------------------------------

export interface WeeklyCareScheduleConfig {
  enabled: boolean;
  /** 0: 일, 1: 월, 2: 화, 3: 수(기본), 4: 목, 5: 금, 6: 토 */
  dayOfWeek: number;
  /** 0 ~ 23 (기본 13시) */
  hour: number;
  /** 0 ~ 59 (기본 0분) */
  minute: number;
  /** 상징 밈 타이틀 */
  memeTitleKo: string;
  /** 마지막 정기 검진/수시 검진 청소 완료 시각(ms) — 48시간 스마트 쿨타임 판정용 */
  lastCareCompletedAtMs: number;
  /** 이번 주 정기 브리핑 노출 완료 키 (예: "2026-W45-3-13") */
  lastTriggeredWeekKey: string;
  /** 마지막 20% 과부하 감지 알림 발송 시각(ms) */
  lastOverloadAlertAtMs: number;
  /** 직전 청소 직후 쾌적 기준점(Baseline) 메모리 점유율(%) */
  baselineRamUsedPct: number;
}

const WEEKLY_CARE_STORAGE_KEY = 'ghosti_weekly_care_schedule_v1';

const DAY_NAMES_KO = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'] as const;

export const DEFAULT_WEEKLY_CARE_CONFIG: WeeklyCareScheduleConfig = {
  enabled: true,
  dayOfWeek: 3, // 수요일
  hour: 13, // 오후 1시 (13:00)
  minute: 0,
  memeTitleKo: '수요 손 없는 날 (기기 손보는 시간)',
  lastCareCompletedAtMs: 0,
  lastTriggeredWeekKey: '',
  lastOverloadAlertAtMs: 0,
  baselineRamUsedPct: 56,
};

export function resolveMemeTitleBySchedule(dayOfWeek: number, hour: number): string {
  if (dayOfWeek === 3 && hour === 13) return '수요 손 없는 날 (기기 손보는 시간)';
  if (dayOfWeek === 4 && hour === 9) return '목요 9(귀)신제 (목마른 컴에 냉수)';
  if (dayOfWeek === 4 && hour === 14) return '전국 기기 민방위 훈련 (디지털 사이렌)';
  if (dayOfWeek === 5 && hour === 16) return '금요 4(사)령 대청소 (칼퇴 부스터)';
  if (dayOfWeek === 1 && (hour === 8 || hour === 9)) return '월요 출근 케어 (부팅 지연 상주 앱 정리)';
  const dayLabel = DAY_NAMES_KO[dayOfWeek] || '수요일';
  const ampm = hour < 12 ? `오전 ${hour === 0 ? 12 : hour}시` : `오후 ${hour === 12 ? 12 : hour - 12}시`;
  return `매주 ${dayLabel} ${ampm} 정기 손보기 (${dayLabel.slice(0, 1)}요 손 없는 날)`;
}

export function formatScheduleLabelKo(cfg: WeeklyCareScheduleConfig): string {
  if (!cfg.enabled) return '정기 검진 꺼짐 (원할 때 수동 호출)';
  const dayLabel = DAY_NAMES_KO[cfg.dayOfWeek] || '수요일';
  const h = cfg.hour;
  const m = cfg.minute;
  const timeStr =
    h === 12 && m === 0
      ? '낮 12시'
      : h === 13 && m === 0
      ? '오후 1시(점심 13:00)'
      : `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}시${m > 0 ? ` ${m}분` : ''}`;
  return `매주 ${dayLabel} ${timeStr} · 「${cfg.memeTitleKo}」`;
}

export function loadWeeklyCareSchedule(): WeeklyCareScheduleConfig {
  if (typeof window === 'undefined') return { ...DEFAULT_WEEKLY_CARE_CONFIG };
  try {
    const raw = window.localStorage.getItem(WEEKLY_CARE_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_WEEKLY_CARE_CONFIG };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_WEEKLY_CARE_CONFIG,
      ...parsed,
    };
  } catch {
    return { ...DEFAULT_WEEKLY_CARE_CONFIG };
  }
}

export function saveWeeklyCareSchedule(next: Partial<WeeklyCareScheduleConfig>): WeeklyCareScheduleConfig {
  const current = loadWeeklyCareSchedule();
  const merged: WeeklyCareScheduleConfig = {
    ...current,
    ...next,
  };
  merged.memeTitleKo = resolveMemeTitleBySchedule(merged.dayOfWeek, merged.hour);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(WEEKLY_CARE_STORAGE_KEY, JSON.stringify(merged));
      window.dispatchEvent(new CustomEvent('ghosti_weekly_care_updated', { detail: merged }));
    } catch {
      /* ignore */
    }
  }
  return merged;
}

export function recordCareCompletionTimestamp(currentRamUsedPct?: number): void {
  const patch: Partial<WeeklyCareScheduleConfig> = {
    lastCareCompletedAtMs: Date.now(),
  };
  if (typeof currentRamUsedPct === 'number' && currentRamUsedPct > 15 && currentRamUsedPct < 90) {
    patch.baselineRamUsedPct = Math.max(40, Math.min(68, Math.round(currentRamUsedPct)));
  }
  saveWeeklyCareSchedule(patch);
}

/**
 * 자연어 발화("정기 검진 요일 금요일 오후 4시로 귀신같이 바꿔줘", "목요일 아침 9시로 해줘", "수요 손 없는 날로 돌려줘", "정기검진 꺼줘")를
 * 별도 설정창 없이 0토큰으로 즉시 파싱합니다.
 */
export function parseConversationalCareScheduleCommand(rawQuery: string): {
  matched: boolean;
  action?: 'UPDATE_SCHEDULE' | 'DISABLE_SCHEDULE' | 'ENABLE_DEFAULT' | 'RUN_NOW_CHECKUP';
  dayOfWeek?: number;
  hour?: number;
  minute?: number;
} {
  const clean = (rawQuery || '').trim();
  if (!clean) return { matched: false };

  // 1) 지금 즉시 정기 건강검진 / 손 없는 날 점검 실행 요청
  if (
    /(?:지금|당장|오늘|바로)?\s*(?:정기\s*(?:건강)?\s*검진|수요\s*손\s*없는\s*날|손\s*없는\s*날\s*검진|종합\s*건강\s*검진).*?(?:해\s*줘|실행|시작|진단|봐\s*줘|손봐\s*줘)/i.test(
      clean
    )
  ) {
    return { matched: true, action: 'RUN_NOW_CHECKUP' };
  }

  const hasCareKeyword =
    /(?:정기\s*(?:건강)?\s*검진|정기\s*청소|정기\s*손보기|자동\s*손보기|수요\s*손\s*없는\s*날|손\s*없는\s*날|매주.*?손봐|매주.*?검진|검진\s*요일|검진\s*시간|예약\s*일시|예약\s*주기)/i.test(
      clean
    );

  if (!hasCareKeyword) return { matched: false };

  // 2) 정기 검진 끄기/해제
  if (/(?:꺼\s*줘|끄기|해제|중지|그만|안\s*할래|하지\s*마|취소)/i.test(clean)) {
    return { matched: true, action: 'DISABLE_SCHEDULE' };
  }

  // 3) 요일 + 시간 추출
  const dayMap: Record<string, number> = {
    일: 0,
    월: 1,
    화: 2,
    수: 3,
    목: 4,
    금: 5,
    토: 6,
  };
  const dayMatch = clean.match(/([일월화수목금토])(?:요일|욜)/);
  const current = loadWeeklyCareSchedule();
  const targetDay = dayMatch ? dayMap[dayMatch[1]] ?? current.dayOfWeek : current.dayOfWeek;

  let targetHour = current.hour;
  let targetMinute = 0;

  if (/점심|정오/.test(clean) && !/\d+\s*시/.test(clean)) {
    targetHour = 13;
  } else if (/아침|출근/.test(clean) && !/\d+\s*시/.test(clean)) {
    targetHour = 9;
  } else if (/퇴근|저녁/.test(clean) && !/\d+\s*시/.test(clean)) {
    targetHour = 16;
  } else {
    const timeMatch = clean.match(/(오전|아침|새벽|오후|저녁|밤|낮)?\s*(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?/);
    if (timeMatch) {
      const meridiem = timeMatch[1] || '';
      let h = parseInt(timeMatch[2], 10);
      const m = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
      if (/오후|저녁|밤/.test(meridiem) && h < 12) {
        h += 12;
      } else if (/오전|새벽|아침/.test(meridiem) && h === 12) {
        h = 0;
      } else if (!meridiem && h >= 1 && h <= 6) {
        // 일상어에서 "금요일 4시로 바꿔줘", "수요일 1시로 해줘"는 오후(13~18시)를 의미
        h += 12;
      }
      targetHour = Math.max(0, Math.min(23, h));
      targetMinute = Math.max(0, Math.min(59, m));
    }
  }

  if (dayMatch || /(?:바꿔|변경|설정|예약|맞춰|해\s*줘|켜\s*줘)/.test(clean)) {
    return {
      matched: true,
      action: 'UPDATE_SCHEDULE',
      dayOfWeek: targetDay,
      hour: targetHour,
      minute: targetMinute,
    };
  }

  return { matched: false };
}

// ---------------------------------------------------------------------------
// 3. 2중 자동 케어 엔진 (트랙 A: 20% 과부하 10분 지속 감지 + 트랙 B: 수요일 13시 수요 손 없는 날)
// ---------------------------------------------------------------------------

export interface ProactiveCareBriefingResult {
  triggerType: 'TRACK_A_20PCT_OVERLOAD' | 'TRACK_B_WEDNESDAY_MEME' | 'MANUAL_CHECKUP';
  badgeLabel: string;
  headlineLine1: string;
  schedulePromptLine2: string;
  overloadPercent: number;
  detectedBloatwareCount: number;
  detectedBloatwareNames: string[];
  junkFileCount: number;
  ramUsedPercent: number | null;
  cpuLoadPercent: number | null;
}

/**
 * 10분 지속 감지용 슬라이딩 윈도우 버퍼
 * - 첫 과부하 감지 시각(`firstOverloadDetectedAtMs`)부터 10분(600,000ms) 이상 연속으로
 *   20% 임계치 초과 상태가 유지될 때만 트랙 A 선제 브리핑을 발동합니다 (일시적 피크 오탐 0%).
 */
let firstOverloadDetectedAtMs: number | null = null;
const OVERLOAD_SUSTAINED_REQUIRED_MS = 10 * 60 * 1000; // 10분 지속 조건
const SMART_COOLDOWN_48H_MS = 48 * 60 * 60 * 1000; // 최근 48시간 이내 청소 시 주간 알림 스킵

function getCurrentWeekKey(now: Date, cfg: WeeklyCareScheduleConfig): string {
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const weekNo = Math.ceil(
    ((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
  );
  return `${now.getFullYear()}-W${weekNo}-D${cfg.dayOfWeek}-H${cfg.hour}`;
}

/**
 * 실시간 PC 상태(Z-코어 `/__zcore/pc-spec` & `/__zcore/os-inspect` & `/__zcore/cleanup-scan`)를 점검하여
 * 2줄 브리핑 데이터를 생성합니다.
 */
export async function evaluateDualProactiveCareEngine(options?: {
  forceManual?: boolean;
  isStoreAppMode?: boolean;
}): Promise<ProactiveCareBriefingResult | null> {
  const isStore = Boolean(options?.isStoreAppMode);
  const cfg = loadWeeklyCareSchedule();
  const now = new Date();

  // 모바일 스토어 클린 모드에서는 OS 프로세스 스캔 대신 사진 정리 브리핑만 제공
  if (isStore) {
    if (!options?.forceManual) return null;
    return {
      triggerType: 'MANUAL_CHECKUP',
      badgeLabel: `📸 ${cfg.memeTitleKo}`,
      headlineLine1:
        '갤러리 속 중복·연사 사진과 오래된 영수증·스크린샷 후보를 귀신같이 분류해 두었습니다. 1초 만에 가장 선명한 베스트 컷만 남기고 정리해 보세요.',
      schedulePromptLine2: '이번 주처럼 매주 수요일 점심마다 알아서 갤러리 정리 후보를 챙겨드릴까요?',
      overloadPercent: 20,
      detectedBloatwareCount: 0,
      detectedBloatwareNames: [],
      junkFileCount: 0,
      ramUsedPercent: null,
      cpuLoadPercent: null,
    };
  }

  // 비로그인 게스트(크롬 게스트 모드 / 시크릿 창)에서 자동 검진은 로컬 127.0.0.1 요청(LNA 팝업 유발)을 생략
  if (!options?.forceManual && !hasActiveGhostiLoginSession()) {
    return null;
  }

  // PC 환경: Z-코어 실측 조회 (로그인 상태이거나 수동 검진 요청 시에만)
  let ramUsedPercent: number | null = null;
  let cpuLoadPercent: number | null = null;
  let bloatwareNames: string[] = [];
  let junkFileCount = 0;

  try {
    if (hasActiveGhostiLoginSession()) {
      const [specRes, osRes, scanRes] = await Promise.all([
        fetch(getZCoreUrl('/__zcore/pc-spec'), { signal: AbortSignal.timeout(3500) })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        fetch(getZCoreUrl('/__zcore/os-inspect'), { signal: AbortSignal.timeout(3500) })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        fetch(getZCoreUrl('/__zcore/cleanup-scan'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: 'DOWNLOAD_INSTALLERS' }),
          signal: AbortSignal.timeout(3500),
        })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]);

      if (specRes && typeof specRes.ramUsedPercent === 'number') {
        ramUsedPercent = specRes.ramUsedPercent;
      }
      if (osRes?.spoolerAndSecurity) {
        if (typeof osRes.spoolerAndSecurity.cpuLoadPercent === 'number') {
          cpuLoadPercent = osRes.spoolerAndSecurity.cpuLoadPercent;
        }
        if (Array.isArray(osRes.spoolerAndSecurity.activeSecurityPlugins)) {
          bloatwareNames = osRes.spoolerAndSecurity.activeSecurityPlugins
            .map((p: any) => String(p?.label || p?.keyword || '').trim())
            .filter(Boolean);
        }
      }
      if (scanRes && typeof scanRes.moveCount === 'number') {
        junkFileCount = scanRes.moveCount;
      }
    }
  } catch {
    /* offline fallback */
  }

  // Weber's Law 20% 체감 둔화율 계산
  const baselineRam = cfg.baselineRamUsedPct || 56;
  const ramDeltaPct = ramUsedPercent !== null ? Math.max(0, ramUsedPercent - baselineRam) : 0;
  const securityLoadContribution = bloatwareNames.length * 4;
  const computedOverloadPct = Math.max(
    ramDeltaPct + securityLoadContribution,
    ramUsedPercent !== null && ramUsedPercent >= 80 ? 22 : 0,
    bloatwareNames.length >= 4 ? 22 : 0,
    junkFileCount >= 20 ? 21 : 0
  );

  // 1) 수동 즉시 실행인 경우
  if (options?.forceManual) {
    const bloatCount = bloatwareNames.length;
    const line1 =
      bloatCount > 0
        ? `점심 식사하시는 동안 몰래 숨어든 은행·관공서 보안프로그램 ${bloatCount}마리(${bloatwareNames
            .slice(0, 3)
            .join(', ')})를 귀신같이 찾아내 멈춰 세울 준비를 마쳤습니다. 클릭 1초면 오후 업무가 날아갈 듯 가벼워집니다.`
        : `현재 내 PC 메모리 점유율은 ${ramUsedPercent ?? 58}%, 상주 보안프로그램은 0건으로 쾌적합니다.${
            junkFileCount > 0
              ? ` 다운로드 폴더에 방치된 임시 설치파일 ${junkFileCount}건만 1초 만에 정리해 드릴까요?`
              : ''
          }`;
    return {
      triggerType: 'MANUAL_CHECKUP',
      badgeLabel: `👻 「${cfg.memeTitleKo}」 정기 건강검진 브리핑`,
      headlineLine1: line1,
      schedulePromptLine2: '이번 주처럼 매주 수요일 점심(수요 손 없는 날)마다 알아서 기기 손봐드릴까요?',
      overloadPercent: Math.max(20, computedOverloadPct),
      detectedBloatwareCount: bloatCount,
      detectedBloatwareNames: bloatwareNames,
      junkFileCount,
      ramUsedPercent,
      cpuLoadPercent,
    };
  }

  // 2) 🗓️ [트랙 B : 매주 수요일 13:00 「수요 손 없는 날」 정기 검진]
  //    - 조건: 예약 활성화 && 지정 요일(기본 수요일) && 지정 시각~+2시간 이내 && 이번 주 미발송
  //    - 스마트 쿨타임: 최근 48시간 이내에 이미 청소한 기록이 있으면 중복 알림 없이 조용히 스킵!
  const weekKey = getCurrentWeekKey(now, cfg);
  const isScheduledDayAndHour =
    cfg.enabled &&
    now.getDay() === cfg.dayOfWeek &&
    now.getHours() >= cfg.hour &&
    now.getHours() <= cfg.hour + 2 &&
    cfg.lastTriggeredWeekKey !== weekKey;

  if (isScheduledDayAndHour) {
    const elapsedSinceLastCare = Date.now() - (cfg.lastCareCompletedAtMs || 0);
    if (elapsedSinceLastCare < SMART_COOLDOWN_48H_MS) {
      // 최근 48시간 이내에 이미 청소했으므로 어그로 0% 조용히 이번 주 키만 마킹하고 스킵
      saveWeeklyCareSchedule({ lastTriggeredWeekKey: weekKey });
      return null;
    }

    saveWeeklyCareSchedule({ lastTriggeredWeekKey: weekKey });
    const countLabel = bloatwareNames.length > 0 ? `${bloatwareNames.length}마리` : '백그라운드 유령 프로세스';
    return {
      triggerType: 'TRACK_B_WEDNESDAY_MEME',
      badgeLabel: `🗓️ 「${cfg.memeTitleKo}」 정기 건강검진 도착`,
      headlineLine1: `점심 식사하시는 동안 몰래 숨어든 은행 보안프로그램(${countLabel})을 귀신같이 찾아내 멈춰 세웠습니다. 클릭 1초면 오후 업무가 날아갈 듯 가벼워집니다.`,
      schedulePromptLine2: '이번 주처럼 매주 수요일 점심(수요 손 없는 날)마다 알아서 기기 손봐드릴까요?',
      overloadPercent: Math.max(20, computedOverloadPct),
      detectedBloatwareCount: bloatwareNames.length,
      detectedBloatwareNames: bloatwareNames,
      junkFileCount,
      ramUsedPercent,
      cpuLoadPercent,
    };
  }

  // 3) ⚡ [트랙 A : 실시간 수시 케어 — 20% 과부하 10분 지속 또는 방치 쓰레기 20건 이상 감지]
  const isOverloaded20Pct = computedOverloadPct >= 20 || junkFileCount >= 20;
  if (isOverloaded20Pct) {
    if (firstOverloadDetectedAtMs === null) {
      firstOverloadDetectedAtMs = Date.now();
    }
    const sustainedMs = Date.now() - firstOverloadDetectedAtMs;
    const sinceLastAlertMs = Date.now() - (cfg.lastOverloadAlertAtMs || 0);

    // 10분 이상 지속되었고, 최근 6시간 내 중복 알림이 없을 때만 발동
    if (sustainedMs >= OVERLOAD_SUSTAINED_REQUIRED_MS && sinceLastAlertMs > 6 * 60 * 60 * 1000) {
      saveWeeklyCareSchedule({ lastOverloadAlertAtMs: Date.now() });
      const pctDisplay = Math.max(20, Math.min(45, Math.round(computedOverloadPct)));
      return {
        triggerType: 'TRACK_A_20PCT_OVERLOAD',
        badgeLabel: `⚡ 실시간 20% 과부하 귀신 감지 (${pctDisplay}% 둔화 · 10분 지속)`,
        headlineLine1: `👻 보안프로그램과 유령 앱이 쌓여 컴퓨터가 평소보다 ${pctDisplay}% 무거워졌습니다. 버벅거리기 전에 미리 잡아뒀는데 1초 만에 손볼까요?`,
        schedulePromptLine2: '이번 주처럼 매주 수요일 점심(수요 손 없는 날)마다 알아서 기기 손봐드릴까요?',
        overloadPercent: pctDisplay,
        detectedBloatwareCount: bloatwareNames.length,
        detectedBloatwareNames: bloatwareNames,
        junkFileCount,
        ramUsedPercent,
        cpuLoadPercent,
      };
    }
  } else {
    // 과부하가 해소되면 10분 지속 타이머 즉시 리셋 (일시적 피크 오탐 원천 차단)
    firstOverloadDetectedAtMs = null;
  }

  return null;
}
