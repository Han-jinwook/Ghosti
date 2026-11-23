import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Crown,
  Keyboard,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  Volume2,
  Zap,
} from 'lucide-react';
import { useSaySeeStore } from '../store/useSaySeeStore';
import { getZCoreUrl, LATEST_Z_CORE_VERSION, zCoreBridge } from '@shared/services/zCoreBridge';
import { isCurrentAccountSyncUnlocked } from '@shared/services/deviceIntegrationService';
import { syncEncryptedSnippetsWithCloud } from '../services/personalSnippetsService';
import { applyMergedSnippetsToLocalZCore } from '../services/teamSnippetsService';
import type { GhostKeyLang } from '../services/ghostKeyI18n';

interface GhostKeySettingsPanelProps {
  lang: GhostKeyLang;
  themeMode: 'light' | 'dark';
  onOpenZCoreModal: () => void;
  onOpenPricing: () => void;
}

interface LocalGhostKeyConfig {
  ghostkey_enabled: boolean;
  auto_typo_enabled: boolean;
  sound_enabled: boolean;
  retention_days: number;
  window_duration_ms: number;
}

const CONFIG_STORAGE_KEY = 'ghostkey_settings_v1';
const SNIPPETS_STORAGE_KEY = 'ghosti_superpower_snippets_v27';

const DEFAULT_CONFIG: LocalGhostKeyConfig = {
  ghostkey_enabled: true,
  auto_typo_enabled: true,
  sound_enabled: true,
  retention_days: 7,
  window_duration_ms: 8000,
};

const DEFAULT_SNIPPETS: Record<string, string> = {
  F1: '국민은행 123-45-678910 (예금주: 홍길동)',
  F2: '서울특별시 강남구 테헤란로 123, 4층',
  F3: 'contact@sundreamer.app',
  F4: '안녕하세요, 확인 후 빠르게 회신드리겠습니다. 감사합니다.',
  F5: '귀신Key(GhostKey) https://ghostkey.sundreamer.app',
  F6: '사업자등록번호: 123-86-98765 ((주)썬드림)',
};

const SNIPPET_KEYS = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6'] as const;

