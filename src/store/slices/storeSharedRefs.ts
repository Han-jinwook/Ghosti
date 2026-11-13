import { getZCoreUrl, zCoreBridge } from '../../services/zCoreBridge';
import { HybridVoiceSession, OnboardingProgressUpdate } from '../../services/aiEngine';
import type {
  FaceMemberCluster,
  FamilyRoomId,
  LoungeType,
  PersonTimelineBucketInfo,
  RoomPersonaMap,
  YearlyFaceBestCut,
} from '../../types/saysee';

export type ViewportLayout = 'mobile' | 'desktop';
export type MobileTab = 'trial' | 'search' | 'trash' | 'settings' | 'share';
export type DesktopTab = 'trial' | 'dashboard' | 'trash' | 'sync' | 'share';
export type ThemeMode = 'light' | 'dark';

export const storeSharedRefs = {
  cancelOnboardingFlag: false,
  latestRunTextQuerySeq: 0,
};

export const voiceSession = new HybridVoiceSession();

export type QuarantineOpResult = {
  done: string[];
  errors: { file: string; error: string }[];
  demo: boolean;
  offline: boolean;
};

export function isMobileOrStoreRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  const isCap = Boolean(
    (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
  );
  if (isCap) return true;
  if (new URLSearchParams(window.location.search).get('storeApp') === '1') return true;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth < 860;
}

export async function requestQuarantineOp(kind: 'move' | 'restore', names: string[]): Promise<QuarantineOpResult> {
  if (!zCoreBridge.isConnected) {
    const isMobileEnv = isMobileOrStoreRuntime();
    return { done: names, errors: [], demo: !isMobileEnv, offline: false };
  }
  try {
    const res = await fetch(getZCoreUrl(`/__quarantine/${kind}`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: names }),
    });
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return { done: [], errors: [], demo: false, offline: true };
    const json = await res.json();
    const list = kind === 'move' ? json?.moved : json?.restored;
    const errors = Array.isArray(json?.errors)
      ? json.errors
      : json?.error
      ? [{ file: '', error: String(json.error) }]
      : [];
    return { done: Array.isArray(list) ? list.map(String) : [], errors, demo: false, offline: false };
  } catch {
    return { done: [], errors: [], demo: false, offline: true };
  }
}

export function quarantineFailureToast(kind: 'move' | 'restore', r: QuarantineOpResult): string {
  const verb = kind === 'move' ? '정리 보관함(휴지통)으로 옮기지' : '되돌리지';
  if (r.offline) return `⚠️ 로컬 엔진에 연결되지 않아 사진을 ${verb} 못했습니다. (아무 파일도 바뀌지 않았습니다)`;
  const first = r.errors[0];
  return `⚠️ 사진을 ${verb} 못했습니다${first ? `: ${first.error}` : '.'}`;
}

export function quarantineResultNote(kind: 'move' | 'restore', r: QuarantineOpResult): string {
  const fail = r.errors.length ? ` (실패 ${r.errors.length}건: ${r.errors[0].error})` : '';
  if (r.demo) {
    return kind === 'move'
      ? '정리 보관함(휴지통)으로 이동했습니다 (↩️ 1초 되돌리기 가능)'
      : '원래 목록으로 복원했습니다';
  }
  return kind === 'move'
    ? `정리 보관함(휴지통)으로 옮겼습니다 (↩️ 1초 되돌리기 가능)${fail}`
    : `원래 위치로 되돌렸습니다${fail}`;
}

export function applyHtmlThemeClass(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (mode === 'light') {
    root.classList.remove('dark');
    root.classList.add('theme-warm-light');
  } else {
    root.classList.remove('theme-warm-light');
    root.classList.add('dark');
  }
}

