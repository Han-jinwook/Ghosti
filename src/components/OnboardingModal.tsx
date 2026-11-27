import React, { useEffect, useMemo, useState } from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';
import { getZCoreUrl, hasActiveGhostiLoginSession } from '../services/zCoreBridge';
import { GhostiBrandLogo } from './GhostiBrandLogo';
import { GhostSearchDojoStampBoard } from './ghostDojo/ghostSearchDojoShared';

export type OnboardingTabId = 'tab1_find_care' | 'tab3_share_pro';

export interface SuperpowerTrialStatus {
  engine_running: boolean;
  machine_hwid: string;
  account_id: string;
  trial_status: 'NOT_STARTED' | 'ACTIVE' | 'ACTIVE_30D' | 'TRIAL_UNLIMITED' | 'PER_FEATURE_ACTIVE' | 'EXPIRED_LOCKED' | 'EXPIRED' | 'SUBSCRIBED';
  trial_opt_in_status?: 'NOT_STARTED' | 'DEFERRED' | 'ACTIVE_30D' | 'EXPIRED_LOCKED' | 'SUBSCRIBED';
  badge_label?: string;
  feature_trials?: Record<string, any>;
  cross_device_trial?: Record<string, any>;
  trial_days_left: number;
  daily_free_limit?: number;
  daily_free_remaining?: number;
  started_at: string | null;
  expires_at: string | null;
  is_subscribed: boolean;
}

const TRIAL_STORAGE_KEY = 'ghosti_superpower_trial_v27';

export function playBabyGhostChime(mode: 'typo' | 'summon' = 'typo'): void {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('ghosti_sound_enabled') === 'false') {
      return;
    }
    const wavUrl = mode === 'summon' ? '/sounds/active_summon_sound.wav' : '/sounds/active_typo_sound.wav';
    const audio = new Audio(wavUrl);
    audio.volume = 0.22;
    void audio.play().catch(() => {
      playWebAudioFallbackChime();
    });
    return;
  } catch {
    // ignore
  }
  playWebAudioFallbackChime();
}

function playWebAudioFallbackChime(): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [
      { freq: 1046.5, start: 0, dur: 0.075 },
      { freq: 1318.5, start: 0.08, dur: 0.075 },
      { freq: 1568.0, start: 0.16, dur: 0.14 },
    ];
    notes.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      gain.gain.setValueAtTime(0.14, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    });
  } catch {
    // ignore
  }
}

export async function fetchSuperpowerStatus(accountId: string, isSubscribed: boolean): Promise<SuperpowerTrialStatus> {
  if (hasActiveGhostiLoginSession()) {
    try {
      const hubToken = useSaySeeStore.getState().merlinAuth?.token || '';
      const q = new URLSearchParams({ accountId, isSubscribed: String(isSubscribed), hubToken });
      const res = await fetch(getZCoreUrl(`/api/superpower/status?${q.toString()}`), {
        signal: AbortSignal.timeout(1500),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.ok) {
          localStorage.setItem(TRIAL_STORAGE_KEY, JSON.stringify(data));
          return data as SuperpowerTrialStatus;
        }
      }
    } catch {
      // fallback
    }
  }
  const savedRaw = localStorage.getItem(TRIAL_STORAGE_KEY);
  if (savedRaw) {
    try {
      const parsed = JSON.parse(savedRaw) as SuperpowerTrialStatus;
      if (isSubscribed) {
        return { ...parsed, trial_status: 'SUBSCRIBED', trial_days_left: 9999, is_subscribed: true };
      }
      return parsed;
    } catch {
      // ignore
    }
  }
  return {
    engine_running: false,
    machine_hwid: 'sha256_local_pc_device',
    account_id: accountId,
    trial_status: isSubscribed ? 'SUBSCRIBED' : 'NOT_STARTED',
    trial_days_left: isSubscribed ? 9999 : 30,
    started_at: null,
    expires_at: null,
    is_subscribed: isSubscribed,
  };
}

