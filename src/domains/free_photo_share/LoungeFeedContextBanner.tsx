import React, { useEffect, useRef, useState } from 'react';
import {
  buildWindowsNativeWebDavMountCommand,
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

export const LoungeFeedContextBanner: React.FC = () => {
  const {
    activeLoungeType,
    setActiveLoungeType,
    activeFamilyRoom,
    setActiveFamilyRoom,
    activeSharedRoomId,
    activeJoinedRoomMeta,
    selectOwnSharedRoom,
    leaveJoinedSharedRoom,
    faceClusters,
    runTextQuery,
    findMySchoolDaysPhotosFast,
    photos,
    sharedRoomHostPhotos,
    sharedRoomAddedPhotos,
    setShowFaceRegistryModal,
    setDoorplatePickerClusterId,
    setDesktopTab,
    setMobileTab,
    clubFeedTrack,
    setClubFeedTrack,
    alumniBannerTitle,
    isGuestPreviewMode,
    setIsGuestPreviewMode,
    triggerGuestJoinWall,
  } = useSaySeeStore();

  const [p2pOriginalSummoned, setP2pOriginalSummoned] = useState(false);
  const [showStorageCheckBanner, setShowStorageCheckBanner] = useState(false);
  const [estimatedFreeStorageGb, setEstimatedFreeStorageGb] = useState<string | null>(null);
  const [downloadDirPath, setDownloadDirPath] = useState('D:\\Ghosti\\다운로드_원본');
  const [showClubCover, setShowClubCover] = useState(false);
  const [clubBannerBgTheme, setClubBannerBgTheme] = useState<'forest' | 'sunset'>('forest');
  const [clubBannerTitle, setClubBannerTitle] = useState('주말 산악 · 골프 · 취미 동호회 모임방');
  const [editingClubTitle, setEditingClubTitle] = useState(false);
  const [clubTitleDraft, setClubTitleDraft] = useState('주말 산악 · 골프 · 취미 동호회 모임방');
  const [clubInviteCopied, setClubInviteCopied] = useState(false);

  useEffect(() => {
    if (!showStorageCheckBanner || typeof navigator === 'undefined' || !navigator.storage?.estimate) {
      return;
    }
    let cancelled = false;
    void navigator.storage
      .estimate()
      .then((est) => {
        if (cancelled) return;
        const quota = typeof est.quota === 'number' ? est.quota : 0;
        const usage = typeof est.usage === 'number' ? est.usage : 0;
        if (quota > usage && quota > 0) {
          const freeGb = (quota - usage) / (1024 * 1024 * 1024);
          if (freeGb >= 0.1) {
            setEstimatedFreeStorageGb(`${freeGb.toFixed(1)}GB`);
          }
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [showStorageCheckBanner]);

  const handleCopyClubInviteHook = async () => {
    const ok = await copyAuthenticatedRoomInviteFlow({
      loungeType: 'club',
      familyRoom: '우리집',
      defaultHostLabel: '모임총무',
      roomTitle: `⛰️ ${clubBannerTitle}`,
      promptLabel: '모임방 초대 링크를 복사해 공유하세요:',
      formatCopyText: (clubInviteUrl) =>
        `[${clubBannerTitle}] 이번 모임·라운딩 고화질 원본 사진과 영상이 모두 올라왔습니다! 설치·로그인 없이 바로 구경하세요 (인원·장수 제한 없이 전원 평생 0원 무료)\n👉 ${clubInviteUrl}`,
    });
    if (!ok) return;
    setClubInviteCopied(true);
    setTimeout(() => setClubInviteCopied(false), 2600);
  };

  const activeRoomPhotoCount = resolveLoungePhotoCorpus({
    activeLoungeType,
    activeFamilyRoom,
    activeSharedRoomId,
    photos,
    sharedRoomHostPhotos,
    sharedRoomAddedPhotos,
  }).length;
  const estimatedOriginalSizeLabel =
    activeRoomPhotoCount === 0
      ? '0장 (0MB)'
      : `${activeRoomPhotoCount}장 (약 ${(activeRoomPhotoCount * 3.2).toFixed(1)}MB)`;

  const renderOriginalAutoSyncControl = () => (
    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0 max-w-full">
      {/* 실제 공유 사진이 있고 사용자가 원본 동기화를 켰을 때만 실제 장수로 표시 */}
      {p2pOriginalSummoned && activeRoomPhotoCount > 0 && (
        <span className="px-2 sm:px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/60 text-emerald-300 font-label-sm text-[11px] font-extrabold flex items-center gap-1 shadow-xs shrink-0">
          <span className="sm:hidden">✨ 동기화 ({activeRoomPhotoCount}장)</span>
          <span className="hidden sm:inline">✨ 원본 동기화 완료 ({activeRoomPhotoCount}장)</span>
        </span>
      )}

      <button
        type="button"
        onClick={() => {
          if (isGuestPreviewMode) {
            triggerGuestJoinWall('💾 고화질 원본 내 폰에 일괄 저장');
            return;
          }
          setShowStorageCheckBanner(true);
          const next = !p2pOriginalSummoned;
          setP2pOriginalSummoned(next);
          if (next) {
            void fetch('/__club/download-originals', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ openExplorer: false }),
            })
              .then((r) => r.json())
              .then((d: { downloadDir?: string }) => {
                if (d?.downloadDir) setDownloadDirPath(d.downloadDir);
              })
              .catch(() => {});
          }
        }}
        className={`px-3.5 py-1.5 rounded-full font-label-sm text-[12px] font-extrabold transition-all border shrink-0 whitespace-nowrap cursor-pointer ${
          p2pOriginalSummoned
            ? 'bg-primary-container text-zinc-950 border-primary-container'
            : 'bg-zinc-900 hover:bg-zinc-800 text-primary-container border-primary-container/50'
        }`}
        title="공유방의 고화질 원본 사진을 내 기기 폴더에 자동 동기화합니다"
      >
        <span className="sm:hidden">
          {p2pOriginalSummoned ? '🔄 원본 동기화 ON' : '🔄 원본 동기화'}
        </span>
        <span className="hidden sm:inline">
          {p2pOriginalSummoned
            ? '🔄 원본 동기화 (ON · 자동 보관 중)'
            : '🔄 원본 동기화 켜기'}
        </span>
      </button>
    </div>
  );

  const renderStorageCheckAndSyncDetail = () => {
    if (!showStorageCheckBanner) return null;
    return (
      <div className="px-4 py-3.5 rounded-2xl bg-[#18181B] border-2 border-emerald-400/50 shadow-sm flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
            <span className="px-2.5 py-1 rounded-lg font-extrabold text-[11px] bg-emerald-400 text-zinc-950">
              {p2pOriginalSummoned
                ? '✓ 내 기기 원본 자동 동기화 ON'
                : 'ℹ️ 내 기기 원본 동기화 안내'}
            </span>
            <span className="text-white font-bold">
              현재 공유방 사진 <strong className="text-emerald-300">{estimatedOriginalSizeLabel}</strong>
              {estimatedFreeStorageGb ? (
                <>
                  {' '}· 내 기기 가용 여유 공간{' '}
                  <strong className="text-emerald-300">{estimatedFreeStorageGb}</strong>
                </>
              ) : null}{' '}
              — {activeRoomPhotoCount === 0
                ? '새 사진이 올라오면 내 기기 원본 동기화 폴더에 자동으로 저장됩니다.'
                : '내 기기 동기화 폴더에 원본 사진을 안전하게 자동 보관합니다.'}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowStorageCheckBanner(false)}
              className="px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-[11.5px] font-bold cursor-pointer"
            >
              ✕ 닫기
            </button>
          </div>
        </div>

        {/* 원본 동기화 저장 경로 지정 */}
        <div className="p-3 rounded-xl bg-zinc-950 border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-2.5 text-[12px]">
          <span className="text-emerald-300 font-extrabold">
            📂 원본 동기화 저장 경로
          </span>
          <div className="flex flex-wrap items-center gap-2 shrink-0 max-w-full">
            <input
              type="text"
              value={downloadDirPath}
              onChange={(e) => setDownloadDirPath(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-white/15 text-white font-mono text-[11.5px] font-bold w-full sm:w-60 min-w-0"
              aria-label="원본 동기화 저장 경로"
            />
            <button
              type="button"
              onClick={() => {
                useSaySeeStore
                  .getState()
                  .showToast(
                    `📂 [원본 동기화 경로 저장 완료] 앞으로 이 방의 원본 사진은 '${downloadDirPath}' 폴더에 자동 동기화됩니다.`
                  );
              }}
              className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-white/15 text-zinc-200 font-label-sm text-[11.5px] font-bold cursor-pointer"
            >
              📍 경로 지정 확인
            </button>
            <button
              type="button"
              onClick={() => {
                void fetch('/__club/download-originals', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ openExplorer: true }),
                }).catch(() => {});
              }}
              className="hidden sm:inline-flex px-3 py-1.5 rounded-xl bg-primary-container text-zinc-950 hover:opacity-90 font-label-sm text-[11.5px] font-extrabold cursor-pointer"
            >
              📂 내 기기 원본 폴더 열기
            </button>
          </div>
        </div>
      </div>
    );
  };

  const currentRoomPhotos = resolveLoungePhotoCorpus({
    activeLoungeType,
    activeFamilyRoom,
    activeSharedRoomId,
    photos,
    sharedRoomHostPhotos,
    sharedRoomAddedPhotos,
  });
  const namedClusters =
    currentRoomPhotos.length > 0
      ? faceClusters.filter((c) => !c.excludedAsPasserby && c.registeredName)
      : [];
  const FAMILY_ROOMS: FamilyRoomId[] = ['우리집', '본가(친가)', '처가(친정)'];

  if (activeLoungeType === 'personal') {
    return null;
  }

  const renderMemberPersonaPills = (_labelText: string) => {
    // [멀린님 확정 지시 — 2026-11-17]: 여권 얼굴 칩은 외부 화면에 노출하지 않고 필요할 때 뒤에서 자동으로 잡아주며, 설정방 안에 '내 여권'만 보관합니다.
    return null;
  };

  const inviteMeta = readCurrentInviteDisplayMeta(activeLoungeType, activeFamilyRoom);
  const isNativeAppRuntime = isCapacitorNativeMobileRuntime();

  const renderMobileGuestPreviewBanner = () => {
    if (!isGuestPreviewMode) return null;
    return (
      <div className="md:hidden px-3.5 py-2.5 rounded-2xl border flex flex-col gap-2 transition-all bg-gradient-to-r from-amber-500/15 via-emerald-500/10 to-zinc-900 border-amber-400/50">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="px-2.5 py-1 rounded-lg bg-[#FEE500] text-[#191919] font-label-sm text-[11px] font-extrabold shadow-xs break-keep">
            {inviteMeta.inviteToken && !inviteMeta.isHostVerified
              ? `💌 [${inviteMeta.roomTitle}] 초대장 불러오는 중...`
              : `💌 ${inviteMeta.hostName}님이 초대한 [${inviteMeta.roomTitle}] · 로그인 없이 구경 중`}
          </span>

          {!isNativeAppRuntime && (
            <button
              type="button"
              onClick={() => {
                if (isAndroidMobileBrowserOrApp()) {
                  const safeIntentUrl = buildAndroidSafeAppProbeIntentUrl(window.location.href);
                  if (safeIntentUrl) {
                    window.location.href = safeIntentUrl;
                    return;
                  }
                }
                window.location.href = buildShareRoomNativeSchemeUrl({
                  loungeType: activeLoungeType,
                  familyRoom: activeFamilyRoom,
                  inviteToken: inviteMeta.inviteToken,
                  hostName: inviteMeta.hostName,
                  roomTitle: inviteMeta.roomTitle,
                });
              }}
              className="px-2.5 py-1 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 border border-teal-400/50 text-teal-200 font-label-sm text-[10.5px] font-extrabold cursor-pointer shrink-0"
            >
              📱 이미 앱이 있다면 앱으로 열기
            </button>
          )}

          {!inviteMeta.hasExplicitUrlInvite && hasAuthenticatedHubAccountSession() && (
            <button
              type="button"
              onClick={() => setIsGuestPreviewMode(false)}
              className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10.5px] font-bold cursor-pointer"
            >
              ↩️ 방장 화면 복귀
            </button>
          )}
        </div>
        <span className="text-[11px] text-zinc-300 leading-snug break-keep">
          설치·가입 없이 공유 사진방을 자유롭게 구경하고 검색해 보세요! 아래 기능을 누르면 무료 모바일 앱 설치 후 이 방으로 자동 입장됩니다.
        </span>
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {[
            { label: '📸 내 폰 사진도 이 방에 올리기', reason: '📸 내 폰 사진도 이 방에 올리기' },
            { label: '💾 고화질 원본 내 폰에 일괄 저장', reason: '💾 고화질 원본 내 폰에 일괄 저장' },
            { label: '🔔 새 사진 올라오면 알림 받기', reason: '🔔 새 사진 올라오면 카톡·푸시 알림 받기' },
          ].map((trig) => (
            <button
              key={trig.label}
              type="button"
              onClick={() => triggerGuestJoinWall(trig.reason)}
              className="px-2.5 py-1 rounded-lg bg-zinc-950/90 hover:bg-zinc-800 border border-amber-400/40 text-amber-200 text-[10.5px] font-bold cursor-pointer"
            >
              {trig.label}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderJoinedRoomContextBanner = () => {
    if (!activeJoinedRoomMeta || isGuestPreviewMode) return null;
    return (
      <div
        className={`px-3.5 py-2.5 rounded-2xl border flex flex-wrap items-center justify-between gap-2 transition-all ${
          'bg-amber-50/95 border-amber-300 text-amber-950'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-zinc-950 font-label-sm text-[11px] font-black shrink-0">
            💌 초대받은 독립 공유방
          </span>
          <span className="font-label-sm text-[12.5px] font-extrabold break-keep">
            {activeJoinedRoomMeta.masterNickname}님이 초대한 『{activeJoinedRoomMeta.roomTitle}』
          </span>
          <span
            className={`text-[11px] font-bold break-keep ${
              'text-amber-800/85'
            }`}
          >
            · 🔒 내 공유방과 100% 분리 보관 중
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() =>
              selectOwnSharedRoom(
                activeJoinedRoomMeta.loungeType,
                activeJoinedRoomMeta.familyRoom
              )
            }
            className={`px-2.5 py-1 rounded-lg border text-[11.5px] font-extrabold cursor-pointer shrink-0 transition-all ${
              'bg-white border-amber-300 text-amber-900 hover:bg-amber-100'
            }`}
          >
            ↩️ 내 공유방으로 돌아가기
          </button>
          <button
            type="button"
            onClick={() => void leaveJoinedSharedRoom(activeJoinedRoomMeta.roomId)}
            title="이 초대받은 공유방에서 나가며 내 기기의 이 방 로컬 캐시 사진을 즉시 삭제합니다 (내 개인 여권과 내 사진은 100% 보존)"
            className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/50 text-rose-200 text-[11.5px] font-extrabold cursor-pointer shrink-0 transition-all"
          >
            🚪 이 공유방 나가기
          </button>
        </div>
      </div>
    );
  };

  if (activeLoungeType === 'family') {
    return (
      <div className="flex flex-col gap-2.5">
        {renderMobileGuestPreviewBanner()}
        {renderJoinedRoomContextBanner()}
        <div className="px-1 py-1 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {renderMemberPersonaPills(`[${activeFamilyRoom}] 인물:`)}
            {renderOriginalAutoSyncControl()}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => useSaySeeStore.getState().requestAddMyPhotosToSharedRoom()}
              className="px-3.5 py-2 rounded-xl bg-[#2DD4BF] hover:bg-[#5EEAD4] text-zinc-950 font-label-sm text-[12px] font-black shadow-md shadow-teal-500/20 flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <span>📸 내 사진도 이 방에 추가하기</span>
            </button>
            <button
              type="button"
              onClick={async () => {
                const ok = await copyAuthenticatedRoomInviteFlow({
                  loungeType: 'family',
                  familyRoom: activeFamilyRoom,
                  defaultHostLabel: '가족방장',
                  roomTitle:
                    activeFamilyRoom === '본가(친가)'
                      ? '🏡 본가(친가) 가족 사진방'
                      : activeFamilyRoom === '처가(친정)'
                        ? '🌸 처가(친정) 가족 사진방'
                        : '🏠 우리집 가족 사진방',
                  promptLabel: `『${activeFamilyRoom} 가족 사진방』 초대 링크를 복사해 공유하세요:`,
                });
                if (!ok) return;
                const targetLabel = activeJoinedRoomMeta
                  ? `${activeJoinedRoomMeta.masterNickname} · ${activeJoinedRoomMeta.roomTitle}`
                  : `${activeFamilyRoom} 가족 사진방`;
                useSaySeeStore
                  .getState()
                  .showToast(`💌 『${targetLabel}』 초대 링크가 복사되었습니다! 카톡방에 바로 붙여넣어 공유하세요.`);
              }}
              className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-amber-400/50 text-amber-300 font-label-sm text-[11.5px] font-extrabold flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <span>{activeJoinedRoomMeta ? '💌 이 초대방 링크 복사' : '💌 가족방 초대 링크 복사'}</span>
            </button>
          </div>
        </div>
        <GhostCastLiveToolbar loungeLabel={`👨‍👩‍👧‍👦 패밀리 [${activeFamilyRoom}]`} />
        {renderStorageCheckAndSyncDetail()}
      </div>
    );
  }

  if (activeLoungeType === 'club') {
    const isForestTheme = clubBannerBgTheme === 'forest';
    return (
      <div className="flex flex-col gap-2.5">
        {renderMobileGuestPreviewBanner()}
        {renderJoinedRoomContextBanner()}
        {/* 동호회·모임 전용 헤더 바 (동창회와 동일한 간판·초대장 열기/접기 및 후원 문구 통일) */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-headline-sm text-[18px] md:text-[20px] text-white font-extrabold tracking-tight">
              ⛰️ {clubBannerTitle}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-400/15 border border-emerald-300/30 text-emerald-300 text-[11px] font-bold">
              🎉 인원·장수 제한 없이 평생 0원
            </span>
            <button
              type="button"
              onClick={() => setShowClubCover((v) => !v)}
              className="px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-100 text-[12.5px] font-extrabold select-none shadow-sm cursor-pointer transition-all"
            >
              {showClubCover ? '간판 접기 ▴' : '🏕️ 간판·초대장 열기 ▾'}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex p-0.5 rounded-xl bg-zinc-900 border border-white/10">
              <button
                type="button"
                onClick={() => setClubFeedTrack('recent_now')}
                className={`px-3 py-1.5 rounded-lg font-label-sm text-[11.5px] font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                  clubFeedTrack === 'recent_now'
                    ? 'bg-primary-container text-zinc-950 shadow-xs'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                🏕️ 정기 모임·라운딩
              </button>

              <button
                type="button"
                onClick={() => setClubFeedTrack('memories_1989')}
                className={`px-3 py-1.5 rounded-lg font-label-sm text-[11.5px] font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                  clubFeedTrack === 'memories_1989'
                    ? 'bg-primary-container text-zinc-950 shadow-xs'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                🍻 번개 · 추억 앨범
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                if (isGuestPreviewMode) {
                  triggerGuestJoinWall('🎯 내 얼굴이 나온 모임 사진만 1초 만에 다 찾기');
                  return;
                }
                void findMySchoolDaysPhotosFast();
              }}
              className="px-3 py-1.5 rounded-xl bg-primary-container/15 hover:bg-primary-container/25 border border-primary-container/40 text-primary-container font-label-sm text-[11.5px] font-extrabold cursor-pointer whitespace-nowrap"
            >
              🎯 내 모임 사진 1초 찾기
            </button>
          </div>
        </div>

        {/* 사용자가 [🏕️ 간판·초대장 열기 ▾]를 눌렀을 때 펼쳐지는 동호회·모임 간판 */}
        {showClubCover && (
          <div
            data-keep-dark="true"
            className={`relative rounded-xl overflow-hidden border px-5 py-4 transition-all ${
              isForestTheme
                ? 'bg-gradient-to-r from-[#163325] via-[#1E4432] to-[#142B1F] border-[#6A9E82]/60 shadow-[inset_0_0_32px_rgba(0,0,0,0.45)]'
                : 'bg-gradient-to-r from-[#4A221D] via-[#7A3522] to-[#361D33] border-amber-300/50 shadow-[inset_0_0_32px_rgba(0,0,0,0.4)]'
            }`}
          >
            <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3.5">
              <div className="flex flex-wrap items-center gap-3 text-[12px] text-white/85">
                <button
                  type="button"
                  onClick={() => setClubBannerBgTheme(isForestTheme ? 'sunset' : 'forest')}
                  className="underline hover:text-white cursor-pointer font-bold whitespace-nowrap"
                >
                  {isForestTheme ? '🌅 노을 캠핑 배경으로 변경' : '🌲 숲속 필드 배경으로 변경'}
                </button>

                <span className="text-white/40">|</span>

                {editingClubTitle ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const trimmed = clubTitleDraft.trim();
                      if (trimmed) setClubBannerTitle(trimmed);
                      setEditingClubTitle(false);
                    }}
                    className="flex items-center gap-1.5"
                  >
                    <input
                      type="text"
                      value={clubTitleDraft}
                      onChange={(e) => setClubTitleDraft(e.target.value)}
                      placeholder="예: 주말 산악 · 골프 모임방"
                      className="px-2.5 py-1 rounded bg-black/60 border border-amber-300/70 text-white text-[12px] font-bold w-44 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="px-2.5 py-1 rounded bg-amber-300 text-zinc-950 text-[11.5px] font-extrabold whitespace-nowrap cursor-pointer"
                    >
                      적용
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setClubTitleDraft(clubBannerTitle);
                      setEditingClubTitle(true);
                    }}
                    className="underline text-amber-200 hover:text-amber-100 cursor-pointer font-bold whitespace-nowrap"
                  >
                    ✏️ 모임 이름 변경
                  </button>
                )}
              </div>

              <div className="flex flex-col items-start lg:items-center text-left lg:text-center gap-0.5 min-w-0">
                <h2 className="font-headline-md text-[19px] sm:text-[22px] md:text-[25px] text-white font-black tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] break-keep">
                  {clubBannerTitle}
                </h2>
                <span className="text-[12px] text-amber-200/95 font-medium">
                  🎉 인원·장수 제한 없이 전 회원 평생 0원 운영 중
                </span>
              </div>

              <button
                type="button"
                onClick={() => void handleCopyClubInviteHook()}
                className={`px-4 py-2 rounded-xl font-label-sm text-[12px] font-extrabold transition-all shadow-md shrink-0 whitespace-nowrap cursor-pointer ${
                  clubInviteCopied
                    ? 'bg-emerald-400 text-zinc-950'
                    : 'bg-amber-300 hover:bg-amber-200 text-zinc-950'
                }`}
              >
                {clubInviteCopied ? '✓ 단톡방 초대장 복사됨!' : '💌 단톡방 초대 문구 복사'}
              </button>
            </div>
          </div>
        )}

        {/* 하단 1줄: 모임 인물 빠른 검색 + 사진 추가·초대 링크 복사 */}
        <div className="px-1 py-1 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {renderMemberPersonaPills('회원별 사진 찾기:')}
            {renderOriginalAutoSyncControl()}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => useSaySeeStore.getState().requestAddMyPhotosToSharedRoom()}
              className="px-3.5 py-2 rounded-xl bg-[#2DD4BF] hover:bg-[#5EEAD4] text-zinc-950 font-label-sm text-[12px] font-black shadow-md shadow-teal-500/20 flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <span>📸 내 사진도 이 방에 추가하기</span>
            </button>
            <button
              type="button"
              onClick={async () => {
                const ok = await copyAuthenticatedRoomInviteFlow({
                  loungeType: 'club',
                  familyRoom: '우리집',
                  defaultHostLabel: '모임방장',
                  roomTitle: `⛰️ ${clubBannerTitle}`,
                  promptLabel: `『${clubBannerTitle}』 초대 링크를 복사해 공유하세요:`,
                });
                if (!ok) return;
                useSaySeeStore
                  .getState()
                  .showToast(`💌 『${clubBannerTitle}』 초대 링크가 복사되었습니다! 카톡방에 바로 붙여넣어 공유하세요.`);
              }}
              className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-amber-400/50 text-amber-300 font-label-sm text-[11.5px] font-extrabold flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <span>💌 모임방 초대 링크 복사</span>
            </button>
          </div>
        </div>

        <GhostCastLiveToolbar loungeLabel="⛰️ 동호회·모임 사진 공유방" />

        {/* 남은 용량 대비 가능/불가능 안내 및 내 기기 저장 폴더 열기 */}
        {renderStorageCheckAndSyncDetail()}
      </div>
    );
  }

  if (activeLoungeType === 'work') {
    return <WorkLoungeB2BHub />;
  }

  // student ('🎓 동창회 (사진 공유)')
  return (
    <div className="flex flex-col gap-2.5">
      {renderMobileGuestPreviewBanner()}
      {renderJoinedRoomContextBanner()}
      <AlumniRetroBannerAndTwoTrackBar
        onOpenWaitingRoom={() => {
          setDesktopTab('trash');
          setMobileTab('trash');
        }}
      />

      <div className="px-1 py-1 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {renderMemberPersonaPills('동창 이름 검색:')}
          {renderOriginalAutoSyncControl()}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => useSaySeeStore.getState().requestAddMyPhotosToSharedRoom()}
            className="px-3.5 py-2 rounded-xl bg-[#2DD4BF] hover:bg-[#5EEAD4] text-zinc-950 font-label-sm text-[12px] font-black shadow-md shadow-teal-500/20 flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <span>📸 내 사진도 이 방에 추가하기</span>
          </button>
          <button
            type="button"
            onClick={async () => {
              const ok = await copyAuthenticatedRoomInviteFlow({
                loungeType: 'student',
                familyRoom: '우리집',
                defaultHostLabel: '동기회장',
                roomTitle: `🎓 ${alumniBannerTitle}`,
                promptLabel: `『${alumniBannerTitle}』 초대 링크를 복사해 공유하세요:`,
              });
              if (!ok) return;
              useSaySeeStore
                .getState()
                .showToast(`💌 『${alumniBannerTitle}』 초대 링크가 복사되었습니다! 카톡방에 바로 붙여넣어 공유하세요.`);
            }}
            className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-amber-400/50 text-amber-300 font-label-sm text-[11.5px] font-extrabold flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <span>💌 동창회 초대 링크 복사</span>
          </button>
        </div>
      </div>

      <GhostCastLiveToolbar loungeLabel="🎓 동창회 사진 공유방" />

      {renderStorageCheckAndSyncDetail()}
    </div>
  );
};
