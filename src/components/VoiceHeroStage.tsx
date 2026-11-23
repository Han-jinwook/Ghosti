import React, { useEffect, useMemo, useState } from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';
import {
  filterPhotosByClubFeedTrack,
  filterVisibleGalleryPhotos,
  isSharedPhotoLounge,
  resolveLoungePhotoCorpus,
} from '../store/slices/storeSharedRefs';
import { requestConnectMyComputer, zCoreBridge } from '../services/zCoreBridge';
import { SilentIndexingStatusBar } from './SilentIndexingStatusBar';
import { VoiceActorControlPill } from './VoiceActorControlPill';
import { isMobileVoiceEnvironment, unlockMobileAudioOnUserGesture } from '../services/setupMonsterTts';
import {
  SEARCH_STAGE_PC_ROLLING_PLACEHOLDERS_10,
  SEARCH_STAGE_MOBILE_ROLLING_PLACEHOLDERS_10,
  PLACEHOLDER_ROLLING_INTERVAL_MS,
  getAndAdvanceSessionPlaceholderStartIndex,
} from '../services/weeklyCareAndPlaceholderEngine';

export const VoiceHeroStage: React.FC = () => {
  const {
    layout,
    activeLoungeType,
    activeFamilyRoom,
    activeSharedRoomId,
    clubFeedTrack,
    photos,
    sharedRoomHostPhotos,
    sharedRoomAddedPhotos,
    searchSpace,
    hasExecutedUserSearch,
    setSearchSpace,
    resetSearchSpaceToAll,
    localDocuments,
    matchedLocalDocs,
    matchedVaultPhotos,
    searchResults,
    videoSceneItems,
    matchedVideoScenes,
    activeQuery,
    isListening,
    liveWaveBands,
    interimSttPreview,
    toggleMicRecording,
    runTextQuery,
    openLocalFolder,
    syncMobileNativeGalleryAuto,
    isStoreAppMode,
  } = useSaySeeStore();

  const [textInput, setTextInput] = useState(() => {
    if (typeof window === 'undefined') return '';
    const sp = new URLSearchParams(window.location.search);
    return sp.get('ghostSearchWindow') ? sp.get('q') || '' : '';
  });
  const [isZCoreConnected, setIsZCoreConnected] = useState(zCoreBridge.isConnected);

  useEffect(() => {
    return zCoreBridge.subscribe((connected) => setIsZCoreConnected(connected));
  }, []);

  const sharedMode = isSharedPhotoLounge(activeLoungeType);

  useEffect(() => {
    if (sharedMode && searchSpace === 'vault') {
      setSearchSpace('gallery');
    }
  }, [sharedMode, searchSpace, setSearchSpace]);

  const scopedLocalDocuments = useMemo(
    () => (sharedMode ? [] : localDocuments),
    [sharedMode, localDocuments]
  );
  const scopedVideoSceneItems = useMemo(
    () => (sharedMode ? [] : videoSceneItems),
    [sharedMode, videoSceneItems]
  );

  const activePhotos = useMemo(() => {
    const sourcePhotos = resolveLoungePhotoCorpus({
      activeLoungeType,
      activeFamilyRoom,
      activeSharedRoomId,
      photos,
      sharedRoomHostPhotos,
      sharedRoomAddedPhotos,
    });
    return sourcePhotos.filter((p) => !p.quarantined);
  }, [
    activeLoungeType,
    activeFamilyRoom,
    activeSharedRoomId,
    photos,
    sharedRoomAddedPhotos,
    sharedRoomHostPhotos,
  ]);

  const gallerySceneCount = useMemo(
    () =>
      filterPhotosByClubFeedTrack(
        filterVisibleGalleryPhotos(activePhotos),
        activeLoungeType,
        clubFeedTrack
      ).length,
    [activePhotos, activeLoungeType, clubFeedTrack]
  );
  const vaultPhotoCount = useMemo(
    () => (sharedMode ? 0 : activePhotos.filter((p) => p.isVaultDocument).length),
    [sharedMode, activePhotos]
  );
  const totalIndexedDocs = scopedLocalDocuments.length + vaultPhotoCount;
  const matchedTotalDocsCount = sharedMode ? 0 : matchedLocalDocs.length + matchedVaultPhotos.length;

  const isMobile = layout === 'mobile';
  const isMobileOrStore = isMobile || Boolean(isStoreAppMode);
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

  const searchPlaceholderPool = useMemo(
    () =>
      isMobileOrStore
        ? SEARCH_STAGE_MOBILE_ROLLING_PLACEHOLDERS_10
        : SEARCH_STAGE_PC_ROLLING_PLACEHOLDERS_10,
    [isMobileOrStore]
  );
  const [rollingSearchIdx, setRollingSearchIdx] = useState<number>(() =>
    getAndAdvanceSessionPlaceholderStartIndex(10)
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRollingSearchIdx((prev) => (prev + 1) % searchPlaceholderPool.length);
    }, PLACEHOLDER_ROLLING_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [searchPlaceholderPool.length]);

  const searchPlaceholder = useMemo(() => {
    return searchPlaceholderPool[rollingSearchIdx % searchPlaceholderPool.length];
  }, [searchPlaceholderPool, rollingSearchIdx]);

  const scrollToResults = () => {
    if (typeof document !== 'undefined') {
      window.setTimeout(() => {
        document.getElementById('ghosti-search-results')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 60);
    }
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    unlockMobileAudioOnUserGesture();
    const q = textInput.trim();
    if (!q) return;
    if (isMobile && typeof document !== 'undefined') {
      (document.activeElement as HTMLElement | null)?.blur?.();
    }
    await runTextQuery(q);
    scrollToResults();
  };

  return (
    <section className={`w-full flex flex-col ${isLandscapeCompact ? 'gap-1.5' : 'gap-2.5'}`}>
      <div className={`w-full flex flex-col ${isLandscapeCompact ? 'gap-1.5' : 'gap-2.5'}`}>
        <form onSubmit={handleTextSubmit} className="w-full flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:flex-1 sm:min-w-[200px] flex items-center">
            <span className="material-symbols-outlined text-[19px] absolute left-3.5 pointer-events-none text-slate-400">
              {searchSpace === 'vault'
                ? 'folder_managed'
                : searchSpace === 'video'
                ? 'smart_display'
                : 'search'}
            </span>
            <input
              id="ghosti-voice-hero-search-input"
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={searchPlaceholder}
              className={`w-full ${
                isLandscapeCompact ? 'h-9.5' : 'h-11 md:h-12'
              } pl-10 ${
                textInput ? 'pr-24' : 'pr-16'
              } rounded-xl bg-white border border-slate-300 focus:border-slate-600 shadow-xs outline-none text-[13.5px] md:text-[14.5px] text-slate-900 placeholder:text-slate-400 transition-colors`}
            />
            {textInput && (
              <button
                type="button"
                onClick={() => setTextInput('')}
                className="absolute right-[70px] text-slate-400 hover:text-slate-700 p-1.5 cursor-pointer"
                title="지우기"
              >
                <span className="material-symbols-outlined text-[17px]">close</span>
              </button>
            )}
            <button
              type="submit"
              className="absolute right-1.5 h-8.5 md:h-9 px-3.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12.5px] font-semibold transition-colors whitespace-nowrap cursor-pointer"
            >
              검색
            </button>
          </div>

          {(isMobileVoiceEnvironment() || Boolean(isStoreAppMode)) && (
            <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-2 shrink-0 sm:ml-auto">
              <button
                type="button"
                onClick={() => {
                  unlockMobileAudioOnUserGesture();
                  void toggleMicRecording();
                }}
                title="마이크로 말해서 검색"
                className={`h-10 px-3.5 flex-1 sm:flex-initial justify-center rounded-xl border flex items-center gap-1.5 text-[12px] font-semibold shrink-0 whitespace-nowrap transition-colors cursor-pointer ${
                  isListening
                    ? 'bg-teal-600 text-white border-teal-600'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {isListening ? 'stop_circle' : 'mic'}
                </span>
                <span>{isListening ? '듣는 중' : '말하기'}</span>
              </button>

              {!(isMobile && activeLoungeType === 'personal') && <VoiceActorControlPill />}
            </div>
          )}
        </form>

        {(isMobileVoiceEnvironment() || Boolean(isStoreAppMode)) && isListening && (
          <div className="px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex items-center gap-0.5 h-4 shrink-0">
                {liveWaveBands.slice(0, 8).map((amp, i) => (
                  <span
                    key={i}
                    style={{ height: `${Math.max(4, Math.round(amp * 16))}px` }}
                    className="w-1 rounded-full bg-slate-700 transition-all duration-100"
                  />
                ))}
              </div>
              <span className="text-[12.5px] text-slate-700 font-medium truncate">
                {interimSttPreview
                  ? `“${interimSttPreview}”`
                  : '말씀해 주세요. 말씀이 끝나면 바로 검색됩니다.'}
              </span>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pb-0.5">
          <div
            className={`grid ${
              sharedMode ? 'grid-cols-2' : 'grid-cols-3'
            } w-full sm:w-auto sm:flex items-center gap-1.5 max-w-full`}
          >
            <button
              type="button"
              onClick={() => {
                setSearchSpace('gallery');
                scrollToResults();
              }}
              className={`px-3 sm:px-3.5 py-1.5 rounded-lg text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-colors border shrink-0 whitespace-nowrap outline-none cursor-pointer ${
                searchSpace === 'gallery'
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              <span>사진</span>
              <span
                className={`text-[11.5px] tabular-nums ${
                  searchSpace === 'gallery' ? 'text-slate-300' : 'text-slate-400'
                }`}
              >
                {hasExecutedUserSearch ? searchResults.length : gallerySceneCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSearchSpace('video');
                if (
                  typeof window !== 'undefined' &&
                  Boolean(
                    (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
                      .Capacitor?.isNativePlatform?.()
                  )
                ) {
                  void syncMobileNativeGalleryAuto({ promptPermission: true });
                }
                scrollToResults();
              }}
              className={`px-3 sm:px-3.5 py-1.5 rounded-lg text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-colors border shrink-0 whitespace-nowrap outline-none cursor-pointer ${
                searchSpace === 'video'
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              <span>동영상</span>
              <span
                className={`text-[11.5px] tabular-nums ${
                  searchSpace === 'video' ? 'text-slate-300' : 'text-slate-400'
                }`}
              >
                {hasExecutedUserSearch ? matchedVideoScenes.length : scopedVideoSceneItems.length}
              </span>
            </button>

            {!sharedMode && (
              <button
                type="button"
                onClick={() => {
                  setSearchSpace('vault');
                  scrollToResults();
                }}
                className={`px-3 sm:px-3.5 py-1.5 rounded-lg text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-colors border shrink-0 whitespace-nowrap outline-none cursor-pointer ${
                  searchSpace === 'vault'
                    ? 'bg-teal-600 text-white border-teal-600'
                    : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
                }`}
              >
                <span>문서</span>
                <span
                  className={`text-[11.5px] tabular-nums ${
                    searchSpace === 'vault' ? 'text-slate-300' : 'text-slate-400'
                  }`}
                >
                  {hasExecutedUserSearch ? matchedTotalDocsCount : totalIndexedDocs}
                </span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {hasExecutedUserSearch && (
              <div className="flex items-center gap-2">
                <span className="hidden md:inline text-[12px] text-slate-600">
                  <strong className="text-slate-900">“{activeQuery}”</strong> 결과:{' '}
                  <span>
                    사진 {searchResults.length} · 동영상 {matchedVideoScenes.length}
                    {!sharedMode ? ` · 문서 ${matchedTotalDocsCount}` : ''}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setTextInput('');
                    resetSearchSpaceToAll(searchSpace);
                  }}
                  className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 text-[12px] whitespace-nowrap cursor-pointer"
                >
                  검색 해제
                </button>
              </div>
            )}

            {!sharedMode && searchSpace === 'vault' && !isMobile && (
              <button
                type="button"
                onClick={() => void openLocalFolder('docs')}
                className="px-3 py-1.5 rounded-md bg-white hover:bg-slate-50 text-slate-700 text-[12px] font-medium border border-slate-200 shrink-0 whitespace-nowrap cursor-pointer"
              >
                문서 폴더 열기
              </button>
            )}
          </div>
        </div>

        {isZCoreConnected ? (
          <SilentIndexingStatusBar variant="search-bar" className="mt-0.5" />
        ) : activeLoungeType === 'family' ||
          activeLoungeType === 'club' ||
          activeLoungeType === 'student' ||
          activeLoungeType === 'work' ||
          (isMobile && activeLoungeType === 'personal') ? null : isMobile || isStoreAppMode ? (
          <div className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <span className="text-[12.5px] font-medium text-slate-700">
              스마트폰 사진첩을 연동하면 사진과 영상을 바로 찾고 정리할 수 있습니다.
            </span>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => void syncMobileNativeGalleryAuto({ promptPermission: true })}
                className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs whitespace-nowrap transition-colors cursor-pointer shrink-0"
              >
                사진첩 동기화
              </button>
              {!isStoreAppMode && (
                <button
                  type="button"
                  onClick={() => requestConnectMyComputer()}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-medium text-xs whitespace-nowrap transition-colors cursor-pointer shrink-0"
                >
                  PC 연결 안내
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <span className="text-[12.5px] font-medium text-slate-700">
              {hasExecutedUserSearch
                ? '현재 샘플 검색 결과를 보고 있습니다. 내 컴퓨터를 연결하면 실제 파일을 찾습니다.'
                : '현재 샘플 화면입니다. 내 컴퓨터를 연결하면 사진·영상·문서를 바로 찾을 수 있습니다.'}
            </span>
            <button
              type="button"
              onClick={() => requestConnectMyComputer()}
              className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs whitespace-nowrap transition-colors cursor-pointer shrink-0"
            >
              내 컴퓨터 연결
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
