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
  | 'installed_apps_list';

export type AgentCareMutatingAction =
  | 'disk_hog_clean'
  | 'batch_deep_uninstall'
  | 'desktop_batch_action'
  | 'security_2tier_apply'
  | 'desktop_system_icon_toggle'
  | 'desktop_power_boost';

export interface AgentCareScanItem {
  no: number;
  id: string;
  name: string;
  cat: string;
  sizeMb: number;
  detailKo?: string;
  path?: string;
  actionType?: string;
  movableToOtherDrive?: boolean;
  defaultSelected?: boolean;
  isProtected?: boolean;
}

export interface AgentCareScanContext {
  updatedAt: number;
  scanKind: 'DISK_HOG' | 'SECURITY_2TIER' | 'DESKTOP_DETAIL' | 'INSTALLED_APPS' | 'MULTI';
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
  const [diskRes, secRes, deskRes, appsRes] = await Promise.all([
    uniqueTools.includes('disk_hog_scan') ? callCareApi<any>('/api/care/disk-hog-scan') : Promise.resolve(null),
    uniqueTools.includes('security_2tier_scan') ? callCareApi<any>('/api/care/security-2tier-scan') : Promise.resolve(null),
    uniqueTools.includes('desktop_detail_scan') ? callCareApi<any>('/api/care/desktop-detail-scan') : Promise.resolve(null),
    uniqueTools.includes('installed_apps_list') ? callCareApi<any>('/api/care/installed-apps-list?limit=80') : Promise.resolve(null),
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

  const followUps: string[] = [];
  if (scanKind === 'DISK_HOG' || uniqueTools.includes('disk_hog_scan')) {
    followUps.push('체크된 안전 캐시만 지금 다 정리해줘');
    if (availMoveDrives.length > 0) {
      followUps.push(`다운로드 큰 파일은 ${availMoveDrives[0].drive} 드라이브로 옮겨줘`);
    }
    followUps.push('안 쓰는 프로그램이랑 애드웨어도 조사해줘');
  } else if (scanKind === 'SECURITY_2TIER') {
    followUps.push('빨간색 애드웨어·그리드만 다 지우고, 은행 보안모듈은 잠재워줘');
    followUps.push('C드라이브 대용량 공간 도둑도 스캔해줘');
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
    '  - 조회(readTools): "disk_hog_scan"(C드라이브 대용량·캐시·hiberfil 스캔), "security_2tier_scan"(보안모듈 수면 vs 악성애드웨어·그리드 2분류), "desktop_detail_scan"(바탕화면 폴더 구성·특수아이콘 진단), "installed_apps_list"(설치 앱 전체 목록)',
    '  - 변경(mutatingPlan.action): "disk_hog_clean"(캐시·hiberfil 정리/D: 이사), "batch_deep_uninstall"(다중 앱·애드웨어 취사선택 일괄 제거), "desktop_batch_action"(바탕화면 선택 항목 휴지통/D: 이사/아이콘 숨김), "security_2tier_apply"(실사용 보안모듈 수면 + 애드웨어 삭제), "desktop_system_icon_toggle"(WD 사용자폴더 등 특수아이콘 숨김), "desktop_power_boost"(데스크톱 고성능 전원 전환)',
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
    '    "action": "disk_hog_clean" | "batch_deep_uninstall" | "desktop_batch_action" | "security_2tier_apply" | "desktop_system_icon_toggle" | "desktop_power_boost",',
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
  const timer = setTimeout(() => controller.abort(), 5500);
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
    if (!res.ok) return null;
    const data = await res.json();
    const raw = String(data?.text || '')
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    const sIdx = raw.indexOf('{');
    const eIdx = raw.lastIndexOf('}');
    if (sIdx < 0 || eIdx <= sIdx) return null;
    const parsed = JSON.parse(raw.slice(sIdx, eIdx + 1));
    if (!parsed || typeof parsed.replyKo !== 'string') return null;
    return {
      replyKo: parsed.replyKo.trim(),
      readTools: Array.isArray(parsed.readTools) ? parsed.readTools : [],
      mutatingPlan: parsed.mutatingPlan || null,
      followUpSuggestions: Array.isArray(parsed.followUpSuggestions)
        ? parsed.followUpSuggestions.map((x: any) => String(x || '').trim()).filter(Boolean).slice(0, 3)
        : [],
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
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

  if (card.action === 'desktop_power_boost') {
    const r = await callCareApi<any>('/api/care/desktop-power-boost', { userApprovalTypedText: userApprovalText }, 15000);
    return {
      ok: r.ok,
      reportKo: String(r.data?.message || (r.ok ? '데스크톱 고성능 전원 모드로 전환했습니다!' : '전원 모드 전환을 완료하지 못했습니다.')),
    };
  }

  if (card.action === 'desktop_system_icon_toggle') {
    const iconIds = (card.visibleSystemIcons || []).map((i) => i.iconId);
    const targetId = iconIds[0] || 'user_files';
    const r = await callCareApi<any>('/api/care/desktop-icon-toggle', { iconId: targetId, hide: true }, 10000);
    return {
      ok: r.ok,
      reportKo: String(r.data?.message || (r.ok ? '바탕화면 시스템 아이콘을 안전하게 숨겼습니다!' : '아이콘 숨김을 완료하지 못했습니다.')),
    };
  }

  if (card.action === 'disk_hog_clean') {
    const r = await callCareApi<any>(
      '/api/care/disk-hog-clean',
      {
        includeIds: selectedItems.map((i) => i.id),
        excludeIds: card.excludedNames || [],
        moveDestinationDrive: card.moveDestinationDrive || '',
        userApprovalTypedText: userApprovalText,
      },
      60000
    );
    return {
      ok: r.ok,
      reportKo: String(r.data?.reportKo || r.data?.message || (r.ok ? '대용량 공간 정리를 완료했습니다!' : `정리 중 오류가 발생했습니다(${r.error}).`)),
      currentFreeGb: typeof r.data?.currentFreeGb === 'number' ? r.data.currentFreeGb : undefined,
      projectedFreeAfterEmptyGb:
        typeof r.data?.projectedFreeAfterEmptyGb === 'number' ? r.data.projectedFreeAfterEmptyGb : undefined,
    };
  }

  if (card.action === 'desktop_batch_action') {
    const paths = selectedItems.map((i) => i.path || '').filter(Boolean);
    const isMove = Boolean(card.moveDestinationDrive);
    const r = await callCareApi<any>(
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
    return {
      ok: r.ok,
      reportKo: String(r.data?.reportKo || (r.ok ? '바탕화면 선택 정리를 완료했습니다!' : `정리 중 오류가 발생했습니다(${r.error}).`)),
    };
  }

  // batch_deep_uninstall 또는 security_2tier_apply
  const pupIds = selectedItems.filter((i) => i.id.startsWith('pup_')).map((i) => i.id);
  const sleepItems = selectedItems.filter((i) => i.actionType === 'SECURITY_SLEEP');
  const appNames = selectedItems
    .filter((i) => !i.id.startsWith('pup_') && i.actionType !== 'SECURITY_SLEEP')
    .map((i) => i.name);

  const reportBlocks: string[] = [];
  let anyOk = false;

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
    if (rBatch.data?.reportKo) reportBlocks.push(String(rBatch.data.reportKo));
  }

  if (sleepItems.length > 0 || card.action === 'security_2tier_apply') {
    const rSlp = await callCareApi<any>('/api/care/sleep', { explicitOptIn: true }, 20000);
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
  };
}

/**
 * 유저 발화가 신규 '제미니 에이전트 자유 문답 + 다중 PC 정리' 트랙에 해당하는지 정밀 판별
 */
export function detectAgentCareIntent(
  clean: string,
  scanContext: AgentCareScanContext | null
): {
  matched: boolean;
  immediateReadTools: AgentCareReadTool[];
  needsGeminiMultiTurnFilter: boolean;
  isSystemIconQuery: boolean;
  isPowerBoostQuery: boolean;
} {
  const isDiskHog =
    /(c\s*드라이브|용량\s*(부족|꽉|없|줄|확보|도둑|주범|정리|스캔|분석|체크)|공간\s*(부족|확보|정리|도둑|주범|스캔|분석)|대용량\s*(폴더|파일|캐시|스캔|찾아)|캐시\s*(정리|청소|삭제|지워|스캔)|최대\s*절전|hiberfil|capcut|캡컷|npm|크롬\s*캐시)/i.test(
      clean
    );
  const isSecurity2Tier =
    /(보안\s*모듈|보안\s*프로그램|그리드|애드웨어|악성\s*앱|쓸데없는\s*앱|안\s*쓰는\s*프로그램|프로그램\s*(전수|전체|다|모두)?\s*(조사|스캔|분석|찾아|정리)).*(분류|수면|잠재|삭제|지워|골라|조사|스캔|분석)/i.test(
      clean
    ) || /(보안\s*모듈.*?(필요한\s*것만|불필요한|골라|2분류|수면))/i.test(clean);
  const isDesktopDetail =
    /(바탕화면.*?(분석|보고|상세|구성|뭐\s*있|스캔|정리|용량)|wd\s*(폴더|아이콘)|이상한\s*(폴더|아이콘)|사용자\s*폴더\s*(아이콘|숨겨|숨김|뭐야))/i.test(
      clean
    );
  const isAppsSurvey =
    /(설치된\s*(프로그램|앱)|안\s*쓰는\s*(프로그램|앱)|쓸데없는\s*(프로그램|앱)).*(전수|전체|조사|스캔|다\s*보여|골라|지워|삭제|제거)/i.test(
      clean
    );
  const isSystemIconQuery =
    /(wd\s*(폴더|아이콘)|이상한\s*(폴더|아이콘)|사용자\s*폴더\s*(아이콘|숨겨|숨김|지워도|뭐야)|바탕화면\s*(시스템|특수)\s*아이콘)/i.test(
      clean
    );
  const isPowerBoostQuery = /(전원\s*(옵션|모드).*?(고성능|바꿔|전환)|고성능\s*(모드|전원))/i.test(clean);

  // 직전 스캔 컨텍스트가 살아있고 유저가 취사선택·제외 필터("빼고", "놔두고", "나머지 다", "옮겨줘", "D드라이브", "#3번")를 말하는 경우
  const isMultiTurnFilter =
    Boolean(scanContext && scanContext.items.length > 0 && Date.now() - scanContext.updatedAt < 25 * 60 * 1000) &&
    /(빼고|제외하고|놔두고|놔둬|남기고|냅두고|말고|나머지\s*(다|전부|모두)|다\s*(지워|삭제|제거|정리|치워)|d\s*드라이브|옮겨\s*(줘|주세요|라)|이사\s*(해|시켜)|#\d+|\d+\s*번)/i.test(
      clean
    );

  const readTools: AgentCareReadTool[] = [];
  if (isDiskHog) readTools.push('disk_hog_scan');
  if (isSecurity2Tier) readTools.push('security_2tier_scan');
  if (isDesktopDetail) readTools.push('desktop_detail_scan');
  if (isAppsSurvey) readTools.push('installed_apps_list');

  return {
    matched: readTools.length > 0 || isMultiTurnFilter || isSystemIconQuery || isPowerBoostQuery,
    immediateReadTools: readTools,
    needsGeminiMultiTurnFilter: isMultiTurnFilter,
    isSystemIconQuery,
    isPowerBoostQuery,
  };
}