export const INITIAL_ONBOARDING_PROGRESS: OnboardingProgressUpdate = {
  phase: 'completed',
  done: 24,
  total: 24,
  remaining: 0,
  percent: 100.0,
  elapsedSec: 16,
  etaSec: 0,
  perImageSec: 0.7,
  currentPhotoName: '로컬 서류함 및 동영상 전 구간 타임라인 프레임 자율 색인 완료',
  currentPhotoThumb: '',
  liveVector64: Array.from({ length: 64 }, (_, i) => +(0.2 + Math.abs(Math.sin(i * 0.25)) * 0.75).toFixed(2)),
  modelStatusText: '내 PC 직접 구동(Ghosti_PC_Agent.exe) 100% 로컬 색인 완료 (외부 서버 전송 0 Byte)',
};

/**
 * [느슨한 타임라인의 월(Month)·계절 양방향 확장 검색 인덱싱 사전 (Time-Range Synonym Index)]
 * - 유저가 느슨하게 계절/시기 스틱('1989년 봄' 등)만 눌러도 해당 계절에 속하는 월(1~12월)과 학사 키워드가 자동 바인딩됩니다.
 * - 특히 '2월'은 졸업/신학기 시즌이므로 '겨울'과 '봄' 양쪽에 모두 매칭됩니다.
 */
export const SEASON_TO_MONTH_SYNONYM_INDEX: Record<'봄' | '여름' | '가을' | '겨울', string[]> = {
  봄: ['2월', '3월', '4월', '5월', '봄', '입학', '졸업', '봄소풍'],
  여름: ['6월', '7월', '8월', '여름', '방학', '바다', '수련회'],
  가을: ['9월', '10월', '11월', '가을', '수학여행', '체육대회', '가을소풍'],
  겨울: ['12월', '1월', '2월', '겨울', '졸업식', '눈', '겨울방학'],
};

/**
 * [연도 축약어 자동 동치화 (1989 ↔ 89년 ↔ 89 ↔ 1989년)]
 */
export function buildYearEquivalenceTokens(yearInput: number | string): string[] {
  const digits = String(yearInput).replace(/[^0-9]/g, '');
  if (!digits) return [];
  let fullYear = 1989;
  if (digits.length === 4) {
    fullYear = Number(digits);
  } else if (digits.length === 2) {
    const num = Number(digits);
    fullYear = num >= 50 ? 1900 + num : 2000 + num;
  } else {
    return [digits];
  }
  const short2 = String(fullYear % 100).padStart(2, '0');
  const decadeStart = Math.floor(fullYear / 10) * 10;
  return Array.from(
    new Set([
      String(fullYear),
      `${fullYear}년`,
      short2,
      `${short2}년`,
      `${short2}회`,
      `${decadeStart}년대`,
    ])
  );
}

/**
 * [라운지 고유 명사(성동고, 성동) 기본 상속 추출기]
 * - 간판 키워드가 '성동고 1989'라면 그 방의 모든 사진은 '성동고', '성동'을 기본 상속받습니다.
 */
export function deriveLoungeProperNounTokens(schoolName: string): string[] {
  const clean = (schoolName || '성동고').trim();
  if (!clean) return [];
  const root = clean.replace(/(고등학교|중학교|초등학교|대학교|여고|여중|고|중|초|대)$/, '').trim();
  const tokens = [clean];
  if (root && root.length >= 2) {
    tokens.push(root);
    tokens.push(`${root}고`);
    tokens.push(`${root}고등학교`);
  }
  return Array.from(new Set(tokens));
}

/**
 * 느슨한 타임라인/스틱 정보로부터 양방향 확장 검색 키워드 배열 생성
 */
