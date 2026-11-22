import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  zCoreBridge,
  Z_CORE_ZIP_URL,
  LATEST_Z_CORE_VERSION,
  isZCoreOutdated,
} from '../services/zCoreBridge';
import { useSaySeeStore } from '../store/useSaySeeStore';
import { useHub } from '../services/merlin-hub-sdk/react';

export type ZCoreModalStep = 'intro' | 'waiting_engine' | 'indexing' | 'ready';

export const IS_ZCORE_ARTIFACT_SIGNED = false;

interface MerlinZCoreGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStep?: ZCoreModalStep;
}

export const MerlinZCoreGuideModal: React.FC<MerlinZCoreGuideModalProps> = ({
  isOpen,
  onClose,
  initialStep,
}) => {
  const { user, isLoggedIn } = useHub();
  const {
    layout,
    activeLoungeType,
    desktopTab,
    photos,
    videoSceneItems,
    localDocuments,
    initApp,
    setDesktopTab,
    setMobileTab,
    setSearchSpace,
    resetSearchSpaceToAll,
  } = useSaySeeStore();
  const isInSecretaryTab = activeLoungeType === 'personal' && desktopTab === 'trash';

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
  const galleryScenePhotos = useMemo(
    () =>
      activePhotos.filter(
        (p) =>
          !p.isVaultDocument &&
          p.trashCategory !== 'blurry' &&
          p.trashCategory !== 'screenshot' &&
          p.trashCategory !== 'memo' &&
          p.trashCategory !== 'duplicate'
      ),
    [activePhotos]
  );
  const vaultPhotoCount = useMemo(
    () => activePhotos.filter((p) => p.isVaultDocument).length,
    [activePhotos]
  );
  const totalPhotoCount = galleryScenePhotos.length || activePhotos.length || 0;
  const totalVideoCount = videoSceneItems.length || 0;
  const totalDocCount = (localDocuments.length + vaultPhotoCount) || 0;

  const [isConnected, setIsConnected] = useState<boolean>(zCoreBridge.isConnected);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [version, setVersion] = useState<string | null>(zCoreBridge.version);
  const [step, setStep] = useState<ZCoreModalStep>('intro');
  const [progress, setProgress] = useState<number>(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [manualCheckHint, setManualCheckHint] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState<boolean>(false);
  const hasTriggeredInitRef = useRef<boolean>(false);
  const initPromiseRef = useRef<Promise<void> | null>(null);
  const quietSecretaryHandledRef = useRef<boolean>(false);

  const completeQuietConnectInSecretary = () => {
    if (quietSecretaryHandledRef.current) return;
    quietSecretaryHandledRef.current = true;
    try {
      sessionStorage.setItem('ghosti_one_stop_agreed', '1');
      sessionStorage.setItem('ghosti_initial_indexing_done', '1');
      localStorage.setItem('ghosti_secretary_engine_agreed', '1');
    } catch {
      /* ignore */
    }
    void initApp(true);
    onClose();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ghosti_engine_connected_in_secretary'));
    }
  };

  useEffect(() => {
    if (!isOpen) {
      hasTriggeredInitRef.current = false;
      initPromiseRef.current = null;
      quietSecretaryHandledRef.current = false;
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
      const outdatedNow = isZCoreOutdated(zCoreBridge.version);
      if (outdatedNow) {
        void zCoreBridge.triggerSilentSelfUpdate();
        if (!isMobileEnv) {
          setManualCheckHint(null);
          setStep('ready');
          return;
        }
      }
      const alreadyIndexed =
        typeof sessionStorage !== 'undefined' &&
        sessionStorage.getItem('ghosti_initial_indexing_done') === '1';
      if (isInSecretaryTab && !alreadyIndexed) {
        completeQuietConnectInSecretary();
        return;
      }
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
      void zCoreBridge.checkHealth(true).then((alive) => {
        if (alive) {
          setIsConnected(true);
          setVersion(zCoreBridge.version);
          if (isZCoreOutdated(zCoreBridge.version) && !isMobileEnv) {
            void zCoreBridge.triggerSilentSelfUpdate();
            setManualCheckHint(null);
            setStep('ready');
            return;
          }
          if (isInSecretaryTab) {
            completeQuietConnectInSecretary();
            return;
          }
          setProgress(0);
          setStep('indexing');
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialStep, isMobileEnv, isInSecretaryTab]);

  useEffect(() => {
    if (!isOpen) return;

    const unsubscribe = zCoreBridge.subscribe((conn) => {
      setIsConnected(conn);
      setVersion(zCoreBridge.version);
      if (conn) {
        const outdatedNow = isZCoreOutdated(zCoreBridge.version);
        if (outdatedNow) {
          void zCoreBridge.triggerSilentSelfUpdate();
          if (!isMobileEnv) {
            setStep((prev) => (prev === 'intro' || prev === 'waiting_engine' ? 'ready' : prev));
            return;
          }
        }
        if (isInSecretaryTab) {
          completeQuietConnectInSecretary();
          return;
        }
        setStep((prev) => {
          if (prev === 'intro' || prev === 'waiting_engine') {
            if (prev === 'waiting_engine') {
              useSaySeeStore.setState({
                lastQuarantineToast: 'PC 엔진이 연결되어 파일 목록을 불러옵니다.',
              });
            }
            setProgress(0);
            return 'indexing';
          }
          return prev;
        });
      }
    });

    const pollId = setInterval(() => {
      void zCoreBridge.checkHealth(true);
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(pollId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isInSecretaryTab]);

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
          setLoadError('파일 목록을 불러오지 못했습니다. PC 엔진이 실행 중인지 확인해 주세요.');
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
    try {
      sessionStorage.setItem('ghosti_initial_indexing_done', '1');
      sessionStorage.setItem('ghosti_one_stop_agreed', '1');
      localStorage.setItem('ghosti_secretary_engine_agreed', '1');
    } catch {
      /* ignore */
    }
    if (isInSecretaryTab) {
      completeQuietConnectInSecretary();
      return;
    }
    setDesktopTab('dashboard');
    setMobileTab('search');
    setSearchSpace('gallery');
    resetSearchSpaceToAll('gallery');
    useSaySeeStore.setState({
      hasUserSelectedSearchTab: true,
      lastQuarantineToast:
        totalPhotoCount > 0
          ? `사진 ${totalPhotoCount}장 불러오기 완료`
          : 'PC 연결이 완료되었습니다.',
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

  const handleOneStopAgreeAndDownload = async () => {
    try {
      sessionStorage.setItem('ghosti_one_stop_agreed', '1');
      localStorage.setItem('ghosti_secretary_engine_agreed', '1');
    } catch {
      /* ignore */
    }

    const aliveNow = isConnected || zCoreBridge.isConnected || (await zCoreBridge.checkHealth(true));
    if (aliveNow) {
      setIsConnected(true);
      if (isInSecretaryTab) {
        completeQuietConnectInSecretary();
        return;
      }
      hasTriggeredInitRef.current = false;
      initPromiseRef.current = null;
      setProgress(0);
      setStep('indexing');
      return;
    }

    if (isMobileEnv) {
      finishAndPopOpenPhotos();
      return;
    }

    const link = document.createElement('a');
    link.href = Z_CORE_ZIP_URL;
    link.download = 'Merlin_Z_Core.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setStep('waiting_engine');
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
    setManualCheckHint('PC 엔진 실행 상태를 확인하고 있습니다...');
    let ok = false;
    for (let attempt = 0; attempt < 9; attempt++) {
      ok = await zCoreBridge.checkHealth(true);
      if (ok) break;
      await new Promise((r) => window.setTimeout(r, 900));
    }
    setIsChecking(false);
    setIsConnected(ok);
    setVersion(zCoreBridge.version);
    if (ok) {
      if (isZCoreOutdated(zCoreBridge.version) && !isMobileEnv) {
        setManualCheckHint(
          `이전 버전(v${zCoreBridge.version || '구버전'})이 실행 중입니다. 최신 버전(v${LATEST_Z_CORE_VERSION}) 압축을 풀고 Merlin_Z_Core_Setup.exe를 실행해 주세요.`
        );
        setStep('ready');
        return;
      }
      setManualCheckHint(null);
      if (isInSecretaryTab) {
        completeQuietConnectInSecretary();
        return;
      }
      setProgress(0);
      setStep('indexing');
    } else {
      setManualCheckHint(
        '아직 실행 신호가 확인되지 않았습니다. 다운로드한 Merlin_Z_Core.zip 압축을 풀고 Merlin_Z_Core_Setup.exe를 실행한 뒤 다시 확인해 주세요.'
      );
    }
  };

  if (!isOpen) return null;
  const isOutdated = isConnected && isZCoreOutdated(version);
  const loadDone = progress >= 100;
  const currentStageLabel = loadError
    ? loadError
    : loadDone
    ? `완료: 사진 ${totalPhotoCount}장 · 영상 ${totalVideoCount}개 · 문서 ${totalDocCount}건`
    : '내 PC의 사진·영상·문서 목록을 불러오는 중입니다...';

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 pt-safe pb-safe bg-black/50 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && step !== 'indexing') onClose();
      }}
    >
      {step === 'waiting_engine' && !isMobileEnv && !isConnected && (
        <div
          className="fixed top-4 right-6 z-[140] max-w-sm rounded-xl border border-slate-300 bg-white text-slate-900 px-4 py-3 shadow-xl pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[12.5px] font-semibold text-slate-900 leading-snug">
            브라우저 우측 상단 다운로드 목록에서 압축을 풀고 <code>Merlin_Z_Core_Setup.exe</code>를 실행해 주세요.
          </p>
        </div>
      )}

      <div className="w-full max-w-md rounded-2xl p-5 sm:p-6 shadow-2xl border bg-white border-slate-200 text-slate-900 max-h-[90dvh] overflow-y-auto my-auto">
        {step === 'intro' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[11.5px] font-medium text-slate-500">
                  {isMobileEnv ? '모바일 · PC 연동' : 'PC 엔진 연결'}
                </span>
                <h3 className="text-[18px] font-bold text-slate-900 tracking-tight mt-0.5">
                  {isMobileEnv ? '모바일 시작 및 PC 연결' : '내 컴퓨터 연결하기'}
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 shrink-0 cursor-pointer"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>

            <p className="text-[13px] text-slate-600 leading-relaxed">
              {isMobileEnv
                ? '스마트폰에서 바로 시작할 수 있으며, PC에서도 아래 주소로 접속하면 PC 파일을 함께 검색할 수 있습니다.'
                : '파일을 외부 서버로 보내지 않고 내 컴퓨터 안에서 바로 검색할 수 있도록 로컬 엔진을 연결합니다. 처음 한 번만 실행하면 이후에는 자동으로 연결됩니다.'}
            </p>

            {isMobileEnv && verifiedEmail && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-[12px]">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900">PC 접속 주소</div>
                  <p className="text-slate-500 truncate">https://ghosti.sundreamer.app/?dev=true</p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyPcLinkForMobile}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 text-white font-semibold text-[11.5px] shrink-0 cursor-pointer"
                >
                  {linkCopied ? '복사됨' : '복사'}
                </button>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleOneStopAgreeAndDownload}
                className="flex-1 py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-[13px] text-center cursor-pointer transition-colors"
              >
                {isMobileEnv ? '시작하기' : isConnected ? '파일 목록 확인' : '연결 시작하기'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-4 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-medium text-[13px] cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        )}

        {step === 'waiting_engine' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[11.5px] font-medium text-slate-500">1/2단계 · 실행 대기</span>
                <h3 className="text-[18px] font-bold text-slate-900 tracking-tight mt-0.5">
                  다운로드한 파일을 실행해 주세요
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 cursor-pointer"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-[13px] text-slate-700 space-y-1.5 leading-relaxed">
              <p className="font-semibold text-slate-900">
                1. 다운로드된 <code>Merlin_Z_Core.zip</code> 압축 풀기
              </p>
              <p className="font-semibold text-slate-900">
                2. 폴더 안의 <code>Merlin_Z_Core_Setup.exe</code> 실행
              </p>
              {!IS_ZCORE_ARTIFACT_SIGNED && (
                <p className="text-[12px] text-slate-500 pt-1">
                  Windows 보호 안내가 표시되면 [추가 정보] → [실행]을 선택해 주세요.
                </p>
              )}
            </div>

            {manualCheckHint && (
              <div
                className={`p-3 rounded-lg border text-[12px] leading-relaxed ${
                  isChecking
                    ? 'bg-slate-50 border-slate-200 text-slate-700'
                    : 'bg-rose-50 border-rose-200 text-rose-700'
                }`}
              >
                {manualCheckHint}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <a
                href={Z_CORE_ZIP_URL}
                download="Merlin_Z_Core.zip"
                className="py-2 px-3 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-medium text-[12px] no-underline cursor-pointer"
              >
                다시 다운로드
              </a>

              <button
                type="button"
                onClick={handleManualCheck}
                disabled={isChecking}
                className="py-2 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-[12.5px] cursor-pointer disabled:opacity-50"
              >
                {isChecking ? '확인 중...' : '실행 완료 확인'}
              </button>
            </div>
          </div>
        )}

        {step === 'indexing' && (
          <div className="flex flex-col gap-4">
            <div>
              <span className="text-[11.5px] font-medium text-teal-700">2/2단계 · 연결됨</span>
              <h3 className="text-[18px] font-bold text-slate-900 tracking-tight mt-0.5">
                {loadDone ? '불러오기 완료' : loadError ? '불러오기 실패' : '파일 목록을 불러오는 중'}
              </h3>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
              <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-slate-900 transition-all duration-300"
                  style={{ width: loadDone ? '100%' : loadError ? '0%' : `${Math.max(25, progress)}%` }}
                />
              </div>
              <p className="text-[12.5px] text-slate-600 truncate">{currentStageLabel}</p>
            </div>

            <div className="flex items-center justify-between gap-2">
              {loadError ? (
                <button
                  type="button"
                  onClick={() => {
                    hasTriggeredInitRef.current = false;
                    initPromiseRef.current = null;
                    setLoadError(null);
                    setStep('ready');
                    window.setTimeout(() => setStep('indexing'), 0);
                  }}
                  className="py-2 px-3.5 rounded-lg bg-slate-900 text-white font-semibold text-[12px] cursor-pointer"
                >
                  다시 시도
                </button>
              ) : (
                <span className="text-[11.5px] text-slate-400">잠시만 기다려 주세요.</span>
              )}
              <button
                type="button"
                onClick={finishAndPopOpenPhotos}
                className="py-2 px-3.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-medium text-[12px] cursor-pointer shrink-0"
              >
                바로 열기
              </button>
            </div>
          </div>
        )}

        {step === 'ready' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[11.5px] font-medium text-slate-500">
                  PC 엔진 v{version || '?'} {isOutdated ? `(최신 v${LATEST_Z_CORE_VERSION})` : '연결됨'}
                </span>
                <h3 className="text-[18px] font-bold text-slate-900 tracking-tight mt-0.5">
                  {isOutdated ? 'PC 엔진 업데이트가 필요합니다' : '내 컴퓨터 연결됨'}
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 cursor-pointer"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>

            {isOutdated ? (
              <>
                <p className="text-[13px] text-slate-600 leading-relaxed">
                  현재 구버전(v{version || '구버전'})이 실행 중입니다. 최신 버전(v{LATEST_Z_CORE_VERSION})을 내려받아 압축을 풀고 <code>Merlin_Z_Core_Setup.exe</code>를 실행해 주세요.
                </p>
                {manualCheckHint && (
                  <div className="p-3 rounded-lg border bg-rose-50 border-rose-200 text-rose-700 text-[12px]">
                    {manualCheckHint}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <a
                    href={Z_CORE_ZIP_URL}
                    download="Merlin_Z_Core.zip"
                    className="flex-1 py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-[13px] text-center no-underline cursor-pointer"
                  >
                    최신 버전 다운로드
                  </a>
                  <button
                    type="button"
                    onClick={handleManualCheck}
                    disabled={isChecking}
                    className="py-2.5 px-4 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-medium text-[12.5px] cursor-pointer"
                  >
                    {isChecking ? '확인 중...' : '다시 확인'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-[13px] text-slate-700 leading-relaxed">
                  내 컴퓨터 사진 <strong>{totalPhotoCount}장</strong>과 문서함이 연결되어 있습니다.
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      hasTriggeredInitRef.current = false;
                      initPromiseRef.current = null;
                      setProgress(0);
                      setStep('indexing');
                    }}
                    className="flex-1 py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-[13px] text-center cursor-pointer"
                  >
                    목록 새로고침
                  </button>
                  <button
                    type="button"
                    onClick={finishAndPopOpenPhotos}
                    className="py-2.5 px-4 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-medium text-[13px] cursor-pointer"
                  >
                    사진 보기
                  </button>
                </div>
                {!isMobileEnv && (
                  <div className="text-right">
                    <a
                      href={Z_CORE_ZIP_URL}
                      download="Merlin_Z_Core.zip"
                      className="text-[11.5px] text-slate-400 hover:text-slate-700 underline cursor-pointer"
                    >
                      설치파일 다시 받기 (v{LATEST_Z_CORE_VERSION})
                    </a>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
