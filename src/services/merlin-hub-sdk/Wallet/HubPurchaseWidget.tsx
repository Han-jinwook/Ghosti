import { GHOST_COIN_WINK_BASE64, GHOST_COIN_HUG_BASE64, GHOST_COIN_TITLE_BASE64 } from '../assets/ghostCoinBase64';
/**
 * Version: v1.5.0
 * Last Updated: 2026-11-03
 * Description:
 * - 『👻 귀신코인 공식 충전소』 브랜드 전면 개편 (아기귀신 3D 로고 & 3종 귀신코인 카드 장착)
 * - 어떤 앱 도메인(귀신같이, 어그로필터, 센스톡 등)에서도 이미지가 절대 깨지지 않도록 허브 CDN 절대경로 + 로컬 폴백 적용
 * - KCP 간편결제 다이렉트 호출(카카오페이 / 네이버페이 / 토스페이 / 삼성월렛 / 애플페이 / 신용·체크카드) 원터치 선택 지원 (기존 payMethodType="card" 하드코딩 버그 완전 해결)
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { hubFetch } from '../CoreLogic/client';
import { HubPaymentTrigger } from './HubPaymentTrigger';
import { HubGiftBoxModal, GiftProductItem } from './HubGiftBoxModal';
import { HubPayMethodType } from './wallet';
import { getConfig } from '../CoreLogic/config';
import { useHub } from '../HubProvider';

interface HistoryItem {
  id: number;
  type: string;
  amount: number;
  balance: number;
  description: string;
  display_text?: string;
  createdAt: string;
  created_at?: string;
  app_id?: string;
}

const getAppDisplayName = (appId?: string) => {
  if (!appId) return '귀신같이';
  const id = appId.toUpperCase();
  if (id === 'AGGROFILTER' || id === 'AGGRO_FILTER' || id === 'APP-01' || id === 'DEFAULT_APP') {
    return '어그로필터';
  }
  if (id === 'SENSETALK' || id === 'SENSE_TALK') {
    return '센스톡';
  }
  if (id === 'AUTONOTE' || id === 'AUTO_NOTE') {
    return '오토노트';
  }
  if (id === 'VAULTER' || id === 'Vaulter') {
    return '금고지기';
  }
  if (id === 'BES2') {
    return 'Bes2';
  }
  if (id === 'WHATTOEAT' || id === 'WHATEAT') {
    return '뭐먹지';
  }
  if (id === 'SUNDREAMER' || id === 'SUNDREAM') {
    return '썬드리머';
  }
  if (id === 'GHOSTI' || id === 'ZEYE' || id === 'Z-EYE' || id === 'SAYSEE') {
    return '귀신같이';
  }
  return appId;
};

const PAY_METHOD_OPTIONS: Array<{
  id: HubPayMethodType;
  label: string;
  subLabel: string;
  badge?: string;
  badgeColor?: string;
  dotColor: string;
  activeBorder: string;
  activeBg: string;
}> = [
  {
    id: 'kakaopay',
    label: '카카오페이',
    subLabel: '카톡 간편결제 · 머니/카드',
    badge: '인기',
    badgeColor: 'bg-amber-400 text-slate-950',
    dotColor: 'bg-[#FEE500] text-[#191919]',
    activeBorder: 'border-amber-500 ring-2 ring-amber-400/30',
    activeBg: 'bg-amber-50/70',
  },
  {
    id: 'naverpay',
    label: '네이버페이 (Npay)',
    subLabel: '네이버 포인트 · 간편카드',
    badge: '추천',
    badgeColor: 'bg-emerald-500 text-white',
    dotColor: 'bg-[#03C75A] text-white',
    activeBorder: 'border-emerald-600 ring-2 ring-emerald-500/30',
    activeBg: 'bg-emerald-50/70',
  },
  {
    id: 'tosspay',
    label: '토스페이',
    subLabel: '토스 앱 1초 간편결제',
    dotColor: 'bg-[#0064FF] text-white',
    activeBorder: 'border-blue-600 ring-2 ring-blue-500/30',
    activeBg: 'bg-blue-50/70',
  },
  {
    id: 'sspay',
    label: '삼성월렛 (삼성페이)',
    subLabel: '갤럭시/삼성카드 간편결제',
    dotColor: 'bg-[#1428A0] text-white',
    activeBorder: 'border-indigo-700 ring-2 ring-indigo-500/30',
    activeBg: 'bg-indigo-50/70',
  },
  {
    id: 'applepay',
    label: '애플페이 (Apple Pay)',
    subLabel: '아이폰 · 현대카드 간편결제',
    dotColor: 'bg-slate-900 text-white',
    activeBorder: 'border-slate-800 ring-2 ring-slate-400/30',
    activeBg: 'bg-slate-100/80',
  },
  {
    id: 'card',
    label: '신용 / 체크카드 (일반)',
    subLabel: '국내 모든 카드사 통합결제',
    dotColor: 'bg-indigo-600 text-white',
    activeBorder: 'border-indigo-600 ring-2 ring-indigo-500/30',
    activeBg: 'bg-indigo-50/70',
  },
];

export interface HubPurchaseWidgetProps {
  appName?: string;
  redirectUrl?: string;
  initialTab?: 'charge' | 'history' | 'gift';
  isModal?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
  onSuccess?: () => void;
  onError?: (err: string) => void;
  customGiftProducts?: GiftProductItem[];
  minCustomCoin?: number;
}

export const HubPurchaseWidget: React.FC<HubPurchaseWidgetProps> = ({
  appName = '귀신같이',
  redirectUrl = '/',
  initialTab = 'charge',
  isModal = false,
  isOpen = true,
  onClose,
  onSuccess,
  onError,
  customGiftProducts,
  minCustomCoin,
}) => {
  const [redirectUrlParam, setRedirectUrlParam] = useState<string>(redirectUrl);
  const { balance: hubBalance } = useHub();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlFromQuery = params.get('redirectUrl');
      if (urlFromQuery) {
        setRedirectUrlParam(urlFromQuery);
      }
      const tabFromQuery = params.get('tab');
      if (tabFromQuery === 'charge' || tabFromQuery === 'history' || tabFromQuery === 'gift') {
        setTab(tabFromQuery as 'charge' | 'history' | 'gift');
      }
    }
  }, []);

  const targetRedirectUrl = redirectUrlParam.startsWith('/') ? redirectUrlParam : '/';

  const [selectedOption, setSelectedOption] = useState<number>(0);
  const [tab, setTab] = useState<'charge' | 'history' | 'gift'>(initialTab);
  const [giftSubTab, setGiftSubTab] = useState<'received' | 'sent' | 'send'>('received');
  const [method, setMethod] = useState<HubPayMethodType>('kakaopay');
  const [allHistory, setAllHistory] = useState<HistoryItem[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [origin, setOrigin] = useState('');

  const [filterType, setFilterType] = useState<'all' | 'charge' | 'use'>('all');
  const [filterApp, setFilterApp] = useState<'all' | string>(appName);
  const [filterPeriod, setFilterPeriod] = useState<'1m' | '3m' | '6m' | '1y' | 'all'>('1m');

  const uid = typeof window !== 'undefined' ? (localStorage.getItem('merlin_user_id') || '') : '';

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    if (!uid) return;
    try {
      setHistoryLoading(true);
      const res = await hubFetch(`/api/wallet/history?userId=${encodeURIComponent(uid)}&limit=1000`);
      if (res.ok && res.data.history) {
        setAllHistory(res.data.history);
      }
    } catch (_error) {
    } finally {
      setHistoryLoading(false);
    }
  }, [uid]);

  const filteredHistory = useMemo(() => {
    let result = allHistory;
    
    if (filterType === 'charge') {
      result = result.filter(item => Number(item.amount) > 0);
    } else if (filterType === 'use') {
      result = result.filter(item => Number(item.amount) <= 0);
    }

    if (filterApp !== 'all') {
      result = result.filter(item => {
        const itemAppName = getAppDisplayName(item.app_id);
        return itemAppName === filterApp;
      });
    }

    if (filterPeriod !== 'all') {
      const now = new Date();
      let limitDate = new Date();
      if (filterPeriod === '1m') limitDate.setMonth(now.getMonth() - 1);
      if (filterPeriod === '3m') limitDate.setMonth(now.getMonth() - 3);
      if (filterPeriod === '6m') limitDate.setMonth(now.getMonth() - 6);
      if (filterPeriod === '1y') limitDate.setFullYear(now.getFullYear() - 1);
      
      result = result.filter(item => {
        const d = new Date(item.created_at || item.createdAt);
        return d >= limitDate;
      });
    }
    return result;
  }, [allHistory, filterType, filterApp, filterPeriod, appName]);

  const itemsPerPage = 10;
  const historyTotalPages = Math.max(1, Math.ceil(filteredHistory.length / itemsPerPage));
  const currentHistory = filteredHistory.slice((historyPage - 1) * itemsPerPage, historyPage * itemsPerPage);

  useEffect(() => {
    if (tab === 'history' && allHistory.length === 0) {
      fetchHistory();
    }
  }, [tab, fetchHistory, allHistory.length]);

  useEffect(() => {
    setHistoryPage(1);
  }, [filterType, filterApp, filterPeriod]);

  const config = getConfig();
  const hubBaseUrl = (config?.hubUrl || 'https://os.sundreamer.app').replace(/\/+$/, '');

  const options = useMemo(
    () => [
      {
        credits: 1000,
        price: 1000,
        discount: 0,
        imgSrc: `${hubBaseUrl}/hub_assets/card_1000.png?v=ghost2`,
        fallbackSrc: '/hub_assets/card_1000.png?v=ghost2',
      },
      {
        credits: 5000,
        price: 4750,
        discount: 5,
        imgSrc: `${hubBaseUrl}/hub_assets/card_5000.png?v=ghost2`,
        fallbackSrc: '/hub_assets/card_5000.png?v=ghost2',
      },
      {
        credits: 10000,
        price: 9000,
        discount: 10,
        imgSrc: `${hubBaseUrl}/hub_assets/card_10000.png?v=ghost2`,
        fallbackSrc: '/hub_assets/card_10000.png?v=ghost2',
      },
    ],
    [hubBaseUrl]
  );

  // 귀신코인 충전 금액 및 할인율 동적 계산 (1만 이상 5%, 3만 이상 10%, 5만 이상 10%)
  const calculatePrice = (coin: number) => {
    if (coin >= 30000) return Math.round(coin * 0.9); // 10% 할인
    if (coin >= 10000) return Math.round(coin * 0.95); // 5% 할인
    return coin;
  };

  const discountPercent = useMemo(() => {
    if (selectedOption >= 30000) return 10;
    if (selectedOption >= 10000) return 5;
    return 0;
  }, [selectedOption]);

  const finalPrice = useMemo(() => calculatePrice(selectedOption), [selectedOption]);

  const selectedPkg = useMemo(() => ({
    credits: selectedOption,
    price: finalPrice,
    discount: discountPercent,
  }), [selectedOption, finalPrice, discountPercent]);

  const selectedMethodObj = useMemo(
    () => PAY_METHOD_OPTIONS.find((m) => m.id === method) || PAY_METHOD_OPTIONS[0],
    [method]
  );

  const formatDate = (iso: string) => {
    if (!iso) return '...';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '...';
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(
      d.getMinutes()
    ).padStart(2, '0')}`;
  };

  if (isModal && !isOpen) return null;

  if (!mounted) {
    return (
      <div className="min-h-[360px] bg-slate-50 flex items-center justify-center rounded-2xl">
        <svg className="animate-spin h-8 w-8 text-indigo-600" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  const innerContent = (
    <div
      data-keep-dark="true"
      className={`hub-purchase-widget ${isModal ? '' : 'min-h-screen'} bg-slate-50 text-slate-800 rounded-2xl`}
      style={{ fontFamily: "'TmoneyRoundWindExtraBold', 'Cafe24Ssurround', sans-serif" }}
    >
      <style>{`
        @font-face {
          font-family: 'Cafe24Ssurround';
          src: url('https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_2105_2@1.0/Cafe24Ssurround.woff') format('woff');
          font-weight: normal;
          font-style: normal;
          font-display: swap;
        }
        @font-face {
          font-family: 'TmoneyRoundWindExtraBold';
          src: url('https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_20-07@1.0/TmoneyRoundWindExtraBold.woff') format('woff');
          font-weight: normal;
          font-style: normal;
          font-display: swap;
        }
        /* 원포인트 다크 카드 집중 디자인: 중앙 메인 귀신코인 카드(.gh-dark-card) 단 하나만 진한 밤하늘 네이비로 유지하고, 상단 제목상자·탭·금액 버튼은 산뜻하고 힘 뺀 라이트 톤으로 고정 */
        html body .hub-purchase-widget .gh-light-banner,
        html.theme-warm-light body .hub-purchase-widget .gh-light-banner {
          background-image: linear-gradient(135deg, #ffffff 0%, #f4f7ff 55%, #eef4ff 100%) !important;
          background-color: #f8fafc !important;
          border-color: #dbe4f3 !important;
          box-shadow: 0 4px 16px rgba(15, 23, 42, 0.05) !important;
          color: #1e293b !important;
        }
        html body .hub-purchase-widget .gh-light-tab,
        html.theme-warm-light body .hub-purchase-widget .gh-light-tab {
          background-image: none !important;
          background-color: #ffffff !important;
          border-color: #cbd5e1 !important;
          box-shadow: 0 2px 6px rgba(15, 23, 42, 0.06) !important;
          color: #1e293b !important;
        }
        html body .hub-purchase-widget .gh-dark-card,
        html.theme-warm-light body .hub-purchase-widget .gh-dark-card {
          background-image: linear-gradient(180deg, #0d1230 0%, #0f173a 50%, #0a0e27 100%) !important;
          background-color: #0d1230 !important;
          border-color: rgba(252, 211, 77, 0.85) !important;
          box-shadow: 0 10px 28px rgba(13, 18, 48, 0.35), 0 0 12px rgba(251, 191, 36, 0.14) !important;
          color: #ffffff !important;
        }
        html body .hub-purchase-widget .gh-dark-badge-0,
        html.theme-warm-light body .hub-purchase-widget .gh-dark-badge-0 {
          background-color: rgba(255, 255, 255, 0.12) !important;
          color: #cffafe !important;
          border-color: rgba(103, 232, 249, 0.3) !important;
        }
        html body .hub-purchase-widget .gh-light-btn-1,
        html.theme-warm-light body .hub-purchase-widget .gh-light-btn-1 {
          background-image: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%) !important;
          background-color: #ffffff !important;
          border-color: #cbd5e1 !important;
          box-shadow: 0 2px 6px rgba(15, 23, 42, 0.05) !important;
          color: #334155 !important;
        }
        html body .hub-purchase-widget .gh-light-btn-2,
        html.theme-warm-light body .hub-purchase-widget .gh-light-btn-2 {
          background-image: linear-gradient(180deg, #ffffff 0%, #f5f7ff 100%) !important;
          background-color: #ffffff !important;
          border-color: #bac8ff !important;
          box-shadow: 0 2px 6px rgba(59, 91, 219, 0.07) !important;
          color: #364fc7 !important;
        }
        html body .hub-purchase-widget .gh-light-btn-3,
        html.theme-warm-light body .hub-purchase-widget .gh-light-btn-3 {
          background-image: linear-gradient(180deg, #ffffff 0%, #eef2ff 100%) !important;
          background-color: #ffffff !important;
          border-color: #91a7ff !important;
          box-shadow: 0 2px 8px rgba(59, 91, 219, 0.1) !important;
          color: #2b44b8 !important;
        }
        html body .hub-purchase-widget .gh-dark-cta,
        html.theme-warm-light body .hub-purchase-widget .gh-dark-cta {
          background-image: linear-gradient(180deg, #1b2554 0%, #131b40 50%, #0b1029 100%) !important;
          background-color: #131b40 !important;
          border-color: rgba(252, 211, 77, 0.85) !important;
          box-shadow: 0 10px 24px rgba(13, 18, 48, 0.35) !important;
          color: #ffffff !important;
        }
        html body .hub-purchase-widget .text-white,
        html.theme-warm-light body .hub-purchase-widget .text-white {
          color: #ffffff !important;
        }
        html body .hub-purchase-widget .text-amber-300,
        html.theme-warm-light body .hub-purchase-widget .text-amber-300 {
          color: #fcd34d !important;
        }
        html body .hub-purchase-widget .text-cyan-200,
        html.theme-warm-light body .hub-purchase-widget .text-cyan-200 {
          color: #a5f3fc !important;
        }
        html body .hub-purchase-widget .text-cyan-100\/90,
        html.theme-warm-light body .hub-purchase-widget .text-cyan-100\/90 {
          color: rgba(207, 250, 254, 0.92) !important;
        }
        html body .hub-purchase-widget .text-slate-900,
        html.theme-warm-light body .hub-purchase-widget .text-slate-900 {
          color: #0f172a !important;
        }
        html body .hub-purchase-widget .text-slate-800,
        html.theme-warm-light body .hub-purchase-widget .text-slate-800 {
          color: #1e293b !important;
        }
        html body .hub-purchase-widget .text-slate-700,
        html.theme-warm-light body .hub-purchase-widget .text-slate-700 {
          color: #334155 !important;
        }
      `}</style>
      <main className="mx-auto max-w-[var(--app-max-width,720px)] px-4 py-4 space-y-3.5">
        {/* 상단 귀신코인 공식 브랜드 헤더 배너 (힘을 뺀 산뜻한 라이트 파스텔 카드) */}
        <div className="gh-light-banner rounded-2xl bg-gradient-to-r from-white via-[#f4f7ff] to-[#eef4ff] p-4 sm:p-5 text-slate-800 shadow-sm border border-slate-200/90 flex items-center justify-between relative">
          {isModal && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-300/80 flex items-center justify-center text-slate-600 transition-colors cursor-pointer"
              aria-label="충전소 닫기"
            >
              ✕
            </button>
          )}
          <div className="flex items-center gap-3.5 sm:gap-4">
            <div className="relative shrink-0">
              <img 
                src={`${hubBaseUrl}/ghosti.png`}
                onError={(e) => {
                  const target = e.currentTarget;
                  if (!target.src.endsWith('/guishinfam_icon.webp')) {
                    target.src = '/hub_assets/guishinfam_icon.webp';
                  }
                }}
                alt="귀신코인 아기귀신 로고" 
                className="h-14 sm:h-16 w-14 sm:w-16 object-contain rounded-2xl border border-slate-200 shadow-sm" 
              />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span
                  className="text-xl sm:text-2xl tracking-wide text-slate-800"
                  style={{
                    fontFamily: "'Cafe24Ssurround', 'TmoneyRoundWindExtraBold', sans-serif",
                  }}
                >
                  귀신코인 충전소
                </span>
                <span
                  className="text-[11px] px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/80 tracking-wide"
                  style={{ fontFamily: "'Cafe24Ssurround', 'TmoneyRoundWindExtraBold', sans-serif" }}
                >
                  GHOST COIN 공식 센터
                </span>
              </div>
              <p
                className="text-xs text-slate-500 mt-1.5 tracking-wide"
                style={{ fontFamily: "'TmoneyRoundWindExtraBold', 'Cafe24Ssurround', sans-serif" }}
              >
                귀신같이 시리즈 & 패밀리 솔루션({appName}) 공용 귀신코인 충전
              </p>
            </div>
          </div>
          <div className={`text-right hidden sm:block border-l border-slate-200 pl-4 ${isModal && onClose ? ' pr-7' : ''}`}>
            <span
              className="text-xs text-indigo-700 block tracking-wide"
              style={{ fontFamily: "'Cafe24Ssurround', 'TmoneyRoundWindExtraBold', sans-serif" }}
            >
              NHN KCP / 5대 간편결제 공식 제휴
            </span>
            <span
              className="text-[11px] text-slate-500 mt-0.5 block"
              style={{ fontFamily: "'TmoneyRoundWindExtraBold', sans-serif" }}
            >
              가맹점 상점명: 3몬스터
            </span>
          </div>
        </div>

        {/* 탭 전환 영역 (힘을 뺀 산뜻한 화이트 탭) */}
        <div
          className="bg-slate-100 p-1.5 border border-slate-200/90 rounded-2xl flex gap-1.5"
          style={{ fontFamily: "'Cafe24Ssurround', 'TmoneyRoundWindExtraBold', sans-serif" }}
        >
          <button
            onClick={() => setTab('charge')}
            className={tab === 'charge'
              ? "gh-light-tab flex-1 rounded-xl py-2.5 text-sm tracking-wide bg-white text-slate-800 border border-slate-300/90 shadow-xs transition-all cursor-pointer"
              : "flex-1 rounded-xl py-2.5 text-sm tracking-wide text-slate-500 hover:text-slate-800 hover:bg-white/60 transition-all active:scale-[0.98] cursor-pointer"
            }
          >
            👻 충전하기
          </button>
          <button
            onClick={() => {
              setGiftSubTab('received');
              setTab('gift');
            }}
            className={tab === 'gift'
              ? "flex-1 rounded-xl py-2.5 text-sm tracking-wide bg-rose-50 text-rose-600 border border-rose-200 shadow-xs transition-all cursor-pointer"
              : "flex-1 rounded-xl py-2.5 text-sm tracking-wide text-rose-500 hover:text-rose-600 hover:bg-rose-50/60 transition-all active:scale-[0.98] cursor-pointer"
            }
          >
            🎁 선물함 · 선물하기
          </button>
          <button
            onClick={() => setTab('history')}
            className={tab === 'history'
              ? "gh-light-tab flex-1 rounded-xl py-2.5 text-sm tracking-wide bg-white text-slate-800 border border-slate-300/90 shadow-xs transition-all cursor-pointer"
              : "flex-1 rounded-xl py-2.5 text-sm tracking-wide text-slate-500 hover:text-slate-800 hover:bg-white/60 transition-all active:scale-[0.98] cursor-pointer"
            }
          >
            이용 내역
          </button>
        </div>

        {/* 충전 탭 화면 */}
        {tab === 'charge' && (
          <div className="space-y-4">
            {/* 1. 귀신코인 스마트 충전 카드 (군더더기 제로 & 네이버페이식 누적 충전) */}
            <div className="rounded-3xl border-2 border-slate-200/90 bg-white p-5 sm:p-7 shadow-lg">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-6 rounded-full bg-gradient-to-b from-indigo-500 to-indigo-800 block shadow-2xs"></span>
                  <h2
                    className="text-lg sm:text-xl text-slate-900 tracking-wide"
                    style={{ fontFamily: "'Cafe24Ssurround', 'TmoneyRoundWindExtraBold', sans-serif" }}
                  >
                    귀신코인 충전
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setGiftSubTab('send');
                    setTab('gift');
                  }}
                  className="px-4 py-1.5 rounded-xl bg-gradient-to-b from-rose-50 to-rose-100/80 hover:from-rose-100 hover:to-rose-200/80 text-rose-600 border border-rose-200/90 text-xs tracking-wide transition-all cursor-pointer shadow-2xs hover:scale-102"
                  style={{ fontFamily: "'Cafe24Ssurround', 'TmoneyRoundWindExtraBold', sans-serif" }}
                >
                  🎁 보유 귀신코인으로 지인에게 선물하기 ›
                </button>
              </div>

              {/* 🏆 컴팩트 단일 스마트 카드 (아기귀신 2배 확대 + 3D 도자기체 귀신코인 & 품위있는 라운드 도자기 서체 + 카드 밖 우측 초기화) */}
              <div className="mx-auto max-w-md">
                <div
                  data-keep-dark="true" className="gh-dark-card relative rounded-2xl overflow-hidden shadow-xl border border-amber-300/85 ring-1 ring-amber-400/25 shadow-[0_10px_28px_rgba(13,18,48,0.45),0_0_12px_rgba(251,191,36,0.18)] bg-gradient-to-b from-[#0d1230] via-[#0f173a] to-[#0a0e27] p-5 sm:p-6 text-white transition-all"
                  style={{ fontFamily: "'Cafe24Ssurround', 'TmoneyRoundWindExtraBold', sans-serif" }}
                >
                  <div className="absolute top-0 right-1/4 w-48 h-48 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
                  <div className="absolute bottom-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

                  {/* 메인 컨텐츠: 아기귀신(가로·세로 2배 큼직하게 + 경계선 자연 블렌딩) + 우측 상단부터 정렬된 도자기체 텍스트 & 금액 */}
                  <div className="relative z-10 flex items-stretch justify-between gap-4">
                    {/* 좌측: 마스코트 (가로·세로 2배 확대) + 진짜 3D 백자·청자 도자기체 귀신코인 로고 */}
                    <div className="flex flex-col items-center shrink-0">
                      <div className="w-32 h-32 sm:w-36 sm:h-36 flex items-center justify-center">
                        <img
                          src={selectedOption >= 30000 ? GHOST_COIN_HUG_BASE64 : GHOST_COIN_WINK_BASE64}
                          alt="귀신코인"
                          className="w-full h-full object-contain filter drop-shadow-[0_6px_16px_rgba(0,0,0,0.5)]"
                          style={{
                            WebkitMaskImage: 'radial-gradient(circle at 50% 50%, black 52%, rgba(0,0,0,0.68) 72%, transparent 97%)',
                            maskImage: 'radial-gradient(circle at 50% 50%, black 52%, rgba(0,0,0,0.68) 72%, transparent 97%)',
                          }}
                        />
                      </div>
                      <img
                        src={GHOST_COIN_TITLE_BASE64}
                        alt="귀신코인"
                        className="h-9 sm:h-10 w-auto object-contain -mt-1 pointer-events-none select-none"
                      />
                    </div>

                    {/* 우측: 위쪽으로 바짝 올린 도자기체 귀신팸 패밀리 앱 공용 코인 + 상시 노출 할인 뱃지(0% 포함) + 도자기체 금액 */}
                    <div className="flex-1 text-right flex flex-col justify-between py-0.5">
                      <div className="flex flex-col items-end gap-1.5 -mt-1">
                        <span
                          className="text-xs sm:text-[13px] tracking-wide text-cyan-200 drop-shadow-sm"
                          style={{
                            fontFamily: "'Cafe24Ssurround', 'TmoneyRoundWindExtraBold', sans-serif",
                            filter: 'drop-shadow(0 1.5px 0 #0d4a56) drop-shadow(0 2px 6px rgba(45,212,191,0.3))',
                          }}
                        >
                          귀신팸 패밀리 앱 공용 코인
                        </span>
                        <span
                          className={`text-[11px] px-3 py-0.5 rounded-full shadow-xs transition-all tracking-wide ${
                            discountPercent > 0
                              ? 'bg-gradient-to-b from-rose-400 via-rose-500 to-pink-600 text-white border border-rose-300/50 shadow-[0_2px_8px_rgba(244,63,94,0.4)]'
                              : 'gh-dark-badge-0 bg-white/10 text-cyan-100/90 border border-cyan-300/25'
                          }`}
                          style={{
                            fontFamily: "'Cafe24Ssurround', 'TmoneyRoundWindExtraBold', sans-serif",
                          }}
                        >
                          {discountPercent}% 할인
                        </span>
                      </div>

                      <div className="mt-2">
                        <div
                          className="text-2xl sm:text-3xl tracking-wide flex items-baseline justify-end gap-1.5"
                          style={{
                            fontFamily: "'Cafe24Ssurround', 'TmoneyRoundWindExtraBold', sans-serif",
                          }}
                        >
                          <span
                            className="text-white drop-shadow-md"
                            style={{
                              filter: 'drop-shadow(0 2px 0 #134e4a) drop-shadow(0 4px 10px rgba(45,212,191,0.35))',
                            }}
                          >
                            {selectedOption.toLocaleString()}
                          </span>
                          <span
                            className="text-lg sm:text-xl text-cyan-200 drop-shadow-sm"
                            style={{
                              filter: 'drop-shadow(0 2px 0 #115e59) drop-shadow(0 3px 8px rgba(45,212,191,0.3))',
                            }}
                          >
                            코인
                          </span>
                        </div>
                        <div className="mt-1.5 flex items-center justify-end gap-2">
                          {discountPercent > 0 && (
                            <span
                              className="text-xs text-slate-400 line-through"
                              style={{ fontFamily: "'TmoneyRoundWindExtraBold', sans-serif" }}
                            >
                              {selectedOption.toLocaleString()}원
                            </span>
                          )}
                          <span
                            className="text-xl sm:text-2xl tracking-wide text-amber-300 drop-shadow-md"
                            style={{
                              fontFamily: "'Cafe24Ssurround', 'TmoneyRoundWindExtraBold', sans-serif",
                              filter: 'drop-shadow(0 2px 0 #78350f) drop-shadow(0 4px 10px rgba(251,191,36,0.35))',
                            }}
                          >
                            {finalPrice.toLocaleString()}원
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 카드 밖 우측 하단: 0 코인 초기화 버튼 */}
                <div className="mt-2.5 flex justify-end px-1">
                  <button
                    type="button"
                    onClick={() => setSelectedOption(0)}
                    className="text-xs text-slate-600 hover:text-indigo-700 bg-slate-100 hover:bg-slate-200/80 border border-slate-300/80 px-3 py-1 rounded-full cursor-pointer transition-all flex items-center gap-1 shadow-2xs active:scale-95"
                    style={{ fontFamily: "'Cafe24Ssurround', 'TmoneyRoundWindExtraBold', sans-serif" }}
                  >
                    ↺ 0 코인 초기화
                  </button>
                </div>
              </div>

              {/* ⚡ 네이버페이식 누적 금액 권종 카드 (+1천, +5천, +1만, +5만 — 힘을 뺀 깔끔한 화이트·인디고 라이트 버튼) */}
              <div className="mt-4 max-w-md mx-auto">
                <div
                  className="grid grid-cols-4 gap-2.5"
                  style={{ fontFamily: "'Cafe24Ssurround', 'TmoneyRoundWindExtraBold', sans-serif" }}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedOption((prev) => Math.min(prev + 1000, 1000000))}
                    className="gh-light-btn-1 py-3.5 rounded-2xl text-base sm:text-[17px] tracking-wide transition-all cursor-pointer active:scale-95 hover:-translate-y-0.5 bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 text-slate-700 shadow-xs"
                  >
                    <span>+1천</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedOption((prev) => Math.min(prev + 5000, 1000000))}
                    className="gh-light-btn-1 py-3.5 rounded-2xl text-base sm:text-[17px] tracking-wide transition-all cursor-pointer active:scale-95 hover:-translate-y-0.5 bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 text-slate-700 shadow-xs"
                  >
                    <span>+5천</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedOption((prev) => Math.min(prev + 10000, 1000000))}
                    className="gh-light-btn-2 py-3.5 rounded-2xl text-base sm:text-[17px] tracking-wide transition-all cursor-pointer active:scale-95 hover:-translate-y-0.5 bg-gradient-to-b from-white to-indigo-50/50 hover:to-indigo-50 border border-indigo-200 hover:border-indigo-300 text-indigo-700 shadow-xs"
                  >
                    <span>+1만</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedOption((prev) => Math.min(prev + 50000, 1000000))}
                    className="gh-light-btn-3 py-3.5 rounded-2xl text-base sm:text-[17px] tracking-wide transition-all cursor-pointer active:scale-95 hover:-translate-y-0.5 bg-gradient-to-b from-white to-indigo-50/80 hover:to-indigo-100/70 border border-indigo-300 hover:border-indigo-400 text-indigo-800 shadow-xs"
                  >
                    <span>+5만</span>
                  </button>
                </div>

                {/* 하단 할인 안내 (진하고 예쁘게 강조) */}
                <div
                  className="mt-3 py-2 px-3.5 rounded-xl bg-gradient-to-r from-slate-100 via-indigo-50/75 to-slate-100 border border-indigo-200/80 flex items-center justify-center flex-wrap gap-x-2 gap-y-1 text-xs sm:text-[13px] text-slate-700 shadow-2xs"
                  style={{ fontFamily: "'Cafe24Ssurround', 'TmoneyRoundWindExtraBold', sans-serif" }}
                >
                  <span>
                    1만원 이상 <strong className="text-rose-600 font-normal">5% 할인</strong>
                  </span>
                  <span className="text-slate-300">·</span>
                  <span>
                    3만원 이상 <strong className="text-rose-600 font-normal">10% 할인</strong>
                  </span>
                  <span className="text-slate-300">·</span>
                  <span>
                    5만원 이상 <strong className="text-rose-600 font-normal">10% 할인</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* 결제 수단 (간편결제 5종 다이렉트 호출 + 신용/체크카드) */}
            <div className="rounded-2xl border-2 border-slate-200 bg-white p-5 sm:p-6 shadow-md">
              <div className="flex items-center justify-between mb-3.5 flex-wrap gap-1">
                <h2
                  className="text-base sm:text-lg text-slate-900 tracking-wide"
                  style={{ fontFamily: "'Cafe24Ssurround', 'TmoneyRoundWindExtraBold', sans-serif" }}
                >
                  결제 수단
                </h2>
                <span
                  className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full"
                  style={{ fontFamily: "'TmoneyRoundWindExtraBold', sans-serif" }}
                >
                  원하시는 간편결제를 누르면 해당 앱 결제창이 바로 열립니다
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {PAY_METHOD_OPTIONS.map((item) => {
                  const isActive = method === item.id;
                  return (
                    <label
                      key={item.id}
                      onClick={() => setMethod(item.id)}
                      className={`flex items-center justify-between px-3.5 py-3 rounded-xl border-2 cursor-pointer transition-all ${
                        isActive
                          ? `${item.activeBorder} ${item.activeBg} shadow-sm`
                          : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="radio"
                          name="ghost_coin_pay_method"
                          checked={isActive}
                          onChange={() => setMethod(item.id)}
                          className="h-4 w-4 accent-indigo-600 shrink-0"
                        />
                        <div className="flex flex-col text-left min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="text-sm text-slate-900 truncate tracking-wide"
                              style={{ fontFamily: "'Cafe24Ssurround', 'TmoneyRoundWindExtraBold', sans-serif" }}
                            >
                              {item.label}
                            </span>
                            {item.badge && (
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${item.badgeColor}`}
                                style={{ fontFamily: "'Cafe24Ssurround', sans-serif" }}
                              >
                                {item.badge}
                              </span>
                            )}
                          </div>
                          <span
                            className="text-[11px] text-slate-500 truncate mt-0.5"
                            style={{ fontFamily: "'TmoneyRoundWindExtraBold', sans-serif" }}
                          >
                            {item.subLabel}
                          </span>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div
                className="mt-3.5 p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between flex-wrap gap-2 text-xs text-slate-600"
                style={{ fontFamily: "'TmoneyRoundWindExtraBold', 'Cafe24Ssurround', sans-serif" }}
              >
                <span className="text-slate-700">선택된 결제방식:</span>
                <span className="text-indigo-700">
                  {selectedMethodObj.label} · {selectedPkg.price.toLocaleString()}원 ({selectedPkg.credits.toLocaleString()} 귀신코인 즉시 충전)
                </span>
              </div>
            </div>

            {/* 결제 실행 버튼 (선택한 method를 payMethodType으로 정확히 전달!) */}
            <HubPaymentTrigger
              amount={selectedPkg.price}
              coinAmount={selectedPkg.credits}
              payMethodType={method}
              returnUrl={`${origin}/api/payment/callback?redirectUrl=${encodeURIComponent(targetRedirectUrl)}`}
              onSuccess={onSuccess}
              onError={onError}
              className="gh-dark-cta w-full rounded-2xl bg-gradient-to-b from-[#1b2554] via-[#131b40] to-[#0b1029] hover:from-[#222f68] hover:to-[#101738] py-5 text-lg text-white border border-amber-300/85 ring-1 ring-amber-400/25 shadow-[0_10px_24px_rgba(13,18,48,0.35)] hover:shadow-xl active:scale-[0.98] transition-all tracking-wide"
            >
              <span style={{ fontFamily: "'Cafe24Ssurround', 'TmoneyRoundWindExtraBold', sans-serif" }}>
                👻 {selectedOption.toLocaleString()} 귀신코인 결제하기 ({selectedMethodObj.label.split(' ')[0]})
              </span>
            </HubPaymentTrigger>
          </div>
        )}

        {/* 선물함 · 선물하기 탭 화면 */}
        {tab === 'gift' && (
          <HubGiftBoxModal inline={true} initialTab={giftSubTab} appName={appName} customProducts={customGiftProducts} minCustomCoin={minCustomCoin} />
        )}

        {/* 이용 내역 탭 화면 */}
        {tab === 'history' && (
          <div className="rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h2 className="text-base text-slate-900 font-extrabold">귀신코인 이용 내역</h2>
              <select 
                value={filterPeriod} 
                onChange={(e) => setFilterPeriod(e.target.value as any)}
                className="text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              >
                <option value="1m">1개월</option>
                <option value="3m">3개월</option>
                <option value="6m">6개월</option>
                <option value="1y">1년</option>
                <option value="all">전체기간</option>
              </select>
            </div>

            <div className="grid grid-cols-3 items-center gap-3 mb-4 bg-slate-50 p-2 rounded-xl border border-slate-100">
              {/* 필터 타입 (왼쪽) */}
              <div className="flex justify-start">
                <div className="flex bg-slate-200/50 p-1 rounded-full w-fit">
                  <button onClick={() => setFilterType('all')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${filterType === 'all' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>전체</button>
                  <button onClick={() => setFilterType('charge')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${filterType === 'charge' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>충전</button>
                  <button onClick={() => setFilterType('use')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${filterType === 'use' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>사용</button>
                </div>
              </div>

              {/* 앱 필터 (가운데) */}
              <div className="flex justify-center items-center gap-2">
                <span className="text-xs font-bold text-slate-500">앱</span>
                <select
                  value={filterApp}
                  onChange={(e) => setFilterApp(e.target.value)}
                  className="text-sm font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                >
                  <option value="all">모든 앱</option>
                  <option value={appName}>{appName}</option>
                </select>
              </div>

              {/* 최종 잔액 (오른쪽) */}
              <div className="flex justify-end items-center">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] sm:text-xs font-bold text-slate-500">보유 귀신코인</span>
                  <div className="px-2.5 h-8 min-w-[40px] rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 shadow-sm">
                    <span className="text-xs sm:text-sm font-black tabular-nums">
                      {typeof hubBalance === 'number' ? `${hubBalance.toLocaleString()} C` : '…'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {historyLoading ? (
              <div className="flex items-center justify-center py-10">
                <svg className="animate-spin h-6 w-6 text-indigo-600" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            ) : currentHistory.length === 0 ? (
              <div className="text-center py-10 text-sm font-medium text-slate-500">
                이용 내역이 존재하지 않습니다.
              </div>
            ) : (
              <div className="mt-4 divide-y divide-slate-100 max-h-[500px] overflow-y-auto pr-2">
                {currentHistory.map((item) => {
                  const rawDesc = item.display_text || item.description || '';
                  const itemAppName = getAppDisplayName(item.app_id);
                  let actionAndTitle = rawDesc
                    .replace('(신규)', '')
                    .replace('KCP 심사관 테스트 코인 충전 (5,000C)', '귀신코인 충전')
                    .trim();

                  const prefix = `${itemAppName} -`;
                  if (actionAndTitle.startsWith(prefix)) {
                    actionAndTitle = actionAndTitle.substring(prefix.length).trim();
                  } else if (actionAndTitle.startsWith(itemAppName)) {
                    actionAndTitle = actionAndTitle.substring(itemAppName.length).trim();
                  }

                  if (!actionAndTitle) {
                    actionAndTitle = rawDesc;
                  }

                  return (
                    <div key={item.id} className="border-b border-slate-100 py-3 hover:bg-slate-50/50 px-2 rounded-lg transition-colors">
                      <div className="flex items-center justify-between gap-4">
                        <div className="text-sm font-bold truncate flex-1 flex items-center gap-2 text-slate-800">
                          <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-600 border border-indigo-100">
                            {itemAppName}
                          </span>
                          <span className="truncate leading-tight">{actionAndTitle}</span>
                        </div>
                        <div
                          className={`text-sm font-black shrink-0 ${
                            Number(item.amount) > 0 ? 'text-emerald-500' : 'text-rose-500'
                          }`}
                        >
                          {Number(item.amount) > 0 ? '+' : ''}
                          {Number(item.amount || 0).toLocaleString()} C
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <div className="text-xs font-medium text-slate-400">
                          {formatDate(item.created_at || item.createdAt)}
                        </div>
                        {typeof item.balance === 'number' && !isNaN(item.balance) && (
                          <div className="text-[10px] font-bold text-slate-300">
                            잔액 {item.balance.toLocaleString()} C
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {historyTotalPages > 1 && (
              <div className="mt-4 flex items-center justify-center gap-3">
                <button
                  disabled={historyPage <= 1}
                  onClick={() => setHistoryPage((p) => p - 1)}
                  className="rounded-lg px-3 py-1.5 text-xs font-bold border disabled:opacity-30 transition-all border-slate-200 hover:bg-slate-50 text-slate-700 bg-white"
                >
                  이전
                </button>
                <span className="text-xs text-slate-500">
                  {historyPage} / {historyTotalPages}
                </span>
                <button
                  disabled={historyPage >= historyTotalPages}
                  onClick={() => setHistoryPage((p) => p + 1)}
                  className="rounded-lg px-3 py-1.5 text-xs font-bold border disabled:opacity-30 transition-all border-slate-200 hover:bg-slate-50 text-slate-700 bg-white"
                >
                  다음
                </button>
              </div>
            )}
          </div>
        )}

        {/* 하단 약관 및 유의사항 */}
        <div className="rounded-xl p-5 text-xs space-y-4 bg-slate-100 border-2 border-slate-200 text-slate-500">
          <div>
            <p className="mb-1 text-slate-700 font-bold">상품정보 (귀신코인 · GHOST COIN)</p>
            <p>
              본 상품은 귀신같이 시리즈 및 패밀리 솔루션({appName} 등)을 이용할 수 있는 통합 디지털 이용권 『귀신코인』입니다. 결제 즉시 코인이 계정에 충전되어 전 서비스를 바로 이용할 수 있습니다.
            </p>
          </div>
          <div>
            <p className="mb-1 text-slate-700 font-bold">환불 정책 및 디지털 이용권 안내</p>
            <p className="mb-1">
              결제 완료 시 계정으로 즉시 지급되는 무형의 디지털 재화이므로 실물 배송은 없습니다. 결제 후 7일 이내,
              충전된 귀신코인을 단 1회도 사용하지 않은 경우에 한하여 전액 환불 가능합니다. (일부 사용 시 잔여분 환불 불가)
            </p>
            <div className="bg-white p-3 rounded-lg border border-slate-200 text-slate-600 font-medium">
              <p className="font-bold text-slate-800">※ 간편결제 및 카드결제 환불 안내</p>
              <p className="mt-1 text-[11px] text-slate-500">
                카카오페이, 네이버페이, 토스페이, 삼성월렛, 애플페이 등 제휴 간편결제 및 신용카드 취소는 PG사(NHN KCP) 및 카드사 정책에 따라 즉시 승인 취소 또는 영업일 기준 3~5일 이내 한도 복원 및 환불 처리됩니다.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );

  if (isModal) {
    return (
      <div
        className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
        onClick={onClose}
      >
        <div
          className="w-full max-w-[740px] max-h-[92vh] overflow-y-auto rounded-3xl shadow-2xl bg-slate-50"
          onClick={(e) => e.stopPropagation()}
        >
          {innerContent}
        </div>
      </div>
    );
  }

  return innerContent;
};
