import React, { useEffect, useState } from 'react';

interface Stage1SamplePcProgram {
  id: string;
  name: string;
  memMb: number;
  neededForBank: boolean;
}

const STAGE1_SAMPLE_PC_PROGRAMS: Stage1SamplePcProgram[] = [
  { id: 'kb1', name: '○○은행 키보드 보안', memMb: 210, neededForBank: true },
  { id: 'cert', name: '공동인증서 실행 플러그인', memMb: 240, neededForBank: true },
  { id: 'kb2', name: '△△은행 키보드 보안', memMb: 180, neededForBank: false },
  { id: 'pay', name: '쇼핑몰 결제 보안 모듈', memMb: 150, neededForBank: false },
  { id: 'fw', name: '개인 방화벽 에이전트', memMb: 190, neededForBank: false },
  { id: 'term', name: '접속 단말 정보 수집기', memMb: 130, neededForBank: false },
  { id: 'sign', name: '전자서명 실행기', memMb: 160, neededForBank: false },
  { id: 'upd', name: '금융 보안 업데이트 도우미', memMb: 120, neededForBank: false },
];
const STAGE1_SAMPLE_PC_BASE_PCT = 61;
const STAGE1_SAMPLE_PC_REVIVED_PCT = 93;

export const SecretarySamplePcCarePanel: React.FC = () => {
  const [speedStep, setSpeedStep] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [sleptCount, setSleptCount] = useState<number>(0);
  const sleepTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
    };
  }, []);

  const emitChatStep = (text: string) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ghosti_sample_pc_step_chat', { detail: { text } }));
    }
  };

  const runSpeedDiagnose = () => {
    if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
    setSleptCount(0);
    setSpeedStep(1);
    emitChatStep(
      '진단 결과: 은행·결제 보안프로그램 8개가 백그라운드에서 실행 중입니다 (가용 속도 61%). 프로그램을 삭제하지 않고 절전 전환할 수 있습니다.'
    );
  };

  const runSpeedSleep = () => {
    if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
    setSpeedStep(2);
    setSleptCount(0);
    let n = 0;
    sleepTimerRef.current = setInterval(() => {
      n += 1;
      setSleptCount(n);
      if (n >= STAGE1_SAMPLE_PC_PROGRAMS.length && sleepTimerRef.current) {
        clearInterval(sleepTimerRef.current);
        sleepTimerRef.current = null;
      }
    }, 140);
    emitChatStep(
      '프로그램을 삭제하지 않고 8개 모두 절전 모드로 전환했습니다 (61% → 93%). 이제 [은행 접속 예시]를 눌러 필요한 모듈만 켜지는 과정을 확인해 보세요.'
    );
  };

  const runSpeedBankOpen = () => {
    if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
    setSleptCount(STAGE1_SAMPLE_PC_PROGRAMS.length);
    setSpeedStep(3);
    emitChatStep(
      '은행 접속에 필요한 2개 모듈만 자동으로 켜지고 나머지 6개는 절전 상태를 유지합니다. [원래대로 복구]를 누르면 이전 상태로 되돌아갑니다.'
    );
  };

  const runSpeedRestore = () => {
    if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
    setSleptCount(0);
    setSpeedStep(4);
    emitChatStep(
      '처음 상태로 복구되었습니다. 삭제된 프로그램 없이 언제든 원상복구할 수 있습니다.'
    );
  };

  const total = STAGE1_SAMPLE_PC_PROGRAMS.length;
  const neededCount = STAGE1_SAMPLE_PC_PROGRAMS.filter((p) => p.neededForBank).length;
  const totalMemGb = (STAGE1_SAMPLE_PC_PROGRAMS.reduce((s, p) => s + p.memMb, 0) / 1024).toFixed(1);
  const isAsleep = (p: Stage1SamplePcProgram, idx: number) => {
    if (speedStep === 2) return idx < sleptCount;
    if (speedStep === 3) return !p.neededForBank;
    return false;
  };
  const sleepingNow = STAGE1_SAMPLE_PC_PROGRAMS.filter((p, i) => isAsleep(p, i)).length;
  const gaugePct =
    speedStep === 0
      ? null
      : Math.round(
          STAGE1_SAMPLE_PC_BASE_PCT +
            ((STAGE1_SAMPLE_PC_REVIVED_PCT - STAGE1_SAMPLE_PC_BASE_PCT) * sleepingNow) / total
        );

  const stepMsg =
    speedStep === 0
      ? '[진단하기]를 눌러 상주 보안프로그램 상태를 예시로 확인해 보세요.'
      : speedStep === 1
      ? `상주 보안프로그램 ${total}개가 메모리 약 ${totalMemGb}GB를 점유하고 있습니다. 삭제하지 않고 절전 전환해 보세요.`
      : speedStep === 2
      ? sleptCount < total
        ? '절전 모드로 전환하는 중입니다...'
        : `${total}개 모두 절전 모드로 전환했습니다 (삭제 0개). [은행 접속 예시]를 눌러보세요.`
      : speedStep === 3
      ? `은행 접속 시 필요한 ${neededCount}개만 깨어나고 나머지는 절전 상태를 유지합니다.`
      : '이전 상태로 복구되었습니다.';

  return (
    <div
      data-allow-secretary-jump="true"
      className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3.5 text-slate-900"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] sm:text-[15px] font-bold text-slate-900">
              보안프로그램 절전 관리 (예시 체험)
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px] font-medium">
              내 PC 변경 없음
            </span>
          </div>
          <p className="text-[12.5px] text-slate-500 leading-relaxed">
            은행·결제 보안프로그램을 삭제하지 않고 평소에는 절전 모드로 두었다가 접속 시에만 켜는 방식입니다.
          </p>
        </div>

        <div className="min-w-[160px] w-full sm:w-auto sm:max-w-[220px] space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-500">가용 성능</span>
            <span className="text-slate-900 tabular-nums">
              {gaugePct === null ? '진단 전' : `${gaugePct}%`}
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              style={{ width: `${gaugePct ?? 0}%` }}
              className={`h-full rounded-full transition-all duration-300 ${
                gaugePct !== null && gaugePct >= 85
                  ? 'bg-emerald-600'
                  : gaugePct !== null && gaugePct >= 75
                  ? 'bg-amber-500'
                  : 'bg-slate-400'
              }`}
            />
          </div>
        </div>
      </div>

      {speedStep > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {STAGE1_SAMPLE_PC_PROGRAMS.map((p, idx) => {
            const asleep = isAsleep(p, idx);
            const wokeForBank = speedStep === 3 && p.neededForBank;
            return (
              <div
                key={p.id}
                className={`rounded-lg px-3 py-2 flex items-center justify-between gap-2 text-[12.5px] border transition-colors ${
                  asleep
                    ? 'bg-slate-50 border-slate-200 text-slate-400'
                    : wokeForBank
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-white border-slate-200 text-slate-800'
                }`}
              >
                <span className="font-medium truncate">{p.name}</span>
                <span className="text-[11.5px] font-semibold shrink-0">
                  {asleep ? '절전' : wokeForBank ? '실행 중' : `${p.memMb}MB`}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-lg px-3.5 py-2.5 bg-slate-50 border border-slate-200 text-[12.5px] text-slate-700 leading-relaxed">
        {stepMsg}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {[
          { label: '1. 진단하기', onClick: runSpeedDiagnose, enabled: true, active: speedStep === 0 || speedStep === 4 },
          { label: '2. 절전 전환', onClick: runSpeedSleep, enabled: speedStep >= 1, active: speedStep === 1 },
          {
            label: '3. 은행 접속 예시',
            onClick: runSpeedBankOpen,
            enabled: speedStep >= 2,
            active: speedStep === 2 && sleptCount >= total,
          },
          {
            label: '4. 원래대로 복구',
            onClick: runSpeedRestore,
            enabled: speedStep >= 2 && speedStep !== 4,
            active: speedStep === 3,
          },
        ].map((b) => (
          <button
            key={b.label}
            type="button"
            disabled={!b.enabled}
            onClick={b.onClick}
            className={`px-3.5 py-1.5 rounded-lg text-[12.5px] font-semibold border transition-colors ${
              !b.enabled
                ? 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed'
                : b.active
                ? 'bg-slate-900 border-slate-900 text-white cursor-pointer'
                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 cursor-pointer'
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
};
