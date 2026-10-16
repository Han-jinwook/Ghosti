import React, { useEffect, useRef } from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';

const TRIAL_DOC_HINT_CHIPS = [
  '삼성화재 자동차 보험 증권 및 특약',
  '원목 의자 단계별 조립 설명서 도면',
  '수트라하버 리조트 숙박 결제 영수증',
];

const TRIAL_VIDEO_HINT_CHIPS = [
  '구명조끼 입고 무지개 낙하산 패러세일링 후 보트 갑판 착지',
  '야자수 리조트 소파에서 손가락 브이 포즈 취하다가 하트 목걸이 클로즈업',
  '새벽 비행기 창문 너머 구름 위 일출을 스마트폰 카메라로 찍는 장면',
];

/**
 * 실시간 QR 코드 SVG (내 PC 에이전트 ↔ 스마트폰 1MB 앱 Zero-Code 동시 페어링용)
 */
const PairingQrCodeSvg: React.FC = () => {
  // 15x15 고정밀 QR 매트릭스 패턴
  const matrix = [
    [1,1,1,1,1,1,1,0,1,0,1,1,1,1,1],
    [1,0,0,0,0,0,1,0,0,1,1,0,0,0,1],
    [1,0,1,1,1,0,1,0,1,0,1,0,1,0,1],
    [1,0,1,1,1,0,1,0,1,1,0,0,1,0,1],
    [1,0,1,1,1,0,1,0,0,1,1,0,1,0,1],
    [1,0,0,0,0,0,1,0,1,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,0,1,0,1,0,1,1,1],
    [0,0,0,0,0,0,0,0,1,1,0,1,0,0,0],
    [1,0,1,1,0,1,1,1,0,0,1,1,0,1,1],
    [0,1,1,0,1,0,0,1,1,0,1,0,1,0,1],
    [1,1,1,1,1,1,1,0,1,1,1,0,1,1,0],
    [1,0,0,0,0,0,1,0,0,0,1,1,0,0,1],
    [1,0,1,1,1,0,1,0,1,1,0,1,1,1,0],
    [1,0,0,0,0,0,1,0,1,0,0,0,1,0,1],
    [1,1,1,1,1,1,1,0,1,1,0,1,1,1,1],
  ];
  return (
    <svg
      viewBox="0 0 17 17"
      className="w-28 h-28 md:w-32 md:h-32 rounded-xl bg-white p-1.5 shadow-[0_0_24px_rgba(0,229,255,0.35)] shrink-0"
      aria-label="스마트폰 즉시 연결 QR 코드"
    >
      {matrix.map((row, rIdx) =>
        row.map((cell, cIdx) =>
          cell ? (
            <rect
              key={`${rIdx}-${cIdx}`}
              x={cIdx + 1}
              y={rIdx + 1}
              width={0.92}
              height={0.92}
              rx={0.15}
              fill="#071318"
            />
          ) : null
        )
      )}
    </svg>
  );
};

