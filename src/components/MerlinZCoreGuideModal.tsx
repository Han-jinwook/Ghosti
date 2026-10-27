import React, { useState, useEffect } from 'react';
import { zCoreBridge, Z_CORE_PORT, Z_CORE_ZIP_URL } from '../services/zCoreBridge';

interface MerlinZCoreGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  themeMode?: 'light' | 'dark';
}

export const MerlinZCoreGuideModal: React.FC<MerlinZCoreGuideModalProps> = ({
  isOpen,
  onClose,
  themeMode = 'dark',
}) => {
  const [isConnected, setIsConnected] = useState<boolean>(zCoreBridge.isConnected);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [version, setVersion] = useState<string | null>(zCoreBridge.version);

  useEffect(() => {
    if (!isOpen) return;

    setIsConnected(zCoreBridge.isConnected);
    setVersion(zCoreBridge.version);

    const unsubscribe = zCoreBridge.subscribe((conn) => {
      setIsConnected(conn);
      setVersion(zCoreBridge.version);
    });

    // 모달이 열려있을 때 1.5초 주기로 즉시 감지
    const pollId = setInterval(() => {
      void zCoreBridge.checkHealth();
    }, 1500);

    return () => {
      unsubscribe();
      clearInterval(pollId);
    };
  }, [isOpen]);

  const handleManualCheck = async () => {
    setIsChecking(true);
    const ok = await zCoreBridge.checkHealth();
    setIsChecking(false);
    setIsConnected(ok);
    setVersion(zCoreBridge.version);
  };

  if (!isOpen) return null;

  const isLight = themeMode === 'light';

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full max-w-lg rounded-3xl p-6 sm:p-7 shadow-2xl border transition-all ${
          isLight
            ? 'bg-white border-slate-200 text-slate-800'
            : 'bg-zinc-950 border-white/10 text-zinc-100'
        }`}
      >
        {/* 헤더 */}
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center shrink-0">
              <span className="text-2xl">⚡</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black tracking-tight">멀린 Z-코어 엔진 안내</h3>
                <span className="px-2 py-0.5 rounded-full text-[10.5px] font-black bg-teal-500/15 text-teal-600 dark:text-teal-300 border border-teal-400/30">
                  Port {Z_CORE_PORT}
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                내 컴퓨터 속 사진·문서를 0.1초 만에 꿰뚫어 보는 공식 로컬 엔진
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-white bg-transparent hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {/* 실시간 연결 상태 배너 */}
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 mb-5 ${
            isConnected
              ? isLight
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200'
              : isLight
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-amber-950/40 border-amber-500/30 text-amber-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span
              className={`w-3 h-3 rounded-full shrink-0 ${
                isConnected
                  ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                  : 'bg-amber-500 animate-ping'
              }`}
            />
            <div>
              <div className="text-[13px] font-black">
                {isConnected
                  ? `🟢 멀린 Z-코어 연결 완료! (v${version || '2.1.0'})`
                  : '🟡 멀린 Z-코어 연결 대기 중...'}
              </div>
              <div className="text-[11px] opacity-80 mt-0.5">
                {isConnected
                  ? '내 PC의 실물 사진과 문서가 웹 화면에 100% 실시간 연동됩니다.'
                  : '프로그램을 켜시면 별도 클릭 없이 1초 만에 자동 연결됩니다.'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleManualCheck}
            disabled={isChecking}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs border transition-all cursor-pointer shrink-0 ${
              isLight
                ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                : 'bg-zinc-900 border-white/10 text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            {isChecking ? '확인 중...' : '다시 확인'}
          </button>
        </div>

        {/* 다운로드 및 정석 온보딩 3단계 안내 */}
        <div className="space-y-3 mb-6">
          <div
            className={`p-3.5 rounded-2xl border text-xs flex items-start gap-3 ${
              isLight
                ? 'bg-slate-50 border-slate-200 text-slate-700'
                : 'bg-zinc-900/60 border-white/5 text-zinc-300'
            }`}
          >
            <div className="w-5 h-5 rounded-full bg-teal-500 text-white font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">
              1
            </div>
            <div>
              <span className="font-black text-slate-900 dark:text-white">
                아래 [멀린 Z-코어 다운로드] 버튼을 클릭합니다.
              </span>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                초경량 단일 실행 압축 파일(Merlin_Z_Core.zip)이 즉시 다운로드됩니다.
              </p>
            </div>
          </div>

          <div
            className={`p-3.5 rounded-2xl border text-xs flex items-start gap-3 ${
              isLight
                ? 'bg-slate-50 border-slate-200 text-slate-700'
                : 'bg-zinc-900/60 border-white/5 text-zinc-300'
            }`}
          >
            <div className="w-5 h-5 rounded-full bg-teal-500 text-white font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">
              2
            </div>
            <div>
              <span className="font-black text-slate-900 dark:text-white">
                다운로드받은 압축을 풀고 [Merlin_Z_Core_Setup.exe] 또는 [실행.bat]을 켭니다.
              </span>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                윈도우 시계 옆(시스템 트레이)에 Z-Eye 아이콘이 생기며 안전하게 상주합니다.
              </p>
            </div>
          </div>

          <div
            className={`p-3.5 rounded-2xl border text-xs flex items-start gap-3 ${
              isLight
                ? 'bg-slate-50 border-slate-200 text-slate-700'
                : 'bg-zinc-900/60 border-white/5 text-zinc-300'
            }`}
          >
            <div className="w-5 h-5 rounded-full bg-teal-500 text-white font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">
              3
            </div>
            <div>
              <span className="font-black text-slate-900 dark:text-white">
                이 창이 초록색(🟢 연결 완료)으로 바뀌며 실물 사진이 즉시 투시됩니다!
              </span>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                내 컴퓨터(사진 301장 등)의 내용이 클라우드 서버 업로드 없이 안전하게 검색됩니다.
              </p>
            </div>
          </div>
        </div>

        {/* 액션 버튼 그룹 */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5">
          <a
            href={Z_CORE_ZIP_URL}
            download="Merlin_Z_Core.zip"
            className="w-full flex-1 py-3 px-5 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-black text-sm text-center shadow-lg shadow-teal-500/25 transition-all flex items-center justify-center gap-2 no-underline cursor-pointer"
          >
            <span>📥</span>
            <span>멀린 Z-코어 다운로드 (초경량 ZIP)</span>
          </a>

          {isConnected ? (
            <button
              type="button"
              onClick={onClose}
              className={`w-full sm:w-auto py-3 px-5 rounded-2xl font-black text-sm border transition-all cursor-pointer ${
                isLight
                  ? 'bg-slate-900 text-white hover:bg-slate-800'
                  : 'bg-white text-zinc-950 hover:bg-zinc-100'
              }`}
            >
              내 PC 사진 투시 시작 →
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className={`w-full sm:w-auto py-3 px-4 rounded-2xl font-bold text-xs border transition-all cursor-pointer ${
                isLight
                  ? 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                  : 'bg-zinc-900 border-white/10 text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              나중에 하기
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
