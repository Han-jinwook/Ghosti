import React, { useEffect, useMemo, useState } from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';
import { getZCoreUrl } from '../services/zCoreBridge';
import { GhostiBrandLogo } from './GhostiBrandLogo';

export type OnboardingTabId = 'tab1_find_care' | 'tab2_superpower' | 'tab3_share_pro';

export interface SuperpowerTrialStatus {
  engine_running: boolean;
  machine_hwid: string;
  account_id: string;
  trial_status: 'NOT_STARTED' | 'ACTIVE' | 'EXPIRED' | 'SUBSCRIBED';
  trial_days_left: number;
  started_at: string | null;
  expires_at: string | null;
  is_subscribed: boolean;
  snippets: Record<string, string>;
}

const DEFAULT_SNIPPETS: Record<string, string> = {
  F1: '국민은행 123-45-678910 (예금주: 홍길동)',
  F2: '서울특별시 강남구 테헤란로 123, 4층',
  F3: 'contact@sundreamer.app',
  F4: '안녕하세요, 확인 후 빠르게 회신드리겠습니다. 감사합니다.',
  F5: '귀신같이(Ghosti) 1초 내용검색 https://ghosti.sundreamer.app',
  F6: '사업자등록번호: 123-86-98765 ((주)썬드림)',
  F7: '세금계산서 발행 이메일: billing@sundreamer.app',
  F8: '현관 공동비밀번호 및 와이파이 안내',
  F9: '오늘 오후 3시 줌(Zoom) 화상 미팅 링크입니다.',
  F10: '감사합니다. 좋은 하루 보내세요!',
};

const TRIAL_STORAGE_KEY = 'ghosti_superpower_trial_v27';
const SNIPPETS_STORAGE_KEY = 'ghosti_superpower_snippets_v27';

/**
 * 애기귀신 3음 상승 차임벨 (도6 -> 미6 -> 솔6, "띠리링~👻") Web Audio 합성기
 * - 브라우저에서도 한영 오타 둔갑술 체험 시 즉시 맑고 귀여운 효과음을 들려줍니다.
 */
export function playBabyGhostChime(mode: 'typo' | 'summon' = 'typo'): void {
  try {
    const wavUrl = mode === 'summon' ? '/sounds/active_summon_sound.wav' : '/sounds/active_typo_sound.wav';
    const audio = new Audio(wavUrl);
    audio.volume = 0.55;
    void audio.play().catch(() => {
      // 브라우저 자동재생 정책 등으로 WAV 재생 실패 시 Web Audio 차임벨 폴백
      playWebAudioFallbackChime();
    });
    return;
  } catch {
    // ignore
  }
  playWebAudioFallbackChime();
}

function playWebAudioFallbackChime(): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [
      { freq: 1046.5, start: 0, dur: 0.075 },
      { freq: 1318.5, start: 0.08, dur: 0.075 },
      { freq: 1568.0, start: 0.16, dur: 0.14 },
    ];
    notes.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      gain.gain.setValueAtTime(0.14, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    });
  } catch {
    // 오디오 컨텍스트 제한 시 무시
  }
}

/**
 * 두벌식 영->한 / 한->영 로컬 즉시 변환 폴백 (Z-코어 미연결 웹 환경에서도 0.01초 즉시 체험 보장)
 */
const ENG_TO_JAMO: Record<string, string> = {
  r: 'ㄱ', R: 'ㄲ', s: 'ㄴ', e: 'ㄷ', E: 'ㄸ', f: 'ㄹ', a: 'ㅁ', q: 'ㅂ', Q: 'ㅃ',
  t: 'ㅅ', T: 'ㅆ', d: 'ㅇ', w: 'ㅈ', W: 'ㅉ', c: 'ㅊ', z: 'ㅋ', x: 'ㅌ', v: 'ㅍ', g: 'ㅎ',
  k: 'ㅏ', o: 'ㅐ', i: 'ㅑ', O: 'ㅒ', j: 'ㅓ', p: 'ㅔ', u: 'ㅕ', P: 'ㅖ', h: 'ㅗ', y: 'ㅛ',
  n: 'ㅜ', b: 'ㅠ', m: 'ㅡ', l: 'ㅣ',
};
const CHOSEONG = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const JUNGSEONG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
const JONGSEONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const COMPOUND_JUNG: Record<string, string> = {
  'ㅗㅏ': 'ㅘ', 'ㅗㅐ': 'ㅙ', 'ㅗㅣ': 'ㅚ', 'ㅜㅓ': 'ㅝ', 'ㅜㅔ': 'ㅞ', 'ㅜㅣ': 'ㅟ', 'ㅡㅣ': 'ㅢ',
};
const COMPOUND_JONG: Record<string, string> = {
  'ㄱㅅ': 'ㄳ', 'ㄴㅈ': 'ㄵ', 'ㄴㅎ': 'ㄶ', 'ㄹㄱ': 'ㄺ', 'ㄹㅁ': 'ㄻ', 'ㄹㅂ': 'ㄼ', 'ㄹㅅ': 'ㄽ', 'ㄹㅌ': 'ㄾ', 'ㄹㅍ': 'ㄿ', 'ㄹㅎ': 'ㅀ', 'ㅂㅅ': 'ㅄ',
};
const COMMON_ENG_ALLOW = new Set(['iphone', 'youtube', 'google', 'naver', 'kakao', 'excel', 'office', 'windows', 'ghost', 'ghosti', 'hello', 'world', 'test']);

function engWordToKorLocal(word: string): string {
  if (COMMON_ENG_ALLOW.has(word.toLowerCase())) return word;
  const raw = Array.from(word).map((c) => ENG_TO_JAMO[c] ?? ENG_TO_JAMO[c.toLowerCase()] ?? c);
  const merged: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    const pair = raw[i] + (raw[i + 1] ?? '');
    if (COMPOUND_JUNG[pair]) {
      merged.push(COMPOUND_JUNG[pair]);
      i++;
    } else {
      merged.push(raw[i]);
    }
  }
  const out: string[] = [];
  let i = 0;
  while (i < merged.length) {
    const c = merged[i];
    const next = merged[i + 1];
    if (CHOSEONG.includes(c) && next && JUNGSEONG.includes(next)) {
      const cho = CHOSEONG.indexOf(c);
      const jung = JUNGSEONG.indexOf(next);
      let jong = 0;
      let step = 2;
      const m2 = merged[i + 2];
      const m3 = merged[i + 3];
      const m4 = merged[i + 4];
      if (m2 && JONGSEONG.includes(m2)) {
        if (m3 && JUNGSEONG.includes(m3)) {
          jong = 0;
        } else if (m3 && COMPOUND_JONG[m2 + m3]) {
          if (m4 && JUNGSEONG.includes(m4)) {
            jong = JONGSEONG.indexOf(m2);
            step = 3;
          } else {
            jong = JONGSEONG.indexOf(COMPOUND_JONG[m2 + m3]);
            step = 4;
          }
        } else {
          jong = JONGSEONG.indexOf(m2);
          step = 3;
        }
      }
      out.push(String.fromCharCode(0xac00 + (cho * 21 + jung) * 28 + jong));
      i += step;
    } else {
      out.push(c);
      i++;
    }
  }
  const res = out.join('');
  if (res === '진자') return '진짜';
  if (res === '어더케') return '어떻게';
  return res;
}

