import React, { useState } from 'react';

export interface WorkLoungeBeforeAfterShowcaseProps {
  isStoreAppMode: boolean;
}

interface WorkBeforeAfterItem {
  stepBadge: string;
  title: string;
  beforeText: string;
  afterText: string;
}

export const WorkLoungeBeforeAfterShowcase: React.FC<WorkLoungeBeforeAfterShowcaseProps> = ({
  isStoreAppMode,
}) => {
  const [open, setOpen] = useState<boolean>(false);

  const items: WorkBeforeAfterItem[] = [
    {
      stepBadge: '사례 1',
      title: 'HWP·PDF·엑셀·스캔 사진 속 글자 1초 검색 & 우측 미리보기',
      beforeText:
        '“작년 부평구 견적서 어디 있지?” 폴더 4단계를 뒤져도 파일명을 모르면 못 찾고, 한글(HWP)·PDF·스캔 사진 속 글자는 탐색기에서 검색되지 않아 파일 수십 개를 일일이 열어봐야 합니다.',
      afterText:
        '“부평구 견적서”, “345,000원”처럼 기억나는 단어나 숫자만 입력하면 1초 만에 본문·표·스캔 글자까지 소환되며, 파일을 열지 않고도 우측 미리보기로 내용을 바로 확인합니다.',
    },
    {
      stepBadge: '사례 2',
      title: '신입 직원 클라우드 프로그램 설치 0 · 초대 링크 1번으로 S: 장착',
      beforeText:
        '신입 직원이 올 때마다 클라우드 계정을 안내하고 동기화 프로그램을 일일이 설치·로그인·폴더 지정해 주느라 반나절이 걸립니다.',
      afterText:
        '사내 메인 PC 1대에만 업무 폴더가 연결되어 있으면 직원 PC에는 별도 클라우드 프로그램을 설치할 필요 없이 초대 링크 1번으로 윈도우 탐색기 S: 드라이브가 즉시 연결됩니다.',
    },
    {
      stepBadge: '사례 3',
      title: '퇴사자 1초 내보내기 시 탐색기 S: 즉시 해제 & 로컬 캐시 자동 격리',
      beforeText:
        '퇴사한 직원 PC에 동기화된 회사 업무 파일이 그대로 남거나, 공유 폴더 권한 해지를 깜빡해 중요 문서 유출 걱정이 남습니다.',
      afterText:
        '관리자의 [내보내기] 버튼 1번으로 퇴사자 PC의 탐색기 S: 드라이브 연결이 즉시 해제되고, 초대 세션과 임시 캐시까지 자동으로 격리 차단됩니다.',
    },
    {
      stepBadge: '사례 4',
      title: '실시간 열람·편집 상태 배지 & 공유방 OS 휴지통 안전핀',
      beforeText:
        '두 직원이 같은 엑셀·한글 문서를 동시에 수정해 충돌 사본이 쌓이거나, 실수로 공용 폴더 문서를 지워 복구하지 못하는 사고가 발생합니다.',
      afterText:
        '누군가 문서를 열면 1초 안에 전 팀원 화면에 “현재 OOO님 열람 중” 배지가 표시되며, 삭제 시 영구 삭제 대신 윈도우 휴지통 이동 및 1초 실행 취소(Undo) 안전핀이 작동합니다.',
    },
    isStoreAppMode
      ? {
          stepBadge: '사례 5',
          title: '기존 클라우드 폴더 그대로 연결 ➔ 사내 PC 폴더 무중단 전환',
          beforeText:
            '기존 구글 드라이브·마이박스에 쓰던 업무 폴더를 사내 전용 드라이브 체계로 옮기려면 직원 전체가 업무를 멈추고 경로를 다시 잡아야 합니다.',
          afterText:
            '1단계 쓰던 클라우드 폴더 그대로 S:에 연결해 바로 사용 ➔ 2단계 사내 메인 PC 폴더(예: D:\\회사공유폴더)로 복사 후 [업무 폴더 변경] 1클릭 + 백업 PC 이중화로 직원 S: 중단 없이 매끄럽게 이관됩니다.',
        }
      : {
          stepBadge: '사례 5',
          title: '저항선 0% · 3단계 무중단 클라우드 월세 탈출 로드맵',
          beforeText:
            '직원 수만큼 구글 Workspace·클라우드 구독료가 매달 고정비로 빠져나가지만, 당장 옮기자니 업무가 멈출까 봐 엄두를 내지 못합니다.',
          afterText:
            '1단계 기존 구글 드라이브(G:)·마이박스 그대로 S: 연결(1~2주 적응) ➔ 2단계 내 PC 하드(D:\\회사공유폴더)로 복사 후 [업무 폴더 변경] 1클릭 + 백업 PC 미러링 ➔ 3단계 구글 유료 구독 해지(클라우드 월세 0원화 · 직원 S: 무중단 · .gsheet/.gdoc도 무료 15GB 공간에서 웹 정상 열람)!',
        },
  ];

  const toggleTitle = isStoreAppMode
    ? '💡 업무 공유 (S:) 5대 Before vs After 실전 활용 사례'
    : '💡 구글 드라이브 월세 탈출 & 5대 Before vs After 실전 사례';

  const subHint = isStoreAppMode
    ? '본문 1초 검색 · 신입 S: 즉시 장착 · 퇴사자 1초 격리 · 사내 폴더 무중단 전환'
    : '구글 드라이브 당장 끊지 마세요! 쓰던 폴더 그대로 S:에 꽂아 써보고 버튼 1번으로 내 PC로 옮기세요';

  return (
    <div
      data-testid="work-lounge-before-after-showcase"
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
        data-testid="work-lounge-before-after-toggle"
        className="px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-2.5 cursor-pointer hover:bg-slate-50/90 transition-colors"
      >
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="px-2 py-0.5 rounded-md bg-teal-600 text-white text-[11px] font-bold shrink-0">
            Before vs After
          </span>
          <span className="text-[13.5px] sm:text-[14.5px] font-extrabold text-slate-900 break-keep">
            {toggleTitle}
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
          {!isStoreAppMode && (
            <div className="p-3 rounded-xl bg-teal-50/90 border border-teal-200 text-[12.5px] text-teal-950 font-semibold leading-relaxed break-keep">
              💬 <strong>소기업·사무실 추천 도입 순서:</strong> 지금 쓰시는 구글 드라이브·마이박스 폴더를 당장 끊지 마시고 그대로 <strong>[업무 폴더 변경 (G: 연결)]</strong>에 꽂아 1초 본문 검색부터 경험해 보세요. 1~2주 뒤 내 PC 폴더로 복사하고 버튼 1번만 누르면 직원 PC의 <strong>S: 드라이브는 1초도 끊기지 않은 채 클라우드 고정비를 졸업</strong>할 수 있습니다.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {items.map((item, idx) => (
              <div
                key={item.stepBadge}
                className={`p-3.5 rounded-xl bg-white border border-slate-200 flex flex-col gap-2 ${
                  idx === items.length - 1 ? 'md:col-span-2' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-slate-900 text-white text-[10.5px] font-bold shrink-0">
                    {item.stepBadge}
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
