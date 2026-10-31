import React, { useEffect, useRef, useState } from 'react';
import { useHub } from '../services/merlin-hub-sdk/react';
import { useHubAuth } from '../services/merlin-hub-sdk/Auth/useHubAuth';
import { syncHubUserToLocalSupabase } from '../services/supabaseClient';

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
  category: 'video' | 'doc' | 'clean';
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

const DEFAULT_SHORTS_DATA: ShortsItem[] = [
  // 1. 동영상 장면 1초 찾기
  {
    id: 'video-1',
    category: 'video',
    title: '동영상 속 "아기 첫 걸음마" 몇 분 몇 초에 찍었지?',
    hookTime: '00:00 ~ 00:03 (훅)',
    hookLine: '“10분짜리 가족 영상에서 아기 걸음마 장면 찾느라 타임라인 일일이 땡기셨죠?”',
    solutionLine: '『귀신같이』에 "걸음마" 세 글자만 치면 03분 12초로 1초 만에 즉시 점프!',
    recommendedKeyword: '아기 걸음마 / 촛불 끄기 / 제주 바다',
    tag: PATENTS_FILED ? '🎬 비디오 1초 타임스탬프 특허' : '🎬 비디오 1초 타임스탬프 점프',
    thumbnailBg: 'from-cyan-950 via-teal-900 to-slate-900',
    isNew: true,
  },
  // 2. 문서·엑셀 투시 검색
  {
    id: 'doc-1',
    category: 'doc',
    title: '“최종_진짜최종_수정3.xlsx... 파일 열지 마세요”',
    hookTime: '00:00 ~ 00:03 (훅)',
    hookLine: '“엑셀 파일 수십 개 하나씩 열어서 Ctrl+F 누르다가 컴퓨터 멈춘 적 있으시죠?”',
    solutionLine: '파일을 안 열어도 표 안의 숫자와 글자를 0.01초 만에 엑스레이처럼 투시합니다.',
    recommendedKeyword: '지체상금 0.15% / 계약금 잔금 / 소득공제',
    tag: PATENTS_FILED ? '📊 무설정 스마트 서류 투시 특허' : '📊 무설정 스마트 서류 투시 검색',
    thumbnailBg: 'from-blue-950 via-indigo-950 to-slate-900',
    isNew: true,
  },
  // 3. 중복 사진·용량 대청소
  {
    id: 'clean-1',
    category: 'clean',
    title: '“비슷한 연사 사진 50장... 가장 잘 나온 1장만 남기기”',
    hookTime: '00:00 ~ 00:03 (훅)',
    hookLine: '“눈 감은 사진, 흔들린 사진 지우느라 주말 반나절을 사진첩 정리에 버리셨나요?”',
    solutionLine: '클린몬스터가 눈 뜬 베스트 1장만 추천하고, 나머지는 윈도우 휴지통으로 안전하게 정리!',
    recommendedKeyword: '연사 묶음 Pick / 눈 감은 사진 정리',
    tag: '🧹 클린몬스터 연사 Pick 엔진',
    thumbnailBg: 'from-amber-950 via-teal-950 to-slate-900',
    isNew: true,
  },
  {
    id: 'video-2',
    category: 'video',
    title: '“작년 제주도 여행에서 먹은 갈치조림 영상 어딨지?”',
    hookTime: '00:00 ~ 00:03 (훅)',
    hookLine: '“휴대폰에 쌓인 수백 개 동영상, 파일 이름이 전부 VID_2023... 이라 못 찾겠다면?”',
    solutionLine: 'AI가 영상 속 간판과 음성을 자동 분석해 원하는 순간만 콕 찍어 재생해 줍니다.',
    recommendedKeyword: '제주 갈치조림 / 생일파티 케이크',
    tag: '🎯 영상 속 간판·대사 인식',
    thumbnailBg: 'from-emerald-950 via-slate-900 to-teal-950',
  },
  {
    id: 'doc-2',
    category: 'doc',
    title: '“스캔한 영수증·계약서 PDF, 글자 복사도 안 되는데?”',
    hookTime: '00:00 ~ 00:03 (훅)',
    hookLine: '“이미지로 된 서류는 검색도 안 돼서 눈 빠지게 찾고 계셨나요?”',
    solutionLine: 'OCR AI 엔진이 이미지 속 작은 글씨까지 읽어내어 파일 제목 상관없이 바로 찾습니다.',
    recommendedKeyword: '사업자등록증 / 법인인감 / 부가세 영수증',
    tag: '📄 이미지 PDF 본문 고속 색인',
    thumbnailBg: 'from-slate-950 via-blue-900 to-slate-900',
  },
  {
    id: 'clean-2',
    category: 'clean',
    title: '“방금 지운 파일 실수로 날렸다고요? 1초 타임머신 복원!”',
    hookTime: '00:00 ~ 00:03 (훅)',
    hookLine: '“다른 청소 앱들은 잘못 지우면 영구 삭제되어 복구업체에 수십만 원 줘야 합니다.”',
    solutionLine: '『귀신같이』는 윈도우 정식 휴지통($Recycle.Bin) 연동으로 1초 만에 원래 폴더로 완벽 복원!',
    recommendedKeyword: '1초 실행취소 / 휴지통 안전 타임머신',
    tag: '🛡️ Windows 정식 휴지통 직결',
    thumbnailBg: 'from-rose-950 via-slate-900 to-teal-950',
  },
];

// 인터랙티브 3초 체험 샌드박스 시나리오 (최신 PLG 하이브리드 온보딩 트렌드)
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
      latency: '0.006초 (파일 안 열고 즉시 투시)',
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
      location: '온디바이스 OCR 투시 — 상단 3번째 줄',
      previewSnippet: '“상호: (주)썬드림스튜디오 | 등록번호: 123-86-XXXXX | 개업연월일: 2026년...”',
      latency: '0.012초 (이미지 속 글자 즉시 추출)',
    },
  ],
};

const QUICK_EMAIL_DOMAINS = ['@naver.com', '@gmail.com', '@daum.net', '@kakao.com'];

