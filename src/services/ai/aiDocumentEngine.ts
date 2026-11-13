import { getZCoreUrl, zCoreBridge, hasActiveGhostiLoginSession } from '../zCoreBridge';
import type { LocalDocumentFile } from '../../types/saysee';
import {
  extractKoStems,
  matchKoTokenInStems,
  matchKoreanOcrFuzzyToken,
} from './aiSharedRuntime';

export const LOCAL_DOCUMENT_FILES: LocalDocumentFile[] = [];

export const GDRIVE_SMART_DOC_ITEMS: LocalDocumentFile[] = [
  {
    id: 'doc_1_주택임대차_표준계약서',
    fileName: '주택임대차_표준계약서_확정일자_사본.pdf',
    path: 'C:\\Users\\Public\\Documents\\주택임대차_표준계약서_확정일자_사본.pdf',
    ext: 'PDF',
    title: '주택·사무실 임대차 표준계약서 및 확정일자 사본',
    categoryBadge: '📋 부동산 · 임대차 계약서',
    extractedText:
      '소재지: 인천광역시 서구 청라동 (사무실 겸용 주택 임대차) | 보증금: 5,000만 원 (금 오천만 원정) | 월세(임대료): 월 150만 원 (매월 25일 후불) | 관리비: 월 15만 원 | 계약기간(만기일): 2026.10.28 ~ 2028.10.27 (24개월) | 특약사항: 원상복구 의무 및 중도해지 위약금 10% 조항 포함.',
    keywords: [
      '주택임대차',
      '사무실계약서',
      '임대차계약서',
      '표준계약서',
      '확정일자',
      '전입신고',
      '인천광역시',
      '서구',
      '청라동',
      '임대차',
      '계약서',
      '보증금',
      '5000만원',
      '5,000만',
      '월세',
      '임대료',
      '150만원',
      '관리비',
      '만기일',
      '계약기간',
      '위약금',
      '특약사항',
    ],
    date: '2026.10.28',
    sizeKB: 148,
    deviceSource: '내 PC 문서함',
  },
  {
    id: 'doc_4_가족_계정_비밀번호_관리표',
    fileName: '가족_통합_계정_비밀번호_관리표.xlsx',
    path: 'G:\\내 드라이브\\01_가족보안\\가족_통합_계정_비밀번호_관리표.xlsx',
    ext: 'XLSX',
    title: '가족 공용 OTT · 홈네트워크 계정 및 비밀번호 관리표',
    categoryBadge: '🔐 계정 · 비밀번호 관리표',
    extractedText:
      '넷플릭스/유튜브 프리미엄 아이디: merlin_family@sundreamer.app | 비밀번호: Merlin#2026!ZCore | 거실 와이파이(Wi-Fi): Ghosti_5GHz (비번: family2026*) | 관리비·공과금 입금 계좌번호: 신한은행 110-482-992018 (별표 *** 가림 없이 1초 복사 지원)',
    keywords: [
      '구글드라이브',
      'G드라이브',
      '계정관리표',
      '계좌번호',
      '아이디',
      '비밀번호',
      '비번',
      '넷플릭스',
      '유튜브',
      '와이파이',
      '신한은행',
      '110-482-992018',
      'merlin_family@sundreamer.app',
      'Merlin#2026!ZCore',
    ],
    date: '2026.10.25',
    sizeKB: 24,
    deviceSource: '구글 드라이브 (G:)',
  },
  {
    id: 'doc_biz_license',
    fileName: '사업자등록증_사본_썬드림.pdf',
    path: 'C:\\Users\\Public\\Documents\\사업자등록증_사본_썬드림.pdf',
    ext: 'PDF',
    title: '주식회사 썬드림 사업자등록증 사본 (대표 백은숙)',
    categoryBadge: '🏢 사업자등록증 · 인허가 서류',
    extractedText:
      '상호: 주식회사 썬드림 | 등록번호(사업자등록번호): 214-88-59201 | 대표자: 백은숙 | 개업연월일: 2024년 03월 15일 | 사업장소재지: 인천광역시 서구 청라한내로 100 | 업태: 정보통신업, 소프트웨어 개발 및 공급 | 종목: 응용 소프트웨어 개발, AI 솔루션.',
    keywords: [
      '사업자등록증',
      '사업자등록번호',
      '등록번호',
      '사업자번호',
      '썬드림',
      '백은숙',
      '214-88-59201',
      '인허가',
      '소프트웨어',
      '청라한내로',
    ],
    date: '2026.03.15',
    sizeKB: 92,
    deviceSource: '내 PC 문서함',
  },
  {
    id: 'doc_server_quotation',
    fileName: '클라우드_GPU_서버_구축_견적서_최종.xlsx',
    path: 'C:\\Users\\Public\\Documents\\클라우드_GPU_서버_구축_견적서_최종.xlsx',
    ext: 'XLSX',
    title: '2026 AI 추론 GPU 클라우드 서버 인프라 구축 견적서',
    categoryBadge: '💰 견적서 · 발주 명세서',
    extractedText:
      '프로젝트명: Z-코어 고속 분산 추론 서버 인프라 구축 | 견적일자: 2026.10.15 | 총액(견적총액): 1,280만 원 (VAT 포함) | 공급가액: 1,163만 6,364원 | 부가세: 116만 3,636원 | 주요품목: NVIDIA A10G 4식, 고속 NVMe 스토리지 10TB, 10Gbps 전용망 구성.',
    keywords: [
      '견적서',
      '서버견적서',
      '총액',
      '견적총액',
      '합계',
      '공급가액',
      '부가세',
      'GPU',
      '1280만원',
      '1,280만',
      '서버구축',
      '발주서',
    ],
    date: '2026.10.15',
    sizeKB: 48,
    deviceSource: '내 PC 문서함',
  },
  {
    id: 'doc_nda_agreement',
    fileName: '기술협력_비밀유지계약서_NDA_체결본.pdf',
    path: 'C:\\Users\\Public\\Documents\\기술협력_비밀유지계약서_NDA_체결본.pdf',
    ext: 'PDF',
    title: '상호 기술협력 및 영업비밀보호 표준 비밀유지계약서(NDA)',
    categoryBadge: '📑 법률 · 비밀유지계약서(NDA)',
    extractedText:
      '계약명: 상호 비밀유지 및 권리보호 계약서 | 계약기간: 체결일로부터 3년간 | 제8조 (비밀유지 의무): 양 당사자는 업무상 취득한 상대방의 기술 및 영업 정보를 제3자에게 누설하거나 본 계약 외 목적으로 사용하여서는 아니 된다. | 제12조 (손해배상 조항): 일방 당사자가 본 계약의 비밀유지 의무를 위반하여 상대방에게 손해를 입힌 경우, 위반 당사자는 이로 인하여 발생한 일체의 직접 손해 및 변호사 보수를 포함한 손해배상 책임을 부담한다. | 제15조 (관할법원): 본 계약에 관한 분쟁은 서울중앙지방법원을 제1심 전속 관할법원으로 한다.',
    keywords: [
      '비밀유지계약서',
      'NDA',
      '손해배상',
      '손해배상조항',
      '비밀유지',
      '위반',
      '비밀누설',
      '영업비밀',
      '관할법원',
      '서울중앙지방법원',
      '기술협력',
    ],
    date: '2026.09.20',
    sizeKB: 136,
    deviceSource: '내 PC 문서함',
  },
  {
    id: 'doc_driver_license',
    fileName: '자동차운전면허증_1종보통_사본.pdf',
    path: 'C:\\Users\\Public\\Documents\\자동차운전면허증_1종보통_사본.pdf',
    ext: 'PDF',
    title: '자동차 운전면허증 (1종 보통) 사본',
    categoryBadge: '🪪 신분증 · 운전면허증',
    extractedText:
      '문서종류: 자동차운전면허증 (1종 보통) | 성명: 김철수 | 운전면허증 번호(면허번호): 11-24-385920-10 | 발급일자: 2024년 05월 14일 | 적성검사 기간: 2034.05.14 ~ 2034.11.13 | 발행처: 서울특별시경찰청장',
    keywords: ['운전면허증', '자동차운전면허증', '운전면허증번호', '면허번호', '번호', '11-24-385920-10', '1종보통', '적성검사'],
    date: '2024.05.14',
    sizeKB: 82,
    deviceSource: '내 스마트폰 · PC 문서함',
  },
  {
    id: 'doc_resident_register',
    fileName: '주민등록등본_정부24_발급본_2026.pdf',
    path: 'C:\\Users\\Public\\Documents\\주민등록등본_정부24_발급본_2026.pdf',
    ext: 'PDF',
    title: '주민등록표 등본 (정부24 전자발급본)',
    categoryBadge: '🏛️ 증명서 · 주민등록등본',
    extractedText:
      '문서종류: 주민등록표 등본(초본) | 세대주 성명: 김철수 | 주민등록등본 발급일자: 2026년 10월 28일 (정부24 온라인 발급) | 현주소: 인천광역시 서구 청라동 에일린의뜰 | 세대원 구성: 본인(세대주), 배우자, 자녀 2명 | 발급확인번호: 1204-8839-4012-9901',
    keywords: ['주민등록등본', '주민등록표등본', '등본', '발급일자', '발급일', '2026년 10월 28일', '정부24', '세대주'],
    date: '2026.10.28',
    sizeKB: 94,
    deviceSource: '내 스마트폰 · PC 문서함',
  },
  {
    id: 'doc_labor_contract',
    fileName: '표준근로계약서_체결본_2026.pdf',
    path: 'C:\\Users\\Public\\Documents\\표준근로계약서_체결본_2026.pdf',
    ext: 'PDF',
    title: '표준 근로계약서 체결본 (근무시간 및 휴일 조항 포함)',
    categoryBadge: '📑 계약서 · 표준근로계약서',
    extractedText:
      '계약명: 표준근로계약서 | 제1조 (근로계약기간): 2026년 03월 01일부터 기간의 정함이 없는 정규직으로 한다. | 제2조 (근무시간 조항): 소정근로시간은 1일 8시간(오전 9시 출근 ~ 오후 6시 퇴근), 주 40시간을 기준으로 하며 당사자 합의 시 유연근무제를 적용한다. | 제3조 (휴게시간 조항): 근무시간 중 오후 12시부터 오후 1시까지 1시간의 휴게시간(점심시간)을 보장한다. | 제4조 (휴일 및 휴가 조항): 매주 토요일(무급휴무일)과 일요일(주휴일), 근로자의 날 및 관공서 공휴일에 관한 규정에 따른 공휴일을 유급 휴일로 부여하며 근로기준법에 따른 연차유급휴가를 보장한다.',
    keywords: ['근로계약서', '표준근로계약서', '근무시간', '휴일', '휴일조항', '근무시간조항', '휴가', '연차', '주40시간'],
    date: '2026.03.01',
    sizeKB: 115,
    deviceSource: '내 스마트폰 · PC 문서함',
  }];

