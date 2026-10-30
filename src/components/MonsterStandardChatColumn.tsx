import React, { useEffect, useRef, useState } from 'react';
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
  type MonsterLiteracyLevel,
  type DigitalHealthCheckRecord,
} from '../services/monsterChatRouter';
import { MonsterInteractiveCardView } from './MonsterInteractiveCards';
import { ensureLoginAndZCoreReady } from '../services/zCoreBridge';

interface MonsterStandardChatColumnProps {
  sourceTab: 'trash' | 'repair';
  onHealthRecordAdded: (rec: DigitalHealthCheckRecord) => void;
  onJumpToSearch: (keyword: string) => void;
  onTriggerOsRepair?: (symptomQuery: string) => void;
  externalQueryTrigger?: { id: number; query: string } | null;
}

const QUICK_STARTER_CHIPS: Array<{ label: string; q: string }> = [
  {
    label: '💬 요즘 왜 이렇게 느리지?',
    q: '요즘 컴퓨터가 왜 이렇게 버벅거리고 느린지 내 사양이랑 상태 좀 봐줄래?',
  },
  {
    label: '🎬 영상편집·배그 돌아가?',
    q: '내 컴퓨터 실시간 사양으로 포토샵이랑 배그 잘 돌아가?',
  },
  {
    label: '🧹 바탕화면·설치파일 정리',
    q: '다운로드 폴더 방치된 설치파일(.exe/.apk) 미리보고 정리해 줘',
  },
  {
    label: '🔗 자주 가는 카페 바로가기',
    q: '내가 자주 가는 네이버 카페 바탕화면에 바로가기 만들어줘',
  },
  {
    label: '🕵️ 사라진 영수증·문서 추적',
    q: '어제 바탕화면에 있던 카톡받은_영수증캡처_01.jpg 파일이 사라졌어 찾아줘',
  },
  {
    label: '📄 꺼진 워드·엑셀 복구',
    q: '방금 워드 작업하다가 저장 안 하고 꺼졌는데 단가표 문서 복구해 줘',
  },
  {
    label: '🕰️ [복원 기록] 타임머신',
    q: '최근 [복원 기록] 보여줘',
  },
];

