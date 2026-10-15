import React from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';
import { VoiceHeroStage } from './VoiceHeroStage';

export const MobileAppView: React.FC = () => {
  const {
    setLayout,
    photos,
    activeQuery,
    searchResults,
    setSelectedPhoto,
    toggleBookmark,
  } = useSaySeeStore();

  const activePhotos = photos.filter((p) => !p.quarantined);

  return (
    <div className="bg-surface text-on-surface font-body-md flex flex-col min-h-screen max-w-xl mx-auto relative shadow-2xl border-x border-outline-variant/15">
      {/* 심플하고 깔끔한 상단 헤더 */}
      <header className="sticky top-0 inset-x-0 z-50 bg-surface/90 backdrop-blur-xl pt-safe border-b border-outline-variant/20">
        <div className="h-14 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-secondary-container to-primary-container flex items-center justify-center shadow-[0_0_12px_rgba(0,229,255,0.3)]">
              <span className="material-symbols-outlined text-surface text-[18px] font-bold">
                graphic_eq
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-headline-sm text-[17px] text-primary tracking-tight font-extrabold">
                세이씨
              </span>
              <span className="font-label-sm text-[12px] text-on-surface-variant">
                ({activePhotos.length}장)
              </span>
            </div>
          </div>

          <button
            onClick={() => setLayout('desktop')}
            className="px-3 py-1.5 rounded-full bg-surface-container-high hover:bg-surface-bright text-on-surface font-label-sm text-[12px] font-bold flex items-center gap-1 border border-outline-variant/30"
          >
            <span className="material-symbols-outlined text-primary-container text-[15px]">
              desktop_windows
            </span>
            <span>PC 화면</span>
          </button>
        </div>
      </header>

      {/* 메인 본문: 음성/텍스트 검색창 + 즉시 노출되는 사진 그리드 */}
      <main className="flex-1 w-full px-4 pt-4 pb-12 flex flex-col gap-5">
        {/* 1) 음성 마이크 & 텍스트 검색 영역 */}
        <VoiceHeroStage />

        {/* 2) 발견된 사진 그리드 */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-0.5">
            <div className="flex items-center gap-2">
              <span className="font-headline-sm text-[16px] text-on-surface font-extrabold">
                “{activeQuery}” 검색 결과
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-primary-container/20 text-primary-container font-label-sm text-[12px] font-bold">
                {searchResults.length}장
              </span>
            </div>
          </div>

          {searchResults.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 w-full">
              {searchResults.map((item) => (
                <article
                  key={item.photo.id}
                  onClick={() => setSelectedPhoto(item.photo)}
                  className="group relative rounded-2xl overflow-hidden bg-surface-container border border-outline-variant/20 shadow-md flex flex-col cursor-pointer transition-transform active:scale-[0.98]"
                >
                  <div className="relative aspect-[4/5] w-full overflow-hidden bg-surface-container-highest">
                    <img
                      src={item.photo.thumbUrl}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* 즐겨찾기 버튼 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleBookmark(item.photo.id);
                      }}
                      aria-label="즐겨찾기"
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-surface-container-lowest/65 backdrop-blur-md flex items-center justify-center text-on-surface hover:text-primary transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {item.photo.bookmarked ? 'bookmark_added' : 'favorite'}
                      </span>
                    </button>

                    {/* 하단 심플 정보 */}
                    <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-surface/90 via-surface/50 to-transparent flex items-center justify-between">
                      <span className="font-label-sm text-[11px] font-bold text-on-surface">
                        {item.photo.date.split(' ')[0]}
                      </span>
                      {item.photo.tags[0] && (
                        <span className="font-label-sm text-[11px] font-bold text-primary-fixed-dim truncate ml-1">
                          {item.photo.tags[0]}
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="py-12 px-4 rounded-2xl bg-surface-container/40 border border-outline-variant/25 text-center flex flex-col items-center gap-2">
              <span className="material-symbols-outlined text-outline text-[36px]">
                image_search
              </span>
              <p className="font-headline-sm text-[14px] text-on-surface font-bold">
                일치하는 사진을 찾지 못했습니다 (0장)
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
