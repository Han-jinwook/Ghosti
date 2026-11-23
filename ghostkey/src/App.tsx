import React, { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  Briefcase,
  CreditCard,
  Keyboard,
  Laptop,
  PlayCircle,
  Smartphone,
  Zap,
} from 'lucide-react';
import { useSaySeeStore } from './store/useSaySeeStore';
import {
  GhostiHeaderQuickShareButton,
  GhostiHubRootProvider,
  GhostiSidebarBottomFamilyLauncher,
  GhostiTopRightHubAnchor,
} from './components/GhostiHubInfraBridge';
import { GhostiBrandLogo } from './components/GhostiBrandLogo';
import { GhostiLoadingSplash } from './components/GhostiLoadingSplash';
import { GhostKeyPricingView, PricingModal } from './components/PricingModal';
import { MerlinZCoreGuideModal } from './components/MerlinZCoreGuideModal';
import { GhostKeyOnboardingView } from './components/GhostKeyOnboardingView';
import { GhostKeySettingsPanel } from './components/GhostKeySettingsPanel';
import { GhostKeyTeamSnippetsPanel } from './components/GhostKeyTeamSnippetsPanel';
import {
  pullTeamSnippetsFromBridge,
  subscribeWorkTeamSnippetsRealtime,
} from './services/teamSnippetsService';
import {
  detectInitialGhostKeyLang,
  GHOSTKEY_COPY,
  type GhostKeyLang,
} from './services/ghostKeyI18n';
import { fetchSuperpowerStatus, type SuperpowerTrialStatus } from './services/superpowerService';

export type GhostKeyMenuId =
  | 'onboarding'
  | 'settings'
  | 'pricing'
  | 'phone_pc_ext'
  | 'work_team_ext';