export const OnboardingModal: React.FC = () => {
  const {
    showOnboarding,
    setShowOnboarding,
    onboardingRunning,
    onboardingProgress,
    onboardingTrackMode,
    setOnboardingTrackMode,
    pcAgentPairedMobile,
    setPcAgentPairedMobile,
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
  const totalDissectedTimelineSegments = videoSceneItems.reduce(
    (acc, v) => acc + v.timelineFrames.length,
    0
  );

  // 네온 블루(#00E5FF) 3D 파형 / 768차원 벡터 변환 실시간 캔버스 애니메이션
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
      <div className="relative w-full max-w-5xl rounded-3xl glass-l2 p-5 md:p-7 shadow-[0_0_64px_rgba(0,229,255,0.22)] flex flex-col gap-4 border border-primary-container/35 my-auto">
        {/* 1) 상단 헤더 & 원클릭 자동 연결(Zero-Code Pairing) 배지 */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/60 text-emerald-300 font-label-mono text-[11px] font-black">
                💻 내 PC 우선 구동 (외부 서버 전송 0%) + 📱 실시간 QR 코드 모바일 동시 페어링
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-primary-container/20 border border-primary-container/50 text-primary-container font-label-mono text-[11px] font-bold">
                🎬 최신 동영상 3개 전 구간(00:00~끝) 1초 단위 완전 해부
              </span>
            </div>
            <h2 className="font-headline-lg text-[20px] md:text-[23px] text-on-surface font-extrabold tracking-tight">
              🚀 안심 체험판 온보딩 — 내 PC 직접 구동(권장) &amp; 모바일 QR 즉시 페어링
            </h2>
            <p className="font-body-sm text-[12.5px] text-on-surface-variant leading-relaxed">
              집이나 사무실 PC 앞이라면 파일이 외부로 단 1바이트도 나가지 않는{' '}
              <strong className="text-emerald-300">‘내 PC 직접 구동(Track A)’</strong>을 기본 코스로 강력 추천하며, 밖에서 스마트폰만 들고 계실 때만{' '}
              <strong className="text-primary-container">‘세이씨 초고속 GPU 서버 무료 대여(Track B)’</strong>를 지원합니다.
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

        {/* 2) [온보딩 프레임 대전환] Track A (내 PC 직접 구동 + QR 모바일 연결) vs Track B (모바일 단독 시 클라우드 서버 무료 대여) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
          {/* Track A: 내 PC/노트북 앞일 때 — 강력 추천 (외부 서버 전송 0%) + 실시간 QR 코드 모바일 동시 페어링 */}
          <div
            onClick={() => setOnboardingTrackMode('pc_local')}
            className={`lg:col-span-8 p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-3 ${
              onboardingTrackMode === 'pc_local'
                ? 'bg-gradient-to-br from-emerald-950/60 via-surface-container to-surface-container-high border-emerald-400 shadow-[0_0_28px_rgba(16,185,129,0.22)]'
                : 'bg-surface-container-low/80 border-outline-variant/35 hover:border-emerald-400/50'
            }`}
          >
            <div className="flex flex-col md:flex-row items-start justify-between gap-4">
              {/* 좌측: 내 PC 직접 구동 설명 & 실행 버튼 */}
              <div className="flex-1 flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-400 text-surface-container-lowest font-label-mono text-[10.5px] font-black">
                    Track A • 강력 추천 (외부 서버 전송 0%)
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-label-mono text-[10px] font-bold">
                    MS EV 코드사이닝 인증서 서명 완료
                  </span>
                </div>

                <h3 className="font-headline-sm text-[15.5px] md:text-[16.5px] text-white font-extrabold">
                  💻 PC/노트북 앞일 때 — 내 PC로 1분 안심 체험하기 (권장)
                </h3>

                <p className="font-body-sm text-[12px] text-on-surface-variant leading-relaxed">
                  비로그인 상태라도 아래 버튼을 누르면 MS EV 코드사이닝 인증서가 서명된{' '}
                  <code className="text-emerald-300 font-bold">SaySee_PC_Agent.exe</code>가 실행되어, 내 사진·서류·동영상이{' '}
                  <strong className="text-white">외부로 단 1바이트도 나가지 않고 100% 내 PC 내부에서만</strong> 초고속 분석됩니다.
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOnboardingTrackMode('pc_local');
                      void startOnboardingIndexing();
                    }}
                    className="px-4 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-surface-container-lowest font-label-md text-[12.5px] font-black shadow-[0_0_20px_rgba(16,185,129,0.4)] flex items-center gap-1.5 transition-all"
                  >
                    <span className="material-symbols-outlined text-[18px]">computer</span>
                    <span>💻 내 PC로 1분 안심 체험하기 (권장)</span>
                  </button>
                  <span className="px-2.5 py-1 rounded-lg bg-surface-container-lowest/90 border border-emerald-400/35 font-label-mono text-[10.5px] text-emerald-300 font-bold">
                    ✓ SaySee_PC_Agent.exe 가동 중 (0 Byte 외부 전송)
                  </span>
                </div>
              </div>

              {/* 우측: 실시간 QR 코드 모바일 동시 페어링 UI */}
              <div className="w-full md:w-64 p-3 rounded-2xl bg-surface-container-lowest/95 border border-primary-container/45 flex flex-col items-center text-center gap-2 shrink-0">
                <div className="flex items-center justify-between w-full">
                  <span className="font-label-mono text-[10px] text-primary-container font-black">
                    📱 실시간 QR 모바일 동시 페어링
                  </span>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setPcAgentPairedMobile(!pcAgentPairedMobile);
                    }}
                    className={`px-2 py-0.5 rounded-full font-label-mono text-[9.5px] font-bold cursor-pointer ${
                      pcAgentPairedMobile
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                        : 'bg-surface-container-high text-on-surface-variant'
                    }`}
                  >
                    {pcAgentPairedMobile ? '● 내 폰 연결됨' : '○ 스캔 대기 중'}
                  </span>
                </div>

                <PairingQrCodeSvg />

                <p className="font-body-sm text-[11px] text-white font-semibold leading-snug">
                  “스마트폰 카메라로 이 QR을 스캔해 <strong className="text-primary-container">1MB 앱</strong>을 실행하면, 번거로운 로그인이나 6자리 코드 입력 없이{' '}
                  <strong className="text-emerald-300">내 폰과 PC가 그 자리에서 하나로 연결</strong>됩니다!”
                </p>
              </div>
            </div>
          </div>

          {/* Track B: 밖에서 스마트폰만 들고 있을 때 — 세이씨 초고속 GPU 서버 무료 대여 */}
          <div
            onClick={() => setOnboardingTrackMode('cloud_rental')}
            className={`lg:col-span-4 p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
              onboardingTrackMode === 'cloud_rental'
                ? 'bg-gradient-to-br from-[#062c36]/90 via-surface-container to-surface-container-high border-primary-container shadow-[0_0_28px_rgba(0,229,255,0.25)]'
                : 'bg-surface-container-low/80 border-outline-variant/35 hover:border-primary-container/50'
            }`}
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-primary-container/20 border border-primary-container/50 text-primary-container font-label-mono text-[10.5px] font-black">
                  Track B • 모바일 단독 외출 시
                </span>
                <span className="font-label-mono text-[10px] text-emerald-300 font-bold">
                  0.1초 연산 후 RAM 소각
                </span>
              </div>

              <h3 className="font-headline-sm text-[15px] text-white font-extrabold">
                📱 밖에서 스마트폰만 들고 있을 때 — 세이씨 초고속 GPU 서버 무료 대여
              </h3>

              <p className="font-body-sm text-[11.5px] text-on-surface-variant leading-relaxed">
                “현재 PC 앞이 아니신가요? 스마트폰 발열과 배터리 소모를 막기 위해{' '}
                <strong className="text-primary-container">세이씨의 초고속 클라우드 PC(GPU 서버)를 잠시 무료로 빌려드립니다!</strong>{' '}
                (무거운 원본 미전송 / 서버 RAM에서 0.1초 연산 후 즉시 자동 소각되므로 안심하셔도 됩니다)”
              </p>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOnboardingTrackMode('cloud_rental');
                void startOnboardingIndexing();
              }}
              className="w-full px-3.5 py-2.5 rounded-xl bg-primary-container/20 hover:bg-primary-container/30 border border-primary-container/60 text-primary-container font-label-md text-[12px] font-black flex items-center justify-center gap-1.5 transition-all"
            >
              <span className="material-symbols-outlined text-[17px]">smartphone</span>
              <span>📱 모바일 단독: 초고속 GPU 서버 무료 대여로 체험</span>
            </button>
          </div>
        </div>

        {/* 3) 스캔 전 [검진 구역 직접 허용] 3대 안전 폴더 체크박스 */}
        <div className="p-3.5 rounded-2xl bg-surface-container/90 border border-outline-variant/35 flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-headline-sm text-[13.5px] text-on-surface font-extrabold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary-container text-[18px]">
                verified_user
              </span>
              <span>스캔 전 [검진 구역 직접 허용] — 사용자가 허용한 기본 3대 안전 폴더만 정밀 진단합니다</span>
            </span>
            <span className="font-label-mono text-[11px] text-emerald-300 font-bold">
              {onboardingTrackMode === 'pc_local'
                ? '🔒 현재 모드: Track A 내 PC 직접 구동 (외부 서버 전송 0%)'
                : '⚡ 현재 모드: Track B 세이씨 GPU 서버 무료 대여 (원본 미전송 · 0.1초 RAM 즉시 소각)'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <label className="p-2.5 rounded-xl bg-surface-container-lowest/90 border border-primary-container/40 flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={trialScanPermissions.gallery}
                onChange={(e) => setTrialScanPermission('gallery', e.target.checked)}
                className="w-4 h-4 accent-[#00E5FF] rounded"
              />
              <div className="flex flex-col">
                <span className="font-label-md text-[12.5px] text-on-surface font-extrabold">
                  ☑️ 사진첩 (갤러리)
                </span>
                <span className="font-body-sm text-[10.5px] text-on-surface-variant">
                  중복·연사 진단 &amp; 최신 동영상 3개 전 구간 해부·촬영서류 8장
                </span>
              </div>
            </label>

            <label className="p-2.5 rounded-xl bg-surface-container-lowest/90 border border-[#FFAB00]/40 flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={trialScanPermissions.downloads}
                onChange={(e) => setTrialScanPermission('downloads', e.target.checked)}
                className="w-4 h-4 accent-[#FFAB00] rounded"
              />
              <div className="flex flex-col">
                <span className="font-label-md text-[12.5px] text-on-surface font-extrabold">
                  ☑️ 다운로드 폴더
                </span>
                <span className="font-body-sm text-[10.5px] text-on-surface-variant">
                  영수증·바우처·청구서·건강검진 PDF 문서 역추적
                </span>
              </div>
            </label>

            <label className="p-2.5 rounded-xl bg-surface-container-lowest/90 border border-emerald-400/40 flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={trialScanPermissions.desktop}
                onChange={(e) => setTrialScanPermission('desktop', e.target.checked)}
                className="w-4 h-4 accent-emerald-400 rounded"
              />
              <div className="flex flex-col">
                <span className="font-label-md text-[12.5px] text-on-surface font-extrabold">
                  ☑️ 바탕화면 폴더
                </span>
                <span className="font-body-sm text-[10.5px] text-on-surface-variant">
                  보험증권·계약서·조립설명서 PDF/DOCX/TXT 역추적
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* 4) [체험판 스캔 대상 혁신] 중복 진단 + 최신 서류 20건 + 최신 동영상 딱 3개 전 구간(Full-Timeline) 완전 해부 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* 타겟 1: 중복·연사(dHash) 및 흔들림 진단 */}
          <div className="p-3.5 rounded-2xl bg-surface-container-low border border-emerald-400/40 flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-label-mono text-[10px] font-black">
                기기 자체 연산 (전송 없음)
              </span>
              <span className="font-label-mono text-[11px] text-emerald-300 font-bold">완료</span>
            </div>
            <h3 className="font-headline-sm text-[14.5px] text-white font-extrabold">
              🧹 중복·연사(dHash) 및 흔들림 진단
            </h3>
            <p className="font-body-sm text-[11.5px] text-on-surface-variant leading-relaxed">
              파일명이 다른 카톡 중복 사본/연사 그룹({duplicateGroups.length}묶음)과 흔들린 사진 등 정리 대상{' '}
              <strong className="text-emerald-300">{activeTrashCount}장</strong>을 에이전트 자체에서 초고속 산출했습니다.
            </p>
          </div>

          {/* 타겟 2: 최신 서류/문서 20건 역추적 */}
          <div className="p-3.5 rounded-2xl bg-surface-container-low border border-[#FFAB00]/45 flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-full bg-[#FFAB00]/20 text-[#FFAB00] font-label-mono text-[10px] font-black">
                Gemma 2 정밀 인덱싱 ①
              </span>
              <span className="font-label-mono text-[11px] text-[#FFAB00] font-bold">
                20 / 20건 완료
              </span>
            </div>
            <h3 className="font-headline-sm text-[14.5px] text-white font-extrabold">
              📄 최신 서류/문서 {totalIndexedDocs}건 역추적
            </h3>
            <p className="font-body-sm text-[11.5px] text-on-surface-variant leading-relaxed">
              다운로드·바탕화면 문서(`PDF/TXT/DOCX` {localDocuments.length}건)와 갤러리 영수증·설명서·신분증({vaultPhotoCount}장) 총{' '}
              <strong className="text-[#FFAB00]">{totalIndexedDocs}건</strong>의 본문과 표/도면을 색인했습니다.
            </p>
          </div>

          {/* 타겟 3: 최신 동영상 딱 3개 선정 후 00:00부터 끝까지 전 구간(Full-Timeline) 완전 해부 */}
          <div className="p-3.5 rounded-2xl bg-surface-container-low border-2 border-primary-container/60 flex flex-col justify-between gap-2 shadow-[0_0_20px_rgba(0,229,255,0.12)]">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-full bg-primary-container/20 text-primary-container font-label-mono text-[10px] font-black">
                Full-Timeline 완전 해부 ②
              </span>
              <span className="font-label-mono text-[11px] text-primary-container font-bold">
                3개 영상 · 총 {totalDissectedTimelineSegments}구간 완료
              </span>
            </div>
            <h3 className="font-headline-sm text-[14.5px] text-white font-extrabold">
              🎬 최신 동영상 {videoSceneItems.length}개 전 구간(00:00~끝) 해부
            </h3>
            <p className="font-body-sm text-[11.5px] text-on-surface-variant leading-relaxed">
              10개 수박 겉핥기 대신 최신 동영상 <strong className="text-primary-container">딱 3개</strong>를 선정해 처음(00:00)부터 끝까지{' '}
              <strong className="text-emerald-300">1~3초 단위로 촘촘하게 총 {totalDissectedTimelineSegments}개 구간</strong>을 100% 완전 해부했습니다!
            </p>
          </div>
        </div>

        {/* 5) 실시간 벡터 변환 비주얼라이저 + 해부된 동영상 3개 미니 요약 */}
        <div className="relative rounded-2xl bg-surface-container-lowest/90 border border-primary-container/25 overflow-hidden h-32 flex items-center justify-center shadow-inner">
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

          <div className="relative z-10 flex items-center gap-3.5 px-4 py-2 rounded-2xl bg-surface-container/90 backdrop-blur-xl border border-primary-container/40 shadow-[0_0_24px_rgba(0,229,255,0.25)]">
            <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-surface-container-highest shrink-0 border border-primary-container/50">
              <img
                src={currentPhotoThumb}
                alt={currentPhotoName}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="font-label-mono text-[10.5px] text-primary-container font-bold">
                {onboardingTrackMode === 'pc_local'
                  ? `내 PC 직접 구동(SaySee_PC_Agent.exe) 768D 벡터 변환 중 (${percent.toFixed(0)}%) • 외부 전송 0 Byte`
                  : `세이씨 초고속 GPU 서버 768D 벡터화 ➔ 0.1초 내 RAM 즉시 자동 소각 (${percent.toFixed(0)}%)`}
              </span>
              <span className="font-label-md text-[12px] text-on-surface font-bold truncate">
                {currentPhotoName}
              </span>
              <span className="font-label-mono text-[10px] text-emerald-300">
                최신 서류 20건 + 동영상 3개(패러세일링 7구간 · 야자수 리조트 7구간 · 기내 일출 6구간 = 총 20구간) 해부 완료
              </span>
            </div>
          </div>
        </div>

        {/* 6) 모달 내부에서 바로 눌러보는 서류 & 동영상 전 구간 힌트 칩 */}
        <div className="p-3.5 rounded-2xl bg-surface-container-low/95 border border-outline-variant/30 flex flex-col gap-2">
          <span className="font-headline-sm text-[13px] text-white font-extrabold">
            👇 아래 추천 힌트를 클릭하거나, 브리핑 보드에서 영상 3개 속 어떤 사물·행동이든 자유 검색해 보세요:
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
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
                  className="px-3 py-1.5 rounded-xl bg-surface-container hover:bg-surface-bright border border-[#FFAB00]/40 text-left font-label-md text-[12px] text-on-surface font-bold truncate transition-all"
                >
                  📄 “{q}”
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-1">
              <span className="font-label-sm text-[11px] text-primary-container font-extrabold">
                🎬 [동영상 3개 전 구간 해부 힌트 칩] (클릭 시 해당 초(Sec) 구간 포착)
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
                  className="px-3 py-1.5 rounded-xl bg-surface-container hover:bg-surface-bright border border-primary-container/40 text-left font-label-md text-[12px] text-on-surface font-bold truncate transition-all"
                >
                  🎬 “{q}”
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 7) 하단 액션 & 전환 유도 */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-0.5">
          <button
            type="button"
            onClick={() => {
              if (onboardingRunning) cancelOnboardingIndexing();
              else void startOnboardingIndexing();
            }}
            className="px-4 py-2 rounded-full bg-surface-container-high hover:bg-surface-bright text-primary-container font-label-md text-[12px] font-extrabold border border-primary-container/40 flex items-center gap-1.5"
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
              className="px-4 py-2 rounded-full bg-[#FFAB00] hover:bg-[#FFC400] text-surface-container-lowest font-label-md text-[12px] font-black shadow-[0_0_16px_rgba(255,171,0,0.4)]"
            >
              👑 나머지 10년 치 전체 연결 · 요금제 보기
            </button>
            <button
              type="button"
              onClick={() => {
                cancelOnboardingIndexing();
                setShowOnboarding(false);
              }}
              className="px-5 py-2 rounded-full bg-primary-container text-on-primary-container font-label-lg text-[12.5px] font-black shadow-[0_0_20px_rgba(0,229,255,0.4)]"
            >
              체험 완료 브리핑 보드에서 자유 검색하기 →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
