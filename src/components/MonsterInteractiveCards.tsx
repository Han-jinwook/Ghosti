import React, { useState } from 'react';
import {
  CheckCircle2,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  ExternalLink,
  Cpu,
  HardDrive,
  FileSearch,
  FolderCheck,
  Activity,
  Film,
  Volume2,
  ClipboardCheck,
} from 'lucide-react';
import {
  type MonsterChatMessage,
  type MonsterLiteracyLevel,
  type DigitalHealthCheckRecord,
  executeMonsterCleanupApproval,
  executeMonsterShortcutApproval,
  executeRestorePointRollback,
  executeMissingFileRecovery,
  formatBytes,
  triggerUserFavoriteAiLiveVoiceBatonTouch,
} from '../services/monsterChatRouter';
import { speakWithHyunsuOrSunhi } from '../services/voiceSearchAndAiBatonEngine';

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
  literacyLevel,
  onChangeLiteracyLevel,
  onUpdateMessage,
  onHealthRecordAdded,
  onJumpToSearch,
  onToast,
}) => {
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleApproveCleanup = async () => {
    if (!message.cleanupPreview || message.cleanupPreview.approved) return;
    setBusyId('cleanup');
    const res = await executeMonsterCleanupApproval(message.cleanupPreview);
    setBusyId(null);
    if (!res.ok) {
      onUpdateMessage({
        ...message,
        cleanupPreview: { ...message.cleanupPreview, executionError: res.message },
      });
      onToast?.(res.message);
      return;
    }
    if (res.healthRecord) onHealthRecordAdded(res.healthRecord);
    onUpdateMessage({
      ...message,
      text: `${message.text}\n\n${res.message}`,
      cleanupPreview: {
        ...message.cleanupPreview,
        approved: true,
        createdRestoreId: res.restoreId,
        executionError: undefined,
      },
      healthRecordIssued: res.healthRecord,
    });
    onToast?.(res.message);
  };

  const handleApproveShortcut = async () => {
    if (!message.shortcutPreview || message.shortcutPreview.approved) return;
    setBusyId('shortcut');
    const res = await executeMonsterShortcutApproval(message.shortcutPreview);
    setBusyId(null);
    if (!res.ok) {
      onUpdateMessage({
        ...message,
        shortcutPreview: { ...message.shortcutPreview, executionError: res.message },
      });
      onToast?.(res.message);
      return;
    }
    if (res.healthRecord) onHealthRecordAdded(res.healthRecord);
    onUpdateMessage({
      ...message,
      text: `${message.text}\n\n${res.message}`,
      shortcutPreview: {
        ...message.shortcutPreview,
        approved: true,
        createdRestoreId: res.restoreId,
        executionError: undefined,
      },
      healthRecordIssued: res.healthRecord,
    });
    onToast?.(res.message);
  };

  const handleRestoreMissingFile = async () => {
    if (!message.missingFilePayload || message.missingFilePayload.restored) return;
    setBusyId('missing');
    const res = await executeMissingFileRecovery(message.missingFilePayload);
    setBusyId(null);
    onUpdateMessage({
      ...message,
      text: `${message.text}\n\n${res.message}`,
      missingFilePayload: {
        ...message.missingFilePayload,
        restored: res.ok,
        restoreError: res.ok ? undefined : res.message,
      },
    });
    onToast?.(res.message);
  };

  const handleRollbackPoint = async (restoreId: string) => {
    setBusyId(restoreId);
    const res = await executeRestorePointRollback(restoreId);
    setBusyId(null);
    if (res.ok && message.restorePoints) {
      onUpdateMessage({
        ...message,
        restorePoints: message.restorePoints.map((pt) =>
          pt.restoreId === restoreId ? { ...pt, rolledBack: true } : pt
        ),
      });
    }
    onToast?.(res.message);
  };

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
      `🤝 [${res.detectedAiLabel}] 본문 클립보드 복사 및 라이브 음성 상담 창 연결이 완료되었습니다!`
    );
  };

  return (
    <div className="mt-2.5 space-y-2.5">
      {/* 1) 0토큰 1초 투시검색 직행 카드 */}
      {message.cardKind === 'SEARCH_ROUTING' && message.searchKeyword && (
        <div className="rounded-xl border border-indigo-500/40 bg-indigo-950/30 p-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="text-xs font-bold text-indigo-200 flex items-center gap-1.5">
              <FileSearch className="w-4 h-4 text-indigo-400" />
              <span>검색 키워드: &ldquo;{message.searchKeyword}&rdquo; (LLM 0토큰 · 0.01초 인덱스 직결)</span>
            </div>
            <button
              type="button"
              onClick={() => onJumpToSearch(message.searchKeyword!)}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow"
            >
              <Sparkles className="w-3.5 h-3.5" />
              🎯 [찾기] 탭에서 1초 검색 결과 바로 열기
            </button>
          </div>
        </div>
      )}

      {/* 2) 1초 블랙박스 소명 & 5대 은닉 금고 / $Recycle.Bin $I 포렌식 + 5줄 실물 미리보기 */}
      {message.cardKind === 'MISSING_FILE_EXONERATION' && message.missingFilePayload && (
        <div className="rounded-xl border border-emerald-500/40 bg-slate-900/90 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-extrabold">
              <ShieldCheck className="w-3.5 h-3.5" />
              실물 증거 미리보기 (Zero-Auto-Action)
            </span>
            <span className="text-[11px] text-slate-400 font-semibold">
              {message.missingFilePayload.deletedAtOrSavedAt}
            </span>
          </div>

          <div className="rounded-lg bg-slate-950/90 border border-slate-800 p-2.5 font-mono text-[11px] text-emerald-200 space-y-1">
            {message.missingFilePayload.fiveLinePreview.map((line, i) => (
              <div key={i} className="truncate">
                {line}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
            <button
              type="button"
              onClick={() =>
                void speakWithHyunsuOrSunhi(
                  message.missingFilePayload!.fiveLinePreview.join('. '),
                  'sunhi_doc_reader'
                )
              }
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold flex items-center gap-1"
            >
              <Volume2 className="w-3.5 h-3.5 text-amber-400" />
              👩 선희 아나운서 음성으로 5줄 미리듣기
            </button>

            {message.missingFilePayload.restored ? (
              <span className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-extrabold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                복구 완료 (Z-코어 실행 확인됨)
              </span>
            ) : (
              <button
                type="button"
                disabled={busyId === 'missing'}
                onClick={() => void handleRestoreMissingFile()}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {message.missingFilePayload.caseType === 'CASE_C_OFFICE_AUTORECOVER'
                  ? '⭕ 확인 완료 · 바탕화면에 복구본 만들기'
                  : '⭕ 확인 완료 · 원래 위치로 복구하기'}
              </button>
            )}
          </div>
          {message.missingFilePayload.restoreError && (
            <div className="text-[11px] font-bold text-rose-300">{message.missingFilePayload.restoreError}</div>
          )}
        </div>
      )}

      {/* 3) 대화형 폴더 정리 / 다운로드 설치파일(.apk/.exe) 청소 / 보안 플러그인 동결 미리보기 게이트 */}
      {message.cardKind === 'CLEANUP_PREVIEW_GATE' && message.cleanupPreview && (
        <div className="rounded-xl border border-amber-500/40 bg-slate-900/90 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-extrabold">
              <FolderCheck className="w-3.5 h-3.5" />
              {message.cleanupPreview.summaryTitle}
            </span>
            <span className="text-[11px] font-extrabold text-emerald-400">
              언제나 0원 · {message.cleanupPreview.reclaimSizeLabel}
            </span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            {message.cleanupPreview.previewDescriptionKo}
          </p>

          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg bg-slate-950/80 border border-slate-800 p-2">
              <div className="text-[10px] text-slate-400">'기타_정리함'으로 이동 (실측)</div>
              <div className="text-sm font-black text-amber-300">
                {message.cleanupPreview.moveCount}건
              </div>
            </div>
            <div className="rounded-lg bg-slate-950/80 border border-slate-800 p-2">
              <div className="text-[10px] text-slate-400">대상 파일 합계</div>
              <div className="text-sm font-black text-sky-300">
                {formatBytes(message.cleanupPreview.totalBytes)}
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-slate-950/80 border border-slate-800 p-2.5 text-[11px] text-slate-300 space-y-1">
            <div className="font-bold text-slate-400">📋 옮길 파일 전체 목록 ({message.cleanupPreview.sampleFiles.length}건):</div>
            {message.cleanupPreview.sampleFiles.map((f, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <span className="text-amber-400">•</span>
                <span className="font-mono">{f}</span>
              </div>
            ))}
          </div>

          {message.cleanupPreview.executionError && (
            <div className="text-[11px] font-bold text-rose-300">{message.cleanupPreview.executionError}</div>
          )}
          <div className="flex items-center justify-end gap-2 pt-1">
            {message.cleanupPreview.approved ? (
              <span className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-extrabold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                실행 완료 · [복원 기록 {message.cleanupPreview.createdRestoreId}] 등재됨 (되돌리기 번호)
              </span>
            ) : (
              <button
                type="button"
                disabled={busyId === 'cleanup'}
                onClick={() => void handleApproveCleanup()}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-md"
              >
                <CheckCircle2 className="w-4 h-4" />
                ⭕ 확인 완료 · 그대로 실행해 줘 (언제나 0원)
              </button>
            )}
          </div>
        </div>
      )}

      {/* 4) 자주 가는 사이트 바탕화면 바로가기(.url) 생성 게이트 */}
      {message.cardKind === 'DESKTOP_SHORTCUT_GATE' && message.shortcutPreview && (
        <div className="rounded-xl border border-sky-500/40 bg-slate-900/90 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-500/20 border border-sky-500/40 text-sky-300 text-[11px] font-extrabold">
              🔗 바탕화면 원클릭 바로가기 생성 미리보기
            </span>
            <span className="text-[11px] font-bold text-emerald-400">언제나 0원</span>
          </div>
          <div className="rounded-lg bg-slate-950/80 border border-slate-800 p-2.5 text-xs space-y-1">
            <div className="text-slate-200 font-bold">
              📌 아이콘 이름: <span className="text-sky-300">{message.shortcutPreview.shortcutFileName}</span>
            </div>
            <div className="text-slate-400 font-mono text-[11px]">
              🌐 연결 주소: {message.shortcutPreview.targetUrl}
            </div>
          </div>
          {message.shortcutPreview.executionError && (
            <div className="text-[11px] font-bold text-rose-300">{message.shortcutPreview.executionError}</div>
          )}
          <div className="flex justify-end">
            {message.shortcutPreview.approved ? (
              <span className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-extrabold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                바탕화면 생성 완료 · [복원 기록 {message.shortcutPreview.createdRestoreId}] 저장됨
              </span>
            ) : (
              <button
                type="button"
                disabled={busyId === 'shortcut'}
                onClick={() => void handleApproveShortcut()}
                className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow"
              >
                <CheckCircle2 className="w-4 h-4" />
                ⭕ 확인 완료 · 바탕화면에 바로가기 만들기 (0원)
              </button>
            )}
          </div>
        </div>
      )}

      {/* 5) [복원 기록] 3단계 무결성 사전 검진(🟢/🟡/🔴) 및 1초 타임머신 롤백 */}
      {message.cardKind === 'RESTORE_POINTS_LIST' && message.restorePoints && (
        <div className="rounded-xl border border-violet-500/40 bg-slate-900/90 p-3.5 space-y-2.5">
          <div className="text-xs font-extrabold text-violet-200 flex items-center justify-between">
            <span>🕰️ 최근 [복원 기록] 타임머신 (#번호 = 작업별 1초 되돌리기 영수증 번호 · 0.01초 사전 검진 완료)</span>
            <span className="text-[11px] text-emerald-400">1초 원복 · 언제나 0원</span>
          </div>
          <div className="space-y-2">
            {message.restorePoints.map((pt) => (
              <div
                key={pt.restoreId}
                className="rounded-lg bg-slate-950/90 border border-slate-800 p-2.5 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-black text-white">
                    [{pt.restoreId}] {pt.summary}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                      pt.integrityStatus === 'FULL_RESTORABLE'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : pt.integrityStatus === 'PARTIAL_RESTORABLE'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    }`}
                  >
                    {pt.statusBadge}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">{pt.precheckGuideMessage}</p>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-[10px] text-slate-500">{pt.createdAt}</span>
                  {pt.rolledBack ? (
                    <span className="text-xs font-extrabold text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      원래 위치로 1초 원상복구 완료!
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={
                        pt.integrityStatus === 'UNRESTORABLE' || busyId === pt.restoreId
                      }
                      onClick={() => void handleRollbackPoint(pt.restoreId)}
                      className="px-3 py-1 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-extrabold flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      ↩️ 1초 만에 원래대로 복원
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6) 내 PC 실시간 사양 스캔(200토큰) & 3단계 눈높이(🌱쉬운말/🌿일반/🌳전문가) 전환 */}
      {message.cardKind === 'PC_SPEC_CONSULTATION' && message.pcSpecPayload && (
        <div className="rounded-xl border border-cyan-500/40 bg-slate-900/90 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-cyan-300">
              <Cpu className="w-4 h-4" />
              내 PC 실측 하드웨어 사양 (Z-코어 측정값)
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-extrabold">
              {message.pcSpecPayload.verdictBadge}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <div className="rounded-lg bg-slate-950/80 border border-slate-800 p-2">
              <div className="text-slate-400">두뇌 (CPU)</div>
              <div className="font-bold text-slate-100 truncate">
                {message.pcSpecPayload.cpuModel}
              </div>
            </div>
            <div className="rounded-lg bg-slate-950/80 border border-slate-800 p-2">
              <div className="text-slate-400">작업대 (RAM)</div>
              <div className="font-bold text-emerald-300">
                {message.pcSpecPayload.ramTotalGb ?? '확인 불가'}
                {message.pcSpecPayload.ramTotalGb !== null ? 'GB' : ''}
                {message.pcSpecPayload.ramUsedPercent !== null ? ` (사용 ${message.pcSpecPayload.ramUsedPercent}%)` : ''}
              </div>
            </div>
            <div className="rounded-lg bg-slate-950/80 border border-slate-800 p-2">
              <div className="text-slate-400">그래픽 (GPU)</div>
              <div className="font-bold text-sky-300 truncate">
                {message.pcSpecPayload.gpuModel}
              </div>
            </div>
            <div className="rounded-lg bg-slate-950/80 border border-slate-800 p-2">
              <div className="text-slate-400">여유 공간 (SSD)</div>
              <div className="font-bold text-amber-300 flex items-center gap-1">
                <HardDrive className="w-3 h-3" />
                {message.pcSpecPayload.diskFreeGb !== null ? `${message.pcSpecPayload.diskFreeGb} GB 여유` : '확인 불가'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 pt-1">
            <span className="text-[11px] text-slate-400 font-bold">설명 눈높이 선택:</span>
            {(
              [
                { id: 'easy', label: '🌱 쉬운말(초보)' },
                { id: 'normal', label: '🌿 일반' },
                { id: 'expert', label: '🌳 전문가' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChangeLiteracyLevel(opt.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition ${
                  literacyLevel === opt.id
                    ? 'bg-cyan-500 text-slate-950'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="rounded-lg bg-slate-950/90 border border-cyan-500/30 p-2.5 text-xs text-slate-200 leading-relaxed">
            {literacyLevel === 'easy'
              ? message.pcSpecPayload.easyAnswerKo
              : literacyLevel === 'expert'
              ? message.pcSpecPayload.expertAnswerKo
              : message.pcSpecPayload.normalAnswerKo}
          </div>
        </div>
      )}

      {/* 7) 3대 선 넘기 정직 컷오프 & 애착 AI(Gemini 기본) 라이브 음성 바통 터치 */}
      {message.cardKind === 'BATON_TOUCH_CUTOFF' && message.batonTouchPayload && (
        <div className="rounded-xl border border-fuchsia-500/40 bg-slate-900/90 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-extrabold text-fuchsia-300">
              🤝 유저 애착 AI (기본: Google Gemini) 1초 라이브 음성 바통 터치
            </span>
            <span className="text-[11px] text-slate-400">문서 본문 클립보드 자동 복사</span>
          </div>
          {message.batonTouchPayload.result ? (
            <div className="rounded-lg bg-fuchsia-950/40 border border-fuchsia-500/40 p-2.5 text-xs text-fuchsia-200 space-y-1">
              <div className="font-bold">
                ✅ {message.batonTouchPayload.result.detectedAiLabel} 연결 완료!
              </div>
              <div className="text-[11px] text-slate-300">
                {message.batonTouchPayload.result.ttsBriefingKo}
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={busyId === 'baton'}
              onClick={() => void handleBatonTouch()}
              className="w-full py-2 px-3 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              📋 문서 본문 복사 + 내 애착 AI (Google Gemini) 라이브 상담 창 바로 열기
            </button>
          )}
        </div>
      )}

      {/* 8) 발급된 [디지털 건강검진표] (개인 건강검진 기록함 로컬 자동 보관 완료) */}
      {message.healthRecordIssued && (
        <div className="rounded-xl border border-emerald-400/50 bg-gradient-to-r from-emerald-950/60 via-slate-900 to-teal-950/60 p-3.5 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-300">
              <ClipboardCheck className="w-4 h-4" />
              🩺 [내 기기 디지털 건강검진표 발급 완료] (내 기기 로컬 기록함 자동 보관)
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 text-[11px] font-extrabold">
              {message.healthRecordIssued.reclaimedSizeLabel}
            </span>
          </div>
          <div className="text-xs text-slate-200 font-bold">
            • 조치 항목: {message.healthRecordIssued.title}
          </div>
          <div className="text-[11px] text-emerald-200">
            • 실행 내용: {message.healthRecordIssued.speedUpSummary} (복원 기록{' '}
            {message.healthRecordIssued.restoreId})
          </div>
          <div className="text-[10px] text-slate-400">
            * 이 기록은 상단 [📋 내 기기 건강검진 기록함]에 보관되며, [복원 기록] 번호로 언제든 되돌릴 수 있습니다.
          </div>
        </div>
      )}

      {/* 9) 짝수 회차(2회 완료마다 1번) 1분 숏폼 큐레이션 팁 */}
      {message.shortformTip && (
        <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/25 p-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="space-y-0.5">
            <div className="text-[11px] font-extrabold text-indigo-300 flex items-center gap-1">
              <Film className="w-3.5 h-3.5" />
              {message.shortformTip.title} ({message.shortformTip.durationLabel})
            </div>
            <div className="text-xs text-slate-300">{message.shortformTip.summaryText}</div>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 border border-indigo-500/40 text-indigo-200 text-[11px] font-bold">
            🎬 1분 꿀팁 ({message.shortformTip.targetLounge})
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
}> = ({ records, onClose, onRollbackRestoreId }) => {
  return (
    <div className="rounded-2xl border border-emerald-500/40 bg-slate-900/95 p-4 space-y-3 shadow-xl">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-400" />
          <div>
            <h4 className="text-sm font-black text-white">
              📋 내 기기 건강검진 기록함 (로컬 개인 히스토리)
            </h4>
            <p className="text-[11px] text-slate-400">
              치우기·고치기 완료 시 발급된 건강검진표가 내 기기에 영구 보관됩니다 (언제나 0원 · 외부 서버 전송 없음)
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
        >
          닫기 ✕
        </button>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {records.map((rec) => (
          <div
            key={rec.recordId}
            className="rounded-xl bg-slate-950/90 border border-slate-800 p-3 flex items-center justify-between gap-3 flex-wrap"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[11px] font-extrabold">
                  {rec.category}
                </span>
                <span className="text-xs font-extrabold text-white">{rec.title}</span>
                <span className="text-[11px] text-emerald-400 font-bold">({rec.reclaimedSizeLabel})</span>
              </div>
              <div className="text-[11px] text-slate-300">{rec.speedUpSummary}</div>
              <div className="text-[10px] text-slate-500">
                발급 일시: {rec.issuedAt} {rec.restoreId ? `· 복원 기록 ${rec.restoreId}` : ''}
              </div>
            </div>
            {rec.restoreId && onRollbackRestoreId && (
              <button
                type="button"
                onClick={() => onRollbackRestoreId(rec.restoreId!)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-violet-300 text-[11px] font-extrabold flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {rec.restoreId} 원복
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
