import type { StateCreator } from 'zustand';
import { getZCoreUrl, zCoreBridge, ensureLoginAndZCoreReady } from '../../services/zCoreBridge';
import { submitExternalMonsterChatQuery } from '../../services/monsterChatRouter';
import {
  isMobileVoiceEnvironment,
  speakSetupMonsterTts,
  stopSetupMonsterTts,
  triggerSetupMonsterTtsPrewarm,
} from '../../services/setupMonsterTts';
import { analyzeMobilePickedPhotoFiles } from '../../services/mobilePhotoPicker';
import {
  dispatchFileToKakaoRealChatroom,
  extractKeywordSentencesZeroLlm,
  isMonsterCareIntentFromSearch,
  parseZeroLlmVoiceDocCommand,
  resolveTargetDocAndBuildFactAnswer,
  speakWithHyunsuOrSunhi,
  triggerUserFavoriteAiLiveVoiceBatonTouch,
} from '../../services/voiceSearchAndAiBatonEngine';
import type {
  AlumniStickChip,
  AnalogScannedPhotoItem,
  AnalogYearProposalItem,
  ClubFeedTrackId,
  ClubSizeTier,
  DuplicateGroup,
  FaceMemberCluster,
  FamilyRoomId,
  GlobalSwarmFaceCandidate,
  GpuHelperTierId,
  HardwareTelemetry,
  LocalDocumentFile,
  LoungeType,
  MerlinAuthState,
  MerlinCoinTopupBridgeState,
  OnboardingAhaItem,
  OnboardingTrackMode,
  PhotoItem,
  PricingPlanId,
  PrivateSyncStrategy,
  RoomPersonaMap,
  SearchResultItem,
  SearchSpaceMode,
  SetupAuditLogEntry,
  SetupChatTurn,
  SetupDiagnosisPlan,
  SetupFailureTelemetryEntry,
  SetupMonsterPlatform,
  SetupPreTriageQuestion,
  SetupProactiveHint,
  SetupSelfHealingOtaEntry,
  SwarmRetroScanReport,
  SyncMode,
  SyncState,
  TrashCategory,
  TrialScanPermissions,
  UndoQuarantineBatch,
  VideoSceneItem,
  VoiceRoutingTrace,
} from '../../types/saysee';
import {
  INITIAL_PROACTIVE_HINTS,
  buildSetupDiagnosisPlan,
  buildSetupPreTriageQuestion,
  executeRealOsAction,
  fetchRealPcOsInspection,
} from '../../services/setupMonsterEngine';
import { evaluateTrajectoryAndBuildSelfHealingOta } from '../../services/selfHealingEngine';
import {
  LOCAL_DOCUMENT_FILES,
  OnboardingProgressUpdate,
  PRESET_QUERIES,
  VIDEO_SCENE_ITEMS,
  detectHardwareTelemetry,
  detectLiveFacesFromPhoto,
  ensureTextQueryEncoderLoaded,
  ensureVideoKeyframesEmbeddedForSearch,
  executeTextSearch,
  executeZeroSttVoiceSearch,
  fetchAutonomousFaceClusters,
  fetchIndexedDocuments,
  fetchIndexedVideos,
  fetchSharedFamilyHostPhotos,
  hasUnindexedLocalVideos,
  isLocalVideosOcrIndexingPending,
  isTextQueryEncoderReady,
  normalizeLocalVideoSceneItem,
  loadInitialPhotoDataset,
  runOnboardingIndexingPipeline,
  searchLocalDocumentFilesAsync,
  searchVideoSceneItemsAsync,
  startSilentRealMediaVisionIndexing,
  updateFaceClusterRegistry,
} from '../../services/aiEngine';
import {
  LocalSentenceChip,
  TOTAL_CONCEPT_ANCHOR_COUNT,
  buildLocalSentenceSamplesFromCorpus,
} from '../../services/conceptLexicon';
import { loadMerlinAuth, toggleMerlinTier } from '../../services/merlinAuth';
import { loadSyncState, saveSyncPrefs } from '../../services/syncEngine';
import {
  executeMobileSteppingStoneScan,
  loadGhostSecretaryState,
  saveGhostSecretaryState,
} from '../../services/ghostSecretaryEngine';
import {
  DesktopTab,
  INITIAL_ONBOARDING_PROGRESS,
  MobileTab,
  SEASON_TO_MONTH_SYNONYM_INDEX,
  ThemeMode,
  ViewportLayout,
  applyHtmlThemeClass,
  buildAutoMultiConditionSeedClusters,
  buildBidirectionalStickKeywords,
  buildYearEquivalenceTokens,
  deriveLoungeProperNounTokens,
  getActivePersonaForCluster,
  isMobileOrStoreRuntime,
  quarantineFailureToast,
  quarantineResultNote,
  requestQuarantineOp,
  restoreAllExcludedCustomFaceRegistrations,
  saveCustomFaceRegistration,
  storeSharedRefs,
  voiceSession,
} from './storeSharedRefs';
import type { SaySeeStore } from '../useSaySeeStore';


/**
 * [2번 창: 🎯 [2귀신] 전담 스토어 Slice]
 * - 귀신검색(사진·동영상·문서 3-Track 시맨틱/음성/문장 검색 · 모달 · 연사 그룹핑) 상태
 */
export interface SearchSlice {
  // [스펙 1 & 체험판 타겟팅] 파워 검색 공간 3-Track 필터 ([🎬 동영상] | [🖼️ 사진] | [📁 문서])
  searchSpace: SearchSpaceMode;
  hasExecutedUserSearch: boolean;
  hasUserSelectedSearchTab: boolean;
  localDocuments: LocalDocumentFile[];
  matchedLocalDocs: LocalDocumentFile[];
  matchedVaultPhotos: SearchResultItem[];
  selectedDocModal: LocalDocumentFile | null;
  videoSceneItems: VideoSceneItem[];
  matchedVideoScenes: VideoSceneItem[];
  selectedVideoModal: VideoSceneItem | null;
  trialScanPermissions: TrialScanPermissions;
  setSearchSpace: (space: SearchSpaceMode) => void;
  resetSearchSpaceToAll: (space: SearchSpaceMode) => void;
  setSelectedDocModal: (doc: LocalDocumentFile | null) => void;
  setSelectedVideoModal: (vid: VideoSceneItem | null, seekSec?: number) => void;
  syncRealVideoDuration: (videoId: string, realDurationSec: number) => void;
  setTrialScanPermission: (folder: keyof TrialScanPermissions, allowed: boolean) => void;
  runBriefingHintChip: (target: 'doc' | 'video', query: string) => Promise<void>;


