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
  submitPassportRegistration,
  type PassportRegMode,
} from '../services/passportRegistrationFlow';

export const PASSPORT_REG_DEFERRED_EVENT = 'ghosti_passport_reg_deferred';

/**
 * 🪪 [D-35] 시기별 다양한 여권사진 등록 — 귀신비서 왼쪽 화면 (조용한 등록)
 *  - 비서가 묻거나, 유저가 "여권 등록" 등으로 말하거나, 검색창 칩을 눌렀을 때만 열린다.
 *  - 사진은 기본 전부 체크 → 아닌 것만 빼고 [등록] 1번.
 *  - 슬롯·바구니 등 내부 용어는 화면에 쓰지 않는다.
 */
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

  // 열 거리가 없으면 조용히 닫는다 (빈 화면 노출 금지)
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

  const title = '🪪 시기별 다양한 여권사진 등록';

  return (
    <section ref={sectionRef} className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#18181B] border-2 border-primary-container/70 shadow-md flex flex-col gap-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <h2 className="text-[15.5px] sm:text-[16.5px] font-extrabold text-zinc-900 dark:text-white break-keep">{title}</h2>
          <p className="text-[12.5px] text-zinc-500 dark:text-zinc-400 break-keep">
            {mode === 'self'
              ? selfCluster
                ? `${nickname ? `${nickname}님` : '내'} 얼굴로 보이는 사진이에요. 아닌 것만 빼주세요.`
                : `${nickname ? `${nickname}님` : '내'} 얼굴을 골라주세요.`
              : '가족으로 보이는 얼굴이에요. 아닌 분은 빼주세요.'}
          </p>
        </div>
        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-300 shrink-0">🔒 내 기기 안에서만</span>
      </div>

      {/* 1단계: 내 얼굴 고르기 */}
      {mode === 'self' && !selfCluster && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
          {pickCandidates.map((c) => (
            <button
              key={c.clusterId}
              type="button"
              onClick={() => {
                pickSelfCluster(c.clusterId);
                setRegTick((n) => n + 1);
              }}
              className="flex flex-col items-center gap-1 p-1.5 rounded-xl hover:bg-primary-container/10 border border-transparent hover:border-primary-container/50 cursor-pointer transition-all"
            >
              <AutonomousCanvasFaceAvatar
                photoFile={c.representativePhoto}
                boundingBox={c.boundingBox}
                fallbackAvatarUrl={c.avatarUrl || c.cropUrl}
                altText="얼굴 후보"
                sizeClass="w-16 h-16"
                shape="square"
              />
              <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-300">이게 나예요</span>
            </button>
          ))}
        </div>
      )}

      {/* 2단계: 시기별 사진 확인 (내 것 또는 가족) */}
      {people.map((c) => {
        const cuts = pendingCutsFor(c, regState);
        const isDismissed = dismissed.has(c.clusterId);
        const nameValue = names[c.clusterId] ?? (mode === 'self' ? savedRealName : c.registeredName || '');
        const showNameInput = mode === 'family' || !savedRealName;
        return (
          <div
            key={c.clusterId}
            className={`flex flex-col gap-2.5 p-3 rounded-xl border ${
              isDismissed
                ? 'opacity-45 border-dashed border-zinc-300 dark:border-white/15'
                : 'border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-950/60'
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
                  className="flex-1 min-w-[140px] h-9 px-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 focus:border-primary-container outline-none text-[13px] text-zinc-900 dark:text-white placeholder:text-zinc-400"
                />
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
                  className="ml-auto px-2.5 py-1 rounded-lg text-[11.5px] font-bold border border-zinc-300 dark:border-white/15 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white cursor-pointer"
                >
                  {isDismissed ? '되돌리기' : '이분은 빼기'}
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
                        className={`absolute top-0.5 right-0.5 w-5 h-5 rounded-full text-[11px] font-extrabold flex items-center justify-center ${
                          checked ? 'bg-primary-container text-zinc-950' : 'bg-zinc-700 text-zinc-300'
                        }`}
                      >
                        {checked ? '✓' : ''}
                      </span>
                      <span className="text-[10.5px] font-bold text-zinc-500 dark:text-zinc-400">{cut.year}</span>
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
          className="px-3.5 py-2 rounded-xl text-[12.5px] font-bold border border-zinc-300 dark:border-white/15 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
        >
          {mode === 'self' ? '나중에' : '다음에'}
        </button>
        {people.length > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleSubmit()}
            className="px-4 py-2 rounded-xl bg-primary-container hover:opacity-95 text-zinc-950 text-[12.5px] font-extrabold cursor-pointer disabled:opacity-50"
          >
            {busy ? '등록 중...' : '등록'}
          </button>
        )}
      </div>
    </section>
  );
};

export default PassportRegistrationPanel;
