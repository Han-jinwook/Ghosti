import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';
import type { FaceMemberCluster, YearlyFaceBestCut } from '../types/saysee';

/**
 * 실제 원본 이미지에서 검출된 얼굴 Bounding Box [ymin, xmin, ymax, xmax] (0..1000) 좌표를
 * 브라우저 HTML5 <canvas>로 직접 오려내어 원형 아바타로 렌더링하는 자율 캔버스 크롭 컴포넌트
 */
export const AutonomousCanvasFaceAvatar: React.FC<{
  photoFile: string;
  boundingBox: [number, number, number, number];
  fallbackAvatarUrl: string;
  altText: string;
  isHighlighted?: boolean;
  sizeClass?: string;
}> = ({
  photoFile,
  boundingBox,
  fallbackAvatarUrl,
  altText,
  isHighlighted = false,
  sizeClass = 'w-12 h-12',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setCanvasReady(false);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled || !canvasRef.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const imgW = img.naturalWidth || 1000;
      const imgH = img.naturalHeight || 1000;
      const [ymin, xmin, ymax, xmax] = boundingBox ?? [200, 200, 600, 600];

      const faceTop = (ymin / 1000) * imgH;
      const faceLeft = (xmin / 1000) * imgW;
      const faceH = Math.max(24, ((ymax - ymin) / 1000) * imgH);
      const faceW = Math.max(24, ((xmax - xmin) / 1000) * imgW);
      const cx = faceLeft + faceW / 2;
      const cy = faceTop + faceH / 2;
      const side = Math.min(Math.min(imgW, imgH), Math.max(faceW, faceH) * 1.48);

      const sx = Math.max(0, Math.min(imgW - side, Math.round(cx - side / 2)));
      const sy = Math.max(0, Math.min(imgH - side, Math.round(cy - side / 2)));
      const sw = Math.max(16, Math.min(imgW - sx, Math.round(side)));
      const sh = Math.max(16, Math.min(imgH - sy, Math.round(side)));

      canvas.width = 180;
      canvas.height = 180;
      ctx.clearRect(0, 0, 180, 180);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 180, 180);
      setCanvasReady(true);
    };
    img.src = `/__photos/file?p=${encodeURIComponent(photoFile)}`;
    return () => {
      cancelled = true;
    };
  }, [photoFile, boundingBox]);

  return (
    <div
      className={`relative ${sizeClass} rounded-full overflow-hidden bg-zinc-900 border-2 ${
        isHighlighted
          ? 'border-primary-container shadow-[0_0_12px_rgba(32,247,219,0.28)]'
          : 'border-white/20'
      } shrink-0`}
    >
      <img src={fallbackAvatarUrl} alt={altText} className="w-full h-full object-cover" />
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${
          canvasReady ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
};

function getClusterYearlyCuts(cluster: FaceMemberCluster): YearlyFaceBestCut[] {
  if (Array.isArray(cluster.yearlyBestCuts) && cluster.yearlyBestCuts.length > 0) {
    return cluster.yearlyBestCuts;
  }
  return [
    {
      year: cluster.representativeYear,
      representativePhoto: cluster.representativePhoto,
      representativeDate: cluster.representativeDate,
      frontalScore: cluster.frontalScore,
      opticalSharpness: cluster.opticalSharpness,
      avatarUrl: cluster.avatarUrl,
      cropUrl: cluster.cropUrl,
      boundingBox: cluster.boundingBox,
    },
  ];
}

/**
 * [Step 1 인라인 바] 전체 갤러리(사진) 모드에서 방장이 얼굴에 실명을 붙이고
 * 당해 연도(2026년) 베스트 컷 뒤쪽에 과거 연도(2024년 등) 베스트 컷이 차곡차곡 쌓이는 아바타 스택을 확인하며
 * 즉시 "[이름] 나무 다리", "[이름] 선글라스" 실명 사진 검색을 체험하는 컴포넌트
 */
export const FaceMemberInlineBar: React.FC<{
  onRunRealNameQuery: (query: string, targetSpace?: 'gallery' | 'video') => void;
}> = ({ onRunRealNameQuery }) => {
  const {
    faceClusters,
    latestCorpusYear,
    registerFaceMember,
    excludeFaceCluster,
    restoreExcludedFaceClusters,
    setShowFaceRegistryModal,
  } = useSaySeeStore();

  const [isExpanded, setIsExpanded] = useState(true);
  const [draftNames, setDraftNames] = useState<Record<string, string>>({});
  const [selectedYearMap, setSelectedYearMap] = useState<Record<string, number>>({});
  const [justSavedId, setJustSavedId] = useState<string | null>(null);

  const visibleClusters = useMemo(
    () => faceClusters.filter((c) => !c.excludedAsPasserby),
    [faceClusters]
  );
  const excludedCount = faceClusters.length - visibleClusters.length;
  const registeredClusters = useMemo(
    () => visibleClusters.filter((c) => c.registeredName.trim().length > 0),
    [visibleClusters]
  );

  useEffect(() => {
    const map: Record<string, string> = {};
    for (const c of faceClusters) {
      map[c.clusterId] = c.registeredName || '';
    }
    setDraftNames(map);
  }, [faceClusters]);

  if (faceClusters.length === 0) return null;

  const handleSaveMember = async (cluster: FaceMemberCluster, nextName?: string) => {
    const finalName = (nextName !== undefined ? nextName : draftNames[cluster.clusterId] ?? '').trim();
    await registerFaceMember(cluster.clusterId, finalName, '');
    setJustSavedId(cluster.clusterId);
    window.setTimeout(() => {
      setJustSavedId((prev) => (prev === cluster.clusterId ? null : prev));
    }, 1500);
  };

  return (
    <div className="w-full rounded-2xl bg-[#18181B] border border-white/10 overflow-hidden transition-all">
      {/* 상단 요약 헤더 */}
      <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 border-b border-white/5">
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="flex items-center gap-2.5 text-left min-w-0 flex-1"
        >
          <span className="px-2 py-0.5 rounded-md bg-zinc-900 border border-white/10 text-primary-container font-label-sm text-[11px] font-bold shrink-0">
            사진 · 동영상 통합 얼굴 인식
          </span>
          <span className="font-label-md text-[12.5px] md:text-[13px] text-zinc-100 font-bold truncate">
            🎯 {visibleClusters.length}명의 얼굴을 자동 추출했습니다 ({latestCorpusYear}년 대표컷 + 과거 연도 베스트 컷 누적 · 동영상 구간 자동 연동)
          </span>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          {excludedCount > 0 && (
            <button
              type="button"
              onClick={() => void restoreExcludedFaceClusters()}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-400 hover:text-zinc-200 font-label-sm text-[11px]"
            >
              제외된 얼굴 {excludedCount}명 복원
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowFaceRegistryModal(true)}
            className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-primary-container font-label-sm text-[11.5px] font-bold flex items-center gap-1"
          >
            <span>👥 연도별 히스토리 &amp; 초대 레이더 시드</span>
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="p-1 text-zinc-400 hover:text-white"
            title={isExpanded ? '접기' : '펼치기'}
          >
            <span
              className={`material-symbols-outlined text-[18px] transition-transform duration-200 ${
                isExpanded ? 'rotate-180' : ''
              }`}
            >
              expand_more
            </span>
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-3.5 md:p-4 flex flex-col gap-3.5 bg-zinc-950/50">
          {/* 5명이 한눈에 잘리지 않고 모두 들어오는 반응형 5열 그리드 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {visibleClusters.map((cluster) => {
              const currentDraft = draftNames[cluster.clusterId] ?? '';
              const isRegistered = Boolean(cluster.registeredName.trim());
              const yearlyCuts = getClusterYearlyCuts(cluster);
              const activeYear = selectedYearMap[cluster.clusterId] ?? yearlyCuts[0].year;
              const activeCut =
                yearlyCuts.find((c) => c.year === activeYear) ?? yearlyCuts[0];
              const stackedBehindCuts = yearlyCuts.filter((c) => c.year !== activeCut.year);

              return (
                <div
                  key={cluster.clusterId}
                  className={`w-full min-w-0 rounded-xl p-3 bg-zinc-900/90 border transition-all flex flex-col justify-between gap-2.5 relative ${
                    isRegistered ? 'border-primary-container/50' : 'border-white/10'
                  }`}
                >
                  {/* 상단 연도 스택 탭 + 우측 [✕ 행인 제외] 버튼 */}
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1 min-w-0 flex-wrap">
                      {yearlyCuts.map((yc) => {
                        const isSelectedYear = yc.year === activeCut.year;
                        return (
                          <button
                            key={yc.year}
                            type="button"
                            onClick={() =>
                              setSelectedYearMap((prev) => ({
                                ...prev,
                                [cluster.clusterId]: yc.year,
                              }))
                            }
                            title={`${yc.year}년 베스트 컷 (${yc.representativeDate}) 보기`}
                            className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold transition-all shrink-0 ${
                              isSelectedYear
                                ? 'bg-primary-container text-zinc-950 font-extrabold'
                                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-white/10'
                            }`}
                          >
                            {yc.year}년
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() => void excludeFaceCluster(cluster.clusterId)}
                      title="무관한 행인 얼굴 1초 제외"
                      className="px-1.5 py-0.5 rounded bg-zinc-950/90 hover:bg-red-950/60 border border-white/10 hover:border-red-400/40 text-zinc-400 hover:text-red-300 font-label-sm text-[10px] font-medium transition-colors shrink-0"
                    >
                      ✕ 제외
                    </button>
                  </div>

                  {/* 차곡차곡 쌓인 연도별 베스트 컷 아바타 스택 + 인물 요약 */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative flex items-center shrink-0">
                      {/* 전면(현재 선택 연도) 베스트 컷 아바타 */}
                      <div className="relative z-20">
                        <AutonomousCanvasFaceAvatar
                          photoFile={activeCut.representativePhoto}
                          boundingBox={activeCut.boundingBox}
                          fallbackAvatarUrl={activeCut.avatarUrl || activeCut.cropUrl}
                          altText={cluster.registeredName || cluster.appearanceLabelKo}
                          isHighlighted={isRegistered}
                          sizeClass="w-12 h-12"
                        />
                      </div>

                      {/* 뒤쪽에 차곡차곡 쌓인 다른 연도(예: 2024년) 베스트 컷 아바타 */}
                      {stackedBehindCuts.map((behindCut, sIdx) => (
                        <button
                          key={behindCut.year}
                          type="button"
                          onClick={() =>
                            setSelectedYearMap((prev) => ({
                              ...prev,
                              [cluster.clusterId]: behindCut.year,
                            }))
                          }
                          title={`클릭하여 ${behindCut.year}년 베스트 컷(${behindCut.representativeDate})으로 전환`}
                          style={{ zIndex: 15 - sIdx }}
                          className="relative -ml-3.5 opacity-80 hover:opacity-100 hover:scale-105 transition-all cursor-pointer group"
                        >
                          <AutonomousCanvasFaceAvatar
                            photoFile={behindCut.representativePhoto}
                            boundingBox={behindCut.boundingBox}
                            fallbackAvatarUrl={behindCut.avatarUrl || behindCut.cropUrl}
                            altText={`${behindCut.year}년 베스트 컷`}
                            isHighlighted={false}
                            sizeClass="w-9 h-9"
                          />
                          <span className="absolute -bottom-1 right-0 px-1 py-0.2 rounded bg-zinc-950/95 border border-white/20 text-zinc-200 font-mono text-[8.5px] font-bold">
                            &apos;{String(behindCut.year).slice(-2)}
                          </span>
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-1 min-w-0">
                        <p className="font-label-sm text-[12.5px] text-white font-bold truncate">
                          {cluster.registeredName ? cluster.registeredName : cluster.appearanceLabelKo}
                        </p>
                        {isRegistered && (
                          <span className="px-1 py-0.2 rounded bg-primary-container/15 text-primary-container font-label-sm text-[9.5px] font-bold shrink-0">
                            등록됨
                          </span>
                        )}
                      </div>
                      <p className="font-body-sm text-[11px] text-zinc-400 truncate mt-0.5">
                        사진 {cluster.matchedPhotoCount}장
                        {cluster.matchedVideoSegmentCount > 0
                          ? ` · 영상 ${cluster.matchedVideoSegmentCount}구간`
                          : ''}
                      </p>
                      <p className="font-mono text-[10px] text-zinc-500 truncate">
                        {activeCut.representativeDate} 대표컷 ({yearlyCuts.length}개 연도)
                      </p>
                    </div>
                  </div>

                  {/* 깔끔한 실명 입력창 + [등록] 버튼 (별도 호칭 카테고리 태그 제거) */}
                  <div className="flex items-center gap-1.5 w-full min-w-0">
                    <input
                      type="text"
                      value={currentDraft}
                      onChange={(e) =>
                        setDraftNames((prev) => ({
                          ...prev,
                          [cluster.clusterId]: e.target.value,
                        }))
                      }
                      onBlur={() => {
                        if (currentDraft.trim() !== cluster.registeredName) {
                          void handleSaveMember(cluster);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void handleSaveMember(cluster);
                        }
                      }}
                      placeholder="이름 입력 (예: 은숙, 멀린, 지우)"
                      className="min-w-0 flex-1 h-8 px-2.5 rounded-lg bg-zinc-950 border border-white/10 focus:border-primary-container outline-none font-body-sm text-[12px] text-white placeholder:text-zinc-500"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSaveMember(cluster)}
                      className="h-8 px-2.5 rounded-lg bg-primary-container text-zinc-950 font-label-sm text-[11.5px] font-extrabold shrink-0 hover:opacity-95"
                    >
                      {justSavedId === cluster.clusterId ? '완료!' : '등록'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 등록 즉시 활성화되는 실명 + 장면 자연어 사진 & 동영상 구간 점프 원터치 체험 바 */}
          {registeredClusters.length > 0 && (
            <div className="px-3.5 py-2.5 rounded-xl bg-zinc-900/90 border border-white/10 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-label-sm text-[11.5px] text-primary-container font-bold mr-1">
                  ⚡ 실명 사진 검색 &amp; 동영상 구간 점프 (0.04초):
                </span>
                {registeredClusters.map((rc) => {
                  const name = rc.registeredName.trim();
                  const pKey = `${rc.personKey} ${rc.roleHintKo}`.toLowerCase();
                  const isAdultMale = pKey.includes('adult_male') || /성인 남성/.test(pKey);
                  const isAdultFemale = pKey.includes('adult_female') || /성인 여성/.test(pKey);
                  const isGlassesYouth = pKey.includes('glasses') || /안경/.test(rc.appearanceLabelKo);
                  const isYoungBoy = pKey.includes('child_son');

                  const photoQueries = isAdultMale
                    ? [`${name} 나무 다리`, `${name} 바다`]
                    : isAdultFemale
                    ? [`${name} 나무 다리`, `${name} 선글라스`]
                    : isGlassesYouth
                    ? [`${name} 박물관`]
                    : isYoungBoy
                    ? [`${name} 물놀이`]
                    : [`${name}`];

                  const videoQuery = isAdultMale
                    ? `${name} 패러세일링`
                    : isAdultFemale
                    ? `${name} 테라스`
                    : '';

                  return (
                    <React.Fragment key={rc.clusterId}>
                      {photoQueries.map((qText) => (
                        <button
                          key={qText}
                          type="button"
                          onClick={() => onRunRealNameQuery(qText, 'gallery')}
                          className="px-2.5 py-1 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-white/10 text-zinc-100 font-label-sm text-[11.5px] flex items-center gap-1 transition-colors"
                        >
                          <span>🖼️ “{qText}”</span>
                        </button>
                      ))}
                      {rc.matchedVideoSegmentCount > 0 && videoQuery && (
                        <button
                          type="button"
                          onClick={() => onRunRealNameQuery(videoQuery, 'video')}
                          className="px-2.5 py-1 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-primary-container/30 text-primary-container font-label-sm text-[11.5px] flex items-center gap-1 transition-colors"
                        >
                          <span>
                            🎬 “{videoQuery}” (영상 {rc.matchedVideoSegments[0]?.timestampText ?? '00:00'} 구간)
                          </span>
                        </button>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * [라운지 마스터 모달 (Step 1 ~ Step 3)]
 * - Step 1: 자율 얼굴 검출 & 연도별(2026년 ➔ 2024년 등) 베스트 컷 차곡차곡 누적 스택
 * - Step 2: 실명 + 장면 자연어 사진 검색 즉시 연동 테스트
 * - Step 3: 초대받은 친구 폰 합류 시 '방장 등록 얼굴 임베딩 시드(Seed) + 촬영 날짜' 기준 레이더 스캔 매칭
 */
export const FaceMemberRegistryModal: React.FC = () => {
  const {
    showFaceRegistryModal,
    setShowFaceRegistryModal,
    faceClusters,
    latestCorpusYear,
    photos,
    registerFaceMember,
    excludeFaceCluster,
    restoreExcludedFaceClusters,
    detectFacesFromPhotoFile,
    detectingLiveFaces,
    setSearchSpace,
    runTextQuery,
  } = useSaySeeStore();

  const [selectedSamplePhoto, setSelectedSamplePhoto] = useState<string>('');
  const [selectedYearMap, setSelectedYearMap] = useState<Record<string, number>>({});
  const [radarSimulating, setRadarSimulating] = useState(false);
  const [radarComplete, setRadarComplete] = useState(true);

  const visibleClusters = useMemo(
    () => faceClusters.filter((c) => !c.excludedAsPasserby),
    [faceClusters]
  );

  const samplePhotos = useMemo(
    () => photos.filter((p) => !p.quarantined).slice(0, 20),
    [photos]
  );

  if (!showFaceRegistryModal) return null;

  const handleRunLiveDetection = async () => {
    if (!selectedSamplePhoto) return;
    await detectFacesFromPhotoFile(selectedSamplePhoto);
  };

  const handleTriggerRealNameSearch = async (query: string) => {
    setShowFaceRegistryModal(false);
    setSearchSpace('gallery');
    await runTextQuery(query);
  };

  const handleSimulateFriendRadar = () => {
    setRadarSimulating(true);
    setRadarComplete(false);
    window.setTimeout(() => {
      setRadarSimulating(false);
      setRadarComplete(true);
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-4xl rounded-2xl bg-[#18181B] border border-white/15 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* 모달 상단 헤더 */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between gap-3 bg-zinc-950/80">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-primary-container text-zinc-950 font-label-sm text-[11px] font-extrabold">
                라운지 마스터 Step 1~3
              </span>
              <h2 className="font-headline-sm text-[17px] md:text-[18px] text-white font-extrabold">
                자율 얼굴 검출(Face Crop) · 연도별 베스트 컷 누적 스택 &amp; 초대 레이더 시드
              </h2>
            </div>
            <p className="font-body-sm text-[12px] text-zinc-400">
              {latestCorpusYear}년 당해 연도 베스트 컷을 대표로 표시하고, 과거 사진(2024년 등) 검색 시 동일 인물의 연도별 베스트 컷을 뒤쪽에 차곡차곡 쌓아 나갑니다.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowFaceRegistryModal(false)}
            className="w-9 h-9 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-400 hover:text-white flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* 모달 본문 */}
        <div className="p-6 overflow-y-auto flex flex-col gap-6">
          {/* Step 1: 연도별 대표 얼굴 베스트 컷 스택 & 실시간 사진 선택 검출 */}
          <section className="rounded-xl bg-zinc-900/70 border border-white/10 p-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-label-md text-[14px] text-white font-bold">
                  Step 1. 연도별 베스트 컷 차곡차곡 누적 ({latestCorpusYear}년 ➔ 2024년)
                </h3>
                <p className="font-body-sm text-[12px] text-zinc-400">
                  동일 인물이 다른 연도 사진에서 발견될 때마다 해당 연도의 가장 선명한 정면 1장을 뒤쪽에 차곡차곡 쌓아 연도별 얼굴 변화를 한눈에 보존합니다.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedSamplePhoto}
                  onChange={(e) => setSelectedSamplePhoto(e.target.value)}
                  className="h-9 px-3 rounded-lg bg-zinc-950 border border-white/10 text-zinc-200 font-body-sm text-[12px] outline-none"
                >
                  <option value="">사진 추가 선택 (연도별 베스트 누적)...</option>
                  {samplePhotos.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name} ({p.date})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!selectedSamplePhoto || detectingLiveFaces}
                  onClick={() => void handleRunLiveDetection()}
                  className="h-9 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 border border-white/10 text-primary-container font-label-sm text-[12px] font-bold"
                >
                  {detectingLiveFaces ? '얼굴 좌표 분석 중...' : '+ 실시간 얼굴 크롭'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
              {visibleClusters.map((c) => {
                const yearlyCuts = getClusterYearlyCuts(c);
                const activeYear = selectedYearMap[c.clusterId] ?? yearlyCuts[0].year;
                const activeCut =
                  yearlyCuts.find((yc) => yc.year === activeYear) ?? yearlyCuts[0];

                return (
                  <div
                    key={c.clusterId}
                    className="rounded-xl p-3.5 bg-zinc-950/90 border border-white/10 flex flex-col gap-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <AutonomousCanvasFaceAvatar
                          photoFile={activeCut.representativePhoto}
                          boundingBox={activeCut.boundingBox}
                          fallbackAvatarUrl={activeCut.avatarUrl || activeCut.cropUrl}
                          altText={c.registeredName || c.appearanceLabelKo}
                          isHighlighted={Boolean(c.registeredName)}
                          sizeClass="w-16 h-16"
                        />
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {yearlyCuts.map((yc) => (
                              <button
                                key={yc.year}
                                type="button"
                                onClick={() =>
                                  setSelectedYearMap((prev) => ({
                                    ...prev,
                                    [c.clusterId]: yc.year,
                                  }))
                                }
                                className={`px-2 py-0.5 rounded font-mono text-[10.5px] font-bold transition-all ${
                                  yc.year === activeCut.year
                                    ? 'bg-primary-container text-zinc-950 font-extrabold'
                                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                                }`}
                              >
                                {yc.year}년 베스트
                              </button>
                            ))}
                          </div>
                          <span className="font-label-md text-[14px] text-white font-bold mt-1 truncate">
                            {c.registeredName || `${c.appearanceLabelKo} (미등록)`}
                          </span>
                          <span className="font-body-sm text-[11.5px] text-zinc-400 truncate">
                            {activeCut.year}년 원본: {activeCut.representativePhoto} · 매칭 사진 {c.matchedPhotoCount}장
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => void excludeFaceCluster(c.clusterId)}
                        className="px-2 py-1 rounded bg-zinc-900 hover:bg-red-950/60 border border-white/10 text-zinc-400 hover:text-red-300 font-label-sm text-[11px] shrink-0"
                      >
                        ✕ 행인 제외
                      </button>
                    </div>

                    {/* 이름 즉시 수정 (별도 호칭 칩 없음) */}
                    <div className="flex items-center gap-2 min-w-0">
                      <input
                        type="text"
                        defaultValue={c.registeredName}
                        placeholder="이름 입력 (예: 은숙, 멀린, 치우, 천우, 지우)"
                        onBlur={(e) =>
                          void registerFaceMember(c.clusterId, e.target.value, '')
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            void registerFaceMember(
                              c.clusterId,
                              (e.target as HTMLInputElement).value,
                              ''
                            );
                          }
                        }}
                        className="min-w-0 flex-1 h-8 px-2.5 rounded-lg bg-zinc-900 border border-white/10 focus:border-primary-container text-white font-body-sm text-[12px] outline-none"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Step 2 & 3: 초대받은 친구 폰 합류 시 '방장 등록 얼굴 임베딩 시드(Seed) + 촬영 날짜' 레이더 스캔 */}
          <section className="rounded-xl bg-zinc-900/70 border border-white/10 p-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-label-md text-[14px] text-white font-bold">
                  Step 2~3. 초대받은 친구 폰 합류 시 ‘얼굴 임베딩 시드(Seed) + 촬영 날짜’ 레이더 스캔
                </h3>
                <p className="font-body-sm text-[12px] text-zinc-400">
                  방장이 등록한 멤버의 768차원 얼굴·인물 임베딩 시드와 촬영 일자({latestCorpusYear}년·2024년)를 기준으로, 초대받은 가족/친구 폰에서 동일 인물 사진을 로컬 레이더로 즉시 찾아냅니다.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSimulateFriendRadar}
                className="px-3 py-1.5 rounded-lg bg-primary-container text-zinc-950 font-label-sm text-[12px] font-extrabold"
              >
                {radarSimulating ? '📡 친구 폰 레이더 스캔 중...' : '📡 초대 멤버 얼굴 시드 레이더 재검증'}
              </button>
            </div>

            {radarComplete && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                {visibleClusters.slice(0, 3).map((c) => (
                  <div
                    key={`seed_${c.clusterId}`}
                    className="p-3 rounded-lg bg-zinc-950 border border-white/10 flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-label-sm text-[12px] text-white font-bold">
                        🎯 {c.registeredName || c.appearanceLabelKo} 시드
                      </span>
                      <span className="font-mono text-[10.5px] text-emerald-400">
                        768-dim Seed Ready
                      </span>
                    </div>
                    <p className="font-mono text-[10.5px] text-zinc-400 truncate">
                      Vec: [{(c.seedVecPreview ?? [0.04, -0.02, 0.08, 0.05]).slice(0, 4).join(', ')} ...]
                    </p>
                    <p className="font-body-sm text-[11px] text-zinc-300">
                      기준 촬영일: {c.seedDates.slice(0, 3).join(', ')} 외
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <button
                        type="button"
                        onClick={() =>
                          void handleTriggerRealNameSearch(
                            `${c.registeredName || '선글라스'} 나무 다리`
                          )
                        }
                        className="flex-1 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-200 font-label-sm text-[11px]"
                      >
                        🔍 “{c.registeredName || '멤버'} 나무 다리” 검색
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* 모달 하단 푸터 */}
        <div className="px-6 py-3.5 border-t border-white/10 bg-zinc-950/90 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {faceClusters.some((c) => c.excludedAsPasserby) && (
              <button
                type="button"
                onClick={() => void restoreExcludedFaceClusters()}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 font-label-sm text-[12px]"
              >
                제외된 행인 얼굴 복원
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowFaceRegistryModal(false)}
            className="px-5 py-2 rounded-xl bg-primary-container text-zinc-950 font-label-md text-[13px] font-extrabold"
          >
            확인 및 실명 검색 시작
          </button>
        </div>
      </div>
    </div>
  );
};
