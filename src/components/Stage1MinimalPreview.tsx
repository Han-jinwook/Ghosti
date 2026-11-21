import React, { useEffect, useMemo, useState } from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';
import type { LocalDocumentFile, PhotoItem, TrashCategory, VideoSceneItem } from '../types/saysee';
import {
  cleanVideoTimestampLabel,
  groupBurstSearchResults,
  resolveSmartKoreanLabelForPhoto,
  resolveVideoCardThumbUrl,
  stripCollisionKeySuffix,
} from '../services/aiEngine';
import { executeRealOsAction } from '../services/setupMonsterEngine';
import {
  buildDocPreviewSnippet,
  formatVideoCardOcrSummary,
  renderHighlightedDocText,
  resolveDocExtBadge,
  maskSensitiveDocText,
  formatQuickKoreanLabelForFile,
} from './PricingModal';
import {
  getZCoreUrl,
  requestConnectMyComputer,
  zCoreBridge,
  isZCoreOutdated,
  LATEST_Z_CORE_VERSION,
  Z_CORE_ZIP_URL,
} from '../services/zCoreBridge';
import { SilentIndexingStatusBar } from './SilentIndexingStatusBar';
import {
  isCapacitorIosRuntime,
  isCapacitorNativeMobileRuntime,
  openNativeAppPermissionSettings,
} from '../services/ghostiMobileCareBridge';
import { VoiceActorControlPill } from './VoiceActorControlPill';
import { isMobileVoiceEnvironment, unlockMobileAudioOnUserGesture } from '../services/setupMonsterTts';
import {
  SEARCH_STAGE_PC_ROLLING_PLACEHOLDERS_10,
  SEARCH_STAGE_MOBILE_ROLLING_PLACEHOLDERS_10,
  getAndAdvanceSessionPlaceholderStartIndex,
} from '../services/weeklyCareAndPlaceholderEngine';
import { MonsterStandardChatColumn } from './MonsterStandardChatColumn';
import { PassportRegistrationPanel } from './PassportRegistrationPanel';
import { GhostPhotoOcrTeleportModal } from './GhostWindowThreeStageMockup';
import { GhostSecretaryFirstGuard, jumpToGhostSecretary } from './GhostSecretaryFirstGuard';

const STAGE1_ROLLING_INTERVAL_MS = 10_000; // 10초 자동 롤링

interface Stage1SamplePcProgram {
  id: string;
  name: string;
  memMb: number;
  neededForBank: boolean;
}

const STAGE1_SAMPLE_PC_PROGRAMS: Stage1SamplePcProgram[] = [
  { id: 'kb1', name: '○○은행 키보드 보안', memMb: 210, neededForBank: true },
  { id: 'cert', name: '공동인증서 실행 플러그인', memMb: 240, neededForBank: true },
  { id: 'kb2', name: '△△은행 키보드 보안', memMb: 180, neededForBank: false },
  { id: 'pay', name: '쇼핑몰 결제 보안 모듈', memMb: 150, neededForBank: false },
  { id: 'fw', name: '개인 방화벽 에이전트', memMb: 190, neededForBank: false },
  { id: 'term', name: '접속 단말 정보 수집기', memMb: 130, neededForBank: false },
  { id: 'sign', name: '전자서명 실행기', memMb: 160, neededForBank: false },
  { id: 'upd', name: '금융 보안 업데이트 도우미', memMb: 120, neededForBank: false },
];
const STAGE1_SAMPLE_PC_BASE_PCT = 61;
const STAGE1_SAMPLE_PC_REVIVED_PCT = 93;

