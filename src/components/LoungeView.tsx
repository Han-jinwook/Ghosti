import React, { useState } from 'react';
import { getActivePersonaForCluster, useSaySeeStore } from '../store/useSaySeeStore';
import type { ClubSizeTier, FamilyRoomId, LoungeType, PricingPlanId } from '../types/saysee';
import { FaceMemberInlineBar } from './FaceMemberRegistryModal';
import { PcMasterQuickSendPanel } from './PricingModal';

const LOUNGE_TABS: Array<{
  id: LoungeType;
  icon: string;
  label: string;
  shortPrice: string;
  desc: string;
}> = [
  {
    id: 'personal',
    icon: '👤',
    label: '개인 라운지',
    shortPrice: 'AI 클린 1,900원 · AI 투시검색 월 1,900원',
    desc: 'AI 투시검색 몬스터 | AI 클린 몬스터 | AI 설정 몬스터',
  },
  {
    id: 'family',
    icon: '👨‍👩‍👧‍👦',
    label: '패밀리 라운지',
    shortPrice: '우리집 월 5,900원 · 양가 3방 월 8,900원',
    desc: '가족 대표 사진 얼굴 추출 & 이름 등록 ➔ 카톡 초대 & 3초 레이더 스캔 맛보기',
  },
  {
    id: 'club',
    icon: '⛳',
    label: '클럽 라운지',
    shortPrice: '소 4,900원 · 중 7,900원 · 대 14,900원',
    desc: '모임 단체컷 얼굴 추출 & 참석자 폰 사진 레이더 수합 맛보기 (방 1개 기준)',
  },
  {
    id: 'student',
    icon: '🎒',
    label: '스쿨 라운지',
    shortPrice: '초·중·고 반/동아리 특가 월 900원 (연 9,000원)',
    desc: '친구 얼굴 크롭 & 별명 등록 ➔ 레이더 10장 수합 ➔ 방장 게이밍 PC 콕 찌르기',
  },
];

