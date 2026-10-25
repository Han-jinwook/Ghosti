import React, { useEffect, useState } from 'react';
import {
  buildWindowsNativeWebDavMountCommand,
  verifyHybridP2PBridgeConnection,
  type P2PHybridConnectionDiagnostics,
} from '../services/p2pHybridBridge';
import { getActivePersonaForCluster, useSaySeeStore } from '../store/useSaySeeStore';
import type { ClubSizeTier, FamilyRoomId, LoungeType, PricingPlanId } from '../types/saysee';
import { FaceMemberInlineBar } from './FaceMemberRegistryModal';
import { PcMasterQuickSendPanel } from './PricingModal';
import { SetupMonsterContent } from './SetupMonsterModal';

const LOUNGE_TABS: Array<{
  id: LoungeType;
  icon: string;
  label: string;
  shortPrice: string;
  desc: string;
}> = [
  {
    id: 'personal',
    icon: '💻',
    label: '내 기기',
    shortPrice: '이메일 로그인 즉시 사용',
    desc: '내 폰·PC 속 AI 주치의 진단과 1초 투시검색',
  },
  {
    id: 'family',
    icon: '👨‍👩‍👧‍👦',
    label: '패밀리 공유',
    shortPrice: '우리집 월 5,900원 · 양가 3방 월 8,900원',
    desc: '가족 대표 사진 얼굴 추출 & 이름 등록 ➔ 카톡 초대 & 3초 레이더 스캔 맛보기',
  },
  {
    id: 'club',
    icon: '⛳',
    label: '동호회 · 동창회',
    shortPrice: '인원수 무제한 월 4,900원 (10년 마스터권 49,000원) 단일가',
    desc: '모임·동창 단체컷 얼굴 추출 & 참석자 폰 사진 레이더 수합 맛보기 (방 1개 기준)',
  },
  {
    id: 'work',
    icon: '💼',
    label: '업무 공유 (S:)',
    shortPrice: '1인 멀티PC 월 1,900원 · 소호 ~5인 월 9,900원 · 소기업 ~20인 월 19,000원',
    desc: '윈도우 탐색기(S:) 직접 마운트 · 서류 및 현장/제품 사진 AI 분석 (🛂 인물 여권 미발동)',
  },
];

const PLAN_BADGE_LABELS: Record<PricingPlanId, string> = {
  free_trial: '✨ 개인 (기본) : 언제나 0원',
  personal_single_2900: '🩺 Z-Eye 클린 몬스터 (개인 기본 : 언제나 0원)',
  personal_sub_3900: '💻 업무 입문 • 1인 멀티PC (월 1,900원)',
  personal_year_35000: '💻 업무 입문 • 1인 멀티PC (19,000원 · 10년 마스터권)',
  family_home_5900: '🏠 패밀리 우리집 단독 (월 5,900원)',
  family_home_year_59000: '🏠 패밀리 우리집 단독 (59,000원 · 10년 마스터권)',
  family_three_8900: '👨‍👩‍👧‍👦 패밀리 양가 통합 3방 (월 8,900원)',
  family_three_year_89000: '👨‍👩‍👧‍👦 패밀리 양가 통합 3방 (89,000원 · 10년 마스터권)',
  club_small_4900: '⛳ 동호회 · 동창회 단일가 (월 4,900원)',
  club_small_year_49000: '⛳ 동호회 · 동창회 단일가 (49,000원 · 10년 마스터권)',
  club_medium_7900: '⛳ 동호회 · 동창회 단일가 (월 4,900원)',
  club_medium_year_79000: '⛳ 동호회 · 동창회 단일가 (49,000원 · 10년 마스터권)',
  club_large_14900: '⛳ 동호회 · 동창회 단일가 (월 4,900원)',
  club_large_year_149000: '⛳ 동호회 · 동창회 단일가 (49,000원 · 10년 마스터권)',
  student_sub_900: '🎒 스쿨 라운지 (폐지)',
  student_year_9000: '🎒 스쿨 라운지 (폐지)',
  work_soho_9900: '💼 업무 공유 SOHO ~5인 (월 9,900원)',
  work_soho_year_99000: '💼 업무 공유 SOHO ~5인 (99,000원 · 10년 마스터권)',
  work_biz_19900: '💼 업무 공유 소기업 ~20인 (월 19,000원) / 중소기업 ~50인 (월 29,000원)',
  work_biz_year_199000: '💼 업무 공유 기업 (190,000원 / 290,000원 · 10년 마스터권)',
};

export const LoungeModeSwitcherBar: React.FC = () => null;

