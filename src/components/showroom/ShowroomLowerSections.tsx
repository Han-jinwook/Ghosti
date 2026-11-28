import React from 'react';
import { GhostiBrandLogo } from '../GhostiBrandLogo';
import {
  SHOWROOM_BEFORE_AFTER_JOB_CASES,
  SHOWROOM_BEFORE_AFTER_MENU_CASES,
  type ShortsItem,
} from './showroomDataAndUtils';

export interface ShowroomLowerSectionsProps {
  activeMainTab: 'secretary' | 'search' | 'share' | 'paid';
  paidEntryType: 'pro' | 'b2b' | null;
  shortsList: ShortsItem[];
  activeShortsModal: ShortsItem | null;
  setActiveShortsModal: React.Dispatch<React.SetStateAction<ShortsItem | null>>;
  certModalOpen: boolean;
  setCertModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isStoreAppMode: boolean;
  verifiedUserEmail: string;
  scrollToEmailBox: () => void;
  onSelectFreeTab: (tab: 'secretary' | 'search' | 'share') => void;
}

export const ShowroomLowerSections: React.FC<ShowroomLowerSectionsProps> = ({
  activeMainTab,
  paidEntryType,
  shortsList,
  activeShortsModal,
  setActiveShortsModal,
  certModalOpen,
  setCertModalOpen,
  isStoreAppMode,
  verifiedUserEmail,
  scrollToEmailBox,
  onSelectFreeTab,
}) => {
  // 현재 선택된 무료 탭에 해당하는 Before vs After 사례 & 쇼츠 영상만 핀셋 필터링
  const matchedMenuCase =
    activeMainTab === 'secretary'
      ? SHOWROOM_BEFORE_AFTER_MENU_CASES.find((c) => c.id === 'ghost-secretary')
      : activeMainTab === 'search'
      ? SHOWROOM_BEFORE_AFTER_MENU_CASES.find((c) => c.id === 'ghost-search')
      : activeMainTab === 'share'
      ? SHOWROOM_BEFORE_AFTER_MENU_CASES.find((c) => c.id === 'photo-share')
      : null;

  const matchedShorts =
    activeMainTab === 'secretary'
      ? shortsList.filter((s) => s.category === 'clean')
      : activeMainTab === 'search'
      ? shortsList.filter((s) => s.category === 'video' || s.category === 'doc')
      : [];

  const shareJobCases =
    activeMainTab === 'share'
      ? SHOWROOM_BEFORE_AFTER_JOB_CASES.filter(
          (j) => j.persona.includes('육아맘') || j.persona.includes('동창회')
        )
      : [];

  const paidMenuCases = SHOWROOM_BEFORE_AFTER_MENU_CASES.filter(
    (c) => c.id === 'device-pro' || c.id === 'work-share-s'
  );

  return (
    <>
      {/* 1) 선택된 무료 기능 전용 [Before vs After 사례 + 15초 짧은 영상] 원스톱 결합 섹션 */}
      {activeMainTab !== 'paid' && matchedMenuCase && (
        <section className="pb-7 px-4 sm:px-6 max-w-6xl mx-auto">
          <div className="rounded-2xl bg-white border border-slate-300 shadow-md p-6 sm:p-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-200">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-[#FDE6B8] border border-[#EAB866] text-[#78350F] text-[11.5px] font-bold">
                    실전 활용 사례 · Before vs After
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md bg-[#FFFBEB] border border-[#F5D08A] text-[#92400E] text-[11.5px] font-semibold">
                    {matchedMenuCase.menuTag}
                  </span>
                </div>
                <h3 className="font-display text-lg sm:text-xl font-bold text-slate-900 break-keep">
                  {matchedMenuCase.title}
                </h3>
                <p className="text-[12.5px] text-slate-500 break-keep">{matchedMenuCase.targetSituation}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl bg-rose-50/70 border border-rose-200 p-4 space-y-2">
                <div className="text-[12.5px] font-bold text-rose-800">Before (기존 불편함)</div>
                <ul className="space-y-1.5 text-[13px] text-slate-700 leading-relaxed break-keep list-disc pl-4">
                  {matchedMenuCase.beforeItems.map((bi, idx) => (
                    <li key={idx}>{bi}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl bg-[#ECFDF5]/80 border border-teal-200 p-4 space-y-2">
                <div className="text-[12.5px] font-bold text-teal-800">After (귀신같이 도입 후)</div>
                <ul className="space-y-1.5 text-[13px] text-slate-800 font-medium leading-relaxed break-keep list-disc pl-4">
                  {matchedMenuCase.afterItems.map((ai, idx) => (
                    <li key={idx}>{ai}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="px-4 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-[13px] font-semibold text-slate-800 break-keep">
              {matchedMenuCase.hookLine}
            </div>

            {/* 해당 기능 전용 짧은 영상 (귀신비서 / 귀신검색) */}
            {matchedShorts.length > 0 && (
              <div className="pt-2 border-t border-slate-200 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-md bg-[#FFEDD5] border border-[#F2BE86] text-[#9A3412] text-[11.5px] font-bold">
                      15초 미리보기 영상
                    </span>
                    <span className="text-[14px] font-bold text-slate-900">
                      실제 동작 화면을 짧은 영상으로 바로 확인하세요
                    </span>
                  </div>
                  <span className="text-[12px] text-slate-500">클릭 시 즉시 재생</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {matchedShorts.map((item) => {
                    const posterUrl = item.videoUrl ? item.videoUrl.replace(/\.mp4(\?.*)?$/, '.jpg') : '';
                    return (
                      <div
                        key={item.id}
                        onClick={() => setActiveShortsModal(item)}
                        className="group rounded-xl bg-slate-50 border border-slate-300 hover:border-[#EAB866] hover:bg-[#FFFDF8] p-3.5 transition-all hover:shadow-sm cursor-pointer flex items-center gap-4"
                      >
                        <div
                          data-keep-dark="true"
                          className="relative w-24 sm:w-28 aspect-[9/14] rounded-lg bg-slate-900 border border-slate-300 overflow-hidden flex items-center justify-center shrink-0"
                        >
                          {posterUrl ? (
                            <img
                              src={posterUrl}
                              alt={item.title}
                              loading="lazy"
                              className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : item.youtubeId ? (
                            <img
                              src={`https://i.ytimg.com/vi/${item.youtubeId}/hqdefault.jpg`}
                              alt={item.title}
                              loading="lazy"
                              className="absolute inset-0 w-full h-full object-cover opacity-85 group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : null}
                          <div data-keep-dark="true" className="absolute inset-0 bg-black/35 group-hover:bg-black/20 transition-colors" />
                          <div className="relative z-10 w-9 h-9 rounded-full bg-white/95 flex items-center justify-center text-slate-900 text-xs font-bold shadow-md">
                            ▶
                          </div>
                        </div>

                        <div className="min-w-0 flex-1 space-y-1.5">
                          <span className="inline-block px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600 text-[11px] font-medium">
                            {item.tag}
                          </span>
                          <h4 className="font-bold text-[14px] text-slate-900 leading-snug break-keep line-clamp-2">
                            {item.title}
                          </h4>
                          <p className="text-[12px] text-slate-600 leading-relaxed break-keep line-clamp-2">
                            {item.solutionLine}
                          </p>
                          <div className="text-[12px] font-semibold text-[#B45309] pt-0.5">
                            영상 재생하기 →
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 사진 공유 탭 전용 가족 · 모임 실전 시나리오 */}
            {shareJobCases.length > 0 && (
              <div className="pt-2 border-t border-slate-200 space-y-3">
                <div className="text-[13.5px] font-bold text-slate-900">
                  가족 · 동호회 · 동창회 실제 활용 시나리오
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {shareJobCases.map((jc) => (
                    <div
                      key={jc.persona}
                      className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2"
                    >
                      <div className="text-[14px] font-bold text-slate-900">{jc.persona}</div>
                      <p className="text-[12.5px] text-slate-600 leading-relaxed break-keep">
                        <strong className="text-rose-700">Before:</strong> {jc.before}
                      </p>
                      <p className="text-[12.5px] text-slate-800 font-medium leading-relaxed break-keep">
                        <strong className="text-blue-800">After:</strong> {jc.after}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 2) 유료 홍보 링크(?from=pro / ?from=b2b)로 유입된 경우에만 표시되는 확장 플랜 전용 탭 */}
      {activeMainTab === 'paid' && !isStoreAppMode && (
        <section id="extensions" className="pb-7 px-4 sm:px-6 max-w-6xl mx-auto space-y-6">
          <div className="rounded-2xl bg-white border border-slate-300 shadow-md p-6 sm:p-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
              <div className="space-y-1">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-900 text-[12px] font-semibold">
                  선택형 확장 플랜 (카드 등록 없는 30일 무료체험)
                </span>
                <h3 className="font-display text-xl sm:text-2xl font-bold text-slate-900 tracking-tight break-keep">
                  다중 기기 연동과 사내 공용 폴더(S:)가 필요할 때만 선택하세요
                </h3>
                <p className="text-[13px] text-slate-500 break-keep">
                  단독 기기 기본 기능(귀신비서 · 귀신검색 · 사진 공유)은 평생 무료로 유지됩니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSelectFreeTab('secretary')}
                className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-[12.5px] font-semibold cursor-pointer whitespace-nowrap"
              >
                무료 3대 기능 먼저 체험하기 →
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div
                className={`rounded-xl p-5 space-y-3 ${
                  paidEntryType === 'pro'
                    ? 'bg-blue-50/40 border-2 border-blue-600 shadow-sm'
                    : 'bg-slate-50 border border-slate-300'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[15px] font-bold text-slate-900">4. 내 기기 통합 Pro</span>
                  <span className="px-2.5 py-0.5 rounded-md bg-blue-600 text-white text-[12px] font-semibold whitespace-nowrap">
                    30일 무료체험 · 월 3,900원
                  </span>
                </div>
                <div className="text-[16px] font-bold text-slate-900 break-keep">
                  카톡 ‘나에게 보내기’ 끝, 내 모든 기기를 하나로
                </div>
                <p className="text-[13px] text-slate-600 leading-relaxed break-keep">
                  폰으로 찍은 사진·영수증의 1초 사진·표 OCR 추출과 귀신 라벨러, 내 폰·집컴·회사컴 통합 검색·원본 백업, 7일 통합 클립보드 보관함(PC↔PC 무버튼 직결 · 폰↔PC 1~2탭 직송)을 함께 사용합니다.
                </p>
                <p className="text-[12px] text-slate-500 break-keep">
                  연간 결제 시 39,000원(2개월 무료) · 체험 종료 시 자동 결제 없이 원격 연동만 잠금 처리되며 로컬 원본은 100% 보존됩니다.
                </p>
              </div>

              <div
                id="work-share"
                className={`rounded-xl p-5 space-y-3 ${
                  paidEntryType === 'b2b'
                    ? 'bg-blue-50/40 border-2 border-blue-600 shadow-sm'
                    : 'bg-slate-50 border border-slate-300'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[15px] font-bold text-slate-900">5. 업무 공유 (공용 폴더 S:)</span>
                  <span className="px-2.5 py-0.5 rounded-md bg-blue-600 text-white text-[12px] font-semibold whitespace-nowrap">
                    30일 무료체험 · 월 9,900원~
                  </span>
                </div>
                <div className="text-[16px] font-bold text-slate-900 break-keep">
                  팀 PC를 공용 폴더(S: 드라이브) 하나로 연결
                </div>
                <p className="text-[13px] text-slate-600 leading-relaxed break-keep">
                  별도 NAS 장비 없이 사내 대표 PC 폴더를 공유 드라이브(S:)로 연결해 계약서·견적서·현장 사진을 팀원들과 함께 검색하고 관리합니다(인당 과금 없는 대표 1인 정액제).
                </p>
                <p className="text-[12px] text-slate-500 break-keep">
                  소호(~5인) 월 9,900원 · 소기업(~20인) 월 19,000원 · 중소기업(~50인) 월 29,000원 · 초대된 팀원 전원 무료.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
              {paidMenuCases.map((mc) => (
                <div key={mc.id} className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2">
                  <div className="text-[13.5px] font-bold text-slate-900 break-keep">{mc.title}</div>
                  <p className="text-[12.5px] text-slate-600 break-keep">{mc.hookLine}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex flex-wrap gap-1.5 text-[11.5px] font-semibold text-slate-700">
                {['종단간 암호화 전송', '휴지통 복원 지원', '법인 세금계산서 발행', '(주)썬드림 고객지원'].map((badge) => (
                  <span key={badge} className="px-2.5 py-1 rounded-md bg-slate-100 border border-slate-300 whitespace-nowrap">
                    {badge}
                  </span>
                ))}
              </div>
              <button
                type="button"
                onClick={scrollToEmailBox}
                className="px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-[13.5px] cursor-pointer transition-colors"
              >
                {verifiedUserEmail ? '출시 알림 예약 완료' : '출시 알림 신청하고 30일 체험 받기'}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* 3) 공통 하단 대형 신뢰 배너: 각 기능 메뉴 하단에 큼직하게 고정되는 [개인 · 민간 기업 기본 기능 무료 사용 확인서] */}
      <section id="security" className="pb-10 px-4 sm:px-6 max-w-6xl mx-auto space-y-5">
        <div className="rounded-2xl bg-white border-2 border-[#F3D7A5] shadow-md p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-8 space-y-3.5 min-w-0 flex flex-col items-center text-center lg:items-start lg:text-left">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#FFFBEB] border border-[#F5D08A] text-[#92400E] text-[12px] font-bold">
              개인 · 민간 기업 기본 기능 평생 무료 사용 확인서
            </span>
            <h3 className="font-display text-xl sm:text-2xl font-bold text-slate-900 leading-snug break-keep">
              집 PC는 물론 회사 PC에서도 기본 3대 기능은 평생 무료로 안심하고 쓰세요
            </h3>

            <div className="flex flex-wrap justify-center lg:justify-start gap-2 text-[12.5px] font-semibold text-slate-800">
              {[
                '귀신비서 · 귀신검색 · 사진 공유 평생 0원',
                '원본 파일 외부 서버 업로드 0%',
                '광고 팝업 0% · 공식 무료 확인서 제공',
              ].map((pill) => (
                <span
                  key={pill}
                  className="px-3 py-1 rounded-lg bg-slate-100 border border-slate-300 break-keep"
                >
                  {pill}
                </span>
              ))}
            </div>
            <p className="text-[12.5px] text-slate-600 break-keep leading-relaxed">
              기본 3대 기능은 외부 클라우드 서버 없이 내 기기 안에서만 작동해 서버 유지비가 들지 않으므로 개인과 민간 기업 모두에게 평생 무료로 제공합니다. (공공기관 별도 문의)
            </p>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setCertModalOpen(true)}
                className="px-4 py-2.5 rounded-lg bg-[#FDE6B8] hover:bg-[#FCD894] border border-[#EAB866] text-[#78350F] font-semibold text-[13px] cursor-pointer transition-colors whitespace-nowrap shadow-2xs"
              >
                무료 사용 확인서 크게 보기
              </button>
              <a
                href="/showroom/certificates/ghosti_b2b_free_certificate.html"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-lg bg-white hover:bg-[#FFFBEB] border border-slate-300 text-slate-800 font-semibold text-[13px] transition-colors whitespace-nowrap"
              >
                인쇄 · PDF 저장 페이지 열기 ↗
              </a>
            </div>
          </div>

          <div className="lg:col-span-4 flex justify-center">
            <div
              onClick={() => setCertModalOpen(true)}
              className="w-44 sm:w-52 rounded-xl overflow-hidden border-2 border-slate-300 shadow-sm cursor-pointer hover:border-blue-500 transition-all bg-white"
            >
              <img
                src="/showroom/certificates/ghosti_b2b_free_certificate.png?v=20261123"
                alt="귀신같이 무료 사용 확인서"
                className="w-full h-auto object-contain"
              />
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-300 bg-white/80 py-7 px-4 sm:px-6 text-[12.5px] text-slate-600">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
            <GhostiBrandLogo size="mobile" />
            <p className="text-slate-600 break-keep">
              (주)썬드림 · 상표출원 제40-2026-0229386호 · 기기 내 로컬 파일 보호 설계
            </p>
          </div>
          <span className="select-none text-slate-500">© 2026 (주)썬드림 · Sundreamer Studio. All rights reserved.</span>
        </div>
      </footer>

      {activeShortsModal && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 pt-safe pb-safe"
          onClick={() => setActiveShortsModal(null)}
        >
          <div
            className="relative w-full max-w-sm rounded-2xl bg-white border border-slate-300 p-4 sm:p-5 shadow-xl flex flex-col justify-between max-h-[90dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActiveShortsModal(null)}
              className="absolute top-3.5 right-3.5 w-8 h-8 shrink-0 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center text-sm font-medium z-20 cursor-pointer"
            >
              ✕
            </button>

            <div>
              <div className="flex items-center gap-2 mb-3 pr-9">
                <span className="px-2.5 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-900 text-[12px] font-semibold">
                  {activeShortsModal.tag}
                </span>
              </div>

              {activeShortsModal.videoUrl ? (
                <div
                  data-keep-dark="true"
                  className="relative aspect-[9/16] rounded-xl overflow-hidden bg-black border border-slate-200 mb-4"
                >
                  <video
                    src={activeShortsModal.videoUrl}
                    controls
                    autoPlay
                    playsInline
                    loop
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : activeShortsModal.youtubeId ? (
                <div
                  data-keep-dark="true"
                  className="relative aspect-[9/16] rounded-xl overflow-hidden bg-black border border-slate-200 mb-4"
                >
                  <iframe
                    src={`https://www.youtube.com/embed/${activeShortsModal.youtubeId}?autoplay=1&rel=0&playsinline=1`}
                    title={activeShortsModal.title}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => {
                setActiveShortsModal(null);
                scrollToEmailBox();
              }}
              className="w-full py-3 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-[13.5px] cursor-pointer transition-colors"
            >
              {verifiedUserEmail ? '✓ 출시 알림 예약됨 (다른 기능 둘러보기)' : '출시 알림 신청하기'}
            </button>
          </div>
        </div>
      )}

      {certModalOpen && (
        <div
          className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 pt-safe pb-safe"
          onClick={() => setCertModalOpen(false)}
        >
          <div
            className="relative max-w-2xl w-full max-h-[92dvh] overflow-y-auto rounded-2xl bg-white border border-slate-300 p-4 sm:p-6 shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-900 font-semibold text-sm sm:text-base min-w-0 break-keep">
                개인 및 민간 기업 PC 기본 기능 무료 사용 확인서
              </span>
              <button
                type="button"
                onClick={() => setCertModalOpen(false)}
                className="w-8 h-8 shrink-0 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="rounded-xl overflow-hidden border border-slate-200 bg-white">
              <img
                src="/showroom/certificates/ghosti_b2b_free_certificate.png?v=20261123"
                alt="귀신같이 무료 사용 확인서"
                className="w-full h-auto object-contain"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <a
                href="/showroom/certificates/ghosti_b2b_free_certificate.html"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-[13px] transition-colors"
              >
                인쇄 · PDF 저장용 페이지 열기 ↗
              </a>
              <button
                type="button"
                onClick={() => setCertModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-medium text-[13px] cursor-pointer transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
