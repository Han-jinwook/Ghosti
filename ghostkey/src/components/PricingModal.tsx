import React from 'react';
import { X, Check, Crown, Sparkles, Zap } from 'lucide-react';
import { useSaySeeStore } from '../store/useSaySeeStore';
import { useIsCoinHiddenInStore } from './GhostiHubInfraBridge';
import { GHOSTKEY_COPY, type GhostKeyLang } from '../services/ghostKeyI18n';
import type { GhostKeyPricingPlanId as PricingPlanId } from '../services/subscriptionPlanCatalog';

const GhostKeyPricingContent: React.FC<{
  lang: GhostKeyLang;
  isModal?: boolean;
  onCloseModal?: () => void;
}> = ({ lang, isModal = false, onCloseModal }) => {
  const copy = GHOSTKEY_COPY[lang];
  const {
    openSubscriptionCheckout,
    deviceEntitlement,
    activePricingPlan,
    themeMode,
  } = useSaySeeStore();

  const isLight = themeMode === 'light';
  const currentPlanId = deviceEntitlement?.planId || activePricingPlan;
  const isProMember = Boolean(
    deviceEntitlement?.isPaidUnlimited &&
      (currentPlanId === 'personal_sub_3900' ||
        currentPlanId === 'personal_year_39000' ||
        currentPlanId === 'personal_year_35000')
  );
  const isGhostKeyPaid = Boolean(
    deviceEntitlement?.isPaidUnlimited &&
      (currentPlanId === 'ghostkey_sub_1900' || currentPlanId === 'ghostkey_year_19000')
  );

  const handleSelectPlan = (planId: PricingPlanId) => {
    openSubscriptionCheckout(planId);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/15 border border-teal-500/35 text-teal-700 text-xs font-extrabold mb-2">
            <Zap className="w-3.5 h-3.5" />
            <span>귀신Key (GhostKey) · 30일 무카드 풀파워 체험 후 선택</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">
            {lang === 'en'
              ? 'Pricing & Plan Comparison'
              : lang === 'ja'
              ? '料金プランのご案内'
              : '이용권 및 요금 안내'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {copy.noCardNote} · 본체 『귀신같이 Pro(월 3,900원)』 구독 중이면 추가 결제 없이 귀신Key가 자동 활성화됩니다.
          </p>
        </div>
        {isModal && onCloseModal && (
          <button
            type="button"
            onClick={onCloseModal}
            className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 cursor-pointer shrink-0"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {(isProMember || isGhostKeyPaid) && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-700 text-xs sm:text-sm font-bold flex items-center gap-2">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>
            {isProMember
              ? '현재 『귀신같이 Pro』 통합 회원입니다! 귀신Key 전 기능이 무상으로 이미 활성화되어 있습니다.'
              : '현재 『귀신Key (GhostKey)』 유료 이용권이 활성화되어 있습니다.'}
          </span>
        </div>
      )}

      {/* 요금제 선택 카드 2종 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 귀신Key 단독 (월 1,900원 / 연 19,000원) */}
        <div
          className={`rounded-2xl border-2 p-5 flex flex-col justify-between gap-4 ${
            isLight
              ? 'bg-teal-50/50 border-teal-500/70'
              : 'bg-teal-950/25 border-teal-400/60'
          }`}
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full bg-teal-500 text-zinc-950 text-[11px] font-black">
                귀신Key 단독 · 실무 추천
              </span>
              <span className="text-[11px] font-bold text-teal-700">
                30일 무료체험 포함
              </span>
            </div>
            <h3 className="text-lg font-black">귀신Key (GhostKey)</h3>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-teal-700">
                {copy.priceMonthly}
              </span>
              <span className="text-xs text-slate-500">
                / {lang === 'ko' ? `월 (연 ${copy.priceYearly})` : lang === 'ja' ? `月 (年 ${copy.priceYearly})` : `mo (${copy.priceYearly}/yr)`}
              </span>
            </div>
            <ul className="mt-4 space-y-2 text-xs sm:text-[13px] text-slate-700">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-teal-500 shrink-0 mt-0.5" />
                <span>Ctrl+0 / Ctrl+우클릭 어디서나 즉시 소환</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-teal-500 shrink-0 mt-0.5" />
                <span>한영 오타 성형 · 줄바꿈/서식 세탁 · 순차복사 발사</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-teal-500 shrink-0 mt-0.5" />
                <span>7일 클립보드 검색 · F1~F6 상용구 · 300DPI PDF · 창고정</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-teal-500 shrink-0 mt-0.5" />
                <span>31일째 미결제 시 본체 무료 기능 무영향 (귀신Key만 조용히 OFF)</span>
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => handleSelectPlan('ghostkey_sub_1900')}
              className="w-full py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black text-sm cursor-pointer transition"
            >
              월 1,900원 시작하기
            </button>
            <button
              type="button"
              onClick={() => handleSelectPlan('ghostkey_year_19000')}
              className="w-full py-2 px-4 rounded-xl border border-teal-600/40 text-teal-700 hover:bg-teal-500/10 font-bold text-xs cursor-pointer transition"
            >
              연간 19,000원 (2개월 무료) 선택
            </button>
          </div>
        </div>

        {/* 내 기기 통합 Pro (월 3,900원 / 귀신Key 무상 포함) */}
        <div
          className={`rounded-2xl border p-5 flex flex-col justify-between gap-4 ${
            isLight
              ? 'bg-slate-50 border-slate-200'
              : 'bg-zinc-900/70 border-white/10'
          }`}
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/50 text-amber-700 text-[11px] font-black inline-flex items-center gap-1">
                <Crown className="w-3 h-3" />
                <span>본체 통합 Pro</span>
              </span>
              <span className="text-[11px] font-bold text-slate-500">
                귀신Key 무상 합체
              </span>
            </div>
            <h3 className="text-lg font-black">귀신같이 Pro (내 기기 통합)</h3>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-3xl font-black">{copy.proPriceMonthly}</span>
              <span className="text-xs text-slate-500">
                / {lang === 'ko' ? `월 (연 ${copy.proPriceYearly})` : lang === 'ja' ? `月 (年 ${copy.proPriceYearly})` : `mo (${copy.proPriceYearly}/yr)`}
              </span>
            </div>
            <ul className="mt-4 space-y-2 text-xs sm:text-[13px] text-slate-700">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span><strong>귀신Key(월 1,900원) 전 기능 무상 포함</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span><strong>사진·표 OCR → 엑셀(TSV)</strong> 및 귀신 라벨러 단독 해금</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span>폰↔PC 양방향 클립보드(E2EE · 7일) + 내 상용구(F1~F6) 내 모든 PC 동기화</span>
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => handleSelectPlan('personal_sub_3900')}
              className="w-full py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black text-sm cursor-pointer transition"
            >
              Pro 월 3,900원으로 합체하기
            </button>
            <button
              type="button"
              onClick={() => handleSelectPlan('personal_year_39000')}
              className="w-full py-2 px-4 rounded-xl border border-slate-300 hover:bg-black/5 font-bold text-xs cursor-pointer transition"
            >
              연간 39,000원 (2개월 무료) 선택
            </button>
          </div>
        </div>
      </div>

      {/* 기존 단독 유료 앱 대비 비교표 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="mb-3">
          <h3 className="text-sm sm:text-base font-black tracking-tight">
            {lang === 'en'
              ? 'Feature & Cost Comparison'
              : lang === 'ja'
              ? '既存有料アプリとの比較'
              : '기존 단독 유료 앱 대비 비교'}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3 font-bold">
                  {lang === 'en' ? 'Category' : lang === 'ja' ? '機能カテゴリ' : '기능 영역'}
                </th>
                <th className="py-2 px-3 font-bold">
                  {lang === 'en' ? 'Typical Standalone Apps' : lang === 'ja' ? '代表的な単独有料アプリ' : '기존 단독 유료 앱 (참고)'}
                </th>
                <th className="py-2 pl-3 font-black text-teal-600 text-right">
                  GhostKey
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70">
              <tr>
                <td className="py-2.5 pr-3 font-bold">
                  {lang === 'en' ? 'Clipboard History & Search' : lang === 'ja' ? 'クリップボード履歴・検索' : '클립보드 보관 · 검색'}
                </td>
                <td className="py-2.5 px-3 text-slate-600">
                  {lang === 'en' ? 'Paste, etc. (~$3.99/mo)' : lang === 'ja' ? 'Paste 等（約¥600/月）' : 'Paste 등 (약 월 5,000원)'}
                </td>
                <td className="py-2.5 pl-3 text-right font-extrabold text-emerald-600">✓</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-3 font-bold">
                  {lang === 'en' ? 'Text Snippets (F1–F6)' : lang === 'ja' ? '定型文ショートカット' : '단축 상용구 자동 입력'}
                </td>
                <td className="py-2.5 px-3 text-slate-600">
                  {lang === 'en' ? 'TextExpander, etc. (~$4.16/mo)' : lang === 'ja' ? 'TextExpander 等（約¥620/月）' : 'TextExpander 등 (약 월 5,500원)'}
                </td>
                <td className="py-2.5 pl-3 text-right font-extrabold text-emerald-600">✓</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-3 font-bold">
                  {lang === 'en' ? 'Screen Capture & Table OCR (Pro)' : lang === 'ja' ? '画面キャプチャ · 表OCR (Pro)' : '화면 캡처 · 표 OCR → 엑셀 (Pro)'}
                </td>
                <td className="py-2.5 px-3 text-slate-600">
                  {lang === 'en' ? 'Snagit, etc. (~$39–63/yr)' : lang === 'ja' ? 'Snagit 等（約¥600〜1,000/月）' : 'Snagit 등 (약 월 5,000~8,000원)'}
                </td>
                <td className="py-2.5 pl-3 text-right font-extrabold text-amber-600">
                  {lang === 'en' ? 'Pro ($3.99)' : lang === 'ja' ? 'Pro (¥590)' : '통합 Pro (3,900원)'}
                </td>
              </tr>
              <tr>
                <td className="py-2.5 pr-3 font-bold">
                  {lang === 'en' ? 'CapsLock Fix · Seq Paste · PDF Iron' : lang === 'ja' ? '全角半角 · 連続貼付 · PDF改行整形' : '한영 오타 교정 · 순차복사 · PDF 줄바꿈 정리'}
                </td>
                <td className="py-2.5 px-3 text-slate-600">
                  {lang === 'en' ? 'Requires separate scripts/tools' : lang === 'ja' ? '個別スクリプト・別ツール併用' : '별도 프로그램 조합 필요'}
                </td>
                <td className="py-2.5 pl-3 text-right font-extrabold text-emerald-600">✓</td>
              </tr>
              <tr className="bg-teal-50/60">
                <td className="py-3 pr-3 font-black">
                  {lang === 'en' ? 'Monthly Total' : lang === 'ja' ? '月額合計' : '월 이용 요금'}
                </td>
                <td className="py-3 px-3 font-bold text-slate-500 line-through">
                  {lang === 'en' ? '$13+ / mo' : lang === 'ja' ? '月 ¥1,800 以上' : '개별 구독 시 월 15,000원 이상'}
                </td>
                <td className="py-3 pl-3 text-right font-black text-teal-700">
                  {copy.priceMonthly} / {lang === 'en' ? 'mo' : lang === 'ja' ? '月' : '월'} ({lang === 'en' ? 'yr' : lang === 'ja' ? '年' : '연'} {copy.priceYearly})
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 하단 1줄 확장 안내: 팀 공유(업무 공유 S: 드라이브 · F7~F12 팀 상용구) */}
      <div className="rounded-2xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs bg-slate-50 border-slate-200 text-slate-700">
        <div>
          <strong>직원들과 팀 공유 상용구(F7~F12) · 공용 폴더(S:)가 필요하신가요?</strong>{' '}
          <span>대표 1인 월 9,900원~ (팀원 전원 무료)</span>
        </div>
        <a
          href="https://ghosti.sundreamer.app/?from=b2b"
          target="_blank"
          rel="noopener noreferrer"
          className="font-black text-teal-700 hover:underline shrink-0"
        >
          귀신같이 업무공유 보기 ↗
        </a>
      </div>
    </div>
  );
};

export const GhostKeyPricingView: React.FC<{ lang?: GhostKeyLang }> = ({ lang = 'ko' }) => {
  const hideCoin = useIsCoinHiddenInStore();
  if (hideCoin) return null;

  return (
    <div className="pb-12">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7">
        <GhostKeyPricingContent lang={lang} />
      </section>
    </div>
  );
};

export const PricingModal: React.FC<{ lang?: GhostKeyLang }> = ({ lang = 'ko' }) => {
  const hideCoin = useIsCoinHiddenInStore();
  const { showProModal, setShowProModal } = useSaySeeStore();

  if (hideCoin || !showProModal) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[135] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-5 overflow-y-auto"
      onClick={() => setShowProModal(false)}
    >
      <div
        className="relative w-full max-w-3xl rounded-3xl border border-slate-200 bg-white text-slate-900 p-5 sm:p-7 shadow-2xl my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <GhostKeyPricingContent lang={lang} isModal onCloseModal={() => setShowProModal(false)} />
      </div>
    </div>
  );
};
