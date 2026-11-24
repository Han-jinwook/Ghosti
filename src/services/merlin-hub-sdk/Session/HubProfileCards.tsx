/**
 * Version: v2.3.7
 * Last Updated: 2026-11-20
 * Merlin Hub SDK — 프로필/선물함/알림/로그아웃 카드
 * - v2.3.7: 로그아웃 시 루트('/') 강제 이동 및 sessionStorage.clear()·profileUpdated 역호출 제거로 온보딩 튕김·뒤로가기 세션 부활 원천 차단 (현재 화면 즉시 게스트 전환)
 * - v2.3.6: 프로필 모달 오픈 직후 빠른 [로그아웃] 클릭 시 인플라이트 getProfile() 응답 차단 및 location.replace 단일 리로드 정리
 * - v2.3.5: HubLogoutCard 내 [회원 탈퇴] 버튼 및 안전 2중 확인 모달 탑재 (개별 앱 단독 탈퇴 API + onWithdrawApp 콜백 지원)
 * - v2.3.4: 프로필 정보 창(HubProfileCard) 상단의 중복 배너(내 잔여 코인 / 코인 선물함) 기본 제거 (showCoin = false 기본값 적용)
 */
'use client';

import React, { useState, useEffect } from 'react';
import { Camera, Mail, User, Edit2, Save, LogOut, Bell, Gift, UserX } from 'lucide-react';
import { MerlinHub } from '../index';
import { withdrawApp } from '../Auth/auth';
import { HubAvatar } from './HubProfileWidget';
import { useHub } from '../HubProvider';
import { compressImage, triggerHaptic, clearSessionToken } from '../CoreLogic/index';
import { HubGiftBoxModal, GiftProductItem } from '../Wallet/HubGiftBoxModal';
import { getGiftList } from '../Wallet/wallet';

// -----------------------------------------
// 1. HubProfileCard (상단 섹션: 프로필 뷰 및 수정)
// -----------------------------------------
export interface HubProfileCardProps {
  onSuccess?: (nickname: string, avatarUrl: string) => void;
  className?: string;
  showCoin?: boolean; // 프로필 창 상단 코인/선물함 배너 노출 여부 (전사 표준: 기본값 false로 중복 배너 제거)
  hideCoinSection?: boolean; // 하위 호환용 코인 섹션 숨김 플래그
  nicknameLabel?: React.ReactNode; // 커스텀 닉네임 라벨 (예: 앱 닉네임 (카페 별명 권장))
  customGiftProducts?: GiftProductItem[];
  minCustomCoin?: number; onOpenPurchase?: () => void;
}

