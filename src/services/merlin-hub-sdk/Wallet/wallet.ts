/**
 * Version: v1.6.0
 * Last Updated: 2026-10-20
 * Description: 패밀리 통합 선물하기(getGiftList, searchGiftUsers, sendGift, claimGift, cancelGift, nudgeGift) API 연동 및 일괄 정액 과금 지원
 */
import { hubFetch } from '../CoreLogic/client';
import { getConfig } from '../CoreLogic/config';

export interface WalletBalance {
  balance: number;
  userId: string;
}

export interface GiftItem {
  gift_id: string;
  sender_id: string;
  sender_name: string;
  sender_email?: string;
  receiver_id?: string | null;
  receiver_email: string;
  receiver_name: string;
  gift_title: string;
  gift_category: 'APP_ITEM' | 'COIN' | 'POINT';
  amount: number;
  unit: 'C' | 'P';
  app_id: string;
  target_app_url?: string;
  theme: 'CONGRATS' | 'THANKS' | 'CHEER' | 'TOGETHER' | 'HEART';
  message: string;
  status: 'UNCLAIMED' | 'CLAIMED' | 'CANCELLED';
  created_at: string;
  claimed_at?: string | null;
  cancelled_at?: string | null;
}

export interface GiftContact {
  email: string;
  nickname: string;
  userId?: string;
  relation: string;
}


/**
 * 1. 현재 크레딧 잔액 조회
 * @param userId UUID (Hub family_uid)
 */
export async function getBalance(userId: string): Promise<{ success: boolean; balance?: number; error?: string }> {
  try {
    const { ok, data } = await hubFetch<any>(`/api/wallet/balance?userId=${encodeURIComponent(userId)}`);
    if (!ok) return { success: false, error: data?.message || '잔액 조회 실패' };
    return { success: true, balance: data.balance };
  } catch (err) {
    console.error('[MerlinHub] getBalance error:', err);
    return { success: false, error: '허브 서버 연결 실패' };
  }
}

/**
 * 2. 과금 단가표 조회 (Pricing Info)
 * @param videoId 영상 ID (resource_id)
 */
export async function getPricing(videoId: string): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const config = getConfig();
    const appId = config.appId;
    if (!appId) {
      return { success: false, error: 'App ID가 설정되지 않았습니다. configureMerlinHub({ appId: "..." })를 호출해 주세요.' };
    }
    const { ok, data } = await hubFetch<any>(`/api/wallet/pricing?app_id=${appId}&action_type=ANALYSIS&resource_id=${videoId}`);
    if (!ok) return { success: false, error: data?.message || '단가 조회 실패' };
    return { success: true, data: data.data };
  } catch (err) {
    console.error('[MerlinHub] getPricing error:', err);
    return { success: false, error: '허브 서버 연결 실패' };
  }
}

/**
 * 3. 통합 트랜잭션 처리 (고정가 차감)
 */
export async function processTransaction(params: {
  userId: string;
  amount: number;
  requestId: string;
  displayText: string;
  usageMetadata?: any;
  skipReceiptEmail?: boolean;
}): Promise<{ success: boolean; balance?: number; error?: string }> {
  try {
    const appId = getConfig().appId;
    if (!appId) {
      return { success: false, error: 'App ID가 설정되지 않았습니다. configureMerlinHub({ appId: "..." })를 호출해 주세요.' };
    }
    const { ok, data } = await hubFetch<any>('/api/wallet/transaction', {
      method: 'POST',
      body: JSON.stringify({
        userId: params.userId,
        amount: params.amount,
        request_id: params.requestId,
        transaction_type: params.amount < 0 ? 'SPEND' : 'CHARGE',
        display_text: params.displayText,
        app_id: appId,
        usage_metadata: params.usageMetadata,
        skip_receipt_email: params.skipReceiptEmail
      }),
    });
    if (!ok) return { success: false, error: data?.message || '트랜잭션 처리 실패' };
    return { success: true, balance: data.balance };
  } catch (err) {
    console.error('[MerlinHub] processTransaction error:', err);
    return { success: false, error: '허브 서버 연결 실패' };
  }
}

