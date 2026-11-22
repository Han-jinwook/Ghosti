import React, { useEffect, useMemo, useState } from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';
import { getZCoreUrl, hasActiveGhostiLoginSession } from '../services/zCoreBridge';
import { GhostiBrandLogo } from './GhostiBrandLogo';

// [공문 2053·2056] 초능력 수련장 & 9종 도장깨기 체험관 (지연 로드 — OnboardingModal ↔ 도장깨기 순환 import 방지)
const LazyGhostSuperpowerDojo = React.lazy(() => import('./ghostDojo/GhostSuperpowerDojo'));

export type OnboardingTabId = 'tab1_find_care' | 'tab2_superpower' | 'tab3_share_pro';

export interface SuperpowerTrialStatus {
  engine_running: boolean;
  machine_hwid: string;
  account_id: string;
  trial_status: 'NOT_STARTED' | 'ACTIVE' | 'ACTIVE_30D' | 'TRIAL_UNLIMITED' | 'PER_FEATURE_ACTIVE' | 'EXPIRED_LOCKED' | 'EXPIRED' | 'SUBSCRIBED';
  trial_opt_in_status?: 'NOT_STARTED' | 'DEFERRED' | 'ACTIVE_30D' | 'EXPIRED_LOCKED' | 'SUBSCRIBED';
  badge_label?: string;
  feature_trials?: Record<string, any>;
  cross_device_trial?: Record<string, any>;
  trial_days_left: number;
  daily_free_limit?: number;
  daily_free_remaining?: number;
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
    audio.volume = 0.22;
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
const COMMON_ENG_ALLOW = new Set([
  'iphone', 'youtube', 'google', 'naver', 'kakao', 'excel', 'office', 'windows',
  'ghost', 'ghosti', 'hello', 'world', 'test', 'ghdrlfehd', 'myid',
  'apple', 'chrome', 'notion', 'slack', 'zoom', 'email', 'admin', 'login', 'http', 'https',
]);
const DIGIT_UNIT_ALLOW = new Set(['gb', 'mb', 'kb', 'tb', 'km', 'cm', 'mm', 'kg', 'ml', 'hz', 'px', 'am', 'pm']);

function isProtectedTokenLocal(tok: string): boolean {
  const s = tok.trim();
  if (!s) return false;
  if (s.includes('@') || s.includes('://') || /^www\./i.test(s) || s.startsWith('=')) return true;
  if (/[A-Za-z0-9-]+\.(?:com|net|org|kr|co|io|app|dev|ai|edu|gov|me|biz|info)\b/i.test(s)) return true;
  return false;
}

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

function spaceKorSimpleLocal(s: string): string {
  if (!/[가-힣]{4,}/.test(s) || /\s/.test(s)) return s;
  let out = s;
  out = out.replace(/(안녕하세요|감사합니다|반갑습니다|죄송합니다)(?=[가-힣])/g, '$1 ');
  out = out.replace(/(오늘|내일|지금|방금|한글이|시간이|회의|연락)(?=[가-힣]{2,})/g, '$1 ');
  out = out.replace(/(회의)(?=시간)/g, '$1 ');
  out = out.replace(/([가-힣])(안쳐져|안돼요|안되네요)/g, '$1 $2');
  out = out.replace(/안쳐져/g, '안 쳐져');
  return out.replace(/\s{2,}/g, ' ').trim();
}

export function simulateSuperpowerLocal(mode: 'typo' | 'number9' | 'extract8' | 'hyphen7', text: string): string {
  const s = text.trim();
  if (!s) return '';
  if (mode === 'typo') {
    return s
      .split(/(\s+)/)
      .map((tok) => {
        if (!tok || /^\s+$/.test(tok) || isProtectedTokenLocal(tok)) {
          return tok;
        }
        const replaced = tok.replace(/[A-Za-z]{2,}/g, (seg, offset: number, fullTok: string) => {
          if (COMMON_ENG_ALLOW.has(seg.toLowerCase())) return seg;
          if (offset > 0 && /\d/.test(fullTok[offset - 1]) && DIGIT_UNIT_ALLOW.has(seg.toLowerCase())) {
            const afterIdx = offset + seg.length;
            if (afterIdx >= fullTok.length || !/[A-Za-z]/.test(fullTok[afterIdx])) return seg;
          }
          const kor = engWordToKorLocal(seg);
          return /[가-힣]/.test(kor) ? kor : seg;
        });
        return replaced !== tok ? spaceKorSimpleLocal(replaced) : tok;
      })
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

function loadLocalSnippets(): Record<string, string> {
  try {
    const savedSnippetsRaw = localStorage.getItem(SNIPPETS_STORAGE_KEY);
    if (savedSnippetsRaw) {
      return { ...DEFAULT_SNIPPETS, ...JSON.parse(savedSnippetsRaw) };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_SNIPPETS };
}

export async function fetchSuperpowerStatus(accountId: string, isSubscribed: boolean): Promise<SuperpowerTrialStatus> {
  const localSnippets = loadLocalSnippets();
  const hasLocalSavedSnippets = Boolean(localStorage.getItem(SNIPPETS_STORAGE_KEY));
  if (hasActiveGhostiLoginSession()) {
    try {
      const hubToken = useSaySeeStore.getState().merlinAuth?.token || '';
      const q = new URLSearchParams({ accountId, isSubscribed: String(isSubscribed), hubToken });
      const res = await fetch(getZCoreUrl(`/api/superpower/status?${q.toString()}`), {
        signal: AbortSignal.timeout(1500),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.ok) {
          const mergedSnippets = hasLocalSavedSnippets
            ? { ...DEFAULT_SNIPPETS, ...(data.snippets || {}), ...localSnippets }
            : { ...DEFAULT_SNIPPETS, ...(data.snippets || {}) };
          const mergedData = { ...data, snippets: mergedSnippets };
          localStorage.setItem(TRIAL_STORAGE_KEY, JSON.stringify(mergedData));
          return mergedData as SuperpowerTrialStatus;
        }
      }
    } catch {
      // 로컬 폴백
    }
  }
  const savedRaw = localStorage.getItem(TRIAL_STORAGE_KEY);
  const snippets = localSnippets;
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
    trial_days_left: isSubscribed ? 9999 : 30, // [v1.3 마감] 체험 기간 30일 전사 통일
    started_at: null,
    expires_at: null,
    is_subscribed: isSubscribed,
    snippets,
  };
}

export async function startSuperpowerTrialAction(
  accountId: string,
  isSubscribed: boolean,
  agreed: boolean = true,
): Promise<SuperpowerTrialStatus> {
  const localSnippets = loadLocalSnippets();
  if (hasActiveGhostiLoginSession()) {
    try {
      const hubToken = useSaySeeStore.getState().merlinAuth?.token || '';
      const res = await fetch(getZCoreUrl('/api/superpower/start-trial'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, isSubscribed, agreed, hubToken }),
        signal: AbortSignal.timeout(1800),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.ok) {
          const mergedData = { ...data, snippets: { ...(data.snippets || {}), ...localSnippets } };
          localStorage.setItem(TRIAL_STORAGE_KEY, JSON.stringify(mergedData));
          window.dispatchEvent(new CustomEvent('ghosti_superpower_status_updated', { detail: mergedData }));
          return mergedData as SuperpowerTrialStatus;
        }
      }
    } catch {
      // 로컬 폴백
    }
  }
  if (!agreed) {
    const deferredStatus: SuperpowerTrialStatus = {
      engine_running: false,
      machine_hwid: 'sha256_local_pc_device',
      account_id: accountId,
      trial_status: isSubscribed ? 'SUBSCRIBED' : 'NOT_STARTED',
      trial_opt_in_status: isSubscribed ? 'SUBSCRIBED' : 'DEFERRED',
      trial_days_left: isSubscribed ? 9999 : 30,
      started_at: null,
      expires_at: null,
      is_subscribed: isSubscribed,
      snippets: localSnippets,
    };
    localStorage.setItem(TRIAL_STORAGE_KEY, JSON.stringify(deferredStatus));
    return deferredStatus;
  }
  const now = new Date();
  const exp = new Date(now.getTime() + 30 * 86400 * 1000); // [v1.3 마감] 30일 무제한 체험 (데몬 ACTIVE_30D 와 동일)
  const fallback: SuperpowerTrialStatus = {
    engine_running: true,
    machine_hwid: 'sha256_local_pc_device',
    account_id: accountId,
    trial_status: isSubscribed ? 'SUBSCRIBED' : 'ACTIVE',
    trial_days_left: isSubscribed ? 9999 : 30,
    started_at: now.toISOString().slice(0, 19).replace('T', ' '),
    expires_at: exp.toISOString().slice(0, 19).replace('T', ' '),
    is_subscribed: isSubscribed,
    snippets: localSnippets,
  };
  localStorage.setItem(TRIAL_STORAGE_KEY, JSON.stringify(fallback));
  window.dispatchEvent(new CustomEvent('ghosti_superpower_status_updated', { detail: fallback }));
  return fallback;
}

/**
 * 📱 스마트폰 모바일 앱 1초 설치 안내용 QR 코드 SVG
 * - 역할 구분: 기기 페어링용이 아니라, PC 화면을 보고 있는 유저가 스마트폰 카메라로 스캔해
 *   『귀신같이 모바일 앱』을 스토어 검색 없이 1초 만에 바로 설치·실행하도록 안내하는 QR 코드입니다.
 * - 설치 후 기기 간 연동은 별도 코드 없이 동일한 이메일 로그인 하나로 자동 연결됩니다.
 */
const PairingQrCodeSvg: React.FC = () => {
  return (
    <img
      src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=6&data=https%3A%2F%2Fghosti.sundreamer.app"
      alt="스마트폰 모바일 앱 1초 설치 QR 코드"
      className="w-24 h-24 rounded-xl bg-white p-1.5 shadow-[0_0_20px_rgba(0,229,255,0.3)] shrink-0"
    />
  );
};

export const OnboardingModal: React.FC<{ inlineSuperpowerOnly?: boolean }> = ({
  inlineSuperpowerOnly = false,
}) => {
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
    isStoreAppMode,
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
  const [isClipboardCleared, setIsClipboardCleared] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ghosti_clipboard_cleared') === 'true';
    } catch {
      return false;
    }
  });

  // F1~F10 내 상용구 & 클립보드 보관 기간(기본 7일·최대 30일) & 전화번호 하이픈
  const [snippets, setSnippets] = useState<Record<string, string>>(() => loadLocalSnippets());
  const [snippetSavedMsg, setSnippetSavedMsg] = useState<string | null>(null);
  const [retentionDays, setRetentionDays] = useState<1 | 3 | 7 | 30>(7);
  const [retentionToast, setRetentionToast] = useState<string | null>(null);
  const [hyphenInput, setHyphenInput] = useState('01012345678');
  const [hyphenOutput, setHyphenOutput] = useState('010-1234-5678');

  const ghostMemoryCandidates = useMemo(() => {
    if (isClipboardCleared) {
      return [];
    }
    const f1Text = snippets.F1 || DEFAULT_SNIPPETS.F1;
    const f2Text = snippets.F2 || DEFAULT_SNIPPETS.F2;
    const baseItems = [
      {
        id: 'mem-1',
        kind: 'text' as const,
        relTime: '방금 전',
        snippet: `${f1Text} (F1 상용구 · 월 정기 구독료 정산 계좌 안내)`,
        fullText: `${f1Text}\n- 용도: 월 정기 구독료 및 거래처 대금 정산 전용 계좌 (F1 단축 슬롯)\n- 세금계산서 발행 이메일: ${snippets.F7 || DEFAULT_SNIPPETS.F7}`,
      },
      {
        id: 'mem-2',
        kind: 'image' as const,
        relTime: '2분 전',
        snippet: '[이미지 1280x720] 세금계산서_영수증_캡처 · 합계금액 350,000,000원 승인번호 9482-11',
        fullText:
          '[스샷 이미지 (1280x720) · 백그라운드 PP-OCRv5 Korean 추출 원문]\n공급자: (주)썬드림 / 등록번호: 123-86-98765\n품목: 귀신같이 엔터프라이즈 연간 라이선스\n합계금액: 350,000,000원 (승인번호 9482-11)',
      },
      {
        id: 'mem-3',
        kind: 'text' as const,
        relTime: '5분 전',
        snippet: `${f2Text} (F2 상용구 · 본사 회의실 방문 안내 및 주차 등록)`,
        fullText: `${f2Text}\n- 지하 2~4층 방문객 주차장 이용 가능 (2시간 무료 쿠폰 지급)\n- 도착 후 안내데스크에서 홍길동 대표에게 연락 부탁드립니다.`,
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
  }, [ghostMemoryQuery, isClipboardCleared, snippets]);
  const [telemetryEnabled, setTelemetryEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ghosti_telemetry_enabled') !== 'false';
    } catch {
      return true;
    }
  });
  const [showTermsClause, setShowTermsClause] = useState(false);
  const [showAllMobileSnippets, setShowAllMobileSnippets] = useState(false);

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
    if (!showOnboarding && !inlineSuperpowerOnly) return;
    void fetchSuperpowerStatus(accountId, isSubscribedUser).then((st) => {
      setTrialStatus(st);
      const localSaved = localStorage.getItem(SNIPPETS_STORAGE_KEY);
      if (localSaved) {
        try {
          setSnippets((prev) => ({ ...DEFAULT_SNIPPETS, ...(st.snippets || {}), ...prev, ...JSON.parse(localSaved) }));
          return;
        } catch {
          // ignore
        }
      }
      if (st.snippets) {
        setSnippets((prev) => ({ ...prev, ...st.snippets }));
      }
    });
  }, [showOnboarding, accountId, isSubscribedUser]);

  // 탭 2 Show 애니메이션 루프 (3단계 자동 순환)
  useEffect(() => {
    if ((!showOnboarding && !inlineSuperpowerOnly) || activeTab !== 'tab2_superpower') return;
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

  if (!showOnboarding && !inlineSuperpowerOnly) return null;

  const handleStart7DayTrial = async () => {
    const st = await startSuperpowerTrialAction(accountId, isSubscribedUser);
    setTrialStatus(st);
    playBabyGhostChime();
    useSaySeeStore.setState({
      lastQuarantineToast:
        '🎉 [모든 귀신 초능력 30일 무제한 무료체험 시작!] 지금부터 30일간 모든 귀신 초능력이 무제한으로 작동합니다. (카드 등록·자동 결제 없음)',
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
      const rawTrial = localStorage.getItem(TRIAL_STORAGE_KEY);
      if (rawTrial) {
        const parsedTrial = JSON.parse(rawTrial);
        localStorage.setItem(
          TRIAL_STORAGE_KEY,
          JSON.stringify({ ...parsedTrial, snippets: { ...(parsedTrial.snippets || {}), ...snippets } })
        );
      }
    } catch {
      // ignore
    }
    setGhostMemoryResult(`✅ 상용구 저장 반영 완료! (F1: ${snippets.F1 || DEFAULT_SNIPPETS.F1})`);
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
          setSnippetSavedMsg(data.message || '✅ Z-코어에 F1~F10 10개 상용구가 즉시 저장·반영되었습니다!');
          playBabyGhostChime();
          setTimeout(() => setSnippetSavedMsg(null), 4000);
          return;
        }
      }
    } catch {
      // 로컬 폴백
    }
    setSnippetSavedMsg('✅ F1~F10 10개 내 상용구가 즉시 저장·반영되었습니다! (상단 복사검색 목록 및 F1~F10 슬롯에 즉시 적용됨)');
    playBabyGhostChime();
    setTimeout(() => setSnippetSavedMsg(null), 4000);
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
    <div
      className={
        inlineSuperpowerOnly
          ? 'w-full'
          : 'fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex items-center justify-center p-3 sm:p-5 pt-safe pb-safe overflow-y-auto'
      }
    >
      <div
        className={
          inlineSuperpowerOnly
            ? 'relative w-full rounded-2xl bg-[#18181B] border border-white/10 p-4 sm:p-5 md:p-6 flex flex-col gap-5 text-zinc-100'
            : 'relative w-full max-w-4xl max-h-[90dvh] overflow-y-auto rounded-3xl bg-[#111114] border border-white/15 p-4 sm:p-5 md:p-7 shadow-[0_0_60px_rgba(0,229,255,0.18)] flex flex-col gap-5 my-auto text-zinc-100'
        }
      >
        {!inlineSuperpowerOnly && (
          <>
        {/* 1) 상단 헤더 + 닫기 버튼 */}
        <div className="flex items-start justify-between gap-3 sm:gap-4">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <GhostiBrandLogo size="desktop" showBadge={true} />
              <span className="px-2.5 py-0.5 rounded-full bg-teal-500/15 border border-teal-400/40 text-teal-300 font-mono text-[11px] font-bold">
                내 PC와 모바일에 1초 내용검색을 · 광고 0% · 클라우드 월세 0원
              </span>
            </div>
            <h2 className="text-[19px] md:text-[22px] text-white font-extrabold tracking-tight mt-0.5">
              📖 귀신같이 핵심 가이드 (귀신검색 · 귀신비서 · 공유 확장)
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

        {/* 2) 2탭 네비게이션 바 (클릭한 1개 탭만 아래에 렌더링하여 시각적 피로도 제로!) */}
        <div
          role="tablist"
          aria-label="온보딩 2탭 메뉴"
          className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1.5 rounded-2xl bg-zinc-900/90 border border-white/10"
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
              <span className="text-[13.5px] font-extrabold">탭 1. 👻 귀신검색 &amp; 👻 귀신비서</span>
              <span className="px-1.5 py-0.5 rounded-md bg-teal-500/20 text-teal-300 text-[10px] font-black">
                내 기기 0원
              </span>
            </div>
            <span className="text-[11px] opacity-80">
              Ctrl + 0 1초 AI 내용검색 + 귀신비서 통합 케어
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
              <span className="text-[13.5px] font-extrabold">탭 2. 👨‍👩‍👧‍👦 사진 공유 &amp; 기기·업무 확장</span>
              <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-black">
                {isStoreAppMode ? '이메일 1초 연결' : '30일 무료체험'}
              </span>
            </div>
            <span className="text-[11px] opacity-80">
              가족·모임 사진방(0원) &amp; 내 기기 통합 Pro · 업무 공유(S:)
            </span>
          </button>
        </div>

          </>
        )}

        {/* ─────────────────────────────────────────────────────────────
            [탭 1] 👻 귀신검색 & 👻 귀신비서 (내 기기 1대는 언제나 0원)
           ───────────────────────────────────────────────────────────── */}
        {activeTab === 'tab1_find_care' && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* 1) 👻 귀신검색 */}
              <div className="p-4 rounded-2xl bg-zinc-900/90 border border-teal-500/35 flex flex-col justify-between gap-3">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 text-[11px] font-extrabold">
                      👻 귀신검색 (1초 AI 내용검색)
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

              {/* 2) 👻 귀신비서 (노션형 통합 대화창) */}
              <div className="p-4 rounded-2xl bg-zinc-900/90 border border-emerald-500/35 flex flex-col justify-between gap-3">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-extrabold">
                      👻 귀신비서 (정리 · 수리 · 복원)
                    </span>
                    <span className="text-[11px] text-emerald-400 font-bold">평생 무료</span>
                  </div>
                  <h3 className="text-[16px] font-extrabold text-white">
                    탭 이동 없이 한 대화창에서 정리하고 수리합니다
                  </h3>
                  <ul className="text-[12px] text-zinc-300 space-y-1.5 leading-relaxed">
                    <li>
                      • <strong className="text-emerald-300">📸 사진·파일 정리</strong>: 중복·흔들린 사진, 바탕화면·다운로드의 어지러운 문서와 설치파일을 깔끔하게 정리합니다.
                    </li>
                    <li>
                      • <strong className="text-teal-300">⚡ 속도·수리·진단</strong>: 느려진 PC 보안모듈 정리, 2026 최신 사양 진단, 먹통 수리(화면 위 빨간 손가락 <code className="text-amber-300">👆</code> 안내), 사라진 파일 추적을 수행합니다.
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
                    👻 귀신비서 대화창 바로 열기 →
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

              <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full sm:w-auto sm:shrink-0 bg-zinc-950/90 p-2.5 rounded-2xl border border-teal-400/30">
                <PairingQrCodeSvg />
                <div className="flex flex-col gap-1 min-w-0 sm:max-w-[215px]">
                  <span className="text-[11px] font-extrabold text-teal-300">
                    📱 스마트폰 앱 1초 설치 QR 코드
                  </span>
                  <p className="text-[10.5px] text-zinc-300 leading-snug">
                    폰 카메라로 스캔해 <strong className="text-white">모바일 앱을 바로 설치</strong>하세요! 설치 후에는 <strong className="text-emerald-300">같은 이메일 로그인 하나로</strong> 내 폰·PC가 자동 연결됩니다.
                  </p>
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
                    className="text-left text-[10.5px] text-emerald-400 font-bold cursor-pointer"
                  >
                    {merlinAuth?.email && merlinAuth.userId !== 'guest' && pcAgentPairedMobile
                      ? '● 내 폰 앱 설치·이메일 연결됨'
                      : merlinAuth?.email && merlinAuth.userId !== 'guest'
                      ? '○ 연결 상태 토글'
                      : '🔑 먼저 이메일 로그인하기'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            [탭 2] 👨‍👩‍👧‍👦 사진 공유 & 기기·업무 확장 (무료 vs 구독 혜택 1초 비교)
           ───────────────────────────────────────────────────────────── */}
        {activeTab === 'tab3_share_pro' && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 좌측: 🆓 무료 회원 (내 기기 + 사진 공유 평생 0원) */}
              <div className="p-5 rounded-2xl bg-zinc-900/90 border border-white/15 flex flex-col justify-between gap-4">
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-full bg-zinc-800 text-zinc-200 text-[11.5px] font-extrabold">
                      🆓 무료 코어 (내 기기 1대 · 사진 공유)
                    </span>
                    <span className="text-[14px] font-black text-teal-300">평생 0원</span>
                  </div>
                  <h3 className="text-[17px] font-extrabold text-white">
                    내 컴퓨터·폰 검색/정리와 가족·모임 사진 공유는 언제나 무료입니다
                  </h3>
                  <ul className="text-[12.5px] text-zinc-300 space-y-2 leading-relaxed pt-1">
                    <li>
                      ✅ <strong className="text-white">👻 귀신검색 (Ctrl + 0)</strong>: 내 기기 안의 사진·서류·동영상 1초 AI 내용검색 <strong className="text-teal-300">평생 무제한 무료</strong>
                    </li>
                    <li>
                      ✅ <strong className="text-white">👻 귀신비서</strong>: 알약·고클린 대체 보안·속도·용량 점검, 중복 사진 정리, 빨간 손가락(<code className="text-amber-300">👆</code>) 수리, 복원 기록 되돌리기 <strong className="text-teal-300">평생 무제한 무료</strong>
                    </li>
                    <li>
                      ✅ <strong className="text-white">📸 사진 공유 (가족·동호회·동창회)</strong>: 카톡 30일 만료·화질 저하 없이 인원수·장수 무제한 원본 앨범 공유 <strong className="text-teal-300">방장도 멤버도 평생 0원</strong>
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
                  무료 모드로 계속 쓰기
                </button>
              </div>

              {/* 우측: 👑 주력 상품 — 내 기기 통합 Pro */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950/70 via-zinc-900 to-zinc-900 border-2 border-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.2)] flex flex-col justify-between gap-4">
                <div className="flex flex-col gap-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <span className="px-3 py-1 rounded-full bg-emerald-400 text-zinc-950 text-[11.5px] font-black">
                      {isStoreAppMode
                        ? '👑 내 기기 통합 Pro & 데스크톱 연동'
                        : '👑 4번 내 기기 통합 Pro (🎁 30일 무료체험 · 월 3,900원 / 연간 결제 시 월 3,250원꼴)'}
                    </span>
                    <span className="text-[11.5px] font-extrabold text-emerald-300">
                      이메일 하나로 기기 대수 무제한 통합!
                    </span>
                  </div>
                  <h3 className="text-[17px] font-extrabold text-white leading-snug">
                    카톡 ‘나에게 보내기’ 끝, 내 모든 기기를 하나로!
                  </h3>
                  <ul className="text-[12.5px] text-zinc-200 space-y-2 leading-relaxed pt-1">
                    <li>
                      🥇 <strong className="text-emerald-300">1위. 카톡 ‘나에게 보내기’ &amp; 클라우드 불편 완전 종식</strong>: 폰으로 찍은 사진·서류가 압축 없이 내 PC로 1초 직결되어 무제한 통합 검색됩니다.
                    </li>
                    <li>
                      🥈 <strong className="text-emerald-300">2위. 무버튼 양방향 클립보드 ‘암호화 우체통(E2EE)’</strong>: 회사 PC나 폰에서 복사(<code className="text-white">Ctrl+C</code>·스샷)만 해두면, 꺼져 있던 집 PC를 켜는 순간 최근 100개 텍스트·10장 스샷이 자동 장전됩니다!
                    </li>
                    <li>
                      🥉 <strong className="text-amber-300">3위. 귀신검색 Pro 유료 확장(📝 사진·표 OCR 창 · 🏷️ 귀신 라벨러) 무제한 해금</strong>: 이미지·스샷 속 표와 글자를 엑셀·문서로 1초 추출하고 AI 파일명 라벨러를 전 기기 무제한으로 씁니다.
                    </li>
                    <li>
                      💼 <strong className="text-teal-300">
                        {isStoreAppMode
                          ? '5번 업무 공유 (공용 폴더 S: 드라이브)'
                          : '5번 업무 공유 (공용 폴더 S: 드라이브 · 30일 무료체험 / 월 9,900원~)'}
                      </strong>: NAS·클라우드 월세 없이 우리 팀 PC를 공용 드라이브(<code className="text-white">S:</code>)로 묶어 계약서·도면·현장사진을 공유합니다 (<strong className="text-white">팀원 전원 무료</strong>).
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
                  {isStoreAppMode
                    ? '💻 데스크톱(PC) 기기 연동 가이드 보기 →'
                    : '👑 내 기기 통합(30일 무료체험 · 월 3,900원) & 전체 혜택 보기 →'}
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
