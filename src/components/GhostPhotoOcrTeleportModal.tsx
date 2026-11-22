import React, { useEffect, useState } from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';
import { getZCoreUrl, zCoreBridge } from '../services/zCoreBridge';
import { evaluateProFeatureGate } from '../services/proFeatureGate';
import { recognizeDataUrlWithPaddleOcr } from '../services/ai/aiPaddleOcrEngine';
import type { PhotoItem } from '../types/saysee';

export const GhostBabyMascotBadge: React.FC<{ subtitle?: string }> = ({ subtitle }) => (
  <div className="inline-flex items-center gap-2 select-none">
    <div className="relative w-7 h-7 rounded-xl bg-gradient-to-br from-teal-400/25 via-emerald-400/15 to-amber-300/20 border border-teal-300/50 flex items-center justify-center shadow-[0_0_12px_rgba(45,212,191,0.3)] shrink-0">
      <svg viewBox="0 0 36 36" className="w-5 h-5" aria-hidden="true">
        <path
          d="M18 4C11.4 4 6.5 9 6.5 15.6v12.2c0 1.4 1.6 2.2 2.7 1.3l2.2-1.8c.8-.6 1.9-.6 2.7 0l2.1 1.7c.9.8 2.3.8 3.2 0l2.1-1.7c.8-.6 1.9-.6 2.7 0l2.2 1.8c1.1.9 2.7.1 2.7-1.3V15.6C29.5 9 24.6 4 18 4z"
          fill="#F8FAFC"
        />
        <circle cx="14" cy="15.5" r="2" fill="#0F172A" />
        <circle cx="22" cy="15.5" r="2" fill="#0F172A" />
        <circle cx="13.3" cy="14.8" r="0.7" fill="#FFFFFF" />
        <circle cx="21.3" cy="14.8" r="0.7" fill="#FFFFFF" />
        <ellipse cx="11.2" cy="18.2" rx="1.6" ry="0.9" fill="#FB7185" opacity="0.75" />
        <ellipse cx="24.8" cy="18.2" rx="1.6" ry="0.9" fill="#FB7185" opacity="0.75" />
        <path
          d="M15.4 18.8c.8 1.1 1.7 1.6 2.6 1.6s1.8-.5 2.6-1.6"
          stroke="#0F172A"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </div>
    <div className="flex flex-col leading-none">
      <div className="flex items-center gap-1.5">
        <span className="font-headline-sm text-[13.5px] font-black tracking-tight text-white">
          귀신같이
        </span>
        <span className="px-1.5 py-0.5 rounded bg-teal-400/20 border border-teal-300/40 text-teal-200 font-mono text-[10px] font-extrabold">
          Ctrl+0 · Ctrl+우클릭
        </span>
      </div>
      {subtitle && (
        <span className="text-[10.5px] text-zinc-400 font-semibold mt-0.5">{subtitle}</span>
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
        photo.thumbUrl?.startsWith('/sample_photos_301/') ||
        !zCoreBridge.isConnected)
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
        // 1) 유료 티어 30일 Opt-in 무료체험 게이트 점검 (공통 proFeatureGate 연동)
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

        // 2) PC Z-코어 연결 시 PP-OCRv5 + TSV 복원 호출, 미연결 시 웹 온디바이스 PP-OCRv5 폴백!
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
              error: data?.error || '사진 OCR 판독에 실패했습니다.',
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
            error: '로컬 Z-코어 엔진 응답을 기다리는 중 오류가 발생했습니다.',
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
    setCopiedNotice(`✅ ${base}_OCR.${ext} 파일 저장 완료!`);
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
        setCopiedNotice(`✅ 원본 사진(${fileName}) 저장 완료!`);
        useSaySeeStore.setState({
          lastQuarantineToast: `🖼️ 원본 사진(${fileName}) 저장 완료!`,
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

  const handleCopyText = async (val: string, label: string) => {
    if (!val.trim()) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(val);
      } catch {
        /* ignore */
      }
    }
    setCursorBuffer((prev) => (prev ? `${prev} / ${val}` : val));
    setCopiedNotice(`✅ ${label} 클립보드 복사 완료! (원하는 입력창에서 Ctrl+V)`);
    useSaySeeStore.setState({
      lastQuarantineToast: `📋 ${label} 복사 완료!`,
    });
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[130] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl rounded-3xl bg-[#0B0E14] border-2 border-teal-400 p-5 sm:p-6 shadow-[0_0_60px_rgba(20,184,166,0.3)] flex flex-col gap-4 my-auto"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <GhostBabyMascotBadge subtitle="📝 사진·표 OCR 창🔒 (내 기기 통합 Pro · 실제 글자·엑셀 표 1초 추출)" />
            <span className="text-[14px] font-black text-white truncate">{photo.name}</span>
            {trialBadge && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/50 text-amber-200 text-[11px] font-extrabold shrink-0">
                {trialBadge}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[12px] font-extrabold cursor-pointer shrink-0"
          >
            ✕ 닫기
          </button>
        </div>

        {isDemoSamplePhoto ? (
          <div className="flex flex-col gap-3">
            <div className="px-3.5 py-2.5 rounded-2xl bg-amber-500/15 border border-amber-400/40 text-amber-200 text-[12px] font-bold">
              🧪 현재 샘플 또는 PC 엔진 미연결 상태입니다. 내 PC에 <strong>PC 엔진</strong>이 연결된 상태에서 내 실제 영수증·계약서·캡처 사진을 열면 내 사진의 실제 글자와 엑셀 표(TSV)를 100% 정밀 추출합니다.
            </div>
            <div className="p-4 rounded-2xl bg-zinc-950 border border-white/10 flex flex-col sm:flex-row items-center gap-4">
              <img
                src={photo.fullUrl || photo.thumbUrl}
                alt={photo.name}
                className="w-full sm:w-56 max-h-56 rounded-xl object-contain bg-black border border-white/10 shrink-0"
              />
              <div className="flex flex-col gap-2 text-[12.5px] text-zinc-300">
                <div className="font-black text-white text-[14px]">{photo.name}</div>
                <p className="leading-relaxed">
                  내 컴퓨터 연결 후 영수증·계약서·표 사진에서 <strong>[📝 OCR]</strong>을 누르면 글자와 엑셀 표(TSV)를 즉시 추출해 복사·저장할 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        ) : gateState === 'need_opt_in' ? (
          <div className="p-6 rounded-2xl bg-zinc-950 border border-amber-400/50 flex flex-col items-center text-center gap-4">
            <span className="px-3 py-1 rounded-full bg-amber-400 text-zinc-950 text-[11.5px] font-black">
              🎁 신용카드 등록 0% · 자동 결제 0%
            </span>
            <h3 className="text-[18px] font-black text-white">{gateMessage}</h3>
            <p className="text-[13px] text-zinc-300 max-w-xl">
              30일 체험 기간이 끝나도 몰래 결제되지 않고 이 고급 창만 깔끔하게 잠기며, 기본 사진·문서·영상 검색은 평생 0원 그대로 유지됩니다.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => void handleStart30DayTrial()}
                className="px-5 py-2.5 rounded-xl bg-teal-400 hover:bg-teal-300 text-zinc-950 text-[13px] font-black cursor-pointer shadow-lg"
              >
                🎁 30일 무제한 무료체험 시작하고 바로 글자 뽑기
              </button>
              <button
                type="button"
                onClick={() => void handleDownloadOriginalPhoto()}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[12.5px] font-extrabold cursor-pointer"
              >
                🖼️ 원본 사진 그대로 저장
              </button>
            </div>
          </div>
        ) : gateState === 'expired' ? (
          <div className="p-6 rounded-2xl bg-zinc-950 border border-rose-400/40 flex flex-col items-center text-center gap-4">
            <span className="px-3 py-1 rounded-full bg-rose-500/20 border border-rose-400/50 text-rose-200 text-[11.5px] font-black">
              🔒 30일 무료체험 만료
            </span>
            <h3 className="text-[17px] font-black text-white">{gateMessage}</h3>
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  useSaySeeStore.getState().setShowProModal(true);
                }}
                className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-[13px] font-black cursor-pointer"
              >
                👑 4번 내 기기 통합 Pro (월 3,900원) 안내 보기
              </button>
              <button
                type="button"
                onClick={() => void handleDownloadOriginalPhoto()}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[12.5px] font-extrabold cursor-pointer"
              >
                🖼️ 원본 사진 그대로 저장 (무료)
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* 좌측: 실제 원본 사진 프리뷰 + 원본 저장 / 표(TSV) 복사 / 전체 텍스트 복사 */}
            <div className="lg:col-span-5 rounded-2xl bg-zinc-950 border border-white/15 p-4 flex flex-col justify-between gap-3">
              <div className="relative rounded-xl overflow-hidden bg-black border border-white/10 min-h-[220px] max-h-[340px] flex items-center justify-center">
                <img
                  src={photo.fullUrl || photo.thumbUrl}
                  alt={photo.name}
                  className="max-h-[330px] w-auto object-contain"
                />
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => void handleDownloadOriginalPhoto()}
                  className="w-full py-2.5 px-3 rounded-xl bg-teal-400 hover:bg-teal-300 text-zinc-950 text-[12.5px] font-black text-center cursor-pointer"
                >
                  🖼️ 원본 사진 그대로 저장
                </button>
                <button
                  type="button"
                  disabled={loading || !ocrResult?.hasText}
                  onClick={() =>
                    void handleCopyText(
                      ocrResult?.tsvTable || ocrResult?.fullText || '',
                      '📊 표 전체 엑셀(TSV) 규격'
                    )
                  }
                  className="w-full py-2.5 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-zinc-950 text-[12.5px] font-black cursor-pointer"
                >
                  📊 표 전체 엑셀(TSV)로 복사 {ocrResult?.hasTable ? '✨(표 구조 감지됨)' : ''}
                </button>
                <button
                  type="button"
                  disabled={loading || !ocrResult?.hasText}
                  onClick={() =>
                    void handleCopyText(ocrResult?.fullText || '', '📋 추출된 전체 글자')
                  }
                  className="w-full py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 border border-white/15 text-zinc-100 text-[12px] font-extrabold cursor-pointer"
                >
                  📋 전체 텍스트 통째로 복사
                </button>
              </div>
            </div>

            {/* 우측: 실제 PP-OCRv5 Korean 추출 항목 & 단어칩 */}
            <div className="lg:col-span-7 rounded-2xl bg-zinc-950 border border-teal-400/40 p-4 flex flex-col justify-between gap-3">
              {loading ? (
                <div className="flex-1 min-h-[240px] flex flex-col items-center justify-center text-center gap-3 p-6">
                  <div className="w-9 h-9 rounded-full border-3 border-teal-400 border-t-transparent animate-spin" />
                  <p className="text-[14px] font-extrabold text-teal-200">
                    ⏳ 내 컴퓨터에서 사진 속 글자와 표를 정밀 판독하고 있습니다...
                  </p>
                  <span className="text-[11.5px] text-zinc-400">
                    외부 서버 전송 0 Byte · 가로/세로 회전 자동 보정 · 한번 읽은 사진은 0.01초 즉시 열람
                  </span>
                </div>
              ) : !ocrResult?.hasText ? (
                <div className="flex-1 min-h-[240px] flex flex-col items-center justify-center text-center gap-2.5 p-6">
                  <span className="text-[28px]">💡</span>
                  <h4 className="text-[15px] font-black text-white">
                    이 사진에서는 인식된 글자나 표가 없습니다
                  </h4>
                  <p className="text-[12.5px] text-zinc-400 max-w-md leading-relaxed">
                    가짜 예시 텍스트를 억지로 표시하지 않습니다. 풍경·인물 사진은 좌측 <strong>[🖼️ 원본 사진 그대로 저장]</strong>을 이용해 주세요.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {ocrResult.spots && ocrResult.spots.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[12px] font-black text-amber-300">
                        🎯 핵심 추출 항목 (클릭하면 즉시 복사)
                      </span>
                      <div className="flex flex-col gap-1.5 max-h-[165px] overflow-y-auto pr-1">
                        {ocrResult.spots.map((sp) => {
                          const rawSp = sp as unknown as Record<string, string | undefined>;
                          const hintLabel = sp.categoryHint || rawSp.label || '추출 항목';
                          const dispVal = sp.displayText || rawSp.value || '';
                          const insertVal = sp.insertValue || rawSp.value || dispVal;
                          if (!dispVal) return null;
                          return (
                            <button
                              key={sp.id}
                              type="button"
                              onClick={() => void handleCopyText(insertVal, `[${hintLabel}]`)}
                              className="w-full text-left px-3 py-2 rounded-xl bg-zinc-900 hover:bg-teal-500/20 border border-white/15 hover:border-teal-400 flex items-center justify-between gap-2 cursor-pointer transition-colors"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="px-2 py-0.5 rounded bg-amber-400 text-zinc-950 text-[10px] font-black shrink-0">
                                  {hintLabel}
                                </span>
                                <span className="font-mono text-[12px] text-white font-bold truncate">
                                  {dispVal}
                                </span>
                              </div>
                              <span className="text-[10.5px] font-black text-teal-300 shrink-0">복사 ↵</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {ocrResult.chips && ocrResult.chips.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[12px] font-black text-teal-300">
                        📝 추출된 단어 조각(칩) — 콕 찍으면 즉시 복사
                      </span>
                      <div className="flex flex-wrap gap-1.5 max-h-[110px] overflow-y-auto">
                        {ocrResult.chips.map((ch, idx) => (
                          <button
                            key={`${ch}_${idx}`}
                            type="button"
                            onClick={() => void handleCopyText(ch, `"${ch}"`)}
                            className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-teal-400 text-teal-200 hover:text-zinc-950 border border-teal-400/40 text-[12px] font-extrabold cursor-pointer transition-colors"
                          >
                            {ch}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11.5px] font-extrabold text-zinc-400">
                        📄 추출된 원문 / 표 미리보기 {ocrResult.cached ? '(⚡ 캐시 즉시 로드)' : ''}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {ocrResult.tsvTable && (
                          <button
                            type="button"
                            onClick={() => handleDownloadOcrTextFile('tsv')}
                            className="px-2 py-0.5 rounded-md bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400/40 text-emerald-200 text-[10.5px] font-bold cursor-pointer"
                          >
                            📊 엑셀(.tsv) 저장
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDownloadOcrTextFile('txt')}
                          className="px-2 py-0.5 rounded-md bg-zinc-800 hover:bg-zinc-700 border border-white/15 text-zinc-200 text-[10.5px] font-bold cursor-pointer"
                        >
                          📝 텍스트(.txt) 저장
                        </button>
                      </div>
                    </div>
                    <pre className="p-3 rounded-xl bg-zinc-900/90 border border-white/10 text-[12px] text-zinc-100 font-mono whitespace-pre-wrap max-h-[150px] overflow-y-auto leading-relaxed">
                      {ocrResult.tsvTable || ocrResult.fullText}
                    </pre>
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-white/10 flex flex-col gap-1.5">
                {copiedNotice && (
                  <span className="text-[12px] font-extrabold text-emerald-300">{copiedNotice}</span>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={cursorBuffer}
                    onChange={(e) => setCursorBuffer(e.target.value)}
                    placeholder="단어칩이나 항목을 클릭하면 여기에 누적되며 클립보드로 즉시 복사됩니다"
                    className="flex-1 px-3 py-1.5 rounded-xl bg-zinc-900 border border-teal-400/50 text-white text-[12px] font-bold outline-none"
                  />
                  {cursorBuffer && (
                    <button
                      type="button"
                      onClick={() => void handleCopyText(cursorBuffer, '누적 텍스트')}
                      className="px-3 py-1.5 rounded-xl bg-teal-400 text-zinc-950 text-[11.5px] font-black cursor-pointer shrink-0"
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
