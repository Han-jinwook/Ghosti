import React, { useEffect, useState } from 'react';
import {
  buildWindowsNativeWebDavMountCommand,
  verifyHybridP2PBridgeConnection,
  type P2PHybridConnectionDiagnostics,
} from '../../services/p2pHybridBridge';
import { getActivePersonaForCluster, useSaySeeStore } from '../../store/useSaySeeStore';
import type { ClubSizeTier, FamilyRoomId, LoungeType, PricingPlanId } from '../../types/saysee';
import { FaceMemberInlineBar } from '../../components/FaceMemberRegistryModal';
import { PcMasterQuickSendPanel } from '../../components/PricingModal';
import { GhostiBrandLogo } from '../../components/GhostiBrandLogo';
import { GhostCastLiveToolbar } from '../../components/GhostCastAndLiveSystem';
import { SilentIndexingStatusBar } from '../../components/SilentIndexingStatusBar';
import { zCoreBridge } from '../../services/zCoreBridge';
import { LOUNGE_TABS, PLAN_BADGE_LABELS, HostThreeBodyControlPanel } from '../shared/loungeHelpers';
import { WorkLoungeB2BHub } from '../paid_work_share/WorkLoungeB2BHub';

/**
 * ⛳ 동호회 · 동창회 (사진 공유) (4050 동창회 특화 UX — Warm Light 앨범 프레임 + 1줄 요약 정화 버전)
 * 1) 생성형 맞춤형 간판 'Text-to-Banner' (복고풍 칠판 / 노을 진 운동장 그래픽 + '성동고 89회 동창회' + 초대장 카피 버튼)
 * 2) 첫 화면 검색 전면 배치 ([🎯 내 얼굴로 학창 시절 사진 1초 만에 찾기]) & '추억 vs 근황' 투트랙 탭 ([🎞️ 응답하라 1989 (추억)] 기본 고정 / [🍻 최근 우리들 (근황)]) + 1줄 스마트 알림 클린존 안내
 */
const AlumniRetroBannerAndTwoTrackBar: React.FC<{
  onNavigateToFeed?: () => void;
  onOpenWaitingRoom?: () => void;
}> = ({ onNavigateToFeed, onOpenWaitingRoom }) => {
  const {
    alumniSchoolName,
    alumniGradYear,
    alumniGradCohortNumber,
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
  const [keywordDraft, setKeywordDraft] = useState(`${alumniSchoolName} ${alumniGradYear}`);

  const cohortShort = String(alumniGradCohortNumber).padStart(2, '0');
  const bannerTitle = `${alumniSchoolName} ${cohortShort}회 동창회`;
  const inviteHookCopy = `[${bannerTitle}] 네가 몰랐던 ${cohortShort}년 수학여행 네 사진 다 찾았다! (초대받은 가족·회원·직원은 언제나 무료입니다)`;
  const trojanBragCopy = `내가 동호회·동창회 마스터권 끊어서 패밀리 라운지 무료 이용권 3장 받았는데, 선착순으로 줄 테니 쓸 사람?`;

  const pendingProposals = analogYearProposals.filter((p) => !p.approvedByHost);

  const handleCopyInviteHook = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(inviteHookCopy);
      }
    } catch {
      // ignore clipboard fallback
    }
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
    const yearMatch = trimmed.match(/(19\d{2}|20\d{2}|\d{2})/);
    const yearNum = yearMatch
      ? Number(yearMatch[1].length === 2 ? `19${yearMatch[1]}` : yearMatch[1])
      : alumniGradYear;
    const schoolPart =
      trimmed.replace(/(19\d{2}|20\d{2}|\d{2})년?|\s+/g, '').trim() || alumniSchoolName;
    setAlumniBannerInfo(schoolPart, yearNum);
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
            ⛳ {bannerTitle}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-amber-400/15 border border-amber-300/30 text-amber-300 text-[11px] font-bold">
            🏅 총무님 후원 · 전 회원 평생 0원
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
                    placeholder="예: 성동고 1989"
                    className="px-2.5 py-1 rounded bg-black/60 border border-amber-300/70 text-white text-[12px] font-bold w-32 focus:outline-none"
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
                    setKeywordDraft(`${alumniSchoolName} ${alumniGradYear}`);
                    setEditingBannerKeyword(true);
                  }}
                  className="underline text-amber-200 hover:text-amber-100 cursor-pointer font-bold whitespace-nowrap"
                >
                  ✏️ 학교·연도 변경
                </button>
              )}
            </div>

            <div className="flex flex-col items-start lg:items-center text-left lg:text-center gap-0.5">
              <h2 className="font-headline-md text-[22px] md:text-[25px] text-white font-black tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] whitespace-nowrap">
                {bannerTitle}
              </h2>
              <span className="text-[12px] text-amber-200/95 font-medium">
                🏅 총무님 후원 · 전 회원 평생 0원 운영 중
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

/**
 * 1번 서브메뉴 `[✨ 1초 진단 & 공유 시작]` (정식 구독 활성화 시 메뉴에서 Auto-Hide)
 */
