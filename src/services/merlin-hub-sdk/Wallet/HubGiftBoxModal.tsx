'use client';

/**
 * Version: v2.3.0
 * Last Updated: 2026-10-26
 * Description: 패밀리 통합 '선물함 & 선물하기' 컴포넌트 (썬드리머 포인트 선물하기 멀린님 직접 코칭 UI/UX 100% 표준 반영)
 * - 상단 불필요 문구 제거 & 1줄 헤더 + 균등 3탭([받은 선물] / [보낸 선물] / [선물 보내기])
 * - 1단계: 컴팩트 2열 선물 선택 + 직접 입력 빠른 금액 칩([100C]~[전액])
 * - 2단계: 별명/이메일 실시간 자동완성 검색(한글 조합 깜빡임 방지) + 외부 클릭 닫기 + 고정 높이(h-8) 수신자 확인줄로 모달 화면 튐 0px 달성 ([내 지인 선택] 제거 완료)
 * - 3단계: 4종 테마 + 일체형 응원 메시지 카드(중복 미리보기 제거)
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Gift,
  Send,
  Inbox,
  CheckCircle2,
  Clock,
  RotateCcw,
  BellRing,
  Sparkles,
  X,
  UserCheck,
  Search,
  PartyPopper,
  Loader2,
  ChevronDown,
  Users,
} from 'lucide-react';
import {
  getGiftList,
  searchGiftUsers,
  sendGift,
  claimGift,
  cancelGift,
  nudgeGift,
  GiftItem,
  GiftContact,
} from './wallet';
import { useHub } from '../HubProvider';
import { showToast } from '../CoreLogic/HubNotifier';
import { triggerHaptic } from '../CoreLogic/haptic';

export interface GiftProductItem {
  id: string;
  title: string;
  subtitle: string;
  fullTitle: string;
  amount: number;
  category?: 'APP_ITEM' | 'COIN';
  emoji?: string;
  defaultMessage?: string;
  isCustom?: boolean;
}

export interface HubGiftBoxModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  initialTab?: 'received' | 'sent' | 'send';
  inline?: boolean; // true일 경우 모달 배경 없이 페이지 내 탭 컨텐츠로 렌더링
  appName?: string;
  customProducts?: GiftProductItem[]; // 개별 앱 맞춤 상품 목록 (미전달 시 어그로필터 묶음 또는 기본값 적용)
  minCustomCoin?: number; // 자유 코인 선물 최소 단위 (기본 1,000C)
}

/**
 * 어그로필터 건당 50C 단일가 기반 묶음 상품 (기본 세트)
 * 10건(500C), 30건(1,500C), 50건(2,500C), 채널 재분석(1,000C) + 자유 코인 선물(1,000C~)
 */
export const AGGRO_GIFT_PRODUCTS: GiftProductItem[] = [
  {
    id: 'aggro_10',
    title: '🛡️ 분석 10회 (500C)',
    subtitle: '가벼운 체험 추천',
    fullTitle: '🛡️ 어그로필터 영상 분석 10회 묶음 선물',
    amount: 500,
    category: 'APP_ITEM',
    emoji: '🛡️',
    defaultMessage: '유튜브 보실 때 가짜뉴스나 어그로에 속지 마시라고 분석 10회 묶음 선물을 보냅니다! 🎁',
  },
  {
    id: 'aggro_30',
    title: '⚡ 분석 30회 (1,500C)',
    subtitle: '인기 실속 팩',
    fullTitle: '⚡ 어그로필터 영상 분석 30회 묶음 선물',
    amount: 1500,
    category: 'APP_ITEM',
    emoji: '⚡',
    defaultMessage: '평소 궁금했던 유튜브 영상들 마음껏 판독해 보시라고 30회 분석 선물을 보냅니다! ⚡',
  },
  {
    id: 'aggro_50',
    title: '🚀 분석 50회 (2,500C)',
    subtitle: '헤비 유저 베스트',
    fullTitle: '🚀 어그로필터 영상 분석 50회 묶음 선물',
    amount: 2500,
    category: 'APP_ITEM',
    emoji: '🚀',
    defaultMessage: '유튜브 팩트체크 필수템! 든든하게 쓰시라고 50회 분석 선물을 보냅니다! 🚀',
  },
  {
    id: 'aggro_owner_1000',
    title: '👑 채널 재분석 (1,000C)',
    subtitle: '채널주 전용',
    fullTitle: '👑 유튜브 채널 소유자 정밀 재분석 선물',
    amount: 1000,
    category: 'APP_ITEM',
    emoji: '👑',
    defaultMessage: '특별한 응원을 담아 채널 정밀 재분석 코인 선물을 보냅니다! 🎉',
  },
  {
    id: 'custom_coin',
    title: '🎀 자유 코인 선물',
    subtitle: '1,000C 이상 직접 입력',
    fullTitle: '🎀 패밀리 코인 자유 선물',
    amount: 1000,
    category: 'COIN',
    emoji: '🎀',
    defaultMessage: '마음을 담아 준비한 코인 선물입니다! 반갑게 열어보세요 🎁',
    isCustom: true,
  },
];

