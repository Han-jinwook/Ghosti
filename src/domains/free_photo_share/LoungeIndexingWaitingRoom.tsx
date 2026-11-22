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

/**
 * 3번 서브메뉴 `[⏳ AI 인덱싱 대기실]` (사진 공유(패밀리 / 동호회·동창회) / 업무 라운지 전용)
 * - 수동 검사가 아니라 AI 인덱싱(Gemma 2 768d 벡터 + 13KB/30KB 캐시 변환) 시간 벌기용 안심 버퍼 뷰!
 * - 4050 동창회 아날로그 스캔 사진용 '스틱(Chip) 연쇄 태깅' & '[❓ 언제/어디인가요?] 집단 지성 연도 제보 ➔ 👑 방장 일괄 승인' 탑재
 */
export const LoungeIndexingWaitingRoom: React.FC = () => {
  const {
    activeLoungeType,
    setActiveLoungeType,
    activeFamilyRoom,
    activeSharedRoomId,
    activeJoinedRoomMeta,
    merlinAuth,
    photos,
    sharedRoomHostPhotos,
    sharedRoomAddedPhotos,
    gpuHelper24hActive,
    setDesktopTab,
    setMobileTab,
    swarmFaceCandidates,
    retroScanRunning,
    lastRetroScanReport,
    applySwarmFaceCandidate,
    passSwarmFaceCandidateToHostQueue,
    passAllSwarmCandidatesToHostQueue,
    runGlobalSwarmRetroScanAll,
    setShowFaceRegistryModal,
    alumniStickChips,
    analogYearProposals,
    createAlumniStickChipsFromInput,
    applyStickChipToSharedPhoto,
    applyStickChipToAllSharedPhotos,
    approveAllAnalogYearProposals,
    softDeleteSharedRoomPhoto24h,
    restoreSharedRoomPhotoFromTrash,
    restoreAllSharedRoomTrashPhotos,
    permanentlyDeleteSharedRoomTrashPhoto,
    requestAddMyPhotosToSharedRoom,
    isStoreAppMode,
  } = useSaySeeStore();

  const currentIdentityTokens = resolveCurrentUserIdentityTokens(merlinAuth?.email);
  const hostRetainsHidePerm = readHostRetainsHidePermission();
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
  const [stickYearInput, setStickYearInput] = useState('1989');
  const [stickPlaceInput, setStickPlaceInput] = useState('제주도 수학여행');
  const [stickSeasonInput, setStickSeasonInput] = useState('봄');
  const [selectedStickLabel, setSelectedStickLabel] = useState<string>('1989년 봄');
  const [stickCreatedNotice, setStickCreatedNotice] = useState<string | null>(null);
  const [batchApprovedBanner, setBatchApprovedBanner] = useState<string | null>(null);
  const [lastDeletedPhotoId, setLastDeletedPhotoId] = useState<string | null>(null);
  const [showAnalogStickSection, setShowAnalogStickSection] = useState(false);
  const [highlightTrashSection, setHighlightTrashSection] = useState(false);
  const trashSectionRef = useRef<HTMLElement | null>(null);

  const scrollToSharedTrash = () => {
    setHighlightTrashSection(true);
    trashSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => setHighlightTrashSection(false), 2400);
  };

  const memberActiveHints = swarmFaceCandidates.filter((c) => !c.applied && !c.passedToHostQueue);
  const hostCleanupQueue = swarmFaceCandidates.filter((c) => !c.applied);
  const pendingAnalogProposals = analogYearProposals.filter((p) => !p.approvedByHost);

  const scopedWaitingPhotos = resolveLoungePhotoCorpus({
    activeLoungeType,
    activeFamilyRoom,
    activeSharedRoomId,
    photos,
    sharedRoomHostPhotos,
    sharedRoomAddedPhotos,
  });
  const basePhotos = scopedWaitingPhotos.filter((p) => !p.quarantined);
  const trashedRoomPhotos = scopedWaitingPhotos.filter((p) => Boolean(p.quarantined));
  const queuePhotos = basePhotos.slice(0, 24);
  const stickeredPhotoCount = basePhotos.filter(
    (p) => Array.isArray(p.appliedStickChips) && p.appliedStickChips.length > 0
  ).length;

  const metaByLounge: Record<
    Exclude<LoungeType, 'personal'>,
    {
      badge: string;
      title: string;
      subtitle: string;
      bufferReason: string;
    }
  > = {
    family: {
      badge: `새 사진 정리함 · AI 대기실 (${activeFamilyRoom})`,
      title: '새로 올라온 가족 사진을 정리하고 있습니다',
      subtitle:
        '상단 [새 사진 정리함] 메뉴의 AI 정리 대기실입니다. 옛날 종이 사진 스티커 1초 부착 및 24시간 내 본인 삭제·공유방 휴지통 복원을 여기서 바로 관리합니다.',
      bufferReason: '인물·날짜 자동 분류 중',
    },
    club: {
      badge: '새 사진 정리함 · AI 대기실',
      title: '새로 올라온 모임 사진을 정리하고 있습니다',
      subtitle:
        '상단 [새 사진 정리함] 메뉴의 AI 정리 대기실입니다. 옛날 종이 사진 스티커 1초 부착 및 24시간 내 본인 삭제·공유방 휴지통 복원을 여기서 바로 관리합니다.',
      bufferReason: '인물 분류 및 스캔 사진 정리 중',
    },
    student: {
      badge: '새 사진·영상 정리함 · AI 대기실',
      title: '친구들이 올린 사진과 영상을 정리하고 있습니다',
      subtitle:
        '상단 [새 사진·영상 정리함] 메뉴의 AI 정리 대기실입니다. 옛날 사진 스티커 1초 부착 및 24시간 내 본인 삭제·공유방 휴지통 복원을 관리합니다.',
      bufferReason: '방장 PC가 켜지면 자동으로 사진·영상 정리가 시작됩니다',
    },
    work: {
      badge: '새 업무파일 정리함',
      title: '새로 올라온 업무 서류·사진을 폴더별로 자동 정리합니다',
      subtitle:
        '상단 [새 업무파일 정리함] 화면입니다. 업무 공유 드라이브(S:) 폴더 자동 분류 및 휴지통 복원을 관리합니다.',
      bufferReason: '업무 공유 드라이브(S:) 폴더 자동 분류 중',
    },
  };

  const currentMeta =
    metaByLounge[activeLoungeType === 'personal' ? 'family' : activeLoungeType];

  const handleGenerateSticks = (e: React.FormEvent) => {
    e.preventDefault();
    createAlumniStickChipsFromInput(stickYearInput, stickPlaceInput, stickSeasonInput);
    const cleanYear = stickYearInput.replace(/[^0-9]/g, '') || '1989';
    const cleanPlace = stickPlaceInput.trim() || '제주도 수학여행';
    const cleanSeason = stickSeasonInput.trim() || '봄';
    const comboLabel = `${cleanYear}년 ${cleanSeason}`;
    setSelectedStickLabel(comboLabel);
    setStickCreatedNotice(
      `✓ [${cleanYear}] [${cleanPlace}] [${comboLabel}] 스티커 3종이 생성되어 선택되었습니다! 아래 실제 공유방 사진에서 [👆 1초 부착]을 눌러 바로 붙여 보세요.`
    );
  };

  const handleApproveAllAnalog = () => {
    const count = pendingAnalogProposals.length;
    approveAllAnalogYearProposals();
    setBatchApprovedBanner(
      `✓ 동기들이 제보한 옛날 사진 연도/장소 ${count}건이 방장 일괄 결재로 타임라인과 검색 키워드에 즉시 반영되었습니다!`
    );
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
            계약서·엑셀 등 업무 문서(<code className="text-amber-300">{droppedBusinessDocName}</code>)는 카톡보다 10배 편한{' '}
            <strong className="text-amber-300">[6. 사내 공용 폴더(S: 드라이브) — 월 9,900원~ · 30일 무료체험]</strong>에서 바로 공유해 보세요!
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setDroppedBusinessDocName(null);
                setActiveLoungeType('work');
                setDesktopTab('dashboard');
              }}
              className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-extrabold cursor-pointer"
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
      {/* 상단 대기실 개념 설명 & 즉시 처리 컨트롤 */}
      <section className="p-5 md:p-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <GhostiBrandLogo size="mobile" showBadge={true} />
            <span className="px-2.5 py-0.5 rounded-md bg-primary-container text-zinc-950 font-label-sm text-[11px] font-extrabold">
              {currentMeta.badge}
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-zinc-900 border border-white/10 text-emerald-300 font-label-sm text-[11px] font-bold">
              ✓ 인물·날짜·폴더별 자동 정리
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => requestAddMyPhotosToSharedRoom()}
              className="px-3.5 py-1.5 rounded-xl bg-primary-container hover:opacity-95 text-zinc-950 font-label-sm text-[12px] font-extrabold cursor-pointer"
            >
              내 사진도 이 방에 추가하기
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <h1 className="font-headline-md text-[20px] md:text-[22px] text-white font-bold">
            {currentMeta.title}
          </h1>
          {currentMeta.subtitle && (
            <p className="font-body-sm text-[12.5px] text-zinc-300 leading-relaxed">
              {currentMeta.subtitle}
            </p>
          )}
        </div>

        {/* 실시간 파이프라인 상태 바 */}
        <div className="p-4 rounded-xl bg-zinc-950/90 border border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className=" absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-80" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
            </span>
            <span className="font-label-sm text-[12.5px] text-zinc-200 font-bold">
              {`${currentMeta.bufferReason} (이 방 사진 ${basePhotos.length}장${
                trashedRoomPhotos.length > 0 ? ` · 휴지통 ${trashedRoomPhotos.length}장` : ''
              })`}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={scrollToSharedTrash}
              className={`px-3 py-1 rounded-lg border font-label-sm text-[11px] font-extrabold cursor-pointer transition-colors ${
                trashedRoomPhotos.length > 0
                  ? 'bg-rose-500/20 hover:bg-rose-500/30 border-rose-400/50 text-rose-200'
                  : 'bg-zinc-900 hover:bg-zinc-800 border-white/15 text-zinc-200'
              }`}
            >
              공유방 휴지통 바로가기 ({trashedRoomPhotos.length}장) 
            </button>
            <button
              type="button"
              onClick={() => {
                setDesktopTab('dashboard');
                setMobileTab('search');
              }}
              className="px-3 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-200 font-label-sm text-[11px] font-bold cursor-pointer"
            >
              앨범 피드 보러가기 →
            </button>
          </div>
        </div>

        {/* 🎯 업무 공유(work)에서는 인물 여권 미발동 & 현장/제품 사진 일반 시각 분석 안내만 노출 */}
        {activeLoungeType === 'work' ? (
          <div className="p-4 rounded-xl bg-zinc-950/90 border border-cyan-400/30 flex flex-wrap items-center justify-between gap-2.5 text-[12px] text-zinc-200">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-slate-900 text-white font-label-sm text-[11px] font-extrabold">
                업무 사진·서류 시각 분석 가동 중
              </span>
              <span className="font-bold">
                현장 시공 사진, 자재 라벨, 촬영 서류의 사물·텍스트(OCR)만 자동 분석합니다 (귀신같이 인물 여권은 업무 공유에서 미발동 · 검색 제외)
              </span>
            </div>
          </div>
        ) : (
          /* 🎯 ✨ AI 얼굴 자동 매칭 도우미 + 👑 방장 누락분 & 연도 제보 일괄 승인 */
          <div className="p-3.5 rounded-xl bg-zinc-950/90 border border-primary-container/30 flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-primary-container text-zinc-950 font-label-sm text-[11px] font-extrabold">
                  AI 얼굴 자동 매칭 도우미
                </span>

                <div className="flex flex-wrap items-center gap-2">
              {memberActiveHints.length > 0 && (
                <button
                  type="button"
                  onClick={() => passAllSwarmCandidatesToHostQueue()}
                  className="px-3 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-300 font-label-sm text-[11px] font-bold"
                >
                  확인 건너뛰고 사진만 바로 올리기 (방장이 나중에 정리)
                </button>
              )}
              {hostCleanupQueue.length > 0 && (
                <button
                  type="button"
                  disabled={retroScanRunning}
                  onClick={() => void runGlobalSwarmRetroScanAll()}
                  className="px-3 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-zinc-950 font-label-sm text-[11px] font-extrabold"
                >
                  {retroScanRunning
                    ? '역스캔 중...'
                    : `방장 누락분 뒷정리: ${hostCleanupQueue.length}건 일괄 등록`}
                </button>
              )}
              {pendingAnalogProposals.length > 0 && (
                <button
                  type="button"
                  onClick={handleApproveAllAnalog}
                  className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-label-sm text-[11px] font-extrabold shadow-lg"
                >
                  ✓ 멤버 연도 제보 일괄 승인 ({pendingAnalogProposals.length}건)
                </button>
              )}
            </div>
          </div>

          {batchApprovedBanner && (
            <div className="px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-400/40 text-emerald-200 text-[11.5px] font-bold">
              {batchApprovedBanner}
            </div>
          )}

          {/* 방금 올린 사진 속 새로운 연도/각도 힌트 카드 */}
          {memberActiveHints.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {memberActiveHints.map((cand) => (
                <div
                  key={cand.candidateId}
                  className="p-3 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={cand.cropUrl}
                      alt={cand.suggestedMemberName}
                      className="w-12 h-12 rounded-xl object-cover border-2 border-primary-container shrink-0"
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="font-mono text-[10px] text-zinc-400">
                        {cand.contributorLabel}
                      </span>
                      <p className="font-label-sm text-[12px] text-white font-bold leading-snug">
                        방금 올린 사진에서 <span className="text-primary-container">{cand.suggestedMemberName}</span>님의 새로운 연도/각도(<span className="text-amber-300">{cand.conditionBadgeKo}</span>) 베스트 컷을 찾았어요!
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={retroScanRunning}
                      onClick={() => void applySwarmFaceCandidate(cand.candidateId)}
                      className="px-3 py-1.5 rounded-lg bg-primary-container text-zinc-950 font-label-sm text-[11.5px] font-extrabold"
                    >
                      ⭕ 맞아요! 등록
                    </button>
                    <button
                      type="button"
                      onClick={() => passSwarmFaceCandidateToHostQueue(cand.candidateId)}
                      className="px-2.5 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-white/10 text-zinc-400 hover:text-zinc-200 font-label-sm text-[11px]"
                    >
                      건너뛰기
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-3 py-2 rounded-lg bg-zinc-900/80 border border-white/5 flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-zinc-300">
              <span>
                {hostCleanupQueue.length > 0
                  ? `확인을 건너뛴 사진 속 얼굴 후보 ${hostCleanupQueue.length}건이 방장 정리 대기열에 안전하게 보관되어 있습니다.`
                  : '✓ 사진 속 모든 얼굴이 멤버별 여권에 자동 반영되어 1초 검색 준비가 완료되었습니다!'}
              </span>
              {lastRetroScanReport && (
                <span className="text-emerald-300 font-mono text-[11px] font-bold">
                  ({lastRetroScanReport.timestampText} · 사진 +{lastRetroScanReport.rescuedHostPhotos + lastRetroScanReport.rescuedMemberPhonePhotos}장 매칭)
                </span>
              )}
            </div>
          )}
        </div>
        )}
      </section>

      {/* 3 & 4. 옛날 스캔 사진용 '연도·장소 스티커(Chip)' 1초 부착 (실제 공유방 사진 직결 · 깨진 목업 0건) */}
      {activeLoungeType !== 'work' && (
      <section className="rounded-2xl bg-[#18181B] border border-amber-400/35 overflow-hidden transition-all">
        <div
          onClick={() => setShowAnalogStickSection((prev) => !prev)}
          className="p-5 md:p-6 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-zinc-900/50 transition-colors"
        >
          <div className="flex items-start gap-2.5">
            <span className="text-zinc-400 text-[12px] font-mono select-none mt-1">
              {showAnalogStickSection ? '▾' : '▸'}
            </span>
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-slate-900 text-white font-label-sm text-[11px] font-extrabold">
                  촬영 날짜 없는 옛날 종이 사진 · 연도·장소 스티커 붙이기
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 font-label-sm text-[11px] font-bold">
                  실제 공유방 사진({basePhotos.length}장)에 바로 부착 · 1초 검색 자동 연결
                </span>
              </div>
              <h2 className="font-headline-sm text-[16px] md:text-[17.5px] text-white font-bold mt-0.5">
                연도·장소·계절을 한 번만 적어 [스티커]를 만들면, 이 방 사진에 클릭 한 번으로 바로 붙이고 검색할 수 있습니다
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {stickeredPhotoCount > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 font-label-sm text-[11.5px] font-extrabold">
                스티커 부착 {stickeredPhotoCount}장
              </span>
            )}
            {pendingAnalogProposals.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleApproveAllAnalog();
                }}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-label-sm text-[12px] font-extrabold shadow-lg shrink-0"
              >
                방장 뒷정리: [✓ 멤버 연도 제보 일괄 승인 ({pendingAnalogProposals.length}건)]
              </button>
            )}
            <span className="px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-100 text-[13px] font-extrabold select-none shadow-sm cursor-pointer transition-all">
              {showAnalogStickSection ? '접기 ▴' : '펼치기 ▾'}
            </span>
          </div>
        </div>

        {showAnalogStickSection && (
        <div className="px-5 md:px-6 pb-5 md:pb-6 pt-3 border-t border-white/10 flex flex-col gap-4">
        {/* 스틱(Chip) 생성 입력 바 & 생성된 스틱 팔레트 */}
        <div className="p-4 rounded-xl bg-zinc-950/90 border border-white/10 flex flex-col gap-3">
          <form
            onSubmit={handleGenerateSticks}
            className="flex flex-wrap items-center justify-between gap-2.5"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-label-sm text-[12px] text-amber-300 font-bold">
                ① 연도·장소·계절 입력:
              </span>
              <input
                type="text"
                value={stickYearInput}
                onChange={(e) => setStickYearInput(e.target.value)}
                placeholder="연도 (예: 1989)"
                className="w-24 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-white/15 text-white text-[12px] font-bold"
              />
              <input
                type="text"
                value={stickPlaceInput}
                onChange={(e) => setStickPlaceInput(e.target.value)}
                placeholder="장소/행사 (예: 제주도 수학여행)"
                className="w-40 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-white/15 text-white text-[12px] font-bold"
              />
              <input
                type="text"
                value={stickSeasonInput}
                onChange={(e) => setStickSeasonInput(e.target.value)}
                placeholder="계절 (예: 봄/가을)"
                className="w-24 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-white/15 text-white text-[12px] font-bold"
              />
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-label-sm text-[12px] font-extrabold cursor-pointer"
              >
                + 스틱(Chip) 자동 생성
              </button>
            </div>

            <button
              type="button"
              disabled={basePhotos.length === 0}
              onClick={() =>
                applyStickChipToAllSharedPhotos(
                  basePhotos.map((p) => p.id),
                  selectedStickLabel
                )
              }
              className="px-3.5 py-1.5 rounded-lg bg-primary-container disabled:opacity-40 text-zinc-950 font-label-sm text-[11.5px] font-extrabold cursor-pointer"
            >
              선택한 스틱 이 방 사진 전체({basePhotos.length}장) 1초 일괄 부착
            </button>
          </form>

          {/* 자동 생성된 스틱(Chip) 버튼들 */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
            <span className="font-label-sm text-[11.5px] text-zinc-400 font-bold">
              ② 생성된 스틱(클릭하여 선택 후 아래 사진에 1초 부착):
            </span>
            {alumniStickChips.map((chip) => {
              const isSelected = selectedStickLabel === chip.label;
              return (
                <button
                  key={chip.chipId}
                  type="button"
                  onClick={() => setSelectedStickLabel(chip.label)}
                  className={`px-3 py-1 rounded-full font-label-sm text-[12px] font-extrabold transition-all border cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 text-white border-amber-300 shadow-lg'
                      : 'bg-zinc-900 hover:bg-zinc-800 text-amber-200 border-amber-400/35'
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>

          {stickCreatedNotice && (
            <div className="px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-400/40 text-emerald-200 text-[11.5px] font-bold">
              {stickCreatedNotice}
            </div>
          )}
        </div>

        {/* 실제 공유방 사진 카드 그리드 (깨진 가짜 샘플 0건 · 실제 사진에 1초 스티커 부착) */}
        {basePhotos.length === 0 ? (
          <div className="p-6 rounded-2xl bg-zinc-950/90 border border-dashed border-white/15 flex flex-col items-center justify-center text-center gap-3">
            <span className="text-[13.5px] text-zinc-200 font-bold">
              이 공유방에 올라온 사진이 아직 없어요.
            </span>
            <p className="text-[12px] text-zinc-400 max-w-md leading-relaxed">
              사진을 1장 이상 올리면 실제 공유방 사진이 여기에 표시되며, 위에서 만든 연도·장소 스티커를 클릭 한 번으로 바로 붙일 수 있습니다.
            </p>
            <button
              type="button"
              onClick={() => requestAddMyPhotosToSharedRoom()}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-label-sm text-[12px] font-extrabold cursor-pointer"
            >
              내 사진 이 방에 추가하기
            </button>
          </div>
        ) : (
        <div className="max-h-[640px] overflow-y-auto pr-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {basePhotos.map((photo, index) => {
            const appliedSticks = photo.appliedStickChips ?? [];
            const activeStick = alumniStickChips.find((s) => s.label === selectedStickLabel);
            const activeLabel = activeStick?.label ?? selectedStickLabel;
            const hasSelectedStick = appliedSticks.includes(activeLabel);
            const displayUploader = photo.uploaderLabel || '방장';
            return (
              <div
                key={`stick_${photo.id}`}
                className={`rounded-2xl overflow-hidden bg-zinc-950 border flex flex-col justify-between transition-all ${
                  appliedSticks.length > 0
                    ? 'border-emerald-400/45 shadow-lg'
                    : 'border-white/10'
                }`}
              >
                <div>
                  <div className="relative aspect-[4/3] w-full bg-zinc-900 overflow-hidden">
                    <img
                      src={photo.thumbUrl}
                      alt={photo.name}
                      crossOrigin={photo.thumbUrl?.startsWith('http://127.0.0.1') ? 'anonymous' : undefined}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 left-2 flex flex-wrap items-center gap-1">
                      <span className="px-2 py-0.5 rounded bg-black/80 border border-white/15 text-zinc-200 font-mono text-[10px] font-bold">
                        {displayUploader}
                      </span>
                    </div>
                    <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-1">
                      <span className="px-2 py-0.5 rounded bg-zinc-950/90 border border-white/15 text-zinc-200 font-mono text-[10px] font-bold truncate">
                        {photo.looseTimelineGroup || photo.date.split(' ')[0]}
                      </span>
                      {appliedSticks.length > 0 ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-950/95 border border-emerald-400/50 text-emerald-300 font-label-sm text-[10.5px] font-extrabold shrink-0">
                          ✓ 스티커 {appliedSticks.length}개
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-amber-400/90 text-zinc-950 font-label-sm text-[10.5px] font-extrabold shrink-0">
                          부착 대기
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-label-sm text-[12px] text-white font-bold truncate">
                        #{index + 1}. {photo.captionKo || photo.name}
                      </span>
                    </div>

                    {/* 부착된 스틱 태그 목록 */}
                    <div className="flex flex-wrap items-center gap-1 min-h-[24px]">
                      {appliedSticks.length > 0 ? (
                        appliedSticks.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/40 text-amber-200 font-label-sm text-[10.5px] font-bold"
                          >
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-zinc-400 font-medium">
                          아직 붙인 스티커가 없어요 — 아래 버튼으로 1초 부착
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 하단 액션: 1초 스틱 부착 / 떼기 */}
                <div className="p-3 pt-0 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => applyStickChipToSharedPhoto(photo.id, activeLabel)}
                    className={`w-full py-1.5 rounded-lg border font-label-sm text-[11.5px] font-extrabold transition-colors cursor-pointer ${
                      hasSelectedStick
                        ? 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-400/60 text-emerald-200'
                        : 'bg-zinc-900 hover:bg-zinc-800 border-amber-400/40 text-amber-300'
                    }`}
                  >
                    {hasSelectedStick
                      ? `✓ [${activeLabel}] 부착됨 (눌러서 떼기)`
                      : `👆 [${activeLabel}] 1초 부착`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        )}
        </div>
        )}
      </section>
      )}

      {/* 새로 올라온 사진 정리함 그리드 */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <span className="font-headline-sm text-[15.5px] text-white font-bold">
            최근 올라온 사진 ({queuePhotos.length}장)
          </span>
          <button
            type="button"
            onClick={scrollToSharedTrash}
            className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-200 font-label-sm text-[11.5px] font-bold cursor-pointer"
          >
            공유방 휴지통 ({trashedRoomPhotos.length}장) 보기 
          </button>
        </div>

        {lastDeletedPhotoId && (
          <div className="px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-emerald-400/50 flex flex-wrap items-center justify-between gap-2 text-[12px] text-emerald-200">
            <span>
              업로드 후 24시간 내 본인 삭제 요청에 따라 사진이 공유방에서 내려가고 아래 <strong>[공유방 휴지통]</strong>으로 이동되었습니다. (원본 기기 사진은 안전하며 언제든 복원 가능)
            </span>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  restoreSharedRoomPhotoFromTrash(lastDeletedPhotoId);
                  setLastDeletedPhotoId(null);
                }}
                className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-label-sm text-[11px] font-extrabold cursor-pointer"
              >
                ↩️ 1초 실행 취소 (되돌리기)
              </button>
              <button
                type="button"
                onClick={scrollToSharedTrash}
                className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-emerald-400/40 text-emerald-200 font-label-sm text-[11px] font-extrabold cursor-pointer"
              >
                휴지통 바로가기 ({trashedRoomPhotos.length}장) 
              </button>
            </div>
          </div>
        )}

        {queuePhotos.length === 0 ? (
          <div className="p-6 rounded-2xl bg-[#18181B] border border-white/10 text-center text-[12.5px] text-zinc-400">
            {trashedRoomPhotos.length > 0
              ? `이 방의 사진이 모두 아래 [공유방 휴지통(${trashedRoomPhotos.length}장)]으로 이동되었습니다. 아래 휴지통에서 언제든 복원할 수 있습니다.`
              : '아직 이 공유방에 올라온 사진이 없습니다. 앨범 화면에서 사진을 올리면 여기에 표시됩니다.'}
          </div>
        ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
          {queuePhotos.map((photo) => {
            const sender = photo.uploaderLabel || '방장';
            const isDone = true;
            return (
              <article
                key={photo.id}
                className="rounded-2xl overflow-hidden bg-[#18181B] border border-white/10 flex flex-col"
              >
                <div className="relative aspect-[4/3] w-full bg-zinc-950 overflow-hidden">
                  <img
                    src={photo.thumbUrl}
                    alt={photo.name}
                    crossOrigin={photo.thumbUrl?.startsWith('http://127.0.0.1') ? 'anonymous' : undefined}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                  <div
                    className={`absolute top-2 left-2 px-2 py-0.5 rounded-md font-label-sm text-[10px] font-bold border ${
                      isDone
                        ? 'bg-emerald-950/90 border-emerald-400/50 text-emerald-300'
                        : 'bg-amber-950/90 border-amber-400/50 text-amber-300'
                    }`}
                  >
                    {isDone
                      ? '✓ 정식 피드 반영 완료'
                      : 'AI가 예쁜 이름표를 달며 꽃단장 중이에요'}
                  </div>
                </div>
                <div className="p-3 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-1 text-[11px]">
                    <span className="px-2 py-0.5 rounded bg-zinc-900 border border-white/10 text-zinc-200 font-bold truncate">
                      {sender}
                    </span>
                    {(() => {
                      const delPerm = evaluateSharedPhotoDeletePermission({
                        photoId: photo.id,
                        uploaderLabel: photo.uploaderLabel,
                        mtimeMs: photo.mtimeMs,
                        isJoinedOtherRoom: Boolean(activeJoinedRoomMeta),
                        hostRetainsHidePermission: hostRetainsHidePerm,
                        currentIdentityTokens,
                      });
                      if (!delPerm.allowed) return null;
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            softDeleteSharedRoomPhoto24h(photo.id);
                            setLastDeletedPhotoId(photo.id);
                          }}
                          title={
                            delPerm.mode === 'host_hide'
                              ? '방장 권한으로 이 사진을 공유방에서 숨기고 휴지통으로 이동합니다'
                              : '올린 원본 주인은 업로드 후 24시간 내에 언제나 직접 삭제할 수 있습니다'
                          }
                          className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-rose-950/80 border border-white/10 hover:border-rose-400/50 text-zinc-400 hover:text-rose-200 font-label-sm text-[10.5px] font-bold cursor-pointer shrink-0"
                        >
                          {delPerm.mode === 'host_hide' ? '방장 숨기기' : '24시간 내 본인 삭제'}
                        </button>
                      );
                    })()}
                  </div>
                  <div className="flex items-center justify-between text-[10.5px]">
                    <p className="text-zinc-400 truncate">
                      {photo.tags.slice(0, 3).join(' · ') || '인물·장소 분류 완료'}
                    </p>
                    <span className="text-zinc-500 font-mono shrink-0">{photo.date.split(' ')[0]}</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        )}
      </section>

      {/* 공유방 휴지통 섹션 (24시간 내 본인 삭제 사진 보관 및 1초 복원) */}
      <section
        id="shared-room-trash-section"
        ref={trashSectionRef}
        className={`p-5 rounded-2xl bg-[#18181B] border flex flex-col gap-3.5 transition-all ${
          highlightTrashSection
            ? 'border-emerald-400 ring-2 ring-emerald-400/50 shadow-lg'
            : trashedRoomPhotos.length > 0
            ? 'border-rose-400/40'
            : 'border-white/10'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-headline-sm text-[15.5px] text-white font-bold">
                공유방 휴지통 ({trashedRoomPhotos.length}장)
              </span>
              <span className="px-2 py-0.5 rounded-md bg-zinc-900 border border-white/10 text-zinc-300 text-[11px] font-bold">
                24시간 내 본인 삭제 임시 보관 · 1초 복원 지원
              </span>
            </div>
            <p className="text-[11.5px] text-zinc-400">
              공유방에서 삭제한 사진이 여기에 임시 보관됩니다. 원본 기기(PC/스마트폰) 파일은 삭제되지 않으며, [↩️ 1초 복원]을 누르면 공유방 앨범으로 즉시 돌아옵니다.
            </p>
          </div>

          {trashedRoomPhotos.length > 0 && (
            <button
              type="button"
              onClick={() => {
                restoreAllSharedRoomTrashPhotos(trashedRoomPhotos.map((p) => p.id));
                setLastDeletedPhotoId(null);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-label-sm text-[12px] font-extrabold cursor-pointer shrink-0"
            >
              ↩️ 휴지통 전체 복원 ({trashedRoomPhotos.length}장)
            </button>
          )}
        </div>

        {trashedRoomPhotos.length === 0 ? (
          <div className="px-4 py-3.5 rounded-xl bg-zinc-950/80 border border-white/5 text-[12px] text-zinc-400">
            현재 공유방 휴지통이 비어 있습니다. 위 [최근 올라온 사진]에서 [24시간 내 본인 삭제]를 누르면 이곳에 임시 보관되어 언제든 복원할 수 있습니다.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
            {trashedRoomPhotos.map((photo) => {
              const sender = photo.uploaderLabel || '방장';
              return (
                <article
                  key={`trash_${photo.id}`}
                  className="rounded-2xl overflow-hidden bg-zinc-950 border border-rose-400/35 flex flex-col"
                >
                  <div className="relative aspect-[4/3] w-full bg-zinc-900 overflow-hidden">
                    <img
                      src={photo.thumbUrl}
                      alt={photo.name}
                      crossOrigin={photo.thumbUrl?.startsWith('http://127.0.0.1') ? 'anonymous' : undefined}
                      loading="lazy"
                      className="w-full h-full object-cover opacity-75"
                    />
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-rose-950/90 border border-rose-400/50 text-rose-200 font-label-sm text-[10px] font-extrabold">
                      휴지통 보관 중
                    </div>
                  </div>
                  <div className="p-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-1 text-[11px]">
                      <span className="px-2 py-0.5 rounded bg-zinc-900 border border-white/10 text-zinc-200 font-bold truncate">
                        {sender}
                      </span>
                      <span className="text-zinc-500 font-mono text-[10px] shrink-0">
                        {photo.date.split(' ')[0]}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          restoreSharedRoomPhotoFromTrash(photo.id);
                          if (lastDeletedPhotoId === photo.id) {
                            setLastDeletedPhotoId(null);
                          }
                        }}
                        className="flex-1 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-label-sm text-[11px] font-extrabold cursor-pointer"
                      >
                        ↩️ 1초 복원
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          permanentlyDeleteSharedRoomTrashPhoto(photo.id);
                          if (lastDeletedPhotoId === photo.id) {
                            setLastDeletedPhotoId(null);
                          }
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-rose-950/80 border border-white/10 hover:border-rose-400/50 text-zinc-400 hover:text-rose-200 font-label-sm text-[10.5px] font-bold cursor-pointer shrink-0"
                      >
                        ✕ 영구 삭제
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
};
