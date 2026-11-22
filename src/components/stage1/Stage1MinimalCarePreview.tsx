import React, { useEffect, useMemo, useState } from 'react';
import { useSaySeeStore } from '../../store/useSaySeeStore';
import type { PhotoItem, TrashCategory } from '../../types/saysee';
import { executeRealOsAction } from '../../services/setupMonsterEngine';
import {
  getZCoreUrl,
  requestConnectMyComputer,
  zCoreBridge,
  isZCoreOutdated,
  LATEST_Z_CORE_VERSION,
  Z_CORE_ZIP_URL,
} from '../../services/zCoreBridge';
import {
  isCapacitorIosRuntime,
  isCapacitorNativeMobileRuntime,
  openNativeAppPermissionSettings,
} from '../../services/ghostiMobileCareBridge';
import { MonsterStandardChatColumn } from '../MonsterStandardChatColumn';
import { PassportRegistrationPanel } from '../PassportRegistrationPanel';
import { GhostSecretaryFirstGuard } from '../GhostSecretaryFirstGuard';

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
  duplicate: [],
  memo: [],
  screenshot: [],
  blurry: [],
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
    restoreFromQuarantine,
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
    mobileGalleryScanning,
    mobileGalleryPermissionDenied,
    mobileGalleryLimitedAccess,
    syncMobileNativeGalleryAuto,
    pendingReturnShareRoom,
    returnToSharedRoomAndOpenUpload,
  } = useSaySeeStore();

  const [externalQueryTrigger] = useState<{
    id: number;
    query: string;
  } | null>(null);
  const [zConnected, setZConnected] = useState<boolean>(zCoreBridge.isConnected);
  const [zVersion, setZVersion] = useState<string | null>(zCoreBridge.version);
  const [isCleanupPaused, setIsCleanupPaused] = useState<boolean>(false);
  const [showQuarantineDrawer, setShowQuarantineDrawer] = useState<boolean>(false);
  const [activeDupSetIdx, setActiveDupSetIdx] = useState<number>(0);
  const [showAllDupSets, setShowAllDupSets] = useState<boolean>(false);
  const [skippedGroupIds, setSkippedGroupIds] = useState<Set<string>>(() => new Set());
  const [pausedSnapshot, setPausedSnapshot] = useState<{
    activeTrash: PhotoItem[];
    duplicateGroups: typeof duplicateGroups;
  } | null>(null);

  React.useEffect(() => {
    setZConnected(zCoreBridge.isConnected);
    setZVersion(zCoreBridge.version);
    return zCoreBridge.subscribe((c) => {
      setZConnected(c);
      setZVersion(zCoreBridge.version);
    });
  }, []);

  React.useEffect(() => {
    const onTriggerMobilePicker = () => {
      void useSaySeeStore.getState().syncMobileNativeGalleryAuto({ promptPermission: true });
    };
    const onOpenMobileQuarantine = () => {
      setShowQuarantineDrawer(true);
      window.setTimeout(() => {
        document
          .getElementById('ghosti-quarantine-restore-section')
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 80);
    };
    window.addEventListener('ghosti_trigger_mobile_photo_picker', onTriggerMobilePicker);
    window.addEventListener('ghosti_open_mobile_quarantine_drawer', onOpenMobileQuarantine);
    return () => {
      window.removeEventListener('ghosti_trigger_mobile_photo_picker', onTriggerMobilePicker);
      window.removeEventListener('ghosti_open_mobile_quarantine_drawer', onOpenMobileQuarantine);
    };
  }, []);

  const isShowroomSamplePhoto = (name: string): boolean =>
    /^(IMG_2025|PET_2025|TRV_2025|DOC_2025|MEMO_2025|Screenshot_2025|BLUR_2025)/.test(name);
  const hasAnyRealUserPhoto = photos.some((p) => !isShowroomSamplePhoto(p.name));
  const isRealDeviceMode =
    zConnected || Boolean(isStoreAppMode) || layout === 'mobile' || hasAnyRealUserPhoto;
  const displayPhotos = isRealDeviceMode
    ? photos.filter((p) => !isShowroomSamplePhoto(p.name))
    : photos;

  const skippedPhotoIds = React.useMemo(() => {
    if (skippedGroupIds.size === 0) return new Set<string>();
    const out = new Set<string>();
    duplicateGroups.forEach((g) => {
      if (skippedGroupIds.has(g.groupId)) {
        g.photoIds.forEach((pid) => out.add(pid));
      }
    });
    return out;
  }, [skippedGroupIds, duplicateGroups]);
  const liveActiveTrash = displayPhotos.filter(
    (p) => p.trashCategory && !p.quarantined && !skippedPhotoIds.has(p.id)
  );
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
    if (liveActiveTrash.length === 0 && (isCleanupPaused || pausedSnapshot)) {
      setIsCleanupPaused(false);
      setPausedSnapshot(null);
    }
  }, [liveActiveTrash.length, isCleanupPaused, pausedSnapshot]);

  React.useEffect(() => {
    const onPauseCleanupPaneOnly = () => {
      setPausedSnapshot({
        activeTrash: liveActiveTrash,
        duplicateGroups,
      });
      setIsCleanupPaused(true);
      setActiveTrashCategoryFilter('none');
      clearTrashSelection();
    };
    const onPhotoRestored = () => {
      setIsCleanupPaused(false);
      setPausedSnapshot(null);
      setSkippedGroupIds(new Set());
    };
    const onPhotoMovedToQuarantine = () => {
      setIsCleanupPaused(false);
      setPausedSnapshot(null);
    };
    window.addEventListener('ghosti_pause_cleanup_pane_only', onPauseCleanupPaneOnly);
    window.addEventListener('ghosti_photo_restored_from_quarantine', onPhotoRestored);
    window.addEventListener('ghosti_photo_moved_to_quarantine', onPhotoMovedToQuarantine);
    return () => {
      window.removeEventListener('ghosti_pause_cleanup_pane_only', onPauseCleanupPaneOnly);
      window.removeEventListener('ghosti_photo_restored_from_quarantine', onPhotoRestored);
      window.removeEventListener('ghosti_photo_moved_to_quarantine', onPhotoMovedToQuarantine);
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
    !isRealDeviceMode &&
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
  const activeDuplicateGroups = sourceDuplicateGroups.filter(
    (g) =>
      !skippedGroupIds.has(g.groupId) &&
      g.photoIds.some((id) => {
        const ph = photoById.get(id);
        return ph && !ph.quarantined && id !== g.bestPhotoId;
      })
  );

  React.useEffect(() => {
    if (activeDupSetIdx >= activeDuplicateGroups.length && activeDuplicateGroups.length > 0) {
      setActiveDupSetIdx(0);
    }
  }, [activeDupSetIdx, activeDuplicateGroups.length]);

  const showDuplicatePickSection = currentTab === 'duplicate';

  const zCoreOutdated =
    zConnected && isZCoreOutdated(zVersion);

  return (
    <div
      className={
        layout === 'mobile'
          ? 'w-full flex flex-col gap-3.5'
          : 'w-full max-w-[1640px] mx-auto px-4 sm:px-6 md:px-8 py-6 flex flex-col gap-5 pb-24'
      }
    >
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
            ⚠️ 실행 중인 PC 엔진이 구버전(v{zCoreBridge.version || '구버전'})입니다 — 최신 버전(v{LATEST_Z_CORE_VERSION})으로 업데이트해 주세요.
          </span>
          <a
            href={Z_CORE_ZIP_URL}
            download="Merlin_Z_Core.zip"
            className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-sm text-[13px] font-extrabold whitespace-nowrap shadow cursor-pointer"
          >
            ⬇️ 최신 PC 엔진 (v{LATEST_Z_CORE_VERSION}) 다운로드
          </a>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* ═══════════════ [좌측 열] 미니멀 정리 워크스페이스 (엔진 미연결 시 눈으로 구경 허용 + 클릭 시 우측 귀신비서 채팅 안내) ═══════════════ */}
        <GhostSecretaryFirstGuard
          context="secretary_left"
          className="xl:col-span-7 2xl:col-span-8 flex flex-col gap-5 min-w-0"
        >
          {/* [D-35] 🪪 시기별 다양한 여권사진 등록 — 비서 질문·유저 요청·검색 칩 클릭 시에만 조용히 열림 */}
          <PassportRegistrationPanel />
          {/* 1. 슬림 헤더: 현재 쾌적한 상태 요약 + [⚡ 원본 남기고 N장 일괄 정리] 버튼만 깔끔하게 유지 (여권은 설정방 내부 보관으로 외부 비노출) */}
          <section className="p-3.5 sm:p-5 md:p-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-3.5 sm:gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 pb-3 border-b border-white/10">
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                <h1 className="font-headline-sm text-[19px] sm:text-[20px] md:text-[22px] text-zinc-900 dark:text-white font-extrabold tracking-tight flex items-center gap-2 whitespace-nowrap">
                  <span>👻 귀신비서</span>
                </h1>
                {/* [SSOT v2.3] 1. 👻 귀신비서 대표 1줄 부제 상시 노출 (모바일은 모바일 맞춤 문구로 분기) */}
                <p className="basis-full -mt-1 text-[12px] sm:text-[12.5px] md:text-[13px] font-semibold text-zinc-500 dark:text-zinc-400 break-keep leading-relaxed">
                  {isStoreAppMode || layout === 'mobile' ? (
                    <>
                      중복·연사 사진과 일회성 영수증·캡처·흔들린 사진을 AI 임의 삭제 없이 1초 만에 골라 정리하고 언제든 즉시 복원합니다.
                    </>
                  ) : (
                    <>
                      <span className="whitespace-nowrap">느려진 내 PC·폰, 클릭 한 번에 새것처럼</span> —{' '}
                      <span className="whitespace-nowrap">은행 보안프로그램은 안 지우고 재우고,</span>{' '}
                      <span className="whitespace-nowrap">중복 사진·흩어진 문서까지</span>{' '}
                      <span className="whitespace-nowrap">광고 없이 1초 만에 해결합니다.</span>
                    </>
                  )}
                </p>

                {isCapacitorNativeMobileRuntime() && mobileGalleryScanning && (
                  <span className="px-3 py-1.5 rounded-xl bg-teal-500/15 border border-teal-400/40 text-teal-600 dark:text-teal-300 font-label-sm text-[11.5px] font-extrabold whitespace-nowrap">
                    🔄 내 폰 사진·영상 자동 인덱싱 중...
                  </span>
                )}
                {isCapacitorNativeMobileRuntime() && mobileGalleryPermissionDenied && (
                  <button
                    type="button"
                    onClick={() => void openNativeAppPermissionSettings()}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-label-sm text-[11.5px] font-extrabold transition-colors cursor-pointer whitespace-nowrap"
                  >
                    ⚙️ 사진 접근 권한 허용하기
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 max-w-full" data-allow-secretary-jump="true">
                {!(isStoreAppMode || layout === 'mobile') && (
                  <button
                    type="button"
                    data-allow-secretary-jump="true"
                    onClick={() => window.dispatchEvent(new CustomEvent('ghosti_navigate_showroom'))}
                    style={{ backgroundColor: '#F0FDFA', color: '#0F766E', borderColor: '#14B8A6' }}
                    className="px-3 py-2 rounded-xl border-2 font-black text-[12px] sm:text-[13px] flex items-center justify-center gap-1.5 transition-all hover:opacity-90 cursor-pointer max-w-full shadow-xs"
                  >
                    <span>🏠 온보딩 체험관으로 나가서 구경하기 ➔</span>
                  </button>
                )}
                {liveActiveTrash.length > 0 &&
                  (isCleanupPaused ? (
                    <button
                      type="button"
                      disabled={quarantineMoving}
                      onClick={() => {
                        setIsCleanupPaused(false);
                        setPausedSnapshot(null);
                        setActiveTrashCategoryFilter(
                          duplicateGroups.length > 0 ? 'duplicate' : 'all'
                        );
                      }}
                      className="px-3.5 py-2.5 rounded-xl bg-teal-950/80 hover:bg-teal-900/80 border border-teal-400/40 text-teal-200 font-label-sm text-[12px] font-extrabold flex items-center justify-center gap-1 transition-all disabled:opacity-40 cursor-pointer max-w-full"
                    >
                      <span>▶️ 남은 사진 정리 다시 펼치기 ({liveActiveTrash.length}장)</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={quarantineMoving && liveActiveTrash.length <= 10}
                      onClick={() => {
                        if (quarantineMoving) {
                          window.dispatchEvent(new CustomEvent('ghosti_cancel_inflight_quarantine'));
                        }
                        setPausedSnapshot(
                          quarantineMoving
                            ? null
                            : {
                                activeTrash: liveActiveTrash,
                                duplicateGroups,
                              }
                        );
                        setIsCleanupPaused(true);
                        setActiveTrashCategoryFilter('none');
                        clearTrashSelection();
                        window.dispatchEvent(
                          new CustomEvent('ghosti_defer_photo_cleanup_and_continue')
                        );
                      }}
                      className="px-3.5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-white/15 text-zinc-200 font-label-sm text-[12px] font-bold flex items-center justify-center gap-1 transition-all disabled:opacity-40 cursor-pointer max-w-full"
                    >
                      <span>
                        {quarantineMoving && liveActiveTrash.length > 10
                          ? '⏹️ 정리 멈추기 · 남은 사진은 다음에'
                          : '⏭️ 남은 사진 정리는 다음에'}
                      </span>
                    </button>
                  ))}
                <span className="px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 font-label-sm text-[11.5px] font-extrabold flex items-center gap-1.5">
                  <span>🔒 AI 임의 삭제 0% · 실사진 확인 후 [OK] 승인 시에만 정리</span>
                </span>
              </div>
            </div>

            <div className="font-headline-md text-[15.5px] sm:text-[16px] md:text-[18px] text-zinc-900 dark:text-white font-extrabold tracking-tight leading-snug break-keep">
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
              ) : (isStoreAppMode || layout === 'mobile') &&
                displayPhotos.length === 0 &&
                quarantinedPhotos.length === 0 ? (
                <span className="text-teal-600 dark:text-teal-300">
                  {mobileGalleryScanning
                    ? '🔄 내 폰 사진첩을 자동으로 훑어 중복·연사·흔들린 사진을 분석하고 있어요...'
                    : mobileGalleryPermissionDenied
                    ? '🔒 스마트폰 사진 접근 권한을 허용해 주시면 수동 불러오기 없이 자동으로 정리·검색이 시작돼요!'
                    : isCapacitorNativeMobileRuntime()
                    ? '✨ 내 폰 사진첩에 표시할 사진이 아직 0장이에요.'
                    : '📲 스토어에서 『귀신같이』 정식 앱을 실행하시면 수동 불러오기 없이 내 폰 사진·영상이 자동으로 인덱싱돼요!'}
                </span>
              ) : (
                <span className="text-primary-container">
                  ✨ 현재 가장 쾌적한 상태입니다 (정리 완료 {quarantinedPhotos.length}장)
                </span>
              )}
            </div>
          </section>

          {/* 1-B. [PC 전용 상단 노출] 🛡️ 귀신비서의 상시 케어 능력 3종 — 모바일에서는 PC 전용 단어 비노출 */}
          {!(isStoreAppMode || layout === 'mobile') && (
            <section
              data-allow-secretary-jump="true"
              aria-label="귀신비서 상시 케어 능력 안내"
              className="p-4 sm:p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/30 shadow-sm flex flex-col gap-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <span className="text-[13.5px] sm:text-[14px] font-extrabold text-emerald-900 dark:text-emerald-200 break-keep leading-snug">
                  🛡️ 귀신비서의 상시 케어 능력 3종 (평생 0원)
                </span>
                <span className="text-[11.5px] sm:text-[12px] text-emerald-800 dark:text-emerald-300 font-semibold break-keep">
                  카드를 누르면 귀신비서 대화창에서 바로 실행돼요
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-[12.5px]">
                <div className="text-left p-3.5 rounded-xl bg-white dark:bg-zinc-900/90 border border-emerald-200/90 dark:border-emerald-500/25 shadow-xs flex flex-col justify-between gap-2 transition">
                  <div className="flex flex-col gap-1.5">
                    <span className="font-extrabold text-slate-900 dark:text-white break-keep leading-snug">
                      ① ⚡ 은행·관공서 보안앱 자동 절전·기상
                    </span>
                    <span className="text-slate-700 dark:text-zinc-300 break-keep leading-relaxed text-[12px]">
                      평소엔 메모리를 먹는 보안모듈을 재워 컴퓨터를 가볍게 하고, 은행 업무를 볼 때만 1초 만에 깨워드려요.
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        window.dispatchEvent(
                          new CustomEvent('ghosti_toss_to_monster_chat', {
                            detail: { query: '⚡ 은행·관공서 보안절전' },
                          })
                        )
                      }
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[11.5px] cursor-pointer transition shadow-2xs"
                    >
                      ⚡ 은행·관공서 보안절전
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        window.dispatchEvent(
                          new CustomEvent('ghosti_toss_to_monster_chat', {
                            detail: { query: '🏦 보안프로그램 즉시 깨우기' },
                          })
                        )
                      }
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-slate-300 dark:border-zinc-600 text-slate-800 dark:text-zinc-100 font-bold text-[11.5px] cursor-pointer transition"
                    >
                      🏦 보안프로그램 즉시 깨우기
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent('ghosti_toss_to_monster_chat', {
                        detail: { query: '윈도우 순정 백신으로 빠른 바이러스 검사 실행해줘' },
                      })
                    )
                  }
                  className="text-left p-3.5 rounded-xl bg-white dark:bg-zinc-900/90 hover:bg-emerald-50/70 dark:hover:bg-zinc-900 border border-emerald-200/90 dark:border-emerald-500/25 shadow-xs flex flex-col justify-between gap-2 transition cursor-pointer"
                >
                  <div className="flex flex-col gap-1.5">
                    <span className="font-extrabold text-slate-900 dark:text-white break-keep leading-snug">
                      ② 🛡️ 다운로드 파일 무소음 백신 경호
                    </span>
                    <span className="text-slate-700 dark:text-zinc-300 break-keep leading-relaxed text-[12px]">
                      광고 팝업 없이 새로 받은 설치파일·압축파일을 윈도우 기본 백신으로 조용하고 안전하게 검사해요.
                    </span>
                  </div>
                  <span className="inline-flex self-start px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300/80 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-200 font-extrabold text-[11.5px]">
                    🛡️ 무소음 백신 빠른 점검
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent('ghosti_toss_to_monster_chat', {
                        detail: { query: '🛟 미저장 문서·휴지통 3초 구출' },
                      })
                    )
                  }
                  className="text-left p-3.5 rounded-xl bg-white dark:bg-zinc-900/90 hover:bg-emerald-50/70 dark:hover:bg-zinc-900 border border-emerald-200/90 dark:border-emerald-500/25 shadow-xs flex flex-col justify-between gap-2 transition cursor-pointer"
                >
                  <div className="flex flex-col gap-1.5">
                    <span className="font-extrabold text-slate-900 dark:text-white break-keep leading-snug">
                      ③ 🛟 미저장 문서·휴지통 3초 구출
                    </span>
                    <span className="text-slate-700 dark:text-zinc-300 break-keep leading-relaxed text-[12px]">
                      실수로 저장 안 하고 끈 문서 임시본을 찾거나, 방금 휴지통으로 보낸 사진·문서를 원래 위치로 즉시 복원해요.
                    </span>
                  </div>
                  <span className="inline-flex self-start px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[11.5px] shadow-2xs">
                    🛟 미저장 문서·휴지통 3초 구출 실행
                  </span>
                </button>
              </div>
            </section>
          )}

          {/* iOS/Android '제한된 사진 접근(선택한 사진만 허용)' 상태 안내 배너 — 모바일 전폭 2단 레이아웃 & 라이트/다크 고대비 보장 */}
          {mobileGalleryLimitedAccess && isCapacitorNativeMobileRuntime() && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/85 border border-amber-300 dark:border-amber-400/50 flex flex-col md:flex-row md:items-center md:justify-between gap-3 shadow-sm">
              <div className="flex flex-col gap-1 w-full md:flex-1 min-w-0">
                <span className="text-[13px] sm:text-[13.5px] leading-snug font-extrabold text-amber-950 dark:text-amber-200 break-keep">
                  ⚠️ 현재 휴대폰 사진 권한이 『선택한 사진만 허용(제한된 접근)』으로 되어 있어요 (현재 허용된 사진 {displayPhotos.length}장)
                </span>
                <span className="text-[12px] sm:text-[12.5px] leading-relaxed font-semibold text-amber-900 dark:text-amber-100 break-keep">
                  새로 저장한 중복·흔들린 사진까지 빠짐없이 분류하려면 [설정에서 전체 허용]으로 바꾸거나 [사진 추가 선택]을 눌러주세요.
                </span>
              </div>
              <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full md:w-auto shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    void syncMobileNativeGalleryAuto({
                      promptPermission: true,
                      forceExpandSelected: true,
                    })
                  }
                  className="py-2.5 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-[12px] font-black flex items-center justify-center gap-1 cursor-pointer shadow-xs whitespace-nowrap"
                >
                  📸 사진 추가 선택
                </button>
                <button
                  type="button"
                  onClick={() => void openNativeAppPermissionSettings()}
                  className="py-2.5 px-3 rounded-xl bg-white dark:bg-zinc-900 hover:bg-amber-100/70 dark:hover:bg-zinc-800 border border-amber-400/80 dark:border-amber-300/40 text-amber-950 dark:text-amber-200 text-[12px] font-extrabold flex items-center justify-center gap-1 cursor-pointer shadow-xs whitespace-nowrap"
                >
                  ⚙️ 설정에서 전체 허용
                </button>
              </div>
            </div>
          )}

          {/* 2. 깔끔한 4열 정리 카테고리 카드 (글자 잘림 0% + 미니 샘플 썸네일 프리뷰 내장) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {TRASH_TABS_4.map((tab) => {
              const items = activeTrash.filter((p) => matchesTrashTab(p, tab.key));
              const bytes = items.reduce((a, p) => a + p.size, 0);
              const isSelected = currentTab === tab.key;
              const sampleThumbs =
                items.length > 0
                  ? items.slice(0, 2)
                  : !isRealDeviceMode
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
                  className={`group text-left cursor-pointer rounded-2xl p-3 sm:p-3.5 transition-all flex flex-col justify-between gap-2 border-2 min-w-0 overflow-hidden ${
                    isSelected
                      ? 'bg-teal-500/15 border-[#0D9488] shadow-md ring-2 ring-[#0D9488]/40'
                      : 'bg-[#18181B] hover:bg-zinc-900/70 border-white/10'
                  }`}
                >
                  <div className="flex flex-col gap-1.5 w-full min-w-0">
                    {/* 상단 상태 줄: 좌측 번호 배지 + 우측 펼치기/접기 알약 (모바일 2열 카드에서도 100% 내부 수납) */}
                    <div className="flex items-center justify-between gap-1 w-full min-w-0">
                      <span className="font-headline-sm text-[13px] text-primary-container font-extrabold shrink-0">
                        {tab.stepNum}
                      </span>
                      {isSelected ? (
                        <span
                          style={{ backgroundColor: '#0D9488', color: '#FFFFFF' }}
                          className="px-2 py-0.5 rounded-full text-[10px] font-extrabold whitespace-nowrap shadow-xs shrink-0 max-w-full"
                        >
                          ✓ 선택됨 · 접기 ▲
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-zinc-800/80 border border-white/10 text-zinc-300 text-[10px] font-bold whitespace-nowrap shrink-0 max-w-full">
                          펼치기 ▼
                        </span>
                      )}
                    </div>

                    <span className="font-headline-sm text-[13.5px] sm:text-[14.5px] text-white font-extrabold tracking-tight break-keep leading-snug">
                      {tab.shortTitle}
                    </span>

                    <span className="font-body-sm text-[11px] text-zinc-400 break-keep leading-snug">
                      {tab.subtitle}
                    </span>
                  </div>

                  {/* 카드 내 미니 썸네일 프리뷰 (실제 0장일 때도 어떤 기능인지 한눈에 보이도록 샘플 제공) */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5 min-w-0">
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
                    {items.length === 0 && !isRealDeviceMode && (
                      <span className="px-1.5 py-0.5 rounded bg-zinc-800/90 border border-white/10 text-[10px] text-zinc-300 font-bold whitespace-nowrap">
                        예시 샘플
                      </span>
                    )}
                    {items.length === 0 &&
                      isRealDeviceMode &&
                      (isStoreAppMode || layout === 'mobile') &&
                      displayPhotos.length === 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-teal-950/70 border border-teal-400/30 text-[10px] text-teal-200 font-bold whitespace-nowrap">
                          폰 사진 대기
                        </span>
                      )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-1 pt-2 border-t border-white/10 w-full min-w-0">
                    <div className="flex items-baseline gap-1 whitespace-nowrap">
                      <span className="font-headline-md text-[15px] sm:text-[16px] text-white font-extrabold">
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

          {/* 3-A. ① 중복 사진 & 연사 묶음 1세트씩 순차 확인 및 유저 [OK] 승인 (currentTab === 'duplicate'일 때만 순수 표시) */}
          {showDuplicatePickSection && (
            <div className="p-3.5 sm:p-5 md:p-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-4">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 border-b border-white/10 pb-3.5">
                <div className="flex flex-col gap-2 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-headline-sm text-[17px] md:text-[18.5px] text-white font-extrabold break-keep">
                      ① 중복 사진 &amp; 연사 묶음 (세트별 실사진 확인 · 유저 OK 승인)
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-md bg-zinc-900 border border-white/10 text-primary-container font-label-sm text-[12.5px] font-bold whitespace-nowrap shrink-0">
                      {activeDuplicateGroups.length > 0
                        ? `총 ${activeDuplicateGroups.length}세트 발견 · 버릴 후보 ${dupCount}장`
                        : '0세트 (깨끗함)'}
                    </span>
                  </div>
                  {activeDuplicateGroups.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[12px] font-extrabold text-teal-300 whitespace-nowrap mr-0.5">
                          📸 세트 바로가기:
                        </span>
                        {activeDuplicateGroups.slice(0, 6).map((g, idx) => {
                          const cnt = g.photoIds.filter((id) => {
                            const ph = photoById.get(id);
                            return ph && !ph.quarantined;
                          }).length;
                          const isCurSet =
                            !showAllDupSets &&
                            Math.min(activeDupSetIdx, activeDuplicateGroups.length - 1) === idx;
                          return (
                            <button
                              key={g.groupId}
                              type="button"
                              onClick={() => {
                                setShowAllDupSets(false);
                                setActiveDupSetIdx(idx);
                              }}
                              className={`px-2 py-0.5 rounded-lg border text-[11.5px] font-bold whitespace-nowrap transition cursor-pointer ${
                                isCurSet
                                  ? 'bg-primary-container text-zinc-950 border-primary-container font-black'
                                  : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-white/15'
                              }`}
                            >
                              {idx + 1}세트 ({cnt}장)
                            </button>
                          );
                        })}
                        {activeDuplicateGroups.length > 6 && (
                          <button
                            type="button"
                            onClick={() => setShowAllDupSets((v) => !v)}
                            className="px-2.5 py-0.5 rounded-lg bg-teal-950/70 hover:bg-teal-900/80 border border-teal-400/40 text-teal-200 text-[11.5px] font-extrabold whitespace-nowrap cursor-pointer transition"
                          >
                            {showAllDupSets
                              ? '접기 ▲'
                              : `+외 ${activeDuplicateGroups.length - 6}세트 더 보기`}
                          </button>
                        )}
                      </div>
                      <p className="font-body-sm text-[12.5px] text-zinc-300 leading-relaxed break-keep">
                        한 세트씩 실사진과 <span className="text-primary-container font-bold">👑 추천 베스트 1장</span>을 확인하시고 <span className="text-white font-bold">[👍 OK]</span>를 눌러 정리해 주세요!
                      </p>
                    </div>
                  ) : (
                    <p className="font-body-sm text-[13px] text-zinc-400 break-keep">
                      AI가 마음대로 사진을 지우지 않으며, 실사진을 보여드리고 직접 OK 하실 때만 정리합니다.
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0 self-start">
                  {activeDuplicateGroups.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setShowAllDupSets((v) => !v)}
                      className="px-3.5 py-2 rounded-xl font-label-sm text-[12px] font-extrabold border bg-zinc-900 text-teal-300 hover:text-white border-teal-500/40 transition-all cursor-pointer whitespace-nowrap shrink-0"
                    >
                      {showAllDupSets
                        ? '🎯 1세트씩 순서대로 보기'
                        : `📋 전체 ${activeDuplicateGroups.length}세트 한눈에 펼치기`}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveTrashCategoryFilter('none')}
                    className="px-3.5 py-2 rounded-xl font-label-sm text-[12px] font-bold border bg-zinc-900 text-zinc-400 hover:text-white border-white/10 transition-all cursor-pointer whitespace-nowrap shrink-0"
                  >
                    목록 접기 ▲
                  </button>
                </div>
              </div>

              {activeDuplicateGroups.length > 0 ? (
                <div className="flex flex-col gap-4">
                  {(showAllDupSets
                    ? activeDuplicateGroups.map((g, idx) => ({ group: g, gIdx: idx }))
                    : [
                        {
                          group:
                            activeDuplicateGroups[
                              Math.min(activeDupSetIdx, activeDuplicateGroups.length - 1)
                            ],
                          gIdx: Math.min(activeDupSetIdx, activeDuplicateGroups.length - 1),
                        },
                      ]
                  ).map(({ group, gIdx }) => {
                    const groupPhotos = group.photoIds
                      .map((id) => photoById.get(id))
                      .filter((p): p is NonNullable<typeof p> => Boolean(p && !p.quarantined));

                    const redundantCount = groupPhotos.filter((p) => p.id !== group.bestPhotoId).length;
                    const repPhoto = groupPhotos[0];
                    const sceneLabel =
                      repPhoto?.tags.find((t) => !t.includes('연사') && !t.includes('원본')) || '#연사묶음';

                    return (
                      <div
                        key={group.groupId}
                        className="p-4 sm:p-5 rounded-2xl bg-zinc-950/85 border-2 border-teal-500/40 flex flex-col gap-3.5 shadow-md"
                      >
                        {/* 세트 상단 귀신비서 추천 질문 & 유저 OK / 건너뛰기 결정 바 */}
                        <div className="p-3.5 rounded-xl bg-teal-950/50 border border-teal-400/40 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                          <div className="flex flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="px-2.5 py-0.5 rounded-full bg-primary-container text-zinc-950 font-label-sm text-[11.5px] font-black">
                                세트 {gIdx + 1} / {activeDuplicateGroups.length} (총 {groupPhotos.length}장)
                              </span>
                              <span className="px-2 py-0.5 rounded bg-zinc-900 border border-white/10 text-zinc-300 font-label-sm text-[11px] font-medium">
                                {sceneLabel}
                              </span>
                            </div>
                            <p className="text-[13.5px] sm:text-[14px] text-white font-extrabold leading-snug break-keep">
                              🤖 귀신비서 추천: 이 세트({groupPhotos.length}장)에서 가장 잘 나온{' '}
                              <span className="text-primary-container">[👑 추천 베스트 1장]</span>만 남기고, 나머지{' '}
                              <span className="text-amber-300">{redundantCount}장은 휴지통으로 이동할까요?</span>
                            </p>
                            <span className="text-[11.5px] text-zinc-300 break-keep">
                              {isStoreAppMode || layout === 'mobile'
                                ? !zCoreBridge.isConnected && isCapacitorIosRuntime()
                                  ? '🗑️ [OK]를 누르면 시스템 확인창을 거쳐 아이폰 『사진 ➔ 최근 삭제된 항목』(30일 보관)으로 이동하며, 그곳에서 FaceID로 언제든 원본 복원할 수 있어요.'
                                  : '🗑️ [OK]를 누르면 시스템 확인창을 거쳐 내 폰 갤러리(구글 포토) 실제 휴지통(30일 보관)으로 이동하며, 아래쪽 [↩️ 정리한 사진 복원]에서 언제든 되돌릴 수 있어요.'
                                : '💡 다른 사진을 남기고 싶다면 아래 실사진 중 원하는 사진을 먼저 터치해 👑 베스트 1장을 바꾼 뒤 [OK]를 눌러주세요.'}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                            {!showAllDupSets && activeDuplicateGroups.length > 1 && (
                              <div className="flex items-center gap-1 mr-1">
                                <button
                                  type="button"
                                  disabled={gIdx <= 0}
                                  onClick={() => setActiveDupSetIdx((prev) => Math.max(0, prev - 1))}
                                  className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-200 text-[11.5px] font-bold disabled:opacity-40 cursor-pointer"
                                >
                                  ◀ 이전 세트
                                </button>
                                <button
                                  type="button"
                                  disabled={gIdx >= activeDuplicateGroups.length - 1}
                                  onClick={() =>
                                    setActiveDupSetIdx((prev) =>
                                      Math.min(activeDuplicateGroups.length - 1, prev + 1)
                                    )
                                  }
                                  className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-200 text-[11.5px] font-bold disabled:opacity-40 cursor-pointer"
                                >
                                  다음 세트 ▶
                                </button>
                              </div>
                            )}

                            <button
                              type="button"
                              disabled={quarantineMoving}
                              onClick={() =>
                                void pickBestInDuplicateGroup(group.groupId, group.bestPhotoId, true)
                              }
                              className="w-full sm:w-auto max-w-full px-3.5 py-2.5 rounded-xl bg-primary-container hover:opacity-95 text-zinc-950 font-label-sm text-[12px] sm:text-[12.5px] font-black shadow-sm transition-all flex items-center justify-center gap-1.5 whitespace-normal break-keep text-center leading-snug cursor-pointer"
                            >
                              <span>👍 OK! 베스트 1장만 남기고 나머지 {redundantCount}장 휴지통으로 이동</span>
                            </button>

                            <button
                              type="button"
                              disabled={quarantineMoving}
                              onClick={() => {
                                setSkippedGroupIds((prev) => {
                                  const next = new Set(prev);
                                  next.add(group.groupId);
                                  return next;
                                });
                              }}
                              className="w-full sm:w-auto px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-300 font-label-sm text-[12px] font-bold transition-all text-center justify-center cursor-pointer"
                            >
                              ⏭️ 이 세트는 안 버리고 건너뛰기
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
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
                                    ? 'ring-3 ring-primary-container border-2 border-primary-container shadow-lg'
                                    : 'border border-white/15 opacity-90 hover:opacity-100 hover:border-white/40'
                                }`}
                              >
                                <img
                                  src={ph.thumbUrl}
                                  alt={ph.name}
                                  loading="lazy"
                                  className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-300"
                                />

                                {isBestOriginal ? (
                                  <div className="absolute top-2 left-2 right-2 px-2 py-1 rounded-lg bg-zinc-950/90 backdrop-blur-md border border-primary-container text-primary-container font-label-sm text-[10.5px] sm:text-[11px] font-black flex items-center justify-center text-center break-keep leading-tight">
                                    <span>👑 AI 추천 베스트 1장 (보존)</span>
                                  </div>
                                ) : (
                                  <div className="absolute top-2 left-2 right-2 px-2 py-1 rounded-lg bg-zinc-950/85 backdrop-blur-md border border-amber-400/40 text-amber-200 font-label-sm text-[10.5px] sm:text-[11px] font-bold flex items-center justify-center text-center break-keep leading-tight">
                                    <span>{`🗑️ 버릴 후보 #${idx + 1} · 터치 시 보존`}</span>
                                  </div>
                                )}

                                <div className="absolute inset-x-0 bottom-0 px-2.5 py-1.5 bg-gradient-to-t from-black/90 via-black/60 to-transparent flex items-center justify-between">
                                  <span className="text-[10.5px] text-zinc-200 font-medium truncate pr-6">
                                    {ph.name}
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedPhoto(ph, groupPhotos);
                                  }}
                                  title="실사진 크게 비교 보기"
                                  className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-black/80 hover:bg-primary-container text-white hover:text-zinc-950 flex items-center justify-center transition-colors z-10 cursor-pointer"
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
                <div className="p-6 sm:p-8 rounded-xl bg-zinc-950/60 border border-white/5 text-center flex flex-col items-center gap-2.5">
                  <span className="material-symbols-outlined text-primary-container text-[32px]">
                    {displayPhotos.length === 0 && (isStoreAppMode || layout === 'mobile')
                      ? 'add_photo_alternate'
                      : 'verified'}
                  </span>
                  <span className="font-headline-sm text-[15px] sm:text-[15.5px] text-white font-extrabold break-keep">
                    {displayPhotos.length === 0 && (isStoreAppMode || layout === 'mobile')
                      ? mobileGalleryScanning
                        ? '🔄 내 폰 사진·동영상 자동 인덱싱 중이에요!'
                        : mobileGalleryPermissionDenied
                        ? '⚙️ 스마트폰 사진·동영상 접근 권한 허용이 필요해요!'
                        : '✨ 내 스마트폰 사진첩에 정리할 사진이 없어요!'
                      : '✨ 중복되거나 연속으로 찍힌 사진 묶음이 0세트예요!'}
                  </span>
                  <span className="font-body-sm text-[12.5px] sm:text-[13px] text-zinc-400 break-keep">
                    {displayPhotos.length === 0 && (isStoreAppMode || layout === 'mobile')
                      ? mobileGalleryScanning
                        ? '내 폰 사진첩을 자동으로 인덱싱하고 있어요. 잠시만 기다려 주세요!'
                        : mobileGalleryPermissionDenied
                        ? '스마트폰 사진 접근 권한을 허용해 주시면 중복·연사 세트와 흐린 사진을 자동으로 골라 보여드려요!'
                        : '버릴 중복·연사 사진 없이 현재 아주 깨끗한 상태입니다.'
                      : '버릴 중복·연사 사진 없이 현재 아주 깨끗한 상태입니다.'}
                  </span>
                  {displayPhotos.length === 0 &&
                    isCapacitorNativeMobileRuntime() &&
                    !mobileGalleryScanning && (
                      <button
                        type="button"
                        onClick={() =>
                          mobileGalleryPermissionDenied
                            ? void openNativeAppPermissionSettings()
                            : void syncMobileNativeGalleryAuto({ promptPermission: true })
                        }
                        className="mt-1 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-[12.5px] font-extrabold shadow-sm cursor-pointer"
                      >
                        {mobileGalleryPermissionDenied ? '⚙️ 사진 접근 권한 허용하기' : '🔄 사진첩 자동 동기화 확인'}
                      </button>
                    )}
                  {skippedGroupIds.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setSkippedGroupIds(new Set())}
                      className="mt-2 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-teal-300 text-[12px] font-bold cursor-pointer"
                    >
                      🔄 건너뛴 세트({skippedGroupIds.size}개) 다시 보기
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 3-B. 탭 ②·③·④ (메모·영수증 / 스크린샷 / 흔들린 사진) 실사진 확인 및 유저 [OK] 승인 그리드 */}
          {currentTab !== 'duplicate' && currentTab !== 'none' && (
            <section className="p-3.5 sm:p-5 md:p-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-headline-sm text-[16.5px] text-white font-bold">
                    {TRASH_TABS_4.find((t) => t.key === currentTab)?.title ||
                      '📋 전체 정리 후보 사진 (① 중복·연사 + ② 메모·영수증 + ③ 캡처 + ④ 흔들림)'}
                  </h2>
                  <span className="px-2 py-0.5 rounded-md bg-zinc-900 border border-white/10 text-primary-container font-label-sm text-[11.5px] font-bold">
                    {isShowingSamplePreview
                      ? `예시 샘플 ${filteredCandidates.length}장 (내 기기 감지 0장)`
                      : filteredCandidates.length > 0
                      ? `발견된 후보 ${filteredCandidates.length}장`
                      : '0장 (깨끗함)'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTrashCategoryFilter('duplicate')}
                    className="px-3 py-1.5 rounded-xl font-label-sm text-[11.5px] font-bold border bg-zinc-900 text-zinc-300 hover:text-white border-white/10 transition-all cursor-pointer"
                  >
                    중복·연사 세트 보기 ({activeDuplicateGroups.length}세트)
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
                        className="px-4 py-1.5 rounded-xl bg-primary-container text-zinc-950 font-label-sm text-[12.5px] font-black disabled:opacity-40 cursor-pointer shadow-sm"
                      >
                        👍 OK! 선택한 {activeSelectedPhotos.length}장 ({fmtMB(selectedBytes)}) 버리기
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

              {!isShowingSamplePreview && realFilteredCandidates.length > 0 && (
                <div className="p-3.5 rounded-xl bg-teal-950/45 border border-teal-400/40 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[13px] sm:text-[13.5px] text-white font-extrabold break-keep">
                    {currentTab === 'blurry'
                      ? `🤖 귀신비서 추천: 흔들리거나 초점이 나간 흐린 사진 ${realFilteredCandidates.length}장이 발견되었어요. 아래 실사진들을 직접 보시고 버리는 것에 동의하시면 우측 [👍 OK! 선택한 ${activeSelectedPhotos.length}장 버리기]를 눌러주세요!`
                      : currentTab === 'memo'
                      ? `🤖 귀신비서 추천: 일회성 메모·영수증 사진 ${realFilteredCandidates.length}장이 발견되었어요. 아래 실사진들을 보시고 버릴 사진만 체크해 [👍 OK! 선택한 ${activeSelectedPhotos.length}장 버리기]를 눌러주세요!`
                      : `🤖 귀신비서 추천: 화면 캡처(스크린샷) 사진 ${realFilteredCandidates.length}장이 발견되었어요. 아래 실사진들을 보시고 버릴 사진만 체크해 [👍 OK! 선택한 ${activeSelectedPhotos.length}장 버리기]를 눌러주세요!`}
                  </span>
                </div>
              )}

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
                            alt={photo.name}
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
                              title={isChecked ? '선택 해제' : '버릴 대상 선택'}
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
                            title="실사진 크게 보기"
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
                <div className="p-6 sm:p-8 rounded-xl bg-zinc-950/60 border border-white/5 text-center flex flex-col items-center gap-2.5">
                  <span className="material-symbols-outlined text-primary-container text-[32px]">
                    {displayPhotos.length === 0 && (isStoreAppMode || layout === 'mobile')
                      ? 'add_photo_alternate'
                      : 'verified'}
                  </span>
                  <span className="font-headline-sm text-[15px] sm:text-[15.5px] text-white font-extrabold break-keep">
                    {displayPhotos.length === 0 && (isStoreAppMode || layout === 'mobile')
                      ? '📱 아직 내 폰 사진을 불러오지 않았어요!'
                      : currentTab === 'blurry'
                      ? '✨ 흔들리거나 초점이 나간 흐린 사진이 0장이에요!'
                      : currentTab === 'memo'
                      ? '✨ 정리할 일회성 메모·영수증 사진이 0장이에요!'
                      : currentTab === 'screenshot'
                      ? '✨ 정리할 화면 캡처(스크린샷) 사진이 0장이에요!'
                      : '✨ 현재 이 카테고리에 정리할 사진이 없습니다 (0장)'}
                  </span>
                  <span className="font-body-sm text-[12.5px] sm:text-[13px] text-zinc-400 break-keep">
                    {displayPhotos.length === 0 && (isStoreAppMode || layout === 'mobile')
                      ? mobileGalleryScanning
                        ? '내 폰 사진첩을 자동으로 인덱싱하고 있어요. 잠시만 기다려 주세요!'
                        : mobileGalleryPermissionDenied
                        ? '스마트폰 사진 접근 권한을 허용해 주시면 메모·영수증·캡처·흐린 사진을 자동으로 분류해 보여드려요!'
                        : '버릴 사진 없이 현재 아주 깨끗한 상태입니다.'
                      : '버릴 사진 없이 현재 아주 깨끗한 상태입니다.'}
                  </span>
                  {displayPhotos.length === 0 &&
                    isCapacitorNativeMobileRuntime() &&
                    !mobileGalleryScanning && (
                      <button
                        type="button"
                        onClick={() =>
                          mobileGalleryPermissionDenied
                            ? void openNativeAppPermissionSettings()
                            : void syncMobileNativeGalleryAuto({ promptPermission: true })
                        }
                        className="mt-1 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-[12.5px] font-extrabold shadow-sm cursor-pointer"
                      >
                        {mobileGalleryPermissionDenied ? '⚙️ 사진 접근 권한 허용하기' : '🔄 사진첩 자동 동기화 확인'}
                      </button>
                    )}
                </div>
              )}
            </section>
          )}

          {/* 3-C. 화면 아래쪽 [↩️ 정리한 사진 복원 / 아이폰 최근 삭제된 항목 안내] — 중복·연사 세트별 정리 화면보다 아래쪽에 배치 */}
          {(quarantinedPhotos.length > 0 || lastUndoBatch) && (() => {
            const isIosNativeTrash = !zCoreBridge.isConnected && isCapacitorIosRuntime();
            return (
              <section
                id="ghosti-quarantine-restore-section"
                className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#18181B] border border-teal-300 dark:border-emerald-500/35 shadow-sm flex flex-col gap-3"
              >
                {lastUndoBatch && !isIosNativeTrash && (
                  <div className="p-3.5 rounded-xl bg-teal-50/70 dark:bg-zinc-900 border border-teal-300 dark:border-primary-container/60 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-teal-700 dark:text-primary-container text-[20px] shrink-0">
                        history
                      </span>
                      <span className="font-label-md text-[13px] text-slate-900 dark:text-zinc-100 font-semibold break-keep">
                        {`방금 정리한 ${lastUndoBatch.count}장 (${fmtMB(lastUndoBatch.savedBytes)})이 OS 기본 [휴지통]으로 안전하게 이동되었습니다.`}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={quarantineMoving}
                        onClick={() => void undoLastQuarantine()}
                        className="px-3.5 py-1.5 rounded-lg bg-primary-container text-zinc-950 font-label-sm text-[12px] font-extrabold transition-all cursor-pointer disabled:opacity-40"
                      >
                        ↩️ 1초 즉시 되돌리기 (Undo)
                      </button>
                      <button
                        type="button"
                        onClick={dismissUndoBatch}
                        className="p-1 text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white cursor-pointer"
                        title="닫기"
                      >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                      </button>
                    </div>
                  </div>
                )}

                {isIosNativeTrash && quarantinedPhotos.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-teal-50 dark:bg-zinc-900 border border-teal-300 dark:border-teal-400/40 flex items-start gap-2.5">
                    <span className="material-symbols-outlined text-teal-700 dark:text-teal-300 text-[19px] shrink-0 mt-0.5">
                      lock
                    </span>
                    <p className="text-[12.5px] text-slate-900 dark:text-zinc-100 font-bold leading-relaxed break-keep">
                      아이폰은 애플 FaceID 보안 정책에 따라 『사진 ➔ 최근 삭제된 항목』에 30일간 안전 보관되며, 그곳에서 원본 그대로 복원할 수 있습니다.
                    </p>
                  </div>
                )}

                {quarantinedPhotos.length > 0 && (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setShowQuarantineDrawer((v) => !v)}
                        className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-zinc-100 font-label-sm text-[12.5px] font-extrabold flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <span className="text-left break-keep">
                          {isIosNativeTrash
                            ? `🗂️ 최근 정리 내역 (${quarantinedPhotos.length}장 · 30일 보관)`
                            : `↩️ 정리한 사진 복원 (${quarantinedPhotos.length}장)`}
                        </span>
                        <span className="text-teal-700 dark:text-emerald-300 text-[11.5px] font-black shrink-0 whitespace-nowrap">
                          {showQuarantineDrawer ? '접기 ▲' : '펼치기 ▼'}
                        </span>
                      </button>
                      {showQuarantineDrawer && !isIosNativeTrash && (
                        <button
                          type="button"
                          disabled={quarantineMoving}
                          onClick={() =>
                            void restoreFromQuarantine(quarantinedPhotos.map((p) => p.id))
                          }
                          className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-label-sm text-[12px] font-extrabold cursor-pointer disabled:opacity-40 shadow-xs"
                        >
                          ♻️ {quarantinedPhotos.length}장 전체 원위치 복원
                        </button>
                      )}
                    </div>

                    {showQuarantineDrawer && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-zinc-950/80 border border-slate-200 dark:border-white/10 max-h-64 overflow-y-auto">
                        {quarantinedPhotos.map((qp) => (
                          <div
                            key={qp.id}
                            className="p-2.5 rounded-lg bg-white dark:bg-zinc-900/90 border border-slate-200 dark:border-white/10 flex items-center justify-between gap-2.5"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <img
                                src={qp.thumbUrl}
                                alt=""
                                loading="lazy"
                                className="w-10 h-10 rounded-md object-cover border border-slate-200 dark:border-white/10 shrink-0 bg-slate-200 dark:bg-zinc-800"
                              />
                              <span className="text-[11.5px] text-slate-900 dark:text-zinc-200 font-semibold break-all leading-snug">
                                {qp.name}
                              </span>
                            </div>
                            {isIosNativeTrash ? (
                              <span className="px-2 py-1 rounded-md bg-teal-100 dark:bg-zinc-800 text-teal-900 dark:text-teal-300 border border-teal-300 dark:border-teal-500/30 text-[10.5px] font-bold shrink-0 whitespace-nowrap">
                                30일 보관됨
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={quarantineMoving}
                                onClick={() => void restoreFromQuarantine([qp.id])}
                                className="px-2.5 py-1.5 rounded-md bg-emerald-500/20 hover:bg-emerald-500 text-emerald-800 dark:text-emerald-300 hover:text-zinc-950 border border-emerald-500/40 text-[11px] font-extrabold shrink-0 cursor-pointer transition-colors"
                              >
                                복원
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </section>
            );
          })()}

        </GhostSecretaryFirstGuard>

        {/* ═══════════════ [우측 열] 귀신비서 전용 대화방 (PC에서는 좌측 메인 화면과 뚜렷이 구분되는 카톡형 채팅방 프레임) ═══════════════ */}
        <div className="order-first xl:order-none xl:col-span-5 2xl:col-span-4 xl:sticky xl:top-20 xl:pl-4 xl:border-l-2 xl:border-teal-500/25">
          <MonsterStandardChatColumn
            sourceTab="trash"
            externalQueryTrigger={externalQueryTrigger}
            showWelcomeQuickCareActions={true}
            onHealthRecordAdded={() => {}}
            onTriggerOsRepair={(symptomQuery) => {
              void useSaySeeStore.getState().submitSetupMonsterQuery(symptomQuery);
              useSaySeeStore.getState().setShowSetupMonsterModal(true, layout === 'mobile' ? 'mobile' : 'pc');
            }}
            onJumpToSearch={(kw) => {
              if (layout === 'mobile') {
                setMobileTab('search');
                const cleanKw = kw.trim();
                if (cleanKw) {
                  void runTextQuery(cleanKw).then(() => {
                    window.setTimeout(() => {
                      document
                        .getElementById('ghosti-search-results')
                        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 80);
                  });
                } else {
                  window.setTimeout(() => {
                    const searchInput = document.getElementById(
                      'ghosti-voice-hero-search-input'
                    ) as HTMLInputElement | null;
                    searchInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    searchInput?.focus();
                  }, 120);
                }
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