export function buildBidirectionalStickKeywords(params: {
  year?: number | string;
  season?: string;
  place?: string;
  looseTimelineGroup?: string;
  schoolName?: string;
}): string[] {
  const out = new Set<string>();
  const schoolTokens = deriveLoungeProperNounTokens(params.schoolName || '성동고');
  schoolTokens.forEach((t) => out.add(t));

  if (params.year !== undefined) {
    buildYearEquivalenceTokens(params.year).forEach((t) => out.add(t));
  }

  const combinedText = `${params.season || ''} ${params.place || ''} ${params.looseTimelineGroup || ''}`;
  const yearMatch = combinedText.match(/(19\d{2}|20\d{2}|\b\d{2}년)/);
  if (yearMatch) {
    buildYearEquivalenceTokens(yearMatch[1]).forEach((t) => out.add(t));
  }

  (Object.keys(SEASON_TO_MONTH_SYNONYM_INDEX) as Array<'봄' | '여름' | '가을' | '겨울'>).forEach(
    (seasonKey) => {
      const seasonSyns = SEASON_TO_MONTH_SYNONYM_INDEX[seasonKey];
      if (
        combinedText.includes(seasonKey) ||
        seasonSyns.some((syn) => syn.length >= 2 && combinedText.includes(syn))
      ) {
        seasonSyns.forEach((syn) => out.add(syn));
      }
    }
  );

  if (params.place) {
    out.add(params.place.trim());
    params.place
      .trim()
      .split(/\s+/)
      .filter((w) => w.length >= 2)
      .forEach((w) => out.add(w));
  }
  if (params.looseTimelineGroup) {
    out.add(params.looseTimelineGroup.trim());
  }

  return Array.from(out);
}

/**
 * [방별 별명(Persona) 리졸버]
 * 동일한 이메일 기반 '귀신같이 여권(Ghosti Face Passport)'을 쓰지만,
 * 현재 라운지/방(우리집 / 처가(친정) / 본가(친가) / 동호회·동창회)에 따라 화면 표시 및 검색에 쓰이는 호칭을 반환합니다.
 */
export function getActivePersonaForCluster(
  cluster: FaceMemberCluster,
  activeLoungeType: LoungeType,
  activeFamilyRoom: FamilyRoomId
): {
  displayPersona: string;
  activePersona: string;
  baseName: string;
  roomKey: keyof RoomPersonaMap;
  activeRoomKey: keyof RoomPersonaMap;
  roomLabelKo: string;
  isRoomCreator: boolean;
} {
  const baseName = (cluster.registeredName || '').trim();
  const roomKey: keyof RoomPersonaMap =
    activeLoungeType === 'family' ? activeFamilyRoom : activeLoungeType;
  const roomLabelMap: Record<keyof RoomPersonaMap, string> = {
    personal: '개인 라운지',
    '우리집': '우리집 방',
    '본가(친가)': '본가(친가) 방',
    '처가(친정)': '처가(친정) 방',
    club: '동호회 · 동창회',
    student: '동호회 · 동창회',
    work: '업무 라운지',
  };
  const isRoomCreator = cluster.clusterId === 'face_member_5';
  // 아직 미등록된 신규 인물(baseName === '')은 등록 전까지 빈 문자열 유지
  if (!baseName) {
    return {
      displayPersona: '',
      activePersona: '',
      baseName: '',
      roomKey,
      activeRoomKey: roomKey,
      roomLabelKo: roomLabelMap[roomKey],
      isRoomCreator,
    };
  }
  const mappedPersona = cluster.roomPersonas?.[roomKey]?.trim();
  const activePersona = mappedPersona || baseName;
  return {
    displayPersona: activePersona,
    activePersona,
    baseName,
    roomKey,
    activeRoomKey: roomKey,
    roomLabelKo: roomLabelMap[roomKey],
    isRoomCreator,
  };
}

/**
 * [만국공통 귀신같이 여권(Ghosti Face Passport) & 인물별 독립 타임라인 바구니 + 다년도·다각도 자동 추출]
 * 1. 바구니 기준 연도(anchorCreationYear)는 방(Room)이 아닌 각 인물의 시드 최초 생성 연도(예: 기존 가족 2026년 vs 신규 합류 처가 식구 2029년)에 귀속!
 * 2. 성인 10년(2026~2017, 미래 2027~2036) / 미성년 5년(2026~2022, 미래 2027~2031) 바구니 자동 구성
 * 3. 이메일(Email ID) 기반 귀신같이 여권에 영구 귀속되어 어느 방에 가든 무질문 자동 장착되며, 타인은 실제 이름(백은숙·한치우·한지우·한천우·한민수)으로 통일하고 '나(본인)'만 별명+이름 세트('멀린' ↔ '한진욱')로 매핑!
 */
