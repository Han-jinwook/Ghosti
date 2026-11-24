import React, { useEffect, useRef, useState } from 'react';
import { useSaySeeStore } from '../../store/useSaySeeStore';
import { hasAuthenticatedHubAccountSession } from '../../services/supabaseClient';
import {
  clearLastQrPairResult,
  clearPendingQrPairCode,
  consumeDevicePairingCode6,
  readLastQrPairResult,
  readPendingQrPairCode,
  saveLastQrPairResult,
  savePendingQrPairCode,
} from '../../services/deviceIntegrationService';
import { isCapacitorNativeMobileRuntime } from '../../services/ghostiMobileCareBridge';
import { buildIosStoreInviteUrl } from '../../services/shareInviteDeepLinkBridge';

function isMobileWebBrowser(): boolean {
  if (typeof window === 'undefined' || isCapacitorNativeMobileRuntime()) return false;
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIpadDesktopUa =
    /Macintosh/i.test(ua) &&
    typeof navigator !== 'undefined' &&
    (navigator.maxTouchPoints || 0) > 1;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || isIpadDesktopUa;
}

function resolveInitialQrPairCode(): string | null {
  if (!isMobileWebBrowser()) return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = (params.get('pairCode') || '').replace(/\D/g, '').slice(0, 6);
    if (fromUrl.length === 6) {
      savePendingQrPairCode(fromUrl);
      return fromUrl;
    }
    const fromPending = readPendingQrPairCode();
    return fromPending && fromPending.length === 6 ? fromPending : null;
  } catch {
    return null;
  }
}

