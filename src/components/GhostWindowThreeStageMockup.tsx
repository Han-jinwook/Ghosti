import React, { useEffect, useMemo, useState } from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';
import type { PhotoItem } from '../types/saysee';

export type GhostWindowTierMode = 'pc_free' | 'phone_pc' | 'work_team';
export type GhostWindowUiTab = 'ui1_basic' | 'ui2_summon' | 'ui3_ocr';

interface SnippetSlotItem {
  slot: string;
  scope: 'personal' | 'team';
  title: string;
  value: string;
}

const INITIAL_SNIPPET_SLOTS_12: SnippetSlotItem[] = [
  // 왼쪽 6칸: F1 ~ F6 (내 개인 상용구 — 💻 내 PC)
  {
    slot: 'F1',
    scope: 'personal',
    title: '내 주거래 계좌',
    value: '국민은행 012-3456-7890-11 (예금주: 홍길동)',
  },
  {
    slot: 'F2',
    scope: 'personal',
    title: '집·배송지 주소',
    value: '서울특별시 강남구 테헤란로 123, 101동 1204호',
  },
  {
    slot: 'F3',
    scope: 'personal',
    title: '개인 이메일',
    value: 'merlin@sundreamer.app',
  },
  {
    slot: 'F4',
    scope: 'personal',
    title: '휴대폰 번호',
    value: '010-1234-5678',
  },
  {
    slot: 'F5',
    scope: 'personal',
    title: '빠른 감사 인사',
    value: '보내주신 내용 확인했습니다. 빠르게 검토 후 연락드리겠습니다!',
  },
  {
    slot: 'F6',
    scope: 'personal',
    title: '현금영수증 번호',
    value: '지출증빙 010-1234-5678',
  },
  // 오른쪽 6칸: F7 ~ F12 (팀 공유 상용구 — 💼 업무 공유 1초 동기화)
  {
    slot: 'F7',
    scope: 'team',
    title: '법인 입금계좌',
    value: '기업은행 987-654321-01-011 (예금주: (주)썬드리머)',
  },
  {
    slot: 'F8',
    scope: 'team',
    title: '사업자등록번호',
    value: '214-88-12345 ((주)썬드리머 · 대표 백은숙)',
  },
  {
    slot: 'F9',
    scope: 'team',
    title: '세금계산서 이메일',
    value: 'tax@sundreamer.app (매월 25일 마감)',
  },
  {
    slot: 'F10',
    scope: 'team',
    title: '회사 주소·팩스',
    value: '서울 성동구 성수이로 88, 7층 (Tel: 02-555-7890 / Fax: 02-555-7891)',
  },
  {
    slot: 'F11',
    scope: 'team',
    title: '고객 응대 표준멘트',
    value: '안녕하세요, (주)썬드리머 고객지원팀입니다. 요청하신 견적서 및 계약 조건 안내드립니다.',
  },
  {
    slot: 'F12',
    scope: 'team',
    title: '출고·마감 안내',
    value: '[공지] 금일 오후 4시 이전 발주 확정건은 당일 로젠택배로 일괄 출고됩니다.',
  },
];

interface ClipboardHistoryItem {
  id: string;
  copiedAt: string;
  daysAgo: number;
  category: '텍스트' | '계좌·숫자' | '캡처OCR';
  content: string;
}

const SAMPLE_CLIPBOARD_30DAYS: ClipboardHistoryItem[] = [
  {
    id: 'clip_1',
    copiedAt: '방금 전 (1분 전)',
    daysAgo: 0,
    category: '계좌·숫자',
    content: '국민은행 012-3456-7890-11 (홍길동) · 계약금 5,000,000원',
  },
  {
    id: 'clip_2',
    copiedAt: '오늘 14:20',
    daysAgo: 0,
    category: '텍스트',
    content: '제4조(보증금 반환) 임대인은 계약 만료일에 보증금 5,000만 원 전액을 즉시 반환한다.',
  },
  {
    id: 'clip_3',
    copiedAt: '오늘 11:05',
    daysAgo: 0,
    category: '캡처OCR',
    content: '[국세청 홈택스] 전자세금계산서 승인번호 20261107-48291032 (공급가액 3,200,000원)',
  },
  {
    id: 'clip_4',
    copiedAt: '어제 17:42',
    daysAgo: 1,
    category: '텍스트',
    content: 'https://ghosti.sundreamer.app — 사진·영상·문서 1초 AI 투시검색',
  },
  {
    id: 'clip_5',
    copiedAt: '2일 전',
    daysAgo: 2,
    category: '계좌·숫자',
    content: 'A업체 2026년 4분기 납품단가: 개당 14,500원 (VAT 별도, MOQ 500개)',
  },
  {
    id: 'clip_6',
    copiedAt: '9일 전',
    daysAgo: 9,
    category: '텍스트',
    content: '화물 엘리베이터 예약: 관리실 02-345-6789 (보증금 10만 원 현금 지참)',
  },
  {
    id: 'clip_7',
    copiedAt: '18일 전',
    daysAgo: 18,
    category: '캡처OCR',
    content: 'KT 인터넷 고객번호 102-849-2910 / 약정 만료일 2027-03-15',
  },
  {
    id: 'clip_8',
    copiedAt: '26일 전',
    daysAgo: 26,
    category: '계좌·숫자',
    content: '관세사 통관 고유부호 P192837465012 · 인천세관 담당자 내선 402호',
  },
];

interface SummonCandidateItem {
  id: string;
  sourceBadge: '💻 내 PC (무료)' | '📱 내 폰·집PC (통합)' | '💼 회사 S: 드라이브 (팀)';
  isFreePc: boolean;
  fileName: string;
  folderPath: string;
  matchedValueShort: string;
  replaceSentence: string;
  ghostPreviewTitle: string;
  ghostPreviewLines: string[];
  highlightRowIndex: number;
}

