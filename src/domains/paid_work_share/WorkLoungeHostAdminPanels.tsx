import React from 'react';
import {
  removeWorkRoomMemberOnServer,
  updateWorkRoomMemberRoleOnServer,
  type WorkBackupServerNodeDto,
  type WorkRoomServerMemberDto,
} from '../../services/workRoomSyncService';

export interface WorkTeamMemberViewItem {
  id: string;
  email: string;
  name: string;
  dept: string;
  role: 'host' | 'editor' | 'viewer' | string;
  sDriveConnected: boolean;
  statusText: string;
}

export interface WorkLoungeHostAdminPanelsProps {
  showBackupManager: boolean;
  hostTunnelStatus: string;
  masterWorkPcName: string;
  driveTargetPath: string;
  onPickCustomWorkFolder?: () => Promise<void>;
  onApplyCustomWorkFolderPath?: (rawPath: string) => Promise<void>;
  onResetDefaultWorkFolder?: () => Promise<void>;
  backupServers: WorkBackupServerNodeDto[];
  lastBackupSyncedAt: string | null;
  lastBackupSyncedCount: number;
  newBackupServerName: string;
  setNewBackupServerName: React.Dispatch<React.SetStateAction<string>>;
  localBackupDir: string;
  setLocalBackupDir: React.Dispatch<React.SetStateAction<string>>;
  isMobileOrStore: boolean;
  syncingBackupNow: boolean;
  handleSaveBackupServerConfig: (
    nextMasterName: string,
    nextNodes: WorkBackupServerNodeDto[],
    nextBackupDir?: string
  ) => Promise<void>;
  handleRunBackupSyncNow: () => Promise<void>;
  showMemberPermissions: boolean;
  teamMembers: WorkTeamMemberViewItem[];
  roomSeatLimit: number;
  isStoreAppMode: boolean;
  myRoomRole: 'host' | 'editor' | 'viewer';
  activeWorkRoomId: string;
  setServerMembers: React.Dispatch<React.SetStateAction<WorkRoomServerMemberDto[]>>;
  onPersistMembersCache?: (members: WorkRoomServerMemberDto[]) => void;
  showToast: (msg: string) => void;
}

