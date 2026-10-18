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
 * [Step 1 인라인 바] 전체 갤러리(사진) 상단 얼굴 등록 바
 * 1. 다년도·다각도(정면 + 측면·미소 + 야외·노을 + 선글라스) 최대 변별력 시드 패키지를 알고리즘이 자동 결합하여
 *    메인 동그란 아바타 옆에 2~3개의 미니 서브 아바타 스택 배지(Avatar Stack Badge)로 조용히 표시합니다.
 * 2. 피로도를 유발하는 수동 병합 알림이나 별도 역스캔 버튼 없이, 오직 이름을 입력(또는 칩 선택)하고
 *    [등록] 버튼 딱 한 번만 누르면 시드 확정 + Global Seed 갱신 + 전 멤버 0.04초 역스캔이 100% 전자동 완결됩니다.
 * 3. 새로운 동반 등장 인물(미등록 새 멤버)은 줄 맨 끝에 조용히 새 카드로 추가되어 똑같이 이름 적고 [등록]만 누르면 됩니다.
 * 4. 할머니 등 노약자·바쁜 멤버가 [그냥 넘어가기 (Pass)]를 눌러 호스트 뒷정리 대기열(Host Cleanup Queue)로 넘어온
 *    누락 연도/각도 컷은 하단 한 줄에서 호스트가 [누락분 일괄 등록] 원터치로 깔끔하게 마감합니다.
 */
