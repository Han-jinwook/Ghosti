import React, { useEffect, useRef, useState } from 'react';
import { useHub } from '../services/merlin-hub-sdk/react';
import { useHubAuth } from '../services/merlin-hub-sdk/Auth/useHubAuth';
import {
  clearGhostiLogoutLock,
  syncHubUserToLocalSupabase,
} from '../services/supabaseClient';
import { useSaySeeStore } from '../store/useSaySeeStore';
import { Z_CORE_ZIP_URL, LATEST_Z_CORE_VERSION } from '../services/zCoreBridge';
import { playBabyGhostChime } from './OnboardingModal';
import { silencePendingEnterGiggleOnLogoClick } from '../services/babyGhostSound';
import {
  SAMPLE_FAMILY_PHOTOS,
  SAMPLE_FAMILY_GROUPS,
  SAMPLE_FAMILY_THUMB_BASE,
} from '../domains/free_photo_share/SampleSharedRoomExperienceCard';

import {
  PATENTS_FILED,
  OFFICIAL_LAUNCH_LIVE,
  type GhostiShowroomLandingProps,
  type ShortsItem,
  DEFAULT_SHORTS_DATA,
  INTERACTIVE_SCENARIOS,
  QUICK_EMAIL_DOMAINS,
  type SamplePcProgram,
  SAMPLE_PC_PROGRAMS,
  SAMPLE_PC_BASE_PCT,
  SAMPLE_PC_REVIVED_PCT,
  type OnboardingWeaponTab,
  type SafeOnboardingChatMsg,
  WEAPON_META,
  nowTimeStr,
} from './showroom/showroomDataAndUtils';
import { ShowroomLowerSections } from './showroom/ShowroomLowerSections';

export { PATENTS_FILED, OFFICIAL_LAUNCH_LIVE, type ShortsItem } from './showroom/showroomDataAndUtils';

