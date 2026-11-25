import React, { useEffect, useMemo, useRef, useState } from 'react';
import { zCoreBridge } from '../services/zCoreBridge';
import { hasAuthenticatedHubAccountSession } from '../services/supabaseClient';
import {
  clearLastQrPairResult,
  consumeDevicePairingCode6,
  readLastQrPairResult,
  readPendingQrPairCode,
  saveLastQrPairResult,
  savePendingQrPairCode,
} from '../services/deviceIntegrationService';
import { useSaySeeStore, type MobileTab } from '../store/useSaySeeStore';
import {
  GhostiHeaderQuickShareButton,
  GhostiTopRightHubAnchor,
} from './GhostiHubInfraBridge';
import { GhostiBrandLogo } from './GhostiBrandLogo';
import type { FamilyRoomId, LoungeType } from '../types/saysee';
import {
  cleanVideoTimestampLabel,
  groupBurstSearchResults,
  resolveVideoCardThumbUrl,
} from '../services/aiEngine';
import { VoiceHeroStage } from './VoiceHeroStage';
import { Stage1MinimalCarePreview } from './Stage1MinimalPreview';
import { MobileCleanerRescueBanner } from './MobileCleanerRescueBanner';
import {
  isCapacitorNativeMobileRuntime,
  isIosMobileBrowserOrApp,
  openNativeAppPermissionSettings,
  syncNativeMobileThemeMode,
} from '../services/ghostiMobileCareBridge';
import {
  LoungeCustomSettingsHeader,
  LoungeFeedContextBanner,
  LoungeView,
} from './LoungeView';
import { SampleSharedRoomExperienceCard } from '../domains/free_photo_share/SampleSharedRoomExperienceCard';
import {
  PcMasterQuickSendPanel,
  buildDocPreviewSnippet,
  formatVideoCardOcrSummary,
  renderHighlightedDocText,
  resolveDocExtBadge,
  maskSensitiveDocText,
} from './PricingModal';
import { CrossDeviceClipboardAndPairingBar } from '../domains/paid_device_sync/CrossDeviceClipboardAndPairingBar';

type MainMenuId = 'personal' | 'photo_share' | 'work';

const PHOTO_SHARE_LOUNGES: LoungeType[] = ['family', 'club', 'student'];

const MAIN_LOUNGE_MENUS: Array<{
  id: MainMenuId;
  label: string;
  defaultLounge: LoungeType;
}> = [
  { id: 'personal', label: '귀신비서', defaultLounge: 'personal' },
  { id: 'photo_share', label: '사진 공유', defaultLounge: 'family' },
  { id: 'work', label: '업무 공유 (S:)', defaultLounge: 'work' },
];

const PHOTO_SHARE_GROUPS: Array<{ id: LoungeType; label: string }> = [
  { id: 'family', label: '가족' },
  { id: 'club', label: '동호회 · 모임' },
  { id: 'student', label: '동창회' },
];

const FAMILY_ROOM_PILLS: Array<{ id: FamilyRoomId; label: string }> = [
  { id: '우리집', label: '우리집' },
  { id: '본가(친가)', label: '본가(친가)' },
  { id: '처가(친정)', label: '처가(친정)' },
];

const resolveMainMenuId = (lounge: LoungeType): MainMenuId =>
  PHOTO_SHARE_LOUNGES.includes(lounge) ? 'photo_share' : lounge === 'work' ? 'work' : 'personal';

const MOBILE_LOUNGE_SUBMENUS: Record<
  LoungeType,
  Array<{ id: MobileTab; label: string; subcaption?: string; showTrashCount?: boolean }>
> = {
  personal: [],
  family: [
    { id: 'search', label: '사진 목록 · 검색' },
    { id: 'settings', label: '초대 · 방 설정' },
  ],
  club: [
    { id: 'search', label: '모임 사진 · 검색' },
    { id: 'settings', label: '초대 · 모임 관리' },
  ],
  student: [
    { id: 'search', label: '동창회 사진 · 검색' },
    { id: 'settings', label: '초대 · 동창회 관리' },
  ],
  work: [
    { id: 'search', label: '공용 폴더 (S:) 문서' },
    { id: 'settings', label: '팀원 권한 · 드라이브 설정' },
  ],
};

