import React, { useState } from 'react';
import { getActivePersonaForCluster, useSaySeeStore } from '../store/useSaySeeStore';
import type { ClubSizeTier, FamilyRoomId, LoungeType, PricingPlanId } from '../types/saysee';
import { FaceMemberInlineBar } from './FaceMemberRegistryModal';

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
    shortPrice: '단품 2,900원 · 월 3,900원',
    desc: '서류 19건 + 동영상 4개 해부 + 연사 진단 브리핑 보드 (내 기기 검색 & 청소)',
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
  personal_single_2900: '👤 개인 단품 클리어 (2,900원)',
  personal_sub_3900: '👤 개인 정기구독 (월 3,900원)',
  personal_year_35000: '👤 개인 연간구독 (연 35,000원)',
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
 * ⛳ 클럽 라운지 (4050 동창회 특화 UX)
 * 1) 생성형 맞춤형 간판 'Text-to-Banner' (복고풍 칠판 / 노을 진 운동장 그래픽 + '성동고 89회 동창회' + 초대장 카피 버튼)
 * 2) 첫 화면 검색 전면 배치 ([🎯 내 얼굴로 학창 시절 사진 0.04초 찾기]) & '추억 vs 근황' 투트랙 탭 ([🎞️ 응답하라 1989 (추억)] 기본 고정 / [🍻 최근 우리들 (근황)]) + 스마트 알림 클린존 배지
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
    runTextQuery,
    analogScannedPhotos,
    analogYearProposals,
    submitAnalogYearProposal,
    approveAllAnalogYearProposals,
  } = useSaySeeStore();

  const [inviteCopied, setInviteCopied] = useState(false);
  const [editingBannerKeyword, setEditingBannerKeyword] = useState(false);
  const [keywordDraft, setKeywordDraft] = useState(`${alumniSchoolName} ${alumniGradYear}`);
  const [fastSearchTriggered, setFastSearchTriggered] = useState(false);
  const [activeProposalPhotoId, setActiveProposalPhotoId] = useState<string | null>(null);
  const [proposalTextDraft, setProposalTextDraft] = useState('1989년 가을 소풍');
  const [proposalAuthorDraft, setProposalAuthorDraft] = useState('박회장');

  const cohortShort = String(alumniGradCohortNumber).padStart(2, '0');
  const bannerTitle = `${alumniSchoolName} ${cohortShort}회 동창회`;
  const inviteHookCopy = `네가 몰랐던 ${cohortShort}년 수학여행 네 사진 다 찾았다`;

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

  const handleApplyBannerKeyword = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = keywordDraft.trim();
    if (!trimmed) return;
    const yearMatch = trimmed.match(/(19\d{2}|20\d{2}|\d{2})/);
    const yearNum = yearMatch
      ? Number(yearMatch[1].length === 2 ? `19${yearMatch[1]}` : yearMatch[1])
      : alumniGradYear;
    const schoolPart = trimmed.replace(/(19\d{2}|20\d{2}|\d{2})년?|\s+/g, '').trim() || alumniSchoolName;
    setAlumniBannerInfo(schoolPart, yearNum);
    setEditingBannerKeyword(false);
  };

  const handleSubmitQuickProposal = (photoId: string, rawText: string) => {
    const yearMatch = rawText.match(/(19\d{2}|20\d{2}|\d{2})/);
    const parsedYear = yearMatch
      ? Number(yearMatch[1].length === 2 ? `19${yearMatch[1]}` : yearMatch[1])
      : alumniGradYear;
    const seasonMatch = rawText.match(/(봄|여름|가을|겨울)/);
    const parsedSeason = seasonMatch ? seasonMatch[1] : '가을';
    submitAnalogYearProposal(
      photoId,
      proposalAuthorDraft,
      parsedYear,
      parsedSeason,
      rawText,
      `${rawText} 때 찍은 사진입니다!`
    );
  };

  const isChalkboard = alumniBannerTheme === 'chalkboard';

  // 느슨한 타임라인 그룹별 아날로그 스캔 사진 묶기
  const looseTimelineGroups = analogScannedPhotos.reduce<Record<string, typeof analogScannedPhotos>>(
    (acc, item) => {
      const key = item.unknownDatePlace ? '❓ 언제/어디인가요? (제보 대기)' : item.looseTimelineGroup;
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    },
    {}
  );

  const sampleBidirectionalQueries = [
    `${cohortShort}년 2월 ${alumniSchoolName.replace(/고$/, '')}`,
    `${cohortShort}년 5월`,
    `${cohortShort}년 10월`,
  ];

  return (
    <div className="flex flex-col gap-3.5">
      {/* 1. 생성형 맞춤형 간판 'Text-to-Banner' 최상단 와이드 장착 */}
      <div
        className={`relative rounded-2xl overflow-hidden border p-5 md:p-6 transition-all shadow-lg ${
          isChalkboard
            ? 'bg-gradient-to-r from-[#132A1E] via-[#1B3B2B] to-[#12261C] border-[#5C8D73]/50 shadow-[inset_0_0_40px_rgba(0,0,0,0.55)]'
            : 'bg-gradient-to-r from-[#3B1D1A] via-[#6E2E1E] to-[#2B1829] border-amber-400/40 shadow-[inset_0_0_40px_rgba(0,0,0,0.45)]'
        }`}
      >
        {/* 8090 레트로 그래픽 장식 레이어 (칠판 분필선 / 노을 운동장 실루엣) */}
        <div className="pointer-events-none select-none absolute inset-0 opacity-20">
          {isChalkboard ? (
            <div className="w-full h-full border-[6px] border-amber-900/60 rounded-2xl flex items-end justify-between px-6 pb-2 text-[11px] font-mono text-emerald-100">
              <span>▮▮ 백묵 &amp; 칠판지우개 · 1980s CLASSROOM</span>
              <span>급훈: 성실 · 협동 · 우정</span>
            </div>
          ) : (
            <div className="w-full h-full flex items-end justify-between px-6 pb-2 text-[11px] font-mono text-amber-200">
              <span>🌅 1980s SUNSET SCHOOLYARD · 노을 진 운동장 축구 골대</span>
              <span>응답하라 {alumniGradYear}</span>
            </div>
          )}
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          {/* 좌측: 레트로 감성 태그 & 배경 테마 스위치 + 키워드 자동 감지 편집 */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-md bg-amber-400 text-zinc-950 font-label-sm text-[11px] font-extrabold shadow-sm">
              🎨 Text-to-Banner 8090 자동 간판
            </span>
            <button
              type="button"
              onClick={() =>
                setAlumniBannerInfo(
                  alumniSchoolName,
                  alumniGradYear,
                  isChalkboard ? 'sunset_field' : 'chalkboard'
                )
              }
              className="px-2.5 py-1 rounded-md bg-black/40 hover:bg-black/60 border border-white/20 text-zinc-100 font-label-sm text-[11px] font-bold"
            >
              {isChalkboard ? '🏫 복고풍 칠판 그래픽 (클릭 시 🌅 노을 운동장)' : '🌅 노을 진 운동장 그래픽 (클릭 시 🏫 복고풍 칠판)'}
            </button>

            {editingBannerKeyword ? (
              <form onSubmit={handleApplyBannerKeyword} className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={keywordDraft}
                  onChange={(e) => setKeywordDraft(e.target.value)}
                  placeholder="예: 성동고 1989"
                  className="px-2.5 py-1 rounded-md bg-zinc-950/90 border border-amber-300/60 text-white text-[11.5px] font-bold w-36 focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1 rounded-md bg-primary-container text-zinc-950 text-[11px] font-extrabold"
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
                className="px-2.5 py-1 rounded-md bg-black/35 hover:bg-black/55 border border-white/15 text-amber-200 font-label-mono text-[11px]"
              >
                ✏️ 키워드 감지: &ldquo;{alumniSchoolName} {alumniGradYear}&rdquo; 변경
              </button>
            )}
          </div>

          {/* 중앙: 굵고 세련된 8090 레트로 타이포그래피 간판 */}
          <div className="flex flex-col items-start lg:items-center text-left lg:text-center my-1 lg:my-0">
            <span className="font-label-mono text-[11px] tracking-widest uppercase text-amber-200/90 font-bold">
              SINCE {alumniGradYear} · OFFICIAL ALUMNI LOUNGE
            </span>
            <h2 className="font-headline-md text-[26px] md:text-[32px] text-white font-black tracking-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)]">
              {bannerTitle}
            </h2>
          </div>

          {/* 우측: 바이럴 초대 훅(Hook) 복사 버튼 */}
          <div className="flex flex-col items-stretch sm:items-end gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => void handleCopyInviteHook()}
              className={`px-4 py-2.5 rounded-xl font-label-sm text-[12px] font-extrabold transition-all shadow-md flex items-center gap-2 ${
                inviteCopied
                  ? 'bg-emerald-400 text-zinc-950 shadow-[0_0_20px_rgba(52,211,153,0.4)]'
                  : 'bg-amber-300 hover:bg-amber-200 text-zinc-950 shadow-[0_0_20px_rgba(252,211,77,0.3)]'
              }`}
            >
              <span>
                {inviteCopied
                  ? `✓ 카톡 초대장 카피 복사됨! ("${inviteHookCopy}")`
                  : `💌 초대장 카피: "${inviteHookCopy}"`}
              </span>
            </button>
            <span className="font-body-sm text-[10.5px] text-zinc-200/80">
              총무가 카톡방에 붙여넣기만 하면 유령 동창들도 100% 클릭하는 바이럴 훅
            </span>
          </div>
        </div>
      </div>

      {/* 2. 첫 화면 검색 전면 배치 & '추억 vs 근황' 투트랙(Two-Track) 탭 이원화 */}
      <div className="p-4 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* 전면 원터치 타겟팅 버튼 */}
          <button
            type="button"
            onClick={() => {
              void findMySchoolDaysPhotosFast();
              setFastSearchTriggered(true);
              if (onNavigateToFeed) onNavigateToFeed();
            }}
            className="px-4 py-3 rounded-xl bg-gradient-to-r from-primary-container via-emerald-300 to-amber-300 hover:opacity-95 text-zinc-950 font-headline-sm text-[14px] md:text-[15px] font-black shadow-[0_0_24px_rgba(32,247,219,0.25)] flex items-center justify-center gap-2 shrink-0 transition-all"
          >
            <span>🎯 내 얼굴로 학창 시절 사진 0.04초 찾기</span>
            <span className="px-2 py-0.5 rounded bg-zinc-950/85 text-primary-container font-label-mono text-[10.5px] font-extrabold">
              1980s 여권 시드 직결
            </span>
          </button>

          {/* 투트랙 탭 분리 (기본값 = [🎞️ 응답하라 1989 (추억)] 고정) */}
          <div className="grid grid-cols-2 gap-2 flex-1 max-w-xl">
            <button
              type="button"
              onClick={() => setClubFeedTrack('memories_1989')}
              className={`px-4 py-2.5 rounded-xl font-label-md text-[13px] font-extrabold border transition-all flex items-center justify-center gap-2 ${
                clubFeedTrack === 'memories_1989'
                  ? 'bg-amber-400 text-zinc-950 border-amber-300 shadow-[0_0_16px_rgba(251,191,36,0.3)]'
                  : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-white/10'
              }`}
            >
              <span>🎞️ 응답하라 {alumniGradYear} (추억)</span>
              <span className="px-1.5 py-0.5 rounded bg-black/20 text-[10px] font-mono">
                기본 고정
              </span>
            </button>

            <button
              type="button"
              onClick={() => setClubFeedTrack('recent_now')}
              className={`px-4 py-2.5 rounded-xl font-label-md text-[13px] font-extrabold border transition-all flex items-center justify-center gap-2 ${
                clubFeedTrack === 'recent_now'
                  ? 'bg-primary-container text-zinc-950 border-primary-container shadow-[0_0_16px_rgba(32,247,219,0.25)]'
                  : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-white/10'
              }`}
            >
              <span>🍻 최근 우리들 (근황)</span>
              <span className="px-1.5 py-0.5 rounded bg-black/20 text-[10px] font-mono">
                무소음 트랙
              </span>
            </button>
          </div>
        </div>

        {/* 스마트 알림 통제 배지 표시 */}
        <div className="px-3.5 py-2.5 rounded-xl bg-zinc-950/90 border border-amber-400/30 flex flex-wrap items-center justify-between gap-2">
          <p className="font-body-sm text-[12px] text-amber-200 font-bold">
            🔔 알림 클린존: 최근 친목 사진은 전체 알림을 울리지 않으며, &lsquo;과거 추억 사진 업로드&rsquo; 또는 &lsquo;내 얼굴이 발견된 경우&rsquo;에만 알림이 발송됩니다.
          </p>
          {fastSearchTriggered && (
            <span className="px-2.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-label-mono text-[11px] font-bold">
              ✓ 0.04초 학창 시절 얼굴 매칭 완료 ({alumniGradYear}년 여권 바구니 연동)
            </span>
          )}
        </div>

        {/* 양방향 시간·고유명사 그물망 원터치 검색 체험 바 */}
        <div className="px-3.5 py-2 rounded-xl bg-zinc-950/80 border border-primary-container/25 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-zinc-300">
            <span className="px-2 py-0.5 rounded bg-primary-container/15 text-primary-container font-mono text-[10.5px] font-bold">
              ⚡ 계절↔월(1~12월) 양방향 그물망
            </span>
            <span>
              <strong>&lsquo;{alumniGradYear}년 봄&rsquo;</strong>으로 대충 넣어도 <strong>&ldquo;{cohortShort}년 2월 {alumniSchoolName.replace(/고$/, '')}&rdquo;</strong>처럼 구체적 월·학교명으로 100% 검색됩니다:
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {sampleBidirectionalQueries.map((sq) => (
              <button
                key={sq}
                type="button"
                onClick={() => {
                  if (onNavigateToFeed) onNavigateToFeed();
                  void runTextQuery(sq);
                }}
                className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-primary-container/40 text-primary-container font-label-sm text-[11px] font-bold"
              >
                🔍 &ldquo;{sq}&rdquo; 0.04초 검색 →
              </button>
            ))}
          </div>
        </div>

        {/* 투트랙 선택 상태에 따른 느슨한 타임라인(추억) vs 최근 모임(근황) 미니 보드 */}
        {clubFeedTrack === 'memories_1989' ? (
          <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-white/10 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-amber-400/20 border border-amber-400/40 text-amber-300 font-label-sm text-[11px] font-extrabold">
                  🎞️ 응답하라 {alumniGradYear} 느슨한 타임라인
                </span>
                <span className="font-body-sm text-[12px] text-zinc-300">
                  정확한 월/일(EXIF)이 없는 옛날 종이 스캔 사진도 <strong>&lsquo;{alumniGradYear}년 봄&rsquo;</strong>, <strong>&lsquo;{alumniGradYear}년 가을&rsquo;</strong>로 자연스럽게 군집화되어 1980년대 여권 바구니(<strong>1989~1980</strong>)에 직결됩니다.
                </span>
              </div>

              <div className="flex items-center gap-2">
                {pendingProposals.length > 0 && (
                  <button
                    type="button"
                    onClick={() => approveAllAnalogYearProposals()}
                    className="px-3 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-sm text-[11.5px] font-extrabold"
                  >
                    👑 [✓ 멤버 연도 제보 일괄 승인 ({pendingProposals.length}건)]
                  </button>
                )}
                {onOpenWaitingRoom && (
                  <button
                    type="button"
                    onClick={onOpenWaitingRoom}
                    className="px-3 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-primary-container/40 text-primary-container font-label-sm text-[11.5px] font-bold"
                  >
                    🏷️ 옛날 스캔 사진 스틱(Chip) 연쇄 태깅 열기 →
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {Object.entries(looseTimelineGroups).map(([groupTitle, groupPhotos]) => (
                <div
                  key={groupTitle}
                  className="p-3 rounded-xl bg-zinc-900/90 border border-white/10 flex flex-col justify-between gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-label-sm text-[12px] text-white font-bold">
                      {groupTitle}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-zinc-800 text-amber-300 font-label-mono text-[10.5px] font-bold">
                      {groupPhotos.length}장
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    {groupPhotos.map((ap) => (
                      <div
                        key={ap.id}
                        className="p-2 rounded-lg bg-zinc-950/90 border border-white/5 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <img
                            src={ap.thumbUrl}
                            alt={ap.captionKo}
                            className="w-9 h-9 rounded-lg object-cover shrink-0 border border-white/15"
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="text-[11.5px] text-zinc-100 font-bold truncate">
                              {ap.captionKo}
                            </span>
                            <div className="flex flex-wrap items-center gap-1">
                              {ap.appliedSticks.map((t) => (
                                <span
                                  key={t}
                                  className="px-1.5 py-0.2 rounded bg-amber-400/15 text-amber-300 font-mono text-[10px]"
                                >
                                  🏷️ {t}
                                </span>
                              ))}
                              <span className="text-[10px] text-emerald-300 font-mono truncate">
                                {ap.mappedPassportBucketLabel}
                              </span>
                            </div>
                          </div>
                        </div>

                        {ap.unknownDatePlace && (
                          <button
                            type="button"
                            onClick={() =>
                              setActiveProposalPhotoId(
                                activeProposalPhotoId === ap.id ? null : ap.id
                              )
                            }
                            className="px-2 py-1 rounded-md bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/50 text-amber-200 font-label-sm text-[10.5px] font-extrabold shrink-0"
                          >
                            ❓ 언제/어디인가요?
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {groupPhotos.some((ap) => ap.id === activeProposalPhotoId) && (
                    <div className="p-2.5 rounded-lg bg-zinc-950 border border-amber-400/40 flex flex-col gap-2 mt-1">
                      <span className="text-[11px] text-amber-200 font-bold">
                        💬 동기들의 집단 지성 연도/장소 댓글 제보 (👑 방장 일괄 승인 연동)
                      </span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={proposalAuthorDraft}
                          onChange={(e) => setProposalAuthorDraft(e.target.value)}
                          placeholder="제보자"
                          className="w-20 px-2 py-1 rounded bg-zinc-900 border border-white/15 text-white text-[11px]"
                        />
                        <input
                          type="text"
                          value={proposalTextDraft}
                          onChange={(e) => setProposalTextDraft(e.target.value)}
                          placeholder="예: 1989년 가을 소풍"
                          className="flex-1 px-2 py-1 rounded bg-zinc-900 border border-white/15 text-white text-[11px]"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (activeProposalPhotoId) {
                              handleSubmitQuickProposal(
                                activeProposalPhotoId,
                                proposalTextDraft
                              );
                              setActiveProposalPhotoId(null);
                            }
                          }}
                          className="px-2.5 py-1 rounded bg-primary-container text-zinc-950 text-[11px] font-extrabold shrink-0"
                        >
                          제보 등록
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-white/10 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-primary-container/20 border border-primary-container/40 text-primary-container font-label-sm text-[11px] font-extrabold">
                🍻 최근 우리들 (근황 트랙)
              </span>
              <span className="font-body-sm text-[12px] text-zinc-300">
                최근 골프·등산·정기 모임 친목 사진 전용 공간입니다. 소수 인원의 잦은 친목 사진으로 인한 전체 푸시 알림 피로도를 100% 차단합니다.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setClubFeedTrack('memories_1989')}
              className="px-3 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-amber-400/40 text-amber-300 font-label-sm text-[11px] font-bold"
            >
              🎞️ 응답하라 {alumniGradYear} (추억) 탭으로 돌아가기 →
            </button>
          </div>
        )}
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
  } = useSaySeeStore();

  const [studentPokedHost, setStudentPokedHost] = useState(false);
  const [radarSimulated, setRadarSimulated] = useState(false);

  const activeClusters = faceClusters.filter((c) => !c.excludedAsPasserby);
  const namedClusters = activeClusters.filter((c) => Boolean(c.registeredName));
  const activePhotos = photos.filter((p) => !p.quarantined);
  const trashCount = activePhotos.filter((p) => Boolean(p.trashCategory)).length;
  const vaultDocPhotosCount = activePhotos.filter((p) => p.isVaultDocument).length;
  const totalDocsCount = localDocuments.length + vaultDocPhotosCount;

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
      {/* 1. 상단 4대 라운지 무료체험 헤더 */}
      <section className="p-5 md:p-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-primary-container text-zinc-950 font-label-sm text-[11px] font-extrabold">
                ✨ 무료체험 · {LOUNGE_TABS.find((t) => t.id === activeLoungeType)?.label}
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-zinc-900 border border-white/10 text-zinc-300 font-label-sm text-[11px]">
                정식 구독 활성화 시 [✨ 무료체험] 탭은 메뉴에서 자동으로 숨김(Auto-Hide) 처리됩니다
              </span>
            </div>
            <h1 className="font-headline-md text-[20px] md:text-[22px] text-white font-bold mt-1">
              {activeLoungeType === 'personal' &&
                '👤 개인 라운지 무료체험 — 서류·동영상 해부 & 연사 진단 브리핑 보드'}
              {activeLoungeType === 'family' &&
                '👨‍👩‍👧‍👦 패밀리 라운지 무료체험 — 가족 얼굴 추출·이름 등록 & 카톡 3초 레이더 스캔'}
              {activeLoungeType === 'club' &&
                '⛳ 클럽 라운지 무료체험 — 모임 단체컷 얼굴 추출 & 참석자 폰 사진 레이더 수합'}
              {activeLoungeType === 'student' &&
                '🎒 스쿨 라운지 (초·중·고 반/동아리 특가 월 900원) — 친구 얼굴 별명 등록 & 게이밍 PC 콕 찌르기'}
            </h1>
          </div>

          <button
            type="button"
            onClick={goToMainFeed}
            className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-primary-container font-label-sm text-[12px] font-bold"
          >
            {activeLoungeType === 'personal' && '🔍 파워 검색으로 이동 →'}
            {activeLoungeType === 'family' && '🏠 우리집·본가·처가 피드로 이동 →'}
            {activeLoungeType === 'club' && '📸 모임 피드 & 원본 소환으로 이동 →'}
            {activeLoungeType === 'student' && '⚡ 타임캡슐 피드 & 씬 검색으로 이동 →'}
          </button>
        </div>

        {/* 4대 라운지 카드형 전환 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {LOUNGE_TABS.map((item) => {
            const isSelected = activeLoungeType === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveLoungeType(item.id)}
                className={`p-4 rounded-xl text-left transition-all flex flex-col justify-between gap-2 border ${
                  isSelected
                    ? 'bg-zinc-900 border-primary-container shadow-[0_0_20px_rgba(32,247,219,0.12)]'
                    : 'bg-zinc-950/70 hover:bg-zinc-900/60 border-white/10'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-headline-sm text-[15px] text-white font-bold flex items-center gap-1.5">
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </span>
                  {isSelected && (
                    <span className="px-2 py-0.5 rounded bg-primary-container text-zinc-950 font-label-mono text-[10px] font-extrabold">
                      선택됨
                    </span>
                  )}
                </div>
                <p className="font-body-sm text-[11.5px] text-zinc-400 leading-snug">
                  {item.desc}
                </p>
                <span className="font-label-mono text-[11px] text-primary-container font-bold pt-1 border-t border-white/10">
                  {item.shortPrice}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 2. 라운지별 맞춤 무료체험 & 요금제 섹션 */}
      {activeLoungeType === 'personal' && (
        <section className="p-5 md:p-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-5">
          {/* 개인 라운지 전용: 서류 19건 + 동영상 4개 해부 + 연사 진단 브리핑 보드 */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-headline-sm text-[17px] text-white font-bold">
                📊 내 기기 3대 핵심 자산 무료체험 진단 브리핑 보드
              </h2>
              <span className="font-label-mono text-[11.5px] text-emerald-400 font-bold">
                ✓ 100% 내 PC 로컬 RAM 직접 스캔 완료 (외부 전송 0 Byte)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              <div
                onClick={() => {
                  setSearchSpace('vault');
                  goToMainFeed();
                }}
                className="p-4 rounded-xl bg-zinc-950/90 hover:bg-zinc-900 border border-white/10 hover:border-primary-container/50 cursor-pointer transition-all flex flex-col justify-between gap-2"
              >
                <span className="font-label-sm text-[11.5px] text-amber-400 font-bold">
                  📁 스마트 서류함 (PDF · 촬영 문서)
                </span>
                <div className="font-headline-md text-[22px] text-white font-black">
                  서류 {totalDocsCount}건 발견
                </div>
                <p className="font-body-sm text-[12px] text-zinc-400">
                  로컬 문서 {localDocuments.length}건 + 사진첩 속 영수증·계약서·신분증 {vaultDocPhotosCount}장 자동 분리 완료
                </p>
                <span className="text-primary-container font-label-sm text-[11.5px] font-bold pt-1">
                  서류함 검색 바로가기 →
                </span>
              </div>

              <div
                onClick={() => {
                  setSearchSpace('video');
                  goToMainFeed();
                }}
                className="p-4 rounded-xl bg-zinc-950/90 hover:bg-zinc-900 border border-white/10 hover:border-primary-container/50 cursor-pointer transition-all flex flex-col justify-between gap-2"
              >
                <span className="font-label-sm text-[11.5px] text-primary-container font-bold">
                  🎬 동영상 전 구간 타임라인 해부
                </span>
                <div className="font-headline-md text-[22px] text-white font-black">
                  동영상 {videoSceneItems.length}개 해부 완료
                </div>
                <p className="font-body-sm text-[12px] text-zinc-400">
                  00:00~끝까지 2초 간격 키프레임 시각·인물 색인으로 원하는 초(Sec) 즉시 점프 재생
                </p>
                <span className="text-primary-container font-label-sm text-[11.5px] font-bold pt-1">
                  동영상 구간 검색 바로가기 →
                </span>
              </div>

              <div
                onClick={() => {
                  setDesktopTab('trash');
                  setMobileTab('trash');
                }}
                className="p-4 rounded-xl bg-zinc-950/90 hover:bg-zinc-900 border border-white/10 hover:border-primary-container/50 cursor-pointer transition-all flex flex-col justify-between gap-2"
              >
                <span className="font-label-sm text-[11.5px] text-emerald-400 font-bold">
                  🧹 클리어 (주치의 연사·중복 진단)
                </span>
                <div className="font-headline-md text-[22px] text-white font-black">
                  정리 대상 {trashCount}장 포착
                </div>
                <p className="font-body-sm text-[12px] text-zinc-400">
                  바둑판 비교로 베스트 컷 1장만 남기고 나머지 연사·흔들린 사진을 안전하게 격리합니다
                </p>
                <span className="text-primary-container font-label-sm text-[11.5px] font-bold pt-1">
                  🧹 클리어 작업대로 이동 →
                </span>
              </div>
            </div>
          </div>

          {/* 개인 라운지 요금제 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-white/10">
            <div className="p-5 rounded-xl bg-zinc-950/80 border border-white/10 flex flex-col justify-between gap-4">
              <div className="flex flex-col gap-1.5">
                <span className="font-label-sm text-[11.5px] text-zinc-400 font-bold">
                  1회 대청소 &amp; 초기 세팅
                </span>
                <div className="font-headline-md text-[24px] text-white font-black">
                  단품 클리어 2,900원
                </div>
                <p className="font-body-sm text-[12px] text-zinc-400">
                  연사·중복·흐린 사진 주치의 대청소 및 최초 1회 로컬 색인·일치화 제공
                </p>
              </div>
              <button
                type="button"
                onClick={() => activatePricingPlan('personal_single_2900')}
                className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-white/15 text-white font-label-md text-[12.5px] font-bold transition-colors"
              >
                개인 단품 클리어 2,900원 시작
              </button>
            </div>

            <div className="p-5 rounded-xl bg-zinc-900 border border-primary-container/50 flex flex-col justify-between gap-4">
              <div className="flex flex-col gap-1.5">
                <span className="font-label-sm text-[11.5px] text-primary-container font-bold">
                  🛠️ 설정도우미 ⚡Pro 업그레이드 (상시 자동 색인 &amp; 프라이빗 싱크)
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="font-headline-md text-[24px] text-white font-black">
                    정기 구독 월 3,900원
                  </span>
                  <span className="font-label-mono text-[13px] text-primary-container font-bold">
                    (연 35,000원)
                  </span>
                </div>
                <p className="font-body-sm text-[12px] text-zinc-300">
                  내 PC↔폰 13KB 섀도우 자동 싱크 + 동영상·서류함 무제한 + 24시간 서버 도우미(일 1,000원) 대여 지원
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => activatePricingPlan('personal_sub_3900')}
                  className="py-2.5 rounded-xl bg-primary-container text-zinc-950 font-label-md text-[12.5px] font-extrabold"
                >
                  월 3,900원 구독
                </button>
                <button
                  type="button"
                  onClick={() => activatePricingPlan('personal_year_35000')}
                  className="py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-primary-container/40 text-primary-container font-label-md text-[12.5px] font-bold"
                >
                  연 35,000원 구독
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {activeLoungeType === 'family' && (
        <section className="p-5 md:p-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-headline-sm text-[18px] text-white font-bold">
                👨‍👩‍👧‍👦 패밀리 라운지 — 양가 분리 가족 사진관 (마스터 1인 결제 ➔ 가족 전원 무료)
              </h2>
              <p className="font-body-sm text-[12.5px] text-zinc-400 mt-0.5">
                가족 대표 사진 얼굴 추출 &amp; 이름 등록 후 카톡 초대 링크를 보내면, 가족 아이폰·갤럭시에서 3초 레이더 스캔으로 함께 찍힌 사진만 자동 수합합니다.
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  부부·자녀가 찍은 모든 사진·영상을 방장 PC로 안전하게 모으고 가족 전원 스마트폰에서 0.04초 실명 검색
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
        </section>
      )}

      {activeLoungeType === 'club' && (
        <section className="flex flex-col gap-4">
          {/* 4050 동창회 락인: Text-to-Banner 자동 간판 + 0.04초 학창시절 얼굴 찾기 + 응답하라 투트랙 탭 */}
          <AlumniRetroBannerAndTwoTrackBar
            onNavigateToFeed={goToMainFeed}
            onOpenWaitingRoom={() => {
              setDesktopTab('trash');
              setMobileTab('trash');
            }}
          />

          <div className="p-5 md:p-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-headline-sm text-[18px] text-white font-bold">
                  ⛳ 클럽 라운지 — 4050 동창회 · 골프 · 산악회 총무 1인 결제로 전 회원 무료
                </h2>
                <p className="font-body-sm text-[12.5px] text-zinc-400 mt-0.5">
                  동창회·모임 총무(👑 방장) 1인 결제로 회원 전원 무료! 13KB 초경량 캐시 열람과 5MB 무손실 원본 P2P 1초 소환을 지원합니다 (방 1개 기준).
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
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
          </div>
        </section>
      )}

      {activeLoungeType === 'student' && (
        <section className="p-5 md:p-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-headline-sm text-[18px] text-white font-bold">
                🎒 스쿨 라운지 (초·중·고 반/동아리 특가 월 900원)
              </h2>
              <p className="font-body-sm text-[12.5px] text-zinc-400 mt-0.5">
                초·중·고 학급·동아리·수련회·체육대회 인원수 상관없이 라운지 1개 개설 시 무조건{' '}
                <strong className="text-white">월 900원 (연 9,000원)</strong> 단일 요금! 무료체험 10장 수합 한도 도달 시 방장에게 게이밍 PC 설치 알림을 보낼 수 있습니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStudentPokedHost(true)}
              className={`px-4 py-2 rounded-xl font-label-md text-[12.5px] font-extrabold transition-all ${
                studentPokedHost
                  ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-300'
                  : 'bg-amber-400 hover:bg-amber-300 text-zinc-950 shadow-[0_0_20px_rgba(251,191,36,0.25)]'
              }`}
            >
              {studentPokedHost
                ? '✓ 방장에게 "집 게이밍 PC에 설치해!" 카톡 알림 발송됨!'
                : '👉 방장에게 "집 게이밍 PC에 설치해!" 콕 찌르기'}
            </button>
          </div>

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
        </section>
      )}

      {/* 3. 패밀리 / 클럽 / 스쿨 라운지에서만 노출 (👤 개인 라운지에서는 100% 완전 비노출!) */}
      {activeLoungeType !== 'personal' && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2">
              <span className="font-headline-sm text-[16px] text-white font-bold">
                👑 Step 1. 세이씨 여권 자동 장착 &amp; 방장 누락분 1장씩 확인
              </span>
            </div>
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

          <div className="p-4 rounded-2xl bg-[#18181B] border border-white/10 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span className="font-label-md text-[12.5px] text-white font-bold">
                📡 Step 2~3. 카톡 초대 &amp; 스마트폰 ‘3초 얼굴 레이더 스캔’ 시드(Seed) 맛보기
              </span>
              <p className="font-body-sm text-[12px] text-zinc-400">
                👑 방장이 등록한 얼굴 아바타({namedClusters.length}명 등록됨 / 전체 {activeClusters.length}명)의 768차원 특징량과 촬영 날짜를 기준으로 멤버 폰에서 함께 찍힌 사진만 3초 만에 자동 골라내어 <strong>[⏳ AI 인덱싱 대기실]</strong>로 전송합니다.
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
                className="px-3.5 py-1.5 rounded-lg bg-primary-container text-zinc-950 font-label-sm text-[11.5px] font-extrabold"
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
                    className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-primary-container/40 text-primary-container font-label-sm text-[11.5px] font-bold"
                  >
                    🔍 “{isRoomCreator ? `👑 ${labelName}` : labelName} 나무 다리” 검색 →
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </main>
  );
};

/**
 * 2번 서브메뉴(메인 피드 & 검색) 상단에 라운지 성격별로 표시되는 전용 컨트롤 바
 * - 개인 라운지: null (얼굴/여권 바 완전 비노출, 기본 파워 검색 바로 시작)
 * - 패밀리 라운지: [🏠 우리집 / 🏡 본가(친가) / 🌸 처가(친정)] 서브 룸 캡슐 전환 + 방별 별명 알약([👑 멀린], [👑 둘째사위], [은숙] 등) 0.04초 검색 통합 바
 * - 클럽 라운지: Text-to-Banner 자동 간판('성동고 89회 동창회') + [🎯 내 얼굴로 학창 시절 사진 0.04초 찾기] + [🎞️ 응답하라 1989 (추억) / 🍻 최근 우리들 (근황)] 투트랙 탭 + 13KB 캐시 & 5MB 무손실 원본 P2P 소환 바
 * - 스쿨 라운지: 낮(학교/학원) 로컬 캐시 0.04초 구간 점프 + 스쿨방 별명 알약([지우짱] 등) + [🎉 매월 1일 폰 용량 클리어 리포트] 배너
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
        <span className="font-label-sm text-[11px] text-zinc-400 mr-0.5">{labelText}</span>
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
              title={`클릭 시 "${queryTarget}" 0.04초 검색`}
              className="px-2.5 py-1 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-primary-container/35 text-primary-container font-label-sm text-[11.5px] font-bold flex items-center gap-1.5 transition-colors"
            >
              <img
                src={c.avatarUrl || c.representativePhoto}
                alt={displayPersona}
                className="w-4 h-4 rounded-full object-cover"
              />
              <span>
                {isRoomCreator ? `👑 ${displayPersona}` : displayPersona}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setShowFaceRegistryModal(true)}
          className="px-2.5 py-1 rounded-full bg-zinc-950 hover:bg-zinc-800 border border-white/15 text-zinc-300 font-label-sm text-[11px] font-bold ml-0.5"
        >
          🛂 여권 관리
        </button>
      </div>
    );
  };

  if (activeLoungeType === 'family') {
    return (
      <div className="p-4 rounded-2xl bg-[#18181B] border border-white/10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/35 text-emerald-300 font-label-sm text-[11px] font-extrabold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            🛂 세이씨 여권 자동 연동됨
          </span>
          <span className="font-headline-sm text-[14px] text-white font-bold mr-1">
            🏠 패밀리 서브 룸:
          </span>
          {FAMILY_ROOMS.map((room) => {
            const active = activeFamilyRoom === room;
            return (
              <button
                key={room}
                type="button"
                onClick={() => setActiveFamilyRoom(room)}
                className={`px-3 py-1.5 rounded-xl font-label-sm text-[12px] font-bold border transition-all ${
                  active
                    ? 'bg-primary-container text-zinc-950 border-primary-container font-extrabold shadow-[0_0_12px_rgba(32,247,219,0.2)]'
                    : 'bg-zinc-900 text-zinc-300 border-white/10 hover:bg-zinc-800'
                }`}
              >
                {room === '우리집' ? '🏠 우리집' : room === '본가(친가)' ? '🏡 본가(친가)' : '🌸 처가(친정)'}
              </button>
            );
          })}
        </div>

        {renderMemberPersonaPills(`[${activeFamilyRoom}] 별명 0.04초 검색:`)}
      </div>
    );
  }

  if (activeLoungeType === 'club') {
    return (
      <div className="flex flex-col gap-3.5">
        {/* 최상단: 4050 동창회 Text-to-Banner 자동 간판 + 0.04초 학창시절 찾기 + 응답하라 투트랙 탭 */}
        <AlumniRetroBannerAndTwoTrackBar
          onOpenWaitingRoom={() => {
            setDesktopTab('trash');
            setMobileTab('trash');
          }}
        />

        <div className="p-4 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 font-label-sm text-[11px] font-extrabold">
                🛂 세이씨 여권 자동 연동됨
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-white/10 text-primary-container font-label-mono text-[11.5px] font-bold">
                ⚡ 13KB 섀도우 캐시 초고속 열람 중 (데이터 소모 99.4% 절감)
              </span>
            </div>

            <button
              type="button"
              onClick={() => setP2pOriginalSummoned((v) => !v)}
              className={`px-3.5 py-1.5 rounded-xl font-label-sm text-[12px] font-extrabold transition-all border ${
                p2pOriginalSummoned
                  ? 'bg-primary-container text-zinc-950 border-primary-container'
                  : 'bg-zinc-900 hover:bg-zinc-800 text-primary-container border-primary-container/50'
              }`}
            >
              {p2pOriginalSummoned
                ? '✓ 5MB 무손실 원본 P2P 1초 소환 완료 (현재 결과 전체 원본 적용)'
                : '📥 현재 검색 결과 5MB 무손실 원본 P2P 1초 소환'}
            </button>
          </div>

          {renderMemberPersonaPills('모임 별명 0.04초 검색:')}
        </div>
      </div>
    );
  }

  // student ('🎒 스쿨 라운지')
  return (
    <div className="flex flex-col gap-2.5">
      {!monthlyReportDismissed && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/80 via-zinc-900 to-zinc-900 border border-emerald-400/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-400 text-zinc-950 font-label-sm text-[11px] font-extrabold">
              🎉 매월 1일 폰 용량 클리어 리포트
            </span>
            <span className="font-body-sm text-[12.5px] text-zinc-100 font-medium">
              이번 달 우리반·동아리 원본 사진 {photos.length}장 &amp; 4K 축제 영상이 👑 방장 게이밍 PC로 안전 이관되어{' '}
              <strong className="text-emerald-300">내 폰 여유 공간 +14.2GB</strong>가 확보되었습니다!
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMonthlyReportDismissed(true)}
            className="px-2.5 py-1 rounded-lg bg-zinc-950/80 hover:bg-zinc-800 text-zinc-400 hover:text-white font-label-sm text-[11px]"
          >
            ✕ 닫기
          </button>
        </div>
      )}

      <div className="p-3.5 rounded-2xl bg-[#18181B] border border-white/10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 font-label-sm text-[11px] font-extrabold">
            🛂 세이씨 여권 자동 연동됨
          </span>
          <span className="font-label-sm text-[12px] text-primary-container font-bold">
            ⚡ 타임캡슐 로컬 캐시 모드 (낮에 👑 방장 PC가 꺼져 있어도 0.04초 즉시 재생)
          </span>
        </div>
        {renderMemberPersonaPills('스쿨방 별명 0.04초 검색:')}
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
                onClick={() =>
                  activateGpuHelper24h(
                    activeLoungeType === 'club' ? 'club_small_1000' : 'standard_1000'
                  )
                }
                className="px-3 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-primary-container/40 text-primary-container font-label-sm text-[11px] font-bold"
              >
                ⚡ 방장 PC가 꺼져 있나요? 1일 1,000원 GPU 서버 도우미 즉시 가동
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
                    ? '0.04초 역스캔 중...'
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
                  : '✓ 사진 속 모든 얼굴이 멤버별 여권에 자동 반영되어 0.04초 검색 준비가 완료되었습니다!'}
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
 * - 개인: [🛠️ 설정도우미 ⚡Pro] 정기 구독 업그레이드 안내
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
  } = useSaySeeStore();

  const [inviteCopied, setInviteCopied] = useState(false);
  const [gamingPcAutoSyncAfterSchool, setGamingPcAutoSyncAfterSchool] = useState(true);
  const [familyMembers, setFamilyMembers] = useState([
    { id: 'm1', name: '진욱 (방장·마스터)', room: '우리집', role: 'HOST' },
    { id: 'm2', name: '은숙 (아내)', room: '우리집', role: 'MEMBER' },
    { id: 'm3', name: '우리딸', room: '우리집', role: 'MEMBER' },
    { id: 'm4', name: '처가 어머님', room: '처가(친정)', role: 'MEMBER' },
    { id: 'm5', name: '본가 어머님', room: '본가(친가)', role: 'MEMBER' },
  ]);
  const [clubMembers, setClubMembers] = useState([
    { id: 'c1', name: '김총무 (방장·마스터)', badge: '총무', role: 'HOST' },
    { id: 'c2', name: '박회장', badge: '정회원', role: 'MEMBER' },
    { id: 'c3', name: '이프로', badge: '정회원', role: 'MEMBER' },
    { id: 'c4', name: '최회원', badge: '신입회원', role: 'MEMBER' },
  ]);

  const copyInviteLink = () => {
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2500);
  };

  if (activeLoungeType === 'personal') {
    return (
      <div className="p-6 rounded-2xl bg-[#18181B] border border-primary-container/40 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-primary-container text-zinc-950 font-label-sm text-[11.5px] font-extrabold">
              🛠️ 설정도우미 ⚡Pro (정기 구독 업그레이드 전용)
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-zinc-900 border border-white/10 text-zinc-300 font-label-mono text-[11px]">
              현재 플랜: {PLAN_BADGE_LABELS[activePricingPlan]}
            </span>
          </div>
          <h2 className="font-headline-sm text-[19px] text-white font-bold mt-1">
            내 PC↔폰 13KB 섀도우 자동 싱크 &amp; 상시 AI 색인 업그레이드
          </h2>
          <p className="font-body-sm text-[12.5px] text-zinc-300">
            1회성 대청소는 <strong>단품 클리어 2,900원</strong>으로, 상시 스마트폰↔PC 13KB 섀도우 캐시 자동 동기화는 <strong>정기 구독 월 3,900원(연 35,000원)</strong>으로 즉시 개통됩니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => activatePricingPlan('personal_single_2900')}
            className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-200 font-label-sm text-[12px] font-bold"
          >
            단품 클리어 2,900원
          </button>
          <button
            type="button"
            onClick={() => activatePricingPlan('personal_sub_3900')}
            className="px-4 py-2 rounded-xl bg-primary-container text-zinc-950 font-label-sm text-[12.5px] font-extrabold"
          >
            ⚡Pro 월 3,900원 업그레이드
          </button>
          <button
            type="button"
            onClick={() => activatePricingPlan('personal_year_35000')}
            className="px-3.5 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-primary-container/40 text-primary-container font-label-sm text-[12px] font-bold"
          >
            연 35,000원
          </button>
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
              👑 가족 초대 &amp; 양가 통합권 관리 (마스터 1인 결제 ➔ 가족 전원 무료)
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
      </div>
    );
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
              각 클럽권은 방 1개 기준이며, 소모임/파트별 방 분리를 원할 경우 소형 클럽 등을 별도 추가 구매할 수 있습니다.
            </p>
          </div>

          <button
            type="button"
            onClick={copyInviteLink}
            className="px-4 py-2 rounded-xl bg-primary-container text-zinc-950 font-label-sm text-[12px] font-extrabold"
          >
            {inviteCopied ? '✓ 클럽 회원 초대 링크 복사됨!' : '⛳ 클럽 무수락 초대 링크·QR 발급'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { id: 'small' as ClubSizeTier, label: '소형 클럽 (20명 기준)', price: '월 4,900원 (연 49,000원)', plan: 'club_small_4900' as PricingPlanId },
            { id: 'medium' as ClubSizeTier, label: '중형 클럽 (100명 기준)', price: '월 7,900원 (연 79,000원)', plan: 'club_medium_7900' as PricingPlanId },
            { id: 'large' as ClubSizeTier, label: '대형 클럽 (무제한)', price: '월 14,900원 (연 149,000원)', plan: 'club_large_14900' as PricingPlanId },
          ].map((t) => (
            <div
              key={t.id}
              onClick={() => {
                setClubSizeTier(t.id);
                activatePricingPlan(t.plan);
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
            🎒 스쿨 라운지 (초·중·고 반/동아리 특가 월 900원)
          </span>
          <h2 className="font-headline-sm text-[19px] text-white font-bold mt-1">
            하교 후 방장 게이밍 PC 자동 인덱싱 &amp; 초·중·고 반/동아리 인원 무제한 월 900원 학생인증
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
          <button
            type="button"
            onClick={() => activatePricingPlan('student_sub_900')}
            className="px-4 py-2 rounded-xl bg-primary-container text-zinc-950 font-label-sm text-[12px] font-extrabold"
          >
            🎒 월 900원 (연 9,000원) 개통
          </button>
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