export function simulateSuperpowerLocal(mode: 'typo' | 'number9' | 'extract8' | 'hyphen7', text: string): string {
  const s = text.trim();
  if (!s) return '';
  if (mode === 'typo') {
    return s
      .split(/(\s+)/)
      .map((tok) => (/^[A-Za-z]+$/.test(tok) ? engWordToKorLocal(tok) : tok))
      .join('');
  }
  if (mode === 'hyphen7') {
    if (/^\d{2,4}-\d{3,4}-\d{4}$/.test(s)) return s.replace(/\D/g, '');
    return s.replace(/\b(01[016789])[-.\s]?(\d{3,4})[-.\s]?(\d{4})\b/g, '$1-$2-$3');
  }
  if (mode === 'number9') {
    const digitsOnly = s.replace(/[,\s원]/g, '');
    if (/^\d+$/.test(digitsOnly)) {
      const n = Number(digitsOnly);
      if (!n) return '0';
      const eok = Math.floor(n / 100_000_000);
      const man = Math.floor((n % 100_000_000) / 10_000);
      const rest = n % 10_000;
      const parts: string[] = [];
      if (eok > 0) parts.push(`${eok.toLocaleString()}억`);
      if (man > 0) {
        const cheon = Math.floor(man / 1000);
        const baek = Math.floor((man % 1000) / 100);
        const remMan = man % 100;
        let manStr = '';
        if (cheon > 0) manStr += `${cheon > 1 ? cheon : ''}천`;
        if (baek > 0) manStr += `${baek > 1 ? baek : ''}백`;
        if (remMan > 0) manStr += `${remMan}`;
        parts.push(`${manStr || man}만`);
      }
      if (rest > 0) parts.push(`${rest.toLocaleString()}`);
      return parts.join(' ');
    }
    const korDigit: Record<string, number> = { 영: 0, 공: 0, 일: 1, 이: 2, 삼: 3, 사: 4, 오: 5, 육: 6, 칠: 7, 팔: 8, 구: 9 };
    const smallU: Record<string, number> = { 십: 10, 백: 100, 천: 1000 };
    const largeU: Record<string, number> = { 만: 10000, 억: 100000000, 조: 1000000000000 };
    let largeAcc = 0;
    let smallAcc = 0;
    let cur = 0;
    const clean = s.replace(/[\s,원]+/g, '');
    let i = 0;
    while (i < clean.length) {
      const ch = clean[i];
      if (/\d/.test(ch)) {
        let j = i;
        while (j < clean.length && /\d/.test(clean[j])) j++;
        cur = Number(clean.slice(i, j));
        i = j;
        continue;
      }
      if (korDigit[ch] !== undefined) cur = korDigit[ch];
      else if (smallU[ch]) {
        smallAcc += (cur || 1) * smallU[ch];
        cur = 0;
      } else if (largeU[ch]) {
        largeAcc += (smallAcc + cur || 1) * largeU[ch];
        smallAcc = 0;
        cur = 0;
      }
      i++;
    }
    const total = largeAcc + smallAcc + cur;
    return total > 0 ? total.toLocaleString() : s;
  }
  if (mode === 'extract8') {
    const phoneM = s.match(/\b(01[016789])[-.\s]?(\d{3,4})[-.\s]?(\d{4})\b/);
    const acctM = s.match(/(국민|신한|우리|하나|농협|기업|카카오뱅크|토스뱅크)\s*([0-9-]{9,18})/);
    const schedM = s.match(/(오늘|내일|모레|\d{1,2}월\s*\d{1,2}일|[월화수목금토일]요일)\s*(오전|오후)?\s*(\d{1,2}시(\s*\d{1,2}분)?)/);
    const nameM = s.match(/([가-힣]{2,4})\s*(팀장|대표|과장|대리|사원|입니다|드림)/);
    const lines: string[] = [];
    if (nameM) lines.push(`- 성함: ${nameM[1]}`);
    if (phoneM) lines.push(`- 연락처: ${phoneM[1]}-${phoneM[2]}-${phoneM[3]}`);
    if (acctM) lines.push(`- 계좌: ${acctM[1]} ${acctM[2]}`);
    if (schedM) lines.push(`- 일정: ${schedM[0].trim()}`);
    return lines.length > 0 ? lines.join('\n') : s.replace(/\b(01[016789])[-.\s]?(\d{3,4})[-.\s]?(\d{4})\b/g, '$1-$2-$3');
  }
  return s;
}

export async function fetchSuperpowerStatus(accountId: string, isSubscribed: boolean): Promise<SuperpowerTrialStatus> {
  try {
    const q = new URLSearchParams({ accountId, isSubscribed: String(isSubscribed) });
    const res = await fetch(getZCoreUrl(`/api/superpower/status?${q.toString()}`), {
      signal: AbortSignal.timeout(1500),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.ok) {
        localStorage.setItem(TRIAL_STORAGE_KEY, JSON.stringify(data));
        return data as SuperpowerTrialStatus;
      }
    }
  } catch {
    // 로컬 폴백
  }
  const savedRaw = localStorage.getItem(TRIAL_STORAGE_KEY);
  const savedSnippetsRaw = localStorage.getItem(SNIPPETS_STORAGE_KEY);
  const snippets = savedSnippetsRaw ? { ...DEFAULT_SNIPPETS, ...JSON.parse(savedSnippetsRaw) } : DEFAULT_SNIPPETS;
  if (savedRaw) {
    try {
      const parsed = JSON.parse(savedRaw) as SuperpowerTrialStatus;
      if (isSubscribed) {
        return { ...parsed, trial_status: 'SUBSCRIBED', trial_days_left: 9999, is_subscribed: true, snippets };
      }
      return { ...parsed, snippets };
    } catch {
      // ignore
    }
  }
  return {
    engine_running: false,
    machine_hwid: 'sha256_local_pc_device',
    account_id: accountId,
    trial_status: isSubscribed ? 'SUBSCRIBED' : 'NOT_STARTED',
    trial_days_left: isSubscribed ? 9999 : 7,
    started_at: null,
    expires_at: null,
    is_subscribed: isSubscribed,
    snippets,
  };
}

export async function startSuperpowerTrialAction(accountId: string, isSubscribed: boolean): Promise<SuperpowerTrialStatus> {
  try {
    const res = await fetch(getZCoreUrl('/api/superpower/start-trial'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId, isSubscribed }),
      signal: AbortSignal.timeout(1800),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.ok) {
        localStorage.setItem(TRIAL_STORAGE_KEY, JSON.stringify(data));
        window.dispatchEvent(new CustomEvent('ghosti_superpower_status_updated', { detail: data }));
        return data as SuperpowerTrialStatus;
      }
    }
  } catch {
    // 로컬 폴백
  }
  const now = new Date();
  const exp = new Date(now.getTime() + 7 * 86400 * 1000);
  const fallback: SuperpowerTrialStatus = {
    engine_running: true,
    machine_hwid: 'sha256_local_pc_device',
    account_id: accountId,
    trial_status: isSubscribed ? 'SUBSCRIBED' : 'ACTIVE',
    trial_days_left: isSubscribed ? 9999 : 7,
    started_at: now.toISOString().slice(0, 19).replace('T', ' '),
    expires_at: exp.toISOString().slice(0, 19).replace('T', ' '),
    is_subscribed: isSubscribed,
    snippets: DEFAULT_SNIPPETS,
  };
  localStorage.setItem(TRIAL_STORAGE_KEY, JSON.stringify(fallback));
  window.dispatchEvent(new CustomEvent('ghosti_superpower_status_updated', { detail: fallback }));
  return fallback;
}

// [이메일 단일 로그인 자동 연결]: 불필요한 QR 스캔 없이 이메일 계정 하나로 폰·집PC·회사PC가 자동 연결됩니다.