export async function startSuperpowerTrialAction(
  accountId: string,
  isSubscribed: boolean,
  agreed: boolean = true,
): Promise<SuperpowerTrialStatus> {
  if (hasActiveGhostiLoginSession()) {
    try {
      const hubToken = useSaySeeStore.getState().merlinAuth?.token || '';
      const res = await fetch(getZCoreUrl('/api/superpower/start-trial'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, isSubscribed, agreed, hubToken }),
        signal: AbortSignal.timeout(1800),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.ok) {
          localStorage.setItem(TRIAL_STORAGE_KEY, JSON.stringify(data));
          window.dispatchEvent(new CustomEvent('ghosti_superpower_status_updated', { detail: data }));
          return data as SuperpowerTrialStatus;
        }
      }
    } catch {
      // fallback
    }
  }
  if (!agreed) {
    const deferredStatus: SuperpowerTrialStatus = {
      engine_running: false,
      machine_hwid: 'sha256_local_pc_device',
      account_id: accountId,
      trial_status: isSubscribed ? 'SUBSCRIBED' : 'NOT_STARTED',
      trial_opt_in_status: isSubscribed ? 'SUBSCRIBED' : 'DEFERRED',
      trial_days_left: isSubscribed ? 9999 : 30,
      started_at: null,
      expires_at: null,
      is_subscribed: isSubscribed,
    };
    localStorage.setItem(TRIAL_STORAGE_KEY, JSON.stringify(deferredStatus));
    return deferredStatus;
  }
  const now = new Date();
  const exp = new Date(now.getTime() + 30 * 86400 * 1000);
  const fallback: SuperpowerTrialStatus = {
    engine_running: true,
    machine_hwid: 'sha256_local_pc_device',
    account_id: accountId,
    trial_status: isSubscribed ? 'SUBSCRIBED' : 'ACTIVE',
    trial_days_left: isSubscribed ? 9999 : 30,
    started_at: now.toISOString().slice(0, 19).replace('T', ' '),
    expires_at: exp.toISOString().slice(0, 19).replace('T', ' '),
    is_subscribed: isSubscribed,
  };
  localStorage.setItem(TRIAL_STORAGE_KEY, JSON.stringify(fallback));
  window.dispatchEvent(new CustomEvent('ghosti_superpower_status_updated', { detail: fallback }));
  return fallback;
}

const PairingQrCodeSvg: React.FC = () => (
  <img
    src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=6&data=https%3A%2F%2Fghosti.sundreamer.app"
    alt="모바일 앱 설치 QR 코드"
    className="w-20 h-20 rounded-lg bg-white p-1.5 border border-slate-200 shrink-0"
  />
);

