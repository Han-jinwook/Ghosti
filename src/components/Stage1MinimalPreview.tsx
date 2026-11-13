import React, { useEffect, useMemo, useState } from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';
import type { PhotoItem, TrashCategory } from '../types/saysee';
import {
  cleanVideoTimestampLabel,
  groupBurstSearchResults,
  resolveVideoCardThumbUrl,
} from '../services/aiEngine';
import { executeRealOsAction } from '../services/setupMonsterEngine';
import { renderHighlightedDocText } from './PricingModal';
import {
  requestConnectMyComputer,
  zCoreBridge,
  isZCoreOutdated,
  LATEST_Z_CORE_VERSION,
  Z_CORE_ZIP_URL,
} from '../services/zCoreBridge';
import { SilentIndexingStatusBar } from './SilentIndexingStatusBar';
import { VoiceActorControlPill } from './VoiceActorControlPill';
import { isMobileVoiceEnvironment, unlockMobileAudioOnUserGesture } from '../services/setupMonsterTts';
import {
  SEARCH_STAGE_PC_ROLLING_PLACEHOLDERS_10,
  SEARCH_STAGE_MOBILE_ROLLING_PLACEHOLDERS_10,
  getAndAdvanceSessionPlaceholderStartIndex,
} from '../services/weeklyCareAndPlaceholderEngine';
import { MonsterStandardChatColumn } from './MonsterStandardChatColumn';
import { GhostPassportCandidatesPanel } from './GhostPassportCandidatesPanel';
import { GhostPhotoOcrTeleportModal } from './GhostWindowThreeStageMockup';
import { GhostSecretaryFirstGuard, jumpToGhostSecretary } from './GhostSecretaryFirstGuard';

const STAGE1_ROLLING_INTERVAL_MS = 10_000; // 10초 자동 롤링

const TRASH_TABS_4: {
  key: 'duplicate' | 'memo' | 'screenshot' | 'blurry';
  stepNum: string;
  title: string;
  shortTitle: string;
  shortBadge: string;
  cleanTag: string;
  subtitle: string;
  icon: string;
}[] = [
  {
    key: 'duplicate',
    stepNum: '①',
    title: '중복·연사 사진',
    shortTitle: '중복·연사 사진',
    shortBadge: '중복·연사 사진',
    cleanTag: '#중복·연사사본',
    subtitle: '원본 1장만 남기고 정리',
    icon: 'burst_mode',
  },
  {
    key: 'memo',
    stepNum: '②',
    title: '주차·영수증·메모',
    shortTitle: '주차·영수증·메모',
    shortBadge: '주차·영수증·메모',
    cleanTag: '#주차·부품·일회성메모',
    subtitle: '주차장·부품·단기 메모',
    icon: 'description',
  },
  {
    key: 'screenshot',
    stepNum: '③',
    title: '스크린샷·캡처',
    shortTitle: '스크린샷·캡처',
    shortBadge: '스크린샷·캡처',
    cleanTag: '#스크린샷 캡처',
    subtitle: '문자·화면 캡처 정리',
    icon: 'screenshot_mobile',
  },
  {
    key: 'blurry',
    stepNum: '④',
    title: '흔들림·오촬영',
    shortTitle: '흔들림·오촬영',
    shortBadge: '흔들림·오촬영',
    cleanTag: '#초점이탈·오촬영',
    subtitle: '흐릿하거나 잘못 찍힌 사진',
    icon: 'blur_on',
  },
];

const FALLBACK_SAMPLE_TRASH_ITEMS: Record<
  'duplicate' | 'memo' | 'screenshot' | 'blurry',
  PhotoItem[]
> = {
  duplicate: [
    {
      id: 'sample_dup_1',
      name: 'IMG_20250510_1002.jpg',
      size: 312_000,
      date: '2025-05-10',
      mtimeMs: 1746835200000,
      thumbUrl: '/sample_photos_301/IMG_20250510_1002.jpg',
      fullUrl: '/sample_photos_301/IMG_20250510_1002.jpg',
      tags: ['#연사·중복사본', '#해변가족'],
      trashCategory: 'duplicate',
      trashConfidence: 0.99,
      quarantined: false,
      presetScores: {},
    },
    {
      id: 'sample_dup_2',
      name: 'IMG_20250510_1003.jpg',
      size: 298_000,
      date: '2025-05-10',
      mtimeMs: 1746835201000,
      thumbUrl: '/sample_photos_301/IMG_20250510_1003.jpg',
      fullUrl: '/sample_photos_301/IMG_20250510_1003.jpg',
      tags: ['#연사·중복사본', '#해변가족'],
      trashCategory: 'duplicate',
      trashConfidence: 0.98,
      quarantined: false,
      presetScores: {},
    },
  ],
  memo: [
    {
      id: 'sample_memo_1',
      name: 'MEMO_202509_1259_주차장_기둥.jpg',
      size: 185_000,
      date: '2025-09-12',
      mtimeMs: 1757635200000,
      thumbUrl: '/sample_photos_301/MEMO_202509_1259_주차장_기둥.jpg',
      fullUrl: '/sample_photos_301/MEMO_202509_1259_주차장_기둥.jpg',
      tags: ['#주차장·기둥메모', '#지하주차장 B3'],
      trashCategory: 'memo',
      trashConfidence: 0.97,
      quarantined: false,
      presetScores: {},
    },
    {
      id: 'sample_memo_2',
      name: 'MEMO_202509_1261_택배_상자.jpg',
      size: 210_000,
      date: '2025-09-14',
      mtimeMs: 1757808000000,
      thumbUrl: '/sample_photos_301/MEMO_202509_1261_택배_상자.jpg',
      fullUrl: '/sample_photos_301/MEMO_202509_1261_택배_상자.jpg',
      tags: ['#택배·상자메모', '#일회성기록'],
      trashCategory: 'memo',
      trashConfidence: 0.96,
      quarantined: false,
      presetScores: {},
    },
  ],
  screenshot: [
    {
      id: 'sample_screen_1',
      name: 'Screenshot_20250802_1001_쇼핑위시리스트.jpg',
      size: 240_000,
      date: '2025-08-02',
      mtimeMs: 1754092800000,
      thumbUrl: '/sample_photos_301/Screenshot_20250802_1001_쇼핑위시리스트.jpg',
      fullUrl: '/sample_photos_301/Screenshot_20250802_1001_쇼핑위시리스트.jpg',
      tags: ['#스크린샷·화면캡처', '#쇼핑위시리스트'],
      trashCategory: 'screenshot',
      trashConfidence: 0.99,
      quarantined: false,
      presetScores: {},
    },
    {
      id: 'sample_screen_2',
      name: 'Screenshot_20250802_1002_배달주문내역.jpg',
      size: 225_000,
      date: '2025-08-02',
      mtimeMs: 1754092900000,
      thumbUrl: '/sample_photos_301/Screenshot_20250802_1002_배달주문내역.jpg',
      fullUrl: '/sample_photos_301/Screenshot_20250802_1002_배달주문내역.jpg',
      tags: ['#스크린샷·화면캡처', '#배달주문내역'],
      trashCategory: 'screenshot',
      trashConfidence: 0.99,
      quarantined: false,
      presetScores: {},
    },
  ],
  blurry: [
    {
      id: 'sample_blur_1',
      name: 'BLUR_202510_1282_흔들린사진.jpg',
      size: 194_000,
      date: '2025-10-03',
      mtimeMs: 1759449600000,
      thumbUrl: '/sample_photos_301/BLUR_202510_1282_흔들린사진.jpg',
      fullUrl: '/sample_photos_301/BLUR_202510_1282_흔들린사진.jpg',
      tags: ['#초점이탈·심한흔들림'],
      trashCategory: 'blurry',
      trashConfidence: 0.96,
      quarantined: false,
      presetScores: {},
    },
    {
      id: 'sample_blur_2',
      name: 'BLUR_202510_1283_흔들린사진.jpg',
      size: 188_000,
      date: '2025-10-03',
      mtimeMs: 1759449700000,
      thumbUrl: '/sample_photos_301/BLUR_202510_1283_흔들린사진.jpg',
      fullUrl: '/sample_photos_301/BLUR_202510_1283_흔들린사진.jpg',
      tags: ['#초점이탈·심한흔들림'],
      trashCategory: 'blurry',
      trashConfidence: 0.95,
      quarantined: false,
      presetScores: {},
    },
  ],
};

const fmtMB = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

function matchesTrashTab(photo: PhotoItem, tabKey: string): boolean {
  if (!photo.trashCategory || photo.quarantined) return false;
  if (tabKey === 'all') return true;
  if (tabKey === 'memo') {
    return (
      photo.trashCategory === 'memo' ||
      photo.trashCategory === 'object' ||
      photo.trashCategory === 'document' ||
      photo.trashCategory === 'receipt'
    );
  }
  return photo.trashCategory === tabKey;
}

/**
 * 🧪 1단계 [🎯 찾기] 미니멀 프리뷰 컴포넌트
 * - 기존 상단 검색 구도 + 하단 샘플 사진·영상·문서 바둑판 100% 보존
 * - 1) 검색창 내부 10초 롤링 플레이스홀더 + 포커스/타이핑 시 즉시 정지 + [예시 바로 검색 ↵] 원클릭 체험 버튼
 * - 2) [❐ 동일 연사 묶어보기 ON] 스위치 버튼 삭제 & "전체 사진 목록 · 총 N장" 단순화 (썸네일 클릭 시 상세 모달에서 연사 나란히 비교 보장)
 * - 3) 문서·영상 목록 상단 TMI 설명 배지("실생활 필수 문서 N건 · 별표 가림 없이...") -> "총 N건" 단순화
 */
