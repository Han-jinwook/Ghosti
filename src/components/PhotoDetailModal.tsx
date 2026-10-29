import React, { useMemo, useState } from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';
import type { PhotoItem } from '../types/saysee';

type ContextTab = 'same-day' | 'similar-visual' | 'drill-down';

function matchPhotoQuery(p: PhotoItem, token: string): boolean {
  const t = token.trim().toLowerCase();
  if (!t) return true;

  const caption = (p.captionKo || '').toLowerCase();
  const name = p.name.toLowerCase();
  const tagsStr = p.tags.join(' ').toLowerCase();
  const location = (p.locationKo || '').toLowerCase();

  // 1) 해변 / 바다 키워드
  if (t === '해변' || t === '바다' || t === 'beach' || t === '백사장') {
    return (
      caption.includes('해변') ||
      caption.includes('바다') ||
      caption.includes('백사장') ||
      caption.includes('모래사장') ||
      caption.includes('파도') ||
      tagsStr.includes('해변') ||
      tagsStr.includes('바다') ||
      name.startsWith('trv_') ||
      name.includes('beach') ||
      name.includes('바다')
    );
  }

  // 2) 웃는 / 미소 키워드
  if (t === '웃는' || t === '미소' || t === '웃음' || t === 'smile' || t === '환하게') {
    return (
      caption.includes('웃') ||
      caption.includes('미소') ||
      caption.includes('환하게') ||
      caption.includes('해맑') ||
      tagsStr.includes('미소') ||
      tagsStr.includes('웃음')
    );
  }

  // 3) 오후 / 낮 / 햇살 키워드
  if (t === '오후' || t === '낮' || t === '햇살' || t === '해질녘' || t === '노을') {
    const timePart = p.date.split(' ')[1] || '';
    const hour = parseInt(timePart.split(':')[0] || '', 10);
    const isAfternoonTime = !Number.isNaN(hour) && hour >= 12;
    return (
      caption.includes('오후') ||
      caption.includes('햇살') ||
      caption.includes('해 질 녘') ||
      caption.includes('노을') ||
      caption.includes('낮') ||
      tagsStr.includes('오후') ||
      tagsStr.includes('노을') ||
      isAfternoonTime
    );
  }

  // 4) 야외 / 풍경 키워드
  if (t === '야외' || t === '풍경' || t === '자연' || t === '공원') {
    return (
      caption.includes('야외') ||
      caption.includes('풍경') ||
      caption.includes('공원') ||
      caption.includes('자연') ||
      tagsStr.includes('야외') ||
      tagsStr.includes('풍경') ||
      tagsStr.includes('공원')
    );
  }

  // 5) 가족 / 인물 키워드
  if (t === '가족' || t === '인물' || t === '아이' || t === '친구') {
    return (
      caption.includes('가족') ||
      caption.includes('인물') ||
      caption.includes('아이') ||
      caption.includes('부모') ||
      caption.includes('친구') ||
      tagsStr.includes('가족') ||
      tagsStr.includes('인물')
    );
  }

  // 기본 검색: 캡션, 태그, 파일명, 위치
  return (
    caption.includes(t) ||
    tagsStr.includes(t) ||
    name.includes(t) ||
    location.includes(t)
  );
}

