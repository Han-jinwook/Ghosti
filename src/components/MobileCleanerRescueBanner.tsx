import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  const bannerRef = useRef<HTMLElement | null>(null);

  const [scanning, setScanning] = useState(false);
  const [scannedCount, setScannedCount] = useState(178);
  const [detectedList, setDetectedList] = useState<DetectedBloatCleanerItem[]>([]);
  const [lastScanDone, setLastScanDone] = useState(false);
  const [manualRequested, setManualRequested] = useState(false);
  const [uninstalledTarget, setUninstalledTarget] = useState<DetectedBloatCleanerItem | null>(null);

  const isNativeAndroid = isCapacitorAndroidRuntime();
  const isAndroidEnv = isAndroidMobileBrowserOrApp();

  const runScan = useCallback(async (isManual = false) => {
    if (isManual) setManualRequested(true);
    setScanning(true);
    try {
      const res = await scanMobileBloatCleaners();
      const nextDetected = res.detected || [];
      setScannedCount(res.scannedCount || 178);
      setDetectedList(nextDetected);
      setLastScanDone(true);
      if (isManual && nextDetected.length === 0) {
        setUninstalledTarget(null);
      }
      if (isManual) {
        window.setTimeout(() => {
          bannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 80);
      }
    } finally {
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    if (!isAndroidEnv) return;
    void runScan(false);

    const onAppVisible = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        void runScan(false);
      }
    };
    document.addEventListener('visibilitychange', onAppVisible);
    window.addEventListener('focus', onAppVisible);
    return () => {
      document.removeEventListener('visibilitychange', onAppVisible);
      window.removeEventListener('focus', onAppVisible);
    };
  }, [isAndroidEnv, runScan]);

  useEffect(() => {
    const onExternalScan = () => {
      void runScan(true);
    };
    window.addEventListener('ghosti_trigger_mobile_cleaner_scan', onExternalScan);
    return () => window.removeEventListener('ghosti_trigger_mobile_cleaner_scan', onExternalScan);
  }, [runScan]);

  const hasDetected = detectedList.length > 0;
  const showPostUninstallFollowUp =
    !hasDetected &&
    Boolean(uninstalledTarget) &&
    !detectedList.some((d) => d.packageName === uninstalledTarget?.packageName);

  if (!isAndroidEnv || (!hasDetected && !manualRequested && !showPostUninstallFollowUp)) {
    return null;
  }

  return (
    <section
      ref={bannerRef}
      data-allow-secretary-jump="true"
      className={`p-4 sm:p-5 rounded-xl border flex flex-col gap-3 ${
        hasDetected
          ? 'bg-rose-50/70 border-rose-200'
          : 'bg-white border-slate-200'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`px-2.5 py-0.5 rounded text-[11.5px] font-semibold ${
              hasDetected
                ? 'bg-rose-600 text-white'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            {hasDetected
              ? `주의 필요한 클리너 앱 ${detectedList.length}건 감지`
              : `클리너 앱 점검 (${scannedCount}종 기준)`}
          </span>
          <span className="text-[11.5px] text-slate-500">
            {isNativeAndroid ? '기기 스캔 완료' : '구독 · 권한 점검'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void runScan(false)}
            className="px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11.5px] font-medium cursor-pointer"
          >
            {scanning ? '점검 중...' : '다시 점검'}
          </button>
          {!hasDetected && (
            <button
              type="button"
              onClick={() => {
                setManualRequested(false);
                setUninstalledTarget(null);
              }}
              aria-label="점검 카드 닫기"
              className="px-2 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 text-[11.5px] font-medium cursor-pointer"
            >
              닫기
            </button>
          )}
        </div>
      </div>

      {hasDetected ? (
        <div className="flex flex-col gap-2.5">
          {detectedList.map((item) => (
            <div
              key={item.packageName}
              className="p-3.5 rounded-lg border border-rose-200 bg-white flex flex-col gap-2.5"
            >
              <div className="flex flex-col gap-1">
                <span className="text-[13.5px] font-bold text-rose-800">
                  {item.appName} ({item.packageName})
                </span>
                <span className="text-[12px] font-medium text-slate-700">
                  {item.riskSummaryKo}
                </span>
                <span className="text-[11.5px] text-slate-500">
                  앱을 삭제하더라도 정기결제와 계정 권한은 남을 수 있으므로 아래 순서대로 확인해 주세요.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setUninstalledTarget(item);
                    void triggerMobileCleanerUninstall(item.packageName);
                  }}
                  className="py-2 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[12px] font-semibold cursor-pointer"
                >
                  1. 앱 삭제
                </button>
                <button
                  type="button"
                  onClick={() => void triggerOpenPlaySubscriptions(item.packageName)}
                  className="py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-semibold cursor-pointer"
                >
                  2. 정기결제 해지 확인
                </button>
                <button
                  type="button"
                  onClick={() => void triggerOpenGoogleAccountPermissions()}
                  className="py-2 px-3 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[12px] font-medium cursor-pointer"
                >
                  3. 구글 계정 권한 확인
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <p className="text-[12.5px] text-slate-700 leading-relaxed break-keep">
            {showPostUninstallFollowUp && uninstalledTarget
              ? `[${uninstalledTarget.appName}] 삭제 후 남아 있을 수 있는 정기결제와 구글 계정 권한을 아래에서 확인해 주세요.`
              : isNativeAndroid && lastScanDone
              ? `유료 결제를 유도하는 클리너 앱이 감지되지 않았습니다. 이미 삭제한 앱의 정기구독이나 계정 권한도 아래에서 확인할 수 있습니다.`
              : '클리너 앱 삭제 후 남아 있을 수 있는 Play 정기구독과 구글 계정 연결 권한을 확인할 수 있습니다.'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() =>
                void triggerOpenPlaySubscriptions(uninstalledTarget?.packageName || '')
              }
              className="py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-semibold cursor-pointer"
            >
              Play 정기구독 확인
            </button>
            <button
              type="button"
              onClick={() => void triggerOpenGoogleAccountPermissions()}
              className="py-2 px-3 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[12px] font-medium cursor-pointer"
            >
              구글 계정 권한 확인
            </button>
            <button
              type="button"
              onClick={() => void triggerOpenAllInstalledApps()}
              className="py-2 px-3 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[12px] font-medium cursor-pointer"
            >
              전체 설치 앱 보기
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
