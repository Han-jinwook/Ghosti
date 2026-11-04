import React, { useEffect, useRef, useState } from 'react';
import {
  Send,
  Volume2,
  VolumeX,
  RotateCcw,
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
  setSharedMonsterTtsEnabled,
  setSharedMonsterBusy,
  resetSharedMonsterChatToWelcome,
  processUnifiedMonsterChatQuery,
  type MonsterChatMessage,
  type DigitalHealthCheckRecord,
} from '../services/monsterChatRouter';
import { MonsterInteractiveCardView } from './MonsterInteractiveCards';

interface MonsterStandardChatColumnProps {
  sourceTab: 'trash' | 'repair';
  externalQueryTrigger?: { id: number; query: string } | null;
  onHealthRecordAdded: (record: DigitalHealthCheckRecord) => void;
  onJumpToSearch: (keyword: string) => void;
  onToast?: (msg: string) => void;
  onTriggerOsRepair?: (query: string) => void;
  onRepairSymptomDetected?: (query: string) => void;
}

const NOTION_MINIMAL_STARTERS: Array<{ label: string; prompt: string }> = [
  {
    label: '💻 느려짐·사양 점검',
    prompt: '요즘 컴퓨터가 좀 느린데 내 사양이랑 상태 봐줘',
  },
  {
    label: '🧹 바탕화면·설치파일 정리',
    prompt: '바탕화면이랑 다운로드 폴더 정리할 파일 봐줘',
  },
  {
    label: '🕵️ 사라진 파일 찾기',
    prompt: '어제 작업하던 계약서 파일이 사라졌어',
  },
  {
    label: '🕰️ 복원 기록·원복',
    prompt: '최근 복원 기록 보여줘',
  },
  {
    label: '💁 귀신같이 기능 및 요금제',
    prompt: '귀신같이 Ctrl+0 초능력 기능이랑 내 기기 통합 3,900원 혜택 알려줘',
  },
  {
    label: '🎛️ 상용구·보관기간 설정',
    prompt: '복사 기록 한 달(30일) 동안 보관하게 바꿔줘',
  },
  {
    label: '📮 클레임·A/S·아이디어 접수',
    prompt: '아이디어 건의 및 A/S 접수하고 싶은데 내 이름으로 스튜디오에 접수해줘',
  },
  {
    label: '🤝 심층 질문(단골 AI 바톤터치)',
    prompt: '임대차 계약서 독소조항 법률 검토랑 세금 계산 상담해줘',
  },
];

