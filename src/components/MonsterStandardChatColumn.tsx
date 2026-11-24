import React, { useEffect, useRef, useState } from 'react';
import {
  Send,
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
import { detectAgentCareIntent, getLastCareScanContext } from '../services/ghostCareAgentEngine';
import { flushUnmatchedQuestionsToCloud } from '../services/ghostPassportSync';
import {
  unlockMobileAudioOnUserGesture,
  notifyMicSessionEndedForTts,
  isMobileVoiceEnvironment,
} from '../services/setupMonsterTts';
import { transcribeAudioBlobViaCloud } from '../services/aiEngine';
import { normalizeSpokenKoreanQuery } from '../services/voiceSearchAndAiBatonEngine';
import { useSaySeeStore } from '../store/useSaySeeStore';
import { getZCoreUrl, hasActiveGhostiLoginSession, zCoreBridge } from '../services/zCoreBridge';
import {
  PC_MONSTER_ROLLING_PLACEHOLDERS_10,
  MOBILE_CLEAN_ROLLING_PLACEHOLDERS_10,
  getAndAdvanceSessionPlaceholderStartIndex,
  PLACEHOLDER_ROLLING_INTERVAL_MS,
  evaluateDualProactiveCareEngine,
  loadWeeklyCareSchedule,
  formatScheduleLabelKo,
} from '../services/weeklyCareAndPlaceholderEngine';
import {
  GHOST_SECRETARY_AVATAR_SRC,
  GHOST_SECRETARY_NAME,
  buildWelcomeTurn,
  buildColdReadingText,
  collectColdReadingContext,
  resolveGhostSecretaryTurn,
  loadGhostSecretaryState,
  saveGhostSecretaryState,
  loadGhostPassportBook,
  saveGhostPassportBook,
  setPassportSelf,
  questPromptFor,
  logUnmatchedQuestion,
  loadUnmatchedQuestions,
  canKnockToday,
  todayKey,
  executeMobileSteppingStoneScan,
  buildMobileRemainingPhotosChoicePrompt,
  buildMobileToPcBridgePrompt,
  findScenario,
  renderPlaybookText,
  isImpatientIntent,
  isStoreLinkIntent,
  isYes,
  isNo,
  parseNicknameSettingIntent,
  normalizeSuggestionChipTone,
  type GhostSecretaryState,
} from '../services/ghostSecretaryEngine';
import {
  pushGhostPassportsToCloud,
  pullGhostPassportsFromCloud,
  buildPassportExtrasFromClusters,
  reconcileCloudPassportsWithFaceClusters,
} from '../services/ghostPassportSync';
import { isOnDeviceFaceScanRunning } from '../services/ai/onDeviceFacePassportEngine';
import {
  PASSPORT_MIN_FACE_PHOTOS_FOR_ASK,
  PASSPORT_REG_DONE_EVENT,
  PASSPORT_REG_STATE_EVENT,
  PASSPORT_SCAN_FINISHED_EVENT,
  consumeQueuedUserPassportWait,
  countFacePhotos,
  familyCandidates,
  findSelfCluster,
  getConfirmedSelfPassportView,
  loadPassportRegState,
  markFirstOfferShown,
  markPassportPrompted,
  matchPassportRegCommand,
  openPassportRegistration,
  passportPromptForActivity,
  passportUnavailableReason,
  peekQueuedUserPassportWait,
  rankFaceClusters,
  summarizePassportPending,
  type PassportRegMode,
} from '../services/passportRegistrationFlow';

/** [D-35] 여권 등록 카드 선택지 (유저 화면 용어: '여권'만 사용) */
const PASSPORT_CHIP_OPEN_SELF = '여권사진 확인하기';
const PASSPORT_CHIP_OPEN_FAMILY = '가족 사진도 등록할래';
const PASSPORT_CHIP_LATER = '다음에 할게';

/** [v1.3] 내 컴퓨터 연결 직후 자동 실행할 1단계 분석 문구 — 멋대로 삭제하지 않고 실측 사양 + 속도 저하 범인(상주 보안모듈·애드웨어) 분석표를 먼저 제시 */
const SECRETARY_FIRST_CARE_QUERY = '요즘 컴퓨터가 좀 느린데 내 사양이랑 누가 속도 잡아먹는지 분석해줘';

/** 이미 타이핑 연출이 완료된 귀신비서 메시지 ID 캐시 (탭 전환·리렌더 시 중복 재생 방지) */
const completedSecretaryAnimIds = new Set<string>();

function splitSecretarySentences(raw: string): string[] {
  const clean = raw.replace(/\*\*/g, '');
  const lines = clean.split('\n');
  const out: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      out.push('');
      continue;
    }
    const parts = line
      .split(/(?<=[.!?~요다죠네])\s+(?=\S)/)
      .map((p) => p.trimEnd())
      .filter((p) => p.length > 0);
    if (parts.length > 0) {
      out.push(...parts);
    } else {
      out.push(line);
    }
  }
  return out.length > 0 ? out : [clean];
}

const AnimatedSecretaryText: React.FC<{
  messageId: string;
  text: string;
  onProgressScroll?: () => void;
  onComplete?: () => void;
}> = ({ messageId, text, onProgressScroll, onComplete }) => {
  const sentences = React.useMemo(() => splitSecretarySentences(text), [text]);
  const alreadyDone =
    completedSecretaryAnimIds.has(messageId) ||
    (typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

  const [visibleCount, setVisibleCount] = useState<number>(() =>
    alreadyDone ? sentences.length : 1
  );
  const [done, setDone] = useState<boolean>(alreadyDone);

  // 부모 리렌더(타이핑·플레이스홀더 롤링 등)로 콜백 참조가 바뀌어도 타이머가 절대 취소되지 않도록 ref로 보관
  const onProgressScrollRef = useRef(onProgressScroll);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onProgressScrollRef.current = onProgressScroll;
    onCompleteRef.current = onComplete;
  });

  // 외부(유저 새 질문 전송 등)에서 이미 완료 처리된 경우 즉시 동기화
  useEffect(() => {
    if (!done && completedSecretaryAnimIds.has(messageId)) {
      setVisibleCount(sentences.length);
      setDone(true);
    }
  });

  useEffect(() => {
    if (done) {
      completedSecretaryAnimIds.add(messageId);
      onCompleteRef.current?.();
      return;
    }
    if (visibleCount >= sentences.length) {
      const finishTimer = window.setTimeout(() => {
        completedSecretaryAnimIds.add(messageId);
        setDone(true);
        onProgressScrollRef.current?.();
        onCompleteRef.current?.();
      }, 80);
      return () => window.clearTimeout(finishTimer);
    }

    const nextSentence = sentences[visibleCount] ?? '';
    // 체감 답답함 없이 빠르고 경쾌하게 한 문장씩 등장 (빈 줄 45ms, 장문 브리핑 75ms, 일반 110ms)
    const delayMs = nextSentence.length === 0 ? 45 : sentences.length > 4 ? 75 : 110;
    const t = window.setTimeout(() => {
      setVisibleCount((c) => c + 1);
      onProgressScrollRef.current?.();
    }, delayMs);
    return () => window.clearTimeout(t);
  }, [done, visibleCount, sentences.length, messageId]);

  const handleSkip = () => {
    if (done) return;
    completedSecretaryAnimIds.add(messageId);
    setVisibleCount(sentences.length);
    setDone(true);
    onProgressScrollRef.current?.();
    onCompleteRef.current?.();
  };

  if (done) {
    return <>{text.replace(/\*\*/g, '')}</>;
  }

  return (
    <div onClick={handleSkip} title="클릭하면 전체 문장을 바로 볼 수 있어요" className="cursor-pointer space-y-0.5">
      {sentences.slice(0, visibleCount).map((line, idx) => {
        if (line === '') {
          return <div key={idx} className="h-2" />;
        }
        return (
          <div
            key={idx}
            className="animate-[fadeIn_0.35s_ease-out]"
          >
            {line}
          </div>
        );
      })}
    </div>
  );
};