export const SENSETALK_GIFT_PRODUCTS: GiftProductItem[] = [
  {
    id: 'sensetalk_starter_1000',
    title: '⚡ 발송 300건 (1,000C)',
    subtitle: '가벼운 응원 선물',
    fullTitle: '⚡ 센스톡 1:1 맞춤 발송 300건 묶음 선물',
    amount: 1000,
    category: 'APP_ITEM',
    emoji: '⚡',
    defaultMessage: '센스톡으로 소중한 분들께 따뜻한 1:1 안부 전하시라고 발송 300건 선물을 보냅니다! 🎁',
  },
  {
    id: 'sensetalk_basic_3000',
    title: '🚀 스타터 1,000건 (3,000C)',
    subtitle: '실속 인기 팩',
    fullTitle: '🚀 센스톡 스타터 1,000건 발송 선물',
    amount: 3000,
    category: 'APP_ITEM',
    emoji: '🚀',
    defaultMessage: '복붙 없이 엔터키로 편하게 소통하시라고 센스톡 1,000건 발송 선물을 보냅니다! 🚀',
  },
  {
    id: 'sensetalk_pro_6000',
    title: '👑 프로 3,000건 (6,000C)',
    subtitle: 'BEST 주력 추천',
    fullTitle: '👑 센스톡 프로 3,000건 발송 선물',
    amount: 6000,
    category: 'APP_ITEM',
    emoji: '👑',
    defaultMessage: 'VIP 고객·회원 관리 든든하게 하시라고 센스톡 프로 3,000건 선물을 보냅니다! 👑',
  },
  {
    id: 'sensetalk_biz_12000',
    title: '💎 비즈니스 9,000건 (12,000C)',
    subtitle: '대량 소통 특화',
    fullTitle: '💎 센스톡 비즈니스 9,000건 발송 선물',
    amount: 12000,
    category: 'APP_ITEM',
    emoji: '💎',
    defaultMessage: '비즈니스 대박 나시길 응원하며 센스톡 비즈니스 9,000건 선물을 보냅니다! 🎉',
  },
  {
    id: 'custom_coin',
    title: '🎀 자유 코인 선물',
    subtitle: '1,000C 이상 직접 입력',
    fullTitle: '🎀 패밀리 코인 자유 선물',
    amount: 1000,
    category: 'COIN',
    emoji: '🎀',
    defaultMessage: '마음을 담아 준비한 패밀리 코인 선물입니다! 반갑게 열어보세요 🎁',
    isCustom: true,
  },
];

type HubGiftThemeId = 'CHEER' | 'THANKS' | 'TOGETHER' | 'CONGRATS' | 'HEART';

const THEME_OPTIONS: Array<{
  id: HubGiftThemeId;
  label: string;
  emoji: string;
  gradient: string;
  border: string;
  text: string;
  defaultMsg: string;
}> = [
  {
    id: 'CHEER',
    label: '응원해요',
    emoji: '🍀',
    gradient: 'from-emerald-500 to-teal-600',
    border: 'border-emerald-300 bg-emerald-50/70',
    text: 'text-emerald-800',
    defaultMsg: '항상 건강하고 기분 좋은 일만 가득하시길 진심으로 응원합니다! 🍀',
  },
  {
    id: 'THANKS',
    label: '감사 인사',
    emoji: '💝',
    gradient: 'from-rose-500 to-pink-600',
    border: 'border-rose-300 bg-rose-50/70',
    text: 'text-rose-800',
    defaultMsg: '평소 나누어주신 따뜻한 마음과 도움에 깊이 감사드립니다 💝',
  },
  {
    id: 'TOGETHER',
    label: '함께 힘내요',
    emoji: '☀️',
    gradient: 'from-amber-500 to-orange-600',
    border: 'border-amber-300 bg-amber-50/70',
    text: 'text-amber-800',
    defaultMsg: '오늘도 활기차고 든든한 하루 보내시길 바라며 작은 선물을 보냅니다! ☀️',
  },
  {
    id: 'CONGRATS',
    label: '축하해요',
    emoji: '🎉',
    gradient: 'from-indigo-500 to-violet-600',
    border: 'border-indigo-300 bg-indigo-50/70',
    text: 'text-indigo-800',
    defaultMsg: '기쁜 날을 진심으로 축하드리며 행운 가득한 선물을 보냅니다! 🎉',
  },
];

