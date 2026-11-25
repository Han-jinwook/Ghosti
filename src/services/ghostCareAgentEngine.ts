/**
 * ❖ 귀신비서(1귀신) '제미니 에이전트 자유 문답 + 다중 취사선택 PC 정리' 전용 엔진
 * - 2026-11-24 Ghosti × MerlinHub 최종 합의 5대 기둥 완벽 구현:
 *   1) Read-Only 조회 도구(disk_hog_scan, security_2tier_scan, desktop_detail_scan, installed_apps_list) 1턴 병렬 즉시 실행
 *   2) 직전 스캔 원장(lastCareScanContext)을 60개·5개 압축 키({no, id, name, cat, mb})로 경량 직렬화해 Gemini 2.5 Flash에 주입
 *   3) 멀티턴 취사선택·제외 필터("예스파일·오캠 빼고 다 지워", "4번이랑 카톡은 놔두고 정리해")를 파싱해
 *      [🟢 보존 확정(제외) vs 🔴 실행 대상 N건 (휴지통 안전 보관)] 체크박스 요약 카드 1회 확인 후 배치 실행
 *   4) 휴지통 비우기 전/후 용량 병기 UX + D: 드라이브 1초 안전 이사 + WD 시스템 아이콘 안전 숨김 + 데스크톱 배터리 가드
 */

import { getZCoreUrl } from './zCoreBridge';

export type AgentCareReadTool =
  | 'disk_hog_scan'
  | 'security_2tier_scan'
  | 'desktop_detail_scan'
  | 'installed_apps_list'
  | 'hidden_rats_scan';

export type AgentCareMutatingAction =
  | 'disk_hog_clean'
  | 'batch_deep_uninstall'
  | 'desktop_batch_action'
  | 'security_2tier_apply'
  | 'desktop_system_icon_toggle'
  | 'desktop_power_boost'
  | 'hidden_rats_apply';

export interface AgentCareScanItem {
  no: number;
  id: string;
  name: string;
  cat: string;
  sizeMb: number;
  detailKo?: string;
  /** 초보자 눈높이 1줄 설명 ("이게 뭐 하는 프로그램인지 / 지워도 안전한지") */
  plainExplainKo?: string;
  /** 안전도 배지 ('DANGER_DELETE' | 'SAFE_DELETE' | 'SAFE_CLEAN' | 'SLEEP_RECOMMEND' | 'USER_CHECK') */
  safetyBadge?: 'DANGER_DELETE' | 'SAFE_DELETE' | 'SAFE_CLEAN' | 'SLEEP_RECOMMEND' | 'USER_CHECK';
  safetyBadgeLabel?: string;
  path?: string;
  actionType?: string;
  ratKind?: 'SCHEDULED_TASK' | 'WINDOWS_SERVICE' | 'STARTUP_ITEM' | 'HIGH_MEM_PROCESS';
  targetKey?: string;
  executePath?: string;
  arguments?: string;
  publisher?: string;
  movableToOtherDrive?: boolean;
  defaultSelected?: boolean;
  isProtected?: boolean;
}

export interface AgentCareScanContext {
  updatedAt: number;
  scanKind: 'DISK_HOG' | 'SECURITY_2TIER' | 'DESKTOP_DETAIL' | 'INSTALLED_APPS' | 'HIDDEN_RATS' | 'MULTI';
  cDriveFreeGb?: number;
  cDriveTotalGb?: number;
  cDriveUsedPct?: number;
  availableMoveDrives?: Array<{ drive: string; freeGb: number }>;
  isDesktop?: boolean;
  powerPlanName?: string;
  isHighPerformance?: boolean;
  visibleSystemIcons?: Array<{ iconId: string; label: string; safeExplanationKo: string }>;
  items: AgentCareScanItem[];
}

export interface MonsterAgentCareCardPayload {
  mode: 'SCAN_REPORT' | 'CONFIRM_BATCH';
  title: string;
  badgeText: string;
  summaryLines: string[];
  action: AgentCareMutatingAction;
  items: AgentCareScanItem[];
  selectedIds: string[];
  excludedNames: string[];
  moveDestinationDrive?: string;
  availableMoveDrives?: Array<{ drive: string; freeGb: number }>;
  visibleSystemIcons?: Array<{ iconId: string; label: string; safeExplanationKo: string }>;
  currentFreeGb?: number;
  projectedFreeAfterEmptyGb?: number;
  isDesktop?: boolean;
  isHighPerformance?: boolean;
  executed?: boolean;
  executionReportKo?: string;
  approvedTypedText?: string;
}

export interface AgentCareLlmPlan {
  replyKo: string;
  readTools: AgentCareReadTool[];
  mutatingPlan?: {
    action: AgentCareMutatingAction;
    includeIds: string[];
    excludeIds: string[];
    excludeKeywords?: string[];
    moveDestinationDrive?: string;
    hideSystemIconIds?: string[];
    reasonSummaryKo?: string;
  } | null;
  followUpSuggestions: string[];
}

// 모듈 전역 직전 스캔 컨텍스트 원장 (멀티턴 문답에서 번호·ID 1:1 바인딩 SSOT)
let lastCareScanContext: AgentCareScanContext | null = null;

export function getLastCareScanContext(): AgentCareScanContext | null {
  return lastCareScanContext;
}

export function clearLastCareScanContext(): void {
  lastCareScanContext = null;
}

/**
 * 🌟 [초보자 눈높이 1줄 번역 사전 — 고클린과의 결정적 차별화]
 * 영문 프로그램명·프로세스명만 나열하면 일반 유저가 멘붕하므로,
 * 모든 스캔 항목에 "이게 뭐 하는 프로그램인지 + 지워도 되는지" 쉬운 한글 설명과 안전도 배지를 자동 부착합니다.
 */
