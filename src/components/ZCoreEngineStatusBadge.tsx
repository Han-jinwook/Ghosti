import React, { useState, useEffect } from 'react';
import { zCoreBridge, Z_CORE_PORT, LATEST_Z_CORE_VERSION, isZCoreOutdated } from '../services/zCoreBridge';

interface ZCoreEngineStatusBadgeProps {
  themeMode?: 'light' | 'dark';
  onClickGuide: () => void;
  compact?: boolean;
}

export const ZCoreEngineStatusBadge: React.FC<ZCoreEngineStatusBadgeProps> = ({
  themeMode = 'dark',
  onClickGuide,
  compact = false,
}) => {
  const [isConnected, setIsConnected] = useState<boolean>(zCoreBridge.isConnected);
  const [version, setVersion] = useState<string | null>(zCoreBridge.version);

  useEffect(() => {
    setIsConnected(zCoreBridge.isConnected);
    setVersion(zCoreBridge.version);
    const unsubscribe = zCoreBridge.subscribe((conn) => {
      setIsConnected(conn);
      setVersion(zCoreBridge.version);
    });
    return () => unsubscribe();
  }, []);

  const isLight = themeMode === 'light';
  const outdated = isConnected && isZCoreOutdated(version);

  if (outdated) {
    return (
      <button
        type="button"
        onClick={onClickGuide}
        title={`⚠️ 구버전 Z-코어(v${version || '?'})가 켜져 있습니다 - 클릭하면 최신 v${LATEST_Z_CORE_VERSION} 다운로드 안내`}
        className={`px-2.5 py-1 rounded-full font-label-mono text-[12px] font-extrabold border flex items-center gap-1.5 transition-all cursor-pointer animate-pulse ${
          isLight
            ? 'bg-amber-50 border-amber-400 text-amber-800 hover:bg-amber-100 shadow-sm'
            : 'bg-amber-950/50 border-amber-400/60 text-amber-200 hover:bg-amber-900/50 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
        }`}
      >
        <span className="w-2 h-2 rounded-full shrink-0 bg-amber-400" />
        <span className={`whitespace-nowrap ${compact ? 'hidden sm:inline' : ''}`}>
          Z-코어 업데이트 필요 (v{version || '?'})
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClickGuide}
      title={
        isConnected
          ? `🟢 멀린 Z-코어 정상 연결됨 (Port ${Z_CORE_PORT}) - 클릭 시 상태 안내`
          : `🟡 멀린 Z-코어 미실행 (내 컴퓨터 내용검색 대기) - 클릭 시 다운로드 및 연결 안내`
      }
      className={`px-2.5 py-1 rounded-full font-label-mono text-[12px] font-extrabold border flex items-center gap-1.5 transition-all cursor-pointer ${
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
      <span className={`whitespace-nowrap ${compact ? 'hidden sm:inline' : ''}`}>
        {isConnected ? `Z-코어 ${Z_CORE_PORT}` : 'Z-코어'}
      </span>
    </button>
  );
};
