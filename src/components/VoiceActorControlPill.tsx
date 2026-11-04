import React, { useEffect, useState } from 'react';
import {
  getPreferredVoiceGender,
  setPreferredVoiceGender,
  getPreferredVoiceEnabled,
  setPreferredVoiceEnabled,
  getIsTtsSpeaking,
  stopSetupMonsterTts,
  replayLastSetupMonsterTts,
  subscribeGhostiVoicePrefs,
  type GhostiVoiceGender,
} from '../services/setupMonsterTts';
import { useSaySeeStore } from '../store/useSaySeeStore';

interface VoiceActorControlPillProps {
  /** 재생/중단 토글 시 사용할 기본 텍스트 (없으면 마지막 재생 텍스트 사용) */
  fallbackReplayText?: string;
  /** 컴팩트 모드 여부 (검색창 옆 / 헤더 등) */
  compact?: boolean;
}

/**
 * 🎙️ 트렌디 & 심플 통합 음성 컨트롤 캡슐
 * - 하나의 세련된 캡슐 안에:
 *   1) 🔊/🔇 음성 재생·중단(재클릭 시 즉시 다시 재생) 원터치 아이콘 버튼
 *   2) [남 | 여] 슬라이딩 세그먼트 스위치 (남성 현수 vs 여성 선희 성우 즉시 전환)
 */
export const VoiceActorControlPill: React.FC<VoiceActorControlPillProps> = ({
  fallbackReplayText,
  compact = false,
}) => {
  const [, setTick] = useState(0);

  useEffect(() => {
    return subscribeGhostiVoicePrefs(() => {
      setTick((t) => t + 1);
    });
  }, []);

  const gender = getPreferredVoiceGender();
  const enabled = getPreferredVoiceEnabled();
  const isSpeaking = getIsTtsSpeaking();

  const handleSpeakerClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSpeaking) {
      stopSetupMonsterTts();
      useSaySeeStore.setState({
        lastQuarantineToast: '🔇 음성을 일시 중단했습니다. (버튼을 다시 누르면 이어서 다시 읽어드립니다)',
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
        lastQuarantineToast: `🔊 [${actorLabel} 목소리] 음성 안내를 다시 재생합니다.`,
      });
    } else {
      setPreferredVoiceEnabled(!enabled);
      const nextEnabled = getPreferredVoiceEnabled();
      useSaySeeStore.setState({
        lastQuarantineToast: nextEnabled
          ? `🔊 음성 안내가 켜졌습니다 (${getPreferredVoiceGender() === 'female' ? '여성 · 선희' : '남성 · 현수'} 목소리).`
          : '🔇 음성 안내가 꺼졌습니다.',
      });
    }
  };

  const handleGenderSelect = async (nextGender: GhostiVoiceGender, e: React.MouseEvent) => {
    e.stopPropagation();
    const wasSpeaking = getIsTtsSpeaking();
    setPreferredVoiceGender(nextGender);
    if (!getPreferredVoiceEnabled()) {
      setPreferredVoiceEnabled(true);
    }
    const label = nextGender === 'female' ? '👩 여성 성우(선희)' : '👨 남성 성우(현수)';
    useSaySeeStore.setState({
      lastQuarantineToast: `🎙️ 음성 목소리가 [${label}]로 변경되었습니다!`,
    });

    // 만약 음성이 재생 중이었거나 문서 모달/검색 직후라면 바뀐 목소리로 즉시 다시 들려주기
    if (wasSpeaking || fallbackReplayText) {
      await replayLastSetupMonsterTts(fallbackReplayText);
    }
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center rounded-2xl bg-[#18181B] border border-white/15 shadow-sm select-none transition-all ${
        compact ? 'h-10 px-1.5 gap-1' : 'h-12 md:h-13 px-2 gap-1.5'
      }`}
      title="음성 안내 재생/중단 및 남·여 성우 목소리 선택"
    >
      {/* 1. 스피커 아이콘 버튼: 재생 중일 때 누르면 즉시 중단, 다시 누르면 즉시 재재생 */}
      <button
        type="button"
        onClick={handleSpeakerClick}
        className={`flex items-center gap-1 rounded-xl px-2 py-1.5 font-label-sm text-[12px] font-extrabold transition-all cursor-pointer ${
          isSpeaking
            ? 'bg-rose-500/20 text-rose-300 border border-rose-400/40 animate-pulse'
            : enabled
            ? 'hover:bg-zinc-800 text-primary-container'
            : 'hover:bg-zinc-800 text-zinc-500'
        }`}
        title={
          isSpeaking
            ? '클릭 시 음성 즉시 중단'
            : '클릭 시 음성 다시 듣기 / 켜기·끄기'
        }
      >
        <span className="material-symbols-outlined text-[18px]">
          {isSpeaking ? 'volume_up' : enabled ? 'volume_up' : 'volume_off'}
        </span>
        {!compact && (
          <span className="hidden xl:inline text-[11.5px]">
            {isSpeaking ? '중단' : '음성'}
          </span>
        )}
      </button>

      {/* 구분선 */}
      <span className="w-[1px] h-5 bg-white/10" />

      {/* 2. 트렌디 슬라이딩 세그먼트 알약: [남 | 여] */}
      <div className="inline-flex items-center p-0.5 rounded-xl bg-zinc-950/90 border border-white/10">
        <button
          type="button"
          onClick={(e) => void handleGenderSelect('male', e)}
          className={`px-2.5 py-1 rounded-lg font-label-sm text-[11.5px] font-extrabold transition-all cursor-pointer ${
            gender === 'male'
              ? 'bg-primary-container text-zinc-950 shadow-xs'
              : 'text-zinc-400 hover:text-white'
          }`}
          title="남성 성우 (현수) 목소리 선택"
        >
          남
        </button>
        <button
          type="button"
          onClick={(e) => void handleGenderSelect('female', e)}
          className={`px-2.5 py-1 rounded-lg font-label-sm text-[11.5px] font-extrabold transition-all cursor-pointer ${
            gender === 'female'
              ? 'bg-primary-container text-zinc-950 shadow-xs'
              : 'text-zinc-400 hover:text-white'
          }`}
          title="여성 성우 (선희) 목소리 선택"
        >
          여
        </button>
      </div>
    </div>
  );
};