export function explainCareItemForBeginner(item: {
  id: string;
  name: string;
  cat: string;
  sizeMb?: number;
  actionType?: string;
  isProtected?: boolean;
}): {
  safetyBadge: NonNullable<AgentCareScanItem['safetyBadge']>;
  safetyBadgeLabel: string;
  plainExplainKo: string;
} {
  const comb = `${item.id} ${item.name} ${item.cat}`.toLowerCase();

  if (item.isProtected) {
    return {
      safetyBadge: 'USER_CHECK',
      safetyBadgeLabel: '🛡️ 자동 보호',
      plainExplainKo: '컴퓨터·업무가 정상 작동하는 데 꼭 필요한 프로그램이라 실수로 지워지지 않게 보호 중이에요.',
    };
  }
  if (/datasharing|lockprofilecookie/.test(comb)) {
    return {
      safetyBadge: 'DANGER_DELETE',
      safetyBadgeLabel: '🚨 위험 · 꼭 삭제',
      plainExplainKo: '크롬 브라우저의 보안 잠금(쿠키 보호)을 몰래 풀어두는 위험한 예약 작업이에요. 바로 없애는 게 안전해요!',
    };
  }
  if (/cachecloud|cacheconsole|cloudtask|storageservice|pc\s*app\s*store|pcappstore|febjb|msload|ngplus|rayitem|toast|hancapture|zsi|zum|yoondisk|yondisk|natservice|clipdown|tabbie|utilzone/.test(comb)) {
    return {
      safetyBadge: 'SAFE_DELETE',
      safetyBadgeLabel: '🔴 100% 삭제 안전',
      plainExplainKo: '무료 프로그램 깔 때 몰래 따라 들어온 광고·속도 저하 앱이에요. 지워도 내 문서·업무에 아무 지장 없고 PC가 확 빨라져요!',
    };
  }
  if (/hiberfil/.test(comb)) {
    return {
      safetyBadge: 'SAFE_CLEAN',
      safetyBadgeLabel: '🟢 데스크톱 즉시 확보',
      plainExplainKo: '노트북 배터리 절전용 파일인데 데스크톱에선 쓸 일이 없어요. 끄시면 1초 만에 몇 GB가 바로 늘어나요!',
    };
  }
  if (/chrome_cache|edge_cache|whale_cache|브라우저\s*캐시/.test(comb)) {
    return {
      safetyBadge: 'SAFE_CLEAN',
      safetyBadgeLabel: '🟢 로그인 유지 · 안전 청소',
      plainExplainKo: '인터넷 보며 쌓인 임시 그림 찌꺼기만 비워요. 자동로그인·비밀번호·즐겨찾기는 절대 안 풀려요!',
    };
  }
  if (/kakao|카카오/.test(comb) && /캐시|cache|adfit/.test(comb)) {
    return {
      safetyBadge: 'SAFE_CLEAN',
      safetyBadgeLabel: '🟢 대화·사진 보호',
      plainExplainKo: '카카오톡 광고·임시 찌꺼기만 청소해요. 대화 내용과 카톡 받은 파일은 100% 그대로 보호됩니다!',
    };
  }
  if (/temp|npm|pnpm|yarn|pip|gradle|crashdump|video_stream_cache/.test(comb)) {
    return {
      safetyBadge: 'SAFE_CLEAN',
      safetyBadgeLabel: '🟢 100% 안전 청소',
      plainExplainKo: '작업 후 남은 임시 찌꺼기 파일이에요. 지워도 프로그램 실행에 전혀 문제가 없고 용량만 깔끔히 확보돼요!',
    };
  }
  if (/capcut|캡컷/.test(comb)) {
    if (/cache|렌더링/.test(comb)) {
      return {
        safetyBadge: 'SAFE_CLEAN',
        safetyBadgeLabel: '🟢 편집 원본 보호',
        plainExplainKo: '영상 편집 앱(CapCut)의 임시 캐시만 비워요. 작업 중인 영상 프로젝트는 그대로 남아요!',
      };
    }
    return {
      safetyBadge: 'USER_CHECK',
      safetyBadgeLabel: '🔎 확인 후 선택',
      plainExplainKo: '영상 편집 프로그램(CapCut)이에요. 10GB 가까이 크게 자리 잡으니 영상 편집을 안 하시면 지우는 게 용량에 큰 도움이 돼요!',
    };
  }
  if (/copilot/.test(comb)) {
    return {
      safetyBadge: 'SAFE_DELETE',
      safetyBadgeLabel: '🔴 메모리 600MB 회수',
      plainExplainKo: '윈도우 기본 AI 앱(Copilot)인데 안 써도 뒤에서 메모리를 600MB 넘게 먹고 있어요. 안 쓰시면 꺼두는 게 훨씬 쾌적해요!',
    };
  }
  if (/ocam|오캠/.test(comb)) {
    if (/task|스케줄러/.test(comb)) {
      return {
        safetyBadge: 'SAFE_DELETE',
        safetyBadgeLabel: '🔴 100% 꺼도 안전',
        plainExplainKo: '화면 녹화 프로그램(oCam)이 켤 때마다 몰래 띄우는 백그라운드 광고/점검 작업이에요. 꺼도 녹화 기능은 정상 작동해요!',
      };
    }
    return {
      safetyBadge: 'USER_CHECK',
      safetyBadgeLabel: '🔎 쓰시면 유지',
      plainExplainKo: 'PC 화면 녹화 프로그램(오캠)이에요. 평소 화면 녹화를 쓰시면 체크를 빼고 남겨두세요!',
    };
  }
  if (/scapture|s캡쳐/.test(comb)) {
    return {
      safetyBadge: 'USER_CHECK',
      safetyBadgeLabel: '🔎 쓰시면 유지',
      plainExplainKo: '화면 캡처 프로그램(SCapture)이에요. 평소 즐겨 쓰시면 놔두시고, 안 쓰시면 지우셔도 됩니다!',
    };
  }
  if (/고클린|goclean/.test(comb)) {
    return {
      safetyBadge: 'SAFE_DELETE',
      safetyBadgeLabel: '🔴 귀신비서로 대체됨',
      plainExplainKo: '구형 PC 정리 프로그램(고클린)이에요. 이제 광고 없는 귀신비서가 더 안전하게 대신하므로 지우셔도 됩니다!',
    };
  }
  if (/hp\s*print\s*scan|제품\s*개선|hpcust|hp\s*dropbox|hp\s*google/.test(comb)) {
    return {
      safetyBadge: 'SAFE_DELETE',
      safetyBadgeLabel: '🔴 인쇄 영향 없음',
      plainExplainKo: '프린터 본체 드라이버가 아니라 뒤에서 통계만 보내는 부가 프로그램이에요. 지워도 인쇄·스캔은 100% 그대로 됩니다!',
    };
  }
  if (/nprotect|ahnlab|astx|nossvc/.test(comb)) {
    return {
      safetyBadge: 'SAFE_DELETE',
      safetyBadgeLabel: '🟠 CPU 과점유 · 삭제 추천',
      plainExplainKo: '은행 보안 프로그램인데 끄지 못하게 잠겨 있어 평소에도 CPU를 많이 먹어요. 자주 안 쓰시면 지우시는 게 훨씬 빠르고, 나중에 은행 가면 자동 재설치돼요!',
    };
  }
  if (item.actionType === 'SECURITY_SLEEP' || /anysign|touchen|delfino|veraport|wizvera|crossex|iniline|ipinside|keysharp|magicline|crosscert|secukit/.test(comb)) {
    return {
      safetyBadge: 'SLEEP_RECOMMEND',
      safetyBadgeLabel: '🟡 안 지우고 재우기 추천',
      plainExplainKo: '은행·홈택스·민원 사이트용 보안 프로그램이에요. 지우면 다음에 또 깔아야 하니 평소엔 쿨쿨 재워두고 은행 갈 때만 자동으로 깨워드려요!',
    };
  }
  if (/miplatform|iformscan|inziiform|ozweb|ozx|aps\s*engine|yettiesoft|redbc|non-activex|e-pagesafer|markany/.test(comb)) {
    return {
      safetyBadge: 'SAFE_DELETE',
      safetyBadgeLabel: '🔴 구형 관공서 · 삭제 추천',
      plainExplainKo: '예전에 등기소·특허청·관공서 문서 출력할 때 깔린 구형 플러그인이에요. 요즘 안 들어가시면 지우셔도 전혀 문제없어요!',
    };
  }
  if (/곰플레이어|gom|팟인코더|샤나인코더|vrew|포토스케이프|photoscape|calibre|reflector/.test(comb)) {
    return {
      safetyBadge: 'USER_CHECK',
      safetyBadgeLabel: '🔎 안 쓰시면 삭제',
      plainExplainKo: '영상 재생·편집·사진 꾸미기용 유틸리티 앱이에요. 최근에 쓰신 적 없으면 체크해서 깔끔하게 지우셔도 됩니다!',
    };
  }
  if (/cursor|windsurf|postman|figma|antigravity/.test(comb)) {
    return {
      safetyBadge: 'USER_CHECK',
      safetyBadgeLabel: '🔎 업무용 확인',
      plainExplainKo: '개발·디자인 작업용 프로그램이에요. 직접 개발이나 디자인 작업을 하지 않으시면 지워도 업무에 지장 없어요!',
    };
  }
  if (item.cat === 'USER_FOLDER' || item.cat === 'USER_LARGE_ITEM' || item.cat.startsWith('DESKTOP_')) {
    return {
      safetyBadge: 'USER_CHECK',
      safetyBadgeLabel: '🔎 내용 확인 후 선택',
      plainExplainKo: '내 파일·폴더입니다. 지우기 아까운 대용량 자료라면 삭제 대신 여유 있는 D: 드라이브로 안전하게 이사할 수 있어요!',
    };
  }
  return {
    safetyBadge: 'USER_CHECK',
    safetyBadgeLabel: '🔎 확인 후 선택',
    plainExplainKo: '이 프로그램이 궁금하시면 오른쪽 [이게 뭐예요?]를 누르거나 채팅창에 번호를 물어보시면 친절히 설명해 드릴게요!',
  };
}