export const GhostKeySettingsPanel: React.FC<GhostKeySettingsPanelProps> = ({
  lang,
  themeMode,
  onOpenZCoreModal,
  onOpenPricing,
}) => {
  const isLight = themeMode === 'light';
  const { deviceEntitlement, merlinAuth, setLastQuarantineToast } = useSaySeeStore();

  const [isConnected, setIsConnected] = useState(zCoreBridge.isConnected);
  const [config, setConfig] = useState<LocalGhostKeyConfig>(() => {
    try {
      const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    } catch {
      /* ignore */
    }
    return DEFAULT_CONFIG;
  });
  const [snippets, setSnippets] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem(SNIPPETS_STORAGE_KEY);
      if (raw) return { ...DEFAULT_SNIPPETS, ...JSON.parse(raw) };
    } catch {
      /* ignore */
    }
    return DEFAULT_SNIPPETS;
  });
  const [syncing, setSyncing] = useState(false);
  const [savingSnippets, setSavingSnippets] = useState(false);

  useEffect(() => {
    setIsConnected(zCoreBridge.isConnected);
    const unsub = zCoreBridge.subscribe((conn) => setIsConnected(conn));
    return unsub;
  }, []);

  const fetchFromZCore = async () => {
    if (!zCoreBridge.isConnected) return;
    setSyncing(true);
    try {
      const res = await fetch(getZCoreUrl('/api/superpower/settings'), {
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.settings) {
          setConfig((prev) => {
            const next = {
              ...prev,
              ghostkey_enabled:
                typeof data.settings.ghostkey_enabled === 'boolean'
                  ? data.settings.ghostkey_enabled
                  : prev.ghostkey_enabled,
              auto_typo_enabled:
                typeof data.settings.auto_typo_enabled === 'boolean'
                  ? data.settings.auto_typo_enabled
                  : prev.auto_typo_enabled,
              sound_enabled:
                typeof data.settings.sound_enabled === 'boolean'
                  ? data.settings.sound_enabled
                  : prev.sound_enabled,
              retention_days: Number(data.settings.retention_days) || prev.retention_days,
              window_duration_ms: Number(data.settings.window_duration_ms) || prev.window_duration_ms,
            };
            localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(next));
            return next;
          });
        }
        if (data?.snippets && typeof data.snippets === 'object') {
          setSnippets((prev) => {
            const merged = { ...prev, ...data.snippets };
            localStorage.setItem(SNIPPETS_STORAGE_KEY, JSON.stringify(merged));
            return merged;
          });
        }
      }
    } catch {
      /* offline fallback */
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (isConnected) {
      void fetchFromZCore();
    }
  }, [isConnected]);

  const updateConfig = async (patch: Partial<LocalGhostKeyConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    if (zCoreBridge.isConnected) {
      try {
        const res = await fetch(getZCoreUrl('/api/superpower/settings'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
          signal: AbortSignal.timeout(2000),
        });
        if (res.ok) {
          const data = await res.json();
          setLastQuarantineToast(data?.message || '✅ Z-Core 단축키 설정이 즉시 반영되었습니다.');
          return;
        }
      } catch {
        /* ignore */
      }
    }
    setLastQuarantineToast('💾 설정이 저장되었습니다. (Z-Core 연결 시 PC에 자동 동기화)');
  };

  const handleClearClipboardHistory = async () => {
    if (!zCoreBridge.isConnected) {
      setLastQuarantineToast('⚠️ Z-Core가 연결되어 있어야 PC 클립보드 기록을 비울 수 있습니다.');
      return;
    }
    try {
      const res = await fetch(getZCoreUrl('/api/superpower/settings'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clear_history: true }),
        signal: AbortSignal.timeout(2500),
      });
      if (res.ok) {
        const data = await res.json();
        setLastQuarantineToast(data?.message || '🧹 PC 클립보드 검색 기록을 비웠습니다.');
      }
    } catch {
      setLastQuarantineToast('⚠️ Z-Core 통신 중 오류가 발생했습니다.');
    }
  };

  const handleSaveSnippets = async () => {
    setSavingSnippets(true);
    const personalOnly: Record<string, string> = {};
    for (const k of SNIPPET_KEYS) {
      personalOnly[k] = String(snippets[k] ?? '');
    }
    try {
      localStorage.setItem(SNIPPETS_STORAGE_KEY, JSON.stringify(personalOnly));
    } catch {
      /* ignore */
    }
    try {
      const zCoreSynced = await applyMergedSnippetsToLocalZCore({
        personalF1toF6: personalOnly,
      });
      if (
        merlinAuth?.email &&
        merlinAuth?.userId &&
        isCurrentAccountSyncUnlocked(merlinAuth.email)
      ) {
        void syncEncryptedSnippetsWithCloud({
          email: merlinAuth.email,
          userId: merlinAuth.userId,
          direction: 'push',
          localSnippetsOverride: personalOnly,
        });
      }
      if (zCoreSynced) {
        setLastQuarantineToast('✅ F1~F6 상용구가 PC 귀신Key에 즉시 연동되었습니다! (F7~F12 팀 상용구 보존)');
        return;
      }
      setLastQuarantineToast('💾 F1~F6 상용구가 브라우저에 저장되었습니다.');
    } finally {
      setSavingSnippets(false);
    }
  };

  const currentPlanId = deviceEntitlement?.planId || 'free_trial';
  const isProMember = Boolean(
    deviceEntitlement?.isPaidUnlimited &&
      (currentPlanId === 'personal_sub_3900' ||
        currentPlanId === 'personal_year_39000' ||
        currentPlanId === 'personal_year_35000')
  );
  const isGhostKeyPaid = Boolean(
    deviceEntitlement?.ghostkeyPaidActive ||
      (deviceEntitlement?.isPaidUnlimited &&
        (currentPlanId === 'ghostkey_sub_1900' || currentPlanId === 'ghostkey_year_19000'))
  );
  const activeTrialDaysLeft =
    deviceEntitlement?.ghostkeyTrialDaysLeft || deviceEntitlement?.trialDaysLeft || 0;
  const isTrialActive = Boolean(
    (deviceEntitlement?.ghostkeyTrialActive && (deviceEntitlement?.ghostkeyTrialDaysLeft || 0) > 0) ||
      (deviceEntitlement?.trialActive && deviceEntitlement.trialDaysLeft > 0)
  );

  const cardCls = `rounded-3xl border p-5 sm:p-6 ${
    isLight ? 'bg-white border-slate-200' : 'bg-zinc-900/75 border-white/10'
  }`;

  return (
    <div className="space-y-6 pb-12">
      {/* 1. 상단 상태 요약: Z-Core 연결 + 구독/Pro 권한 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={cardCls}>
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-base font-black flex items-center gap-2">
              <Zap className="w-4 h-4 text-teal-500" />
              <span>
                {lang === 'en'
                  ? 'PC Connection Status'
                  : lang === 'ja'
                  ? 'PC接続状態'
                  : '내 컴퓨터 연결 상태'}
              </span>
            </h2>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                isConnected
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300'
              }`}
            >
              {isConnected ? `연결됨 (v${zCoreBridge.version || LATEST_Z_CORE_VERSION})` : '미연결'}
            </span>
          </div>
          <p className="text-xs sm:text-[13px] text-slate-600 dark:text-zinc-400 leading-relaxed">
            {isConnected
              ? '윈도우 앱(엑셀·메신저·한글 등)에서 Ctrl+0 단축키를 바로 사용할 수 있습니다.'
              : '윈도우 앱(엑셀·메신저·한글 등)에서 단축키를 사용하려면 내 컴퓨터를 연결해 주세요.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onOpenZCoreModal}
              className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs cursor-pointer"
            >
              {isConnected ? '연결 상태 보기' : '내 컴퓨터 연결하기'}
            </button>
            {isConnected && (
              <button
                type="button"
                disabled={syncing}
                onClick={() => void fetchFromZCore()}
                className="px-3 py-2 rounded-xl border border-slate-300 dark:border-white/15 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                <span>PC 설정 불러오기</span>
              </button>
            )}
          </div>
          {isConnected && (
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 text-[11.5px] text-slate-500">
              <span>같은 연결로 귀신같이 [파일 안 열고 1초 본문·장면 소환]도 무료 이용</span>
              <a
                href="https://ghosti.sundreamer.app/?from=ghostkey"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-teal-700 hover:underline shrink-0 no-underline"
              >
                열기 ↗
              </a>
            </div>
          )}
        </div>

        <div className={cardCls}>
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-base font-black flex items-center gap-2">
              <Crown className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>
                {lang === 'en'
                  ? 'Subscription Status'
                  : lang === 'ja'
                  ? 'ご利用状況'
                  : '이용권 상태'}
              </span>
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-teal-500/15 text-teal-600 dark:text-teal-300 text-xs font-bold">
              {isProMember
                ? 'Pro 연동 활성'
                : isGhostKeyPaid
                ? '귀신Key 이용 중'
                : isTrialActive
                ? `무료체험 D-${activeTrialDaysLeft}`
                : '체험 대기'}
            </span>
          </div>
          <p className="text-xs sm:text-[13px] text-slate-600 dark:text-zinc-400 leading-relaxed">
            {merlinAuth?.email
              ? `계정 ${merlinAuth.email}의 귀신Key 및 귀신같이 Pro 이용 상태가 동기화됩니다.`
              : '로그인하면 계정별 이용 상태와 설정이 동기화됩니다.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {!merlinAuth?.email && (
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('openLoginModal'))}
                className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-zinc-950 font-bold text-xs cursor-pointer"
              >
                로그인
              </button>
            )}
            <button
              type="button"
              onClick={onOpenPricing}
              className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/5 font-bold text-xs cursor-pointer"
            >
              이용권 관리
            </button>
          </div>
        </div>
      </div>

      {/* 2. 단축키(Ctrl+0 / Ctrl+우클릭) 및 동작 설정 */}
      <section className={cardCls}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-base sm:text-lg font-black flex items-center gap-2">
              <Keyboard className="w-5 h-5 text-teal-500" />
              <span>
                {lang === 'en'
                  ? 'Hotkey (Ctrl+0 / Ctrl+Right-Click) Settings'
                  : lang === 'ja'
                  ? 'ショートカット (Ctrl+0 / Ctrl+右クリック) 設定'
                  : '단축키 (Ctrl+0 / Ctrl+우클릭) 동작 설정'}
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              입력창에서 Ctrl+0 또는 Ctrl+우클릭으로 즉시 호출됩니다.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 text-xs font-extrabold">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-500" />
            <span>평소 Ctrl+C/V 원문 100% 보존</span>
          </span>
        </div>

        <div className="divide-y divide-slate-200/70 dark:divide-white/10">
          <label className="py-3.5 flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <div className="text-sm font-extrabold">
                귀신Key 단축키 소환 (Ctrl+0 / Ctrl+우클릭)
              </div>
              <div className="text-xs text-slate-500 dark:text-zinc-400">
                입력창 커서 위치에서 귀신Key를 호출합니다.
              </div>
            </div>
            <input
              type="checkbox"
              checked={config.ghostkey_enabled}
              onChange={(e) => void updateConfig({ ghostkey_enabled: e.target.checked })}
              className="w-5 h-5 accent-teal-500 cursor-pointer shrink-0"
            />
          </label>

          <label className="py-3.5 flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <div className="text-sm font-extrabold">
                무버튼 자동 성형 (한영 오타 / CapsLock / 전각↔반각)
              </div>
              <div className="text-xs text-slate-500 dark:text-zinc-400">
                영타 실수나 대소문자 역전 시 스페이스바 입력만으로 0.1초 자동 교정합니다.
              </div>
            </div>
            <input
              type="checkbox"
              checked={config.auto_typo_enabled}
              onChange={(e) => void updateConfig({ auto_typo_enabled: e.target.checked })}
              className="w-5 h-5 accent-teal-500 cursor-pointer shrink-0"
            />
          </label>

          <label className="py-3.5 flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <div className="text-sm font-extrabold flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-teal-500" />
                <span>애기귀신 변환 효과음 (띠리링~)</span>
              </div>
              <div className="text-xs text-slate-500 dark:text-zinc-400">
                조용한 사무실에서는 꺼두실 수 있습니다.
              </div>
            </div>
            <input
              type="checkbox"
              checked={config.sound_enabled}
              onChange={(e) => void updateConfig({ sound_enabled: e.target.checked })}
              className="w-5 h-5 accent-teal-500 cursor-pointer shrink-0"
            />
          </label>

          <div className="py-3.5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-extrabold">로컬 클립보드 검색 (7일 보관)</div>
              <div className="text-xs text-slate-500 dark:text-zinc-400">
                외부 서버 전송 없이 내 PC 안에서만 7일간 자동 보관됩니다.
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleClearClipboardHistory()}
              className="px-3 py-1.5 rounded-xl border border-rose-400/50 text-rose-600 dark:text-rose-300 hover:bg-rose-500/10 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>기록 비우기</span>
            </button>
          </div>
        </div>
      </section>

      {/* 3. F1~F6 내 개인 상용구 편집기 */}
      <section className={cardCls}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-base sm:text-lg font-black">
              F1~F6 내 개인 상용구 설정 (Ctrl+0 ➔ F키 즉시 입력)
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              계좌번호·배송지·사업자번호·단골 인사말을 저장해 두면 재시작 없이 PC 귀신Key에 바로 반영됩니다.
            </p>
          </div>
          <button
            type="button"
            disabled={savingSnippets}
            onClick={() => void handleSaveSnippets()}
            className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-zinc-950 font-black text-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            {savingSnippets ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>상용구 PC 저장</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {SNIPPET_KEYS.map((key) => (
            <div key={key} className="flex items-center gap-2">
              <span className="w-11 py-2 rounded-xl bg-teal-500/15 border border-teal-500/35 text-teal-700 dark:text-teal-300 text-xs font-black text-center shrink-0">
                {key}
              </span>
              <input
                type="text"
                value={snippets[key] || ''}
                onChange={(e) =>
                  setSnippets((prev) => ({
                    ...prev,
                    [key]: e.target.value,
                  }))
                }
                maxLength={300}
                className={`flex-1 px-3 py-2 rounded-xl border text-xs sm:text-[13px] outline-none focus:border-teal-500 ${
                  isLight
                    ? 'bg-slate-50 border-slate-200 text-slate-900'
                    : 'bg-zinc-950 border-white/10 text-zinc-100'
                }`}
              />
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-end gap-2 text-xs text-slate-500 dark:text-zinc-400">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          <span>저장 즉시 로컬 PC Z-Core (`127.0.0.1:5199`)와 동기화됩니다.</span>
        </div>
      </section>

      {/* 4. 상위 확장 안내 (폰↔PC 동기화 Pro / 팀 공유 상용구 업무공유) */}
      <section className={cardCls}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-[13px]">
          <div className="space-y-1">
            <div className="font-black">
              폰↔PC 클립보드 · 상용구 동기화 또는 직원 전원 팀 상용구(F7~F12)가 필요하신가요?
            </div>
            <p className="text-slate-600 dark:text-zinc-400">
              • <strong>내 기기 통합 Pro (월 3,900원)</strong>: 폰↔PC 양방향 클립보드(7일) + 개인 상용구(F1~F6) 내 모든 PC 동기화 (귀신Key 무상 포함)<br />
              • <strong>업무 공유 (월 9,900원~)</strong>: 대표 1인 결제 시 직원 전원 팀 공유 상용구(F7~F12) · S: 드라이브 무료
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenPricing}
              className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black text-xs cursor-pointer"
            >
              Pro 3,900원 보기
            </button>
            <a
              href="https://ghosti.sundreamer.app/?from=b2b"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-white/15 font-bold text-xs hover:bg-black/5 dark:hover:bg-white/5 no-underline"
            >
              업무공유 보기 ➔
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};
