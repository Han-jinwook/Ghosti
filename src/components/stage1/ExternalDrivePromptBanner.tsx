import React, { useEffect, useState } from 'react';
import { isCapacitorNativeMobileRuntime } from '../../services/ghostiMobileCareBridge';
import { zCoreBridge } from '../../services/zCoreBridge';

interface ExternalDriveBannerState {
  status: 'prompt' | 'indexing' | 'completed';
  volId?: string;
  drive?: string;
  label?: string;
  estFiles?: number;
  estMin?: number;
  pct?: number;
  count?: number;
}

export const ExternalDrivePromptBanner: React.FC<{ forceSampleOnly?: boolean }> = React.memo(
  ({ forceSampleOnly = false }) => {
    const [banner, setBanner] = useState<ExternalDriveBannerState | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
      if (forceSampleOnly || isCapacitorNativeMobileRuntime()) return;
      let cancelled = false;
      let timerId: number | null = null;

      const poll = async () => {
        if (cancelled) return;
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          timerId = window.setTimeout(poll, 15000);
          return;
        }
        if (!zCoreBridge.isConnected) {
          setBanner(null);
          timerId = window.setTimeout(poll, 12000);
          return;
        }
        try {
          const res = await fetch('http://127.0.0.1:5199/__zcore/external-drives', {
            method: 'GET',
            cache: 'no-store',
          });
          if (res.ok) {
            const data = await res.json();
            if (!cancelled) {
              const nextBanner: ExternalDriveBannerState | null = data?.banner || null;
              setBanner(nextBanner);
              const nextMs = nextBanner?.status === 'indexing' ? 2000 : 15000;
              timerId = window.setTimeout(poll, nextMs);
              return;
            }
          }
        } catch {
          // Z-코어 미응답 시 조용히 대기
        }
        if (!cancelled) {
          timerId = window.setTimeout(poll, 15000);
        }
      };

      const onVis = () => {
        if (document.visibilityState === 'visible') {
          if (timerId !== null) window.clearTimeout(timerId);
          void poll();
        }
      };

      void poll();
      document.addEventListener('visibilitychange', onVis);
      return () => {
        cancelled = true;
        if (timerId !== null) window.clearTimeout(timerId);
        document.removeEventListener('visibilitychange', onVis);
      };
    }, [forceSampleOnly]);

    if (!banner) return null;

    const handleDecide = async (decision: 'included' | 'excluded') => {
      if (!banner.volId || busy) return;
      setBusy(true);
      try {
        const res = await fetch('http://127.0.0.1:5199/__zcore/external-drives/decide', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            volId: banner.volId,
            drive: banner.drive || '',
            decision,
          }),
        });
        if (res.ok) {
          if (decision === 'included') {
            setBanner({
              status: 'indexing',
              volId: banner.volId,
              drive: banner.drive,
              estMin: banner.estMin || 1,
              pct: 10,
            });
          } else {
            setBanner(null);
          }
        }
      } catch {
        // 무시
      } finally {
        setBusy(false);
      }
    };

    if (banner.status === 'indexing') {
      return (
        <div className="w-full px-3.5 py-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 flex flex-wrap items-center justify-between gap-2 text-[12.5px] font-semibold">
          <span>
            ⏳ 외장 드라이브({banner.drive}) 인덱싱 중 ({banner.pct ?? 10}% · 약 {banner.estMin ?? 1}분 소요) — 완료 안내가 뜰 때까지 절대 USB를 뽑지 마세요!
          </span>
        </div>
      );
    }

    if (banner.status === 'completed') {
      return (
        <div className="w-full px-3.5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 flex flex-wrap items-center justify-between gap-2 text-[12.5px] font-semibold">
          <span>
            ✅ 외장 드라이브({banner.drive} · {banner.count ?? 0}건) 인덱싱 완료! 캐시는 내 PC에만 안전 보관되었으며 이제 언제든 USB를 뽑으셔도 됩니다.
          </span>
        </div>
      );
    }

    return (
      <div className="w-full px-3.5 py-2.5 rounded-xl bg-teal-50 border border-teal-300 text-teal-950 flex flex-wrap items-center justify-between gap-2.5 text-[12.5px]">
        <span className="font-semibold">
          🔌 외장 드라이브({banner.drive} · 파일 약 {banner.estFiles ?? 0}건)도 귀신검색에 포함할까요? (약 {banner.estMin ?? 1}분 소요 · 진행 중 탈착 금지)
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleDecide('included')}
            className="px-3 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12px] font-bold transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            검색에 포함
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleDecide('excluded')}
            className="px-3 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-[12px] font-semibold transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            제외(다시 묻지 않음)
          </button>
        </div>
      </div>
    );
  }
);
