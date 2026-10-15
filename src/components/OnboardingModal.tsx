import React, { useEffect, useRef, useState } from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';

const ROLLING_TIPS = [
  {
    badge: '음성 스나이핑 팁 #1',
    text: '이런 것도 검색해 보세요: 영수증, 바닷가에서 뛰는 강아지',
    sub: '자연어 문장이나 단어를 말하면 STT 없이 음성 파형으로 즉시 매칭합니다.',
    exampleQuery: '바닷가에서 뛰노는 아이',
  },
  {
    badge: '스마트 다이어트 팁 #2',
    text: '이런 것도 검색해 보세요: 휴대폰 스크린샷, 글씨가 많은 문서',
    sub: '불필요한 캡처·영수증·흔들린 사진을 골라 [세이씨_정리대기함] 폴더로 한 번에 격리합니다.',
    exampleQuery: '휴대폰 스크린샷',
  },
  {
    badge: '감성·분위기 검색 팁 #3',
    text: '이런 것도 검색해 보세요: 생일 케이크와 촛불, 가족 단체 사진',
    sub: '날짜나 폴더명을 기억하지 못해도 사진 속 상황과 분위기만으로 0.1초 만에 찾아냅니다.',
    exampleQuery: '생일 케이크와 촛불',
  },
  {
    badge: '공간·구도 검색 팁 #4',
    text: '이런 것도 검색해 보세요: 아이 왼쪽에 있는 강아지, 자동차 안에서',
    sub: 'EmbeddingGemma 2의 768차원 멀티모달 공간이 피사체의 위치와 배경 맥락까지 이해합니다.',
    exampleQuery: '아이 왼쪽에 있는 강아지',
  },
  {
    badge: '100% Zero-Cloud 보안 #5',
    text: '이런 것도 검색해 보세요: 밤에 찍은 어두운 사진, 눈 오는 날',
    sub: '모든 딥러닝 연산은 내 기기 GPU/NPU 안에서만 수행되며 외부 서버로 절대 전송되지 않습니다.',
    exampleQuery: '밤에 찍은 어두운 사진',
  },
];