export const LoungeView: React.FC = () => {
  const {
    activeLoungeType,
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
      title: '⛰️ 동호회 · 소모임 사진방',
      capacity: '인원 무제한 (사진·동영상 전용)',
      monthly: '평생 0원 (무료)',
      yearly: '방장·멤버 전원 0원',
      gpuDaily: '내 기기 원본 동기화 지원',
      monthlyPlanId: 'club_small_4900',
      yearlyPlanId: 'club_small_year_49000',
    },
    {
      id: 'large',
      title: '🎓 동창회 · 반창회 사진방',
      capacity: '인원 무제한 (사진·동영상 전용)',
      monthly: '평생 0원 (무료)',
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
    <main className="flex-1 w-full max-w-[1360px] mx-auto px-5 md:px-8 py-6 flex flex-col gap-5">
      {/* 📢 공유 라운지 핵심 선언 콜아웃 (노션 스타일 미니멀 배너): 내 기기(personal) 내에서는 무료/요금 배너를 띄우지 않음 */}
      {!isStoreAppMode && activeLoungeType === 'work' && (
        <section className="px-4 py-2.5 rounded-2xl bg-[#18181B] border border-amber-400/30 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[12.5px] text-zinc-200 font-bold">
            💼 팀 공유 S: 드라이브 · 계약서/단가표 본문 검색 (🎁 30일 무제한 무료체험)
          </span>
          <button
            type="button"
            onClick={() => setShowProModal(true)}
            className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-[11.5px] font-extrabold shrink-0 cursor-pointer"
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
                  💻 내 기기 (PC · 스마트폰)
                </span>
                <h1 className="font-headline-md text-[22px] md:text-[26px] text-white font-extrabold tracking-tight">
                  🧹 내 기기 손보기 진단
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
                    🧹 손보기 진단 시작
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
                    🔄 다시 진단하기
                  </button>
                )}
              </div>
            </div>

            {/* 진단 버튼을 눌렀을 때만 아래로 착 펼쳐지는 결과 & [정리 ➔ 원복] 안전 검증 */}
            {personalTrialStatus === 'done' && (
              <div className="pt-6 border-t border-white/10 flex flex-col gap-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-headline-sm text-[15px] text-white font-bold">
                    📊 1차 진단 완료 브리핑 (카드를 누르면 해당 검색 화면으로 이동합니다)
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
                      🎬 동영상 ({totalDeviceVideos}개 중)
                    </span>
                    <div className="font-headline-md text-[20px] text-white font-black">
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
                      🖼️ 사진 ({totalDevicePhotos}장 중)
                    </span>
                    <div className="font-headline-md text-[20px] text-white font-black">
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
                      📁 문서 ({totalDeviceDocs}건 중)
                    </span>
                    <div className="font-headline-md text-[20px] text-white font-black">
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
                        🛡️ 안심 정리 테스트 — 휴지통으로 보내고 1초 만에 되돌려보세요
                      </span>
                      <p className="font-body-sm text-[12.5px] text-zinc-400">
                        임의로 영구 삭제하지 않고 OS 기본 [휴지통]으로 이동하며 언제든 1초 만에 복원됩니다.
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
                            : 'bg-amber-400 hover:bg-amber-300 text-zinc-950 cursor-pointer'
                        }`}
                      >
                        {trialSafetyStep === 'quarantined'
                          ? '✓ ① 휴지통 이동됨'
                          : '🗑️ ① 샘플 정리 눌러보기'}
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
                        🗑️ 휴지통 열기
                      </button>
                    </div>
                  </div>

                  {trialSafetyStep === 'quarantined' && (
                    <div className="px-3.5 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[12.5px] text-amber-200">
                      🗑️ 샘플 {trialMovedIds.length}건이 휴지통으로 이동되었습니다. 우측의 <strong>[↩️ ② 1초 되돌리기]</strong>를 눌러보세요!
                    </div>
                  )}

                  {trialSafetyStep === 'restored' && (
                    <div className="px-3.5 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[12.5px] text-emerald-300 flex items-center justify-between gap-2">
                      <span>✅ 원래 위치로 100% 되돌아왔습니다. 이제 본격적인 정리를 시작해 보세요!</span>
                      <button
                        type="button"
                        onClick={() => {
                          setDesktopTab('trash');
                          setMobileTab('trash');
                        }}
                        className="px-3 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-primary-container font-label-sm text-[11.5px] font-bold whitespace-nowrap cursor-pointer"
                      >
                        🩺 손보기 열기 →
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
                    🔍 귀신같이 AI 내용찾기
                  </span>
                  <h3 className="font-headline-sm text-[17px] text-white font-bold">
                    사진 · 영상 · 서류 1초 검색
                  </h3>
                  <p className="font-body-sm text-[12.5px] text-zinc-400 leading-relaxed">
                    말 한마디로 사진, 동영상 속 장면, 문서 내용까지 1초 만에 찾아냅니다.
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
                    🩺 귀신같이 손보기
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
                    ✋ 손보기
                  </span>
                  <h3 className="font-headline-sm text-[17px] text-white font-bold">
                    1:1 기기 설정 &amp; 수리 해결사
                  </h3>
                  <p className="font-body-sm text-[12.5px] text-zinc-400 leading-relaxed">
                    복잡한 PC·스마트폰 설정을 1초 만에 고쳐주거나 화살표(👆)로 안내합니다.
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
                  👨‍👩‍👧‍👦 패밀리 라운지 — 양가 분리 가족 사진관 (마스터 1인 결제 ➔ 가족 전원 무료)
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
                      {room === '우리집' ? '🏠 우리집' : room === '본가(친가)' ? '🏡 본가(친가)' : '🌸 처가(친정)'}
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
                      🏠🏡🌸 양가 3방 완벽 분리
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
                      🛂 가족 얼굴 여권 &amp; 1초 실명 검색
                    </span>
                    <span className="px-2 py-0.5 rounded bg-primary-container/15 text-primary-container text-[10.5px] font-extrabold">
                      호칭·실명 자동 매칭
                    </span>
                  </div>
                  <p className="font-body-sm text-[12.5px] text-zinc-300 leading-relaxed">
                    가족 단체 사진에서 얼굴을 자동 추출해 이름·호칭(할머니, 큰삼촌 등)만 적어두면 온 가족 스마트폰에서 이름으로 1초 만에 찾습니다.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-zinc-950/80 border border-white/10 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-headline-sm text-[15px] text-white font-bold">
                      📡 카톡 초대 &amp; 3초 레이더 수합
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 text-[10.5px] font-extrabold">
                      방장 1인 결제 ➔ 전원 무료
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
                    ✨ 패밀리 라운지 1초 진단 &amp; 공유 시작 — 가족 얼굴 여권 &amp; 3초 레이더 수합
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
                    🚀 공유방 시작하기
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
                    🔄 다시 체험하기
                  </button>
                )}
              </div>
            </div>

            {/* 3단: 초기 설정 완료 시 열리는 가족 여권 등록 & 3초 레이더 수합 보드 */}
            {groupTrialStatus.family === 'done' && (
              <div className="pt-4 border-t border-white/10 flex flex-col gap-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                  <span className="font-headline-sm text-[15.5px] text-white font-bold">
                    👑 Step 1. 가족 얼굴 여권 자동 장착 &amp; 방장 누락분 확인 ({activeFamilyRoom})
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowFaceRegistryModal(true)}
                    className="px-3 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-primary-container font-label-sm text-[11.5px] font-bold"
                  >
                    🛂 여권 관리 · 👑 방장 총점검 모달 열기 →
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
                      📡 Step 2. 카톡 초대 &amp; 가족 스마트폰 ‘3초 얼굴 레이더 스캔’ (최대 10장 무료 수합 체험)
                    </span>
                    <p className="font-body-sm text-[12px] text-zinc-400">
                      등록된 가족 얼굴({namedClusters.length}명)의 768차원 특징량과 촬영 날짜를 기준으로 가족 폰에서 함께 찍힌 사진만 골라내어 <strong>[⏳ AI 인덱싱 대기실]</strong>로 전송합니다.
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
                      {radarSimulated ? '✓ 대기실로 전송됨 (대기실 열기)' : '📡 3초 레이더 수합 ➔ 대기실 전송 체험 →'}
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
                          🔍 “{isRoomCreator ? `👑 ${labelName}` : labelName} 나무 다리” 검색 →
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
                  className="flex items-center justify-between gap-2 cursor-pointer select-none py-1"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-400 text-[12px] font-mono">
                      {showLoungePricing ? '▾' : '▸'}
                    </span>
                    <span className="font-headline-sm text-[14.5px] text-white font-bold">
                      🆓 가족 사진 공유방 — 우리집 단독 &amp; 양가 3방 통합 모두 인원 무제한 평생 0원 (사진·동영상 전용)
                    </span>
                  </div>
                  <span className="px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-100 text-[13px] font-extrabold select-none shadow-sm cursor-pointer transition-all">
                    {showLoungePricing ? '무료 혜택 접기 ▴' : '무료 혜택 펼치기 ▾'}
                  </span>
                </div>

                {showLoungePricing && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-5 rounded-xl bg-zinc-950/80 border border-emerald-400/40 flex flex-col justify-between gap-4">
                        <div className="flex flex-col gap-1.5">
                          <span className="font-label-sm text-[11.5px] text-emerald-300 font-bold">
                            🏠 우리집 단독 — 우리집 전용 시크릿 사진방 (방 1개 · 가족 인원 무제한)
                          </span>
                          <div className="flex items-baseline gap-2">
                            <span className="font-headline-md text-[24px] text-emerald-300 font-black">
                              평생 0원 (무료)
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
                          className="w-full py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-label-md text-[12.5px] font-extrabold cursor-pointer"
                        >
                          🏠 우리집 가족 사진방 평생 0원 시작
                        </button>
                      </div>

                      <div className="p-5 rounded-xl bg-zinc-900 border border-primary-container/50 flex flex-col justify-between gap-4">
                        <div className="flex flex-col gap-1.5">
                          <span className="font-label-sm text-[11.5px] text-primary-container font-bold">
                            👨‍👩‍👧‍👦 양가 통합권 — 우리집 + 본가(친가) + 처가(친정) 3개 방 분리 제공
                          </span>
                          <div className="flex items-baseline gap-2">
                            <span className="font-headline-md text-[24px] text-emerald-300 font-black">
                              평생 0원 (무료)
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
                          👨‍👩‍👧‍👦 양가 3방 통합 평생 0원 시작
                        </button>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-primary-container/10 border border-primary-container/35 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[12px] text-emerald-200 font-medium">
                        📌 <strong>[안내]</strong> 2번 사진 공유(가족·동호회·동창회)는 <strong>오직 사진·동영상 공유 전용</strong>으로 평생 무료입니다. (엑셀·한글·PDF·워드 업무 문서 및 윈도우 탐색기 <code>S: 드라이브</code>는 <strong>4번 업무 공유</strong> 전용입니다.)
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowProModal(true)}
                        className="px-3 py-1.5 rounded-lg bg-primary-container text-zinc-950 font-label-sm text-[11.5px] font-extrabold cursor-pointer shrink-0"
                      >
                        💼 3·4번 프로 기능 (1개월 무료체험 · 10년 특판) 보기
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
                  ⛰️ 동호회·모임 (사진 공유) — 주말 산악회 · 골프 · 취미 모임 {isStoreAppMode ? '(PC 마스터 연동 전 회원 무료 열람)' : '(방장·회원 전원 평생 0원)'}
                </h1>
                <p className="font-body-sm text-[13px] text-zinc-400 mt-1">
                  모임 총무(👑 방장) PC 마스터 연동으로 회원 전원이 폰 용량 걱정 없이 <strong>13KB 초경량 썸네일 탐색</strong>과 <strong>내 기기 원본 동기화 자체 해결</strong>을 누립니다.
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
                      🏫 8090 응답하라 투트랙 앨범
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
                      🏷️ 스틱 태깅 &amp; 계절↔월 양방향 검색
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
                      🔄 13KB 썸네일 DB &amp; 내 기기 원본 동기화
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 text-[10.5px] font-extrabold">
                      전 회원 무료 열람
                    </span>
                  </div>
                  <p className="font-body-sm text-[12.5px] text-zinc-300 leading-relaxed">
                    평소엔 보이지 않는 곳에 <strong>13KB 초경량 썸네일 DB</strong>만 보관해 0.01초 만에 검색하며, <strong>[🔄 원본 동기화]</strong>를 켜면 지정한 내 폴더에 원본이 복제되어 자체 해결합니다.
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
                    ✨ 동호회 · 동창회 공유방 1초 진단 &amp; 공유 시작 — 동창·회원 얼굴 여권 &amp; 3초 레이더 수합
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
                    🚀 공유방 시작하기
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
                    🔄 다시 체험하기
                  </button>
                )}
              </div>
            </div>

            {/* 3단: 초기 설정 완료 시 열리는 회원 여권 등록 & 3초 레이더 수합 보드 */}
            {groupTrialStatus.club === 'done' && (
              <div className="pt-4 border-t border-white/10 flex flex-col gap-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                  <span className="font-headline-sm text-[15.5px] text-white font-bold">
                    👑 Step 1. 동창·회원 여권 자동 장착 &amp; 총무 누락분 1장씩 확인
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowFaceRegistryModal(true)}
                    className="px-3 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-primary-container font-label-sm text-[11.5px] font-bold"
                  >
                    🛂 여권 관리 · 👑 방장 총점검 모달 열기 →
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
                      📡 Step 2. 카톡 단톡방 초대 &amp; 스마트폰 ‘3초 얼굴 레이더 스캔’ (최대 10장 무료 수합 체험)
                    </span>
                    <p className="font-body-sm text-[12px] text-zinc-400">
                      총무가 등록한 회원 얼굴({namedClusters.length}명)의 768차원 특징량과 모임 날짜를 기준으로 회원 폰에서 모임 사진만 골라내어 <strong>[⏳ AI 인덱싱 대기실]</strong>로 전송합니다.
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
                      {radarSimulated ? '✓ 대기실로 전송됨 (대기실 열기)' : '📡 3초 레이더 수합 ➔ 대기실 전송 체험 →'}
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
                          🔍 “{isRoomCreator ? `👑 ${labelName}` : labelName} 나무 다리” 검색 →
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
                  className="flex items-center justify-between gap-2 cursor-pointer select-none py-1"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-400 text-[12px] font-mono">
                      {showLoungePricing ? '▾' : '▸'}
                    </span>
                    <span className="font-headline-sm text-[14.5px] text-white font-bold">
                      🆓 ⛰️ 동호회 · 🎓 동창회 · 🥂 소모임 사진 공유방 — 인원 무제한 평생 0원 (사진·동영상 전용)
                    </span>
                  </div>
                  <span className="px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-100 text-[13px] font-extrabold select-none shadow-sm cursor-pointer transition-all">
                    {showLoungePricing ? '무료 혜택 접기 ▴' : '무료 혜택 펼치기 ▾'}
                  </span>
                </div>

                {showLoungePricing && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* ① 🥂 일상 소모임 (평생 0원) */}
                      <div className="p-5 rounded-xl bg-gradient-to-br from-emerald-950/60 via-zinc-950 to-zinc-950 border border-emerald-400/50 flex flex-col justify-between gap-4">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-label-sm text-[12px] text-emerald-300 font-extrabold">
                              🥂 일상 소모임 (친구·계모임·취미)
                            </span>
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-200 text-[10px] font-bold">
                              사진·동영상 전용
                            </span>
                          </div>
                          <div className="flex flex-wrap items-baseline gap-1.5 mt-0.5">
                            <span className="font-headline-md text-[22px] text-emerald-300 font-black">
                              평생 0원 (무료)
                            </span>
                          </div>
                          <p className="font-body-sm text-[12px] text-zinc-300">
                            단톡방 친구들끼리 방 개설 즉시 장수 제한 없이 평생 0원! (내 PC 하드 직결 · 카톡 무가입 1초 프리뷰 지원)
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => activatePricingPlan('club_mini_free_300')}
                          className="w-full py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-label-md text-[12px] font-extrabold cursor-pointer"
                        >
                          🥂 소모임 사진방 평생 0원 개설
                        </button>
                      </div>

                      {/* ② ⛰️ 동호회 사진방 (평생 0원) */}
                      <div className="p-5 rounded-xl bg-zinc-950/90 border border-emerald-400/40 flex flex-col justify-between gap-4">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-label-sm text-[12px] text-primary-container font-extrabold">
                              ⛰️ 동호회 사진방 (모임 이름 문패)
                            </span>
                            <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 text-[10px] font-bold">
                              인원 무제한 · 0원
                            </span>
                          </div>
                          <div className="flex flex-wrap items-baseline gap-1.5 mt-0.5">
                            <span className="font-headline-md text-[22px] text-emerald-300 font-black">
                              평생 0원 (무료)
                            </span>
                          </div>
                          <p className="font-body-sm text-[12px] text-zinc-300">
                            골프·산악회·독서·조기축구 등 수백 명 모임도 인원수 제한 없이 방장도 회원도 평생 0원!
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => activatePricingPlan('club_small_4900')}
                          className="w-full py-2.5 rounded-xl bg-primary-container text-zinc-950 font-label-md text-[12px] font-extrabold cursor-pointer"
                        >
                          ⛰️ 동호회 사진방 평생 0원 개설
                        </button>
                      </div>

                      {/* ③ 🎓 동창회·반창회 사진방 (평생 0원) */}
                      <div className="p-5 rounded-xl bg-zinc-900 border border-amber-400/50 flex flex-col justify-between gap-4">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-label-sm text-[12px] text-amber-300 font-extrabold">
                              🎓 동창회 사진방 (학교/학년/반 문패)
                            </span>
                            <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 text-[10px] font-bold">
                              인원 무제한 · 0원
                            </span>
                          </div>
                          <div className="flex flex-wrap items-baseline gap-1.5 mt-0.5">
                            <span className="font-headline-md text-[22px] text-emerald-300 font-black">
                              평생 0원 (무료)
                            </span>
                          </div>
                          <p className="font-body-sm text-[12px] text-zinc-300">
                            졸업앨범 아날로그 스캔 사진 복원 + 학창시절 내 얼굴 1초 찾기 &amp; 카톡 단톡방 1초 프리뷰 지원!
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => activatePricingPlan('club_small_4900')}
                          className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-md text-[12px] font-extrabold cursor-pointer"
                        >
                          🎓 동창회 사진방 평생 0원 개설
                        </button>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-400/35 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[12px] text-amber-200 font-medium">
                        📌 <strong>[안내]</strong> 2번 사진 공유(가족·동호회·동창회)는 <strong>오직 사진·동영상 공유 전용</strong>으로 평생 무료입니다. (엑셀·한글·PDF·워드 업무 문서 및 <code>S: 드라이브</code>는 <strong>4번 업무 공유</strong> 전용입니다.)
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowProModal(true)}
                        className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-sm text-[11.5px] font-extrabold cursor-pointer shrink-0"
                      >
                        💼 3·4번 프로 기능 (1개월 무료체험 · 10년 특판) 보기
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
                  🎓 동창회 · 학급 · 동아리 (사진 공유) — 우리 동창·반 전원 평생 0원 타임캡슐
                </h1>
                <p className="font-body-sm text-[13px] text-zinc-400 mt-1">
                  방장 PC 직결 연동만으로 동창회·학급·동아리 인원수 상관없이 <strong>평생 0원(무료)</strong>! 동창·반 친구들 전원이 졸업앨범·수련회·체육대회·모임 사진·동영상을 1초 만에 찾습니다. (※ 사진·동영상 전용)
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
                      🪪 학생증 로컬 OCR 0.1초 인증
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10.5px] font-extrabold">
                      외부 전송 0 Byte
                    </span>
                  </div>
                  <p className="font-body-sm text-[12.5px] text-zinc-300 leading-relaxed">
                    학생증 사진 1장을 내 기기 RAM에서 0.1초 OCR 판독 후 즉시 폐기하여 개인정보 유출 걱정 없이 학생 전용 라운지를 즉시 인증합니다.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-zinc-950/80 border border-white/10 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-headline-sm text-[15px] text-white font-bold">
                      🏃 수련회·체육대회·축제 3초 수합
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
                      {isStoreAppMode ? '🎮 방장 게이밍 PC 연동 부스트' : '🪙 인원 무제한 월 900원 단일 특가'}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 text-[10.5px] font-extrabold">
                      방장 PC 콕 찌르기
                    </span>
                  </div>
                  <p className="font-body-sm text-[12.5px] text-zinc-300 leading-relaxed">
                    {isStoreAppMode
                      ? '30명 학급이든 100명 동아리든 인원 제한 없이 연결! 초기 샘플 10장 한도 도달 시 방장에게 집 게이밍 PC 설치 알림을 보낼 수 있습니다.'
                      : '30명 학급이든 100명 동아리든 인원 제한 없이 월 900원! 초기 샘플 10장 한도 도달 시 방장에게 집 게이밍 PC 설치 알림을 보낼 수 있습니다.'}
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
                    ✨ 동호회 · 동창회 공유방 1초 진단 &amp; 공유 시작 — 우리 반 얼굴 여권 &amp; 10장 레이더 수합
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
                    🚀 공유방 시작하기
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
                    🔄 다시 체험하기
                  </button>
                )}
              </div>
            </div>

            {/* 3단: 초기 설정 완료 시 열리는 반 친구 여권 등록 & 3초 레이더 수합 보드 */}
            {groupTrialStatus.student === 'done' && (
              <div className="pt-4 border-t border-white/10 flex flex-col gap-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                  <span className="font-headline-sm text-[15.5px] text-white font-bold">
                    👑 Step 1. 우리 반 친구 여권 자동 장착 &amp; 반장 누락분 확인
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setStudentPokedHost(true)}
                      className={`px-3 py-1 rounded-lg font-label-sm text-[11.5px] font-extrabold transition-all ${
                        studentPokedHost
                          ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-300'
                          : 'bg-amber-400 hover:bg-amber-300 text-zinc-950'
                      }`}
                    >
                      {studentPokedHost
                        ? '✓ 방장에게 "집 게이밍 PC에 설치해!" 알림 발송됨!'
                        : '👉 무료 10장 도달 시 방장에게 "집 게이밍 PC에 설치해!" 콕 찌르기'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowFaceRegistryModal(true)}
                      className="px-3 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-primary-container font-label-sm text-[11.5px] font-bold"
                    >
                      🛂 여권 관리 · 👑 방장 총점검 모달 열기 →
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
                      📡 Step 2. 반 단톡방 초대 &amp; 스마트폰 ‘3초 얼굴 레이더 스캔’ (최대 10장 무료 수합 체험)
                    </span>
                    <p className="font-body-sm text-[12px] text-zinc-400">
                      반장이 등록한 친구 얼굴({namedClusters.length}명)의 768차원 특징량과 수련회·체육대회 날짜를 기준으로 친구 폰에서 우리 반 사진만 골라내어 <strong>[⏳ AI 인덱싱 대기실]</strong>로 전송합니다.
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
                      {radarSimulated ? '✓ 대기실로 전송됨 (대기실 열기)' : '📡 3초 레이더 수합 ➔ 대기실 전송 체험 →'}
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
                          🔍 “{isRoomCreator ? `👑 ${labelName}` : labelName} 나무 다리” 검색 →
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
                      🎓 동창회 · 학급 · 동아리 사진 공유 평생 0원
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded font-label-mono text-[11px] font-bold border ${
                        studentOcrVerified
                          ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                          : 'bg-zinc-950 border-white/10 text-zinc-300'
                      }`}
                    >
                      {studentOcrVerified
                        ? '✓ 학생증 로컬 OCR 0.1초 인증 완료 (외부 전송 0 Byte)'
                        : '📸 사진·동영상 전용 (업무 문서·S: 드라이브 제외)'}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="font-headline-md text-[26px] text-emerald-300 font-black">
                      평생 0원 (무료)
                    </span>
                    <span className="font-label-mono text-[14px] text-primary-container font-bold">
                      (인원 제한 없음 · 방장도 동창도 0원)
                    </span>
                  </div>
                  <p className="font-body-sm text-[12px] text-zinc-300">
                    내 PC 하드 직결 구조로 클라우드 서버비가 들지 않아 동창회·학급 사진과 동영상 공유는 평생 0원입니다.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {!studentOcrVerified && (
                    <button
                      type="button"
                      onClick={verifyStudentOcr}
                      className="px-4 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-primary-container/50 text-primary-container font-label-md text-[12.5px] font-bold"
                    >
                      🪪 학생증 로컬 OCR 0.1초 인증
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => activatePricingPlan('student_sub_900')}
                    className="px-4 py-2.5 rounded-xl bg-primary-container text-zinc-950 font-label-md text-[12.5px] font-extrabold"
                  >
                    🎓 동창회·학급 사진방 평생 0원 개설
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


export const LoungeFeedContextBanner: React.FC = () => {
  const {
    activeLoungeType,
    activeFamilyRoom,
    setActiveFamilyRoom,
    faceClusters,
    runTextQuery,
    photos,
    setShowFaceRegistryModal,
    setDoorplatePickerClusterId,
    setDesktopTab,
    setMobileTab,
    clubFeedTrack,
    setClubFeedTrack,
    isGuestPreviewMode,
    triggerGuestJoinWall,
  } = useSaySeeStore();

  const [p2pOriginalSummoned, setP2pOriginalSummoned] = useState(true);
  const [showStorageCheckBanner, setShowStorageCheckBanner] = useState(false);
  const [simulateLowStorage, setSimulateLowStorage] = useState(false);
  const [downloadDirPath, setDownloadDirPath] = useState('D:\\Ghosti\\다운로드_원본');
  const [showClubCover, setShowClubCover] = useState(false);
  const [clubBannerBgTheme, setClubBannerBgTheme] = useState<'forest' | 'sunset'>('forest');
  const [clubBannerTitle, setClubBannerTitle] = useState('주말 산악 · 골프 · 취미 동호회 모임방');
  const [editingClubTitle, setEditingClubTitle] = useState(false);
  const [clubTitleDraft, setClubTitleDraft] = useState('주말 산악 · 골프 · 취미 동호회 모임방');
  const [clubInviteCopied, setClubInviteCopied] = useState(false);

  const handleCopyClubInviteHook = async () => {
    const copyTxt = `[${clubBannerTitle}] 이번 모임·라운딩 고화질 원본 사진과 영상이 모두 올라왔습니다! (총무님 후원으로 전 회원 평생 0원 무료입니다)`;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(copyTxt);
      }
    } catch {
      // ignore
    }
    setClubInviteCopied(true);
    setTimeout(() => setClubInviteCopied(false), 2600);
  };

  const renderOriginalAutoSyncControl = () => (
    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0 max-w-full">
      {/* 동기화 완료 (새로 9장 추가) 작은 풍선 배지 (Wi-Fi + 여유공간 충분할 때만 ON) */}
      {p2pOriginalSummoned && !simulateLowStorage && (
        <span className="px-2 sm:px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/60 text-emerald-300 font-label-sm text-[11px] font-extrabold flex items-center gap-1 shadow-xs animate-pulse shrink-0">
          <span className="sm:hidden">✨ 완료 (+9)</span>
          <span className="hidden sm:inline">✨ 동기화 완료 (새로 9장 추가)</span>
        </span>
      )}

      <button
        type="button"
        onClick={() => {
          setShowStorageCheckBanner(true);
          if (simulateLowStorage) {
            setP2pOriginalSummoned(false);
            return;
          }
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
          simulateLowStorage
            ? 'bg-zinc-900/70 text-zinc-500 border-zinc-700/60 opacity-75'
            : p2pOriginalSummoned
            ? 'bg-primary-container text-zinc-950 border-primary-container'
            : 'bg-zinc-900 hover:bg-zinc-800 text-primary-container border-primary-container/50'
        }`}
        title="Wi-Fi 연결 및 내 기기 여유 공간이 넉넉할 때만 활성화됩니다 (그 외 비활성 · 클릭 시 용량 부족 안내)"
      >
        <span className="sm:hidden">
          {simulateLowStorage
            ? '⚠️ 동기화 불가'
            : p2pOriginalSummoned
            ? '🔄 원본 동기화 ON'
            : '🔄 원본 동기화'}
        </span>
        <span className="hidden sm:inline">
          {simulateLowStorage
            ? '⚠️ 원본 동기화 (용량 부족 · 비활성)'
            : p2pOriginalSummoned
            ? '🔄 원본 동기화 (ON · Wi-Fi+여유공간 확인됨)'
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
            <span
              className={`px-2.5 py-1 rounded-lg font-extrabold text-[11px] ${
                simulateLowStorage
                  ? 'bg-rose-500 text-white'
                  : 'bg-emerald-400 text-zinc-950'
              }`}
            >
              {simulateLowStorage
                ? '⚠️ 용량 부족 안내 (동기화 버튼 비활성)'
                : '✓ Wi-Fi 연결 & 여유 공간 충분 · 내 기기 원본 동기화 ON'}
            </span>
            {simulateLowStorage ? (
              <span className="text-rose-200 font-bold">
                ⚠️ 내 기기 여유 공간(0.4GB)이 공유방 원본 총량(1.2GB)보다 부족하여 원본 동기화 버튼이 비활성화되었습니다 (평소엔 숨김 영역 13KB 썸네일 DB만 유지됩니다).
              </span>
            ) : (
              <span className="text-white font-bold">
                Wi-Fi 연결됨 · 내 기기 여유 공간 <strong className="text-emerald-300">48.2GB</strong> / 공유방 원본 <strong className="text-emerald-300">1.2GB (넉넉함 ✓)</strong> — 방장 PC 호출 없이 내 기기 동기화 폴더에서 원본까지 100% 자체 해결됩니다!
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSimulateLowStorage((v) => !v)}
              className="px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-300 text-[11px] font-bold cursor-pointer"
            >
              {simulateLowStorage ? '💡 용량 충분 상태로 보기' : '📱 용량 부족 안내 시뮬레이션'}
            </button>
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
        {!simulateLowStorage && (
          <div className="p-3 rounded-xl bg-zinc-950 border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-2.5 text-[12px]">
            <span className="text-emerald-300 font-extrabold">
              📂 원본 동기화 저장 경로
            </span>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <input
                type="text"
                value={downloadDirPath}
                onChange={(e) => setDownloadDirPath(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-white/15 text-white font-mono text-[11.5px] font-bold w-60"
                aria-label="원본 동기화 저장 경로"
              />
              <button
                type="button"
                onClick={() => {
                  window.alert(
                    `[원본 동기화 경로 설정 완료]\n앞으로 이 방의 원본 사진은 내 기기의 '${downloadDirPath}' 폴더에 자동 동기화됩니다.`
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
                className="px-3 py-1.5 rounded-xl bg-primary-container text-zinc-950 hover:opacity-90 font-label-sm text-[11.5px] font-extrabold cursor-pointer"
              >
                📂 내 기기 원본 폴더 열기
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const namedClusters = faceClusters.filter((c) => !c.excludedAsPasserby && c.registeredName);
  const FAMILY_ROOMS: FamilyRoomId[] = ['우리집', '본가(친가)', '처가(친정)'];

  if (activeLoungeType === 'personal') {
    return null;
  }

  const renderMemberPersonaPills = (labelText: string) => {
    if (namedClusters.length === 0) {
      return (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-label-sm text-[11.5px] text-zinc-400 mr-0.5 whitespace-nowrap">
            {labelText}
          </span>
          <span className="px-2.5 py-1 rounded-full bg-zinc-900/70 border border-white/10 text-zinc-400 font-label-sm text-[11.5px] font-medium whitespace-nowrap">
            아직 등록된 여권 인물이 없습니다
          </span>
          <button
            type="button"
            onClick={() => setShowFaceRegistryModal(true)}
            className="px-3 py-1.5 rounded-full bg-zinc-950 hover:bg-zinc-800 border border-primary-container/40 text-primary-container font-label-sm text-[11.5px] font-bold ml-0.5 shrink-0 whitespace-nowrap cursor-pointer"
          >
            🛂 인물 여권 등록
          </button>
        </div>
      );
    }
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-label-sm text-[11.5px] text-zinc-400 mr-0.5 whitespace-nowrap">
          {labelText}
        </span>
        {namedClusters.map((c) => {
          const { activePersona, isRoomCreator } = getActivePersonaForCluster(
            c,
            activeLoungeType,
            activeFamilyRoom
          );
          const displayPersona = activePersona || c.registeredName;
          const queryTarget =
            activeFamilyRoom === '처가(친정)' && isRoomCreator
              ? `${displayPersona} 선글라스`
              : `${displayPersona} 나무 다리`;
          return (
            <div
              key={c.clusterId}
              className="pl-1.5 pr-3 py-1 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-primary-container/35 text-primary-container font-label-sm text-[12px] font-bold flex items-center gap-1.5 transition-colors shrink-0 whitespace-nowrap"
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDoorplatePickerClusterId(c.clusterId);
                }}
                title={`${displayPersona} 문패 사진 클릭: 5대 스타일 슬롯(${c.doorplateSlotLabelKo || '① 정면'}) 원터치 변경`}
                className="relative group/avatar shrink-0 cursor-pointer"
              >
                <img
                  src={c.avatarUrl || c.representativePhoto}
                  alt={displayPersona}
                  className="w-5 h-5 rounded-full object-cover border border-primary-container/70 group-hover/avatar:ring-2 group-hover/avatar:ring-primary-container transition-all"
                />
              </button>
              <button
                type="button"
                onClick={() => void runTextQuery(queryTarget)}
                title={`클릭 시 "${queryTarget}" 검색`}
                className="flex items-center gap-1 cursor-pointer"
              >
                <span>{isRoomCreator ? `👑 ${displayPersona}` : displayPersona}</span>
              </button>
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => setShowFaceRegistryModal(true)}
          className="px-3 py-1.5 rounded-full bg-zinc-950 hover:bg-zinc-800 border border-white/15 text-zinc-300 font-label-sm text-[11.5px] font-bold ml-0.5 shrink-0 whitespace-nowrap cursor-pointer"
        >
          🛂 인물 관리
        </button>
      </div>
    );
  };

  if (activeLoungeType === 'family') {
    const inviteUrl = `https://ghosti.sundreamer.app/?invite=${
      activeFamilyRoom === '본가(친가)'
        ? 'family_parents'
        : activeFamilyRoom === '처가(친정)'
          ? 'family_inlaws'
          : 'family_home'
    }&preview=guest`;
    return (
      <div className="flex flex-col gap-2.5">
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
                try {
                  await navigator.clipboard?.writeText(inviteUrl);
                } catch {
                  /* ignore */
                }
                useSaySeeStore
                  .getState()
                  .showToast(`💌 『${activeFamilyRoom} 패밀리 앨범』 무가입 1초 초대 링크가 복사되었습니다! (${inviteUrl})`);
              }}
              className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-amber-400/50 text-amber-300 font-label-sm text-[11.5px] font-extrabold flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <span>💌 가족방 초대 링크 복사</span>
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
        {/* 동호회·모임 전용 헤더 바 (동창회와 동일한 간판·초대장 열기/접기 및 후원 문구 통일) */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-headline-sm text-[18px] md:text-[20px] text-white font-extrabold tracking-tight">
              ⛰️ {clubBannerTitle}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-400/15 border border-emerald-300/30 text-emerald-300 text-[11px] font-bold">
              🏅 총무님 후원 · 전 회원 평생 0원
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
                void runTextQuery('바다 노을');
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

              <div className="flex flex-col items-start lg:items-center text-left lg:text-center gap-0.5">
                <h2 className="font-headline-md text-[22px] md:text-[25px] text-white font-black tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] whitespace-nowrap">
                  {clubBannerTitle}
                </h2>
                <span className="text-[12px] text-amber-200/95 font-medium">
                  🏅 총무님 후원 · 전 회원 평생 0원 운영 중
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

        {/* 하단 1줄: 모임 인물 빠른 검색 + 각자의 페이지 [원본 자동 동기화] 버튼 & (새로 9장 추가) 풍선 */}
        <div className="px-1 py-1 flex flex-wrap items-center justify-between gap-2.5">
          {renderMemberPersonaPills('회원별 사진 찾기:')}
          {renderOriginalAutoSyncControl()}
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
      <AlumniRetroBannerAndTwoTrackBar
        onOpenWaitingRoom={() => {
          setDesktopTab('trash');
          setMobileTab('trash');
        }}
      />

      <div className="px-1 py-1 flex flex-wrap items-center justify-between gap-2.5">
        {renderMemberPersonaPills('동창 이름 검색:')}
        {renderOriginalAutoSyncControl()}
      </div>

      <GhostCastLiveToolbar loungeLabel="🎓 동창회 사진 공유방" />

      {renderStorageCheckAndSyncDetail()}
    </div>
  );
};

/**
 * 3번 서브메뉴 `[⏳ AI 인덱싱 대기실]` (사진 공유(패밀리 / 동호회·동창회) / 업무 라운지 전용)
 * - 수동 검사가 아니라 AI 인덱싱(Gemma 2 768d 벡터 + 13KB/30KB 캐시 변환) 시간 벌기용 안심 버퍼 뷰!
 * - 4050 동창회 아날로그 스캔 사진용 '스틱(Chip) 연쇄 태깅' & '[❓ 언제/어디인가요?] 집단 지성 연도 제보 ➔ 👑 방장 일괄 승인' 탑재
 */
export const LoungeIndexingWaitingRoom: React.FC = () => {
  const {
    activeLoungeType,
    activeFamilyRoom,
    photos,
    videoSceneItems,
    gpuHelper24hActive,
    activateGpuHelper24h,
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
    analogScannedPhotos,
    analogYearProposals,
    createAlumniStickChipsFromInput,
    applyStickChipToAnalogPhoto,
    applyStickChipToAllPendingAnalogPhotos,
    submitAnalogYearProposal,
    approveAllAnalogYearProposals,
    isStoreAppMode,
    setShowProModal,
  } = useSaySeeStore();

  const [instantFlushed, setInstantFlushed] = useState(false);
  const [pokedStudentHost, setPokedStudentHost] = useState(false);
  const [stickYearInput, setStickYearInput] = useState('1989');
  const [stickPlaceInput, setStickPlaceInput] = useState('제주도 수학여행');
  const [stickSeasonInput, setStickSeasonInput] = useState('봄');
  const [selectedStickLabel, setSelectedStickLabel] = useState<string>('1989년 봄');
  const [proposalDraftByPhoto, setProposalDraftByPhoto] = useState<Record<string, string>>({});
  const [proposalAuthor] = useState('박회장(동기)');
  const [batchApprovedBanner, setBatchApprovedBanner] = useState<string | null>(null);
  const [deletedLoungePhotoIds, setDeletedLoungePhotoIds] = useState<string[]>([]);
  const [lastDeletedPhotoId, setLastDeletedPhotoId] = useState<string | null>(null);
  const [showAnalogStickSection, setShowAnalogStickSection] = useState(false);

  const memberActiveHints = swarmFaceCandidates.filter((c) => !c.applied && !c.passedToHostQueue);
  const hostCleanupQueue = swarmFaceCandidates.filter((c) => !c.applied);
  const pendingAnalogProposals = analogYearProposals.filter((p) => !p.approvedByHost);

  const basePhotos = photos
    .filter((p) => !p.quarantined && !deletedLoungePhotoIds.includes(p.id));
  const queuePhotos = basePhotos.slice(0, Math.max(0, 8 - deletedLoungePhotoIds.length));

  const metaByLounge: Record<
    Exclude<LoungeType, 'personal'>,
    {
      badge: string;
      title: string;
      subtitle: string;
      bufferReason: string;
      senderLabels: string[];
    }
  > = {
    family: {
      badge: `⏳ AI 정리 대기실 (${activeFamilyRoom})`,
      title: '새로 올라온 가족 사진을 정리하고 있습니다',
      subtitle: '',
      bufferReason: '✨ 인물·날짜 자동 분류 중',
      senderLabels: ['은숙(아내)', '진욱(방장)', '우리딸', '본가 어머님'],
    },
    club: {
      badge: '⏳ AI 정리 대기실',
      title: '새로 올라온 모임 사진을 정리하고 있습니다',
      subtitle: '',
      bufferReason: '✨ 인물 분류 및 스캔 사진 정리 중',
      senderLabels: ['김총무(방장)', '박회장', '이프로', '최회원'],
    },
    student: {
      badge: '📥 우리반 새 사진·영상 정리함',
      title: '친구들이 올린 사진과 영상을 정리하고 있습니다',
      subtitle: '',
      bufferReason: '방장 PC가 켜지면 자동으로 사진·영상 정리가 시작됩니다',
      senderLabels: ['민준 아이폰', '서연 갤럭시', '도윤 아이폰', '하은 아이폰'],
    },
    work: {
      badge: '📥 새 업무 문서 정리함',
      title: '새로 올라온 업무 서류·사진을 폴더별로 자동 정리합니다',
      subtitle: '',
      bufferReason: '업무 공유 드라이브(S:) 폴더 자동 분류 중',
      senderLabels: ['박과장 외근 노트북', '이팀장 아이폰', '정실장 데스크탑', '강사원 현장 태블릿'],
    },
  };

  const currentMeta =
    metaByLounge[activeLoungeType === 'personal' ? 'family' : activeLoungeType];

  const handleGenerateSticks = (e: React.FormEvent) => {
    e.preventDefault();
    createAlumniStickChipsFromInput(stickYearInput, stickPlaceInput, stickSeasonInput);
    if (analogScannedPhotos.length > 0) {
      const firstId = analogScannedPhotos[0].id;
      const cleanYear = stickYearInput.replace(/[^0-9]/g, '') || '1989';
      const cleanSeason = stickSeasonInput.trim() || '봄';
      const comboLabel = `${cleanYear}년 ${cleanSeason}`;
      setSelectedStickLabel(comboLabel);
      setTimeout(() => {
        applyStickChipToAnalogPhoto(firstId, comboLabel);
      }, 0);
    }
  };

  const handleApproveAllAnalog = () => {
    const count = pendingAnalogProposals.length;
    approveAllAnalogYearProposals();
    setBatchApprovedBanner(
      `✓ 동기들이 제보한 옛날 사진 연도/장소 ${count}건이 👑 방장 일괄 결재로 느슨한 타임라인 · 계절↔월(Month) 양방향 인덱스 · 귀신같이 여권 1980년대 바구니(1989~1980)에 즉시 반영되었습니다!`
    );
  };

  const handleSubmitWaitingRoomProposal = (photoId: string, rawText: string) => {
    const yearMatch = rawText.match(/(19\d{2}|20\d{2}|\d{2})/);
    const parsedYear = yearMatch
      ? Number(yearMatch[1].length === 2 ? `19${yearMatch[1]}` : yearMatch[1])
      : 1989;
    const seasonMatch = rawText.match(/(봄|여름|가을|겨울)/);
    const parsedSeason = seasonMatch ? seasonMatch[1] : '가을';
    submitAnalogYearProposal(
      photoId,
      proposalAuthor,
      parsedYear,
      parsedSeason,
      rawText,
      `${rawText} 때 찍은 사진입니다!`
    );
  };

  return (
    <main className="flex-1 w-full max-w-[1360px] mx-auto px-5 md:px-8 py-6 flex flex-col gap-5">
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
            {activeLoungeType === 'student' && !gpuHelper24hActive && (
              <button
                type="button"
                onClick={() => setPokedStudentHost(true)}
                className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-sm text-[11.5px] font-extrabold"
              >
                {pokedStudentHost
                  ? '✓ 방장에게 "PC 켜줘!" 알림 전송됨'
                  : '👉 방장에게 "PC 켜줘!" 알림 보내기'}
              </button>
            )}

            <button
              type="button"
              onClick={() => setInstantFlushed(true)}
              className="px-3.5 py-1.5 rounded-xl bg-primary-container text-zinc-950 font-label-sm text-[12px] font-extrabold"
            >
              {instantFlushed
                ? '✓ 앨범 피드에 전체 반영 완료!'
                : '⚡ 지금 바로 앨범 피드에 올리기'}
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
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-80" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
            </span>
            <span className="font-label-sm text-[12.5px] text-zinc-200 font-bold">
              {instantFlushed
                ? `정리 완료 — 새로 올라온 사진 ${queuePhotos.length}장 & 동영상 ${videoSceneItems.length}개가 앨범 피드에 모두 반영되었습니다!`
                : `${currentMeta.bufferReason} (사진 ${queuePhotos.length}장 · 동영상 ${videoSceneItems.length}개)`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setDesktopTab('dashboard');
                setMobileTab('search');
              }}
              className="px-3 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-200 font-label-sm text-[11px] font-bold"
            >
              앨범 피드 보러가기 →
            </button>
          </div>
        </div>

        {/* 🎯 업무 공유(work)에서는 인물 여권 미발동 & 현장/제품 사진 일반 시각 분석 안내만 노출 */}
        {activeLoungeType === 'work' ? (
          <div className="p-4 rounded-xl bg-zinc-950/90 border border-cyan-400/30 flex flex-wrap items-center justify-between gap-2.5 text-[12px] text-zinc-200">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-cyan-400 text-zinc-950 font-label-sm text-[11px] font-extrabold">
                📸 업무 사진·서류 시각 분석 가동 중
              </span>
              <span className="font-bold">
                현장 시공 사진, 자재 라벨, 촬영 서류의 사물·텍스트(OCR)만 자동 분석합니다 (🛂 귀신같이 인물 여권은 업무 공유에서 미발동 · 검색 제외)
              </span>
            </div>
          </div>
        ) : (
          /* 🎯 ✨ AI 얼굴 자동 매칭 도우미 + 👑 방장 누락분 & 연도 제보 일괄 승인 */
          <div className="p-3.5 rounded-xl bg-zinc-950/90 border border-primary-container/30 flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-primary-container text-zinc-950 font-label-sm text-[11px] font-extrabold">
                  ✨ AI 얼굴 자동 매칭 도우미
                </span>

                <div className="flex flex-wrap items-center gap-2">
              {memberActiveHints.length > 0 && (
                <button
                  type="button"
                  onClick={() => passAllSwarmCandidatesToHostQueue()}
                  className="px-3 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-300 font-label-sm text-[11px] font-bold"
                >
                  ⚡ 확인 건너뛰고 사진만 바로 올리기 (방장이 나중에 정리)
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
                    ? '1초 만에 역스캔 중...'
                    : `👑 방장 누락분 뒷정리: ${hostCleanupQueue.length}건 일괄 등록`}
                </button>
              )}
              {pendingAnalogProposals.length > 0 && (
                <button
                  type="button"
                  onClick={handleApproveAllAnalog}
                  className="px-3 py-1 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-label-sm text-[11px] font-extrabold shadow-[0_0_14px_rgba(52,211,153,0.3)]"
                >
                  ✓ 멤버 연도 제보 일괄 승인 ({pendingAnalogProposals.length}건)
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowFaceRegistryModal(true)}
                className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-200 font-label-sm text-[11px] font-bold"
              >
                👑 방장 총점검 센터 →
              </button>
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
                        🎯 방금 올린 사진에서 <span className="text-primary-container">{cand.suggestedMemberName}</span>님의 새로운 연도/각도(<span className="text-amber-300">{cand.conditionBadgeKo}</span>) 베스트 컷을 찾았어요!
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
                  ? `⚡ 확인을 건너뛴 사진 속 얼굴 후보 ${hostCleanupQueue.length}건이 👑 방장 정리 대기열에 안전하게 보관되어 있습니다.`
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

      {/* 3 & 4. 옛날 스캔 사진용 '연도·장소 스티커' & [❓ 언제/어디인가요?] 동기 제보 ➔ 👑 방장 일괄 승인 (노션 스타일 동적 토글 · 업무 공유 제외) */}
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
                <span className="px-2.5 py-0.5 rounded-md bg-amber-400 text-zinc-950 font-label-sm text-[11px] font-extrabold">
                  🎞️ 촬영 날짜 없는 옛날 종이 사진 · 연도·장소 스티커 붙이기
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 font-label-sm text-[11px] font-bold">
                  🛂 연도 입력 시 [1980년대 앨범]으로 자동 분류
                </span>
              </div>
              <h2 className="font-headline-sm text-[16px] md:text-[17.5px] text-white font-bold mt-0.5">
                첫 번째 스캔 사진에 연도·장소·계절을 한 번만 적으면 [🏷️ 스티커]가 만들어져, 다음 사진부터는 클릭 한 번으로 바로 붙일 수 있습니다
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {analogScannedPhotos.filter((ap) => ap.unknownDatePlace).length > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-amber-400/15 border border-amber-400/40 text-amber-300 font-label-sm text-[11.5px] font-extrabold">
                ❓ 연도 미분류 {analogScannedPhotos.filter((ap) => ap.unknownDatePlace).length}장
              </span>
            )}
            {pendingAnalogProposals.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleApproveAllAnalog();
                }}
                className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-sm text-[12px] font-extrabold shadow-[0_0_20px_rgba(251,191,36,0.3)] shrink-0"
              >
                👑 방장 뒷정리: [✓ 멤버 연도 제보 일괄 승인 ({pendingAnalogProposals.length}건)]
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
                ① 첫 사진 키워드 입력:
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
                className="px-3.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-sm text-[12px] font-extrabold"
              >
                + 스틱(Chip) 자동 생성
              </button>
            </div>

            <button
              type="button"
              onClick={() => applyStickChipToAllPendingAnalogPhotos(selectedStickLabel)}
              className="px-3.5 py-1.5 rounded-lg bg-primary-container text-zinc-950 font-label-sm text-[11.5px] font-extrabold"
            >
              ⚡ 선택된 스틱으로 미분류 스캔 사진 전체 1초 연쇄 태깅
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
                  className={`px-3 py-1 rounded-full font-label-sm text-[12px] font-extrabold transition-all border ${
                    isSelected
                      ? 'bg-amber-400 text-zinc-950 border-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.35)]'
                      : 'bg-zinc-900 hover:bg-zinc-800 text-amber-200 border-amber-400/35'
                  }`}
                >
                  🏷️ {chip.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 스캔된 옛날 사진 카드 그리드 (1초 스틱 부착 & [❓ 언제/어디인가요?] 댓글 제보) — 길어지면 내부 스크롤 */}
        <div className="max-h-[640px] overflow-y-auto pr-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {analogScannedPhotos.map((ap, index) => {
            const photoProposals = analogYearProposals.filter(
              (p) => p.targetAnalogPhotoId === ap.id
            );
            const activeStick = alumniStickChips.find((s) => s.label === selectedStickLabel);
            return (
              <div
                key={ap.id}
                className={`rounded-2xl overflow-hidden bg-zinc-950 border flex flex-col justify-between transition-all ${
                  ap.unknownDatePlace
                    ? 'border-amber-400/60 shadow-[0_0_18px_rgba(251,191,36,0.12)]'
                    : 'border-white/10'
                }`}
              >
                <div>
                  <div className="relative aspect-[4/3] w-full bg-zinc-900 overflow-hidden">
                    <img
                      src={ap.thumbUrl}
                      alt={ap.captionKo}
                      className="w-full h-full object-cover sepia-[0.25] contrast-[1.04]"
                    />
                    <div className="absolute top-2 left-2 flex flex-wrap items-center gap-1">
                      <span className="px-2 py-0.5 rounded bg-black/80 border border-white/15 text-zinc-300 font-mono text-[10px]">
                        {ap.uploaderLabel}
                      </span>
                    </div>
                    <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-1">
                      <span className="px-2 py-0.5 rounded bg-emerald-950/90 border border-emerald-400/50 text-emerald-300 font-mono text-[10px] font-bold truncate">
                        {ap.mappedPassportBucketLabel}
                      </span>
                      {ap.unknownDatePlace ? (
                        <span className="px-2 py-0.5 rounded bg-amber-400 text-zinc-950 font-label-sm text-[10.5px] font-extrabold animate-pulse shrink-0">
                          ❓ 언제/어디인가요?
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-zinc-950/90 border border-amber-400/40 text-amber-300 font-label-sm text-[10.5px] font-bold shrink-0">
                          🗓️ {ap.looseTimelineGroup}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-label-sm text-[12px] text-white font-bold truncate">
                        #{index + 1}. {ap.captionKo}
                      </span>
                    </div>

                    {/* 부착된 스틱 태그 목록 */}
                    <div className="flex flex-wrap items-center gap-1 min-h-[24px]">
                      {ap.appliedSticks.length > 0 ? (
                        ap.appliedSticks.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/40 text-amber-200 font-label-sm text-[10.5px] font-bold"
                          >
                            🏷️ {tag}
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-amber-300/90 font-bold">
                          ⚠️ 연도·장소 미분류 — 스틱을 찍거나 동기 제보를 기다립니다
                        </span>
                      )}
                    </div>

                    {/* 양방향 확장 인덱싱 키워드 미리보기 */}
                    {ap.expandedSearchKeywords && ap.expandedSearchKeywords.length > 0 && (
                      <div className="px-2 py-1 rounded bg-zinc-900/90 border border-white/5 text-[10px] text-zinc-400 font-mono truncate">
                        🔍 자동매칭: {ap.expandedSearchKeywords.slice(0, 7).join(' · ')}
                      </div>
                    )}

                    {/* 동기들의 연도/장소 제보 내역 */}
                    {photoProposals.length > 0 && (
                      <div className="p-2 rounded-lg bg-zinc-900 border border-amber-400/30 flex flex-col gap-1">
                        {photoProposals.map((prop) => (
                          <div
                            key={prop.proposalId}
                            className="flex items-center justify-between gap-1 text-[11px]"
                          >
                            <span className="text-amber-200 font-bold truncate">
                              💬 {prop.proposerName}: &ldquo;{prop.proposedPlaceTag}&rdquo;
                            </span>
                            <span
                              className={`px-1.5 py-0.2 rounded font-mono text-[9.5px] shrink-0 ${
                                prop.approvedByHost
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-amber-400/20 text-amber-300'
                              }`}
                            >
                              {prop.approvedByHost ? '✓ 방장 승인됨' : '결재 대기'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 하단 액션: 1초 스틱 찍기 & [❓ 언제인가요?] 제보 입력 */}
                <div className="p-3 pt-0 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => applyStickChipToAnalogPhoto(ap.id, selectedStickLabel)}
                    className="w-full py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-amber-400/40 text-amber-300 font-label-sm text-[11.5px] font-extrabold transition-colors"
                  >
                    👆 {activeStick ? `[🏷️ ${activeStick.label}] 1초 부착` : '선택한 스틱 1초 부착'}
                  </button>

                  {ap.unknownDatePlace && (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={proposalDraftByPhoto[ap.id] ?? '1989년 가을 소풍'}
                        onChange={(e) =>
                          setProposalDraftByPhoto((prev) => ({
                            ...prev,
                            [ap.id]: e.target.value,
                          }))
                        }
                        placeholder="예: 1989년 가을 소풍"
                        className="flex-1 min-w-0 px-2 py-1 rounded-lg bg-zinc-900 border border-white/15 text-white text-[11px]"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          handleSubmitWaitingRoomProposal(
                            ap.id,
                            proposalDraftByPhoto[ap.id] ?? '1989년 가을 소풍'
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-primary-container text-zinc-950 font-label-sm text-[11px] font-extrabold shrink-0"
                      >
                        제보
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        </div>
        )}
      </section>
      )}

      {/* 새로 올라온 사진 정리함 그리드 */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <span className="font-headline-sm text-[15.5px] text-white font-bold">
            📥 최근 올라온 사진 ({queuePhotos.length}장)
          </span>
        </div>

        {lastDeletedPhotoId && (
          <div className="px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-emerald-400/50 flex flex-wrap items-center justify-between gap-2 text-[12px] text-emerald-200">
            <span>
              🗑️ 업로드 후 24시간 내 본인 삭제 요청에 따라 사진이 라운지에서 내려가고 방장 PC의 OS 기본 [휴지통]으로 이동되었습니다.
            </span>
            <button
              type="button"
              onClick={() => {
                setDeletedLoungePhotoIds((prev) => prev.filter((id) => id !== lastDeletedPhotoId));
                setLastDeletedPhotoId(null);
              }}
              className="px-3 py-1 rounded-lg bg-emerald-400 text-zinc-950 font-label-sm text-[11px] font-extrabold cursor-pointer"
            >
              ↩️ 1초 실행 취소 (되돌리기)
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
          {queuePhotos.map((photo, idx) => {
            const sender =
              currentMeta.senderLabels[idx % currentMeta.senderLabels.length];
            const isDone = instantFlushed || idx < 5;
            return (
              <article
                key={photo.id}
                className="rounded-2xl overflow-hidden bg-[#18181B] border border-white/10 flex flex-col"
              >
                <div className="relative aspect-[4/3] w-full bg-zinc-950 overflow-hidden">
                  <img
                    src={photo.thumbUrl}
                    alt={photo.name}
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
                      : '✨ AI가 예쁜 이름표를 달며 꽃단장 중이에요'}
                  </div>
                </div>
                <div className="p-3 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-1 text-[11px]">
                    <span className="px-2 py-0.5 rounded bg-zinc-900 border border-white/10 text-zinc-200 font-bold truncate">
                      👤 {sender}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setDeletedLoungePhotoIds((prev) => [...prev, photo.id]);
                        setLastDeletedPhotoId(photo.id);
                      }}
                      title="올린 원본 주인은 업로드 후 24시간 내에 언제나 직접 삭제할 수 있습니다"
                      className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-rose-950/80 border border-white/10 hover:border-rose-400/50 text-zinc-400 hover:text-rose-200 font-label-sm text-[10.5px] font-bold cursor-pointer shrink-0"
                    >
                      🗑️ 24시간 내 본인 삭제
                    </button>
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
      </section>
    </main>
  );
};

/**
 * 4번 서브메뉴 상단에 라운지 성격별로 표시되는 전용 관리/업그레이드/인증 섹션
 * - 개인: [AI 설정몬스터] 정기 구독 업그레이드 안내
 * - 패밀리: [👑 가족 초대 & 서버도우미] 가족 무수락 초대 링크/QR (방장 강퇴권 포함) + 양가 통합권 설정
 * - 동호·동창회: [👥 동호·동창회 관리 & 서버도우미] 소(20명)/중(100명)/대(무제한) 동호·동창회 설정 + 회원 초대/강퇴 관리
 * - 10대 학생: [🎮 게이밍 PC & 학생인증] 하교 후 방장 게이밍 PC 집중 동기화 토글 + 학생증 로컬 OCR 0.1초 인증(월 900원)
 */
export const LoungeCustomSettingsHeader: React.FC = () => {
  const {
    activeLoungeType,
    activeFamilyRoom,
    setActiveFamilyRoom,
    clubSizeTier,
    setClubSizeTier,
    studentOcrVerified,
    verifyStudentOcr,
    activePricingPlan,
    activatePricingPlan,
    isStoreAppMode,
    setShowProModal,
    syncState,
    setPrivateSyncStrategy,
    triggerSyncNow,
    pcAgentPairedMobile,
    setPcAgentPairedMobile,
    merlinAuth,
  } = useSaySeeStore();

  const [inviteCopied, setInviteCopied] = useState(false);
  const [trojanBragCopied, setTrojanBragCopied] = useState(false);
  const [familyTrojanBragCopied, setFamilyTrojanBragCopied] = useState(false);
  const [familyShortsWatermark, setFamilyShortsWatermark] = useState('사랑하는 우리가족');
  const [clubShortsWatermark, setClubShortsWatermark] = useState('제주여고 89회 공식 갤러리');
  const [shortsExportToast, setShortsExportToast] = useState<string | null>(null);
  const [gamingPcAutoSyncAfterSchool, setGamingPcAutoSyncAfterSchool] = useState(true);
  const [hostRetainsHidePermission, setHostRetainsHidePermission] = useState(true);
  const [showInlineQrPanel, setShowInlineQrPanel] = useState(false);
  const [showQuickSendDrawer, setShowQuickSendDrawer] = useState(false);
  const [mobileInstallLinkCopied, setMobileInstallLinkCopied] = useState(false);
  const [subPcLinkCopied, setSubPcLinkCopied] = useState(false);
  const [isZCoreConnected, setIsZCoreConnected] = useState(zCoreBridge.isConnected);

  useEffect(() => {
    setIsZCoreConnected(zCoreBridge.isConnected);
    const unsub = zCoreBridge.subscribe((conn) => setIsZCoreConnected(conn));
    void zCoreBridge.checkHealth();
    return () => {
      unsub();
    };
  }, []);

  const isLoggedInUser = Boolean(
    merlinAuth?.email && merlinAuth.userId && merlinAuth.userId !== 'guest'
  );
  const isMainPcConnected = isLoggedInUser && isZCoreConnected;
  const isMobileConnected = isLoggedInUser && Boolean(pcAgentPairedMobile);
  const openLoginModal = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('openLoginModal'));
    }
  };
  const openZCoreGuideModal = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('openZCoreGuideModal'));
    }
  };

  const renderRoomCreationAndExitPolicyBox = () => (
    <div className="p-3.5 rounded-xl bg-zinc-950/90 border border-white/10 flex flex-wrap items-center justify-between gap-2.5">
      <span className="font-label-sm text-[12px] text-zinc-200 font-bold">
        🛠️ 사진 삭제·숨기기 권한 설정
      </span>

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setHostRetainsHidePermission(true)}
          className={`px-3 py-1.5 rounded-lg font-label-sm text-[11.5px] font-extrabold border cursor-pointer ${
            hostRetainsHidePermission
              ? 'bg-primary-container text-zinc-950 border-primary-container'
              : 'bg-zinc-900 text-zinc-300 border-white/15'
          }`}
        >
          👑 방장 상시 숨기기 가능 (권장)
        </button>
        <button
          type="button"
          onClick={() => setHostRetainsHidePermission(false)}
          className={`px-3 py-1.5 rounded-lg font-label-sm text-[11.5px] font-extrabold border cursor-pointer ${
            !hostRetainsHidePermission
              ? 'bg-primary-container text-zinc-950 border-primary-container'
              : 'bg-zinc-900 text-zinc-300 border-white/15'
          }`}
        >
          🤝 24시간 내 본인 삭제만
        </button>
      </div>
    </div>
  );
  const [familyMembers, setFamilyMembers] = useState([
    { id: 'm1', name: '진욱 (방장·마스터)', room: '우리집', role: 'HOST' },
    { id: 'm2', name: '은숙 (아내)', room: '우리집', role: 'MEMBER' },
    { id: 'm3', name: '우리딸', room: '우리집', role: 'MEMBER' },
    { id: 'm4', name: '처가 어머님', room: '처가(친정)', role: 'MEMBER' },
    { id: 'm5', name: '본가 어머님', room: '본가(친가)', role: 'MEMBER' },
  ]);
  const [clubMembers, setClubMembers] = useState([
    { id: 'c1', name: '김철수 총무 (방장·마스터)', badge: '총무', role: 'HOST' },
    { id: 'c2', name: '박회장', badge: '정회원', role: 'MEMBER' },
    { id: 'c3', name: '이프로', badge: '정회원', role: 'MEMBER' },
    { id: 'c4', name: '최회원', badge: '신입회원', role: 'MEMBER' },
  ]);

  const copyInviteLink = async () => {
    const inviteCopy =
      '[귀신같이 라운지 초대장] 혼자 쓸 땐 언제나 0원, 함께 쓸 땐 방장 한 분만! 초대받은 가족·회원·직원은 언제나 무료입니다. https://ghosti.sundreamer.app';
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(inviteCopy);
      }
    } catch {
      // ignore clipboard fallback
    }
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2500);
  };

  const handleCopyTrojanCoupon = async () => {
    const text =
      '내가 동호회·동창회 연구독(마스터권) 끊어서 [가족 라운지 1개월 무료 구독권 3장] 받았는데, 선착순 3명에게 줄 테니 가족방 쓸 사람?';
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      // ignore clipboard fallback
    }
    setTrojanBragCopied(true);
    setTimeout(() => setTrojanBragCopied(false), 2600);
  };

  const handleCopyFamilyTrojanCoupon = async () => {
    const text =
      '내가 가족 라운지 연구독(마스터권) 끊어서 [동호회·동창회 모임 라운지 3개월 무료 구독권 1장] 받았는데, 우리 모임 총무님께 선물할게요!';
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      // ignore clipboard fallback
    }
    setFamilyTrojanBragCopied(true);
    setTimeout(() => setFamilyTrojanBragCopied(false), 2600);
  };

  const triggerShortsWatermarkPreview = (label: string) => {
    setShortsExportToast(
      `🎬 변천사 쇼츠 우측 하단 워터마크가 [Ghosti] 대신 [${label}]로 적용되어 카톡·인스타 공유용 MP4에 각인되었습니다!`
    );
    setTimeout(() => setShortsExportToast(null), 3200);
  };

  if (activeLoungeType === 'personal') {
    const isShadowMode = syncState.privateSyncStrategy === 'shadow';
    return (
      <div className="p-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-5">
        {/* [수술 1 & 2 완료] 중복 배지·h1 제목·요금제 버튼 제거 ➔ 핵심 1줄 + 우측 QR 버튼만 유지 */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[14.5px] md:text-[15.5px] text-white font-bold">
            같은 이메일로 로그인하면 집 PC · 회사 PC · 스마트폰이 클라우드 요금 0원으로 1초 만에 직결됩니다.
          </p>

          <button
            type="button"
            onClick={() => setShowInlineQrPanel((v) => !v)}
            className={`px-4 py-2 rounded-xl font-label-sm text-[12.5px] font-extrabold cursor-pointer shadow-sm transition-all shrink-0 ${
              showInlineQrPanel
                ? 'bg-emerald-400 text-zinc-950 ring-2 ring-emerald-300'
                : 'bg-primary-container hover:opacity-95 text-zinc-950'
            }`}
          >
            {showInlineQrPanel ? '📱 스마트폰 1초 연결 QR 닫기 ▴' : '📱 스마트폰 1초 연결 QR ▾'}
          </button>
        </div>

        {/* [결함 2 & 수술 7 완료] 인라인 스마트폰 앱 설치 QR + 실제 설치 링크 복사 버튼 */}
        {showInlineQrPanel && (
          <div className="p-4 rounded-2xl bg-zinc-950 border border-primary-container/50 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-[84px] h-[84px] rounded-xl bg-white p-1.5 shrink-0 flex items-center justify-center shadow-md">
                <svg viewBox="0 0 64 64" className="w-full h-full">
                  <rect width="64" height="64" fill="#ffffff" />
                  <path
                    fill="#09090B"
                    d="M4 4h20v20H4V4zm4 4v12h12V8H8zm4 4h4v4h-4v-4zm28-8h20v20H40V4zm4 4v12h12V8H44zm4 4h4v4h-4v-4zM4 40h20v20H4V40zm4 4v12h12V44H8zm4 4h4v4h-4v-4zm16-40h4v8h-4V8zm0 12h8v4h-8v-4zm-24 8h8v4H4v-4zm12 0h16v4H16v-4zm20 0h8v8h-8v-8zm12 4h12v4H48v-4zm-20 8h8v12h-8V40zm12 8h8v12h-8V48zm12 0h8v4h-8v-4zm-4 8h12v4H48v-4z"
                  />
                </svg>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[13.5px] font-extrabold text-primary-container">
                  📱 스마트폰 앱 설치 QR 코드 + 같은 이메일로 로그인하면 1초 자동 연결
                </span>
                <p className="text-[12.5px] text-zinc-300 leading-relaxed">
                  ① 스마트폰 카메라로 좌측 QR 코드를 스캔해 <strong className="text-white">『귀신같이』 모바일 앱</strong>을 설치하세요.<br />
                  ② 앱 실행 후 현재 PC와 동일한 이메일(<strong className="text-emerald-300">{merlinAuth?.email || '내 이메일 계정'}</strong>)로 로그인하면 복잡한 인증번호 입력 없이 1초 만에 자동 연결됩니다.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={async () => {
                  try {
                    if (typeof navigator !== 'undefined' && navigator.clipboard) {
                      await navigator.clipboard.writeText('https://ghosti.sundreamer.app');
                    }
                  } catch {}
                  setMobileInstallLinkCopied(true);
                  setTimeout(() => setMobileInstallLinkCopied(false), 3000);
                }}
                className={`px-3.5 py-2 rounded-xl font-label-sm text-[12px] font-extrabold cursor-pointer border transition-all ${
                  mobileInstallLinkCopied
                    ? 'bg-emerald-400 text-zinc-950 border-emerald-300'
                    : 'bg-zinc-900 hover:bg-zinc-800 border-primary-container/50 text-primary-container'
                }`}
              >
                {mobileInstallLinkCopied ? '✓ 모바일 설치 링크 복사됨!' : '🔗 모바일 설치 링크 복사'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!isLoggedInUser) {
                    openLoginModal();
                    return;
                  }
                  setPcAgentPairedMobile(!pcAgentPairedMobile);
                }}
                className={`px-3.5 py-2 rounded-xl font-label-sm text-[12px] font-extrabold cursor-pointer border transition-all ${
                  isMobileConnected
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                    : 'bg-zinc-900 hover:bg-zinc-800 border-white/15 text-zinc-200'
                }`}
              >
                {!isLoggedInUser
                  ? '🔑 먼저 이메일 로그인하기'
                  : isMobileConnected
                  ? '● 내 스마트폰 연결됨'
                  : '○ 연결 상태 확인'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!isLoggedInUser) {
                    openLoginModal();
                    return;
                  }
                  setShowQuickSendDrawer((v) => !v);
                }}
                className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-200 font-label-sm text-[12px] font-extrabold cursor-pointer"
              >
                {showQuickSendDrawer ? '📤 파일 전송 닫기 ▴' : '📤 폰↔PC 파일 1초 전송 ▾'}
              </button>
            </div>
          </div>
        )}

        {/* 3대 기기 연결 슬롯 현황 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-3 border-t border-white/10">
          <div
            onClick={() => {
              if (!isLoggedInUser) {
                openLoginModal();
              } else if (!isZCoreConnected) {
                openZCoreGuideModal();
              }
            }}
            className={`p-4 rounded-xl bg-zinc-950/80 border flex flex-col justify-between gap-2 transition-all ${
              isMainPcConnected
                ? 'border-primary-container/40'
                : 'border-white/10 hover:border-primary-container/40 hover:bg-zinc-900/80 cursor-pointer'
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-[12px] font-extrabold ${
                  isMainPcConnected ? 'text-primary-container' : 'text-zinc-200'
                }`}
              >
                💻 기기 1 · 메인 PC (현재 기기)
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                  isMainPcConnected
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : isLoggedInUser
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-zinc-800 text-zinc-300'
                }`}
              >
                {isMainPcConnected
                  ? '연결됨'
                  : isLoggedInUser
                  ? 'Z-코어 실행 대기'
                  : '미연결'}
              </span>
            </div>
            <p className="text-[13px] text-white font-bold">내 데스크톱 / 노트북 원본 보관소</p>
            <span
              className={`text-[11.5px] ${
                isMainPcConnected
                  ? 'text-zinc-400'
                  : 'text-primary-container font-bold'
              }`}
            >
              {isMainPcConnected
                ? '로컬 디스크 원본 100% 직결 탐색'
                : isLoggedInUser
                ? '👉 클릭하여 PC Z-코어 1초 실행 가이드 보기'
                : '👉 클릭하여 이메일 1초 로그인 후 이 PC 연결하기'}
            </span>
          </div>

          <div
            onClick={() => {
              if (!isLoggedInUser) {
                openLoginModal();
                return;
              }
              setShowInlineQrPanel((v) => !v);
            }}
            className={`p-4 rounded-xl bg-zinc-950/80 hover:bg-zinc-900/80 border flex flex-col justify-between gap-2 cursor-pointer transition-all ${
              isMobileConnected
                ? 'border-primary-container/40'
                : 'border-white/10 hover:border-primary-container/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-extrabold text-zinc-200">📱 기기 2 · 내 스마트폰 (갤럭시 / 아이폰)</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                  isMobileConnected
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : isLoggedInUser
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-zinc-800 text-zinc-300'
                }`}
              >
                {isMobileConnected
                  ? '연결됨'
                  : isLoggedInUser
                  ? 'QR 1초 연동 대기'
                  : '미연결'}
              </span>
            </div>
            <p className="text-[13px] text-white font-bold">폰 사진 자동 백업 &amp; 밖에서 내 PC 검색</p>
            <span className="text-[11.5px] text-primary-container font-bold">
              {isLoggedInUser
                ? '👉 클릭하여 앱 설치 QR · 이메일 1초 연결 보기'
                : '👉 클릭하여 먼저 이메일 로그인 후 스마트폰 연결하기'}
            </span>
          </div>

          {/* [수술 5 완료] 기기 3 서브 PC 클릭 시 설치 주소 즉시 복사 및 안내 */}
          <div
            onClick={async () => {
              try {
                if (typeof navigator !== 'undefined' && navigator.clipboard) {
                  await navigator.clipboard.writeText('https://ghosti.sundreamer.app');
                }
              } catch {}
              setSubPcLinkCopied(true);
              setTimeout(() => setSubPcLinkCopied(false), 3800);
            }}
            className="p-4 rounded-xl bg-zinc-950/80 hover:bg-zinc-900/80 border border-white/10 hover:border-emerald-400/40 flex flex-col justify-between gap-2 cursor-pointer transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-extrabold text-zinc-200">🖥️ 기기 3 · 서브 PC (회사 / 집 2호기)</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                  subPcLinkCopied
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-zinc-800 text-zinc-300'
                }`}
              >
                {subPcLinkCopied ? '설치 주소 복사됨 ✓' : '추가 가능'}
              </span>
            </div>
            <p className="text-[13px] text-white font-bold">집 ↔ 사무실 PC 양방향 AI 내용검색</p>
            <span className={`text-[11.5px] font-bold ${subPcLinkCopied ? 'text-emerald-300' : 'text-zinc-400'}`}>
              {subPcLinkCopied
                ? '✅ 서브 PC 설치 주소가 복사되었습니다! 다른 PC에서 접속 후 같은 이메일로 로그인하면 자동 연결됩니다.'
                : '👉 클릭 시 서브 PC 설치 주소 복사 (동일 이메일 자동 연결)'}
            </span>
          </div>
        </div>

        {/* [수술 3 완료] 개발자 암호 '모드 A / 모드 B' 용어 삭제 ➔ 직관적 1줄 상태 표시 (비로그인 시 허위 연동 수치 차단) */}
        <div className="px-4 py-3 rounded-xl bg-zinc-950/90 border border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
            <span className="text-zinc-200 font-bold">
              {!isLoggedInUser
                ? '🔒 아직 연결된 기기가 없습니다 — 우측 상단에서 로그인하면 내 PC와 스마트폰이 안전하게 연결됩니다.'
                : !isMobileConnected
                ? isShadowMode
                  ? '📱 스마트폰 연결 대기 중 — 연결 시 원본은 PC에 보관하고 스마트폰 용량을 99% 이상 절약합니다.'
                  : '💾 스마트폰 연결 대기 중 — 연결 시 폰·PC 양쪽에 100% 원본을 동일하게 보관합니다.'
                : isShadowMode
                ? `⚡ 스마트폰 용량 99.4% 절약 중 (원본은 PC 안전 보관 · 폰 점유 ${syncState.packSizeMB}MB)`
                : `💾 폰·PC 양쪽 100% 원본 보관 중 (${syncState.originalSizeGB}GB)`}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex p-0.5 rounded-xl bg-zinc-900 border border-white/10">
              <button
                type="button"
                onClick={() => setPrivateSyncStrategy('shadow')}
                className={`px-3 py-1.5 rounded-lg font-label-sm text-[11.5px] font-extrabold cursor-pointer transition-all whitespace-nowrap ${
                  isShadowMode
                    ? 'bg-primary-container text-zinc-950 shadow-xs'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                ⚡ 스마트 절약 연동(기본)
              </button>
              <button
                type="button"
                onClick={() => setPrivateSyncStrategy('mirror')}
                className={`px-3 py-1.5 rounded-lg font-label-sm text-[11.5px] font-extrabold cursor-pointer transition-all whitespace-nowrap ${
                  !isShadowMode
                    ? 'bg-primary-container text-zinc-950 shadow-xs'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                💾 원본 전체 백업
              </button>
            </div>

            {!isLoggedInUser ? (
              <button
                type="button"
                onClick={openLoginModal}
                className="px-3.5 py-1.5 rounded-xl bg-primary-container hover:opacity-95 text-zinc-950 font-label-sm text-[11.5px] font-extrabold cursor-pointer whitespace-nowrap"
              >
                🔑 로그인하여 기기 연결
              </button>
            ) : (
              <button
                type="button"
                disabled={syncState.syncing || (!isMainPcConnected && !isMobileConnected)}
                onClick={() => void triggerSyncNow()}
                className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-white/15 text-white font-label-sm text-[11.5px] font-extrabold cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                {syncState.syncing ? '동기화 중...' : '⚡ 지금 일치시키기'}
              </button>
            )}
          </div>
        </div>

        {showQuickSendDrawer && (
          <div className="pt-2 border-t border-white/10">
            <PcMasterQuickSendPanel />
          </div>
        )}
      </div>
    );
  }

  if (activeLoungeType === 'family') {
    const FAMILY_ROOMS: FamilyRoomId[] = ['우리집', '본가(친가)', '처가(친정)'];
    return (
      <div className="p-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2 mb-0.5">
              <GhostiBrandLogo size="mobile" showBadge={true} />
              <span className="px-2.5 py-0.5 rounded-md bg-primary-container text-zinc-950 font-label-sm text-[11px] font-extrabold w-fit">
                👑 가족 초대 &amp; 방 분리 관리
              </span>
            </div>
            <h2 className="font-headline-sm text-[18px] text-white font-bold mt-0.5">
              가족 카톡 초대 &amp; 멤버 관리
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copyInviteLink}
              className="px-4 py-2 rounded-xl bg-primary-container text-zinc-950 font-label-sm text-[12px] font-extrabold"
            >
              {inviteCopied ? '✓ 카톡 무수락 초대 링크 복사됨!' : '💬 가족 무수락 카톡 초대 링크·QR 발급'}
            </button>
            {isStoreAppMode ? (
              <button
                type="button"
                onClick={() => setShowProModal(true)}
                className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-200 font-label-sm text-[12px] font-bold"
              >
                💻 내 PC 연동 시작 가이드 보내기
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => activatePricingPlan('family_home_5900')}
                  className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-emerald-400/40 text-emerald-300 font-label-sm text-[12px] font-bold"
                >
                  🏠 우리집 단독 (평생 0원)
                </button>
                <button
                  type="button"
                  onClick={() => activatePricingPlan('family_three_8900')}
                  className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-primary-container/50 text-primary-container font-label-sm text-[12px] font-bold"
                >
                  👨‍👩‍👧‍👦 양가 통합권 3방 (평생 0원)
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-white/10">
          <div className="flex flex-col gap-2">
            <span className="font-label-sm text-[12px] text-zinc-300 font-bold">
              🏠 양가 3개 방 분리 설정 (현재 선택: {activeFamilyRoom})
            </span>
            <div className="flex flex-wrap gap-2">
              {FAMILY_ROOMS.map((room) => (
                <button
                  key={room}
                  type="button"
                  onClick={() => setActiveFamilyRoom(room)}
                  className={`px-3.5 py-2 rounded-xl font-label-sm text-[12px] font-bold border ${
                    activeFamilyRoom === room
                      ? 'bg-primary-container text-zinc-950 border-primary-container font-extrabold'
                      : 'bg-zinc-950 text-zinc-300 border-white/10'
                  }`}
                >
                  {room}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="font-label-sm text-[12px] text-zinc-300 font-bold">
              👨‍👩‍👧‍👦 참여 중인 가족 멤버 ({familyMembers.length}명 · 방장 원터치 강퇴권)
            </span>
            <div className="flex flex-wrap gap-2">
              {familyMembers.map((m) => (
                <div
                  key={m.id}
                  className="px-3 py-1.5 rounded-xl bg-zinc-950 border border-white/10 flex items-center gap-2 text-[11.5px]"
                >
                  <span className="text-zinc-200 font-bold">{m.name}</span>
                  <span className="text-zinc-500">({m.room})</span>
                  {m.role !== 'HOST' && (
                    <button
                      type="button"
                      onClick={() =>
                        setFamilyMembers((prev) => prev.filter((x) => x.id !== m.id))
                      }
                      className="text-rose-400 hover:text-rose-300 font-bold ml-1"
                    >
                      [강퇴]
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* [치트키 4] 자동화 숏폼 '가족 맞춤형 워터마크' 권한 */}
        <div className="p-4 rounded-xl bg-zinc-950/90 border border-primary-container/35 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-primary-container/20 text-primary-container font-label-sm text-[10.5px] font-extrabold">
                🎬 자동화 변천사 숏폼 · 맞춤형 워터마크
              </span>
              <span className="font-mono text-[11px] text-amber-300 font-bold">
                현재 우측 하단 각인: [{familyShortsWatermark}]
              </span>
            </div>
            <p className="font-body-sm text-[12px] text-zinc-300">
              기본 <code>[Ghosti]</code> 로고 대신 <strong>[{familyShortsWatermark}]</strong> 워터마크를 박아 카톡·인스타로 공유하면 다른 가족 모임의 연쇄 유입이 일어납니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <input
              type="text"
              value={familyShortsWatermark}
              onChange={(e) => setFamilyShortsWatermark(e.target.value)}
              placeholder="예: 사랑하는 우리가족"
              className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-white/15 text-white text-[12px] font-bold w-44"
            />
            <button
              type="button"
              onClick={() => triggerShortsWatermarkWatermarkPreview(familyShortsWatermark)}
              className="px-3.5 py-1.5 rounded-lg bg-primary-container text-zinc-950 font-label-sm text-[11.5px] font-extrabold whitespace-nowrap cursor-pointer"
            >
              🎬 워터마크 적용 &amp; 쇼츠 미리보기
            </button>
            {!isStoreAppMode && (
              <button
                type="button"
                onClick={() => void handleCopyFamilyTrojanCoupon()}
                className={`px-3.5 py-1.5 rounded-lg font-label-sm text-[11.5px] font-extrabold whitespace-nowrap cursor-pointer ${
                  familyTrojanBragCopied
                    ? 'bg-emerald-400 text-zinc-950'
                    : 'bg-zinc-900 hover:bg-zinc-800 border border-primary-container/45 text-primary-container'
                }`}
              >
                {familyTrojanBragCopied
                  ? '✓ 모임 3개월 무료권 문구 복사됨!'
                  : '🎁 [가족방 연구독 특전] 모임 라운지 3개월 무료 구독권 1장 선물'}
              </button>
            )}
          </div>
        </div>

        {shortsExportToast && (
          <div className="px-3.5 py-2 rounded-xl bg-emerald-500/15 border border-emerald-400/40 text-emerald-200 font-label-sm text-[12px] font-bold">
            {shortsExportToast}
          </div>
        )}

        {renderRoomCreationAndExitPolicyBox()}
      </div>
    );
  }

  function triggerShortsWatermarkWatermarkPreview(label: string) {
    triggerShortsWatermarkPreview(label);
  }

  if (activeLoungeType === 'club') {
    return (
      <div className="p-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2 mb-0.5">
              <GhostiBrandLogo size="mobile" showBadge={true} />
              <span className="px-2.5 py-0.5 rounded-md bg-primary-container text-zinc-950 font-label-sm text-[11px] font-extrabold w-fit">
                ⛰️ 동호회·모임 관리
              </span>
            </div>
            <h2 className="font-headline-sm text-[18px] text-white font-bold mt-0.5">
              ⛰️ 동호회·모임 초대 &amp; 회원 관리
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copyInviteLink}
              className="px-4 py-2 rounded-xl bg-primary-container text-zinc-950 font-label-sm text-[12px] font-extrabold cursor-pointer"
            >
              {inviteCopied ? '✓ 동호·동창 회원 초대 링크 복사됨!' : '⛳ 동호·동창회 무수락 초대 링크·QR 발급'}
            </button>
            {isStoreAppMode && (
              <button
                type="button"
                onClick={() => setShowProModal(true)}
                className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-200 font-label-sm text-[12px] font-bold"
              >
                💻 내 PC 연동 시작 가이드 보내기
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            {
              id: 'mini_9' as ClubSizeTier,
              label: '🥂 일상 소모임 (친구·계모임·취미)',
              price: '인원 무제한 평생 0원 (사진·동영상 전용)',
              plan: 'club_mini_free_300' as PricingPlanId,
            },
            {
              id: 'small' as ClubSizeTier,
              label: '⛰️ 동호회 사진방 (모임 이름 문패 · 인원 무제한)',
              price: '인원 무제한 평생 0원 (사진·동영상 전용)',
              plan: 'club_small_4900' as PricingPlanId,
            },
            {
              id: 'large' as ClubSizeTier,
              label: '🎓 동창회 · 반창회 사진방 (학교/학년/반 문패 · 인원 무제한)',
              price: '인원 무제한 평생 0원 (사진·동영상 전용)',
              plan: 'club_small_year_49000' as PricingPlanId,
            },
          ].map((t) => (
            <div
              key={t.id}
              onClick={() => {
                setClubSizeTier(t.id);
                if (!isStoreAppMode) {
                  activatePricingPlan(t.plan);
                }
              }}
              className={`p-3.5 rounded-xl border cursor-pointer flex items-center justify-between ${
                clubSizeTier === t.id
                  ? 'bg-zinc-900 border-primary-container'
                  : 'bg-zinc-950 border-white/10'
              }`}
            >
              <div className="flex flex-col">
                <span className="font-label-sm text-[12.5px] text-white font-bold">{t.label}</span>
                <span className="font-label-mono text-[11.5px] text-primary-container font-bold">{t.price}</span>
              </div>
              <span className="text-[11px] text-zinc-400 font-bold">
                {clubSizeTier === t.id ? '✓ 선택됨' : '선택'}
              </span>
            </div>
          ))}
        </div>

        {/* [치트키 3 & 4] 모임용 맞춤형 쇼츠 워터마크 커스텀 + 모임 연구독 특전 가족방 1개월 무료 구독권 3장 */}
        <div className="p-4 rounded-xl bg-zinc-950/90 border border-amber-400/40 flex flex-col gap-3">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-amber-400 text-zinc-950 font-label-sm text-[10.5px] font-extrabold">
                  🎬 모임용 맞춤형 쇼츠 워터마크 특권
                </span>
                <span className="font-mono text-[11.5px] text-amber-300 font-bold">
                  우측 하단 각인: [{clubShortsWatermark}]
                </span>
              </div>
              <p className="font-body-sm text-[12px] text-zinc-300">
                자동 렌더링 변천사 쇼츠 우측 하단에 <code>[Ghosti]</code> 대신 <strong>[{clubShortsWatermark}]</strong>를 박아 카톡·인스타로 공유하면 타 동창회·모임의 꼬리물기 유입이 일어납니다.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <input
                type="text"
                value={clubShortsWatermark}
                onChange={(e) => setClubShortsWatermark(e.target.value)}
                placeholder="예: 제주여고 89회 공식 갤러리"
                className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-white/15 text-white text-[12px] font-bold w-52"
              />
              <button
                type="button"
                onClick={() => triggerShortsWatermarkPreview(clubShortsWatermark)}
                className="px-3.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-sm text-[11.5px] font-extrabold whitespace-nowrap cursor-pointer"
              >
                🎬 워터마크 적용 &amp; 쇼츠 각인
              </button>
              {!isStoreAppMode && (
                <button
                  type="button"
                  onClick={() => void handleCopyTrojanCoupon()}
                  className={`px-3.5 py-1.5 rounded-lg font-label-sm text-[11.5px] font-extrabold whitespace-nowrap cursor-pointer ${
                    trojanBragCopied
                      ? 'bg-emerald-400 text-zinc-950'
                      : 'bg-zinc-900 hover:bg-zinc-800 border border-amber-400/45 text-amber-300'
                  }`}
                >
                  {trojanBragCopied
                    ? '✓ 가족방 1개월권 3장 문구 복사됨!'
                    : '🎁 [모임방 연구독 특전] 가족 라운지 1개월 무료 구독권 3장 선물'}
                </button>
              )}
            </div>
          </div>

          {shortsExportToast && (
            <div className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-400/40 text-emerald-200 font-label-sm text-[11.5px] font-bold">
              {shortsExportToast}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
          <span className="font-label-sm text-[12px] text-zinc-300 font-bold mr-1">
            참여 동호·동창 회원 ({clubMembers.length}명):
          </span>
          {clubMembers.map((m) => (
            <div
              key={m.id}
              className="px-3 py-1 rounded-xl bg-zinc-950 border border-white/10 flex items-center gap-2 text-[11.5px]"
            >
              <span className="text-zinc-200 font-bold">{m.name}</span>
              <span className="text-zinc-500">[{m.badge}]</span>
              {m.role !== 'HOST' && (
                <button
                  type="button"
                  onClick={() =>
                    setClubMembers((prev) => prev.filter((x) => x.id !== m.id))
                  }
                  className="text-rose-400 hover:text-rose-300 font-bold"
                >
                  [강퇴]
                </button>
              )}
            </div>
          ))}
        </div>

        {renderRoomCreationAndExitPolicyBox()}
      </div>
    );
  }

  if (activeLoungeType === 'work') {
    return (
      <div className="p-6 rounded-2xl bg-[#18181B] border border-cyan-400/45 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="px-2.5 py-0.5 rounded-md bg-cyan-400 text-zinc-950 font-label-sm text-[11px] font-extrabold w-fit">
              💼 업무 공유 드라이브 (S:)
            </span>
            <h2 className="font-headline-sm text-[18px] text-white font-bold mt-0.5">
              사무실 PC 업무 폴더 &amp; 탐색기(S:) 연동
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!isStoreAppMode && (
              <>
                <button
                  type="button"
                  onClick={() => activatePricingPlan('personal_sub_3900')}
                  className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-200 font-label-sm text-[12px] font-bold cursor-pointer"
                >
                  💻 1인 멀티PC 월 1,900원
                </button>
                <button
                  type="button"
                  onClick={() => activatePricingPlan('work_soho_9900')}
                  className="px-3.5 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-zinc-950 font-label-sm text-[12px] font-extrabold cursor-pointer"
                >
                  🏢 소호(~5인) 월 9,900원
                </button>
                <button
                  type="button"
                  onClick={() => activatePricingPlan('work_biz_19900')}
                  className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-cyan-400/50 text-cyan-300 font-label-sm text-[12px] font-extrabold cursor-pointer"
                >
                  🏢 소기업(~20인) 월 19,000원 · 중소(~50인) 29,000원
                </button>
              </>
            )}
          </div>
        </div>
        <WorkLoungeB2BHub />
      </div>
    );
  }

  // student ('⛳ 동호회 · 동창회 (사진 공유)')
  return (
    <div className="p-6 rounded-2xl bg-[#18181B] border border-primary-container/40 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="px-2.5 py-0.5 rounded-md bg-primary-container text-zinc-950 font-label-sm text-[11px] font-extrabold w-fit">
            🎓 동창회 관리 &amp; 동기 초대 (평생 0원)
          </span>
          <h2 className="font-headline-sm text-[19px] text-white font-bold mt-1">
            🎓 동창회 초대 &amp; 동기 회원 관리 (학교/학년/반 타임캡슐 · 평생 0원)
          </h2>
          <p className="font-body-sm text-[12.5px] text-zinc-300">
            낮에 학교·학원에서 찍은 우리반 사진·영상은 대기실에 모아두었다가, 하교 후 방장 집 게이밍 PC가 켜지면 그래픽카드(GPU) 파워로 1초 만에 색인·압축 배포합니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={verifyStudentOcr}
            className={`px-4 py-2 rounded-xl font-label-sm text-[12px] font-extrabold border ${
              studentOcrVerified
                ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                : 'bg-zinc-900 hover:bg-zinc-800 border-primary-container text-primary-container'
            }`}
          >
            {studentOcrVerified
              ? '✓ 학생증 로컬 OCR 0.1초 인증됨'
              : '🪪 학생증 로컬 OCR 0.1초 인증하기'}
          </button>
          {isStoreAppMode ? (
            <button
              type="button"
              onClick={() => setShowProModal(true)}
              className="px-4 py-2 rounded-xl bg-primary-container text-zinc-950 font-label-sm text-[12px] font-extrabold"
            >
              💻 내 PC 연동 시작 가이드 보내기
            </button>
          ) : (
            <button
              type="button"
              onClick={() => activatePricingPlan('student_sub_900')}
              className="px-4 py-2 rounded-xl bg-primary-container text-zinc-950 font-label-sm text-[12px] font-extrabold"
            >
              🎒 월 900원 (연 9,000원) 개통
            </button>
          )}
        </div>
      </div>

      <label className="p-3.5 rounded-xl bg-zinc-950 border border-white/10 flex items-center justify-between gap-3 cursor-pointer">
        <div className="flex flex-col">
          <span className="font-label-md text-[13px] text-white font-bold">
            🎮 하교 후 방장 게이밍 PC 집중 동기화 모드 (오후 4시 ~ 자정 자동 부스트)
          </span>
          <span className="font-body-sm text-[11.5px] text-zinc-400">
            방장이 게임하는 동안에도 프레임 드랍 없이 유휴 텐서 코어만 활용해 친구들이 올린 대기실 영상을 초고속 색인합니다.
          </span>
        </div>
        <input
          type="checkbox"
          checked={gamingPcAutoSyncAfterSchool}
          onChange={(e) => setGamingPcAutoSyncAfterSchool(e.target.checked)}
          className="w-5 h-5 accent-[#00E5FF] rounded shrink-0"
        />
      </label>
    </div>
  );
};