/**
 * ⛳ 클럽 라운지 (4050 동창회 특화 UX — Warm Light 앨범 프레임 + 1줄 요약 정화 버전)
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
            🏅 김철수 총무님 후원 · 회원 무료
          </span>
          <button
            type="button"
            onClick={() => setShowRetroCover((v) => !v)}
            className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-400 hover:text-white text-[11px] font-bold cursor-pointer"
          >
            {showRetroCover ? '추억 간판 접기 ▴' : '🏫 추억 간판·초대장 열기 ▾'}
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
                🏅 김철수 총무님의 후원으로 회원 전원 무료 운영 중
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
 * 1번 서브메뉴 `[✨ 무료체험]` (정식 구독 활성화 시 메뉴에서 Auto-Hide)
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
  // 개인 라운지 무료체험 상태: 'idle'(실행 전) -> 'running'(진단 중) -> 'done'(진단 완료)
  const [personalTrialStatus, setPersonalTrialStatus] = useState<'idle' | 'running' | 'done'>('idle');
  // 패밀리 / 클럽 / 스쿨 라운지 무료체험 상태 (라운지별 독립 작동)
  const [groupTrialStatus, setGroupTrialStatus] = useState<
    Record<'family' | 'club' | 'student', 'idle' | 'running' | 'done'>
  >({
    family: 'idle',
    club: 'idle',
    student: 'idle',
  });
  // 무료체험 내 안전 검증(정리 대기함 이동 -> 원복 직접 눌러보기) 상태
  const [trialSafetyStep, setTrialSafetyStep] = useState<'ready' | 'quarantined' | 'restored'>('ready');
  const [trialMovedIds, setTrialMovedIds] = useState<string[]>([]);

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

  // 내 기기 전체 보유 파일 모수 (1초 파일 목록 스캔 기준) vs 무료체험 샘플 해부 수량
  const totalDevicePhotos = Math.max(photos.length, 550);
  const totalDeviceVideos = Math.max(videoSceneItems.length, 42);
  const totalDeviceDocs = Math.max(totalDocsCount, 128);
  const trialSampleVideos = 3;
  const trialSamplePhotos = 100;
  const trialSampleDocs = 15;

  // 무료체험 안전 검증: 1단계 [정리(대기함 이동)] 실행
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

  // 무료체험 안전 검증: 2단계 [원복(되돌리기)] 실행
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
      title: '동호회 · 소모임',
      capacity: '인원 무제한 (방 1개)',
      monthly: '월 4,900원',
      yearly: '10년 마스터권 49,000원',
      gpuDaily: '내 기기 원본 동기화 지원',
      monthlyPlanId: 'club_small_4900',
      yearlyPlanId: 'club_small_year_49000',
    },
    {
      id: 'large',
      title: '동창회 · 반창회',
      capacity: '인원 무제한 (방 1개)',
      monthly: '월 4,900원',
      yearly: '10년 마스터권 49,000원',
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
      {/* 📢 공유 라운지 핵심 선언 배너: 내 기기(personal) 내에서는 무료/요금 배너를 띄우지 않음 */}
      {!isStoreAppMode && activeLoungeType !== 'personal' && (
        <section className="p-4 md:p-5 rounded-2xl bg-gradient-to-r from-emerald-950/90 via-teal-950/85 to-zinc-950 border-2 border-emerald-400/60 shadow-[0_0_24px_rgba(16,185,129,0.16)] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-400 text-zinc-950 font-label-sm text-[11px] font-black">
                개인 (기본) : 언제나 0원
              </span>
              <p className="font-headline-sm text-[14.5px] md:text-[16.5px] text-white font-black">
                📢 &ldquo;혼자 쓸 땐 언제나 0원, 함께 쓸 땐 방장 한 분만&rdquo;{' '}
                <span className="text-emerald-300 text-[12.5px] font-bold">
                  (*신용카드 등록도, 광고도 없습니다. 초대받은 가족·회원·직원은 전원 무료입니다.)
                </span>
              </p>
            </div>
            <p className="font-body-sm text-[12.5px] md:text-[13px] text-amber-200 font-extrabold">
              🎁 <strong className="underline decoration-amber-300 text-amber-300">선착순 100명, 10년 방장 마스터권 (월 구독료 10개월 치로 10년 보장)</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowProModal(true)}
            className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-sm text-[12px] font-extrabold shrink-0 cursor-pointer whitespace-nowrap"
          >
            🔥 선착순 100명, 10년 방장 마스터권 보기 →
          </button>
        </section>
      )}

      {/* ─────────────── 💻 내 기기: 1단(온보딩 가로 3열 카드) ➔ 2단(이메일 로그인 즉시 AI 주치의 진단) ➔ 3단(진단 브리핑 결과 & 정리➔원복 안전 검증) ─────────────── */}
      {activeLoungeType === 'personal' && (
        <>
          {/* 1단: 내 기기가 무엇을 하는 곳인지 한눈에 보여주는 가로형 온보딩 카드 */}
          <section className="p-5 md:p-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-primary-container text-zinc-950 font-label-sm text-[11px] font-extrabold">
                  💻 내 기기 — 이메일 로그인만 하면 누구나 바로 AI 주치의 진단 &amp; 1초 투시검색
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-zinc-900 border border-white/10 text-zinc-300 font-label-sm text-[11px] font-bold">
                  🛂 Z-Eye 여권 (Face Passport) · 🔒 로컬 프라이빗 볼트
                </span>
              </div>
              <h1 className="font-headline-md text-[20px] md:text-[22px] text-white font-bold">
                내 기기 — 👁️ Z-Eye 투시검색 · 🩺 Z-Eye 클린 몬스터 · 🛠️ Z-Eye 설정 몬스터
              </h1>
              <p className="font-body-sm text-[13px] text-zinc-400">
                이메일 로그인만 하면 내 기기 안에서 사진·영상·서류를 1초 만에 꿰뚫어 찾는 <strong>👁️ Z-Eye 투시검색</strong>, <strong>🩺 Z-Eye 클린 몬스터 AI 주치의 진단·대화형 정리</strong>, 그리고 <strong>🛠️ Z-Eye 설정 몬스터 1:1 세팅 해결사</strong>를 바로 사용할 수 있습니다.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              <div className="p-4 rounded-xl bg-zinc-950/80 border border-white/10 flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-headline-sm text-[15px] text-white font-bold">
                    👁️ Z-Eye 투시검색
                  </span>
                </div>
                <p className="font-body-sm text-[12.5px] text-zinc-300 leading-relaxed">
                  사진·동영상 프레임별, 모든 서류파일의 내용을 투시하듯 <strong>1초 만에</strong> 찾아주며, <strong>동일 내용 중복 파일 찾아 정리를 도와주며 사진 연사도 쉽게 정리</strong>할 수 있게 하는 최종 진화형 현미안 엔진입니다.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-950/80 border border-white/10 flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-headline-sm text-[15px] text-white font-bold">
                    🩺 Z-Eye 클린 몬스터 (AI 주치의)
                  </span>
                </div>
                <p className="font-body-sm text-[12.5px] text-zinc-300 leading-relaxed">
                  {isStoreAppMode ? (
                    <>
                      내 사진첩 <strong>중복·유사 사진, 영수증·스크린샷·일회성 사물 메모</strong>를 AI 주치의가 정밀 투시 진단하고, <strong>대화형 상담 가이드</strong>를 통해 익숙한 <strong>OS 기본 [휴지통] 정리(+ ↩️ 1초 실행 취소)</strong> 및 PC 마스터 연동을 유저가 직접 결정합니다.
                    </>
                  ) : (
                    <>
                      모바일·PC <strong>바탕화면 정리(쓰레기 아이콘·미사용 앱 분류/동결·어르신 큰 아이콘·PC 중복파일/바로가기 분리)</strong>와 <strong>전기·CPU·메모리 먹는 유령 모듈 제거</strong>를 AI 주치의가 진단하고, <strong>대화형 상담 가이드</strong>로 각 항목을 유저가 직접 결정합니다.
                    </>
                  )}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-950/80 border border-white/10 flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-headline-sm text-[15px] text-white font-bold">
                    🛠️ Z-Eye 설정 몬스터
                  </span>
                </div>
                <p className="font-body-sm text-[12.5px] text-zinc-300 leading-relaxed">
                  핸드폰의 특정 설정이나 앱의 어떤 기능으로 세팅하고자 할 때, 복잡한 기기 설정과 오프라인 서버 릴레이까지 <strong>AI 음성으로 직접 찾아 세팅을 도와주는 1:1 해결사</strong>입니다.
                </p>
              </div>
            </div>
          </section>

          {/* 2단: AI 주치의 진단 (이메일 로그인만 하면 누구나 바로 실행) + 우측 [AI 주치의 진단 시작] / [완료] 버튼 */}
          <section className="p-5 md:p-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-5">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex flex-col gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-headline-sm text-[18px] text-white font-bold">
                    🩺 내 기기 AI 주치의 진단
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-label-sm text-[11.5px] font-bold">
                    ✉️ 이메일 로그인 시 누구나 즉시 진단 가능
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md bg-zinc-900 border border-white/10 text-primary-container font-label-sm text-[11.5px] font-bold">
                    ⏱️ 소요 시간: 약 30초
                  </span>
                </div>

                {/* 내 기기 전체 파일 총량 vs AI 주치의 정밀 진단 범위 */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-[12.5px]">
                  <span className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-white/10 text-zinc-200 whitespace-nowrap">
                    📊 <strong>내 기기 전체 보유량:</strong> 사진 <strong>{totalDevicePhotos}장</strong> · 영상 <strong>{totalDeviceVideos}개</strong> · 문서 <strong>{totalDeviceDocs}건</strong>
                  </span>
                  <span className="hidden sm:inline text-zinc-400 font-bold">➔</span>
                  <span className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-primary-container/40 text-white whitespace-nowrap">
                    🩺 <strong>AI 주치의 1차 진단:</strong> 🎬 영상 <strong>{trialSampleVideos}개 해부</strong> · 🖼️ 사진 <strong>{trialSamplePhotos}장 분석</strong> · 📁 문서 <strong>{trialSampleDocs}건 분석</strong>
                  </span>
                </div>
              </div>

              {/* 우측: 실행 전 [AI 주치의 진단 시작] ➔ 실행 후 [✓ AI 주치의 진단 완료] + [다시 진단하기] */}
              <div className="flex items-center gap-2 shrink-0">
                {personalTrialStatus === 'idle' && (
                  <button
                    type="button"
                    onClick={handleStartPersonalTrial}
                    className="px-6 py-3 rounded-xl bg-primary-container hover:opacity-95 text-zinc-950 font-headline-sm text-[14px] font-extrabold shadow-sm transition-all whitespace-nowrap cursor-pointer"
                  >
                    🩺 AI 주치의 진단 시작
                  </button>
                )}

                {personalTrialStatus === 'running' && (
                  <button
                    type="button"
                    disabled
                    className="px-6 py-3 rounded-xl bg-zinc-800 border border-white/15 text-zinc-300 font-headline-sm text-[14px] font-bold whitespace-nowrap cursor-wait"
                  >
                    ⏳ AI 주치의가 영상 3개 · 사진 100장 · 문서 15건 진단 중...
                  </button>
                )}

                {personalTrialStatus === 'done' && (
                  <>
                    <button
                      type="button"
                      disabled
                      className="px-5 py-2.5 rounded-xl bg-zinc-900 border border-white/15 text-zinc-400 font-label-md text-[13px] font-extrabold whitespace-nowrap cursor-not-allowed opacity-75"
                    >
                      ✓ AI 주치의 진단 완료
                    </button>
                    <button
                      type="button"
                      onClick={handleStartPersonalTrial}
                      className="px-3.5 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-900 border border-white/15 text-primary-container font-label-sm text-[12px] font-bold whitespace-nowrap"
                    >
                      🔄 다시 진단하기
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* 3단: AI 주치의 진단 완료 시 열리는 브리핑 + [정리 ➔ 원복] 안전 검증 */}
            {personalTrialStatus === 'done' ? (
              <div className="pt-4 border-t border-white/10 flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-headline-sm text-[15.5px] text-white font-bold">
                    🩺 1. AI 주치의 정밀 해부 브리핑 (클릭하여 결과 확인)
                  </span>
                  <span className="font-label-mono text-[11.5px] text-emerald-400 font-bold">
                    ✓ 외부 서버 전송 0 Byte (100% 내 기기 로컬 진단)
                  </span>
                </div>

                {/* 전체 모수 vs 무료체험 분석 완료 3열 카드 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  <div
                    onClick={() => {
                      setSearchSpace('video');
                      goToMainFeed();
                    }}
                    className="p-4 rounded-xl bg-zinc-950/90 hover:bg-zinc-900 border border-white/10 hover:border-primary-container/50 cursor-pointer transition-all flex flex-col justify-between gap-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-label-sm text-[11.5px] text-primary-container font-bold">
                        🎬 영상 해부 브리핑
                      </span>
                      <span className="text-[11px] font-mono text-zinc-400 font-bold">
                        전체 {totalDeviceVideos}개 중 {trialSampleVideos}개 해부
                      </span>
                    </div>
                    <div className="font-headline-md text-[21px] text-white font-black">
                      영상 {trialSampleVideos}개 정밀 해부 완료
                    </div>
                    <p className="font-body-sm text-[12px] text-zinc-400">
                      나머지 {totalDeviceVideos - trialSampleVideos}개 영상은 PC 마스터 연결 시 전 구간 자동 해부됩니다.
                    </p>
                    <span className="text-primary-container font-label-sm text-[11.5px] font-bold pt-1">
                      해부된 영상 장면 검색해보기 →
                    </span>
                  </div>

                  <div
                    onClick={() => {
                      setSearchSpace('gallery');
                      goToMainFeed();
                    }}
                    className="p-4 rounded-xl bg-zinc-950/90 hover:bg-zinc-900 border border-white/10 hover:border-primary-container/50 cursor-pointer transition-all flex flex-col justify-between gap-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-label-sm text-[11.5px] text-emerald-400 font-bold">
                        🖼️ 사진 AI 분석 브리핑
                      </span>
                      <span className="text-[11px] font-mono text-zinc-400 font-bold">
                        전체 {totalDevicePhotos}장 중 {trialSamplePhotos}장 분석
                      </span>
                    </div>
                    <div className="font-headline-md text-[21px] text-white font-black">
                      사진 {trialSamplePhotos}장 정밀 분석 완료
                    </div>
                    <p className="font-body-sm text-[12px] text-zinc-400">
                      동일 내용 중복(최고화질 원본 보존) · 연사 1장 직접 선택 부가서비스 지원 (나머지 {totalDevicePhotos - trialSamplePhotos}장 대기)
                    </p>
                    <span className="text-primary-container font-label-sm text-[11.5px] font-bold pt-1">
                      분석된 사진 검색해보기 →
                    </span>
                  </div>

                  <div
                    onClick={() => {
                      setSearchSpace('vault');
                      goToMainFeed();
                    }}
                    className="p-4 rounded-xl bg-zinc-950/90 hover:bg-zinc-900 border border-white/10 hover:border-primary-container/50 cursor-pointer transition-all flex flex-col justify-between gap-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-label-sm text-[11.5px] text-amber-400 font-bold">
                        📁 문서 파일 분석 브리핑
                      </span>
                      <span className="text-[11px] font-mono text-zinc-400 font-bold">
                        전체 {totalDeviceDocs}건 중 {trialSampleDocs}건 분석
                      </span>
                    </div>
                    <div className="font-headline-md text-[21px] text-white font-black">
                      문서 {trialSampleDocs}건 본문 색인 완료
                    </div>
                    <p className="font-body-sm text-[12px] text-zinc-400">
                      계약서·영수증·PDF 핵심 키워드 추출 (나머지 {totalDeviceDocs - trialSampleDocs}건 대기 중)
                    </p>
                    <span className="text-primary-container font-label-sm text-[11.5px] font-bold pt-1">
                      서류함 검색해보기 →
                    </span>
                  </div>
                </div>

                {/* 🛡️ 2. 안전 확인 필수 코스: [정리(OS 기본 휴지통 이동)] 버튼 ➔ [1초 실행 취소(Undo)] 버튼 직접 눌러보기 */}
                <div className="p-4 md:p-5 rounded-xl bg-zinc-950 border border-white/15 flex flex-col gap-3.5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-headline-sm text-[15px] text-white font-bold">
                          🛡️ 2. 안심 안전망 직접 검증 — &lsquo;OS 기본 휴지통 이동&rsquo; 후 &lsquo;1초 실행 취소&rsquo;까지 눌러보세요!
                        </span>
                        <span className="px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[11px] font-extrabold">
                          앱 임의 삭제 0% · OS 기본 [휴지통] 직행 + ↩️ 1초 실행 취소
                        </span>
                      </div>
                      <p className="font-body-sm text-[12.5px] text-zinc-300">
                        별도의 복잡한 보관함 없이 유저가 직접 정리한 항목은 모두 익숙한 <strong>OS 기본 [휴지통]으로 안전하게 이동</strong>하며, 하단 <strong>[↩️ 1초 실행 취소(Undo)]</strong>로 즉시 되돌릴 수 있습니다. 아래 <strong>① 정리 ➔ ② 원복</strong> 버튼을 순서대로 눌러 확인해 보세요.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {/* 1단계: 정리(휴지통 이동) 버튼 */}
                      <button
                        type="button"
                        onClick={() => void handleTrialQuarantineSample()}
                        disabled={trialSafetyStep === 'quarantined'}
                        className={`px-4 py-2.5 rounded-xl font-label-md text-[12.5px] font-extrabold transition-all whitespace-nowrap ${
                          trialSafetyStep === 'quarantined'
                            ? 'bg-zinc-900 border border-white/15 text-zinc-400 cursor-not-allowed'
                            : 'bg-amber-400 hover:bg-amber-300 text-zinc-950 shadow-sm cursor-pointer'
                        }`}
                      >
                        {trialSafetyStep === 'quarantined'
                          ? '✓ ① OS 기본 휴지통 이동됨'
                          : '🗑️ ① 샘플 정리(휴지통 이동) 눌러보기'}
                      </button>

                      {/* 2단계: 원복(되돌리기) 버튼 */}
                      <button
                        type="button"
                        onClick={() => void handleTrialRestoreSample()}
                        disabled={trialSafetyStep !== 'quarantined'}
                        className={`px-4 py-2.5 rounded-xl font-label-md text-[12.5px] font-extrabold transition-all whitespace-nowrap ${
                          trialSafetyStep === 'quarantined'
                            ? 'bg-primary-container hover:opacity-95 text-zinc-950 shadow-md ring-2 ring-primary-container/50 cursor-pointer'
                            : trialSafetyStep === 'restored'
                            ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 cursor-default'
                            : 'bg-zinc-900 border border-white/15 text-zinc-400 cursor-not-allowed opacity-70'
                        }`}
                      >
                        {trialSafetyStep === 'restored'
                          ? '✓ ② 1초 실행 취소 확인 완료!'
                          : '↩️ ② 1초 실행 취소(Undo) 눌러보기'}
                      </button>

                      <button
                        type="button"
                        onClick={() => void openLocalFolder('quarantine')}
                        className="px-3.5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-300 font-label-sm text-[12px] font-bold whitespace-nowrap"
                      >
                        🗑️ 휴지통 확인
                      </button>
                    </div>
                  </div>

                  {trialSafetyStep === 'quarantined' && (
                    <div className="px-3.5 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[12.5px] text-amber-200 flex items-center justify-between gap-2">
                      <span>
                        🗑️ <strong>선택한 샘플 {trialMovedIds.length}건</strong>이 <strong>OS 기본 [휴지통]</strong>으로 안전하게 이동되었습니다. 이제 우측의 <strong>[↩️ ② 1초 실행 취소 눌러보기]</strong> 버튼을 눌러보세요!
                      </span>
                    </div>
                  )}

                  {trialSafetyStep === 'restored' && (
                    <div className="px-3.5 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[12.5px] text-emerald-300 flex items-center justify-between gap-2">
                      <span>
                        ✅ <strong>[1초 실행 취소 검증 완료!]</strong> 방금 정리했던 파일들이 원래 폴더로 100% 되돌아왔습니다. 실수로 지워질 걱정 없이 안심하고 정리하세요!
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setDesktopTab('trash');
                          setMobileTab('trash');
                        }}
                        className="px-3 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-primary-container font-label-sm text-[11.5px] font-bold whitespace-nowrap"
                      >
                        🩺 Z-Eye 클린 몬스터 이동 →
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="px-4 py-3 rounded-xl bg-zinc-950/70 border border-white/10 flex items-center justify-between gap-2">
                <span className="font-body-sm text-[12.5px] text-zinc-400">
                  💡 이메일 로그인만 하면 누구나 바로 우측의 <strong>[🩺 AI 주치의 진단 시작]</strong> 버튼을 눌러 <strong>영상 3개 해부 · 사진 100장 분석 · 문서 15건 분석</strong> 브리핑과 함께 <strong>[정리 ➔ 원복 안전 검증]</strong>을 실행할 수 있습니다.
                </span>
              </div>
            )}

            {/* 내 기기 하단: 무료/요금 관련 문구 없이 3대 기능 바로가기만 깔끔하게 배치 (스토어 클린 모드 시 PC 연동 패널 노출) */}
            {isStoreAppMode ? (
              <div className="pt-3 border-t border-white/10">
                <PcMasterQuickSendPanel />
              </div>
            ) : (
              <div className="pt-4 border-t border-white/10 flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-headline-sm text-[15px] text-white font-bold">
                    ⚡ 내 기기 3대 AI 주치의 &amp; 투시검색 바로가기
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* 1. 👁️ Z-Eye 투시검색 */}
                  <div className="p-5 rounded-xl bg-zinc-900 border border-primary-container/50 flex flex-col justify-between gap-4">
                    <div className="flex flex-col gap-1.5">
                      <span className="font-label-sm text-[11.5px] text-primary-container font-bold">
                        👁️ Z-Eye 투시검색
                      </span>
                      <div className="font-headline-md text-[19px] text-white font-black">
                        사진 · 영상 · 서류 1초 투시검색
                      </div>
                      <p className="font-body-sm text-[12px] text-zinc-300 leading-relaxed">
                        사진·동영상 프레임별, 모든 서류파일의 내용을 투시하듯 <strong>1초 만에</strong> 찾아주며, <strong>동일 내용 중복 파일 및 사진 연사 정리</strong>를 지원합니다.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDesktopTab('dashboard');
                        setMobileTab('search');
                      }}
                      className="w-full py-2.5 rounded-xl bg-primary-container text-zinc-950 font-label-md text-[12px] font-extrabold whitespace-nowrap cursor-pointer"
                    >
                      👁️ Z-Eye 투시검색 바로가기
                    </button>
                  </div>

                  {/* 2. 🩺 Z-Eye 클린 몬스터 */}
                  <div className="p-5 rounded-xl bg-zinc-950/80 border border-white/10 flex flex-col justify-between gap-4">
                    <div className="flex flex-col gap-1.5">
                      <span className="font-label-sm text-[11.5px] text-amber-400 font-bold">
                        🩺 Z-Eye 클린 몬스터 — AI 주치의 진단 &amp; 대화형 정리
                      </span>
                      <div className="font-headline-md text-[19px] text-white font-black">
                        내 기기 AI 주치의 검진 &amp; 정리
                      </div>
                      <p className="font-body-sm text-[12px] text-zinc-400 leading-relaxed">
                        모바일·PC 바탕화면 정리(미사용 앱 분류/동결·어르신 큰 아이콘·PC 중복파일 및 바로가기 분리) + 전기 먹는 유령 모듈 제거 및 AI 주치의 대화형 컨설팅 (OS 기본 [휴지통] + ↩️ 1초 실행 취소 보장).
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDesktopTab('trash');
                        setMobileTab('trash');
                      }}
                      className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-white/15 text-white font-label-md text-[12px] font-bold transition-colors whitespace-nowrap cursor-pointer"
                    >
                      🩺 Z-Eye 클린 몬스터 바로가기
                    </button>
                  </div>

                  {/* 3. 🛠️ Z-Eye 설정 몬스터 */}
                  <div className="p-5 rounded-xl bg-zinc-950/80 border border-white/10 flex flex-col justify-between gap-4">
                    <div className="flex flex-col gap-1.5">
                      <span className="font-label-sm text-[11.5px] text-emerald-400 font-bold">
                        🛠️ Z-Eye 설정 몬스터 — AI 스마트폰 &amp; PC 통합 설정 해결사
                      </span>
                      <div className="font-headline-md text-[19px] text-white font-black">
                        원클릭 수리 &amp; 화살표 동행 안내
                      </div>
                      <p className="font-body-sm text-[12px] text-zinc-400 leading-relaxed">
                        일상어로 대화하면 AI가 <strong>PC·스마트폰 설정을 1초 만에 직접 고쳐주거나 화면 위 손가락 화살표(👆)를 띄워 동행 안내</strong>하고, 0.01초 전 스냅샷으로 1초 원상복구까지 보장합니다.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDesktopTab('sync');
                        setMobileTab('settings');
                      }}
                      className="w-full py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-300 font-label-md text-[12px] font-extrabold transition-colors whitespace-nowrap cursor-pointer"
                    >
                      🛠️ Z-Eye 설정 몬스터 열기
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {/* ─────────────── 👨‍👩‍👧‍👦 패밀리 라운지: 1단(온보딩 가로 3열 카드) ➔ 2단(무료체험 안내 + 시작/완료 버튼) ➔ 3단(얼굴 여권 & 3초 레이더 수합 체험 + 요금제) ─────────────── */}
      {activeLoungeType === 'family' && (
        <>
          {/* 1단: 패밀리 라운지가 무엇을 하는 곳인지 한눈에 보여주는 가로형 온보딩 카드 */}
          <section className="p-5 md:p-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="font-headline-md text-[20px] md:text-[22px] text-white font-bold">
                  👨‍👩‍👧‍👦 패밀리 라운지 — 양가 분리 가족 사진관 (마스터 1인 결제 ➔ 가족 전원 무료)
                </h1>
                <p className="font-body-sm text-[13px] text-zinc-400 mt-1">
                  사생활 혼선 없이 <strong>[우리집] · [본가(친가)] · [처가(친정)]</strong> 방을 분리하고, 카톡 링크 하나로 가족 스마트폰에서 함께 찍힌 사진만 3초 만에 자동 수합합니다.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {FAMILY_ROOMS.map((room) => (
                  <button
                    key={room}
                    type="button"
                    onClick={() => setActiveFamilyRoom(room)}
                    className={`px-3 py-1 rounded-lg font-label-sm text-[11.5px] font-bold border transition-all ${
                      activeFamilyRoom === room
                        ? 'bg-primary-container text-zinc-950 border-primary-container font-extrabold'
                        : 'bg-zinc-900 text-zinc-300 border-white/10 hover:bg-zinc-800'
                    }`}
                  >
                    {room === '우리집' ? '🏠 우리집' : room === '본가(친가)' ? '🏡 본가(친가)' : '🌸 처가(친정)'}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
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
          </section>

          {/* 2단: 패밀리 라운지 무료체험 안내 + 우측 [무료체험 시작] / [완료] 버튼 */}
          <section className="p-5 md:p-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-5">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex flex-col gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-headline-sm text-[18px] text-white font-bold">
                    ✨ 패밀리 라운지 무료체험 — 가족 얼굴 여권 &amp; 3초 레이더 수합
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-md bg-zinc-900 border border-white/10 text-primary-container font-label-sm text-[11.5px] font-bold">
                    ⏱️ 소요 시간: 약 20초
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-[12.5px]">
                  <span className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-white/10 text-zinc-200 whitespace-nowrap">
                    📊 <strong>감지된 가족 인물:</strong> 전체 <strong>{activeClusters.length}명</strong> (이름 등록 <strong>{namedClusters.length}명</strong>)
                  </span>
                  <span className="hidden sm:inline text-zinc-400 font-bold">➔</span>
                  <span className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-primary-container/40 text-white whitespace-nowrap">
                    🔬 <strong>무료체험 범위:</strong> 🛂 가족 얼굴 여권 등록 · 📡 가족 폰 3초 레이더 스캔 <strong>최대 10장 수합 맛보기</strong>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {groupTrialStatus.family === 'idle' && (
                  <button
                    type="button"
                    onClick={() => handleStartGroupTrial('family')}
                    className="px-6 py-3 rounded-xl bg-primary-container hover:opacity-95 text-zinc-950 font-headline-sm text-[14px] font-extrabold shadow-sm transition-all whitespace-nowrap cursor-pointer"
                  >
                    🚀 무료체험 시작
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
                  <>
                    <button
                      type="button"
                      disabled
                      className="px-5 py-2.5 rounded-xl bg-zinc-900 border border-white/15 text-zinc-400 font-label-md text-[13px] font-extrabold whitespace-nowrap cursor-not-allowed opacity-75"
                    >
                      ✓ 무료체험 완료
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStartGroupTrial('family')}
                      className="px-3.5 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-900 border border-white/15 text-primary-container font-label-sm text-[12px] font-bold whitespace-nowrap"
                    >
                      🔄 다시 체험하기
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* 3단: 무료체험 완료 시 열리는 가족 여권 등록 & 3초 레이더 수합 보드 */}
            {groupTrialStatus.family === 'done' ? (
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
            ) : (
              <div className="px-4 py-3 rounded-xl bg-zinc-950/70 border border-white/10 flex items-center justify-between gap-2">
                <span className="font-body-sm text-[12.5px] text-zinc-400">
                  💡 우측의 <strong>[🚀 무료체험 시작]</strong> 버튼을 누르면 가족 대표 사진에서 얼굴을 추출해 이름을 붙이고, 카톡 초대 <strong>3초 레이더 스캔(10장 무료 수합)</strong>을 바로 체험해 보실 수 있습니다.
                </span>
              </div>
            )}

            {/* 패밀리 라운지 하단: 스토어 클린 모드 시 [내 이메일/카톡으로 PC 마스터 주소 보내기] 노출 / PC 마스터 모드 시 요금제 노출 */}
            {isStoreAppMode ? (
              <div className="pt-3 border-t border-white/10">
                <PcMasterQuickSendPanel />
              </div>
            ) : (
              <div className="flex flex-col gap-3.5 pt-3 border-t border-white/10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 rounded-xl bg-zinc-950/80 border border-white/10 flex flex-col justify-between gap-4">
                    <div className="flex flex-col gap-1.5">
                      <span className="font-label-sm text-[11.5px] text-zinc-300 font-bold">
                        🏠 우리집 단독 — 우리집 전용 시크릿 라운지 (방 1개 · 가족 인원 무제한)
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className="font-headline-md text-[24px] text-white font-black">
                          월 5,900원
                        </span>
                        <span className="font-label-mono text-[13px] text-amber-300 font-bold">
                          (10년 마스터권 59,000원)
                        </span>
                      </div>
                      <p className="font-body-sm text-[12px] text-zinc-400">
                        부부·자녀가 찍은 모든 사진·영상을 방장 PC로 안전하게 모으고 가족 전원 스마트폰에서 1초 실명 검색
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => activatePricingPlan('family_home_5900')}
                        className="py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-white/15 text-white font-label-md text-[12.5px] font-bold cursor-pointer"
                      >
                        월 5,900원 시작
                      </button>
                      <button
                        type="button"
                        onClick={() => activatePricingPlan('family_home_year_59000')}
                        className="py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-md text-[12.5px] font-extrabold cursor-pointer"
                      >
                        10년권 59,000원
                      </button>
                    </div>
                  </div>

                  <div className="p-5 rounded-xl bg-zinc-900 border border-primary-container/50 flex flex-col justify-between gap-4">
                    <div className="flex flex-col gap-1.5">
                      <span className="font-label-sm text-[11.5px] text-primary-container font-bold">
                        👨‍👩‍👧‍👦 양가 통합권 — 우리집 + 본가(친가) + 처가(친정) 3개 방 분리 제공
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className="font-headline-md text-[24px] text-white font-black">
                          월 8,900원
                        </span>
                        <span className="font-label-mono text-[13px] text-amber-300 font-bold">
                          (10년 마스터권 89,000원)
                        </span>
                      </div>
                      <p className="font-body-sm text-[12px] text-zinc-300">
                        사생활 혼선 없이 [우리집] · [본가(친가)] · [처가(친정)] 3개 방을 완벽히 분리 제공하며 손주·가족 사진을 원하는 방에만 자동 배포합니다.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => activatePricingPlan('family_three_8900')}
                        className="py-2.5 rounded-xl bg-primary-container text-zinc-950 font-label-md text-[12.5px] font-extrabold cursor-pointer"
                      >
                        양가 3방 월 8,900원
                      </button>
                      <button
                        type="button"
                        onClick={() => activatePricingPlan('family_three_year_89000')}
                        className="py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-md text-[12.5px] font-extrabold cursor-pointer"
                      >
                        10년권 89,000원
                      </button>
                    </div>
                  </div>
                </div>

                {/* 가족 라운지 연 구독(마스터권) 특전: 모임 라운지 3개월 무료 구독권 1장 */}
                <div className="p-3.5 rounded-xl bg-primary-container/10 border border-primary-container/35 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[12px] text-emerald-200 font-medium">
                    🎁 <strong>[가족방 연 구독 특전]</strong> 패밀리 연 구독(10년 마스터권 59,000원 / 89,000원) 결제 시 <strong>[모임(동호회·동창회) 라운지 3개월 무료 구독권 1장]</strong>을 증정합니다!
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowProModal(true)}
                    className="px-3 py-1.5 rounded-lg bg-primary-container text-zinc-950 font-label-sm text-[11.5px] font-extrabold cursor-pointer shrink-0"
                  >
                    💌 모임 3개월 무료권 안내 보기
                  </button>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {/* ─────────────── ⛳ 클럽 라운지: 1단(온보딩 가로 3열 카드) ➔ 2단(무료체험 안내 + 시작/완료 버튼) ➔ 3단(얼굴 여권 & 3초 레이더 수합 체험 + 요금제) ─────────────── */}
      {activeLoungeType === 'club' && (
        <>
          {/* 1단: 클럽 라운지가 무엇을 하는 곳인지 한눈에 보여주는 가로형 온보딩 카드 */}
          <section className="p-5 md:p-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-4">
            <div>
              <h1 className="font-headline-md text-[20px] md:text-[22px] text-white font-bold">
                ⛳ 클럽 라운지 — 4050 동창회 · 골프 · 산악회 {isStoreAppMode ? '(PC 마스터 연동 전 회원 무료 열람)' : '(총무 1인 결제 ➔ 전 회원 무료)'}
              </h1>
              <p className="font-body-sm text-[13px] text-zinc-400 mt-1">
                동창회·모임 총무(👑 방장) PC 마스터 연동으로 회원 전원이 폰 용량 걱정 없이 <strong>13KB 초경량 썸네일 탐색</strong>과 <strong>내 기기 원본 동기화 자체 해결</strong>을 누립니다.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
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
          </section>

          {/* 2단: 클럽 라운지 무료체험 안내 + 우측 [무료체험 시작] / [완료] 버튼 */}
          <section className="p-5 md:p-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-5">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex flex-col gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-headline-sm text-[18px] text-white font-bold">
                    ✨ 클럽 라운지 무료체험 — 동창·회원 얼굴 여권 &amp; 3초 레이더 수합
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-md bg-zinc-900 border border-white/10 text-primary-container font-label-sm text-[11.5px] font-bold">
                    ⏱️ 소요 시간: 약 20초
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-[12.5px]">
                  <span className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-white/10 text-zinc-200 whitespace-nowrap">
                    📊 <strong>감지된 모임 회원:</strong> 전체 <strong>{activeClusters.length}명</strong> (실명·별명 등록 <strong>{namedClusters.length}명</strong>)
                  </span>
                  <span className="hidden sm:inline text-zinc-400 font-bold">➔</span>
                  <span className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-primary-container/40 text-white whitespace-nowrap">
                    🔬 <strong>무료체험 범위:</strong> 🛂 회원 얼굴 여권 등록 · 📡 총무 카톡 초대 <strong>3초 레이더 10장 수합 맛보기</strong>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {groupTrialStatus.club === 'idle' && (
                  <button
                    type="button"
                    onClick={() => handleStartGroupTrial('club')}
                    className="px-6 py-3 rounded-xl bg-primary-container hover:opacity-95 text-zinc-950 font-headline-sm text-[14px] font-extrabold shadow-sm transition-all whitespace-nowrap cursor-pointer"
                  >
                    🚀 무료체험 시작
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
                  <>
                    <button
                      type="button"
                      disabled
                      className="px-5 py-2.5 rounded-xl bg-zinc-900 border border-white/15 text-zinc-400 font-label-md text-[13px] font-extrabold whitespace-nowrap cursor-not-allowed opacity-75"
                    >
                      ✓ 무료체험 완료
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStartGroupTrial('club')}
                      className="px-3.5 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-900 border border-white/15 text-primary-container font-label-sm text-[12px] font-bold whitespace-nowrap"
                    >
                      🔄 다시 체험하기
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* 3단: 무료체험 완료 시 열리는 회원 여권 등록 & 3초 레이더 수합 보드 */}
            {groupTrialStatus.club === 'done' ? (
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
            ) : (
              <div className="px-4 py-3 rounded-xl bg-zinc-950/70 border border-white/10 flex items-center justify-between gap-2">
                <span className="font-body-sm text-[12.5px] text-zinc-400">
                  💡 우측의 <strong>[🚀 무료체험 시작]</strong> 버튼을 누르면 단체 사진에서 회원 얼굴을 추출해 실명·별명을 등록하고, 단톡방 <strong>3초 레이더 스캔(10장 무료 수합)</strong>을 바로 체험해 보실 수 있습니다.
                </span>
              </div>
            )}

            {/* 클럽 라운지 하단: 스토어 클린 모드 시 [내 이메일/카톡으로 PC 마스터 주소 보내기] 노출 / PC 마스터 모드 시 4,900원 단일가 요금제 노출 */}
            {isStoreAppMode ? (
              <div className="pt-3 border-t border-white/10">
                <PcMasterQuickSendPanel />
              </div>
            ) : (
              <div className="flex flex-col gap-3.5 pt-3 border-t border-white/10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 동호회·소모임 단일가 */}
                  <div className="p-5 rounded-xl bg-zinc-950/90 border border-white/10 flex flex-col justify-between gap-4">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-label-sm text-[12px] text-primary-container font-extrabold">
                          ⛳ 동호회 · 소모임 (모임 이름 문패)
                        </span>
                        <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 text-[10.5px] font-bold">
                          인원수 무제한 · 회원 전원 무료
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2 mt-0.5">
                        <span className="font-headline-md text-[24px] text-white font-black">
                          월 4,900원
                        </span>
                        <span className="font-label-mono text-[13px] text-amber-300 font-bold">
                          (10년 마스터권 49,000원)
                        </span>
                      </div>
                      <p className="font-body-sm text-[12px] text-zinc-300">
                        골프·산악회·독서·조기축구 등 모임 인원이 10명이든 500명이든 추가 요금 없이 월 4,900원 단일가!
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => activatePricingPlan('club_small_4900')}
                        className="py-2.5 rounded-xl bg-primary-container text-zinc-950 font-label-md text-[12.5px] font-extrabold cursor-pointer"
                      >
                        월 4,900원 개설
                      </button>
                      <button
                        type="button"
                        onClick={() => activatePricingPlan('club_small_year_49000')}
                        className="py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-md text-[12.5px] font-extrabold cursor-pointer"
                      >
                        10년권 49,000원
                      </button>
                    </div>
                  </div>

                  {/* 동창회·반창회 단일가 */}
                  <div className="p-5 rounded-xl bg-zinc-900 border border-amber-400/50 flex flex-col justify-between gap-4">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-label-sm text-[12px] text-amber-300 font-extrabold">
                          🎓 동창회 · 반창회 (학교/학년/반 문패)
                        </span>
                        <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 text-[10.5px] font-bold">
                          인원수 무제한 · 동창 전원 무료
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2 mt-0.5">
                        <span className="font-headline-md text-[24px] text-white font-black">
                          월 4,900원
                        </span>
                        <span className="font-label-mono text-[13px] text-amber-300 font-bold">
                          (10년 마스터권 49,000원)
                        </span>
                      </div>
                      <p className="font-body-sm text-[12px] text-zinc-300">
                        졸업앨범 아날로그 스캔 사진 복원 + 학창시절 내 얼굴 1초 찾기 &amp; 총무 명예의 전당 헌정 배지!
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => activatePricingPlan('club_small_4900')}
                        className="py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-white/15 text-white font-label-md text-[12.5px] font-bold cursor-pointer"
                      >
                        월 4,900원 개설
                      </button>
                      <button
                        type="button"
                        onClick={() => activatePricingPlan('club_small_year_49000')}
                        className="py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-md text-[12.5px] font-extrabold cursor-pointer"
                      >
                        10년권 49,000원
                      </button>
                    </div>
                  </div>
                </div>

                {/* 모임 라운지 연 구독(마스터권) 특전: 가족 라운지 1개월 무료 구독권 3장 */}
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-400/35 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[12px] text-amber-200 font-medium">
                    🎁 <strong>[모임방 연 구독 특전]</strong> 동호회·동창회 연 구독(10년 마스터권 49,000원) 결제 시 총무님께 <strong>[가족 라운지 1개월 무료 구독권 3장]</strong>을 즉시 증정합니다!
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowProModal(true)}
                    className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-sm text-[11.5px] font-extrabold cursor-pointer shrink-0"
                  >
                    💌 가족방 1개월권 3장 안내 보기
                  </button>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {/* ─────────────── 🎒 스쿨 라운지: 1단(온보딩 가로 3열 카드) ➔ 2단(무료체험 안내 + 시작/완료 버튼) ➔ 3단(얼굴 여권 & 3초 레이더 수합 체험 + 요금제) ─────────────── */}
      {activeLoungeType === 'student' && (
        <>
          {/* 1단: 스쿨 라운지가 무엇을 하는 곳인지 한눈에 보여주는 가로형 온보딩 카드 */}
          <section className="p-5 md:p-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-4">
            <div>
              <h1 className="font-headline-md text-[20px] md:text-[22px] text-white font-bold">
                🎒 스쿨 라운지 — 초·중·고 학급 · 동아리 · 체육대회 {isStoreAppMode ? '(우리 반 전원 무료 타임캡슐)' : '(월 900원 단일 특가)'}
              </h1>
              <p className="font-body-sm text-[13px] text-zinc-400 mt-1">
                {isStoreAppMode ? (
                  <>
                    학생증 로컬 0.1초 인증과 방장 집 게이밍 PC 연동만으로 반 친구들 전원이 무료로 수련회·체육대회·축제 사진을 1초 만에 찾습니다.
                  </>
                ) : (
                  <>
                    학생증 로컬 0.1초 인증만으로 학급·동아리 인원수 상관없이 <strong>월 900원(연 9,000원)</strong>! 반 친구들 전원이 무료로 수련회·축제 사진을 1초 만에 찾습니다.
                  </>
                )}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
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
                    ? '30명 학급이든 100명 동아리든 인원 제한 없이 연결! 무료체험 10장 한도 도달 시 방장에게 집 게이밍 PC 설치 알림을 보낼 수 있습니다.'
                    : '30명 학급이든 100명 동아리든 인원 제한 없이 월 900원! 무료체험 10장 한도 도달 시 방장에게 집 게이밍 PC 설치 알림을 보낼 수 있습니다.'}
                </p>
              </div>
            </div>
          </section>

          {/* 2단: 스쿨 라운지 무료체험 안내 + 우측 [무료체험 시작] / [완료] 버튼 */}
          <section className="p-5 md:p-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-5">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex flex-col gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-headline-sm text-[18px] text-white font-bold">
                    ✨ 스쿨 라운지 무료체험 — 우리 반 얼굴 여권 &amp; 10장 레이더 수합
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-md bg-zinc-900 border border-white/10 text-primary-container font-label-sm text-[11.5px] font-bold">
                    ⏱️ 소요 시간: 약 20초
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-[12.5px]">
                  <span className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-white/10 text-zinc-200 whitespace-nowrap">
                    📊 <strong>감지된 우리 반 친구:</strong> 전체 <strong>{activeClusters.length}명</strong> (이름·별명 등록 <strong>{namedClusters.length}명</strong>)
                  </span>
                  <span className="hidden sm:inline text-zinc-400 font-bold">➔</span>
                  <span className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-primary-container/40 text-white whitespace-nowrap">
                    🔬 <strong>무료체험 범위:</strong> 🛂 친구 얼굴 여권 등록 · 📡 반 단톡방 <strong>3초 레이더 10장 수합 &amp; 방장 콕 찌르기</strong>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {groupTrialStatus.student === 'idle' && (
                  <button
                    type="button"
                    onClick={() => handleStartGroupTrial('student')}
                    className="px-6 py-3 rounded-xl bg-primary-container hover:opacity-95 text-zinc-950 font-headline-sm text-[14px] font-extrabold shadow-sm transition-all whitespace-nowrap cursor-pointer"
                  >
                    🚀 무료체험 시작
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
                  <>
                    <button
                      type="button"
                      disabled
                      className="px-5 py-2.5 rounded-xl bg-zinc-900 border border-white/15 text-zinc-400 font-label-md text-[13px] font-extrabold whitespace-nowrap cursor-not-allowed opacity-75"
                    >
                      ✓ 무료체험 완료
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStartGroupTrial('student')}
                      className="px-3.5 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-900 border border-white/15 text-primary-container font-label-sm text-[12px] font-bold whitespace-nowrap"
                    >
                      🔄 다시 체험하기
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* 3단: 무료체험 완료 시 열리는 반 친구 여권 등록 & 3초 레이더 수합 보드 */}
            {groupTrialStatus.student === 'done' ? (
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
            ) : (
              <div className="px-4 py-3 rounded-xl bg-zinc-950/70 border border-white/10 flex items-center justify-between gap-2">
                <span className="font-body-sm text-[12.5px] text-zinc-400">
                  💡 우측의 <strong>[🚀 무료체험 시작]</strong> 버튼을 누르면 우리 반 단체 사진에서 친구 얼굴을 추출해 이름·별명을 등록하고, <strong>3초 레이더 스캔(10장 무료 수합)</strong>을 바로 체험해 보실 수 있습니다.
                </span>
              </div>
            )}

            {/* 스쿨 라운지 하단: 스토어 클린 모드 시 [내 이메일/카톡으로 PC 마스터 주소 보내기] 노출 / PC 마스터 모드 시 요금제 노출 */}
            {isStoreAppMode ? (
              <div className="pt-3 border-t border-white/10">
                <PcMasterQuickSendPanel />
              </div>
            ) : (
              <div className="p-5 rounded-xl bg-zinc-900 border border-primary-container/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded bg-primary-container text-zinc-950 font-label-sm text-[11px] font-extrabold">
                      초·중·고 반/동아리 특가 월 900원
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
                        : '🔒 학생증 로컬 OCR 0.1초 인증 대기'}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="font-headline-md text-[26px] text-white font-black">
                      월 900원
                    </span>
                    <span className="font-label-mono text-[14px] text-primary-container font-bold">
                      (연 9,000원 · 인원 제한 없음)
                    </span>
                  </div>
                  <p className="font-body-sm text-[12px] text-zinc-300">
                    학생증 사진 1장을 로컬 RAM에서 0.1초 OCR 판독 후 즉시 폐기하여 개인정보 유출 걱정이 없습니다.
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
                    월 900원 개설
                  </button>
                  <button
                    type="button"
                    onClick={() => activatePricingPlan('student_year_9000')}
                    className="px-4 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-white/15 text-zinc-200 font-label-md text-[12.5px] font-bold"
                  >
                    연 9,000원 개설
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

interface WorkLoungeDocItem {
  id: string;
  folderId: string;
  folderPath: string;
  fileName: string;
  ext: string;
  sizeLabel: string;
  updatedAt: string;
  author: string;
  lockedBy: string | null;
  cacheSizeLabel: string;
  summaryTitle: string;
  matchedSnippet: string;
  tableHeaders: string[];
  tableRows: string[][];
  fullTextPreview: string;
  isImage?: boolean;
  imageBase64?: string;
}

const WORK_LOUNGE_FOLDERS = [
  { id: 'all', name: 'S:\\ (업무 드라이브 전체)', count: 6, path: 'S:\\' },
  { id: 'root', name: 'S:\\ 루트 (최상단 파일)', count: 1, path: 'S:\\' },
  { id: 'contracts', name: '01_계약서_법무문서', count: 2, path: 'S:\\01_계약서_법무문서' },
  { id: 'quotes', name: '02_견적서_단가표_엑셀', count: 2, path: 'S:\\02_견적서_단가표_엑셀' },
  { id: 'tax', name: '03_세금계산서_회계증빙', count: 1, path: 'S:\\03_세금계산서_회계증빙' },
  { id: 'site', name: '04_현장시공_도면_미디어', count: 1, path: 'S:\\04_현장시공_도면_미디어' },
];

const INITIAL_WORK_DOCS: WorkLoungeDocItem[] = [
  {
    id: 'work-doc-1',
    folderId: 'quotes',
    folderPath: 'S:\\02_견적서_단가표_엑셀',
    fileName: '2026_상반기_을지로현장_실내건축_표준단가표_v4.xlsx',
    ext: 'XLSX',
    sizeLabel: '4.8 MB',
    updatedAt: '방금 전 (14:22)',
    author: '박과장 (공무팀)',
    lockedBy: '박과장',
    cacheSizeLabel: '29.4 KB 선행 캐싱됨',
    summaryTitle: '[엑셀 시트 1~3 통합 투시 요약] 을지로 오피스 리모델링 철거·목공·전기 공정별 일위대가 및 협력사 네고 단가표',
    matchedSnippet:
      '표(Sheet2_철거단가) C14셀: "야간 방음 가설벽 설치 및 폐기물 반출 일식 — 단가 4,850,000원 (부자재 포함, 안전관리비 8% 별도)"',
    tableHeaders: ['공종 코드', '세부 내역 (규격)', '단위', '2026 표준 단가', '비고 / 협력사'],
    tableRows: [
      ['DEM-101', '야간 방음 가설벽 설치 및 철거 반출', '일식', '4,850,000원', '성수건업 (야간 할증 포함)'],
      ['CAR-204', '친환경 방염 석고보드 2P 시공 (9.5T)', '㎡', '38,500원', 'KCC 방염 인증필'],
      ['ELC-309', '회의실 라인조명 매립 타공 및 배선', 'M', '64,000원', 'SMPS 안정기 별도'],
      ['TOT-999', '총 직접공사비 합계 (VAT 별도)', '식', '68,420,000원', '대표님 결재 완료 (10% 네고 반영)'],
    ],
    fullTextPreview:
      '1. 현장명: 을지로 3가 프라임타워 8층 오피스 인테리어 공사\n2. 발주처: (주)메타솔루션파트너스 / 담당: 이팀장\n3. 핵심 특기사항: 주간 소음 민원으로 인해 철거 및 폐기물 반출은 금요일 22:00 ~ 일요일 18:00 야간 집중 공정으로 진행함. 단가표 Sheet 2의 C14~F18 구간에 협력사 네고 단가(-7.5%)가 최종 반영되어 있음.',
  },
  {
    id: 'work-doc-2',
    folderId: 'contracts',
    folderPath: 'S:\\01_계약서_법무문서',
    fileName: '2026_외주개발_및_유지보수_표준도급계약서_최종.docx',
    ext: 'DOCX',
    sizeLabel: '2.1 MB',
    updatedAt: '오늘 11:40',
    author: '이팀장 (전략기획)',
    lockedBy: '이팀장',
    cacheSizeLabel: '28.1 KB 선행 캐싱됨',
    summaryTitle: '[계약서 본문 + 별첨 과업지시서 투시 요약] 제14조 지체상금(1일 0.15%) 및 제19조 지식재산권 공동귀속 특약 조항',
    matchedSnippet:
      '본문 제14조(지체상금 및 위약금) 제2항: "을이 정당한 사유 없이 납기를 지연할 경우 매 지체일수당 계약금액의 1,000분의 1.5(0.15%)를 공제하며, 최대 한도는 총 계약금액의 10%로 한다."',
    tableHeaders: ['조항', '핵심 규정 항목', '적용 기준 / 비율', '법무 검토 의견'],
    tableRows: [
      ['제4조 (대금지급)', '선금 30% / 중도금 40% / 잔금 30%', '검수 완료 후 7영업일 이내 현금', '적정 (표준하도급 준수)'],
      ['제14조 (지체상금)', '납기 지연 시 일할 위약금', '1일당 0.15% (상한 10%)', '특약 반영 완료'],
      ['제19조 (지재권)', '산출물 원본 소스코드 및 특허권', '갑·을 공동 소유 (제3자 라이선스 제한)', '대표님 확인 필'],
    ],
    fullTextPreview:
      '제1조(목적) 본 계약은 갑이 위탁하는 클라우드 대체형 로컬 P2P 문서 검색 인프라 구축 과업을 을이 수행함에 있어 필요한 권리·의무를 규정한다.\n제14조(지체상금) 납기 지연 시 일 0.15%를 적용하되, 갑의 요구사항 변경으로 인한 일정 연장은 지체일수에서 제외한다.\n제21조(하자보수) 무상 하자보수 기간은 최종 검수 완료일로부터 12개월로 한다.',
  },
  {
    id: 'work-doc-3',
    folderId: 'tax',
    folderPath: 'S:\\03_세금계산서_회계증빙',
    fileName: '2026_3분기_거래처별_미수금_및_세금계산서_정산원장.xlsx',
    ext: 'XLSX',
    sizeLabel: '6.4 MB',
    updatedAt: '어제 18:15',
    author: '정실장 (재무회계)',
    lockedBy: null,
    cacheSizeLabel: '30.0 KB 선행 캐싱됨',
    summaryTitle: '[회계원장 시트 투시 요약] 3분기 전자세금계산서 발행분 18건 중 미수금 2건(한빛테크·청담디자인) 입금 독촉 일정',
    matchedSnippet:
      '표(3Q_미수금현황) 행 8~9: "(주)한빛테크 잔금 13,200,000원 (세금계산서 09/25 발행, 입금약정일 10/25) · 청담디자인스튜디오 5,500,000원 (10/20 입금예정)"',
    tableHeaders: ['거래처명', '품목 / 프로젝트', '공급가액 (VAT포함)', '계산서 발행일', '수금 상태'],
    tableRows: [
      ['(주)한빛테크', '본사 서버랙 및 내부망 구축 잔금', '13,200,000원', '2026-09-25', '미수 (10/25 입금약정)'],
      ['청담디자인스튜디오', '브랜드 쇼룸 영상 납품 중도금', '5,500,000원', '2026-09-30', '미수 (10/20 입금예정)'],
      ['성동메디컬의원', '원내 안내 키오스크 납품 완납', '24,200,000원', '2026-09-12', '수금완료 (09/18)'],
    ],
    fullTextPreview:
      '■ 2026년 3분기 매출 세금계산서 총괄: 총 발행액 1억 8,450만 원 중 수금 완료 1억 6,580만 원 (수금률 89.8%).\n■ 미수 거래처 조치 내역: 한빛테크 재무팀 김차장 통화 완료(10월 25일 정기결제일 전액 입금 확정), 청담디자인스튜디오는 금주 금요일 오전 입금 예정.',
  },
  {
    id: 'work-doc-4',
    folderId: 'contracts',
    folderPath: 'S:\\01_계약서_법무문서',
    fileName: '2026_신규입사자_표준근로계약서_및_비밀유지서약서(NDA).hwp',
    ext: 'HWP',
    sizeLabel: '1.4 MB',
    updatedAt: '2026-10-16',
    author: '정실장 (인사총무)',
    lockedBy: null,
    cacheSizeLabel: '26.8 KB 선행 캐싱됨',
    summaryTitle: '[한글(HWP) 본문 투시 요약] 포괄산정 연장근로수당 기준, 식대 비과세 20만 원 항목 및 영업비밀 보호 특약',
    matchedSnippet:
      '제6조(임금의 구성항목) 표2: "기본급 및 직무수당 외 식대 월 200,000원(비과세)을 별도 지급하며, 퇴직금 산정 기준은 근로기준법 제34조를 따른다."',
    tableHeaders: ['급여 항목', '산정 기준', '과세 여부', '지급일'],
    tableRows: [
      ['기본급', '주 40시간 (월 209시간 기준)', '과세', '매월 25일'],
      ['식대 보조비', '월 고정 지급 (200,000원)', '비과세 한도 적용', '매월 25일'],
      ['자가운전보조금', '외근직 차량 업무 사용 시 (200,000원)', '비과세 요건 충족 시', '매월 25일'],
    ],
    fullTextPreview:
      '본 근로계약서는 2026년 개정 노동관계법령을 준수하여 작성되었으며, 부속 서류인 [별첨1] 영업비밀 및 고객DB 보호 서약서(NDA)에 서명함으로써 효력이 발생한다.',
  },
  {
    id: 'work-doc-5',
    folderId: 'quotes',
    folderPath: 'S:\\02_견적서_단가표_엑셀',
    fileName: '성수동_팝업스토어_집기제작_비교견적서_3개사비교.pdf',
    ext: 'PDF',
    sizeLabel: '8.7 MB',
    updatedAt: '2026-10-15',
    author: '최대리 (공간기획)',
    lockedBy: null,
    cacheSizeLabel: '29.9 KB 선행 캐싱됨',
    summaryTitle: '[스캔 PDF OCR + 표 투시 요약] A사(다온팩토리) vs B사(성수목공) vs C사(아크릴랩) 쇼케이스 제작 단가 및 납기 비교표',
    matchedSnippet:
      '비교표 4행: "B사(성수목공) — SUS 헤어라인 쇼케이스 + LED 간접조명 일체형 1,280만 원 (납기 10일, 무상 A/S 1년) ★최종 선정 추천"',
    tableHeaders: ['비교 항목', 'A사 (다온팩토리)', 'B사 (성수목공 ★추천)', 'C사 (아크릴랩)'],
    tableRows: [
      ['총 견적금액 (VAT별도)', '14,500,000원', '12,800,000원 (최저가)', '15,200,000원'],
      ['제작 및 설치 납기', '발주 후 14일', '발주 후 10일 (야간설치 포함)', '발주 후 12일'],
      ['특장점 / 비고', '도장 마감 우수', '성수동 인근 공장으로 즉시 대응 가능', '특수 아크릴 가공 포함'],
    ],
    fullTextPreview:
      '성수동 연무장길 팝업스토어 메인 디스플레이 집기 제작을 위해 3개 협력사로부터 입수한 견적서 스캔본을 AI OCR 및 표 구조 추출로 통합 비교함. B사(성수목공)가 단가(-170만 원 절감) 및 현장 긴급 대응력 면에서 가장 우수함.',
  },
  {
    id: 'work-doc-6',
    folderId: 'site',
    folderPath: 'S:\\04_현장시공_도면_미디어',
    fileName: '성수동_쇼룸_천장배선_및_분전반_시공도면_현장검수본.dwg',
    ext: 'DWG',
    sizeLabel: '18.2 MB',
    updatedAt: '2026-10-14',
    author: '강사원 (현장감리)',
    lockedBy: null,
    cacheSizeLabel: '27.5 KB 선행 캐싱됨',
    summaryTitle: '[도면 주기(Note) & 레이어 텍스트 투시 요약] 메인 분전반(MCCB 100A) 증설 위치 및 에스프레소 머신 전용 단독 회로(30A) 배선 지시',
    matchedSnippet:
      '도면 우측 하단 특기시방 주기(Note #4): "바리스타 바(Bar) 하부 에스프레소 머신(7.2kW) 및 제빙기는 반드시 30A 누전차단기 단독 회로로 직결 시공할 것 (타 콘센트 분기 절대 금지)"',
    tableHeaders: ['회로 번호', '부하 명칭', '차단기 용량', '전선 규격 / 배관'],
    tableRows: [
      ['M-01 (Main)', '쇼룸 통합 주분전반 메인', 'MCCB 4P 100A', 'F-CV 35sq / 강제전선관'],
      ['P-04 (단독)', '에스프레소 머신 (7.2kW 전용)', 'ELCB 2P 30A (감도 30mA)', 'HIV 6.0sq 단독 직결'],
      ['L-02 (조명)', '매장 메인 트랙조명 & 간판', 'ELCB 2P 20A', 'HIV 2.5sq / CD관 매립'],
    ],
    fullTextPreview:
      '현장 감리 메모: 기존 건물 분전반 용량이 50A로 부족하여 한전 승압 신청 완료(100A). 바리스타존 커피머신 가동 시 차단기 트립 방지를 위해 P-04 단독 회로를 천장 트레이 경유하여 바 하부 점검구로 인출 완료함.',
  },
  {
    id: 'work-doc-7',
    folderId: 'site',
    folderPath: 'S:\\04_현장시공_도면_미디어',
    fileName: '성수동_쇼룸_분전반_30A단독차단기_시공완료_현장사진.jpg',
    ext: 'JPG',
    sizeLabel: '3.6 MB',
    updatedAt: '2026-10-14',
    author: '강사원 (현장감리)',
    lockedBy: null,
    cacheSizeLabel: '18.2 KB 시각 분석 캐싱됨',
    summaryTitle: '[현장 시공 사진 AI 시각·OCR 분석] 분전반 내부 ELCB 30A 단독 차단기 라벨(P-04 에스프레소 전용) 및 접지선 결선 상태 검수 사진',
    matchedSnippet:
      '사진 시각·라벨 OCR 분석: "분전반 우측 하단 P-04 에스프레소 머신 전용 ELCB 2P 30A 누전차단기 장착 및 녹색 접지선(HIV 6.0sq) 직결 시공 확인 완료 (※ 업무방: 인물 여권 미발동 · 현장 사물/라벨만 분석)"',
    tableHeaders: ['분석 항목', 'AI 시각·OCR 판독 결과', '검수 상태'],
    tableRows: [
      ['차단기 명판 OCR', 'ELCB 2P 30A (정격감도전류 30mA) · P-04 에스프레소 전용', '도면 일치 (정상)'],
      ['배선 및 접지 시각 분석', 'HIV 6.0sq 흑·적·녹 3선 압착단자 체결 완료', '합격'],
      ['인물 여권 보호 정책', '업무 공유방 내 인물 얼굴 여권 미발동 (검색 대상 제외)', '적용됨'],
    ],
    fullTextPreview:
      '업무 공유방 사진 분석 리포트: 현장 시공 사진, 자재 명판, 영수증·증빙 사진의 사물 및 텍스트(OCR)는 100% 시각 분석되어 검색되지만, Z-Eye 인물 여권(얼굴 클러스터링·인물 바구니)은 업무 프라이버시 원칙에 따라 발동하지 않으며 검색 대상에서도 제외됩니다.',
  },
];

export const WorkLoungeB2BHub: React.FC = () => {
  const { isStoreAppMode, setShowProModal, activatePricingPlan, subscribedLounges, faceClusters } =
    useSaySeeStore();
  const [viewMode, setViewMode] = useState<'semantic' | 'explorer'>('semantic');
  const [driveTargetPath, setDriveTargetPath] = useState('D:\\Z-Eye\\업무공유폴더_S');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('all');
  const [docs, setDocs] = useState<WorkLoungeDocItem[]>(INITIAL_WORK_DOCS);
  const [selectedDocId, setSelectedDocId] = useState<string>('work-doc-1');
  const [isSidePeekOpen, setIsSidePeekOpen] = useState<boolean>(false);
  const [showBackupManager, setShowBackupManager] = useState<boolean>(false);
  const [masterWorkPcName, setMasterWorkPcName] = useState<string>('사무실 메인 공용 PC (S: 드라이브)');
  const [backupPcNodes, setBackupPcNodes] = useState<
    Array<{ id: string; name: string; mirrorPath: string; status: string; active: boolean }>
  >([
    {
      id: 'backup-1',
      name: '대표님 집 데스크탑 (백업 1호)',
      mirrorPath: 'D:\\Z-Eye_업무백업_원본미러',
      status: '✓ 원본 100% 실시간 동기화됨',
      active: true,
    },
    {
      id: 'backup-2',
      name: '정실장 재무회계 PC (백업 2호)',
      mirrorPath: 'E:\\Z-Eye_안전백업_금고',
      status: '✓ 원본 100% 실시간 동기화됨',
      active: true,
    },
  ]);
  const [newBackupPcName, setNewBackupPcName] = useState<string>('');
  const [newBackupPcPath, setNewBackupPcPath] = useState<string>('D:\\Z-Eye_추가백업_폴더');
  const [nightSleepBannerPhase, setNightSleepBannerPhase] = useState<'hidden' | 'visible' | 'fading'>('hidden');

  const triggerNightSleepMode = () => {
    setNightSleepBannerPhase('visible');
    window.setTimeout(() => {
      setNightSleepBannerPhase('fading');
    }, 1800);
    window.setTimeout(() => {
      setNightSleepBannerPhase('hidden');
    }, 3800);
  };

  const workPlan = subscribedLounges.work;
  const [folderCounts, setFolderCounts] = useState<Record<string, number>>({
    all: 7,
    root: 1,
    contracts: 2,
    quotes: 2,
    tax: 1,
    site: 2,
  });

  // 실제 S: 드라이브 폴더 스캔 및 문서 목록 실시간 동기화
  const syncRealWorkFiles = () => {
    fetch('/__work/files')
      .then((r) => r.json())
      .then((data: { ok: boolean; files: any[] }) => {
        if (!data?.ok || !Array.isArray(data.files)) return;
        const realFiles = data.files;
        if (realFiles.length === 0) return;

        // 실제 파일들을 WorkLoungeDocItem 구조로 매핑
        const mappedRealDocs: WorkLoungeDocItem[] = realFiles.map((rf: any, idx: number) => {
          const isGifOrImg = rf.isImage;
          const defaultSnippet = isGifOrImg
            ? `이미지/미디어 파일: ${rf.name} (${rf.sizeFormatted}) — 실시간 미리보기 가능`
            : rf.previewText
            ? rf.previewText.slice(0, 160).replace(/\n/g, ' ')
            : `S: 드라이브 보관 파일 — ${rf.relPath}`;

          return {
            id: `real-file-${idx}-${rf.name}`,
            folderId: rf.folderId || 'root',
            folderPath: rf.folderPath || 'S:\\',
            fileName: rf.name,
            ext: rf.ext || 'FILE',
            sizeLabel: rf.sizeFormatted || '0 KB',
            updatedAt: rf.mtimeFormatted || '최근',
            author: '멀린님 (로컬)',
            lockedBy: null,
            cacheSizeLabel: '실시간 로컬 동기화',
            summaryTitle: isGifOrImg
              ? `[이미지 파일 미리보기] ${rf.name}`
              : `[문서 미리보기] ${rf.name}`,
            matchedSnippet: defaultSnippet,
            tableHeaders: rf.tableHeaders && rf.tableHeaders.length > 0 ? rf.tableHeaders : ['속성', '상세 정보'],
            tableRows:
              rf.tableRows && rf.tableRows.length > 0
                ? rf.tableRows
                : [
                    ['파일명', rf.name],
                    ['위치', rf.folderPath],
                    ['용량', rf.sizeFormatted],
                    ['최근 수정일', rf.mtimeFormatted],
                  ],
            fullTextPreview: rf.previewText || (isGifOrImg ? `[이미지 미리보기 지원] ${rf.name}` : `S: 드라이브 로컬 원본 파일입니다.`),
            isImage: rf.isImage,
            imageBase64: rf.imageBase64,
          };
        });

        // 실제 파일(예: 1줄빛러M.gif 등)을 최상단에 배치하고 기존 표준 업무 문서 템플릿과 병합
        const combinedDocs = [
          ...mappedRealDocs,
          ...INITIAL_WORK_DOCS.filter((initDoc) => !mappedRealDocs.some((r) => r.fileName === initDoc.fileName)),
        ];

        // 폴더별 카운트 계산
        const counts: Record<string, number> = { all: combinedDocs.length, root: 0, contracts: 0, quotes: 0, tax: 0, site: 0 };
        combinedDocs.forEach((d) => {
          if (counts[d.folderId] !== undefined) {
            counts[d.folderId]++;
          }
        });
        setFolderCounts(counts);
        setDocs(combinedDocs);
      })
      .catch(() => {});
  };

  // 라운지 진입 시 100% 무인 자동으로 연결 개통 및 윈도우 S: 드라이브 자동 연결 + 파일 스캔
  useEffect(() => {
    void verifyHybridP2PBridgeConnection({
      roomId: 'lounge-work-b2b',
      simulateSymmetricNatBlock: false,
    });

    void fetch('/__work/s-drive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mount', openExplorer: false }),
    })
      .then((r) => r.json())
      .then((data: { targetDir?: string }) => {
        if (data?.targetDir) setDriveTargetPath(data.targetDir);
      })
      .catch(() => {});

    syncRealWorkFiles();
    const interval = setInterval(syncRealWorkFiles, 4000);
    return () => clearInterval(interval);
  }, []);

  // 업무 공유(work)에서는 Z-Eye 인물 여권(얼굴 클러스터링·인물 별명)이 발동하지 않으며 검색 대상에서도 제외됨
  const passportPersonTokens = React.useMemo(() => {
    const s = new Set<string>();
    for (const fc of faceClusters) {
      if (fc.registeredName?.trim()) s.add(fc.registeredName.trim().toLowerCase());
      for (const pv of Object.values(fc.roomPersonas ?? {})) {
        const clean = (pv || '').trim();
        if (clean) {
          s.add(clean.toLowerCase());
          const short = clean.replace(/\([^)]*\)/g, '').trim();
          if (short.length >= 2) s.add(short.toLowerCase());
        }
      }
    }
    return s;
  }, [faceClusters]);

  // 어절(단어) 단위 스마트 매칭: "지체상금 0.15%" 클릭 시 "지체상금(1일 0.15%)"도 100% 매칭 (단, 여권 인물명은 검색 제외)
  const filteredDocs = docs.filter((doc) => {
    const folderMatch =
      viewMode === 'semantic'
        ? true
        : selectedFolderId === 'all' || doc.folderId === selectedFolderId;
    if (!folderMatch) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const rawTokens = q.split(/\s+/).filter(Boolean);
    const nonPassportTokens = rawTokens.filter((tk) => !passportPersonTokens.has(tk));
    if (nonPassportTokens.length === 0) return false;
    const combinedText = [
      doc.fileName,
      doc.summaryTitle,
      doc.matchedSnippet,
      doc.fullTextPreview,
      ...doc.tableRows.flat(),
    ]
      .join(' ')
      .toLowerCase();
    return nonPassportTokens.every((token) => combinedText.includes(token));
  });

  // 검색 결과(filteredDocs) 중에서 우선 선택하여 좌측 리스트와 우측 프리뷰가 항상 100% 동기화되도록 보장
  const selectedDoc =
    filteredDocs.find((d) => d.id === selectedDocId) || filteredDocs[0] || docs[0];

  const handleToggleLockSimulation = (docId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDocs((prev) =>
      prev.map((d) => {
        if (d.id !== docId) return d;
        const nextLock = d.lockedBy ? null : '김대표(나)';
        return { ...d, lockedBy: nextLock };
      })
    );
  };

  const QUICK_WORK_QUERIES = [
    '철거 단가 4,850,000원',
    '지체상금 0.15%',
    '한빛테크 미수금',
    '성수목공 비교견적',
    '에스프레소 30A 단독 회로',
    '분전반 시공완료 현장사진',
  ];

  return (
    <section className="flex flex-col gap-5">
      {/* 1. 노션형 보더리스(Borderless) 업무 도화지 헤더 + 검색창 + 폴더 필터 칩 */}
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="font-headline-sm text-[20px] md:text-[22px] text-white font-extrabold tracking-tight">
              💼 사무실 업무 문서·현장사진함 (S:\)
            </h2>
            {workPlan && (
              <span className="text-[12px] text-emerald-400 font-bold">
                · ✓ {PLAN_BADGE_LABELS[workPlan]}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-400/25 text-[11.5px] text-emerald-300 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              사무실 PC 연결됨 · 팀원 6명
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-400/25 text-[11px] text-cyan-300 font-bold">
              📸 현장·증빙 사진 AI 분석 · 🛂 인물 여권 미발동(검색 제외)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowBackupManager((v) => !v)}
              className="px-3 py-1 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 text-emerald-300 font-label-sm text-[11.5px] font-extrabold cursor-pointer flex items-center gap-1"
            >
              <span>🛡️ 공용 S: PC 1대 + 백업 PC ({backupPcNodes.filter((b) => b.active).length}대 가동 중)</span>
              <span>{showBackupManager ? '▴' : '▾'}</span>
            </button>
            <button
              type="button"
              onClick={triggerNightSleepMode}
              className="px-3 py-1 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/45 text-indigo-200 font-label-sm text-[11.5px] font-extrabold cursor-pointer flex items-center gap-1"
              title="바탕화면 단축아이콘과 동일: 퇴근·취침 시 모니터 즉시 OFF + 15W 초절전 대기 + 메모리 찌꺼기 청소"
            >
              <span>🌙 퇴근·야간 초절전 모드 (월 1,800원)</span>
            </button>
            <span className="px-2.5 py-1 rounded-xl bg-zinc-900 border border-amber-400/30 text-[11px] text-amber-200 font-bold">
              🛡️ 마스터 PC 기본 [휴지통] 직행 + 백업 PC 1·2호 랜섬웨어 서킷 브레이커
            </span>
          </div>
        </div>

        {/* 🌙 퇴근·취침 시 실행되는 야간 초절전 모드 페이드아웃 안내 메시지 */}
        {nightSleepBannerPhase !== 'hidden' && (
          <div
            className={`p-4 rounded-2xl bg-gradient-to-r from-indigo-950/95 via-zinc-950/95 to-slate-950/95 border border-indigo-400/60 shadow-2xl flex flex-wrap items-center justify-between gap-3 transition-opacity duration-[1800ms] ${
              nightSleepBannerPhase === 'fading' ? 'opacity-0' : 'opacity-100'
            }`}
          >
            <div className="flex flex-col gap-1">
              <span className="font-headline-sm text-[15px] text-indigo-200 font-black">
                🌙 Z-Eye 초절전·무소음 야간모드가 가동되었습니다 — 편히 퇴근·취침하세요!
              </span>
              <span className="text-[12px] text-zinc-300">
                ✓ 램(RAM) 찌꺼기 청소 완료 · ✓ CPU 15W 초저전력 대기 전환(한 달 전기요금 약 1,800원) · <strong className="text-amber-300">이 안내 메시지는 서서히 사라진 뒤 모니터 전원이 꺼집니다...</strong>
              </span>
            </div>
            <span className="px-3 py-1 rounded-full bg-indigo-500/30 border border-indigo-300/50 text-indigo-100 font-mono text-[11px] font-bold">
              화면 페이드아웃 중...
            </span>
          </div>
        )}

        {/* 🛡️ 방장(대표) 전용: 공용 업무 PC(S: 1대) 지정 & 다중 백업 PC 실시간 원본 미러링 관리 패널 */}
        {showBackupManager && (
          <div className="p-4 rounded-2xl bg-[#18181B] border border-emerald-400/40 flex flex-col gap-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="font-headline-sm text-[14.5px] text-white font-extrabold">
                  🛡️ 클라우드 불신 제로! 공용 업무 PC(S: 드라이브 1대) + 백업 PC 1·2호 실시간 미러링 &amp; 랜섬웨어 서킷 브레이커
                </span>
                <span className="text-[12px] text-zinc-300">
                  구글 드라이브·네이버 MYBOX 동기화 폴더 위에 그대로 중첩 지정해도 충돌 없는 <code className="text-emerald-300">%LOCALAPPDATA%\Merlin\</code> 외부 격리(Zero-Footprint) 구조이며, 1분 내 30개 이상 대량 삭제·미끼 파일 변조 감지 시 <strong>백업 PC 1·2호 미러링을 0.01초 만에 즉시 차단</strong>해 랜섬웨어를 완벽 방어합니다.
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-400 text-zinc-950 font-label-sm text-[11px] font-extrabold">
                ✓ 마스터 PC 기본 [휴지통] 직행 + ↩️ 1초 실행 취소
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {/* 1) 공용 업무 PC (S: 드라이브 1대) */}
              <div className="p-3.5 rounded-xl bg-zinc-950 border border-cyan-400/45 flex flex-col justify-between gap-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-cyan-400 text-zinc-950 font-label-sm text-[10.5px] font-extrabold">
                    👑 메인 공용 업무 PC (1대)
                  </span>
                  <span className="text-[11px] text-cyan-300 font-mono font-bold">S:\ 마운트 마스터</span>
                </div>
                <div className="font-headline-sm text-[14px] text-white font-bold">
                  {masterWorkPcName}
                </div>
                <p className="text-[11px] text-zinc-400">
                  원본 경로: <code className="text-zinc-200">{driveTargetPath}</code> (전 직원 탐색기 S: 드라이브 직결)
                </p>
                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      setMasterWorkPcName((prev) =>
                        prev.includes('사무실')
                          ? '대표님 메인 워크스테이션 (S: 드라이브)'
                          : '사무실 메인 공용 PC (S: 드라이브)'
                      )
                    }
                    className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-cyan-300 text-[11px] font-bold cursor-pointer"
                  >
                    🔄 공용 업무 PC 변경 지정
                  </button>
                </div>
              </div>

              {/* 2) 다중 백업 PC 목록 (여러 대 마음대로 지정) */}
              <div className="lg:col-span-2 p-3.5 rounded-xl bg-zinc-950 border border-white/10 flex flex-col justify-between gap-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-label-sm text-[12px] text-emerald-300 font-extrabold">
                    💾 실시간 원본 백업 PC 목록 ({backupPcNodes.length}대 지정됨 · 대수 제한 없음)
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    각 백업 PC의 별도 지정 폴더에 S: 드라이브 원본이 1:1 실시간 복제됩니다
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {backupPcNodes.map((node) => (
                    <div
                      key={node.id}
                      className="p-2.5 rounded-lg bg-zinc-900 border border-emerald-400/30 flex items-center justify-between gap-2"
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="text-[12px] text-white font-bold truncate">
                          🖥️ {node.name}
                        </span>
                        <span className="text-[10.5px] text-zinc-400 font-mono truncate">
                          백업 경로: {node.mirrorPath}
                        </span>
                        <span className="text-[10.5px] text-emerald-300 font-bold">
                          {node.status}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setBackupPcNodes((prev) => prev.filter((item) => item.id !== node.id))
                        }
                        className="px-2 py-1 rounded bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-white text-[10.5px] font-bold shrink-0 cursor-pointer"
                      >
                        해제
                      </button>
                    </div>
                  ))}
                </div>

                {/* 새 백업 PC 추가 지정 폼 */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/10">
                  <input
                    type="text"
                    value={newBackupPcName}
                    onChange={(e) => setNewBackupPcName(e.target.value)}
                    placeholder="추가할 백업 PC 이름 (예: 김이사 노트북)"
                    className="flex-1 min-w-[160px] px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-white/15 text-white text-[11.5px]"
                  />
                  <input
                    type="text"
                    value={newBackupPcPath}
                    onChange={(e) => setNewBackupPcPath(e.target.value)}
                    placeholder="백업 저장 폴더 경로 (예: D:\Z-Eye_원본백업)"
                    className="flex-1 min-w-[180px] px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-white/15 text-white text-[11.5px] font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const name = newBackupPcName.trim() || `추가 백업 PC ${backupPcNodes.length + 1}호`;
                      const path = newBackupPcPath.trim() || 'D:\\Z-Eye_추가백업_폴더';
                      setBackupPcNodes((prev) => [
                        ...prev,
                        {
                          id: `backup-${Date.now()}`,
                          name,
                          mirrorPath: path,
                          status: '✓ 원본 100% 실시간 동기화됨',
                          active: true,
                        },
                      ]);
                      setNewBackupPcName('');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-label-sm text-[11.5px] font-extrabold cursor-pointer shrink-0"
                  >
                    + 백업 PC 추가 지정
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 노션형 깔끔한 검색창 + 예시 검색어 칩 */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 bg-[#18181B] border border-white/15 focus-within:border-primary-container rounded-2xl px-4 py-2.5 shadow-sm transition-colors">
            <span className="text-zinc-400 text-sm">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value.trim()) setIsSidePeekOpen(true);
              }}
              placeholder="계약서 조항, 엑셀 단가표 숫자, 현장 시공 사진(차단기·배선·자재 라벨), 파일명 검색... (인물 여권 제외)"
              className="w-full bg-transparent text-white placeholder-zinc-500 font-body-sm text-[13.5px] focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-zinc-400 hover:text-white text-[11.5px] font-bold shrink-0 cursor-pointer"
              >
                ✕ 지우기
              </button>
            )}
          </div>

          {/* 1줄 폴더 필터 알약 + 예시 검색어 */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {WORK_LOUNGE_FOLDERS.map((folder) => {
                const active = selectedFolderId === folder.id && viewMode === 'explorer';
                const isAllActive = folder.id === 'all' && (selectedFolderId === 'all' || viewMode === 'semantic');
                const highlight = active || isAllActive;
                const count = folderCounts[folder.id] ?? folder.count;
                return (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => {
                      setSelectedFolderId(folder.id);
                      setViewMode(folder.id === 'all' ? 'semantic' : 'explorer');
                    }}
                    className={`px-3 py-1.5 rounded-full font-label-sm text-[11.5px] flex items-center gap-1.5 transition-all shrink-0 cursor-pointer border ${
                      highlight
                        ? 'bg-primary-container text-zinc-950 border-primary-container font-extrabold'
                        : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border-white/10 font-bold'
                    }`}
                  >
                    <span>
                      {folder.id === 'all' ? '💽 전체' : folder.id === 'root' ? '📄 S:\\ 최상단' : `📁 ${folder.name.replace(/^\d+_/, '')}`}
                    </span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                        highlight ? 'bg-black/15 text-zinc-950 font-black' : 'text-zinc-400'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-zinc-400">
              <span>빠른 검색:</span>
              {QUICK_WORK_QUERIES.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => {
                    const nextQ = searchQuery === q ? '' : q;
                    setSearchQuery(nextQ);
                    if (nextQ) {
                      setViewMode('semantic');
                      const tokens = nextQ.toLowerCase().split(/\s+/).filter(Boolean);
                      const matched = docs.find((d) => {
                        const text = [
                          d.fileName,
                          d.summaryTitle,
                          d.matchedSnippet,
                          d.fullTextPreview,
                          ...d.tableRows.flat(),
                        ]
                          .join(' ')
                          .toLowerCase();
                        return tokens.every((t) => text.includes(t));
                      });
                      if (matched) {
                        setSelectedDocId(matched.id);
                        setIsSidePeekOpen(true);
                      }
                    }
                  }}
                  className={`underline cursor-pointer transition-colors ${
                    searchQuery === q ? 'text-cyan-300 font-extrabold' : 'hover:text-zinc-200'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 2. 노션 데이터베이스형 깔끔한 리스트 + 파일 클릭 시 우측에서 열리는 Side Peek 프리뷰 */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        <div className={`${isSidePeekOpen ? 'xl:col-span-7' : 'xl:col-span-12'} flex flex-col transition-all`}>
          <div className="rounded-2xl bg-[#18181B] border border-white/10 overflow-hidden">
            {/* 테이블 헤더 */}
            <div className="px-4 py-2.5 bg-zinc-950/70 border-b border-white/10 flex items-center justify-between text-[11.5px] text-zinc-400 font-bold">
              <span>
                문서 및 미디어 ({filteredDocs.length}건) · 항목을 클릭하면 우측에 상세 표·미리보기가 열립니다
              </span>
              {isSidePeekOpen && (
                <button
                  type="button"
                  onClick={() => setIsSidePeekOpen(false)}
                  className="text-zinc-400 hover:text-white text-[11px] font-bold cursor-pointer"
                >
                  우측 미리보기 닫기 ✕
                </button>
              )}
            </div>

            {/* 노션 데이터베이스 행(Row) 리스트 */}
            <div className="flex flex-col divide-y divide-white/8">
              {filteredDocs.map((doc) => {
                const isSelected = isSidePeekOpen && doc.id === selectedDoc.id;
                return (
                  <div
                    key={doc.id}
                    onClick={() => {
                      if (isSelected) {
                        setIsSidePeekOpen(false);
                      } else {
                        setSelectedDocId(doc.id);
                        setIsSidePeekOpen(true);
                      }
                    }}
                    className={`px-4 py-3 flex flex-col gap-1.5 cursor-pointer transition-colors ${
                      isSelected ? 'bg-cyan-950/35' : 'hover:bg-zinc-900/70'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span
                          className={`px-2 py-0.5 rounded font-label-sm text-[10px] font-extrabold shrink-0 ${
                            doc.ext === 'XLSX' || doc.ext === 'CSV'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                              : doc.ext === 'DOCX' || doc.ext === 'HWP' || doc.ext === 'TXT'
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-400/40'
                              : doc.ext === 'PDF'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-400/40'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                          }`}
                        >
                          {doc.ext}
                        </span>
                        <span className="font-label-md text-[13.5px] text-white font-bold truncate">
                          {doc.fileName}
                        </span>
                        <span className="hidden md:inline text-[11.5px] text-zinc-400 truncate">
                          · {doc.summaryTitle.replace(/\[.*?\]\s*/g, '')}
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className="hidden sm:inline text-[11px] text-zinc-400">
                          {doc.folderPath} · {doc.sizeLabel} · {doc.updatedAt}
                        </span>
                        {doc.lockedBy ? (
                          <span className="px-2.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/60 text-amber-200 font-label-sm text-[10.5px] font-extrabold">
                            🔒 {doc.lockedBy} 수정 중
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 font-label-sm text-[10.5px] font-bold">
                            🔓 수정 가능
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 검색어가 입력되었을 때만 해당 행 아래에 매칭된 핵심 스니펫 1줄 표시 */}
                    {searchQuery.trim() && (
                      <div className="pl-11 text-[12px] text-cyan-200 truncate">
                        📌 {doc.matchedSnippet}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 우측 Side Peek 패널: 문서를 클릭했을 때만 우측에서 스르륵 열림 */}
        {isSidePeekOpen && selectedDoc && (
          <div className="xl:col-span-5 p-4 md:p-5 rounded-2xl bg-[#18181B] border border-cyan-400/40 shadow-xl flex flex-col gap-3.5 sticky top-16">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-400 text-zinc-950 font-label-sm text-[11px] font-extrabold">
                  📄 문서 내용 미리보기
                </span>
                <span className="text-[11px] text-zinc-400 font-bold">
                  {selectedDoc.author} · {selectedDoc.updatedAt}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsSidePeekOpen(false)}
                className="px-2 py-0.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-[11.5px] font-bold cursor-pointer"
              >
                ✕ 닫기
              </button>
            </div>

            <div className="flex flex-col gap-1">
              <span className="font-label-sm text-[11px] text-cyan-300 font-bold">
                {selectedDoc.folderPath}\{selectedDoc.fileName}
              </span>
              <h3 className="font-headline-sm text-[16px] text-white font-extrabold leading-snug">
                {selectedDoc.summaryTitle.replace(/\[.*?\]\s*/g, '')}
              </h3>
            </div>

            {selectedDoc.lockedBy ? (
              <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-400/50 flex flex-col gap-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-label-sm text-[12.5px] text-amber-200 font-extrabold">
                      🔒 현재 [{selectedDoc.lockedBy}]님이 사용 중입니다. 읽기 모드로 열립니다.
                    </span>
                    <span className="font-body-sm text-[11px] text-zinc-300">
                      (윈도우 탐색기 S: 드라이브에서 열 때는 엑셀·오피스 기본 읽기 전용 규칙대로 자동 작동하며, 사본 저장은 파일 내에서 각자 처리합니다.)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleLockSimulation(selectedDoc.id)}
                    className="px-2 py-1 rounded-lg bg-zinc-950/80 hover:bg-zinc-900 border border-white/15 text-zinc-400 hover:text-white font-label-sm text-[10.5px] font-bold shrink-0 cursor-pointer"
                  >
                    잠금 시뮬레이션 해제
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      window.alert(
                        `현재 [${selectedDoc.lockedBy}]님이 사용 중이므로 [${selectedDoc.fileName}] 문서를 읽기 모드로 열었습니다.`
                      )
                    }
                    className="w-full py-1.5 px-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-sm text-[11.5px] font-extrabold cursor-pointer text-center"
                  >
                    👁️ 읽기 모드로 열기
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-400/30 flex items-center justify-between gap-2">
                <span className="font-label-sm text-[11.5px] text-emerald-300 font-bold">
                  🔓 현재 사용 중인 팀원이 없습니다 — 바로 편집 가능
                </span>
                <button
                  type="button"
                  onClick={() => handleToggleLockSimulation(selectedDoc.id)}
                  className="px-2.5 py-1 rounded-lg bg-zinc-950 hover:bg-zinc-900 border border-emerald-400/40 text-emerald-300 font-label-sm text-[11px] font-bold shrink-0 cursor-pointer"
                >
                  잠금 시뮬레이션
                </button>
              </div>
            )}

            {/* 이미지 미리보기 (GIF / PNG / JPG 등 미디어 파일 지원) */}
            {selectedDoc.isImage && selectedDoc.imageBase64 && (
              <div className="p-3 rounded-xl bg-zinc-950 border border-cyan-400/30 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-label-sm text-[11.5px] text-cyan-300 font-extrabold">
                    🖼️ 이미지 원본 실시간 미리보기
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    {selectedDoc.ext} · {selectedDoc.sizeLabel}
                  </span>
                </div>
                <div className="w-full flex items-center justify-center p-2 rounded-lg bg-black/40 border border-white/5 overflow-hidden">
                  <img
                    src={selectedDoc.imageBase64}
                    alt={selectedDoc.fileName}
                    className="max-h-64 object-contain rounded"
                  />
                </div>
              </div>
            )}

            {/* 표 핵심 데이터 */}
            <div className="flex flex-col gap-1.5">
              <span className="font-label-sm text-[11.5px] text-zinc-300 font-extrabold">
                📊 표 핵심 내용
              </span>
              <div className="overflow-x-auto rounded-xl border border-white/10 bg-zinc-950">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-900 border-b border-white/10">
                      {selectedDoc.tableHeaders.map((h) => (
                        <th
                          key={h}
                          className="px-2.5 py-2 font-label-sm text-[11px] text-cyan-300 font-extrabold whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {selectedDoc.tableRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-zinc-900/50">
                        {row.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            className="px-2.5 py-1.5 font-body-sm text-[11.5px] text-zinc-200"
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 본문 요약 */}
            <div className="p-3 rounded-xl bg-zinc-950 border border-white/10 flex flex-col gap-1">
              <span className="font-label-sm text-[11px] text-emerald-300 font-extrabold">
                📄 본문 주요 내용
              </span>
              <p className="font-body-sm text-[12px] text-zinc-200 whitespace-pre-line leading-relaxed">
                {selectedDoc.fullTextPreview}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="font-body-sm text-[11px] text-zinc-400">
                파일 크기: {selectedDoc.sizeLabel} · 위치: {selectedDoc.folderPath}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {!isStoreAppMode && !workPlan && (
                  <>
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('work_soho_9900')}
                      className="px-3 py-1.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-zinc-950 font-label-sm text-[11.5px] font-extrabold cursor-pointer"
                    >
                      💼 소호(~5인) 월 9,900원 개통
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowProModal(true)}
                      className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-200 font-label-sm text-[11.5px] font-bold cursor-pointer"
                    >
                      요금제 안내 보기
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
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
  } = useSaySeeStore();

  const [p2pOriginalSummoned, setP2pOriginalSummoned] = useState(true);
  const [showStorageCheckBanner, setShowStorageCheckBanner] = useState(false);
  const [simulateLowStorage, setSimulateLowStorage] = useState(false);
  const [downloadDirPath, setDownloadDirPath] = useState('D:\\Z-Eye\\다운로드_원본');
  const [monthlyReportDismissed, setMonthlyReportDismissed] = useState(false);

  const renderOriginalAutoSyncControl = () => (
    <div className="flex flex-wrap items-center gap-2 shrink-0">
      {/* 동기화 완료 (새로 9장 추가) 작은 풍선 배지 (Wi-Fi + 여유공간 충분할 때만 ON) */}
      {p2pOriginalSummoned && !simulateLowStorage && (
        <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/60 text-emerald-300 font-label-sm text-[11px] font-extrabold flex items-center gap-1 shadow-xs animate-pulse">
          <span>✨ 동기화 완료 (새로 9장 추가)</span>
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
        {simulateLowStorage
          ? '⚠️ 원본 동기화 (용량 부족 · 비활성)'
          : p2pOriginalSummoned
          ? '🔄 원본 동기화 (ON · Wi-Fi+여유공간 확인됨)'
          : '🔄 원본 동기화 켜기'}
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

        {/* 원본 동기화 저장 경로 지정 및 안내 메시지 */}
        {!simulateLowStorage && (
          <div className="p-3 rounded-xl bg-zinc-950 border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-2.5 text-[12px]">
            <div className="flex flex-col gap-0.5">
              <span className="text-emerald-300 font-extrabold">
                📂 원본 동기화 저장 경로 안내 (초기 기본값은 숨김 썸네일 DB만 유지)
              </span>
              <span className="text-zinc-300 text-[11.5px]">
                평소 멤버 기기에는 보이지 않는 시스템 영역(<code>%LOCALAPPDATA%\Merlin\thumb_db</code>)에 <strong>썸네일 DB</strong>만 보관되며, 원본 동기화를 켜면 아래 지정한 경로에 원본 사진이 저장됩니다.
              </span>
            </div>
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
    if (namedClusters.length === 0) return null;
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
          onClick={() => setDoorplatePickerClusterId('face_member_5')}
          className="px-2.5 py-1.5 rounded-full bg-primary-container/15 hover:bg-primary-container/25 border border-primary-container/40 text-primary-container font-label-sm text-[11px] font-extrabold ml-0.5 shrink-0 whitespace-nowrap cursor-pointer"
          title="Z-Eye 여권 5대 스타일 슬롯(①정면/②미소/③측면/④선글라스/⑤야외) 원터치 문패 사진 교체"
        >
          🎨 내 문패 사진 변경
        </button>
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
    return (
      <div className="flex flex-col gap-2.5">
        <div className="px-1 py-1 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {FAMILY_ROOMS.map((room) => {
              const active = activeFamilyRoom === room;
              return (
                <button
                  key={room}
                  type="button"
                  onClick={() => setActiveFamilyRoom(room)}
                  className={`px-3 py-1.5 rounded-full font-label-sm text-[12px] font-bold border transition-all shrink-0 whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-primary-container text-zinc-950 border-primary-container font-extrabold shadow-xs'
                      : 'bg-zinc-900/80 text-zinc-300 border-white/10 hover:bg-zinc-800'
                  }`}
                >
                  {room === '우리집' ? '🏠 우리집' : room === '본가(친가)' ? '🏡 본가(친가)' : '🌸 처가(친정)'}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {renderMemberPersonaPills(`[${activeFamilyRoom}] 인물:`)}
            {renderOriginalAutoSyncControl()}
          </div>
        </div>
        {renderStorageCheckAndSyncDetail()}
      </div>
    );
  }

  if (activeLoungeType === 'club') {
    return (
      <div className="flex flex-col gap-2.5">
        <AlumniRetroBannerAndTwoTrackBar
          onOpenWaitingRoom={() => {
            setDesktopTab('trash');
            setMobileTab('trash');
          }}
        />

        {/* 하단 1줄: 모임 인물 빠른 검색 + 각자의 페이지 [원본 자동 동기화] 버튼 & (새로 9장 추가) 풍선 */}
        <div className="px-1 py-1 flex flex-wrap items-center justify-between gap-2.5">
          {renderMemberPersonaPills('회원별 사진 찾기:')}
          {renderOriginalAutoSyncControl()}
        </div>

        {/* 남은 용량 대비 가능/불가능 안내 및 내 기기 저장 폴더 열기 */}
        {renderStorageCheckAndSyncDetail()}
      </div>
    );
  }

  if (activeLoungeType === 'work') {
    return <WorkLoungeB2BHub />;
  }

  // student ('🎒 스쿨 라운지')
  return (
    <div className="flex flex-col gap-2">
      {!monthlyReportDismissed && (
        <div className="px-3.5 py-2 rounded-xl bg-zinc-900/60 border border-emerald-400/30 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <span className="px-2 py-0.5 rounded bg-emerald-400 text-zinc-950 font-label-sm text-[11px] font-extrabold whitespace-nowrap">
              🎉 용량 정리
            </span>
            <span className="font-body-sm text-[12px] text-zinc-200 truncate">
              이번 달 우리반 원본 사진 {photos.length}장 &amp; 영상이 방장 PC로 보관되어{' '}
              <strong className="text-emerald-300">내 폰 여유 공간 +14.2GB</strong> 확보!
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMonthlyReportDismissed(true)}
            className="text-zinc-400 hover:text-white font-label-sm text-[11px] shrink-0 whitespace-nowrap cursor-pointer"
          >
            ✕ 닫기
          </button>
        </div>
      )}

      <div className="px-1 py-1 flex flex-wrap items-center justify-between gap-2.5">
        <span className="font-label-sm text-[12.5px] text-zinc-400">
          🎒 우리 반 사진과 영상을 친구 이름이나 장면으로 바로 찾아보세요
        </span>
        {renderMemberPersonaPills('친구 이름 검색:')}
      </div>
    </div>
  );
};

/**
 * 3번 서브메뉴 `[⏳ AI 인덱싱 대기실]` (패밀리 / 클럽 / 스쿨 / 업무 라운지 전용)
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

  const memberActiveHints = swarmFaceCandidates.filter((c) => !c.applied && !c.passedToHostQueue);
  const hostCleanupQueue = swarmFaceCandidates.filter((c) => !c.applied);
  const pendingAnalogProposals = analogYearProposals.filter((p) => !p.approvedByHost);

  const queuePhotos = photos
    .filter((p) => !p.quarantined && !deletedLoungePhotoIds.includes(p.id))
    .slice(0, 8);

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
      badge: `⏳ AI 꽃단장(인덱싱) 대기실 (${activeFamilyRoom})`,
      title: '방장 사전 검수 없이 즉시 합류! AI가 예쁜 이름표를 달며 꽃단장 중이에요',
      subtitle:
        '이미 라운지에 있는 중복 사진(64-bit dHash)은 자동 제외하되 EXIF 원본 메타데이터가 살아있고 실제 해상도가 더 큰 진짜 원본이면 자동으로 교체(댓글·좋아요 유지)하며, 업로드 후 24시간 내 올린 본인 삭제 및 방 개설 설정에 따른 방장 숨기기가 지원됩니다.',
      bufferReason: '✨ AI가 예쁜 이름표를 달며 꽃단장 중이에요 (Gemma 2 이름표 + 13KB 썸네일 생성 중)',
      senderLabels: ['은숙(아내)', '진욱(방장)', '우리딸', '본가 어머님'],
    },
    club: {
      badge: '⏳ AI 꽃단장(인덱싱) 대기실 (모임 사진 & 옛날 앨범 스캔 사진)',
      title: '방장 사전 검수 없이 즉시 합류! 중복 사진은 빼고 진짜 고화질 원본으로 자동 업그레이드합니다',
      subtitle:
        '64-bit dHash 대조로 중복 사진은 입구에서 자동 제외(EXIF 원본 메타데이터+실제 고해상도 진짜 원본이면 자동 교체)되며, 업로드 후 24시간 내 올린 본인 삭제 및 방 개설 옵션에 따른 방장 숨기기가 지원됩니다.',
      bufferReason: '✨ AI가 예쁜 이름표를 달며 꽃단장 중이에요 (인물 분류 및 스캔 사진 정리 중)',
      senderLabels: ['김총무(방장)', '박회장', '이프로', '최회원'],
    },
    student: {
      badge: '📥 우리반 새 사진·영상 정리함',
      title: '친구들이 올린 사진과 축제 영상을 방장 PC에서 자동으로 정리하여 앨범에 올립니다',
      subtitle:
        '학교·학원에 있는 낮 시간 동안 친구들이 찍어 올린 사진·영상을 모아 두었다가, 하교 후 방장 PC가 켜지면 자동으로 분류해 우리반 피드에 올려줍니다.',
      bufferReason: '방장 PC가 켜지면 자동으로 사진·영상 정리가 시작됩니다',
      senderLabels: ['민준 아이폰', '서연 갤럭시', '도윤 아이폰', '하은 아이폰'],
    },
    work: {
      badge: '📥 새 업무 문서 정리함 (부서 폴더 자동 분류)',
      title: '외근·현장 직원이 새로 올린 계약서·견적서·시공사진을 폴더별로 자동 정리합니다',
      subtitle:
        '외부에서 올린 엑셀 단가표, PDF 견적서, 현장 도면의 내용을 읽어 부서별 폴더(S: 드라이브)로 자동 분류하고, 스마트폰에서도 바로 검색할 수 있게 준비합니다.',
      bufferReason: '내 PC 업무 공유 드라이브(S:) 폴더 자동 분류 및 본문 검색 준비 중',
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
      `✓ 동기들이 제보한 옛날 사진 연도/장소 ${count}건이 👑 방장 일괄 결재로 느슨한 타임라인 · 계절↔월(Month) 양방향 인덱스 · Z-Eye 여권 1980년대 바구니(1989~1980)에 즉시 반영되었습니다!`
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
          <div className="flex flex-wrap items-center gap-2">
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

        <div className="flex flex-col gap-1.5">
          <h1 className="font-headline-md text-[20px] md:text-[22px] text-white font-bold">
            {currentMeta.title}
          </h1>
          <p className="font-body-sm text-[12.5px] text-zinc-300 leading-relaxed">
            {currentMeta.subtitle}
          </p>
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
                현장 시공 사진, 자재 라벨, 촬영 서류의 사물·텍스트(OCR)만 자동 분석합니다 (🛂 Z-Eye 인물 여권은 업무 공유에서 미발동 · 검색 제외)
              </span>
            </div>
          </div>
        ) : (
          /* 🎯 ✨ AI 얼굴 자동 매칭 도우미 + 👑 방장 누락분 & 연도 제보 일괄 승인 */
          <div className="p-4 rounded-xl bg-zinc-950/90 border border-primary-container/30 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-primary-container text-zinc-950 font-label-sm text-[11px] font-extrabold">
                ✨ AI 얼굴 자동 매칭 도우미
              </span>
              <span className="font-label-sm text-[12.5px] text-white font-bold">
                새로 찾은 얼굴은 원터치로 등록하고, 바쁠 때는 확인을 건너뛰고 사진만 바로 올리세요 (👑 방장이 나중에 한 번에 정리)
              </span>
            </div>

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

      {/* 3 & 4. 옛날 스캔 사진용 '연도·장소 스티커' & [❓ 언제/어디인가요?] 동기 제보 ➔ 👑 방장 일괄 승인 (업무 공유 제외) */}
      {activeLoungeType !== 'work' && (
      <section className="p-5 md:p-6 rounded-2xl bg-[#18181B] border border-amber-400/35 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-amber-400 text-zinc-950 font-label-sm text-[11px] font-extrabold">
                🎞️ 촬영 날짜 없는 옛날 종이 사진 · 연도·장소 스티커 붙이기
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 font-label-sm text-[11px] font-bold">
                🛂 연도 입력 시 [1980년대 앨범]으로 자동 분류
              </span>
            </div>
            <h2 className="font-headline-sm text-[17px] md:text-[18px] text-white font-bold mt-0.5">
              첫 번째 스캔 사진에 연도·장소·계절을 한 번만 적으면 [🏷️ 스티커]가 만들어져, 다음 사진부터는 클릭 한 번으로 바로 붙일 수 있습니다
            </h2>
          </div>

          {pendingAnalogProposals.length > 0 && (
            <button
              type="button"
              onClick={handleApproveAllAnalog}
              className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-sm text-[12px] font-extrabold shadow-[0_0_20px_rgba(251,191,36,0.3)] shrink-0"
            >
              👑 방장 뒷정리: [✓ 멤버 연도 제보 일괄 승인 ({pendingAnalogProposals.length}건)]
            </button>
          )}
        </div>

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

        {/* 스캔된 옛날 사진 카드 그리드 (1초 스틱 부착 & [❓ 언제/어디인가요?] 댓글 제보) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
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
      </section>
      )}

      {/* 새로 올라온 사진 정리함 그리드 */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-headline-sm text-[15.5px] text-white font-bold">
              📥 최근 올라온 사진 ({queuePhotos.length}장)
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/35 text-emerald-300 font-label-sm text-[11px] font-extrabold">
              ✓ 64-bit dHash 중복 제외 (EXIF 원본 메타데이터+실제 고해상도 진짜 원본만 자동 교체)
            </span>
          </div>
          <span className="font-label-sm text-[11.5px] text-zinc-400">
            👤 올린 본인은 24시간 내 직접 삭제 가능 · 방장은 올라오는 처음부터 상시 숨기기 가능(방 개설 설정 시)
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
 * - 개인: [AI 설정 몬스터] 정기 구독 업그레이드 안내
 * - 패밀리: [👑 가족 초대 & 서버도우미] 가족 무수락 초대 링크/QR (방장 강퇴권 포함) + 양가 통합권 설정
 * - 클럽: [👥 클럽 관리 & 서버도우미] 소(20명)/중(100명)/대(무제한) 클럽 설정 + 회원 초대/강퇴 관리
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
  } = useSaySeeStore();

  const [inviteCopied, setInviteCopied] = useState(false);
  const [trojanBragCopied, setTrojanBragCopied] = useState(false);
  const [familyTrojanBragCopied, setFamilyTrojanBragCopied] = useState(false);
  const [familyShortsWatermark, setFamilyShortsWatermark] = useState('사랑하는 우리가족');
  const [clubShortsWatermark, setClubShortsWatermark] = useState('제주여고 89회 공식 갤러리');
  const [shortsExportToast, setShortsExportToast] = useState<string | null>(null);
  const [gamingPcAutoSyncAfterSchool, setGamingPcAutoSyncAfterSchool] = useState(true);
  const [hostRetainsHidePermission, setHostRetainsHidePermission] = useState(true);

  const renderRoomCreationAndExitPolicyBox = () => (
    <div className="p-4 rounded-xl bg-zinc-950/90 border border-white/10 flex flex-col gap-3">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-primary-container/20 text-primary-container font-label-sm text-[10.5px] font-extrabold">
              🛠️ 방 개설 설정 옵션 · 삭제/숨기기 권한 기준
            </span>
            <span className="text-[11.5px] text-emerald-300 font-bold">
              ✓ 올린 본인은 24시간 내 직접 삭제 · 방장은 올라오는 처음부터 상시 숨기기 감시 가능
            </span>
          </div>
          <p className="font-body-sm text-[11.5px] text-zinc-300">
            올린 원본 주인은 업로드 후 <strong>24시간 이내에 직접 삭제</strong>할 수 있고, 멤버가 잘못된 사진을 올릴 때를 대비해 <strong>방장이 사진이 올라오는 처음부터 상시 [숨기기] 권한을 가질지</strong> 방 개설 시 선택합니다.
          </p>
        </div>

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
            👑 방장 상시 숨기기 권한 보유 — 올라오는 처음부터 가능 (권장)
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
            🤝 방장 숨기기 없음 (24시간 내 본인 삭제만)
          </button>
        </div>
      </div>

      <div className="pt-2.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-zinc-400">
        <span>
          🚪 <strong className="text-zinc-200">탈퇴(자퇴 · 강퇴 동일) 시 데이터 처리 기준 (방 개설 안내 &amp; 약관 명시):</strong> 탈퇴/강퇴 즉시 해당 방 계정 아웃 처리되며, 기기 내 숨김 영역에 저장된 <strong>그 공유방의 썸네일 DB · 공유방 검색 인덱스 · 해당 방 내부 타 멤버 여권 목록만 즉시 자동 삭제</strong>됩니다. (※ 유저가 내 PC에 무료 서비스로 인덱싱해 둔 <strong>‘나 자신의 Z-Eye 여권’ 및 ‘내 기기 개인 인덱스’는 절대 삭제되지 않고 100% 보존</strong>되며, 이미 받아둔 공유방 원본 폴더도 반납 없이 각자 자율 관리합니다.)
        </span>
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
      '[제트아이 라운지 초대장] 혼자 쓸 땐 언제나 0원, 함께 쓸 땐 방장 한 분만! 초대받은 가족·회원·직원은 언제나 무료입니다. https://z-eye.sundreamer.app';
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
      `🎬 변천사 쇼츠 우측 하단 워터마크가 [Z-Eye] 대신 [${label}]로 적용되어 카톡·인스타 공유용 MP4에 각인되었습니다!`
    );
    setTimeout(() => setShortsExportToast(null), 3200);
  };

  if (activeLoungeType === 'personal') {
    return <SetupMonsterContent />;
  }

  if (activeLoungeType === 'family') {
    const FAMILY_ROOMS: FamilyRoomId[] = ['우리집', '본가(친가)', '처가(친정)'];
    return (
      <div className="p-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="px-2.5 py-0.5 rounded-md bg-primary-container text-zinc-950 font-label-sm text-[11px] font-extrabold w-fit">
              {isStoreAppMode
                ? '👑 가족 초대 & 양가 방 분리 관리 (가족 전원 100% 무료 열람)'
                : '👑 가족 초대 & 양가 통합권 관리 (마스터 1인 결제 ➔ 가족 전원 무료)'}
            </span>
            <h2 className="font-headline-sm text-[19px] text-white font-bold mt-1">
              가족 무수락 카톡 초대 링크/QR &amp; 방장 즉시 강퇴권 관리
            </h2>
            <p className="font-body-sm text-[12.5px] text-zinc-400">
              초대 링크를 누르면 복잡한 승인 대기 없이 즉시 합류하며, 실수로 잘못 들어온 외부인은 방장이 원터치로 즉시 강퇴(캐시 폐기)할 수 있습니다.
            </p>
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
                  className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-200 font-label-sm text-[12px] font-bold"
                >
                  🏠 우리집 단독 월 5,900원
                </button>
                <button
                  type="button"
                  onClick={() => activatePricingPlan('family_three_8900')}
                  className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-primary-container/50 text-primary-container font-label-sm text-[12px] font-bold"
                >
                  👨‍👩‍👧‍👦 양가 통합권(3방) 월 8,900원
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
              기본 <code>[Z-Eye]</code> 로고 대신 <strong>[{familyShortsWatermark}]</strong> 워터마크를 박아 카톡·인스타로 공유하면 다른 가족 모임의 연쇄 유입이 일어납니다.
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
            <span className="px-2.5 py-0.5 rounded-md bg-primary-container text-zinc-950 font-label-sm text-[11px] font-extrabold w-fit">
              👥 동호회 · 동창회 라운지 관리 &amp; 회원 초대/강퇴 (방 1개 기준 · 인원수 무제한)
            </span>
            <h2 className="font-headline-sm text-[19px] text-white font-bold mt-1">
              ⛳ 동호회 · 🎓 동창회 인원 무제한 월 4,900원 (10년 마스터권 49,000원) 단일가 &amp; 회원 관리
            </h2>
            <p className="font-body-sm text-[12.5px] text-zinc-400">
              {isStoreAppMode
                ? '초대받은 클럽 회원은 모바일 앱에서 100% 무료로 모임 사진을 찾고 감상합니다. 방 개설 및 마스터 엔진 연동은 데스크톱(PC)에서 관리합니다.'
                : '모임 인원이 10명이든 500명이든 인원수 계산 없이 월 4,900원(10년 마스터권 49,000원) 단일가로 운영되며, 초대받은 회원은 전원 무료입니다.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copyInviteLink}
              className="px-4 py-2 rounded-xl bg-primary-container text-zinc-950 font-label-sm text-[12px] font-extrabold cursor-pointer"
            >
              {inviteCopied ? '✓ 클럽 회원 초대 링크 복사됨!' : '⛳ 클럽 무수락 초대 링크·QR 발급'}
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            {
              id: 'small' as ClubSizeTier,
              label: '⛳ 동호회 · 소모임 (모임 이름 문패 · 인원수 무제한)',
              price: isStoreAppMode ? '인원수 무제한 모임 방' : '월 4,900원 (10년 마스터권 49,000원) 단일가',
              plan: 'club_small_4900' as PricingPlanId,
            },
            {
              id: 'large' as ClubSizeTier,
              label: '🎓 동창회 · 반창회 (학교/학년/반 문패 · 인원수 무제한)',
              price: isStoreAppMode ? '인원수 무제한 동창회 방' : '월 4,900원 (10년 마스터권 49,000원) 단일가',
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
                자동 렌더링 변천사 쇼츠 우측 하단에 <code>[Z-Eye]</code> 대신 <strong>[{clubShortsWatermark}]</strong>를 박아 카톡·인스타로 공유하면 타 동창회·모임의 꼬리물기 유입이 일어납니다.
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
            참여 클럽 회원 ({clubMembers.length}명):
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
              💼 업무 라운지 — 팀원 권한 &amp; 내 컴퓨터 업무 공유 드라이브(S:) 안내
            </span>
            <h2 className="font-headline-sm text-[19px] text-white font-bold mt-1">
              사무실 PC 업무 폴더가 전 직원의 문서 검색창과 윈도우 탐색기(S:)에 자동으로 연결됩니다
            </h2>
            <p className="font-body-sm text-[12.5px] text-zinc-300">
              따로 연결 버튼을 누를 필요 없이 <strong>[윈도우 탐색기 ➔ 내 PC ➔ S: 드라이브]</strong>(`D:\Z-Eye\업무공유폴더_S`)에서 계약서·견적서·세금계산서·도면 폴더를 일반 폴더처럼 바로 열어 쓰고, 외근 중인 직원은 스마트폰 LTE/5G로 들어와도 자동으로 외부 접속 모드로 연결됩니다.
            </p>
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

  // student ('🎒 스쿨 라운지')
  return (
    <div className="p-6 rounded-2xl bg-[#18181B] border border-primary-container/40 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="px-2.5 py-0.5 rounded-md bg-primary-container text-zinc-950 font-label-sm text-[11px] font-extrabold w-fit">
            {isStoreAppMode
              ? '🎒 스쿨 라운지 (초·중·고 우리반·동아리 100% 무료 합류)'
              : '🎒 스쿨 라운지 (초·중·고 반/동아리 특가 월 900원)'}
          </span>
          <h2 className="font-headline-sm text-[19px] text-white font-bold mt-1">
            {isStoreAppMode
              ? '하교 후 방장 게이밍 PC 자동 인덱싱 & 학생증 로컬 OCR 0.1초 인증'
              : '하교 후 방장 게이밍 PC 자동 인덱싱 & 초·중·고 반/동아리 인원 무제한 월 900원 학생인증'}
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