export const App: React.FC = () => {
  const {
    themeMode,
    setShowProModal,
    openSubscriptionCheckout,
    lastQuarantineToast,
    dismissQuarantineToast,
    setLastQuarantineToast,
    merlinAuth,
    activePricingPlan,
    subscribedLounges,
    deviceEntitlement,
  } = useSaySeeStore();

  const [lang] = useState<GhostKeyLang>(() => detectInitialGhostKeyLang());
  const [activeMenu, setActiveMenu] = useState<GhostKeyMenuId>(() => {
    if (typeof window !== 'undefined') {
      const t = new URLSearchParams(window.location.search).get('tab');
      if (t === 'settings') return 'settings';
    }
    return 'onboarding';
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isExtensionsExpanded, setIsExtensionsExpanded] = useState(false);
  const [isDeviceIntegrationExpanded, setIsDeviceIntegrationExpanded] = useState(false);
  const [isWorkShareExpanded, setIsWorkShareExpanded] = useState(false);
  const [isZCoreModalOpen, setIsZCoreModalOpen] = useState(false);
  const [superpowerStatus, setSuperpowerStatus] = useState<SuperpowerTrialStatus | null>(null);

  useEffect(() => {
    const onOpenZCoreGuide = () => setIsZCoreModalOpen(true);
    window.addEventListener('openZCoreGuideModal', onOpenZCoreGuide);
    return () => window.removeEventListener('openZCoreGuideModal', onOpenZCoreGuide);
  }, []);

  useEffect(() => {
    const accountId = merlinAuth?.email || merlinAuth?.userId || 'local_user';
    const subFlag =
      activePricingPlan !== 'free_trial' ||
      Boolean(deviceEntitlement?.isPaidUnlimited) ||
      Object.values(subscribedLounges).some(Boolean);
    void fetchSuperpowerStatus(accountId, subFlag).then(setSuperpowerStatus);
    const onUpdated = (e: Event) => {
      const custom = e as CustomEvent<SuperpowerTrialStatus>;
      if (custom.detail) setSuperpowerStatus(custom.detail);
    };
    window.addEventListener('ghosti_superpower_status_updated', onUpdated);
    return () => window.removeEventListener('ghosti_superpower_status_updated', onUpdated);
  }, [merlinAuth?.email, merlinAuth?.userId, activePricingPlan, subscribedLounges, deviceEntitlement?.isPaidUnlimited]);

  useEffect(() => {
    if (!lastQuarantineToast) return;
    const t = window.setTimeout(() => dismissQuarantineToast(), 4500);
    return () => clearTimeout(t);
  }, [lastQuarantineToast, dismissQuarantineToast]);

  // 로그인 계정이 업무 공유방 소속인 경우 어느 탭에 있든 F7~F12 팀 상용구를 백그라운드 자동 수신·실시간 구독
  useEffect(() => {
    if (!merlinAuth?.email) return;
    let disposed = false;
    let unsubRealtime: (() => void) | null = null;
    void pullTeamSnippetsFromBridge().then((pulled) => {
      if (disposed || !pulled.ok || !pulled.roomId) return;
      unsubRealtime = subscribeWorkTeamSnippetsRealtime(pulled.roomId, () => {
        if (!disposed) {
          setLastQuarantineToast('⚡ 팀 공유 상용구(F7~F12)가 실시간 업데이트되었습니다.');
        }
      });
    });
    return () => {
      disposed = true;
      unsubRealtime?.();
    };
  }, [merlinAuth?.email, setLastQuarantineToast]);

  const copy = GHOSTKEY_COPY[lang];
  const isLight = themeMode === 'light';
  const isPaidSubscriber = Boolean(deviceEntitlement?.isPaidUnlimited);

  useEffect(() => {
    if (isPaidSubscriber && activeMenu === 'pricing') {
      setActiveMenu('settings');
    }
  }, [isPaidSubscriber, activeMenu]);

  const scrollAppToTop = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const mainBtnClass = (active: boolean) =>
    `w-full px-3 py-2 rounded-xl font-label-md text-[15px] flex items-center justify-between gap-2 transition-all cursor-pointer ${
      active
        ? isLight
          ? 'bg-[#E6F7F5] text-[#0F766E] font-extrabold'
          : 'bg-zinc-800/90 text-[#00F0B5] font-extrabold'
        : isLight
        ? 'text-slate-800 hover:text-slate-950 hover:bg-black/5 font-extrabold'
        : 'text-zinc-200 hover:text-white hover:bg-white/5 font-extrabold'
    }`;

  const subWrapClass = `ml-3.5 pl-2.5 border-l flex flex-col gap-0.5 py-0.5 ${
    isLight ? 'border-slate-200' : 'border-white/10'
  }`;

  const subBtnClass = (active: boolean) =>
    `w-full px-2.5 py-1.5 rounded-lg text-left text-[13.5px] flex items-center justify-between gap-1.5 transition-all cursor-pointer ${
      active
        ? isLight
          ? 'bg-[#0D9488]/10 text-[#0D9488] font-extrabold'
          : 'bg-white/10 text-white font-extrabold'
        : isLight
        ? 'text-slate-600 hover:text-slate-900 hover:bg-black/5 font-medium'
        : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 font-medium'
    }`;

  const isTrialBadgeVisible = Boolean(
    superpowerStatus?.trial_status &&
      superpowerStatus.trial_status !== 'NOT_STARTED' &&
      superpowerStatus.trial_status !== 'EXPIRED' &&
      superpowerStatus.trial_status !== 'EXPIRED_LOCKED'
  );

  const renderSidebarNavigationContent = (isMobileDrawer = false) => (
    <div
      className={`h-full flex flex-col justify-between p-3 select-none overscroll-contain ${
        isLight
          ? 'bg-[#F8F7F4] border-r border-[#E5E0D5] text-slate-800'
          : 'bg-[#111114] border-r border-white/10 text-zinc-200'
      }`}
    >
      <div className="flex flex-col gap-4 overflow-y-auto overscroll-contain no-scrollbar">
        {/* 1. 사이드바 최상단: 귀신같이 정품 스타일 A 브랜드 로고 & 사이드바 접기 버튼 */}
        <div className="flex items-center justify-between px-1.5 py-1 gap-1.5">
          <GhostiBrandLogo
            size="desktop"
            themeMode={themeMode}
            onClick={() => {
              setActiveMenu('onboarding');
              if (isMobileDrawer) setIsMobileDrawerOpen(false);
              else scrollAppToTop();
            }}
          />

          <button
            type="button"
            onClick={() =>
              isMobileDrawer ? setIsMobileDrawerOpen(false) : setIsSidebarCollapsed(true)
            }
            title={isMobileDrawer ? '메뉴 닫기' : '사이드바 접기'}
            className={`w-7 h-7 rounded-lg flex items-center justify-center text-[13px] font-bold cursor-pointer ${
              isLight
                ? 'hover:bg-black/5 text-slate-400 hover:text-slate-700'
                : 'hover:bg-white/10 text-zinc-400 hover:text-white'
            }`}
          >
            {isMobileDrawer ? '' : '«'}
          </button>
        </div>

        {/* 2. 메인 메뉴: 노션 스타일 단색 모노톤 아이콘 */}
        <div className="flex flex-col gap-1.5">
          {/* ━━━ 메인: 귀신Key (내 PC 단독) ━━━ */}
          <div className="flex flex-col gap-0.5">
            <button
              type="button"
              onClick={() => {
                setActiveMenu('onboarding');
                if (isMobileDrawer) setIsMobileDrawerOpen(false);
                else scrollAppToTop();
              }}
              className={mainBtnClass(
                activeMenu === 'onboarding' || activeMenu === 'settings' || activeMenu === 'pricing'
              )}
            >
              <div className="flex flex-col text-left min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 opacity-80 shrink-0" />
                  <span className="text-[14px] leading-snug">귀신Key (내 PC)</span>
                </div>
                <span className="text-[10.5px] opacity-65 font-normal whitespace-normal break-keep leading-snug mt-0.5">
                  오타 교정 · 순차 붙여넣기 · 상용구
                </span>
              </div>
            </button>

            <div className={subWrapClass}>
              <button
                type="button"
                onClick={() => {
                  setActiveMenu('onboarding');
                  if (isMobileDrawer) setIsMobileDrawerOpen(false);
                  else scrollAppToTop();
                }}
                className={subBtnClass(activeMenu === 'onboarding')}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <PlayCircle className="w-3.5 h-3.5 opacity-70 shrink-0" />
                  <span className="font-semibold whitespace-normal break-keep leading-snug">
                    기능 소개 · 체험
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsZCoreModalOpen(true);
                  if (isMobileDrawer) setIsMobileDrawerOpen(false);
                }}
                className={subBtnClass(false)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Laptop className="w-3.5 h-3.5 opacity-70 shrink-0" />
                  <span className="font-semibold whitespace-normal break-keep leading-snug">
                    30일 카드없이 한달 무료체험
                  </span>
                </div>
              </button>

              {!isPaidSubscriber && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveMenu('pricing');
                    if (isMobileDrawer) setIsMobileDrawerOpen(false);
                    else scrollAppToTop();
                  }}
                  className={subBtnClass(activeMenu === 'pricing')}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <CreditCard className="w-3.5 h-3.5 opacity-70 shrink-0" />
                    <span className="font-semibold whitespace-normal break-keep leading-snug">
                      이용권 안내
                    </span>
                  </div>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setActiveMenu('settings');
                  if (isMobileDrawer) setIsMobileDrawerOpen(false);
                  else scrollAppToTop();
                }}
                className={subBtnClass(activeMenu === 'settings')}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Keyboard className="w-3.5 h-3.5 opacity-70 shrink-0" />
                  <span className="font-semibold whitespace-normal break-keep leading-snug">
                    상용구 설정
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* ━━━ 기기 연동 · 팀 확장 (기본 접힘: 처음엔 상단 온보딩에만 집중) ━━━ */}
          <div className="mt-2 pt-2.5 border-t border-black/10 flex flex-col gap-1 select-none">
            <button
              type="button"
              onClick={() => setIsExtensionsExpanded((v) => !v)}
              className="w-full px-3 py-1.5 rounded-lg flex items-center justify-between text-[11px] font-bold text-slate-500 hover:text-slate-800 hover:bg-black/5 cursor-pointer transition"
            >
              <span>확장 연동 (폰·팀 공유)</span>
              <span className="text-[10px] opacity-75">{isExtensionsExpanded ? '▾' : '▸'}</span>
            </button>

            {isExtensionsExpanded && (
              <>

            {/* [확장 1] 내 기기 통합 */}
            <div className="flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => {
                  setIsDeviceIntegrationExpanded(true);
                  setActiveMenu('phone_pc_ext');
                  if (isMobileDrawer) setIsMobileDrawerOpen(false);
                  else scrollAppToTop();
                }}
                className={mainBtnClass(activeMenu === 'phone_pc_ext')}
              >
                <div className="flex flex-col text-left min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 opacity-75 shrink-0" />
                    <span className="text-[13.5px]">내 기기 통합</span>
                    {isTrialBadgeVisible && (
                      <span className="px-1 py-0.5 text-[9px] font-bold rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
                        체험중
                      </span>
                    )}
                  </div>
                  <span className="text-[10.5px] opacity-65 font-normal whitespace-normal break-keep leading-snug mt-0.5">
                    폰 ↔ PC 클립보드 · 상용구 동기화
                  </span>
                </div>
                <span
                  role="button"
                  aria-label={isDeviceIntegrationExpanded ? '접기' : '펼치기'}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDeviceIntegrationExpanded((v) => !v);
                  }}
                  className="text-[10px] opacity-60 hover:opacity-100 shrink-0 px-1 cursor-pointer"
                >
                  {isDeviceIntegrationExpanded ? '▾' : '▸'}
                </span>
              </button>

              {isDeviceIntegrationExpanded && (
                <div className={subWrapClass}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMenu('phone_pc_ext');
                      if (isMobileDrawer) setIsMobileDrawerOpen(false);
                      else scrollAppToTop();
                    }}
                    className={subBtnClass(activeMenu === 'phone_pc_ext')}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50 shrink-0" />
                      <span className="font-semibold whitespace-normal break-keep leading-snug">
                        귀신Key : 폰 + PC
                      </span>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* [확장 2] 업무 공유 (공용 폴더 S:) */}
            <div className="flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => {
                  setIsWorkShareExpanded(true);
                  setActiveMenu('work_team_ext');
                  if (isMobileDrawer) setIsMobileDrawerOpen(false);
                  else scrollAppToTop();
                }}
                className={mainBtnClass(activeMenu === 'work_team_ext')}
              >
                <div className="flex flex-col text-left min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 opacity-75 shrink-0" />
                    <span className="text-[13.5px] whitespace-normal break-keep leading-snug">
                      업무 공유 (공용 폴더 S:)
                    </span>
                  </div>
                  <span className="text-[10.5px] opacity-65 font-normal whitespace-normal break-keep leading-snug mt-0.5">
                    팀 공유 상용구 · 공용 드라이브
                  </span>
                </div>
                <span
                  role="button"
                  aria-label={isWorkShareExpanded ? '접기' : '펼치기'}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsWorkShareExpanded((v) => !v);
                  }}
                  className="text-[10px] opacity-60 hover:opacity-100 shrink-0 px-1 cursor-pointer"
                >
                  {isWorkShareExpanded ? '▾' : '▸'}
                </span>
              </button>

              {isWorkShareExpanded && (
                <div className={subWrapClass}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMenu('work_team_ext');
                      if (isMobileDrawer) setIsMobileDrawerOpen(false);
                      else scrollAppToTop();
                    }}
                    className={subBtnClass(activeMenu === 'work_team_ext')}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50 shrink-0" />
                      <span className="font-semibold whitespace-normal break-keep leading-snug">
                        귀신Key : 팀 공유
                      </span>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <div
              className="mt-1 px-3 py-2 rounded-xl text-[10.5px] leading-relaxed bg-slate-200/55 text-slate-600"
            >
              입력 내용과 클립보드 기록은 외부 서버로 전송되지 않고 내 PC 안에서만 처리됩니다.
            </div>
              </>
            )}

            {/* 본체 『귀신같이』 고정 1줄 바로가기 (아코디언 밖) */}
            <a
              href="https://ghosti.sundreamer.app/?from=ghostkey"
              target="_blank"
              rel="noopener noreferrer"
              className={`${mainBtnClass(false)} no-underline mt-1`}
            >
              <div className="flex flex-col text-left min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <ArrowUpRight className="w-3.5 h-3.5 opacity-70 shrink-0" />
                  <span className="text-[13px] leading-snug">귀신같이 (평생 무료)</span>
                </div>
                <span className="text-[10.5px] opacity-65 font-normal whitespace-normal break-keep leading-snug mt-0.5">
                  파일 안 열고 본문·사진·영상 1초 소환
                </span>
              </div>
            </a>
          </div>
        </div>
      </div>

      {/* 3. 사이드바 하단: 멀린 패밀리 생태계 앱 런처 */}
      <GhostiSidebarBottomFamilyLauncher />
    </div>
  );

  return (
    <GhostiHubRootProvider>
      <GhostiLoadingSplash />

      <div
        className={`min-h-screen flex transition-colors ${
          isLight ? 'bg-[#FAF9F5] text-slate-900' : 'bg-[#09090B] text-zinc-100'
        }`}
      >
        {/* 좌측 데스크톱 사이드바 (귀신같이와 100% 동일한 294px 폭) */}
        {!isSidebarCollapsed && (
          <aside className="hidden lg:block w-[294px] shrink-0 sticky top-0 h-screen z-40">
            {renderSidebarNavigationContent(false)}
          </aside>
        )}

        {/* 모바일 좌측 슬라이드 드로어 */}
        {isMobileDrawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex overscroll-contain">
            <div
              onClick={() => setIsMobileDrawerOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            />
            <aside className="relative w-[304px] max-w-[90vw] h-full z-10 shadow-2xl overscroll-contain">
              {renderSidebarNavigationContent(true)}
            </aside>
          </div>
        )}

        {/* 우측 메인 영역 (심플 1줄 상단 헤더 + 본문) */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* 귀신같이 스타일 심플 1줄 헤더 */}
          <header className="sticky top-0 z-30 backdrop-blur-xl">
            <div
              className={`px-2 sm:px-5 md:px-7 py-2 flex flex-col gap-2 border-b transition-colors ${
                isLight
                  ? 'bg-white/90 border-[#EAE8E1]'
                  : 'bg-[#09090B]/90 border-white/10'
              }`}
            >
              <div className="flex items-center justify-between gap-1 sm:gap-2 flex-nowrap min-w-0">
                {/* 좌측: 모바일 버튼 / PC 사이드바 열기 버튼 + 로고 */}
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsMobileDrawerOpen(true)}
                    title="전체 메뉴 열기"
                    className={`lg:hidden w-7 h-7 sm:w-8 sm:h-8 rounded-lg border flex items-center justify-center cursor-pointer shrink-0 ${
                      isLight
                        ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        : 'bg-zinc-900 border-white/10 text-zinc-300'
                    }`}
                  >
                    </button>

                  {isSidebarCollapsed && (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsSidebarCollapsed(false)}
                        title="좌측 사이드바 펼치기"
                        className={`hidden lg:flex px-2.5 py-1 rounded-lg border text-[12px] font-bold items-center gap-1 cursor-pointer shrink-0 ${
                          isLight
                            ? 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                            : 'bg-zinc-900 hover:bg-zinc-800 border-white/10 text-zinc-300'
                        }`}
                      >
                        <span></span>
                        <span>메뉴</span>
                      </button>
                      <GhostiBrandLogo
                        size="desktop"
                        themeMode={themeMode}
                        onClick={() => {
                          setActiveMenu('onboarding');
                          scrollAppToTop();
                        }}
                        className="hidden lg:inline-flex mr-1"
                      />
                    </>
                  )}

                  <GhostiBrandLogo
                    size="mobile"
                    autoCycle={false}
                    themeMode={themeMode}
                    onClick={() => {
                      setActiveMenu('onboarding');
                      scrollAppToTop();
                    }}
                    className="lg:hidden"
                  />
                </div>

                {/* 우측 상단 심플 앵커 (공유 아이콘 + 프로필) */}
                <div className="flex items-center gap-1 sm:gap-2 shrink-0 ml-auto">
                  {/* 공유 아이콘 + 직하단 말풍선 토스트 */}
                  <GhostiHeaderQuickShareButton themeMode={themeMode} lang={lang} />

                  {/* 우측 끝 허브 프로필 위젯 */}
                  <GhostiTopRightHubAnchor themeMode={themeMode} />
                </div>
              </div>
            </div>
          </header>

          {/* 메인 컨텐츠 영역 */}
          <main className="flex-1 w-full max-w-[1220px] mx-auto px-4 sm:px-6 md:px-8 py-6">
            {activeMenu === 'onboarding' && (
              <GhostKeyOnboardingView
                lang={lang}
                themeMode={themeMode}
                onOpenZCoreModal={() => setIsZCoreModalOpen(true)}
                onGoSettings={() => setActiveMenu('settings')}
              />
            )}

            {activeMenu === 'settings' && (
              <GhostKeySettingsPanel
                lang={lang}
                themeMode={themeMode}
                onOpenZCoreModal={() => setIsZCoreModalOpen(true)}
                onOpenPricing={() => {
                  setActiveMenu('pricing');
                  scrollAppToTop();
                }}
              />
            )}

            {activeMenu === 'pricing' && <GhostKeyPricingView lang={lang} />}

            {activeMenu === 'phone_pc_ext' && (
              <div
                className={`rounded-3xl border p-6 sm:p-8 space-y-5 ${
                  isLight ? 'bg-white border-slate-200' : 'bg-zinc-900/80 border-white/10'
                }`}
              >
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/15 border border-teal-500/35 text-teal-700 dark:text-teal-300 text-xs font-extrabold">
                  <span>귀신Key : 폰 + PC (내 기기 통합 · 월 3,900원)</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                  폰에서 복사하면 PC에 바로 붙고, 내 상용구(F1~F6)가 내 모든 PC에 동기화됩니다
                </h1>
                <p className="text-sm text-slate-600 dark:text-zinc-300 leading-relaxed max-w-2xl">
                  <strong>『내 기기 통합 (월 3,900원)』</strong>을 구독하시면 <strong>귀신Key(월 1,900원) 전 기능이 무상으로 기본 포함</strong>되며, 내 스마트폰 · 집 PC · 회사 PC가 하나로 묶입니다.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <div className={`p-4 rounded-2xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-zinc-950 border-white/10'}`}>
                    <div className="text-sm font-black mb-1">귀신Key 연속복사 · 7일 클립보드 확장 (E2EE)</div>
                    <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                      귀신Key의 연속복사·7일 클립보드가 폰↔PC로 그대로 확장됩니다. 카톡 ‘나에게 보내기’ 없이 복사한 텍스트·계좌번호를 PC와 폰에서 7일간 꺼내 씁니다.
                      <span className="block mt-1 text-[11px] text-amber-700 dark:text-amber-300 font-semibold">
                        ※ 아이폰(iOS)은 OS 보안 제한으로 연속 복사는 미지원(1건 복사 전송 및 7일 치 꺼내쓰기 지원).
                      </span>
                    </p>
                  </div>
                  <div className={`p-4 rounded-2xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-zinc-950 border-white/10'}`}>
                    <div className="text-sm font-black mb-1">⌨ F1~F6 내 상용구 내 모든 PC 동기화</div>
                    <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                      회사 PC에서 저장한 F1~F6 상용구가 집 PC와 노트북에서도 1초 만에 똑같이 유지됩니다.
                    </p>
                  </div>
                  <div className={`p-4 rounded-2xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-zinc-950 border-white/10'}`}>
                    <div className="text-sm font-black mb-1">귀신Key (월 1,900원) 무상 합체</div>
                    <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                      별도로 1,900원을 결제할 필요 없이 한영 오타 성형·순차복사·PDF 다림질·F1~F6 상용구·7일 클립보드 검색이 전부 해금됩니다.
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => openSubscriptionCheckout('personal_sub_3900')}
                    className="px-5 py-3 rounded-2xl bg-[#0D9488] hover:bg-teal-500 text-white font-black text-sm cursor-pointer shadow-md"
                  >
                    내 기기 통합 (월 3,900원 · 귀신Key 포함) 구독하기
                  </button>
                  <button
                    type="button"
                    onClick={() => openSubscriptionCheckout('personal_year_39000')}
                    className="px-4 py-3 rounded-2xl border border-slate-300 dark:border-white/15 font-bold text-xs cursor-pointer hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    연간 39,000원 (2개월 무료)
                  </button>
                  <a
                    href="https://ghosti.sundreamer.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-3 rounded-2xl border border-teal-500/40 text-teal-700 dark:text-teal-300 font-extrabold text-xs no-underline hover:bg-teal-500/10"
                  >
                    귀신같이 본체에서 기기 연결 열기 ↗
                  </a>
                </div>
              </div>
            )}

            {activeMenu === 'work_team_ext' && (
              <div className="space-y-6">
              <div
                className={`rounded-3xl border p-6 sm:p-8 space-y-5 ${
                  isLight ? 'bg-white border-slate-200' : 'bg-zinc-900/80 border-white/10'
                }`}
              >
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/35 text-amber-700 dark:text-amber-300 text-xs font-extrabold">
                  <span>귀신Key : 팀 공유 (업무 공유 S: · 월 9,900원~)</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                  대표가 F7~F12 팀 상용구를 한 번만 등록하면 전 직원 PC에 1초 동기화됩니다
                </h1>
                <p className="text-sm text-slate-600 dark:text-zinc-300 leading-relaxed max-w-2xl">
                  법인 계좌번호·사업자등록번호·세금계산서 이메일·고객 응대 표준멘트를 직원마다 따로 물어볼 필요 없이, 모든 직원이 <strong>Ctrl+0 F7~F12</strong>로 오타 없이 즉시 입력합니다. (대표 1인 정액제 · 팀원 전원 무료)
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className={`p-4 rounded-2xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-zinc-950 border-white/10'}`}>
                    <div className="text-sm font-black mb-1">F7~F12 팀 공유 상용구 일괄 배포</div>
                    <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                      F1~F6은 각 직원의 개인 상용구로 유지하고, F7~F12 6칸은 우리 회사 공식 계좌·사업자번호·표준 안내문으로 전 직원에 실시간 동기화됩니다.
                    </p>
                  </div>
                  <div className={`p-4 rounded-2xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-zinc-950 border-white/10'}`}>
                    <div className="text-sm font-black mb-1">클라우드 월세 0원 · 공용 폴더 (S: 드라이브)</div>
                    <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                      인당 과금 없이 사내 업무 문서를 윈도우 탐색기 S: 드라이브 하나로 묶고 동시 편집 잠금(File Lock)까지 지원합니다.
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => openSubscriptionCheckout('work_soho_9900')}
                    className="px-5 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black text-sm cursor-pointer shadow-md"
                  >
                    소호 팀 (~5인 · 월 9,900원) 구독하기
                  </button>
                  <button
                    type="button"
                    onClick={() => openSubscriptionCheckout('work_soho_year_99000')}
                    className="px-4 py-3 rounded-2xl border border-slate-300 dark:border-white/15 font-bold text-xs cursor-pointer hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    연간 99,000원 (2개월 무료)
                  </button>
                  <a
                    href="https://ghosti.sundreamer.app/?from=b2b"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-3 rounded-2xl border border-amber-500/40 text-amber-700 dark:text-amber-300 font-extrabold text-xs no-underline hover:bg-amber-500/10"
                  >
                    귀신같이 본체에서 업무 공유(S:) 열기 ↗
                  </a>
                </div>
              </div>

              <GhostKeyTeamSnippetsPanel />
              </div>
            )}
          </main>
        </div>
      </div>

      <PricingModal lang={lang} />
      <MerlinZCoreGuideModal
        isOpen={isZCoreModalOpen}
        onClose={() => setIsZCoreModalOpen(false)}
        themeMode={themeMode}
      />

      {lastQuarantineToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[140] w-[92vw] max-w-xl px-4 py-3 rounded-2xl bg-white dark:bg-zinc-900 border-2 border-teal-500 text-slate-900 dark:text-zinc-100 text-[13px] font-extrabold shadow-xl flex items-center justify-between gap-2">
          <span>{lastQuarantineToast}</span>
          <button
            type="button"
            onClick={dismissQuarantineToast}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white px-1 cursor-pointer"
          >
            </button>
        </div>
      )}
    </GhostiHubRootProvider>
  );
};

export default App;
