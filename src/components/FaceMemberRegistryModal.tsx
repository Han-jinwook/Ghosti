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
    globalSeedVersion,
    retroScanRunning,
    lastRetroScanReport,
    swarmFaceCandidates,
    registerFaceMember,
    excludeFaceCluster,
    restoreExcludedFaceClusters,
    setShowFaceRegistryModal,
    applySwarmFaceCandidate,
    runGlobalSwarmRetroScanAll,
  } = useSaySeeStore();

  const [isExpanded, setIsExpanded] = useState(true);
  const [showSwarmMesh, setShowSwarmMesh] = useState(true);
  const [draftNames, setDraftNames] = useState<Record<string, string>>({});
  const [companionCustomNames, setCompanionCustomNames] = useState<Record<string, string>>({});
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
  const pendingSwarmCount = useMemo(
    () => swarmFaceCandidates.filter((c) => !c.applied).length,
    [swarmFaceCandidates]
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
          className="flex items-center gap-2 text-left min-w-0 flex-1 flex-wrap"
        >
          <span className="px-2 py-0.5 rounded-md bg-zinc-900 border border-white/10 text-primary-container font-label-sm text-[11px] font-bold shrink-0">
            사진 · 동영상 통합 얼굴 그물망
          </span>
          <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 font-mono text-[10.5px] font-extrabold shrink-0 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Global Seed v{globalSeedVersion} · 전원 동시 적용 중
          </span>
          <span className="font-label-md text-[12.5px] md:text-[13px] text-zinc-100 font-bold truncate">
            🎯 {visibleClusters.length}명 등록 · 호스트 원본 + 전 멤버 폰 동반 얼굴 발굴 &amp; 0.04초 역스캔 연동
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
            onClick={() => {
              setIsExpanded(true);
              setShowSwarmMesh((prev) => !prev);
            }}
            className={`px-2.5 py-1 rounded-lg border font-label-sm text-[11.5px] font-bold flex items-center gap-1 transition-all ${
              showSwarmMesh
                ? 'bg-primary-container/15 border-primary-container/40 text-primary-container'
                : 'bg-zinc-900 hover:bg-zinc-800 border-white/15 text-zinc-300'
            }`}
          >
            <span>🕸️ 멤버 사진 동반 발굴 &amp; 전원 역스캔</span>
            {pendingSwarmCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-primary-container text-zinc-950 font-mono text-[10px] font-extrabold">
                +{pendingSwarmCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setShowFaceRegistryModal(true)}
            className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-200 font-label-sm text-[11.5px] font-bold flex items-center gap-1"
          >
            <span>👥 전체 시드 관리</span>
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

                      {/* 뒤쪽에 차곡차곡 쌓인 다른 연도(예: 2025년, 2024년, 2023년) 베스트 컷 아바타 */}
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
                          className="relative -ml-3.5 opacity-85 hover:opacity-100 hover:scale-105 transition-all cursor-pointer group"
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
                            시드ON
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
                        {activeCut.representativeDate} 대표컷 ({yearlyCuts.length}개 연도덱)
                      </p>
                    </div>
                  </div>

                  {/* 깔끔한 실명 입력창 + [등록] 버튼 */}
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

          {/* 🕸️ [핵심 신기능] 전 멤버 폰 통합 얼굴 그물망 (Global Swarm Face Mesh) & 동반 등장 발굴 + 전원 동시 역스캔 */}
          {showSwarmMesh && (
            <div className="rounded-xl bg-zinc-900/95 border border-primary-container/25 p-3.5 flex flex-col gap-3">
              {/* 상단 규칙 배너 & 일괄 역스캔 버튼 */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-white/10">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded bg-primary-container text-zinc-950 font-label-sm text-[10.5px] font-extrabold">
                      전 멤버 폰 통합 규칙 (Global Seed v{globalSeedVersion})
                    </span>
                    <span className="font-label-sm text-[12.5px] text-white font-bold">
                      🕸️ 멤버(게스트) 사진 속 ‘동반 등장 얼굴’ &amp; ‘과거 연도 베스트 컷’ 자동 발굴 ➔ 전원 동시 2차 역스캔
                    </span>
                  </div>
                  <p className="font-body-sm text-[11.5px] text-zinc-400">
                    호스트뿐 아니라 모든 멤버가 올린 사진을 소스로 삼되, <strong className="text-zinc-200">등록 멤버와 한 프레임에 2회 이상 함께 찍힌 동반 인물(행인 0%)</strong>만 정밀 포착하여 연도별 징검다리 시드를 보강하고 호스트 원본 + 전 멤버 폰을 0.04초 만에 동시에 다시 훑어줍니다.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={retroScanRunning}
                  onClick={() => void runGlobalSwarmRetroScanAll()}
                  className="px-3 py-1.5 rounded-xl bg-primary-container hover:opacity-95 disabled:opacity-50 text-zinc-950 font-label-sm text-[11.5px] font-extrabold shrink-0 flex items-center gap-1.5 shadow-sm"
                >
                  <span>
                    {retroScanRunning
                      ? '🔄 호스트 + 전 멤버 폰 동시 역스캔 중...'
                      : pendingSwarmCount > 0
                      ? `🔄 발굴 시드 ${pendingSwarmCount}건 일괄 병합 & 전원 동시 역스캔`
                      : '🔄 호스트 + 전 멤버 폰 통합 그물망 재검증'}
                  </span>
                </button>
              </div>

              {/* 게스트 폰 사진에서 동반 등장 규칙으로 발굴된 4대 실전 후보 카드 */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {swarmFaceCandidates.map((cand) => {
                  const customNameVal = companionCustomNames[cand.candidateId] ?? '';
                  return (
                    <div
                      key={cand.candidateId}
                      className={`rounded-xl p-3 border flex flex-col justify-between gap-2.5 transition-all ${
                        cand.applied
                          ? 'bg-zinc-950/60 border-emerald-500/30'
                          : 'bg-zinc-950/95 border-white/10 hover:border-primary-container/40'
                      }`}
                    >
                      <div className="flex flex-col gap-2">
                        {/* 출처 & 동반 등장 검증 배지 */}
                        <div className="flex items-center justify-between gap-1 flex-wrap">
                          <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-white/10 text-zinc-300 font-label-sm text-[10px] font-bold">
                            {cand.contributorLabel}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 font-mono text-[9.5px] font-bold">
                            🤝 {cand.coOccurredWithNames.join('·')} 동반 {cand.coOccurrenceCount}회
                          </span>
                        </div>

                        {/* 실제 크롭 얼굴 아바타 + 설명 */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          <AutonomousCanvasFaceAvatar
                            photoFile={cand.sourcePhoto}
                            boundingBox={cand.boundingBox}
                            fallbackAvatarUrl={cand.cropUrl}
                            altText={cand.suggestedMemberName}
                            isHighlighted={!cand.applied}
                            sizeClass="w-12 h-12"
                          />
                          <div className="flex flex-col min-w-0 flex-1">
                            <div className="flex items-center gap-1">
                              <span className="px-1.5 py-0.2 rounded bg-primary-container/15 text-primary-container font-mono text-[10px] font-extrabold shrink-0">
                                {cand.shootingYear}년 컷
                              </span>
                              <span className="font-label-sm text-[12px] text-white font-bold truncate">
                                {cand.candidateType === 'year_bridge'
                                  ? `${cand.suggestedMemberName} 징검다리 시드`
                                  : `동반 인물 (${cand.suggestedMemberName} 외)`}
                              </span>
                            </div>
                            <p className="font-body-sm text-[11px] text-zinc-300 line-clamp-2 mt-0.5 leading-snug">
                              {cand.bridgeReasonKo}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* 하단 역스캔 예상 구출량 & 액션 버튼 */}
                      <div className="flex flex-col gap-1.5 pt-1 border-t border-white/5">
                        <div className="flex items-center justify-between text-[10.5px] font-mono text-zinc-400">
                          <span>
                            역스캔 구출: 호스트 +{cand.rescuedHostPhotoCount}장 · 멤버폰 +{cand.rescuedMemberPhoneCount}장
                          </span>
                          {cand.rescuedVideoSegmentCount > 0 && (
                            <span className="text-primary-container font-bold">
                              영상 +{cand.rescuedVideoSegmentCount}구간
                            </span>
                          )}
                        </div>

                        {cand.applied ? (
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 font-label-sm text-[11px] font-bold flex-1 text-center">
                              ✓ 연도덱 적재 &amp; 전원 역스캔 완료
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                onRunRealNameQuery(cand.sampleSearchQuery, cand.sampleSearchSpace)
                              }
                              className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-primary-container font-label-sm text-[11px] font-bold shrink-0"
                            >
                              🔍 구출 보기
                            </button>
                          </div>
                        ) : cand.candidateType === 'new_companion' ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={customNameVal}
                              onChange={(e) =>
                                setCompanionCustomNames((prev) => ({
                                  ...prev,
                                  [cand.candidateId]: e.target.value,
                                }))
                              }
                              placeholder="새 멤버명 (비우면 지우 병합)"
                              className="min-w-0 flex-1 h-7 px-2 rounded-lg bg-zinc-900 border border-white/10 text-[11px] text-white placeholder:text-zinc-500 outline-none focus:border-primary-container"
                            />
                            <button
                              type="button"
                              disabled={retroScanRunning}
                              onClick={() =>
                                void applySwarmFaceCandidate(cand.candidateId, customNameVal)
                              }
                              className="h-7 px-2.5 rounded-lg bg-primary-container text-zinc-950 font-label-sm text-[11px] font-extrabold shrink-0 hover:opacity-95"
                            >
                              {customNameVal.trim() ? '새 멤버 역스캔' : `+${cand.suggestedMemberName} 병합`}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={retroScanRunning}
                            onClick={() => void applySwarmFaceCandidate(cand.candidateId)}
                            className="w-full py-1.5 rounded-lg bg-zinc-800 hover:bg-primary-container hover:text-zinc-950 border border-primary-container/30 text-primary-container font-label-sm text-[11px] font-extrabold transition-colors"
                          >
                            ➕ {cand.suggestedMemberName} {cand.shootingYear}년 덱 합치기 &amp; 전원 역스캔
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 실시간 전원 역스캔(Retro-Scan) 결과 브리핑 바 */}
              {lastRetroScanReport && (
                <div className="px-3 py-2 rounded-lg bg-zinc-950 border border-emerald-400/25 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10.5px] font-extrabold shrink-0">
                      ⚡ Seed v{lastRetroScanReport.seedVersion} 역스캔 리포트 ({lastRetroScanReport.elapsedMs}ms)
                    </span>
                    <span className="font-label-sm text-[11.5px] text-zinc-100 font-bold truncate">
                      {lastRetroScanReport.triggerTitle}
                    </span>
                    <span className="font-mono text-[11px] text-emerald-300">
                      (호스트 원본 +{lastRetroScanReport.rescuedHostPhotos}장 · 멤버 {lastRetroScanReport.totalSyncedDevices}대 폰 +{lastRetroScanReport.rescuedMemberPhonePhotos}장 · 동영상 +{lastRetroScanReport.rescuedVideoSegments}구간 연결)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onRunRealNameQuery(
                        lastRetroScanReport.sampleQuery,
                        lastRetroScanReport.sampleSpace
                      )
                    }
                    className="px-2.5 py-1 rounded-lg bg-primary-container/15 hover:bg-primary-container/25 border border-primary-container/40 text-primary-container font-label-sm text-[11px] font-extrabold shrink-0"
                  >
                    🔍 구출된 “{lastRetroScanReport.sampleQuery}” 즉시 열람
                  </button>
                </div>
              )}
            </div>
          )}

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
 * - Step 2: 멤버(게스트) 사진 속 동반 등장(Co-occurrence) 얼굴 & 과거 연도 징검다리 자동 발굴
 * - Step 3: 호스트 원본 + 전 멤버 스마트폰 0.04초 동시 2차 역스캔(Retro-Scan)
 */
export const FaceMemberRegistryModal: React.FC = () => {
  const {
    showFaceRegistryModal,
    setShowFaceRegistryModal,
    faceClusters,
    latestCorpusYear,
    globalSeedVersion,
    retroScanRunning,
    lastRetroScanReport,
    swarmFaceCandidates,
    photos,
    registerFaceMember,
    excludeFaceCluster,
    restoreExcludedFaceClusters,
    detectFacesFromPhotoFile,
    detectingLiveFaces,
    applySwarmFaceCandidate,
    runGlobalSwarmRetroScanAll,
    setSearchSpace,
    runTextQuery,
  } = useSaySeeStore();

  const [selectedSamplePhoto, setSelectedSamplePhoto] = useState<string>('');
  const [selectedYearMap, setSelectedYearMap] = useState<Record<string, number>>({});
  const [companionCustomNames, setCompanionCustomNames] = useState<Record<string, string>>({});

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

  const handleTriggerRealNameSearch = async (
    query: string,
    space: 'gallery' | 'video' = 'gallery'
  ) => {
    setShowFaceRegistryModal(false);
    setSearchSpace(space);
    await runTextQuery(query);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-4xl rounded-2xl bg-[#18181B] border border-white/15 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* 모달 상단 헤더 */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between gap-3 bg-zinc-950/80">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded bg-primary-container text-zinc-950 font-label-sm text-[11px] font-extrabold">
                통합 얼굴 그물망 · Global Seed v{globalSeedVersion}
              </span>
              <h2 className="font-headline-sm text-[17px] md:text-[18px] text-white font-extrabold">
                연도별 베스트 컷 누적 스택 &amp; 전 멤버 폰 동반 얼굴 역스캔 센터
              </h2>
            </div>
            <p className="font-body-sm text-[12px] text-zinc-400">
              호스트와 모든 멤버(게스트)의 사진을 하나의 거대한 얼굴 규칙으로 묶어, 새로운 인물이나 과거 연도 컷이 추가될 때마다 전 멤버의 폰을 동시에 다시 훑어줍니다.
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
                  Step 1. 연도별 베스트 컷 차곡차곡 누적 ({latestCorpusYear}년 ➔ 2025년 ➔ 2024년 ➔ 2023년)
                </h3>
                <p className="font-body-sm text-[12px] text-zinc-400">
                  동일 인물이 다른 연도 사진에서 발견될 때마다 해당 연도의 가장 선명한 정면 1장을 뒤쪽에 차곡차곡 쌓아 연도별 얼굴 변화를 보존합니다.
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
                  {detectingLiveFaces ? '얼굴 좌표 분석 중...' : '+ 실시간 얼굴 크롭 & 역스캔'}
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

                    {/* 이름 즉시 수정 */}
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

          {/* Step 2 & 3: 멤버(게스트) 사진 속 동반 등장 얼굴 발굴 & 호스트 + 전 멤버 폰 동시 2차 역스캔 */}
          <section className="rounded-xl bg-zinc-900/70 border border-primary-container/30 p-4 flex flex-col gap-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-label-md text-[14px] text-white font-bold">
                  Step 2~3. 멤버(게스트) 사진 속 ‘동반 등장(Co-occurrence) 얼굴’ 발굴 &amp; 전 멤버 폰 동시 역스캔
                </h3>
                <p className="font-body-sm text-[12px] text-zinc-400">
                  등록된 멤버 옆에 2회 이상 나란히 찍힌 얼굴(행인 차단 100%)을 게스트 사진에서도 자동 포착하여, 연도별 베스트 컷을 보강하고 호스트 PC + 전 멤버 스마트폰의 사전 추출 얼굴 장부를 0.04초 만에 동시에 역스캔합니다.
                </p>
              </div>
              <button
                type="button"
                disabled={retroScanRunning}
                onClick={() => void runGlobalSwarmRetroScanAll()}
                className="px-3.5 py-2 rounded-lg bg-primary-container text-zinc-950 font-label-sm text-[12px] font-extrabold shrink-0"
              >
                {retroScanRunning
                  ? '🔄 호스트 + 전 멤버 폰 동시 역스캔 중...'
                  : '🔄 발굴 시드 일괄 병합 & 전 멤버 폰 동시 역스캔'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {swarmFaceCandidates.map((cand) => {
                const customNameVal = companionCustomNames[cand.candidateId] ?? '';
                return (
                  <div
                    key={`modal_${cand.candidateId}`}
                    className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2.5 ${
                      cand.applied
                        ? 'bg-zinc-950/60 border-emerald-500/30'
                        : 'bg-zinc-950 border-white/10'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <AutonomousCanvasFaceAvatar
                        photoFile={cand.sourcePhoto}
                        boundingBox={cand.boundingBox}
                        fallbackAvatarUrl={cand.cropUrl}
                        altText={cand.suggestedMemberName}
                        isHighlighted={!cand.applied}
                        sizeClass="w-14 h-14"
                      />
                      <div className="flex flex-col min-w-0 flex-1 gap-1">
                        <div className="flex items-center justify-between gap-1 flex-wrap">
                          <span className="font-label-sm text-[12.5px] text-white font-bold">
                            {cand.candidateType === 'year_bridge'
                              ? `🎯 ${cand.suggestedMemberName} · ${cand.shootingYear}년 징검다리 베스트 컷`
                              : `🆕 동반 등장 인물 (${cand.shootingYear}년)`}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-mono text-[10px] font-bold">
                            🤝 {cand.coOccurredWithNames.join('·')} 동반 {cand.coOccurrenceCount}회
                          </span>
                        </div>
                        <p className="font-body-sm text-[11.5px] text-zinc-300">
                          {cand.bridgeReasonKo}
                        </p>
                        <p className="font-mono text-[10.5px] text-zinc-400">
                          출처: {cand.contributorLabel} ({cand.sourcePhoto}) · 호스트 +{cand.rescuedHostPhotoCount}장 / 멤버폰 +{cand.rescuedMemberPhoneCount}장 구출
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      {cand.applied ? (
                        <>
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 font-label-sm text-[11px] font-bold flex-1 text-center">
                            ✓ Global Seed 병합 &amp; 전원 역스캔 완료
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              void handleTriggerRealNameSearch(
                                cand.sampleSearchQuery,
                                cand.sampleSearchSpace
                              )
                            }
                            className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-primary-container font-label-sm text-[11px] font-bold"
                          >
                            🔍 “{cand.sampleSearchQuery}” 검색
                          </button>
                        </>
                      ) : cand.candidateType === 'new_companion' ? (
                        <>
                          <input
                            type="text"
                            value={customNameVal}
                            onChange={(e) =>
                              setCompanionCustomNames((prev) => ({
                                ...prev,
                                [cand.candidateId]: e.target.value,
                              }))
                            }
                            placeholder="새 멤버 이름 입력 (비우면 지우 연도덱 병합)"
                            className="min-w-0 flex-1 h-8 px-2.5 rounded-lg bg-zinc-900 border border-white/10 text-[11.5px] text-white outline-none focus:border-primary-container"
                          />
                          <button
                            type="button"
                            disabled={retroScanRunning}
                            onClick={() =>
                              void applySwarmFaceCandidate(cand.candidateId, customNameVal)
                            }
                            className="h-8 px-3 rounded-lg bg-primary-container text-zinc-950 font-label-sm text-[11.5px] font-extrabold shrink-0"
                          >
                            {customNameVal.trim() ? '새 멤버 등록 & 역스캔' : '지우 병합 & 역스캔'}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          disabled={retroScanRunning}
                          onClick={() => void applySwarmFaceCandidate(cand.candidateId)}
                          className="w-full py-1.5 rounded-lg bg-zinc-900 hover:bg-primary-container hover:text-zinc-950 border border-primary-container/40 text-primary-container font-label-sm text-[11.5px] font-extrabold transition-colors"
                        >
                          ➕ {cand.suggestedMemberName} 연도덱에 합치기 &amp; 호스트+전 멤버 폰 역스캔
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
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