export const OnboardingModal: React.FC = () => {
  const {
    showOnboarding,
    setShowOnboarding,
    setOnboardingTrackMode,
    pcAgentPairedMobile,
    setPcAgentPairedMobile,
    startOnboardingIndexing,
    cancelOnboardingIndexing,
    photos,
    localDocuments,
    videoSceneItems,
    trialScanPermissions,
    setTrialScanPermission,
    runBriefingHintChip,
    setShowProModal,
    setDesktopTab,
    merlinAuth,
    isStoreAppMode,
  } = useSaySeeStore();

  const [activeTab, setActiveTab] = useState<OnboardingTabId>('tab1_find_care');
  const [telemetryEnabled, setTelemetryEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ghosti_telemetry_enabled') !== 'false';
    } catch {
      return true;
    }
  });
  const [showTermsClause, setShowTermsClause] = useState(false);

  useEffect(() => {
    const onOpenOnboardingTab = (e: Event) => {
      const custom = e as CustomEvent<{ tab?: OnboardingTabId }>;
      if (custom.detail?.tab) {
        setActiveTab(custom.detail.tab);
      }
      setShowOnboarding(true);
    };
    window.addEventListener('ghosti_open_onboarding_tab', onOpenOnboardingTab);
    return () => window.removeEventListener('ghosti_open_onboarding_tab', onOpenOnboardingTab);
  }, [setShowOnboarding]);

  const vaultPhotoCount = photos.filter((p) => !p.quarantined && p.isVaultDocument).length;
  const totalIndexedDocs = localDocuments.length + vaultPhotoCount;

  const dynamicTrialDocHints = useMemo(
    () => localDocuments.slice(0, 2).map((d) => d.title),
    [localDocuments]
  );

  const dynamicTrialVideoHints = useMemo(
    () =>
      videoSceneItems.slice(0, 2).map((v) => {
        const highlightFrame =
          v.timelineFrames.find((f) => f.timeSec === v.matchedSeekSec) ??
          v.timelineFrames[0];
        return highlightFrame ? highlightFrame.keywords.slice(0, 3).join(' ') : v.title;
      }),
    [videoSceneItems]
  );

  if (!showOnboarding) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 pt-safe pb-safe overflow-y-auto">
      <div className="relative w-full max-w-3xl max-h-[90dvh] overflow-y-auto rounded-2xl bg-white border border-slate-200 p-5 sm:p-7 shadow-2xl flex flex-col gap-5 my-auto text-slate-900">
        {/* 헤더 */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex flex-col gap-1 min-w-0">
            <GhostiBrandLogo size="desktop" />
            <h2 className="text-[19px] md:text-[21px] text-slate-900 font-bold tracking-tight mt-1">
              귀신같이 시작 가이드
            </h2>
          </div>

          <button
            type="button"
            onClick={() => {
              cancelOnboardingIndexing();
              setShowOnboarding(false);
            }}
            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[12px] font-medium cursor-pointer shrink-0"
          >
            닫기
          </button>
        </div>

        {/* 탭 */}
        <div
          role="tablist"
          aria-label="가이드 메뉴"
          className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'tab1_find_care'}
            onClick={() => setActiveTab('tab1_find_care')}
            className={`py-2 px-3 rounded-lg text-center text-[13px] transition-colors cursor-pointer ${
              activeTab === 'tab1_find_care'
                ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            내 기기 검색 · 정리
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'tab3_share_pro'}
            onClick={() => setActiveTab('tab3_share_pro')}
            className={`py-2 px-3 rounded-lg text-center text-[13px] transition-colors cursor-pointer ${
              activeTab === 'tab3_share_pro'
                ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            사진 공유 · 기기 확장
          </button>
        </div>

        {activeTab === 'tab1_find_care' && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 flex flex-col justify-between gap-3">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] font-bold text-slate-900">귀신검색 (Ctrl+0)</span>
                    <span className="text-[11.5px] text-slate-500 font-medium">무료</span>
                  </div>
                  <p className="text-[12.5px] text-slate-600 leading-relaxed">
                    파일명을 몰라도 문서(PDF·엑셀·한글) 본문과 사진·동영상 내용으로 바로 검색합니다.
                  </p>

                  {(dynamicTrialDocHints.length > 0 || dynamicTrialVideoHints.length > 0) && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {dynamicTrialDocHints.map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => {
                            cancelOnboardingIndexing();
                            setShowOnboarding(false);
                            setDesktopTab('dashboard');
                            void runBriefingHintChip('doc', q);
                          }}
                          className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 border border-slate-200 text-[11.5px] text-slate-700 font-medium cursor-pointer"
                        >
                          “{q}”
                        </button>
                      ))}
                      {dynamicTrialVideoHints.map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => {
                            cancelOnboardingIndexing();
                            setShowOnboarding(false);
                            setDesktopTab('dashboard');
                            void runBriefingHintChip('video', q);
                          }}
                          className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 border border-slate-200 text-[11.5px] text-slate-700 font-medium cursor-pointer"
                        >
                          “{q}”
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setOnboardingTrackMode('pc_local');
                    void startOnboardingIndexing();
                    setShowOnboarding(false);
                    setDesktopTab('dashboard');
                  }}
                  className="w-full py-2 px-3 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12.5px] font-semibold cursor-pointer"
                >
                  귀신검색 열기 ({totalIndexedDocs}건)
                </button>
              </div>

              <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 flex flex-col justify-between gap-3">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] font-bold text-slate-900">귀신비서</span>
                    <span className="text-[11.5px] text-slate-500 font-medium">무료</span>
                  </div>
                  <ul className="text-[12.5px] text-slate-600 space-y-1.5 leading-relaxed">
                    <li>• 중복 사진 및 다운로드·바탕화면 정리 (사전 목록 확인 후 실행)</li>
                    <li>• 불필요한 보안 모듈 점검 및 PC 속도 개선</li>
                    <li>• 모든 작업은 복원 기록에서 원래 상태로 되돌릴 수 있습니다.</li>
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    cancelOnboardingIndexing();
                    setShowOnboarding(false);
                    setDesktopTab('trash');
                  }}
                  className="w-full py-2 px-3 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-900 text-[12.5px] font-semibold cursor-pointer"
                >
                  귀신비서 열기
                </button>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex flex-col gap-2 flex-1">
                <span className="text-[12.5px] font-semibold text-slate-900">
                  검색 대상 폴더 선택
                </span>
                <div className="flex flex-wrap gap-2">
                  <label className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 flex items-center gap-2 text-[12px] text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={trialScanPermissions.gallery}
                      onChange={(e) => setTrialScanPermission('gallery', e.target.checked)}
                      className="accent-slate-900"
                    />
                    <span>사진첩</span>
                  </label>
                  <label className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 flex items-center gap-2 text-[12px] text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={trialScanPermissions.downloads}
                      onChange={(e) => setTrialScanPermission('downloads', e.target.checked)}
                      className="accent-slate-900"
                    />
                    <span>다운로드</span>
                  </label>
                  <label className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 flex items-center gap-2 text-[12px] text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={trialScanPermissions.desktop}
                      onChange={(e) => setTrialScanPermission('desktop', e.target.checked)}
                      className="accent-slate-900"
                    />
                    <span>바탕화면</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-slate-200 shrink-0">
                <PairingQrCodeSvg />
                <div className="flex flex-col gap-1 max-w-[190px]">
                  <span className="text-[12px] font-semibold text-slate-900">모바일 앱 설치</span>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    설치 후 같은 이메일로 로그인하면 내 PC와 연결됩니다.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const isAuthed = Boolean(
                        merlinAuth?.email && merlinAuth.userId && merlinAuth.userId !== 'guest'
                      );
                      if (!isAuthed) {
                        window.dispatchEvent(new CustomEvent('openLoginModal'));
                        return;
                      }
                      setPcAgentPairedMobile(!pcAgentPairedMobile);
                    }}
                    className="text-left text-[11px] text-slate-700 font-medium underline cursor-pointer"
                  >
                    {merlinAuth?.email && merlinAuth.userId !== 'guest' && pcAgentPairedMobile
                      ? '모바일 연결됨'
                      : merlinAuth?.email && merlinAuth.userId !== 'guest'
                      ? '연결 상태 전환'
                      : '로그인하기'}
                  </button>
                </div>
              </div>
            </div>

            <GhostSearchDojoStampBoard
              variant="compact"
              onJumpToSearchTab={() => {
                cancelOnboardingIndexing();
                setShowOnboarding(false);
                setDesktopTab('dashboard');
              }}
            />
          </div>
        )}

        {activeTab === 'tab3_share_pro' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-xl bg-slate-50/70 border border-slate-200 flex flex-col justify-between gap-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-bold text-slate-900">무료 기본</span>
                  <span className="text-[14px] font-bold text-slate-900">0원</span>
                </div>
                <ul className="text-[12.5px] text-slate-600 space-y-2 leading-relaxed pt-1">
                  <li>• 귀신검색 (Ctrl+0): 내 기기 사진·문서·동영상 검색</li>
                  <li>• 귀신비서: PC·모바일 정리, 점검 및 복원 기록</li>
                  <li>• 사진 공유: 가족·동호회·동창회 원본 앨범 공유</li>
                </ul>
              </div>

              <button
                type="button"
                onClick={() => {
                  cancelOnboardingIndexing();
                  setShowOnboarding(false);
                }}
                className="w-full py-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[12.5px] font-medium cursor-pointer"
              >
                무료 모드로 시작
              </button>
            </div>

            <div className="p-5 rounded-xl bg-white border border-slate-300 flex flex-col justify-between gap-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-bold text-slate-900">내 기기 통합 Pro · 업무 공유</span>
                  <span className="text-[12px] text-slate-500 font-medium">
                    {isStoreAppMode ? '기기 연동' : '30일 무료체험'}
                  </span>
                </div>
                <ul className="text-[12.5px] text-slate-600 space-y-2 leading-relaxed pt-1">
                  <li>• 내 기기 통합 Pro: 스마트폰·다중 PC 통합 검색 및 실시간 클립보드 공유</li>
                  <li>• 고급 검색 도구: 사진·표 OCR 추출 및 귀신 라벨러</li>
                  <li>• 업무 공유 (S:): 팀 공용 드라이브 및 사내 문서 본문 검색</li>
                </ul>
              </div>

              <button
                type="button"
                onClick={() => {
                  cancelOnboardingIndexing();
                  setShowOnboarding(false);
                  setShowProModal(true);
                }}
                className="w-full py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12.5px] font-semibold cursor-pointer"
              >
                {isStoreAppMode ? '데스크톱 연동 안내 보기' : '요금제 자세히 보기'}
              </button>
            </div>
          </div>
        )}

        {/* 익명 통계 동의 */}
        <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
            <label className="flex items-center gap-2 text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={telemetryEnabled}
                onChange={async (e) => {
                  const next = e.target.checked;
                  setTelemetryEnabled(next);
                  try {
                    localStorage.setItem('ghosti_telemetry_enabled', String(next));
                    await fetch(getZCoreUrl('/api/superpower/telemetry'), {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ enabled: next }),
                      signal: AbortSignal.timeout(1200),
                    });
                  } catch {
                    // ignore
                  }
                }}
                className="w-4 h-4 accent-slate-900 rounded"
              />
              <span>서비스 개선을 위한 익명 오류 통계 보내기 (파일 및 텍스트 원문 미수집)</span>
            </label>

            <button
              type="button"
              onClick={() => setShowTermsClause((v) => !v)}
              className="text-slate-500 hover:text-slate-800 underline cursor-pointer"
            >
              {showTermsClause ? '상세 접기' : '상세 보기'}
            </button>
          </div>

          {showTermsClause && (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-[11.5px] text-slate-600 leading-relaxed space-y-1">
              <p>
                사용자가 입력·복사한 텍스트나 파일 내용은 수집하지 않으며, 비식별화된 기능 호출 횟수와 오류 코드만 품질 개선 목적으로 집계합니다.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
