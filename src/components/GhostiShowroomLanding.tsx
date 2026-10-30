import React, { useState } from 'react';

// 특허 출원번호(10-2026-XXXXXXX) 확보 전까지 허위표시 리스크 및 출원 전 공지(신규성 상실) 방지를 위해 false 유지
export const PATENTS_FILED = false;

interface GhostiShowroomLandingProps {
  onEnterWorkspace: () => void;
}

interface ShortsItem {
  id: string;
  category: 'video' | 'doc' | 'clean';
  title: string;
  hookTime: string;
  hookLine: string;
  solutionLine: string;
  recommendedKeyword: string;
  tag: string;
  youtubeId?: string;
  thumbnailBg: string;
}

const SHORTS_DATA: ShortsItem[] = [
  // 1. 동영상 장면 1초 찾기
  {
    id: 'video-1',
    category: 'video',
    title: '동영상 속 "아기 첫 걸음마" 몇 분 몇 초에 찍었지?',
    hookTime: '00:00 ~ 00:03 (훅)',
    hookLine: '“10분짜리 가족 영상에서 아기 걸음마 장면 찾느라 타임라인 일일이 땡기셨죠?”',
    solutionLine: '『귀신같이』에 "걸음마" 세 글자만 치면 03분 12초로 1초 만에 즉시 점프!',
    recommendedKeyword: '아기 걸음마 / 촛불 끄기 / 제주 바다',
    tag: PATENTS_FILED ? '🎬 비디오 1초 타임스탬프 특허' : '🎬 비디오 1초 타임스탬프 점프',
    thumbnailBg: 'from-cyan-950 via-teal-900 to-slate-900',
  },
  {
    id: 'video-2',
    category: 'video',
    title: '“작년 제주도 여행에서 먹은 갈치조림 영상 어딨지?”',
    hookTime: '00:00 ~ 00:03 (훅)',
    hookLine: '“휴대폰에 쌓인 수백 개 동영상, 파일 이름이 전부 VID_2023... 이라 못 찾겠다면?”',
    solutionLine: 'AI가 영상 속 간판과 음성을 자동 분석해 원하는 순간만 콕 찍어 재생해 줍니다.',
    recommendedKeyword: '제주 갈치조림 / 생일파티 케이크',
    tag: '🎯 영상 속 간판·대사 인식',
    thumbnailBg: 'from-emerald-950 via-slate-900 to-teal-950',
  },
  // 2. 문서·엑셀 투시 검색
  {
    id: 'doc-1',
    category: 'doc',
    title: '“최종_진짜최종_수정3.xlsx... 파일 열지 마세요”',
    hookTime: '00:00 ~ 00:03 (훅)',
    hookLine: '“엑셀 파일 수십 개 하나씩 열어서 Ctrl+F 누르다가 컴퓨터 멈춘 적 있으시죠?”',
    solutionLine: '파일을 안 열어도 표 안의 숫자와 글자를 0.01초 만에 엑스레이처럼 투시합니다.',
    recommendedKeyword: '지체상금 0.15% / 계약금 잔금 / 소득공제',
    tag: PATENTS_FILED ? '📊 무설정 스마트 서류 투시 특허' : '📊 무설정 스마트 서류 투시 검색',
    thumbnailBg: 'from-blue-950 via-indigo-950 to-slate-900',
  },
  {
    id: 'doc-2',
    category: 'doc',
    title: '“스캔한 영수증·계약서 PDF, 글자 복사도 안 되는데?”',
    hookTime: '00:00 ~ 00:03 (훅)',
    hookLine: '“이미지로 된 서류는 검색도 안 돼서 눈 빠지게 찾고 계셨나요?”',
    solutionLine: 'OCR AI 엔진이 이미지 속 작은 글씨까지 읽어내어 파일 제목 상관없이 바로 찾습니다.',
    recommendedKeyword: '사업자등록증 / 법인인감 / 부가세 영수증',
    tag: '📄 이미지 PDF 본문 고속 색인',
    thumbnailBg: 'from-slate-950 via-blue-900 to-slate-900',
  },
  // 3. 중복 사진·용량 대청소
  {
    id: 'clean-1',
    category: 'clean',
    title: '“비슷한 연사 사진 50장... 가장 잘 나온 1장만 남기기”',
    hookTime: '00:00 ~ 00:03 (훅)',
    hookLine: '“눈 감은 사진, 흔들린 사진 지우느라 주말 반나절을 사진첩 정리에 버리셨나요?”',
    solutionLine: '클린몬스터가 눈 뜬 베스트 1장만 추천하고, 나머지는 윈도우 휴지통으로 안전하게 정리!',
    recommendedKeyword: '연사 묶음 Pick / 눈 감은 사진 정리',
    tag: '🧹 클린몬스터 연사 Pick 엔진',
    thumbnailBg: 'from-amber-950 via-teal-950 to-slate-900',
  },
  {
    id: 'clean-2',
    category: 'clean',
    title: '“방금 지운 파일 실수로 날렸다고요? 1초 타임머신 복원!”',
    hookTime: '00:00 ~ 00:03 (훅)',
    hookLine: '“다른 청소 앱들은 잘못 지우면 영구 삭제되어 복구업체에 수십만 원 줘야 합니다.”',
    solutionLine: '『귀신같이』는 윈도우 정식 휴지통($Recycle.Bin) 연동으로 1초 만에 원래 폴더로 완벽 복원!',
    recommendedKeyword: '1초 실행취소 / 휴지통 안전 타임머신',
    tag: '🛡️ Windows 정식 휴지통 직결',
    thumbnailBg: 'from-rose-950 via-slate-900 to-teal-950',
  },
];

