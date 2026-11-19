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
import { useSaySeeStore } from '../store/useSaySeeStore';

export const MobileCleanerRescueBanner: React.FC = () => {
  const themeMode = useSaySeeStore((s) => s.themeMode);
  const isLight = themeMode === 'light';
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

  // 평상시(악성 클리너 미감지 상태)에는 첫 화면에 불필요한 메뉴 박스를 띄우지 않고,
  // 실제 악성 클리너(CleanX 등)가 감지되었거나 방금 삭제 후 2·3단계를 이어갈 때, 또는 사용자가 채팅으로 클리너 점검을 요청했을 때만 최상단 노출!
  if (!isAndroidEnv || (!hasDetected && !manualRequested && !showPostUninstallFollowUp)) {
    return null;
  }

  return (
    <section
      ref={bannerRef}
      data-allow-secretary-jump="true"
      className={`p-4 sm:p-5 rounded-2xl border-2 flex flex-col gap-3 shadow-md transition-colors ${
        hasDetected
          ? isLight
            ? 'bg-[#FFF1F2] border-[#E11D48]'
            : 'bg-gradient-to-r from-red-950/95 via-amber-950/85 to-zinc-950 border-red-400/85'
          : isLight
          ? 'bg-white border-[#0F766E]'
          : 'bg-[#111827] border-[#2DD4BF]/70'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            style={
              hasDetected
                ? { backgroundColor: '#DC2626', color: '#FFFFFF' }
                : { backgroundColor: '#0F766E', color: '#FFFFFF' }
            }
            className={`px-3 py-1 rounded-full text-[11.5px] font-black shadow-sm leading-snug ${
              hasDetected ? 'animate-pulse' : ''
            }`}
          >
            {hasDetected
              ? `🚨 주의! 유료결제 유도 악성 청소앱 ${detectedList.length}건 발견`
              : `🛡️ 유료결제 유도 악성 청소앱(${scannedCount}종) 안심 경호`}
          </span>
          <span
            className={`text-[11.5px] font-extrabold ${
              isLight ? 'text-slate-700' : 'text-zinc-200'
            }`}
          >
            {isNativeAndroid ? '앱 실시간 스캔 완료' : '모바일 3단 구출 센터'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void runScan(false)}
            className={`px-2.5 py-1 rounded-lg border text-[11.5px] font-extrabold cursor-pointer transition-colors ${
              isLight
                ? 'bg-[#F0FDFA] hover:bg-[#CCFBF1] border-[#0F766E]/40 text-[#0F766E]'
                : 'bg-zinc-900 hover:bg-zinc-800 border-white/20 text-teal-200'
            }`}
          >
            {scanning ? '🔍 스캔 중...' : '🔄 다시 스캔'}
          </button>
          {!hasDetected && (
            <button
              type="button"
              onClick={() => {
                setManualRequested(false);
                setUninstalledTarget(null);
              }}
              aria-label="점검 카드 닫기"
              className={`px-2 py-1 rounded-lg border text-[11.5px] font-extrabold cursor-pointer ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                  : 'bg-zinc-900 hover:bg-zinc-800 border-white/15 text-zinc-300'
              }`}
            >
              ✕ 닫기
            </button>
          )}
        </div>
      </div>

      {hasDetected ? (
        <div className="flex flex-col gap-2.5">
          {detectedList.map((item) => (
            <div
              key={item.packageName}
              className={`p-3.5 rounded-xl border flex flex-col gap-2.5 ${
                isLight
                  ? 'bg-white border-rose-300 shadow-sm'
                  : 'bg-black/70 border-red-400/55'
              }`}
            >
              <div className="flex flex-col gap-1">
                <span
                  className={`text-[14px] font-black leading-snug ${
                    isLight ? 'text-[#9F1239]' : 'text-red-200'
                  }`}
                >
                  ⚠️ [{item.appName}] ({item.packageName}) 설치 감지!
                </span>
                <span
                  className={`text-[12px] font-extrabold leading-snug ${
                    isLight ? 'text-[#B45309]' : 'text-amber-200'
                  }`}
                >
                  {item.riskSummaryKo}
                </span>
                <span
                  className={`text-[11.5px] font-semibold leading-snug ${
                    isLight ? 'text-slate-700' : 'text-zinc-200'
                  }`}
                >
                  💡 앱만 지워서는 주간 자동결제와 구글 계정 권한이 그대로 남을 수 있어요. 아래 1·2·3번 버튼으로 한 번에 깔끔히 정리하세요!
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setUninstalledTarget(item);
                    void triggerMobileCleanerUninstall(item.packageName);
                  }}
                  style={{ backgroundColor: '#DC2626', color: '#FFFFFF' }}
                  className="py-2.5 px-3 rounded-xl hover:opacity-95 text-[12.5px] font-black shadow cursor-pointer"
                >
                  🗑️ 1. [{item.appName}] 앱 즉시 삭제
                </button>
                <button
                  type="button"
                  onClick={() => void triggerOpenPlaySubscriptions(item.packageName)}
                  style={{ backgroundColor: '#D97706', color: '#FFFFFF' }}
                  className="py-2.5 px-3 rounded-xl hover:opacity-95 text-[12.5px] font-black shadow cursor-pointer"
                >
                  💳 2. 주간 정기결제(구독) 해지 확인
                </button>
                <button
                  type="button"
                  onClick={() => void triggerOpenGoogleAccountPermissions()}
                  style={{ backgroundColor: '#0F766E', color: '#FFFFFF' }}
                  className="py-2.5 px-3 rounded-xl hover:opacity-95 text-[12.5px] font-black shadow cursor-pointer"
                >
                  🔒 3. 구글 계정 데이터 권한 끊기
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <p
            className={`text-[12.5px] font-bold leading-relaxed break-keep ${
              isLight ? 'text-slate-800' : 'text-zinc-100'
            }`}
          >
            {showPostUninstallFollowUp && uninstalledTarget
              ? `✅ [${uninstalledTarget.appName}] 앱 삭제가 완료되었습니다! 앱을 지웠더라도 주간 정기결제나 구글 계정 데이터 접근 권한이 남아 있을 수 있으니 아래 버튼으로 마무리 점검해 주세요.`
              : isNativeAndroid && lastScanDone
              ? `✅ 현재 휴대폰에 유료결제 유도 클리너(${scannedCount}종 · CleanX 등)가 감지되지 않았습니다! 이미 앱을 삭제하셨더라도 남아 있을 수 있는 정기구독·구글 계정 권한·전체 설치 앱을 아래 버튼으로 바로 확인하실 수 있습니다.`
              : '👻 주 13,000원 자동결제를 유도하는 악성 청소앱 삭제 후 남아 있을 수 있는 Play 정기구독 해지 · 구글 계정 데이터 접근 권한 해제를 한 번에 확인해 보세요!'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() =>
                void triggerOpenPlaySubscriptions(uninstalledTarget?.packageName || '')
              }
              style={{ backgroundColor: '#B45309', color: '#FFFFFF' }}
              className="py-2.5 px-3 rounded-xl hover:opacity-95 text-[12px] font-extrabold shadow-sm cursor-pointer"
            >
              💳 Play 정기구독 해지 확인
            </button>
            <button
              type="button"
              onClick={() => void triggerOpenGoogleAccountPermissions()}
              style={{ backgroundColor: '#0F766E', color: '#FFFFFF' }}
              className="py-2.5 px-3 rounded-xl hover:opacity-95 text-[12px] font-extrabold shadow-sm cursor-pointer"
            >
              🔒 구글 계정 연결 권한 끊기
            </button>
            <button
              type="button"
              onClick={() => void triggerOpenAllInstalledApps()}
              className={`py-2.5 px-3 rounded-xl border text-[12px] font-extrabold cursor-pointer transition-colors ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                  : 'bg-zinc-800 hover:bg-zinc-700 border-white/20 text-white'
              }`}
            >
              📋 내 폰 전체 설치 앱 목록 열기
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
