import React, { useEffect, useRef, useState } from 'react';
import {
  Send,
  Volume2,
  VolumeX,
  RotateCcw,
  Bot,
  User,
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
    label: '💁‍♂️ 귀신같이 기능·요금 안내',
    prompt: '귀신같이 Ctrl+0 초능력 기능이랑 내 기기 통합 3,900원 혜택 알려줘',
  },
  {
    label: '🎛️ 말로 앱 설정·상용구 변경',
    prompt: '복사 기록 한 달(30일) 동안 보관하게 바꿔줘',
  },
  {
    label: '📮 클레임·A/S·아이디어 접수',
    prompt: '아이디어 건의 및 A/S 접수하고 싶은데 내 이름으로 스튜디오에 접수해줘',
  },
  {
    label: '🕰️ 복원 기록·원복',
    prompt: '최근 복원 기록 보여줘',
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
    } finally {
      setSharedMonsterBusy(false);
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
            title="음성 안내 켜기/끄기"
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
                {msg.text}

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

      {/* 3. 하단 입력창 */}
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
            placeholder="질문이나 요청을 편하게 입력해 주세요 (예: 컴퓨터 정리해줘)"
            className="flex-1 px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-emerald-600 focus:outline-none text-[13.5px] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
          />
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
