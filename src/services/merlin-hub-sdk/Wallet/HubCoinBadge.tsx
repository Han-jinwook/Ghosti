'use client';

/**
 * Version: v1.1.0
 * Last Updated: 2026-11-16
 * Description: 전 패밀리 앱 상단 헤더 우측 귀신코인 잔액 배지 & 충전소·선물함 진입 캡슐 표준 컴포넌트 (HubCoinBadge)
 * - 노션 QA 417f9ffd / 41af9ffd 반영: 어그로필터·센스톡·귀신같이 등 모든 유료 코인형 앱의 우측 상단 코인 배너(색상·디자인·서체)를 100% 단일 규격으로 통일
 * - 3D 아기귀신 코인 마스코트(GHOST_COIN_WINK_BASE64) + 보유 코인(N,NNN C) + '+ 충전' 알약 캡슐 + 자체 @font-face 내장
 */
import React, { useState, useEffect } from 'react';
import { Gift, Plus } from 'lucide-react';
import { useHub } from '../HubProvider';
import { GHOST_COIN_WINK_BASE64 } from '../assets/ghostCoinBase64';
import { getGiftList } from './wallet';

export interface HubCoinBadgeProps {
  onClick?: () => void;
  onGiftClick?: () => void;
  showGiftButton?: boolean;
  showChargeLabel?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export const HubCoinBadge: React.FC<HubCoinBadgeProps> = ({
  onClick,
  onGiftClick,
  showGiftButton = false,
  showChargeLabel = true,
  size = 'md',
  className = '',
}) => {
  const { isLoggedIn, balance } = useHub();
  const [unclaimedGiftCount, setUnclaimedGiftCount] = useState(0);

  useEffect(() => {
    if (!isLoggedIn) {
      setUnclaimedGiftCount(0);
      return;
    }
    const syncGifts = () => {
      getGiftList()
        .then((res) => {
          if (res.success && typeof res.unclaimedCount === 'number') {
            setUnclaimedGiftCount(res.unclaimedCount);
          }
        })
        .catch(() => {});
    };
    syncGifts();
    window.addEventListener('giftsUpdated', syncGifts);
    return () => window.removeEventListener('giftsUpdated', syncGifts);
  }, [isLoggedIn]);

  if (!isLoggedIn) return null;

  const coinBalance = typeof balance === 'number' ? balance : 0;
  const isSmall = size === 'sm';

  const handleMainClick = () => {
    if (onClick) {
      onClick();
    } else if (typeof window !== 'undefined') {
      window.location.href = '/payment/purchase?tab=charge';
    }
  };

  const handleGiftBtnClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onGiftClick) {
      onGiftClick();
    } else if (onClick) {
      onClick();
    } else if (typeof window !== 'undefined') {
      window.location.href = '/payment/purchase?tab=gift&giftSubTab=send';
    }
  };

  return (
    <div className={`inline-flex items-center gap-1.5 shrink-0 ${className}`}>
      <style>{`
        @font-face {
          font-family: 'Cafe24Ssurround';
          src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2105_2@1.0/Cafe24Ssurround.woff') format('woff');
          font-weight: normal;
          font-style: normal;
          font-display: swap;
        }
        @font-face {
          font-family: 'TmoneyRoundWindExtraBold';
          src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_20-07@1.0/TmoneyRoundWindExtraBold.woff') format('woff');
          font-weight: normal;
          font-style: normal;
          font-display: swap;
        }
      `}</style>
      <button
        type="button"
        onClick={handleMainClick}
        title="귀신코인 충전소 · 선물함 열기"
        className={`group relative inline-flex items-center gap-1.5 rounded-full transition-all cursor-pointer active:scale-95 select-none ${
          isSmall ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-xs sm:text-[13px]'
        }`}
        style={{
          fontFamily: "'Cafe24Ssurround', 'TmoneyRoundWindExtraBold', 'Pretendard', sans-serif",
          background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 52%, #fef3c7 100%)',
          border: '1.5px solid #a5b4fc',
          boxShadow: '0 1px 2px rgba(79, 70, 229, 0.08)',
        }}
      >
        <img
          src={GHOST_COIN_WINK_BASE64}
          alt="귀신코인"
          onError={(e) => {
            const target = e.currentTarget;
            if (!target.src.includes('os.sundreamer.app')) {
              target.src = 'https://os.sundreamer.app/hub_assets/ghost_coin_wink.webp';
            }
          }}
          className={`${isSmall ? 'w-4 h-4' : 'w-5 h-5'} object-contain shrink-0 group-hover:scale-110 transition-transform`}
        />
        <span
          className="font-extrabold tabular-nums tracking-tight"
          style={{ color: '#1e1b4b' }}
        >
          {coinBalance.toLocaleString()}
        </span>
        <span
          className="font-extrabold text-[11px]"
          style={{ color: '#d97706' }}
        >
          C
        </span>
        {showChargeLabel ? (
          <span
            className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-0.5 shadow-2xs"
            style={{ backgroundColor: '#4f46e5', color: '#ffffff' }}
          >
            <Plus className="w-2.5 h-2.5 stroke-[3]" />
            <span>충전</span>
          </span>
        ) : (
          <span
            className="ml-0.5 w-4 h-4 rounded-full flex items-center justify-center shadow-2xs"
            style={{ backgroundColor: '#4f46e5', color: '#ffffff' }}
          >
            <Plus className="w-2.5 h-2.5 stroke-[3]" />
          </span>
        )}

        {unclaimedGiftCount > 0 && !showGiftButton && (
          <span className="absolute -top-1 -right-1 px-1 min-w-[16px] h-4 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center animate-bounce shadow">
            {unclaimedGiftCount}
          </span>
        )}
      </button>

      {showGiftButton && (
        <button
          type="button"
          onClick={handleGiftBtnClick}
          title="코인 선물함 열기"
          className={`relative inline-flex items-center justify-center rounded-full bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/90 shadow-2xs transition-all cursor-pointer active:scale-95 ${
            isSmall ? 'w-7 h-7' : 'w-8 h-8'
          }`}
        >
          <Gift className={isSmall ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
          {unclaimedGiftCount > 0 && (
            <span className="absolute -top-1 -right-1 px-1 min-w-[16px] h-4 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center animate-bounce shadow">
              {unclaimedGiftCount}
            </span>
          )}
        </button>
      )}
    </div>
  );
};
