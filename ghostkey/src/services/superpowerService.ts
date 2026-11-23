import { useSaySeeStore } from '../store/useSaySeeStore';
import { getZCoreUrl, hasActiveGhostiLoginSession } from '@shared/services/zCoreBridge';

export interface SuperpowerTrialStatus {
  engine_running: boolean;
  machine_hwid: string;
  account_id: string;
  trial_status:
    | 'NOT_STARTED'
    | 'ACTIVE'
    | 'ACTIVE_30D'
    | 'TRIAL_UNLIMITED'
    | 'PER_FEATURE_ACTIVE'
    | 'EXPIRED_LOCKED'
    | 'EXPIRED'
    | 'SUBSCRIBED';
  trial_opt_in_status?:
    | 'NOT_STARTED'
    | 'DEFERRED'
    | 'ACTIVE_30D'
    | 'EXPIRED_LOCKED'
    | 'SUBSCRIBED';
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
  F5: '귀신Key(GhostKey) 1초 복붙·오타성형 https://ghostkey.sundreamer.app',
  F6: '사업자등록번호: 123-86-98765 ((주)썬드림)',
  F7: '세금계산서 발행 이메일: billing@sundreamer.app',
  F8: '현관 공동비밀번호 및 와이파이 안내',
  F9: '오늘 오후 3시 줌(Zoom) 화상 미팅 링크입니다.',
  F10: '감사합니다. 좋은 하루 보내세요!',
};

const TRIAL_STORAGE_KEY = 'ghosti_superpower_trial_v27';
const SNIPPETS_STORAGE_KEY = 'ghosti_superpower_snippets_v27';

export function playBabyGhostChime(mode: 'typo' | 'summon' = 'typo'): void {
  try {
    const wavUrl =
      mode === 'summon' ? '/sounds/active_summon_sound.wav' : '/sounds/active_typo_sound.wav';
    const audio = new Audio(wavUrl);
    audio.volume = 0.22;
    void audio.play().catch(() => {
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
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
    // ignore
  }
}

const ENG_TO_JAMO: Record<string, string> = {
  r: 'ㄱ', R: 'ㄲ', s: 'ㄴ', e: 'ㄷ', E: 'ㄸ', f: 'ㄹ', a: 'ㅁ', q: 'ㅂ', Q: 'ㅃ',
  t: 'ㅅ', T: 'ㅆ', d: 'ㅇ', w: 'ㅈ', W: 'ㅉ', c: 'ㅊ', z: 'ㅋ', x: 'ㅌ', v: 'ㅍ', g: 'ㅎ',
  k: 'ㅏ', o: 'ㅐ', i: 'ㅑ', O: 'ㅒ', j: 'ㅓ', p: 'ㅔ', u: 'ㅕ', P: 'ㅖ', h: 'ㅗ', y: 'ㅛ',
  n: 'ㅜ', b: 'ㅠ', m: 'ㅡ', l: 'ㅣ',
};
const CHOSEONG = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];
const JUNGSEONG = [
  'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ',
  'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ',
];
const JONGSEONG = [
  '', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ',
  'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];
const COMPOUND_JUNG: Record<string, string> = {
  'ㅗㅏ': 'ㅘ', 'ㅗㅐ': 'ㅙ', 'ㅗㅣ': 'ㅚ', 'ㅜㅓ': 'ㅝ', 'ㅜㅔ': 'ㅞ', 'ㅜㅣ': 'ㅟ', 'ㅡㅣ': 'ㅢ',
};
const COMPOUND_JONG: Record<string, string> = {
  'ㄱㅅ': 'ㄳ', 'ㄴㅈ': 'ㄵ', 'ㄴㅎ': 'ㄶ', 'ㄹㄱ': 'ㄺ', 'ㄹㅁ': 'ㄻ', 'ㄹㅂ': 'ㄼ',
  'ㄹㅅ': 'ㄽ', 'ㄹㅌ': 'ㄾ', 'ㄹㅍ': 'ㄿ', 'ㄹㅎ': 'ㅀ', 'ㅂㅅ': 'ㅄ',
};
const COMMON_ENG_ALLOW = new Set([
  'iphone', 'youtube', 'google', 'naver', 'kakao', 'excel', 'office', 'windows',
  'ghost', 'ghosti', 'ghostkey', 'hello', 'world', 'test', 'ghdrlfehd', 'myid',
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

export function simulateSuperpowerLocal(
  mode: 'typo' | 'number9' | 'extract8' | 'hyphen7',
  text: string
): string {
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
    const schedM = s.match(
      /(오늘|내일|모레|\d{1,2}월\s*\d{1,2}일|[월화수목금토일]요일)\s*(오전|오후)?\s*(\d{1,2}시(\s*\d{1,2}분)?)/
    );
    const nameM = s.match(/([가-힣]{2,4})\s*(팀장|대표|과장|대리|사원|입니다|드림)/);
    const lines: string[] = [];
    if (nameM) lines.push(`- 성함: ${nameM[1]}`);
    if (phoneM) lines.push(`- 연락처: ${phoneM[1]}-${phoneM[2]}-${phoneM[3]}`);
    if (acctM) lines.push(`- 계좌: ${acctM[1]} ${acctM[2]}`);
    if (schedM) lines.push(`- 일정: ${schedM[0].trim()}`);
    return lines.length > 0
      ? lines.join('\n')
      : s.replace(/\b(01[016789])[-.\s]?(\d{3,4})[-.\s]?(\d{4})\b/g, '$1-$2-$3');
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

export async function fetchSuperpowerStatus(
  accountId: string,
  isSubscribed: boolean
): Promise<SuperpowerTrialStatus> {
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
        return {
          ...parsed,
          trial_status: 'SUBSCRIBED',
          trial_days_left: 9999,
          is_subscribed: true,
          snippets,
        };
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
    trial_days_left: isSubscribed ? 9999 : 30,
    started_at: null,
    expires_at: null,
    is_subscribed: isSubscribed,
    snippets,
  };
}

export async function startSuperpowerTrialAction(
  accountId: string,
  isSubscribed: boolean,
  agreed: boolean = true
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
  const exp = new Date(now.getTime() + 30 * 86400 * 1000);
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
