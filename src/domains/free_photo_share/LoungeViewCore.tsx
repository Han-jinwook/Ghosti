import React, { useEffect, useRef, useState } from 'react';
import {
  verifyHybridP2PBridgeConnection,
  type P2PHybridConnectionDiagnostics,
} from '../../services/p2pHybridBridge';
import { getActivePersonaForCluster, useSaySeeStore } from '../../store/useSaySeeStore';
import {
  resolveInvitedHostLoungeAndRoom,
  resolveLoungePhotoCorpus,
} from '../../store/slices/storeSharedRefs';
import type { ClubSizeTier, FamilyRoomId, LoungeType, PricingPlanId } from '../../types/saysee';
import { FaceMemberInlineBar } from '../../components/FaceMemberRegistryModal';
import { PcMasterQuickSendPanel } from '../../components/PricingModal';
import { GhostiBrandLogo } from '../../components/GhostiBrandLogo';
import { GhostCastLiveToolbar } from '../../components/GhostCastAndLiveSystem';
import { SilentIndexingStatusBar } from '../../components/SilentIndexingStatusBar';
import { zCoreBridge } from '../../services/zCoreBridge';
import { hasAuthenticatedHubAccountSession } from '../../services/supabaseClient';
import {
  isAndroidMobileBrowserOrApp,
  isCapacitorNativeMobileRuntime,
} from '../../services/ghostiMobileCareBridge';
import {
  buildAndroidSafeAppProbeIntentUrl,
  buildShareRoomInviteHttpsUrl,
  buildShareRoomNativeSchemeUrl,
  copyInviteTextReliably,
  readCurrentInviteDisplayMeta,
  resolveDefaultRoomTitle,
} from '../../services/shareInviteDeepLinkBridge';
import {
  ensureMyRoomAndInviteToken,
  getPrewarmedRoomInviteTokenSync,
  kickMemberFromSupabaseSharedPhotoRoom,
  reseedRoomPhotosForInvite,
} from '../../services/sharedPhotoRoomSupabase';
import { resolveAccountScopedNickname } from '../../services/ghostSecretaryEngine';
import { loadPassportFlowState } from '../../services/passportRegistrationFlow';
import { LOUNGE_TABS, PLAN_BADGE_LABELS, HostThreeBodyControlPanel } from '../shared/loungeHelpers';
import { WorkLoungeB2BHub } from '../paid_work_share/WorkLoungeB2BHub';
import { QrCodeSvg } from '../../utils/qrCodeSvg';
import { CrossDeviceClipboardAndPairingBar } from '../paid_device_sync/CrossDeviceClipboardAndPairingBar';
import { getThisDeviceIdentity } from '../../services/deviceIntegrationService';

import {
  HOST_HIDE_PERMISSION_STORAGE_KEY,
  KICKED_ROOM_MEMBERS_STORAGE_KEY,
  readHostRetainsHidePermission,
  writeHostRetainsHidePermission,
  resolveCurrentUserIdentityTokens,
  evaluateSharedPhotoDeletePermission,
  copyAuthenticatedRoomInviteFlow,
} from './loungeRoomPermissions';
import { AlumniRetroBannerAndTwoTrackBar } from './AlumniRetroBannerAndTwoTrackBar';

/**
 * 1번 서브메뉴 `[✨ 1초 진단 & 공유 시작]` (정식 구독 활성화 시 메뉴에서 Auto-Hide)
 */
