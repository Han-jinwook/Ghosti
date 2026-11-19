import React, { useState } from 'react';
import type { FamilyRoomId, LoungeType } from '../../types/saysee';
import { useSaySeeStore } from '../../store/useSaySeeStore';
import { parseShareInviteInput } from '../../services/shareInviteDeepLinkBridge';

export const SAMPLE_FAMILY_PHOTOS: string[] = [];

export const SAMPLE_FAMILY_GROUPS: {
  key: 'summer2024' | 'outing2026';
  label: string;
  photos: string[];
}[] = [];

export const SAMPLE_FAMILY_THUMB_BASE = '/shared_family_host_thumbs/';

export const SampleSharedRoomExperienceCard: React.FC<{
  loungeType: LoungeType;
  familyRoom: FamilyRoomId;
}> = ({ loungeType, familyRoom }) => {
  const [showInvitePasteBox, setShowInvitePasteBox] = useState(false);
  const [invitePasteDraft, setInvitePasteDraft] = useState('');

  const roomTypeKo =
    loungeType === 'club'
      ? '동호회·모임'
      : loungeType === 'student'
      ? '동창회'
      : `${familyRoom} 가족`;

  const handleOpenReceivedInvite = async () => {
    try {
      const clipText = await navigator.clipboard?.readText?.();
      if (clipText && parseShareInviteInput(clipText)) {
        await useSaySeeStore.getState().applyShareInviteDeepLink(clipText);
        return;
      }
    } catch {
      /* 브라우저/iOS 권한에 따라 직접 입력칸 오픈 */
    }
    setShowInvitePasteBox(true);
  };

  const handleSubmitInviteDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await useSaySeeStore.getState().applyShareInviteDeepLink(invitePasteDraft);
    if (ok) {
      setShowInvitePasteBox(false);
      setInvitePasteDraft('');
    } else {
      useSaySeeStore
        .getState()
        .showToast('⚠️ 유효한 공유방 초대 링크(또는 초대 메시지)를 붙여넣어 주세요.');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="py-7 px-5 rounded-2xl bg-[#18181B] border border-white/10 text-center flex flex-col items-center gap-2.5">
        <span className="px-3 py-1 rounded-full bg-zinc-900 border border-white/15 text-[11.5px] font-bold text-zinc-300">
          현재 내 {roomTypeKo} 공유방 사진 · 0장 (빈 방)
        </span>
        <p className="font-headline-sm text-[15px] sm:text-[16px] text-white font-bold break-keep">
          아직 참여 중이거나 올라온 {roomTypeKo} 공유 사진이 없습니다
        </p>
        <p className="font-body-sm text-[12px] sm:text-[12.5px] text-zinc-400 max-w-lg break-keep">
          가족·동호회·동창회 공유방은 초대 링크를 받아 입장하거나 내가 직접 사진을 올렸을 때만 열리며, 다른 사람의 파일이나 내 기기 사진과 절대 섞이지 않습니다.
        </p>
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => useSaySeeStore.getState().requestAddMyPhotosToSharedRoom()}
            className="px-4 py-2.5 rounded-xl bg-[#2DD4BF] hover:bg-[#5EEAD4] text-zinc-950 font-label-sm text-[12.5px] font-black cursor-pointer shadow-md"
          >
            📸 내 사진 올려서 {roomTypeKo} 공유방 시작하기
          </button>
          <button
            type="button"
            onClick={() => void handleOpenReceivedInvite()}
            className="px-3.5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-amber-400/50 text-amber-300 font-label-sm text-[12px] font-extrabold cursor-pointer"
          >
            💌 받은 카톡 초대 링크로 방 바로 열기
          </button>
        </div>

        {showInvitePasteBox && (
          <form
            onSubmit={(e) => void handleSubmitInviteDraft(e)}
            className="w-full max-w-md mt-2 flex items-center gap-1.5"
          >
            <input
              type="text"
              value={invitePasteDraft}
              onChange={(e) => setInvitePasteDraft(e.target.value)}
              placeholder="카톡으로 받은 초대 링크나 문구를 붙여넣어 주세요"
              className="flex-1 px-3 py-2 rounded-xl bg-zinc-900 border border-white/15 text-white text-[12px] outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-sm text-[12px] font-black cursor-pointer shrink-0"
            >
              입장
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