const SUMMON_SCENARIOS: {
  id: string;
  triggerTypeLabel: string;
  scenarioTitle: string;
  initialEditorText: string;
  targetToken: string;
  candidates: SummonCandidateItem[];
}[] = [
  {
    id: 'scen_question_mark',
    triggerTypeLabel: '보조 트리거 (문장 끝에 ? + Ctrl+0)',
    scenarioTitle: '카톡 채팅창에서 “작년 강남 계약서 보증금?” 입력 후 Ctrl+0',
    initialEditorText: '김 대리님, 확인 바랍니다. 작년 강남 계약서 보증금?',
    targetToken: '작년 강남 계약서 보증금?',
    candidates: [
      {
        id: 'cand_1',
        sourceBadge: '💻 내 PC (무료)',
        isFreePc: true,
        fileName: '2025_강남역_사무실_임대차계약서_최종.pdf',
        folderPath: 'C:\\Users\\Merlin\\Documents\\계약서',
        matchedValueShort: '보증금 5,000만 원 / 월세 220만 원',
        replaceSentence: '보증금 5,000만 원 (월 차임 220만 원 · 2025년 강남역 사무실 임대차계약서 제4조)',
        ghostPreviewTitle: '📄 2025_강남역_사무실_임대차계약서_최종.pdf (1페이지 표 발췌)',
        ghostPreviewLines: [
          '제3조 (소재지) 서울특별시 강남구 역삼동 823-14 테헤란빌딩 6층',
          '👉 제4조 (보증금 및 차임) 보증금 금 오천만 원정 (₩50,000,000) / 월세 2,200,000원',
          '제5조 (계약기간) 2025년 03월 01일 ~ 2027년 02월 28일 (24개월)',
          '특약사항 2: 퇴실 시 기본 칸막이 원상복구 의무는 면제하기로 한다.',
        ],
        highlightRowIndex: 1,
      },
      {
        id: 'cand_2',
        sourceBadge: '💻 내 PC (무료)',
        isFreePc: true,
        fileName: '강남_공유오피스_견적비교표_2025.xlsx',
        folderPath: 'C:\\Users\\Merlin\\Downloads',
        matchedValueShort: '예치보증금 660만 원 (3개월분)',
        replaceSentence: '예치보증금 660만 원 (3개월분 · 강남 공유오피스 견적비교표 B열)',
        ghostPreviewTitle: '📊 강남_공유오피스_견적비교표_2025.xlsx [Sheet1]',
        ghostPreviewLines: [
          '[A열: 지점명]   | [B열: 예치보증금] | [C열: 월 이용료] | [D열: 비고]',
          '👉 강남역 1호점 | 6,600,000원       | 2,200,000원      | 주차 2대 무료',
          '역삼역 2호점    | 5,400,000원       | 1,800,000원      | 회의실 월 20시간',
        ],
        highlightRowIndex: 1,
      },
      {
        id: 'cand_3',
        sourceBadge: '📱 내 폰·집PC (통합)',
        isFreePc: false,
        fileName: '[내 폰 사진] 20250218_강남부동산_가계약영수증.jpg',
        folderPath: '📱 Galaxy S25 Ultra > 카메라 앨범',
        matchedValueShort: '가계약금 500만 원 입금완료 (잔금 4,500만 원)',
        replaceSentence: '가계약금 500만 원 입금 완료 · 잔금 4,500만 원 (총 보증금 5,000만 원)',
        ghostPreviewTitle: '📱 [내 폰 촬영 영수증 OCR] 20250218_강남부동산_가계약영수증.jpg',
        ghostPreviewLines: [
          '영수증 (보관용) — 강남공인중개사사무소',
          '👉 총 보증금: 금 50,000,000원 (금일 가계약금 5,000,000원 정히 영수함)',
          '입금계좌: 신한은행 110-482-991023 (임대인 김철수)',
        ],
        highlightRowIndex: 1,
      },
      {
        id: 'cand_4',
        sourceBadge: '💼 회사 S: 드라이브 (팀)',
        isFreePc: false,
        fileName: 'S:\\01_총무법무\\법인사업장_임차보증금_원장_2026.xlsx',
        folderPath: 'S:\\01_총무법무',
        matchedValueShort: '강남지사 임차보증금 잔액 50,000,000원',
        replaceSentence: '강남지사 임차보증금 50,000,000원 (S: 법인사업장 임차보증금 원장 4행)',
        ghostPreviewTitle: '💼 S:\\01_총무법무\\법인사업장_임차보증금_원장_2026.xlsx',
        ghostPreviewLines: [
          '구분     | 계약처          | 보증금원금     | 만기일     | 보증보험',
          '본사     | 성수 지식산업센터 | 120,000,000원  | 2027-08-31 | 가입완료',
          '👉 강남지사 | 테헤란빌딩 6층   | 50,000,000원   | 2027-02-28 | 확정일자필',
        ],
        highlightRowIndex: 2,
      },
    ],
  },
  {
    id: 'scen_drag_block',
    triggerTypeLabel: '기본 트리거 (마우스 드래그 블록 지정 + Ctrl+0)',
    scenarioTitle: '이메일 작성 중 “A업체 납품단가”를 마우스로 드래그 후 Ctrl+0',
    initialEditorText: '박 팀장님, 이번 11월 발주 품의서에 넣을 A업체 납품단가 확인 부탁드립니다.',
    targetToken: 'A업체 납품단가',
    candidates: [
      {
        id: 'cand_d1',
        sourceBadge: '💻 내 PC (무료)',
        isFreePc: true,
        fileName: '2026_하반기_A업체_단가합의서_날인본.hwp',
        folderPath: 'C:\\Users\\Merlin\\Desktop\\구매단가표',
        matchedValueShort: '개당 14,500원 (VAT 별도 · 500개 이상 13,800원)',
        replaceSentence: 'A업체 납품단가 개당 14,500원 (VAT 별도, 500개 이상 발주 시 13,800원)',
        ghostPreviewTitle: '📄 2026_하반기_A업체_단가합의서_날인본.hwp (본문 2쪽)',
        ghostPreviewLines: [
          '1. 품목명: 초경량 알루미늄 방열 하우징 (Rev 2.4)',
          '👉 2. 확정 납품단가: 기본 단가 @14,500원 (VAT 별도) / 월 500EA 이상 시 @13,800원',
          '3. 결제조건: 당월 마감 익월 말 현금 100% (기업은행 법인계좌)',
        ],
        highlightRowIndex: 1,
      },
      {
        id: 'cand_d2',
        sourceBadge: '💼 회사 S: 드라이브 (팀)',
        isFreePc: false,
        fileName: 'S:\\02_구매자재\\2026_외주협력사_표준단가표_v4.xlsx',
        folderPath: 'S:\\02_구매자재',
        matchedValueShort: 'A업체(성진정밀) 표준단가 14,500원 / 불량률 0.2%',
        replaceSentence: 'A업체(성진정밀) 표준 납품단가 14,500원 (S: 외주협력사 표준단가표 12행)',
        ghostPreviewTitle: '💼 S:\\02_구매자재\\2026_외주협력사_표준단가표_v4.xlsx',
        ghostPreviewLines: [
          '코드   | 업체명       | 품목명        | 단가(원)  | 리드타임',
          '👉 V-01 | A업체(성진정밀)| 방열 하우징   | 14,500원  | 발주 후 5일',
          'V-02   | B업체(한일테크)| 실리콘 가스켓 | 2,100원   | 발주 후 3일',
        ],
        highlightRowIndex: 1,
      },
    ],
  },
];

/**
 * 🎯 원본 화면 위에 글자 그대로 톡톡 찍기 (Live Text 인플레이스 오버레이 블록)
 * - 어설픈 요약 칩 나열 대신, 사진/영수증/계약서 원본 위 실제 글자 위치(top%, left%)에 그대로 얹혀서
 *   유저가 상호를 원하든, 품명을 원하든, 특약 한 줄을 원하든 화면 위 글자를 마우스로 톡톡 찍으면 즉시 복사/커서 입력!
 */
export interface LiveTextOverlaySpot {
  id: string;
  topPercent: number;
  leftPercent: number;
  widthPercent?: number;
  categoryHint: string;
  displayText: string;
  insertValue: string;
  isPrimaryHighlight?: boolean;
}

export interface OcrSamplePreset {
  id: string;
  title: string;
  sourceLabel: string;
  thumbUrl: string;
  fullText: string;
  tsvTableText: string;
  liveTextSpots: LiveTextOverlaySpot[];
}

const OCR_PRESETS: OcrSamplePreset[] = [
  {
    id: 'ocr_receipt',
    title: '방금 폰으로 찍은 종이 영수증·세금계산서 (원본 화면 위 글자 톡톡 찍기)',
    sourceLabel: '📱 내 폰 촬영 직후 1분 이내 Ctrl+0 호출 (1회 사용 시 자동 소멸)',
    thumbUrl: '/sample_photos_301/MEMO_202509_1259_주차장_기둥.jpg',
    fullText:
      '[전자세금계산서 영수증] 승인번호: 20261107-849201 | 상호: (주)성수오피스디포 | 대표자: 김상훈 | 사업자번호: 123-45-67890 | 품목1: A4 복사용지 80g 10박스 (단가 22,000원) | 품목2: 레이저 토너 카트리지 2개 (단가 44,500원) | 공급가액: 131,818원 | 부가세: 13,182원 | 합계금액: 145,000원 | 입금계좌: 국민은행 012-3456-7890',
    tsvTableText:
      '항목\t내용\n승인번호\t20261107-849201\n상호\t(주)성수오피스디포\n사업자번호\t123-45-67890\n품목1\tA4 복사용지 80g 10박스\n품목2\t레이저 토너 카트리지 2개\n공급가액\t131,818원\n부가세\t13,182원\n합계금액\t145,000원\n입금계좌\t국민은행 012-3456-7890',
    liveTextSpots: [
      {
        id: 'spot_1',
        topPercent: 8,
        leftPercent: 6,
        categoryHint: '문서 제목',
        displayText: '전자세금계산서 (영수증) · 승인번호: 20261107-849201',
        insertValue: '20261107-849201',
        isPrimaryHighlight: true,
      },
      {
        id: 'spot_2',
        topPercent: 21,
        leftPercent: 6,
        categoryHint: '공급자 상호·대표',
        displayText: '상호: (주)성수오피스디포  |  성명: 김상훈',
        insertValue: '(주)성수오피스디포',
      },
      {
        id: 'spot_3',
        topPercent: 33,
        leftPercent: 6,
        categoryHint: '사업자등록번호',
        displayText: '사업자등록번호: 123-45-67890',
        insertValue: '123-45-67890',
        isPrimaryHighlight: true,
      },
      {
        id: 'spot_4',
        topPercent: 46,
        leftPercent: 6,
        categoryHint: '품명·규격 1',
        displayText: '품목 1: 프리미엄 A4 복사용지 (80g) · 10 BOX · 단가 22,000원',
        insertValue: '프리미엄 A4 복사용지 (80g) 10박스',
      },
      {
        id: 'spot_5',
        topPercent: 58,
        leftPercent: 6,
        categoryHint: '품명·규격 2',
        displayText: '품목 2: 정품 레이저 토너 카트리지 (BK) · 2 EA · 단가 44,500원',
        insertValue: '정품 레이저 토너 카트리지 (BK) 2개',
      },
      {
        id: 'spot_6',
        topPercent: 71,
        leftPercent: 6,
        categoryHint: '공급가액·세액·합계',
        displayText: '공급가액 131,818원  |  세액 13,182원  |  합계금액: 145,000원',
        insertValue: '145,000원',
        isPrimaryHighlight: true,
      },
      {
        id: 'spot_7',
        topPercent: 84,
        leftPercent: 6,
        categoryHint: '입금계좌',
        displayText: '입금계좌: 국민은행 012-3456-7890-11 (예금주: 성수오피스디포)',
        insertValue: '국민은행 012-3456-7890-11',
        isPrimaryHighlight: true,
      },
    ],
  },
  {
    id: 'ocr_contract',
    title: '부동산 임대차 계약서 사진 (원본 화면 위 조항·숫자 그대로 톡톡 찍기)',
    sourceLabel: '💻 1번 내 기기 ➔ 🔍 찾기 사진 카드에서 [📝 OCR 글자 따기] 클릭',
    thumbUrl: '/sample_photos_301/Screenshot_20250802_1001_쇼핑위시리스트.jpg',
    fullText:
      '[업무용 부동산 임대차 계약서] 소재지: 서울특별시 강남구 역삼동 823-14 테헤란빌딩 6층 | 보증금: 금 오천만 원정 (₩50,000,000) | 월차임: 금 이백이십만 원정 (₩2,200,000, 매월 25일 선불) | 계약기간: 2025.03.01 ~ 2027.02.28 (24개월) | 특약사항: 임차인의 퇴실 시 기본 설치 칸막이에 대한 원상복구 의무는 면제한다. | 임대인 계좌: 신한은행 110-482-991023 (김철수)',
    tsvTableText:
      '항목\t계약내용\n소재지\t서울특별시 강남구 역삼동 823-14 테헤란빌딩 6층\n보증금\t50,000,000원\n월차임\t2,200,000원\n계약기간\t2025.03.01 ~ 2027.02.28\n특약사항\t퇴실 시 기본 칸막이 원상복구 의무 면제\n임대인계좌\t신한은행 110-482-991023 (김철수)',
    liveTextSpots: [
      {
        id: 'c_spot_1',
        topPercent: 9,
        leftPercent: 6,
        categoryHint: '소재지 주소',
        displayText: '제1조 [소재지] 서울특별시 강남구 역삼동 823-14 테헤란빌딩 6층 (전용 42평)',
        insertValue: '서울특별시 강남구 역삼동 823-14 테헤란빌딩 6층',
      },
      {
        id: 'c_spot_2',
        topPercent: 24,
        leftPercent: 6,
        categoryHint: '보증금',
        displayText: '제2조 [보증금] 금 오천만 원정 (₩50,000,000) — 계약금 500만 / 잔금 4,500만',
        insertValue: '금 오천만 원정 (₩50,000,000)',
        isPrimaryHighlight: true,
      },
      {
        id: 'c_spot_3',
        topPercent: 39,
        leftPercent: 6,
        categoryHint: '월차임·관리비',
        displayText: '제3조 [월차임] 금 이백이십만 원정 (₩2,200,000 · VAT 별도, 매월 25일 지급)',
        insertValue: '월차임 2,200,000원 (VAT 별도)',
        isPrimaryHighlight: true,
      },
      {
        id: 'c_spot_4',
        topPercent: 54,
        leftPercent: 6,
        categoryHint: '계약기간',
        displayText: '제4조 [계약기간] 2025년 03월 01일 ~ 2027년 02월 28일 (24개월간)',
        insertValue: '2025년 03월 01일 ~ 2027년 02월 28일 (24개월)',
      },
      {
        id: 'c_spot_5',
        topPercent: 69,
        leftPercent: 6,
        categoryHint: '특약사항 문구 한 줄',
        displayText: '특약 제2항: 임차인의 퇴실 시 기본 설치 칸막이에 대한 원상복구 의무는 면제한다.',
        insertValue: '임차인의 퇴실 시 기본 설치 칸막이에 대한 원상복구 의무는 면제한다.',
        isPrimaryHighlight: true,
      },
      {
        id: 'c_spot_6',
        topPercent: 83,
        leftPercent: 6,
        categoryHint: '임대인 계좌·인적사항',
        displayText: '임대인: 김철수 (신한은행 110-482-991023 · 연락처 010-9876-5432)',
        insertValue: '신한은행 110-482-991023 (예금주: 김철수)',
        isPrimaryHighlight: true,
      },
    ],
  },
];

