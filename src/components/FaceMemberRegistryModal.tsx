import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getActivePersonaForCluster, useSaySeeStore } from '../store/useSaySeeStore';
import type { FaceMemberCluster, RoomPersonaMap, YearlyFaceBestCut } from '../types/saysee';

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

const ROOM_PERSONA_KEYS: Array<{
  key: keyof RoomPersonaMap;
  label: string;
  shortLabel: string;
}> = [
  { key: '우리집', label: '🏠 우리집', shortLabel: '우리집' },
  { key: '처가(친정)', label: '🏡 처가(친정)', shortLabel: '처가방' },
  { key: '본가(친가)', label: '🏛️ 본가(친가)', shortLabel: '본가방' },
  { key: 'club', label: '⛳ 클럽방', shortLabel: '클럽방' },
  { key: 'student', label: '🎒 10대 학생방', shortLabel: '학생방' },
];

/**
 * [Step 1 인라인 바] 전체 갤러리(사진) 및 라운지 상단 얼굴 등록 & 세이씨 여권(SaySee Face Passport) 바
 * 1. 인물별 독립 타임라인 바구니 (성인 10년 / 미성년 5년 + 신작 유입 시 미래 연도 바구니 자동 확장 + 26년/29년 시차 독립 작동)
 * 2. "시드를 가져올까요?" 질문 UI 제로 ➔ 이메일(Email ID) 기반 만국공통 [🛂 세이씨 여권 자동 연동됨] 0.1초 무질문 장착
 * 3. 시드(768차원 벡터 + 연도 바구니)는 100% 공유하되, 방별 별명(Room Persona: 우리집 '멀린' ↔ 처가방 '둘째사위' ↔ 학생방 '지우짱')만 독립 매핑
 * 4. 크로스-라운지 집단지성 자율 진화 (타 방 신작 시드가 전 라운지에 실시간 전파)
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
    activeLoungeType,
    activeFamilyRoom,
    setActiveLoungeType,
    setActiveFamilyRoom,
    registerFaceMember,
    excludeFaceCluster,
    restoreExcludedFaceClusters,
    setShowFaceRegistryModal,
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

  // 현재 방(우리집 / 처가 / 본가 / 클럽 / 학생 / 개인)에 맞는 호칭(Room Persona)으로 입력창 동기화
  useEffect(() => {
    const map: Record<string, string> = {};
    for (const c of faceClusters) {
      const { activePersona } = getActivePersonaForCluster(c, activeLoungeType, activeFamilyRoom);
      map[c.clusterId] = activePersona || '';
    }
    setDraftNames(map);
  }, [faceClusters, activeLoungeType, activeFamilyRoom]);

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

  const activeRoomDisplayLabel =
    activeLoungeType === 'family'
      ? `👨‍👩‍👧‍👦 ${activeFamilyRoom}`
      : activeLoungeType === 'club'
      ? '⛳ 클럽 라운지'
      : activeLoungeType === 'student'
      ? '🎒 10대 학생 라운지'
      : '👤 개인 라운지';

  return (
    <div className="w-full rounded-2xl bg-[#18181B] border border-white/10 overflow-hidden transition-all">
      {/* 상단 요약 헤더: [🛂 세이씨 여권 자동 연동됨] + 인물별 고유 타임라인 바구니 + 방별 호칭(Room Persona) 무질문 자동 장착 */}
      <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 border-b border-white/5">
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="flex items-center gap-2 text-left min-w-0 flex-1 flex-wrap"
        >
          <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/35 text-emerald-300 font-label-sm text-[11px] font-extrabold shrink-0 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            🛂 세이씨 여권 자동 연동됨
          </span>
          <span className="px-2 py-0.5 rounded-md bg-zinc-900 border border-white/10 text-primary-container font-mono text-[10.5px] font-bold shrink-0">
            인물별 고유 바구니(성인10년·미성년5년 ↪ 미래연도 자동확장)
          </span>
          <span className="font-label-md text-[12px] md:text-[12.5px] text-zinc-100 font-bold truncate">
            새 방 입장 시 질문 없이 0.1초 시드 자동 장착 · 시드는 100% 공유하고 현재 방({activeRoomDisplayLabel}) 전용 호칭만 독립 매핑!
          </span>
        </button>

        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
          {/* 방별 호칭(Room Persona) 0.1초 자동 전환 테스트 탭 (질문 팝업 없이 즉시 호칭·검색어 전환 확인) */}
          <div className="hidden xl:flex items-center gap-1 bg-zinc-950/90 p-1 rounded-lg border border-white/10">
            <span className="text-[10px] text-zinc-400 font-bold px-1.5">방별 별명 전환:</span>
            {(
              [
                { label: '🏠 우리집(멀린)', lounge: 'family', room: '우리집' },
                { label: '🏡 처가방(둘째사위)', lounge: 'family', room: '처가(친정)' },
                { label: '🏛️ 본가방(큰아들)', lounge: 'family', room: '본가(친가)' },
                { label: '🎒 학생방(지우짱)', lounge: 'student', room: '우리집' },
              ] as const
            ).map((sw) => {
              const isSelected =
                sw.lounge === activeLoungeType &&
                (sw.lounge !== 'family' || sw.room === activeFamilyRoom);
              return (
                <button
                  key={sw.label}
                  type="button"
                  onClick={() => {
                    setActiveLoungeType(sw.lounge);
                    if (sw.lounge === 'family') {
                      setActiveFamilyRoom(sw.room);
                    }
                  }}
                  className={`px-2 py-0.5 rounded text-[10.5px] font-bold transition-all ${
                    isSelected
                      ? 'bg-primary-container text-zinc-950 font-extrabold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {sw.label}
                </button>
              );
            })}
          </div>

          {excludedCount > 0 && (
            <button
              type="button"
              onClick={() => void restoreExcludedFaceClusters()}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-400 hover:text-zinc-200 font-label-sm text-[11px]"
            >
              제외 {excludedCount}명 복원
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowFaceRegistryModal(true)}
            className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-200 font-label-sm text-[11.5px] font-bold flex items-center gap-1"
          >
            <span>🛂 여권 바구니 &amp; 호스트 총점검</span>
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
          {/* 기본 멤버(2026년 세팅) + 2029년 신규 합류 멤버(고유 바구니 2029~2020) 카드 그리드 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {visibleClusters.map((cluster) => {
              const { activePersona, baseName, activeRoomKey } = getActivePersonaForCluster(
                cluster,
                activeLoungeType,
                activeFamilyRoom
              );
              const currentDraft = draftNames[cluster.clusterId] ?? '';
              const isRegistered = Boolean(baseName.trim() || activePersona.trim());
              const yearlyCuts = getClusterYearlyCuts(cluster);
              const activeYear = selectedYearMap[cluster.clusterId] ?? yearlyCuts[0].year;
              const activeCut =
                yearlyCuts.find((c) => c.year === activeYear) ?? yearlyCuts[0];
              const stackedBehindCuts = yearlyCuts.filter((c) => c.year !== activeCut.year);
              const bucket = cluster.timelineBucket;

              const quickRoleChips = cluster.isCompanionDiscovered
                ? ['처남(29년합류)', '막내사위', '사촌', '조카']
                : ['#아내', '#둘째사위', '#아들', '#딸'];

              return (
                <div
                  key={cluster.clusterId}
                  className={`w-full min-w-0 rounded-xl p-3 bg-zinc-900/90 border transition-all flex flex-col justify-between gap-2 relative ${
                    isRegistered
                      ? 'border-primary-container/50'
                      : cluster.isCompanionDiscovered
                      ? 'border-amber-400/45 bg-gradient-to-b from-amber-950/20 to-zinc-900/90'
                      : 'border-white/10'
                  }`}
                >
                  {/* 상단: [🛂 세이씨 여권] + 인물별 고유 연도 바구니 배지 + 우측 [✕ 제외] */}
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1 min-w-0 flex-wrap">
                      <span
                        title={`만국공통 세이씨 여권 ID: ${cluster.passportEmail || '자동연동'} · 질문 없이 모든 방에 0.1초 자동 장착`}
                        className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-400/35 text-emerald-300 font-mono text-[9px] font-extrabold truncate"
                      >
                        🛂 {cluster.passportEmail ? cluster.passportEmail.split('@')[0] : '여권연동'}
                      </span>
                      {bucket && (
                        <span
                          title={`기준 생성 연도: ${bucket.anchorCreationYear}년 (${bucket.ageCategoryLabel}) · 기본 바구니 ${bucket.primaryBucketRange} ↪ 신작 유입 시 미래 바구니 ${bucket.forwardBucketRange || ''} 자동 확장`}
                          className={`px-1.5 py-0.5 rounded font-mono text-[9px] font-bold truncate ${
                            bucket.anchorCreationYear >= 2029
                              ? 'bg-amber-400/20 border border-amber-400/40 text-amber-300'
                              : 'bg-zinc-950 border border-white/10 text-primary-container'
                          }`}
                        >
                          {bucket.primaryBucketRange}
                          {bucket.forwardBucketActive && bucket.forwardBucketRange
                            ? `↪${bucket.forwardBucketRange.slice(-2)}`
                            : ''}
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
                      <div className="relative z-20">
                        <AutonomousCanvasFaceAvatar
                          photoFile={activeCut.representativePhoto}
                          boundingBox={activeCut.boundingBox}
                          fallbackAvatarUrl={activeCut.avatarUrl || activeCut.cropUrl}
                          altText={activePersona || cluster.appearanceLabelKo}
                          isHighlighted={isRegistered}
                          sizeClass="w-12 h-12"
                        />
                        <span className="absolute -bottom-1 left-0 px-1 py-0.1 rounded bg-primary-container text-zinc-950 font-mono text-[8px] font-extrabold shadow">
                          &apos;{String(activeCut.year).slice(-2)} {activeCut.conditionShortKo || '정면'}
                        </span>
                      </div>

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
                            &apos;{String(behindCut.year).slice(-2)}
                            {behindCut.conditionShortKo ? ` ${behindCut.conditionShortKo.slice(0, 2)}` : ''}
                          </span>
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-1 min-w-0">
                        <p className="font-label-sm text-[12.5px] text-white font-bold truncate">
                          {activePersona
                            ? activePersona
                            : cluster.isCompanionDiscovered
                            ? '29년 신규 합류 멤버'
                            : cluster.roleHintKo}
                        </p>
                        {activePersona && baseName && activePersona !== baseName && (
                          <span
                            title={`원본 여권 시드(${baseName})는 100% 공유하며 현재 방(${activeRoomKey})에서만 '${activePersona}' 호칭으로 작동`}
                            className="px-1 py-0.2 rounded bg-amber-400/20 text-amber-300 font-mono text-[8.5px] font-bold shrink-0"
                          >
                            ={baseName}
                          </span>
                        )}
                      </div>
                      <p className="font-body-sm text-[10px] text-zinc-400 truncate mt-0.5">
                        {bucket
                          ? `${bucket.ageCategoryLabel} · 슬롯 ${bucket.filledStyleSlots.length}/5`
                          : `${yearlyCuts.length}종 각도 자동결합`}
                      </p>
                      <p className="font-mono text-[9.5px] text-emerald-300/90 truncate">
                        사진 {cluster.matchedPhotoCount}장
                        {cluster.matchedVideoSegmentCount > 0
                          ? ` · 영상 ${cluster.matchedVideoSegmentCount}구간`
                          : ''}
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

                  {/* 현재 방(Room) 호칭 입력 + [등록] 원터치로 시드 확정 & 전 멤버 0.04초 역스캔 */}
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
                        if (currentDraft.trim() !== activePersona) {
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
                          ? '29년 신규 멤버 호칭 입력'
                          : '이 방에서의 호칭 (예: 둘째사위)'
                      }
                      className="min-w-0 flex-1 h-8 px-2 rounded-lg bg-zinc-950 border border-white/10 focus:border-primary-container outline-none font-body-sm text-[11.5px] text-white placeholder:text-zinc-500"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSaveMember(cluster)}
                      className="h-8 px-2.5 rounded-lg bg-primary-container text-zinc-950 font-label-sm text-[11.5px] font-extrabold shrink-0 hover:opacity-95"
                    >
                      {justSavedId === cluster.clusterId ? '적용완료!' : '등록'}
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
                    <div
                      key={cand.candidateId}
                      className="relative"
                      title={`${cand.suggestedMemberName} (${cand.conditionBadgeKo})`}
                    >
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

          {/* 현재 방의 호칭(Room Persona: 우리집 '멀린' / 처가방 '둘째사위' / 학생방 '지우짱')으로 즉시 검색되는 0.04초 체험 바 */}
          {registeredClusters.length > 0 && (
            <div className="px-3.5 py-2.5 rounded-xl bg-zinc-900/90 border border-white/10 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-label-sm text-[11.5px] text-primary-container font-bold mr-1">
                  ⚡ [{activeRoomDisplayLabel}] 방 전용 별명 0.04초 검색 &amp; 영상 점프:
                </span>
                {registeredClusters.map((rc) => {
                  const { activePersona } = getActivePersonaForCluster(
                    rc,
                    activeLoungeType,
                    activeFamilyRoom
                  );
                  const name = (activePersona || rc.registeredName).trim();
                  const pKey = `${rc.personKey} ${rc.roleHintKo}`.toLowerCase();
                  const isAdultMale = pKey.includes('adult_male') || /성인 남성/.test(pKey);
                  const isAdultFemale = pKey.includes('adult_female') || /성인 여성/.test(pKey);
                  const isGlassesYouth = pKey.includes('glasses') || /안경/.test(rc.appearanceLabelKo);
                  const isYoungBoy = pKey.includes('child_son');

                  const photoQueries = isAdultMale
                    ? [`${name} 선글라스`, `${name} 나무 다리`, `${name} 바다`]
                    : isAdultFemale
                    ? [`${name} 나무 다리`, `${name} 선글라스`]
                    : isGlassesYouth
                    ? [`${name} 박물관`]
                    : isYoungBoy
                    ? [`${name} 물놀이`]
                    : [`${name} 바다`];

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
                  ✓ {lastRetroScanReport.timestampText} · Global Seed v{globalSeedVersion}
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
 * [세이씨 여권(SaySee Face Passport) · 인물별 독립 타임라인 바구니 · 3단 집단지성 총점검 모달]
 * 1. 인물별 독립 타임라인 바구니: 방(Room)이 아닌 각 인물(Person ID)의 최초 생성 연도(2026년 vs 2029년 신규 합류)에 귀속 + 미래 바구니(2027~2036 / 2027~2031) 자동 확장
 * 2. 무질문 0.1초 자동 장착: "시드를 가져올까요?" 질문 팝업 제로 — 이메일 ID 기반 만국공통 [🛂 세이씨 여권 자동 연동됨]
 * 3. 방별 별명(Room Persona) 독립 매핑: 시드(768차원 벡터 + 연도 바구니)는 100% 공유하되 방마다 부르는 호칭(멀린 ↔ 둘째사위 ↔ 큰아들 ↔ 지우짱)만 독립 작동
 * 4. 크로스-라운지 집단지성 진화: 타 방(예: 10대 학생방)에서 채워진 베스트 컷이 이메일 여권을 통해 우리집·처가·본가방에 자동 전파
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
    updateRoomPersonaForCluster,
    evolvePassportAcrossLounges,
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

  const memberActiveHints = useMemo(
    () => swarmFaceCandidates.filter((c) => !c.applied && !c.passedToHostQueue),
    [swarmFaceCandidates]
  );

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
      <div className="w-full max-w-5xl rounded-2xl bg-[#18181B] border border-white/15 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* 모달 상단 헤더 */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between gap-3 bg-zinc-950/80">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-label-sm text-[11px] font-extrabold">
                🛂 세이씨 여권 자동 연동됨 · Global Seed v{globalSeedVersion}
              </span>
              <h2 className="font-headline-sm text-[17px] md:text-[18px] text-white font-extrabold">
                만국공통 세이씨 여권(SaySee Face Passport) &amp; 인물별 독립 타임라인 바구니 센터
              </h2>
            </div>
            <p className="font-body-sm text-[12px] text-zinc-400">
              “시드를 가져올까요?” 질문 없이 이메일 계정에 귀속된 여권이 모든 방에 0.1초 자동 장착되며, 방별 별명(멀린 ↔ 둘째사위 ↔ 지우짱)과 인물별 고유 연도 바구니(26년 세팅 vs 29년 합류)가 독립 작동합니다.
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
          {/* 섹션 A: 인물별 고유 타임라인 바구니(미래 바구니 자동 확장) & 방별 별명(Room Persona) 매트릭스 */}
          <section className="rounded-xl bg-zinc-900/80 border border-emerald-400/30 p-4 flex flex-col gap-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-label-sm text-[10.5px] font-extrabold">
                    규칙 1~4 통합 아키텍처
                  </span>
                  <h3 className="font-label-md text-[14px] text-white font-bold">
                    인물별 독립 연도 바구니(2026 기존 가족 vs 2029 신규 처가 식구) &amp; 방별 별명(Room Persona) 독립 매핑
                  </h3>
                </div>
                <p className="font-body-sm text-[12px] text-zinc-400 mt-0.5">
                  시드(768차원 벡터 + 연도 바구니)는 100% 공유하되 방마다 호칭만 독립 매핑됩니다. 타 라운지(학생방·클럽방)에서 진화한 시드는 모든 방에 즉시 전파됩니다.
                </p>
              </div>

              <button
                type="button"
                disabled={retroScanRunning}
                onClick={() => void evolvePassportAcrossLounges('face_member_4')}
                className="px-3.5 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 text-zinc-950 font-label-sm text-[11.5px] font-extrabold shrink-0 shadow"
              >
                {retroScanRunning
                  ? '⏳ 여권 진화 전파 중...'
                  : '⚡ 크로스-라운지 진화 실증 (학생방 지우 신작 ➔ 우리집·처가·본가 동시 전파)'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {visibleClusters.map((c) => {
                const yearlyCuts = getClusterYearlyCuts(c);
                const activeYear = selectedYearMap[c.clusterId] ?? yearlyCuts[0].year;
                const activeCut =
                  yearlyCuts.find((yc) => yc.year === activeYear) ?? yearlyCuts[0];
                const stackedBehindCuts = yearlyCuts.filter((yc) => yc.year !== activeCut.year);
                const draftVal = modalDraftNames[c.clusterId] ?? '';
                const bucket = c.timelineBucket;

                return (
                  <div
                    key={c.clusterId}
                    className="rounded-xl p-3.5 bg-zinc-950/90 border border-white/10 flex flex-col gap-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative flex items-center shrink-0">
                          <div className="relative z-20">
                            <AutonomousCanvasFaceAvatar
                              photoFile={activeCut.representativePhoto}
                              boundingBox={activeCut.boundingBox}
                              fallbackAvatarUrl={activeCut.avatarUrl || activeCut.cropUrl}
                              altText={c.registeredName || c.appearanceLabelKo}
                              isHighlighted={Boolean(c.registeredName)}
                              sizeClass="w-13 h-13"
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
                                sizeClass="w-9 h-9"
                              />
                            </button>
                          ))}
                        </div>

                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-400/35 text-emerald-300 font-mono text-[9.5px] font-extrabold">
                              🛂 {c.passportEmail || 'passport@saysee.ai'}
                            </span>
                            {bucket && (
                              <span
                                className={`px-1.5 py-0.5 rounded font-mono text-[9.5px] font-bold ${
                                  bucket.anchorCreationYear >= 2029
                                    ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                                    : 'bg-zinc-800 text-primary-container'
                                }`}
                              >
                                {bucket.ageCategoryLabel} · 기본 {bucket.primaryBucketRange} ↪ 미래 {bucket.forwardBucketRange}
                              </span>
                            )}
                          </div>
                          <span className="font-label-md text-[13.5px] text-white font-bold mt-1 truncate">
                            기본 여권명: {c.registeredName || `${c.roleHintKo} (미등록)`} · 사진 {c.matchedPhotoCount}장 / 영상 {c.matchedVideoSegmentCount}구간
                          </span>
                          {c.crossLoungeEvolutionNote && (
                            <span className="font-body-sm text-[10.5px] text-emerald-300/90 leading-snug mt-0.5">
                              {c.crossLoungeEvolutionNote}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => void excludeFaceCluster(c.clusterId)}
                        className="px-2 py-1 rounded bg-zinc-900 hover:bg-red-950/60 border border-white/10 text-zinc-400 hover:text-red-300 font-label-sm text-[10px] shrink-0"
                      >
                        ✕ 제외
                      </button>
                    </div>

                    {/* 방별 별명(Room Persona) 독립 매핑 칩 (클릭 시 해당 방 별명으로 즉시 0.04초 검색 실행) */}
                    {c.roomPersonas && (
                      <div className="p-2 rounded-lg bg-zinc-900/90 border border-white/5 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] text-zinc-400 font-bold">
                            시드 100% 공유 · 방별 독립 호칭(Room Persona) 클릭 시 즉시 검색:
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {ROOM_PERSONA_KEYS.map((rk) => {
                            const pName = c.roomPersonas?.[rk.key];
                            if (!pName) return null;
                            const sampleQ =
                              rk.key === '처가(친정)' && c.clusterId === 'face_member_5'
                                ? `${pName} 선글라스`
                                : `${pName} 나무 다리`;
                            return (
                              <button
                                key={rk.key}
                                type="button"
                                onClick={() => void handleTriggerRealNameSearch(sampleQ, 'gallery')}
                                title={`[${rk.label}] 방에서 "${sampleQ}" 검색 (동일 여권 시드로 0.04초 매칭)`}
                                className="px-2 py-0.5 rounded bg-zinc-950 hover:bg-zinc-800 border border-white/10 text-zinc-200 font-mono text-[10px] flex items-center gap-1 transition-colors"
                              >
                                <span className="text-zinc-400">{rk.shortLabel}:</span>
                                <strong className="text-primary-container">{pName}</strong>
                                <span className="text-[9px] text-zinc-500">🔍</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 기본 여권 이름 수정 또는 처가방 별명 즉시 변경 */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      <input
                        type="text"
                        value={draftVal}
                        onChange={(e) =>
                          setModalDraftNames((prev) => ({
                            ...prev,
                            [c.clusterId]: e.target.value,
                          }))
                        }
                        placeholder="기본 여권 호칭 입력 후 [등록]"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            void registerFaceMember(c.clusterId, draftVal, '');
                          }
                        }}
                        className="min-w-0 flex-1 h-8 px-2.5 rounded-lg bg-zinc-900 border border-white/10 focus:border-primary-container text-white font-body-sm text-[11.5px] outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => void registerFaceMember(c.clusterId, draftVal, '')}
                        className="h-8 px-3 rounded-lg bg-primary-container text-zinc-950 font-label-sm text-[11px] font-extrabold shrink-0"
                      >
                        여권명 등록
                      </button>
                      {c.roomPersonas?.['처가(친정)'] && (
                        <button
                          type="button"
                          onClick={() => {
                            const persona = c.roomPersonas?.['처가(친정)'] || c.registeredName;
                            updateRoomPersonaForCluster(c.clusterId, '처가(친정)', persona);
                            void handleTriggerRealNameSearch(`${persona} 나무 다리`, 'gallery');
                          }}
                          className="h-8 px-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-amber-400/35 text-amber-300 font-label-sm text-[10.5px] font-bold shrink-0"
                        >
                          처가방 ‘{c.roomPersonas['처가(친정)']}’ 검색
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

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
                  참여하고 싶은 멤버는 <strong>[등록]</strong> 한 번으로 여권 시드를 진화시키고, 할머니나 바쁜 멤버는 고민 없이 <strong>[그냥 사진만 올리기 / 패스]</strong>를 누르면 됩니다.
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
                  할머니가 아무것도 안 누르고 올린 사진 속 얼굴 후보까지 버리지 않고 이곳에 모아둡니다. 방장이 <strong>[누락분 일괄 등록]</strong> 한 번만 누르면 세이씨 여권 시드에 100% 흡수됩니다.
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
                  ? `✓ 누락분 ${hostCleanupItems.length}건 일괄 등록 & 전 라운지 여권 동기화`
                  : '✓ 전 멤버 여권 시드 100% 반영됨 (재검증 역스캔)'}
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
                      ✓ 여권흡수됨
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

