import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckSquare,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Square,
  Trash2,
} from 'lucide-react';
import {
  checkMobileUsageStatsPermission,
  isCapacitorAndroidRuntime,
  openMobileUsageStatsSettings,
  scanMobileUnusedApps,
  uninstallMobileAppAndWait,
  type UnusedAppBucket,
  type UnusedMobileAppItem,
} from '../services/ghostiMobileCareBridge';

function fmtMb(bytes: number): string {
  if (!bytes || bytes <= 0) return '0MB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)}GB`;
  return `${Math.max(1, Math.round(mb))}MB`;
}

/**
 * 🤖 Android 정식 앱 전용 [📱 안 쓰는 앱 솎아내기 (바탕화면 아이콘 다이어트)] 카드
 * - iOS(아이폰)에서는 Apple Guideline 2.5.2 방어를 위해 0px 완전 비노출(return null)합니다.
 * - 기본 홈 런처 교체 없이 UsageStatsManager + ACTION_MAIN/LAUNCHER 합법 조회로
 *   [🕸️ 1년 이상] / [📦 3개월 이상] / [⚡ 최근 사용] 3단 분류 + 3대 안심 힌트 + 체크 후 순차 연타 삭제를 제공합니다.
 */
export const MobileUnusedAppsCleanerCard: React.FC = () => {
  const isAndroidNative = isCapacitorAndroidRuntime();
  const [expanded, setExpanded] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [scanning, setScanning] = useState(false);
  const [apps, setApps] = useState<UnusedMobileAppItem[]>([]);
  const [activeBucket, setActiveBucket] = useState<UnusedAppBucket>('over_1y');
  const [selectedPkgs, setSelectedPkgs] = useState<Set<string>>(new Set());
  const [uninstalling, setUninstalling] = useState(false);
  const [uninstallProgress, setUninstallProgress] = useState<{ current: number; total: number; name: string } | null>(
    null
  );
  const [completionBanner, setCompletionBanner] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const runScan = useCallback(async () => {
    if (!isAndroidNative) return;
    setScanning(true);
    try {
      const granted = await checkMobileUsageStatsPermission();
      setPermissionGranted(granted);
      if (!granted) {
        setApps([]);
        return;
      }
      const res = await scanMobileUnusedApps();
      setPermissionGranted(res.permissionGranted);
      if (res.ok && res.permissionGranted) {
        setApps(res.apps);
        const hasOver1y = res.apps.some((a) => a.bucket === 'over_1y');
        const hasOver3m = res.apps.some((a) => a.bucket === 'over_3m');
        if (hasOver1y) {
          setActiveBucket('over_1y');
        } else if (hasOver3m) {
          setActiveBucket('over_3m');
        } else {
          setActiveBucket('recent');
        }
      }
    } finally {
      setScanning(false);
    }
  }, [isAndroidNative]);

  // 채팅창("안 쓰는 앱 정리해줘" / "바탕화면 아이콘 정리해줘")에서 오픈 이벤트 수신
  useEffect(() => {
    if (!isAndroidNative) return;
    const onOpenCleaner = () => {
      setExpanded(true);
      void runScan();
      window.setTimeout(() => {
        cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 90);
    };
    window.addEventListener('ghosti_open_unused_apps_cleaner', onOpenCleaner);
    return () => {
      window.removeEventListener('ghosti_open_unused_apps_cleaner', onOpenCleaner);
    };
  }, [isAndroidNative, runScan]);

  // 설정 화면에서 [사용 정보 접근 허용] 스위치를 켜고 돌아오면 즉시 자동 스캔
  useEffect(() => {
    if (!isAndroidNative || !expanded) return;
    const onReturn = () => {
      if (document.visibilityState === 'visible' && !uninstalling) {
        void runScan();
      }
    };
    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('focus', onReturn);
    return () => {
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener('focus', onReturn);
    };
  }, [isAndroidNative, expanded, uninstalling, runScan]);

  const bucketCounts = useMemo(() => {
    const over1y = apps.filter((a) => a.bucket === 'over_1y');
    const over3m = apps.filter((a) => a.bucket === 'over_3m');
    const recent = apps.filter((a) => a.bucket === 'recent');
    return {
      over_1y: { list: over1y, bytes: over1y.reduce((s, a) => s + a.apkSizeBytes, 0) },
      over_3m: { list: over3m, bytes: over3m.reduce((s, a) => s + a.apkSizeBytes, 0) },
      recent: { list: recent, bytes: recent.reduce((s, a) => s + a.apkSizeBytes, 0) },
    };
  }, [apps]);

  const visibleApps = bucketCounts[activeBucket].list;

  const selectedItemsInBucket = useMemo(
    () => visibleApps.filter((a) => selectedPkgs.has(a.packageName)),
    [visibleApps, selectedPkgs]
  );

  const selectedBytes = useMemo(
    () => selectedItemsInBucket.reduce((s, a) => s + a.apkSizeBytes, 0),
    [selectedItemsInBucket]
  );

  if (!isAndroidNative) {
    return null;
  }

  const toggleSelect = (pkg: string) => {
    setSelectedPkgs((prev) => {
      const next = new Set(prev);
      if (next.has(pkg)) next.delete(pkg);
      else next.add(pkg);
      return next;
    });
  };

  const handleSelectAllSafeInBucket = () => {
    const removable = visibleApps.filter((a) => a.safetyTier !== 'protected');
    const allAlready = removable.length > 0 && removable.every((a) => selectedPkgs.has(a.packageName));
    setSelectedPkgs((prev) => {
      const next = new Set(prev);
      if (allAlready) {
        visibleApps.forEach((a) => next.delete(a.packageName));
      } else {
        removable.forEach((a) => next.add(a.packageName));
      }
      return next;
    });
  };

  const handleRunSequentialUninstall = async () => {
    if (selectedItemsInBucket.length === 0 || uninstalling) return;
    setUninstalling(true);
    setCompletionBanner(null);

    const targets = [...selectedItemsInBucket];
    let removedCount = 0;
    let freedBytes = 0;
    const removedSet = new Set<string>();

    try {
      for (let i = 0; i < targets.length; i++) {
        const item = targets[i];
        setUninstallProgress({ current: i + 1, total: targets.length, name: item.appName });
        const res = await uninstallMobileAppAndWait(item.packageName);
        if (res.removed) {
          removedCount += 1;
          freedBytes += item.apkSizeBytes;
          removedSet.add(item.packageName);
          setApps((prev) => prev.filter((a) => a.packageName !== item.packageName));
          setSelectedPkgs((prev) => {
            const next = new Set(prev);
            next.delete(item.packageName);
            return next;
          });
        }
      }
      if (removedCount > 0) {
        setCompletionBanner(
          `안 쓰는 앱 ${removedCount}개(약 ${fmtMb(freedBytes)})를 정리했습니다! 바탕화면 아이콘 ${removedCount}개도 함께 비워졌습니다.`
        );
      } else {
        setCompletionBanner('삭제된 앱이 없습니다. 원하시는 앱을 선택한 뒤 확인 팝업에서 [확인]을 눌러 주세요.');
      }
    } finally {
      setUninstalling(false);
      setUninstallProgress(null);
    }
  };

  const totalUnusedCount = bucketCounts.over_1y.list.length + bucketCounts.over_3m.list.length;

  return (
    <section
      ref={cardRef}
      id="ghosti-mobile-unused-apps-section"
      className="w-full rounded-xl bg-white border border-slate-200 overflow-hidden scroll-mt-4"
    >
      <button
        type="button"
        onClick={() => {
          const next = !expanded;
          setExpanded(next);
          if (next && permissionGranted === null) {
            void runScan();
          }
        }}
        className="w-full px-3.5 py-3 flex items-center justify-between gap-2 text-left hover:bg-slate-50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200/80 text-teal-700 flex items-center justify-center shrink-0">
            <Smartphone className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[13.5px] font-bold text-slate-900">
                안 쓰는 앱 솎아내기
              </span>
              {permissionGranted && totalUnusedCount > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold">
                  미사용 {totalUnusedCount}개
                </span>
              )}
            </div>
            <p className="text-[11.5px] text-slate-500 truncate">
              1년·3개월 이상 안 쓴 앱을 모아 바탕화면 아이콘과 용량을 한 번에 정리
            </p>
          </div>
        </div>
        <span className="text-slate-400 shrink-0">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      {expanded && (
        <div className="px-3.5 pb-3.5 pt-1 border-t border-slate-100 space-y-3">
          {completionBanner && (
            <div className="px-3 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-[12px] font-semibold flex items-center justify-between gap-2">
              <span className="break-keep leading-relaxed">{completionBanner}</span>
              <button
                type="button"
                onClick={() => setCompletionBanner(null)}
                className="text-[11px] text-emerald-700 shrink-0 cursor-pointer"
              >
                닫기
              </button>
            </div>
          )}

          {permissionGranted === false ? (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
              <p className="text-[12.5px] text-slate-700 leading-relaxed break-keep">
                오래 안 쓴 앱(1년 이상 · 3개월 이상)을 정확히 찾아내려면 Android 설정에서{' '}
                <strong className="text-slate-900">[사용 정보 접근 허용]</strong> 스위치를 딱 한 번만 켜주셔야 해요.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void openMobileUsageStatsSettings()}
                  className="px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12px] font-semibold cursor-pointer"
                >
                  사용 정보 접근 허용하기
                </button>
                <button
                  type="button"
                  onClick={() => void runScan()}
                  className="px-3 py-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[12px] font-medium cursor-pointer"
                >
                  허용 후 다시 확인
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* 3단 기간별 폴더 탭 */}
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { key: 'over_1y', label: '1년 이상 안 씀', accent: 'rose' },
                    { key: 'over_3m', label: '3개월 이상', accent: 'amber' },
                    { key: 'recent', label: '최근 사용', accent: 'teal' },
                  ] as const
                ).map((tab) => {
                  const info = bucketCounts[tab.key];
                  const isActive = activeBucket === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveBucket(tab.key)}
                      className={`p-2 rounded-lg border text-left transition-colors cursor-pointer ${
                        isActive
                          ? tab.accent === 'rose'
                            ? 'bg-rose-600 border-rose-600 text-white'
                            : tab.accent === 'amber'
                            ? 'bg-amber-600 border-amber-600 text-white'
                            : 'bg-teal-600 border-teal-600 text-white'
                          : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-[11px] font-semibold truncate">{tab.label}</div>
                      <div className="flex items-baseline justify-between gap-1 mt-0.5">
                        <span className="text-[13.5px] font-bold tabular-nums">{info.list.length}개</span>
                        <span className={`text-[10.5px] tabular-nums ${isActive ? 'text-white/85' : 'text-slate-500'}`}>
                          {fmtMb(info.bytes)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* 상단 제어 바 */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11.5px] text-slate-500">
                  {scanning
                    ? '설치된 앱 사용 기록을 점검하고 있어요...'
                    : `총 ${apps.length}개 앱 점검 완료 · 삭제할 앱만 골라 주세요`}
                </span>
                <div className="flex items-center gap-1.5">
                  {visibleApps.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSelectAllSafeInBucket}
                      className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11.5px] font-medium cursor-pointer"
                    >
                      안전 항목 전체 선택
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={scanning || uninstalling}
                    onClick={() => void runScan()}
                    className="p-1.5 rounded-md bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 cursor-pointer disabled:opacity-40"
                    title="다시 스캔"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* 앱 리스트 */}
              {visibleApps.length === 0 ? (
                <div className="py-5 text-center text-[12px] text-slate-500 bg-slate-50 rounded-lg border border-slate-100">
                  {scanning
                    ? '사용 기록을 불러오는 중입니다...'
                    : activeBucket === 'over_1y'
                    ? '1년 이상 방치된 앱이 없습니다.'
                    : activeBucket === 'over_3m'
                    ? '3개월 이상 안 쓴 앱이 없습니다.'
                    : '표시할 앱이 없습니다.'}
                </div>
              ) : (
                <div className="max-h-[320px] overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg bg-white">
                  {visibleApps.map((app) => {
                    const checked = selectedPkgs.has(app.packageName);
                    return (
                      <div
                        key={app.packageName}
                        onClick={() => !uninstalling && toggleSelect(app.packageName)}
                        className={`p-2.5 flex items-start gap-2.5 cursor-pointer transition-colors ${
                          checked ? 'bg-teal-50/60' : 'hover:bg-slate-50'
                        }`}
                      >
                        <span className="mt-1 shrink-0 text-teal-600">
                          {checked ? (
                            <CheckSquare className="w-4 h-4" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300" />
                          )}
                        </span>

                        {app.iconDataUrl ? (
                          <img
                            src={app.iconDataUrl}
                            alt=""
                            className="w-9 h-9 rounded-lg border border-slate-200/80 shrink-0 object-cover bg-white"
                          />
                        ) : (
                          <span className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                            <Smartphone className="w-4 h-4" />
                          </span>
                        )}

                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[13px] font-bold text-slate-900 truncate">
                              {app.appName}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-500 tabular-nums shrink-0">
                              {fmtMb(app.apkSizeBytes)}
                            </span>
                          </div>
                          <div className="text-[11.5px] text-slate-600 break-keep leading-snug">
                            {app.plainRoleKo}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                            <span className="text-[10.5px] text-slate-500">{app.lastUsedLabelKo}</span>
                            <span
                              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                app.safetyTier === 'danger'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : app.safetyTier === 'protected'
                                  ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                  : 'bg-amber-50 text-amber-800 border border-amber-200'
                              }`}
                            >
                              {app.safetyTier === 'protected' && <ShieldCheck className="w-2.5 h-2.5" />}
                              {app.safetyBadgeKo}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 하단 순차 연타 삭제 실행 바 */}
              {selectedItemsInBucket.length > 0 && (
                <div className="pt-1 flex flex-col gap-1.5">
                  <button
                    type="button"
                    disabled={uninstalling}
                    onClick={() => void handleRunSequentialUninstall()}
                    className="w-full py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-[13px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4 shrink-0" />
                    {uninstallProgress
                      ? `(${uninstallProgress.current}/${uninstallProgress.total}) ${uninstallProgress.name} 삭제 확인 중...`
                      : `선택한 ${selectedItemsInBucket.length}개 정리 시작 (${fmtMb(selectedBytes)})`}
                  </button>
                  <p className="text-[11px] text-slate-500 text-center break-keep">
                    OS 보안 정책에 따라 삭제 확인 창이 차례로 뜹니다. [확인]만 눌러 주시면 바로 정리됩니다.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
};
