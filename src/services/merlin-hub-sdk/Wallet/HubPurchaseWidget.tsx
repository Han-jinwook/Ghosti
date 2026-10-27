/**
 * Version: v1.4.0
 * Last Updated: 2026-10-26
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { hubFetch } from '../CoreLogic/client';
import { HubPaymentTrigger } from './HubPaymentTrigger';
import { HubGiftBoxModal, GiftProductItem } from './HubGiftBoxModal';
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
  if (!appId) return '어그로필터';
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
  if (id === 'ZEYE' || id === 'Z-EYE' || id === 'SAYSEE') {
    return '귀신같이';
  }
  return appId;
};

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
  appName = '어그로필터',
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

  const [selectedOption, setSelectedOption] = useState<number>(1000);
  const [tab, setTab] = useState<'charge' | 'history' | 'gift'>(initialTab);
  const [giftSubTab, setGiftSubTab] = useState<'received' | 'sent' | 'send'>('received');
  const [method, setMethod] = useState<'card' | 'phone' | 'bank'>('card');
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
      // 서버에서 전체 내역을 한 번에 가져오기 (limit 등 추가)
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

  const options = useMemo(
    () => [
      { credits: 1000, price: 1000, discount: 0, imgSrc: '/hub_assets/card_1000.png' },
      { credits: 5000, price: 4750, discount: 5, imgSrc: '/hub_assets/card_5000.png' },
      { credits: 10000, price: 9000, discount: 10, imgSrc: '/hub_assets/card_10000.png' },
    ],
    []
  );

  const selectedPkg = useMemo(
    () => options.find((o) => o.credits === selectedOption) || options[0],
    [selectedOption, options]
  );

  const formatDate = (iso: string) => {
    if (!iso) return '...';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '...';
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(
      d.getMinutes()
    ).padStart(2, '0')}`;
  };

  const config = getConfig();

  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <svg className="animate-spin h-8 w-8 text-indigo-600" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      <main className="mx-auto max-w-[var(--app-max-width,720px)] px-4 py-4 space-y-3">
        {/* 상단 3몬스터 공식 브랜드 헤더 배너 */}
        <div className="rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 p-4 sm:p-5 text-white shadow-xl border-2 border-indigo-500/40 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img 
              src="/hub_assets/3Monster_logo.png" 
              alt="3Monster Logo" 
              className="h-12 sm:h-14 w-auto object-contain drop-shadow-[0_0_15px_rgba(74,222,128,0.35)]" 
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xl sm:text-2xl font-black tracking-tight text-white">3몬스터 패밀리 코인 충전소</span>
                <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-lime-400 text-slate-950 shadow-sm">
                  공식 충전센터
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-1">
                3Monster & 패밀리 솔루션({appName}) 공용 디지털 코인 충전
              </p>
            </div>
          </div>
          <div className="text-right hidden sm:block border-l border-slate-700/80 pl-4">
            <span className="text-xs text-lime-400 font-bold block">KCP / 간편결제 공식 제휴</span>
            <span className="text-[11px] text-slate-400 font-semibold">가맹점 상점명: 3몬스터</span>
          </div>
        </div>

        {/* 탭 전환 영역 */}
        <div className="bg-slate-200/50 p-1.5 border border-slate-300/70 rounded-2xl flex gap-1 shadow-inner">
          <button
            onClick={() => setTab('charge')}
            className={tab === 'charge'
              ? "flex-1 rounded-xl py-2.5 text-sm font-black bg-slate-900 text-white shadow-sm transition-all cursor-pointer"
              : "flex-1 rounded-xl py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-300/40 transition-all active:scale-[0.98] cursor-pointer"
            }
          >
            충전하기
          </button>
          <button
            onClick={() => {
              setGiftSubTab('received');
              setTab('gift');
            }}
            className={tab === 'gift'
              ? "flex-1 rounded-xl py-2.5 text-sm font-black bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-sm transition-all cursor-pointer"
              : "flex-1 rounded-xl py-2.5 text-sm font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-100/50 transition-all active:scale-[0.98] cursor-pointer"
            }
          >
            🎁 선물함 · 선물하기
          </button>
          <button
            onClick={() => setTab('history')}
            className={tab === 'history'
              ? "flex-1 rounded-xl py-2.5 text-sm font-black bg-slate-900 text-white shadow-sm transition-all cursor-pointer"
              : "flex-1 rounded-xl py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-300/40 transition-all active:scale-[0.98] cursor-pointer"
            }
          >
            이용 내역
          </button>
        </div>

        {/* 충전 탭 화면 */}
        {tab === 'charge' && (
          <div className="space-y-4">
            {/* 상품 선택 */}
            <div className="rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-md">
              <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
                <h2 className="text-base text-slate-900 font-extrabold">1. 이용권 상품 선택</h2>
                <button
                  type="button"
                  onClick={() => {
                    setGiftSubTab('send');
                    setTab('gift');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-extrabold transition-colors cursor-pointer"
                >
                  🎁 보유 코인으로 지인에게 선물하기 ›
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {options.map((opt) => {
                  const isSelected = selectedOption === opt.credits;
                  return (
                    <button
                      key={opt.credits}
                      onClick={() => setSelectedOption(opt.credits)}
                      className={`relative rounded-2xl overflow-hidden transition-all hover:scale-[1.03] shadow-lg ${
                        isSelected
                          ? "ring-4 ring-indigo-600 scale-[1.03] shadow-indigo-100 shadow-xl"
                          : "border-2 border-slate-200 hover:border-indigo-400 hover:scale-[1.01]"
                      }`}
                    >
                      <img src={opt.imgSrc} alt={`${opt.credits} Coins`} className="w-full h-auto" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 결제 수단 선택 */}
            <div className="rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-md">
              <h2 className="text-base text-slate-900 font-extrabold">2. 결제 수단 선택</h2>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  className={method === 'card'
                    ? "flex items-center justify-between px-4 py-4 rounded-xl border-2 cursor-pointer transition-all border-emerald-600 bg-emerald-50/70 text-emerald-900 shadow-sm font-extrabold"
                    : "flex items-center justify-between px-4 py-4 rounded-xl border-2 cursor-pointer transition-all border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 font-bold"
                  }
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      checked={method === 'card'}
                      onChange={() => setMethod('card')}
                      className="h-4.5 w-4.5 accent-emerald-600"
                    />
                    <div className="flex flex-col text-left">
                      <span className="font-extrabold text-sm text-slate-900">간편결제 (Npay / 카카오페이 등)</span>
                      <span className="text-[11px] text-emerald-600 font-semibold">네이버페이 · 카카오페이 · 토스페이 · 애플페이</span>
                    </div>
                  </div>
                  <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full shrink-0">추천</span>
                </label>

                <label
                  className={method === 'bank'
                    ? "flex items-center justify-between px-4 py-4 rounded-xl border-2 cursor-pointer transition-all border-indigo-600 bg-indigo-50/70 text-indigo-900 shadow-sm font-extrabold"
                    : "flex items-center justify-between px-4 py-4 rounded-xl border-2 cursor-pointer transition-all border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 font-bold"
                  }
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      checked={method === 'bank'}
                      onChange={() => setMethod('bank')}
                      className="h-4.5 w-4.5 accent-indigo-600"
                    />
                    <div className="flex flex-col text-left">
                      <span className="font-extrabold text-sm text-slate-900">신용 / 체크카드</span>
                      <span className="text-[11px] text-slate-500 font-medium">모든 국내 카드사 일반 결제</span>
                    </div>
                  </div>
                </label>
              </div>

              <div className="mt-3.5 p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs text-slate-600">
                <span className="font-bold text-slate-700">제휴 간편결제:</span>
                <span className="font-semibold text-slate-600">
                  <strong className="text-emerald-700 font-black">네이버페이(Npay)</strong> · 카카오페이 · 토스페이 · PAYCO · 애플페이
                </span>
              </div>
            </div>

            {/* 결제 실행 버튼 */}
            <HubPaymentTrigger
              amount={selectedPkg.price}
              coinAmount={selectedPkg.credits}
              payMethodType="card"
              returnUrl={`${origin}/api/payment/callback?redirectUrl=${encodeURIComponent(targetRedirectUrl)}`}
              onSuccess={onSuccess}
              onError={onError}
              className="w-full rounded-2xl bg-indigo-600 py-5 text-lg font-black text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-700 hover:shadow-xl active:scale-[0.98] transition-all border-b-4 border-indigo-800"
            >
              {selectedOption.toLocaleString()} 코인 결제하기
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
              <h2 className="text-base text-slate-900 font-extrabold">이용 내역</h2>
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
                  <span className="text-[10px] sm:text-xs font-bold text-slate-500">최종 잔액</span>
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
                    .replace('KCP 심사관 테스트 코인 충전 (5,000C)', '코인 충전')
                    .trim();

                  // Strip app name prefix if it starts with it
                  const prefix = `${itemAppName} -`;
                  if (actionAndTitle.startsWith(prefix)) {
                    actionAndTitle = actionAndTitle.substring(prefix.length).trim();
                  } else if (actionAndTitle.startsWith(itemAppName)) {
                    actionAndTitle = actionAndTitle.substring(itemAppName.length).trim();
                  }

                  // Fallback if empty after stripping
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
            <p className="mb-1 text-slate-700 font-bold">상품정보</p>
            <p>
              본 상품은 3몬스터 패밀리({appName} 등) AI 및 자동화 솔루션을 이용할 수 있는 통합 디지털 이용권 코인입니다. 결제 즉시 코인이 계정에 충전되어 패밀리 전 서비스를 즉시 이용할 수 있습니다.
            </p>
          </div>
          <div>
            <p className="mb-1 text-slate-700 font-bold">환불 정책 및 디지털 이용권 안내</p>
            <p className="mb-1">
              결제 완료 시 계정으로 즉시 지급되는 무형의 디지털 재화이므로 실물 배송은 없습니다. 결제 후 7일 이내,
              충전된 코인을 단 1회도 사용하지 않은 경우에 한하여 전액 환불 가능합니다. (일부 사용 시 잔여분 환불 불가)
            </p>
            <div className="bg-white p-3 rounded-lg border border-slate-200 text-slate-600 font-medium">
              <p className="font-bold text-slate-800">※ 간편결제 및 카드결제 환불 안내</p>
              <p className="mt-1 text-[11px] text-slate-500">
                네이버페이, 카카오페이 등 제휴 간편결제 및 신용카드 취소는 PG사 및 카드사/간편결제 정책에 따라 즉시 승인 취소 또는 영업일 기준 3~5일 이내 카드사 한도 복원 및 환불 처리됩니다.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
