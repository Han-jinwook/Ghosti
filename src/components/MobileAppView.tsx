import React, { useEffect, useMemo, useState } from 'react';
import { zCoreBridge } from '../services/zCoreBridge';
import { useSaySeeStore, getActivePersonaForCluster, type MobileTab } from '../store/useSaySeeStore';
import { GhostiTopRightHubAnchor } from './GhostiHubInfraBridge';
import { GhostiBrandLogo } from './GhostiBrandLogo';
import { ZCoreEngineStatusBadge } from './ZCoreEngineStatusBadge';
import { MerlinZCoreGuideModal } from './MerlinZCoreGuideModal';
import type { GpuHelperTierId, LoungeType } from '../types/saysee';
import { groupBurstSearchResults } from '../services/aiEngine';
import { VoiceHeroStage } from './VoiceHeroStage';
import { SmartTrashView } from './SmartTrashView';
import {
  LoungeCustomSettingsHeader,
  LoungeFeedContextBanner,
  LoungeIndexingWaitingRoom,
  LoungeView,
} from './LoungeView';
import { PcMasterQuickSendPanel } from './PricingModal';

const MainLoungeMonoIcon: React.FC<{ id: LoungeType; className?: string }> = ({
  id,
  className = 'w-[14px] h-[14px]',
}) => {
  switch (id) {
    case 'personal':
      return (
        <svg
          className={className}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M5 20c0-3.87 3.13-7 7-7s7 3.13 7 7" />
        </svg>
      );
    case 'family':
      return (
        <svg
          className={className}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="9" cy="8" r="3.5" />
          <path d="M3 19c0-3.31 2.69-6 6-6s6 2.69 6 6" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M16 13.5c2.76 0 5 2.24 5 5" />
        </svg>
      );
    case 'club':
      return (
        <svg
          className={className}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 3v18" />
          <path d="M5 4h12l-2.5 4.5L17 13H5" />
        </svg>
      );
    case 'student':
      return (
        <svg
          className={className}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M22 10L12 5 2 10l10 5 10-5z" />
          <path d="M6 12.5V17c0 1.66 2.69 3 6 3s6-1.34 6-3v-4.5" />
        </svg>
      );
    case 'work':
      return (
        <svg
          className={className}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
          <path d="M2 12h20" />
        </svg>
      );
  }
};

/**
 * [1차 출시 3대 메뉴 체계] 내 기기 / 사진 공유 / 업무 공유
 * - '사진 공유'는 하위에서 패밀리(우리집·본가·처가) ↔ 동호회·동창회를 선택 전환 (데스크톱 섹션 구조와 동일)
 * - 구버전 'student(스쿨)'은 메뉴에서 제외 (스토어 setActiveLoungeType에서 club으로 일원화)
 */
type MainMenuId = 'personal' | 'photo_share' | 'work';

const PHOTO_SHARE_LOUNGES: LoungeType[] = ['family', 'club', 'student'];

const MAIN_LOUNGE_MENUS: Array<{
  id: MainMenuId;
  label: string;
  iconId: LoungeType;
  defaultLounge: LoungeType;
}> = [
  { id: 'personal', label: '내 기기', iconId: 'personal', defaultLounge: 'personal' },
  { id: 'photo_share', label: '사진 공유', iconId: 'family', defaultLounge: 'family' },
  { id: 'work', label: '업무 공유(S:)', iconId: 'work', defaultLounge: 'work' },
];

const PHOTO_SHARE_GROUPS: Array<{ id: LoungeType; label: string }> = [
  { id: 'family', label: '패밀리 (우리집·본가·처가)' },
  { id: 'club', label: '동호회·동창회' },
];

const resolveMainMenuId = (lounge: LoungeType): MainMenuId =>
  PHOTO_SHARE_LOUNGES.includes(lounge) ? 'photo_share' : lounge === 'work' ? 'work' : 'personal';

const MOBILE_LOUNGE_SUBMENUS: Record<
  LoungeType,
  Array<{ id: MobileTab; label: string; subcaption?: string; showTrashCount?: boolean }>
> = {
  personal: [

    { id: 'search', label: '🎯 찾기', subcaption: '제목 몰라도 귀신같이 찾고' },
    { id: 'trash', label: '🧹 치우기', subcaption: '중복 사진 귀신같이 치우고', showTrashCount: true },
    { id: 'settings', label: '⚙️ 고치기', subcaption: '먹통 설정 귀신같이 고치고' },
    { id: 'share', label: '👨‍👩‍👧‍👦 공유', subcaption: '가족·팀과 함께 쓸 땐 귀신같이 공유하고' },
  ],
  family: [
    { id: 'trial', label: '📸 패밀리 공유 시작' },
    { id: 'search', label: '우리집·본가·처가 피드' },
    { id: 'trash', label: 'AI 인덱싱 대기실' },
    { id: 'settings', label: '가족 초대 & 방 설정' },
  ],
  club: [
    { id: 'trial', label: '⛳ 동호·동창회 시작' },
    { id: 'search', label: '모임 피드 & 원본 동기화' },
    { id: 'trash', label: 'AI 인덱싱 대기실' },
    { id: 'settings', label: '동호·동창회 관리 & 방 설정' },
  ],
  student: [
    { id: 'trial', label: '⛳ 동호·동창회 시작' },
    { id: 'search', label: '타임캡슐 피드 & 씬 검색' },
    { id: 'trash', label: 'AI 인덱싱 대기실' },
    { id: 'settings', label: '게이밍 PC & 학생인증' },
  ],
  work: [
    { id: 'trial', label: '💼 업무 공유(S:) 시작' },
    { id: 'search', label: '귀신같이 찾기 & 폴더 트리(S:)' },
    { id: 'trash', label: 'AI 인덱싱 대기실' },
    { id: 'settings', label: '팀원 권한 & S: 드라이브' },
  ],
};

