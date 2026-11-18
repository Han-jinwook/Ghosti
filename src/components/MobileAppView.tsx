import React, { useEffect, useMemo, useState } from 'react';
import { zCoreBridge, isZCoreOutdated } from '../services/zCoreBridge';
import { useSaySeeStore, getActivePersonaForCluster, type MobileTab } from '../store/useSaySeeStore';
import { GhostiTopRightHubAnchor } from './GhostiHubInfraBridge';
import { GhostiBrandLogo } from './GhostiBrandLogo';
import { ZCoreEngineStatusBadge } from './ZCoreEngineStatusBadge';
import { MerlinZCoreGuideModal } from './MerlinZCoreGuideModal';
import type { FamilyRoomId, GpuHelperTierId, LoungeType, VideoSceneItem } from '../types/saysee';
import {
  cleanVideoTimestampLabel,
  groupBurstSearchResults,
  resolveVideoCardThumbUrl,
} from '../services/aiEngine';
import { executeRealOsAction } from '../services/setupMonsterEngine';
import { VoiceHeroStage } from './VoiceHeroStage';
import { Stage1MinimalCarePreview } from './Stage1MinimalPreview';
import { MobileCleanerRescueBanner } from './MobileCleanerRescueBanner';
import {
  LoungeCustomSettingsHeader,
  LoungeFeedContextBanner,
  LoungeIndexingWaitingRoom,
  LoungeView,
} from './LoungeView';
import { SampleSharedRoomExperienceCard } from '../domains/free_photo_share/SampleSharedRoomExperienceCard';
import {
  PcMasterQuickSendPanel,
  buildDocPreviewSnippet,
  renderHighlightedDocText,
  maskSensitiveDocText,
} from './PricingModal';

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
  { id: 'personal', label: '👻 귀신비서', iconId: 'personal', defaultLounge: 'personal' },
  { id: 'photo_share', label: '📸 사진 공유', iconId: 'family', defaultLounge: 'family' },
  { id: 'work', label: '💼 업무 공유(S:)', iconId: 'work', defaultLounge: 'work' },
];

const PHOTO_SHARE_GROUPS: Array<{ id: LoungeType; label: string }> = [
  { id: 'family', label: '👨‍👩‍👧‍👦 가족' },
  { id: 'club', label: '⛰️ 동호회·모임' },
  { id: 'student', label: '🎓 동창회' },
];

const FAMILY_ROOM_PILLS: Array<{ id: FamilyRoomId; label: string }> = [
  { id: '우리집', label: '🏠 우리집' },
  { id: '본가(친가)', label: '🏡 본가(친가)' },
  { id: '처가(친정)', label: '🌸 처가(친정)' },
];

const resolveMainMenuId = (lounge: LoungeType): MainMenuId =>
  PHOTO_SHARE_LOUNGES.includes(lounge) ? 'photo_share' : lounge === 'work' ? 'work' : 'personal';

const MOBILE_LOUNGE_SUBMENUS: Record<
  LoungeType,
  Array<{ id: MobileTab; label: string; subcaption?: string; showTrashCount?: boolean }>
> = {
  // [2026-11-17 멀린님 확정 — 모바일 3대 영역 일원화]:
  // 1) '👻 귀신비서(personal)'는 하위 탭으로 쪼개지 않고 단일 화면에서 [비서 대화 + 사진정리 + 1초 검색 + 내 기기 통합]을 원스톱 통합 관리!
  // 2) '📸 사진 공유'와 '💼 업무 공유(S:)'는 비서 채팅창 없이 순수 앨범/문서 피드·검색 및 초대/설정만 제공!
  personal: [],
  family: [
    { id: 'search', label: '우리집·본가·처가 앨범 피드' },
    { id: 'settings', label: '가족 초대 & 방 설정' },
  ],
  club: [
    { id: 'search', label: '모임 앨범 피드 & 검색' },
    { id: 'settings', label: '모임 관리 & 회원 초대' },
  ],
  student: [
    { id: 'search', label: '동창회 앨범 피드 & 검색' },
    { id: 'settings', label: '동창회 관리 & 동기 초대' },
  ],
  work: [
    { id: 'search', label: '공용 폴더(S:) 문서 검색' },
    { id: 'settings', label: '팀원 권한 & S: 드라이브' },
  ],
};