export const OnboardingModal: React.FC = () => {
  const {
    showOnboarding,
    setShowOnboarding,
    onboardingRunning,
    onboardingUseRealGpu,
    setOnboardingUseRealGpu,
    onboardingProgress,
    startOnboardingIndexing,
    cancelOnboardingIndexing,
    runTextQuery,
    conceptLexiconCount,
    onboardingAhaItems,
    cycleSentenceChips,
    applyAhaRecommendation,
  } = useSaySeeStore();

  const [tipIndex, setTipIndex] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 지침 #1: 3초마다 롤링되는 활용 팁
  useEffect(() => {
    if (!showOnboarding) return;
    const timer = window.setInterval(() => {
      setTipIndex((prev) => (prev + 1) % ROLLING_TIPS.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [showOnboarding]);

  // 지침 #1: 네온 블루(#00E5FF) 3D 오디오 파형 / 768차원 벡터 변환 실시간 캔버스 애니메이션
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

      // 1) 배경 3D 원근 그리드 (Neural Horizon)
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.08)';
      ctx.lineWidth = 1;
      const horizonY = H * 0.62;
      for (let i = -6; i <= 6; i++) {
        ctx.beginPath();
        ctx.moveTo(W / 2 + i * 18, horizonY - 25);
        ctx.lineTo(W / 2 + i * 75, H);
        ctx.stroke();
      }
      for (let r = 0; r < 5; r++) {
        const y = horizonY + Math.pow((r + ((phase * 0.4) % 1)) / 5, 1.6) * (H - horizonY);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      // 2) 좌측~중앙: 3D 회전 오디오/시맨틱 파형 토러스 (Neon Blue #00E5FF & Violet #7C4DFF)
      const cx = W * 0.5;
      const cy = H * 0.42;
      const rings = 3;
      for (let ring = 0; ring < rings; ring++) {
        ctx.beginPath();
        const points = 72;
        for (let p = 0; p <= points; p++) {
          const angle = (p / points) * Math.PI * 2;
          const wave =
            Math.sin(angle * 4 + phase * (1.5 + ring * 0.3)) * 12 +
            Math.cos(angle * 7 - phase * 1.2) * 6;
          const rx = (68 + ring * 22 + wave) * Math.cos(angle);
          const ry = (28 + ring * 10 + wave * 0.45) * Math.sin(angle);
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
            ? 'rgba(124, 77, 255, 0.65)'
            : 'rgba(0, 176, 255, 0.35)';
        ctx.lineWidth = ring === 0 ? 2.4 : 1.5;
        ctx.shadowColor = ring === 0 ? '#00E5FF' : '#7C4DFF';
        ctx.shadowBlur = ring === 0 ? 16 : 8;
        ctx.stroke();
      }

      // 3) 하단: 768차원 벡터 변환 실시간 주파수 스펙트럼 막대
      const vec = onboardingProgress.liveVector64;
      const barCount = 48;
      const totalBarWidth = W * 0.86;
      const startX = (W - totalBarWidth) / 2;
      const stepX = totalBarWidth / barCount;

      for (let i = 0; i < barCount; i++) {
        const v = vec[i % vec.length] ?? 0.5;
        const dynamic =
          0.2 + 0.8 * Math.abs(Math.sin(phase * 1.8 + i * 0.28) * 0.55 + v * 0.45);
        const barH = Math.max(6, dynamic * 46);
        const x = startX + i * stepX;
        const y = H - 14 - barH;

        const grad = ctx.createLinearGradient(x, y, x, H - 14);
        if (i % 3 === 0) {
          grad.addColorStop(0, '#00E5FF');
          grad.addColorStop(1, 'rgba(0, 229, 255, 0.15)');
        } else {
          grad.addColorStop(0, '#9CF0FF');
          grad.addColorStop(1, 'rgba(82, 3, 213, 0.25)');
        }

        ctx.fillStyle = grad;
        ctx.shadowColor = '#00E5FF';
        ctx.shadowBlur = i % 4 === 0 ? 10 : 0;
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

  const {
    done,
    total,
    remaining,
    percent,
    etaSec,
    perImageSec,
    currentPhotoName,
    currentPhotoThumb,
    modelStatusText,
  } = onboardingProgress;

  const etaMin = Math.floor(etaSec / 60);
  const etaRemSec = etaSec % 60;
  const etaText = etaMin > 0 ? `약 ${etaMin}분 ${etaRemSec}초` : `약 ${etaRemSec}초`;
  const currentTip = ROLLING_TIPS[tipIndex];

  return (
    <div className="fixed inset-0 z-[100] bg-surface/95 backdrop-blur-2xl flex items-center justify-center p-4 overflow-y-auto">
      {/* Ambient Background Glows */}
      <div className="fixed -top-24 left-1/4 w-96 h-96 rounded-full bg-primary-container/15 blur-[130px] pointer-events-none" />
      <div className="fixed -bottom-24 right-1/4 w-96 h-96 rounded-full bg-secondary-container/25 blur-[130px] pointer-events-none" />

      <div className="relative w-full max-w-3xl rounded-3xl glass-l2 p-6 md:p-8 shadow-[0_0_64px_rgba(0,229,255,0.2)] flex flex-col gap-5 border border-primary-container/30 my-auto">
        {/* Top Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-container/15 border border-primary-container/30 w-fit">
                <span className="w-2 h-2 rounded-full bg-primary-container animate-ping" />
                <span className="font-label-mono text-label-mono text-primary-container font-bold tracking-wider uppercase">
                  ON-DEVICE VISION ENGINE • ZERO-CLOUD
                </span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-secondary-container/30 border border-secondary/40 text-secondary font-label-mono text-[11px] font-bold">
                내장 개념 사전 {conceptLexiconCount}개 역방향 스캔
              </span>
            </div>
            <h2 className="font-headline-lg text-headline-lg text-on-surface font-extrabold tracking-tight mt-1">
              첫 {total}장 딥러닝 시각 벡터 색인 &amp; 로컬 문장 추천
            </h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              외부 API 없이 내 사진 속 [지명/시기 + 배경/사물 + 행동/분위기] 팩트를 로컬 문장 조합기로 이어 붙여 리얼 문장 샘플을 생성합니다.
            </p>
          </div>
          <button
            onClick={() => {
              cancelOnboardingIndexing();
              setShowOnboarding(false);
            }}
            className="px-3 py-1.5 rounded-full bg-surface-container-highest/80 hover:bg-surface-bright text-on-surface-variant hover:text-on-surface font-label-sm text-label-sm flex items-center gap-1 transition-colors shrink-0"
          >
            <span>검색 화면으로</span>
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>

        {/* Center Stage: 3D Audio Waveform / 768-Dim Vector Transformation Visualizer + Live Photo Scanner */}
        <div className="relative rounded-2xl bg-surface-container-lowest/90 border border-primary-container/25 overflow-hidden h-52 md:h-56 flex items-center justify-center shadow-inner">
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

          {/* Floating Photo-to-Vector Scanner Card in Center */}
          <div className="relative z-10 flex items-center gap-4 px-4 py-3 rounded-2xl bg-surface-container/85 backdrop-blur-xl border border-primary-container/40 shadow-[0_0_32px_rgba(0,229,255,0.28)]">
            <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-xl overflow-hidden bg-surface-container-highest shrink-0 border border-primary-container/50">
              <img
                src={currentPhotoThumb}
                alt={currentPhotoName}
                className="w-full h-full object-cover"
              />
              {/* Neon Blue Laser Scan Beam */}
              <div className="absolute inset-x-0 h-1 bg-primary-container shadow-[0_0_12px_#00E5FF] animate-scan-beam" />
            </div>

            <div className="flex flex-col gap-1 min-w-0 max-w-[230px] md:max-w-[280px]">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary-container text-[16px] animate-spin">
                  autorenew
                </span>
                <span className="font-label-mono text-[11px] text-primary-container font-bold uppercase tracking-wider">
                  PIXEL ➔ 768-DIM VECTOR
                </span>
              </div>
              <span className="font-label-md text-label-md text-on-surface font-bold truncate">
                {currentPhotoName}
              </span>
              <span className="font-label-mono text-[10px] text-on-surface-variant truncate">
                {modelStatusText}
              </span>
              <div className="flex items-center gap-2 mt-0.5 font-label-mono text-[10px] text-primary">
                <span>속도: {perImageSec}초/장</span>
                <span>•</span>
                <span>OPFS 영구 캐시 활성</span>
              </div>
            </div>
          </div>

          {/* Top-left & Top-right HUD Badges */}
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-surface-container-lowest/80 border border-outline-variant/40 font-label-mono text-[10px] text-primary-fixed-dim">
            3D ACOUSTIC &amp; VISUAL VECTOR FIELD
          </div>
          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-md bg-surface-container-lowest/80 border border-primary-container/30 font-label-mono text-[10px] text-primary-container font-bold">
            DIM: 768 • INT4 QUANTIZED
          </div>
        </div>

        {/* Progress Counter & Remaining Photos Metrics */}
        <div className="flex flex-col gap-2.5 p-4 rounded-2xl bg-surface-container/80 border border-outline-variant/30">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="flex items-baseline gap-2.5">
              <span className="font-headline-xl text-headline-xl text-primary-container font-extrabold tracking-tight drop-shadow-[0_0_12px_rgba(0,229,255,0.45)]">
                {percent.toFixed(1)}%
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
                ({done} / {total}장 완료)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="px-3 py-1.5 rounded-xl bg-primary-container/15 border border-primary-container/40 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary-container text-[16px]">
                  photo_library
                </span>
                <span className="font-label-mono text-label-md text-primary font-bold">
                  남은 장수: {remaining}장
                </span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-surface-container-highest flex items-center gap-1.5">
                <span className="material-symbols-outlined text-secondary text-[16px]">
                  schedule
                </span>
                <span className="font-label-mono text-label-md text-on-surface font-semibold">
                  남은 시간: {etaText}
                </span>
              </div>
            </div>
          </div>

          {/* Neon Blue Glowing Progress Track */}
          <div className="w-full h-3 rounded-full bg-surface-container-lowest overflow-hidden p-0.5 border border-outline-variant/30">
            <div
              className="h-full rounded-full bg-gradient-to-r from-secondary-container via-primary-fixed-dim to-primary-container transition-all duration-300 shadow-[0_0_16px_#00E5FF]"
              style={{ width: `${Math.min(100, Math.max(2, percent))}%` }}
            />
          </div>
        </div>

        {/* ─────────────── 100% 로컬 사진 팩트 조합 리얼 문장 샘플 ─────────────── */}
        <div className="p-4 rounded-2xl bg-surface-container-low/95 border border-primary-container/35 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-primary-container text-on-primary font-label-mono text-[10px] font-black">
                100% LOCAL FACT COMBINER
              </span>
              <span className="font-headline-sm text-[14px] text-on-surface font-extrabold">
                내 사진첩 실제 팩트 기반 리얼 문장 샘플
              </span>
            </div>
            <button
              onClick={() => cycleSentenceChips()}
              className="px-2.5 py-1 rounded-lg bg-surface-container-highest hover:bg-surface-bright text-primary font-label-mono text-[11px] font-bold flex items-center gap-1 transition-all"
            >
              <span className="material-symbols-outlined text-[14px]">refresh</span>
              <span>다른 문장 샘플 보기</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {onboardingAhaItems.slice(0, 4).map((item) => (
              <button
                key={item.photoId}
                onClick={() => {
                  cancelOnboardingIndexing();
                  void applyAhaRecommendation(item);
                }}
                className="group flex items-center gap-3 p-2.5 rounded-xl bg-surface-container/90 hover:bg-surface-container-high border border-outline-variant/30 hover:border-primary-container/60 text-left transition-all"
              >
                <img
                  src={item.thumbUrl}
                  alt=""
                  className="w-12 h-12 rounded-lg object-cover shrink-0 border border-primary-container/30"
                />
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-label-mono text-[10px] text-primary-container font-bold">
                      {item.shortChip}
                    </span>
                    <span className="font-label-mono text-[10px] text-outline">
                      • {item.dateFact}
                    </span>
                  </div>
                  <p className="font-body-sm text-[12px] text-on-surface font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                    “{item.sentence}”
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 3초 롤링 활용 팁 배너 */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-nocturne-deep/90 via-surface-container-high/90 to-surface-container p-3.5 border border-primary-container/30 shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-primary-container/20 border border-primary-container/40 flex items-center justify-center shrink-0 text-primary-container">
                <span className="material-symbols-outlined text-[20px]">tips_and_updates</span>
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-primary-container/20 text-primary-container font-label-mono text-[10px] font-bold">
                    {currentTip.badge}
                  </span>
                  <span className="font-label-mono text-[10px] text-outline">3초 자동 롤링</span>
                </div>
                <p className="font-headline-sm text-[14px] text-on-surface font-bold tracking-tight">
                  “{currentTip.text}”
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                cancelOnboardingIndexing();
                setShowOnboarding(false);
                void runTextQuery(currentTip.exampleQuery);
              }}
              className="shrink-0 px-3 py-1.5 rounded-full bg-primary-container/20 hover:bg-primary-container text-primary-container hover:text-on-primary font-label-sm text-label-sm font-bold transition-all"
            >
              즉시 시험
            </button>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (onboardingRunning) cancelOnboardingIndexing();
                else void startOnboardingIndexing();
              }}
              className={`px-4 py-2.5 rounded-full font-label-lg text-label-lg font-bold flex items-center gap-2 transition-all ${
                onboardingRunning
                  ? 'bg-error-container text-on-error-container'
                  : 'bg-primary-container text-on-primary-container shadow-[0_0_20px_rgba(0,229,255,0.4)] hover:scale-[1.02]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {onboardingRunning ? 'pause_circle' : 'play_circle'}
              </span>
              <span>
                {onboardingRunning ? '인덱싱 일시정지' : '300장 인덱싱 애니메이션 시연 시작'}
              </span>
            </button>

            <label className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onboardingUseRealGpu}
                onChange={(e) => setOnboardingUseRealGpu(e.target.checked)}
                className="accent-[#00E5FF] rounded"
              />
              <span>실제 WebGPU 추론(2.66s/장)</span>
            </label>
          </div>

          <button
            onClick={() => {
              cancelOnboardingIndexing();
              setShowOnboarding(false);
            }}
            className="px-5 py-2.5 rounded-full bg-surface-container-highest hover:bg-surface-bright text-primary font-label-lg text-label-lg font-bold border border-primary-container/30 transition-all"
          >
            550장 실측 인덱스 완료 상태로 바로 시작 →
          </button>
        </div>
      </div>
    </div>
  );
};