export const MobileAppView: React.FC = () => {
  const [showZCoreGuideModal, setShowZCoreGuideModal] = useState(false);

  useEffect(() => {
    const onOpenZCoreGuide = () => setShowZCoreGuideModal(true);
    window.addEventListener('openZCoreGuideModal', onOpenZCoreGuide);
    const timer = window.setTimeout(() => {
      const hasLogin =
        typeof window !== 'undefined' &&
        (Boolean(localStorage.getItem('merlin_session_token')) ||
          Boolean(useSaySeeStore.getState().merlinAuth?.token));
      if (!hasLogin) {
        if (
          typeof sessionStorage !== 'undefined' &&
          sessionStorage.getItem('ghosti_login_prompt_shown') !== '1'
        ) {
          sessionStorage.setItem('ghosti_login_prompt_shown', '1');
          useSaySeeStore
            .getState()
            .showToast(
              '👋 환영합니다! 『귀신같이』는 먼저 [① 10초 이메일 무료 로그인] 완료 후 모든 기능을 시작합니다.'
            );
          window.dispatchEvent(new CustomEvent('openLoginModal'));
        }
      }
    }, 750);
    const unsub = zCoreBridge.subscribe((conn) => {
      if (
        conn &&
        typeof sessionStorage !== 'undefined' &&
        sessionStorage.getItem('ghosti_initial_indexing_done') !== '1'
      ) {
        setShowZCoreGuideModal(true);
      }
    });
    return () => {
      window.removeEventListener('openZCoreGuideModal', onOpenZCoreGuide);
      clearTimeout(timer);
      unsub();
    };
  }, []);
  const {
    mobileTab,
    setMobileTab,
    activeLoungeType,
    setActiveLoungeType,
    photos,
    searchSpace,
    setSearchSpace,
    resetSearchSpaceToAll,
    matchedLocalDocs,
    matchedVaultPhotos,
    setSelectedDocModal,
    videoSceneItems,
    matchedVideoScenes,
    setSelectedVideoModal,
    activeQuery,
    searchResults,
    groupBurstsInSearch,
    setGroupBurstsInSearch,
    setSelectedPhoto,
    toggleBookmark,
    openLocalFolder,
    setShowOnboarding,
    activePricingPlan,
    subscribedLounges,
    gpuHelper24hActive,
    gpuHelperActiveTier,
    activateGpuHelper24h,
    deactivateGpuHelper24h,
    syncState,
    setPrivateSyncStrategy,
    triggerSyncNow,
    themeMode,
    toggleThemeMode,
    merlinAuth,
    isStoreAppMode,
    enableSetupMonster,
    enableMobileCoinDisplay,
    showCoinBalanceInApp,
    enablePcGuideShareButton,
    setIsStoreAppMode,
    setEnableSetupMonster,
    setEnableMobileCoinDisplay,
    setEnablePcGuideShareButton,
    setShowMobileMasterPcIntroModal,
    setShowSetupMonsterModal,
    setShowProModal,
    faceClusters,
    activeFamilyRoom,
    setDoorplatePickerClusterId,
  } = useSaySeeStore();

  const [showPrivateSyncSection, setShowPrivateSyncSection] = useState(false);
  const [showPolicyAndStoreSection, setShowPolicyAndStoreSection] = useState(false);

  const myPassportCluster = useMemo(
    () => faceClusters.find((c) => c.clusterId === 'face_member_5') || faceClusters[0],
    [faceClusters]
  );
  const myDoorplatePersona = useMemo(() => {
    if (!myPassportCluster) return '멀린';
    const { activePersona } = getActivePersonaForCluster(
      myPassportCluster,
      activeLoungeType,
      activeFamilyRoom
    );
    return activePersona || myPassportCluster.registeredName || '멀린';
  }, [myPassportCluster, activeLoungeType, activeFamilyRoom]);

  const activePhotos = useMemo(() => photos.filter((p) => !p.quarantined), [photos]);
  const activeTrashCount = useMemo(
    () => activePhotos.filter((p) => Boolean(p.trashCategory)).length,
    [activePhotos]
  );

  // 검색 결과에서 dHash/연속촬영 기준 동일 연사 그룹을 1장으로 겹쳐서 [❐ N장 연사] 배지로 묶기
  const groupedResults = useMemo(() => {
    if (!groupBurstsInSearch || searchSpace === 'vault') {
      return searchResults.map((item) => ({
        representative: item,
        burstPhotos: [item.photo],
        burstCount: 1,
      }));
    }
    return groupBurstSearchResults(searchResults);
  }, [searchResults, groupBurstsInSearch, searchSpace]);

  const currentSubmenus = MOBILE_LOUNGE_SUBMENUS[activeLoungeType] || MOBILE_LOUNGE_SUBMENUS.personal;
  const isCurrentLoungeSubscribed = Boolean(subscribedLounges[activeLoungeType]);

  return (
    <div className="bg-[#09090B] text-zinc-100 font-body-md flex flex-col min-h-screen max-w-xl mx-auto relative shadow-2xl border-x border-white/10 pb-20">
      {/* 상단 2단 통합 헤더 (뭐먹지? 스타일): 1단(화이트 바 + 흑백 라인 아이콘 메인메뉴 캡슐) + 2단(이모지 없는 언더라인 서브메뉴 탭) */}
      <header className="sticky top-0 inset-x-0 z-50 backdrop-blur-xl pt-safe">
        <div
          className={`px-3.5 py-2 flex flex-col gap-2 border-b transition-colors ${
            themeMode === 'light'
              ? 'bg-white/95 border-[#EAE8E1]'
              : 'bg-[#09090B]/95 border-white/10'
          }`}
        >
          <div className="flex items-center justify-between gap-1 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1 shrink-0 min-w-0 max-w-[48%]">
              <GhostiBrandLogo
                size="mobile"
                themeMode={themeMode}
                showBadge={false}
                subtitle=""
                onClick={() => setMobileTab('search')}
                className="shrink-0 max-w-full"
              />
            </div>

            {/* 우상단: 귀신같이 여권 자동 문패(업무 공유 제외) + 설정(모바일 상시 노출) + 크레딧 잔액 + 심플 아이콘 테마 토글 */}
            <div className="flex items-center gap-1 shrink-0" aria-label="화면 테마 영역">
              {myPassportCluster && activeLoungeType !== 'work' && (
                <button
                  type="button"
                  onClick={() => setDoorplatePickerClusterId(myPassportCluster.clusterId)}
                  title="🛂 귀신같이 여권 최신 연도 정면 얼굴 자동 문패 (5대 스타일 슬롯 원터치 변경)"
                  className={`pl-1 pr-1 py-0.5 rounded-full border flex items-center gap-0.5 transition-all cursor-pointer ${
                    themeMode === 'light'
                      ? 'bg-teal-50/90 border-teal-300 text-teal-900'
                      : 'bg-zinc-900 border-primary-container/45 text-white'
                  }`}
                >
                  <img
                    src={myPassportCluster.avatarUrl || myPassportCluster.representativePhoto}
                    alt={myDoorplatePersona}
                    className="w-3.5 h-3.5 rounded-full object-cover border border-primary-container shrink-0"
                  />
                  <span className="font-label-sm text-[9.5px] font-extrabold whitespace-nowrap hidden min-[460px]:inline">
                    👑 {myDoorplatePersona}
                  </span>
                </button>
              )}
              {/* 🛠️ 설정 버튼: 모바일에서도 상시 정상 노출 (스토어 심사 리젝 대상 아님) */}
              <button
                type="button"
                onClick={() => setShowSetupMonsterModal(true, 'mobile')}
                title="기기 설정 및 고치기"
                className="px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 font-label-sm text-[10px] font-extrabold shrink-0"
              >
                ⚙️
              </button>
              {/* 허브 SDK 표준 앵커 (PC 헤더와 동일): 🪙 코인(스토어 심사 모드·네이티브 앱에서는 DOM 원천 비노출) + 🐾 곰발바닥 OTP 로그인/통합 프로필 */}
              <ZCoreEngineStatusBadge themeMode={themeMode} onClickGuide={() => setShowZCoreGuideModal(true)} compact={true} />
              <GhostiTopRightHubAnchor themeMode={themeMode} />
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('ghosti_navigate_showroom'));
                }}
                title="공식 쇼룸 대문으로 이동"
                className="px-2 py-0.5 rounded-full bg-teal-500/20 border border-teal-400/40 text-teal-300 font-label-sm text-[10px] font-extrabold shrink-0"
              >
                🏠 대문
              </button>
              <button
                type="button"
                onClick={toggleThemeMode}
                title={themeMode === 'light' ? '어두운 화면으로 전환' : '밝은 화면으로 전환'}
                aria-label={themeMode === 'light' ? '어두운 화면으로 전환' : '밝은 화면으로 전환'}
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all shrink-0 outline-none focus:outline-none ${
                  themeMode === 'light'
                    ? 'text-slate-400 hover:text-slate-700 hover:bg-black/5'
                    : 'bg-slate-800/90 hover:bg-slate-700 border border-white/20 text-slate-300 hover:text-white'
                }`}
              >
                {themeMode === 'light' ? (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                ) : (
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="4" fill="currentColor" />
                    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* 모바일 공식 마스터 슬로건 한 줄 띠 */}
          <div
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold text-center truncate ${
              themeMode === 'light'
                ? 'bg-teal-50/80 border-teal-200 text-teal-950'
                : 'bg-zinc-900/80 border-teal-500/20 text-zinc-200'
            }`}
            title="혼자 쓸 땐 귀신같이 찾고 치우고 고치고! 가족·팀과 함께 쓸 땐 귀신같이 공유하고!"
          >
            <span className="text-teal-600 dark:text-teal-400">혼자 쓸 땐 찾고 치우고 고치고!</span>{' '}
            <span className="opacity-30">|</span>{' '}
            <span className="text-emerald-600 dark:text-emerald-400">가족·팀과 함께 쓸 땐 귀신같이 공유하고!</span>
          </div>

          {/* 1단 메인메뉴 3개 (내 기기 / 사진 공유 / 업무 공유): 흑백 라인 아이콘 + 캡슐 스타일 */}
          <nav className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {MAIN_LOUNGE_MENUS.map((menu) => {
              const active = resolveMainMenuId(activeLoungeType) === menu.id;
              return (
                <button
                  key={menu.id}
                  type="button"
                  onClick={() => {
                    // 이미 사진 공유(패밀리/동호회·동창회) 안에 있으면 현재 하위 선택 유지
                    if (active) return;
                    setActiveLoungeType(menu.defaultLounge);
                  }}
                  className={`px-3 py-1.5 rounded-full font-label-sm text-[12px] flex items-center gap-1 transition-all shrink-0 whitespace-nowrap outline-none focus:outline-none ${
                    active
                      ? themeMode === 'light'
                        ? 'bg-[#E6F7F5] text-[#0D9488] font-extrabold'
                        : 'bg-zinc-800 text-primary-container font-extrabold'
                      : themeMode === 'light'
                      ? 'text-slate-500 hover:text-slate-900 font-bold'
                      : 'text-zinc-400 hover:text-white font-bold'
                  }`}
                >
                  <MainLoungeMonoIcon id={menu.iconId} className="w-[14px] h-[14px] shrink-0" />
                  <span>{menu.label}</span>
                </button>
              );
            })}
          </nav>

          {/* 사진 공유 하위 선택: 패밀리 ↔ 동호회·동창회 */}
          {resolveMainMenuId(activeLoungeType) === 'photo_share' && (
            <div className="flex items-center gap-1.5 -mt-0.5 overflow-x-auto no-scrollbar">
              {PHOTO_SHARE_GROUPS.map((group) => {
                const groupActive =
                  activeLoungeType === group.id ||
                  (group.id === 'club' && activeLoungeType === 'student');
                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => {
                      if (!groupActive) setActiveLoungeType(group.id);
                    }}
                    className={`px-2.5 py-1 rounded-lg border text-[11.5px] shrink-0 whitespace-nowrap transition-all outline-none focus:outline-none ${
                      groupActive
                        ? themeMode === 'light'
                          ? 'bg-white border-[#0D9488] text-[#0D9488] font-extrabold'
                          : 'bg-zinc-900 border-primary-container text-primary-container font-extrabold'
                        : themeMode === 'light'
                        ? 'bg-transparent border-[#E5E0D5] text-slate-500 hover:text-slate-900 font-bold'
                        : 'bg-transparent border-white/10 text-zinc-400 hover:text-white font-bold'
                    }`}
                  >
                    {group.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 2단 서브메뉴 바: 이모지 없는 깔끔한 언더라인 탭 */}
        <div
          className={`px-3.5 pt-1 border-b flex items-center gap-1 overflow-x-auto no-scrollbar transition-colors ${
            themeMode === 'light'
              ? 'bg-[#F8F7F4]/95 border-[#E5E0D5]'
              : 'bg-[#111114]/95 border-white/10'
          }`}
        >
          {currentSubmenus.map((sub) => {
            if (sub.id === 'trial' && isCurrentLoungeSubscribed) {
              return null;
            }
            if (
              activeLoungeType === 'personal' &&
              sub.id === 'settings' &&
              isStoreAppMode &&
              !enableSetupMonster
            ) {
              return null;
            }
            const isSubActive = mobileTab === sub.id;
            return (
              <button
                key={sub.id}
                type="button"
                onClick={() => {
                  if (sub.id === 'share') {
                    setActiveLoungeType('family');
                    setMobileTab('search');
                  } else {
                    setMobileTab(sub.id);
                  }
                }}
                title={sub.subcaption ? `${sub.label} — ${sub.subcaption}` : sub.label}
                className={`px-3.5 py-2 rounded-t-xl border-b-[3px] font-label-sm text-[12.5px] flex items-center gap-1 transition-all shrink-0 whitespace-nowrap outline-none focus:outline-none ${
                  isSubActive
                    ? themeMode === 'light'
                      ? 'bg-[#EAF8F6] text-[#0D9488] border-[#0D9488] font-extrabold'
                      : 'bg-primary-container/15 text-primary-container border-primary-container font-extrabold'
                    : themeMode === 'light'
                    ? 'border-transparent text-slate-800 hover:text-[#0D9488] font-bold'
                    : 'border-transparent text-zinc-400 hover:text-white font-bold'
                }`}
              >
                <div className="flex flex-col items-center">
                  <span>{sub.label}</span>
                  {sub.subcaption && (
                    <span className="text-[9px] opacity-60 font-normal">
                      {sub.subcaption}
                    </span>
                  )}
                </div>
                {sub.showTrashCount && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                      isSubActive
                        ? themeMode === 'light'
                          ? 'bg-[#0D9488]/15 text-[#0D9488]'
                          : 'bg-primary-container/20 text-primary-container'
                        : themeMode === 'light'
                        ? 'bg-slate-200/80 text-slate-600'
                        : 'bg-zinc-800 text-zinc-300'
                    }`}
                  >
                    {activeTrashCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* [모바일 친절한 2단계 온보딩 안내 배너: ① 이메일 무료 로그인 ➔ ② Z-코어 연결] */}
      {(!merlinAuth?.token || !zCoreBridge.isConnected) && (
        <div className="px-3.5 pt-2.5">
          <div
            className={`rounded-2xl border p-3 flex flex-col gap-2 text-xs ${
              themeMode === 'light'
                ? 'bg-teal-50/90 border-teal-300 text-slate-800'
                : 'bg-teal-950/35 border-teal-500/35 text-zinc-200'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="px-2 py-0.5 rounded-full bg-[#00F0B5]/20 text-teal-700 dark:text-[#00F0B5] font-black text-[10.5px]">
                🚀 2단계 준비 안내
              </span>
              <span className="text-[10.5px] opacity-80 font-bold">
                ① 이메일 로그인 ➔ ② Z-코어 연결
              </span>
            </div>
            <p className="text-[11.5px] leading-snug font-semibold">
              {!merlinAuth?.token
                ? '개인 라운지(찾기·치우기·고치기)는 [① 10초 이메일 무료 로그인] 완료 후 모든 기능이 실행됩니다.'
                : '✅ 1단계 로그인 완료! PC 폴더 투시·수리 연동은 [② 멀린 Z-코어 안내]를 눌러 확인하세요.'}
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('openLoginModal'))}
                className={`py-2 px-2.5 rounded-xl font-extrabold text-[11px] transition-all cursor-pointer ${
                  merlinAuth?.token
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30'
                    : 'bg-[#00F0B5] text-slate-950 shadow-sm'
                }`}
              >
                {merlinAuth?.token ? '① 로그인 완료 ✅' : '① 10초 이메일 로그인'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!merlinAuth?.token) {
                    useSaySeeStore
                      .getState()
                      .showToast('먼저 1단계 [10초 이메일 무료 로그인]을 완료해 주세요!');
                    window.dispatchEvent(new CustomEvent('openLoginModal'));
                    return;
                  }
                  setShowZCoreGuideModal(true);
                }}
                className={`py-2 px-2.5 rounded-xl font-extrabold text-[11px] transition-all cursor-pointer ${
                  zCoreBridge.isConnected
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30'
                    : merlinAuth?.token
                    ? 'bg-[#00F0B5] text-slate-950 shadow-sm'
                    : 'bg-zinc-800/80 text-zinc-400 border border-white/10'
                }`}
              >
                {zCoreBridge.isConnected ? '② Z-코어 연결됨 ✅' : '② 멀린 Z-코어 안내'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 서브메뉴 1번: ✨ 1초 진단 & 공유 시작 (정식 구독 시 Auto-Hide) */}
      {mobileTab === 'trial' && <LoungeView />}

      {/* 서브메뉴 2번: 메인 피드 & 파워 검색 */}
      {mobileTab === 'search' && (
        <main className="flex-1 w-full px-3.5 pt-3.5 pb-8 flex flex-col gap-4">
          <LoungeFeedContextBanner />

          {/* 1층: 검색창 + 3대 카테고리 탭 + 1줄 추천 칩 / 2층: 접이식 브리핑 아코디언 */}
          <VoiceHeroStage />

          {/* 검색 결과 영역 */}
          <div id="ghosti-search-results" className="scroll-mt-16">
            {searchSpace === 'video' ? (
              <section className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between px-0.5">
                  <span className="font-headline-sm text-[14.5px] text-white font-bold">
                    🎬 동영상 구간 포착 ({matchedVideoScenes.length}개 · 좌우 스와이프)
                  </span>
                  {matchedVideoScenes.length < videoSceneItems.length && (
                    <button
                      onClick={() => resetSearchSpaceToAll('video')}
                      className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-white/10 text-primary-container font-label-sm text-[11px] font-bold"
                    >
                      🔄 {videoSceneItems.length}개 전체 보기
                    </button>
                  )}
                </div>

                {/* [처방 4] 모바일 스크롤 지옥 해방: 세로 나열 대신 좌우 스와이프 카드덱(Horizontal Snap Carousel)! */}
                <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-2 no-scrollbar">
                  {matchedVideoScenes.map((vid, idx) => (
                    <article
                      key={vid.id}
                      onClick={() => setSelectedVideoModal(vid, vid.matchedSeekSec)}
                      className={`${
                        matchedVideoScenes.length === 1 ? 'w-full' : 'min-w-[86%]'
                      } snap-center rounded-2xl overflow-hidden bg-[#18181B] border border-white/10 flex flex-col cursor-pointer shrink-0`}
                    >
                      <div className="relative aspect-video w-full bg-black">
                        <video
                          key={`${vid.id}-${vid.matchedSeekSec}`}
                          src={`${vid.videoUrl}#t=${vid.matchedSeekSec}`}
                          poster={vid.thumbUrl}
                          preload="metadata"
                          muted
                          playsInline
                          onLoadedMetadata={(e) => {
                            try {
                              e.currentTarget.currentTime = vid.matchedSeekSec;
                            } catch {
                              // ignore
                            }
                          }}
                          className="w-full h-full object-cover pointer-events-none"
                        />
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                          <div className="w-10 h-10 rounded-full bg-black/75 border border-white/20 text-white flex items-center justify-center">
                            <span className="material-symbols-outlined text-[22px]">play_arrow</span>
                          </div>
                        </div>
                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-zinc-950/90 border border-white/15 text-primary-container font-label-mono text-[10.5px] font-bold">
                          {vid.matchedTimestamp}
                        </div>
                        <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-zinc-950/80 border border-white/10 text-zinc-300 font-label-mono text-[10px]">
                          #{idx + 1} · {vid.durationText} ({vid.timelineFrames.length}구간)
                        </div>
                      </div>

                      <div className="p-3.5 flex flex-col gap-2">
                        <h4 className="font-headline-sm text-[14px] text-white font-bold truncate">
                          {vid.title}
                        </h4>
                        <p className="font-body-sm text-[11.5px] text-zinc-300 bg-zinc-950/80 border border-white/10 rounded-lg p-2 line-clamp-2">
                          {vid.matchedFrameCaption}
                        </p>
                        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                          {vid.timelineFrames.map((frame) => {
                            const isMatched = vid.matchedSeekSec === frame.timeSec;
                            return (
                              <button
                                key={frame.timeSec}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedVideoModal(vid, frame.timeSec);
                                }}
                                className={`px-2 py-0.5 rounded font-label-mono text-[10px] font-bold shrink-0 ${
                                  isMatched
                                    ? 'bg-primary-container text-zinc-950 font-black'
                                    : 'bg-zinc-900 text-zinc-400 border border-white/5'
                                }`}
                              >
                                {frame.timestampText}
                              </button>
                            );
                          })}
                        </div>
                        <span className="font-label-mono text-[10.5px] text-zinc-400 pt-0.5 flex items-center justify-between">
                          <span>📍 {vid.locationKo}</span>
                          <span className="text-primary-container font-bold">▶ {vid.matchedTimestamp} 재생</span>
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : searchSpace === 'vault' ? (
              <section className="flex flex-col gap-3.5">
                <div className="flex items-center justify-between px-0.5">
                  <span className="font-headline-sm text-[14.5px] text-white font-bold">
                    📁 스마트 서류함 (문서 {matchedLocalDocs.length}건 · 사진 {matchedVaultPhotos.length}장)
                  </span>
                </div>

                {/* 로컬 PDF 문서: 모바일 가로 스와이프 카드덱(Horizontal Snap Carousel) */}
                {matchedLocalDocs.length > 0 && (
                  <div className="flex overflow-x-auto snap-x snap-mandatory gap-2.5 pb-1 no-scrollbar">
                    {matchedLocalDocs.map((doc) => (
                      <article
                        key={doc.id}
                        onClick={() => setSelectedDocModal(doc)}
                        className="min-w-[82%] snap-center p-3.5 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-1.5 cursor-pointer shrink-0"
                      >
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded bg-zinc-800 border border-white/10 text-amber-400 font-label-mono text-[10px] font-bold">
                            {doc.ext} • {doc.categoryBadge}
                          </span>
                          <span className="font-label-mono text-[10px] text-zinc-400">
                            {doc.date}
                          </span>
                        </div>
                        <h4 className="font-headline-sm text-[14px] text-white font-bold truncate">
                          {doc.title}
                        </h4>
                        <p className="font-body-sm text-[12px] text-zinc-400 line-clamp-2">
                          {doc.extractedText}
                        </p>
                      </article>
                    ))}
                  </div>
                )}

                {matchedVaultPhotos.length > 0 && (
                  <div className="grid grid-cols-2 gap-2.5 w-full">
                    {matchedVaultPhotos.map((item) => (
                      <article
                        key={item.photo.id}
                        onClick={() => setSelectedPhoto(item.photo, null)}
                        className="group relative rounded-2xl overflow-hidden bg-[#18181B] border border-white/10 flex flex-col cursor-pointer"
                      >
                        <div className="relative aspect-[4/5] w-full overflow-hidden bg-zinc-950">
                          <img
                            src={item.photo.thumbUrl}
                            alt={item.photo.name}
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-zinc-950/85 border border-white/15 text-zinc-200 font-label-sm text-[10px] font-semibold">
                            {item.photo.vaultCategoryLabel || item.photo.tags[0]}
                          </div>
                          <div className="absolute inset-x-0 bottom-0 h-[20%] min-h-[38px] px-2.5 pb-2 pt-3 bg-gradient-to-t from-black/90 via-black/55 to-transparent flex items-end justify-between">
                            <span className="font-label-sm text-[11px] font-semibold text-white">
                              {item.photo.date.split(' ')[0]}
                            </span>
                            <span className="font-label-sm text-[10.5px] font-medium text-zinc-300 truncate ml-1">
                              {item.photo.tags[0]}
                            </span>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            ) : (
              /* [🖼️ 전체 갤러리] 발견된 사진 그리드 */
              <section className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-headline-sm text-[15px] text-white font-bold">
                      “{activeQuery}” 검색 결과
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-zinc-900 border border-white/10 text-zinc-300 font-label-sm text-[11.5px] font-medium">
                      {searchResults.length}장
                    </span>
                  </div>

                  <button
                    onClick={() => setGroupBurstsInSearch(!groupBurstsInSearch)}
                    className={`px-2.5 py-1 rounded-lg font-label-sm text-[11px] font-medium border ${
                      groupBurstsInSearch
                        ? 'bg-zinc-900 border-white/20 text-white'
                        : 'bg-zinc-950 border-white/10 text-zinc-400'
                    }`}
                  >
                    {groupBurstsInSearch ? '❐ 연사 묶기 ON' : '연사 펼치기'}
                  </button>
                </div>

                {groupedResults.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2.5 w-full">
                    {groupedResults.map((group) => {
                      const item = group.representative;
                      const isBurst = group.burstCount >= 2;
                      return (
                        <article
                          key={item.photo.id}
                          onClick={() =>
                            setSelectedPhoto(item.photo, isBurst ? group.burstPhotos : null)
                          }
                          className="group relative rounded-2xl overflow-hidden bg-[#18181B] border border-white/10 flex flex-col cursor-pointer transition-transform active:scale-[0.98]"
                        >
                          <div className="relative aspect-[4/5] w-full overflow-hidden bg-zinc-950">
                            <img
                              src={item.photo.thumbUrl}
                              alt={item.photo.name}
                              loading="lazy"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />

                            {isBurst && (
                              <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-zinc-950/85 backdrop-blur-md border border-white/15 text-primary-container font-label-sm text-[10px] font-bold">
                                ❐ {group.burstCount}장 연사
                              </div>
                            )}

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleBookmark(item.photo.id);
                              }}
                              aria-label="즐겨찾기"
                              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white/80 hover:text-primary-container transition-colors"
                            >
                              <span className="material-symbols-outlined text-[15px]">
                                {item.photo.bookmarked ? 'bookmark_added' : 'favorite'}
                              </span>
                            </button>

                            <div className="absolute inset-x-0 bottom-0 h-[20%] min-h-[38px] px-2.5 pb-2 pt-3 bg-gradient-to-t from-black/90 via-black/55 to-transparent flex items-end justify-between pointer-events-none">
                              <span className="font-label-sm text-[11px] font-semibold text-white">
                                {item.photo.date.split(' ')[0]}
                              </span>
                              {item.photo.tags[0] && (
                                <span className="font-label-sm text-[10.5px] font-medium text-zinc-300 truncate ml-1">
                                  {item.photo.tags[0]}
                                </span>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-12 px-4 rounded-2xl bg-[#18181B] border border-white/10 text-center flex flex-col items-center gap-2">
                    <span className="material-symbols-outlined text-zinc-500 text-[34px]">
                      image_search
                    </span>
                    <p className="font-headline-sm text-[14px] text-zinc-300 font-semibold">
                      일치하는 사진을 찾지 못했습니다 (0장)
                    </p>
                  </div>
                )}
              </section>
            )}
          </div>
        </main>
      )}

      {/* 서브메뉴 3번: 개인은 [🩺 클린몬스터], 사진 공유(패밀리·동호·동창회)은 [⏳ AI 인덱싱 대기실] */}
      {mobileTab === 'trash' && (
        <div className="flex-1 w-full">
          {activeLoungeType === 'personal' ? (
            <SmartTrashView />
          ) : (
            <LoungeIndexingWaitingRoom />
          )}
        </div>
      )}

      {/* 서브메뉴 4번: AI 설정몬스터 / 초대 / 인증 & 정식 스토어 설치 가이드 */}
      {mobileTab === 'settings' && (
        <main className="flex-1 w-full px-4 pt-4 pb-10 flex flex-col gap-3.5">
          <LoungeCustomSettingsHeader />

          {/* 노션 스타일 동적 토글 1: 폰↔PC 프라이빗 싱크 & 로컬 폴더 열기 */}
          <section className="rounded-2xl bg-[#18181B] border border-white/10 overflow-hidden transition-all">
            <div
              onClick={() => setShowPrivateSyncSection((prev) => !prev)}
              className="p-4 flex items-center justify-between gap-2 cursor-pointer hover:bg-zinc-900/60 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-zinc-400 text-[12px] font-mono select-none">
                  {showPrivateSyncSection ? '▾' : '▸'}
                </span>
                <div className="flex flex-col min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h2 className="font-headline-sm text-[14.5px] text-white font-bold">
                      🔄 폰↔PC 프라이빗 싱크 &amp; 로컬 폴더 관리
                    </h2>
                    <span className="px-2 py-0.5 rounded-full bg-zinc-900 border border-white/10 text-primary-container font-label-sm text-[10.5px] font-bold">
                      {syncState.privateSyncStrategy === 'mirror' ? '모드 A · 100% 원본 미러링' : '모드 B · 폰 용량 99.4% 절약'}
                    </span>
                  </div>
                  <p className="font-body-sm text-[11.5px] text-zinc-400 truncate mt-0.5">
                    Wi-Fi + 충전 중 자동 동기화 · 마지막 일치화: {syncState.lastSyncedAt}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={syncState.syncing}
                onClick={(e) => {
                  e.stopPropagation();
                  void triggerSyncNow();
                }}
                className="px-3 py-1.5 rounded-xl bg-primary-container text-zinc-950 font-label-sm text-[11.5px] font-extrabold shrink-0"
              >
                {syncState.syncing ? '일치화 중...' : '⚡ 지금 일치시키기'}
              </button>
            </div>

            {showPrivateSyncSection && (
              <div className="px-4 pb-4 pt-3 border-t border-white/10 flex flex-col gap-3">
                <div className="p-3.5 rounded-xl bg-zinc-950/90 border border-white/10 flex flex-col gap-1.5">
                  <span className="px-2 py-0.5 rounded bg-zinc-800 border border-white/10 text-zinc-300 font-label-sm text-[10.5px] font-semibold w-fit">
                    🔋 배터리 · OS 제재 방어 원칙
                  </span>
                  <p className="font-body-sm text-[11.5px] text-zinc-300 leading-relaxed">
                    귀신같이(Ghosti) 정식 모바일 앱(Google Play / App Store)은 배터리를 소모하는 상시 통신을 하지 않으며,{' '}
                    <strong className="text-white">[집 Wi-Fi 연결 + 충전 중]</strong>이거나{' '}
                    <strong className="text-primary-container">[지금 일치시키기]</strong> 버튼을 누를 때만 작동합니다.
                  </p>
                </div>

                <div
                  onClick={() => setPrivateSyncStrategy('mirror')}
                  className={`p-3.5 rounded-xl border cursor-pointer flex flex-col gap-1.5 ${
                    syncState.privateSyncStrategy === 'mirror'
                      ? 'bg-zinc-900 border-primary-container'
                      : 'bg-zinc-950/80 border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-headline-sm text-[13.5px] text-white font-bold">
                      🔄 모드 A. 100% 원본 미러링 모드
                    </span>
                    <input
                      type="radio"
                      checked={syncState.privateSyncStrategy === 'mirror'}
                      onChange={() => setPrivateSyncStrategy('mirror')}
                      className="w-4 h-4 accent-[#00E5FF]"
                    />
                  </div>
                  <p className="font-body-sm text-[11.5px] text-zinc-400">
                    여유 공간 넉넉할 때: 폰과 PC 양쪽 기기에 똑같은 원본 파일을 유지하여 상호 백업 보험 구축.
                  </p>
                </div>

                <div
                  onClick={() => setPrivateSyncStrategy('shadow')}
                  className={`p-3.5 rounded-xl border cursor-pointer flex flex-col gap-1.5 ${
                    syncState.privateSyncStrategy === 'shadow'
                      ? 'bg-zinc-900 border-primary-container'
                      : 'bg-zinc-950/80 border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-headline-sm text-[13.5px] text-white font-bold">
                      👻 모드 B. 초경량 섀도우 캐시 모드 (권장)
                    </span>
                    <input
                      type="radio"
                      checked={syncState.privateSyncStrategy === 'shadow'}
                      onChange={() => setPrivateSyncStrategy('shadow')}
                      className="w-4 h-4 accent-[#00E5FF]"
                    />
                  </div>
                  <p className="font-body-sm text-[11.5px] text-zinc-400">
                    무거운 원본은 집 PC로 이관하고 폰에는 장당 13KB WebP 썸네일+768d 벡터만 남김 (단 {syncState.packSizeMB}MB). 집 PC 전원이 꺼져도 밖에서 1초 만에 100% 검색·열람 가능!
                  </p>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => void openLocalFolder('photos')}
                    className="flex-1 py-2 rounded-xl bg-zinc-950 text-zinc-300 font-label-sm text-[11.5px] font-medium border border-white/10"
                  >
                    사진 폴더
                  </button>
                  <button
                    onClick={() => void openLocalFolder('docs')}
                    className="flex-1 py-2 rounded-xl bg-zinc-950 text-zinc-300 font-label-sm text-[11.5px] font-medium border border-white/10"
                  >
                    서류함 폴더
                  </button>
                  <button
                    onClick={() => void openLocalFolder('quarantine')}
                    className="flex-1 py-2 rounded-xl bg-zinc-950 text-zinc-300 font-label-sm text-[11.5px] font-medium border border-white/10"
                  >
                    대기함 열기
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* 노션 스타일 동적 토글 2: 데스크톱 연동 가이드 · 탈퇴 데이터 원칙 & 스토어 심사 안전장치 */}
          <section className="rounded-2xl bg-[#18181B] border border-white/10 overflow-hidden transition-all">
            <div
              onClick={() => setShowPolicyAndStoreSection((prev) => !prev)}
              className="p-4 flex items-center justify-between gap-2 cursor-pointer hover:bg-zinc-900/60 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-zinc-400 text-[12px] font-mono select-none">
                  {showPolicyAndStoreSection ? '▾' : '▸'}
                </span>
                <div className="flex flex-col">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h2 className="font-headline-sm text-[14.5px] text-white font-bold">
                      🛡️ 데스크톱 연동 · 탈퇴 데이터 보호 원칙 &amp; 스토어 심사 모드
                    </h2>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/35 text-emerald-300 font-label-sm text-[10.5px] font-bold">
                      {isStoreAppMode ? '📱 스토어 클린 ON' : '💻 PC 마스터 모드'}
                    </span>
                  </div>
                  <p className="font-body-sm text-[11.5px] text-zinc-400 mt-0.5">
                    PC 마스터 연동 안내 · 탈퇴 시 썸네일 DB 처리 원칙 · 3중 안전장치
                  </p>
                </div>
              </div>
              <span className="text-[11.5px] font-bold text-zinc-400 shrink-0">
                {showPolicyAndStoreSection ? '접기 ▴' : '펼치기 ▾'}
              </span>
            </div>

            {showPolicyAndStoreSection && (
              <div className="px-4 pb-4 pt-3 border-t border-white/10 flex flex-col gap-3">
                {/* 💻 모바일 ➔ PC 전환 시 스토어 규정(Anti-steering)을 100% 준수하는 데스크톱 기기 연동 패널 */}
                <PcMasterQuickSendPanel compact />

                {/* 🔄 내 기기 원본 동기화 & 🚪 탈퇴(자퇴·강퇴) 시 데이터 처리 기준 */}
                <div className="p-3.5 rounded-xl bg-zinc-950/90 border border-primary-container/40 flex flex-col gap-2">
                  <span className="px-2.5 py-0.5 rounded bg-primary-container text-zinc-950 font-label-sm text-[10.5px] font-extrabold w-fit">
                    🔄 내 기기 원본 동기화 &amp; 🚪 탈퇴 시 데이터 처리 원칙
                  </span>
                  <h3 className="font-headline-sm text-[14px] text-white font-bold">
                    방장 PC 소환 없이 내 기기 동기화로 자체 해결 &amp; 탈퇴 시 썸네일 DB 즉시 삭제
                  </h3>
                  <p className="font-body-sm text-[11.5px] text-zinc-200 leading-relaxed bg-zinc-900/80 p-3 rounded-xl border border-white/10">
                    • <strong>평소(기본):</strong> 기기 내 보이지 않는 시스템 영역(<code>%LOCALAPPDATA%\Merlin\thumb_db</code>)에 <strong>13KB 썸네일 DB</strong>만 보관하여 0.01초 만에 검색합니다.<br />
                    • <strong>원본 동기화 ON:</strong> Wi-Fi 및 여유 공간이 충분할 때 지정한 내 폴더로 원본을 자동 복제해 내 기기에서 100% 자체 해결합니다.<br />
                    • <strong>탈퇴(자퇴 · 강퇴 동일):</strong> 탈퇴/강퇴 즉시 해당 방 계정 아웃 처리되며, 숨김 영역의 <strong>그 공유방 썸네일 DB · 공유방 검색 인덱스 · 해당 방 내부 타 멤버 여권 목록만 즉시 자동 삭제</strong>됩니다 (※ 내 PC·계정의 ‘나 자신의 귀신같이 여권’ 및 ‘내 기기 개인 인덱스’는 100% 보존되며, 기동기화된 원본 폴더도 각자 자율 관리).
                  </p>
                </div>

                {/* 🛡️ 스토어 1차 심사 통과용 3중 안전장치 제어 */}
                <div className="p-3.5 rounded-xl bg-zinc-950/90 border border-white/10 flex flex-col gap-2.5">
                  <span className="px-2.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-400/35 text-emerald-300 font-label-sm text-[10.5px] font-bold w-fit">
                    스토어 1차 출시 3중 안전장치 (Anti-steering 완벽 방어)
                  </span>
                  <p className="font-body-sm text-[11.5px] text-zinc-400">
                    ‘주소/URL/결제’ 단어를 배제하고 순수 데스크톱 기기 연동 워딩을 사용하며, 코인 잔액·가이드 버튼 노출 및 <code>/?master=pc</code> 모바일 방어 화면을 1초 만에 제어합니다.
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => setIsStoreAppMode(!isStoreAppMode)}
                      className={`py-2 px-3 rounded-xl font-label-sm text-[11.5px] font-extrabold border ${
                        isStoreAppMode
                          ? 'bg-emerald-400 text-zinc-950 border-emerald-300'
                          : 'bg-zinc-900 text-zinc-200 border-white/15'
                      }`}
                    >
                      {isStoreAppMode ? '📱 스토어 심사 클린 모드: ON' : '💻 PC 마스터 모드 (클릭 시 스토어 모드)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEnableSetupMonster(!enableSetupMonster)}
                      className={`py-2 px-3 rounded-xl font-label-sm text-[11.5px] font-extrabold border ${
                        enableSetupMonster
                          ? 'bg-primary-container text-zinc-950 border-primary-container'
                          : 'bg-zinc-900 text-zinc-400 border-white/15'
                      }`}
                    >
                      {enableSetupMonster
                        ? '🛠️ 설정몬스터 (enableSetupMonster=true)'
                        : '🔒 설정몬스터 숨김 (enableSetupMonster=false)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEnableMobileCoinDisplay(!enableMobileCoinDisplay)}
                      className={`py-2 px-3 rounded-xl font-label-sm text-[11.5px] font-extrabold border ${
                        enableMobileCoinDisplay
                          ? 'bg-amber-400 text-zinc-950 border-amber-300'
                          : 'bg-zinc-900 text-zinc-400 border-white/15'
                      }`}
                    >
                      {enableMobileCoinDisplay
                        ? '🪙 코인 잔액 표시: ON'
                        : '🔒 코인 잔액 완전 숨김: OFF (기본값)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEnablePcGuideShareButton(!enablePcGuideShareButton)}
                      className={`py-2 px-3 rounded-xl font-label-sm text-[11.5px] font-extrabold border ${
                        enablePcGuideShareButton
                          ? 'bg-[#FEE500] text-[#191919] border-[#FEE500]'
                          : 'bg-zinc-900 text-zinc-400 border-white/15'
                      }`}
                    >
                      {enablePcGuideShareButton
                        ? '💬 카톡·이메일 가이드 버튼: ON'
                        : '🔒 카톡·이메일 가이드 버튼: OFF (심사 잠금)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowMobileMasterPcIntroModal(true)}
                      className="py-2 px-3 rounded-xl font-label-sm text-[11.5px] font-extrabold border bg-zinc-900 text-primary-container border-primary-container/50"
                    >
                      🛡️ /?master=pc 모바일 접속 시 방어 화면 보기
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </main>
      )}

      {/* 모바일 하단 서브메뉴 바: 선택된 라운지 전용 서브메뉴 연동 */}
      <nav className="fixed bottom-0 inset-x-0 max-w-xl mx-auto h-15 bg-[#09090B]/95 backdrop-blur-xl border-t border-white/10 z-50 px-2 flex items-center justify-around">
        {currentSubmenus.map((sub) => {
          if (sub.id === 'trial' && activePricingPlan !== 'free_trial') {
            return null;
          }
          const isSubActive = mobileTab === sub.id;
          return (
            <button
              key={sub.id}
              onClick={() => {
                if (sub.id === 'share') {
                  setActiveLoungeType('family');
                  setMobileTab('search');
                } else {
                  setMobileTab(sub.id);
                }
              }}
              title={sub.subcaption ? `${sub.label} — ${sub.subcaption}` : sub.label}
              className={`flex-1 py-2 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all ${
                isSubActive
                  ? 'text-primary-container font-bold'
                  : 'text-zinc-400'
              }`}
            >
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-bold truncate max-w-[96px]">{sub.label}</span>
                {sub.showTrashCount && (
                  <span className="px-1.5 py-0.2 rounded-md bg-zinc-800 border border-white/10 text-zinc-300 text-[9.5px] font-mono font-bold">
                    {activeTrashCount}
                  </span>
                )}
              </div>
              {sub.subcaption && (
                <span className="text-[9px] opacity-60 truncate max-w-[96px]">
                  {sub.subcaption}
                </span>
              )}
            </button>
          );
        })}
      </nav>
      <MerlinZCoreGuideModal isOpen={showZCoreGuideModal} onClose={() => setShowZCoreGuideModal(false)} themeMode={themeMode} />
    </div>
  );
};
