import React, { useState } from 'react';

export const LoungeModeSwitcherBar: React.FC = () => null;



interface ThreeBodyConnectedNode {
  id: string;
  deviceName: string;
  hwSpec: string;
  roleLabel: string;
  connectedOn: boolean;
  runtimeStatus: 'computing' | 'standby' | 'yielding_mouse' | 'off';
  activeChunks: number;
}

const INITIAL_THREE_BODY_NODES: ThreeBodyConnectedNode[] = [
  {
    id: 'tb-node-1',
    deviceName: '사무실-디자인PC',
    hwSpec: 'RTX 4070 · Ryzen 7 · 32GB RAM',
    roleLabel: '고성능 텐서 가속 노드',
    connectedOn: true,
    runtimeStatus: 'computing',
    activeChunks: 14,
  },
  {
    id: 'tb-node-2',
    deviceName: '집-RTX4070-데스크톱',
    hwSpec: 'RTX 4070 Super · i7-14700K · 64GB RAM',
    roleLabel: '내 대장 서브 워크스테이션',
    connectedOn: true,
    runtimeStatus: 'standby',
    activeChunks: 0,
  },
  {
    id: 'tb-node-3',
    deviceName: '회의실-노트북',
    hwSpec: 'Core Ultra 7 NPU · 16GB RAM',
    roleLabel: '발표·회의 공용 단말',
    connectedOn: true,
    runtimeStatus: 'yielding_mouse',
    activeChunks: 0,
  },
  {
    id: 'tb-node-4',
    deviceName: '경리팀-회계PC',
    hwSpec: 'i5-13400 · 내장 그래픽 · 16GB RAM',
    roleLabel: '세무·회계 전담 보호 단말',
    connectedOn: false,
    runtimeStatus: 'off',
    activeChunks: 0,
  },
];