  // 음성 & 자연어 문장 검색 상태 + 검색 결과 연사 묶기 ([❐ N장 연사])
  activeQuery: string;
  matchedTags: string[];
  searchResults: SearchResultItem[];
  groupBurstsInSearch: boolean;
  isListening: boolean;
  isSlimCapsule: boolean;
  liveWaveBands: number[];
  interimSttPreview: string;
  voiceThreshold: number;
  lastVoiceTrace: VoiceRoutingTrace | null;
  voiceTraceHistory: VoiceRoutingTrace[];
  setGroupBurstsInSearch: (group: boolean) => void;
  setIsSlimCapsule: (slim: boolean) => void;
  setVoiceThreshold: (t: number) => void;
  runTextQuery: (q: string, options?: { fromVoice?: boolean }) => Promise<void>;
  toggleMicRecording: () => Promise<void>;
  runPresetVoiceQuery: (presetId: string, forceFallbackDemo?: boolean) => Promise<void>;
  toggleBookmark: (photoId: string) => void;

  // 사진 상세 모달 & 연사 묶음 상세 탐색
  selectedPhoto: PhotoItem | null;
  selectedBurstGroup: PhotoItem[] | null;
  setSelectedPhoto: (photo: PhotoItem | null, burstGroup?: PhotoItem[] | null) => void;

}

export const createSearchSlice: StateCreator<
  SaySeeStore,
  [],
  [],
  SearchSlice
