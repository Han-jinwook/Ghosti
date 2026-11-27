import React from 'react';
import type { ShortsItem } from './showroomDataAndUtils';

export interface ShowroomLowerSectionsProps {
  shortsList: ShortsItem[];
  selectedCategory: 'all' | 'video' | 'doc' | 'clean';
  setSelectedCategory: React.Dispatch<React.SetStateAction<'all' | 'video' | 'doc' | 'clean'>>;
  filteredShorts: ShortsItem[];
  activeShortsModal: ShortsItem | null;
  setActiveShortsModal: React.Dispatch<React.SetStateAction<ShortsItem | null>>;
  certModalOpen: boolean;
  setCertModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isStoreAppMode: boolean;
  b2bFocused: boolean;
  verifiedUserEmail: string;
  scrollToEmailBox: () => void;
}

export const ShowroomLowerSections: React.FC<ShowroomLowerSectionsProps> = ({
  shortsList,
  selectedCategory,
  setSelectedCategory,
  filteredShorts,
  activeShortsModal,
  setActiveShortsModal,
  certModalOpen,
  setCertModalOpen,
  isStoreAppMode,
  b2bFocused,
  verifiedUserEmail,
  scrollToEmailBox,
}) => {
  return (
    <>
      <section id="shorts" className="py-14 px-4 sm:px-6 max-w-6xl mx-auto border-t border-slate-200">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <span className="inline-block px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-[12px] font-medium mb-3">
            기능 미리보기 영상
          </span>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight break-keep mb-2">
            짧은 영상으로 살펴보는 주요 기능
          </h2>
          <p className="text-slate-500 text-[13.5px] break-keep">
            귀신비서와 귀신검색의 실제 동작 흐름을 {shortsList.length}편의 짧은 영상으로 확인해 보세요.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-1.5 mt-5">
            {[
              { id: 'all', label: `전체 (${shortsList.length})` },
              { id: 'video', label: '동영상 장면 검색' },
              { id: 'doc', label: '문서 본문 검색' },
              { id: 'clean', label: '사진 · PC 정리' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedCategory(tab.id as any)}
                className={`px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  selectedCategory === tab.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredShorts.map((item) => {
            const posterUrl = item.videoUrl ? item.videoUrl.replace(/\.mp4(\?.*)?$/, '.jpg') : '';
            return (
              <div
                key={item.id}
                onClick={() => setActiveShortsModal(item)}
                className="group rounded-xl bg-white border border-slate-200 hover:border-slate-300 p-4 transition-all hover:shadow-sm cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div
                    data-keep-dark="true"
                    className="relative aspect-[9/16] max-h-60 w-full rounded-lg bg-slate-900 border border-slate-200 mb-3.5 overflow-hidden flex items-center justify-center p-4 text-center"
                  >
                    {posterUrl ? (
                      <img
                        src={posterUrl}
                        alt={item.title}
                        loading="lazy"
                        className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:scale-[1.02] transition-transform duration-300"
                      />
                    ) : item.youtubeId ? (
                      <img
                        src={`https://i.ytimg.com/vi/${item.youtubeId}/hqdefault.jpg`}
                        alt={item.title}
                        loading="lazy"
                        className="absolute inset-0 w-full h-full object-cover opacity-85 group-hover:scale-[1.02] transition-transform duration-300"
                      />
                    ) : null}
                    <div
                      data-keep-dark="true"
                      className="absolute inset-0 bg-black/35 group-hover:bg-black/25 transition-colors"
                    />
                    <div className="relative z-10 flex flex-col items-center gap-2">
                      <div className="w-11 h-11 rounded-full bg-white/95 flex items-center justify-center text-slate-900 text-base font-bold shadow-md">
                        ▶
                      </div>
                      <span className="text-[11.5px] font-medium px-2.5 py-0.5 rounded-full bg-black/70 text-white">
                        영상 재생
                      </span>
                    </div>
                    <span className="absolute top-2.5 left-2.5 text-[11px] font-medium px-2 py-0.5 rounded bg-black/70 text-white">
                      {item.tag}
                    </span>
                  </div>

                  <h3 className="font-semibold text-[15px] text-slate-900 leading-snug mb-1.5 break-keep">
                    {item.title}
                  </h3>
                  <p className="text-[12.5px] text-slate-500 mb-1.5 line-clamp-2 break-keep leading-relaxed">
                    {item.hookLine}
                  </p>
                  <p className="text-[12.5px] text-slate-700 font-medium mb-3 line-clamp-2 break-keep leading-relaxed">
                    {item.solutionLine}
                  </p>
                </div>

                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[12px] text-slate-500">
                  <span className="truncate">{item.recommendedKeyword}</span>
                  <span className="text-slate-900 font-medium shrink-0 ml-2 whitespace-nowrap">보기 →</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section id="security" className="py-12 px-4 sm:px-6 max-w-6xl mx-auto border-t border-slate-200 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl bg-white border border-slate-200 p-5 space-y-1.5">
            <div className="text-[14px] font-semibold text-slate-900">기기 내 로컬 처리</div>
            <p className="text-[13px] text-slate-600 leading-relaxed break-keep">
              문서·사진·영상 원본은 외부 서버로 업로드되지 않고 내 PC와 스마트폰 안에서 색인 및 처리됩니다.
            </p>
          </div>
          <div className="rounded-xl bg-white border border-slate-200 p-5 space-y-1.5">
            <div className="text-[14px] font-semibold text-slate-900">안전한 절전 전환과 휴지통 보관</div>
            <p className="text-[13px] text-slate-600 leading-relaxed break-keep">
              은행 보안프로그램은 삭제하지 않고 절전 모드로 전환해 필요 시 다시 실행하며, 정리한 사진과 파일도 휴지통에서 언제든 복원할 수 있습니다.
            </p>
          </div>
          <div className="rounded-xl bg-white border border-slate-200 p-5 space-y-1.5">
            <div className="text-[14px] font-semibold text-slate-900">암호화 기기 연결 및 권한 관리</div>
            <p className="text-[13px] text-slate-600 leading-relaxed break-keep">
              내 기기 통합 및 팀 공용 폴더(S: 드라이브) 연결 시 암호화 전송과 멤버별 접근 권한 회수를 지원합니다.
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-8 space-y-3.5 min-w-0 flex flex-col items-center text-center lg:items-start lg:text-left">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-700 text-[12px] font-medium">
              개인 · 민간 기업 기본 기능 무료 사용 확인서
            </span>
            <h3 className="font-display text-lg sm:text-2xl font-bold text-slate-900 leading-snug break-keep">
              회사 PC에서도 기본 기능은 별도 라이선스 비용 없이 사용하실 수 있습니다
            </h3>

            <div className="flex flex-wrap justify-center lg:justify-start gap-2 text-[12.5px] font-medium text-slate-700">
              {[
                '법인 · 개인사업자 사내 PC 기본 기능 무료',
                '별도 광고 없음',
                '공식 무료 사용 확인서 제공',
              ].map((pill) => (
                <span
                  key={pill}
                  className="px-3 py-1 rounded-lg bg-white border border-slate-200 break-keep"
                >
                  {pill}
                </span>
              ))}
            </div>
            <p className="text-[12.5px] text-slate-500 break-keep leading-relaxed">
              단독 기기에서 사용하는 귀신비서·귀신검색·사진 공유 기본 기능에 적용되며, 다중 기기 통합 및 팀 공용 폴더(S:)는 선택형 유료 구독으로 제공됩니다(공공기관 별도 문의).
            </p>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setCertModalOpen(true)}
                className="px-4 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium text-[13px] cursor-pointer transition-colors whitespace-nowrap"
              >
                무료 사용 확인서 보기
              </button>
              <a
                href="/showroom/certificates/ghosti_b2b_free_certificate.html"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-medium text-[13px] transition-colors whitespace-nowrap"
              >
                인쇄용 페이지 열기 ↗
              </a>
            </div>
          </div>

          <div className="lg:col-span-4 flex justify-center">
            <div
              onClick={() => setCertModalOpen(true)}
              className="w-40 sm:w-48 rounded-xl overflow-hidden border border-slate-200 shadow-sm cursor-pointer hover:border-slate-300 transition-all bg-white"
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

      {!isStoreAppMode && (
        <section id="extensions" className="py-10 px-4 sm:px-6 max-w-6xl mx-auto border-t border-slate-200">
          <div className="rounded-2xl bg-white border border-slate-200 p-6 sm:p-8 space-y-5">
            <div className="space-y-1.5">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-600 text-[12px] font-medium">
                선택형 구독 플랜 (30일 무료체험 제공)
              </span>
              <h3 className="font-display text-xl sm:text-2xl font-bold text-slate-900 tracking-tight break-keep">
                여러 기기 연동과 팀 공용 폴더가 필요할 때만 선택하세요
              </h3>
              <p className="text-[13px] text-slate-500 break-keep">
                단일 기기 기본 기능(귀신비서 · 귀신검색 · 사진 공유)은 무료로 유지되며, 기기 간 연동과 사내 공용 드라이브만 정찰제로 운영됩니다.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-5 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[14px] font-semibold text-slate-900">
                    4. 내 기기 통합
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md bg-amber-50 border border-amber-300 text-amber-900 text-[12px] font-semibold whitespace-nowrap">
                    30일 무료체험 · 월 3,900원
                  </span>
                </div>
                <div className="text-[16px] font-semibold text-slate-900 break-keep">
                  카톡 ‘나에게 보내기’ 끝, 내 모든 기기를 하나로
                </div>
                <p className="text-[13px] text-slate-600 leading-relaxed break-keep">
                  폰으로 찍은 사진·영수증의 1초 사진·표 OCR 추출과 귀신 라벨러, 내 폰·집컴·회사컴 통합 검색·원본 백업, 7일 통합 클립보드 보관함(PC↔PC 무버튼 직결 · 폰↔PC 1탭 전송)을 함께 사용합니다.
                </p>
                <details className="pt-1 text-[12.5px] text-slate-600">
                  <summary className="cursor-pointer font-medium text-slate-800 hover:text-slate-900 select-none">
                    연동 방식 자세히 보기
                  </summary>
                  <p className="mt-2 leading-relaxed text-slate-600 break-keep">
                    동일 이메일로 로그인한 내 스마트폰과 PC를 연결하며(연간 결제 시 39,000원), 체험 종료 시 자동 결제 없이 원격 연동 기능만 비활성화되고 로컬 원본 파일은 그대로 유지됩니다.
                  </p>
                </details>
              </div>

              <div
                id="work-share"
                className={`rounded-xl bg-slate-50 p-5 space-y-2.5 ${
                  b2bFocused
                    ? 'border-2 border-slate-900'
                    : 'border border-slate-200'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[14px] font-semibold text-slate-900">
                    5. 업무 공유 (공용 폴더 S:)
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCertModalOpen(true)}
                      className="px-2.5 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-[11.5px] font-semibold cursor-pointer whitespace-nowrap"
                    >
                      기업 기본 기능 확인서
                    </button>
                    <span className="px-2.5 py-0.5 rounded-md bg-amber-50 border border-amber-300 text-amber-900 text-[12px] font-semibold whitespace-nowrap">
                      30일 체험 · 월 9,900원~
                    </span>
                  </div>
                </div>
                <div className="text-[16px] font-semibold text-slate-900 break-keep">
                  팀 PC를 공용 폴더(S: 드라이브) 하나로 연결
                </div>
                <p className="text-[13px] text-slate-600 leading-relaxed break-keep">
                  별도 NAS 장비 없이 사내 대표 PC 폴더를 공유 드라이브(S:)로 연결해 계약서·견적서·현장 사진을 팀원들과 함께 검색하고 관리합니다(대표 1인 구독 정액제).
                </p>
                <details open={b2bFocused || undefined} className="pt-1 text-[12.5px] text-slate-600">
                  <summary className="cursor-pointer font-medium text-slate-800 hover:text-slate-900 select-none">
                    규모별 요금 안내 보기
                  </summary>
                  <p className="mt-2 leading-relaxed text-slate-600 break-keep">
                    30일 무료체험 후 소호(~5인) 월 9,900원, 소기업(~20인) 월 19,000원, 중소기업(~50인) 월 29,000원의 대표 1인 정액제로 이용하실 수 있으며 초대된 팀원에게는 별도 과금이 없습니다.
                  </p>
                </details>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-slate-600">
              <span>기본 기능은 기기 내 로컬 방식으로 동작하여 별도 서버 유지비 없이 제공됩니다.</span>
              <div className="flex flex-wrap gap-1.5 text-[11.5px] font-semibold text-amber-900">
                {['암호화 전송', '휴지통 복원 지원', '법인 세금계산서 발행', '(주)썬드림 고객지원'].map((badge) => (
                  <span
                    key={badge}
                    className="px-2.5 py-1 rounded-md bg-amber-50 border border-amber-300 whitespace-nowrap"
                  >
                    {badge}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <section id="manifesto" className="py-10 px-4 sm:px-6 max-w-6xl mx-auto border-t border-slate-200">
        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-6 sm:p-8 space-y-4">
          <div className="space-y-1.5">
            <span className="inline-block px-2.5 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 text-[12px] font-medium">
              서비스 철학
            </span>
            <p className="font-display text-[17px] sm:text-[19px] font-bold text-slate-900 break-keep">
              조용하고 가볍게, 필요한 순간에만 돕는 도구
            </p>
          </div>
          <div className="space-y-3 pt-3 border-t border-slate-200 text-[13.5px] leading-relaxed text-slate-600 break-keep">
            <p>
              수많은 유틸리티 프로그램이 오히려 컴퓨터를 무겁게 만들거나 불필요한 알림창으로 작업 흐름을 방해하곤 합니다.
            </p>
            <p>
              귀신같이(Ghosti)는 평소에는 시스템 자원을 아끼며 조용히 대기하다가, 파일을 찾거나 정리가 필요할 때만 빠르고 정확하게 동작하도록 설계되었습니다.
            </p>
            <p>
              복잡한 설정을 새로 배울 필요 없이, 내 컴퓨터와 스마트폰에 담긴 사진과 문서를 안심하고 쾌적하게 관리해 보세요.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 py-8 px-4 sm:px-6 max-w-6xl mx-auto text-[12.5px] text-slate-500">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
            <div className="flex items-center gap-2">
              <img
                src="/gwisinkachi_app_icon_512.png"
                alt="귀신같이 아이콘"
                className="w-6 h-6 rounded-md object-cover border border-slate-200"
              />
              <span className="font-semibold text-slate-800">귀신같이 (Ghosti)</span>
            </div>
            <p className="text-slate-500 break-keep">
              (주)썬드림 · 상표출원 제40-2026-0229386호 · 기기 내 로컬 파일 보호 설계
            </p>
          </div>
          <span className="select-none">© 2026 (주)썬드림 · Sundreamer Studio. All rights reserved.</span>
        </div>
      </footer>

      {activeShortsModal && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 pt-safe pb-safe"
          onClick={() => setActiveShortsModal(null)}
        >
          <div
            className="relative w-full max-w-sm rounded-2xl bg-white border border-slate-200 p-4 sm:p-5 shadow-xl flex flex-col justify-between max-h-[90dvh] overflow-y-auto"
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
                <span className="px-2.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 text-[12px] font-medium">
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
              className="w-full py-3 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium text-[13.5px] cursor-pointer transition-colors"
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
            className="relative max-w-2xl w-full max-h-[92dvh] overflow-y-auto rounded-2xl bg-white border border-slate-200 p-4 sm:p-6 shadow-xl space-y-4"
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
                className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium text-[13px] transition-colors"
              >
                인쇄 · PDF 저장용 페이지 열기 ↗
              </a>
              <button
                type="button"
                onClick={() => setCertModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-medium text-[13px] cursor-pointer transition-colors"
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