export const HostThreeBodyControlPanel: React.FC<{
  contextMode?: 'personal' | 'work';
}> = ({ contextMode = 'work' }) => {
  const [masterThreeBodyOn, setMasterThreeBodyOn] = useState<boolean>(true);
  const [nodes, setNodes] = useState<ThreeBodyConnectedNode[]>(INITIAL_THREE_BODY_NODES);
  const [actionLogBanner, setActionLogBanner] = useState<string | null>(null);

  const handleToggleMaster = () => {
    setMasterThreeBodyOn((prev) => {
      const next = !prev;
      if (!next) {
        setActionLogBanner(
          '🛑 [삼체 마스터 OFF] 모든 연결 PC의 인메모리(RAM) 조각을 0.01초 만에 즉시 증발(Zero-Wipe)시키고, 호스트(내 PC) 단독 연산 모드로 전환했습니다.'
        );
      } else {
        setActionLogBanner(
          '⚡ [삼체 마스터 ON] 연결 허용(ON)된 유휴 PC들과 P2P 인메모리 분산 연산 오프로딩(삼체 합체)을 즉시 재개합니다.'
        );
      }
      return next;
    });
  };

  const handleToggleNodeConnection = (nodeId: string) => {
    setNodes((prev) => {
      const target = prev.find((n) => n.id === nodeId);
      if (!target) return prev;
      const nextConnected = !target.connectedOn;
      if (!nextConnected) {
        const stolenChunks = target.activeChunks;
        setActionLogBanner(
          stolenChunks > 0
            ? `🛡️ [${target.deviceName} ➔ 연결 OFF] 해당 PC의 RAM 조각(${stolenChunks}개)을 0.01초 내 즉시 증발(Zero-Wipe)시키고, 미완료 조각은 가용 ON 기기 및 호스트 PC가 즉시 이어받아(Work Stealing) 중단 없이 완료했습니다.`
            : `🔒 [${target.deviceName} ➔ 연결 OFF] 호스트 제어에 의해 해당 PC에서는 삼체 분산 연산이 돌지 않도록 즉시 차단(RAM Zero-Wipe)했습니다.`
        );
      } else {
        setActionLogBanner(
          `⚡ [${target.deviceName} ➔ 삼체 연결 ON] 호스트 승인 완료! 해당 PC 유휴 시 인메모리(RAM) 기반 삼체 분산 연산에 즉시 합류합니다.`
        );
      }

      return prev.map((n) => {
        if (n.id !== nodeId) {
          if (!nextConnected && target.activeChunks > 0 && n.connectedOn && n.runtimeStatus === 'standby') {
            return { ...n, runtimeStatus: 'computing', activeChunks: n.activeChunks + target.activeChunks };
          }
          return n;
        }
        return {
          ...n,
          connectedOn: nextConnected,
          runtimeStatus: nextConnected ? 'standby' : 'off',
          activeChunks: 0,
        };
      });
    });
  };

  const activeNodeCount = masterThreeBodyOn ? nodes.filter((n) => n.connectedOn).length : 0;

  return (
    <div className="p-4 rounded-2xl bg-zinc-950/90 border border-cyan-400/40 flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-cyan-400 text-zinc-950 font-label-sm text-[11px] font-extrabold">
              ⚡ 호스트 PC 삼체(Three-Body) 관제 센터
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 font-label-mono text-[11px] font-bold">
              디스크 저장 0 Byte · RAM 0.01초 Zero-Wipe · Work Stealing
            </span>
          </div>
          <h3 className="font-headline-sm text-[15px] md:text-[16px] text-white font-extrabold mt-0.5">
            {contextMode === 'personal'
              ? '🖥️ 내 대장(호스트) PC — 연결된 내 기기·사무실 PC 삼체 합체 가동 및 개별 연결 ON/OFF 제어'
              : '🏢 호스트(방장) PC — 사무실 연결 PC 실시간 관제 목록 & 삼체 연산 ON/OFF 통제'}
          </h3>
          <p className="text-[12px] text-zinc-300">
            사무실 PC들에서 삼체(P2P 분산 연산)를 돌릴지 말지 호스트 PC에서 직접 결정합니다. 특정 PC(경리팀·발표용 등)를{' '}
            <strong className="text-rose-300">[연결 OFF]</strong> 하면 해당 PC의 RAM 조각은 0.01초 내 즉시 증발(Zero-Wipe)되고 호스트/가용 PC가 중단 없이 이어받습니다.
          </p>
        </div>

        {/* 호스트 마스터 ON/OFF 토글 */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleToggleMaster}
            className={`px-4 py-2.5 rounded-xl font-label-sm text-[12.5px] font-extrabold cursor-pointer transition-all flex items-center gap-2 border shadow-sm ${
              masterThreeBodyOn
                ? 'bg-emerald-400 hover:bg-emerald-300 text-zinc-950 border-emerald-300'
                : 'bg-zinc-900 hover:bg-zinc-800 text-rose-300 border-rose-400/50'
            }`}
          >
            <span>{masterThreeBodyOn ? '⚡ 삼체 합체 가동: ON' : '🛑 삼체 합체 가동: OFF (호스트 단독)'}</span>
            <span className="px-2 py-0.5 rounded-md bg-black/20 text-[11px] font-mono">
              {masterThreeBodyOn ? `연결 ${activeNodeCount}대 활성` : '분산 중단됨'}
            </span>
          </button>
        </div>
      </div>

      {actionLogBanner && (
        <div className="px-3.5 py-2.5 rounded-xl bg-cyan-500/15 border border-cyan-400/45 text-[12px] text-cyan-100 font-bold flex items-center justify-between gap-2">
          <span>{actionLogBanner}</span>
          <button
            type="button"
            onClick={() => setActionLogBanner(null)}
            className="text-[11px] text-cyan-300 underline shrink-0 cursor-pointer"
          >
            닫기
          </button>
        </div>
      )}

      {/* 연결 PC 실시간 관제 리스트 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
        {nodes.map((node) => {
          const isEffectiveOn = masterThreeBodyOn && node.connectedOn;
          const statusBadge = !masterThreeBodyOn
            ? {
                label: '마스터 OFF (호스트 단독 처리)',
                cls: 'bg-zinc-800 text-zinc-400 border-white/10',
              }
            : !node.connectedOn
            ? {
                label: '연결 OFF (호스트 차단 · RAM Zero-Wipe)',
                cls: 'bg-rose-500/15 text-rose-300 border-rose-400/40',
              }
            : node.runtimeStatus === 'computing'
            ? {
                label: `⚡ 삼체 연산 중 (인메모리 조각 ${node.activeChunks}개)`,
                cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50',
              }
            : node.runtimeStatus === 'yielding_mouse'
            ? {
                label: '🖱️ 사용자 마우스 감지로 자동 양보 중',
                cls: 'bg-amber-500/20 text-amber-300 border-amber-400/50',
              }
            : {
                label: '🟢 대기 중 (유휴 시 즉시 가속)',
                cls: 'bg-cyan-500/15 text-cyan-200 border-cyan-400/40',
              };

          return (
            <div
              key={node.id}
              className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                isEffectiveOn
                  ? 'bg-zinc-900/90 border-white/15'
                  : 'bg-zinc-950/60 border-white/5 opacity-80'
              }`}
            >
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-headline-sm text-[13.5px] text-white font-extrabold truncate">
                    🖥️ {node.deviceName}
                  </span>
                  <span className="text-[11px] text-zinc-400 font-medium">({node.roleLabel})</span>
                </div>
                <span className="font-label-mono text-[11px] text-cyan-300/90 font-bold">
                  체급: {node.hwSpec}
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className={`px-2 py-0.5 rounded-md border text-[10.5px] font-extrabold ${statusBadge.cls}`}
                  >
                    {statusBadge.label}
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleToggleNodeConnection(node.id)}
                  className={`px-3 py-1.5 rounded-xl font-label-sm text-[11.5px] font-extrabold cursor-pointer transition-all border ${
                    node.connectedOn
                      ? 'bg-emerald-500/20 hover:bg-rose-500/25 text-emerald-200 hover:text-rose-200 border-emerald-400/50'
                      : 'bg-zinc-800 hover:bg-emerald-500/25 text-zinc-300 hover:text-emerald-200 border-white/15'
                  }`}
                >
                  {node.connectedOn ? '⚡ 삼체 연결 ON (클릭 시 OFF)' : '🔒 연결 OFF (클릭 시 ON)'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

