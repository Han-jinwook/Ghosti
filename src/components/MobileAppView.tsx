import React, { useMemo, useState } from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';
import { groupBurstSearchResults } from '../services/aiEngine';
import { VoiceHeroStage } from './VoiceHeroStage';
import { SmartTrashView } from './SmartTrashView';

export const MobileAppView: React.FC = () => {
  const {
    mobileTab,
    setMobileTab,
    setLayout,
    photos,
    activeQuery,
    searchResults,
    groupBurstsInSearch,
    setGroupBurstsInSearch,
    setSelectedPhoto,
    toggleBookmark,
    openLocalFolder,
  } = useSaySeeStore();

  const [autoBackupWifi, setAutoBackupWifi] = useState(true);
  const [autoBackupCharging, setAutoBackupCharging] = useState(true);

  const activePhotos = useMemo(() => photos.filter((p) => !p.quarantined), [photos]);
  const quarantinedPhotos = useMemo(() => photos.filter((p) => p.quarantined), [photos]);
  const activeTrashCount = useMemo(
    () => activePhotos.filter((p) => Boolean(p.trashCategory)).length,
    [activePhotos]
  );

  // 지침 #3: 검색 결과에서 dHash/연속촬영 기준 동일 연사 그룹을 1장으로 겹쳐서 [❐ N장 연사] 배지로 묶기
  const groupedResults = useMemo(() => {
    if (!groupBurstsInSearch) {
      return searchResults.map((item) => ({
        representative: item,
        burstPhotos: [item.photo],
        burstCount: 1,
      }));
    }
    return groupBurstSearchResults(searchResults);
  }, [searchResults, groupBurstsInSearch]);

  return (
    <div className="bg-surface text-on-surface font-body-md flex flex-col min-h-screen max-w-xl mx-auto relative shadow-2xl border-x border-outline-variant/15 pb-20">
      {/* 심플하고 깔끔한 상단 헤더 */}
      <header className="sticky top-0 inset-x-0 z-50 bg-surface/90 backdrop-blur-xl pt-safe border-b border-outline-variant/20">
        <div className="h-14 px-4 flex items-center justify-between">
          <div
            onClick={() => setMobileTab('search')}
            className="flex items-center gap-2.5 cursor-pointer"
          >
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

      {/* 탭 1: 🔍 AI 검색 */}
      {mobileTab === 'search' && (
        <main className="flex-1 w-full px-4 pt-4 pb-8 flex flex-col gap-5">
          {/* 1) 음성 마이크 & 자연어 문장 검색창 + 리얼 문장 샘플 칩 */}
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

              <button
                onClick={() => setGroupBurstsInSearch(!groupBurstsInSearch)}
                className={`px-2.5 py-1 rounded-full font-label-sm text-[11px] font-bold border ${
                  groupBurstsInSearch
                    ? 'bg-primary-container/15 border-primary-container/50 text-primary-container'
                    : 'bg-surface-container-high border-outline-variant/30 text-on-surface-variant'
                }`}
              >
                {groupBurstsInSearch ? '❐ 연사 묶기 ON' : '연사 펼치기'}
              </button>
            </div>

            {groupedResults.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 w-full">
                {groupedResults.map((group) => {
                  const item = group.representative;
                  const isBurst = group.burstCount >= 2;
                  return (
                    <article
                      key={item.photo.id}
                      onClick={() =>
                        setSelectedPhoto(item.photo, isBurst ? group.burstPhotos : null)
                      }
                      className={`group relative rounded-2xl overflow-hidden bg-surface-container border shadow-md flex flex-col cursor-pointer transition-transform active:scale-[0.98] ${
                        isBurst
                          ? 'border-primary-container/65'
                          : 'border-outline-variant/20'
                      }`}
                    >
                      <div className="relative aspect-[4/5] w-full overflow-hidden bg-surface-container-highest">
                        <img
                          src={item.photo.thumbUrl}
                          alt={item.photo.name}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />

                        {/* 지침 #3: 동일 연사 그룹 [❐ N장 연사] 배지 */}
                        {isBurst && (
                          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md border border-primary-container/70 text-primary-container font-label-sm text-[10px] font-extrabold">
                            ❐ {group.burstCount}장 연사
                          </div>
                        )}

                        {/* 즐겨찾기 버튼 */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleBookmark(item.photo.id);
                          }}
                          aria-label="즐겨찾기"
                          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/65 backdrop-blur-md flex items-center justify-center text-white hover:text-primary transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            {item.photo.bookmarked ? 'bookmark_added' : 'favorite'}
                          </span>
                        </button>

                        {/* 지침 #3: 썸네일 하단 15%~20% 은은한 블랙 그라데이션 */}
                        <div className="absolute inset-x-0 bottom-0 h-[20%] min-h-[40px] px-2.5 pb-2 pt-3 bg-gradient-to-t from-black/90 via-black/55 to-transparent flex items-end justify-between pointer-events-none">
                          <span className="font-label-sm text-[11px] font-bold text-white drop-shadow">
                            {item.photo.date.split(' ')[0]}
                          </span>
                          {item.photo.tags[0] && (
                            <span className="font-label-sm text-[11px] font-extrabold text-[#70F5FF] truncate ml-1 drop-shadow">
                              {item.photo.tags[0]}
                            </span>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
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
      )}

      {/* 탭 2: 🧹 스마트 정리 */}
      {mobileTab === 'trash' && (
        <div className="flex-1 w-full">
          <SmartTrashView />
        </div>
      )}

      {/* 탭 3: ⚙️ 내 기기 & 백업 */}
      {mobileTab === 'settings' && (
        <main className="flex-1 w-full px-4 pt-5 pb-10 flex flex-col gap-4">
          <div className="p-5 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-3">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 font-label-sm text-[11px] font-extrabold w-fit">
              ● 100% 로컬 온디바이스 엔진 연결됨
            </span>
            <h2 className="font-headline-sm text-[18px] text-on-surface font-extrabold">
              ⚙️ 내 기기 &amp; P2P 자동 백업
            </h2>
            <p className="font-body-sm text-[12px] text-on-surface-variant leading-relaxed">
              외부 클라우드 서버나 유료 API 없이 내 PC(`D:\SaySee\test_photos`)와 스마트폰을 Wi-Fi Direct로 직접 연결합니다.
            </p>
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="p-2.5 rounded-xl bg-surface-container/80 text-center">
                <div className="font-label-sm text-[11px] text-on-surface-variant">전체</div>
                <div className="font-headline-sm text-[16px] font-extrabold text-on-surface">
                  {photos.length}장
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-container/80 text-center">
                <div className="font-label-sm text-[11px] text-on-surface-variant">활성</div>
                <div className="font-headline-sm text-[16px] font-extrabold text-primary-container">
                  {activePhotos.length}장
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-container/80 text-center">
                <div className="font-label-sm text-[11px] text-on-surface-variant">정리대기함</div>
                <div className="font-headline-sm text-[16px] font-extrabold text-error">
                  {quarantinedPhotos.length}장
                </div>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => void openLocalFolder('photos')}
                className="flex-1 py-2.5 rounded-xl bg-primary-container text-on-primary-container font-label-sm text-[12px] font-extrabold"
              >
                원본 폴더 열기
              </button>
              <button
                onClick={() => void openLocalFolder('quarantine')}
                className="flex-1 py-2.5 rounded-xl bg-surface-container-high text-on-surface font-label-sm text-[12px] font-bold border border-outline-variant/30"
              >
                정리대기함 열기
              </button>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-3">
            <h3 className="font-headline-sm text-[15px] text-on-surface font-extrabold">
              📲 모바일 → PC 자동 백업 옵션
            </h3>
            <label className="flex items-center justify-between gap-3 py-2 border-b border-outline-variant/20">
              <span className="font-label-sm text-[13px] text-on-surface font-semibold">
                집 Wi-Fi 연결 시 새 사진 자동 백업
              </span>
              <input
                type="checkbox"
                checked={autoBackupWifi}
                onChange={(e) => setAutoBackupWifi(e.target.checked)}
                className="w-5 h-5 accent-[#00E5FF]"
              />
            </label>
            <label className="flex items-center justify-between gap-3 py-2">
              <span className="font-label-sm text-[13px] text-on-surface font-semibold">
                충전 중에만 768차원 벡터 색인 실행
              </span>
              <input
                type="checkbox"
                checked={autoBackupCharging}
                onChange={(e) => setAutoBackupCharging(e.target.checked)}
                className="w-5 h-5 accent-[#00E5FF]"
              />
            </label>
          </div>
        </main>
      )}

      {/* ─────────────── 모바일 하단 미니멀 3대 탭 바 (지침 #3) ─────────────── */}
      <nav className="fixed bottom-0 inset-x-0 max-w-xl mx-auto h-16 bg-surface-container-low/95 backdrop-blur-xl border-t border-outline-variant/25 z-50 px-3 flex items-center justify-around">
        <button
          onClick={() => setMobileTab('search')}
          className={`flex-1 py-2 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all ${
            mobileTab === 'search'
              ? 'text-primary-container font-extrabold'
              : 'text-on-surface-variant'
          }`}
        >
          <span className="text-[13px]">🔍 AI 검색</span>
        </button>

        <button
          onClick={() => setMobileTab('trash')}
          className={`flex-1 py-2 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all ${
            mobileTab === 'trash'
              ? 'text-primary-container font-extrabold'
              : 'text-on-surface-variant'
          }`}
        >
          <div className="flex items-center gap-1">
            <span className="text-[13px]">🧹 스마트 정리</span>
            <span className="px-1.5 py-0.2 rounded-full bg-error-container text-on-error-container text-[10px] font-black">
              {activeTrashCount}
            </span>
          </div>
        </button>

        <button
          onClick={() => setMobileTab('settings')}
          className={`flex-1 py-2 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all ${
            mobileTab === 'settings'
              ? 'text-primary-container font-extrabold'
              : 'text-on-surface-variant'
          }`}
        >
          <span className="text-[13px]">⚙️ 내 기기 &amp; 백업</span>
        </button>
      </nav>
    </div>
  );
};