const PLAN_BADGE_LABELS: Record<PricingPlanId, string> = {
  free_trial: '✨ 무료체험 중',
  personal_single_2900: 'AI 클린 몬스터 (기기 1대당 1,900원)',
  personal_sub_3900: 'AI 투시검색 몬스터 (월 1,900원)',
  personal_year_35000: 'AI 투시검색 몬스터 (연 19,000원 · 초기 100명 평생권)',
  family_home_5900: '🏠 패밀리 우리집 단독 (월 5,900원)',
  family_home_year_59000: '🏠 패밀리 우리집 연간 (연 59,000원)',
  family_three_8900: '👨‍👩‍👧‍👦 패밀리 양가 통합 3방 (월 8,900원)',
  family_three_year_89000: '👨‍👩‍👧‍👦 패밀리 양가 통합 연간 (연 89,000원)',
  club_small_4900: '⛳ 소형 클럽 20명 (월 4,900원)',
  club_small_year_49000: '⛳ 소형 클럽 연간 (연 49,000원)',
  club_medium_7900: '⛳ 중형 클럽 100명 (월 7,900원)',
  club_medium_year_79000: '⛳ 중형 클럽 연간 (연 79,000원)',
  club_large_14900: '⛳ 대형 클럽 무제한 (월 14,900원)',
  club_large_year_149000: '⛳ 대형 클럽 연간 (연 149,000원)',
  student_sub_900: '🎒 스쿨 라운지 (초·중·고 반/동아리 특가 월 900원)',
  student_year_9000: '🎒 스쿨 라운지 (초·중·고 반/동아리 특가 연 9,000원)',
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
  const inviteHookCopy = `네가 몰랐던 ${cohortShort}년 수학여행 네 사진 다 찾았다`;
  const trojanBragCopy = `내가 클럽 평생권 끊어서 가족방 쿠폰 3장 받았는데, 선착순으로 줄 테니 쓸 사람?`;

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

  return (
    <div className="p-3.5 md:p-4 rounded-2xl bg-[#18181B] border border-white/10 shadow-sm flex flex-col gap-3">
      {/* 1. 생성형 맞춤형 간판 'Text-to-Banner' (종이 앨범/화이트 카드 위에 얹힌 8090 감성 칠판·운동장 간판) */}
      <div
        data-keep-dark="true"
        className={`relative rounded-xl overflow-hidden border px-5 py-4 md:px-6 md:py-5 transition-all ${
          isChalkboard
            ? 'bg-gradient-to-r from-[#163325] via-[#1E4432] to-[#142B1F] border-[#6A9E82]/60 shadow-[inset_0_0_32px_rgba(0,0,0,0.45)]'
            : 'bg-gradient-to-r from-[#4A221D] via-[#7A3522] to-[#361D33] border-amber-300/50 shadow-[inset_0_0_32px_rgba(0,0,0,0.4)]'
        }`}
      >
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3.5">
          {/* 좌측: 배경 그래픽 전환 & 학교·연도 변경 (컴팩트 통일 버튼) */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setAlumniBannerInfo(
                  alumniSchoolName,
                  alumniGradYear,
                  isChalkboard ? 'sunset_field' : 'chalkboard'
                )
              }
              className="px-3 py-1.5 rounded-lg bg-black/35 hover:bg-black/55 border border-white/25 text-white font-label-sm text-[11.5px] font-bold whitespace-nowrap transition-colors"
            >
              {isChalkboard ? '🏫 복고풍 칠판 ➔ 🌅 노을 운동장' : '🌅 노을 운동장 ➔ 🏫 복고풍 칠판'}
            </button>

            {editingBannerKeyword ? (
              <form onSubmit={handleApplyBannerKeyword} className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={keywordDraft}
                  onChange={(e) => setKeywordDraft(e.target.value)}
                  placeholder="예: 성동고 1989"
                  className="px-2.5 py-1.5 rounded-lg bg-black/60 border border-amber-300/70 text-white text-[12px] font-bold w-32 focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-amber-300 text-zinc-950 text-[11.5px] font-extrabold whitespace-nowrap"
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
                className="px-3 py-1.5 rounded-lg bg-black/30 hover:bg-black/50 border border-white/20 text-amber-200 font-label-sm text-[11.5px] font-bold whitespace-nowrap"
              >
                ✏️ {alumniSchoolName} {alumniGradYear} 변경
              </button>
            )}
          </div>

          {/* 중앙: 굵고 또렷한 8090 타이포그래피 간판 */}
          <div className="flex flex-col items-start lg:items-center text-left lg:text-center">
            <span className="font-label-mono text-[10.5px] tracking-widest uppercase text-amber-200 font-bold">
              SINCE {alumniGradYear} · ALUMNI LOUNGE
            </span>
            <h2 className="font-headline-md text-[24px] md:text-[29px] text-white font-black tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] whitespace-nowrap">
              {bannerTitle}
            </h2>
          </div>

          {/* 우측: 카톡 단톡방 바이럴 초대장 복사 버튼 */}
          <button
            type="button"
            onClick={() => void handleCopyInviteHook()}
            className={`px-4 py-2.5 rounded-xl font-label-sm text-[12px] font-extrabold transition-all shadow-md flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
              inviteCopied
                ? 'bg-emerald-400 text-zinc-950'
                : 'bg-amber-300 hover:bg-amber-200 text-zinc-950'
            }`}
          >
            <span>
              {inviteCopied
                ? `✓ 초대장 카피 복사됨!`
                : `💌 초대장 카피: "${inviteHookCopy}"`}
            </span>
          </button>
        </div>
      </div>

      {/* 1-2. [치트키 1·2·3] 총무 명예의 전당 헌정 배지 + 실시간 잔여 수량 게이지 + 가족방 1년 쿠폰 3장 생색내기 */}
      <div className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500/15 via-zinc-950 to-zinc-950 border border-amber-400/40 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-md bg-amber-400 text-zinc-950 font-label-sm text-[11px] font-black whitespace-nowrap">
            🏅 명예의 전당
          </span>
          <span className="font-label-md text-[12.5px] md:text-[13px] text-amber-200 font-extrabold">
            {isStoreAppMode
              ? '🏅 본 라운지는 김철수 총무님의 마스터 후원으로 회원 전원 영구 무료 운영됩니다.'
              : '🏅 본 라운지는 김철수 총무님의 [평생권] 후원으로 영구 무료 운영됩니다.'}
          </span>
        </div>

        {!isStoreAppMode && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowProModal(true)}
              className="px-3 py-1.5 rounded-lg bg-rose-950/90 hover:bg-rose-900/90 border border-rose-500/50 text-rose-200 font-label-sm text-[11.5px] font-extrabold flex items-center gap-2 whitespace-nowrap"
            >
              <span>🔥 1차 평생권 100명 중 87개 소진 (잔여 13석)</span>
              <span className="w-14 h-2 rounded-full bg-black/60 overflow-hidden inline-flex">
                <span className="h-full bg-gradient-to-r from-rose-500 to-amber-400" style={{ width: '87%' }} />
              </span>
            </button>

            <button
              type="button"
              onClick={() => void handleCopyTrojanBrag()}
              className={`px-3 py-1.5 rounded-lg font-label-sm text-[11.5px] font-extrabold whitespace-nowrap transition-all ${
                trojanBragCopied
                  ? 'bg-emerald-400 text-zinc-950'
                  : 'bg-zinc-900 hover:bg-zinc-800 border border-amber-400/45 text-amber-300'
              }`}
            >
              {trojanBragCopied
                ? '✓ 가족방 무료 쿠폰 3장 생색 문구 복사됨!'
                : '🎁 사은품 [가족 라운지 1년 무료권 3장] 단톡방에 뿌리기'}
            </button>
          </div>
        )}
      </div>

      {/* 2. 필수 액션 버튼 바 (크기·여백 통일 & 모바일 줄바꿈 깨짐 방지 whitespace-nowrap) */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* 전면 배치: 내 얼굴로 학창 시절 사진 1초 만에 찾기 */}
          <button
            type="button"
            onClick={() => {
              void findMySchoolDaysPhotosFast();
              if (onNavigateToFeed) onNavigateToFeed();
            }}
            className="px-4 py-2.5 rounded-xl bg-primary-container hover:opacity-95 text-zinc-950 font-label-md text-[13px] font-extrabold shadow-sm flex items-center gap-1.5 shrink-0 whitespace-nowrap transition-all"
          >
            <span>🎯 내 얼굴로 학창 시절 사진 1초 만에 찾기</span>
          </button>

          {/* 투트랙 탭: [🎞️ 응답하라 1989 (추억)] (기본값) vs [🍻 최근 우리들 (근황)] */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setClubFeedTrack('memories_1989')}
              className={`px-4 py-2.5 rounded-xl font-label-md text-[13px] font-extrabold border transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                clubFeedTrack === 'memories_1989'
                  ? 'bg-amber-400 text-zinc-950 border-amber-400 shadow-sm'
                  : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-white/10'
              }`}
            >
              <span>🎞️ 응답하라 {alumniGradYear} (추억)</span>
            </button>

            <button
              type="button"
              onClick={() => setClubFeedTrack('recent_now')}
              className={`px-4 py-2.5 rounded-xl font-label-md text-[13px] font-extrabold border transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                clubFeedTrack === 'recent_now'
                  ? 'bg-primary-container text-zinc-950 border-primary-container shadow-sm'
                  : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-white/10'
              }`}
            >
              <span>🍻 최근 우리들 (근황)</span>
            </button>
          </div>
        </div>

        {/* 우측 보조 버튼: 미승인 연도 제보 일괄 승인 & 스캔 사진 스틱 태깅 */}
        <div className="flex flex-wrap items-center gap-2">
          {pendingProposals.length > 0 && (
            <button
              type="button"
              onClick={() => approveAllAnalogYearProposals()}
              className="px-3.5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-sm text-[12px] font-extrabold shrink-0 whitespace-nowrap"
            >
              👑 ✓ 멤버 연도 제보 일괄 승인 ({pendingProposals.length}건)
            </button>
          )}
          {onOpenWaitingRoom && (
            <button
              type="button"
              onClick={onOpenWaitingRoom}
              className="px-3.5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-primary-container font-label-sm text-[12px] font-bold shrink-0 whitespace-nowrap"
            >
              🏷️ 옛날 스캔 사진 스틱 태깅 →
            </button>
          )}
        </div>
      </div>

      {/* 3. 한 줄 요약 안내 (알림 클린존) */}
      <div className="px-3.5 py-2 rounded-xl bg-zinc-950/80 border border-white/10 flex items-center justify-between gap-2">
        <p className="font-body-sm text-[12px] text-zinc-300 font-medium truncate">
          🔔 <strong>알림 클린존:</strong> 최근 친목 사진은 전체 알림을 울리지 않으며, &lsquo;과거 추억 사진 업로드&rsquo; 또는 &lsquo;내 얼굴이 발견된 경우&rsquo;에만 알림이 발송됩니다.
        </p>
      </div>
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
      title: '소형 클럽',
      capacity: '20명 기준 (방 1개)',
      monthly: '월 4,900원',
      yearly: '연 49,000원',
      gpuDaily: '24시간 서버 도우미 일 1,000원',
      monthlyPlanId: 'club_small_4900',
      yearlyPlanId: 'club_small_year_49000',
    },
    {
      id: 'medium',
      title: '중형 클럽',
      capacity: '100명 기준 (방 1개)',
      monthly: '월 7,900원',
      yearly: '연 79,000원',
      gpuDaily: '24시간 서버 도우미 일 2,000원',
      monthlyPlanId: 'club_medium_7900',
      yearlyPlanId: 'club_medium_year_79000',
    },
    {
      id: 'large',
      title: '대형 클럽',
      capacity: '인원 제한 없음 (방 1개)',
      monthly: '월 14,900원',
      yearly: '연 149,000원',
      gpuDaily: '24시간 서버 도우미 일 3,000원',
      monthlyPlanId: 'club_large_14900',
      yearlyPlanId: 'club_large_year_149000',
    },
  ];

  const goToMainFeed = () => {
    setDesktopTab('dashboard');
    setMobileTab('search');
  };

  return (
    <main className="flex-1 w-full max-w-[1360px] mx-auto px-5 md:px-8 py-6 flex flex-col gap-5">
      {/* ─────────────── 👤 개인 라운지: 1단(온보딩 가로 3열 카드) ➔ 2단(전체 모수 vs 무료체험 범위 + 시작/완료 버튼) ➔ 3단(브리핑 결과 & 정리➔원복 안전 체험) ─────────────── */}
      {activeLoungeType === 'personal' && (
        <>
          {/* 1단: 개인 라운지가 무엇을 하는 곳인지 한눈에 보여주는 가로형 온보딩 카드 (AI 투시검색 몬스터 | AI 클린 몬스터 | AI 설정 몬스터) */}
          <section className="p-5 md:p-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-4">
            <div>
              <h1 className="font-headline-md text-[20px] md:text-[22px] text-white font-bold">
                개인 라운지 — AI 투시검색 몬스터 · AI 클린 몬스터 · AI 설정 몬스터
              </h1>
              <p className="font-body-sm text-[13px] text-zinc-400 mt-1">
                클라우드에 파일을 올리지 않고 내 기기 안에서 <strong>사진·영상·문서 1초 투시검색</strong>과 <strong>AI 클린 몬스터 종합건강검진·대화형 컨설팅</strong>을 수행합니다.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              <div className="p-4 rounded-xl bg-zinc-950/80 border border-white/10 flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-headline-sm text-[15px] text-white font-bold">
                    AI 투시검색 몬스터
                  </span>
                  <span className="px-2 py-0.5 rounded bg-primary-container/15 text-primary-container text-[10.5px] font-extrabold">
                    {isStoreAppMode ? '1초 로컬 투시검색' : '월 1,900원 (연 19,000원)'}
                  </span>
                </div>
                <p className="font-body-sm text-[12.5px] text-zinc-300 leading-relaxed">
                  사진·동영상 구간·내 PC 서류(PDF·계약서)를 <strong>1초 만에</strong> 찾아주며, <strong>동일 내용 중복 사진은 최고화질 원본 1장만 남기고 연사는 한눈에 펼쳐 유저가 1장을 직접 선택(Pick)</strong>하는 부가서비스를 제공합니다.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-950/80 border border-white/10 flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-headline-sm text-[15px] text-white font-bold">
                    AI 클린 몬스터
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 text-[10.5px] font-extrabold">
                    {isStoreAppMode ? 'AI 미디어 주치의 진단' : '기기 1대당 1,900원'}
                  </span>
                </div>
                <p className="font-body-sm text-[12.5px] text-zinc-300 leading-relaxed">
                  {isStoreAppMode ? (
                    <>
                      내 사진첩 <strong>중복·유사 사진, 영수증·스크린샷·일회성 사물 메모</strong>를 AI 주치의가 정밀 진단하고, <strong>대화형 상담 가이드</strong>를 통해 30일 안전 대기함 격리 및 PC 마스터 연동 정리를 유저가 직접 결정합니다.
                    </>
                  ) : (
                    <>
                      모바일·PC <strong>바탕화면 정리(쓰레기 아이콘·미사용 앱 분류/동결·어르신 큰 아이콘·PC 중복파일/바로가기 분리)</strong>와 <strong>전기·CPU·메모리 먹는 유령 모듈 제거</strong>를 종합검진하고, <strong>LLM 대화형 상담 가이드</strong>로 각 항목을 유저가 직접 결정합니다.
                    </>
                  )}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-950/80 border border-white/10 flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-headline-sm text-[15px] text-white font-bold">
                    AI 설정 몬스터
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[10.5px] font-extrabold">
                    정식 스토어 · 공인 설치
                  </span>
                </div>
                <p className="font-body-sm text-[12.5px] text-zinc-300 leading-relaxed">
                  안드로이드(Google Play / 공식 APK), iOS(App Store / 공식 TestFlight), Windows PC(MS 공식 인증서 서명 설치파일) 정식 설치 방식으로 내 폰과 PC를 1초 만에 안전하게 연결합니다.
                </p>
              </div>
            </div>
          </section>

          {/* 2단: 무료체험 안내 (내 기기 총 파일 모수 vs 무료체험 분석 수량) + 우측 [무료체험 시작] / [완료] 버튼 */}
          <section className="p-5 md:p-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-5">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex flex-col gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-headline-sm text-[18px] text-white font-bold">
                    ✨ 개인 라운지 무료체험 브리핑 진단
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-md bg-zinc-900 border border-white/10 text-primary-container font-label-sm text-[11.5px] font-bold">
                    ⏱️ 소요 시간: 약 30초
                  </span>
                </div>

                {/* 내 기기 전체 파일 총량 vs 무료체험 샘플 해부 범위 한눈에 대조 */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-[12.5px]">
                  <span className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-white/10 text-zinc-200 whitespace-nowrap">
                    📊 <strong>내 기기 전체 보유량:</strong> 사진 <strong>{totalDevicePhotos}장</strong> · 영상 <strong>{totalDeviceVideos}개</strong> · 문서 <strong>{totalDeviceDocs}건</strong>
                  </span>
                  <span className="hidden sm:inline text-zinc-400 font-bold">➔</span>
                  <span className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-primary-container/40 text-white whitespace-nowrap">
                    🔬 <strong>무료체험 샘플 분석:</strong> 🎬 영상 <strong>{trialSampleVideos}개 해부</strong> · 🖼️ 사진 <strong>{trialSamplePhotos}장 분석</strong> · 📁 문서 <strong>{trialSampleDocs}건 분석</strong>
                  </span>
                </div>
              </div>

              {/* 우측: 실행 전 [무료체험 시작] ➔ 실행 후 [✓ 완료 (비활성)] + [다시 체험하기] */}
              <div className="flex items-center gap-2 shrink-0">
                {personalTrialStatus === 'idle' && (
                  <button
                    type="button"
                    onClick={handleStartPersonalTrial}
                    className="px-6 py-3 rounded-xl bg-primary-container hover:opacity-95 text-zinc-950 font-headline-sm text-[14px] font-extrabold shadow-sm transition-all whitespace-nowrap cursor-pointer"
                  >
                    🚀 무료체험 시작
                  </button>
                )}

                {personalTrialStatus === 'running' && (
                  <button
                    type="button"
                    disabled
                    className="px-6 py-3 rounded-xl bg-zinc-800 border border-white/15 text-zinc-300 font-headline-sm text-[14px] font-bold whitespace-nowrap cursor-wait"
                  >
                    ⏳ 영상 3개 · 사진 100장 · 문서 15건 분석 중...
                  </button>
                )}

                {personalTrialStatus === 'done' && (
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
                      onClick={handleStartPersonalTrial}
                      className="px-3.5 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-900 border border-white/15 text-primary-container font-label-sm text-[12px] font-bold whitespace-nowrap"
                    >
                      🔄 다시 체험하기
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* 3단: 무료체험 실행 완료 시 열리는 진단 브리핑 + [정리 ➔ 원복] 안전 체험 */}
            {personalTrialStatus === 'done' ? (
              <div className="pt-4 border-t border-white/10 flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-headline-sm text-[15.5px] text-white font-bold">
                    📊 1. 전체 모수 대비 무료체험 AI 해부 브리핑 (클릭하여 결과 확인)
                  </span>
                  <span className="font-label-mono text-[11.5px] text-emerald-400 font-bold">
                    ✓ 외부 서버 전송 0 Byte (100% 내 PC 로컬 분석)
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

                {/* 🛡️ 2. 안전 확인 필수 코스: [정리(대기함 이동)] 버튼 ➔ [원복(되돌리기)] 버튼 직접 눌러보기 + 30일 보관 안내 */}
                <div className="p-4 md:p-5 rounded-xl bg-zinc-950 border border-white/15 flex flex-col gap-3.5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-headline-sm text-[15px] text-white font-bold">
                          🛡️ 2. 안심 안전망 직접 검증 — &lsquo;정리&rsquo; 후 &lsquo;원복&rsquo;까지 직접 눌러보세요!
                        </span>
                        <span className="px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[11px] font-extrabold">
                          즉시 영구삭제 절대 없음 · 30일 보관 후 휴지통 이동
                        </span>
                      </div>
                      <p className="font-body-sm text-[12.5px] text-zinc-300">
                        정리(삭제)된 항목은 바로 사라지지 않고 내 PC의 <strong>[세이씨_정리대기함]에 한 달(30일) 동안 안전하게 보관된 후에야 휴지통으로 이동</strong>합니다. 아래 <strong>① 정리 ➔ ② 원복</strong> 버튼을 순서대로 눌러 안전함을 직접 확인해 보세요.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {/* 1단계: 정리(대기함 이동) 버튼 */}
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
                          ? '✓ ① 정리 대기함 이동됨'
                          : '🧹 ① 샘플 정리(대기함 이동) 눌러보기'}
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
                          ? '✓ ② 0.5초 원복 확인 완료!'
                          : '↩️ ② 0.5초 원복(되돌리기) 눌러보기'}
                      </button>

                      <button
                        type="button"
                        onClick={() => void openLocalFolder('quarantine')}
                        className="px-3.5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-300 font-label-sm text-[12px] font-bold whitespace-nowrap"
                      >
                        📂 정리 대기함 폴더 열기
                      </button>
                    </div>
                  </div>

                  {trialSafetyStep === 'quarantined' && (
                    <div className="px-3.5 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[12.5px] text-amber-200 flex items-center justify-between gap-2">
                      <span>
                        📦 <strong>선택한 샘플 {trialMovedIds.length}건</strong>이 <strong>[세이씨_정리대기함]</strong>(30일 보관소)으로 안전 격리되었습니다. 이제 우측의 <strong>[↩️ ② 0.5초 원복 눌러보기]</strong> 버튼을 눌러보세요!
                      </span>
                    </div>
                  )}

                  {trialSafetyStep === 'restored' && (
                    <div className="px-3.5 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[12.5px] text-emerald-300 flex items-center justify-between gap-2">
                      <span>
                        ✅ <strong>[원복 검증 완료!]</strong> 정리 대기함에 있던 파일들이 0.5초 만에 원래 폴더로 100% 되돌아왔습니다. 실수로 지워질 걱정 없이 안심하고 정리하세요!
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setDesktopTab('trash');
                          setMobileTab('trash');
                        }}
                        className="px-3 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-primary-container font-label-sm text-[11.5px] font-bold whitespace-nowrap"
                      >
                        AI 클린 몬스터 이동 →
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="px-4 py-3 rounded-xl bg-zinc-950/70 border border-white/10 flex items-center justify-between gap-2">
                <span className="font-body-sm text-[12.5px] text-zinc-400">
                  💡 우측의 <strong>[🚀 무료체험 시작]</strong> 버튼을 누르면 전체 파일 중 <strong>영상 3개 해부 · 사진 100장 분석 · 문서 15건 분석</strong> 브리핑과 함께 <strong>[정리 ➔ 원복 안전 체험]</strong>을 바로 해보실 수 있습니다.
                </span>
              </div>
            )}

            {/* 개인 라운지 하단: 스토어 클린 모드 시 [내 이메일/카톡으로 PC 마스터 주소 보내기] 노출 / PC 마스터 모드 시 요금제 노출 */}
            {isStoreAppMode ? (
              <div className="pt-3 border-t border-white/10">
                <PcMasterQuickSendPanel />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-white/10">
                <div className="p-5 rounded-xl bg-zinc-950/80 border border-white/10 flex flex-col justify-between gap-4">
                  <div className="flex flex-col gap-1.5">
                    <span className="font-label-sm text-[11.5px] text-amber-400 font-bold">
                      AI 클린 몬스터 — 디지털 종합건강검진 &amp; 대화형 컨설팅
                    </span>
                    <div className="font-headline-md text-[24px] text-white font-black">
                      기기 1대당 1,900원
                    </div>
                    <p className="font-body-sm text-[12px] text-zinc-400 leading-relaxed">
                      모바일·PC 바탕화면 정리(미사용 앱 구분/동결·어르신 큰 아이콘·PC 중복파일 및 바로가기 분리) + 전기 먹는 유령 모듈 제거로 CPU·메모리 속도 향상. AI 주치의와 대화하며 항목별로 유저가 직접 결정하고 언제든 0.5초 원복됩니다.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => activatePricingPlan('personal_single_2900')}
                    className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-white/15 text-white font-label-md text-[12.5px] font-bold transition-colors whitespace-nowrap"
                  >
                    AI 클린 몬스터 (기기 1대당 1,900원)
                  </button>
                </div>

                <div className="p-5 rounded-xl bg-zinc-900 border border-primary-container/50 flex flex-col justify-between gap-4">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <span className="font-label-sm text-[11.5px] text-primary-container font-bold">
                        AI 투시검색 몬스터 + 월 1회 AI 클린 몬스터 무료 왕진
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-400 text-zinc-950 font-label-sm text-[10.5px] font-extrabold whitespace-nowrap">
                        초기 100명 한정 연 19,000원 평생권 프로모션
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-headline-md text-[24px] text-white font-black">
                        월 1,900원
                      </span>
                      <span className="font-label-mono text-[13px] text-primary-container font-bold">
                        (연 19,000원)
                      </span>
                    </div>
                    <p className="font-body-sm text-[12px] text-zinc-300 leading-relaxed">
                      전체 사진({totalDevicePhotos}장)·영상({totalDeviceVideos}개)·문서({totalDeviceDocs}건) <strong>1초 투시검색</strong> + 중복 사진 최고화질 원본 보존 &amp; 연사 1장 선택 부가서비스 + <strong>초기 100명 한정 연 19,000원 평생권 프로모션!</strong>
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('personal_sub_3900')}
                      className="py-2.5 rounded-xl bg-primary-container text-zinc-950 font-label-md text-[12.5px] font-extrabold whitespace-nowrap"
                    >
                      월 1,900원 시작
                    </button>
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('personal_year_35000')}
                      className="py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-md text-[12.5px] font-extrabold whitespace-nowrap"
                    >
                      연 19,000원 (100명 평생권)
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-white/10">
                <div className="p-5 rounded-xl bg-zinc-950/80 border border-white/10 flex flex-col justify-between gap-4">
                  <div className="flex flex-col gap-1.5">
                    <span className="font-label-sm text-[11.5px] text-zinc-300 font-bold">
                      🏠 우리집 단독 — 우리집 전용 시크릿 라운지 (방 1개)
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="font-headline-md text-[24px] text-white font-black">
                        월 5,900원
                      </span>
                      <span className="font-label-mono text-[13px] text-zinc-300 font-bold">
                        (연 59,000원)
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
                      className="py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-white/15 text-white font-label-md text-[12.5px] font-bold"
                    >
                      월 5,900원 시작
                    </button>
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('family_home_year_59000')}
                      className="py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-200 font-label-md text-[12.5px] font-bold"
                    >
                      연 59,000원 시작
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
                      <span className="font-label-mono text-[13px] text-primary-container font-bold">
                        (연 89,000원)
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
                      className="py-2.5 rounded-xl bg-primary-container text-zinc-950 font-label-md text-[12.5px] font-extrabold"
                    >
                      양가 3방 월 8,900원
                    </button>
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('family_three_year_89000')}
                      className="py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-primary-container/40 text-primary-container font-label-md text-[12.5px] font-bold"
                    >
                      연 89,000원 시작
                    </button>
                  </div>
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
                동창회·모임 총무(👑 방장) PC 마스터 연동으로 회원 전원이 폰 용량 걱정 없이 <strong>13KB 초경량 열람</strong>과 <strong>5MB 무손실 원본 1초 소환</strong>을 누립니다.
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
                    ⚡ 13KB 초경량 열람 &amp; 5MB 원본 소환
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 text-[10.5px] font-extrabold">
                    전 회원 무료 열람
                  </span>
                </div>
                <p className="font-body-sm text-[12.5px] text-zinc-300 leading-relaxed">
                  카톡방 사진처럼 만료되지 않고 13KB 캐시로 1초 만에 열람하며, 간직할 사진만 총무 PC에서 5MB 무손실 원본으로 1초 소환합니다.
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

            {/* 클럽 라운지 하단: 스토어 클린 모드 시 [내 이메일/카톡으로 PC 마스터 주소 보내기] 노출 / PC 마스터 모드 시 요금제 노출 */}
            {isStoreAppMode ? (
              <div className="pt-3 border-t border-white/10">
                <PcMasterQuickSendPanel />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-3 border-t border-white/10">
                {CLUB_TIERS.map((tier) => {
                  const isSelected = clubSizeTier === tier.id;
                  return (
                    <div
                      key={tier.id}
                      onClick={() => setClubSizeTier(tier.id)}
                      className={`p-4 rounded-xl cursor-pointer transition-all flex flex-col justify-between gap-3 border ${
                        isSelected
                          ? 'bg-zinc-900 border-primary-container'
                          : 'bg-zinc-950/80 border-white/10 hover:bg-zinc-900/60'
                      }`}
                    >
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-headline-sm text-[15px] text-white font-bold">
                            {tier.title}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-zinc-800 border border-white/10 text-zinc-300 font-label-mono text-[10.5px]">
                            {tier.capacity}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="font-headline-md text-[22px] text-white font-black">
                            {tier.monthly}
                          </span>
                          <span className="font-label-mono text-[12px] text-primary-container font-bold">
                            ({tier.yearly})
                          </span>
                        </div>
                        <span className="font-label-mono text-[11px] text-zinc-400">
                          ⚡ {tier.gpuDaily}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-white/10">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            activatePricingPlan(tier.monthlyPlanId);
                          }}
                          className="py-2 rounded-lg bg-primary-container text-zinc-950 font-label-sm text-[11.5px] font-extrabold"
                        >
                          {tier.monthly}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            activatePricingPlan(tier.yearlyPlanId);
                          }}
                          className="py-2 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-white/15 text-zinc-200 font-label-sm text-[11.5px] font-bold"
                        >
                          {tier.yearly}
                        </button>
                      </div>
                    </div>
                  );
                })}
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
    </main>
  );
};