export const HubProfileCard: React.FC<HubProfileCardProps> = ({ onSuccess, className = '', showCoin = false, hideCoinSection = false, nicknameLabel, customGiftProducts, minCustomCoin, onOpenPurchase }) => {
  const effectiveShowCoin = showCoin && !hideCoinSection;
  const { user, isLoggedIn, balance } = useHub();

  const resolveSyncNickname = (u: typeof user) => {
    const uNick = (u?.nickname || '').trim();
    if (uNick && uNick !== '회원' && uNick !== '가족회원') return uNick;
    if (typeof window !== 'undefined') {
      const storedNick = (localStorage.getItem('userNickname') || '').trim();
      if (storedNick && storedNick !== '회원' && storedNick !== '가족회원') return storedNick;
      const e = (u?.email || localStorage.getItem('userEmail') || '').trim();
      if (e) return e.split('@')[0];
    } else if (u?.email) {
      return u.email.split('@')[0];
    }
    return '';
  };

  const [isEditing, setIsEditing] = useState(false);
  const [nickname, setNickname] = useState(() => resolveSyncNickname(user));
  const [profileImage, setProfileImage] = useState(
    () => user?.avatar_url || (typeof window !== 'undefined' ? localStorage.getItem('userProfileImage') || '' : '')
  );
  const [email, setEmail] = useState(
    () => user?.email || (typeof window !== 'undefined' ? localStorage.getItem('userEmail') || '' : '')
  );
  const [tempNickname, setTempNickname] = useState('');
  const [tempProfileImage, setTempProfileImage] = useState('');
  const [isGiftBoxOpen, setIsGiftBoxOpen] = useState(false);
  const [giftInitialTab, setGiftInitialTab] = useState<'received' | 'sent' | 'send'>('send');
  const [unclaimedGiftCount, setUnclaimedGiftCount] = useState(0);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const hash = window.location.hash || '';
      if (
        params.get('openGift') === '1' ||
        params.get('open_giftbox') === '1' ||
        params.get('tab') === 'gift' ||
        hash.includes('giftbox')
      ) {
        setIsGiftBoxOpen(true);
      }
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn || !effectiveShowCoin) return;
    const syncGifts = () => {
      getGiftList()
        .then(res => {
          if (res.success && typeof res.unclaimedCount === 'number') {
            setUnclaimedGiftCount(res.unclaimedCount);
          }
        })
        .catch(() => {});
    };
    syncGifts();
    window.addEventListener('giftsUpdated', syncGifts);
    return () => window.removeEventListener('giftsUpdated', syncGifts);
  }, [isLoggedIn, effectiveShowCoin]);

  useEffect(() => {
    // 로그인 세션(user) ➔ 로컬 스토리지 ➔ 이메일 ID 순으로 즉시 보정하여 '회' 깜빡임 원천 차단
    const storedEmail = localStorage.getItem('userEmail');
    const storedNickname = localStorage.getItem('userNickname');
    const storedProfileImage = localStorage.getItem('userProfileImage');

    const currentEmail = user?.email || storedEmail || '';
    const emailId = currentEmail ? currentEmail.split('@')[0] : '';
    const userNick = (user?.nickname || '').trim();
    const validUserNick = userNick && userNick !== '회원' && userNick !== '가족회원' ? userNick : '';
    const validStoredNick =
      storedNickname && storedNickname !== '회원' && storedNickname !== '가족회원' ? storedNickname.trim() : '';

    const initNickname = validUserNick || validStoredNick || emailId || (isLoggedIn ? '' : '게스트');

    setNickname(initNickname);
    setProfileImage(user?.avatar_url || storedProfileImage || '');
    setEmail(currentEmail);

    if (isLoggedIn) {
      // 서버에서 최신 프로필 정보 갱신
      MerlinHub.auth.getProfile()
        .then(result => {
          if (typeof window !== 'undefined' && localStorage.getItem('merlin_logged_out') === '1') {
            return;
          }
          if (result.success) {
            const dbNickname = (result.nickname && result.nickname !== '회원' && result.nickname !== '가족회원') 
              ? result.nickname 
              : (validUserNick || validStoredNick || emailId);
            const dbImage = result.avatar_url || '';
            if (dbNickname) {
              setNickname(dbNickname);
              localStorage.setItem('userNickname', dbNickname);
            }
            setProfileImage(dbImage);
            localStorage.setItem('userProfileImage', dbImage);
          }
        })
        .catch(() => {});
    }
  }, [isLoggedIn, user]);

  const handleEdit = () => {
    setTempNickname(nickname);
    setTempProfileImage(profileImage);
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (tempNickname.trim()) {
      if (isLoggedIn) {
        try {
          const result = await MerlinHub.auth.updateProfile({
            nickname: tempNickname,
            avatar_url: tempProfileImage || ''
          });

          if (result.success) {
            const savedNickname = result.nickname || tempNickname;
            const savedImage = result.avatar_url || '';
            setNickname(savedNickname);
            setProfileImage(savedImage);
            localStorage.setItem('userNickname', savedNickname);
            localStorage.setItem('userProfileImage', savedImage);
            window.dispatchEvent(new Event('profileUpdated'));
            setIsEditing(false);
            if (onSuccess) onSuccess(savedNickname, savedImage);
          } else {
            console.error('Failed to update profile:', result.error);
            alert(result.error || '프로필 수정에 실패했습니다.');
          }
        } catch (error) {
          console.error('Profile update error:', error);
        }
      } else {
        // 비회원 로컬 변경
        setNickname(tempNickname);
        setProfileImage(tempProfileImage || '');
        localStorage.setItem('userNickname', tempNickname);
        localStorage.setItem('userProfileImage', tempProfileImage || '');
        window.dispatchEvent(new Event('profileUpdated'));
        setIsEditing(false);
        if (onSuccess) onSuccess(tempNickname, tempProfileImage || '');
      }
    }
  };

  const handleCancel = () => {
    setTempNickname('');
    setTempProfileImage('');
    setIsEditing(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file, {
          maxWidth: 300,
          maxHeight: 300,
          quality: 0.8,
          format: 'image/webp'
        });
        setTempProfileImage(compressed.dataUrl);
        triggerHaptic('light');
      } catch (err) {
        console.error('[HubProfileCard] Image compression failed:', err);
      }
    }
  };

  const getDisplayNickname = () => isEditing ? tempNickname : nickname;
  const getDisplayImage = () => isEditing ? tempProfileImage : profileImage;

  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-5 ${className}`}>
      
      {/* 🚀 상단 코인 배너 & 선물함 배너 */}
      {isLoggedIn && effectiveShowCoin && (
        <div className="space-y-2.5 mb-4">
          <a 
            href={onOpenPurchase ? '#' : '/payment/purchase'} onClick={(e) => { if (onOpenPurchase) { e.preventDefault(); onOpenPurchase(); } }}
            className="flex items-center justify-between p-3 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-2xl border border-amber-100 hover:shadow-md hover:-translate-y-0.5 transition-all group cursor-pointer no-underline"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-amber-100 group-hover:scale-110 transition-transform">
                <span className="text-amber-500 font-black text-lg">C</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-amber-600/80 mb-0.5">내 잔여 코인</span>
                <span className="text-lg font-black text-amber-600 leading-none tracking-tight">
                  {balance !== null ? balance.toLocaleString() : '...'} 코인
                </span>
              </div>
            </div>
            <div className="text-amber-600 font-bold text-xs flex items-center gap-1 bg-white/60 px-2.5 py-1 rounded-full border border-amber-200/50 group-hover:bg-white transition-colors">
              충전·내역 <span className="text-sm leading-none mb-0.5">›</span>
            </div>
          </a>

          {/* 🎁 내 선물함 · 선물하기 배너 */}
          <div className="flex items-center justify-between p-3 bg-gradient-to-r from-rose-50 via-pink-50 to-indigo-50 rounded-2xl border border-rose-200/80 hover:shadow-md transition-all">
            <button
              type="button"
              onClick={() => {
                setGiftInitialTab('send');
                setIsGiftBoxOpen(true);
              }}
              className="flex items-center gap-3 text-left flex-1 cursor-pointer bg-transparent border-none p-0"
            >
              <div className="relative w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-rose-100 shrink-0">
                <Gift className="w-5 h-5 text-rose-500" />
                {unclaimedGiftCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center animate-bounce shadow">
                    {unclaimedGiftCount}
                  </span>
                )}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs sm:text-sm font-black text-slate-900">코인 선물함</span>
                  {unclaimedGiftCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-black">
                      새 선물 {unclaimedGiftCount}개!
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-medium text-slate-500">
                  받은 선물 열기 · 지인에게 코인 선물하기
                </span>
              </div>
            </button>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setGiftInitialTab('send');
                  setIsGiftBoxOpen(true);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-xs font-extrabold transition-colors cursor-pointer"
              >
                코인 선물함
              </button>
              <button
                type="button"
                onClick={() => {
                  setGiftInitialTab('send');
                  setIsGiftBoxOpen(true);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-black shadow-sm transition-colors cursor-pointer"
              >
                코인 선물하기
              </button>
            </div>
          </div>

          <HubGiftBoxModal
            isOpen={isGiftBoxOpen}
            onClose={() => setIsGiftBoxOpen(false)}
            initialTab={giftInitialTab}
            customProducts={customGiftProducts}
            minCustomCoin={minCustomCoin}
          />
        </div>
      )}

      <div className="flex items-start justify-between mb-3 sm:mb-4">
        <h2 className="text-base sm:text-lg font-bold text-slate-900">프로필 정보</h2>
        {!isEditing && (
          <button
            onClick={handleEdit}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs sm:text-sm font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
          >
            <Edit2 className="h-3.5 w-3.5" />
            수정하기
          </button>
        )}
      </div>

      <div className="space-y-3.5">
        {/* 프로필 이미지 및 닉네임 */}
        <div className="flex items-center gap-3.5 sm:gap-4">
          <div className="relative flex-shrink-0">
            <HubAvatar 
              isLoggedIn={isLoggedIn}
              avatarUrl={getDisplayImage()}
              nickname={getDisplayNickname()}
              size="lg"
              className="w-12 h-12 sm:w-14 sm:h-14 border border-slate-200 shadow-sm"
            />
            {isEditing && (
              <label className="absolute bottom-0 right-0 h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center cursor-pointer hover:bg-blue-700 transition-colors shadow-md border-2 border-white">
                <Camera className="h-3 w-3" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>
          
          {/* 닉네임 */}
          <div className="flex-1 min-w-0">
            <label className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-500 mb-1.5">
              <User className="h-3.5 w-3.5 shrink-0" />
              {nicknameLabel || '닉네임'}
            </label>
            <input
              type="text"
              value={isEditing ? tempNickname : nickname}
              onChange={(e) => setTempNickname(e.target.value)}
              disabled={!isEditing}
              className={`w-full px-3.5 py-2 border rounded-xl text-xs sm:text-sm font-medium transition-colors h-[40px] ${
                isEditing
                  ? 'bg-white border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-900'
                  : 'bg-slate-50 border-slate-200 text-slate-700 cursor-not-allowed'
              }`}
            />
          </div>
        </div>

        {/* 이메일 */}
        <div>
          <label className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-500 mb-1.5">
            <Mail className="h-3.5 w-3.5" />
            이메일
          </label>
          {!isLoggedIn ? (
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('openLoginModal'))}
              className="w-full rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 hover:from-blue-100 hover:to-indigo-100 transition-colors cursor-pointer overflow-hidden group h-[40px]"
            >
              <div className="flex items-center gap-2.5 px-3.5 h-full">
                <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center shadow-sm text-blue-600 group-hover:scale-110 transition-transform">
                  <Mail className="h-3 w-3" />
                </div>
                <div className="text-left flex-1 flex items-center justify-between">
                  <p className="text-xs sm:text-sm font-bold text-blue-800">이메일 등록/로그인 👋</p>
                </div>
              </div>
            </button>
          ) : (
            <input
              type="email"
              value={email}
              disabled
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-500 cursor-not-allowed text-xs sm:text-sm font-medium h-[40px]"
            />
          )}
        </div>

        {/* 편집 모드 버튼들 */}
        {isEditing && (
          <div className="flex gap-2.5 pt-3 border-t border-slate-100 mt-4">
            <button
              onClick={handleCancel}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 text-xs sm:text-sm font-bold rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              className="flex-[2] flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-xs sm:text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-md shadow-blue-200 cursor-pointer"
            >
              <Save className="h-3.5 w-3.5" />
              저장하기
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// -----------------------------------------
// 2. HubNotificationCard (중단 섹션: 스마트 알림 설정)
// -----------------------------------------
export interface HubNotificationCardProps {
  title?: string;
  toggleLabel?: string;
  description?: React.ReactNode;
  enabled?: boolean;
  onChange?: (enabled: boolean) => void;
  className?: string;
  children?: React.ReactNode;
}

export const HubNotificationCard: React.FC<HubNotificationCardProps> = ({
  title = '알림 설정',
  toggleLabel = '이메일 알림 수신',
  description = '허브 서비스의 점검, 중요 공지 및 혜택 알림 이메일을 수신합니다.',
  enabled,
  onChange,
  className = '',
  children
}) => {
  const { isLoggedIn } = useHub();
  const [internalEnabled, setInternalEnabled] = useState(true);

  useEffect(() => {
    if (enabled === undefined) {
      const stored = localStorage.getItem('hubSmartNotification') || localStorage.getItem('hubMarketingConsent');
      if (stored === 'false') {
        setInternalEnabled(false);
      } else {
        setInternalEnabled(true);
      }
    }
  }, [enabled]);

  const isToggled = enabled !== undefined ? enabled : internalEnabled;

  const handleToggle = () => {
    const nextVal = !isToggled;
    if (onChange) {
      onChange(nextVal);
    } else {
      setInternalEnabled(nextVal);
      localStorage.setItem('hubSmartNotification', nextVal ? 'true' : 'false');
      localStorage.setItem('hubMarketingConsent', nextVal ? 'true' : 'false');
    }
  };

  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden ${className}`}>
      <div className="p-3.5 sm:p-4">
        <h2 className="flex items-center gap-1.5 text-sm sm:text-base font-bold text-slate-900 mb-2">
          <Bell className="h-4 w-4" />
          {title}
        </h2>

        <div className="space-y-2">
          <div className="flex items-center justify-between p-2.5 sm:p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="min-w-0 pr-3">
              <p className="text-xs sm:text-sm font-bold text-slate-900">{toggleLabel}</p>
              {typeof description === 'string' ? (
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  {description}
                </p>
              ) : (
                <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  {description}
                </div>
              )}
            </div>
            <button
              onClick={handleToggle}
              disabled={!isLoggedIn}
              className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors flex-shrink-0 ${
                !isLoggedIn ? 'bg-slate-200 cursor-not-allowed opacity-50' :
                isToggled ? 'bg-blue-600 cursor-pointer' : 'bg-slate-200 cursor-pointer'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  isToggled ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {children && (
            <div className="pt-2 border-t border-slate-100 mt-2">
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


// -----------------------------------------
// 3. HubLogoutCard (하단 섹션: 로그아웃 및 개별 앱 회원탈퇴)
// -----------------------------------------
export interface HubLogoutCardProps {
  onLogout?: () => void;
  onWithdrawApp?: () => Promise<void> | void;
  appName?: string;
  className?: string;
}

export const HubLogoutCard: React.FC<HubLogoutCardProps> = ({
  onLogout,
  onWithdrawApp,
  appName,
  className = ''
}) => {
  const { isLoggedIn } = useHub();
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  const clearLocalSessionAndReload = async (runLogoutCallback: boolean = true) => {
    try {
      clearSessionToken('local');
    } catch (e) {}

    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('merlin_session_token');
        localStorage.removeItem('merlin_cached_user');
        localStorage.removeItem('merlin_cached_balance');
        localStorage.removeItem('merlin_user_id');
        localStorage.removeItem('merlin_family_uid');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userNickname');
        localStorage.removeItem('userProfileImage');
        localStorage.setItem('merlin_logged_out', '1');
        sessionStorage.removeItem('merlin_session_token');
        sessionStorage.removeItem('merlin_cached_user');
        sessionStorage.setItem('merlin_logged_out', '1');
      } catch {}
      // 🚨 해당 앱 호스트 쿠키만 소멸시키고, 타 패밀리 앱 세션을 위해 .sundreamer.app 공용 쿠키는 보존
      document.cookie = 'merlin_session_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; SameSite=Lax; Secure';
      document.cookie = 'merlin_session_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0;';
      // 🚨 profileUpdated를 발행하면 HubProvider가 refreshSession()(/api/auth/me)을 다시 호출하므로 절대 발행 금지!
      window.dispatchEvent(new CustomEvent('merlinSessionExpired'));
      window.dispatchEvent(new CustomEvent('closeProfileModal'));
      if (runLogoutCallback && onLogout) {
        onLogout();
      }
    }
  };

  const handleLogout = async () => {
    await clearLocalSessionAndReload(true);
  };

  const handleConfirmWithdraw = async () => {
    if (isWithdrawing) return;
    setIsWithdrawing(true);
    setWithdrawError(null);
    try {
      if (onWithdrawApp) {
        await onWithdrawApp();
      }
      const res = await withdrawApp();
      if (!res.success) {
        setWithdrawError(res.error || '앱 이용 해지에 실패했습니다.');
        setIsWithdrawing(false);
        return;
      }
      setShowWithdrawModal(false);
      await clearLocalSessionAndReload(true);
    } catch (err: any) {
      setWithdrawError(err?.message || '탈퇴 처리 중 오류가 발생했습니다.');
      setIsWithdrawing(false);
    }
  };

  if (!isLoggedIn) return null;

  const targetAppLabel = appName ? `(${appName})` : '';

  return (
    <>
      <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden ${className}`}>
        <div className="p-3.5 sm:p-4 flex flex-col gap-2">
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-1.5 w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-700 text-xs sm:text-sm font-bold rounded-xl hover:bg-slate-100 transition-colors shadow-xs cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            로그아웃
          </button>
          <button
            type="button"
            onClick={() => {
              setWithdrawError(null);
              setShowWithdrawModal(true);
            }}
            className="flex items-center justify-center gap-1.5 w-full px-3 py-2 bg-white border border-rose-200/80 text-rose-600 text-xs font-semibold rounded-xl hover:bg-rose-50 transition-colors cursor-pointer"
          >
            <UserX className="h-3.5 w-3.5" />
            회원 탈퇴
          </button>
        </div>
      </div>

      {showWithdrawModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 shadow-2xl p-5 space-y-4">
            <div className="space-y-1.5">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-1.5">
                <UserX className="h-4 w-4 text-rose-500" />
                앱 이용 해지 (회원 탈퇴)
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                현재 앱{targetAppLabel} 이용만 해지되며, <strong className="text-slate-900">다른 멀린 패밀리 앱 계정과 보유 코인은 안전하게 유지</strong>됩니다. 계속하시겠습니까?
              </p>
            </div>

            {withdrawError && (
              <p className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                {withdrawError}
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                disabled={isWithdrawing}
                onClick={() => setShowWithdrawModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                disabled={isWithdrawing}
                onClick={handleConfirmWithdraw}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                {isWithdrawing ? '처리 중...' : '탈퇴 확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
