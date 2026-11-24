import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';
import { AutonomousCanvasFaceAvatar } from './FaceMemberRegistryModal';
import { loadGhostPassportBook, loadGhostSecretaryState } from '../services/ghostSecretaryEngine';
import type { FaceMemberCluster, YearlyFaceBestCut } from '../types/saysee';
import {
  PASSPORT_REG_OPEN_EVENT,
  PASSPORT_REG_STATE_EVENT,
  consumePendingPassportOpen,
  cutKey,
  familyCandidates,
  findSelfCluster,
  loadPassportRegState,
  pendingCutsFor,
  pickSelfCluster,
  rankFaceClusters,
  resetSelfClusterPick,
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

  const handleSubmit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await submitPassportRegistration(
        mode,
        people.map((c) => {
          const cuts = pendingCutsFor(c, regState);
          const isDismissed = dismissed.has(c.clusterId);
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
              : '가족으로 보이는 얼굴입니다. 아닌 분은 제외해 주세요.'}
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
        const nameValue = names[c.clusterId] ?? (mode === 'self' ? savedRealName : c.registeredName || '');
        const showNameInput = mode === 'family' || !savedRealName;
        return (
          <div
            key={c.clusterId}
            className={`flex flex-col gap-2.5 p-3 rounded-lg border ${
              isDismissed
                ? 'opacity-45 border-dashed border-slate-300'
                : 'border-slate-200 bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2.5 flex-wrap">
              {mode === 'family' && (
                <AutonomousCanvasFaceAvatar
                  photoFile={c.representativePhoto}
                  boundingBox={c.boundingBox}
                  fallbackAvatarUrl={c.avatarUrl || c.cropUrl}
                  altText="가족 얼굴"
                  sizeClass="w-11 h-11"
                />
              )}
              {showNameInput && !isDismissed && (
                <input
                  type="text"
                  value={nameValue}
                  maxLength={18}
                  onChange={(e) => setNames((prev) => ({ ...prev, [c.clusterId]: e.target.value }))}
                  placeholder="이름 (선택)"
                  className="flex-1 min-w-[140px] h-9 px-3 rounded-lg bg-white border border-slate-300 focus:border-slate-600 outline-none text-[13px] text-slate-900 placeholder:text-slate-400"
                />
              )}
              {mode === 'self' && rankFaceClusters(faceClusters || []).length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    resetSelfClusterPick();
                    setUnchecked(new Set());
                    setRegTick((n) => n + 1);
                  }}
                  className="ml-auto px-2.5 py-1 rounded-md text-[11.5px] font-medium border border-slate-200 bg-white text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  다른 얼굴 고르기
                </button>
              )}
              {mode === 'family' && (
                <button
                  type="button"
                  onClick={() =>
                    setDismissed((prev) => {
                      const next = new Set(prev);
                      if (next.has(c.clusterId)) next.delete(c.clusterId);
                      else next.add(c.clusterId);
                      return next;
                    })
                  }
                  className="ml-auto px-2.5 py-1 rounded-md text-[11.5px] font-medium border border-slate-200 bg-white text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  {isDismissed ? '되돌리기' : '제외'}
                </button>
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

      <div className="flex items-center justify-end gap-2 pt-0.5">
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
            disabled={busy}
            onClick={() => void handleSubmit()}
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[12.5px] font-semibold cursor-pointer disabled:opacity-50"
          >
            {busy ? '등록 중...' : '등록'}
          </button>
        )}
      </div>
    </section>
  );
};

export default PassportRegistrationPanel;
