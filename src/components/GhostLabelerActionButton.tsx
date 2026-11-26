import React from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';
import type { LocalDocumentFile, PhotoItem } from '../types/saysee';
import {
  resolveSmartKoreanLabelForPhoto,
  stripCollisionKeySuffix,
} from '../services/aiEngine';
import { formatQuickKoreanLabelForFile } from './searchModals/docAndVideoFormatUtils';
import {
  copyTextSafeToClipboard,
  evaluateProFeatureGate,
} from '../services/proFeatureGate';
import { markGhostDojoStep } from './ghostDojo/ghostSearchDojoShared';

type GhostLabelerActionProps =
  | {
      variant: 'doc';
      doc: LocalDocumentFile;
      forceSampleOnly?: boolean;
    }
  | {
      variant: 'vault_photo';
      photo: PhotoItem;
      forceSampleOnly?: boolean;
    }
  | {
      variant: 'gallery_photo';
      photo: PhotoItem;
      forceSampleOnly?: boolean;
    };

// 연속 클릭 시 먼저 눌렀던 느린 요청을 즉시 중단(Abort)하고 최신 클립보드·토스트만 초고속 반영
let _latestGhostLabelerSeq = 0;
let _activeLabelerAbort: AbortController | null = null;

function beginGhostLabelerRequest(): { seq: number; signal: AbortSignal } {
  try {
    _activeLabelerAbort?.abort();
  } catch {
    /* ignore */
  }
  const ctrl = new AbortController();
  _activeLabelerAbort = ctrl;
  return { seq: ++_latestGhostLabelerSeq, signal: ctrl.signal };
}

