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
import {
  unlockMobileAudioOnUserGesture,
  notifyMicSessionEndedForTts,
  isMobileVoiceEnvironment,
} from '../services/setupMonsterTts';
import { transcribeAudioBlobViaCloud } from '../services/aiEngine';
import { normalizeSpokenKoreanQuery } from '../services/voiceSearchAndAiBatonEngine';
import { useSaySeeStore } from '../store/useSaySeeStore';
import { hasActiveGhostiLoginSession, zCoreBridge } from '../services/zCoreBridge';
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
  canKnockToday,
  todayKey,
  decidePassportEntry,
  executeMobileSteppingStoneScan,
  buildMobileRemainingPhotosChoicePrompt,
  buildMobileToPcBridgePrompt,
  findScenario,
  renderPlaybookText,
  upsertPassportMember,
  isImpatientIntent,
  isStoreLinkIntent,
  isYes,
  isNo,
  parseNicknameSettingIntent,
  type GhostSecretaryState,
  type PassportNamingResult,
} from '../services/ghostSecretaryEngine';
import {
  pushGhostPassportsToCloud,
  pullGhostPassportsFromCloud,
  buildPassportExtrasFromClusters,
} from '../services/ghostPassportSync';
import { rankPassportCandidates, countUniqueFacePhotos } from './GhostPassportCandidatesPanel';

/** [v1.3] 귀신비서 점괘 직후 이어지는 1클릭 검진 문구 — 기존 손보기 라우터가 처리하는 문장과 동일해야 함 */
const SECRETARY_FIRST_CARE_QUERY = '지금 PC가 좀 느린데 1초 건강검진 해줘';