export async function fetchIndexedDocuments(): Promise<LocalDocumentFile[]> {
  try {
    const canProbeLocal = hasActiveGhostiLoginSession() && zCoreBridge.isConnected;
    const [zRes, sRes] = await Promise.allSettled([
      canProbeLocal ? fetch(getZCoreUrl('/__docs/list')) : Promise.reject(new Error('guest_no_local_probe')),
      fetch('/poc/results/docs_semantic_index.json'),
    ]);

    const staticByFileName = new Map<string, LocalDocumentFile>();
    if (sRes.status === 'fulfilled' && sRes.value.ok) {
      const sJson = await sRes.value.json();
      const sDocs: LocalDocumentFile[] = Array.isArray(sJson.documents)
        ? sJson.documents
        : Array.isArray(sJson.docs)
        ? sJson.docs
        : [];
      for (const d of sDocs) {
        if (d && d.fileName && !d.fileName.includes('비밀금고')) {
          staticByFileName.set(d.fileName, {
            ...d,
            deviceSource: (d.deviceSource || '내 PC 문서함').replace(/\s*\(test_docs\)/g, ''),
          });
        }
      }
    }
    for (const gDoc of GDRIVE_SMART_DOC_ITEMS) {
      if (!staticByFileName.has(gDoc.fileName)) {
        staticByFileName.set(gDoc.fileName, gDoc);
      }
    }

    if (zRes.status === 'fulfilled' && zRes.value.ok) {
      const zJson = await zRes.value.json();
      const zDocs: LocalDocumentFile[] = Array.isArray(zJson.documents)
        ? zJson.documents
        : Array.isArray(zJson.docs)
        ? zJson.docs
        : [];
      // [실물 파일 순수성 철칙]: 로컬 Z-코어 엔진이 연결된 상태에서는 예시 샘플 문서를 절대 섞지 않고 100% 내 진짜 PC 문서만 반환!
      const realOnly = new Map<string, LocalDocumentFile>();
      for (const d of zDocs) {
        const fname = d.fileName || (d as any).name;
        if (!fname || fname.includes('비밀금고') || realOnly.has(fname)) continue;
        realOnly.set(fname, {
          ...d,
          deviceSource: (d.deviceSource || '내 PC 문서함').replace(/\s*\(test_docs\)/g, ''),
        });
      }
      return Array.from(realOnly.values());
    }

    if (canProbeLocal) {
      return [];
    }
    return Array.from(staticByFileName.values()).slice(0, 6);
  } catch {
    if (hasActiveGhostiLoginSession() && zCoreBridge.isConnected) {
      return [];
    }
    return [...GDRIVE_SMART_DOC_ITEMS];
  }
}

