import React, { useState } from 'react';
import type { FamilyRoomId, LoungeType } from '../../types/saysee';
import { useSaySeeStore } from '../../store/useSaySeeStore';
import { playBabyGhostChime } from '../../components/OnboardingModal';

const SAMPLE_FAMILY_PHOTOS: string[] = [
  '1721441387443.jpg', '1721441536389.jpg', '1721636228992.jpg',
  '20240719_105510.jpg', '20240719_112207_080.jpg', '20240719_113139_006.jpg', '20240719_114640.jpg',
  '20240719_125448.jpg', '20240719_182503.jpg', '20240720_111405.jpg', '20240720_114310_073.jpg',
  '20240720_122940.jpg', '20240720_134949.jpg', '20240720_141110.jpg', '20240720_180506.jpg',
  '20240720_182145.jpg', '20240720_182931.jpg', '20240720_184012.jpg', '20240720_194823.jpg',
  '20240720_211702.jpg', '20240721_114134.jpg', '20240721_123014.jpg', '20240721_160251.jpg',
  '20240721_183234.jpg', '20240721_183540.jpg',
  '20260525_193249.jpg', '20260525_193442.jpg', '20260613_201138.jpg', '20260815_172840.jpg',
  '20260815_180439.jpg', '20260829_203811.jpg', '20260924_145618.jpg', '20260926_131113.jpg',
  '20260926_131159.jpg', '20260926_131225.jpg', '20260926_160221.jpg',
];

const SAMPLE_FAMILY_GROUPS: { key: 'summer2024' | 'outing2026'; label: string; photos: string[] }[] = [
  {
    key: 'summer2024',
    label: '📅 2024년 7월 여름 여행 예시',
    photos: SAMPLE_FAMILY_PHOTOS.filter((p) => !p.startsWith('2026')),
  },
  {
    key: 'outing2026',
    label: '📅 2026년 나들이 예시',
    photos: SAMPLE_FAMILY_PHOTOS.filter((p) => p.startsWith('2026')),
  },
];

const SAMPLE_FAMILY_THUMB_BASE = '/shared_family_host_thumbs/';