export const Stage1MinimalSearchPreview: React.FC<{ initialQuery?: string }> = ({
  initialQuery = '',
}) => {
  const {
    layout,
    photos,
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
    importMobileLocalPhotos,
    isStoreAppMode,
    setSelectedPhoto,
    setSelectedVideoModal,
    setSelectedDocModal,
    syncRealVideoDuration,
    toggleBookmark,
    initialized,
  } = useSaySeeStore();

  const [textInput, setTextInput] = useState(() => {
    if (initialQuery && initialQuery.trim()) return initialQuery.trim();
    if (typeof window !== 'undefined') {
      const qParam = new URLSearchParams(window.location.search).get('q');
      if (qParam && qParam.trim()) return qParam.trim();
    }
    if (
      hasExecutedUserSearch &&
      activeQuery &&
      !activeQuery.startsWith('전체 갤러리 사진') &&
      !activeQuery.startsWith('동영상 ') &&
      !activeQuery.startsWith('최근 서류 ')
    ) {
      return activeQuery;
    }
    return '';
  });
  const [ocrModalPhoto, setOcrModalPhoto] = useState<PhotoItem | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const mobilePhotoInputRef = React.useRef<HTMLInputElement | null>(null);
  const [isZCoreConnected, setIsZCoreConnected] = useState(zCoreBridge.isConnected);

  useEffect(() => {
    return zCoreBridge.subscribe((connected) => setIsZCoreConnected(connected));
  }, []);

  useEffect(() => {
    const q = (initialQuery || '').trim();
    if (q) {
      setTextInput(q);
      // 초기 코퍼스 적재(initialized) 완료 전에는 빈 배열에 runTextQuery를 호출하지 않아 (0) 깜빡임을 원천 차단!
      if (initialized && (!hasExecutedUserSearch || activeQuery !== q)) {
        void runTextQuery(q);
      }
      return;
    }
    if (
      hasExecutedUserSearch &&
      activeQuery &&
      !activeQuery.startsWith('전체 갤러리 사진') &&
      !activeQuery.startsWith('동영상 ') &&
      !activeQuery.startsWith('최근 서류 ')
    ) {
      setTextInput(activeQuery);
    }
  }, [initialQuery, initialized, hasExecutedUserSearch, activeQuery, runTextQuery]);

  const isMobile = layout === 'mobile';
  const isMobileOrStore = isMobile || Boolean(isStoreAppMode);
  const allowMobileVoice = isMobileVoiceEnvironment() || Boolean(isStoreAppMode);
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

  // [레드팀 보완 1] 포커스 중이거나 1글자라도 타이핑 중이면 10초 자동 롤링 일시정지
  useEffect(() => {
    if (isInputFocused || textInput.trim().length > 0) return;
    const timer = window.setInterval(() => {
      setRollingSearchIdx((prev) => (prev + 1) % searchPlaceholderPool.length);
    }, STAGE1_ROLLING_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [isInputFocused, textInput, searchPlaceholderPool.length]);

  const currentExampleSentence = useMemo(() => {
    return searchPlaceholderPool[rollingSearchIdx % searchPlaceholderPool.length];
  }, [searchPlaceholderPool, rollingSearchIdx]);

  const activePhotos = useMemo(() => photos.filter((p) => !p.quarantined), [photos]);
  const gallerySceneCount = useMemo(
    () =>
      activePhotos.filter(
        (p) =>
          !p.isVaultDocument &&
          p.trashCategory !== 'blurry' &&
          p.trashCategory !== 'screenshot' &&
          p.trashCategory !== 'memo' &&
          p.trashCategory !== 'duplicate'
      ).length,
    [activePhotos]
  );
  const vaultPhotoCount = useMemo(
    () => activePhotos.filter((p) => p.isVaultDocument).length,
    [activePhotos]
  );
  const totalIndexedDocs = localDocuments.length + vaultPhotoCount;
  const matchedTotalDocsCount = matchedLocalDocs.length + matchedVaultPhotos.length;

  // 연사 묶기는 스위치 없이 항상 기본 ON으로 자동 작동
  const groupedResults = useMemo(() => {
    const orderedGroups = groupBurstSearchResults(searchResults);
    if (searchSpace === 'vault') {
      return orderedGroups.flatMap((g) =>
        g.burstPhotos.map((photo) => ({
          representative: {
            photo,
            score: g.representative.score,
            matchPercentage: g.representative.matchPercentage,
            matchedBy: g.representative.matchedBy,
          },
          burstPhotos: [photo],
          burstCount: 1,
        }))
      );
    }
    return orderedGroups;
  }, [searchResults, searchSpace]);

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
    const fallbackExample =
      searchSpace === 'video' ? '룰렛 돌리는 장면' : currentExampleSentence;
    const q = (textInput.trim() || fallbackExample).trim();
    if (!q) return;
    setTextInput(q);
    await runTextQuery(q);
    scrollToResults();
  };

  const handleRunExampleInstant = async () => {
    unlockMobileAudioOnUserGesture();
    const fallbackExample =
      searchSpace === 'video' ? '룰렛 돌리는 장면' : currentExampleSentence;
    const q = fallbackExample.trim();
    if (!q) return;
    setTextInput(q);
    await runTextQuery(q);
    scrollToResults();
  };

  const handleStepPlaceholder = (delta: -1 | 1) => {
    setRollingSearchIdx(
      (prev) => (prev + delta + searchPlaceholderPool.length) % searchPlaceholderPool.length
    );
  };

  return (
    <main className="flex-1 w-full max-w-[1320px] mx-auto px-4 sm:px-6 md:px-10 py-6 sm:py-8 flex flex-col gap-6">
      {/* 상단 검색 프레임 */}
      <div className="w-full flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
          <h1 className="font-headline-md text-[20px] md:text-[24px] text-white font-extrabold tracking-tight">
            🔍 내 기기 1초 AI 내용검색
          </h1>
        </div>

        <section className="w-full flex flex-col gap-3">
          <div className="w-full flex flex-col gap-3">
            {/* 1-A. 자연어 문장형 통합 검색창 (10초 롤링 플레이스홀더 + 포커스 정지 + [◀][▶][예시 바로 검색 ↵][검색] 우측 정렬) */}
            <form onSubmit={handleTextSubmit} className="w-full flex flex-wrap items-center gap-1.5 sm:gap-2">
              <div className="relative flex-1 min-w-[200px] flex items-center">
                <span className="material-symbols-outlined text-[20px] absolute left-3.5 pointer-events-none text-zinc-400">
                  {searchSpace === 'vault'
                    ? 'folder_managed'
                    : searchSpace === 'video'
                    ? 'smart_display'
                    : 'search'}
                </span>
                <input
                  type="text"
                  value={textInput}
                  onFocus={() => setIsInputFocused(true)}
                  onBlur={() => setIsInputFocused(false)}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder={
                    searchSpace === 'video'
                      ? '내 영상 속 찾고 싶은 특정 장면이나 대사를 입력해 보세요 (그 순간부터 바로 재생됩니다)'
                      : `예) ${currentExampleSentence}`
                  }
                  className="w-full h-11 md:h-13 pl-10 pr-[110px] sm:pr-[264px] rounded-2xl bg-[#18181B] border border-white/15 focus:border-primary-container shadow-sm outline-none font-body-md text-[13px] md:text-[14.5px] text-white placeholder:text-zinc-400/75 transition-colors"
                />

                {/* 우측 컨트롤 그룹: [◀] [▶] [예시 바로 검색 ↵] [검색] (좌측 겹침 원천 차단) */}
                <div className="absolute right-1.5 inset-y-0 flex items-center gap-1">
                  {!textInput.trim() ? (
                    <div className="hidden sm:flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleStepPlaceholder(-1)}
                        title="이전 예시 문구 보기"
                        className="w-7 h-7 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-300 hover:text-white text-[11px] font-bold flex items-center justify-center transition-colors cursor-pointer"
                      >
                        ◀
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStepPlaceholder(1)}
                        title="다음 예시 문구 보기"
                        className="w-7 h-7 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-300 hover:text-white text-[11px] font-bold flex items-center justify-center transition-colors cursor-pointer"
                      >
                        ▶
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleRunExampleInstant()}
                        title="지금 보이는 예시 문장으로 1초 만에 바로 검색해 봅니다"
                        className="inline-flex items-center gap-1 h-7.5 px-2.5 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 border border-teal-400/35 text-teal-300 font-label-sm text-[11.5px] font-extrabold transition-all whitespace-nowrap cursor-pointer"
                      >
                        <span>예시 바로 검색 ↵</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setTextInput('')}
                      className="text-zinc-400 hover:text-white p-1 cursor-pointer"
                      title="지우기"
                    >
                      <span className="material-symbols-outlined text-[17px]">close</span>
                    </button>
                  )}
                  <button
                    type="submit"
                    className="h-8.5 md:h-10 px-3.5 rounded-xl bg-primary-container hover:opacity-95 text-zinc-950 font-label-md text-[12.5px] md:text-[13px] font-extrabold transition-all whitespace-nowrap cursor-pointer"
                  >
                    검색
                  </button>
                </div>
              </div>

              {allowMobileVoice && (
                <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                  <button
                    type="button"
                    onClick={() => {
                      unlockMobileAudioOnUserGesture();
                      void toggleMicRecording();
                    }}
                    title="모바일 마이크로 말해서 검색·낭독·손보기"
                    className={`h-10 px-3 rounded-2xl border flex items-center gap-1 font-label-md text-[12px] font-bold shrink-0 whitespace-nowrap transition-all cursor-pointer ${
                      isListening
                        ? 'bg-primary-container text-zinc-950 border-primary-container animate-pulse'
                        : 'bg-[#18181B] hover:bg-zinc-800 text-zinc-200 border-white/15'
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined text-[18px] ${
                        isListening ? 'text-zinc-950' : 'text-primary-container'
                      }`}
                    >
                      {isListening ? 'stop_circle' : 'mic'}
                    </span>
                    <span>{isListening ? '듣는 중' : '말하기'}</span>
                  </button>
                  <VoiceActorControlPill />
                </div>
              )}
            </form>

            {allowMobileVoice && isListening && (
              <div className="px-3.5 py-2 rounded-xl bg-zinc-950 border border-white/10 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex items-center gap-0.5 h-4 shrink-0">
                    {liveWaveBands.slice(0, 8).map((amp, i) => (
                      <span
                        key={i}
                        style={{ height: `${Math.max(4, Math.round(amp * 16))}px` }}
                        className="w-1 rounded-full bg-primary-container transition-all duration-100"
                      />
                    ))}
                  </div>
                  <span className="font-label-md text-[12.5px] text-primary-container font-bold truncate">
                    {interimSttPreview
                      ? `“${interimSttPreview}”`
                      : '말씀해 주세요... (말씀이 끝나면 즉시 검색됩니다)'}
                  </span>
                </div>
              </div>
            )}

            {/* 1-B. 3대 카테고리 스위칭 캡슐 탭: [사진] | [동영상] | [문서] */}
            <div className="flex flex-wrap items-center justify-between gap-2 overflow-x-auto no-scrollbar pb-0.5">
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setSearchSpace('gallery')}
                  className={`px-4 py-2 rounded-full font-label-md text-[13px] font-bold flex items-center gap-1.5 transition-all border shrink-0 whitespace-nowrap outline-none focus:outline-none cursor-pointer ${
                    searchSpace === 'gallery'
                      ? 'bg-primary-container text-zinc-950 border-primary-container font-extrabold'
                      : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border-white/10'
                  }`}
                >
                  <span>사진</span>
                  <span
                    className={`px-2 py-0.2 rounded-full text-[11px] font-mono ${
                      searchSpace === 'gallery'
                        ? 'bg-white/25 text-zinc-950 font-black'
                        : hasExecutedUserSearch && searchResults.length > 0
                        ? 'bg-primary-container/20 text-primary-container font-bold'
                        : 'text-zinc-400 font-bold'
                    }`}
                  >
                    {!initialized
                      ? '…'
                      : hasExecutedUserSearch
                      ? `(${searchResults.length})`
                      : gallerySceneCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSearchSpace('video')}
                  className={`px-4 py-2 rounded-full font-label-md text-[13px] font-bold flex items-center gap-1.5 transition-all border shrink-0 whitespace-nowrap outline-none focus:outline-none cursor-pointer ${
                    searchSpace === 'video'
                      ? 'bg-primary-container text-zinc-950 border-primary-container font-extrabold'
                      : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border-white/10'
                  }`}
                >
                  <span>동영상</span>
                  <span
                    className={`px-2 py-0.2 rounded-full text-[11px] font-mono ${
                      searchSpace === 'video'
                        ? 'bg-white/25 text-zinc-950 font-black'
                        : hasExecutedUserSearch && matchedVideoScenes.length > 0
                        ? 'bg-primary-container/20 text-primary-container font-bold'
                        : 'text-zinc-400 font-bold'
                    }`}
                  >
                    {!initialized
                      ? '…'
                      : hasExecutedUserSearch
                      ? `(${matchedVideoScenes.length})`
                      : `${videoSceneItems.length}`}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSearchSpace('vault')}
                  className={`px-4 py-2 rounded-full font-label-md text-[13px] font-bold flex items-center gap-1.5 transition-all border shrink-0 whitespace-nowrap outline-none focus:outline-none cursor-pointer ${
                    searchSpace === 'vault'
                      ? 'bg-primary-container text-zinc-950 border-primary-container font-extrabold'
                      : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border-white/10'
                  }`}
                >
                  <span>문서</span>
                  <span
                    className={`px-2 py-0.2 rounded-full text-[11px] font-mono ${
                      searchSpace === 'vault'
                        ? 'bg-white/25 text-zinc-950 font-black'
                        : hasExecutedUserSearch && matchedTotalDocsCount > 0
                        ? 'bg-primary-container/20 text-primary-container font-bold'
                        : 'text-zinc-400 font-bold'
                    }`}
                  >
                    {!initialized
                      ? '…'
                      : hasExecutedUserSearch
                      ? `(${matchedTotalDocsCount})`
                      : totalIndexedDocs}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const targetPhoto =
                      searchResults[0]?.photo ||
                      photos.find((p) => !p.quarantined) ||
                      photos[0] ||
                      null;
                    if (targetPhoto) {
                      setOcrModalPhoto(targetPhoto);
                    }
                  }}
                  title="사진에서 글자·표·원하는 단어 조각(칩)만 바로 따내기 (창 UI ③)"
                  className="px-3.5 py-2 rounded-full bg-zinc-950 hover:bg-teal-400 text-teal-200 hover:text-zinc-950 border border-teal-400/60 font-label-md text-[12.5px] font-black shadow-md flex items-center gap-1 shrink-0 whitespace-nowrap transition-all cursor-pointer"
                >
                  <span>📝 OCR 글자 따기</span>
                </button>
              </div>

              {hasExecutedUserSearch && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setTextInput('');
                      resetSearchSpaceToAll(searchSpace);
                    }}
                    className="px-3 py-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-400 hover:text-white font-label-sm text-[11.5px] whitespace-nowrap cursor-pointer"
                  >
                    ✕ 검색 해제
                  </button>
                </div>
              )}
            </div>

            {/* 1-D. 연결 상태 바 */}
            {isZCoreConnected ? (
              <SilentIndexingStatusBar variant="search-bar" className="mt-1" />
            ) : isMobile || isStoreAppMode ? (
              <div className="w-full px-4 py-2.5 rounded-2xl bg-teal-500/10 dark:bg-teal-950/35 border border-teal-500/30 flex flex-wrap items-center justify-between gap-3 mt-0.5 shadow-sm">
                <input
                  ref={mobilePhotoInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      void importMobileLocalPhotos(e.target.files);
                      e.target.value = '';
                    }
                  }}
                />
                <span className="text-[12.5px] font-extrabold text-slate-900 dark:text-white">
                  📱 내 스마트폰 갤러리 사진을 불러와 선명도·중복·영수증을 1초 만에 정리·검색해 보세요!
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => mobilePhotoInputRef.current?.click()}
                    className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black text-xs whitespace-nowrap transition-all cursor-pointer shrink-0"
                  >
                    📱 내 폰 사진 불러오기
                  </button>
                  <button
                    type="button"
                    onClick={() => requestConnectMyComputer()}
                    className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-white/15 font-bold text-xs whitespace-nowrap transition-all cursor-pointer shrink-0"
                  >
                    💻 내 PC 연결 안내
                  </button>
                </div>
              </div>
            ) : (
              <div className="w-full px-4 py-2 rounded-2xl bg-teal-500/10 dark:bg-teal-950/35 border border-teal-500/30 flex flex-wrap items-center justify-between gap-2.5 mt-0.5 shadow-sm">
                <div className="flex flex-wrap items-center gap-2 text-[12.5px] font-extrabold text-slate-900 dark:text-white">
                  <span>👀 현재 눈으로 구경 중입니다 (직접 클릭·내 진짜 파일 검색은 『👻 귀신비서』 대화 후 열려요!)</span>
                </div>
                <button
                  type="button"
                  data-allow-secretary-jump="true"
                  onClick={jumpToGhostSecretary}
                  className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black text-xs whitespace-nowrap transition-all cursor-pointer shrink-0"
                >
                  👻 &apos;귀신비서&apos;와 먼저 대화하기 ➔
                </button>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* 하단 샘플 사진·영상·문서 바둑판 (100% 보존 + TMI 배지 단순화) */}
      <div id="ghosti-search-results" className="scroll-mt-20">
        {searchSpace === 'video' ? (
          <section className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-headline-sm text-[17px] md:text-[18px] text-white font-bold">
                  {hasExecutedUserSearch && activeQuery
                    ? `“${activeQuery}” 동영상 검색 결과`
                    : '전체 동영상 목록'}
                </h2>
                <span className="px-2.5 py-0.5 rounded-md bg-zinc-900 border border-white/10 text-zinc-300 font-label-sm text-[12px] font-medium">
                  총 {matchedVideoScenes.length}건
                </span>
              </div>

              <div className="flex items-center gap-2">
                {matchedVideoScenes.length < videoSceneItems.length && (
                  <button
                    onClick={() => resetSearchSpaceToAll('video')}
                    className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-primary-container font-label-sm text-[12px] font-bold border border-white/10 cursor-pointer"
                  >
                    동영상 {videoSceneItems.length}개 전체 보기
                  </button>
                )}
              </div>
            </div>

            {matchedVideoScenes.length > 0 && (
              <div className="px-3.5 py-2.5 rounded-xl bg-teal-950/60 border border-teal-400/40 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[12px] text-teal-200 font-bold">
                  👻 화면 속 글자(자막·문서·칠판)가 찍힌 영상은 우측 하단 <strong className="text-teal-300">[📝 글자 뽑기]</strong>를 누르면 1초 만에 텍스트로 쏙 뽑아 복사할 수 있어요!
                </span>
              </div>
            )}

            {matchedVideoScenes.length === 0 ? (
              <div className="w-full py-12 px-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col items-center justify-center text-center gap-2.5">
                <span className="material-symbols-outlined text-4xl text-zinc-500">videocam_off</span>
                <p className="font-headline-sm text-[15px] font-bold text-zinc-200">
                  {hasExecutedUserSearch && activeQuery
                    ? `“${activeQuery}”와 일치하는 동영상이 없습니다 (0건)`
                    : '표시할 동영상이 없습니다'}
                </p>
                {videoSceneItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => resetSearchSpaceToAll('video')}
                    className="mt-1 px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-primary-container text-[12.5px] font-bold cursor-pointer"
                  >
                    전체 동영상 {videoSceneItems.length}개 다시 보기
                  </button>
                )}
              </div>
            ) : (
            <div className="flex md:grid md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-x-auto snap-x snap-mandatory no-scrollbar pb-1">
              {matchedVideoScenes.map((vid) => {
                const cardThumbUrl = resolveVideoCardThumbUrl(vid);
                const isWholeClip = (vid.matchedSeekSec ?? 0) <= 0;
                const cleanTs = cleanVideoTimestampLabel(vid.matchedTimestamp);
                return (
                <article
                  key={vid.id}
                  onClick={() => setSelectedVideoModal(vid, vid.matchedSeekSec)}
                  className="min-w-[85%] sm:min-w-[340px] md:min-w-0 snap-center group rounded-2xl overflow-hidden bg-[#18181B] hover:bg-zinc-900 border border-white/10 hover:border-white/25 flex flex-col cursor-pointer transition-all"
                >
                  <div className="relative aspect-video w-full overflow-hidden bg-black">
                    {cardThumbUrl ? (
                      <img
                        src={cardThumbUrl}
                        alt={vid.title}
                        loading="lazy"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = 'none';
                        }}
                        className="w-full h-full object-cover pointer-events-none group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-900 to-zinc-950 text-zinc-400 gap-1.5 p-4 text-center">
                        <span className="material-symbols-outlined text-3xl text-primary-container/80">movie</span>
                        <span className="text-[11.5px] font-medium text-zinc-300 truncate max-w-[85%]">{vid.title}</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                      <div className="w-11 h-11 rounded-full bg-black/75 border border-white/20 text-white flex items-center justify-center group-hover:bg-primary-container group-hover:text-zinc-950 group-hover:border-primary-container transition-all">
                        <span className="material-symbols-outlined text-[26px]">play_arrow</span>
                      </div>
                    </div>
                    {hasExecutedUserSearch && activeQuery && (
                      <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-md bg-zinc-950/90 backdrop-blur-md border border-primary-container/50 text-primary-container font-label-mono text-[11px] font-bold">
                        {isWholeClip ? '🎯 전 구간 일치 (00:00~)' : `🎯 ${cleanTs} 장면 포착`}
                      </div>
                    )}
                    <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-md bg-zinc-950/90 backdrop-blur-md border border-white/15 text-white font-label-mono text-[11px] font-extrabold shadow-md">
                      ⏱️ {vid.durationText}
                    </div>
                    {vid.hasScreenOcrText && (
                      <div className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-md bg-teal-500/90 text-zinc-950 font-label-mono text-[10.5px] font-black shadow">
                        📝 화면 글자 {vid.ocrLineCount || ''}구간 감지
                      </div>
                    )}
                  </div>
                  <div className="p-4 flex flex-col gap-2.5 flex-1 justify-between">
                    <h3 className="font-headline-sm text-[15px] text-white font-bold group-hover:text-primary-container transition-colors">
                      {renderHighlightedDocText(vid.title, hasExecutedUserSearch ? activeQuery : '')}
                    </h3>
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10 font-label-mono text-[11px] text-zinc-400">
                      <span>{vid.date}</span>
                      <div className="flex items-center gap-2">
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
                          className="px-2.5 py-1 rounded-lg bg-teal-500/20 hover:bg-teal-400 text-teal-200 hover:text-zinc-950 border border-teal-400/50 font-label-sm text-[11px] font-black transition cursor-pointer"
                        >
                          📝 글자 뽑기
                        </button>
                        <span className="text-primary-container font-bold">
                          {hasExecutedUserSearch && activeQuery
                            ? isWholeClip
                              ? '▶ 처음부터 재생'
                              : `▶ ${cleanTs} 재생`
                            : '▶ 재생'}
                        </span>
                      </div>
                    </div>
                  </div>
                </article>
                );
              })}
            </div>
            )}
          </section>
        ) : searchSpace === 'vault' ? (
          <section className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-headline-sm text-[17px] md:text-[18px] text-white font-bold">
                  {hasExecutedUserSearch && activeQuery
                    ? `“${activeQuery}” 문서 검색 결과`
                    : '전체 문서·서류 목록'}
                </h2>
                <span className="px-2.5 py-0.5 rounded-md bg-zinc-900 border border-white/10 text-zinc-300 font-label-sm text-[12px] font-medium">
                  총 {matchedTotalDocsCount}건
                </span>
              </div>

              <button
                onClick={() => void openLocalFolder('docs')}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-label-sm text-[12px] font-medium border border-white/10 flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">folder_open</span>
                <span>내 PC 문서 폴더 열기</span>
              </button>
            </div>

            {matchedLocalDocs.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pb-1">
                {matchedLocalDocs.map((doc) => (
                  <article
                    key={doc.id}
                    onClick={() => setSelectedDocModal(doc)}
                    className="group p-4 rounded-2xl bg-[#18181B] hover:bg-zinc-900 border border-white/10 hover:border-white/25 flex flex-col justify-between gap-3 cursor-pointer transition-all"
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded bg-zinc-800 border border-white/10 text-amber-400 font-label-mono text-[10px] font-bold">
                            {doc.ext}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 font-label-sm text-[11px] font-medium">
                            {doc.categoryBadge}
                          </span>
                        </div>
                        <span className="font-label-mono text-[10px] text-zinc-500">
                          {doc.deviceSource}
                        </span>
                      </div>

                      <h4 className="font-headline-sm text-[15px] text-white font-bold group-hover:text-primary-container transition-colors">
                        {renderHighlightedDocText(doc.title, hasExecutedUserSearch ? activeQuery : '')}
                      </h4>

                      <p className="font-body-sm text-[12px] text-zinc-400 line-clamp-2 leading-relaxed bg-zinc-950/80 p-2.5 rounded-xl border border-white/5">
                        {renderHighlightedDocText(
                          doc.extractedText,
                          hasExecutedUserSearch ? activeQuery : ''
                        )}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/10 font-label-mono text-[11px] text-zinc-400 gap-2">
                      <span>{doc.date}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void navigator.clipboard?.writeText(doc.extractedText);
                            useSaySeeStore.setState({
                              lastQuarantineToast: `📋 복사 완료! [${doc.title}] 본문 정보가 즉시 복사되었습니다.`,
                            });
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400/50 text-emerald-300 font-label-sm text-[11.5px] font-extrabold transition-colors cursor-pointer"
                        >
                          📋 복사
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void executeRealOsAction('open_file_search', doc.path || doc.fileName).then((res) => {
                              useSaySeeStore.setState({
                                lastQuarantineToast: res.summaryKo || `📂 탐색기에서 [${doc.fileName}] 파일을 바로 띄웠습니다.`,
                              });
                            });
                          }}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/50 text-amber-300 font-label-sm text-[11.5px] font-extrabold transition-colors cursor-pointer"
                        >
                          🔍 파일 열기
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : (
          /* [🖼️ 전체 갤러리] 모드 — [❐ 동일 연사 묶어보기 ON] 스위치 버튼 완전 제거 & 깔끔한 카운트만 표시 */
          <section className="flex flex-col gap-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-headline-sm text-[17px] md:text-[18px] text-white font-bold">
                  {hasExecutedUserSearch && activeQuery
                    ? `“${activeQuery}” 검색 결과`
                    : '전체 사진 목록'}
                </h2>
                <span className="px-2.5 py-0.5 rounded-md bg-zinc-900 border border-white/10 text-zinc-300 font-label-sm text-[12px] font-medium">
                  총 {hasExecutedUserSearch ? searchResults.length : gallerySceneCount}장
                </span>
              </div>
            </div>

            {groupedResults.length > 0 ? (
              <div
                className={
                  groupedResults.length <= 16
                    ? 'grid grid-cols-2 sm:grid-cols-4 gap-3.5'
                    : 'grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5'
                }
              >
                {groupedResults.map((group) => {
                  const item = group.representative;
                  const isBurst = group.burstCount >= 2;
                  return (
                    <article
                      key={item.photo.id}
                      onClick={() =>
                        // [레드팀 보완] 연사 묶음(❐ N장 연사) 클릭 시 상세 모달에 group.burstPhotos를 그대로 넘겨 모달 내에서 나란히 펼쳐 골라볼 수 있도록 보장
                        setSelectedPhoto(item.photo, isBurst ? group.burstPhotos : null)
                      }
                      className="group relative rounded-2xl overflow-hidden bg-[#18181B] border border-white/10 hover:border-white/25 transition-all cursor-pointer flex flex-col"
                    >
                      <div
                        className={`relative ${
                          groupedResults.length <= 16 ? 'aspect-[4/3]' : 'aspect-[4/5]'
                        } w-full overflow-hidden bg-zinc-950`}
                      >
                        <img
                          src={item.photo.thumbUrl}
                          alt={item.photo.name}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />

                        {isBurst && (
                          <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-zinc-950/85 backdrop-blur-md border border-white/15 text-primary-container font-label-sm text-[10.5px] font-bold flex items-center gap-1">
                            <span>❐ {group.burstCount}장 연사</span>
                          </div>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleBookmark(item.photo.id);
                          }}
                          aria-label="즐겨찾기"
                          className={`absolute top-2.5 right-2.5 w-7.5 h-7.5 rounded-full backdrop-blur-md flex items-center justify-center transition-all cursor-pointer ${
                            item.photo.bookmarked
                              ? 'bg-red-600/95 text-white ring-2 ring-white/80 shadow-md scale-105'
                              : 'bg-black/60 text-white/85 hover:text-red-400 hover:bg-black/80'
                          }`}
                        >
                          <span
                            className="material-symbols-outlined text-[16px]"
                            style={
                              item.photo.bookmarked
                                ? { fontVariationSettings: "'FILL' 1, 'wght' 600" }
                                : undefined
                            }
                          >
                            favorite
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOcrModalPhoto(item.photo);
                          }}
                          title="귀신검색창에서 이 사진의 별도 독립 사진·OCR 창(창 UI ③)을 열어 글자·표를 추출합니다"
                          className="absolute bottom-10 right-2.5 z-10 px-2.5 py-1 rounded-lg bg-zinc-950/90 hover:bg-teal-400 text-teal-200 hover:text-zinc-950 border border-teal-400/60 font-label-sm text-[11px] font-black shadow-md transition-all cursor-pointer"
                        >
                          📝 OCR
                        </button>

                        <div className="absolute inset-x-0 bottom-0 h-[22%] min-h-[44px] px-3 pb-2.5 pt-4 bg-gradient-to-t from-black/90 via-black/55 to-transparent flex items-end justify-between gap-2 pointer-events-none">
                          <span className="font-label-sm text-[11.5px] font-semibold text-white whitespace-nowrap shrink-0">
                            {item.photo.date.split(' ')[0]}
                          </span>
                          {item.photo.tags[0] && (
                            <span className="font-label-sm text-[11.5px] font-bold text-primary-container truncate">
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
              <div className="py-14 rounded-2xl bg-[#18181B] border border-white/10 text-center flex flex-col items-center gap-2">
                <span className="material-symbols-outlined text-zinc-500 text-[36px]">
                  image_search
                </span>
                <p className="font-headline-sm text-[15px] text-zinc-300 font-semibold">
                  일치하는 사진을 찾지 못했습니다. 다른 문장이나 단어로 검색해 보세요.
                </p>
              </div>
            )}
          </section>
        )}
      </div>

      {/* [메뉴 2 · 👻 귀신검색창 하단 고정 소속 설명란] 유료 티어(🔒) 및 부가 기능 안내 */}
      <section
        aria-label="귀신검색 유료 티어 및 부가 기능 안내"
        className="mt-2 p-4 sm:p-5 rounded-2xl bg-[#14161B] border border-white/10 flex flex-col gap-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[13.5px] font-extrabold text-teal-300">
            🔒 귀신검색 유료 티어 및 부가 기능 안내 (명시적 동의 시 30일 무제한 무료체험 · 만료 시 일 3회 무료 없이 깔끔 잠금🔒)
          </span>
          <span className="text-[11.5px] text-zinc-400 font-semibold">
            내 PC 문서·사진·영상 검색 &amp; 동영상 [📝 글자 뽑기]는 평생 무제한 무료
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[12px] text-zinc-200">
          <div className="p-3 rounded-xl bg-zinc-950/80 border border-white/10 flex flex-col gap-1">
            <span className="font-extrabold text-white">① 📱 내 기기 통합 소환🔒</span>
            <span className="text-zinc-400 leading-snug">
              동일 이메일 연결 시 핸드폰 사진·타 PC 파일 통합 노출 &amp; 폰 촬영 직후 <strong className="text-teal-300">0.2초 공간이동 (촬영 후 1분간 자동팝업 대기)</strong> · 30일 만료 시 원격 노출만 OFF되며 이미 내 PC 폴더에 복사된 원본 파일은 영구 보존
            </span>
          </div>
          <div className="p-3 rounded-xl bg-zinc-950/80 border border-white/10 flex flex-col gap-1">
            <span className="font-extrabold text-white">② 📝 사진·표 OCR 창🔒 (별도 독립 창)</span>
            <span className="text-zinc-400 leading-snug">
              귀신검색창 안에는 사진 목록만 깔끔하게 보이고, 사진에서 <strong className="text-teal-300">[📝 OCR]</strong>을 누르면 별도 독립 <strong className="text-white">사진·OCR 창</strong>이 열려 글자·표를 추출
            </span>
          </div>
          <div className="p-3 rounded-xl bg-zinc-950/80 border border-white/10 flex flex-col gap-1">
            <span className="font-extrabold text-white">③ 🏷️ 귀신 라벨러🔒</span>
            <span className="text-zinc-400 leading-snug">
              암호 같은 사진·카톡·문서 파일명을 촬영일·내용 규칙(YYMMDD_내용)으로 한 번에 자동 정리
            </span>
          </div>
          <div className="p-3 rounded-xl bg-zinc-950/80 border border-white/10 flex flex-col gap-1">
            <span className="font-extrabold text-white">④ 💬 귀신 말풍선 (부가 기능)</span>
            <span className="text-zinc-400 leading-snug">
              윈도우 기본 폴더·바탕화면 파일 위에 마우스를 올리면 핵심 내용 3줄 요약 표시
            </span>
          </div>
        </div>
      </section>

      <GhostPhotoOcrTeleportModal
        photo={ocrModalPhoto}
        onClose={() => setOcrModalPhoto(null)}
      />
    </main>
  );
};

/**
 * 🧪 1단계 [✋ 손보기] 미니멀 프리뷰 컴포넌트
 * - 1) [🗑️ 휴지통] 상단 알약 버튼 & 5번째 휴지통 카드 & 하단 휴지통 드로어 전면 철거 -> 깔끔한 4열 카테고리 그리드(① 중복·연사, ② 주차·영수증, ③ 스크린샷, ④ 흔들림)만 유지
 * - 2) 상단 난립 배지([🆓 언제나 0원], [📁 서류함 분리 확인], 2중 중복 기록함 등) 철거 -> [🕰️ 손보기·복원 기록] 단 1개로 통합
 * - 3) 좌측 '💬 기기 3대 핵심 건강검진' 아코디언 박스 완전 철거
 * - 4) [레드팀 보완] 우측 [✋ 손보기 대화창] 첫 인사말 말풍선(Welcome Bubble)에 [⚡ 느려진 PC 보안모듈·속도 1초 검진] · [🗂️ 바탕화면·설치파일 임시 데이터 정리] 1클릭 실행 버튼 기본 내장
 */
export const Stage1MinimalCarePreview: React.FC = () => {
  const {
    layout,
    photos,
    duplicateGroups,
    selectedTrashIds,
    activeTrashCategoryFilter,
    setActiveTrashCategoryFilter,
    toggleTrashSelection,
    selectAllTrashInFilter,
    clearTrashSelection,
    pickBestInDuplicateGroup,
    moveSelectedToQuarantine,
    moveAllTrashToQuarantine,
    quarantineMoving,
    setSelectedPhoto,
    lastUndoBatch,
    undoLastQuarantine,
    dismissUndoBatch,
    setDesktopTab,
    setMobileTab,
    setSearchSpace,
    runTextQuery,
    isStoreAppMode,
    importMobileLocalPhotos,
    pendingReturnShareRoom,
    returnToSharedRoomAndOpenUpload,
  } = useSaySeeStore();

  const trashMobilePhotoInputRef = React.useRef<HTMLInputElement | null>(null);
  const [externalQueryTrigger] = useState<{
    id: number;
    query: string;
  } | null>(null);
  const [zConnected, setZConnected] = useState<boolean>(zCoreBridge.isConnected);
  const autoSwitchedRealTabRef = React.useRef<boolean>(false);
  const [isCleanupPaused, setIsCleanupPaused] = useState<boolean>(false);
  const [pausedSnapshot, setPausedSnapshot] = useState<{
    activeTrash: PhotoItem[];
    duplicateGroups: typeof duplicateGroups;
  } | null>(null);

  React.useEffect(() => {
    setZConnected(zCoreBridge.isConnected);
    return zCoreBridge.subscribe((c) => {
      setZConnected(c);
      if (!c) {
        autoSwitchedRealTabRef.current = false;
      }
    });
  }, []);

  const isShowroomSamplePhoto = (name: string): boolean =>
    /^(IMG_2025|PET_2025|TRV_2025|DOC_2025|MEMO_2025|Screenshot_2025|BLUR_2025)/.test(name);
  const displayPhotos = zConnected
    ? photos.filter((p) => !isShowroomSamplePhoto(p.name))
    : photos;

  const liveActiveTrash = displayPhotos.filter((p) => p.trashCategory && !p.quarantined);
  const activeTrash =
    isCleanupPaused && pausedSnapshot ? pausedSnapshot.activeTrash : liveActiveTrash;
  const quarantinedPhotos = displayPhotos.filter((p) => p.quarantined);
  const totalTrashBytes = activeTrash.reduce((a, p) => a + p.size, 0);

  const dupCount = activeTrash.filter((p) => matchesTrashTab(p, 'duplicate')).length;
  const memoCount = activeTrash.filter((p) => matchesTrashTab(p, 'memo')).length;
  const screenshotCount = activeTrash.filter((p) => matchesTrashTab(p, 'screenshot')).length;
  const blurryCount = activeTrash.filter((p) => matchesTrashTab(p, 'blurry')).length;
  const memoAndScreenCount = memoCount + screenshotCount;

  React.useEffect(() => {
    const onPauseCleanupPaneOnly = () => {
      setPausedSnapshot({
        activeTrash: liveActiveTrash,
        duplicateGroups,
      });
      setIsCleanupPaused(true);
      clearTrashSelection();
      setActiveTrashCategoryFilter('none');
    };
    window.addEventListener('ghosti_pause_cleanup_pane_only', onPauseCleanupPaneOnly);
    return () => {
      window.removeEventListener('ghosti_pause_cleanup_pane_only', onPauseCleanupPaneOnly);
    };
  }, [liveActiveTrash, duplicateGroups, clearTrashSelection, setActiveTrashCategoryFilter]);

  const currentTab =
    activeTrashCategoryFilter === 'object' ||
    activeTrashCategoryFilter === 'document' ||
    activeTrashCategoryFilter === 'receipt'
      ? 'memo'
      : activeTrashCategoryFilter;

  const realFilteredCandidates =
    currentTab === 'none' ? [] : activeTrash.filter((p) => matchesTrashTab(p, currentTab));
  const fallbackSamplesForCurrentTab: PhotoItem[] =
    currentTab === 'all'
      ? [
          ...FALLBACK_SAMPLE_TRASH_ITEMS.duplicate,
          ...FALLBACK_SAMPLE_TRASH_ITEMS.memo,
          ...FALLBACK_SAMPLE_TRASH_ITEMS.screenshot,
          ...FALLBACK_SAMPLE_TRASH_ITEMS.blurry,
        ]
      : currentTab === 'duplicate' ||
        currentTab === 'memo' ||
        currentTab === 'screenshot' ||
        currentTab === 'blurry'
      ? FALLBACK_SAMPLE_TRASH_ITEMS[currentTab]
      : [];
  const isShowingSamplePreview =
    !zConnected &&
    currentTab !== 'none' &&
    realFilteredCandidates.length === 0 &&
    fallbackSamplesForCurrentTab.length > 0;
  const filteredCandidates = isShowingSamplePreview
    ? fallbackSamplesForCurrentTab
    : realFilteredCandidates;

  const activeSelectedPhotos = realFilteredCandidates.filter((p) => selectedTrashIds.has(p.id));
  const selectedBytes = activeSelectedPhotos.reduce((a, p) => a + p.size, 0);

  const photoById = new Map(displayPhotos.map((p) => [p.id, p]));
  const sourceDuplicateGroups =
    isCleanupPaused && pausedSnapshot ? pausedSnapshot.duplicateGroups : duplicateGroups;
  const activeDuplicateGroups = sourceDuplicateGroups.filter((g) =>
    g.photoIds.some((id) => {
      const ph = photoById.get(id);
      return ph && !ph.quarantined && id !== g.bestPhotoId;
    })
  );

  // 엔진 연결 후 내 PC에 중복·연사(①)는 0장이지만 메모/캡처/흔들림(②~④) 실물 후보가 있는 경우,
  // 빈 상자 대신 내 진짜 PC 사진 썸네일이 즉시 우측 귀신비서 옆에 펼쳐지도록 1회 자동 전환
  React.useEffect(() => {
    if (
      zConnected &&
      !isCleanupPaused &&
      !autoSwitchedRealTabRef.current &&
      currentTab === 'duplicate' &&
      activeDuplicateGroups.length === 0 &&
      activeTrash.length > 0
    ) {
      autoSwitchedRealTabRef.current = true;
      setActiveTrashCategoryFilter('all');
    }
  }, [
    zConnected,
    isCleanupPaused,
    currentTab,
    activeDuplicateGroups.length,
    activeTrash.length,
    setActiveTrashCategoryFilter,
  ]);

  const showDuplicatePickSection = currentTab === 'duplicate';

  const zCoreOutdated =
    zConnected && isZCoreOutdated(zCoreBridge.version);

  return (
    <div className="w-full max-w-[1640px] mx-auto px-4 sm:px-6 md:px-8 py-6 flex flex-col gap-5 pb-24">
      {pendingReturnShareRoom && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-teal-950/90 via-emerald-950/85 to-zinc-900 border-2 border-[#2DD4BF]/70 flex flex-wrap items-center justify-between gap-3 shadow-lg">
          <div className="flex flex-col gap-0.5">
            <span className="text-[13.5px] md:text-[14.5px] font-black text-teal-200">
              📸 『{pendingReturnShareRoom.roomTitle}』에 내 사진을 추가하러 오셨군요!
            </span>
            <span className="text-[12px] text-zinc-200 font-medium">
              {zConnected
                ? '엔진 연결과 사진 색인이 준비되었습니다! 지금 바로 가족방으로 돌아가 내 컴퓨터 사진을 골라 올려보세요.'
                : '오른쪽 『👻 귀신비서』 채팅창에서 엔진 연결 & 1초 점검을 마치면, 버튼 하나로 바로 이 가족방에 모셔다드릴게요!'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void returnToSharedRoomAndOpenUpload()}
            className="px-4 py-2.5 rounded-xl bg-[#2DD4BF] hover:bg-[#5EEAD4] text-zinc-950 font-label-md text-[13px] font-black shadow-md transition cursor-pointer whitespace-nowrap"
          >
            {zConnected
              ? `📸 준비 완료! '${pendingReturnShareRoom.roomTitle}'으로 가서 내 사진 올리기 ➔`
              : `🔙 '${pendingReturnShareRoom.roomTitle}'으로 돌아가기`}
          </button>
        </div>
      )}

      {zCoreOutdated && (
        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/80 border-2 border-amber-400 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <span className="text-[14px] text-amber-900 dark:text-amber-200 font-extrabold">
            ⚠️ 실행 중인 Z-코어가 구버전(v{zCoreBridge.version || '구버전'})입니다 — 최신 버전(v{LATEST_Z_CORE_VERSION})으로 업데이트해 주세요.
          </span>
          <a
            href={Z_CORE_ZIP_URL}
            download="Merlin_Z_Core.zip"
            className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-sm text-[13px] font-extrabold whitespace-nowrap shadow cursor-pointer"
          >
            ⬇️ 최신 Z-코어 (v{LATEST_Z_CORE_VERSION}) 다운로드
          </a>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* ═══════════════ [좌측 열] 미니멀 정리 워크스페이스 (엔진 미연결 시 눈으로 구경 허용 + 클릭 시 우측 귀신비서 채팅 안내) ═══════════════ */}
        <GhostSecretaryFirstGuard
          context="secretary_left"
          className="xl:col-span-7 2xl:col-span-8 flex flex-col gap-5 min-w-0"
        >
          {/* [v1.3] 🪪 귀신계 여권 후보 — 귀신비서가 실명을 물을 때만 노출 */}
          <GhostPassportCandidatesPanel />
          {/* 1. 슬림 헤더: 현재 쾌적한 상태 요약 + [⚡ 원본 남기고 N장 일괄 정리] 버튼만 깔끔하게 유지 */}
          <section className="p-5 md:p-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-white/10">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-headline-sm text-[20px] md:text-[22px] text-zinc-900 dark:text-white font-extrabold tracking-tight flex items-center gap-2 whitespace-nowrap">
                  <span>👻 귀신비서</span>
                </h1>
                {/* [v1.3 마감 공문 2321 #2] 전사 대표 슬로건 — 제목 바로 아래 1줄 부제로 상시 노출 */}
                <p className="basis-full -mt-1.5 text-[12.5px] md:text-[13px] font-semibold text-zinc-500 dark:text-zinc-400 leading-snug">
                  컴퓨터 손보기부터 귀신계 여권까지 『귀신비서』가 다 챙겨주고, 잃어버린 파일은 『귀신검색』이 찾아주고, 타이핑 노가다는 『귀신창 초능력』이 대신해 준다!
                </p>

                <input
                  ref={trashMobilePhotoInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      void importMobileLocalPhotos(e.target.files);
                      e.target.value = '';
                    }
                  }}
                />
                {(isStoreAppMode || layout === 'mobile') && (
                  <button
                    type="button"
                    onClick={() => trashMobilePhotoInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-label-sm text-[11.5px] font-extrabold transition-colors cursor-pointer whitespace-nowrap"
                  >
                    📱 내 폰 사진 불러와 정리하기
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {liveActiveTrash.length > 0 &&
                  (isCleanupPaused ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCleanupPaused(false);
                        setPausedSnapshot(null);
                        setActiveTrashCategoryFilter(
                          duplicateGroups.length > 0 ? 'duplicate' : 'all'
                        );
                      }}
                      className="px-3.5 py-2.5 rounded-xl bg-teal-950/80 hover:bg-teal-900/80 border border-teal-400/40 text-teal-200 font-label-sm text-[12px] font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap"
                    >
                      <span>▶️ 남은 사진 정리 다시 펼치기 ({liveActiveTrash.length}장)</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setPausedSnapshot({
                          activeTrash: liveActiveTrash,
                          duplicateGroups,
                        });
                        setIsCleanupPaused(true);
                        clearTrashSelection();
                        setActiveTrashCategoryFilter('none');
                        window.dispatchEvent(
                          new CustomEvent('ghosti_defer_photo_cleanup_and_continue')
                        );
                      }}
                      className="px-3.5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-white/15 text-zinc-200 font-label-sm text-[12px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap"
                    >
                      <span>⏭️ 남은 사진 정리는 다음에</span>
                    </button>
                  ))}
                <button
                  type="button"
                  disabled={activeTrash.length === 0 || quarantineMoving || isCleanupPaused}
                  onClick={() => void moveAllTrashToQuarantine()}
                  className="px-4 py-2.5 rounded-xl bg-primary-container hover:opacity-95 text-zinc-950 font-label-md text-[12.5px] font-extrabold flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer whitespace-nowrap shadow-sm"
                >
                  <span>⚡ 원본 남기고 {activeTrash.length}장 일괄 정리</span>
                </button>
              </div>
            </div>

            <div className="font-headline-md text-[16px] md:text-[18px] text-zinc-900 dark:text-white font-extrabold tracking-tight leading-snug">
              {activeTrash.length > 0 ? (
                <>
                  정리 후보 <span className="text-primary-container">{activeTrash.length}장</span>{' '}
                  <span className="text-zinc-500 dark:text-zinc-400 font-normal text-[14px]">
                    ({fmtMB(totalTrashBytes)})
                  </span>{' '}
                  — 중복·연사 <span className="text-zinc-900 dark:text-white">{dupCount}장</span> · 메모·캡처{' '}
                  <span className="text-zinc-900 dark:text-white">{memoAndScreenCount}장</span> · 흔들림{' '}
                  <span className="text-zinc-900 dark:text-white">{blurryCount}장</span>
                </>
              ) : (
                <span className="text-primary-container">
                  ✨ 현재 가장 쾌적한 상태입니다 (정리 완료 {quarantinedPhotos.length}장)
                </span>
              )}
            </div>

            {/* 인라인 1초 되돌리기(Undo) 알림 콜아웃 */}
            {lastUndoBatch && (
              <div className="p-3.5 rounded-xl bg-zinc-900 border border-primary-container/60 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-primary-container text-[20px]">
                    history
                  </span>
                  <span className="font-label-md text-[13px] text-zinc-100 font-semibold">
                    {`방금 정리한 ${lastUndoBatch.count}장 (${fmtMB(lastUndoBatch.savedBytes)})이 안전하게 정리되었습니다.`}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void undoLastQuarantine()}
                    className="px-3.5 py-1.5 rounded-lg bg-primary-container text-zinc-950 font-label-sm text-[12px] font-extrabold transition-all cursor-pointer"
                  >
                    ↩️ 1초 즉시 되돌리기 (Undo)
                  </button>
                  <button
                    type="button"
                    onClick={dismissUndoBatch}
                    className="p-1 text-zinc-400 hover:text-white cursor-pointer"
                    title="닫기"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* 2. 깔끔한 4열 정리 카테고리 카드 (글자 잘림 0% + 미니 샘플 썸네일 프리뷰 내장) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {TRASH_TABS_4.map((tab) => {
              const items = activeTrash.filter((p) => matchesTrashTab(p, tab.key));
              const bytes = items.reduce((a, p) => a + p.size, 0);
              const isSelected = currentTab === tab.key;
              const sampleThumbs =
                items.length > 0
                  ? items.slice(0, 2)
                  : !zConnected
                  ? FALLBACK_SAMPLE_TRASH_ITEMS[tab.key].slice(0, 2)
                  : [];

              return (
                <button
                  key={tab.key}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    if (isCleanupPaused) {
                      setIsCleanupPaused(false);
                      setPausedSnapshot(null);
                      setActiveTrashCategoryFilter(tab.key as TrashCategory);
                      return;
                    }
                    if (currentTab === tab.key) {
                      setActiveTrashCategoryFilter('none');
                    } else {
                      setActiveTrashCategoryFilter(tab.key as TrashCategory);
                    }
                  }}
                  style={
                    isSelected
                      ? {
                          backgroundColor: 'rgba(13, 148, 136, 0.14)',
                          borderColor: '#0D9488',
                          boxShadow: '0 0 0 2px #0D9488',
                        }
                      : undefined
                  }
                  className={`group text-left cursor-pointer rounded-2xl p-3.5 transition-all flex flex-col justify-between gap-2.5 border-2 ${
                    isSelected
                      ? 'bg-teal-500/15 border-[#0D9488] shadow-md ring-2 ring-[#0D9488]/40'
                      : 'bg-[#18181B] hover:bg-zinc-900/70 border-white/10'
                  }`}
                >
                  <div className="flex flex-col gap-1.5 w-full">
                    <div className="flex items-center justify-between gap-1.5 w-full">
                      <div className="flex items-center gap-1 whitespace-nowrap">
                        <span className="font-headline-sm text-[13px] text-primary-container font-extrabold shrink-0">
                          {tab.stepNum}
                        </span>
                        <span className="font-headline-sm text-[13.5px] xl:text-[14px] text-white font-extrabold tracking-tight">
                          {tab.shortTitle}
                        </span>
                      </div>
                      {isSelected ? (
                        <span
                          style={{ backgroundColor: '#0D9488', color: '#FFFFFF' }}
                          className="px-2 py-0.5 rounded-full text-[10px] font-extrabold whitespace-nowrap shadow-xs shrink-0"
                        >
                          ✓ 선택됨 · 접기 ▲
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded-full bg-zinc-800/80 border border-white/10 text-zinc-400 text-[10px] font-bold whitespace-nowrap shrink-0">
                          펼치기 ▼
                        </span>
                      )}
                    </div>
                    <span className="font-body-sm text-[11px] text-zinc-400 leading-snug">
                      {tab.subtitle}
                    </span>
                  </div>

                  {/* 카드 내 미니 썸네일 프리뷰 (실제 0장일 때도 어떤 기능인지 한눈에 보이도록 샘플 제공) */}
                  <div className="flex items-center gap-1.5 pt-0.5">
                    {sampleThumbs.map((sp) => (
                      <div
                        key={sp.id}
                        className="w-9 h-9 rounded-lg overflow-hidden border border-white/15 bg-zinc-950 shrink-0"
                      >
                        <img
                          src={sp.thumbUrl}
                          alt=""
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                    {items.length === 0 && !zConnected && (
                      <span className="px-1.5 py-0.5 rounded bg-zinc-800/90 border border-white/10 text-[10px] text-zinc-300 font-bold whitespace-nowrap">
                        예시 샘플
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-1 pt-2 border-t border-white/10 w-full whitespace-nowrap">
                    <div className="flex items-baseline gap-1 whitespace-nowrap">
                      <span className="font-headline-md text-[16px] text-white font-extrabold">
                        {items.length}
                      </span>
                      <span className="font-label-sm text-[11px] text-zinc-400">장</span>
                      {tab.key === 'duplicate' && activeDuplicateGroups.length > 0 && (
                        <span className="text-[10.5px] text-primary-container font-bold">
                          · {activeDuplicateGroups.length}묶음
                        </span>
                      )}
                    </div>

                    <span className="font-label-mono text-[10.5px] text-zinc-400 font-semibold whitespace-nowrap">
                      {fmtMB(bytes)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* 3-0. 탭을 다시 눌러 접었을 때 또는 [남은 사진 정리는 다음에]로 화면을 멈췄을 때(currentTab === 'none') 노출되는 깔끔한 안내 바 */}
          {currentTab === 'none' && (
            <div className="p-4 md:p-5 rounded-2xl bg-[#18181B] border border-white/10 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="text-[18px]">{isCleanupPaused ? '⏸️' : '📂'}</span>
                <span className="font-body-sm text-[13.5px] text-zinc-300 font-bold">
                  {isCleanupPaused
                    ? '남은 사진 정리 화면을 잠시 멈춰 두었어요 — 오른쪽 『👻 귀신비서』의 다음 안내를 이어서 진행하시거나, 원하실 때 위 탭(①~④)을 눌러 다시 펼치실 수 있어요.'
                    : '현재 사진 분류 목록이 접혀 있습니다. 위 4개 탭(①~④)을 누르면 해당 분류 사진이 펼쳐집니다.'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCleanupPaused(false);
                    setPausedSnapshot(null);
                    setActiveTrashCategoryFilter('duplicate');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-200 font-label-sm text-[12px] font-bold cursor-pointer"
                >
                  📸 중복·연사만 보기 ({activeDuplicateGroups.length}묶음) ▼
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCleanupPaused(false);
                    setPausedSnapshot(null);
                    setActiveTrashCategoryFilter('all');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-primary-container text-zinc-950 font-label-sm text-[12px] font-extrabold cursor-pointer"
                >
                  📋 전체 후보 보기 ({liveActiveTrash.length}장) ▼
                </button>
              </div>
            </div>
          )}

          {/* 3-A. ① 중복 사진 & 연사 묶음 선택 (currentTab === 'duplicate'일 때만 순수하게 표시하여 타 탭 사진 혼입 차단) */}
          {showDuplicatePickSection && (
            <div className="p-5 md:p-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-3.5">
                <div className="flex flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-headline-sm text-[17px] md:text-[18.5px] text-white font-extrabold">
                      ① 중복 사진 &amp; 연사 묶음 선택
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-md bg-zinc-900 border border-white/10 text-primary-container font-label-sm text-[12.5px] font-bold">
                      {activeDuplicateGroups.length}개 묶음 · 정리 대상 {dupCount}장
                    </span>
                  </div>
                  <p className="font-body-sm text-[13px] text-zinc-400">
                    남길 사진 1장을 누른 뒤 우측 [정리] 버튼을 눌러주세요.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTrashCategoryFilter('duplicate')}
                    style={{
                      backgroundColor: '#0D9488',
                      color: '#FFFFFF',
                      borderColor: '#0D9488',
                    }}
                    className="px-3 py-1.5 rounded-xl font-label-sm text-[11.5px] font-extrabold border transition-all cursor-pointer shadow-xs"
                  >
                    ✓ 중복·연사만 보기 ({activeDuplicateGroups.length}묶음)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTrashCategoryFilter('all')}
                    className="px-3 py-1.5 rounded-xl font-label-sm text-[11.5px] font-bold border bg-zinc-900 text-zinc-300 hover:text-white border-white/10 transition-all cursor-pointer"
                  >
                    전체 후보 보기 ({activeTrash.length}장)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTrashCategoryFilter('none')}
                    className="px-3 py-1.5 rounded-xl font-label-sm text-[11.5px] font-bold border bg-zinc-900 text-zinc-400 hover:text-white border-white/10 transition-all cursor-pointer"
                  >
                    목록 접기 ▲
                  </button>
                </div>
              </div>

              {activeDuplicateGroups.length > 0 ? (
                <div className="flex flex-col gap-4">
                  {activeDuplicateGroups.map((group, gIdx) => {
                    const groupPhotos = group.photoIds
                      .map((id) => photoById.get(id))
                      .filter((p): p is NonNullable<typeof p> => Boolean(p && !p.quarantined));

                    const redundantCount = groupPhotos.filter((p) => p.id !== group.bestPhotoId).length;
                    const repPhoto = groupPhotos[0];
                    const sceneLabel =
                      repPhoto?.tags.find((t) => !t.includes('연사') && !t.includes('원본')) || '#연사묶음';
                    const isExactDuplicateGroup = gIdx === 0;

                    return (
                      <div
                        key={group.groupId}
                        className="p-4 rounded-xl bg-zinc-950/70 border border-white/10 flex flex-col gap-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-primary-container/15 text-primary-container font-label-sm text-[11px] font-extrabold">
                              {isExactDuplicateGroup ? '📑 동일 내용 중복' : '📸 연사 묶음 (1장 선택)'}
                            </span>
                            <span className="font-headline-sm text-[14.5px] text-white font-bold">
                              묶음 #{gIdx + 1} ({groupPhotos.length}장)
                            </span>
                            <span className="px-2 py-0.5 rounded bg-zinc-900 border border-white/10 text-zinc-300 font-label-sm text-[11px] font-medium">
                              {sceneLabel}
                            </span>
                          </div>

                          <button
                            disabled={quarantineMoving}
                            onClick={() =>
                              void pickBestInDuplicateGroup(group.groupId, group.bestPhotoId, true)
                            }
                            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-primary-container text-zinc-100 hover:text-zinc-950 border border-white/10 font-label-sm text-[11.5px] font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[15px]">check_circle</span>
                            <span>
                              {isExactDuplicateGroup
                                ? `최고화질 원본 남기고 사본 ${redundantCount}장 정리`
                                : `선택한 1장 남기고 나머지 ${redundantCount}장 정리`}
                            </span>
                          </button>
                        </div>

                        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                          {groupPhotos.map((ph, idx) => {
                            const isBestOriginal = ph.id === group.bestPhotoId;
                            return (
                              <div
                                key={ph.id}
                                onClick={() =>
                                  void pickBestInDuplicateGroup(group.groupId, ph.id, false)
                                }
                                className={`group/card relative aspect-[4/5] rounded-xl overflow-hidden cursor-pointer transition-all ${
                                  isBestOriginal
                                    ? 'ring-2 ring-primary-container border border-primary-container'
                                    : 'border border-white/10 opacity-90 hover:opacity-100 hover:border-white/30'
                                }`}
                              >
                                <img
                                  src={ph.thumbUrl}
                                  alt=""
                                  loading="lazy"
                                  className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-300"
                                />

                                {isBestOriginal ? (
                                  <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-md bg-zinc-950/90 backdrop-blur-md border border-primary-container text-primary-container font-label-sm text-[11px] font-bold flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[14px]">
                                      verified_user
                                    </span>
                                    <span>👑 보존할 1장</span>
                                  </div>
                                ) : (
                                  <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-md bg-zinc-950/80 backdrop-blur-md border border-white/15 text-zinc-300 font-label-sm text-[11px] font-medium">
                                    {`#${idx + 1} · 클릭 시 이 사진 보존`}
                                  </div>
                                )}

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedPhoto(ph, groupPhotos);
                                  }}
                                  title="크게 비교 보기"
                                  className="absolute bottom-2.5 right-2.5 w-7 h-7 rounded-full bg-black/75 hover:bg-primary-container text-white hover:text-zinc-950 flex items-center justify-center transition-colors z-10 cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[16px]">zoom_in</span>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 rounded-xl bg-zinc-950/60 border border-white/5 text-center flex flex-col items-center gap-2">
                  <span className="material-symbols-outlined text-primary-container text-[30px]">
                    verified
                  </span>
                  <span className="font-headline-sm text-[15px] text-white font-bold">
                    중복·연사 사진 정리가 모두 완료되었습니다!
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 3-B. 탭 ②·③·④ 및 [전체 후보 보기] 개별 선택 그리드 (실제 감지 0장일 때도 예시 샘플 사진 표시) */}
          {currentTab !== 'duplicate' && currentTab !== 'none' && (
            <section className="p-5 md:p-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-headline-sm text-[16.5px] text-white font-bold">
                    {TRASH_TABS_4.find((t) => t.key === currentTab)?.title ||
                      '📋 전체 정리 후보 사진 (① 중복·연사 + ② 메모·영수증 + ③ 캡처 + ④ 흔들림)'}
                  </h2>
                  <span className="px-2 py-0.5 rounded-md bg-zinc-900 border border-white/10 text-zinc-300 font-label-sm text-[11.5px] font-bold">
                    {isShowingSamplePreview
                      ? `예시 샘플 ${filteredCandidates.length}장 (내 기기 감지 0장)`
                      : `${filteredCandidates.length}장`}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTrashCategoryFilter('duplicate')}
                    className="px-3 py-1.5 rounded-xl font-label-sm text-[11.5px] font-bold border bg-zinc-900 text-zinc-300 hover:text-white border-white/10 transition-all cursor-pointer"
                  >
                    중복·연사만 보기 ({activeDuplicateGroups.length}묶음)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTrashCategoryFilter('all')}
                    style={
                      currentTab === 'all'
                        ? {
                            backgroundColor: '#0D9488',
                            color: '#FFFFFF',
                            borderColor: '#0D9488',
                          }
                        : undefined
                    }
                    className={`px-3 py-1.5 rounded-xl font-label-sm text-[11.5px] font-bold border transition-all cursor-pointer ${
                      currentTab === 'all'
                        ? 'font-extrabold shadow-xs'
                        : 'bg-zinc-900 text-zinc-300 hover:text-white border-white/10'
                    }`}
                  >
                    {currentTab === 'all'
                      ? `✓ 전체 후보 보기 (${activeTrash.length}장)`
                      : `전체 후보 보기 (${activeTrash.length}장)`}
                  </button>
                  {!isShowingSamplePreview && realFilteredCandidates.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={selectAllTrashInFilter}
                        className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-200 font-label-sm text-[12px] font-medium cursor-pointer"
                      >
                        전체 선택
                      </button>
                      <button
                        type="button"
                        onClick={clearTrashSelection}
                        className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-400 font-label-sm text-[12px] cursor-pointer"
                      >
                        선택 해제
                      </button>
                      <button
                        type="button"
                        disabled={activeSelectedPhotos.length === 0 || quarantineMoving}
                        onClick={() => void moveSelectedToQuarantine()}
                        className="px-3.5 py-1.5 rounded-lg bg-primary-container text-zinc-950 font-label-sm text-[12px] font-extrabold disabled:opacity-40 cursor-pointer"
                      >
                        선택된 {activeSelectedPhotos.length}장 ({fmtMB(selectedBytes)}) 정리
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveTrashCategoryFilter('none')}
                    className="px-3 py-1.5 rounded-xl font-label-sm text-[11.5px] font-bold border bg-zinc-900 text-zinc-400 hover:text-white border-white/10 transition-all cursor-pointer"
                  >
                    목록 접기 ▲
                  </button>
                </div>
              </div>

              {filteredCandidates.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
                  {filteredCandidates.map((photo) => {
                    const isChecked = selectedTrashIds.has(photo.id);
                    const tabMeta =
                      TRASH_TABS_4.find((t) => matchesTrashTab(photo, t.key)) || TRASH_TABS_4[1];

                    return (
                      <div
                        key={photo.id}
                        onClick={() => setSelectedPhoto(photo, filteredCandidates)}
                        className={`group relative rounded-xl overflow-hidden bg-zinc-950 transition-all cursor-pointer border ${
                          isChecked
                            ? 'border-primary-container ring-1 ring-primary-container'
                            : 'border-white/10 opacity-90 hover:opacity-100'
                        }`}
                      >
                        <div className="relative aspect-[4/5] w-full overflow-hidden bg-zinc-950">
                          <img
                            src={photo.thumbUrl}
                            alt=""
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />

                          <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-zinc-950/85 backdrop-blur-md border border-white/15">
                            <span className="font-label-sm text-[10.5px] font-semibold text-zinc-200">
                              {isShowingSamplePreview
                                ? `${tabMeta.shortBadge} (예시 샘플)`
                                : tabMeta.shortBadge}
                            </span>
                          </div>

                          {!isShowingSamplePreview && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleTrashSelection(photo.id);
                              }}
                              title={isChecked ? '선택 해제' : '정리 대상 선택'}
                              className={`absolute top-2 right-2 w-7 h-7 rounded-md flex items-center justify-center transition-colors z-10 cursor-pointer ${
                                isChecked
                                  ? 'bg-primary-container text-zinc-950 font-bold shadow-sm'
                                  : 'bg-black/65 hover:bg-black/85 border border-white/25 text-white/40 hover:text-white'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[16px]">check</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPhoto(photo, filteredCandidates);
                            }}
                            title="상세 크게 보기"
                            className="absolute bottom-2.5 right-2.5 w-7 h-7 rounded-full bg-black/75 hover:bg-primary-container text-white hover:text-zinc-950 flex items-center justify-center transition-colors z-10 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[15px]">zoom_in</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 rounded-xl bg-zinc-950/60 border border-white/5 text-center flex flex-col items-center gap-2">
                  <span className="material-symbols-outlined text-primary-container text-[30px]">
                    verified
                  </span>
                  <span className="font-headline-sm text-[15px] text-white font-bold">
                    현재 이 카테고리에 정리할 사진이 없습니다 (0장)
                  </span>
                </div>
              )}
            </section>
          )}

          {/* [메뉴 1 · 👻 귀신비서 하단 고정 소속 설명란] 비서의 상시 케어 능력 3종 (평생 무료) */}
          <section
            aria-label="귀신비서 상시 케어 능력 안내"
            className="p-4 sm:p-5 rounded-2xl bg-emerald-50 border border-emerald-200 shadow-sm flex flex-col gap-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[13.5px] font-extrabold text-emerald-900">
                🛡️ 기타 · 귀신비서의 상시 케어 능력 3종 (언제나 평생 무료)
              </span>
              <span className="text-[11.5px] text-emerald-800 font-semibold">
                우측 귀신비서 채팅창에서 언제든 말로 점검·복구 가능
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-[12px] text-slate-900">
              <div className="p-3 rounded-xl bg-white border border-emerald-200/80 shadow-xs flex flex-col gap-1">
                <span className="font-extrabold text-slate-900">① ⚡ 은행·관공서 보안프로그램 자동 절전·기상</span>
                <span className="text-slate-700 leading-snug">
                  평소엔 메모리를 먹는 보안모듈을 재워 컴퓨터를 가볍게 하고, 은행 접속 시에만 자동 기상 (고클린 대체)
                </span>
              </div>
              <div className="p-3 rounded-xl bg-white border border-emerald-200/80 shadow-xs flex flex-col gap-1">
                <span className="font-extrabold text-slate-900">② 🛡️ 다운로드 파일 무소음 백신 경호</span>
                <span className="text-slate-700 leading-snug">
                  광고 팝업 없이 새로 받은 설치파일·압축파일을 Windows Defender 직결로 조용히 즉시 검사 (알약 대체)
                </span>
              </div>
              <div className="p-3 rounded-xl bg-white border border-emerald-200/80 shadow-xs flex flex-col gap-1">
                <span className="font-extrabold text-slate-900">③ 🛟 미저장 종료 문서 &amp; 휴지통 3초 구출</span>
                <span className="text-slate-700 leading-snug">
                  실수로 저장 안 하고 끈 엑셀·한글 임시본 추적 및 잘못 지운 휴지통 파일 3초 원복
                </span>
              </div>
            </div>
          </section>
        </GhostSecretaryFirstGuard>

        {/* ═══════════════ [우측 열] 손보기 대화창 (첫 인사말 말풍선에 PC 1클릭 검진 액션 내장) ═══════════════ */}
        <div className="xl:col-span-5 2xl:col-span-4 xl:sticky xl:top-20">
          <MonsterStandardChatColumn
            sourceTab="trash"
            externalQueryTrigger={externalQueryTrigger}
            showWelcomeQuickCareActions={true}
            onHealthRecordAdded={() => {}}
            onJumpToSearch={(kw) => {
              if (layout === 'mobile') {
                setMobileTab('search');
                void runTextQuery(kw);
                return;
              }
              // [v1.3] 웹 검색창 폐지 이후: 귀신비서가 찾아준 검색어는 『👻 귀신검색』 화면의 귀신검색창(기존 찾기 화면)으로 결과를 띄움
              try {
                sessionStorage.setItem('ghosti_pending_ghost_search_query', kw);
              } catch {
                /* ignore */
              }
              setDesktopTab('dashboard');
              void runTextQuery(kw);
            }}
            onToast={(msg) => useSaySeeStore.setState({ lastQuarantineToast: msg })}
          />
        </div>
      </div>
    </div>
  );
};
