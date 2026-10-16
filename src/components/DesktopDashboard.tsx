import React, { useMemo, useState } from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';
import { groupBurstSearchResults } from '../services/aiEngine';
import { VoiceHeroStage } from './VoiceHeroStage';
import { SmartTrashView } from './SmartTrashView';
import { FoundingMemberFomoBar } from './PricingModal';

const MOBILE_TUNNEL_URL = 'https://interpretation-configure-wanted-models.trycloudflare.com';

export const DesktopDashboard: React.FC = () => {
  const {
    desktopTab,
    setDesktopTab,
    setLayout,
    photos,
    searchSpace,
    matchedLocalDocs,
    setSelectedDocModal,
    matchedVideoScenes,
    setSelectedVideoModal,
    activeQuery,
    searchResults,
    groupBurstsInSearch,
    setGroupBurstsInSearch,
    setSelectedPhoto,
    toggleBookmark,
    openLocalFolder,
    setShowOnboarding,
    setShowProModal,
    syncState,
    setPrivateSyncStrategy,
    updateSyncSettings,
    setChargingOnlySync,
    triggerSyncNow,
  } = useSaySeeStore();

  const [showQr, setShowQr] = useState(false);

  const activePhotos = useMemo(() => photos.filter((p) => !p.quarantined), [photos]);
  const quarantinedPhotos = useMemo(() => photos.filter((p) => p.quarantined), [photos]);
  const activeTrashCount = useMemo(
    () => activePhotos.filter((p) => Boolean(p.trashCategory)).length,
    [activePhotos]
  );

  // 지침 #3: 검색 결과에서 동일 연사(dHash/연속촬영) 그룹을 1장으로 겹쳐서 [❐ N장 연사] 배지로 묶기
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

  const collapsedBurstCount = searchResults.length - groupedResults.length;

  return (
    <div className="min-h-screen flex flex-col bg-background text-on-surface">
      {/* ─────────────── [스펙 4] 최상단 창립 멤버 선착순 기간 뻥튀기 배너 (FOMO 유발) ─────────────── */}
      <FoundingMemberFomoBar />

      {/* ─────────────── 상단 헤더: 로고 + 미니멀 3대 탭 + 우측 모바일/QR/요금제 ─────────────── */}
      <header className="sticky top-0 h-16 bg-surface-container-low/95 backdrop-blur-xl z-40 px-6 md:px-10 flex items-center justify-between border-b border-outline-variant/20 gap-4">
        {/* 좌측 브랜드 로고 */}
        <div
          onClick={() => setDesktopTab('dashboard')}
          className="flex items-center gap-3 cursor-pointer shrink-0"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary-container flex items-center justify-center shadow-[0_0_16px_rgba(0,229,255,0.35)]">
            <span className="material-symbols-outlined text-surface-container-lowest text-[22px] font-bold">
              graphic_eq
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-headline-sm text-[20px] text-on-surface tracking-tight font-extrabold">
              세이씨 (SaySee)
            </span>
            <span className="hidden xl:inline font-body-sm text-[12px] text-on-surface-variant">
              디지털 주치의 · 무저장 휘발성 AI 파이프라인
            </span>
          </div>
        </div>

        {/* 중앙 미니멀 3대 네비게이션 탭 */}
        <nav className="flex items-center gap-1.5 p-1 rounded-full bg-surface-container-lowest/90 border border-outline-variant/30 shadow-inner">
          <button
            onClick={() => setDesktopTab('dashboard')}
            className={`px-4 py-1.5 rounded-full font-label-md text-[13px] font-extrabold flex items-center gap-1.5 transition-all ${
              desktopTab === 'dashboard'
                ? 'bg-primary-container text-on-primary-container shadow-[0_0_14px_rgba(0,229,255,0.35)]'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/60'
            }`}
          >
            <span>🔍 파워 검색</span>
          </button>

          <button
            onClick={() => setDesktopTab('trash')}
            className={`px-4 py-1.5 rounded-full font-label-md text-[13px] font-extrabold flex items-center gap-1.5 transition-all ${
              desktopTab === 'trash'
                ? 'bg-primary-container text-on-primary-container shadow-[0_0_14px_rgba(0,229,255,0.35)]'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/60'
            }`}
          >
            <span>🧹 주치의 정리</span>
            <span
              className={`px-2 py-0.2 rounded-full text-[11px] font-black ${
                desktopTab === 'trash'
                  ? 'bg-surface-container-lowest/25 text-on-primary-container'
                  : 'bg-error-container/80 text-on-error-container'
              }`}
            >
              {activeTrashCount}
            </span>
          </button>

          <button
            onClick={() => setDesktopTab('sync')}
            className={`px-4 py-1.5 rounded-full font-label-md text-[13px] font-extrabold flex items-center gap-1.5 transition-all ${
              desktopTab === 'sync'
                ? 'bg-primary-container text-on-primary-container shadow-[0_0_14px_rgba(0,229,255,0.35)]'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/60'
            }`}
          >
            <span>⚙️ 내 기기 &amp; 백업</span>
          </button>
        </nav>

        {/* 우측 유틸리티 버튼 */}
        <div className="flex items-center gap-2 relative shrink-0">
          <button
            onClick={() => setShowProModal(true)}
            className="px-3.5 py-2 rounded-full bg-gradient-to-r from-[#FFAB00] to-[#FFD740] text-surface-container-lowest font-label-md text-[12px] font-black flex items-center gap-1 shadow-[0_0_16px_rgba(255,171,0,0.35)] hover:brightness-105 transition-all"
          >
            <span>👑 3단 심플 요금제 / 10년 특전</span>
          </button>

          <button
            onClick={() => setShowQr((v) => !v)}
            className="px-3.5 py-2 rounded-full bg-surface-container-high hover:bg-surface-bright text-primary-container font-label-md text-[12px] font-extrabold flex items-center gap-1.5 border border-primary-container/35 transition-all"
          >
            <span className="material-symbols-outlined text-[17px]">qr_code_2</span>
            <span className="hidden sm:inline">휴대폰 QR 연결</span>
          </button>

          <button
            onClick={() => setLayout('mobile')}
            className="px-3.5 py-2 rounded-full bg-surface-container-high hover:bg-surface-bright text-on-surface font-label-md text-[12px] font-bold flex items-center gap-1.5 border border-outline-variant/30 transition-all"
          >
            <span className="material-symbols-outlined text-primary-container text-[16px]">
              smartphone
            </span>
            <span className="hidden md:inline">모바일 뷰</span>
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

      {/* ─────────────── 탭 1: 🔍 파워 검색 ([🎬 동영상 장면] vs [📁 스마트 서류함] vs [🖼️ 전체/갤러리]) ─────────────── */}
      {desktopTab === 'dashboard' && (
        <main className="flex-1 w-full max-w-[1440px] mx-auto px-6 md:px-10 py-6 flex flex-col gap-6">
          {/* 1) 상단 보안 배지 + 체험 완료 브리핑 보드 + 공간 스위처 + 자연어 문장 검색창 */}
          <VoiceHeroStage />

          {/* 2-0) [🎬 동영상 장면 검색] 모드일 때: 핵심 프레임 색인 동영상 카드 + 연관 프레임 스틸컷 */}
          {searchSpace === 'video' ? (
            <section className="flex flex-col gap-6">
              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="px-3 py-1 rounded-full bg-primary-container text-on-primary-container font-label-sm text-[12px] font-black">
                    🎬 동영상 속 특정 장면 AI 포착
                  </span>
                  <h2 className="font-headline-md text-[20px] text-on-surface font-extrabold">
                    “{activeQuery}” 동영상 장면 검색 결과
                  </h2>
                  <span className="px-3 py-0.5 rounded-full bg-primary-container/20 text-primary-container font-label-md text-[13px] font-bold">
                    동영상 {matchedVideoScenes.length}개 포착 (클릭 시 해당 장면 및 원본 MP4 재생)
                  </span>
                </div>

                <button
                  onClick={() => void openLocalFolder('photos')}
                  className="px-3.5 py-1.5 rounded-full bg-surface-container-high hover:bg-surface-bright text-primary-container font-label-sm text-[12px] font-extrabold border border-primary-container/40 flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">folder_open</span>
                  <span>원본 동영상 폴더(test_photos) 열기</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {matchedVideoScenes.map((vid) => (
                  <article
                    key={vid.id}
                    onClick={() => setSelectedVideoModal(vid)}
                    className="group rounded-2xl overflow-hidden bg-surface-container-low hover:bg-surface-container border-2 border-primary-container/45 hover:border-primary-container shadow-[0_6px_28px_rgba(0,229,255,0.16)] flex flex-col cursor-pointer transition-all hover:-translate-y-0.5"
                  >
                    <div className="relative aspect-video w-full overflow-hidden bg-black">
                      <img
                        src={vid.thumbUrl}
                        alt={vid.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      {/* 중앙 재생 아이콘 오버레이 */}
                      <div className="absolute inset-0 bg-black/25 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                        <div className="w-13 h-13 rounded-full bg-primary-container/90 text-on-primary-container flex items-center justify-center shadow-[0_0_24px_rgba(0,229,255,0.65)] group-hover:scale-110 transition-transform">
                          <span className="material-symbols-outlined text-[30px]">play_arrow</span>
                        </div>
                      </div>

                      <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-black/85 backdrop-blur-md border border-primary-container/70 text-primary-container font-label-mono text-[11px] font-extrabold">
                        🎯 {vid.matchedTimestamp}
                      </div>

                      <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/80 text-white font-label-mono text-[11px] font-bold">
                        ⏱️ {vid.durationText} • {vid.resolution}
                      </div>

                      <div className="absolute inset-x-0 bottom-0 px-3 py-2 bg-gradient-to-t from-black/95 via-black/65 to-transparent flex items-center justify-between">
                        <span className="font-label-mono text-[11px] text-emerald-300 font-bold">
                          📍 {vid.locationKo}
                        </span>
                        <span className="font-label-mono text-[11px] text-white/85">
                          {vid.videoFileName} ({vid.sizeMB}MB)
                        </span>
                      </div>
                    </div>

                    <div className="p-4 flex flex-col gap-2 flex-1 justify-between">
                      <div className="flex flex-col gap-1">
                        <h3 className="font-headline-sm text-[15.5px] text-white font-extrabold group-hover:text-primary-container transition-colors">
                          🎬 {vid.title}
                        </h3>
                        <p className="font-body-sm text-[12.5px] text-on-surface-variant line-clamp-2 leading-relaxed">
                          {vid.sceneDescription}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-outline-variant/20 font-label-mono text-[11px] text-on-surface-variant">
                        <span>📅 {vid.date}</span>
                        <span className="text-primary-container font-bold">
                          장면 프레임 &amp; 동영상 재생 →
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : searchSpace === 'vault' ? (
            <section className="flex flex-col gap-6">
              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="px-3 py-1 rounded-full bg-[#FFAB00] text-surface-container-lowest font-label-sm text-[12px] font-black">
                    📁 스마트 서류함 통합 검색
                  </span>
                  <h2 className="font-headline-md text-[20px] text-on-surface font-extrabold">
                    “{activeQuery}” 서류·문서 자산 결과
                  </h2>
                  <span className="px-3 py-0.5 rounded-full bg-[#FFAB00]/20 text-[#FFAB00] font-label-md text-[13px] font-bold">
                    PDF·문서 {matchedLocalDocs.length}건 + 촬영 서류 {searchResults.length}장
                  </span>
                </div>

                <button
                  onClick={() => void openLocalFolder('docs')}
                  className="px-3.5 py-1.5 rounded-full bg-surface-container-high hover:bg-surface-bright text-[#FFAB00] font-label-sm text-[12px] font-extrabold border border-[#FFAB00]/40 flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">folder_open</span>
                  <span>내 PC 로컬 서류함 폴더(test_docs) 열기</span>
                </button>
              </div>

              {/* (1) 로컬 PDF / TXT / DOCX 문서 파일 그리드 */}
              {matchedLocalDocs.length > 0 && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 px-1">
                    <span className="material-symbols-outlined text-[#FFAB00] text-[19px]">
                      picture_as_pdf
                    </span>
                    <h3 className="font-headline-sm text-[16px] text-on-surface font-extrabold">
                      📄 폰·PC 로컬 문서 파일 (PDF · TXT · DOCX 텍스트 추출 색인 — {matchedLocalDocs.length}건)
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {matchedLocalDocs.map((doc) => (
                      <article
                        key={doc.id}
                        onClick={() => setSelectedDocModal(doc)}
                        className="group p-5 rounded-2xl bg-surface-container-low hover:bg-surface-container border border-[#FFAB00]/35 hover:border-[#FFAB00] shadow-md flex flex-col justify-between gap-3 cursor-pointer transition-all hover:-translate-y-0.5"
                      >
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded bg-[#FFAB00] text-surface-container-lowest font-label-mono text-[10px] font-black">
                                {doc.ext}
                              </span>
                              <span className="px-2.5 py-0.5 rounded-full bg-surface-container-highest text-[#FFAB00] font-label-sm text-[11px] font-bold">
                                {doc.categoryBadge}
                              </span>
                            </div>
                            <span className="font-label-mono text-[10px] text-on-surface-variant">
                              {doc.deviceSource}
                            </span>
                          </div>

                          <h4 className="font-headline-sm text-[15.5px] text-on-surface font-extrabold group-hover:text-[#FFAB00] transition-colors">
                            {doc.title}
                          </h4>

                          <p className="font-body-sm text-[12.5px] text-on-surface-variant line-clamp-2 leading-relaxed bg-surface-container-lowest/80 p-2.5 rounded-xl border border-outline-variant/20">
                            {doc.extractedText}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-outline-variant/20 font-label-mono text-[11px] text-on-surface-variant">
                          <span>📅 {doc.date}</span>
                          <span className="text-primary-container font-bold">
                            본문 열람 / 폴더 열기 →
                          </span>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}

              {/* (2) 사진첩 속 촬영 서류 / 신분증 / 조립 설명서 / 심사 캡처 그리드 */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 px-1">
                  <span className="material-symbols-outlined text-primary-container text-[19px]">
                    document_scanner
                  </span>
                  <h3 className="font-headline-sm text-[16px] text-on-surface font-extrabold">
                    📸 갤러리 내 촬영·캡처 서류 자산 (#문서·설명서, #문서·신분증 등 — {searchResults.length}장)
                  </h3>
                </div>

                {searchResults.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {searchResults.map((item) => (
                      <article
                        key={item.photo.id}
                        onClick={() => setSelectedPhoto(item.photo, null)}
                        className="group relative rounded-2xl overflow-hidden bg-surface-container border border-primary-container/45 hover:border-primary-container shadow-md flex flex-col cursor-pointer transition-all hover:-translate-y-0.5"
                      >
                        <div className="relative aspect-[4/5] w-full overflow-hidden bg-surface-container-highest">
                          <img
                            src={item.photo.thumbUrl}
                            alt={item.photo.name}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />

                          <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-black/85 backdrop-blur-md border border-[#FFAB00]/70 text-[#FFAB00] font-label-sm text-[11px] font-extrabold">
                            {item.photo.vaultCategoryLabel || item.photo.tags[0] || '📁 촬영 서류'}
                          </div>

                          <div className="absolute inset-x-0 bottom-0 h-[22%] min-h-[48px] px-3 pb-2.5 pt-4 bg-gradient-to-t from-black/95 via-black/65 to-transparent flex items-end justify-between pointer-events-none">
                            <span className="font-label-sm text-[12px] font-bold text-white drop-shadow">
                              {item.photo.date.split(' ')[0]}
                            </span>
                            <span className="font-label-sm text-[11px] font-extrabold text-[#70F5FF] truncate ml-2 drop-shadow">
                              {item.photo.tags[0]}
                            </span>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 rounded-2xl bg-surface-container/40 border border-outline-variant/25 text-center font-body-sm text-on-surface-variant">
                    해당 검색어와 일치하는 촬영 서류 사진은 없으며, 상단 로컬 PDF·문서 검색 결과를 확인해 주세요.
                  </div>
                )}
              </div>
            </section>
          ) : (
            /* 2-B) [🖼️ 전체/갤러리] 모드일 때: 사진 검색 결과 그리드 (dHash 동일 연사 묶기 + 하단 15% 블랙 그라데이션) */
            <section className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="font-headline-md text-[20px] text-on-surface font-extrabold">
                    “{activeQuery}” 검색 결과
                  </h2>
                  <span className="px-3 py-0.5 rounded-full bg-primary-container/20 text-primary-container font-label-md text-[13px] font-bold">
                    총 {searchResults.length}장
                    {groupBurstsInSearch && collapsedBurstCount > 0
                      ? ` (연사 묶음 ${groupedResults.length}컷 표시)`
                      : ''}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setGroupBurstsInSearch(!groupBurstsInSearch)}
                    className={`px-3 py-1.5 rounded-full font-label-sm text-[12px] font-bold flex items-center gap-1.5 border transition-all ${
                      groupBurstsInSearch
                        ? 'bg-primary-container/15 border-primary-container/50 text-primary-container'
                        : 'bg-surface-container-high border-outline-variant/30 text-on-surface-variant'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px]">burst_mode</span>
                    <span>
                      {groupBurstsInSearch ? '❐ 동일 연사 묶어보기 ON' : '연사 전체 펼쳐보기'}
                    </span>
                  </button>
                  <span className="hidden sm:inline font-body-sm text-[12px] text-on-surface-variant">
                    사진 클릭 시 상세 비교 및 원본 폴더 열기
                  </span>
                </div>
              </div>

              {groupedResults.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {groupedResults.map((group) => {
                    const item = group.representative;
                    const isBurst = group.burstCount >= 2;
                    return (
                      <article
                        key={item.photo.id}
                        onClick={() =>
                          setSelectedPhoto(item.photo, isBurst ? group.burstPhotos : null)
                        }
                        className={`group relative rounded-2xl overflow-hidden bg-surface-container border transition-all hover:-translate-y-0.5 cursor-pointer flex flex-col ${
                          isBurst
                            ? 'border-primary-container/60 shadow-[0_6px_22px_rgba(0,229,255,0.16)]'
                            : 'border-outline-variant/25 hover:border-primary-container/70 shadow-md'
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
                            <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur-md border border-primary-container/70 text-primary-container font-label-sm text-[11px] font-extrabold flex items-center gap-1 shadow-lg">
                              <span>❐ {group.burstCount}장 연사</span>
                            </div>
                          )}

                          {/* 즐겨찾기 버튼 */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleBookmark(item.photo.id);
                            }}
                            aria-label="즐겨찾기"
                            className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-black/65 backdrop-blur-md flex items-center justify-center text-white hover:text-primary-container transition-colors"
                          >
                            <span className="material-symbols-outlined text-[17px]">
                              {item.photo.bookmarked ? 'bookmark_added' : 'favorite'}
                            </span>
                          </button>

                          {/* 지침 #3: 사진 하단 날짜/태그가 잘 보이도록 썸네일 하단 15%~20%에 은은한 블랙 그라데이션 */}
                          <div className="absolute inset-x-0 bottom-0 h-[20%] min-h-[46px] px-3 pb-2.5 pt-4 bg-gradient-to-t from-black/90 via-black/55 to-transparent flex items-end justify-between pointer-events-none">
                            <span className="font-label-sm text-[12px] font-bold text-white drop-shadow">
                              {item.photo.date.split(' ')[0]}
                            </span>
                            {item.photo.tags[0] && (
                              <span className="font-label-sm text-[11px] font-extrabold text-[#70F5FF] truncate ml-2 drop-shadow">
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
                <div className="py-16 rounded-2xl bg-surface-container/40 border border-outline-variant/25 text-center flex flex-col items-center gap-2">
                  <span className="material-symbols-outlined text-outline text-[40px]">
                    image_search
                  </span>
                  <p className="font-headline-sm text-[16px] text-on-surface font-bold">
                    일치하는 사진을 찾지 못했습니다. 다른 문장이나 단어로 검색해 보세요.
                  </p>
                </div>
              )}
            </section>
          )}
        </main>
      )}

      {/* ─────────────── 탭 2: 🧹 주치의 정리 (무료 종합 진단서 + 3중 안전망 Undo + 바둑판 Pick) ─────────────── */}
      {desktopTab === 'trash' && <SmartTrashView />}

      {/* ─────────────── [스펙 3 핵심] 탭 3: ⚙️ 내 기기 & 백업 (클라우드 대체 '프라이빗 싱크' 2대 모드 선택 UI) ─────────────── */}
      {desktopTab === 'sync' && (
        <main className="flex-1 w-full max-w-[1280px] mx-auto px-6 md:px-10 py-8 flex flex-col gap-6">
          {/* 상단 타이틀 & 배터리/OS 제재 방어 원칙 배너 */}
          <div className="p-6 rounded-3xl bg-gradient-to-r from-surface-container-low via-surface-container to-[#0d2733] border border-primary-container/35 flex flex-col gap-3 shadow-lg">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-primary-container text-on-primary-container font-label-sm text-[12px] font-black">
                ☁️❌ 클라우드 월정액 해방! 폰↔PC 완전 일치화 센터
              </span>
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-label-sm text-[11.5px] font-extrabold">
                🔒 무거운 원본 파일 미전송 / AI 분석 서버 하드디스크 저장 0건 (RAM 연산 후 0.1초 내 즉시 자동 소각)
              </span>
            </div>

            <h1 className="font-headline-lg text-[24px] md:text-[27px] text-on-surface font-extrabold tracking-tight">
              ⚙️ 클라우드 대체 ‘프라이빗 싱크’ 2-Track 전략 선택
            </h1>

            {/* 🔋 배터리/OS 제재 방어 원칙 명시 배지 */}
            <div className="p-4 rounded-2xl bg-black/45 border border-[#00E5FF]/40 flex items-start sm:items-center gap-3">
              <span className="material-symbols-outlined text-primary-container text-[24px] shrink-0">
                battery_charging_full
              </span>
              <p className="font-body-sm text-[13px] md:text-[13.5px] text-white/95 font-semibold leading-relaxed">
                🔋 <strong>배터리 · OS 제재 방어 원칙:</strong> “세이씨 모바일 에이전트(1MB APK)는 배터리를 소모하는 상시 통신을 하지 않으며,{' '}
                <strong className="text-[#00E5FF]">[집 Wi-Fi 연결 + 충전 중]</strong>이거나{' '}
                <strong className="text-[#FFD740]">[지금 일치시키기]</strong> 버튼을 누를 때만 작동합니다.”
              </p>
            </div>
          </div>

          {/* ─────────────── 동기화 전략 2-Track 선택 라디오 카드 (모드 A vs 모드 B) ─────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* 모드 A: [🔄 100% 원본 미러링 모드] */}
            <div
              onClick={() => setPrivateSyncStrategy('mirror')}
              className={`p-6 rounded-3xl cursor-pointer transition-all flex flex-col justify-between gap-5 border-2 ${
                syncState.privateSyncStrategy === 'mirror'
                  ? 'bg-surface-container-high border-emerald-400 ring-2 ring-emerald-400/30 shadow-[0_0_32px_rgba(16,185,129,0.2)]'
                  : 'bg-surface-container-low/90 hover:bg-surface-container border-outline-variant/30'
              }`}
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-label-sm text-[12px] font-extrabold">
                    모드 A • 폰 여유 공간이 넉넉할 때
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={syncState.privateSyncStrategy === 'mirror'}
                      onChange={() => setPrivateSyncStrategy('mirror')}
                      className="w-5 h-5 accent-emerald-400"
                    />
                    <span className="font-label-sm text-[12px] text-emerald-300 font-bold">
                      {syncState.privateSyncStrategy === 'mirror' ? '선택됨' : '선택하기'}
                    </span>
                  </div>
                </div>

                <h2 className="font-headline-md text-[20px] text-white font-extrabold">
                  🔄 [100% 원본 미러링 모드]
                </h2>

                <p className="font-body-md text-[13.5px] text-on-surface-variant leading-relaxed">
                  폰과 PC를 주치의 정리로 먼저 깨끗이 비운 뒤,{' '}
                  <strong className="text-white">
                    양쪽 기기에 똑같은 원본 파일을 1:1로 유지하여 클라우드 없이 완벽한 상호 백업 보험
                  </strong>
                  을 구축합니다.
                </p>

                <div className="p-4 rounded-2xl bg-surface-container-lowest/90 border border-outline-variant/25 flex flex-col gap-2">
                  <div className="flex items-center justify-between font-label-sm text-[12px]">
                    <span className="text-on-surface-variant">내 PC 보관함 용량</span>
                    <span className="text-on-surface font-bold">{syncState.originalSizeGB} GB (원본 100%)</span>
                  </div>
                  <div className="flex items-center justify-between font-label-sm text-[12px]">
                    <span className="text-on-surface-variant">내 스마트폰 점유 용량</span>
                    <span className="text-emerald-300 font-bold">{syncState.originalSizeGB} GB (원본 1:1 미러링)</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-outline-variant/20 flex items-center justify-between">
                <span className="font-label-sm text-[12px] text-emerald-300 font-bold">
                  ✓ 폰 분실 시 PC에 원본 100% 보존 • PC 고장 시 폰에 원본 100% 보존
                </span>
              </div>
            </div>

            {/* 모드 B: [👻 초경량 섀도우 캐시 모드] */}
            <div
              onClick={() => setPrivateSyncStrategy('shadow')}
              className={`p-6 rounded-3xl cursor-pointer transition-all flex flex-col justify-between gap-5 border-2 ${
                syncState.privateSyncStrategy === 'shadow'
                  ? 'bg-gradient-to-br from-[#072a36] via-surface-container-high to-surface-container border-primary-container ring-2 ring-primary-container/35 shadow-[0_0_36px_rgba(0,229,255,0.25)]'
                  : 'bg-surface-container-low/90 hover:bg-surface-container border-outline-variant/30'
              }`}
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-3 py-1 rounded-full bg-primary-container text-on-primary-container font-label-sm text-[12px] font-black">
                    모드 B • 폰 용량이 부족할 때 (강력 추천!)
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={syncState.privateSyncStrategy === 'shadow'}
                      onChange={() => setPrivateSyncStrategy('shadow')}
                      className="w-5 h-5 accent-[#00E5FF]"
                    />
                    <span className="font-label-sm text-[12px] text-primary-container font-bold">
                      {syncState.privateSyncStrategy === 'shadow' ? '선택됨 (추천)' : '선택하기'}
                    </span>
                  </div>
                </div>

                <h2 className="font-headline-md text-[20px] text-white font-extrabold">
                  👻 [초경량 섀도우 캐시 모드] (장당 13KB)
                </h2>

                <p className="font-body-md text-[13.5px] text-on-surface-variant leading-relaxed">
                  무거운 원본(수십 GB)은 집 PC 하드디스크로 이관해 폰 용량을 비우고, 폰에는{' '}
                  <strong className="text-primary-container">
                    장당 13KB짜리 경량 WebP 썸네일 + 768d 벡터 인덱스
                  </strong>
                  만 남깁니다.
                </p>

                <div className="p-4 rounded-2xl bg-black/50 border border-primary-container/40 flex flex-col gap-2">
                  <div className="flex items-center justify-between font-label-sm text-[12px]">
                    <span className="text-on-surface-variant">내 PC 하드디스크 (원본 블랙박스)</span>
                    <span className="text-white font-bold">{syncState.originalSizeGB} GB (원본 전체 보관)</span>
                  </div>
                  <div className="flex items-center justify-between font-label-sm text-[12px]">
                    <span className="text-on-surface-variant">내 스마트폰 점유 용량 (13KB × {photos.length}장)</span>
                    <span className="text-[#00E5FF] font-black">
                      단 {syncState.packSizeMB} MB! (폰 용량 99.4% 절약)
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-primary-container/25">
                <p className="font-label-sm text-[12.5px] text-[#FFD740] font-extrabold">
                  ⚡ 핵심 무기: 집 PC 전원이 꺼져 있어도 밖에서 내 폰으로 PC 속 10년 치 사진·서류를 0.04초 만에 100% 검색·열람 가능!
                </p>
              </div>
            </div>
          </div>

          {/* 하단: 동기화 트리거 조건 & 로컬 폴더 관리 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* 좌측: 지금 일치시키기 & 자동 작동 조건 */}
            <div className="p-6 rounded-3xl bg-surface-container-low border border-outline-variant/30 flex flex-col justify-between gap-4">
              <div className="flex flex-col gap-3">
                <h3 className="font-headline-sm text-[18px] text-on-surface font-extrabold">
                  📲 모바일 에이전트 자동 작동 조건 &amp; 즉시 일치화
                </h3>

                <label className="p-3.5 rounded-2xl bg-surface-container/70 border border-outline-variant/25 flex items-center justify-between gap-3 cursor-pointer">
                  <div className="flex flex-col">
                    <span className="font-label-md text-[13px] text-on-surface font-bold">
                      집/사무실 동일 Wi-Fi 연결 시에만 작동
                    </span>
                    <span className="font-body-sm text-[12px] text-on-surface-variant">
                      모바일 데이터(LTE/5G)를 소모하지 않고 로컬 초고속 망으로만 전송합니다.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={syncState.wifiOnly}
                    onChange={(e) => updateSyncSettings(syncState.mode, e.target.checked)}
                    className="w-5 h-5 accent-[#00E5FF] rounded"
                  />
                </label>

                <label className="p-3.5 rounded-2xl bg-surface-container/70 border border-outline-variant/25 flex items-center justify-between gap-3 cursor-pointer">
                  <div className="flex flex-col">
                    <span className="font-label-md text-[13px] text-on-surface font-bold">
                      충전 중일 때만 백그라운드 동기화 · 인덱싱 실행
                    </span>
                    <span className="font-body-sm text-[12px] text-on-surface-variant">
                      평소에는 배터리 소모 0%! 충전기를 꽂았을 때만 조용히 일치화합니다.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={syncState.chargingOnly}
                    onChange={(e) => setChargingOnlySync(e.target.checked)}
                    className="w-5 h-5 accent-[#00E5FF] rounded"
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-outline-variant/20">
                <span className="font-label-mono text-[12px] text-on-surface-variant">
                  최근 일치화: <strong className="text-primary-container">{syncState.lastSyncedAt}</strong>
                </span>
                <button
                  type="button"
                  disabled={syncState.syncing}
                  onClick={() => void triggerSyncNow()}
                  className="px-5 py-2.5 rounded-xl bg-primary-container hover:opacity-95 text-on-primary-container font-label-lg text-[13.5px] font-black shadow-[0_0_20px_rgba(0,229,255,0.35)] flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">sync</span>
                  <span>
                    {syncState.syncing
                      ? '폰↔PC 일치화 실행 중...'
                      : syncState.privateSyncStrategy === 'shadow'
                      ? '⚡ 지금 일치시키기 (13KB 섀도우 캐시)'
                      : '⚡ 지금 일치시키기 (100% 원본 미러링)'}
                  </span>
                </button>
              </div>
            </div>

            {/* 우측: 내 PC 로컬 폴더 3종 (사진 / 스마트 서류함 / 정리대기함) 직결 카드 */}
            <div className="p-6 rounded-3xl bg-surface-container-low border border-outline-variant/30 flex flex-col justify-between gap-4">
              <div className="flex flex-col gap-3">
                <h3 className="font-headline-sm text-[18px] text-on-surface font-extrabold">
                  📁 내 PC 로컬 블랙박스 폴더 직결 관리
                </h3>
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="p-3 rounded-2xl bg-surface-container/70 border border-outline-variant/20 flex flex-col">
                    <span className="font-body-sm text-[11px] text-on-surface-variant">갤러리 활성</span>
                    <span className="font-headline-sm text-[18px] text-primary-container font-extrabold">
                      {activePhotos.length}장
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-surface-container/70 border border-outline-variant/20 flex flex-col">
                    <span className="font-body-sm text-[11px] text-on-surface-variant">스마트 서류함</span>
                    <span className="font-headline-sm text-[18px] text-[#FFAB00] font-extrabold">
                      {matchedLocalDocs.length + activePhotos.filter((p) => p.isVaultDocument).length}건
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-surface-container/70 border border-outline-variant/20 flex flex-col">
                    <span className="font-body-sm text-[11px] text-on-surface-variant">30일 정리대기함</span>
                    <span className="font-headline-sm text-[18px] text-emerald-300 font-extrabold">
                      {quarantinedPhotos.length}장
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-outline-variant/20">
                <button
                  onClick={() => void openLocalFolder('photos')}
                  className="px-3.5 py-2.5 rounded-xl bg-primary-container text-on-primary-container font-label-sm text-[12.5px] font-extrabold flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[17px]">folder_open</span>
                  <span>원본 사진 폴더</span>
                </button>
                <button
                  onClick={() => void openLocalFolder('docs')}
                  className="px-3.5 py-2.5 rounded-xl bg-[#FFAB00] text-surface-container-lowest font-label-sm text-[12.5px] font-extrabold flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[17px]">folder_managed</span>
                  <span>스마트 서류함(PDF) 폴더</span>
                </button>
                <button
                  onClick={() => void openLocalFolder('quarantine')}
                  className="px-3.5 py-2.5 rounded-xl bg-surface-container-high hover:bg-surface-bright text-on-surface font-label-sm text-[12.5px] font-bold flex items-center gap-1.5 border border-outline-variant/30"
                >
                  <span className="material-symbols-outlined text-[17px]">inventory_2</span>
                  <span>정리대기함 폴더</span>
                </button>
                <button
                  onClick={() => setShowOnboarding(true)}
                  className="px-3 py-2.5 rounded-xl bg-surface-container-high hover:bg-surface-bright text-primary font-label-sm text-[12px] font-bold"
                >
                  인덱싱 모니터
                </button>
              </div>
            </div>
          </div>
        </main>
      )}
    </div>
  );
};
