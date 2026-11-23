export type GhostKeyLang = 'ko' | 'en' | 'ja';

const LANG_STORAGE_KEY = 'ghostkey_lang_v1';

export function detectInitialGhostKeyLang(): GhostKeyLang {
  if (typeof window === 'undefined') return 'ko';
  try {
    const urlLang = new URLSearchParams(window.location.search).get('lang');
    if (urlLang === 'ko' || urlLang === 'en' || urlLang === 'ja') {
      return urlLang;
    }
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === 'ko' || saved === 'en' || saved === 'ja') {
      return saved;
    }
    const nav = (navigator.language || '').toLowerCase();
    if (nav.startsWith('ja')) return 'ja';
    if (nav.startsWith('ko')) return 'ko';
    if (nav.startsWith('en')) return 'en';
  } catch {
    /* ignore */
  }
  return 'ko';
}

export function saveGhostKeyLang(lang: GhostKeyLang): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
}

// ============================================================================
// 0.2ms Real-Time QWERTY (영타) -> Hangul (한글 두벌식) Buttonless Auto Engine
// (기존 GhostiShowroomLanding.tsx 구축본 100% 보존)
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

/** EN: CapsLock 역전 복구 (hELLO wORLD -> Hello World) */
export function fixCapsLockInversion(input: string): string {
  return input.replace(/\b[a-z][A-Z]{2,}\b|\b[A-Z]{2,}[a-z]+\b/g, (word) => {
    const inverted = Array.from(word)
      .map((ch) => (ch >= 'a' && ch <= 'z' ? ch.toUpperCase() : ch >= 'A' && ch <= 'Z' ? ch.toLowerCase() : ch))
      .join('');
    return inverted;
  });
}

/** JA: 전각 영숫자·기호·공백 -> 반각 일괄 변환 */
export function convertFullwidthToHalfwidthJa(input: string): string {
  return input
    .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/\u3000/g, ' ');
}

