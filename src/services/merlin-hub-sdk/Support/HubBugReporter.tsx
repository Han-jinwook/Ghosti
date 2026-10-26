'use client';

/**
 * Version: v2.15.0
 * Last Updated: 2026-10-20
 * Merlin Hub SDK — HubBugReporter (1초 미니 오류/불편 접수 모달)
 * - 에러 바운더리 또는 사용자 수동 호출 시 팝업으로 부드럽게 노출
 * - 기기 환경, 에러 스택, 직전 20개 행동 브레드크럼을 자동으로 동봉하여 스튜디오 CS로 즉시 전송
 * - 전송 완료 시 안심 메시지 표시 및 [나의 문의방 확인하기] 원클릭 점핑 제공
 */

import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Send, X, ExternalLink, ShieldCheck } from 'lucide-react';
import {
  initBlackbox,
  submitStudioSupportTicket,
  buildStudioSupportJumpUrl,
  OpenBugReporterDetail,
} from './blackbox';
import { useHub } from '../HubProvider';
import { getConfig } from '../CoreLogic/config';

export interface HubBugReporterProps {
  appId?: string;
  appVersion?: string;
}

export const HubBugReporter: React.FC<HubBugReporterProps> = ({
  appId,
  appVersion = 'v2.15.0',
}) => {
  const { user } = useHub();
  const [isOpen, setIsOpen] = useState(false);
  const [detail, setDetail] = useState<OpenBugReporterDetail | null>(null);
  const [comment, setComment] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedTicketId, setSubmittedTicketId] = useState<string | number | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const effectiveAppId = appId || getConfig().appId || 'AggroFilter';

  useEffect(() => {
    initBlackbox();

    const handleOpen = (e: Event) => {
      const customEvent = e as CustomEvent<OpenBugReporterDetail>;
      const payload = customEvent.detail || {};
      setDetail(payload);
      setComment(payload.defaultComment || '');
      setSubmittedTicketId(null);
      setErrorMsg('');

      const storedEmail =
        user?.email ||
        (typeof window !== 'undefined'
          ? localStorage.getItem('userEmail') || localStorage.getItem('user_email') || ''
          : '');
      setContactEmail(storedEmail);
      setIsOpen(true);
    };

    window.addEventListener('merlin-open-bug-reporter', handleOpen);
    return () => window.removeEventListener('merlin-open-bug-reporter', handleOpen);
  }, [user?.email]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrorMsg('');

    const finalEmail =
      contactEmail.trim() ||
      user?.email ||
      (typeof window !== 'undefined' ? localStorage.getItem('userEmail') || '' : '');

    const res = await submitStudioSupportTicket({
      appId: effectiveAppId,
      appVersion,
      userEmail: finalEmail || undefined,
      userHubId: user?.id || undefined,
      category: detail?.category || (detail?.error ? 'CRASH' : 'BUG'),
      userComment: comment,
      error: detail?.error,
    });

    setIsSubmitting(false);

    if (res.ok) {
      setSubmittedTicketId(res.ticketId || 'done');
    } else {
      setErrorMsg('일시적인 네트워크 지연이 발생했습니다. 잠시 후 다시 시도해 주세요.');
    }
  };

  const handleJumpToStudio = () => {
    const jumpUrl = buildStudioSupportJumpUrl({
      appId: effectiveAppId,
      ticketId: submittedTicketId !== 'done' ? submittedTicketId : null,
      email: contactEmail.trim() || user?.email || null,
    });
    window.location.href = jumpUrl;
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
        {/* 상단 헤더 */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-tight text-white">
                1초 오류 · 불편 즉시 신고
              </h3>
              <p className="text-[10px] font-medium text-indigo-200">
                자동 블랙박스 진단 로그가 함께 동봉됩니다
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 본문 */}
        <div className="p-5">
          {submittedTicketId ? (
            <div className="py-4 text-center space-y-4 animate-in zoom-in-95 duration-200">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-base font-black text-slate-900">
                  소중한 제보 감사합니다!
                </h4>
                <p className="text-xs font-medium text-slate-600 leading-relaxed">
                  즉시 원인 분석에 착수했습니다.<br />
                  처리 진행 상황과 답변은 언제든 <strong className="text-indigo-600">[나의 문의방]</strong>에서 확인하실 수 있습니다^^
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold transition-colors cursor-pointer"
                >
                  계속 앱 이용하기
                </button>
                <button
                  type="button"
                  onClick={handleJumpToStudio}
                  className="flex-1 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md shadow-indigo-500/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  나의 문의방 확인하기
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5 text-left">
              <div className="p-3 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-xs font-semibold text-amber-900 leading-relaxed flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  일시적인 오류나 불편이 감지되었습니다. <strong>[즉시 접수하기]</strong>만 눌러주시면 기기 환경과 오류 위치가 자동 전송되어 빠르게 해결해 드립니다!
                </div>
              </div>

              {!user?.email && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1 pl-0.5">
                    답변 알림을 받으실 이메일 (선택)
                  </label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="example@email.com (입력 시 답변 알림 발송)"
                    className="w-full h-9 px-3 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:outline-none text-xs font-medium text-slate-800"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1 pl-0.5">
                  간단 메모 (선택사항 — 비워두셔도 자동 로그로 접수됩니다)
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="예: 분석 버튼을 눌렀는데 화면이 멈췄어요 (생략 가능)"
                  className="w-full min-h-[76px] p-3 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:outline-none text-xs font-medium text-slate-800 resize-none"
                />
              </div>

              {errorMsg && (
                <p className="text-[11px] font-bold text-rose-600 bg-rose-50 px-3 py-2 rounded-xl border border-rose-200">
                  {errorMsg}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-colors cursor-pointer"
                >
                  닫기
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-[2] h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-black shadow-md shadow-indigo-500/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isSubmitting ? '블랙박스 전송 중...' : '1초 만에 즉시 접수하기'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
