import React, { useState } from 'react';
import {
  CheckCircle2,
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
  formatBytes,
  triggerUserFavoriteAiLiveVoiceBatonTouch,
} from '../services/monsterChatRouter';
import { useSaySeeStore } from '../store/useSaySeeStore';
import {
  submitStudioSupportTicket,
  buildStudioSupportJumpUrl,
} from '../services/merlin-hub-sdk/Support/blackbox';
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
  onUpdateMessage,
  onJumpToSearch,
  onToast,
}) => {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showAllRestorePoints, setShowAllRestorePoints] = useState(false);
  const [restoreFilterText, setRestoreFilterText] = useState('');
  const [extraSupportKind, setExtraSupportKind] = useState<'CLAIM' | 'AS_BUG' | 'IDEA'>('IDEA');
  const [extraSupportText, setExtraSupportText] = useState('');
  const [extraSupportSending, setExtraSupportSending] = useState(false);

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
              <span>검색 키워드: &ldquo;{message.searchKeyword}&rdquo;</span>
            </div>
            <button
              type="button"
              onClick={() => onJumpToSearch(message.searchKeyword!)}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow"
            >
              <Sparkles className="w-3.5 h-3.5" />
              🎯 [찾기] 탭에서 바로 열기
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
              실물 증거 미리보기
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
              👩 음성으로 미리듣기
            </button>

            {message.missingFilePayload.restored ? (
              <span className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-extrabold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                복구 및 블랙박스 기록 완료
                {message.missingFilePayload.approvedTypedText
                  ? ` · 승인 발화: "${message.missingFilePayload.approvedTypedText}"`
                  : ''}
              </span>
            ) : (
              <div className="rounded-lg bg-slate-950/90 border border-emerald-500/30 px-3 py-1.5 text-[11px] text-emerald-200 font-semibold">
                ✍️ 복구하시려면 아래 채팅창에 <strong>&ldquo;응 복구해줘&rdquo;</strong>처럼 편하게 타이핑해 주세요 (블랙박스에 기록됩니다)
              </div>
            )}
          </div>
          {message.missingFilePayload.restoreError && (
            <div className="text-[11px] font-bold text-rose-300">{message.missingFilePayload.restoreError}</div>
          )}
        </div>
      )}

      {/* 3) 대화형 폴더 정리 / 다운로드 설치파일(.apk/.exe) 청소 미리보기 게이트 */}
      {message.cardKind === 'CLEANUP_PREVIEW_GATE' && message.cleanupPreview && (
        <div className="rounded-xl border border-amber-500/40 bg-slate-900/90 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-extrabold">
              <FolderCheck className="w-3.5 h-3.5" />
              {message.cleanupPreview.summaryTitle}
            </span>
            <span className="text-[11px] font-extrabold text-emerald-400">
              {message.cleanupPreview.reclaimSizeLabel}
            </span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            {message.cleanupPreview.previewDescriptionKo}
          </p>

          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg bg-slate-950/80 border border-slate-800 p-2">
              <div className="text-[10px] text-slate-400">&apos;기타_정리함&apos;으로 이동 대상</div>
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
            <div className="font-bold text-slate-400">📋 정리 대상 파일 목록 ({message.cleanupPreview.sampleFiles.length}건):</div>
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
          <div className="pt-1">
            {message.cleanupPreview.approved ? (
              <div className="px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-extrabold flex items-center justify-between gap-2 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  실행 및 블랙박스 기록 완료 · [복원 기록 {message.cleanupPreview.createdRestoreId}]
                </span>
                {message.cleanupPreview.approvedTypedText && (
                  <span className="text-[11px] text-emerald-200 font-mono">
                    승인 발화: &ldquo;{message.cleanupPreview.approvedTypedText}&rdquo;
                  </span>
                )}
              </div>
            ) : (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-200 font-semibold leading-relaxed">
                ✍️ <strong>블랙박스 타이핑 승인 대기</strong> — 실행하시려면 아래 채팅창에{' '}
                <strong>&ldquo;응 진행해&rdquo;</strong>, <strong>&ldquo;네 정리해 주세요&rdquo;</strong>처럼 편하게 입력해 주세요. (타이핑하신 동의 문장이 블랙박스에 그대로 기록됩니다)
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4) 자주 가는 사이트 바탕화면 바로가기(.url) 생성 게이트 */}
      {message.cardKind === 'DESKTOP_SHORTCUT_GATE' && message.shortcutPreview && (
        <div className="rounded-xl border border-sky-500/40 bg-slate-900/90 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-500/20 border border-sky-500/40 text-sky-300 text-[11px] font-extrabold">
              🔗 바탕화면 바로가기 생성 미리보기
            </span>
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
          <div>
            {message.shortcutPreview.approved ? (
              <div className="px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-extrabold flex items-center justify-between gap-2 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  바탕화면 생성 및 블랙박스 기록 완료 · [복원 기록 {message.shortcutPreview.createdRestoreId}]
                </span>
                {message.shortcutPreview.approvedTypedText && (
                  <span className="text-[11px] text-emerald-200 font-mono">
                    승인 발화: &ldquo;{message.shortcutPreview.approvedTypedText}&rdquo;
                  </span>
                )}
              </div>
            ) : (
              <div className="rounded-lg bg-sky-500/10 border border-sky-500/30 px-3 py-2 text-xs text-sky-200 font-semibold leading-relaxed">
                ✍️ <strong>블랙박스 타이핑 승인 대기</strong> — 생성하시려면 아래 채팅창에{' '}
                <strong>&ldquo;응 진행해&rdquo;</strong>, <strong>&ldquo;네 만들어 주세요&rdquo;</strong>처럼 편하게 입력해 주세요.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5) [복원 기록] 3단계 무결성 사전 검진(🟢/🟡/🔴) 및 자연어 타이핑 원복 (수십 개여도 최근 3건 기본 + 더보기/검색) */}
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
          <div className="rounded-xl border border-violet-500/40 bg-slate-900/90 p-3.5 space-y-2.5">
            <div className="text-xs font-extrabold text-violet-200 flex items-center justify-between flex-wrap gap-2">
              <span>🕰️ [복원 기록] 히스토리 (총 {message.restorePoints.length}건)</span>
              <span className="text-[11px] text-violet-300 font-semibold">
                ✍️ 채팅창에 &ldquo;1번 복원해줘&rdquo;(또는 &ldquo;#번호&rdquo;)를 타이핑해 선택
              </span>
            </div>

            {message.restorePoints.length > 4 && (
              <input
                type="text"
                value={restoreFilterText}
                onChange={(e) => setRestoreFilterText(e.target.value)}
                placeholder="🔍 복원 지점이 많을 땐 번호(#12)·날짜·작업명으로 바로 검색..."
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500/50"
              />
            )}

            <div className="space-y-2 max-h-64 overflow-y-auto pr-0.5">
              {visiblePts.map((pt) => (
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
                  <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                    <span className="text-[10px] text-slate-500">{pt.createdAt}</span>
                    {pt.rolledBack ? (
                      <span className="text-xs font-extrabold text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        원위치 복원 및 블랙박스 기록 완료
                        {pt.rollbackTypedText ? ` · "${pt.rollbackTypedText}"` : ''}
                      </span>
                    ) : (
                      <span className="text-[11px] text-violet-300 font-semibold">
                        선택 타이핑: <code>&ldquo;{pt.restoreId.replace('#', '')}번 복원해줘&rdquo;</code>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {filteredPts.length > 3 && !q && (
              <button
                type="button"
                onClick={() => setShowAllRestorePoints((v) => !v)}
                className="w-full py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[11px] font-bold text-violet-300 transition"
              >
                {showAllRestorePoints
                  ? '▴ 최근 3건만 심플하게 보기'
                  : `▾ 이전 복원 기록 더 보기 (외 ${hiddenCount}건)`}
              </button>
            )}
          </div>
        );
      })()}

      {/* 6) 내 PC 실시간 사양 스캔(200토큰) 카드 (심플 노션 스타일) */}
      {message.cardKind === 'PC_SPEC_CONSULTATION' && message.pcSpecPayload && (
        <div className="rounded-xl border border-cyan-500/30 bg-slate-900/90 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-cyan-300">
              <Cpu className="w-4 h-4" />
              내 PC 실측 하드웨어 요약
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-extrabold">
              {message.pcSpecPayload.verdictBadge}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <div className="rounded-lg bg-slate-950/80 border border-slate-800 p-2">
              <div className="text-slate-400">CPU</div>
              <div className="font-bold text-slate-100 truncate">
                {message.pcSpecPayload.cpuModel}
              </div>
            </div>
            <div className="rounded-lg bg-slate-950/80 border border-slate-800 p-2">
              <div className="text-slate-400">메모리 (RAM)</div>
              <div className="font-bold text-emerald-300">
                {message.pcSpecPayload.ramTotalGb ?? '확인 불가'}
                {message.pcSpecPayload.ramTotalGb !== null ? 'GB' : ''}
                {message.pcSpecPayload.ramUsedPercent !== null ? ` (${message.pcSpecPayload.ramUsedPercent}%)` : ''}
              </div>
            </div>
            <div className="rounded-lg bg-slate-950/80 border border-slate-800 p-2">
              <div className="text-slate-400">그래픽 (GPU)</div>
              <div className="font-bold text-sky-300 truncate">
                {message.pcSpecPayload.gpuModel}
              </div>
            </div>
            <div className="rounded-lg bg-slate-950/80 border border-slate-800 p-2">
              <div className="text-slate-400">여유 공간</div>
              <div className="font-bold text-amber-300 flex items-center gap-1">
                <HardDrive className="w-3 h-3" />
                {message.pcSpecPayload.diskFreeGb !== null ? `${message.pcSpecPayload.diskFreeGb} GB 여유` : '확인 불가'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7) 3대 선 넘기 정직 컷오프 & 애착 AI(Gemini 기본) 라이브 음성 바통 터치 */}
      {message.cardKind === 'BATON_TOUCH_CUTOFF' && message.batonTouchPayload && (
        <div className="rounded-xl border border-fuchsia-500/40 bg-slate-900/90 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-extrabold text-fuchsia-300">
              🤝 단골 AI (기본: Google Gemini) 1초 바통 터치
            </span>
            <span className="text-[11px] text-slate-400">질문 내용 클립보드 자동 복사</span>
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
              📋 질문 복사 + 내 단골 AI 상담 창 열기
            </button>
          )}
        </div>
      )}

      {/* 8) 발급된 [디지털 건강검진표] (개인 건강검진 기록함 로컬 자동 보관 완료) */}
      {message.healthRecordIssued && (
        <div className="rounded-xl border border-emerald-400/40 bg-slate-900/90 p-3 space-y-1.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-300">
              <ClipboardCheck className="w-4 h-4" />
              🩺 디지털 건강검진 기록 보관 완료
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 text-[11px] font-extrabold">
              {message.healthRecordIssued.reclaimedSizeLabel}
            </span>
          </div>
          <div className="text-xs text-slate-200 font-bold">
            • {message.healthRecordIssued.title}
          </div>
          <div className="text-[11px] text-emerald-200">
            • {message.healthRecordIssued.speedUpSummary} (복원 번호: {message.healthRecordIssued.restoreId})
          </div>
        </div>
      )}

      {/* 9) 💁‍♂️ 귀신같이 인포메이션 데스크 (자체 기능 · 요금 · 업데이트 안내 + 바로가기 버튼) */}
      {message.cardKind === 'GHOSTI_INFO_DESK' && message.infoDeskPayload && (
        <div className="rounded-xl border border-teal-500/45 bg-slate-900/95 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-500/20 border border-teal-400/40 text-teal-300 text-[11px] font-extrabold">
              <Sparkles className="w-3.5 h-3.5" />
              {message.infoDeskPayload.topicBadge}
            </span>
          </div>
          <div className="text-xs font-extrabold text-white">
            {message.infoDeskPayload.title}
          </div>
          <ul className="space-y-1.5 text-[11.5px] text-slate-200 leading-relaxed">
            {message.infoDeskPayload.bulletPoints.map((pt, idx) => (
              <li key={idx} className="bg-slate-950/80 border border-slate-800/80 rounded-lg px-2.5 py-1.5">
                {pt}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2 pt-1">
            {message.infoDeskPayload.actionButtons.map((btn, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  const st = useSaySeeStore.getState();
                  if (btn.actionType === 'OPEN_PRICING_MODAL') {
                    st.setShowProModal(true);
                  } else if (btn.actionType === 'OPEN_ONBOARDING_TAB1') {
                    window.dispatchEvent(
                      new CustomEvent('ghosti_open_onboarding_tab', { detail: { tab: 'tab1_find_care' } })
                    );
                  } else if (btn.actionType === 'OPEN_ONBOARDING_TAB2') {
                    window.dispatchEvent(
                      new CustomEvent('ghosti_open_onboarding_tab', { detail: { tab: 'tab2_superpower' } })
                    );
                  } else if (btn.actionType === 'OPEN_ONBOARDING_TAB3') {
                    window.dispatchEvent(
                      new CustomEvent('ghosti_open_onboarding_tab', { detail: { tab: 'tab3_share_pro' } })
                    );
                  } else if (btn.actionType === 'JUMP_SEARCH') {
                    onJumpToSearch('');
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 text-[11.5px] font-black cursor-pointer shadow"
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 10) 🎛️ 말 한마디로 모든 앱 설정·상용구 변경 마스터 컨트롤 센터 완료 카드 */}
      {message.cardKind === 'APP_SETTINGS_CONTROL' && message.appSettingsPayload && (
        <div
          className={`rounded-xl border p-3.5 space-y-2 ${
            message.appSettingsPayload.isBlockedByFilter
              ? 'border-rose-500/45 bg-rose-950/20'
              : 'border-emerald-500/45 bg-slate-900/95'
          }`}
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                message.appSettingsPayload.isBlockedByFilter
                  ? 'bg-rose-500/20 border border-rose-400/50 text-rose-200'
                  : 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-300'
              }`}
            >
              {message.appSettingsPayload.badgeText}
            </span>
            <span className="text-[11px] font-mono font-bold text-amber-300">
              {message.appSettingsPayload.appliedValueLabel}
            </span>
          </div>
          <p className="text-xs text-slate-200 leading-relaxed">
            {message.appSettingsPayload.summaryText}
          </p>
          {message.appSettingsPayload.isBlockedByFilter && (
            <button
              type="button"
              onClick={() => useSaySeeStore.getState().setShowProModal(true)}
              className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11.5px] font-black cursor-pointer"
            >
              👑 패밀리(5,900원) · 업무 공유(9,900원) 요금제 보기 →
            </button>
          )}
        </div>
      )}

      {/* 11) 📮 클레임 · A/S 접수 · 아이디어 제안 스튜디오 대리 접수 & [나의 문의방] 직행 링크 카드 */}
      {message.cardKind === 'STUDIO_SUPPORT_PROXY' && message.studioSupportPayload && (
        <div className="rounded-xl border border-amber-400/50 bg-slate-900/95 p-3.5 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[11px] font-black">
              {message.studioSupportPayload.badgeLabel}
            </span>
            <span className="text-[11px] font-mono text-emerald-300 font-bold">
              접수번호 #{message.studioSupportPayload.ticketId} · 회원 {message.studioSupportPayload.userEmail}
            </span>
          </div>

          <div className="rounded-lg bg-slate-950/90 border border-slate-800 p-2.5 text-xs text-slate-200 space-y-1">
            <div className="text-[11px] text-slate-400 font-bold">📝 스튜디오에 전달된 접수 원문:</div>
            <div className="font-semibold text-white">{message.studioSupportPayload.userComment}</div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <a
              href={message.studioSupportPayload.studioJumpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-2.5 px-3.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-black flex items-center justify-center gap-1.5 shadow-[0_0_16px_rgba(16,185,129,0.3)]"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>👉 스튜디오 [나의 문의방]에서 IDE 자동 작업 결과 보러 가기 ↗</span>
            </a>
          </div>

          {/* 추가 클레임 / A/S / 아이디어 1초 구분 접수 미니 입력줄 */}
          <div className="pt-2 border-t border-slate-800 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="text-slate-400 font-bold">추가 접수 구분:</span>
              {(
                [
                  { id: 'CLAIM' as const, label: '🚨 클레임' },
                  { id: 'AS_BUG' as const, label: '🛠️ A/S·오류' },
                  { id: 'IDEA' as const, label: '💡 아이디어' },
                ]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setExtraSupportKind(tab.id)}
                  className={`px-2 py-0.5 rounded font-bold cursor-pointer ${
                    extraSupportKind === tab.id
                      ? 'bg-amber-400 text-slate-950 font-black'
                      : 'bg-slate-950 text-slate-300 border border-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={extraSupportText}
                onChange={(e) => setExtraSupportText(e.target.value)}
                placeholder="추가로 전달할 클레임·A/S·아이디어를 입력하면 회원 이름으로 즉시 스튜디오에 접수됩니다..."
                className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-[11.5px] text-white outline-none focus:border-amber-400"
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
                      ? '🚨 클레임(불만·환불·개선) 접수'
                      : extraSupportKind === 'IDEA'
                      ? '💡 신규 아이디어·기능 제안 접수'
                      : '🛠️ A/S · 오류 · 버그 수리 접수';
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
                  onToast?.(`📮 [${badge}] 스튜디오 대리 접수 완료 (#${newTid})`);
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 text-[11.5px] font-black cursor-pointer shrink-0"
              >
                {extraSupportSending ? '접수 중...' : '스튜디오 접수'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 12) 짝수 회차(2회 완료마다 1번) 1분 숏폼 큐레이션 팁 */}
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
}> = ({ records, onClose }) => {
  return (
    <div className="rounded-2xl border border-emerald-500/40 bg-slate-900/95 p-4 space-y-3 shadow-xl">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-400" />
          <div>
            <h4 className="text-sm font-black text-white">
              📋 내 기기 건강검진 & 블랙박스 기록함
            </h4>
            <p className="text-[11px] text-slate-400">
              자연어 타이핑으로 승인·원복한 내역이 내 기기에 영구 보관됩니다.
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
                기록 일시: {rec.issuedAt} {rec.restoreId ? `· 복원 번호 ${rec.restoreId}` : ''}
              </div>
            </div>
            {rec.restoreId && (
              <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-violet-300 text-[11px] font-semibold">
                채팅창에 &ldquo;{rec.restoreId} 되돌려줘&rdquo; 입력 시 원복
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
