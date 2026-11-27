import React, { useEffect, useState } from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';
import { getZCoreUrl, zCoreBridge } from '../services/zCoreBridge';
import {
  buildExpiredLossAversionSummary,
  evaluateProFeatureGate,
  recordProFeatureUsage,
} from '../services/proFeatureGate';
import { markGhostDojoStep } from './ghostDojo/ghostSearchDojoShared';
import { recognizeDataUrlWithPaddleOcr } from '../services/ai/aiPaddleOcrEngine';
import type { PhotoItem } from '../types/saysee';

export const GhostBabyMascotBadge: React.FC<{ subtitle?: string }> = ({ subtitle }) => (
  <div className="inline-flex items-center gap-2 select-none">
    <img
      src="/gwisinkachi_app_icon_512.png"
      alt="귀신같이"
      className="w-6 h-6 rounded-md border border-black/10 object-cover shrink-0"
    />
    <div className="flex flex-col leading-none">
      <span className="text-[13.5px] font-bold tracking-tight text-slate-900">
        사진·표 글자 추출 (OCR)
      </span>
      {subtitle && (
        <span className="text-[11px] text-slate-500 mt-0.5">{subtitle}</span>
      )}
    </div>
  </div>
);

interface RealPhotoOcrSpot {
  id: string;
  categoryHint: string;
  displayText: string;
  insertValue: string;
  isPrimaryHighlight?: boolean;
}

interface RealPhotoOcrResponse {
  ok: boolean;
  hasText: boolean;
  hasTable?: boolean;
  fullText: string;
  tsvTable: string;
  spots?: RealPhotoOcrSpot[];
  chips?: string[];
  cached?: boolean;
  error?: string;
}

