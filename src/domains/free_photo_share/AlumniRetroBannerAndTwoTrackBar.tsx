import React, { useState } from 'react';
import { useSaySeeStore } from '../../store/useSaySeeStore';
import { copyAuthenticatedRoomInviteFlow } from './loungeRoomPermissions';

export const AlumniRetroBannerAndTwoTrackBar: React.FC<{
  onNavigateToFeed?: () => void;
  onOpenWaitingRoom?: () => void;
}> = ({ onNavigateToFeed }) => {
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
    isGuestPreviewMode,
    triggerGuestJoinWall,
  } = useSaySeeStore();

  const [inviteCopied, setInviteCopied] = useState(false);
  const [editingBannerKeyword, setEditingBannerKeyword] = useState(false);
  const [keywordDraft, setKeywordDraft] = useState(alumniBannerTitle);
  const [showRetroCover, setShowRetroCover] = useState(false);

  const bannerTitle = alumniBannerTitle;
  const pendingProposals = analogYearProposals.filter((p) => !p.approvedByHost);

  const handleCopyInviteHook = async () => {
    const ok = await copyAuthenticatedRoomInviteFlow({
      loungeType: 'student',
      familyRoom: '우리집',
      defaultHostLabel: '동기회장',
      roomTitle: bannerTitle,
      promptLabel: `『${bannerTitle}』 초대 링크를 복사해 공유하세요:`,
      formatCopyText: (studentInviteUrl) =>
        `[${bannerTitle}] ${alumniGradYear}년 추억 사진 공유방 초대 링크입니다. (발급 후 14일간 유효)\n${studentInviteUrl}`,
    });
    if (!ok) return;
    useSaySeeStore
      .getState()
      .showToast(`『${bannerTitle}』 초대 링크가 복사되었습니다! (발급 후 14일간 유효)`);
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2600);
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

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[17px] md:text-[18px] text-slate-900 font-semibold tracking-tight">
            {bannerTitle}
          </span>
          <button
            type="button"
            onClick={() => setShowRetroCover((v) => !v)}
            className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[12px] font-medium select-none cursor-pointer transition-colors"
          >
            {showRetroCover ? '간판 접기' : '간판 · 초대 설정'}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex p-0.5 rounded-lg bg-slate-100 border border-slate-200">
            <button
              type="button"
              onClick={() => setClubFeedTrack('memories_1989')}
              className={`px-3 py-1 rounded-md text-[12px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                clubFeedTrack === 'memories_1989'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {alumniGradYear} 추억
            </button>

            <button
              type="button"
              onClick={() => setClubFeedTrack('recent_now')}
              className={`px-3 py-1 rounded-md text-[12px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                clubFeedTrack === 'recent_now'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              최근 근황
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              if (isGuestPreviewMode) {
                triggerGuestJoinWall('내 얼굴이 나온 사진 모아보기');
                return;
              }
              void findMySchoolDaysPhotosFast();
              if (onNavigateToFeed) onNavigateToFeed();
            }}
            className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-[12px] font-medium cursor-pointer whitespace-nowrap transition-colors"
          >
            내 학창시절 사진 찾기
          </button>

          {pendingProposals.length > 0 && (
            <button
              type="button"
              onClick={() => approveAllAnalogYearProposals()}
              className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12px] font-semibold cursor-pointer whitespace-nowrap transition-colors"
            >
              연도 제보 승인 ({pendingProposals.length})
            </button>
          )}
        </div>
      </div>

      {showRetroCover && (
        <div
          data-keep-dark="true"
          className={`relative rounded-xl overflow-hidden border px-5 py-4 transition-all ${
            isChalkboard
              ? 'bg-[#1a3327] border-slate-700'
              : 'bg-[#3d2520] border-slate-700'
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
                className="underline hover:text-white cursor-pointer font-medium whitespace-nowrap"
              >
                {isChalkboard ? '노을 배경으로 변경' : '칠판 배경으로 변경'}
              </button>

              <span className="text-white/30">|</span>

              {editingBannerKeyword ? (
                <form onSubmit={handleApplyBannerKeyword} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={keywordDraft}
                    onChange={(e) => setKeywordDraft(e.target.value)}
                    placeholder="예: 성동고 1989"
                    className="px-2.5 py-1 rounded-md bg-black/40 border border-white/30 text-white text-[12px] font-medium w-44 sm:w-52 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-2.5 py-1 rounded-md bg-white text-slate-900 text-[11.5px] font-semibold whitespace-nowrap cursor-pointer"
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
                  className="underline text-white/90 hover:text-white cursor-pointer font-medium whitespace-nowrap"
                >
                  간판 이름 · 연도 변경
                </button>
              )}
            </div>

            <div className="flex flex-col items-start lg:items-center text-left lg:text-center gap-0.5 min-w-0">
              <h2 className="text-[18px] sm:text-[20px] text-white font-semibold tracking-tight break-keep">
                {bannerTitle}
              </h2>
              <span className="text-[12px] text-white/70">
                동창회 사진 공유방
              </span>
            </div>

            <button
              type="button"
              onClick={() => void handleCopyInviteHook()}
              className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-900 text-[12px] font-semibold transition-colors shrink-0 whitespace-nowrap cursor-pointer"
            >
              {inviteCopied ? '✓ 초대 링크 복사됨' : '초대 문구 복사'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