/**
 * 4. 동적/정액 과금 계산 및 청구 (신규 영상 분석 시)
 */
export async function chargeDynamic(params: {
  userId: string;
  videoId: string;
  actionType?: 'ANALYSIS' | 'REANALYSIS_OWNER' | string;
  rawCost?: number;
  usageMetrics?: {
    gpt4oMiniTokens?: number;
    gemini25FlashTokens?: number;
    googleSearchCount?: number;
    speedTokens?: number; // 하위 호환
    fullTokens?: number;  // 하위 호환
    [key: string]: any;
  };
  requestId: string;
  displayText: string;
  usageMetadata?: any;
  skipReceiptEmail?: boolean;
}): Promise<{ success: boolean; balance?: number; error?: string; price?: number }> {
  try {
    const appId = getConfig().appId;
    if (!appId) {
      return { success: false, error: 'App ID가 설정되지 않았습니다. configureMerlinHub({ appId: "..." })를 호출해 주세요.' };
    }
    const { ok, data } = await hubFetch<any>('/api/wallet/transaction/dynamic', {
      method: 'POST',
      body: JSON.stringify({
        userId: params.userId,
        app_id: appId,
        resource_id: params.videoId,
        action_type: params.actionType,
        raw_cost: params.rawCost,
        usage_metrics: params.usageMetrics ? {
          gpt_4o_mini_tokens: params.usageMetrics.gpt4oMiniTokens || params.usageMetrics.speedTokens,
          gemini_2_5_flash_tokens: params.usageMetrics.gemini25FlashTokens || params.usageMetrics.fullTokens,
          google_search_count: params.usageMetrics.googleSearchCount
        } : undefined,
        request_id: params.requestId,
        display_text: params.displayText,
        usage_metadata: params.usageMetadata,
        skip_receipt_email: params.skipReceiptEmail
      }),
    });
    if (!ok) return { success: false, error: data?.message || '과금 처리 실패' };
    return { success: true, balance: data.balance, price: data.price };
  } catch (err) {
    console.error('[MerlinHub] chargeDynamic error:', err);
    return { success: false, error: '허브 서버 연결 실패' };
  }
}

/**
 * 4-1. 정액 분석/재분석 요금 청구 (어그로필터 50C, 채널소유자 재분석 1000C, 노스트라 등)
 */
export async function deductFlatAnalysis(params: {
  userId: string;
  videoId: string;
  actionType?: 'ANALYSIS' | 'REANALYSIS_OWNER' | string;
  requestId: string;
  displayText?: string;
  usageMetadata?: any;
  skipReceiptEmail?: boolean;
}): Promise<{ success: boolean; balance?: number; error?: string; price?: number }> {
  const isOwner = params.actionType === 'REANALYSIS_OWNER';
  const defaultText = isOwner 
    ? '채널 영상 소유자 재분석 의뢰 (1,000C)' 
    : '영상 어그로 분석 (50C, 당일 전체 광고 제거)';

  return chargeDynamic({
    userId: params.userId,
    videoId: params.videoId,
    actionType: params.actionType || 'ANALYSIS',
    requestId: params.requestId,
    displayText: params.displayText || defaultText,
    usageMetadata: params.usageMetadata,
    skipReceiptEmail: params.skipReceiptEmail
  });
}

/**
 * 5. 이용 내역 조회 (History)
 */
export async function getHistory(userId: string, page: number = 1): Promise<{ 
  success: boolean; 
  history?: any[]; 
  total?: number; 
  totalPages?: number; 
  error?: string;
}> {
  try {
    const { ok, data } = await hubFetch<any>(`/api/wallet/history?userId=${encodeURIComponent(userId)}&page=${page}`);
    if (!ok) return { success: false, error: data?.message || '내역 조회 실패' };
    return { 
      success: true, 
      history: data.history, 
      total: data.total, 
      totalPages: data.totalPages 
    };
  } catch (err) {
    console.error('[MerlinHub] getHistory error:', err);
    return { success: false, error: '허브 서버 연결 실패' };
  }
}