async function callCareApi<T = any>(
  path: string,
  body?: Record<string, unknown>,
  timeoutMs = 15000
): Promise<{ ok: boolean; data?: T; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(getZCoreUrl(path), {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json) {
      return { ok: false, error: `HTTP_${res.status}` };
    }
    return { ok: Boolean(json.ok), data: json as T, error: json.error };
  } catch (err: any) {
    return { ok: false, error: String(err?.message || err || 'NETWORK_ERROR') };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * [경량 직렬화] 허브 AI 게이트웨이 토큰·타임아웃 방어 (최대 60개 × 5키: {no, id, name, cat, mb})
 */
export function serializeCompactScanContext(ctx: AgentCareScanContext | null): string {
  if (!ctx || !ctx.items.length) return '';
  const compactItems = ctx.items.slice(0, 60).map((it) => ({
    no: it.no,
    id: it.id,
    name: it.name.slice(0, 48),
    cat: it.cat,
    mb: Math.round(it.sizeMb || 0),
  }));
  const header = [
    `[직전 PC 정밀 스캔 원장 (${ctx.scanKind} · 총 ${ctx.items.length}건)]`,
    ctx.cDriveFreeGb !== undefined
      ? `- C: 여유 ${ctx.cDriveFreeGb}GB / ${ctx.cDriveTotalGb ?? '?'}GB (사용률 ${ctx.cDriveUsedPct ?? '?'}%) | 데스크톱여부: ${ctx.isDesktop ? '데스크톱' : '노트북'} | 여유이사드라이브: ${(ctx.availableMoveDrives || []).map((d) => `${d.drive}(${d.freeGb}GB)`).join(', ') || '없음'}`
      : '',
    ctx.visibleSystemIcons && ctx.visibleSystemIcons.length > 0
      ? `- 바탕화면 표시 중인 특수 시스템 아이콘: ${ctx.visibleSystemIcons.map((i) => `${i.iconId}(${i.label})`).join(', ')}`
      : '',
    JSON.stringify(compactItems),
  ]
    .filter(Boolean)
    .join('\n');
  return header;
}

/**
 * 🧠 [2차 고도화 도구 2: 카탈로그에 없는 처음 보는 미등록 쥐새끼를 제미니가 서명사·경로·인자 보고 초보자 언어로 3단 자동 해석]
 */
async function enrichUnknownRatsWithGemini(unknownItems: AgentCareScanItem[]): Promise<void> {
  if (!unknownItems.length) return;
  const payload = unknownItems.slice(0, 25).map((it) => ({
    id: it.id,
    name: it.name,
    kind: it.ratKind || it.cat,
    exe: (it.executePath || '').slice(0, 90),
    args: (it.arguments || '').slice(0, 80),
    pub: (it.publisher || '').slice(0, 40),
  }));
  const prompt = [
    '당신은 Windows PC 내부에 숨어 돌아가는 처음 보는 백그라운드 스케줄러·서비스·시작프로그램의 정체를 초보자 눈높이로 1줄 해석해 주는 보안 비서입니다.',
    '아래 목록 각각의 실행경로·인자·서명사를 보고 3단계 중 하나로 분류하고 쉬운 한글 1줄 설명을 JSON 배열로 반환하세요.',
    '- tier: "DANGER_DELETE"(광고·위험·쿠키잠금해제·미서명 쥐새끼 ➔ 차단 권장) | "SLEEP_RECOMMEND"(즐겨쓰는 웹하드·유틸리티 상주 서비스 ➔ 앱 삭제 말고 수동전환/자동실행 해제 권장) | "USER_CHECK"(정상/업무용 확인 필요)',
    '- badge: "🔴 차단·제거 권장" | "🟡 수동전환·자동실행 해제" | "🔎 확인 후 선택"',
    '- explainKo: 개발용어 없이 초보자가 1초 만에 이해하는 1문장 (예: "예스파일 웹하드 서비스인데 앱을 꺼도 뒤에서 계속 돌고 있어요. 앱을 지우지 않고 켤 때만 돌게 수동으로 바꿀 수 있어요!")',
    '',
    JSON.stringify(payload),
    '',
    '반드시 순수 JSON 배열만 출력하세요: [{"id":"...","tier":"...","badge":"...","explainKo":"..."}]',
  ].join('\n');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8500);
  try {
    const res = await fetch('https://os.sundreamer.app/api/ai/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': 'ghosti',
        'x-ai-account': 'beakes',
      },
      body: JSON.stringify({
        appId: 'ghosti',
        account: 'beakes',
        model: 'gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        config: {
          temperature: 0.15,
          maxOutputTokens: 900,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
      signal: controller.signal,
    });
    if (!res.ok) return;
    const data = await res.json();
    const raw = String(data?.text || '')
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    const sIdx = raw.indexOf('[');
    const eIdx = raw.lastIndexOf(']');
    if (sIdx < 0 || eIdx <= sIdx) return;
    const arr = JSON.parse(raw.slice(sIdx, eIdx + 1));
    if (!Array.isArray(arr)) return;
    const map = new Map<string, any>();
    for (const row of arr) {
      if (row && typeof row.id === 'string') map.set(row.id, row);
    }
    for (const it of unknownItems) {
      const hit = map.get(it.id);
      if (hit) {
        if (hit.tier === 'DANGER_DELETE' || hit.tier === 'SAFE_DELETE' || hit.tier === 'SLEEP_RECOMMEND' || hit.tier === 'USER_CHECK') {
          it.safetyBadge = hit.tier;
        }
        if (typeof hit.badge === 'string' && hit.badge.trim()) {
          it.safetyBadgeLabel = hit.badge.trim();
        }
        if (typeof hit.explainKo === 'string' && hit.explainKo.trim()) {
          it.plainExplainKo = hit.explainKo.trim();
        }
        if (hit.tier === 'DANGER_DELETE' || hit.tier === 'SAFE_DELETE') {
          it.defaultSelected = true;
        }
      }
    }
  } catch {
    /* keep fallback */
  } finally {
    clearTimeout(timer);
  }
}

/**
 * [Read-Only 도구 병렬 실행기] 승인 게이트 없이 1턴에 복수 조회 도구를 병렬 실행하고
 * lastCareScanContext를 최신화합니다.
 */
export async function runAgentCareReadTools(tools: AgentCareReadTool[]): Promise<{
  ok: boolean;
  context: AgentCareScanContext;
  card: MonsterAgentCareCardPayload;
  briefingKo: string;
  followUpSuggestions: string[];
}> {
  const uniqueTools = Array.from(new Set(tools));
  const [diskRes, secRes, deskRes, appsRes, ratsRes] = await Promise.all([
    uniqueTools.includes('disk_hog_scan') ? callCareApi<any>('/api/care/disk-hog-scan') : Promise.resolve(null),
    uniqueTools.includes('security_2tier_scan') ? callCareApi<any>('/api/care/security-2tier-scan') : Promise.resolve(null),
    uniqueTools.includes('desktop_detail_scan') ? callCareApi<any>('/api/care/desktop-detail-scan') : Promise.resolve(null),
    uniqueTools.includes('installed_apps_list') ? callCareApi<any>('/api/care/installed-apps-list?limit=80') : Promise.resolve(null),
    uniqueTools.includes('hidden_rats_scan') ? callCareApi<any>('/api/care/hidden-rats-scan') : Promise.resolve(null),
  ]);

  const items: AgentCareScanItem[] = [];
  const summaryLines: string[] = [];
  let idx = 1;
  let cFreeGb: number | undefined;
  let cTotalGb: number | undefined;
  let cUsedPct: number | undefined;
  let projectedFreeGb: number | undefined;
  let availMoveDrives: Array<{ drive: string; freeGb: number }> = [];
  let isDesktop: boolean | undefined;
  let powerPlanName: string | undefined;
  let isHighPerformance: boolean | undefined;
  let visibleSysIcons: Array<{ iconId: string; label: string; safeExplanationKo: string }> = [];

  let primaryAction: AgentCareMutatingAction = 'disk_hog_clean';
  let primaryTitle = 'PC 정밀 스캔 & 취사선택 정리 목록';
  let primaryBadge = '귀신비서 AI 에이전트 실측';
  let scanKind: AgentCareScanContext['scanKind'] = uniqueTools.length > 1 ? 'MULTI' : 'DISK_HOG';

  // 1) C드라이브 대용량 공간 도둑 스캔 결과 반영
  if (diskRes?.ok && diskRes.data) {
    const d = diskRes.data;
    cFreeGb = Number(d.currentFreeGb ?? d.cDrive?.freeGb ?? 0);
    cTotalGb = Number(d.cDrive?.totalGb ?? 0);
    cUsedPct = Number(d.cDrive?.usedPercent ?? 0);
    projectedFreeGb = Number(d.projectedFreeAfterEmptyGb ?? cFreeGb);
    availMoveDrives = Array.isArray(d.availableMoveDrives) ? d.availableMoveDrives : [];
    isDesktop = Boolean(d.isDesktop);
    powerPlanName = String(d.powerPlan?.name || '');
    isHighPerformance = Boolean(d.powerPlan?.isHighPerformance);
    summaryLines.push(
      `💾 C: 드라이브 현재 여유 ${cFreeGb}GB / ${cTotalGb}GB (사용률 ${cUsedPct}%) · 안전 캐시 정리 시 휴지통 비우기 후 예상 여유 ${projectedFreeGb}GB`
    );
    if (availMoveDrives.length > 0) {
      summaryLines.push(
        `📦 여유 드라이브 감지: ${availMoveDrives.map((dv) => `${dv.drive} (${dv.freeGb}GB 여유)`).join(', ')} — 대용량 폴더 안전 이사 가능`
      );
    }
    if (isDesktop && !isHighPerformance && powerPlanName) {
      summaryLines.push(`⚡ 데스크톱 전원 모드가 '${powerPlanName}'으로 묶여 있습니다 (고성능 전환 가능).`);
    }
    for (const sc of d.safeCaches || []) {
      items.push({
        no: idx++,
        id: String(sc.id),
        name: String(sc.name),
        cat: String(sc.cat || 'SAFE_CACHE'),
        sizeMb: Number(sc.sizeMb || 0),
        detailKo: sc.cat === 'DESKTOP_HIBERFIL' ? '데스크톱 최대절전 즉시 해제' : '로그인·쿠키 보호 안전 캐시',
        defaultSelected: true,
      });
    }
    for (const hf of d.heavyFolders || []) {
      items.push({
        no: idx++,
        id: String(hf.id),
        name: String(hf.name),
        cat: String(hf.cat || 'USER_FOLDER'),
        sizeMb: Number(hf.sizeMb || 0),
        path: String(hf.path || ''),
        movableToOtherDrive: Boolean(hf.movableToOtherDrive),
        detailKo: hf.movableToOtherDrive && availMoveDrives.length > 0 ? '확인 후 삭제 또는 D: 안전 이사 권장' : '대용량 폴더 (확인 후 선택)',
        defaultSelected: false,
      });
    }
    if (uniqueTools.length === 1) {
      scanKind = 'DISK_HOG';
      primaryAction = 'disk_hog_clean';
      primaryTitle = `C: 드라이브 대용량 공간 도둑 정밀 진단 (여유 ${cFreeGb}GB)`;
      primaryBadge = '3초 고속 공간 스캔';
    }
  }

  // 2) 보안모듈·애드웨어 2분류 스캔 결과 반영
  if (secRes?.ok && secRes.data) {
    const s = secRes.data;
    summaryLines.push(
      `🛡️ 보안·애드웨어 2분류: 완전 삭제·적출 권장 ${s.deleteRecommendCount ?? 0}건 · 무삭제 수면(자동기상) 권장 ${s.sleepRecommendCount ?? 0}건`
    );
    for (const del of s.deleteRecommend || []) {
      items.push({
        no: idx++,
        id: String(del.id),
        name: String(del.name),
        cat: String(del.cat || 'PUP_ADWARE'),
        sizeMb: Number(del.sizeMb || del.estimatedRamMb || 0),
        detailKo: `🔴 삭제·적출 권장 — ${del.reason || ''}`,
        actionType: String(del.actionType || 'PUP_ERADICATE'),
        defaultSelected: true,
      });
    }
    for (const slp of s.sleepRecommend || []) {
      items.push({
        no: idx++,
        id: String(slp.id),
        name: String(slp.name),
        cat: String(slp.cat || 'ACTIVE_BANK_SECURITY'),
        sizeMb: 0,
        detailKo: `🟢 무삭제 수면·자동기상 권장 — ${slp.reason || ''}`,
        actionType: 'SECURITY_SLEEP',
        defaultSelected: false,
      });
    }
    if (uniqueTools.length === 1) {
      scanKind = 'SECURITY_2TIER';
      primaryAction = 'batch_deep_uninstall';
      primaryTitle = '보안모듈·애드웨어 스마트 2분류 (수면 vs 삭제)';
      primaryBadge = '사용이력·PUP 2분류';
    }
  }

  // 3) 바탕화면 상세 분석 & 시스템 아이콘 진단
  if (deskRes?.ok && deskRes.data) {
    const dk = deskRes.data;
    visibleSysIcons = Array.isArray(dk.visibleSystemIcons) ? dk.visibleSystemIcons : [];
    summaryLines.push(
      `🖥️ 바탕화면 전수 분석: 총 ${dk.count ?? 0}개 항목 (${dk.totalMb ?? 0}MB)` +
        (visibleSysIcons.length > 0
          ? ` · 특수 시스템 아이콘 ${visibleSysIcons.length}개 표시 중(${visibleSysIcons.map((i) => i.label).join(', ')})`
          : '')
    );
    for (const di of (dk.items || []).slice(0, 35)) {
      items.push({
        no: idx++,
        id: String(di.id),
        name: String(di.name),
        cat: `DESKTOP_${di.kind || 'FILE'}`,
        sizeMb: Number(di.sizeMb || 0),
        path: String(di.fullPath || ''),
        movableToOtherDrive: true,
        detailKo: `${di.scope || '바탕화면'} · ${di.compositionKo || ''} (${di.modifiedAt || ''})`,
        defaultSelected: false,
      });
    }
    if (uniqueTools.length === 1) {
      scanKind = 'DESKTOP_DETAIL';
      primaryAction = 'desktop_batch_action';
      primaryTitle = `바탕화면 상세 구성 분석 (${dk.count ?? 0}개 · ${dk.totalMb ?? 0}MB)`;
      primaryBadge = '폴더 내부 구성·시스템 아이콘 진단';
    }
  }

  // 4) 설치된 전체 프로그램 목록 (다중 취사선택 삭제용)
  if (appsRes?.ok && appsRes.data) {
    const ap = appsRes.data;
    summaryLines.push(`📦 설치된 프로그램 전수 스캔: 총 ${ap.totalCount ?? 0}개 (하드웨어 드라이버·핵심 앱 자동 보호)`);
    for (const a of (ap.items || []).slice(0, 50)) {
      items.push({
        no: idx++,
        id: `inst_${idx}_${String(a.name || '').slice(0, 20)}`,
        name: String(a.name || ''),
        cat: a.isProtected ? 'PROTECTED_APP' : 'INSTALLED_APP',
        sizeMb: Number(a.sizeMb || 0),
        detailKo: `${a.publisher || '제조사 미표기'}${a.installDate ? ` · 설치일 ${a.installDate}` : ''}`,
        isProtected: Boolean(a.isProtected),
        defaultSelected: false,
      });
    }
    if (uniqueTools.length === 1) {
      scanKind = 'INSTALLED_APPS';
      primaryAction = 'batch_deep_uninstall';
      primaryTitle = `설치된 프로그램 다중 취사선택 정리 (${ap.totalCount ?? 0}개)`;
      primaryBadge = '다중 체크박스 · 2-Pass 무소음 제거';
    }
  }

  // 5) [2차 고도화] 미등록 신종 쥐새끼(비-MS 스케줄러·비-Windows 서비스·자동실행·고메모리) 전수 수색 결과 반영 (보안·PUP 2분류와 중복 행 자동 제거)
  const unknownRatsToEnrich: AgentCareScanItem[] = [];
  if (ratsRes?.ok && ratsRes.data) {
    const rt = ratsRes.data;
    summaryLines.push(
      `🕵️ 숨은 백그라운드 전수 수색: 비-MS 스케줄러 ${rt.taskCount ?? 0}건 · 비-Windows 상주 서비스 ${rt.serviceCount ?? 0}건 · 부팅 자동실행 ${rt.startupCount ?? 0}건`
    );
    const existingSigTokens = items
      .map((ex) =>
        String(ex.name || '')
          .toLowerCase()
          .replace(/\[.*?\]|\(.*?\)/g, ' ')
          .trim()
      )
      .filter((s) => s.length >= 3);
    const isDuplicateOfSecScan = (riName: string, riKey: string) => {
      if (!secRes?.ok) return false;
      const probe = `${riName} ${riKey}`.toLowerCase();
      const knownOverlap = [
        'cachecloud', 'cacheconsole', 'cacheservice', 'frontserviceupdater',
        'cloudtask', 'storageservice', 'pcappstore', 'febjb', 'datasharing',
        'msload', 'ngplus', 'rayitem', 'shellexecuteas', 'e0477272', 'toast',
        'ocamtask', 'clipdown', 'nossvc', 'nprotect', 'magicline', 'crossex',
        'anysign', 'touchen', 'veraport', 'delfino', 'ipinside', 'keysharp',
      ];
      if (knownOverlap.some((tok) => probe.includes(tok) && existingSigTokens.some((es) => es.includes(tok.slice(0, 5))))) {
        return true;
      }
      return false;
    };

    for (const ri of (rt.items || []).slice(0, 45)) {
      const rName = String(ri.name || '');
      const rKey = String(ri.targetKey || '');
      if (isDuplicateOfSecScan(rName, rKey)) continue;
      const scanIt: AgentCareScanItem = {
        no: idx++,
        id: String(ri.id),
        name: rName,
        cat: String(ri.cat || 'RAT_TASK'),
        sizeMb: Number(ri.sizeMb || 0),
        detailKo: `${ri.publisher || '서명 미확인'} · ${ri.arguments || ri.executePath || ''}`,
        actionType: String(ri.recommendedAction || 'DISABLE_TASK'),
        ratKind: ri.ratKind,
        targetKey: rKey,
        executePath: String(ri.executePath || ''),
        arguments: String(ri.arguments || ''),
        publisher: String(ri.publisher || ''),
        defaultSelected: Boolean(ri.defaultSelected),
        isProtected: Boolean(ri.isProtected),
      };
      items.push(scanIt);
    }
    if (uniqueTools.length === 1) {
      scanKind = 'HIDDEN_RATS';
      primaryAction = 'hidden_rats_apply';
      primaryTitle = `숨은 백그라운드·신종 쥐새끼 전수 수색 (${rt.count ?? 0}건)`;
      primaryBadge = '미등록 스케줄러·서비스 수동전환';
    }
  }

  // 번호 재정렬 (중복 제거 후 1..N 연속 번호 유지)
  items.forEach((it, i) => {
    it.no = i + 1;
  });

  // 🌟 모든 스캔 항목에 초보자 친절 1줄 설명 & 안전도 배지 자동 부착 + 카탈로그에 없는 미등록 쥐새끼는 제미니로 즉시 정체 해석!
  // [안전 체크 원칙]: '쓰시면 유지 / 확인 후 선택(USER_CHECK)' 및 '안 지우고 재우기 추천(SLEEP_RECOMMEND)' 항목은
  // 실수로 삭제 창이 뜨지 않도록 절대 기본 자동 체크(defaultSelected=true)하지 않습니다.
  for (const it of items) {
    const exp = explainCareItemForBeginner(it);
    it.safetyBadge = exp.safetyBadge;
    it.safetyBadgeLabel = exp.safetyBadgeLabel;
    it.plainExplainKo = exp.plainExplainKo;
    if (exp.safetyBadge === 'USER_CHECK' || exp.safetyBadge === 'SLEEP_RECOMMEND') {
      it.defaultSelected = false;
    }
    if (it.ratKind && exp.plainExplainKo.includes('오른쪽 [이게 뭐예요?]')) {
      unknownRatsToEnrich.push(it);
    }
  }
  if (unknownRatsToEnrich.length > 0) {
    await enrichUnknownRatsWithGemini(unknownRatsToEnrich);
  }

  const ctx: AgentCareScanContext = {
    updatedAt: Date.now(),
    scanKind,
    cDriveFreeGb: cFreeGb,
    cDriveTotalGb: cTotalGb,
    cDriveUsedPct: cUsedPct,
    availableMoveDrives: availMoveDrives,
    isDesktop,
    powerPlanName,
    isHighPerformance,
    visibleSystemIcons: visibleSysIcons,
    items,
  };
  lastCareScanContext = ctx;

  const defaultSelectedIds = items.filter((it) => it.defaultSelected && !it.isProtected).map((it) => it.id);
  const card: MonsterAgentCareCardPayload = {
    mode: 'SCAN_REPORT',
    title: primaryTitle,
    badgeText: primaryBadge,
    summaryLines,
    action: primaryAction,
    items: items.slice(0, 50),
    selectedIds: defaultSelectedIds,
    excludedNames: [],
    availableMoveDrives: availMoveDrives,
    visibleSystemIcons: visibleSysIcons,
    currentFreeGb: cFreeGb,
    projectedFreeAfterEmptyGb: projectedFreeGb,
    isDesktop,
    isHighPerformance,
  };

  const briefingParts = [
    `내 PC를 정밀 스캔해 **${items.length}개 항목**을 실측해 왔어요!`,
    ...summaryLines.map((l) => `• ${l}`),
    `아래 카드에서 체크박스를 골라 누르시거나, 채팅창에 **"오캠이랑 4번은 빼고 나머지 다 지워줘"**, **"다운로드 큰 폴더는 D드라이브로 옮겨줘"**처럼 편하게 말씀해 주세요! (모든 정리는 영구 삭제 없이 안전하게 **Windows 휴지통**으로만 이동합니다)`,
  ];

  const hasSafeCacheItems = items.some(
    (it) => it.cat === 'SAFE_CACHE' || it.cat === 'DESKTOP_HIBERFIL'
  );
  const followUps: string[] = [];
  if (scanKind === 'DISK_HOG' || uniqueTools.includes('disk_hog_scan')) {
    if (hasSafeCacheItems) {
      followUps.push('체크된 안전 캐시만 지금 다 정리해줘');
    } else {
      followUps.push('빨간색(삭제·차단 안전) 항목만 정리해줘');
    }
    if (availMoveDrives.length > 0 && items.some((it) => it.movableToOtherDrive)) {
      followUps.push(`다운로드 큰 파일은 ${availMoveDrives[0].drive} 드라이브로 옮겨줘`);
    }
    followUps.push('지금 CPU·메모리 제일 많이 쓰는 앱 알려줘');
  } else if (scanKind === 'SECURITY_2TIER') {
    followUps.push('빨간색 애드웨어·그리드만 다 지우고, 은행 보안모듈은 잠재워줘');
    followUps.push('C드라이브 대용량 공간 도둑도 스캔해줘');
  } else if (scanKind === 'HIDDEN_RATS') {
    followUps.push('빨간색(차단 권장) 항목만 다 끄고, 서비스는 수동으로 바꿔줘');
    followUps.push('이 중에서 뭐가 제일 느리게 만드는 놈이야?');
    followUps.push('C드라이브 대용량 공간 도둑도 같이 찾아줘');
  } else if (scanKind === 'DESKTOP_DETAIL') {
    if (visibleSysIcons.length > 0) {
      followUps.push('바탕화면 이상한 사용자 폴더 아이콘만 안전하게 숨겨줘');
    }
    followUps.push('안 쓰는 바로가기랑 큰 폴더 선택해서 정리할래');
  } else {
    followUps.push('체크한 프로그램들 한 번에 다 지워줘');
    followUps.push('C드라이브 용량 잡아먹는 주범도 찾아줘');
  }

  return {
    ok: items.length > 0 || summaryLines.length > 0,
    context: ctx,
    card,
    briefingKo: briefingParts.join('\n'),
    followUpSuggestions: followUps.slice(0, 3),
  };
}

/**
 * [제미니 에이전트 자유 문답 플래너]
 * 유저 발화 + 직전 스캔 원장(60개 × 5키)을 Gemini 2.5 Flash로 넘겨
 * ALLOW 화이트리스트 Tool 조합 및 제외 필터(excludeIds/excludeKeywords)를 JSON으로 파싱합니다.
 */
export async function planCareAgentTurnWithGemini(params: {
  query: string;
  pcContextText: string;
  scanContext: AgentCareScanContext | null;
  recentTurns: Array<{ role: 'user' | 'assistant'; text: string }>;
}): Promise<AgentCareLlmPlan | null> {
  const { query, pcContextText, scanContext, recentTurns } = params;
  const compactScan = serializeCompactScanContext(scanContext);
  const hist = recentTurns
    .slice(-5)
    .map((t) => `${t.role === 'user' ? '유저' : '귀신비서'}: ${t.text.slice(0, 180)}`)
    .join('\n');

  const prompt = [
    '당신은 『귀신같이(Ghosti)』의 내 PC 전담 AI 에이전트 **귀신비서**입니다.',
    '유저의 자연어 요청과 직전 스캔 원장을 분석해, 허용된 안전 도구(Safe Toolset)만 조합한 JSON 플랜을 출력하세요.',
    '',
    '[절대 경계 헌법 (ALLOW / DENY)]:',
    '✅ ALLOW (허용 도구):',
    '  - 조회(readTools): "disk_hog_scan"(C드라이브 대용량·캐시·hiberfil 스캔), "security_2tier_scan"(보안모듈 수면 vs 악성애드웨어·그리드 2분류), "hidden_rats_scan"(미등록 신종 쥐새끼·비-MS 스케줄러·비-Windows 서비스·자동실행·고메모리 전수 수색), "desktop_detail_scan"(바탕화면 폴더 구성·특수아이콘 진단), "installed_apps_list"(설치 앱 전체 목록)',
    '  - 변경(mutatingPlan.action): "disk_hog_clean"(캐시·hiberfil 정리/D: 이사), "batch_deep_uninstall"(다중 앱·애드웨어 취사선택 일괄 제거), "hidden_rats_apply"(숨은 스케줄러 차단·서비스 수동전환·부팅 자동실행 해제 — 앱 삭제 없이 1초 원복), "desktop_batch_action"(바탕화면 선택 항목 휴지통/D: 이사/아이콘 숨김), "security_2tier_apply"(실사용 보안모듈 수면 + 애드웨어 삭제), "desktop_system_icon_toggle"(WD 사용자폴더 등 특수아이콘 숨김), "desktop_power_boost"(데스크톱 고성능 전원 전환)',
    '🚫 DENY (절대 금지): 임의 Shell/PowerShell 생성 금지, 시스템 폴더 삭제 금지, 영구 삭제 금지(모든 파일·폴더는 Windows 휴지통으로만 이동), 하드웨어 드라이버(NVIDIA/AMD/Intel/Realtek) 삭제 금지.',
    '',
    '[멀티턴 취사선택·제외 필터 파싱 규칙]:',
    '- 유저가 직전 스캔 목록을 보고 "카톡·오캠·4번은 놔두고 나머지 다 지워", "예스파일, S캡쳐는 빼고 다 제거해", "여행 폴더만 지우고 WD 아이콘은 숨겨줘"라고 말하면:',
    '  1) 반드시 직전 스캔 원장의 항목 `id` 또는 `#번호`를 기준으로 `includeIds`(실행할 대상)와 `excludeIds`·`excludeKeywords`(보존할 대상)를 정확히 분리해 `mutatingPlan`에 담으세요.',
    '  2) "나머지 다"라고 하면 직전 스캔 원장에서 `excludeIds`/`excludeKeywords`와 보호 항목을 뺀 모든 대상 `id`를 `includeIds`에 넣으세요.',
    '  3) 유저가 새로 조사·스캔을 요청하면 `readTools` 배열에 필요한 도구 1~3개를 담고 `mutatingPlan`은 null로 두세요.',
    '',
    pcContextText,
    compactScan,
    hist ? `[최근 대화]\n${hist}` : '',
    `[현재 유저 요청]: "${query}"`,
    '',
    '반드시 아래 순수 JSON 하나만 출력하세요 (코드블록 없이 { 로 시작해서 } 로 끝낼 것):',
    '{',
    '  "replyKo": "따뜻하고 똑부러지는 귀신비서 해요체 1~2문장 안내 (제외된 항목과 정리할 항목을 명확히 짚어줄 것)",',
    '  "readTools": [],',
    '  "mutatingPlan": null | {',
    '    "action": "disk_hog_clean" | "batch_deep_uninstall" | "hidden_rats_apply" | "desktop_batch_action" | "security_2tier_apply" | "desktop_system_icon_toggle" | "desktop_power_boost",',
    '    "includeIds": ["스캔원장의 id 또는 앱/폴더명"],',
    '    "excludeIds": ["제외할 id 또는 #번호"],',
    '    "excludeKeywords": ["유저가 놔두라고 한 앱/폴더 이름 키워드"],',
    '    "moveDestinationDrive": "D: (다른 드라이브 이사 요청 시에만)",',
    '    "hideSystemIconIds": ["user_files" | "network" | "control_panel"],',
    '    "reasonSummaryKo": "실행 계획 1줄 요약"',
    '  },',
    '  "followUpSuggestions": ["유저 반말 버튼 1", "유저 반말 버튼 2"]',
    '}',
  ]
    .filter(Boolean)
    .join('\n');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8500);
  try {
    const res = await fetch('https://os.sundreamer.app/api/ai/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': 'ghosti',
        'x-ai-account': 'beakes',
      },
      body: JSON.stringify({
        appId: 'ghosti',
        account: 'beakes',
        model: 'gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        config: {
          temperature: 0.15,
          maxOutputTokens: 600,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
      signal: controller.signal,
    });
    if (!res.ok) return buildLocalMultiTurnFilterFallback(query, scanContext);
    const data = await res.json();
    const raw = String(data?.text || '')
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    const sIdx = raw.indexOf('{');
    const eIdx = raw.lastIndexOf('}');
    if (sIdx < 0 || eIdx <= sIdx) return buildLocalMultiTurnFilterFallback(query, scanContext);
    const parsed = JSON.parse(raw.slice(sIdx, eIdx + 1));
    if (!parsed || typeof parsed.replyKo !== 'string') return buildLocalMultiTurnFilterFallback(query, scanContext);
    logGeminiCareTurnNonBlocking(query, parsed.replyKo, 'care_plan');
    return {
      replyKo: parsed.replyKo.trim(),
      readTools: Array.isArray(parsed.readTools) ? parsed.readTools : [],
      mutatingPlan: parsed.mutatingPlan || null,
      followUpSuggestions: Array.isArray(parsed.followUpSuggestions)
        ? parsed.followUpSuggestions.map((x: any) => String(x || '').trim()).filter(Boolean).slice(0, 3)
        : [],
    };
  } catch {
    return buildLocalMultiTurnFilterFallback(query, scanContext);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * [2층 제미니 비차단 텔레메트리 로거 — 0ms 지연, 주 1회 1층 정규식 승격용]
 */
function logGeminiCareTurnNonBlocking(query: string, aiReply: string, stage: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const maskedQ = String(query || '')
      .replace(/[A-Za-z]:\\Users\\[^\\\s]+/gi, 'C:\\Users\\*')
      .slice(0, 240);
    const key = 'ghosti_gemini_care_telemetry_v1';
    const prev = JSON.parse(localStorage.getItem(key) || '[]');
    const next = Array.isArray(prev) ? prev : [];
    next.push({
      at: new Date().toISOString(),
      stage,
      q: maskedQ,
      replyPreview: String(aiReply || '').slice(0, 180),
    });
    localStorage.setItem(key, JSON.stringify(next.slice(-150)));
  } catch {
    /* non-blocking */
  }
}

/**
 * [P1-3 로컬 결정론적 멀티턴 필터 폴백]
 * 네트워크 지연·쿼터 전환으로 제미니가 타임아웃 나더라도 "오캠이랑 3번 빼고 다 지워", "D드라이브로 옮겨줘"를 0ms로 정확히 파싱해 확인 카드를 생성합니다.
 */
export function buildLocalMultiTurnFilterFallback(
  query: string,
  scanContext: AgentCareScanContext | null
): AgentCareLlmPlan | null {
  if (!scanContext || scanContext.items.length === 0) return null;
  const q = query.trim();
  const moveDrvMatch = q.match(/([d-zD-Z])\s*:?\s*드라이브/);
  const moveDrive = moveDrvMatch ? `${moveDrvMatch[1].toUpperCase()}:` : '';

  const excludeIds: string[] = [];
  const excludeKeywords: string[] = [];

  const excClauseMatch = q.match(/^(.+?)\s*(?:은|는|이랑|랑|하고|과|와|,)?\s*(?:빼고|제외하고|제외|놔두고|놔둬|남기고|냅두고|말고)/i);
  if (excClauseMatch && excClauseMatch[1]) {
    const rawPart = excClauseMatch[1];
    for (const nm of rawPart.matchAll(/#?(\d+)\s*번?/g)) {
      excludeIds.push(`#${nm[1]}`);
    }
    const tokens = rawPart
      .replace(/#?\d+\s*번?/g, ' ')
      .split(/[,/·]|이랑|랑|하고|그리고|및|\s+/)
      .map((t) => t.replace(/(은|는|이|가|을|를|만|도)$/, '').trim())
      .filter((t) => t.length >= 2 && !/^(내가|쓰는|사용하는|프로그램|앱|파일|폴더|항목)$/.test(t));
    excludeKeywords.push(...tokens);
  }

  const includeIds: string[] = [];
  const wantsSafeCacheOnly = /(?:안전\s*)?캐시만/i.test(q);
  const wantsRedSafeOnly = /(빨간색|삭제\s*안전|차단\s*권장|100%\s*삭제)/i.test(q);
  if (!excClauseMatch) {
    for (const nm of q.matchAll(/#?(\d+)\s*번?/g)) {
      includeIds.push(`#${nm[1]}`);
    }
    if (wantsSafeCacheOnly) {
      for (const it of scanContext.items) {
        if (!it.isProtected && (it.cat === 'SAFE_CACHE' || it.cat === 'DESKTOP_HIBERFIL')) {
          includeIds.push(it.id);
        }
      }
    } else if (wantsRedSafeOnly) {
      for (const it of scanContext.items) {
        if (
          !it.isProtected &&
          (it.safetyBadge === 'DANGER_DELETE' || it.safetyBadge === 'SAFE_DELETE')
        ) {
          includeIds.push(it.id);
        }
      }
    }
    if (moveDrive && /다운로드/.test(q)) {
      const dl = scanContext.items.find((i) => /다운로드|download/i.test(i.name));
      if (dl) includeIds.push(dl.id);
    }
  }

  const defaultAction: AgentCareMutatingAction =
    wantsSafeCacheOnly
      ? 'disk_hog_clean'
      : scanContext.scanKind === 'HIDDEN_RATS'
      ? 'hidden_rats_apply'
      : scanContext.scanKind === 'DESKTOP_DETAIL'
      ? 'desktop_batch_action'
      : scanContext.scanKind === 'DISK_HOG' || Boolean(moveDrive)
      ? 'disk_hog_clean'
      : 'batch_deep_uninstall';

  return {
    replyKo: moveDrive
      ? `말씀하신 대로 선택 항목을 **${moveDrive}\\귀신비서_보관함**으로 안전하게 옮길 준비를 마쳤어요! 아래 목록을 확인 후 실행해 주세요.`
      : excludeKeywords.length > 0 || excludeIds.length > 0
      ? `말씀하신 보존 항목은 안전하게 제외하고, 정리 권장 항목만 골라두었어요! 한 번 더 확인 후 실행해 주세요.`
      : `요청하신 기준에 맞춰 안전 정리 대상을 준비했어요! 아래 체크박스를 확인 후 실행해 주세요.`,
    readTools: [],
    mutatingPlan: {
      action: defaultAction,
      includeIds,
      excludeIds,
      excludeKeywords,
      moveDestinationDrive: moveDrive || undefined,
      reasonSummaryKo: moveDrive ? `${moveDrive} 드라이브 안전 이사 확인` : '취사선택 일괄 정리 최종 확인',
    },
    followUpSuggestions: ['응 진행해', '휴지통 비워줘'],
  };
}

/**
 * [배치 실행기 — 1회 확인 후 실제 Z-Core 도구 호출]
 */
export async function executeAgentCareBatchCard(
  card: MonsterAgentCareCardPayload,
  userApprovalText = '체크박스 확인 후 일괄 실행'
): Promise<{
  ok: boolean;
  reportKo: string;
  currentFreeGb?: number;
  projectedFreeAfterEmptyGb?: number;
}> {
  const selectedSet = new Set(card.selectedIds);
  const selectedItems = card.items.filter((it) => selectedSet.has(it.id) && !it.isProtected);
  const unselectedNames = card.items
    .filter((it) => !selectedSet.has(it.id) && !it.isProtected)
    .map((it) => it.name);
  const allExcluded = Array.from(new Set([...(card.excludedNames || []), ...unselectedNames]));

  // 전용 비-아이템 단일 액션 처리
  if (card.action === 'desktop_power_boost' && selectedItems.every((i) => i.cat === 'POWER_PLAN')) {
    const r = await callCareApi<any>('/api/care/desktop-power-boost', { userApprovalTypedText: userApprovalText }, 15000);
    return {
      ok: r.ok,
      reportKo: String(r.data?.message || (r.ok ? '데스크톱 고성능 전원 모드로 전환했습니다!' : '전원 모드 전환을 완료하지 못했습니다.')),
    };
  }

  if (card.action === 'desktop_system_icon_toggle' && selectedItems.length === 0) {
    const iconIds = (card.visibleSystemIcons || []).map((i) => i.iconId);
    const targetId = iconIds[0] || 'user_files';
    const r = await callCareApi<any>('/api/care/desktop-icon-toggle', { iconId: targetId, hide: true }, 10000);
    return {
      ok: r.ok,
      reportKo: String(r.data?.message || (r.ok ? '바탕화면 시스템 아이콘을 안전하게 숨겼습니다!' : '아이콘 숨김을 완료하지 못했습니다.')),
    };
  }

  // [P0-1 정공법] MULTI 복합 스캔에서도 단 1건의 누락이 없도록 선택된 항목을 실제 성격별 5대 버킷으로 분리해 순차 실행!
  const DISK_HOG_CATS = new Set([
    'SAFE_CACHE',
    'DESKTOP_HIBERFIL',
    'USER_FOLDER',
    'APP_DATA_HOG',
    'USER_LARGE_ITEM',
  ]);
  const ratItems = selectedItems.filter((i) => Boolean(i.ratKind));
  const diskHogItems = selectedItems.filter((i) => !i.ratKind && DISK_HOG_CATS.has(i.cat));
  const desktopItems = selectedItems.filter(
    (i) => !i.ratKind && !DISK_HOG_CATS.has(i.cat) && i.cat.startsWith('DESKTOP_')
  );
  const sleepItems = selectedItems.filter(
    (i) => !i.ratKind && !DISK_HOG_CATS.has(i.cat) && !i.cat.startsWith('DESKTOP_') && i.actionType === 'SECURITY_SLEEP'
  );
  const uninstallOrPupItems = selectedItems.filter(
    (i) =>
      !i.ratKind &&
      !DISK_HOG_CATS.has(i.cat) &&
      !i.cat.startsWith('DESKTOP_') &&
      i.actionType !== 'SECURITY_SLEEP' &&
      i.cat !== 'POWER_PLAN'
  );

  const reportBlocks: string[] = [];
  let anyOk = false;
  let updatedFreeGb: number | undefined;
  let updatedProjGb: number | undefined;

  // 버킷 1: 숨은 쥐새끼 차단 · 서비스 수동 전환 · 시작프로그램 해제
  if (ratItems.length > 0) {
    const disableTasks = ratItems.filter((i) => i.ratKind === 'SCHEDULED_TASK' && i.targetKey).map((i) => i.targetKey!);
    const manualServices = ratItems.filter((i) => i.ratKind === 'WINDOWS_SERVICE' && i.targetKey).map((i) => i.targetKey!);
    const disableStartups = ratItems.filter((i) => i.ratKind === 'STARTUP_ITEM' && i.targetKey).map((i) => i.targetKey!);
    const stopProcesses = ratItems.filter((i) => i.ratKind === 'HIGH_MEM_PROCESS' && i.targetKey).map((i) => i.targetKey!);
    const rRat = await callCareApi<any>(
      '/api/care/hidden-rats-apply',
      {
        disableTasks,
        manualServices,
        disableStartups,
        stopProcesses,
        userApprovalTypedText: userApprovalText,
      },
      45000
    );
    if (rRat.ok) anyOk = true;
    if (rRat.data?.reportKo) reportBlocks.push(String(rRat.data.reportKo));
  }

  // 버킷 2: C드라이브 대용량 캐시 · hiberfil.sys · D: 드라이브 안전 이사
  if (diskHogItems.length > 0) {
    const rDisk = await callCareApi<any>(
      '/api/care/disk-hog-clean',
      {
        includeIds: diskHogItems.map((i) => i.id),
        excludeIds: card.excludedNames || [],
        moveDestinationDrive: card.moveDestinationDrive || '',
        userApprovalTypedText: userApprovalText,
      },
      60000
    );
    if (rDisk.ok) anyOk = true;
    if (rDisk.data?.reportKo || rDisk.data?.message) {
      reportBlocks.push(String(rDisk.data.reportKo || rDisk.data.message));
    }
    if (typeof rDisk.data?.currentFreeGb === 'number') updatedFreeGb = rDisk.data.currentFreeGb;
    if (typeof rDisk.data?.projectedFreeAfterEmptyGb === 'number') updatedProjGb = rDisk.data.projectedFreeAfterEmptyGb;
  }

  // 버킷 3: 바탕화면 선택 파일/폴더 휴지통 이동 · D: 이사 · 특수아이콘 숨김
  if (desktopItems.length > 0 || (card.action === 'desktop_batch_action' && card.visibleSystemIcons?.length)) {
    const paths = desktopItems.map((i) => i.path || '').filter(Boolean);
    const isMove = Boolean(card.moveDestinationDrive);
    const rDesk = await callCareApi<any>(
      '/api/care/desktop-batch-action',
      {
        recyclePaths: isMove ? [] : paths,
        movePaths: isMove ? paths : [],
        moveDestinationDrive: card.moveDestinationDrive || 'D:',
        hideSystemIcons: card.visibleSystemIcons?.length && paths.length === 0 ? ['user_files'] : [],
        userApprovalTypedText: userApprovalText,
      },
      45000
    );
    if (rDesk.ok) anyOk = true;
    if (rDesk.data?.reportKo) reportBlocks.push(String(rDesk.data.reportKo));
  }

  // 버킷 4: 악성 PUP 적출 + 설치 앱 2-Pass 심층 제거
  const pupIds = uninstallOrPupItems.filter((i) => i.id.startsWith('pup_')).map((i) => i.id);
  const appNames = uninstallOrPupItems.filter((i) => !i.id.startsWith('pup_')).map((i) => i.name);
  if (appNames.length > 0 || pupIds.length > 0) {
    const rBatch = await callCareApi<any>(
      '/api/care/batch-deep-uninstall',
      {
        appNames,
        pupIds,
        excludeNames: allExcluded.slice(0, 20),
        userApprovalTypedText: userApprovalText,
      },
      120000
    );
    if (rBatch.ok) anyOk = true;
    if (rBatch.data?.reportKo) {
      reportBlocks.push(String(rBatch.data.reportKo));
    } else if (!rBatch.ok) {
      reportBlocks.push(
        `⚠️ **[일부 프로그램 제거 미완료]** 선택한 프로그램(${appNames.length + pupIds.length}건) 중 일부는 제거 창이 닫혔거나 시간이 초과되어 건너뛰었습니다. 필요한 항목만 개별 체크해 다시 시도해 주세요.`
      );
    }
  }

  // 버킷 5: 실사용 은행·관공서 보안모듈 무삭제 수면
  if (sleepItems.length > 0 || card.action === 'security_2tier_apply') {
    const rSlp = await callCareApi<any>('/api/care/sleep', { explicitOptIn: true }, 55000);
    if (rSlp.ok) anyOk = true;
    if (rSlp.data?.toastMessage) {
      reportBlocks.push(`🌙 **[실사용 보안모듈 무삭제 수면 적용]**\n${rSlp.data.toastMessage}`);
    }
  }

  return {
    ok: anyOk,
    reportKo:
      reportBlocks.join('\n\n') ||
      (anyOk ? '선택하신 항목들을 깔끔하게 정리했습니다!' : '선택된 실행 대상이 없거나 처리 중 오류가 발생했습니다.'),
    currentFreeGb: updatedFreeGb,
    projectedFreeAfterEmptyGb: updatedProjGb,
  };
}

/**
 * 🌟 [초보자 질문 전용 제미니 설명기]
 * 유저가 스캔 목록을 보고 "3번이랑 5번이 뭐 하는 애들이야? 지워도 돼?", "이 중에 꼭 남겨야 할 거 알려줘"라고 되물었을 때,
 * 절대 삭제하지 않고 초보자 눈높이(비전문용어)로 정체·삭제 시 영향·추천 행동을 1:1 친절하게 설명합니다.
 */
export async function explainCareItemsWithGemini(params: {
  query: string;
  scanContext: AgentCareScanContext;
}): Promise<{ replyKo: string; followUpSuggestions: string[] }> {
  const { query, scanContext } = params;
  const compactScan = serializeCompactScanContext(scanContext);

  const prompt = [
    '당신은 컴퓨터를 잘 모르는 일반인도 1초 만에 안심하고 결정할 수 있게 설명해 주는 『귀신같이』의 친절한 귀신비서입니다.',
    '아래 [스캔 목록]을 보고 유저가 궁금해하는 항목(또는 전체 중 꼭 지워도 되는 것 / 남겨야 할 것)을 쉬운 일상어로 친절하게 설명해 주세요.',
    '',
    '[설명 절대 원칙]:',
    '1. 개발/IT 전문용어(프로세스, 스케줄러, 레지스트리, DLL 등)를 쓰지 말고, "컴퓨터 켤 때마다 몰래 켜지는 광고 앱", "은행 들어갈 때만 필요한 보안 프로그램"처럼 초보자 일상어로 설명하세요.',
    '2. 각 항목마다 ① 이게 뭐 하는 프로그램인지, ② 지워도 내 문서/업무에 지장 없는지, ③ [삭제 추천 / 안 지우고 재우기 추천 / 쓰시면 유지] 중 무엇을 권하는지 명확히 짚어주세요.',
    '3. 다정하고 신뢰감 있는 귀신비서 해요체(~예요!, ~하셔도 안전해요!)로 핵심만 보기 좋게 글머리(•)로 정리해 주세요.',
    '4. 마지막 줄에는 "원하시는 대로 \'3번이랑 오캠은 빼고 다 지워줘\'처럼 편하게 말씀해 주시면 바로 정리해 드릴게요!"라고 안내하세요.',
    '',
    compactScan,
    '',
    `[유저 질문]: "${query}"`,
  ].join('\n');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8500);
  try {
    const res = await fetch('https://os.sundreamer.app/api/ai/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': 'ghosti',
        'x-ai-account': 'beakes',
      },
      body: JSON.stringify({
        appId: 'ghosti',
        account: 'beakes',
        model: 'gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        config: {
          temperature: 0.25,
          maxOutputTokens: 700,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
      signal: controller.signal,
    });
    if (res.ok) {
      const data = await res.json();
      const text = String(data?.text || '').trim();
      if (text) {
        logGeminiCareTurnNonBlocking(query, text, 'item_explain');
        return {
          replyKo: text,
          followUpSuggestions: [
            '빨간색(삭제 안전) 표시된 것만 다 지워줘',
            '은행 보안모듈은 안 지우고 재워만 줘',
            'C드라이브 안전 캐시도 같이 정리해줘',
          ],
        };
      }
    }
  } catch {
    /* fallback below */
  } finally {
    clearTimeout(timer);
  }

  // 오프라인/타임아웃 폴백: 로컬 초보자 번역 사전으로 즉시 100% 친절 답변!
  const matchedNums = Array.from(query.matchAll(/#?(\d+)\s*번?/g)).map((m) => Number(m[1]));
  const picked =
    matchedNums.length > 0
      ? scanContext.items.filter((it) => matchedNums.includes(it.no))
      : scanContext.items.filter((it) =>
          query
            .toLowerCase()
            .split(/\s+/)
            .some((w) => w.length >= 2 && it.name.toLowerCase().includes(w))
        );
  const targetList = picked.length > 0 ? picked.slice(0, 6) : scanContext.items.slice(0, 6);
  const lines = [
    '궁금하신 항목들을 알기 쉽게 정리해 드릴게요!',
    ...targetList.map((it) => {
      const exp = explainCareItemForBeginner(it);
      return `• **#${it.no} ${it.name}** (${exp.safetyBadgeLabel}): ${exp.plainExplainKo}`;
    }),
    '보시고 **"체크된 것만 다 지워줘"** 또는 **"오캠이랑 4번은 빼고 나머지 다 지워줘"**처럼 편하게 말씀해 주세요!',
  ];
  return {
    replyKo: lines.join('\n'),
    followUpSuggestions: ['빨간색(삭제 안전) 항목만 다 지워줘', '은행 보안모듈은 잠재워만 줘'],
  };
}

/**
 * 유저 발화가 신규 '제미니 에이전트 자유 문답 + 다중 PC 정리' 트랙에 해당하는지 정밀 판별
 * - 비전문용어/일상 불만어("컴이 왜 이리 버벅거려", "이상한 거 깔렸나", "자꾸 뭐가 떠", "컴 좀 가볍게 청소하자")까지 모두 자동 인식!
 */
export function detectAgentCareIntent(
  clean: string,
  scanContext: AgentCareScanContext | null
): {
  matched: boolean;
  immediateReadTools: AgentCareReadTool[];
  needsGeminiMultiTurnFilter: boolean;
  needsGeminiExplainOnly: boolean;
  isSystemIconQuery: boolean;
  isPowerBoostQuery: boolean;
} {
  // [P1-1] 복원 기록 조회·원복 발화는 절대 스캔/삭제 에이전트가 가로채지 않도록 즉시 양보!
  if (/(복원\s*기록|복원\s*지점|되돌려|되돌리|원복|원래대로|(?:방금|아까|최근|이전).*?(?:취소|복원|복구|되돌))/i.test(clean)) {
    return {
      matched: false,
      immediateReadTools: [],
      needsGeminiMultiTurnFilter: false,
      needsGeminiExplainOnly: false,
      isSystemIconQuery: false,
      isPowerBoostQuery: false,
    };
  }

  const hasRecentScan = Boolean(
    scanContext && scanContext.items.length > 0 && Date.now() - scanContext.updatedAt < 25 * 60 * 1000
  );

  // 1) 직전 스캔 목록을 보고 "3번 뭐야?", "이거 지워도 돼?", "이게 뭐 하는 프로그램이야?", "꼭 남겨야 할 거 알려줘" 되묻는 경우
  const isAskingExplain =
    hasRecentScan &&
    /(뭐야|뭔데|뭐\s*하는|무슨\s*(앱|프로그램|파일|폴더)|지워도\s*(돼|되|괜찮|안전)|삭제해도\s*(돼|되|괜찮)|설명해|알려\s*줘|남겨야|놔둬야|지울\s*거\s*골라|추천해|어떻게\s*골라|멘붕|모르겠)/i.test(
      clean
    ) &&
    !/(빼고|제외하고|나머지\s*다|일괄\s*삭제|다\s*지워|옮겨\s*줘)/i.test(clean);

  // 2) 일반 사무직원 비전문용어 종합 점검 불만어 (조사 이/가/은/는/도 허용 + 답답/이상한 창·팝업/버벅대/멈칫 전면 포괄)
  const isCasualFullCheckup =
    /(?:컴퓨터|컴터|피씨|pc|노트북|컴|화면|마우스|창|업무).*?(?:버벅|느려|느린|무거워|무겁|답답|렉\s*걸|먹통|멈칫|이상해|가볍게|청소\s*(?:좀|하자|해)|정리\s*좀|손\s*좀\s*보|손보자|점검\s*좀|상태\s*좀|봐\s*줘|봐\s*주세요)/i.test(
      clean
    ) ||
    /(?:왜\s*이리|왜\s*이렇게|너무|자꾸|요즘|갑자기)\s*(?:버벅|느려|무거워|답답|렉\s*걸|멈칫|멈춰|끊겨)/i.test(clean) ||
    /(?:이상한|모르는|수상한|광고)\s*(?:창|팝업|배너|알림|메시지|화면|거|게|앱|프로그램)(?:이|가|은|는|들)?.*?(?:떠|뜨|나와|열려|돌아|켜져|깔렸|있|봐\s*줘|없애|치워)?/i.test(
      clean
    ) ||
    /(?:창|팝업|광고|배너|뭐)(?:이|가)?\s*자꾸\s*(?:떠|뜨|나와|열려|돌아|켜져)|자꾸.*?(?:창|팝업|광고|배너|이상한).*?(?:떠|뜨|나와|켜져)|쓸데없는\s*(?:거|게|앱|프로그램)|뭐\s*(?:지우면|삭제하면|정리하면)\s*(?:돼|좋아|될까)/i.test(
      clean
    );

  // 조사(이/가/은/는/도) 허용 C드라이브·저장공간 부족 발화 ("저장 공간이 모자라서 파일이 안 받아져", "용량이 부족해")
  const isDiskHog =
    /(?:[c-zC-Z]\s*드라이브|(?:저장\s*)?(?:용량|공간|하드|디스크|ssd)(?:이|가|은|는|도)?\s*(?:너무\s*|자꾸\s*|많이\s*|다\s*)?(?:부족|모자라|꽉|없|줄|찼|차서|안\s*남|확보|도둑|주범|정리|스캔|분석|체크|늘려)|파일(?:이|가)?\s*안\s*(?:받아|열려|깔려|저장)|대용량\s*(?:폴더|파일|캐시|스캔|찾아)|캐시\s*(?:정리|청소|삭제|지워|스캔)|최대\s*절전|hiberfil|capcut|캡컷|npm|크롬\s*캐시)/i.test(
      clean
    );
  const isSecurity2Tier =
    /(보안\s*모듈|보안\s*프로그램|그리드|애드웨어|악성\s*앱|쓸데없는\s*앱|안\s*쓰는\s*프로그램|프로그램\s*(전수|전체|다|모두)?\s*(조사|스캔|분석|찾아|정리)).*(분류|수면|잠재|삭제|지워|골라|조사|스캔|분석)/i.test(
      clean
    ) || /(보안\s*모듈.*?(필요한\s*것만|불필요한|골라|2분류|수면))/i.test(clean);
  const isDesktopDetail =
    /(바탕화면.*?(분석|보고|상세|구성|뭐\s*있|스캔|정리|용량|지저분|어지러)|wd\s*(폴더|아이콘)|이상한\s*(폴더|아이콘)|사용자\s*폴더\s*(아이콘|숨겨|숨김|뭐야))/i.test(
      clean
    );
  const isAppsSurvey =
    /(설치된\s*(프로그램|앱)|안\s*쓰는\s*(프로그램|앱)|쓸데없는\s*(프로그램|앱)).*(전수|전체|조사|스캔|다\s*보여|골라|지워|삭제|제거|알려)/i.test(
      clean
    );
  const isSystemIconQuery =
    /(wd\s*(폴더|아이콘)|이상한\s*(폴더|아이콘)|사용자\s*폴더\s*(아이콘|숨겨|숨김|지워도|뭐야)|바탕화면\s*(시스템|특수)\s*아이콘)/i.test(
      clean
    );
  const isPowerBoostQuery = /(전원\s*(옵션|모드).*?(고성능|바꿔|전환)|고성능\s*(모드|전원))/i.test(clean);

  // 3) 직전 스캔 컨텍스트가 살아있고 유저가 취사선택·제외 필터("빼고", "놔두고", "나머지 다", "빨간색만 지워", "옮겨줘", "D드라이브", "#3번")를 말하는 경우
  const isMultiTurnFilter =
    hasRecentScan &&
    !isAskingExplain &&
    /(빼고|제외|놔두고|놔둬|남기고|냅두고|말고|나머지\s*(?:다|전부|모두)?|빨간색|차단\s*권장|삭제\s*안전|안전\s*캐시만|수동\s*(?:전환|으로)|다\s*(?:지워|삭제|제거|정리|치워|꺼)|[d-zD-Z]\s*:?\s*드라이브|옮겨\s*(?:줘|주세요|라)?|이사\s*(?:해|시켜)?|#\d+|\d+\s*번|만\s*(?:지워|삭제|정리|꺼|치워|숨겨))/i.test(
      clean
    );

  const isHiddenRats =
    /(쥐새끼|스파이웨어|몰래\s*(도|돌|켜|숨|깔)|숨은\s*(앱|프로그램|서비스|스케줄러|프로세스|악성|광고)|백그라운드.*?(전수|수색|조사|찾아|스캔|뭐\s*돌)|수동\s*(전환|으로\s*바꿔)|예스파일|mspcmanager|edgeautolaunch)/i.test(
      clean
    );

  const readTools: AgentCareReadTool[] = [];
  if (isDiskHog) readTools.push('disk_hog_scan');
  if (isSecurity2Tier) readTools.push('security_2tier_scan');
  if (isDesktopDetail) readTools.push('desktop_detail_scan');
  if (isAppsSurvey) readTools.push('installed_apps_list');
  if (isHiddenRats) readTools.push('hidden_rats_scan');

  // 비전문용어 일상 불만어("컴이 왜 이리 버벅거려 / 이상한 거 깔렸나 / 뭐 지우면 돼") ➔ 용량 + 애드웨어·보안모듈 + 미등록 숨은 쥐새끼까지 자동 병렬 스캔!
  if (readTools.length === 0 && !isAskingExplain && !isMultiTurnFilter && isCasualFullCheckup) {
    readTools.push('disk_hog_scan', 'security_2tier_scan', 'hidden_rats_scan');
  }

  return {
    matched: readTools.length > 0 || isMultiTurnFilter || isAskingExplain || isSystemIconQuery || isPowerBoostQuery,
    immediateReadTools: readTools,
    needsGeminiMultiTurnFilter: isMultiTurnFilter,
    needsGeminiExplainOnly: isAskingExplain,
    isSystemIconQuery,
    isPowerBoostQuery,
  };
}
