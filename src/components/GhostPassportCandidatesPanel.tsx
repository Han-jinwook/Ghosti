import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';
import {
  loadGhostSecretaryState,
  saveGhostSecretaryState,
  loadGhostPassportBook,
} from '../services/ghostSecretaryEngine';
import {
  isPassportCloudSyncOptedIn,
  setPassportCloudSyncOptIn,
  pushGhostPassportsToCloud,
  buildPassportExtrasFromClusters,
} from '../services/ghostPassportSync';
import type { FaceMemberCluster } from '../types/saysee';

/** 여권 후보 = 행인 제외 클러스터를 등장 사진 수 내림차순 Top 6 (번호 = 채팅에서 부르는 번호) */
export function rankPassportCandidates(clusters: FaceMemberCluster[], limit = 6): FaceMemberCluster[] {
  return clusters
    .filter((c) => !c.excludedAsPasserby)
    .slice()
    .sort((a, b) => (b.matchedPhotoCount || 0) - (a.matchedPhotoCount || 0))
    .slice(0, limit);
}

/** 업무용 PC 판별용 인물 사진 수 (클러스터 간 중복 파일 제거) */
export function countUniqueFacePhotos(clusters: FaceMemberCluster[]): number {
  const set = new Set<string>();
  clusters.filter((c) => !c.excludedAsPasserby).forEach((c) => (c.matchedPhotoFiles || []).forEach((f) => set.add(f)));
  const fallback = clusters.reduce((a, c) => a + (c.excludedAsPasserby ? 0 : c.matchedPhotoCount || 0), 0);
  return set.size || fallback;
}

/**
 * 🪪 귀신계 여권 후보 카드 (귀신비서가 '왼쪽 화면에 띄워봤어요'라고 말할 때만 노출)
 * - [R2 해결]: 귀신계 여권은 기본적으로 100% 내 기기 로컬 DB에만 보관(`isCloudSyncEnabled = false` 기본값)되며,
 *   유저가 직접 `[📱 내 폰·다른 PC와 여권 동기화 켜기 (암호화 보관)]` 토글을 눌러 동의(Opt-in)했을 때만 암호화 동기화가 작동합니다.
 * - 관계 칩 버튼 없음: 이름은 오직 채팅으로 실명 입력
 */