export const GhostLabelerActionButton: React.FC<GhostLabelerActionProps> = (props) => {
  const { forceSampleOnly = false } = props;

  const verifyGate = async (targetFilePath?: string): Promise<boolean> => {
    const outcome = await evaluateProFeatureGate({
      actionType: 'feat_ghost_labeler',
      filePath: targetFilePath,
      forceSampleOnly,
      allowSDriveFree: true,
    });
    if (!outcome.allowed) {
      useSaySeeStore.setState({
        lastQuarantineToast: outcome.message,
      });
      return false;
    }
    return true;
  };

  if (props.variant === 'doc') {
    const { doc } = props;
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          const mySeq = ++_latestGhostLabelerSeq;
          void verifyGate(doc.path || doc.fileName).then(async (allowed) => {
            if (!allowed || mySeq !== _latestGhostLabelerSeq) return;
            try {
              const cleanDocName = stripCollisionKeySuffix(doc.fileName || doc.title || '문서.txt');
              const existingDocNames = (useSaySeeStore.getState().localDocuments || [])
                .map((d) => d?.fileName || '')
                .filter(Boolean);
              const newLabel = formatQuickKoreanLabelForFile(
                cleanDocName,
                doc.date || '',
                [doc.title || '', String(doc.extractedText || '').slice(0, 120)],
                { existingNames: existingDocNames }
              );
              if (mySeq !== _latestGhostLabelerSeq) return;
              await copyTextSafeToClipboard(newLabel);
              if (mySeq !== _latestGhostLabelerSeq) return;
              markGhostDojoStep('labeler');
              useSaySeeStore.setState({
                lastQuarantineToast: `파일명 생성 완료: ${newLabel} (복사됨)`,
              });
            } catch {
              if (mySeq !== _latestGhostLabelerSeq) return;
              useSaySeeStore.setState({
                lastQuarantineToast: '파일명 생성 중 일시 지연이 발생했습니다. 다시 한 번 눌러주세요.',
              });
            }
          });
        }}
        className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer"
      >
        🏷️ 귀신라벨링
      </button>
    );
  }

  if (props.variant === 'vault_photo') {
    const { photo: vp } = props;
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          const { seq: mySeq, signal } = beginGhostLabelerRequest();
          void verifyGate(vp.fullPath || vp.name).then(async (allowed) => {
            if (!allowed || mySeq !== _latestGhostLabelerSeq) return;
            useSaySeeStore.setState({
              lastQuarantineToast: '사진 내용을 바탕으로 한글 파일명을 생성하는 중입니다...',
            });
            try {
              const existingPhotoNames = useSaySeeStore.getState().photos.map((p) => p.name);
              const fallbackLabel = formatQuickKoreanLabelForFile(
                stripCollisionKeySuffix(vp.name || '사진.png'),
                vp.date,
                vp.tags || [],
                { mtimeMs: vp.mtimeMs, existingNames: existingPhotoNames }
              );
              const res = await Promise.race([
                resolveSmartKoreanLabelForPhoto(vp, existingPhotoNames, signal),
                new Promise<{ displaySourceName: string; label: string; enrichedTags: string[] }>(
                  (resolve) =>
                    setTimeout(
                      () =>
                        resolve({
                          displaySourceName: stripCollisionKeySuffix(vp.name || '사진.png'),
                          label: fallbackLabel,
                          enrichedTags: [],
                        }),
                      950
                    )
                ),
              ]);
              if (mySeq !== _latestGhostLabelerSeq) return;
              await copyTextSafeToClipboard(res.label);
              if (mySeq !== _latestGhostLabelerSeq) return;
              useSaySeeStore.setState({
                lastQuarantineToast: `🏷️ 귀신 라벨러 완료: ${res.label} (복사됨)`,
              });
            } catch {
              if (mySeq !== _latestGhostLabelerSeq) return;
              const fallbackLabel = formatQuickKoreanLabelForFile(
                stripCollisionKeySuffix(vp.name || '사진.png'),
                vp.date,
                vp.tags || []
              );
              await copyTextSafeToClipboard(fallbackLabel);
              if (mySeq !== _latestGhostLabelerSeq) return;
              useSaySeeStore.setState({
                lastQuarantineToast: `🏷️ 귀신 라벨러 완료: ${fallbackLabel} (복사됨)`,
              });
            }
          });
        }}
        className="px-2 py-1 rounded-md bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[11px] font-medium whitespace-nowrap shrink-0 cursor-pointer"
      >
        🏷️ 귀신라벨링
      </button>
    );
  }

  const { photo: targetPhoto } = props;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        const { seq: mySeq, signal } = beginGhostLabelerRequest();
        void verifyGate(targetPhoto.fullPath || targetPhoto.name).then(async (allowed) => {
          if (!allowed || mySeq !== _latestGhostLabelerSeq) return;
          useSaySeeStore.setState({
            lastQuarantineToast: '사진 내용을 바탕으로 한글 파일명을 생성하는 중입니다...',
          });
          const existingPhotoNames = useSaySeeStore.getState().photos.map((p) => p.name);
          const fallbackLabel = formatQuickKoreanLabelForFile(
            stripCollisionKeySuffix(targetPhoto.name || '사진.png'),
            targetPhoto.date,
            targetPhoto.tags || [],
            { mtimeMs: targetPhoto.mtimeMs, existingNames: existingPhotoNames }
          );
          try {
            const res = await Promise.race([
              resolveSmartKoreanLabelForPhoto(targetPhoto, existingPhotoNames, signal),
              new Promise<{
                displaySourceName: string;
                label: string;
                enrichedTags: string[];
                ocrSnippet?: string;
              }>((resolve) =>
                setTimeout(
                  () =>
                    resolve({
                      displaySourceName: stripCollisionKeySuffix(targetPhoto.name || '사진.png'),
                      label: fallbackLabel,
                      enrichedTags: [],
                    }),
                  950
                )
              ),
            ]);
            if (mySeq !== _latestGhostLabelerSeq) return;
            await copyTextSafeToClipboard(res.label);
            if (mySeq !== _latestGhostLabelerSeq) return;
            markGhostDojoStep('labeler');
            const patchPhoto = (p: PhotoItem): PhotoItem =>
              p.id === targetPhoto.id
                ? {
                    ...p,
                    tags: Array.from(new Set([...res.enrichedTags, ...(p.tags || [])])),
                    ...(res.ocrSnippet && !(p.captionKo || '').includes('OCR:')
                      ? {
                          captionKo: p.captionKo
                            ? `${p.captionKo} | OCR: ${res.ocrSnippet}`
                            : `OCR: ${res.ocrSnippet}`,
                        }
                      : {}),
                  }
                : p;
            useSaySeeStore.setState((st) => ({
              lastQuarantineToast: `🏷️ 귀신 라벨러 완료: ${res.label} (복사됨)`,
              ...(res.enrichedTags.length > 0
                ? {
                    photos: (st.photos || []).map(patchPhoto),
                    searchResults: (st.searchResults || []).map((sr) =>
                      sr?.photo ? { ...sr, photo: patchPhoto(sr.photo) } : sr
                    ),
                  }
                : {}),
            }));
          } catch {
            if (mySeq !== _latestGhostLabelerSeq) return;
            await copyTextSafeToClipboard(fallbackLabel);
            if (mySeq !== _latestGhostLabelerSeq) return;
            useSaySeeStore.setState({
              lastQuarantineToast: `🏷️ 귀신 라벨러 완료: ${fallbackLabel} (복사됨)`,
            });
          }
        });
      }}
      title="촬영일·내용 기반 한글 파일명(YYMMDD_내용)을 생성해 복사합니다"
      className="px-1.5 py-1 rounded-md bg-black/75 hover:bg-black text-white border border-white/20 text-[10.5px] font-medium whitespace-nowrap shrink-0 shadow-xs transition-colors cursor-pointer"
    >
      🏷️ 귀신라벨링
    </button>
  );
};
