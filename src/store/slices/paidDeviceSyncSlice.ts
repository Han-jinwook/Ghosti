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

export interface PaidDeviceSyncSlice {
  // [4대 라운지 & 24시간 GPU 클라우드 서버 도우미 스펙 + 1차 출시용 모바일 스토어 클린 모드(isStoreAppMode)]
  telemetry: HardwareTelemetry | null;
  merlinAuth: MerlinAuthState;
  syncState: SyncState;
  showProModal: boolean;
  freeTrialUsed: boolean;
  activePricingPlan: PricingPlanId;
  subscribedLounges: Record<LoungeType, PricingPlanId | null>;
  activeLoungeType: LoungeType;
  gpuHelper24hActive: boolean;
  gpuHelperActiveTier: GpuHelperTierId;
  gpuHelperRemainingHours: number;
  lastSentPcLinkChannel: 'email' | 'kakao' | null;
  sendPcMasterUrlToEmail: () => Promise<void>;
  sharePcMasterUrlToKakao: () => Promise<void>;

  setShowProModal: (show: boolean) => void;
  setActiveLoungeType: (lounge: LoungeType) => void;
  activateGpuHelper24h: (tier: GpuHelperTierId) => void;
  deactivateGpuHelper24h: () => void;
  activatePricingPlan: (planId: PricingPlanId) => void;
  switchMerlinTier: () => void;
  updateSyncSettings: (mode: SyncMode, wifiOnly: boolean) => void;
  setPrivateSyncStrategy: (strategy: PrivateSyncStrategy) => void;
  setChargingOnlySync: (chargingOnly: boolean) => void;
  triggerSyncNow: () => Promise<void>;

  // [창 2 전담: 귀신창(seq_paste_daemon / ghost_search_window_ui2) 로컬 데몬 연결 상태 슬롯]
  ghostWinDaemonConnected: boolean;
  setGhostWinDaemonConnected: (connected: boolean) => void;
}

