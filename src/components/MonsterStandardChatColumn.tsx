import React, { useEffect, useRef, useState } from 'react';
import {
  Send,
  Bot,
  User,
  Mic,
  MicOff,
} from 'lucide-react';
import {
  getSharedMonsterChatState,
  subscribeSharedMonsterChat,
  setSharedMonsterMessages,
  setSharedMonsterLiteracyLevel,
  setSharedMonsterBusy,
  processUnifiedMonsterChatQuery,
  type MonsterChatMessage,
  type DigitalHealthCheckRecord,
} from '../services/monsterChatRouter';
import { MonsterInteractiveCardView } from './MonsterInteractiveCards';
import { VoiceActorControlPill } from './VoiceActorControlPill';
import {
  unlockMobileAudioOnUserGesture,
  notifyMicSessionEndedForTts,
  isMobileVoiceEnvironment,
} from '../services/setupMonsterTts';
import { transcribeAudioBlobViaCloud } from '../services/aiEngine';
import { normalizeSpokenKoreanQuery } from '../services/voiceSearchAndAiBatonEngine';
import { useSaySeeStore } from '../store/useSaySeeStore';
import {
  PC_MONSTER_ROLLING_PLACEHOLDERS_10,
  MOBILE_CLEAN_ROLLING_PLACEHOLDERS_10,
  getAndAdvanceSessionPlaceholderStartIndex,
  PLACEHOLDER_ROLLING_INTERVAL_MS,
  evaluateDualProactiveCareEngine,
  loadWeeklyCareSchedule,
  formatScheduleLabelKo,
} from '../services/weeklyCareAndPlaceholderEngine';

interface MonsterStandardChatColumnProps {
  sourceTab: 'trash' | 'repair';
  externalQueryTrigger?: { id: number; query: string } | null;
  onHealthRecordAdded: (record: DigitalHealthCheckRecord) => void;
  onJumpToSearch: (keyword: string) => void;
  onToast?: (msg: string) => void;
  onTriggerOsRepair?: (query: string) => void;
  onRepairSymptomDetected?: (query: string) => void;
  showWelcomeQuickCareActions?: boolean;
}