export const SampleSharedRoomExperienceCard: React.FC<{
  loungeType: LoungeType;
  familyRoom: FamilyRoomId;
}> = ({ loungeType, familyRoom }) => {
  const [shareStep, setShareStep] = useState<0 | 1 | 2>(0);
  const [shareGroupKey, setShareGroupKey] = useState<'summer2024' | 'outing2026'>('summer2024');
  const [sharePickedPhoto, setSharePickedPhoto] = useState<string | null>(null);

  const roomTypeKo =
    loungeType === 'club'
      ? '동호회·모임'
      : loungeType === 'student'
      ? '동창회'
      : `${familyRoom} 가족`;

  const group = SAMPLE_FAMILY_GROUPS.find((g) => g.key === shareGroupKey) || SAMPLE_FAMILY_GROUPS[0];
  const katalkSample = SAMPLE_FAMILY_PHOTOS.slice(9, 12);

  return (
    <div className="flex flex-col gap-4">
      {/* 1) 실제 참여 중인 공유방은 0장(빈 방)임을 명확히 고지 */}
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

      {/* 2) 온보딩 검증 스토리텔링: [샘플 체험] 카톡 만료 공감 ➔ 초대 링크 입장 ➔ 원본 비교 */}
      <div
        data-keep-dark="true"
        style={{ background: 'linear-gradient(145deg, #071523 0%, #0B1D2E 100%)' }}
        className="rounded-2xl border border-sky-400/40 p-4 sm:p-6 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-zinc-950 text-[11px] font-black">
              예시 샘플 체험
            </span>
            <span className="text-[13px] sm:text-[14px] font-black text-sky-200 break-keep">
              🏠 공유방이 어떻게 작동하는지 샘플로 미리 체험해 보세요!
            </span>
          </div>
          <span className="text-[11.5px] text-sky-300/80 font-bold">
            ※ 이해를 돕기 위한 공식 샘플 예시 화면입니다
          </span>
        </div>

        {shareStep === 0 && (
          <div className="space-y-3">
            <div
              style={{ backgroundColor: '#B2C7D9' }}
              data-keep-dark="true"
              className="rounded-2xl p-3.5 sm:p-4 space-y-2.5"
            >
              <div className="text-xs font-black text-slate-800">
                💬 단톡방 · 32일 전에 올린 모임·여행 사진
              </div>
              <div className="grid grid-cols-3 gap-2">
                {katalkSample.map((p) => (
                  <div
                    key={p}
                    className="relative aspect-[4/3] sm:aspect-square rounded-lg overflow-hidden bg-slate-300"
                  >
                    <img
                      src={`${SAMPLE_FAMILY_THUMB_BASE}${p}`}
                      alt="만료된 예시 사진"
                      className="w-full h-full object-cover blur-md grayscale opacity-60"
                    />
                    <div className="absolute inset-0 flex items-center justify-center p-1.5 text-center">
                      <span className="text-[10.5px] sm:text-[11px] font-black text-slate-900 bg-white/90 rounded px-1.5 py-0.5 leading-tight break-keep">
                        보관 기간이 만료된 사진
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-xs font-bold text-slate-800 break-keep">
                😢 겨우 받은 사진도 화질 압축 (원본 4.8MB → 0.4MB) · 30일 지나면 영구 만료
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                try {
                  playBabyGhostChime();
                } catch {
                  /* ignore */
                }
                setShareStep(1);
              }}
              data-keep-dark="true"
              style={{ backgroundColor: '#38BDF8', color: '#020617' }}
              className="w-full px-4 py-3 rounded-xl font-black text-sm cursor-pointer shadow-lg hover:opacity-90"
            >
              🔗 예시 초대 링크 눌러서 샘플 공유방 구경해보기 (고화질 샘플 36장)
            </button>
          </div>
        )}

        {shareStep >= 1 && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {SAMPLE_FAMILY_GROUPS.map((g) => {
                  const on = g.key === shareGroupKey;
                  return (
                    <button
                      key={g.key}
                      type="button"
                      onClick={() => {
                        setShareGroupKey(g.key);
                        setSharePickedPhoto(null);
                        setShareStep(1);
                      }}
                      style={
                        on
                          ? { backgroundColor: '#0EA5E9', color: '#FFFFFF' }
                          : { backgroundColor: 'rgba(255,255,255,0.08)', color: '#CBD5E1' }
                      }
                      className={`px-3 py-1.5 rounded-xl text-[12px] sm:text-[13px] font-black border transition-all cursor-pointer break-keep ${
                        on ? 'border-sky-400 shadow-md' : 'border-white/15 hover:border-sky-400/50'
                      }`}
                    >
                      {g.label} ({g.photos.length}장)
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSharePickedPhoto(null);
                  setShareStep(0);
                }}
                className="text-xs text-zinc-300 hover:text-white underline font-bold cursor-pointer"
              >
                샘플 접기 ▴
              </button>
            </div>

            {shareStep === 1 && (
              <>
                <div className="text-[12.5px] sm:text-[13px] font-bold text-sky-100 break-keep">
                  👇 초대 링크 하나로 가입 없이 바로 열렸어요! 마음에 드는 샘플 사진을 눌러 선명한 화질을 확인해 보세요.
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-[340px] overflow-y-auto pr-1">
                  {group.photos.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setSharePickedPhoto(p);
                        setShareStep(2);
                      }}
                      className="relative aspect-[4/3] sm:aspect-square rounded-xl overflow-hidden border border-white/15 hover:border-sky-400 transition-all cursor-pointer"
                    >
                      <img
                        src={`${SAMPLE_FAMILY_THUMB_BASE}${p}`}
                        alt="샘플 공유방 사진"
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-amber-400/95 text-zinc-950 text-[9.5px] font-black">
                        예시 샘플
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {shareStep === 2 && sharePickedPhoto && (
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-start">
                <div className="sm:col-span-6 space-y-2">
                  <div className="relative rounded-xl overflow-hidden border-2 border-sky-400">
                    <img
                      src={`${SAMPLE_FAMILY_THUMB_BASE}${sharePickedPhoto}`}
                      alt="선택한 샘플 사진"
                      className="w-full h-auto object-cover"
                    />
                    <span
                      style={{ backgroundColor: '#FBBF24', color: '#020617' }}
                      className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-xs font-black"
                    >
                      ✨ 예시 샘플 · 선명한 공유 화질
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSharePickedPhoto(null);
                      setShareStep(1);
                    }}
                    className="text-xs text-sky-300 hover:text-white underline font-bold cursor-pointer"
                  >
                    ← 다른 샘플 사진 고르기
                  </button>
                </div>
                <div className="sm:col-span-6 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2 text-[12px] sm:text-[13px] break-keep">
                    <div
                      style={{ backgroundColor: 'rgba(244,63,94,0.12)' }}
                      className="rounded-xl p-3 border border-rose-400/30 space-y-1"
                    >
                      <div className="font-black text-rose-300">💬 일반 단톡방</div>
                      <div className="text-zinc-300 font-semibold leading-relaxed">
                        화질 심하게 압축
                        <br />
                        30일 지나면 만료
                        <br />
                        지난 사진 찾기 어려움
                      </div>
                    </div>
                    <div
                      style={{ backgroundColor: 'rgba(14,165,233,0.14)' }}
                      className="rounded-xl p-3 border border-sky-400/40 space-y-1"
                    >
                      <div className="font-black text-sky-300">👻 귀신같이 공유방</div>
                      <div className="text-zinc-100 font-bold leading-relaxed">
                        원본 화질 그대로
                        <br />
                        만료 없이 평생 0원
                        <br />
                        인물·날짜 1초 검색
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