export function buildAutoMultiConditionSeedClusters(rawClusters: FaceMemberCluster[]): FaceMemberCluster[] {
  if (!Array.isArray(rawClusters) || rawClusters.length === 0) {
    return [];
  }
  const savedOverrides = loadCustomFaceRegistrations();
  const enriched = rawClusters.map((c) => {
    const baseCuts: YearlyFaceBestCut[] =
      Array.isArray(c.yearlyBestCuts) && c.yearlyBestCuts.length > 0
        ? c.yearlyBestCuts.map((yc, idx) => ({
            ...yc,
            conditionTag:
              yc.conditionTag ?? (idx === 0 ? '정면·선명' : '측면·미소'),
            conditionShortKo:
              yc.conditionShortKo ?? (idx === 0 ? '정면' : '측면'),
            sourceDeviceKo: yc.sourceDeviceKo ?? '호스트 원본',
          }))
        : [
            {
              year: c.representativeYear || 2026,
              representativePhoto: c.representativePhoto,
              representativeDate: c.representativeDate,
              frontalScore: c.frontalScore,
              opticalSharpness: c.opticalSharpness,
              avatarUrl: c.avatarUrl,
              cropUrl: c.cropUrl,
              boundingBox: c.boundingBox,
              conditionTag: '정면·선명',
              conditionShortKo: '정면',
              sourceDeviceKo: '호스트 원본',
            },
          ];

    const extraCuts: YearlyFaceBestCut[] = [];
    let passportEmail = c.passportEmail || 'member@ghosti.ai';
    let timelineBucket: PersonTimelineBucketInfo = c.timelineBucket || {
      anchorCreationYear: 2026,
      bucketSpanYears: 10,
      ageCategoryLabel: '성인 10년 주기',
      primaryBucketRange: '2026~2017',
      forwardBucketRange: '2027~2036',
      forwardBucketActive: true,
      filledStyleSlots: ['정면·선명', '측면·미소', '야외·노을'],
    };
    const userOverride = savedOverrides[c.clusterId];
    const hasUserRegisteredName = Boolean(userOverride?.registeredName?.trim());
    let roomPersonas: RoomPersonaMap = hasUserRegisteredName ? userOverride?.roomPersonas || {} : {};
    let crossLoungeEvolutionNote =
      c.crossLoungeEvolutionNote ||
      '🛂 이메일 여권 영구 귀속 · 전 라운지 무질문 자동 연동됨';

    if (c.clusterId === 'face_member_3' || c.personKey === 'person_adult_female_partner') {
      passportEmail = 'eunsook@ghosti.ai';
      timelineBucket = {
        anchorCreationYear: 2026,
        bucketSpanYears: 10,
        ageCategoryLabel: '성인 10년 주기',
        primaryBucketRange: '2026~2017',
        forwardBucketRange: '2027~2036',
        forwardBucketActive: true,
        filledStyleSlots: ['정면·선명', '야외·노을', '측면·미소', '선글라스·역광'],
      };
      crossLoungeEvolutionNote =
        '🏠 처가방 여행 사진에서 [야외·노을] 슬롯 진화 ➔ 전 라운지 여권 자동 동기화됨';

      if (!baseCuts.some((yc) => yc.year === 2025)) {
        extraCuts.push({
          year: 2025,
          representativePhoto: '20240720_182301.jpg',
          representativeDate: '2025.07.20',
          frontalScore: 0.94,
          opticalSharpness: 28400,
          avatarUrl: '/__faces/crop?file=20240720_182301.jpg&box=148,408,268,486',
          cropUrl: '/__faces/crop?file=20240720_182301.jpg&box=148,408,268,486',
          boundingBox: [148, 408, 268, 486],
          conditionTag: '야외·노을',
          conditionShortKo: '야외·노을',
          sourceDeviceKo: '치우 폰 자동결합',
        });
      }
    } else if (c.clusterId === 'face_member_5' || c.personKey === 'person_adult_male_host') {
      passportEmail = 'merlin@ghosti.ai';
      timelineBucket = {
        anchorCreationYear: 2026,
        bucketSpanYears: 10,
        ageCategoryLabel: '성인 10년 주기',
        primaryBucketRange: '2026~2017',
        forwardBucketRange: '2027~2036',
        forwardBucketActive: true,
        filledStyleSlots: ['정면·선명', '측면·미소', '야외·노을', '선글라스·역광'],
      };
      crossLoungeEvolutionNote =
        '⛳ 동호·동창회방 라운딩 사진에서 [선글라스·역광] 슬롯 무언 교체(94.2%) ➔ 처가집 방("한진욱 선글라스") 자동 전파됨';

      if (!baseCuts.some((yc) => yc.year === 2023)) {
        extraCuts.push({
          year: 2023,
          representativePhoto: '20240721_183234.jpg',
          representativeDate: '2023.07.21',
          frontalScore: 0.91,
          opticalSharpness: 31200,
          avatarUrl: '/__faces/crop?file=20240721_183234.jpg&box=165,198,390,325',
          cropUrl: '/__faces/crop?file=20240721_183234.jpg&box=165,198,390,325',
          boundingBox: [165, 198, 390, 325],
          conditionTag: '선글라스·역광',
          conditionShortKo: '선글라스',
          sourceDeviceKo: '은숙 폰 자동결합',
        });
      }
    } else if (c.clusterId === 'face_member_1' || c.personKey === 'person_youth_glasses_2') {
      passportEmail = 'chiwoo@ghosti.ai';
      timelineBucket = {
        anchorCreationYear: 2026,
        bucketSpanYears: 5,
        ageCategoryLabel: '미성년 5년 주기',
        primaryBucketRange: '2026~2022',
        forwardBucketRange: '2027~2031',
        forwardBucketActive: true,
        filledStyleSlots: ['정면·선명', '측면·미소', '야외·노을'],
      };
      crossLoungeEvolutionNote =
        '📱 게스트 폰 동반 등장(4회)으로 [측면·미소] 슬롯 여권 자동 진화됨';

      if (!baseCuts.some((yc) => yc.year === 2025)) {
        extraCuts.push({
          year: 2025,
          representativePhoto: '20260926_160221.jpg',
          representativeDate: '2025.09.26',
          frontalScore: 0.93,
          opticalSharpness: 29800,
          avatarUrl: '/__faces/crop?file=20260926_160221.jpg&box=475,598,558,650',
          cropUrl: '/__faces/crop?file=20260926_160221.jpg&box=475,598,558,650',
          boundingBox: [475, 598, 558, 650],
          conditionTag: '측면·미소',
          conditionShortKo: '측면·야외',
          sourceDeviceKo: '은숙 폰 자동결합',
        });
      }
    } else if (c.clusterId === 'face_member_4') {
      passportEmail = 'jiwoo@ghosti.ai';
      timelineBucket = {
        anchorCreationYear: 2026,
        bucketSpanYears: 5,
        ageCategoryLabel: '미성년 5년 주기',
        primaryBucketRange: '2026~2022',
        forwardBucketRange: '2027~2031',
        forwardBucketActive: true,
        filledStyleSlots: ['정면·선명', '야외·노을', '측면·미소', '야간·실내'],
      };
      crossLoungeEvolutionNote =
        '🎒 친구 모임방(동호회 · 동창회)에서 [야간·실내] 슬롯 진화(유사도 93.8%) ➔ 우리집 가족방 과거 사진 +7장 자동 구출됨!';

      if (baseCuts.length < 2) {
        extraCuts.push({
          year: 2024,
          representativePhoto: '20260926_131225.jpg',
          representativeDate: '2024.09.26',
          frontalScore: 0.92,
          opticalSharpness: 26500,
          avatarUrl: '/__faces/crop?file=20260926_131225.jpg&box=445,180,525,236',
          cropUrl: '/__faces/crop?file=20260926_131225.jpg&box=445,180,525,236',
          boundingBox: [445, 180, 525, 236],
          conditionTag: '야외·노을',
          conditionShortKo: '야외·측면',
          sourceDeviceKo: '친구방 여권진화',
        });
      }
    } else if (c.clusterId === 'face_member_2') {
      passportEmail = 'cheonwoo@ghosti.ai';
      timelineBucket = {
        anchorCreationYear: 2026,
        bucketSpanYears: 5,
        ageCategoryLabel: '미성년 5년 주기',
        primaryBucketRange: '2026~2022',
        forwardBucketRange: '2027~2031',
        forwardBucketActive: false,
        filledStyleSlots: ['정면·선명', '야외·노을'],
      };
      crossLoungeEvolutionNote =
        '🛂 가족방 초벌 여권 이메일 귀속 완료 (어느 방에 가든 무질문 자동 작동)';

      if (baseCuts.length < 2) {
        extraCuts.push({
          year: 2024,
          representativePhoto: '20260926_131225.jpg',
          representativeDate: '2024.09.26',
          frontalScore: 0.92,
          opticalSharpness: 26500,
          avatarUrl: '/__faces/crop?file=20260926_131225.jpg&box=445,180,525,236',
          cropUrl: '/__faces/crop?file=20260926_131225.jpg&box=445,180,525,236',
          boundingBox: [445, 180, 525, 236],
          conditionTag: '야외·노을',
          conditionShortKo: '야외·측면',
          sourceDeviceKo: '멤버 폰 자동결합',
        });
      }
    }

    const mergedYearlyRaw = [...baseCuts, ...extraCuts].sort((a, b) => b.year - a.year);
    const slot1Anchor = mergedYearlyRaw[0] || {
      year: c.representativeYear || 2026,
      representativePhoto: c.representativePhoto,
      representativeDate: c.representativeDate || '2026.10.02',
      frontalScore: c.frontalScore || 0.99,
      opticalSharpness: c.opticalSharpness || 35000,
      avatarUrl: c.cropUrl || c.avatarUrl,
      cropUrl: c.cropUrl || c.avatarUrl,
      boundingBox: c.boundingBox,
      conditionTag: '정면·선명' as const,
      conditionShortKo: '① 정면',
      sourceDeviceKo: '귀신같이 여권 최신 기준컷',
    };

    const secondCut = mergedYearlyRaw[1] || slot1Anchor;
    const thirdCut = mergedYearlyRaw[2] || secondCut;

    // 5대 스타일 슬롯 표준화: ① 정면(당해 연도 Anchor) / ② 활짝 미소 / ③ 측면 / ④ 선글라스 / ⑤ 야외
    const fiveStyleSlotCuts: YearlyFaceBestCut[] = [
      {
        ...slot1Anchor,
        year: Math.max(slot1Anchor.year || 2026, 2026),
        conditionTag: '정면·선명',
        conditionShortKo: '① 정면',
        sourceDeviceKo: '당해 연도 정면 기준컷 (Slot 1)',
      },
      {
        ...secondCut,
        year: secondCut.year || 2025,
        conditionTag: '측면·미소',
        conditionShortKo: '② 활짝 미소',
        sourceDeviceKo: secondCut.sourceDeviceKo || '가족방 미소 베스트컷',
      },
      {
        ...thirdCut,
        year: thirdCut.year || 2024,
        conditionTag: '측면·미소',
        conditionShortKo: '③ 측면',
        sourceDeviceKo: thirdCut.sourceDeviceKo || '측면 자연스러운 컷',
      },
      {
        ...(mergedYearlyRaw.find((y) => y.conditionTag === '선글라스·역광') || secondCut),
        year: 2024,
        conditionTag: '선글라스·역광',
        conditionShortKo: '④ 선글라스',
        sourceDeviceKo: '여행·라운딩 선글라스 컷',
      },
      {
        ...(mergedYearlyRaw.find((y) => y.conditionTag === '야외·노을') || slot1Anchor),
        year: 2025,
        conditionTag: '야외·노을',
        conditionShortKo: '⑤ 야외',
        sourceDeviceKo: '야외 자연광 베스트컷',
      },
    ];

    let savedSlotIdx = 0;
    try {
      const rawPrefs =
        typeof localStorage !== 'undefined'
          ? localStorage.getItem('ghosti_doorplate_slot_prefs')
          : null;
      if (rawPrefs) {
        const parsed = JSON.parse(rawPrefs);
        if (typeof parsed[c.clusterId] === 'number') {
          savedSlotIdx = Math.max(0, Math.min(4, parsed[c.clusterId]));
        }
      }
    } catch {
      /* ignore */
    }

    const activeSlot = fiveStyleSlotCuts[savedSlotIdx] || fiveStyleSlotCuts[0];
    const autoDoorplateUrl =
      activeSlot.cropUrl || activeSlot.avatarUrl || c.cropUrl || c.avatarUrl;

    return {
      ...c,
      // 여권 등록을 직접 하지 않은 상태에서는 실제 가족 인물이 미리 등록되어 있지 않도록 초기화
      registeredName: userOverride?.registeredName ?? '',
      relationshipTag: userOverride?.relationshipTag ?? '',
      excludedAsPasserby:
        userOverride?.excludedAsPasserby !== undefined
          ? userOverride.excludedAsPasserby
          : c.excludedAsPasserby,
      passportEmail,
      timelineBucket: {
        ...timelineBucket,
        filledStyleSlots: ['① 정면', '② 활짝 미소', '③ 측면', '④ 선글라스', '⑤ 야외'],
      },
      roomPersonas,
      crossLoungeEvolutionNote,
      yearlyBestCuts: fiveStyleSlotCuts,
      activeDoorplateSlotIndex: savedSlotIdx,
      doorplateSlotLabelKo: activeSlot.conditionShortKo || '① 정면',
      avatarUrl: autoDoorplateUrl,
      cropUrl: autoDoorplateUrl,
    };
  });

  return enriched;
}

