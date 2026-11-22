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
  showToast: (msg: string) => void;
}

export const WorkLoungeHostAdminPanels: React.FC<WorkLoungeHostAdminPanelsProps> = ({
  showBackupManager,
  hostTunnelStatus,
  masterWorkPcName,
  driveTargetPath,
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
  showToast,
}) => {
  return (
    <>
        {/* 🛡️ 방장(대표) 전용: 대장 PC(S: 1대) & 백업 PC(예비 서버 1·2호) 이중화 관리 패널 */}
        {showBackupManager && (
          <div className="p-4 rounded-2xl bg-[#18181B] border border-emerald-400/40 flex flex-col gap-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="font-headline-sm text-[14.5px] text-white font-extrabold">
                  🛡️ 사내 대장 PC(S: 드라이브 1대) + 백업 PC(예비 서버 1·2호) 자동 이중화
                </span>
                <span className="text-[12px] text-zinc-300">
                  24시간 켜두는 대장 PC가 고장·점검 중일 때 즉시 이어받을 수 있도록 예비 서버(최대 2대)와 예비 백업 폴더에 S: 드라이브 원본을 안전하게 이중화합니다. (기존 구글 드라이브·네이버 MYBOX 폴더와 중첩 지정해도 충돌 없이 함께 쓸 수 있습니다)
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-400 text-zinc-950 font-label-sm text-[11px] font-extrabold">
                ✓ 삭제 시 OS 기본 [휴지통] 이동 + ↩️ 1초 실행 취소
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {/* 1) 사내 대장 PC (S: 드라이브 1대) */}
              <div className="p-3.5 rounded-xl bg-zinc-950 border border-cyan-400/45 flex flex-col justify-between gap-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-cyan-400 text-zinc-950 font-label-sm text-[10.5px] font-extrabold">
                    👑 사내 대장 PC (메인 서버 1대)
                  </span>
                  <span className="text-[11px] text-cyan-300 font-mono font-bold">
                    {hostTunnelStatus === 'connected' ? '24시간 직통 가동 중' : 'S:\\ 마운트 서버'}
                  </span>
                </div>
                <div className="font-headline-sm text-[14px] text-white font-bold">
                  {masterWorkPcName}
                </div>
                <p className="text-[11px] text-zinc-400">
                  업무 폴더: <code className="text-zinc-200">{driveTargetPath}</code>
                </p>
                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const nextName = masterWorkPcName.includes('사내 대장')
                        ? '사무실 메인 업무 서버 (S:)'
                        : '사내 대장 PC (S: 드라이브)';
                      void handleSaveBackupServerConfig(nextName, backupServers);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-cyan-300 text-[11px] font-bold cursor-pointer"
                  >
                    🔄 대장 PC 표시 이름 변경
                  </button>
                </div>
              </div>

              {/* 2) 백업 PC (예비 서버 1·2호) */}
              <div className="lg:col-span-2 p-3.5 rounded-xl bg-zinc-950 border border-white/10 flex flex-col justify-between gap-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-label-sm text-[12px] text-emerald-300 font-extrabold">
                    🛡️ 백업 PC (예비 서버 {backupServers.length}/2대 지정됨)
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    {lastBackupSyncedAt
                      ? `최근 예비 서버 백업: ${lastBackupSyncedCount}건 완료`
                      : '대장 PC 고장·도난 대비 S: 드라이브 전체를 예비 서버에 똑같이 유지합니다'}
                  </span>
                </div>

                {backupServers.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {backupServers.map((node, idx) => (
                      <div
                        key={node.id}
                        className="p-2.5 rounded-lg bg-zinc-900 border border-emerald-400/30 flex items-center justify-between gap-2"
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="text-[12px] text-white font-bold truncate">
                            🖥️ 예비 서버 {idx + 1}호 · {node.label}
                          </span>
                          <span className="text-[10.5px] text-emerald-300 font-bold">
                            {node.status}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const next = backupServers.filter((item) => item.id !== node.id);
                            void handleSaveBackupServerConfig(masterWorkPcName, next);
                          }}
                          className="px-2 py-1 rounded bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-white text-[10.5px] font-bold shrink-0 cursor-pointer"
                        >
                          해제
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/10">
                  <input
                    type="text"
                    value={newBackupServerName}
                    onChange={(e) => setNewBackupServerName(e.target.value)}
                    placeholder="예비 서버 PC 이름 (예: 김이사 서브PC)"
                    className="flex-1 min-w-[160px] px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-white/15 text-white text-[11.5px]"
                  />
                  <input
                    type="text"
                    value={localBackupDir}
                    onChange={(e) => setLocalBackupDir(e.target.value)}
                    placeholder="예비 서버 백업 폴더 경로 (비워두면 기본 안전 폴더)"
                    className="flex-1 min-w-[180px] px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-white/15 text-white text-[11.5px] font-mono"
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
                          status: '✓ 대기·자동 이중화 가동 중',
                        },
                      ];
                      setNewBackupServerName('');
                      void handleSaveBackupServerConfig(masterWorkPcName, next, localBackupDir);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-label-sm text-[11.5px] font-extrabold cursor-pointer shrink-0 disabled:opacity-40"
                  >
                    + 예비 서버 등록
                  </button>
                  {!isMobileOrStore && (
                    <button
                      type="button"
                      disabled={syncingBackupNow}
                      onClick={() => void handleRunBackupSyncNow()}
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-emerald-400/45 text-emerald-200 font-label-sm text-[11.5px] font-extrabold cursor-pointer shrink-0 disabled:opacity-50"
                    >
                      {syncingBackupNow ? '⏳ 이중화 백업 중...' : '⚡ 지금 예비 서버로 백업 실행'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 👥 팀원 권한 & S: 드라이브 연결 설정 화면 (DB 실저장 연동) */}
        {showMemberPermissions && (
          <div className="p-4 rounded-2xl bg-[#18181B] border border-cyan-400/45 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="font-headline-sm text-[14.5px] text-white font-extrabold">
                  👥 [팀원 권한 &amp; S: 드라이브 연결] 멤버별 권한 관리 ({teamMembers.length}/{roomSeatLimit}명)
                </span>
                <span className="text-[12px] text-zinc-300">
                  📢 <strong className="text-emerald-300">방장 1명만 구독하면 초대받은 팀원은 평생 0원(무료)</strong>으로 대장 PC S: 드라이브에 직결되며, 엑셀·한글·도면 열람 시 누가 사용 중인지 전 직원 화면에 1초 만에 표시됩니다.
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-cyan-400 text-zinc-950 font-label-sm text-[11px] font-extrabold">
                정원 {teamMembers.length} / {roomSeatLimit}인
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {teamMembers.map((member) => (
                <div
                  key={member.id}
                  className="p-3 rounded-xl bg-zinc-950 border border-white/10 flex flex-col justify-between gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-col min-w-0">
                      <span className="text-[13px] text-white font-extrabold truncate">
                        {member.role === 'host' ? '👑 ' : '👤 '}
                        {member.name}
                      </span>
                      <span className="text-[11px] text-zinc-400 truncate">{member.dept}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/35 text-emerald-300 text-[10.5px] font-extrabold shrink-0">
                      {member.role === 'host'
                        ? isStoreAppMode
                          ? '방장 (마스터 호스트)'
                          : '방장 (구독 호스트)'
                        : isStoreAppMode
                        ? '연결된 팀원'
                        : '팀원 0원 (평생 무료)'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-white/10">
                    <span className="text-[10.5px] text-cyan-300 font-bold truncate min-w-0">
                      🔗 {member.statusText}
                    </span>
                    {member.role === 'host' ? (
                      <span className="px-2 py-1 rounded-lg bg-amber-400/20 border border-amber-400/40 text-amber-200 text-[10.5px] font-extrabold shrink-0">
                        👑 전체 관리
                      </span>
                    ) : myRoomRole === 'host' && member.email ? (
                      <div className="flex items-center gap-1.5">
                        <select
                          value={member.role}
                          onChange={async (e) => {
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
                            showToast(
                              ok
                                ? `✓ ${member.name}님의 권한을 [${
                                    nextRole === 'viewer' ? '읽기·다운로드 전용' : '편집·업로드 허용'
                                  }]으로 저장했습니다.`
                                : '⚠️ 권한 변경 저장에 실패했습니다.'
                            );
                          }}
                          className="px-2 py-1 rounded-lg bg-zinc-900 border border-cyan-400/40 text-white text-[11px] font-bold shrink-0 cursor-pointer"
                        >
                          <option value="editor">✏️ 편집·업로드 허용</option>
                          <option value="viewer">👁️ 읽기·다운로드 전용</option>
                        </select>
                        <button
                          type="button"
                          onClick={async () => {
                            const ok = await removeWorkRoomMemberOnServer({
                              roomId: activeWorkRoomId,
                              memberEmail: member.email,
                            });
                            if (ok) {
                              setServerMembers((prev) =>
                                prev.filter((sm) => sm.email !== member.email)
                              );
                              showToast(`🚪 ${member.name}님을 업무 공유방에서 내보냈습니다.`);
                            }
                          }}
                          className="px-2 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/40 text-rose-200 text-[10.5px] font-bold cursor-pointer"
                        >
                          강퇴
                        </button>
                      </div>
                    ) : (
                      <span className="px-2 py-1 rounded-lg bg-zinc-900 border border-white/10 text-zinc-300 text-[10.5px] font-bold shrink-0">
                        {member.role === 'viewer' ? '👁️ 읽기 전용' : '✏️ 편집·업로드'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
    </>
  );
};
