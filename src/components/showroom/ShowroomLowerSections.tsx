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
      {/* =====================================================================
          3. 중단 공식 15초 예고편 영상관 (#귀신비서 · #귀신검색)
         ===================================================================== */}
      <section id="shorts" className="py-16 px-4 sm:px-6 max-w-7xl mx-auto border-t border-white/5">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-teal-500/10 border border-teal-500/25 text-teal-400 text-[13px] font-black mb-3">
            <img
              src="/gwisinkachi_app_icon_512.png"
              alt="아기귀신"
              className="w-5 h-5 rounded-full object-cover"
            />
            <span>15초 공식 예고편 쇼룸</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2.5 mb-2">
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight break-keep">
              15초면 끝! 한눈에 보는
            </h2>
            <img
              src="/gwisinkachi_wordmark_dark_ink.png"
              alt="귀신같이 캘리그라피"
              className="h-8 sm:h-11 w-auto object-contain"
            />
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight break-keep">
              핵심 예고편
            </h2>
          </div>
          <p className="text-zinc-400 text-[13.5px] sm:text-sm font-semibold break-keep">
            글 대신 영상으로 가볍게 확인하세요! <b className="text-[#00F0B5]">#귀신비서 · #귀신검색</b> {shortsList.length}편 즉시 재생
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
            {[
              { id: 'all', label: `전체 미리보기 (${shortsList.length})` },
              { id: 'video', label: '🎬 영상 글자·장면 소환 (#귀신검색)' },
              { id: 'doc', label: '📊 엑셀·문서 내용 찾기 (#귀신검색)' },
              { id: 'clean', label: '🧹 사진·보안앱 청소 (#귀신비서)' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedCategory(tab.id as any)}
                className={`px-4 py-2 rounded-xl text-[13px] sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                  selectedCategory === tab.id
                    ? 'bg-[#00F0B5] text-slate-950 shadow-[0_0_20px_rgba(0,240,181,0.4)]'
                    : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredShorts.map((item) => {
            const posterUrl = item.videoUrl ? item.videoUrl.replace(/\.mp4(\?.*)?$/, '.jpg') : '';
            return (
              <div
                key={item.id}
                onClick={() => setActiveShortsModal(item)}
                className="group rounded-2xl bg-zinc-900/60 border border-white/10 hover:border-teal-400/50 p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_15px_40px_rgba(0,240,181,0.15)] cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div
                    data-keep-dark="true"
                    className={`relative aspect-[9/16] max-h-64 w-full rounded-xl bg-slate-950 border border-white/15 mb-4 overflow-hidden flex items-center justify-center p-4 text-center`}
                  >
                    {posterUrl ? (
                      <img
                        src={posterUrl}
                        alt={item.title}
                        loading="lazy"
                        className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : item.youtubeId ? (
                      <img
                        src={`https://i.ytimg.com/vi/${item.youtubeId}/hqdefault.jpg`}
                        alt={item.title}
                        loading="lazy"
                        className="absolute inset-0 w-full h-full object-cover opacity-85 group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : null}
                    <div
                      data-keep-dark="true"
                      className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/40 group-hover:bg-black/20 transition-colors"
                    />
                    <div className="relative z-10">
                      <div className="w-12 h-12 rounded-full bg-[#00F0B5] flex items-center justify-center mx-auto mb-2 text-slate-950 text-xl font-black shadow-lg group-hover:scale-110 transition-transform">
                        ▶
                      </div>
                      <span
                        style={{ backgroundColor: 'rgba(15, 23, 42, 0.88)', color: '#5EEAD4' }}
                        className="text-xs font-extrabold px-3 py-1 rounded-full border border-teal-400/50 shadow"
                      >
                        15초 영상 바로 재생
                      </span>
                    </div>
                    <span
                      style={{ backgroundColor: 'rgba(15, 23, 42, 0.88)', color: '#FFFFFF' }}
                      className="absolute top-2.5 left-2.5 text-xs font-extrabold px-2.5 py-1 rounded-md shadow"
                    >
                      {item.tag}
                    </span>
                  </div>

                  <h3 className="font-black text-base text-zinc-100 group-hover:text-[#00F0B5] transition-colors leading-snug mb-2 break-keep">
                    {item.title}
                  </h3>
                  <div className="text-[13px] text-zinc-300 font-semibold mb-1.5 line-clamp-2 break-keep">
                    {item.hookLine}
                  </div>
                  <div className="text-[13px] text-teal-300 font-extrabold mb-3 line-clamp-2 break-keep">
                    👉 {item.solutionLine}
                  </div>
                </div>

                <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[13px] text-zinc-400">
                  <span className="truncate">
                    검색 키워드: <b className="text-amber-300">{item.recommendedKeyword}</b>
                  </span>
                  <span className="text-[#00F0B5] font-extrabold shrink-0 ml-2 whitespace-nowrap">재생 ➔</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* =====================================================================
          4. 🛡️ 보안·로컬 작동 원리 3원칙 & 개인·기업 PC 영구 무료 공식 보증서 (#security)
         ===================================================================== */}
      <section id="security" className="py-12 px-4 sm:px-6 max-w-7xl mx-auto border-t border-white/5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          <div className="rounded-2xl bg-zinc-900/80 border border-teal-400/30 p-5 space-y-1.5">
            <div className="text-sm font-black text-[#00F0B5]">🖥️ 외부 서버 전송 0% 로컬 실행</div>
            <p className="text-[13px] text-zinc-300 font-medium leading-relaxed break-keep">
              문서·사진·영상 원문은 외부 클라우드 서버로 단 1바이트도 업로드되지 않고 오직 내 PC와 모바일 안에서만 안전하게 색인·처리됩니다.
            </p>
          </div>
          <div className="rounded-2xl bg-zinc-900/80 border border-teal-400/30 p-5 space-y-1.5">
            <div className="text-sm font-black text-[#00F0B5]">🛡️ 은행 보안앱 안 지우고 재우기 &amp; 휴지통 복구</div>
            <p className="text-[13px] text-zinc-300 font-medium leading-relaxed break-keep">
              은행 보안프로그램은 안 지우고 조용히 재워뒀다가 은행 켜는 순간 1초 만에 깨우며, 중복·정리 파일도 휴지통 안전 격리로 언제든 되살립니다.
            </p>
          </div>
          <div className="rounded-2xl bg-zinc-900/80 border border-amber-400/30 p-5 space-y-1.5">
            <div className="text-sm font-black text-amber-300">🔐 종단간 암호화(E2EE) 직결</div>
            <p className="text-[13px] text-zinc-300 font-medium leading-relaxed break-keep">
              내 기기 통합 및 팀 공용 폴더(S: 드라이브) 연결 시 중앙 서버 저장 없이 종단간 암호화로 직결하며, 퇴사자 권한 즉시 회수와 랜섬웨어 격리를 지원합니다.
            </p>
          </div>
        </div>

        <div
          data-keep-dark="true"
          style={{
            background: 'linear-gradient(135deg, #07131E 0%, #0D292C 55%, #091322 100%)',
          }}
          className="rounded-3xl border-2 border-amber-400/50 p-4 sm:p-9 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center shadow-2xl overflow-hidden"
        >
          <div className="lg:col-span-8 space-y-4 min-w-0 flex flex-col items-center text-center lg:items-start lg:text-left">
            <div
              style={{ backgroundColor: 'rgba(251, 191, 36, 0.18)', color: '#FCD34D' }}
              className="showroom-fit-1line inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1 rounded-full border border-amber-400/40 sm:text-[13px] font-black whitespace-nowrap break-keep max-w-full"
            >
              <span className="shrink-0">📜</span>
              <span>대표이사 직인 날인 · 무료 사용 공식 확인서</span>
            </div>
            <h3 className="showroom-cert-h3 text-lg sm:text-3xl font-black text-white leading-tight break-keep">
              <span className="inline-block whitespace-nowrap">“회사 컴퓨터에 깔아도 저작권 단속 안 오나요?”</span>
              <br />
              <span style={{ color: '#00F0B5' }}>
                <span className="inline-block whitespace-nowrap">✓ 개인·기업 PC 기본 기능 영구 무료!</span>{' '}
                <span className="inline-block whitespace-nowrap">(라이선스 비용 0원)</span>
              </span>
            </h3>

            {/* 빽빽한 줄글 대신 한눈에 읽히는 3대 안심 체크 배지 (우리가 책임질 수 있는 범위만 명시) */}
            <div className="flex flex-wrap justify-center lg:justify-start gap-2 text-[13px] font-extrabold">
              {[
                '🏢 법인·개인사업자·병원·세무사 사내 PC 무료',
                '🛡️ 라이선스 비용 0원 · 광고 0%',
                '📜 회사 PC 무료 사용 허용 공식 확인서 발급',
              ].map((pill) => (
                <span
                  key={pill}
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.08)', color: '#E2E8F0' }}
                  className="px-3 py-1.5 rounded-xl border border-white/15 break-keep"
                >
                  {pill}
                </span>
              ))}
            </div>
            <p className="text-[13px] text-zinc-300 font-semibold break-keep">
              ※ 내 기기 로컬 기본 기능(귀신비서·귀신검색·사진공유) 영구 무료 (내 기기 통합·팀 공용 폴더 등 확장 옵션 및 공공기관 제외)
            </p>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 pt-1">
              <button
                type="button"
                onClick={() => setCertModalOpen(true)}
                style={{ backgroundColor: '#FBBF24', color: '#020617' }}
                className="px-4 sm:px-5 py-3 rounded-xl hover:opacity-95 font-black text-[13px] sm:text-sm cursor-pointer shadow-lg whitespace-nowrap"
              >
                📜 공식 무료 라이선스 보증서 크게 보기
              </button>
              <a
                href="/showroom/certificates/ghosti_b2b_free_certificate.html"
                target="_blank"
                rel="noopener noreferrer"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', color: '#FFFFFF' }}
                className="px-4 py-3 rounded-xl hover:opacity-90 border border-white/25 font-bold text-[13px] sm:text-sm whitespace-nowrap"
              >
                🖨️ 인쇄·비치용 보증서 새 창 열기 ↗
              </a>
            </div>
          </div>

          <div className="lg:col-span-4 flex justify-center">
            <div
              onClick={() => setCertModalOpen(true)}
              className="w-44 sm:w-52 rounded-2xl overflow-hidden border-2 border-amber-400/60 shadow-2xl cursor-pointer hover:scale-105 transition-transform bg-white"
            >
              <img
                src="/showroom/certificates/ghosti_b2b_free_certificate.png?v=20261113v2"
                alt="귀신같이 무료 공식 보증서"
                className="w-full h-auto object-contain"
              />
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          4-B. 📱·💼 유료 확장 2종 간판 · 원가 투명화 · B2B 4대 신뢰 보증 섹션 (SSOT v2.3)
               ※ 모바일 스토어 클린 모드(isStoreAppMode)에서는 Anti-Steering 헌법에 따라 100% 비노출
         ===================================================================== */}
      {!isStoreAppMode && (
        <section id="extensions" className="py-10 px-4 sm:px-6 max-w-7xl mx-auto border-t border-white/5">
          <div
            data-keep-dark="true"
            style={{
              background: 'linear-gradient(135deg, #070E1B 0%, #0C1C29 55%, #08121E 100%)',
            }}
            className="rounded-3xl border border-teal-400/30 p-6 sm:p-8 space-y-5 shadow-xl"
          >
            <div className="space-y-2">
              <span
                style={{ backgroundColor: 'rgba(20, 184, 166, 0.18)', color: '#5EEAD4' }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-teal-400/40 text-xs font-extrabold"
              >
                🔗 기기 통합 &amp; 팀 공용 폴더 확장 (카드 등록 없는 30일 무료체험)
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight break-keep">
                클라우드 월세 0원, 내 모든 기기와 우리 팀을 1초 만에 하나로
              </h3>
              <p className="text-[13px] text-zinc-300 font-semibold break-keep">
                기본 3대 핵심 기능(귀신비서 · 귀신검색 · 사진 공유)은 평생 0원이며, 내 기기 직결이나 팀 공용 폴더가 필요하신 분만 투명한 정찰제로 이용하세요.
              </p>
            </div>

            <div data-keep-dark="true" className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 4. 📱 내 기기 통합 — 핵심 가격 상시 노출 */}
              <div
                data-keep-dark="true"
                style={{ backgroundColor: '#060D17' }}
                className="rounded-2xl border border-teal-400/35 hover:border-teal-400/65 p-5 transition-all space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span style={{ color: '#00F0B5' }} className="text-sm font-black">
                    4. 📱 내 기기 통합 Pro
                  </span>
                  <span
                    style={{ backgroundColor: 'rgba(13, 148, 136, 0.28)', color: '#5EEAD4' }}
                    className="px-2.5 py-0.5 rounded-full border border-teal-400/40 text-xs font-extrabold whitespace-nowrap"
                  >
                    30일 무료체험 · 월 3,900원
                  </span>
                </div>
                <div className="text-base sm:text-lg font-black text-white break-keep">
                  카톡 ‘나에게 보내기’ 끝, 내 모든 기기를 하나로
                </div>
                <p className="text-[13px] text-zinc-100 font-semibold leading-relaxed break-keep">
                  매달 내는 클라우드 월세 없이 내 폰·집컴·회사컴을 1초 만에 직결합니다.{' '}
                  <span style={{ color: '#5EEAD4' }} className="font-bold">
                    (카드 등록 없는 30일 무료체험 · 월 3,900원)
                  </span>
                </p>
                <details className="pt-1 text-xs text-zinc-300">
                  <summary style={{ color: '#5EEAD4' }} className="cursor-pointer font-bold hover:opacity-90 select-none">
                    상세 연동 방식 보기 ▾
                  </summary>
                  <p className="mt-2 leading-relaxed text-zinc-200 break-keep">
                    동일 이메일 하나로 내 스마트폰 사진·영수증과 집·회사 PC 문서를 중앙 클라우드 업로드 없이 직접 암호화 연결합니다(연간 결제 시 월 3,250원꼴). 체험 만료 시에도 자동 결제 없이 유료 기능만 잠기며 내 PC 원본 파일은 그대로 보존됩니다.
                  </p>
                </details>
              </div>

              {/* 6. 💼 업무 공유 (공용 폴더 S:) — 공용 폴더 병기 & 핵심 요금·보안 상시 노출 */}
              <div
                id="work-share"
                data-keep-dark="true"
                style={{ backgroundColor: '#060D17' }}
                className={`rounded-2xl p-5 transition-all space-y-2.5 ${
                  b2bFocused
                    ? 'border-2 border-amber-400 ring-4 ring-amber-400/25 shadow-[0_0_32px_rgba(251,191,36,0.3)]'
                    : 'border border-amber-400/35 hover:border-amber-400/65'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span style={{ color: '#FCD34D' }} className="text-sm font-black">
                    5. 💼 업무 공유 (공용 폴더 S:)
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCertModalOpen(true)}
                      style={
                        b2bFocused
                          ? { backgroundColor: '#FBBF24', color: '#020617' }
                          : { backgroundColor: 'rgba(245, 158, 11, 0.24)', color: '#FDE68A' }
                      }
                      className="px-2.5 py-0.5 rounded-full text-xs font-black border border-amber-400/50 transition-all cursor-pointer whitespace-nowrap"
                    >
                      📜 민간 기업 영구 무료 보증서
                    </button>
                    <span
                      style={{ backgroundColor: 'rgba(245, 158, 11, 0.2)', color: '#FDE68A' }}
                      className="px-2.5 py-0.5 rounded-full border border-amber-400/40 text-xs font-extrabold whitespace-nowrap"
                    >
                      🎁 30일 체험 · 월 9,900원~
                    </span>
                  </div>
                </div>
                <div className="text-base sm:text-lg font-black text-white break-keep">
                  클라우드 월세 0원, 우리 팀 PC를 공용 폴더(S: 드라이브) 하나로
                </div>
                <p className="text-[13px] text-zinc-100 font-semibold leading-relaxed break-keep">
                  비싼 서버나 클라우드 구독 없이 사내 문서·현장 사진을 공유 드라이브(S:) 하나로 묶어 1초 만에 찾고 씁니다.{' '}
                  <span style={{ color: '#FCD34D' }} className="font-bold">
                    (소호 ~5인 월 9,900원~ · 인당 과금 없는 대표 1인 정액제 · 30일 무료체험)
                  </span>
                </p>
                <details open={b2bFocused || undefined} className="pt-1 text-xs text-zinc-300">
                  <summary style={{ color: '#FCD34D' }} className="cursor-pointer font-bold hover:opacity-90 select-none">
                    사내 공용 폴더(S: 드라이브) 도입 &amp; 팀 요금 안내 보기 ▾
                  </summary>
                  <p className="mt-2 leading-relaxed text-zinc-200 break-keep">
                    NAS 장비 도입이나 인당 클라우드 월세 부담 없이 사무실 대표 PC 한 대를 사내 공용 폴더(S: 드라이브)로 종단간 암호화(E2EE) 연결해, 계약서·견적서·현장 시공 사진을 전 직원이 1초 만에 함께 찾고 활용합니다. 카드 등록 없는 30일 무료체험 후 소호(~5인) 월 9,900원 / 소기업(~20인) 월 19,000원 / 중소기업(~50인) 월 29,000원 대표 1인 정찰제로 운영됩니다 (기본 1~3번 개인·사진공유는 회사 PC에서도 평생 0원 공식 보증서 발급).
                  </p>
                </details>
              </div>
            </div>

            {/* 상시 노출: 원가 투명화 1줄 + B2B 4대 신뢰 보증 배지 (SSOT v2.3) */}
            <div
              data-keep-dark="true"
              style={{ backgroundColor: '#060D17' }}
              className="rounded-2xl border border-white/15 p-4 sm:p-5 space-y-3"
            >
              <p className="text-[12.5px] sm:text-[13px] text-zinc-100 font-semibold leading-relaxed break-keep">
                <strong style={{ color: '#00F0B5' }}>
                  💡 기본 3대 핵심 기능(귀신비서 · 귀신검색 · 사진 공유)은 외부 클라우드 서버 없이 내 기기 안에서만 작동해 서버 비용이 0원이므로 평생 무료로 제공됩니다.
                </strong>
              </p>
              <div className="flex flex-wrap gap-2 text-xs font-extrabold">
                {[
                  '🔒 종단간 암호화(E2EE)',
                  '🛡️ 랜섬웨어 격리·스마트 캐시',
                  '🧾 법인 세금계산서 발행',
                  '🏢 썬드림(주) 공식 고객지원',
                ].map((badge) => (
                  <span
                    key={badge}
                    style={{ backgroundColor: 'rgba(255, 255, 255, 0.08)', color: '#F1F5F9' }}
                    className="px-3 py-1.5 rounded-xl border border-white/15 whitespace-nowrap"
                  >
                    {badge}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          4-C. 📜 귀신같이 브랜드 선언문 (한국어 문단 구분 & 고대비 다크 카드)
         ===================================================================== */}
      <section id="manifesto" className="py-10 px-4 sm:px-6 max-w-7xl mx-auto border-t border-white/5">
        <div
          data-keep-dark="true"
          style={{
            background: 'linear-gradient(135deg, #07111E 0%, #0B1D28 55%, #071220 100%)',
          }}
          className="rounded-3xl border border-teal-400/35 p-6 sm:p-8 space-y-5 shadow-xl"
        >
          <div className="space-y-2">
            <span
              style={{ backgroundColor: 'rgba(0, 240, 181, 0.16)', color: '#00F0B5' }}
              className="inline-block px-3 py-1 rounded-full border border-[#00F0B5]/40 text-xs font-extrabold"
            >
              📜 귀신같이 브랜드 선언문
            </span>
            <p className="text-base sm:text-lg font-black text-white break-keep">
              귀신같이(Ghosti)는 지금 쓰는 내 PC와 모바일의 답답함을 1초 만에 풀어주는 ‘광고 0% · 클라우드 월세 0원’ 초능력입니다.
            </p>
            <p style={{ color: '#5EEAD4' }} className="text-xs sm:text-[13.5px] font-extrabold break-keep">
              평소엔 내 PC와 폰 속에 조용히 숨어 있다가, 부르면 광고도 월세도 없이 1초 만에 나타나 해결합니다.
            </p>
          </div>
          <div className="space-y-3.5 pt-3 border-t border-white/15 text-[13.5px] sm:text-sm leading-relaxed text-zinc-100 font-medium break-keep">
            <p>
              지금 쓰고 계신 PC와 스마트폰은 원래 훨씬 더 빠르고 편리하게 쓰실 수 있는 기기입니다. 하지만 그동안 수많은 유틸리티 프로그램이 내 컴퓨터를 오히려 무겁게 만들고, 시도 때도 없이 광고창을 띄우며, 내 사진을 볼 때마다 매달 클라우드 월세를 요구해 왔습니다.
            </p>
            <p>
              그래서 우리는 평소엔 아무것도 차지하지 않는 착한 유령처럼 조용히 숨어 있다가, 꼭 필요한 순간에만 1초 만에 나타나 답답함을 해결해 주는 <strong style={{ color: '#00F0B5' }}>‘귀신같이’</strong>를 만들었습니다.
            </p>
            <p>
              복잡한 기능을 새로 배울 필요도, 내 소중한 파일이 외부 서버로 넘어갈 걱정도 없습니다. 광고와 클라우드 월세 없는 내 컴퓨터·스마트폰의 진짜 편리함을 이제 귀신같이 누려보세요.
            </p>
          </div>
        </div>
      </section>

      {/* 5. 최하단 마스터 푸터 */}
      <footer className="border-t border-white/10 py-10 px-4 sm:px-6 max-w-7xl mx-auto text-[13px] text-zinc-500">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-3.5 text-center sm:text-left">
            <div className="flex items-center gap-2">
              <img
                src="/gwisinkachi_app_icon_512.png"
                alt="아기귀신 심볼"
                className="w-7 h-7 rounded-lg object-cover shadow-sm"
              />
              <img
                src="/gwisinkachi_wordmark_dark_ink.png"
                alt="귀신같이 로고"
                className="h-6 w-auto object-contain opacity-90"
              />
            </div>
            <p className="font-bold text-zinc-400 break-keep">
              (주)썬드림 · PC·모바일 초능력 『귀신같이(Ghosti)』 · 상표출원 제40-2026-0229386호 · 외부 서버 전송 0 Byte 프라이버시 보장
            </p>
          </div>
          <span className="select-none">© 2026 (주)썬드림 · Sundreamer Studio. All rights reserved.</span>
        </div>
      </footer>

      {/* 6. 세로형 15초 쇼츠 재생 모달 팝업 */}
      {activeShortsModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 pt-safe pb-safe"
          onClick={() => setActiveShortsModal(null)}
        >
          <div
            className="relative w-full max-w-sm rounded-3xl bg-zinc-950 border border-teal-500/40 p-4 sm:p-5 shadow-2xl flex flex-col justify-between max-h-[90dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActiveShortsModal(null)}
              className="absolute top-3.5 right-3.5 w-9 h-9 shrink-0 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm font-bold z-20 cursor-pointer"
            >
              ✕
            </button>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2.5 py-0.5 rounded bg-teal-500/20 text-[#00F0B5] text-xs font-extrabold">
                  {activeShortsModal.tag}
                </span>
              </div>

              {activeShortsModal.videoUrl ? (
                <div className="relative aspect-[9/16] rounded-2xl overflow-hidden bg-black border border-white/10 mb-4 shadow-inner">
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
                <div className="relative aspect-[9/16] rounded-2xl overflow-hidden bg-black border border-white/10 mb-4 shadow-inner">
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
              data-keep-dark="true"
              style={{ background: 'linear-gradient(90deg, #00F0B5 0%, #2DD4BF 100%)', color: '#020617' }}
              className="w-full py-3.5 rounded-xl font-black text-[13.5px] sm:text-sm cursor-pointer hover:opacity-90"
            >
              {verifiedUserEmail ? '✅ 출시 알림 예약됨 (다른 기능 체험하기)' : '🔔 이 기능 정식 출시 1순위 알림받기'}
            </button>
          </div>
        </div>
      )}

      {/* 7. 공식 무료 보증서 라이트박스 모달 */}
      {certModalOpen && (
        <div
          className="fixed inset-0 z-[110] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 pt-safe pb-safe"
          onClick={() => setCertModalOpen(false)}
        >
          <div
            className="relative max-w-2xl w-full max-h-[92dvh] overflow-y-auto rounded-3xl bg-zinc-950 border-2 border-amber-400 p-4 sm:p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 text-white">
              <span className="text-amber-300 font-black text-sm sm:text-base min-w-0 break-keep">
                📜 개인 및 민간 기업 PC 기본 기능 영구 무료 공식 보증서
              </span>
              <button
                type="button"
                onClick={() => setCertModalOpen(false)}
                className="w-9 h-9 shrink-0 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden bg-white">
              <img
                src="/showroom/certificates/ghosti_b2b_free_certificate.png?v=20261113v2"
                alt="귀신같이 무료 공식 보증서"
                className="w-full h-auto object-contain"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <a
                href="/showroom/certificates/ghosti_b2b_free_certificate.html"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-xl bg-amber-400 text-slate-950 font-black text-[13px]"
              >
                🖨️ 인쇄·PDF 저장용 페이지 열기 ↗
              </a>
              <button
                type="button"
                onClick={() => setCertModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-200 font-bold text-[13px] cursor-pointer"
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