function nowTimeKo(): string {
  return new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function secretaryOwnerEmail(): string {
  return useSaySeeStore.getState().merlinAuth?.email || '';
}

/** 홀림 퀘스트 마지막(차 안 음성검색 안내) 직후 → 🪪 여권(내 사진) 확인 제안 또는 업무용 PC 자동 패스 (모바일은 100→300→500장 징검다리 스캔 연결) */
function buildPassportEntryTurn(
  st: GhostSecretaryState,
  isMobileEnv = false
): { text: string; followUps?: string[]; nextState: GhostSecretaryState } {
  const state = useSaySeeStore.getState();
  const clusters = state.faceClusters || [];
  const photos = state.photos || [];
  const nickname = st.nickname || '';

  let nextSt: GhostSecretaryState = { ...st };
  let effectiveFacePhotos = countFacePhotos(clusters);

  if (isMobileEnv) {
    const orderedPhotos = photos
      .filter((p) => !p.quarantined)
      .slice()
      .sort((a, b) => (b.mtimeMs || 0) - (a.mtimeMs || 0));
    const totalMobilePhotos = Math.max(orderedPhotos.length, effectiveFacePhotos);
    const faceFileSet = new Set<string>();
    clusters
      .filter((c) => !c.excludedAsPasserby)
      .forEach((c) => (c.matchedPhotoFiles || []).forEach((f) => faceFileSet.add(f)));

    const stepping = executeMobileSteppingStoneScan({
      totalPhotoCount: totalMobilePhotos,
      countFacesInWindow: (windowLimit) => {
        const slice = orderedPhotos.slice(0, windowLimit);
        const matchedInSlice = slice.filter(
          (p) => faceFileSet.has(p.name) || (p.tags || []).some((t) => /인물|가족|얼굴|셀카/.test(t))
        ).length;
        if (matchedInSlice > 0) return matchedInSlice;
        return windowLimit >= 100 ? effectiveFacePhotos : 0;
      },
      minFacesToStop: 1,
    });
    effectiveFacePhotos = Math.max(effectiveFacePhotos, stepping.foundFacesCount);
    nextSt = {
      ...nextSt,
      mobileSteppingStoneScanned: stepping.scannedPhotos,
      mobileRemainingOldPhotos: stepping.remainingOldPhotos,
    };
  }

  // [D-35] 첫날엔 '내 사진'만 조용히 확인받는다 (본인·가족 공통 동일 인물 3장 이상 단일 기준)
  const pending = summarizePassportPending();
  const hasSelfToAsk = pending.needsSelfPick || pending.selfPendingCount > 0;
  if (hasSelfToAsk) {
    markFirstOfferShown();
    return {
      text: buildPassportSelfOfferText(nickname),
      followUps: [PASSPORT_CHIP_OPEN_SELF, PASSPORT_CHIP_LATER],
      nextState: { ...nextSt, passportStep: 'done' },
    };
  }
  return {
    text: `${nickname}님, 기본 세팅은 다 끝났습니다. 이제 귀신검색에서 내 파일을 바로 찾아보실 수 있습니다.`,
    nextState: { ...nextSt, passportStep: 'skipped' },
  };
}

function buildPassportSelfOfferText(nickname: string): string {
  const who = nickname ? `${nickname}님` : '회원님';
  return `**시기별 여권사진 등록**\n사진에서 ${who}으로 보이는 얼굴을 찾았습니다. 확인해 보실까요?`;
}

function buildPassportFamilyOfferText(): string {
  return `**시기별 여권사진 등록**\n가족으로 보이는 사진도 등록할까요?`;
}

/** 여권 등록 직후 계정 동기화(명시적 동의 시에만 실제 업로드) */
function syncPassportAfterRegistration(): void {
  const store = useSaySeeStore.getState();
  const book = loadGhostPassportBook();
  const names = new Set<string>([
    ...(book.self ? [(book.self.realName || book.self.nickname || '').trim()] : []),
    ...book.members.map((m) => m.realName),
  ]);
  const named = (store.faceClusters || [])
    .filter((c) => c.registeredName && names.has(c.registeredName.trim()))
    .map((c) => ({ name: c.registeredName.trim(), seedVecPreview: c.seedVecPreview, avatarUrl: c.avatarUrl, cropUrl: c.cropUrl }));
  void pushGhostPassportsToCloud(
    secretaryOwnerEmail(),
    isMobileVoiceEnvironment() ? 'mobile' : 'pc',
    buildPassportExtrasFromClusters(named)
  );
}

function passportOfferWasLast(lastAssistantText: string): boolean {
  return /시기별\s*(?:다양한\s*)?여권사진\s*등록/.test(lastAssistantText || '');
}

/**
 * [D-35] 여권 등록 명령 · 카드 선택지 즉시 처리
 *  - "여권 등록", "내 사진 등록", "가족 얼굴 등록하자" 등 → 왼쪽 등록 화면 즉시 오픈
 *  - 미연결·스캔 중·후보 없음 → 지어내지 않고 정직하게 안내
 *  - 카드의 [다음에 할게] → 조용히 물러남 (다음 사진 활동 때 다시)
 */
function resolvePassportCommandReply(
  raw: string,
  sourceTab: 'trash' | 'repair',
  lastAssistantText: string
): MonsterChatMessage | null {
  const text = (raw || '').trim();
  const nickname = (loadGhostSecretaryState().nickname || '').trim();
  const nickPrefix = nickname ? `${nickname}님, ` : '';
  const base = { role: 'assistant' as const, timestamp: nowTimeKo(), sourceTab };

  if (text === PASSPORT_CHIP_LATER && passportOfferWasLast(lastAssistantText)) {
    return {
      ...base,
      id: `secretary_passport_later_${Date.now()}`,
      text: `네, ${nickPrefix}다음에 사진 보실 때 다시 안내해 드릴게요.\n귀신검색에서 내 파일을 찾아보실 수 있습니다.`,
      followUpSuggestions: ['귀신검색으로 내 파일 찾아볼래'],
    };
  }

  let mode: PassportRegMode | null = null;
  if (text === PASSPORT_CHIP_OPEN_SELF || text === '🪪 여권사진 확인하기') mode = 'self';
  else if (text === PASSPORT_CHIP_OPEN_FAMILY || text === '👨‍👩‍👧 가족 사진도 등록할래') mode = 'family';
  else mode = matchPassportRegCommand(text);
  if (!mode) return null;

  const unavailable = passportUnavailableReason(mode, nickname, zCoreBridge.isConnected);
  if (unavailable) {
    return { ...base, id: `secretary_passport_unavailable_${Date.now()}`, text: unavailable };
  }

  const { selfCluster: self, cuts: confirmedSelfCuts, regState: regSt } = getConfirmedSelfPassportView();
  // 가족을 원해도 '나'를 아직 고르지 않았다면 내 얼굴부터 자연스럽게
  const openMode: PassportRegMode = mode === 'family' && !self ? 'self' : mode;
  const pending = summarizePassportPending(regSt);
  const hasRealName = Boolean((loadGhostPassportBook().self?.realName || '').trim());
  const nothingForSelf =
    openMode === 'self' &&
    Boolean(self || confirmedSelfCuts.length > 0) &&
    confirmedSelfCuts.length > 0 &&
    pending.selfPendingCount === 0 &&
    hasRealName;
  if (nothingForSelf) {
    if (pending.familyPersonCount > 0) {
      openPassportRegistration('family');
      markPassportPrompted();
      return {
        ...base,
        id: `secretary_passport_open_family_${Date.now()}`,
        text: `${nickPrefix}내 여권 사진은 이미 등록되어 있어, 이어서 가족 후보 화면을 왼쪽에 띄워 드렸습니다. 이름을 적거나 아닌 사진만 빼고 [등록]을 눌러주세요.`,
      };
    }
    return {
      ...base,
      id: `secretary_passport_done_${Date.now()}`,
      text: `${nickPrefix}지금 찾은 사진은 모두 등록되어 있습니다. 새 사진이 생기면 자동으로 찾아둘게요.`,
    };
  }

  openPassportRegistration(openMode);
  markPassportPrompted();
  const guide =
    openMode === 'self' && !self
      ? mode === 'family'
        ? `가족 등록 전에 ${nickname ? `${nickname}님` : '내'} 얼굴부터 왼쪽 화면에서 선택해 주세요.`
        : `왼쪽 화면에 띄워 드렸습니다. ${nickname ? `${nickname}님` : '내'} 얼굴을 선택해 주세요.`
      : `왼쪽 화면에 띄워 드렸습니다. 아닌 사진만 제외하고 [등록]을 눌러주세요.`;
  return { ...base, id: `secretary_passport_open_${Date.now()}`, text: guide };
}

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
  // PC 창을 좁게 줄였을 때도 음성/성우 UI가 절대 노출되지 않도록 실제 모바일 기기(UA/네이티브 앱)만 모바일로 판별
  const isMobileOrStore =
    Boolean(isStoreAppMode) || layout === 'mobile' || isMobileVoiceEnvironment();

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
  const [awaitingNickname, setAwaitingNickname] = useState<boolean>(() => !loadGhostSecretaryState().nickname);
  const [welcomeChipsDismissed, setWelcomeChipsDismissed] = useState<boolean>(false);
  const [isZCoreLive, setIsZCoreLive] = useState<boolean>(zCoreBridge.isConnected);

  useEffect(() => {
    setIsZCoreLive(zCoreBridge.isConnected);
    return zCoreBridge.subscribe((conn) => setIsZCoreLive(conn));
  }, []);

  // [v1.3 귀신비서 1관문] 첫 환영 말풍선: 별명 미등록 시 대본집 ask_nickname_first, 등록 시 별명 호칭 인사
  const pendingReturnShareRoom = useSaySeeStore((s) => s.pendingReturnShareRoom);
  const returnToSharedRoomAndOpenUpload = useSaySeeStore((s) => s.returnToSharedRoomAndOpenUpload);

  useEffect(() => {
    if (sourceTab !== 'trash') return;
    const refreshWelcomeForSecretary = () => {
      const t = buildWelcomeTurn(loadGhostSecretaryState(), isMobileOrStore);
      saveGhostSecretaryState(t.nextState);
      setAwaitingNickname(Boolean(t.nextState.awaitingNickname));
      setWelcomeChipsDismissed(false);
      setSharedMonsterMessages((prev) =>
        prev.map((m) => (m.id === 'monster_welcome_init' && prev.length === 1 ? { ...m, text: t.text } : m))
      );
      return t;
    };
    const turn = refreshWelcomeForSecretary();
    const onJumpRefresh = () => {
      refreshWelcomeForSecretary();
    };
    window.addEventListener('ghosti_jump_to_secretary', onJumpRefresh);
    window.addEventListener('merlinSessionExpired', onJumpRefresh);
    window.addEventListener('merlinLoggedIn', onJumpRefresh);
    window.addEventListener('ghostiSupabaseUserSynced', onJumpRefresh);

    // [Stage 1: 최초 1회 은행 보안프로그램 속도 저하 브리핑 & 1회성 동의 칩 (한 턴 연타 금지 · 호흡 분리)]
    if (
      !isMobileOrStore &&
      zCoreBridge.isConnected &&
      !turn.nextState.awaitingNickname &&
      !turn.nextState.consents?.bankSecurityAutoSleep &&
      !turn.nextState.bankSleepIntroShownAt
    ) {
      void fetch(getZCoreUrl('/api/care/security-services/status'))
        .then((r) => r.json())
        .catch(() => null)
        .then((secRes) => {
          if (!secRes || secRes.ok === false) return;
          const curSt = loadGhostSecretaryState();
          if (curSt.bankSleepIntroShownAt || curSt.consents?.bankSecurityAutoSleep) return;
          const activeCount = Math.max(0, Number(secRes?.activeCount ?? 0));
          const ramMb = Math.max(0, Number(secRes?.estimatedRamMb ?? 0));
          const nickLabel = curSt.nickname ? `${curSt.nickname}님, ` : '';
          saveGhostSecretaryState({
            ...curSt,
            bankSleepIntroShownAt: new Date().toISOString(),
          });
          const introText =
            activeCount > 0
              ? `${nickLabel}컴퓨터 백그라운드 상태를 확인해 보니, 현재 사용하지 않는 **은행·관공서 보안프로그램 ${activeCount}개(약 ${ramMb}MB)**가 메모리를 점유하고 있습니다.\n` +
                `이 프로그램들을 삭제하지 않고 **평소에는 잠재워 두었다가, 은행·홈택스 접속 시에만 다시 깨워드릴까요?**`
              : `${nickLabel}컴퓨터 백그라운드 상태를 확인해 보니 현재 실행 중인 은행·관공서 보안프로그램은 **0개**입니다.\n` +
                `앞으로도 은행·홈택스 접속 시에만 켜고 **평소에는 자동으로 잠재워 두도록 설정할까요?**`;
          setSharedMonsterMessages((prev) => {
            if (prev.some((m) => m.id.startsWith('secretary_bank_sleep_intro_'))) return prev;
            return [
              ...prev,
              {
                id: `secretary_bank_sleep_intro_${Date.now()}`,
                role: 'assistant',
                timestamp: nowTimeKo(),
                sourceTab: 'trash',
                text: introText,
                followUpSuggestions: [
                  '응, 앞으로 알아서 재우고 깨워줘',
                ],
              },
            ];
          });
        });
    } else if (
      // [Stage 2: 호흡 분리 후 다음번 진입 시 — 다운로드 폴더 압축파일 최소 3건 이상(>=3) 누적 시 압축 풀기 안내]
      !isMobileOrStore &&
      zCoreBridge.isConnected &&
      !turn.nextState.awaitingNickname &&
      (turn.nextState.consents?.bankSecurityAutoSleep || turn.nextState.bankSleepIntroShownAt) &&
      !turn.nextState.hiddenSuperpowersShown
    ) {
      void fetch(getZCoreUrl('/api/care/security-services/status'))
        .then((r) => r.json())
        .catch(() => null)
        .then((secRes) => {
          const curSt = loadGhostSecretaryState();
          if (curSt.hiddenSuperpowersShown) return;
          const zipCount = Number(secRes?.downloadsArchiveCount ?? 0);
          if (zipCount < 3) return; // 최소 3건 이상 쌓였을 때만 알람 발동
          const zipSamples: string[] = Array.isArray(secRes?.downloadsArchiveSamples)
            ? secRes.downloadsArchiveSamples
            : [];
          const sampleHint = zipSamples.length > 0 ? ` (예: \`${zipSamples[0]}\` 등)` : '';
          const nickLabel = curSt.nickname ? `${curSt.nickname}님, ` : '';
          saveGhostSecretaryState({
            ...curSt,
            hiddenSuperpowersShown: true,
          });
          setSharedMonsterMessages((prev) => {
            if (prev.some((m) => m.id.startsWith('secretary_superpower_zip_intro_'))) return prev;
            return [
              ...prev,
              {
                id: `secretary_superpower_zip_intro_${Date.now()}`,
                role: 'assistant',
                timestamp: nowTimeKo(),
                sourceTab: 'trash',
                text:
                  `${nickLabel}다운로드 폴더에 압축파일${sampleHint}이 **총 ${zipCount}건** 쌓여 있습니다.\n` +
                  `사진 정리·속도 관리 외에도 **파일 보호 기능과 더블클릭·우클릭 압축 해제 기능**을 함께 사용할 수 있습니다. 사용 방법을 안내해 드릴까요?`,
                followUpSuggestions: [
                  '응, 편의 기능 두 가지 알려줘',
                  '다운로드 폴더 열어서 압축 풀기 써볼래',
                ],
              },
            ];
          });
        });
    }
    // 같은 계정의 다른 기기(PC ↔ 모바일)에서 등록한 여권(실명 + 128차원 얼굴 벡터)은 질문 없이 물밑에서 자동 동기화 및 로컬 사진첩 즉시 매칭
    void pullGhostPassportsFromCloud(secretaryOwnerEmail()).then((pulled) => {
      if (!pulled.ok) return;
      const cur = useSaySeeStore.getState();
      if (!cur.faceClusters || cur.faceClusters.length === 0) return;
      const reconciled = reconcileCloudPassportsWithFaceClusters(cur.faceClusters);
      if (reconciled.newlyMatchedNames.length === 0) return;
      const tagMap = new Map<string, string[]>();
      for (const fc of reconciled.clusters) {
        if (fc.excludedAsPasserby) continue;
        const namesForFc = Array.from(
          new Set([fc.registeredName, ...Object.values(fc.roomPersonas || {})].map((s) => (s || '').trim()).filter(Boolean))
        );
        if (namesForFc.length === 0) continue;
        const tagsForFc = namesForFc.map((n) => `#${n}`);
        for (const fName of fc.matchedPhotoFiles || []) {
          const prev = tagMap.get(fName) || [];
          tagMap.set(fName, Array.from(new Set([...prev, ...tagsForFc])));
        }
      }
      useSaySeeStore.setState({
        faceClusters: reconciled.clusters,
        photos: cur.photos.map((p) => {
          const extra = tagMap.get(p.name);
          return extra && extra.length > 0 ? { ...p, tags: Array.from(new Set([...p.tags, ...extra])) } : p;
        }),
      });
    });
    return () => {
      window.removeEventListener('ghosti_jump_to_secretary', onJumpRefresh);
      window.removeEventListener('merlinSessionExpired', onJumpRefresh);
      window.removeEventListener('merlinLoggedIn', onJumpRefresh);
      window.removeEventListener('ghostiSupabaseUserSynced', onJumpRefresh);
    };
  }, [sourceTab, isMobileOrStore]);

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

  // 좌측 정리창 상단 [⏭️ 남은 사진 정리는 다음에] 클릭 시: 좌측 화면은 멈추고 우측 귀신비서는 즉시 다음 안내로 자연스럽게 진행
  useEffect(() => {
    if (sourceTab !== 'trash') return;
    const onDeferCleanupAndContinue = () => {
      const storeNow = useSaySeeStore.getState();
      const pendingShare = storeNow.pendingReturnShareRoom;
      const st = loadGhostSecretaryState();
      const nickPrefix = st.nickname ? `${st.nickname}님, ` : '';

      if (pendingShare) {
        setSharedMonsterMessages((prev) => [
          ...prev,
          {
            id: `secretary_continue_after_defer_${Date.now()}`,
            role: 'assistant',
            timestamp: nowTimeKo(),
            sourceTab: 'trash',
            text: `네, ${nickPrefix}남은 사진 정리 화면은 멈춰 두었습니다.\n아래 **[아까 보던 '${pendingShare.roomTitle}'으로 가서 내 사진 올리기]** 버튼을 눌러 사진방으로 돌아가실 수 있습니다.`,
          },
        ]);
        return;
      }

      if (st.passportStep !== 'done' && st.passportStep !== 'skipped' && st.passportStep !== 'naming') {
        const entry = buildPassportEntryTurn({ ...st, passportStep: undefined }, isMobileOrStore);
        const updatedState: GhostSecretaryState = { ...entry.nextState, questStep: 'done' };
        saveGhostSecretaryState(updatedState);
        if (entry.followUps) {
          setSharedMonsterMessages((prev) => [
            ...prev,
            {
              id: `secretary_continue_passport_${Date.now()}`,
              role: 'assistant',
              timestamp: nowTimeKo(),
              sourceTab: 'trash',
              text: `네, ${nickPrefix}남은 사진 정리 화면은 멈춰 두고 다음 안내로 넘어갈게요.\n\n${entry.text}`,
              followUpSuggestions: entry.followUps,
            },
          ]);
          return;
        }
      }

      saveGhostSecretaryState({ ...st, questStep: 'done' });
      setSharedMonsterMessages((prev) => [
        ...prev,
        {
          id: `secretary_continue_search_${Date.now()}`,
          role: 'assistant',
          timestamp: nowTimeKo(),
          sourceTab: 'trash',
          text: isMobileOrStore
            ? `네, ${nickPrefix}남은 사진 정리 화면은 멈춰 두고 다음 안내로 넘어갈게요.\n상단 **통합 검색창(또는 마이크)**에서 방금 불러온 사진·문서를 찾아보실 수 있습니다.`
            : `네, ${nickPrefix}남은 사진 정리 화면은 멈춰 두고 다음 안내로 넘어갈게요.\n**귀신검색**에서 방금 읽어둔 사진·문서를 찾아보실 수 있습니다.`,
          followUpSuggestions: isMobileOrStore
            ? ['맨 위 검색창으로 바로 찾아볼래']
            : [
                '귀신검색으로 내 파일 찾아볼래',
              ],
        },
      ]);
    };

    const onSamplePcStepChat = (ev: Event) => {
      const detail = (ev as CustomEvent<{ text?: string }>).detail;
      const msgText = detail?.text?.trim();
      if (!msgText) return;
      const isRestoreDone = msgText.includes('원상복구') || msgText.includes('복구됐어요');
      const extraRealHint =
        isRestoreDone && zCoreBridge.isConnected
          ? '\n\n현재 내 컴퓨터가 연결되어 있으니 아래 버튼으로 **실제 내 PC의 시작프로그램 목록**도 점검해 보실 수 있습니다.'
          : '';
      setSharedMonsterMessages((prev) => [
        ...prev,
        {
          id: `secretary_sample_pc_${Date.now()}`,
          role: 'assistant',
          timestamp: nowTimeKo(),
          sourceTab: 'trash',
          text: `${msgText}${extraRealHint}`,
          followUpSuggestions:
            isRestoreDone && zCoreBridge.isConnected
              ? [
                  '부팅할 때 켜지는 시작프로그램 목록도 보여줘',
                  '컴퓨터 켜둔 지 얼마나 지났는지 부팅 경과 시간 진단해줘',
                  '내 PC 사양이랑 남은 용량 진단해줘',
                ]
              : undefined,
        },
      ]);
    };

    const onPhotoAuditSummary = (ev: Event) => {
      const detail = (
        ev as CustomEvent<{
          total?: number;
          dupSets?: number;
          blurry?: number;
          memoScreen?: number;
          remainingOldPhotos?: number;
        }>
      ).detail;
      if (!detail) return;
      const total = Number(detail.total ?? 0);
      const dupSets = Number(detail.dupSets ?? 0);
      const blurry = Number(detail.blurry ?? 0);
      const memoScreen = Number(detail.memoScreen ?? 0);
      const remainingOldPhotos = Number(detail.remainingOldPhotos ?? 0);
      const st = loadGhostSecretaryState();
      const nickPrefix = st.nickname ? `${st.nickname}님, ` : '';
      const paneLabel = isMobileOrStore ? '아래 정리 화면에서' : '왼쪽 정리 화면에서';
      const text =
        dupSets === 0 && blurry === 0 && memoScreen === 0
          ? `${nickPrefix}사진 ${total}장을 확인했습니다. 중복·연사 묶음 0세트, 흐린 사진 0장으로 정리할 항목이 없습니다.`
          : `${nickPrefix}사진 ${total}장 분석이 완료되었습니다.\n` +
            `• 중복·연사 묶음: ${dupSets}세트\n` +
            `• 흔들린(흐린) 사진: ${blurry}장\n` +
            (memoScreen > 0 ? `• 메모·캡처 후보: ${memoScreen}장\n` : '') +
            `\n임의로 삭제하지 않습니다. ${paneLabel} 한 세트씩 실사진과 추천 1장을 확인하시고 정리 여부를 선택해 주세요.`;

      const storeNow = useSaySeeStore.getState();
      const allowPcBridge =
        isMobileOrStore && (!storeNow.isStoreAppMode || storeNow.enablePcGuideShareButton);
      const pcBridgeTail = allowPcBridge
        ? `\n\n집이나 회사 PC에서도 내 파일·사진을 찾으시려면 아래 버튼으로 카카오톡(나에게 보내기)에 PC 실행 링크를 저장해 두실 수 있습니다.`
        : '';

      for (const prevMsg of getSharedMonsterChatState().messages) {
        if (prevMsg.role !== 'user') {
          completedSecretaryAnimIds.add(prevMsg.id);
        }
      }

      const auditMsgId = `secretary_photo_audit_${Date.now()}`;
      completedSecretaryAnimIds.add(auditMsgId);

      const nextBubbles: MonsterChatMessage[] = [
        {
          id: auditMsgId,
          role: 'assistant',
          timestamp: nowTimeKo(),
          sourceTab: 'trash',
          text: `${text}${pcBridgeTail}`,
          showMobileToPcBridgeButton: allowPcBridge,
          followUpSuggestions: isMobileOrStore
            ? ['맨 위 검색창으로 방금 불러온 사진 찾아볼래']
            : undefined,
        },
      ];

      if (isMobileOrStore && remainingOldPhotos > 0 && !st.mobileRemainingScanChoice) {
        const choicePrompt = buildMobileRemainingPhotosChoicePrompt(
          st.nickname || '회원',
          remainingOldPhotos
        );
        if (choicePrompt) {
          const remId = `secretary_mobile_remaining_audit_${Date.now() + 1}`;
          completedSecretaryAnimIds.add(remId);
          nextBubbles.push({
            id: remId,
            role: 'assistant',
            timestamp: nowTimeKo(),
            sourceTab: 'trash',
            text: choicePrompt.text,
            followUpSuggestions: choicePrompt.followUps,
          });
        }
      }

      setSharedMonsterMessages((prev) => [...prev, ...nextBubbles]);
      window.setTimeout(() => {
        const el = scrollContainerRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      }, 60);
    };

    window.addEventListener('ghosti_defer_photo_cleanup_and_continue', onDeferCleanupAndContinue);
    window.addEventListener('ghosti_sample_pc_step_chat', onSamplePcStepChat);
    window.addEventListener('ghosti_photo_audit_summary', onPhotoAuditSummary);
    return () => {
      window.removeEventListener('ghosti_defer_photo_cleanup_and_continue', onDeferCleanupAndContinue);
      window.removeEventListener('ghosti_sample_pc_step_chat', onSamplePcStepChat);
      window.removeEventListener('ghosti_photo_audit_summary', onPhotoAuditSummary);
    };
  }, [sourceTab, isMobileOrStore]);

  // [D-35] 🪪 여권 조용한 등록: ① 내 사진 등록 완료 → 가족 질문(따로) ② 얼굴 인덱싱 완료 시 비서 먼저 제안 ③ 사진 활동 직후 1회 질문
  const faceClusterCount = useSaySeeStore((s) => s.faceClusters.length);
  useEffect(() => {
    if (sourceTab !== 'trash') return;
    const pushOnce = (idPrefix: string, msg: Omit<MonsterChatMessage, 'id' | 'role' | 'timestamp' | 'sourceTab'>) => {
      setSharedMonsterMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.id.startsWith(idPrefix) && Date.now() - Number(last.id.split('_').pop() || 0) < 3000) return prev;
        return [
          ...prev,
          { id: `${idPrefix}${Date.now()}`, role: 'assistant', timestamp: nowTimeKo(), sourceTab: 'trash', ...msg },
        ];
      });
    };

    const onRegDone = (e: Event) => {
      const detail = (e as CustomEvent<{ mode?: PassportRegMode; registered?: number; dismissedCount?: number; names?: string[] }>).detail;
      const mode = detail?.mode;
      const registered = Number(detail?.registered || 0);
      const dismissedCount = Number(detail?.dismissedCount || 0);
      syncPassportAfterRegistration();
      if (registered <= 0) {
        if (dismissedCount > 0) {
          pushOnce('secretary_passport_dismissed_', { text: '선택하신 얼굴을 후보에서 제외했습니다.' });
        }
        return;
      }
      if (mode === 'self') {
        const hasFamily = familyCandidates().length > 0;
        if (hasFamily) {
          pushOnce('secretary_passport_family_offer_', {
            text: `등록이 완료되었습니다.\n\n${buildPassportFamilyOfferText()}`,
            followUpSuggestions: [PASSPORT_CHIP_OPEN_FAMILY, PASSPORT_CHIP_LATER],
          });
        } else {
          pushOnce('secretary_passport_done_', { text: '등록이 완료되었습니다.' });
        }
        // 모바일 단독: 1차 여권 등록 직후 남은 옛날 사진 스캔 시점 선택권 + PC 연결 브릿지 (기존 v1.3 흐름 유지)
        if (isMobileOrStore) {
          const st = loadGhostSecretaryState();
          if (st.nickname && !st.mobileRemainingScanChoice) {
            const remainingPhotos =
              st.mobileRemainingOldPhotos ??
              Math.max(0, (useSaySeeStore.getState().photos || []).length - (st.mobileSteppingStoneScanned || 100));
            const choicePrompt = buildMobileRemainingPhotosChoicePrompt(st.nickname, remainingPhotos);
            if (choicePrompt) {
              pushOnce('secretary_mobile_remaining_', {
                text: choicePrompt.text,
                followUpSuggestions: choicePrompt.followUps,
              });
            }
          }
          const pcBridge = buildMobileToPcBridgePrompt(st.nickname);
          pushOnce('secretary_mobile_pc_bridge_', { text: pcBridge.text, showMobileToPcBridgeButton: true });
        }
      } else {
        const names = (e as CustomEvent<{ names?: string[] }>).detail?.names || [];
        pushOnce('secretary_passport_done_', {
          text: names[0]
            ? `등록이 완료되었습니다. 이제 귀신검색에서 "${names[0]} 웃는 사진"처럼 찾아보실 수 있습니다.`
            : '등록이 완료되었습니다.',
        });
      }
    };

    const fulfillUserWaitIfReady = (isScanFinished: boolean): boolean => {
      const waited = peekQueuedUserPassportWait();
      if (!waited) return false;
      if (!isScanFinished && isOnDeviceFaceScanRunning()) return false;

      const curStore = useSaySeeStore.getState();
      const qualified = rankFaceClusters(curStore.faceClusters || [], 12, PASSPORT_MIN_FACE_PHOTOS_FOR_ASK);
      const nick = (waited.nickname || loadGhostSecretaryState().nickname || '').trim();
      const nickPrefix = nick ? `${nick}님, ` : '';

      if (qualified.length > 0) {
        consumeQueuedUserPassportWait();
        const regSt = loadPassportRegState();
        const self = findSelfCluster(regSt);
        const openMode: PassportRegMode = waited.mode === 'family' && !self ? 'self' : waited.mode;
        const pending = summarizePassportPending(regSt);
        const hasRealName = Boolean((loadGhostPassportBook().self?.realName || '').trim());
        const nothingForSelf = openMode === 'self' && self && pending.selfPendingCount === 0 && hasRealName;

        if (nothingForSelf) {
          if (familyCandidates(regSt).length > 0) {
            pushOnce('secretary_passport_fulfilled_', {
              text: `${nickPrefix}얼굴을 다 찾았어요! 내 여권 사진은 이미 등록되어 있어서 가족 얼굴 등록 안내를 드릴게요.\n\n${buildPassportFamilyOfferText()}`,
              followUpSuggestions: [PASSPORT_CHIP_OPEN_FAMILY, PASSPORT_CHIP_LATER],
            });
          } else {
            pushOnce('secretary_passport_fulfilled_', {
              text: `${nickPrefix}얼굴을 다 찾았어요! 지금 찾은 사진은 이미 모두 여권에 등록되어 있습니다.`,
            });
          }
          return true;
        }
        if (openMode === 'family' && familyCandidates(regSt).length === 0) {
          pushOnce('secretary_passport_fulfilled_', {
            text: `${nickPrefix}얼굴을 다 찾았어요! 지금은 새로 등록할 가족 얼굴이 없어요. 새 사진이 들어오면 다시 찾아볼게요!`,
          });
          return true;
        }

        openPassportRegistration(openMode);
        markPassportPrompted();
        const guide =
          openMode === 'self' && !self
            ? waited.mode === 'family'
              ? `${nickPrefix}얼굴을 다 찾았어요! 가족 등록 전에 ${nick ? `${nick}님` : '내'} 얼굴부터 왼쪽 화면에서 선택해 주세요.`
              : `${nickPrefix}얼굴을 다 찾았어요! 왼쪽 화면에 띄워 드렸으니 ${nick ? `${nick}님` : '내'} 얼굴을 선택해 주세요.`
            : `${nickPrefix}얼굴을 다 찾았어요! 왼쪽 화면에 띄워 드렸으니 아닌 사진만 제외하고 [등록]을 눌러주세요.`;
        pushOnce('secretary_passport_fulfilled_', { text: guide });
        return true;
      }

      if (isScanFinished && (curStore.photos || []).length > 0) {
        consumeQueuedUserPassportWait();
        pushOnce('secretary_passport_fulfilled_', {
          text: `${nickPrefix}사진을 모두 살펴봤지만 같은 분이 3장 이상 나온 인물 사진을 아직 찾지 못했어요. 새 사진이 들어오면 자동으로 찾아둘게요!`,
        });
        return true;
      }
      return false;
    };

    const onRegState = () => {
      // 유저가 '여권 등록'을 먼저 입력해 '다 찾으면 바로 알려드릴게요!'라고 약속한 대기 요청이 있으면 최우선 이행
      if (fulfillUserWaitIfReady(false)) return;

      // [D-35] ① 아직 본인 여권이 미등록 상태이고, 온디바이스 얼굴 인덱싱이 완료되어 후보가 잡히면
      // 유저가 '여권 등록'을 먼저 말할 필요 없이 귀신비서가 먼저 자연스럽게 말을 겁니다 (세션당 1회).
      const regSt = loadPassportRegState();
      const offeredThisSession = (() => {
        try {
          return sessionStorage.getItem('ghosti_passport_offered_this_session') === '1';
        } catch {
          return false;
        }
      })();
      const selfActive = findSelfCluster(regSt);
      if ((!regSt.firstOfferShown || !selfActive) && !offeredThisSession) {
        const pending = summarizePassportPending(regSt);
        const hasSelfToAsk = pending.needsSelfPick || pending.selfPendingCount > 0;
        if (hasSelfToAsk) {
          markFirstOfferShown();
          try {
            sessionStorage.setItem('ghosti_passport_offered_this_session', '1');
          } catch {
            /* ignore */
          }
          pushOnce('secretary_passport_first_offer_', {
            text: buildPassportSelfOfferText(loadGhostSecretaryState().nickname || ''),
            followUpSuggestions: [PASSPORT_CHIP_OPEN_SELF, PASSPORT_CHIP_LATER],
          });
          return;
        }
      }
      const mode = passportPromptForActivity();
      if (!mode) return;
      markPassportPrompted();
      pushOnce('secretary_passport_activity_offer_', {
        text:
          mode === 'self'
            ? buildPassportSelfOfferText(loadGhostSecretaryState().nickname || '')
            : buildPassportFamilyOfferText(),
        followUpSuggestions: [mode === 'self' ? PASSPORT_CHIP_OPEN_SELF : PASSPORT_CHIP_OPEN_FAMILY, PASSPORT_CHIP_LATER],
      });
    };

    const onScanFinished = () => {
      fulfillUserWaitIfReady(true);
    };

    window.addEventListener(PASSPORT_REG_DONE_EVENT, onRegDone);
    window.addEventListener(PASSPORT_REG_STATE_EVENT, onRegState);
    window.addEventListener(PASSPORT_SCAN_FINISHED_EVENT, onScanFinished);
    // 다른 화면에서 사진 활동이 있었거나 얼굴 클러스터가 막 준비되었다면 즉시 1회 묻는다
    onRegState();
    return () => {
      window.removeEventListener(PASSPORT_REG_DONE_EVENT, onRegDone);
      window.removeEventListener(PASSPORT_REG_STATE_EVENT, onRegState);
      window.removeEventListener(PASSPORT_SCAN_FINISHED_EVENT, onScanFinished);
    };
  }, [sourceTab, isMobileOrStore, faceClusterCount]);
  useEffect(() => {
    let cancelled = false;
    const runProactiveCheck = async () => {
      if (cancelled) return;
      // [v1.3] 전사 단일 웹 알림 = 귀신비서 채팅 노크 (대답할 때까지 하루 1회만)
      const briefing = await evaluateDualProactiveCareEngine({
        isStoreAppMode: isMobileOrStore,
      });
      if (!briefing || cancelled) return;
      // Track A(20% 실시간 과부하 10분 지속)는 정기 노크와 별개로 즉시 안내하되, 이미 미실행 브리핑 카드가 있으면 중복 방지
      if (briefing.triggerType !== 'TRACK_A_20PCT_OVERLOAD' && !canKnockToday(loadGhostSecretaryState())) return;
      saveGhostSecretaryState({ ...loadGhostSecretaryState(), lastKnockDate: todayKey() });
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
          text: `[${briefing.badgeLabel}]\n• ${briefing.headlineLine1}\n• ${briefing.schedulePromptLine2}`,
          cardKind: 'WEEKLY_CARE_BRIEFING',
          proactiveCareBriefing: briefing,
          followUpSuggestions: [
            '응, 지금 바로 손봐줘',
            '정기 검진 요일 금요일 오후 4시로 바꿔줘',
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
    if (!raw || getSharedMonsterChatState().busy) return;
    if (!overrideQuery) setInputText('');

    // 새 질문을 보낼 때 아직 순차 등장 중이던 이전 귀신비서 말풍선은 즉시 완료 처리하여 다음 답변이 가려지지 않게 보장
    for (const m of getSharedMonsterChatState().messages) {
      if (m.role !== 'user') {
        completedSecretaryAnimIds.add(m.id);
      }
    }

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

    if (/^(🏠\s*)?(온보딩\s*체험관|온보딩\s*쇼룸|온보딩\s*페이지).*?(이동|나가|구경|열어|갈래)/i.test(raw)) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ghosti_navigate_showroom'));
      }
      setSharedMonsterBusy(false);
      return;
    }

    if (
      /^(📱\s*)?(내\s*폰\s*사진\s*(?:불러와|자동\s*점검)|폰\s*사진\s*(?:불러와|자동\s*점검)|사진\s*(?:불러와\s*)?(?:1분\s*)?정리|폰\s*사진\s*정리\s*시작)/i.test(
        raw
      )
    ) {
      void useSaySeeStore.getState().syncMobileNativeGalleryAuto({ promptPermission: true });
      const curPhotos = useSaySeeStore.getState().photos.filter((p) => !p.quarantined);
      const curDups = useSaySeeStore.getState().duplicateGroups.length;
      const curBlurry = curPhotos.filter((p) => p.trashCategory === 'blurry').length;
      setSharedMonsterMessages((prev) => [
        ...prev,
        {
          id: `secretary_mobile_pick_${Date.now()}`,
          role: 'assistant',
          timestamp: nowTimeKo(),
          sourceTab,
          text:
            curPhotos.length > 0
              ? `현재 내 폰 사진 **${curPhotos.length}장** 색인이 완료되어 있습니다.\n(중복·연사 **${curDups}세트** · 흔들린 사진 **${curBlurry}장** — 아래 정리 탭에서 직접 확인하고 선택해 주세요.)`
              : '스마트폰 사진첩을 확인하고 있습니다.\n사진 접근 권한을 허용해 주시면 기기 안에서 자동으로 분류·검색됩니다.',
        },
      ]);
      setSharedMonsterBusy(false);
      return;
    }

    if (
      isMobileOrStore &&
      !zCoreBridge.isConnected &&
      /(복원\s*기록|복원\s*지점|정리한\s*사진\s*복원)/i.test(raw)
    ) {
      const mobileQuarantined = (useSaySeeStore.getState().photos || []).filter((p) => p.quarantined);
      if (mobileQuarantined.length > 0 && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ghosti_open_mobile_quarantine_drawer'));
      }
      setSharedMonsterMessages((prev) => [
        ...prev,
        {
          id: `secretary_mobile_restore_info_${Date.now()}`,
          role: 'assistant',
          timestamp: nowTimeKo(),
          sourceTab,
          text:
            mobileQuarantined.length > 0
              ? `방금 정리한 사진 **${mobileQuarantined.length}장**이 시스템 휴지통에 보관되어 있습니다.\n아래 펼쳐진 **[정리한 사진 복원 (${mobileQuarantined.length}장)]** 목록(아이폰은 사진 앱 [최근 삭제된 항목])에서 언제든 되돌리실 수 있습니다.`
              : '아직 휴지통으로 옮긴 사진이 없습니다.\n아이폰은 사진 앱의 **[최근 삭제된 항목]**에서 복원할 수 있고, 안드로이드·PC는 정리 후 여기서 바로 되돌리실 수 있습니다.',
          followUpSuggestions:
            mobileQuarantined.length === 0
              ? ['내 폰 사진 자동 점검 결과 볼래']
              : undefined,
        },
      ]);
      setSharedMonsterBusy(false);
      return;
    }

    if (
      /^(🔍\s*)?((?:맨\s*위\s*검색창으로|방금\s*불러온\s*사진\s*맨\s*위\s*검색창에서|맨\s*위\s*검색창에서)\s*(?:방금\s*불러온\s*사진\s*)?(?:바로\s*)?(?:찾아볼래|찾아볼게)(?:요)?|귀신검색으로\s*내\s*파일\s*(?:찾아볼래|찾아볼게)(?:요)?|사진\s*검색\s*바로\s*(?:해볼래|해볼게)(?:요)?)$/i.test(
        raw
      )
    ) {
      setSharedMonsterMessages((prev) => [
        ...prev,
        {
          id: `secretary_jump_search_${Date.now()}`,
          role: 'assistant',
          timestamp: nowTimeKo(),
          sourceTab,
          text: isMobileOrStore
            ? '상단 통합 검색창으로 이동해 드렸습니다. 찾고 싶은 사진이나 서류를 글자나 음성으로 검색해 보세요.'
            : '귀신검색 화면을 열어드렸습니다. 찾고 싶은 사진이나 서류를 검색해 보세요.',
        },
      ]);
      setSharedMonsterBusy(false);
      onJumpToSearch('');
      return;
    }

    // [v1.3] 귀신비서 대본집 우선 응답 (별명 등록 → 매운맛 점괘 / 구매처 거절 / 급한 유저 / 홀림 퀘스트 / 로드맵 희망 답변)
    // 단, 직전 대화에 승인 대기 중인 손보기 카드(정리·바로가기·복구·사양진단·수리)나 복원 목록이 있을 때의 긍정/승인/확인 발화는 손보기 라우터가 직접 처리!
    const hasPendingCareApproval = [...getSharedMonsterChatState().messages]
      .reverse()
      .some(
        (m) =>
          (m.cleanupPreview && !m.cleanupPreview.approved) ||
          (m.shortcutPreview && !m.shortcutPreview.approved) ||
          (m.missingFilePayload && !m.missingFilePayload.restored) ||
          (m.cardKind === 'PC_SPEC_CONSULTATION' && m.pcSpecPayload && !m.pcSpecPayload.bloatwareCleaned) ||
          (m.cardKind === 'DEVICE_REPAIR_GATE' && m.deviceRepairPayload && !m.deviceRepairPayload.executed) ||
          (m.cardKind === 'WEEKLY_CARE_BRIEFING' && m.proactiveCareBriefing && !m.proactiveCareBriefing.executed) ||
          (m.cardKind === 'DEEP_UNINSTALL_GATE' && m.deepUninstallPayload && !m.deepUninstallPayload.executed) ||
          (m.cardKind === 'AGENT_CARE_BATCH_CARD' && m.agentCareCardPayload && !m.agentCareCardPayload.executed) ||
          m.cardKind === 'RESTORE_POINTS_LIST' ||
          /은행·관공서\s*보안프로그램.*?깨워드릴까요|(?:숨은\s*초능력|편의\s*기능).*?알려드릴까요/.test(m.text || '')
      );
    const isDirectCareOrStatusCommand =
      detectAgentCareIntent(raw, getLastCareScanContext()).matched ||
      /(진행해|실행해|정리해|치워\s*(?:줘|주세요)|복구해|복원\s*기록|복원\s*지점|복원해|되돌려|원복|원래대로|휴지통|비워|진행된|진행한|정리된|정리한|다\s*된|완료된|개선된|빨라졌|1초\s*건강|건강\s*검진|임시\s*설치|바탕화면|다운로드|기본\s*압축\s*앱|[c-zC-Z]\s*드라이브|(?:저장\s*)?(?:용량|공간|하드|디스크)(?:이|가|은|는|도)?\s*(?:너무\s*|많이\s*)?(?:부족|모자라|꽉|없|확보|도둑|주범|정리|스캔|분석|늘려)|파일(?:이|가)?\s*안\s*(?:받아|열려|깔려|저장)|캐시\s*(?:정리|청소|삭제|지워|스캔)|최대\s*절전|hiberfil|capcut|캡컷|wd\s*(?:폴더|아이콘)|(?:이상한|수상한|광고)\s*(?:창|팝업|배너|알림|화면|폴더|아이콘|거|게|앱|프로그램)|자꾸.*?(?:떠|뜨|돌아|켜져|나와)|쓸데없는\s*(?:거|게|앱|프로그램)|뭐\s*(?:지우면|삭제하면|정리하면)|무거워|답답|렉\s*걸|멈칫|가볍게|청소\s*(?:좀|하자)|손\s*좀\s*보|손보자|지워도\s*(?:돼|되|괜찮)|이게\s*뭐야|뭐\s*하는\s*(?:앱|프로그램)|쥐새끼|스파이웨어|몰래|숨은|수동\s*전환|예스파일|mspcmanager|사용자\s*폴더|전원\s*(?:옵션|모드)|고성능\s*(?:모드|전원)|빼고|제외하고|놔두고|나머지\s*다|빨간색|옮겨\s*(?:줘|주세요)|사양|스펙|상태\s*봐|손봐\s*(?:줘|주세요)|느려|느린|버벅|부팅|재부팅|경과\s*시간|켜\s*둔\s*지|안\s*끄고|진단해|점검해|시작\s*프로그램|자동\s*실행|애드웨어|보안\s*모듈|보안\s*프로그램|보안\s*쓰레기|백신|디펜더|바이러스|랜섬웨어|알아서\s*재우고|숨은\s*초능력|비서\s*실적|실적\s*보고서|우클릭\s*0\.35초|은행\s*업무.*?깨워|강제\s*종료|지워\s*(?:줘|주세요)|삭제해\s*(?:줘|주세요)|적출|언인스톨|뿌리째|뿌리\s*뽑|유령\s*앱|온보딩\s*[123]\s*탭|스튜디오\s*문의방|복사\s*기록.*?(보관|바꿔)|상용구|cleanx|클린\s*x|클린엑스|청소\s*앱|클리너|(?:구독|정기\s*구독|정기\s*결제|자동\s*결제|주간\s*결제)\s*(?:해지|취소|확인|관리|알려|어디|어떻게|방법)|해지\s*(?:알려|어디|어떻게|방법))/i.test(
        raw
      );
    const preStForPlaybook = loadGhostSecretaryState();
    const lastAssistantBubble = [...getSharedMonsterChatState().messages]
      .reverse()
      .find((m) => m.role === 'assistant');
    const isLastBubbleAskingNickname =
      /(?:어떤|무슨|새)\s*(?:별명|이름|닉네임|호칭).*?(?:바꿔|불러|말씀|알려|좋을)|뭐라고\s*불러\s*드리면|어떻게\s*불러\s*드릴까/i.test(
        lastAssistantBubble?.text || ''
      );
    const isNickOrStoreSpecial =
      Boolean(parseNicknameSettingIntent(raw, preStForPlaybook.nickname)) || isStoreLinkIntent(raw);
    const isAnsweringInitialNickname =
      (Boolean(preStForPlaybook.awaitingNickname) || isLastBubbleAskingNickname) &&
      raw.length <= 36 &&
      !isDirectCareOrStatusCommand &&
      !/(진단해|점검해|정리해|치워|지워|삭제해|복구해|복원해|손봐|알려\s*줘|보여\s*줘|찾아\s*줘|깨워|재워|구독|해지|결제|청소\s*앱|클리너|컴퓨터|컴터|피씨|용량|공간|모자라|답답|버벅|느려|이상한|팝업)/i.test(raw);
    const shouldBypassSecretaryPlaybook =
      !isNickOrStoreSpecial &&
      !isAnsweringInitialNickname &&
      (isDirectCareOrStatusCommand ||
        (hasPendingCareApproval &&
          /^(응|네|넹|예|좋아|좋아요|ㅇㅇ|ㅇㅋ|오케이|ok|그래|해\s*(?:줘|주세요)|알려\s*(?:줘|주세요)|뭔데|진행|실행|승인|동의|콜|고고|#?\d+\s*번?)/i.test(raw)));

    // [v1.3 필수 통과의례 게이트]: PC에서 첫 진입 또는 연결 유도 단계일 때,
    // 별명 등록 전후를 불문하고 '싫어 / 구경만 할래' 거절 발화와 '[🔍 응, 내 컴퓨터 연결하고 누가 속도 잡아먹는지 분석해줘]' 동의 발화를 정직하게 처리!
    if (sourceTab === 'trash' && !isMobileOrStore && !zCoreBridge.isConnected && hasActiveGhostiLoginSession()) {
      await zCoreBridge.checkHealth(false);
    }
    if (sourceTab === 'trash' && !isMobileOrStore) {
      const preSt = preStForPlaybook;

      if (!isNickOrStoreSpecial) {
        const nickLabel = preSt.nickname ? `${preSt.nickname}님` : '회원님';
        const awaitingRite =
          typeof sessionStorage !== 'undefined' &&
          sessionStorage.getItem('ghosti_awaiting_engine_rite') === '1';
        const isExplicitBrowseOrRefuse =
          /(구경\s*부터|구경\s*만|눈으로\s*구경|둘러\s*보|둘러\s*볼|안\s*깔|설치\s*안|연결\s*안|엔진\s*싫|깔기\s*싫)/i.test(raw) ||
          /^(싫어|싫어요|안\s*할래|안\s*해|됐어)(\s*[,!.~]*\s*(구경|둘러).*)?$/i.test(raw) ||
          (awaitingRite && isNo(raw));
        const isExplicitConnectAndAnalyzeChip =
          /(내\s*컴퓨터\s*연결하고\s*누가\s*속도\s*잡아먹는지|마음\s*바꿨어.*내\s*컴퓨터\s*연결|엔진\s*연결하고\s*1초\s*건강검진)/i.test(
            raw
          );
        if (isExplicitConnectAndAnalyzeChip && !zCoreBridge.isConnected) {
          await zCoreBridge.checkHealth(true);
        }
        const isAgreeOrCareOrImpatient =
          !zCoreBridge.isConnected &&
          !isAnsweringInitialNickname &&
          (/(내\s*컴퓨터\s*연결|pc\s*연결|엔진\s*연결|연결\s*해|연결하고|누가\s*속도\s*잡아먹는지|분석\s*해\s*(?:줘|주세요)|설치\s*해|깔아|깔래|마음\s*바꿨)/i.test(
            raw
          ) ||
            isDirectCareOrStatusCommand ||
            isImpatientIntent(raw) ||
            (awaitingRite && isYes(raw)));

        if (isExplicitBrowseOrRefuse) {
          try {
            sessionStorage.removeItem('ghosti_awaiting_engine_rite');
          } catch {
            /* ignore */
          }
          setSharedMonsterMessages((prev) => [
            ...prev,
            {
              id: `secretary_browse_only_${Date.now()}`,
              role: 'assistant',
              timestamp: nowTimeKo(),
              sourceTab,
              text:
                `네 ${nickLabel}, 위쪽 메뉴를 눌러 화면 구성을 둘러보실 수 있습니다.\n` +
                `실제 내 사진·문서를 검색하거나 정리하려면 **내 컴퓨터 연결**이 필요하며, 연결 없이 샘플 데이터로 체험해 보시려면 **온보딩 체험관**을 이용해 주세요.`,
              followUpSuggestions: [
                '온보딩 체험관으로 나가서 구경하기',
                '응, 내 컴퓨터 연결하고 누가 속도 잡아먹는지 분석해줘',
              ],
            },
          ]);
          setSharedMonsterBusy(false);
          return;
        }

        if (isExplicitConnectAndAnalyzeChip && zCoreBridge.isConnected) {
          try {
            sessionStorage.removeItem('ghosti_awaiting_engine_rite');
            sessionStorage.setItem('ghosti_one_stop_agreed', '1');
            localStorage.setItem('ghosti_secretary_engine_agreed', '1');
          } catch {
            /* ignore */
          }
          const routerReply = await processUnifiedMonsterChatQuery({
            query: SECRETARY_FIRST_CARE_QUERY,
            sourceTab,
            literacyLevel,
            ttsEnabled: false,
          });
          setSharedMonsterMessages((prev) => [...prev, routerReply]);
          setSharedMonsterBusy(false);
          return;
        }

        if (isAgreeOrCareOrImpatient) {
          try {
            sessionStorage.removeItem('ghosti_awaiting_engine_rite');
            sessionStorage.setItem('ghosti_one_stop_agreed', '1');
            localStorage.setItem('ghosti_secretary_engine_agreed', '1');
            sessionStorage.setItem(
              'ghosti_pending_secretary_care_query',
              isDirectCareOrStatusCommand && !/마음\s*바꿨|엔진\s*연결|내\s*컴퓨터\s*연결|누가\s*속도\s*잡아먹는지/.test(raw)
                ? raw
                : SECRETARY_FIRST_CARE_QUERY
            );
          } catch {
            /* ignore */
          }
          const isBootOrStartupDiagOffline = /부팅|켜\s*둔|경과\s*시간|시작\s*프로그램/i.test(raw);
          const riteText = isImpatientIntent(raw)
            ? `${nickLabel}, 실제 내 사진·문서를 찾으시려면 먼저 **내 컴퓨터 연결**을 켜주셔야 합니다.\n연결 즉시 내 파일을 읽어들여 검색할 수 있도록 연결 안내 창을 열어드렸습니다.`
            : isBootOrStartupDiagOffline
            ? `${nickLabel}, 시작프로그램 목록 점검과 자동실행 정리는 내 PC 1대에서 무료로 이용할 수 있습니다.\n윈도우 가동 시간과 시작프로그램 목록을 확인하려면 **내 컴퓨터 연결**을 켜주시면 됩니다. 연결 즉시 목록부터 먼저 보여드릴게요.`
            : `${nickLabel}, 연결하셔도 임의로 프로그램을 지우거나 설정을 바꾸지 않습니다.\n**내 컴퓨터 연결**을 켜주시면 속도 저하 원인을 분석해 목록부터 먼저 보여드리겠습니다.`;

          setSharedMonsterMessages((prev) => [
            ...prev,
            {
              id: `secretary_open_engine_${Date.now()}`,
              role: 'assistant',
              timestamp: nowTimeKo(),
              sourceTab,
              text: riteText,
            },
          ]);
          window.dispatchEvent(new CustomEvent('openZCoreGuideModal'));
          setSharedMonsterBusy(false);
          return;
        }
      }
    }

    if (sourceTab === 'trash' && !shouldBypassSecretaryPlaybook) {
      // [D-35] 여권 등록 명령("여권 등록", "가족 얼굴 등록하자" 등)·카드 선택지에는 퀘스트 순서와 무관하게 즉시 반응
      const passportReply = resolvePassportCommandReply(raw, sourceTab, lastAssistantBubble?.text || '');
      if (passportReply) {
        setSharedMonsterMessages((prev) => [...prev, passportReply]);
        setSharedMonsterBusy(false);
        return;
      }
      const secretaryState = loadGhostSecretaryState();
      const turn = resolveGhostSecretaryTurn(raw, secretaryState, {
        passportClusterCount: (useSaySeeStore.getState().faceClusters || []).filter((c) => !c.excludedAsPasserby).length,
        isMobileEnv: isMobileOrStore,
        lastAssistantText: lastAssistantBubble?.text,
      });
      if (turn) {
        let nextState = turn.nextState;
        const replies: MonsterChatMessage[] = [
          {
            id: `secretary_${Date.now()}`,
            role: 'assistant',
            timestamp: nowTimeKo(),
            sourceTab,
            text: turn.text,
            followUpSuggestions: turn.followUps,
            passportViralFamilyName: turn.passportViralFamilyName,
          },
        ];
        if (turn.clipboardText) {
          void navigator.clipboard?.writeText(turn.clipboardText).catch(() => {});
        }
        if (nextState.nickname) {
          saveGhostPassportBook(setPassportSelf(loadGhostPassportBook(), nextState.nickname));
          try {
            localStorage.setItem('userNickname', nextState.nickname);
          } catch {
            /* ignore */
          }
        }
        setAwaitingNickname(Boolean(nextState.awaitingNickname));
        if (turn.needsColdReading && nextState.nickname) {
          const ctx = await collectColdReadingContext();
          const isMobileReading = isMobileOrStore || ctx.device === 'mobile';
          const reading = buildColdReadingText(
            nextState.nickname,
            isMobileReading ? { ...ctx, device: 'mobile' } : ctx
          );
          const hasExplicitlyAgreedInWeb =
            typeof localStorage !== 'undefined' &&
            localStorage.getItem('ghosti_secretary_engine_agreed') === '1' &&
            typeof sessionStorage !== 'undefined' &&
            sessionStorage.getItem('ghosti_one_stop_agreed') === '1';
          const needsEngineRite = !isMobileReading && (!zCoreBridge.isConnected || !hasExplicitlyAgreedInWeb);
          if (needsEngineRite) {
            try {
              sessionStorage.setItem('ghosti_awaiting_engine_rite', '1');
            } catch {
              /* ignore */
            }
          }
          replies.push({
            id: `secretary_reading_${Date.now()}`,
            role: 'assistant',
            timestamp: nowTimeKo(),
            sourceTab,
            text: reading.text,
            followUpSuggestions: isMobileReading
              ? [
                  '내 폰 사진 자동 점검 결과 볼래',
                  '맨 위 검색창으로 바로 찾아볼래',
                ]
              : needsEngineRite
              ? [
                  '응, 내 컴퓨터 연결하고 누가 속도 잡아먹는지 분석해줘',
                  '일단 눈으로 구경부터 할래',
                ]
              : [
                  '부팅할 때 켜지는 시작프로그램 목록도 보여줘',
                  '컴퓨터 켜둔 지 얼마나 지났는지 부팅 경과 시간 진단해줘',
                ],
          });
          nextState = { ...nextState, coldReadingShownAt: new Date().toISOString() };
        }
        if (turn.scenarioId === 'quest_done' || turn.scenarioId === 'quest_mobile_voice_search') {
          const entry = buildPassportEntryTurn(
            nextState.passportStep === 'done' || nextState.passportStep === 'skipped'
              ? { ...nextState, passportStep: undefined }
              : nextState,
            isMobileOrStore
          );
          nextState = entry.nextState;
          replies.push({
            id: `secretary_passport_${Date.now()}`,
            role: 'assistant',
            timestamp: nowTimeKo(),
            sourceTab,
            text: entry.text,
            followUpSuggestions: entry.followUps,
          });
          if (isMobileOrStore && nextState.passportStep === 'skipped') {
            const pcBridge = buildMobileToPcBridgePrompt(nextState.nickname);
            replies.push({
              id: `secretary_mobile_pc_bridge_${Date.now()}`,
              role: 'assistant',
              timestamp: nowTimeKo(),
              sourceTab,
              text: pcBridge.text,
              showMobileToPcBridgeButton: true,
            });
          }
        }
        saveGhostSecretaryState(nextState);
        setSharedMonsterMessages((prev) => [...prev, ...replies]);
        setSharedMonsterBusy(false);
        return;
      }
    }

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
      if (sourceTab === 'trash' && !assistantMsg.cardKind) {
        // 대본집·손보기 라우터 어디에도 정형 매칭되지 않은 자유 질문 → 주간 대본집 편입 후보로 포집 + 비차단 클라우드 전송
        logUnmatchedQuestion(raw, 'no_playbook_match');
        try {
          const curEmail = (localStorage.getItem('ghosti_hub_user_email') || '').trim().toLowerCase();
          if (curEmail) {
            void flushUnmatchedQuestionsToCloud(curEmail, loadUnmatchedQuestions().slice(-5)).then((r) => {
              if (r.ok) localStorage.removeItem('ghosti_unmatched_questions_v1');
            });
          }
        } catch {
          /* non-blocking */
        }
      }
      // [UX 점검 #3] 엔진 연결 직후 자동 실행되는 첫 분석 질문(SECRETARY_FIRST_CARE_QUERY)도 '첫 건강검진'으로 인정 —
      //  깨끗한 PC(정리할 상주 모듈 0건 → 복원 기록 미발급)에서도 홀림 퀘스트(손없는 날 알림 → 음성검색 → 여권)가 끊기지 않게 이어간다
      const isExplicitFirstCareQuery = /(1초\s*건강\s*검진|건강\s*검진\s*(해\s*줘|해\s*주세요|실행|시작))/i.test(raw);
      // [UX 점검 #3] 엔진 연결 직후 자동 첫 분석에서 정리할 거리가 없는 깨끗한 PC(복원 기록 미발급)여도
      //  홀림 퀘스트(손없는 날 알림 → 음성검색 → 여권)가 끊기지 않게 이어간다. 정리 승인 질문이 떠 있으면 그 답을 먼저 기다린다.
      const spec = assistantMsg.pcSpecPayload;
      const awaitingSpecApproval = Boolean(
        spec && !spec.bloatwareCleaned &&
          ((spec.detectedBloatwareLabels?.length || 0) > 0 || (spec.cpuLoadPercent ?? 0) >= 50)
      );
      const isAutoFirstCareQuery =
        raw.trim() === SECRETARY_FIRST_CARE_QUERY && !loadGhostSecretaryState().questStep && !awaitingSpecApproval;
      if (assistantMsg.healthRecordIssued) {
        onHealthRecordAdded(assistantMsg.healthRecordIssued);
      }
      if (assistantMsg.healthRecordIssued || isExplicitFirstCareQuery || isAutoFirstCareQuery) {
        const storeNow = useSaySeeStore.getState();
        const pendingShare = storeNow.pendingReturnShareRoom;

        // 공유 사진방(가족방/모임방)에서 '내 사진 추가'를 위해 귀신비서로 우회해 온 경우: 점검 직후 끊김 없이 복귀 안내 말풍선 제공
        if (sourceTab === 'trash' && pendingShare) {
          window.setTimeout(() => {
            setSharedMonsterMessages((prev) => [
              ...prev,
              {
                id: `secretary_return_shared_room_${Date.now()}`,
                role: 'assistant',
                timestamp: nowTimeKo(),
                sourceTab,
                text: `내 컴퓨터 새 사진 색인과 점검이 완료되었습니다.\n아래 **[아까 보던 '${pendingShare.roomTitle}'으로 가서 내 사진 올리기]** 버튼을 누르면 사진방으로 돌아가 사진을 올리실 수 있습니다.`,
              },
            ]);
          }, 800);
        } else {
          // [v1.3] 일반 진입 시 첫 손보기 완료 직후 → 정기 검진(손없는 날) 알림 제안부터 시작 (귀신 라벨러는 [2. 👻 귀신검색] 유료 티어 소속으로 이관됨)
          const st = loadGhostSecretaryState();
          if (sourceTab === 'trash' && (!st.questStep || isExplicitFirstCareQuery)) {
            const quest = questPromptFor('son_free', st.nickname || '');
            if (quest) {
              saveGhostSecretaryState({
                ...st,
                questStep: 'son_free',
                ...(isExplicitFirstCareQuery ? { passportStep: undefined } : {}),
              });
              window.setTimeout(() => {
                setSharedMonsterMessages((prev) => [
                  ...prev,
                  {
                    id: `secretary_quest_${Date.now()}`,
                    role: 'assistant',
                    timestamp: nowTimeKo(),
                    sourceTab,
                    text: quest.text,
                    followUpSuggestions: quest.followUps,
                  },
                ]);
              }, 900);
            }
          }
        }
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
      onToast?.('마이크 권한이 없거나 음성 입력이 차단된 브라우저입니다.');
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
        setInputText('음성을 텍스트로 변환하고 있습니다...');
        const transcribed = await transcribeAudioBlobViaCloud(blob);
        if (transcribed && !submittedOnceRef.current) {
          submittedOnceRef.current = true;
          setInputText('');
          void handleSend(normalizeSpokenKoreanQuery(transcribed), 'voice');
        } else {
          setInputText('');
          onToast?.('음성이 잘 들리지 않았습니다. 마이크 가까이에서 다시 말씀해 주세요.');
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
      onToast?.('마이크 권한을 허용해 주시거나 아래 입력창에 입력해 주세요.');
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
      const srStartedAt = Date.now();
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
        if (!latestTranscriptRef.current.trim() && Date.now() - srStartedAt < 1400) {
          void startMediaRecorderChatFallback();
          return;
        }
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

  // [v1.3 통과의례 완결]: 『1. 👻 귀신비서』 안에서 엔진이 연결된 순간, 탭 이탈 없이 뒤에서 조용히 내 진짜 파일을 인덱싱하면서
  // 채팅창에서는 축하 인사와 함께 실제 PC 1초 건강검진 → 홀림 퀘스트 → 귀신계 여권 대화를 즉시 이어간다!
  useEffect(() => {
    if (sourceTab !== 'trash') return;
    let handledInThisMount = false;
    const onConnectedInSecretary = () => {
      if (
        handledInThisMount ||
        getSharedMonsterChatState().messages.some((m) =>
          m.id.startsWith('secretary_engine_rite_complete_')
        )
      ) {
        return;
      }
      handledInThisMount = true;
      let pendingCare = SECRETARY_FIRST_CARE_QUERY;
      try {
        sessionStorage.removeItem('ghosti_awaiting_engine_rite');
        const saved = sessionStorage.getItem('ghosti_pending_secretary_care_query');
        if (saved && saved.trim()) {
          pendingCare = saved.trim();
        }
        sessionStorage.removeItem('ghosti_pending_secretary_care_query');
      } catch {
        /* ignore */
      }
      const curSt = loadGhostSecretaryState();
      const nickLabel = curSt.nickname ? `${curSt.nickname}님` : '회원님';
      setSharedMonsterMessages((prev) => {
        if (prev.some((m) => m.id.startsWith('secretary_engine_rite_complete_'))) return prev;
        return [
          ...prev,
          {
            id: `secretary_engine_rite_complete_${Date.now()}`,
            role: 'assistant',
            timestamp: nowTimeKo(),
            sourceTab: 'trash',
            text:
              `내 컴퓨터 연결이 완료되었습니다 ${nickLabel}. 백그라운드에서 내 사진·동영상·문서를 읽어두고 있습니다.\n` +
              `잠시 후 귀신검색에서 내 파일로 바로 검색하실 수 있습니다. 먼저 **내 컴퓨터 상태 분석표**를 보여드리겠습니다.`,
          },
        ];
      });
      window.setTimeout(async () => {
        if (
          getSharedMonsterChatState().messages.some((m) => m.cardKind === 'PC_SPEC_CONSULTATION')
        ) {
          return;
        }
        setSharedMonsterBusy(true);
        try {
          const routerReply = await processUnifiedMonsterChatQuery({
            query: pendingCare,
            sourceTab: 'trash',
            literacyLevel,
            ttsEnabled: false,
          });
          setSharedMonsterMessages((prev) => [...prev, routerReply]);
        } finally {
          setSharedMonsterBusy(false);
        }
      }, 320);
    };

    const onZCoreConnectedBackup = () => {
      try {
        if (sessionStorage.getItem('ghosti_pending_secretary_care_query')) {
          onConnectedInSecretary();
        }
      } catch {
        /* ignore */
      }
    };

    window.addEventListener('ghosti_engine_connected_in_secretary', onConnectedInSecretary);
    window.addEventListener('zCoreConnected', onZCoreConnectedBackup);
    return () => {
      window.removeEventListener('ghosti_engine_connected_in_secretary', onConnectedInSecretary);
      window.removeEventListener('zCoreConnected', onZCoreConnectedBackup);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceTab]);

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
    <aside
      className="flex flex-col h-[545px] min-h-[500px] sm:h-[calc(100dvh-155px)] sm:min-h-[580px] max-h-[840px] rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
    >
      {/* 상단 헤더 */}
      <div
        title={careScheduleSummary}
        className="px-3.5 py-2.5 bg-white border-b border-slate-200 flex items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2 shrink-0">
          <img
            src={GHOST_SECRETARY_AVATAR_SRC}
            alt=""
            aria-hidden="true"
            className="w-6 h-6 rounded-full object-cover border border-slate-200 shrink-0"
          />
          <span className="text-[13.5px] font-semibold text-slate-900 tracking-tight whitespace-nowrap">
            귀신비서
          </span>
          <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-medium whitespace-nowrap">
            실행 취소 지원
          </span>
        </div>
        <div className="flex items-center justify-end gap-1.5 min-w-0 flex-1 overflow-hidden">
          {isMobileOrStore ? (
            <VoiceActorControlPill compact />
          ) : (
            <span className="text-[11px] font-medium text-slate-500 truncate">
              {careScheduleSummary}
            </span>
          )}
        </div>
      </div>

      {/* 상단 보조 바 */}
      {(!isMobileOrStore || isZCoreLive) && (
        <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 text-[12px] text-slate-600">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span className="whitespace-normal break-keep leading-snug">
              언제든 &lsquo;원래대로 돌려줘&rsquo;라고 입력하면 되돌릴 수 있습니다
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 max-w-full min-w-0">
            {!(isMobileOrStore && !isZCoreLive) && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleSend('최근 [복원 기록] 보여줘', 'text')}
                title="최근 손보기·정리 내역 조회 및 되돌리기"
                className="px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-[11.5px] font-medium transition cursor-pointer whitespace-nowrap"
              >
                복원 기록
              </button>
            )}
            {!isMobileOrStore && (
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('ghosti_navigate_showroom'))}
                title="온보딩 체험관으로 이동"
                className="px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-[11.5px] font-medium transition cursor-pointer whitespace-nowrap"
              >
                체험관
              </button>
            )}
          </div>
        </div>
      )}

      {/* 대화 본문 */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-3.5 sm:px-4 py-4 space-y-3.5 bg-white"
      >
        {(() => {
          const activePendingId =
            messages.find((m) => m.role !== 'user' && !completedSecretaryAnimIds.has(m.id))?.id ??
            null;
          let foundActive = false;
          return messages.map((msg) => {
            const isUser = msg.role === 'user';
            if (!isUser && activePendingId) {
              if (msg.id === activePendingId) {
                foundActive = true;
              } else if (foundActive && !completedSecretaryAnimIds.has(msg.id)) {
                return null;
              }
            }
            return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center gap-1.5 mb-1 px-1">
                {isUser ? (
                  <>
                    <span className="text-[11px] text-slate-400">{msg.timestamp}</span>
                    <span className="text-[12px] font-medium text-slate-600 flex items-center gap-1">
                      나 <User className="w-3.5 h-3.5" />
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[12px] font-semibold text-slate-800 flex items-center gap-1.5">
                      <img
                        src={GHOST_SECRETARY_AVATAR_SRC}
                        alt=""
                        aria-hidden="true"
                        className="w-5 h-5 rounded-full object-cover border border-slate-200"
                      />
                      {GHOST_SECRETARY_NAME}
                    </span>
                    <span className="text-[11px] text-slate-400">{msg.timestamp}</span>
                  </>
                )}
              </div>

              <div
                className={`max-w-[95%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-line break-words [overflow-wrap:anywhere] overflow-hidden ${
                  isUser
                    ? 'bg-teal-600 text-white rounded-tr-xs font-medium'
                    : 'bg-teal-50/35 border border-teal-100/90 text-slate-800 rounded-tl-xs'
                }`}
              >
                {isUser ? (
                  msg.text.replace(/\*\*/g, '')
                ) : (
                  <AnimatedSecretaryText
                    messageId={msg.id}
                    text={msg.text}
                    onProgressScroll={() => {
                      const el = scrollContainerRef.current;
                      if (el) el.scrollTop = el.scrollHeight;
                    }}
                    onComplete={() => setTick((t) => t + 1)}
                  />
                )}

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

                {!isUser && msg.passportViralFamilyName && (
                  <div className="mt-2.5 pt-2 border-t border-slate-200 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={async () => {
                        const famName = msg.passportViralFamilyName || '';
                        const st = useSaySeeStore.getState();
                        st.setActiveLoungeType?.('family');
                        st.setDesktopTab?.('share');
                        st.setMobileTab?.('share');
                        const guestPreviewUrl = `https://ghosti.sundreamer.app/?preview=guest&invite=family_${encodeURIComponent(famName)}`;
                        const shareText = `[귀신같이] 『${famName}』 가족 사진방 미리보기 링크입니다.\n${guestPreviewUrl}`;
                        if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
                          try {
                            await navigator.share({
                              title: `『${famName}』 가족 사진방 미리보기`,
                              text: `『${famName}』 사진방을 확인해 보세요.`,
                              url: guestPreviewUrl,
                            });
                            return;
                          } catch {
                            /* Web Share 취소 시 클립보드 복사로 폴백 */
                          }
                        }
                        try {
                          await navigator.clipboard?.writeText(shareText);
                        } catch {
                          /* ignore */
                        }
                        onToast?.(
                          `『${famName}』 가족 사진방 미리보기 링크가 복사되었습니다.`,
                        );
                      }}
                      className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12px] font-semibold transition cursor-pointer text-left"
                    >
                      『{msg.passportViralFamilyName}』 가족 사진방 링크 공유
                    </button>
                  </div>
                )}

                {!isUser && msg.showMobileToPcBridgeButton && (
                  <div className="mt-2.5 pt-2 border-t border-slate-200 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={async () => {
                        await useSaySeeStore.getState().sharePcMasterUrlToKakao();
                        onToast?.(
                          '카카오톡(나에게 보내기) 및 클립보드에 PC 실행 링크를 저장했습니다.',
                        );
                      }}
                      className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12px] font-semibold transition cursor-pointer text-left"
                    >
                      카카오톡에 PC 실행 링크 저장 / 주소 복사
                    </button>
                  </div>
                )}

                {!isUser && msg.followUpSuggestions && msg.followUpSuggestions.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-slate-200 flex flex-wrap gap-1.5">
                    {msg.followUpSuggestions.map((sug, sIdx) => {
                      const casualSug = normalizeSuggestionChipTone(sug);
                      return (
                        <button
                          key={sIdx}
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setSharedMonsterMessages((prev) =>
                              prev.map((m) => (m.id === msg.id ? { ...m, followUpSuggestions: [] } : m))
                            );
                            void handleSend(casualSug, 'text');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-[12.5px] font-medium text-slate-700 transition cursor-pointer text-left break-words [overflow-wrap:anywhere]"
                        >
                          {casualSug}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* 첫 환영 말풍선 안 1회성 대답 칩 */}
                {!isUser &&
                  showWelcomeQuickCareActions &&
                  !welcomeChipsDismissed &&
                  !isMobileOrStore &&
                  !awaitingNickname &&
                  messages.length === 1 &&
                  !/별명\(닉네임\)/.test(msg.text) &&
                  msg.id === 'monster_welcome_init' && (
                    <div className="mt-2.5 pt-2.5 border-t border-slate-200 flex flex-wrap gap-1.5">
                      {!isZCoreLive ? (
                        <>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setWelcomeChipsDismissed(true);
                              void handleSend('응, 엔진 연결하고 1초 건강검진 해줘', 'text');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12.5px] font-semibold transition cursor-pointer text-left break-words"
                          >
                            내 컴퓨터 연결하고 상태 분석하기
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setWelcomeChipsDismissed(true);
                              void handleSend('일단 눈으로 구경부터 할래', 'text');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-[12.5px] font-medium text-slate-700 transition cursor-pointer text-left break-words"
                          >
                            일단 둘러보기
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setWelcomeChipsDismissed(true);
                              void handleSend('부팅할 때 켜지는 시작프로그램 목록도 보여줘', 'text');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12.5px] font-semibold transition cursor-pointer text-left break-words"
                          >
                            시작프로그램 목록 보기
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setWelcomeChipsDismissed(true);
                              void handleSend('응, 앞으로 알아서 재우고 깨워줘', 'text');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-[12.5px] font-medium text-slate-700 transition cursor-pointer text-left break-words"
                          >
                            안 쓰는 은행 보안프로그램 자동 절전 설정
                          </button>
                        </>
                      )}
                    </div>
                  )}
              </div>
            </div>
          );
          });
        })()}

        {busy && (
          <div className="flex items-center gap-2 text-[12.5px] font-medium text-slate-500 px-2 py-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-400 animate-pulse" />
            확인하고 있습니다...
          </div>
        )}
      </div>

      {/* 공유방 복귀 바 */}
      {pendingReturnShareRoom && (
        <div className="px-3.5 py-2.5 border-t border-slate-200 bg-slate-50 flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-semibold text-slate-800 truncate">
              『{pendingReturnShareRoom.roomTitle}』 사진 추가 대기 중
            </span>
            {!isZCoreLive && (
              <button
                type="button"
                onClick={() => void returnToSharedRoomAndOpenUpload()}
                className="text-[11px] font-medium text-slate-500 hover:text-slate-800 underline shrink-0 cursor-pointer"
              >
                그냥 방으로 돌아가기
              </button>
            )}
          </div>
          {isZCoreLive ? (
            <button
              type="button"
              onClick={() => void returnToSharedRoomAndOpenUpload()}
              className="w-full py-2 px-3.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-[12.5px] transition-colors cursor-pointer flex items-center justify-center"
            >
              &lsquo;{pendingReturnShareRoom.roomTitle}&rsquo;으로 가서 내 사진 올리기
            </button>
          ) : (
            <p className="text-[11.5px] text-slate-600 leading-snug">
              위 채팅에서 내 컴퓨터 연결을 마치면 사진 올리기 버튼이 활성화됩니다.
            </p>
          )}
        </div>
      )}

      {/* 하단 입력창 */}
      <div className="px-3.5 py-3 border-t border-slate-200 bg-white">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            unlockMobileAudioOnUserGesture();
            void handleSend(undefined, 'text');
          }}
          className="flex items-center gap-1.5 sm:gap-2 w-full min-w-0"
        >
          <input
            id="ghosti-secretary-chat-input"
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onFocus={() => {
              if (
                isMobileOrStore &&
                typeof navigator !== 'undefined' &&
                !/iPhone|iPad|iPod/i.test(navigator.userAgent || '')
              ) {
                window.setTimeout(() => {
                  const el = scrollContainerRef.current;
                  if (el && el.scrollHeight - el.scrollTop - el.clientHeight > 8) {
                    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
                  }
                }, 80);
              }
            }}
            placeholder={
              isMicListening
                ? '듣고 있습니다...'
                : isMobileOrStore
                ? currentRollingPlaceholder
                : `예) ${currentRollingPlaceholder}`
            }
            className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-white border border-slate-300 focus:border-slate-900 focus:outline-none text-[13px] text-slate-900 placeholder:text-slate-400 transition-colors"
          />
          {isMobileOrStore && (
            <button
              type="button"
              onClick={toggleChatMicRecording}
              disabled={busy}
              title="음성으로 말하기"
              className={`px-2.5 sm:px-3 py-2 rounded-lg text-[12px] font-medium flex items-center gap-1 transition shrink-0 cursor-pointer border ${
                isMicListening
                  ? 'bg-rose-600 text-white border-rose-600'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
              }`}
            >
              {isMicListening ? <MicOff className="w-4 h-4 shrink-0" /> : <Mic className="w-4 h-4 shrink-0" />}
              <span className="shrink-0">{isMicListening ? '듣는중' : '음성'}</span>
            </button>
          )}
          <button
            type="submit"
            disabled={busy || !inputText.trim()}
            aria-label="전송"
            className={`${
              isMobileOrStore && !inputText.trim() ? 'px-2.5' : 'px-3'
            } py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-[12.5px] font-semibold flex items-center justify-center gap-1 transition shrink-0 cursor-pointer`}
          >
            <Send className="w-4 h-4 shrink-0" />
            {(!isMobileOrStore || Boolean(inputText.trim())) && <span className="shrink-0">전송</span>}
          </button>
        </form>
      </div>
    </aside>
  );
};
