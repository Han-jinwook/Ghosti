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
          void verifyGate(doc.path || doc.fileName).then(async (allowed) => {
            if (!allowed) return;
            const cleanDocName = stripCollisionKeySuffix(doc.fileName);
            const newLabel = formatQuickKoreanLabelForFile(cleanDocName, doc.date, [
              doc.title,
              (doc.extractedText || '').slice(0, 120),
            ]);
            await copyTextSafeToClipboard(newLabel);
            useSaySeeStore.setState({
              lastQuarantineToast: `파일명 생성 완료: ${newLabel} (복사됨)`,
            });
          });
        }}
        className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[11px] font-medium transition-colors cursor-pointer"
      >
        파일명 정리 · Pro
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
          void verifyGate(vp.fullPath || vp.name).then(async (allowed) => {
            if (!allowed) return;
            const res = await resolveSmartKoreanLabelForPhoto(vp);
            await copyTextSafeToClipboard(res.label);
            useSaySeeStore.setState({
              lastQuarantineToast: `파일명 생성 완료: ${res.label} (복사됨)`,
            });
          });
        }}
        className="px-2 py-1 rounded-md bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[11px] font-medium cursor-pointer"
      >
        라벨러 · Pro
      </button>
    );
  }

  const { photo: targetPhoto } = props;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        void verifyGate(targetPhoto.fullPath || targetPhoto.name).then(async (allowed) => {
          if (!allowed) return;
          useSaySeeStore.setState({
            lastQuarantineToast: '사진 내용을 바탕으로 한글 파일명을 생성하는 중입니다...',
          });
          const res = await resolveSmartKoreanLabelForPhoto(targetPhoto);
          await copyTextSafeToClipboard(res.label);
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
            lastQuarantineToast: `파일명 생성 완료: ${res.label} (복사됨)`,
            ...(res.enrichedTags.length > 0
              ? {
                  photos: st.photos.map(patchPhoto),
                  searchResults: st.searchResults.map((sr) => ({
                    ...sr,
                    photo: patchPhoto(sr.photo),
                  })),
                }
              : {}),
          }));
        });
      }}
      title="촬영일·내용 기반 한글 파일명(YYMMDD_내용)을 생성해 복사합니다"
      className="px-2 py-1 rounded-md bg-black/75 hover:bg-black text-white border border-white/20 text-[11px] font-medium shadow-xs transition-colors cursor-pointer"
    >
      라벨러
    </button>
  );
};