export async function searchLocalDocumentFilesAsync(
  query: string,
  fallbackDocs: LocalDocumentFile[] = []
): Promise<LocalDocumentFile[]> {
  const q = query.trim();
  if (!q || q.includes('최근 서류')) return fallbackDocs;

  // 1차로 로컬 정밀 키워드 변별(100% 일치 'EXACT' vs 일부 일치 'SIMILAR')을 먼저 수행하여
  // 전혀 연관이 없는 문서가 섞이거나 유사 문서 안내 배지가 누락되는 것을 원천 차단합니다.
  const localScored = searchLocalDocumentFiles(q, fallbackDocs);
  if (localScored.length > 0 || !hasActiveGhostiLoginSession() || !zCoreBridge.isConnected) {
    return localScored;
  }

  try {
    const ctrl = new AbortController();
    const tId = setTimeout(() => ctrl.abort(), 1200);
    const res = await fetch(getZCoreUrl('/__docs/search'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q }),
      signal: ctrl.signal,
    }).finally(() => clearTimeout(tId));
    if (res.ok) {
      const json = await res.json();
      if (json.ok && Array.isArray(json.documents) && json.documents.length > 0) {
        return json.documents.map((d: LocalDocumentFile) => ({
          ...d,
          matchType: d.matchType || 'SIMILAR',
          similarityNoticeKo:
            d.similarityNoticeKo ||
            '💡 검색어와 100% 일치하는 문서가 없어 유사한 문서를 찾았습니다!',
        }));
      }
    }
  } catch {
    /* offline fallback below */
  }
  return localScored;
}


