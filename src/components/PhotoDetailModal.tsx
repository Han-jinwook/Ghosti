import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';
import { resolveLoungePhotoCorpus } from '../store/slices/storeSharedRefs';
import { cosineSimilarity } from '../services/aiEngine';
import { dispatchGhostCastLiveCommand } from './GhostCastAndLiveSystem';
import {
  pushTeleportPhotoToPcVanguard,
  tryMakeCompactThumbDataUrl,
} from '../services/deviceIntegrationService';
import type { PhotoItem } from '../types/saysee';

type ContextTab = 'same-day' | 'similar-visual' | 'drill-down';

function dedupeByVisualScene(items: PhotoItem[], currentId?: string): PhotoItem[] {
  const out: PhotoItem[] = [];
  const seenKeys = new Set<string>();
  for (const p of items) {
    if (currentId && p.id === currentId) continue;
    const key =
      p.clusterId !== undefined
        ? `cluster_${p.clusterId}`
        : p.duplicateGroupId
        ? `dup_${p.duplicateGroupId}`
        : p.dhash && p.dhash !== '0'
        ? `dhash_${p.dhash}`
        : `id_${p.id}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    out.push(p);
  }
  return out;
}

function isSoloPortraitPhoto(p: PhotoItem): boolean {
  const text = `${p.tags.join(' ')} ${(p.keywordsKo ?? []).join(' ')} ${p.captionKo || ''}`.toLowerCase();
  const hasSoloIndicator =
    text.includes('1명') ||
    text.includes('한 명') ||
    text.includes('한명') ||
    text.includes('혼자') ||
    text.includes('단독') ||
    text.includes('독사진') ||
    text.includes('셀카') ||
    text.includes('프로필');
  const hasGroupIndicator =
    text.includes('단체') ||
    text.includes('모임') ||
    text.includes('대가족') ||
    text.includes('친구들') ||
    text.includes('동료들') ||
    text.includes('어린이들이') ||
    text.includes('식구가');
  return hasSoloIndicator && !hasGroupIndicator;
}

function isNonSmilingPhoto(p: PhotoItem): boolean {
  const cap = (p.captionKo || '').toLowerCase();
  return (
    cap.includes('웃지 않') ||
    cap.includes('무표정') ||
    cap.includes('진지한') ||
    cap.includes('실루엣') ||
    cap.includes('뒷모습')
  );
}

export function matchPhotoQuery(p: PhotoItem, token: string): boolean {
  const t = token.trim().toLowerCase().replace(/^#/, '');
  if (!t) return true;
  if (p.trashCategory === 'blurry' || p.trashCategory === 'screenshot' || p.trashCategory === 'memo') {
    return false;
  }

  const caption = (p.captionKo || '').toLowerCase();
  const tagsStr = p.tags.join(' ').toLowerCase();
  const kwStr = (p.keywordsKo ?? []).join(' ').toLowerCase();
  const ontoStr = (p.ontologyPrimaryTags ?? []).join(' ').toLowerCase();
  const location = (p.locationKo || '').toLowerCase();
  const combined = `${tagsStr} ${kwStr} ${ontoStr} ${caption} ${location}`;

  if (t === '해변' || t === '바다' || t === '바닷가' || t === 'beach' || t === '백사장' || t === '모래사장') {
    return (
      combined.includes('해변') ||
      combined.includes('바다') ||
      combined.includes('바닷가') ||
      combined.includes('백사장') ||
      combined.includes('모래사장') ||
      combined.includes('파도')
    );
  }

  if (t === '웃는' || t === '미소' || t === '웃음' || t === 'smile' || t === '환하게' || t === '해맑게') {
    if (isNonSmilingPhoto(p)) return false;
    return (
      combined.includes('웃는') ||
      combined.includes('웃고') ||
      combined.includes('미소') ||
      combined.includes('웃음') ||
      combined.includes('환하게') ||
      combined.includes('해맑게') ||
      combined.includes('활짝 웃')
    );
  }

  if (t === '단체' || t === '단체사진' || t === '모임' || t === '일행' || t === '여럿') {
    if (isSoloPortraitPhoto(p)) return false;
    return (
      combined.includes('단체') ||
      combined.includes('모임') ||
      combined.includes('친구들') ||
      combined.includes('동료들') ||
      combined.includes('대가족') ||
      combined.includes('식구') ||
      combined.includes('어린이들이') ||
      combined.includes('남매')
    );
  }

  if (t === '오후' || t === '낮' || t === '햇살' || t === '해질녘' || t === '노을' || t === '일몰') {
    if (t === '노을' || t === '일몰' || t === '해질녘') {
      return combined.includes('노을') || combined.includes('일몰') || combined.includes('석양') || combined.includes('해질녘');
    }
    return (
      combined.includes('오후') ||
      combined.includes('햇살') ||
      combined.includes('화창한') ||
      combined.includes('해질녘') ||
      combined.includes('노을') ||
      combined.includes('낮') ||
      combined.includes('야외')
    );
  }

  if (t === '야외' || t === '풍경' || t === '자연' || t === '공원') {
    if (combined.includes('실내') && !combined.includes('야외')) return false;
    if (t === '공원') {
      return combined.includes('공원') || combined.includes('잔디밭') || combined.includes('정원') || combined.includes('들판');
    }
    return (
      combined.includes('야외') ||
      combined.includes('풍경') ||
      combined.includes('공원') ||
      combined.includes('자연') ||
      combined.includes('해변') ||
      combined.includes('산') ||
      combined.includes('호수')
    );
  }

  if (t === '가족') {
    return (
      combined.includes('가족') ||
      combined.includes('부모') ||
      combined.includes('엄마') ||
      combined.includes('아빠') ||
      combined.includes('남매') ||
      combined.includes('식구')
    );
  }

  return combined.includes(t);
}

export const PhotoDetailModal: React.FC = () => {
  const {
    selectedPhoto,
    selectedBurstGroup,
    setSelectedPhoto,
    photos,
    searchResults,
    matchedVaultPhotos,
    searchSpace,
    duplicateGroups,
    toggleBookmark,
    openLocalFolder,
    pickBestInBurstPhotos,
    isGuestPreviewMode,
    triggerGuestJoinWall,
    activeLoungeType,
    activeFamilyRoom,
    sharedRoomHostPhotos,
    sharedRoomAddedPhotos,
    sharedRoomSoftDeletedMap,
    softDeleteSharedRoomPhoto24h,
    restoreSharedRoomPhotoFromTrash,
    setDesktopTab,
  } = useSaySeeStore();

  const scopedPhotos = useMemo(() => {
    return resolveLoungePhotoCorpus({
      activeLoungeType,
      activeFamilyRoom,
      photos,
      sharedRoomHostPhotos,
      sharedRoomAddedPhotos,
    });
  }, [activeLoungeType, activeFamilyRoom, photos, sharedRoomAddedPhotos, sharedRoomHostPhotos]);

  const [activeTab, setActiveTab] = useState<ContextTab>('same-day');
  const [drillQuery, setDrillQuery] = useState('');
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const isSharedLounge =
    activeLoungeType === 'family' ||
    activeLoungeType === 'club' ||
    activeLoungeType === 'student';
  const isHiddenInLounge = Boolean(
    selectedPhoto && (sharedRoomSoftDeletedMap[selectedPhoto.id] || selectedPhoto.quarantined)
  );

  const photoNavContext = useMemo(() => {
    if (!selectedPhoto) return { list: [] as PhotoItem[], keepGroup: false };
    let rawList: PhotoItem[] = [];
    let keepGroup = false;
    if (
      searchSpace === 'vault' &&
      matchedVaultPhotos.length >= 2 &&
      matchedVaultPhotos.some((it) => it.photo.id === selectedPhoto.id)
    ) {
      rawList = matchedVaultPhotos.map((it) => it.photo).filter((p) => !p.quarantined);
    } else if (
      searchResults.length >= 2 &&
      searchResults.some((it) => it.photo.id === selectedPhoto.id)
    ) {
      rawList = searchResults.map((it) => it.photo).filter((p) => !p.quarantined);
    } else if (
      selectedBurstGroup &&
      selectedBurstGroup.length >= 2 &&
      selectedBurstGroup.some((p) => p.id === selectedPhoto.id)
    ) {
      rawList = selectedBurstGroup.filter((p) => !p.quarantined);
      keepGroup = true;
    } else {
      rawList = scopedPhotos.filter((p) => !p.quarantined);
    }
    const deduped: PhotoItem[] = [];
    const seen = new Set<string>();
    for (const p of rawList) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        deduped.push(p);
      }
    }
    return { list: deduped, keepGroup };
  }, [selectedPhoto, searchSpace, matchedVaultPhotos, searchResults, selectedBurstGroup, scopedPhotos]);

  const photoNavList = photoNavContext.list;
  const currentPhotoIdx = useMemo(() => {
    if (!selectedPhoto || photoNavList.length === 0) return -1;
    return photoNavList.findIndex((p) => p.id === selectedPhoto.id);
  }, [selectedPhoto, photoNavList]);

  const navigateAdjacentPhoto = useCallback(
    (delta: -1 | 1) => {
      if (photoNavList.length < 2 || currentPhotoIdx < 0) return;
      const nextIdx = (currentPhotoIdx + delta + photoNavList.length) % photoNavList.length;
      const nextPhoto = photoNavList[nextIdx];
      if (!nextPhoto) return;
      setActionNotice(null);
      setSelectedPhoto(nextPhoto, photoNavContext.keepGroup ? photoNavList : null);
    },
    [photoNavList, currentPhotoIdx, photoNavContext.keepGroup, setSelectedPhoto]
  );

  useEffect(() => {
    if (!selectedPhoto) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      const tag = tgt?.tagName?.toLowerCase() || '';
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || tgt?.isContentEditable) {
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSelectedPhoto(null);
        return;
      }
      if (e.key === 'ArrowLeft' && !e.altKey && !e.metaKey) {
        e.preventDefault();
        navigateAdjacentPhoto(-1);
        return;
      }
      if (e.key === 'ArrowRight' && !e.altKey && !e.metaKey) {
        e.preventDefault();
        navigateAdjacentPhoto(1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedPhoto, navigateAdjacentPhoto, setSelectedPhoto]);

  const resolvedBurstPhotos = useMemo(() => {
    if (!selectedPhoto) return [];
    if (selectedBurstGroup && selectedBurstGroup.length >= 2) {
      return selectedBurstGroup.filter((p) => !p.quarantined);
    }
    if (selectedPhoto.duplicateGroupId) {
      const grp = duplicateGroups.find((g) => g.groupId === selectedPhoto.duplicateGroupId);
      if (grp) {
        const map = new Map(photos.map((p) => [p.id, p]));
        return grp.photoIds
          .map((id) => map.get(id))
          .filter((p): p is PhotoItem => Boolean(p && !p.quarantined));
      }
    }
    if (selectedPhoto.clusterId !== undefined) {
      const sameCluster = photos.filter(
        (p) => !p.quarantined && p.clusterId === selectedPhoto.clusterId
      );
      if (sameCluster.length >= 2) return sameCluster;
    }
    return [selectedPhoto];
  }, [selectedPhoto, selectedBurstGroup, duplicateGroups, photos]);

  const sameDayPhotos = useMemo(() => {
    if (!selectedPhoto) return [];
    const active = scopedPhotos.filter(
      (p) =>
        !p.quarantined &&
        p.id !== selectedPhoto.id &&
        p.trashCategory !== 'blurry' &&
        p.trashCategory !== 'screenshot' &&
        p.trashCategory !== 'memo'
    );
    const dedupedActive = dedupeByVisualScene(active, selectedPhoto.id).filter(
      (p) => p.clusterId === undefined || p.clusterId !== selectedPhoto.clusterId
    );
    const dayPrefix = selectedPhoto.date.split(' ')[0];
    const monthPrefix = dayPrefix.slice(0, 7);
    const exactDay = dedupedActive.filter((p) => p.date.startsWith(dayPrefix));
    if (exactDay.length >= 6) return exactDay.slice(0, 12);
    const sameMonth = dedupedActive.filter(
      (p) => !p.date.startsWith(dayPrefix) && p.date.startsWith(monthPrefix)
    );
    const combined = [...exactDay, ...sameMonth];
    if (combined.length >= 6) return combined.slice(0, 12);
    const fallback = dedupedActive.filter((p) => !combined.some((c) => c.id === p.id));
    return [...combined, ...fallback].slice(0, 12);
  }, [selectedPhoto, scopedPhotos]);

  const similarVisualWithScores = useMemo(() => {
    if (!selectedPhoto) return [];
    const active = scopedPhotos.filter(
      (p) =>
        !p.quarantined &&
        p.id !== selectedPhoto.id &&
        p.trashCategory !== 'blurry' &&
        p.trashCategory !== 'screenshot' &&
        p.trashCategory !== 'memo' &&
        (selectedPhoto.clusterId === undefined || p.clusterId !== selectedPhoto.clusterId)
    );
    const deduped = dedupeByVisualScene(active, selectedPhoto.id);
    const primaryTag = selectedPhoto.tags[0] || '';
    const selKwSet = new Set((selectedPhoto.keywordsKo ?? []).map((k) => k.toLowerCase()));

    const scored = deduped.map((p) => {
      let vecSim = 0.68;
      if (selectedPhoto.vec && p.vec && selectedPhoto.vec.length === p.vec.length) {
        vecSim = cosineSimilarity(selectedPhoto.vec, p.vec);
      }
      const pPrimary = p.tags[0] || '';
      const samePrimary = primaryTag && pPrimary === primaryTag ? 0.14 : 0;
      const sharedTags = p.tags.filter((t) => selectedPhoto.tags.includes(t)).length;
      const sharedKws = (p.keywordsKo ?? []).filter((k) => selKwSet.has(k.toLowerCase())).length;

      const totalScore = vecSim + samePrimary + sharedTags * 0.04 + sharedKws * 0.03;
      const pct = Math.min(98, Math.max(82, Math.round(78 + totalScore * 18)));
      return { photo: p, score: totalScore, simPct: pct };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 12);
  }, [selectedPhoto, scopedPhotos]);

  const similarVisualPhotos = useMemo(
    () => similarVisualWithScores.map((s) => s.photo),
    [similarVisualWithScores]
  );

  const drillDownPhotos = useMemo(() => {
    if (!selectedPhoto) return [];
    const active = scopedPhotos.filter(
      (p) =>
        !p.quarantined &&
        p.id !== selectedPhoto.id &&
        p.trashCategory !== 'blurry' &&
        p.trashCategory !== 'screenshot' &&
        p.trashCategory !== 'memo'
    );
    const dedupedActive = dedupeByVisualScene(active, selectedPhoto.id);

    if (!drillQuery.trim()) {
      const base = [
        ...similarVisualPhotos,
        ...sameDayPhotos,
        ...dedupedActive,
      ];
      return dedupeByVisualScene(base, selectedPhoto.id).slice(0, 12);
    }

    const tokens = drillQuery
      .trim()
      .split(/[\s,#·]+/)
      .filter(Boolean);

    const matched = dedupedActive.filter((p) => tokens.every((tk) => matchPhotoQuery(p, tk)));
    return matched.slice(0, 12);
  }, [selectedPhoto, scopedPhotos, sameDayPhotos, similarVisualPhotos, drillQuery]);

  if (!selectedPhoto) return null;

  const dayString = selectedPhoto.date.split(' ')[0];
  const hasBurstGroup = resolvedBurstPhotos.length >= 2;

  const currentStripPhotos =
    activeTab === 'same-day'
      ? sameDayPhotos
      : activeTab === 'similar-visual'
      ? similarVisualPhotos
      : drillDownPhotos;

  const quickDrillKeywords = ['오후', '해변', '웃는', '야외', '가족'];

  return (
    <div
      onClick={() => setSelectedPhoto(null)}
      className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 pt-safe pb-safe overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-4xl max-h-[90dvh] overflow-y-auto rounded-2xl bg-white p-4 sm:p-5 md:p-6 border border-slate-200 shadow-2xl text-slate-900 flex flex-col gap-4 my-auto"
      >
        {/* Top Header */}
        <div className="flex flex-col gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-start justify-between gap-3 min-w-0">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[15.5px] sm:text-[17px] text-slate-900 font-bold break-all leading-snug">
                  {selectedPhoto.name}
                </h3>
                {hasBurstGroup && (
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-semibold shrink-0">
                    연사 {resolvedBurstPhotos.length}장
                  </span>
                )}
                {isHiddenInLounge && (
                  <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-semibold shrink-0">
                    공유방 숨김 (원본 보존)
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-slate-500 mt-1">
                <span>
                  {activeLoungeType === 'personal'
                    ? selectedPhoto.locationKo || '내 기기 보관'
                    : `업로드: ${(selectedPhoto.uploaderLabel || '방장').replace(/^[👑📸\s]+/u, '')}`}
                </span>
                <span>·</span>
                <span>{selectedPhoto.date}</span>
                <span>·</span>
                <span>{(selectedPhoto.size / 1024 / 1024).toFixed(2)} MB</span>
              </div>
              {selectedPhoto.fullPath ? (
                <p className="text-[11.5px] text-slate-500 mt-1 break-all">
                  위치: {selectedPhoto.fullPath}
                </p>
              ) : selectedPhoto.fullUrl?.startsWith('/sample_photos_301/') ||
                selectedPhoto.fullUrl?.startsWith('/poc/') ||
                selectedPhoto.fullUrl?.startsWith('/shared_family_host_thumbs/') ||
                String(selectedPhoto.id || '').startsWith('shared_host_') ? (
                <p className="text-[11.5px] text-slate-400 mt-1">
                  공유방 · 샘플 예시 사진입니다.
                </p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => setSelectedPhoto(null)}
              aria-label="닫기"
              className="w-8 h-8 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 shrink-0 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0 max-w-full">
            <a
              href={isGuestPreviewMode ? '#guest-join-wall' : selectedPhoto.fullUrl}
              download={isGuestPreviewMode ? undefined : selectedPhoto.name}
              onClick={(e) => {
                if (isGuestPreviewMode) {
                  e.preventDefault();
                  triggerGuestJoinWall('원본 저장');
                  return;
                }
                setActionNotice(
                  `'${selectedPhoto.name}' 원본(${(selectedPhoto.size / 1024 / 1024).toFixed(2)}MB) 다운로드를 시작했습니다.`
                );
              }}
              className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>원본 저장</span>
            </a>

            {isSharedLounge && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (isHiddenInLounge) {
                      restoreSharedRoomPhotoFromTrash(selectedPhoto.id);
                      setActionNotice(
                        `'${selectedPhoto.name}' 사진의 숨김을 해제해 공유방 앨범으로 복원했습니다.`
                      );
                    } else {
                      softDeleteSharedRoomPhoto24h(selectedPhoto.id, 'host_hide');
                      setActionNotice(
                        `'${selectedPhoto.name}' 사진을 공유방 목록에서 숨겨 [공유방 휴지통 · 숨긴 사진함]으로 옮겼습니다. [숨긴 사진함 바로가기]에서 언제든 확인하고 숨김 해제할 수 있습니다.`
                      );
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-colors cursor-pointer ${
                    isHiddenInLounge
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <span>{isHiddenInLounge ? '숨김 해제' : '목록에서 숨기기'}</span>
                </button>
                {isHiddenInLounge && (
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        sessionStorage.setItem('ghosti_scroll_shared_trash_once', '1');
                      } catch {
                        /* ignore */
                      }
                      setSelectedPhoto(null);
                      setDesktopTab('trash');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[12px] font-medium transition-colors cursor-pointer"
                  >
                    숨긴 사진함 바로가기
                  </button>
                )}
              </>
            )}

            <button
              type="button"
              onClick={() =>
                dispatchGhostCastLiveCommand({
                  action: 'OPEN_MONITOR_CAST',
                  photoId: selectedPhoto.id,
                })
              }
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[12px] font-medium transition-colors cursor-pointer"
            >
              <span>모니터로 보기</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const pieces: string[] = [];
                if (selectedPhoto.captionKo && selectedPhoto.captionKo.trim()) {
                  pieces.push(selectedPhoto.captionKo.trim());
                }
                const kw = (selectedPhoto.keywordsKo || []).filter(Boolean);
                if (kw.length > 0 && !pieces.join(' ').includes(kw[0])) {
                  pieces.push(kw.join(' · '));
                }
                const tagText = (selectedPhoto.tags || []).filter(Boolean).join(' · ');
                if (pieces.length === 0 && tagText) {
                  pieces.push(tagText);
                }
                const extracted =
                  pieces.join('\n') ||
                  `${selectedPhoto.name}${selectedPhoto.date ? ` (${selectedPhoto.date})` : ''}`;
                const chips = Array.from(
                  new Set([...(selectedPhoto.keywordsKo || []), ...(selectedPhoto.tags || [])])
                ).slice(0, 16);
                void tryMakeCompactThumbDataUrl(selectedPhoto.thumbUrl || selectedPhoto.fullUrl).then(
                  (thumbB64) => {
                    pushTeleportPhotoToPcVanguard({
                      fileName: selectedPhoto.name,
                      ocrText: extracted,
                      summary: selectedPhoto.name,
                      thumbWebpBase64: thumbB64,
                      chips,
                    });
                  }
                );
                setActionNotice(
                  `'${selectedPhoto.name}' 텍스트 정보를 내 PC 클립보드로 전송했습니다. PC에서 Ctrl + V로 붙여넣을 수 있습니다.`
                );
              }}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[12px] font-medium transition-colors cursor-pointer"
            >
              <span>PC로 텍스트 전송</span>
            </button>

            <button
              onClick={() => {
                if (isGuestPreviewMode) {
                  triggerGuestJoinWall('즐겨찾기 및 댓글');
                  return;
                }
                toggleBookmark(selectedPhoto.id);
              }}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium flex items-center gap-1 border transition-colors cursor-pointer ${
                selectedPhoto.bookmarked
                  ? 'bg-rose-50 border-rose-200 text-rose-700 font-semibold'
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <span
                className="material-symbols-outlined text-[15px]"
                style={
                  selectedPhoto.bookmarked
                    ? { fontVariationSettings: "'FILL' 1, 'wght' 600" }
                    : undefined
                }
              >
                favorite
              </span>
              <span>{selectedPhoto.bookmarked ? '즐겨찾기됨' : '즐겨찾기'}</span>
            </button>

            <button
              onClick={() => {
                if (selectedPhoto.fullPath) {
                  void openLocalFolder('photos', selectedPhoto.fullPath);
                  setActionNotice(`원본 위치를 열었습니다: ${selectedPhoto.fullPath}`);
                  return;
                }
                const isSampleOrSharedUrl =
                  selectedPhoto.fullUrl?.startsWith('/sample_photos_301/') ||
                  selectedPhoto.fullUrl?.startsWith('/poc/') ||
                  selectedPhoto.fullUrl?.startsWith('/shared_family_host_thumbs/') ||
                  String(selectedPhoto.id || '').startsWith('shared_host_');
                if (isSampleOrSharedUrl) {
                  setActionNotice(
                    '공유방 또는 예시 사진이라 내 PC 로컬 폴더에는 저장되어 있지 않습니다.'
                  );
                  return;
                }
                const fallbackTarget = selectedPhoto.fullUrl?.includes('/__photos/file')
                  ? selectedPhoto.name
                  : undefined;
                void openLocalFolder('photos', fallbackTarget);
                setActionNotice('탐색기에서 사진 폴더를 열었습니다.');
              }}
              className="hidden sm:flex px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[12px] font-medium items-center gap-1 cursor-pointer"
            >
              <span>폴더 열기</span>
            </button>
          </div>

          {actionNotice && (
            <div className="px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-[12px] font-medium flex items-center justify-between gap-2">
              <span className="min-w-0 break-keep">{actionNotice}</span>
              <button
                type="button"
                onClick={() => setActionNotice(null)}
                className="text-xs text-slate-500 hover:text-slate-800 font-semibold px-2 py-0.5 rounded shrink-0 cursor-pointer"
              >
                닫기
              </button>
            </div>
          )}
        </div>

        {/* Burst Comparison */}
        {hasBurstGroup && (
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[13px] text-slate-800 font-semibold">
                연사 {resolvedBurstPhotos.length}장 비교 — 남길 사진 1장을 선택해 주세요
              </span>

              <button
                onClick={() => {
                  void pickBestInBurstPhotos(resolvedBurstPhotos, selectedPhoto.id);
                  setSelectedPhoto(selectedPhoto, null);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12px] font-semibold cursor-pointer transition-colors"
              >
                현재 1장만 남기고 나머지 {resolvedBurstPhotos.length - 1}장 휴지통 이동
              </button>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {resolvedBurstPhotos.slice(0, 6).map((bp, idx) => {
                const isCurrent = bp.id === selectedPhoto.id;
                return (
                  <div
                    key={bp.id}
                    data-keep-dark="true"
                    onClick={() => setSelectedPhoto(bp, resolvedBurstPhotos)}
                    className={`relative rounded-lg overflow-hidden aspect-[4/3] cursor-pointer border-2 transition-all bg-black ${
                      isCurrent
                        ? 'border-slate-900 ring-2 ring-slate-900/20'
                        : 'border-slate-200 opacity-80 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={bp.thumbUrl}
                      alt={bp.name}
                      crossOrigin={bp.thumbUrl?.startsWith('http://127.0.0.1') ? 'anonymous' : undefined}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/75 text-[10px] font-semibold text-white">
                      #{idx + 1}
                    </div>
                    {isCurrent && (
                      <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-white text-slate-900 text-[10px] font-bold">
                        선택됨
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Main Photo Preview + Related Tabs */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
          <div
            data-keep-dark="true"
            className="md:col-span-7 relative rounded-xl overflow-hidden bg-zinc-950 border border-slate-200 min-h-[220px] max-h-[380px] flex items-center justify-center"
          >
            <img
              src={selectedPhoto.fullUrl}
              alt={selectedPhoto.name}
              crossOrigin={selectedPhoto.fullUrl?.startsWith('http://127.0.0.1') ? 'anonymous' : undefined}
              className="max-h-[380px] w-auto object-contain"
            />
            {photoNavList.length >= 2 && (
              <>
                <button
                  type="button"
                  data-keep-dark="true"
                  aria-label="이전 사진"
                  title="이전 사진 (←)"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateAdjacentPhoto(-1);
                  }}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 border border-white/25 text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[22px]">chevron_left</span>
                </button>
                <button
                  type="button"
                  data-keep-dark="true"
                  aria-label="다음 사진"
                  title="다음 사진 (→)"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateAdjacentPhoto(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 border border-white/25 text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[22px]">chevron_right</span>
                </button>
                {currentPhotoIdx >= 0 && (
                  <span
                    data-keep-dark="true"
                    className="absolute bottom-2.5 right-2.5 z-10 px-2.5 py-0.5 rounded-full bg-black/75 border border-white/25 text-white text-[11px] font-semibold pointer-events-none"
                  >
                    {currentPhotoIdx + 1} / {photoNavList.length}
                  </span>
                )}
              </>
            )}
          </div>

          <div className="md:col-span-5 flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <span className="text-[12px] text-slate-500 font-semibold">
                사진 설명 · 연관 탐색
              </span>
              {selectedPhoto.captionKo && (
                <p className="text-[12.5px] text-slate-700 leading-relaxed bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
                  {selectedPhoto.captionKo}
                </p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {selectedPhoto.tags
                  .filter((t) => !t.includes('원본보존') && !t.includes('연사·중복'))
                  .map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setActiveTab('drill-down');
                        setDrillQuery(t.replace(/^#/, ''));
                      }}
                      className="cursor-pointer px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11.5px] font-medium transition-colors"
                    >
                      {t}
                    </button>
                  ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <button
                onClick={() => setActiveTab('same-day')}
                className={`px-3 py-2.5 rounded-lg text-left flex items-center justify-between gap-2 border text-[13px] transition-colors cursor-pointer ${
                  activeTab === 'same-day'
                    ? 'bg-teal-600 border-teal-600 text-white font-semibold'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 font-medium'
                }`}
              >
                <span>같은 날 찍은 사진 ({dayString})</span>
                <span className={`text-[12px] tabular-nums ${activeTab === 'same-day' ? 'text-slate-300' : 'text-slate-400'}`}>
                  {sameDayPhotos.length}장
                </span>
              </button>

              <button
                onClick={() => setActiveTab('similar-visual')}
                className={`px-3 py-2.5 rounded-lg text-left flex items-center justify-between gap-2 border text-[13px] transition-colors cursor-pointer ${
                  activeTab === 'similar-visual'
                    ? 'bg-teal-600 border-teal-600 text-white font-semibold'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 font-medium'
                }`}
              >
                <span>비슷한 장면 · 피사체 사진</span>
                <span className={`text-[12px] tabular-nums ${activeTab === 'similar-visual' ? 'text-slate-300' : 'text-slate-400'}`}>
                  {similarVisualPhotos.length}장
                </span>
              </button>

              <button
                onClick={() => setActiveTab('drill-down')}
                className={`px-3 py-2.5 rounded-lg text-left flex items-center justify-between gap-2 border text-[13px] transition-colors cursor-pointer ${
                  activeTab === 'drill-down'
                    ? 'bg-teal-600 border-teal-600 text-white font-semibold'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 font-medium'
                }`}
              >
                <span>조건 추가하여 좁혀보기</span>
                <span className={`text-[12px] tabular-nums ${activeTab === 'drill-down' ? 'text-slate-300' : 'text-slate-400'}`}>
                  {drillDownPhotos.length}장
                </span>
              </button>
            </div>

            {activeTab === 'drill-down' && (
              <div className="flex flex-col gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={drillQuery}
                    onChange={(e) => setDrillQuery(e.target.value)}
                    placeholder="추가 검색어 (예: 오후, 해변, 웃는)"
                    className="w-full h-9 pl-3 pr-14 rounded-lg bg-white border border-slate-300 focus:border-slate-600 text-[12.5px] text-slate-900 outline-none"
                  />
                  {drillQuery.trim() && (
                    <button
                      onClick={() => setDrillQuery('')}
                      className="absolute right-2 px-2 py-0.5 rounded bg-slate-100 text-[11px] font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                    >
                      초기화
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {quickDrillKeywords.map((kw) => {
                    const isSelected = drillQuery.trim() === kw;
                    return (
                      <button
                        key={kw}
                        type="button"
                        onClick={() => setDrillQuery(isSelected ? '' : kw)}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-slate-900 text-white'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {kw}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Related Photo Strip */}
        <div className="flex flex-col gap-2.5 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12.5px] text-slate-700 font-semibold">
              {activeTab === 'same-day' && `${dayString} 전후 촬영 사진 (${sameDayPhotos.length}장)`}
              {activeTab === 'similar-visual' && `비슷한 사진 (${similarVisualPhotos.length}장)`}
              {activeTab === 'drill-down' &&
                (drillQuery.trim()
                  ? `‘${drillQuery.trim()}’ 일치 사진 (${drillDownPhotos.length}장)`
                  : `연관 사진 (${drillDownPhotos.length}장)`)}
            </span>
            <span className="text-[11.5px] text-slate-400 shrink-0">
              상위 {Math.min(6, currentStripPhotos.length)}장 표시
            </span>
          </div>

          {currentStripPhotos.length === 0 ? (
            <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 text-center flex flex-col items-center gap-2">
              <span className="text-[13px] font-medium text-slate-600">
                ‘{drillQuery}’ 조건과 일치하는 연관 사진이 없습니다.
              </span>
              <button
                type="button"
                onClick={() => setDrillQuery('')}
                className="px-3 py-1 rounded-md bg-teal-600 text-white text-[12px] font-medium cursor-pointer"
              >
                필터 초기화
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {currentStripPhotos.slice(0, 6).map((item, idx) => {
                const simPct =
                  activeTab === 'similar-visual'
                    ? similarVisualWithScores[idx]?.simPct ?? 95 - idx * 2
                    : 95;
                return (
                  <div
                    key={`${activeTab}_${item.id}`}
                    data-keep-dark="true"
                    onClick={() => setSelectedPhoto(item)}
                    className="group cursor-pointer rounded-lg overflow-hidden bg-zinc-900 aspect-square relative border border-slate-200 hover:border-slate-400"
                  >
                    <img
                      src={item.thumbUrl}
                      alt={item.name}
                      crossOrigin={item.thumbUrl?.startsWith('http://127.0.0.1') ? 'anonymous' : undefined}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-medium">
                      {activeTab === 'same-day' && item.date.split(' ')[0].slice(5)}
                      {activeTab === 'similar-visual' && `유사 ${simPct}%`}
                      {activeTab === 'drill-down' &&
                        (drillQuery.trim() ? drillQuery.trim() : item.tags[0] || '연관')}
                    </div>
                    <div className="absolute inset-x-0 bottom-0 px-1.5 py-1 bg-black/70 text-[10px] text-white truncate">
                      {item.name}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
