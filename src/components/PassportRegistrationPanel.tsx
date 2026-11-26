import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';
import { AutonomousCanvasFaceAvatar } from './FaceMemberRegistryModal';
import { loadGhostPassportBook, loadGhostSecretaryState } from '../services/ghostSecretaryEngine';
import type { FaceMemberCluster, YearlyFaceBestCut } from '../types/saysee';
import {
  PASSPORT_MANUAL_UPLOAD_EVENT,
  PASSPORT_REG_OPEN_EVENT,
  PASSPORT_REG_STATE_EVENT,
  clearSelfClusterPick,
  confirmedCutsFor,
  consumeForceManualPassportOpen,
  consumePendingPassportOpen,
  cutKey,
  dismissFamilyCandidateImmediately,
  familyCandidates,
  findSelfCluster,
  getConfirmedSelfPassportView,
  loadPassportRegState,
  mergeFamilyCandidateImmediately,
  pendingCutsFor,
  pickSelfCluster,
  rankFaceClusters,
  registeredMergeTargets,
  submitPassportRegistration,
  triggerGlobalPassportFileInputClick,
  undoDismissFamilyCandidate,
  type PassportManualUploadEventDetail,
  type PassportRegMode,
} from '../services/passportRegistrationFlow';

export const PASSPORT_REG_DEFERRED_EVENT = 'ghosti_passport_reg_deferred';

