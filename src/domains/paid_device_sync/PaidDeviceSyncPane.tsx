import React, { useMemo, useState } from 'react';
import { useSaySeeStore } from '../../store/useSaySeeStore';
import { isMobileOrStoreRuntime } from '../../store/slices/storeSharedRefs';
import { LoungeCustomSettingsHeader } from '../../components/LoungeView';
import { PcMasterQuickSendPanel } from '../../components/PricingModal';
import { GhostSecretaryFirstGuard } from '../../components/GhostSecretaryFirstGuard';
import { DeviceIntegrationBeforeAfterShowcase } from './DeviceIntegrationBeforeAfterShowcase';

export const PaidDeviceSyncPane: React.FC = () => {
  const {
    desktopTab,
    activeLoungeType,
    isStoreAppMode,
    photos,
    matchedLocalDocs,
    openLocalFolder,
    syncState,
    setPrivateSyncStrategy,
    updateSyncSettings,
    setChargingOnlySync,
    triggerSyncNow,
  } = useSaySeeStore();

  const [showPrivateSyncSection, setShowPrivateSyncSection] = useState(true);
  const [showPolicyAndStoreSection, setShowPolicyAndStoreSection] = useState(false);
  const hidePricingForStore = Boolean(isStoreAppMode) || isMobileOrStoreRuntime();

  const activePhotos = useMemo(() => photos.filter((p) => !p.quarantined), [photos]);
  const quarantinedPhotos = useMemo(() => photos.filter((p) => p.quarantined), [photos]);

  return (
    <>
      {desktopTab === 'sync' && (
        <main className="flex-1 w-full max-w-[1160px] mx-auto px-5 md:px-8 py-7 flex flex-col gap-4">
          <GhostSecretaryFirstGuard>
            {activeLoungeType === 'personal' ? (
              <>
                <DeviceIntegrationBeforeAfterShowcase isStoreAppMode={hidePricingForStore} />
                <LoungeCustomSettingsHeader />
              </>
            ) : activeLoungeType === 'family' ||
              activeLoungeType === 'club' ||
              activeLoungeType === 'student' ? (
              <LoungeCustomSettingsHeader />
            ) : (
              <>
                <LoungeCustomSettingsHeader />

                <section className="rounded-xl bg-white border border-slate-200 overflow-hidden transition-all">
                  <div
                    onClick={() => setShowPrivateSyncSection((v) => !v)}
                    className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 transition-colors select-none"
                  >
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="text-[13.5px] text-slate-900 font-semibold">
                        {showPrivateSyncSection ? '▾' : '▸'} 동기화 및 로컬 폴더 설정
                      </span>
                      <span className="text-[12px] text-slate-500">
                        {syncState.privateSyncStrategy === 'shadow'
                          ? `용량 절약 모드 (${syncState.packSizeMB}MB)`
                          : `원본 보관 모드 (${syncState.originalSizeGB}GB)`}
                      </span>
                      <span className="hidden md:inline text-[12px] text-slate-400">
                        최근 동기화: {syncState.lastSyncedAt}
                      </span>
                    </div>

                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        disabled={syncState.syncing}
                        onClick={() => void triggerSyncNow()}
                        className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12px] font-semibold transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {syncState.syncing ? '동기화 중...' : '지금 동기화'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowPrivateSyncSection((v) => !v)}
                        className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 text-[12px] font-medium select-none cursor-pointer"
                      >
                        {showPrivateSyncSection ? '접기' : '펼치기'}
                      </button>
                    </div>
                  </div>

                  {showPrivateSyncSection && (
                    <div className="px-5 pb-5 pt-3 border-t border-slate-100 flex flex-col gap-4">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                        <div
                          onClick={() => setPrivateSyncStrategy('mirror')}
                          className={`p-4 rounded-xl cursor-pointer transition-all flex flex-col justify-between gap-3 border ${
                            syncState.privateSyncStrategy === 'mirror'
                              ? 'bg-slate-50 border-slate-900'
                              : 'bg-white hover:bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[14px] text-slate-900 font-semibold">
                              양쪽 원본 보관
                            </span>
                            <input
                              type="radio"
                              checked={syncState.privateSyncStrategy === 'mirror'}
                              onChange={() => setPrivateSyncStrategy('mirror')}
                              className="w-4 h-4 accent-slate-900"
                            />
                          </div>
                          <p className="text-[12.5px] text-slate-500">
                            PC와 스마트폰 양쪽에 원본({syncState.originalSizeGB}GB)을 동일하게 유지합니다.
                          </p>
                        </div>

                        <div
                          onClick={() => setPrivateSyncStrategy('shadow')}
                          className={`p-4 rounded-xl cursor-pointer transition-all flex flex-col justify-between gap-3 border ${
                            syncState.privateSyncStrategy === 'shadow'
                              ? 'bg-slate-50 border-slate-900'
                              : 'bg-white hover:bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[14px] text-slate-900 font-semibold">
                              스마트폰 용량 절약 (권장)
                            </span>
                            <input
                              type="radio"
                              checked={syncState.privateSyncStrategy === 'shadow'}
                              onChange={() => setPrivateSyncStrategy('shadow')}
                              className="w-4 h-4 accent-slate-900"
                            />
                          </div>
                          <p className="text-[12.5px] text-slate-500">
                            원본은 PC에 보관하고 스마트폰에는 미리보기({syncState.packSizeMB}MB)만 남깁니다.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 flex flex-col gap-2.5">
                          <h3 className="text-[13.5px] text-slate-900 font-semibold">동기화 조건</h3>
                          <label className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-3 cursor-pointer">
                            <span className="text-[12.5px] text-slate-700">Wi-Fi 연결 시에만 동기화</span>
                            <input
                              type="checkbox"
                              checked={syncState.wifiOnly}
                              onChange={(e) => updateSyncSettings(syncState.mode, e.target.checked)}
                              className="w-4 h-4 accent-slate-900 rounded"
                            />
                          </label>
                          <label className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-3 cursor-pointer">
                            <span className="text-[12.5px] text-slate-700">충전 중일 때만 실행</span>
                            <input
                              type="checkbox"
                              checked={syncState.chargingOnly}
                              onChange={(e) => setChargingOnlySync(e.target.checked)}
                              className="w-4 h-4 accent-slate-900 rounded"
                            />
                          </label>
                        </div>

                        <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 flex flex-col justify-between gap-3">
                          <div className="flex flex-col gap-2">
                            <h3 className="text-[13.5px] text-slate-900 font-semibold">로컬 폴더</h3>
                            <div className="grid grid-cols-3 gap-2 text-[12px]">
                              <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex flex-col">
                                <span className="text-slate-500">사진</span>
                                <span className="text-[14px] text-slate-900 font-semibold">{activePhotos.length}장</span>
                              </div>
                              <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex flex-col">
                                <span className="text-slate-500">문서</span>
                                <span className="text-[14px] text-slate-900 font-semibold">
                                  {matchedLocalDocs.length + activePhotos.filter((p) => p.isVaultDocument).length}건
                                </span>
                              </div>
                              <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex flex-col">
                                <span className="text-slate-500">휴지통</span>
                                <span className="text-[14px] text-slate-900 font-semibold">{quarantinedPhotos.length}장</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200/80">
                            <button
                              onClick={() => void openLocalFolder('photos')}
                              className="px-2.5 py-1.5 rounded-md bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[12px] font-medium cursor-pointer"
                            >
                              사진 폴더
                            </button>
                            <button
                              onClick={() => void openLocalFolder('docs')}
                              className="px-2.5 py-1.5 rounded-md bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[12px] font-medium cursor-pointer"
                            >
                              문서 폴더
                            </button>
                            <button
                              onClick={() => void openLocalFolder('quarantine')}
                              className="px-2.5 py-1.5 rounded-md bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[12px] font-medium cursor-pointer"
                            >
                              휴지통 열기
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </section>

                <section className="rounded-xl bg-white border border-slate-200 overflow-hidden transition-all">
                  <div
                    onClick={() => setShowPolicyAndStoreSection((v) => !v)}
                    className="px-5 py-3.5 flex items-center justify-between gap-2 cursor-pointer hover:bg-slate-50 transition-colors select-none"
                  >
                    <span className="text-[13.5px] text-slate-900 font-semibold">
                      {showPolicyAndStoreSection ? '▾' : '▸'} 파일 직접 전송
                    </span>
                    <span className="text-[12px] text-slate-500">
                      {showPolicyAndStoreSection ? '접기' : '펼치기'}
                    </span>
                  </div>

                  {showPolicyAndStoreSection && (
                    <div className="px-5 pb-5 pt-3 border-t border-slate-100 flex flex-col gap-4">
                      <PcMasterQuickSendPanel />
                    </div>
                  )}
                </section>
              </>
            )}
          </GhostSecretaryFirstGuard>
        </main>
      )}
    </>
  );
};