> = (set, get) => ({
  searchSpace: 'gallery',
  hasExecutedUserSearch: false,
  hasUserSelectedSearchTab: false,
  localDocuments: LOCAL_DOCUMENT_FILES,
  matchedLocalDocs: LOCAL_DOCUMENT_FILES,
  matchedVaultPhotos: [],
  selectedDocModal: null,
  videoSceneItems: VIDEO_SCENE_ITEMS,
  matchedVideoScenes: VIDEO_SCENE_ITEMS,
  selectedVideoModal: null,
  trialScanPermissions: {
    gallery: true,
    downloads: true,
    desktop: true,
  },
  setSelectedDocModal: (selectedDocModal) => {
    if (!selectedDocModal) {
      stopSetupMonsterTts();
    }
    set({ selectedDocModal });
  },
  setSelectedVideoModal: (selectedVideoModal, seekSec) => {
    if (!selectedVideoModal) {
      set({ selectedVideoModal: null });
      return;
    }
    if (seekSec !== undefined) {
      const matchedFrame = selectedVideoModal.timelineFrames.find((f) => f.timeSec === seekSec);
      set({
        selectedVideoModal: {
          ...selectedVideoModal,
          matchedSeekSec: seekSec,
          thumbUrl: matchedFrame?.thumbUrl || selectedVideoModal.thumbUrl,
          matchedTimestamp: matchedFrame
            ? `🎯 ${matchedFrame.timestampText} 구간 포착`
            : selectedVideoModal.matchedTimestamp,
          matchedFrameCaption: matchedFrame
            ? `[${matchedFrame.timestampText} · ${matchedFrame.phaseLabel}] ${matchedFrame.sceneCaption}`
            : selectedVideoModal.matchedFrameCaption,
        },
      });
      return;
    }
    set({ selectedVideoModal });
  },
  syncRealVideoDuration: (videoId, realDurationSec) => {
    const dur = Math.floor(realDurationSec);
    if (!Number.isFinite(dur) || dur < 1) return;
    const { videoSceneItems, matchedVideoScenes, selectedVideoModal } = get();
    const target = videoSceneItems.find((v) => v.id === videoId);
    if (
      target &&
      target.durationSec === dur &&
      !target.timelineFrames.some((f) => f.timeSec === 5 && (f.phaseLabel || '').includes('중반'))
    ) {
      return;
    }
    const updateItem = (v: VideoSceneItem): VideoSceneItem =>
      v.id === videoId ? normalizeLocalVideoSceneItem(v, dur) : v;
    set({
      videoSceneItems: videoSceneItems.map(updateItem),
      matchedVideoScenes: matchedVideoScenes.map(updateItem),
      selectedVideoModal:
        selectedVideoModal && selectedVideoModal.id === videoId
          ? normalizeLocalVideoSceneItem(selectedVideoModal, dur)
          : selectedVideoModal,
    });
  },
  setTrialScanPermission: (folder, allowed) =>
    set((state) => ({
      trialScanPermissions: {
        ...state.trialScanPermissions,
        [folder]: allowed,
      },
    })),

  setSearchSpace: (searchSpace) => {
    const { hasExecutedUserSearch, photos, videoSceneItems, localDocuments } = get();
    // 이미 검색을 실행한 상태라면 검색어와 3개 탭의 매칭 결과(배지 숫자 및 목록)를 그대로 유지한 채 선택한 탭만 즉시 열어줌
    if (hasExecutedUserSearch) {
      set({
        searchSpace,
        hasUserSelectedSearchTab: true,
      });
      return;
    }

    // 아직 첫 검색 전인 상태에서 탭을 눌러 둘러보는 경우
    if (searchSpace === 'video') {
      const totalFrames = videoSceneItems.reduce((a, v) => a + v.timelineFrames.length, 0);
      set({
        searchSpace: 'video',
        hasUserSelectedSearchTab: true,
        activeQuery: `동영상 ${videoSceneItems.length}개 전 구간(총 ${totalFrames}개 타임라인 프레임) 자동 해부`,
        matchedTags: ['#동영상전구간해부', '#타임라인점프재생', '#자율비전인덱싱'],
        matchedVideoScenes: videoSceneItems,
      });
    } else if (searchSpace === 'vault') {
      const vaultPhotos = photos
        .filter((p) => !p.quarantined && p.isVaultDocument)
        .map((photo) => ({
          photo,
          score: 0.96,
          matchPercentage: 98,
          matchedBy: 'text-direct' as const,
        }));
      set({
        searchSpace: 'vault',
        hasUserSelectedSearchTab: true,
        activeQuery: `최근 서류 ${localDocuments.length + vaultPhotos.length}건 통합 (로컬 문서 ${localDocuments.length}건 + 촬영 서류 ${vaultPhotos.length}장)`,
        matchedTags: ['#스마트서류함', '#문서·설명서', '#문서·신분증', '#PDF통합검색'],
        matchedVaultPhotos: vaultPhotos,
        matchedLocalDocs: localDocuments,
      });
    } else {
      const galleryPhotos = photos
        .filter(
          (p) =>
            !p.quarantined &&
            !p.isVaultDocument &&
            p.trashCategory !== 'blurry' &&
            p.trashCategory !== 'screenshot' &&
            p.trashCategory !== 'memo' &&
            p.trashCategory !== 'duplicate'
        )
        .map((photo) => ({
          photo,
          score: 0.95,
          matchPercentage: 97,
          matchedBy: 'text-direct' as const,
        }));
      set({
        searchSpace: 'gallery',
        hasUserSelectedSearchTab: true,
        activeQuery: `전체 갤러리 사진 (${galleryPhotos.length}장)`,
        matchedTags: ['#전체갤러리', '#자율얼굴검출', '#768차원벡터검색'],
        searchResults: galleryPhotos,
      });
    }
  },

  resetSearchSpaceToAll: (searchSpace) => {
    storeSharedRefs.latestRunTextQuerySeq += 1;
    const { photos, videoSceneItems, localDocuments } = get();
    const vaultPhotos = photos
      .filter((p) => !p.quarantined && p.isVaultDocument)
      .map((photo) => ({
        photo,
        score: 0.96,
        matchPercentage: 98,
        matchedBy: 'text-direct' as const,
      }));
    const galleryPhotos = photos
      .filter(
        (p) =>
          !p.quarantined &&
          !p.isVaultDocument &&
          p.trashCategory !== 'blurry' &&
          p.trashCategory !== 'screenshot' &&
          p.trashCategory !== 'memo' &&
          p.trashCategory !== 'duplicate'
      )
      .map((photo) => ({
        photo,
        score: 0.95,
        matchPercentage: 97,
        matchedBy: 'text-direct' as const,
      }));
    const totalFrames = videoSceneItems.reduce((a, v) => a + v.timelineFrames.length, 0);

    set({
      searchSpace,
      hasExecutedUserSearch: false,
      hasUserSelectedSearchTab: true,
      activeQuery:
        searchSpace === 'video'
          ? `동영상 ${videoSceneItems.length}개 전 구간(총 ${totalFrames}개 타임라인 프레임) 자동 해부`
          : searchSpace === 'vault'
          ? `최근 서류 ${localDocuments.length + vaultPhotos.length}건 통합 (로컬 문서 ${localDocuments.length}건 + 촬영 서류 ${vaultPhotos.length}장)`
          : `전체 갤러리 사진 (${galleryPhotos.length}장)`,
      matchedVideoScenes: videoSceneItems,
      matchedLocalDocs: localDocuments,
      matchedVaultPhotos: vaultPhotos,
      searchResults: galleryPhotos,
    });
  },

  runBriefingHintChip: async (target, query) => {
    set({
      searchSpace: target === 'doc' ? 'vault' : 'video',
      hasUserSelectedSearchTab: true,
    });
    await get().runTextQuery(query);
    if (target === 'video') {
      const matched = get().matchedVideoScenes;
      if (matched.length > 0) {
        get().setSelectedVideoModal(matched[0], matched[0].matchedSeekSec);
      }
    } else if (typeof document !== 'undefined') {
      window.setTimeout(() => {
        document.getElementById('ghosti-search-results')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 60);
    }
  },


  activeQuery: '동영상 전 구간 타임라인 자동 해부',
  matchedTags: ['#동영상전구간해부', '#타임라인점프재생', '#자율비전인덱싱'],
  searchResults: [],
  groupBurstsInSearch: true,
  isListening: false,
  isSlimCapsule: false,
  liveWaveBands: Array.from({ length: 16 }, (_, i) => 0.2 + (i % 3) * 0.15),
  interimSttPreview: '',
  voiceThreshold: 0.665,
  lastVoiceTrace: null,
  voiceTraceHistory: [],

  setGroupBurstsInSearch: (groupBurstsInSearch) => set({ groupBurstsInSearch }),
  setIsSlimCapsule: (isSlimCapsule) => set({ isSlimCapsule }),
  setVoiceThreshold: (voiceThreshold) => set({ voiceThreshold }),

  runTextQuery: async (q: string, options?: { fromVoice?: boolean }) => {
    const fromVoice = Boolean(options?.fromVoice);
    const query = q.trim();
    if (!query) return;
    const reqSeq = ++storeSharedRefs.latestRunTextQuerySeq;
    const {
      activeLoungeType,
      photos,
      telemetry,
      searchSpace,
      hasUserSelectedSearchTab,
      localDocuments,
      videoSceneItems,
      faceClusters,
      alumniSchoolName,
      alumniGradYear,
      analogScannedPhotos,
      analogYearProposals,
    } = get();

    // [0) 무설정 채팅·검색 직결 드라이브 스캔] "D드라이브는 왜 검색안돼?", "D에 사진있는데 찾아줘", "외장하드 찾아줘", "마이박스 사진 찾아줘"
    if (
      !(/\bs\s*드라이브\b/i.test(query) && /고쳐|오류|끊김|안\s*열려/i.test(query)) &&
      /(?:[c-zC-Z]\s*드라이브|\b[d-zD-Z]\s*에\s*(?:있는\s*)?(?:사진|영상|동영상|문서|파일|폴더)|외장\s*하드|마이박스|mybox)/i.test(
        query
      )
    ) {
      try {
        const res = await fetch(getZCoreUrl('/__zcore/scan-drive'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ drive: query, query }),
        });
        const scanData = await res.json();
        if (scanData?.ok) {
          await get().initApp(true);
          const label = scanData.driveLabel || '추가 드라이브';
          const toastMsg = `⚡ 별도 설정 없이 [${label}]를 즉시 스캔하여 연결했습니다! (사진 ${
            scanData.drivePhotoCount ?? 0
          }장 · 동영상 ${scanData.driveVideoCount ?? 0}개 · 문서 ${scanData.driveDocCount ?? 0}건)`;
          if (fromVoice) {
            void speakWithHyunsuOrSunhi(toastMsg, 'hyunsu_briefing');
          }

          const strippedKw = query
            .replace(/[c-zC-Z]\s*드라이브(?:는|은|도|에서|에)?/gi, ' ')
            .replace(/\b[d-zD-Z]\s*에(?:서)?\b/gi, ' ')
            .replace(/외장\s*하드(?:는|은|도|에서|에)?|마이박스(?:는|은|도|에서|에)?|mybox/gi, ' ')
            .replace(/왜\s*검색\s*안\s*(?:돼|되나요|되니|됨)|검색\s*안\s*돼|있는데|있는\s*거|스캔해\s*줘|연결해\s*줘|찾아\s*줘|보여\s*줘|검색해\s*줘/gi, ' ')
            .replace(/[?!.~,]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

          if (strippedKw && !/^(사진|영상|동영상|문서|파일|폴더)$/.test(strippedKw)) {
            await get().runTextQuery(strippedKw);
            set({ lastQuarantineToast: toastMsg });
            return;
          }

          set({
            hasExecutedUserSearch: true,
            activeQuery: `${label} 전체 연결 완료 (${scanData.drivePhotoCount ?? 0}장)`,
            matchedTags: [`#${label.replace(/\s+/g, '')}`, '#무설정즉시스캔', '#전체검색연결'],
            lastQuarantineToast: toastMsg,
          });
          return;
        }
      } catch {
        /* ignore and continue */
      }
    }

    // [양방향 0토큰 통합 음성/텍스트 자동 라우터 (Zero-LLM Bidirectional Voice Toss)]
    // 1) [🎯 찾기]에서 치우기·고치기·복원 의도("중복 사진 치워줘", "글씨 크기 키워줘", "원래대로 돌려줘")를 말하거나 입력하면
    //    즉시 [✋ 손보기] 탭으로 화면을 전환하고 [✋ 손보기 대화창]에 전달하여 원스톱 실행!
    if (isMonsterCareIntentFromSearch(query)) {
      set({
        desktopTab: 'trash',
        mobileTab: 'trash',
        lastQuarantineToast: `🪄 [양방향 0토큰 자동 실행] "${query}" 음성·텍스트 명령을 [✋ 손보기 대화창]에서 즉시 실행했습니다!`,
      });
      void submitExternalMonsterChatQuery(query, 'trash');
      return;
    }

    // 2) [🎯 찾기]에서 카톡 전달 / 문서 수치 즉답("보증금 얼마야?") / 키워드 문장 발췌 / 요약 낭독 / 단골 AI 바톤터치 의도 처리
    const voiceDocCmd = parseZeroLlmVoiceDocCommand(query);
    if (voiceDocCmd.intentType === 'KAKAO_REAL_CHATROOM_SEND') {
      const { matchedDoc } = resolveTargetDocAndBuildFactAnswer(
        localDocuments,
        voiceDocCmd.targetDocKeyword
      );
      const targetTitle = matchedDoc?.fileName || matchedDoc?.title || `${voiceDocCmd.targetDocKeyword}.pdf`;
      const docMatches = await searchLocalDocumentFilesAsync(voiceDocCmd.targetDocKeyword, localDocuments);
      const kakaoRes = await dispatchFileToKakaoRealChatroom({
        recipientName: voiceDocCmd.kakaoRecipientName,
        fileName: targetTitle,
      });
      set({
        searchSpace: 'vault',
        hasExecutedUserSearch: true,
        activeQuery: query,
        matchedTags: [`#카톡실채팅방전달(${kakaoRes.recipientName})`, '#엔터1번안전전송', '#0토큰직결'],
        matchedLocalDocs: docMatches.length > 0 ? docMatches : matchedDoc ? [matchedDoc] : localDocuments,
        lastQuarantineToast: `💬 [카카오톡 '${kakaoRes.recipientName}' 대화방 파일 장전 완료] ${kakaoRes.hyunsuAnnouncement}`,
      });
      return;
    }

    if (voiceDocCmd.intentType === 'DOC_FACT_QA_READ') {
      const { matchedDoc, rankedDocs, factAnswerKo } = resolveTargetDocAndBuildFactAnswer(
        localDocuments,
        voiceDocCmd.targetDocKeyword,
        voiceDocCmd.extractKeywords,
        'DOC_FACT_QA_READ'
      );
      if (fromVoice || /읽어|낭독|말해|들려/.test(query)) {
        void speakWithHyunsuOrSunhi(factAnswerKo, 'hyunsu_briefing');
      }
      const docMatches = await searchLocalDocumentFilesAsync(voiceDocCmd.targetDocKeyword, localDocuments);
      const finalDocs =
        rankedDocs.length > 0
          ? rankedDocs
          : docMatches.length > 0
          ? docMatches
          : matchedDoc
          ? [matchedDoc]
          : localDocuments;
      const isMobileVoice = isMobileVoiceEnvironment();
      set({
        searchSpace: 'vault',
        hasExecutedUserSearch: true,
        activeQuery: query,
        matchedTags: isMobileVoice
          ? [
              `#${voiceDocCmd.extractKeywords[0] || '핵심수치'}즉답`,
              '#무토큰로컬브리핑',
              '#현수남성성우안내',
            ]
          : [
              `#${voiceDocCmd.extractKeywords[0] || '핵심수치'}즉답`,
              '#무토큰문서즉답',
            ],
        matchedLocalDocs: finalDocs,
        selectedDocModal: matchedDoc || finalDocs[0] || null,
        lastQuarantineToast: isMobileVoice
          ? `🎙️ [0토큰 문서 즉답 브리핑 · 현수 성우] ${factAnswerKo}`
          : `📄 [0토큰 문서 즉답 요약] ${factAnswerKo}`,
      });
      return;
    }

    if (voiceDocCmd.intentType === 'DOC_KEYWORD_SENTENCE_READ') {
      const { matchedDoc, rankedDocs, factAnswerKo } = resolveTargetDocAndBuildFactAnswer(
        localDocuments,
        voiceDocCmd.targetDocKeyword,
        voiceDocCmd.extractKeywords,
        'DOC_KEYWORD_SENTENCE_READ'
      );
      const fullText = matchedDoc?.extractedText || '';
      const extracted = extractKeywordSentencesZeroLlm(fullText, voiceDocCmd.extractKeywords);
      const simPrefix =
        matchedDoc?.matchType === 'SIMILAR'
          ? '검색어와 100% 일치하는 문서는 없지만 유사한 문서를 찾았습니다! '
          : '';
      const readScript =
        extracted.matchedCount > 0
          ? `${simPrefix}${extracted.hyunsuIntroText} ${extracted.sunhiReadScript}`
          : `${simPrefix}찾으신 '${matchedDoc?.title || '문서'}' 내용입니다. ${fullText || factAnswerKo}`;

      const isMobileVoice = isMobileVoiceEnvironment();
      if (isMobileVoice) {
        void speakWithHyunsuOrSunhi(readScript, 'sunhi_doc_reader');
      }
      set({
        searchSpace: 'vault',
        hasExecutedUserSearch: true,
        activeQuery: query,
        matchedTags: isMobileVoice
          ? ['#키워드문장발췌낭독', '#선희아나운서낭독', '#0토큰무료']
          : ['#키워드문장발췌', '#0토큰무료'],
        matchedLocalDocs: rankedDocs.length > 0 ? rankedDocs : matchedDoc ? [matchedDoc] : localDocuments,
        selectedDocModal: matchedDoc || null,
        lastQuarantineToast: isMobileVoice
          ? `🎙️ [선희 아나운서 조항·문장 낭독] ${extracted.matchedCount > 0 ? extracted.hyunsuIntroText : (matchedDoc?.title || '문서 낭독')}`
          : `📄 [문서 핵심 조항 발췌] ${extracted.matchedCount > 0 ? extracted.hyunsuIntroText : (matchedDoc?.title || '문서 요약')}`,
      });
      return;
    }

    if (voiceDocCmd.intentType === 'DOC_SUMMARY_READ') {
      const { matchedDoc, rankedDocs, factAnswerKo } = resolveTargetDocAndBuildFactAnswer(
        localDocuments,
        voiceDocCmd.targetDocKeyword,
        [],
        'DOC_SUMMARY_READ'
      );
      const isMobileVoice = isMobileVoiceEnvironment();
      if (isMobileVoice) {
        void speakWithHyunsuOrSunhi(factAnswerKo, 'sunhi_doc_reader');
      }
      set({
        searchSpace: 'vault',
        hasExecutedUserSearch: true,
        activeQuery: query,
        matchedTags: isMobileVoice
          ? ['#사전요약본즉시낭독', '#선희아나운서', '#0토큰무료']
          : ['#사전요약본즉답', '#0토큰무료'],
        matchedLocalDocs: rankedDocs.length > 0 ? rankedDocs : matchedDoc ? [matchedDoc] : localDocuments,
        selectedDocModal: matchedDoc || null,
        lastQuarantineToast: isMobileVoice
          ? `🎙️ [선희 아나운서 문서 요약 낭독] ${factAnswerKo}`
          : `📄 [문서 핵심 요약] ${factAnswerKo}`,
      });
      return;
    }

    if (voiceDocCmd.intentType === 'HIGH_DIFFICULTY_AI_BATON_TOUCH') {
      const { matchedDoc } = resolveTargetDocAndBuildFactAnswer(
        localDocuments,
        voiceDocCmd.targetDocKeyword
      );
      const batonRes = await triggerUserFavoriteAiLiveVoiceBatonTouch({
        docTitle: matchedDoc?.title || voiceDocCmd.targetDocKeyword,
        docText: matchedDoc?.extractedText || '',
        userQuestion: query,
      });
      const isMobileVoice = isMobileVoiceEnvironment();
      set({
        searchSpace: 'vault',
        hasExecutedUserSearch: true,
        activeQuery: query,
        matchedTags: isMobileVoice
          ? [`#${batonRes.detectedAiLabel}바톤터치`, '#라이브음성상담', '#0토큰무료']
          : [`#${batonRes.detectedAiLabel}바톤터치`, '#심층문서분석', '#0토큰무료'],
        matchedLocalDocs: matchedDoc ? [matchedDoc] : localDocuments,
        lastQuarantineToast: isMobileVoice
          ? `🤝 [${batonRes.detectedAiLabel} 라이브 음성 바톤터치] ${batonRes.ttsBriefingKo}`
          : `🤝 [${batonRes.detectedAiLabel} 심층 상담 바톤터치] ${batonRes.ttsBriefingKo}`,
      });
      return;
    }

    const isWorkLounge = activeLoungeType === 'work';

    // 업무 공유(work)에서는 귀신같이 인물 여권 발동 및 여권 인물 검색 매칭을 제외하고, 일반 사진(현장·자재·제품·서류) 시각 분석만 수행
    const passportTagSet = new Set<string>();
    for (const fc of faceClusters) {
      if (fc.registeredName?.trim()) {
        passportTagSet.add(`#${fc.registeredName.trim()}`);
      }
      for (const pVal of Object.values(fc.roomPersonas ?? {})) {
        const cleanP = (pVal || '').trim();
        if (cleanP) {
          passportTagSet.add(`#${cleanP}`);
          const shortP = cleanP.replace(/\([^)]*\)/g, '').trim();
          if (shortP.length >= 2) passportTagSet.add(`#${shortP}`);
        }
      }
    }

    // [1단계: 각 방에서 입력한 실명·별명(Room Persona) 그대로 매칭 (호칭 자동 번역 배제 · 업무 공유 제외)]
    let resolvedQuery = query;
    if (!isWorkLounge) {
      for (const fc of faceClusters) {
        if (fc.excludedAsPasserby || !fc.registeredName) continue;
        const baseName = fc.registeredName.trim();
        const personas = Object.values(fc.roomPersonas ?? {})
          .map((v) => (v || '').trim())
          .filter((v) => v && v !== baseName);
        for (const persona of personas) {
          const shortPersona = persona.replace(/\([^)]*\)/g, '').trim();
          if (resolvedQuery.includes(persona)) {
            resolvedQuery = resolvedQuery.split(persona).join(baseName);
          } else if (shortPersona.length >= 2 && resolvedQuery.includes(shortPersona)) {
            resolvedQuery = resolvedQuery.split(shortPersona).join(baseName);
          }
        }
      }
    }

    // [2단계: 느슨한 타임라인 ↔ 구체적 월(1~12월)·계절 양방향 확장 인덱싱 & 연도 축약어(1989↔89년↔89) 동치화 & 라운지 고유명사(성동고·성동) 기본 상속]
    const inheritedSchoolNouns = deriveLoungeProperNounTokens(alumniSchoolName);
    const matchedSchoolNouns = inheritedSchoolNouns.filter((noun) => query.includes(noun));

    // 연도 축약어 추출 (예: "89년 2월 성동", "89년 5월", "89", "1989년")
    const yearRegexMatch = query.match(/(19\d{2}|20\d{2}|\b\d{2}(?=년|\s|$))/);
    const queryYearTokens = yearRegexMatch ? buildYearEquivalenceTokens(yearRegexMatch[1]) : [];

    // 쿼리 내 월(1~12월) 또는 계절/학사 키워드 감지 ➔ 양방향 계절('봄'|'여름'|'가을'|'겨울') 확장
    const matchedSeasons = new Set<'봄' | '여름' | '가을' | '겨울'>();
    const matchedMonthOrEventTokens: string[] = [];
    (Object.keys(SEASON_TO_MONTH_SYNONYM_INDEX) as Array<'봄' | '여름' | '가을' | '겨울'>).forEach(
      (seasonKey) => {
        const synList = SEASON_TO_MONTH_SYNONYM_INDEX[seasonKey];
        for (const syn of synList) {
          // '1월', '2월' 등이 '11월', '12월'의 부분 문자열로 오매칭되지 않도록 경계 체크
          const isMonthToken = /^\d{1,2}월$/.test(syn);
          const hit = isMonthToken
            ? new RegExp(`(^|\\D)${syn}`).test(query)
            : query.includes(syn);
          if (hit) {
            matchedSeasons.add(seasonKey);
            if (!matchedMonthOrEventTokens.includes(syn)) {
              matchedMonthOrEventTokens.push(syn);
            }
          }
        }
      }
    );

    const isTimeRangeOrAlumniQuery =
      !isWorkLounge &&
      (queryYearTokens.length > 0 || matchedSeasons.size > 0 || matchedSchoolNouns.length > 0);

    // 개별 사진에 '성동', '89년', '2월' 등이 직접 적혀 있지 않아도 기본 검색 엔진이 오작동하지 않도록 정제된 쿼리 전달
    let cleanedSearchQuery = resolvedQuery;
    if (!isWorkLounge) {
      for (const noun of matchedSchoolNouns) {
        cleanedSearchQuery = cleanedSearchQuery.split(noun).join(' ');
      }
    } else {
      // 업무 공유(work)에서는 귀신같이 여권 인물명/별명을 검색 대상에서 완전 제외
      for (const tag of passportTagSet) {
        const rawName = tag.slice(1);
        if (rawName && cleanedSearchQuery.includes(rawName)) {
          cleanedSearchQuery = cleanedSearchQuery.split(rawName).join(' ');
        }
      }
    }
    cleanedSearchQuery = cleanedSearchQuery.replace(/\s+/g, ' ').trim();

    // 가족/모임 공유방에서는 공유방 전용 코퍼스(호스트 36장 섀도우 + 멤버가 추가한 로컬 사진)를 우선 검색하고, 업무 공유(work)에서는 여권 인물 태그를 제외
    const stateNow = get();
    const sharedCorpusForSearch = [
      ...stateNow.sharedRoomAddedPhotos,
      ...stateNow.sharedRoomHostPhotos,
    ];
    const basePhotosForSearch =
      (activeLoungeType === 'family' || activeLoungeType === 'club') &&
      sharedCorpusForSearch.length > 0
        ? sharedCorpusForSearch
        : photos;
    const photosForSearch = isWorkLounge
      ? basePhotosForSearch.map((p) => ({
          ...p,
          tags: p.tags.filter((t) => !passportTagSet.has(t)),
        }))
      : basePhotosForSearch;

    // [사진 전용 질의 감지]: 사용자가 명시적으로 "바다 사진", "강아지 사진" 등 '사진/셀카/이미지'를 찾아달라고 한 경우,
    // 문서 본문 텍스트나 동영상을 불필요하게 뒤지지 않고 사진 검색에만 집중!
    const isExplicitPhotoOnlyQuery =
      /(?:사진|셀카|이미지|풍경|인물컷|스냅)/.test(query) &&
      !/문서|서류|파일|계약|영수증|전표|엑셀|시트|글자|동영상|영상/.test(query);

    // [통합 3-Track 고속 검색] 사진·문서 매칭을 즉시 수행한 뒤, 일치 사진 세션 정보를 결합해 동영상을 무블로킹(0.1초) 평가
    const [docMatches, photoSearchOut] = await Promise.all([
      isExplicitPhotoOnlyQuery
        ? Promise.resolve([])
        : searchLocalDocumentFilesAsync(cleanedSearchQuery || query, localDocuments),
      cleanedSearchQuery
        ? executeTextSearch(cleanedSearchQuery, photosForSearch, 'text-direct')
        : Promise.resolve({ results: [], embedMs: 0, searchMs: 0 }),
    ]);
    if (reqSeq !== storeSharedRefs.latestRunTextQuerySeq) return;

    const videoMatches = isExplicitPhotoOnlyQuery
      ? []
      : await searchVideoSceneItemsAsync(
          cleanedSearchQuery || query,
          videoSceneItems,
          photosForSearch,
          photoSearchOut.results
        );
    if (reqSeq !== storeSharedRefs.latestRunTextQuerySeq) return;

    let { results } = photoSearchOut;
    const { embedMs, searchMs } = photoSearchOut;
    const expansionBadges: string[] = [];

    if (isTimeRangeOrAlumniQuery) {
      if (queryYearTokens.length > 0) {
        expansionBadges.push(`#연도동치(${queryYearTokens[0]}↔${queryYearTokens[3] || '89년'})`);
      }
      if (matchedSeasons.size > 0) {
        const seasonNames = Array.from(matchedSeasons).join('·');
        const triggerTxt = matchedMonthOrEventTokens.join('·') || seasonNames;
        expansionBadges.push(`#계절↔월확장(${triggerTxt}➔${seasonNames})`);
      }
      if (matchedSchoolNouns.length > 0) {
        expansionBadges.push(`#${alumniSchoolName}고유명사상속`);
      }

      // 아날로그 스캔 사진(느슨한 타임라인: '1989년 봄', '1989년 가을' 등) 양방향 매칭 검사
      const matchedAnalogFiles = new Map<
        string,
        { analogItem: AnalogScannedPhotoItem; reasonTags: string[] }
      >();

      for (const item of analogScannedPhotos) {
        const relatedProposals = analogYearProposals.filter(
          (p) => p.targetAnalogPhotoId === item.id
        );
        const effectiveGroup =
          !item.unknownDatePlace
            ? item.looseTimelineGroup
            : relatedProposals[0]?.proposedTimelineGroup || `${alumniGradYear}년 가을`;
        const effectivePlace =
          item.appliedSticks.join(' ') || relatedProposals[0]?.proposedPlaceTag || '';

        const itemKeywords = new Set<string>([
          ...(item.expandedSearchKeywords ?? []),
          ...buildBidirectionalStickKeywords({
            year: alumniGradYear,
            looseTimelineGroup: effectiveGroup,
            place: effectivePlace,
            schoolName: alumniSchoolName,
          }),
        ]);

        // 2월 검색 시 '1989년 봄'(입학/신학기)과 '1989년 겨울'(졸업식) 모두 매칭!
        const yearOk =
          queryYearTokens.length === 0 ||
          queryYearTokens.some((yt) => itemKeywords.has(yt));
        const seasonOk =
          matchedSeasons.size === 0 ||
          Array.from(matchedSeasons).some(
            (sk) =>
              effectiveGroup.includes(sk) ||
              itemKeywords.has(sk) ||
              // '2월'은 졸업/입학 시즌이므로 1989년 봄 스캔본과 100% 매칭
              (matchedMonthOrEventTokens.includes('2월') && effectiveGroup.includes('봄'))
          );
        const schoolOk =
          matchedSchoolNouns.length === 0 ||
          matchedSchoolNouns.some((sn) => itemKeywords.has(sn));

        if (yearOk && seasonOk && schoolOk) {
          const reasonTags = [
            `#${effectiveGroup.replace(/\s+/g, '')}`,
            ...(matchedMonthOrEventTokens.length > 0
              ? [`#${matchedMonthOrEventTokens[0]}↔${effectiveGroup}양방향매칭`]
              : []),
            ...(matchedSchoolNouns.length > 0 ? [`#${alumniSchoolName}기본상속`] : []),
          ];
          matchedAnalogFiles.set(item.photoFile, { analogItem: item, reasonTags });
        }
      }

      // 매칭된 아날로그/동창회 사진들을 최상단(99% 일치)으로 소환
      if (matchedAnalogFiles.size > 0) {
        const boostedResults: SearchResultItem[] = [];
        const seenIds = new Set<string>();

        for (const [fileName, info] of matchedAnalogFiles.entries()) {
          const foundPhoto = photos.find((p) => !p.quarantined && p.name === fileName);
          if (foundPhoto) {
            seenIds.add(foundPhoto.id);
            const enrichedPhoto: PhotoItem = {
              ...foundPhoto,
              tags: Array.from(
                new Set([...info.reasonTags, ...expansionBadges, ...foundPhoto.tags])
              ),
              captionKo: `${info.analogItem.captionKo} (${alumniSchoolName} 기본 상속 · ${info.analogItem.looseTimelineGroup})`,
            };
            boostedResults.push({
              photo: enrichedPhoto,
              score: 0.99,
              matchPercentage: 99,
              matchedBy: 'text-direct',
            });
          }
        }

        // 만약 라운지 고유 명사('성동', '성동고')나 연도('89년')가 포함된 동창회 검색이면 방 안의 다른 추억 사진들도 후순위로 함께 상속 소환
        const remainingResults = results.filter((r) => !seenIds.has(r.photo.id));
        results = [...boostedResults, ...remainingResults];
      }
    }

    // 촬영 서류(isVaultDocument) 매칭 계산
    const vaultMap = new Map<string, SearchResultItem>();
    for (const r of results) {
      if (r.photo.isVaultDocument) {
        vaultMap.set(r.photo.id, r);
      }
    }
    const rawTokens = query
      .toLowerCase()
      .split(/\s+/)
      .map((t) => t.replace(/(에서|으로|이랑|하고|있는|하는|들을|들|의|을|를|은|는|에|와|과|도)$/, ''))
      .filter((t) => t.length >= 2 && !['서류', '문서', '파일', '사본', '사진', '및'].includes(t));

    if (rawTokens.length > 0) {
      for (const p of photos) {
        if (p.quarantined || !p.isVaultDocument || vaultMap.has(p.id)) continue;
        const corpus = `${p.tags.join(' ')} ${p.captionKo ?? ''} ${p.vaultCategoryLabel ?? ''}`.toLowerCase();
        if (rawTokens.some((tk) => corpus.includes(tk))) {
          vaultMap.set(p.id, {
            photo: p,
            score: 0.91,
            matchPercentage: 95,
            matchedBy: 'text-direct',
          });
        }
      }
    }
    const vaultPhotoMatches = isExplicitPhotoOnlyQuery ? [] : Array.from(vaultMap.values());

    // [규칙 1 & 2 + 동창회 타임라인 검색 시 갤러리 즉시 표시 + 동영상 전용 질의 시 동영상 탭 자동 포커스]
    const isExplicitVideoIntent =
      !isExplicitPhotoOnlyQuery &&
      /영상|동영상|장면|구간|순간|말하는\s*부분|외치는|패러세일링|화이트보드|판서|룰렛|급식|리얼픽/.test(query);
    let targetSpace: SearchSpaceMode =
      isExplicitPhotoOnlyQuery || isTimeRangeOrAlumniQuery
        ? 'gallery'
        : isExplicitVideoIntent && videoMatches.length > 0
        ? 'video'
        : hasUserSelectedSearchTab
        ? searchSpace
        : 'gallery';

    if (targetSpace === 'gallery' && results.length === 0) {
      if (videoMatches.length > 0) targetSpace = 'video';
      else if (docMatches.length > 0 || vaultPhotoMatches.length > 0) targetSpace = 'vault';
    } else if (targetSpace === 'video' && videoMatches.length === 0 && !hasUserSelectedSearchTab) {
      if (results.length > 0) targetSpace = 'gallery';
      else if (docMatches.length > 0 || vaultPhotoMatches.length > 0) targetSpace = 'vault';
    } else if (
      targetSpace === 'vault' &&
      docMatches.length === 0 &&
      vaultPhotoMatches.length === 0 &&
      !hasUserSelectedSearchTab
    ) {
      if (videoMatches.length > 0) targetSpace = 'video';
      else if (results.length > 0) targetSpace = 'gallery';
    }

    const topTags =
      expansionBadges.length > 0
        ? Array.from(
            new Set([
              ...expansionBadges,
              ...results.slice(0, 3).flatMap((r) => r.photo.tags),
            ])
          ).slice(0, 4)
        : Array.from(new Set(results.slice(0, 4).flatMap((r) => r.photo.tags))).slice(0, 3);

    // [성우 브리핑 (현수 / 선희) — 검색 결과 군더더기 배제 표준 안내]
    // 1) 결과 없음: "검색 결과가 없습니다."로 간단하게 읽기
    // 2) 결과 있음: "요청하신 ~ 검색 결과" 군더더기 제외하고 "사진 0장을 찾았습니다."로 간결하게 브리핑
    const searchBriefingKo =
      targetSpace === 'video' && videoMatches.length > 0
        ? `일치하는 동영상 장면 ${videoMatches.length}건을 찾았습니다.`
        : targetSpace === 'vault' && (docMatches.length > 0 || vaultPhotoMatches.length > 0)
        ? `관련 서류 ${docMatches.length + vaultPhotoMatches.length}건을 찾았습니다.`
        : results.length > 0
        ? `사진 ${results.length}장을 찾았습니다.`
        : '검색 결과가 없습니다.';
    if (fromVoice) {
      void speakWithHyunsuOrSunhi(searchBriefingKo, 'hyunsu_briefing');
    }

    set({
      searchSpace: targetSpace,
      hasExecutedUserSearch: true,
      activeQuery: query,
      matchedTags: topTags.length ? topTags : ['#3트랙통합검색', '#768차원벡터매칭'],
      searchResults: results,
      matchedVaultPhotos: vaultPhotoMatches,
      matchedLocalDocs: docMatches,
      matchedVideoScenes: videoMatches,
      telemetry: telemetry ? { ...telemetry, lastQueryMs: +(embedMs + searchMs).toFixed(1) } : null,
      ...(isTimeRangeOrAlumniQuery
        ? {
            lastQuarantineToast: `⚡ [양방향 시간·고유명사 그물망 매칭 (1초 만에)] "${query}" ➔ ${expansionBadges.join(
              ' · '
            )} 규칙으로 느슨한 타임라인 사진을 100% 찾아냈습니다!`,
          }
        : fromVoice && isMobileVoiceEnvironment()
        ? {
            lastQuarantineToast: `🎙️ [현수 성우 브리핑] ${searchBriefingKo}`,
          }
        : {}),
    });

    // [무블로킹 2단계 백그라운드 보강]: 첫 검색 결과는 0.1초 만에 즉시 표시한 뒤,
    // 아직 비전 벡터가 준비되지 않은 동영상이 있으면 백그라운드에서 조용히 키프레임을 보강하여 결과 목록을 매끄럽게 갱신
    if (
      !isExplicitPhotoOnlyQuery &&
      zCoreBridge.isConnected &&
      (!isTextQueryEncoderReady() || hasUnindexedLocalVideos(videoSceneItems))
    ) {
      void (async () => {
        await ensureTextQueryEncoderLoaded();
        if (reqSeq !== storeSharedRefs.latestRunTextQuerySeq) return;
        const prioritized = [
          ...videoMatches,
          ...videoSceneItems.filter((v) => !videoMatches.some((m) => m.id === v.id)),
        ];
        await ensureVideoKeyframesEmbeddedForSearch(
          prioritized,
          48,
          () => reqSeq !== storeSharedRefs.latestRunTextQuerySeq
        );
        if (reqSeq !== storeSharedRefs.latestRunTextQuerySeq) return;
        const cur = get();
        if (!cur.hasExecutedUserSearch || cur.activeQuery !== query) return;
        const refreshedPhotoOut = cleanedSearchQuery
          ? await executeTextSearch(cleanedSearchQuery, photosForSearch, 'text-direct')
          : photoSearchOut;
        if (reqSeq !== storeSharedRefs.latestRunTextQuerySeq) return;
        const refreshedVideos = await searchVideoSceneItemsAsync(
          cleanedSearchQuery || query,
          cur.videoSceneItems,
          photosForSearch,
          refreshedPhotoOut.results
        );
        if (reqSeq !== storeSharedRefs.latestRunTextQuerySeq) return;
        const latest = get();
        if (!latest.hasExecutedUserSearch || latest.activeQuery !== query) return;
        set({
          matchedVideoScenes: refreshedVideos,
          ...(refreshedPhotoOut.results.length > 0 && !isTimeRangeOrAlumniQuery
            ? { searchResults: refreshedPhotoOut.results }
            : {}),
          ...(isExplicitVideoIntent && refreshedVideos.length > 0
            ? { searchSpace: 'video' }
            : {}),
        });
      })();
    }
  },

  toggleMicRecording: async () => {
    const {
      isListening,
      photos,
      voiceThreshold,
      telemetry,
      localDocuments,
      videoSceneItems,
      searchSpace,
      hasUserSelectedSearchTab,
    } = get();
    if (!isListening) {
      try {
        set({ isListening: true, isSlimCapsule: false, interimSttPreview: '' });
        await voiceSession.start({
          onAmplitude: (bands) => set({ liveWaveBands: bands }),
          onInterimStt: (text) => set({ interimSttPreview: text }),
          onAutoStop: () => {
            if (get().isListening) {
              void get().toggleMicRecording();
            }
          },
        });
      } catch {
        set({
          isListening: false,
          lastQuarantineToast:
            '🎤 연결된 마이크가 없거나 마이크 권한이 거부되었습니다. PC에서는 검색창에 텍스트로 입력해 주세요.',
        });
      }
    } else {
      const previewBeforeStop = (get().interimSttPreview || '').trim();
      set({ isListening: false });
      const { audioBlob, backgroundSttTranscript } = await voiceSession.stop();
      const effectiveStt = (
        backgroundSttTranscript ||
        previewBeforeStop ||
        get().interimSttPreview ||
        ''
      ).trim();
      const { results, trace } = await executeZeroSttVoiceSearch({
        audioBlob,
        backgroundSttTranscript: effectiveStt,
        photos,
        threshold: voiceThreshold,
      });

      const resolvedSpoken = (effectiveStt || trace.resolvedQuery || '').trim();
      if (!resolvedSpoken) {
        set({
          lastQuarantineToast: '🎤 음성이 인식되지 않았습니다. 마이크에 대고 다시 말씀해 주세요.',
        });
        return;
      }

      // [마이크 음성 인식 직후 통합 실행 + 현수/선희 성우 100% 자동 발화]
      const spokenUtterance = resolvedSpoken;
      set((state) => ({
        lastVoiceTrace: trace,
        voiceTraceHistory: [trace, ...state.voiceTraceHistory].slice(0, 12),
        isSlimCapsule: true,
      }));
      await get().runTextQuery(spokenUtterance, { fromVoice: true });
    }
  },

  runPresetVoiceQuery: async (presetId: string, forceFallbackDemo = false) => {
    const {
      photos,
      voiceThreshold,
      telemetry,
      localDocuments,
      videoSceneItems,
      searchSpace,
      hasUserSelectedSearchTab,
    } = get();
    const def = PRESET_QUERIES.find((p) => p.id === presetId);

    if (def?.wavFile) {
      try {
        const audio = new Audio(`/__poc/audio/file?f=${encodeURIComponent(def.wavFile)}`);
        audio.volume = 0.26;
        void audio.play().catch(() => {});
      } catch {
        /* ignore */
      }
    }

    const { results, trace } = await executeZeroSttVoiceSearch({
      presetId,
      photos,
      threshold: voiceThreshold,
      forceSimulateLowAudioConfidence: forceFallbackDemo,
    });

    const [docMatches, videoMatches] = await Promise.all([
      searchLocalDocumentFilesAsync(trace.resolvedQuery, localDocuments),
      searchVideoSceneItemsAsync(trace.resolvedQuery, videoSceneItems, photos, results),
    ]);
    const vaultPhotoMatches = results.filter((r) => r.photo.isVaultDocument);
    const targetSpace: SearchSpaceMode = hasUserSelectedSearchTab ? searchSpace : 'video';
    const topTags = Array.from(new Set(results.slice(0, 4).flatMap((r) => r.photo.tags))).slice(0, 3);

    set((state) => ({
      searchSpace: targetSpace,
      hasExecutedUserSearch: true,
      activeQuery: trace.resolvedQuery,
      matchedTags: topTags.length ? topTags : [def?.categoryTag || '#오디오매칭'],
      searchResults: results,
      matchedVaultPhotos: vaultPhotoMatches,
      matchedLocalDocs: docMatches,
      matchedVideoScenes: videoMatches,
      lastVoiceTrace: trace,
      voiceTraceHistory: [trace, ...state.voiceTraceHistory].slice(0, 12),
      telemetry: telemetry ? { ...telemetry, lastQueryMs: trace.totalMs } : null,
    }));
  },

  toggleBookmark: (photoId: string) => {
    set((state) => ({
      photos: state.photos.map((p) => (p.id === photoId ? { ...p, bookmarked: !p.bookmarked } : p)),
      searchResults: state.searchResults.map((r) =>
        r.photo.id === photoId ? { ...r, photo: { ...r.photo, bookmarked: !r.photo.bookmarked } } : r
      ),
      selectedPhoto:
        state.selectedPhoto?.id === photoId
          ? { ...state.selectedPhoto, bookmarked: !state.selectedPhoto.bookmarked }
          : state.selectedPhoto,
    }));
  },

  // ─────────────── 사진 상세 & 연사 묶음 탐색 ───────────────
  selectedPhoto: null,
  selectedBurstGroup: null,
  setSelectedPhoto: (selectedPhoto, selectedBurstGroup = null) =>
    set({
      selectedPhoto,
      selectedBurstGroup: selectedPhoto
        ? selectedBurstGroup ?? get().selectedBurstGroup
        : null,
    }),

  // ─────────────── [스펙 2] Z몬스터 정리 4대 탭 & 바둑판 Pick & 3중 타임머신 안전망 (Undo) ───────────────
});
