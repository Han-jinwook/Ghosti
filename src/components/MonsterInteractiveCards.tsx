import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  Cpu,
  HardDrive,
  FileSearch,
  Activity,
  Volume2,
} from 'lucide-react';
import {
  type MonsterChatMessage,
  type MonsterLiteracyLevel,
  type DigitalHealthCheckRecord,
  formatBytes,
  triggerUserFavoriteAiLiveVoiceBatonTouch,
  executeMissingFileRecovery,
  openMissingFileOrRecycleBinLocation,
  executeMonsterCleanupApproval,
  executeRestorePointRollback,
  fetchRestorePointsWithPrecheck,
  executeDeepUninstallApproval,
  executeBootCarePreviewApproval,
  fetchDefenderGuardState,
  fetchStartupManagerPayload,
  toggleStartupProgramItem,
  submitExternalMonsterChatQuery,
} from '../services/monsterChatRouter';
import { useSaySeeStore } from '../store/useSaySeeStore';
import {
  submitStudioSupportTicket,
  buildStudioSupportJumpUrl,
} from '../services/merlin-hub-sdk/Support/blackbox';
import { speakWithHyunsuOrSunhi } from '../services/voiceSearchAndAiBatonEngine';
import { isMobileVoiceEnvironment } from '../services/setupMonsterTts';
import {
  saveWeeklyCareSchedule,
  loadWeeklyCareSchedule,
  formatScheduleLabelKo,
  recordCareCompletionTimestamp,
} from '../services/weeklyCareAndPlaceholderEngine';
import {
  executeRealOsAction,
  buildSetupDiagnosisPlan,
  launchRealOsTopmostOverlay,
} from '../services/setupMonsterEngine';
import { executeAgentCareBatchCard } from '../services/ghostCareAgentEngine';

interface MonsterCardProps {
  message: MonsterChatMessage;
  literacyLevel: MonsterLiteracyLevel;
  onChangeLiteracyLevel: (lvl: MonsterLiteracyLevel) => void;
  onUpdateMessage: (updated: MonsterChatMessage) => void;
  onHealthRecordAdded: (record: DigitalHealthCheckRecord) => void;
  onJumpToSearch: (keyword: string) => void;
  onToast?: (msg: string) => void;
}

