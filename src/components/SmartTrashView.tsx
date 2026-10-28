import React, { useState } from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';
import type { PhotoItem, TrashCategory } from '../types/saysee';
import {
  processUnifiedMonsterChatQuery,
  loadLocalHealthCheckHistory,
  executeRestorePointRollback,
  type MonsterChatMessage,
  type MonsterLiteracyLevel,
  type DigitalHealthCheckRecord,
} from '../services/monsterChatRouter';
import {
  MonsterInteractiveCardView,
  PersonalHealthCheckHistoryDrawer,
} from './MonsterInteractiveCards';

const TRASH_TABS: {
  key: 'duplicate' | 'memo' | 'screenshot' | 'blurry';
  stepNum: string;
  title: string;
  shortTitle: string;
  shortBadge: string;
  cleanTag: string;
  subtitle: string;
  icon: string;
}[] = [
  {
    key: 'duplicate',
    stepNum: '①',
    title: '동일 내용 중복(최고화질 보존) · 연사(1장 직접 선택)',
    shortTitle: '중복 · 연사 선택',
    shortBadge: '중복·연사 선택',
    cleanTag: '#중복·연사사본',
    subtitle: '중복 사진은 최고화질 원본 1장만 남기고, 연사는 펼쳐 보고 마음에 드는 1장을 직접 선택(Pick)합니다',
    icon: 'burst_mode',
  },
  {
    key: 'memo',
    stepNum: '②',
    title: '주차장 · 영수증 · 일회성 사물 메모',
    shortTitle: '주차 · 영수증 · 메모',
    shortBadge: '주차·사물·일회성메모',
    cleanTag: '#주차·부품·일회성메모',
    subtitle: '주차장 기둥(K13) · 케이블/부품 접사 · 단기 택배/현수막 메모',
    icon: 'description',
  },
  {
    key: 'screenshot',
    stepNum: '③',
    title: '스크린샷 · 불필요 캡처',
    shortTitle: '스크린샷 · 캡처',
    shortBadge: '스크린샷 캡처',
    cleanTag: '#스크린샷 캡처',
    subtitle: '문자 메시지 캡처 · 모바일 홈 화면 · 일회성 앱 알림 화면 캡처',
    icon: 'screenshot_mobile',
  },
  {
    key: 'blurry',
    stepNum: '④',
    title: '심한 흔들림 · 바닥 오촬영',
    shortTitle: '흔들림 · 오촬영',
    shortBadge: '흔들림·오촬영',
    cleanTag: '#초점이탈·오촬영',
    subtitle: '보행 중 바닥 오촬영 및 초점 완전 붕괴 불량 사진',
    icon: 'blur_on',
  },
];

const fmtMB = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

function matchesTrashTab(photo: PhotoItem, tabKey: string): boolean {
  if (!photo.trashCategory || photo.quarantined) return false;
  if (tabKey === 'all') return true;
  if (tabKey === 'memo') {
    return (
      photo.trashCategory === 'memo' ||
      photo.trashCategory === 'object' ||
      photo.trashCategory === 'document' ||
      photo.trashCategory === 'receipt'
    );
  }
  return photo.trashCategory === tabKey;
}

