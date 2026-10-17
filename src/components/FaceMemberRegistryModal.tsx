import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';
import type { FaceMemberCluster, FaceRelationshipChip } from '../types/saysee';

const RELATIONSHIP_CHIPS: FaceRelationshipChip[] = [
  '#나(방장)',
  '#아내',
  '#남편',
  '#자녀',
  '#부모님',
  '#친구',
];

/**
 * 실제 원본 이미지에서 검출된 얼굴 Bounding Box [ymin, xmin, ymax, xmax] (0..1000) 좌표를
 * 브라우저 HTML5 <canvas>로 직접 오려내어 원형 아바타로 렌더링하는 자율 캔버스 크롭 컴포넌트
 */
export const AutonomousCanvasFaceAvatar: React.FC<{
  cluster: FaceMemberCluster;
  sizeClass?: string;
}> = ({ cluster, sizeClass = 'w-16 h-16' }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled || !canvasRef.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const imgW = img.naturalWidth || 1000;
      const imgH = img.naturalHeight || 1000;
      const [ymin, xmin, ymax, xmax] = cluster.boundingBox ?? [200, 200, 600, 600];

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
    img.src = `/__photos/file?p=${encodeURIComponent(cluster.representativePhoto)}`;
    return () => {
      cancelled = true;
    };
  }, [cluster.representativePhoto, cluster.boundingBox]);

  return (
    <div
      className={`relative ${sizeClass} rounded-full overflow-hidden bg-zinc-900 border-2 ${
        cluster.registeredName
          ? 'border-primary-container shadow-[0_0_12px_rgba(32,247,219,0.28)]'
          : 'border-white/20'
      } shrink-0`}
    >
      {/* 서버 sharp 크롭 아바타 즉시 표시 + Canvas 실시간 픽셀 크롭 완료 시 오버레이 */}
      <img
        src={cluster.avatarUrl || cluster.cropUrl}
        alt={cluster.registeredName || cluster.appearanceLabelKo}
        className="w-full h-full object-cover"
      />
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${
          canvasReady ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
};

/**
 * [Step 1 인라인 바] 파워 검색 상단에 배치되어 방장이 1초 만에 얼굴에 이름을 붙이고
 * 즉시 "[이름] 선글라스", "[이름] 바다", "[이름] 하트 목걸이(동영상)" 실명 검색을 체험하는 컴포넌트
 */
export const FaceMemberInlineBar: React.FC<{
  onRunRealNameQuery: (query: string, targetSpace: 'gallery' | 'video') => void;
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

  const handleSaveMember = async (cluster: FaceMemberCluster, nextName?: string, nextChip?: string) => {
    const finalName = (nextName !== undefined ? nextName : draftNames[cluster.clusterId] ?? '').trim();
    const finalChip = nextChip !== undefined ? nextChip : cluster.relationshipTag || cluster.suggestedChip;
    await registerFaceMember(cluster.clusterId, finalName, finalChip);
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
            자율 얼굴 검출 · {latestCorpusYear}년 베스트 컷
          </span>
          <span className="font-label-md text-[12.5px] md:text-[13px] text-zinc-100 font-bold truncate">
            🎯 사진에서 {visibleClusters.length}명의 얼굴을 자동 추출했습니다 (당해 연도 베스트 컷 기준). 이름을 등록해 라운지 멤버로 추가할까요?
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
            <span>👥 라운지 초대 &amp; 얼굴 레이더 시드</span>
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
        <div className="p-4 flex flex-col gap-3.5 bg-zinc-950/50">
          {/* 가로 스크롤 얼굴 아바타 카드 리스트 */}
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
            {visibleClusters.map((cluster) => {
              const activeChip = cluster.relationshipTag || cluster.suggestedChip;
              const currentDraft = draftNames[cluster.clusterId] ?? '';
              const isRegistered = Boolean(cluster.registeredName.trim());

              return (
                <div
                  key={cluster.clusterId}
                  className={`min-w-[250px] max-w-[270px] rounded-xl p-3 bg-zinc-900/90 border transition-all flex flex-col gap-2.5 shrink-0 relative ${
                    isRegistered ? 'border-primary-container/50' : 'border-white/10'
                  }`}
                >
                  {/* 우측 상단 [✕ 행인 제외] 버튼 */}
                  <button
                    type="button"
                    onClick={() => void excludeFaceCluster(cluster.clusterId)}
                    title="무관한 행인 얼굴 1초 제외"
                    className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-zinc-950/90 hover:bg-red-950/60 border border-white/10 hover:border-red-400/40 text-zinc-400 hover:text-red-300 font-label-sm text-[10.5px] font-medium transition-colors"
                  >
                    ✕ 행인 제외
                  </button>

                  {/* 동그란 실제 크롭 아바타 + 당해 연도 베스트 컷 메타데이터 */}
                  <div className="flex items-center gap-3 pr-14">
                    <AutonomousCanvasFaceAvatar cluster={cluster} sizeClass="w-14 h-14" />
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-200 font-mono text-[10px] font-bold">
                          {cluster.representativeYear}년 대표컷
                        </span>
                        {isRegistered && (
                          <span className="px-1.5 py-0.5 rounded bg-primary-container/15 text-primary-container font-label-sm text-[10px] font-bold">
                            실명개통됨
                          </span>
                        )}
                      </div>
                      <p className="font-label-sm text-[12px] text-white font-bold truncate mt-1">
                        {cluster.registeredName
                          ? `${cluster.registeredName} (${activeChip})`
                          : cluster.appearanceLabelKo}
                      </p>
                      <p className="font-body-sm text-[11px] text-zinc-400 truncate">
                        사진 {cluster.matchedPhotoCount}장 · 영상 {cluster.matchedVideoSegmentCount}구간
                      </p>
                    </div>
                  </div>

                  {/* 빠른 이름 입력창 */}
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={currentDraft}
                      onChange={(e) =>
                        setDraftNames((prev) => ({
                          ...prev,
                          [cluster.clusterId]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void handleSaveMember(cluster);
                        }
                      }}
                      placeholder="이름 입력 (예: 진욱, 은숙, 천우)"
                      className="flex-1 h-8 px-2.5 rounded-lg bg-zinc-950 border border-white/10 focus:border-primary-container outline-none font-body-sm text-[12px] text-white placeholder:text-zinc-500"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSaveMember(cluster)}
                      className="h-8 px-2.5 rounded-lg bg-primary-container text-zinc-950 font-label-sm text-[11.5px] font-extrabold shrink-0 hover:opacity-95"
                    >
                      {justSavedId === cluster.clusterId ? '완료!' : '등록'}
                    </button>
                  </div>

                  {/* 원터치 호칭 칩 (#나(방장), #아내, #남편, #자녀, #부모님, #친구) */}
                  <div className="flex flex-wrap gap-1">
                    {RELATIONSHIP_CHIPS.map((chip) => {
                      const selected = activeChip === chip;
                      return (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => {
                            const defaultName =
                              currentDraft.trim() ||
                              cluster.registeredName ||
                              chip.replace(/^#|\(.*\)/g, '');
                            setDraftNames((prev) => ({
                              ...prev,
                              [cluster.clusterId]: defaultName,
                            }));
                            void handleSaveMember(cluster, defaultName, chip);
                          }}
                          className={`px-2 py-0.5 rounded-md font-label-sm text-[10.5px] transition-all border ${
                            selected
                              ? 'bg-zinc-800 text-primary-container border-primary-container/50 font-bold'
                              : 'bg-zinc-950/70 text-zinc-400 border-white/5 hover:text-zinc-200'
                          }`}
                        >
                          {chip}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 등록 즉시 활성화되는 실명 자연어 검색 (사진 + 동영상 초 단위 점프) 원터치 체험 바 */}
          {registeredClusters.length > 0 && (
            <div className="px-3.5 py-2.5 rounded-xl bg-zinc-900/90 border border-white/10 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-label-sm text-[11.5px] text-primary-container font-bold">
                  ⚡ 실명 자연어 검색 개통 완료 (0.04초 매칭):
                </span>
                {registeredClusters.map((rc) => {
                  const name = rc.registeredName.trim();
                  const isFemale = /여성|아내|여자/.test(`${rc.roleHintKo} ${rc.relationshipTag}`);
                  const isChild = /소년|아이|자녀/.test(`${rc.roleHintKo} ${rc.relationshipTag}`);
                  const photoQuery1 = isChild ? `${name} 박물관` : `${name} 선글라스`;
                  const photoQuery2 = `${name} 바다`;
                  const videoQuery = isFemale ? `${name} 하트 목걸이` : `${name} 보트`;

                  return (
                    <React.Fragment key={rc.clusterId}>
                      <button
                        type="button"
                        onClick={() => onRunRealNameQuery(photoQuery1, 'gallery')}
                        className="px-2.5 py-1 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-white/10 text-zinc-100 font-label-sm text-[11.5px] flex items-center gap-1"
                      >
                        <span>🖼️ “{photoQuery1}”</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onRunRealNameQuery(photoQuery2, 'gallery')}
                        className="px-2.5 py-1 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-white/10 text-zinc-100 font-label-sm text-[11.5px] flex items-center gap-1"
                      >
                        <span>🖼️ “{photoQuery2}”</span>
                      </button>
                      {rc.matchedVideoSegmentCount > 0 && (
                        <button
                          type="button"
                          onClick={() => onRunRealNameQuery(videoQuery, 'video')}
                          className="px-2.5 py-1 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-primary-container/40 text-primary-container font-label-sm text-[11.5px] font-bold flex items-center gap-1"
                        >
                          <span>🎬 “{videoQuery}” (동영상 구간 점프)</span>
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
 * - Step 1: 자율 얼굴 검출(Bounding Box 시각화) & 당해 연도 대표 1장 크롭 + 대표 사진 직접 선택 실시간 검출
 * - Step 2: 실명 자연어 검색(사진 + 동영상 타임라인 초 단위 포착) 즉시 연동 테스트
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
    setSelectedVideoModal,
    videoSceneItems,
  } = useSaySeeStore();

  const [selectedSamplePhoto, setSelectedSamplePhoto] = useState<string>('');
  const [radarSimulating, setRadarSimulating] = useState(false);
  const [radarComplete, setRadarComplete] = useState(true);

  const visibleClusters = useMemo(
    () => faceClusters.filter((c) => !c.excludedAsPasserby),
    [faceClusters]
  );

  const currentYearSamplePhotos = useMemo(
    () =>
      photos
        .filter((p) => !p.quarantined && p.name.startsWith(String(latestCorpusYear)))
        .slice(0, 12),
    [photos, latestCorpusYear]
  );

  if (!showFaceRegistryModal) return null;

  const handleRunLiveDetection = async () => {
    if (!selectedSamplePhoto) return;
    await detectFacesFromPhotoFile(selectedSamplePhoto);
  };

  const handleTriggerRealNameSearch = async (query: string, space: 'gallery' | 'video') => {
    setShowFaceRegistryModal(false);
    setSearchSpace(space);
    await runTextQuery(query);
  };

  const handleJumpToMemberVideoSegment = (videoId: string, seekSec: number) => {
    const found = videoSceneItems.find((v) => v.id === videoId);
    if (found) {
      setShowFaceRegistryModal(false);
      setSelectedVideoModal(found, seekSec);
    }
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
                자율 얼굴 검출(Face Crop) · 당해 연도 대표 멤버 등록 &amp; 초대 레이더 시드
              </h2>
            </div>
            <p className="font-body-sm text-[12px] text-zinc-400">
              실제 이미지의 얼굴 Bounding Box 좌표를 자동 검출하여 {latestCorpusYear}년 최선명 정면 1장을 동그란 아바타로 오려내고, 실명 검색과 친구 초대 레이더 시드에 실시간 연동합니다.
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
          {/* Step 1: 당해 연도 대표 얼굴 1장 자동 추출 & 실시간 사진 선택 검출 */}
          <section className="rounded-xl bg-zinc-900/70 border border-white/10 p-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-label-md text-[14px] text-white font-bold">
                  Step 1. 자율 얼굴 검출 &amp; {latestCorpusYear}년(당해 연도) 베스트 얼굴 1장 크롭
                </h3>
                <p className="font-body-sm text-[12px] text-zinc-400">
                  동일 인물이 여러 장에 찍힌 경우 촬영 연도(최신순) · 정면 비율 · 광학 선명도가 가장 높은 단 1장의 Bounding Box만 원형 아바타로 추출합니다.
                </p>
              </div>

              {/* 방장이 직접 갤러리 사진을 골라 실시간 얼굴 검출을 추가 실행할 수 있는 컨트롤 */}
              <div className="flex items-center gap-2">
                <select
                  value={selectedSamplePhoto}
                  onChange={(e) => setSelectedSamplePhoto(e.target.value)}
                  className="h-9 px-3 rounded-lg bg-zinc-950 border border-white/10 text-zinc-200 font-body-sm text-[12px] outline-none"
                >
                  <option value="">대표 사진 추가 선택 ({latestCorpusYear}년 촬영본)...</option>
                  {currentYearSamplePhotos.map((p) => (
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

            {/* 검출된 각 인물 클러스터 상세 카드 (원본 Bounding Box 좌표 & 동영상 타임라인 매칭 구간 표시) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
              {visibleClusters.map((c) => {
                const activeChip = c.relationshipTag || c.suggestedChip;
                return (
                  <div
                    key={c.clusterId}
                    className="rounded-xl p-3.5 bg-zinc-950/90 border border-white/10 flex flex-col gap-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <AutonomousCanvasFaceAvatar cluster={c} sizeClass="w-16 h-16" />
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded bg-zinc-800 text-primary-container font-mono text-[10.5px] font-bold">
                              {c.representativeYear}년 베스트 · 정면 {Math.round(c.frontalScore * 100)}%
                            </span>
                            <span className="font-mono text-[10.5px] text-zinc-500">
                              Box [{c.boundingBox.join(', ')}]
                            </span>
                          </div>
                          <span className="font-label-md text-[13.5px] text-white font-bold mt-1">
                            {c.registeredName
                              ? `${c.registeredName} (${activeChip})`
                              : `${c.appearanceLabelKo} (미등록)`}
                          </span>
                          <span className="font-body-sm text-[11.5px] text-zinc-400">
                            원본: {c.representativePhoto} · 매칭 사진 {c.matchedPhotoCount}장 · 영상 {c.matchedVideoSegmentCount}구간
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

                    {/* 이름 & 호칭 즉시 수정 */}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        defaultValue={c.registeredName}
                        placeholder="이름 입력 (예: 진욱, 은숙, 천우)"
                        onBlur={(e) =>
                          void registerFaceMember(c.clusterId, e.target.value, activeChip)
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            void registerFaceMember(
                              c.clusterId,
                              (e.target as HTMLInputElement).value,
                              activeChip
                            );
                          }
                        }}
                        className="flex-1 h-8 px-2.5 rounded-lg bg-zinc-900 border border-white/10 focus:border-primary-container text-white font-body-sm text-[12px] outline-none"
                      />
                      <div className="flex gap-1 flex-wrap">
                        {RELATIONSHIP_CHIPS.slice(0, 4).map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() =>
                              void registerFaceMember(
                                c.clusterId,
                                c.registeredName || chip.replace(/^#|\(.*\)/g, ''),
                                chip
                              )
                            }
                            className={`px-2 py-1 rounded font-label-sm text-[10.5px] border ${
                              activeChip === chip
                                ? 'bg-primary-container text-zinc-950 border-primary-container font-bold'
                                : 'bg-zinc-900 text-zinc-400 border-white/10'
                            }`}
                          >
                            {chip}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 해당 인물이 등장하는 동영상 타임라인 초(Sec) 구간 바로가기 */}
                    {c.matchedVideoSegments.length > 0 && (
                      <div className="pt-2 border-t border-white/5 flex flex-col gap-1.5">
                        <span className="font-label-sm text-[11px] text-zinc-400">
                          🎬 이 얼굴이 포착된 동영상 타임라인 구간 ({c.matchedVideoSegments.length}곳):
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {c.matchedVideoSegments.slice(0, 3).map((seg) => (
                            <button
                              key={`${seg.videoId}_${seg.timeSec}`}
                              type="button"
                              onClick={() => handleJumpToMemberVideoSegment(seg.videoId, seg.timeSec)}
                              className="px-2 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-200 font-label-sm text-[11px] flex items-center gap-1"
                            >
                              <span className="text-primary-container font-bold">
                                🎯 {seg.timestampText}
                              </span>
                              <span className="truncate max-w-[140px]">{seg.phaseLabel}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
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
                            `${c.registeredName || c.relationshipTag.replace(/^#|\(.*\)/g, '') || '선글라스'} 바다`,
                            'gallery'
                          )
                        }
                        className="flex-1 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-200 font-label-sm text-[11px]"
                      >
                        🔍 사진 매칭 보기
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void handleTriggerRealNameSearch(
                            `${c.registeredName || c.relationshipTag.replace(/^#|\(.*\)/g, '') || '하트'} 목걸이`,
                            'video'
                          )
                        }
                        className="flex-1 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-primary-container/30 text-primary-container font-label-sm text-[11px] font-bold"
                      >
                        🎬 영상 매칭 보기
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