export function searchLocalDocumentFiles(
  query: string,
  sourceDocs: LocalDocumentFile[] = LOCAL_DOCUMENT_FILES
): LocalDocumentFile[] {
  const q = query.trim().toLowerCase();
  if (!q) return sourceDocs;

  const cleaned = q
    .replace(/[.,!?'"“”‘’()[\]{}]/g, ' ')
    .replace(
      /(요약해\s*서?\s*읽어\s*줘?|핵심만\s*읽어\s*줘?|간단히\s*읽어\s*줘?|읽어\s*줘|읽어\s*봐|읽어|낭독\s*해\s*줘|낭독|들려\s*줘|들려|알려\s*줘|알려\s*봐|알려|있어\s*요?|있나\s*요?|있니|얼마\s*야|얼마\s*예?요|얼마|언제\s*야|언제|뭐야|뭔가요|어디\s*야|확인\s*해\s*줘|찾아\s*줘|보여\s*줘)/gi,
      ' '
    );

  const DOC_STOP_WORDS = new Set([
    '읽어줘', '읽어봐', '읽어', '낭독해줘', '낭독해', '낭독', '들려줘', '들려',
    '알려줘', '알려달라', '알려봐', '알려', '있어', '있나', '있니', '있나요',
    '얼마야', '얼마인가요', '얼마', '언제야', '언제', '뭐야', '뭔가요', '뭐',
    '어디야', '어디', '몇', '누구', '맞아', '확인해줘', '확인', '찾아줘', '보여줘',
    '요약해서', '핵심만', '간단히', '사진', '문서', '파일', '서류', '서류함', '및', '사본',
    '이', '그', '저', '내', '우리', '좀', '다', '에서', '중에서', '관련',
  ]);

  const rawTokens = Array.from(
    new Set(
      cleaned
        .split(/\s+/)
        .map((t) =>
          t.replace(
            /(에서부터|으로부터|에서|으로|이랑|하고|부터|까지|있는|하는|찍는|들을|들|의|을|를|은|는|이|가|에|와|과|도|만|나)$/,
            ''
          ).trim()
        )
        .filter((t) => t.length >= 1 && !DOC_STOP_WORDS.has(t))
    )
  );

  if (rawTokens.length === 0) return sourceDocs;

  const scored = sourceDocs
    .map((doc) => {
      const titleAndName = `${doc.title} ${doc.fileName} ${doc.categoryBadge}`.toLowerCase();
      const kwText = (doc.keywords || []).join(' ').toLowerCase();
      const bodyText = (doc.extractedText || '').toLowerCase();
      const corpus = `${titleAndName} ${kwText} ${bodyText}`;
      const docStems = extractKoStems(corpus);

      const matchedTokens: string[] = [];
      const unmatchedTokens: string[] = [];
      let weightedScore = 0;

      for (const tk of rawTokens) {
        let hit = false;
        if (titleAndName.includes(tk) || titleAndName.replace(/\s+/g, '').includes(tk.replace(/\s+/g, ''))) {
          weightedScore += 15;
          hit = true;
        } else if (kwText.includes(tk) || kwText.replace(/\s+/g, '').includes(tk.replace(/\s+/g, ''))) {
          weightedScore += 12;
          hit = true;
        } else if (matchKoTokenInStems(tk, docStems, corpus)) {
          weightedScore += 8;
          hit = true;
        }

        if (hit) {
          matchedTokens.push(tk);
        } else {
          unmatchedTokens.push(tk);
        }
      }

      const isExactMatch = matchedTokens.length === rawTokens.length;
      const matchType: 'EXACT' | 'SIMILAR' = isExactMatch ? 'EXACT' : 'SIMILAR';
      const similarityNoticeKo = !isExactMatch && matchedTokens.length > 0
        ? `💡 검색어와 100% 일치하는 문서가 없어 유사한 문서를 찾았습니다! (일치 키워드: ${matchedTokens
            .map((k) => `'${k}'`)
            .join(', ')})`
        : undefined;

      return {
        doc: {
          ...doc,
          matchType,
          matchedQueryTokens: matchedTokens,
          unmatchedQueryTokens: unmatchedTokens,
          similarityNoticeKo,
        },
        hits: matchedTokens.length,
        weightedScore,
        isExactMatch,
      };
    })
    .filter((item) => item.hits >= 1);

  scored.sort((a, b) => {
    if (a.isExactMatch !== b.isExactMatch) return a.isExactMatch ? -1 : 1;
    if (b.hits !== a.hits) return b.hits - a.hits;
    return b.weightedScore - a.weightedScore;
  });

  // 만약 100% 일치하는 문서가 1건 이상 존재한다면 부분 일치 문서는 섞지 않고 정확 일치 문서만 반환
  const exactDocs = scored.filter((s) => s.isExactMatch);
  if (exactDocs.length > 0) {
    return exactDocs.map((s) => s.doc);
  }

  return scored.map((s) => s.doc);
}