/**
 * 2번 서브메뉴(메인 피드 & 검색) 상단에 라운지 성격별로 표시되는 전용 컨트롤 바
 * - 개인 라운지: null (얼굴/여권 바 완전 비노출, AI 투시검색 몬스터 바로 시작)
 * - 패밀리 라운지: [🏠 우리집 / 🏡 본가(친가) / 🌸 처가(친정)] 서브 룸 캡슐 전환 + 방별 별명 알약([👑 멀린], [👑 둘째사위], [은숙] 등) 1초 검색 통합 바
 * - 클럽 라운지: Text-to-Banner 자동 간판('성동고 89회 동창회') + [🎯 내 얼굴로 학창 시절 사진 1초 만에 찾기] + [🎞️ 응답하라 1989 (추억) / 🍻 최근 우리들 (근황)] 투트랙 탭 + 13KB 캐시 & 5MB 무손실 원본 P2P 소환 바
 * - 스쿨 라운지: 낮(학교/학원) 로컬 캐시 1초 구간 점프 + 스쿨방 별명 알약([지우짱] 등) + [🎉 매월 1일 폰 용량 클리어 리포트] 배너
 */
export const LoungeFeedContextBanner: React.FC = () => {
  const {
    activeLoungeType,
    activeFamilyRoom,
    setActiveFamilyRoom,
    faceClusters,
    runTextQuery,
    photos,
    setShowFaceRegistryModal,
    setDesktopTab,
    setMobileTab,
  } = useSaySeeStore();

  const [p2pOriginalSummoned, setP2pOriginalSummoned] = useState(false);
  const [monthlyReportDismissed, setMonthlyReportDismissed] = useState(false);

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
            <button
              key={c.clusterId}
              type="button"
              onClick={() => void runTextQuery(queryTarget)}
              title={`클릭 시 "${queryTarget}" 1초 검색`}
              className="px-3 py-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-primary-container/35 text-primary-container font-label-sm text-[12px] font-bold flex items-center gap-1.5 transition-colors shrink-0 whitespace-nowrap"
            >
              <img
                src={c.avatarUrl || c.representativePhoto}
                alt={displayPersona}
                className="w-4 h-4 rounded-full object-cover shrink-0"
              />
              <span>{isRoomCreator ? `👑 ${displayPersona}` : displayPersona}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setShowFaceRegistryModal(true)}
          className="px-3 py-1.5 rounded-full bg-zinc-950 hover:bg-zinc-800 border border-white/15 text-zinc-300 font-label-sm text-[11.5px] font-bold ml-0.5 shrink-0 whitespace-nowrap"
        >
          🛂 여권 관리
        </button>
      </div>
    );
  };

  if (activeLoungeType === 'family') {
    return (
      <div className="p-3.5 md:p-4 rounded-2xl bg-[#18181B] border border-white/10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-400/35 text-emerald-300 font-label-sm text-[11.5px] font-extrabold flex items-center gap-1.5 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            🛂 여권 연동
          </span>
          {FAMILY_ROOMS.map((room) => {
            const active = activeFamilyRoom === room;
            return (
              <button
                key={room}
                type="button"
                onClick={() => setActiveFamilyRoom(room)}
                className={`px-3.5 py-2 rounded-xl font-label-sm text-[12.5px] font-bold border transition-all shrink-0 whitespace-nowrap ${
                  active
                    ? 'bg-primary-container text-zinc-950 border-primary-container font-extrabold shadow-sm'
                    : 'bg-zinc-900 text-zinc-300 border-white/10 hover:bg-zinc-800'
                }`}
              >
                {room === '우리집' ? '🏠 우리집' : room === '본가(친가)' ? '🏡 본가(친가)' : '🌸 처가(친정)'}
              </button>
            );
          })}
        </div>

        {renderMemberPersonaPills(`[${activeFamilyRoom}] 별명:`)}
      </div>
    );
  }

  if (activeLoungeType === 'club') {
    return (
      <div className="flex flex-col gap-3">
        {/* 최상단: 4050 동창회 Text-to-Banner 자동 간판 + 1초 학창시절 찾기 + 응답하라 투트랙 탭 */}
        <AlumniRetroBannerAndTwoTrackBar
          onOpenWaitingRoom={() => {
            setDesktopTab('trash');
            setMobileTab('trash');
          }}
        />

        {/* 하단 1줄: 모임 별명 1초 검색 알약 + 5MB 무손실 원본 1초 소환 */}
        <div className="px-4 py-3 rounded-2xl bg-[#18181B] border border-white/10 flex flex-wrap items-center justify-between gap-3">
          {renderMemberPersonaPills('모임 별명 1초 검색:')}

          <button
            type="button"
            onClick={() => setP2pOriginalSummoned((v) => !v)}
            className={`px-3.5 py-2 rounded-xl font-label-sm text-[12px] font-extrabold transition-all border shrink-0 whitespace-nowrap ${
              p2pOriginalSummoned
                ? 'bg-primary-container text-zinc-950 border-primary-container'
                : 'bg-zinc-900 hover:bg-zinc-800 text-primary-container border-primary-container/50'
            }`}
          >
            {p2pOriginalSummoned
              ? '✓ 5MB 무손실 원본 소환 완료'
              : '📥 5MB 무손실 원본 P2P 1초 소환'}
          </button>
        </div>
      </div>
    );
  }

  // student ('🎒 스쿨 라운지')
  return (
    <div className="flex flex-col gap-2.5">
      {!monthlyReportDismissed && (
        <div className="px-4 py-3 rounded-2xl bg-[#18181B] border border-emerald-400/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-400 text-zinc-950 font-label-sm text-[11.5px] font-extrabold whitespace-nowrap">
              🎉 월간 용량 클리어
            </span>
            <span className="font-body-sm text-[12.5px] text-zinc-100 font-medium truncate">
              이번 달 우리반 원본 사진 {photos.length}장 &amp; 영상이 👑 방장 PC로 안전 이관되어{' '}
              <strong className="text-emerald-300">내 폰 여유 공간 +14.2GB</strong> 확보!
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMonthlyReportDismissed(true)}
            className="px-3 py-1.5 rounded-lg bg-zinc-950/80 hover:bg-zinc-800 text-zinc-400 hover:text-white font-label-sm text-[11.5px] shrink-0 whitespace-nowrap"
          >
            ✕ 닫기
          </button>
        </div>
      )}

      <div className="px-4 py-3 rounded-2xl bg-[#18181B] border border-white/10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 font-label-sm text-[11.5px] font-extrabold whitespace-nowrap">
            🛂 여권 연동
          </span>
          <span className="font-label-sm text-[12px] text-primary-container font-bold">
            ⚡ 타임캡슐 로컬 캐시 (낮에 👑 방장 PC 꺼져 있어도 1초 만에 재생)
          </span>
        </div>
        {renderMemberPersonaPills('스쿨방 별명 1초 검색:')}
      </div>
    </div>
  );
};