export const HubGiftBoxModal: React.FC<HubGiftBoxModalProps> = ({
  isOpen = true,
  onClose,
  initialTab = 'received',
  inline = false,
  appName = '어그로필터',
  customProducts,
  minCustomCoin = 1000,
}) => {
  const { isLoggedIn, balance, refreshBalance } = useHub();

  const products: GiftProductItem[] = useMemo(() => {
    if (customProducts && customProducts.length > 0) {
      return customProducts;
    }
    if (appName && (appName.includes('센스톡') || appName.toLowerCase().includes('sensetalk'))) {
      return SENSETALK_GIFT_PRODUCTS;
    }
    return AGGRO_GIFT_PRODUCTS;
  }, [customProducts, appName]);

  const minCoin = typeof minCustomCoin === 'number' && minCustomCoin > 0 ? minCustomCoin : 1000;

  const [activeTab, setActiveTab] = useState<'received' | 'sent' | 'send'>(initialTab);
  const [receivedGifts, setReceivedGifts] = useState<GiftItem[]>([]);
  const [sentGifts, setSentGifts] = useState<GiftItem[]>([]);
  const [contacts, setContacts] = useState<GiftContact[]>([]);
  const [unclaimedCount, setUnclaimedCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [unboxedBanner, setUnboxedBanner] = useState<{ title: string; amount: number; sender: string } | null>(null);

  // 선물 보내기 폼 상태
  const [selectedPresetId, setSelectedPresetId] = useState<string>(() => products[0]?.id || 'aggro_10');
  const [customAmountInput, setCustomAmountInput] = useState<string>(() => String(minCoin));
  const [recipientInput, setRecipientInput] = useState<string>('');
  const [selectedContact, setSelectedContact] = useState<GiftContact | null>(null);
  const [isContactDropdownOpen, setIsContactDropdownOpen] = useState<boolean>(false);
  const [dropdownMode, setDropdownMode] = useState<'contacts' | 'search'>('contacts');
  const [searchResults, setSearchResults] = useState<GiftContact[]>([]);
  const [isSearchingRecipients, setIsSearchingRecipients] = useState<boolean>(false);
  const [verifiedRecipient, setVerifiedRecipient] = useState<{
    displayName: string;
    email: string;
    detail: string;
  } | null>(null);
  const [isVerifyingRecipient, setIsVerifyingRecipient] = useState<boolean>(false);
  const [selectedTheme, setSelectedTheme] = useState<HubGiftThemeId>('CHEER');
  const [giftMessage, setGiftMessage] = useState<string>(() => products[0]?.defaultMessage || '마음을 담아 선물을 보냅니다! 🎁');
  const [isSending, setIsSending] = useState<boolean>(false);

  const dropdownBoxRef = useRef<HTMLDivElement | null>(null);
  const dropdownBtnRef = useRef<HTMLButtonElement | null>(null);

  // 추천지인/검색창 드롭다운 바깥 어디든 클릭 시 즉시 닫기 (캡처 단계 감지)
  useEffect(() => {
    if (!isContactDropdownOpen) return;
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (dropdownBoxRef.current && dropdownBoxRef.current.contains(target)) return;
      if (dropdownBtnRef.current && dropdownBtnRef.current.contains(target)) return;
      setIsContactDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick, true);
    document.addEventListener('touchstart', handleOutsideClick, true);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick, true);
      document.removeEventListener('touchstart', handleOutsideClick, true);
    };
  }, [isContactDropdownOpen]);

  useEffect(() => {
    if (inline || isOpen) {
      setActiveTab(initialTab);
      setUnboxedBanner(null);
    }
  }, [inline, isOpen, initialTab]);

  const loadGiftData = useCallback(
    async (silent: boolean = false) => {
      if (!isLoggedIn) return;
      if (!silent) {
        setIsLoading(true);
      }
      try {
        const res = await getGiftList();
        if (res.success) {
          setReceivedGifts(res.received || []);
          setSentGifts(res.sent || []);
          setContacts(res.contacts || []);
          setUnclaimedCount(res.unclaimedCount || 0);
        }
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [isLoggedIn]
  );

  useEffect(() => {
    if ((inline || isOpen) && isLoggedIn) {
      // 선물 보내기 탭으로 열 때는 로딩 스피너로 인한 모달 높이 점프를 원천 차단하기 위해 무음(silent) 로드
      loadGiftData(initialTab === 'send');
    }
  }, [inline, isOpen, initialTab, isLoggedIn, loadGiftData]);

  // 별명/이메일 입력 시 실시간 회원 자동완성 검색 (타이핑 중 레이아웃 흔들림/깜빡임 원천 차단)
  useEffect(() => {
    const raw = recipientInput.trim();
    // 한글 조합 중 미완성 자음/모음(ㄱ~ㅎ, ㅏ~ㅣ) 단독 입력은 검색 생략하여 팝업 튐 방지
    const cleanQ = raw.replace(/[ㄱ-ㅎㅏ-ㅣ]+$/g, '').trim();

    if (!cleanQ || selectedContact) {
      if (!raw) {
        setSearchResults([]);
        if (dropdownMode === 'search') {
          setIsContactDropdownOpen(false);
        }
      }
      setIsSearchingRecipients(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsSearchingRecipients(true);
      try {
        const res = await searchGiftUsers(cleanQ);
        if (!cancelled) {
          const found = res.users || [];
          setSearchResults(found);
          if (found.length > 0) {
            setDropdownMode('search');
            setIsContactDropdownOpen(true);
          } else if (dropdownMode === 'search') {
            setIsContactDropdownOpen(false);
          }
        }
      } finally {
        if (!cancelled) {
          setIsSearchingRecipients(false);
        }
      }
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [recipientInput, selectedContact, dropdownMode]);

  if (!inline && !isOpen) return null;

  const coinBalance = typeof balance === 'number' ? balance : 0;
  const selectedPreset = products.find(p => p.id === selectedPresetId) || products[0] || AGGRO_GIFT_PRODUCTS[0];
  const parsedCustom = Math.max(0, Math.floor(Number(customAmountInput.replace(/[^0-9]/g, '')) || 0));
  const finalGiftAmount = selectedPreset.isCustom ? parsedCustom : selectedPreset.amount;
  const finalGiftTitle = selectedPreset.isCustom
    ? `🎀 패밀리 ${finalGiftAmount.toLocaleString()} 코인 선물`
    : selectedPreset.fullTitle;
  const activeThemeObj = THEME_OPTIONS.find(t => t.id === selectedTheme) || THEME_OPTIONS[0];

  const handleSelectPreset = (preset: GiftProductItem) => {
    triggerHaptic('light');
    setSelectedPresetId(preset.id);
    if (!preset.isCustom) {
      setCustomAmountInput(String(preset.amount));
    }
    setGiftMessage(preset.defaultMessage || activeThemeObj.defaultMsg);
  };

  const handleSelectTheme = (theme: typeof THEME_OPTIONS[0]) => {
    triggerHaptic('light');
    setSelectedTheme(theme.id);
    setGiftMessage(theme.defaultMsg);
  };

  const handleSelectContactPill = (c: GiftContact) => {
    triggerHaptic('light');
    setSelectedContact(c);
    setRecipientInput(c.nickname || c.email);
    setVerifiedRecipient({
      displayName: c.nickname || c.email.split('@')[0],
      email: c.email,
      detail: `받는 분: ${c.nickname || c.email.split('@')[0]} (${c.email})`,
    });
    setIsContactDropdownOpen(false);
  };

  const handleVerifyRecipient = async () => {
    const q = recipientInput.trim();
    if (!q) {
      showToast('받는 분의 별명 또는 이메일 주소를 입력해 주세요.', 'error');
      return;
    }

    setIsVerifyingRecipient(true);
    try {
      const res = await searchGiftUsers(q);
      const list = res.users || [];
      if (list.length > 1) {
        setSearchResults(list);
        setDropdownMode('search');
        setIsContactDropdownOpen(true);
        const lowerQ = q.toLowerCase();
        const exact = list.find(
          item =>
            item.nickname.toLowerCase() === lowerQ ||
            item.email.toLowerCase() === lowerQ ||
            item.email.split('@')[0].toLowerCase() === lowerQ
        );
        if (exact) {
          handleSelectContactPill(exact);
        }
        return;
      }
      if (list.length === 1) {
        handleSelectContactPill(list[0]);
        return;
      }

      // 아직 가입하지 않은 외부 지인 이메일인 경우 즉시 이메일 수신자로 확정
      if (q.includes('@')) {
        const cleanEmail = q.toLowerCase();
        const nick = cleanEmail.split('@')[0];
        const newContact: GiftContact = {
          email: cleanEmail,
          nickname: nick,
          relation: '이메일 지인',
        };
        handleSelectContactPill(newContact);
        return;
      }

      showToast(`'${q}' 별명으로 등록된 회원을 찾지 못했습니다. 정확한 별명 또는 이메일 주소를 입력해 주세요.`, 'error');
    } finally {
      setIsVerifyingRecipient(false);
    }
  };

  const handleSendGiftSubmit = async () => {
    if (!isLoggedIn) {
      window.dispatchEvent(new CustomEvent('openLoginModal'));
      return;
    }

    const rawRecipient = (verifiedRecipient?.email || selectedContact?.email || recipientInput).trim();
    if (!rawRecipient) {
      showToast('선물 받으실 분의 별명 또는 이메일을 입력해 주세요.', 'error');
      return;
    }

    if (selectedPreset.isCustom) {
      if (finalGiftAmount < minCoin) {
        showToast(`자유 코인 선물은 최소 ${minCoin.toLocaleString()}C 이상부터 가능합니다.`, 'error');
        return;
      }
      if (finalGiftAmount % 50 !== 0) {
        showToast('선물 코인은 50C 단위로 입력해 주세요.', 'error');
        return;
      }
    } else {
      if (finalGiftAmount < 50 || finalGiftAmount % 50 !== 0) {
        showToast('선물 코인은 최소 50C부터 50C 단위로 입력해 주세요.', 'error');
        return;
      }
    }

    if (typeof balance === 'number' && finalGiftAmount > balance) {
      showToast(`보유하신 코인(${balance.toLocaleString()}C)이 부족합니다.`, 'error');
      return;
    }

    const displayTarget = verifiedRecipient?.displayName || selectedContact?.nickname || rawRecipient;
    const confirmSend = window.confirm(
      `[🎁 패밀리 선물 발송 확인]\n\n• 받는 분: ${displayTarget}\n• 선물 내용: ${finalGiftTitle} (${finalGiftAmount.toLocaleString()} C)\n• 응원 메시지: "${giftMessage}"\n\n위 내용으로 선물을 보내시겠습니까?\n(상대방이 수령하기 전까지는 [보낸 선물] 탭에서 언제든 취소·환급 가능합니다.)`
    );
    if (!confirmSend) return;

    setIsSending(true);
    try {
      const res = await sendGift({
        receiverEmail: rawRecipient,
        receiverId: selectedContact?.userId,
        receiverName: verifiedRecipient?.displayName || selectedContact?.nickname || rawRecipient.split('@')[0],
        giftTitle: finalGiftTitle,
        giftCategory: selectedPreset.category || 'APP_ITEM',
        amount: finalGiftAmount,
        theme: selectedTheme,
        message: giftMessage.trim() || selectedPreset.defaultMessage,
      });

      if (!res.success) {
        showToast(res.error || '선물 발송에 실패했습니다.', 'error');
        return;
      }

      triggerHaptic('success');
      showToast(`🎉 ${displayTarget}님께 ${finalGiftAmount.toLocaleString()}C 선물을 성공적으로 보냈습니다!`, 'info');
      setRecipientInput('');
      setSelectedContact(null);
      setVerifiedRecipient(null);
      refreshBalance();
      await loadGiftData(true);
      setActiveTab('sent');
    } finally {
      setIsSending(false);
    }
  };

  const handleClaimGift = async (gift: GiftItem) => {
    setActionLoadingId(gift.gift_id);
    try {
      const res = await claimGift(gift.gift_id);
      if (!res.success) {
        showToast(res.error || '선물 수령 중 오류가 발생했습니다.', 'error');
        return;
      }
      triggerHaptic('success');
      setUnboxedBanner({
        title: gift.gift_title,
        amount: gift.amount,
        sender: gift.sender_name,
      });
      showToast(`🎊 선물을 열어 +${gift.amount.toLocaleString()} 코인이 즉시 적립되었습니다!`, 'info');
      refreshBalance();
      await loadGiftData(true);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancelGift = async (gift: GiftItem) => {
    const ok = window.confirm(
      `[선물 취소 및 코인 즉시 환급]\n\n아직 ${gift.receiver_name}님이 열지 않은 선물(${gift.amount.toLocaleString()}C)입니다.\n선물을 취소하고 내 잔여 코인으로 즉시 환급받으시겠습니까?`
    );
    if (!ok) return;

    setActionLoadingId(gift.gift_id);
    try {
      const res = await cancelGift(gift.gift_id);
      if (!res.success) {
        showToast(res.error || '선물 취소에 실패했습니다.', 'error');
        return;
      }
      triggerHaptic('medium');
      showToast(`✅ 선물이 취소되어 +${gift.amount.toLocaleString()}C가 내 지갑으로 즉시 복구되었습니다.`, 'info');
      refreshBalance();
      await loadGiftData(true);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleNudgeGift = async (gift: GiftItem) => {
    setActionLoadingId(gift.gift_id);
    try {
      const res = await nudgeGift(gift.gift_id);
      if (!res.success) {
        showToast(res.error || '알림 재발송에 실패했습니다.', 'error');
        return;
      }
      triggerHaptic('light');
      showToast(`🔔 ${gift.receiver_name}님께 선물 도착 리마인드 알림을 다시 발송했습니다!`, 'info');
    } finally {
      setActionLoadingId(null);
    }
  };

  const unclaimedReceived = receivedGifts.filter(g => g.status === 'UNCLAIMED');
  const claimedReceived = receivedGifts.filter(g => g.status === 'CLAIMED');

  const contentNode = (
    <div
      className={`w-full ${
        inline
          ? 'rounded-2xl border-2 border-slate-200 shadow-md'
          : 'max-w-lg rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 my-auto flex flex-col max-h-[90vh]'
      } bg-white dark:bg-slate-900 overflow-hidden`}
      onClick={e => e.stopPropagation()}
    >
      {/* 1. 상단 헤더 (썬드리머 표준 1줄 심플 헤더 + 균등 3탭) */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-700 to-amber-600 p-4 sm:p-5 text-white relative shrink-0">
        {!inline && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors cursor-pointer"
            aria-label="선물함 닫기"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center gap-3 pr-8">
          <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shadow-inner shrink-0">
            <Gift className="w-5 h-5 text-amber-200" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base sm:text-lg font-black tracking-tight text-white">패밀리 선물함</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-400/25 border border-amber-300/40 text-amber-200 text-xs font-black tabular-nums">
              보유 {coinBalance.toLocaleString()} C
            </span>
          </div>
        </div>

        {/* 3-Tab 네비게이션 */}
        <div className="grid grid-cols-3 gap-1.5 mt-4 bg-black/20 p-1 rounded-2xl">
          <button
            type="button"
            onClick={() => setActiveTab('received')}
            className={`py-2 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'received'
                ? 'bg-white text-indigo-900 shadow-sm'
                : 'text-white/85 hover:text-white hover:bg-white/10'
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>받은 선물</span>
            {unclaimedCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
                {unclaimedCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sent')}
            className={`py-2 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'sent'
                ? 'bg-white text-indigo-900 shadow-sm'
                : 'text-white/85 hover:text-white hover:bg-white/10'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>보낸 선물</span>
            {sentGifts.length > 0 && (
              <span className="text-[10px] opacity-75">({sentGifts.length})</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('send')}
            className={`py-2 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'send'
                ? 'bg-amber-400 text-slate-950 shadow-sm'
                : 'text-amber-200 hover:text-white hover:bg-white/10'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>선물 보내기</span>
          </button>
        </div>
      </div>

      {/* 2. 본문 컨텐츠 영역 */}
      <div className={`p-4 sm:p-5 ${inline ? '' : 'overflow-y-auto flex-1'} space-y-4 bg-slate-50/60 dark:bg-slate-900`}>
        {/* 언박싱 축하 배너 */}
        {unboxedBanner && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 via-yellow-50 to-emerald-50 border-2 border-amber-300 shadow-md flex items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0 shadow">
                <PartyPopper className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-black text-amber-900">
                  🎊 {unboxedBanner.sender}님의 선물이 적립되었습니다!
                </p>
                <p className="text-sm font-black text-emerald-700 mt-0.5">
                  +{unboxedBanner.amount.toLocaleString()} C 즉시 적립 완료
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setUnboxedBanner(null)}
              className="text-xs font-bold text-slate-400 hover:text-slate-600 px-2 py-1"
            >
              닫기
            </button>
          </div>
        )}

        {isLoading && activeTab !== 'send' ? (
          <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
            <span className="text-xs font-bold">선물함 데이터를 불러오는 중...</span>
          </div>
        ) : activeTab === 'received' ? (
          /* ================= [탭 1: 📥 받은 선물] ================= */
          <div className="space-y-4">
            {unclaimedReceived.length === 0 && claimedReceived.length === 0 ? (
              <div className="bg-white dark:bg-slate-800/80 rounded-2xl p-8 text-center border border-dashed border-slate-200 dark:border-slate-700 space-y-2.5">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-500 flex items-center justify-center mx-auto">
                  <Gift className="w-6 h-6" />
                </div>
                <p className="text-sm font-black text-slate-700 dark:text-slate-200">
                  아직 도착한 선물이 없습니다
                </p>
                <p className="text-xs text-slate-400">
                  받은 선물이 도착하면 이곳에서 바로 코인으로 적립할 수 있습니다.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('send')}
                  className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-xs transition-all cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>선물 보내기</span>
                </button>
              </div>
            ) : (
              <>
                {/* 미수령 선물 목록 */}
                {unclaimedReceived.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs font-black text-rose-600 dark:text-rose-400 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" /> 새로 도착한 선물 ({unclaimedReceived.length}개)
                      </span>
                    </div>

                    {unclaimedReceived.map(gift => {
                      const themeObj = THEME_OPTIONS.find(t => t.id === gift.theme) || THEME_OPTIONS[0];
                      const isBusy = actionLoadingId === gift.gift_id;
                      return (
                        <div
                          key={gift.gift_id}
                          className="rounded-2xl border-2 border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 overflow-hidden shadow-md"
                        >
                          <div className={`bg-gradient-to-r ${themeObj.gradient} px-4 py-2.5 text-white flex items-center justify-between`}>
                            <span className="text-xs font-black flex items-center gap-1.5">
                              <span>{themeObj.emoji}</span>
                              <span>{gift.sender_name}님이 보낸 선물</span>
                            </span>
                            <span className="text-[11px] font-black bg-white/20 px-2 py-0.5 rounded-full">
                              +{gift.amount.toLocaleString()} C
                            </span>
                          </div>
                          <div className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-black text-slate-900 dark:text-white">
                                {gift.gift_title}
                              </h4>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {(gift.created_at || '').slice(0, 10)}
                              </span>
                            </div>
                            <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-slate-900/70 border border-amber-200/60 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
                              💬 &ldquo;{gift.message}&rdquo;
                            </div>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleClaimGift(gift)}
                              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white font-black text-xs sm:text-sm shadow-md transition-all active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
                            >
                              {isBusy ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  <span>적립 처리 중...</span>
                                </>
                              ) : (
                                <>
                                  <PartyPopper className="w-4 h-4" />
                                  <span>🎊 선물 받기 (+{gift.amount.toLocaleString()}C 즉시 적립)</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 수령 완료된 선물 내역 */}
                {claimedReceived.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <span className="text-[11px] font-black text-slate-400 px-1 block">
                      받기 완료된 선물 ({claimedReceived.length}개)
                    </span>
                    {claimedReceived.map(gift => (
                      <div
                        key={gift.gift_id}
                        className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">
                              {gift.gift_title}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 shrink-0">
                              (보낸 분: {gift.sender_name})
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            &ldquo;{gift.message}&rdquo;
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 block">
                            +{gift.amount.toLocaleString()} C
                          </span>
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-slate-400">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" /> 적립완료
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ) : activeTab === 'sent' ? (
          /* ================= [탭 2: 📤 보낸 선물] ================= */
          <div className="space-y-3">
            {sentGifts.length === 0 ? (
              <div className="bg-white dark:bg-slate-800/80 rounded-2xl p-8 text-center border border-dashed border-slate-200 dark:border-slate-700 space-y-2.5">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-400 flex items-center justify-center mx-auto">
                  <Send className="w-5 h-5" />
                </div>
                <p className="text-sm font-black text-slate-700 dark:text-slate-200">
                  아직 보낸 선물이 없습니다
                </p>
                <p className="text-xs text-slate-400">
                  내가 보낸 선물의 수령 상태 확인 및 미수령 선물 회수가 이곳에서 가능합니다.
                </p>
              </div>
            ) : (
              sentGifts.map(gift => {
                const isBusy = actionLoadingId === gift.gift_id;
                return (
                  <div
                    key={gift.gift_id}
                    className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-2xs space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-black text-slate-900 dark:text-white">
                            받는 분: {gift.receiver_name}
                          </span>
                          {gift.status === 'CLAIMED' ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-black">
                              🟢 수령완료
                            </span>
                          ) : gift.status === 'UNCLAIMED' ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-black">
                              🟡 미수령 대기중
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 text-[10px] font-bold">
                              ⚪ 취소·회수됨
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {gift.gift_title} · {(gift.created_at || '').slice(0, 10)} 발송
                        </p>
                      </div>
                      <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 font-mono shrink-0">
                        {gift.amount.toLocaleString()} C
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                      💬 &ldquo;{gift.message}&rdquo;
                    </p>

                    {gift.status === 'UNCLAIMED' && (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleNudgeGift(gift)}
                          className="flex-1 py-2 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-xs font-black flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-indigo-200/60 dark:border-indigo-800"
                        >
                          <BellRing className="w-3.5 h-3.5" />
                          <span>알림 다시 보내기</span>
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleCancelGift(gift)}
                          className="py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-300 text-xs font-black flex items-center justify-center gap-1 transition-colors cursor-pointer border border-rose-200/60 dark:border-rose-800"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>선물 취소(회수)</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* ================= [탭 3: 🎁 선물 보내기] ================= */
          <div className="space-y-4">
            {/* STEP 1: 선물할 상품/코인 선택 */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-900 dark:text-white">
                  1️⃣ 선물할 상품 · 코인
                </span>
                <span className="text-[11px] font-semibold text-slate-400">
                  {selectedPreset.isCustom ? `최소 ${minCoin.toLocaleString()}C` : '맞춤 묶음'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {products.map(preset => {
                  const isSelected = selectedPresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className={`p-2.5 px-3 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'border-2 border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/50 dark:border-indigo-400 shadow-xs'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                          {preset.title}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 shrink-0">
                          {preset.subtitle}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* 직접 입력 (자유 코인 선물 코너) */}
              {selectedPreset.isCustom && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={customAmountInput}
                      onChange={e => setCustomAmountInput(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder={`${minCoin.toLocaleString()}C 이상 직접 입력 (예: ${minCoin.toLocaleString()})`}
                      className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-sm font-black text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-xs font-black text-slate-700 dark:text-slate-300">C</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[1000, 2000, 3000, 5000, 10000].filter(v => v >= minCoin).map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setCustomAmountInput(String(val))}
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-indigo-50 cursor-pointer"
                      >
                        {val.toLocaleString()}C
                      </button>
                    ))}
                    {coinBalance >= minCoin && (
                      <button
                        type="button"
                        onClick={() =>
                          setCustomAmountInput(String(Math.floor(coinBalance / 50) * 50))
                        }
                        className="px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-700 text-[11px] font-black text-amber-800 dark:text-amber-300 cursor-pointer"
                      >
                        전액 ({(Math.floor(coinBalance / 50) * 50).toLocaleString()}C)
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* STEP 2: 받는 분 지정 (실시간 자동완성 검색, 높이 100% 고정으로 화면 튐 원천 차단) */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-2 relative">
              <div className="flex items-center justify-between min-h-[28px]">
                <span className="text-xs font-black text-slate-900 dark:text-white">
                  2️⃣ 받는 분
                </span>
              </div>

              <div className="space-y-1.5 relative">
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={recipientInput}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleVerifyRecipient();
                        }
                      }}
                      onChange={e => {
                        const nextVal = e.target.value;
                        setRecipientInput(nextVal);
                        setSelectedContact(null);
                        setVerifiedRecipient(null);
                        if (!nextVal.trim()) {
                          setSearchResults([]);
                          setIsContactDropdownOpen(false);
                        }
                      }}
                      placeholder="별명 또는 이메일 입력 시 자동 검색"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleVerifyRecipient}
                    disabled={isVerifyingRecipient || !recipientInput.trim()}
                    className="px-3 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white text-xs font-black shrink-0 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    {isVerifyingRecipient || isSearchingRecipients ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Search className="w-3.5 h-3.5" />
                    )}
                    <span>검색</span>
                  </button>
                </div>

                {/* 👥 실시간 검색 결과 오버레이 드롭다운 (깜빡임/튐 없는 고정 렌더링) */}
                {isContactDropdownOpen &&
                  (() => {
                    const displayList = searchResults;

                    if (displayList.length === 0) return null;

                    return (
                      <div
                        ref={dropdownBoxRef}
                        className="absolute left-0 right-0 top-11 z-40 rounded-2xl bg-white dark:bg-slate-800 border-2 border-indigo-500/70 dark:border-indigo-400/70 shadow-2xl overflow-hidden"
                      >
                        <div className="px-3 py-2 bg-indigo-50/90 dark:bg-slate-900 border-b border-indigo-100 dark:border-slate-700 flex items-center justify-between">
                          <span className="text-[11px] font-black text-indigo-900 dark:text-indigo-300 flex items-center gap-1">
                            <Search className="w-3.5 h-3.5 text-indigo-600" />
                            <span>검색 결과 ({displayList.length}건)</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setIsContactDropdownOpen(false)}
                            className="text-[11px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-1.5 py-0.5 rounded cursor-pointer"
                          >
                            닫기 ✕
                          </button>
                        </div>

                        <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/60">
                          {displayList.map(c => {
                            const isSelected = selectedContact?.email === c.email;
                            return (
                              <button
                                key={c.email}
                                type="button"
                                onClick={() => handleSelectContactPill(c)}
                                className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                                  isSelected
                                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                                    : 'hover:bg-indigo-50/60 dark:hover:bg-slate-700/50 text-slate-800 dark:text-slate-100'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-xs font-black truncate">👤 {c.nickname}</span>
                                  <span className="text-[10px] text-slate-400 font-mono truncate">
                                    ({c.email})
                                  </span>
                                </div>
                                <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold shrink-0">
                                  {c.relation}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                {/* 고정 높이(h-8) 수신자 확인 표시줄: 선택/입력 중에도 높이 변화 0px 유지 */}
                <div
                  className={`h-8 px-3 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 transition-colors ${
                    verifiedRecipient
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800/70 text-emerald-800 dark:text-emerald-300'
                      : 'bg-slate-50/70 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {verifiedRecipient ? (
                    <>
                      <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate">{verifiedRecipient.detail}</span>
                    </>
                  ) : (
                    <span className="truncate">
                      별명 또는 이메일 입력 후 자동완성 목록에서 받으실 분을 선택해 주세요
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* STEP 3: 응원 카드 & 메시지 일체형 */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-2.5">
              <span className="text-xs font-black text-slate-900 dark:text-white block">
                3️⃣ 응원 메시지 카드
              </span>

              <div className="grid grid-cols-4 gap-1.5">
                {THEME_OPTIONS.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleSelectTheme(t)}
                    className={`py-2 px-1.5 rounded-xl text-[11px] font-black border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      selectedTheme === t.id
                        ? `${t.border} ${t.text} ring-2 ring-offset-1 ring-indigo-500/40`
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span>{t.emoji}</span>
                    <span className="truncate">{t.label}</span>
                  </button>
                ))}
              </div>

              {/* 일체형 선물 카드 입력창 (중복 미리보기 제거) */}
              <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-xs">
                <div className={`bg-gradient-to-r ${activeThemeObj.gradient} px-3.5 py-2 text-white flex items-center justify-between text-xs font-black`}>
                  <span>
                    {activeThemeObj.emoji} {activeThemeObj.label} · {selectedPreset.title}
                  </span>
                  <span>+{finalGiftAmount.toLocaleString()} C</span>
                </div>
                <textarea
                  rows={2}
                  value={giftMessage}
                  onChange={e => setGiftMessage(e.target.value)}
                  placeholder="응원 메시지를 입력해 주세요..."
                  className="w-full p-3 bg-amber-50/40 dark:bg-slate-900/60 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none resize-none block"
                />
              </div>

              <button
                type="button"
                disabled={isSending || finalGiftAmount < 50}
                onClick={handleSendGiftSubmit}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-amber-600 hover:from-indigo-700 hover:to-amber-700 text-white font-black text-sm shadow-lg transition-all active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>선물 발송 중...</span>
                  </>
                ) : (
                  <>
                    <Gift className="w-4 h-4" />
                    <span>
                      {finalGiftAmount.toLocaleString()}C 선물 보내기
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (inline) {
    return contentNode;
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/65 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-fadeIn"
      onClick={onClose}
    >
      {contentNode}
    </div>
  );
};