export const GhostPassportCandidatesPanel: React.FC = () => {
  const faceClusters = useSaySeeStore((s) => s.faceClusters);
  const merlinAuth = useSaySeeStore((s) => s.merlinAuth);
  const [step, setStep] = useState(() => loadGhostSecretaryState().passportStep);
  const [isCloudSyncEnabled, setIsCloudSyncEnabled] = useState<boolean>(() => isPassportCloudSyncOptedIn());
  const [revealTick, setRevealTick] = useState(0);
  const [isHighlighting, setIsHighlighting] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);
  const isVisible = step === 'naming' || step === 'ask_hint';

  useEffect(() => {
    const sync = () => {
      const nextStep = loadGhostSecretaryState().passportStep;
      setStep(nextStep);
      if (nextStep === 'naming' || nextStep === 'ask_hint') {
        setRevealTick((n) => n + 1);
      }
    };
    const onOptInChange = () => setIsCloudSyncEnabled(isPassportCloudSyncOptedIn());
    window.addEventListener('ghosti_ghost_secretary_state_updated', sync);
    window.addEventListener('ghosti_passport_sync_opt_in_changed', onOptInChange);
    return () => {
      window.removeEventListener('ghosti_ghost_secretary_state_updated', sync);
      window.removeEventListener('ghosti_passport_sync_opt_in_changed', onOptInChange);
    };
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    setIsHighlighting(true);
    const raf = requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    const timer = window.setTimeout(() => setIsHighlighting(false), 2400);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [isVisible, revealTick]);

  const candidates = useMemo(() => rankPassportCandidates(faceClusters || []), [faceClusters]);
  const passportBook = useMemo(() => loadGhostPassportBook(), [step, faceClusters]);
  if (!isVisible) return null;

  const handleClosePanel = () => {
    const cur = loadGhostSecretaryState();
    saveGhostSecretaryState({ ...cur, passportStep: 'done' });
  };

  const handleToggleCloudSyncOptIn = async () => {
    const next = !isCloudSyncEnabled;
    setPassportCloudSyncOptIn(next);
    setIsCloudSyncEnabled(next);
    if (next && merlinAuth?.email) {
      const named = candidates
        .filter((c) => c.registeredName)
        .map((c) => ({
          name: c.registeredName || '',
          seedVecPreview: c.seedVecPreview,
          avatarUrl: c.avatarUrl,
          cropUrl: c.cropUrl,
        }));
      await pushGhostPassportsToCloud(
        merlinAuth.email,
        'pc',
        buildPassportExtrasFromClusters(named),
        { forceExplicitOptIn: true }
      );
    }
  };

  return (
    <section
      ref={sectionRef}
      key={revealTick}
      style={{
        animation: 'passportCardReveal 0.48s cubic-bezier(0.22, 1, 0.36, 1)',
      }}
      className={`p-4 sm:p-5 rounded-2xl bg-[#18181B] border-2 border-amber-400/80 flex flex-col gap-3 transition-all duration-500 ${
        isHighlighting
          ? 'ring-4 ring-amber-400/55 shadow-[0_0_32px_rgba(251,191,36,0.42)]'
          : 'shadow-md'
      }`}
    >
      <style>{`
        @keyframes passportCardReveal {
          0% { opacity: 0; transform: translateY(-14px) scale(0.96); }
          65% { opacity: 1; transform: translateY(3px) scale(1.015); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-[15.5px] sm:text-[16.5px] font-extrabold text-white flex items-center gap-1.5">
            <span>🛂</span>
            <span>귀신계 여권 카드 · 인물 사진 이름 등록</span>
          </h2>
          <span className="text-[11.5px] font-bold text-emerald-300 break-keep">
            🔒 기본 100% 내 기기 로컬 전용 보관 (원본 사진 외부 전송 0%)
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => void handleToggleCloudSyncOptIn()}
            className={`px-3 py-1 rounded-xl text-[11.5px] font-extrabold transition-all cursor-pointer border ${
              isCloudSyncEnabled
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                : 'bg-zinc-900 hover:bg-zinc-800 border-white/15 text-zinc-300'
            }`}
          >
            {isCloudSyncEnabled
              ? '✅ 내 폰·다른 PC와 여권 동기화 켜짐'
              : '📱 내 폰·다른 PC와 여권 동기화 켜기 (선택 동의)'}
          </button>
          <button
            type="button"
            onClick={handleClosePanel}
            title="여권 카드 접기"
            className="px-2.5 py-1 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-400 hover:text-white text-[11.5px] font-bold cursor-pointer"
          >
            접기 ✕
          </button>
        </div>
      </div>

      {candidates.length > 0 ? (
        <>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2.5">
            {candidates.map((c, i) => (
              <div key={c.clusterId} className="flex flex-col items-center gap-1">
                <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-zinc-950 border border-white/10">
                  <img src={c.avatarUrl || c.cropUrl || c.representativePhoto} alt="" className="w-full h-full object-cover" />
                  <span className="absolute top-1 left-1 w-6 h-6 rounded-full bg-amber-400 text-zinc-950 text-[12px] font-extrabold flex items-center justify-center shadow">
                    {i + 1}
                  </span>
                </div>
                <span className="text-[11.5px] font-semibold text-zinc-300 truncate max-w-full">
                  {c.registeredName || `${c.matchedPhotoCount || 0}장 등장`}
                </span>
              </div>
            ))}
          </div>
          <span className="text-[12.5px] text-zinc-300 break-keep leading-relaxed">
            💬 오른쪽 귀신비서 대화창에 <strong className="text-amber-300">&ldquo;1번은 나, 2번은 홍길동, 3번은 김철수&rdquo;</strong>처럼 실제 이름으로 알려주세요! 한 번만 등록해 두면 다음부터 이름으로 1초 만에 사진을 찾아드려요.
          </span>
        </>
      ) : (
        <div className="rounded-xl bg-zinc-950/90 border border-white/10 p-3.5 space-y-2 text-[13px] text-zinc-200 break-keep leading-relaxed">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[12px] font-extrabold">
              🛂 내 여권 등록 현황: {passportBook.self?.nickname ? `본인(${passportBook.self.nickname})` : '미등록'}
              {passportBook.members.length > 0 ? ` · 가족/지인 ${passportBook.members.length}명` : ''}
            </span>
          </div>
          <p className="text-zinc-300">
            내 컴퓨터 사진 폴더(또는 스마트폰에서 불러온 사진첩)에서 자주 등장하는 가족·지인 얼굴이 감지되면 이곳에 <strong className="text-amber-300">①, ②, ③ 번호표 카드</strong>가 자동으로 나타나요!
          </p>
          <p className="text-zinc-400 text-[12px]">
            오른쪽 귀신비서 대화창에 <strong className="text-zinc-200">&ldquo;1번은 나, 2번은 홍길동&rdquo;</strong>처럼 한 번만 알려주시면 다음부터 <strong className="text-teal-300">&lsquo;홍길동 웃는 사진 찾아줘&rsquo;</strong> 한마디로 1초 만에 찾아드려요.
          </p>
        </div>
      )}
    </section>
  );
};

export default GhostPassportCandidatesPanel;
