import React from 'react';
import type { FamilyRoomId, LoungeType } from '../../types/saysee';
import { useSaySeeStore } from '../../store/useSaySeeStore';

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
  const roomTypeKo =
    loungeType === 'club'
      ? '동호회·모임'
      : loungeType === 'student'
      ? '동창회'
      : `${familyRoom} 가족`;

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
        <button
          type="button"
          onClick={() => useSaySeeStore.getState().requestAddMyPhotosToSharedRoom()}
          className="mt-1 px-4 py-2.5 rounded-xl bg-[#2DD4BF] hover:bg-[#5EEAD4] text-zinc-950 font-label-sm text-[12.5px] font-black cursor-pointer shadow-md"
        >
          📸 내 사진 올려서 {roomTypeKo} 공유방 시작하기
        </button>
      </div>
    </div>
  );
};
