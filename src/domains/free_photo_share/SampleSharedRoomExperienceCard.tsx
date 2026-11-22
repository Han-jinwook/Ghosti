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
  const isLoadingSharedRoomPhotos = useSaySeeStore((s) => s.isLoadingSharedRoomPhotos);
  const [showInvitePasteBox, setShowInvitePasteBox] = useState(false);
  const [invitePasteDraft, setInvitePasteDraft] = useState('');

  const roomTypeKo =
    loungeType === 'club'
      ? '동호회·모임'
      : loungeType === 'student'
      ? '동창회'
      : `${familyRoom} 가족`;

  if (isLoadingSharedRoomPhotos) {
    return (
      <div className="flex flex-col gap-4" data-allow-secretary-jump="true">
        <div className="py-10 px-6 rounded-xl bg-white border border-slate-200 text-center flex flex-col items-center gap-2">
          <span className="inline-block w-4 h-4 rounded-full border-2 border-slate-700 border-t-transparent animate-spin" />
          <p className="text-[13.5px] font-medium text-slate-900">
            {roomTypeKo} 공유방 사진을 불러오는 중입니다
          </p>
          <p className="text-[12px] text-slate-500">
            공유방 사진 목록을 확인하고 있습니다.
          </p>
        </div>
      </div>
    );
  }

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
        .showToast('유효한 공유방 초대 링크 또는 초대 문구를 입력해 주세요.');
    }
  };

  return (
    <div className="flex flex-col gap-4" data-allow-secretary-jump="true">
      <div className="py-8 px-6 rounded-xl bg-white border border-slate-200 text-center flex flex-col items-center gap-2.5">
        <span className="px-2.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[11.5px] font-medium text-slate-600">
          {roomTypeKo} 공유방 · 사진 없음
        </span>
        <p className="text-[15px] sm:text-[16px] text-slate-900 font-semibold break-keep">
          아직 등록된 {roomTypeKo} 공유 사진이 없습니다
        </p>
        <p className="text-[12.5px] text-slate-500 max-w-lg break-keep leading-relaxed">
          초대 링크로 입장하거나 직접 사진을 추가하면 공유방이 시작되며, 개인 기기의 다른 파일과 섞이지 않습니다.
        </p>
        <div className="mt-1.5 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => useSaySeeStore.getState().requestAddMyPhotosToSharedRoom()}
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[12.5px] font-medium cursor-pointer transition-colors"
          >
            사진 올려서 공유방 시작하기
          </button>
          <button
            type="button"
            onClick={() => void handleOpenReceivedInvite()}
            className="px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[12.5px] font-medium cursor-pointer transition-colors"
          >
            초대 링크로 입장하기
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
              placeholder="전달받은 초대 링크나 문구를 붙여넣어 주세요"
              className="flex-1 px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 text-[12.5px] outline-none focus:border-slate-900"
            />
            <button
              type="submit"
              className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[12.5px] font-medium cursor-pointer shrink-0 transition-colors"
            >
              입장
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