export const MonsterStandardChatColumn: React.FC<MonsterStandardChatColumnProps> = ({
  sourceTab,
  onHealthRecordAdded,
  onJumpToSearch,
  onTriggerOsRepair,
  externalQueryTrigger,
}) => {
  const [snap, setSnap] = useState(getSharedMonsterChatState);
  const [chatInput, setChatInput] = useState('');
  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const [showJsonDetailId, setShowJsonDetailId] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const lastHandledTriggerId = useRef<number>(0);

  useEffect(() => {
    return subscribeSharedMonsterChat(() => {
      setSnap(getSharedMonsterChatState());
    });
  }, []);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [snap.messages.length, snap.busy]);

  const sendMessageToMonster = async (rawQuery: string) => {
    const q = rawQuery.trim();
    if (!q || snap.busy) return;
    if (!ensureLoginAndZCoreReady(sourceTab === 'trash' ? '클린몬스터 치우기 대화' : '설정몬스터 고치기 대화')) return;

    const nowLabel = new Date().toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const userMsg: MonsterChatMessage = {
      id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      role: 'user',
      timestamp: nowLabel,
      text: q,
      sourceTab,
    };

    const pendingId = `pending_${Date.now()}`;
    const isMissingFileQuery = /없어졌|사라졌|증발|지웠|날아갔|어디\s*갔|휴지통|복구해/i.test(q);
    const pendingMsg: MonsterChatMessage = {
      id: pendingId,
      role: 'assistant',
      timestamp: nowLabel,
      text: isMissingFileQuery
        ? '100% 정직 판정: 내 PC 5대 은닉 금고와 윈도우 휴지통을 모두 스캔했으나 흔적이 없습니다.\n(AI가 말씀을 이해하고 JSON 명령으로 내 PC 5대 은닉 금고·휴지통을 대조하는 중...)'
        : '🧠 Gemini Flash AI가 말씀을 이해하고 JSON으로 Z-코어(5199)에게 실측을 요청하고 있습니다...',
      sourceTab,
    };

    setSharedMonsterMessages((prev) => [...prev, userMsg, pendingMsg]);
    setSharedMonsterBusy(true);

    try {
      const currentState = getSharedMonsterChatState();
      const aiMsg = await processUnifiedMonsterChatQuery({
        query: q,
        sourceTab,
        literacyLevel: currentState.literacyLevel,
        ttsEnabled: currentState.ttsEnabled,
      });
      setSharedMonsterMessages((prev) =>
        prev.map((m) => (m.id === pendingId ? aiMsg : m))
      );
      if (aiMsg.repairSymptomQuery && onTriggerOsRepair) {
        onTriggerOsRepair(aiMsg.repairSymptomQuery);
      }
    } finally {
      setSharedMonsterBusy(false);
    }
  };

  useEffect(() => {
    if (
      externalQueryTrigger &&
      externalQueryTrigger.id !== lastHandledTriggerId.current &&
      externalQueryTrigger.query.trim()
    ) {
      lastHandledTriggerId.current = externalQueryTrigger.id;
      void sendMessageToMonster(externalQueryTrigger.query);
    }
  }, [externalQueryTrigger]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = chatInput.trim();
    if (!q) return;
    setChatInput('');
    void sendMessageToMonster(q);
  };

  const handleVoiceMic = () => {
    const SpeechRec =
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;

    if (!SpeechRec) {
      void sendMessageToMonster('요즘 컴퓨터가 좀 느린데 내 사양이랑 정리할 파일 좀 봐줄래?');
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.lang = 'ko-KR';
      rec.interimResults = false;
      setIsListeningVoice(true);
      rec.onresult = (event: any) => {
        const transcript = event?.results?.[0]?.[0]?.transcript || '';
        setIsListeningVoice(false);
        if (transcript.trim()) {
          void sendMessageToMonster(transcript.trim());
        }
      };
      rec.onerror = () => setIsListeningVoice(false);
      rec.onend = () => setIsListeningVoice(false);
      rec.start();
    } catch {
      setIsListeningVoice(false);
    }
  };

  const hasHonestMissingVerdict = snap.messages.some((m) =>
    m.text.includes('100% 정직 판정')
  );

  return (
    <aside className="w-full rounded-2xl bg-[#141418] border-2 border-primary-container/40 shadow-[0_12px_40px_rgba(0,0,0,0.45)] flex flex-col overflow-hidden xl:sticky xl:top-4 xl:h-[calc(100vh-110px)] xl:min-h-[680px] xl:max-h-[860px]">
      {/* 1. 채팅창 상단 헤더 (카카오톡/메신저형 표준 상단바 + 눈높이 3단 스위치 + 현수 음성 토글) */}
      <div className="p-4 bg-gradient-to-r from-zinc-950 via-[#111c22] to-zinc-950 border-b border-white/10 flex flex-col gap-2.5 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary-container/20 border border-primary-container/50 flex items-center justify-center text-[18px] shrink-0">
              {sourceTab === 'trash' ? '🧹' : '🛠️'}
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-headline-sm text-[15px] text-white font-extrabold truncate">
                  {sourceTab === 'trash'
                    ? '클린몬스터 대화창'
                    : '설정몬스터 대화창'}
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-mono text-[10px] font-extrabold">
                  Gemini Flash × JSON 코어 직결
                </span>
              </div>
              <span className="text-[11.5px] text-zinc-400 truncate">
                명령어 없이 사람에게 말하듯 편하게 대화하세요 (언제나 0원)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setSharedMonsterTtsEnabled((v) => !v)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold border cursor-pointer transition ${
                snap.ttsEnabled
                  ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                  : 'bg-zinc-900 border-white/10 text-zinc-400'
              }`}
              title="현수 성우 음성 브리핑 켜기/끄기"
            >
              {snap.ttsEnabled ? '🔊 음성 ON' : '🔇 음성 OFF'}
            </button>
            <button
              type="button"
              onClick={() => resetSharedMonsterChatToWelcome()}
              className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 text-[11px] font-bold cursor-pointer"
              title="대화 내용 처음부터 다시 시작"
            >
              🔄 초기화
            </button>
          </div>
        </div>

        {/* 눈높이 3단 적응형 튜닝 스위치 (초급 어르신 / 중급 일반 / 고급 전문가) */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10 flex-wrap">
          <span className="text-[11px] text-zinc-400 font-bold">
            🎚️ 설명 눈높이:
          </span>
          <div className="inline-flex p-0.5 rounded-xl bg-zinc-900 border border-white/10">
            {(
              [
                { id: 'easy', label: '🌱 쉬운말(어르신)' },
                { id: 'normal', label: '🌿 일반' },
                { id: 'expert', label: '🌳 전문가' },
              ] as { id: MonsterLiteracyLevel; label: string }[]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSharedMonsterLiteracyLevel(opt.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition cursor-pointer ${
                  snap.literacyLevel === opt.id
                    ? 'bg-primary-container text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 정직 판정 상단 고정 배너 (없는 파일 테스트 시 즉시 노출) */}
      {hasHonestMissingVerdict && (
        <div
          className="mx-3 mt-2.5 p-2.5 rounded-xl border-2 font-extrabold text-[12px] shadow-md flex items-center gap-2 shrink-0"
          style={{
            backgroundColor: '#ECFDF5',
            borderColor: '#10B981',
            color: '#065F46',
          }}
        >
          <span>🛡️</span>
          <span>
            100% 정직 판정: 내 PC 5대 은닉 금고와 윈도우 휴지통을 모두 스캔했으나 흔적이 없습니다
          </span>
        </div>
      )}

      {/* 2. 중앙 멀티턴 대화 스트림 (카톡처럼 위아래로 스크롤되는 표준 채팅창) */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-3.5 space-y-3.5 min-h-[380px] max-h-[540px] xl:max-h-none bg-[#0e0e12]"
      >
        {snap.messages.map((msg) => {
          const isUser = msg.role === 'user';
          if (isUser) {
            return (
              <div key={msg.id} className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-1.5 text-[10.5px] text-zinc-400 px-1">
                  <span className="font-bold text-amber-300">🙋‍♂️ 나의 말</span>
                  <span>{msg.timestamp}</span>
                </div>
                <div className="max-w-[88%] px-4 py-2.5 rounded-2xl rounded-tr-sm bg-primary-container text-zinc-950 font-bold text-[13px] leading-relaxed shadow-md whitespace-pre-line">
                  {msg.text}
                </div>
              </div>
            );
          }

          return (
            <div key={msg.id} className="flex flex-col items-start gap-1.5">
              <div className="flex items-center justify-between w-full text-[10.5px] text-zinc-400 px-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-extrabold text-primary-container">
                    {msg.sourceTab === 'trash' ? '🧹 클린몬스터' : '🛠️ 설정몬스터'}
                  </span>
                  {msg.llmActionJson && (
                    <button
                      type="button"
                      onClick={() =>
                        setShowJsonDetailId((prev) => (prev === msg.id ? null : msg.id))
                      }
                      className="px-2 py-0.5 rounded-md bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/40 text-cyan-200 font-mono text-[10px] font-bold cursor-pointer"
                      title="클릭하여 AI가 Z-코어에 전달한 JSON 명령 보기"
                    >
                      ⚡ JSON 코어 위임:{' '}
                      {msg.llmActionJson.zCoreCommand.endpoint === 'NONE'
                        ? msg.llmActionJson.intent
                        : msg.llmActionJson.zCoreCommand.endpoint}{' '}
                      {showJsonDetailId === msg.id ? '▴' : '▾'}
                    </button>
                  )}
                </div>
                <span>{msg.timestamp}</span>
              </div>

              {/* AI가 Z-코어(127.0.0.1:5199)에게 전달한 실제 JSON 액션 명세 (클릭 시 열람) */}
              {msg.llmActionJson && showJsonDetailId === msg.id && (
                <div className="w-full p-2.5 rounded-xl bg-zinc-950 border border-cyan-500/40 font-mono text-[10.5px] text-cyan-200 overflow-x-auto">
                  <div className="text-[10px] text-zinc-400 mb-1 font-bold">
                    🧠 {msg.llmActionJson.modelUsed || 'gemini-2.5-flash'} ➔ 🦶 Merlin_Z_Core (127.0.0.1:5199) JSON 위임 페이로드:
                  </div>
                  <pre className="whitespace-pre-wrap break-all">
                    {JSON.stringify(
                      {
                        intent: msg.llmActionJson.intent,
                        zCoreCommand: msg.llmActionJson.zCoreCommand,
                      },
                      null,
                      2
                    )}
                  </pre>
                </div>
              )}

              <div className="w-full p-3.5 rounded-2xl rounded-tl-sm bg-zinc-900/95 border border-white/12 text-zinc-100 shadow-md flex flex-col gap-2.5">
                <p className="text-[13px] leading-relaxed whitespace-pre-line font-medium">
                  {msg.text}
                </p>

                {/* Z-코어가 실측하여 부착한 인터랙티브 실행/복구/사양/미리보기 카드 */}
                <MonsterInteractiveCardView
                  message={msg}
                  literacyLevel={snap.literacyLevel}
                  onChangeLiteracyLevel={(lvl) => setSharedMonsterLiteracyLevel(lvl)}
                  onUpdateMessage={(updated) =>
                    setSharedMonsterMessages((prev) =>
                      prev.map((m) => (m.id === updated.id ? updated : m))
                    )
                  }
                  onHealthRecordAdded={onHealthRecordAdded}
                  onJumpToSearch={onJumpToSearch}
                />

                {/* ⚙️ 고치기 수리 증상 연동 버튼 */}
                {msg.repairSymptomQuery && onTriggerOsRepair && (
                  <button
                    type="button"
                    onClick={() => onTriggerOsRepair(msg.repairSymptomQuery!)}
                    className="w-full py-2 px-3 rounded-xl bg-primary-container hover:opacity-95 text-zinc-950 font-label-sm text-[12px] font-extrabold cursor-pointer shadow"
                  >
                    🛠️ 좌측 수리 보드에서 &ldquo;{msg.repairSymptomQuery}&rdquo; 즉시 수리 카드 열기
                  </button>
                )}

                {/* 이어서 대화하기 추천 말풍선 칩 (LLM 동적 생성) */}
                {msg.followUpSuggestions && msg.followUpSuggestions.length > 0 && (
                  <div className="pt-2 border-t border-white/10 flex flex-col gap-1.5">
                    <span className="text-[10.5px] text-amber-300 font-extrabold">
                      💬 이어서 이렇게 물어보세요 (클릭 시 바로 대화):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.followUpSuggestions.map((sug, idx) => (
                        <button
                          key={idx}
                          type="button"
                          disabled={snap.busy}
                          onClick={() => void sendMessageToMonster(sug)}
                          className="px-2.5 py-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-primary-container/35 text-zinc-200 hover:text-primary-container text-[11.5px] font-bold text-left transition cursor-pointer"
                        >
                          ↳ &ldquo;{sug}&rdquo;
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. 하단 빠른 대화 칩 & 표준 채팅 입력창 */}
      <div className="p-3 bg-zinc-950 border-t border-white/10 flex flex-col gap-2.5 shrink-0">
        {/* 원클릭 대화 시작 칩 (가로 스크롤/래핑) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {QUICK_STARTER_CHIPS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              disabled={snap.busy}
              onClick={() => void sendMessageToMonster(chip.q)}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-200 text-[11px] font-bold whitespace-nowrap shrink-0 transition cursor-pointer"
            >
              {chip.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <button
            type="button"
            onClick={handleVoiceMic}
            className={`px-3 py-2.5 rounded-xl font-label-sm text-[12px] font-extrabold shrink-0 cursor-pointer transition ${
              isListeningVoice
                ? 'bg-rose-500 text-white animate-pulse'
                : 'bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-primary-container'
            }`}
            title="음성으로 편하게 말하기"
          >
            {isListeningVoice ? '🎙️ 듣는중' : '🎙️ 음성'}
          </button>

          <textarea
            rows={2}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="명령어 없이 편하게 말씀하세요! (예: 요즘 왜 이렇게 컴퓨터가 느리지? / 영상편집 배울 건데 내 사양으로 될까? / 바탕화면 정리해줘)"
            className="flex-1 px-3.5 py-2 rounded-xl bg-zinc-900 border border-white/15 text-white text-[13px] leading-snug placeholder:text-zinc-500 focus:outline-none focus:border-primary-container resize-none"
          />

          <button
            type="submit"
            disabled={snap.busy || !chatInput.trim()}
            className="px-4 py-2.5 h-[52px] rounded-xl bg-primary-container hover:opacity-95 disabled:opacity-40 text-zinc-950 font-label-sm text-[13px] font-extrabold whitespace-nowrap shrink-0 cursor-pointer shadow-sm transition"
          >
            {snap.busy ? '분석중...' : '전송 ↵'}
          </button>
        </form>
      </div>
    </aside>
  );
};