export const MonsterInteractiveCardView: React.FC<MonsterCardProps> = ({
  message,
  onUpdateMessage,
  onJumpToSearch,
  onToast,
}) => {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedDetails, setExpandedDetails] = useState(false);
  const [showAllRestorePoints, setShowAllRestorePoints] = useState(false);
  const [restoreFilterText, setRestoreFilterText] = useState('');
  const [extraSupportKind, setExtraSupportKind] = useState<'CLAIM' | 'AS_BUG' | 'IDEA'>('IDEA');
  const [extraSupportText, setExtraSupportText] = useState('');
  const [extraSupportSending, setExtraSupportSending] = useState(false);
  const [customScanPath, setCustomScanPath] = useState('');
  const [appFilterQuery, setAppFilterQuery] = useState('');

  useEffect(() => {
    if (message.cardKind !== 'DEFENDER_GUARD_CARD' || !message.defenderGuardPayload?.scanRunning) {
      return;
    }
    let cancelled = false;
    const timer = window.setInterval(async () => {
      const st = await fetchDefenderGuardState('defender_scan_status');
      if (cancelled || !st.raw) return;
      const stillRunning = Boolean(st.raw.running);
      if (!stillRunning) {
        window.clearInterval(timer);
        const refreshed = await fetchDefenderGuardState('defender_status');
        if (cancelled) return;
        const doneText = String(st.raw.resultSummaryKo || refreshed.payload?.lastScanResultKo || '바이러스 검사가 완료되었습니다.');
        onUpdateMessage({
          ...message,
          defenderGuardPayload: {
            ...(refreshed.payload || message.defenderGuardPayload!),
            scanRunning: false,
            lastScanResultKo: doneText,
            lastActionNoteKo: doneText,
          },
        });
        onToast?.(doneText.replace(/\*\*/g, ''));
      }
    }, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [message, onUpdateMessage, onToast]);

  const handleBatonTouch = async () => {
    if (!message.batonTouchPayload) return;
    setBusyId('baton');
    const res = await triggerUserFavoriteAiLiveVoiceBatonTouch(message.batonTouchPayload);
    setBusyId(null);
    onUpdateMessage({
      ...message,
      batonTouchPayload: {
        ...message.batonTouchPayload,
        result: res,
      },
    });
    onToast?.(
      `[${res.detectedAiLabel}] 본문을 클립보드에 복사하고 상담 창을 열었습니다.`
    );
  };

  return (
    <div className="mt-2.5 space-y-2.5 text-slate-900">
      {/* 1) 검색 이동 카드 */}
      {message.cardKind === 'SEARCH_ROUTING' && message.searchKeyword && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <FileSearch className="w-4 h-4 text-slate-500" />
              <span>검색어: &ldquo;{message.searchKeyword}&rdquo;</span>
            </div>
            <button
              type="button"
              onClick={() => onJumpToSearch(message.searchKeyword!)}
              className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold cursor-pointer"
            >
              귀신검색에서 열기
            </button>
          </div>
        </div>
      )}

      {/* 2) 삭제·미저장 파일 미리보기 및 복원 카드 */}
      {message.cardKind === 'MISSING_FILE_EXONERATION' && message.missingFilePayload && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2.5 text-[13px] overflow-hidden break-words [overflow-wrap:anywhere]">
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-800 text-[12px] font-semibold">
                찾은 파일 미리보기
              </span>
              <span className="text-[12px] text-slate-500">
                {message.missingFilePayload.deletedAtOrSavedAt}
              </span>
            </div>
            <p className="text-[12.5px] text-slate-600 leading-snug">
              복원 전에 파일 이름과 원래 위치, 보관 상태를 확인할 수 있습니다.
            </p>
          </div>

          <div className="rounded-lg bg-white border border-slate-200 p-3 text-[12.5px] text-slate-700 space-y-1">
            {message.missingFilePayload.fiveLinePreview.map((line, i) => (
              <div key={i} className="whitespace-normal break-words [overflow-wrap:anywhere] leading-snug">
                {line}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {isMobileVoiceEnvironment() && (
                <button
                  type="button"
                  onClick={() =>
                    void speakWithHyunsuOrSunhi(
                      message.missingFilePayload!.fiveLinePreview.join('. '),
                      'sunhi_doc_reader'
                    )
                  }
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[12px] font-medium flex items-center gap-1 cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  음성으로 듣기
                </button>
              )}

              {message.missingFilePayload.currentLocation && (
                <button
                  type="button"
                  onClick={async () => {
                    const targetPath =
                      message.missingFilePayload!.restoredPath ||
                      message.missingFilePayload!.currentLocation;
                    const isInRecycleBin =
                      !message.missingFilePayload!.restored &&
                      targetPath.toLowerCase().includes('$recycle.bin');
                    const res = await openMissingFileOrRecycleBinLocation(
                      targetPath,
                      isInRecycleBin
                    );
                    if (res.ok) {
                      onToast?.(
                        isInRecycleBin
                          ? '휴지통 폴더를 열었습니다.'
                          : `[${message.missingFilePayload!.fileName}] 위치 폴더를 열었습니다.`
                      );
                    } else {
                      onToast?.('내 컴퓨터 연결 상태를 확인해 주세요.');
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[12px] font-medium cursor-pointer"
                >
                  폴더 열기
                </button>
              )}

              {!message.missingFilePayload.restored && (
                <button
                  type="button"
                  disabled={busyId === 'missing_restore' || busyId === 'missing_restore_all'}
                  onClick={async () => {
                    setBusyId('missing_restore');
                    const res = await executeMissingFileRecovery(
                      message.missingFilePayload!,
                      '원위치 복원 버튼 클릭'
                    );
                    setBusyId(null);
                    onUpdateMessage({
                      ...message,
                      missingFilePayload: {
                        ...message.missingFilePayload!,
                        restored: res.ok,
                        restoredPath: res.restoredPath,
                        currentLocation:
                          res.restoredPath || message.missingFilePayload!.currentLocation,
                        createdRestoreId: res.restoreId,
                        approvedTypedText: '원위치 복원 버튼 클릭',
                        restoreError: res.ok ? undefined : res.message,
                      },
                      healthRecordIssued: res.healthRecord || message.healthRecordIssued,
                    });
                    onToast?.(res.message);
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12px] font-semibold cursor-pointer"
                >
                  {busyId === 'missing_restore' ? '복원 중...' : '원위치로 복원'}
                </button>
              )}

              {!message.missingFilePayload.restored &&
                (() => {
                  const qPhotos = useSaySeeStore
                    .getState()
                    .photos.filter((p) => p.quarantined && !/^(IMG_2025|PET_2025|TRV_2025|DOC_2025|MEMO_2025|Screenshot_2025|BLUR_2025)/.test(p.name));
                  if (qPhotos.length <= 1) return null;
                  return (
                    <button
                      type="button"
                      disabled={busyId === 'missing_restore' || busyId === 'missing_restore_all'}
                      onClick={async () => {
                        setBusyId('missing_restore_all');
                        try {
                          await useSaySeeStore
                            .getState()
                            .restoreFromQuarantine(qPhotos.map((p) => p.id));
                          onUpdateMessage({
                            ...message,
                            missingFilePayload: {
                              ...message.missingFilePayload!,
                              restored: true,
                              approvedTypedText: `정리한 사진 전체 복원 (${qPhotos.length}장)`,
                              restoreError: undefined,
                            },
                          });
                          onToast?.(`정리 보관함(휴지통)에 있던 사진 ${qPhotos.length}장을 한꺼번에 원래 위치로 복원했습니다.`);
                        } finally {
                          setBusyId(null);
                        }
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-semibold cursor-pointer"
                    >
                      {busyId === 'missing_restore_all'
                        ? '전체 복원 중...'
                        : `정리한 사진 전체 복원 (${qPhotos.length}장)`}
                    </button>
                  );
                })()}
            </div>

            {message.missingFilePayload.restored && (
              <span className="px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-[12px] font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                복원 완료
                {message.missingFilePayload.createdRestoreId
                  ? ` (${message.missingFilePayload.createdRestoreId})`
                  : ''}
              </span>
            )}
          </div>
          {message.missingFilePayload.restoreError && (
            <div className="text-[12px] font-medium text-rose-600">{message.missingFilePayload.restoreError}</div>
          )}
        </div>
      )}

      {/* 3) 폴더·설치파일 정리 미리보기 카드 */}
      {message.cardKind === 'CLEANUP_PREVIEW_GATE' && message.cleanupPreview && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2.5 text-[13px] overflow-hidden break-words [overflow-wrap:anywhere]">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="font-bold text-slate-900">
              {message.cleanupPreview.summaryTitle}
            </span>
            <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[11.5px] font-semibold text-slate-700">
              {message.cleanupPreview.reclaimSizeLabel}
            </span>
          </div>

          <p className="text-[12.5px] text-slate-600 leading-relaxed">
            {message.cleanupPreview.previewDescriptionKo}
          </p>

          <div className="grid grid-cols-2 gap-2 text-center text-[12px]">
            <div className="rounded-lg bg-white border border-slate-200 p-2.5">
              <div className="text-slate-500">이동 대상</div>
              <div className="font-bold text-slate-900 mt-0.5">
                {message.cleanupPreview.moveCount}건
              </div>
            </div>
            <div className="rounded-lg bg-white border border-slate-200 p-2.5">
              <div className="text-slate-500">전체 크기</div>
              <div className="font-bold text-slate-900 mt-0.5">
                {formatBytes(message.cleanupPreview.totalBytes)}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => setExpandedDetails((v) => !v)}
              className="w-full py-2 px-3 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-[12px] font-medium text-slate-700 flex items-center justify-between gap-2 cursor-pointer text-left"
            >
              <span>정리 대상 파일 목록 ({message.cleanupPreview.sampleFiles.length}건)</span>
              <span className="shrink-0 text-slate-400">{expandedDetails ? '접기' : '펼치기'}</span>
            </button>
            {expandedDetails && (
              <div className="rounded-lg bg-white border border-slate-200 p-3 text-[12px] text-slate-700 space-y-1 max-h-52 overflow-y-auto">
                {message.cleanupPreview.sampleFiles.map((f, idx) => (
                  <div key={idx} className="flex items-start gap-1.5 break-words [overflow-wrap:anywhere]">
                    <span className="text-slate-400 shrink-0">·</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {message.cleanupPreview.executionError && (
            <div className="text-[12px] font-medium text-rose-600">{message.cleanupPreview.executionError}</div>
          )}

          <div className="pt-1">
            {message.cleanupPreview.approved ? (
              <div className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[12.5px] font-semibold flex items-center justify-between gap-2 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  {message.cleanupPreview.undone
                    ? `원래 위치로 되돌리기 완료 (${message.cleanupPreview.createdRestoreId || '#1'})`
                    : `정리 완료 (${message.cleanupPreview.createdRestoreId || '#1'})`}
                </span>
                {!message.cleanupPreview.undone && (
                  <button
                    type="button"
                    disabled={busyId === 'cleanup_undo'}
                    onClick={async () => {
                      const rid = message.cleanupPreview?.createdRestoreId || '#1';
                      setBusyId('cleanup_undo');
                      const res = await executeRestorePointRollback(rid, '원래대로 되돌려줘');
                      setBusyId(null);
                      if (res.ok && message.cleanupPreview) {
                        onUpdateMessage({
                          ...message,
                          cleanupPreview: {
                            ...message.cleanupPreview,
                            undone: true,
                            executionError: undefined,
                          },
                        });
                      } else if (!res.ok && message.cleanupPreview) {
                        onUpdateMessage({
                          ...message,
                          cleanupPreview: {
                            ...message.cleanupPreview,
                            executionError: res.message,
                          },
                        });
                      }
                      onToast?.(res.message);
                    }}
                    className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 border border-emerald-300 text-emerald-900 text-[11.5px] font-medium cursor-pointer"
                  >
                    {busyId === 'cleanup_undo' ? '복원 중...' : '원래대로 되돌리기'}
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[12px] text-slate-500">
                  확인 후 버튼을 누르거나 &ldquo;응 진행해&rdquo;라고 입력해 주세요.
                </span>
                <button
                  type="button"
                  disabled={busyId === 'cleanup_approve'}
                  onClick={async () => {
                    if (!message.cleanupPreview) return;
                    setBusyId('cleanup_approve');
                    const res = await executeMonsterCleanupApproval(
                      message.cleanupPreview,
                      '응, 안전 정리해줘 (버튼 승인)'
                    );
                    setBusyId(null);
                    onUpdateMessage({
                      ...message,
                      cleanupPreview: {
                        ...message.cleanupPreview,
                        approved: res.ok,
                        approvedTypedText: '응, 안전 정리해줘',
                        createdRestoreId: res.restoreId,
                        executionError: res.ok ? undefined : res.message,
                        undone: false,
                      },
                      healthRecordIssued: res.healthRecord || message.healthRecordIssued,
                    });
                    onToast?.(res.message);
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12.5px] font-semibold cursor-pointer shrink-0"
                >
                  {busyId === 'cleanup_approve' ? '정리 중...' : '✅ 응, 안전 정리해줘'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4) 바탕화면 바로가기 생성 카드 */}
      {message.cardKind === 'DESKTOP_SHORTCUT_GATE' && message.shortcutPreview && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2.5">
          <span className="text-[12.5px] font-bold text-slate-900">
            바탕화면 바로가기 만들기
          </span>
          <div className="rounded-lg bg-white border border-slate-200 p-2.5 text-xs space-y-1">
            <div className="text-slate-800 font-semibold">
              이름: {message.shortcutPreview.shortcutFileName}
            </div>
            <div className="text-slate-500 text-[11px] break-all">
              주소: {message.shortcutPreview.targetUrl}
            </div>
          </div>
          {message.shortcutPreview.executionError && (
            <div className="text-[11.5px] font-medium text-rose-600">{message.shortcutPreview.executionError}</div>
          )}
          <div>
            {message.shortcutPreview.approved ? (
              <div className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                바탕화면에 생성되었습니다 ({message.shortcutPreview.createdRestoreId})
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs text-slate-500">
                  확인 후 생성 버튼을 눌러 주세요.
                </span>
                <button
                  type="button"
                  disabled={busyId === 'shortcut_approve'}
                  onClick={async () => {
                    setBusyId('shortcut_approve');
                    await submitExternalMonsterChatQuery('응 진행해', message.sourceTab || 'trash');
                    setBusyId(null);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12px] font-semibold cursor-pointer"
                >
                  {busyId === 'shortcut_approve' ? '생성 중...' : '바로가기 생성'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5) 복원 기록 목록 카드 */}
      {message.cardKind === 'RESTORE_POINTS_LIST' && message.restorePoints && (() => {
        const q = restoreFilterText.trim().toLowerCase();
        const filteredPts = q
          ? message.restorePoints.filter(
              (pt) =>
                pt.restoreId.toLowerCase().includes(q) ||
                pt.summary.toLowerCase().includes(q) ||
                pt.createdAt.toLowerCase().includes(q)
            )
          : message.restorePoints;
        const visiblePts = showAllRestorePoints || q ? filteredPts : filteredPts.slice(0, 3);
        const hiddenCount = Math.max(0, filteredPts.length - visiblePts.length);

        return (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2.5 text-[13px] overflow-hidden break-words [overflow-wrap:anywhere]">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="font-bold text-slate-900">복원 기록 ({message.restorePoints.length}건)</span>
              <span className="text-[11.5px] text-slate-500">
                버튼을 누르거나 &ldquo;1번 복원해줘&rdquo;라고 입력
              </span>
            </div>

            {message.restorePoints.length > 4 && (
              <input
                type="text"
                value={restoreFilterText}
                onChange={(e) => setRestoreFilterText(e.target.value)}
                placeholder="번호(#12), 날짜, 작업명으로 검색..."
                className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-[12.5px] text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-600"
              />
            )}

            <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
              {visiblePts.map((pt) => (
                <div
                  key={pt.restoreId}
                  className="rounded-lg bg-white border border-slate-200 p-3 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[13px] font-semibold text-slate-900 break-words [overflow-wrap:anywhere]">
                      [{pt.restoreId}] {pt.summary}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-medium">
                      {pt.statusBadge.replace(/[🟢🟡🔴✅\s]+/gu, '').trim() || pt.statusBadge}
                    </span>
                  </div>
                  <p className="text-[12px] text-slate-600 leading-snug">{pt.precheckGuideMessage}</p>
                  <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                    <span className="text-[11.5px] text-slate-400">{pt.createdAt}</span>
                    {pt.rolledBack ? (
                      <span className="text-[12px] font-semibold text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        복원 완료
                      </span>
                    ) : pt.integrityStatus === 'UNRESTORABLE' || pt.restorableItems === 0 ? (
                      <span className="text-[12px] text-slate-400">
                        복원 대상 없음
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={busyId === `rb-${pt.restoreId}`}
                        onClick={async () => {
                          setBusyId(`rb-${pt.restoreId}`);
                          const typed = `${pt.restoreId.replace('#', '')}번 복원해줘`;
                          const res = await executeRestorePointRollback(pt.restoreId, typed);
                          const refreshed = await fetchRestorePointsWithPrecheck();
                          setBusyId(null);
                          if (refreshed.points.length > 0) {
                            onUpdateMessage({
                              ...message,
                              restorePoints: refreshed.points,
                            });
                          } else if (res.ok) {
                            onUpdateMessage({
                              ...message,
                              restorePoints: message.restorePoints?.map((item) =>
                                item.restoreId === pt.restoreId
                                  ? {
                                      ...item,
                                      rolledBack: true,
                                      rollbackTypedText: typed,
                                      integrityStatus: 'FULL_RESTORABLE',
                                      statusBadge: '원위치 복원 완료',
                                      precheckGuideMessage:
                                        '원래 위치로 복원된 기록입니다.',
                                    }
                                  : item
                              ),
                            });
                          }
                          onToast?.(res.message);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12px] font-semibold cursor-pointer"
                      >
                        {busyId === `rb-${pt.restoreId}` ? '복원 중...' : '원래대로 되돌리기'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {filteredPts.length > 3 && !q && (
              <button
                type="button"
                onClick={() => setShowAllRestorePoints((v) => !v)}
                className="w-full py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-[12px] font-medium text-slate-700 cursor-pointer"
              >
                {showAllRestorePoints
                  ? '최근 3건만 보기'
                  : `이전 기록 더 보기 (+${hiddenCount}건)`}
              </button>
            )}
          </div>
        );
      })()}

      {/* 6) 내 PC 사양 요약 카드 */}
      {message.cardKind === 'PC_SPEC_CONSULTATION' && message.pcSpecPayload && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2.5 text-[13px] overflow-hidden break-words [overflow-wrap:anywhere]">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-slate-900">
              <Cpu className="w-4 h-4 text-slate-500 shrink-0" />
              내 PC 하드웨어 요약
            </span>
            <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 text-[11.5px] font-semibold">
              {message.pcSpecPayload.verdictBadge}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[12px]">
            <div className="rounded-lg bg-white border border-slate-200 p-2.5">
              <div className="text-slate-500">
                CPU {typeof message.pcSpecPayload.cpuLoadPercent === 'number' ? `(${message.pcSpecPayload.cpuLoadPercent}%)` : ''}
              </div>
              <div className="font-semibold text-slate-900 whitespace-normal break-words leading-snug mt-0.5">
                {message.pcSpecPayload.cpuModel}
              </div>
            </div>
            <div className="rounded-lg bg-white border border-slate-200 p-2.5">
              <div className="text-slate-500">메모리 (RAM)</div>
              <div className="font-semibold text-slate-900 whitespace-normal break-words leading-snug mt-0.5">
                {message.pcSpecPayload.ramTotalGb ?? '확인 불가'}
                {message.pcSpecPayload.ramTotalGb !== null ? 'GB' : ''}
                {message.pcSpecPayload.ramUsedPercent !== null ? ` (${message.pcSpecPayload.ramUsedPercent}%)` : ''}
              </div>
            </div>
            <div className="rounded-lg bg-white border border-slate-200 p-2.5">
              <div className="text-slate-500">그래픽 (GPU)</div>
              <div className="font-semibold text-slate-900 whitespace-normal break-words leading-snug mt-0.5">
                {message.pcSpecPayload.gpuModel}
              </div>
            </div>
            <div className="rounded-lg bg-white border border-slate-200 p-2.5">
              <div className="text-slate-500">여유 공간</div>
              <div className="font-semibold text-slate-900 flex items-center gap-1 whitespace-normal break-words leading-snug mt-0.5">
                <HardDrive className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>{message.pcSpecPayload.diskFreeGb !== null ? `${message.pcSpecPayload.diskFreeGb} GB` : '확인 불가'}</span>
              </div>
            </div>
          </div>

          {message.pcSpecPayload.bloatwareCleanSummary && (
            <div className="rounded-lg bg-white border border-slate-200 p-2.5 text-[12.5px] text-slate-700 whitespace-normal break-words">
              {message.pcSpecPayload.bloatwareCleanSummary}
            </div>
          )}

          {(message.pcSpecPayload.detectedBloatwareLabels?.length || 0) > 0 && (
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => setExpandedDetails((v) => !v)}
                className="w-full py-2 px-3 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-[12px] font-medium text-slate-700 flex items-center justify-between gap-2 cursor-pointer text-left"
              >
                <span>감지된 상주 모듈 목록 ({message.pcSpecPayload.detectedBloatwareLabels!.length}종)</span>
                <span className="shrink-0 text-slate-400">{expandedDetails ? '접기' : '펼치기'}</span>
              </button>
              {expandedDetails && (
                <div className="rounded-lg bg-white border border-slate-200 p-3 text-[12px] text-slate-700 space-y-1 max-h-52 overflow-y-auto">
                  {message.pcSpecPayload.detectedBloatwareLabels!.map((lbl, idx) => (
                    <div key={idx} className="flex items-start gap-1.5 break-words [overflow-wrap:anywhere]">
                      <span className="text-slate-400 shrink-0">·</span>
                      <span>{lbl}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="pt-1 space-y-2">
            {message.pcSpecPayload.bloatwareCleaned ? (
              <div className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[12.5px] font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                정리 완료 ({message.pcSpecPayload.createdRestoreId || '#1'})
              </div>
            ) : (
              ((message.pcSpecPayload.detectedBloatwareLabels?.length || 0) > 0 ||
                (message.pcSpecPayload.cpuLoadPercent ?? 0) >= 50) && (
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[12px] text-slate-500">
                    불필요 상주 항목을 절전·정리할까요?
                  </span>
                  <button
                    type="button"
                    disabled={busyId === 'spec_approve'}
                    onClick={async () => {
                      setBusyId('spec_approve');
                      await submitExternalMonsterChatQuery('응 진행해', message.sourceTab || 'trash');
                      setBusyId(null);
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12.5px] font-semibold cursor-pointer shrink-0"
                  >
                    {busyId === 'spec_approve' ? '정리 중...' : '불필요 항목 정리'}
                  </button>
                </div>
              )
            )}
            <button
              type="button"
              disabled={busyId === 'spec_baton'}
              onClick={async () => {
                const sp = message.pcSpecPayload!;
                setBusyId('spec_baton');
                const specSummary = `CPU: ${sp.cpuModel} | RAM: ${sp.ramTotalGb ?? '확인불가'}GB (${sp.ramUsedPercent ?? '?'}% 사용) | GPU: ${sp.gpuModel} | 여유 공간: ${sp.diskFreeGb ?? '?'}GB | 주사율: ${sp.displayHz ?? '?'}Hz | OS: ${sp.osVersion}`;

                const overlayPlan = buildSetupDiagnosisPlan(
                  'pc',
                  '내 PC 사양 AI 상담',
                  'pc_excel_overlay'
                );
                useSaySeeStore.getState().openSetupOverlayGuide({
                  ...overlayPlan,
                  title: 'AI 상담창 붙여넣기 안내',
                  overlaySteps: [
                    {
                      step: 1,
                      screenTitle: 'Google Gemini 상담창',
                      scrapedElements: [{ text: '입력창', rect: [420, 180] }],
                      targetLabel: '입력창 붙여넣기 (Ctrl+V)',
                      bubbleMessage: '👆 1. 클립보드에 사양 정보가 복사되었습니다. 입력창에 붙여넣기(Ctrl+V) 후 전송을 누르세요.',
                      voiceGuideText: '입력창에 붙여넣기 후 전송 버튼을 눌러주세요.',
                      fingerCoordPct: [50, 85],
                      rawLogicalRect: [420, 180, 200, 60],
                    },
                    {
                      step: 2,
                      screenTitle: 'Google Gemini 상담창',
                      scrapedElements: [{ text: '음성 대화', rect: [540, 180] }],
                      targetLabel: '라이브 음성',
                      bubbleMessage: '👆 2. 음성 버튼을 누르면 말로 이어서 질문할 수 있습니다.',
                      voiceGuideText: '음성 버튼을 눌러 말로 상담할 수 있습니다.',
                      fingerCoordPct: [65, 85],
                      rawLogicalRect: [540, 180, 200, 60],
                    },
                  ],
                });

                void launchRealOsTopmostOverlay({
                  x: 420,
                  y: 150,
                  text: '👆 입력창에 붙여넣기(Ctrl+V) 후 전송 버튼을 클릭하세요.',
                  durationSec: 10,
                });

                const res = await triggerUserFavoriteAiLiveVoiceBatonTouch({
                  docTitle: '내 PC 사양 요약',
                  docText: specSummary,
                  deviceSpecSummary: specSummary,
                  userQuestion:
                    '위 내 PC 사양을 바탕으로 현재 컴퓨터의 성능 수준과 최적화 조언을 쉽게 설명해 줘.',
                });
                setBusyId(null);
                onToast?.(
                  `[${res.detectedAiLabel}] 내 PC 사양을 복사하고 상담 창을 열었습니다.`
                );
              }}
              className="w-full py-2 px-3 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              사양 복사 후 외부 AI(Gemini)에 질문하기
            </button>
          </div>
        </div>
      )}

      {/* 6-B) 기기 수리 진단 카드 */}
      {message.cardKind === 'DEVICE_REPAIR_GATE' && message.deviceRepairPayload && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2.5 text-[13px] overflow-hidden break-words [overflow-wrap:anywhere]">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 text-[11.5px] font-semibold">
              진단 및 조치 안내
            </span>
            <span className="text-[12px] font-semibold text-slate-600">
              {message.deviceRepairPayload.badgeText}
            </span>
          </div>

          <div className="text-[13.5px] font-bold text-slate-900 whitespace-normal break-words leading-snug">
            {message.deviceRepairPayload.title}
          </div>
          <p className="text-[12.5px] text-slate-600 leading-relaxed whitespace-normal break-words">
            {message.deviceRepairPayload.rootCause}
          </p>

          {message.deviceRepairPayload.detailGroups && message.deviceRepairPayload.detailGroups.length > 0 && (
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => setExpandedDetails((v) => !v)}
                className="w-full py-2 px-3 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-[12px] font-medium text-slate-700 flex items-center justify-between gap-2 cursor-pointer text-left"
              >
                <span>
                  상세 항목 {expandedDetails ? '접기' : '펼치기'} (
                  {message.deviceRepairPayload.detailGroups.map((g) => g.groupTitle).join(' · ')})
                </span>
                <span className="shrink-0 text-slate-400">{expandedDetails ? '접기' : '펼치기'}</span>
              </button>
              {expandedDetails && (
                <div className="rounded-lg bg-white border border-slate-200 p-3 space-y-2.5 max-h-60 overflow-y-auto text-[12px]">
                  {message.deviceRepairPayload.detailGroups.map((grp, gIdx) => (
                    <div key={gIdx} className="space-y-1">
                      <div className="font-semibold text-slate-900">{grp.groupTitle}</div>
                      <div className="space-y-0.5">
                        {grp.items.map((item, iIdx) => (
                          <div
                            key={iIdx}
                            className="flex items-start gap-1.5 text-slate-600 break-words [overflow-wrap:anywhere] leading-snug"
                          >
                            <span className="text-slate-400 shrink-0">·</span>
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {message.deviceRepairPayload.executed && (
            <div className="rounded-lg bg-white border border-slate-200 p-2.5 text-[12.5px] text-slate-700 font-medium whitespace-normal break-words">
              {message.deviceRepairPayload.undone
                ? '이전 설정으로 원상복구했습니다.'
                : message.deviceRepairPayload.completionMessage || '조치 및 백업을 완료했습니다.'}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {message.deviceRepairPayload.executed && !message.deviceRepairPayload.undone ? (
              <>
                <span className="px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-[12px] font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  완료 ({message.deviceRepairPayload.createdRestoreId || '#1'})
                </span>
                <button
                  type="button"
                  disabled={busyId === 'repair_undo'}
                  onClick={async () => {
                    setBusyId('repair_undo');
                    await submitExternalMonsterChatQuery('방금 한 거 되돌려줘', message.sourceTab || 'trash');
                    setBusyId(null);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[12px] font-medium cursor-pointer"
                >
                  {busyId === 'repair_undo' ? '복원 중...' : '이전 상태로 되돌리기'}
                </button>
              </>
            ) : (
              <div className="w-full flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[12px] text-slate-500">
                  승인 시에만 실행되며 언제든 복원할 수 있습니다.
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    disabled={busyId === 'repair_approve'}
                    onClick={async () => {
                      setBusyId('repair_approve');
                      await submitExternalMonsterChatQuery('응 진행해', message.sourceTab || 'trash');
                      setBusyId(null);
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12.5px] font-semibold cursor-pointer shrink-0"
                  >
                    {busyId === 'repair_approve' ? '진행 중...' : '진행하기'}
                  </button>
                  {message.deviceRepairPayload.hasOverlayGuide && (
                    <button
                      type="button"
                      onClick={async () => {
                        const plan = buildSetupDiagnosisPlan(
                          'pc',
                          message.deviceRepairPayload!.symptomQuery,
                          message.deviceRepairPayload!.presetId
                        );
                        if (plan.overlaySteps && plan.overlaySteps.length > 0) {
                          useSaySeeStore.getState().openSetupOverlayGuide(plan);
                        } else {
                          const fallbackPlan = buildSetupDiagnosisPlan(
                            'pc',
                            message.deviceRepairPayload!.symptomQuery,
                            'pc_excel_overlay'
                          );
                          useSaySeeStore.getState().openSetupOverlayGuide({
                            ...fallbackPlan,
                            title: `${message.deviceRepairPayload!.symptomQuery} 화면 위치 안내`,
                          });
                        }
                        await launchRealOsTopmostOverlay({
                          x: 420,
                          y: 180,
                          text: `👆 [${message.deviceRepairPayload!.symptomQuery}] 여기를 클릭해 설정을 확인하세요.`,
                          durationSec: 10,
                        });
                        onToast?.('화면 위에 위치 안내(👆)를 표시했습니다.');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[12px] font-medium cursor-pointer flex items-center gap-1"
                    >
                      <span>👆</span>
                      <span>화면 위치 안내</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7) 외부 AI 바통 터치 카드 */}
      {message.cardKind === 'BATON_TOUCH_CUTOFF' && message.batonTouchPayload && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-900">
              외부 AI(Gemini)에 이어서 질문하기
            </span>
            <span className="text-[11px] text-slate-500">질문 내용 클립보드 복사</span>
          </div>
          {message.batonTouchPayload.result ? (
            <div className="rounded-lg bg-white border border-slate-200 p-2.5 text-xs text-slate-700 space-y-2">
              <div className="font-semibold text-slate-900">
                {message.batonTouchPayload.result.detectedAiLabel} 상담 창을 열었습니다.
              </div>
              <div className="text-[11.5px] text-slate-600 leading-relaxed">
                {message.batonTouchPayload.result.ttsBriefingKo}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {message.batonTouchPayload.result.targetUrl && (
                  <button
                    type="button"
                    onClick={() => void handleBatonTouch()}
                    className="px-2.5 py-1 rounded-md bg-teal-600 hover:bg-teal-700 text-white text-[11.5px] font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <ExternalLink className="w-3 h-3" />
                    상담 창 다시 열기
                  </button>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    const label = message.batonTouchPayload?.result?.detectedAiLabel || 'Gemini';
                    await launchRealOsTopmostOverlay({
                      x: 420,
                      y: 150,
                      text: `👆 [${label}] 입력창에 붙여넣기(Ctrl+V) 후 전송을 클릭하세요.`,
                      durationSec: 10,
                    });
                    onToast?.('화면 위에 위치 안내(👆)를 표시했습니다.');
                  }}
                  className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11.5px] font-medium flex items-center gap-1 cursor-pointer"
                >
                  <span>👆</span>
                  <span>위치 안내 보기</span>
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={busyId === 'baton'}
              onClick={() => void handleBatonTouch()}
              className="w-full py-2 px-3 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              내용 복사 후 AI 상담 창 열기
            </button>
          )}
        </div>
      )}

      {/* 8) 작업 완료 기록 요약 카드 */}
      {message.healthRecordIssued && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-900">
              작업 기록 저장됨
            </span>
            <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 text-[11px] font-semibold">
              {message.healthRecordIssued.reclaimedSizeLabel}
            </span>
          </div>
          <div className="text-xs text-slate-700 font-medium">
            {message.healthRecordIssued.title}
          </div>
          <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
            <div className="text-[11px] text-slate-500">
              {message.healthRecordIssued.speedUpSummary} (복원 번호: {message.healthRecordIssued.restoreId})
            </div>
            <button
              type="button"
              onClick={async () => {
                const rec = message.healthRecordIssued;
                if (!rec) return;
                const cardSummary = [
                  '[귀신같이] 내 PC 정리 결과 요약',
                  `- 항목: ${rec.title}`,
                  `- 결과: ${rec.reclaimedSizeLabel} (${rec.speedUpSummary})`,
                  `- 복원 번호: ${rec.restoreId}`,
                ].join('\n');
                try {
                  await navigator.clipboard?.writeText(cardSummary);
                } catch {
                  /* ignore */
                }
                onToast?.('정리 결과 요약이 클립보드에 복사되었습니다.');
              }}
              className="px-2 py-1 rounded-md bg-white hover:bg-slate-100 border border-slate-200 text-[11px] font-medium text-slate-600 cursor-pointer shrink-0"
            >
              결과 복사
            </button>
          </div>
        </div>
      )}

      {/* 9) 기능 · 요금 안내 카드 */}
      {message.cardKind === 'GHOSTI_INFO_DESK' && message.infoDeskPayload && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2.5">
          <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 text-[11px] font-semibold inline-block">
            {message.infoDeskPayload.topicBadge}
          </span>
          <div className="text-xs font-bold text-slate-900">
            {message.infoDeskPayload.title}
          </div>
          <ul className="space-y-1.5 text-[12px] text-slate-700 leading-relaxed">
            {message.infoDeskPayload.bulletPoints.map((pt, idx) => (
              <li key={idx} className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
                {pt}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {message.infoDeskPayload.actionButtons.map((btn, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  const st = useSaySeeStore.getState();
                  if (btn.actionType === 'OPEN_PRICING_MODAL') {
                    st.setShowProModal(true);
                  } else if (
                    btn.actionType === 'OPEN_ONBOARDING_TAB1' ||
                    btn.actionType === 'OPEN_ONBOARDING_TAB2' ||
                    btn.actionType === 'OPEN_ONBOARDING_TAB3'
                  ) {
                    if (st.isStoreAppMode) {
                      onJumpToSearch('');
                    } else if (st.layout === 'mobile') {
                      window.dispatchEvent(new CustomEvent('ghosti_navigate_showroom'));
                    } else {
                      const targetTab =
                        btn.actionType === 'OPEN_ONBOARDING_TAB3'
                          ? 'tab3_share_pro'
                          : 'tab1_find_care';
                      window.dispatchEvent(
                        new CustomEvent('ghosti_open_onboarding_tab', { detail: { tab: targetTab } })
                      );
                    }
                  } else if (btn.actionType === 'JUMP_SEARCH') {
                    onJumpToSearch('');
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[11.5px] font-semibold cursor-pointer"
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 10) 앱 설정 변경 결과 카드 */}
      {message.cardKind === 'APP_SETTINGS_CONTROL' && message.appSettingsPayload && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[11px] font-semibold text-slate-700">
              {message.appSettingsPayload.badgeText}
            </span>
            <span className="text-[11.5px] font-semibold text-slate-800">
              {message.appSettingsPayload.appliedValueLabel}
            </span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            {message.appSettingsPayload.summaryText}
          </p>
          {message.appSettingsPayload.isBlockedByFilter && (
            <button
              type="button"
              onClick={() => useSaySeeStore.getState().setShowProModal(true)}
              className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[11.5px] font-semibold cursor-pointer"
            >
              요금제 안내 보기
            </button>
          )}
        </div>
      )}

      {/* 11) 고객 문의 · 오류 접수 카드 */}
      {message.cardKind === 'STUDIO_SUPPORT_PROXY' && message.studioSupportPayload && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded bg-teal-600 text-white text-[11px] font-semibold">
              {message.studioSupportPayload.badgeLabel}
            </span>
            <span className="text-[11px] text-slate-500">
              접수번호 #{message.studioSupportPayload.ticketId}
            </span>
          </div>

          <div className="rounded-lg bg-white border border-slate-200 p-2.5 text-xs text-slate-700 space-y-1">
            <div className="text-[11px] text-slate-400 font-medium">접수 내용</div>
            <div className="font-medium text-slate-900">{message.studioSupportPayload.userComment}</div>
          </div>

          <a
            href={message.studioSupportPayload.studioJumpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2 px-3 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>나의 문의방에서 처리 현황 보기</span>
          </a>

          <div className="pt-2 border-t border-slate-200 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="text-slate-500 font-medium">추가 접수:</span>
              {(
                [
                  { id: 'CLAIM' as const, label: '불편 신고' },
                  { id: 'AS_BUG' as const, label: '오류 신고' },
                  { id: 'IDEA' as const, label: '기능 제안' },
                ]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setExtraSupportKind(tab.id)}
                  className={`px-2 py-0.5 rounded font-medium whitespace-nowrap cursor-pointer ${
                    extraSupportKind === tab.id
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap sm:flex-nowrap gap-1.5">
              <input
                type="text"
                value={extraSupportText}
                onChange={(e) => setExtraSupportText(e.target.value)}
                placeholder="추가 전달 내용을 입력해 주세요..."
                className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-[12px] text-slate-900 outline-none focus:border-slate-600"
              />
              <button
                type="button"
                disabled={extraSupportSending || !extraSupportText.trim()}
                onClick={async () => {
                  const val = extraSupportText.trim();
                  if (!val) return;
                  setExtraSupportSending(true);
                  const badge =
                    extraSupportKind === 'CLAIM'
                      ? '불편 신고 접수'
                      : extraSupportKind === 'IDEA'
                      ? '기능 제안 접수'
                      : '오류 신고 접수';
                  const res = await submitStudioSupportTicket({
                    appId: 'Ghosti',
                    appVersion: 'v2026.11',
                    userEmail: message.studioSupportPayload!.userEmail,
                    category: extraSupportKind === 'IDEA' ? 'INQUIRY' : 'BUG',
                    userComment: `[${badge}] ${val}`,
                  });
                  const newTid = res.ticketId || `GH-${Date.now().toString().slice(-5)}`;
                  const newJump = buildStudioSupportJumpUrl({
                    appId: 'Ghosti',
                    ticketId: newTid,
                    email: message.studioSupportPayload!.userEmail,
                  });
                  setExtraSupportSending(false);
                  setExtraSupportText('');
                  onUpdateMessage({
                    ...message,
                    studioSupportPayload: {
                      ...message.studioSupportPayload!,
                      ticketKind: extraSupportKind,
                      badgeLabel: badge,
                      userComment: val,
                      ticketId: newTid,
                      studioJumpUrl: newJump,
                    },
                  });
                  onToast?.(`${badge} 완료 (#${newTid})`);
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-[11.5px] font-semibold cursor-pointer shrink-0"
              >
                {extraSupportSending ? '접수 중...' : '접수'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 11-B) 정기 점검 브리핑 카드 */}
      {message.cardKind === 'WEEKLY_CARE_BRIEFING' && message.proactiveCareBriefing && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-800 text-[11px] font-semibold">
              {message.proactiveCareBriefing.badgeLabel}
            </span>
            <span className="text-[11px] text-slate-500">
              {formatScheduleLabelKo(loadWeeklyCareSchedule())}
            </span>
          </div>

          <div className="rounded-lg bg-white border border-slate-200 p-2.5 text-xs text-slate-700 space-y-1 leading-relaxed">
            <div className="font-semibold text-slate-900">
              {message.proactiveCareBriefing.headlineLine1}
            </div>
            <div className="text-slate-600">
              {message.proactiveCareBriefing.schedulePromptLine2}
            </div>
          </div>

          {message.proactiveCareBriefing.executed ? (
            <div className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              정리 및 정기 점검 예약 완료 ({message.proactiveCareBriefing.createdRestoreId || '#1'})
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <button
                type="button"
                disabled={busyId === 'weekly_care_exec'}
                onClick={async () => {
                  setBusyId('weekly_care_exec');
                  const osRes = await executeRealOsAction(
                    'boot_lag_clean_bloatware',
                    '정기 청소 및 예약 승인'
                  );
                  setBusyId(null);
                  const restoreId = String((osRes as any).restoreId || '#1');
                  recordCareCompletionTimestamp(message.proactiveCareBriefing?.ramUsedPercent ?? undefined);
                  saveWeeklyCareSchedule({ enabled: true });
                  onUpdateMessage({
                    ...message,
                    proactiveCareBriefing: {
                      ...message.proactiveCareBriefing!,
                      executed: true,
                      scheduleConfirmed: true,
                      approvedTypedText: '정리 및 정기 예약 승인',
                      createdRestoreId: restoreId,
                    },
                  });
                  onToast?.('상주 보안프로그램 정리를 완료하고 주간 정기 점검을 설정했습니다.');
                }}
                className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold cursor-pointer"
              >
                정리 후 매주 정기 점검 켜기
              </button>
            </div>
          )}
        </div>
      )}

      {/* 11-B2) 심층 프로그램 제거 카드 */}
      {message.cardKind === 'DEEP_UNINSTALL_GATE' && message.deepUninstallPayload && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="font-bold text-slate-900 text-[13px]">
              {message.deepUninstallPayload.targetAppLabel} 제거 점검
            </span>
            <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[11px] font-medium text-slate-600">
              {message.deepUninstallPayload.summaryBadge}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-white border border-slate-200 p-2 flex sm:block items-center justify-between">
              <div className="text-[11px] text-slate-500">실행 중 프로세스</div>
              <div className="text-sm font-bold text-slate-900">
                {message.deepUninstallPayload.runningProcessCount}개
              </div>
            </div>
            <div className="rounded-lg bg-white border border-slate-200 p-2 flex sm:block items-center justify-between">
              <div className="text-[11px] text-slate-500">서비스 · 작업 스케줄</div>
              <div className="text-sm font-bold text-slate-900">
                {message.deepUninstallPayload.serviceAndTaskCount}개
              </div>
            </div>
            <div className="rounded-lg bg-white border border-slate-200 p-2 flex sm:block items-center justify-between">
              <div className="text-[11px] text-slate-500">잔여 폴더 용량</div>
              <div className="text-sm font-bold text-slate-900">
                {message.deepUninstallPayload.totalResidualMb}MB
              </div>
            </div>
          </div>

          {(message.deepUninstallPayload.sampleProcesses.length > 0 ||
            message.deepUninstallPayload.sampleServicesAndTasks.length > 0 ||
            message.deepUninstallPayload.sampleFolders.length > 0) && (
            <div className="rounded-lg bg-white border border-slate-200 p-2.5 text-[11.5px] text-slate-700 space-y-1.5">
              <div className="font-semibold text-slate-800">감지된 프로세스 · 서비스 · 잔여 폴더</div>
              {[
                ...message.deepUninstallPayload.sampleProcesses,
                ...message.deepUninstallPayload.sampleServicesAndTasks,
              ]
                .slice(0, 6)
                .map((item, idx) => (
                  <div key={`proc-${idx}`} className="flex items-center gap-1.5">
                    <span className="text-slate-400">·</span>
                    <span className="font-mono break-all">{item}</span>
                  </div>
                ))}

              {message.deepUninstallPayload.residualFolderItems &&
              message.deepUninstallPayload.residualFolderItems.length > 0 ? (
                <div className="pt-1.5 space-y-1 border-t border-slate-100">
                  <div className="text-[11px] font-semibold text-slate-700">
                    휴지통으로 이동할 잔여 폴더 선택 (해제 시 유지):
                  </div>
                  {message.deepUninstallPayload.residualFolderItems.map((fItem) => {
                    const selectedList =
                      message.deepUninstallPayload?.selectedFolderPaths ??
                      message.deepUninstallPayload?.residualFolderItems?.map((x) => x.path) ??
                      [];
                    const isChecked = selectedList.includes(fItem.path);
                    return (
                      <label
                        key={fItem.path}
                        className="flex items-center gap-2 cursor-pointer select-none"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={Boolean(message.deepUninstallPayload?.executed)}
                          onChange={(e) => {
                            if (!message.deepUninstallPayload) return;
                            const nextSel = e.target.checked
                              ? Array.from(new Set([...selectedList, fItem.path]))
                              : selectedList.filter((p) => p !== fItem.path);
                            onUpdateMessage({
                              ...message,
                              deepUninstallPayload: {
                                ...message.deepUninstallPayload,
                                selectedFolderPaths: nextSel,
                              },
                            });
                          }}
                          className="accent-slate-900 rounded cursor-pointer"
                        />
                        <span className="font-mono break-all text-slate-700">
                          {fItem.path} ({fItem.sizeMb}MB)
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                message.deepUninstallPayload.sampleFolders.slice(0, 6).map((item, idx) => (
                  <div key={`dir-${idx}`} className="flex items-center gap-1.5">
                    <span className="text-slate-400">·</span>
                    <span className="font-mono break-all">{item}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {message.deepUninstallPayload.executionError && !message.deepUninstallPayload.executed && (
            <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
              {message.deepUninstallPayload.executionError}
            </div>
          )}

          {message.deepUninstallPayload.executed ? (
            <div className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold space-y-1">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                제거 완료 (잔여 폴더는 시스템 휴지통으로 이동됨)
              </div>
              {message.deepUninstallPayload.executionReportKo && (
                <div className="text-[11.5px] text-slate-700 font-normal whitespace-pre-line pt-1">
                  {message.deepUninstallPayload.executionReportKo}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="text-[11.5px] text-slate-500">
                잔여 폴더는 영구 삭제하지 않고 시스템 휴지통으로 이동합니다.
              </span>
              <button
                type="button"
                disabled={busyId === 'deep_uninstall_exec'}
                onClick={async () => {
                  if (!message.deepUninstallPayload) return;
                  setBusyId('deep_uninstall_exec');
                  const res = await executeDeepUninstallApproval(
                    message.deepUninstallPayload,
                    '심층 제거 실행 (버튼 승인)'
                  );
                  setBusyId(null);
                  if (!res.ok) {
                    onUpdateMessage({
                      ...message,
                      deepUninstallPayload: {
                        ...message.deepUninstallPayload,
                        executionError: res.reportKo,
                      },
                    });
                    onToast?.(res.reportKo);
                    return;
                  }
                  onUpdateMessage({
                    ...message,
                    deepUninstallPayload: {
                      ...message.deepUninstallPayload,
                      executed: true,
                      executionError: undefined,
                      approvedTypedText: '심층 제거 실행',
                      snapshotFile: res.snapshotFile,
                      executionReportKo: res.reportKo,
                    },
                    healthRecordIssued: res.healthRecord || message.healthRecordIssued,
                  });
                  onToast?.('제거가 완료되었으며 잔여 폴더는 휴지통으로 이동했습니다.');
                }}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
              >
                {busyId === 'deep_uninstall_exec' ? '제거 중...' : '제거 실행'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 11-B3) 부팅·보안모듈 정리 승인 카드 */}
      {message.cardKind === 'BOOT_CARE_PREVIEW_GATE' && message.bootCarePreviewPayload && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2.5 text-[12.5px]">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="font-bold text-slate-900">
              {message.bootCarePreviewPayload.mode === 'SCHEDULE_REBOOT'
                ? `새벽 ${message.bootCarePreviewPayload.scheduleTime} 자동 재부팅 예약`
                : '미사용 보안모듈 · 자동실행 정리 미리보기'}
            </span>
            <span className="text-[11px] text-slate-500">업무용 필수 보안 제외</span>
          </div>

          <div className="rounded-lg bg-white border border-slate-200 p-2.5 text-xs text-slate-700 space-y-1.5 whitespace-pre-line">
            <div>{message.bootCarePreviewPayload.uptimeSummaryKo}</div>
            {message.bootCarePreviewPayload.mode === 'CLEAN_BLOATWARE' && (
              <div className="pt-1 border-t border-slate-100 text-[11.5px] text-slate-600">
                {message.bootCarePreviewPayload.detectedPlugins.length > 0 ? (
                  <>
                    감지된 미사용 보안 모듈 ({message.bootCarePreviewPayload.detectedPlugins.length}종):{' '}
                    <span className="text-slate-900 font-mono">
                      {message.bootCarePreviewPayload.detectedPlugins.slice(0, 6).join(', ')}
                    </span>
                  </>
                ) : (
                  <span>현재 실행 중인 미사용 보안 모듈이 없습니다.</span>
                )}
              </div>
            )}
          </div>

          {message.bootCarePreviewPayload.executionError && !message.bootCarePreviewPayload.approved && (
            <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
              {message.bootCarePreviewPayload.executionError}
            </div>
          )}

          {message.bootCarePreviewPayload.approved ? (
            <div className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold space-y-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  {message.bootCarePreviewPayload.undone
                    ? `원래 설정으로 되돌리기 완료 (${message.bootCarePreviewPayload.createdRestoreId || '#1'})`
                    : `정리 완료${
                        message.bootCarePreviewPayload.createdRestoreId
                          ? ` (${message.bootCarePreviewPayload.createdRestoreId})`
                          : ''
                      }`}
                </span>
                {message.bootCarePreviewPayload.mode === 'CLEAN_BLOATWARE' &&
                  !message.bootCarePreviewPayload.undone && (
                    <button
                      type="button"
                      disabled={busyId === 'boot_care_undo'}
                      onClick={async () => {
                        const rid = message.bootCarePreviewPayload?.createdRestoreId || 'LATEST';
                        setBusyId('boot_care_undo');
                        const res = await executeRestorePointRollback(rid, '원래대로 되돌려줘');
                        setBusyId(null);
                        if (res.ok && message.bootCarePreviewPayload) {
                          onUpdateMessage({
                            ...message,
                            bootCarePreviewPayload: {
                              ...message.bootCarePreviewPayload,
                              undone: true,
                              executionSummaryKo: res.message,
                            },
                          });
                        }
                        onToast?.(res.message);
                      }}
                      className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 border border-emerald-300 text-emerald-900 text-[11.5px] font-medium cursor-pointer"
                    >
                      {busyId === 'boot_care_undo' ? '복원 중...' : '원래대로 되돌리기'}
                    </button>
                  )}
              </div>
              {message.bootCarePreviewPayload.executionSummaryKo && (
                <div className="text-[11.5px] text-slate-700 font-normal whitespace-pre-line">
                  {message.bootCarePreviewPayload.executionSummaryKo}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
              <span className="text-[11.5px] text-slate-500">
                확인 후 버튼을 누르거나 &ldquo;응 진행해&rdquo;라고 입력해 주세요.
              </span>
              <button
                type="button"
                disabled={busyId === 'boot_care_approve'}
                onClick={async () => {
                  if (!message.bootCarePreviewPayload) return;
                  setBusyId('boot_care_approve');
                  const res = await executeBootCarePreviewApproval(
                    message.bootCarePreviewPayload,
                    '응, 안전 정리해줘 (버튼 승인)'
                  );
                  setBusyId(null);
                  onUpdateMessage({
                    ...message,
                    bootCarePreviewPayload: {
                      ...message.bootCarePreviewPayload,
                      approved: res.ok,
                      approvedTypedText: '응, 안전 정리해줘',
                      createdRestoreId: res.restoreId,
                      executionSummaryKo: res.ok ? res.summaryKo : undefined,
                      executionError: res.ok ? undefined : res.summaryKo,
                      undone: false,
                    },
                    healthRecordIssued: res.healthRecord || message.healthRecordIssued,
                  });
                  onToast?.(res.summaryKo);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold cursor-pointer"
              >
                {busyId === 'boot_care_approve'
                  ? '진행 중...'
                  : message.bootCarePreviewPayload.mode === 'SCHEDULE_REBOOT'
                  ? `새벽 ${message.bootCarePreviewPayload.scheduleTime} 예약`
                  : '✅ 응, 안전 정리해줘'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 11-B4) Windows 기본 백신 점검 카드 */}
      {message.cardKind === 'DEFENDER_GUARD_CARD' && message.defenderGuardPayload && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-3 text-xs">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="font-bold text-slate-900 text-[13px]">
              Windows 기본 백신 · 보안 상태
            </span>
            <span className="text-[11px] text-slate-500">
              업데이트: {message.defenderGuardPayload.signatureUpdatedAt || '최신'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-white border border-slate-200 p-2">
              <div className="text-[10.5px] text-slate-500">실시간 감시</div>
              <div className={`text-xs font-bold mt-0.5 ${message.defenderGuardPayload.realTimeProtection ? 'text-emerald-700' : 'text-amber-700'}`}>
                {message.defenderGuardPayload.realTimeProtection ? '켜짐' : '확인 필요'}
              </div>
            </div>
            <div className="rounded-lg bg-white border border-slate-200 p-2">
              <div className="text-[10.5px] text-slate-500">방화벽</div>
              <div className={`text-xs font-bold mt-0.5 ${message.defenderGuardPayload.firewallEnabled ? 'text-emerald-700' : 'text-amber-700'}`}>
                {message.defenderGuardPayload.firewallEnabled ? '켜짐' : '확인 필요'}
              </div>
            </div>
            <div className="rounded-lg bg-white border border-slate-200 p-2">
              <div className="text-[10.5px] text-slate-500">랜섬웨어 보호</div>
              <div className="text-xs font-bold text-slate-800 mt-0.5">
                {message.defenderGuardPayload.ransomwareShieldEnabled ? '켜짐' : '설정 가능'}
              </div>
            </div>
          </div>

          {message.defenderGuardPayload.scanRunning && (
            <div className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 font-medium flex items-center gap-2">
              <Activity className="w-4 h-4 animate-spin text-slate-500 shrink-0" />
              <span>바이러스 검사를 진행하고 있습니다...</span>
            </div>
          )}

          {!message.defenderGuardPayload.scanRunning && message.defenderGuardPayload.lastScanResultKo && (
            <div className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 whitespace-pre-line">
              {message.defenderGuardPayload.lastScanResultKo.replace(/\*\*/g, '')}
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={message.defenderGuardPayload.scanRunning || busyId === 'def_quick'}
              onClick={async () => {
                setBusyId('def_quick');
                const r = await fetchDefenderGuardState('defender_quick_scan');
                setBusyId(null);
                if (r.payload) {
                  onUpdateMessage({ ...message, defenderGuardPayload: r.payload });
                }
                onToast?.(r.summaryKo.replace(/\*\*/g, ''));
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold cursor-pointer"
            >
              빠른 검사
            </button>

            <button
              type="button"
              disabled={busyId === 'def_sig'}
              onClick={async () => {
                setBusyId('def_sig');
                const r = await fetchDefenderGuardState('defender_update_signature');
                setBusyId(null);
                if (r.payload) {
                  onUpdateMessage({
                    ...message,
                    defenderGuardPayload: {
                      ...r.payload,
                      lastScanResultKo: r.summaryKo,
                    },
                  });
                }
                onToast?.(r.summaryKo.replace(/\*\*/g, ''));
              }}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-medium cursor-pointer"
            >
              {busyId === 'def_sig' ? '업데이트 중...' : '보안 DB 업데이트'}
            </button>

            {message.defenderGuardPayload.removableDrives.map((usb) => (
              <button
                key={usb.drive}
                type="button"
                disabled={message.defenderGuardPayload?.scanRunning || busyId === `usb_${usb.drive}`}
                onClick={async () => {
                  setBusyId(`usb_${usb.drive}`);
                  const r = await fetchDefenderGuardState('defender_custom_scan', usb.drive);
                  setBusyId(null);
                  if (r.payload) {
                    onUpdateMessage({ ...message, defenderGuardPayload: r.payload });
                  }
                  onToast?.(r.summaryKo.replace(/\*\*/g, ''));
                }}
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-medium cursor-pointer"
              >
                {usb.label} 검사
              </button>
            ))}

            <button
              type="button"
              onClick={async () => {
                const r = await fetchDefenderGuardState('defender_open_ransomware_shield');
                onToast?.(r.summaryKo);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-medium cursor-pointer"
            >
              랜섬웨어 폴더 보호
            </button>

            <button
              type="button"
              onClick={async () => {
                const r = await fetchDefenderGuardState('defender_open_quarantine_history');
                onToast?.(r.summaryKo);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-medium cursor-pointer"
            >
              격리함 · 기록
            </button>

            {!message.defenderGuardPayload.realTimeProtection && (
              <button
                type="button"
                onClick={async () => {
                  const r = await fetchDefenderGuardState('defender_open_threat_settings');
                  onToast?.(r.summaryKo);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold cursor-pointer"
              >
                실시간 감시 켜기
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 pt-2 border-t border-slate-200">
            <input
              type="text"
              value={customScanPath}
              onChange={(e) => setCustomScanPath(e.target.value)}
              placeholder="검사할 폴더 경로 (예: D:\Downloads)"
              className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-[11.5px] text-slate-900 placeholder:text-slate-400"
            />
            <button
              type="button"
              disabled={!customScanPath.trim() || message.defenderGuardPayload.scanRunning || busyId === 'def_custom'}
              onClick={async () => {
                const p = customScanPath.trim();
                if (!p) return;
                setBusyId('def_custom');
                const r = await fetchDefenderGuardState('defender_custom_scan', p);
                setBusyId(null);
                if (r.payload) {
                  onUpdateMessage({ ...message, defenderGuardPayload: r.payload });
                }
                onToast?.(r.summaryKo.replace(/\*\*/g, ''));
              }}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-medium shrink-0 cursor-pointer disabled:opacity-40"
            >
              지정 폴더 검사
            </button>
          </div>
        </div>
      )}

      {/* 11-B5) 시작프로그램 관리 카드 */}
      {message.cardKind === 'STARTUP_MANAGER_CARD' && message.startupManagerPayload && (() => {
        const items = message.startupManagerPayload.items;
        const enabledCnt = items.filter((x) => x.enabled).length;
        const disabledCnt = items.filter((x) => !x.enabled).length;
        return (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="font-bold text-slate-900 text-[13px]">
              부팅 시작프로그램 관리 ({items.length}개)
            </div>
            <span className="text-[11px] font-medium text-slate-500 shrink-0">
              켜짐 {enabledCnt}개 · 꺼둠 {disabledCnt}개
            </span>
          </div>

          {message.startupManagerPayload.lastToggleNoteKo && (
            <div
              className={`px-2.5 py-1.5 rounded-lg border text-[11.5px] leading-snug ${
                message.startupManagerPayload.lastToggleOk === false
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}
            >
              {message.startupManagerPayload.lastToggleNoteKo}
            </div>
          )}

          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {items.map((stItem) => {
              const isBusyRow = busyId === `st_${stItem.id}`;
              const shortLoc = !stItem.enabled
                ? '꺼둠 · 다시 켜기 가능'
                : stItem.requiresAdmin
                ? '공용(관리자 권한)'
                : '내 계정';
              return (
              <div
                key={stItem.id}
                className="rounded-lg bg-white border border-slate-200 px-2.5 py-2 flex items-center justify-between gap-2"
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="font-semibold text-slate-900 truncate" title={stItem.name}>
                    {stItem.name}
                  </div>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
                        !stItem.enabled
                          ? 'bg-slate-100 text-slate-500'
                          : stItem.requiresAdmin
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-sky-50 text-sky-700'
                      }`}
                    >
                      {shortLoc}
                    </span>
                    <span className="text-[10.5px] text-slate-400 font-mono truncate" title={stItem.command}>
                      {stItem.command}
                    </span>
                  </div>
                </div>
                {stItem.isProtected ? (
                  <span className="px-2 py-1 rounded bg-slate-100 text-slate-500 text-[10.5px] font-medium shrink-0">
                    필수 보호
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={isBusyRow}
                    title={stItem.requiresAdmin ? '공용(PC 전체) 항목은 윈도우 관리자 허용 창이 뜰 수 있어요.' : undefined}
                    onClick={async () => {
                      setBusyId(`st_${stItem.id}`);
                      const targetEnable = !stItem.enabled;
                      const res = await toggleStartupProgramItem(stItem.id, targetEnable);
                      const fresh = await fetchStartupManagerPayload();
                      setBusyId(null);

                      // 기존 행 순서를 그대로 유지하면서 상태만 제자리 갱신(클릭 직후 항목이 아래로 사라져 안 바뀐 것처럼 보이는 현상 방지)
                      const prevItems = message.startupManagerPayload!.items;
                      let nextItems = prevItems;
                      if (fresh.payload?.items && fresh.payload.items.length > 0) {
                        const freshById = new Map(fresh.payload.items.map((x) => [x.id.toLowerCase(), x]));
                        const preserved = prevItems
                          .map((old) => freshById.get(old.id.toLowerCase()))
                          .filter((x): x is NonNullable<typeof x> => Boolean(x));
                        const preservedIds = new Set(preserved.map((x) => x.id.toLowerCase()));
                        const added = fresh.payload.items.filter((x) => !preservedIds.has(x.id.toLowerCase()));
                        nextItems = [...preserved, ...added];
                      } else if (res.ok) {
                        nextItems = prevItems.map((it) =>
                          it.id === stItem.id
                            ? {
                                ...it,
                                enabled: targetEnable,
                                locationLabel: targetEnable ? it.locationLabel : '꺼둠 · 다시 켜기 가능',
                              }
                            : it
                        );
                      }

                      const nextEn = nextItems.filter((x) => x.enabled).length;
                      const nextDis = nextItems.filter((x) => !x.enabled).length;
                      const updatedText = message.text.replace(
                        /\(켜짐\s*\d+개\s*·\s*꺼둠\s*\d+개\)/,
                        `(켜짐 ${nextEn}개 · 꺼둠 ${nextDis}개)`
                      );

                      onUpdateMessage({
                        ...message,
                        text: updatedText,
                        startupManagerPayload: {
                          items: nextItems,
                          lastToggleNoteKo: res.message,
                          lastToggleOk: res.ok,
                        },
                      });
                      onToast?.(res.message);
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold shrink-0 cursor-pointer border transition-colors disabled:opacity-60 ${
                      stItem.enabled
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700'
                        : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-800'
                    }`}
                  >
                    {isBusyRow ? '변경 중...' : stItem.enabled ? '켜짐 (끄기)' : '꺼짐 (켜기)'}
                  </button>
                )}
              </div>
              );
            })}
          </div>
        </div>
        );
      })()}

      {/* 11-B6) 설치된 프로그램 목록 카드 */}
      {message.cardKind === 'INSTALLED_APPS_CARD' && message.installedAppsPayload && (() => {
        const qApp = appFilterQuery.trim().toLowerCase();
        const filteredApps = qApp
          ? message.installedAppsPayload.items.filter(
              (a) => a.name.toLowerCase().includes(qApp) || a.publisher.toLowerCase().includes(qApp)
            )
          : message.installedAppsPayload.items;
        return (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2.5 text-xs">
            <div className="font-bold text-slate-900 text-[13px]">
              설치된 프로그램 목록 ({message.installedAppsPayload.totalCount}개)
            </div>

            <input
              type="text"
              value={appFilterQuery}
              onChange={(e) => setAppFilterQuery(e.target.value)}
              placeholder="프로그램 이름 검색..."
              className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400"
            />

            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {filteredApps.slice(0, 40).map((app) => (
                <div
                  key={app.name}
                  className="rounded-lg bg-white border border-slate-200 px-2.5 py-2 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-900 truncate">
                      {app.name}{' '}
                      {app.sizeMb > 0 && (
                        <span className="text-[10.5px] text-slate-500 font-normal">({app.sizeMb}MB)</span>
                      )}
                    </div>
                    <div className="text-[10.5px] text-slate-400 truncate">
                      {app.publisher || '제조사 미표기'}
                      {app.installDate ? ` · 설치일 ${app.installDate}` : ''}
                    </div>
                  </div>
                  {app.isProtected ? (
                    <span className="px-2 py-1 rounded bg-slate-100 text-slate-500 text-[10.5px] font-medium shrink-0">
                      보호됨
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        void submitExternalMonsterChatQuery(
                          `${app.name} 완전히 삭제해줘`,
                          message.sourceTab || 'trash'
                        );
                      }}
                      className="px-2.5 py-1 rounded-md bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-700 hover:text-rose-700 text-[11px] font-medium shrink-0 cursor-pointer"
                    >
                      제거 점검
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* 11-B7) [제미니 에이전트 자유 문답 + 다중 취사선택 PC 정리 카드 (2026-11-24 합의 5대 기둥)] */}
      {message.cardKind === 'AGENT_CARE_BATCH_CARD' && message.agentCareCardPayload && (() => {
        const card = message.agentCareCardPayload;
        const selectedSet = new Set(card.selectedIds || []);
        const selectedCount = card.items.filter((it) => selectedSet.has(it.id) && !it.isProtected).length;
        const selectedTotalMb = Math.round(
          card.items
            .filter((it) => selectedSet.has(it.id) && !it.isProtected)
            .reduce((acc, it) => acc + (it.sizeMb || 0), 0)
        );
        const toggleItem = (id: string) => {
          if (card.executed) return;
          const next = new Set(selectedSet);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          onUpdateMessage({
            ...message,
            agentCareCardPayload: {
              ...card,
              selectedIds: Array.from(next),
            },
          });
        };
        const setMoveDrive = (drv: string) => {
          if (card.executed) return;
          onUpdateMessage({
            ...message,
            agentCareCardPayload: {
              ...card,
              moveDestinationDrive: drv,
            },
          });
        };
        return (
          <div className="rounded-xl border border-teal-200 bg-slate-50 p-3.5 space-y-2.5 text-xs overflow-hidden">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="font-bold text-slate-900 text-[13px]">{card.title}</div>
              <span className="px-2 py-0.5 rounded bg-teal-50 border border-teal-200 text-teal-800 text-[11px] font-semibold">
                {card.badgeText}
              </span>
            </div>

            {card.summaryLines && card.summaryLines.length > 0 && (
              <div className="rounded-lg bg-white border border-slate-200 p-2.5 space-y-1 text-[11.5px] text-slate-700">
                {card.summaryLines.map((ln, i) => (
                  <div key={i} className="leading-snug">{ln}</div>
                ))}
              </div>
            )}

            {card.excludedNames && card.excludedNames.length > 0 && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 text-[11.5px] text-emerald-900 font-medium">
                🟢 보존 확정(제외됨): {card.excludedNames.join(', ')}
              </div>
            )}

            {card.items.length > 0 && (
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {card.items.map((it) => {
                  const checked = selectedSet.has(it.id) && !it.isProtected;
                  const badgeStyle =
                    it.safetyBadge === 'DANGER_DELETE'
                      ? 'bg-rose-100 text-rose-800 border-rose-200'
                      : it.safetyBadge === 'SAFE_DELETE'
                      ? 'bg-orange-50 text-orange-800 border-orange-200'
                      : it.safetyBadge === 'SAFE_CLEAN'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : it.safetyBadge === 'SLEEP_RECOMMEND'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-slate-100 text-slate-700 border-slate-200';
                  return (
                    <div
                      key={it.id}
                      className={`rounded-lg border px-2.5 py-2 transition-colors ${
                        it.isProtected
                          ? 'bg-slate-100 border-slate-200 opacity-75'
                          : checked
                          ? 'bg-white border-teal-300'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          disabled={Boolean(card.executed || it.isProtected)}
                          checked={checked}
                          onChange={() => toggleItem(it.id)}
                          className="mt-0.5 accent-teal-600 cursor-pointer shrink-0"
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="font-semibold text-slate-900 flex items-center justify-between gap-1.5 flex-wrap">
                            <span
                              onClick={() => toggleItem(it.id)}
                              className="cursor-pointer break-words [overflow-wrap:anywhere]"
                            >
                              <span className="text-teal-700 font-mono mr-1">#{it.no}</span>
                              {it.name}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              {it.safetyBadgeLabel && (
                                <span className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${badgeStyle}`}>
                                  {it.safetyBadgeLabel}
                                </span>
                              )}
                              {it.sizeMb > 0 && (
                                <span className="text-[11px] font-semibold text-slate-600">
                                  {it.sizeMb >= 1024 ? `${(it.sizeMb / 1024).toFixed(2)}GB` : `${it.sizeMb}MB`}
                                </span>
                              )}
                              {!card.executed && !it.isProtected && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const askPrompt =
                                      it.cat === 'POWER_PLAN' || card.action === 'desktop_power_boost'
                                        ? `#${it.no}번 ${it.name} 이게 뭔가요? 자세히 설명해줘`
                                        : `#${it.no}번 ${it.name} 이게 뭐 하는 프로그램이야? 지워도 돼?`;
                                    void submitExternalMonsterChatQuery(
                                      askPrompt,
                                      message.sourceTab || 'trash'
                                    );
                                  }}
                                  className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-teal-50 border border-slate-200 hover:border-teal-300 text-[10px] text-slate-600 hover:text-teal-800 font-medium cursor-pointer"
                                >
                                  이게 뭐예요?
                                </button>
                              )}
                            </div>
                          </div>
                          {it.plainExplainKo ? (
                            <div className="text-[11px] text-slate-700 leading-snug break-words">
                              💡 {it.plainExplainKo}
                            </div>
                          ) : it.detailKo ? (
                            <div className="text-[11px] text-slate-500 leading-snug break-words">{it.detailKo}</div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 여유 드라이브(D: 등) 안전 이사 전환 스위치 */}
            {!card.executed && card.availableMoveDrives && card.availableMoveDrives.length > 0 && (card.action === 'disk_hog_clean' || card.action === 'desktop_batch_action') && (
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                <span className="text-[11px] text-slate-600 font-medium">처리 방식:</span>
                <button
                  type="button"
                  onClick={() => setMoveDrive('')}
                  className={`px-2 py-1 rounded-md text-[11px] font-semibold border cursor-pointer ${
                    !card.moveDestinationDrive
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  🗑️ Windows 휴지통으로 안전 이동
                </button>
                {card.availableMoveDrives.map((dv) => (
                  <button
                    key={dv.drive}
                    type="button"
                    onClick={() => setMoveDrive(dv.drive)}
                    className={`px-2 py-1 rounded-md text-[11px] font-semibold border cursor-pointer ${
                      card.moveDestinationDrive === dv.drive
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    📦 {dv.drive}\귀신비서_보관함 으로 안전 이사 ({dv.freeGb}GB 여유)
                  </button>
                ))}
              </div>
            )}

            {card.executed ? (
              <div className="space-y-2">
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-[11.5px] text-emerald-950 whitespace-pre-line leading-relaxed">
                  {card.executionReportKo || '선택한 항목의 정리가 완료되었습니다.'}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {card.action !== 'hidden_rats_apply' && (
                    <button
                      type="button"
                      onClick={() => void submitExternalMonsterChatQuery('휴지통 비워줘', message.sourceTab || 'trash')}
                      className="px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[11.5px] font-semibold cursor-pointer"
                    >
                      🗑️ 휴지통 비워서 C: 용량 확정하기
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void submitExternalMonsterChatQuery('최근 [복원 기록] 보여줘', message.sourceTab || 'trash')}
                    className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11.5px] font-medium cursor-pointer"
                  >
                    ↩️ 복원 기록 확인
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-slate-200">
                <span className="text-[11px] text-slate-500">
                  {card.currentFreeGb !== undefined && card.projectedFreeAfterEmptyGb !== undefined
                    ? `현재 C: ${card.currentFreeGb}GB ➔ 정리·비우기 후 약 ${card.projectedFreeAfterEmptyGb}GB`
                    : '영구 삭제 0% · Windows 기본 휴지통 안전 보관'}
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {card.isDesktop && card.isHighPerformance === false && (
                    <button
                      type="button"
                      onClick={() => void submitExternalMonsterChatQuery('데스크톱 전원 옵션 고성능으로 바꿔줘', message.sourceTab || 'trash')}
                      className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-[11px] font-semibold cursor-pointer"
                    >
                      ⚡ 고성능 전원 전환
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busyId === 'agent_batch_exec' || (selectedCount === 0 && card.action !== 'desktop_system_icon_toggle' && card.action !== 'desktop_power_boost')}
                    onClick={async () => {
                      setBusyId('agent_batch_exec');
                      const res = await executeAgentCareBatchCard(card, '원클릭 체크박스 최종 확인 실행');
                      setBusyId(null);
                      onUpdateMessage({
                        ...message,
                        agentCareCardPayload: {
                          ...card,
                          executed: res.ok,
                          executionReportKo: res.reportKo,
                          currentFreeGb: res.currentFreeGb ?? card.currentFreeGb,
                          projectedFreeAfterEmptyGb: res.projectedFreeAfterEmptyGb ?? card.projectedFreeAfterEmptyGb,
                        },
                      });
                      onToast?.(res.ok ? '선택한 항목을 안전하게 정리했습니다!' : '정리 결과를 확인해 주세요.');
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white text-[12px] font-bold cursor-pointer shrink-0"
                  >
                    {busyId === 'agent_batch_exec'
                      ? '안전 정리 실행 중...'
                      : card.action === 'desktop_power_boost'
                      ? '⚡ 고성능 전원 즉시 전환'
                      : card.action === 'desktop_system_icon_toggle'
                      ? '✨ 시스템 아이콘 안전 숨김'
                      : card.action === 'hidden_rats_apply'
                      ? `✅ ${selectedCount}건 안전 차단·수동전환 실행 (1초 원복 보장)`
                      : `✅ ${selectedCount}건 일괄 실행${selectedTotalMb > 0 ? ` (${selectedTotalMb >= 1024 ? `${(selectedTotalMb / 1024).toFixed(1)}GB` : `${selectedTotalMb}MB`})` : ''} (휴지통 안전 보관)`}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* 11-C) 모바일 음성 사전 동의 카드 */}
      {isMobileVoiceEnvironment() && message.voiceConsentPromptKo && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 flex items-center justify-between gap-2 flex-wrap">
          <span className="text-[12px] font-medium text-slate-700 flex items-center gap-1.5">
            <Volume2 className="w-4 h-4 text-slate-500 shrink-0" />
            <span>
              {message.voiceConsentApproved
                ? '음성 안내를 재생했습니다.'
                : '음성으로도 함께 안내해 드릴까요?'}
            </span>
          </span>
          {!message.voiceConsentApproved && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  void speakWithHyunsuOrSunhi(message.voiceConsentPromptKo!, 'hyunsu_briefing');
                  onUpdateMessage({
                    ...message,
                    voiceConsentApproved: true,
                  });
                }}
                className="px-2.5 py-1 rounded-md bg-teal-600 hover:bg-teal-700 text-white text-[11.5px] font-semibold cursor-pointer"
              >
                음성으로 듣기
              </button>
              <button
                type="button"
                onClick={() =>
                  onUpdateMessage({
                    ...message,
                    voiceConsentPromptKo: undefined,
                  })
                }
                className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 text-[11.5px] font-medium cursor-pointer"
              >
                글로 보기
              </button>
            </div>
          )}
        </div>
      )}

      {/* 12) 활용 팁 */}
      {message.shortformTip && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="space-y-0.5">
            <div className="text-[11.5px] font-semibold text-slate-900">
              {message.shortformTip.title} ({message.shortformTip.durationLabel})
            </div>
            <div className="text-xs text-slate-600">{message.shortformTip.summaryText}</div>
          </div>
          <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600 text-[11px] font-medium">
            활용 팁
          </span>
        </div>
      )}
    </div>
  );
};

export const PersonalHealthCheckHistoryDrawer: React.FC<{
  records: DigitalHealthCheckRecord[];
  onClose: () => void;
  onRollbackRestoreId?: (restoreId: string) => void;
}> = ({ records, onClose }) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-md text-slate-900">
      <div className="flex items-start sm:items-center justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-bold text-slate-900 break-keep">
            점검 및 복원 기록함
          </h4>
          <p className="text-[11.5px] text-slate-500 break-keep">
            승인 및 복원한 작업 내역이 기기에 보관됩니다.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium shrink-0 whitespace-nowrap cursor-pointer"
        >
          닫기
        </button>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {records.map((rec) => (
          <div
            key={rec.recordId}
            className="rounded-lg bg-slate-50 border border-slate-200 p-3 flex items-center justify-between gap-3 flex-wrap"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 text-[11px] font-semibold">
                  {rec.category}
                </span>
                <span className="text-xs font-bold text-slate-900">{rec.title}</span>
                <span className="text-[11px] text-slate-600">({rec.reclaimedSizeLabel})</span>
              </div>
              <div className="text-[11.5px] text-slate-600">{rec.speedUpSummary}</div>
              <div className="text-[10.5px] text-slate-400">
                {rec.issuedAt} {rec.restoreId ? `· 복원 번호 ${rec.restoreId}` : ''}
              </div>
            </div>
            {rec.restoreId && (
              <span className="px-2 py-1 rounded bg-white border border-slate-200 text-slate-600 text-[11px]">
                &ldquo;{rec.restoreId} 되돌려줘&rdquo; 입력 시 복원
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
