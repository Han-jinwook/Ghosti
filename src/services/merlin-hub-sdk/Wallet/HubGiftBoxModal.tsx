'use client';

/**
 * Version: v2.5.0
 * Last Updated: 2026-11-06
 * Description: 패밀리 통합 '코인 선물함 & 코인 선물하기' 컴포넌트 (충전소 완벽 일체형 로고·폰트 & 부족분 충전 후 자동 선물 발송)
 * - 상단 헤더 및 코인 카드: 충전소와 100% 동일한 아기귀신 마스코트 로고(`ghosti.png` / `GHOST_COIN_WINK_BASE64`) 및 도자기 서체(`Cafe24Ssurround` / `TmoneyRoundWindExtraBold`) 적용
 * - 탭 및 버튼 명칭 통일: `코인 선물함` / `코인 선물하기`
 * - 보유 코인 부족 시 스마트 충전 롤백 & 충전 완료 후 기억해 둔 선물 자동 발송(`merlin_pending_gift_v1`) 완벽 지원
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  ChevronDown,
  PartyPopper,
  Loader2,
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
import { getConfig } from '../CoreLogic/config';
import { showToast } from '../CoreLogic/HubNotifier';
import { triggerHaptic } from '../CoreLogic/haptic';
import { GHOST_COIN_WINK_BASE64, GHOST_COIN_HUG_BASE64, GHOST_COIN_TITLE_BASE64 } from '../assets/ghostCoinBase64';

export const PENDING_GIFT_STORAGE_KEY = 'merlin_pending_gift_v1';

export interface PendingGiftDraft {
  receiverEmail: string;
  receiverId?: string;
  receiverName: string;
  receiverDetail: string;
  giftTitle: string;
  amount: number;
  theme: HubGiftThemeId;
  message: string;
  shortfallCoins: number;
  recommendedChargeCoins: number;
  createdAt: number;
}

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
  customProducts?: GiftProductItem[]; // 하위 호환용 prop 유지
  minCustomCoin?: number; // 최소 선물 코인 단위 (기본 1,000C)
  onRequestChargeForGift?: (recommendedChargeCoins: number, draft: PendingGiftDraft) => void;
}

/**
 * 하위 호환용 export 상수 유지 (외부 import 에러 방지)
 */
export const AGGRO_GIFT_PRODUCTS: GiftProductItem[] = [
  {
    id: 'ghost_coin_1000',
    title: '👻 귀신코인 선물',
    subtitle: '1,000C 단위 자유 선택',
    fullTitle: '👻 귀신코인 선물',
    amount: 1000,
    category: 'COIN',
    emoji: '👻',
    defaultMessage: '귀신팸 모든 앱에서 자유롭게 쓰실 수 있는 귀신코인 선물을 보냅니다! 🎁',
    isCustom: true,
  },
];

export const SENSETALK_GIFT_PRODUCTS: GiftProductItem[] = AGGRO_GIFT_PRODUCTS;