export const PassportRegistrationPanel: React.FC = () => {
  const faceClusters = useSaySeeStore((s) => s.faceClusters);
  const [mode, setMode] = useState<PassportRegMode | null>(null);
  const [forceManualOpen, setForceManualOpen] = useState<boolean>(false);
  const [manualUploading, setManualUploading] = useState<boolean>(false);
  const [manualRealName, setManualRealName] = useState<string>('');
  const [regTick, setRegTick] = useState(0);
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set());
  const [names, setNames] = useState<Record<string, string>>({});
  const [justDismissed, setJustDismissed] = useState<
    Record<string, { cluster: FaceMemberCluster; cuts: YearlyFaceBestCut[] }>
  >({});
  const [mergeTargets, setMergeTargets] = useState<Record<string, string>>({});
  const [inlineNotice, setInlineNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!mode) return;
    const raf = requestAnimationFrame(() => sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
    return () => cancelAnimationFrame(raf);
  }, [mode]);

  useEffect(() => {
    const pending = consumePendingPassportOpen();
    const pendingForce = consumeForceManualPassportOpen();
    if (pending) {
      setMode(pending);
      setForceManualOpen(pendingForce);
    }
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ mode?: PassportRegMode; forceManualOpen?: boolean }>).detail;
      const m = detail?.mode;
      consumePendingPassportOpen();
      const forced = Boolean(detail?.forceManualOpen) || consumeForceManualPassportOpen();
      if (m === 'self' || m === 'family') {
        setUnchecked(new Set());
        setNames({});
        setJustDismissed({});
        setMergeTargets({});
        setInlineNotice(null);
        setForceManualOpen(forced);
        setMode(m);
      }
    };
    const onState = () => setRegTick((n) => n + 1);
    const onManualUpload = (e: Event) => {
      const detail = (e as CustomEvent<PassportManualUploadEventDetail>).detail;
      if (!detail) return;
      if (detail.phase === 'busy') {
        setManualUploading(true);
        setInlineNotice('선택하신 사진에서 얼굴을 확인하고 있어요...');
      } else if (detail.phase === 'done') {
        setManualUploading(false);
        setInlineNotice(`✅ ${detail.message || '내 여권 사진이 등록되었어요.'}`);
        setRegTick((n) => n + 1);
      } else if (detail.phase === 'error') {
        setManualUploading(false);
        setInlineNotice(`⚠️ ${detail.message || '얼굴을 찾지 못했어요. 다른 사진을 골라 주세요.'}`);
      }
    };
    window.addEventListener(PASSPORT_REG_OPEN_EVENT, onOpen);
    window.addEventListener(PASSPORT_REG_STATE_EVENT, onState);
    window.addEventListener(PASSPORT_MANUAL_UPLOAD_EVENT, onManualUpload);
    return () => {
      window.removeEventListener(PASSPORT_REG_OPEN_EVENT, onOpen);
      window.removeEventListener(PASSPORT_REG_STATE_EVENT, onState);
      window.removeEventListener(PASSPORT_MANUAL_UPLOAD_EVENT, onManualUpload);
    };
  }, []);

  const regState = useMemo(() => loadPassportRegState(), [regTick, faceClusters, mode]);
  const selfCluster = useMemo(() => findSelfCluster(regState), [regState, faceClusters]);
  const confirmedSelfView = useMemo(
    () => getConfirmedSelfPassportView(),
    [regTick, faceClusters, mode]
  );
  const nickname = (loadGhostSecretaryState().nickname || '').trim();
  const savedRealName = (loadGhostPassportBook().self?.realName || '').trim();

  const people: FaceMemberCluster[] = useMemo(() => {
    if (mode === 'self') return selfCluster ? [selfCluster] : [];
    if (mode === 'family') return familyCandidates(regState);
    return [];
  }, [mode, selfCluster, regState]);

  const dismissedList = useMemo(
    () => (mode === 'family' ? Object.values(justDismissed) : []),
    [mode, justDismissed]
  );

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
      setForceManualOpen(false);
      setUnchecked(new Set());
      setNames({});
      setJustDismissed({});
      setMergeTargets({});
      setInlineNotice(null);
      if (deferred && closingMode) {
        window.dispatchEvent(new CustomEvent(PASSPORT_REG_DEFERRED_EVENT, { detail: { mode: closingMode } }));
      }
    },
    [mode]
  );

  const allowSelfManualFallback =
    mode === 'self' && (forceManualOpen || (!selfCluster && pickCandidates.length === 0));
  const hasSessionFeedback = dismissedList.length > 0 || Boolean(inlineNotice) || manualUploading;
  const nothingToShow =
    mode !== null &&
    !allowSelfManualFallback &&
    !hasSessionFeedback &&
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
    const cuts = pendingCutsFor(c, regState);
    return acc + cuts.filter((cut) => !unchecked.has(cutKey(c.clusterId, cut))).length;
  }, 0);
  const mergedSelectedCutCount = people.reduce((acc, c) => {
    if (!mergeTargets[c.clusterId]) return acc;
    const cuts = pendingCutsFor(c, regState);
    return acc + cuts.filter((cut) => !unchecked.has(cutKey(c.clusterId, cut))).length;
  }, 0);
  const nameOnlySelfUpdate =
    mode === 'self' &&
    Boolean(selfCluster) &&
    totalPendingCutCount === 0 &&
    Boolean((names[selfCluster!.clusterId] ?? '').trim());
  const canSubmit = mode === 'self' ? selectedCutCount > 0 || nameOnlySelfUpdate : selectedCutCount > 0;

  const handleInstantMerge = async (c: FaceMemberCluster, targetId: string) => {
    if (busy || !targetId) return;
    const cuts = pendingCutsFor(c, regState);
    const accepted: YearlyFaceBestCut[] = [];
    const rejected: YearlyFaceBestCut[] = [];
    cuts.forEach((cut) => {
      if (unchecked.has(cutKey(c.clusterId, cut))) rejected.push(cut);
      else accepted.push(cut);
    });
    if (accepted.length === 0) {
      setInlineNotice('합칠 사진이 1장 이상 체크되어 있어야 해요.');
      return;
    }
    setBusy(true);
    try {
      const res = await mergeFamilyCandidateImmediately(c, targetId, accepted, rejected);
      setMergeTargets((prev) => {
        const next = { ...prev };
        delete next[c.clusterId];
        return next;
      });
      setRegTick((n) => n + 1);
      if (res.merged > 0) {
        setInlineNotice(
          res.isSelf
            ? `✅ 선택한 ${res.merged}장을 내 여권(${res.targetLabel})에 합쳤어요! 우측 상단 [내 프로필 ➔ 여권]에서 바로 확인하실 수 있어요.`
            : `✅ 선택한 ${res.merged}장을 ${res.targetLabel}님 여권에 하나로 합쳤어요.`
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async () => {
    if (busy || !canSubmit) return;
    setBusy(true);
    try {
      await submitPassportRegistration(
        mode,
        people.map((c) => {
          const cuts = pendingCutsFor(c, regState);
          const mergeIntoClusterId = mergeTargets[c.clusterId] || undefined;
          const accepted: YearlyFaceBestCut[] = [];
          const rejected: YearlyFaceBestCut[] = [];
          cuts.forEach((cut) => {
            if (unchecked.has(cutKey(c.clusterId, cut))) rejected.push(cut);
            else accepted.push(cut);
          });
          return {
            clusterId: c.clusterId,
            acceptedCuts: accepted,
            rejectedCuts: rejected,
            realName: (names[c.clusterId] ?? (mode === 'self' ? savedRealName : c.registeredName || '')).trim(),
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
              : '사진 속 얼굴을 사람별로 자동 묶었어요. 선글라스·모자 때문에 다른 사람처럼 따로 뜬 내 사진이나 이미 등록한 가족 사진은 [내 사진이에요]·[이미 등록한 같은 분]으로 원래 여권에 합칠 수 있고, [제외]한 얼굴은 다시 묻지 않아요.'}
          </p>
        </div>
        <span className="text-[11px] font-medium text-slate-500 shrink-0">내 기기에서만 처리</span>
      </div>

      {mode === 'self' && !selfCluster && pickCandidates.length > 0 && (
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

      {mode === 'self' && !selfCluster && pickCandidates.length === 0 && (
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-2.5">
          <p className="text-[12.5px] text-slate-700 leading-relaxed break-keep">
            아직 내 기기에서 자동으로 묶인 인물 후보(3장 이상)가 없어요.{' '}
            <strong>내 얼굴이 나온 사진 1장</strong>만 직접 골라 주시면 바로 내 여권을 만들고, 기기에 있던 1~2장짜리 내 사진도 함께 찾아 연결해 드릴게요.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {!savedRealName && (
              <input
                type="text"
                value={manualRealName}
                maxLength={18}
                onChange={(e) => setManualRealName(e.target.value)}
                placeholder="여권 이름 (실명 · 선택)"
                className="flex-1 min-w-[140px] h-9 px-3 rounded-lg bg-white border border-slate-300 focus:border-slate-600 outline-none text-[13px] text-slate-900 placeholder:text-slate-400"
              />
            )}
            <button
              type="button"
              disabled={manualUploading}
              onClick={() => triggerGlobalPassportFileInputClick(manualRealName || savedRealName)}
              className="h-9 px-3.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12.5px] font-semibold cursor-pointer disabled:opacity-50"
            >
              {manualUploading ? '얼굴 확인 중...' : '📁 내 기기에서 사진 1장 직접 고르기'}
            </button>
          </div>
        </div>
      )}

      {mode === 'self' && selfCluster && totalPendingCutCount === 0 && confirmedSelfView.cuts.length > 0 && (
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[12.5px] font-semibold text-slate-800 break-keep">
              현재 등록된 내 여권 사진 ({confirmedSelfView.cuts.length}장) — 새 사진 1장을 골라 바로 추가·변경할 수 있어요.
            </span>
            <button
              type="button"
              disabled={manualUploading}
              onClick={() =>
                triggerGlobalPassportFileInputClick(
                  (names[selfCluster.clusterId] ?? savedRealName).trim()
                )
              }
              className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12px] font-semibold cursor-pointer disabled:opacity-50 shrink-0"
            >
              {manualUploading ? '얼굴 확인 중...' : '📁 새 사진 직접 골라 추가·변경'}
            </button>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {confirmedSelfView.cuts.slice(0, 6).map((cut) => (
              <div
                key={`confirmed_${cutKey(selfCluster.clusterId, cut)}`}
                className="flex flex-col items-center gap-1"
              >
                <AutonomousCanvasFaceAvatar
                  photoFile={cut.representativePhoto || selfCluster.representativePhoto}
                  boundingBox={cut.boundingBox || selfCluster.boundingBox}
                  fallbackAvatarUrl={cut.cropUrl || cut.avatarUrl || selfCluster.avatarUrl}
                  altText={`${cut.year}년`}
                  sizeClass="w-14 h-14"
                  shape="square"
                />
                <span className="text-[10.5px] font-medium text-slate-500">{cut.year}</span>
              </div>
            ))}
          </div>
          <span className="text-[11.5px] text-slate-500 break-keep">
            기존 사진을 지우시려면 우측 상단 <strong>[내 프로필 ➔ 여권]</strong>에서 휴지통 아이콘을 눌러 주세요.
          </span>
        </div>
      )}

      {inlineNotice && (
        <div className="px-3 py-2 rounded-lg bg-teal-50 border border-teal-200 text-[12px] font-medium text-teal-900 break-keep">
          {inlineNotice}
        </div>
      )}

      {people.map((c) => {
        const cuts = pendingCutsFor(c, regState);
        const mergeTargetId = mergeTargets[c.clusterId] || '';
        const mergedTarget = mergeTargetId
          ? availableMergeTargets.find((t) => t.clusterId === mergeTargetId) || null
          : null;
        const checkedCountForCard = cuts.filter((cut) => !unchecked.has(cutKey(c.clusterId, cut))).length;
        const nameValue = names[c.clusterId] ?? (mode === 'self' ? savedRealName : c.registeredName || '');
        const showNameInput = (mode === 'family' || !savedRealName) && !mergedTarget;
        return (
          <div
            key={c.clusterId}
            className={`flex flex-col gap-2.5 p-3 rounded-lg border ${
              mergedTarget ? 'border-teal-300 bg-teal-50/60' : 'border-slate-200 bg-slate-50'
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
              {mergedTarget && (
                <div className="flex-1 min-w-[180px] flex items-center gap-1.5 px-3 min-h-9 py-1.5 rounded-lg bg-teal-100/80 border border-teal-300 text-teal-900 text-[12px] font-semibold break-keep">
                  <span>🔗</span>
                  <span>
                    {mergedTarget.isSelf
                      ? `내 사진으로 선택됨 — 체크된 ${checkedCountForCard}장을 내 여권(${mergedTarget.label})에 합쳐요`
                      : `이미 등록한 ${mergedTarget.label}님과 같은 분으로 선택됨 — 체크된 ${checkedCountForCard}장을 원래 여권에 합쳐요`}
                  </span>
                </div>
              )}
              {showNameInput && (
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
                  {mergedTarget ? (
                    <>
                      <button
                        type="button"
                        disabled={busy || checkedCountForCard === 0}
                        onClick={() => void handleInstantMerge(c, mergedTarget.clusterId)}
                        className="px-3 py-1.5 rounded-md text-[11.5px] font-bold bg-teal-700 hover:bg-teal-800 text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {mergedTarget.isSelf ? '✅ 내 여권에 바로 합치기' : '✅ 원래 여권에 바로 합치기'}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          setMergeTargets((prev) => {
                            const next = { ...prev };
                            delete next[c.clusterId];
                            return next;
                          })
                        }
                        className="px-2.5 py-1.5 rounded-md text-[11.5px] font-medium border border-slate-200 bg-white text-slate-600 hover:text-slate-900 cursor-pointer"
                      >
                        취소
                      </button>
                    </>
                  ) : (
                    <>
                      {selfMergeTarget && (
                        <button
                          type="button"
                          onClick={() =>
                            setMergeTargets((prev) => ({ ...prev, [c.clusterId]: selfMergeTarget.clusterId }))
                          }
                          className="px-2.5 py-1.5 rounded-md text-[11.5px] font-semibold border border-teal-300 bg-white text-teal-800 hover:bg-teal-50 cursor-pointer transition-colors"
                        >
                          👤 내 사진이에요 (내 여권에 합치기)
                        </button>
                      )}
                      {familyMergeTargets.length > 0 && (
                        <select
                          aria-label="이미 등록한 같은 분 여권에 합치기"
                          value=""
                          onChange={(e) => {
                            const val = e.target.value;
                            if (!val) return;
                            setMergeTargets((prev) => ({ ...prev, [c.clusterId]: val }));
                          }}
                          className="h-[30px] px-2 rounded-md text-[11.5px] font-medium border border-slate-200 bg-white text-slate-700 hover:border-slate-400 outline-none cursor-pointer"
                        >
                          <option value="">이미 등록한 같은 분과 합치기</option>
                          {familyMergeTargets.map((t) => (
                            <option key={t.clusterId} value={t.clusterId}>
                              {t.label}님과 같은 분이에요 (합치기)
                            </option>
                          ))}
                        </select>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          dismissFamilyCandidateImmediately(c, cuts);
                          setJustDismissed((prev) => ({ ...prev, [c.clusterId]: { cluster: c, cuts } }));
                          setMergeTargets((mt) => {
                            if (!mt[c.clusterId]) return mt;
                            const copy = { ...mt };
                            delete copy[c.clusterId];
                            return copy;
                          });
                          setRegTick((n) => n + 1);
                        }}
                        className="px-2.5 py-1.5 rounded-md text-[11.5px] font-medium border border-slate-200 bg-white text-slate-600 hover:text-slate-900 cursor-pointer"
                      >
                        제외
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            {cuts.length > 0 && (
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

      {mode === 'family' &&
        dismissedList.map(({ cluster: c, cuts }) => (
          <div
            key={`dismissed_${c.clusterId}`}
            className="flex items-center gap-2.5 p-3 rounded-lg border border-dashed border-slate-300 opacity-65"
          >
            <AutonomousCanvasFaceAvatar
              photoFile={c.representativePhoto}
              boundingBox={c.boundingBox}
              fallbackAvatarUrl={c.avatarUrl || c.cropUrl}
              altText="제외된 얼굴"
              sizeClass="w-10 h-10"
            />
            <span className="text-[12px] text-slate-600 break-keep">
              제외 완료 — 앞으로 이 얼굴은 다시 묻지 않아요.
            </span>
            <button
              type="button"
              onClick={() => {
                undoDismissFamilyCandidate(c, cuts);
                setJustDismissed((prev) => {
                  const next = { ...prev };
                  delete next[c.clusterId];
                  return next;
                });
                setRegTick((n) => n + 1);
              }}
              className="ml-auto px-2.5 py-1.5 rounded-md text-[11.5px] font-medium border border-slate-200 bg-white text-slate-700 hover:text-slate-900 cursor-pointer shrink-0"
            >
              되돌리기
            </button>
          </div>
        ))}

      {mode === 'self' && selfCluster && totalPendingCutCount > 0 && selectedCutCount === 0 && (
        <p className="text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 break-keep">
          선택된 내 사진이 0장입니다. 내 사진이 1장 이상 체크되어 있어야 등록되며, 다른 분 사진이라면 왼쪽 아래 <strong>[다른 얼굴 고르기]</strong>를 눌러 주세요.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 pt-0.5">
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
              className="px-3 py-2 rounded-lg text-[12.5px] font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              다른 얼굴 고르기
            </button>
          )}
        {mode === 'self' && (pickCandidates.length > 0 || totalPendingCutCount > 0) && (
          <button
            type="button"
            disabled={manualUploading}
            onClick={() =>
              triggerGlobalPassportFileInputClick(
                (selfCluster ? names[selfCluster.clusterId] : manualRealName) || savedRealName
              )
            }
            className="mr-auto px-3 py-2 rounded-lg text-[12px] font-semibold border border-teal-200 bg-teal-50/70 hover:bg-teal-100/70 text-teal-800 cursor-pointer disabled:opacity-50"
          >
            {manualUploading ? '얼굴 확인 중...' : '📁 사진 1장 직접 고르기'}
          </button>
        )}
        <button
          type="button"
          onClick={() => close(people.length > 0)}
          className="px-3.5 py-2 rounded-lg text-[12.5px] font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
        >
          {people.length === 0 ? '닫기' : mode === 'self' ? '나중에' : '다음에'}
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
              : mode === 'family' && mergedSelectedCutCount > 0 && mergedSelectedCutCount === selectedCutCount
              ? '원래 여권에 합쳐서 저장'
              : '등록'}
          </button>
        )}
      </div>
    </section>
  );
};

export default PassportRegistrationPanel;
