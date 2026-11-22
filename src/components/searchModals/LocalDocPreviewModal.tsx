import React, { useEffect, useState } from 'react';
import { useSaySeeStore } from '../../store/useSaySeeStore';
import { executeRealOsAction } from '../../services/setupMonsterEngine';
import {
  stopSetupMonsterTts,
  getIsTtsSpeaking,
  replayLastSetupMonsterTts,
  subscribeGhostiVoicePrefs,
  getPreferredVoiceGender,
  isMobileVoiceEnvironment,
} from '../../services/setupMonsterTts';
import { VoiceActorControlPill } from '../VoiceActorControlPill';
import { triggerUserFavoriteAiLiveVoiceBatonTouch } from '../../services/voiceSearchAndAiBatonEngine';
import { renderHighlightedDocText, resolveDocExtBadge } from './docAndVideoFormatUtils';

/**
 * [스펙 1] 스마트 서류함 내 로컬 PDF/TXT/DOCX 문서 상세 열람 모달
 */
export const LocalDocPreviewModal: React.FC = () => {
  const {
    selectedDocModal,
    setSelectedDocModal,
    openLocalFolder,
    activeQuery,
    hasExecutedUserSearch,
  } = useSaySeeStore();
  const [, setVoiceTick] = useState(0);

  useEffect(() => {
    return subscribeGhostiVoicePrefs(() => {
      setVoiceTick((t) => t + 1);
    });
  }, []);

  if (!selectedDocModal) return null;

  const effectiveQuery = hasExecutedUserSearch ? activeQuery : '';
  const isSpeakingNow = getIsTtsSpeaking();
  const fallbackDocVoiceText = `${selectedDocModal.title}. ${selectedDocModal.extractedText}`;

  const handleCloseModal = () => {
    stopSetupMonsterTts();
    setSelectedDocModal(null);
  };

  const handleToggleModalVoice = async () => {
    if (getIsTtsSpeaking()) {
      stopSetupMonsterTts();
      useSaySeeStore.setState({
        lastQuarantineToast: '🔇 음성 안내를 중단했습니다. (다시 클릭하시면 음성이 다시 재생됩니다)',
      });
    } else {
      await replayLastSetupMonsterTts(fallbackDocVoiceText);
      const actorName = getPreferredVoiceGender() === 'female' ? '여성 성우(선희)' : '남성 성우(현수)';
      useSaySeeStore.setState({
        lastQuarantineToast: `🔊 [${actorName}] 문서 음성 안내를 다시 재생합니다.`,
      });
    }
  };

  return (
    <div
      onClick={handleCloseModal}
      className="fixed inset-0 z-[105] bg-black/80 backdrop-blur-xl flex items-center justify-center px-3 sm:px-4 pt-safe pb-safe"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-full sm:max-h-[88dvh] overflow-hidden rounded-3xl bg-surface-container-low border border-primary-container/50 p-4 sm:p-6 md:p-7 shadow-2xl flex flex-col gap-3 sm:gap-4"
      >
        <div className="flex items-start justify-between gap-3 shrink-0 pb-2 border-b border-outline-variant/20">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-md bg-primary-container text-on-primary-container font-label-mono text-[10.5px] font-black">
                {resolveDocExtBadge(selectedDocModal)} 문서 자산
              </span>
              <span className="px-2 py-0.5 rounded-full bg-surface-container-highest text-primary font-label-sm text-[10.5px] font-bold">
                {selectedDocModal.categoryBadge}
              </span>
              <span className="font-label-mono text-[10.5px] text-on-surface-variant">
                • {selectedDocModal.deviceSource}
              </span>
            </div>
            <h3 className="font-headline-sm text-[16.5px] sm:text-[19px] text-on-surface font-extrabold mt-0.5 break-words">
              {renderHighlightedDocText(
                selectedDocModal.title,
                effectiveQuery,
                selectedDocModal.keywords.slice(0, 3)
              )}
            </h3>
            <p className="font-label-mono text-[11px] text-on-surface-variant truncate">
              파일명: {selectedDocModal.fileName} • 날짜: {selectedDocModal.date} • 크기:{' '}
              {(selectedDocModal.sizeKB / 1024).toFixed(2)} MB
            </p>
          </div>

          <button
            type="button"
            onClick={handleCloseModal}
            aria-label="닫기"
            className="w-10 h-10 rounded-full bg-surface-container-highest hover:bg-surface-bright border border-outline-variant/40 flex items-center justify-center text-on-surface shrink-0 cursor-pointer shadow-sm"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 pr-0.5">
          {selectedDocModal.matchType === 'SIMILAR' && (
            <div className="px-3.5 py-2.5 rounded-2xl bg-amber-500/15 border border-amber-400/50 text-amber-200 font-label-md text-[12.5px] sm:text-[13px] font-extrabold flex items-center gap-2 shrink-0">
              <span>
                {selectedDocModal.similarityNoticeKo ||
                  '💡 검색어와 100% 일치하는 문서가 없어 유사한 문서를 찾았습니다!'}
              </span>
            </div>
          )}

          <div className="p-3.5 sm:p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-label-mono text-[11px] text-primary-container font-bold">
                🔍 로컬 문서 본문 미리보기 (검색어 노란색 하이라이트 • 1초 복사 지원)
              </span>
            </div>
            <p className="font-body-md text-[13.5px] sm:text-[14px] text-on-surface leading-relaxed whitespace-pre-wrap break-words">
              {renderHighlightedDocText(
                selectedDocModal.extractedText,
                effectiveQuery,
                selectedDocModal.keywords.slice(0, 4)
              )}
            </p>
            <div className="flex flex-wrap gap-1.5 pt-2">
              {selectedDocModal.keywords.map((kw) => (
                <span
                  key={kw}
                  className="px-2.5 py-0.5 rounded-full bg-primary-container/15 text-primary-container font-label-sm text-[11px] font-bold"
                >
                  #{kw}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-outline-variant/20 shrink-0 bg-surface-container-low">
          {isMobileVoiceEnvironment() && (
            <div className="flex flex-wrap items-center gap-1.5">
              <VoiceActorControlPill fallbackReplayText={fallbackDocVoiceText} compact />
              <button
                type="button"
                onClick={() => void handleToggleModalVoice()}
                className={`px-3 py-2 rounded-xl font-label-md text-[12px] font-extrabold flex items-center gap-1 cursor-pointer transition-all ${
                  isSpeakingNow
                    ? 'bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/50 text-rose-200'
                    : 'bg-teal-500/20 hover:bg-teal-500/35 border border-teal-400/50 text-teal-200'
                }`}
              >
                <span>{isSpeakingNow ? '🔇 음성 중단' : '🔊 다시 듣기'}</span>
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 ml-auto">
            {!/(비밀번호|패스워드|password|계정\s*정리|아이디.*비번|암호\s*목록)/i.test(
              selectedDocModal.title || ''
            ) ? (
              <button
                type="button"
                onClick={async () => {
                  const res = await triggerUserFavoriteAiLiveVoiceBatonTouch({
                    docTitle: selectedDocModal.title,
                    docText: selectedDocModal.extractedText,
                    userQuestion:
                      activeQuery && hasExecutedUserSearch
                        ? activeQuery
                        : '이 문서에서 나에게 불리한 독소조항이나 핵심 주의사항을 쉽게 설명해 줘.',
                  });
                  useSaySeeStore.setState({
                    lastQuarantineToast: `🤝 [${res.detectedAiLabel} 바톤터치] ${res.ttsBriefingKo}`,
                  });
                }}
                className="px-3 py-2 rounded-xl bg-fuchsia-600 text-white font-label-md text-[12px] font-black flex items-center gap-1 shadow-md hover:bg-fuchsia-500 transition-colors cursor-pointer"
              >
                <span>🤝 AI 상담</span>
              </button>
            ) : (
              <span className="px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-emerald-500/40 text-emerald-300 font-label-sm text-[11px] font-bold">
                🔒 민감 계정 외부 전송 차단됨
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(selectedDocModal.extractedText);
                useSaySeeStore.setState({
                  lastQuarantineToast: `📋 복사 완료! [${selectedDocModal.title}] 본문 내용이 클립보드에 즉시 복사되었습니다.`,
                });
              }}
              className="px-3.5 py-2 rounded-xl bg-emerald-500 text-zinc-950 font-label-md text-[12.5px] font-black flex items-center gap-1 shadow-md hover:bg-emerald-400 transition-colors cursor-pointer"
            >
              <span>📋 복사</span>
            </button>
            <button
              type="button"
              onClick={() => {
                void executeRealOsAction(
                  'open_file_search',
                  selectedDocModal.path || selectedDocModal.fileName
                ).then((res) => {
                  useSaySeeStore.setState({
                    lastQuarantineToast:
                      res.summaryKo ||
                      `📂 탐색기에서 [${selectedDocModal.fileName}] 파일을 바로 띄웠습니다.`,
                  });
                });
              }}
              className="hidden sm:flex px-3.5 py-2 rounded-xl bg-amber-500 text-zinc-950 font-label-md text-[12.5px] font-black items-center gap-1 shadow-md hover:bg-amber-400 transition-colors cursor-pointer"
            >
              <span>🔍 파일 띄우기</span>
            </button>
            <button
              type="button"
              onClick={() => void openLocalFolder('docs')}
              className="hidden sm:flex px-3.5 py-2 rounded-xl bg-primary-container text-on-primary-container font-label-md text-[12.5px] font-extrabold items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">folder_open</span>
              <span>서류함 폴더</span>
            </button>
            <button
              type="button"
              onClick={handleCloseModal}
              className="px-4 py-2 rounded-xl bg-surface-container-high text-on-surface font-label-md text-[12.5px] font-extrabold cursor-pointer"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