export const MobileAppView: React.FC = () => {
  const [showZCoreGuideModal, setShowZCoreGuideModal] = useState(false);

  useEffect(() => {
    const onOpenZCoreGuide = () => setShowZCoreGuideModal(true);
    window.addEventListener('openZCoreGuideModal', onOpenZCoreGuide);
    const unsub = zCoreBridge.subscribe((conn) => {
      if (
        conn &&
        typeof sessionStorage !== 'undefined' &&
        sessionStorage.getItem('ghosti_initial_indexing_done') !== '1' && isZCoreOutdated(zCoreBridge.version)
      ) {
        setShowZCoreGuideModal(true);
      }
    });
    return () => {
      window.removeEventListener('openZCoreGuideModal', onOpenZCoreGuide);
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
    syncRealVideoDuration,
    activeQuery,
    hasExecutedUserSearch,
    searchResults,
    groupBurstsInSearch,
    setGroupBurstsInSearch,
    setSelectedPhoto,
    toggleBookmark,
    removeSharedRoomPhoto,
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
    setActiveFamilyRoom,
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
  // (단, 가족·동호회·동창회 공유방에서는 사용자가 올린 사진이 1장으로 합쳐져 숨겨지지 않도록 개별 표시)
  const groupedResults = useMemo(() => {
    const isSharedLounge =
      activeLoungeType === 'family' ||
      activeLoungeType === 'club' ||
      activeLoungeType === 'student';
    if (!groupBurstsInSearch || searchSpace === 'vault' || isSharedLounge) {
      return searchResults.map((item) => ({
        representative: item,
        burstPhotos: [item.photo],
        burstCount: 1,
      }));
    }
    return groupBurstSearchResults(searchResults);
  }, [searchResults, groupBurstsInSearch, searchSpace, activeLoungeType]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [activeLoungeType, mobileTab, activeFamilyRoom]);

  const currentSubmenus = MOBILE_LOUNGE_SUBMENUS[activeLoungeType] || MOBILE_LOUNGE_SUBMENUS.personal;
  const isCurrentLoungeSubscribed = Boolean(subscribedLounges[activeLoungeType]);

  const handleImportMobileVideos = async (fileList: FileList) => {
    const files = Array.from(fileList).filter(
      (f) => f.type.startsWith('video/') || /\.(mp4|mov|webm|mkv|m4v)$/i.test(f.name)
    );
    if (files.length === 0) return;

    const probeVideoMeta = (blobUrl: string) =>
      new Promise<{ durationSec: number; width: number; height: number; thumbDataUrl: string }>(
        (resolve) => {
          const v = document.createElement('video');
          v.preload = 'auto';
          v.muted = true;
          v.playsInline = true;
          let settled = false;
          const finish = (res: {
            durationSec: number;
            width: number;
            height: number;
            thumbDataUrl: string;
          }) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            try {
              v.removeAttribute('src');
              v.load();
            } catch {
              /* ignore */
            }
            resolve(res);
          };
          const timer = window.setTimeout(() => {
            finish({ durationSec: 15, width: 1080, height: 1920, thumbDataUrl: '' });
          }, 2500);
          v.onloadeddata = () => {
            const dur =
              Number.isFinite(v.duration) && v.duration > 0 ? Math.max(1, Math.round(v.duration)) : 15;
            const w = v.videoWidth || 1080;
            const h = v.videoHeight || 1920;
            const seekTo = Math.min(0.6, Math.max(0, (v.duration || 1) * 0.15));
            const captureNow = () => {
              let thumb = '';
              try {
                const scale = Math.min(1, 540 / Math.max(w, h));
                const cw = Math.max(64, Math.round(w * scale));
                const ch = Math.max(64, Math.round(h * scale));
                const c = document.createElement('canvas');
                c.width = cw;
                c.height = ch;
                const ctx = c.getContext('2d');
                if (ctx) {
                  ctx.drawImage(v, 0, 0, cw, ch);
                  thumb = c.toDataURL('image/jpeg', 0.82);
                }
              } catch {
                /* ignore */
              }
              finish({ durationSec: dur, width: w, height: h, thumbDataUrl: thumb });
            };
            if (seekTo > 0.05) {
              v.onseeked = captureNow;
              try {
                v.currentTime = seekTo;
              } catch {
                captureNow();
              }
            } else {
              captureNow();
            }
          };
          v.onerror = () => finish({ durationSec: 15, width: 1080, height: 1920, thumbDataUrl: '' });
          v.src = blobUrl;
        }
      );

    const newItems: VideoSceneItem[] = [];
    for (const f of files) {
      const blobUrl = URL.createObjectURL(f);
      const meta = await probeVideoMeta(blobUrl);
      const mm = String(Math.floor(meta.durationSec / 60)).padStart(2, '0');
      const ss = String(meta.durationSec % 60).padStart(2, '0');
      const durTxt = `${mm}:${ss}`;
      const baseTitle = f.name.replace(/\.[^.]+$/, '');
      const dateStr = new Date(f.lastModified || Date.now()).toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
      newItems.push({
        id: `mobile_vid_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        videoFileName: f.name,
        title: baseTitle,
        keyframePhotoId: f.name,
        thumbUrl: meta.thumbDataUrl,
        videoUrl: blobUrl,
        date: dateStr,
        durationText: durTxt,
        durationSec: meta.durationSec,
        matchedSeekSec: 0,
        matchedTimestamp: '00:00',
        matchedFrameCaption: `내 스마트폰에서 불러온 동영상 (${f.name})`,
        locationKo: '📱 내 스마트폰 갤러리',
        sceneDescription:
          '내 스마트폰에서 직접 불러온 동영상입니다. 카드를 터치해 재생하거나 [📝 글자 뽑기]로 영상 속 자막·칠판 글자를 바로 추출할 수 있습니다.',
        keywords: [baseTitle, f.name, '내폰', '스마트폰', '동영상'],
        resolution: `${meta.width}x${meta.height} (내 스마트폰 동영상)`,
        sizeMB: Math.max(0.1, Number((f.size / 1048576).toFixed(1))),
        timelineFrames: [
          {
            frameId: `mf_${Date.now()}_0`,
            timeSec: 0,
            timestampText: '00:00',
            phaseLabel: '시작 구간',
            sceneCaption: `${baseTitle} 시작 장면`,
            keywords: [baseTitle],
            tags: ['#내폰동영상'],
            thumbUrl: meta.thumbDataUrl,
          },
        ],
      });
    }

    const curAll = useSaySeeStore.getState().videoSceneItems;
    const nextAll = [...newItems, ...curAll];
    useSaySeeStore.setState({
      videoSceneItems: nextAll,
      matchedVideoScenes: nextAll,
      searchSpace: 'video',
      hasUserSelectedSearchTab: true,
      lastQuarantineToast: `🎬 내 폰 동영상 ${newItems.length}개를 불러왔습니다! 카드를 눌러 재생하거나 [📝 글자 뽑기]를 눌러보세요.`,
    });
  };

  return (
    <div
      className={`bg-[#09090B] text-zinc-100 font-body-md flex flex-col min-h-screen min-h-dvh max-w-xl mx-auto relative shadow-2xl border-x border-white/10 ${
        currentSubmenus.length > 0 ? 'pb-24' : 'pb-12'
      }`}
    >
      {/* 상단 2단 통합 헤더 (뭐먹지? 스타일): 1단(화이트 바 + 흑백 라인 아이콘 메인메뉴 캡슐) + 2단(이모지 없는 언더라인 서브메뉴 탭) */}
      <header className="sticky top-0 inset-x-0 z-50 backdrop-blur-xl pt-safe">
        <div
          className={`px-3 py-2 flex flex-col gap-2 border-b transition-colors ${
            themeMode === 'light'
              ? 'bg-white/95 border-[#EAE8E1]'
              : 'bg-[#09090B]/95 border-white/10'
          }`}
        >
          <div className="flex items-center justify-between gap-1 flex-nowrap min-w-0">
            <div className="flex items-center gap-1 shrink-0 min-w-0">
              <GhostiBrandLogo
                size="mobile"
                autoCycle={false}
                themeMode={themeMode}
                showBadge={false}
                subtitle=""
                onClick={() => {
                  setActiveLoungeType('personal');
                  setMobileTab('trash');
                  useSaySeeStore.setState({
                    hasExecutedUserSearch: false,
                    hasUserSelectedSearchTab: false,
                  });
                }}
                className="shrink-0"
              />
            </div>

            {/* 우상단 심플 앵커: 가이드(모바일 웹 전용, 스토어 앱은 Anti-Steering 비노출) + 공유 아이콘 + 프로필(맨 우측) */}
            <div className="flex items-center gap-1 shrink-0 ml-auto" aria-label="가이드 공유 및 프로필 영역">
              {!isStoreAppMode && (
                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('ghosti_navigate_showroom'));
                  }}
                  title="공식 온보딩/가이드 페이지로 이동"
                  className={`px-2 py-1.5 rounded-lg font-bold text-[11px] flex items-center gap-0.5 shrink-0 whitespace-nowrap cursor-pointer ${
                    themeMode === 'light'
                      ? 'text-slate-600 hover:text-slate-900 hover:bg-black/5'
                      : 'text-zinc-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span>📖</span>
                  <span>가이드</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  const shareText =
                    '귀신같이(Ghosti) — 내 PC와 모바일에 1초 초능력을! 광고 0% · 클라우드 월세 0원 평생 무료 (초대받은 가족·회원·직원도 언제나 0원) https://ghosti.sundreamer.app';
                  if (typeof navigator !== 'undefined' && navigator.clipboard) {
                    void navigator.clipboard.writeText(shareText);
                  }
                  useSaySeeStore.setState({
                    lastQuarantineToast: '💌 [앱 공유 링크 복사됨] "초대받은 가족·회원·직원은 언제나 무료입니다" 안내가 클립보드에 준비되었습니다!',
                  });
                }}
                title="지인·가족에게 앱 공유하기"
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 cursor-pointer outline-none ${
                  themeMode === 'light'
                    ? 'text-slate-500 hover:text-slate-800 hover:bg-black/5'
                    : 'text-zinc-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">share</span>
              </button>
              <GhostiTopRightHubAnchor themeMode={themeMode} />
            </div>
          </div>

          {/* 모바일 공식 마스터 슬로건 한 줄 띠 (SSOT v2.3 18자 대표 H1) */}
          <div
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold text-center truncate ${
              themeMode === 'light'
                ? 'bg-teal-50/80 border-teal-200 text-teal-950'
                : 'bg-zinc-900/80 border-teal-500/20 text-zinc-200'
            }`}
            title="내 PC와 모바일에 1초 초능력을 — 광고 0% · 클라우드 월세 0원"
          >
            <span className="text-teal-600 dark:text-teal-400">내 PC와 모바일에 1초 초능력을</span>{' '}
            <span className="opacity-30">|</span>{' '}
            <span className="text-emerald-600 dark:text-emerald-400">광고 0% · 클라우드 월세 0원</span>
          </div>

          {/* 1단 메인메뉴 3개 (① 👻 귀신비서 / ② 📸 사진 공유 / ③ 💼 업무 공유(S:)): 균등 3분할 캡슐 */}
          <nav className="grid grid-cols-3 gap-1">
            {MAIN_LOUNGE_MENUS.map((menu) => {
              const active = resolveMainMenuId(activeLoungeType) === menu.id;
              return (
                <button
                  key={menu.id}
                  type="button"
                  onClick={() => {
                    if (active) return;
                    setActiveLoungeType(menu.defaultLounge);
                    if (menu.id === 'personal') {
                      setMobileTab('trash');
                    } else {
                      setMobileTab('search');
                    }
                  }}
                  className={`px-1.5 py-2 rounded-full font-label-sm text-[11.5px] flex items-center justify-center gap-1 transition-all whitespace-nowrap outline-none focus:outline-none cursor-pointer ${
                    active
                      ? themeMode === 'light'
                        ? 'bg-[#E6F7F5] text-[#0D9488] font-extrabold shadow-2xs'
                        : 'bg-zinc-800 text-primary-container font-extrabold'
                      : themeMode === 'light'
                      ? 'bg-slate-100/80 text-slate-600 hover:text-slate-900 font-bold'
                      : 'bg-zinc-900/70 text-zinc-400 hover:text-white font-bold'
                  }`}
                >
                  <span>{menu.label}</span>
                </button>
              );
            })}
          </nav>

          {/* 사진 공유 하위 선택: 패밀리 ↔ 동호회·모임 ↔ 동창회 + (가족일 때 우리집/본가/처가) */}
          {resolveMainMenuId(activeLoungeType) === 'photo_share' && (
            <div className="flex flex-col gap-1.5 -mt-0.5">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {PHOTO_SHARE_GROUPS.map((group) => {
                  const groupActive = activeLoungeType === group.id;
                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => {
                        if (!groupActive) {
                          setActiveLoungeType(group.id);
                          setMobileTab('search');
                        }
                      }}
                      className={`px-2.5 py-1.5 rounded-lg border text-[11.5px] shrink-0 whitespace-nowrap transition-all outline-none focus:outline-none cursor-pointer ${
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

              {activeLoungeType === 'family' && (
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  {FAMILY_ROOM_PILLS.map((room) => {
                    const roomActive = activeFamilyRoom === room.id;
                    return (
                      <button
                        key={room.id}
                        type="button"
                        onClick={() => {
                          setActiveFamilyRoom(room.id);
                          if (mobileTab !== 'search') setMobileTab('search');
                        }}
                        className={`px-2.5 py-1 rounded-full border text-[11px] shrink-0 whitespace-nowrap transition-all cursor-pointer ${
                          roomActive
                            ? 'bg-[#0D9488] border-[#0D9488] text-white font-extrabold'
                            : themeMode === 'light'
                            ? 'bg-white border-slate-200 text-slate-600 font-bold'
                            : 'bg-zinc-900 border-white/10 text-zinc-300 font-bold'
                        }`}
                      >
                        {room.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 2단 서브메뉴 바: 사진 공유 / 업무 공유일 때만 노출 (귀신비서는 단일 통합 화면이므로 서브탭 없음) */}
        {currentSubmenus.length > 0 && (
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
        )}
      </header>

      {/* 서브메뉴 1번: ✨ 1초 진단 & 공유 시작 (정식 구독 시 Auto-Hide) */}
      {activeLoungeType !== 'personal' && mobileTab === 'trial' && <LoungeView />}

      {/* [모바일 통합 1번 영역: 👻 귀신비서 (비서 대화 + 사진 정리 + 1초 검색 + 내 기기 통합 원스톱)] & [공유방 검색 피드] */}
      {(activeLoungeType === 'personal' || mobileTab === 'search') && (
        <main className="flex-1 w-full px-3 sm:px-4 pt-3.5 pb-8 flex flex-col gap-4">
          {activeLoungeType !== 'personal' && <LoungeFeedContextBanner />}

          {/* 1층: 통합 검색·음성 바 (업무 공유 S:는 자체 전용 문서 검색창이 있으므로 제외) */}
          {activeLoungeType !== 'work' && <VoiceHeroStage />}

          {activeLoungeType === 'personal' &&
            ((hasExecutedUserSearch && Boolean(activeQuery.trim())) ||
              searchSpace === 'video' ||
              searchSpace === 'vault') && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-teal-500/15 border border-teal-400/50 text-teal-200 text-[12px] font-extrabold">
              <span className="min-w-0 truncate">
                {hasExecutedUserSearch && Boolean(activeQuery.trim())
                  ? `🔍 “${activeQuery}” 통합 검색 결과`
                  : searchSpace === 'video'
                  ? `🎬 동영상 바로보기 (${matchedVideoScenes.length}개)`
                  : `📁 문서·서류함 바로보기 (${matchedLocalDocs.length + matchedVaultPhotos.length}건)`}
              </span>
              <button
                type="button"
                onClick={() => {
                  setSearchSpace('gallery');
                  useSaySeeStore.setState({
                    activeQuery: '',
                    hasExecutedUserSearch: false,
                    hasUserSelectedSearchTab: false,
                  });
                }}
                className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white border border-white/15 text-[11px] font-black shrink-0 cursor-pointer"
              >
                ✕ 닫고 비서 홈으로
              </button>
            </div>
          )}

          {/* 검색 결과 영역 (공유 사진방에서는 상시 노출, 귀신비서에서는 검색 실행 시 또는 [동영상]/[문서] 탭 직접 선택 시 즉시 인플레이스 노출) */}
          {activeLoungeType !== 'work' &&
            (activeLoungeType !== 'personal' ||
              searchSpace === 'video' ||
              searchSpace === 'vault' ||
              (hasExecutedUserSearch && Boolean(activeQuery.trim()))) && (
          <div id="ghosti-search-results" className="scroll-mt-16">
            {searchSpace === 'video' ? (
              <section className="flex flex-col gap-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
                  <span className="font-headline-sm text-[14.5px] text-white font-bold">
                    {hasExecutedUserSearch && activeQuery
                      ? `🎬 “${activeQuery}” 장면 검색 결과 (${matchedVideoScenes.length}개)`
                      : zCoreBridge.isConnected
                      ? `🎬 전체 동영상 (${matchedVideoScenes.length}개)`
                      : `🎬 동영상 (${matchedVideoScenes.length}개 · 체험 샘플 포함)`}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {!zCoreBridge.isConnected && (
                      <label className="px-2.5 py-1 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 border border-teal-400/50 text-teal-200 font-label-sm text-[11px] font-extrabold cursor-pointer">
                        📱 내 폰 영상 열기
                        <input
                          type="file"
                          accept="video/*"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                              void handleImportMobileVideos(e.target.files);
                              e.target.value = '';
                            }
                          }}
                        />
                      </label>
                    )}
                    {matchedVideoScenes.length < videoSceneItems.length && (
                      <button
                        onClick={() => resetSearchSpaceToAll('video')}
                        className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-white/10 text-primary-container font-label-sm text-[11px] font-bold"
                      >
                        🔄 {videoSceneItems.length}개 전체 보기
                      </button>
                    )}
                  </div>
                </div>

                {/* [처방 4] 모바일 스크롤 지옥 해방: 세로 나열 대신 좌우 스와이프 카드덱(Horizontal Snap Carousel)! */}
                <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-2 no-scrollbar">
                  {matchedVideoScenes.map((vid) => {
                    const cardThumbUrl = resolveVideoCardThumbUrl(vid);
                    const isWholeClip = (vid.matchedSeekSec ?? 0) <= 0;
                    const cleanTs = cleanVideoTimestampLabel(vid.matchedTimestamp);
                    return (
                    <article
                      key={vid.id}
                      onClick={() => setSelectedVideoModal(vid, vid.matchedSeekSec)}
                      className={`${
                        matchedVideoScenes.length === 1 ? 'w-full' : 'min-w-[86%]'
                      } snap-center rounded-2xl overflow-hidden bg-[#18181B] border border-white/10 flex flex-col cursor-pointer shrink-0`}
                    >
                      <div className="relative aspect-video w-full bg-black">
                        {cardThumbUrl ? (
                          <img
                            src={cardThumbUrl}
                            alt={vid.title}
                            loading="lazy"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                            }}
                            className="w-full h-full object-cover pointer-events-none"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 text-zinc-400 gap-1 p-3 text-center">
                            <span className="material-symbols-outlined text-2xl text-primary-container/80">movie</span>
                            <span className="text-[11px] font-medium truncate max-w-[85%]">{vid.title}</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                          <div className="w-10 h-10 rounded-full bg-black/75 border border-white/20 text-white flex items-center justify-center">
                            <span className="material-symbols-outlined text-[22px]">play_arrow</span>
                          </div>
                        </div>
                        {hasExecutedUserSearch && activeQuery && (
                          <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-zinc-950/90 border border-primary-container/50 text-primary-container font-label-mono text-[10.5px] font-bold">
                            {isWholeClip ? '🎯 전 구간 일치 (00:00~)' : `🎯 ${cleanTs} 장면 포착`}
                          </div>
                        )}
                        <div className="absolute top-2 right-2 px-2.5 py-0.5 rounded bg-zinc-950/90 border border-white/15 text-white font-label-mono text-[10.5px] font-extrabold">
                          ⏱️ {vid.durationText}
                        </div>
                        {vid.hasScreenOcrText && (
                          <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-amber-400 text-zinc-950 font-label-sm text-[10px] font-black shadow-sm">
                            ✨ 화면 글자 감지됨
                          </div>
                        )}
                        <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/85 border border-white/20 text-emerald-300 font-label-mono text-[10.5px] font-extrabold">
                          ▶ {vid.durationText}
                        </div>
                      </div>

                      <div className="p-3.5 flex flex-col gap-2">
                        <h4 className="font-headline-sm text-[14px] text-white font-bold truncate">
                          {vid.title}
                        </h4>
                        {hasExecutedUserSearch && activeQuery && (
                          <p className="font-body-sm text-[11.5px] text-zinc-200 bg-zinc-950/80 border border-primary-container/30 rounded-lg p-2 line-clamp-2">
                            {vid.matchedFrameCaption}
                          </p>
                        )}
                        <div className="font-label-mono text-[10.5px] text-zinc-400 pt-0.5 flex items-center justify-between gap-2">
                          <span className="truncate">📍 {vid.locationKo}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                try {
                                  sessionStorage.setItem('ghosti_auto_extract_video_ocr', vid.id);
                                } catch {
                                  /* ignore */
                                }
                                setSelectedVideoModal(vid, vid.matchedSeekSec);
                              }}
                              className="px-2 py-0.5 rounded-lg bg-teal-500/20 hover:bg-teal-400 text-teal-200 hover:text-zinc-950 border border-teal-400/50 font-label-sm text-[10.5px] font-black cursor-pointer"
                            >
                              📝 글자 뽑기
                            </button>
                            <span className="text-primary-container font-bold">
                              {hasExecutedUserSearch && activeQuery
                                ? isWholeClip
                                  ? '▶ 처음부터'
                                  : `▶ ${cleanTs}`
                                : '▶ 재생'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </article>
                    );
                  })}
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
                {hasExecutedUserSearch &&
                  activeQuery &&
                  matchedLocalDocs.length > 0 &&
                  matchedLocalDocs.every((d) => d.matchType === 'SIMILAR') && (
                    <div className="px-3.5 py-2.5 rounded-2xl bg-amber-500/15 border border-amber-400/50 text-amber-200 font-label-sm text-[12px] font-extrabold">
                      {matchedLocalDocs[0].similarityNoticeKo ||
                        '💡 검색어와 100% 일치하는 문서가 없어 유사한 문서를 찾았습니다!'}
                    </div>
                  )}
                {matchedLocalDocs.length > 0 && (
                  <div className="flex overflow-x-auto snap-x snap-mandatory gap-2.5 pb-1 no-scrollbar">
                    {matchedLocalDocs.map((doc) => (
                      <article
                        key={doc.id}
                        onClick={() => setSelectedDocModal(doc)}
                        className="min-w-[82%] snap-center p-3.5 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-1.5 cursor-pointer shrink-0"
                      >
                        {hasExecutedUserSearch && doc.matchType === 'SIMILAR' && (
                          <div className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-400/40 text-amber-300 font-label-sm text-[10.5px] font-extrabold">
                            {doc.similarityNoticeKo || '💡 유사한 문서를 찾았습니다!'}
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded bg-zinc-800 border border-white/10 text-amber-400 font-label-mono text-[10px] font-bold">
                            {doc.ext} • {doc.categoryBadge}
                          </span>
                          <span className="font-label-mono text-[10px] text-zinc-400">
                            {doc.date}
                          </span>
                        </div>
                        <h4 className="font-headline-sm text-[14px] text-white font-bold truncate">
                          {renderHighlightedDocText(
                            doc.title,
                            hasExecutedUserSearch ? activeQuery : ''
                          )}
                        </h4>
                        <p className="font-body-sm text-[12px] text-zinc-400 line-clamp-2">
                          {renderHighlightedDocText(
                            buildDocPreviewSnippet(
                              maskSensitiveDocText(doc.extractedText),
                              hasExecutedUserSearch ? activeQuery : '',
                              220
                            ),
                            hasExecutedUserSearch ? activeQuery : ''
                          )}
                        </p>
                        <div className="pt-1.5 flex items-center justify-between gap-2 border-t border-white/10">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void navigator.clipboard?.writeText(doc.extractedText);
                                useSaySeeStore.setState({
                                  lastQuarantineToast: `📋 복사 완료! [${doc.title}] 본문 내용이 복사되었습니다.`,
                                });
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 font-label-sm text-[11px] font-extrabold cursor-pointer"
                            >
                              📋 복사
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDocModal(doc);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-400/50 text-amber-300 font-label-sm text-[11px] font-extrabold cursor-pointer"
                            >
                              📖 본문 바로 열기
                            </button>
                          </div>
                          <span className="text-primary-container text-[11px] font-bold">본문 →</span>
                        </div>
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
                            crossOrigin={item.photo.thumbUrl?.startsWith('http://127.0.0.1') ? 'anonymous' : undefined}
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
                      {hasExecutedUserSearch && activeQuery
                        ? `“${activeQuery}” 검색 결과`
                        : activeLoungeType === 'family'
                        ? `${activeFamilyRoom} 패밀리 앨범`
                        : activeLoungeType === 'club'
                        ? '동호회·모임 앨범'
                        : activeLoungeType === 'student'
                        ? '동창회 앨범'
                        : '전체 사진 목록'}
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
                              crossOrigin={item.photo.thumbUrl?.startsWith('http://127.0.0.1') ? 'anonymous' : undefined}
                              loading="lazy"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />

                            {isBurst && (
                              <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-zinc-950/85 backdrop-blur-md border border-white/15 text-primary-container font-label-sm text-[10px] font-bold">
                                ❐ {group.burstCount}장 연사
                              </div>
                            )}

                            {String(item.photo.id || '').startsWith('shared_added_') && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeSharedRoomPhoto(item.photo.id);
                                }}
                                aria-label="공유방에서 삭제"
                                title="공유방에서 이 사진 삭제 (내 기기 원본은 보존됩니다)"
                                className="absolute top-2 right-11 z-20 px-2 py-1 rounded-full bg-rose-600/95 hover:bg-rose-500 text-white text-[10.5px] font-black shadow-md flex items-center gap-0.5 cursor-pointer"
                              >
                                🗑️ 삭제
                              </button>
                            )}

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleBookmark(item.photo.id);
                              }}
                              aria-label="즐겨찾기"
                              title={item.photo.bookmarked ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                              className={`absolute top-2 right-2 w-7.5 h-7.5 rounded-full backdrop-blur-md flex items-center justify-center transition-all cursor-pointer ${
                                item.photo.bookmarked
                                  ? 'bg-red-600/95 text-white ring-2 ring-white/80 shadow-md scale-105'
                                  : 'bg-black/60 text-white/85 hover:text-red-400 hover:bg-black/80'
                              }`}
                            >
                              <span
                                className="material-symbols-outlined text-[15px]"
                                style={
                                  item.photo.bookmarked
                                    ? { fontVariationSettings: "'FILL' 1, 'wght' 600" }
                                    : undefined
                                }
                              >
                                favorite
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
                ) : !hasExecutedUserSearch &&
                  (activeLoungeType === 'family' ||
                    activeLoungeType === 'club' ||
                    activeLoungeType === 'student') ? (
                  <SampleSharedRoomExperienceCard
                    loungeType={activeLoungeType}
                    familyRoom={activeFamilyRoom}
                  />
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
          )}

          {/* 모바일 👻 귀신비서 통합 본문: 비서 대화창 + 사진 4대 정리 + 악성 클리너 구출 + 내 기기 통합(PC↔폰) */}
          {activeLoungeType === 'personal' && (
            <div className="flex flex-col gap-3">
              <Stage1MinimalCarePreview />
              <MobileCleanerRescueBanner />

              {/* 내 기기 통합 (폰↔PC 프라이빗 싱크 & 데스크톱 연동 가이드) 귀신비서 화면 내 통합 */}
              <section className="rounded-2xl bg-[#18181B] border border-white/10 overflow-hidden transition-all">
                <div
                  onClick={() => setShowPrivateSyncSection((prev) => !prev)}
                  className="p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-2.5 cursor-pointer hover:bg-zinc-900/60 transition-colors"
                >
                  <div className="flex items-start sm:items-center gap-2 min-w-0 flex-1">
                    <span className="text-zinc-400 text-[12px] font-mono select-none mt-0.5 sm:mt-0">
                      {showPrivateSyncSection ? '▾' : '▸'}
                    </span>
                    <div className="flex flex-col min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h2 className="font-headline-sm text-[14px] sm:text-[14.5px] text-white font-bold break-keep">
                          📱 내 기기 통합 (폰↔PC 프라이빗 싱크)
                        </h2>
                        <span className="px-2 py-0.5 rounded-full bg-zinc-900 border border-white/10 text-primary-container font-label-sm text-[10.5px] font-bold whitespace-nowrap">
                          {syncState.privateSyncStrategy === 'mirror' ? '모드 A · 100% 원본 미러링' : '모드 B · 폰 용량 99.4% 절약'}
                        </span>
                      </div>
                      <p className="font-body-sm text-[11.5px] text-zinc-400 break-keep mt-0.5">
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
                    className="px-3 py-2 rounded-xl bg-primary-container text-zinc-950 font-label-sm text-[11.5px] font-extrabold shrink-0 whitespace-nowrap ml-auto cursor-pointer"
                  >
                    {syncState.syncing ? '일치화 중...' : '⚡ 지금 일치시키기'}
                  </button>
                </div>

                {showPrivateSyncSection && (
                  <div className="px-4 pb-4 pt-3 border-t border-white/10 flex flex-col gap-3">
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
                          👻 모드 B. 초경량 섀도우 캐시 모드 (권장 · {syncState.packSizeMB}MB)
                        </span>
                        <input
                          type="radio"
                          checked={syncState.privateSyncStrategy === 'shadow'}
                          onChange={() => setPrivateSyncStrategy('shadow')}
                          className="w-4 h-4 accent-[#00E5FF]"
                        />
                      </div>
                    </div>

                    <PcMasterQuickSendPanel compact />
                  </div>
                )}
              </section>
            </div>
          )}
        </main>
      )}

      {/* 공유방(패밀리·동호·동창·업무) 전용 초대/방 설정 탭 */}
      {activeLoungeType !== 'personal' && mobileTab === 'settings' && (
        <main className="flex-1 w-full px-4 pt-4 pb-10 flex flex-col gap-3.5">
          <LoungeCustomSettingsHeader />
        </main>
      )}

      {/* 모바일 하단 서브메뉴 바: 서브탭이 존재하는 공유방에서만 노출 (귀신비서 단일 통합 화면에서는 중복 바 미노출) */}
      {currentSubmenus.length > 0 && (
      <nav
        style={{ paddingBottom: 'max(0.35rem, env(safe-area-inset-bottom, 0px))' }}
        className={`fixed bottom-0 inset-x-0 max-w-xl mx-auto min-h-[56px] backdrop-blur-xl border-t z-50 px-2 pt-1.5 flex items-center justify-around transition-colors ${
          themeMode === 'light'
            ? 'bg-white/95 border-[#E5E0D5]'
            : 'bg-[#09090B]/95 border-white/10'
        }`}
      >
        {currentSubmenus.map((sub) => {
          if (sub.id === 'trial' && activePricingPlan !== 'free_trial') {
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
              className={`flex-1 py-2 px-1.5 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                isSubActive
                  ? themeMode === 'light'
                    ? 'bg-[#E6F7F5] text-[#0D9488] font-extrabold'
                    : 'bg-primary-container/15 text-primary-container font-extrabold'
                  : themeMode === 'light'
                  ? 'text-slate-600 font-bold'
                  : 'text-zinc-400 font-bold'
              }`}
            >
              <div className="flex items-center gap-1 max-w-full">
                <span className="text-[11.5px] font-extrabold truncate max-w-[44vw]">{sub.label}</span>
                {sub.showTrashCount && (
                  <span className="px-1.5 py-0.2 rounded-md bg-zinc-800 border border-white/10 text-zinc-300 text-[9.5px] font-mono font-bold">
                    {activeTrashCount}
                  </span>
                )}
              </div>
              {sub.subcaption && (
                <span className="text-[9.5px] opacity-65 truncate max-w-[44vw]">
                  {sub.subcaption}
                </span>
              )}
            </button>
          );
        })}
      </nav>
      )}
      <MerlinZCoreGuideModal isOpen={showZCoreGuideModal} onClose={() => setShowZCoreGuideModal(false)} themeMode={themeMode} />
    </div>
  );
};
