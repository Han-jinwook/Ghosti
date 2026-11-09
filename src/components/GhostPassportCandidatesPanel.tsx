import React, { useEffect, useMemo, useState } from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';
import { loadGhostSecretaryState } from '../services/ghostSecretaryEngine';
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

  useEffect(() => {
    const sync = () => setStep(loadGhostSecretaryState().passportStep);
    const onOptInChange = () => setIsCloudSyncEnabled(isPassportCloudSyncOptedIn());
    window.addEventListener('ghosti_ghost_secretary_state_updated', sync);
    window.addEventListener('ghosti_passport_sync_opt_in_changed', onOptInChange);
    return () => {
      window.removeEventListener('ghosti_ghost_secretary_state_updated', sync);
      window.removeEventListener('ghosti_passport_sync_opt_in_changed', onOptInChange);
    };
  }, []);

  const candidates = useMemo(() => rankPassportCandidates(faceClusters || []), [faceClusters]);
  if (step !== 'naming' || candidates.length === 0) return null;

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
    <section className="p-4 rounded-2xl bg-[#18181B] border-2 border-amber-400/60 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-[16px] font-extrabold text-white">🪪 귀신계 여권 후보</h2>
          <span className="text-[11.5px] font-bold text-emerald-300">
            🔒 기본 100% 내 기기 로컬 전용 보관 (원본 사진 외부 전송 없음)
          </span>
        </div>
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
            ? '✅ 내 폰·다른 PC와 여권 동기화 켜짐 (암호화 보관 중)'
            : '📱 내 폰·다른 PC와 여권 동기화 켜기 (암호화 보관 · 선택 동의)'}
        </button>
      </div>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {candidates.map((c, i) => (
          <div key={c.clusterId} className="flex flex-col items-center gap-1">
            <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-zinc-950 border border-white/10">
              <img src={c.avatarUrl || c.cropUrl || c.representativePhoto} alt="" className="w-full h-full object-cover" />
              <span className="absolute top-1 left-1 w-6 h-6 rounded-full bg-amber-400 text-zinc-950 text-[12px] font-extrabold flex items-center justify-center">
                {i + 1}
              </span>
            </div>
            <span className="text-[11px] text-zinc-400">{c.registeredName || `${c.matchedPhotoCount || 0}장`}</span>
          </div>
        ))}
      </div>
      <span className="text-[12px] text-zinc-400">
        오른쪽 채팅에 "1번은 나, 2번은 한치우"처럼 진짜 이름으로 알려주세요. (동기화 토글을 켜기 전에는 이 기기 안에서만 보관됩니다)
      </span>
    </section>
  );
};

export default GhostPassportCandidatesPanel;
