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

/**
 * 🏷️ 귀신 라벨러🔒 (Pro 월 3,900원 유료 티어 전용 액션 컴포넌트)
 * - 무료 검색창(Stage1MinimalSearchPreview) 본체와 유료 라벨링 권한/실행 로직을 완전히 격리
 * - 공통 proFeatureGate(evaluateProFeatureGate)를 통해 사진·표 OCR 창과 100% 동일한 Pro/30일 체험/S:드라이브 무료 예외 정책 적용
 */
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
              lastQuarantineToast: `🏷️ 귀신 라벨러 완료: ${cleanDocName} ➔ ${newLabel} (클립보드에 한글 라벨명 복사됨)`,
            });
          });
        }}
        className="px-2 py-1 rounded-lg bg-teal-500/20 hover:bg-teal-500/35 border border-teal-400/50 text-teal-200 font-label-sm text-[11px] font-extrabold transition-colors cursor-pointer"
      >
        🏷️ 이 파일 귀신라벨링🔒
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
              lastQuarantineToast: `🏷️ 귀신 라벨러 완료: ${res.displaySourceName} ➔ ${res.label} (복사됨)`,
            });
          });
        }}
        className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/50 text-amber-200 font-label-sm text-[10.5px] font-extrabold cursor-pointer"
      >
        🏷️ 라벨링🔒
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
            lastQuarantineToast: '🏷️ 사진 속 글자·피사체를 분석해 한글 라벨명을 생성하는 중...',
          });
          const res = await resolveSmartKoreanLabelForPhoto(targetPhoto);
          await copyTextSafeToClipboard(res.label);
          const patchPhoto = (p: PhotoItem): PhotoItem =>
            p.id === targetPhoto.id
              ? {
                  ...p,
                  tags: Array.from(new Set([...res.enrichedTags, ...(p.tags || [])])),
                  ...(res.ocrSnippet && !(p.captionKo || '').includes('📝 OCR:')
                    ? {
                        captionKo: p.captionKo
                          ? `${p.captionKo} | 📝 OCR: ${res.ocrSnippet}`
                          : `📝 OCR: ${res.ocrSnippet}`,
                      }
                    : {}),
                }
              : p;
          useSaySeeStore.setState((st) => ({
            lastQuarantineToast: `🏷️ 귀신 라벨러 완료: ${res.displaySourceName} ➔ ${res.label} (클립보드에 한글 라벨명 복사됨)`,
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
      title="기계적 파일명을 촬영일·내용 기반 한글 라벨명(YYMMDD_내용)으로 생성·복사합니다"
      className="px-2 py-1 rounded-lg bg-zinc-950/90 hover:bg-amber-400 text-amber-200 hover:text-zinc-950 border border-amber-400/60 font-label-sm text-[10.5px] font-black shadow-md transition-all cursor-pointer"
    >
      🏷️ 이 파일 귀신라벨링🔒
    </button>
  );
};