/**
 * KCP 결제 준비 요청
 */
export async function requestKcpPayment(params: {
  amount: number;
  coinAmount: number;
  payMethodType: 'card' | 'phone' | 'bank';
  returnUrl: string;
  productName?: string;
}): Promise<{ success: boolean; paymentData?: any; error?: string }> {
  try {
    const config = getConfig();
    const appId = config.appId;
    if (!appId) {
      return { success: false, error: 'App ID가 설정되지 않았습니다. configureMerlinHub({ appId: "..." })를 호출해 주세요.' };
    }
    const { ok, data } = await hubFetch<any>('/api/payment/prepare', {
      method: 'POST',
      body: JSON.stringify({
        amount: params.amount,
        coin_amount: params.coinAmount,
        pay_method_type: params.payMethodType,
        app_id: appId,
        return_url: params.returnUrl,
        product_name: params.productName
      }),
    });
    if (!ok) return { success: false, error: data?.message || '결제 준비 실패' };
    return { success: true, paymentData: data.payment_data };
  } catch (err) {
    console.error('[MerlinHub] requestKcpPayment error:', err);
    return { success: false, error: '허브 서버 연결 실패' };
  }
}

/**
 * 6. 크레딧 사용 (고급 래퍼)
 */
export async function useCredit(params: {
  amount: number;
  displayText: string;
  requestId: string;
  skipReceiptEmail?: boolean;
}) {
  const userId = getUserId();
  if (!userId) return { success: false, error: '로그인이 필요합니다.' };

  return processTransaction({
    userId,
    amount: -Math.abs(params.amount),
    requestId: params.requestId,
    displayText: params.displayText,
    skipReceiptEmail: params.skipReceiptEmail
  });
}

/**
 * 7. 현재 로컬 스토리지에서 유저 ID 추출
 */
export function getUserId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('merlin_user_id') || localStorage.getItem('merlin_family_uid');
}

/**
 * 8. 선물함 목록 및 교류 지인 조회 (받은 선물 / 보낸 선물 / 원클릭 지인)
 */
export async function getGiftList(): Promise<{
  success: boolean;
  received?: GiftItem[];
  sent?: GiftItem[];
  contacts?: GiftContact[];
  unclaimedCount?: number;
  error?: string;
}> {
  try {
    const userId = getUserId();
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    const { ok, data } = await hubFetch<any>(`/api/wallet/gift/list${query}`);
    if (!ok || !data?.success) {
      return { success: false, error: data?.message || '선물함 조회 실패' };
    }
    return {
      success: true,
      received: data.received || [],
      sent: data.sent || [],
      contacts: data.contacts || [],
      unclaimedCount: data.unclaimedCount || 0,
    };
  } catch (err) {
    console.error('[MerlinHub] getGiftList error:', err);
    return { success: false, error: '허브 서버 연결 실패' };
  }
}

/**
 * 8-1. 선물 수신자 실시간 별명/이메일 자동완성 검색
 */
export async function searchGiftUsers(query: string): Promise<{
  success: boolean;
  users?: GiftContact[];
  error?: string;
}> {
  try {
    const q = (query || '').trim();
    if (!q) return { success: true, users: [] };
    const userId = getUserId();
    const userParam = userId ? `&userId=${encodeURIComponent(userId)}` : '';
    const { ok, data } = await hubFetch<any>(`/api/wallet/gift/search-users?q=${encodeURIComponent(q)}${userParam}`);
    if (!ok || !data?.success) {
      return { success: false, users: [], error: data?.message || '회원 검색 실패' };
    }
    return {
      success: true,
      users: data.users || [],
    };
  } catch (err) {
    console.error('[MerlinHub] searchGiftUsers error:', err);
    return { success: false, users: [], error: '허브 서버 연결 실패' };
  }
}

/**
 * 9. 선물 보내기 (앱 내 상품 선물 또는 코인 선물)
 */