export const GhostiShowroomLanding: React.FC<GhostiShowroomLandingProps> = ({
  onEnterWorkspace,
}) => {
  // 출시 모드 토글: 출시 전(사전 빌드업) vs 정식 출시 후(다운로드 대문)
  const [isLaunched, setIsLaunched] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'video' | 'doc' | 'clean'>('all');
  const [activeShortsModal, setActiveShortsModal] = useState<ShortsItem | null>(null);
  const [activeBannerMode, setActiveBannerMode] = useState<'after' | 'before'>('after');

  const filteredShorts = selectedCategory === 'all'
    ? SHORTS_DATA
    : SHORTS_DATA.filter((s) => s.category === selectedCategory);

  return (
    <div className="min-h-screen bg-[#070B11] text-zinc-100 font-sans selection:bg-[#00F0B5]/30 selection:text-[#00F0B5] relative overflow-x-hidden">
      {/* 백그라운드 앰비언트 글로우 */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[550px] bg-gradient-to-b from-[#00F0B5]/10 via-[#0D9488]/5 to-transparent blur-[120px] pointer-events-none -z-10" />

      {/* 1. 최상단 마스터 GNB */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#070B11]/85 border-b border-white/10 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between gap-4">
          {/* 좌측 브랜드 로고 & 권위 배지 */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <img
                src="/gwisinkachi_3d_wordmark_dark.png"
                alt="귀신같이 3D 로고"
                className="h-10 w-auto object-contain drop-shadow-[0_2px_12px_rgba(0,240,181,0.4)]"
              />
            </div>
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-[#00F0B5] text-[11px] font-bold">
              <span>★</span>
              <span>특허청 상표출원 40-2026-0229386</span>
            </div>
          </div>

          {/* 중앙 네비게이션 */}
          <nav className="hidden md:flex items-center gap-6 text-[14px] font-semibold text-zinc-300">
            <a href="#features" className="hover:text-[#00F0B5] transition-colors">핵심 기능</a>
            <a href="#shorts" className="hover:text-[#00F0B5] transition-colors">15초 영상 쇼룸</a>
            {PATENTS_FILED && (
              <a href="#patents" className="hover:text-[#00F0B5] transition-colors">6대 특허 기술</a>
            )}
            <a href="#security" className="hover:text-[#00F0B5] transition-colors">Zero-Server 보안</a>
          </nav>

          {/* 우측 액션 & 테스터 워크스페이스 진입 버튼 */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* 출시 모드 스위치 (멀린님 사전 검토용 1초 토글) */}
            <button
              type="button"
              onClick={() => setIsLaunched(!isLaunched)}
              title="출시 전(Pre-Launch) / 출시 후(Post-Launch) 대문 화면을 즉시 전환해 봅니다."
              className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-white/10 text-[11px] font-medium transition-all"
            >
              {isLaunched ? '🚀 출시 후 모드 (ON)' : '⏳ 출시 전 사전 모드 (ON)'}
            </button>

            {/* 내부 테스터 전용 워크스페이스(앱) 진입 버튼 */}
            <button
              type="button"
              onClick={onEnterWorkspace}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 text-[12.5px] font-extrabold shadow-[0_0_20px_rgba(0,240,181,0.3)] transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>🧪 내부 워크스페이스</span>
              <span className="text-[10px] opacity-70">QA</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. 메인 히어로 섹션 */}
      <section className="relative pt-12 pb-20 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-10">
          {/* 상단 인증 태그 */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[12px] sm:text-[13px] font-black mb-6">
            <span className="animate-pulse">●</span>
            <span>{PATENTS_FILED ? '대한민국 6대 특허출원' : '특허 출원 진행 중'} · 개인 평생 무료 국민앱 · Zero-Server 로컬 프라이버시</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.18] mb-6">
            더 이상 열어보지 마세요.<br />
            내 기기 속 모든 파일·대사를<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00F0B5] via-teal-300 to-amber-300 drop-shadow-[0_0_35px_rgba(0,240,181,0.35)]">
              『귀신같이』 1초 만에
            </span>
          </h1>

          <p className="text-zinc-400 text-base sm:text-lg leading-relaxed mb-8">
            수백 개 동영상 속 결정적 대사, 폴더 깊숙이 묻힌 엑셀 표와 계약서, 쌓여가는 중복 사진까지.<br className="hidden sm:inline" />
            단 1바이트도 외부 서버로 보내지 않고, 내 PC와 스마트폰 안에서 가장 안전하게 해결합니다.
          </p>

          {/* CTA 영역: 출시 전 vs 출시 후 1초 스위치 */}
          {!isLaunched ? (
            <div className="bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 border border-teal-500/30 rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
              <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-teal-300 mb-2.5">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#00F0B5] animate-ping" />
                  현재 1호 컴퓨터 301장 실물 포렌식 & 3대 코어 최종 안정화 완료
                </span>
                <span className="font-extrabold text-[#00F0B5]">87% 준비 완료</span>
              </div>
              {/* 게이지 바 */}
              <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden mb-6 p-0.5 border border-white/5">
                <div className="h-full bg-gradient-to-r from-teal-500 via-[#00F0B5] to-amber-400 rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(0,240,181,0.8)]" style={{ width: '87%' }} />
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5">
                <a
                  href="https://www.youtube.com/@gwisinkachi"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-[14.5px] shadow-[0_4px_25px_rgba(225,29,72,0.4)] flex items-center justify-center gap-2 transition-transform active:scale-95"
                >
                  <span className="text-lg">▶</span>
                  <span>공식 유튜브 구독 & 1초 오픈 알림 받기</span>
                </a>
                <a
                  href="/Merlin_Z_Core.zip"
                  download="Merlin_Z_Core.zip"
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-[#00F0B5] border border-[#00F0B5]/40 font-black text-[14.5px] shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95"
                >
                  <span>💻</span>
                  <span>Windows PC 사전 체험판 받기 (44MB)</span>
                </a>
              </div>
              <p className="mt-4 text-[12px] text-zinc-500">
                🔒 신용카드 등록 절대 없음 · 개인 평생 무료 국민앱 · 바이러스 검사 통과 및 MS 정식 코드 서명
              </p>
            </div>
          ) : (
            <div className="bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 border border-teal-500/40 rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-extrabold text-xs mb-4">
                🎉 정식 무료 배포 오픈 완료! 지금 바로 설치하세요
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3.5">
                <button
                  type="button"
                  onClick={() => alert('Google Play 스토어로 이동합니다.')}
                  className="px-6 py-3.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-white font-extrabold text-[14px] flex items-center gap-2.5 transition-all shadow-lg hover:border-teal-400"
                >
                  <span className="text-xl">📱</span>
                  <span>Google Play 다운로드</span>
                </button>
                <button
                  type="button"
                  onClick={() => alert('Apple App Store로 이동합니다.')}
                  className="px-6 py-3.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-white font-extrabold text-[14px] flex items-center gap-2.5 transition-all shadow-lg hover:border-teal-400"
                >
                  <span className="text-xl">🍎</span>
                  <span>App Store 다운로드</span>
                </button>
                <a
                  href="/Merlin_Z_Core.zip"
                  download="Merlin_Z_Core.zip"
                  className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-black text-[14.5px] flex items-center gap-2.5 transition-all shadow-[0_0_30px_rgba(0,240,181,0.4)]"
                >
                  <span className="text-xl">💻</span>
                  <span>Windows PC 정식 버전 받기</span>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* 3. Before & After 2단 인터랙티브 비주얼 쇼케이스 */}
        <div className="mt-8 max-w-5xl mx-auto rounded-3xl bg-zinc-950/80 border border-white/10 p-4 sm:p-6 shadow-2xl relative">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs sm:text-sm font-extrabold text-zinc-400 flex items-center gap-2">
              <span className="text-teal-400">⚡</span>
              <span>15초 쇼츠 Before & After 2단 반전 공식 연출</span>
            </span>
            <div className="inline-flex rounded-xl bg-zinc-900 p-1 border border-white/10">
              <button
                type="button"
                onClick={() => setActiveBannerMode('before')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeBannerMode === 'before'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                0~9초: 고통의 현실 (Before)
              </button>
              <button
                type="button"
                onClick={() => setActiveBannerMode('after')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeBannerMode === 'after'
                    ? 'bg-teal-500/20 text-[#00F0B5] border border-teal-500/40 shadow-[0_0_12px_rgba(0,240,181,0.3)]'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                10초~: 네온 민트 각성 (After)
              </button>
            </div>
          </div>

          <div className="relative rounded-2xl overflow-hidden aspect-[16/9] sm:aspect-[21/9] bg-black border border-white/10 flex items-center justify-center">
            {activeBannerMode === 'before' ? (
              <div className="w-full h-full relative group">
                <img
                  src="/gwisinkachi_hero_banner_dark_before.jpg"
                  alt="Before 배너: 불 꺼진 돋보기를 들고 눈물 흘리는 잿빛 아기귀신"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent flex flex-col justify-end p-6 sm:p-8">
                  <span className="px-2.5 py-1 rounded-md bg-rose-500/30 border border-rose-500/50 text-rose-300 font-extrabold text-xs w-max mb-2">
                    BEFORE (고통 구간)
                  </span>
                  <h3 className="text-lg sm:text-2xl font-black text-white">
                    “그 파일 분명 저장했는데... 도대체 어디로 사라진 거야?”
                  </h3>
                  <p className="text-zinc-400 text-xs sm:text-sm mt-1">
                    동영상 타임라인 넘기다 1시간, 엑셀 열다 컴퓨터 다운, 중복 사진에 저장 공간 부족 경고까지.
                  </p>
                </div>
              </div>
            ) : (
              <div className="w-full h-full relative group">
                <img
                  src="/gwisinkachi_hero_banner_neon_after.jpg"
                  alt="After 배너: 황금 돋보기 스캔 광선과 네온 민트 아기귀신"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent flex flex-col justify-end p-6 sm:p-8">
                  <span className="px-2.5 py-1 rounded-md bg-teal-500/30 border border-teal-500/50 text-[#00F0B5] font-extrabold text-xs w-max mb-2">
                    AFTER (각성 구간)
                  </span>
                  <h3 className="text-lg sm:text-2xl font-black text-white">
                    말 한마디로 1초 만에 포착! 황금 돋보기 스캔 광선으로 즉시 투시
                  </h3>
                  <p className="text-teal-200/80 text-xs sm:text-sm mt-1">
                    {PATENTS_FILED ? '대한민국 6대 특허출원 엔진 탑재.' : '100% 로컬 온디바이스 AI 엔진 탑재.'} 파일·영상·사진이 있는 그 자리에서 1초 만에 찾아냅니다.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 4. 중단 공식 쇼츠 영상관 (15초 영상 매뉴얼 쇼룸) */}
      <section id="shorts" className="py-20 px-4 sm:px-6 max-w-7xl mx-auto border-t border-white/5">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/10 text-teal-400 text-xs font-bold mb-3">
            <span>🎬</span>
            <span>15초 영상 매뉴얼 쇼룸</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black tracking-tight mb-4">
            누구나 15초만 보면 바로 따라 하는<br />
            『귀신같이』 공식 숏폼 영상관
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base">
            어렵고 긴 매뉴얼은 버리세요. 일상에서 마주치는 답답한 순간들을 15초 영상으로 통쾌하게 해결합니다.
          </p>

          {/* 3대 카테고리 필터 탭 */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-8">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-[#00F0B5] text-slate-950 shadow-[0_0_20px_rgba(0,240,181,0.4)]'
                  : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              전체 보기 ({SHORTS_DATA.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('video')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                selectedCategory === 'video'
                  ? 'bg-[#00F0B5] text-slate-950 shadow-[0_0_20px_rgba(0,240,181,0.4)]'
                  : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              🎬 동영상 장면 1초 찾기
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('doc')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                selectedCategory === 'doc'
                  ? 'bg-[#00F0B5] text-slate-950 shadow-[0_0_20px_rgba(0,240,181,0.4)]'
                  : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              📊 문서·엑셀 투시 검색
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('clean')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                selectedCategory === 'clean'
                  ? 'bg-[#00F0B5] text-slate-950 shadow-[0_0_20px_rgba(0,240,181,0.4)]'
                  : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              🧹 중복 사진·용량 대청소
            </button>
          </div>
        </div>

        {/* 쇼츠 카드 그리드 (블로그/매거진형 카드) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredShorts.map((item) => (
            <div
              key={item.id}
              onClick={() => setActiveShortsModal(item)}
              className="group rounded-2xl bg-zinc-900/60 border border-white/10 hover:border-teal-400/50 p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_15px_40px_rgba(0,240,181,0.15)] cursor-pointer flex flex-col justify-between"
            >
              <div>
                {/* 상단 썸네일 영역 */}
                <div className={`relative aspect-[9/16] max-h-56 w-full rounded-xl bg-gradient-to-br ${item.thumbnailBg} border border-white/10 mb-4 overflow-hidden flex items-center justify-center p-4 text-center`}>
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />
                  <div className="relative z-10">
                    <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md border border-white/40 flex items-center justify-center mx-auto mb-2 text-white text-xl shadow-lg group-hover:scale-110 transition-transform">
                      ▶
                    </div>
                    <span className="text-[11px] font-bold text-teal-300 bg-black/60 px-2 py-0.5 rounded-full border border-teal-500/30">
                      15초 쇼츠 재생
                    </span>
                  </div>
                  <span className="absolute top-2.5 left-2.5 text-[10px] font-extrabold text-white/80 bg-black/60 px-2 py-0.5 rounded">
                    {item.tag}
                  </span>
                </div>

                {/* 영상 정보 */}
                <h3 className="font-black text-base text-zinc-100 group-hover:text-[#00F0B5] transition-colors leading-snug mb-2">
                  {item.title}
                </h3>
                <div className="text-xs text-rose-300/90 font-medium mb-1 line-clamp-2">
                  {item.hookLine}
                </div>
                <div className="text-xs text-teal-300 font-bold mb-3 line-clamp-2">
                  👉 {item.solutionLine}
                </div>
              </div>

              {/* 추천 검색어 */}
              <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-400">
                <span className="truncate">추천: <b className="text-zinc-200">{item.recommendedKeyword}</b></span>
                <span className="text-[#00F0B5] font-extrabold shrink-0 ml-2">시청하기 ➔</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. 6대 특허출원 기술 & Zero-Server 프라이버시 (출원번호 확보 시 PATENTS_FILED = true 로 즉시 활성화) */}
      {PATENTS_FILED && (
      <section id="patents" className="py-20 px-4 sm:px-6 max-w-7xl mx-auto border-t border-white/5 bg-gradient-to-b from-transparent via-teal-950/10 to-transparent">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-300 text-xs font-bold mb-3">
            <span>🛡️</span>
            <span>원천 기술력의 증거</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black tracking-tight mb-4">
            국내 유일 대한민국 6대 특허출원 기술<br />
            클라우드가 아닌, 내 PC 안에서 다 됩니다
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base">
            대다수 AI 앱들이 사용자 파일을 외부 서버로 올려 개인정보 유출 위험이 있지만,<br />
            『귀신같이』는 100% 로컬 기기 내에서만 작동하는 프라이버시 절대 방어 설계를 채택했습니다.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              num: '01',
              title: '무설정 스마트 서류 투시 검색',
              desc: '엑셀, PDF, 워드, 한글 문서를 열지 않고도 내부 표와 단어를 0.01초 만에 엑스레이처럼 투시합니다.',
              badge: '특허 제1호',
            },
            {
              num: '02',
              title: '비디오 1초 타임스탬프 점프',
              desc: '1시간짜리 긴 영상에서도 찾고 싶은 대사나 장면이 나오는 분·초로 즉시 순간 이동하여 재생합니다.',
              badge: '특허 제2호',
            },
            {
              num: '03',
              title: '클린몬스터 연사 1장 Pick',
              desc: '비슷하게 흔들린 사진 50장 중 눈 뜬 베스트 1장만 자동으로 선별하고 나머지는 일괄 청소합니다.',
              badge: '특허 제3호',
            },
            {
              num: '04',
              title: 'Windows 휴지통 1초 타임머신 복원',
              desc: '실수로 지워도 윈도우 정식 $Recycle.Bin 원본 복원으로 언제든지 1초 만에 안전하게 되돌립니다.',
              badge: '특허 제4호',
            },
            {
              num: '05',
              title: '3초 OS 실물 포렌식 진단',
              desc: '갑자기 꺼져 날아간 오피스 임시파일(.asd)과 바탕화면 깨진 링크, 은닉 금고를 3초 만에 추적합니다.',
              badge: '특허 제5호',
            },
            {
              num: '06',
              title: 'Zero-Server 100% 로컬 보안',
              desc: '사용자의 사진, 서류, 영상은 단 1바이트도 외부 서버로 나가지 않습니다. 프라이버시 유출 0% 보장.',
              badge: '특허 제6호',
            },
          ].map((card) => (
            <div
              key={card.num}
              className="p-6 rounded-2xl bg-zinc-900/40 border border-white/10 hover:border-teal-500/40 transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-2xl font-black text-teal-400/50">{card.num}</span>
                  <span className="px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-300 text-[11px] font-extrabold border border-teal-500/20">
                    {card.badge}
                  </span>
                </div>
                <h4 className="text-lg font-black text-zinc-100 mb-2">{card.title}</h4>
                <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed">{card.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      )}

      {/* 6. 네이버 블로그 & 유튜브 공식 채널 안내 배너 */}
      <section className="py-14 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="rounded-3xl bg-gradient-to-r from-emerald-950/80 via-slate-900 to-teal-950/80 border border-teal-500/30 p-8 sm:p-10 flex flex-col lg:flex-row items-center justify-between gap-6 shadow-2xl">
          <div>
            <span className="px-3 py-1 rounded-full bg-[#00F0B5]/20 text-[#00F0B5] font-extrabold text-xs mb-3 inline-block">
              📡 공식 3대 채널 가동
            </span>
            <h3 className="text-2xl sm:text-3xl font-black mb-2">
              네이버에 <span className="text-[#00F0B5]">『귀신같이』</span>를 검색해 보세요!
            </h3>
            <p className="text-zinc-300 text-xs sm:text-sm leading-relaxed max-w-xl">
              네이버 공식 블로그 <b className="text-white">merlincode</b>와 유튜브 공식 채널을 통해 매주 새로운 15초 영상 꿀팁과 정식 출시 소식이 가장 먼저 배포됩니다.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <a
              href="https://blog.naver.com/merlincode"
              target="_blank"
              rel="noreferrer"
              className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg transition-all"
            >
              <span>📗</span>
              <span>네이버 공식 블로그 (merlincode)</span>
            </a>
            <a
              href="https://www.youtube.com/@gwisinkachi"
              target="_blank"
              rel="noreferrer"
              className="px-5 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg transition-all"
            >
              <span>▶</span>
              <span>유튜브 공식 채널</span>
            </a>
          </div>
        </div>
      </section>

      {/* 7. 최하단 마스터 푸터 */}
      <footer className="border-t border-white/10 py-12 px-4 sm:px-6 max-w-7xl mx-auto text-xs text-zinc-500">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <img
              src="/gwisinkachi_3d_wordmark_dark.png"
              alt="귀신같이 3D 로고"
              className="h-8 w-auto object-contain opacity-80"
            />
            <div>
              <p className="font-bold text-zinc-400">
                (주)썬드림스튜디오 · 멀린패밀리 생태계 제1호 플래그십 『귀신같이(Ghosti)』
              </p>
              <p className="mt-0.5">
                상표출원 제40-2026-0229386호 · {PATENTS_FILED ? '대한민국 6대 특허출원' : '특허 출원 진행 중'} · Zero-Server 프라이버시 엔진 탑재
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-zinc-400">
            <button
              type="button"
              onClick={onEnterWorkspace}
              className="hover:text-[#00F0B5] transition-colors underline font-medium cursor-pointer"
            >
              🧪 내부 워크스페이스(QA) 진입
            </button>
            <span>·</span>
            <span>© 2026 Sundreamer Studio. All rights reserved.</span>
          </div>
        </div>
      </footer>

      {/* 8. 세로형 15초 쇼츠 재생 모달 팝업 */}
      {activeShortsModal && (
        <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative w-full max-w-sm rounded-3xl bg-zinc-950 border border-teal-500/40 p-5 shadow-2xl flex flex-col justify-between max-h-[90vh] overflow-y-auto">
            {/* 닫기 버튼 */}
            <button
              type="button"
              onClick={() => setActiveShortsModal(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm font-bold z-20 cursor-pointer"
            >
              ✕
            </button>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 rounded bg-teal-500/20 text-[#00F0B5] text-[11px] font-extrabold">
                  {activeShortsModal.tag}
                </span>
                <span className="text-xs text-zinc-400">15초 영상 매뉴얼</span>
              </div>

              {/* 세로 비디오 플레이어 영역 (9:16) */}
              <div className={`relative aspect-[9/16] rounded-2xl bg-gradient-to-b ${activeShortsModal.thumbnailBg} border border-white/10 mb-4 flex flex-col items-center justify-center p-6 text-center shadow-inner`}>
                <div className="w-16 h-16 rounded-full bg-teal-400/20 border border-teal-300 flex items-center justify-center text-teal-300 text-2xl mb-4 animate-pulse">
                  ▶
                </div>
                <h4 className="text-white font-black text-lg mb-2 leading-snug">
                  {activeShortsModal.title}
                </h4>
                <div className="p-3 rounded-xl bg-black/60 border border-white/10 text-xs text-zinc-300 leading-relaxed mb-3">
                  <b className="text-rose-400 block mb-1">0~3초 도입부 훅:</b>
                  {activeShortsModal.hookLine}
                </div>
                <div className="p-3 rounded-xl bg-teal-950/80 border border-teal-500/30 text-xs text-[#00F0B5] font-bold leading-relaxed">
                  <b className="text-amber-300 block mb-1">10초~ 해결책 선언:</b>
                  {activeShortsModal.solutionLine}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <a
                href="https://www.youtube.com/@gwisinkachi"
                target="_blank"
                rel="noreferrer"
                className="w-full py-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg transition-all"
              >
                <span>▶ 유튜브 공식 채널에서 전체 쇼츠 보기</span>
              </a>
              <button
                type="button"
                onClick={() => {
                  setActiveShortsModal(null);
                  onEnterWorkspace();
                }}
                className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-teal-300 font-bold text-xs transition-colors"
              >
                🧪 이 기능 워크스페이스에서 직접 테스트해보기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
