import React, { useEffect, useRef, useState } from 'react';
import { useSaySeeStore } from '../../store/useSaySeeStore';
import { resolveNativeMobileVideoPlaybackUrl } from '../../services/ghostiMobileCareBridge';
import { saveCachedMobileGalleryIndex } from '../../services/mobilePhotoPicker';
import {
  cleanVideoTimestampLabel,
  extractVideoScreenTextOnDemand,
  resolveVideoCardThumbUrl,
  setVideoPlaybackActive,
  type VideoOcrLineItem,
} from '../../services/aiEngine';
import { renderHighlightedDocText } from './docAndVideoFormatUtils';

export const VideoScenePreviewModal: React.FC = () => {
  const {
    selectedVideoModal,
    setSelectedVideoModal,
    videoSceneItems,
    matchedVideoScenes,
    syncRealVideoDuration,
    openLocalFolder,
    showToast,
    activeQuery,
    hasExecutedUserSearch,
  } = useSaySeeStore();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pendingSeekSecRef = useRef<number | null>(null);
  const autoPlayStartedRef = useRef<boolean>(false);
  const pipeBaseSecRef = useRef<number>(0);
  const seekHudTimerRef = useRef<number>(0);
  const triedTranscodeFallbackRef = useRef<boolean>(false);
  const [resolvedVideoSrc, setResolvedVideoSrc] = useState<string>('');
  const [isResolvingVideo, setIsResolvingVideo] = useState<boolean>(false);
  const [videoPlaybackError, setVideoPlaybackError] = useState<boolean>(false);
  const [isPortraitVideo, setIsPortraitVideo] = useState<boolean>(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(false);
  const [isAutoMuted, setIsAutoMuted] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [seekHudText, setSeekHudText] = useState<string>('');
  const [isOcrExtracting, setIsOcrExtracting] = useState<boolean>(false);
  const [ocrLines, setOcrLines] = useState<VideoOcrLineItem[]>([]);
  const [ocrFullText, setOcrFullText] = useState<string>('');
  const [ocrCopied, setOcrCopied] = useState<boolean>(false);

  const videoNavList = React.useMemo(() => {
    if (!selectedVideoModal) return [];
    if (
      matchedVideoScenes.length > 0 &&
      matchedVideoScenes.some((v) => v.id === selectedVideoModal.id)
    ) {
      return matchedVideoScenes;
    }
    if (
      videoSceneItems.length > 0 &&
      videoSceneItems.some((v) => v.id === selectedVideoModal.id)
    ) {
      return videoSceneItems;
    }
    return [selectedVideoModal];
  }, [selectedVideoModal, matchedVideoScenes, videoSceneItems]);

  const currentVideoIdx = React.useMemo(() => {
    if (!selectedVideoModal || videoNavList.length === 0) return -1;
    return videoNavList.findIndex((v) => v.id === selectedVideoModal.id);
  }, [selectedVideoModal, videoNavList]);

  const navigateAdjacentVideo = React.useCallback(
    (delta: -1 | 1) => {
      if (videoNavList.length < 2 || currentVideoIdx < 0) return;
      const nextIdx = (currentVideoIdx + delta + videoNavList.length) % videoNavList.length;
      const nextVid = videoNavList[nextIdx];
      if (!nextVid) return;
      setSelectedVideoModal(
        nextVid,
        hasExecutedUserSearch && activeQuery ? nextVid.matchedSeekSec : undefined
      );
    },
    [videoNavList, currentVideoIdx, setSelectedVideoModal, hasExecutedUserSearch, activeQuery]
  );

  const buildInstantPreindexedOcr = (
    targetVid: NonNullable<typeof selectedVideoModal>
  ): { lines: VideoOcrLineItem[]; fullText: string } => {
    const formatTs = (sec: number) => {
      const s = Math.max(0, Math.floor(sec || 0));
      const mm = String(Math.floor(s / 60)).padStart(2, '0');
      const ss = String(s % 60).padStart(2, '0');
      return `${mm}:${ss}`;
    };

    if (Array.isArray(targetVid.ocrLines) && targetVid.ocrLines.length > 0) {
      const lines = targetVid.ocrLines;
      const fullText =
        targetVid.ocrFullText ||
        lines.map((l) => `[${l.timestamp}] ${l.text}`).join('\n');
      return { lines, fullText };
    }

    const lines: VideoOcrLineItem[] = [];
    const seen = new Set<string>();
    if (targetVid.ocrFullText) {
      for (const rawLine of targetVid.ocrFullText.split('\n')) {
        const trimmed = rawLine.trim();
        if (!trimmed || seen.has(trimmed)) continue;
        seen.add(trimmed);
        const m = trimmed.match(/^\[(\d{2}):(\d{2})\]\s*(.+)$/);
        if (m) {
          const sec = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
          lines.push({ timeSec: sec, timestamp: `${m[1]}:${m[2]}`, text: m[3] });
        } else {
          lines.push({ timeSec: 0, timestamp: '00:00', text: trimmed });
        }
      }
    }

    const isMobileNativeItem = String(targetVid.id || '').startsWith('mobile_vid_');
    if (!isMobileNativeItem && lines.length === 0 && Array.isArray(targetVid.timelineFrames)) {
      for (const f of targetVid.timelineFrames) {
        const cap = String(f.sceneCaption || '').trim();
        if (
          !cap ||
          /\s장면\s*\(\d{2}:\d{2}\)$/.test(cap) ||
          /시작\s*장면$/.test(cap) ||
          /구간\s*\(\d{2}:\d{2}\s*\/\s*총\s*\d{2}:\d{2}\)$/.test(cap) ||
          seen.has(cap)
        ) {
          continue;
        }
        seen.add(cap);
        lines.push({
          timeSec: f.timeSec || 0,
          timestamp: f.timestampText || formatTs(f.timeSec || 0),
          text: cap,
        });
      }
    }

    const fullText = lines.map((l) => `[${l.timestamp}] ${l.text}`).join('\n');
    return { lines, fullText };
  };

  useEffect(() => {
    if (!selectedVideoModal) return;
    setVideoPlaybackActive(true);
    return () => {
      setVideoPlaybackActive(false);
    };
  }, [Boolean(selectedVideoModal)]);

  useEffect(() => {
    if (!selectedVideoModal) {
      setResolvedVideoSrc('');
      setIsResolvingVideo(false);
      setVideoPlaybackError(false);
      setIsPortraitVideo(false);
      setIsVideoPlaying(false);
      setSeekHudText('');
      setIsOcrExtracting(false);
      setOcrLines([]);
      setOcrFullText('');
      setOcrCopied(false);
      pipeBaseSecRef.current = 0;
      triedTranscodeFallbackRef.current = false;
      return;
    }
    const resMatch = String(selectedVideoModal.resolution || '').match(/(\d+)\s*[xX×]\s*(\d+)/);
    setIsPortraitVideo(Boolean(resMatch && Number(resMatch[2]) > Number(resMatch[1])));
    setIsVideoPlaying(false);
    setIsAutoMuted(false);
    autoPlayStartedRef.current = false;
    setSeekHudText('');
    setOcrCopied(false);

    const instant = buildInstantPreindexedOcr(selectedVideoModal);
    setOcrLines(instant.lines);
    setOcrFullText(instant.fullText);

    let ocrCancelled = false;
    let ocrDeferTimer = 0;
    const needsBgOcr =
      instant.lines.length === 0 && selectedVideoModal.hasScreenOcrText !== false;
    setIsOcrExtracting(needsBgOcr);
    if (needsBgOcr) {
      ocrDeferTimer = window.setTimeout(() => {
        void (async () => {
          try {
            const res = await extractVideoScreenTextOnDemand(selectedVideoModal);
            if (ocrCancelled) return;
            if (res.ocrLines && res.ocrLines.length > 0) {
              setOcrLines(res.ocrLines);
              setOcrFullText(res.fullText || '');
              const extraTokens = String(res.fullText || '')
                .replace(/\[\d{2}:\d{2}\]/g, ' ')
                .split(/\s+/)
                .map((t) => t.trim())
                .filter((t) => t.length >= 2)
                .slice(0, 40);
              useSaySeeStore.setState((st) => ({
                videoSceneItems: st.videoSceneItems.map((v) =>
                  v.id === selectedVideoModal.id
                    ? {
                        ...v,
                        hasScreenOcrText: true,
                        ocrLineCount: res.ocrLines.length,
                        ocrLines: res.ocrLines,
                        ocrFullText: res.fullText,
                        keywords: Array.from(new Set([...(v.keywords || []), ...extraTokens])),
                      }
                    : v
                ),
                matchedVideoScenes: st.matchedVideoScenes.map((v) =>
                  v.id === selectedVideoModal.id
                    ? {
                        ...v,
                        hasScreenOcrText: true,
                        ocrLineCount: res.ocrLines.length,
                        ocrLines: res.ocrLines,
                        ocrFullText: res.fullText,
                        keywords: Array.from(new Set([...(v.keywords || []), ...extraTokens])),
                      }
                    : v
                ),
              }));
              if (String(selectedVideoModal.id || '').startsWith('mobile_vid_')) {
                const stAfter = useSaySeeStore.getState();
                void saveCachedMobileGalleryIndex(stAfter.photos, stAfter.videoSceneItems);
              }
            }
          } catch {
            /* ignore background OCR hydrate error */
          } finally {
            if (!ocrCancelled) {
              setIsOcrExtracting(false);
            }
          }
        })();
      }, 2200);
    }

    const rawUrl = selectedVideoModal.videoUrl || '';
    const baseStreamUrl = rawUrl.replace(/[&?]t=[^&]*/g, '');
    const targetSec = selectedVideoModal.matchedSeekSec ?? 0;
    const seekTarget = hasExecutedUserSearch && activeQuery ? targetSec : 0;
    setVideoPlaybackError(false);
    triedTranscodeFallbackRef.current = false;
    pipeBaseSecRef.current = 0;
    pendingSeekSecRef.current = seekTarget;

    if (String(selectedVideoModal.id || '').startsWith('mobile_vid_') && !baseStreamUrl.startsWith('blob:')) {
      setResolvedVideoSrc('');
      setIsResolvingVideo(true);
      void resolveNativeMobileVideoPlaybackUrl(selectedVideoModal.id, {
        sizeMB: selectedVideoModal.sizeMB,
      })
        .then((nativeUrl) => {
          if (ocrCancelled) return;
          setIsResolvingVideo(false);
          if (!nativeUrl) {
            setVideoPlaybackError(true);
            return;
          }
          setResolvedVideoSrc(nativeUrl);
        })
        .catch(() => {
          if (!ocrCancelled) {
            setIsResolvingVideo(false);
            setVideoPlaybackError(true);
          }
        });
    } else {
      setIsResolvingVideo(false);
      const urlWithoutHash = baseStreamUrl.split('#')[0];
      const finalStreamUrl =
        seekTarget > 0 && urlWithoutHash && !urlWithoutHash.startsWith('blob:')
          ? `${urlWithoutHash}#t=${seekTarget}`
          : urlWithoutHash;
      setResolvedVideoSrc(finalStreamUrl);
      if (
        videoRef.current &&
        videoRef.current.readyState >= 1 &&
        seekTarget > 0 &&
        Number.isFinite(videoRef.current.duration) &&
        videoRef.current.duration > 0.5
      ) {
        try {
          const clamped = Math.min(seekTarget, Math.max(0, videoRef.current.duration - 0.1));
          if (Math.abs(videoRef.current.currentTime - clamped) > 0.35) {
            videoRef.current.currentTime = clamped;
          }
          if (videoRef.current.readyState >= 2 && Math.abs(videoRef.current.currentTime - clamped) <= 0.6) {
            pendingSeekSecRef.current = null;
          }
          void videoRef.current.play().catch(() => {});
        } catch {
          // ignore
        }
      }
    }

    return () => {
      ocrCancelled = true;
      window.clearTimeout(ocrDeferTimer);
    };
  }, [selectedVideoModal?.id, selectedVideoModal?.videoUrl, selectedVideoModal?.matchedSeekSec, hasExecutedUserSearch, activeQuery]);

  const seekVideoBySeconds = React.useCallback(
    (deltaSec: number) => {
      const el = videoRef.current;
      if (!el || !selectedVideoModal) return;
      const fmtSec = (secVal: number) => {
        const s = Math.max(0, Math.floor(secVal || 0));
        const mm = String(Math.floor(s / 60)).padStart(2, '0');
        const ss = String(s % 60).padStart(2, '0');
        return `${mm}:${ss}`;
      };
      const showHud = (msg: string) => {
        setSeekHudText(msg);
        window.clearTimeout(seekHudTimerRef.current);
        seekHudTimerRef.current = window.setTimeout(() => setSeekHudText(''), 950);
      };

      if (Number.isFinite(el.duration) && el.duration > 0) {
        pendingSeekSecRef.current = null;
        const nextT = Math.max(0, Math.min(Math.max(0, el.duration - 0.1), (el.currentTime || 0) + deltaSec));
        el.currentTime = nextT;
        showHud(`${deltaSec < 0 ? `-${Math.abs(deltaSec)}초` : `+${deltaSec}초`} · ${fmtSec(nextT)}`);
        return;
      }

      const rawUrl = resolvedVideoSrc || el.currentSrc || selectedVideoModal.videoUrl || '';
      const baseStreamUrl = rawUrl.replace(/[&?]t=[^&]*/g, '');
      if (baseStreamUrl.includes('/__videos/stream')) {
        const maxDur = Math.max(1, selectedVideoModal.durationSec || 3600);
        const curLogical = pipeBaseSecRef.current + (el.currentTime || 0);
        const nextLogical = Math.max(0, Math.min(maxDur - 0.5, curLogical + deltaSec));
        pipeBaseSecRef.current = nextLogical;
        const sep = baseStreamUrl.includes('?') ? '&' : '?';
        setResolvedVideoSrc(`${baseStreamUrl}${sep}t=${nextLogical.toFixed(1)}`);
        showHud(`${deltaSec < 0 ? `-${Math.abs(deltaSec)}초` : `+${deltaSec}초`} · ${fmtSec(nextLogical)}`);
      }
    },
    [selectedVideoModal, resolvedVideoSrc]
  );

  useEffect(() => {
    if (!selectedVideoModal) return;
    const releaseFullscreenControlFocus = () => {
      const el = videoRef.current;
      if (!el || typeof document === 'undefined') return;
      if (document.fullscreenElement === el || document.activeElement === el) {
        el.blur();
        window.setTimeout(() => {
          if (videoRef.current && document.activeElement === videoRef.current) {
            videoRef.current.blur();
          }
        }, 30);
      }
    };
    document.addEventListener('fullscreenchange', releaseFullscreenControlFocus);
    document.addEventListener('webkitfullscreenchange', releaseFullscreenControlFocus as EventListener);
    const onKeyDown = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      const tag = tgt?.tagName?.toLowerCase() || '';
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || tgt?.isContentEditable) {
        return;
      }
      if (e.key === 'Escape') {
        if (typeof document !== 'undefined' && document.fullscreenElement) {
          return;
        }
        e.preventDefault();
        setSelectedVideoModal(null);
        return;
      }
      if (e.key === 'ArrowLeft' && !e.altKey && !e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          navigateAdjacentVideo(-1);
        } else {
          seekVideoBySeconds(-5);
        }
        return;
      }
      if (e.key === 'ArrowRight' && !e.altKey && !e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          navigateAdjacentVideo(1);
        } else {
          seekVideoBySeconds(5);
        }
        return;
      }
      if (e.key === ' ' && tag !== 'button' && tag !== 'a') {
        const el = videoRef.current;
        if (el) {
          e.preventDefault();
          e.stopPropagation();
          if (el.paused) {
            void el.play().catch(() => {});
          } else {
            el.pause();
          }
        }
      }
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => {
      document.removeEventListener('fullscreenchange', releaseFullscreenControlFocus);
      document.removeEventListener('webkitfullscreenchange', releaseFullscreenControlFocus as EventListener);
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      window.clearTimeout(seekHudTimerRef.current);
    };
  }, [selectedVideoModal, seekVideoBySeconds, navigateAdjacentVideo, setSelectedVideoModal]);

  if (!selectedVideoModal) return null;

  const effectiveQuery = hasExecutedUserSearch ? activeQuery : '';
  const isWholeClipMatch = (selectedVideoModal.matchedSeekSec ?? 0) <= 0;
  const cleanTs = cleanVideoTimestampLabel(selectedVideoModal.matchedTimestamp);
  const currentFrameObj =
    selectedVideoModal.timelineFrames.find((f) => f.timeSec === selectedVideoModal.matchedSeekSec) ||
    selectedVideoModal.timelineFrames[0];
  const currentFrameThumbUrl =
    currentFrameObj?.thumbUrl || resolveVideoCardThumbUrl(selectedVideoModal);

  const trySwitchToTranscodeStream = (): boolean => {
    if (triedTranscodeFallbackRef.current) return false;
    const modalId = String(selectedVideoModal.id || '');
    if (modalId.startsWith('mobile_vid_')) {
      triedTranscodeFallbackRef.current = true;
      const seekTarget = hasExecutedUserSearch && activeQuery ? (selectedVideoModal.matchedSeekSec ?? 0) : 0;
      pendingSeekSecRef.current = seekTarget;
      setVideoPlaybackError(false);
      setIsResolvingVideo(true);
      setResolvedVideoSrc('');
      void resolveNativeMobileVideoPlaybackUrl(modalId, {
        forceTranscode: true,
        sizeMB: selectedVideoModal.sizeMB,
      })
        .then((h264Url) => {
          setIsResolvingVideo(false);
          if (h264Url) {
            setResolvedVideoSrc(h264Url);
          } else {
            setVideoPlaybackError(true);
          }
        })
        .catch(() => {
          setIsResolvingVideo(false);
          setVideoPlaybackError(true);
        });
      return true;
    }
    const rawUrl = selectedVideoModal.videoUrl || '';
    if (!rawUrl.includes('127.0.0.1:5199') || !selectedVideoModal.videoFileName) return false;
    triedTranscodeFallbackRef.current = true;
    const seekTarget = hasExecutedUserSearch && activeQuery ? (selectedVideoModal.matchedSeekSec ?? 0) : 0;
    pendingSeekSecRef.current = seekTarget;
    setVideoPlaybackError(false);
    setResolvedVideoSrc(
      `http://127.0.0.1:5199/__videos/stream?p=${encodeURIComponent(selectedVideoModal.videoFileName)}${
        seekTarget > 0 ? `#t=${seekTarget}` : ''
      }`
    );
    return true;
  };

  const tryAutoPlayVideo = (vidEl: HTMLVideoElement) => {
    if (autoPlayStartedRef.current) return;
    if (!vidEl.paused && !vidEl.ended) {
      autoPlayStartedRef.current = true;
      return;
    }
    try {
      const p = vidEl.play();
      if (p && typeof p.then === 'function') {
        p.then(() => {
          autoPlayStartedRef.current = true;
          setIsAutoMuted(Boolean(vidEl.muted));
        }).catch(() => {
          // 웹 브라우저 자동재생 정책(NotAllowedError)으로 소리 포함 재생이 막힌 경우 음소거로 즉시 자동재생 시작
          if (!vidEl.muted) {
            try {
              vidEl.muted = true;
              const mutedP = vidEl.play();
              if (mutedP && typeof mutedP.then === 'function') {
                mutedP
                  .then(() => {
                    autoPlayStartedRef.current = true;
                    setIsAutoMuted(true);
                  })
                  .catch(() => {});
              }
            } catch {
              /* ignore */
            }
          }
        });
      }
    } catch {
      /* ignore */
    }
  };

  const applyPendingSeekOnce = (vidEl: HTMLVideoElement) => {
    const targetSec = pendingSeekSecRef.current;
    if (targetSec !== null) {
      try {
        if (Number.isFinite(vidEl.duration) && vidEl.duration > 0.5) {
          const clampedTarget = Math.min(Math.max(0, targetSec), Math.max(0, vidEl.duration - 0.1));
          if (Math.abs(vidEl.currentTime - clampedTarget) > 0.35) {
            vidEl.currentTime = clampedTarget;
          }
          // 실제로 프레임 디코딩이 준비(readyState >= 2)되고 목표 위치에 근접했을 때만 해제
          if (
            clampedTarget <= 0.2 ||
            (vidEl.readyState >= 2 && Math.abs(vidEl.currentTime - clampedTarget) <= 0.6)
          ) {
            pendingSeekSecRef.current = null;
          }
        }
      } catch {
        // ignore
      }
    }
    tryAutoPlayVideo(vidEl);
  };

  return (
    <div
      onClick={() => setSelectedVideoModal(null)}
      className="fixed inset-0 z-[105] bg-black/60 backdrop-blur-xs flex items-center justify-center px-3 sm:px-4 pt-safe pb-safe"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl max-h-full sm:max-h-[90dvh] overflow-hidden rounded-2xl bg-white border border-slate-200 p-4 sm:p-5 md:p-6 shadow-2xl text-slate-900 flex flex-col gap-3.5"
      >
        <div className="flex items-start justify-between gap-3 shrink-0 pb-2.5 border-b border-slate-100">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-slate-500">
              {hasExecutedUserSearch && activeQuery && (
                <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-semibold">
                  {isWholeClipMatch ? '00:00~' : `${cleanTs} 구간`}
                </span>
              )}
              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium tabular-nums">
                길이 {selectedVideoModal.durationText}
              </span>
              {videoNavList.length >= 2 && currentVideoIdx >= 0 && (
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold tabular-nums">
                  {currentVideoIdx + 1} / {videoNavList.length}
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  const steps = [1, 1.25, 1.5, 2, 0.5];
                  const nextSpd = steps[(steps.indexOf(playbackSpeed) + 1) % steps.length] ?? 1;
                  setPlaybackSpeed(nextSpd);
                  if (videoRef.current) {
                    videoRef.current.playbackRate = nextSpd;
                  }
                  setSeekHudText(`⚡ 재생 속도 ${nextSpd}x`);
                  if (seekHudTimerRef.current) window.clearTimeout(seekHudTimerRef.current);
                  seekHudTimerRef.current = window.setTimeout(() => setSeekHudText(''), 900);
                }}
                title="재생 속도 변경 (1.0x ➔ 1.25x ➔ 1.5x ➔ 2.0x ➔ 0.5x)"
                className={`px-2 py-0.5 rounded font-semibold tabular-nums cursor-pointer transition-colors ${
                  playbackSpeed !== 1
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {playbackSpeed === 1 ? '1.0x' : `${playbackSpeed}x`}
              </button>
              {selectedVideoModal.locationKo && (
                <>
                  <span>·</span>
                  <span className="truncate">{selectedVideoModal.locationKo}</span>
                </>
              )}
            </div>
            <h3 className="text-[16px] sm:text-[18px] text-slate-900 font-bold mt-0.5 leading-snug line-clamp-2">
              {renderHighlightedDocText(
                selectedVideoModal.title,
                effectiveQuery,
                selectedVideoModal.keywords.slice(0, 4)
              )}
            </h3>
            <p className="text-[11.5px] text-slate-500 truncate">
              {selectedVideoModal.videoFileName} · {selectedVideoModal.date} · {selectedVideoModal.sizeMB} MB
            </p>
          </div>

          <button
            type="button"
            onClick={() => setSelectedVideoModal(null)}
            aria-label="닫기"
            className="w-8 h-8 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 shrink-0 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 pr-0.5">
          <div
            data-keep-dark="true"
            className={`relative w-full shrink-0 rounded-xl overflow-hidden bg-black border border-slate-200 flex items-center justify-center ${
              isPortraitVideo
                ? 'h-[44dvh] min-h-[260px] max-h-[440px] sm:h-[50dvh]'
                : 'aspect-video min-h-[210px] sm:min-h-[340px]'
            }`}
          >
            {resolvedVideoSrc && !videoPlaybackError ? (
              <>
                <video
                  ref={videoRef}
                  src={resolvedVideoSrc}
                  poster={
                    resolvedVideoSrc.includes('127.0.0.1:5199')
                      ? undefined
                      : currentFrameThumbUrl
                  }
                  controls
                  playsInline
                  autoPlay
                  preload="auto"
                  onPlay={(e) => {
                    setIsVideoPlaying(true);
                    if (e.currentTarget.playbackRate !== playbackSpeed) {
                      e.currentTarget.playbackRate = playbackSpeed;
                    }
                    if (pendingSeekSecRef.current !== null && pendingSeekSecRef.current > 0) {
                      applyPendingSeekOnce(e.currentTarget);
                    }
                    if (typeof document !== 'undefined' && document.fullscreenElement === e.currentTarget) {
                      e.currentTarget.blur();
                    }
                  }}
                  onPause={(e) => {
                    setIsVideoPlaying(false);
                    if (typeof document !== 'undefined' && document.fullscreenElement === e.currentTarget) {
                      e.currentTarget.blur();
                    }
                  }}
                  onVolumeChange={(e) => {
                    if (!e.currentTarget.muted && isAutoMuted) {
                      setIsAutoMuted(false);
                    }
                    if (typeof document !== 'undefined' && document.fullscreenElement === e.currentTarget) {
                      e.currentTarget.blur();
                    }
                  }}
                  onMouseUp={(e) => {
                    if (typeof document !== 'undefined' && document.fullscreenElement === e.currentTarget) {
                      const targetEl = e.currentTarget;
                      window.setTimeout(() => targetEl.blur(), 20);
                    }
                  }}
                  onEnded={() => setIsVideoPlaying(false)}
                  onError={() => {
                    if (!trySwitchToTranscodeStream()) {
                      setVideoPlaybackError(true);
                    }
                  }}
                  onLoadedMetadata={(e) => {
                    const el = e.currentTarget;
                    if (el.videoWidth === 0 && trySwitchToTranscodeStream()) {
                      return;
                    }
                    if (el.videoWidth > 0 && el.videoHeight > 0) {
                      setIsPortraitVideo(el.videoHeight > el.videoWidth);
                    }
                    const realDur = Math.floor(el.duration);
                    if (
                      realDur > 0 &&
                      Number.isFinite(realDur) &&
                      (!resolvedVideoSrc.includes('/__videos/stream') || !resolvedVideoSrc.includes('&t='))
                    ) {
                      syncRealVideoDuration(selectedVideoModal.id, realDur);
                    }
                    applyPendingSeekOnce(el);
                  }}
                  onLoadedData={(e) => {
                    applyPendingSeekOnce(e.currentTarget);
                  }}
                  onCanPlay={(e) => {
                    applyPendingSeekOnce(e.currentTarget);
                  }}
                  className="w-full h-full object-contain"
                />
                {!isVideoPlaying && (
                  <button
                    type="button"
                    aria-label="영상 재생"
                    onClick={() => {
                      if (videoRef.current) {
                        if (isAutoMuted) {
                          videoRef.current.muted = false;
                          setIsAutoMuted(false);
                        }
                        autoPlayStartedRef.current = true;
                        void videoRef.current.play().catch(() => {});
                      }
                    }}
                    className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-black/75 hover:bg-black/85 border border-white/60 text-white flex items-center justify-center shadow-xl cursor-pointer transition-transform active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[32px]">play_arrow</span>
                  </button>
                )}
                {isVideoPlaying && isAutoMuted && (
                  <button
                    type="button"
                    onClick={() => {
                      if (videoRef.current) {
                        videoRef.current.muted = false;
                        setIsAutoMuted(false);
                      }
                    }}
                    className="absolute top-3 left-3 z-20 px-3 py-1.5 rounded-full bg-black/80 hover:bg-black/95 border border-white/40 text-white text-[12px] font-semibold flex items-center gap-1.5 shadow-lg cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px]">volume_off</span>
                    <span>소리 켜기</span>
                  </button>
                )}
                {seekHudText && (
                  <div
                    data-keep-dark="true"
                    className="absolute top-3 right-3 z-20 px-3 py-1 rounded-full bg-black/80 border border-white/30 text-white text-[12px] font-semibold pointer-events-none"
                  >
                    {seekHudText}
                  </div>
                )}
              </>
            ) : (
              <div className="relative w-full h-full flex items-center justify-center">
                {currentFrameThumbUrl ? (
                  <img
                    src={currentFrameThumbUrl}
                    alt={selectedVideoModal.title}
                    onLoad={(e) => {
                      const el = e.currentTarget;
                      if (el.naturalWidth > 0 && el.naturalHeight > 0) {
                        setIsPortraitVideo(el.naturalHeight > el.naturalWidth);
                      }
                    }}
                    className="w-full h-full object-contain"
                  />
                ) : null}
                <div className="absolute inset-0 bg-black/45 flex flex-col items-center justify-center gap-2 px-4 text-center">
                  <span className="px-3.5 py-1.5 rounded-full bg-black/80 border border-white/25 text-white text-[12.5px] font-medium">
                    {videoPlaybackError
                      ? '이 영상 형식을 재생할 수 없습니다.'
                      : isResolvingVideo
                      ? '원본 동영상을 불러오는 중...'
                      : '동영상을 불러오는 중...'}
                  </span>
                </div>
              </div>
            )}
            {videoNavList.length >= 2 && (
              <>
                <button
                  type="button"
                  aria-label="이전 동영상"
                  title="이전 동영상 (Shift + ←)"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateAdjacentVideo(-1);
                  }}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 border border-white/25 text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[22px]">chevron_left</span>
                </button>
                <button
                  type="button"
                  aria-label="다음 동영상"
                  title="다음 동영상 (Shift + →)"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateAdjacentVideo(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 border border-white/25 text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[22px]">chevron_right</span>
                </button>
              </>
            )}
            {hasExecutedUserSearch && activeQuery && !isVideoPlaying && (
              <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded bg-black/75 text-white text-[11px] font-medium pointer-events-none">
                {isWholeClipMatch ? '처음부터 재생' : `${cleanTs} 구간부터 재생`}
              </div>
            )}
          </div>

          {selectedVideoModal.fullPath ? (
            <p className="text-[11.5px] text-slate-500 break-all px-0.5">
              위치: {selectedVideoModal.fullPath}
            </p>
          ) : !String(selectedVideoModal.id || '').startsWith('mobile_vid_') &&
            !String(selectedVideoModal.videoUrl || '').startsWith('blob:') &&
            !String(selectedVideoModal.videoUrl || '').includes('127.0.0.1:5199') ? (
            <p className="text-[11.5px] text-slate-400 px-0.5">
              샘플 영상입니다. 내 컴퓨터를 연결하거나 스마트폰 앱에서 동기화하면 실제 동영상을 재생할 수 있습니다.
            </p>
          ) : null}

          {hasExecutedUserSearch && activeQuery && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-1 shrink-0">
              <span className="text-[11.5px] text-slate-500 font-semibold">
                {isWholeClipMatch ? '일치 구간 (00:00~)' : `일치 장면 (${cleanTs})`}
              </span>
              <p className="text-[13px] text-slate-800 font-medium leading-relaxed">
                {renderHighlightedDocText(
                  selectedVideoModal.matchedFrameCaption,
                  effectiveQuery,
                  currentFrameObj?.keywords?.slice(0, 4) ?? []
                )}
              </p>
            </div>
          )}

          {ocrLines.length === 0 && isOcrExtracting && (
            <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-[12px] font-medium shrink-0">
              영상 화면 속 글자를 읽고 있습니다...
            </div>
          )}

          {ocrLines.length === 0 && !isOcrExtracting && String(selectedVideoModal.id || '').startsWith('mobile_vid_') && (
            <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-[12px] shrink-0">
              이 영상에서는 화면 속 글자가 감지되지 않았습니다.
            </div>
          )}

          {ocrLines.length > 0 && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-2.5 shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[12.5px] text-slate-800 font-semibold">
                    영상 속 추출된 글자 ({ocrLines.length}구간)
                  </span>
                  {ocrCopied && (
                    <span className="text-[12px] text-emerald-700 font-medium">
                      복사됨
                    </span>
                  )}
                </div>
                {ocrFullText && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard?.writeText(ocrFullText);
                          setOcrCopied(true);
                        } catch {
                          /* ignore */
                        }
                      }}
                      className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11.5px] font-semibold cursor-pointer"
                    >
                      {ocrCopied ? '복사됨' : '전체 복사'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const blob = new Blob([ocrFullText], { type: 'text/plain;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${selectedVideoModal.title || 'video'}_화면글자추출.txt`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="px-3 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11.5px] font-medium cursor-pointer"
                    >
                      .txt 저장
                    </button>
                  </div>
                )}
              </div>

              <div className="max-h-48 overflow-y-auto rounded-lg bg-white border border-slate-200 p-2 flex flex-col gap-1">
                {ocrLines.map((ln, idx) => (
                  <button
                    key={`${ln.timestamp}_${idx}`}
                    type="button"
                    onClick={() => {
                      const targetSec = Math.max(0, Number(ln.timeSec || 0));
                      pendingSeekSecRef.current = targetSec;
                      if (videoRef.current) {
                        const dur = videoRef.current.duration;
                        if (Number.isFinite(dur) && dur > 0) {
                          videoRef.current.currentTime = Math.min(targetSec, Math.max(0, dur - 0.1));
                        } else {
                          try {
                            videoRef.current.currentTime = targetSec;
                          } catch {
                            /* wait for metadata */
                          }
                        }
                        void videoRef.current.play().catch(() => {});
                      }
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-slate-50 flex items-start gap-2 transition cursor-pointer"
                  >
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-semibold tabular-nums shrink-0">
                      {ln.timestamp}
                    </span>
                    <span className="text-[12.5px] text-slate-800 leading-snug break-all">
                      {ln.text}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2.5 border-t border-slate-100 shrink-0">
          <button
            type="button"
            onClick={() => {
              if (selectedVideoModal.fullPath) {
                void openLocalFolder('videos', selectedVideoModal.fullPath);
                return;
              }
              if (!String(selectedVideoModal.videoUrl || '').includes('127.0.0.1:5199')) {
                showToast(
                  '샘플 영상이라 내 PC 폴더에는 저장되어 있지 않습니다.'
                );
                return;
              }
              void openLocalFolder('videos');
            }}
            className="hidden sm:flex px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[12px] font-medium items-center gap-1 cursor-pointer"
          >
            <span>동영상 폴더 열기</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedVideoModal(null)}
            className="px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[12px] font-semibold cursor-pointer"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