export const PhotoDetailModal: React.FC = () => {
  const {
    selectedPhoto,
    selectedBurstGroup,
    setSelectedPhoto,
    photos,
    toggleBookmark,
    openLocalFolder,
    pickBestInBurstPhotos,
  } = useSaySeeStore();

  const [activeTab, setActiveTab] = useState<ContextTab>('same-day');
  const [drillQuery, setDrillQuery] = useState('');

  const sameDayPhotos = useMemo(() => {
    if (!selectedPhoto) return [];
    const active = photos.filter((p) => !p.quarantined && p.id !== selectedPhoto.id);
    const dayPrefix = selectedPhoto.date.split(' ')[0];
    const monthPrefix = dayPrefix.slice(0, 7);
    const exactDay = active.filter((p) => p.date.startsWith(dayPrefix));
    if (exactDay.length >= 6) return exactDay.slice(0, 12);
    const sameMonth = active.filter(
      (p) => !p.date.startsWith(dayPrefix) && p.date.startsWith(monthPrefix)
    );
    const combined = [...exactDay, ...sameMonth];
    if (combined.length >= 6) return combined.slice(0, 12);
    const fallback = active.filter((p) => !combined.some((c) => c.id === p.id));
    return [...combined, ...fallback].slice(0, 12);
  }, [selectedPhoto, photos]);

  const similarVisualPhotos = useMemo(() => {
    if (!selectedPhoto) return [];
    const active = photos.filter((p) => !p.quarantined && p.id !== selectedPhoto.id);
    const sameDayTopIds = new Set(sameDayPhotos.slice(0, 6).map((p) => p.id));
    const primaryTag = selectedPhoto.tags[0];

    const scored = active.map((p, idx) => {
      let score = 0;
      const sharedTags = p.tags.filter((t) => selectedPhoto.tags.includes(t)).length;
      score += sharedTags * 15;
      if (primaryTag && p.tags.includes(primaryTag)) score += 10;
      if (selectedPhoto.clusterId !== undefined && p.clusterId === selectedPhoto.clusterId) {
        score += 8;
      }
      // 1번 탭(이 날 찍은 사진) 상단 6장과 겹치지 않는 다른 날짜/장면의 유사 피사체를 우선 배치하여 탭 전환 시 즉각적인 시각 변화 제공
      if (!sameDayTopIds.has(p.id)) {
        score += 25;
      }
      score += (idx % 5);
      return { photo: p, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.photo).slice(0, 12);
  }, [selectedPhoto, photos, sameDayPhotos]);

  const drillDownPhotos = useMemo(() => {
    if (!selectedPhoto) return [];
    const active = photos.filter((p) => !p.quarantined && p.id !== selectedPhoto.id);
    if (!drillQuery.trim()) {
      // 2번 탭과 1번 탭의 교차 풀
      const base = [
        ...similarVisualPhotos.slice(3),
        ...sameDayPhotos.slice(3),
        ...similarVisualPhotos.slice(0, 3),
        ...sameDayPhotos.slice(0, 3),
        ...active,
      ];
      return Array.from(new Map(base.map((p) => [p.id, p])).values()).slice(0, 12);
    }

    const tokens = drillQuery
      .trim()
      .split(/[\s,#·]+/)
      .filter(Boolean);

    // 전체 활성 사진 풀에서 의미적으로 정확하게 일치하는 사진만 필터링
    const matched = active.filter((p) => {
      return tokens.every((tk) => matchPhotoQuery(p, tk));
    });

    return matched.slice(0, 12);
  }, [selectedPhoto, photos, sameDayPhotos, similarVisualPhotos, drillQuery]);

  if (!selectedPhoto) return null;

  const dayString = selectedPhoto.date.split(' ')[0];
  const activeBurstPhotos = (selectedBurstGroup ?? []).filter((p) => !p.quarantined);
  const hasBurstGroup = activeBurstPhotos.length >= 2;

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
                    ❐ {activeBurstPhotos.length}장 연사 묶음
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
                  함께 묶인 연사 {activeBurstPhotos.length}장 비교 — 마음에 드는 1장을 골라보세요
                </span>
              </div>

              <button
                onClick={() => {
                  void pickBestInBurstPhotos(activeBurstPhotos, selectedPhoto.id);
                  setSelectedPhoto(selectedPhoto, null);
                }}
                className="px-3.5 py-1.5 rounded-full bg-primary-container text-on-primary-container font-label-sm text-[12px] font-extrabold flex items-center gap-1 shadow-[0_0_14px_rgba(0,229,255,0.35)] hover:opacity-95 transition-all"
              >
                <span className="material-symbols-outlined text-[15px]">check_circle</span>
                <span>
                  현재 사진 1장만 남기고 나머지 {activeBurstPhotos.length - 1}장 OS 기본 [휴지통] 정리 (Pick)
                </span>
              </button>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
              {activeBurstPhotos.map((bp, idx) => {
                const isCurrent = bp.id === selectedPhoto.id;
                return (
                  <div
                    key={bp.id}
                    onClick={() => setSelectedPhoto(bp, activeBurstPhotos)}
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
              <div className="flex flex-wrap gap-1.5">
                {selectedPhoto.tags.map((t) => (
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
              {currentStripPhotos.slice(0, 6).map((item, idx) => (
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
                    {activeTab === 'similar-visual' && `🐶 유사 ${96 - idx * 3}%`}
                    {activeTab === 'drill-down' &&
                      (drillQuery.trim()
                        ? `🔎 '${drillQuery.trim()}'`
                        : item.tags[0] || '#연관')}
                  </div>
                  <div className="absolute inset-x-0 bottom-0 px-1.5 py-1 bg-black/75 font-label-mono text-[10px] text-white font-semibold truncate">
                    {item.name}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