export const MobileQrPairBridgeOverlay: React.FC = () => {
  const merlinAuth = useSaySeeStore((s) => s.merlinAuth);
  const [pairCode, setPairCode] = useState<string | null>(() => resolveInitialQrPairCode());
  const [phase, setPhase] = useState<'checking' | 'ready' | 'mismatch' | 'expired'>(() => {
    const code = resolveInitialQrPairCode();
    if (!code) return 'ready';
    const saved = readLastQrPairResult(code);
    if (saved && !saved.ok && saved.reason === 'ACCOUNT_MISMATCH') return 'mismatch';
    if (saved && !saved.ok && saved.reason === 'CODE_EXPIRED') return 'expired';
    return hasAuthenticatedHubAccountSession() ? 'checking' : 'ready';
  });
  const [expectedEmailHint, setExpectedEmailHint] = useState<string>(() => {
    const saved = readLastQrPairResult();
    return saved?.expectedEmailHint || '';
  });
  const [storeCopyNotice, setStoreCopyNotice] = useState<string>('');
  const autoLaunchedCodeRef = useRef<string>('');
  const prevEmailRef = useRef<string>((merlinAuth?.email || '').trim().toLowerCase());

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isAndroid = /Android/i.test(ua);
  const iosStore = buildIosStoreInviteUrl();

  const triggerOpenApp = (code: string) => {
    if (typeof window === 'undefined') return;
    window.location.href = `ghosti://pair?pairCode=${code}`;
  };

  // 로그인 계정이 실제로 바뀌었을 때(게스트 -> PC 계정 로그인 등) 다시 검증하고 ready면 앱 열기 자동 실행
  useEffect(() => {
    if (!pairCode) return;
    const nextEmail = (merlinAuth?.email || '').trim().toLowerCase();
    const prevEmail = prevEmailRef.current;
    if (prevEmail !== nextEmail) {
      prevEmailRef.current = nextEmail;
      if (nextEmail) {
        clearLastQrPairResult();
        setExpectedEmailHint('');
        setPhase('checking');
      }
    }
  }, [merlinAuth?.email, pairCode]);

  // GhostCastAndLiveSystem의 pair 결과 이벤트 수신
  useEffect(() => {
    if (typeof window === 'undefined' || !pairCode) return;
    const onQrPairResult = (ev: Event) => {
      const detail = (ev as CustomEvent<{
        ok?: boolean;
        reason?: string;
        expectedEmailHint?: string;
      }>).detail;
      if (!detail) return;
      if (detail.ok) {
        setExpectedEmailHint('');
        setPhase('ready');
      } else if (detail.reason === 'ACCOUNT_MISMATCH') {
        setExpectedEmailHint(detail.expectedEmailHint || '');
        setPhase('mismatch');
      } else if (detail.reason === 'CODE_EXPIRED') {
        setPhase('expired');
      } else {
        setPhase('ready');
      }
    };
    window.addEventListener('ghosti_qr_pair_result', onQrPairResult);
    return () => window.removeEventListener('ghosti_qr_pair_result', onQrPairResult);
  }, [pairCode]);

  // checking 상태일 때 직접 계정 일치 여부 검증 (모바일 웹은 DB 기기 등록 없이 계정만 확인)
  useEffect(() => {
    if (!pairCode || phase !== 'checking') return;
    const isAuthed = Boolean(
      (merlinAuth?.email && merlinAuth.userId !== 'guest') || hasAuthenticatedHubAccountSession()
    );
    if (!isAuthed) {
      setPhase('ready');
      return;
    }
    let cancelled = false;
    void consumeDevicePairingCode6(pairCode).then((res) => {
      if (cancelled) return;
      if (res.ok) {
        saveLastQrPairResult({ code: pairCode, ok: true });
        setExpectedEmailHint('');
        setPhase('ready');
      } else if (res.reason === 'ACCOUNT_MISMATCH') {
        savePendingQrPairCode(pairCode);
        saveLastQrPairResult({
          code: pairCode,
          ok: false,
          reason: 'ACCOUNT_MISMATCH',
          expectedEmailHint: res.expectedEmailHint,
        });
        setExpectedEmailHint(res.expectedEmailHint || '');
        setPhase('mismatch');
      } else if (res.reason === 'CODE_EXPIRED') {
        setPhase('expired');
      } else {
        setPhase('ready');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pairCode, phase, merlinAuth?.email, merlinAuth?.userId]);

  // 계정 일치(또는 게스트)로 확정되면 자동으로 설치된 귀신같이 앱 열기 1회 시도
  useEffect(() => {
    if (!pairCode || phase !== 'ready') return;
    if (autoLaunchedCodeRef.current === pairCode) return;
    autoLaunchedCodeRef.current = pairCode;
    const timer = window.setTimeout(() => {
      triggerOpenApp(pairCode);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [pairCode, phase]);

  if (!pairCode || !isMobileWebBrowser()) return null;

  const handleClose = () => {
    clearPendingQrPairCode();
    clearLastQrPairResult();
    setPairCode(null);
  };

  const handleGoStore = async () => {
    if (isAndroid) {
      const ref = encodeURIComponent(`pairCode=${pairCode}`);
      window.location.href = `https://play.google.com/store/apps/details?id=app.sundreamer.ghosti&referrer=${ref}`;
      return;
    }
    // iOS: App Store에는 Install Referrer가 없으므로 설치 후 앱 첫 실행 시 자동 인식되도록 연결 코드를 클립보드에 안전 복사
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`GHOSTI_PAIR_V1:${pairCode}`);
        setStoreCopyNotice('연결 번호가 자동 저장되었습니다. 앱 설치 후 열면 바로 연결됩니다.');
      }
    } catch {
      /* ignore clipboard error */
    }
    window.location.href = iosStore.primaryUrl;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[300] bg-slate-900/55 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 shadow-2xl p-5 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold text-teal-700 tracking-tight">
              귀신같이 · PC 기기 연결 브릿지
            </p>
            <h2 className="text-[16px] font-bold text-slate-900 mt-0.5 break-keep">
              {phase === 'mismatch'
                ? '연결할 계정을 선택해 주세요'
                : phase === 'expired'
                ? 'QR 연결 번호가 만료되었습니다'
                : phase === 'checking'
                ? 'PC 계정을 확인하는 중...'
                : '귀신같이 앱으로 연결합니다'}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-[12px] text-slate-400 hover:text-slate-700 px-1.5 py-0.5 cursor-pointer shrink-0"
          >
            닫기
          </button>
        </div>

        {phase === 'checking' && (
          <div className="py-6 flex flex-col items-center justify-center gap-2.5 text-center">
            <span className="inline-block w-6 h-6 rounded-full border-2 border-teal-600 border-t-transparent animate-spin" />
            <p className="text-[12.5px] text-slate-600 break-keep">
              PC에 로그인된 이메일과 일치하는지 확인하고 있습니다...
            </p>
          </div>
        )}

        {phase === 'expired' && (
          <div className="flex flex-col gap-3">
            <p className="text-[12.5px] text-slate-600 leading-relaxed break-keep">
              QR 연결 번호({pairCode.slice(0, 3)}-{pairCode.slice(3, 6)})의 유효시간이 지났습니다.
              PC 화면에서 <b>[새 번호 발급]</b>을 누른 뒤 다시 스캔해 주세요.
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-[13px] font-semibold cursor-pointer"
            >
              확인
            </button>
          </div>
        )}

        {phase === 'mismatch' && (
          <div className="flex flex-col gap-3">
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[12px] text-amber-900 leading-relaxed break-keep">
              PC에는 <b>{expectedEmailHint || '다른 이메일'}</b> 계정이 로그인되어 있습니다.
              <br />
              현재 모바일 웹 계정(<b>{merlinAuth?.email || '다른 계정'}</b>)과 달라, 통합할 계정을 선택해 주세요.
            </div>
            <button
              type="button"
              onClick={() => {
                savePendingQrPairCode(pairCode);
                clearLastQrPairResult();
                window.dispatchEvent(new CustomEvent('ghosti_logout_and_open_login'));
              }}
              className="w-full px-3.5 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-[13px] font-semibold text-left flex flex-col gap-0.5 cursor-pointer"
            >
              <span>PC 계정({expectedEmailHint || '같은 이메일'})으로 로그인하기</span>
              <span className="text-[11px] font-normal text-teal-100">
                로그인 즉시 귀신같이 앱 연결 단계로 자동 이동합니다
              </span>
            </button>
            <button
              type="button"
              onClick={() => triggerOpenApp(pairCode)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[12px] font-medium cursor-pointer"
            >
              이미 귀신같이 앱에 PC 계정으로 로그인돼 있어요 → 앱 열기
            </button>
          </div>
        )}

        {phase === 'ready' && (
          <div className="flex flex-col gap-3">
            <div className="px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <span className="text-[12px] text-slate-600 font-medium">PC 연결 번호</span>
              <span className="font-mono text-[15px] font-bold text-slate-900 tracking-wider">
                {pairCode.slice(0, 3)}-{pairCode.slice(3, 6)}
              </span>
            </div>
            <p className="text-[12px] text-slate-600 leading-relaxed break-keep">
              귀신같이 앱이 설치되어 있다면 아래 버튼으로 앱을 열어 바로 연결하세요.
              앱이 없다면 스토어에서 설치 후 앱을 열면 방금 찍은 QR 연결이 이어집니다.
            </p>
            <button
              type="button"
              onClick={() => triggerOpenApp(pairCode)}
              className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-[13.5px] font-bold cursor-pointer"
            >
              귀신같이 앱 열기
            </button>
            <button
              type="button"
              onClick={() => void handleGoStore()}
              className="w-full py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-[12.5px] font-semibold cursor-pointer"
            >
              {isAndroid ? 'Google Play에서 귀신같이 앱 설치하기' : `${iosStore.storeLabelKo}에서 귀신같이 앱 설치하기`}
            </button>
            {storeCopyNotice && (
              <p className="text-[11px] text-teal-700 font-medium text-center break-keep">
                {storeCopyNotice}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
