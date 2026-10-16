import React, { useMemo } from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';
import { groupBurstSearchResults } from '../services/aiEngine';
import { VoiceHeroStage } from './VoiceHeroStage';
import { SmartTrashView } from './SmartTrashView';
import { FoundingMemberFomoBar } from './PricingModal';

export const MobileAppView: React.FC = () => {
  const {
    mobileTab,
    setMobileTab,
    setLayout,
    photos,
    searchSpace,
    matchedLocalDocs,
    setSelectedDocModal,
    activeQuery,
    searchResults,
    groupBurstsInSearch,
    setGroupBurstsInSearch,
    setSelectedPhoto,
    toggleBookmark,
    openLocalFolder,
    setShowProModal,
    syncState,
    setPrivateSyncStrategy,
    triggerSyncNow,
  } = useSaySeeStore();

  const activePhotos = useMemo(() => photos.filter((p) => !p.quarantined), [photos]);
  const activeTrashCount = useMemo(
    () => activePhotos.filter((p) => Boolean(p.trashCategory)).length,
    [activePhotos]
  );

  // 지침 #3: 검색 결과에서 dHash/연속촬영 기준 동일 연사 그룹을 1장으로 겹쳐서 [❐ N장 연사] 배지로 묶기
  const groupedResults = useMemo(() => {
    if (!groupBurstsInSearch || searchSpace === 'vault') {
      return searchResults.map((item) => ({
        representative: item,
        burstPhotos: [item.photo],
        burstCount: 1,
      }));
    }
    return groupBurstSearchResults(searchResults);
  }, [searchResults, groupBurstsInSearch, searchSpace]);

  return (
    <div className="bg-surface text-on-surface font-body-md flex flex-col min-h-screen max-w-xl mx-auto relative shadow-2xl border-x border-outline-variant/15 pb-20">
      {/* [스펙 4] 최상단 창립 멤버 선착순 기간 뻥튀기 배너 */}
      <FoundingMemberFomoBar />

      {/* 심플하고 깔끔한 상단 헤더 */}
      <header className="sticky top-0 inset-x-0 z-50 bg-surface/95 backdrop-blur-xl pt-safe border-b border-outline-variant/20">
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

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowProModal(true)}
              className="px-2.5 py-1.5 rounded-full bg-[#FFAB00] text-surface-container-lowest font-label-sm text-[11px] font-black"
            >
              👑 990원 패스
            </button>
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
        </div>
      </header>

      {/* 탭 1: 🔍 파워 검색 ([🖼️ 전체/갤러리] vs [📁 스마트 서류함]) */}
      {mobileTab === 'search' && (
        <main className="flex-1 w-full px-4 pt-4 pb-8 flex flex-col gap-5">
          {/* 1) 공간 스위처 & 음성 마이크 & 자연어 문장 검색창 */}
          <VoiceHeroStage />

          {/* 2-A) [📁 스마트 서류함] 통합 검색 뷰 */}
          {searchSpace === 'vault' ? (
            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between px-0.5">
                <span className="font-headline-sm text-[15px] text-on-surface font-extrabold">
                  📁 서류함 통합 결과 (PDF {matchedLocalDocs.length}건 + 사진 {searchResults.length}장)
                </span>
              </div>

              {matchedLocalDocs.length > 0 && (
                <div className="flex flex-col gap-2.5">
                  {matchedLocalDocs.map((doc) => (
                    <article
                      key={doc.id}
                      onClick={() => setSelectedDocModal(doc)}
                      className="p-4 rounded-2xl bg-surface-container-low border border-[#FFAB00]/40 flex flex-col gap-1.5 cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded bg-[#FFAB00] text-surface-container-lowest font-label-mono text-[10px] font-black">
                          {doc.ext} • {doc.categoryBadge}
                        </span>
                        <span className="font-label-mono text-[10px] text-on-surface-variant">
                          {doc.date}
                        </span>
                      </div>
                      <h4 className="font-headline-sm text-[14px] text-on-surface font-extrabold">
                        {doc.title}
                      </h4>
                      <p className="font-body-sm text-[12px] text-on-surface-variant line-clamp-2">
                        {doc.extractedText}
                      </p>
                    </article>
                  ))}
                </div>
              )}

              {searchResults.length > 0 && (
                <div className="grid grid-cols-2 gap-3 w-full">
                  {searchResults.map((item) => (
                    <article
                      key={item.photo.id}
                      onClick={() => setSelectedPhoto(item.photo, null)}
                      className="group relative rounded-2xl overflow-hidden bg-surface-container border border-primary-container/50 shadow-md flex flex-col cursor-pointer"
                    >
                      <div className="relative aspect-[4/5] w-full overflow-hidden bg-surface-container-highest">
                        <img
                          src={item.photo.thumbUrl}
                          alt={item.photo.name}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/85 border border-[#FFAB00]/70 text-[#FFAB00] font-label-sm text-[10px] font-extrabold">
                          {item.photo.vaultCategoryLabel || item.photo.tags[0]}
                        </div>
                        <div className="absolute inset-x-0 bottom-0 h-[20%] min-h-[40px] px-2.5 pb-2 pt-3 bg-gradient-to-t from-black/90 via-black/55 to-transparent flex items-end justify-between">
                          <span className="font-label-sm text-[11px] font-bold text-white">
                            {item.photo.date.split(' ')[0]}
                          </span>
                          <span className="font-label-sm text-[11px] font-extrabold text-[#70F5FF] truncate ml-1">
                            {item.photo.tags[0]}
                          </span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          ) : (
            /* 2-B) [🖼️ 전체/갤러리] 발견된 사진 그리드 */
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

                          {isBurst && (
                            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md border border-primary-container/70 text-primary-container font-label-sm text-[10px] font-extrabold">
                              ❐ {group.burstCount}장 연사
                            </div>
                          )}

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
          )}
        </main>
      )}

      {/* 탭 2: 🧹 주치의 정리 */}
      {mobileTab === 'trash' && (
        <div className="flex-1 w-full">
          <SmartTrashView />
        </div>
      )}

      {/* [스펙 3] 탭 3: ⚙️ 내 기기 & 백업 (프라이빗 싱크 2대 모드 선택 UI) */}
      {mobileTab === 'settings' && (
        <main className="flex-1 w-full px-4 pt-5 pb-10 flex flex-col gap-4">
          <div className="p-4 rounded-2xl bg-black/50 border border-primary-container/40 flex flex-col gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-primary-container text-on-primary-container font-label-sm text-[11px] font-black w-fit">
              🔋 배터리 · OS 제재 방어 원칙
            </span>
            <p className="font-body-sm text-[12px] text-white/90 leading-relaxed">
              “세이씨 모바일 에이전트(1MB APK)는 배터리를 소모하는 상시 통신을 하지 않으며,{' '}
              <strong className="text-primary-container">[집 Wi-Fi 연결 + 충전 중]</strong>이거나{' '}
              <strong className="text-[#FFD740]">[지금 일치시키기]</strong> 버튼을 누를 때만 작동합니다.”
            </p>
          </div>

          {/* 모드 A vs 모드 B 라디오 카드 */}
          <div
            onClick={() => setPrivateSyncStrategy('mirror')}
            className={`p-4 rounded-2xl border-2 cursor-pointer flex flex-col gap-2 ${
              syncState.privateSyncStrategy === 'mirror'
                ? 'bg-surface-container-high border-emerald-400'
                : 'bg-surface-container-low border-outline-variant/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-headline-sm text-[15px] text-white font-extrabold">
                🔄 모드 A. 100% 원본 미러링 모드
              </span>
              <input
                type="radio"
                checked={syncState.privateSyncStrategy === 'mirror'}
                onChange={() => setPrivateSyncStrategy('mirror')}
                className="w-4 h-4 accent-emerald-400"
              />
            </div>
            <p className="font-body-sm text-[12px] text-on-surface-variant">
              여유 공간 넉넉할 때: 폰과 PC 양쪽 기기에 똑같은 원본 파일을 유지하여 완벽한 상호 백업 보험 구축.
            </p>
          </div>

          <div
            onClick={() => setPrivateSyncStrategy('shadow')}
            className={`p-4 rounded-2xl border-2 cursor-pointer flex flex-col gap-2 ${
              syncState.privateSyncStrategy === 'shadow'
                ? 'bg-surface-container-high border-primary-container shadow-[0_0_20px_rgba(0,229,255,0.2)]'
                : 'bg-surface-container-low border-outline-variant/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-headline-sm text-[15px] text-primary-container font-extrabold">
                👻 모드 B. 초경량 섀도우 캐시 모드 (추천)
              </span>
              <input
                type="radio"
                checked={syncState.privateSyncStrategy === 'shadow'}
                onChange={() => setPrivateSyncStrategy('shadow')}
                className="w-4 h-4 accent-[#00E5FF]"
              />
            </div>
            <p className="font-body-sm text-[12px] text-on-surface-variant">
              무거운 원본은 집 PC로 이관하고 폰에는 장당 13KB WebP 썸네일+768d 벡터만 남김 (단 {syncState.packSizeMB}MB). 집 PC 전원이 꺼져도 밖에서 0.04초 만에 100% 검색·열람 가능!
            </p>
          </div>

          <button
            type="button"
            disabled={syncState.syncing}
            onClick={() => void triggerSyncNow()}
            className="w-full py-3 rounded-2xl bg-primary-container text-on-primary-container font-label-lg text-[14px] font-black shadow-[0_0_20px_rgba(0,229,255,0.35)]"
          >
            {syncState.syncing ? '일치화 실행 중...' : '⚡ 지금 일치시키기 (폰↔PC 프라이빗 싱크)'}
          </button>

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => void openLocalFolder('photos')}
              className="flex-1 py-2.5 rounded-xl bg-surface-container-high text-on-surface font-label-sm text-[12px] font-bold border border-outline-variant/30"
            >
              사진 폴더 열기
            </button>
            <button
              onClick={() => void openLocalFolder('docs')}
              className="flex-1 py-2.5 rounded-xl bg-surface-container-high text-[#FFAB00] font-label-sm text-[12px] font-bold border border-[#FFAB00]/30"
            >
              서류함 폴더 열기
            </button>
            <button
              onClick={() => void openLocalFolder('quarantine')}
              className="flex-1 py-2.5 rounded-xl bg-surface-container-high text-emerald-300 font-label-sm text-[12px] font-bold border border-emerald-400/30"
            >
              대기함 열기
            </button>
          </div>
        </main>
      )}

      {/* ─────────────── 모바일 하단 미니멀 3대 탭 바 ─────────────── */}
      <nav className="fixed bottom-0 inset-x-0 max-w-xl mx-auto h-16 bg-surface-container-low/95 backdrop-blur-xl border-t border-outline-variant/25 z-50 px-3 flex items-center justify-around">
        <button
          onClick={() => setMobileTab('search')}
          className={`flex-1 py-2 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all ${
            mobileTab === 'search'
              ? 'text-primary-container font-extrabold'
              : 'text-on-surface-variant'
          }`}
        >
          <span className="text-[13px]">🔍 파워 검색</span>
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
            <span className="text-[13px]">🧹 주치의 정리</span>
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
