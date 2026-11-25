import React, { useEffect, useState } from 'react';
import { useSaySeeStore } from '../../store/useSaySeeStore';
import type { PhotoItem, TrashCategory } from '../../types/saysee';
import {
  PC_OPTICAL_AUDIT_EVENT,
  auditRealPcPhotosAndCluster,
  isPcOpticalAuditInProgress,
} from '../../services/mobilePhotoPicker';
import {
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
  subtitle: string;
}[] = [
  {
    key: 'duplicate',
    stepNum: '1',
    title: '중복 · 연사 사진',
    shortTitle: '중복 · 연사 사진',
    shortBadge: '중복·연사',
    subtitle: '원본 1장만 남기고 정리',
  },
  {
    key: 'memo',
    stepNum: '2',
    title: '주차 · 영수증 · 메모',
    shortTitle: '주차 · 영수증 · 메모',
    shortBadge: '메모·영수증',
    subtitle: '주차장·단기 메모 정리',
  },
  {
    key: 'screenshot',
    stepNum: '3',
    title: '스크린샷 · 캡처',
    shortTitle: '스크린샷 · 캡처',
    shortBadge: '스크린샷',
    subtitle: '문자·화면 캡처 정리',
  },
  {
    key: 'blurry',
    stepNum: '4',
    title: '흔들림 · 오촬영',
    shortTitle: '흔들림 · 오촬영',
    shortBadge: '흔들림',
    subtitle: '흐릿하거나 잘못 찍힌 사진',
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
    restoreFromQuarantine,
    quarantineMoving,
    quarantineOpKind,
    quarantineRestoreScope,
    quarantineRestoringIds,
    setSelectedPhoto,
    lastUndoBatch,
    lastQuarantineToast,
    undoLastQuarantine,
    dismissUndoBatch,
    setDesktopTab,
    setMobileTab,
    runTextQuery,
    initialized,
    initializing,
    isStoreAppMode,
    mobileGalleryScanning,
    mobileGalleryPermissionDenied,
    mobileGalleryLimitedAccess,
    syncMobileNativeGalleryAuto,
    pendingReturnShareRoom,
    returnToSharedRoomAndOpenUpload,
  } = useSaySeeStore();

  const [pcAuditBusy, setPcAuditBusy] = useState(() => isPcOpticalAuditInProgress());
  useEffect(() => {
    const syncAudit = () => setPcAuditBusy(isPcOpticalAuditInProgress());
    window.addEventListener(PC_OPTICAL_AUDIT_EVENT, syncAudit);
    return () => window.removeEventListener(PC_OPTICAL_AUDIT_EVENT, syncAudit);
  }, []);
  const isPcBootLoading = !(isStoreAppMode || layout === 'mobile') && (!initialized || initializing || pcAuditBusy);

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
  const [setJumpInput, setSetJumpInput] = useState<string>('1');
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
      setSetJumpInput('1');
      return;
    }
    const clamped = Math.min(activeDupSetIdx, Math.max(0, activeDuplicateGroups.length - 1));
    setSetJumpInput(String(clamped + 1));
  }, [activeDupSetIdx, activeDuplicateGroups.length]);

  React.useEffect(() => {
    if (
      !zConnected ||
      isStoreAppMode ||
      layout === 'mobile' ||
      pcAuditBusy ||
      skippedGroupIds.size > 0 ||
      dupCount === 0 ||
      activeDuplicateGroups.length > 0
    ) {
      return;
    }
    const tid = window.setTimeout(() => {
      if (isPcOpticalAuditInProgress()) return;
      const cur = useSaySeeStore.getState();
      void auditRealPcPhotosAndCluster(cur.photos).then(({ updatedPhotos, duplicateGroups: nextGroups }) => {
        const nextTrash = new Set<string>();
        updatedPhotos.forEach((p) => {
          if (p.trashCategory && !p.quarantined) nextTrash.add(p.id);
        });
        useSaySeeStore.setState({
          photos: updatedPhotos,
          duplicateGroups: nextGroups,
          selectedTrashIds: nextTrash,
        });
      });
    }, 180);
    return () => window.clearTimeout(tid);
  }, [zConnected, isStoreAppMode, layout, pcAuditBusy, skippedGroupIds.size, dupCount, activeDuplicateGroups.length]);

  const showDuplicatePickSection = currentTab === 'duplicate';
  const zCoreOutdated = zConnected && isZCoreOutdated(zVersion);

  return (
    <div
      className={
        layout === 'mobile'
          ? 'w-full flex flex-col gap-3.5'
          : 'w-full max-w-[1640px] mx-auto px-4 sm:px-6 md:px-8 py-6 flex flex-col gap-5 pb-20'
      }
    >
      {pendingReturnShareRoom && (
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[14px] font-bold text-slate-900">
              ‘{pendingReturnShareRoom.roomTitle}’에 사진 추가하기
            </span>
            <span className="text-[12.5px] text-slate-600">
              {zConnected
                ? '내 컴퓨터 연결이 완료되었습니다. 공유방으로 돌아가 사진을 선택해 올릴 수 있습니다.'
                : '오른쪽 귀신비서 대화창에서 내 컴퓨터를 연결하면 바로 공유방으로 돌아갈 수 있습니다.'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void returnToSharedRoomAndOpenUpload()}
            className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12.5px] font-semibold transition-colors cursor-pointer whitespace-nowrap"
          >
            {zConnected
              ? `‘${pendingReturnShareRoom.roomTitle}’으로 이동해 사진 올리기`
              : `‘${pendingReturnShareRoom.roomTitle}’으로 돌아가기`}
          </button>
        </div>
      )}

      {zCoreOutdated && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex flex-wrap items-center justify-between gap-3">
          <span className="text-[13.5px] text-amber-900 font-semibold">
            실행 중인 PC 엔진(v{zCoreBridge.version || '구버전'})을 최신 버전(v{LATEST_Z_CORE_VERSION})으로 업데이트해 주세요.
          </span>
          <a
            href={Z_CORE_ZIP_URL}
            download="Merlin_Z_Core.zip"
            className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12.5px] font-semibold whitespace-nowrap cursor-pointer"
          >
            최신 PC 엔진 다운로드 (v{LATEST_Z_CORE_VERSION})
          </a>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* 좌측: 사진 정리 및 PC 관리 워크스페이스 */}
        <GhostSecretaryFirstGuard
          context="secretary_left"
          className="xl:col-span-7 2xl:col-span-8 flex flex-col gap-4 min-w-0"
        >
          <PassportRegistrationPanel />

          <section className="p-4 sm:p-5 rounded-xl bg-white border border-slate-200 flex flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-[18px] sm:text-[20px] text-slate-900 font-bold tracking-tight">
                    귀신비서
                  </h1>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-[11px] font-semibold">
                    확인 후 승인 시에만 정리 · 복원 지원
                  </span>
                </div>
                <p className="text-[12.5px] sm:text-[13px] text-slate-500 break-keep leading-relaxed">
                  {isStoreAppMode || layout === 'mobile'
                    ? '중복·연사 사진과 영수증·캡처·흔들린 사진을 분류해 보여드리며, 직접 확인한 사진만 안전하게 정리합니다.'
                    : '상주 보안프로그램 절전 관리, 중복·흔들린 사진 정리, 삭제된 파일 복원을 한곳에서 처리합니다.'}
                </p>

                {isCapacitorNativeMobileRuntime() && mobileGalleryScanning && (
                  <span className="text-[12px] text-slate-600 font-medium pt-0.5">
                    사진첩을 확인하고 있습니다...
                  </span>
                )}
                {isCapacitorNativeMobileRuntime() && mobileGalleryPermissionDenied && (
                  <button
                    type="button"
                    onClick={() => void openNativeAppPermissionSettings()}
                    className="self-start mt-1 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12px] font-semibold cursor-pointer"
                  >
                    사진 접근 권한 허용하기
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 shrink-0" data-allow-secretary-jump="true">
                {!(isStoreAppMode || layout === 'mobile') && (
                  <button
                    type="button"
                    data-allow-secretary-jump="true"
                    onClick={() => window.dispatchEvent(new CustomEvent('ghosti_navigate_showroom'))}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-[12px] cursor-pointer"
                  >
                    서비스 소개 보기
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
                      className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12px] font-semibold disabled:opacity-40 cursor-pointer"
                    >
                      남은 사진 정리 펼치기 ({liveActiveTrash.length}장)
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
                      className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 text-[12px] font-medium disabled:opacity-40 cursor-pointer"
                    >
                      {quarantineMoving && liveActiveTrash.length > 10
                        ? '정리 일시 중지'
                        : '나중에 정리'}
                    </button>
                  ))}
              </div>
            </div>

            <div className="text-[14.5px] sm:text-[15.5px] text-slate-900 font-semibold leading-snug break-keep">
              {activeTrash.length > 0 ? (
                <>
                  정리 후보 <span className="font-bold text-teal-700">{activeTrash.length}장</span>{' '}
                  <span className="text-slate-400 font-normal text-[13.5px]">
                    ({fmtMB(totalTrashBytes)})
                  </span>{' '}
                  <span className="text-slate-500 font-normal text-[13.5px]">
                    · 중복·연사 {dupCount}장 · 메모·캡처 {memoAndScreenCount}장 · 흔들림 {blurryCount}장
                  </span>
                </>
              ) : (isStoreAppMode || layout === 'mobile') &&
                displayPhotos.length === 0 &&
                quarantinedPhotos.length === 0 ? (
                <span className="text-slate-600 font-medium text-[13.5px]">
                  {mobileGalleryScanning
                    ? '사진첩에서 중복·연사·흔들린 사진을 확인하고 있습니다...'
                    : mobileGalleryPermissionDenied
                    ? '사진 접근 권한을 허용하면 사진 정리와 검색을 시작할 수 있습니다.'
                    : isCapacitorNativeMobileRuntime()
                    ? '표시할 사진이 없습니다.'
                    : '스마트폰 앱에서 사진첩 접근을 허용하면 자동으로 분류됩니다.'}
                </span>
              ) : isPcBootLoading && quarantinedPhotos.length === 0 ? (
                <span className="text-slate-600 font-medium text-[13.5px]">
                  내 PC의 정리 후보 사진(중복·연사·캡처·흔들림)을 불러오고 있습니다...
                </span>
              ) : (
                <span className="text-slate-700 font-medium text-[14px]">
                  정리할 사진 후보가 없습니다 (정리 완료 {quarantinedPhotos.length}장)
                </span>
              )}
            </div>
          </section>

          {!(isStoreAppMode || layout === 'mobile') && (
            <section
              data-allow-secretary-jump="true"
              aria-label="PC 관리 주요 기능"
              className="p-4 sm:p-5 rounded-xl bg-white border border-slate-200 flex flex-col gap-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <span className="text-[13.5px] font-bold text-slate-900">
                  PC 관리 빠른 실행
                </span>
                <span className="text-[12px] text-slate-500">
                  클릭하면 오른쪽 대화창에서 진단 후 승인 여부를 묻습니다
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-[12.5px]">
                <div className="p-3.5 rounded-lg bg-teal-50/45 border border-teal-200/75 flex flex-col justify-between gap-2.5">
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-teal-950">
                      은행·관공서 보안앱 절전
                    </span>
                    <span className="text-slate-600 leading-relaxed text-[12px]">
                      평소에는 보안모듈을 절전 상태로 두고, 은행·관공서 이용 시에만 깨웁니다.
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        window.dispatchEvent(
                          new CustomEvent('ghosti_toss_to_monster_chat', {
                            detail: { query: '은행·관공서 보안절전' },
                          })
                        )
                      }
                      className="px-2.5 py-1 rounded-md bg-teal-600 hover:bg-teal-700 text-white font-semibold text-[11.5px] cursor-pointer"
                    >
                      보안앱 절전
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        window.dispatchEvent(
                          new CustomEvent('ghosti_toss_to_monster_chat', {
                            detail: { query: '보안프로그램 즉시 깨우기' },
                          })
                        )
                      }
                      className="px-2.5 py-1 rounded-md bg-white hover:bg-teal-50 border border-teal-200 text-teal-800 font-medium text-[11.5px] cursor-pointer"
                    >
                      다시 깨우기
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
                  className="text-left p-3.5 rounded-lg bg-sky-50/45 hover:bg-sky-50/80 border border-sky-200/75 flex flex-col justify-between gap-2.5 cursor-pointer transition-colors"
                >
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-sky-950">
                      Windows 기본 백신 점검
                    </span>
                    <span className="text-slate-600 leading-relaxed text-[12px]">
                      별도 광고형 백신 없이 Windows 기본 보안 상태로 다운로드 파일을 점검합니다.
                    </span>
                  </div>
                  <span className="inline-flex self-start px-2.5 py-1 rounded-md bg-white border border-sky-200 text-sky-700 font-medium text-[11.5px]">
                    빠른 백신 검사
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent('ghosti_toss_to_monster_chat', {
                        detail: { query: '미저장 문서·휴지통 구출' },
                      })
                    )
                  }
                  className="text-left p-3.5 rounded-lg bg-amber-50/45 hover:bg-amber-50/80 border border-amber-200/75 flex flex-col justify-between gap-2.5 cursor-pointer transition-colors"
                >
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-amber-950">
                      미저장 문서 · 휴지통 복원
                    </span>
                    <span className="text-slate-600 leading-relaxed text-[12px]">
                      저장하지 않고 닫은 문서 임시본이나 최근 삭제한 파일을 찾아 원래 위치로 복원합니다.
                    </span>
                  </div>
                  <span className="inline-flex self-start px-2.5 py-1 rounded-md bg-white border border-amber-200 text-amber-800 font-medium text-[11.5px]">
                    파일 복원 찾기
                  </span>
                </button>
              </div>
            </section>
          )}

          {mobileGalleryLimitedAccess && isCapacitorNativeMobileRuntime() && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex flex-col gap-0.5 w-full md:flex-1 min-w-0">
                <span className="text-[13px] font-bold text-amber-950 break-keep">
                  현재 사진 접근 권한이 ‘선택한 사진만 허용’으로 설정되어 있습니다 ({displayPhotos.length}장 허용됨)
                </span>
                <span className="text-[12px] text-amber-900 break-keep">
                  전체 사진을 정리하려면 설정에서 전체 허용으로 변경하거나 사진을 추가 선택해 주세요.
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
                  className="py-2 px-3 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12px] font-semibold cursor-pointer whitespace-nowrap"
                >
                  사진 추가 선택
                </button>
                <button
                  type="button"
                  onClick={() => void openNativeAppPermissionSettings()}
                  className="py-2 px-3 rounded-lg bg-white hover:bg-slate-50 border border-amber-300 text-amber-950 text-[12px] font-medium cursor-pointer whitespace-nowrap"
                >
                  설정에서 전체 허용
                </button>
              </div>
            </div>
          )}

          {/* 4열 사진 정리 카테고리 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
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

              const palette =
                tab.key === 'duplicate'
                  ? {
                      active: 'bg-teal-600 border-teal-600 text-white shadow-xs',
                      idle: 'bg-white hover:bg-teal-50/40 border-slate-200 hover:border-teal-300 text-slate-900',
                      step: isSelected ? 'text-teal-100' : 'text-teal-600',
                      sub: isSelected ? 'text-teal-100' : 'text-slate-500',
                      borderTop: isSelected ? 'border-teal-500/70' : 'border-slate-100',
                    }
                  : tab.key === 'memo'
                  ? {
                      active: 'bg-amber-600 border-amber-600 text-white shadow-xs',
                      idle: 'bg-white hover:bg-amber-50/40 border-slate-200 hover:border-amber-300 text-slate-900',
                      step: isSelected ? 'text-amber-100' : 'text-amber-600',
                      sub: isSelected ? 'text-amber-100' : 'text-slate-500',
                      borderTop: isSelected ? 'border-amber-500/70' : 'border-slate-100',
                    }
                  : tab.key === 'screenshot'
                  ? {
                      active: 'bg-sky-600 border-sky-600 text-white shadow-xs',
                      idle: 'bg-white hover:bg-sky-50/40 border-slate-200 hover:border-sky-300 text-slate-900',
                      step: isSelected ? 'text-sky-100' : 'text-sky-600',
                      sub: isSelected ? 'text-sky-100' : 'text-slate-500',
                      borderTop: isSelected ? 'border-sky-500/70' : 'border-slate-100',
                    }
                  : {
                      active: 'bg-rose-600 border-rose-600 text-white shadow-xs',
                      idle: 'bg-white hover:bg-rose-50/40 border-slate-200 hover:border-rose-300 text-slate-900',
                      step: isSelected ? 'text-rose-100' : 'text-rose-600',
                      sub: isSelected ? 'text-rose-100' : 'text-slate-500',
                      borderTop: isSelected ? 'border-rose-500/70' : 'border-slate-100',
                    };

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
                  className={`text-left cursor-pointer rounded-xl p-3.5 transition-colors flex flex-col justify-between gap-2 border min-w-0 overflow-hidden ${
                    isSelected ? palette.active : palette.idle
                  }`}
                >
                  <div className="flex flex-col gap-1 w-full min-w-0">
                    <div className="flex items-center justify-between gap-1 w-full min-w-0">
                      <span className={`text-[11.5px] font-bold ${palette.step}`}>
                        0{tab.stepNum}
                      </span>
                      <span
                        className={`text-[10.5px] font-medium ${
                          isSelected ? 'text-white/90' : 'text-slate-400'
                        }`}
                      >
                        {isSelected ? '접기' : '보기'}
                      </span>
                    </div>

                    <span className="text-[13.5px] sm:text-[14px] font-bold tracking-tight break-keep leading-snug">
                      {tab.shortTitle}
                    </span>

                    <span className={`text-[11.5px] break-keep leading-snug ${palette.sub}`}>
                      {tab.subtitle}
                    </span>
                  </div>

                  {sampleThumbs.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5 min-w-0">
                      {sampleThumbs.map((sp) => (
                        <div
                          key={sp.id}
                          className="w-8 h-8 rounded overflow-hidden border border-slate-200 bg-slate-100 shrink-0"
                        >
                          <img
                            crossOrigin="anonymous"
                            src={sp.thumbUrl}
                            alt=""
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <div className={`flex flex-wrap items-center justify-between gap-1 pt-2 border-t w-full min-w-0 ${palette.borderTop}`}>
                    <div className="flex items-baseline gap-1 whitespace-nowrap">
                      <span className="text-[15px] font-bold tabular-nums">
                        {items.length}
                      </span>
                      <span className={`text-[11px] ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>장</span>
                      {tab.key === 'duplicate' && activeDuplicateGroups.length > 0 && (
                        <span className={`text-[11px] font-medium ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                          · {activeDuplicateGroups.length}세트
                        </span>
                      )}
                    </div>

                    <span className={`text-[11px] tabular-nums ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                      {fmtMB(bytes)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {currentTab === 'none' && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <span className="text-[13px] text-slate-600 font-medium">
                {isCleanupPaused
                  ? '사진 정리를 잠시 멈추었습니다. 위 항목을 누르면 언제든 다시 이어서 정리할 수 있습니다.'
                  : '위 4개 항목 중 하나를 선택하면 정리 후보 사진을 확인할 수 있습니다.'}
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsCleanupPaused(false);
                    setPausedSnapshot(null);
                    setActiveTrashCategoryFilter('duplicate');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[12px] font-medium cursor-pointer"
                >
                  중복·연사 보기 ({activeDuplicateGroups.length}세트)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCleanupPaused(false);
                    setPausedSnapshot(null);
                    setActiveTrashCategoryFilter('all');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12px] font-semibold cursor-pointer"
                >
                  전체 후보 보기 ({liveActiveTrash.length}장)
                </button>
              </div>
            </div>
          )}

          {/* 중복·연사 세트별 정리 */}
          {showDuplicatePickSection && (
            <div className="p-4 sm:p-5 rounded-xl bg-white border border-slate-200 flex flex-col gap-4">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 border-b border-slate-100 pb-3.5">
                <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[16px] md:text-[17px] text-slate-900 font-bold break-keep">
                      중복 · 연사 묶음 확인
                    </h2>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[12px] font-medium">
                      {activeDuplicateGroups.length > 0
                        ? `${activeDuplicateGroups.length}세트 · 정리 후보 ${dupCount}장`
                        : '0세트'}
                    </span>
                  </div>
                  {activeDuplicateGroups.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {activeDuplicateGroups.length > 1 && (() => {
                        const totalSets = activeDuplicateGroups.length;
                        const clampedIdx = Math.min(activeDupSetIdx, Math.max(0, totalSets - 1));
                        const curGroup = activeDuplicateGroups[clampedIdx];
                        const curCnt = curGroup
                          ? curGroup.photoIds.filter((id) => {
                              const ph = photoById.get(id);
                              return ph && !ph.quarantined;
                            }).length
                          : 0;
                        const commitJump = (rawVal?: string) => {
                          const parsed = parseInt(String(rawVal ?? setJumpInput).replace(/[^0-9]/g, ''), 10);
                          if (!Number.isFinite(parsed)) {
                            setSetJumpInput(String(clampedIdx + 1));
                            return;
                          }
                          const targetNum = Math.min(totalSets, Math.max(1, parsed));
                          setShowAllDupSets(false);
                          setActiveDupSetIdx(targetNum - 1);
                          setSetJumpInput(String(targetNum));
                        };
                        const goToSet = (nextIdx: number) => {
                          const safeIdx = Math.min(totalSets - 1, Math.max(0, nextIdx));
                          setShowAllDupSets(false);
                          setActiveDupSetIdx(safeIdx);
                          setSetJumpInput(String(safeIdx + 1));
                        };
                        return (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              disabled={clampedIdx <= 0}
                              onClick={() => goToSet(clampedIdx - 1)}
                              className="px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 text-[12px] font-medium cursor-pointer whitespace-nowrap"
                            >
                              ‹ 이전
                            </button>
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                commitJump();
                              }}
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-slate-200 bg-slate-50"
                            >
                              <input
                                type="text"
                                inputMode="numeric"
                                aria-label="이동할 세트 번호"
                                value={setJumpInput}
                                onFocus={(e) => e.currentTarget.select()}
                                onChange={(e) => setSetJumpInput(e.target.value.replace(/[^0-9]/g, ''))}
                                onBlur={() => commitJump()}
                                className="w-11 px-1.5 py-0.5 rounded bg-white border border-slate-200 text-center text-[12px] font-semibold text-slate-900 focus:outline-none focus:border-slate-500"
                              />
                              <span className="text-[12px] text-slate-500 font-medium whitespace-nowrap">
                                / {totalSets} 세트
                              </span>
                              <button
                                type="submit"
                                className="px-2 py-0.5 rounded bg-teal-600 hover:bg-teal-700 text-white text-[11.5px] font-semibold cursor-pointer whitespace-nowrap"
                              >
                                이동
                              </button>
                            </form>
                            <button
                              type="button"
                              disabled={clampedIdx >= totalSets - 1}
                              onClick={() => goToSet(clampedIdx + 1)}
                              className="px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 text-[12px] font-medium cursor-pointer whitespace-nowrap"
                            >
                              다음 ›
                            </button>
                            <span className="text-[11.5px] text-slate-400 ml-1 whitespace-nowrap">
                              현재 세트 {curCnt}장
                            </span>
                          </div>
                        );
                      })()}
                      <p className="text-[12.5px] text-slate-500 leading-relaxed break-keep">
                        남길 대표 사진 1장을 확인한 뒤 [휴지통으로 이동]을 눌러 정리하세요. 다른 사진을 터치하면 대표 사진이 바뀝니다.
                      </p>
                    </div>
                  ) : (
                    <p className="text-[12.5px] text-slate-500">
                      {isPcBootLoading || dupCount > 0
                        ? '중복·연사 사진 묶음을 확인하고 있습니다...'
                        : '정리할 중복·연사 사진 묶음이 없습니다.'}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 shrink-0 self-start">
                  {activeDuplicateGroups.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setShowAllDupSets((v) => !v)}
                      className="px-3 py-1.5 rounded-lg text-[12px] font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer whitespace-nowrap"
                    >
                      {showAllDupSets ? '1세트씩 보기' : `전체 ${activeDuplicateGroups.length}세트 펼치기`}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveTrashCategoryFilter('none')}
                    className="px-3 py-1.5 rounded-lg text-[12px] font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 cursor-pointer whitespace-nowrap"
                  >
                    접기
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
                      repPhoto?.tags.find((t) => !t.includes('연사') && !t.includes('원본')) || '연사 묶음';

                    return (
                      <div
                        key={group.groupId}
                        className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-3.5"
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                          <div className="flex flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-teal-600 text-white text-[11px] font-semibold">
                                세트 {gIdx + 1} / {activeDuplicateGroups.length} ({groupPhotos.length}장)
                              </span>
                              <span className="text-[11.5px] text-slate-500 font-medium">
                                {sceneLabel}
                              </span>
                            </div>
                            <p className="text-[13.5px] text-slate-900 font-semibold leading-snug break-keep">
                              선택된 대표 사진 1장만 남기고 나머지 {redundantCount}장을 휴지통으로 이동합니다.
                            </p>
                            <span className="text-[11.5px] text-slate-500 break-keep">
                              {isStoreAppMode || layout === 'mobile'
                                ? !zCoreBridge.isConnected && isCapacitorIosRuntime()
                                  ? '아이폰 ‘사진 → 최근 삭제된 항목’으로 이동하며 30일간 복원할 수 있습니다.'
                                  : '스마트폰 휴지통(30일 보관)으로 이동하며 아래 복원 목록에서 되돌릴 수 있습니다.'
                                : '시스템 휴지통으로 이동하며 아래 복원 목록에서 언제든 원래 위치로 되돌릴 수 있습니다.'}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 w-full lg:w-auto">
                            {!showAllDupSets && activeDuplicateGroups.length > 1 && (
                              <div className="flex items-center gap-1 mr-1">
                                <button
                                  type="button"
                                  disabled={gIdx <= 0}
                                  onClick={() => setActiveDupSetIdx((prev) => Math.max(0, prev - 1))}
                                  className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11.5px] font-medium disabled:opacity-40 cursor-pointer"
                                >
                                  이전
                                </button>
                                <button
                                  type="button"
                                  disabled={gIdx >= activeDuplicateGroups.length - 1}
                                  onClick={() =>
                                    setActiveDupSetIdx((prev) =>
                                      Math.min(activeDuplicateGroups.length - 1, prev + 1)
                                    )
                                  }
                                  className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11.5px] font-medium disabled:opacity-40 cursor-pointer"
                                >
                                  다음
                                </button>
                              </div>
                            )}

                            <button
                              type="button"
                              disabled={quarantineMoving}
                              onClick={() =>
                                void pickBestInDuplicateGroup(group.groupId, group.bestPhotoId, true)
                              }
                              className="w-full sm:w-auto px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12.5px] font-semibold transition-colors cursor-pointer"
                            >
                              1장 남기고 {redundantCount}장 휴지통 이동
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
                              className="w-full sm:w-auto px-3 py-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 text-[12px] font-medium cursor-pointer"
                            >
                              건너뛰기
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                          {groupPhotos.map((ph, idx) => {
                            const isBestOriginal = ph.id === group.bestPhotoId;
                            return (
                              <div
                                key={ph.id}
                                data-keep-dark="true"
                                onClick={() =>
                                  void pickBestInDuplicateGroup(group.groupId, ph.id, false)
                                }
                                className={`group/card relative aspect-[4/5] rounded-lg overflow-hidden cursor-pointer bg-zinc-950 transition-all ${
                                  isBestOriginal
                                    ? 'ring-2 ring-slate-900 border-2 border-slate-900'
                                    : 'border border-slate-200 opacity-85 hover:opacity-100'
                                }`}
                              >
                                <img
                            crossOrigin="anonymous"
                                  src={ph.thumbUrl}
                                  alt={ph.name}
                                  loading="lazy"
                                  className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-300"
                                />

                                <div
                                  className={`absolute top-2 left-2 px-2 py-0.5 rounded text-[10.5px] font-semibold ${
                                    isBestOriginal
                                      ? 'bg-white text-slate-900 shadow-xs'
                                      : 'bg-black/70 text-white'
                                  }`}
                                >
                                  {isBestOriginal ? '보존 (대표 1장)' : `정리 후보 #${idx + 1}`}
                                </div>

                                <div className="absolute inset-x-0 bottom-0 px-2.5 py-1.5 bg-gradient-to-t from-black/85 via-black/45 to-transparent flex items-center justify-between">
                                  <span className="text-[10.5px] text-zinc-200 truncate pr-6">
                                    {ph.name}
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedPhoto(ph, groupPhotos);
                                  }}
                                  title="크게 보기"
                                  className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center transition-colors z-10 cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[15px]">zoom_in</span>
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
                <div className="p-8 rounded-xl bg-slate-50 border border-slate-200 text-center flex flex-col items-center gap-2">
                  <span className="material-symbols-outlined text-slate-400 text-[30px]">
                    {displayPhotos.length === 0 && (isStoreAppMode || layout === 'mobile')
                      ? 'add_photo_alternate'
                      : isPcBootLoading || dupCount > 0
                      ? 'hourglass_top'
                      : 'verified'}
                  </span>
                  <span className="text-[14.5px] text-slate-800 font-semibold break-keep">
                    {displayPhotos.length === 0 && (isStoreAppMode || layout === 'mobile')
                      ? mobileGalleryScanning
                        ? '사진첩을 확인하고 있습니다...'
                        : mobileGalleryPermissionDenied
                        ? '사진 접근 권한 허용이 필요합니다.'
                        : '표시할 사진이 없습니다.'
                      : isPcBootLoading || dupCount > 0
                      ? '내 PC의 중복·연사 사진 묶음을 확인하고 있습니다...'
                      : '중복되거나 연속으로 찍힌 사진 묶음이 없습니다.'}
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
                        className="mt-1 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12.5px] font-semibold cursor-pointer"
                      >
                        {mobileGalleryPermissionDenied ? '사진 접근 권한 허용' : '사진첩 다시 확인'}
                      </button>
                    )}
                  {skippedGroupIds.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setSkippedGroupIds(new Set())}
                      className="mt-1 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[12px] font-medium cursor-pointer"
                    >
                      건너뛴 세트({skippedGroupIds.size}개) 다시 보기
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 메모·영수증 / 스크린샷 / 흔들림 탭 */}
          {currentTab !== 'duplicate' && currentTab !== 'none' && (
            <section className="p-4 sm:p-5 rounded-xl bg-white border border-slate-200 flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[16px] text-slate-900 font-bold">
                    {TRASH_TABS_4.find((t) => t.key === currentTab)?.title || '전체 정리 후보'}
                  </h2>
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[12px] font-medium">
                    {isShowingSamplePreview
                      ? `샘플 ${filteredCandidates.length}장`
                      : `${filteredCandidates.length}장`}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setActiveTrashCategoryFilter('duplicate')}
                    className="px-3 py-1.5 rounded-lg text-[12px] font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer"
                  >
                    중복·연사 ({activeDuplicateGroups.length}세트)
                  </button>
                  {!isShowingSamplePreview && realFilteredCandidates.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={selectAllTrashInFilter}
                        className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[12px] font-medium cursor-pointer"
                      >
                        전체 선택
                      </button>
                      <button
                        type="button"
                        onClick={clearTrashSelection}
                        className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 text-[12px] cursor-pointer"
                      >
                        선택 해제
                      </button>
                      <button
                        type="button"
                        disabled={activeSelectedPhotos.length === 0 || quarantineMoving}
                        onClick={() => void moveSelectedToQuarantine()}
                        className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12px] font-semibold disabled:opacity-40 cursor-pointer"
                      >
                        선택한 {activeSelectedPhotos.length}장 ({fmtMB(selectedBytes)}) 휴지통 이동
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveTrashCategoryFilter('none')}
                    className="px-3 py-1.5 rounded-lg text-[12px] font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 cursor-pointer"
                  >
                    접기
                  </button>
                </div>
              </div>

              {filteredCandidates.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {filteredCandidates.map((photo) => {
                    const isChecked = selectedTrashIds.has(photo.id);
                    const tabMeta =
                      TRASH_TABS_4.find((t) => matchesTrashTab(photo, t.key)) || TRASH_TABS_4[1];

                    return (
                      <div
                        key={photo.id}
                        data-keep-dark="true"
                        onClick={() => setSelectedPhoto(photo, filteredCandidates)}
                        className={`group relative rounded-lg overflow-hidden bg-zinc-950 transition-all cursor-pointer border ${
                          isChecked
                            ? 'border-slate-900 ring-2 ring-slate-900'
                            : 'border-slate-200 opacity-90 hover:opacity-100'
                        }`}
                      >
                        <div className="relative aspect-[4/5] w-full overflow-hidden bg-zinc-950">
                          <img
                            crossOrigin="anonymous"
                            src={photo.thumbUrl}
                            alt={photo.name}
                            loading="lazy"
                            onError={(e) => {
                              const imgEl = e.currentTarget;
                              const retryCount = Number(imgEl.dataset.retry || '0');
                              if (retryCount >= 2) return;
                              imgEl.dataset.retry = String(retryCount + 1);
                              const baseUrl =
                                retryCount === 0 && photo.thumbUrl
                                  ? photo.thumbUrl
                                  : photo.fullUrl || photo.thumbUrl;
                              if (!baseUrl) return;
                              const sep = baseUrl.includes('?') ? '&' : '?';
                              window.setTimeout(() => {
                                imgEl.src = `${baseUrl}${sep}_r=${retryCount + 1}`;
                              }, 600 * (retryCount + 1));
                            }}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />

                          <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/75">
                            <span className="text-[10.5px] font-medium text-white">
                              {tabMeta.shortBadge}
                            </span>
                          </div>

                          {!isShowingSamplePreview && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleTrashSelection(photo.id);
                              }}
                              title={isChecked ? '선택 해제' : '선택'}
                              className={`absolute top-2 right-2 w-7 h-7 rounded-md flex items-center justify-center transition-colors z-10 cursor-pointer ${
                                isChecked
                                  ? 'bg-white text-slate-900 font-bold shadow-xs'
                                  : 'bg-black/65 hover:bg-black/85 border border-white/25 text-white/60 hover:text-white'
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
                            title="크게 보기"
                            className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center transition-colors z-10 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[15px]">zoom_in</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 rounded-xl bg-slate-50 border border-slate-200 text-center flex flex-col items-center gap-2">
                  <span className="material-symbols-outlined text-slate-400 text-[30px]">verified</span>
                  <span className="text-[14.5px] text-slate-800 font-semibold break-keep">
                    이 항목에 정리할 사진이 없습니다.
                  </span>
                </div>
              )}
            </section>
          )}

          {/* 정리한 사진 복원 */}
          {(quarantinedPhotos.length > 0 || lastUndoBatch || lastQuarantineToast) && (() => {
            const isIosNativeTrash = !zCoreBridge.isConnected && isCapacitorIosRuntime();
            return (
              <section
                id="ghosti-quarantine-restore-section"
                className="p-4 sm:p-5 rounded-xl bg-white border border-slate-200 flex flex-col gap-3"
              >
                {lastQuarantineToast && (
                  <div className="px-3.5 py-2.5 rounded-lg bg-teal-50/70 border border-teal-200/80 flex items-center justify-between gap-2 text-[12.5px] text-teal-900 font-medium">
                    <span className="whitespace-pre-line break-keep leading-relaxed">{lastQuarantineToast}</span>
                    <button
                      type="button"
                      onClick={() => useSaySeeStore.setState({ lastQuarantineToast: null })}
                      className="text-teal-700 hover:text-teal-950 text-[12px] font-semibold shrink-0 cursor-pointer"
                    >
                      닫기
                    </button>
                  </div>
                )}
                {lastUndoBatch && !isIosNativeTrash && (
                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-[13px] text-slate-800 font-medium break-keep">
                      방금 정리한 {lastUndoBatch.count}장({fmtMB(lastUndoBatch.savedBytes)})이 휴지통으로 이동되었습니다.
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={quarantineMoving}
                        onClick={() => void undoLastQuarantine()}
                        className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12px] font-semibold cursor-pointer disabled:opacity-70 disabled:cursor-wait inline-flex items-center gap-1.5"
                      >
                        {quarantineMoving && quarantineOpKind === 'restore' && quarantineRestoreScope === 'undo' && (
                          <span className="inline-block w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                        )}
                        {quarantineMoving && quarantineOpKind === 'restore' && quarantineRestoreScope === 'undo' ? '복원 중...' : '되돌리기'}
                      </button>
                      <button
                        type="button"
                        onClick={dismissUndoBatch}
                        className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                        title="닫기"
                      >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                      </button>
                    </div>
                  </div>
                )}

                {isIosNativeTrash && quarantinedPhotos.length > 0 && (
                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                    <p className="text-[12.5px] text-slate-700 leading-relaxed break-keep">
                      아이폰 보안 정책에 따라 ‘사진 → 최근 삭제된 항목’에 30일간 보관되며, 해당 메뉴에서 원본을 복원할 수 있습니다.
                    </p>
                  </div>
                )}

                {quarantinedPhotos.length > 0 && (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setShowQuarantineDrawer((v) => !v)}
                        className="w-full sm:w-auto px-3.5 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 text-[12.5px] font-semibold flex items-center justify-between gap-2.5 cursor-pointer"
                      >
                        <span>
                          {isIosNativeTrash
                            ? `최근 정리 내역 (${quarantinedPhotos.length}장)`
                            : `정리한 사진 복원 (${quarantinedPhotos.length}장)`}
                        </span>
                        <span className="text-slate-500 text-[11.5px]">
                          {showQuarantineDrawer ? '접기' : '목록 펼치기'}
                        </span>
                      </button>
                      {!isIosNativeTrash && (
                        <button
                          type="button"
                          disabled={quarantineMoving}
                          onClick={() =>
                            void restoreFromQuarantine(
                              quarantinedPhotos.map((p) => p.id),
                              'all'
                            )
                          }
                          className="px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12px] font-semibold cursor-pointer disabled:opacity-70 disabled:cursor-wait inline-flex items-center gap-1.5"
                        >
                          {quarantineMoving && quarantineOpKind === 'restore' && quarantineRestoreScope === 'all' && (
                            <span className="inline-block w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                          )}
                          {quarantineMoving && quarantineOpKind === 'restore' && quarantineRestoreScope === 'all'
                            ? '전체 복원 중...'
                            : `전체 복원 (${quarantinedPhotos.length}장)`}
                        </button>
                      )}
                    </div>

                    {showQuarantineDrawer && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200 max-h-64 overflow-y-auto">
                        {quarantinedPhotos.map((qp) => {
                          const isThisRowRestoring =
                            quarantineMoving &&
                            quarantineOpKind === 'restore' &&
                            quarantineRestoreScope === 'single' &&
                            (quarantineRestoringIds.includes(qp.id) || quarantineRestoringIds.includes(qp.name));
                          return (
                            <div
                              key={qp.id}
                              className="p-2 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-2.5"
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <img
                                  crossOrigin="anonymous"
                                  src={qp.thumbUrl}
                                  alt=""
                                  loading="lazy"
                                  className="w-9 h-9 rounded object-cover border border-slate-200 shrink-0 bg-slate-100"
                                />
                                <span className="text-[11.5px] text-slate-800 font-medium break-all leading-snug">
                                  {qp.name}
                                </span>
                              </div>
                              {isIosNativeTrash ? (
                                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10.5px] font-medium shrink-0">
                                  30일 보관
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={quarantineMoving}
                                  onClick={() => void restoreFromQuarantine([qp.id], 'single')}
                                  className="px-2.5 py-1 rounded-md bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-semibold shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-wait inline-flex items-center gap-1"
                                >
                                  {isThisRowRestoring && (
                                    <span className="inline-block w-2.5 h-2.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                  )}
                                  {isThisRowRestoring ? '복원 중...' : '복원'}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </section>
            );
          })()}
        </GhostSecretaryFirstGuard>

        {/* 우측: 귀신비서 대화창 */}
        <div className="order-first xl:order-none xl:col-span-5 2xl:col-span-4 xl:sticky xl:top-20">
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