export const MonsterStandardChatColumn: React.FC<MonsterStandardChatColumnProps> = ({
  sourceTab,
  externalQueryTrigger,
  onHealthRecordAdded,
  onJumpToSearch,
  onToast,
  onTriggerOsRepair,
  onRepairSymptomDetected,
  showWelcomeQuickCareActions = false,
}) => {
  const [, setTick] = useState(0);
  const [inputText, setInputText] = useState('');
  const [isMicListening, setIsMicListening] = useState(false);
  const speechRecRef = useRef<any>(null);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const latestTranscriptRef = useRef<string>('');
  const silenceAutoTimerRef = useRef<number>(0);
  const submittedOnceRef = useRef<boolean>(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const lastHandledTriggerIdRef = useRef<number | null>(null);

  const isStoreAppMode = useSaySeeStore((s) => s.isStoreAppMode);
  const layout = useSaySeeStore((s) => s.layout);
  const isMobileOrStore =
    isStoreAppMode ||
    layout === 'mobile' ||
    (typeof window !== 'undefined' &&
      (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth < 860));

  // [멀린님 확정 명세 ③] 추천 칩 그리드 전면 폐지 ➔ 입력창 내 '연한 색 1줄 롤링 플레이스홀더 10선 (3분 주기 + 재로그인 로테이션)'
  const activePlaceholderPool = isMobileOrStore
    ? MOBILE_CLEAN_ROLLING_PLACEHOLDERS_10
    : PC_MONSTER_ROLLING_PLACEHOLDERS_10;

  const [placeholderIndex, setPlaceholderIndex] = useState<number>(() =>
    getAndAdvanceSessionPlaceholderStartIndex(activePlaceholderPool.length)
  );
  const [careScheduleSummary, setCareScheduleSummary] = useState<string>(() =>
    formatScheduleLabelKo(loadWeeklyCareSchedule())
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % activePlaceholderPool.length);
    }, PLACEHOLDER_ROLLING_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [activePlaceholderPool.length]);

  useEffect(() => {
    const onScheduleChange = () => {
      setCareScheduleSummary(formatScheduleLabelKo(loadWeeklyCareSchedule()));
    };
    window.addEventListener('ghosti_weekly_care_updated', onScheduleChange);
    return () => window.removeEventListener('ghosti_weekly_care_updated', onScheduleChange);
  }, []);

  // [멀린님 확정 명세 ②] 2중 자동 케어 엔진 (트랙 A: 20% 과부하 10분 지속 감지 ➕ 트랙 B: 수요일 13:00 「수요 손 없는 날」 정기 검진)
  useEffect(() => {
    let cancelled = false;
    const runProactiveCheck = async () => {
      if (cancelled) return;
      const briefing = await evaluateDualProactiveCareEngine({
        isStoreAppMode: isMobileOrStore,
      });
      if (!briefing || cancelled) return;
      setSharedMonsterMessages((prev) => {
        if (prev.some((m) => m.cardKind === 'WEEKLY_CARE_BRIEFING' && !m.proactiveCareBriefing?.executed)) {
          return prev;
        }
        const proactiveMsg: MonsterChatMessage = {
          id: `proactive_care_${Date.now()}`,
          role: 'assistant',
          timestamp: new Date().toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
          sourceTab,
          text: `🩺 **[${briefing.badgeLabel}]**\n1️⃣ ${briefing.headlineLine1}\n2️⃣ ${briefing.schedulePromptLine2}`,
          cardKind: 'WEEKLY_CARE_BRIEFING',
          proactiveCareBriefing: briefing,
          followUpSuggestions: [
            '응 지금 1초 만에 손봐줘',
            '정기 검진 요일 금요일 오후 4시로 귀신같이 바꿔줘',
          ],
        };
        return [...prev, proactiveMsg];
      });
    };

    // 첫 진입 2.5초 후 1회 점검 + 이후 60초마다 슬라이딩 윈도우(10분 지속 조건) 점검
    const initTimer = window.setTimeout(() => void runProactiveCheck(), 2500);
    const pollTimer = window.setInterval(() => void runProactiveCheck(), 60_000);
    return () => {
      cancelled = true;
      window.clearTimeout(initTimer);
      window.clearInterval(pollTimer);
    };
  }, [isMobileOrStore, sourceTab]);

  useEffect(() => {
    return subscribeSharedMonsterChat(() => {
      setTick((t) => t + 1);
    });
  }, []);

  const shared = getSharedMonsterChatState();
  const { messages, literacyLevel, ttsEnabled, busy } = shared;

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, busy]);

  /**
   * [멀린님 확정 명세 ④ — 음성 입출력(TTS) 엄격 미러링 & 사전 승낙 원칙]
   * - PC 환경: 음성 모드 없음 (100% 무음 텍스트 전용)
   * - 모바일 환경:
   *   1) 유저가 음성(마이크, inputMode === 'voice')으로 말했을 때만 ➔ 성우 음성(TTS) + 텍스트 응답
   *   2) 유저가 채팅(타자, inputMode === 'text')으로 입력했을 때 ➔ 똑같이 채팅(무음 텍스트)으로만 응답!
   *      (단, 따라 해야 하는 설정 가이드인 경우 MonsterInteractiveCards에서 [🔊 음성으로 안내받기] 사전 승낙 버튼 노출)
   */
  const handleSend = async (overrideQuery?: string, inputMode: 'text' | 'voice' = 'text') => {
    const raw = (overrideQuery ?? inputText).trim();
    if (!raw || busy) return;
    if (!overrideQuery) setInputText('');

    const userMsg: MonsterChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      timestamp: new Date().toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      text: raw,
      sourceTab,
    };

    setSharedMonsterMessages((prev) => [...prev, userMsg]);
    setSharedMonsterBusy(true);

    // 음성 입출력 엄격 미러링: 모바일에서 마이크로 말했을 때만 TTS 자동 발화 허용!
    const mirroredTtsEnabled =
      inputMode === 'voice' && isMobileVoiceEnvironment() && Boolean(ttsEnabled);

    try {
      const assistantMsg = await processUnifiedMonsterChatQuery({
        query: raw,
        sourceTab,
        literacyLevel,
        ttsEnabled: mirroredTtsEnabled,
      });
      setSharedMonsterMessages((prev) => [...prev, assistantMsg]);
      if (assistantMsg.healthRecordIssued) {
        onHealthRecordAdded(assistantMsg.healthRecordIssued);
      }
      if (assistantMsg.repairSymptomQuery) {
        onTriggerOsRepair?.(assistantMsg.repairSymptomQuery);
        onRepairSymptomDetected?.(assistantMsg.repairSymptomQuery);
      }
      if (assistantMsg.cardKind === 'SEARCH_ROUTING' && assistantMsg.searchKeyword) {
        onJumpToSearch(assistantMsg.searchKeyword);
      }
    } finally {
      setSharedMonsterBusy(false);
    }
  };

  const cleanupMediaRecorderFallback = () => {
    try {
      if (mediaRecRef.current && mediaRecRef.current.state !== 'inactive') {
        mediaRecRef.current.stop();
      }
    } catch {
      /* ignore */
    }
    mediaRecRef.current = null;
    try {
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {
      /* ignore */
    }
    mediaStreamRef.current = null;
  };

  const startMediaRecorderChatFallback = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setIsMicListening(false);
      onToast?.('🎤 마이크 권한이 없거나 음성 입력이 차단된 브라우저입니다.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      mediaStreamRef.current = stream;
      setIsMicListening(true);

      const preferredTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ];
      let selectedMime = '';
      if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
        for (const t of preferredTypes) {
          if (MediaRecorder.isTypeSupported(t)) {
            selectedMime = t;
            break;
          }
        }
      }
      const chunks: Blob[] = [];
      const rec = selectedMime
        ? new MediaRecorder(stream, { mimeType: selectedMime })
        : new MediaRecorder(stream);
      mediaRecRef.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      rec.onstop = async () => {
        setIsMicListening(false);
        try {
          stream.getTracks().forEach((t) => t.stop());
        } catch {
          /* ignore */
        }
        mediaStreamRef.current = null;
        mediaRecRef.current = null;

        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        if (blob.size < 100 || submittedOnceRef.current) return;
        setInputText('🎙️ 음성을 텍스트로 변환하고 있습니다...');
        const transcribed = await transcribeAudioBlobViaCloud(blob);
        if (transcribed && !submittedOnceRef.current) {
          submittedOnceRef.current = true;
          setInputText('');
          void handleSend(normalizeSpokenKoreanQuery(transcribed), 'voice');
        } else {
          setInputText('');
          onToast?.('🎤 음성이 잘 들리지 않았습니다. 마이크 가까이에서 다시 말씀해 주세요.');
        }
      };
      rec.start(200);
      window.clearTimeout(silenceAutoTimerRef.current);
      silenceAutoTimerRef.current = window.setTimeout(() => {
        if (mediaRecRef.current && mediaRecRef.current.state !== 'inactive') {
          try {
            mediaRecRef.current.stop();
          } catch {
            /* ignore */
          }
        }
      }, 4200);
    } catch {
      setIsMicListening(false);
      onToast?.('🎤 마이크 권한을 허용해 주시거나 아래 입력창에 입력해 주세요.');
    }
  };

  const finalizeAndSubmitSpokenText = () => {
    window.clearTimeout(silenceAutoTimerRef.current);
    notifyMicSessionEndedForTts();
    const spoken = latestTranscriptRef.current.trim();
    if (spoken && !submittedOnceRef.current) {
      submittedOnceRef.current = true;
      latestTranscriptRef.current = '';
      setInputText('');
      void handleSend(normalizeSpokenKoreanQuery(spoken), 'voice');
    }
  };

  const toggleChatMicRecording = () => {
    unlockMobileAudioOnUserGesture();

    if (isMicListening) {
      window.clearTimeout(silenceAutoTimerRef.current);
      try {
        speechRecRef.current?.stop();
      } catch {
        /* ignore */
      }
      if (mediaRecRef.current && mediaRecRef.current.state !== 'inactive') {
        cleanupMediaRecorderFallback();
      } else {
        setIsMicListening(false);
        finalizeAndSubmitSpokenText();
      }
      return;
    }

    latestTranscriptRef.current = '';
    submittedOnceRef.current = false;
    window.clearTimeout(silenceAutoTimerRef.current);

    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      void startMediaRecorderChatFallback();
      return;
    }

    try {
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = 'ko-KR';
      recognition.interimResults = true;
      recognition.continuous = false;
      speechRecRef.current = recognition;

      recognition.onstart = () => {
        setIsMicListening(true);
      };
      recognition.onresult = (event: any) => {
        const resultsArr = Array.from(event.results) as any[];
        const fullText = resultsArr
          .map((r: any) => String(r?.[0]?.transcript || ''))
          .join('')
          .trim();
        if (fullText) {
          latestTranscriptRef.current = fullText;
          setInputText(fullText);
        }
        const lastResult = resultsArr[resultsArr.length - 1];
        window.clearTimeout(silenceAutoTimerRef.current);
        if (lastResult?.isFinal && fullText) {
          silenceAutoTimerRef.current = window.setTimeout(() => {
            try {
              recognition.stop();
            } catch {
              /* ignore */
            }
            setIsMicListening(false);
            finalizeAndSubmitSpokenText();
          }, 650);
        } else if (fullText) {
          silenceAutoTimerRef.current = window.setTimeout(() => {
            try {
              recognition.stop();
            } catch {
              /* ignore */
            }
            setIsMicListening(false);
            finalizeAndSubmitSpokenText();
          }, 1600);
        }
      };
      recognition.onerror = (ev: any) => {
        window.clearTimeout(silenceAutoTimerRef.current);
        const errCode = String(ev?.error || '');
        if (latestTranscriptRef.current.trim()) {
          setIsMicListening(false);
          finalizeAndSubmitSpokenText();
          return;
        }
        if (errCode && errCode !== 'aborted' && errCode !== 'no-speech') {
          void startMediaRecorderChatFallback();
          return;
        }
        setIsMicListening(false);
      };
      recognition.onend = () => {
        setIsMicListening(false);
        finalizeAndSubmitSpokenText();
      };
      recognition.start();
    } catch {
      void startMediaRecorderChatFallback();
    }
  };

  useEffect(() => {
    if (
      externalQueryTrigger &&
      externalQueryTrigger.id !== lastHandledTriggerIdRef.current &&
      externalQueryTrigger.query.trim()
    ) {
      lastHandledTriggerIdRef.current = externalQueryTrigger.id;
      void handleSend(externalQueryTrigger.query, 'text');
    }
  }, [externalQueryTrigger]);

  useEffect(() => {
    const consumePendingToss = () => {
      try {
        const pending = sessionStorage.getItem('ghosti_pending_monster_query');
        if (pending && pending.trim()) {
          sessionStorage.removeItem('ghosti_pending_monster_query');
          void handleSend(pending.trim(), 'text');
        }
      } catch {
        /* ignore */
      }
    };
    consumePendingToss();

    const onTossEvent = (e: Event) => {
      const custom = e as CustomEvent<{ query?: string }>;
      const q = custom.detail?.query?.trim();
      if (q) {
        try {
          sessionStorage.removeItem('ghosti_pending_monster_query');
        } catch {
          /* ignore */
        }
        void handleSend(q, 'text');
      }
    };
    window.addEventListener('ghosti_toss_to_monster_chat', onTossEvent);
    return () => window.removeEventListener('ghosti_toss_to_monster_chat', onTossEvent);
  }, []);

  const currentRollingPlaceholder =
    activePlaceholderPool[placeholderIndex % activePlaceholderPool.length] ||
    activePlaceholderPool[0];

  return (
    <aside className="flex flex-col h-[calc(100vh-155px)] min-h-[580px] max-h-[840px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/95 shadow-lg overflow-hidden">
      {/* 0. 최상단 독립 배너: 수요 손 없는 날 & 20% 과부하 자동 검진 안내 (불필요한 '✋ 손보기 대화창' 제목줄 및 '↺ 새 대화' 버튼 전면 제거!) */}
      <div
        title={careScheduleSummary}
        className="px-3.5 py-2 border-b border-emerald-200/80 dark:border-emerald-500/20 bg-emerald-50/90 dark:bg-emerald-950/40 flex flex-wrap items-center justify-between gap-1.5 text-[11.5px] font-extrabold text-emerald-900 dark:text-emerald-300 leading-snug"
      >
        <span>🗓️ 매주 수요일 오후 1시 「수요 손 없는 날」</span>
        <span className="text-emerald-700 dark:text-emerald-400 font-bold">
          ⚡ 20% 과부하 시 자동 검진
        </span>
      </div>

      {/* 1. 상단 슬림 원복 안내 (모바일에서만 성우 컨트롤 우측 병기) */}
      <div className="px-3.5 py-2 bg-emerald-50/60 dark:bg-emerald-950/25 border-b border-emerald-200 dark:border-emerald-500/20 flex items-center justify-between gap-2 text-[12px] text-emerald-900 dark:text-emerald-200">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="shrink-0 font-bold">🛡️</span>
          <span className="font-bold text-emerald-800 dark:text-emerald-300">
            손보기 후 원하는 시점으로 복원 가능
          </span>
        </div>
        {isMobileOrStore && <VoiceActorControlPill compact />}
      </div>

      {/* 2. 본문 대화 스트림 (노션 스타일 미니멀 버블) */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5 bg-[#FAF9F5] dark:bg-transparent"
      >
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center gap-1.5 mb-1 px-1">
                {isUser ? (
                  <>
                    <span className="text-[11px] text-slate-500">{msg.timestamp}</span>
                    <span className="text-[12px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      나 <User className="w-3.5 h-3.5" />
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[12px] font-extrabold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                      <Bot className="w-3.5 h-3.5" /> 귀신같이 비서
                    </span>
                    <span className="text-[11px] text-slate-500">{msg.timestamp}</span>
                  </>
                )}
              </div>

              <div
                className={`max-w-[95%] rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed whitespace-pre-line shadow-xs ${
                  isUser
                    ? 'bg-teal-600 text-white rounded-tr-sm border border-teal-700 font-semibold'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-tl-sm'
                }`}
              >
                {msg.text.replace(/\*\*/g, '')}

                {!isUser && (
                  <MonsterInteractiveCardView
                    message={msg}
                    literacyLevel={literacyLevel}
                    onChangeLiteracyLevel={setSharedMonsterLiteracyLevel}
                    onUpdateMessage={(updated) =>
                      setSharedMonsterMessages((prev) =>
                        prev.map((m) => (m.id === updated.id ? updated : m))
                      )
                    }
                    onHealthRecordAdded={onHealthRecordAdded}
                    onJumpToSearch={onJumpToSearch}
                    onToast={onToast}
                  />
                )}

                {!isUser && msg.followUpSuggestions && msg.followUpSuggestions.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-800/80 flex flex-wrap gap-1.5">
                    {msg.followUpSuggestions.map((sug, sIdx) => (
                      <button
                        key={sIdx}
                        type="button"
                        disabled={busy}
                        onClick={() => void handleSend(sug, 'text')}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800/90 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-[11.5px] font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer text-left"
                      >
                        💬 {sug}
                      </button>
                    ))}
                  </div>
                )}

                {/* [레드팀 보완] 1단계 미니멀 뷰에서 좌측 3대 검진 박스 제거 시, 첫 환영 말풍선 안에 PC 속도·보안모듈 / 바탕화면 1클릭 버튼 제공 */}
                {!isUser &&
                  showWelcomeQuickCareActions &&
                  !isMobileOrStore &&
                  msg.id === 'monster_welcome_init' && (
                    <div className="mt-2.5 pt-2.5 border-t border-slate-200 dark:border-slate-800/80 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void handleSend('지금 PC가 좀 느린데 1초 건강검진 해줘', 'text')
                        }
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/70 border border-emerald-300 dark:border-emerald-500/40 text-[11.5px] font-extrabold text-emerald-800 dark:text-emerald-300 transition cursor-pointer text-left"
                      >
                        ⚡ 느려진 PC 보안모듈·속도 1초 검진
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void handleSend('바탕화면이랑 다운로드 찌꺼기 파일 정리해줘', 'text')
                        }
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/90 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-[11.5px] font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer text-left"
                      >
                        🗂️ 바탕화면·설치파일 찌꺼기 정리
                      </button>
                    </div>
                  )}
              </div>
            </div>
          );
        })}

        {busy && (
          <div className="flex items-center gap-2 text-[13px] font-bold text-slate-700 dark:text-slate-300 px-2 py-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            확인하고 있습니다...
          </div>
        )}
      </div>

      {/* 3. 하단 초미니멀 입력창 (고정 스타터 칩 그리드 완전 폐지 ➔ 입력창 내 연한 색 1줄 롤링 플레이스홀더 10선) */}
      <div className="px-3.5 py-3 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/60">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            unlockMobileAudioOnUserGesture();
            void handleSend(undefined, 'text');
          }}
          className="flex items-center gap-1.5 sm:gap-2 w-full min-w-0"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              isMicListening
                ? '🎙️ 듣고 있습니다...'
                : `예) ${currentRollingPlaceholder}`
            }
            className="flex-1 min-w-0 px-2.5 sm:px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-emerald-600 focus:outline-none text-[13px] sm:text-[13.5px] text-slate-900 dark:text-white placeholder:text-slate-400/75 dark:placeholder:text-slate-500/75 transition-all"
          />
          {/* PC는 텍스트 채팅 올인, 모바일에서만 [음성] 마이크 버튼 노출 */}
          <button
            type="button"
            onClick={toggleChatMicRecording}
            disabled={busy}
            title="모바일 음성으로 말하기 (음성 입력 시에만 성우 음성으로 응답합니다)"
            className={`md:hidden px-2 sm:px-3 py-2.5 rounded-xl text-[12px] sm:text-[13px] font-extrabold flex items-center gap-1 transition shrink-0 cursor-pointer border ${
              isMicListening
                ? 'bg-rose-600 text-white border-rose-500 animate-pulse'
                : 'bg-white hover:bg-emerald-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-emerald-700 dark:text-emerald-300 border-emerald-400/60 dark:border-emerald-500/40'
            }`}
          >
            {isMicListening ? <MicOff className="w-4 h-4 shrink-0" /> : <Mic className="w-4 h-4 shrink-0" />}
            <span className="shrink-0">{isMicListening ? '듣는중' : '음성'}</span>
          </button>
          <button
            type="submit"
            disabled={busy || !inputText.trim()}
            aria-label="전송"
            className="px-2.5 sm:px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-[12px] sm:text-[13px] font-extrabold flex items-center gap-1 transition shrink-0 cursor-pointer"
          >
            <Send className="w-4 h-4 shrink-0" />
            <span className="shrink-0">전송</span>
          </button>
        </form>
      </div>
    </aside>
  );
};