export const MobileAppView: React.FC = () => {
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
    hasExecutedUserSearch,
    hasUserSelectedSearchTab,
    searchResults,
    groupBurstsInSearch,
    setGroupBurstsInSearch,
    setSelectedPhoto,
    toggleBookmark,
    softDeleteSharedRoomPhoto24h,
    activePricingPlan,
    subscribedLounges,
    syncState,
    deviceSyncProgress,
    setPrivateSyncStrategy,
    triggerSyncNow,
    pcAgentPairedMobile,
    connectedDevices,
    syncedClipboardItems,
    thisDeviceRevoked,
    merlinAuth,
    isStoreAppMode,
    activeFamilyRoom,
    activeJoinedRoomMeta,
    joinedSharedRooms,
    selectOwnSharedRoom,
    selectJoinedSharedRoom,
    mobileGalleryScanning,
    mobileGalleryPermissionDenied,
    mobileGalleryLimitedAccess,
    syncMobileNativeGalleryAuto,
  } = useSaySeeStore();

  const [showPrivateSyncSection, setShowPrivateSyncSection] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.has('pairCode') || sessionStorage.getItem('ghosti_expand_device_sync_once') === '1') {
        sessionStorage.removeItem('ghosti_expand_device_sync_once');
        return true;
      }
    } catch {
      /* ignore */
    }
    return false;
  });
  const [qrAppBridgeCode, setQrAppBridgeCode] = useState<string | null>(() => {
    if (typeof window === 'undefined' || isCapacitorNativeMobileRuntime()) return null;
    try {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = (params.get('pairCode') || '').replace(/\D/g, '').slice(0, 6);
      if (fromUrl.length === 6) return fromUrl;
      const fromPending = readPendingQrPairCode();
      return fromPending && fromPending.length === 6 ? fromPending : null;
    } catch {
      return null;
    }
  });
  const [qrPairMismatchInfo, setQrPairMismatchInfo] = useState<{
    expectedEmailHint?: string;
  } | null>(() => {
    const saved = readLastQrPairResult();
    if (saved && !saved.ok && saved.reason === 'ACCOUNT_MISMATCH') {
      return { expectedEmailHint: saved.expectedEmailHint };
    }
    return null;
  });
  const [qrPairCheckState, setQrPairCheckState] = useState<'idle' | 'checking' | 'ready'>(() => {
    if (typeof window === 'undefined' || isCapacitorNativeMobileRuntime()) return 'idle';
    const saved = readLastQrPairResult();
    if (saved && !saved.ok && saved.reason === 'ACCOUNT_MISMATCH') return 'ready';
    if (hasAuthenticatedHubAccountSession()) return 'checking';
    return 'ready';
  });
  const prevAuthEmailRef = useRef<string>((merlinAuth?.email || '').trim().toLowerCase());
  const privateSyncSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onQrPairResult = (ev: Event) => {
      const detail = (ev as CustomEvent<{
        ok?: boolean;
        reason?: string;
        expectedEmailHint?: string;
      }>).detail;
      if (!detail) return;
      if (detail.ok) {
        setQrPairMismatchInfo(null);
        setQrPairCheckState('ready');
      } else if (detail.reason === 'ACCOUNT_MISMATCH') {
        setQrPairMismatchInfo({ expectedEmailHint: detail.expectedEmailHint });
        setQrPairCheckState('ready');
      } else if (detail.reason === 'CODE_EXPIRED') {
        setQrPairMismatchInfo(null);
        setQrPairCheckState('ready');
        setQrAppBridgeCode(null);
      } else {
        setQrPairCheckState('ready');
      }
    };
    window.addEventListener('ghosti_qr_pair_result', onQrPairResult);
    return () => window.removeEventListener('ghosti_qr_pair_result', onQrPairResult);
  }, []);

  useEffect(() => {
    const nextEmail = (merlinAuth?.email || '').trim().toLowerCase();
    const prevEmail = prevAuthEmailRef.current;
    // 초기 부팅('' -> 로그인 이메일 로드)에서는 경고를 지우지 않고, 실제 계정이 변경/로그아웃될 때만 초기화
    if (prevEmail && nextEmail !== prevEmail) {
      setQrPairMismatchInfo(null);
      clearLastQrPairResult();
    }
    prevAuthEmailRef.current = nextEmail;
  }, [merlinAuth?.email]);

  useEffect(() => {
    if (!qrAppBridgeCode || isCapacitorNativeMobileRuntime()) return;
    const saved = readLastQrPairResult(qrAppBridgeCode);
    if (saved) {
      if (saved.ok) {
        setQrPairMismatchInfo(null);
        setQrPairCheckState('ready');
        return;
      }
      if (saved.reason === 'ACCOUNT_MISMATCH') {
        setQrPairMismatchInfo({ expectedEmailHint: saved.expectedEmailHint });
        setQrPairCheckState('ready');
        return;
      }
    }
    const isWebAuthed = Boolean(
      (merlinAuth?.email && merlinAuth.userId !== 'guest') || hasAuthenticatedHubAccountSession()
    );
    if (!isWebAuthed) {
      setQrPairCheckState('ready');
      return;
    }
    setQrPairCheckState('checking');
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (cancelled) return;
      const latestSaved = readLastQrPairResult(qrAppBridgeCode);
      if (latestSaved) {
        if (latestSaved.ok) {
          setQrPairMismatchInfo(null);
        } else if (latestSaved.reason === 'ACCOUNT_MISMATCH') {
          setQrPairMismatchInfo({ expectedEmailHint: latestSaved.expectedEmailHint });
        }
        setQrPairCheckState('ready');
        return;
      }
      const res = await consumeDevicePairingCode6(qrAppBridgeCode);
      if (cancelled) return;
      if (res.ok) {
        saveLastQrPairResult({ code: qrAppBridgeCode, ok: true });
        setQrPairMismatchInfo(null);
      } else if (res.reason === 'ACCOUNT_MISMATCH') {
        savePendingQrPairCode(qrAppBridgeCode);
        saveLastQrPairResult({
          code: qrAppBridgeCode,
          ok: false,
          reason: 'ACCOUNT_MISMATCH',
          expectedEmailHint: res.expectedEmailHint,
        });
        setQrPairMismatchInfo({ expectedEmailHint: res.expectedEmailHint });
      }
      setQrPairCheckState('ready');
    }, 850);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [qrAppBridgeCode, merlinAuth?.email, merlinAuth?.userId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onOpenDeviceSync = () => {
      setShowPrivateSyncSection(true);
      window.setTimeout(() => {
        privateSyncSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 160);
    };
    window.addEventListener('ghosti_open_device_sync_section', onOpenDeviceSync);
    return () => window.removeEventListener('ghosti_open_device_sync_section', onOpenDeviceSync);
  }, []);

  const prevTopClipKeyRef = useRef<string>(
    syncedClipboardItems[0]
      ? `${syncedClipboardItems[0].clipHash}:${syncedClipboardItems[0].createdAt}`
      : ''
  );

  useEffect(() => {
    const topClip = syncedClipboardItems[0];
    const topKey = topClip ? `${topClip.clipHash}:${topClip.createdAt}` : '';
    if (topKey && topKey !== prevTopClipKeyRef.current) {
      prevTopClipKeyRef.current = topKey;
      setShowPrivateSyncSection(true);
    }
  }, [syncedClipboardItems]);

  const computeIsTrueLandscapeCompact = () => {
    if (typeof window === 'undefined') return false;
    const orientType = window.screen?.orientation?.type;
    const isLandscapeOrient = orientType
      ? orientType.startsWith('landscape')
      : window.innerWidth >= 560 && window.innerWidth > window.innerHeight;
    return isLandscapeOrient && window.innerHeight <= 620;
  };

  const [isLandscapeCompact, setIsLandscapeCompact] = useState<boolean>(computeIsTrueLandscapeCompact);

  useEffect(() => {
    void syncNativeMobileThemeMode(false);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isIos = isIosMobileBrowserOrApp();
    let latestIosKb = 0;
    let settleTimer: number | undefined;
    let animRafId: number | undefined;

    const stopActiveGlide = () => {
      if (animRafId !== undefined) {
        window.cancelAnimationFrame(animRafId);
        animRafId = undefined;
      }
    };

    const animateWindowScrollBy = (deltaY: number, durationMs = 220) => {
      if (Math.abs(deltaY) < 6) return;
      stopActiveGlide();
      const startY =
        window.scrollY ||
        document.documentElement.scrollTop ||
        document.body.scrollTop ||
        0;
      const maxScrollY = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight
      );
      const targetY = Math.max(0, Math.min(maxScrollY, startY + deltaY));
      const actualDelta = targetY - startY;
      if (Math.abs(actualDelta) < 4) return;

      const startTime = performance.now();
      const step = (now: number) => {
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / durationMs);
        const eased = 1 - Math.pow(1 - t, 3);
        const nextY = startY + actualDelta * eased;
        window.scrollTo(0, nextY);
        if (t < 1) {
          animRafId = window.requestAnimationFrame(step);
        } else {
          animRafId = undefined;
        }
      };
      animRafId = window.requestAnimationFrame(step);
    };

    const ensureFocusedInputVisibleSmoothly = () => {
      const active = document.activeElement as HTMLElement | null;
      if (!active || (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA')) return;
      const vv = window.visualViewport;
      const vvOffsetTop = vv ? vv.offsetTop : 0;
      const vvBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
      const kbBottom =
        latestIosKb > 60 ? vvOffsetTop + (window.innerHeight - latestIosKb) : window.innerHeight;
      const visibleBottom = Math.min(vvBottom, kbBottom);
      const headerEl = document.querySelector('header');
      const headerBottom = headerEl
        ? Math.max(vvOffsetTop + 76, headerEl.getBoundingClientRect().bottom)
        : vvOffsetTop + 88;
      const rect = active.getBoundingClientRect();

      if (rect.top < headerBottom + 4) {
        const pullDown = headerBottom + 12 - rect.top;
        if (pullDown > 8) {
          animateWindowScrollBy(-pullDown, isIos ? 180 : 220);
        }
        return;
      }

      if (rect.bottom > visibleBottom - 6) {
        const maxAllowedScrollUp = Math.max(0, rect.top - (headerBottom + 12));
        const neededDelta = rect.bottom - (visibleBottom - 16);
        const clampedDelta = Math.min(neededDelta, maxAllowedScrollUp);
        if (clampedDelta > 8) {
          animateWindowScrollBy(clampedDelta, isIos ? 180 : 220);
        }
      }
    };

    const scheduleSmoothKeyboardGlide = (delayMs = 85) => {
      if (settleTimer !== undefined) {
        window.clearTimeout(settleTimer);
      }
      settleTimer = window.setTimeout(() => {
        settleTimer = undefined;
        ensureFocusedInputVisibleSmoothly();
      }, delayMs);
    };

    const onNativeKb = (ev: Event) => {
      const detail = (ev as CustomEvent<{ open?: boolean; height?: number; platform?: string }>).detail;
      const open = Boolean(detail?.open);
      if (detail?.platform === 'ios') {
        latestIosKb = open ? Math.max(0, Number(detail?.height || 0)) : 0;
      }
      if (open) {
        scheduleSmoothKeyboardGlide(isIos ? 340 : 70);
      } else {
        if (settleTimer !== undefined) {
          window.clearTimeout(settleTimer);
          settleTimer = undefined;
        }
        stopActiveGlide();
      }
    };

    const onFocusIn = (e: FocusEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
        scheduleSmoothKeyboardGlide(isIos ? 360 : 110);
      }
    };

    const onFocusOut = () => {
      window.setTimeout(() => {
        const active = document.activeElement as HTMLElement | null;
        if (!active || (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA')) {
          latestIosKb = 0;
          stopActiveGlide();
        }
      }, 120);
    };

    window.addEventListener('ghostiKeyboardState', onNativeKb);
    window.addEventListener('focusin', onFocusIn);
    window.addEventListener('focusout', onFocusOut);
    return () => {
      if (settleTimer !== undefined) {
        window.clearTimeout(settleTimer);
      }
      stopActiveGlide();
      window.removeEventListener('ghostiKeyboardState', onNativeKb);
      window.removeEventListener('focusin', onFocusIn);
      window.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncLandscape = () => {
      setIsLandscapeCompact(computeIsTrueLandscapeCompact());
    };
    syncLandscape();
    window.addEventListener('resize', syncLandscape, { passive: true });
    window.addEventListener('orientationchange', syncLandscape, { passive: true });
    return () => {
      window.removeEventListener('resize', syncLandscape);
      window.removeEventListener('orientationchange', syncLandscape);
    };
  }, []);

  const activePhotos = useMemo(() => photos.filter((p) => !p.quarantined), [photos]);
  const activeTrashCount = useMemo(
    () => activePhotos.filter((p) => Boolean(p.trashCategory)).length,
    [activePhotos]
  );

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
    return groupBurstSearchResults(searchResults, photos);
  }, [searchResults, photos, groupBurstsInSearch, searchSpace, activeLoungeType]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [activeLoungeType, mobileTab, activeFamilyRoom]);

  const currentSubmenus = MOBILE_LOUNGE_SUBMENUS[activeLoungeType] || MOBILE_LOUNGE_SUBMENUS.personal;
  const isCurrentLoungeSubscribed = Boolean(subscribedLounges[activeLoungeType]);

  return (
    <div
      style={
        isIosMobileBrowserOrApp() && !isLandscapeCompact
          ? { paddingBottom: 'calc(var(--ghosti-kb-inset, 0px) + 28px)' }
          : undefined
      }
      className={`bg-white text-slate-900 flex flex-col min-h-screen min-h-dvh mx-auto relative ${
        isLandscapeCompact
          ? 'w-full max-w-5xl pb-6'
          : `max-w-xl ${currentSubmenus.length > 0 ? 'pb-24' : 'pb-8'}`
      }`}
    >
      <header className="sticky top-0 inset-x-0 z-50 pt-safe border-b bg-white border-slate-200">
        {isLandscapeCompact ? (
          <div className="px-safe py-1.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 shrink-0">
              <GhostiBrandLogo
                size="mobile"
                autoCycle={false}
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
                className="shrink-0 scale-90 origin-left"
              />
            </div>

            <nav className="flex items-center justify-center gap-1 flex-1 max-w-md min-w-0">
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
                    className={`px-2.5 py-1 rounded-lg text-[11.5px] flex items-center justify-center transition-colors whitespace-nowrap outline-none cursor-pointer ${
                      active
                        ? 'bg-teal-600 text-white font-semibold'
                        : 'bg-slate-100 text-slate-600 hover:text-slate-900 font-medium'
                    }`}
                  >
                    <span>{menu.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="flex items-center gap-1 shrink-0" aria-label="가이드 공유 및 프로필 영역">
              {!isStoreAppMode && (
                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('ghosti_navigate_showroom'));
                  }}
                  title="서비스 소개 페이지로 이동"
                  className="px-2 py-1 rounded-md font-medium text-[11px] text-slate-600 hover:text-slate-900 hover:bg-slate-100 shrink-0 whitespace-nowrap cursor-pointer"
                >
                  가이드
                </button>
              )}
              <GhostiHeaderQuickShareButton compact />
              <GhostiTopRightHubAnchor />
            </div>
          </div>
        ) : (
          <>
            <div className="px-safe py-2 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-1 flex-nowrap min-w-0">
                <div className="flex items-center gap-1 shrink-0 min-w-0">
                  <GhostiBrandLogo
                    size="mobile"
                    autoCycle={false}
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

                <div className="flex items-center gap-1 shrink-0 ml-auto" aria-label="가이드 공유 및 프로필 영역">
                  {!isStoreAppMode && (
                    <button
                      type="button"
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('ghosti_navigate_showroom'));
                      }}
                      title="서비스 소개 페이지로 이동"
                      className="px-2 py-1.5 rounded-md font-medium text-[11.5px] text-slate-600 hover:text-slate-900 hover:bg-slate-100 shrink-0 whitespace-nowrap cursor-pointer"
                    >
                      가이드
                    </button>
                  )}
                  <GhostiHeaderQuickShareButton compact />
                  <GhostiTopRightHubAnchor />
                </div>
              </div>

              <nav className="grid grid-cols-3 gap-1 p-0.5 rounded-xl bg-slate-100">
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
                      className={`px-1.5 py-1.5 rounded-lg text-[12px] flex items-center justify-center transition-colors whitespace-nowrap outline-none cursor-pointer ${
                        active
                          ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 font-medium'
                      }`}
                    >
                      <span>{menu.label}</span>
                    </button>
                  );
                })}
              </nav>

              {resolveMainMenuId(activeLoungeType) === 'photo_share' && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    {PHOTO_SHARE_GROUPS.map((group) => {
                      const groupActive = !activeJoinedRoomMeta && activeLoungeType === group.id;
                      return (
                        <button
                          key={group.id}
                          type="button"
                          onClick={() => {
                            if (!groupActive) {
                              selectOwnSharedRoom(group.id);
                            }
                          }}
                          className={`px-2.5 py-1 rounded-lg border text-[11.5px] shrink-0 whitespace-nowrap transition-colors outline-none cursor-pointer ${
                            groupActive
                              ? 'bg-teal-600 border-teal-600 text-white font-semibold'
                              : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 font-medium'
                          }`}
                        >
                          {group.label}
                        </button>
                      );
                    })}
                  </div>

                  {activeLoungeType === 'family' && (
                    <div className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                      <span className="text-[11px] font-semibold text-slate-500 shrink-0 whitespace-nowrap">
                        내 가족방
                      </span>
                      {FAMILY_ROOM_PILLS.map((room) => {
                        const roomActive = !activeJoinedRoomMeta && activeFamilyRoom === room.id;
                        return (
                          <button
                            key={room.id}
                            type="button"
                            data-own-room={room.id}
                            onClick={() => {
                              selectOwnSharedRoom('family', room.id);
                            }}
                            className={`px-2.5 py-0.5 rounded-md border text-[11px] shrink-0 whitespace-nowrap transition-colors cursor-pointer ${
                              roomActive
                                ? 'bg-teal-600 border-teal-600 text-white font-semibold'
                                : 'bg-white border-slate-200 text-slate-600 font-medium'
                            }`}
                          >
                            {room.label}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {joinedSharedRooms.length > 0 && (
                    <div
                      aria-label="초대받은 독립 공유방 목록"
                      className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-1.5 overflow-x-auto no-scrollbar"
                    >
                      <span className="text-[11px] font-semibold text-slate-500 shrink-0 whitespace-nowrap">
                        초대받은 방
                      </span>
                      {joinedSharedRooms.map((jr) => {
                        const isJoinedActive = activeJoinedRoomMeta?.roomId === jr.roomId;
                        const shortRoomLabel =
                          jr.loungeType === 'family'
                            ? jr.familyRoom
                            : jr.roomTitle.replace(/^[⛰️🎓🏠🏡🌸\s]+/u, '').trim() ||
                              (jr.loungeType === 'club' ? '동호회·모임' : '동창회');
                        return (
                          <button
                            key={jr.roomId}
                            type="button"
                            data-joined-room-id={jr.roomId}
                            onClick={() => selectJoinedSharedRoom(jr)}
                            className={`px-2.5 py-0.5 rounded-md border text-[11px] shrink-0 whitespace-nowrap transition-colors cursor-pointer ${
                              isJoinedActive
                                ? 'bg-teal-600 border-teal-600 text-white font-semibold'
                                : 'bg-white border-slate-200 text-slate-700 font-medium'
                            }`}
                          >
                            {jr.masterNickname} · {shortRoomLabel}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {currentSubmenus.length > 0 && (
              <div className="px-3.5 pt-0.5 border-t border-slate-100 flex items-center gap-1 overflow-x-auto no-scrollbar bg-white">
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
                      className={`px-3 py-2 border-b-2 text-[12.5px] flex items-center gap-1 transition-colors shrink-0 whitespace-nowrap outline-none cursor-pointer ${
                        isSubActive
                          ? 'text-slate-900 border-slate-900 font-semibold'
                          : 'border-transparent text-slate-500 hover:text-slate-800 font-medium'
                      }`}
                    >
                      <span>{sub.label}</span>
                      {sub.showTrashCount && (
                        <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 text-[10px] tabular-nums">
                          {activeTrashCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </header>

      {isLandscapeCompact &&
        (resolveMainMenuId(activeLoungeType) === 'photo_share' || currentSubmenus.length > 0) && (
          <div className="px-safe py-1.5 border-b flex items-center justify-between gap-2 overflow-x-auto no-scrollbar bg-slate-50 border-slate-200">
            {resolveMainMenuId(activeLoungeType) === 'photo_share' && (
              <div className="flex items-center gap-1 shrink-0">
                {PHOTO_SHARE_GROUPS.map((group) => {
                  const groupActive = !activeJoinedRoomMeta && activeLoungeType === group.id;
                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => {
                        if (!groupActive) {
                          selectOwnSharedRoom(group.id);
                        }
                      }}
                      className={`px-2 py-1 rounded-md border text-[11px] shrink-0 whitespace-nowrap cursor-pointer ${
                        groupActive
                          ? 'bg-teal-600 border-teal-600 text-white font-semibold'
                          : 'bg-white border-slate-200 text-slate-600 font-medium'
                      }`}
                    >
                      {group.label}
                    </button>
                  );
                })}
                {activeLoungeType === 'family' && (
                  <div className="flex items-center gap-1 ml-1 pl-2 border-l border-slate-200">
                    {FAMILY_ROOM_PILLS.map((room) => {
                      const roomActive = !activeJoinedRoomMeta && activeFamilyRoom === room.id;
                      return (
                        <button
                          key={room.id}
                          type="button"
                          onClick={() => {
                            selectOwnSharedRoom('family', room.id);
                          }}
                          className={`px-2 py-0.5 rounded-md border text-[10.5px] shrink-0 whitespace-nowrap cursor-pointer ${
                            roomActive
                              ? 'bg-teal-600 border-teal-600 text-white font-semibold'
                              : 'bg-white border-slate-200 text-slate-600 font-medium'
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

            {currentSubmenus.length > 0 && (
              <div className="flex items-center gap-1 shrink-0 ml-auto">
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
                      className={`px-2.5 py-1 rounded-md text-[11px] shrink-0 whitespace-nowrap cursor-pointer ${
                        isSubActive
                          ? 'bg-teal-600 text-white font-semibold'
                          : 'text-slate-600 hover:text-slate-900 font-medium'
                      }`}
                    >
                      {sub.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

      {activeLoungeType !== 'personal' && mobileTab === 'trial' && (
        <div className="w-full px-safe">
          <LoungeView />
        </div>
      )}

      {(activeLoungeType === 'personal' || mobileTab === 'search') && (
        <main
          className={`flex-1 w-full px-safe flex flex-col ${
            isLandscapeCompact ? 'pt-2 pb-5 gap-2.5' : 'pt-3.5 pb-8 gap-4'
          }`}
        >
          {qrAppBridgeCode && !isCapacitorNativeMobileRuntime() && (
            qrPairMismatchInfo ? (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 flex flex-col gap-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-amber-900">
                      ⚠️ PC와 로그인 계정이 다릅니다
                    </p>
                    <p className="text-[12px] text-amber-900/90 mt-1 break-keep leading-relaxed">
                      현재 웹에는{' '}
                      <span className="font-semibold">{merlinAuth?.email || '다른 계정'}</span>이(가)
                      로그인되어 있어 바로 연결할 수 없습니다. PC에 로그인된 계정(
                      <span className="font-semibold">
                        {qrPairMismatchInfo.expectedEmailHint || 'PC와 같은 이메일'}
                      </span>
                      )으로 바꾼 뒤 연결해 주세요.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setQrPairMismatchInfo(null);
                      clearLastQrPairResult();
                      setQrAppBridgeCode(null);
                    }}
                    className="text-[11px] text-amber-700 hover:text-amber-950 px-1.5 py-0.5 cursor-pointer shrink-0"
                  >
                    닫기
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      savePendingQrPairCode(qrAppBridgeCode);
                      setQrPairMismatchInfo(null);
                      clearLastQrPairResult();
                      window.dispatchEvent(new CustomEvent('ghosti_logout_and_open_login'));
                    }}
                    className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[12px] font-semibold cursor-pointer"
                  >
                    로그아웃 후 PC 계정으로 다시 로그인
                  </button>
                </div>
              </div>
            ) : qrPairCheckState === 'checking' ? (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                <p className="text-[12px] text-slate-600 font-medium">
                  PC에 로그인된 계정과 일치하는지 확인하고 있습니다...
                </p>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-white border border-slate-200 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-slate-900">
                      PC 기기 연결 번호{' '}
                      <span className="font-mono">{qrAppBridgeCode.slice(0, 3)}-{qrAppBridgeCode.slice(3, 6)}</span>
                    </p>
                    <p className="text-[11.5px] text-slate-500 mt-0.5 break-keep">
                      모바일 웹은 온보딩·앱 이동용 안내 화면입니다. 설치된 귀신같이 앱에서 PC와 같은 이메일로 로그인하면 자동으로 바로 연결됩니다.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setQrAppBridgeCode(null)}
                    className="text-[11px] text-slate-400 hover:text-slate-700 px-1.5 py-0.5 cursor-pointer shrink-0"
                  >
                    닫기
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={`ghosti://pair?pairCode=${qrAppBridgeCode}`}
                    className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12px] font-semibold no-underline"
                  >
                    귀신같이 앱에서 열기
                  </a>
                </div>
              </div>
            )
          )}

          {activeLoungeType !== 'personal' && <LoungeFeedContextBanner />}

          {activeLoungeType === 'personal' && <MobileCleanerRescueBanner />}

          {activeLoungeType === 'personal' && <Stage1MinimalCarePreview />}

          {activeLoungeType !== 'work' && <VoiceHeroStage />}

          {activeLoungeType === 'personal' &&
            ((hasExecutedUserSearch && Boolean(activeQuery.trim())) ||
              hasUserSelectedSearchTab ||
              searchSpace === 'video' ||
              searchSpace === 'vault') && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 text-[12px] font-semibold">
              <span className="min-w-0 truncate">
                {hasExecutedUserSearch && Boolean(activeQuery.trim())
                  ? `“${activeQuery}” 검색 결과`
                  : searchSpace === 'video'
                  ? `동영상 (${matchedVideoScenes.length || videoSceneItems.length}건)`
                  : searchSpace === 'vault'
                  ? `문서 · 서류 (${matchedLocalDocs.length + matchedVaultPhotos.length}건)`
                  : `사진 (${searchResults.length}장)`}
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
                className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-medium shrink-0 cursor-pointer"
              >
                닫기
              </button>
            </div>
          )}

          {activeLoungeType !== 'work' &&
            (activeLoungeType !== 'personal' ||
              hasUserSelectedSearchTab ||
              searchSpace === 'video' ||
              searchSpace === 'vault' ||
              (hasExecutedUserSearch && Boolean(activeQuery.trim()))) && (
          <div id="ghosti-search-results" className="scroll-mt-36">
            {searchSpace === 'video' ? (() => {
              const displayVideos =
                !hasExecutedUserSearch && matchedVideoScenes.length === 0
                  ? videoSceneItems
                  : matchedVideoScenes;
              return (
                <section className="flex flex-col gap-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
                    <span className="text-[14.5px] text-slate-900 font-bold">
                      {hasExecutedUserSearch && activeQuery
                        ? `“${activeQuery}” 동영상 결과 (${displayVideos.length})`
                        : `동영상 (${displayVideos.length})`}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {isCapacitorNativeMobileRuntime() && mobileGalleryScanning && (
                        <span className="text-[11px] text-slate-500">
                          동영상 확인 중...
                        </span>
                      )}
                      {displayVideos.length < videoSceneItems.length && (
                        <button
                          onClick={() => resetSearchSpaceToAll('video')}
                          className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 text-[11px] font-medium cursor-pointer"
                        >
                          전체 {videoSceneItems.length}개 보기
                        </button>
                      )}
                    </div>
                  </div>

                  {displayVideos.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-[12.5px] leading-relaxed flex flex-col gap-2.5">
                      <span>
                        {hasExecutedUserSearch && activeQuery
                          ? `“${activeQuery}”와 일치하는 동영상 장면이 없습니다.`
                          : mobileGalleryScanning
                          ? '갤러리의 동영상과 화면 글자를 확인하고 있습니다...'
                          : mobileGalleryPermissionDenied
                          ? '사진·동영상 접근 권한이 허용되지 않았습니다. 설정에서 권한을 허용하면 자동으로 표시됩니다.'
                          : mobileGalleryLimitedAccess
                          ? '현재 선택한 사진만 허용된 상태입니다. 동영상을 추가 선택하거나 모두 허용으로 변경해 주세요.'
                          : '표시할 동영상이 없습니다.'}
                      </span>
                      {isCapacitorNativeMobileRuntime() &&
                        !mobileGalleryScanning &&
                        (mobileGalleryPermissionDenied || mobileGalleryLimitedAccess) && (
                          <div className="flex flex-wrap items-center gap-2 pt-0.5">
                            {mobileGalleryLimitedAccess && (
                              <button
                                type="button"
                                onClick={() =>
                                  void syncMobileNativeGalleryAuto({
                                    promptPermission: true,
                                    forceExpandSelected: true,
                                  })
                                }
                                className="px-3 py-1.5 rounded-lg bg-teal-600 text-white text-[12px] font-semibold cursor-pointer"
                              >
                                동영상 추가 선택
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => void openNativeAppPermissionSettings()}
                              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-800 text-[12px] font-medium cursor-pointer"
                            >
                              설정에서 모두 허용
                            </button>
                          </div>
                        )}
                    </div>
                  ) : (
                    <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-2 no-scrollbar">
                      {displayVideos.map((vid) => {
                        const cardThumbUrl = resolveVideoCardThumbUrl(vid);
                        const isWholeClip = (vid.matchedSeekSec ?? 0) <= 0;
                        const cleanTs = cleanVideoTimestampLabel(vid.matchedTimestamp);
                        return (
                          <article
                            key={vid.id}
                            onClick={() => setSelectedVideoModal(vid, vid.matchedSeekSec)}
                            className={`${
                              displayVideos.length === 1
                                ? 'w-full max-w-full min-w-0'
                                : 'w-[86%] min-w-[86%] max-w-[86%]'
                            } snap-center rounded-xl overflow-hidden bg-white border border-slate-200 flex flex-col cursor-pointer shrink-0`}
                          >
                            <div data-keep-dark="true" className="relative aspect-video w-full bg-black">
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
                                  <span className="material-symbols-outlined text-2xl text-zinc-400">movie</span>
                                  <span className="text-[11px] font-medium truncate max-w-[85%]">{vid.title}</span>
                                </div>
                              )}
                              <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                                <div className="w-10 h-10 rounded-full bg-black/70 border border-white/25 text-white flex items-center justify-center">
                                  <span className="material-symbols-outlined text-[22px]">play_arrow</span>
                                </div>
                              </div>
                              {hasExecutedUserSearch && activeQuery && (
                                <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/80 text-white text-[10.5px] font-semibold">
                                  {isWholeClip ? '00:00~' : `${cleanTs} 구간`}
                                </div>
                              )}
                              <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/80 text-white text-[10.5px] font-medium tabular-nums">
                                {vid.durationText}
                              </div>
                              {vid.hasScreenOcrText && (
                                <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/75 text-white text-[10px] font-medium">
                                  화면 글자 포함
                                </div>
                              )}
                            </div>

                            <div className="p-3 flex flex-col gap-1.5 min-w-0 max-w-full overflow-hidden">
                              <h4 className="text-[13.5px] text-slate-900 font-semibold truncate">
                                {vid.title}
                              </h4>
                              {hasExecutedUserSearch && activeQuery ? (
                                <p className="text-[11.5px] text-slate-600 line-clamp-2 break-words m-0 p-0">
                                  {vid.matchedFrameCaption}
                                </p>
                              ) : Array.isArray(vid.ocrLines) && vid.ocrLines.length > 0 ? (
                                <p className="text-[11.5px] text-slate-600 line-clamp-2 break-words m-0 p-0">
                                  {formatVideoCardOcrSummary(vid.ocrLines)}
                                </p>
                              ) : null}
                              <div className="text-[11px] text-slate-500 pt-1 flex items-center justify-between gap-2">
                                <span className="truncate">{vid.locationKo || vid.date}</span>
                                <span className="text-slate-900 font-semibold shrink-0">
                                  {hasExecutedUserSearch && activeQuery
                                    ? isWholeClip
                                      ? '처음부터 재생'
                                      : `${cleanTs} 재생`
                                    : '재생'}
                                </span>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })() : searchSpace === 'vault' ? (
              <section className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-[14.5px] text-slate-900 font-bold">
                    문서 · 서류 (문서 {matchedLocalDocs.length}건 · 사진 {matchedVaultPhotos.length}장)
                  </span>
                </div>

                {hasExecutedUserSearch &&
                  activeQuery &&
                  matchedLocalDocs.length > 0 &&
                  matchedLocalDocs.every((d) => d.matchType === 'SIMILAR') && (
                    <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-[12px] font-medium">
                      {matchedLocalDocs[0].similarityNoticeKo ||
                        '정확히 일치하는 문서가 없어 유사한 문서를 표시합니다.'}
                    </div>
                  )}

                {matchedLocalDocs.length > 0 && (
                  <div className="flex overflow-x-auto snap-x snap-mandatory gap-2.5 pb-1 no-scrollbar">
                    {matchedLocalDocs.map((doc) => (
                      <article
                        key={doc.id}
                        onClick={() => setSelectedDocModal(doc)}
                        className="w-[82%] min-w-[82%] max-w-[82%] snap-center p-3.5 rounded-xl overflow-hidden bg-white border border-slate-200 flex flex-col gap-1.5 cursor-pointer shrink-0"
                      >
                        <div className="flex items-center justify-between">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">
                            {resolveDocExtBadge(doc)} · {doc.categoryBadge}
                          </span>
                          <span className="text-[10.5px] text-slate-400">
                            {doc.date}
                          </span>
                        </div>
                        <h4 className="text-[13.5px] text-slate-900 font-semibold truncate">
                          {renderHighlightedDocText(
                            doc.title,
                            hasExecutedUserSearch ? activeQuery : '',
                            doc.matchedQueryTokens
                          )}
                        </h4>
                        <p className="text-[12px] text-slate-600 line-clamp-3 leading-relaxed m-0 p-0">
                          {renderHighlightedDocText(
                            buildDocPreviewSnippet(
                              maskSensitiveDocText(doc.extractedText),
                              hasExecutedUserSearch ? activeQuery : '',
                              170,
                              doc.matchedQueryTokens
                            ),
                            hasExecutedUserSearch ? activeQuery : '',
                            doc.matchedQueryTokens
                          )}
                        </p>
                        <div className="pt-2 flex items-center justify-end gap-1.5 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void navigator.clipboard?.writeText(doc.extractedText);
                              useSaySeeStore.setState({
                                lastQuarantineToast: `[${doc.title}] 본문이 복사되었습니다.`,
                              });
                            }}
                            className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium cursor-pointer"
                          >
                            복사
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDocModal(doc);
                            }}
                            className="px-2.5 py-1 rounded-md bg-teal-600 text-white text-[11px] font-semibold cursor-pointer"
                          >
                            본문 열기
                          </button>
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
                        className="group relative rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex flex-col cursor-pointer"
                      >
                        <div data-keep-dark="true" className="relative aspect-[4/5] w-full overflow-hidden bg-zinc-950">
                          <img
                            src={item.photo.thumbUrl}
                            alt={item.photo.name}
                            crossOrigin={item.photo.thumbUrl?.startsWith('http://127.0.0.1') ? 'anonymous' : undefined}
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/75 text-white text-[10px] font-medium">
                            {item.photo.vaultCategoryLabel || item.photo.tags[0]}
                          </div>
                          <div className="absolute inset-x-0 bottom-0 h-[20%] min-h-[36px] px-2.5 pb-2 pt-3 bg-gradient-to-t from-black/85 via-black/45 to-transparent flex items-end justify-between">
                            <span className="text-[11px] font-medium text-white">
                              {item.photo.date.split(' ')[0]}
                            </span>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            ) : (
              <section className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] text-slate-900 font-bold">
                      {hasExecutedUserSearch && activeQuery
                        ? `“${activeQuery}” 검색 결과`
                        : activeLoungeType === 'family'
                        ? `${activeFamilyRoom} 사진`
                        : activeLoungeType === 'club'
                        ? '동호회 · 모임 사진'
                        : activeLoungeType === 'student'
                        ? '동창회 사진'
                        : '사진'}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[11.5px] font-medium">
                      {searchResults.length}장
                    </span>
                  </div>

                  <button
                    onClick={() => setGroupBurstsInSearch(!groupBurstsInSearch)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium border cursor-pointer ${
                      groupBurstsInSearch
                        ? 'bg-teal-600 border-teal-600 text-white'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    {groupBurstsInSearch ? '연사 묶기 켜짐' : '연사 펼치기'}
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
                          className="group relative rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex flex-col cursor-pointer transition-transform active:scale-[0.98]"
                        >
                          <div data-keep-dark="true" className="relative aspect-[4/5] w-full overflow-hidden bg-zinc-950">
                            <img
                              src={item.photo.thumbUrl}
                              alt={item.photo.name}
                              crossOrigin={item.photo.thumbUrl?.startsWith('http://127.0.0.1') ? 'anonymous' : undefined}
                              loading="lazy"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />

                            {isBurst && (
                              <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/75 text-white text-[10px] font-medium">
                                {group.burstCount}장 연사
                              </div>
                            )}

                            {(String(item.photo.id || '').startsWith('shared_sb_') ||
                              String(item.photo.id || '').startsWith('shared_added_')) &&
                              hasAuthenticatedHubAccountSession() &&
                              (!activeJoinedRoomMeta ||
                                (Boolean(merlinAuth?.email) &&
                                  Boolean(item.photo.sharedUploaderEmail) &&
                                  item.photo.sharedUploaderEmail?.toLowerCase() ===
                                    merlinAuth.email.trim().toLowerCase())) && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  softDeleteSharedRoomPhoto24h(
                                    item.photo.id,
                                    activeJoinedRoomMeta ? 'uploader_24h' : 'host_hide'
                                  );
                                }}
                                aria-label="공유방에서 삭제"
                                className="absolute top-2 right-10 z-20 px-2 py-0.5 rounded bg-black/75 hover:bg-rose-600 text-white text-[10.5px] font-semibold cursor-pointer"
                              >
                                삭제
                              </button>
                            )}

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleBookmark(item.photo.id);
                              }}
                              aria-label="즐겨찾기"
                              className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                                item.photo.bookmarked
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-black/60 text-white/85 hover:bg-black/80'
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

                            <div className="absolute inset-x-0 bottom-0 h-[20%] min-h-[36px] px-2.5 pb-2 pt-3 bg-gradient-to-t from-black/85 via-black/45 to-transparent flex items-end justify-between pointer-events-none">
                              <span className="text-[11px] font-medium text-white">
                                {item.photo.date.split(' ')[0]}
                              </span>
                              {item.photo.tags[0] && (
                                <span className="text-[10.5px] text-zinc-200 truncate ml-1">
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
                  <div className="py-12 px-4 rounded-xl bg-slate-50 border border-slate-200 text-center flex flex-col items-center gap-2">
                    <span className="material-symbols-outlined text-slate-400 text-[32px]">
                      image_search
                    </span>
                    <p className="text-[13.5px] text-slate-600 font-medium">
                      일치하는 사진을 찾지 못했습니다.
                    </p>
                  </div>
                )}
              </section>
            )}
          </div>
          )}

          {activeLoungeType === 'personal' && (
            <div className="flex flex-col gap-3">
              {(() => {
                const isLoggedInUser = Boolean(
                  merlinAuth?.email && merlinAuth.userId && merlinAuth.userId !== 'guest'
                );
                const isPeerConnected =
                  isLoggedInUser &&
                  !thisDeviceRevoked &&
                  (zCoreBridge.isConnected ||
                    Boolean(pcAgentPairedMobile) ||
                    connectedDevices.length >= 2);
                const syncStatusLine = !isLoggedInUser
                  ? '현재 게스트(비로그인) 상태입니다. PC와 같은 이메일로 먼저 로그인해야 기기를 연결할 수 있습니다.'
                  : thisDeviceRevoked
                  ? '이 기기의 연결이 해제되었습니다. 오른쪽 [다시 연결] 버튼을 눌러 바로 복구할 수 있습니다.'
                  : !isPeerConnected
                  ? '내 PC에서도 같은 이메일로 로그인하거나 6자리 연결 번호를 입력해 주세요.'
                  : `연결된 기기 ${Math.max(2, connectedDevices.length)}대 · 최근 동기화: ${syncState.lastSyncedAt}`;
                return (
                  <section
                    ref={privateSyncSectionRef}
                    className="rounded-xl bg-white border border-slate-200 overflow-hidden"
                  >
                    <div
                      onClick={() => setShowPrivateSyncSection((prev) => !prev)}
                      className="p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-2.5 cursor-pointer hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-start sm:items-center gap-2 min-w-0 flex-1">
                        <span className="text-slate-400 text-[12px] select-none mt-0.5 sm:mt-0">
                          {showPrivateSyncSection ? '▾' : '▸'}
                        </span>
                        <div className="flex flex-col min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h2 className="text-[14px] text-slate-900 font-bold break-keep">
                              내 기기 통합 (폰 ↔ PC)
                            </h2>
                            <span
                              className={`px-2 py-0.5 rounded text-[10.5px] font-medium whitespace-nowrap ${
                                !isLoggedInUser
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {!isLoggedInUser
                                ? '로그인 필요'
                                : !isPeerConnected
                                ? '미연결'
                                : syncState.privateSyncStrategy === 'mirror'
                                ? '원본 전체 백업'
                                : '용량 절약 모드'}
                            </span>
                            {isLoggedInUser && syncedClipboardItems.length > 0 && (
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10.5px] font-semibold whitespace-nowrap">
                                클립보드 {syncedClipboardItems.length}건
                              </span>
                            )}
                          </div>
                          <p className="text-[11.5px] text-slate-500 break-keep mt-0.5">
                            {syncStatusLine}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={syncState.syncing}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isLoggedInUser) {
                            window.dispatchEvent(new CustomEvent('openLoginModal'));
                            return;
                          }
                          if (thisDeviceRevoked) {
                            void useSaySeeStore.getState().reconnectThisDevice();
                            return;
                          }
                          void triggerSyncNow();
                        }}
                        className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:bg-teal-600/80 text-white text-[11.5px] font-semibold shrink-0 whitespace-nowrap ml-auto cursor-pointer inline-flex items-center gap-1.5"
                      >
                        {syncState.syncing && (
                          <span className="inline-block w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                        )}
                        {!isLoggedInUser
                          ? '로그인'
                          : thisDeviceRevoked
                          ? '다시 연결'
                          : syncState.syncing
                          ? (() => {
                              const pct = deviceSyncProgress
                                ? Math.min(
                                    99,
                                    Math.max(
                                      1,
                                      Math.round(
                                        (deviceSyncProgress.current /
                                          Math.max(1, deviceSyncProgress.total)) *
                                          100
                                      )
                                    )
                                  )
                                : null;
                              return pct !== null ? `일치화 중 ${pct}%` : '일치화 중...';
                            })()
                          : '지금 일치시키기'}
                      </button>
                    </div>

                    {syncState.syncing && (
                      <div className="px-4 pb-3 pt-0.5 flex flex-col gap-1.5 bg-teal-50/50 border-t border-teal-100">
                        <div className="flex items-center justify-between gap-2 text-[11.5px]">
                          <span className="font-semibold text-teal-800 truncate">
                            {deviceSyncProgress?.phase || '연결 기기와 사진·문서를 맞추고 있어요'}
                          </span>
                          <span className="font-bold text-teal-700 shrink-0 tabular-nums">
                            {deviceSyncProgress
                              ? `${deviceSyncProgress.current}/${Math.max(1, deviceSyncProgress.total)} (${Math.min(
                                  100,
                                  Math.round(
                                    (deviceSyncProgress.current /
                                      Math.max(1, deviceSyncProgress.total)) *
                                      100
                                  )
                                )}%)`
                              : '진행 중...'}
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-teal-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-teal-600 transition-all duration-300"
                            style={{
                              width: `${
                                deviceSyncProgress
                                  ? Math.min(
                                      100,
                                      Math.max(
                                        6,
                                        Math.round(
                                          (deviceSyncProgress.current /
                                            Math.max(1, deviceSyncProgress.total)) *
                                            100
                                        )
                                      )
                                    )
                                  : 12
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {showPrivateSyncSection && (
                      <div className="px-4 pb-4 pt-3 border-t border-slate-100 flex flex-col gap-3">
                        <CrossDeviceClipboardAndPairingBar compact />

                        {(() => {
                          const remoteSyncedPhotos = photos.filter(
                            (p) => !p.quarantined && p.id.startsWith('shadow-remote-')
                          );
                          if (remoteSyncedPhotos.length === 0) return null;
                          return (
                            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col gap-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[12px] font-semibold text-slate-800">
                                  연결된 기기 사진 ({remoteSyncedPhotos.length}장)
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSearchSpace('gallery');
                                    window.setTimeout(() => {
                                      document
                                        .getElementById('ghosti-search-results')
                                        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                    }, 120);
                                  }}
                                  className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 text-[11px] font-medium cursor-pointer shrink-0"
                                >
                                  사진 목록 보기
                                </button>
                              </div>
                              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                                {remoteSyncedPhotos.slice(0, 8).map((rp) => (
                                  <button
                                    key={rp.id}
                                    type="button"
                                    onClick={() => setSelectedPhoto(rp)}
                                    className="w-14 h-14 rounded-lg overflow-hidden border border-slate-200 shrink-0 cursor-pointer bg-slate-100"
                                    title={rp.name}
                                  >
                                    <img
                                      src={rp.thumbUrl}
                                      alt={rp.name}
                                      className="w-full h-full object-cover"
                                    />
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })()}

                        <div
                          onClick={() => setPrivateSyncStrategy('shadow')}
                          className={`p-3.5 rounded-lg border cursor-pointer flex flex-col gap-1 ${
                            syncState.privateSyncStrategy === 'shadow'
                              ? 'bg-slate-50 border-slate-900'
                              : 'bg-white border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[13px] text-slate-900 font-semibold">
                              용량 절약 모드 (기본 · 스마트폰 점유 {syncState.packSizeMB}MB)
                            </span>
                            <input
                              type="radio"
                              checked={syncState.privateSyncStrategy === 'shadow'}
                              onChange={() => setPrivateSyncStrategy('shadow')}
                              className="w-4 h-4 accent-slate-900"
                            />
                          </div>
                          <p className="text-[11.5px] text-slate-500 leading-relaxed break-keep">
                            원본 파일은 내 PC에 보관하고 스마트폰에는 가벼운 미리보기만 남겨 저장공간 부담 없이 검색합니다.
                          </p>
                        </div>

                        <div
                          onClick={() => setPrivateSyncStrategy('mirror')}
                          className={`p-3.5 rounded-lg border cursor-pointer flex flex-col gap-1 ${
                            syncState.privateSyncStrategy === 'mirror'
                              ? 'bg-slate-50 border-slate-900'
                              : 'bg-white border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[13px] text-slate-900 font-semibold">
                              원본 전체 백업 모드
                            </span>
                            <input
                              type="radio"
                              checked={syncState.privateSyncStrategy === 'mirror'}
                              onChange={() => setPrivateSyncStrategy('mirror')}
                              className="w-4 h-4 accent-slate-900"
                            />
                          </div>
                          <p className="text-[11.5px] text-slate-500 leading-relaxed break-keep">
                            스마트폰과 PC 양쪽에 동일한 원본 파일을 모두 저장합니다.
                          </p>
                        </div>

                        <PcMasterQuickSendPanel compact />
                      </div>
                    )}
                  </section>
                );
              })()}
            </div>
          )}
        </main>
      )}

      {activeLoungeType !== 'personal' && mobileTab === 'settings' && (
        <main className="flex-1 w-full px-safe pt-4 pb-10 flex flex-col gap-3.5">
          <LoungeCustomSettingsHeader />
        </main>
      )}

      {!isLandscapeCompact && currentSubmenus.length > 0 && (
        <nav
          style={{ paddingBottom: 'max(0.35rem, env(safe-area-inset-bottom, 0px))' }}
          className="fixed bottom-0 inset-x-0 max-w-xl mx-auto min-h-[54px] bg-white/95 backdrop-blur-md border-t border-slate-200 z-50 px-2 pt-1.5 flex items-center justify-around"
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
                className={`flex-1 py-2 px-1.5 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
                  isSubActive
                    ? 'bg-slate-100 text-slate-900 font-semibold'
                    : 'text-slate-500 font-medium'
                }`}
              >
                <span className="text-[12px] truncate max-w-[44vw]">{sub.label}</span>
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
};