const CUSTOM_FACE_REGISTRATIONS_KEY = 'ghosti_custom_face_registrations_v1';

interface CustomFaceOverride {
  registeredName?: string;
  relationshipTag?: string;
  roomPersonas?: RoomPersonaMap;
  excludedAsPasserby?: boolean;
}

export function loadCustomFaceRegistrations(): Record<string, CustomFaceOverride> {
  try {
    const raw =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem(CUSTOM_FACE_REGISTRATIONS_KEY)
        : null;
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, CustomFaceOverride>;
  } catch {
    return {};
  }
}

export function saveCustomFaceRegistration(clusterId: string, patch: CustomFaceOverride): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const prev = loadCustomFaceRegistrations();
    const prevItem = prev[clusterId] || {};
    const nextItem: CustomFaceOverride = {
      ...prevItem,
      ...patch,
      roomPersonas: patch.roomPersonas
        ? { ...(prevItem.roomPersonas ?? {}), ...patch.roomPersonas }
        : prevItem.roomPersonas,
    };
    prev[clusterId] = nextItem;
    localStorage.setItem(CUSTOM_FACE_REGISTRATIONS_KEY, JSON.stringify(prev));
  } catch {
    /* ignore */
  }
}

export function restoreAllExcludedCustomFaceRegistrations(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const prev = loadCustomFaceRegistrations();
    for (const k of Object.keys(prev)) {
      prev[k] = { ...prev[k], excludedAsPasserby: false };
    }
    localStorage.setItem(CUSTOM_FACE_REGISTRATIONS_KEY, JSON.stringify(prev));
  } catch {
    /* ignore */
  }
}
