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

/**
 * ⛳ 동호회 · 동창회 (사진 공유) (4050 동창회 특화 UX — Warm Light 앨범 프레임 + 1줄 요약 정화 버전)
 * 1) 맞춤형 동창회 간판 (복고풍 칠판 / 노을 진 운동장 그래픽 + 사용자 입력 문구 그대로 간판명 반영 + 초대장 카피 버튼)
 * 2) 첫 화면 검색 전면 배치 ([🎯 내 얼굴로 학창 시절 사진 1초 만에 찾기]) & '추억 vs 근황' 투트랙 탭 ([🎞️ 응답하라 1989 (추억)] 기본 고정 / [🍻 최근 우리들 (근황)]) + 1줄 스마트 알림 클린존 안내
 */
export const AlumniRetroBannerAndTwoTrackBar: React.FC<{
  onNavigateToFeed?: () => void;
  onOpenWaitingRoom?: () => void;
}> = ({ onNavigateToFeed, onOpenWaitingRoom }) => {
  const {
    alumniBannerTitle,
    alumniSchoolName,
    alumniGradYear,
    alumniBannerTheme,
    setAlumniBannerInfo,
    clubFeedTrack,
    setClubFeedTrack,
    findMySchoolDaysPhotosFast,
    analogYearProposals,
    approveAllAnalogYearProposals,
    isStoreAppMode,
    setShowProModal,
    isGuestPreviewMode,
    triggerGuestJoinWall,
  } = useSaySeeStore();

  const [inviteCopied, setInviteCopied] = useState(false);
  const [trojanBragCopied, setTrojanBragCopied] = useState(false);
  const [editingBannerKeyword, setEditingBannerKeyword] = useState(false);
  const [keywordDraft, setKeywordDraft] = useState(alumniBannerTitle);

  const bannerTitle = alumniBannerTitle;
  const trojanBragCopy = `내가 동호회·동창회 마스터권 끊어서 패밀리 라운지 무료 이용권 3장 받았는데, 선착순으로 줄 테니 쓸 사람?`;

  const pendingProposals = analogYearProposals.filter((p) => !p.approvedByHost);

  const handleCopyInviteHook = async () => {
    const ok = await copyAuthenticatedRoomInviteFlow({
      loungeType: 'student',
      familyRoom: '우리집',
      defaultHostLabel: '동기회장',
      roomTitle: `🎓 ${bannerTitle}`,
      promptLabel: `『${bannerTitle}』 초대 링크를 복사해 공유하세요:`,
      formatCopyText: (studentInviteUrl) =>
        `[${bannerTitle}] 네가 몰랐던 ${alumniGradYear}년 수학여행·졸업식 사진이 올라왔어! 설치·로그인 없이 바로 구경하고 내 사진도 올려봐 (초대받은 동기는 평생 무료)\n👉 ${studentInviteUrl}`,
    });
    if (!ok) return;
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2600);
  };

  const handleCopyTrojanBrag = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(trojanBragCopy);
      }
    } catch {
      // ignore clipboard fallback
    }
    setTrojanBragCopied(true);
    setTimeout(() => setTrojanBragCopied(false), 2600);
  };

  const handleApplyBannerKeyword = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = keywordDraft.trim();
    if (!trimmed) return;
    const fullYearMatch = trimmed.match(/(19\d{2}|20\d{2})/);
    const shortYearMatch = !fullYearMatch ? trimmed.match(/(?:^|\s)(\d{2})년/) : null;
    const yearNum = fullYearMatch
      ? Number(fullYearMatch[1])
      : shortYearMatch
        ? Number(shortYearMatch[1]) >= 50
          ? 1900 + Number(shortYearMatch[1])
          : 2000 + Number(shortYearMatch[1])
        : alumniGradYear;
    const schoolPart =
      trimmed
        .replace(/(?:19\d{2}|20\d{2})년?|\d{2}년|\d+회|\d+기|\d+학번|동창회/g, '')
        .replace(/\s+/g, ' ')
        .trim() || trimmed;
    setAlumniBannerInfo(schoolPart, yearNum, undefined, trimmed);
    setEditingBannerKeyword(false);
  };

  const isChalkboard = alumniBannerTheme === 'chalkboard';
  const [showRetroCover, setShowRetroCover] = useState(false);

  return (
    <div className="flex flex-col gap-2.5">
      {/* 노션식 컴팩트 페이지 헤더 + [간판 펼치기] 토글 */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-headline-sm text-[18px] md:text-[20px] text-white font-extrabold tracking-tight">
            🎓 {bannerTitle}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-amber-400/15 border border-amber-300/30 text-amber-300 text-[11px] font-bold">
            🎉 인원·장수 제한 없이 평생 0원
          </span>
          <button
            type="button"
            onClick={() => setShowRetroCover((v) => !v)}
            className="px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-100 text-[12.5px] font-extrabold select-none shadow-sm cursor-pointer transition-all"
          >
            {showRetroCover ? '간판 접기 ▴' : '🏫 간판·초대장 열기 ▾'}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex p-0.5 rounded-xl bg-zinc-900 border border-white/10">
            <button
              type="button"
              onClick={() => setClubFeedTrack('memories_1989')}
              className={`px-3 py-1.5 rounded-lg font-label-sm text-[11.5px] font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                clubFeedTrack === 'memories_1989'
                  ? 'bg-primary-container text-zinc-950 shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              🎞️ {alumniGradYear} 추억
            </button>

            <button
              type="button"
              onClick={() => setClubFeedTrack('recent_now')}
              className={`px-3 py-1.5 rounded-lg font-label-sm text-[11.5px] font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                clubFeedTrack === 'recent_now'
                  ? 'bg-primary-container text-zinc-950 shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              🍻 최근 근황
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              if (isGuestPreviewMode) {
                triggerGuestJoinWall('🎯 내 얼굴이 나온 사진만 1초 만에 다 찾기');
                return;
              }
              void findMySchoolDaysPhotosFast();
              if (onNavigateToFeed) onNavigateToFeed();
            }}
            className="px-3 py-1.5 rounded-xl bg-primary-container/15 hover:bg-primary-container/25 border border-primary-container/40 text-primary-container font-label-sm text-[11.5px] font-extrabold cursor-pointer whitespace-nowrap"
          >
            🎯 내 학창시절 사진 찾기
          </button>

          {pendingProposals.length > 0 && (
            <button
              type="button"
              onClick={() => approveAllAnalogYearProposals()}
              className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-sm text-[11.5px] font-extrabold cursor-pointer whitespace-nowrap"
            >
              👑 연도 제보 승인 ({pendingProposals.length})
            </button>
          )}
        </div>
      </div>

      {/* 사용자가 [🏫 추억 간판·초대장 열기 ▾]를 눌렀을 때만 펼쳐지는 복고 간판 */}
      {showRetroCover && (
        <div
          data-keep-dark="true"
          className={`relative rounded-xl overflow-hidden border px-5 py-4 transition-all ${
            isChalkboard
              ? 'bg-gradient-to-r from-[#163325] via-[#1E4432] to-[#142B1F] border-[#6A9E82]/60 shadow-[inset_0_0_32px_rgba(0,0,0,0.45)]'
              : 'bg-gradient-to-r from-[#4A221D] via-[#7A3522] to-[#361D33] border-amber-300/50 shadow-[inset_0_0_32px_rgba(0,0,0,0.4)]'
          }`}
        >
          <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3.5">
            <div className="flex flex-wrap items-center gap-3 text-[12px] text-white/85">
              <button
                type="button"
                onClick={() =>
                  setAlumniBannerInfo(
                    alumniSchoolName,
                    alumniGradYear,
                    isChalkboard ? 'sunset_field' : 'chalkboard'
                  )
                }
                className="underline hover:text-white cursor-pointer font-bold whitespace-nowrap"
              >
                {isChalkboard ? '🌅 노을 운동장 배경으로 변경' : '🏫 복고풍 칠판 배경으로 변경'}
              </button>

              <span className="text-white/40">|</span>

              {editingBannerKeyword ? (
                <form onSubmit={handleApplyBannerKeyword} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={keywordDraft}
                    onChange={(e) => setKeywordDraft(e.target.value)}
                    placeholder="예: 썬드림 2026 / 성동고 1989"
                    className="px-2.5 py-1 rounded bg-black/60 border border-amber-300/70 text-white text-[12px] font-bold w-44 sm:w-52 focus:outline-none"
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
                    setKeywordDraft(alumniBannerTitle);
                    setEditingBannerKeyword(true);
                  }}
                  className="underline text-amber-200 hover:text-amber-100 cursor-pointer font-bold whitespace-nowrap"
                >
                  ✏️ 간판 이름·연도 변경
                </button>
              )}
            </div>

            <div className="flex flex-col items-start lg:items-center text-left lg:text-center gap-0.5 min-w-0">
              <h2 className="font-headline-md text-[19px] sm:text-[22px] md:text-[25px] text-white font-black tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] break-keep">
                {bannerTitle}
              </h2>
              <span className="text-[12px] text-amber-200/95 font-medium">
                🎉 인원·장수 제한 없이 전 회원 평생 0원 운영 중
              </span>
            </div>

            <button
              type="button"
              onClick={() => void handleCopyInviteHook()}
              className={`px-4 py-2 rounded-xl font-label-sm text-[12px] font-extrabold transition-all shadow-md shrink-0 whitespace-nowrap cursor-pointer ${
                inviteCopied
                  ? 'bg-emerald-400 text-zinc-950'
                  : 'bg-amber-300 hover:bg-amber-200 text-zinc-950'
              }`}
            >
              {inviteCopied ? '✓ 단톡방 초대장 복사됨!' : '💌 단톡방 초대 문구 복사'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