export function formatGhostKeyDemoPreview(lang: GhostKeyLang, rawText: string): string {
  let out = rawText;
  if (lang === 'ko') {
    out = convertEngTypoToKor(out);
  } else if (lang === 'en') {
    out = fixCapsLockInversion(out);
  } else {
    out = convertFullwidthToHalfwidthJa(out);
  }
  return out
    .replace(/\n{2,}/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export interface GhostKeyCopy {
  brandName: string;
  tagline: string;
  navOnboarding: string;
  navSettings: string;
  navZCore: string;
  navPricing: string;
  heroBadge: string;
  heroTitleLine1: string;
  heroTitleHighlight: string;
  heroSub: string;
  ctaTryTrial: string;
  ctaInstallZCore: string;
  ctaProBadge: string;
  priceMonthly: string;
  priceYearly: string;
  proPriceMonthly: string;
  proPriceYearly: string;
  noCardNote: string;
  demoHeader: string;
  demoLiveBadge: string;
  beforeLabel: string;
  beforeBadge: string;
  afterLabel: string;
  afterBadge: string;
  inputHintPreset: string;
  inputHintTyping: string;
  inputPlaceholder: string;
  clearBtn: string;
  undoBtn: string;
  convertedToast: string;
  guardBanner: string;
  samples: Array<{ label: string; raw: string }>;
  toolbarItems: Array<{
    key: 'auto' | 'seq' | '1' | 'snip' | 'ocr';
    label: string;
    title: string;
    desc: string;
    before: string;
    after: string;
  }>;
  dojoSectionTitle: string;
  dojoSectionSub: string;
  nudgeTitle: string;
  nudgeDesc: string;
  nudgeBtn: string;
}

export const GHOSTKEY_COPY: Record<GhostKeyLang, GhostKeyCopy> = {
  ko: {
    brandName: '귀신Key (GhostKey)',
    tagline: '단축키 한 번으로 끝내는 오타·복붙·상용구 작업 도구',
    navOnboarding: '기능 소개 · 체험',
    navSettings: '단축키 · 상용구 설정',
    navZCore: '내 컴퓨터 연결',
    navPricing: '이용권 안내',
    heroBadge: 'Ctrl+0 / Ctrl+우클릭',
    heroTitleLine1: '쓰던 자리에서 멈춤 없이,',
    heroTitleHighlight: '단축키 하나로 끝내는 입력 작업',
    heroSub:
      '한영 오타 자동 교정, 1→2→3 순차 붙여넣기, PDF 깨진 줄바꿈 정리, 자주 쓰는 상용구 입력까지 작업 중인 창을 벗어나지 않고 Ctrl+0으로 처리합니다.',
    ctaTryTrial: '30일 무료체험 시작',
    ctaInstallZCore: '내 컴퓨터 연결',
    ctaProBadge: '귀신같이 Pro 이용자는 추가 결제 없이 함께 사용 가능',
    priceMonthly: '1,900원',
    priceYearly: '19,000원',
    proPriceMonthly: '3,900원',
    proPriceYearly: '39,000원',
    noCardNote: '카드 등록 없이 30일간 체험할 수 있으며, 종료 후 자동 결제되지 않습니다.',
    demoHeader: '직접 영타를 입력하고 스페이스바를 눌러 동작을 확인해 보세요.',
    demoLiveBadge: '자동 변환 예시',
    beforeLabel: '입력 원문',
    beforeBadge: '영타 실수',
    afterLabel: '변환 결과',
    afterBadge: '스페이스바 입력 시',
    inputHintPreset: '입력창을 클릭하면 직접 입력해 볼 수 있습니다.',
    inputHintTyping: '영타를 입력한 뒤 스페이스바를 눌러보세요.',
    inputPlaceholder: '예: dkssudgktpdy 입력 후 스페이스바',
    clearBtn: '지우기',
    undoBtn: '원문 보기 (Ctrl+Z)',
    convertedToast: '자동 변환되었습니다.',
    guardBanner:
      '평소 Ctrl+C / Ctrl+V는 원문 서식을 그대로 유지하며, 줄바꿈·서식 정리는 Ctrl+0을 눌렀을 때만 동작합니다.',
    samples: [
      {
        label: '예시 1 · 한영 오타 교정',
        raw: 'dkssudgktpdy! 오늘 회의자료 rkatkgkqslek. 내일 오전 10시에 뵙겠습니다.',
      },
      {
        label: '예시 2 · 메신저 오타 교정',
        raw: 'rmqgkRp 카톡 Tmr다가 gksdudzl 안 눌러서 다시 쓰고 있어요.',
      },
      {
        label: '예시 3 · PDF 줄바꿈 정리',
        raw: '계약서에서 복사할 때마다\n\n줄바꿈이 중간에 끊겨서\n\n일일이 지우고 계셨나요?',
      },
    ],
    toolbarItems: [
      {
        key: 'auto',
        label: '한영 오타 자동 교정',
        title: '한영키를 누르지 않고 입력한 영타를 자연스러운 한글로 교정합니다.',
        desc: '스페이스바를 누르는 순간 자동으로 한글로 전환되며, 이메일 주소(@)·URL·영문 약어(PDF·AI·PC)는 원문 그대로 보존합니다.',
        before: 'dkssudgktpdy 회의 PDF rkatkgkqslek',
        after: '안녕하세요 회의 PDF 감사합니다',
      },
      {
        key: 'seq',
        label: '순차 붙여넣기',
        title: '여러 항목을 차례로 복사한 뒤 Ctrl+V만으로 순서대로 입력합니다.',
        desc: '이름·연락처·주소를 연속으로 복사해 두면 창을 오가지 않고 입력칸마다 순서대로 붙여넣을 수 있습니다.',
        before: '홍길동 · 010-1234-5678 · 강남구 연속 복사',
        after: '입력칸마다 Ctrl+V로 순서대로 자동 입력',
      },
      {
        key: '1',
        label: '줄바꿈 · 서식 정리',
        title: 'PDF에서 복사한 끊어진 줄바꿈과 불필요한 서식을 깔끔하게 정돈합니다.',
        desc: '일반 복붙(Ctrl+C/V)은 원문을 건드리지 않고, 정리가 필요할 때만 Ctrl+0으로 순수 텍스트로 다듬습니다.',
        before: '끊어진 PDF 문단 · 배경색 서식 · 꼬리말',
        after: '매끈하게 이어진 순수 텍스트 본문',
      },
      {
        key: 'snip',
        label: 'F1~F6 상용구 입력',
        title: '자주 쓰는 계좌번호·주소·안내 문구를 단축키 한 번으로 입력합니다.',
        desc: '반복 입력하는 텍스트를 F1~F6에 저장해 두면 어떤 프로그램에서든 오타 없이 즉시 불러올 수 있습니다.',
        before: '입금 계좌 · 사업자번호 · 안내 문구',
        after: 'Ctrl+0 F1~F6 키로 즉시 입력',
      },
      {
        key: 'ocr',
        label: '로컬 7일 클립보드 검색',
        title: '최근 7일간 복사한 텍스트를 외부 서버 전송 없이 내 PC에서 즉시 검색합니다.',
        desc: '예전에 복사해 둔 계좌번호·주소·문장을 키워드로 바로 찾아 입력할 수 있습니다. (내 PC 전용 7일 보관)',
        before: '3일 전 복사한 계좌번호·안내 문구',
        after: 'Ctrl+0 검색창에서 키워드로 즉시 불러오기',
      },
    ],
    dojoSectionTitle: '주요 기능 직접 테스트해 보기',
    dojoSectionSub: '프로그램 설치 전, 브라우저에서 단축키 소환과 각 기능을 미리 눌러볼 수 있습니다.',
    nudgeTitle: '입력·복붙은 귀신Key, 안 열고 찾는 건 귀신같이',
    nudgeDesc: '파일 이름 몰라도 문서 속 표·사진 속 글자·영상 속 장면까지 열지 않고 1초 만에 소환하고, 느려진 PC도 새것처럼 깨웁니다. (평생 무료)',
    nudgeBtn: '귀신같이 무료 둘러보기',
  },
  en: {
    brandName: 'GhostKey',
    tagline: 'Save 1 Hour/Day of Copy-Paste & Typing Friction · Powered by Z-Core 5199',
    navOnboarding: 'Onboarding & Live Demo',
    navSettings: '⌨ Hotkey & Snippet Settings',
    navZCore: 'Connect Z-Core',
    navPricing: '$1.99/mo · Pro Included',
    heroBadge: 'Ctrl+0 / Ctrl+Right-Click · 30-Day No-Card Full Trial',
    heroTitleLine1: 'Eliminate 1 Hour/Day of',
    heroTitleHighlight: 'Copy-Paste & Formatting Grunt Work',
    heroSub:
      'Built for operators, sellers, analysts, and office pros. Instant CapsLock inversion fix, PDF line-break ironing, 1→2→3 sequential paste, and screenshot table-to-Excel OCR right at your cursor.',
    ctaTryTrial: 'Start 30-Day No-Card Trial',
    ctaInstallZCore: 'Install & Connect Z-Core (5199)',
    ctaProBadge: 'Included free with Ghosti Pro ($3.99/mo)',
    priceMonthly: '$1.99',
    priceYearly: '$19',
    proPriceMonthly: '$3.99',
    proPriceYearly: '$39',
    noCardNote: 'No credit card required · On Day 31, GhostKey hotkeys quietly pause while free Ghosti core stays untouched.',
    demoHeader: 'Zero manual buttons! Watch the automatic CapsLock & PDF fix, then type directly and press Space:',
    demoLiveBadge: '1-Sec Auto Fix Active',
    beforeLabel: 'Before · Raw Input',
    beforeBadge: 'CapsLock / Broken PDF',
    afterLabel: 'After · Instant Clean Output',
    afterBadge: 'On Spacebar',
    inputHintPreset: '(Auto demo finished! Click inside to type and test yourself)',
    inputHintTyping: '(Type inverted CapsLock like "hELLO wORLD" and press Space!)',
    inputPlaceholder: 'Try typing "hELLO tEAM, tHE rEPORT IS rEADY " and hit Space...',
    clearBtn: 'Clear',
    undoBtn: '↩ Undo (Ctrl+Z)',
    convertedToast: 'Instant auto-fix applied!',
    guardBanner:
      'Just press Ctrl + 0 (or Ctrl + Right-Click) anywhere! Normal Ctrl+C/V preserves 100% original formatting; ironing runs only when you invoke it.',
    samples: [
      {
        label: 'Sample 1: CapsLock Inversion Auto-Recovery',
        raw: 'hELLO tEAM! tHE q4 rEPORT IS rEADY for review at 10 AM.',
      },
      {
        label: 'Sample 2: Broken PDF Line-Break Ironing',
        raw: 'Every time you copy text\n\nfrom a multi-column PDF,\n\nline breaks shatter your paragraph.',
      },
      {
        label: 'Sample 3: Mixed CapsLock + Broken Lines',
        raw: 'pLEASE sEND the invoice\n\nbefore fRIDAY 5 PM\n\ntHANKS!',
      },
    ],
    toolbarItems: [
      {
        key: 'auto',
        label: 'CapsLock Auto-Recovery',
        title: 'Instant CapsLock Fix — Recover accidentally inverted words without retyping!',
        desc: 'Typed "hELLO wORLD" with CapsLock on? GhostKey restores natural casing on the spot while protecting URLs, emails, and acronyms (PDF, AI, API).',
        before: 'hELLO tEAM, tHE PDF rEPORT IS rEADY',
        after: 'Hello Team, The PDF Report is Ready',
      },
      {
        key: 'seq',
        label: '1→2→3 Sequential Paste',
        title: 'Sequential Paste Queue — Copy 3 fields once, tap Ctrl+V to fill in order!',
        desc: 'Copy Name, Phone, and Address in one sweep—then press Ctrl+V across form fields without alt-tabbing back and forth.',
        before: 'Copy: John Doe · +1-555-0199 · Austin, TX',
        after: 'Tap Ctrl+V × 3 across form fields in 1 second',
      },
      {
        key: '1',
        label: 'PDF Line-Break & Format Wash',
        title: 'Format & Line-Break Ironing — Strip dark backgrounds and broken PDF newlines!',
        desc: 'Regular Ctrl+C/V stays untouched. Hit Ctrl+0 only when you want clean plain text with stitched paragraphs and zero ad footers.',
        before: 'Broken PDF wraps · Dark HTML backgrounds · Footers',
        after: 'Clean, unified paragraph ready for email or docs',
      },
      {
        key: 'snip',
        label: '⌨ F1–F12 Instant Snippets',
        title: '⌨ F1–F12 Snippets — Bank details, addresses, and canned replies in one keystroke!',
        desc: 'Store your most-typed emails, billing info, and templates once and fire them into any app via Ctrl+0 F1–F12.',
        before: 'Wire details · Tax ID · Standard reply template',
        after: 'Zero-typo 1-second insertion in any input box',
      },
      {
        key: 'ocr',
        label: 'Table OCR Excel (TSV)',
        title: 'Screenshot Table OCR Excel — Paste locked image tables straight into cells!',
        desc: 'Capture unselectable price sheets or scanned PDF tables and paste directly into Excel/Sheets with columns intact.',
        before: 'Unselectable image price table · Scanned invoice',
        after: 'Clean tab-separated cells pasted right into Excel',
      },
    ],
    dojoSectionTitle: 'GhostKey Interactive Training Dojo (Try Before Installing)',
    dojoSectionSub: 'Test Ctrl+0 summon, sequential paste, line ironing, and table OCR right in your browser.',
    nudgeTitle: 'Already installed Z-Core? Ghosti 1-Sec Local File Search is Free Forever!',
    nudgeDesc: 'GhostKey shares the same local Merlin Z-Core engine—unlock instant local document/photo search and PC tune-up on Ghosti with zero extra install.',
    nudgeBtn: 'Open Ghosti Main App ',
  },
  ja: {
    brandName: 'GhostKey (귀신Key)',
    tagline: '毎日1時間のコピペ単純作業を1秒削除 · Z-Core 5199 連携',
    navOnboarding: 'オンボーディング · 体験版',
    navSettings: '⌨ ショートカット · 定型文設定',
    navZCore: 'Z-Core 接続',
    navPricing: '月 ¥290 / Pro連携',
    heroBadge: 'Ctrl+0 / Ctrl+右クリック · カード不要30日間フル体験',
    heroTitleLine1: '毎日1時間の',
    heroTitleHighlight: 'コピペ・全角半角作業を1秒で解消',
    heroSub:
      '経理・EC運営・事務職のためのネイティブ時短チートキー。全角↔半角の一括変換、PDF改行アイロン、1→2→3連続ペースト、画像表OCR→Excel直行をカーソル位置からCtrl+0一発で完了。',
    ctaTryTrial: '30日間カード不要で無料体験',
    ctaInstallZCore: 'Z-Core インストール・接続 (5199)',
    ctaProBadge: 'Ghosti Pro(月¥590)会員は追加料金0円で自動有効化',
    priceMonthly: '¥290',
    priceYearly: '¥2,900',
    proPriceMonthly: '¥590',
    proPriceYearly: '¥5,900',
    noCardNote: 'カード登録不要 · 31日目に未課金でも本体無料機能はそのまま、GhostKeyのみ静かにOFFになります。',
    demoHeader: 'ボタン不要！自動変換デモを見たあと、下の欄に全角英数字を入力してスペースキーを押してみてください：',
    demoLiveBadge: '1秒自動変換 稼働中',
    beforeLabel: 'Before · 全角 / 改行崩れ',
    beforeBadge: '全角混在・PDF改行',
    afterLabel: 'After · 1秒一括変換',
    afterBadge: 'スペースで即時',
    inputHintPreset: '(自動デモ完了！クリックすると直接入力して体験できます)',
    inputHintTyping: '(全角英数字を入力してスペースキーを押してください！)',
    inputPlaceholder: '全角英数字を入力してスペースを押してみてください（例：０１０－１２３４－５６７８ ＡＢＣ ）',
    clearBtn: 'クリア',
    undoBtn: '↩ 元に戻す(Ctrl+Z)',
    convertedToast: '1秒で全角→半角・改行整形完了！',
    guardBanner:
      '迷ったら Ctrl + 0（または Ctrl + 右クリック）だけ！普段の Ctrl+C/V は元の書式を100%保持し、必要な時だけ1秒整形が動きます。',
    samples: [
      {
        label: '例文1: 全角英数字・電話番号を1秒で半角化',
        raw: '電話番号：０３－１２３４－５６７８　コード：ＡＢＣ－２０２６　金額：１９，８００円',
      },
      {
        label: '例文2: PDFの途切れた改行を1秒アイロン',
        raw: '契約書PDFからコピーするたびに\n\n変な場所で改行が入って\n\n毎回バックスペースで直していませんか？',
      },
      {
        label: '例文3: 全角スペース＆英数混在の一括クレンジング',
        raw: '注文番号　ＯＲＤ－９９８１\n\n担当：ＴＡＮＡＫＡ＠ｅｘａｍｐｌｅ．ｊｐ',
      },
    ],
    toolbarItems: [
      {
        key: 'auto',
        label: '全角↔半角 1秒一括変換',
        title: '全角↔半角 1秒一括変換 — 混在した全角数字・記号・スペースを一瞬で統一！',
        desc: '見積書やフォーム入力で面倒な全角英数字・ハイフン・全角スペースを1秒で綺麗な半角へ整形します。',
        before: '０３－１２３４－５６７８　ＡＢＣ１２３',
        after: '03-1234-5678 ABC123',
      },
      {
        key: 'seq',
        label: '1→2→3 連続コピー順番貼付',
        title: '連続コピー順番ペースト — 複数項目をまとめてコピーし、Ctrl+V連打で順番入力！',
        desc: '氏名・電話・住所を順にCtrl+Cしておけば、ウィンドウを行き来せず入力欄ごとにCtrl+Vだけで順番に流し込めます。',
        before: '山田太郎 · 090-1234-5678 · 東京都港区',
        after: 'フォーム各欄でCtrl+V×3回だけで1秒入力完了',
      },
      {
        key: '1',
        label: '書式・PDF改行アイロン',
        title: '書式・改行アイロン — 普段のコピペは原本維持、必要な時だけ一瞬で整形！',
        desc: 'PDFの途中改行やWeb記事の背景色・広告フッターを、Ctrl+0からワンクリックで純粋な文章に整えます。',
        before: 'PDF改行崩れ · 黒背景書式 · 広告フッター',
        after: 'ワンクリックで滑らかなプレーンテキストへ整形',
      },
      {
        key: 'snip',
        label: '⌨ F1〜F12 定型文1秒入力',
        title: '⌨ F1〜F12 定型文 — 口座番号・住所・挨拶文をキー1回でミスなく入力！',
        desc: '毎日打つ振込先や定型メールを登録しておけば、どのアプリでもCtrl+0F1〜F12で1秒呼び出しできます。',
        before: '振込口座 · 請求先メール · 定番の挨拶文',
        after: 'キー1回でタイプミス0の1秒入力',
      },
      {
        key: 'ocr',
        label: '画像表OCR Excel直行',
        title: 'キャプチャ表OCR Excel(TSV)直行 — コピー不可の単価表も1秒でExcel化！',
        desc: 'ドラッグできない画像やPDFスキャンの表をキャプチャしてCtrl+0を押すだけで、セル構造のままExcelへ貼り付けられます。',
        before: '選択不可の価格表画像 · スキャン見積書',
        after: 'Excelのセルに合わせて1秒でそのままペースト',
      },
    ],
    dojoSectionTitle: 'GhostKey 実践トレーニング道場（インストール前にそのまま体験）',
    dojoSectionSub: 'Ctrl+0呼び出し、連続ペースト、改行アイロン、表OCRまでブラウザ上で直接テストできます。',
    nudgeTitle: '同じZ-Coreで本体『Ghosti』の1秒ローカル検索＆PC高速化も永久無料！',
    nudgeDesc: '追加インストール不要。すでに入っているMerlin Z-Coreで、PC内の文書・写真1秒検索もすぐ使えます。',
    nudgeBtn: 'Ghosti 本体を開く ',
  },
};
