import React, { useEffect, useState } from 'react';
import {
  type DetectedBloatCleanerItem,
  isAndroidMobileBrowserOrApp,
  isCapacitorAndroidRuntime,
  scanMobileBloatCleaners,
  triggerMobileCleanerUninstall,
  triggerOpenAllInstalledApps,
  triggerOpenGoogleAccountPermissions,
  triggerOpenPlaySubscriptions,
} from '../services/ghostiMobileCareBridge';

export const MobileCleanerRescueBanner: React.FC = () => {
  const [scanning, setScanning] = useState(false);
  const [scannedCount, setScannedCount] = useState(100);
  const [detectedList, setDetectedList] = useState<DetectedBloatCleanerItem[]>([]);
  const [lastScanDone, setLastScanDone] = useState(false);
  const isNativeAndroid = isCapacitorAndroidRuntime();
  const isAndroidEnv = isAndroidMobileBrowserOrApp();

  const runScan = async () => {
    setScanning(true);
    try {
      const res = await scanMobileBloatCleaners();
      setScannedCount(res.scannedCount || 100);
      setDetectedList(res.detected || []);
      setLastScanDone(true);
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    if (isAndroidEnv) {
      void runScan();
    }
  }, [isAndroidEnv]);

  useEffect(() => {
    const onExternalScan = () => {
      void runScan();
    };
    window.addEventListener('ghosti_trigger_mobile_cleaner_scan', onExternalScan);
    return () => window.removeEventListener('ghosti_trigger_mobile_cleaner_scan', onExternalScan);
  }, []);

  if (!isAndroidEnv) return null;

  const hasDetected = detectedList.length > 0;

  return (
    <section
      data-allow-secretary-jump="true"
      className={`p-4 sm:p-5 rounded-2xl border-2 flex flex-col gap-3 shadow-lg ${
        hasDetected
          ? 'bg-gradient-to-r from-red-950/90 via-amber-950/80 to-zinc-950 border-red-400/80'
          : 'bg-gradient-to-r from-teal-950/85 via-slate-950 to-zinc-950 border-[#2DD4BF]/55'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-black ${
              hasDetected
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-teal-500/20 border border-teal-400/50 text-[#5EEAD4]'
            }`}
          >
            {hasDetected
              ? `🚨 주의! 유료결제 유도 클리너 ${detectedList.length}건 발견`
              : `🛡️ 스마트폰 유료유도 클리너(${scannedCount}종) 안심 경호`}
          </span>
          <span className="text-[11.5px] text-zinc-300 font-bold">
            {isNativeAndroid ? '앱 실시간 스캔 완료' : '모바일 3단 구출 센터'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => void runScan()}
          className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-[11.5px] text-teal-300 font-extrabold cursor-pointer"
        >
          {scanning ? '🔍 스캔 중...' : '🔄 내 폰 다시 스캔'}
        </button>
      </div>

      {hasDetected ? (
        <div className="flex flex-col gap-2.5">
          {detectedList.map((item) => (
            <div
              key={item.packageName}
              className="p-3.5 rounded-xl bg-black/65 border border-red-400/50 flex flex-col gap-2.5"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-[14px] font-black text-red-200">
                  ⚠️ [{item.appName}] ({item.packageName}) 설치 감지!
                </span>
                <span className="text-[12px] text-amber-200 font-bold leading-snug">
                  {item.riskSummaryKo}
                </span>
                <span className="text-[11.5px] text-zinc-300 leading-snug">
                  💡 앱만 지워서는 주간 자동결제와 구글 계정 권한이 그대로 남을 수 있어요. 아래 1·2·3번 버튼으로 한 번에 깔끔히 정리하세요!
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => void triggerMobileCleanerUninstall(item.packageName)}
                  className="py-2.5 px-3 rounded-xl bg-red-500 hover:bg-red-400 text-white text-[12.5px] font-black shadow cursor-pointer"
                >
                  🗑️ 1. [{item.appName}] 앱 즉시 삭제
                </button>
                <button
                  type="button"
                  onClick={() => void triggerOpenPlaySubscriptions(item.packageName)}
                  className="py-2.5 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-[12.5px] font-black shadow cursor-pointer"
                >
                  💳 2. 주간 정기결제(구독) 해지 확인
                </button>
                <button
                  type="button"
                  onClick={() => void triggerOpenGoogleAccountPermissions()}
                  className="py-2.5 px-3 rounded-xl bg-[#2DD4BF] hover:bg-[#5EEAD4] text-zinc-950 text-[12.5px] font-black shadow cursor-pointer"
                >
                  🔒 3. 구글 계정 데이터 권한 끊기
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-[12.5px] text-zinc-200 font-bold leading-relaxed">
            {isNativeAndroid && lastScanDone
              ? `✅ 알려진 유료결제 유도 클리너(${scannedCount}종 · CleanX 등)가 감지되지 않았습니다! 혹시 최근에 깔린 낯선 청소앱이나 구글 계정 연결 권한을 직접 점검하시려면 아래 버튼을 눌러보세요.`
              : '👻 주 13,000원 자동결제를 유도하는 악성 청소앱(CleanX 등) 삭제 · Play 정기구독 해지 · 구글 계정 데이터 접근 권한 해제를 한 번에 도와드려요!'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => void triggerMobileCleanerUninstall('com.xstudios.cleanx')}
              className="py-2 px-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-400/50 text-red-200 text-[12px] font-extrabold cursor-pointer"
            >
              🗑️ CleanX 앱 삭제 화면 열기
            </button>
            <button
              type="button"
              onClick={() => void triggerOpenPlaySubscriptions('com.xstudios.cleanx')}
              className="py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 text-[12px] font-extrabold cursor-pointer"
            >
              💳 Play 정기구독 해지 확인
            </button>
            <button
              type="button"
              onClick={() => void triggerOpenGoogleAccountPermissions()}
              className="py-2 px-3 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 border border-teal-400/50 text-teal-200 text-[12px] font-extrabold cursor-pointer"
            >
              🔒 구글 계정 연결 권한 끊기
            </button>
            <button
              type="button"
              onClick={() => void triggerOpenAllInstalledApps()}
              className="py-2 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-200 text-[12px] font-extrabold cursor-pointer"
            >
              📋 내 폰 전체 설치 앱 목록 열기
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
