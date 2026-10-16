import React, { useEffect, useRef } from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';

const TRIAL_DOC_HINT_CHIPS = [
  '삼성화재 자동차 보험 증권 및 특약',
  '원목 의자 단계별 조립 설명서 도면',
  '수트라하버 리조트 숙박 결제 영수증',
];

const TRIAL_VIDEO_HINT_CHIPS = [
  '한밤중 바닷가에서 불꽃 돌리는 불쇼 영상',
  '구명조끼 입고 에메랄드빛 바다에서 스노클링하는 영상',
  '보트 위에서 바다 가르며 달리는 장면',
];

export const OnboardingModal: React.FC = () => {
  const {
    showOnboarding,
    setShowOnboarding,
    onboardingRunning,
    onboardingProgress,
    startOnboardingIndexing,
    cancelOnboardingIndexing,
    photos,
    duplicateGroups,
    localDocuments,
    videoSceneItems,
    trialScanPermissions,
    setTrialScanPermission,
    runBriefingHintChip,
    setShowProModal,
  } = useSaySeeStore();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const activeTrashCount = photos.filter((p) => !p.quarantined && Boolean(p.trashCategory)).length;
  const vaultPhotoCount = photos.filter((p) => !p.quarantined && p.isVaultDocument).length;
  const totalIndexedDocs = localDocuments.length + vaultPhotoCount; // 12 + 8 = 20건

  // 네온 블루(#00E5FF) 3D 파형 / 768차원 휘발성 RAM 벡터 변환 실시간 캔버스 애니메이션
  useEffect(() => {
    if (!showOnboarding) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let phase = 0;

    const render = () => {
      phase += 0.045;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      if (
        canvas.width !== Math.floor(rect.width * dpr) ||
        canvas.height !== Math.floor(rect.height * dpr)
      ) {
        canvas.width = Math.floor(rect.width * dpr);
        canvas.height = Math.floor(rect.height * dpr);
      }
      ctx.save();
      ctx.scale(dpr, dpr);

      const W = rect.width;
      const H = rect.height;
      ctx.clearRect(0, 0, W, H);

      // 1) 배경 3D 원근 그리드
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.08)';
      ctx.lineWidth = 1;
      const horizonY = H * 0.62;
      for (let i = -6; i <= 6; i++) {
        ctx.beginPath();
        ctx.moveTo(W / 2 + i * 18, horizonY - 25);
        ctx.lineTo(W / 2 + i * 75, H);
        ctx.stroke();
      }

      // 2) 중앙: 3D 회전 시맨틱 파형 토러스
      const cx = W * 0.5;
      const cy = H * 0.42;
      for (let ring = 0; ring < 3; ring++) {
        ctx.beginPath();
        const points = 72;
        for (let p = 0; p <= points; p++) {
          const angle = (p / points) * Math.PI * 2;
          const wave =
            Math.sin(angle * 4 + phase * (1.5 + ring * 0.3)) * 10 +
            Math.cos(angle * 7 - phase * 1.2) * 5;
          const rx = (62 + ring * 20 + wave) * Math.cos(angle);
          const ry = (24 + ring * 9 + wave * 0.45) * Math.sin(angle);
          const x = cx + rx;
          const y = cy + ry;
          if (p === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle =
          ring === 0
            ? 'rgba(0, 229, 255, 0.85)'
            : ring === 1
            ? 'rgba(255, 171, 0, 0.65)'
            : 'rgba(16, 185, 129, 0.4)';
        ctx.lineWidth = ring === 0 ? 2.2 : 1.4;
        ctx.stroke();
      }

      // 3) 하단: 768차원 벡터 변환 실시간 스펙트럼 막대
      const vec = onboardingProgress.liveVector64;
      const barCount = 48;
      const totalBarWidth = W * 0.88;
      const startX = (W - totalBarWidth) / 2;
      const stepX = totalBarWidth / barCount;

      for (let i = 0; i < barCount; i++) {
        const v = vec[i % vec.length] ?? 0.5;
        const dynamic = 0.2 + 0.8 * Math.abs(Math.sin(phase * 1.8 + i * 0.28) * 0.55 + v * 0.45);
        const barH = Math.max(5, dynamic * 40);
        const x = startX + i * stepX;
        const y = H - 10 - barH;

        ctx.fillStyle = i % 3 === 0 ? '#00E5FF' : '#9CF0FF';
        ctx.beginPath();
        ctx.roundRect(x, y, Math.max(2.5, stepX - 3), barH, 3);
        ctx.fill();
      }

      ctx.restore();
      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [showOnboarding, onboardingProgress.liveVector64]);

  if (!showOnboarding) return null;

  const { percent, currentPhotoName, currentPhotoThumb } = onboardingProgress;

  return (
    <div className="fixed inset-0 z-[100] bg-surface/95 backdrop-blur-2xl flex items-center justify-center p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-3xl glass-l2 p-6 md:p-8 shadow-[0_0_64px_rgba(0,229,255,0.22)] flex flex-col gap-5 border border-primary-container/35 my-auto">
        {/* 1) 상단 헤더 & 원클릭 자동 연결(Zero-Code Pairing) 배지 */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-primary-container text-on-primary-container font-label-mono text-[11px] font-black">
                🔗 ZERO-CODE PAIRING • URL/로컬호스트 세션 토큰 자동 연결됨
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 font-label-mono text-[11px] font-bold">
                6자리 코드 수동 입력 폐기 • 300장 수동 선택 불필요
              </span>
            </div>
            <h2 className="font-headline-lg text-[21px] md:text-[24px] text-on-surface font-extrabold tracking-tight">
              🚀 초대 링크 원클릭 체험판 온보딩 &amp; 검진 구역 직접 허용
            </h2>
            <p className="font-body-sm text-[13px] text-on-surface-variant leading-relaxed">
              초대 링크 접속 시 URL/로컬호스트 세션 토큰으로 자동 페어링됩니다. 일반 사진 수백 장을 스캔하느라 시간을 쓰지 않고, 삼성 갤러리가 죽어도 못 하는{' '}
              <strong className="text-emerald-300">‘중복·연사 청소 진단’</strong> +{' '}
              <strong className="text-[#FFAB00]">‘최신 서류 20건’</strong> +{' '}
              <strong className="text-primary-container">‘최신 동영상 10개’</strong>만 1분 이내에 정밀 분석합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              cancelOnboardingIndexing();
              setShowOnboarding(false);
            }}
            className="px-3.5 py-2 rounded-full bg-surface-container-highest/80 hover:bg-surface-bright text-on-surface-variant hover:text-on-surface font-label-sm text-[12px] font-bold flex items-center gap-1 transition-colors shrink-0"
          >
            <span>브리핑 보드로</span>
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>

        {/* 2) [체험판 온보딩] 스캔 전 [검진 구역 직접 허용] 3대 안전 폴더 체크박스 + [🚀 무료 검진 & 파워검색 체험하기] 원클릭 실행 */}
        <div className="p-4 rounded-2xl bg-surface-container/90 border border-outline-variant/35 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-headline-sm text-[14.5px] text-on-surface font-extrabold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary-container text-[19px]">
                verified_user
              </span>
              <span>스캔 전 [검진 구역 직접 허용] — 기본 3대 안전 폴더만 체크된 상태로 시작합니다</span>
            </span>
            <button
              type="button"
              onClick={() => void startOnboardingIndexing()}
              className="px-4 py-1.5 rounded-full bg-gradient-to-r from-primary-container to-[#00E5FF] text-on-primary-container font-label-md text-[12.5px] font-black shadow-[0_0_20px_rgba(0,229,255,0.4)] hover:brightness-105 transition-all"
            >
              🚀 무료 검진 &amp; 파워검색 체험하기 (원클릭 자동 실행)
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <label className="p-3 rounded-xl bg-surface-container-lowest/90 border border-primary-container/40 flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={trialScanPermissions.gallery}
                onChange={(e) => setTrialScanPermission('gallery', e.target.checked)}
                className="w-4 h-4 accent-[#00E5FF] rounded"
              />
              <div className="flex flex-col">
                <span className="font-label-md text-[13px] text-on-surface font-extrabold">
                  ☑️ 사진첩 (갤러리)
                </span>
                <span className="font-body-sm text-[11px] text-on-surface-variant">
                  중복·연사 dHash 진단 &amp; 최신 동영상 10개·촬영서류 8장
                </span>
              </div>
            </label>

            <label className="p-3 rounded-xl bg-surface-container-lowest/90 border border-[#FFAB00]/40 flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={trialScanPermissions.downloads}
                onChange={(e) => setTrialScanPermission('downloads', e.target.checked)}
                className="w-4 h-4 accent-[#FFAB00] rounded"
              />
              <div className="flex flex-col">
                <span className="font-label-md text-[13px] text-on-surface font-extrabold">
                  ☑️ 다운로드 폴더
                </span>
                <span className="font-body-sm text-[11px] text-on-surface-variant">
                  영수증·바우처·청구서·건강검진 PDF 문서 역추적
                </span>
              </div>
            </label>

            <label className="p-3 rounded-xl bg-surface-container-lowest/90 border border-emerald-400/40 flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={trialScanPermissions.desktop}
                onChange={(e) => setTrialScanPermission('desktop', e.target.checked)}
                className="w-4 h-4 accent-emerald-400 rounded"
              />
              <div className="flex flex-col">
                <span className="font-label-md text-[13px] text-on-surface font-extrabold">
                  ☑️ 바탕화면 폴더
                </span>
                <span className="font-body-sm text-[11px] text-on-surface-variant">
                  보험증권·계약서·조립설명서 PDF/DOCX/TXT 역추적
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* 3) [보안 안심 UI 교정 #2] 스캔 중 [무저장 휘발성 보안 배지] */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/90 via-[#062c36]/90 to-surface-container-high border-2 border-emerald-400/70 shadow-[0_0_24px_rgba(16,185,129,0.22)] flex items-center gap-3">
          <span className="material-symbols-outlined text-emerald-300 text-[24px] shrink-0">
            shield_lock
          </span>
          <p className="font-label-md text-[12.5px] md:text-[13.5px] text-white font-extrabold leading-snug">
            [🔒 안심 보안 파이프라인 가동 중: 무거운 원본 파일 미전송 / AI 분석 서버 하드디스크 저장 0건 (RAM 연산 후 0.1초 내 즉시 자동 소각)]
          </p>
        </div>

        {/* 4) [체험판 스캔 대상 혁신] 일반 사진 제외 ➔ 3대 핵심 타겟 (중복 진단 + 서류 20건 + 동영상 10개) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* 타겟 1: 기기 자체 연산 */}
          <div className="p-4 rounded-2xl bg-surface-container-low border border-emerald-400/40 flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-label-mono text-[10px] font-black">
                기기 자체 연산 (전송 없음)
              </span>
              <span className="font-label-mono text-[11px] text-emerald-300 font-bold">완료</span>
            </div>
            <h3 className="font-headline-sm text-[15px] text-white font-extrabold">
              🧹 중복·연사(dHash) 및 흔들림 진단
            </h3>
            <p className="font-body-sm text-[12px] text-on-surface-variant leading-relaxed">
              파일명이 다른 카톡 중복 사본/연사 그룹({duplicateGroups.length}묶음)과 흔들린 사진 등 정리 대상{' '}
              <strong className="text-emerald-300">{activeTrashCount}장</strong>을 에이전트 자체에서 초고속 산출했습니다.
            </p>
          </div>

          {/* 타겟 2: 로컬 서버 Gemma 2 인덱싱 ① */}
          <div className="p-4 rounded-2xl bg-surface-container-low border border-[#FFAB00]/45 flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-full bg-[#FFAB00]/20 text-[#FFAB00] font-label-mono text-[10px] font-black">
                로컬 서버 Gemma 2 인덱싱 ①
              </span>
              <span className="font-label-mono text-[11px] text-[#FFAB00] font-bold">
                20 / 20건 완료
              </span>
            </div>
            <h3 className="font-headline-sm text-[15px] text-white font-extrabold">
              📄 최신 서류/문서 {totalIndexedDocs}건 역추적
            </h3>
            <p className="font-body-sm text-[12px] text-on-surface-variant leading-relaxed">
              오늘부터 과거로 역추적하여 다운로드·바탕화면 문서(`PDF/TXT/DOCX` {localDocuments.length}건)와 갤러리 영수증·설명서·신분증({vaultPhotoCount}장) 총{' '}
              <strong className="text-[#FFAB00]">{totalIndexedDocs}건</strong>을 색인했습니다.
            </p>
          </div>

          {/* 타겟 3: 로컬 서버 Gemma 2 인덱싱 ② */}
          <div className="p-4 rounded-2xl bg-surface-container-low border border-primary-container/50 flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-full bg-primary-container/20 text-primary-container font-label-mono text-[10px] font-black">
                로컬 서버 Gemma 2 인덱싱 ②
              </span>
              <span className="font-label-mono text-[11px] text-primary-container font-bold">
                10 / 10개 완료
              </span>
            </div>
            <h3 className="font-headline-sm text-[15px] text-white font-extrabold">
              🎬 최신 동영상 {videoSceneItems.length}개 역추적
            </h3>
            <p className="font-body-sm text-[12px] text-on-surface-variant leading-relaxed">
              수개월 전까지 역추적하여 확보한 최신 동영상 <strong className="text-primary-container">{videoSceneItems.length}개</strong>의 핵심 프레임(초경량 썸네일)만 추출해 장면 의미를 색인했습니다.
            </p>
          </div>
        </div>

        {/* 5) 실시간 휘발성 RAM 벡터 변환 비주얼라이저 */}
        <div className="relative rounded-2xl bg-surface-container-lowest/90 border border-primary-container/25 overflow-hidden h-36 flex items-center justify-center shadow-inner">
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

          <div className="relative z-10 flex items-center gap-3.5 px-4 py-2.5 rounded-2xl bg-surface-container/90 backdrop-blur-xl border border-primary-container/40 shadow-[0_0_24px_rgba(0,229,255,0.25)]">
            <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-surface-container-highest shrink-0 border border-primary-container/50">
              <img
                src={currentPhotoThumb}
                alt={currentPhotoName}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="font-label-mono text-[10.5px] text-primary-container font-bold">
                경량 썸네일/텍스트 ➔ 자체 로컬 GPU 서버 768D 벡터화 ➔ 0.1초 내 RAM 즉시 자동 소각 ({percent.toFixed(0)}%)
              </span>
              <span className="font-label-md text-[12.5px] text-on-surface font-bold truncate">
                {currentPhotoName}
              </span>
              <span className="font-label-mono text-[10px] text-emerald-300">
                분석된 파일 날짜 범위: 2024.07.11 ~ 2026.10.14 (최근 서류 20건 + 동영상 10개)
              </span>
            </div>
          </div>
        </div>

        {/* 6) 모달 내부에서 바로 눌러보는 서류 & 동영상 힌트 칩 */}
        <div className="p-4 rounded-2xl bg-surface-container-low/95 border border-outline-variant/30 flex flex-col gap-2.5">
          <span className="font-headline-sm text-[13.5px] text-white font-extrabold">
            👇 아래 힌트를 클릭하면 검색 화면으로 이동해 0.04초 만에 찾아내는 결과를 즉시 보여줍니다:
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <span className="font-label-sm text-[11px] text-[#FFAB00] font-extrabold">
                📄 [서류 내용 힌트 칩] (최근 서류 20건 중 추출)
              </span>
              {TRIAL_DOC_HINT_CHIPS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => {
                    cancelOnboardingIndexing();
                    setShowOnboarding(false);
                    void runBriefingHintChip('doc', q);
                  }}
                  className="px-3 py-2 rounded-xl bg-surface-container hover:bg-surface-bright border border-[#FFAB00]/40 text-left font-label-md text-[12.5px] text-on-surface font-bold truncate transition-all"
                >
                  📄 “{q}”
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="font-label-sm text-[11px] text-primary-container font-extrabold">
                🎬 [동영상 장면 힌트 칩] (최근 동영상 10개 중 추출)
              </span>
              {TRIAL_VIDEO_HINT_CHIPS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => {
                    cancelOnboardingIndexing();
                    setShowOnboarding(false);
                    void runBriefingHintChip('video', q);
                  }}
                  className="px-3 py-2 rounded-xl bg-surface-container hover:bg-surface-bright border border-primary-container/40 text-left font-label-md text-[12.5px] text-on-surface font-bold truncate transition-all"
                >
                  🎬 “{q}”
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 7) 하단 액션 & 전환 유도 */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={() => {
              if (onboardingRunning) cancelOnboardingIndexing();
              else void startOnboardingIndexing();
            }}
            className="px-4 py-2.5 rounded-full bg-surface-container-high hover:bg-surface-bright text-primary-container font-label-md text-[12.5px] font-extrabold border border-primary-container/40 flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[17px]">
              {onboardingRunning ? 'pause_circle' : 'replay'}
            </span>
            <span>
              {onboardingRunning ? '고속 스캔 일시정지' : '1분 고속 체험 스캔 과정 다시 시연'}
            </span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setShowOnboarding(false);
                setShowProModal(true);
              }}
              className="px-4 py-2.5 rounded-full bg-[#FFAB00] hover:bg-[#FFC400] text-surface-container-lowest font-label-md text-[12.5px] font-black shadow-[0_0_16px_rgba(255,171,0,0.4)]"
            >
              👑 나머지 10년 치 전체 연결 · 요금제 보기
            </button>
            <button
              type="button"
              onClick={() => {
                cancelOnboardingIndexing();
                setShowOnboarding(false);
              }}
              className="px-5 py-2.5 rounded-full bg-primary-container text-on-primary-container font-label-lg text-[13px] font-black shadow-[0_0_20px_rgba(0,229,255,0.4)]"
            >
              체험 완료 브리핑 보드에서 바로 검색하기 →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