export const GhostiShowroomLanding: React.FC<GhostiShowroomLandingProps> = ({
  onEnterWorkspace,
  isDevAuthorized = false,
}) => {
  const { user, isLoggedIn, refreshSession } = useHub();
  const { status: otpStatus, sendOtp, verifyOtp, timer, formatTimer, error: otpError, reset: resetOtp } = useHubAuth();

  // 출시 모드 상태: 기본값은 OFFICIAL_LAUNCH_LIVE(false), ?dev=true 권한이 있을 때만 테스트용 온보딩뷰 전환 가능
  const [isLaunched, setIsLaunched] = useState<boolean>(OFFICIAL_LAUNCH_LIVE);
  const [shortsList, setShortsList] = useState<ShortsItem[]>(DEFAULT_SHORTS_DATA);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'video' | 'doc' | 'clean'>('all');
  const [activeShortsModal, setActiveShortsModal] = useState<ShortsItem | null>(null);
  const [activeBannerMode, setActiveBannerMode] = useState<'after' | 'before'>('after');

  // 인터랙티브 3초 온보딩 체험 탭 상태
  const [demoTab, setDemoTab] = useState<'video' | 'doc' | 'clean'>('video');
  const [selectedVideoScenarioIdx, setSelectedVideoScenarioIdx] = useState(0);
  const [selectedDocScenarioIdx, setSelectedDocScenarioIdx] = useState(0);
  const [cleanDemoDone, setCleanDemoDone] = useState(false);

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

  const verifiedUserEmail = (isLoggedIn && user?.email) ? user.email : localVerifiedEmail;

  // 카페브레이커 / 썬드리머 스튜디오 무인 쇼츠 피드(/data/ghosti_shorts_feed.json) 자동 로드 및 배치
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
        // 네트워크 오류 시 기본 내장 쇼룸 데이터 유지
      }
    };
    void loadShortsFeed();
    return () => {
      cancelled = true;
    };
  }, []);

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
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              <img
                src="/gwisinkachi_3d_wordmark_dark.png"
                alt="귀신같이 3D 로고"
                className="h-10 w-auto object-contain drop-shadow-[0_2px_12px_rgba(0,240,181,0.4)]"
              />
            </div>
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-[#00F0B5] text-[11px] font-bold">
              <span>★</span>
              <span>특허청 상표출원 40-2026-0229386</span>
            </div>
          </div>

          {/* 중앙 네비게이션 */}
          <nav className="hidden md:flex items-center gap-6 text-[14px] font-semibold text-zinc-300">
            <a href="#interactive-demo" className="hover:text-[#00F0B5] transition-colors">
              ⚡ 3초 체험 프리뷰
            </a>
            <a href="#shorts" className="hover:text-[#00F0B5] transition-colors">
              🎬 15초 영상 쇼룸
            </a>
            {PATENTS_FILED && (
              <a href="#patents" className="hover:text-[#00F0B5] transition-colors">
                6대 특허 기술
              </a>
            )}
            <a href="#security" className="hover:text-[#00F0B5] transition-colors">
              🛡️ 로컬 프라이버시
            </a>
          </nav>

          {/* 우측 액션 영역 */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* 일반 방문자용 메인 헤더 버튼 (출시 전: 사전가입/알림받기 앵커 vs 출시 후: 본 앱 바로 시작하기) */}
            {!isLaunched ? (
              verifiedUserEmail ? (
                <div className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 text-xs font-extrabold flex items-center gap-1.5">
                  <span>✅</span>
                  <span className="max-w-[150px] truncate">{verifiedUserEmail}</span>
                  <span className="hidden sm:inline">알림 예약됨</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={scrollToEmailBox}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#00F0B5] to-teal-400 hover:from-teal-300 hover:to-emerald-300 text-slate-950 text-xs sm:text-[13px] font-black shadow-[0_0_20px_rgba(0,240,181,0.35)] transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span>🔔</span>
                  <span>출시 알림받기</span>
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={() => onEnterWorkspace(true)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#00F0B5] to-teal-400 hover:from-teal-300 hover:to-emerald-300 text-slate-950 text-xs sm:text-[13px] font-black shadow-[0_0_24px_rgba(0,240,181,0.45)] transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>🚀</span>
                <span>본 앱 바로 시작하기</span>
              </button>
            )}

            {/* ⚠️ ?dev=true 접속 시에만 나타나는 개발자 컨트롤 */}
            {isDevAuthorized && (
              <div className="flex items-center gap-1.5 pl-2 border-l border-white/15">
                <button
                  type="button"
                  onClick={() => setIsLaunched(!isLaunched)}
                  title="?dev=true 전용: 출시 전(사전 알림) 대문과 출시 후(온보딩 본앱 진입) 대문을 전환해 확인합니다."
                  className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-amber-400/30 text-[11px] font-bold transition-all cursor-pointer"
                >
                  {isLaunched ? '🚀 출시 후 온보딩뷰' : '⏳ 출시 전 사전뷰'}
                </button>
                <button
                  type="button"
                  onClick={() => onEnterWorkspace(true)}
                  title="?dev=true 전용: 개발 중인 내부 워크스페이스로 진입합니다."
                  className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-teal-300 border border-teal-500/40 text-[11px] font-extrabold transition-all cursor-pointer flex items-center gap-1"
                >
                  <span>🧪</span>
                  <span className="hidden sm:inline">QA 워크스페이스</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. 메인 히어로 섹션 (출시 전: 사전 가입 이메일 인증 허브 / 출시 후: 대형 원클릭 본 앱 진입 온보딩 대문) */}
      <section className="relative pt-12 pb-16 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-10">
          {/* 상단 권위 배지 */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[12px] sm:text-[13px] font-black mb-6">
            <span className="animate-pulse">●</span>
            <span>
              {PATENTS_FILED ? '대한민국 6대 특허출원' : '특허 출원 진행 중'} · 개인 평생 무료 국민앱 · Zero-Server 로컬 프라이버시
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.18] mb-6">
            더 이상 열어보지 마세요.<br />
            내 기기 속 모든 파일·대사를<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00F0B5] via-teal-300 to-amber-300 drop-shadow-[0_0_35px_rgba(0,240,181,0.35)]">
              『귀신같이』 1초 만에
            </span>
          </h1>

          <p className="text-zinc-400 text-base sm:text-lg leading-relaxed mb-8">
            수백 개 동영상 속 결정적 대사, 폴더 깊숙이 묻힌 엑셀 표와 계약서, 쌓여가는 중복 사진까지.<br className="hidden sm:inline" />
            단 1바이트도 외부 서버로 보내지 않고, 내 PC와 스마트폰 안에서 가장 안전하게 해결합니다.
          </p>

          {/* 히어로 메인 액션 박스 */}
          <div ref={heroCtaRef}>
            {!isLaunched ? (
              /* ============================================================
               * [Phase 1: 출시 전 모드] — 이메일 1초 인증 사전 가입 & 출시 알림 예약
               * ============================================================ */
              <div className="bg-gradient-to-b from-zinc-900/95 to-zinc-950/95 border border-teal-500/35 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-[0_25px_70px_rgba(0,0,0,0.65)] text-left max-w-2xl mx-auto">
                {/* 상단 안정화 진행률 게이지 */}
                <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-teal-300 mb-2">
                  <span className="flex items-center gap-2">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#00F0B5] animate-ping" />
                    <span>현재 최종 안정화 테스트 중 — 정식 무료 배포 카운트다운</span>
                  </span>
                  <span className="font-extrabold text-[#00F0B5]">87% 완료</span>
                </div>
                <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden mb-6 p-0.5 border border-white/5">
                  <div
                    className="h-full bg-gradient-to-r from-teal-500 via-[#00F0B5] to-amber-400 rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(0,240,181,0.8)]"
                    style={{ width: '87%' }}
                  />
                </div>

                {/* 상태 분기: ① 이미 이메일 인증(사전가입) 완료된 경우 */}
                {verifiedUserEmail ? (
                  <div className="rounded-2xl bg-emerald-950/50 border-2 border-[#00F0B5]/60 p-5 sm:p-6 text-center">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#00F0B5]/20 text-[#00F0B5] text-xs font-black mb-3">
                      <span>
                        {dbSyncStatus === 'syncing'
                          ? '🔄 알림 예약 등록 중...'
                          : '🎉 사전 무료 가입 & 출시 1순위 알림 예약 완료'}
                      </span>
                    </div>
                    <h3 className="text-lg sm:text-xl font-black text-white mb-1.5">
                      <span className="text-[#00F0B5]">{verifiedUserEmail}</span> 님, 환영합니다!
                    </h3>
                    <p className="text-zinc-300 text-xs sm:text-sm leading-relaxed mb-4">
                      정식 오픈 즉시 가장 먼저 알림 메일을 보내드리며, <b>다음번 방문부터는 별도 절차 없이 1초 만에 본 앱으로 바로 입장</b>하실 수 있습니다.
                    </p>
                    {isDevAuthorized && (
                      <button
                        type="button"
                        onClick={() => onEnterWorkspace(true)}
                        className="w-full mb-3 py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#00F0B5] via-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 text-slate-950 font-black text-sm shadow-[0_0_25px_rgba(0,240,181,0.45)] transition-all cursor-pointer"
                      >
                        🚀 본 앱 워크스페이스 바로 입장하기 ➔
                      </button>
                    )}
                    <div className="flex flex-wrap items-center justify-center gap-2.5">
                      <a
                        href="#interactive-demo"
                        className="px-5 py-2.5 rounded-xl bg-[#00F0B5] hover:bg-teal-300 text-slate-950 font-black text-xs sm:text-sm transition-all shadow-lg"
                      >
                        ⚡ 아래에서 3초 체험 프리뷰 해보기 ↓
                      </a>
                      <a
                        href="#shorts"
                        className="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-white/10 font-bold text-xs sm:text-sm transition-all"
                      >
                        🎬 15초 영상 사용법 둘러보기 ↓
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          try {
                            localStorage.removeItem('ghosti_prelaunch_verified_email');
                          } catch {}
                          setLocalVerifiedEmail('');
                          resetOtp();
                        }}
                        className="px-3 py-2 text-[11px] text-zinc-400 hover:text-zinc-200 underline cursor-pointer"
                      >
                        다른 이메일로 변경
                      </button>
                    </div>
                  </div>
                ) : otpStatus === 'sent' || otpStatus === 'verifying' ? (
                  /* 상태 분기: ② 6자리 인증번호(OTP) 입력 단계 */
                  <div className="rounded-2xl bg-zinc-900/90 border border-teal-400/50 p-5 sm:p-6">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-xs sm:text-sm font-extrabold text-[#00F0B5] flex items-center gap-1.5">
                        <span>📩</span>
                        <span>{emailInput.trim().toLowerCase()}로 인증번호 6자리를 발송했습니다!</span>
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-mono font-bold">
                        ⏱ {formatTimer()}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-300 mb-4 leading-relaxed">
                      방금 보내드린 메일에서 <b>6자리 숫자</b>를 입력해 주세요. (메일이 안 보이면 <b>스팸메일함</b>도 꼭 확인해 주세요!)<br />
                      번호 6자리를 모두 입력하시면 <b>자동으로 평생 무료 회원 DB에 등록</b>되며 정식 출시 알림이 예약됩니다.
                    </p>

                    <div className="flex items-center justify-center gap-2 sm:gap-3 mb-4" onPaste={handleOtpPaste}>
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
                          className="w-11 h-13 sm:w-13 sm:h-14 rounded-xl bg-zinc-950 border-2 border-teal-500/40 focus:border-[#00F0B5] text-center text-xl sm:text-2xl font-black text-white outline-none transition-all shadow-inner"
                        />
                      ))}
                    </div>

                    {otpError && (
                      <p className="text-xs text-rose-400 font-bold text-center mb-3">
                        ⚠️ {otpError}
                      </p>
                    )}

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-2">
                      <button
                        type="button"
                        disabled={otpStatus === 'verifying' || otpDigits.join('').length < 6}
                        onClick={() => void handleVerifyOtpCode(otpDigits.join(''))}
                        className="w-full sm:flex-1 py-3.5 rounded-xl bg-gradient-to-r from-[#00F0B5] to-teal-400 hover:from-teal-300 hover:to-emerald-300 disabled:opacity-50 text-slate-950 font-black text-sm shadow-[0_0_25px_rgba(0,240,181,0.35)] transition-all cursor-pointer"
                      >
                        {otpStatus === 'verifying'
                          ? '인증 확인 중...'
                          : '✅ 이메일 인증 완료하고 출시 알림 예약하기'}
                      </button>
                      <button
                        type="button"
                        onClick={() => resetOtp()}
                        className="px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-all cursor-pointer"
                      >
                        이메일 다시 입력
                      </button>
                    </div>
                  </div>
                ) : (
                  /* 상태 분기: ③ 기본 이메일 입력 & 사전가입 유도 단계 */
                  <div>
                    <div className="mb-4">
                      <h3 className="text-lg sm:text-xl font-black text-white flex items-center gap-2 mb-1">
                        <span>🔔</span>
                        <span>정식 출시 즉시 『1초 오픈 알림』 받기 & 사전 무료 가입</span>
                      </h3>
                      <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                        출시 후 어차피 사용하실 계정, 지금 <b className="text-[#00F0B5]">이메일 인증(10초)</b>만 해두시면 <b>사전 회원가입이 즉시 완료</b>되며 오픈 당일 가장 먼저 알림과 시작 링크를 보내드립니다.
                      </p>
                    </div>

                    <form onSubmit={handleRequestEmailVerification} className="space-y-3">
                      <div className="flex flex-col sm:flex-row gap-2.5">
                        <input
                          ref={emailInputRef}
                          type="email"
                          value={emailInput}
                          onChange={(e) => {
                            setEmailInput(e.target.value);
                            if (formNotice) setFormNotice(null);
                          }}
                          placeholder="이메일 주소를 입력하세요 (예: myid@naver.com)"
                          className="flex-1 px-4 py-3.5 rounded-xl bg-zinc-950 border border-white/15 focus:border-[#00F0B5] text-white placeholder-zinc-500 text-sm font-medium outline-none transition-all"
                        />
                        <button
                          type="submit"
                          disabled={otpStatus === 'sending'}
                          className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#00F0B5] via-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 disabled:opacity-60 text-slate-950 font-black text-sm sm:text-[15px] shadow-[0_4px_25px_rgba(0,240,181,0.4)] flex items-center justify-center gap-2 shrink-0 transition-transform active:scale-95 cursor-pointer"
                        >
                          <span>🔔</span>
                          <span>
                            {otpStatus === 'sending'
                              ? '인증번호 발송 중...'
                              : '출시 알림받기 (이메일 인증)'}
                          </span>
                        </button>
                      </div>

                      {/* 자주 쓰는 이메일 도메인 원터치 입력 칩 */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-400">
                        <span className="mr-1">원터치 도메인 완성:</span>
                        {QUICK_EMAIL_DOMAINS.map((domain) => (
                          <button
                            key={domain}
                            type="button"
                            onClick={() => applyQuickDomain(domain)}
                            className="px-2.5 py-1 rounded-lg bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 hover:text-[#00F0B5] border border-white/5 font-mono transition-colors cursor-pointer"
                          >
                            {domain}
                          </button>
                        ))}
                      </div>

                      {(formNotice || otpError) && (
                        <p className="text-xs text-rose-400 font-bold">
                          ⚠️ {formNotice || otpError}
                        </p>
                      )}
                    </form>

                    <p className="mt-4 pt-3 border-t border-white/5 text-[11.5px] text-zinc-400 flex flex-wrap items-center justify-between gap-2">
                      <span>🔒 신용카드 등록 절대 없음 · 개인 평생 무료 국민앱</span>
                      <span className="text-teal-300/90 font-semibold">✨ 사전 가입자는 정식 오픈일 별도 가입 없이 1초 자동 시작</span>
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* ============================================================
               * [Phase 2: 정식 출시 후 온보딩 대문 모드] — 대형 원클릭 본 앱 진입 + 기기별 다운로드 허브
               * ============================================================ */
              <div className="bg-gradient-to-b from-zinc-900/95 to-zinc-950/95 border-2 border-[#00F0B5]/50 rounded-3xl p-6 sm:p-9 backdrop-blur-xl shadow-[0_25px_80px_rgba(0,240,181,0.2)] max-w-2xl mx-auto">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/20 text-[#00F0B5] font-extrabold text-xs mb-4">
                  <span>🎉 정식 무료 배포 오픈! 지금 바로 웹에서 시작하거나 기기에 설치하세요</span>
                </div>

                {verifiedUserEmail && (
                  <p className="text-xs sm:text-sm text-emerald-300 font-bold mb-4">
                    👋 반갑습니다, <b>{verifiedUserEmail}</b> 님! 인증된 계정으로 바로 시작하실 수 있습니다.
                  </p>
                )}

                {/* 커다란 메인 원클릭 본 앱 진입 CTA 버튼 */}
                <button
                  type="button"
                  onClick={() => onEnterWorkspace(true)}
                  className="w-full py-5 px-8 rounded-2xl bg-gradient-to-r from-[#00F0B5] via-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 text-slate-950 font-black text-lg sm:text-xl shadow-[0_0_45px_rgba(0,240,181,0.5)] hover:shadow-[0_0_60px_rgba(0,240,181,0.75)] transition-all flex items-center justify-center gap-3 cursor-pointer active:scale-[0.99] mb-5"
                >
                  <span className="text-2xl">🚀</span>
                  <span>『귀신같이』 본 앱 바로 시작하기</span>
                  <span className="text-base opacity-80">➔</span>
                </button>

                {/* 기기별 네이티브 코어 & 앱 다운로드 버튼 3종 */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <a
                    href="/Merlin_Z_Core.zip"
                    download="Merlin_Z_Core.zip"
                    className="px-4 py-3 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 border border-[#00F0B5]/40 text-[#00F0B5] font-extrabold text-xs sm:text-[13px] flex items-center justify-center gap-2 transition-all shadow-md"
                  >
                    <span>💻</span>
                    <span>Windows PC 엔진 받기</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => alert('Google Play 스토어 정식 페이지로 연결됩니다.')}
                    className="px-4 py-3 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 border border-white/10 text-zinc-200 font-bold text-xs sm:text-[13px] flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <span>📱</span>
                    <span>Google Play 설치</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => alert('Apple App Store 정식 페이지로 연결됩니다.')}
                    className="px-4 py-3 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 border border-white/10 text-zinc-200 font-bold text-xs sm:text-[13px] flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <span>🍎</span>
                    <span>App Store 설치</span>
                  </button>
                </div>

                <p className="mt-4 text-[11.5px] text-zinc-400">
                  💡 처음 오셨나요? 아래 <b>3초 체험 프리뷰</b>와 <b>15초 영상 사용설명서</b>를 가볍게 둘러보신 뒤 시작하셔도 좋습니다.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 3. 최신 PLG 하이브리드 온보딩: 3초 인터랙티브 체험 샌드박스 (#interactive-demo) */}
        <div
          id="interactive-demo"
          className="mt-12 max-w-5xl mx-auto rounded-3xl bg-gradient-to-b from-zinc-900/90 to-zinc-950/95 border border-teal-500/30 p-5 sm:p-8 shadow-2xl"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-white/10">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#00F0B5]/15 text-[#00F0B5] text-xs font-extrabold mb-1.5">
                <span>⚡</span>
                <span>설치 없이 대문에서 바로 눌러보는 3초 온보딩 체험</span>
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                『귀신같이』가 어떻게 1초 만에 찾고 치우는지 직접 눌러보세요
              </h2>
            </div>

            {/* 3대 기능 체험 탭 */}
            <div className="inline-flex rounded-2xl bg-zinc-950 p-1.5 border border-white/10 shrink-0">
              <button
                type="button"
                onClick={() => setDemoTab('video')}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                  demoTab === 'video'
                    ? 'bg-[#00F0B5] text-slate-950 shadow-[0_0_15px_rgba(0,240,181,0.4)]'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                🎬 동영상 장면 점프
              </button>
              <button
                type="button"
                onClick={() => setDemoTab('doc')}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                  demoTab === 'doc'
                    ? 'bg-[#00F0B5] text-slate-950 shadow-[0_0_15px_rgba(0,240,181,0.4)]'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                📊 엑셀·문서 투시
              </button>
              <button
                type="button"
                onClick={() => setDemoTab('clean')}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                  demoTab === 'clean'
                    ? 'bg-[#00F0B5] text-slate-950 shadow-[0_0_15px_rgba(0,240,181,0.4)]'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                🧹 연사 사진 1장 Pick
              </button>
            </div>
          </div>

          {/* 탭별 인터랙티브 시뮬레이션 화면 */}
          <div className="mt-6">
            {demoTab === 'video' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                <div className="lg:col-span-5 space-y-3">
                  <p className="text-xs font-bold text-zinc-400">
                    👇 아래에서 찾고 싶은 장면 키워드를 클릭해 보세요:
                  </p>
                  {INTERACTIVE_SCENARIOS.video.map((item, idx) => (
                    <button
                      key={item.query}
                      type="button"
                      onClick={() => setSelectedVideoScenarioIdx(idx)}
                      className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                        selectedVideoScenarioIdx === idx
                          ? 'bg-teal-950/60 border-[#00F0B5] shadow-[0_0_25px_rgba(0,240,181,0.2)]'
                          : 'bg-zinc-900/60 border-white/10 hover:border-white/25'
                      }`}
                    >
                      <div>
                        <span className="text-xs text-teal-300 font-bold block mb-0.5">
                          🔍 검색어 입력 예시 #{idx + 1}
                        </span>
                        <span className="text-base font-black text-white">
                          “{item.query}”
                        </span>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-[#00F0B5]/20 text-[#00F0B5] text-xs font-extrabold">
                        즉시 점프 ➔
                      </span>
                    </button>
                  ))}
                </div>

                <div className="lg:col-span-7 rounded-2xl bg-zinc-950 border border-teal-500/40 p-5 sm:p-6 shadow-inner">
                  <div className="flex items-center justify-between text-xs text-zinc-400 mb-3 pb-3 border-b border-white/10">
                    <span className="font-mono text-teal-300 font-bold truncate">
                      📁 {INTERACTIVE_SCENARIOS.video[selectedVideoScenarioIdx].file}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-extrabold shrink-0">
                      ⚡ {INTERACTIVE_SCENARIOS.video[selectedVideoScenarioIdx].latency} 포착
                    </span>
                  </div>
                  <div className="rounded-xl bg-gradient-to-br from-teal-950/90 via-slate-900 to-zinc-950 border border-teal-500/30 p-5 mb-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00F0B5] text-slate-950 text-xs font-black mb-3">
                      <span>▶</span>
                      <span>
                        정확히 {INTERACTIVE_SCENARIOS.video[selectedVideoScenarioIdx].timestamp} 구간으로 자동 점프 재생!
                      </span>
                    </div>
                    <p className="text-white font-black text-base sm:text-lg mb-2">
                      {INTERACTIVE_SCENARIOS.video[selectedVideoScenarioIdx].transcript}
                    </p>
                    <p className="text-xs sm:text-sm text-teal-200/80">
                      🎯 AI 장면 인식: {INTERACTIVE_SCENARIOS.video[selectedVideoScenarioIdx].sceneDesc}
                    </p>
                  </div>
                  <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden relative">
                    <div className="bg-teal-500/40 h-full w-full" />
                    <div
                      className="absolute top-0 h-full w-16 bg-[#00F0B5] rounded-full shadow-[0_0_12px_#00F0B5] transition-all duration-500"
                      style={{ left: `${22 + selectedVideoScenarioIdx * 28}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {demoTab === 'doc' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                <div className="lg:col-span-5 space-y-3">
                  <p className="text-xs font-bold text-zinc-400">
                    👇 엑셀·PDF·스캔 이미지를 열지 않고 찾을 단어를 눌러보세요:
                  </p>
                  {INTERACTIVE_SCENARIOS.doc.map((item, idx) => (
                    <button
                      key={item.query}
                      type="button"
                      onClick={() => setSelectedDocScenarioIdx(idx)}
                      className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                        selectedDocScenarioIdx === idx
                          ? 'bg-teal-950/60 border-[#00F0B5] shadow-[0_0_25px_rgba(0,240,181,0.2)]'
                          : 'bg-zinc-900/60 border-white/10 hover:border-white/25'
                      }`}
                    >
                      <div>
                        <span className="text-xs text-teal-300 font-bold block mb-0.5">
                          📄 무열람 투시 검색어 #{idx + 1}
                        </span>
                        <span className="text-base font-black text-white">
                          “{item.query}”
                        </span>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-[#00F0B5]/20 text-[#00F0B5] text-xs font-extrabold">
                        엑스레이 투시 ➔
                      </span>
                    </button>
                  ))}
                </div>

                <div className="lg:col-span-7 rounded-2xl bg-zinc-950 border border-teal-500/40 p-5 sm:p-6 shadow-inner">
                  <div className="flex items-center justify-between text-xs text-zinc-400 mb-3 pb-3 border-b border-white/10">
                    <span className="font-mono text-teal-300 font-bold truncate">
                      📄 {INTERACTIVE_SCENARIOS.doc[selectedDocScenarioIdx].file}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-extrabold shrink-0">
                      ⚡ {INTERACTIVE_SCENARIOS.doc[selectedDocScenarioIdx].latency}
                    </span>
                  </div>
                  <div className="rounded-xl bg-gradient-to-br from-blue-950/70 via-slate-900 to-zinc-950 border border-teal-500/30 p-5">
                    <span className="inline-block px-2.5 py-1 rounded bg-amber-400/20 text-amber-300 text-xs font-extrabold mb-2">
                      📍 발견 위치: {INTERACTIVE_SCENARIOS.doc[selectedDocScenarioIdx].location}
                    </span>
                    <p className="text-white font-bold text-sm sm:text-base leading-relaxed bg-black/50 p-4 rounded-xl border border-white/10">
                      {INTERACTIVE_SCENARIOS.doc[selectedDocScenarioIdx].previewSnippet}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {demoTab === 'clean' && (
              <div className="rounded-2xl bg-zinc-950 border border-teal-500/40 p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                  <div>
                    <h4 className="text-base sm:text-lg font-black text-white">
                      🧹 연속 촬영한 비슷한 사진 6장 중 눈 뜬 『베스트 1장』만 남기기
                    </h4>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      나머지 흔들리거나 눈 감은 5장은 영구 삭제가 아니라 <b>Windows 정식 휴지통($Recycle.Bin)</b>으로 이동되어 언제든 1초 만에 복원됩니다.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCleanDemoDone(!cleanDemoDone)}
                    className={`px-5 py-3 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer shrink-0 ${
                      cleanDemoDone
                        ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-lg'
                        : 'bg-[#00F0B5] hover:bg-teal-300 text-slate-950 shadow-[0_0_20px_rgba(0,240,181,0.4)]'
                    }`}
                  >
                    {cleanDemoDone ? '↩️ 1초 타임머신으로 5장 원래대로 복원하기' : '✨ 베스트 1장만 남기고 5장 안전 정리 체험'}
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                  {[
                    { id: 1, label: '컷 #1 (살짝 흔들림)', best: false },
                    { id: 2, label: '컷 #2 (눈 감음)', best: false },
                    { id: 3, label: '컷 #3 (활짝 웃음 · 초점 완벽)', best: true },
                    { id: 4, label: '컷 #4 (초점 흐림)', best: false },
                    { id: 5, label: '컷 #5 (고개 돌아감)', best: false },
                    { id: 6, label: '컷 #6 (역광 어두움)', best: false },
                  ].map((shot) => {
                    const isMovedToTrash = cleanDemoDone && !shot.best;
                    return (
                      <div
                        key={shot.id}
                        className={`p-3 rounded-xl border text-center transition-all duration-300 ${
                          shot.best
                            ? 'bg-teal-950/70 border-2 border-[#00F0B5] shadow-[0_0_20px_rgba(0,240,181,0.25)] scale-[1.02]'
                            : isMovedToTrash
                            ? 'bg-zinc-900/30 border-white/5 opacity-35 scale-95'
                            : 'bg-zinc-900/80 border-white/10'
                        }`}
                      >
                        <div className="text-2xl mb-1.5">
                          {shot.best ? '👑' : isMovedToTrash ? '🗑️' : '🖼️'}
                        </div>
                        <div className="text-[11px] font-extrabold text-white mb-1">
                          {shot.best ? '베스트 1장 Pick' : isMovedToTrash ? '휴지통 보호 격리' : `연사 사진 #${shot.id}`}
                        </div>
                        <div className="text-[10px] text-zinc-400">{shot.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 4. Before & After 2단 비주얼 쇼케이스 */}
        <div className="mt-8 max-w-5xl mx-auto rounded-3xl bg-zinc-950/80 border border-white/10 p-4 sm:p-6 shadow-2xl relative">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <span className="text-xs sm:text-sm font-extrabold text-zinc-400 flex items-center gap-2">
              <span className="text-teal-400">⚡</span>
              <span>『귀신같이』 사용 전(Before) vs 사용 후(After) 극적 변화</span>
            </span>
            <div className="inline-flex rounded-xl bg-zinc-900 p-1 border border-white/10">
              <button
                type="button"
                onClick={() => setActiveBannerMode('before')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeBannerMode === 'before'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                사용 전: 파일 찾다 지친 일상 (Before)
              </button>
              <button
                type="button"
                onClick={() => setActiveBannerMode('after')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeBannerMode === 'after'
                    ? 'bg-teal-500/20 text-[#00F0B5] border border-teal-500/40 shadow-[0_0_12px_rgba(0,240,181,0.3)]'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                사용 후: 1초 스캔 각성 (After)
              </button>
            </div>
          </div>

          <div className="relative rounded-2xl overflow-hidden aspect-[16/9] sm:aspect-[21/9] bg-black border border-white/10 flex items-center justify-center">
            {activeBannerMode === 'before' ? (
              <div className="w-full h-full relative group">
                <img
                  src="/gwisinkachi_hero_banner_dark_before.jpg"
                  alt="Before 배너: 불 꺼진 돋보기를 들고 눈물 흘리는 잿빛 아기귀신"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent flex flex-col justify-end p-6 sm:p-8">
                  <span className="px-2.5 py-1 rounded-md bg-rose-500/30 border border-rose-500/50 text-rose-300 font-extrabold text-xs w-max mb-2">
                    BEFORE (고통 구간)
                  </span>
                  <h3 className="text-lg sm:text-2xl font-black text-white">
                    “그 파일 분명 저장했는데... 도대체 어디로 사라진 거야?”
                  </h3>
                  <p className="text-zinc-400 text-xs sm:text-sm mt-1">
                    동영상 타임라인 넘기다 1시간, 엑셀 열다 컴퓨터 다운, 중복 사진에 저장 공간 부족 경고까지.
                  </p>
                </div>
              </div>
            ) : (
              <div className="w-full h-full relative group">
                <img
                  src="/gwisinkachi_hero_banner_neon_after.jpg"
                  alt="After 배너: 황금 돋보기 스캔 광선과 네온 민트 아기귀신"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent flex flex-col justify-end p-6 sm:p-8">
                  <span className="px-2.5 py-1 rounded-md bg-teal-500/30 border border-teal-500/50 text-[#00F0B5] font-extrabold text-xs w-max mb-2">
                    AFTER (각성 구간)
                  </span>
                  <h3 className="text-lg sm:text-2xl font-black text-white">
                    말 한마디로 1초 만에 포착! 황금 돋보기 스캔 광선으로 즉시 투시
                  </h3>
                  <p className="text-teal-200/80 text-xs sm:text-sm mt-1">
                    {PATENTS_FILED ? '대한민국 6대 특허출원 엔진 탑재.' : '100% 로컬 온디바이스 AI 엔진 탑재.'} 파일·영상·사진이 있는 그 자리에서 1초 만에 찾아냅니다.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 5. 중단 공식 쇼츠 영상관 (카페브레이커 자동 배치 연동 & 영구 15초 영상 사용설명서 쇼룸) */}
      <section id="shorts" className="py-20 px-4 sm:px-6 max-w-7xl mx-auto border-t border-white/5">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/10 text-teal-400 text-xs font-bold mb-3">
            <span>🎬</span>
            <span>자동 업데이트 15초 영상 사용설명서 쇼룸</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black tracking-tight mb-4">
            누구나 15초만 보면 바로 따라 하는<br />
            『귀신같이』 핵심 활용 영상관
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base">
            어렵고 긴 글자 설명서는 필요 없습니다. 새로 업로드되는 15초 핵심 영상을 이곳에서 바로 시청하세요.
          </p>

          {/* 3대 카테고리 필터 탭 */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-8">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-[#00F0B5] text-slate-950 shadow-[0_0_20px_rgba(0,240,181,0.4)]'
                  : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              전체 보기 ({shortsList.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('video')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                selectedCategory === 'video'
                  ? 'bg-[#00F0B5] text-slate-950 shadow-[0_0_20px_rgba(0,240,181,0.4)]'
                  : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              🎬 동영상 장면 1초 찾기
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('doc')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                selectedCategory === 'doc'
                  ? 'bg-[#00F0B5] text-slate-950 shadow-[0_0_20px_rgba(0,240,181,0.4)]'
                  : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              📊 문서·엑셀 투시 검색
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('clean')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                selectedCategory === 'clean'
                  ? 'bg-[#00F0B5] text-slate-950 shadow-[0_0_20px_rgba(0,240,181,0.4)]'
                  : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              🧹 중복 사진·용량 대청소
            </button>
          </div>
        </div>

        {/* 쇼츠 카드 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredShorts.map((item) => (
            <div
              key={item.id}
              onClick={() => setActiveShortsModal(item)}
              className="group rounded-2xl bg-zinc-900/60 border border-white/10 hover:border-teal-400/50 p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_15px_40px_rgba(0,240,181,0.15)] cursor-pointer flex flex-col justify-between"
            >
              <div>
                {/* 상단 썸네일 영역 */}
                <div
                  className={`relative aspect-[9/16] max-h-56 w-full rounded-xl bg-gradient-to-br ${item.thumbnailBg} border border-white/10 mb-4 overflow-hidden flex items-center justify-center p-4 text-center`}
                >
                  {item.youtubeId && (
                    <img
                      src={`https://i.ytimg.com/vi/${item.youtubeId}/hqdefault.jpg`}
                      alt={item.title}
                      className="absolute inset-0 w-full h-full object-cover opacity-65 group-hover:scale-105 transition-transform duration-500"
                    />
                  )}
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />
                  <div className="relative z-10">
                    <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md border border-white/40 flex items-center justify-center mx-auto mb-2 text-white text-xl shadow-lg group-hover:scale-110 transition-transform">
                      ▶
                    </div>
                    <span className="text-[11px] font-bold text-teal-300 bg-black/60 px-2 py-0.5 rounded-full border border-teal-500/30">
                      15초 영상 바로 재생
                    </span>
                  </div>
                  <span className="absolute top-2.5 left-2.5 text-[10px] font-extrabold text-white/90 bg-black/65 px-2 py-0.5 rounded">
                    {item.tag}
                  </span>
                  {item.isNew && (
                    <span className="absolute top-2.5 right-2.5 text-[10px] font-black text-slate-950 bg-[#00F0B5] px-2 py-0.5 rounded-full shadow">
                      NEW
                    </span>
                  )}
                </div>

                {/* 영상 정보 */}
                <h3 className="font-black text-base text-zinc-100 group-hover:text-[#00F0B5] transition-colors leading-snug mb-2">
                  {item.title}
                </h3>
                <div className="text-xs text-rose-300/90 font-medium mb-1 line-clamp-2">
                  {item.hookLine}
                </div>
                <div className="text-xs text-teal-300 font-bold mb-3 line-clamp-2">
                  👉 {item.solutionLine}
                </div>
              </div>

              {/* 추천 검색어 */}
              <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-400">
                <span className="truncate">
                  핵심 키워드: <b className="text-zinc-200">{item.recommendedKeyword}</b>
                </span>
                <span className="text-[#00F0B5] font-extrabold shrink-0 ml-2">바로 보기 ➔</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. Zero-Server 로컬 프라이버시 & 핵심 신뢰 약속 (#security) */}
      <section id="security" className="py-16 px-4 sm:px-6 max-w-7xl mx-auto border-t border-white/5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: '🛡️',
              title: 'Zero-Server 100% 로컬 프라이버시',
              desc: '내 사진, 가족 동영상, 회사 계약서와 세무 엑셀은 단 1바이트도 외부 클라우드 서버로 전송되지 않고 오직 내 기기 안에서만 안전하게 분석됩니다.',
            },
            {
              icon: '↩️',
              title: '영구 삭제 없는 1초 타임머신 복원',
              desc: '클린몬스터가 정리한 중복 사진과 파일은 임의로 증발하지 않고 Windows 정식 휴지통 및 복원 기록에 보호되어 언제든 1초 만에 원래 폴더로 되돌립니다.',
            },
            {
              icon: '💎',
              title: '신용카드 등록 없는 개인 평생 무료',
              desc: '동영상 장면 찾기, 문서·엑셀 안 열어보고 투시 검색, 중복 사진 용량 청소 등 개인 핵심 기능은 복잡한 카드 등록 없이 평생 무료로 제공됩니다.',
            },
          ].map((item) => (
            <div
              key={item.title}
              className="p-6 rounded-2xl bg-zinc-900/50 border border-white/10 hover:border-teal-500/35 transition-colors"
            >
              <div className="text-3xl mb-3">{item.icon}</div>
              <h3 className="text-lg font-black text-white mb-2">{item.title}</h3>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 7. 하단 온보딩 마무리 CTA 배너 (외부 이탈 링크 대신 사전가입/본앱 진입으로 100% 집중) */}
      <section className="py-14 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="rounded-3xl bg-gradient-to-r from-emerald-950/85 via-slate-900 to-teal-950/85 border border-teal-500/40 p-8 sm:p-10 flex flex-col lg:flex-row items-center justify-between gap-6 shadow-2xl">
          <div>
            <span className="px-3 py-1 rounded-full bg-[#00F0B5]/20 text-[#00F0B5] font-extrabold text-xs mb-3 inline-block">
              {!isLaunched ? '🔔 정식 오픈 1순위 초대장' : '🚀 지금 바로 시작하세요'}
            </span>
            <h3 className="text-2xl sm:text-3xl font-black mb-2 text-white">
              {!isLaunched ? (
                <>
                  이메일 인증 한 번으로 <span className="text-[#00F0B5]">사전 가입과 출시 알림</span>을 동시에!
                </>
              ) : (
                <>
                  이제 내 기기 속 파일을 <span className="text-[#00F0B5]">『귀신같이』 1초 만에</span> 찾아보세요!
                </>
              )}
            </h3>
            <p className="text-zinc-300 text-xs sm:text-sm leading-relaxed max-w-xl">
              {!isLaunched
                ? '미리 이메일 인증을 마친 회원님께는 정식 출시 즉시 알림 메일을 보내드리며, 출시 후 별도 회원가입 없이 1초 만에 본 앱으로 바로 입장하실 수 있습니다.'
                : '복잡한 설정 없이 버튼 하나로 본 앱 워크스페이스로 입장하여 동영상·문서·사진 1초 투시 검색을 바로 경험하실 수 있습니다.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {!isLaunched ? (
              verifiedUserEmail ? (
                <div className="px-6 py-4 rounded-2xl bg-emerald-500/20 border border-[#00F0B5] text-[#00F0B5] font-black text-sm flex items-center gap-2">
                  <span>✅</span>
                  <span>{verifiedUserEmail} 사전 가입 & 알림 예약 완료</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={scrollToEmailBox}
                  className="px-7 py-4 rounded-2xl bg-gradient-to-r from-[#00F0B5] to-teal-400 hover:from-teal-300 hover:to-emerald-300 text-slate-950 font-black text-sm sm:text-base flex items-center gap-2 shadow-[0_0_30px_rgba(0,240,181,0.4)] transition-all cursor-pointer"
                >
                  <span>🔔</span>
                  <span>이메일 1초 인증하고 출시 알림받기 ↑</span>
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={() => onEnterWorkspace(true)}
                className="px-8 py-4 rounded-2xl bg-gradient-to-r from-[#00F0B5] to-teal-400 hover:from-teal-300 hover:to-emerald-300 text-slate-950 font-black text-base sm:text-lg flex items-center gap-2.5 shadow-[0_0_35px_rgba(0,240,181,0.5)] transition-all cursor-pointer"
              >
                <span>🚀</span>
                <span>귀신같이 본 앱 바로 시작하기</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 7-B. 네이버·구글 SEO 검색 노출 최적화 & 자주 묻는 질문 (#faq) */}
      <section
        id="faq"
        aria-labelledby="faq-heading"
        className="py-16 px-4 sm:px-6 max-w-5xl mx-auto border-t border-white/5"
      >
        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/10 text-teal-400 text-xs font-bold mb-2">
            <span>❓</span>
            <span>자주 묻는 질문 (FAQ)</span>
          </span>
          <h2 id="faq-heading" className="text-2xl sm:text-3xl font-black text-white">
            『귀신같이(Ghosti)』 시작 전 궁금한 점 4가지
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 mt-2">
            개인 평생 무료 정책부터 로컬 프라이버시, 2단계 시작 방법까지 한눈에 확인하세요.
          </p>
        </div>

        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-zinc-900/60 border border-white/10 p-5">
            <dt className="text-sm sm:text-base font-black text-[#00F0B5] mb-2">
              Q1. 귀신같이(Ghosti)는 정말 개인 평생 무료인가요?
            </dt>
            <dd className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
              네! 동영상 속 대사·장면 1초 점프 찾기, 엑셀·PDF·한글·스캔 이미지 안 열어보고 투시 검색(찾기), 중복·흔들린 사진 1초 용량 청소(치우기), 컴퓨터 소리·인쇄·화면 먹통 수리(고치기) 등 <b>개인 라운지 3대 핵심 기능은 신용카드 등록 없이 10초 이메일 인증(무료 회원가입)만으로 평생 무료</b>입니다.
            </dd>
          </div>

          <div className="rounded-2xl bg-zinc-900/60 border border-white/10 p-5">
            <dt className="text-sm sm:text-base font-black text-[#00F0B5] mb-2">
              Q2. 내 사진이나 회사 엑셀·계약서 파일이 외부 서버로 전송되나요?
            </dt>
            <dd className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
              절대 전송되지 않습니다. 『귀신같이』는 <b>Zero-Server 100% 로컬 온디바이스 프라이버시 아키텍처</b>로 설계되어, 내 기기 안의 사진·동영상·문서 원본은 단 1바이트도 외부 클라우드로 나가지 않고 오직 내 PC와 스마트폰 안에서만 안전하게 분석됩니다.
            </dd>
          </div>

          <div className="rounded-2xl bg-zinc-900/60 border border-white/10 p-5">
            <dt className="text-sm sm:text-base font-black text-[#00F0B5] mb-2">
              Q3. 동영상 속 대사나 엑셀·계약서 안의 글자도 열지 않고 찾아주나요?
            </dt>
            <dd className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
              네! 파일 제목을 몰라도 기억나는 대사나 장면만 말하면 동영상 속 해당 초(Sec) 구간으로 1초 만에 점프하며, 엑셀·PDF·한글·스캔 이미지도 일일이 열어보지 않고 본문 속 숫자와 조항을 즉시 투시 검색합니다.
            </dd>
          </div>

          <div className="rounded-2xl bg-zinc-900/60 border border-white/10 p-5">
            <dt className="text-sm sm:text-base font-black text-[#00F0B5] mb-2">
              Q4. 클린몬스터로 중복 사진을 치우면 영구 삭제되나요?
            </dt>
            <dd className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
              아닙니다. 『귀신같이』는 사용자 파일을 임의로 영구 증발시키지 않습니다. 정리된 파일은 <b>Windows 정식 휴지통($Recycle.Bin)</b> 및 앱 내 <b>[복원 기록] 타임머신</b>에 안전하게 보호 격리되어 언제든 클릭 한 번으로 원래 폴더 위치 그대로 1초 복원할 수 있습니다.
            </dd>
          </div>
        </dl>
      </section>

      {/* 8. 최하단 마스터 푸터 (일반 방문자에게는 QA 워크스페이스 버튼 100% 비노출) */}
      <footer className="border-t border-white/10 py-12 px-4 sm:px-6 max-w-7xl mx-auto text-xs text-zinc-500">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <img
              src="/gwisinkachi_3d_wordmark_dark.png"
              alt="귀신같이 3D 로고"
              className="h-8 w-auto object-contain opacity-80"
            />
            <div>
              <p className="font-bold text-zinc-400">
                (주)썬드림스튜디오 · 썬드리머 패밀리 플래그십 『귀신같이(Ghosti)』
              </p>
              <p className="mt-0.5">
                상표출원 제40-2026-0229386호 · {PATENTS_FILED ? '대한민국 6대 특허출원' : '특허 출원 진행 중'} · Zero-Server 프라이버시 엔진 탑재
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-zinc-400">
            {isDevAuthorized && (
              <>
                <button
                  type="button"
                  onClick={() => onEnterWorkspace(true)}
                  className="hover:text-[#00F0B5] transition-colors underline font-medium cursor-pointer"
                >
                  🧪 내부 워크스페이스(QA) 진입
                </button>
                <span>·</span>
              </>
            )}
            <span className="select-none">
              © 2026 Sundreamer Studio. All rights reserved.
            </span>
          </div>
        </div>
      </footer>

      {/* 9. 세로형 15초 쇼츠 재생 모달 팝업 (유튜브 ID가 있으면 실제 임베드 재생, 외부 이탈 없이 사전가입/본앱 진입으로 직결) */}
      {activeShortsModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setActiveShortsModal(null)}
        >
          <div
            className="relative w-full max-w-sm rounded-3xl bg-zinc-950 border border-teal-500/40 p-5 shadow-2xl flex flex-col justify-between max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 닫기 버튼 */}
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
                <span className="text-xs text-zinc-400">15초 영상 설명서</span>
              </div>

              {/* 세로 비디오 플레이어 영역 (9:16): youtubeId가 있으면 실제 유튜브 쇼츠 임베드 재생 */}
              {activeShortsModal.youtubeId ? (
                <div className="relative aspect-[9/16] rounded-2xl overflow-hidden bg-black border border-white/10 mb-4 shadow-inner">
                  <iframe
                    src={`https://www.youtube.com/embed/${activeShortsModal.youtubeId}?autoplay=1&rel=0&playsinline=1`}
                    title={activeShortsModal.title}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : activeShortsModal.videoUrl ? (
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
              ) : (
                <div
                  className={`relative aspect-[9/16] rounded-2xl bg-gradient-to-b ${activeShortsModal.thumbnailBg} border border-white/10 mb-4 flex flex-col items-center justify-center p-6 text-center shadow-inner`}
                >
                  <div className="w-16 h-16 rounded-full bg-teal-400/20 border border-teal-300 flex items-center justify-center text-teal-300 text-2xl mb-4 animate-pulse">
                    ▶
                  </div>
                  <h4 className="text-white font-black text-lg mb-3 leading-snug">
                    {activeShortsModal.title}
                  </h4>
                  <div className="p-3 rounded-xl bg-black/60 border border-white/10 text-xs text-zinc-300 leading-relaxed mb-3 w-full">
                    <b className="text-rose-400 block mb-1">0~3초 공감 상황:</b>
                    {activeShortsModal.hookLine}
                  </div>
                  <div className="p-3 rounded-xl bg-teal-950/80 border border-teal-500/30 text-xs text-[#00F0B5] font-bold leading-relaxed w-full">
                    <b className="text-amber-300 block mb-1">10초~ 『귀신같이』 1초 해결:</b>
                    {activeShortsModal.solutionLine}
                  </div>
                </div>
              )}
            </div>

            {/* 모달 하단 전환 버튼: 외부 유튜브/블로그로 이탈시키지 않고 즉시 사전가입 또는 본앱 시작으로 연결 */}
            <div className="space-y-2">
              {!isLaunched ? (
                <button
                  type="button"
                  onClick={() => {
                    setActiveShortsModal(null);
                    scrollToEmailBox();
                  }}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#00F0B5] to-teal-400 hover:from-teal-300 hover:to-emerald-300 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
                >
                  <span>🔔</span>
                  <span>
                    {verifiedUserEmail
                      ? '✅ 출시 알림 예약 완료 (창 닫기)'
                      : '이 기능 출시 때 알림받기 (이메일 1초 인증)'}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setActiveShortsModal(null);
                    onEnterWorkspace(true);
                  }}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#00F0B5] to-teal-400 hover:from-teal-300 hover:to-emerald-300 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
                >
                  <span>🚀</span>
                  <span>본 앱으로 들어가서 이 기능 바로 써보기</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