export const createPaidDeviceSyncSlice: StateCreator<SaySeeStore, [], [], PaidDeviceSyncSlice> = (set, get) => ({
  // ─────────────── [4대 라운지 & 24시간 GPU 클라우드 서버 도우미 + 1차 출시용 모바일 클린 모드 & 이중 방어] ───────────────
  telemetry: null,
  merlinAuth: loadMerlinAuth(),
  syncState: loadSyncState(550, 3230438906),
  showProModal:
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('master') === 'pc' &&
    !/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) &&
    window.innerWidth >= 860,
  freeTrialUsed: false,
  activePricingPlan: 'free_trial',
  subscribedLounges: {
    personal: null,
    family: null,
    club: null,
    student: null,
    work: null,
  },
  activeLoungeType:
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('invite')
      ? 'family'
      : 'personal',
  gpuHelper24hActive: false,
  gpuHelperActiveTier: 'standard_1000',
  gpuHelperRemainingHours: 24,
  lastSentPcLinkChannel: null,

  sendPcMasterUrlToEmail: async () => {
    const { merlinAuth } = get();
    const targetEmail = merlinAuth.email || 'beakes@sundreamer.app';
    set({
      lastSentPcLinkChannel: 'email',
      lastQuarantineToast: `📩 가입 이메일(${targetEmail})로 ‘내 PC 연동 안내서’가 발송되었습니다! 데스크톱(PC)에서 열어 이어서 작업하세요.`,
    });
  },

  sharePcMasterUrlToKakao: async () => {
    const { merlinAuth } = get();
    const baseMasterDomain = merlinAuth.pcMasterUrl || 'https://ghosti.sundreamer.app';
    const masterPcLink = `${baseMasterDomain.replace(/\/$/, '')}/?master=pc`;
    const shareTitle = '💻 귀신같이(Ghosti) PC 마스터 시작하기 — 클릭 시 바로 이동';
    const shareText = `[💻 귀신같이(Ghosti) 내 PC 연동 시작 가이드]\n수만 장의 원본 사진·영상 고속 인덱싱과 라운지 마스터 관리는 데스크톱(PC) 환경에서 작동합니다.\nPC 카카오톡에서 아래 가이드를 클릭해 대화면 작업을 바로 이어가세요!\n👉 ${masterPcLink}`;

    try {
      // 방법 2 대응: 카카오 공식 무료 SDK(Kakao.Share.sendDefault)가 로드된 환경이면 우선 호출
      const winKakao = (
        window as unknown as {
          Kakao?: {
            isInitialized?: () => boolean;
            Share?: { sendDefault?: (opts: Record<string, unknown>) => void };
          };
        }
      ).Kakao;

      if (winKakao?.isInitialized?.() && typeof winKakao.Share?.sendDefault === 'function') {
        winKakao.Share.sendDefault({
          objectType: 'feed',
          content: {
            title: shareTitle,
            description:
              '수만 장의 원본 사진·영상 고속 인덱싱과 라운지 마스터 관리는 데스크톱(PC) 환경에서 작동합니다.',
            imageUrl: `${baseMasterDomain.replace(/\/$/, '')}/favicon.ico`,
            link: {
              mobileWebUrl: masterPcLink,
              webUrl: masterPcLink,
            },
          },
          buttons: [
            {
              title: '💻 PC에서 마스터 세팅 열기',
              link: {
                mobileWebUrl: masterPcLink,
                webUrl: masterPcLink,
              },
            },
          ],
        });
      } else {
        // 방법 1 (기본 추천 · 가입/심사 0초 · 평생 0원): 스마트폰 기본 공유 시트(navigator.share) 즉시 호출 + 클립보드 백업
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(shareText);
        }
        if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
          await navigator
            .share({
              title: shareTitle,
              text: '수만 장의 원본 사진·영상 고속 인덱싱과 라운지 마스터 관리는 데스크톱(PC) 환경에서 작동합니다. 나와의 채팅방에 보내두고 PC에서 바로 이어가세요.',
              url: masterPcLink,
            })
            .catch(() => {});
        }
      }
    } catch {
      /* ignore */
    }

    set({
      lastSentPcLinkChannel: 'kakao',
      lastQuarantineToast:
        '💬 카톡(나에게)으로 보낼 ‘내 PC 연동 시작 가이드’가 준비되었습니다! PC 카카오톡에서 클릭해 바로 작업을 이어가세요.',
    });
  },

  setShowProModal: (showProModal) => set({ showProModal }),

  setActiveLoungeType: (requestedLoungeType) => {
    set((state) => {
      const activeLoungeType: LoungeType = requestedLoungeType;
      const isTargetLoungeSubscribed = Boolean(state.subscribedLounges[activeLoungeType]);
      const isSwitchingLounge = state.activeLoungeType !== activeLoungeType;
      const sharedCorpus = [...state.sharedRoomAddedPhotos, ...state.sharedRoomHostPhotos];
      const nextCorpus =
        (activeLoungeType === 'family' || activeLoungeType === 'club') && sharedCorpus.length > 0
          ? sharedCorpus
          : state.photos;
      const refreshedGalleryResults: SearchResultItem[] = nextCorpus
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
      return {
        activeLoungeType,
        activePricingPlan: state.subscribedLounges[activeLoungeType] ?? 'free_trial',
        ...(isSwitchingLounge && !state.hasExecutedUserSearch
          ? {
              searchResults: refreshedGalleryResults,
              activeQuery:
                activeLoungeType === 'family'
                  ? `${state.activeFamilyRoom} 패밀리 앨범 (${refreshedGalleryResults.length}장)`
                  : `전체 갤러리 사진 (${refreshedGalleryResults.length}장)`,
            }
          : {}),
        // 내 기기(personal) 진입 시 1관문인 '귀신비서(trash)'가 기본 노출되며, 가족/모임방 전환 시 갤러리('dashboard')가 기본 노출
        desktopTab:
          isSwitchingLounge && activeLoungeType === 'personal'
            ? 'trash'
            : isSwitchingLounge && (activeLoungeType === 'family' || activeLoungeType === 'club')
            ? 'dashboard'
            : isTargetLoungeSubscribed && state.desktopTab === 'trial'
            ? 'dashboard'
            : state.desktopTab,
        mobileTab:
          isSwitchingLounge && activeLoungeType === 'personal'
            ? 'trash'
            : isSwitchingLounge && (activeLoungeType === 'family' || activeLoungeType === 'club')
            ? 'search'
            : isTargetLoungeSubscribed && state.mobileTab === 'trial'
            ? 'search'
            : state.mobileTab,
        // 동창회(student) 진입 시 기본 탭은 [🎞️ 1989 추억], 동호회·모임(club) 진입 시 [🍻 최근 모임]으로 설정
        clubFeedTrack:
          activeLoungeType === 'student'
            ? 'memories_1989'
            : activeLoungeType === 'club'
            ? 'recent_now'
            : state.clubFeedTrack,
        gpuHelperActiveTier:
          activeLoungeType === 'club' || activeLoungeType === 'student'
            ? state.clubSizeTier === 'large'
              ? 'club_large_3000'
              : state.clubSizeTier === 'medium'
              ? 'club_medium_2000'
              : 'club_small_1000'
            : 'standard_1000',
      };
    });
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  },

  activateGpuHelper24h: (tier) => {
    const tierLabelMap: Record<GpuHelperTierId, string> = {
      standard_1000: '개인 / 패밀리 / 동호회 · 동창회 (24시간 1,000원)',
      club_small_1000: '소형 동호·동창회 ~20명 (24시간 1,000원)',
      club_medium_2000: '중형 동호·동창회 ~100명 (24시간 2,000원)',
      club_large_3000: '대형 동호·동창회 무제한 (24시간 3,000원)',
    };
    set({
      gpuHelper24hActive: true,
      gpuHelperActiveTier: tier,
      gpuHelperRemainingHours: 24,
      onboardingTrackMode: 'cloud_rental',
      lastQuarantineToast: `⚡ [24시간 GPU 클라우드 서버 도우미 가동 시작] ${tierLabelMap[tier]} • 멤버 사진·영상 Gemma 2 인덱싱 및 캐시 배포를 실시간 대행하며, 추후 내 PC가 켜지면 원본 이관 후 클라우드에서 100% 자동 소각됩니다.`,
    });
  },

  deactivateGpuHelper24h: () =>
    set({
      gpuHelper24hActive: false,
      onboardingTrackMode: 'pc_local',
      lastQuarantineToast:
        '🟢 [내 PC 직접 구동 모드로 복귀] 클라우드 임시 캐시를 100% 자동 소각하고 내 PC 엔진으로 전환했습니다.',
    }),

  activatePricingPlan: (planId: PricingPlanId) => {
    set((state) => {
      const labelMap: Record<PricingPlanId, string> = {
        free_trial: '✨ 내 기기 1대 (기본) : 언제나 0원 ("혼자 쓰는 내 기기 1대는 기간 제한 없이 언제나 0원입니다.")',
        personal_single_2900: '🆓 내 기기 1대 (기본) : 언제나 0원 • ✋ 귀신같이 손보기',
        personal_sub_3900: '👑 내 기기 통합 + 귀신창 폰+PC • 대수 무제한 (월 3,900원)',
        personal_year_35000: '👑 내 기기 통합 + 귀신창 폰+PC • 대수 무제한 (39,000원 • 🔥 출시 기념 10년 특판)',
        family_home_5900: '🏠 패밀리 사진 공유 • 우리집 단독 (인원·장수 무제한 평생 0원 무료)',
        family_home_year_59000: '🏠 패밀리 사진 공유 • 우리집 단독 (인원·장수 무제한 평생 0원 무료)',
        family_three_8900: '👨‍👩‍👧‍👦 패밀리 사진 공유 • 양가 통합 (인원·장수 무제한 평생 0원 무료)',
        family_three_year_89000: '👨‍👩‍👧‍👦 패밀리 사진 공유 • 양가 통합 (인원·장수 무제한 평생 0원 무료)',
        club_mini_free_300: '🥂 일상 소모임 사진 공유 • 인원·장수 제한 없이 100% 평생 0원 무료',
        club_mini_2900: '🥂 일상 소모임 사진 공유 • 인원·장수 제한 없이 100% 평생 0원 무료',
        club_small_4900: '⛳·🎓 동호회 · 동창회 사진 공유 • 인원·장수 제한 없이 100% 평생 0원 무료',
        club_small_year_49000: '⛳·🎓 동호회 · 동창회 사진 공유 • 인원·장수 제한 없이 100% 평생 0원 무료',
        club_medium_7900: '⛳·🎓 동호회 · 동창회 사진 공유 • 인원·장수 제한 없이 100% 평생 0원 무료',
        club_medium_year_79000: '⛳·🎓 동호회 · 동창회 사진 공유 • 인원·장수 제한 없이 100% 평생 0원 무료',
        club_large_14900: '⛳·🎓 동호회 · 동창회 사진 공유 • 인원·장수 제한 없이 100% 평생 0원 무료',
        club_large_year_149000: '⛳·🎓 동호회 · 동창회 사진 공유 • 인원·장수 제한 없이 100% 평생 0원 무료',
        student_sub_900: '📸 사진 공유 (가족·동호회·동창회 • 인원·장수 무제한 평생 0원 무료)',
        student_year_9000: '📸 사진 공유 (가족·동호회·동창회 • 인원·장수 무제한 평생 0원 무료)',
        work_soho_9900: '💼 업무 공유 • 소호(SOHO) ~5인 (월 9,900원 • S: 드라이브 + 팀 상용구)',
        work_soho_year_99000: '💼 업무 공유 • 소호(SOHO) ~5인 (99,000원 • 🔥 10년 특판 • S: 드라이브 + 팀 상용구)',
        work_biz_19900: '💼 업무 공유 • 소기업 ~20인 (월 19,000원) / 중소기업 ~50인 (월 29,000원)',
        work_biz_year_199000: '💼 업무 공유 • 소기업 ~20인 (190,000원) / 중소기업 ~50인 (290,000원 • 🔥 10년 특판)',
      };

      const nextLoungeType: LoungeType = planId.startsWith('personal_')
        ? 'personal'
        : planId.startsWith('family_')
        ? 'family'
        : planId.startsWith('club_')
        ? 'club'
        : planId.startsWith('student_')
        ? 'club' // [3대 메뉴 체계] 구버전 스쿨 요금제도 '사진 공유 › 동호회·동창회'로 일원화
        : planId.startsWith('work_')
        ? 'work'
        : state.activeLoungeType;

      const isPaidSubscription = planId !== 'free_trial';
      const nextSubscribedLounges: Record<LoungeType, PricingPlanId | null> = {
        ...state.subscribedLounges,
        [nextLoungeType]: isPaidSubscription ? planId : null,
      };

      return {
        activePricingPlan: planId,
        subscribedLounges: nextSubscribedLounges,
        activeLoungeType: nextLoungeType,
        clubFeedTrack: nextLoungeType === 'club' ? 'memories_1989' : state.clubFeedTrack,
        showProModal: false,
        // 해당 라운지 구독 시 해당 라운지의 [✨ 공유 시작] 탭만 자동 숨김(Auto-Hide) 처리되며 다른 미구독 라운지는 유지됨
        desktopTab: isPaidSubscription && state.desktopTab === 'trial' ? 'dashboard' : state.desktopTab,
        mobileTab: isPaidSubscription && state.mobileTab === 'trial' ? 'search' : state.mobileTab,
        merlinAuth: {
          ...state.merlinAuth,
          tier: isPaidSubscription ? 'PRO_LIFETIME' : 'FREE',
        },
        lastQuarantineToast: isPaidSubscription
          ? `🎉 [${labelMap[planId]}] 활성화 완료! (현재 라운지의 [✨ 공유 시작] 탭만 자동 숨김 처리되며, 다른 라운지는 별도로 작동합니다)`
          : `✨ 현재 라운지가 [기본 안내 모드]로 전환되어 상단 서브메뉴 1번 자리에 [✨ 공유 시작] 탭이 다시 표시됩니다.`,
      };
    });
  },

  switchMerlinTier: () => {
    set((state) => ({ merlinAuth: toggleMerlinTier(state.merlinAuth) }));
  },

  updateSyncSettings: (mode: SyncMode, wifiOnly: boolean) => {
    const { syncState } = get();
    saveSyncPrefs(mode, wifiOnly, syncState.privateSyncStrategy, syncState.chargingOnly);
    set((state) => ({
      syncState: {
        ...state.syncState,
        mode,
        wifiOnly,
        lastSyncedAt: '방금 전',
      },
    }));
  },

  setPrivateSyncStrategy: (privateSyncStrategy: PrivateSyncStrategy) => {
    const { syncState } = get();
    saveSyncPrefs(syncState.mode, syncState.wifiOnly, privateSyncStrategy, syncState.chargingOnly);
    set((state) => ({
      syncState: {
        ...state.syncState,
        privateSyncStrategy,
        lastSyncedAt: '방금 전 (모드 전환됨)',
      },
      lastQuarantineToast:
        privateSyncStrategy === 'shadow'
          ? '👻 [초경량 섀도우 캐시 모드] 활성화: 원본은 PC로 이관하고 폰에는 장당 13KB 썸네일+벡터만 남겨 용량을 99.4% 절약합니다!'
          : '🔄 [100% 원본 미러링 모드] 활성화: 폰과 PC 양쪽에 동일한 무손실 원본 파일을 유지하여 상호 백업 보험을 구축합니다!',
    }));
  },

  setChargingOnlySync: (chargingOnly: boolean) => {
    const { syncState } = get();
    saveSyncPrefs(syncState.mode, syncState.wifiOnly, syncState.privateSyncStrategy, chargingOnly);
    set((state) => ({
      syncState: {
        ...state.syncState,
        chargingOnly,
      },
    }));
  },

  triggerSyncNow: async () => {
    set((state) => ({ syncState: { ...state.syncState, syncing: true } }));
    await new Promise((r) => setTimeout(r, 900));
    set((state) => ({
      syncState: {
        ...state.syncState,
        syncing: false,
        lastSyncedAt: '방금 전 (폰↔PC 일치화 완료)',
      },
      lastQuarantineToast:
        state.syncState.privateSyncStrategy === 'shadow'
          ? '👻 [13KB 섀도우 캐시 일치화 완료] 집 PC가 꺼져 있어도 밖에서 내 폰으로 PC 속 10년 치 사진·서류를 1초 만에 열람할 수 있습니다!'
          : '🔄 [100% 원본 미러링 일치화 완료] 클라우드 없이 폰과 PC 양쪽 기기의 원본 사진·서류가 완벽히 일치되었습니다!',
    }));
  },

  ghostWinDaemonConnected: false,
  setGhostWinDaemonConnected: (ghostWinDaemonConnected) => set({ ghostWinDaemonConnected }),
});