export function buildOcrPresetFromPhoto(photo: PhotoItem): OcrSamplePreset {
  const cleanTags = photo.tags.map((t) => t.replace(/^#/, ''));
  const baseName = photo.name.replace(/\.[^.]+$/, '');
  return {
    id: `photo_ocr_${photo.id}`,
    title: `${photo.name} (${photo.date}) — 원본 위 글자 톡톡 찍기`,
    sourceLabel: '🔍 찾기 검색 사진에서 [📝 OCR 글자 따기] 즉시 호출됨',
    thumbUrl: photo.thumbUrl,
    fullText: `[사진 Live Text 추출] 파일명: ${photo.name} | 촬영일: ${photo.date} | 상호: (주)성수오피스디포 | 사업자번호: 123-45-67890 | 품목: ${cleanTags.join(' · ') || baseName} | 합계금액: 145,000원 | 입금계좌: 국민은행 012-3456-7890-11`,
    tsvTableText: `항목\t추출값\n파일명\t${photo.name}\n촬영일\t${photo.date}\n핵심내용\t${cleanTags.join(', ')}\n사업자번호\t123-45-67890\n합계금액\t145,000원\n입금계좌\t국민은행 012-3456-7890-11`,
    liveTextSpots: [
      {
        id: 'p_spot_1',
        topPercent: 10,
        leftPercent: 6,
        categoryHint: '상단 문서/사진 헤더',
        displayText: `문서/사진 제목: ${baseName} (촬영일자: ${photo.date})`,
        insertValue: `${baseName} (${photo.date})`,
      },
      {
        id: 'p_spot_2',
        topPercent: 26,
        leftPercent: 6,
        categoryHint: '상호·기관명',
        displayText: '상호: (주)성수오피스디포  |  사업자번호: 123-45-67890',
        insertValue: '123-45-67890',
        isPrimaryHighlight: true,
      },
      {
        id: 'p_spot_3',
        topPercent: 43,
        leftPercent: 6,
        categoryHint: '품명·내역 문구',
        displayText: `내역 문구: ${cleanTags.join(' · ') || '현장 확인 및 납품 검수 내역서'}`,
        insertValue: cleanTags.join(' · ') || baseName,
      },
      {
        id: 'p_spot_4',
        topPercent: 61,
        leftPercent: 6,
        categoryHint: '합계금액·단가',
        displayText: '공급가액 131,818원  +  부가세 13,182원  =  합계금액 145,000원',
        insertValue: '145,000원',
        isPrimaryHighlight: true,
      },
      {
        id: 'p_spot_5',
        topPercent: 79,
        leftPercent: 6,
        categoryHint: '계좌·연락처',
        displayText: '결제계좌: 국민은행 012-3456-7890-11 (담당자 010-1234-5678)',
        insertValue: '국민은행 012-3456-7890-11',
        isPrimaryHighlight: true,
      },
    ],
  };
}

export const GhostBabyMascotBadge: React.FC<{ subtitle?: string }> = ({ subtitle }) => (
  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-xl bg-gradient-to-r from-teal-500/25 via-emerald-500/20 to-cyan-500/20 border border-teal-400/50 shadow-[0_0_16px_rgba(20,184,166,0.28)] shrink-0">
    <span className="w-7 h-7 rounded-lg bg-teal-400/20 border border-teal-300/60 flex items-center justify-center text-[17px] shadow-inner">
      👻
    </span>
    <div className="flex flex-col leading-none">
      <span className="text-[12px] font-black text-teal-200 tracking-tight">
        애기귀신 현장소환 (Ctrl+0)
      </span>
      {subtitle && (
        <span className="text-[10px] font-bold text-emerald-300/90 mt-0.5">{subtitle}</span>
      )}
    </div>
  </div>
);

export const GhostWindowThreeStageMockup: React.FC<{
  activeTier?: GhostWindowTierMode;
  onTierChange?: (tier: GhostWindowTierMode) => void;
  initialWindowTab?: GhostWindowUiTab;
  externalOcrPhoto?: PhotoItem | null;
}> = ({
  activeTier = 'pc_free',
  onTierChange,
  initialWindowTab = 'ui1_basic',
  externalOcrPhoto = null,
}) => {
  const [windowTab, setWindowTab] = useState<GhostWindowUiTab>(initialWindowTab);
  useEffect(() => {
    setWindowTab(initialWindowTab);
  }, [initialWindowTab]);

  useEffect(() => {
    if (externalOcrPhoto) {
      setWindowTab('ui3_ocr');
    }
  }, [externalOcrPhoto]);

  // ── [창 UI ①] 상태 ──
  const [openHeaderDrawer, setOpenHeaderDrawer] = useState<'none' | 'snippets' | 'clipboard'>(
    'snippets'
  );
  const [snippets, setSnippets] = useState<SnippetSlotItem[]>(INITIAL_SNIPPET_SLOTS_12);
  const [editingSlot, setEditingSlot] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [clipboardQuery, setClipboardQuery] = useState('');
  const [ui1EditorText, setUi1EditorText] = useState(
    '안녕하세요 대표님, 요청하신 계좌번호와 사업자 정보 아래에 전달드립니다.\n👉 '
  );
  const [activeWave1Ability, setActiveWave1Ability] = useState<number>(1);
  const [autoReturnedFromOneTimePop, setAutoReturnedFromOneTimePop] = useState(false);

  const filteredClipboardItems = useMemo(() => {
    const q = clipboardQuery.trim().toLowerCase();
    if (!q) return SAMPLE_CLIPBOARD_30DAYS.slice(0, 5); // 평소엔 최근 5개만 깔끔 노출
    return SAMPLE_CLIPBOARD_30DAYS.filter(
      (item) =>
        item.content.toLowerCase().includes(q) || item.category.toLowerCase().includes(q)
    );
  }, [clipboardQuery]);

  // ── [창 UI ②] 상태 ──
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const currentScenario = SUMMON_SCENARIOS[scenarioIdx] || SUMMON_SCENARIOS[0];
  const [ui2EditorText, setUi2EditorText] = useState(currentScenario.initialEditorText);
  const [hoveredCandidateId, setHoveredCandidateId] = useState<string>(
    currentScenario.candidates[0]?.id || 'cand_1'
  );
  const [attachedFileBadge, setAttachedFileBadge] = useState<string | null>(null);
  const [summonReplacedNotice, setSummonReplacedNotice] = useState<string | null>(null);

  useEffect(() => {
    const scen = SUMMON_SCENARIOS[scenarioIdx] || SUMMON_SCENARIOS[0];
    setUi2EditorText(scen.initialEditorText);
    setHoveredCandidateId(scen.candidates[0]?.id || '');
    setAttachedFileBadge(null);
    setSummonReplacedNotice(null);
  }, [scenarioIdx]);

  const activeCandidate = useMemo(
    () =>
      currentScenario.candidates.find((c) => c.id === hoveredCandidateId) ||
      currentScenario.candidates[0],
    [currentScenario, hoveredCandidateId]
  );

  // ── [창 UI ③] 상태: 1분 유효시간(60초 TTL) + 1회 노출 후 자동 소멸(One-Time Pop) & 원본 화면 위 Live Text 오버레이 ──
  const customPhotoPreset = useMemo(
    () => (externalOcrPhoto ? buildOcrPresetFromPhoto(externalOcrPhoto) : null),
    [externalOcrPhoto]
  );
  const [selectedOcrPresetId, setSelectedOcrPresetId] = useState<string>('ocr_receipt');
  const activeOcrPreset = useMemo(() => {
    if (customPhotoPreset && selectedOcrPresetId === customPhotoPreset.id) {
      return customPhotoPreset;
    }
    return OCR_PRESETS.find((p) => p.id === selectedOcrPresetId) || OCR_PRESETS[0];
  }, [customPhotoPreset, selectedOcrPresetId]);

  useEffect(() => {
    if (customPhotoPreset) {
      setSelectedOcrPresetId(customPhotoPreset.id);
    }
  }, [customPhotoPreset]);

  const [ttlSecondsLeft, setTtlSecondsLeft] = useState<number>(58);
  const [oneTimePopUsed, setOneTimePopUsed] = useState<boolean>(false);
  const [clickedSpotIds, setClickedSpotIds] = useState<string[]>([]);
  const [ui3CursorEditorText, setUi3CursorEditorText] = useState(
    '경리팀 공유드립니다. 방금 찍은 내역: '
  );
  const [lastInsertedSpotNotice, setLastInsertedSpotNotice] = useState<string | null>(null);

  // 1분(60초) 유효 타이머 카운트다운
  useEffect(() => {
    if (windowTab !== 'ui3_ocr') return;
    const timer = window.setInterval(() => {
      setTtlSecondsLeft((prev) => (prev > 1 ? prev - 1 : 60));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [windowTab]);

  const insertIntoUi1Editor = (textToInsert: string, label: string) => {
    setUi1EditorText((prev) => `${prev}${prev.endsWith(' ') || prev.endsWith('\n') ? '' : ' '}${textToInsert}`);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(textToInsert);
    }
    useSaySeeStore.setState({
      lastQuarantineToast: `👻 [${label}] 현재 커서 자리에 0.01초 만에 꽂혔습니다: "${textToInsert}"`,
    });
  };

  const applySummonCandidateToEditor = (cand: SummonCandidateItem, attachFile = false) => {
    if (attachFile) {
      setAttachedFileBadge(`${cand.fileName} (${cand.sourceBadge})`);
      useSaySeeStore.setState({
        lastQuarantineToast: `📎 [현장 파일 즉시 첨부] 탐색기를 열지 않고 [${cand.fileName}] 원본을 현재 작업창에 바로 첨부했습니다!`,
      });
      return;
    }
    const nextText = ui2EditorText.includes(currentScenario.targetToken)
      ? ui2EditorText.replace(currentScenario.targetToken, cand.replaceSentence)
      : `${ui2EditorText} ➔ ${cand.replaceSentence}`;
    setUi2EditorText(nextText);
    setSummonReplacedNotice(`✨ "${currentScenario.targetToken}" 구간이 문서 속 실제 정답으로 즉시 교체되었습니다!`);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(cand.replaceSentence);
    }
    useSaySeeStore.setState({
      lastQuarantineToast: `👻 [현장 문서·숫자 소환 완료] "${cand.replaceSentence}" 내 커서 자리에 즉시 입력!`,
    });
  };

  const handleTapLiveTextOnImage = (spot: LiveTextOverlaySpot) => {
    setUi3CursorEditorText(
      (prev) => `${prev}${prev.endsWith(' ') ? '' : ' '}${spot.insertValue}`
    );
    setClickedSpotIds((prev) => (prev.includes(spot.id) ? prev : [...prev, spot.id]));
    setOneTimePopUsed(true);
    setLastInsertedSpotNotice(
      `✨ 원본 화면 위 [${spot.categoryHint}] 글자 톡! ➔ "${spot.insertValue}" 커서 즉시 입력 완료! (1회 사용 완료 · 다음 Ctrl+0부터는 기본 귀신창으로 자동 복귀합니다)`
    );
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(spot.insertValue);
    }
    useSaySeeStore.setState({
      lastQuarantineToast: `👆 [원본 화면 위 글자 톡톡 찍기] "${spot.insertValue}" 복사 및 커서 입력 완료! (One-Time Pop 사용 처리됨)`,
    });
  };

  const handleSimulateNextCtrlZeroPress = () => {
    setAutoReturnedFromOneTimePop(true);
    setWindowTab('ui1_basic');
    useSaySeeStore.setState({
      lastQuarantineToast:
        '⚡ [One-Time Pop 자동 소멸 작동!] 방금 사진창을 1회 사용했으므로, 다음 Ctrl+0 호출 시 지체 없이 원래의 기본 귀신창(창 UI ①)으로 돌아왔습니다!',
    });
  };

  return (
    <section className="w-full flex flex-col gap-5">
      {/* 1. 상단 패러다임 선언 & 3단 구역(💻 내 PC / 📱 폰+PC / 💼 팀 공유) 배지 바 */}
      <div className="p-5 rounded-3xl bg-gradient-to-br from-zinc-900 via-[#12161F] to-zinc-950 border border-teal-500/35 shadow-xl flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <GhostBabyMascotBadge subtitle="탐색기로 찾아가던 시대에서 ➔ 일하던 현장으로 귀신을 부르는 시대로!" />
            <span className="px-3 py-1 rounded-full bg-amber-400/15 border border-amber-400/40 text-amber-300 text-[11.5px] font-extrabold">
              ⚡ 네이티브 0.01초 오버레이 (버벅임 0% · Win+V 컴팩트 사이즈)
            </span>
          </div>

          {/* 3단 분리 스위치: 💻 내 PC (무료구역) / 📱 폰+PC (내 기기 통합) / 💼 팀 공유 (업무 공유) */}
          <div className="inline-flex flex-wrap items-center p-1 rounded-2xl bg-zinc-950 border border-white/10 gap-1">
            {[
              {
                id: 'pc_free' as const,
                label: '🆓 💻 내 PC (내PC 문서소환 평생무료 · 초능력 일 3회 무료)',
                defaultTab: 'ui1_basic' as const,
              },
              {
                id: 'phone_pc' as const,
                label: '👑 📱 폰 + PC (폰 촬영·스샷 1분내 1회 자동소멸 · 월 3,900원)',
                defaultTab: 'ui3_ocr' as const,
              },
              {
                id: 'work_team' as const,
                label: '👑 💼 팀 공유 (F7~F12 팀 상용구 · S: 숫자 소환 · 월 9,900원~)',
                defaultTab: 'ui2_summon' as const,
              },
            ].map((tier) => {
              const active = activeTier === tier.id;
              return (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => {
                    onTierChange?.(tier.id);
                    setWindowTab(tier.defaultTab);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[11.5px] font-extrabold transition-all cursor-pointer ${
                    active
                      ? 'bg-teal-400 text-zinc-950 shadow-sm'
                      : 'text-zinc-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {tier.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3대 현장 소환창 UI 시안 선택 탭 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
          {[
            {
              id: 'ui1_basic' as const,
              badge: '창 UI ① · 평상시 Ctrl + 0',
              title: '👻 기본 귀신창 (2줄 날렵 구조)',
              desc: '윗줄: 👻 + [⌨️ 상용구 F1~F12 ▾] + [📋🔍 클립보드 ▾] / 아랫줄: Wave 1 핵심 초능력 5대 탭',
            },
            {
              id: 'ui2_summon' as const,
              badge: '창 UI ② · 드래그(기본) / 끝에 ?(보조) + Ctrl + 0',
              title: '👻 현장 문서·숫자 유령 소환창',
              desc: '일하던 카톡·이메일 커서 위에 요약 5건 호출 ➔ 마우스 호버 시에만 우측 유령 미리보기 말풍선!',
            },
            {
              id: 'ui3_ocr' as const,
              badge: '창 UI ③ · 1분 유효 + 1회 노출 자동소멸(One-Time Pop)',
              title: '👻 원본 화면 위 글자 톡톡 찍기 (Live Text)',
              desc: '어설픈 요약 칩 대신 원본 화면 위 글자 위치를 마우스로 톡톡 찍어 쏙쏙 입력 + 1회 사용 후 기본창 자동 복귀!',
            },
          ].map((tab) => {
            const isSelected = windowTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setAutoReturnedFromOneTimePop(false);
                  setWindowTab(tab.id);
                }}
                className={`p-3.5 rounded-2xl text-left border transition-all flex flex-col gap-1 cursor-pointer ${
                  isSelected
                    ? 'bg-teal-500/15 border-teal-400 ring-2 ring-teal-400/50 shadow-lg'
                    : 'bg-zinc-950/80 hover:bg-zinc-900 border-white/10'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-teal-400/20 text-teal-300 text-[10.5px] font-black">
                    {tab.badge}
                  </span>
                  {isSelected && (
                    <span className="text-[11px] font-black text-emerald-300">● 현재 시안 열림</span>
                  )}
                </div>
                <div className="text-[14.5px] font-black text-white mt-0.5">{tab.title}</div>
                <p className="text-[11.5px] text-zinc-300 leading-snug">{tab.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          [창 UI ① 시안] 평상시 Ctrl + 0 호출 ➔ 『기본 귀신창 (2줄 날렵 구조)』
         ════════════════════════════════════════════════════════════════════════ */}
      {windowTab === 'ui1_basic' && (
        <div className="p-5 sm:p-6 rounded-3xl bg-[#111318] border-2 border-teal-400/50 shadow-[0_0_40px_rgba(20,184,166,0.15)] flex flex-col gap-5">
          {autoReturnedFromOneTimePop && (
            <div className="px-4 py-3 rounded-2xl bg-emerald-500/20 border-2 border-emerald-400 text-emerald-200 text-[13px] font-extrabold flex flex-wrap items-center justify-between gap-2">
              <span>
                ✅ <strong>[1분 유효 + 1회 노출 후 자동 소멸(One-Time Pop) 확인 완료!]</strong> 방금 사진/스샷 창을 1회 써먹었기 때문에, 다시 <code className="text-white">Ctrl + 0</code>을 누르자 귀찮게 사진창이 또 뜨지 않고 지체 없이 원래의 <strong>기본 귀신창(창 UI ①)</strong>으로 돌아왔습니다!
              </span>
              <button
                type="button"
                onClick={() => setAutoReturnedFromOneTimePop(false)}
                className="px-2.5 py-1 rounded-lg bg-zinc-900 text-zinc-200 text-[11px] font-bold cursor-pointer"
              >
                확인 ✕
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-teal-400 text-zinc-950 text-[11.5px] font-black">
                창 UI ① 인터랙티브 시안
              </span>
              <h2 className="text-[16px] sm:text-[18px] font-black text-white">
                평상시 <code className="text-teal-300">Ctrl + 0</code> 호출 ➔ 『기본 귀신창 (2줄 날렵 구조)』
              </h2>
            </div>
            <span className="text-[12px] text-emerald-300 font-bold">
              💡 우측 상단 [⌨️ 상용구 ▾] 또는 [📋🔍 클립보드 ▾] 아이콘을 직접 클릭해 보세요!
            </span>
          </div>

          {/* ── 실제 화면에 뜨는 2줄 날렵 귀신창 프레임 ── */}
          <div className="w-full max-w-[920px] mx-auto rounded-2xl bg-[#0B0E14] border-2 border-teal-400/70 shadow-[0_16px_45px_rgba(0,0,0,0.75)] overflow-hidden">
            {/* [윗줄 — 헤더 바] 맨 앞 👻 애기귀신 마스코트 + 우측 [⌨️ 상용구 (F1~F12) ▾] & [📋🔍 클립보드 (최근 5개+검색) ▾] */}
            <div className="px-3.5 py-2.5 bg-gradient-to-r from-zinc-900 via-[#111927] to-zinc-900 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <GhostBabyMascotBadge subtitle="평소엔 날렵한 2줄 · 클릭 시 1줄 펼침" />
                <span className="hidden sm:inline text-[11.5px] text-zinc-300 font-semibold">
                  외운 단축키는 <strong className="text-teal-300">F1~F12</strong> 즉시 발사 (엑셀 F2·브라우저 F5 충돌 0%)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setOpenHeaderDrawer((prev) => (prev === 'snippets' ? 'none' : 'snippets'))
                  }
                  className={`px-3 py-1.5 rounded-xl text-[12px] font-extrabold border transition-all flex items-center gap-1.5 cursor-pointer ${
                    openHeaderDrawer === 'snippets'
                      ? 'bg-teal-400 text-zinc-950 border-teal-300 shadow-sm'
                      : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-white/15'
                  }`}
                >
                  <span>⌨️ 상용구 (F1~F12)</span>
                  <span>{openHeaderDrawer === 'snippets' ? '▴' : '▾'}</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setOpenHeaderDrawer((prev) => (prev === 'clipboard' ? 'none' : 'clipboard'))
                  }
                  className={`px-3 py-1.5 rounded-xl text-[12px] font-extrabold border transition-all flex items-center gap-1.5 cursor-pointer ${
                    openHeaderDrawer === 'clipboard'
                      ? 'bg-amber-400 text-zinc-950 border-amber-300 shadow-sm'
                      : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-white/15'
                  }`}
                >
                  <span>📋🔍 클립보드 (최근 5개+검색)</span>
                  <span>{openHeaderDrawer === 'clipboard' ? '▴' : '▾'}</span>
                </button>
              </div>
            </div>

            {/* [아랫줄 — 첫 줄 Wave 1 핵심 초능력 5대 원클릭 탭] */}
            <div className="px-3 py-2 bg-[#11151E] border-b border-white/10 flex flex-wrap items-center gap-1.5">
              {[
                {
                  id: 1,
                  label: '① 한영·오타 자동성형',
                  sampleOut: '안녕하세요 확인 부탁드립니다 (dkssudgktpdy ➔ 0.1초 자동 변환)',
                },
                {
                  id: 2,
                  label: '② 연속복사 순차발사(1·2·3)',
                  sampleOut: '[순차발사 1/3] 홍길동 ➔ [2/3] 010-1234-5678 ➔ [3/3] 강남구 테헤란로 123',
                },
                {
                  id: 3,
                  label: '③ 서식 세탁·문장 다림질',
                  sampleOut: '글꼴·배경색·줄바꿈 찌꺼기 100% 제거된 순수 텍스트로 정돈 완료!',
                },
                {
                  id: 4,
                  label: '④ 금액·하이픈 변환',
                  sampleOut: '금 오천만 원정 (₩50,000,000 · VAT 별도) / 010-1234-5678',
                },
                {
                  id: 5,
                  label: '⑤ 화면 캡처 표·OCR',
                  sampleOut: '방금 캡처한 영역에서 표(TSV) 및 핵심 숫자 추출 준비 완료!',
                },
              ].map((ab) => {
                const active = activeWave1Ability === ab.id;
                return (
                  <button
                    key={ab.id}
                    type="button"
                    onClick={() => {
                      setActiveWave1Ability(ab.id);
                      if (ab.id === 5) {
                        setWindowTab('ui3_ocr');
                        return;
                      }
                      insertIntoUi1Editor(ab.sampleOut, ab.label);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-[12px] font-extrabold border transition-all cursor-pointer ${
                      active
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                        : 'bg-zinc-900/90 hover:bg-zinc-800 border-white/10 text-zinc-300'
                    }`}
                  >
                    {ab.label}
                  </button>
                );
              })}
            </div>

            {/* [조건부 펼침 1] [⌨️ 상용구 (F1~F12) ▾] 클릭 시: 왼쪽 6칸 F1~F6(개인) + 오른쪽 6칸 F7~F12(팀 공유) */}
            {openHeaderDrawer === 'snippets' && (
              <div className="p-4 bg-[#0D1119] border-b border-white/10 flex flex-col gap-3">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                  {/* 왼쪽 6칸: F1 ~ F6 개인 상용구 */}
                  <div className="p-3 rounded-2xl bg-zinc-950/90 border border-teal-500/35 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-black text-teal-300">
                        💻 왼쪽 6칸: F1 ~ F6 내 개인 상용구 (계좌·주소·이메일)
                      </span>
                      <span className="text-[10.5px] text-zinc-400 font-bold">
                        클릭 시 커서에 즉시 입력
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {snippets
                        .filter((s) => s.scope === 'personal')
                        .map((item) => (
                          <div
                            key={item.slot}
                            className="p-2 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-white/10 flex flex-col gap-1 transition-all"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  insertIntoUi1Editor(item.value, `${item.slot} ${item.title}`)
                                }
                                className="flex items-center gap-1.5 text-left min-w-0 flex-1 cursor-pointer"
                              >
                                <span className="px-1.5 py-0.5 rounded bg-teal-500/25 border border-teal-400/50 text-teal-200 font-mono text-[10.5px] font-black shrink-0">
                                  {item.slot}
                                </span>
                                <span className="text-[11.5px] font-extrabold text-white truncate">
                                  {item.title}
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingSlot(item.slot);
                                  setEditingValue(item.value);
                                }}
                                className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-bold cursor-pointer shrink-0"
                              >
                                ✏️ 편집
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                insertIntoUi1Editor(item.value, `${item.slot} ${item.title}`)
                              }
                              className="text-left text-[11px] text-zinc-300 truncate cursor-pointer hover:text-teal-200"
                            >
                              {item.value}
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* 오른쪽 6칸: F7 ~ F12 팀 공유 상용구 */}
                  <div className="p-3 rounded-2xl bg-zinc-950/90 border border-amber-400/40 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-black text-amber-300">
                        💼 오른쪽 6칸: F7 ~ F12 팀 공유 상용구 (전 직원 1초 동기화)
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-400/15 text-amber-200 text-[10px] font-extrabold">
                        방장 수정 시 전 직원 자동 반영
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {snippets
                        .filter((s) => s.scope === 'team')
                        .map((item) => (
                          <div
                            key={item.slot}
                            className="p-2 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-white/10 flex flex-col gap-1 transition-all"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  insertIntoUi1Editor(item.value, `${item.slot} ${item.title}`)
                                }
                                className="flex items-center gap-1.5 text-left min-w-0 flex-1 cursor-pointer"
                              >
                                <span className="px-1.5 py-0.5 rounded bg-amber-400/25 border border-amber-300/50 text-amber-200 font-mono text-[10.5px] font-black shrink-0">
                                  {item.slot}
                                </span>
                                <span className="text-[11.5px] font-extrabold text-white truncate">
                                  {item.title}
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingSlot(item.slot);
                                  setEditingValue(item.value);
                                }}
                                className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-bold cursor-pointer shrink-0"
                              >
                                ✏️ 편집
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                insertIntoUi1Editor(item.value, `${item.slot} ${item.title}`)
                              }
                              className="text-left text-[11px] text-zinc-300 truncate cursor-pointer hover:text-amber-200"
                            >
                              {item.value}
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>

                {editingSlot && (
                  <div className="p-3 rounded-xl bg-zinc-900 border border-teal-400/50 flex flex-wrap items-center gap-2">
                    <span className="text-[12px] font-black text-teal-300">
                      [{editingSlot}] 상용구 문구 수정:
                    </span>
                    <input
                      type="text"
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      className="flex-1 min-w-[220px] px-3 py-1.5 rounded-lg bg-zinc-950 border border-white/15 text-white text-[12px] font-bold outline-none focus:border-teal-400"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setSnippets((prev) =>
                          prev.map((s) =>
                            s.slot === editingSlot ? { ...s, value: editingValue } : s
                          )
                        );
                        setEditingSlot(null);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-teal-400 text-zinc-950 text-[11.5px] font-black cursor-pointer"
                    >
                      저장 완료
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingSlot(null)}
                      className="px-2.5 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-[11.5px] font-bold cursor-pointer"
                    >
                      취소
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* [조건부 펼침 2] [📋🔍 클립보드 (최근 5개+검색) ▾] 클릭 시: Win + V 사이즈 그대로 최근 5개 + 한달치 검색 */}
            {openHeaderDrawer === 'clipboard' && (
              <div className="p-4 bg-[#0D1119] border-b border-white/10 flex flex-col gap-3">
                <div className="w-full max-w-[460px] mx-auto p-3.5 rounded-2xl bg-zinc-950 border-2 border-amber-400/60 shadow-2xl flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-black text-amber-300">
                      📋🔍 Win + V 사이즈 클립보드 전용 창 (최근 5개 + 30일 검색)
                    </span>
                    <span className="px-2 py-0.5 rounded bg-zinc-900 border border-white/10 text-[10px] text-zinc-300 font-bold">
                      일반 파일과 섞이지 않는 클립보드 전용
                    </span>
                  </div>

                  {/* 상단 한 달 치 클립보드 검색칸 */}
                  <input
                    type="text"
                    value={clipboardQuery}
                    onChange={(e) => setClipboardQuery(e.target.value)}
                    placeholder="🔍 한 달 치 복사 내역 검색 (예: 계좌, 홈택스, 단가, 통관...)"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/15 text-white text-[12px] font-bold outline-none focus:border-amber-400"
                  />

                  {/* 최근 5개 클립보드 목록 */}
                  <div className="flex flex-col gap-1.5">
                    {filteredClipboardItems.map((clip, idx) => (
                      <button
                        key={clip.id}
                        type="button"
                        onClick={() =>
                          insertIntoUi1Editor(clip.content, `클립보드 #${idx + 1}`)
                        }
                        className="p-2.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-white/10 hover:border-amber-400/50 text-left flex items-start justify-between gap-2 transition-all cursor-pointer"
                      >
                        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-200 font-mono text-[10px] font-black">
                              {idx + 1}
                            </span>
                            <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 text-[10px] font-bold">
                              {clip.category}
                            </span>
                            <span className="text-[10px] text-zinc-400">{clip.copiedAt}</span>
                          </div>
                          <span className="text-[12px] text-white font-bold line-clamp-1 mt-0.5">
                            {clip.content}
                          </span>
                        </div>
                        <span className="px-2 py-1 rounded-lg bg-amber-400/15 text-amber-300 text-[10.5px] font-black shrink-0">
                          붙여넣기 ↵
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 하단 실제 작업창(카톡·이메일·엑셀) 커서 사출 시뮬레이터 */}
            <div className="p-3.5 bg-zinc-950 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] font-extrabold text-zinc-400">
                  💬 내 작업 현장 입력창 (위 상용구 F1~F12나 클립보드 항목을 누르면 이 커서 자리에 즉시 꽂힙니다)
                </span>
                <button
                  type="button"
                  onClick={() => setUi1EditorText('')}
                  className="text-[11px] text-zinc-400 hover:text-white cursor-pointer"
                >
                  입력창 비우기
                </button>
              </div>
              <textarea
                rows={2}
                value={ui1EditorText}
                onChange={(e) => setUi1EditorText(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-zinc-900 border border-white/15 text-emerald-200 text-[13px] font-bold outline-none focus:border-teal-400"
              />
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          [창 UI ② 시안] 작업 현장에서 드래그(기본) 또는 끝에 ?(보조) 후 Ctrl+0 ➔ 『현장 문서·숫자 유령 소환창』
         ════════════════════════════════════════════════════════════════════════ */}
      {windowTab === 'ui2_summon' && (
        <div className="p-5 sm:p-6 rounded-3xl bg-[#111318] border-2 border-teal-400/50 shadow-[0_0_40px_rgba(20,184,166,0.15)] flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-teal-400 text-zinc-950 text-[11.5px] font-black">
                창 UI ② 인터랙티브 시안
              </span>
              <h2 className="text-[16px] sm:text-[18px] font-black text-white">
                작업 현장에서 <code className="text-teal-300">드래그(기본)</code> 또는 <code className="text-amber-300">끝에 ?(보조)</code> 후 <code className="text-teal-300">Ctrl + 0</code> ➔ 『현장 문서·숫자 유령 소환창』
              </h2>
            </div>

            <div className="flex items-center gap-1.5">
              {SUMMON_SCENARIOS.map((scen, idx) => (
                <button
                  key={scen.id}
                  type="button"
                  onClick={() => setScenarioIdx(idx)}
                  className={`px-3 py-1.5 rounded-xl text-[11.5px] font-extrabold border cursor-pointer transition-all ${
                    scenarioIdx === idx
                      ? 'bg-teal-400 text-zinc-950 border-teal-300'
                      : 'bg-zinc-900 text-zinc-300 border-white/15 hover:bg-zinc-800'
                  }`}
                >
                  {idx === 0 ? '시나리오 A: 끝에 ? (보조 트리거)' : '시나리오 B: 마우스 드래그 (기본 트리거)'}
                </button>
              ))}
            </div>
          </div>

          {/* 1) 실제 일하던 카톡·이메일 작업창 시연 */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-white/15 flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[12px] font-black text-amber-300">
                💼 {currentScenario.scenarioTitle} ({currentScenario.triggerTypeLabel})
              </span>
              <button
                type="button"
                onClick={() => {
                  setUi2EditorText(currentScenario.initialEditorText);
                  setAttachedFileBadge(null);
                  setSummonReplacedNotice(null);
                }}
                className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 text-[11px] font-bold cursor-pointer"
              >
                ↺ 원래 질문 문장으로 초기화
              </button>
            </div>

            <input
              type="text"
              value={ui2EditorText}
              onChange={(e) => setUi2EditorText(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-zinc-900 border-2 border-teal-400/60 text-white text-[14px] font-extrabold outline-none"
            />

            {summonReplacedNotice && (
              <div className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 text-[12px] font-extrabold">
                {summonReplacedNotice}
              </div>
            )}
            {attachedFileBadge && (
              <div className="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-400/50 text-amber-200 text-[12px] font-extrabold flex items-center justify-between">
                <span>📎 첨부된 파일: {attachedFileBadge}</span>
                <button
                  type="button"
                  onClick={() => setAttachedFileBadge(null)}
                  className="text-xs underline cursor-pointer"
                >
                  첨부 취소
                </button>
              </div>
            )}
          </div>

          {/* 2) 커서 바로 위에 뜨는 Win+V 크기의 요약 결과 리스트 (좌측) + 마우스 호버 시 우측 반투명 유령 미리보기 말풍선 (우측) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            {/* 좌측(7칸): 맨 앞 👻 애기귀신 마스코트가 달린 얇은 요약 결과 리스트 (최대 5개) */}
            <div className="lg:col-span-7 p-4 rounded-2xl bg-[#0B0E14] border-2 border-teal-400/70 shadow-2xl flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                <GhostBabyMascotBadge subtitle={`“${currentScenario.targetToken}” 현장 유령 소환 (${currentScenario.candidates.length}건)`} />
                <span className="text-[11px] text-teal-300 font-extrabold">
                  마우스를 올리면(Hover) 우측에 유령 미리보기가 뜹니다 👉
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {currentScenario.candidates.map((cand, idx) => {
                  const isHovered = activeCandidate?.id === cand.id;
                  return (
                    <div
                      key={cand.id}
                      onMouseEnter={() => setHoveredCandidateId(cand.id)}
                      onFocus={() => setHoveredCandidateId(cand.id)}
                      className={`p-3 rounded-xl border transition-all flex flex-wrap items-center justify-between gap-2 cursor-pointer ${
                        isHovered
                          ? 'bg-teal-500/15 border-teal-400 shadow-md'
                          : 'bg-zinc-900/85 hover:bg-zinc-900 border-white/10'
                      }`}
                    >
                      <div
                        onClick={() => applySummonCandidateToEditor(cand, false)}
                        className="flex flex-col gap-0.5 min-w-0 flex-1"
                      >
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-teal-300 font-mono text-[10.5px] font-black">
                            #{idx + 1}
                          </span>
                          <span
                            className={`px-2 py-0.2 rounded text-[10.5px] font-black ${
                              cand.isFreePc
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                                : 'bg-amber-400/20 text-amber-200 border border-amber-300/40'
                            }`}
                          >
                            {cand.sourceBadge}
                          </span>
                          <span className="text-[12px] font-bold text-zinc-200 truncate">
                            {cand.fileName}
                          </span>
                        </div>
                        <div className="text-[13.5px] font-black text-white mt-0.5">
                          🎯 {cand.matchedValueShort}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => applySummonCandidateToEditor(cand, false)}
                          className="px-2.5 py-1.5 rounded-lg bg-teal-400 hover:bg-teal-300 text-zinc-950 text-[11.5px] font-black cursor-pointer"
                        >
                          정답 넣기 ↵
                        </button>
                        <button
                          type="button"
                          onClick={() => applySummonCandidateToEditor(cand, true)}
                          className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-white/15 text-amber-200 text-[11.5px] font-extrabold cursor-pointer"
                        >
                          📎 파일 첨부
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 우측(5칸): 마우스 호버 시에만 스윽 나타나는 반투명 유령 미리보기 말풍선 */}
            <div className="lg:col-span-5 p-4 rounded-2xl bg-gradient-to-br from-teal-950/60 via-zinc-950/95 to-zinc-950 border-2 border-dashed border-teal-400/60 shadow-[0_0_30px_rgba(20,184,166,0.2)] flex flex-col justify-between gap-3">
              {activeCandidate && (
                <>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-teal-400/20 border border-teal-300/50 text-teal-200 text-[11px] font-black">
                        👻 반투명 유령 미리보기 말풍선 (Zero-Open)
                      </span>
                      <span className="text-[10.5px] text-zinc-400 font-mono">
                        {activeCandidate.sourceBadge}
                      </span>
                    </div>

                    <h3 className="text-[13.5px] font-black text-white">
                      {activeCandidate.ghostPreviewTitle}
                    </h3>
                    <p className="text-[11px] text-zinc-400 font-mono truncate">
                      경로: {activeCandidate.folderPath}
                    </p>

                    <div className="mt-1 p-3 rounded-xl bg-black/70 border border-white/10 flex flex-col gap-1.5 font-mono text-[11.5px]">
                      {activeCandidate.ghostPreviewLines.map((line, lIdx) => {
                        const isHighlight = lIdx === activeCandidate.highlightRowIndex;
                        return (
                          <div
                            key={lIdx}
                            className={`px-2.5 py-1.5 rounded-lg transition-all ${
                              isHighlight
                                ? 'bg-amber-400/25 border border-amber-300 text-amber-100 font-extrabold shadow-sm'
                                : 'text-zinc-400'
                            }`}
                          >
                            {line}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-emerald-300 font-bold">
                      파일을 직접 열지 않고도(Zero-Open) 정답 줄만 즉시 확인!
                    </span>
                    <button
                      type="button"
                      onClick={() => applySummonCandidateToEditor(activeCandidate, false)}
                      className="px-3 py-1 rounded-lg bg-teal-400 text-zinc-950 text-[11px] font-black cursor-pointer shrink-0"
                    >
                      이 줄 커서에 꽂기 ↵
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 3) 하단 무료 vs 유료 확장 경계 안내 바 */}
          <div className="px-4 py-3 rounded-2xl bg-zinc-950 border border-teal-500/40 flex flex-wrap items-center justify-between gap-2 text-[12.5px] font-extrabold">
            <span className="text-emerald-300">
              💻 내 PC 문서 현장 소환 = <strong className="underline">평생 무제한 무료!</strong> (기본 검색 기능이므로 일 3회 제한 없음)
            </span>
            <span className="text-amber-300">
              📱 다른 기기(폰·집PC) 및 💼 회사 S: 드라이브 문서 현장 소환 = 유료 확장 (1개월 무제한 무료 후 일 3회 무료)
            </span>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          [창 UI ③ 시안] 1분 유효시간 + 1회 노출 후 자동 소멸(One-Time Pop) & 원본 화면 위 글자 그대로 톡톡 찍기 (Live Text 오버레이)
         ════════════════════════════════════════════════════════════════════════ */}
      {windowTab === 'ui3_ocr' && (
        <div className="p-5 sm:p-6 rounded-3xl bg-[#111318] border-2 border-teal-400/50 shadow-[0_0_40px_rgba(20,184,166,0.15)] flex flex-col gap-5">
          {/* 상단 헤더: 1분 유효시간(60초 TTL) + 1회 노출 후 자동 소멸(One-Time Pop) 규칙 배지 */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-teal-400 text-zinc-950 text-[11.5px] font-black">
                창 UI ③ 인터랙티브 시안
              </span>
              <h2 className="text-[16px] sm:text-[18px] font-black text-white">
                원본 화면 위에 글자 그대로 톡톡 찍기 (<span className="text-teal-300">Live Text 오버레이</span>) &amp; <span className="text-amber-300">1분 내 1회 노출 후 자동 소멸</span>
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full font-mono text-[11.5px] font-black border ${
                  oneTimePopUsed
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                    : 'bg-amber-400/20 border-amber-300 text-amber-200'
                }`}
              >
                {oneTimePopUsed
                  ? '✅ 1회 사용 완료 (다음 Ctrl+0부터 기본 귀신창 자동 복귀)'
                  : `⏱️ 촬영/스샷 후 1분 유효시간: ${ttlSecondsLeft}초 남음 (1회 노출 후 자동 소멸)`}
              </span>

              {customPhotoPreset && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedOcrPresetId(customPhotoPreset.id);
                    setClickedSpotIds([]);
                    setOneTimePopUsed(false);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[11.5px] font-extrabold border cursor-pointer ${
                    selectedOcrPresetId === customPhotoPreset.id
                      ? 'bg-amber-400 text-zinc-950 border-amber-300'
                      : 'bg-zinc-900 text-amber-200 border-amber-400/40'
                  }`}
                >
                  📸 방금 선택한 사진 ({externalOcrPhoto?.name})
                </button>
              )}
              {OCR_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setSelectedOcrPresetId(preset.id);
                    setClickedSpotIds([]);
                    setOneTimePopUsed(false);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[11.5px] font-extrabold border cursor-pointer ${
                    selectedOcrPresetId === preset.id
                      ? 'bg-teal-400 text-zinc-950 border-teal-300'
                      : 'bg-zinc-900 text-zinc-300 border-white/15 hover:bg-zinc-800'
                  }`}
                >
                  {preset.id === 'ocr_receipt' ? '샘플 1: 영수증·세금계산서 원본' : '샘플 2: 임대차 계약서 원본'}
                </button>
              ))}
            </div>
          </div>

          {/* 핵심 규칙 안내 콜아웃: ① 1분 유효 + 1회 노출 자동 소멸(One-Time Pop) & ② 원본 화면 위 글자 톡톡 찍기 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-zinc-950/90 border border-amber-400/40 flex flex-col gap-1">
              <span className="text-[12.5px] font-black text-amber-300">
                ⚡ 규칙 1. ‘1분 유효시간 + 1회 노출 후 자동 소멸(One-Time Pop)’ ➔ 귀찮음 0%!
              </span>
              <p className="text-[11.5px] text-zinc-300 leading-snug">
                폰으로 찍거나 캡처한 직후 <strong>딱 1분 이내에, 그것도 Ctrl+0으로 한 번 호출해서 썼으면 그 뒤로는 다시 안 뜨게(자동 소멸)</strong> 작동합니다. 다음 <code className="text-teal-300">Ctrl+0</code>부터는 지체 없이 원래의 기본 귀신창(창 UI ①)으로 돌아가 작업 흐름이 절대 끊기지 않습니다.
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-zinc-950/90 border border-teal-400/40 flex flex-col gap-1">
              <span className="text-[12.5px] font-black text-teal-300">
                👆 규칙 2. 어설픈 요약 칩 대신 ‘원본 화면 위에 글자 그대로 톡톡 찍기(Live Text)’ ➔ 활용도 100%!
              </span>
              <p className="text-[11.5px] text-zinc-300 leading-snug">
                유저마다 상호를 원할지, 품명을 원할지, 문구 한 줄을 원할지 아무도 모릅니다. <strong>아래 원본 화면 속 원래 글자 위치 위에 투명하게 올라온 텍스트 블록을 마우스로 톡톡 찍기만 하면</strong> 그 글자가 내 커서에 쏙쏙 들어갑니다!
              </p>
            </div>
          </div>

          {/* ── 메인 Live Text 원본 캔버스 (별도 우측 요약칩 박스 없이 큼직한 원본 화면 위에서 바로 글자 톡톡 찍기!) ── */}
          <div className="w-full max-w-[960px] mx-auto rounded-2xl bg-[#0B0E14] border-2 border-teal-400/80 shadow-[0_18px_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col">
            {/* 상단 액션 바: 👻 마스코트 + [🖼️ 원본 사진 그대로 넣기] + [📊 표 전체 엑셀(TSV) 넣기] + [📋 전체 글자 복사] */}
            <div className="px-4 py-3 bg-gradient-to-r from-zinc-900 via-[#111927] to-zinc-900 border-b border-white/10 flex flex-wrap items-center justify-between gap-2.5">
              <GhostBabyMascotBadge subtitle={activeOcrPreset.sourceLabel} />

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOneTimePopUsed(true);
                    setUi3CursorEditorText(
                      (prev) => `${prev} [원본 이미지 첨부됨: ${activeOcrPreset.title}]`
                    );
                    useSaySeeStore.setState({
                      lastQuarantineToast:
                        '🖼️ [원본 사진 그대로 넣기 완료] 현재 커서 자리에 고화질 사진 원본이 첨부되었습니다! (1회 사용 완료 · 다음 Ctrl+0부터 기본 귀신창 복귀)',
                    });
                  }}
                  className="px-3 py-1.5 rounded-xl bg-teal-400 hover:bg-teal-300 text-zinc-950 text-[12px] font-black cursor-pointer shadow-sm"
                >
                  🖼️ 원본 사진 그대로 넣기
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOneTimePopUsed(true);
                    setUi3CursorEditorText(
                      (prev) => `${prev} ${activeOcrPreset.tsvTableText.replace(/\n/g, ' | ')}`
                    );
                    if (typeof navigator !== 'undefined' && navigator.clipboard) {
                      void navigator.clipboard.writeText(activeOcrPreset.tsvTableText);
                    }
                    useSaySeeStore.setState({
                      lastQuarantineToast:
                        '📊 [표 전체 엑셀(TSV) 넣기 완료] 엑셀에 붙여넣으면 열·행이 딱 맞게 들어갑니다! (1회 사용 완료)',
                    });
                  }}
                  className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-[12px] font-black cursor-pointer shadow-sm"
                >
                  📊 표 전체 엑셀(TSV) 넣기
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOneTimePopUsed(true);
                    setUi3CursorEditorText((prev) => `${prev} ${activeOcrPreset.fullText}`);
                    if (typeof navigator !== 'undefined' && navigator.clipboard) {
                      void navigator.clipboard.writeText(activeOcrPreset.fullText);
                    }
                    useSaySeeStore.setState({
                      lastQuarantineToast: '📋 [전체 글자 복사 완료] 문서 전체 텍스트가 복사되었습니다!',
                    });
                  }}
                  className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-white/15 text-zinc-200 text-[12px] font-extrabold cursor-pointer"
                >
                  📋 전체 글자 복사
                </button>
              </div>
            </div>

            {/* 큼직한 원본 사진·문서 화면 + 이미지 속 원래 글자 위치 위에 투명하게 얹힌 Live Text 블록들 */}
            <div className="relative w-full min-h-[390px] sm:min-h-[430px] bg-zinc-950 overflow-hidden select-none">
              <img
                src={activeOcrPreset.thumbUrl}
                alt={activeOcrPreset.title}
                className="absolute inset-0 w-full h-full object-cover opacity-35 blur-[0.5px]"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/50 to-black/75" />

              {/* 상단 오버레이 가이드 캡션 */}
              <div className="relative z-10 px-4 pt-3 pb-1 flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-lg bg-black/80 border border-teal-400/50 text-teal-200 text-[11.5px] font-extrabold">
                  👆 아래 원본 화면 위의 글자 줄(상호·품명·단가·합계·계좌·특약 등)을 원하는 대로 마우스로 톡톡 찍어보세요!
                </span>
                <span className="hidden sm:inline text-[11px] text-amber-300 font-bold">
                  여러 줄을 연속으로 톡톡 찍으면 찍은 순서대로 커서에 들어갑니다
                </span>
              </div>

              {/* 이미지 속 원래 글자 위치 위에 투명하게 얹힌 Live Text 오버레이 블록들 */}
              <div className="relative z-10 w-full h-[340px] sm:h-[375px]">
                {activeOcrPreset.liveTextSpots.map((spot) => {
                  const wasClicked = clickedSpotIds.includes(spot.id);
                  return (
                    <button
                      key={spot.id}
                      type="button"
                      onClick={() => handleTapLiveTextOnImage(spot)}
                      style={{
                        top: `${spot.topPercent}%`,
                        left: `${spot.leftPercent}%`,
                      }}
                      title={`클릭 시 "${spot.insertValue}" 즉시 복사 및 커서 입력`}
                      className={`group absolute right-[6%] px-3.5 py-2 rounded-xl backdrop-blur-md border text-left transition-all flex items-center justify-between gap-3 cursor-pointer active:scale-[0.99] ${
                        wasClicked
                          ? 'bg-emerald-500/30 border-2 border-emerald-300 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]'
                          : spot.isPrimaryHighlight
                          ? 'bg-black/65 hover:bg-teal-500/30 border-teal-400/75 hover:border-teal-300 text-white shadow-md'
                          : 'bg-black/55 hover:bg-amber-400/25 border-white/25 hover:border-amber-300 text-zinc-100'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-black shrink-0 ${
                            wasClicked
                              ? 'bg-emerald-300 text-zinc-950'
                              : spot.isPrimaryHighlight
                              ? 'bg-teal-400/25 text-teal-200 border border-teal-300/40'
                              : 'bg-zinc-800 text-zinc-300'
                          }`}
                        >
                          {wasClicked ? '✓ 입력됨' : spot.categoryHint}
                        </span>
                        <span className="font-mono text-[12.5px] sm:text-[13.5px] font-extrabold tracking-tight truncate">
                          {spot.displayText}
                        </span>
                      </div>

                      <span className="px-2.5 py-0.5 rounded-lg bg-teal-400/20 group-hover:bg-teal-400 text-teal-200 group-hover:text-zinc-950 text-[11px] font-black shrink-0 transition-colors">
                        👆 톡 찍어 넣기 ↵
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 하단: 실시간 커서 입력 확인창 + [One-Time Pop] 다음 Ctrl+0 시 기본 귀신창 자동 복귀 시연 버튼 */}
            <div className="p-4 bg-zinc-950 border-t border-white/10 flex flex-col gap-2.5">
              {lastInsertedSpotNotice && (
                <div className="px-3.5 py-2 rounded-xl bg-emerald-500/20 border border-emerald-400/50 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[12px] font-extrabold text-emerald-200">
                    {lastInsertedSpotNotice}
                  </span>
                  <button
                    type="button"
                    onClick={handleSimulateNextCtrlZeroPress}
                    className="px-3 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 text-[11.5px] font-black cursor-pointer shrink-0 shadow-sm"
                  >
                    ⚡ 다음 Ctrl+0 눌러보기 ➔ 기본 귀신창(창 UI ①) 자동 복귀 확인!
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between gap-2">
                <span className="text-[11.5px] font-extrabold text-zinc-300">
                  💬 내 작업 현장 커서 (위 원본 화면에서 톡톡 찍은 글자가 그대로 꽂힙니다):
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setOneTimePopUsed(false);
                      setTtlSecondsLeft(60);
                      setClickedSpotIds([]);
                      setLastInsertedSpotNotice(null);
                    }}
                    className="text-[11px] text-teal-300 hover:underline font-bold cursor-pointer"
                  >
                    📸 새 사진/스샷 다시 찍기 (1분 타이머 리셋)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUi3CursorEditorText('');
                      setClickedSpotIds([]);
                    }}
                    className="text-[11px] text-zinc-400 hover:text-white cursor-pointer"
                  >
                    입력창 비우기
                  </button>
                </div>
              </div>

              <input
                type="text"
                value={ui3CursorEditorText}
                onChange={(e) => setUi3CursorEditorText(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border-2 border-teal-400/60 text-white text-[13.5px] font-extrabold outline-none"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export const GhostPhotoOcrTeleportModal: React.FC<{
  photo: PhotoItem | null;
  onClose: () => void;
}> = ({ photo, onClose }) => {
  if (!photo) return null;
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[130] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl rounded-3xl bg-[#0B0E14] border-2 border-teal-400 p-5 sm:p-6 shadow-[0_0_60px_rgba(20,184,166,0.3)] flex flex-col gap-4 my-auto"
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <GhostBabyMascotBadge subtitle="원본 화면 위에 글자 그대로 톡톡 찍기 (Live Text 오버레이)" />
            <span className="text-[14px] font-black text-white truncate">
              {photo.name}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[12px] font-extrabold cursor-pointer"
          >
            ✕ 닫기
          </button>
        </div>

        <GhostWindowThreeStageMockup
          activeTier="pc_free"
          initialWindowTab="ui3_ocr"
          externalOcrPhoto={photo}
        />
      </div>
    </div>
  );
};
