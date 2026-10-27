import React, { useState, useEffect } from 'react';
import { zCoreBridge, Z_CORE_PORT } from '../services/zCoreBridge';

interface ZCoreEngineStatusBadgeProps {
  themeMode?: 'light' | 'dark';
  onClickGuide: () => void;
}

export const ZCoreEngineStatusBadge: React.FC<ZCoreEngineStatusBadgeProps> = ({
  themeMode = 'dark',
  onClickGuide,
}) => {
  const [isConnected, setIsConnected] = useState<boolean>(zCoreBridge.isConnected);

  useEffect(() => {
    setIsConnected(zCoreBridge.isConnected);
    const unsubscribe = zCoreBridge.subscribe((conn) => {
      setIsConnected(conn);
    });
    return () => unsubscribe();
  }, []);

  const isLight = themeMode === 'light';

  return (
    <button
      type="button"
      onClick={onClickGuide}
      title={
        isConnected
          ? `🟢 멀린 Z-코어 정상 연결됨 (Port ${Z_CORE_PORT}) - 클릭 시 상태 안내`
          : `🟡 멀린 Z-코어 미실행 (내 컴퓨터 내용검색 대기) - 클릭 시 다운로드 및 연결 안내`
      }
      className={`px-2.5 py-1 rounded-full font-label-mono text-[11px] font-extrabold border flex items-center gap-1.5 transition-all cursor-pointer ${
        isConnected
          ? isLight
            ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100 shadow-sm'
            : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/40 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
          : isLight
          ? 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100 animate-pulse shadow-sm'
          : 'bg-amber-950/40 border-amber-500/40 text-amber-300 hover:bg-amber-900/40 animate-pulse shadow-[0_0_12px_rgba(245,158,11,0.2)]'
      }`}
    >
      <span
        className={`w-2 h-2 rounded-full shrink-0 ${
          isConnected ? 'bg-emerald-500 shadow-[0_0_6px_#10B981]' : 'bg-amber-500'
        }`}
      />
      <span className="whitespace-nowrap">
        {isConnected ? `Z-코어 ${Z_CORE_PORT}` : 'Z-코어 연결 필요'}
      </span>
    </button>
  );
};
