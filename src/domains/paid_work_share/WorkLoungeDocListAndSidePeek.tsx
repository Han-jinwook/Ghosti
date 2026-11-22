import React from 'react';
import type { PricingPlanId } from '../../types/saysee';
import {
  cacheWorkRoomPreviewLocally,
  deleteWorkFileShared,
  downloadWorkFileOriginal,
  readCachedMyWorkRoomMeta,
  type WorkDeletedTombstoneMap,
  type WorkLoungeDocDto,
} from '../../services/workRoomSyncService';

export interface WorkLoungeDocListAndSidePeekProps {
  isSidePeekOpen: boolean;
  setIsSidePeekOpen: React.Dispatch<React.SetStateAction<boolean>>;
  viewMode: 'semantic' | 'explorer';
  filteredDocs: WorkLoungeDocDto[];
  selectedDoc: WorkLoungeDocDto | null;
  setSelectedDocId: React.Dispatch<React.SetStateAction<string>>;
  isZCoreConnected: boolean;
  isMobileOrStore: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleOpenSDriveExplorer: () => Promise<void>;
  openZCoreConnectModal: () => void;
  searchQuery: string;
  activeWorkRoomId: string;
  inviteMeta: { inviteToken?: string };
  myRoomRole: 'host' | 'editor' | 'viewer';
  actorNickname: string;
  merlinAuthEmail?: string;
  inFlightDeletesRef: React.MutableRefObject<Set<string>>;
  mergeAndPersistTombstones: (incoming: WorkDeletedTombstoneMap) => void;
  remoteDocsRef: React.MutableRefObject<WorkLoungeDocDto[]>;
  localDocsRef: React.MutableRefObject<WorkLoungeDocDto[]>;
  setRemoteDocs: React.Dispatch<React.SetStateAction<WorkLoungeDocDto[]>>;
  setLocalDocs: React.Dispatch<React.SetStateAction<WorkLoungeDocDto[]>>;
  setLastDeletedUndoItem: React.Dispatch<React.SetStateAction<{ doc: WorkLoungeDocDto; deletedAt: string } | null>>;
  realtimeRef: React.RefObject<{ broadcastFileDeleted: (relPath: string, deletedAt: string) => void } | null>;
  showToast: (msg: string) => void;
  docActionNotice: string | null;
  setDocActionNotice: React.Dispatch<React.SetStateAction<string | null>>;
  isStoreAppMode: boolean;
  isWorkPaidActive: boolean;
  activatePricingPlan: (planId: PricingPlanId) => void;
  setShowProModal: (show: boolean) => void;
}

