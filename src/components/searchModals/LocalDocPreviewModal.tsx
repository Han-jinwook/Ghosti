import React, { useEffect, useState } from 'react';
import { useSaySeeStore } from '../../store/useSaySeeStore';
import { getZCoreUrl, zCoreBridge } from '../../services/zCoreBridge';
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
import {
  openLocalDocWithMissingGuard,
  renderHighlightedDocText,
  resolveDocExtBadge,
} from './docAndVideoFormatUtils';

export const LocalDocPreviewModal: React.FC = () => {
  const {
    selectedDocModal,
    setSelectedDocModal,
    openLocalFolder,
    activeQuery,
    hasExecutedUserSearch,
  } = useSaySeeStore();
  const [, setVoiceTick] = useState(0);
  const [hydratedFullText, setHydratedFullText] = useState<string | null>(null);

  useEffect(() => {
    return subscribeGhostiVoicePrefs(() => {
      setVoiceTick((t) => t + 1);
    });
  }, []);

  useEffect(() => {
    setHydratedFullText(null);
    if (
      !selectedDocModal?.path ||
      !(selectedDocModal as { hasMoreText?: boolean }).hasMoreText ||
      !zCoreBridge.isConnected
    ) {
      return;
    }
    let cancelled = false;
    void fetch(
      getZCoreUrl(`/__docs/full-text?path=${encodeURIComponent(selectedDocModal.path)}`)
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { ok?: boolean; extractedText?: string } | null) => {
        if (!cancelled && j?.ok && j.extractedText) {
          setHydratedFullText(j.extractedText);
        }
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDocModal?.id, selectedDocModal?.path]);

  if (!selectedDocModal) return null;

  const safeKeywords = Array.isArray(selectedDocModal.keywords) ? selectedDocModal.keywords : [];
  const displayDocText = String(hydratedFullText ?? selectedDocModal.extractedText ?? '');
  const effectiveQuery = hasExecutedUserSearch ? activeQuery : '';
  const isSpeakingNow = getIsTtsSpeaking();
  const fallbackDocVoiceText = `${selectedDocModal.title || selectedDocModal.fileName || ''}. ${displayDocText}`;

  const handleCloseModal = () => {
    stopSetupMonsterTts();
    setSelectedDocModal(null);
  };

  const handleToggleModalVoice = async () => {
    if (getIsTtsSpeaking()) {
      stopSetupMonsterTts();
      useSaySeeStore.setState({
        lastQuarantineToast: '음성 안내를 중단했습니다.',
      });
    } else {
      await replayLastSetupMonsterTts(fallbackDocVoiceText);
      const actorName = getPreferredVoiceGender() === 'female' ? '여성 성우(선희)' : '남성 성우(현수)';
      useSaySeeStore.setState({
        lastQuarantineToast: `${actorName} 목소리로 문서 음성 안내를 재생합니다.`,
      });
    }
  };

  return (
    <div
      onClick={handleCloseModal}
      className="fixed inset-0 z-[105] bg-black/55 backdrop-blur-xs flex items-center justify-center px-3 sm:px-4 pt-safe pb-safe"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-full sm:max-h-[88dvh] overflow-hidden rounded-2xl bg-white border border-slate-200 p-4 sm:p-6 shadow-2xl text-slate-900 flex flex-col gap-4"
      >
        <div className="flex items-start justify-between gap-3 shrink-0 pb-3 border-b border-slate-100">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-slate-500">
              <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-semibold">
                {resolveDocExtBadge(selectedDocModal)}
              </span>
              <span>{selectedDocModal.categoryBadge}</span>
              <span>·</span>
              <span>{selectedDocModal.deviceSource}</span>
            </div>
            <h3 className="text-[16.5px] sm:text-[18px] text-slate-900 font-bold mt-0.5 break-words leading-snug">
              {renderHighlightedDocText(
                selectedDocModal.title || selectedDocModal.fileName || '',
                effectiveQuery,
                safeKeywords.slice(0, 3)
              )}
            </h3>
            <p className="text-[11.5px] text-slate-500 truncate">
              {selectedDocModal.fileName} · {selectedDocModal.date} · {((selectedDocModal.sizeKB || 0) / 1024).toFixed(2)} MB
            </p>
          </div>

          <button
            type="button"
            onClick={handleCloseModal}
            aria-label="닫기"
            className="w-8 h-8 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 shrink-0 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 pr-0.5">
          {selectedDocModal.matchType === 'SIMILAR' && (
            <div className="px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-[12.5px] font-medium shrink-0">
              {selectedDocModal.similarityNoticeKo ||
                '정확히 일치하는 문서가 없어 유사한 문서를 표시합니다.'}
            </div>
          )}

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-2.5">
            <span className="text-[11.5px] text-slate-500 font-semibold">
              문서 본문 미리보기
            </span>
            <p className="text-[13.5px] text-slate-800 leading-relaxed whitespace-pre-wrap break-words">
              {renderHighlightedDocText(
                displayDocText,
                effectiveQuery,
                safeKeywords.slice(0, 4)
              )}
            </p>
            {safeKeywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {safeKeywords.map((kw) => (
                  <span
                    key={kw}
                    className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600 text-[11px] font-medium"
                  >
                    #{kw}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 shrink-0">
          {isMobileVoiceEnvironment() && (
            <div className="flex flex-wrap items-center gap-1.5">
              <VoiceActorControlPill fallbackReplayText={fallbackDocVoiceText} compact />
              <button
                type="button"
                onClick={() => void handleToggleModalVoice()}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border cursor-pointer transition-colors ${
                  isSpeakingNow
                    ? 'bg-rose-50 border-rose-200 text-rose-700'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <span>{isSpeakingNow ? '음성 중단' : '다시 듣기'}</span>
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-1.5 ml-auto">
            {!/(비밀번호|패스워드|password|계정\s*정리|아이디.*비번|암호\s*목록)/i.test(
              selectedDocModal.title || ''
            ) ? (
              <button
                type="button"
                onClick={async () => {
                  const res = await triggerUserFavoriteAiLiveVoiceBatonTouch({
                    docTitle: selectedDocModal.title,
                    docText: displayDocText,
                    userQuestion:
                      activeQuery && hasExecutedUserSearch
                        ? activeQuery
                        : '이 문서에서 핵심 내용과 주의사항을 쉽게 설명해 줘.',
                  });
                  useSaySeeStore.setState({
                    lastQuarantineToast: `[${res.detectedAiLabel}] ${res.ttsBriefingKo}`,
                  });
                }}
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[12px] font-medium transition-colors cursor-pointer"
              >
                AI 요약 질문
              </button>
            ) : (
              <span className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-medium">
                민감 정보 외부 전송 제한
              </span>
            )}
            {(() => {
              const gMatch = displayDocText.match(
                /https:\/\/(?:docs|drive)\.google\.com\/[^\s"'<>]+/
              );
              const rawName = selectedDocModal.fileName || selectedDocModal.path || '';
              const isGoogleExt = /\.(gsheet|gdoc|gslides)$/i.test(rawName);
              const gHref = gMatch
                ? gMatch[0]
                : isGoogleExt
                ? `https://drive.google.com/drive/search?q=${encodeURIComponent(
                    (selectedDocModal.title || rawName).replace(/\.[^.]+$/, '')
                  )}`
                : '';
              if (!gHref) return null;
              return (
                <a
                  href={gHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-semibold transition-colors cursor-pointer"
                >
                  Google 문서·시트 웹에서 열기 ↗
                </a>
              );
            })()}
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(displayDocText);
                useSaySeeStore.setState({
                  lastQuarantineToast: `[${selectedDocModal.title}] 본문이 클립보드에 복사되었습니다.`,
                });
              }}
              className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-semibold transition-colors cursor-pointer"
            >
              본문 복사
            </button>
            {Boolean(selectedDocModal.path) &&
              !selectedDocModal.id.startsWith('shadow-remote-doc-') && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      void openLocalDocWithMissingGuard(selectedDocModal);
                    }}
                    className="hidden sm:flex px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[12px] font-medium items-center cursor-pointer"
                  >
                    원본 파일 열기
                  </button>
                  <button
                    type="button"
                    onClick={() => void openLocalFolder('docs', selectedDocModal.path)}
                    className="hidden sm:flex px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[12px] font-medium items-center gap-1 cursor-pointer"
                  >
                    <span>문서 폴더</span>
                  </button>
                </>
              )}
            <button
              type="button"
              onClick={handleCloseModal}
              className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[12px] font-medium cursor-pointer"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
