'use client';

/**
 * Version: v2.15.1
 * Last Updated: 2026-10-23
 * Merlin Hub SDK — HubSupportLink (프로필 하단 로그아웃 바로 위 고정 고객센터/문의방 카드)
 * - 스튜디오 통합 CS(support_tickets)에서 로그인 회원의 미확인 답변을 자동 조회하여 [🔴 새 답변 N건] 배지 노출
 * - 클릭 시 동일 SSO 토큰과 앱 컨텍스트(?app=...)를 유지한 채 스튜디오 1:1 문의방으로 즉시 점핑
 * - 하단 보조 버튼으로 앱을 떠나지 않고 1초 만에 오류/불편을 즉시 제보하는 미니 모달(openBugReporter)도 지원
 */

import React, { useEffect, useState } from 'react';
import { Headphones, ChevronRight, MessageSquareText, Bug } from 'lucide-react';
import {
  STUDIO_SUPABASE_URL,
  STUDIO_SUPABASE_ANON_KEY,
  getStudioAuthToken,
  buildStudioSupportJumpUrl,
  openBugReporter,
} from './blackbox';
import { useHub } from '../HubProvider';
import { getConfig } from '../CoreLogic/config';

export interface HubSupportLinkProps {
  appId?: string;
  label?: string;
  subLabel?: string;
  className?: string;
  showQuickBugButton?: boolean;
}

interface UnreadReplyInfo {
  count: number;
  latestTicketId: string | number | null;
}

export const HubSupportLink: React.FC<HubSupportLinkProps> = ({
  appId,
  label = '1:1 고객문의 · 나의 문의방',
  subLabel = '문의 접수 · 답변 확인 및 패밀리 앱 라운지',
  className = '',
  showQuickBugButton = true,
}) => {
  const { user, isLoggedIn } = useHub();
  const [unreadInfo, setUnreadInfo] = useState<UnreadReplyInfo>({
    count: 0,
    latestTicketId: null,
  });

  const effectiveAppId = appId || getConfig().appId || 'AggroFilter';

  useEffect(() => {
    const email =
      user?.email ||
      (typeof window !== 'undefined'
        ? localStorage.getItem('userEmail') || localStorage.getItem('user_email') || ''
        : '');

    if (!email || !email.includes('@')) {
      setUnreadInfo({ count: 0, latestTicketId: null });
      return;
    }

    let isMounted = true;

    const checkUnreadReplies = async () => {
      try {
        const { token: authToken } = await getStudioAuthToken(email);
        const encodedEmail = encodeURIComponent(email.toLowerCase());
        const res = await fetch(
          `${STUDIO_SUPABASE_URL}/rest/v1/support_tickets?email=eq.${encodedEmail}&select=id,status,reply,replied_at,created_at&order=created_at.desc&limit=15`,
          {
            headers: {
              apikey: STUDIO_SUPABASE_ANON_KEY,
              Authorization: `Bearer ${authToken}`,
            },
          }
        );

        if (!res.ok) return;
        const tickets = await res.json();
        if (!Array.isArray(tickets) || !isMounted) return;

        let unreadCount = 0;
        let latestUnreadId: string | number | null = null;

        for (const t of tickets) {
          if (!t.reply) continue;
          let lastAdminMsgId: string | null = null;
          try {
            const parsed = JSON.parse(t.reply);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const lastMsg = parsed[parsed.length - 1];
              if (lastMsg && lastMsg.sender === 'admin') {
                lastAdminMsgId = String(lastMsg.id || t.replied_at || 'admin');
              }
            }
          } catch {
            // 레거시 문자열 답변인 경우
            lastAdminMsgId = String(t.replied_at || 'legacy');
          }

          if (lastAdminMsgId) {
            const readKey = `read_ticket_${t.id}`;
            const localRead = typeof window !== 'undefined' ? localStorage.getItem(readKey) : null;
            if (localRead !== lastAdminMsgId) {
              unreadCount++;
              if (!latestUnreadId) {
                latestUnreadId = t.id;
              }
            }
          }
        }

        if (isMounted) {
          setUnreadInfo({
            count: unreadCount,
            latestTicketId: latestUnreadId,
          });
        }
      } catch {
        // 네트워크 오류 시 무시 (안전 코딩)
      }
    };

    checkUnreadReplies();
    return () => {
      isMounted = false;
    };
  }, [user?.email, isLoggedIn]);

  const handleNavigateToSupport = () => {
    const email =
      user?.email ||
      (typeof window !== 'undefined'
        ? localStorage.getItem('userEmail') || localStorage.getItem('user_email') || null
        : null);

    const targetUrl = buildStudioSupportJumpUrl({
      appId: effectiveAppId,
      ticketId: unreadInfo.latestTicketId,
      email,
    });

    window.location.href = targetUrl;
  };

  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden ${className}`}>
      <div className="p-3.5 sm:p-4 space-y-2.5">
        <button
          type="button"
          onClick={handleNavigateToSupport}
          className="w-full flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-indigo-50/70 via-slate-50 to-amber-50/50 hover:from-indigo-50 hover:to-amber-50/80 border border-indigo-100/80 transition-all group cursor-pointer text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-10 h-10 rounded-xl bg-white shadow-xs border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 group-hover:scale-105 transition-transform">
              <Headphones className="w-5 h-5" />
              {unreadInfo.count > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-white animate-bounce">
                  {unreadInfo.count}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs sm:text-sm font-black text-slate-900">
                  {label}
                </span>
                {unreadInfo.count > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black animate-pulse">
                    새 답변 {unreadInfo.count}건 도착!
                  </span>
                )}
              </div>
              <p className="text-[11px] font-medium text-slate-500 truncate mt-0.5">
                {unreadInfo.count > 0
                  ? '관리자 답변이 등록되었습니다. 터치하여 바로 확인하세요!'
                  : subLabel}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 text-indigo-600 font-extrabold text-xs shrink-0 ml-2">
            <span className="hidden sm:inline">
              {unreadInfo.count > 0 ? '답변 보기' : '문의방 이동'}
            </span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </button>

        {showQuickBugButton && (
          <div className="flex items-center justify-between px-1 pt-0.5">
            <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
              <MessageSquareText className="w-3.5 h-3.5 text-slate-400" />
              사용 중 화면 멈춤이나 오류가 있으신가요?
            </span>
            <button
              type="button"
              onClick={() => openBugReporter({ category: 'BUG' })}
              className="inline-flex items-center gap-1 text-[11px] font-extrabold text-amber-600 hover:text-amber-700 hover:underline cursor-pointer bg-transparent border-none p-0"
            >
              <Bug className="w-3 h-3" />
              1초 오류 즉시 신고
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