export const MonsterStandardChatColumn: React.FC<MonsterStandardChatColumnProps> = ({
  sourceTab,
  externalQueryTrigger,
  onHealthRecordAdded,
  onJumpToSearch,
  onToast,
  onTriggerOsRepair,
  onRepairSymptomDetected,
}) => {
  const [, setTick] = useState(0);
  const [inputText, setInputText] = useState('');
  const [isMicListening, setIsMicListening] = useState(false);
  const speechRecRef = useRef<any>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const lastHandledTriggerIdRef = useRef<number | null>(null);

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

  const handleSend = async (overrideQuery?: string) => {
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

    try {
      const assistantMsg = await processUnifiedMonsterChatQuery({
        query: raw,
        sourceTab,
        literacyLevel,
        ttsEnabled,
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

  const toggleChatMicRecording = () => {
    if (isMicListening) {
      try {
        speechRecRef.current?.stop();
      } catch {
        /* ignore */
      }
      setIsMicListening(false);
      return;
    }

    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      onToast?.('🎤 브라우저 음성 인식을 지원하지 않는 환경입니다. 아래 입력창에 텍스트로 입력해 주세요.');
      return;
    }

    try {
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = 'ko-KR';
      recognition.interimResults = true;
      recognition.continuous = false;
      speechRecRef.current = recognition;

      let finalTranscript = '';
      recognition.onstart = () => {
        setIsMicListening(true);
      };
      recognition.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interim += transcript;
          }
        }
        const combined = (finalTranscript || interim).trim();
        if (combined) {
          setInputText(combined);
        }
      };
      recognition.onerror = () => {
        setIsMicListening(false);
      };
      recognition.onend = () => {
        setIsMicListening(false);
        const spoken = finalTranscript.trim();
        if (spoken) {
          setInputText('');
          void handleSend(spoken);
        }
      };
      recognition.start();
    } catch {
      setIsMicListening(false);
    }
  };

  useEffect(() => {
    if (
      externalQueryTrigger &&
      externalQueryTrigger.id !== lastHandledTriggerIdRef.current &&
      externalQueryTrigger.query.trim()
    ) {
      lastHandledTriggerIdRef.current = externalQueryTrigger.id;
      void handleSend(externalQueryTrigger.query);
    }
  }, [externalQueryTrigger]);

  // [🎯 찾기] 화면에서 [✋ 손보기] 의도 발화 시 양방향 0토큰 자동 토스 수신
  useEffect(() => {
    const consumePendingToss = () => {
      try {
        const pending = sessionStorage.getItem('ghosti_pending_monster_query');
        if (pending && pending.trim()) {
          sessionStorage.removeItem('ghosti_pending_monster_query');
          void handleSend(pending.trim());
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
        void handleSend(q);
      }
    };
    window.addEventListener('ghosti_toss_to_monster_chat', onTossEvent);
    return () => window.removeEventListener('ghosti_toss_to_monster_chat', onTossEvent);
  }, []);

  return (
    <aside className="flex flex-col h-[calc(100vh-155px)] min-h-[580px] max-h-[840px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/95 shadow-lg overflow-hidden">
      {/* 1. 노션 스타일 미니멀 상단 헤더 */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-slate-800 border border-teal-200 dark:border-slate-700 flex items-center justify-center shrink-0 text-[16px]">
            ✋
          </div>
          <div className="min-w-0">
            <span className="text-[14px] font-extrabold text-slate-900 dark:text-slate-100 truncate block">
              손보기 대화창
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setSharedMonsterTtsEnabled((v) => !v)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-bold flex items-center gap-1 border transition cursor-pointer ${
              ttsEnabled
                ? 'bg-emerald-50 dark:bg-slate-800 border-emerald-300 dark:border-slate-700 text-emerald-800 dark:text-emerald-300'
                : 'bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-400'
            }`}
            title="음성 안내(TTS 읽어주기) 켜기/끄기"
          >
            {ttsEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            {ttsEnabled ? '음성 켜짐' : '음성 꺼짐'}
          </button>

          <button
            type="button"
            onClick={() => resetSharedMonsterChatToWelcome()}
            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-[12px] font-bold flex items-center gap-1 cursor-pointer"
            title="대화 새로 시작"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            새 대화
          </button>
        </div>
      </div>

      {/* 1.5. 상단 슬림 원복 안내 */}
      <div className="px-3.5 py-2 bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-200 dark:border-emerald-500/20 flex items-center gap-1.5 text-[12.5px] text-emerald-900 dark:text-emerald-200">
        <span className="shrink-0 font-bold">🛡️</span>
        <span>
          언제든 <strong className="text-emerald-800 dark:text-emerald-300 font-extrabold">&ldquo;원래대로 돌려줘&rdquo;</strong> 한마디면 즉시 복원됩니다.
        </span>
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
                        onClick={() => void handleSend(sug)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800/90 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-[11.5px] font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer text-left"
                      >
                        💬 {sug}
                      </button>
                    ))}
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

      {/* 2.5. 하단 스타터 칩 바 */}
      <div className="px-3.5 py-2 border-t border-slate-200 dark:border-slate-800/80 bg-slate-100/70 dark:bg-slate-900/80 flex flex-wrap gap-1.5">
        {NOTION_MINIMAL_STARTERS.map((st, idx) => (
          <button
            key={idx}
            type="button"
            disabled={busy}
            onClick={() => void handleSend(st.prompt)}
            className="px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-50 dark:bg-slate-950 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-[11.5px] font-bold text-slate-800 dark:text-slate-200 transition cursor-pointer shadow-2xs"
          >
            {st.label}
          </button>
        ))}
      </div>

      {/* 3. 하단 입력창 + 🎙️ 음성 입력 버튼 ([🎯 찾기]와 동일한 말하기 경험 & 자동 라우팅) */}
      <div className="px-3.5 py-3 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/60">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              isMicListening
                ? '🎙️ 듣고 있습니다... 편하게 말씀해 주세요'
                : '질문이나 요청을 입력하거나 🎙️ 음성으로 말씀해 주세요'
            }
            className="flex-1 px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-emerald-600 focus:outline-none text-[13.5px] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
          />
          <button
            type="button"
            onClick={toggleChatMicRecording}
            disabled={busy}
            title="음성으로 말하기 (찾기·카톡전달·손보기 양방향 자동 연결)"
            className={`px-3 py-2.5 rounded-xl text-[13px] font-extrabold flex items-center gap-1.5 transition shrink-0 cursor-pointer border ${
              isMicListening
                ? 'bg-rose-600 text-white border-rose-500 animate-pulse'
                : 'bg-white hover:bg-emerald-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-emerald-700 dark:text-emerald-300 border-emerald-400/60 dark:border-emerald-500/40'
            }`}
          >
            {isMicListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            <span>{isMicListening ? '듣는중' : '음성'}</span>
          </button>
          <button
            type="submit"
            disabled={busy || !inputText.trim()}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-[13px] font-extrabold flex items-center gap-1.5 transition shrink-0 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            전송
          </button>
        </form>
      </div>
    </aside>
  );
};