function nowTimeKo(): string {
  return new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function secretaryOwnerEmail(): string {
  return useSaySeeStore.getState().merlinAuth?.email || '';
}

/** 홀림 퀘스트 마지막(차 안 음성검색 안내) 직후 → 🪪 귀신계 여권 진입 또는 업무용 PC 자동 패스 (모바일은 100→300→500장 징검다리 스캔 연결) */
function buildPassportEntryTurn(
  st: GhostSecretaryState,
  isMobileEnv = false
): { text: string; nextState: GhostSecretaryState } {
  const state = useSaySeeStore.getState();
  const clusters = state.faceClusters || [];
  const photos = state.photos || [];
  const nickname = st.nickname || '';

  let nextSt: GhostSecretaryState = { ...st };
  let effectiveFacePhotos = countUniqueFacePhotos(clusters);

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

  if (decidePassportEntry(effectiveFacePhotos, st.passportStep === 'done') === 'ask') {
    const sc = findScenario('passport_ask_gender_age_humble');
    return {
      text: renderPlaybookText(sc?.response || '', { nickname }),
      nextState: { ...nextSt, passportStep: 'ask_hint' },
    };
  }
  return {
    text: `${nickname}님, 기본 세팅은 다 끝났어요! 이제 바로 아래 『👻 귀신검색』에서 10초 만에 직접 불러보는 마법을 따라 해볼까요?`,
    nextState: { ...nextSt, passportStep: 'skipped' },
  };
}

/** 채팅으로 받은 실명을 여권 후보 번호에 등록 (관계 칩 없이 실명만, 본인은 별명+본인 플래그) */
async function applyPassportNaming(parsed: PassportNamingResult, nickname: string): Promise<void> {
  const store = useSaySeeStore.getState();
  const ranked = rankPassportCandidates(store.faceClusters || []);
  let book = loadGhostPassportBook();
  const named: Array<{ name: string; seedVecPreview?: number[]; avatarUrl?: string; cropUrl?: string }> = [];
  if (parsed.selfIndex !== undefined && ranked[parsed.selfIndex - 1]) {
    const selfCluster = ranked[parsed.selfIndex - 1];
    await store.registerFaceMember(selfCluster.clusterId, nickname, '');
    book = setPassportSelf(book, nickname);
    named.push({ name: (book.self?.realName || nickname).trim(), seedVecPreview: selfCluster.seedVecPreview, avatarUrl: selfCluster.avatarUrl, cropUrl: selfCluster.cropUrl });
  }
  for (const n of parsed.names) {
    const cluster = ranked[n.index - 1];
    if (cluster) {
      await store.registerFaceMember(cluster.clusterId, n.realName, '');
      named.push({ name: n.realName, seedVecPreview: cluster.seedVecPreview, avatarUrl: cluster.avatarUrl, cropUrl: cluster.cropUrl });
    }
    book = upsertPassportMember(book, n.realName);
  }
  saveGhostPassportBook(book);
  // [v1.3 마감 #4-4] 클러스터에 128차원 벡터·data: 썸네일이 있으면 함께 동기화 (없으면 이름만, null 안전)
  void pushGhostPassportsToCloud(
    secretaryOwnerEmail(),
    isMobileVoiceEnvironment() ? 'mobile' : 'pc',
    buildPassportExtrasFromClusters(named)
  );
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
      const t = buildWelcomeTurn(loadGhostSecretaryState());
      saveGhostSecretaryState(t.nextState);
      setAwaitingNickname(Boolean(t.nextState.awaitingNickname));
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

    // [Stage 1: 최초 1회 은행 보안프로그램 속도 저하 브리핑 & 1회성 동의 칩 (한 턴 연타 금지 · 호흡 분리)]
    if (
      !isMobileOrStore &&
      hasActiveGhostiLoginSession() &&
      zCoreBridge.isConnected &&
      !turn.nextState.awaitingNickname &&
      !turn.nextState.consents?.bankSecurityAutoSleep &&
      !turn.nextState.bankSleepIntroShownAt
    ) {
      void fetch('http://127.0.0.1:5199/api/care/security-services/status')
        .then((r) => r.json())
        .catch(() => null)
        .then((secRes) => {
          const curSt = loadGhostSecretaryState();
          if (curSt.bankSleepIntroShownAt || curSt.consents?.bankSecurityAutoSleep) return;
          const activeCount = Math.max(2, Number(secRes?.activeCount || 3));
          const ramMb = Math.max(180, Number(secRes?.estimatedRamMb || 320));
          const nickLabel = curSt.nickname ? `${curSt.nickname}님, ` : '';
          saveGhostSecretaryState({
            ...curSt,
            bankSleepIntroShownAt: new Date().toISOString(),
          });
          setSharedMonsterMessages((prev) => {
            if (prev.some((m) => m.id.startsWith('secretary_bank_sleep_intro_'))) return prev;
            return [
              ...prev,
              {
                id: `secretary_bank_sleep_intro_${Date.now()}`,
                role: 'assistant',
                timestamp: nowTimeKo(),
                sourceTab: 'trash',
                text:
                  `👻 ${nickLabel}제가 방금 컴퓨터 뒤쪽을 점검해 봤는데요! 지금 안 쓰시는 **은행·관공서 보안프로그램 ${activeCount}개(약 ${ramMb}MB)**가 뒤에서 메모리를 차지하며 컴퓨터 속도를 늦추고 있어요.\n` +
                  `제가 이 프로그램들을 지우지 않고 **평소엔 잠재워 두었다가, 은행·홈택스 들어가실 때만 귀신같이 깨워드릴까요?** (한 번만 OK 해주시면 앞으로 제가 알아서 다 챙깁니다!)`,
                followUpSuggestions: [
                  '👍 응, 앞으로 알아서 재우고 깨워줘',
                ],
              },
            ];
          });
        });
    } else if (
      // [Stage 2: 호흡 분리 후 다음번 진입 시 — 다운로드 폴더 압축파일 최소 3건 이상(>=3) 누적 시 숨은 초능력 & 압축 풀기 안내]
      !isMobileOrStore &&
      hasActiveGhostiLoginSession() &&
      zCoreBridge.isConnected &&
      !turn.nextState.awaitingNickname &&
      (turn.nextState.consents?.bankSecurityAutoSleep || turn.nextState.bankSleepIntroShownAt) &&
      !turn.nextState.hiddenSuperpowersShown
    ) {
      void fetch('http://127.0.0.1:5199/api/care/security-services/status')
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
                  `👻 ${nickLabel}참! 제가 뒤에서 컴퓨터를 챙기다 보니 지금 다운로드 폴더에 압축파일${sampleHint}이 **총 ${zipCount}건** 쌓여 있더라고요.\n` +
                  `제가 사진 정리랑 속도 관리 말고도 뒤에서 조용히 돕는 **'숨은 초능력'이 두 가지(광고 없는 파일 경호 & 우클릭 0.35초 압축 풀기)** 더 있는데, 우리 걸로 써보실 수 있게 간단히 알려드릴까요?`,
                followUpSuggestions: [
                  '✨ 응, 숨은 초능력 두 가지 알려줘',
                  '📂 다운로드 폴더 열어서 우클릭 0.35초 써보기',
                ],
              },
            ];
          });
        });
    }
    // [v1.3 #7] 같은 계정의 다른 기기에서 만든 🪪 귀신계 여권 무료 동기화 (로그인 시에만)
    void pullGhostPassportsFromCloud(secretaryOwnerEmail()).then((res) => {
      if (!res.ok || res.newNames.length === 0) return;
      const st = loadGhostSecretaryState();
      const sc = findScenario('passport_cross_device_supabase_synced');
      if (!sc) return;
      setSharedMonsterMessages((prev) => [
        ...prev,
        {
          id: `secretary_passport_sync_${Date.now()}`,
          role: 'assistant',
          timestamp: nowTimeKo(),
          sourceTab: 'trash',
          text: renderPlaybookText(sc.response, { nickname: st.nickname || '', synced_names: res.newNames.join(', ') }),
        },
      ]);
    });
    return () => {
      window.removeEventListener('ghosti_jump_to_secretary', onJumpRefresh);
    };
  }, [sourceTab]);

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
      // [v1.3] 전사 단일 웹 알림 = 귀신비서 채팅 노크 (대답할 때까지 하루 1회만)
      if (!canKnockToday(loadGhostSecretaryState())) return;
      const briefing = await evaluateDualProactiveCareEngine({
        isStoreAppMode: isMobileOrStore,
      });
      if (!briefing || cancelled) return;
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
          m.cardKind === 'RESTORE_POINTS_LIST' ||
          /은행·관공서\s*보안프로그램.*?깨워드릴까요|숨은\s*초능력.*?알려드릴까요/.test(m.text || '')
      );
    const isDirectCareOrStatusCommand =
      /(진행해|실행해|정리해|치워줘|복구해|복원\s*기록|복원\s*지점|복원해|되돌려|원복|원래대로|진행된|진행한|정리된|정리한|다\s*된|완료된|개선된|빨라졌|1초\s*건강|임시\s*설치|바탕화면|다운로드|[c-zC-Z]\s*드라이브|사양|스펙|상태\s*봐|느려|느린|버벅|애드웨어|보안\s*모듈|보안\s*프로그램|알아서\s*재우고|숨은\s*초능력|비서\s*실적|실적\s*보고서|우클릭\s*0\.35초|은행\s*업무.*?깨워|강제\s*종료|지워\s*줘|삭제해\s*줘|적출|언인스톨|뿌리째|뿌리\s*뽑|유령\s*앱)/i.test(
        raw
      );
    const shouldBypassSecretaryPlaybook =
      isDirectCareOrStatusCommand ||
      (hasPendingCareApproval &&
        /^(응|네|넹|예|좋아|좋아요|ㅇㅇ|ㅇㅋ|오케이|ok|그래|해줘|알려줘|뭔데|진행|실행|승인|동의|콜|고고|#?\d+\s*번?)/i.test(raw));

    // [v1.3 필수 통과의례 게이트]: PC에서 아직 로컬 엔진(Z-코어)이 연결되지 않은 상태일 때,
    // 별명 등록 이후 손보기 동의 / 급한 검색 요청 / 거절(눈으로 구경) 분기를 귀신비서가 정직하고 귀엽게 직접 안내!
    if (sourceTab === 'trash' && !isMobileOrStore && !zCoreBridge.isConnected) {
      const preSt = loadGhostSecretaryState();
      const hasNicknameReady = !preSt.awaitingNickname && Boolean(preSt.nickname);
      const isNickOrStoreSpecial =
        Boolean(parseNicknameSettingIntent(raw, preSt.nickname)) || isStoreLinkIntent(raw);

      if (hasNicknameReady && !isNickOrStoreSpecial) {
        const nickLabel = preSt.nickname ? `${preSt.nickname}님` : '회원님';
        const awaitingRite =
          typeof sessionStorage !== 'undefined' &&
          sessionStorage.getItem('ghosti_awaiting_engine_rite') === '1';
        const isBrowseOrRefuseEngine =
          /(구경\s*부터|구경\s*만|눈으로\s*구경|안\s*깔|설치\s*안|엔진\s*싫|깔기\s*싫)/i.test(raw) ||
          (awaitingRite && isNo(raw));
        const isAgreeOrCareOrImpatient =
          /(엔진\s*연결|연결\s*해|연결하고|설치\s*해|깔아|깔래|마음\s*바꿨)/i.test(raw) ||
          isDirectCareOrStatusCommand ||
          isImpatientIntent(raw) ||
          (awaitingRite && isYes(raw));

        if (isBrowseOrRefuseEngine) {
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
                `헤헤 알겠어요 ${nickLabel}! 억지로 깔지 않으셔도 괜찮아요 👻\n` +
                `왼쪽 메뉴들(『👻 귀신검색』, 『⚡ 귀신창 초능력』 등)을 눌러 위아래로 스크롤하며 어떤 마법들이 있는지 눈으로 편하게 구경해 보세요!\n` +
                `(단, 버튼을 클릭해 직접 활동하거나 내 진짜 사진·문서로 리얼 테스트하는 건 저랑 엔진 연결을 마친 뒤에 열려요!) 마음이 바뀌시면 언제든 아래 버튼을 눌러주세요!`,
              followUpSuggestions: ['🤝 마음 바꿨어! 엔진 연결하고 1초 건강검진 해줘'],
            },
          ]);
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
              isDirectCareOrStatusCommand && !/마음\s*바꿨|엔진\s*연결/.test(raw)
                ? raw
                : SECRETARY_FIRST_CARE_QUERY
            );
          } catch {
            /* ignore */
          }
          const riteText = isImpatientIntent(raw)
            ? `앗, 급하시군요 ${nickLabel}! 내 진짜 사진·문서를 1초 만에 찾으시려면 먼저 여기서 **귀신비서 전용 로컬 엔진(무광고 · 샘플 사진 0장 · 외부 전송 0%)**만 딱 한 번 켜주셔야 해요!\n연결되자마자 뒤에서 내 진짜 파일들을 조용히 읽어들여 바로 검색하실 수 있게 해드릴게요. 지금 연결 창을 띄워 드렸어요 👻⚡`
            : `좋아요 ${nickLabel}! 제가 웹 화면 밖으로 손이 닿아 진짜 묵은 먼지를 털어드리고, 뒤에서 **샘플 사진 한 장 없이 오직 내 진짜 사진·문서만 조용히 읽어두려면** 전용 로컬 엔진만 딱 한 번 켜주시면 돼요!\n지금 연결 안내창을 띄워 드렸어요 — 켜주시는 즉시 제가 이어서 **1초 건강검진**까지 알아서 다 해드릴게요 👻✨`;

          setSharedMonsterMessages((prev) => [
            ...prev,
            {
              id: `secretary_open_engine_${Date.now()}`,
              role: 'assistant',
              timestamp: nowTimeKo(),
              sourceTab,
              text: riteText,
              followUpSuggestions: ['👀 일단 눈으로 구경부터 할래'],
            },
          ]);
          window.dispatchEvent(new CustomEvent('openZCoreGuideModal'));
          setSharedMonsterBusy(false);
          return;
        }
      }
    }

    if (sourceTab === 'trash' && !shouldBypassSecretaryPlaybook) {
      const secretaryState = loadGhostSecretaryState();
      const turn = resolveGhostSecretaryTurn(raw, secretaryState, {
        passportClusterCount: rankPassportCandidates(useSaySeeStore.getState().faceClusters || []).length,
      });
      if (turn) {
        let nextState = turn.nextState;
        if (turn.passportNaming && nextState.nickname) {
          await applyPassportNaming(turn.passportNaming, nextState.nickname);
        }
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
        if (turn.passportNaming && nextState.nickname && isMobileOrStore && !nextState.mobileRemainingScanChoice) {
          const remainingPhotos =
            nextState.mobileRemainingOldPhotos ??
            Math.max(0, (useSaySeeStore.getState().photos || []).length - (nextState.mobileSteppingStoneScanned || 100));
          const choicePrompt = buildMobileRemainingPhotosChoicePrompt(nextState.nickname, remainingPhotos);
          if (choicePrompt) {
            replies.push({
              id: `secretary_mobile_remaining_${Date.now()}`,
              role: 'assistant',
              timestamp: nowTimeKo(),
              sourceTab,
              text: choicePrompt.text,
              followUpSuggestions: choicePrompt.followUps,
            });
          }
        }
        if (turn.passportNaming && isMobileOrStore) {
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
          const reading = buildColdReadingText(nextState.nickname, ctx);
          const needsEngineRite = !isMobileOrStore && !zCoreBridge.isConnected;
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
            followUpSuggestions: needsEngineRite
              ? ['🤝 응, 엔진 연결하고 1초 건강검진 해줘', '👀 일단 눈으로 구경부터 할래']
              : [
                  SECRETARY_FIRST_CARE_QUERY,
                  '✨ 귀신비서의 숨은 초능력 알려줘',
                ],
          });
          nextState = { ...nextState, coldReadingShownAt: new Date().toISOString() };
        }
        if (turn.scenarioId === 'quest_mobile_voice_search') {
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
        // 대본집·손보기 라우터 어디에도 정형 매칭되지 않은 자유 질문 → 주간 대본집 편입 후보로 포집
        logUnmatchedQuestion(raw, 'no_playbook_match');
      }
      const isExplicitFirstCareQuery = /(1초\s*건강\s*검진|건강\s*검진\s*(해\s*줘|해\s*주세요|실행|시작))/i.test(raw);
      if (assistantMsg.healthRecordIssued) {
        onHealthRecordAdded(assistantMsg.healthRecordIssued);
      }
      if (assistantMsg.healthRecordIssued || isExplicitFirstCareQuery) {
        const storeNow = useSaySeeStore.getState();
        const pendingShare = storeNow.pendingReturnShareRoom;
        const realTrashCandidatesCount = (storeNow.photos || []).filter(
          (p) => p.trashCategory && !p.quarantined && !/^(IMG_2025|PET_2025|TRV_2025|DOC_2025|MEMO_2025|Screenshot_2025|BLUR_2025)/.test(p.name)
        ).length;

        // 사진 정리 후보가 많을 때(>= 15장) 비서가 먼저 유연하게 '남은 사진 정리는 다음에' 선택지를 제안
        if (sourceTab === 'trash' && realTrashCandidatesCount >= 15) {
          window.setTimeout(() => {
            setSharedMonsterMessages((prev) => [
              ...prev,
              {
                id: `secretary_proactive_defer_${Date.now()}`,
                role: 'assistant',
                timestamp: nowTimeKo(),
                sourceTab,
                text: `💡 참고로 내 컴퓨터에서 찾아낸 중복·흔들린 정리 후보 사진이 총 **${realTrashCandidatesCount}장** 있어요! 스캔은 방금 1초 만에 다 끝났지만, 양이 좀 있으니 바쁘시면 지금 다 고르지 않으시고 **"남은 사진 정리는 다음에"** 하셔도 제가 책갈피 해둘게요 👻`,
                followUpSuggestions: [
                  '⏭️ 남은 사진 정리는 다음에 할래',
                  `⚡ 원본 남기고 ${realTrashCandidatesCount}장 한 번에 정리해줘`,
                ],
              },
            ]);
          }, 550);
        }

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
                text: `📸 준비 완료예요! 내 컴퓨터 새 사진 색인과 1초 점검이 모두 끝났어요.\n아래 초록색 **[아까 보던 '${pendingShare.roomTitle}'으로 가서 내 사진 올리기 ➔]** 버튼만 누르시면 바로 가족방으로 돌아가서 내 사진을 골라 올리실 수 있어요! (남은 사진 정리는 다음에 천천히 하셔도 돼요 👻✨)`,
                followUpSuggestions: ['⏭️ 남은 사진 정리는 다음에 할래'],
              },
            ]);
          }, 800);
        } else {
          // [v1.3] 일반 진입 시 첫 손보기 완료 직후 → 홀림 퀘스트 ① 귀신 라벨러 샘플 제안부터 시작
          const st = loadGhostSecretaryState();
          if (sourceTab === 'trash' && (!st.questStep || isExplicitFirstCareQuery)) {
            const quest = questPromptFor('labeler', st.nickname || '');
            if (quest) {
              saveGhostSecretaryState({
                ...st,
                questStep: 'labeler',
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

  // [v1.3 통과의례 완결]: 『1. 👻 귀신비서』 안에서 엔진이 연결된 순간, 탭 이탈 없이 뒤에서 조용히 내 진짜 파일을 인덱싱하면서
  // 채팅창에서는 축하 인사와 함께 실제 PC 1초 건강검진 → 홀림 퀘스트 → 귀신계 여권 대화를 즉시 이어간다!
  useEffect(() => {
    if (sourceTab !== 'trash') return;
    const onConnectedInSecretary = () => {
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
              `🎉 와아! 엔진 연결 성공이에요 ${nickLabel}! 지금부터 뒤에서는 샘플 사진 한 장 없이 **오직 내 컴퓨터의 진짜 사진·동영상·문서만** 컴퓨터 부하 없이 조용히 읽어두고 있어요!\n` +
              `잠시 후 『👻 귀신검색』에 가시면 내 진짜 파일들로 바로 리얼 테스트를 해보실 수 있답니다. 그동안 약속드린 **1초 건강검진**부터 바로 실행할게요!`,
          },
        ];
      });
      window.setTimeout(() => {
        void handleSend(pendingCare, 'text');
      }, 380);
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

      {/* 1. 상단 슬림 원복 안내 + 우측 상단 [🕰️ 복원 기록] 원클릭 버튼 */}
      <div className="px-3.5 py-2 bg-emerald-50/60 dark:bg-emerald-950/25 border-b border-emerald-200 dark:border-emerald-500/20 flex items-center justify-between gap-2 text-[12px] text-emerald-900 dark:text-emerald-200">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="shrink-0 font-bold">🛡️</span>
          <span className="font-bold text-emerald-800 dark:text-emerald-300 truncate">
            손보기 후 원하는 시점으로 복원 가능
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleSend('최근 [복원 기록] 보여줘', 'text')}
            title="최근 손보기·정리 내역 조회 및 원래대로 1초 되돌리기"
            className="px-2.5 py-1 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-[11.5px] font-extrabold shadow-xs transition cursor-pointer flex items-center gap-1 whitespace-nowrap"
          >
            <span>🕰️</span>
            <span>복원 기록</span>
          </button>
          {isMobileOrStore && <VoiceActorControlPill compact />}
        </div>
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
                    <span className="text-[12px] font-extrabold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                      <img
                        src={GHOST_SECRETARY_AVATAR_SRC}
                        alt=""
                        aria-hidden="true"
                        className="w-6 h-6 rounded-full object-cover shadow-sm ring-1 ring-emerald-400/40"
                      />
                      {GHOST_SECRETARY_NAME}
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

                {!isUser && msg.passportViralFamilyName && (
                  <div className="mt-2.5 pt-2 border-t border-emerald-200 dark:border-emerald-500/30 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={async () => {
                        const famName = msg.passportViralFamilyName || '';
                        const st = useSaySeeStore.getState();
                        st.setActiveLoungeType?.('family');
                        st.setDesktopTab?.('share');
                        st.setMobileTab?.('share');
                        const guestPreviewUrl = `https://ghosti.sundreamer.app/?preview=guest&invite=family_${encodeURIComponent(famName)}`;
                        const shareText = `📸 [귀신같이] 로그인·앱 설치 없이 1초 만에 열리는 『${famName}』 가족 사진방 구경 오세요!
👉 ${guestPreviewUrl}`;
                        if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
                          try {
                            await navigator.share({
                              title: `📸 『${famName}』 가족 사진방 1초 미리보기`,
                              text: `로그인·앱 설치 없이 1초 만에 열리는 『${famName}』 사진들을 구경해 보세요!`,
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
                          `📸 『${famName}』 가족 사진방 1초 미리보기 링크가 복사되었습니다! 가족 카톡방에 바로 붙여넣어 구경시켜 주세요.`,
                        );
                      }}
                      className="px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-[12px] font-black shadow-sm transition cursor-pointer text-left flex items-center gap-1.5"
                    >
                      <span>👨‍👩‍👧‍👦</span>
                      <span>방금 찾아낸 『{msg.passportViralFamilyName}』 사진 가족 카톡방에 1초 구경시켜 주기</span>
                    </button>
                  </div>
                )}

                {!isUser && msg.showMobileToPcBridgeButton && (
                  <div className="mt-2.5 pt-2 border-t border-teal-200 dark:border-teal-500/30 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={async () => {
                        await useSaySeeStore.getState().sharePcMasterUrlToKakao();
                        onToast?.(
                          '💻 카톡(나에게 보내기) 및 클립보드에 PC 실행 링크(⚡ 귀신창 초능력)를 담아두었습니다! 내일 출근해서 PC로 바로 켜보세요.',
                        );
                      }}
                      className="px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-[12px] font-extrabold shadow-sm transition cursor-pointer text-left flex items-center gap-1.5"
                    >
                      <span>💬</span>
                      <span>카톡(나에게 보내기)에 PC 실행 링크 넣어두기 / 📋 주소 복사</span>
                    </button>
                  </div>
                )}

                {!isUser && msg.followUpSuggestions && msg.followUpSuggestions.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-800/80 flex flex-wrap gap-1.5">
                    {msg.followUpSuggestions.map((sug, sIdx) => (
                      <button
                        key={sIdx}
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          // 1회성 대화형 칩: 클릭 즉시 해당 말풍선의 칩 목록을 비워 화면 공해 0% 유지
                          setSharedMonsterMessages((prev) =>
                            prev.map((m) => (m.id === msg.id ? { ...m, followUpSuggestions: [] } : m))
                          );
                          void handleSend(sug, 'text');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800/90 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-[11.5px] font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer text-left"
                      >
                        💬 {sug}
                      </button>
                    ))}
                  </div>
                )}

                {/* 첫 환영 말풍선 안 1회성 대답 칩 (재방문 유저 첫 진입 전용 · 신규 별명 질문 말풍선에는 영구 비노출) */}
                {!isUser &&
                  showWelcomeQuickCareActions &&
                  !welcomeChipsDismissed &&
                  !isMobileOrStore &&
                  !awaitingNickname &&
                  messages.length === 1 &&
                  !/별명\(닉네임\)/.test(msg.text) &&
                  msg.id === 'monster_welcome_init' && (
                    <div className="mt-2.5 pt-2.5 border-t border-slate-200 dark:border-slate-800/80 flex flex-wrap gap-1.5">
                      {!isZCoreLive ? (
                        <>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setWelcomeChipsDismissed(true);
                              void handleSend('🤝 응, 엔진 연결하고 1초 건강검진 해줘', 'text');
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/70 border border-emerald-300 dark:border-emerald-500/40 text-[11.5px] font-extrabold text-emerald-800 dark:text-emerald-300 transition cursor-pointer text-left"
                          >
                            🤝 응, 엔진 연결하고 1초 건강검진 해줘
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setWelcomeChipsDismissed(true);
                              void handleSend('👀 일단 눈으로 구경부터 할래', 'text');
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/90 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-[11.5px] font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer text-left"
                          >
                            👀 일단 눈으로 구경부터 할래
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setWelcomeChipsDismissed(true);
                              void handleSend('👍 응, 앞으로 알아서 재우고 깨워줘', 'text');
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/70 border border-emerald-300 dark:border-emerald-500/40 text-[11.5px] font-extrabold text-emerald-800 dark:text-emerald-300 transition cursor-pointer text-left"
                          >
                            🏦 안 쓰는 은행 보안프로그램 자동 재우기
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setWelcomeChipsDismissed(true);
                              void handleSend('✨ 귀신비서의 숨은 초능력 알려줘', 'text');
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/90 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-[11.5px] font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer text-left"
                          >
                            ✨ 숨은 초능력 2가지 알려줘
                          </button>
                        </>
                      )}
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

      {/* 공유방(가족방/모임방)에서 '내 사진 추가하기'를 눌러 우회해 온 경우 끊김 없는 원클릭 롤백 복귀 바 */}
      {pendingReturnShareRoom && (
        <div className="px-3.5 py-2.5 border-t border-teal-400/50 bg-gradient-to-r from-teal-950/90 via-emerald-950/90 to-zinc-950 flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11.5px] font-extrabold text-teal-200 truncate">
              👻 『{pendingReturnShareRoom.roomTitle}』 사진 추가 대기 중
            </span>
            {!isZCoreLive && (
              <button
                type="button"
                onClick={() => void returnToSharedRoomAndOpenUpload()}
                className="text-[11px] font-bold text-zinc-300 hover:text-white underline shrink-0 cursor-pointer"
              >
                그냥 방으로 돌아가기
              </button>
            )}
          </div>
          {isZCoreLive ? (
            <button
              type="button"
              onClick={() => void returnToSharedRoomAndOpenUpload()}
              className="w-full py-2.5 px-3.5 rounded-xl bg-[#2DD4BF] hover:bg-[#5EEAD4] text-zinc-950 font-black text-[12.5px] shadow-lg shadow-teal-500/25 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>
                📸 준비 완료! 아까 보던 &lsquo;{pendingReturnShareRoom.roomTitle}&rsquo;으로 가서 내 사진 올리기 ➔
              </span>
            </button>
          ) : (
            <p className="text-[11px] text-teal-100/85 leading-snug">
              위 채팅에서 <strong>엔진 연결 &amp; 1초 건강검진</strong>만 마치면 여기에 바로 <strong>내 사진 올리러 가기</strong> 버튼이 켜져요!
            </p>
          )}
        </div>
      )}

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
            id="ghosti-secretary-chat-input"
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
          {/* PC는 창 크기를 줄여도 100% 무음 텍스트 채팅 올인, 실제 모바일 기기에서만 [음성] 마이크 버튼 노출 */}
          {isMobileOrStore && (
            <button
              type="button"
              onClick={toggleChatMicRecording}
              disabled={busy}
              title="모바일 음성으로 말하기 (음성 입력 시에만 성우 음성으로 응답합니다)"
              className={`px-2 sm:px-3 py-2.5 rounded-xl text-[12px] sm:text-[13px] font-extrabold flex items-center gap-1 transition shrink-0 cursor-pointer border ${
                isMicListening
                  ? 'bg-rose-600 text-white border-rose-500 animate-pulse'
                  : 'bg-white hover:bg-emerald-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-emerald-700 dark:text-emerald-300 border-emerald-400/60 dark:border-emerald-500/40'
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
