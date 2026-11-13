import React, { useEffect, useMemo, useState } from 'react';
import { useSaySeeStore } from '../../store/useSaySeeStore';
import { jumpToGhostSecretary } from '../../components/GhostSecretaryFirstGuard';

export const FreePhotoShareOverlays: React.FC = () => {
  const {
    activeLoungeType,
    photos,
    activeFamilyRoom,
    guestJoinWallReason,
    triggerGuestJoinWall,
    completeGuestOneSecJoin,
    showSharedPhotoUploadModal,
    setShowSharedPhotoUploadModal,
    addLocalPhotosToSharedRoom,
    sharedRoomHostPhotos,
    sharedRoomAddedPhotos,
    importMobileLocalPhotos,
  } = useSaySeeStore();

  const [guestNicknameDraft, setGuestNicknameDraft] = useState(
    activeLoungeType === 'family' ? '해나라' : '박총무'
  );
  const [guestEmailDraft, setGuestEmailDraft] = useState(
    activeLoungeType === 'family' ? 'family@sundreamer.app' : 'friend@sundreamer.app'
  );
  const [selectedSharedUploadIds, setSelectedSharedUploadIds] = useState<string[]>([]);

  const uploadableLocalPhotos = useMemo(() => {
    const existingSharedNames = new Set([
      ...sharedRoomHostPhotos.map((p) => p.name),
      ...sharedRoomAddedPhotos.map((p) => p.name),
    ]);
    return photos.filter(
      (p) =>
        !p.quarantined &&
        !p.isVaultDocument &&
        !p.trashCategory &&
        !existingSharedNames.has(p.name) &&
        !/^(IMG_2025|PET_2025|TRV_2025|DOC_2025|MEMO_2025|Screenshot_2025|BLUR_2025)/.test(p.name)
    );
  }, [photos, sharedRoomHostPhotos, sharedRoomAddedPhotos]);

  useEffect(() => {
    if (showSharedPhotoUploadModal) {
      setSelectedSharedUploadIds(uploadableLocalPhotos.slice(0, 12).map((p) => p.id));
    }
  }, [showSharedPhotoUploadModal, uploadableLocalPhotos]);

  return (
    <>
      {/* 💬 카톡 인앱 무가입 1초 프리뷰 — Step 3: [1초 합류] 명분 있는 별명(실명) + 이메일 입력 모달 (Auth-Wall) */}
      {guestJoinWallReason && (
        <div
          onClick={() => triggerGuestJoinWall('')}
          className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-zinc-950 border-2 border-amber-400/60 p-6 shadow-[0_0_50px_rgba(251,191,36,0.25)] flex flex-col gap-4"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="px-2.5 py-1 rounded-full bg-[#FEE500] text-[#191919] font-label-sm text-[11.5px] font-black">
                💬 카톡 단톡방 1초 합류 (평생 0원)
              </span>
              <button
                type="button"
                onClick={() => useSaySeeStore.setState({ guestJoinWallReason: null })}
                className="w-7 h-7 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="text-[12px] font-extrabold text-amber-300">
                선택하신 기능: [{guestJoinWallReason}]
              </div>
              <h3 className="font-headline-sm text-[18px] text-white font-black leading-snug">
                🔒 외부인 유출 방지 및 고화질 원본 전달을 위해, 이 방에서 쓰실 별명(실명)과 이메일만 입력해 주세요!
              </h3>
              <p className="text-[12px] text-emerald-300 font-bold">
                ✨ 방장님이 초대하신 분은 앱 설치·결제 없이 평생 100% 무료입니다. (각 방에서 입력한 별명·실명 그대로 표시됩니다)
              </p>
            </div>

            <div className="flex flex-col gap-2.5">
              <label className="flex flex-col gap-1">
                <span className="text-[11.5px] text-zinc-300 font-bold">
                  이 방에서 쓰실 별명 또는 실명 (예: 한민수, 박준호)
                </span>
                <input
                  type="text"
                  value={guestNicknameDraft}
                  onChange={(e) => setGuestNicknameDraft(e.target.value)}
                  placeholder="예: 박총무"
                  className="px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/15 text-white text-[13px] font-bold outline-none focus:border-amber-400"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[11.5px] text-zinc-300 font-bold">
                  이메일 주소 (고화질 원본 전달 및 내 얼굴 여권 연결용)
                </span>
                <input
                  type="email"
                  value={guestEmailDraft}
                  onChange={(e) => setGuestEmailDraft(e.target.value)}
                  placeholder="예: friend@naver.com"
                  className="px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/15 text-white text-[13px] font-bold outline-none focus:border-amber-400"
                />
              </label>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => completeGuestOneSecJoin(guestNicknameDraft, guestEmailDraft)}
                className="flex-1 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-md text-[13px] font-black cursor-pointer shadow-md"
              >
                🚀 1초 합류하고 고화질 원본·댓글 바로 쓰기 (0원)
              </button>
              <button
                type="button"
                onClick={() => useSaySeeStore.setState({ guestJoinWallReason: null })}
                className="px-3.5 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-300 text-[12px] font-bold cursor-pointer"
              >
                더 구경하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📸 공유 사진방(가족방/모임방) — 내 컴퓨터 색인 사진 골라 올리기 모달 */}
      {showSharedPhotoUploadModal && (
        <div
          onClick={() => setShowSharedPhotoUploadModal(false)}
          className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl max-h-[88vh] rounded-3xl bg-zinc-950 border-2 border-[#2DD4BF]/65 p-5 md:p-6 shadow-[0_0_55px_rgba(45,212,191,0.22)] flex flex-col gap-4 overflow-hidden"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-teal-500/20 border border-teal-400/40 text-teal-300 font-label-sm text-[11.5px] font-black">
                    📸 내 기기 색인 사진 골라 올리기 (초경량 13KB 섀도우 공유)
                  </span>
                </div>
                <h3 className="font-headline-sm text-[18px] md:text-[20px] text-white font-black">
                  『{activeFamilyRoom} 패밀리 앨범』에 추가할 내 컴퓨터 사진을 선택해 주세요
                </h3>
                <p className="text-[12px] text-zinc-300">
                  중복·흔들린 사진과 신분증 서류는 자동으로 걸러낸 깔끔한 새 사진 <strong>{uploadableLocalPhotos.length}장</strong>이 준비되어 있습니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSharedPhotoUploadModal(false)}
                className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 flex items-center justify-center text-sm font-bold cursor-pointer shrink-0"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/10">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedSharedUploadIds(uploadableLocalPhotos.map((p) => p.id))}
                  className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-teal-400/50 text-teal-300 font-label-sm text-[11.5px] font-extrabold cursor-pointer"
                >
                  ✨ 내 컴퓨터 새 사진 {uploadableLocalPhotos.length}장 전체 선택
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSharedUploadIds([])}
                  className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-300 font-label-sm text-[11.5px] font-bold cursor-pointer"
                >
                  선택 해제
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowSharedPhotoUploadModal(false);
                  useSaySeeStore.setState({
                    pendingReturnShareRoom: {
                      loungeType: activeLoungeType,
                      familyRoom: activeFamilyRoom,
                      roomTitle: `${activeFamilyRoom} 패밀리 앨범`,
                    },
                  });
                  jumpToGhostSecretary();
                }}
                className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-emerald-400/40 text-emerald-300 font-label-sm text-[11.5px] font-bold cursor-pointer"
              >
                👻 올리기 전에 귀신비서에서 중복·흔들린 사진 먼저 점검하기
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              {uploadableLocalPhotos.length === 0 ? (
                <div className="py-12 px-4 rounded-2xl bg-zinc-900/70 border border-white/10 flex flex-col items-center justify-center text-center gap-3">
                  <span className="text-3xl">📂</span>
                  <p className="text-[14px] text-white font-bold">
                    새로 추가할 내 컴퓨터 사진이 아직 보이지 않아요.
                  </p>
                  <p className="text-[12px] text-zinc-400 max-w-md">
                    내 PC의 사진 폴더(`Pictures`)에 사진을 넣어두셨다면 로컬 엔진을 새로고침하거나 스마트폰에서 직접 사진을 골라 올릴 수 있어요.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => void useSaySeeStore.getState().initApp(true)}
                      className="px-4 py-2 rounded-xl bg-[#2DD4BF] text-zinc-950 font-label-sm text-[12px] font-black cursor-pointer"
                    >
                      🔄 내 컴퓨터 사진 폴더 다시 스캔하기
                    </button>
                    <label className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-white/15 text-white font-label-sm text-[12px] font-bold cursor-pointer">
                      📱 파일 탐색기에서 직접 사진 고르기
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            void importMobileLocalPhotos(e.target.files);
                            e.target.value = '';
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                  {uploadableLocalPhotos.map((p) => {
                    const checked = selectedSharedUploadIds.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() =>
                          setSelectedSharedUploadIds((prev) =>
                            prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                          )
                        }
                        className={`relative aspect-square rounded-2xl overflow-hidden border-2 transition-all cursor-pointer group ${
                          checked
                            ? 'border-[#2DD4BF] ring-2 ring-[#2DD4BF]/40 scale-[0.99]'
                            : 'border-white/10 hover:border-white/30 opacity-80 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={p.thumbUrl}
                          alt={p.name}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                        <div
                          className={`absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-black shadow ${
                            checked
                              ? 'bg-[#2DD4BF] text-zinc-950'
                              : 'bg-black/65 border border-white/30 text-white'
                          }`}
                        >
                          {checked ? '✓' : ''}
                        </div>
                        <div className="absolute inset-x-0 bottom-0 px-1.5 py-1 bg-gradient-to-t from-black/85 to-transparent text-left">
                          <span className="block text-[10px] text-zinc-200 font-medium truncate">
                            {p.date.split(' ')[0]}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10">
              <span className="text-[12px] text-zinc-300 font-bold">
                선택됨: <strong className="text-[#2DD4BF]">{selectedSharedUploadIds.length}장</strong> / 전체 새 사진 {uploadableLocalPhotos.length}장
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSharedPhotoUploadModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-300 font-label-md text-[12.5px] font-bold cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="button"
                  disabled={selectedSharedUploadIds.length === 0}
                  onClick={() => addLocalPhotosToSharedRoom(selectedSharedUploadIds)}
                  className="px-5 py-2.5 rounded-xl bg-[#2DD4BF] hover:bg-[#5EEAD4] disabled:opacity-40 text-zinc-950 font-label-md text-[13px] font-black shadow-lg shadow-teal-500/25 cursor-pointer"
                >
                  📸 선택한 {selectedSharedUploadIds.length}장 가족방에 올리기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
