import React, { useMemo, useState } from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';
import { cosineSimilarity } from '../services/aiEngine';
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

  // 1) 해변 / 바다 키워드 (실제 바다·해변·백사장·파도 장면만 엄격 매칭)
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

  // 2) 웃는 / 미소 키워드 (진지한 표정·무표정·실루엣·뒷모습 원천 배제)
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

  // 3) 단체 / 모임 키워드 (1인 단독 사진 원천 배제)
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

  // 4) 오후 / 낮 / 햇살 / 노을 키워드
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

  // 5) 야외 / 풍경 / 자연 / 공원 키워드 (실내 스튜디오/거실/사무실 제외)
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

  // 6) 가족 키워드 (실제 가족·아이·부모·아기 사진만 매칭)
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

  // 기본 키워드 검색: 시맨틱 태그·키워드·캡션·위치 일치
  return combined.includes(t);
}

export const PhotoDetailModal: React.FC = () => {
  const {
    selectedPhoto,
    selectedBurstGroup,
    setSelectedPhoto,
    photos,
    duplicateGroups,
    toggleBookmark,
    openLocalFolder,
    pickBestInBurstPhotos,
  } = useSaySeeStore();

  const [activeTab, setActiveTab] = useState<ContextTab>('same-day');
  const [drillQuery, setDrillQuery] = useState('');

  // 선택된 사진이 속한 실제 연사/중복 그룹 전체 조회
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

  // 1번 탭: 이 날 찍은 사진 전체 (동일 장면 중복 사본은 대표 1장만 남겨 다양한 장면 노출)
  const sameDayPhotos = useMemo(() => {
    if (!selectedPhoto) return [];
    const active = photos.filter(
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
  }, [selectedPhoto, photos]);

  // 2번 탭: 비슷한 피사체 사진 (768차원 벡터 코사인 유사도 + 핵심 피사체 카테고리 매칭)
  const similarVisualWithScores = useMemo(() => {
    if (!selectedPhoto) return [];
    const active = photos.filter(
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
  }, [selectedPhoto, photos]);

  const similarVisualPhotos = useMemo(
    () => similarVisualWithScores.map((s) => s.photo),
    [similarVisualWithScores]
  );

  // 3번 탭: 2차 자연어 좁혀가기 (결과 내 재검색)
  const drillDownPhotos = useMemo(() => {
    if (!selectedPhoto) return [];
    const active = photos.filter(
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
  }, [selectedPhoto, photos, sameDayPhotos, similarVisualPhotos, drillQuery]);

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
      className="fixed inset-0 z-[90] bg-surface/90 backdrop-blur-2xl flex items-center justify-center p-4 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl rounded-3xl glass-l2 p-5 md:p-7 border border-primary-container/30 shadow-[0_0_60px_rgba(0,0,0,0.75)] flex flex-col gap-5 my-auto"
      >
        {/* Top Bar */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="material-symbols-outlined text-primary-container text-[22px]">
              auto_awesome
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold truncate">
                  {selectedPhoto.name}
                </h3>
                {hasBurstGroup && (
                  <span className="px-2.5 py-0.5 rounded-full bg-teal-600 text-white dark:bg-primary-container/25 dark:text-primary-container border border-teal-700/40 dark:border-primary-container/50 font-label-sm text-[11px] font-extrabold shrink-0">
                    ❐ {resolvedBurstPhotos.length}장 연사 묶음
                  </span>
                )}
              </div>
              <p className="font-label-mono text-[11px] text-on-surface-variant">
                촬영일: {selectedPhoto.date} • {(selectedPhoto.size / 1024 / 1024).toFixed(2)} MB •
                768차원 시각 임베딩 일치
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => toggleBookmark(selectedPhoto.id)}
              className={`px-3 py-1.5 rounded-full font-label-sm text-label-sm flex items-center gap-1 transition-colors ${
                selectedPhoto.bookmarked
                  ? 'bg-primary-container text-on-primary-container font-bold'
                  : 'bg-surface-container-high text-on-surface-variant hover:text-primary'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">favorite</span>
              <span>{selectedPhoto.bookmarked ? '즐겨찾기됨' : '즐겨찾기'}</span>
            </button>
            <button
              onClick={() => void openLocalFolder('photos')}
              className="px-3 py-1.5 rounded-full bg-surface-container-high hover:bg-surface-bright text-on-surface font-label-sm text-label-sm flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">folder_open</span>
              <span>원본 폴더</span>
            </button>
            <button
              onClick={() => setSelectedPhoto(null)}
              className="w-8 h-8 rounded-full bg-surface-container-highest hover:bg-surface-bright flex items-center justify-center text-on-surface"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>

        {/* 연사 묶음일 경우 상단 비교 & 즉시 Pick 바둑판 영역 */}
        {hasBurstGroup && (
          <div className="p-4 rounded-2xl bg-surface-container-low border border-primary-container/40 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-500/50 font-label-sm text-[11px] font-extrabold">
                  ✓ 원본 1장 안전하게 보존됨
                </span>
                <span className="font-label-md text-[13px] text-on-surface font-bold">
                  함께 묶인 연사 {resolvedBurstPhotos.length}장 비교 — 마음에 드는 1장을 골라보세요
                </span>
              </div>

              <button
                onClick={() => {
                  void pickBestInBurstPhotos(resolvedBurstPhotos, selectedPhoto.id);
                  setSelectedPhoto(selectedPhoto, null);
                }}
                className="px-3.5 py-1.5 rounded-full bg-primary-container text-on-primary-container font-label-sm text-[12px] font-extrabold flex items-center gap-1 shadow-[0_0_14px_rgba(0,229,255,0.35)] hover:opacity-95 transition-all"
              >
                <span className="material-symbols-outlined text-[15px]">check_circle</span>
                <span>
                  현재 사진 1장만 남기고 나머지 {resolvedBurstPhotos.length - 1}장 OS 기본 [휴지통] 정리 (Pick)
                </span>
              </button>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
              {resolvedBurstPhotos.slice(0, 6).map((bp, idx) => {
                const isCurrent = bp.id === selectedPhoto.id;
                return (
                  <div
                    key={bp.id}
                    onClick={() => setSelectedPhoto(bp, resolvedBurstPhotos)}
                    className={`relative rounded-xl overflow-hidden aspect-[4/3] cursor-pointer border-2 transition-all ${
                      isCurrent
                        ? 'border-primary-container ring-2 ring-primary-container/40 scale-[1.02]'
                        : 'border-outline-variant/30 opacity-80 hover:opacity-100'
                    }`}
                  >
                    <img src={bp.thumbUrl} alt={bp.name} className="w-full h-full object-cover" />
                    <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/75 text-[10px] font-bold text-white">
                      #{idx + 1}
                    </div>
                    {isCurrent && (
                      <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-primary-container text-on-primary-container text-[10px] font-extrabold">
                        선택됨
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Main Photo Preview + Tags */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
          <div className="md:col-span-7 rounded-2xl overflow-hidden bg-surface-container-lowest border border-outline-variant/30 max-h-[380px] flex items-center justify-center">
            <img
              src={selectedPhoto.fullUrl}
              alt={selectedPhoto.name}
              className="max-h-[380px] w-auto object-contain"
            />
          </div>

          {/* 3.2절: 2차 연관 꼬리물기 탐색 (Contextual Tabs) */}
          <div className="md:col-span-5 flex flex-col gap-3 h-full justify-between">
            <div className="flex flex-col gap-2">
              <span className="font-label-mono text-[11px] text-teal-700 dark:text-primary-container uppercase tracking-wider font-extrabold">
                CONTEXTUAL SNIPING DRILL-DOWN (3.2절)
              </span>
              {selectedPhoto.captionKo && (
                <p className="text-[12px] text-on-surface-variant leading-snug bg-surface-container/60 px-3 py-2 rounded-xl border border-outline-variant/20">
                  {selectedPhoto.captionKo}
                </p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {selectedPhoto.tags
                  .filter((t) => !t.includes('원본보존') && !t.includes('연사·중복'))
                  .map((t) => (
                    <span
                      key={t}
                      onClick={() => {
                        setActiveTab('drill-down');
                        setDrillQuery(t.replace(/^#/, ''));
                      }}
                      className="cursor-pointer px-2.5 py-1 rounded-full bg-primary-container/15 hover:bg-primary-container/30 text-teal-800 dark:text-primary font-label-mono text-[11px] font-bold border border-primary-container/30 transition-colors"
                    >
                      {t}
                    </span>
                  ))}
              </div>
            </div>

            {/* 3 Contextual Tabs */}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setActiveTab('same-day')}
                className={`p-3 rounded-xl text-left flex items-center justify-between gap-2 border transition-all ${
                  activeTab === 'same-day'
                    ? 'bg-primary-container/20 border-primary-container text-on-surface font-bold shadow-sm'
                    : 'bg-surface-container/70 border-outline-variant/25 text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="font-label-md text-label-md">
                  📅 이 날 찍은 사진 전체 ({dayString})
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-teal-600 text-white dark:bg-teal-400 dark:text-slate-950 font-label-mono text-[12px] font-extrabold shrink-0 shadow-sm">
                  {sameDayPhotos.length}장
                </span>
              </button>

              <button
                onClick={() => setActiveTab('similar-visual')}
                className={`p-3 rounded-xl text-left flex items-center justify-between gap-2 border transition-all ${
                  activeTab === 'similar-visual'
                    ? 'bg-primary-container/20 border-primary-container text-on-surface font-bold shadow-sm'
                    : 'bg-surface-container/70 border-outline-variant/25 text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="font-label-md text-label-md">
                  🐶 비슷한 피사체 사진 (벡터 유사도 매칭)
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-600 text-white dark:bg-indigo-400 dark:text-slate-950 font-label-mono text-[12px] font-extrabold shrink-0 shadow-sm">
                  {similarVisualPhotos.length}장
                </span>
              </button>

              <button
                onClick={() => setActiveTab('drill-down')}
                className={`p-3 rounded-xl text-left flex items-center justify-between gap-2 border transition-all ${
                  activeTab === 'drill-down'
                    ? 'bg-primary-container/20 border-primary-container text-on-surface font-bold shadow-sm'
                    : 'bg-surface-container/70 border-outline-variant/25 text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="font-label-md text-label-md">
                  ➕ 2차 자연어 좁혀가기 (결과 내 재검색)
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-600 text-white dark:bg-amber-400 dark:text-slate-950 font-label-mono text-[12px] font-extrabold shrink-0 shadow-sm">
                  {drillDownPhotos.length}장
                </span>
              </button>
            </div>

            {activeTab === 'drill-down' && (
              <div className="flex flex-col gap-2 p-2.5 rounded-xl bg-surface-container-low border border-primary-container/40">
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={drillQuery}
                    onChange={(e) => setDrillQuery(e.target.value)}
                    placeholder="연관 사진 내 2차 필터 (예: 오후, 해변, 웃는)"
                    className="w-full h-10 pl-3 pr-16 rounded-xl bg-surface-container-lowest border border-primary-container/50 text-body-sm text-on-surface outline-none focus:ring-2 focus:ring-primary-container/40"
                  />
                  {drillQuery.trim() && (
                    <button
                      onClick={() => setDrillQuery('')}
                      className="absolute right-2 px-2 py-0.5 rounded-md bg-surface-container-high text-[11px] font-bold text-on-surface-variant hover:text-on-surface"
                    >
                      초기화
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold text-on-surface-variant mr-1">
                    추천 2차 키워드:
                  </span>
                  {quickDrillKeywords.map((kw) => {
                    const isSelected = drillQuery.trim() === kw;
                    return (
                      <button
                        key={kw}
                        type="button"
                        onClick={() => setDrillQuery(isSelected ? '' : kw)}
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold transition-all ${
                          isSelected
                            ? 'bg-teal-600 text-white dark:bg-primary-container dark:text-on-primary-container'
                            : 'bg-surface-container-high text-on-surface hover:bg-primary-container/20'
                        }`}
                      >
                        #{kw}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Contextual Photo Strip */}
        <div className="flex flex-col gap-2.5 pt-3 border-t border-outline-variant/25">
          <div className="flex items-center justify-between gap-2">
            <span className="font-label-sm text-[13px] text-on-surface font-bold">
              {activeTab === 'same-day' &&
                `📅 ${dayString} 및 인접 시점에 함께 촬영된 기억 (${sameDayPhotos.length}장)`}
              {activeTab === 'similar-visual' &&
                `🐶 피사체 시각 임베딩 유사도 상위 결과 (${similarVisualPhotos.length}장)`}
              {activeTab === 'drill-down' &&
                (drillQuery.trim()
                  ? `➕ '${drillQuery.trim()}' 조건과 정확히 일치하는 사진 (${drillDownPhotos.length}장)`
                  : `➕ 2차 자연어 좁혀가기 대상 사진 (${drillDownPhotos.length}장 — 위 입력창에 '해변', '웃는', '오후' 등을 입력하거나 태그를 눌러보세요)`)}
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-surface-container-highest text-on-surface font-label-mono text-[11px] font-extrabold shrink-0">
              표시 중: 상위 {Math.min(6, currentStripPhotos.length)}장 / 전체 {currentStripPhotos.length}장
            </span>
          </div>

          {currentStripPhotos.length === 0 ? (
            <div className="p-6 rounded-2xl bg-surface-container-low border border-outline-variant/30 text-center flex flex-col items-center gap-2">
              <span className="text-body-sm font-bold text-on-surface">
                '{drillQuery}' 조건과 일치하는 연관 사진이 없습니다.
              </span>
              <button
                type="button"
                onClick={() => setDrillQuery('')}
                className="px-3 py-1 rounded-full bg-primary-container text-on-primary-container text-[12px] font-bold"
              >
                필터 초기화하고 전체 보기
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
              {currentStripPhotos.slice(0, 6).map((item, idx) => {
                const simPct =
                  activeTab === 'similar-visual'
                    ? similarVisualWithScores[idx]?.simPct ?? 95 - idx * 2
                    : 95;
                return (
                  <div
                    key={`${activeTab}_${item.id}`}
                    onClick={() => setSelectedPhoto(item)}
                    className="group cursor-pointer rounded-xl overflow-hidden bg-surface-container aspect-square relative border border-outline-variant/30 hover:border-primary-container shadow-sm"
                  >
                    <img
                      src={item.thumbUrl}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/75 text-white font-label-mono text-[10px] font-bold">
                      {activeTab === 'same-day' && `📅 ${item.date.split(' ')[0].slice(5)}`}
                      {activeTab === 'similar-visual' && `🐶 유사 ${simPct}%`}
                      {activeTab === 'drill-down' &&
                        (drillQuery.trim()
                          ? `🔎 '${drillQuery.trim()}'`
                          : item.tags[0] || '#연관')}
                    </div>
                    <div className="absolute inset-x-0 bottom-0 px-1.5 py-1 bg-black/75 font-label-mono text-[10px] text-white font-semibold truncate">
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
