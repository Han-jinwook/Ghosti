import React, { useState } from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';
import { VoiceHeroStage } from './VoiceHeroStage';

const MOBILE_TUNNEL_URL = 'https://interpretation-configure-wanted-models.trycloudflare.com';

export const DesktopDashboard: React.FC = () => {
  const {
    setLayout,
    photos,
    activeQuery,
    searchResults,
    setSelectedPhoto,
    toggleBookmark,
  } = useSaySeeStore();

  const [showQr, setShowQr] = useState(false);
  const activePhotos = photos.filter((p) => !p.quarantined);

  return (
    <div className="min-h-screen flex flex-col bg-background text-on-surface">
      {/* 심플하고 깔끔한 상단 헤더 */}
      <header className="sticky top-0 h-16 bg-surface-container-low/90 backdrop-blur-xl z-40 px-6 md:px-10 flex items-center justify-between border-b border-outline-variant/20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary-container flex items-center justify-center shadow-[0_0_16px_rgba(0,229,255,0.35)]">
            <span className="material-symbols-outlined text-surface-container-lowest text-[22px] font-bold">
              graphic_eq
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-headline-sm text-[20px] text-on-surface tracking-tight font-extrabold">
              세이씨 (SaySee)
            </span>
            <span className="font-body-sm text-[13px] text-on-surface-variant">
              내 사진 {activePhotos.length}장 연결됨
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 relative">
          <button
            onClick={() => setShowQr((v) => !v)}
            className="px-4 py-2 rounded-full bg-primary-container text-on-primary-container font-label-md text-[13px] font-extrabold flex items-center gap-1.5 shadow-[0_0_16px_rgba(0,229,255,0.3)] hover:opacity-95 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">qr_code_2</span>
            <span>휴대폰 QR코드 연결</span>
          </button>

          <button
            onClick={() => setLayout('mobile')}
            className="px-4 py-2 rounded-full bg-surface-container-high hover:bg-surface-bright text-on-surface font-label-md text-[13px] font-bold flex items-center gap-1.5 border border-outline-variant/30 transition-all"
          >
            <span className="material-symbols-outlined text-primary-container text-[17px]">
              smartphone
            </span>
            <span>모바일 화면으로 보기</span>
          </button>

          {showQr && (
            <div className="absolute right-0 top-14 w-80 rounded-2xl bg-surface-container-highest border border-primary-container/50 p-5 shadow-2xl flex flex-col items-center gap-3 z-50">
              <div className="w-full flex items-center justify-between">
                <span className="font-headline-sm text-[15px] font-extrabold text-primary-container">
                  📱 휴대폰 카메라로 스캔하세요
                </span>
                <button
                  onClick={() => setShowQr(false)}
                  className="text-on-surface-variant hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
              <div className="p-3 bg-white rounded-xl">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                    MOBILE_TUNNEL_URL
                  )}`}
                  alt="모바일 접속 QR코드"
                  className="w-44 h-44"
                />
              </div>
              <p className="font-body-sm text-[12px] text-on-surface-variant text-center leading-relaxed">
                와이파이/LTE 상관없이 인증서 경고 없이 바로 열리고 마이크 음성 검색이 작동합니다.
              </p>
              <a
                href={MOBILE_TUNNEL_URL}
                target="_blank"
                rel="noreferrer"
                className="font-label-sm text-[11px] text-primary break-all underline text-center"
              >
                {MOBILE_TUNNEL_URL}
              </a>
            </div>
          )}
        </div>
      </header>

      {/* 메인 본문: 상단 검색창 + 즉시 펼쳐지는 사진 결과 그리드 */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-6 md:px-10 py-6 flex flex-col gap-6">
        {/* 1) 상단 검색창 영역 */}
        <VoiceHeroStage />

        {/* 2) 사진 검색 결과 그리드 (스크롤 없이 한눈에 바로 노출) */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2.5">
              <h2 className="font-headline-md text-[20px] text-on-surface font-extrabold">
                “{activeQuery}” 검색 결과
              </h2>
              <span className="px-3 py-0.5 rounded-full bg-primary-container/20 text-primary-container font-label-md text-[13px] font-bold">
                {searchResults.length}장
              </span>
            </div>
            <span className="font-body-sm text-[13px] text-on-surface-variant">
              사진을 클릭하면 크게 볼 수 있습니다
            </span>
          </div>

          {searchResults.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {searchResults.map((item) => (
                <article
                  key={item.photo.id}
                  onClick={() => setSelectedPhoto(item.photo)}
                  className="group relative rounded-2xl overflow-hidden bg-surface-container border border-outline-variant/25 hover:border-primary-container/70 shadow-md flex flex-col cursor-pointer transition-all hover:-translate-y-0.5"
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
                      className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-surface-container-lowest/70 backdrop-blur-md flex items-center justify-center text-on-surface hover:text-primary transition-colors"
                    >
                      <span className="material-symbols-outlined text-[17px]">
                        {item.photo.bookmarked ? 'bookmark_added' : 'favorite'}
                      </span>
                    </button>

                    {/* 하단 심플 정보 (촬영일 & 태그만 깔끔하게 표시) */}
                    <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-surface/90 via-surface/50 to-transparent flex items-center justify-between">
                      <span className="font-label-sm text-[12px] font-bold text-on-surface">
                        {item.photo.date.split(' ')[0]}
                      </span>
                      {item.photo.tags[0] && (
                        <span className="font-label-sm text-[11px] font-semibold text-primary-container truncate ml-2">
                          {item.photo.tags[0]}
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="py-16 rounded-2xl bg-surface-container/40 border border-outline-variant/25 text-center flex flex-col items-center gap-2">
              <span className="material-symbols-outlined text-outline text-[40px]">
                image_search
              </span>
              <p className="font-headline-sm text-[16px] text-on-surface font-bold">
                일치하는 사진을 찾지 못했습니다. 다른 검색어로 입력해 보세요.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