export async function sendGift(params: {
  receiverEmail: string;
  receiverId?: string;
  receiverName?: string;
  giftTitle: string;
  giftCategory: 'APP_ITEM' | 'COIN';
  amount: number;
  appId?: string;
  targetAppUrl?: string;
  theme?: 'CONGRATS' | 'THANKS' | 'CHEER' | 'TOGETHER' | 'HEART';
  message?: string;
}): Promise<{
  success: boolean;
  giftId?: string;
  balance?: number;
  gift?: GiftItem;
  error?: string;
}> {
  try {
    const config = getConfig();
    const userId = getUserId();
    const { ok, data } = await hubFetch<any>('/api/wallet/gift/send', {
      method: 'POST',
      body: JSON.stringify({
        userId,
        receiverEmail: params.receiverEmail,
        receiverId: params.receiverId,
        receiverName: params.receiverName,
        giftTitle: params.giftTitle,
        giftCategory: params.giftCategory,
        amount: params.amount,
        appId: params.appId || config.appId || 'HUB',
        targetAppUrl: params.targetAppUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://aggro.sundreamer.app'),
        theme: params.theme || 'CHEER',
        message: params.message || '',
      }),
    });
    if (!ok || !data?.success) {
      return { success: false, error: data?.message || '선물 발송에 실패했습니다.' };
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('creditsUpdated'));
      window.dispatchEvent(new Event('giftsUpdated'));
    }
    return {
      success: true,
      giftId: data.giftId,
      balance: data.balance,
      gift: data.gift,
    };
  } catch (err) {
    console.error('[MerlinHub] sendGift error:', err);
    return { success: false, error: '허브 서버 연결 실패' };
  }
}

/**
 * 10. 선물 받기 (수락 및 지갑 즉시 적립)
 */
export async function claimGift(giftId: string): Promise<{
  success: boolean;
  balance?: number;
  amount?: number;
  gift?: GiftItem;
  error?: string;
}> {
  try {
    const userId = getUserId();
    const { ok, data } = await hubFetch<any>('/api/wallet/gift/claim', {
      method: 'POST',
      body: JSON.stringify({ userId, giftId }),
    });
    if (!ok || !data?.success) {
      return { success: false, error: data?.message || '선물 수령에 실패했습니다.' };
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('creditsUpdated'));
      window.dispatchEvent(new Event('giftsUpdated'));
    }
    return {
      success: true,
      balance: data.balance,
      amount: data.amount,
      gift: data.gift,
    };
  } catch (err) {
    console.error('[MerlinHub] claimGift error:', err);
    return { success: false, error: '허브 서버 연결 실패' };
  }
}

/**
 * 11. 미수령 선물 발송 취소 및 코인 즉시 환급
 */
export async function cancelGift(giftId: string): Promise<{
  success: boolean;
  balance?: number;
  refundedAmount?: number;
  error?: string;
}> {
  try {
    const userId = getUserId();
    const { ok, data } = await hubFetch<any>('/api/wallet/gift/cancel', {
      method: 'POST',
      body: JSON.stringify({ userId, giftId }),
    });
    if (!ok || !data?.success) {
      return { success: false, error: data?.message || '선물 취소에 실패했습니다.' };
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('creditsUpdated'));
      window.dispatchEvent(new Event('giftsUpdated'));
    }
    return {
      success: true,
      balance: data.balance,
      refundedAmount: data.refundedAmount,
    };
  } catch (err) {
    console.error('[MerlinHub] cancelGift error:', err);
    return { success: false, error: '허브 서버 연결 실패' };
  }
}

/**
 * 12. 미수령 선물 리마인드 알림 재발송
 */
export async function nudgeGift(giftId: string): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const userId = getUserId();
    const { ok, data } = await hubFetch<any>('/api/wallet/gift/nudge', {
      method: 'POST',
      body: JSON.stringify({ userId, giftId }),
    });
    if (!ok || !data?.success) {
      return { success: false, error: data?.message || '리마인드 발송에 실패했습니다.' };
    }
    return {
      success: true,
      message: data.message,
    };
  } catch (err) {
    console.error('[MerlinHub] nudgeGift error:', err);
    return { success: false, error: '허브 서버 연결 실패' };
  }
}