export type HubGiftThemeId = 'CHEER' | 'THANKS' | 'TOGETHER' | 'CONGRATS' | 'HEART';

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
  initialTab = 'send',
  inline = false,
  minCustomCoin = 1000,
  onRequestChargeForGift,
}) => {
  const { isLoggedIn, balance, refreshBalance } = useHub();
  const config = getConfig();
  const hubBaseUrl = (config?.hubUrl || 'https://os.sundreamer.app').replace(/\/+$/, '');

  const minCoin = typeof minCustomCoin === 'number' && minCustomCoin >= 1000 ? minCustomCoin : 1000;

  const [activeTab, setActiveTab] = useState<'received' | 'sent' | 'send'>(initialTab);
  const [receivedGifts, setReceivedGifts] = useState<GiftItem[]>([]);
  const [sentGifts, setSentGifts] = useState<GiftItem[]>([]);
  const [, setContacts] = useState<GiftContact[]>([]);
  const [unclaimedCount, setUnclaimedCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [unboxedBanner, setUnboxedBanner] = useState<{ title: string; amount: number; sender: string } | null>(null);

  // 선물 보내기 폼 상태 (전 패밀리 앱 공통 귀신코인 누적 선택: +1,000 / +10,000)
  const [giftCoinAmount, setGiftCoinAmount] = useState<number>(0);
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
  const [giftMessage, setGiftMessage] = useState<string>(THEME_OPTIONS[0].defaultMsg);
  const [isSending, setIsSending] = useState<boolean>(false);

  const dropdownBoxRef = useRef<HTMLDivElement | null>(null);
  const dropdownBtnRef = useRef<HTMLButtonElement | null>(null);
  const autoExecutedRef = useRef<boolean>(false);

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
      loadGiftData(initialTab === 'send');
    }
  }, [inline, isOpen, initialTab, isLoggedIn, loadGiftData]);

  // 🚀 충전 전에 기억해 두었던 선물 정보 복원 & 충전 완료 시 자동 발송 실행
  useEffect(() => {
    if (typeof window === 'undefined' || !isLoggedIn) return;
    const raw = localStorage.getItem(PENDING_GIFT_STORAGE_KEY);
    if (!raw) return;

    try {
      const draft: PendingGiftDraft = JSON.parse(raw);
      // 30분 이상 지난 오래된 임시 데이터는 자동 폐기
      if (!draft || !draft.amount || Date.now() - (draft.createdAt || 0) > 30 * 60 * 1000) {
        localStorage.removeItem(PENDING_GIFT_STORAGE_KEY);
        return;
      }

      // 폼 상태에 기억해 둔 선물 정보 그대로 복원
      setGiftCoinAmount(draft.amount);
      setRecipientInput(draft.receiverName || draft.receiverEmail);
      setSelectedContact({
        email: draft.receiverEmail,
        nickname: draft.receiverName,
        userId: draft.receiverId,
        relation: '지인',
      });
      setVerifiedRecipient({
        displayName: draft.receiverName,
        email: draft.receiverEmail,
        detail: draft.receiverDetail || `받는 분: ${draft.receiverName} (${draft.receiverEmail})`,
      });
      if (draft.theme) setSelectedTheme(draft.theme);
      if (draft.message) setGiftMessage(draft.message);

      // 충전이 끝나 보유 코인이 선물할 코인 이상으로 충족되었다면 즉시 자동 선물 발송!
      if (typeof balance === 'number' && balance >= draft.amount && !autoExecutedRef.current) {
        autoExecutedRef.current = true;
        localStorage.removeItem(PENDING_GIFT_STORAGE_KEY);

        (async () => {
          setIsSending(true);
          try {
            const res = await sendGift({
              receiverEmail: draft.receiverEmail,
              receiverId: draft.receiverId,
              receiverName: draft.receiverName,
              giftTitle: draft.giftTitle || `👻 귀신코인 ${draft.amount.toLocaleString()}C 선물`,
              giftCategory: 'COIN',
              amount: draft.amount,
              theme: draft.theme || 'CHEER',
              message: draft.message,
            });

            if (res.success) {
              triggerHaptic('success');
              showToast(
                `🎉 코인 충전 완료! 기억해 둔 ${draft.receiverName}님께 ${draft.amount.toLocaleString()}C 선물을 자동 발송했습니다!`,
                'info'
              );
              setGiftCoinAmount(0);
              setRecipientInput('');
              setSelectedContact(null);
              setVerifiedRecipient(null);
              refreshBalance();
              await loadGiftData(true);
              setActiveTab('sent');
            } else {
              showToast(res.error || '충전 후 자동 선물 발송 중 오류가 발생했습니다. 버튼을 눌러 다시 보내주세요.', 'error');
              setActiveTab('send');
            }
          } finally {
            setIsSending(false);
          }
        })();
      }
    } catch {
      localStorage.removeItem(PENDING_GIFT_STORAGE_KEY);
    }
  }, [isLoggedIn, balance, refreshBalance, loadGiftData]);

  // 별명/이메일 입력 시 실시간 회원 자동완성 검색 (타이핑 즉시 우측 결과창에 자동 반영)
  useEffect(() => {
    const raw = recipientInput.trim();
    const cleanQ = raw.replace(/[ㄱ-ㅎㅏ-ㅣ]+$/g, '').trim() || raw;

    if (!cleanQ) {
      setSearchResults([]);
      setIsContactDropdownOpen(false);
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
            // 첫 번째 일치 회원을 우측 결과창에 즉시 기본 선택하여 바로 확인/드롭다운 선택 가능하게 함
            const lowerQ = cleanQ.toLowerCase();
            const bestMatch =
              found.find(
                item =>
                  item.nickname.toLowerCase() === lowerQ ||
                  item.email.toLowerCase() === lowerQ ||
                  item.email.split('@')[0].toLowerCase() === lowerQ
              ) || found[0];
            setSelectedContact(bestMatch);
            setVerifiedRecipient({
              displayName: bestMatch.nickname || bestMatch.email.split('@')[0],
              email: bestMatch.email,
              detail: `받는 분: ${bestMatch.nickname || bestMatch.email.split('@')[0]} (${bestMatch.email})`,
            });
            setIsContactDropdownOpen(found.length > 1);
          } else {
            if (cleanQ.includes('@')) {
              const cleanEmail = cleanQ.toLowerCase();
              const nick = cleanEmail.split('@')[0];
              const emailContact: GiftContact = {
                email: cleanEmail,
                nickname: nick,
                relation: '이메일 지인',
              };
              setSelectedContact(emailContact);
              setVerifiedRecipient({
                displayName: nick,
                email: cleanEmail,
                detail: `받는 분: ${nick} (${cleanEmail})`,
              });
            }
            setIsContactDropdownOpen(false);
          }
        }
      } finally {
        if (!cancelled) {
          setIsSearchingRecipients(false);
        }
      }
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [recipientInput]);

  if (!inline && !isOpen) return null;

  const coinBalance = typeof balance === 'number' ? balance : 0;
  const finalGiftAmount = Math.max(0, Math.floor(giftCoinAmount));
  const finalGiftTitle = `👻 귀신코인 ${finalGiftAmount.toLocaleString()}C 선물`;
  const activeThemeObj = THEME_OPTIONS.find(t => t.id === selectedTheme) || THEME_OPTIONS[0];
  const isOverBalance = finalGiftAmount > coinBalance;
  const shortfallCoins = Math.max(0, finalGiftAmount - coinBalance);
  const recommendedChargeCoins = Math.max(1000, Math.ceil(shortfallCoins / 1000) * 1000);

  const handleAddGiftCoin = (delta: number) => {
    triggerHaptic('light');
    setGiftCoinAmount(prev => Math.min(Math.max(0, prev + delta), 1000000));
  };

  const handleResetGiftCoin = () => {
    triggerHaptic('light');
    setGiftCoinAmount(0);
  };

  const handleSelectAllBalance = () => {
    triggerHaptic('light');
    const maxThousand = Math.floor(coinBalance / 1000) * 1000;
    if (maxThousand < 1000) {
      showToast('선물 가능한 보유 코인(1,000C 단위)이 부족합니다.', 'error');
      return;
    }
    setGiftCoinAmount(maxThousand);
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

    if (finalGiftAmount < minCoin) {
      showToast(`선물하실 코인(+1,000 또는 +10,000)을 먼저 선택해 주세요! (최소 ${minCoin.toLocaleString()}C)`, 'error');
      return;
    }
    if (finalGiftAmount % 1000 !== 0) {
      showToast('귀신코인 선물은 1,000C 단위로만 보낼 수 있습니다.', 'error');
      return;
    }

    let resolvedEmail = (verifiedRecipient?.email || selectedContact?.email || '').trim();
    let resolvedName = (verifiedRecipient?.displayName || selectedContact?.nickname || '').trim();
    let resolvedId = selectedContact?.userId;

    // 만약 자동완성 선택 전 상태라면 즉시 1회 자동 조회하여 수신자 확정
    if (!resolvedEmail) {
      const rawQ = recipientInput.trim();
      if (!rawQ) {
        showToast('선물 받으실 분의 별명 또는 이메일을 입력해 주세요.', 'error');
        return;
      }
      if (rawQ.includes('@')) {
        resolvedEmail = rawQ.toLowerCase();
        resolvedName = resolvedEmail.split('@')[0];
      } else {
        setIsVerifyingRecipient(true);
        try {
          const searchRes = await searchGiftUsers(rawQ);
          const list = searchRes.users || [];
          const lowerQ = rawQ.toLowerCase();
          const matched =
            list.find(
              item =>
                item.nickname.toLowerCase() === lowerQ ||
                item.email.toLowerCase() === lowerQ ||
                item.email.split('@')[0].toLowerCase() === lowerQ
            ) || (list.length === 1 ? list[0] : null);

          if (!matched) {
            if (list.length > 1) {
              setSearchResults(list);
              setDropdownMode('search');
              setIsContactDropdownOpen(true);
              showToast('검색된 회원 목록에서 받으실 분을 선택해 주세요.', 'info');
            } else {
              showToast(`'${rawQ}' 별명으로 등록된 회원을 찾지 못했습니다. 정확한 별명 또는 이메일을 입력해 주세요.`, 'error');
            }
            return;
          }
          handleSelectContactPill(matched);
          resolvedEmail = matched.email;
          resolvedName = matched.nickname || matched.email.split('@')[0];
          resolvedId = matched.userId;
        } finally {
          setIsVerifyingRecipient(false);
        }
      }
    }

    const displayTarget = resolvedName || resolvedEmail;

    // 🚨 [핵심 기능] 보유 코인보다 선물할 코인이 많을 때: 선물 내역을 기억해 두고 충전소로 안내 & 충전 직후 자동 발송!
    if (typeof balance === 'number' && finalGiftAmount > balance) {
      const shortage = finalGiftAmount - balance;
      const chargeNeed = Math.max(1000, Math.ceil(shortage / 1000) * 1000);

      const proceedCharge = window.confirm(
        `[👻 보유 귀신코인 부족 안내]\n\n` +
          `• 선물할 코인: ${finalGiftAmount.toLocaleString()} C\n` +
          `• 현재 보유 코인: ${balance.toLocaleString()} C\n` +
          `• 부족한 코인: ${shortage.toLocaleString()} C (최소 충전 단위: ${chargeNeed.toLocaleString()} C)\n\n` +
          `충전 화면으로 이동하여 부족한 코인을 충전하시겠습니까?\n` +
          `✨ 지금 입력하신 [${displayTarget}님께 ${finalGiftAmount.toLocaleString()}C 선물] 내용을 그대로 기억해 두었다가, 충전이 끝나는 즉시 자동으로 선물을 보내드립니다!`
      );

      if (!proceedCharge) return;

      const draft: PendingGiftDraft = {
        receiverEmail: resolvedEmail,
        receiverId: resolvedId,
        receiverName: displayTarget,
        receiverDetail: `받는 분: ${displayTarget} (${resolvedEmail})`,
        giftTitle: finalGiftTitle,
        amount: finalGiftAmount,
        theme: selectedTheme,
        message: giftMessage.trim() || activeThemeObj.defaultMsg,
        shortfallCoins: shortage,
        recommendedChargeCoins: chargeNeed,
        createdAt: Date.now(),
      };

      if (typeof window !== 'undefined') {
        localStorage.setItem(PENDING_GIFT_STORAGE_KEY, JSON.stringify(draft));
      }

      if (onRequestChargeForGift) {
        onRequestChargeForGift(chargeNeed, draft);
      } else if (typeof window !== 'undefined') {
        if (onClose) onClose();
        window.location.href = `/payment/purchase?tab=charge&chargeCoin=${chargeNeed}&autoGift=1`;
      }
      return;
    }

    const confirmSend = window.confirm(
      `[🎁 귀신코인 선물하기 확인]\n\n• 받는 분: ${displayTarget}\n• 선물 코인: ${finalGiftAmount.toLocaleString()} C (귀신팸 전 앱 공용)\n• 응원 메시지: "${giftMessage}"\n\n위 내용으로 코인을 선물하시겠습니까?\n(상대방이 수령하기 전까지는 [보낸 선물] 탭에서 언제든 취소·환급 가능합니다.)`
    );
    if (!confirmSend) return;

    setIsSending(true);
    try {
      const res = await sendGift({
        receiverEmail: resolvedEmail,
        receiverId: resolvedId,
        receiverName: displayTarget,
        giftTitle: finalGiftTitle,
        giftCategory: 'COIN',
        amount: finalGiftAmount,
        theme: selectedTheme,
        message: giftMessage.trim() || activeThemeObj.defaultMsg,
      });

      if (!res.success) {
        showToast(res.error || '선물 발송에 실패했습니다.', 'error');
        return;
      }

      if (typeof window !== 'undefined') {
        localStorage.removeItem(PENDING_GIFT_STORAGE_KEY);
      }
      triggerHaptic('success');
      showToast(`🎉 ${displayTarget}님께 ${finalGiftAmount.toLocaleString()}C 선물을 성공적으로 보냈습니다!`, 'info');
      setGiftCoinAmount(0);
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
  const maxGiftableBalance = Math.floor(coinBalance / 1000) * 1000;

  const contentNode = (
    <div
      className={`hub-giftbox-modal w-full ${
        inline
          ? 'gh-section-box rounded-2xl border border-slate-300 bg-white p-3.5 sm:p-4 shadow-xs'
          : 'max-w-lg rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 my-auto flex flex-col max-h-[90vh] bg-white dark:bg-slate-900 overflow-hidden'
      }`}
      style={{ fontFamily: "'TmoneyRoundWindExtraBold', 'Cafe24Ssurround', sans-serif" }}
      onClick={e => e.stopPropagation()}
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
      `}</style>

      {/* 1. 상단 헤더 (인라인 탭일 때는 충전하기 탭과 100% 동일한 `| 코인 선물함` 작은 제목 스타일로 통일!) */}
      {inline ? (
        <div className="mb-2.5">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="w-1 h-4 rounded-full bg-slate-300 block"></span>
              <h2 className="text-sm sm:text-base font-semibold text-slate-600">
                코인 선물함
              </h2>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-xs font-semibold tabular-nums">
              보유 {coinBalance.toLocaleString()} C
            </span>
          </div>

          <div
            className="gh-light-tab-bar bg-slate-100 p-1 border border-slate-300 rounded-xl grid grid-cols-3 gap-1"
            style={{ fontFamily: "'Cafe24Ssurround', 'TmoneyRoundWindExtraBold', sans-serif" }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('received')}
              className={
                activeTab === 'received'
                  ? 'gh-light-tab rounded-lg py-1.5 px-2 text-xs sm:text-sm font-semibold bg-white text-slate-800 border border-slate-200/90 shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1.5'
                  : 'rounded-lg py-1.5 px-2 text-xs sm:text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-white/60 transition-all cursor-pointer flex items-center justify-center gap-1.5'
              }
            >
              <Inbox className="w-3.5 h-3.5" />
              <span>받은 선물</span>
              {unclaimedCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white animate-pulse">
                  {unclaimedCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('sent')}
              className={
                activeTab === 'sent'
                  ? 'gh-light-tab rounded-lg py-1.5 px-2 text-xs sm:text-sm font-semibold bg-white text-slate-800 border border-slate-200/90 shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1.5'
                  : 'rounded-lg py-1.5 px-2 text-xs sm:text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-white/60 transition-all cursor-pointer flex items-center justify-center gap-1.5'
              }
            >
              <Clock className="w-3.5 h-3.5" />
              <span>보낸 선물</span>
              {sentGifts.length > 0 && (
                <span className="text-[10px] opacity-80">({sentGifts.length})</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('send')}
              className={
                activeTab === 'send'
                  ? 'gh-light-tab rounded-lg py-1.5 px-2 text-xs sm:text-sm font-semibold bg-white text-slate-800 border border-slate-200/90 shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1.5'
                  : 'rounded-lg py-1.5 px-2 text-xs sm:text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-white/60 transition-all cursor-pointer flex items-center justify-center gap-1.5'
              }
            >
              <Send className="w-3.5 h-3.5" />
              <span>코인 선물하기</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="gh-light-banner bg-gradient-to-r from-indigo-50 via-indigo-100/70 to-blue-50 p-4 sm:p-5 text-indigo-950 border-b border-indigo-200 relative shrink-0">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-white/80 hover:bg-white flex items-center justify-center text-indigo-700 transition-colors cursor-pointer shadow-2xs"
              aria-label="선물함 닫기"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center justify-between gap-3 flex-wrap pr-2">
            <div className="flex items-center gap-3">
              <img
                src={`${hubBaseUrl}/ghosti.png`}
                onError={e => {
                  const target = e.currentTarget;
                  if (target.src !== GHOST_COIN_WINK_BASE64) {
                    target.src = GHOST_COIN_WINK_BASE64;
                  }
                }}
                alt="귀신코인 아기귀신 로고"
                className="h-11 w-11 sm:h-12 sm:w-12 object-contain rounded-xl border border-indigo-200 shadow-xs bg-white/80 shrink-0"
              />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2
                    className="text-base sm:text-lg font-bold tracking-wide text-indigo-950"
                    style={{ fontFamily: "'Cafe24Ssurround', 'TmoneyRoundWindExtraBold', sans-serif" }}
                  >
                    귀신코인 선물함
                  </h2>
                  <span
                    className="px-2.5 py-0.5 rounded-full bg-indigo-600 text-white text-xs font-bold tabular-nums shadow-2xs"
                    style={{ fontFamily: "'Cafe24Ssurround', 'TmoneyRoundWindExtraBold', sans-serif" }}
                  >
                    보유 {coinBalance.toLocaleString()} C
                  </span>
                </div>
                <p className="text-[11px] text-indigo-800/80 font-medium mt-0.5">
                  귀신팸 모든 앱에서 자유롭게 쓰는 통합 귀신코인 선물
                </p>
              </div>
            </div>
          </div>

          <div
            className="grid grid-cols-3 gap-1.5 mt-3.5 bg-white/75 p-1 rounded-xl border border-indigo-200/80"
            style={{ fontFamily: "'Cafe24Ssurround', 'TmoneyRoundWindExtraBold', sans-serif" }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('received')}
              className={`py-2 px-2 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'received'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-indigo-950/75 hover:text-indigo-950 hover:bg-white'
              }`}
            >
              <Inbox className="w-3.5 h-3.5" />
              <span>받은 선물</span>
              {unclaimedCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white animate-pulse">
                  {unclaimedCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('sent')}
              className={`py-2 px-2 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'sent'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-indigo-950/75 hover:text-indigo-950 hover:bg-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>보낸 선물</span>
              {sentGifts.length > 0 && (
                <span className="text-[10px] opacity-80">({sentGifts.length})</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('send')}
              className={`py-2 px-2 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'send'
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'text-indigo-950/80 hover:text-indigo-950 hover:bg-amber-50'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>코인 선물하기</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. 본문 컨텐츠 영역 */}
      <div className={`${inline ? 'space-y-2.5' : 'p-3.5 sm:p-4 overflow-y-auto flex-1 space-y-2.5 bg-slate-50/70 dark:bg-slate-900'}`}>
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
                <p
                  className="text-sm text-slate-700 dark:text-slate-200"
                  style={{ fontFamily: "'Cafe24Ssurround', 'TmoneyRoundWindExtraBold', sans-serif" }}
                >
                  아직 도착한 선물이 없습니다
                </p>
                <p className="text-xs text-slate-400">
                  받은 선물이 도착하면 이곳에서 바로 귀신코인으로 적립할 수 있습니다.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('send')}
                  className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs shadow-xs transition-all cursor-pointer"
                  style={{ fontFamily: "'Cafe24Ssurround', 'TmoneyRoundWindExtraBold', sans-serif" }}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>코인 선물하기</span>
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
                <p
                  className="text-sm text-slate-700 dark:text-slate-200"
                  style={{ fontFamily: "'Cafe24Ssurround', 'TmoneyRoundWindExtraBold', sans-serif" }}
                >
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
          /* ================= [탭 3: 🎁 코인 선물하기 (전 패밀리 앱 공통 귀신코인 누적 선물)] ================= */
          <div className="space-y-2.5">
            {/* STEP 1: 선물할 귀신코인 선택 (충전소와 동일한 아기귀신 + 귀신코인 로고 + 1,000 / 10,000 누적 버튼) */}
            <div className="bg-white dark:bg-slate-800 p-3 sm:p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <span
                  className="text-xs sm:text-sm text-slate-800 dark:text-white"
                  style={{ fontFamily: "'Cafe24Ssurround', 'TmoneyRoundWindExtraBold', sans-serif" }}
                >
                  1️⃣ 선물할 귀신코인 선택
                </span>
                <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                  귀신팸 모든 앱에서 자유롭게 사용 가능
                </span>
              </div>

              {/* 🏆 충전소와 일체감 있는 다크 네이비·골드 귀신코인 선물 디스플레이 카드 (세로 폭 30% 여유 확대) */}
              <div
                data-keep-dark="true"
                className="gh-dark-card relative rounded-2xl overflow-hidden border border-amber-300/85 ring-1 ring-amber-400/25 shadow-[0_8px_20px_rgba(13,18,48,0.35)] bg-gradient-to-b from-[#0d1230] via-[#0f173a] to-[#0a0e27] px-4 py-4 sm:py-5 text-white flex items-center justify-between gap-3"
                style={{ fontFamily: "'Cafe24Ssurround', 'TmoneyRoundWindExtraBold', sans-serif" }}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex flex-col items-center shrink-0">
                    <img
                      src={finalGiftAmount >= 30000 ? GHOST_COIN_HUG_BASE64 : GHOST_COIN_WINK_BASE64}
                      alt="귀신코인"
                      className="w-14 h-14 sm:w-16 sm:h-16 object-contain filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]"
                    />
                    <img
                      src={GHOST_COIN_TITLE_BASE64}
                      alt="귀신코인"
                      className="h-5 sm:h-5.5 w-auto object-contain -mt-1 pointer-events-none select-none"
                    />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs text-cyan-200 block leading-snug">
                      보내실 귀신코인 (보유 {coinBalance.toLocaleString()} C)
                    </span>
                    <div className="flex items-baseline gap-1.5 mt-1">
                      <span
                        className="text-2xl sm:text-3xl text-amber-300 tabular-nums tracking-wide leading-none"
                        style={{
                          filter: 'drop-shadow(0 2px 0 #78350f) drop-shadow(0 3px 8px rgba(251,191,36,0.35))',
                        }}
                      >
                        {finalGiftAmount.toLocaleString()}
                      </span>
                      <span className="text-sm sm:text-base text-cyan-200">
                        코인 (C)
                      </span>
                    </div>
                    {isOverBalance && (
                      <span className="text-[11px] text-amber-300/95 block mt-1 leading-tight">
                        ⚡ 부족분 {shortfallCoins.toLocaleString()}C는 충전 후 자동 선물됩니다
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {maxGiftableBalance >= 1000 && (
                    <button
                      type="button"
                      onClick={handleSelectAllBalance}
                      className="px-3 py-1.5 rounded-full bg-amber-400/20 hover:bg-amber-400/30 border border-amber-300/60 text-xs text-amber-200 transition-all cursor-pointer active:scale-95"
                    >
                      전액
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleResetGiftCoin}
                    className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/25 text-xs text-white transition-all cursor-pointer active:scale-95"
                  >
                    ↺ 0 초기화
                  </button>
                </div>
              </div>

              {/* ⚡ 1,000 / 10,000 단위 2개 누적 버튼 */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleAddGiftCoin(1000)}
                  className="py-2 px-3 rounded-xl bg-slate-50 hover:bg-indigo-50/70 dark:bg-slate-900 dark:hover:bg-slate-800 border-2 border-slate-200 hover:border-indigo-400 dark:border-slate-700 text-slate-800 dark:text-white text-sm transition-all cursor-pointer active:scale-[0.98] flex items-center justify-center gap-1 shadow-2xs"
                  style={{ fontFamily: "'Cafe24Ssurround', 'TmoneyRoundWindExtraBold', sans-serif" }}
                >
                  <span className="text-indigo-600 dark:text-indigo-400">+1,000</span>
                  <span className="text-xs text-slate-600 dark:text-slate-300">코인</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddGiftCoin(10000)}
                  className="py-2 px-3 rounded-xl bg-slate-50 hover:bg-indigo-50/70 dark:bg-slate-900 dark:hover:bg-slate-800 border-2 border-slate-200 hover:border-indigo-400 dark:border-slate-700 text-slate-800 dark:text-white text-sm transition-all cursor-pointer active:scale-[0.98] flex items-center justify-center gap-1 shadow-2xs"
                  style={{ fontFamily: "'Cafe24Ssurround', 'TmoneyRoundWindExtraBold', sans-serif" }}
                >
                  <span className="text-indigo-600 dark:text-indigo-400">+10,000</span>
                  <span className="text-xs text-slate-600 dark:text-slate-300">코인</span>
                </button>
              </div>
            </div>

            {/* STEP 2: 받는 분 지정 (좌측 1/2 자동검색 입력창 + 우측 1/2 결과/드롭다운 1줄 배치) */}
            <div className="bg-white dark:bg-slate-800 p-3 sm:p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-1.5 relative">
              <div className="flex items-center justify-between">
                <span
                  className="text-xs sm:text-sm text-slate-800 dark:text-white"
                  style={{ fontFamily: "'Cafe24Ssurround', 'TmoneyRoundWindExtraBold', sans-serif" }}
                >
                  2️⃣ 받는 분
                </span>
                <span className="text-[11px] text-slate-400">
                  입력 즉시 우측에 자동 검색됩니다
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center relative">
                {/* 좌측 1/2: 검색 버튼 없는 실시간 자동검색 입력창 */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
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
                    placeholder="별명 또는 이메일 입력"
                    className="w-full h-9 pl-8 pr-7 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {isSearchingRecipients || isVerifyingRecipient ? (
                    <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin absolute right-2.5 top-1/2 -translate-y-1/2" />
                  ) : recipientInput ? (
                    <button
                      type="button"
                      onClick={() => {
                        setRecipientInput('');
                        setSelectedContact(null);
                        setVerifiedRecipient(null);
                        setSearchResults([]);
                        setIsContactDropdownOpen(false);
                      }}
                      className="text-slate-400 hover:text-slate-600 absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
                      aria-label="입력 지우기"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  ) : null}
                </div>

                {/* 우측 1/2: 검색 결과 표시 & 클릭 시 후보 드롭다운 */}
                <div className="relative">
                  <button
                    ref={dropdownBtnRef}
                    type="button"
                    onClick={() => {
                      if (searchResults.length > 0) {
                        setIsContactDropdownOpen(prev => !prev);
                      }
                    }}
                    className={`w-full h-9 px-3 rounded-xl border text-[11px] font-bold flex items-center justify-between gap-1.5 transition-all text-left ${
                      verifiedRecipient
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800/70 text-emerald-800 dark:text-emerald-300 cursor-pointer'
                        : searchResults.length > 0
                        ? 'bg-indigo-50/70 border-indigo-200 text-indigo-800 cursor-pointer'
                        : 'bg-slate-50/70 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 cursor-default'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      {verifiedRecipient ? (
                        <>
                          <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate">{verifiedRecipient.detail}</span>
                        </>
                      ) : isSearchingRecipients ? (
                        <span className="truncate text-indigo-600">회원 찾는 중...</span>
                      ) : recipientInput.trim() ? (
                        <span className="truncate text-rose-500">일치하는 회원이 없습니다</span>
                      ) : (
                        <span className="truncate">좌측 입력 시 자동 표시</span>
                      )}
                    </div>
                    {searchResults.length > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-md bg-white/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/70 shrink-0">
                        {searchResults.length}명
                        <ChevronDown className="w-3 h-3" />
                      </span>
                    )}
                  </button>

                  {/* 👥 우측 결과창 하단 자동완성 드롭다운 */}
                  {isContactDropdownOpen && searchResults.length > 0 && (
                    <div
                      ref={dropdownBoxRef}
                      className="absolute left-0 right-0 top-10 z-40 rounded-xl bg-white dark:bg-slate-800 border-2 border-indigo-500/70 dark:border-indigo-400/70 shadow-xl overflow-hidden"
                    >
                      <div className="max-h-44 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/60">
                        {searchResults.map(c => {
                          const isSelected = selectedContact?.email === c.email;
                          return (
                            <button
                              key={c.email}
                              type="button"
                              onClick={() => handleSelectContactPill(c)}
                              className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                                  : 'hover:bg-indigo-50/60 dark:hover:bg-slate-700/50 text-slate-800 dark:text-slate-100'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-xs font-black truncate">👤 {c.nickname}</span>
                                <span className="text-[10px] text-slate-400 font-mono truncate">
                                  ({c.email})
                                </span>
                              </div>
                              {isSelected && (
                                <span className="text-[10px] text-emerald-600 font-bold shrink-0">선택됨</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* STEP 3: 응원 카드 & 메시지 일체형 */}
            <div className="bg-white dark:bg-slate-800 p-3 sm:p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span
                  className="text-xs sm:text-sm text-slate-800 dark:text-white"
                  style={{ fontFamily: "'Cafe24Ssurround', 'TmoneyRoundWindExtraBold', sans-serif" }}
                >
                  3️⃣ 응원 메시지 카드
                </span>

                <div className="grid grid-cols-4 gap-1 flex-1 sm:flex-initial">
                  {THEME_OPTIONS.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleSelectTheme(t)}
                      className={`py-1 px-2 rounded-lg text-[11px] border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        selectedTheme === t.id
                          ? `${t.border} ${t.text} ring-1 ring-indigo-500/40`
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                      }`}
                      style={{ fontFamily: "'Cafe24Ssurround', 'TmoneyRoundWindExtraBold', sans-serif" }}
                    >
                      <span>{t.emoji}</span>
                      <span className="truncate">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 일체형 선물 카드 입력창 */}
              <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-2xs">
                <div
                  className={`bg-gradient-to-r ${activeThemeObj.gradient} px-3 py-1.5 text-white flex items-center justify-between text-xs`}
                  style={{ fontFamily: "'Cafe24Ssurround', 'TmoneyRoundWindExtraBold', sans-serif" }}
                >
                  <span>
                    {activeThemeObj.emoji} {activeThemeObj.label} · 👻 귀신코인 선물
                  </span>
                  <span>+{finalGiftAmount.toLocaleString()} C</span>
                </div>
                <textarea
                  rows={2}
                  value={giftMessage}
                  onChange={e => setGiftMessage(e.target.value)}
                  placeholder="응원 메시지를 입력해 주세요..."
                  className="w-full px-3 py-2 bg-amber-50/40 dark:bg-slate-900/60 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none resize-none block leading-snug"
                />
              </div>

              <button
                type="button"
                disabled={isSending}
                onClick={handleSendGiftSubmit}
                className="gh-dark-cta w-full py-3 rounded-xl bg-gradient-to-b from-[#1b2554] via-[#131b40] to-[#0b1029] hover:from-[#222f68] hover:to-[#101738] text-white border border-amber-300/85 ring-1 ring-amber-400/25 shadow-[0_8px_18px_rgba(13,18,48,0.3)] text-sm sm:text-base transition-all active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ fontFamily: "'Cafe24Ssurround', 'TmoneyRoundWindExtraBold', sans-serif" }}
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>선물 발송 중...</span>
                  </>
                ) : (
                  <>
                    <Gift className="w-4 h-4 text-amber-300" />
                    <span>
                      {finalGiftAmount > 0 ? `${finalGiftAmount.toLocaleString()}C ` : ''}코인 선물하기
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
