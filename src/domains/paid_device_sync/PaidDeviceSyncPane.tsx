import React, { useMemo, useState } from 'react';
import { useSaySeeStore } from '../../store/useSaySeeStore';
import { GhostWindowThreeStageMockup } from '../../components/GhostWindowThreeStageMockup';
import { GhostSuperpowerDojo } from '../../components/ghostDojo/GhostSuperpowerDojo';
import { LoungeCustomSettingsHeader } from '../../components/LoungeView';
import { PcMasterQuickSendPanel } from '../../components/PricingModal';
import { GhostSecretaryFirstGuard } from '../../components/GhostSecretaryFirstGuard';
import { useDashboardNavStore } from '../shared/dashboardNavState';

export const PaidDeviceSyncPane: React.FC = () => {
  const {
    desktopTab,
    activeLoungeType,
    photos,
    matchedLocalDocs,
    openLocalFolder,
    syncState,
    setPrivateSyncStrategy,
    updateSyncSettings,
    setChargingOnlySync,
    triggerSyncNow,
  } = useSaySeeStore();

  const {
    activeIntegrationSubTab,
    setActiveIntegrationSubTab,
    ghostWindowTier,
    setGhostWindowTier,
    ghostWindowInitialTab,
  } = useDashboardNavStore();

  const [showPrivateSyncSection, setShowPrivateSyncSection] = useState(true);
  const [showPolicyAndStoreSection, setShowPolicyAndStoreSection] = useState(false);

  const activePhotos = useMemo(() => photos.filter((p) => !p.quarantined), [photos]);
  const quarantinedPhotos = useMemo(() => photos.filter((p) => p.quarantined), [photos]);

  return (
    <>
      {desktopTab === 'sync' && (
        <main className="flex-1 w-full max-w-[1640px] mx-auto px-5 md:px-8 py-7 flex flex-col gap-4">
          {activeLoungeType === 'personal' && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex p-1 rounded-2xl bg-zinc-900 border border-white/10 gap-1">
                <button
                  type="button"
                  onClick={() => setActiveIntegrationSubTab('devices')}
                  className={`px-4 py-2 rounded-xl font-label-sm text-[13px] font-extrabold transition-all cursor-pointer ${
                    activeIntegrationSubTab === 'devices'
                      ? 'bg-primary-container text-zinc-950 shadow-xs'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  🔗 내 기기 연결 (PC↔폰)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveIntegrationSubTab('superpower')}
                  className={`px-4 py-2 rounded-xl font-label-sm text-[13px] font-extrabold transition-all cursor-pointer ${
                    activeIntegrationSubTab === 'superpower'
                      ? 'bg-amber-400 text-zinc-950 shadow-xs'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  ⚡ 귀신창 (Ctrl+0)
                </button>
              </div>
            </div>
          )}

          <GhostSecretaryFirstGuard>
            {activeLoungeType === 'personal' && activeIntegrationSubTab === 'superpower' ? (
            <div className="flex flex-col gap-6">
              {/* [공문 2053 · v1.3 3순위] ⚡ 귀신창 초능력 상시 연습장 = 🥋 초능력 도장깨기 체험관 */}
              {ghostWindowTier === 'pc_free' && <GhostSuperpowerDojo variant="full" />}
              <GhostWindowThreeStageMockup
                activeTier={ghostWindowTier}
                onTierChange={setGhostWindowTier}
                initialWindowTab={ghostWindowInitialTab}
              />
              
            </div>
          ) : activeLoungeType === 'personal' ? (
            <>
              <LoungeCustomSettingsHeader />
              {/* [결함 3 해결] 하단 거대 중복 아코디언 2개 및 중복 폴더 카운트를 걷어내고 1줄 안심 배너만 유지 */}
              <div className="px-4 py-3 rounded-xl bg-zinc-900/80 border border-emerald-500/30 flex items-center justify-between gap-2 text-[12.5px] text-emerald-300 font-bold">
                <span>
                  🔒 내 사진·문서는 외부 서버 저장 없이 내 기기 간에만 암호화 직결되며, 탈퇴 시 흔적 없이 즉시 소멸됩니다.
                </span>
              </div>
            </>
          ) : (
            <>
          {/* 라운지별 전용 상단 설정 섹션 (가족 무수락 초대·강퇴 / 동호·동창회 관리 / 업무 공유(S:) 관리) */}
          <LoungeCustomSettingsHeader />

          {/* 노션 토글 1: 🔄 폰↔PC 프라이빗 싱크 센터 & 내 PC 로컬 폴더 직결 관리 (클릭 시 동적 펼침) */}
          <section className="rounded-2xl bg-[#18181B] border border-white/10 overflow-hidden transition-all">
            <div
              onClick={() => setShowPrivateSyncSection((v) => !v)}
              className="px-5 py-4 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-zinc-900/60 transition-colors select-none"
            >
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-[12.5px] text-primary-container font-bold">
                  {showPrivateSyncSection ? '▾' : '▸'} 🔄 폰↔PC 프라이빗 싱크 &amp; 로컬 폴더 관리
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-zinc-900 border border-white/10 text-zinc-300 text-[11px] font-bold">
                  {syncState.privateSyncStrategy === 'shadow'
                    ? `모드 B · 폰 용량 99.4% 절약 (${syncState.packSizeMB}MB)`
                    : `모드 A · 100% 원본 미러링 (${syncState.originalSizeGB}GB)`}
                </span>
                <span className="hidden md:inline text-[12px] text-zinc-400">
                  최근 일치화: {syncState.lastSyncedAt}
                </span>
              </div>

              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  disabled={syncState.syncing}
                  onClick={() => void triggerSyncNow()}
                  className="px-3.5 py-1.5 rounded-xl bg-primary-container hover:opacity-95 text-zinc-950 font-label-sm text-[12px] font-extrabold transition-all disabled:opacity-50 cursor-pointer"
                >
                  {syncState.syncing ? '일치화 실행 중...' : '⚡ 지금 일치시키기'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrivateSyncSection((v) => !v)}
                  className="px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-100 text-[13px] font-extrabold select-none shadow-sm cursor-pointer transition-all"
                >
                  {showPrivateSyncSection ? '접기 ▴' : '설정 펼치기 ▾'}
                </button>
              </div>
            </div>

            {showPrivateSyncSection && (
              <div className="px-5 pb-5 pt-3 border-t border-white/10 flex flex-col gap-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* 모드 A */}
                  <div
                    onClick={() => setPrivateSyncStrategy('mirror')}
                    className={`p-5 rounded-2xl cursor-pointer transition-all flex flex-col justify-between gap-4 border ${
                      syncState.privateSyncStrategy === 'mirror'
                        ? 'bg-zinc-900 border-primary-container'
                        : 'bg-zinc-950/70 hover:bg-zinc-900/80 border-white/10'
                    }`}
                  >
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded bg-zinc-800 border border-white/10 text-zinc-300 font-label-sm text-[11.5px] font-semibold">
                          모드 A · 폰 여유 공간이 넉넉할 때
                        </span>
                        <input
                          type="radio"
                          checked={syncState.privateSyncStrategy === 'mirror'}
                          onChange={() => setPrivateSyncStrategy('mirror')}
                          className="w-4 h-4 accent-[#00E5FF]"
                        />
                      </div>

                      <h2 className="font-headline-sm text-[17px] text-white font-bold">
                        🔄 100% 원본 미러링 모드
                      </h2>

                      <div className="p-3 rounded-xl bg-zinc-950/80 border border-white/10 flex flex-col gap-1.5 font-label-sm text-[12px]">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400">내 PC 보관함 용량</span>
                          <span className="text-white font-bold">{syncState.originalSizeGB} GB (원본 100%)</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400">내 스마트폰 점유 용량</span>
                          <span className="text-zinc-200 font-bold">{syncState.originalSizeGB} GB (1:1 미러링)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 모드 B */}
                  <div
                    onClick={() => setPrivateSyncStrategy('shadow')}
                    className={`p-5 rounded-2xl cursor-pointer transition-all flex flex-col justify-between gap-4 border ${
                      syncState.privateSyncStrategy === 'shadow'
                        ? 'bg-zinc-900 border-primary-container'
                        : 'bg-zinc-950/70 hover:bg-zinc-900/80 border-white/10'
                    }`}
                  >
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded bg-zinc-800 border border-white/10 text-primary-container font-label-sm text-[11.5px] font-bold">
                          모드 B · 폰 용량이 부족할 때 (권장)
                        </span>
                        <input
                          type="radio"
                          checked={syncState.privateSyncStrategy === 'shadow'}
                          onChange={() => setPrivateSyncStrategy('shadow')}
                          className="w-4 h-4 accent-[#00E5FF]"
                        />
                      </div>

                      <h2 className="font-headline-sm text-[17px] text-white font-bold">
                        ⚡ 스마트폰 용량 절약 모드 (원본은 PC에 안전 보관)
                      </h2>

                      <div className="p-3 rounded-xl bg-zinc-950/80 border border-white/10 flex flex-col gap-1.5 font-label-sm text-[12px]">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400">내 PC 하드디스크 (원본 보관)</span>
                          <span className="text-white font-bold">{syncState.originalSizeGB} GB (원본 전체)</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400">내 스마트폰 점유 용량 ({photos.length}장)</span>
                          <span className="text-primary-container font-bold">
                            단 {syncState.packSizeMB} MB (99.4% 절약)
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-zinc-950/70 border border-white/10 flex flex-col justify-between gap-3">
                    <div className="flex flex-col gap-2">
                      <h3 className="font-headline-sm text-[15px] text-white font-bold">
                        📲 자동 작동 조건 &amp; 즉시 일치화
                      </h3>

                      <label className="p-2.5 rounded-xl bg-zinc-900/70 border border-white/10 flex items-center justify-between gap-3 cursor-pointer">
                        <span className="font-label-md text-[12px] text-zinc-200 font-medium">
                          집/사무실 동일 Wi-Fi 연결 시에만 작동
                        </span>
                        <input
                          type="checkbox"
                          checked={syncState.wifiOnly}
                          onChange={(e) => updateSyncSettings(syncState.mode, e.target.checked)}
                          className="w-4 h-4 accent-[#00E5FF] rounded"
                        />
                      </label>

                      <label className="p-2.5 rounded-xl bg-zinc-900/70 border border-white/10 flex items-center justify-between gap-3 cursor-pointer">
                        <span className="font-label-md text-[12px] text-zinc-200 font-medium">
                          충전 중일 때만 백그라운드 동기화 실행
                        </span>
                        <input
                          type="checkbox"
                          checked={syncState.chargingOnly}
                          onChange={(e) => setChargingOnlySync(e.target.checked)}
                          className="w-4 h-4 accent-[#00E5FF] rounded"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-zinc-950/70 border border-white/10 flex flex-col justify-between gap-3">
                    <div className="flex flex-col gap-2.5">
                      <h3 className="font-headline-sm text-[15px] text-white font-bold">
                        📁 내 PC 로컬 폴더 직결 관리
                      </h3>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-white/10 flex flex-col">
                          <span className="font-body-sm text-[10.5px] text-zinc-400">갤러리 활성</span>
                          <span className="font-headline-sm text-[15px] text-white font-bold">
                            {activePhotos.length}장
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-white/10 flex flex-col">
                          <span className="font-body-sm text-[10.5px] text-zinc-400">스마트 서류함</span>
                          <span className="font-headline-sm text-[15px] text-white font-bold">
                            {matchedLocalDocs.length + activePhotos.filter((p) => p.isVaultDocument).length}건
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-white/10 flex flex-col">
                          <span className="font-body-sm text-[10.5px] text-zinc-400">휴지통 이동</span>
                          <span className="font-headline-sm text-[15px] text-white font-bold">
                            {quarantinedPhotos.length}장
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
                      <button
                        onClick={() => void openLocalFolder('photos')}
                        className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-200 font-label-sm text-[11.5px] font-medium cursor-pointer"
                      >
                        📂 사진 폴더
                      </button>
                      <button
                        onClick={() => void openLocalFolder('docs')}
                        className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-200 font-label-sm text-[11.5px] font-medium cursor-pointer"
                      >
                        📂 서류함(PDF) 폴더
                      </button>
                      <button
                        onClick={() => void openLocalFolder('quarantine')}
                        className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-200 font-label-sm text-[11.5px] font-medium cursor-pointer"
                      >
                        🗑️ OS 기본 휴지통 열기
                      </button>
                      <button
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('ghosti_navigate_showroom'));
                        }}
                        className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-primary-container font-label-sm text-[11.5px] font-semibold cursor-pointer"
                      >
                        🔒 보안 · QR 페어링 설정
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* 노션 토글 2: 🛡️ 모바일↔PC 연동 가이드 · 탈퇴 데이터 보호 원칙 */}
          <section className="rounded-2xl bg-[#18181B] border border-white/10 overflow-hidden transition-all">
            <div
              onClick={() => setShowPolicyAndStoreSection((v) => !v)}
              className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-2 cursor-pointer hover:bg-zinc-900/60 transition-colors select-none"
            >
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-[12.5px] text-emerald-400 font-bold">
                  {showPolicyAndStoreSection ? '▾' : '▸'} 🛡️ 데스크톱 연동 가이드 · 탈퇴 데이터 보호 원칙
                </span>
                <span className="hidden sm:inline text-[12px] text-zinc-400">
                  13KB 썸네일 DB 자체 해결 · 탈퇴 시 내 여권 100% 보존 · 원본 로컬 보관
                </span>
              </div>
              <span className="px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-100 text-[13px] font-extrabold select-none shadow-sm cursor-pointer transition-all">
                {showPolicyAndStoreSection ? '접기 ▴' : '펼치기 ▾'}
              </span>
            </div>

            {showPolicyAndStoreSection && (
              <div className="px-5 pb-5 pt-3 border-t border-white/10 flex flex-col gap-4">
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
