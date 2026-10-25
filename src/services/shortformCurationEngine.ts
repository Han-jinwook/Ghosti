/**
 * 🎬 제트아이 Z몬스터 — 맥락 맞춤 '1분 활용팁 숏폼' 큐레이션 & 무토큰(Zero-LLM) 투시검색 라우팅 엔진
 *
 * [멀린님 확정 3대 원칙]
 * 1. 노출 빈도 (2회당 1번): 매번 나오면 반감이 생기므로 Z몬스터 작업 완료 2회당 1번(짝수 회차)에만 노출합니다.
 * 2. 구독 중인 라운지 주제 제외: 유저가 이미 '가족방(family)'을 구독 중이면 가족방 주제는 빼고, 미구독 라운지 주제만 추천합니다.
 * 3. 영구 잠금 금지 & 새 영상 우선 순환: 읽은 영상을 영구히 잠그지 않고, 미구독 라운지의 안 본 새 영상(shownCount === 0)을
 *    최우선 노출하되 모두 본 경우 가장 오래전에 본 영상부터 자연 순환합니다.
 */

export type LoungeCategory = 'family' | 'club' | 'work' | 'general';

export interface ShortformTipItem {
  id: string;
  title: string;
  durationLabel: string;
  targetLounge: LoungeCategory;
  contextTags: Array<'cleanup' | 'restore' | 'photo' | 'doc' | 'os_repair'>;
  shortUrl: string;
  summaryText: string;
}

export const ZEYE_SHORTFORM_TIPS_CATALOG: ShortformTipItem[] = [
  {
    id: 'sf_family_01',
    title: '🎬 [1분 활용팁] 방금 정리한 가족사진, 카톡 압축 없이 원본 화질 그대로 가족들과 자동 공유하는 법',
    durationLabel: '0:55',
    targetLounge: 'family',
    contextTags: ['cleanup', 'photo'],
    shortUrl: 'https://youtube.com/shorts/zeye-family-sync-tip01',
    summaryText: 'AI 얼굴 여권으로 우리 가족 사진만 0.01초 만에 모아 패밀리 라운지에 올리는 꿀팁',
  },
  {
    id: 'sf_family_02',
    title: '🎬 [1분 활용팁] 부모님 폰 용량 꽉 찼을 때, 내 PC로 원본 백업하고 폰은 가볍게 비워드리는 법',
    durationLabel: '0:48',
    targetLounge: 'family',
    contextTags: ['cleanup', 'restore', 'photo'],
    shortUrl: 'https://youtube.com/shorts/zeye-family-backup-tip02',
    summaryText: '13KB 초경량 썸네일만 남기고 원본은 방장 PC에 영구 보존하는 비결',
  },
  {
    id: 'sf_work_01',
    title: '🎬 [1분 활용팁] 정리된 세무·계약 서류, 클라우드 월세 0원으로 직원들과 S:드라이브로 같이 쓰는 법',
    durationLabel: '0:58',
    targetLounge: 'work',
    contextTags: ['cleanup', 'doc', 'os_repair'],
    shortUrl: 'https://youtube.com/shorts/zeye-work-sdrive-tip01',
    summaryText: '구글 드라이브/마이박스 폴더 그대로 연결해 1초 만에 계약서 본문까지 투시 검색하기',
  },
  {
    id: 'sf_work_02',
    title: '🎬 [1분 활용팁] 실수로 덮어쓴 엑셀·한글 문서, 제트아이 [복원 기록] 타임머신으로 1초 만에 살리는 법',
    durationLabel: '0:52',
    targetLounge: 'work',
    contextTags: ['restore', 'doc', 'os_repair'],
    shortUrl: 'https://youtube.com/shorts/zeye-work-restore-tip02',
    summaryText: '랜섬웨어 서킷브레이커와 직전 5버전 타임머신 100% 활용 가이드',
  },
  {
    id: 'sf_club_01',
    title: '🎬 [1분 활용팁] 등산·골프 모임 단체사진 똑같은 컷 5번씩 올라올 때, 중복 0%로 깔끔하게 모으는 법',
    durationLabel: '0:50',
    targetLounge: 'club',
    contextTags: ['photo', 'cleanup'],
    shortUrl: 'https://youtube.com/shorts/zeye-club-dhash-tip01',
    summaryText: '64-bit 픽셀 뼈대(dHash) 대조로 이미 올라간 단체사진은 알아서 빼주는 모임방 기능',
  },
];

const STORAGE_KEY_COMPLETION_COUNT = 'zeye_doctor_completion_count_v1';
const STORAGE_KEY_SHOWN_MAP = 'zeye_shortform_shown_map_v1';

interface ShownRecord {
  count: number;
  lastShownAt: number;
}

/**
 * Z몬스터 작업 완료 시 호출하여 2회당 1번(짝수 회차) & 구독 중인 라운지 제외 & 새 영상 우선 순환으로 숏폼 1개를 선정합니다.
 */
