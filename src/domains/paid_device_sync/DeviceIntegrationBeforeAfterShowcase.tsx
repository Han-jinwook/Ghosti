import React, { useState } from 'react';

export interface DeviceIntegrationBeforeAfterShowcaseProps {
  isStoreAppMode: boolean;
}

interface DeviceBeforeAfterItem {
  stepBadge: string;
  persona: string;
  title: string;
  beforeText: string;
  afterText: string;
}

export const DeviceIntegrationBeforeAfterShowcase: React.FC<
  DeviceIntegrationBeforeAfterShowcaseProps
> = ({ isStoreAppMode }) => {
  const [open, setOpen] = useState<boolean>(false);

  const items: DeviceBeforeAfterItem[] = [
    {
      stepBadge: '사례 1',
      persona: '외근 · 영업 · 일상',
      title: "카톡 '나에게 보내기' 7단계 노가다 ➔ 글자·사진 무화면 1~2탭 PC 직송",
      beforeText:
        '폰에서 본 계좌번호·링크·현장 사진을 PC로 옮기려면 [공유] ➔ [카카오톡] ➔ [내 프로필] ➔ [전송] ➔ PC 카톡 열기 ➔ 사진 클릭 ➔ 다운로드/복사까지 최소 6~7단계를 거쳐야 하고 화질도 저하됩니다.',
      afterText:
        '안드로이드는 글자 드래그 ➔ [PC로 보내기] 1탭, 아이폰·사진은 [공유] ➔ [귀신같이] 2탭이면 끝! 귀신같이 앱 화면조차 열리지 않고 0.3초 만에 내 PC Ctrl+V에 원본 그대로 바로 꽂힙니다.',
    },
    {
      stepBadge: '사례 2',
      persona: '자영업 · 셀러 · 경리',
      title: '외출 중 거래처 전화 왔을 때 회사 PC · 클라우드 드라이브 문서 1초 소환',
      beforeText:
        '밖에서 거래처·세무사에게 “아까 그 견적서 금액 얼마였죠?”, “사업자등록증 보내주세요” 전화가 오면 사무실 PC 앞에 돌아갈 때까지 폴더를 확인할 방법이 없습니다.',
      afterText:
        '스마트폰에서 “견적서”, “사업자등록증” 단어 하나만 검색하면 사무실 PC 하드와 연결된 구글 드라이브(G:)·네이버 MYBOX·원드라이브 문서 본문까지 1초 만에 원격으로 찾아 바로 전달합니다.',
    },
    {
      stepBadge: '사례 3',
      persona: 'PC ➔ 스마트폰 전송',
      title: '평소 Ctrl+C 알림 폭탄 0건 ➔ 필요할 때만 [폰으로 보내기] 1탭 복사',
      beforeText:
        'PC에서 찾은 주소·링크·문구를 휴대폰으로 보내려다 보니 카톡 ‘나에게 보내기’ 대화창이 온갖 메모와 캡처로 뒤죽박죽 도배됩니다.',
      afterText:
        '평소 PC Ctrl+C는 7일 보관함에만 조용히 기록되고, 폰으로 보낼 때만 이 화면의 [📱 폰으로 보내기] 1클릭 ➔ 휴대폰 상단 알림의 [📋 복사] 1탭으로 앱을 열지 않고 카톡·문자에 바로 붙여넣습니다.',
    },
    isStoreAppMode
      ? {
          stepBadge: '사례 4',
          persona: '사진 용량 정리 · 다중 PC 연동',
          title: '스마트폰 용량은 가볍게 비우고 내 PC 원본 자동 보관 & 상용구 동기화',
          beforeText:
            '스마트폰 사진·영상이 수만 장 쌓여 저장 공간 부족 알림이 계속 뜨고, 집 PC와 회사 PC에서 자주 쓰는 계좌·주소 상용구를 매번 따로 입력해야 합니다.',
          afterText:
            '원본 사진은 내 PC 전용 백업 폴더에 계정별로 안전하게 자동 보관하고 스마트폰에는 13KB 초경량 미리보기만 남겨 언제든 1초 검색하며, 집컴·회사컴·노트북 F1~F6 상용구와 클립보드가 하나로 이어집니다.',
        }
      : {
          stepBadge: '사례 4',
          persona: '클라우드 월세 절감 · 다중 PC',
          title: '매달 나가는 사진 클라우드 월세 0원화 & 집컴·회사컴 무버튼 직결',
          beforeText:
            '휴대폰 사진 용량이 꽉 차 매달 클라우드 용량 구독료를 내면서도, 정작 집 PC와 회사 PC 사이에서 글자·상용구를 옮길 때는 매번 메일이나 메신저를 열어야 합니다.',
          afterText:
            '원본 사진은 내 PC 하드에 추가 월세 0원으로 무제한 백업하고 스마트폰은 가볍게 비우며, 집 PC ↔ 회사 PC ↔ 노트북끼리는 버튼조차 누를 필요 없이 Ctrl+C ➔ Ctrl+V와 F1~F6 상용구가 실시간 직결됩니다.',
        },
  ];

  const subHint = isStoreAppMode
    ? '폰➔PC 무화면 2탭 직송 · 회사 PC 문서 1초 소환 · PC➔폰 알림 1탭 복사'
    : "카톡 '나에게 보내기' 없이 폰·집컴·회사컴이 하나로 이어지는 실전 변화";

  return (
    <div
      data-testid="device-integration-before-after-showcase"
      className="rounded-2xl bg-white border border-slate-200 shadow-xs overflow-hidden"
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((prev) => !prev);
          }
        }}
        data-testid="device-integration-before-after-toggle"
        className="px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-2.5 cursor-pointer hover:bg-slate-50/90 transition-colors select-none"
      >
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="px-2 py-0.5 rounded-md bg-teal-600 text-white text-[11px] font-bold shrink-0">
            Before vs After
          </span>
          <span className="text-[13.5px] sm:text-[14.5px] font-extrabold text-slate-900 break-keep">
            💡 이런 순간, 이렇게 달라집니다 (Before vs After)
          </span>
          <span className="hidden lg:inline text-[12px] text-slate-500 truncate">
            — {subHint}
          </span>
        </div>
        <span
          className={`px-3 py-1 rounded-lg text-[12px] font-bold border transition-colors shrink-0 ${
            open
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-teal-50 text-teal-900 border-teal-200'
          }`}
        >
          {open ? '사례 접기 ▴' : '실전 사례 펼쳐보기 ▾'}
        </span>
      </div>

      {open && (
        <div className="px-4 sm:px-5 pb-4 pt-3 border-t border-slate-200 bg-slate-50/70 flex flex-col gap-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {items.map((item) => (
              <div
                key={item.stepBadge}
                className="p-3.5 rounded-xl bg-white border border-slate-200 flex flex-col gap-2"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded bg-slate-900 text-white text-[10.5px] font-bold shrink-0">
                    {item.stepBadge}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200 text-[10.5px] font-semibold shrink-0">
                    {item.persona}
                  </span>
                  <h4 className="text-[13.5px] font-bold text-slate-900 break-keep">
                    {item.title}
                  </h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12px] leading-relaxed">
                  <div className="p-2.5 rounded-lg bg-rose-50/70 border border-rose-200/80 text-rose-950 break-keep">
                    <span className="font-extrabold text-rose-700">❌ 기존 불편함: </span>
                    {item.beforeText}
                  </div>
                  <div className="p-2.5 rounded-lg bg-emerald-50/75 border border-emerald-200/90 text-emerald-950 break-keep">
                    <span className="font-extrabold text-emerald-700">⭕ 도입 후 변화: </span>
                    {item.afterText}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