export const SmartTrashView: React.FC = () => {
  const {
    layout,
    photos,
    duplicateGroups,
    selectedTrashIds,
    activeTrashCategoryFilter,
    setActiveTrashCategoryFilter,
    toggleTrashSelection,
    selectAllTrashInFilter,
    clearTrashSelection,
    pickBestInDuplicateGroup,
    moveSelectedToQuarantine,
    moveAllTrashToQuarantine,
    restoreFromQuarantine,
    openLocalFolder,
    quarantineMoving,
    setSelectedPhoto,
    lastUndoBatch,
    undoLastQuarantine,
    dismissUndoBatch,
    setDesktopTab,
    setMobileTab,
    setSearchSpace,
    runTextQuery,
    isStoreAppMode,
  } = useSaySeeStore();

  const [gridColumns, setGridColumns] = useState<3 | 4>(3);
  const [showSystemConsult, setShowSystemConsult] = useState<boolean>(true);
  const [showQuarantineDrawer, setShowQuarantineDrawer] = useState<boolean>(true);
  const [isTrashBinTabActive, setIsTrashBinTabActive] = useState<boolean>(false);
  const [showHealthHistoryDrawer, setShowHealthHistoryDrawer] = useState<boolean>(false);
  const [healthHistoryRecords, setHealthHistoryRecords] = useState<DigitalHealthCheckRecord[]>(() =>
    loadLocalHealthCheckHistory()
  );
  const [literacyLevel, setLiteracyLevel] = useState<MonsterLiteracyLevel>('normal');
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(true);
  const [monsterMessages, setMonsterMessages] = useState<MonsterChatMessage[]>([]);
  const [monsterBusy, setMonsterBusy] = useState<boolean>(false);

  // 클린몬스터 종합건강검진 항목별 유저 직접 결정 상태 (노인 별도 안 없이 기본 귀신같이 직관 기능 통합)
  const [decisions, setDecisions] = useState<{
    downloadInstallers: 'pending' | 'clean_installers' | 'keep';
    pcDesktop: 'pending' | 'archive_move' | 'keep';
    powerDrain: 'pending' | 'freeze_remove' | 'keep';
  }>({
    downloadInstallers: 'pending',
    pcDesktop: 'pending',
    powerDrain: 'pending',
  });
  const [doctorChatInput, setDoctorChatInput] = useState('');
  const [doctorChatReply, setDoctorChatReply] = useState<string>(
    '💬 클린몬스터 × 설정몬스터 통합 주치의 (언제나 0원): "임의로 파일을 영구 삭제하지 않습니다. 바탕화면·다운로드 정리, 방치 설치파일(.exe/.apk) 청소, 보안모듈 동결, 자주 가는 사이트 바로가기 만들기, 사라진 파일 1초 복구까지 채팅창에 편하게 말씀해 주세요!"'
  );

  const triggerMonsterQuery = async (rawQuery: string) => {
    const q = rawQuery.trim();
    if (!q) return;
    const nowLabel = new Date().toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const userMsg: MonsterChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      timestamp: nowLabel,
      text: q,
      sourceTab: 'trash',
    };
    setMonsterMessages((prev) => [...prev, userMsg]);
    setMonsterBusy(true);
    const aiMsg = await processUnifiedMonsterChatQuery({
      query: q,
      sourceTab: 'trash',
      literacyLevel,
      ttsEnabled,
    });
    setMonsterBusy(false);
    setDoctorChatReply(aiMsg.text);
    setMonsterMessages((prev) => [...prev, aiMsg]);
  };

  const handleAskDoctor = (e: React.FormEvent) => {
    e.preventDefault();
    const q = doctorChatInput.trim();
    if (!q) return;
    setDoctorChatInput('');
    void triggerMonsterQuery(q);
  };

  const activeTrash = photos.filter((p) => p.trashCategory && !p.quarantined);
  const quarantinedPhotos = photos.filter((p) => p.quarantined);
  const totalTrashBytes = activeTrash.reduce((a, p) => a + p.size, 0);

  const dupCount = activeTrash.filter((p) => matchesTrashTab(p, 'duplicate')).length;
  const memoCount = activeTrash.filter((p) => matchesTrashTab(p, 'memo')).length;
  const screenshotCount = activeTrash.filter((p) => matchesTrashTab(p, 'screenshot')).length;
  const blurryCount = activeTrash.filter((p) => matchesTrashTab(p, 'blurry')).length;
  const memoAndScreenCount = memoCount + screenshotCount;

  // 처치 완료 시 예상 반응 속도 향상률(%) 계산
  const expectedSpeedBoostPct = Math.max(14, Math.min(38, Math.round(12 + activeTrash.length * 0.72)));
  const currentHealthScore = Math.max(68, 98 - activeTrash.length);

  const decidedCount = [
    decisions.downloadInstallers,
    decisions.pcDesktop,
    decisions.powerDrain,
  ].filter((v) => v !== 'pending').length;

  const currentTab =
    activeTrashCategoryFilter === 'object' ||
    activeTrashCategoryFilter === 'document' ||
    activeTrashCategoryFilter === 'receipt'
      ? 'memo'
      : activeTrashCategoryFilter;

  const filteredCandidates = activeTrash.filter((p) => matchesTrashTab(p, currentTab));

  const selectedBytes = activeTrash
    .filter((p) => selectedTrashIds.has(p.id))
    .reduce((a, p) => a + p.size, 0);

  const photoById = new Map(photos.map((p) => [p.id, p]));

  // 아직 격리되지 않은 사본이 남아 있는 중복/연사 클러스터만 바둑판 비교 뷰에 표시
  const activeDuplicateGroups = duplicateGroups.filter((g) =>
    g.photoIds.some((id) => {
      const ph = photoById.get(id);
      return ph && !ph.quarantined && id !== g.bestPhotoId;
    })
  );

  const showDuplicatePickSection =
    !isTrashBinTabActive &&
    (currentTab === 'duplicate' || currentTab === 'all') &&
    activeDuplicateGroups.length > 0;

  return (
    <div className="w-full max-w-[1320px] mx-auto px-4 sm:px-6 md:px-10 py-6 flex flex-col gap-5 pb-24">
      {/* ─────────────── 1. 노션 스타일 페이지 헤더 & 원클릭 정리 컨트롤 바 ─────────────── */}
      <section className="p-5 md:p-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-headline-sm text-[20px] md:text-[22px] text-zinc-900 dark:text-white font-extrabold tracking-tight flex items-center gap-2">
                  <span>🩺 귀신같이 클린몬스터</span>
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-extrabold">
                  🆓 내 기기 치우기 · 언제나 0원
                </span>
              </div>
              <span className="text-[12.5px] text-zinc-500 dark:text-zinc-400 font-medium">
                임의 영구 삭제 0% · OS 기본 [휴지통] 직행 &amp; [복원 기록] 3단계 사전 검진 후 1초 원상복구 보장
              </span>
            </div>

            <div className="pt-1 font-headline-md text-[17px] md:text-[19px] text-zinc-900 dark:text-white font-extrabold tracking-tight leading-snug">
              {activeTrash.length > 0 ? (
                <>
                  정리 후보 <span className="text-primary-container">{activeTrash.length}장</span>{' '}
                  <span className="text-zinc-500 dark:text-zinc-400 font-normal text-[14.5px]">
                    ({fmtMB(totalTrashBytes)})
                  </span>{' '}
                  — 중복·연사 <span className="text-zinc-900 dark:text-white">{dupCount}장</span> · 메모·캡처{' '}
                  <span className="text-zinc-900 dark:text-white">{memoAndScreenCount}장</span> · 흔들림{' '}
                  <span className="text-zinc-900 dark:text-white">{blurryCount}장</span>
                </>
              ) : (
                <span className="text-primary-container">
                  ✨ 모든 중복·연사 사본({quarantinedPhotos.length}장) 정리가 완료되어 가장 쾌적한 상태입니다
                </span>
              )}
            </div>

            <p className="font-body-sm text-[12.5px] text-zinc-500 dark:text-zinc-400">
              동일 내용 중복 사진은 최고화질 원본 1장만 남기고, 연사는 마음에 드는 1장을 직접 선택(Pick)해 나머지를 정리합니다.
            </p>
          </div>

          {/* 우측: 속도 상태 요약 & 일괄 정리 액션 */}
          <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
            <div className="px-3.5 py-2 rounded-xl bg-zinc-950/90 border border-white/10 flex items-center gap-3">
              <div className="flex flex-col">
                <span className="text-[11px] text-zinc-400 font-medium">탐색 반응 속도</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-label-mono text-[12.5px] text-white font-bold">
                    {currentHealthScore}점
                  </span>
                  <span className="text-zinc-500 text-[11px]">→</span>
                  <span className="font-label-mono text-[12px] text-primary-container font-extrabold">
                    {activeTrash.length > 0 ? `+${expectedSpeedBoostPct}% 향상` : '98점 쾌적'}
                  </span>
                </div>
              </div>
              <div className="w-16 h-2 rounded-full bg-zinc-900 overflow-hidden flex border border-white/10">
                <div
                  style={{ width: `${currentHealthScore}%` }}
                  className="h-full bg-primary-container transition-all duration-500"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowHealthHistoryDrawer((v) => !v)}
                className="px-3 py-2.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900/80 border border-emerald-500/40 text-emerald-300 font-label-sm text-[12px] font-extrabold transition-colors cursor-pointer whitespace-nowrap"
              >
                📋 내 기기 건강검진 기록함 ({healthHistoryRecords.length})
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowSystemConsult(true);
                  void triggerMonsterQuery('최근 [복원 기록] 보여줘');
                }}
                className="px-3 py-2.5 rounded-xl bg-violet-950/80 hover:bg-violet-900/80 border border-violet-500/40 text-violet-300 font-label-sm text-[12px] font-extrabold transition-colors cursor-pointer whitespace-nowrap"
              >
                🕰️ [복원 기록] 타임머신
              </button>

              <button
                type="button"
                onClick={() => {
                  setSearchSpace('vault');
                  if (layout === 'mobile') setMobileTab('search');
                  else setDesktopTab('dashboard');
                }}
                className="px-3 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 hover:text-white font-label-sm text-[12px] font-bold transition-colors cursor-pointer whitespace-nowrap"
              >
                📁 서류함 분리 확인
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsTrashBinTabActive(true);
                  setShowQuarantineDrawer(true);
                }}
                className={`px-3 py-2.5 rounded-xl border font-label-sm text-[12px] font-bold cursor-pointer whitespace-nowrap transition-all ${
                  isTrashBinTabActive
                    ? 'bg-primary-container text-zinc-950 border-primary-container font-extrabold'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-white/10'
                }`}
              >
                🗑️ 휴지통 보관함 ({quarantinedPhotos.length}장)
              </button>

              <button
                type="button"
                disabled={activeTrash.length === 0 || quarantineMoving}
                onClick={() => void moveAllTrashToQuarantine()}
                className="px-4 py-2.5 rounded-xl bg-primary-container hover:opacity-95 text-zinc-950 font-label-md text-[12.5px] font-extrabold flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer whitespace-nowrap"
              >
                <span>⚡ 원본 남기고 {activeTrash.length}장 일괄 처치</span>
              </button>
            </div>
          </div>
        </div>

        {showHealthHistoryDrawer && (
          <PersonalHealthCheckHistoryDrawer
            records={healthHistoryRecords}
            onClose={() => setShowHealthHistoryDrawer(false)}
            onRollbackRestoreId={(rid) => {
              void executeRestorePointRollback(rid).then((res) => {
                setDoctorChatReply(res.message);
              });
            }}
          />
        )}

        {/* 인라인 1초 되돌리기(Undo) 알림 콜아웃 */}
        {lastUndoBatch && (
          <div className="p-3.5 rounded-xl bg-zinc-900 border border-primary-container/60 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-primary-container text-[20px]">
                history
              </span>
              <span className="font-label-md text-[13px] text-zinc-100 font-semibold">
                방금 정리한 {lastUndoBatch.count}장 ({fmtMB(lastUndoBatch.savedBytes)})이 OS 기본 [휴지통]으로 안전하게 이동되었습니다.
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void undoLastQuarantine()}
                className="px-3.5 py-1.5 rounded-lg bg-primary-container text-zinc-950 font-label-sm text-[12px] font-extrabold transition-all cursor-pointer"
              >
                ↩️ 1초 즉시 되돌리기 (Undo)
              </button>
              <button
                type="button"
                onClick={dismissUndoBatch}
                className="p-1 text-zinc-400 hover:text-white cursor-pointer"
                title="닫기"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ─────────────── 2. 노션 토글형 기기 종합건강검진 & 1:1 대화형 컨설팅 (접기/펼치기 동적 반응) ─────────────── */}
      <section className="rounded-2xl bg-[#18181B] border border-white/10 overflow-hidden transition-all">
        <div
          onClick={() => setShowSystemConsult((v) => !v)}
          className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-2 cursor-pointer hover:bg-zinc-900/60 transition-colors select-none"
        >
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[12px] text-amber-400 font-bold">
              {showSystemConsult ? '▾' : '▸'} 💬 기기 종합검진 &amp; 대화형 맞춤 정리 (치우기 × 고치기 통합 주치의)
            </span>
            <span className="text-[12.5px] text-zinc-500 dark:text-zinc-400 font-medium">
              다운로드 설치파일(.exe/.apk) · PC 바탕화면 · 상주 보안모듈 · 사이트 바로가기 · 사라진 파일 복구까지 대화로 해결하세요
            </span>
            {decidedCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-primary-container/15 text-primary-container text-[11px] font-extrabold">
                ✓ {decidedCount}/3 항목 선택됨
              </span>
            )}
          </div>
          <span className="px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-100 text-[13px] font-extrabold select-none shadow-sm cursor-pointer transition-all">
            {showSystemConsult ? '접기 ▴' : '검진 항목 펼치기 ▾'}
          </span>
        </div>

        {showSystemConsult && (
          <div className="px-5 pb-5 pt-2 border-t border-white/10 flex flex-col gap-3.5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* ① 다운로드 폴더 방치 설치파일(.exe/.apk/.msi) & 중복 압축파일 청소 */}
              <div className="p-4 rounded-xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-white/10 shadow-sm flex flex-col justify-between gap-3">
                <div className="flex flex-col gap-1.5">
                  <span className="font-headline-sm text-[15px] text-zinc-900 dark:text-white font-extrabold tracking-wide">
                    📦 다운로드 방치 설치파일(.exe·.apk) 정리
                  </span>
                  <p className="font-body-sm text-[12.5px] text-zinc-600 dark:text-zinc-300 font-medium leading-relaxed">
                    이미 설치가 끝난 구버전 설치파일(<code>.exe</code>, <code>.msi</code>, <code>.apk</code>)과 중복 압축 사본을 미리 확인하고 정리합니다.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      setDecisions((d) => ({ ...d, downloadInstallers: 'clean_installers' }));
                      void triggerMonsterQuery('다운로드 폴더 방치된 설치파일(.exe/.apk) 미리보고 정리해 줘');
                    }}
                    className={`px-2.5 py-1.5 rounded-lg font-label-sm text-[11.5px] font-bold transition-all cursor-pointer ${
                      decisions.downloadInstallers === 'clean_installers'
                        ? 'bg-primary-container text-zinc-950 font-extrabold'
                        : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-white/10'
                    }`}
                  >
                    {decisions.downloadInstallers === 'clean_installers'
                      ? '✓ 설치파일 정리 미리보기 열림'
                      : '📦 설치파일·중복사본 미리보고 정리'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecisions((d) => ({ ...d, downloadInstallers: 'keep' }))}
                    className={`px-2.5 py-1.5 rounded-lg font-label-sm text-[11.5px] font-bold transition-all cursor-pointer ${
                      decisions.downloadInstallers === 'keep'
                        ? 'bg-zinc-700 text-white font-extrabold'
                        : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-white/10'
                    }`}
                  >
                    그대로 두기
                  </button>
                </div>
              </div>

              {/* ② PC 바탕화면 중복파일 & 바로가기(.lnk) 뒤섞임 정리 */}
              <div className="p-4 rounded-xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-white/10 shadow-sm flex flex-col justify-between gap-3">
                <div className="flex flex-col gap-1.5">
                  <span className="font-headline-sm text-[15px] text-zinc-900 dark:text-white font-extrabold tracking-wide">
                    💻 PC 바탕화면 잡파일 · 구형 폴더 정리
                  </span>
                  <p className="font-body-sm text-[12.5px] text-zinc-600 dark:text-zinc-300 font-medium leading-relaxed">
                    바탕화면에 업무와 무관한 잡파일과 옛날 폴더가 뒤섞여 있습니다. 핵심 아이콘만 남기고 안전 정리함으로 모을까요?
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      setDecisions((d) => ({ ...d, pcDesktop: 'archive_move' }));
                      void triggerMonsterQuery(
                        "바탕화면이랑 다운로드 폴더에서 잡파일은 '기타_정리함'으로 모으고 옛날 폴더는 숨겨줘"
                      );
                    }}
                    className={`px-2.5 py-1.5 rounded-lg font-label-sm text-[11.5px] font-bold transition-all cursor-pointer ${
                      decisions.pcDesktop === 'archive_move'
                        ? 'bg-primary-container text-zinc-950 font-extrabold'
                        : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-white/10'
                    }`}
                  >
                    {decisions.pcDesktop === 'archive_move'
                      ? '✓ 바탕화면 정리 미리보기 열림'
                      : '🗂️ 잡파일 이동 · 옛날폴더 숨김'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecisions((d) => ({ ...d, pcDesktop: 'keep' }))}
                    className={`px-2.5 py-1.5 rounded-lg font-label-sm text-[11.5px] font-bold transition-all cursor-pointer ${
                      decisions.pcDesktop === 'keep'
                        ? 'bg-zinc-700 text-white font-extrabold'
                        : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-white/10'
                    }`}
                  >
                    그대로 두기
                  </button>
                </div>
              </div>

              {/* ③ 전기·메모리 먹는 상주 보안모듈 동결 */}
              <div className="p-4 rounded-xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-white/10 shadow-sm flex flex-col justify-between gap-3">
                <div className="flex flex-col gap-1.5">
                  <span className="font-headline-sm text-[15px] text-zinc-900 dark:text-white font-extrabold tracking-wide">
                    {isStoreAppMode
                      ? '⚡ 원본 PC 이관 & 13KB 섀도우 다이어트'
                      : '⚡ 은행·관공서 상주 보안모듈 동결'}
                  </span>
                  <p className="font-body-sm text-[12.5px] text-zinc-600 dark:text-zinc-300 font-medium leading-relaxed">
                    {isStoreAppMode
                      ? '대용량 4K 영상과 원본을 내 PC로 안전 이관하고 폰에는 13KB 초경량 캐시만 남겨 저장공간을 확보할까요?'
                      : '은행·관공서 상주 보안모듈(AnySign, MagicLine, Veraport, TouchEn)이 메모리를 점유 중입니다. 안전 동결할까요?'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      setDecisions((d) => ({ ...d, powerDrain: 'freeze_remove' }));
                      void triggerMonsterQuery(
                        '은행 관공서 상주 보안 프로그램(AnySign, MagicLine, TouchEn) 동결해서 부팅 속도 높여줘'
                      );
                    }}
                    className={`px-2.5 py-1.5 rounded-lg font-label-sm text-[11.5px] font-bold transition-all cursor-pointer ${
                      decisions.powerDrain === 'freeze_remove'
                        ? 'bg-primary-container text-zinc-950 font-extrabold'
                        : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-white/10'
                    }`}
                  >
                    {decisions.powerDrain === 'freeze_remove'
                      ? isStoreAppMode
                        ? '✓ PC 원본 이관 선택됨'
                        : '✓ 상주 모듈 동결 미리보기 열림'
                      : isStoreAppMode
                      ? '⚡ PC 원본 이관 & 용량 확보'
                      : '⚡ 상주 모듈 동결 & 속도 향상'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecisions((d) => ({ ...d, powerDrain: 'keep' }))}
                    className={`px-2.5 py-1.5 rounded-lg font-label-sm text-[11.5px] font-bold transition-all cursor-pointer ${
                      decisions.powerDrain === 'keep'
                        ? 'bg-zinc-700 text-white font-extrabold'
                        : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-white/10'
                    }`}
                  >
                    유지하기
                  </button>
                </div>
              </div>
            </div>

            {/* 1:1 대화형 통합 주치의 채팅 & 액션 센터 (치우기 × 고치기 공통 엔진) */}
            <div className="p-4 rounded-xl bg-zinc-950 border border-white/10 flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-extrabold text-amber-400">
                    💡 원클릭 대화 예시:
                  </span>
                  {[
                    {
                      label: '🔗 자주 가는 카페 바탕화면에 바로가기 만들어줘',
                      q: '내가 자주 가는 네이버 카페 바탕화면에 바로가기 만들어줘',
                    },
                    {
                      label: '🕵️ 어제 바탕화면 영수증 파일 어디 갔어?',
                      q: '어제 바탕화면에 있던 카톡받은_영수증캡처_01.jpg 파일이 사라졌어 찾아줘',
                    },
                    {
                      label: '📄 저장 안 하고 꺼진 워드 단가표 복구해 줘',
                      q: '방금 워드 작업하다가 저장 안 하고 꺼졌는데 단가표 문서 복구해 줘',
                    },
                    {
                      label: '💻 내 컴퓨터 사양으로 포토샵·배그 돌아가?',
                      q: '내 컴퓨터 실시간 사양으로 포토샵이랑 배그 잘 돌아가?',
                    },
                    {
                      label: '🕰️ 최근 [복원 기록] 보여줘',
                      q: '최근 [복원 기록] 조회해서 1초 만에 원래대로 되돌려줘',
                    },
                  ].map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => void triggerMonsterQuery(chip.q)}
                      className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-200 text-[11px] font-bold transition cursor-pointer"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setTtsEnabled((v) => !v)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold border ${
                      ttsEnabled
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                        : 'bg-zinc-900 border-white/10 text-zinc-400'
                    }`}
                  >
                    {ttsEnabled ? '🔊 현수 음성 안내 ON' : '🔇 음성 안내 OFF'}
                  </button>
                </div>
              </div>

              <form onSubmit={handleAskDoctor} className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={doctorChatInput}
                  onChange={(e) => setDoctorChatInput(e.target.value)}
                  placeholder="무엇이든 말만 하세요! (예: 바탕화면 정리해줘 / 자주 가는 카페 바탕화면에 바로가기 만들어줘 / 영수증 파일 어디 갔어? / 내 PC로 배그 돌아가?)"
                  className="flex-1 min-w-[220px] px-3.5 py-2.5 rounded-lg bg-zinc-900 border border-white/15 text-zinc-900 dark:text-white text-[13px] font-medium focus:outline-none focus:border-primary-container"
                />
                <button
                  type="submit"
                  disabled={monsterBusy}
                  className="px-4 py-2.5 rounded-lg bg-primary-container text-zinc-950 font-label-sm text-[13px] font-extrabold whitespace-nowrap cursor-pointer"
                >
                  {monsterBusy ? '🔍 0.01초 분석 중...' : '💬 주치의에게 말하기 (0원)'}
                </button>
              </form>

              {monsterMessages.length === 0 ? (
                <div className="p-3 rounded-lg bg-zinc-900/90 border border-primary-container/30">
                  <p className="font-body-sm text-[13.5px] font-semibold text-zinc-900 dark:text-zinc-100 leading-relaxed">
                    {doctorChatReply}
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                  {monsterMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-3.5 rounded-xl border ${
                        msg.role === 'user'
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-100 ml-8'
                          : 'bg-zinc-900/95 border-primary-container/40 text-zinc-100'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1">
                        <span className="font-extrabold">
                          {msg.role === 'user' ? '🙋‍♂️ 나의 요청' : '🩺 귀신같이 주치의 (언제나 0원)'}
                        </span>
                        <span>{msg.timestamp}</span>
                      </div>
                      <p className="text-[13px] leading-relaxed whitespace-pre-line font-semibold">
                        {msg.text}
                      </p>
                      {msg.role === 'assistant' && (
                        <MonsterInteractiveCardView
                          message={msg}
                          literacyLevel={literacyLevel}
                          onChangeLiteracyLevel={setLiteracyLevel}
                          onUpdateMessage={(updated) =>
                            setMonsterMessages((prev) =>
                              prev.map((m) => (m.id === updated.id ? updated : m))
                            )
                          }
                          onHealthRecordAdded={(rec) =>
                            setHealthHistoryRecords((prev) => [rec, ...prev])
                          }
                          onJumpToSearch={(kw) => {
                            void runTextQuery(kw);
                            if (layout === 'mobile') setMobileTab('search');
                            else setDesktopTab('dashboard');
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ─────────────── 3. 노션 데이터베이스형 4대 카테고리 + 독립 [🗑️ 휴지통 보관함] 뷰 탭 ─────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {TRASH_TABS.map((tab) => {
          const items = activeTrash.filter((p) => matchesTrashTab(p, tab.key));
          const bytes = items.reduce((a, p) => a + p.size, 0);
          const isSelected = !isTrashBinTabActive && currentTab === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setIsTrashBinTabActive(false);
                setActiveTrashCategoryFilter(tab.key as TrashCategory);
              }}
              className={`group text-left cursor-pointer rounded-2xl p-4 transition-all flex flex-col justify-between gap-2.5 border ${
                isSelected
                  ? 'bg-zinc-900 border-primary-container shadow-xs'
                  : 'bg-[#18181B] hover:bg-zinc-900/70 border-white/10'
              }`}
            >
              <div className="flex items-start justify-between gap-2 w-full">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-headline-sm text-[13.5px] text-primary-container font-bold">
                      {tab.stepNum}
                    </span>
                    <span className="font-headline-sm text-[14.5px] text-white font-bold truncate">
                      {tab.shortTitle}
                    </span>
                  </div>
                  <span className="font-body-sm text-[11px] text-zinc-400 line-clamp-1">
                    {tab.subtitle}
                  </span>
                </div>
                <span className="material-symbols-outlined text-[17px] text-zinc-400 shrink-0">
                  {tab.icon}
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/10 w-full">
                <div className="flex items-baseline gap-1">
                  <span className="font-headline-md text-[18px] text-white font-extrabold">
                    {items.length}
                  </span>
                  <span className="font-label-sm text-[11.5px] text-zinc-400">장</span>
                  {tab.key === 'duplicate' && activeDuplicateGroups.length > 0 && (
                    <span className="ml-1 text-[11px] text-primary-container font-semibold">
                      · {activeDuplicateGroups.length}묶음
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <div className="hidden sm:flex -space-x-1.5 overflow-hidden">
                    {items.slice(0, 3).map((p) => (
                      <img
                        key={p.id}
                        src={p.thumbUrl}
                        alt=""
                        className="inline-block w-5 h-5 rounded-full object-cover ring-1 ring-zinc-900"
                      />
                    ))}
                  </div>
                  <span className="font-label-mono text-[11px] text-zinc-400 font-semibold">
                    {fmtMB(bytes)}
                  </span>
                </div>
              </div>
            </button>
          );
        })}

        {/* ⑤ 독립 분리된 [🗑️ 휴지통 보관함 (1초 복원)] 전용 탭 카드 */}
        <button
          type="button"
          onClick={() => {
            setIsTrashBinTabActive(true);
            setShowQuarantineDrawer(true);
          }}
          className={`group text-left cursor-pointer rounded-2xl p-4 transition-all flex flex-col justify-between gap-2.5 border ${
            isTrashBinTabActive
              ? 'bg-zinc-900 border-primary-container shadow-xs ring-1 ring-primary-container'
              : 'bg-[#18181B] hover:bg-zinc-900/70 border-white/10'
          }`}
        >
          <div className="flex items-start justify-between gap-2 w-full">
            <div className="flex flex-col gap-0.5 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-headline-sm text-[13.5px] text-amber-400 font-bold">
                  🗑️
                </span>
                <span className="font-headline-sm text-[14.5px] text-white font-bold truncate">
                  휴지통 보관함
                </span>
              </div>
              <span className="font-body-sm text-[11px] text-zinc-400 line-clamp-1">
                정리된 사진 확인 &amp; 1초 즉시 원상복구
              </span>
            </div>
            <span className="material-symbols-outlined text-[17px] text-amber-400 shrink-0">
              restore_from_trash
            </span>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-white/10 w-full">
            <div className="flex items-baseline gap-1">
              <span className="font-headline-md text-[18px] text-amber-400 font-extrabold">
                {quarantinedPhotos.length}
              </span>
              <span className="font-label-sm text-[11.5px] text-zinc-400">장 보관 중</span>
            </div>
            <span className="font-label-mono text-[11px] text-primary-container font-bold">
              ↩️ 1초 복원
            </span>
          </div>
        </button>
      </div>

      {/* ─────────────── 3-B. [🗑️ 휴지통 보관함] 탭 선택 시 상단에 바로 열리는 전용 복원 뷰 ─────────────── */}
      {isTrashBinTabActive && (
        <section className="p-5 md:p-6 rounded-2xl bg-[#18181B] border border-primary-container/50 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-white/10">
            <div className="flex flex-col gap-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-headline-sm text-[17px] md:text-[18.5px] text-zinc-900 dark:text-white font-extrabold flex items-center gap-1.5">
                  <span>🗑️ 휴지통 보관함 (OS 기본 휴지통 이동 내역)</span>
                </h2>
                <span className="px-2.5 py-0.5 rounded-md bg-zinc-900 border border-primary-container/40 text-primary-container font-label-sm text-[12px] font-bold">
                  총 {quarantinedPhotos.length}장 보관 중
                </span>
              </div>
              <p className="font-body-sm text-[12.5px] text-zinc-500 dark:text-zinc-400">
                정리한 사진은 영구 삭제되지 않고 이곳에 안전하게 보관됩니다. 원하는 사진의 [↩️ 1초 복원] 또는 우측 [↩️ 전체 복원]을 누르면 즉시 원래 자리로 돌아갑니다.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void openLocalFolder('quarantine')}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 font-label-sm text-[12px] font-bold cursor-pointer"
              >
                📂 실제 휴지통 폴더 열기
              </button>
              {quarantinedPhotos.length > 0 && (
                <button
                  type="button"
                  disabled={quarantineMoving}
                  onClick={() =>
                    void restoreFromQuarantine(quarantinedPhotos.map((p) => p.name))
                  }
                  className="px-4 py-1.5 rounded-lg bg-primary-container text-zinc-950 font-label-sm text-[12.5px] font-extrabold flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">restore_from_trash</span>
                  <span>↩️ 전체 복원 ({quarantinedPhotos.length}장)</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsTrashBinTabActive(false)}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-label-sm text-[12px] font-bold cursor-pointer"
              >
                ← 정리 목록으로 돌아가기
              </button>
            </div>
          </div>

          {quarantinedPhotos.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {quarantinedPhotos.map((p) => (
                <div
                  key={p.id}
                  className="group relative rounded-xl overflow-hidden bg-zinc-950 border border-white/10 flex flex-col justify-between"
                >
                  <div className="relative aspect-square w-full overflow-hidden">
                    <img src={p.thumbUrl} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setSelectedPhoto(p)}
                      title="크게 보기"
                      className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-black/75 hover:bg-primary-container text-white hover:text-zinc-950 flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px]">zoom_in</span>
                    </button>
                  </div>
                  <div className="p-2.5 flex flex-col gap-1.5 bg-zinc-900">
                    <span className="font-label-sm text-[11.5px] text-zinc-200 font-semibold truncate">
                      {p.tags[0] || '#휴지통이동'}
                    </span>
                    <button
                      type="button"
                      onClick={() => void restoreFromQuarantine([p.name])}
                      className="w-full py-1.5 rounded-lg bg-primary-container/20 hover:bg-primary-container text-primary-container hover:text-zinc-950 border border-primary-container/40 font-label-sm text-[11.5px] font-extrabold transition-all cursor-pointer"
                    >
                      ↩️ 1초 복원
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center flex flex-col items-center gap-2">
              <span className="material-symbols-outlined text-zinc-500 text-[32px]">
                delete_sweep
              </span>
              <span className="font-headline-sm text-[15px] text-zinc-300 font-bold">
                현재 휴지통 보관함이 비어 있습니다.
              </span>
              <span className="font-body-sm text-[12.5px] text-zinc-400">
                ①~④번 카테고리에서 중복·연사나 불필요한 사진을 정리하면 이곳으로 안전하게 이동됩니다.
              </span>
            </div>
          )}
        </section>
      )}

      {/* ─────────────── 4-A. ① 동일 내용 중복(최고화질 원본 보존) · 연사(유저 1장 직접 선택) 바둑판 Pick 뷰 ─────────────── */}
      {showDuplicatePickSection && (
        <div className="p-5 md:p-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-3.5">
            <div className="flex flex-col gap-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-headline-sm text-[16.5px] md:text-[18px] text-white font-bold">
                  ① 중복 사진(최고화질 원본 보존) &amp; 연사 묶음(1장 직접 선택)
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-zinc-900 border border-white/10 text-primary-container font-label-sm text-[11.5px] font-bold">
                  {activeDuplicateGroups.length}개 묶음
                </span>
              </div>
              <p className="font-body-sm text-[12px] text-zinc-400">
                동일 내용 중복은 최고화질 원본 1장만 남기고, 연사는 마음에 드는 1장을 클릭(선택)하면 나머지를 휴지통으로 정리합니다.
              </p>
            </div>

            {/* PC 3x3 / 4x4 바둑판 배열 전환 + 전체 카테고리 보기 */}
            <div className="flex flex-wrap items-center gap-2 self-start md:self-auto shrink-0">
              <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setGridColumns(3)}
                  className={`px-2.5 py-1 rounded-lg font-label-sm text-[11.5px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                    gridColumns === 3
                      ? 'bg-primary-container text-zinc-950 font-extrabold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">grid_on</span>
                  <span>3열</span>
                </button>
                <button
                  type="button"
                  onClick={() => setGridColumns(4)}
                  className={`px-2.5 py-1 rounded-lg font-label-sm text-[11.5px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                    gridColumns === 4
                      ? 'bg-primary-container text-zinc-950 font-extrabold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">apps</span>
                  <span>4열</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() =>
                  setActiveTrashCategoryFilter(currentTab === 'all' ? 'duplicate' : 'all')
                }
                className={`px-3 py-1.5 rounded-xl font-label-sm text-[11.5px] font-bold border transition-all cursor-pointer ${
                  currentTab === 'all'
                    ? 'bg-primary-container text-zinc-950 border-primary-container font-extrabold'
                    : 'bg-zinc-900 text-zinc-300 hover:text-white border-white/10'
                }`}
              >
                {currentTab === 'all' ? '중복·연사만 보기' : `전체 후보 보기 (${activeTrash.length})`}
              </button>
            </div>
          </div>

          {/* 각 연사/중복 묶음별 바둑판(Grid) */}
          <div className="flex flex-col gap-4">
            {activeDuplicateGroups.map((group, gIdx) => {
              const groupPhotos = group.photoIds
                .map((id) => photoById.get(id))
                .filter((p): p is NonNullable<typeof p> => Boolean(p && !p.quarantined));

              const redundantCount = groupPhotos.filter((p) => p.id !== group.bestPhotoId).length;
              const repPhoto = groupPhotos[0];
              const sceneLabel =
                repPhoto?.tags.find((t) => !t.includes('연사') && !t.includes('원본')) || '#연사묶음';
              const isExactDuplicateGroup = gIdx === 0;

              return (
                <div
                  key={group.groupId}
                  className="p-4 rounded-xl bg-zinc-950/70 border border-white/10 flex flex-col gap-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-primary-container/15 text-primary-container font-label-sm text-[11px] font-extrabold">
                        {isExactDuplicateGroup ? '📑 동일 내용 중복' : '📸 연사 묶음 (1장 선택)'}
                      </span>
                      <span className="font-headline-sm text-[14.5px] text-white font-bold">
                        묶음 #{gIdx + 1} ({groupPhotos.length}장)
                      </span>
                      <span className="px-2 py-0.5 rounded bg-zinc-900 border border-white/10 text-zinc-300 font-label-sm text-[11px] font-medium">
                        {sceneLabel}
                      </span>
                      {repPhoto?.locationKo && (
                        <span className="font-body-sm text-[11.5px] text-zinc-400">
                          📍 {repPhoto.locationKo} · {repPhoto.date.split(' ')[0]}
                        </span>
                      )}
                    </div>

                    <button
                      disabled={quarantineMoving}
                      onClick={() =>
                        void pickBestInDuplicateGroup(group.groupId, group.bestPhotoId, true)
                      }
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-primary-container text-zinc-100 hover:text-zinc-950 border border-white/10 font-label-sm text-[11.5px] font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px]">check_circle</span>
                      <span>
                        {isExactDuplicateGroup
                          ? `최고화질 원본 남기고 사본 ${redundantCount}장 정리`
                          : `선택한 1장 남기고 나머지 ${redundantCount}장 정리`}
                      </span>
                    </button>
                  </div>

                  {/* 연사 장수에 맞춰 펼쳐지는 바둑판(Grid) */}
                  <div
                    className={`grid grid-cols-2 ${
                      gridColumns === 3
                        ? 'sm:grid-cols-3 lg:grid-cols-3'
                        : 'sm:grid-cols-3 lg:grid-cols-4'
                    } gap-3`}
                  >
                    {groupPhotos.map((ph, idx) => {
                      const isBestOriginal = ph.id === group.bestPhotoId;
                      return (
                        <div
                          key={ph.id}
                          onClick={() =>
                            void pickBestInDuplicateGroup(group.groupId, ph.id, false)
                          }
                          className={`group/card relative aspect-[4/5] rounded-xl overflow-hidden cursor-pointer transition-all ${
                            isBestOriginal
                              ? 'ring-2 ring-primary-container border border-primary-container'
                              : 'border border-white/10 opacity-90 hover:opacity-100 hover:border-white/30'
                          }`}
                        >
                          <img
                            src={ph.thumbUrl}
                            alt=""
                            loading="lazy"
                            className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-300"
                          />

                          {/* 상단 배지 */}
                          {isBestOriginal ? (
                            <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-md bg-zinc-950/90 backdrop-blur-md border border-primary-container text-primary-container font-label-sm text-[11px] font-bold flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">
                                verified_user
                              </span>
                              <span>
                                {isExactDuplicateGroup
                                  ? '👑 보존할 최고화질 원본 (선택됨)'
                                  : '👑 현재 선택된 1장 보존'}
                              </span>
                            </div>
                          ) : (
                            <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-md bg-zinc-950/80 backdrop-blur-md border border-white/15 text-zinc-300 font-label-sm text-[11px] font-medium">
                              {isExactDuplicateGroup
                                ? `동일 사본 #${idx + 1} · 클릭 시 이 1장 보존`
                                : `연사 #${idx + 1} · 클릭 시 이 1장 보존`}
                            </div>
                          )}

                          {/* 크게 보기 버튼 */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPhoto(ph, groupPhotos);
                            }}
                            title="크게 비교 보기"
                            className="absolute bottom-10 right-2.5 w-7 h-7 rounded-full bg-black/75 hover:bg-primary-container text-white hover:text-zinc-950 flex items-center justify-center transition-colors z-10 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px]">zoom_in</span>
                          </button>

                          {/* 하단 안내 바 */}
                          <div
                            className={`absolute inset-x-0 bottom-0 pt-5 pb-2 px-3 text-center font-label-sm text-[11px] font-semibold transition-all bg-gradient-to-t ${
                              isBestOriginal
                                ? 'from-black/95 via-black/75 to-transparent text-primary-container'
                                : 'from-black/95 via-black/75 to-transparent text-zinc-300 group-hover/card:text-white'
                            }`}
                          >
                            {isBestOriginal
                              ? '✓ 현재 보존할 1장으로 선택됨 (우측 상단 [정리] 클릭 시 사본 이동)'
                              : '👆 클릭 시 이 사진을 보존할 1장으로 변경'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─────────────── 4-B. 탭 ②·③·④ 및 전체 보기 개별 선택 그리드 (중복 탭 바 없이 깔끔한 액션 헤더만 배치) ─────────────── */}
      {!isTrashBinTabActive && currentTab !== 'duplicate' && (
        <section className="p-5 md:p-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-headline-sm text-[16.5px] text-white font-bold">
                {TRASH_TABS.find((t) => t.key === currentTab)?.title || '전체 정리 후보 사진'}
              </h2>
              <span className="px-2 py-0.5 rounded-md bg-zinc-900 border border-white/10 text-zinc-300 font-label-sm text-[11.5px] font-bold">
                {filteredCandidates.length}장
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={selectAllTrashInFilter}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-200 font-label-sm text-[12px] font-medium cursor-pointer"
              >
                전체 선택
              </button>
              <button
                type="button"
                onClick={clearTrashSelection}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-400 font-label-sm text-[12px] cursor-pointer"
              >
                선택 해제
              </button>
              <button
                type="button"
                disabled={selectedTrashIds.size === 0 || quarantineMoving}
                onClick={() => void moveSelectedToQuarantine()}
                className="px-3.5 py-1.5 rounded-lg bg-primary-container text-zinc-950 font-label-sm text-[12px] font-extrabold disabled:opacity-40 cursor-pointer"
              >
                선택된 {selectedTrashIds.size}장 ({fmtMB(selectedBytes)}) 휴지통 이동
              </button>
            </div>
          </div>

          {filteredCandidates.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
              {filteredCandidates.map((photo) => {
                const isChecked = selectedTrashIds.has(photo.id);
                const tabMeta =
                  TRASH_TABS.find((t) => matchesTrashTab(photo, t.key)) || TRASH_TABS[1];

                return (
                  <div
                    key={photo.id}
                    onClick={() => toggleTrashSelection(photo.id)}
                    className={`group relative rounded-xl overflow-hidden bg-zinc-950 transition-all cursor-pointer border ${
                      isChecked
                        ? 'border-primary-container ring-1 ring-primary-container'
                        : 'border-white/10 opacity-90 hover:opacity-100'
                    }`}
                  >
                    <div className="relative aspect-[4/5] w-full overflow-hidden bg-zinc-950">
                      <img
                        src={photo.thumbUrl}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />

                      <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-zinc-950/85 backdrop-blur-md border border-white/15">
                        <span className="font-label-sm text-[10.5px] font-semibold text-zinc-200">
                          {tabMeta.shortBadge}
                        </span>
                      </div>

                      <div
                        className={`absolute top-2.5 right-2.5 w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                          isChecked
                            ? 'bg-primary-container text-zinc-950 font-bold'
                            : 'bg-black/60 border border-white/20 text-transparent'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[15px]">check</span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPhoto(photo);
                        }}
                        title="크게 보기"
                        className="absolute bottom-10 right-2.5 w-7 h-7 rounded-full bg-black/75 hover:bg-primary-container text-white hover:text-zinc-950 flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[15px]">zoom_in</span>
                      </button>

                      <div className="absolute inset-x-0 bottom-0 pt-5 pb-2 px-3 bg-gradient-to-t from-black/90 via-black/55 to-transparent flex items-center justify-between">
                        <span className="font-label-sm text-[11.5px] font-semibold truncate text-zinc-200">
                          {photo.tags[0] || tabMeta.cleanTag}
                        </span>
                        <span className="font-label-sm text-[11px] text-zinc-400 shrink-0 ml-1">
                          {photo.date.split(' ')[0]}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 rounded-xl bg-zinc-950/60 border border-white/5 text-center flex flex-col items-center gap-2">
              <span className="material-symbols-outlined text-primary-container text-[30px]">
                verified
              </span>
              <span className="font-headline-sm text-[15px] text-white font-bold">
                이 탭의 정리 후보 사진이 모두 OS 기본 [휴지통]으로 이동되었습니다!
              </span>
              <span className="font-body-sm text-[12px] text-zinc-400">
                아래 [OS 기본 휴지통 이동 내역]에서 언제든 1초 복원할 수 있습니다.
              </span>
            </div>
          )}
        </section>
      )}

      {/* ─────────────── 5. 노션 토글형 OS 기본 [휴지통] 이동 내역 & 1초 복원 드로어 ─────────────── */}
      <section className="rounded-2xl bg-[#18181B] border border-white/10 overflow-hidden">
        <div
          onClick={() => setShowQuarantineDrawer((v) => !v)}
          className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-zinc-900/60 transition-colors select-none"
        >
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-zinc-400 font-bold">
              {showQuarantineDrawer ? '▾' : '▸'}
            </span>
            <span className="material-symbols-outlined text-zinc-400 text-[18px]">delete</span>
            <h3 className="font-headline-sm text-[15px] text-white font-bold">
              OS 기본 [휴지통] 이동 내역 ({quarantinedPhotos.length}장)
            </h3>
            <span className="hidden sm:inline text-[12px] text-zinc-400">
              · 클릭 한 번으로 원래 폴더에 1초 복원됩니다
            </span>
          </div>

          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {quarantinedPhotos.length > 0 && (
              <button
                type="button"
                disabled={quarantineMoving}
                onClick={() =>
                  void restoreFromQuarantine(quarantinedPhotos.map((p) => p.name))
                }
                className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-primary-container font-label-sm text-[11.5px] font-bold border border-white/10 flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">restore_from_trash</span>
                <span>↩️ 전체 복원 ({quarantinedPhotos.length}장)</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowQuarantineDrawer((v) => !v)}
              className="px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-100 text-[13px] font-extrabold select-none shadow-sm cursor-pointer transition-all"
            >
              {showQuarantineDrawer ? '접기 ▴' : '펼치기 ▾'}
            </button>
          </div>
        </div>

        {showQuarantineDrawer && (
          <div className="px-5 pb-5 pt-2 border-t border-white/10">
            {quarantinedPhotos.length > 0 ? (
              <div className="max-h-[420px] overflow-y-auto pr-1 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
                {quarantinedPhotos.map((p) => (
                  <div
                    key={p.id}
                    className="group relative rounded-xl overflow-hidden bg-zinc-950 border border-white/10"
                  >
                    <div className="aspect-square w-full overflow-hidden">
                      <img src={p.thumbUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="p-2 flex flex-col gap-1 bg-zinc-900">
                      <span className="font-label-sm text-[11px] text-zinc-200 font-semibold truncate">
                        {p.tags[0] || '#휴지통이동'}
                      </span>
                      <button
                        type="button"
                        onClick={() => void restoreFromQuarantine([p.name])}
                        className="w-full py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-primary-container font-label-sm text-[10px] font-bold cursor-pointer"
                      >
                        ↩️ 1초 복원
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-4 text-center font-body-sm text-[12px] text-zinc-500">
                현재 최근 정리된 휴지통 이동 내역이 비어 있습니다.
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