export const WorkLoungeHostAdminPanels: React.FC<WorkLoungeHostAdminPanelsProps> = ({
  showBackupManager,
  hostTunnelStatus,
  masterWorkPcName,
  driveTargetPath,
  onPickCustomWorkFolder,
  onApplyCustomWorkFolderPath,
  onResetDefaultWorkFolder,
  backupServers,
  lastBackupSyncedAt,
  lastBackupSyncedCount,
  newBackupServerName,
  setNewBackupServerName,
  localBackupDir,
  setLocalBackupDir,
  isMobileOrStore,
  syncingBackupNow,
  handleSaveBackupServerConfig,
  handleRunBackupSyncNow,
  showMemberPermissions,
  teamMembers,
  roomSeatLimit,
  isStoreAppMode,
  myRoomRole,
  activeWorkRoomId,
  setServerMembers,
  onPersistMembersCache,
  showToast,
}) => {
  const [pendingKickMember, setPendingKickMember] = React.useState<WorkTeamMemberViewItem | null>(
    null
  );
  const [isKickingMember, setIsKickingMember] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (!pendingKickMember) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isKickingMember) {
        setPendingKickMember(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pendingKickMember, isKickingMember]);

  const handleConfirmKickMember = async () => {
    if (!pendingKickMember || isKickingMember) return;
    const target = pendingKickMember;
    setIsKickingMember(true);
    try {
      const ok = await removeWorkRoomMemberOnServer({
        roomId: activeWorkRoomId,
        memberEmail: target.email,
      });
      if (ok) {
        setServerMembers((prev) => {
          const next = prev.filter((sm) => sm.email !== target.email);
          onPersistMembersCache?.(next);
          return next;
        });
        setPendingKickMember(null);
        showToast(`${target.name}님을 업무 공유방에서 내보냈습니다.`);
      } else {
        showToast('팀원 내보내기 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setIsKickingMember(false);
    }
  };

  return (
    <>
      {showBackupManager && (
        <div className="p-4 sm:p-5 rounded-xl bg-white border border-slate-200 flex flex-col gap-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-[14px] text-slate-900 font-semibold">
                메인 서버 PC(S: 드라이브) 및 예비 서버 백업 관리
              </span>
              <span className="text-[12px] text-slate-500">
                메인 PC 점검 시 이어받을 수 있도록 예비 서버(최대 2대)와 백업 폴더에 공용 폴더 원본을 함께 보관합니다.
              </span>
            </div>
            <span className="px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-medium">
              삭제 시 휴지통 이동 · 실행 취소 지원
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded bg-teal-600 text-white text-[10.5px] font-medium">
                  메인 서버 PC
                </span>
                <span className="text-[11px] text-slate-600 font-medium">
                  {hostTunnelStatus === 'connected' ? '연결됨' : 'S: 드라이브 기준'}
                </span>
              </div>
              <div className="text-[14px] text-slate-900 font-semibold">
                {masterWorkPcName}
              </div>
              <p className="text-[11.5px] text-slate-500 break-all">
                업무 폴더: <code className="text-slate-700 font-mono">{driveTargetPath}</code>
              </p>
              {!isMobileOrStore && myRoomRole === 'host' && (
                <div className="flex flex-col gap-1.5 pt-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {onPickCustomWorkFolder && (
                      <button
                        type="button"
                        onClick={() => void onPickCustomWorkFolder()}
                        className="px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[11.5px] font-medium cursor-pointer transition-colors"
                      >
                        구글드라이브·지정 폴더 선택
                      </button>
                    )}
                    {onResetDefaultWorkFolder && !driveTargetPath.includes('업무공유폴더_S') && (
                      <button
                        type="button"
                        onClick={() => void onResetDefaultWorkFolder()}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 text-[11px] font-medium cursor-pointer transition-colors"
                      >
                        기본 폴더 복원
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const nextName = masterWorkPcName.includes('사내 대장')
                          ? '사무실 메인 업무 서버 (S:)'
                          : '사내 대장 PC (S: 드라이브)';
                        void handleSaveBackupServerConfig(nextName, backupServers);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11.5px] font-medium cursor-pointer transition-colors"
                    >
                      표시 이름 변경
                    </button>
                  </div>
                  {onApplyCustomWorkFolderPath && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const fd = new FormData(e.currentTarget);
                        const val = String(fd.get('customTargetDir') || '').trim();
                        if (val) {
                          void onApplyCustomWorkFolderPath(val);
                          e.currentTarget.reset();
                        }
                      }}
                      className="flex items-center gap-1.5 pt-0.5"
                    >
                      <input
                        type="text"
                        name="customTargetDir"
                        placeholder="예: G:\내 드라이브\테스트폴더"
                        className="flex-1 min-w-0 px-2 py-1 rounded-lg bg-white border border-slate-300 text-slate-900 text-[11px] font-mono outline-none focus:border-teal-600"
                      />
                      <button
                        type="submit"
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-medium shrink-0 cursor-pointer"
                      >
                        경로 연결
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>

            <div className="lg:col-span-2 p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between gap-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[12.5px] text-slate-900 font-semibold">
                  예비 서버 ({backupServers.length}/2대 지정됨)
                </span>
                <span className="text-[11.5px] text-slate-500">
                  {lastBackupSyncedAt
                    ? `최근 백업: ${lastBackupSyncedCount}건 완료`
                    : '예비 서버에 동일한 폴더 구성을 유지합니다'}
                </span>
              </div>

              {backupServers.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {backupServers.map((node, idx) => (
                    <div
                      key={node.id}
                      className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-2"
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="text-[12px] text-slate-900 font-semibold truncate">
                          예비 서버 {idx + 1}호 · {node.label}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {node.status}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const next = backupServers.filter((item) => item.id !== node.id);
                          void handleSaveBackupServerConfig(masterWorkPcName, next);
                        }}
                        className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 text-[11px] font-medium shrink-0 cursor-pointer"
                      >
                        해제
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200">
                <input
                  type="text"
                  value={newBackupServerName}
                  onChange={(e) => setNewBackupServerName(e.target.value)}
                  placeholder="예비 서버 PC 이름"
                  className="flex-1 min-w-[160px] px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-900 text-[12px] outline-none focus:border-slate-900"
                />
                <input
                  type="text"
                  value={localBackupDir}
                  onChange={(e) => setLocalBackupDir(e.target.value)}
                  placeholder="백업 폴더 경로 (비워두면 기본 폴더)"
                  className="flex-1 min-w-[180px] px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-900 text-[12px] font-mono outline-none focus:border-slate-900"
                />
                <button
                  type="button"
                  disabled={backupServers.length >= 2}
                  onClick={() => {
                    if (backupServers.length >= 2) return;
                    const label =
                      newBackupServerName.trim() || `예비 서버 ${backupServers.length + 1}호 PC`;
                    const next: WorkBackupServerNodeDto[] = [
                      ...backupServers,
                      {
                        id: `backup-${Date.now()}`,
                        slot: backupServers.length + 1,
                        label,
                        role: `예비 서버 ${backupServers.length + 1}호`,
                        status: '✓ 자동 백업 대기 중',
                      },
                    ];
                    setNewBackupServerName('');
                    void handleSaveBackupServerConfig(masterWorkPcName, next, localBackupDir);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12px] font-medium cursor-pointer shrink-0 disabled:opacity-40 transition-colors"
                >
                  + 예비 서버 등록
                </button>
                {!isMobileOrStore && (
                  <button
                    type="button"
                    disabled={syncingBackupNow}
                    onClick={() => void handleRunBackupSyncNow()}
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[12px] font-medium cursor-pointer shrink-0 disabled:opacity-50 transition-colors"
                  >
                    {syncingBackupNow ? '백업 진행 중...' : '지금 백업 실행'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showMemberPermissions && (
        <div className="p-4 sm:p-5 rounded-xl bg-white border border-slate-200 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-[14px] text-slate-900 font-semibold">
                팀원 권한 및 S: 드라이브 연결 관리 ({teamMembers.length}/{roomSeatLimit}명)
              </span>
              <span className="text-[12px] text-slate-500">
                방장 1인 구독으로 초대된 팀원은 추가 비용 없이 공용 드라이브를 함께 사용하며, 열람 중인 문서는 실시간으로 사용 중 표시됩니다.
              </span>
            </div>
            <span className="px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-medium">
              정원 {teamMembers.length} / {roomSeatLimit}인
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {teamMembers.map((member) => (
              <div
                key={member.id}
                className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between gap-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[13px] text-slate-900 font-semibold truncate">
                      {member.name}
                    </span>
                    <span className="text-[11px] text-slate-500 truncate">{member.dept}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 text-[10.5px] font-medium shrink-0">
                    {member.role === 'host'
                      ? '방장 (호스트)'
                      : isStoreAppMode
                      ? '연결된 팀원'
                      : '팀원'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-200">
                  <span className="text-[11px] text-slate-600 font-medium truncate min-w-0">
                    {member.statusText}
                  </span>
                  {member.role === 'host' ? (
                    <span className="px-2 py-0.5 rounded-md bg-slate-200/70 text-slate-800 text-[10.5px] font-medium shrink-0">
                      전체 관리
                    </span>
                  ) : myRoomRole === 'host' && member.email ? (
                    <div className="flex items-center gap-1.5">
                      <select
                        value={member.role}
                        onChange={async (e) => {
                          const prevRole = member.role === 'viewer' ? 'viewer' : 'editor';
                          const nextRole = e.target.value as 'editor' | 'viewer';
                          setServerMembers((prev) =>
                            prev.map((sm) =>
                              sm.email === member.email ? { ...sm, role: nextRole } : sm
                            )
                          );
                          const ok = await updateWorkRoomMemberRoleOnServer({
                            roomId: activeWorkRoomId,
                            memberEmail: member.email,
                            role: nextRole,
                          });
                          if (!ok) {
                            setServerMembers((prev) =>
                              prev.map((sm) =>
                                sm.email === member.email ? { ...sm, role: prevRole } : sm
                              )
                            );
                          }
                          showToast(
                            ok
                              ? `✓ ${member.name}님의 권한을 [${
                                  nextRole === 'viewer' ? '읽기·다운로드 전용' : '편집·업로드 허용'
                                }]으로 변경했습니다.`
                              : '권한 변경 저장에 실패했습니다.'
                          );
                        }}
                        className="px-2 py-1 rounded-md bg-white border border-slate-300 text-slate-800 text-[11px] font-medium shrink-0 cursor-pointer"
                      >
                        <option value="editor">편집·업로드 허용</option>
                        <option value="viewer">읽기·다운로드 전용</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => setPendingKickMember(member)}
                        data-testid={`work-member-kick-btn-${member.email}`}
                        className="px-2 py-1 rounded-md bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 text-[10.5px] font-medium cursor-pointer"
                      >
                        내보내기
                      </button>
                    </div>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 text-[10.5px] font-medium shrink-0">
                      {member.role === 'viewer' ? '읽기 전용' : '편집·업로드'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pendingKickMember && (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="work-member-kick-confirm-modal"
          onClick={() => {
            if (!isKickingMember) setPendingKickMember(null);
          }}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 backdrop-blur-[2px] p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl p-5 flex flex-col gap-3.5"
          >
            <div className="flex flex-col gap-1">
              <span className="inline-flex self-start px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold">
                팀원 내보내기 재확인
              </span>
              <h3 className="text-[16px] text-slate-900 font-extrabold tracking-tight mt-0.5">
                {pendingKickMember.name}님을 업무 공유방에서 내보내시겠습니까?
              </h3>
              {pendingKickMember.email && (
                <span className="text-[11.5px] text-slate-500 font-mono truncate">
                  계정: {pendingKickMember.email}
                </span>
              )}
            </div>
            <p className="text-[12.5px] text-slate-600 leading-relaxed break-keep">
              내보내기를 확인하면 이 팀원의 업무 공유방 문서 열람 및 S: 드라이브 연결 권한이 즉시 해제됩니다.
              (실수로 내보내더라도 다시 초대 링크를 보내면 언제든 재합류할 수 있습니다)
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={isKickingMember}
                onClick={() => setPendingKickMember(null)}
                data-testid="work-member-kick-cancel-btn"
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[12.5px] font-semibold cursor-pointer disabled:opacity-50 transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                disabled={isKickingMember}
                onClick={() => void handleConfirmKickMember()}
                data-testid="work-member-kick-confirm-btn"
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[12.5px] font-bold cursor-pointer disabled:opacity-60 shadow-sm transition-colors"
              >
                {isKickingMember ? '내보내는 중...' : '내보내기 확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
