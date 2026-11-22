import React, { useState } from 'react';

export const LoungeModeSwitcherBar: React.FC = () => null;

interface ConnectedComputeNode {
  id: string;
  deviceName: string;
  hwSpec: string;
  roleLabel: string;
  connectedOn: boolean;
  runtimeStatus: 'computing' | 'standby' | 'yielding_mouse' | 'off';
  activeChunks: number;
}

const INITIAL_NODES: ConnectedComputeNode[] = [
  {
    id: 'tb-node-1',
    deviceName: '사무실-디자인PC',
    hwSpec: 'RTX 4070 · Ryzen 7 · 32GB RAM',
    roleLabel: '보조 처리 기기',
    connectedOn: true,
    runtimeStatus: 'computing',
    activeChunks: 14,
  },
  {
    id: 'tb-node-2',
    deviceName: '집-데스크톱',
    hwSpec: 'RTX 4070 Super · i7-14700K · 64GB RAM',
    roleLabel: '서브 워크스테이션',
    connectedOn: true,
    runtimeStatus: 'standby',
    activeChunks: 0,
  },
  {
    id: 'tb-node-3',
    deviceName: '회의실-노트북',
    hwSpec: 'Core Ultra 7 · 16GB RAM',
    roleLabel: '회의 공용 기기',
    connectedOn: true,
    runtimeStatus: 'yielding_mouse',
    activeChunks: 0,
  },
  {
    id: 'tb-node-4',
    deviceName: '경리팀-회계PC',
    hwSpec: 'i5-13400 · 16GB RAM',
    roleLabel: '회계 전용 기기',
    connectedOn: false,
    runtimeStatus: 'off',
    activeChunks: 0,
  },
];

export const HostThreeBodyControlPanel: React.FC<{
  contextMode?: 'personal' | 'work';
}> = ({ contextMode = 'work' }) => {
  const [masterOn, setMasterOn] = useState<boolean>(true);
  const [nodes, setNodes] = useState<ConnectedComputeNode[]>(INITIAL_NODES);
  const [actionLogBanner, setActionLogBanner] = useState<string | null>(null);

  const handleToggleMaster = () => {
    setMasterOn((prev) => {
      const next = !prev;
      setActionLogBanner(
        next
          ? '유휴 PC 보조 색인 처리가 켜졌습니다.'
          : '유휴 PC 보조 처리를 중지하고 메인 PC 단독 처리로 전환했습니다.'
      );
      return next;
    });
  };

  const handleToggleNodeConnection = (nodeId: string) => {
    setNodes((prev) => {
      const target = prev.find((n) => n.id === nodeId);
      if (!target) return prev;
      const nextConnected = !target.connectedOn;
      setActionLogBanner(
        nextConnected
          ? `${target.deviceName} 기기의 유휴 시간 보조 처리를 허용했습니다.`
          : `${target.deviceName} 기기의 보조 처리를 해제했습니다.`
      );
      return prev.map((n) => {
        if (n.id !== nodeId) return n;
        return {
          ...n,
          connectedOn: nextConnected,
          runtimeStatus: nextConnected ? 'standby' : 'off',
          activeChunks: 0,
        };
      });
    });
  };

  const activeNodeCount = masterOn ? nodes.filter((n) => n.connectedOn).length : 0;

  return (
    <div className="p-4 rounded-xl bg-white border border-slate-200 flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-[14.5px] text-slate-900 font-bold">
            {contextMode === 'personal' ? '연결 PC 보조 처리 설정' : '팀 연결 PC 보조 처리 관리'}
          </h3>
          <p className="text-[12px] text-slate-500 mt-0.5">
            쉬고 있는 연결 PC의 자원을 색인 작업에 나눠 쓸지 개별 기기별로 설정합니다.
          </p>
        </div>

        <button
          type="button"
          onClick={handleToggleMaster}
          className={`px-3.5 py-2 rounded-lg text-[12px] font-semibold cursor-pointer transition-colors border ${
            masterOn
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          {masterOn ? `보조 처리 켜짐 (${activeNodeCount}대)` : '보조 처리 꺼짐'}
        </button>
      </div>

      {actionLogBanner && (
        <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-[12px] text-slate-700 flex items-center justify-between gap-2">
          <span>{actionLogBanner}</span>
          <button
            type="button"
            onClick={() => setActionLogBanner(null)}
            className="text-[11.5px] text-slate-500 underline shrink-0 cursor-pointer"
          >
            닫기
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {nodes.map((node) => {
          const statusLabel = !masterOn
            ? '전체 꺼짐'
            : !node.connectedOn
            ? '사용 안 함'
            : node.runtimeStatus === 'computing'
            ? `작업 중 (${node.activeChunks}건)`
            : node.runtimeStatus === 'yielding_mouse'
            ? '사용자 작업 중 (대기)'
            : '대기 중';

          return (
            <div
              key={node.id}
              className="p-3 rounded-lg bg-slate-50/70 border border-slate-200 flex items-center justify-between gap-3"
            >
              <div className="flex flex-col gap-0.5 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] text-slate-900 font-semibold truncate">
                    {node.deviceName}
                  </span>
                  <span className="text-[11.5px] text-slate-400">({node.roleLabel})</span>
                </div>
                <span className="text-[11.5px] text-[#1E3A8A] font-medium">
                  사양: {node.hwSpec}
                </span>
                <span className="text-[11px] text-slate-500">{statusLabel}</span>
              </div>

              <button
                type="button"
                onClick={() => handleToggleNodeConnection(node.id)}
                className={`px-3 py-1.5 rounded-md text-[11.5px] font-medium cursor-pointer border shrink-0 transition-colors ${
                  node.connectedOn
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                {node.connectedOn ? '사용 중' : '꺼짐'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
