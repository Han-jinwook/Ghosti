/**
 * Version: v1.5.1
 * Last Updated: 2026-11-17
 * Description: KCP 간편결제 다이렉트 플래그 히든 폼 주입 (네이버페이 naverpay_direct='B' 브릿지 호출로 머니/포인트 및 카드 선택 동시 지원)
 */
import { useState, useCallback, useEffect } from 'react';
import { requestKcpPayment, HubPayMethodType } from './wallet';
import { getConfig } from '../CoreLogic/config';

export type PaymentStatus = 'idle' | 'preparing' | 'pending' | 'success' | 'error';

/**
 * [Core] Hub 결제 기능을 담당하는 커스텀 훅
 * KCP 표준웹 결제창 호출 및 승인 프로세스를 처리합니다.
 */
export function useHubPayment() {
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // 컴포넌트 마운트 시점에 브라우저 환경을 감지하여 KCP 표준결제 SDK 스크립트 사전 로드
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isLocal = window.location.hostname === 'localhost' ||
                    window.location.hostname === '127.0.0.1' ||
                    window.location.hostname.includes('dev') ||
                    window.location.hostname.includes('localhost');

    const targetSrc = isLocal
      ? 'https://testspay.kcp.co.kr/plugin/kcp_spay_hub.js'
      : 'https://spay.kcp.co.kr/plugin/kcp_spay_hub.js';

    const existing = document.getElementById('kcp-payplus-sdk');
    if (!existing) {
      const script = document.createElement('script');
      script.id = 'kcp-payplus-sdk';
      script.src = targetSrc;
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  /**
   * 결제창 호출 실행
   */
  const requestPayment = useCallback(async (params: {
    amount: number;
    coinAmount: number;
    payMethodType: HubPayMethodType;
    returnUrl?: string;
    productName?: string;
  }) => {
    try {
      setStatus('preparing');
      setError(null);

      const config = getConfig();
      const returnUrl = params.returnUrl || window.location.origin;

      // 1. 허브 서버로부터 결제 데이터(Signature 등) 수령
      const res = await requestKcpPayment({
        amount: params.amount,
        coinAmount: params.coinAmount,
        payMethodType: params.payMethodType,
        returnUrl: returnUrl,
        productName: params.productName
      });

      if (!res.success || !res.paymentData) {
        throw new Error(res.error || '결제 준비 중 오류가 발생했습니다.');
      }

      const orderData = res.paymentData;
      const siteCd = orderData.site_cd || '';

      // 2. KCP 표준결제 JS 스크립트 동적 로드 (site_cd에 맞춰 테스트/운영 분기)
      const isTest = siteCd.startsWith('T');
      const targetSrc = isTest 
        ? 'https://testspay.kcp.co.kr/plugin/kcp_spay_hub.js'
        : 'https://spay.kcp.co.kr/plugin/kcp_spay_hub.js';

      await new Promise<void>((resolve, reject) => {
        if (typeof window === 'undefined') {
          resolve();
          return;
        }

        const existing = document.getElementById('kcp-payplus-sdk') as HTMLScriptElement;
        if (existing) {
          if (existing.src === targetSrc) {
            resolve();
            return;
          }
          existing.remove();
        }

        const script = document.createElement('script');
        script.id = 'kcp-payplus-sdk';
        script.src = targetSrc;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('KCP 결제 스크립트 로드에 실패했습니다.'));
        document.head.appendChild(script);
      });

      setStatus('pending');

      // 3. 동적 히든 폼 생성
      const formId = 'merlin_kcp_form_' + Date.now();
      let form = document.getElementById(formId) as HTMLFormElement;
      if (!form) {
        form = document.createElement('form');
        form.id = formId;
        form.method = 'POST';
        form.action = `${config.hubUrl}/api/payment/callback`;
        form.style.display = 'none';
        document.body.appendChild(form);
      } else {
        form.action = `${config.hubUrl}/api/payment/callback`;
      }

      // 폼 필드 채우기
      const fields: Record<string, string> = {
        site_cd: siteCd,
        ordr_idxx: orderData.ordr_idxx || '',
        good_mny: String(orderData.good_mny || ''),
        good_name: orderData.good_name || '',
        buyr_name: orderData.buyr_name || '',
        buyr_mail: orderData.buyr_mail || '',
        site_name: orderData.site_name || '',
        pay_method: orderData.pay_method || '100000000000',
        req_tx: 'pay',
        currency: 'WON',
        param_opt_1: returnUrl,
        Ret_URL: `${config.hubUrl}/api/payment/callback`,
        // KCP 표준웹 인증 완료 시 채워질 숨김 필드 정의
        res_cd: '',
        res_msg: '',
        enc_info: '',
        enc_data: '',
        tran_cd: ''
      };

      // 간편결제 다이렉트 호출 플래그 주입 (서버 응답 또는 클라이언트 선택값 기반)
      // ※ NHN KCP 공식 규격상 네이버페이(naverpay_direct)는 'B'(머니/포인트 결제 + 카드 결제 선택 브릿지)를 사용하며,
      //    타 간편결제(카카오·토스·삼성·애플·페이코)는 'Y'를 사용합니다.
      const directFlags: Array<[HubPayMethodType, string, string]> = [
        ['kakaopay', 'kakaopay_direct', 'Y'],
        ['naverpay', 'naverpay_direct', 'B'],
        ['tosspay', 'tosspay_direct', 'Y'],
        ['sspay', 'sspay_direct', 'Y'],
        ['applepay', 'applepay_direct', 'Y'],
        ['payco', 'payco_direct', 'Y'],
      ];
      for (const [methodKey, fieldName, defaultFlagVal] of directFlags) {
        const serverVal = orderData[fieldName];
        if (serverVal === 'Y' || serverVal === 'B') {
          fields[fieldName] = serverVal;
        } else if (params.payMethodType === methodKey) {
          fields[fieldName] = defaultFlagVal;
        }
      }

      form.innerHTML = '';
      Object.entries(fields).forEach(([name, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
      });

      // 4. 글로벌 인증 완료 콜백 등록 (KCP 표준웹 callback 규격 필수)
      (window as any).m_Completepayment = (FormOrJson: any, closeEvent: any) => {
        try {
          const res_cd = FormOrJson.elements["res_cd"]?.value || "";
          const res_msg = FormOrJson.elements["res_msg"]?.value || "";
          const enc_info = FormOrJson.elements["enc_info"]?.value || "";
          const enc_data = FormOrJson.elements["enc_data"]?.value || "";
          const tran_cd = FormOrJson.elements["tran_cd"]?.value || "";

          const formElement = document.getElementById(formId) as HTMLFormElement;
          if (formElement) {
            const setVal = (name: string, val: string) => {
              let input = formElement.querySelector(`input[name="${name}"]`) as HTMLInputElement;
              if (!input) {
                input = document.createElement('input');
                input.type = 'hidden';
                input.name = name;
                formElement.appendChild(input);
              }
              input.value = val;
            };

            setVal("res_cd", res_cd);
            setVal("res_msg", res_msg);
            setVal("enc_info", enc_info);
            setVal("enc_data", enc_data);
            setVal("tran_cd", tran_cd);

            if (res_cd === "0000") {
              formElement.submit();
            } else {
              if (closeEvent) closeEvent();
              setError(`[${res_cd}] ${res_msg}`);
              setStatus('error');
            }
          }
        } catch (e: any) {
          console.error('[KCP Callback Error]', e);
          if (closeEvent) closeEvent();
          setError(e.message);
          setStatus('error');
        }
      };

      // 5. KCP 표준웹 결제창 실행 (내부 비동기 서브 스크립트 로드 완료 대기 루프)
      let attempts = 0;
      const maxAttempts = 60; // 최대 3초 대기 (50ms * 60)
      
      const checkAndExecute = () => {
        const kcpExecute = (window as any).KCP_Pay_Execute_Web;
        if (typeof kcpExecute === 'function') {
          try {
            kcpExecute(form);
          } catch (e: any) {
            const isInitError = e instanceof TypeError || 
                                e instanceof ReferenceError || 
                                (e && e.message && (
                                  e.message.includes('undefined') || 
                                  e.message.includes('not defined') || 
                                  e.message.includes('null') || 
                                  e.message.includes('jQuery') || 
                                  e.message.includes('$')
                                ));

            if (isInitError && attempts < maxAttempts) {
              attempts++;
              console.warn(`[KCP Execute] 의존성 미로드 오류 발생으로 재시도 중 (${attempts}/${maxAttempts}):`, e);
              setTimeout(checkAndExecute, 50);
            } else {
              console.log('[KCP Execute] 결제 모듈 실행 함수 호출됨 (KCP 내부 예외 발생 가능하나 정상 흐름):', e);
            }
          }
        } else {
          if (attempts < maxAttempts) {
            attempts++;
            setTimeout(checkAndExecute, 50);
          } else {
            console.error('[KCP Execute Error] KCP_Pay_Execute_Web 함수를 찾을 수 없습니다.');
            setError('KCP 결제 모듈 실행에 실패했습니다. 페이지를 새로고침 후 다시 시도해주세요.');
            setStatus('error');
          }
        }
      };

      setTimeout(checkAndExecute, 50);

      return true;
    } catch (err: any) {
      setStatus('error');
      setError(err.message);
      return false;
    }
  }, []);

  /**
   * 코인 잔액 조회
   */
  const getBalance = useCallback(async () => {
    const { getProfile } = await import('../Auth/auth');
    try {
      const profile = await getProfile();
      return profile?.credits || 0;
    } catch (err) {
      console.error('잔액 조회 실패:', err);
      return 0;
    }
  }, []);

  return {
    status,
    error,
    requestPayment,
    getBalance,
    isReady: true
  };
}