function extractLocalPhotoPathParam(photo: PhotoItem): string {
  for (const rawUrl of [photo.fullUrl, photo.thumbUrl]) {
    if (!rawUrl) continue;
    try {
      const u = new URL(rawUrl, typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1:5199');
      const pVal = u.searchParams.get('p');
      if (pVal && pVal.trim()) return pVal.trim();
    } catch {
      const m = rawUrl.match(/[?&]p=([^&]+)/);
      if (m && m[1]) {
        try {
          return decodeURIComponent(m[1]).trim();
        } catch {
          return m[1].trim();
        }
      }
    }
  }
  return photo.name;
}

export const GhostPhotoOcrTeleportModal: React.FC<{
  photo: PhotoItem | null;
  onClose: () => void;
}> = ({ photo, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<RealPhotoOcrResponse | null>(null);
  const [gateState, setGateState] = useState<'checking' | 'allowed' | 'need_opt_in' | 'expired'>('allowed');
  const [gateMessage, setGateMessage] = useState<string>('');
  const [trialBadge, setTrialBadge] = useState<string>('');
  const [copiedNotice, setCopiedNotice] = useState<string>('');
  const [cursorBuffer, setCursorBuffer] = useState<string>('');
  const [reloadSeq, setReloadSeq] = useState(0);

  const isDemoSamplePhoto = Boolean(
    photo &&
      (photo.fullUrl?.startsWith('/sample_photos_301/') ||
        photo.thumbUrl?.startsWith('/sample_photos_301/'))
  );

  useEffect(() => {
    if (!photo || isDemoSamplePhoto) {
      setOcrResult(null);
      setCopiedNotice('');
      setCursorBuffer('');
      return;
    }

    let cancelled = false;
    const runRealOcrFlow = async () => {
      setLoading(true);
      setCopiedNotice('');
      setOcrResult(null);
      setGateState('checking');
      try {
        const storeState = useSaySeeStore.getState();
        const ent = storeState.deviceEntitlement;
        const hubToken = storeState.merlinAuth?.token || '';
        const isSubFromStore = Boolean(ent?.isPaidUnlimited);

        const gateOutcome = await evaluateProFeatureGate({
          actionType: 'feat_6_screen_ocr',
          filePath: photo.fullPath || extractLocalPhotoPathParam(photo),
          allowSDriveFree: true,
        });
        if (cancelled) return;
        if (!gateOutcome.allowed) {
          setGateState(gateOutcome.state);
          setGateMessage(gateOutcome.message);
          setLoading(false);
          return;
        }
        if (gateOutcome.trialBadge) {
          setTrialBadge(gateOutcome.trialBadge);
        }
        setGateState('allowed');
        markGhostDojoStep('ocr');

        if (zCoreBridge.isConnected) {
          const targetKey = extractLocalPhotoPathParam(photo);
          const res = await fetch(getZCoreUrl('/__photos/ocr'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              p: targetKey,
              fullPath: photo.fullPath || '',
              isSubscribed: isSubFromStore,
              hubToken,
              accountId: storeState.merlinAuth?.email || 'local_user',
            }),
          });
          const data = (await res.json().catch(() => null)) as RealPhotoOcrResponse | null;
          if (cancelled) return;
          if (res.ok && data && data.ok) {
            setOcrResult(data);
          } else {
            setOcrResult({
              ok: false,
              hasText: false,
              fullText: '',
              tsvTable: '',
              spots: [],
              chips: [],
              error: data?.error || '글자 인식에 실패했습니다.',
            });
          }
        } else {
          const imgUrl = photo.fullUrl || photo.thumbUrl;
          if (!imgUrl) {
            setOcrResult({ ok: false, hasText: false, fullText: '', tsvTable: '', spots: [], chips: [] });
            return;
          }
          const webOcr = await recognizeDataUrlWithPaddleOcr(imgUrl);
          if (cancelled) return;
          const ft = String(webOcr.text || '').trim();
          const webChips = ft ? Array.from(new Set(ft.split(/[\s\n]+/).filter((w) => w.length >= 2))).slice(0, 18) : [];
          if (!isDemoSamplePhoto) recordProFeatureUsage('feat_6_screen_ocr');
          setOcrResult({
            ok: true,
            hasText: ft.length > 0,
            fullText: ft,
            tsvTable: ft ? ft.replace(/  +/g, '\t') : '',
            spots: [],
            chips: webChips,
          });
        }
      } catch {
        if (!cancelled) {
          setOcrResult({
            ok: false,
            hasText: false,
            fullText: '',
            tsvTable: '',
            spots: [],
            chips: [],
            error: '응답을 기다리는 중 오류가 발생했습니다.',
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void runRealOcrFlow();
    return () => {
      cancelled = true;
    };
  }, [photo, isDemoSamplePhoto, reloadSeq]);

  if (!photo) return null;

  const handleStart30DayTrial = async () => {
    try {
      const st = useSaySeeStore.getState();
      const accountEmail = st.merlinAuth?.email || 'local_user';
      await fetch(getZCoreUrl('/api/superpower/start-trial'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agreed: true,
          optIn: true,
          hubToken: st.merlinAuth?.token || '',
          accountId: accountEmail,
        }),
      });
    } catch {
      /* ignore */
    }
    setGateState('allowed');
    setReloadSeq((s) => s + 1);
  };

  const handleDownloadOcrTextFile = (ext: 'txt' | 'tsv') => {
    if (!ocrResult) return;
    const rawContent =
      ext === 'tsv'
        ? ocrResult.tsvTable || ocrResult.fullText
        : ocrResult.fullText || ocrResult.tsvTable;
    if (!rawContent.trim()) return;
    const base = (photo.name || 'ocr_result').replace(/\.[^.]+$/, '');
    const blob = new Blob([ext === 'tsv' ? `\uFEFF${rawContent}` : rawContent], {
      type: ext === 'tsv' ? 'text/tab-separated-values;charset=utf-8' : 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${base}_OCR.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 2500);
    setCopiedNotice(`${base}_OCR.${ext} 파일이 저장되었습니다.`);
  };

  const handleDownloadOriginalPhoto = async () => {
    const srcUrl = photo.fullUrl || photo.thumbUrl;
    if (!srcUrl) return;
    const fileName = photo.name || 'ghosti_photo.png';
    try {
      const resp = await fetch(srcUrl);
      if (resp.ok) {
        const blob = await resp.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);
        setCopiedNotice(`원본 사진(${fileName})이 저장되었습니다.`);
        useSaySeeStore.setState({
          lastQuarantineToast: `원본 사진(${fileName})이 저장되었습니다.`,
        });
        return;
      }
    } catch {
      /* fallback below */
    }
    const a = document.createElement('a');
    a.href = srcUrl;
    a.download = fileName;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const copyTextWithFallback = async (val: string): Promise<boolean> => {
    let copied = false;
    if (zCoreBridge.isConnected) {
      try {
        const res = await fetch(getZCoreUrl('/__merlin/clipboard'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: val }),
          signal: AbortSignal.timeout(1500),
        });
        if (res.ok) copied = true;
      } catch {
        /* fallback below */
      }
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(val);
        copied = true;
      } catch {
        /* fallback below */
      }
    }
    if (typeof document !== 'undefined') {
      try {
        const ta = document.createElement('textarea');
        ta.value = val;
        ta.setAttribute('readonly', 'true');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        ta.style.top = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        if (document.execCommand('copy')) {
          copied = true;
        }
        document.body.removeChild(ta);
      } catch {
        /* ignore */
      }
    }
    return copied;
  };

  const handleCopyOriginalPhoto = async () => {
    const fileName = photo.name || 'ghosti_photo.png';
    if (zCoreBridge.isConnected) {
      try {
        const targetKey = photo.fullPath || extractLocalPhotoPathParam(photo);
        const res = await fetch(getZCoreUrl('/__merlin/clipboard'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: targetKey, p: extractLocalPhotoPathParam(photo) }),
          signal: AbortSignal.timeout(2000),
        });
        if (res.ok) {
          setCopiedNotice(`원본 사진(${fileName})이 클립보드에 복사되었습니다.`);
          useSaySeeStore.setState({
            lastQuarantineToast: `원본 사진(${fileName}) 복사 완료`,
          });
          return;
        }
      } catch {
        /* fallback below */
      }
    }
    await handleDownloadOriginalPhoto();
  };

  const handleCopyText = async (val: string, label: string) => {
    if (!val.trim()) return;
    await copyTextWithFallback(val);
    setCursorBuffer((prev) => (prev ? `${prev} / ${val}` : val));
    setCopiedNotice(`${label} 내용이 클립보드에 복사되었습니다.`);
    useSaySeeStore.setState({
      lastQuarantineToast: `${label} 복사 완료`,
    });
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[130] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 shadow-2xl flex flex-col gap-4 my-auto text-slate-900"
      >
        {/* 헤더 */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <GhostBabyMascotBadge />
            <span className="text-[13px] text-slate-500 truncate">{photo.name}</span>
            {trialBadge && (
              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px] font-medium shrink-0">
                {trialBadge}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer shrink-0"
          >
            ✕
          </button>
        </div>

        {isDemoSamplePhoto ? (
          <div className="flex flex-col gap-3">
            <div className="px-3.5 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-[12.5px]">
              현재 샘플 사진 또는 PC 엔진 미연결 상태입니다. PC 엔진을 연결한 뒤 실제 영수증·문서 사진을 선택하면 글자와 표를 추출할 수 있습니다.
            </div>
            <div className="p-4 rounded-xl bg-slate-50/60 border border-slate-200 flex flex-col sm:flex-row items-center gap-4">
              <img
                src={photo.fullUrl || photo.thumbUrl}
                alt={photo.name}
                className="w-full sm:w-52 max-h-52 rounded-lg object-contain bg-slate-900 border border-slate-200 shrink-0"
              />
              <div className="flex flex-col gap-1.5 text-[13px] text-slate-600">
                <div className="font-semibold text-slate-900">{photo.name}</div>
                <p className="leading-relaxed">
                  PC 연결 후 사진의 [OCR] 버튼을 누르면 이미지 속 글자와 표를 복사하거나 파일로 저장할 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        ) : gateState === 'need_opt_in' ? (
          <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center text-center gap-3.5">
            <span className="px-2.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600 text-[11.5px] font-medium">
              30일 무료체험 안내
            </span>
            <h3 className="text-[16px] font-bold text-slate-900 max-w-lg leading-snug">{gateMessage}</h3>
            <p className="text-[12.5px] text-slate-500 max-w-lg">
              체험 기간 종료 후 자동으로 결제되지 않으며, 기본 사진·문서·영상 검색은 계속 무료로 이용할 수 있습니다.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => void handleStart30DayTrial()}
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[13px] font-semibold cursor-pointer"
              >
                30일 무료체험 시작
              </button>
              <button
                type="button"
                onClick={() => void handleDownloadOriginalPhoto()}
                className="px-4 py-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[12.5px] font-medium cursor-pointer"
              >
                원본 사진 저장
              </button>
            </div>
          </div>
        ) : gateState === 'expired' ? (
          (() => {
            const scorecard = buildExpiredLossAversionSummary('feat_6_screen_ocr');
            return (
              <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center text-center gap-3.5">
                <span className="px-2.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600 text-[11.5px] font-medium">
                  무료체험 종료
                </span>
                <h3 className="text-[16px] font-bold text-slate-900 max-w-lg leading-snug">
                  {scorecard.hasScorecard ? scorecard.headline : gateMessage || scorecard.headline}
                </h3>
                {scorecard.hasScorecard && scorecard.detailLine && (
                  <p className="text-[12.5px] text-slate-500 max-w-lg">
                    {scorecard.detailLine}
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      useSaySeeStore.getState().setShowProModal(true);
                    }}
                    className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[13px] font-semibold cursor-pointer"
                  >
                    내 기기 통합 Pro 안내 보기
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDownloadOriginalPhoto()}
                    className="px-4 py-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[12.5px] font-medium cursor-pointer"
                  >
                    원본 사진 저장
                  </button>
                </div>
              </div>
            );
          })()
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* 좌측 */}
            <div className="lg:col-span-5 rounded-xl bg-slate-50 border border-slate-200 p-4 flex flex-col justify-between gap-3">
              <div
                data-keep-dark="true"
                className="relative rounded-lg overflow-hidden bg-slate-950 border border-slate-200 min-h-[220px] max-h-[340px] flex items-center justify-center"
              >
                <img
                  src={photo.fullUrl || photo.thumbUrl}
                  alt={photo.name}
                  className="max-h-[330px] w-auto object-contain"
                />
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={loading || !ocrResult?.hasText}
                  onClick={() =>
                    void handleCopyText(
                      ocrResult?.tsvTable || ocrResult?.fullText || '',
                      '표 전체 엑셀(TSV)'
                    )
                  }
                  className="w-full py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-[12.5px] font-semibold cursor-pointer"
                >
                  표 전체 엑셀(TSV)로 복사{ocrResult?.hasTable ? ' (표 감지됨)' : ''}
                </button>
                <button
                  type="button"
                  disabled={loading || !ocrResult?.hasText}
                  onClick={() =>
                    void handleCopyText(ocrResult?.fullText || '', '전체 텍스트')
                  }
                  className="w-full py-2 px-3 rounded-lg bg-white hover:bg-slate-100 disabled:opacity-40 border border-slate-200 text-slate-800 text-[12.5px] font-medium cursor-pointer"
                >
                  전체 텍스트 복사
                </button>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => void handleCopyOriginalPhoto()}
                    className="w-full py-2 px-2.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[12px] font-medium text-center cursor-pointer"
                  >
                    원본 사진 복사
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDownloadOriginalPhoto()}
                    className="w-full py-2 px-2.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 text-[12px] font-medium text-center cursor-pointer"
                  >
                    원본 사진 저장
                  </button>
                </div>
              </div>
            </div>

            {/* 우측 */}
            <div className="lg:col-span-7 rounded-xl bg-white border border-slate-200 p-4 flex flex-col justify-between gap-3">
              {loading ? (
                <div className="flex-1 min-h-[240px] flex flex-col items-center justify-center text-center gap-2.5 p-6">
                  <div className="w-7 h-7 rounded-full border-2 border-slate-900 border-t-transparent animate-spin" />
                  <p className="text-[13.5px] font-semibold text-slate-800">
                    사진 속 글자와 표를 읽고 있습니다...
                  </p>
                </div>
              ) : !ocrResult?.hasText ? (
                <div className="flex-1 min-h-[240px] flex flex-col items-center justify-center text-center gap-2 p-6">
                  <h4 className="text-[14.5px] font-semibold text-slate-900">
                    인식된 글자나 표가 없습니다
                  </h4>
                  <p className="text-[12.5px] text-slate-500 max-w-sm leading-relaxed">
                    글자가 없는 일반 사진은 왼쪽의 [원본 사진 저장]을 이용해 주세요.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {ocrResult.spots && ocrResult.spots.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[12px] font-semibold text-slate-700">
                        주요 항목 (클릭하여 복사)
                      </span>
                      <div className="flex flex-col gap-1.5 max-h-[160px] overflow-y-auto pr-1">
                        {ocrResult.spots.map((sp) => {
                          const rawSp = sp as unknown as Record<string, string | undefined>;
                          const hintLabel = sp.categoryHint || rawSp.label || '항목';
                          const dispVal = sp.displayText || rawSp.value || '';
                          const insertVal = sp.insertValue || rawSp.value || dispVal;
                          if (!dispVal) return null;
                          return (
                            <button
                              key={sp.id}
                              type="button"
                              onClick={() => void handleCopyText(insertVal, hintLabel)}
                              className="w-full text-left px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-between gap-2 cursor-pointer transition-colors"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600 text-[10.5px] font-medium shrink-0">
                                  {hintLabel}
                                </span>
                                <span className="font-mono text-[12px] text-slate-900 font-medium truncate">
                                  {dispVal}
                                </span>
                              </div>
                              <span className="text-[11px] font-medium text-slate-500 shrink-0">복사</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {ocrResult.chips && ocrResult.chips.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[12px] font-semibold text-slate-700">
                        단어 선택 복사
                      </span>
                      <div className="flex flex-wrap gap-1.5 max-h-[105px] overflow-y-auto">
                        {ocrResult.chips.map((ch, idx) => (
                          <button
                            key={`${ch}_${idx}`}
                            type="button"
                            onClick={() => void handleCopyText(ch, `"${ch}"`)}
                            className="px-2.5 py-1 rounded-md bg-slate-50 hover:bg-slate-900 text-slate-700 hover:text-white border border-slate-200 text-[12px] font-medium cursor-pointer transition-colors"
                          >
                            {ch}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[12px] font-semibold text-slate-700">
                        추출 원문
                      </span>
                      <div className="flex items-center gap-1.5">
                        {ocrResult.tsvTable && (
                          <button
                            type="button"
                            onClick={() => handleDownloadOcrTextFile('tsv')}
                            className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[11px] font-medium cursor-pointer"
                          >
                            표 파일(.tsv) 저장
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDownloadOcrTextFile('txt')}
                          className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[11px] font-medium cursor-pointer"
                        >
                          텍스트(.txt) 저장
                        </button>
                      </div>
                    </div>
                    <pre className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-[12px] text-slate-800 font-mono whitespace-pre-wrap max-h-[150px] overflow-y-auto leading-relaxed">
                      {ocrResult.tsvTable || ocrResult.fullText}
                    </pre>
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 flex flex-col gap-1.5">
                {copiedNotice && (
                  <span className="text-[12px] font-medium text-teal-700">{copiedNotice}</span>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={cursorBuffer}
                    onChange={(e) => setCursorBuffer(e.target.value)}
                    placeholder="선택한 항목이 여기에 모아집니다"
                    className="flex-1 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-[12px] outline-none focus:border-slate-400"
                  />
                  {cursorBuffer && (
                    <button
                      type="button"
                      onClick={() => void handleCopyText(cursorBuffer, '모아둔 텍스트')}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-[11.5px] font-semibold cursor-pointer shrink-0"
                    >
                      전체 복사
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
