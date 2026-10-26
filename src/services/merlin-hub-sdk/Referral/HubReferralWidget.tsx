/**
 * Version: v2.0.0
 * Last Updated: 2026-10-24
 */
import React, { useState } from 'react';

interface HubReferralWidgetProps {
  className?: string;
  title?: string;
  description?: string;
}

/**
 * [Custom] 순수 공유 위젯 (하위 호환용)
 * 추천인 코드 없이 현재 앱의 순수 링크를 복사/공유할 수 있는 UI 컴포넌트입니다.
 */
export const HubReferralWidget: React.FC<HubReferralWidgetProps> = ({
  className = '',
  title = '써보니 편한 기능, 주변에도 알려주세요',
  description = '혼자 쓰기 아까운 AI 도구를 가족·지인과 함께 나눠보세요.',
}) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleShare = async () => {
    if (typeof window === 'undefined') return;
    const shareUrl = window.location.origin;
    const shareText = `${title}\n\n${description}\n\n👉 바로가기: ${shareUrl}`;

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(shareText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {}
  };

  return (
    <div className={`w-full bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white relative overflow-hidden shadow-lg ${className}`}>
      <div className="relative z-10 flex flex-col items-center text-center">
        <h3 className="text-xl font-bold mb-1">{title}</h3>
        <p className="text-sm text-indigo-100 mb-5">{description}</p>

        <button
          onClick={handleShare}
          className={`px-6 py-3 rounded-xl font-bold transition-all cursor-pointer ${
            isCopied ? 'bg-emerald-500 text-white' : 'bg-white text-indigo-600 hover:bg-indigo-50'
          }`}
        >
          {isCopied ? '복사 완료!' : '주변에 알려주기'}
        </button>
      </div>
    </div>
  );
};