export const OnboardingModal: React.FC = () => {
  const {
    showOnboarding,
    setShowOnboarding,
    onboardingTrackMode,
    setOnboardingTrackMode,
    pcAgentPairedMobile,
    setPcAgentPairedMobile,
    startOnboardingIndexing,
    cancelOnboardingIndexing,
    photos,
    localDocuments,
    videoSceneItems,
    trialScanPermissions,
    setTrialScanPermission,
    runBriefingHintChip,
    setShowProModal,
    setDesktopTab,
    merlinAuth,
    activePricingPlan,
    subscribedLounges,
  } = useSaySeeStore();

  const [activeTab, setActiveTab] = useState<OnboardingTabId>('tab1_find_care');
  const [trialStatus, setTrialStatus] = useState<SuperpowerTrialStatus | null>(null);

  // 탭 2: 인터랙티브 체험 상태
  const [typoInput, setTypoInput] = useState('dkssudgktpdy qksrkqtmqslek');
  const [typoOutput, setTypoOutput] = useState('안녕하세요 반갑습니다');
  const [typoBadge, setTypoBadge] = useState('👻 띠리링~♪ (2어절 연속 오타 감지 ➔ 한글 자동 변환 + 한/영키 자동 전환)');
  const [showDemoStep, setShowDemoStep] = useState(0);

  // 연속 복사·붙여넣기 체험 큐
  const [pasteQueue, setPasteQueue] = useState<string[]>([
    '홍길동 대표',
    '010-1234-5678',
    '서울 강남구 테헤란로 123',
  ]);
  const [pastedSlots, setPastedSlots] = useState<string[]>([]);
  const [floatingWebOpenedToast, setFloatingWebOpenedToast] = useState(false);
  const [ghostMemoryQuery, setGhostMemoryQuery] = useState('');
  const [ghostMemoryResult, setGhostMemoryResult] = useState<string | null>(null);
  const [ghostMemoryExpanded, setGhostMemoryExpanded] = useState(false);
  const [ghostMemorySelIdx, setGhostMemorySelIdx] = useState(0);
  const [ghostMemoryHoverIdx, setGhostMemoryHoverIdx] = useState<number | null>(null);

  const ghostMemoryCandidates = useMemo(() => {
    const baseItems = [
      {
        id: 'mem-1',
        kind: 'text' as const,
        relTime: '방금 전',
        snippet: '국민은행 123-45-678910 (예금주: 썬드림 백은숙 대표) 월 정기 구독료 정산 계좌 안내',
        fullText:
          '국민은행 123-45-678910 (예금주: 썬드림 백은숙 대표)\n- 용도: 월 정기 구독료 및 거래처 대금 정산 전용 계좌\n- 세금계산서 발행 이메일: billing@sundreamer.app',
      },
      {
        id: 'mem-2',
        kind: 'image' as const,
        relTime: '2분 전',
        snippet: '[이미지 1280x720] 세금계산서_영수증_캡처 · 합계금액 350,000,000원 승인번호 9482-11',
        fullText:
          '[스샷 이미지 (1280x720) · 백그라운드 WinRT OCR 추출 원문]\n공급자: (주)썬드림 / 등록번호: 123-86-98765\n품목: 귀신같이 엔터프라이즈 10년 마스터권\n합계금액: 350,000,000원 (승인번호 9482-11)',
      },
      {
        id: 'mem-3',
        kind: 'text' as const,
        relTime: '5분 전',
        snippet: '서울 강남구 테헤란로 123 썬드림타워 15층 (본사 회의실 방문 안내 및 주차 등록)',
        fullText:
          '서울 강남구 테헤란로 123 썬드림타워 15층\n- 지하 2~4층 방문객 주차장 이용 가능 (2시간 무료 쿠폰 지급)\n- 도착 후 안내데스크에서 홍길동 대표에게 연락 부탁드립니다.',
      },
      {
        id: 'mem-4',
        kind: 'text' as const,
        relTime: '14분 전',
        snippet: '제3조 (납품 및 검수 조건) 본 계약의 유지보수 무상 보증 기간은 검수 완료일로부터 1년으로...',
        fullText:
          '제3조 (납품 및 검수 조건)\n1. 본 계약의 유지보수 무상 보증 기간은 최종 검수 완료일로부터 1년으로 한다.\n2. 납품 지연 시 지체상금은 일 1/1000로 산정하며, 천재지변 또는 발주처 사유는 제외한다.\n3. 모든 소스코드 및 산출물의 지식재산권은 잔금 지급과 동시에 이전된다.',
      },
      {
        id: 'mem-5',
        kind: 'text' as const,
        relTime: '32분 전',
        snippet: '김철수 팀장 010-1234-5678 / 내일 오후 3시 줌(Zoom) 화상 미팅 링크 및 아젠다 공유',
        fullText:
          '김철수 팀장 (010-1234-5678)\n- 일시: 내일 오후 3시 00분\n- 안건: 2026년 하반기 귀신같이 Z-코어 엔터프라이즈 도입 일정 협의',
      },
    ];
    const q = ghostMemoryQuery.trim().toLowerCase();
    if (!q) return baseItems;
    const filtered = baseItems.filter(
      (it) => it.snippet.toLowerCase().includes(q) || it.fullText.toLowerCase().includes(q)
    );
    return filtered.length > 0
      ? filtered
      : [
          {
            id: 'mem-custom',
            kind: 'text' as const,
            relTime: '방금 전',
            snippet: `[${ghostMemoryQuery}] 관련 의미 유사 기억 자동 매칭 (EmbeddingGemma 2)`,
            fullText: `검색어 "${ghostMemoryQuery}"와 의미적으로 가장 가까운 클립보드 기억 항목입니다.\n클릭 또는 Enter 입력 시 현재 커서 위치에 즉시 붙여넣기됩니다.`,
          },
          ...baseItems.slice(0, 4),
        ];
  }, [ghostMemoryQuery]);
  const [telemetryEnabled, setTelemetryEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ghosti_telemetry_enabled') !== 'false';
    } catch {
      return true;
    }
  });
  const [showTermsClause, setShowTermsClause] = useState(false);

  // F1~F10 내 상용구 & 클립보드 보관 기간(기본 7일·최대 30일) & 전화번호 하이픈
  const [snippets, setSnippets] = useState<Record<string, string>>(DEFAULT_SNIPPETS);
  const [snippetSavedMsg, setSnippetSavedMsg] = useState<string | null>(null);
  const [retentionDays, setRetentionDays] = useState<1 | 3 | 7 | 30>(7);
  const [retentionToast, setRetentionToast] = useState<string | null>(null);
  const [hyphenInput, setHyphenInput] = useState('01012345678');
  const [hyphenOutput, setHyphenOutput] = useState('010-1234-5678');

  // 9번 억만금 숫자 변환
  const [moneyInput, setMoneyInput] = useState('3억 5천만');
  const [moneyOutput, setMoneyOutput] = useState('350,000,000');

  // 8번 카톡 혼합 문자 구조화 추출
  const [extractInput, setExtractInput] = useState(
    '김철수 팀장입니다 01012345678 국민 123-45-678910 내일 오후 3시 미팅'
  );
  const [extractOutput, setExtractOutput] = useState(
    '- 성함: 김철수\n- 연락처: 010-1234-5678\n- 계좌: 국민 123-45-678910\n- 일정: 내일 오후 3시'
  );

  const isSubscribedUser = useMemo(
    () =>
      activePricingPlan !== 'free_trial' ||
      Object.values(subscribedLounges).some(Boolean),
    [activePricingPlan, subscribedLounges]
  );

  const accountId = merlinAuth?.email || merlinAuth?.userId || 'local_user';

  // 외부에서 특정 탭(예: 골든존 배너 클릭 시 탭 2)으로 온보딩을 열도록 이벤트 수신
  useEffect(() => {
    const onOpenOnboardingTab = (e: Event) => {
      const custom = e as CustomEvent<{ tab?: OnboardingTabId }>;
      if (custom.detail?.tab) {
        setActiveTab(custom.detail.tab);
      }
      setShowOnboarding(true);
    };
    window.addEventListener('ghosti_open_onboarding_tab', onOpenOnboardingTab);
    return () => window.removeEventListener('ghosti_open_onboarding_tab', onOpenOnboardingTab);
  }, [setShowOnboarding]);

  useEffect(() => {
    if (!showOnboarding) return;
    void fetchSuperpowerStatus(accountId, isSubscribedUser).then((st) => {
      setTrialStatus(st);
      if (st.snippets) {
        setSnippets((prev) => ({ ...prev, ...st.snippets }));
      }
    });
  }, [showOnboarding, accountId, isSubscribedUser]);

  // 탭 2 Show 애니메이션 루프 (3단계 자동 순환)
  useEffect(() => {
    if (!showOnboarding || activeTab !== 'tab2_superpower') return;
    const timer = window.setInterval(() => {
      setShowDemoStep((s) => (s + 1) % 3);
    }, 2200);
    return () => clearInterval(timer);
  }, [showOnboarding, activeTab]);

  const vaultPhotoCount = photos.filter((p) => !p.quarantined && p.isVaultDocument).length;
  const totalIndexedDocs = localDocuments.length + vaultPhotoCount;

  const dynamicTrialDocHints = useMemo(
    () => localDocuments.slice(0, 2).map((d) => d.title),
    [localDocuments]
  );

  const dynamicTrialVideoHints = useMemo(
    () =>
      videoSceneItems.slice(0, 2).map((v) => {
        const highlightFrame =
          v.timelineFrames.find((f) => f.timeSec === v.matchedSeekSec) ??
          v.timelineFrames[0];
        return highlightFrame ? highlightFrame.keywords.slice(0, 3).join(' ') : v.title;
      }),
    [videoSceneItems]
  );

  if (!showOnboarding) return null;

  const handleStart7DayTrial = async () => {
    const st = await startSuperpowerTrialAction(accountId, isSubscribedUser);
    setTrialStatus(st);
    playBabyGhostChime();
    useSaySeeStore.setState({
      lastQuarantineToast:
        '🎉 [귀신 초능력 팩 1주일 무료체험 시작!] 지금부터 7일간 Ctrl + 0 및 2어절 한영 오타 둔갑술이 작동합니다.',
    });
  };

  const handleRunTypoSimulation = async (inputVal: string) => {
    setTypoInput(inputVal);
    try {
      const res = await fetch(getZCoreUrl('/api/superpower/simulate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'typo', text: inputVal }),
        signal: AbortSignal.timeout(900),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.ok) {
          setTypoOutput(data.converted);
          setTypoBadge(data.badge || '👻 띠리링~♪ (한/영키 자동 전환 완료)');
          playBabyGhostChime();
          return;
        }
      }
    } catch {
      // 로컬 폴백
    }
    const localOut = simulateSuperpowerLocal('typo', inputVal);
    setTypoOutput(localOut);
    setTypoBadge('👻 띠리링~♪ (2어절 연속 오타 감지 ➔ 한글 자동 변환 + 한/영키 자동 전환)');
    playBabyGhostChime();
  };

  const handleSaveSnippets = async () => {
    localStorage.setItem(SNIPPETS_STORAGE_KEY, JSON.stringify(snippets));
    try {
      const res = await fetch(getZCoreUrl('/api/superpower/snippets'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snippets }),
        signal: AbortSignal.timeout(1200),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.ok) {
          setSnippetSavedMsg(data.message || '✅ Z-코어에 F1~F10 10개 상용구가 즉시 저장되었습니다!');
          playBabyGhostChime();
          setTimeout(() => setSnippetSavedMsg(null), 3500);
          return;
        }
      }
    } catch {
      // 로컬 폴백
    }
    setSnippetSavedMsg('✅ F1~F10 10개 내 상용구가 저장되었습니다! (Ctrl + 0 ➔ F1~F10으로 즉시 붙여넣기)');
    playBabyGhostChime();
    setTimeout(() => setSnippetSavedMsg(null), 3500);
  };

  const handleMoneySimulate = async (val: string) => {
    setMoneyInput(val);
    try {
      const res = await fetch(getZCoreUrl('/api/superpower/simulate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'number9', text: val }),
        signal: AbortSignal.timeout(900),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.ok) {
          setMoneyOutput(data.converted);
          return;
        }
      }
    } catch {
      // ignore
    }
    setMoneyOutput(simulateSuperpowerLocal('number9', val));
  };

  const handleExtractSimulate = async (val: string) => {
    setExtractInput(val);
    try {
      const res = await fetch(getZCoreUrl('/api/superpower/simulate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'extract8', text: val }),
        signal: AbortSignal.timeout(900),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.ok) {
          setExtractOutput(data.converted);
          return;
        }
      }
    } catch {
      // ignore
    }
    setExtractOutput(simulateSuperpowerLocal('extract8', val));
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-3xl bg-[#111114] border border-white/15 p-5 md:p-7 shadow-[0_0_60px_rgba(0,229,255,0.18)] flex flex-col gap-5 my-auto text-zinc-100">
        {/* 1) 상단 헤더 + 닫기 버튼 */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <GhostiBrandLogo size="desktop" themeMode="dark" showBadge={true} />
              <span className="px-2.5 py-0.5 rounded-full bg-teal-500/15 border border-teal-400/40 text-teal-300 font-mono text-[11px] font-bold">
                혼자 쓸 땐 귀신같이 찾고 손보고! · 함께 쓸 땐 귀신같이 공유하고!
              </span>
            </div>
            <h2 className="text-[19px] md:text-[22px] text-white font-extrabold tracking-tight mt-0.5">
              📖 귀신같이 3탭 핵심 가이드 &amp; Ctrl + 0 초능력 체험방
            </h2>
          </div>

          <button
            type="button"
            onClick={() => {
              cancelOnboardingIndexing();
              setShowOnboarding(false);
            }}
            className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-zinc-200 hover:text-white text-[12px] font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <span>워크스페이스로</span>
            <span>✕</span>
          </button>
        </div>

        {/* 2) 3탭 네비게이션 바 (클릭한 1개 탭만 아래에 렌더링하여 시각적 피로도 제로!) */}
        <div
          role="tablist"
          aria-label="온보딩 3탭 메뉴"
          className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-1.5 rounded-2xl bg-zinc-900/90 border border-white/10"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'tab1_find_care'}
            onClick={() => setActiveTab('tab1_find_care')}
            className={`py-3 px-3.5 rounded-xl text-left flex flex-col gap-0.5 transition-all cursor-pointer ${
              activeTab === 'tab1_find_care'
                ? 'bg-teal-500/20 border-2 border-teal-400 text-white shadow-[0_0_20px_rgba(20,184,166,0.25)]'
                : 'bg-transparent border border-transparent text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[13.5px] font-extrabold">탭 1. 🎯 찾기 &amp; 🪄 손보기</span>
              <span className="px-1.5 py-0.5 rounded-md bg-teal-500/20 text-teal-300 text-[10px] font-black">
                내 기기 0원
              </span>
            </div>
            <span className="text-[11px] opacity-80">
              1초 AI 내용검색 + 치우기·고치기 통합 대화창
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'tab2_superpower'}
            onClick={() => setActiveTab('tab2_superpower')}
            className={`py-3 px-3.5 rounded-xl text-left flex flex-col gap-0.5 transition-all cursor-pointer ${
              activeTab === 'tab2_superpower'
                ? 'bg-amber-500/20 border-2 border-amber-400 text-white shadow-[0_0_20px_rgba(251,191,36,0.25)]'
                : 'bg-transparent border border-transparent text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[13.5px] font-extrabold">탭 2. 👻 귀신 부르는 Ctrl + 0 체험방</span>
              <span className="px-1.5 py-0.5 rounded-md bg-amber-400 text-zinc-950 text-[10px] font-black">
                1주일 무료체험
              </span>
            </div>
            <span className="text-[11px] opacity-80">
              한영 오타 둔갑술 · 연속 붙여넣기 · 상용구 실습
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'tab3_share_pro'}
            onClick={() => setActiveTab('tab3_share_pro')}
            className={`py-3 px-3.5 rounded-xl text-left flex flex-col gap-0.5 transition-all cursor-pointer ${
              activeTab === 'tab3_share_pro'
                ? 'bg-emerald-500/20 border-2 border-emerald-400 text-white shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                : 'bg-transparent border border-transparent text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[13.5px] font-extrabold">탭 3. 👨‍👩‍👧‍👦 기기 묶기 &amp; 공유방</span>
              <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-black">
                구독 시 초능력 평생무료
              </span>
            </div>
            <span className="text-[11px] opacity-80">
              폰↔PC 2대 이상 연동 &amp; 가족·팀 공유방(팀원 0원)
            </span>
          </button>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            [탭 1] 🎯 찾기 & 🪄 손보기 (내 기기 1대는 언제나 0원)
           ───────────────────────────────────────────────────────────── */}
        {activeTab === 'tab1_find_care' && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* 1) 🎯 귀신같이 찾기 */}
              <div className="p-4 rounded-2xl bg-zinc-900/90 border border-teal-500/35 flex flex-col justify-between gap-3">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 text-[11px] font-extrabold">
                      🎯 귀신같이 찾기 (1초 AI 내용검색)
                    </span>
                    <span className="text-[11px] text-emerald-400 font-bold">평생 무료</span>
                  </div>
                  <h3 className="text-[16px] font-extrabold text-white">
                    파일명이 기억 안 나도 내용으로 1초 만에 찾습니다
                  </h3>
                  <p className="text-[12.5px] text-zinc-300 leading-relaxed">
                    사진 속 사물·얼굴, 서류(<code className="text-teal-300">PDF·DOCX·TXT</code>) 본문 텍스트, 동영상(<code className="text-teal-300">00:00~끝</code>) 장면까지 내 PC 안에서 외부 전송(0 Byte) 없이 즉시 찾아냅니다.
                  </p>

                  {/* 추천 힌트 칩 즉시 클릭 체험 */}
                  <div className="flex flex-col gap-1.5 pt-1">
                    <span className="text-[11px] text-zinc-400 font-bold">
                      👇 클릭하면 바로 메인 도화지에서 검색 결과를 보여드립니다:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {dynamicTrialDocHints.map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => {
                            cancelOnboardingIndexing();
                            setShowOnboarding(false);
                            setDesktopTab('dashboard');
                            void runBriefingHintChip('doc', q);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-amber-400/40 text-[11.5px] text-amber-200 font-bold cursor-pointer"
                        >
                          📄 “{q}”
                        </button>
                      ))}
                      {dynamicTrialVideoHints.map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => {
                            cancelOnboardingIndexing();
                            setShowOnboarding(false);
                            setDesktopTab('dashboard');
                            void runBriefingHintChip('video', q);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-teal-400/40 text-[11.5px] text-teal-200 font-bold cursor-pointer"
                        >
                          🎬 “{q}”
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      setOnboardingTrackMode('pc_local');
                      void startOnboardingIndexing();
                      setShowOnboarding(false);
                      setDesktopTab('dashboard');
                    }}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-zinc-950 text-[12.5px] font-black cursor-pointer"
                  >
                    🎯 내 PC 사진·문서({totalIndexedDocs}건) 바로 찾기 →
                  </button>
                </div>
              </div>

              {/* 2) 🪄 손보기 (🧹 치우기 + ⚙️ 고치기 통합 노션형 대화창) */}
              <div className="p-4 rounded-2xl bg-zinc-900/90 border border-emerald-500/35 flex flex-col justify-between gap-3">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-extrabold">
                      🪄 손보기 (🧹 치우기 + ⚙️ 고치기 통합)
                    </span>
                    <span className="text-[11px] text-emerald-400 font-bold">평생 무료</span>
                  </div>
                  <h3 className="text-[16px] font-extrabold text-white">
                    탭 이동 없이 한 채팅창에서 치우고 고칩니다
                  </h3>
                  <ul className="text-[12px] text-zinc-300 space-y-1.5 leading-relaxed">
                    <li>
                      • <strong className="text-emerald-300">🧹 치우기</strong>: 중복·흔들린 사진, 바탕화면·다운로드의 어지러운 문서와 설치파일을 깔끔하게 정리합니다.
                    </li>
                    <li>
                      • <strong className="text-teal-300">⚙️ 고치기</strong>: 2026 최신 기준 내 PC 사양 업그레이드 진단, 먹통 수리(화면 위 빨간 손가락 <code className="text-amber-300">👆</code> 안내), 사라진 파일 추적을 수행합니다.
                    </li>
                    <li>
                      • <strong className="text-amber-300">🔒 자연어 타이핑 동의 &amp; 번호 선택 원복</strong>: 실수 클릭 방지를 위해 <code className="text-white">&quot;응 해줘&quot;</code>처럼 직접 타이핑할 때만 실행되며, <code className="text-white">&quot;복원지점 보여줘&quot; ➔ &quot;1번 복원해줘&quot;</code>로 언제든 100% 되돌립니다.
                    </li>
                  </ul>
                </div>

                <div className="pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      cancelOnboardingIndexing();
                      setShowOnboarding(false);
                      setDesktopTab('trash');
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-zinc-950 text-[12.5px] font-black cursor-pointer"
                  >
                    🪄 손보기 대화창 바로 열기 (치우기·고치기·복원) →
                  </button>
                </div>
              </div>
            </div>

            {/* 하단: 검진 구역 3대 안전 폴더 설정 & 모바일 QR 페어링 미니 바 */}
            <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex flex-col gap-2 flex-1">
                <div className="text-[12.5px] font-extrabold text-white flex items-center gap-2">
                  <span>🔒 내 PC 안전 검진 구역 (허용한 기본 폴더만 스캔 · 외부 전송 0%)</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <label className="px-3 py-1.5 rounded-xl bg-zinc-950 border border-white/10 flex items-center gap-2 text-[12px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={trialScanPermissions.gallery}
                      onChange={(e) => setTrialScanPermission('gallery', e.target.checked)}
                      className="accent-teal-400"
                    />
                    <span>☑️ 사진첩(갤러리)</span>
                  </label>
                  <label className="px-3 py-1.5 rounded-xl bg-zinc-950 border border-white/10 flex items-center gap-2 text-[12px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={trialScanPermissions.downloads}
                      onChange={(e) => setTrialScanPermission('downloads', e.target.checked)}
                      className="accent-amber-400"
                    />
                    <span>☑️ 다운로드 폴더</span>
                  </label>
                  <label className="px-3 py-1.5 rounded-xl bg-zinc-950 border border-white/10 flex items-center gap-2 text-[12px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={trialScanPermissions.desktop}
                      onChange={(e) => setTrialScanPermission('desktop', e.target.checked)}
                      className="accent-emerald-400"
                    />
                    <span>☑️ 바탕화면 폴더</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 bg-zinc-950/90 px-3.5 py-2.5 rounded-2xl border border-teal-400/30">
                <div className="w-10 h-10 rounded-xl bg-teal-500/15 border border-teal-400/40 flex items-center justify-center text-[18px] shrink-0">
                  📧
                </div>
                <div className="flex flex-col gap-0.5 max-w-[230px]">
                  <span className="text-[11.5px] font-extrabold text-teal-300">
                    📧 이메일 하나로 모든 기기 자동 연결
                  </span>
                  <p className="text-[10.5px] text-zinc-300 leading-snug">
                    번거로운 QR 스캔 없이 <strong className="text-white">{merlinAuth.email || '내 이메일 계정'}</strong> 로그인 하나로 내 폰·집PC·회사PC가 자동 연결됩니다.
                  </p>
                  <button
                    type="button"
                    onClick={() => setPcAgentPairedMobile(!pcAgentPairedMobile)}
                    className="text-left text-[10.5px] text-emerald-400 font-bold cursor-pointer mt-0.5"
                  >
                    {pcAgentPairedMobile ? '● 이메일 멀티기기 자동 연결됨' : '○ 연결 상태 토글'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            [탭 2] 👻 귀신 부르는 Ctrl + 0 체험방 (Show + Try 인터랙티브 실습)
           ───────────────────────────────────────────────────────────── */}
        {activeTab === 'tab2_superpower' && (
          <div className="flex flex-col gap-4">
            {/* 상단: 숫자 0 = 靈(귀신 영) 스토리텔링 & 1주일 무료체험 활성화 배너 */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-teal-500/10 to-zinc-900 border border-amber-400/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-zinc-950 text-[11px] font-black">
                    0 = 靈 (귀신 영) · 귀신 부르는 단축키 Ctrl + 0
                  </span>
                  {trialStatus?.trial_status === 'ACTIVE' && (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-[11px] font-extrabold">
                      ⏳ 현재 기기 무료체험 진행 중 (D-{trialStatus.trial_days_left})
                    </span>
                  )}
                  {trialStatus?.trial_status === 'SUBSCRIBED' && (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-[11px] font-extrabold">
                      👑 구독 회원 평생 무제한 활성화됨
                    </span>
                  )}
                </div>
                <p className="text-[12.5px] text-zinc-200 leading-relaxed mt-0.5">
                  윈도우 어디서나(카톡·엑셀·한글·브라우저) <strong className="text-amber-300">Ctrl + 0</strong>을 누르면 커서 바로 옆에 <strong className="text-teal-300">『귀신창(Ghost Window)』</strong>이 퐁~띠링!(①번 소환음) 나타나며, 정본 3D 로고 클릭 시 웹 호출 · 상단 미니 검색창 기억 소환 · 바깥 클릭 시 0.01초 만에 즉시 사라집니다!
                </p>
              </div>

              {(!trialStatus || trialStatus.trial_status === 'NOT_STARTED') && !isSubscribedUser && (
                <button
                  type="button"
                  onClick={() => void handleStart7DayTrial()}
                  className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-[12.5px] font-black shadow-[0_0_20px_rgba(251,191,36,0.35)] shrink-0 cursor-pointer"
                >
                  🎁 이 PC에서 1주일 무료체험 즉시 켜기
                </button>
              )}
            </div>

            {/* 『귀신창 (Ghost Window) v3.2』 실물 미리보기 (윗단 기억검색 + 아랫단 정본 3D 로고 2줄 메뉴 + 클릭 시 Win+V형 5개 카드 아코디언 드롭다운) */}
            <div className="p-3.5 rounded-2xl bg-[#0B1120] border-2 border-[#2DD4BF] shadow-[0_0_24px_rgba(45,212,191,0.2)] flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-zinc-300">
                <span>
                  👻 <strong className="text-white">『귀신창(Ghost Window) v3.2』 실물 미리보기</strong> (검색창 클릭 시 Win+V형 5개 카드 아코디언 펼침 · 바깥 클릭 시 즉시 닫힘)
                </span>
                {floatingWebOpenedToast && (
                  <span className="text-[#5EEAD4] font-extrabold animate-pulse">
                    ✨ 정본 3D 로고 클릭 감지 (①번 소환음) ➔ https://ghosti.sundreamer.app 즉시 호출!
                  </span>
                )}
              </div>

              {/* [윗단] 조그마한 1줄 미니 검색창 (클릭 또는 타이핑 시 아래로 5개 카드 아코디언 펼침) */}
              <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0F172A] border border-[#14B8A6]">
                <span className="text-[11.5px] font-extrabold text-[#5EEAD4] shrink-0" title="내가 복사(Ctrl+C)한 텍스트와 캡처(Win+Shift+S)한 스샷만 0.1초 만에 소환">
                  복사검색
                </span>
                <input
                  type="text"
                  value={ghostMemoryQuery}
                  onFocus={() => {
                    setGhostMemoryExpanded(true);
                    setGhostMemorySelIdx(0);
                  }}
                  onChange={(e) => {
                    setGhostMemoryQuery(e.target.value);
                    setGhostMemoryExpanded(true);
                    setGhostMemorySelIdx(0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setGhostMemoryExpanded(true);
                      setGhostMemorySelIdx((prev) => (prev + 1) % Math.max(1, ghostMemoryCandidates.length));
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setGhostMemoryExpanded(true);
                      setGhostMemorySelIdx((prev) => (prev - 1 + Math.max(1, ghostMemoryCandidates.length)) % Math.max(1, ghostMemoryCandidates.length));
                    } else if (e.key === 'Escape') {
                      setGhostMemoryExpanded(false);
                      setGhostMemoryHoverIdx(null);
                    } else if (e.key === 'Enter') {
                      const chosen = ghostMemoryCandidates[ghostMemorySelIdx] || ghostMemoryCandidates[0];
                      if (chosen) {
                        playBabyGhostChime('typo');
                        setGhostMemoryResult(`✅ [${chosen.snippet.slice(0, 28)}...] 커서 위치에 즉시 붙여넣기 완료!`);
                        setGhostMemoryExpanded(false);
                        setGhostMemoryHoverIdx(null);
                      }
                    }
                  }}
                  placeholder="클릭 시 최근 5건 펼침 · 단어 입력..."
                  className="w-48 sm:w-56 px-2.5 py-1 rounded-lg bg-[#1E293B] text-[11.5px] text-white outline-none border border-transparent focus:border-[#5EEAD4]"
                />
                <span className="text-[11px] text-[#6EE7B7] font-bold truncate flex-1">
                  {ghostMemoryResult || '클릭 시 최근 목록 펼침 · 단어 입력 후 ↑↓·Enter 선택 (마우스 호버 시 전체 원문 팝업)'}
                </span>
                {ghostMemoryExpanded && (
                  <button
                    type="button"
                    onClick={() => {
                      setGhostMemoryExpanded(false);
                      setGhostMemoryHoverIdx(null);
                    }}
                    className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[10.5px] text-zinc-300 cursor-pointer"
                  >
                    접기 ▲
                  </button>
                )}
              </div>

              {/* [아랫단] 좌측 정본 마스터 로고([심볼]+[3D 워드마크], 이모지 제거) + 우측 2줄(Row 1 & Row 2) 전체 메뉴 수납 */}
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 px-2 py-1 rounded-xl bg-[#0B1120] text-[12px] font-bold">
                <button
                  type="button"
                  onClick={() => {
                    playBabyGhostChime('summon');
                    setFloatingWebOpenedToast(true);
                    setTimeout(() => setFloatingWebOpenedToast(false), 3200);
                  }}
                  title="정본 3D 로고 클릭 시 귀신같이 웹이 즉시 열립니다"
                  className="px-2.5 py-1.5 rounded-lg bg-[#131D36] hover:bg-[#1E293B] border border-[#2DD4BF] flex items-center gap-1.5 cursor-pointer shrink-0 shadow-sm"
                >
                  <img
                    src="/gwisinkachi_app_icon_512.png"
                    alt="애기귀신 심볼"
                    className="w-6 h-6 object-contain"
                  />
                  <img
                    src="/gwisinkachi_3d_wordmark_dark.png"
                    alt="귀신같이 3D 워드마크"
                    className="h-5 w-auto object-contain"
                  />
                </button>
                <div className="flex flex-col gap-0.5 text-left min-w-0">
                  <div className="text-[#5EEAD4] text-[11.5px] font-extrabold tracking-tight truncate">
                    [Ctrl+V] 순차·칸맞춤 &nbsp;&nbsp; [9] 파일·PDF변환 &nbsp;&nbsp; [F1~10] 상용구 &nbsp;&nbsp; [2] 한영성형
                  </div>
                  <div className="text-[#E2E8F0] text-[11.5px] font-bold tracking-tight truncate">
                    [3] 서식세탁 &nbsp;&nbsp; [4] 줄바꿈정리 &nbsp;&nbsp; [5] 합본 &nbsp;&nbsp; [6] 글자·표OCR &nbsp;&nbsp; [7] 창고정 &nbsp;&nbsp; [8] 번호·일정
                  </div>
                </div>
              </div>

              {/* [3단: Win+V 스타일 아코디언 다중 기억검색 드롭다운 (상위 5개 후보 카드 + 44x32 스샷 썸네일 + 호버 시 전체 원문 팝업)] */}
              {ghostMemoryExpanded && (
                <div className="mt-1 pt-2 border-t border-[#1E293B] grid grid-cols-1 lg:grid-cols-12 gap-2.5">
                  <div className="lg:col-span-7 flex flex-col gap-1">
                    {ghostMemoryCandidates.slice(0, 5).map((item, idx) => {
                      const isSel = idx === ghostMemorySelIdx;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onMouseEnter={() => {
                            setGhostMemorySelIdx(idx);
                            setGhostMemoryHoverIdx(idx);
                          }}
                          onClick={() => {
                            playBabyGhostChime('typo');
                            setGhostMemoryResult(`✅ #${idx + 1} [${item.snippet.slice(0, 26)}...] 즉시 붙여넣기 완료!`);
                            setGhostMemoryExpanded(false);
                            setGhostMemoryHoverIdx(null);
                          }}
                          className={`w-full px-2.5 py-1.5 rounded-lg text-left flex items-center gap-2.5 transition-all cursor-pointer border ${
                            isSel
                              ? 'bg-[#172554] border-[#2DD4BF] text-white'
                              : 'bg-[#0F172A] border-[#1E293B] text-zinc-200 hover:bg-[#172554]/60'
                          }`}
                        >
                          <span className="text-[11px] font-extrabold text-[#5EEAD4] w-4 shrink-0">
                            {idx + 1}
                          </span>
                          {item.kind === 'image' && (
                            <div className="w-[44px] h-[32px] rounded bg-[#0B1120] border border-[#2DD4BF]/50 flex flex-col items-center justify-center shrink-0 text-[9px] text-[#5EEAD4] font-black leading-none">
                              <span>IMG</span>
                              <span className="text-[8px] text-zinc-400">OCR</span>
                            </div>
                          )}
                          <span className="text-[11.5px] font-semibold truncate flex-1">
                            {item.snippet}
                          </span>
                          <span className="text-[10px] text-zinc-400 shrink-0">
                            {item.relTime}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="lg:col-span-5 p-2.5 rounded-xl bg-[#0F172A] border border-[#2DD4BF]/60 flex flex-col justify-between gap-1.5">
                    {(() => {
                      const activeItem =
                        ghostMemoryCandidates[ghostMemoryHoverIdx ?? ghostMemorySelIdx] ||
                        ghostMemoryCandidates[0];
                      return (
                        <>
                          <div className="flex items-center justify-between text-[10.5px] text-[#5EEAD4] font-extrabold">
                            <span>
                              {activeItem?.kind === 'image'
                                ? '🖼️ 캡처 이미지 + 백그라운드 OCR 전문 미리보기'
                                : '📄 전체 원문 미리보기 말풍선 (Hover)'}
                            </span>
                            <span className="text-zinc-400">{activeItem?.relTime}</span>
                          </div>
                          <pre className="text-[11px] text-zinc-200 whitespace-pre-wrap font-sans leading-relaxed bg-[#0B1120] p-2 rounded-lg border border-white/5">
                            {activeItem?.fullText}
                          </pre>
                          <span className="text-[10px] text-[#6EE7B7] font-bold">
                            👉 클릭 또는 Enter 시 현재 커서 위치에 즉시 붙여넣기 (③번 결과음 재생)
                          </span>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* 5대 초능력 [Show + Try] 그리드 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* 체험 ①: 2어절 연속 한영·영한 오타 둔갑술 + 애기귀신 소리 */}
              <div className="p-3.5 rounded-2xl bg-zinc-900/90 border border-white/10 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-extrabold text-amber-300">
                    ① 2어절 한영·영한 오타 둔갑술 (띠리링~👻)
                  </span>
                  <span className="px-2 py-0.5 rounded bg-zinc-800 text-[10.5px] text-zinc-300">
                    Show + Try
                  </span>
                </div>

                {/* Show: 자동 애니메이션 박스 */}
                <div className="px-3 py-2 rounded-xl bg-zinc-950 border border-white/5 text-[11.5px] flex items-center justify-between gap-2">
                  <span className="text-zinc-400 shrink-0">🎬 자동 시연:</span>
                  <span className="font-mono text-white truncate">
                    {showDemoStep === 0 && '타이핑 중: dkssudgktpdy qksrkqtmqslek'}
                    {showDemoStep === 1 && '👻 띠리링~♪ (2어절 오타 감지 + 한/영키 전환!)'}
                    {showDemoStep === 2 && '✅ 자동 변환: 안녕하세요 반갑습니다 (iPhone 보존)'}
                  </span>
                </div>

                {/* Try: 직접 입력해 보는 창 */}
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={typoInput}
                    onChange={(e) => setTypoInput(e.target.value)}
                    placeholder="예: dkssudgktpdy qksrkqtmqslek"
                    className="flex-1 px-3 py-1.5 rounded-xl bg-zinc-950 border border-white/15 text-[12px] text-white outline-none focus:border-amber-400"
                  />
                  <button
                    type="button"
                    onClick={() => void handleRunTypoSimulation(typoInput)}
                    className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-[11.5px] font-black shrink-0 cursor-pointer"
                  >
                    🪄 둔갑 체험
                  </button>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-400/30 text-[12px] flex flex-col gap-0.5">
                  <div className="text-white font-extrabold">결과: {typoOutput}</div>
                  <div className="text-[10.5px] text-amber-300">{typoBadge}</div>
                </div>
              </div>

              {/* 체험 ②: 연속 다중 복사·붙여넣기 (Ctrl + 0 -> Ctrl + V) */}
              <div className="p-3.5 rounded-2xl bg-zinc-900/90 border border-white/10 flex flex-col justify-between gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-extrabold text-teal-300">
                    ② 연속 복사 후 1번부터 순차 붙여넣기 (Ctrl+0)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setPasteQueue(['홍길동 대표', '010-1234-5678', '서울 강남구 테헤란로 123']);
                      setPastedSlots([]);
                    }}
                    className="text-[11px] text-zinc-400 hover:text-white cursor-pointer"
                  >
                    ↺ 다시 장전
                  </button>
                </div>

                <div className="text-[11.5px] text-zinc-300">
                  여러 개를 연달아 복사(<code className="text-teal-300">Ctrl+C</code>)한 뒤 <code className="text-amber-300">Ctrl+0</code>을 누르면, <code className="text-white">Ctrl+V</code>를 누를 때마다 1번부터 순서대로 들어갑니다.
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {pasteQueue.map((item, idx) => (
                    <span
                      key={`${item}-${idx}`}
                      className="px-2 py-1 rounded-lg bg-zinc-950 border border-teal-500/40 text-[11px] text-teal-200 font-bold"
                    >
                      대기 {idx + 1}번: {item}
                    </span>
                  ))}
                  {pasteQueue.length === 0 && (
                    <span className="text-[11px] text-emerald-400 font-bold">
                      🎉 3개 항목 모두 순서대로 붙여넣기 완료!
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={pasteQueue.length === 0}
                    onClick={() => {
                      if (pasteQueue.length === 0) return;
                      playBabyGhostChime();
                      const [first, ...rest] = pasteQueue;
                      setPasteQueue(rest);
                      setPastedSlots((prev) => [...prev, first]);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-teal-400 hover:bg-teal-300 disabled:opacity-40 text-zinc-950 text-[11.5px] font-black cursor-pointer shrink-0"
                  >
                    📋 Ctrl + V 순차 붙여넣기 ({pasteQueue.length}개 남음)
                  </button>
                  <div className="flex-1 px-2.5 py-1.5 rounded-xl bg-zinc-950 border border-white/10 text-[11.5px] text-white truncate">
                    {pastedSlots.length > 0 ? pastedSlots.join(' ➔ ') : '버튼을 눌러 1번부터 붙여넣어 보세요'}
                  </div>
                </div>
              </div>

              {/* 체험 ③: 9번 억만금 한글 숫자 <-> 아라비아 숫자 양방향 변환 */}
              <div className="p-3.5 rounded-2xl bg-zinc-900/90 border border-white/10 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-extrabold text-emerald-300">
                    ③ 억만금 한글 숫자 ⇄ 아라비아 숫자 변환 (9번)
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => void handleMoneySimulate('3억 5천만')}
                      className="px-2 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-300 hover:text-white cursor-pointer"
                    >
                      3억 5천만
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleMoneySimulate('1285000000')}
                      className="px-2 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-300 hover:text-white cursor-pointer"
                    >
                      1,285,000,000
                    </button>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={moneyInput}
                    onChange={(e) => void handleMoneySimulate(e.target.value)}
                    placeholder="예: 3억 5천만 또는 350000000"
                    className="flex-1 px-3 py-1.5 rounded-xl bg-zinc-950 border border-white/15 text-[12px] text-white outline-none focus:border-emerald-400"
                  />
                  <button
                    type="button"
                    onClick={() => void handleMoneySimulate(moneyInput)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-400 text-zinc-950 text-[11.5px] font-black cursor-pointer"
                  >
                    양방향 변환
                  </button>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-400/30 text-[12px] text-emerald-200 font-bold">
                  변환 결과: <span className="text-white font-mono">{moneyOutput}</span>
                </div>
              </div>

              {/* 체험 ④: 8번 카톡 혼합 문자에서 계좌·연락처·일정 AI 구조화 추출 & 7번 전화번호 하이픈 */}
              <div className="p-3.5 rounded-2xl bg-zinc-900/90 border border-white/10 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-extrabold text-cyan-300">
                    ④ 카톡 통짜 문자 계좌·연락처·일정 추출 (8번)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const next = simulateSuperpowerLocal('hyphen7', hyphenInput);
                      setHyphenInput(next);
                      setHyphenOutput(next);
                    }}
                    className="px-2 py-0.5 rounded bg-zinc-800 text-[10.5px] text-cyan-300 cursor-pointer"
                  >
                    7번 하이픈 토글: {hyphenOutput}
                  </button>
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={extractInput}
                    onChange={(e) => setExtractInput(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-xl bg-zinc-950 border border-white/15 text-[11.5px] text-white outline-none focus:border-cyan-400"
                  />
                  <button
                    type="button"
                    onClick={() => void handleExtractSimulate(extractInput)}
                    className="px-3 py-1.5 rounded-xl bg-cyan-400 text-zinc-950 text-[11.5px] font-black shrink-0 cursor-pointer"
                  >
                    구조화 추출
                  </button>
                </div>
                <pre className="px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-400/30 text-[11px] text-cyan-100 whitespace-pre-wrap font-sans leading-snug">
                  {extractOutput}
                </pre>
              </div>
            </div>

            {/* 체험 ⑤: F1~F10 10개 내 상용구 실시간 저장 & 클립보드 보관 기간(기본 7일·최대 30일) 설정 */}
            <div className="p-3.5 rounded-2xl bg-zinc-900/90 border border-amber-400/35 flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-extrabold text-white">
                    ⑤ ⌨️ F1 ~ F10 내 상용구 10슬롯 등록 (Ctrl + 0 ➔ F1~F10으로 0.1초 입력 · 내 모든 기기 자동 동기화)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void handleSaveSnippets()}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-[12px] font-black cursor-pointer"
                >
                  💾 내 PC Z-코어에 F1~F10 상용구 즉시 저장
                </button>
              </div>

              {snippetSavedMsg && (
                <div className="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-[11.5px] font-bold">
                  {snippetSavedMsg}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2">
                {(['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10'] as const).map((key) => (
                  <div key={key} className="flex flex-col gap-1">
                    <span className="text-[10.5px] font-mono text-amber-300 font-bold">
                      {key} 단축 슬롯
                    </span>
                    <input
                      type="text"
                      value={snippets[key] || ''}
                      onChange={(e) =>
                        setSnippets((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      className="px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-white/15 text-[11.5px] text-white outline-none focus:border-amber-400"
                    />
                  </div>
                ))}
              </div>

              {/* 클립보드 [복사검색] 보관 기간 설정 바 (디폴트 7일 300개 / 최대 30일 1,000개 / 즉시 비우기) */}
              <div className="mt-1 pt-2.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11.5px]">
                <div className="flex items-center gap-1.5 text-zinc-300">
                  <span className="font-extrabold text-teal-300">📋 [복사검색] 클립보드 보관 기간:</span>
                  <span>기본 7일(300개) · 필요 시 한 달(30일, 1,000개)까지 확장 가능 (🪄 손보기 채팅창에서 말로도 변경 가능)</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      { days: 1 as const, label: '오늘만(24시간)' },
                      { days: 3 as const, label: '3일' },
                      { days: 7 as const, label: '7일 (기본·300개)' },
                      { days: 30 as const, label: '30일 (한 달·1,000개)' },
                    ]
                  ).map((opt) => (
                    <button
                      key={opt.days}
                      type="button"
                      onClick={async () => {
                        setRetentionDays(opt.days);
                        try {
                          await fetch(getZCoreUrl('/api/superpower/settings'), {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ retention_days: opt.days }),
                            signal: AbortSignal.timeout(1200),
                          });
                        } catch {
                          // 로컬 폴백
                        }
                        setRetentionToast(`✅ [복사검색] 클립보드 보관 기간이 '${opt.label}'로 설정되었습니다.`);
                        setTimeout(() => setRetentionToast(null), 3000);
                      }}
                      className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer border ${
                        retentionDays === opt.days
                          ? 'bg-teal-400 text-zinc-950 border-teal-300 font-black'
                          : 'bg-zinc-950 text-zinc-300 border-white/15 hover:bg-zinc-800'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await fetch(getZCoreUrl('/api/superpower/clear-history'), {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ clear_history: true }),
                          signal: AbortSignal.timeout(1200),
                        });
                      } catch {
                        // ignore
                      }
                      setRetentionToast('🧹 복사검색 클립보드 기록을 즉시 비웠습니다.');
                      setTimeout(() => setRetentionToast(null), 3000);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-200 font-bold cursor-pointer"
                  >
                    🧹 즉시 비우기
                  </button>
                </div>
              </div>
              {retentionToast && (
                <div className="text-[11px] text-teal-300 font-bold">{retentionToast}</div>
              )}
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            [탭 3] 👨‍👩‍👧‍👦 기기 묶기 & 공유방 (무료 vs 구독 혜택 1초 비교)
           ───────────────────────────────────────────────────────────── */}
        {activeTab === 'tab3_share_pro' && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 좌측: 🆓 무료 회원 (내 기기 1대 평생 0원) */}
              <div className="p-5 rounded-2xl bg-zinc-900/90 border border-white/15 flex flex-col justify-between gap-4">
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-full bg-zinc-800 text-zinc-200 text-[11.5px] font-extrabold">
                      🆓 무료 회원 (내 기기 1대 단독 사용)
                    </span>
                    <span className="text-[14px] font-black text-teal-300">평생 0원</span>
                  </div>
                  <h3 className="text-[17px] font-extrabold text-white">
                    혼자 쓰는 내 컴퓨터·내 폰 1대는 언제나 무료입니다
                  </h3>
                  <ul className="text-[12.5px] text-zinc-300 space-y-2 leading-relaxed pt-1">
                    <li>
                      ✅ <strong className="text-white">🎯 귀신같이 찾기</strong>: 내 기기 1대 안의 사진·서류·동영상 1초 AI 내용검색 <strong className="text-teal-300">평생 무제한 무료</strong>
                    </li>
                    <li>
                      ✅ <strong className="text-white">🪄 손보기 (치우기 + 고치기)</strong>: 중복·흔들린 사진 정리, 사양 진단, 빨간 손가락(<code className="text-amber-300">👆</code>) 수리, 복원 기록 되돌리기 <strong className="text-teal-300">평생 무제한 무료</strong>
                    </li>
                    <li>
                      🎁 <strong className="text-white">👻 귀신 초능력 팩 (Ctrl + 0)</strong>: 기기당 <strong className="text-amber-300">1주일(7일) 전 기능 무료체험</strong> 제공
                    </li>
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    cancelOnboardingIndexing();
                    setShowOnboarding(false);
                  }}
                  className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[12.5px] font-bold cursor-pointer"
                >
                  내 기기 1대 무료 모드로 계속 쓰기
                </button>
              </div>

              {/* 우측: 👑 주력 상품 — 내 기기 통합 (월 3,900원 · 1차 5년 특판 39,000원) */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950/70 via-zinc-900 to-zinc-900 border-2 border-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.2)] flex flex-col justify-between gap-4">
                <div className="flex flex-col gap-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <span className="px-3 py-1 rounded-full bg-emerald-400 text-zinc-950 text-[11.5px] font-black">
                      👑 내 기기 통합 (월 3,900원 · 1차 5년 특판 39,000원)
                    </span>
                    <span className="text-[11.5px] font-extrabold text-emerald-300">
                      이메일 하나로 기기 대수 무제한 통합!
                    </span>
                  </div>
                  <h3 className="text-[17px] font-extrabold text-white leading-snug">
                    내가 손댄 모든 기기(폰·집PC·회사PC)가 하나가 되어 내 손아귀에!
                  </h3>
                  <ul className="text-[12.5px] text-zinc-200 space-y-2 leading-relaxed pt-1">
                    <li>
                      🥇 <strong className="text-emerald-300">1위. 카톡 ‘나에게 보내기’ &amp; 클라우드 월세 완전 종식</strong>: 폰으로 찍은 사진·서류가 압축 없이 내 PC로 1초 직결되고, 2TB·4TB도 클라우드 요금 0원으로 무제한 씁니다.
                    </li>
                    <li>
                      🥈 <strong className="text-emerald-300">2위. 무버튼 양방향 클립보드 ‘암호화 우체통(E2EE)’</strong>: 회사 PC나 폰에서 복사(<code className="text-white">Ctrl+C</code>·스샷)만 해두면, 꺼져 있던 집 PC를 켜는 순간 <code className="text-teal-300">Ctrl+0 [복사검색]</code>에 최근 100개 텍스트·10장 스샷이 자동 장전됩니다!
                    </li>
                    <li>
                      🥉 <strong className="text-amber-300">3위. 귀신 초능력 팩(Ctrl + 0) 평생 해금 &amp; F1~F10 동기화</strong>: 집 PC·회사 PC·노트북 어디서나 9대 초능력과 <code className="text-white">F1~F10</code> 10개 상용구가 1초 만에 똑같이 동기화됩니다.
                    </li>
                    <li>
                      👨‍👩‍👧‍👦 <strong className="text-teal-300">모임(4,900원) · 패밀리(5,900원~) · 업무(9,900원~)</strong>: 방장 한 분만 구독하면 초대받은 가족·동호회원·팀원은 <strong className="text-white">전원 0원(무료)</strong>입니다.
                    </li>
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    cancelOnboardingIndexing();
                    setShowOnboarding(false);
                    setShowProModal(true);
                  }}
                  className="w-full py-3 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-zinc-950 text-[13px] font-black shadow-[0_0_20px_rgba(16,185,129,0.35)] cursor-pointer"
                >
                  👑 내 기기 통합(월 3,900원 · 5년 특판 3.9만) · 공유방 요금제 보기 →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 하단 공통: 익명 기능 사용 통계(Zero-Content Telemetry) ON/OFF 토글 & 이용약관·개인정보처리방침 제N조 고지 */}
        <div className="pt-3 border-t border-white/10 flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11.5px]">
            <label className="flex items-center gap-2 text-zinc-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={telemetryEnabled}
                onChange={async (e) => {
                  const next = e.target.checked;
                  setTelemetryEnabled(next);
                  try {
                    localStorage.setItem('ghosti_telemetry_enabled', String(next));
                    await fetch(getZCoreUrl('/api/superpower/telemetry'), {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ enabled: next }),
                      signal: AbortSignal.timeout(1200),
                    });
                  } catch {
                    // 로컬 저장 완료
                  }
                }}
                className="w-4 h-4 accent-teal-400 rounded"
              />
              <span className="font-bold text-zinc-200">
                ✔ 서비스 개선을 위한 익명 사용 통계 보내기 (입력·복사 원문 텍스트 및 파일 내용 0 Byte 수집)
              </span>
            </label>

            <button
              type="button"
              onClick={() => setShowTermsClause((v) => !v)}
              className="text-teal-300 hover:text-teal-200 font-bold underline cursor-pointer"
            >
              {showTermsClause ? '📜 이용약관·개인정보처리방침 조항 접기 ▴' : '📜 이용약관·개인정보처리방침 익명 통계 조항 보기 ▾'}
            </button>
          </div>

          {showTermsClause && (
            <div className="p-3.5 rounded-xl bg-zinc-950/95 border border-white/10 text-[11.5px] text-zinc-300 leading-relaxed space-y-1">
              <div className="font-extrabold text-teal-300">
                제N조 (서비스 품질 개선을 위한 비식별 기능 사용 빈도 및 오류 통계 수집)
              </div>
              <p>
                1. 회사는 서비스의 기능 개선, 오류 수정 및 사용자 경험 최적화를 위하여 <strong className="text-white">사용자가 입력·복사한 텍스트 원문이나 파일 내용, 암호화된 외부 메신저 DB 등은 단 0 Byte도 수집·열람·전송하지 않으며</strong>, 오직 비식별화된 <strong className="text-emerald-300">기능별 호출 횟수(익명 카운트 숫자) 및 오류 코드(error_code)</strong>만을 집계합니다.
              </p>
              <p>
                2. 회원은 언제든지 환경설정의 <code className="text-amber-300">[✔ 서비스 개선을 위한 익명 사용 통계 보내기]</code> 토글(기본값 ON)을 통해 통계 전송 여부를 직접 제어할 수 있습니다.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