export const WorkLoungeDocListAndSidePeek: React.FC<WorkLoungeDocListAndSidePeekProps> = ({
  isSidePeekOpen,
  setIsSidePeekOpen,
  viewMode,
  filteredDocs,
  selectedDoc,
  setSelectedDocId,
  isZCoreConnected,
  isMobileOrStore,
  fileInputRef,
  handleOpenSDriveExplorer,
  openZCoreConnectModal,
  searchQuery,
  activeWorkRoomId,
  inviteMeta,
  myRoomRole,
  actorNickname,
  merlinAuthEmail,
  inFlightDeletesRef,
  mergeAndPersistTombstones,
  remoteDocsRef,
  localDocsRef,
  setRemoteDocs,
  setLocalDocs,
  setLastDeletedUndoItem,
  realtimeRef,
  showToast,
  docActionNotice,
  setDocActionNotice,
  isStoreAppMode,
  isWorkPaidActive,
  activatePricingPlan,
  setShowProModal,
}) => {
  const merlinAuth = { email: merlinAuthEmail };
  // 2. 문서 리스트 + 우측 Side Peek 프리뷰
  return (
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        <div className={`${isSidePeekOpen ? 'xl:col-span-7' : 'xl:col-span-12'} flex flex-col transition-all`}>
          <div className="rounded-2xl bg-white dark:bg-[#18181B] border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-zinc-950/70 border-b border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-1.5 text-[11.5px] text-slate-600 dark:text-zinc-400 font-bold">
              <span className="break-keep">
                {viewMode === 'explorer' ? '🗂️ 폴더별 보기' : '🔍 본문·표 내용 검색'} ({filteredDocs.length}건) · 항목을 클릭하면{' '}
                <span className="xl:hidden">아래에 상세 표·미리보기가 열립니다</span>
                <span className="hidden xl:inline">우측에 상세 표·미리보기가 열립니다</span>
              </span>
              {isSidePeekOpen && (
                <button
                  type="button"
                  onClick={() => setIsSidePeekOpen(false)}
                  className="text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-white text-[11px] font-bold shrink-0 cursor-pointer"
                >
                  <span className="xl:hidden">미리보기 닫기 ✕</span>
                  <span className="hidden xl:inline">우측 미리보기 닫기 ✕</span>
                </button>
              )}
            </div>

            {filteredDocs.length === 0 ? (
              <div className="px-4 py-10 text-center flex flex-col items-center gap-2.5">
                <span className="text-[28px]">📂</span>
                <p className="font-headline-sm text-[14px] text-slate-700 dark:text-zinc-200 font-bold break-keep">
                  아직 연결된 공용 업무 문서가 없습니다 (0건)
                </p>
                <p className="font-body-sm text-[12px] text-slate-500 dark:text-zinc-400 break-keep max-w-lg">
                  사내 대장 PC의 공용 폴더(S: 드라이브)에 실제 업무 문서·현장 사진을 넣거나 위 [📤 업무 파일 추가]로 올리면 실시간 표시되며, [👻 귀신검색창]에서 열지 않고 0.1초 만에 본문을 소환할 수 있습니다.
                </p>
                <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                  {isZCoreConnected ? (
                    <>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3.5 py-2 rounded-xl bg-[#2DD4BF] hover:bg-[#5EEAD4] text-zinc-950 font-label-sm text-[12px] font-black cursor-pointer"
                      >
                        📤 S:\ 드라이브에 첫 업무 파일 올리기
                      </button>
                      {!isMobileOrStore && (
                        <button
                          type="button"
                          onClick={() => void handleOpenSDriveExplorer()}
                          className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-200 font-label-sm text-[12px] font-bold cursor-pointer"
                        >
                          📂 윈도우 탐색기 S:\ 폴더 열기
                        </button>
                      )}
                    </>
                  ) : !isMobileOrStore ? (
                    <button
                      type="button"
                      onClick={openZCoreConnectModal}
                      className="px-4 py-2 rounded-xl bg-[#2DD4BF] hover:bg-[#5EEAD4] text-zinc-950 font-label-sm text-[12px] font-black cursor-pointer"
                    >
                      ⚡ PC 엔진 연결하고 S:\ 드라이브 바로 만들기
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3.5 py-2 rounded-xl bg-[#2DD4BF] hover:bg-[#5EEAD4] text-zinc-950 font-label-sm text-[12px] font-black cursor-pointer"
                    >
                      📤 현장 사진·업무 파일 올리기
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-slate-100 dark:divide-white/8">
                {filteredDocs.map((doc) => {
                  const isSelected = isSidePeekOpen && selectedDoc && doc.id === selectedDoc.id;
                  return (
                    <div
                      key={doc.id}
                      onClick={() => {
                        if (isSelected) {
                          setIsSidePeekOpen(false);
                        } else {
                          setSelectedDocId(doc.id);
                          setIsSidePeekOpen(true);
                        }
                      }}
                      className={`px-4 py-3 flex flex-col gap-1.5 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-teal-50/80 dark:bg-cyan-950/35'
                          : 'hover:bg-slate-50 dark:hover:bg-zinc-900/70'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span
                            className={`px-2 py-0.5 rounded font-label-sm text-[10px] font-extrabold shrink-0 ${
                              doc.ext === 'XLSX' || doc.ext === 'XLS' || doc.ext === 'CSV'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                                : doc.ext === 'DOCX' ||
                                  doc.ext === 'DOC' ||
                                  doc.ext === 'HWP' ||
                                  doc.ext === 'HWPX' ||
                                  doc.ext === 'TXT'
                                ? 'bg-blue-500/20 text-blue-300 border border-blue-400/40'
                                : doc.ext === 'PDF'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-400/40'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                            }`}
                          >
                            {doc.ext}
                          </span>
                          <span className="font-label-md text-[13.5px] text-slate-900 dark:text-white font-bold truncate">
                            {doc.fileName}
                          </span>
                          <span className="hidden md:inline text-[11.5px] text-slate-500 dark:text-zinc-400 truncate">
                            · {doc.summaryTitle.replace(/\[.*?\]\s*/g, '')}
                          </span>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className="hidden sm:inline text-[11px] text-slate-500 dark:text-zinc-400">
                            {doc.folderPath} · {doc.sizeLabel} · {doc.updatedAt}
                          </span>
                          {doc.lockedBy ? (
                            <span className="px-2.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/60 text-amber-200 font-label-sm text-[10.5px] font-extrabold">
                              🔒 현재 {doc.lockedBy}님이 사용 중
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 font-label-sm text-[10.5px] font-bold">
                              🔓 수정 가능
                            </span>
                          )}
                        </div>
                      </div>

                      {searchQuery.trim() && (
                        <div className="pl-11 text-[12px] text-cyan-200 truncate">
                          📌 {doc.matchedSnippet}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 우측 Side Peek 패널 */}
        {isSidePeekOpen && selectedDoc && (
          <div className="xl:col-span-5 p-4 md:p-5 rounded-2xl bg-[#18181B] border border-cyan-400/40 shadow-xl flex flex-col gap-3.5 xl:sticky xl:top-16">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-white/10">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-400 text-zinc-950 font-label-sm text-[11px] font-extrabold shrink-0">
                  📄 문서 내용 미리보기
                </span>
                <span className="text-[11px] text-zinc-400 font-bold">
                  {selectedDoc.author} · {selectedDoc.updatedAt}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsSidePeekOpen(false)}
                className="px-2 py-0.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-[11.5px] font-bold shrink-0 cursor-pointer"
              >
                ✕ 닫기
              </button>
            </div>

            <div className="flex flex-col gap-1 min-w-0">
              <span className="font-label-sm text-[11px] text-cyan-300 font-bold break-all">
                {selectedDoc.folderPath}\{selectedDoc.fileName}
              </span>
              <h3 className="font-headline-sm text-[16px] text-white font-extrabold leading-snug">
                {selectedDoc.summaryTitle.replace(/\[.*?\]\s*/g, '')}
              </h3>
            </div>

            {selectedDoc.lockedBy ? (
              <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-400/50 flex flex-col gap-2.5">
                <div className="flex flex-col gap-0.5">
                  <span className="font-label-sm text-[12.5px] text-amber-200 font-extrabold">
                    🔒 현재 [{selectedDoc.lockedBy}]님이 사용 중입니다. 읽기 모드로 열립니다.
                  </span>
                  <span className="font-body-sm text-[11px] text-zinc-300">
                    다른 팀원이 편집 중일 때는 덮어쓰기 충돌 방지를 위해 읽기 모드로 안전하게 열립니다.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void downloadWorkFileOriginal(selectedDoc, {
                      roomId: activeWorkRoomId,
                      inviteToken: inviteMeta.inviteToken,
                    })
                  }
                  className="w-full py-1.5 px-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-sm text-[11.5px] font-extrabold cursor-pointer text-center"
                >
                  👁️ 읽기 모드로 열기
                </button>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-400/30 flex items-center justify-between gap-2">
                <span className="font-label-sm text-[11.5px] text-emerald-300 font-bold">
                  🔓 현재 사용 중인 팀원이 없습니다 — 바로 편집 가능
                </span>
              </div>
            )}

            {selectedDoc.isImage && selectedDoc.imageBase64 && (
              <div className="p-3 rounded-xl bg-zinc-950 border border-cyan-400/30 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-label-sm text-[11.5px] text-cyan-300 font-extrabold">
                    🖼️ 이미지 원본 실시간 미리보기
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    {selectedDoc.ext} · {selectedDoc.sizeLabel}
                  </span>
                </div>
                <div className="w-full flex items-center justify-center p-2 rounded-lg bg-black/40 border border-white/5 overflow-hidden">
                  <img
                    src={selectedDoc.imageBase64}
                    alt={selectedDoc.fileName}
                    className="max-h-64 object-contain rounded"
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <span className="font-label-sm text-[11.5px] text-zinc-300 font-extrabold">
                📊 표 핵심 내용
              </span>
              <div className="overflow-x-auto rounded-xl border border-white/10 bg-zinc-950">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-900 border-b border-white/10">
                      {selectedDoc.tableHeaders.map((h, hIdx) => (
                        <th
                          key={`${h}-${hIdx}`}
                          className="px-2.5 py-2 font-label-sm text-[11px] text-cyan-300 font-extrabold whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {selectedDoc.tableRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-zinc-900/50">
                        {row.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            className="px-2.5 py-1.5 font-body-sm text-[11.5px] text-zinc-200"
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-zinc-950 border border-white/10 flex flex-col gap-1 max-h-56 overflow-y-auto">
              <span className="font-label-sm text-[11px] text-emerald-300 font-extrabold">
                📄 본문 주요 내용
              </span>
              <p className="font-body-sm text-[12px] text-zinc-200 whitespace-pre-line leading-relaxed">
                {selectedDoc.fullTextPreview}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={async () => {
                  const ok = await downloadWorkFileOriginal(selectedDoc, {
                    roomId: activeWorkRoomId,
                    inviteToken: inviteMeta.inviteToken,
                  });
                  setDocActionNotice(
                    ok
                      ? `⬇️ '${selectedDoc.fileName}' 원본 파일(${selectedDoc.sizeLabel}) 다운로드가 시작되었습니다!`
                      : `⚠️ 원본 파일을 받으려면 대장 PC 연결 상태이거나 내 컴퓨터 연결(PC 엔진)이 필요합니다.`
                  );
                }}
                className="px-3 py-1.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-label-sm text-[11.5px] font-extrabold cursor-pointer flex items-center gap-1"
              >
                <span>⬇️ 원본 파일 다운로드</span>
              </button>

              {myRoomRole !== 'viewer' && (
                <button
                  type="button"
                  onClick={async () => {
                    const targetDoc = selectedDoc;
                    const targetRel = targetDoc.relPath;
                    const targetName = targetDoc.fileName;
                    const nowIso = new Date().toISOString();
                    inFlightDeletesRef.current.add(targetRel);
                    try {
                      mergeAndPersistTombstones({
                        [targetRel.toLowerCase()]: {
                          relPath: targetRel,
                          deletedAt: nowIso,
                          deletedBy: actorNickname,
                        },
                      });
                      const nextRemote = remoteDocsRef.current.filter((d) => d.relPath !== targetRel);
                      const nextLocal = localDocsRef.current.filter((d) => d.relPath !== targetRel);
                      localDocsRef.current = nextLocal;
                      setRemoteDocs(nextRemote);
                      setLocalDocs(nextLocal);
                      setLastDeletedUndoItem({ doc: targetDoc, deletedAt: nowIso });
                      if (activeWorkRoomId) {
                        void cacheWorkRoomPreviewLocally(
                          activeWorkRoomId,
                          nextRemote,
                          merlinAuth?.email || undefined
                        );
                      }
                      realtimeRef.current?.broadcastFileDeleted(targetRel, nowIso);
                      const delRes = await deleteWorkFileShared({
                        roomId:
                          activeWorkRoomId ||
                          readCachedMyWorkRoomMeta(merlinAuth?.email || undefined)?.roomId ||
                          '',
                        relPath: targetRel,
                        actorNickname,
                        deletedAt: nowIso,
                      });
                      if (delRes.deletedTombstones) {
                        mergeAndPersistTombstones(delRes.deletedTombstones);
                      }
                      if (!delRes.ok) {
                        showToast(
                          delRes.message ||
                            `⚠️ '${targetName}' 파일을 휴지통으로 옮기지 못해 그대로 보존했습니다.`
                        );
                      } else {
                        showToast(
                          `🗑️ '${targetName}' 파일이 윈도우 [휴지통]으로 안전하게 이동되었습니다. (상단 [↩️ 1초 실행 취소]로 즉시 복원 가능)`
                        );
                      }
                    } finally {
                      inFlightDeletesRef.current.delete(targetRel);
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/50 text-rose-200 font-label-sm text-[11.5px] font-extrabold cursor-pointer flex items-center gap-1"
                >
                  <span>🗑️ 휴지통으로 이동</span>
                </button>
              )}
            </div>

            {docActionNotice && (
              <div className="p-2.5 rounded-xl bg-emerald-950/90 border border-emerald-400/50 text-emerald-200 font-body-sm text-[11.5px] font-bold flex items-center justify-between gap-2">
                <span>{docActionNotice}</span>
                <button
                  type="button"
                  onClick={() => setDocActionNotice(null)}
                  className="text-[11px] text-emerald-300 hover:text-white font-extrabold px-2 py-0.5 rounded bg-emerald-900/60 shrink-0"
                >
                  닫기
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="font-body-sm text-[11px] text-zinc-400">
                파일 크기: {selectedDoc.sizeLabel} · 위치: {selectedDoc.folderPath} · 올린 사람: {selectedDoc.author}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {!isStoreAppMode && !isWorkPaidActive && (
                  <>
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('work_soho_9900')}
                      className="px-3 py-1.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-zinc-950 font-label-sm text-[11.5px] font-extrabold cursor-pointer"
                    >
                      💼 소호(~5인) 월 9,900원 구독
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowProModal(true)}
                      className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-200 font-label-sm text-[11.5px] font-bold cursor-pointer"
                    >
                      요금제 안내 보기
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
  );
};
