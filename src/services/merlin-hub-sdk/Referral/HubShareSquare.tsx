/**
 * Version: v2.0.0
 * Last Updated: 2026-10-24
 */
import React, { useState, useEffect } from 'react';
import { triggerHaptic } from '../CoreLogic/haptic';

interface HubShareSquareProps {
  className?: string;
  customTitle?: string;
  customUrl?: string;
  /** 공유 카드 렌더링용 설명 (앱 내 카드 UI에 표시될 문구) */
  description?: string;
  /** 실제 카카오톡/외부로 전달되는 메시지 본문 (미지정 시 description 사용) */
  shareMessage?: string;
  /** 실제 카카오톡/외부로 전달되는 메시지 제목 (미지정 시 customTitle 사용) */
  shareOutgoingTitle?: string;
}

/**
 * [Custom] 순수 공유 스퀘어 위젯
 * 현재 페이지의 순수 URL(?ref= 파라미터 제외)을 품격 있는 문구와 함께 공유하는 유틸리티입니다.
 */
export const HubShareSquare: React.FC<HubShareSquareProps> = ({
  className = '',
  customTitle = '써보니 편한 기능, 주변에도 알려주세요',
  customUrl,
  description = '혼자 쓰기 아까운 AI 도구를 가족·지인과 함께 나눠보세요.',
  shareMessage,
  shareOutgoingTitle,
}) => {
  const [pathname, setPathname] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPathname(window.location.pathname);
      const handleLocationChange = () => {
        setPathname(window.location.pathname);
      };
      window.addEventListener('popstate', handleLocationChange);
      return () => {
        window.removeEventListener('popstate', handleLocationChange);
      };
    }
  }, []);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      setCanNativeShare(true);
    }
  }, []);

  // 페이지 이동(또는 customUrl 변경) 시 복사 완료 상태 초기화
  useEffect(() => {
    setIsCopied(false);
  }, [pathname, customUrl]);

  const handleShare = async () => {
    if (typeof window === 'undefined') return;
    
    let shareUrl = customUrl || window.location.href;
    
    try {
      const urlObj = new URL(shareUrl);
      // Private/internal pages shouldn't be shared. Redirect to the root page.
      const privatePaths = [
        '/profile',
        '/whateat/profile',
        '/admin7878',
        '/p-settings',
        '/p-my-page',
        '/p-notification',
        '/p-history',
        '/p-admin',
        '/payment',
        '/login'
      ];
      if (privatePaths.some(p => urlObj.pathname.startsWith(p))) {
        urlObj.pathname = '/';
        urlObj.search = '';
      }
      // ref 파라미터가 혹시 URL에 남아있다면 순수 URL 보장을 위해 제거
      urlObj.searchParams.delete('ref');
      urlObj.searchParams.delete('r');
      urlObj.searchParams.delete('referral');
      shareUrl = urlObj.toString();
    } catch (e) {
      // fallback
    }
    
    // 복사/공유 텍스트 (카카오톡 및 문자 전달 시 순수 링크가 본문 메시지에 명확히 포함되도록 포맷)
    const outgoingTitle = shareOutgoingTitle || customTitle;
    const outgoingBody = shareMessage !== undefined ? shareMessage : description;

    const shareText = outgoingBody 
      ? `${outgoingTitle}\n\n${outgoingBody}\n\n👉 바로가기: ${shareUrl}`
      : `${outgoingTitle}\n\n👉 바로가기: ${shareUrl}`;
    const textToCopy = `${shareText}`;

    // 모바일 / PWA Web Share API 우선 호출 (카카오톡, 문자 등 네이티브 공유창 호출)
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: outgoingTitle,
          text: shareText,
          url: shareUrl,
        });
        triggerHaptic('success');
        return;
      } catch (err: any) {
        // 유저가 취소(AbortError)한 경우 복사 fallback 하지 않고 종료
        if (err?.name === 'AbortError') {
          return;
        }
        console.log('[HubShareSquare] Native share fallback to clipboard:', err);
      }
    }
    
    // PC 또는 네이티브 미지원 환경: 클립보드 복사
    try {
      await navigator.clipboard.writeText(textToCopy);
      triggerHaptic('success');
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (e) {
      console.error('[HubShareSquare] Clipboard copy failed:', e);
    }
  };

  return (
    <div className={`w-[160px] bg-gradient-to-br from-indigo-600 via-blue-600 to-sky-500 rounded-2xl p-5 text-white relative overflow-hidden shadow-lg ${className}`}>
      {/* 3D 느낌의 꾸밈 요소 */}
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10 blur-xl"></div>
      <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-indigo-900/20 blur-xl"></div>

      <div className="relative z-10 flex flex-col h-full justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold leading-snug tracking-tight line-clamp-2">
            {customTitle}
          </h3>
          <p className="text-[11px] text-blue-100 mt-2 leading-relaxed opacity-90 whitespace-pre-line">
            {description}
          </p>
        </div>

        <button
          onClick={handleShare}
          className={`w-full flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold cursor-pointer transition-all shadow-sm active:scale-[0.98] ${
            isCopied 
              ? 'bg-emerald-500 text-white shadow-emerald-500/20' 
              : 'bg-white text-blue-600 hover:bg-blue-50 shadow-white/10'
          }`}
        >
          {isCopied ? (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              복사 완료!
            </>
          ) : canNativeShare ? (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              주변에 알려주기
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              주변에 알려주기
            </>
          )}
        </button>
      </div>
    </div>
  );
};
