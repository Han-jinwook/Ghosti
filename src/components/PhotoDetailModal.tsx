import React, { useMemo, useState } from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';

type ContextTab = 'same-day' | 'similar-visual' | 'drill-down';

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
    const dayPrefix = selectedPhoto.date.split(' ')[0];
    return photos
      .filter((p) => !p.quarantined && p.id !== selectedPhoto.id && p.date.startsWith(dayPrefix))
      .slice(0, 12);
  }, [selectedPhoto, photos]);

  const similarVisualPhotos = useMemo(() => {
    if (!selectedPhoto) return [];
    const primaryTag = selectedPhoto.tags[0];
    return photos
      .filter(
        (p) =>
          !p.quarantined &&
          p.id !== selectedPhoto.id &&
          (p.tags.some((t) => selectedPhoto.tags.includes(t)) || p.tags.includes(primaryTag))
      )
      .slice(0, 12);
  }, [selectedPhoto, photos]);

  const drillDownPhotos = useMemo(() => {
    if (!selectedPhoto) return [];
    const base = [...sameDayPhotos, ...similarVisualPhotos];
    const unique = Array.from(new Map(base.map((p) => [p.id, p])).values());
    if (!drillQuery.trim()) return unique.slice(0, 12);
    const q = drillQuery.trim().toLowerCase();
    return unique.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q)) ||
        p.date.includes(q)
    );
  }, [selectedPhoto, sameDayPhotos, similarVisualPhotos, drillQuery]);

  if (!selectedPhoto) return null;

  const dayString = selectedPhoto.date.split(' ')[0];
  const activeBurstPhotos = (selectedBurstGroup ?? []).filter((p) => !p.quarantined);
  const hasBurstGroup = activeBurstPhotos.length >= 2;

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
                  <span className="px-2.5 py-0.5 rounded-full bg-primary-container/20 border border-primary-container/50 text-primary-container font-label-sm text-[11px] font-extrabold shrink-0">
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
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 font-label-sm text-[11px] font-extrabold">
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
                  현재 사진 1장만 남기고 나머지 {activeBurstPhotos.length - 1}장 정리대기함 격리 (Pick)
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
              <span className="font-label-mono text-[11px] text-primary-container uppercase tracking-wider font-bold">
                CONTEXTUAL SNIPING DRILL-DOWN (3.2절)
              </span>
              <div className="flex flex-wrap gap-1.5">
                {selectedPhoto.tags.map((t) => (
                  <span
                    key={t}
                    className="px-2.5 py-1 rounded-full bg-primary-container/15 text-primary font-label-mono text-[11px] border border-primary-container/30"
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
                className={`p-3 rounded-xl text-left flex items-center justify-between border transition-all ${
                  activeTab === 'same-day'
                    ? 'bg-primary-container/20 border-primary-container text-on-surface font-bold'
                    : 'bg-surface-container/70 border-outline-variant/25 text-on-surface-variant'
                }`}
              >
                <span className="font-label-md text-label-md">
                  📅 이 날 찍은 사진 전체 ({dayString})
                </span>
                <span className="font-label-mono text-primary-container">
                  {sameDayPhotos.length}장
                </span>
              </button>

              <button
                onClick={() => setActiveTab('similar-visual')}
                className={`p-3 rounded-xl text-left flex items-center justify-between border transition-all ${
                  activeTab === 'similar-visual'
                    ? 'bg-secondary-container/35 border-secondary text-on-surface font-bold'
                    : 'bg-surface-container/70 border-outline-variant/25 text-on-surface-variant'
                }`}
              >
                <span className="font-label-md text-label-md">
                  🐶 비슷한 피사체 사진 (벡터 유사도 매칭)
                </span>
                <span className="font-label-mono text-secondary">
                  {similarVisualPhotos.length}장
                </span>
              </button>

              <button
                onClick={() => setActiveTab('drill-down')}
                className={`p-3 rounded-xl text-left flex items-center justify-between border transition-all ${
                  activeTab === 'drill-down'
                    ? 'bg-primary-container/20 border-primary-container text-on-surface font-bold'
                    : 'bg-surface-container/70 border-outline-variant/25 text-on-surface-variant'
                }`}
              >
                <span className="font-label-md text-label-md">
                  ➕ 2차 자연어 좁혀가기 (결과 내 재검색)
                </span>
                <span className="material-symbols-outlined text-primary text-[16px]">
                  filter_alt
                </span>
              </button>
            </div>

            {activeTab === 'drill-down' && (
              <input
                type="text"
                value={drillQuery}
                onChange={(e) => setDrillQuery(e.target.value)}
                placeholder="연관 사진 내 2차 필터 (예: 오후, 해변, 웃는)"
                className="w-full h-10 px-3 rounded-xl bg-surface-container-lowest border border-primary-container/40 text-body-sm text-on-surface outline-none"
              />
            )}
          </div>
        </div>

        {/* Contextual Photo Strip */}
        <div className="flex flex-col gap-2 pt-2 border-t border-outline-variant/25">
          <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold">
            {activeTab === 'same-day' && `📅 ${dayString}에 함께 촬영된 기억`}
            {activeTab === 'similar-visual' &&
              `🐶 EmbeddingGemma 2 시각 벡터 공간에서 가장 가까운 피사체`}
            {activeTab === 'drill-down' && `➕ 2차 좁혀가기 결과 (${drillDownPhotos.length}장)`}
          </span>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
            {(activeTab === 'same-day'
              ? sameDayPhotos
              : activeTab === 'similar-visual'
              ? similarVisualPhotos
              : drillDownPhotos
            )
              .slice(0, 6)
              .map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedPhoto(item)}
                  className="group cursor-pointer rounded-xl overflow-hidden bg-surface-container aspect-square relative border border-outline-variant/30 hover:border-primary-container"
                >
                  <img
                    src={item.thumbUrl}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-1 bg-surface/80 font-label-mono text-[9px] text-on-surface truncate">
                    {item.name}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};
