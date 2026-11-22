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

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
      <div className={`${isSidePeekOpen ? 'xl:col-span-7' : 'xl:col-span-12'} flex flex-col transition-all`}>
        <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-1.5 text-[12px] text-slate-600 font-medium">
            <span className="break-keep">
              {viewMode === 'explorer' ? '폴더별 보기' : '본문·표 내용 검색'} ({filteredDocs.length}건) · 항목을 선택하면{' '}
              <span className="xl:hidden">아래에 미리보기가 열립니다</span>
              <span className="hidden xl:inline">우측에 미리보기가 열립니다</span>
            </span>
            {isSidePeekOpen && (
              <button
                type="button"
                onClick={() => setIsSidePeekOpen(false)}
                className="text-slate-500 hover:text-slate-900 text-[11.5px] font-medium shrink-0 cursor-pointer"
              >
                <span className="xl:hidden">미리보기 닫기 ✕</span>
                <span className="hidden xl:inline">우측 미리보기 닫기 ✕</span>
              </button>
            )}
          </div>

          {filteredDocs.length === 0 ? (
            <div className="px-5 py-10 text-center flex flex-col items-center gap-2.5">
              <p className="text-[14.5px] text-slate-900 font-semibold break-keep">
                등록된 공용 업무 문서가 없습니다
              </p>
              <p className="text-[12.5px] text-slate-500 break-keep max-w-lg leading-relaxed">
                공용 폴더(S: 드라이브)에 업무 문서나 현장 사진을 넣거나 파일 추가 버튼으로 업로드하면 목록에 표시되며, 본문 내용으로 바로 검색할 수 있습니다.
              </p>
              <div className="mt-1.5 flex flex-wrap items-center justify-center gap-2">
                {isZCoreConnected ? (
                  <>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[12.5px] font-medium cursor-pointer transition-colors"
                    >
                      S: 드라이브에 파일 추가
                    </button>
                    {!isMobileOrStore && (
                      <button
                        type="button"
                        onClick={() => void handleOpenSDriveExplorer()}
                        className="px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[12.5px] font-medium cursor-pointer transition-colors"
                      >
                        윈도우 탐색기 폴더 열기
                      </button>
                    )}
                  </>
                ) : !isMobileOrStore ? (
                  <button
                    type="button"
                    onClick={openZCoreConnectModal}
                    className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[12.5px] font-medium cursor-pointer transition-colors"
                  >
                    PC 엔진 연결 및 S: 드라이브 설정
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[12.5px] font-medium cursor-pointer transition-colors"
                  >
                    현장 사진 · 업무 파일 추가
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-slate-100">
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
                      isSelected ? 'bg-slate-100/80' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 text-[10.5px] font-semibold shrink-0">
                          {doc.ext}
                        </span>
                        <span className="text-[13.5px] text-slate-900 font-medium truncate">
                          {doc.fileName}
                        </span>
                        <span className="hidden md:inline text-[12px] text-slate-500 truncate">
                          · {doc.summaryTitle.replace(/\[.*?\]\s*/g, '')}
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className="hidden sm:inline text-[11.5px] text-slate-500">
                          {doc.folderPath} · {doc.sizeLabel} · {doc.updatedAt}
                        </span>
                        {doc.lockedBy ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            {doc.lockedBy}님 열람 중
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-600 text-[11px] font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            편집 가능
                          </span>
                        )}
                      </div>
                    </div>

                    {searchQuery.trim() && (
                      <div className="pl-11 text-[12px] text-slate-600 truncate">
                        {doc.matchedSnippet}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {isSidePeekOpen && selectedDoc && (
        <div className="xl:col-span-5 p-4 md:p-5 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col gap-3.5 xl:sticky xl:top-16">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-medium shrink-0">
                문서 미리보기
              </span>
              <span className="text-[11.5px] text-slate-500">
                {selectedDoc.author} · {selectedDoc.updatedAt}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsSidePeekOpen(false)}
              className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 text-[11.5px] font-medium shrink-0 cursor-pointer"
            >
              ✕ 닫기
            </button>
          </div>

          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-[11.5px] text-slate-500 font-mono break-all">
              {selectedDoc.folderPath}\{selectedDoc.fileName}
            </span>
            <h3 className="text-[16px] text-slate-900 font-semibold leading-snug">
              {selectedDoc.summaryTitle.replace(/\[.*?\]\s*/g, '')}
            </h3>
          </div>

          {selectedDoc.lockedBy ? (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex flex-col gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-[12.5px] text-amber-900 font-semibold">
                  현재 {selectedDoc.lockedBy}님이 사용 중입니다 (읽기 모드)
                </span>
                <span className="text-[11.5px] text-amber-800/80">
                  덮어쓰기 충돌을 방지하기 위해 읽기 모드로 열립니다.
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
                className="w-full py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-medium cursor-pointer text-center transition-colors"
              >
                읽기 모드로 열기
              </button>
            </div>
          ) : (
            <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-[12px] text-slate-700 font-medium">
                현재 편집 중인 팀원이 없어 바로 열람 및 수정이 가능합니다
              </span>
            </div>
          )}

          {selectedDoc.isImage && selectedDoc.imageBase64 && (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-slate-700 font-medium">
                  이미지 미리보기
                </span>
                <span className="text-[11px] text-slate-500">
                  {selectedDoc.ext} · {selectedDoc.sizeLabel}
                </span>
              </div>
              <div className="w-full flex items-center justify-center p-2 rounded-lg bg-white border border-slate-200 overflow-hidden">
                <img
                  src={selectedDoc.imageBase64}
                  alt={selectedDoc.fileName}
                  className="max-h-64 object-contain rounded"
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <span className="text-[12px] text-slate-700 font-semibold">
              표 요약
            </span>
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {selectedDoc.tableHeaders.map((h, hIdx) => (
                      <th
                        key={`${h}-${hIdx}`}
                        className="px-2.5 py-2 text-[11.5px] text-slate-700 font-semibold whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedDoc.tableRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      {row.map((cell, cIdx) => (
                        <td
                          key={cIdx}
                          className="px-2.5 py-1.5 text-[12px] text-slate-800"
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

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col gap-1 max-h-56 overflow-y-auto">
            <span className="text-[11.5px] text-slate-600 font-semibold">
              본문 내용
            </span>
            <p className="text-[12.5px] text-slate-800 whitespace-pre-line leading-relaxed">
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
                    ? `'${selectedDoc.fileName}' 원본 파일(${selectedDoc.sizeLabel}) 다운로드를 시작했습니다.`
                    : `원본 파일을 받으려면 메인 서버 PC 또는 로컬 PC 엔진 연결이 필요합니다.`
                );
              }}
              className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-medium cursor-pointer transition-colors"
            >
              원본 파일 다운로드
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
                          `'${targetName}' 파일을 휴지통으로 옮기지 못해 원래 상태로 유지했습니다.`
                      );
                    } else {
                      showToast(
                        `'${targetName}' 파일이 휴지통으로 이동되었습니다. 상단 실행 취소 버튼으로 되돌릴 수 있습니다.`
                      );
                    }
                  } finally {
                    inFlightDeletesRef.current.delete(targetRel);
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 text-[12px] font-medium cursor-pointer transition-colors"
              >
                휴지통으로 이동
              </button>
            )}
          </div>

          {docActionNotice && (
            <div className="p-2.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 text-[12px] flex items-center justify-between gap-2">
              <span>{docActionNotice}</span>
              <button
                type="button"
                onClick={() => setDocActionNotice(null)}
                className="text-[11px] text-slate-600 hover:text-slate-900 font-medium px-2 py-0.5 rounded bg-white border border-slate-200 shrink-0 cursor-pointer"
              >
                닫기
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
            <span className="text-[11.5px] text-slate-500">
              크기: {selectedDoc.sizeLabel} · 위치: {selectedDoc.folderPath} · 등록: {selectedDoc.author}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {!isStoreAppMode && !isWorkPaidActive && (
                <>
                  <button
                    type="button"
                    onClick={() => activatePricingPlan('work_soho_9900')}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11.5px] font-medium cursor-pointer transition-colors"
                  >
                    소호(~5인) 월 9,900원 구독
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowProModal(true)}
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[11.5px] font-medium cursor-pointer transition-colors"
                  >
                    요금제 안내
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