const SecretarySamplePcCarePanel: React.FC = () => {
  const [speedStep, setSpeedStep] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [sleptCount, setSleptCount] = useState<number>(0);
  const sleepTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
    };
  }, []);

  const emitChatStep = (text: string) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ghosti_sample_pc_step_chat', { detail: { text } }));
    }
  };

  const runSpeedDiagnose = () => {
    if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
    setSleptCount(0);
    setSpeedStep(1);
    emitChatStep(
      '🔍 1초 진단 완료! 은행·결제 보안프로그램 8개가 뒤에서 돌아가며 원래 속도의 61%만 쓰고 있어요. 이제 [💤 안 지우고 재우기]를 눌러볼까요? 👻'
    );
  };

  const runSpeedSleep = () => {
    if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
    setSpeedStep(2);
    setSleptCount(0);
    let n = 0;
    sleepTimerRef.current = setInterval(() => {
      n += 1;
      setSleptCount(n);
      if (n >= STAGE1_SAMPLE_PC_PROGRAMS.length && sleepTimerRef.current) {
        clearInterval(sleepTimerRef.current);
        sleepTimerRef.current = null;
      }
    }, 140);
    emitChatStep(
      '💤 프로그램은 하나도 안 지우고 8개 모두 잠만 재웠더니 속도가 61% → 93%로 살아났어요! 이제 [🏦 은행 사이트 열어보기]를 눌러보세요~ ✨'
    );
  };

  const runSpeedBankOpen = () => {
    if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
    setSleptCount(STAGE1_SAMPLE_PC_PROGRAMS.length);
    setSpeedStep(3);
    emitChatStep(
      '🏦 은행 사이트를 열면 은행 업무에 꼭 필요한 2개만 ⚡1초 만에 깨어나고(속도 85%), 나머지 6개는 계속 쿨쿨 자고 있어요! 마지막으로 [↩️ 전부 원래대로]를 눌러보세요!'
    );
  };

  const runSpeedRestore = () => {
    if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
    setSleptCount(0);
    setSpeedStep(4);
    emitChatStep(
      '↩️ 61% 처음 상태로 1초 만에 완벽 복구됐어요! 지운 프로그램 0개 · 언제든 1초 원상복구되니 안심하고 쓰실 수 있어요~ 👻💚'
    );
  };

  const total = STAGE1_SAMPLE_PC_PROGRAMS.length;
  const neededCount = STAGE1_SAMPLE_PC_PROGRAMS.filter((p) => p.neededForBank).length;
  const totalMemGb = (STAGE1_SAMPLE_PC_PROGRAMS.reduce((s, p) => s + p.memMb, 0) / 1024).toFixed(1);
  const isAsleep = (p: Stage1SamplePcProgram, idx: number) => {
    if (speedStep === 2) return idx < sleptCount;
    if (speedStep === 3) return !p.neededForBank;
    return false;
  };
  const sleepingNow = STAGE1_SAMPLE_PC_PROGRAMS.filter((p, i) => isAsleep(p, i)).length;
  const gaugePct =
    speedStep === 0
      ? null
      : Math.round(
          STAGE1_SAMPLE_PC_BASE_PCT +
            ((STAGE1_SAMPLE_PC_REVIVED_PCT - STAGE1_SAMPLE_PC_BASE_PCT) * sleepingNow) / total
        );
  const deletedCount = 0;
  const stepMsg =
    speedStep === 0
      ? '👇 먼저 [🔍 1초 진단]을 눌러 은행·결제 보안앱이 얼마나 속도를 늦추는지 체험해 보세요!'
      : speedStep === 1
      ? `은행·결제 때 한 번 쓰고 마는 보안앱 ${total}개가 늘 켜져서 메모리 ${totalMemGb}GB를 차지하고 있어요. 지우지 말고 잠만 재워볼까요?`
      : speedStep === 2
      ? sleptCount < total
        ? '💤 하나씩 재우는 중… 프로그램은 지우지 않고 잠만 재워요.'
        : `💤 ${total}개 모두 재웠어요! 지운 건 0개예요. 이제 [🏦 은행 사이트 열어보기]를 눌러볼까요?`
      : speedStep === 3
      ? `🏦 은행 사이트를 열면 꼭 필요한 ${neededCount}개만 1초 만에 저절로 깨어나고, 나머지는 계속 잠들어 있어요!`
      : '↩️ 처음 상태 그대로 1초 만에 되돌렸어요! 언제든 원하는 시점으로 원상복구할 수 있어요.';

  return (
    <div
      data-allow-secretary-jump="true"
      data-keep-dark="true"
      style={{ background: 'linear-gradient(145deg, #07131E 0%, #0B1F2A 100%)' }}
      className="rounded-2xl border border-teal-400/40 p-4 sm:p-5 space-y-3.5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="text-[13.5px] sm:text-[14.5px] font-black text-teal-200 flex items-center gap-2 flex-wrap leading-snug break-keep">
            <span className="whitespace-nowrap">⚡ 느려진 PC 살리기 미리 체험</span>
            <span className="px-2 py-0.5 rounded-full bg-teal-500/20 border border-teal-400/40 text-teal-200 text-[11px] font-extrabold whitespace-nowrap">
              안전 예시 · 내 PC 변경 없음
            </span>
          </div>
          <div className="text-[12px] text-zinc-300 font-semibold break-keep leading-relaxed">
            <span className="whitespace-nowrap">은행·결제 보안앱을 지우지 않고</span>{' '}
            <span className="whitespace-nowrap">잠만 재워 속도를 살리고,</span>{' '}
            <span className="whitespace-nowrap">은행 접속 때만 자동 기상시키는 과정을</span>{' '}
            <span className="whitespace-nowrap">미리 눌러보실 수 있어요.</span>
          </div>
        </div>
        <div className="min-w-[170px] w-full sm:w-auto sm:max-w-[240px] space-y-1">
          <div className="flex items-center justify-between text-xs font-black">
            <span className="text-zinc-300">원래 속도 대비</span>
            <span
              style={{
                color:
                  gaugePct === null ? '#A1A1AA' : gaugePct >= 85 ? '#34D399' : gaugePct >= 75 ? '#FBBF24' : '#F87171',
              }}
            >
              {gaugePct === null ? '진단 전' : `${gaugePct}%`}
            </span>
          </div>
          <div style={{ backgroundColor: 'rgba(255,255,255,0.14)' }} className="h-2.5 rounded-full overflow-hidden">
            <div
              style={{
                width: `${gaugePct ?? 0}%`,
                backgroundColor:
                  gaugePct !== null && gaugePct >= 85
                    ? '#34D399'
                    : gaugePct !== null && gaugePct >= 75
                    ? '#FBBF24'
                    : '#F87171',
              }}
              className="h-full rounded-full transition-all duration-300"
            />
          </div>
        </div>
      </div>

      {speedStep > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {STAGE1_SAMPLE_PC_PROGRAMS.map((p, idx) => {
            const asleep = isAsleep(p, idx);
            const wokeForBank = speedStep === 3 && p.neededForBank;
            return (
              <div
                key={p.id}
                style={{
                  backgroundColor: asleep
                    ? 'rgba(255,255,255,0.03)'
                    : wokeForBank
                    ? 'rgba(0,240,181,0.12)'
                    : 'rgba(248,113,113,0.10)',
                }}
                className={`rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-[13px] border transition-all duration-300 ${
                  asleep ? 'border-white/10 opacity-60' : wokeForBank ? 'border-[#00F0B5]/60' : 'border-rose-400/30'
                }`}
              >
                <span className="font-bold text-zinc-100 truncate">
                  {asleep ? '💤' : wokeForBank ? '⚡' : '🔥'} {p.name}
                </span>
                <span
                  className={`text-xs font-black shrink-0 ${
                    asleep ? 'text-zinc-500' : wokeForBank ? 'text-[#00F0B5]' : 'text-rose-300'
                  }`}
                >
                  {asleep ? '수면 중' : wokeForBank ? '은행용 기상' : `${p.memMb}MB 상주`}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div
        style={{ backgroundColor: 'rgba(13,148,136,0.16)' }}
        className="rounded-xl px-4 py-2.5 text-[13px] text-zinc-100 font-bold leading-relaxed break-keep flex items-start gap-2.5"
      >
        <img src="/gwisinkachi_app_icon_512.png" alt="아기귀신" className="w-6 h-6 rounded-full object-cover shrink-0" />
        <span>{stepMsg}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {[
          { label: '🔍 1초 진단', onClick: runSpeedDiagnose, enabled: true, active: speedStep === 0 || speedStep === 4 },
          { label: '💤 안 지우고 재우기', onClick: runSpeedSleep, enabled: speedStep >= 1, active: speedStep === 1 },
          {
            label: '🏦 은행 사이트 열어보기',
            onClick: runSpeedBankOpen,
            enabled: speedStep >= 2,
            active: speedStep === 2 && sleptCount >= total,
          },
          {
            label: '↩️ 전부 원래대로',
            onClick: runSpeedRestore,
            enabled: speedStep >= 2 && speedStep !== 4,
            active: speedStep === 3,
          },
        ].map((b) => (
          <button
            key={b.label}
            type="button"
            disabled={!b.enabled}
            onClick={b.onClick}
            style={
              !b.enabled
                ? { backgroundColor: 'rgba(255,255,255,0.03)', color: '#52525B' }
                : b.active
                ? { backgroundColor: '#00F0B5', color: '#020617' }
                : { backgroundColor: 'rgba(255,255,255,0.07)', color: '#E4E4E7' }
            }
            className={`px-3.5 py-2 rounded-xl text-[13px] font-black border transition-all ${
              !b.enabled
                ? 'border-white/5 cursor-not-allowed'
                : b.active
                ? 'border-[#00F0B5] shadow-[0_0_14px_rgba(0,240,181,0.35)] cursor-pointer animate-pulse'
                : 'border-white/15 hover:border-teal-400/50 cursor-pointer'
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 text-[11.5px] sm:text-xs font-extrabold">
        <span className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-200 border border-emerald-400/30 break-keep leading-snug">
          🔒 마음대로 지우지 않아요 (삭제 {deletedCount}개)
        </span>
        <span className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-200 border border-emerald-400/30 break-keep leading-snug">
          ✋ 내가 승인한 것만 실행
        </span>
        <span className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-200 border border-emerald-400/30 break-keep leading-snug">
          ↩️ 언제든 1초 원상복구
        </span>
      </div>
    </div>
  );
};

const TRASH_TABS_4: {
  key: 'duplicate' | 'memo' | 'screenshot' | 'blurry';
  stepNum: string;
  title: string;
  shortTitle: string;
  shortBadge: string;
  cleanTag: string;
  subtitle: string;
  icon: string;
}[] = [
  {
    key: 'duplicate',
    stepNum: '①',
    title: '중복·연사 사진',
    shortTitle: '중복·연사 사진',
    shortBadge: '중복·연사 사진',
    cleanTag: '#중복·연사사본',
    subtitle: '원본 1장만 남기고 정리',
    icon: 'burst_mode',
  },
  {
    key: 'memo',
    stepNum: '②',
    title: '주차·영수증·메모',
    shortTitle: '주차·영수증·메모',
    shortBadge: '주차·영수증·메모',
    cleanTag: '#주차·부품·일회성메모',
    subtitle: '주차장·부품·단기 메모',
    icon: 'description',
  },
  {
    key: 'screenshot',
    stepNum: '③',
    title: '스크린샷·캡처',
    shortTitle: '스크린샷·캡처',
    shortBadge: '스크린샷·캡처',
    cleanTag: '#스크린샷 캡처',
    subtitle: '문자·화면 캡처 정리',
    icon: 'screenshot_mobile',
  },
  {
    key: 'blurry',
    stepNum: '④',
    title: '흔들림·오촬영',
    shortTitle: '흔들림·오촬영',
    shortBadge: '흔들림·오촬영',
    cleanTag: '#초점이탈·오촬영',
    subtitle: '흐릿하거나 잘못 찍힌 사진',
    icon: 'blur_on',
  },
];

const FALLBACK_SAMPLE_TRASH_ITEMS: Record<
  'duplicate' | 'memo' | 'screenshot' | 'blurry',
  PhotoItem[]
> = {
  duplicate: [],
  memo: [],
  screenshot: [],
  blurry: [],
};

const fmtMB = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

function matchesTrashTab(photo: PhotoItem, tabKey: string): boolean {
  if (!photo.trashCategory || photo.quarantined) return false;
  if (tabKey === 'all') return true;
  if (tabKey === 'memo') {
    return (
      photo.trashCategory === 'memo' ||
      photo.trashCategory === 'object' ||
      photo.trashCategory === 'document' ||
      photo.trashCategory === 'receipt'
    );
  }
  return photo.trashCategory === tabKey;
}

/**
 * 🧪 1단계 [🎯 찾기] 미니멀 프리뷰 컴포넌트
 * - 기존 상단 검색 구도 + 하단 샘플 사진·영상·문서 바둑판 100% 보존
 * - 1) 검색창 내부 10초 롤링 플레이스홀더 + 포커스/타이핑 시 즉시 정지 + [예시 바로 검색 ↵] 원클릭 체험 버튼
 * - 2) [❐ 동일 연사 묶어보기 ON] 스위치 버튼 삭제 & "전체 사진 목록 · 총 N장" 단순화 (썸네일 클릭 시 상세 모달에서 연사 나란히 비교 보장)
 * - 3) 문서·영상 목록 상단 TMI 설명 배지("실생활 필수 문서 N건 · 별표 가림 없이...") -> "총 N건" 단순화
 */
export const DEMO_SEARCH_SAMPLE_PHOTOS_2: PhotoItem[] = [
  {
    id: 'demo_sample_photo_1',
    name: 'IMG_20250510_1001.jpg',
    size: 1840000,
    date: '2025-05-10',
    mtimeMs: 1746840000000,
    thumbUrl: '/sample_photos_301/IMG_20250510_1001.jpg',
    fullUrl: '/sample_photos_301/IMG_20250510_1001.jpg',
    tags: ['#가족·나들이', '#해변', '#일몰', '#연사베스트컷'],
    captionKo: '[체험 샘플 1/2] 해변 노을 아래 가족이 함께 웃으며 산책하는 기념 사진입니다.',
    captionEn: 'Family walking on the beach at sunset.',
    keywordsKo: ['가족', '해변', '바다', '노을', '산책', '여행'],
  },
  {
    id: 'demo_sample_photo_2',
    name: 'TRV_20250720_1139.jpg',
    size: 2150000,
    date: '2025-07-20',
    mtimeMs: 1752970000000,
    thumbUrl: '/sample_photos_301/TRV_20250720_1139.jpg',
    fullUrl: '/sample_photos_301/TRV_20250720_1139.jpg',
    tags: ['#여름휴가·바다', '#패러세일링', '#코타키나발루'],
    captionKo: '[체험 샘플 2/2] 푸른 바다 위에서 패러세일링 낙하산을 타고 하늘을 나는 여름휴가 사진입니다.',
    captionEn: 'Parasailing over the blue ocean.',
    keywordsKo: ['패러세일링', '바다', '여름휴가', '여행', '하늘', '보트'],
  },
];

export const DEMO_SEARCH_SAMPLE_VIDEOS_2: VideoSceneItem[] = [
  {
    id: 'demo_sample_video_1',
    title: '[체험 샘플 1/2] 코타키나발루 바다 패러세일링 하이라이트.mp4',
    videoFileName: '20240719_105706.mp4',
    keyframePhotoId: '20240719_105706_t12.jpg',
    durationText: '00:18',
    durationSec: 18,
    date: '2025-07-19',
    locationKo: '코타키나발루 해변',
    resolution: '1920x1080',
    sizeMB: 14.2,
    matchedTimestamp: '00:12',
    matchedSeekSec: 12,
    matchedFrameCaption: '모터보트 뒤에서 낙하산을 타고 바다 위로 떠오르는 하이라이트 장면',
    sceneDescription: '푸른 바다 위 패러세일링 액티비티 촬영 영상 (샘플)',
    thumbUrl: '/poc/results/video_frames/20240719_105706_t12.jpg',
    videoUrl: '',
    keywords: ['패러세일링', '바다', '보트', '여행', '하늘'],
    hasScreenOcrText: true,
    ocrLineCount: 2,
    ocrFullText: 'KOTA KINABALU PARASAILING TOUR / 2인 탑승 완료',
    timelineFrames: [
      {
        frameId: 'demo_v1_f1',
        timeSec: 12,
        timestampText: '00:12',
        phaseLabel: '하이라이트',
        sceneCaption: '패러세일링 낙하산 활강 장면',
        keywords: ['패러세일링', '바다', '보트'],
        tags: ['#패러세일링', '#바다'],
        thumbUrl: '/poc/results/video_frames/20240719_105706_t12.jpg',
      },
    ],
  },
  {
    id: 'demo_sample_video_2',
    title: '[체험 샘플 2/2] 팀 주간 회의 화이트보드 매출 목표 브리핑.mp4',
    videoFileName: '20260918_202442.mp4',
    keyframePhotoId: '20260918_202442_t00.jpg',
    durationText: '00:24',
    durationSec: 24,
    date: '2025-09-18',
    locationKo: '본사 대회의실',
    resolution: '1920x1080',
    sizeMB: 18.6,
    matchedTimestamp: '00:08',
    matchedSeekSec: 8,
    matchedFrameCaption: '회의실 화이트보드 판서 및 내년 매출 목표 발표 장면',
    sceneDescription: '회의실 화이트보드 브리핑 녹화 영상 (샘플)',
    thumbUrl: '/poc/results/video_frames/20260918_202442_t00.jpg',
    videoUrl: '',
    keywords: ['회의실', '화이트보드', '매출', '목표', '발표'],
    hasScreenOcrText: true,
    ocrLineCount: 3,
    ocrFullText: '2026 목표 매출 35억 달성 로드맵 / Q4 핵심 과제',
    timelineFrames: [
      {
        frameId: 'demo_v2_f1',
        timeSec: 8,
        timestampText: '00:08',
        phaseLabel: '브리핑',
        sceneCaption: '화이트보드 매출 목표 판서 장면',
        keywords: ['회의실', '화이트보드', '매출'],
        tags: ['#회의실', '#화이트보드'],
        thumbUrl: '/poc/results/video_frames/20260918_202442_t00.jpg',
      },
    ],
  },
];

export const DEMO_SEARCH_SAMPLE_DOCS_2: LocalDocumentFile[] = [
  {
    id: 'demo_sample_doc_1',
    fileName: '2026_표준_사무실임대차계약서_샘플.pdf',
    title: '[체험 샘플 1/2] 2026 표준 사무실 임대차계약서 (보증금·월세 특약)',
    ext: 'PDF',
    categoryBadge: '계약·법무 샘플',
    date: '2025-08-12',
    sizeKB: 420,
    deviceSource: '체험판 샘플 문서',
    extractedText:
      '제3조(보증금 및 월세) 보증금 금 오천만원정(50,000,000원), 월 차임 금 삼백이십만원정(3,200,000원, 매월 25일 지급)으로 한다.',
    keywords: ['계약서', '임대차', '보증금', '월세', '특약'],
  },
  {
    id: 'demo_sample_doc_2',
    fileName: '2026_하반기_거래처_납품단가표_샘플.xlsx',
    title: '[체험 샘플 2/2] 2026 하반기 거래처별 자재 납품단가표',
    ext: 'XLSX',
    categoryBadge: '견적·단가 샘플',
    date: '2025-09-03',
    sizeKB: 185,
    deviceSource: '체험판 샘플 문서',
    extractedText:
      '품목: 고효율 LED 모듈 A형 | 공급단가: 145,000원(VAT 별도) | 최소 발주수량: 50EA | 담당: 한일건재 김대리',
    keywords: ['단가표', '견적서', '납품', '한일건재', '엑셀'],
  },
];

const Stage1IsolatedSearchInputForm: React.FC<{
  initialQuery: string;
  initialized: boolean;
  hasExecutedUserSearch: boolean;
  activeQuery: string;
  searchSpace: 'gallery' | 'video' | 'vault';
  searchPlaceholderPool: readonly string[];
  allowMobileVoice: boolean;
  isListening: boolean;
  clearSignal: number;
  onExecuteQuery: (q: string) => Promise<void>;
  onToggleMic: () => void;
}> = React.memo(
  ({
    initialQuery,
    initialized,
    hasExecutedUserSearch,
    activeQuery,
    searchSpace,
    searchPlaceholderPool,
    allowMobileVoice,
    isListening,
    clearSignal,
    onExecuteQuery,
    onToggleMic,
  }) => {
    const [textInput, setTextInput] = useState(() => {
      if (initialQuery && initialQuery.trim()) return initialQuery.trim();
      if (typeof window !== 'undefined') {
        const qParam = new URLSearchParams(window.location.search).get('q');
        if (qParam && qParam.trim()) return qParam.trim();
      }
      if (
        hasExecutedUserSearch &&
        activeQuery &&
        !activeQuery.startsWith('전체 갤러리 사진') &&
        !activeQuery.startsWith('동영상 ') &&
        !activeQuery.startsWith('최근 서류 ')
      ) {
        return activeQuery;
      }
      return '';
    });
    const [isInputFocused, setIsInputFocused] = useState(false);
    const consumedInitialQueryRef = React.useRef<string>('');
    const lastClearSignalRef = React.useRef<number>(clearSignal);

    useEffect(() => {
      if (clearSignal !== lastClearSignalRef.current) {
        lastClearSignalRef.current = clearSignal;
        setTextInput('');
      }
    }, [clearSignal]);

    useEffect(() => {
      const q = (initialQuery || '').trim();
      if (q && initialized && consumedInitialQueryRef.current !== q) {
        consumedInitialQueryRef.current = q;
        setTextInput(q);
        if (!hasExecutedUserSearch || activeQuery !== q) {
          void onExecuteQuery(q);
        }
        return;
      }
      if (
        !isInputFocused &&
        hasExecutedUserSearch &&
        activeQuery &&
        !activeQuery.startsWith('전체 갤러리 사진') &&
        !activeQuery.startsWith('동영상 ') &&
        !activeQuery.startsWith('최근 서류 ')
      ) {
        setTextInput(activeQuery);
      }
    }, [initialQuery, initialized, hasExecutedUserSearch, activeQuery, isInputFocused, onExecuteQuery]);

    const [rollingSearchIdx, setRollingSearchIdx] = useState<number>(() =>
      getAndAdvanceSessionPlaceholderStartIndex(10)
    );

    useEffect(() => {
      if (isInputFocused || textInput.trim().length > 0) return;
      const timer = window.setInterval(() => {
        setRollingSearchIdx((prev) => (prev + 1) % searchPlaceholderPool.length);
      }, STAGE1_ROLLING_INTERVAL_MS);
      return () => window.clearInterval(timer);
    }, [isInputFocused, textInput, searchPlaceholderPool.length]);

    const currentExampleSentence = useMemo(() => {
      return searchPlaceholderPool[rollingSearchIdx % searchPlaceholderPool.length];
    }, [searchPlaceholderPool, rollingSearchIdx]);

    const handleStepPlaceholder = (delta: -1 | 1) => {
      setRollingSearchIdx(
        (prev) => (prev + delta + searchPlaceholderPool.length) % searchPlaceholderPool.length
      );
    };

    const handleTextSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      unlockMobileAudioOnUserGesture();
      const fallbackExample = searchSpace === 'video' ? '룰렛 돌리는 장면' : currentExampleSentence;
      const q = (textInput.trim() || fallbackExample).trim();
      if (!q) return;
      setTextInput(q);
      await onExecuteQuery(q);
    };

    const handleRunExampleInstant = async () => {
      unlockMobileAudioOnUserGesture();
      const fallbackExample = searchSpace === 'video' ? '룰렛 돌리는 장면' : currentExampleSentence;
      const q = fallbackExample.trim();
      if (!q) return;
      setTextInput(q);
      await onExecuteQuery(q);
    };

    return (
      <form onSubmit={handleTextSubmit} className="w-full flex flex-wrap items-center gap-1.5 sm:gap-2">
        <div className="relative flex-1 min-w-[200px] flex items-center">
          <span className="material-symbols-outlined text-[20px] absolute left-3.5 pointer-events-none text-zinc-400">
            {searchSpace === 'vault'
              ? 'folder_managed'
              : searchSpace === 'video'
              ? 'smart_display'
              : 'search'}
          </span>
          <input
            type="text"
            value={textInput}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder={
              searchSpace === 'video'
                ? '내 영상 속 찾고 싶은 특정 장면이나 대사를 입력해 보세요 (그 순간부터 바로 재생됩니다)'
                : `예) ${currentExampleSentence}`
            }
            className="w-full h-11 md:h-13 pl-10 pr-[110px] sm:pr-[264px] rounded-2xl bg-[#18181B] border border-white/15 focus:border-primary-container shadow-sm outline-none font-body-md text-[13px] md:text-[14.5px] text-white placeholder:text-zinc-400/75 transition-colors"
          />

          <div className="absolute right-1.5 inset-y-0 flex items-center gap-1">
            {!textInput.trim() ? (
              <div className="hidden sm:flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleStepPlaceholder(-1)}
                  title="이전 예시 문구 보기"
                  className="w-7 h-7 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-300 hover:text-white text-[11px] font-bold flex items-center justify-center transition-colors cursor-pointer"
                >
                  ◀
                </button>
                <button
                  type="button"
                  onClick={() => handleStepPlaceholder(1)}
                  title="다음 예시 문구 보기"
                  className="w-7 h-7 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-300 hover:text-white text-[11px] font-bold flex items-center justify-center transition-colors cursor-pointer"
                >
                  ▶
                </button>
                <button
                  type="button"
                  onClick={() => void handleRunExampleInstant()}
                  title="지금 보이는 예시 문장으로 1초 만에 바로 검색해 봅니다"
                  className="inline-flex items-center gap-1 h-7.5 px-2.5 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 border border-teal-400/35 text-teal-300 font-label-sm text-[11.5px] font-extrabold transition-all whitespace-nowrap cursor-pointer"
                >
                  <span>예시 바로 검색 ↵</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setTextInput('')}
                className="text-zinc-400 hover:text-white p-1 cursor-pointer"
                title="지우기"
              >
                <span className="material-symbols-outlined text-[17px]">close</span>
              </button>
            )}
            <button
              type="submit"
              className="h-8.5 md:h-10 px-3.5 rounded-xl bg-primary-container hover:opacity-95 text-zinc-950 font-label-md text-[12.5px] md:text-[13px] font-extrabold transition-all whitespace-nowrap cursor-pointer"
            >
              검색
            </button>
          </div>
        </div>

        {allowMobileVoice && (
          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            <button
              type="button"
              onClick={onToggleMic}
              title="모바일 마이크로 말해서 검색·낭독·손보기"
              className={`h-10 px-3 rounded-2xl border flex items-center gap-1 font-label-md text-[12px] font-bold shrink-0 whitespace-nowrap transition-all cursor-pointer ${
                isListening
                  ? 'bg-primary-container text-zinc-950 border-primary-container animate-pulse'
                  : 'bg-[#18181B] hover:bg-zinc-800 text-zinc-200 border-white/15'
              }`}
            >
              <span
                className={`material-symbols-outlined text-[18px] ${
                  isListening ? 'text-zinc-950' : 'text-primary-container'
                }`}
              >
                {isListening ? 'stop_circle' : 'mic'}
              </span>
              <span>{isListening ? '듣는 중' : '말하기'}</span>
            </button>
            <VoiceActorControlPill />
          </div>
        )}
      </form>
    );
  }
);

export const Stage1MinimalSearchPreview: React.FC<{
  initialQuery?: string;
  forceSampleOnly?: boolean;
}> = ({
  initialQuery = '',
  forceSampleOnly = false,
}) => {
  const store = useSaySeeStore();
  const {
    layout,
    searchSpace,
    setSearchSpace,
    resetSearchSpaceToAll,
    isListening,
    liveWaveBands,
    interimSttPreview,
    toggleMicRecording,
    runTextQuery,
    openLocalFolder,
    importMobileLocalPhotos,
    isStoreAppMode,
    setSelectedPhoto,
    setSelectedVideoModal,
    setSelectedDocModal,
    syncRealVideoDuration,
    toggleBookmark,
    setActiveLoungeType,
    setDesktopTab,
    setMobileTab,
  } = store;

  const [demoQuery, setDemoQuery] = useState<string>('');
  const [demoExecuted, setDemoExecuted] = useState<boolean>(false);

  const photos = forceSampleOnly ? DEMO_SEARCH_SAMPLE_PHOTOS_2 : store.photos;
  const videoSceneItems = forceSampleOnly ? DEMO_SEARCH_SAMPLE_VIDEOS_2 : store.videoSceneItems;
  const localDocuments = forceSampleOnly ? DEMO_SEARCH_SAMPLE_DOCS_2 : store.localDocuments;
  const initialized = forceSampleOnly ? true : store.initialized;
  const hasExecutedUserSearch = forceSampleOnly ? demoExecuted : store.hasExecutedUserSearch;
  const copyTextSafe = async (text: string): Promise<void> => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }
    } catch {
      /* fallback below */
    }
    if (typeof document !== 'undefined') {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        /* ignore */
      }
    }
  };

  const verifyGhostLabelerGate = async (targetFilePath?: string): Promise<boolean> => {
    if (forceSampleOnly) return true;
    const fp = String(targetFilePath || '').trim();
    const normFp = fp.replace(/\\/g, '/').toLowerCase();
    if (/^[sS]:/.test(fp) || normFp.includes('/s:/')) {
      return true;
    }
    const st = useSaySeeStore.getState();
    const ent = st.deviceEntitlement;
    if (zCoreBridge.isConnected) {
      try {
        const res = await fetch(getZCoreUrl('/api/superpower/consume-action'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            actionType: 'feat_ghost_labeler',
            filePath: fp,
            isSubscribed: Boolean(ent?.isPaidUnlimited),
            hubToken: st.merlinAuth?.token || '',
            accountId: st.merlinAuth?.email || 'local_user',
          }),
          signal: AbortSignal.timeout(1800),
        });
        if (!res.ok) {
          useSaySeeStore.setState({
            lastQuarantineToast: '🔒 [귀신 라벨러] 권한 확인에 실패해 실행을 보류했습니다.',
          });
          return false;
        }
        const gj = (await res.json().catch(() => null)) as Record<string, unknown> | null;
        if (gj && gj.allowed === false) {
          if (ent?.trialActive && (gj.trialOptInRequired || gj.status === 'NOT_STARTED' || gj.reason === 'TRIAL_NOT_STARTED')) {
            await fetch(getZCoreUrl('/api/superpower/start-trial'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                agreed: true,
                optIn: true,
                hubToken: st.merlinAuth?.token || '',
                accountId: st.merlinAuth?.email || 'local_user',
              }),
              signal: AbortSignal.timeout(1500),
            }).catch(() => null);
            return true;
          }
          useSaySeeStore.setState({
            lastQuarantineToast: String(
              gj.message || '🔒 [귀신 라벨러] 30일 무료체험 또는 [5. 내 기기 통합] 구독 후 사용 가능합니다 (S: 업무 드라이브는 무료).'
            ),
          });
          return false;
        }
        if (gj && gj.allowed === true) return true;
      } catch {
        useSaySeeStore.setState({
          lastQuarantineToast: '🔒 [귀신 라벨러] 로컬 엔진 권한 응답이 지연되어 보류되었습니다.',
        });
        return false;
      }
    }
    if (ent?.isPaidUnlimited || ent?.trialActive) {
      return true;
    }
    useSaySeeStore.setState({
      lastQuarantineToast:
        '🔒 [귀신 라벨러] 유료 기능입니다. [5. 내 기기 통합] 30일 무료체험 시작 또는 구독 시 무제한 사용 가능(S: 업무 드라이브는 무료)합니다.',
    });
    return false;
  };

  const activeQuery = forceSampleOnly ? demoQuery : store.activeQuery;
  const matchedVaultPhotos = useMemo(
    () => (forceSampleOnly ? [] : store.matchedVaultPhotos),
    [forceSampleOnly, store.matchedVaultPhotos]
  );
  const searchResults = useMemo(() => {
    if (!forceSampleOnly) return store.searchResults;
    const q = demoQuery.trim().toLowerCase();
    const list = !q
      ? DEMO_SEARCH_SAMPLE_PHOTOS_2
      : DEMO_SEARCH_SAMPLE_PHOTOS_2.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.captionKo || '').toLowerCase().includes(q) ||
            p.tags.some((t) => t.toLowerCase().includes(q)) ||
            (p.keywordsKo || []).some((k) => k.toLowerCase().includes(q))
        );
    return (list.length > 0 ? list : DEMO_SEARCH_SAMPLE_PHOTOS_2).map((photo) => ({
      photo,
      score: 0.98,
      matchPercentage: 98,
      matchedBy: 'text-direct' as const,
    }));
  }, [forceSampleOnly, store.searchResults, demoQuery]);
  const matchedVideoScenes = useMemo(() => {
    if (!forceSampleOnly) return store.matchedVideoScenes;
    const q = demoQuery.trim().toLowerCase();
    if (!q) return DEMO_SEARCH_SAMPLE_VIDEOS_2;
    const filtered = DEMO_SEARCH_SAMPLE_VIDEOS_2.filter(
      (v) =>
        v.title.toLowerCase().includes(q) ||
        (v.sceneDescription || '').toLowerCase().includes(q) ||
        (v.ocrFullText || '').toLowerCase().includes(q) ||
        v.keywords.some((k: string) => k.toLowerCase().includes(q))
    );
    return filtered.length > 0 ? filtered : DEMO_SEARCH_SAMPLE_VIDEOS_2;
  }, [forceSampleOnly, store.matchedVideoScenes, demoQuery]);
  const matchedLocalDocs = useMemo(() => {
    if (!forceSampleOnly) return store.matchedLocalDocs;
    const q = demoQuery.trim().toLowerCase();
    if (!q) return DEMO_SEARCH_SAMPLE_DOCS_2;
    const filtered = DEMO_SEARCH_SAMPLE_DOCS_2.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.fileName.toLowerCase().includes(q) ||
        d.extractedText.toLowerCase().includes(q) ||
        d.keywords.some((k: string) => k.toLowerCase().includes(q))
    );
    return filtered.length > 0 ? filtered : DEMO_SEARCH_SAMPLE_DOCS_2;
  }, [forceSampleOnly, store.matchedLocalDocs, demoQuery]);

  const [ocrModalPhoto, setOcrModalPhoto] = useState<PhotoItem | null>(null);
  const [clearInputSignal, setClearInputSignal] = useState<number>(0);
  const mobilePhotoInputRef = React.useRef<HTMLInputElement | null>(null);
  const [isZCoreConnected, setIsZCoreConnected] = useState(zCoreBridge.isConnected);

  useEffect(() => {
    return zCoreBridge.subscribe((connected) => setIsZCoreConnected(connected));
  }, []);

  const isMobile = layout === 'mobile';
  const isMobileOrStore = isMobile || Boolean(isStoreAppMode);
  const allowMobileVoice = isMobileVoiceEnvironment() || Boolean(isStoreAppMode);
  const searchPlaceholderPool = useMemo(
    () =>
      isMobileOrStore
        ? SEARCH_STAGE_MOBILE_ROLLING_PLACEHOLDERS_10
        : SEARCH_STAGE_PC_ROLLING_PLACEHOLDERS_10,
    [isMobileOrStore]
  );

  const activePhotos = useMemo(() => photos.filter((p) => !p.quarantined), [photos]);
  const gallerySceneCount = useMemo(
    () =>
      activePhotos.filter(
        (p) =>
          !p.isVaultDocument &&
          p.trashCategory !== 'blurry' &&
          p.trashCategory !== 'screenshot' &&
          p.trashCategory !== 'memo' &&
          p.trashCategory !== 'duplicate'
      ).length,
    [activePhotos]
  );
  const vaultPhotoCount = useMemo(
    () => activePhotos.filter((p) => p.isVaultDocument).length,
    [activePhotos]
  );
  const totalIndexedDocs = localDocuments.length + vaultPhotoCount;
  const matchedTotalDocsCount = matchedLocalDocs.length + matchedVaultPhotos.length;

  // 연사 묶기는 스위치 없이 항상 기본 ON으로 자동 작동
  const groupedResults = useMemo(() => {
    const orderedGroups = groupBurstSearchResults(searchResults);
    if (searchSpace === 'vault') {
      return orderedGroups.flatMap((g) =>
        g.burstPhotos.map((photo) => ({
          representative: {
            photo,
            score: g.representative.score,
            matchPercentage: g.representative.matchPercentage,
            matchedBy: g.representative.matchedBy,
          },
          burstPhotos: [photo],
          burstCount: 1,
        }))
      );
    }
    return orderedGroups;
  }, [searchResults, searchSpace]);

  const isStandaloneSearchWin = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return Boolean(new URLSearchParams(window.location.search).get('ghostSearchWindow'));
  }, []);
  const initialPhotoBatchSize = isStandaloneSearchWin ? 20 : 48;
  const [visiblePhotoLimit, setVisiblePhotoLimit] = useState<number>(initialPhotoBatchSize);
  const photoLoadMoreRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVisiblePhotoLimit(initialPhotoBatchSize);
  }, [activeQuery, searchSpace, initialPhotoBatchSize]);

  useEffect(() => {
    const el = photoLoadMoreRef.current;
    if (!el || visiblePhotoLimit >= groupedResults.length) return;
    if (typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisiblePhotoLimit((prev) => Math.min(groupedResults.length, prev + 36));
        }
      },
      { rootMargin: '320px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visiblePhotoLimit, groupedResults.length]);

  const visibleGroupedResults = useMemo(
    () => groupedResults.slice(0, visiblePhotoLimit),
    [groupedResults, visiblePhotoLimit]
  );

  const initialDocBatchSize = isStandaloneSearchWin ? 18 : 36;
  const [visibleDocLimit, setVisibleDocLimit] = useState<number>(initialDocBatchSize);
  const docLoadMoreRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVisibleDocLimit(initialDocBatchSize);
  }, [activeQuery, searchSpace, initialDocBatchSize]);

  useEffect(() => {
    const el = docLoadMoreRef.current;
    if (!el || visibleDocLimit >= matchedLocalDocs.length) return;
    if (typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleDocLimit((prev) => Math.min(matchedLocalDocs.length, prev + 36));
        }
      },
      { rootMargin: '320px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visibleDocLimit, matchedLocalDocs.length]);

  const visibleMatchedDocs = useMemo(
    () => matchedLocalDocs.slice(0, visibleDocLimit),
    [matchedLocalDocs, visibleDocLimit]
  );

  const scrollToResults = React.useCallback(() => {
    if (typeof document !== 'undefined') {
      window.setTimeout(() => {
        document.getElementById('ghosti-search-results')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 60);
    }
  }, []);

  const handleExecuteQuery = React.useCallback(
    async (q: string) => {
      if (forceSampleOnly) {
        setDemoQuery(q);
        setDemoExecuted(true);
      } else {
        await runTextQuery(q);
      }
      scrollToResults();
    },
    [forceSampleOnly, runTextQuery, scrollToResults]
  );

  const handleToggleMic = React.useCallback(() => {
    unlockMobileAudioOnUserGesture();
    void toggleMicRecording();
  }, [toggleMicRecording]);

  return (
    <main className="flex-1 w-full px-4 sm:px-6 py-5 sm:py-6 flex flex-col gap-5">
      {/* 상단 검색 프레임 */}
      <div className="w-full flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
          <h1 className="font-headline-md text-[20px] md:text-[24px] text-white font-extrabold tracking-tight">
            🔍 내 기기 1초 AI 내용검색
          </h1>
        </div>

        <section className="w-full flex flex-col gap-3">
          <div className="w-full flex flex-col gap-3">
            {/* 1-A. 자연어 문장형 통합 검색창 (독립 상태 분리로 타이핑 시 하단 그리드 리렌더링 0회 보장) */}
            <Stage1IsolatedSearchInputForm
              initialQuery={initialQuery}
              initialized={initialized}
              hasExecutedUserSearch={hasExecutedUserSearch}
              activeQuery={activeQuery}
              searchSpace={searchSpace}
              searchPlaceholderPool={searchPlaceholderPool}
              allowMobileVoice={allowMobileVoice}
              isListening={isListening}
              clearSignal={clearInputSignal}
              onExecuteQuery={handleExecuteQuery}
              onToggleMic={handleToggleMic}
            />

            {allowMobileVoice && isListening && (
              <div className="px-3.5 py-2 rounded-xl bg-zinc-950 border border-white/10 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex items-center gap-0.5 h-4 shrink-0">
                    {liveWaveBands.slice(0, 8).map((amp, i) => (
                      <span
                        key={i}
                        style={{ height: `${Math.max(4, Math.round(amp * 16))}px` }}
                        className="w-1 rounded-full bg-primary-container transition-all duration-100"
                      />
                    ))}
                  </div>
                  <span className="font-label-md text-[12.5px] text-primary-container font-bold truncate">
                    {interimSttPreview
                      ? `“${interimSttPreview}”`
                      : '말씀해 주세요... (말씀이 끝나면 즉시 검색됩니다)'}
                  </span>
                </div>
              </div>
            )}

            {/* 1-B. 3대 카테고리 스위칭 캡슐 탭: [사진] | [동영상] | [문서] */}
            <div className="flex flex-wrap items-center justify-between gap-2 overflow-x-auto no-scrollbar pb-0.5">
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setSearchSpace('gallery')}
                  className={`px-4 py-2 rounded-full font-label-md text-[13px] font-bold flex items-center gap-1.5 transition-all border shrink-0 whitespace-nowrap outline-none focus:outline-none cursor-pointer ${
                    searchSpace === 'gallery'
                      ? 'bg-primary-container text-zinc-950 border-primary-container font-extrabold'
                      : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border-white/10'
                  }`}
                >
                  <span>사진</span>
                  <span
                    className={`px-2 py-0.2 rounded-full text-[11px] font-mono ${
                      searchSpace === 'gallery'
                        ? 'bg-white/25 text-zinc-950 font-black'
                        : hasExecutedUserSearch && searchResults.length > 0
                        ? 'bg-primary-container/20 text-primary-container font-bold'
                        : 'text-zinc-400 font-bold'
                    }`}
                  >
                    {!initialized
                      ? '…'
                      : hasExecutedUserSearch
                      ? `(${searchResults.length})`
                      : gallerySceneCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSearchSpace('video')}
                  className={`px-4 py-2 rounded-full font-label-md text-[13px] font-bold flex items-center gap-1.5 transition-all border shrink-0 whitespace-nowrap outline-none focus:outline-none cursor-pointer ${
                    searchSpace === 'video'
                      ? 'bg-primary-container text-zinc-950 border-primary-container font-extrabold'
                      : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border-white/10'
                  }`}
                >
                  <span>동영상</span>
                  <span
                    className={`px-2 py-0.2 rounded-full text-[11px] font-mono ${
                      searchSpace === 'video'
                        ? 'bg-white/25 text-zinc-950 font-black'
                        : hasExecutedUserSearch && matchedVideoScenes.length > 0
                        ? 'bg-primary-container/20 text-primary-container font-bold'
                        : 'text-zinc-400 font-bold'
                    }`}
                  >
                    {!initialized
                      ? '…'
                      : hasExecutedUserSearch
                      ? `(${matchedVideoScenes.length})`
                      : `${videoSceneItems.length}`}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSearchSpace('vault')}
                  className={`px-4 py-2 rounded-full font-label-md text-[13px] font-bold flex items-center gap-1.5 transition-all border shrink-0 whitespace-nowrap outline-none focus:outline-none cursor-pointer ${
                    searchSpace === 'vault'
                      ? 'bg-primary-container text-zinc-950 border-primary-container font-extrabold'
                      : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border-white/10'
                  }`}
                >
                  <span>문서</span>
                  <span
                    className={`px-2 py-0.2 rounded-full text-[11px] font-mono ${
                      searchSpace === 'vault'
                        ? 'bg-white/25 text-zinc-950 font-black'
                        : hasExecutedUserSearch && matchedTotalDocsCount > 0
                        ? 'bg-primary-container/20 text-primary-container font-bold'
                        : 'text-zinc-400 font-bold'
                    }`}
                  >
                    {!initialized
                      ? '…'
                      : hasExecutedUserSearch
                      ? `(${matchedTotalDocsCount})`
                      : totalIndexedDocs}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const targetPhoto =
                      searchResults[0]?.photo ||
                      photos.find((p) => !p.quarantined) ||
                      photos[0] ||
                      null;
                    if (targetPhoto) {
                      setOcrModalPhoto(targetPhoto);
                    }
                  }}
                  title="사진에서 글자·표·원하는 단어 조각(칩)만 바로 따내기 (창 UI ③)"
                  className="px-3.5 py-2 rounded-full bg-zinc-950 hover:bg-teal-400 text-teal-200 hover:text-zinc-950 border border-teal-400/60 font-label-md text-[12.5px] font-black shadow-md flex items-center gap-1 shrink-0 whitespace-nowrap transition-all cursor-pointer"
                >
                  <span>📝 OCR 글자 따기</span>
                </button>
              </div>

              {hasExecutedUserSearch && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setClearInputSignal((c) => c + 1);
                      resetSearchSpaceToAll(searchSpace);
                    }}
                    className="px-3 py-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-400 hover:text-white font-label-sm text-[11.5px] whitespace-nowrap cursor-pointer"
                  >
                    ✕ 검색 해제
                  </button>
                </div>
              )}
            </div>

            {/* 1-D. 연결 상태 바 (체험판 검색창일 때는 항상 고정 샘플 안내만 노출) */}
            {forceSampleOnly ? (
              <div className="w-full px-4 py-2 rounded-2xl bg-teal-500/10 dark:bg-teal-950/35 border border-teal-500/30 flex flex-wrap items-center justify-between gap-2.5 mt-0.5 shadow-sm">
                <div className="flex flex-wrap items-center gap-2 text-[12px] font-extrabold text-slate-900 dark:text-teal-200">
                  <span>🧪 웹 체험검색창 (샘플 사진 2 · 동영상 2 · 문서 2 고정) — 내 진짜 PC 파일은 귀신비서 연결 후 네이티브 『👻 귀신검색창(Ctrl+0)』에서 검색됩니다!</span>
                </div>
              </div>
            ) : isZCoreConnected ? (
              <SilentIndexingStatusBar variant="search-bar" className="mt-1" />
            ) : isMobile || isStoreAppMode ? (
              <div className="w-full px-4 py-2.5 rounded-2xl bg-teal-500/10 dark:bg-teal-950/35 border border-teal-500/30 flex flex-wrap items-center justify-between gap-3 mt-0.5 shadow-sm">
                <span className="text-[12.5px] font-extrabold text-slate-900 dark:text-white">
                  📱 스토어 정식 앱을 실행하시면 수동 불러오기 없이 내 스마트폰 사진·영상이 자동으로 정리·검색됩니다!
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  {isCapacitorNativeMobileRuntime() && (
                    <button
                      type="button"
                      onClick={() =>
                        void useSaySeeStore
                          .getState()
                          .syncMobileNativeGalleryAuto({ promptPermission: true })
                      }
                      className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black text-xs whitespace-nowrap transition-all cursor-pointer shrink-0"
                    >
                      🔄 사진첩 자동 동기화
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => requestConnectMyComputer()}
                    className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-white/15 font-bold text-xs whitespace-nowrap transition-all cursor-pointer shrink-0"
                  >
                    💻 내 PC 연결 안내
                  </button>
                </div>
              </div>
            ) : (
              <div className="w-full px-4 py-2 rounded-2xl bg-teal-500/10 dark:bg-teal-950/35 border border-teal-500/30 flex flex-wrap items-center justify-between gap-2.5 mt-0.5 shadow-sm">
                <div className="flex flex-wrap items-center gap-2 text-[12.5px] font-extrabold text-slate-900 dark:text-white">
                  <span>👀 현재 눈으로 구경 중입니다 (직접 클릭·내 진짜 파일 검색은 『👻 귀신비서』 대화 후 열려요!)</span>
                </div>
                <button
                  type="button"
                  data-allow-secretary-jump="true"
                  onClick={jumpToGhostSecretary}
                  className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black text-xs whitespace-nowrap transition-all cursor-pointer shrink-0"
                >
                  👻 &apos;귀신비서&apos;와 먼저 대화하기 ➔
                </button>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* 하단 샘플 사진·영상·문서 바둑판 (100% 보존 + TMI 배지 단순화) */}
      <div id="ghosti-search-results" className="scroll-mt-20">
        {searchSpace === 'video' ? (
          <section className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-headline-sm text-[17px] md:text-[18px] text-white font-bold">
                  {hasExecutedUserSearch && activeQuery
                    ? `“${activeQuery}” 동영상 검색 결과`
                    : '전체 동영상 목록'}
                </h2>
                <span className="px-2.5 py-0.5 rounded-md bg-zinc-900 border border-white/10 text-zinc-300 font-label-sm text-[12px] font-medium">
                  총 {matchedVideoScenes.length}건
                </span>
              </div>

              <div className="flex items-center gap-2">
                {matchedVideoScenes.length < videoSceneItems.length && (
                  <button
                    onClick={() => resetSearchSpaceToAll('video')}
                    className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-primary-container font-label-sm text-[12px] font-bold border border-white/10 cursor-pointer"
                  >
                    동영상 {videoSceneItems.length}개 전체 보기
                  </button>
                )}
              </div>
            </div>

            {matchedVideoScenes.length > 0 && (
              <div className="px-3.5 py-2.5 rounded-xl bg-teal-950/60 border border-teal-400/40 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[12px] text-teal-200 font-bold">
                  👻 화면 속 글자(자막·문서·칠판)가 찍힌 영상은 <strong className="text-teal-300">동영상 카드를 클릭하면</strong> 하단에 추출된 텍스트가 바로 표시되어 즉시 복사할 수 있어요!
                </span>
              </div>
            )}

            {matchedVideoScenes.length === 0 ? (
              <div className="w-full py-12 px-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col items-center justify-center text-center gap-2.5">
                <span className="material-symbols-outlined text-4xl text-zinc-500">videocam_off</span>
                <p className="font-headline-sm text-[15px] font-bold text-zinc-200">
                  {hasExecutedUserSearch && activeQuery
                    ? `“${activeQuery}”와 일치하는 동영상이 없습니다 (0건)`
                    : '표시할 동영상이 없습니다'}
                </p>
                {videoSceneItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => resetSearchSpaceToAll('video')}
                    className="mt-1 px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-primary-container text-[12.5px] font-bold cursor-pointer"
                  >
                    전체 동영상 {videoSceneItems.length}개 다시 보기
                  </button>
                )}
              </div>
            ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4 pb-1">
              {matchedVideoScenes.map((vid) => {
                const cardThumbUrl = resolveVideoCardThumbUrl(vid);
                const isWholeClip = (vid.matchedSeekSec ?? 0) <= 0;
                const cleanTs = cleanVideoTimestampLabel(vid.matchedTimestamp);
                return (
                <article
                  key={vid.id}
                  onClick={() => setSelectedVideoModal(vid, vid.matchedSeekSec)}
                  className="min-w-0 group rounded-2xl overflow-hidden bg-[#18181B] hover:bg-zinc-900 border border-white/10 hover:border-white/25 flex flex-col cursor-pointer transition-colors"
                >
                  <div className="relative aspect-video w-full overflow-hidden bg-black">
                    {cardThumbUrl ? (
                      <img
                        src={cardThumbUrl}
                        alt={vid.title}
                        loading="lazy"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = 'none';
                        }}
                        className="w-full h-full object-cover pointer-events-none group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-900 to-zinc-950 text-zinc-400 gap-1.5 p-4 text-center">
                        <span className="material-symbols-outlined text-3xl text-primary-container/80">movie</span>
                        <span className="text-[11.5px] font-medium text-zinc-300 truncate max-w-[85%]">{vid.title}</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                      <div className="w-11 h-11 rounded-full bg-black/75 border border-white/20 text-white flex items-center justify-center group-hover:bg-primary-container group-hover:text-zinc-950 group-hover:border-primary-container transition-all">
                        <span className="material-symbols-outlined text-[26px]">play_arrow</span>
                      </div>
                    </div>
                    {hasExecutedUserSearch && activeQuery && (
                      <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-md bg-zinc-950/90 backdrop-blur-md border border-primary-container/50 text-primary-container font-label-mono text-[11px] font-bold">
                        {isWholeClip ? '🎯 전 구간 일치 (00:00~)' : `🎯 ${cleanTs} 장면 포착`}
                      </div>
                    )}
                    <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-md bg-zinc-950/90 backdrop-blur-md border border-white/15 text-white font-label-mono text-[11px] font-extrabold shadow-md">
                      ⏱️ {vid.durationText}
                    </div>
                    {vid.hasScreenOcrText && (
                      <div className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-md bg-teal-500/90 text-zinc-950 font-label-mono text-[10.5px] font-black shadow">
                        📝 화면 글자 감지됨
                      </div>
                    )}
                  </div>
                  <div className="p-4 flex flex-col gap-2.5 flex-1 justify-between min-w-0 max-w-full overflow-hidden">
                    <div className="flex flex-col gap-2 min-w-0 max-w-full">
                      <h3 className="font-headline-sm text-[15px] text-white font-bold group-hover:text-primary-container transition-colors truncate">
                        {renderHighlightedDocText(vid.title, hasExecutedUserSearch ? activeQuery : '')}
                      </h3>
                      {Array.isArray(vid.ocrLines) && vid.ocrLines.length > 0 && (
                        <div className="bg-zinc-950/80 border border-teal-400/35 rounded-lg p-2 min-w-0 max-w-full overflow-hidden">
                          <p className="font-body-sm text-[11.5px] text-zinc-200 line-clamp-2 break-words m-0 p-0">
                            📝{' '}
                            {renderHighlightedDocText(
                              formatVideoCardOcrSummary(vid.ocrLines),
                              hasExecutedUserSearch ? activeQuery : ''
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10 font-label-mono text-[11px] text-zinc-400">
                      <span>{vid.date}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-primary-container font-bold">
                          {hasExecutedUserSearch && activeQuery
                            ? isWholeClip
                              ? '▶ 처음부터 재생'
                              : `▶ ${cleanTs} 재생`
                            : '▶ 재생'}
                        </span>
                      </div>
                    </div>
                  </div>
                </article>
                );
              })}
            </div>
            )}
          </section>
        ) : searchSpace === 'vault' ? (
          <section className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-headline-sm text-[17px] md:text-[18px] text-white font-bold">
                  {hasExecutedUserSearch && activeQuery
                    ? `“${activeQuery}” 문서 검색 결과`
                    : '전체 문서·서류 목록'}
                </h2>
                <span className="px-2.5 py-0.5 rounded-md bg-zinc-900 border border-white/10 text-zinc-300 font-label-sm text-[12px] font-medium">
                  총 {matchedTotalDocsCount}건
                </span>
              </div>

              {!isMobileOrStore && (
                <button
                  onClick={() => void openLocalFolder('docs')}
                  className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-label-sm text-[12px] font-medium border border-white/10 flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">folder_open</span>
                  <span>내 PC 문서 폴더 열기</span>
                </button>
              )}
            </div>

            {matchedLocalDocs.length === 0 && matchedVaultPhotos.length === 0 ? (
              <div className="w-full py-12 px-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col items-center justify-center text-center gap-2.5">
                <span className="material-symbols-outlined text-4xl text-zinc-500">description</span>
                <p className="font-headline-sm text-[15px] font-bold text-zinc-200">
                  {hasExecutedUserSearch && activeQuery
                    ? `“${activeQuery}”와 일치하는 문서가 없습니다 (0건)`
                    : '표시할 문서가 없습니다'}
                </p>
                {totalIndexedDocs > 0 && hasExecutedUserSearch && (
                  <button
                    type="button"
                    onClick={() => resetSearchSpaceToAll('vault')}
                    className="mt-1 px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-primary-container text-[12.5px] font-bold cursor-pointer"
                  >
                    전체 문서 {totalIndexedDocs}건 다시 보기
                  </button>
                )}
              </div>
            ) : null}

            {matchedLocalDocs.length > 0 && (
              <>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3.5 pb-1">
                {visibleMatchedDocs.map((doc) => (
                  <article
                    key={doc.id}
                    onClick={() => setSelectedDocModal(doc)}
                    className="group p-4 rounded-2xl bg-[#18181B] hover:bg-zinc-900 border border-white/10 hover:border-white/25 flex flex-col justify-between gap-3 cursor-pointer transition-colors"
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded bg-zinc-800 border border-white/10 text-amber-400 font-label-mono text-[10px] font-bold">
                            {resolveDocExtBadge(doc)}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 font-label-sm text-[11px] font-medium">
                            {doc.categoryBadge}
                          </span>
                        </div>
                        <span className="font-label-mono text-[10px] text-zinc-500">
                          {doc.deviceSource}
                        </span>
                      </div>

                      <h4 className="font-headline-sm text-[15px] text-white font-bold group-hover:text-primary-container transition-colors break-all">
                        {renderHighlightedDocText(
                          String(doc.id || '').startsWith('local_doc_') && doc.fileName
                            ? stripCollisionKeySuffix(doc.fileName)
                            : doc.title,
                          hasExecutedUserSearch ? activeQuery : '',
                          doc.matchedQueryTokens
                        )}
                      </h4>

                      <div className="bg-zinc-950/80 p-2.5 rounded-xl border border-white/5">
                        <p className="font-body-sm text-[12px] text-zinc-400 line-clamp-3 leading-relaxed m-0 p-0">
                          {renderHighlightedDocText(
                            maskSensitiveDocText(
                              hasExecutedUserSearch && activeQuery
                                ? buildDocPreviewSnippet(
                                    doc.extractedText,
                                    activeQuery,
                                    180,
                                    doc.matchedQueryTokens
                                  )
                                : doc.extractedText.slice(0, 220)
                            ),
                            hasExecutedUserSearch ? activeQuery : '',
                            doc.matchedQueryTokens
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/10 font-label-mono text-[11px] text-zinc-400 gap-2">
                      <span>{doc.date}</span>
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void verifyGhostLabelerGate(doc.path || doc.fileName).then(async (allowed) => {
                              if (!allowed) return;
                              const cleanDocName = stripCollisionKeySuffix(doc.fileName);
                              const newLabel = formatQuickKoreanLabelForFile(
                                cleanDocName,
                                doc.date,
                                [doc.title, (doc.extractedText || '').slice(0, 120)]
                              );
                              await copyTextSafe(newLabel);
                              useSaySeeStore.setState({
                                lastQuarantineToast: `🏷️ 귀신 라벨러 완료: ${cleanDocName} ➔ ${newLabel} (클립보드에 한글 라벨명 복사됨)`,
                              });
                            });
                          }}
                          className="px-2 py-1 rounded-lg bg-teal-500/20 hover:bg-teal-500/35 border border-teal-400/50 text-teal-200 font-label-sm text-[11px] font-extrabold transition-colors cursor-pointer"
                        >
                          🏷️ 이 파일 귀신라벨링🔒
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void navigator.clipboard?.writeText(doc.extractedText);
                            useSaySeeStore.setState({
                              lastQuarantineToast: `📋 복사 완료! [${doc.title}] 본문 정보가 즉시 복사되었습니다.`,
                            });
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400/50 text-emerald-300 font-label-sm text-[11.5px] font-extrabold transition-colors cursor-pointer"
                        >
                          📋 복사
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isMobileOrStore || !isZCoreConnected) {
                              setSelectedDocModal(doc);
                              return;
                            }
                            void executeRealOsAction('open_file_search', doc.path || doc.fileName).then((res) => {
                              useSaySeeStore.setState({
                                lastQuarantineToast: res.summaryKo || `📂 탐색기에서 [${doc.fileName}] 파일을 바로 띄웠습니다.`,
                              });
                            });
                          }}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/50 text-amber-300 font-label-sm text-[11.5px] font-extrabold transition-colors cursor-pointer"
                        >
                          {isMobileOrStore || !isZCoreConnected ? '📖 본문 보기' : '🔍 파일 열기'}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              {visibleDocLimit < matchedLocalDocs.length && (
                <div ref={docLoadMoreRef} className="h-4 w-full" aria-hidden="true" />
              )}
              </>
            )}

            {matchedVaultPhotos.length > 0 && (
              <div className="flex flex-col gap-2.5 pt-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-headline-sm text-[14.5px] font-bold text-teal-200">
                    📸 촬영·스캔 서류 사진 ({matchedVaultPhotos.length}건)
                  </h3>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
                  {matchedVaultPhotos.map((vItem) => {
                    const vp = vItem.photo;
                    return (
                      <article
                        key={vp.id}
                        onClick={() => setSelectedPhoto(vp, null)}
                        className="group p-3 rounded-2xl bg-[#18181B] hover:bg-zinc-900 border border-white/10 hover:border-teal-400/40 flex flex-col gap-2.5 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <img
                            src={vp.thumbUrl}
                            alt={vp.name}
                            loading="lazy"
                            className="w-14 h-14 rounded-xl object-cover bg-zinc-950 border border-white/10 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-bold text-white truncate">{vp.name}</p>
                            <p className="text-[11px] text-zinc-400 line-clamp-2 mt-0.5">
                              {maskSensitiveDocText(vp.captionKo || vp.tags.join(' '))}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-white/10">
                          <span className="font-label-mono text-[10.5px] text-zinc-400">
                            {vp.date.split(' ')[0]}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void verifyGhostLabelerGate(vp.fullPath || vp.name).then(async (allowed) => {
                                  if (!allowed) return;
                                  const res = await resolveSmartKoreanLabelForPhoto(vp);
                                  await copyTextSafe(res.label);
                                  useSaySeeStore.setState({
                                    lastQuarantineToast: `🏷️ 귀신 라벨러 완료: ${res.displaySourceName} ➔ ${res.label} (복사됨)`,
                                  });
                                });
                              }}
                              className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/50 text-amber-200 font-label-sm text-[10.5px] font-extrabold cursor-pointer"
                            >
                              🏷️ 라벨링🔒
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOcrModalPhoto(vp);
                              }}
                              className="px-2 py-1 rounded-lg bg-teal-500/20 hover:bg-teal-500/35 border border-teal-400/50 text-teal-200 font-label-sm text-[10.5px] font-extrabold cursor-pointer"
                            >
                              📝 OCR
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        ) : (
          /* [🖼️ 전체 갤러리] 모드 — [❐ 동일 연사 묶어보기 ON] 스위치 버튼 완전 제거 & 깔끔한 카운트만 표시 */
          <section className="flex flex-col gap-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-headline-sm text-[17px] md:text-[18px] text-white font-bold">
                  {hasExecutedUserSearch && activeQuery
                    ? `“${activeQuery}” 검색 결과`
                    : '전체 사진 목록'}
                </h2>
                <span className="px-2.5 py-0.5 rounded-md bg-zinc-900 border border-white/10 text-zinc-300 font-label-sm text-[12px] font-medium">
                  총 {hasExecutedUserSearch ? searchResults.length : gallerySceneCount}장
                </span>
              </div>
            </div>

            {groupedResults.length > 0 ? (
              <>
              <div
                className={
                  groupedResults.length <= 16
                    ? 'grid grid-cols-[repeat(auto-fill,minmax(175px,1fr))] gap-3.5'
                    : 'grid grid-cols-[repeat(auto-fill,minmax(145px,1fr))] gap-2.5'
                }
              >
                {visibleGroupedResults.map((group) => {
                  const item = group.representative;
                  const isBurst = group.burstCount >= 2;
                  return (
                    <article
                      key={item.photo.id}
                      onClick={() =>
                        // [레드팀 보완] 연사 묶음(❐ N장 연사) 클릭 시 상세 모달에 group.burstPhotos를 그대로 넘겨 모달 내에서 나란히 펼쳐 골라볼 수 있도록 보장
                        setSelectedPhoto(item.photo, isBurst ? group.burstPhotos : null)
                      }
                      className="group relative rounded-2xl overflow-hidden bg-[#18181B] border border-white/10 hover:border-white/25 transition-colors cursor-pointer flex flex-col"
                    >
                      <div
                        className={`relative ${
                          groupedResults.length <= 16 ? 'aspect-[4/3]' : 'aspect-[4/5]'
                        } w-full overflow-hidden bg-zinc-950`}
                      >
                        <img
                          src={item.photo.thumbUrl}
                          alt={item.photo.name}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                        />

                        {isBurst && (
                          <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-zinc-950/90 border border-white/15 text-primary-container font-label-sm text-[10.5px] font-bold flex items-center gap-1">
                            <span>❐ {group.burstCount}장 연사</span>
                          </div>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleBookmark(item.photo.id);
                          }}
                          aria-label="즐겨찾기"
                          className={`absolute top-2.5 right-2.5 w-7.5 h-7.5 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                            item.photo.bookmarked
                              ? 'bg-red-600/95 text-white ring-2 ring-white/80 shadow-md scale-105'
                              : 'bg-black/75 text-white/85 hover:text-red-400 hover:bg-black/90'
                          }`}
                        >
                          <span
                            className="material-symbols-outlined text-[16px]"
                            style={
                              item.photo.bookmarked
                                ? { fontVariationSettings: "'FILL' 1, 'wght' 600" }
                                : undefined
                            }
                          >
                            favorite
                          </span>
                        </button>

                        <div className="absolute bottom-10 right-2.5 z-10 flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const targetPhoto = item.photo;
                              void verifyGhostLabelerGate(targetPhoto.fullPath || targetPhoto.name).then(async (allowed) => {
                                if (!allowed) return;
                                useSaySeeStore.setState({
                                  lastQuarantineToast: '🏷️ 사진 속 글자·피사체를 분석해 한글 라벨명을 생성하는 중...',
                                });
                                const res = await resolveSmartKoreanLabelForPhoto(targetPhoto);
                                await copyTextSafe(res.label);
                                const patchPhoto = (p: PhotoItem): PhotoItem =>
                                  p.id === targetPhoto.id
                                    ? {
                                        ...p,
                                        tags: Array.from(new Set([...res.enrichedTags, ...(p.tags || [])])),
                                        ...(res.ocrSnippet && !(p.captionKo || '').includes('📝 OCR:')
                                          ? {
                                              captionKo: p.captionKo
                                                ? `${p.captionKo} | 📝 OCR: ${res.ocrSnippet}`
                                                : `📝 OCR: ${res.ocrSnippet}`,
                                            }
                                          : {}),
                                      }
                                    : p;
                                useSaySeeStore.setState((st) => ({
                                  lastQuarantineToast: `🏷️ 귀신 라벨러 완료: ${res.displaySourceName} ➔ ${res.label} (클립보드에 한글 라벨명 복사됨)`,
                                  ...(res.enrichedTags.length > 0
                                    ? {
                                        photos: st.photos.map(patchPhoto),
                                        searchResults: st.searchResults.map((sr) => ({
                                          ...sr,
                                          photo: patchPhoto(sr.photo),
                                        })),
                                      }
                                    : {}),
                                }));
                              });
                            }}
                            title="기계적 파일명을 촬영일·내용 기반 한글 라벨명(YYMMDD_내용)으로 생성·복사합니다"
                            className="px-2 py-1 rounded-lg bg-zinc-950/90 hover:bg-amber-400 text-amber-200 hover:text-zinc-950 border border-amber-400/60 font-label-sm text-[10.5px] font-black shadow-md transition-all cursor-pointer"
                          >
                            🏷️ 이 파일 귀신라벨링🔒
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOcrModalPhoto(item.photo);
                            }}
                            title="귀신검색창에서 이 사진의 별도 독립 📝 사진·표 OCR 창을 열어 글자·표를 추출합니다"
                            className="px-2.5 py-1 rounded-lg bg-zinc-950/90 hover:bg-teal-400 text-teal-200 hover:text-zinc-950 border border-teal-400/60 font-label-sm text-[11px] font-black shadow-md transition-all cursor-pointer"
                          >
                            📝 OCR
                          </button>
                        </div>

                        <div className="absolute inset-x-0 bottom-0 h-[22%] min-h-[44px] px-3 pb-2.5 pt-4 bg-gradient-to-t from-black/90 via-black/55 to-transparent flex items-end justify-between gap-2 pointer-events-none">
                          <span className="font-label-sm text-[11.5px] font-semibold text-white whitespace-nowrap shrink-0">
                            {item.photo.date.split(' ')[0]}
                          </span>
                          {item.photo.tags[0] && (
                            <span className="font-label-sm text-[11.5px] font-bold text-primary-container truncate">
                              {item.photo.tags[0]}
                            </span>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
              {visiblePhotoLimit < groupedResults.length && (
                <div ref={photoLoadMoreRef} className="py-4 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setVisiblePhotoLimit((prev) => Math.min(groupedResults.length, prev + 72))}
                    className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-300 text-[12.5px] font-bold cursor-pointer"
                  >
                    사진 더 보기 ({visiblePhotoLimit} / {groupedResults.length}장)
                  </button>
                </div>
              )}
              </>
            ) : (
              <div className="py-14 rounded-2xl bg-[#18181B] border border-white/10 text-center flex flex-col items-center gap-2">
                <span className="material-symbols-outlined text-zinc-500 text-[36px]">
                  image_search
                </span>
                <p className="font-headline-sm text-[15px] text-zinc-300 font-semibold">
                  일치하는 사진을 찾지 못했습니다. 다른 문장이나 단어로 검색해 보세요.
                </p>
              </div>
            )}
          </section>
        )}
      </div>

      {/* [급소 2 돌파 ① · Contextual PQL] 검색 결과 하단 1줄 기기 통합 브릿지 (모바일 스토어 빌드 제외) */}
      {!isStoreAppMode && (
        <div className="mt-2 px-4 py-2.5 rounded-2xl bg-teal-950/35 border border-teal-400/35 flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
          <span className="text-teal-100 font-bold">
            📱 방금 찾은 이 파일, 집컴이나 내 폰에서도 카톡 없이 바로 열려면?
          </span>
          <button
            type="button"
            onClick={() => {
              setActiveLoungeType('personal');
              setDesktopTab('sync');
              setMobileTab('share');
            }}
            className="px-3 py-1.5 rounded-xl bg-[#2DD4BF] hover:bg-[#5EEAD4] text-zinc-950 font-extrabold text-[11.5px] cursor-pointer shrink-0 transition-colors"
          >
            내 기기 통합 30일 무카드 무료체험 켜기 ➔
          </button>
        </div>
      )}

      {/* [메뉴 2 · 👻 귀신검색창 하단 고정 소속 설명란] 유료 티어(🔒) 및 부가 기능 안내 */}
      <section
        aria-label="귀신검색 유료 티어 및 부가 기능 안내"
        className="mt-2 p-4 sm:p-5 rounded-2xl bg-zinc-900/90 border border-slate-200 dark:border-white/10 flex flex-col gap-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[13.5px] font-extrabold text-teal-800 dark:text-teal-300">
            🔒 귀신검색 유료 티어 안내 (명시적 동의 시 30일 무제한 무료체험 · 만료 시 자동 결제 없이 깔끔 잠금🔒)
          </span>
          <span className="text-[11.5px] text-slate-600 dark:text-zinc-400 font-semibold">
            내 PC 문서·사진·영상 검색 &amp; 동영상 클릭 시 화면 글자 자동 추출은 평생 무제한 무료
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[12px] text-slate-700 dark:text-zinc-200">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950/80 border border-slate-200/90 dark:border-white/10 flex flex-col gap-1">
            <span className="font-extrabold text-slate-900 dark:text-white">① 📱 내 기기 통합 소환🔒</span>
            <span className="text-slate-600 dark:text-zinc-400 leading-snug">
              동일 이메일 연결 시 핸드폰 사진·타 PC 파일 통합 노출 &amp; 폰 촬영 직후 <strong className="text-teal-700 dark:text-teal-300">1초 공간이동 (전송 후 1분간 자동 안내)</strong> · 30일 만료 시 원격 노출만 OFF되며 이미 내 PC 폴더에 복사된 원본 파일은 영구 보존
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950/80 border border-slate-200/90 dark:border-white/10 flex flex-col gap-1">
            <span className="font-extrabold text-slate-900 dark:text-white">② 📝 사진·표 OCR 창🔒 (별도 독립 창)</span>
            <span className="text-slate-600 dark:text-zinc-400 leading-snug">
              귀신검색창 안에는 사진 목록만 깔끔하게 보이고, 사진에서 <strong className="text-teal-700 dark:text-teal-300">[📝 OCR]</strong>을 누르면 별도 독립 <strong className="text-slate-900 dark:text-white">📝 사진·표 OCR 창</strong>이 열려 글자·표를 추출
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950/80 border border-slate-200/90 dark:border-white/10 flex flex-col gap-1">
            <span className="font-extrabold text-slate-900 dark:text-white">③ 🏷️ 귀신 라벨러🔒</span>
            <span className="text-slate-600 dark:text-zinc-400 leading-snug">
              암호 같은 사진·카톡·문서 파일명을 촬영일·내용 규칙(YYMMDD_내용)으로 한 번에 자동 정리
            </span>
          </div>
        </div>
      </section>

      <GhostPhotoOcrTeleportModal
        photo={ocrModalPhoto}
        onClose={() => setOcrModalPhoto(null)}
      />
    </main>
  );
};

/**
 * 🧪 1단계 [✋ 손보기] 미니멀 프리뷰 컴포넌트
 * - 1) [🗑️ 휴지통] 상단 알약 버튼 & 5번째 휴지통 카드 & 하단 휴지통 드로어 전면 철거 -> 깔끔한 4열 카테고리 그리드(① 중복·연사, ② 주차·영수증, ③ 스크린샷, ④ 흔들림)만 유지
 * - 2) 상단 난립 배지([🆓 언제나 0원], [📁 서류함 분리 확인], 2중 중복 기록함 등) 철거 -> [🕰️ 손보기·복원 기록] 단 1개로 통합
 * - 3) 좌측 '💬 기기 3대 핵심 건강검진' 아코디언 박스 완전 철거
 * - 4) [레드팀 보완] 우측 [✋ 손보기 대화창] 첫 인사말 말풍선(Welcome Bubble)에 [⚡ 느려진 PC 보안모듈·속도 1초 검진] · [🗂️ 바탕화면·설치파일 임시 데이터 정리] 1클릭 실행 버튼 기본 내장
 */
export const Stage1MinimalCarePreview: React.FC = () => {
  const {
    layout,
    photos,
    duplicateGroups,
    selectedTrashIds,
    activeTrashCategoryFilter,
    setActiveTrashCategoryFilter,
    toggleTrashSelection,
    selectAllTrashInFilter,
    clearTrashSelection,
    pickBestInDuplicateGroup,
    moveSelectedToQuarantine,
    moveAllTrashToQuarantine,
    restoreFromQuarantine,
    quarantineMoving,
    setSelectedPhoto,
    lastUndoBatch,
    undoLastQuarantine,
    dismissUndoBatch,
    setDesktopTab,
    setMobileTab,
    setSearchSpace,
    runTextQuery,
    isStoreAppMode,
    mobileGalleryScanning,
    mobileGalleryPermissionDenied,
    mobileGalleryLimitedAccess,
    syncMobileNativeGalleryAuto,
    pendingReturnShareRoom,
    returnToSharedRoomAndOpenUpload,
  } = useSaySeeStore();

  const [externalQueryTrigger] = useState<{
    id: number;
    query: string;
  } | null>(null);
  const [zConnected, setZConnected] = useState<boolean>(zCoreBridge.isConnected);
  const [zVersion, setZVersion] = useState<string | null>(zCoreBridge.version);
  const [isCleanupPaused, setIsCleanupPaused] = useState<boolean>(false);
  const [showQuarantineDrawer, setShowQuarantineDrawer] = useState<boolean>(false);
  const [activeDupSetIdx, setActiveDupSetIdx] = useState<number>(0);
  const [showAllDupSets, setShowAllDupSets] = useState<boolean>(false);
  const [skippedGroupIds, setSkippedGroupIds] = useState<Set<string>>(() => new Set());
  const [pausedSnapshot, setPausedSnapshot] = useState<{
    activeTrash: PhotoItem[];
    duplicateGroups: typeof duplicateGroups;
  } | null>(null);

  React.useEffect(() => {
    setZConnected(zCoreBridge.isConnected);
    setZVersion(zCoreBridge.version);
    return zCoreBridge.subscribe((c) => {
      setZConnected(c);
      setZVersion(zCoreBridge.version);
    });
  }, []);

  React.useEffect(() => {
    const onTriggerMobilePicker = () => {
      void useSaySeeStore.getState().syncMobileNativeGalleryAuto({ promptPermission: true });
    };
    const onOpenMobileQuarantine = () => {
      setShowQuarantineDrawer(true);
      window.setTimeout(() => {
        document
          .getElementById('ghosti-quarantine-restore-section')
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 80);
    };
    window.addEventListener('ghosti_trigger_mobile_photo_picker', onTriggerMobilePicker);
    window.addEventListener('ghosti_open_mobile_quarantine_drawer', onOpenMobileQuarantine);
    return () => {
      window.removeEventListener('ghosti_trigger_mobile_photo_picker', onTriggerMobilePicker);
      window.removeEventListener('ghosti_open_mobile_quarantine_drawer', onOpenMobileQuarantine);
    };
  }, []);

  const isShowroomSamplePhoto = (name: string): boolean =>
    /^(IMG_2025|PET_2025|TRV_2025|DOC_2025|MEMO_2025|Screenshot_2025|BLUR_2025)/.test(name);
  const hasAnyRealUserPhoto = photos.some((p) => !isShowroomSamplePhoto(p.name));
  const isRealDeviceMode =
    zConnected || Boolean(isStoreAppMode) || layout === 'mobile' || hasAnyRealUserPhoto;
  const displayPhotos = isRealDeviceMode
    ? photos.filter((p) => !isShowroomSamplePhoto(p.name))
    : photos;

  const liveActiveTrash = displayPhotos.filter((p) => p.trashCategory && !p.quarantined);
  const activeTrash =
    isCleanupPaused && pausedSnapshot ? pausedSnapshot.activeTrash : liveActiveTrash;
  const quarantinedPhotos = displayPhotos.filter((p) => p.quarantined);
  const totalTrashBytes = activeTrash.reduce((a, p) => a + p.size, 0);

  const dupCount = activeTrash.filter((p) => matchesTrashTab(p, 'duplicate')).length;
  const memoCount = activeTrash.filter((p) => matchesTrashTab(p, 'memo')).length;
  const screenshotCount = activeTrash.filter((p) => matchesTrashTab(p, 'screenshot')).length;
  const blurryCount = activeTrash.filter((p) => matchesTrashTab(p, 'blurry')).length;
  const memoAndScreenCount = memoCount + screenshotCount;

  React.useEffect(() => {
    if (liveActiveTrash.length === 0 && (isCleanupPaused || pausedSnapshot)) {
      setIsCleanupPaused(false);
      setPausedSnapshot(null);
    }
  }, [liveActiveTrash.length, isCleanupPaused, pausedSnapshot]);

  React.useEffect(() => {
    const onPauseCleanupPaneOnly = () => {
      setPausedSnapshot({
        activeTrash: liveActiveTrash,
        duplicateGroups,
      });
      setIsCleanupPaused(true);
      clearTrashSelection();
      setActiveTrashCategoryFilter('none');
    };
    const onPhotoRestored = () => {
      setIsCleanupPaused(false);
      setPausedSnapshot(null);
      setSkippedGroupIds(new Set());
    };
    const onPhotoMovedToQuarantine = () => {
      setIsCleanupPaused(false);
      setPausedSnapshot(null);
    };
    window.addEventListener('ghosti_pause_cleanup_pane_only', onPauseCleanupPaneOnly);
    window.addEventListener('ghosti_photo_restored_from_quarantine', onPhotoRestored);
    window.addEventListener('ghosti_photo_moved_to_quarantine', onPhotoMovedToQuarantine);
    return () => {
      window.removeEventListener('ghosti_pause_cleanup_pane_only', onPauseCleanupPaneOnly);
      window.removeEventListener('ghosti_photo_restored_from_quarantine', onPhotoRestored);
      window.removeEventListener('ghosti_photo_moved_to_quarantine', onPhotoMovedToQuarantine);
    };
  }, [liveActiveTrash, duplicateGroups, clearTrashSelection, setActiveTrashCategoryFilter]);

  const currentTab =
    activeTrashCategoryFilter === 'object' ||
    activeTrashCategoryFilter === 'document' ||
    activeTrashCategoryFilter === 'receipt'
      ? 'memo'
      : activeTrashCategoryFilter;

  const realFilteredCandidates =
    currentTab === 'none' ? [] : activeTrash.filter((p) => matchesTrashTab(p, currentTab));
  const fallbackSamplesForCurrentTab: PhotoItem[] =
    currentTab === 'all'
      ? [
          ...FALLBACK_SAMPLE_TRASH_ITEMS.duplicate,
          ...FALLBACK_SAMPLE_TRASH_ITEMS.memo,
          ...FALLBACK_SAMPLE_TRASH_ITEMS.screenshot,
          ...FALLBACK_SAMPLE_TRASH_ITEMS.blurry,
        ]
      : currentTab === 'duplicate' ||
        currentTab === 'memo' ||
        currentTab === 'screenshot' ||
        currentTab === 'blurry'
      ? FALLBACK_SAMPLE_TRASH_ITEMS[currentTab]
      : [];
  const isShowingSamplePreview =
    !isRealDeviceMode &&
    currentTab !== 'none' &&
    realFilteredCandidates.length === 0 &&
    fallbackSamplesForCurrentTab.length > 0;
  const filteredCandidates = isShowingSamplePreview
    ? fallbackSamplesForCurrentTab
    : realFilteredCandidates;

  const activeSelectedPhotos = realFilteredCandidates.filter((p) => selectedTrashIds.has(p.id));
  const selectedBytes = activeSelectedPhotos.reduce((a, p) => a + p.size, 0);

  const photoById = new Map(displayPhotos.map((p) => [p.id, p]));
  const sourceDuplicateGroups =
    isCleanupPaused && pausedSnapshot ? pausedSnapshot.duplicateGroups : duplicateGroups;
  const activeDuplicateGroups = sourceDuplicateGroups.filter(
    (g) =>
      !skippedGroupIds.has(g.groupId) &&
      g.photoIds.some((id) => {
        const ph = photoById.get(id);
        return ph && !ph.quarantined && id !== g.bestPhotoId;
      })
  );

  React.useEffect(() => {
    if (activeDupSetIdx >= activeDuplicateGroups.length && activeDuplicateGroups.length > 0) {
      setActiveDupSetIdx(0);
    }
  }, [activeDupSetIdx, activeDuplicateGroups.length]);

  const showDuplicatePickSection = currentTab === 'duplicate';

  const zCoreOutdated =
    zConnected && isZCoreOutdated(zVersion);

  return (
    <div
      className={
        layout === 'mobile'
          ? 'w-full flex flex-col gap-3.5'
          : 'w-full max-w-[1640px] mx-auto px-4 sm:px-6 md:px-8 py-6 flex flex-col gap-5 pb-24'
      }
    >
      {pendingReturnShareRoom && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-teal-950/90 via-emerald-950/85 to-zinc-900 border-2 border-[#2DD4BF]/70 flex flex-wrap items-center justify-between gap-3 shadow-lg">
          <div className="flex flex-col gap-0.5">
            <span className="text-[13.5px] md:text-[14.5px] font-black text-teal-200">
              📸 『{pendingReturnShareRoom.roomTitle}』에 내 사진을 추가하러 오셨군요!
            </span>
            <span className="text-[12px] text-zinc-200 font-medium">
              {zConnected
                ? '엔진 연결과 사진 색인이 준비되었습니다! 지금 바로 가족방으로 돌아가 내 컴퓨터 사진을 골라 올려보세요.'
                : '오른쪽 『👻 귀신비서』 채팅창에서 엔진 연결 & 1초 점검을 마치면, 버튼 하나로 바로 이 가족방에 모셔다드릴게요!'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void returnToSharedRoomAndOpenUpload()}
            className="px-4 py-2.5 rounded-xl bg-[#2DD4BF] hover:bg-[#5EEAD4] text-zinc-950 font-label-md text-[13px] font-black shadow-md transition cursor-pointer whitespace-nowrap"
          >
            {zConnected
              ? `📸 준비 완료! '${pendingReturnShareRoom.roomTitle}'으로 가서 내 사진 올리기 ➔`
              : `🔙 '${pendingReturnShareRoom.roomTitle}'으로 돌아가기`}
          </button>
        </div>
      )}

      {zCoreOutdated && (
        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/80 border-2 border-amber-400 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <span className="text-[14px] text-amber-900 dark:text-amber-200 font-extrabold">
            ⚠️ 실행 중인 PC 엔진이 구버전(v{zCoreBridge.version || '구버전'})입니다 — 최신 버전(v{LATEST_Z_CORE_VERSION})으로 업데이트해 주세요.
          </span>
          <a
            href={Z_CORE_ZIP_URL}
            download="Merlin_Z_Core.zip"
            className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-sm text-[13px] font-extrabold whitespace-nowrap shadow cursor-pointer"
          >
            ⬇️ 최신 PC 엔진 (v{LATEST_Z_CORE_VERSION}) 다운로드
          </a>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* ═══════════════ [좌측 열] 미니멀 정리 워크스페이스 (엔진 미연결 시 눈으로 구경 허용 + 클릭 시 우측 귀신비서 채팅 안내) ═══════════════ */}
        <GhostSecretaryFirstGuard
          context="secretary_left"
          className="xl:col-span-7 2xl:col-span-8 flex flex-col gap-5 min-w-0"
        >
          {/* [D-35] 🪪 시기별 다양한 여권사진 등록 — 비서 질문·유저 요청·검색 칩 클릭 시에만 조용히 열림 */}
          <PassportRegistrationPanel />
          {/* 1. 슬림 헤더: 현재 쾌적한 상태 요약 + [⚡ 원본 남기고 N장 일괄 정리] 버튼만 깔끔하게 유지 (여권은 설정방 내부 보관으로 외부 비노출) */}
          <section className="p-3.5 sm:p-5 md:p-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-3.5 sm:gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 pb-3 border-b border-white/10">
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                <h1 className="font-headline-sm text-[19px] sm:text-[20px] md:text-[22px] text-zinc-900 dark:text-white font-extrabold tracking-tight flex items-center gap-2 whitespace-nowrap">
                  <span>👻 귀신비서</span>
                </h1>
                {/* [SSOT v2.3] 1. 👻 귀신비서 대표 1줄 부제 상시 노출 (모바일은 모바일 맞춤 문구로 분기) */}
                <p className="basis-full -mt-1 text-[12px] sm:text-[12.5px] md:text-[13px] font-semibold text-zinc-500 dark:text-zinc-400 break-keep leading-relaxed">
                  {isStoreAppMode || layout === 'mobile' ? (
                    <>
                      중복·연사 사진과 일회성 영수증·캡처·흔들린 사진을 AI 임의 삭제 없이 1초 만에 골라 정리하고 언제든 즉시 복원합니다.
                    </>
                  ) : (
                    <>
                      <span className="whitespace-nowrap">느려진 내 PC·폰, 클릭 한 번에 새것처럼</span> —{' '}
                      <span className="whitespace-nowrap">은행 보안프로그램은 안 지우고 재우고,</span>{' '}
                      <span className="whitespace-nowrap">중복 사진·흩어진 문서까지</span>{' '}
                      <span className="whitespace-nowrap">광고 없이 1초 만에 해결합니다.</span>
                    </>
                  )}
                </p>

                {isCapacitorNativeMobileRuntime() && mobileGalleryScanning && (
                  <span className="px-3 py-1.5 rounded-xl bg-teal-500/15 border border-teal-400/40 text-teal-600 dark:text-teal-300 font-label-sm text-[11.5px] font-extrabold whitespace-nowrap">
                    🔄 내 폰 사진·영상 자동 인덱싱 중...
                  </span>
                )}
                {isCapacitorNativeMobileRuntime() && mobileGalleryPermissionDenied && (
                  <button
                    type="button"
                    onClick={() => void openNativeAppPermissionSettings()}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-label-sm text-[11.5px] font-extrabold transition-colors cursor-pointer whitespace-nowrap"
                  >
                    ⚙️ 사진 접근 권한 허용하기
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 max-w-full" data-allow-secretary-jump="true">
                {!(isStoreAppMode || layout === 'mobile') && (
                  <button
                    type="button"
                    data-allow-secretary-jump="true"
                    onClick={() => window.dispatchEvent(new CustomEvent('ghosti_navigate_showroom'))}
                    style={{ backgroundColor: '#F0FDFA', color: '#0F766E', borderColor: '#14B8A6' }}
                    className="px-3 py-2 rounded-xl border-2 font-black text-[12px] sm:text-[13px] flex items-center justify-center gap-1.5 transition-all hover:opacity-90 cursor-pointer max-w-full shadow-xs"
                  >
                    <span>🏠 온보딩 체험관으로 나가서 구경하기 ➔</span>
                  </button>
                )}
                {liveActiveTrash.length > 0 &&
                  (isCleanupPaused ? (
                    <button
                      type="button"
                      disabled={quarantineMoving}
                      onClick={() => {
                        setIsCleanupPaused(false);
                        setPausedSnapshot(null);
                        setActiveTrashCategoryFilter(
                          duplicateGroups.length > 0 ? 'duplicate' : 'all'
                        );
                      }}
                      className="px-3.5 py-2.5 rounded-xl bg-teal-950/80 hover:bg-teal-900/80 border border-teal-400/40 text-teal-200 font-label-sm text-[12px] font-extrabold flex items-center justify-center gap-1 transition-all disabled:opacity-40 cursor-pointer max-w-full"
                    >
                      <span>▶️ 남은 사진 정리 다시 펼치기 ({liveActiveTrash.length}장)</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={quarantineMoving && liveActiveTrash.length <= 10}
                      onClick={() => {
                        if (quarantineMoving) {
                          window.dispatchEvent(new CustomEvent('ghosti_cancel_inflight_quarantine'));
                        }
                        setPausedSnapshot(
                          quarantineMoving
                            ? null
                            : {
                                activeTrash: liveActiveTrash,
                                duplicateGroups,
                              }
                        );
                        setIsCleanupPaused(true);
                        clearTrashSelection();
                        setActiveTrashCategoryFilter('none');
                        window.dispatchEvent(
                          new CustomEvent('ghosti_defer_photo_cleanup_and_continue')
                        );
                      }}
                      className="px-3.5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-white/15 text-zinc-200 font-label-sm text-[12px] font-bold flex items-center justify-center gap-1 transition-all disabled:opacity-40 cursor-pointer max-w-full"
                    >
                      <span>
                        {quarantineMoving && liveActiveTrash.length > 10
                          ? '⏹️ 정리 멈추기 · 남은 사진은 다음에'
                          : '⏭️ 남은 사진 정리는 다음에'}
                      </span>
                    </button>
                  ))}
                <span className="px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 font-label-sm text-[11.5px] font-extrabold flex items-center gap-1.5">
                  <span>🔒 AI 임의 삭제 0% · 실사진 확인 후 [OK] 승인 시에만 정리</span>
                </span>
              </div>
            </div>

            <div className="font-headline-md text-[15.5px] sm:text-[16px] md:text-[18px] text-zinc-900 dark:text-white font-extrabold tracking-tight leading-snug break-keep">
              {activeTrash.length > 0 ? (
                <>
                  정리 후보 <span className="text-primary-container">{activeTrash.length}장</span>{' '}
                  <span className="text-zinc-500 dark:text-zinc-400 font-normal text-[14px]">
                    ({fmtMB(totalTrashBytes)})
                  </span>{' '}
                  — 중복·연사 <span className="text-zinc-900 dark:text-white">{dupCount}장</span> · 메모·캡처{' '}
                  <span className="text-zinc-900 dark:text-white">{memoAndScreenCount}장</span> · 흔들림{' '}
                  <span className="text-zinc-900 dark:text-white">{blurryCount}장</span>
                </>
              ) : (isStoreAppMode || layout === 'mobile') &&
                displayPhotos.length === 0 &&
                quarantinedPhotos.length === 0 ? (
                <span className="text-teal-600 dark:text-teal-300">
                  {mobileGalleryScanning
                    ? '🔄 내 폰 사진첩을 자동으로 훑어 중복·연사·흔들린 사진을 분석하고 있어요...'
                    : mobileGalleryPermissionDenied
                    ? '🔒 스마트폰 사진 접근 권한을 허용해 주시면 수동 불러오기 없이 자동으로 정리·검색이 시작돼요!'
                    : isCapacitorNativeMobileRuntime()
                    ? '✨ 내 폰 사진첩에 표시할 사진이 아직 0장이에요.'
                    : '📲 스토어에서 『귀신같이』 정식 앱을 실행하시면 수동 불러오기 없이 내 폰 사진·영상이 자동으로 인덱싱돼요!'}
                </span>
              ) : (
                <span className="text-primary-container">
                  ✨ 현재 가장 쾌적한 상태입니다 (정리 완료 {quarantinedPhotos.length}장)
                </span>
              )}
            </div>
          </section>

          {/* 1-B. [PC 전용 상단 노출] 🛡️ 귀신비서의 상시 케어 능력 3종 — 모바일에서는 PC 전용 단어 비노출 */}
          {!(isStoreAppMode || layout === 'mobile') && (
            <section
              data-allow-secretary-jump="true"
              aria-label="귀신비서 상시 케어 능력 안내"
              className="p-4 sm:p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/30 shadow-sm flex flex-col gap-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <span className="text-[13.5px] sm:text-[14px] font-extrabold text-emerald-900 dark:text-emerald-200 break-keep leading-snug">
                  🛡️ 귀신비서의 상시 케어 능력 3종 (평생 0원)
                </span>
                <span className="text-[11.5px] sm:text-[12px] text-emerald-800 dark:text-emerald-300 font-semibold break-keep">
                  카드를 누르면 귀신비서 대화창에서 바로 실행돼요
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-[12.5px]">
                <div className="text-left p-3.5 rounded-xl bg-white dark:bg-zinc-900/90 border border-emerald-200/90 dark:border-emerald-500/25 shadow-xs flex flex-col justify-between gap-2 transition">
                  <div className="flex flex-col gap-1.5">
                    <span className="font-extrabold text-slate-900 dark:text-white break-keep leading-snug">
                      ① ⚡ 은행·관공서 보안앱 자동 절전·기상
                    </span>
                    <span className="text-slate-700 dark:text-zinc-300 break-keep leading-relaxed text-[12px]">
                      평소엔 메모리를 먹는 보안모듈을 재워 컴퓨터를 가볍게 하고, 은행 업무를 볼 때만 1초 만에 깨워드려요.
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        window.dispatchEvent(
                          new CustomEvent('ghosti_toss_to_monster_chat', {
                            detail: { query: '⚡ 은행·관공서 보안절전' },
                          })
                        )
                      }
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[11.5px] cursor-pointer transition shadow-2xs"
                    >
                      ⚡ 은행·관공서 보안절전
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        window.dispatchEvent(
                          new CustomEvent('ghosti_toss_to_monster_chat', {
                            detail: { query: '🏦 보안프로그램 즉시 깨우기' },
                          })
                        )
                      }
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-slate-300 dark:border-zinc-600 text-slate-800 dark:text-zinc-100 font-bold text-[11.5px] cursor-pointer transition"
                    >
                      🏦 보안프로그램 즉시 깨우기
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent('ghosti_toss_to_monster_chat', {
                        detail: { query: '윈도우 순정 백신으로 빠른 바이러스 검사 실행해줘' },
                      })
                    )
                  }
                  className="text-left p-3.5 rounded-xl bg-white dark:bg-zinc-900/90 hover:bg-emerald-50/70 dark:hover:bg-zinc-900 border border-emerald-200/90 dark:border-emerald-500/25 shadow-xs flex flex-col justify-between gap-2 transition cursor-pointer"
                >
                  <div className="flex flex-col gap-1.5">
                    <span className="font-extrabold text-slate-900 dark:text-white break-keep leading-snug">
                      ② 🛡️ 다운로드 파일 무소음 백신 경호
                    </span>
                    <span className="text-slate-700 dark:text-zinc-300 break-keep leading-relaxed text-[12px]">
                      광고 팝업 없이 새로 받은 설치파일·압축파일을 윈도우 기본 백신으로 조용하고 안전하게 검사해요.
                    </span>
                  </div>
                  <span className="inline-flex self-start px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300/80 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-200 font-extrabold text-[11.5px]">
                    🛡️ 무소음 백신 빠른 점검
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent('ghosti_toss_to_monster_chat', {
                        detail: { query: '🛟 미저장 문서·휴지통 3초 구출' },
                      })
                    )
                  }
                  className="text-left p-3.5 rounded-xl bg-white dark:bg-zinc-900/90 hover:bg-emerald-50/70 dark:hover:bg-zinc-900 border border-emerald-200/90 dark:border-emerald-500/25 shadow-xs flex flex-col justify-between gap-2 transition cursor-pointer"
                >
                  <div className="flex flex-col gap-1.5">
                    <span className="font-extrabold text-slate-900 dark:text-white break-keep leading-snug">
                      ③ 🛟 미저장 문서·휴지통 3초 구출
                    </span>
                    <span className="text-slate-700 dark:text-zinc-300 break-keep leading-relaxed text-[12px]">
                      실수로 저장 안 하고 끈 문서 임시본을 찾거나, 방금 휴지통으로 보낸 사진·문서를 원래 위치로 즉시 복원해요.
                    </span>
                  </div>
                  <span className="inline-flex self-start px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[11.5px] shadow-2xs">
                    🛟 미저장 문서·휴지통 3초 구출 실행
                  </span>
                </button>
              </div>
            </section>
          )}

          {/* iOS/Android '제한된 사진 접근(선택한 사진만 허용)' 상태 안내 배너 — 모바일 전폭 2단 레이아웃 & 라이트/다크 고대비 보장 */}
          {mobileGalleryLimitedAccess && isCapacitorNativeMobileRuntime() && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/85 border border-amber-300 dark:border-amber-400/50 flex flex-col md:flex-row md:items-center md:justify-between gap-3 shadow-sm">
              <div className="flex flex-col gap-1 w-full md:flex-1 min-w-0">
                <span className="text-[13px] sm:text-[13.5px] leading-snug font-extrabold text-amber-950 dark:text-amber-200 break-keep">
                  ⚠️ 현재 휴대폰 사진 권한이 『선택한 사진만 허용(제한된 접근)』으로 되어 있어요 (현재 허용된 사진 {displayPhotos.length}장)
                </span>
                <span className="text-[12px] sm:text-[12.5px] leading-relaxed font-semibold text-amber-900 dark:text-amber-100 break-keep">
                  새로 저장한 중복·흔들린 사진까지 빠짐없이 분류하려면 [설정에서 전체 허용]으로 바꾸거나 [사진 추가 선택]을 눌러주세요.
                </span>
              </div>
              <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full md:w-auto shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    void syncMobileNativeGalleryAuto({
                      promptPermission: true,
                      forceExpandSelected: true,
                    })
                  }
                  className="py-2.5 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-[12px] font-black flex items-center justify-center gap-1 cursor-pointer shadow-xs whitespace-nowrap"
                >
                  📸 사진 추가 선택
                </button>
                <button
                  type="button"
                  onClick={() => void openNativeAppPermissionSettings()}
                  className="py-2.5 px-3 rounded-xl bg-white dark:bg-zinc-900 hover:bg-amber-100/70 dark:hover:bg-zinc-800 border border-amber-400/80 dark:border-amber-300/40 text-amber-950 dark:text-amber-200 text-[12px] font-extrabold flex items-center justify-center gap-1 cursor-pointer shadow-xs whitespace-nowrap"
                >
                  ⚙️ 설정에서 전체 허용
                </button>
              </div>
            </div>
          )}

          {/* 2. 깔끔한 4열 정리 카테고리 카드 (글자 잘림 0% + 미니 샘플 썸네일 프리뷰 내장) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {TRASH_TABS_4.map((tab) => {
              const items = activeTrash.filter((p) => matchesTrashTab(p, tab.key));
              const bytes = items.reduce((a, p) => a + p.size, 0);
              const isSelected = currentTab === tab.key;
              const sampleThumbs =
                items.length > 0
                  ? items.slice(0, 2)
                  : !isRealDeviceMode
                  ? FALLBACK_SAMPLE_TRASH_ITEMS[tab.key].slice(0, 2)
                  : [];

              return (
                <button
                  key={tab.key}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    if (isCleanupPaused) {
                      setIsCleanupPaused(false);
                      setPausedSnapshot(null);
                      setActiveTrashCategoryFilter(tab.key as TrashCategory);
                      return;
                    }
                    if (currentTab === tab.key) {
                      setActiveTrashCategoryFilter('none');
                    } else {
                      setActiveTrashCategoryFilter(tab.key as TrashCategory);
                    }
                  }}
                  style={
                    isSelected
                      ? {
                          backgroundColor: 'rgba(13, 148, 136, 0.14)',
                          borderColor: '#0D9488',
                          boxShadow: '0 0 0 2px #0D9488',
                        }
                      : undefined
                  }
                  className={`group text-left cursor-pointer rounded-2xl p-3 sm:p-3.5 transition-all flex flex-col justify-between gap-2 border-2 min-w-0 overflow-hidden ${
                    isSelected
                      ? 'bg-teal-500/15 border-[#0D9488] shadow-md ring-2 ring-[#0D9488]/40'
                      : 'bg-[#18181B] hover:bg-zinc-900/70 border-white/10'
                  }`}
                >
                  <div className="flex flex-col gap-1.5 w-full min-w-0">
                    {/* 상단 상태 줄: 좌측 번호 배지 + 우측 펼치기/접기 알약 (모바일 2열 카드에서도 100% 내부 수납) */}
                    <div className="flex items-center justify-between gap-1 w-full min-w-0">
                      <span className="font-headline-sm text-[13px] text-primary-container font-extrabold shrink-0">
                        {tab.stepNum}
                      </span>
                      {isSelected ? (
                        <span
                          style={{ backgroundColor: '#0D9488', color: '#FFFFFF' }}
                          className="px-2 py-0.5 rounded-full text-[10px] font-extrabold whitespace-nowrap shadow-xs shrink-0 max-w-full"
                        >
                          ✓ 선택됨 · 접기 ▲
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-zinc-800/80 border border-white/10 text-zinc-300 text-[10px] font-bold whitespace-nowrap shrink-0 max-w-full">
                          펼치기 ▼
                        </span>
                      )}
                    </div>

                    <span className="font-headline-sm text-[13.5px] sm:text-[14.5px] text-white font-extrabold tracking-tight break-keep leading-snug">
                      {tab.shortTitle}
                    </span>

                    <span className="font-body-sm text-[11px] text-zinc-400 break-keep leading-snug">
                      {tab.subtitle}
                    </span>
                  </div>

                  {/* 카드 내 미니 썸네일 프리뷰 (실제 0장일 때도 어떤 기능인지 한눈에 보이도록 샘플 제공) */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5 min-w-0">
                    {sampleThumbs.map((sp) => (
                      <div
                        key={sp.id}
                        className="w-9 h-9 rounded-lg overflow-hidden border border-white/15 bg-zinc-950 shrink-0"
                      >
                        <img
                          src={sp.thumbUrl}
                          alt=""
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                    {items.length === 0 && !isRealDeviceMode && (
                      <span className="px-1.5 py-0.5 rounded bg-zinc-800/90 border border-white/10 text-[10px] text-zinc-300 font-bold whitespace-nowrap">
                        예시 샘플
                      </span>
                    )}
                    {items.length === 0 &&
                      isRealDeviceMode &&
                      (isStoreAppMode || layout === 'mobile') &&
                      displayPhotos.length === 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-teal-950/70 border border-teal-400/30 text-[10px] text-teal-200 font-bold whitespace-nowrap">
                          폰 사진 대기
                        </span>
                      )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-1 pt-2 border-t border-white/10 w-full min-w-0">
                    <div className="flex items-baseline gap-1 whitespace-nowrap">
                      <span className="font-headline-md text-[15px] sm:text-[16px] text-white font-extrabold">
                        {items.length}
                      </span>
                      <span className="font-label-sm text-[11px] text-zinc-400">장</span>
                      {tab.key === 'duplicate' && activeDuplicateGroups.length > 0 && (
                        <span className="text-[10.5px] text-primary-container font-bold">
                          · {activeDuplicateGroups.length}묶음
                        </span>
                      )}
                    </div>

                    <span className="font-label-mono text-[10.5px] text-zinc-400 font-semibold whitespace-nowrap">
                      {fmtMB(bytes)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* 3-0. 탭을 다시 눌러 접었을 때 또는 [남은 사진 정리는 다음에]로 화면을 멈췄을 때(currentTab === 'none') 노출되는 깔끔한 안내 바 */}
          {currentTab === 'none' && (
            <div className="p-4 md:p-5 rounded-2xl bg-[#18181B] border border-white/10 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="text-[18px]">{isCleanupPaused ? '⏸️' : '📂'}</span>
                <span className="font-body-sm text-[13.5px] text-zinc-300 font-bold">
                  {isCleanupPaused
                    ? '남은 사진 정리 화면을 잠시 멈춰 두었어요 — 오른쪽 『👻 귀신비서』의 다음 안내를 이어서 진행하시거나, 원하실 때 위 탭(①~④)을 눌러 다시 펼치실 수 있어요.'
                    : '현재 사진 분류 목록이 접혀 있습니다. 위 4개 탭(①~④)을 누르면 해당 분류 사진이 펼쳐집니다.'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCleanupPaused(false);
                    setPausedSnapshot(null);
                    setActiveTrashCategoryFilter('duplicate');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-200 font-label-sm text-[12px] font-bold cursor-pointer"
                >
                  📸 중복·연사만 보기 ({activeDuplicateGroups.length}묶음) ▼
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCleanupPaused(false);
                    setPausedSnapshot(null);
                    setActiveTrashCategoryFilter('all');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-primary-container text-zinc-950 font-label-sm text-[12px] font-extrabold cursor-pointer"
                >
                  📋 전체 후보 보기 ({liveActiveTrash.length}장) ▼
                </button>
              </div>
            </div>
          )}

          {/* 3-A. ① 중복 사진 & 연사 묶음 1세트씩 순차 확인 및 유저 [OK] 승인 (currentTab === 'duplicate'일 때만 순수 표시) */}
          {showDuplicatePickSection && (
            <div className="p-3.5 sm:p-5 md:p-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-4">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 border-b border-white/10 pb-3.5">
                <div className="flex flex-col gap-2 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-headline-sm text-[17px] md:text-[18.5px] text-white font-extrabold break-keep">
                      ① 중복 사진 &amp; 연사 묶음 (세트별 실사진 확인 · 유저 OK 승인)
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-md bg-zinc-900 border border-white/10 text-primary-container font-label-sm text-[12.5px] font-bold whitespace-nowrap shrink-0">
                      {activeDuplicateGroups.length > 0
                        ? `총 ${activeDuplicateGroups.length}세트 발견 · 버릴 후보 ${dupCount}장`
                        : '0세트 (깨끗함)'}
                    </span>
                  </div>
                  {activeDuplicateGroups.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[12px] font-extrabold text-teal-300 whitespace-nowrap mr-0.5">
                          📸 세트 바로가기:
                        </span>
                        {activeDuplicateGroups.slice(0, 6).map((g, idx) => {
                          const cnt = g.photoIds.filter((id) => {
                            const ph = photoById.get(id);
                            return ph && !ph.quarantined;
                          }).length;
                          const isCurSet =
                            !showAllDupSets &&
                            Math.min(activeDupSetIdx, activeDuplicateGroups.length - 1) === idx;
                          return (
                            <button
                              key={g.groupId}
                              type="button"
                              onClick={() => {
                                setShowAllDupSets(false);
                                setActiveDupSetIdx(idx);
                              }}
                              className={`px-2 py-0.5 rounded-lg border text-[11.5px] font-bold whitespace-nowrap transition cursor-pointer ${
                                isCurSet
                                  ? 'bg-primary-container text-zinc-950 border-primary-container font-black'
                                  : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-white/15'
                              }`}
                            >
                              {idx + 1}세트 ({cnt}장)
                            </button>
                          );
                        })}
                        {activeDuplicateGroups.length > 6 && (
                          <button
                            type="button"
                            onClick={() => setShowAllDupSets((v) => !v)}
                            className="px-2.5 py-0.5 rounded-lg bg-teal-950/70 hover:bg-teal-900/80 border border-teal-400/40 text-teal-200 text-[11.5px] font-extrabold whitespace-nowrap cursor-pointer transition"
                          >
                            {showAllDupSets
                              ? '접기 ▲'
                              : `+외 ${activeDuplicateGroups.length - 6}세트 더 보기`}
                          </button>
                        )}
                      </div>
                      <p className="font-body-sm text-[12.5px] text-zinc-300 leading-relaxed break-keep">
                        한 세트씩 실사진과 <span className="text-primary-container font-bold">👑 추천 베스트 1장</span>을 확인하시고 <span className="text-white font-bold">[👍 OK]</span>를 눌러 정리해 주세요!
                      </p>
                    </div>
                  ) : (
                    <p className="font-body-sm text-[13px] text-zinc-400 break-keep">
                      AI가 마음대로 사진을 지우지 않으며, 실사진을 보여드리고 직접 OK 하실 때만 정리합니다.
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0 self-start">
                  {activeDuplicateGroups.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setShowAllDupSets((v) => !v)}
                      className="px-3.5 py-2 rounded-xl font-label-sm text-[12px] font-extrabold border bg-zinc-900 text-teal-300 hover:text-white border-teal-500/40 transition-all cursor-pointer whitespace-nowrap shrink-0"
                    >
                      {showAllDupSets
                        ? '🎯 1세트씩 순서대로 보기'
                        : `📋 전체 ${activeDuplicateGroups.length}세트 한눈에 펼치기`}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveTrashCategoryFilter('none')}
                    className="px-3.5 py-2 rounded-xl font-label-sm text-[12px] font-bold border bg-zinc-900 text-zinc-400 hover:text-white border-white/10 transition-all cursor-pointer whitespace-nowrap shrink-0"
                  >
                    목록 접기 ▲
                  </button>
                </div>
              </div>

              {activeDuplicateGroups.length > 0 ? (
                <div className="flex flex-col gap-4">
                  {(showAllDupSets
                    ? activeDuplicateGroups.map((g, idx) => ({ group: g, gIdx: idx }))
                    : [
                        {
                          group:
                            activeDuplicateGroups[
                              Math.min(activeDupSetIdx, activeDuplicateGroups.length - 1)
                            ],
                          gIdx: Math.min(activeDupSetIdx, activeDuplicateGroups.length - 1),
                        },
                      ]
                  ).map(({ group, gIdx }) => {
                    const groupPhotos = group.photoIds
                      .map((id) => photoById.get(id))
                      .filter((p): p is NonNullable<typeof p> => Boolean(p && !p.quarantined));

                    const redundantCount = groupPhotos.filter((p) => p.id !== group.bestPhotoId).length;
                    const repPhoto = groupPhotos[0];
                    const sceneLabel =
                      repPhoto?.tags.find((t) => !t.includes('연사') && !t.includes('원본')) || '#연사묶음';

                    return (
                      <div
                        key={group.groupId}
                        className="p-4 sm:p-5 rounded-2xl bg-zinc-950/85 border-2 border-teal-500/40 flex flex-col gap-3.5 shadow-md"
                      >
                        {/* 세트 상단 귀신비서 추천 질문 & 유저 OK / 건너뛰기 결정 바 */}
                        <div className="p-3.5 rounded-xl bg-teal-950/50 border border-teal-400/40 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                          <div className="flex flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="px-2.5 py-0.5 rounded-full bg-primary-container text-zinc-950 font-label-sm text-[11.5px] font-black">
                                세트 {gIdx + 1} / {activeDuplicateGroups.length} (총 {groupPhotos.length}장)
                              </span>
                              <span className="px-2 py-0.5 rounded bg-zinc-900 border border-white/10 text-zinc-300 font-label-sm text-[11px] font-medium">
                                {sceneLabel}
                              </span>
                            </div>
                            <p className="text-[13.5px] sm:text-[14px] text-white font-extrabold leading-snug break-keep">
                              🤖 귀신비서 추천: 이 세트({groupPhotos.length}장)에서 가장 잘 나온{' '}
                              <span className="text-primary-container">[👑 추천 베스트 1장]</span>만 남기고, 나머지{' '}
                              <span className="text-amber-300">{redundantCount}장은 휴지통으로 이동할까요?</span>
                            </p>
                            <span className="text-[11.5px] text-zinc-300 break-keep">
                              {isStoreAppMode || layout === 'mobile'
                                ? !zCoreBridge.isConnected && isCapacitorIosRuntime()
                                  ? '🗑️ [OK]를 누르면 시스템 확인창을 거쳐 아이폰 『사진 ➔ 최근 삭제된 항목』(30일 보관)으로 이동하며, 그곳에서 FaceID로 언제든 원본 복원할 수 있어요.'
                                  : '🗑️ [OK]를 누르면 시스템 확인창을 거쳐 내 폰 갤러리(구글 포토) 실제 휴지통(30일 보관)으로 이동하며, 아래쪽 [↩️ 정리한 사진 복원]에서 언제든 되돌릴 수 있어요.'
                                : '💡 다른 사진을 남기고 싶다면 아래 실사진 중 원하는 사진을 먼저 터치해 👑 베스트 1장을 바꾼 뒤 [OK]를 눌러주세요.'}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                            {!showAllDupSets && activeDuplicateGroups.length > 1 && (
                              <div className="flex items-center gap-1 mr-1">
                                <button
                                  type="button"
                                  disabled={gIdx <= 0}
                                  onClick={() => setActiveDupSetIdx((prev) => Math.max(0, prev - 1))}
                                  className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-200 text-[11.5px] font-bold disabled:opacity-40 cursor-pointer"
                                >
                                  ◀ 이전 세트
                                </button>
                                <button
                                  type="button"
                                  disabled={gIdx >= activeDuplicateGroups.length - 1}
                                  onClick={() =>
                                    setActiveDupSetIdx((prev) =>
                                      Math.min(activeDuplicateGroups.length - 1, prev + 1)
                                    )
                                  }
                                  className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-200 text-[11.5px] font-bold disabled:opacity-40 cursor-pointer"
                                >
                                  다음 세트 ▶
                                </button>
                              </div>
                            )}

                            <button
                              type="button"
                              disabled={quarantineMoving}
                              onClick={() =>
                                void pickBestInDuplicateGroup(group.groupId, group.bestPhotoId, true)
                              }
                              className="w-full sm:w-auto max-w-full px-3.5 py-2.5 rounded-xl bg-primary-container hover:opacity-95 text-zinc-950 font-label-sm text-[12px] sm:text-[12.5px] font-black shadow-sm transition-all flex items-center justify-center gap-1.5 whitespace-normal break-keep text-center leading-snug cursor-pointer"
                            >
                              <span>👍 OK! 베스트 1장만 남기고 나머지 {redundantCount}장 휴지통으로 이동</span>
                            </button>

                            <button
                              type="button"
                              disabled={quarantineMoving}
                              onClick={() => {
                                setSkippedGroupIds((prev) => {
                                  const next = new Set(prev);
                                  next.add(group.groupId);
                                  return next;
                                });
                              }}
                              className="w-full sm:w-auto px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-300 font-label-sm text-[12px] font-bold transition-all text-center justify-center cursor-pointer"
                            >
                              ⏭️ 이 세트는 안 버리고 건너뛰기
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                          {groupPhotos.map((ph, idx) => {
                            const isBestOriginal = ph.id === group.bestPhotoId;
                            return (
                              <div
                                key={ph.id}
                                onClick={() =>
                                  void pickBestInDuplicateGroup(group.groupId, ph.id, false)
                                }
                                className={`group/card relative aspect-[4/5] rounded-xl overflow-hidden cursor-pointer transition-all ${
                                  isBestOriginal
                                    ? 'ring-3 ring-primary-container border-2 border-primary-container shadow-lg'
                                    : 'border border-white/15 opacity-90 hover:opacity-100 hover:border-white/40'
                                }`}
                              >
                                <img
                                  src={ph.thumbUrl}
                                  alt={ph.name}
                                  loading="lazy"
                                  className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-300"
                                />

                                {isBestOriginal ? (
                                  <div className="absolute top-2 left-2 right-2 px-2 py-1 rounded-lg bg-zinc-950/90 backdrop-blur-md border border-primary-container text-primary-container font-label-sm text-[10.5px] sm:text-[11px] font-black flex items-center justify-center text-center break-keep leading-tight">
                                    <span>👑 AI 추천 베스트 1장 (보존)</span>
                                  </div>
                                ) : (
                                  <div className="absolute top-2 left-2 right-2 px-2 py-1 rounded-lg bg-zinc-950/85 backdrop-blur-md border border-amber-400/40 text-amber-200 font-label-sm text-[10.5px] sm:text-[11px] font-bold flex items-center justify-center text-center break-keep leading-tight">
                                    <span>{`🗑️ 버릴 후보 #${idx + 1} · 터치 시 보존`}</span>
                                  </div>
                                )}

                                <div className="absolute inset-x-0 bottom-0 px-2.5 py-1.5 bg-gradient-to-t from-black/90 via-black/60 to-transparent flex items-center justify-between">
                                  <span className="text-[10.5px] text-zinc-200 font-medium truncate pr-6">
                                    {ph.name}
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedPhoto(ph, groupPhotos);
                                  }}
                                  title="실사진 크게 비교 보기"
                                  className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-black/80 hover:bg-primary-container text-white hover:text-zinc-950 flex items-center justify-center transition-colors z-10 cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[16px]">zoom_in</span>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 sm:p-8 rounded-xl bg-zinc-950/60 border border-white/5 text-center flex flex-col items-center gap-2.5">
                  <span className="material-symbols-outlined text-primary-container text-[32px]">
                    {displayPhotos.length === 0 && (isStoreAppMode || layout === 'mobile')
                      ? 'add_photo_alternate'
                      : 'verified'}
                  </span>
                  <span className="font-headline-sm text-[15px] sm:text-[15.5px] text-white font-extrabold break-keep">
                    {displayPhotos.length === 0 && (isStoreAppMode || layout === 'mobile')
                      ? mobileGalleryScanning
                        ? '🔄 내 폰 사진·동영상 자동 인덱싱 중이에요!'
                        : mobileGalleryPermissionDenied
                        ? '⚙️ 스마트폰 사진·동영상 접근 권한 허용이 필요해요!'
                        : '✨ 내 스마트폰 사진첩에 정리할 사진이 없어요!'
                      : '✨ 중복되거나 연속으로 찍힌 사진 묶음이 0세트예요!'}
                  </span>
                  <span className="font-body-sm text-[12.5px] sm:text-[13px] text-zinc-400 break-keep">
                    {displayPhotos.length === 0 && (isStoreAppMode || layout === 'mobile')
                      ? mobileGalleryScanning
                        ? '내 폰 사진첩을 자동으로 인덱싱하고 있어요. 잠시만 기다려 주세요!'
                        : mobileGalleryPermissionDenied
                        ? '스마트폰 사진 접근 권한을 허용해 주시면 중복·연사 세트와 흐린 사진을 자동으로 골라 보여드려요!'
                        : '버릴 중복·연사 사진 없이 현재 아주 깨끗한 상태입니다.'
                      : '버릴 중복·연사 사진 없이 현재 아주 깨끗한 상태입니다.'}
                  </span>
                  {displayPhotos.length === 0 &&
                    isCapacitorNativeMobileRuntime() &&
                    !mobileGalleryScanning && (
                      <button
                        type="button"
                        onClick={() =>
                          mobileGalleryPermissionDenied
                            ? void openNativeAppPermissionSettings()
                            : void syncMobileNativeGalleryAuto({ promptPermission: true })
                        }
                        className="mt-1 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-[12.5px] font-extrabold shadow-sm cursor-pointer"
                      >
                        {mobileGalleryPermissionDenied ? '⚙️ 사진 접근 권한 허용하기' : '🔄 사진첩 자동 동기화 확인'}
                      </button>
                    )}
                  {skippedGroupIds.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setSkippedGroupIds(new Set())}
                      className="mt-2 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-teal-300 text-[12px] font-bold cursor-pointer"
                    >
                      🔄 건너뛴 세트({skippedGroupIds.size}개) 다시 보기
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 3-B. 탭 ②·③·④ (메모·영수증 / 스크린샷 / 흔들린 사진) 실사진 확인 및 유저 [OK] 승인 그리드 */}
          {currentTab !== 'duplicate' && currentTab !== 'none' && (
            <section className="p-3.5 sm:p-5 md:p-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-headline-sm text-[16.5px] text-white font-bold">
                    {TRASH_TABS_4.find((t) => t.key === currentTab)?.title ||
                      '📋 전체 정리 후보 사진 (① 중복·연사 + ② 메모·영수증 + ③ 캡처 + ④ 흔들림)'}
                  </h2>
                  <span className="px-2 py-0.5 rounded-md bg-zinc-900 border border-white/10 text-primary-container font-label-sm text-[11.5px] font-bold">
                    {isShowingSamplePreview
                      ? `예시 샘플 ${filteredCandidates.length}장 (내 기기 감지 0장)`
                      : filteredCandidates.length > 0
                      ? `발견된 후보 ${filteredCandidates.length}장`
                      : '0장 (깨끗함)'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTrashCategoryFilter('duplicate')}
                    className="px-3 py-1.5 rounded-xl font-label-sm text-[11.5px] font-bold border bg-zinc-900 text-zinc-300 hover:text-white border-white/10 transition-all cursor-pointer"
                  >
                    중복·연사 세트 보기 ({activeDuplicateGroups.length}세트)
                  </button>
                  {!isShowingSamplePreview && realFilteredCandidates.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={selectAllTrashInFilter}
                        className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-200 font-label-sm text-[12px] font-medium cursor-pointer"
                      >
                        전체 선택
                      </button>
                      <button
                        type="button"
                        onClick={clearTrashSelection}
                        className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-400 font-label-sm text-[12px] cursor-pointer"
                      >
                        선택 해제
                      </button>
                      <button
                        type="button"
                        disabled={activeSelectedPhotos.length === 0 || quarantineMoving}
                        onClick={() => void moveSelectedToQuarantine()}
                        className="px-4 py-1.5 rounded-xl bg-primary-container text-zinc-950 font-label-sm text-[12.5px] font-black disabled:opacity-40 cursor-pointer shadow-sm"
                      >
                        👍 OK! 선택한 {activeSelectedPhotos.length}장 ({fmtMB(selectedBytes)}) 버리기
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveTrashCategoryFilter('none')}
                    className="px-3 py-1.5 rounded-xl font-label-sm text-[11.5px] font-bold border bg-zinc-900 text-zinc-400 hover:text-white border-white/10 transition-all cursor-pointer"
                  >
                    목록 접기 ▲
                  </button>
                </div>
              </div>

              {!isShowingSamplePreview && realFilteredCandidates.length > 0 && (
                <div className="p-3.5 rounded-xl bg-teal-950/45 border border-teal-400/40 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[13px] sm:text-[13.5px] text-white font-extrabold break-keep">
                    {currentTab === 'blurry'
                      ? `🤖 귀신비서 추천: 흔들리거나 초점이 나간 흐린 사진 ${realFilteredCandidates.length}장이 발견되었어요. 아래 실사진들을 직접 보시고 버리는 것에 동의하시면 우측 [👍 OK! 선택한 ${activeSelectedPhotos.length}장 버리기]를 눌러주세요!`
                      : currentTab === 'memo'
                      ? `🤖 귀신비서 추천: 일회성 메모·영수증 사진 ${realFilteredCandidates.length}장이 발견되었어요. 아래 실사진들을 보시고 버릴 사진만 체크해 [👍 OK! 선택한 ${activeSelectedPhotos.length}장 버리기]를 눌러주세요!`
                      : `🤖 귀신비서 추천: 화면 캡처(스크린샷) 사진 ${realFilteredCandidates.length}장이 발견되었어요. 아래 실사진들을 보시고 버릴 사진만 체크해 [👍 OK! 선택한 ${activeSelectedPhotos.length}장 버리기]를 눌러주세요!`}
                  </span>
                </div>
              )}

              {filteredCandidates.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
                  {filteredCandidates.map((photo) => {
                    const isChecked = selectedTrashIds.has(photo.id);
                    const tabMeta =
                      TRASH_TABS_4.find((t) => matchesTrashTab(photo, t.key)) || TRASH_TABS_4[1];

                    return (
                      <div
                        key={photo.id}
                        onClick={() => setSelectedPhoto(photo, filteredCandidates)}
                        className={`group relative rounded-xl overflow-hidden bg-zinc-950 transition-all cursor-pointer border ${
                          isChecked
                            ? 'border-primary-container ring-1 ring-primary-container'
                            : 'border-white/10 opacity-90 hover:opacity-100'
                        }`}
                      >
                        <div className="relative aspect-[4/5] w-full overflow-hidden bg-zinc-950">
                          <img
                            src={photo.thumbUrl}
                            alt={photo.name}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />

                          <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-zinc-950/85 backdrop-blur-md border border-white/15">
                            <span className="font-label-sm text-[10.5px] font-semibold text-zinc-200">
                              {isShowingSamplePreview
                                ? `${tabMeta.shortBadge} (예시 샘플)`
                                : tabMeta.shortBadge}
                            </span>
                          </div>

                          {!isShowingSamplePreview && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleTrashSelection(photo.id);
                              }}
                              title={isChecked ? '선택 해제' : '버릴 대상 선택'}
                              className={`absolute top-2 right-2 w-7 h-7 rounded-md flex items-center justify-center transition-colors z-10 cursor-pointer ${
                                isChecked
                                  ? 'bg-primary-container text-zinc-950 font-bold shadow-sm'
                                  : 'bg-black/65 hover:bg-black/85 border border-white/25 text-white/40 hover:text-white'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[16px]">check</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPhoto(photo, filteredCandidates);
                            }}
                            title="실사진 크게 보기"
                            className="absolute bottom-2.5 right-2.5 w-7 h-7 rounded-full bg-black/75 hover:bg-primary-container text-white hover:text-zinc-950 flex items-center justify-center transition-colors z-10 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[15px]">zoom_in</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 sm:p-8 rounded-xl bg-zinc-950/60 border border-white/5 text-center flex flex-col items-center gap-2.5">
                  <span className="material-symbols-outlined text-primary-container text-[32px]">
                    {displayPhotos.length === 0 && (isStoreAppMode || layout === 'mobile')
                      ? 'add_photo_alternate'
                      : 'verified'}
                  </span>
                  <span className="font-headline-sm text-[15px] sm:text-[15.5px] text-white font-extrabold break-keep">
                    {displayPhotos.length === 0 && (isStoreAppMode || layout === 'mobile')
                      ? '📱 아직 내 폰 사진을 불러오지 않았어요!'
                      : currentTab === 'blurry'
                      ? '✨ 흔들리거나 초점이 나간 흐린 사진이 0장이에요!'
                      : currentTab === 'memo'
                      ? '✨ 정리할 일회성 메모·영수증 사진이 0장이에요!'
                      : currentTab === 'screenshot'
                      ? '✨ 정리할 화면 캡처(스크린샷) 사진이 0장이에요!'
                      : '✨ 현재 이 카테고리에 정리할 사진이 없습니다 (0장)'}
                  </span>
                  <span className="font-body-sm text-[12.5px] sm:text-[13px] text-zinc-400 break-keep">
                    {displayPhotos.length === 0 && (isStoreAppMode || layout === 'mobile')
                      ? mobileGalleryScanning
                        ? '내 폰 사진첩을 자동으로 인덱싱하고 있어요. 잠시만 기다려 주세요!'
                        : mobileGalleryPermissionDenied
                        ? '스마트폰 사진 접근 권한을 허용해 주시면 메모·영수증·캡처·흐린 사진을 자동으로 분류해 보여드려요!'
                        : '버릴 사진 없이 현재 아주 깨끗한 상태입니다.'
                      : '버릴 사진 없이 현재 아주 깨끗한 상태입니다.'}
                  </span>
                  {displayPhotos.length === 0 &&
                    isCapacitorNativeMobileRuntime() &&
                    !mobileGalleryScanning && (
                      <button
                        type="button"
                        onClick={() =>
                          mobileGalleryPermissionDenied
                            ? void openNativeAppPermissionSettings()
                            : void syncMobileNativeGalleryAuto({ promptPermission: true })
                        }
                        className="mt-1 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-[12.5px] font-extrabold shadow-sm cursor-pointer"
                      >
                        {mobileGalleryPermissionDenied ? '⚙️ 사진 접근 권한 허용하기' : '🔄 사진첩 자동 동기화 확인'}
                      </button>
                    )}
                </div>
              )}
            </section>
          )}

          {/* 3-C. 화면 아래쪽 [↩️ 정리한 사진 복원 / 아이폰 최근 삭제된 항목 안내] — 중복·연사 세트별 정리 화면보다 아래쪽에 배치 */}
          {(quarantinedPhotos.length > 0 || lastUndoBatch) && (() => {
            const isIosNativeTrash = !zCoreBridge.isConnected && isCapacitorIosRuntime();
            return (
              <section
                id="ghosti-quarantine-restore-section"
                className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#18181B] border border-teal-300 dark:border-emerald-500/35 shadow-sm flex flex-col gap-3"
              >
                {lastUndoBatch && !isIosNativeTrash && (
                  <div className="p-3.5 rounded-xl bg-teal-50/70 dark:bg-zinc-900 border border-teal-300 dark:border-primary-container/60 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-teal-700 dark:text-primary-container text-[20px] shrink-0">
                        history
                      </span>
                      <span className="font-label-md text-[13px] text-slate-900 dark:text-zinc-100 font-semibold break-keep">
                        {`방금 정리한 ${lastUndoBatch.count}장 (${fmtMB(lastUndoBatch.savedBytes)})이 휴지통(정리 보관함)으로 안전하게 이동되었습니다.`}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={quarantineMoving}
                        onClick={() => void undoLastQuarantine()}
                        className="px-3.5 py-1.5 rounded-lg bg-primary-container text-zinc-950 font-label-sm text-[12px] font-extrabold transition-all cursor-pointer disabled:opacity-40"
                      >
                        ↩️ 1초 즉시 되돌리기 (Undo)
                      </button>
                      <button
                        type="button"
                        onClick={dismissUndoBatch}
                        className="p-1 text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white cursor-pointer"
                        title="닫기"
                      >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                      </button>
                    </div>
                  </div>
                )}

                {isIosNativeTrash && quarantinedPhotos.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-teal-50 dark:bg-zinc-900 border border-teal-300 dark:border-teal-400/40 flex items-start gap-2.5">
                    <span className="material-symbols-outlined text-teal-700 dark:text-teal-300 text-[19px] shrink-0 mt-0.5">
                      lock
                    </span>
                    <p className="text-[12.5px] text-slate-900 dark:text-zinc-100 font-bold leading-relaxed break-keep">
                      아이폰은 애플 FaceID 보안 정책에 따라 『사진 ➔ 최근 삭제된 항목』에 30일간 안전 보관되며, 그곳에서 원본 그대로 복원할 수 있습니다.
                    </p>
                  </div>
                )}

                {quarantinedPhotos.length > 0 && (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setShowQuarantineDrawer((v) => !v)}
                        className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-zinc-100 font-label-sm text-[12.5px] font-extrabold flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <span className="text-left break-keep">
                          {isIosNativeTrash
                            ? `🗂️ 최근 정리 내역 (${quarantinedPhotos.length}장 · 30일 보관)`
                            : `↩️ 정리한 사진 복원 (${quarantinedPhotos.length}장)`}
                        </span>
                        <span className="text-teal-700 dark:text-emerald-300 text-[11.5px] font-black shrink-0 whitespace-nowrap">
                          {showQuarantineDrawer ? '접기 ▲' : '펼치기 ▼'}
                        </span>
                      </button>
                      {showQuarantineDrawer && !isIosNativeTrash && (
                        <button
                          type="button"
                          disabled={quarantineMoving}
                          onClick={() =>
                            void restoreFromQuarantine(quarantinedPhotos.map((p) => p.id))
                          }
                          className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-label-sm text-[12px] font-extrabold cursor-pointer disabled:opacity-40 shadow-xs"
                        >
                          ♻️ {quarantinedPhotos.length}장 전체 원위치 복원
                        </button>
                      )}
                    </div>

                    {showQuarantineDrawer && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-zinc-950/80 border border-slate-200 dark:border-white/10 max-h-64 overflow-y-auto">
                        {quarantinedPhotos.map((qp) => (
                          <div
                            key={qp.id}
                            className="p-2.5 rounded-lg bg-white dark:bg-zinc-900/90 border border-slate-200 dark:border-white/10 flex items-center justify-between gap-2.5"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <img
                                src={qp.thumbUrl}
                                alt=""
                                loading="lazy"
                                className="w-10 h-10 rounded-md object-cover border border-slate-200 dark:border-white/10 shrink-0 bg-slate-200 dark:bg-zinc-800"
                              />
                              <span className="text-[11.5px] text-slate-900 dark:text-zinc-200 font-semibold break-all leading-snug">
                                {qp.name}
                              </span>
                            </div>
                            {isIosNativeTrash ? (
                              <span className="px-2 py-1 rounded-md bg-teal-100 dark:bg-zinc-800 text-teal-900 dark:text-teal-300 border border-teal-300 dark:border-teal-500/30 text-[10.5px] font-bold shrink-0 whitespace-nowrap">
                                30일 보관됨
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={quarantineMoving}
                                onClick={() => void restoreFromQuarantine([qp.id])}
                                className="px-2.5 py-1.5 rounded-md bg-emerald-500/20 hover:bg-emerald-500 text-emerald-800 dark:text-emerald-300 hover:text-zinc-950 border border-emerald-500/40 text-[11px] font-extrabold shrink-0 cursor-pointer transition-colors"
                              >
                                복원
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </section>
            );
          })()}

        </GhostSecretaryFirstGuard>

        {/* ═══════════════ [우측 열] 귀신비서 전용 대화방 (PC에서는 좌측 메인 화면과 뚜렷이 구분되는 카톡형 채팅방 프레임) ═══════════════ */}
        <div className="order-first xl:order-none xl:col-span-5 2xl:col-span-4 xl:sticky xl:top-20 xl:pl-4 xl:border-l-2 xl:border-teal-500/25">
          <MonsterStandardChatColumn
            sourceTab="trash"
            externalQueryTrigger={externalQueryTrigger}
            showWelcomeQuickCareActions={true}
            onHealthRecordAdded={() => {}}
            onTriggerOsRepair={(symptomQuery) => {
              void useSaySeeStore.getState().submitSetupMonsterQuery(symptomQuery);
              useSaySeeStore.getState().setShowSetupMonsterModal(true, layout === 'mobile' ? 'mobile' : 'pc');
            }}
            onJumpToSearch={(kw) => {
              if (layout === 'mobile') {
                setMobileTab('search');
                const cleanKw = kw.trim();
                if (cleanKw) {
                  void runTextQuery(cleanKw).then(() => {
                    window.setTimeout(() => {
                      document
                        .getElementById('ghosti-search-results')
                        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 80);
                  });
                } else {
                  window.setTimeout(() => {
                    const searchInput = document.getElementById(
                      'ghosti-voice-hero-search-input'
                    ) as HTMLInputElement | null;
                    searchInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    searchInput?.focus();
                  }, 120);
                }
                return;
              }
              // [v1.3] 웹 검색창 폐지 이후: 귀신비서가 찾아준 검색어는 『👻 귀신검색』 화면의 귀신검색창(기존 찾기 화면)으로 결과를 띄움
              try {
                sessionStorage.setItem('ghosti_pending_ghost_search_query', kw);
              } catch {
                /* ignore */
              }
              setDesktopTab('dashboard');
              void runTextQuery(kw);
            }}
            onToast={(msg) => useSaySeeStore.setState({ lastQuarantineToast: msg })}
          />
        </div>
      </div>
    </div>
  );
};