export const GhostiShowroomLanding: React.FC<GhostiShowroomLandingProps> = ({
  onEnterWorkspace,
  isDevAuthorized = false,
}) => {
  const { user, isLoggedIn, refreshSession } = useHub();
  const { status: otpStatus, sendOtp, verifyOtp, formatTimer, error: otpError, reset: resetOtp } = useHubAuth();

  // 출시 모드 상태 및 개발자 전체보기(DEV) 스위치
  const [isLaunched, setIsLaunched] = useState<boolean>(OFFICIAL_LAUNCH_LIVE);
  const [devFullView, setDevFullView] = useState<boolean>(false);

  // 본 앱(👻 귀신비서 방)에서 구경하러 나온 유저인지 감지하여 왕복 복귀 버튼 제공
  // ⚠️ [출시 전 잠금 철칙]: `?view=showroom`은 루트 접속 시 히스토리 라우터가 자동으로 붙이는 파라미터이므로
  //    복귀 버튼 노출 근거로 쓰면 첫 방문자에게도 버튼이 보이고 forceAllow로 개발 워크스페이스 잠금이 뚫립니다.
  //    오직 ① 본 앱에서 [온보딩 구경하기]로 나온 세션 플래그 또는 ② 개발자 권한(isDevAuthorized)일 때만 노출합니다.
  const [canReturnToWorkspace] = useState<boolean>(() => {
    try {
      if (sessionStorage.getItem('ghosti_entered_showroom_from_app') === '1') return true;
      return Boolean(isDevAuthorized);
    } catch {
      return Boolean(isDevAuthorized);
    }
  });

  const [shortsList, setShortsList] = useState<ShortsItem[]>(DEFAULT_SHORTS_DATA);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'video' | 'doc' | 'clean'>('all');
  const [activeShortsModal, setActiveShortsModal] = useState<ShortsItem | null>(null);

  // 공식 보증서 모달 상태 & B2B 영업 유입(?from=b2b / #work-share) 직통 포커싱 상태
  const [certModalOpen, setCertModalOpen] = useState<boolean>(false);
  const [b2bFocused, setB2bFocused] = useState<boolean>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return (
        params.get('from') === 'b2b' ||
        /[?&]from=b2b\b/i.test(window.location.href) ||
        window.location.hash === '#work-share'
      );
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const syncB2bFocus = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const isB2b =
          params.get('from') === 'b2b' ||
          /[?&]from=b2b\b/i.test(window.location.href) ||
          window.location.hash === '#work-share';
        if (isB2b) {
          setB2bFocused(true);
          // [SSOT v2.2 ③] 중간으로 강제 스크롤하지 않고 최상단 B2B 전용 요약 뷰를 우선 노출
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      } catch {
        // ignore
      }
    };
    syncB2bFocus();
    window.addEventListener('hashchange', syncB2bFocus);
    window.addEventListener('popstate', syncB2bFocus);
    return () => {
      window.removeEventListener('hashchange', syncB2bFocus);
      window.removeEventListener('popstate', syncB2bFocus);
    };
  }, []);

  // 좌측 귀신비서 채팅창 ⇄ 우측 단일 인터랙티브 체험 스테이지 상태 (100% 독립 안전 상태)
  const [demoTab, setDemoTab] = useState<OnboardingWeaponTab>('video');
  const [showStageShortVideo, setShowStageShortVideo] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<SafeOnboardingChatMsg[]>(() => [
    {
      id: 'init-welcome',
      role: 'secretary',
      text: '반가워요. 『귀신비서』 안내 창입니다.\n아래 기능 카드를 선택하시면 오른쪽 화면에서 가입이나 설치 없이 바로 체험해 보실 수 있습니다.',
      timestamp: nowTimeStr(),
    },
  ]);
  const [chatInput, setChatInput] = useState<string>('');
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // 우측 단일 스테이지 내부 시뮬레이터 상태
  const [selectedVideoScenarioIdx, setSelectedVideoScenarioIdx] = useState(0);
  const [videoOcrExtracted, setVideoOcrExtracted] = useState(false);
  const [selectedDocScenarioIdx, setSelectedDocScenarioIdx] = useState(0);
  const [cleanDemoDone, setCleanDemoDone] = useState(false);

  // [샘플 체험 A] 귀신비서 샘플 PC 살려보기: 0 대기 → 1 진단 → 2 재우기 → 3 은행 접속(필요한 것만 기상) → 4 원상복구
  const [cleanSubTab, setCleanSubTab] = useState<'speed' | 'photo'>('speed');
  const [speedStep, setSpeedStep] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [sleptCount, setSleptCount] = useState<number>(0);
  const sleepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // [샘플 체험 B] 사진공유 샘플 가족방: 0 카톡 만료 공감 → 1 초대 링크로 가족방 입장 → 2 사진 원본 받기 비교
  const [shareStep, setShareStep] = useState<0 | 1 | 2>(0);
  const [shareGroupKey, setShareGroupKey] = useState<'summer2024' | 'outing2026'>('summer2024');
  const [sharePickedPhoto, setSharePickedPhoto] = useState<string | null>(null);
  const [shareUploadHint, setShareUploadHint] = useState<boolean>(false);

  useEffect(() => {
    return () => {
      if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
    };
  }, []);

  const runSpeedDiagnose = () => {
    playBabyGhostChime();
    if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
    setSleptCount(0);
    setSpeedStep(1);
    const ts = nowTimeStr();
    setChatMessages((prev) => [
      ...prev.slice(-6),
      {
        id: `s-diag-${Date.now()}`,
        role: 'secretary',
        text: '진단이 완료되었어요. 백그라운드 보안프로그램 8개 영향으로 본래 속도의 약 61% 수준으로 동작 중입니다. 이어서 [절전 전환하기]를 눌러보세요.',
        timestamp: ts,
      },
    ]);
  };

  const runSpeedSleep = () => {
    playBabyGhostChime();
    if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
    setSpeedStep(2);
    setSleptCount(0);
    let n = 0;
    sleepTimerRef.current = setInterval(() => {
      n += 1;
      setSleptCount(n);
      if (n >= SAMPLE_PC_PROGRAMS.length && sleepTimerRef.current) {
        clearInterval(sleepTimerRef.current);
        sleepTimerRef.current = null;
      }
    }, 140);
    const ts = nowTimeStr();
    setChatMessages((prev) => [
      ...prev.slice(-6),
      {
        id: `s-sleep-${Date.now()}`,
        role: 'secretary',
        text: '프로그램을 삭제하지 않고 8개 모두 절전 모드로 전환해 속도가 61%에서 93%로 회복되었어요. 이제 [은행 사이트 열어보기]를 눌러보세요.',
        timestamp: ts,
      },
    ]);
  };

  const runSpeedBankOpen = () => {
    playBabyGhostChime();
    if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
    setSleptCount(SAMPLE_PC_PROGRAMS.length);
    setSpeedStep(3);
    const ts = nowTimeStr();
    setChatMessages((prev) => [
      ...prev.slice(-6),
      {
        id: `s-bank-${Date.now()}`,
        role: 'secretary',
        text: '은행 사이트에 접속하면 필요한 보안 모듈 2개만 자동으로 실행되고(속도 85%), 나머지 6개는 절전 상태를 유지합니다. 마지막으로 [원래대로 복원]을 눌러보세요.',
        timestamp: ts,
      },
    ]);
  };

  const runSpeedRestore = () => {
    playBabyGhostChime();
    if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
    setSleptCount(0);
    setSpeedStep(4);
    const ts = nowTimeStr();
    setChatMessages((prev) => [
      ...prev.slice(-6),
      {
        id: `s-restore-${Date.now()}`,
        role: 'secretary',
        text: '처음 상태(61%)로 그대로 복원되었어요. 삭제된 프로그램 없이 언제든 이전 설정으로 되돌릴 수 있습니다.',
        timestamp: ts,
      },
    ]);
  };

  // DEV 전체보기 전용 내부 상태 보존 (코드 삭제 없이 일반 방문자에게만 은닉)
  const {
    trialScanPermissions,
    setTrialScanPermission,
    pcAgentPairedMobile,
    setPcAgentPairedMobile,
    merlinAuth,
    isStoreAppMode,
  } = useSaySeeStore();
  const [telemetryEnabled, setTelemetryEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ghosti_telemetry_enabled') !== 'false';
    } catch {
      return true;
    }
  });
  const [showTermsClause, setShowTermsClause] = useState(false);
  const isCompactH1Slot = React.useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('h1') === 'compact';
  }, []);

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
  const [isChangingEmail, setIsChangingEmail] = useState(false);
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

  const handleSelectWeaponChip = (tab: OnboardingWeaponTab, scrollToDemo = false) => {
    playBabyGhostChime();
    setDemoTab(tab);
    setShowStageShortVideo(false);
    if (tab === 'clean') {
      setCleanSubTab('speed');
    }
    if (tab === 'share') {
      setShareStep(0);
      setSharePickedPhoto(null);
      setShareUploadHint(false);
    }
    const meta = WEAPON_META[tab];
    const ts = nowTimeStr();
    setChatMessages((prev) => [
      ...prev.slice(-6),
      { id: `u-${Date.now()}`, role: 'user', text: meta.userBubble, timestamp: ts },
      { id: `s-${Date.now() + 1}`, role: 'secretary', text: meta.secretaryReply, timestamp: ts },
    ]);
    if (scrollToDemo) {
      document.getElementById('interactive-demo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleChatFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = chatInput.trim();
    if (!q) return;
    setChatInput('');
    playBabyGhostChime();
    const ts = nowTimeStr();

    // 4대 무료 코어(영상 글자·장면 / 문서·영수증 / PC·사진 정리 / 가족·모임 사진공유) 키워드 정밀 매칭
    let matchedTab: OnboardingWeaponTab | null = null;
    let customReply: string | null = null;

    if (
      /영수증|사업자|엑셀|xlsx|문서|계약서|지체상금|부가세|환급|세금계산서|정산|단가|pdf|한글|hwp|본문|직독/i.test(
        q,
      ) &&
      !/라벨러|파일명|합본/.test(q)
    ) {
      matchedTab = 'doc';
      if (/영수증|사업자/.test(q)) {
        setSelectedDocScenarioIdx(2);
        customReply =
          '촬영해 둔 영수증 사진을 하나씩 열어보실 필요 없어요.\n오른쪽 화면에 [영수증 사업자번호] 인식 결과를 표시해 두었습니다. 상호명·사업자번호·결제금액을 바로 확인해 보세요.';
      } else if (/부가세|환급|정산|엑셀|xlsx|세금/i.test(q)) {
        setSelectedDocScenarioIdx(1);
      } else if (/계약서|지체상금|pdf/i.test(q)) {
        setSelectedDocScenarioIdx(0);
      }
    } else if (/영상|동영상|걸음마|대사|장면|점프|타임라인|고기상|노을|휴가|비디오|mp4|mov|글자\s*뽑기|자막/i.test(q)) {
      matchedTab = 'video';
      if (/고기|맛집|식당/.test(q)) setSelectedVideoScenarioIdx(1);
      else if (/노을|바다|휴가|가족사진/.test(q)) setSelectedVideoScenarioIdx(2);
      else setSelectedVideoScenarioIdx(0);
    } else if (/공유|가족방|가족\s*사진|모임|동창|카톡|만료|원본|앨범|초대/i.test(q)) {
      matchedTab = 'share';
      setShareStep(0);
      setSharePickedPhoto(null);
      setShareUploadHint(false);
    } else if (/사진|연사|인생샷|청소|보안|백신|느려|용량|정리|복원|휴지통|효도|캐시|속도|재우/i.test(q)) {
      matchedTab = 'clean';
      if (/사진|연사|인생샷|휴지통/.test(q)) {
        setCleanSubTab('photo');
      } else {
        setCleanSubTab('speed');
      }
    } else if (/무료|가격|유료|보증서|기업|회사|라이선스|결제/.test(q)) {
      customReply =
        '개인 PC와 민간 기업 사내 PC 모두 기본 기능(귀신비서 · 귀신검색 · 사진 공유)을 별도 비용 없이 사용하실 수 있어요.\n상단 [무료 사용 확인서] 버튼에서 공식 확인서를 열람하실 수 있습니다.';
    }

    if (matchedTab) {
      setDemoTab(matchedTab);
      setShowStageShortVideo(false);
      const replyText = customReply || WEAPON_META[matchedTab].secretaryReply;
      setChatMessages((prev) => [
        ...prev.slice(-6),
        { id: `u-${Date.now()}`, role: 'user', text: q, timestamp: ts },
        { id: `s-${Date.now() + 1}`, role: 'secretary', text: replyText, timestamp: ts },
      ]);
      return;
    }

    if (customReply) {
      setChatMessages((prev) => [
        ...prev.slice(-6),
        { id: `u-${Date.now()}`, role: 'user', text: q, timestamp: ts },
        { id: `s-${Date.now() + 1}`, role: 'secretary', text: customReply, timestamp: ts },
      ]);
      return;
    }

    // 4대 초능력과 무관한 일상 질문(예: 오늘 점심, 날씨 알려줘 등) 입력 시 친절한 역할 안내 문구 출력
    const guideReply =
      `이 화면은 PC·모바일 주요 기능을 미리 살펴보는 『귀신비서』 체험 창이에요.\n` +
      `아래 카드를 선택하시거나 「영상 글자」, 「영수증 찾기」, 「PC 속도」, 「가족 사진 공유」처럼 궁금한 기능을 입력해 주세요.`;

    setChatMessages((prev) => [
      ...prev.slice(-6),
      { id: `u-${Date.now()}`, role: 'user', text: q, timestamp: ts },
      { id: `s-${Date.now() + 1}`, role: 'secretary', text: guideReply, timestamp: ts },
    ]);
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
      clearGhostiLogoutLock();
      try {
        localStorage.setItem('ghosti_prelaunch_verified_email', cleanEmail);
        localStorage.setItem('userEmail', cleanEmail);
        localStorage.setItem('ghosti_onboarding_seen_v1', 'true');
      } catch {}
      setLocalVerifiedEmail(cleanEmail);
      setIsChangingEmail(false);
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
    <div
      style={{ overflowX: 'clip' }}
      className="min-h-screen bg-[#FBFBFA] text-slate-900 font-sans selection:bg-slate-200 selection:text-slate-900 relative"
    >
      <style>{`
        html, body { overscroll-behavior-y: auto !important; }
      `}</style>

      {/* 상단 GNB */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 shrink-0">
            <div
              data-ghosti-brand-logo="true"
              className="flex items-center gap-2.5 cursor-pointer shrink-0"
              onClick={() => {
                silencePendingEnterGiggleOnLogoClick();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              <img
                src="/gwisinkachi_app_icon_512.png"
                alt="귀신같이 아이콘"
                className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0"
              />
              <img
                src="/gwisinkachi_wordmark_dark_ink.png"
                alt="귀신같이 로고"
                className="h-6 w-auto object-contain shrink-0"
              />
            </div>
            <span className="hidden xl:inline-flex items-center px-2.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-600 text-[12px] font-medium whitespace-nowrap">
              개인 · 민간 기업 기본 기능 무료
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-1.5 text-[13px] font-medium whitespace-nowrap shrink-0">
            <button
              type="button"
              onClick={() =>
                document.getElementById('interactive-demo')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
              className="px-3 py-1.5 rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
            >
              기능 체험
            </button>
            {!isStoreAppMode && (
              <button
                type="button"
                onClick={() => {
                  setB2bFocused(true);
                  document.getElementById('extensions')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="px-3 py-1.5 rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
              >
                기기 · 업무 플랜
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                document.getElementById('shorts')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
              className="px-3 py-1.5 rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
            >
              미리보기 영상
            </button>
            <button
              type="button"
              onClick={() =>
                document.getElementById('manifesto')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
              className="px-3 py-1.5 rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
            >
              서비스 소개
            </button>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            {canReturnToWorkspace && (
              <button
                type="button"
                onClick={() => onEnterWorkspace(true)}
                title="워크스페이스로 돌아가기"
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-[12.5px] font-medium transition-colors cursor-pointer whitespace-nowrap"
              >
                <span className="hidden sm:inline">귀신비서로 돌아가기 →</span>
                <span className="sm:hidden">{isStoreAppMode ? '앱으로 →' : '돌아가기 →'}</span>
              </button>
            )}

            {!isLaunched ? (
              verifiedUserEmail ? (
                <div className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 text-[12px] font-medium flex items-center gap-1.5 whitespace-nowrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="max-w-[90px] sm:max-w-[150px] truncate">{verifiedUserEmail}</span>
                  <span className="hidden sm:inline text-slate-500">예약됨</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={scrollToEmailBox}
                  className={`${canReturnToWorkspace ? 'hidden sm:flex' : 'flex'} px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[12.5px] sm:text-[13px] font-medium transition-colors cursor-pointer items-center whitespace-nowrap`}
                >
                  <span className="sm:hidden">알림 신청</span>
                  <span className="hidden sm:inline">출시 알림 신청</span>
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={() => onEnterWorkspace(true)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[13px] font-medium transition-colors cursor-pointer whitespace-nowrap"
              >
                시작하기
              </button>
            )}

            {isDevAuthorized && (
              <div className="hidden xl:flex items-center gap-1.5 pl-2 border-l border-slate-200">
                <button
                  type="button"
                  onClick={() => setDevFullView((v) => !v)}
                  className={`px-2.5 py-1 rounded-md text-[11.5px] font-medium border transition-colors cursor-pointer ${
                    devFullView
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  DEV {devFullView ? 'ON' : 'OFF'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsLaunched(!isLaunched)}
                  className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-[11.5px] font-medium transition-colors cursor-pointer"
                >
                  {isLaunched ? '출시후 뷰' : '출시전 뷰'}
                </button>
              </div>
            )}
          </div>
        </div>

        <nav className="md:hidden max-w-6xl mx-auto px-4 pb-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar text-[12px] font-medium whitespace-nowrap">
          <button
            type="button"
            onClick={() =>
              document.getElementById('interactive-demo')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
            className="px-2.5 py-1 rounded-md bg-slate-900 text-white cursor-pointer shrink-0"
          >
            기능 체험
          </button>
          {!isStoreAppMode && (
            <button
              type="button"
              onClick={() => {
                setB2bFocused(true);
                document.getElementById('extensions')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200 cursor-pointer shrink-0"
            >
              기기 · 업무 플랜
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              document.getElementById('shorts')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
            className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200 cursor-pointer shrink-0"
          >
            미리보기 영상
          </button>
          <button
            type="button"
            onClick={() =>
              document.getElementById('manifesto')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
            className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200 cursor-pointer shrink-0"
          >
            서비스 소개
          </button>
        </nav>
      </header>

      {/* 메인 섹션 */}
      <section className="pt-8 pb-14 px-4 sm:px-6 max-w-6xl mx-auto space-y-8">
        {b2bFocused && !isStoreAppMode && (
          <div className="rounded-2xl bg-white border border-slate-300 p-6 sm:p-8 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center px-3 py-1 rounded-md bg-slate-100 border border-slate-200 text-slate-700 text-[12px] font-medium">
                기업 · 사무실 안내 · 대표 1인 정액제 (월 9,900원~ · 30일 무료체험)
              </span>
              <button
                type="button"
                onClick={() => setB2bFocused(false)}
                className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 text-[12px] font-medium cursor-pointer"
              >
                개인용 소개로 보기 ✕
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
              <div className="lg:col-span-8 space-y-2">
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-snug break-keep">
                  사내 문서와 현장 사진을 공용 폴더(S: 드라이브) 하나로 관리하세요
                </h2>
                <p className="text-[14px] text-slate-600 leading-relaxed break-keep">
                  별도 서버 장비 구축 없이 사내 대표 PC 폴더를 팀 공용 드라이브(S:)로 연결해 문서를 함께 검색하고 열람합니다(소호 ~5인 월 9,900원~ · 인당 추가 과금 없음).
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1 text-[12px] font-medium text-slate-700">
                  <span className="px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200">암호화 연결 및 권한 회수</span>
                  <span className="px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200">휴지통 복원 및 예비 백업</span>
                  <span className="px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200">법인 세금계산서 발행</span>
                </div>
              </div>
              <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-2">
                <button
                  type="button"
                  onClick={() => (isLaunched ? onEnterWorkspace(true) : scrollToEmailBox())}
                  className="w-full px-5 py-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium text-[13.5px] transition-colors cursor-pointer"
                >
                  {isLaunched ? '팀 공용 폴더 시작하기' : '출시 알림 신청하기'}
                </button>
                <button
                  type="button"
                  onClick={() => setCertModalOpen(true)}
                  className="w-full px-4 py-2.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-medium text-[13px] transition-colors cursor-pointer"
                >
                  기업 기본 기능 무료 확인서 보기
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 심플 히어로 배너 */}
        <div className="rounded-2xl bg-white border border-slate-200 p-6 sm:p-10 shadow-xs">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-5">
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-[12px] font-medium">
                기기 내 로컬 정리 · 본문 및 장면 통합 검색
              </span>

              <div className="space-y-2.5">
                <h1 className="text-2xl sm:text-4xl font-bold tracking-tight leading-[1.25] text-slate-900 break-keep">
                  {isCompactH1Slot
                    ? 'PC · 스마트폰 정리와 문서 · 사진 내용 검색을 한곳에서'
                    : '열지 않고 찾고, 안심하고 정리하는 내 기기 관리 도구'}
                </h1>

                <p className="text-[15px] sm:text-[16px] text-slate-600 leading-relaxed break-keep max-w-2xl">
                  무거워진 백그라운드 보안 모듈을 절전 모드로 전환하고, 파일 이름을 기억하지 못해도 문서 본문과 사진·동영상 장면으로 필요한 자료를 바로 찾습니다.
                </p>
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      isLaunched
                        ? onEnterWorkspace(true)
                        : document
                            .getElementById('interactive-demo')
                            ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }
                    className="px-5 py-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium text-[14px] transition-colors cursor-pointer"
                  >
                    {isLaunched ? '바로 시작하기' : '가입 없이 샘플 체험하기'}
                  </button>
                  {!isLaunched && !verifiedUserEmail && (
                    <button
                      type="button"
                      onClick={scrollToEmailBox}
                      className="px-4 py-3 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-medium text-[13.5px] transition-colors cursor-pointer"
                    >
                      출시 알림 신청
                    </button>
                  )}
                </div>
                <p className="text-[12.5px] text-slate-500 break-keep">
                  원본 파일 외부 업로드 없음 · 광고 없음 · 단일 기기 기본 기능 무료
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                {[
                  {
                    key: 'secretary',
                    tab: 'clean' as OnboardingWeaponTab,
                    stat: '상태 점검 · 복원',
                    title: '귀신비서',
                    sub: '보안모듈 절전 · 중복 사진 정리',
                  },
                  {
                    key: 'search',
                    tab: 'video' as OnboardingWeaponTab,
                    stat: '본문 · 장면 검색',
                    title: '귀신검색',
                    sub: 'Ctrl+0으로 문서와 영상 바로 찾기',
                  },
                  {
                    key: 'share',
                    tab: 'share' as OnboardingWeaponTab,
                    stat: '원본 화질 공유',
                    title: '사진 공유',
                    sub: '가족 · 동호회 · 동창회 공유방',
                  },
                ].map((card) => {
                  const active =
                    card.key === 'search'
                      ? demoTab === 'video' || demoTab === 'doc'
                      : card.key === 'share'
                      ? demoTab === 'share'
                      : demoTab === 'clean';
                  return (
                    <button
                      key={card.key}
                      type="button"
                      onClick={() => handleSelectWeaponChip(card.tab, true)}
                      className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                        active
                          ? 'bg-slate-900 border-slate-900 text-white'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-900'
                      }`}
                    >
                      <div className={`text-[11.5px] font-medium mb-0.5 ${active ? 'text-slate-300' : 'text-slate-500'}`}>
                        {card.stat}
                      </div>
                      <div className="text-[14px] font-semibold">{card.title}</div>
                      <div className={`text-[12px] line-clamp-2 break-keep leading-snug mt-0.5 ${active ? 'text-slate-200' : 'text-slate-600'}`}>
                        {card.sub}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-5 flex flex-col items-center">
              <div
                onClick={() => handleSelectWeaponChip('video', true)}
                className="w-full max-w-md rounded-xl overflow-hidden border border-slate-200 bg-slate-50 shadow-xs cursor-pointer group"
              >
                <img
                  src="/gwisinkachi_hero_banner_neon_after.jpg"
                  alt="귀신같이 대표 이미지"
                  className="w-full h-auto object-cover group-hover:scale-[1.01] transition-transform duration-300"
                />
                <div className="px-4 py-2.5 bg-white border-t border-slate-200 flex items-center justify-between gap-2 text-[12.5px]">
                  <span className="font-semibold text-slate-800">귀신비서 · 귀신검색</span>
                  <span className="text-slate-500 font-medium whitespace-nowrap">아래에서 샘플 체험 →</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2단 체험 영역 */}
        <div id="interactive-demo" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* 좌측 대화 안내 */}
          <aside className="lg:col-span-5 flex flex-col rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="px-4 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src="/gwisinkachi_app_icon_512.png"
                  alt="귀신비서 아이콘"
                  className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[14px] font-semibold text-slate-900">귀신비서</span>
                    <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[11px] font-medium text-slate-600">
                      체험 안내
                    </span>
                  </div>
                  <p className="text-[11.5px] text-slate-500 truncate">
                    기기 내 로컬 처리 · 휴지통 복원 지원
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCertModalOpen(true)}
                className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-medium text-[11.5px] shrink-0 cursor-pointer whitespace-nowrap"
              >
                무료 확인서
              </button>
            </div>

            <div
              ref={chatScrollRef}
              className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-[220px] max-h-[300px] bg-white"
            >
              {chatMessages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 px-1 text-[11.5px] text-slate-400">
                      {isUser ? (
                        <>
                          <span>{msg.timestamp}</span>
                          <span className="font-medium text-slate-600">나</span>
                        </>
                      ) : (
                        <>
                          <span className="font-semibold text-slate-700">귀신비서</span>
                          <span>{msg.timestamp}</span>
                        </>
                      )}
                    </div>
                    <div
                      className={`max-w-[92%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-line break-keep ${
                        isUser
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-50 border border-slate-200 text-slate-800'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-3.5 bg-slate-50 border-t border-slate-200 space-y-2">
              <div className="text-[12px] font-medium text-slate-500 flex items-center justify-between px-0.5">
                <span>체험할 기능을 선택하세요</span>
                <span>우측 화면 연동</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(['video', 'doc', 'clean', 'share'] as OnboardingWeaponTab[]).map((tabKey) => {
                  const item = WEAPON_META[tabKey];
                  const isActive = demoTab === tabKey;
                  return (
                    <button
                      key={tabKey}
                      type="button"
                      onClick={() => handleSelectWeaponChip(tabKey)}
                      className={`p-3 rounded-xl border text-left transition-colors cursor-pointer flex flex-col justify-between gap-1 ${
                        isActive
                          ? 'bg-slate-900 border-slate-900 text-white'
                          : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-900'
                      }`}
                    >
                      <span
                        className={`inline-block w-fit px-1.5 py-0.5 rounded text-[10.5px] font-medium ${
                          isActive ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {item.keywordBadge}
                      </span>
                      <div className="text-[13px] font-semibold break-keep leading-snug mt-0.5">
                        {item.chipLabel}
                      </div>
                      <div className={`text-[11.5px] break-keep leading-snug ${isActive ? 'text-slate-300' : 'text-slate-500'}`}>
                        {item.chipSub}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <form
              onSubmit={handleChatFormSubmit}
              className="px-3.5 py-3 border-t border-slate-200 bg-white flex items-center gap-2"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="궁금한 기능 입력 (예: 영상 검색, 영수증 찾기, 사진 공유)"
                className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-white border border-slate-300 focus:border-slate-900 text-[13px] text-slate-900 placeholder-slate-400 outline-none"
              />
              <button
                type="submit"
                className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium text-[13px] shrink-0 cursor-pointer transition-colors"
              >
                전송
              </button>
            </form>
          </aside>

          {/* 우측 체험 스테이지 */}
          <div className="lg:col-span-7 flex flex-col justify-between rounded-2xl bg-white border border-slate-200 p-5 sm:p-7 shadow-xs space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
              <div>
                <span className="inline-block px-2.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-600 text-[12px] font-medium mb-1">
                  {activeMeta.stageBadge}
                </span>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 break-keep">
                  {activeMeta.stageTitle}
                </h2>
              </div>

              {activeMeta.shortVideoUrl && (
                <button
                  type="button"
                  onClick={() => setShowStageShortVideo((v) => !v)}
                  className={`px-3.5 py-2 rounded-lg text-[12.5px] font-medium border transition-colors cursor-pointer flex items-center gap-1.5 ${
                    showStageShortVideo
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  <span>▶</span>
                  <span>{showStageShortVideo ? '체험 화면으로 돌아가기' : '미리보기 영상 재생'}</span>
                </button>
              )}
            </div>

            {showStageShortVideo && activeMeta.shortVideoUrl ? (
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 flex flex-col sm:flex-row items-center gap-5">
                <div
                  data-keep-dark="true"
                  className="w-48 sm:w-52 aspect-[9/16] rounded-lg overflow-hidden bg-black border border-slate-200 shrink-0"
                >
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
                  <span className="inline-block px-2.5 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 text-[12px] font-medium">
                    미리보기 영상 · {activeMeta.keywordBadge}
                  </span>
                  <h3 className="text-[16px] font-semibold text-slate-900 leading-snug break-keep">
                    {activeMeta.stageTitle}
                  </h3>
                  <p className="text-[13px] text-slate-600 leading-relaxed break-keep">
                    원본 파일을 외부 서버로 업로드하지 않고 내 PC와 스마트폰 안에서 바로 동작합니다.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowStageShortVideo(false)}
                    className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium text-[13px] cursor-pointer transition-colors"
                  >
                    직접 눌러서 체험하기 →
                  </button>
                </div>
              </div>
            ) : (
              <div>
                {/* ① 동영상 검색 */}
                {demoTab === 'video' && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[12.5px] font-medium text-slate-500 mr-1">
                        찾을 장면 선택:
                      </span>
                      {INTERACTIVE_SCENARIOS.video.map((item, idx) => {
                        const active = selectedVideoScenarioIdx === idx;
                        return (
                          <button
                            key={item.query}
                            type="button"
                            onClick={() => {
                              playBabyGhostChime();
                              setSelectedVideoScenarioIdx(idx);
                              setVideoOcrExtracted(false);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-[12.5px] font-medium border transition-colors cursor-pointer ${
                              active
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                            }`}
                          >
                            “{item.query}”
                          </button>
                        );
                      })}
                    </div>

                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 sm:p-5 space-y-4">
                      <div className="flex items-center justify-between gap-2 text-[12.5px] pb-2.5 border-b border-slate-200">
                        <span className="text-slate-800 font-medium truncate">
                          {INTERACTIVE_SCENARIOS.video[selectedVideoScenarioIdx].file}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600 text-[11.5px] font-medium shrink-0">
                          {INTERACTIVE_SCENARIOS.video[selectedVideoScenarioIdx].latency}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                        <div
                          data-keep-dark="true"
                          className="sm:col-span-5 relative aspect-[16/10] rounded-lg overflow-hidden border border-slate-200 bg-black"
                        >
                          <img
                            src={INTERACTIVE_SCENARIOS.video[selectedVideoScenarioIdx].thumbUrl}
                            alt={INTERACTIVE_SCENARIOS.video[selectedVideoScenarioIdx].query}
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/75 text-white text-[11px] font-medium">
                            ▶ {INTERACTIVE_SCENARIOS.video[selectedVideoScenarioIdx].timestamp} 구간
                          </span>
                        </div>

                        <div className="sm:col-span-7 space-y-2.5">
                          <div className="rounded-lg bg-white p-3.5 border border-slate-200 space-y-1">
                            <div className="text-[11.5px] font-medium text-slate-500">
                              음성 · 장면 매칭 결과
                            </div>
                            <p className="text-slate-900 font-semibold text-[14px] leading-snug break-keep">
                              {INTERACTIVE_SCENARIOS.video[selectedVideoScenarioIdx].transcript}
                            </p>
                            <p className="text-[12.5px] text-slate-600 break-keep">
                              {INTERACTIVE_SCENARIOS.video[selectedVideoScenarioIdx].sceneDesc}
                            </p>
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between text-[11.5px] font-mono text-slate-500">
                              <span>00:00</span>
                              <span className="text-slate-900 font-semibold">
                                {INTERACTIVE_SCENARIOS.video[selectedVideoScenarioIdx].timestamp}
                              </span>
                              <span>END</span>
                            </div>
                            <div className="relative h-2 rounded-full bg-slate-200 overflow-hidden">
                              <div
                                style={{
                                  width: `${INTERACTIVE_SCENARIOS.video[selectedVideoScenarioIdx].progressPct}%`,
                                }}
                                className="h-full rounded-full bg-slate-900 transition-all duration-300"
                              />
                            </div>
                          </div>

                          <div className="rounded-lg bg-white p-3 border border-slate-200 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-[12.5px] font-medium text-slate-700">
                                영상 화면 속 글자 인식
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  playBabyGhostChime();
                                  setVideoOcrExtracted((prev) => !prev);
                                }}
                                className={`px-2.5 py-1 rounded-md text-[12px] font-medium cursor-pointer transition-colors whitespace-nowrap ${
                                  videoOcrExtracted
                                    ? 'bg-slate-200 text-slate-800'
                                    : 'bg-slate-900 text-white hover:bg-slate-800'
                                }`}
                              >
                                {videoOcrExtracted ? '✓ 추출 텍스트 확인됨' : '화면 글자 보기'}
                              </button>
                            </div>
                            {videoOcrExtracted && (
                              <div className="rounded-md bg-slate-50 border border-slate-200 p-2.5 text-[12px] text-slate-700 font-mono space-y-1">
                                {INTERACTIVE_SCENARIOS.video[selectedVideoScenarioIdx].screenOcrLines.map((ln, lIdx) => (
                                  <div key={lIdx}>{ln}</div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ② 문서 검색 */}
                {demoTab === 'doc' && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[12.5px] font-medium text-slate-500 mr-1">
                        찾을 키워드 선택:
                      </span>
                      {INTERACTIVE_SCENARIOS.doc.map((item, idx) => {
                        const active = selectedDocScenarioIdx === idx;
                        return (
                          <button
                            key={item.query}
                            type="button"
                            onClick={() => {
                              playBabyGhostChime();
                              setSelectedDocScenarioIdx(idx);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-[12.5px] font-medium border transition-colors cursor-pointer ${
                              active
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                            }`}
                          >
                            “{item.query}”
                          </button>
                        );
                      })}
                    </div>

                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 sm:p-5 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px] pb-2.5 border-b border-slate-200">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-medium text-[11px] shrink-0">
                            {INTERACTIVE_SCENARIOS.doc[selectedDocScenarioIdx].docType}
                          </span>
                          <span className="text-slate-800 font-medium truncate">
                            {INTERACTIVE_SCENARIOS.doc[selectedDocScenarioIdx].file}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600 text-[11.5px] font-medium shrink-0">
                          {INTERACTIVE_SCENARIOS.doc[selectedDocScenarioIdx].latency}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                        <div className="sm:col-span-4 rounded-lg bg-white border border-slate-200 p-3 flex flex-col items-center justify-center min-h-[132px]">
                          {INTERACTIVE_SCENARIOS.doc[selectedDocScenarioIdx].thumbUrl ? (
                            <img
                              src={INTERACTIVE_SCENARIOS.doc[selectedDocScenarioIdx].thumbUrl}
                              alt="영수증 미리보기"
                              className="w-full h-28 object-cover rounded border border-slate-200"
                            />
                          ) : (
                            <div className="w-full space-y-1.5 text-left text-[12px]">
                              <div className="text-slate-500 font-medium">문서 내부 일치 구간</div>
                              <div className="p-2 rounded bg-slate-50 border border-slate-200 text-slate-400 truncate">
                                상단 조항 생략
                              </div>
                              <div className="p-2 rounded bg-slate-900 text-white font-semibold truncate">
                                {INTERACTIVE_SCENARIOS.doc[selectedDocScenarioIdx].highlightKey}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="sm:col-span-8 space-y-2">
                          <span className="inline-block px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 text-[12px] font-medium">
                            위치: {INTERACTIVE_SCENARIOS.doc[selectedDocScenarioIdx].location}
                          </span>
                          <p className="text-slate-800 font-medium text-[13.5px] leading-relaxed p-3.5 rounded-lg bg-white border border-slate-200 break-keep">
                            {INTERACTIVE_SCENARIOS.doc[selectedDocScenarioIdx].previewSnippet}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ③ 귀신비서 샘플 체험 */}
                {demoTab === 'clean' && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(
                        [
                          { key: 'speed' as const, label: 'PC 상태 점검 · 절전' },
                          { key: 'photo' as const, label: '연사 사진 선별 · 복원' },
                        ]
                      ).map((st) => {
                        const on = cleanSubTab === st.key;
                        return (
                          <button
                            key={st.key}
                            type="button"
                            onClick={() => {
                              playBabyGhostChime();
                              setCleanSubTab(st.key);
                            }}
                            className={`px-3.5 py-1.5 rounded-lg text-[12.5px] font-medium border transition-colors cursor-pointer ${
                              on
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                            }`}
                          >
                            {st.label}
                          </button>
                        );
                      })}
                      <span className="text-[11.5px] text-slate-400 ml-auto">샘플 시뮬레이션 (실제 PC 설정 미변경)</span>
                    </div>

                    {cleanSubTab === 'speed' && (() => {
                      const total = SAMPLE_PC_PROGRAMS.length;
                      const neededCount = SAMPLE_PC_PROGRAMS.filter((p) => p.neededForBank).length;
                      const totalMemGb = (SAMPLE_PC_PROGRAMS.reduce((s, p) => s + p.memMb, 0) / 1024).toFixed(1);
                      const isAsleep = (p: SamplePcProgram, idx: number) => {
                        if (speedStep === 2) return idx < sleptCount;
                        if (speedStep === 3) return !p.neededForBank;
                        return false;
                      };
                      const sleepingNow = SAMPLE_PC_PROGRAMS.filter((p, i) => isAsleep(p, i)).length;
                      const gaugePct =
                        speedStep === 0
                          ? null
                          : Math.round(SAMPLE_PC_BASE_PCT + ((SAMPLE_PC_REVIVED_PCT - SAMPLE_PC_BASE_PCT) * sleepingNow) / total);
                      const deletedCount = 0;
                      const stepMsg =
                        speedStep === 0
                          ? '아래 [상태 진단] 버튼을 눌러 샘플 PC에서 상주 중인 보안 모듈을 확인해 보세요.'
                          : speedStep === 1
                          ? `상주 보안프로그램 ${total}개가 메모리 ${totalMemGb}GB를 점유하고 있습니다. 삭제하지 않고 절전 상태로 전환해 보세요.`
                          : speedStep === 2
                          ? sleptCount < total
                            ? '절전 전환 중입니다. 프로그램 파일은 그대로 유지됩니다.'
                            : `${total}개 항목을 모두 절전 전환했습니다. 은행 접속 시 어떻게 동작하는지 확인해 보세요.`
                          : speedStep === 3
                          ? `은행 사이트 접속에 필요한 ${neededCount}개만 자동으로 깨어나고 나머지는 절전 상태를 유지합니다.`
                          : '처음 상태 그대로 복원되었습니다. 언제든 원래 설정으로 되돌릴 수 있습니다.';
                      return (
                        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 sm:p-5 space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="space-y-0.5">
                              <div className="text-[13.5px] font-semibold text-slate-900">샘플 PC · 사무용 노트북</div>
                              <div className="text-[12px] text-slate-500 break-keep">
                                실제 PC 진단은 앱 내 『귀신비서』에서 『내 컴퓨터 연결』 후 진행됩니다
                              </div>
                            </div>
                            <div className="min-w-[180px] flex-1 max-w-[240px] space-y-1">
                              <div className="flex items-center justify-between text-[12px] font-medium">
                                <span className="text-slate-600">가용 성능 비율</span>
                                <span className="font-semibold text-slate-900">
                                  {gaugePct === null ? '진단 전' : `${gaugePct}%`}
                                </span>
                              </div>
                              <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                                <div
                                  style={{ width: `${gaugePct ?? 0}%` }}
                                  className="h-full rounded-full bg-slate-900 transition-all duration-300"
                                />
                              </div>
                            </div>
                          </div>

                          {speedStep > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {SAMPLE_PC_PROGRAMS.map((p, idx) => {
                                const asleep = isAsleep(p, idx);
                                const wokeForBank = speedStep === 3 && p.neededForBank;
                                return (
                                  <div
                                    key={p.id}
                                    className={`rounded-lg px-3 py-2 flex items-center justify-between gap-2 text-[12.5px] border transition-all ${
                                      asleep
                                        ? 'bg-white/60 border-slate-200 text-slate-400'
                                        : wokeForBank
                                        ? 'bg-white border-slate-900 text-slate-900'
                                        : 'bg-white border-slate-200 text-slate-800'
                                    }`}
                                  >
                                    <span className="font-medium truncate">{p.name}</span>
                                    <span className="text-[11.5px] font-medium shrink-0">
                                      {asleep ? '절전 중' : wokeForBank ? '실행됨' : `${p.memMb}MB 상주`}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          <div className="rounded-lg bg-white border border-slate-200 px-3.5 py-2.5 text-[12.5px] text-slate-700 leading-relaxed break-keep">
                            {stepMsg}
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {[
                              { label: '1. 상태 진단', onClick: runSpeedDiagnose, enabled: true, active: speedStep === 0 || speedStep === 4 },
                              { label: '2. 절전 전환하기', onClick: runSpeedSleep, enabled: speedStep >= 1, active: speedStep === 1 },
                              { label: '3. 은행 사이트 열어보기', onClick: runSpeedBankOpen, enabled: speedStep >= 2, active: speedStep === 2 && sleptCount >= total },
                              { label: '4. 원래대로 복원', onClick: runSpeedRestore, enabled: speedStep >= 2 && speedStep !== 4, active: speedStep === 3 },
                            ].map((b) => (
                              <button
                                key={b.label}
                                type="button"
                                disabled={!b.enabled}
                                onClick={b.onClick}
                                className={`px-3 py-1.5 rounded-lg text-[12.5px] font-medium border transition-colors ${
                                  !b.enabled
                                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                    : b.active
                                    ? 'bg-slate-900 text-white border-slate-900 cursor-pointer'
                                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 cursor-pointer'
                                }`}
                              >
                                {b.label}
                              </button>
                            ))}
                          </div>

                          <div className="flex flex-wrap gap-1.5 text-[11.5px] text-slate-600">
                            <span className="px-2.5 py-1 rounded-md bg-white border border-slate-200">
                              임의 프로그램 삭제 없음 (삭제 {deletedCount}개)
                            </span>
                            <span className="px-2.5 py-1 rounded-md bg-white border border-slate-200">
                              선택 항목만 적용
                            </span>
                            <span className="px-2.5 py-1 rounded-md bg-white border border-slate-200">
                              언제든 이전 설정 복원
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    {cleanSubTab === 'photo' && (
                      <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 sm:p-5 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-0.5">
                            <h4 className="text-[14.5px] font-semibold text-slate-900 break-keep">
                              연속 촬영 6장 중 선명한 원본 1장 남기기
                            </h4>
                            <p className="text-[12.5px] text-slate-500 break-keep">
                              나머지 흔들린 사진 5장은 영구 삭제하지 않고 OS 기본 휴지통으로 이동합니다.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              playBabyGhostChime();
                              setCleanDemoDone(!cleanDemoDone);
                            }}
                            className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium text-[12.5px] transition-colors cursor-pointer shrink-0"
                          >
                            {cleanDemoDone ? '휴지통에서 복원하기' : '선명한 1장만 남기고 정리 체험'}
                          </button>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                          {[
                            {
                              id: 1,
                              label: '연사 #1 · 흔들림',
                              img: '/sample_photos_301/BLUR_202510_1282_흔들린사진.jpg',
                              imgClass: '',
                              best: false,
                            },
                            {
                              id: 2,
                              label: '연사 #2 · 어두움',
                              img: '/sample_photos_301/IMG_20250510_1001.jpg',
                              imgClass: 'brightness-50 contrast-75',
                              best: false,
                            },
                            {
                              id: 3,
                              label: '추천 원본',
                              img: '/sample_photos_301/IMG_20250510_1002.jpg',
                              imgClass: 'brightness-105',
                              best: true,
                            },
                            {
                              id: 4,
                              label: '연사 #4 · 초점 흐림',
                              img: '/sample_photos_301/BLUR_202510_1283_흔들린사진.jpg',
                              imgClass: '',
                              best: false,
                            },
                            {
                              id: 5,
                              label: '연사 #5 · 구도 흔들림',
                              img: '/sample_photos_301/IMG_20250510_1003.jpg',
                              imgClass: 'blur-[2px] scale-105',
                              best: false,
                            },
                            {
                              id: 6,
                              label: '연사 #6 · 빛 번짐',
                              img: '/sample_photos_301/BLUR_202510_1282_흔들린사진.jpg',
                              imgClass: 'brightness-125',
                              best: false,
                            },
                          ].map((shot) => {
                            const isMovedToTrash = cleanDemoDone && !shot.best;
                            return (
                              <div
                                key={shot.id}
                                className={`relative rounded-lg overflow-hidden border bg-white transition-all ${
                                  shot.best
                                    ? 'border-2 border-slate-900'
                                    : isMovedToTrash
                                    ? 'border-slate-200 opacity-40 grayscale'
                                    : 'border-slate-200'
                                }`}
                              >
                                <div className="relative aspect-[16/10] w-full overflow-hidden">
                                  <img
                                    src={shot.img}
                                    alt={shot.label}
                                    className={`w-full h-full object-cover ${shot.imgClass}`}
                                  />
                                  {shot.best && (
                                    <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-slate-900 text-white text-[10.5px] font-medium">
                                      보존
                                    </span>
                                  )}
                                </div>
                                <div className="px-2 py-1.5 text-center text-[11.5px] font-medium text-slate-700 bg-white border-t border-slate-100">
                                  {isMovedToTrash ? '휴지통 이동됨' : shot.label}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ④ 사진 공유 샘플 체험 */}
                {demoTab === 'share' && (() => {
                  const group = SAMPLE_FAMILY_GROUPS.find((g) => g.key === shareGroupKey) || SAMPLE_FAMILY_GROUPS[0];
                  const katalkSample = SAMPLE_FAMILY_PHOTOS.slice(0, 3);
                  return (
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 sm:p-5 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-[13.5px] font-semibold text-slate-900">
                          가족 · 모임 공유방 안내
                        </div>
                        <span className="text-[11.5px] text-slate-500">만료 없는 원본 공유 앨범</span>
                      </div>

                      {shareStep === 0 && (
                        <div className="space-y-3">
                          <div className="rounded-xl bg-white border border-slate-200 p-4 space-y-2.5">
                            <div className="text-[12.5px] font-semibold text-slate-800">
                              일반 메신저 대화방의 사진 만료 · 화질 저하 문제
                            </div>
                            {katalkSample.length > 0 ? (
                              <div className="grid grid-cols-3 gap-2">
                                {katalkSample.map((p) => (
                                  <div key={p} className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                                    <img
                                      src={`${SAMPLE_FAMILY_THUMB_BASE}${p}`}
                                      alt="만료된 사진 예시"
                                      className="w-full h-full object-cover blur-xs grayscale opacity-60"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center p-1.5 text-center">
                                      <span className="text-[11px] font-medium text-slate-800 bg-white/90 rounded px-1.5 py-0.5">
                                        기간 만료
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[12.5px] text-slate-600 leading-relaxed">
                                메신저로 주고받은 사진은 일정 기간이 지나면 다운로드 기간이 만료되거나 해상도가 압축되어 원본 보관이 어렵습니다.
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              playBabyGhostChime();
                              setShareStep(1);
                            }}
                            className="w-full px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium text-[13px] cursor-pointer transition-colors"
                          >
                            공유방 비교 안내 보기 →
                          </button>
                        </div>
                      )}

                      {shareStep >= 1 && (
                        <div className="space-y-3">
                          {group && group.photos.length > 0 && shareStep === 1 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {group.photos.map((p) => (
                                <button
                                  key={p}
                                  type="button"
                                  onClick={() => {
                                    playBabyGhostChime();
                                    setSharePickedPhoto(p);
                                    setShareStep(2);
                                  }}
                                  className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 hover:border-slate-400 transition-colors cursor-pointer"
                                >
                                  <img
                                    src={`${SAMPLE_FAMILY_THUMB_BASE}${p}`}
                                    alt="샘플 사진"
                                    loading="lazy"
                                    className="w-full h-full object-cover"
                                  />
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px] break-keep">
                              <div className="rounded-lg bg-white p-4 border border-slate-200 space-y-1.5">
                                <div className="font-semibold text-slate-700">일반 메신저 대화방</div>
                                <div className="text-slate-500 text-[12.5px] leading-relaxed">
                                  · 전송 시 화질 압축<br />
                                  · 일정 기간 경과 후 만료<br />
                                  · 예전 사진을 인물·상황으로 찾기 어려움
                                </div>
                              </div>
                              <div className="rounded-lg bg-white p-4 border border-slate-900 space-y-1.5">
                                <div className="font-semibold text-slate-900">귀신같이 사진 공유방</div>
                                <div className="text-slate-700 text-[12.5px] leading-relaxed">
                                  · 원본 해상도 그대로 보관<br />
                                  · 초대 링크로 간편 합류<br />
                                  · 날짜·인물·장면별 빠른 검색 지원
                                </div>
                              </div>
                            </div>
                          )}

                          {shareUploadHint && (
                            <div className="rounded-lg bg-white border border-slate-200 px-3.5 py-3 text-[12.5px] text-slate-700 leading-relaxed break-keep">
                              사진 공유방 개설과 업로드는 귀신같이 워크스페이스 내 『사진 공유』 메뉴에서 무료로 이용하실 수 있습니다.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* 하단 사전등록 / 시작 박스 */}
            <div ref={heroCtaRef} className="pt-4 border-t border-slate-200">
              {!isLaunched ? (
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 sm:p-5">
                  {verifiedUserEmail && !isChangingEmail ? (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="text-[13.5px] font-semibold text-slate-900">
                          {dbSyncStatus === 'syncing'
                            ? '알림 예약 등록 중...'
                            : `✓ ${verifiedUserEmail} 님, 출시 알림 신청이 완료되었습니다`}
                        </div>
                        <p className="text-[12.5px] text-slate-500 mt-0.5 break-keep">
                          정식 오픈 시 이메일로 시작 링크를 보내드립니다.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setCertModalOpen(true)}
                          className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-medium text-[12.5px] cursor-pointer"
                        >
                          무료 확인서 열기
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            try {
                              localStorage.removeItem('ghosti_prelaunch_verified_email');
                            } catch {}
                            setLocalVerifiedEmail('');
                            setIsChangingEmail(true);
                            setEmailInput('');
                            resetOtp();
                            setTimeout(() => emailInputRef.current?.focus(), 60);
                          }}
                          className="px-2 py-1.5 text-[12.5px] text-slate-500 hover:text-slate-900 underline cursor-pointer"
                        >
                          이메일 변경
                        </button>
                      </div>
                    </div>
                  ) : otpStatus === 'sent' || otpStatus === 'verifying' ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[13px] font-medium text-slate-800 min-w-0 break-keep">
                          <span className="font-semibold break-all">{emailInput.trim().toLowerCase()}</span>로 발송된 인증번호 6자리를 입력해 주세요.
                        </span>
                        <span className="px-2.5 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 text-[12px] font-mono font-medium shrink-0">
                          {formatTimer()}
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
                            className="w-10 h-11 sm:w-11 sm:h-12 rounded-lg bg-white border border-slate-300 focus:border-slate-900 text-center text-lg font-semibold text-slate-900 outline-none"
                          />
                        ))}
                      </div>
                      {otpError && <p className="text-[12.5px] text-rose-600 font-medium text-center">{otpError}</p>}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={otpStatus === 'verifying' || otpDigits.join('').length < 6}
                          onClick={() => void handleVerifyOtpCode(otpDigits.join(''))}
                          className="flex-1 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium text-[13px] cursor-pointer disabled:opacity-50 transition-colors"
                        >
                          {otpStatus === 'verifying' ? '인증 확인 중...' : '인증 완료 및 출시 알림 등록'}
                        </button>
                        <button
                          type="button"
                          onClick={() => resetOtp()}
                          className="px-3 py-2.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-[12.5px] font-medium cursor-pointer"
                        >
                          다시 입력
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleRequestEmailVerification} className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span className="text-[13.5px] font-semibold text-slate-900">
                          정식 오픈 시 이메일로 시작 안내 받기
                        </span>
                        <span className="text-[12px] text-slate-500">
                          오픈 당일 시작 링크 1회 발송
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
                          className="flex-1 px-3.5 py-2.5 rounded-lg bg-white border border-slate-300 focus:border-slate-900 text-slate-900 placeholder-slate-400 text-[13px] outline-none"
                        />
                        <button
                          type="submit"
                          disabled={otpStatus === 'sending'}
                          className="px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium text-[13px] shrink-0 cursor-pointer transition-colors"
                        >
                          {otpStatus === 'sending' ? '발송 중...' : '출시 알림 신청'}
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-slate-500">
                        <span>도메인 선택:</span>
                        {QUICK_EMAIL_DOMAINS.map((domain) => (
                          <button
                            key={domain}
                            type="button"
                            onClick={() => applyQuickDomain(domain)}
                            className="px-2 py-0.5 rounded bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 font-mono text-[11.5px] cursor-pointer"
                          >
                            {domain}
                          </button>
                        ))}
                      </div>
                      {(formNotice || otpError) && (
                        <p className="text-[12.5px] text-rose-600 font-medium">{formNotice || otpError}</p>
                      )}
                    </form>
                  )}
                </div>
              ) : (
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <div className="text-[14px] font-semibold text-slate-900 mb-0.5">
                      정식 배포 오픈 — 지금 바로 시작하세요
                    </div>
                    <p className="text-[12.5px] text-slate-500 break-keep">
                      별도 카드 등록 없이 웹에서 바로 시작하거나 Windows PC 엔진을 내려받을 수 있습니다.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onEnterWorkspace(true)}
                      className="px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium text-[13px] cursor-pointer transition-colors"
                    >
                      웹 앱 시작하기 →
                    </button>
                    <a
                      href="/Merlin_Z_Core.zip"
                      download="Merlin_Z_Core.zip"
                      className="px-3.5 py-2.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-medium text-[13px] transition-colors"
                    >
                      PC 엔진 다운로드
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 개발자 전용 패널 */}
        {isDevAuthorized && devFullView && (
          <div className="mt-6 rounded-2xl bg-white border border-slate-300 p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
              <span className="px-2.5 py-0.5 rounded-md bg-slate-900 text-white text-[11.5px] font-medium">
                DEV 전체보기 ON (개발자 · QA 전용 점검 영역)
              </span>
              <span className="text-[12px] text-slate-500">
                폴더 권한 및 Z-코어 연결 테스트
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex flex-col gap-2 flex-1">
                <div className="text-[13px] font-semibold text-slate-900">
                  로컬 검진 구역 및 Z-코어 설치파일
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[12px] text-slate-700">
                  <label className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={trialScanPermissions.gallery}
                      onChange={(e) => setTrialScanPermission('gallery', e.target.checked)}
                      className="accent-slate-900"
                    />
                    <span>사진첩(갤러리)</span>
                  </label>
                  <label className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={trialScanPermissions.downloads}
                      onChange={(e) => setTrialScanPermission('downloads', e.target.checked)}
                      className="accent-slate-900"
                    />
                    <span>다운로드 폴더</span>
                  </label>
                  <label className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={trialScanPermissions.desktop}
                      onChange={(e) => setTrialScanPermission('desktop', e.target.checked)}
                      className="accent-slate-900"
                    />
                    <span>바탕화면 폴더</span>
                  </label>
                  <a
                    href={Z_CORE_ZIP_URL}
                    download="Merlin_Z_Core.zip"
                    className="px-3 py-1.5 rounded-lg bg-slate-900 text-white font-medium text-[12px]"
                  >
                    PC Z-코어 다운로드 (v{LATEST_Z_CORE_VERSION})
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 bg-white p-2.5 rounded-xl border border-slate-200">
                <img
                  src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=6&data=https%3A%2F%2Fghosti.sundreamer.app"
                  alt="스마트폰 연결 QR 코드"
                  className="w-14 h-14 rounded-lg bg-white border border-slate-100 p-1 shrink-0"
                />
                <div className="flex flex-col gap-1">
                  <span className="text-[12.5px] font-semibold text-slate-900">스마트폰 QR 연결</span>
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
                    className="text-left text-[12px] text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
                  >
                    {merlinAuth?.email && merlinAuth.userId !== 'guest' && pcAgentPairedMobile
                      ? '✓ 내 폰 연결됨'
                      : merlinAuth?.email && merlinAuth.userId !== 'guest'
                      ? '연결 상태 전환'
                      : '로그인하기'}
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
              <label className="flex items-center gap-2 text-slate-700 cursor-pointer select-none">
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
                  className="w-4 h-4 accent-slate-900 rounded"
                />
                <span>익명 오류 통계 전송 (원본 파일 미수집)</span>
              </label>
              <button
                type="button"
                onClick={() => setShowTermsClause((v) => !v)}
                className="text-slate-600 hover:text-slate-900 underline cursor-pointer"
              >
                {showTermsClause ? '약관 접기' : '약관 보기'}
              </button>
            </div>
          </div>
        )}
      </section>

      <ShowroomLowerSections
        shortsList={shortsList}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        filteredShorts={filteredShorts}
        activeShortsModal={activeShortsModal}
        setActiveShortsModal={setActiveShortsModal}
        certModalOpen={certModalOpen}
        setCertModalOpen={setCertModalOpen}
        isStoreAppMode={isStoreAppMode}
        b2bFocused={b2bFocused}
        verifiedUserEmail={verifiedUserEmail}
        scrollToEmailBox={scrollToEmailBox}
      />
    </div>
  );
};