export const FaceMemberInlineBar: React.FC<{
  onRunRealNameQuery: (query: string, targetSpace?: 'gallery' | 'video') => void;
}> = ({ onRunRealNameQuery }) => {
  const {
    faceClusters,
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

  // 호스트(방장) 전용 뒷정리 대기열: 노약자(할머니)·바쁜 멤버가 [패스]했거나 아직 시드에 흡수되지 않은 누락 연도/각도 후보
  const hostCleanupQueue = useMemo(
    () => swarmFaceCandidates.filter((c) => !c.applied),
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
    if (nextName !== undefined) {
      setDraftNames((prev) => ({ ...prev, [cluster.clusterId]: finalName }));
    }
    await registerFaceMember(cluster.clusterId, finalName, '');
    setJustSavedId(cluster.clusterId);
    window.setTimeout(() => {
      setJustSavedId((prev) => (prev === cluster.clusterId ? null : prev));
    }, 1500);
  };

  return (
    <div className="w-full rounded-2xl bg-[#18181B] border border-white/10 overflow-hidden transition-all">
      {/* 상단 요약 헤더 (피로도를 유발하는 수동 병합 버튼 제거, 자동 멀티시드 상태만 깔끔하게 표시) */}
      <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 border-b border-white/5">
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="flex items-center gap-2 text-left min-w-0 flex-1 flex-wrap"
        >
          <span className="px-2 py-0.5 rounded-md bg-zinc-900 border border-white/10 text-primary-container font-label-sm text-[11px] font-bold shrink-0">
            다년도·다각도 자동 시드
          </span>
          <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 font-mono text-[10.5px] font-extrabold shrink-0 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Global Seed v{globalSeedVersion} 자동 동기화
          </span>
          <span className="font-label-md text-[12.5px] md:text-[13px] text-zinc-100 font-bold truncate">
            정면·측면·야외·선글라스 연도별 베스트 컷이 자동 결합됨 — 이름 적고 [등록] 한 번이면 전 멤버 0.04초 역스캔 완결!
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
            className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-200 font-label-sm text-[11.5px] font-bold flex items-center gap-1"
          >
            <span>👥 3단 집단지성 &amp; 호스트 총점검</span>
            {hostCleanupQueue.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-zinc-950 font-mono text-[10px] font-extrabold">
                {hostCleanupQueue.length}
              </span>
            )}
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
        <div className="p-3.5 md:p-4 flex flex-col gap-3 bg-zinc-950/50">
          {/* 기본 멤버 + 맨 끝에 조용히 추가된 동반 등장 새 멤버 카드 그리드 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {visibleClusters.map((cluster) => {
              const currentDraft = draftNames[cluster.clusterId] ?? '';
              const isRegistered = Boolean(cluster.registeredName.trim());
              const yearlyCuts = getClusterYearlyCuts(cluster);
              const activeYear = selectedYearMap[cluster.clusterId] ?? yearlyCuts[0].year;
              const activeCut =
                yearlyCuts.find((c) => c.year === activeYear) ?? yearlyCuts[0];
              const stackedBehindCuts = yearlyCuts.filter((c) => c.year !== activeCut.year);

              const quickRoleChips = cluster.isCompanionDiscovered
                ? ['사촌', '조카', '할머니', '친구']
                : ['#아내', '#나(방장)', '#아들', '#딸'];

              return (
                <div
                  key={cluster.clusterId}
                  className={`w-full min-w-0 rounded-xl p-3 bg-zinc-900/90 border transition-all flex flex-col justify-between gap-2.5 relative ${
                    isRegistered
                      ? 'border-primary-container/50'
                      : cluster.isCompanionDiscovered
                      ? 'border-amber-400/45 bg-gradient-to-b from-amber-950/20 to-zinc-900/90'
                      : 'border-white/10'
                  }`}
                >
                  {/* 상단: AI가 자동 묶어둔 연도·조건 배지 + 우측 [✕ 제외] */}
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1 min-w-0 flex-wrap">
                      {cluster.isCompanionDiscovered && !isRegistered ? (
                        <span className="px-1.5 py-0.5 rounded bg-amber-400/20 border border-amber-400/40 text-amber-300 font-label-sm text-[9.5px] font-extrabold">
                          ✨ 동반 등장 새 인물
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-zinc-950 border border-white/10 text-emerald-300 font-mono text-[9.5px] font-bold truncate">
                          {yearlyCuts
                            .map(
                              (yc) =>
                                `'${String(yc.year).slice(-2)}${yc.conditionShortKo ? `·${yc.conditionShortKo}` : ''}`
                            )
                            .join(' + ')}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => void excludeFaceCluster(cluster.clusterId)}
                      title="무관한 행인 얼굴 1초 제외"
                      className="px-1.5 py-0.5 rounded bg-zinc-950/90 hover:bg-red-950/60 border border-white/10 hover:border-red-400/40 text-zinc-400 hover:text-red-300 font-label-sm text-[9.5px] font-medium transition-colors shrink-0"
                    >
                      ✕
                    </button>
                  </div>

                  {/* 메인 동그란 아바타 + 옆에 겹쳐진 다년도·다각도 미니 서브 아바타 스택 배지 (Avatar Stack Badge) */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative flex items-center shrink-0">
                      {/* 메인(당해 연도 정면) 아바타 */}
                      <div className="relative z-20">
                        <AutonomousCanvasFaceAvatar
                          photoFile={activeCut.representativePhoto}
                          boundingBox={activeCut.boundingBox}
                          fallbackAvatarUrl={activeCut.avatarUrl || activeCut.cropUrl}
                          altText={cluster.registeredName || cluster.appearanceLabelKo}
                          isHighlighted={isRegistered}
                          sizeClass="w-12 h-12"
                        />
                        <span className="absolute -bottom-1 left-0 px-1 py-0.1 rounded bg-primary-container text-zinc-950 font-mono text-[8px] font-extrabold shadow">
                          &apos;{String(activeCut.year).slice(-2)} {activeCut.conditionShortKo || '정면'}
                        </span>
                      </div>

                      {/* 알고리즘이 자동으로 찾아 묶어둔 다른 연도·각도(측면/야외/선글라스) 미니 서브 아바타 2~3개 겹침 표시 */}
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
                          title={`AI 자동 결합 시드: ${behindCut.year}년 ${behindCut.conditionTag || behindCut.conditionShortKo || '측면·야외'} 베스트 컷 (${behindCut.representativeDate})`}
                          style={{ zIndex: 15 - sIdx }}
                          className="relative -ml-3.5 opacity-90 hover:opacity-100 hover:scale-105 transition-all cursor-pointer"
                        >
                          <AutonomousCanvasFaceAvatar
                            photoFile={behindCut.representativePhoto}
                            boundingBox={behindCut.boundingBox}
                            fallbackAvatarUrl={behindCut.avatarUrl || behindCut.cropUrl}
                            altText={`${behindCut.year}년 ${behindCut.conditionShortKo || '측면'} 베스트 컷`}
                            isHighlighted={false}
                            sizeClass="w-9 h-9"
                          />
                          <span className="absolute -bottom-1 right-0 px-1 py-0.1 rounded bg-zinc-950/95 border border-white/25 text-zinc-200 font-mono text-[7.5px] font-bold whitespace-nowrap">
                            &apos;{String(behindCut.year).slice(-2)}{behindCut.conditionShortKo ? ` ${behindCut.conditionShortKo.slice(0, 2)}` : ''}
                          </span>
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-1 min-w-0">
                        <p className="font-label-sm text-[12.5px] text-white font-bold truncate">
                          {cluster.registeredName
                            ? cluster.registeredName
                            : cluster.isCompanionDiscovered
                            ? '새 동반 멤버'
                            : cluster.roleHintKo}
                        </p>
                        {isRegistered && (
                          <span className="px-1 py-0.2 rounded bg-primary-container/15 text-primary-container font-label-sm text-[9px] font-bold shrink-0">
                            ✓멀티시드
                          </span>
                        )}
                      </div>
                      <p className="font-body-sm text-[10.5px] text-zinc-400 truncate mt-0.5">
                        {cluster.isCompanionDiscovered && !isRegistered
                          ? cluster.coOccurredWithSummary || '멤버와 6회 동반 등장'
                          : `사진 ${cluster.matchedPhotoCount}장${
                              cluster.matchedVideoSegmentCount > 0
                                ? ` · 영상 ${cluster.matchedVideoSegmentCount}구간`
                                : ''
                            }`}
                      </p>
                      <p className="font-mono text-[9.5px] text-zinc-500 truncate">
                        {yearlyCuts.length}종 각도·연도 자동결합
                      </p>
                    </div>
                  </div>

                  {/* 미등록 카드일 때 원터치 관계 칩 제공 */}
                  {!isRegistered && (
                    <div className="flex items-center gap-1 flex-wrap">
                      {quickRoleChips.map((chip) => {
                        const cleanChip = chip.replace(/^#/, '');
                        return (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => void handleSaveMember(cluster, cleanChip)}
                            className="px-1.5 py-0.5 rounded bg-zinc-950 hover:bg-zinc-800 border border-white/10 text-zinc-300 font-label-sm text-[10px]"
                          >
                            {chip}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* 오직 이름 입력 + [등록] 원터치로 시드 확정 & 전 멤버 0.04초 역스캔 100% 전자동 완결! */}
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
                      placeholder={
                        cluster.isCompanionDiscovered
                          ? '새 멤버 이름 입력'
                          : '이름 입력 (예: 은숙)'
                      }
                      className="min-w-0 flex-1 h-8 px-2 rounded-lg bg-zinc-950 border border-white/10 focus:border-primary-container outline-none font-body-sm text-[11.5px] text-white placeholder:text-zinc-500"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSaveMember(cluster)}
                      className="h-8 px-2.5 rounded-lg bg-primary-container text-zinc-950 font-label-sm text-[11.5px] font-extrabold shrink-0 hover:opacity-95"
                    >
                      {justSavedId === cluster.clusterId ? '역스캔완료!' : '등록'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 👑 [3단 집단지성 프로토콜 - 3단계 호스트(방장) 뒷정리] 할머니·멤버가 패스하고 넘어간 누락 연도/각도 컷 원터치 마감 바 */}
          {hostCleanupQueue.length > 0 && (
            <div className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-amber-950/35 via-zinc-900 to-zinc-900 border border-amber-400/35 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                <span className="px-2 py-0.5 rounded bg-amber-400 text-zinc-950 font-label-sm text-[10.5px] font-extrabold shrink-0">
                  👑 호스트 누락분 뒷정리 ({hostCleanupQueue.length}건)
                </span>
                <div className="flex items-center -space-x-2 shrink-0">
                  {hostCleanupQueue.map((cand) => (
                    <div key={cand.candidateId} className="relative" title={`${cand.suggestedMemberName} (${cand.conditionBadgeKo})`}>
                      <AutonomousCanvasFaceAvatar
                        photoFile={cand.sourcePhoto}
                        boundingBox={cand.boundingBox}
                        fallbackAvatarUrl={cand.cropUrl}
                        altText={cand.suggestedMemberName}
                        isHighlighted={false}
                        sizeClass="w-7 h-7"
                      />
                    </div>
                  ))}
                </div>
                <span className="font-body-sm text-[11.5px] text-zinc-200 truncate">
                  할머니·멤버가 <strong className="text-amber-300">[그냥 사진만 올리기 / 패스]</strong>한 사진 속에서 찾은{' '}
                  <strong className="text-white">
                    {hostCleanupQueue
                      .map((c) => `${c.suggestedMemberName}(${c.conditionBadgeKo})`)
                      .join(', ')}
                  </strong>{' '}
                  베스트 컷이 대기 중입니다.
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  disabled={retroScanRunning}
                  onClick={() => void runGlobalSwarmRetroScanAll()}
                  className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-zinc-950 font-label-sm text-[11.5px] font-extrabold transition-all"
                >
                  {retroScanRunning
                    ? '0.04초 역스캔 중...'
                    : `✓ 누락분 ${hostCleanupQueue.length}건 일괄 등록 (원터치 마감)`}
                </button>
              </div>
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

              {lastRetroScanReport && (
                <span className="font-mono text-[10.5px] text-emerald-300 shrink-0">
                  ✓ {lastRetroScanReport.timestampText} · 호스트+{lastRetroScanReport.rescuedHostPhotos}장 / 멤버폰+{lastRetroScanReport.rescuedMemberPhonePhotos}장 매칭됨
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * [3단 집단지성 프로토콜 & 호스트 누락분 총점검 모달]
 * 1단계 (일반 멤버 참여 모드): 사진 추가 시 "🎯 방금 올린 사진에서 [멤버명]님의 새로운 연도/각도 베스트 컷을 찾았어요!" ➔ 원터치 [등록]
 * 2단계 (노약자·디지털 약자 배려): 고민 없는 [그냥 사진만 올리기 / 패스] ➔ 사진은 즉시 정상 업로드 & 후보 데이터는 호스트 뒷정리 대기열로 자동 이관
 * 3단계 (호스트 방장 총점검 뒷정리): 전체 멤버의 다년도·다각도(정면·측면·야외·선글라스) 시드 현황 점검 & [누락분 일괄 등록] 원터치 마감
 */
export const FaceMemberRegistryModal: React.FC = () => {
  const {
    showFaceRegistryModal,
    setShowFaceRegistryModal,
    faceClusters,
    globalSeedVersion,
    retroScanRunning,
    lastRetroScanReport,
    swarmFaceCandidates,
    registerFaceMember,
    excludeFaceCluster,
    restoreExcludedFaceClusters,
    applySwarmFaceCandidate,
    passSwarmFaceCandidateToHostQueue,
    passAllSwarmCandidatesToHostQueue,
    runGlobalSwarmRetroScanAll,
    setSearchSpace,
    runTextQuery,
  } = useSaySeeStore();

  const [selectedYearMap, setSelectedYearMap] = useState<Record<string, number>>({});
  const [modalDraftNames, setModalDraftNames] = useState<Record<string, string>>({});

  const visibleClusters = useMemo(
    () => faceClusters.filter((c) => !c.excludedAsPasserby),
    [faceClusters]
  );

  // 1·2단계: 방금 멤버가 사진을 올릴 때 뜨는 AI 추가 힌트 (아직 패스하지 않은 후보)
  const memberActiveHints = useMemo(
    () => swarmFaceCandidates.filter((c) => !c.applied && !c.passedToHostQueue),
    [swarmFaceCandidates]
  );

  // 3단계: 할머니·멤버가 패스했거나 아직 시드에 흡수되지 않은 호스트 뒷정리 대기열 전체
  const hostCleanupItems = useMemo(
    () => swarmFaceCandidates.filter((c) => !c.applied),
    [swarmFaceCandidates]
  );

  useEffect(() => {
    const map: Record<string, string> = {};
    for (const c of faceClusters) {
      map[c.clusterId] = c.registeredName || '';
    }
    setModalDraftNames(map);
  }, [faceClusters]);

  if (!showFaceRegistryModal) return null;

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
                3단 집단지성 프로토콜 · Global Seed v{globalSeedVersion}
              </span>
              <h2 className="font-headline-sm text-[17px] md:text-[18px] text-white font-extrabold">
                다년도·다각도 자동 시드 &amp; 호스트 누락분 총점검 센터
              </h2>
            </div>
            <p className="font-body-sm text-[12px] text-zinc-400">
              ① 일반 멤버는 원터치 [등록]으로 돕고 ➔ ② 할머니·바쁜 멤버는 고민 없이 [패스]하고 ➔ ③ 빠진 건 호스트가 [누락분 일괄 등록]으로 100% 완성합니다.
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
        <div className="p-6 overflow-y-auto flex flex-col gap-5">
          {/* 1단계 & 2단계: 멤버 사진 추가 시 'AI 추가 힌트' 원터치 [등록] vs 노약자 고민 없는 [그냥 사진만 올리기 / 패스] */}
          <section className="rounded-xl bg-zinc-900/80 border border-primary-container/30 p-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-primary-container/20 text-primary-container font-label-sm text-[10.5px] font-extrabold">
                    1단계 (일반 멤버 참여) &amp; 2단계 (노약자 자동 패스)
                  </span>
                  <h3 className="font-label-md text-[14px] text-white font-bold">
                    멤버가 사진을 올릴 때 뜨는 ‘원터치 AI 힌트’ (패스해도 호스트 대기열에 100% 보존)
                  </h3>
                </div>
                <p className="font-body-sm text-[12px] text-zinc-400 mt-0.5">
                  참여하고 싶은 멤버는 <strong>[등록]</strong> 한 번으로 시드 규칙을 자연스럽게 배우고, 할머니나 바쁜 멤버는 고민 없이 <strong>[그냥 사진만 올리기 / 패스]</strong>를 누르면 됩니다.
                </p>
              </div>

              {memberActiveHints.length > 0 && (
                <button
                  type="button"
                  onClick={() => passAllSwarmCandidatesToHostQueue()}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-white/15 text-zinc-200 font-label-sm text-[11.5px] font-bold shrink-0"
                >
                  👵 노약자 모드: 그냥 사진만 올리기 / 전체 패스 (호스트 대기열로 이관)
                </button>
              )}
            </div>

            {memberActiveHints.length === 0 ? (
              <div className="p-3 rounded-xl bg-zinc-950/80 border border-white/10 text-zinc-300 font-body-sm text-[12px] flex items-center justify-between">
                <span>
                  ✓ 현재 멤버 업로드 화면의 AI 힌트가 모두 처리되었습니다. (패스된 항목은 아래 3단계 호스트 뒷정리 대기열로 안전하게 이관되었습니다.)
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {memberActiveHints.map((cand) => (
                  <div
                    key={cand.candidateId}
                    className="p-3.5 rounded-xl bg-zinc-950 border border-white/10 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <AutonomousCanvasFaceAvatar
                        photoFile={cand.sourcePhoto}
                        boundingBox={cand.boundingBox}
                        fallbackAvatarUrl={cand.cropUrl}
                        altText={cand.suggestedMemberName}
                        isHighlighted={true}
                        sizeClass="w-13 h-13"
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="font-mono text-[10px] text-zinc-400">
                          {cand.contributorLabel}
                        </span>
                        <p className="font-label-sm text-[12.5px] text-white font-bold leading-snug mt-0.5">
                          🎯 방금 올린 사진에서 <span className="text-primary-container">{cand.suggestedMemberName}</span>님의 새로운 연도/각도(<span className="text-amber-300">{cand.conditionBadgeKo}</span>) 베스트 컷을 찾았어요!
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={retroScanRunning}
                        onClick={() => void applySwarmFaceCandidate(cand.candidateId)}
                        className="px-3 py-1.5 rounded-lg bg-primary-container text-zinc-950 font-label-sm text-[11.5px] font-extrabold hover:opacity-95"
                      >
                        등록
                      </button>
                      <button
                        type="button"
                        onClick={() => passSwarmFaceCandidateToHostQueue(cand.candidateId)}
                        className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-400 hover:text-zinc-200 font-label-sm text-[10.5px]"
                      >
                        그냥 넘어가기(패스)
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 3단계: 호스트(방장)의 권한과 뒷정리 — 누락 연도·조건 총점검 & 원터치 마감 */}
          <section className="rounded-xl bg-zinc-900/80 border border-amber-400/35 p-4 flex flex-col gap-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-amber-400 text-zinc-950 font-label-sm text-[10.5px] font-extrabold">
                    3단계 (호스트 방장 전용 뒷정리 대기열)
                  </span>
                  <h3 className="font-label-md text-[14px] text-white font-bold">
                    할머니·멤버가 패스한 사진 속 얼굴 &amp; 누락 연도·각도 원터치 총점검
                  </h3>
                </div>
                <p className="font-body-sm text-[12px] text-zinc-400 mt-0.5">
                  할머니가 아무것도 안 누르고 올린 사진 속 얼굴 후보까지 버리지 않고 이곳에 모아둡니다. 방장이 <strong>[누락분 일괄 등록]</strong> 한 번만 누르면 100% 시드에 흡수됩니다.
                </p>
              </div>

              <button
                type="button"
                disabled={retroScanRunning}
                onClick={() => void runGlobalSwarmRetroScanAll()}
                className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-zinc-950 font-label-sm text-[12px] font-extrabold shrink-0 shadow"
              >
                {retroScanRunning
                  ? '⏳ 전 멤버 폰 0.04초 역스캔 중...'
                  : hostCleanupItems.length > 0
                  ? `✓ 누락분 ${hostCleanupItems.length}건 일괄 등록 & 전 멤버 0.04초 역스캔`
                  : '✓ 전 멤버 시드 100% 반영됨 (재검증 역스캔)'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {swarmFaceCandidates.map((cand) => (
                <div
                  key={`host_queue_${cand.candidateId}`}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-2.5 ${
                    cand.applied
                      ? 'bg-zinc-950/60 border-emerald-500/30'
                      : cand.passedToHostQueue
                      ? 'bg-amber-950/20 border-amber-400/40'
                      : 'bg-zinc-950 border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <AutonomousCanvasFaceAvatar
                      photoFile={cand.sourcePhoto}
                      boundingBox={cand.boundingBox}
                      fallbackAvatarUrl={cand.cropUrl}
                      altText={cand.suggestedMemberName}
                      isHighlighted={!cand.applied}
                      sizeClass="w-11 h-11"
                    />
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="font-label-sm text-[12px] text-white font-bold">
                          {cand.suggestedMemberName}
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-amber-300 font-mono text-[9.5px] font-bold">
                          {cand.conditionBadgeKo}
                        </span>
                      </div>
                      <span className="font-body-sm text-[10.5px] text-zinc-400 truncate">
                        {cand.contributorLabel}
                      </span>
                    </div>
                  </div>

                  {cand.applied ? (
                    <button
                      type="button"
                      onClick={() =>
                        void handleTriggerRealNameSearch(
                          cand.sampleSearchQuery,
                          cand.sampleSearchSpace
                        )
                      }
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 font-label-sm text-[10.5px] font-bold shrink-0"
                    >
                      ✓ 흡수됨
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={retroScanRunning}
                      onClick={() => void applySwarmFaceCandidate(cand.candidateId)}
                      className="px-3 py-1.5 rounded-lg bg-primary-container text-zinc-950 font-label-sm text-[11px] font-extrabold shrink-0"
                    >
                      등록
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* 전체 멤버 다년도·다각도(정면·측면·야외·선글라스) 시드 패키지 현황 */}
          <section className="rounded-xl bg-zinc-900/70 border border-white/10 p-4 flex flex-col gap-3">
            <div>
              <h3 className="font-label-md text-[14px] text-white font-bold">
                전체 멤버 ‘다년도·다각도(정면·측면·야외·선글라스) 멀티-조건 시드 패키지’ 현황
              </h3>
              <p className="font-body-sm text-[12px] text-zinc-400">
                이름을 확인하고 [등록]만 누르면 정면·측면·선글라스·과거 연도 시드가 한 번에 확정되며 전 멤버 폰을 0.04초 만에 역스캔합니다.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {visibleClusters.map((c) => {
                const yearlyCuts = getClusterYearlyCuts(c);
                const activeYear = selectedYearMap[c.clusterId] ?? yearlyCuts[0].year;
                const activeCut =
                  yearlyCuts.find((yc) => yc.year === activeYear) ?? yearlyCuts[0];
                const stackedBehindCuts = yearlyCuts.filter((yc) => yc.year !== activeCut.year);
                const draftVal = modalDraftNames[c.clusterId] ?? '';

                return (
                  <div
                    key={c.clusterId}
                    className="rounded-xl p-3.5 bg-zinc-950/90 border border-white/10 flex flex-col gap-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative flex items-center shrink-0">
                          <div className="relative z-20">
                            <AutonomousCanvasFaceAvatar
                              photoFile={activeCut.representativePhoto}
                              boundingBox={activeCut.boundingBox}
                              fallbackAvatarUrl={activeCut.avatarUrl || activeCut.cropUrl}
                              altText={c.registeredName || c.appearanceLabelKo}
                              isHighlighted={Boolean(c.registeredName)}
                              sizeClass="w-14 h-14"
                            />
                          </div>
                          {stackedBehindCuts.map((behindCut, sIdx) => (
                            <button
                              key={behindCut.year}
                              type="button"
                              onClick={() =>
                                setSelectedYearMap((prev) => ({
                                  ...prev,
                                  [c.clusterId]: behindCut.year,
                                }))
                              }
                              style={{ zIndex: 15 - sIdx }}
                              className="relative -ml-3.5 opacity-90 hover:opacity-100 transition-all"
                              title={`${behindCut.year}년 ${behindCut.conditionShortKo || '측면'} 베스트 컷`}
                            >
                              <AutonomousCanvasFaceAvatar
                                photoFile={behindCut.representativePhoto}
                                boundingBox={behindCut.boundingBox}
                                fallbackAvatarUrl={behindCut.avatarUrl || behindCut.cropUrl}
                                altText={`${behindCut.year}년 컷`}
                                isHighlighted={false}
                                sizeClass="w-10 h-10"
                              />
                            </button>
                          ))}
                        </div>

                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1 flex-wrap">
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
                                className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold transition-all ${
                                  yc.year === activeCut.year
                                    ? 'bg-primary-container text-zinc-950 font-extrabold'
                                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                                }`}
                              >
                                {yc.year}년 · {yc.conditionShortKo || '정면'}
                              </button>
                            ))}
                          </div>
                          <span className="font-label-md text-[13.5px] text-white font-bold mt-1 truncate">
                            {c.registeredName || `${c.roleHintKo} (미등록)`}
                          </span>
                          <span className="font-body-sm text-[11px] text-zinc-400 truncate">
                            매칭 사진 {c.matchedPhotoCount}장 · 영상 {c.matchedVideoSegmentCount}구간
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => void excludeFaceCluster(c.clusterId)}
                        className="px-2 py-1 rounded bg-zinc-900 hover:bg-red-950/60 border border-white/10 text-zinc-400 hover:text-red-300 font-label-sm text-[10.5px] shrink-0"
                      >
                        ✕ 제외
                      </button>
                    </div>

                    <div className="flex items-center gap-2 min-w-0">
                      <input
                        type="text"
                        value={draftVal}
                        onChange={(e) =>
                          setModalDraftNames((prev) => ({
                            ...prev,
                            [c.clusterId]: e.target.value,
                          }))
                        }
                        placeholder="이름 입력 후 [등록] 원터치"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            void registerFaceMember(c.clusterId, draftVal, '');
                          }
                        }}
                        className="min-w-0 flex-1 h-8 px-2.5 rounded-lg bg-zinc-900 border border-white/10 focus:border-primary-container text-white font-body-sm text-[12px] outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => void registerFaceMember(c.clusterId, draftVal, '')}
                        className="h-8 px-3 rounded-lg bg-primary-container text-zinc-950 font-label-sm text-[11.5px] font-extrabold shrink-0"
                      >
                        등록
                      </button>
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
            {lastRetroScanReport && (
              <span className="font-mono text-[11px] text-emerald-300">
                ✓ {lastRetroScanReport.triggerTitle}
              </span>
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
