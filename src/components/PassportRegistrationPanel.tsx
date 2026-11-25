import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';
import { AutonomousCanvasFaceAvatar } from './FaceMemberRegistryModal';
import { loadGhostPassportBook, loadGhostSecretaryState } from '../services/ghostSecretaryEngine';
import type { FaceMemberCluster, YearlyFaceBestCut } from '../types/saysee';
import {
  PASSPORT_REG_OPEN_EVENT,
  PASSPORT_REG_STATE_EVENT,
  clearSelfClusterPick,
  confirmedCutsFor,
  consumePendingPassportOpen,
  cutKey,
  familyCandidates,
  findSelfCluster,
  loadPassportRegState,
  pendingCutsFor,
  pickSelfCluster,
  rankFaceClusters,
  registeredMergeTargets,
  submitPassportRegistration,
  type PassportRegMode,
} from '../services/passportRegistrationFlow';

export const PASSPORT_REG_DEFERRED_EVENT = 'ghosti_passport_reg_deferred';

export const PassportRegistrationPanel: React.FC = () => {
  const faceClusters = useSaySeeStore((s) => s.faceClusters);
  const [mode, setMode] = useState<PassportRegMode | null>(null);
  const [regTick, setRegTick] = useState(0);
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set());
  const [names, setNames] = useState<Record<string, string>>({});
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [mergeTargets, setMergeTargets] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!mode) return;
    const raf = requestAnimationFrame(() => sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
    return () => cancelAnimationFrame(raf);
  }, [mode]);

  useEffect(() => {
    const pending = consumePendingPassportOpen();
    if (pending) setMode(pending);
    const onOpen = (e: Event) => {
      const m = (e as CustomEvent<{ mode?: PassportRegMode }>).detail?.mode;
      consumePendingPassportOpen();
      if (m === 'self' || m === 'family') {
        setUnchecked(new Set());
        setNames({});
        setDismissed(new Set());
        setMergeTargets({});
        setMode(m);
      }
    };
    const onState = () => setRegTick((n) => n + 1);
    window.addEventListener(PASSPORT_REG_OPEN_EVENT, onOpen);
    window.addEventListener(PASSPORT_REG_STATE_EVENT, onState);
    return () => {
      window.removeEventListener(PASSPORT_REG_OPEN_EVENT, onOpen);
      window.removeEventListener(PASSPORT_REG_STATE_EVENT, onState);
    };
  }, []);

  const regState = useMemo(() => loadPassportRegState(), [regTick, faceClusters, mode]);
  const selfCluster = useMemo(() => findSelfCluster(regState), [regState, faceClusters]);
  const nickname = (loadGhostSecretaryState().nickname || '').trim();
  const savedRealName = (loadGhostPassportBook().self?.realName || '').trim();

  const people: FaceMemberCluster[] = useMemo(() => {
    if (mode === 'self') return selfCluster ? [selfCluster] : [];
    if (mode === 'family') return familyCandidates(regState);
    return [];
  }, [mode, selfCluster, regState]);

  const availableMergeTargets = useMemo(() => {
    if (mode !== 'family') return [];
    const candidateIds = new Set(people.map((p) => p.clusterId));
    return registeredMergeTargets(regState).filter((t) => !candidateIds.has(t.clusterId));
  }, [mode, regState, people]);
  const selfMergeTarget = availableMergeTargets.find((t) => t.isSelf) || null;
  const familyMergeTargets = availableMergeTargets.filter((t) => !t.isSelf);

  const pickCandidates = useMemo(
    () => (mode === 'self' && !selfCluster ? rankFaceClusters(faceClusters || []) : []),
    [mode, selfCluster, faceClusters]
  );

  const close = useCallback(
    (deferred: boolean) => {
      const closingMode = mode;
      setMode(null);
      setUnchecked(new Set());
      setNames({});
      setDismissed(new Set());
      setMergeTargets({});
      if (deferred && closingMode) {
        window.dispatchEvent(new CustomEvent(PASSPORT_REG_DEFERRED_EVENT, { detail: { mode: closingMode } }));
      }
    },
    [mode]
  );

  const nothingToShow =
    mode !== null &&
    pickCandidates.length === 0 &&
    people.every((c) => pendingCutsFor(c, regState).length === 0) &&
    !(mode === 'self' && selfCluster && !savedRealName && people.length > 0);
  useEffect(() => {
    if (nothingToShow) setMode(null);
  }, [nothingToShow]);

  if (!mode || nothingToShow) return null;

  const toggleCut = (k: string) =>
    setUnchecked((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const totalPendingCutCount = people.reduce((acc, c) => acc + pendingCutsFor(c, regState).length, 0);
  const selectedCutCount = people.reduce((acc, c) => {
    if (dismissed.has(c.clusterId)) return acc;
    const cuts = pendingCutsFor(c, regState);
    return acc + cuts.filter((cut) => !unchecked.has(cutKey(c.clusterId, cut))).length;
  }, 0);
  const mergedSelectedCutCount = people.reduce((acc, c) => {
    if (dismissed.has(c.clusterId) || !mergeTargets[c.clusterId]) return acc;
    const cuts = pendingCutsFor(c, regState);
    return acc + cuts.filter((cut) => !unchecked.has(cutKey(c.clusterId, cut))).length;
  }, 0);
  const nameOnlySelfUpdate =
    mode === 'self' &&
    Boolean(selfCluster) &&
    totalPendingCutCount === 0 &&
    Boolean((names[selfCluster!.clusterId] ?? '').trim());
  const canSubmit =
    mode === 'self'
      ? selectedCutCount > 0 || nameOnlySelfUpdate
      : selectedCutCount > 0 || dismissed.size > 0;

  const handleSubmit = async () => {
    if (busy || !canSubmit) return;
    setBusy(true);
    try {
      await submitPassportRegistration(
        mode,
        people.map((c) => {
          const cuts = pendingCutsFor(c, regState);
          const isDismissed = dismissed.has(c.clusterId);
          const mergeIntoClusterId = isDismissed ? undefined : mergeTargets[c.clusterId] || undefined;
          const accepted: YearlyFaceBestCut[] = [];
          const rejected: YearlyFaceBestCut[] = [];
          cuts.forEach((cut) => {
            if (isDismissed || unchecked.has(cutKey(c.clusterId, cut))) rejected.push(cut);
            else accepted.push(cut);
          });
          return {
            clusterId: c.clusterId,
            acceptedCuts: accepted,
            rejectedCuts: rejected,
            realName: (names[c.clusterId] ?? (mode === 'self' ? savedRealName : c.registeredName || '')).trim(),
            dismissPerson: isDismissed,
            mergeIntoClusterId,
          };
        })
      );
      close(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section ref={sectionRef} className="p-4 sm:p-5 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col gap-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <h2 className="text-[15px] sm:text-[16px] font-bold text-slate-900 break-keep">시기별 여권사진 등록</h2>
          <p className="text-[12.5px] text-slate-500 break-keep">
            {mode === 'self'
              ? selfCluster
                ? `${nickname ? `${nickname}님` : '내'} 얼굴로 보이는 사진입니다. 아닌 사진만 선택 해제해 주세요.`
                : `${nickname ? `${nickname}님` : '내'} 얼굴을 선택해 주세요.`
              : '얼굴별로 자동 묶인 가족 후보입니다. 선글라스·모자 쓴 내 사진이나 이미 등록한 가족이 뜨면 [내 여권에 합치기]로 바로 합칠 수 있고, [제외]한 얼굴은 다시 묻지 않아요.'}
          </p>
        </div>
        <span className="text-[11px] font-medium text-slate-500 shrink-0">내 기기에서만 처리</span>
      </div>

      {mode === 'self' && !selfCluster && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
          {pickCandidates.map((c, idx) => (
            <button
              key={c.clusterId}
              type="button"
              onClick={() => {
                pickSelfCluster(c.clusterId);
                setRegTick((n) => n + 1);
              }}
              className={`flex flex-col items-center gap-1 p-1.5 rounded-lg cursor-pointer transition-colors border ${
                idx === 0
                  ? 'bg-teal-50/70 border-teal-200 hover:bg-teal-50'
                  : 'hover:bg-slate-50 border-transparent hover:border-slate-200'
              }`}
            >
              <AutonomousCanvasFaceAvatar
                photoFile={c.representativePhoto}
                boundingBox={c.boundingBox}
                fallbackAvatarUrl={c.avatarUrl || c.cropUrl}
                altText="얼굴 후보"
                sizeClass="w-16 h-16"
                shape="square"
              />
              <span className={`text-[11px] font-semibold ${idx === 0 ? 'text-teal-800' : 'text-slate-600'}`}>
                {idx === 0 ? `가장 많음 (${c.matchedPhotoCount || 0}장)` : `내 얼굴 (${c.matchedPhotoCount || 0}장)`}
              </span>
            </button>
          ))}
        </div>
      )}

      {people.map((c) => {
        const cuts = pendingCutsFor(c, regState);
        const isDismissed = dismissed.has(c.clusterId);
        const mergeTargetId = !isDismissed ? mergeTargets[c.clusterId] || '' : '';
        const mergedTarget = mergeTargetId
          ? availableMergeTargets.find((t) => t.clusterId === mergeTargetId) || null
          : null;
        const nameValue = names[c.clusterId] ?? (mode === 'self' ? savedRealName : c.registeredName || '');
        const showNameInput = (mode === 'family' || !savedRealName) && !mergedTarget;
        return (
          <div
            key={c.clusterId}
            className={`flex flex-col gap-2.5 p-3 rounded-lg border ${
              isDismissed
                ? 'opacity-45 border-dashed border-slate-300'
                : mergedTarget
                ? 'border-teal-300 bg-teal-50/60'
                : 'border-slate-200 bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2 flex-wrap">
              {mode === 'family' && (
                <AutonomousCanvasFaceAvatar
                  photoFile={c.representativePhoto}
                  boundingBox={c.boundingBox}
                  fallbackAvatarUrl={c.avatarUrl || c.cropUrl}
                  altText="가족 얼굴"
                  sizeClass="w-11 h-11"
                />
              )}
              {isDismissed && mode === 'family' && (
                <span className="text-[12px] text-slate-500 break-keep">
                  제외됨 — 반영하면 다시 묻지 않아요.
                </span>
              )}
              {mergedTarget && !isDismissed && (
                <div className="flex-1 min-w-[160px] flex items-center gap-1.5 px-3 h-9 rounded-lg bg-teal-100/80 border border-teal-300 text-teal-900 text-[12.5px] font-semibold">
                  <span>🔗</span>
                  <span className="truncate">
                    {mergedTarget.isSelf
                      ? `내 여권(${mergedTarget.label})에 합치기 선택됨`
                      : `${mergedTarget.label} 여권에 합치기 선택됨`}
                  </span>
                </div>
              )}
              {showNameInput && !isDismissed && (
                <input
                  type="text"
                  value={nameValue}
                  maxLength={18}
                  onChange={(e) => setNames((prev) => ({ ...prev, [c.clusterId]: e.target.value }))}
                  placeholder="이름 (선택)"
                  className="flex-1 min-w-[130px] h-9 px-3 rounded-lg bg-white border border-slate-300 focus:border-slate-600 outline-none text-[13px] text-slate-900 placeholder:text-slate-400"
                />
              )}
              {mode === 'family' && (
                <div className="ml-auto flex items-center gap-1.5 flex-wrap">
                  {!isDismissed && selfMergeTarget && (
                    <button
                      type="button"
                      onClick={() => {
                        setMergeTargets((prev) => {
                          const next = { ...prev };
                          if (next[c.clusterId] === selfMergeTarget.clusterId) {
                            delete next[c.clusterId];
                          } else {
                            next[c.clusterId] = selfMergeTarget.clusterId;
                          }
                          return next;
                        });
                      }}
                      className={`px-2.5 py-1.5 rounded-md text-[11.5px] font-semibold border cursor-pointer transition-colors ${
                        mergeTargetId === selfMergeTarget.clusterId
                          ? 'bg-teal-700 border-teal-700 text-white hover:bg-teal-800'
                          : 'bg-white border-teal-300 text-teal-800 hover:bg-teal-50'
                      }`}
                    >
                      {mergeTargetId === selfMergeTarget.clusterId ? '✓ 내 여권 합치기 취소' : '👤 내 여권에 합치기'}
                    </button>
                  )}
                  {!isDismissed && familyMergeTargets.length > 0 && (
                    <select
                      aria-label="기존 가족 여권에 합치기"
                      value={familyMergeTargets.some((t) => t.clusterId === mergeTargetId) ? mergeTargetId : ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setMergeTargets((prev) => {
                          const next = { ...prev };
                          if (!val) delete next[c.clusterId];
                          else next[c.clusterId] = val;
                          return next;
                        });
                      }}
                      className="h-[30px] px-2 rounded-md text-[11.5px] font-medium border border-slate-200 bg-white text-slate-700 hover:border-slate-400 outline-none cursor-pointer"
                    >
                      <option value="">기존 가족에 합치기</option>
                      {familyMergeTargets.map((t) => (
                        <option key={t.clusterId} value={t.clusterId}>
                          {t.label} 여권에 합치기
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setDismissed((prev) => {
                        const next = new Set(prev);
                        if (next.has(c.clusterId)) {
                          next.delete(c.clusterId);
                        } else {
                          next.add(c.clusterId);
                          setMergeTargets((mt) => {
                            if (!mt[c.clusterId]) return mt;
                            const copy = { ...mt };
                            delete copy[c.clusterId];
                            return copy;
                          });
                        }
                        return next;
                      });
                    }}
                    className="px-2.5 py-1.5 rounded-md text-[11.5px] font-medium border border-slate-200 bg-white text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    {isDismissed ? '되돌리기' : '제외'}
                  </button>
                </div>
              )}
            </div>
            {!isDismissed && cuts.length > 0 && (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {cuts.map((cut) => {
                  const k = cutKey(c.clusterId, cut);
                  const checked = !unchecked.has(k);
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => toggleCut(k)}
                      className={`relative flex flex-col items-center gap-1 cursor-pointer transition-opacity ${checked ? '' : 'opacity-40'}`}
                    >
                      <AutonomousCanvasFaceAvatar
                        photoFile={cut.representativePhoto || c.representativePhoto}
                        boundingBox={cut.boundingBox || c.boundingBox}
                        fallbackAvatarUrl={cut.cropUrl || cut.avatarUrl || c.avatarUrl}
                        altText={`${cut.year}년`}
                        isHighlighted={checked}
                        sizeClass="w-14 h-14"
                        shape="square"
                      />
                      <span
                        className={`absolute top-0.5 right-0.5 w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center ${
                          checked ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        {checked ? '✓' : ''}
                      </span>
                      <span className="text-[10.5px] font-medium text-slate-500">{cut.year}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {mode === 'self' && selfCluster && totalPendingCutCount > 0 && selectedCutCount === 0 && (
        <p className="text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 break-keep">
          선택된 내 사진이 0장입니다. 내 사진이 1장 이상 체크되어 있어야 등록되며, 다른 분 사진이라면 왼쪽 아래 <strong>[다른 얼굴 고르기]</strong>를 눌러 주세요.
        </p>
      )}

      <div className="flex items-center justify-end gap-2 pt-0.5">
        {mode === 'self' &&
          selfCluster &&
          confirmedCutsFor(selfCluster, regState).length === 0 &&
          rankFaceClusters(faceClusters || []).length > 1 && (
            <button
              type="button"
              onClick={() => {
                clearSelfClusterPick();
                setUnchecked(new Set());
                setRegTick((n) => n + 1);
              }}
              className="mr-auto px-3 py-2 rounded-lg text-[12.5px] font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              다른 얼굴 고르기
            </button>
          )}
        <button
          type="button"
          onClick={() => close(true)}
          className="px-3.5 py-2 rounded-lg text-[12.5px] font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
        >
          {mode === 'self' ? '나중에' : '다음에'}
        </button>
        {people.length > 0 && (
          <button
            type="button"
            disabled={busy || !canSubmit}
            onClick={() => void handleSubmit()}
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[12.5px] font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy
              ? '등록 중...'
              : !canSubmit
              ? '1장 이상 선택'
              : mode === 'family' && selectedCutCount === 0 && dismissed.size > 0
              ? '제외 반영'
              : mode === 'family' && mergedSelectedCutCount > 0 && mergedSelectedCutCount === selectedCutCount
              ? '여권에 합치기'
              : '등록'}
          </button>
        )}
      </div>
    </section>
  );
};

export default PassportRegistrationPanel;