/**
 * 3번 서브메뉴 `[⏳ AI 인덱싱 대기실]` (패밀리 / 클럽 / 스쿨 라운지 전용)
 * - 수동 검사가 아니라 AI 인덱싱(Gemma 2 768d 벡터 + 13KB 캐시 변환) 시간 벌기용 안심 버퍼 뷰!
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

  const memberActiveHints = swarmFaceCandidates.filter((c) => !c.applied && !c.passedToHostQueue);
  const hostCleanupQueue = swarmFaceCandidates.filter((c) => !c.applied);
  const pendingAnalogProposals = analogYearProposals.filter((p) => !p.approvedByHost);

  const queuePhotos = photos.filter((p) => !p.quarantined).slice(0, 8);

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
      badge: `⏳ 패밀리 AI 인덱싱 대기실 (${activeFamilyRoom} 베스트컷 전송 버퍼)`,
      title: '가족들이 보낸 베스트 컷이 AI 색인 & 13KB 캐시 변환을 거쳐 피드로 자동 배포됩니다',
      subtitle:
        '누군가 수동으로 검열하는 공간이 아닙니다! 가족 스마트폰에서 올라온 고화질 사진·영상이 마스터 PC(또는 24시간 서버 도우미)에서 Gemma 2 768차원 실명·상황 인덱싱을 마치는 동안 머무는 안심 시간 벌기용 버퍼입니다.',
      bufferReason: '우리집 · 본가(친가) · 처가(친정) 방 분리 태그 및 가족 얼굴 자동 매칭 진행 중',
      senderLabels: ['아내(은숙) 아이폰', '남편(진욱) 갤럭시', '우리딸 아이폰', '본가 어머님 폰'],
    },
    club: {
      badge: '⏳ 클럽 AI 인덱싱 대기실 (모임컷 수합 & 옛날 스캔 사진 스틱 태깅 버퍼)',
      title: '참석자 폰 사진과 EXIF 없는 옛날 앨범 스캔본이 마스터 엔진에서 자동 색인·캐싱 중입니다',
      subtitle:
        '학창 시절 종이 앨범 스캔본(EXIF 없음)은 [🏷️ 스틱(Chip) 연쇄 태깅]으로 1초 만에 1980년대 여권 바구니(1989~1980)에 꽂아 넣고, 헷갈리는 연도는 동기들의 제보를 받아 👑 방장이 원터치로 일괄 승인합니다.',
      bufferReason: '동창회·모임 얼굴 클러스터링 & 1980s 아날로그 스캔 사진 타임라인 매핑 진행 중',
      senderLabels: ['김총무 갤럭시 S24', '박회장 아이폰 16 Pro', '이프로 갤럭시', '최회원 아이폰'],
    },
    student: {
      badge: '⏳ 스쿨 라운지 AI 인덱싱 대기실 (인생샷·축제 영상 수합 버퍼)',
      title: '친구들이 보낸 인생샷과 골인 영상이 방장 게이밍 PC가 켜질 때 자동 색인·압축 배포됩니다',
      subtitle:
        '학교·학원에 있는 낮 시간 동안 친구들이 찍어 올린 사진·영상을 안전하게 모아 두었다가, 하교 후 방장의 집 게이밍 PC가 켜지는 즉시 초고속 Gemma 2 인덱싱을 거쳐 전 멤버 타임캡슐 피드로 쏴주는 대기 버퍼입니다.',
      bufferReason: gpuHelper24hActive
        ? '⚡ 24시간 GPU 클라우드 도우미가 즉시 인덱싱 대행 중!'
        : '방장 게이밍 PC(RTX) 하교 후 부팅 대기 중 · 켜지는 즉시 0.1초 자동 색인 배포',
      senderLabels: ['민준 아이폰', '서연 갤럭시', '도윤 아이폰', '하은 아이폰'],
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
      `✓ 동기들이 제보한 옛날 사진 연도/장소 ${count}건이 👑 방장 일괄 결재로 느슨한 타임라인 · 계절↔월(Month) 양방향 인덱스 · 세이씨 여권 1980년대 바구니(1989~1980)에 즉시 반영되었습니다!`
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
            <span className="px-2.5 py-0.5 rounded-md bg-zinc-900 border border-white/10 text-emerald-300 font-label-mono text-[11px] font-bold">
              ✓ 수동 검열 ZERO · 100% 자율 AI 인덱싱 버퍼
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
                  ? '✓ 방장에게 "집 게이밍 PC 켜!" 알림 전송됨'
                  : '👉 방장에게 "집 게이밍 PC 켜!" 콕 찌르기'}
              </button>
            )}

            <button
              type="button"
              onClick={() => setInstantFlushed(true)}
              className="px-3.5 py-1.5 rounded-xl bg-primary-container text-zinc-950 font-label-sm text-[12px] font-extrabold"
            >
              {instantFlushed
                ? '✓ 전 항목 인덱싱 & 피드 배포 완료!'
                : '⚡ 지금 즉시 인덱싱 완료 & 피드 배포하기'}
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
                ? `대기 큐 0건 — 수합된 사진 ${queuePhotos.length}장 & 동영상 ${videoSceneItems.length}개 전 구간이 피드에 100% 배포되었습니다!`
                : `${currentMeta.bufferReason} (사진 ${queuePhotos.length}장 · 동영상 ${videoSceneItems.length}개)`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {!gpuHelper24hActive && (
              <button
                type="button"
                onClick={() => {
                  if (isStoreAppMode) {
                    setShowProModal(true);
                  } else {
                    activateGpuHelper24h(
                      activeLoungeType === 'club' ? 'club_small_1000' : 'standard_1000'
                    );
                  }
                }}
                className="px-3 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-primary-container/40 text-primary-container font-label-sm text-[11px] font-bold"
              >
                {isStoreAppMode
                  ? '💻 카톡·이메일로 ‘내 PC 연동 시작 가이드’ 보내두기'
                  : '⚡ 방장 PC가 꺼져 있나요? 1일 1,000원 GPU 서버 도우미 즉시 가동'}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setDesktopTab('dashboard');
                setMobileTab('search');
              }}
              className="px-3 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-200 font-label-sm text-[11px] font-bold"
            >
              배포된 피드 보러가기 →
            </button>
          </div>
        </div>

        {/* 🎯 ✨ AI 얼굴 자동 매칭 도우미 + 👑 방장 누락분 & 연도 제보 일괄 승인 */}
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
      </section>

      {/* 3 & 4. EXIF 없는 옛날 스캔 사진용 '스틱(Chip) 연쇄 태깅' & [❓ 언제/어디인가요?] 집단 지성 연도 제보 ➔ 👑 방장 원터치 일괄 결재 */}
      <section className="p-5 md:p-6 rounded-2xl bg-[#18181B] border border-amber-400/35 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-amber-400 text-zinc-950 font-label-sm text-[11px] font-extrabold">
                🎞️ EXIF 없는 옛날 종이 사진 · 스틱(Chip) 1초 연쇄 태깅
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 font-label-mono text-[11px] font-bold">
                🛂 1989 입력 즉시 ➔ 세이씨 여권 [1989~1980] 10년 바구니 강제 매핑
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-primary-container/15 border border-primary-container/40 text-primary-container font-label-mono text-[11px] font-bold">
                ⚡ 봄↔2·3·4·5월 / 가을↔9·10·11월 / 성동고 고유명사 양방향 자동 인덱싱
              </span>
            </div>
            <h2 className="font-headline-sm text-[17px] md:text-[18px] text-white font-bold mt-0.5">
              첫 번째 스캔 사진에 연도·장소·계절을 한 번만 치면 [🏷️ 스틱]이 생성되어, 두 번째 사진부터는 1초 만에 톡톡 찍어 바릅니다
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

      {/* 수합된 베스트컷 / 모임컷 / 인생샷 인덱싱 버퍼 그리드 */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <span className="font-headline-sm text-[15.5px] text-white font-bold">
            📥 최근 멤버 스마트폰에서 수합된 미디어 버퍼 ({queuePhotos.length}장)
          </span>
          <span className="font-label-mono text-[11.5px] text-zinc-400">
            장당 13KB 섀도우 캐시 + 768차원 의미·얼굴 벡터 자동 생성
          </span>
        </div>

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
                    className={`absolute top-2 left-2 px-2 py-0.5 rounded-md font-label-mono text-[10px] font-bold border ${
                      isDone
                        ? 'bg-emerald-950/90 border-emerald-400/50 text-emerald-300'
                        : 'bg-amber-950/90 border-amber-400/50 text-amber-300'
                    }`}
                  >
                    {isDone ? '✓ 13KB 캐시 · 피드 배포됨' : '⏳ Gemma 2 색인 중 (88%)'}
                  </div>
                </div>
                <div className="p-3 flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-200 font-bold truncate">{sender}</span>
                    <span className="text-zinc-500 font-mono">{photo.date.split(' ')[0]}</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 truncate">
                    {photo.tags.slice(0, 3).join(' · ') || '장면·얼굴 벡터 추출 완료'}
                  </p>
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
  const [familyShortsWatermark, setFamilyShortsWatermark] = useState('사랑하는 우리가족');
  const [clubShortsWatermark, setClubShortsWatermark] = useState('제주여고 89회 공식 갤러리');
  const [shortsExportToast, setShortsExportToast] = useState<string | null>(null);
  const [gamingPcAutoSyncAfterSchool, setGamingPcAutoSyncAfterSchool] = useState(true);
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

  const copyInviteLink = () => {
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2500);
  };

  const handleCopyTrojanCoupon = async () => {
    const text =
      '내가 클럽 평생권 끊어서 가족방 쿠폰 3장 받았는데, 선착순으로 줄 테니 쓸 사람?';
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

  const triggerShortsWatermarkPreview = (label: string) => {
    setShortsExportToast(
      `🎬 변천사 쇼츠 우측 하단 워터마크가 [SaySee] 대신 [${label}]로 적용되어 카톡·인스타 공유용 MP4에 각인되었습니다!`
    );
    setTimeout(() => setShortsExportToast(null), 3200);
  };

  if (activeLoungeType === 'personal') {
    return (
      <div className="p-6 rounded-2xl bg-[#18181B] border border-primary-container/40 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-primary-container text-zinc-950 font-label-sm text-[11.5px] font-extrabold">
              AI 설정 몬스터
            </span>
            {!isStoreAppMode && (
              <>
                <span className="px-2.5 py-0.5 rounded-md bg-zinc-900 border border-white/10 text-zinc-300 font-label-mono text-[11px]">
                  현재 플랜: {PLAN_BADGE_LABELS[activePricingPlan]}
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-amber-400 text-zinc-950 font-label-sm text-[11px] font-extrabold">
                  초기 100명 한정 연 19,000원 평생권 프로모션
                </span>
              </>
            )}
          </div>
          <h2 className="font-headline-sm text-[19px] text-white font-bold mt-1">
            내 PC↔폰 13KB 섀도우 자동 싱크 &amp; 상시 AI 색인 관리
          </h2>
          <p className="font-body-sm text-[12.5px] text-zinc-300">
            {isStoreAppMode
              ? '수만 장의 원본 사진·영상 고속 인덱싱과 라운지 마스터 관리는 데스크톱(PC) 엔진 연결이 필요합니다. 나중에 PC에서 바로 이어서 작업하실 수 있도록 연동 가이드를 보내두세요.'
              : '종합건강검진·대화형 청소는 AI 클린 몬스터(기기 1대당 1,900원)로, 상시 스마트폰↔PC 13KB 섀도우 캐시 자동 동기화 및 1초 검색은 AI 투시검색 몬스터 월 1,900원(연 19,000원 · 초기 100명 한정 평생권)으로 즉시 개통됩니다.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isStoreAppMode ? (
            <button
              type="button"
              onClick={() => setShowProModal(true)}
              className="px-4 py-2 rounded-xl bg-[#FEE500] hover:bg-[#FDD800] text-[#191919] font-label-sm text-[12.5px] font-extrabold"
            >
              💬 카톡·이메일로 ‘내 PC 연동 시작 가이드’ 보내두기
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => activatePricingPlan('personal_single_2900')}
                className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-200 font-label-sm text-[12px] font-bold"
              >
                AI 클린 몬스터 1,900원
              </button>
              <button
                type="button"
                onClick={() => activatePricingPlan('personal_sub_3900')}
                className="px-4 py-2 rounded-xl bg-primary-container text-zinc-950 font-label-sm text-[12.5px] font-extrabold"
              >
                AI 투시검색 월 1,900원
              </button>
              <button
                type="button"
                onClick={() => activatePricingPlan('personal_year_35000')}
                className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-sm text-[12px] font-extrabold"
              >
                연 19,000원 (100명 평생권)
              </button>
            </>
          )}
        </div>
      </div>
    );
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
              기본 <code>[SaySee]</code> 로고 대신 <strong>[{familyShortsWatermark}]</strong> 워터마크를 박아 카톡·인스타로 공유하면 다른 가족 모임의 연쇄 유입이 일어납니다.
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
              className="px-3.5 py-1.5 rounded-lg bg-primary-container text-zinc-950 font-label-sm text-[11.5px] font-extrabold whitespace-nowrap"
            >
              🎬 워터마크 적용 &amp; 쇼츠 미리보기
            </button>
          </div>
        </div>

        {shortsExportToast && (
          <div className="px-3.5 py-2 rounded-xl bg-emerald-500/15 border border-emerald-400/40 text-emerald-200 font-label-sm text-[12px] font-bold">
            {shortsExportToast}
          </div>
        )}
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
              👥 클럽 규모 설정 &amp; 회원 초대/강퇴 관리 (방 1개 기준)
            </span>
            <h2 className="font-headline-sm text-[19px] text-white font-bold mt-1">
              소(20명) · 중(100명) · 대(무제한) 클럽 설정 및 참석자 관리
            </h2>
            <p className="font-body-sm text-[12.5px] text-zinc-400">
              {isStoreAppMode
                ? '초대받은 클럽 회원은 모바일 앱에서 100% 무료로 모임 사진을 찾고 감상합니다. 방 개설 및 마스터 엔진 연동은 데스크톱(PC)에서 관리합니다.'
                : '각 클럽권은 방 1개 기준이며, 소모임/파트별 방 분리를 원할 경우 소형 클럽 등을 별도 추가 구매할 수 있습니다.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copyInviteLink}
              className="px-4 py-2 rounded-xl bg-primary-container text-zinc-950 font-label-sm text-[12px] font-extrabold"
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { id: 'small' as ClubSizeTier, label: '소형 클럽 (20명 기준)', price: isStoreAppMode ? '20명 이하 모임 방' : '월 4,900원 (연 49,000원)', plan: 'club_small_4900' as PricingPlanId },
            { id: 'medium' as ClubSizeTier, label: '중형 클럽 (100명 기준)', price: isStoreAppMode ? '100명 이하 동창·산악회' : '월 7,900원 (연 79,000원)', plan: 'club_medium_7900' as PricingPlanId },
            { id: 'large' as ClubSizeTier, label: '대형 클럽 (무제한)', price: isStoreAppMode ? '인원 무제한 총동창회' : '월 14,900원 (연 149,000원)', plan: 'club_large_14900' as PricingPlanId },
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

        {/* [치트키 3 & 4] 모임용 맞춤형 쇼츠 워터마크 커스텀 + 트로이 목마 가족방 무료 쿠폰 3장 */}
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
                자동 렌더링 변천사 쇼츠 우측 하단에 <code>[SaySee]</code> 대신 <strong>[{clubShortsWatermark}]</strong>를 박아 카톡·인스타로 공유하면 타 동창회·모임의 꼬리물기 유입이 일어납니다.
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
                className="px-3.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-sm text-[11.5px] font-extrabold whitespace-nowrap"
              >
                🎬 워터마크 적용 &amp; 쇼츠 각인
              </button>
              {!isStoreAppMode && (
                <button
                  type="button"
                  onClick={() => void handleCopyTrojanCoupon()}
                  className={`px-3.5 py-1.5 rounded-lg font-label-sm text-[11.5px] font-extrabold whitespace-nowrap ${
                    trojanBragCopied
                      ? 'bg-emerald-400 text-zinc-950'
                      : 'bg-zinc-900 hover:bg-zinc-800 border border-amber-400/45 text-amber-300'
                  }`}
                >
                  {trojanBragCopied
                    ? '✓ 가족방 무료권 3장 문구 복사됨!'
                    : '🎁 사은품 [가족방 1년 무료권 3장] 단톡방 생색'}
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