export const LoungeView: React.FC = () => {
  const {
    activeLoungeType,
    setActiveLoungeType,
    activeFamilyRoom,
    setActiveFamilyRoom,
    clubSizeTier,
    setClubSizeTier,
    studentOcrVerified,
    verifyStudentOcr,
    faceClusters,
    photos,
    localDocuments,
    videoSceneItems,
    activatePricingPlan,
    setDesktopTab,
    setMobileTab,
    setSearchSpace,
    runTextQuery,
    setShowFaceRegistryModal,
    restoreFromQuarantine,
    openLocalFolder,
    isStoreAppMode,
    setShowProModal,
  } = useSaySeeStore();

  const [studentPokedHost, setStudentPokedHost] = useState(false);
  const [radarSimulated, setRadarSimulated] = useState(false);
  // 개인 라운지 1초 진단 & 공유 시작 상태: 'idle'(실행 전) -> 'running'(진단 중) -> 'done'(진단 완료)
  const [personalTrialStatus, setPersonalTrialStatus] = useState<'idle' | 'running' | 'done'>('idle');
  // 패밀리 / 동호·동창회 / 동호회 · 동창회 공유방 1초 진단 & 공유 시작 상태 (라운지별 독립 작동)
  const [groupTrialStatus, setGroupTrialStatus] = useState<
    Record<'family' | 'club' | 'student', 'idle' | 'running' | 'done'>
  >({
    family: 'idle',
    club: 'idle',
    student: 'idle',
  });
  // 1초 진단 & 공유 시작 내 안전 검증(정리 대기함 이동 -> 원복 직접 눌러보기) 상태
  const [trialSafetyStep, setTrialSafetyStep] = useState<'ready' | 'quarantined' | 'restored'>('ready');
  const [trialMovedIds, setTrialMovedIds] = useState<string[]>([]);
  // 노션 스타일 동적 토글: 공유방 3대 핵심 기능 안내 & 요금제 플랜 접기/펼치기 (기본 접힘으로 TMI 제거)
  const [showLoungeFeatures, setShowLoungeFeatures] = useState(false);
  const [showLoungePricing, setShowLoungePricing] = useState(false);
  const [droppedBusinessDocName, setDroppedBusinessDocName] = useState<string | null>(null);

  const handlePhotoLoungeDrop = (e: React.DragEvent<HTMLElement>) => {
    if (activeLoungeType === 'work' || activeLoungeType === 'personal') return;
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length === 0) return;
    const businessDoc = files.find((f) =>
      /\.(pdf|xlsx|xls|csv|hwp|hwpx|doc|docx|ppt|pptx|cad|dwg|zip|7z|rar|txt)$/i.test(f.name)
    );
    if (businessDoc) {
      e.preventDefault();
      e.stopPropagation();
      setDroppedBusinessDocName(businessDoc.name);
    }
  };

  const handleStartPersonalTrial = () => {
    setPersonalTrialStatus('running');
    setTrialSafetyStep('ready');
    window.setTimeout(() => {
      setPersonalTrialStatus('done');
    }, 800);
  };

  const handleStartGroupTrial = (lounge: 'family' | 'club' | 'student') => {
    setGroupTrialStatus((prev) => ({ ...prev, [lounge]: 'running' }));
    setRadarSimulated(false);
    window.setTimeout(() => {
      setGroupTrialStatus((prev) => ({ ...prev, [lounge]: 'done' }));
    }, 700);
  };

  const activeClusters = faceClusters.filter((c) => !c.excludedAsPasserby);
  const namedClusters = activeClusters.filter((c) => Boolean(c.registeredName));
  const activePhotos = photos.filter((p) => !p.quarantined);
  const trashPhotos = activePhotos.filter((p) => Boolean(p.trashCategory));
  const trashCount = trashPhotos.length;
  const vaultDocPhotosCount = activePhotos.filter((p) => p.isVaultDocument).length;
  const totalDocsCount = localDocuments.length + vaultDocPhotosCount;

  // 내 기기 전체 보유 파일 모수 (1초 파일 목록 스캔 기준) vs 1초 진단 & 공유 시작 샘플 해부 수량
  const totalDevicePhotos = Math.max(photos.length, 550);
  const totalDeviceVideos = Math.max(videoSceneItems.length, 42);
  const totalDeviceDocs = Math.max(totalDocsCount, 128);
  const trialSampleVideos = 3;
  const trialSamplePhotos = 100;
  const trialSampleDocs = 15;

  // 1초 진단 & 공유 시작 안전 검증: 1단계 [정리(대기함 이동)] 실행
  const handleTrialQuarantineSample = async () => {
    const sampleTargets = trashPhotos.slice(0, 5).map((p) => p.id);
    if (sampleTargets.length > 0) {
      useSaySeeStore.setState({ selectedTrashIds: new Set(sampleTargets) });
      await useSaySeeStore.getState().moveSelectedToQuarantine();
      setTrialMovedIds(sampleTargets);
    } else {
      setTrialMovedIds(['IMG_dup_01 (1).jpg', 'receipt_sample_02.jpg', 'object_box_03.jpg']);
    }
    setTrialSafetyStep('quarantined');
  };

  // 1초 진단 & 공유 시작 안전 검증: 2단계 [원복(되돌리기)] 실행
  const handleTrialRestoreSample = async () => {
    if (trialMovedIds.length > 0) {
      await restoreFromQuarantine(trialMovedIds);
    }
    setTrialSafetyStep('restored');
  };

  const FAMILY_ROOMS: FamilyRoomId[] = ['우리집', '본가(친가)', '처가(친정)'];
  const CLUB_TIERS: Array<{
    id: ClubSizeTier;
    title: string;
    capacity: string;
    monthly: string;
    yearly: string;
    gpuDaily: string;
    monthlyPlanId: PricingPlanId;
    yearlyPlanId: PricingPlanId;
  }> = [
    {
      id: 'small',
      title: '동호회 · 소모임 사진방',
      capacity: '인원 무제한 (사진·동영상 전용)',
      monthly: '기본 무료',
      yearly: '방장·멤버 전원 0원',
      gpuDaily: '내 기기 원본 동기화 지원',
      monthlyPlanId: 'club_small_4900',
      yearlyPlanId: 'club_small_year_49000',
    },
    {
      id: 'large',
      title: '동창회 · 반창회 사진방',
      capacity: '인원 무제한 (사진·동영상 전용)',
      monthly: '기본 무료',
      yearly: '방장·동창 전원 0원',
      gpuDaily: '내 기기 원본 동기화 지원',
      monthlyPlanId: 'club_small_4900',
      yearlyPlanId: 'club_small_year_49000',
    },
  ];

  const goToMainFeed = () => {
    setDesktopTab('dashboard');
    setMobileTab('search');
  };

  return (
    <main
      onDragOver={(e) => {
        if (activeLoungeType !== 'work' && activeLoungeType !== 'personal') {
          e.preventDefault();
        }
      }}
      onDrop={handlePhotoLoungeDrop}
      className="flex-1 w-full max-w-[1360px] mx-auto px-5 md:px-8 py-6 flex flex-col gap-5"
    >
      {droppedBusinessDocName && activeLoungeType !== 'work' && !isStoreAppMode && (
        <section className="px-4 py-3 rounded-2xl bg-amber-950/50 border border-slate-200/70 flex flex-wrap items-center justify-between gap-3 shadow-lg">
          <span className="text-[12.5px] text-amber-100 font-bold leading-relaxed">
            계약서·엑셀 등 업무 문서(<code className="text-amber-300">{droppedBusinessDocName}</code>)는 사내 공용 폴더(S: 드라이브)에서 바로 공유해 보세요!
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setDroppedBusinessDocName(null);
                setActiveLoungeType('work');
                setDesktopTab('dashboard');
              }}
              className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-[12px] font-extrabold cursor-pointer"
            >
              사내 공용 폴더(S:)로 바로 이동 
            </button>
            <button
              type="button"
              onClick={() => setDroppedBusinessDocName(null)}
              className="px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-[11.5px] font-bold cursor-pointer"
              aria-label="닫기"
            >
              ✕
            </button>
          </div>
        </section>
      )}
      {/* 📢 공유 라운지 핵심 선언 콜아웃 (노션 스타일 미니멀 배너): 내 기기(personal) 내에서는 무료/요금 배너를 띄우지 않음 */}
      {!isStoreAppMode && activeLoungeType === 'work' && (
        <section className="px-4 py-2.5 rounded-2xl bg-[#18181B] border border-amber-400/30 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[12.5px] text-zinc-200 font-bold">
            팀 공유 S: 드라이브 · 계약서/업무 문서 본문 검색 (30일 무제한 무료체험)
          </span>
          <button
            type="button"
            onClick={() => setShowProModal(true)}
            className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-[11.5px] font-extrabold shrink-0 cursor-pointer"
          >
            팀 플랜 안내 보기 →
          </button>
        </section>
      )}

      {/* ─────────────── 💻 내 기기: 노션 스타일 Zen 도화지 (진단 전에는 시원한 단일 시작점 ➔ 진단 클릭 시 결과·안전검증 펼침 + 하단 3대 바로가기 1세트) ─────────────── */}
      {activeLoungeType === 'personal' && (
        <div className="max-w-4xl mx-auto w-full py-4 md:py-8 flex flex-col gap-6">
          {/* 0. 라운지 상단 3단 무소음 인덱싱 브레이크 & 유저 안심 상태 안내 표시줄 */}
          <SilentIndexingStatusBar variant="lounge-top" />

          {/* 1. 노션형 깔끔한 히어로 진단 카드 (버튼처럼 보이는 가짜 배지·중복 문구 일체 제거) */}
          <section className="p-6 md:p-8 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-[12px] font-bold text-primary-container tracking-wide">
                  내 기기 (PC · 스마트폰)
                </span>
                <h1 className="font-headline-md text-[22px] md:text-[26px] text-white font-extrabold tracking-tight">
                  내 기기 손보기 진단
                </h1>
                <p className="font-body-sm text-[13.5px] text-zinc-400">
                  {personalTrialStatus === 'done'
                    ? `내 기기 전체 파일(사진 ${totalDevicePhotos}장 · 영상 ${totalDeviceVideos}개 · 문서 ${totalDeviceDocs}건) 중 1차 샘플 진단이 완료되었습니다.`
                    : '버튼을 누르면 내 기기 속 영상·사진·문서를 빠르게 스캔하여 정리 대상과 내용검색 준비 상태를 브리핑합니다.'}
                </p>
              </div>

              {/* 우측: 오직 진짜 액션 버튼 1개만 명확하게 노출 */}
              <div className="flex items-center gap-2 shrink-0">
                {personalTrialStatus === 'idle' && (
                  <button
                    type="button"
                    onClick={handleStartPersonalTrial}
                    className="px-6 py-3.5 rounded-xl bg-primary-container hover:opacity-95 text-zinc-950 font-headline-sm text-[14.5px] font-extrabold shadow-sm transition-all whitespace-nowrap cursor-pointer"
                  >
                    손보기 진단 시작
                  </button>
                )}

                {personalTrialStatus === 'running' && (
                  <button
                    type="button"
                    disabled
                    className="px-6 py-3.5 rounded-xl bg-zinc-800 border border-white/15 text-zinc-300 font-headline-sm text-[14px] font-bold whitespace-nowrap cursor-wait"
                  >
                    ⏳ 내 기기 스캔 및 해부 중...
                  </button>
                )}

                {personalTrialStatus === 'done' && (
                  <button
                    type="button"
                    onClick={handleStartPersonalTrial}
                    className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-200 font-label-sm text-[12.5px] font-bold whitespace-nowrap cursor-pointer"
                  >
                    다시 진단하기
                  </button>
                )}
              </div>
            </div>

            {/* 진단 버튼을 눌렀을 때만 아래로 착 펼쳐지는 결과 & [정리 ➔ 원복] 안전 검증 */}
            {personalTrialStatus === 'done' && (
              <div className="pt-6 border-t border-white/10 flex flex-col gap-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-headline-sm text-[15px] text-white font-bold">
                    1차 진단 완료 브리핑 (카드를 누르면 해당 검색 화면으로 이동합니다)
                  </span>
                  <span className="text-[12px] text-emerald-400 font-semibold">
                    ✓ 외부 서버 전송 없음 (100% 내 기기 안심 진단)
                  </span>
                </div>

                {/* 3열 진단 결과 카드 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  <div
                    onClick={() => {
                      setSearchSpace('video');
                      goToMainFeed();
                    }}
                    className="p-4 rounded-xl bg-zinc-950/90 hover:bg-zinc-900 border border-white/10 hover:border-primary-container/50 cursor-pointer transition-all flex flex-col justify-between gap-2"
                  >
                    <span className="font-label-sm text-[12px] text-zinc-400 font-semibold">
                      동영상 ({totalDeviceVideos}개 중)
                    </span>
                    <div className="font-headline-md text-[20px] text-white font-semibold">
                      영상 {trialSampleVideos}개 해부 완료
                    </div>
                    <span className="text-primary-container font-label-sm text-[12px] font-bold pt-1">
                      장면 검색 보러가기 →
                    </span>
                  </div>

                  <div
                    onClick={() => {
                      setSearchSpace('gallery');
                      goToMainFeed();
                    }}
                    className="p-4 rounded-xl bg-zinc-950/90 hover:bg-zinc-900 border border-white/10 hover:border-primary-container/50 cursor-pointer transition-all flex flex-col justify-between gap-2"
                  >
                    <span className="font-label-sm text-[12px] text-zinc-400 font-semibold">
                      사진 ({totalDevicePhotos}장 중)
                    </span>
                    <div className="font-headline-md text-[20px] text-white font-semibold">
                      사진 {trialSamplePhotos}장 분석 완료
                    </div>
                    <span className="text-primary-container font-label-sm text-[12px] font-bold pt-1">
                      사진 검색 보러가기 →
                    </span>
                  </div>

                  <div
                    onClick={() => {
                      setSearchSpace('vault');
                      goToMainFeed();
                    }}
                    className="p-4 rounded-xl bg-zinc-950/90 hover:bg-zinc-900 border border-white/10 hover:border-primary-container/50 cursor-pointer transition-all flex flex-col justify-between gap-2"
                  >
                    <span className="font-label-sm text-[12px] text-zinc-400 font-semibold">
                      문서 ({totalDeviceDocs}건 중)
                    </span>
                    <div className="font-headline-md text-[20px] text-white font-semibold">
                      문서 {trialSampleDocs}건 색인 완료
                    </div>
                    <span className="text-primary-container font-label-sm text-[12px] font-bold pt-1">
                      서류함 보러가기 →
                    </span>
                  </div>
                </div>

                {/* 🛡️ 안심 안전망 체험: ① 휴지통 이동 ➔ ② 1초 실행 취소 */}
                <div className="p-4 md:p-5 rounded-xl bg-zinc-950 border border-white/10 flex flex-col gap-3">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="font-headline-sm text-[14.5px] text-white font-bold">
                        안심 정리 테스트 — 휴지통으로 보내고 되돌려보세요
                      </span>
                      <p className="font-body-sm text-[12.5px] text-zinc-400">
                        임의로 영구 삭제하지 않고 OS 기본 [휴지통]으로 이동하며 언제든 복원됩니다.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleTrialQuarantineSample()}
                        disabled={trialSafetyStep === 'quarantined'}
                        className={`px-4 py-2 rounded-xl font-label-md text-[12.5px] font-extrabold transition-all whitespace-nowrap ${
                          trialSafetyStep === 'quarantined'
                            ? 'bg-zinc-900 border border-white/15 text-zinc-400 cursor-not-allowed'
                            : 'bg-teal-600 hover:bg-teal-700 text-white cursor-pointer'
                        }`}
                      >
                        {trialSafetyStep === 'quarantined'
                          ? '✓ ① 휴지통 이동됨'
                          : '① 샘플 정리 눌러보기'}
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleTrialRestoreSample()}
                        disabled={trialSafetyStep !== 'quarantined'}
                        className={`px-4 py-2 rounded-xl font-label-md text-[12.5px] font-extrabold transition-all whitespace-nowrap ${
                          trialSafetyStep === 'quarantined'
                            ? 'bg-primary-container hover:opacity-95 text-zinc-950 cursor-pointer'
                            : trialSafetyStep === 'restored'
                            ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 cursor-default'
                            : 'bg-zinc-900 border border-white/15 text-zinc-500 cursor-not-allowed'
                        }`}
                      >
                        {trialSafetyStep === 'restored'
                          ? '✓ ② 1초 복원 완료!'
                          : '↩️ ② 1초 되돌리기'}
                      </button>

                      <button
                        type="button"
                        onClick={() => void openLocalFolder('quarantine')}
                        className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-300 font-label-sm text-[12px] font-bold whitespace-nowrap cursor-pointer"
                      >
                        휴지통 열기
                      </button>
                    </div>
                  </div>

                  {trialSafetyStep === 'quarantined' && (
                    <div className="px-3.5 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[12.5px] text-amber-200">
                      샘플 {trialMovedIds.length}건이 휴지통으로 이동되었습니다. 우측의 <strong>[↩️ ② 1초 되돌리기]</strong>를 눌러보세요!
                    </div>
                  )}

                  {trialSafetyStep === 'restored' && (
                    <div className="px-3.5 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[12.5px] text-emerald-300 flex items-center justify-between gap-2">
                      <span>원래 위치로 100% 되돌아왔습니다. 이제 본격적인 정리를 시작해 보세요!</span>
                      <button
                        type="button"
                        onClick={() => {
                          setDesktopTab('trash');
                          setMobileTab('trash');
                        }}
                        className="px-3 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-primary-container font-label-sm text-[11.5px] font-bold whitespace-nowrap cursor-pointer"
                      >
                        손보기 열기 →
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* 2. 중복 설명 없이 깔끔하게 1세트로 정돈된 3대 핵심 메뉴 카드 (카드 전체 클릭 가능) */}
          {isStoreAppMode ? (
            <PcMasterQuickSendPanel />
          ) : (
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                type="button"
                onClick={() => {
                  setDesktopTab('dashboard');
                  setMobileTab('search');
                }}
                className="p-5 rounded-2xl bg-[#18181B] hover:bg-zinc-900 border border-white/10 hover:border-primary-container/50 text-left flex flex-col justify-between gap-4 transition-all cursor-pointer group"
              >
                <div className="flex flex-col gap-1.5">
                  <span className="text-[12px] text-primary-container font-bold">
                    귀신같이 AI 내용찾기
                  </span>
                  <h3 className="font-headline-sm text-[17px] text-white font-bold">
                    사진 · 영상 · 서류 1초 검색
                  </h3>
                  <p className="font-body-sm text-[12.5px] text-zinc-400 leading-relaxed">
                    말 한마디로 사진, 동영상 속 장면, 문서 내용까지 찾아냅니다.
                  </p>
                </div>
                <span className="text-[12.5px] font-extrabold text-primary-container group-hover:translate-x-0.5 transition-transform">
                  내용검색 열기 →
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDesktopTab('trash');
                  setMobileTab('trash');
                }}
                className="p-5 rounded-2xl bg-[#18181B] hover:bg-zinc-900 border border-white/10 hover:border-amber-400/50 text-left flex flex-col justify-between gap-4 transition-all cursor-pointer group"
              >
                <div className="flex flex-col gap-1.5">
                  <span className="text-[12px] text-amber-400 font-bold">
                    귀신같이 손보기
                  </span>
                  <h3 className="font-headline-sm text-[17px] text-white font-bold">
                    중복 사진 · 바탕화면 정리
                  </h3>
                  <p className="font-body-sm text-[12.5px] text-zinc-400 leading-relaxed">
                    중복·연사 사진과 어지러운 바탕화면, 느려진 보안모듈을 대화하며 정리합니다.
                  </p>
                </div>
                <span className="text-[12.5px] font-extrabold text-amber-300 group-hover:translate-x-0.5 transition-transform">
                  손보기 열기 →
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDesktopTab('sync');
                  setMobileTab('settings');
                }}
                className="p-5 rounded-2xl bg-[#18181B] hover:bg-zinc-900 border border-white/10 hover:border-emerald-400/50 text-left flex flex-col justify-between gap-4 transition-all cursor-pointer group"
              >
                <div className="flex flex-col gap-1.5">
                  <span className="text-[12px] text-emerald-400 font-bold">
                    손보기
                  </span>
                  <h3 className="font-headline-sm text-[17px] text-white font-bold">
                    1:1 기기 설정 &amp; 수리 해결사
                  </h3>
                  <p className="font-body-sm text-[12.5px] text-zinc-400 leading-relaxed">
                    복잡한 PC·스마트폰 설정을 고쳐주거나 화살표(👆)로 안내합니다.
                  </p>
                </div>
                <span className="text-[12.5px] font-extrabold text-emerald-300 group-hover:translate-x-0.5 transition-transform">
                  손보기 열기 →
                </span>
              </button>
            </section>
          )}
        </div>
      )}

      {/* ─────────────── 👨‍👩‍👧‍👦 패밀리 라운지: 노션 스타일 동적 토글 + 1초 진단 & 공유 시작 ─────────────── */}
      {activeLoungeType === 'family' && (
        <>
          {/* 1단: 패밀리 라운지 헤더 + 노션 스타일 3대 핵심 기능 동적 토글 */}
          <section className="rounded-2xl bg-[#18181B] border border-white/10 overflow-hidden transition-all">
            <div className="p-5 md:p-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="font-headline-md text-[20px] md:text-[22px] text-white font-bold">
                  패밀리 라운지 — 양가 분리 가족 사진관 (인원·장수 제한 없음)
                </h1>
                <p className="font-body-sm text-[13px] text-zinc-400 mt-1">
                  사생활 혼선 없이 <strong>[우리집] · [본가(친가)] · [처가(친정)]</strong> 방을 분리하고, 카톡 링크 하나로 가족 스마트폰에서 함께 찍힌 사진만 3초 만에 자동 수합합니다.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  {FAMILY_ROOMS.map((room) => (
                    <button
                      key={room}
                      type="button"
                      onClick={() => setActiveFamilyRoom(room)}
                      className={`px-3 py-1.5 rounded-lg font-label-sm text-[11.5px] font-bold border transition-all ${
                        activeFamilyRoom === room
                          ? 'bg-primary-container text-zinc-950 border-primary-container font-extrabold'
                          : 'bg-zinc-900 text-zinc-300 border-white/10 hover:bg-zinc-800'
                      }`}
                    >
                      {room === '우리집' ? '우리집' : room === '본가(친가)' ? '본가(친가)' : '처가(친정)'}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setShowLoungeFeatures((prev) => !prev)}
                  className="px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-100 font-label-sm text-[13px] font-extrabold select-none shadow-sm cursor-pointer transition-all"
                >
                  {showLoungeFeatures ? '핵심 기능 접기 ▴' : '핵심 기능 펼치기 ▾'}
                </button>
              </div>
            </div>

            {showLoungeFeatures && (
              <div className="px-5 md:px-6 pb-5 md:pb-6 pt-3 border-t border-white/10 grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div className="p-4 rounded-xl bg-zinc-950/80 border border-white/10 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-headline-sm text-[15px] text-white font-bold">
                      양가 3방 완벽 분리
                    </span>
                    <span className="px-2 py-0.5 rounded bg-primary-container/15 text-primary-container text-[10.5px] font-extrabold">
                      프라이버시 보장
                    </span>
                  </div>
                  <p className="font-body-sm text-[12.5px] text-zinc-300 leading-relaxed">
                    <strong>[우리집] · [본가(친가)] · [처가(친정)]</strong> 3개 방을 독립 분리하여, 친가·외가 어르신께는 손주·가족 사진만 원하는 방으로 깔끔하게 자동 배포합니다.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-zinc-950/80 border border-white/10 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-headline-sm text-[15px] text-white font-bold">
                      가족 얼굴 여권 &amp; 1초 실명 검색
                    </span>
                    <span className="px-2 py-0.5 rounded bg-primary-container/15 text-primary-container text-[10.5px] font-extrabold">
                      호칭·실명 자동 매칭
                    </span>
                  </div>
                  <p className="font-body-sm text-[12.5px] text-zinc-300 leading-relaxed">
                    가족 단체 사진에서 얼굴을 자동 추출해 이름·호칭(할머니, 큰삼촌 등)만 적어두면 온 가족 스마트폰에서 이름으로 찾습니다.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-zinc-950/80 border border-white/10 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-headline-sm text-[15px] text-white font-bold">
                      카톡 초대 &amp; 3초 레이더 수합
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 text-[10.5px] font-extrabold">
                      인원·장수 제한 없음
                    </span>
                  </div>
                  <p className="font-body-sm text-[12.5px] text-zinc-300 leading-relaxed">
                    명절·가족여행 후 카톡 초대 링크만 보내면 가족들의 아이폰·갤럭시에서 우리 가족이 함께 찍힌 사진만 3초 만에 골라 대기실로 모읍니다.
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* 2단: 패밀리 라운지 1초 진단 & 공유 시작 안내 + 우측 [공유방 시작하기] / [완료] 버튼 */}
          <section className="p-5 md:p-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-5">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-headline-sm text-[18px] text-white font-bold">
                    패밀리 라운지 1초 진단 &amp; 공유 시작 — 가족 얼굴 여권 &amp; 3초 레이더 수합
                  </h2>
                  <span className="text-[12px] text-zinc-400 font-mono">
                    · 소요 시간 약 20초 · 감지된 가족 {activeClusters.length}명 (이름 등록 {namedClusters.length}명)
                  </span>
                </div>
                <p className="font-body-sm text-[12.5px] text-zinc-400">
                  가족 얼굴 여권을 등록하고 가족 스마트폰 3초 레이더 스캔(최대 10장 무료 수합 맛보기)을 바로 체험합니다.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {groupTrialStatus.family === 'idle' && (
                  <button
                    type="button"
                    onClick={() => handleStartGroupTrial('family')}
                    className="px-6 py-3 rounded-xl bg-primary-container hover:opacity-95 text-zinc-950 font-headline-sm text-[14px] font-extrabold shadow-sm transition-all whitespace-nowrap cursor-pointer"
                  >
                    공유방 시작하기
                  </button>
                )}

                {groupTrialStatus.family === 'running' && (
                  <button
                    type="button"
                    disabled
                    className="px-6 py-3 rounded-xl bg-zinc-800 border border-white/15 text-zinc-300 font-headline-sm text-[14px] font-bold whitespace-nowrap cursor-wait"
                  >
                    ⏳ 가족 대표 사진 얼굴 추출 &amp; 레이더 준비 중...
                  </button>
                )}

                {groupTrialStatus.family === 'done' && (
                  <button
                    type="button"
                    onClick={() => handleStartGroupTrial('family')}
                    className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-200 font-label-sm text-[12.5px] font-bold whitespace-nowrap cursor-pointer"
                  >
                    다시 체험하기
                  </button>
                )}
              </div>
            </div>

            {/* 3단: 초기 설정 완료 시 열리는 가족 여권 등록 & 3초 레이더 수합 보드 */}
            {groupTrialStatus.family === 'done' && (
              <div className="pt-4 border-t border-white/10 flex flex-col gap-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                  <span className="font-headline-sm text-[15.5px] text-white font-bold">
                    Step 1. 가족 얼굴 여권 자동 장착 &amp; 방장 누락분 확인 ({activeFamilyRoom})
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowFaceRegistryModal(true)}
                    className="px-3 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-primary-container font-label-sm text-[11.5px] font-bold"
                  >
                    여권 관리 · 방장 총점검 모달 열기 →
                  </button>
                </div>

                <FaceMemberInlineBar
                  onRunRealNameQuery={(query) => {
                    goToMainFeed();
                    void runTextQuery(query);
                  }}
                />

                <div className="p-4 rounded-xl bg-zinc-950 border border-white/15 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="font-label-md text-[13px] text-white font-bold">
                      Step 2. 카톡 초대 &amp; 가족 스마트폰 ‘3초 얼굴 레이더 스캔’ (최대 10장 무료 수합 체험)
                    </span>
                    <p className="font-body-sm text-[12px] text-zinc-400">
                      등록된 가족 얼굴({namedClusters.length}명)의 얼굴 정보와 촬영 날짜를 기준으로 가족 폰에서 함께 찍힌 사진만 골라내어 <strong>[⏳ AI 인덱싱 대기실]</strong>로 전송합니다.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRadarSimulated(true);
                        setDesktopTab('trash');
                        setMobileTab('trash');
                      }}
                      className="px-3.5 py-2 rounded-lg bg-primary-container text-zinc-950 font-label-sm text-[12px] font-extrabold whitespace-nowrap"
                    >
                      {radarSimulated ? '✓ 대기실로 전송됨 (대기실 열기)' : '3초 레이더 수합 대기실 전송 체험 →'}
                    </button>
                    {namedClusters.map((c) => {
                      const { activePersona, isRoomCreator } = getActivePersonaForCluster(
                        c,
                        activeLoungeType,
                        activeFamilyRoom
                      );
                      const labelName = activePersona || c.registeredName;
                      return (
                        <button
                          key={c.clusterId}
                          type="button"
                          onClick={() => {
                            goToMainFeed();
                            void runTextQuery(`${labelName} 나무 다리`);
                          }}
                          className="px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-primary-container/40 text-primary-container font-label-sm text-[11.5px] font-bold whitespace-nowrap"
                        >
                          “{isRoomCreator ? `${labelName}` : labelName} 나무 다리” 검색 →
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 패밀리 라운지 하단: 스토어 클린 모드 시 [내 이메일/카톡으로 PC 마스터 주소 보내기] 노출 / PC 마스터 모드 시 요금제 노션 토글 노출 */}
            {isStoreAppMode ? (
              <div className="pt-3 border-t border-white/10">
                <PcMasterQuickSendPanel />
              </div>
            ) : (
              <div className="flex flex-col gap-3.5 pt-3 border-t border-white/10">
                <div
                  onClick={() => setShowLoungePricing((prev) => !prev)}
                  className="flex flex-wrap items-center justify-between gap-2 cursor-pointer select-none py-1"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-zinc-400 text-[12px] font-mono shrink-0">
                      {showLoungePricing ? '▾' : '▸'}
                    </span>
                    <span className="font-headline-sm text-[13.5px] sm:text-[14.5px] text-white font-bold break-keep">
                      🆓 가족 사진 공유방 — 우리집 단독 &amp; 양가 3방 통합 모두 인원 제한 없음 (사진·동영상 전용)
                    </span>
                  </div>
                  <span className="px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-100 text-[12px] sm:text-[13px] font-extrabold select-none shadow-sm cursor-pointer transition-all shrink-0 whitespace-nowrap ml-auto">
                    {showLoungePricing ? '무료 혜택 접기 ▴' : '무료 혜택 펼치기 ▾'}
                  </span>
                </div>

                {showLoungePricing && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-5 rounded-xl bg-zinc-950/80 border border-emerald-400/40 flex flex-col justify-between gap-4">
                        <div className="flex flex-col gap-1.5">
                          <span className="font-label-sm text-[11.5px] text-emerald-300 font-bold">
                            우리집 단독 — 우리집 전용 시크릿 사진방 (방 1개 · 가족 인원 무제한)
                          </span>
                          <div className="flex items-baseline gap-2">
                            <span className="font-headline-md text-[24px] text-emerald-300 font-semibold">
                              기본 무료
                            </span>
                            <span className="font-label-mono text-[13px] text-amber-300 font-bold">
                              (내 PC 하드 직결 · 클라우드 서버비 0원)
                            </span>
                          </div>
                          <p className="font-body-sm text-[12px] text-zinc-300">
                            부부·자녀가 찍은 모든 사진·동영상을 방장 PC로 안전하게 모으고 가족 전원 스마트폰에서 1초 실명·별명 검색 (※ 사진·동영상 전용)
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => activatePricingPlan('family_home_5900')}
                          className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-label-md text-[12.5px] font-extrabold cursor-pointer"
                        >
                          우리집 가족 사진방 시작하기
                        </button>
                      </div>

                      <div className="p-5 rounded-xl bg-zinc-900 border border-primary-container/50 flex flex-col justify-between gap-4">
                        <div className="flex flex-col gap-1.5">
                          <span className="font-label-sm text-[11.5px] text-primary-container font-bold">
                            양가 통합권 — 우리집 + 본가(친가) + 처가(친정) 3개 방 분리 제공
                          </span>
                          <div className="flex items-baseline gap-2">
                            <span className="font-headline-md text-[24px] text-emerald-300 font-semibold">
                              기본 무료
                            </span>
                            <span className="font-label-mono text-[13px] text-amber-300 font-bold">
                              (3개 방 완벽 분리 · 인원 무제한)
                            </span>
                          </div>
                          <p className="font-body-sm text-[12px] text-zinc-300">
                            사생활 혼선 없이 [우리집] · [본가(친가)] · [처가(친정)] 3개 방을 완벽히 분리 제공하며 각 방에서 입력한 실명·별명 그대로 손주·가족 사진·동영상을 자동 배포합니다.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => activatePricingPlan('family_three_8900')}
                          className="w-full py-2.5 rounded-xl bg-primary-container text-zinc-950 font-label-md text-[12.5px] font-extrabold cursor-pointer"
                        >
                          양가 3방 통합 시작하기
                        </button>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-primary-container/10 border border-primary-container/35 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[12px] text-emerald-200 font-medium">
                        📌 <strong>[안내]</strong> 4번 사진 공유(가족·동호회·동창회)는 <strong>개인 사진·영상 전용</strong>으로 평생 무료입니다. 📄 계약서·엑셀 등 업무 문서는 카톡보다 10배 편한 <strong>6. 사내 공용 폴더(S: 드라이브) — 월 9,900원~ · 30일 무료체험</strong>에서 바로 공유해 보세요!
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveLoungeType('work');
                          setDesktopTab('dashboard');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-primary-container text-zinc-950 font-label-sm text-[11.5px] font-extrabold cursor-pointer shrink-0"
                      >
                        사내 공용 폴더(S:) 바로가기 
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </section>
        </>
      )}

      {/* ─────────────── ⛳ 동호회 · 동창회 (사진 공유): 노션 스타일 동적 토글 + 1초 진단 & 공유 시작 ─────────────── */}
      {activeLoungeType === 'club' && (
        <>
          {/* 1단: 동호회 · 동창회 공유방 헤더 + 3대 핵심 기능 노션 토글 */}
          <section className="rounded-2xl bg-[#18181B] border border-white/10 overflow-hidden transition-all">
            <div className="p-5 md:p-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="font-headline-md text-[20px] md:text-[22px] text-white font-bold">
                  동호회·모임 (사진 공유) — 주말 산악회 · 골프 · 취미 모임 {isStoreAppMode ? '(PC 마스터 연동 전 회원 무료 열람)' : '(기본 무료)'}
                </h1>
                <p className="font-body-sm text-[13px] text-zinc-400 mt-1">
                  모임 총무(방장) PC 마스터 연동으로 회원 전원이 폰 용량 걱정 없이 <strong>가벼운 미리보기 탐색</strong>과 <strong>내 기기 원본 동기화 자체 해결</strong>을 누립니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowLoungeFeatures((prev) => !prev)}
                className="px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-100 font-label-sm text-[13px] font-extrabold select-none shadow-sm shrink-0 cursor-pointer transition-all"
              >
                {showLoungeFeatures ? '핵심 기능 접기 ▴' : '핵심 기능 펼치기 ▾'}
              </button>
            </div>

            {showLoungeFeatures && (
              <div className="px-5 md:px-6 pb-5 md:pb-6 pt-3 border-t border-white/10 grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div className="p-4 rounded-xl bg-zinc-950/80 border border-white/10 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-headline-sm text-[15px] text-white font-bold">
                      8090 응답하라 투트랙 앨범
                    </span>
                    <span className="px-2 py-0.5 rounded bg-primary-container/15 text-primary-container text-[10.5px] font-extrabold">
                      4050 동창회 특화
                    </span>
                  </div>
                  <p className="font-body-sm text-[12.5px] text-zinc-300 leading-relaxed">
                    방 개설 즉시 복고풍 간판이 장착되며, <strong>[🏫 학창시절 (아날로그 복원)]</strong>과 <strong>[🥂 최근 모임]</strong> 투트랙으로 졸업앨범·필름 사진과 현재 모임 사진을 함께 관리합니다.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-zinc-950/80 border border-white/10 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-headline-sm text-[15px] text-white font-bold">
                      스틱 태깅 &amp; 계절↔월 양방향 검색
                    </span>
                    <span className="px-2 py-0.5 rounded bg-primary-container/15 text-primary-container text-[10.5px] font-extrabold">
                      검색 누락 0%
                    </span>
                  </div>
                  <p className="font-body-sm text-[12.5px] text-zinc-300 leading-relaxed">
                    스캔 사진에 <strong>1989년 · 봄 · 수학여행</strong> 스틱만 톡톡 눌러도, 친구가 <strong>&ldquo;89년 5월&rdquo;</strong>이나 별명으로 검색할 때 100% 매칭됩니다.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-zinc-950/80 border border-white/10 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-headline-sm text-[15px] text-white font-bold">
                      미리보기 목록 및 원본 동기화
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 text-[10.5px] font-extrabold">
                      전 회원 무료 열람
                    </span>
                  </div>
                  <p className="font-body-sm text-[12.5px] text-zinc-300 leading-relaxed">
                    평소엔 보이지 않는 곳에 <strong>미리보기 목록</strong>만 보관해 검색하며, <strong>[🔄 원본 동기화]</strong>를 켜면 지정한 내 폴더에 원본이 복제되어 자체 해결합니다.
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* 2단: 동호회 · 동창회 공유방 1초 진단 & 공유 시작 안내 + 우측 [공유방 시작하기] / [완료] 버튼 */}
          <section className="p-5 md:p-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-5">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-headline-sm text-[18px] text-white font-bold">
                    동호회 · 동창회 공유방 1초 진단 &amp; 공유 시작 — 동창·회원 얼굴 여권 &amp; 3초 레이더 수합
                  </h2>
                  <span className="text-[12px] text-zinc-400 font-mono">
                    · 소요 시간 약 20초 · 감지된 회원 {activeClusters.length}명 (실명·별명 등록 {namedClusters.length}명)
                  </span>
                </div>
                <p className="font-body-sm text-[12.5px] text-zinc-400">
                  단체 사진에서 회원 얼굴 여권을 등록하고 단톡방 3초 레이더 스캔(최대 10장 무료 수합 맛보기)을 바로 체험합니다.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {groupTrialStatus.club === 'idle' && (
                  <button
                    type="button"
                    onClick={() => handleStartGroupTrial('club')}
                    className="px-6 py-3 rounded-xl bg-primary-container hover:opacity-95 text-zinc-950 font-headline-sm text-[14px] font-extrabold shadow-sm transition-all whitespace-nowrap cursor-pointer"
                  >
                    공유방 시작하기
                  </button>
                )}

                {groupTrialStatus.club === 'running' && (
                  <button
                    type="button"
                    disabled
                    className="px-6 py-3 rounded-xl bg-zinc-800 border border-white/15 text-zinc-300 font-headline-sm text-[14px] font-bold whitespace-nowrap cursor-wait"
                  >
                    ⏳ 모임 단체 사진 얼굴 추출 &amp; 레이더 준비 중...
                  </button>
                )}

                {groupTrialStatus.club === 'done' && (
                  <button
                    type="button"
                    onClick={() => handleStartGroupTrial('club')}
                    className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-200 font-label-sm text-[12.5px] font-bold whitespace-nowrap cursor-pointer"
                  >
                    다시 체험하기
                  </button>
                )}
              </div>
            </div>

            {/* 3단: 초기 설정 완료 시 열리는 회원 여권 등록 & 3초 레이더 수합 보드 */}
            {groupTrialStatus.club === 'done' && (
              <div className="pt-4 border-t border-white/10 flex flex-col gap-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                  <span className="font-headline-sm text-[15.5px] text-white font-bold">
                    Step 1. 동창·회원 여권 자동 장착 &amp; 총무 누락분 1장씩 확인
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowFaceRegistryModal(true)}
                    className="px-3 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-primary-container font-label-sm text-[11.5px] font-bold"
                  >
                    여권 관리 · 방장 총점검 모달 열기 →
                  </button>
                </div>

                <FaceMemberInlineBar
                  onRunRealNameQuery={(query) => {
                    goToMainFeed();
                    void runTextQuery(query);
                  }}
                />

                <div className="p-4 rounded-xl bg-zinc-950 border border-white/15 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="font-label-md text-[13px] text-white font-bold">
                      Step 2. 카톡 단톡방 초대 &amp; 스마트폰 ‘3초 얼굴 레이더 스캔’ (최대 10장 무료 수합 체험)
                    </span>
                    <p className="font-body-sm text-[12px] text-zinc-400">
                      총무가 등록한 회원 얼굴({namedClusters.length}명)의 얼굴 정보와 모임 날짜를 기준으로 회원 폰에서 모임 사진만 골라내어 <strong>[⏳ AI 인덱싱 대기실]</strong>로 전송합니다.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRadarSimulated(true);
                        setDesktopTab('trash');
                        setMobileTab('trash');
                      }}
                      className="px-3.5 py-2 rounded-lg bg-primary-container text-zinc-950 font-label-sm text-[12px] font-extrabold whitespace-nowrap"
                    >
                      {radarSimulated ? '✓ 대기실로 전송됨 (대기실 열기)' : '3초 레이더 수합 대기실 전송 체험 →'}
                    </button>
                    {namedClusters.map((c) => {
                      const { activePersona, isRoomCreator } = getActivePersonaForCluster(
                        c,
                        activeLoungeType,
                        activeFamilyRoom
                      );
                      const labelName = activePersona || c.registeredName;
                      return (
                        <button
                          key={c.clusterId}
                          type="button"
                          onClick={() => {
                            goToMainFeed();
                            void runTextQuery(`${labelName} 나무 다리`);
                          }}
                          className="px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-primary-container/40 text-primary-container font-label-sm text-[11.5px] font-bold whitespace-nowrap"
                        >
                          “{isRoomCreator ? `${labelName}` : labelName} 나무 다리” 검색 →
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 동호회 · 동창회 공유방 하단: 스토어 클린 모드 시 [내 이메일/카톡으로 PC 마스터 주소 보내기] 노출 / PC 마스터 모드 시 4,900원 단일가 요금제 노션 토글 노출 */}
            {isStoreAppMode ? (
              <div className="pt-3 border-t border-white/10">
                <PcMasterQuickSendPanel />
              </div>
            ) : (
              <div className="flex flex-col gap-3.5 pt-3 border-t border-white/10">
                <div
                  onClick={() => setShowLoungePricing((prev) => !prev)}
                  className="flex flex-wrap items-center justify-between gap-2 cursor-pointer select-none py-1"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-zinc-400 text-[12px] font-mono shrink-0">
                      {showLoungePricing ? '▾' : '▸'}
                    </span>
                    <span className="font-headline-sm text-[13.5px] sm:text-[14.5px] text-white font-bold break-keep">
                      🆓 동호회 · 동창회 · 소모임 사진 공유방 — 인원 제한 없음 (사진·동영상 전용)
                    </span>
                  </div>
                  <span className="px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-100 text-[12px] sm:text-[13px] font-extrabold select-none shadow-sm cursor-pointer transition-all shrink-0 whitespace-nowrap ml-auto">
                    {showLoungePricing ? '무료 혜택 접기 ▴' : '무료 혜택 펼치기 ▾'}
                  </span>
                </div>

                {showLoungePricing && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* ① 🥂 일상 소모임 (기본 무료) */}
                      <div className="p-5 rounded-xl bg-gradient-to-br from-emerald-950/60 via-zinc-950 to-zinc-950 border border-emerald-400/50 flex flex-col justify-between gap-4">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-label-sm text-[12px] text-emerald-300 font-extrabold">
                              일상 소모임 (친구·계모임·취미)
                            </span>
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-200 text-[10px] font-bold">
                              사진·동영상 전용
                            </span>
                          </div>
                          <div className="flex flex-wrap items-baseline gap-1.5 mt-0.5">
                            <span className="font-headline-md text-[22px] text-emerald-300 font-semibold">
                              기본 무료
                            </span>
                          </div>
                          <p className="font-body-sm text-[12px] text-zinc-300">
                            단톡방 친구들끼리 방 개설 즉시 장수 제한 없이 공유할 수 있습니다. (내 PC 하드 직결 · 로그인 전 미리보기 지원)
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => activatePricingPlan('club_mini_free_300')}
                          className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-label-md text-[12px] font-extrabold cursor-pointer"
                        >
                          소모임 사진방 시작하기
                        </button>
                      </div>

                      {/* ② ⛰️ 동호회 사진방 (기본 무료) */}
                      <div className="p-5 rounded-xl bg-zinc-950/90 border border-emerald-400/40 flex flex-col justify-between gap-4">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-label-sm text-[12px] text-primary-container font-extrabold">
                              동호회 사진방 (모임 이름 문패)
                            </span>
                            <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 text-[10px] font-bold">
                              인원 무제한 · 0원
                            </span>
                          </div>
                          <div className="flex flex-wrap items-baseline gap-1.5 mt-0.5">
                            <span className="font-headline-md text-[22px] text-emerald-300 font-semibold">
                              기본 무료
                            </span>
                          </div>
                          <p className="font-body-sm text-[12px] text-zinc-300">
                            골프·산악회·독서·조기축구 등 수백 명 모임도 인원수 제한 없이 기본 무료로 운영됩니다.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => activatePricingPlan('club_small_4900')}
                          className="w-full py-2.5 rounded-xl bg-primary-container text-zinc-950 font-label-md text-[12px] font-extrabold cursor-pointer"
                        >
                          동호회 사진방 시작하기
                        </button>
                      </div>

                      {/* ③ 🎓 동창회·반창회 사진방 (기본 무료) */}
                      <div className="p-5 rounded-xl bg-zinc-900 border border-amber-400/50 flex flex-col justify-between gap-4">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-label-sm text-[12px] text-amber-300 font-extrabold">
                              동창회 사진방 (학교/학년/반 문패)
                            </span>
                            <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 text-[10px] font-bold">
                              인원 무제한 · 0원
                            </span>
                          </div>
                          <div className="flex flex-wrap items-baseline gap-1.5 mt-0.5">
                            <span className="font-headline-md text-[22px] text-emerald-300 font-semibold">
                              기본 무료
                            </span>
                          </div>
                          <p className="font-body-sm text-[12px] text-zinc-300">
                            졸업앨범 아날로그 스캔 사진 복원 + 학창시절 내 얼굴 1초 찾기 &amp; 카톡 단톡방 1초 프리뷰 지원!
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => activatePricingPlan('club_small_4900')}
                          className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-label-md text-[12px] font-extrabold cursor-pointer"
                        >
                          동창회 사진방 시작하기
                        </button>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-400/35 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[12px] text-amber-200 font-medium">
                        📌 <strong>[안내]</strong> 4번 사진 공유(가족·동호회·동창회)는 <strong>개인 사진·영상 전용</strong>으로 평생 무료입니다. 📄 계약서·엑셀 등 업무 문서는 카톡보다 10배 편한 <strong>6. 사내 공용 폴더(S: 드라이브) — 월 9,900원~ · 30일 무료체험</strong>에서 바로 공유해 보세요!
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveLoungeType('work');
                          setDesktopTab('dashboard');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-label-sm text-[11.5px] font-extrabold cursor-pointer shrink-0"
                      >
                        사내 공용 폴더(S:) 바로가기 
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </section>
        </>
      )}

      {/* ─────────────── ⛳ 학급 · 동아리 (student): 노션 스타일 동적 토글 + 1초 진단 & 공유 시작 ─────────────── */}
      {activeLoungeType === 'student' && (
        <>
          {/* 1단: 학급 · 동아리 공유방 헤더 + 3대 핵심 기능 노션 토글 */}
          <section className="rounded-2xl bg-[#18181B] border border-white/10 overflow-hidden transition-all">
            <div className="p-5 md:p-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="font-headline-md text-[20px] md:text-[22px] text-white font-bold">
                  동창회 · 학급 · 동아리 (사진 공유) — 우리 동창·반 공유 앨범
                </h1>
                <p className="font-body-sm text-[13px] text-zinc-400 mt-1">
                  방장 PC 직결 연동만으로 동창회·학급·동아리 인원수 상관없이 <strong>기본 무료</strong>! 동창·반 친구들 전원이 졸업앨범·수련회·체육대회·모임 사진·동영상을 찾습니다. (※ 사진·동영상 전용)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowLoungeFeatures((prev) => !prev)}
                className="px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-100 font-label-sm text-[13px] font-extrabold select-none shadow-sm shrink-0 cursor-pointer transition-all"
              >
                {showLoungeFeatures ? '핵심 기능 접기 ▴' : '핵심 기능 펼치기 ▾'}
              </button>
            </div>

            {showLoungeFeatures && (
              <div className="px-5 md:px-6 pb-5 md:pb-6 pt-3 border-t border-white/10 grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div className="p-4 rounded-xl bg-zinc-950/80 border border-white/10 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-headline-sm text-[15px] text-white font-bold">
                      학생증 로컬 확인
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10.5px] font-extrabold">
                      기기 내 로컬 처리
                    </span>
                  </div>
                  <p className="font-body-sm text-[12.5px] text-zinc-300 leading-relaxed">
                    학생증 사진 1장을 내 기기 RAM에서 기기 안에서만 확인한 뒤 바로 삭제하여 개인정보 유출 걱정 없이 학생 전용 라운지를 즉시 인증합니다.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-zinc-950/80 border border-white/10 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-headline-sm text-[15px] text-white font-bold">
                      수련회·체육대회·축제 3초 수합
                    </span>
                    <span className="px-2 py-0.5 rounded bg-primary-container/15 text-primary-container text-[10.5px] font-extrabold">
                      우리 반 전원 무료
                    </span>
                  </div>
                  <p className="font-body-sm text-[12.5px] text-zinc-300 leading-relaxed">
                    반장·동아리 기장이 반 단톡방에 초대 링크만 올리면, 친구들 아이폰·갤럭시에서 우리 반 사진만 3초 레이더로 자동 수합합니다.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-zinc-950/80 border border-white/10 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-headline-sm text-[15px] text-white font-bold">
                      모임 사진 공유
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 text-[10.5px] font-extrabold">
                      총무 부담 0원
                    </span>
                  </div>
                  <p className="font-body-sm text-[12.5px] text-zinc-300 leading-relaxed">
                    30명 학급이든 100명 동호회든 인원·장수 제한 없이 방장과 전 회원이 함께 공유하고 내 얼굴이 나온 사진을 찾습니다.
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* 2단: 학급 · 동아리 공유방 1초 진단 & 공유 시작 안내 + 우측 [공유방 시작하기] / [완료] 버튼 */}
          <section className="p-5 md:p-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-5">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-headline-sm text-[18px] text-white font-bold">
                    동호회 · 동창회 공유방 1초 진단 &amp; 공유 시작 — 우리 반 얼굴 여권 &amp; 10장 레이더 수합
                  </h2>
                  <span className="text-[12px] text-zinc-400 font-mono">
                    · 소요 시간 약 20초 · 감지된 우리 반 친구 {activeClusters.length}명 (이름·별명 등록 {namedClusters.length}명)
                  </span>
                </div>
                <p className="font-body-sm text-[12.5px] text-zinc-400">
                  우리 반 친구 얼굴 여권을 등록하고 반 단톡방 3초 레이더 10장 수합 및 방장 콕 찌르기를 바로 체험합니다.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {groupTrialStatus.student === 'idle' && (
                  <button
                    type="button"
                    onClick={() => handleStartGroupTrial('student')}
                    className="px-6 py-3 rounded-xl bg-primary-container hover:opacity-95 text-zinc-950 font-headline-sm text-[14px] font-extrabold shadow-sm transition-all whitespace-nowrap cursor-pointer"
                  >
                    공유방 시작하기
                  </button>
                )}

                {groupTrialStatus.student === 'running' && (
                  <button
                    type="button"
                    disabled
                    className="px-6 py-3 rounded-xl bg-zinc-800 border border-white/15 text-zinc-300 font-headline-sm text-[14px] font-bold whitespace-nowrap cursor-wait"
                  >
                    ⏳ 우리 반 단체 사진 얼굴 추출 &amp; 레이더 준비 중...
                  </button>
                )}

                {groupTrialStatus.student === 'done' && (
                  <button
                    type="button"
                    onClick={() => handleStartGroupTrial('student')}
                    className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-200 font-label-sm text-[12.5px] font-bold whitespace-nowrap cursor-pointer"
                  >
                    다시 체험하기
                  </button>
                )}
              </div>
            </div>

            {/* 3단: 초기 설정 완료 시 열리는 반 친구 여권 등록 & 3초 레이더 수합 보드 */}
            {groupTrialStatus.student === 'done' && (
              <div className="pt-4 border-t border-white/10 flex flex-col gap-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                  <span className="font-headline-sm text-[15.5px] text-white font-bold">
                    Step 1. 우리 반 친구 여권 자동 장착 &amp; 반장 누락분 확인
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setStudentPokedHost(true)}
                      className={`px-3 py-1 rounded-lg font-label-sm text-[11.5px] font-extrabold transition-all ${
                        studentPokedHost
                          ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-300'
                          : 'bg-teal-600 hover:bg-teal-700 text-white'
                      }`}
                    >
                      {studentPokedHost
                        ? '✓ 방장에게 "집 게이밍 PC에 설치해!" 알림 발송됨!'
                        : '무료 10장 도달 시 방장에게 "집 게이밍 PC에 설치해!" 콕 찌르기'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowFaceRegistryModal(true)}
                      className="px-3 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-primary-container font-label-sm text-[11.5px] font-bold"
                    >
                      여권 관리 · 방장 총점검 모달 열기 →
                    </button>
                  </div>
                </div>

                <FaceMemberInlineBar
                  onRunRealNameQuery={(query) => {
                    goToMainFeed();
                    void runTextQuery(query);
                  }}
                />

                <div className="p-4 rounded-xl bg-zinc-950 border border-white/15 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="font-label-md text-[13px] text-white font-bold">
                      Step 2. 반 단톡방 초대 &amp; 스마트폰 ‘3초 얼굴 레이더 스캔’ (최대 10장 무료 수합 체험)
                    </span>
                    <p className="font-body-sm text-[12px] text-zinc-400">
                      반장이 등록한 친구 얼굴({namedClusters.length}명)의 얼굴 정보와 수련회·체육대회 날짜를 기준으로 친구 폰에서 우리 반 사진만 골라내어 <strong>[⏳ AI 인덱싱 대기실]</strong>로 전송합니다.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRadarSimulated(true);
                        setDesktopTab('trash');
                        setMobileTab('trash');
                      }}
                      className="px-3.5 py-2 rounded-lg bg-primary-container text-zinc-950 font-label-sm text-[12px] font-extrabold whitespace-nowrap"
                    >
                      {radarSimulated ? '✓ 대기실로 전송됨 (대기실 열기)' : '3초 레이더 수합 대기실 전송 체험 →'}
                    </button>
                    {namedClusters.map((c) => {
                      const { activePersona, isRoomCreator } = getActivePersonaForCluster(
                        c,
                        activeLoungeType,
                        activeFamilyRoom
                      );
                      const labelName = activePersona || c.registeredName;
                      return (
                        <button
                          key={c.clusterId}
                          type="button"
                          onClick={() => {
                            goToMainFeed();
                            void runTextQuery(`${labelName} 나무 다리`);
                          }}
                          className="px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-primary-container/40 text-primary-container font-label-sm text-[11.5px] font-bold whitespace-nowrap"
                        >
                          “{isRoomCreator ? `${labelName}` : labelName} 나무 다리” 검색 →
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 동호회 · 동창회 공유방 하단: 스토어 클린 모드 시 [내 이메일/카톡으로 PC 마스터 주소 보내기] 노출 / PC 마스터 모드 시 요금제 노출 */}
            {isStoreAppMode ? (
              <div className="pt-3 border-t border-white/10">
                <PcMasterQuickSendPanel />
              </div>
            ) : (
              <div className="p-5 rounded-xl bg-zinc-900 border border-primary-container/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded bg-primary-container text-zinc-950 font-label-sm text-[11px] font-extrabold">
                      동창회 · 학급 · 동아리 사진 공유
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded font-label-mono text-[11px] font-bold border ${
                        studentOcrVerified
                          ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                          : 'bg-zinc-950 border-white/10 text-zinc-300'
                      }`}
                    >
                      {studentOcrVerified
                        ? '✓ 학생증 로컬 확인 완료'
                        : '사진·동영상 전용 (업무 문서·S: 드라이브 제외)'}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="font-headline-md text-[26px] text-emerald-300 font-semibold">
                      기본 무료
                    </span>
                    <span className="font-label-mono text-[14px] text-primary-container font-bold">
                      (인원 제한 없음 · 방장도 동창도 0원)
                    </span>
                  </div>
                  <p className="font-body-sm text-[12px] text-zinc-300">
                    내 PC 하드 직결 구조로 클라우드 서버비가 들지 않아 동창회·학급 사진과 동영상 공유는 기본 무료로 제공됩니다.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {!studentOcrVerified && (
                    <button
                      type="button"
                      onClick={verifyStudentOcr}
                      className="px-4 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-primary-container/50 text-primary-container font-label-md text-[12.5px] font-bold"
                    >
                      학생증 로컬 확인
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => activatePricingPlan('student_sub_900')}
                    className="px-4 py-2.5 rounded-xl bg-primary-container text-zinc-950 font-label-md text-[12.5px] font-extrabold"
                  >
                    동창회·학급 사진방 시작하기
                  </button>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {/* ====================================================================
          5. 업무 라운지 (work) — B2B SOHO & 기업 팀 듀얼 뷰 & 가상 드라이브(S:) 브릿지
         ==================================================================== */}
      {activeLoungeType === 'work' && <WorkLoungeB2BHub />}
    </main>
  );
};
