import React, { useEffect, useState } from 'react';
import {
  getPreferredVoiceGender,
  setPreferredVoiceGender,
  getPreferredVoiceEnabled,
  setPreferredVoiceEnabled,
  getIsTtsSpeaking,
  getLastSpokenTtsText,
  isVoiceActorPreviewGreeting,
  VOICE_PREVIEW_PHRASE_FEMALE,
  VOICE_PREVIEW_PHRASE_MALE,
  stopSetupMonsterTts,
  replayLastSetupMonsterTts,
  speakSetupMonsterTts,
  subscribeGhostiVoicePrefs,
  prefetchVoiceActorCacheInBackground,
  isMobileVoiceEnvironment,
  type GhostiVoiceGender,
} from '../services/setupMonsterTts';
import { useSaySeeStore } from '../store/useSaySeeStore';

interface VoiceActorControlPillProps {
  fallbackReplayText?: string;
  compact?: boolean;
}

export const VoiceActorControlPill: React.FC<VoiceActorControlPillProps> = ({
  fallbackReplayText,
  compact = false,
}) => {
  const [, setTick] = useState(0);
  const isStoreAppMode = useSaySeeStore((s) => s.isStoreAppMode);
  const allowMobileVoice = isMobileVoiceEnvironment() || Boolean(isStoreAppMode);

  useEffect(() => {
    if (!allowMobileVoice) return;
    prefetchVoiceActorCacheInBackground();
    return subscribeGhostiVoicePrefs(() => {
      setTick((t) => t + 1);
    });
  }, [allowMobileVoice]);

  if (!allowMobileVoice) return null;

  const gender = getPreferredVoiceGender();
  const enabled = getPreferredVoiceEnabled();
  const isSpeaking = getIsTtsSpeaking();

  const handleSpeakerClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSpeaking) {
      stopSetupMonsterTts();
      useSaySeeStore.setState({
        lastQuarantineToast: '음성을 일시 중단했습니다.',
      });
      return;
    }

    if (!enabled) {
      setPreferredVoiceEnabled(true);
    }

    const replayed = await replayLastSetupMonsterTts(fallbackReplayText);
    if (replayed) {
      const actorLabel = getPreferredVoiceGender() === 'female' ? '여성(선희)' : '남성(현수)';
      useSaySeeStore.setState({
        lastQuarantineToast: `${actorLabel} 목소리로 음성 안내를 다시 재생합니다.`,
      });
    } else {
      setPreferredVoiceEnabled(!enabled);
      const nextEnabled = getPreferredVoiceEnabled();
      useSaySeeStore.setState({
        lastQuarantineToast: nextEnabled
          ? `음성 안내가 켜졌습니다 (${getPreferredVoiceGender() === 'female' ? '여성 · 선희' : '남성 · 현수'}).`
          : '음성 안내가 꺼졌습니다.',
      });
    }
  };

  const handleGenderSelect = async (nextGender: GhostiVoiceGender, e: React.MouseEvent) => {
    e.stopPropagation();
    setPreferredVoiceGender(nextGender);
    if (!getPreferredVoiceEnabled()) {
      setPreferredVoiceEnabled(true);
    }
    const label = nextGender === 'female' ? '여성 성우(선희)' : '남성 성우(현수)';
    useSaySeeStore.setState({
      lastQuarantineToast: `음성 목소리가 ${label}로 변경되었습니다.`,
    });

    const lastText = getLastSpokenTtsText();
    const existingText =
      fallbackReplayText || (lastText && !isVoiceActorPreviewGreeting(lastText) ? lastText : '');
    if (existingText) {
      await replayLastSetupMonsterTts(existingText);
    } else {
      const previewPhrase =
        nextGender === 'female' ? VOICE_PREVIEW_PHRASE_FEMALE : VOICE_PREVIEW_PHRASE_MALE;
      await speakSetupMonsterTts(previewPhrase);
    }
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`md:hidden inline-flex items-center shrink-0 rounded-xl bg-white border border-slate-200 shadow-xs select-none transition-colors ${
        compact ? 'h-9 px-1 gap-0.5' : 'h-10 px-1.5 gap-1'
      }`}
      title="음성 안내 재생 및 성우 선택"
    >
      <button
        type="button"
        onClick={handleSpeakerClick}
        className={`flex items-center justify-center gap-0.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors cursor-pointer shrink-0 ${
          isSpeaking
            ? 'bg-rose-50 text-rose-700 border border-rose-200'
            : enabled
            ? 'hover:bg-slate-100 text-slate-900'
            : 'hover:bg-slate-100 text-slate-400'
        }`}
        title={isSpeaking ? '음성 중단' : '음성 다시 듣기 / 켜기·끄기'}
      >
        <span className="material-symbols-outlined text-[17px]">
          {isSpeaking ? 'volume_up' : enabled ? 'volume_up' : 'volume_off'}
        </span>
      </button>

      <span className="w-[1px] h-4 bg-slate-200 shrink-0" />

      <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 shrink-0">
        <button
          type="button"
          onClick={(e) => void handleGenderSelect('male', e)}
          className={`px-2.5 py-1 rounded-md text-[11.5px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
            gender === 'male'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
          title="남성 성우 (현수)"
        >
          남
        </button>
        <button
          type="button"
          onClick={(e) => void handleGenderSelect('female', e)}
          className={`px-2.5 py-1 rounded-md text-[11.5px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
            gender === 'female'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
          title="여성 성우 (선희)"
        >
          여
        </button>
      </div>
    </div>
  );
};
