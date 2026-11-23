import React, { useEffect, useRef, useState } from 'react';
import { Download, ExternalLink } from 'lucide-react';
import {
  GHOSTKEY_COPY,
  formatGhostKeyDemoPreview,
  type GhostKeyLang,
} from '../services/ghostKeyI18n';
import { playBabyGhostChime } from '../services/superpowerService';
import {
  activateDevicePlanPersistent,
  syncEntitlementToLocalPcEngine,
} from '@shared/services/deviceIntegrationService';
import { useSaySeeStore } from '../store/useSaySeeStore';
import { zCoreBridge } from '@shared/services/zCoreBridge';
import GhostSuperpowerDojo from './ghostDojo/GhostSuperpowerDojo';

interface GhostKeyOnboardingViewProps {
  lang: GhostKeyLang;
  themeMode: 'light' | 'dark';
  onOpenZCoreModal: () => void;
  onGoSettings: () => void;
}

export const GhostKeyOnboardingView: React.FC<GhostKeyOnboardingViewProps> = ({
  lang,
  themeMode,
  onOpenZCoreModal,
  onGoSettings,
}) => {
  const copy = GHOSTKEY_COPY[lang];
  const isLight = themeMode === 'light';
  const { deviceEntitlement, merlinAuth, setDeviceIntegrationSnapshot, setLastQuarantineToast } =
    useSaySeeStore();

  const [isZCoreConnected, setIsZCoreConnected] = useState(zCoreBridge.isConnected);
  const [startingTrial, setStartingTrial] = useState(false);

  // 기존 GhostiShowroomLanding.tsx 구축 체험판 상태 (100% 그대로 보존)
  const [sampleIdx, setSampleIdx] = useState(0);
  const [typoOriginalBackup, setTypoOriginalBackup] = useState(copy.samples[0].raw);
  const [typoInput, setTypoInput] = useState(copy.samples[0].raw);
  const [typoConverted, setTypoConverted] = useState(false);
  const [typoIsPresetSample, setTypoIsPresetSample] = useState(true);
  const [selectedToolbarKey, setSelectedToolbarKey] = useState<'auto' | 'seq' | '1' | 'snip' | 'ocr'>('auto');
  const typoDemoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setIsZCoreConnected(zCoreBridge.isConnected);
    return zCoreBridge.subscribe((conn) => setIsZCoreConnected(conn));
  }, []);

  // 진입 또는 언어 전환 시 450ms 뒤 자동 변환 Show & Try 시연 (기존 체험판 UX 100% 보존)
  useEffect(() => {
    const defaultRaw = copy.samples[0].raw;
    setSampleIdx(0);
    setTypoOriginalBackup(defaultRaw);
    setTypoInput(defaultRaw);
    setTypoConverted(false);
    setTypoIsPresetSample(true);
    if (typoDemoTimerRef.current) clearTimeout(typoDemoTimerRef.current);
    const timer = setTimeout(() => {
      setTypoInput(formatGhostKeyDemoPreview(lang, defaultRaw));
      setTypoConverted(true);
    }, 450);
    typoDemoTimerRef.current = timer;
    return () => clearTimeout(timer);
  }, [lang, copy.samples]);

  const triggerAutoIron = (rawText: string, sIdx: number) => {
    if (typoDemoTimerRef.current) clearTimeout(typoDemoTimerRef.current);
    playBabyGhostChime('typo');
    setSampleIdx(sIdx);
    setTypoOriginalBackup(rawText);
    setTypoInput(rawText);
    setTypoConverted(false);
    setTypoIsPresetSample(true);
    typoDemoTimerRef.current = setTimeout(() => {
      setTypoInput(formatGhostKeyDemoPreview(lang, rawText));
      setTypoConverted(true);
    }, 450);
  };

  const handleTextareaFocus = () => {
    if (typoIsPresetSample) {
      if (typoDemoTimerRef.current) {
        clearTimeout(typoDemoTimerRef.current);
        typoDemoTimerRef.current = null;
      }
      setTypoInput('');
      setTypoConverted(false);
      setTypoIsPresetSample(false);
    }
  };

  const handleInputChange = (val: string) => {
    if (typoDemoTimerRef.current) {
      clearTimeout(typoDemoTimerRef.current);
      typoDemoTimerRef.current = null;
    }
    setTypoIsPresetSample(false);

    const trimmed = val.trim();
    const hasProtectedToken =
      /@|:\/\/|www\.|\.(com|kr|net|org|app|io)\b|[A-Za-z]{2,}\d{3,}/i.test(trimmed);

    if (!hasProtectedToken && (val.endsWith(' ') || val.endsWith('\n')) && !typoInput.endsWith(' ')) {
      const converted = `${formatGhostKeyDemoPreview(lang, val)} `;
      if (converted.trim() !== val.trim()) {
        playBabyGhostChime('typo');
        setTypoOriginalBackup(val);
        setTypoInput(converted);
        setTypoConverted(true);
        return;
      }
    }
    setTypoInput(val);
    setTypoConverted(false);
  };

  const handleUndo = () => {
    if (typoDemoTimerRef.current) {
      clearTimeout(typoDemoTimerRef.current);
      typoDemoTimerRef.current = null;
    }
    setTypoInput(typoOriginalBackup);
    setTypoConverted(false);
  };

  const isProMember = Boolean(
    deviceEntitlement?.isPaidUnlimited &&
      (deviceEntitlement.planId === 'personal_sub_3900' ||
        deviceEntitlement.planId === 'personal_year_39000' ||
        deviceEntitlement.planId === 'personal_year_35000')
  );
  const isGhostKeyPaid = Boolean(
    deviceEntitlement?.ghostkeyPaidActive ||
      (deviceEntitlement?.isPaidUnlimited &&
        (deviceEntitlement.planId === 'ghostkey_sub_1900' ||
          deviceEntitlement.planId === 'ghostkey_year_19000'))
  );
  const activeTrialDaysLeft =
    deviceEntitlement?.ghostkeyTrialDaysLeft || deviceEntitlement?.trialDaysLeft || 0;
  const isTrialActive = Boolean(
    (deviceEntitlement?.ghostkeyTrialActive && (deviceEntitlement?.ghostkeyTrialDaysLeft || 0) > 0) ||
      (deviceEntitlement?.trialActive && deviceEntitlement.trialDaysLeft > 0)
  );
  const isAuthed = Boolean(merlinAuth?.email && merlinAuth.userId !== 'guest');

  const handleStartTrialClick = async () => {
    if (!isAuthed) {
      window.dispatchEvent(new CustomEvent('openLoginModal'));
      return;
    }
    if (isProMember || isGhostKeyPaid) {
      onGoSettings();
      return;
    }
    setStartingTrial(true);
    try {
      const res = await activateDevicePlanPersistent('ghostkey_trial_opt_in_30d');
      if (res.ok && res.entitlement) {
        setDeviceIntegrationSnapshot({ entitlement: res.entitlement });
        void syncEntitlementToLocalPcEngine(res.entitlement, merlinAuth?.email || undefined);
        setLastQuarantineToast('🎁 귀신Key 30일 무카드 무료체험이 시작되었습니다!');
        if (!isZCoreConnected) {
          onOpenZCoreModal();
        }
      } else {
        setLastQuarantineToast(
          res.message || '이미 귀신Key 30일 무료체험을 사용하셨거나 일시 오류가 발생했습니다.'
        );
      }
    } finally {
      setStartingTrial(false);
    }
  };

  const activeToolbarIdx = Math.max(
    0,
    copy.toolbarItems.findIndex((item) => item.key === selectedToolbarKey)
  );
  const activeToolbar = copy.toolbarItems[activeToolbarIdx] || copy.toolbarItems[0];
  const totalFeatureCount = copy.toolbarItems.length;

  const shortcutMetaByKey: Record<
    'auto' | 'seq' | '1' | 'snip' | 'ocr',
    { mode: 'auto' | 'seq' | 'summon'; keys: string[]; label: string }
  > = {
    auto: { mode: 'auto', keys: [], label: '무버튼 자동' },
    seq: { mode: 'summon', keys: ['Ctrl+V'], label: '귀신Key 호출 +' },
    '1': { mode: 'summon', keys: ['1'], label: '귀신Key 호출 +' },
    snip: { mode: 'summon', keys: ['F1~F6'], label: '귀신Key 호출 +' },
    ocr: { mode: 'summon', keys: ['검색'], label: '귀신Key 호출 +' },
  };

  const renderMiniShortcutHint = (keyType: 'auto' | 'seq' | '1' | 'snip' | 'ocr') => {
    const meta = shortcutMetaByKey[keyType];
    if (meta.mode === 'auto') {
      return (
        <span className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-300 text-emerald-800 text-[10px] font-black">
          무버튼 자동
        </span>
      );
    }
    return (
      <div className="inline-flex items-center gap-1 text-[10.5px] font-bold text-slate-500">
        {meta.mode === 'summon' && (
          <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300/80 text-slate-700 font-extrabold">
            Ctrl+0
          </span>
        )}
        {meta.mode === 'summon' && <span className="text-slate-400">→</span>}
        {meta.keys.map((k, i) => (
          <React.Fragment key={k}>
            {i > 0 && <span className="text-slate-400">→</span>}
            <kbd className="px-1.5 py-0.5 rounded bg-teal-50 border border-teal-300 text-teal-800 font-mono text-[10px] font-black shadow-[0_1px_0_rgba(13,148,136,0.25)]">
              {k}
            </kbd>
          </React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-10 pb-14">
      {/* 1. 열린 에디토리얼 히어로 + 우측 실제 Ctrl+0 귀신Key 호출 UI 프리뷰 */}
      <section className="pt-1 pb-7 border-b border-slate-300/80">
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6 items-center">
          <div>
            <div className="inline-flex flex-wrap items-center gap-2.5 px-3 py-1.5 rounded-xl bg-white/95 border border-slate-300/80 shadow-xs mb-4">
              <span className="text-xs font-extrabold text-slate-700 tracking-tight">
                {lang === 'en'
                  ? 'Summon GhostKey'
                  : lang === 'ja'
                  ? 'GhostKey 呼び出しショートカット'
                  : '귀신Key 호출 단축키'}
              </span>
              <span className="h-3.5 w-px bg-slate-300" />
              <img
                src="/ghostkey_shortcut_badge.png"
                alt={copy.heroBadge}
                className="h-7 sm:h-8 w-auto object-contain select-none"
              />
            </div>

            <h1 className="text-[26px] sm:text-[34px] font-black tracking-tight leading-[1.22] text-slate-950 break-keep">
              {copy.heroTitleLine1}{' '}
              <span className="text-teal-700">{copy.heroTitleHighlight}</span>
            </h1>
            <p className="mt-3 text-sm sm:text-[15.5px] text-slate-600 max-w-2xl leading-relaxed break-keep">
              {copy.heroSub}
            </p>

            {(isProMember || isGhostKeyPaid || isTrialActive) && (
              <div className="mt-4 inline-flex items-center px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold">
                {isProMember
                  ? '귀신같이 Pro 구독 연동 중 — 귀신Key 전 기능이 활성화되어 있습니다.'
                  : isGhostKeyPaid
                  ? '귀신Key 이용권 활성 중 — 상용구 설정에서 바로 관리할 수 있습니다.'
                  : `30일 무료체험 진행 중 (남은 기간: ${activeTrialDaysLeft || 30}일)`}
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={startingTrial}
                onClick={() => void handleStartTrialClick()}
                className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-sm cursor-pointer transition disabled:opacity-60"
              >
                {startingTrial
                  ? '...'
                  : isProMember || isGhostKeyPaid
                  ? '상용구 설정 열기'
                  : copy.ctaTryTrial}
              </button>

              <button
                type="button"
                onClick={onOpenZCoreModal}
                className={`px-4 py-2.5 rounded-xl border font-bold text-sm flex items-center gap-2 shadow-xs cursor-pointer transition ${
                  isZCoreConnected
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                    : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-800'
                }`}
              >
                <Download className="w-4 h-4" />
                <span>{isZCoreConnected ? '내 PC 연결됨' : copy.ctaInstallZCore}</span>
              </button>
            </div>
          </div>

          {/* 우측: 단축키로 호출 시 커서 위에 뜨는 귀신Key 실제 UI 미니 프리뷰 */}
          <div className="rounded-2xl border border-slate-300 bg-white shadow-[0_10px_30px_-10px_rgba(15,23,42,0.14)] overflow-hidden">
            <div className="px-3.5 py-2.5 bg-slate-900 text-white flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <img
                  src="/ghostkey_app_icon_512.png"
                  alt=""
                  className="w-4 h-4 rounded-sm object-contain"
                />
                <span className="text-xs font-black tracking-tight">귀신Key 소환 창</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-400/30">
                Ctrl+0 · 커서 위 0.1초
              </span>
            </div>

            <div className="p-3 space-y-1.5 bg-slate-50/70">
              {[
                { num: '1', name: '서식 · 줄바꿈 정리', badge: '기본', active: activeToolbar.key === '1' },
                { num: '2', name: '스샷 · 300DPI PDF 변환', badge: '문서', active: false },
                { num: '3', name: '다중 복사 1초 합본', badge: '편집', active: false },
                { num: '4', name: '번호 · 일정 하이픈 정리', badge: '서식', active: false },
                { num: '5', name: '현재 창 최상단 고정', badge: '창고정', active: false },
              ].map((row) => (
                <div
                  key={row.num}
                  className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-between gap-2 text-xs transition ${
                    row.active
                      ? 'bg-teal-50 border-teal-500 text-teal-950 font-bold'
                      : 'bg-white border-slate-200/90 text-slate-700 font-semibold'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <kbd className="w-5 h-5 rounded bg-slate-900 text-white font-mono text-[11px] font-black flex items-center justify-center shrink-0">
                      {row.num}
                    </kbd>
                    <span className="truncate">{row.name}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-bold shrink-0">{row.badge}</span>
                </div>
              ))}
            </div>

            <div className="px-3 py-2 border-t border-slate-200 bg-white flex items-center justify-between gap-2 text-[11px] text-slate-600">
              <span className="font-bold flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 font-mono text-[10px] font-black text-slate-800">
                  F1~F6
                </kbd>
                <span>상용구</span>
              </span>
              <span className="text-slate-400">|</span>
              <span className="font-bold text-teal-700">클립보드 7일 검색</span>
            </div>
          </div>
        </div>

        {/* 귀신Key (내 PC) 전체 9가지 핵심 기능 + 내 기기 통합(Pro) / 업무 공유(팀) 소속 분리 */}
        <div className="mt-7 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black tracking-tight text-slate-700">
              {lang === 'en'
                ? 'GhostKey (My PC) — 9 Core Features'
                : lang === 'ja'
                ? 'GhostKey (PC単体) — 9つの主要機能'
                : '귀신Key (내 PC) — 핵심 기능 9가지'}
            </span>
            <span className="text-xs font-bold text-teal-700">1/9 ~ 9/9</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              { num: '1/9', title: '한영 오타 자동 교정', keys: [], autoLabel: '무버튼 자동', summon: false, toolbarKey: 'auto' as const },
              { num: '2/9', title: '순차 붙여넣기', keys: ['Ctrl+V'], autoLabel: '', summon: true, toolbarKey: 'seq' as const },
              { num: '3/9', title: '줄바꿈 · 서식 정리', keys: ['1'], autoLabel: '', summon: true, toolbarKey: '1' as const },
              { num: '4/9', title: '스샷 · 300DPI PDF 변환', keys: ['2'], autoLabel: '', summon: true, toolbarKey: '1' as const },
              { num: '5/9', title: '다중 복사 1초 합본', keys: ['3'], autoLabel: '', summon: true, toolbarKey: 'seq' as const },
              { num: '6/9', title: '번호 · 일정 하이픈 성형', keys: ['4'], autoLabel: '', summon: true, toolbarKey: '1' as const },
              { num: '7/9', title: '현재 창 최상단 고정', keys: ['5'], autoLabel: '', summon: true, toolbarKey: '1' as const },
              { num: '8/9', title: 'F1~F6 내 개인 상용구', keys: ['F1~F6'], autoLabel: '', summon: true, toolbarKey: 'snip' as const },
              { num: '9/9', title: '로컬 7일 클립보드 검색', keys: ['검색'], autoLabel: '', summon: true, toolbarKey: 'ocr' as const },
            ].map((feat) => (
              <button
                key={feat.num}
                type="button"
                onClick={() => setSelectedToolbarKey(feat.toolbarKey)}
                className="text-left px-3 py-2.5 rounded-xl border border-slate-300/85 bg-white/90 hover:bg-white hover:border-teal-600 transition-all cursor-pointer shadow-2xs"
              >
                <div className="flex items-center justify-between gap-1.5 mb-1">
                  <span className="text-[10.5px] font-black px-1.5 py-0.5 rounded bg-slate-200/85 text-slate-800">
                    {feat.num}
                  </span>
                  {feat.autoLabel ? (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-300 text-emerald-800 text-[10px] font-black">
                      {feat.autoLabel}
                    </span>
                  ) : (
                    <div className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500">
                      {feat.summon && (
                        <>
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300/80 text-slate-700 font-extrabold">
                            Ctrl+0
                          </span>
                          <span className="text-slate-400">→</span>
                        </>
                      )}
                      {feat.keys.map((k, ki) => (
                        <React.Fragment key={k}>
                          {ki > 0 && <span className="text-slate-400">→</span>}
                          <kbd className="px-1.5 py-0.5 rounded bg-teal-50 border border-teal-300 text-teal-800 font-mono text-[10px] font-black">
                            {k}
                          </kbd>
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-[13px] font-extrabold text-slate-900 leading-snug break-keep">
                  {feat.title}
                </div>
              </button>
            ))}
          </div>

          {/* 확장 기능 소속 구분 (가격표 · 타 앱 기능 제외, 순수 귀신Key 관련 확장 기능만) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <div className="px-3.5 py-2.5 rounded-xl border border-amber-300/90 bg-amber-50/70 flex flex-col gap-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black text-amber-900">
                  내 기기 통합 (Pro 확장)
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-200/80 text-amber-950">
                  귀신Key 포함
                </span>
              </div>
              <ul className="space-y-1 text-[11.5px] font-semibold text-amber-900/85 break-keep list-none pl-0 mt-0.5">
                <li>
                  • <strong>연속복사 · 7일 클립보드 폰↔PC 확장</strong>
                  <span className="block text-[10.5px] font-medium text-amber-800/80 pl-2.5">
                    (※ 아이폰은 iOS OS 제한으로 연속 복사 미지원 · 1건 복사 전송 및 7일 꺼내쓰기 지원)
                  </span>
                </li>
                <li>
                  • <strong>F1~F6 개인 상용구 내 모든 PC 동기화</strong> (집 PC · 회사 PC · 노트북)
                </li>
              </ul>
            </div>
            <div className="px-3.5 py-2.5 rounded-xl border border-slate-300/90 bg-slate-100/80 flex flex-col gap-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black text-slate-900">
                  업무 공유 (팀 확장)
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-800">
                  팀 공유
                </span>
              </div>
              <span className="text-[11.5px] font-semibold text-slate-600 break-keep">
                F7~F12 팀 공유 상용구 일괄 배포 · 실시간 동기화
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. STEP 01 · 실시간 인터랙티브 체험 */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white text-[11px] font-black tracking-wide">
              STEP 01
            </span>
            <h2 className="text-lg sm:text-xl font-black tracking-tight text-slate-950">
              {copy.demoHeader}
            </h2>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap shrink-0 border bg-teal-50 border-teal-300 text-teal-800">
            {copy.demoLiveBadge}
          </span>
        </div>

        <div className="rounded-2xl border border-slate-300/90 bg-white p-5 sm:p-6 space-y-5 shadow-[0_4px_20px_-6px_rgba(15,23,42,0.08)]">

        <div className="flex flex-wrap gap-2">
          {copy.samples.map((sample, sIdx) => {
            const isSelectedSample = sampleIdx === sIdx && typoIsPresetSample;
            return (
              <button
                key={sIdx}
                type="button"
                onClick={() => triggerAutoIron(sample.raw, sIdx)}
                className={`px-3 py-1.5 rounded-xl text-[13px] font-bold border transition-all cursor-pointer ${
                  isSelectedSample
                    ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                    : isLight
                    ? 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-white/15'
                }`}
              >
                {sample.label}
              </button>
            );
          })}
        </div>

        {/* Before -> After 비교 배너 */}
        <div
          className={`grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl p-4 sm:p-5 text-[13px] ${
            isLight ? 'bg-slate-50 border border-slate-200/80' : 'bg-zinc-900/70'
          }`}
        >
          <div
            className={`rounded-2xl p-5 space-y-2.5 relative overflow-hidden border ${
              isLight
                ? 'bg-rose-50/70 border-rose-200/80'
                : 'bg-rose-950/30 border-rose-500/20'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={`text-sm sm:text-base font-extrabold ${
                  isLight ? 'text-rose-800' : 'text-rose-300'
                }`}
              >
                {copy.beforeLabel}
              </span>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  isLight ? 'bg-rose-100 text-rose-700' : 'bg-rose-500/20 text-rose-300'
                }`}
              >
                {copy.beforeBadge}
              </span>
            </div>
            <p
              className={`font-sans font-semibold whitespace-pre-line leading-relaxed break-keep text-sm ${
                isLight ? 'text-slate-800' : 'text-zinc-200'
              }`}
            >
              {typoOriginalBackup || copy.samples[sampleIdx]?.raw}
            </p>
          </div>

          <div
            className={`rounded-2xl p-5 space-y-2.5 relative overflow-hidden border ${
              isLight
                ? 'bg-emerald-50/75 border-emerald-200/80'
                : 'bg-emerald-950/30 border-emerald-500/25'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={`text-sm sm:text-base font-extrabold ${
                  isLight ? 'text-emerald-800' : 'text-[#00F0B5]'
                }`}
              >
                {copy.afterLabel}
              </span>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  isLight ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-500/20 text-[#00F0B5]'
                }`}
              >
                {copy.afterBadge}
              </span>
            </div>
            <p
              className={`font-sans font-semibold whitespace-pre-line leading-relaxed break-keep text-sm ${
                isLight ? 'text-emerald-950' : 'text-emerald-100'
              }`}
            >
              {formatGhostKeyDemoPreview(lang, typoOriginalBackup || copy.samples[sampleIdx]?.raw || '')}
            </p>
          </div>
        </div>

        {/* 직접 입력 테스트 칸 */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1 text-[13px] gap-2">
            <span className={`font-bold ${isLight ? 'text-slate-700' : 'text-amber-300'}`}>
              {typoIsPresetSample ? copy.inputHintPreset : copy.inputHintTyping}
            </span>
            {!typoIsPresetSample && typoInput && (
              <button
                type="button"
                onClick={() => {
                  setTypoInput('');
                  setTypoConverted(false);
                }}
                className={`underline font-bold cursor-pointer shrink-0 ${
                  isLight ? 'text-slate-500 hover:text-slate-800' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {copy.clearBtn}
              </button>
            )}
          </div>
          <textarea
            value={typoInput}
            onFocus={handleTextareaFocus}
            onChange={(e) => handleInputChange(e.target.value)}
            rows={2}
            placeholder={copy.inputPlaceholder}
            className={`w-full rounded-2xl p-4 text-sm sm:text-[15px] font-sans font-bold leading-relaxed transition-all outline-none border ${
              isLight
                ? typoConverted
                  ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                  : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-teal-500'
                : typoConverted
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-100'
                : 'bg-zinc-900 border-white/15 text-white placeholder-zinc-400 focus:border-teal-400'
            }`}
          />
        </div>

        {/* 안전 가드 배너 */}
        <div
          className={`rounded-2xl px-4 py-3 text-[13px] font-semibold leading-relaxed break-keep border ${
            isLight
              ? 'bg-teal-50/70 border-teal-200/80 text-teal-900'
              : 'bg-teal-950/30 border-teal-500/25 text-zinc-100'
          }`}
        >
          {copy.guardBanner}
        </div>

        {/* 5대 기능 인터랙티브 툴바 */}
        <div
          className={`rounded-2xl border p-4 sm:p-5 space-y-3.5 ${
            isLight ? 'bg-slate-50/70 border-slate-200' : 'bg-zinc-900/95 border-white/15'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5" role="tablist">
              {copy.toolbarItems.map((item) => {
                const isSelected = selectedToolbarKey === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => {
                      playBabyGhostChime('typo');
                      setSelectedToolbarKey(item.key);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[13px] font-bold transition-all cursor-pointer border whitespace-nowrap ${
                      isSelected
                        ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                        : isLight
                        ? 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                        : 'bg-zinc-950 hover:bg-zinc-800 border-white/15 text-zinc-200'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              {typoConverted && (
                <span className={`text-[13px] font-bold ${isLight ? 'text-teal-700' : 'text-[#00F0B5]'}`}>
                  {copy.convertedToast}
                </span>
              )}
              <button
                type="button"
                onClick={handleUndo}
                className={`px-2.5 py-1 rounded-lg border text-xs font-bold cursor-pointer whitespace-nowrap ${
                  isLight
                    ? 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                    : 'bg-zinc-800 hover:bg-zinc-700 border-white/15 text-zinc-300'
                }`}
              >
                {copy.undoBtn}
              </button>
            </div>
          </div>

          <div
            className={`rounded-xl border p-4 sm:p-5 space-y-2.5 font-sans ${
              isLight ? 'bg-white border-slate-200' : 'bg-zinc-950/95 border-amber-400/35'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <span className="text-[11px] font-black text-teal-700">
                기능 {activeToolbarIdx + 1}/{totalFeatureCount} 사용법
              </span>
              {renderMiniShortcutHint(activeToolbar.key)}
            </div>
            <div className={`text-[13.5px] sm:text-sm font-black break-keep ${isLight ? 'text-slate-900' : 'text-amber-300'}`}>
              {activeToolbar.title}
            </div>
            <p className={`text-[13px] leading-relaxed font-medium break-keep ${isLight ? 'text-slate-600' : 'text-zinc-300'}`}>
              {activeToolbar.desc}
            </p>
            <div
              className={`rounded-lg border px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-[13px] ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-zinc-900/90 border-white/10'
              }`}
            >
              <span className={`font-semibold break-keep ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                {activeToolbar.before}
              </span>
              <div className="flex items-center gap-1.5 font-bold text-[13px] shrink-0">
                <span className={isLight ? 'text-slate-400' : 'text-amber-400'}>➔</span>
                <span className={isLight ? 'text-teal-700 font-extrabold' : 'text-[#00F0B5] font-extrabold'}>
                  {activeToolbar.after}
                </span>
              </div>
            </div>
          </div>
        </div>
        </div>
      </section>

      {/* 3. STEP 02 · 주요 기능 직접 테스트해 보기 (도장깨기) */}
      <section className="space-y-3">
        <div className="flex items-center gap-2.5">
          <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white text-[11px] font-black tracking-wide">
            STEP 02
          </span>
          <div>
            <h2 className="text-lg sm:text-xl font-black tracking-tight text-slate-950">
              {copy.dojoSectionTitle}
            </h2>
          </div>
        </div>
        <p className="text-xs sm:text-sm text-slate-600">{copy.dojoSectionSub}</p>
        <GhostSuperpowerDojo variant="full" />
      </section>

      {/* 4. 본체 『귀신같이(Ghosti)』 안내 */}
      <section className="rounded-2xl border border-slate-300/90 bg-[#F1EFE7] p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-sm sm:text-base font-black text-slate-950">{copy.nudgeTitle}</h3>
          <p className="text-xs sm:text-[13px] text-slate-600 leading-relaxed break-keep">
            {copy.nudgeDesc}
          </p>
        </div>
        <a
          href="https://ghosti.sundreamer.app/?from=ghostkey"
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2.5 rounded-xl bg-slate-900 text-white font-black text-xs sm:text-[13px] inline-flex items-center gap-1.5 shrink-0 hover:bg-slate-800 transition no-underline"
        >
          <span>{copy.nudgeBtn}</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </section>
    </div>
  );
};
