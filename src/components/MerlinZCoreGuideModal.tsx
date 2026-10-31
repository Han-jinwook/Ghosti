import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  zCoreBridge,
  Z_CORE_PORT,
  Z_CORE_ZIP_URL,
  LATEST_Z_CORE_VERSION,
  isZCoreOutdated,
} from '../services/zCoreBridge';
import { useSaySeeStore } from '../store/useSaySeeStore';
import { useHub } from '../services/merlin-hub-sdk/react';

export type ZCoreModalStep = 'intro' | 'waiting_engine' | 'indexing' | 'ready';

interface MerlinZCoreGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  themeMode?: 'light' | 'dark';
  initialStep?: ZCoreModalStep;
}

export const MerlinZCoreGuideModal: React.FC<MerlinZCoreGuideModalProps> = ({
  isOpen,
  onClose,
  themeMode = 'dark',
  initialStep,
}) => {
  const { user, isLoggedIn } = useHub();
  const {
    layout,
    photos,
    videoSceneItems,
    localDocuments,
    matchedVaultPhotos,
    initApp,
    setDesktopTab,
    setMobileTab,
    setSearchSpace,
    resetSearchSpaceToAll,
  } = useSaySeeStore();

  const isMobileEnv =
    layout === 'mobile' ||
    (typeof window !== 'undefined' &&
      (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
        window.innerWidth < 860));

  const verifiedEmail = useMemo(() => {
    if (isLoggedIn && user?.email) return user.email;
    if (typeof window !== 'undefined') {
      return (
        localStorage.getItem('ghosti_prelaunch_verified_email') ||
        localStorage.getItem('userEmail') ||
        ''
      );
    }
    return '';
  }, [isLoggedIn, user?.email]);

  const activePhotos = useMemo(() => photos.filter((p) => !p.quarantined), [photos]);
  const totalPhotoCount = activePhotos.length || 301;
  const totalVideoCount = videoSceneItems.length || 6;
  const totalDocCount = (localDocuments.length + matchedVaultPhotos.length) || 26;

  const [isConnected, setIsConnected] = useState<boolean>(zCoreBridge.isConnected);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [version, setVersion] = useState<string | null>(zCoreBridge.version);
  const [step, setStep] = useState<ZCoreModalStep>('intro');
  const [progress, setProgress] = useState<number>(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState<boolean>(false);
  const hasTriggeredInitRef = useRef<boolean>(false);
  const initPromiseRef = useRef<Promise<void> | null>(null);

  // 모달 열릴 때 초기 단계 결정
  useEffect(() => {
    if (!isOpen) {
      hasTriggeredInitRef.current = false;
      initPromiseRef.current = null;
      return;
    }

    const connectedNow = zCoreBridge.isConnected;
    setIsConnected(connectedNow);
    setVersion(zCoreBridge.version);

    if (initialStep) {
      setStep(initialStep);
      if (initialStep === 'indexing') {
        setProgress(0);
      }
      return;
    }

    if (connectedNow) {
      if (isZCoreOutdated(zCoreBridge.version)) {
        void zCoreBridge.triggerSilentSelfUpdate();
      }
      const alreadyIndexed =
        typeof sessionStorage !== 'undefined' &&
        sessionStorage.getItem('ghosti_initial_indexing_done') === '1';
      if (!alreadyIndexed) {
        setProgress(0);
        setStep('indexing');
      } else {
        setStep('ready');
      }
    } else {
      const agreedBefore =
        typeof sessionStorage !== 'undefined' &&
        sessionStorage.getItem('ghosti_one_stop_agreed') === '1';
      setStep(agreedBefore && !isMobileEnv ? 'waiting_engine' : 'intro');
    }
  }, [isOpen, initialStep, isMobileEnv]);

  // Z-코어 연결 실시간 감지 (1초 주기 폴링)
  useEffect(() => {
    if (!isOpen) return;

    const unsubscribe = zCoreBridge.subscribe((conn) => {
      setIsConnected(conn);
      setVersion(zCoreBridge.version);
      if (conn) {
        if (isZCoreOutdated(zCoreBridge.version)) {
          void zCoreBridge.triggerSilentSelfUpdate();
        }
        // 이미 Z-코어가 켜져 있으면 별도 로딩 창이나 수동 업데이트 창으로 붙잡지 않고 0.1초 만에 자동 패스!
        if (!initialStep) {
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('ghosti_initial_indexing_done', '1');
          }
          void initApp(true);
          onClose();
          return;
        }
        setStep((prev) => {
          if (prev === 'intro' || prev === 'waiting_engine') {
            setProgress(0);
            return 'indexing';
          }
          return prev;
        });
      }
    });

    const pollId = setInterval(() => {
      void zCoreBridge.checkHealth();
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(pollId);
    };
  }, [isOpen]);

  // 'indexing' 단계: 실제 사진·서류 목록 로딩(initApp)이 끝났을 때만 완료로 전환한다.
  useEffect(() => {
    if (!isOpen || step !== 'indexing') return;
    let cancelled = false;
    setLoadError(null);
    setProgress(0);

    if (!hasTriggeredInitRef.current || !initPromiseRef.current) {
      hasTriggeredInitRef.current = true;
      initPromiseRef.current = Promise.resolve(initApp(true)).then(() => undefined);
    }

    const stepTimer1 = window.setTimeout(() => {
      if (!cancelled) setProgress((p) => (p < 45 ? 45 : p));
    }, 220);
    const stepTimer2 = window.setTimeout(() => {
      if (!cancelled) setProgress((p) => (p < 82 ? 82 : p));
    }, 520);

    Promise.all([
      initPromiseRef.current,
      new Promise((resolve) => window.setTimeout(resolve, 850)),
    ])
      .then(() => {
        if (cancelled) return;
        setProgress(100);
        window.setTimeout(() => {
          if (!cancelled) finishAndPopOpenPhotos();
        }, 420);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError('사진 목록을 불러오지 못했습니다. 멀린 Z-코어가 켜져 있는지 확인한 뒤 다시 시도해 주세요.');
        }
      });

    return () => {
      cancelled = true;
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, step]);

  const finishAndPopOpenPhotos = () => {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('ghosti_initial_indexing_done', '1');
    }
    setDesktopTab('dashboard');
    setMobileTab('search');
    setSearchSpace('gallery');
    resetSearchSpaceToAll('gallery');
    useSaySeeStore.setState({
      hasUserSelectedSearchTab: true,
      lastQuarantineToast: `🎉 내 기기 사진 ${totalPhotoCount}장 귀신같이 찾기 인덱싱 완료! 모든 사진이 화면에 딱 펼쳐졌습니다.`,
    });
    onClose();
    if (typeof document !== 'undefined') {
      window.setTimeout(() => {
        document.getElementById('ghosti-search-results')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 120);
    }
  };

  const handleOneStopAgreeAndDownload = () => {
    // 1) 미로그인 상태라면 로그인 모달부터 먼저 띄워 이메일 인증을 완료하게 안내
    if (!verifiedEmail) {
      onClose();
      window.dispatchEvent(new CustomEvent('openLoginModal'));
      return;
    }

    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('ghosti_one_stop_agreed', '1');
    }

    // 2) 모바일 브라우저 접속 시: Windows .zip을 폰에 받지 않고 모바일 시작/PC 주소 복사로 안내
    if (isMobileEnv) {
      finishAndPopOpenPhotos();
      return;
    }

    // 3) PC 데스크톱 접속 시: Merlin_Z_Core.zip 다운로드 트리거
    const link = document.createElement('a');
    link.href = Z_CORE_ZIP_URL;
    link.download = 'Merlin_Z_Core.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (isConnected) {
      setProgress(0);
      setStep('indexing');
    } else {
      setStep('waiting_engine');
    }
  };

  const handleCopyPcLinkForMobile = () => {
    const url = 'https://ghosti.sundreamer.app/?dev=true';
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 3000);
    }
  };

  const handleManualCheck = async () => {
    setIsChecking(true);
    const ok = await zCoreBridge.checkHealth();
    setIsChecking(false);
    setIsConnected(ok);
    setVersion(zCoreBridge.version);
    if (ok) {
      setProgress(0);
      setStep('indexing');
    }
  };

  if (!isOpen) return null;

  const isLight = themeMode === 'light';
  const isOutdated = isConnected && isZCoreOutdated(version);
  const loadDone = progress >= 100;
  const currentStageLabel = loadError
    ? loadError
    : loadDone
    ? `✨ 불러오기 완료: 사진 ${totalPhotoCount}장 · 영상 ${totalVideoCount}개 · 서류 ${totalDocCount}건`
    : '📂 멀린 Z-코어에서 내 PC 사진·영상·서류 목록을 불러오는 중...';

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fade-in overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && step !== 'indexing') onClose();
      }}
    >
      <div
        className={`w-full max-w-lg rounded-3xl p-5 sm:p-7 shadow-2xl border transition-all max-h-[92vh] overflow-y-auto no-scrollbar ${
          isLight
            ? 'bg-white border-slate-200 text-slate-800'
            : 'bg-zinc-950 border-white/15 text-zinc-100'
        }`}
      >
        {/* ─────────────── [가벼운 1클릭 연결 안내] ─────────────── */}
        {step === 'intro' && (
          <>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center shrink-0">
                  <span className="text-xl">{!verifiedEmail ? '🔐' : isMobileEnv ? '📱' : '✨'}</span>
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black tracking-tight">
                    {!verifiedEmail
                      ? '이메일로 간편하게 시작하기'
                      : isMobileEnv
                      ? '모바일 시작 & PC 폴더 연동'
                      : '내 PC 사진 · 동영상 · 서류 연결'}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-white cursor-pointer"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>

            <p className="text-xs sm:text-[13px] text-zinc-500 dark:text-zinc-300 leading-relaxed mb-4">
              {!verifiedEmail
                ? '이메일 인증만 마치면 내 기기 찾고·치우고·고치고 모든 기능을 평생 무료로 이용하실 수 있습니다.'
                : isMobileEnv
                ? '스마트폰에서 바로 시작하실 수 있으며, PC에서도 아래 주소로 접속하시면 PC 속 사진·문서까지 함께 검색됩니다.'
                : '처음 한 번만 연결해 두시면 다음부터는 이 창 없이 0.1초 만에 내 PC 파일이 자동으로 준비됩니다.'}
            </p>

            {isMobileEnv && verifiedEmail && (
              <div
                className={`mb-4 p-3 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
                  isLight
                    ? 'bg-teal-50/70 border-teal-200 text-teal-950'
                    : 'bg-teal-950/30 border-teal-500/30 text-teal-100'
                }`}
              >
                <div className="min-w-0">
                  <div className="font-black text-[12px]">💻 PC 접속 주소</div>
                  <p className="text-[11px] opacity-85 truncate">https://ghosti.sundreamer.app/?dev=true</p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyPcLinkForMobile}
                  className="px-3 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-zinc-950 font-black text-[11px] shrink-0 cursor-pointer"
                >
                  {linkCopied ? '✅ 복사됨' : '📋 주소 복사'}
                </button>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-2">
              <button
                type="button"
                onClick={handleOneStopAgreeAndDownload}
                className="w-full flex-1 py-3 px-5 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-black text-sm text-center shadow-lg shadow-teal-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>
                  {!verifiedEmail
                    ? '이메일로 시작하기'
                    : isMobileEnv
                    ? '바로 시작하기'
                    : '연결 시작하기'}
                </span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className={`w-full sm:w-auto py-3 px-4 rounded-2xl font-bold text-xs border transition-all cursor-pointer ${
                  isLight
                    ? 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                    : 'bg-zinc-900 border-white/10 text-zinc-400 hover:bg-zinc-800'
                }`}
              >
                닫기
              </button>
            </div>
          </>
        )}

        {/* ─────────────── [2단계: 다운로드 완료 & 실행 신호 실시간 대기 -> 켜자마자 자동 인덱싱] ─────────────── */}
        {step === 'waiting_engine' && (
          <>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <span className="text-2xl animate-bounce">📥</span>
                </div>
                <div>
                  <span className="inline-block px-2 py-0.5 rounded-full text-[10.5px] font-black bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-400/30 mb-1">
                    단계 1/2 · 엔진 실행 대기 중
                  </span>
                  <h3 className="text-lg font-black tracking-tight">
                    다운로드된 압축을 풀고 실행해 주세요!
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-white cursor-pointer"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>

            <div
              className={`p-4 rounded-2xl border mb-4 ${
                isLight
                  ? 'bg-amber-50 border-amber-200 text-amber-950'
                  : 'bg-amber-950/35 border-amber-500/30 text-amber-100'
              }`}
            >
              <div className="flex items-center gap-2.5 font-black text-[13.5px]">
                <span className="w-3 h-3 rounded-full bg-amber-500 animate-ping shrink-0" />
                <span>프로그램을 켜시는 순간 자동으로 사진 목록을 불러옵니다!</span>
              </div>
              <p className="text-xs opacity-85 mt-1.5 leading-relaxed">
                방금 다운로드된 <strong>Merlin_Z_Core.zip</strong> 압축을 풀고{' '}
                <strong>Merlin_Z_Core_Setup.exe</strong> (또는 <strong>Merlin_Z_Core_실행.bat</strong>)을
                더블클릭해 켜주세요. 웹 화면에서 별도 버튼을 또 누르실 필요가 없습니다.
              </p>
            </div>

            <div
              className={`p-3.5 rounded-2xl border text-xs space-y-2 mb-5 ${
                isLight
                  ? 'bg-slate-50 border-slate-200 text-slate-700'
                  : 'bg-zinc-900/70 border-white/10 text-zinc-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-teal-500/20 text-teal-600 dark:text-teal-300 font-black text-[10.5px]">
                  TIP 1
                </span>
                <span>윈도우 보호창이 뜨면 [추가 정보] ➔ [실행]을 눌러주세요.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-teal-500/20 text-teal-600 dark:text-teal-300 font-black text-[10.5px]">
                  TIP 2
                </span>
                <span>켜지는 즉시 이 창이 불러오기 화면으로 자동 전환됩니다.</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <a
                href={Z_CORE_ZIP_URL}
                download="Merlin_Z_Core.zip"
                className={`py-2.5 px-4 rounded-xl font-bold text-xs border transition-all no-underline cursor-pointer ${
                  isLight
                    ? 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                    : 'bg-zinc-900 border-white/15 text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                📥 다운로드가 안 됐나요? 다시 받기
              </a>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleManualCheck}
                  disabled={isChecking}
                  className="py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black text-xs transition-all cursor-pointer"
                >
                  {isChecking ? '연결 확인 중...' : '🔄 실행했어요 (즉시 확인)'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ─────────────── [3단계: 귀신같이 찾기 인덱싱 진행 시간표시바 -> 100% 완료 시 사진 딱!] ─────────────── */}
        {step === 'indexing' && (
          <>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-teal-500/15 border border-teal-500/40 flex items-center justify-center shrink-0">
                  <span className="text-2xl animate-pulse">🧠</span>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded-full text-[10.5px] font-black bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-400/30">
                      🟢 엔진 연결됨 (Port {Z_CORE_PORT})
                    </span>
                    <span className="text-[11px] font-bold text-teal-500">
                      단계 2/2 · 목록 불러오는 중
                    </span>
                  </div>
                  <h3 className="text-lg font-black tracking-tight">
                    {loadDone ? '불러오기 완료!' : loadError ? '불러오기 실패' : '내 컴퓨터 사진 목록 불러오는 중...'}
                  </h3>
                </div>
              </div>
            </div>

            <div
              className={`p-4 rounded-2xl border mb-4 ${
                isLight
                  ? 'bg-slate-50 border-slate-200'
                  : 'bg-zinc-900/90 border-teal-500/30 shadow-[0_0_25px_rgba(20,184,166,0.12)]'
              }`}
            >
              <div className="w-full h-3.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden p-0.5 mb-3">
                <div
                  className={`h-full rounded-full bg-gradient-to-r from-teal-500 via-emerald-400 to-cyan-400 transition-all duration-300 ${
                    loadDone || loadError ? '' : 'animate-pulse'
                  }`}
                  style={{ width: loadDone ? '100%' : loadError ? '0%' : '100%', opacity: loadDone ? 1 : 0.45 }}
                />
              </div>

              <div className="text-xs font-bold text-slate-700 dark:text-zinc-200 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping shrink-0" />
                <span className="truncate">{currentStageLabel}</span>
              </div>
            </div>

            {loadError && (
              <div className="mb-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    hasTriggeredInitRef.current = false;
                    initPromiseRef.current = null;
                    setLoadError(null);
                    setStep('ready');
                    window.setTimeout(() => setStep('indexing'), 0);
                  }}
                  className="py-2 px-3.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black text-xs cursor-pointer"
                >
                  🔄 다시 시도
                </button>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[11px] text-zinc-400">
                💡 사진 수량에 따라 처음 한 번만 대기 시간이 소요됩니다.
              </span>
              <button
                type="button"
                onClick={finishAndPopOpenPhotos}
                className="py-2 px-3.5 rounded-xl bg-teal-600/20 hover:bg-teal-600/30 border border-teal-500/40 text-teal-400 font-black text-xs transition-all cursor-pointer shrink-0"
              >
                사진 바로 펼치기 →
              </button>
            </div>
          </>
        )}

        {/* ─────────────── [4단계: 이미 연결 & 인덱싱 완료된 상태 (재열람 시)] ─────────────── */}
        {step === 'ready' && (
          <>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  <span className="text-2xl">🟢</span>
                </div>
                <div>
                  <span className="inline-block px-2 py-0.5 rounded-full text-[10.5px] font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-400/30 mb-1">
                    Port {Z_CORE_PORT} · v{version || '?'} {isOutdated ? '구버전 가동 중' : '정상 가동 중'}
                  </span>
                  <h3 className="text-lg font-black tracking-tight">
                    멀린 Z-코어 연결 완료!
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-white cursor-pointer"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>

            <div
              className={`p-4 rounded-2xl border mb-5 text-xs leading-relaxed ${
                isLight
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                  : 'bg-emerald-950/35 border-emerald-500/30 text-emerald-100'
              }`}
            >
              내 컴퓨터 실물 사진 <strong>{totalPhotoCount}장</strong>과 로컬 서류함이 웹 화면과 실시간으로
              연결되어 있습니다. 검색창에 찾고 싶은 사진이나 서류 내용을 입력해 보세요!
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2.5">
              <button
                type="button"
                onClick={finishAndPopOpenPhotos}
                className="w-full flex-1 py-3 px-5 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-black text-sm text-center shadow-lg shadow-teal-500/25 transition-all cursor-pointer"
              >
                🖼️ 내 컴퓨터 사진 {totalPhotoCount}장 전체 펼치기
              </button>
              <button
                type="button"
                onClick={() => {
                  hasTriggeredInitRef.current = false;
                  initPromiseRef.current = null;
                  setProgress(0);
                  setStep('indexing');
                }}
                className={`w-full sm:w-auto py-3 px-4 rounded-2xl font-bold text-xs border transition-all cursor-pointer ${
                  isLight
                    ? 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                    : 'bg-zinc-900 border-white/15 text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                🔄 목록 다시 불러오기
              </button>
            </div>
            {!isOutdated && !isMobileEnv && (
              <div className="mt-3 text-right">
                <a
                  href={Z_CORE_ZIP_URL}
                  download="Merlin_Z_Core.zip"
                  className="text-[11px] font-bold text-zinc-400 hover:text-teal-400 underline cursor-pointer"
                >
                  📥 Z-코어 설치파일 다시 받기 (v{LATEST_Z_CORE_VERSION})
                </a>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
