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
    label: '🕵️ 사라진 파일 찾기',
    prompt: '어제 보던 파일이 사라졌는데 찾아줘',
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
    <aside className="flex flex-col h-[calc(100vh-155px)] min-h-[580px] max-h-[840px] rounded-2xl border border-slate-800 bg-slate-950/95 shadow-xl overflow-hidden">
      {/* 1. 노션 스타일 미니멀 상단 헤더 */}
      <div className="px-4 py-3 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
            <Bot className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold text-slate-100 truncate block">
              치우기 · 고치기 대화창
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setSharedMonsterTtsEnabled((v) => !v)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 border transition ${
              ttsEnabled
                ? 'bg-slate-800 border-slate-700 text-emerald-300'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
            title="음성 안내 켜기/끄기"
          >
            {ttsEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            {ttsEnabled ? '음성 켜짐' : '음성 꺼짐'}
          </button>

          <button
            type="button"
            onClick={() => resetSharedMonsterChatToWelcome()}
            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 text-[11px] font-semibold flex items-center gap-1"
            title="대화 새로 시작"
          >
            <RotateCcw className="w-3 h-3" />
            새 대화
          </button>
        </div>
      </div>

      {/* 2. 본문 대화 스트림 (노션 스타일 미니멀 버블) */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5"
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
                    <span className="text-[10px] text-slate-500">{msg.timestamp}</span>
                    <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                      나 <User className="w-3 h-3" />
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                      <Bot className="w-3 h-3" /> 귀신같이 비서
                    </span>
                    <span className="text-[10px] text-slate-500">{msg.timestamp}</span>
                  </>
                )}
              </div>

              <div
                className={`max-w-[95%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-line ${
                  isUser
                    ? 'bg-slate-800 text-slate-100 rounded-tr-sm border border-slate-700'
                    : 'bg-slate-900/90 border border-slate-800 text-slate-100 rounded-tl-sm'
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
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 px-2 py-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            확인하고 있습니다...
          </div>
        )}
      </div>

      {/* 3. 하단 핵심 가이드 칩 (4개) + 입력창 */}
      <div className="px-3.5 py-3 border-t border-slate-800/80 bg-slate-900/60 space-y-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          {NOTION_MINIMAL_STARTERS.map((q) => (
            <button
              key={q.label}
              type="button"
              disabled={busy}
              onClick={() => void handleSend(q.prompt)}
              className="shrink-0 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-[11px] font-medium transition disabled:opacity-40"
            >
              {q.label}
            </button>
          ))}
        </div>

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
            placeholder='질문이나 승인("응 진행해") · 원복("방금 한 거 되돌려줘")을 입력해 주세요'
            className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-emerald-500/60 focus:outline-none text-xs text-white placeholder-slate-500"
          />
          <button
            type="submit"
            disabled={busy || !inputText.trim()}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 transition shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            전송
          </button>
        </form>
      </div>
    </aside>
  );
};