export function pickNextShortformTipOnCompletion(params: {
  contextTag: 'cleanup' | 'restore' | 'photo' | 'doc' | 'os_repair';
  subscribedLounges: LoungeCategory[];
}): { shouldShow: boolean; completionCount: number; tip: ShortformTipItem | null } {
  try {
    const prevCount = Number(localStorage.getItem(STORAGE_KEY_COMPLETION_COUNT) || '0') || 0;
    const nextCount = prevCount + 1;
    localStorage.setItem(STORAGE_KEY_COMPLETION_COUNT, String(nextCount));

    // 1) 2회당 1번만 노출 (홀수 회차는 스킵)
    if (nextCount % 2 !== 0) {
      return { shouldShow: false, completionCount: nextCount, tip: null };
    }

    // 2) 이미 구독 중인 라운지 주제는 제외 (미구독 라운지만 필터링)
    const subscribedSet = new Set(params.subscribedLounges || []);
    let candidates = ZEYE_SHORTFORM_TIPS_CATALOG.filter(
      (item) => item.targetLounge === 'general' || !subscribedSet.has(item.targetLounge)
    );

    if (candidates.length === 0) {
      return { shouldShow: false, completionCount: nextCount, tip: null };
    }

    // 맥락 태그 일치 우선 필터링
    const contextMatched = candidates.filter((item) => item.contextTags.includes(params.contextTag));
    if (contextMatched.length > 0) {
      candidates = contextMatched;
    }

    // 3) 영구 잠금 금지 -> 안 본 새 영상(count === 0) 최우선, 다 봤으면 가장 오래전에 본 영상 순환
    const rawMap = localStorage.getItem(STORAGE_KEY_SHOWN_MAP);
    const shownMap: Record<string, ShownRecord> = rawMap ? JSON.parse(rawMap) : {};

    candidates.sort((a, b) => {
      const recA = shownMap[a.id] || { count: 0, lastShownAt: 0 };
      const recB = shownMap[b.id] || { count: 0, lastShownAt: 0 };
      if (recA.count === 0 && recB.count > 0) return -1;
      if (recB.count === 0 && recA.count > 0) return 1;
      return recA.lastShownAt - recB.lastShownAt;
    });

    const chosen = candidates[0];
    const prevRec = shownMap[chosen.id] || { count: 0, lastShownAt: 0 };
    shownMap[chosen.id] = {
      count: prevRec.count + 1,
      lastShownAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY_SHOWN_MAP, JSON.stringify(shownMap));

    return {
      shouldShow: true,
      completionCount: nextCount,
      tip: chosen,
    };
  } catch {
    return { shouldShow: false, completionCount: 0, tip: null };
  }
}

/**
 * Z몬스터 대화창에 입력된 문장이 '단순 파일/사진 찾기'인지 0.001초 만에 로컬 판별 (LLM 토큰 0원)
 */
export function detectZeroLlmPerspectiveSearchIntent(userInput: string): {
  isSimpleSearchIntent: boolean;
  extractedKeyword: string;
} {
  const text = (userInput || '').trim();
  if (!text) return { isSimpleSearchIntent: false, extractedKeyword: '' };

  // 정리/이동/숨김/복원/수리 명령어가 들어있으면 Z몬스터 고유 작업으로 분류
  const doctorActionRegex = /(정리|옮겨|이동|숨겨|숨김|복원|되돌려|고쳐|수리|안\s*돼|안\s*나와|오류|에러|느려|폴더\s*만들)/i;
  if (doctorActionRegex.test(text)) {
    return { isSimpleSearchIntent: false, extractedKeyword: '' };
  }

  // 단순 검색/열람 패턴 ("~찾아줘", "~보여줘", "~어디 있어?")
  const searchMatch = text.match(/^(.+?)\s*(찾아\s*줘|보여\s*줘|어디\s*있어|어딨어|열어\s*줘|검색해\s*줘)\??$/i);
  if (searchMatch && searchMatch[1]) {
    const cleaned = searchMatch[1]
      .replace(/(사진|문서|파일|서류|계약서|영수증)\s*중에서/g, '$1')
      .trim();
    return {
      isSimpleSearchIntent: true,
      extractedKeyword: cleaned || text,
    };
  }

  return { isSimpleSearchIntent: false, extractedKeyword: '' };
}

export const DOCTOR_3_RED_LINES_NOTICE = [
  '🛡️ 영구 삭제(포맷/와이핑) 불가: Z몬스터는 이동·분류·숨김·휴지통 보호만 수행하며 파일을 영구 삭제(Shift+Del)하지 않습니다.',
  '🔒 OS 시스템 폴더 개조 불가: C:\\Windows, Program Files 등 시스템 안정성 영역은 절대 건드리지 않습니다.',
  '👆 금융·메신저 대리 전송 불가 (Zero-Auto-Action): 홈택스 제출·계좌이체·메신저 발송은 화살표 안내와 입력칸 세팅까지만 돕고 최종 실행은 유저가 직접 누릅니다.',
];
