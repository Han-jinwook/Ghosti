import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getActivePersonaForCluster, useSaySeeStore } from '../store/useSaySeeStore';
import type { FaceMemberCluster, RoomPersonaMap, YearlyFaceBestCut } from '../types/saysee';

/**
 * 실제 원본 이미지에서 검출된 얼굴 Bounding Box [ymin, xmin, ymax, xmax] (0..1000) 좌표를
 * 브라우저 HTML5 <canvas>로 직접 오려내어 원형 또는 큼직한 사각형(rounded-2xl) 카드로 렌더링하는 자율 캔버스 크롭 컴포넌트
 */
export const AutonomousCanvasFaceAvatar: React.FC<{
  photoFile: string;
  boundingBox: [number, number, number, number];
  fallbackAvatarUrl: string;
  altText: string;
  isHighlighted?: boolean;
  sizeClass?: string;
  shape?: 'circle' | 'square';
}> = ({
  photoFile,
  boundingBox,
  fallbackAvatarUrl,
  altText,
  isHighlighted = false,
  sizeClass = 'w-12 h-12',
  shape = 'circle',
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
      const side = Math.min(Math.min(imgW, imgH), Math.max(faceW, faceH) * 1.55);

      const sx = Math.max(0, Math.min(imgW - side, Math.round(cx - side / 2)));
      const sy = Math.max(0, Math.min(imgH - side, Math.round(cy - side / 2)));
      const sw = Math.max(16, Math.min(imgW - sx, Math.round(side)));
      const sh = Math.max(16, Math.min(imgH - sy, Math.round(side)));

      canvas.width = 220;
      canvas.height = 220;
      ctx.clearRect(0, 0, 220, 220);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 220, 220);
      setCanvasReady(true);
    };
    img.src = `/__photos/file?p=${encodeURIComponent(photoFile)}`;
    return () => {
      cancelled = true;
    };
  }, [photoFile, boundingBox]);

  const radiusClass = shape === 'square' ? 'rounded-2xl' : 'rounded-full';

  return (
    <div
      className={`relative ${sizeClass} ${radiusClass} overflow-hidden bg-zinc-900 border-2 ${
        isHighlighted
          ? 'border-primary-container shadow-[0_0_14px_rgba(32,247,219,0.28)]'
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

type PendingSingleCardItem =
  | {
      kind: 'candidate';
      id: string;
      candidateId: string;
      photoFile: string;
      boundingBox: [number, number, number, number];
      fallbackUrl: string;
      headlinePrefix: string;
      targetDisplayName: string;
      isRoomCreatorTarget: boolean;
      subText: string;
    }
  | {
      kind: 'new_person';
      id: string;
      cluster: FaceMemberCluster;
      photoFile: string;
      boundingBox: [number, number, number, number];
      fallbackUrl: string;
      subText: string;
    };

/**
 * [화면 정화(UI Diet) — 1장씩 스무스 전환되는 단일 사각형 확인 카드 (완료 시 Auto-Hide 완전 소멸!)]
 * 1. 👤 개인 라운지에서는 100% 비노출 (null 반환)
 * 2. 이미 등록 완료된 멤버(👑 멀린, 은숙, 치우, 지우, 천우)는 상단 알약 바에만 표시하고 하단 카드로는 절대 중복 노출하지 않음
 * 3. 오직 새로 확인받아야 할 컷(👑 방장 누락분 뒷정리 대기 건 또는 신규 등장 인물)이 있을 때만
 *    큼직한 사각형 카드 1장씩 보여주며, [⭕ 맞아요! 등록] 클릭 시 다음 카드로 스무스하게 넘어가고 모두 완료되면 화면에서 완전히 사라짐(Auto-Hide)!
 */
export const FaceMemberInlineBar: React.FC<{
  onRunRealNameQuery?: (query: string, targetSpace?: 'gallery' | 'video') => void;
}> = () => {
  const {
    faceClusters,
    retroScanRunning,
    swarmFaceCandidates,
    activeLoungeType,
    activeFamilyRoom,
    registerFaceMember,
    excludeFaceCluster,
    setShowFaceRegistryModal,
    applySwarmFaceCandidate,
    passSwarmFaceCandidateToHostQueue,
    runGlobalSwarmRetroScanAll,
  } = useSaySeeStore();

  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [newPersonDraft, setNewPersonDraft] = useState('처남(민수)');

  // 1. 👤 개인 라운지에서는 얼굴/여권 등록 박스 100% 제거 (완전 비노출!)
  if (activeLoungeType === 'personal') {
    return null;
  }

  // 2. 오직 새로 확인받아야 할 대기 건(미적용 베스트 컷 후보 + 미등록 신규 동반 인물)만 큐로 구성
  const pendingItems: PendingSingleCardItem[] = [];

  for (const cand of swarmFaceCandidates) {
    if (cand.applied || dismissedIds.includes(cand.candidateId)) continue;
    const targetCluster = faceClusters.find((fc) => fc.clusterId === cand.targetClusterId);
    const personaInfo = targetCluster
      ? getActivePersonaForCluster(targetCluster, activeLoungeType, activeFamilyRoom)
      : null;
    const displayName = personaInfo?.activePersona || cand.suggestedMemberName;
    const isCreator = Boolean(personaInfo?.isRoomCreator || cand.targetClusterId === 'face_member_5');

    let headlinePrefix = '✨ 새로 찾은 이 분도';
    if (cand.conditionShortKo?.includes('선글라스')) {
      headlinePrefix = '😎 선글라스 낀 이 분도';
    } else if (cand.conditionShortKo?.includes('노을')) {
      headlinePrefix = '🌅 노을 보트 위 이 분도';
    } else if (cand.conditionShortKo?.includes('측면') || cand.conditionShortKo?.includes('야외')) {
      headlinePrefix = '🏕️ 캠핑장 야외 컷 이 분도';
    }

    pendingItems.push({
      kind: 'candidate',
      id: cand.candidateId,
      candidateId: cand.candidateId,
      photoFile: cand.sourcePhoto,
      boundingBox: cand.boundingBox,
      fallbackUrl: cand.cropUrl,
      headlinePrefix,
      targetDisplayName: displayName,
      isRoomCreatorTarget: isCreator,
      subText: `${cand.contributorLabel} · 등록 시 전 멤버 폰 사진 ${
        cand.rescuedHostPhotoCount + cand.rescuedMemberPhoneCount
      }장 0.04초 자동 매칭`,
    });
  }

  for (const fc of faceClusters) {
    if (
      fc.excludedAsPasserby ||
      fc.registeredName.trim().length > 0 ||
      dismissedIds.includes(fc.clusterId)
    ) {
      continue;
    }
    pendingItems.push({
      kind: 'new_person',
      id: fc.clusterId,
      cluster: fc,
      photoFile: fc.representativePhoto,
      boundingBox: fc.boundingBox,
      fallbackUrl: fc.avatarUrl || fc.cropUrl,
      subText: fc.coOccurredWithSummary || '가족·멤버와 함께 찍힌 사진 14장에서 새로 발견됨',
    });
  }

  // 모든 대기 건이 등록 완료(또는 패스)되면 화면에서 카드 박스가 100% 완전히 사라짐 (Auto-Hide!)
  if (pendingItems.length === 0) {
    return null;
  }

  const currentItem = pendingItems[0];
  const remainingCount = pendingItems.length;

  const handleConfirmCurrent = async () => {
    if (currentItem.kind === 'candidate') {
      await applySwarmFaceCandidate(currentItem.candidateId);
    } else {
      const cleanName = newPersonDraft.trim() || '처남(민수)';
      await registerFaceMember(currentItem.cluster.clusterId, cleanName, '');
    }
  };

  const handlePassCurrent = () => {
    if (currentItem.kind === 'candidate') {
      passSwarmFaceCandidateToHostQueue(currentItem.candidateId);
    }
    setDismissedIds((prev) => [...prev, currentItem.id]);
  };

  return (
    <div className="w-full rounded-2xl bg-[#18181B] border border-amber-400/35 p-4 md:p-5 shadow-lg transition-all duration-300">
      {/* 상단 슬림 상태 바: 👑 방장 누락분 뒷정리 & 남은 카드 수 */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3.5 border-b border-white/10">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-0.5 rounded-md bg-amber-400 text-zinc-950 font-label-sm text-[11px] font-extrabold">
            👑 방장 누락분 뒷정리 · 남은 확인 {remainingCount}건
          </span>
          <span className="font-body-sm text-[12px] text-zinc-400">
            1장씩 확인 후 완료되면 이 박스는 화면에서 자동으로 사라집니다
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {remainingCount > 1 && (
            <button
              type="button"
              disabled={retroScanRunning}
              onClick={() => void runGlobalSwarmRetroScanAll()}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-amber-400/40 text-amber-300 font-label-sm text-[11px] font-bold transition-colors"
            >
              ⚡ {remainingCount}건 한 번에 등록
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowFaceRegistryModal(true)}
            className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 font-label-sm text-[11px] font-medium"
          >
            👑 방장 총점검 모달
          </button>
        </div>
      </div>

      {/* 본문: 모바일에서도 사진이 큼직하게 보이는 '단일 사각형 카드 (1장씩 보기)' */}
      <div
        key={currentItem.id}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-950/80 border border-white/10 rounded-2xl p-4 transition-all duration-300"
      >
        <div className="flex items-center gap-4 min-w-0">
          {/* 큼직한 사각형 얼굴 크롭 카드 */}
          <AutonomousCanvasFaceAvatar
            photoFile={currentItem.photoFile}
            boundingBox={currentItem.boundingBox}
            fallbackAvatarUrl={currentItem.fallbackUrl}
            altText="확인 대상 인물"
            isHighlighted={true}
            sizeClass="w-20 h-20 sm:w-24 sm:h-24"
            shape="square"
          />

          <div className="flex flex-col gap-1.5 min-w-0">
            {currentItem.kind === 'candidate' ? (
              <>
                <h3 className="font-headline-sm text-[16px] sm:text-[18px] text-white font-extrabold leading-snug">
                  {currentItem.headlinePrefix}{' '}
                  <span className="text-primary-container">
                    [{currentItem.isRoomCreatorTarget ? '👑 ' : ''}
                    {currentItem.targetDisplayName}]
                  </span>
                  님 맞죠?
                </h3>
                <p className="font-body-sm text-[12px] text-zinc-400 truncate">
                  {currentItem.subText}
                </p>
              </>
            ) : (
              <>
                <h3 className="font-headline-sm text-[16px] sm:text-[18px] text-white font-extrabold leading-snug">
                  👋 새로 등장한 이 분의 별명을 적어주세요
                </h3>
                <p className="font-body-sm text-[12px] text-zinc-400 truncate">
                  {currentItem.subText}
                </p>
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  {['처남(민수)', '막내사위', '사촌', '조카'].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setNewPersonDraft(chip)}
                      className={`px-2 py-0.5 rounded-md font-label-sm text-[11px] font-bold border transition-all ${
                        newPersonDraft === chip
                          ? 'bg-primary-container text-zinc-950 border-primary-container'
                          : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-white/10'
                      }`}
                    >
                      #{chip}
                    </button>
                  ))}
                  <input
                    type="text"
                    value={newPersonDraft}
                    onChange={(e) => setNewPersonDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleConfirmCurrent();
                      }
                    }}
                    placeholder="별명 직접 입력"
                    className="h-8 px-2.5 rounded-lg bg-zinc-900 border border-white/15 focus:border-primary-container outline-none font-body-sm text-[12px] text-white w-36"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* 우측 원터치 액션 버튼: [⭕ 맞아요! 등록] / [그냥 넘어가기] */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          {currentItem.kind === 'new_person' && (
            <button
              type="button"
              onClick={() => void excludeFaceCluster(currentItem.cluster.clusterId)}
              className="px-3 py-2.5 rounded-xl bg-zinc-900 hover:bg-red-950/60 border border-white/10 text-zinc-400 hover:text-red-300 font-label-sm text-[12px] font-medium"
            >
              행인 제외
            </button>
          )}
          <button
            type="button"
            onClick={handlePassCurrent}
            className="px-3.5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 font-label-sm text-[12px] font-bold transition-colors"
          >
            그냥 넘어가기
          </button>
          <button
            type="button"
            disabled={retroScanRunning}
            onClick={() => void handleConfirmCurrent()}
            className="px-4 py-2.5 rounded-xl bg-primary-container hover:opacity-95 disabled:opacity-50 text-zinc-950 font-label-md text-[13px] font-extrabold shadow-[0_0_16px_rgba(32,247,219,0.25)] transition-all"
          >
            {retroScanRunning ? '등록 중...' : '⭕ 맞아요! 등록'}
          </button>
        </div>
      </div>
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
                🛂 세이씨 여권 관리 · 👑 방장 총점검 (Global Seed v{globalSeedVersion})
              </span>
              <h2 className="font-headline-sm text-[17px] md:text-[18px] text-white font-extrabold">
                만국공통 세이씨 여권(SaySee Face Passport) &amp; 👑 방장 누락분 총점검 센터
              </h2>
            </div>
            <p className="font-body-sm text-[12px] text-zinc-400">
              “시드를 가져올까요?” 질문 없이 이메일 계정에 귀속된 여권이 모든 방에 0.1초 자동 장착되며, 방별 별명(👑 멀린 ↔ 👑 둘째사위 ↔ 지우짱)과 인물별 고유 연도 바구니(26년 세팅 vs 29년 합류)가 독립 작동합니다.
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
                const isCreator = c.clusterId === 'face_member_5';

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
                            기본 여권명: {isCreator ? '👑 ' : ''}{c.registeredName || `${c.roleHintKo} (미등록)`} · 사진 {c.matchedPhotoCount}장 / 영상 {c.matchedVideoSegmentCount}구간
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
                                <strong className="text-primary-container">
                                  {isCreator ? `👑 ${pName}` : pName}
                                </strong>
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
                          처가방 ‘{isCreator ? '👑 ' : ''}{c.roomPersonas['처가(친정)']}’ 검색
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ✨ AI 얼굴 자동 매칭 도우미: 원터치 [⭕ 맞아요! 등록] vs [⚡ 확인 건너뛰고 사진만 바로 올리기] */}
          <section className="rounded-xl bg-zinc-900/80 border border-primary-container/30 p-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-primary-container/20 text-primary-container font-label-sm text-[10.5px] font-extrabold">
                    ✨ AI 얼굴 자동 매칭 도우미
                  </span>
                  <h3 className="font-label-md text-[14px] text-white font-bold">
                    멤버가 사진을 올릴 때 뜨는 ‘원터치 AI 힌트’ (건너뛰어도 👑 방장 대기열에 100% 보관)
                  </h3>
                </div>
                <p className="font-body-sm text-[12px] text-zinc-400 mt-0.5">
                  새로 찾은 얼굴은 <strong>[⭕ 맞아요! 등록]</strong> 한 번으로 여권 시드에 반영하고, 바쁠 때는 고민 없이 <strong>[⚡ 확인 건너뛰고 사진만 바로 올리기]</strong>를 누르면 됩니다.
                </p>
              </div>

              {memberActiveHints.length > 0 && (
                <button
                  type="button"
                  onClick={() => passAllSwarmCandidatesToHostQueue()}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-white/15 text-zinc-200 font-label-sm text-[11.5px] font-bold shrink-0"
                >
                  ⚡ 확인 건너뛰고 사진만 바로 올리기 (방장이 나중에 정리)
                </button>
              )}
            </div>

            {memberActiveHints.length === 0 ? (
              <div className="p-3 rounded-xl bg-zinc-950/80 border border-white/10 text-zinc-300 font-body-sm text-[12px] flex items-center justify-between">
                <span>
                  ✓ 현재 멤버 업로드 화면의 AI 힌트가 모두 처리되었습니다. (건너뛴 항목은 아래 👑 방장 누락분 뒷정리 대기열로 안전하게 보관되었습니다.)
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
                        shape="square"
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="font-mono text-[10px] text-zinc-400">
                          {cand.contributorLabel}
                        </span>
                        <p className="font-label-sm text-[12.5px] text-white font-bold leading-snug mt-0.5">
                          🎯 방금 올린 사진에서{' '}
                          <span className="text-primary-container">
                            {cand.targetClusterId === 'face_member_5' ? '👑 ' : ''}
                            {cand.suggestedMemberName}
                          </span>
                          님의 새로운 연도/각도(<span className="text-amber-300">{cand.conditionBadgeKo}</span>) 베스트 컷을 찾았어요!
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
                        ⭕ 맞아요! 등록
                      </button>
                      <button
                        type="button"
                        onClick={() => passSwarmFaceCandidateToHostQueue(cand.candidateId)}
                        className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-400 hover:text-zinc-200 font-label-sm text-[10.5px]"
                      >
                        확인 건너뛰기
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 👑 방장의 권한과 뒷정리 — 누락 연도·조건 총점검 & 원터치 마감 */}
          <section className="rounded-xl bg-zinc-900/80 border border-amber-400/35 p-4 flex flex-col gap-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-amber-400 text-zinc-950 font-label-sm text-[10.5px] font-extrabold">
                    👑 방장 누락분 뒷정리 &amp; 총점검
                  </span>
                  <h3 className="font-label-md text-[14px] text-white font-bold">
                    확인을 건너뛴 사진 속 얼굴 &amp; 누락 연도·각도 👑 방장 총점검
                  </h3>
                </div>
                <p className="font-body-sm text-[12px] text-zinc-400 mt-0.5">
                  멤버들이 확인을 건너뛰고 바로 올린 사진 속 얼굴 후보까지 빠짐없이 이곳에 보관됩니다. 👑 방장이 <strong>[누락분 일괄 등록]</strong> 한 번만 누르면 세이씨 여권 시드에 100% 반영됩니다.
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
                  ? `✓ 👑 방장 누락분 ${hostCleanupItems.length}건 일괄 등록`
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
                      shape="square"
                    />
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="font-label-sm text-[12px] text-white font-bold">
                          {cand.targetClusterId === 'face_member_5' ? '👑 ' : ''}
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
                      ⭕ 등록
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

