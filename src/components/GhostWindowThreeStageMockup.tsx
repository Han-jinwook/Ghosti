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
    copiedAt: '방금 전',
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
    content: 'https://ghosti.sundreamer.app — 사진·영상·문서 1초 AI 내용검색',
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

export type MiniExplorerMediaFilter = 'all' | 'doc' | 'photo' | 'video';

interface SummonCandidateItem {
  id: string;
  mediaType: 'doc' | 'photo' | 'video';
  sourceBadge: '💻 내 PC' | '📱 내 폰·집PC' | '💼 팀 S: 드라이브';
  tierScope: GhostWindowTierMode;
  isFreePc: boolean;
  fileName: string;
  folderPath: string;
  matchedValueShort: string;
  replaceSentence: string;
  ghostPreviewTitle: string;
  ghostPreviewLines: string[];
  highlightRowIndex: number;
  thumbUrl?: string;
  photoMetaSummary?: string;
  videoTimestamp?: string;
  keywords: string[];
}

const MINI_EXPLORER_ITEMS: SummonCandidateItem[] = [
  // 📄 문서 2건
  {
    id: 'mini_doc_1',
    mediaType: 'doc',
    sourceBadge: '💻 내 PC',
    tierScope: 'pc_free',
    isFreePc: true,
    fileName: '250301_내용_임대차계약서_역삼빌딩.pdf',
    folderPath: 'C:\\Users\\Merlin\\Documents\\계약서',
    matchedValueShort: '보증금 5,000만 원 / 월세 220만 원 (제4조)',
    replaceSentence: '보증금 5,000만 원 (월 차임 220만 원 · 임대차계약서 제4조)',
    ghostPreviewTitle: '📄 250301_내용_임대차계약서_역삼빌딩.pdf',
    ghostPreviewLines: [
      '제3조 (소재지) 서울특별시 강남구 역삼동 823-14 테헤란빌딩 6층',
      '👉 제4조 (보증금 및 차임) 보증금 금 오천만 원정 (₩50,000,000) / 월세 2,200,000원',
      '제5조 (계약기간) 2025년 03월 01일 ~ 2027년 02월 28일 (24개월)',
      '특약사항 2: 퇴실 시 기본 칸막이 원상복구 의무는 면제하기로 한다.',
    ],
    highlightRowIndex: 1,
    keywords: ['계약서', '보증금', '단가', '월세', '임대차', '문서'],
  },
  {
    id: 'mini_doc_2',
    mediaType: 'doc',
    sourceBadge: '💼 팀 S: 드라이브',
    tierScope: 'work_team',
    isFreePc: false,
    fileName: '261105_김대리_A업체_납품단가표.xlsx',
    folderPath: 'S:\\02_구매자재',
    matchedValueShort: 'A업체 표준 납품단가 @14,500원 (500개 이상 @13,800원)',
    replaceSentence: 'A업체 표준 납품단가 개당 14,500원 (500개 이상 13,800원)',
    ghostPreviewTitle: '📊 S:\\02_구매자재\\261105_김대리_A업체_납품단가표.xlsx',
    ghostPreviewLines: [
      '코드   | 업체명         | 품목명        | 단가(원)  | MOQ 할인가',
      '👉 V-01 | A업체(성진정밀) | 방열 하우징   | 14,500원  | 500개 이상 13,800원',
      'V-02   | B업체(한일테크) | 실리콘 가스켓 | 2,100원   | 1,000개 이상 1,950원',
    ],
    highlightRowIndex: 1,
    keywords: ['단가', '납품', 'A업체', '엑셀', '보증금', '계약서', '문서'],
  },
  // 🖼️ 사진 2건
  {
    id: 'mini_photo_1',
    mediaType: 'photo',
    sourceBadge: '💻 내 PC',
    tierScope: 'pc_free',
    isFreePc: true,
    fileName: '240510_사업자등록증_썬드림.jpg',
    folderPath: 'C:\\Users\\Merlin\\Pictures\\회사증빙',
    matchedValueShort: '등록번호 214-88-12345 · 대표 백은숙 · 서울 성동구 성수이로 88',
    replaceSentence: '[사진 첨부] 240510_사업자등록증_썬드림.jpg (214-88-12345)',
    ghostPreviewTitle: '🖼️ 240510_사업자등록증_썬드림.jpg',
    ghostPreviewLines: [
      '👉 [법인 사업자등록증] 상호: (주)썬드리머  |  등록번호: 214-88-12345',
      '대표자: 백은숙  |  개업연월일: 2024년 05월 10일',
      '사업장소재지: 서울특별시 성동구 성수이로 88, 7층',
    ],
    highlightRowIndex: 0,
    thumbUrl: '/sample_photos_301/MEMO_202509_1259_주차장_기둥.jpg',
    photoMetaSummary: '📅 2024-05-10 · 📍 성수동 본사 · #사업자등록증 #세금계산서',
    keywords: ['사업자등록증', '사진', '썬드림', '영수증', '제주도', '가족사진', '시공'],
  },
  {
    id: 'mini_photo_2',
    mediaType: 'photo',
    sourceBadge: '📱 내 폰·집PC',
    tierScope: 'phone_pc',
    isFreePc: false,
    fileName: '251012_제주성산_가족단체.jpg',
    folderPath: '📱 내 폰 갤러리 > 제주도 가족여행',
    matchedValueShort: '제주 성산일출봉 해변 가족 단체사진 (베스트컷)',
    replaceSentence: '[사진 첨부] 251012_제주성산_가족단체.jpg',
    ghostPreviewTitle: '🖼️ 251012_제주성산_가족단체.jpg',
    ghostPreviewLines: [
      '👉 촬영일: 2025-10-12 15:40 · 장소: 제주 서귀포시 성산일출봉 해변',
      '인물 자동분류: 부모님 · 멀린 · 백은숙 대표님 (베스트컷)',
    ],
    highlightRowIndex: 0,
    thumbUrl: '/sample_photos_301/20250504_1420_어린이날_선물.jpg',
    photoMetaSummary: '📅 2025-10-12 · 📍 제주 성산일출봉 · 👨‍👩‍👧‍👦 가족 단체컷',
    keywords: ['제주도', '가족사진', '바다', '여행', '사진', '사업자등록증'],
  },
  // 🎬 영상 2건
  {
    id: 'mini_video_1',
    mediaType: 'video',
    sourceBadge: '💻 내 PC',
    tierScope: 'pc_free',
    isFreePc: true,
    fileName: '261020_신제품_시연_하이라이트.mp4',
    folderPath: 'C:\\Users\\Merlin\\Videos\\제품시연',
    matchedValueShort: '⏱️ 01:24 핵심장면 — 1초 내용검색 데모 구간',
    replaceSentence: '[영상 01:24 캡처 삽입] 261020_신제품_시연_하이라이트.mp4',
    ghostPreviewTitle: '🎬 261020_신제품_시연_하이라이트.mp4 (01:24)',
    ghostPreviewLines: [
      '00:15 — 오프닝 및 기존 탐색기 비교',
      '👉 [01:24 핵심 장면] Ctrl+0 호출 즉시 계약서·사진 소환 장면',
      '02:10 — 클로징 안내',
    ],
    highlightRowIndex: 1,
    thumbUrl: '/sample_photos_301/20251224_2010_크리스마스_케이크.jpg',
    videoTimestamp: '01:24',
    photoMetaSummary: '🎬 02:45 · 🎯 포착 구간 01:24',
    keywords: ['영상', '시연', '신제품', '시공', '성수동', '하이라이트'],
  },
  {
    id: 'mini_video_2',
    mediaType: 'video',
    sourceBadge: '💼 팀 S: 드라이브',
    tierScope: 'work_team',
    isFreePc: false,
    fileName: '261102_김대리_성수동_시공전후.mp4',
    folderPath: 'S:\\04_현장시공',
    matchedValueShort: '⏱️ 00:42 핵심장면 — 성수동 쇼룸 간접조명 점등 완료',
    replaceSentence: '[영상 00:42 캡처 삽입] 261102_김대리_성수동_시공전후.mp4',
    ghostPreviewTitle: '🎬 S:\\04_현장시공\\261102_김대리_성수동_시공전후.mp4 (00:42)',
    ghostPreviewLines: [
      '00:05 — 철거 직후 바닥 수평 몰탈 타설',
      '👉 [00:42 핵심 장면] 성수동 쇼룸 천장 라인조명 시공 완료',
      '01:18 — 최종 검수 완료',
    ],
    highlightRowIndex: 1,
    thumbUrl: '/sample_photos_301/20250720_1630_여름휴가_계곡.jpg',
    videoTimestamp: '00:42',
    photoMetaSummary: '🎬 01:35 · 💼 S: 드라이브 · 🎯 00:42',
    keywords: ['성수동', '시공', '인테리어', '영상', '현장'],
  },
];

const SUMMON_SCENARIOS: {
  id: string;
  shortLabel: string;
  initialEditorText: string;
  targetToken: string;
  windowContextTitle?: string;
}[] = [
  {
    id: 'scen_question_mark',
    shortLabel: '문장 끝에 ? 입력',
    initialEditorText: '김 대리님, 거래처에 보낼 작년 계약서 보증금? 그리고 사업자등록증 사진도 첨부해 주세요.',
    targetToken: '작년 계약서 보증금?',
    windowContextTitle: '카카오톡 - 김대리_강남현장',
  },
  {
    id: 'scen_drag_block',
    shortLabel: '단어 드래그 호출',
    initialEditorText: '박 팀장님, 이번 품의서에 A업체 납품단가 반영하고 성수동 시공 영상 캡처본 같이 넣겠습니다.',
    targetToken: 'A업체 납품단가',
    windowContextTitle: '사내 메일 - 4분기 구매품의서',
  },
  {
    id: 'scen_safety2_empty_caret',
    shortLabel: '빈칸에서 바로 검색',
    initialEditorText: '',
    targetToken: '',
    windowContextTitle: '카카오톡 - 김대리_강남현장',
  },
];

const ROW0_PHONE_OCR_DOCK_CHIPS = [
  { id: 'r0_chip_1', label: '인증번호 849201', value: '849201' },
  { id: 'r0_chip_2', label: '사업자 123-45-67890', value: '123-45-67890' },
  { id: 'r0_chip_3', label: '합계 145,000원', value: '145,000원' },
  { id: 'r0_chip_4', label: '국민 012-3456-7890', value: '국민은행 012-3456-7890' },
  { id: 'r0_chip_5', label: '📊 표 복사', value: '승인번호\t20261107-849201\t합계\t145,000원' },
];

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
    title: '영수증 · 세금계산서 사진',
    sourceLabel: '📱 방금 찍은 사진 (1분간 표시)',
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
        categoryHint: '승인번호',
        displayText: '전자세금계산서 · 승인번호: 20261107-849201',
        insertValue: '20261107-849201',
        isPrimaryHighlight: true,
      },
      {
        id: 'spot_2',
        topPercent: 21,
        leftPercent: 6,
        categoryHint: '상호·대표',
        displayText: '상호: (주)성수오피스디포  |  성명: 김상훈',
        insertValue: '(주)성수오피스디포',
      },
      {
        id: 'spot_3',
        topPercent: 33,
        leftPercent: 6,
        categoryHint: '사업자번호',
        displayText: '사업자등록번호: 123-45-67890',
        insertValue: '123-45-67890',
        isPrimaryHighlight: true,
      },
      {
        id: 'spot_4',
        topPercent: 46,
        leftPercent: 6,
        categoryHint: '품목 1',
        displayText: '품목 1: 프리미엄 A4 복사용지 (80g) · 10 BOX · 단가 22,000원',
        insertValue: '프리미엄 A4 복사용지 (80g) 10박스',
      },
      {
        id: 'spot_5',
        topPercent: 58,
        leftPercent: 6,
        categoryHint: '품목 2',
        displayText: '품목 2: 정품 레이저 토너 카트리지 (BK) · 2 EA · 단가 44,500원',
        insertValue: '정품 레이저 토너 카트리지 (BK) 2개',
      },
      {
        id: 'spot_6',
        topPercent: 71,
        leftPercent: 6,
        categoryHint: '합계금액',
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
    title: '부동산 임대차 계약서 사진',
    sourceLabel: '💻 사진에서 글자 따기',
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
        categoryHint: '소재지',
        displayText: '제1조 [소재지] 서울특별시 강남구 역삼동 823-14 테헤란빌딩 6층',
        insertValue: '서울특별시 강남구 역삼동 823-14 테헤란빌딩 6층',
      },
      {
        id: 'c_spot_2',
        topPercent: 24,
        leftPercent: 6,
        categoryHint: '보증금',
        displayText: '제2조 [보증금] 금 오천만 원정 (₩50,000,000)',
        insertValue: '금 오천만 원정 (₩50,000,000)',
        isPrimaryHighlight: true,
      },
      {
        id: 'c_spot_3',
        topPercent: 39,
        leftPercent: 6,
        categoryHint: '월차임',
        displayText: '제3조 [월차임] 금 이백이십만 원정 (₩2,200,000 · VAT 별도)',
        insertValue: '월차임 2,200,000원 (VAT 별도)',
        isPrimaryHighlight: true,
      },
      {
        id: 'c_spot_4',
        topPercent: 54,
        leftPercent: 6,
        categoryHint: '계약기간',
        displayText: '제4조 [계약기간] 2025년 03월 01일 ~ 2027년 02월 28일 (24개월)',
        insertValue: '2025년 03월 01일 ~ 2027년 02월 28일 (24개월)',
      },
      {
        id: 'c_spot_5',
        topPercent: 69,
        leftPercent: 6,
        categoryHint: '특약사항',
        displayText: '특약 제2항: 퇴실 시 기본 칸막이 원상복구 의무는 면제한다.',
        insertValue: '임차인의 퇴실 시 기본 설치 칸막이에 대한 원상복구 의무는 면제한다.',
        isPrimaryHighlight: true,
      },
      {
        id: 'c_spot_6',
        topPercent: 83,
        leftPercent: 6,
        categoryHint: '임대인 계좌',
        displayText: '임대인: 김철수 (신한은행 110-482-991023)',
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
    title: `${photo.name}`,
    sourceLabel: '🔍 사진에서 글자 따기',
    thumbUrl: photo.thumbUrl,
    fullText: `[사진 글자 추출] 파일명: ${photo.name} | 촬영일: ${photo.date} | 상호: (주)성수오피스디포 | 사업자번호: 123-45-67890 | 품목: ${cleanTags.join(' · ') || baseName} | 합계금액: 145,000원 | 입금계좌: 국민은행 012-3456-7890-11`,
    tsvTableText: `항목\t추출값\n파일명\t${photo.name}\n촬영일\t${photo.date}\n핵심내용\t${cleanTags.join(', ')}\n사업자번호\t123-45-67890\n합계금액\t145,000원\n입금계좌\t국민은행 012-3456-7890-11`,
    liveTextSpots: [
      {
        id: 'p_spot_1',
        topPercent: 10,
        leftPercent: 6,
        categoryHint: '제목·촬영일',
        displayText: `${baseName} (${photo.date})`,
        insertValue: `${baseName} (${photo.date})`,
      },
      {
        id: 'p_spot_2',
        topPercent: 26,
        leftPercent: 6,
        categoryHint: '상호·내용',
        displayText: `(주)성수오피스디포  |  ${cleanTags.slice(0, 2).join(' · ') || baseName}`,
        insertValue: `(주)성수오피스디포 (${cleanTags.slice(0, 2).join(', ') || baseName})`,
        isPrimaryHighlight: true,
      },
      {
        id: 'p_spot_3',
        topPercent: 43,
        leftPercent: 6,
        categoryHint: '사업자번호',
        displayText: '사업자등록번호: 123-45-67890',
        insertValue: '123-45-67890',
        isPrimaryHighlight: true,
      },
      {
        id: 'p_spot_4',
        topPercent: 60,
        leftPercent: 6,
        categoryHint: '합계금액',
        displayText: '공급가액 131,818원  |  부가세 13,182원  |  합계: 145,000원',
        insertValue: '145,000원',
        isPrimaryHighlight: true,
      },
      {
        id: 'p_spot_5',
        topPercent: 78,
        leftPercent: 6,
        categoryHint: '입금계좌',
        displayText: '입금계좌: 국민은행 012-3456-7890-11',
        insertValue: '국민은행 012-3456-7890-11',
        isPrimaryHighlight: true,
      },
    ],
  };
}

export const GhostBabyMascotBadge: React.FC<{ subtitle?: string }> = ({ subtitle }) => (
  <div className="inline-flex items-center gap-2 select-none">
    <div className="relative w-7 h-7 rounded-xl bg-gradient-to-br from-teal-400/25 via-emerald-400/15 to-amber-300/20 border border-teal-300/50 flex items-center justify-center shadow-[0_0_12px_rgba(45,212,191,0.3)] shrink-0">
      <svg viewBox="0 0 36 36" className="w-5 h-5" aria-hidden="true">
        <path
          d="M18 4C11.4 4 6.5 9 6.5 15.6v12.2c0 1.4 1.6 2.2 2.7 1.3l2.2-1.8c.8-.6 1.9-.6 2.7 0l2.1 1.7c.9.8 2.3.8 3.2 0l2.1-1.7c.8-.6 1.9-.6 2.7 0l2.2 1.8c1.1.9 2.7.1 2.7-1.3V15.6C29.5 9 24.6 4 18 4z"
          fill="#F8FAFC"
        />
        <circle cx="14" cy="15.5" r="2" fill="#0F172A" />
        <circle cx="22" cy="15.5" r="2" fill="#0F172A" />
        <circle cx="13.3" cy="14.8" r="0.7" fill="#FFFFFF" />
        <circle cx="21.3" cy="14.8" r="0.7" fill="#FFFFFF" />
        <ellipse cx="11.2" cy="18.2" rx="1.6" ry="0.9" fill="#FB7185" opacity="0.75" />
        <ellipse cx="24.8" cy="18.2" rx="1.6" ry="0.9" fill="#FB7185" opacity="0.75" />
        <path
          d="M15.4 18.8c.8 1.1 1.7 1.6 2.6 1.6s1.8-.5 2.6-1.6"
          stroke="#0F172A"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </div>
    <div className="flex flex-col leading-none">
      <div className="flex items-center gap-1.5">
        <span className="font-headline-sm text-[13.5px] font-black tracking-tight text-white">
          귀신같이
        </span>
        <span className="px-1.5 py-0.5 rounded bg-teal-400/20 border border-teal-300/40 text-teal-200 font-mono text-[10px] font-extrabold">
          우클릭 꾹 · Ctrl+0
        </span>
      </div>
      {subtitle && (
        <span className="text-[10.5px] text-zinc-400 font-semibold mt-0.5">{subtitle}</span>
      )}
    </div>
  </div>
);

interface GhostWindowThreeStageMockupProps {
  activeTier?: GhostWindowTierMode;
  onTierChange?: (tier: GhostWindowTierMode) => void;
  initialWindowTab?: GhostWindowUiTab;
  externalOcrPhoto?: PhotoItem | null;
}

export const GhostWindowThreeStageMockup: React.FC<GhostWindowThreeStageMockupProps> = ({
  activeTier = 'pc_free',
  onTierChange,
  initialWindowTab = 'ui1_basic',
  externalOcrPhoto = null,
}) => {
  const [windowTab, setWindowTab] = useState<GhostWindowUiTab>(initialWindowTab);
  const [tierMode, setTierMode] = useState<GhostWindowTierMode>(activeTier);

  useEffect(() => {
    setTierMode(activeTier);
  }, [activeTier]);

  useEffect(() => {
    setWindowTab(initialWindowTab);
  }, [initialWindowTab]);

  // ── 창 UI ① 상태 (2줄 미니멀 바 + 조건부 펼침: 상용구 F1~F12 / 클립보드 Win+V 사이즈) ──
  const [openHeaderDrawer, setOpenHeaderDrawer] = useState<'none' | 'snippets' | 'clipboard' | 'tips'>('none');
  const [snippets, setSnippets] = useState<SnippetSlotItem[]>(INITIAL_SNIPPET_SLOTS_12);
  const [editingSlot, setEditingSlot] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [clipboardQuery, setClipboardQuery] = useState('');
  const [ui1EditorText, setUi1EditorText] = useState(
    '안녕하세요, 요청하신 정산 계좌 및 서류 정보를 아래에 전달드립니다: '
  );
  const [activeWave1Ability, setActiveWave1Ability] = useState<number>(2);

  // ── 창 UI ② 상태 (귀신 미니 탐색기 — 현장 문서·사진·영상 통합 소환 & 이어서 검색) ──
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const currentScenario = SUMMON_SCENARIOS[scenarioIdx] || SUMMON_SCENARIOS[0];
  const [ui2EditorText, setUi2EditorText] = useState(currentScenario.initialEditorText);
  const [miniExplorerQuery, setMiniExplorerQuery] = useState('계약서 보증금');
  const [miniMediaFilter, setMiniMediaFilter] = useState<MiniExplorerMediaFilter>('all');
  const [hoveredCandidateId, setHoveredCandidateId] = useState<string>(MINI_EXPLORER_ITEMS[0].id);
  const [summonReplacedNotice, setSummonReplacedNotice] = useState<string | null>(null);
  const [attachedFileBadge, setAttachedFileBadge] = useState<string | null>(null);
  const [showRow0PhoneOcrDock, setShowRow0PhoneOcrDock] = useState<boolean>(true);
  const [phoneOcrDockSeconds, setPhoneOcrDockSeconds] = useState<number>(58);

  useEffect(() => {
    const scen = SUMMON_SCENARIOS[scenarioIdx] || SUMMON_SCENARIOS[0];
    setUi2EditorText(scen.initialEditorText);
    setSummonReplacedNotice(null);
    setAttachedFileBadge(null);
    if (scenarioIdx === 0) {
      setMiniExplorerQuery('계약서 보증금');
      setMiniMediaFilter('all');
    } else if (scenarioIdx === 1) {
      setMiniExplorerQuery('A업체 납품단가');
      setMiniMediaFilter('all');
    } else {
      setMiniExplorerQuery('');
      setMiniMediaFilter('all');
    }
  }, [scenarioIdx]);

  // ── 창 UI ③ 상태 (사진·스샷 글자 톡톡 찍기) ──
  const [ocrPresetIdx, setOcrPresetIdx] = useState(0);
  const [clickedSpotIds, setClickedSpotIds] = useState<string[]>([]);
  const [ui3CursorEditorText, setUi3CursorEditorText] = useState('입금하실 금액 및 계좌: ');
  const [ttlSecondsLeft, setTtlSecondsLeft] = useState<number>(58);
  const [oneTimePopUsed, setOneTimePopUsed] = useState<boolean>(false);
  const [lastInsertedSpotNotice, setLastInsertedSpotNotice] = useState<string | null>(null);

  // ── 하단 부가 체험 모달 상태 (귀신 라벨러 / 귀신 말풍선 / 30일 체험 모달 / 절약 리포트 모달) ──
  const [labelerScopeMode, setLabelerScopeMode] = useState<'personal' | 'work_s'>('personal');
  const [activePromoModal, setActivePromoModal] = useState<'none' | 'opt_in_30d' | 'loss_aversion_3limit' | 'training_dojo'>('none');
  const [trialOptInAccepted, setTrialOptInAccepted] = useState<boolean>(true);
  const [trainingStage, setTrainingStage] = useState<1 | 2 | 3>(1);
  const [showAdvancedUtils, setShowAdvancedUtils] = useState<boolean>(true);

  const playExistingGhostSound = (kind: 'summon' | 'success') => {
    try {
      const src =
        kind === 'summon'
          ? '/sounds/active_summon_sound.wav'
          : '/sounds/active_typo_sound.wav';
      const audio = new Audio(src);
      audio.volume = 0.20;
      void audio.play().catch(() => {});
    } catch {
      // ignore audio autoplay block
    }
  };

  useEffect(() => {
    if (windowTab !== 'ui3_ocr' || oneTimePopUsed) return;
    const timer = window.setInterval(() => {
      setTtlSecondsLeft((prev) => (prev > 1 ? prev - 1 : 60));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [windowTab, oneTimePopUsed]);

  useEffect(() => {
    if (windowTab !== 'ui2_summon' || !showRow0PhoneOcrDock) return;
    const timer = window.setInterval(() => {
      setPhoneOcrDockSeconds((prev) => (prev > 1 ? prev - 1 : 60));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [windowTab, showRow0PhoneOcrDock]);

  const activeOcrPreset: OcrSamplePreset = useMemo(() => {
    if (externalOcrPhoto) {
      return buildOcrPresetFromPhoto(externalOcrPhoto);
    }
    return OCR_PRESETS[ocrPresetIdx] || OCR_PRESETS[0];
  }, [externalOcrPhoto, ocrPresetIdx]);

  const filteredClipboardItems = useMemo(() => {
    const q = clipboardQuery.trim().toLowerCase();
    const matched = q
      ? SAMPLE_CLIPBOARD_30DAYS.filter(
          (c) =>
            c.content.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)
        )
      : SAMPLE_CLIPBOARD_30DAYS;
    return matched.slice(0, 5);
  }, [clipboardQuery]);

  const filteredMiniExplorerItems = useMemo(() => {
    const q = miniExplorerQuery.trim().toLowerCase();
    return MINI_EXPLORER_ITEMS.filter((item) => {
      if (miniMediaFilter !== 'all' && item.mediaType !== miniMediaFilter) {
        return false;
      }
      if (!q) return true;
      const hay = `${item.fileName} ${item.matchedValueShort} ${item.keywords.join(' ')}`.toLowerCase();
      return (
        hay.includes(q) ||
        q.split(/\s+/).some((tok) => tok.length >= 2 && hay.includes(tok))
      );
    });
  }, [miniExplorerQuery, miniMediaFilter]);

  const activeCandidate = useMemo(
    () =>
      filteredMiniExplorerItems.find((c) => c.id === hoveredCandidateId) ||
      filteredMiniExplorerItems[0] ||
      MINI_EXPLORER_ITEMS[0],
    [filteredMiniExplorerItems, hoveredCandidateId]
  );

  const handleSelectTier = (next: GhostWindowTierMode) => {
    setTierMode(next);
    onTierChange?.(next);
  };

  const insertIntoUi1Editor = (val: string, label: string) => {
    setUi1EditorText((prev) => `${prev}${prev.endsWith(' ') ? '' : ' '}${val}`);
    useSaySeeStore.setState({
      lastQuarantineToast: `👻 [${label}] 커서 위치에 입력되었습니다.`,
    });
  };

  const handleSummonReplace = (cand: SummonCandidateItem) => {
    const token = currentScenario.targetToken;
    if (cand.mediaType === 'photo' || cand.mediaType === 'video') {
      setAttachedFileBadge(
        `${cand.mediaType === 'photo' ? '🖼️ 사진 첨부됨' : '🎬 영상 장면 첨부됨'}: ${cand.fileName}`
      );
    }
    if (ui2EditorText.includes(token)) {
      setUi2EditorText(ui2EditorText.replace(token, cand.replaceSentence));
    } else {
      setUi2EditorText((prev) => `${prev} ${cand.replaceSentence}`);
    }
    setSummonReplacedNotice(`✨ [${cand.fileName}] 내용이 작업창에 바로 입력되었습니다.`);
    useSaySeeStore.setState({
      lastQuarantineToast: `👻 [${cand.fileName}] 작업창에 즉시 반영되었습니다!`,
    });
  };

  const handleClickLiveSpot = (spot: LiveTextOverlaySpot) => {
    setClickedSpotIds((prev) => (prev.includes(spot.id) ? prev : [...prev, spot.id]));
    setUi3CursorEditorText((prev) =>
      prev.endsWith(': ') || prev.length === 0 ? `${prev}${spot.insertValue}` : `${prev} / ${spot.insertValue}`
    );
    setOneTimePopUsed(true);
    setLastInsertedSpotNotice(`✅ "${spot.insertValue}" 복사 및 입력 완료`);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(spot.insertValue);
    }
  };

  return (
    <section
      aria-label="귀신창 3대 창 UI"
      className="w-full rounded-3xl bg-[#0B0D12] border border-white/10 p-4 sm:p-6 flex flex-col gap-5 text-zinc-100 shadow-xl"
    >
      {/* 1. 상단 심플 헤더 & 3대 창 UI 탭 스위치 */}
      <div className="flex flex-col gap-3.5 pb-4 border-b border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <GhostBabyMascotBadge subtitle="일하다 막힐 때 언제든 부르는 작업 도우미" />
          </div>

          {/* 우측: 환경 모드 스위치 + 체험 모달 버튼 */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'pc_free' as const, label: '💻 내 PC (무료)' },
                { id: 'phone_pc' as const, label: '📱 폰 + PC' },
                { id: 'work_team' as const, label: '💼 팀 공유 (S:)' },
              ]
            ).map((t) => {
              const active = tierMode === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleSelectTier(t.id)}
                  className={`px-3 py-1.5 rounded-xl font-label-sm text-[12px] font-extrabold transition-all cursor-pointer border ${
                    active
                      ? 'bg-teal-400 text-zinc-950 border-teal-300 shadow-xs'
                      : 'bg-zinc-900/90 text-zinc-300 border-white/10 hover:bg-zinc-800'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3대 귀신창 UI 선택 탭 (군더더기 설명 없이 깔끔한 3버튼) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {[
            {
              id: 'ui1_basic' as const,
              badge: '창 UI ①',
              title: '기본 귀신창',
              desc: '상용구(F1~F12) · 클립보드 · [1]~[5] 타이핑·복붙 다이어트',
            },
            {
              id: 'ui2_summon' as const,
              badge: '창 UI ②',
              title: '👻 귀신검색창',
              desc: '작업 중 문서 · 사진 · 영상 소환 ([📝OCR] 클릭 시 창 UI ③ 호출)',
            },
            {
              id: 'ui3_ocr' as const,
              badge: '창 UI ③',
              title: '사진·표 OCR 창',
              desc: '별도 독립 창 · 사진 위 글자·표를 톡톡 찍어 바로 입력',
            },
          ].map((tab) => {
            const active = windowTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setWindowTab(tab.id)}
                className={`p-3.5 rounded-2xl text-left flex flex-col gap-1 transition-all cursor-pointer border ${
                  active
                    ? 'bg-zinc-900 border-2 border-teal-400 shadow-[0_0_20px_rgba(20,184,166,0.18)]'
                    : 'bg-zinc-950/70 hover:bg-zinc-900/60 border-white/10'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[14px] font-black text-white">
                    {tab.title}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10.5px] font-black ${
                      active ? 'bg-teal-400 text-zinc-950' : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {tab.badge}
                  </span>
                </div>
                <span className="text-[12px] text-zinc-400 font-medium truncate">
                  {tab.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          [창 UI ①] 기본 귀신창 (슬림 2줄 + 상용구 F1~F12 + 클립보드)
         ════════════════════════════════════════════════════════════════════════ */}
      {windowTab === 'ui1_basic' && (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl bg-[#090B10] border-2 border-teal-400/70 shadow-lg overflow-hidden">
            {/* [1줄 차 헤더] 좌측 마스코트 + 우측 [상용구] [클립보드] */}
            <div className="px-4 py-2.5 bg-gradient-to-r from-zinc-900 via-[#101822] to-zinc-900 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <GhostBabyMascotBadge />
                <button
                  type="button"
                  onClick={() => setActivePromoModal('opt_in_30d')}
                  className="px-2 py-0.5 rounded-full bg-teal-400/20 hover:bg-teal-400/30 border border-teal-300/50 text-teal-200 font-mono text-[10.5px] font-black cursor-pointer"
                >
                  {trialOptInAccepted ? '🎁 무제한 체험 D-29' : '🔒 유료 티어 30일 무료체험'}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setOpenHeaderDrawer((prev) => (prev === 'snippets' ? 'none' : 'snippets'))
                  }
                  className={`px-3 py-1.5 rounded-xl font-label-sm text-[12px] font-black flex items-center gap-1.5 border transition-all cursor-pointer ${
                    openHeaderDrawer === 'snippets'
                      ? 'bg-teal-400 text-zinc-950 border-teal-300'
                      : 'bg-zinc-900 hover:bg-zinc-800 text-teal-200 border-teal-400/40'
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
                  className={`px-3 py-1.5 rounded-xl font-label-sm text-[12px] font-black flex items-center gap-1.5 border transition-all cursor-pointer ${
                    openHeaderDrawer === 'clipboard'
                      ? 'bg-amber-400 text-zinc-950 border-amber-300'
                      : 'bg-zinc-900 hover:bg-zinc-800 text-amber-200 border-amber-400/40'
                  }`}
                >
                  <span>📋 클립보드</span>
                  <span>{openHeaderDrawer === 'clipboard' ? '▴' : '▾'}</span>
                </button>
              </div>
            </div>

            {/* [1줄 & 2줄] 귀신창 [1]~[5] 정배열 다이어트 레이아웃 + 우측 [⌨️상용구▾] [💡꿀팁·기타▾] */}
            <div className="px-4 py-2.5 bg-zinc-950/95 border-b border-white/10 flex flex-col gap-2">
              {/* 1줄 (하늘색 #5EEAD4 — 평생 무료 기본기 + [2] 스샷·PDF변환🔒) */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    {
                      id: 0,
                      label: '[Ctrl+V] 순차붙여넣기',
                      sampleOut: '[1번: 홍길동] ➔ [2번: 010-1234-5678] ➔ [3번: 강남구 테헤란로 123]',
                    },
                    {
                      id: 1,
                      label: '[1] 🧹서식·줄바꿈 다림질',
                      sampleOut: '[🧹 서식·줄바꿈 다림질 완료] 평소 복붙은 원문 100% 보존 · [1]키로 끊어진 줄바꿈·광고 꼬리말 1초 순수 본문 정리 완료',
                    },
                    {
                      id: 2,
                      label: '[2] 📄스샷·PDF변환🔒',
                      sampleOut: '[📄 스샷·PDF 변환 완료] 클립보드 화면 캡처 이미지를 실물 PNG 및 300DPI 다중 스샷 합본 PDF로 즉시 변환 완료',
                    },
                  ].map((ab) => {
                    const active = activeWave1Ability === ab.id;
                    return (
                      <button
                        key={ab.id}
                        type="button"
                        onClick={() => {
                          setActiveWave1Ability(ab.id);
                          insertIntoUi1Editor(ab.sampleOut, ab.label);
                        }}
                        className={`px-2.5 py-1.5 rounded-xl text-[12px] font-extrabold border transition-all cursor-pointer ${
                          active
                            ? 'bg-[#5EEAD4]/25 border-[#5EEAD4] text-[#5EEAD4]'
                            : 'bg-zinc-900/90 hover:bg-zinc-800 border-[#5EEAD4]/35 text-[#5EEAD4]'
                        }`}
                      >
                        {ab.label}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setMiniExplorerQuery('사업자등록증');
                    setWindowTab('ui2_summon');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-teal-500/15 hover:bg-teal-400 text-teal-200 hover:text-zinc-950 border border-teal-400/40 text-[11.5px] font-black transition-all cursor-pointer"
                >
                  🔍 귀신검색창 소환 ➔
                </button>
              </div>

              {/* 2줄 (흰색 #E2E8F0 — [3]~[5] 유료 티어 정배열 + 우측 끝 [⌨️상용구▾] · [💡꿀팁·기타▾]) */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/5">
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    {
                      id: 3,
                      label: '[3] 🔗다중합본🔒',
                      sampleOut: '[다중 복사 합본] 1. 계약 개요 / 2. 단가 조건 / 3. 특약 사항 통짜 병합 완료',
                    },
                    {
                      id: 4,
                      label: '[4] 🔢번호·일정🔒',
                      sampleOut: '성함: 김철수 / 연락처: 010-1234-5678 / 계좌: 국민 012-3456-7890-11',
                    },
                    {
                      id: 5,
                      label: '[5] 📌창고정🔒',
                      sampleOut: '📌 현재 활성 작업창이 화면 최상단(Always on Top)에 고정되었습니다.',
                    },
                  ].map((ab) => {
                    const active = activeWave1Ability === ab.id;
                    return (
                      <button
                        key={ab.id}
                        type="button"
                        onClick={() => {
                          setActiveWave1Ability(ab.id);
                          insertIntoUi1Editor(ab.sampleOut, ab.label);
                        }}
                        className={`px-2.5 py-1.5 rounded-xl text-[12px] font-extrabold border transition-all cursor-pointer ${
                          active
                            ? 'bg-white/20 border-white text-white'
                            : 'bg-zinc-900/90 hover:bg-zinc-800 border-white/15 text-[#E2E8F0]'
                        }`}
                      >
                        {ab.label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenHeaderDrawer((prev) => (prev === 'snippets' ? 'none' : 'snippets'))
                    }
                    className={`px-2.5 py-1.5 rounded-xl text-[12px] font-black border transition-all cursor-pointer ${
                      openHeaderDrawer === 'snippets'
                        ? 'bg-amber-400 text-zinc-950 border-amber-300'
                        : 'bg-zinc-900 hover:bg-zinc-800 text-amber-200 border-amber-400/40'
                    }`}
                  >
                    [⌨️상용구▾]
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setOpenHeaderDrawer((prev) => (prev === 'tips' ? 'none' : 'tips'))
                    }
                    className={`px-2.5 py-1.5 rounded-xl text-[12px] font-black border transition-all cursor-pointer ${
                      openHeaderDrawer === 'tips'
                        ? 'bg-teal-400 text-zinc-950 border-teal-300'
                        : 'bg-zinc-900 hover:bg-zinc-800 text-teal-200 border-teal-400/40'
                    }`}
                  >
                    [💡꿀팁·기타▾]
                  </button>
                </div>
              </div>
            </div>

            {/* [펼침 0] 기타 · 보너스 초능력 & 숨은 자동 초능력 ([💡꿀팁·기타▾]) */}
            {openHeaderDrawer === 'tips' && (
              <div className="p-4 bg-[#0D1119] border-b border-white/10 flex flex-col gap-2">
                <div className="text-[12.5px] font-black text-teal-300">
                  💡 [💡꿀팁·기타▾] 보너스 초능력 &amp; 무버튼 자동 초능력
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[12px] text-zinc-200">
                  <div className="p-2.5 rounded-xl bg-teal-950/40 border border-teal-400/40 sm:col-span-2 font-bold text-teal-200">
                    📦 우클릭 1초 스마트 ZIP 압축 풀기·묶기 (평생 무료 · 알집 대체 · 맥 한글깨짐 NFD➔NFC 자동 복원 · 압축폭탄 방지)
                  </div>
                  <div className="p-2.5 rounded-xl bg-zinc-950 border border-white/10">① 스페이스바 자동 한영·띄어쓰기 성형 (5초 내 Ctrl+0 / Ctrl+Z 원복 · 평생 무료)</div>
                  <div className="p-2.5 rounded-xl bg-zinc-950 border border-white/10">② 엑셀 다중 칸 자동 쪼개기 ([Ctrl+V] 순차붙여넣기 · 평생 무료)</div>
                  <div className="p-2.5 rounded-xl bg-zinc-950 border border-white/10">③ 다중 스샷 300DPI PDF 합본 ([2] 📄스샷·PDF변환🔒)</div>
                  <div className="p-2.5 rounded-xl bg-zinc-950 border border-white/10">④ 📱 0.2초 공간이동 (촬영 후 1분간 자동팝업 대기)🔒</div>
                </div>
              </div>
            )}

            {/* [펼침 1] 상용구 (F1~F12) */}
            {openHeaderDrawer === 'snippets' && (
              <div className="p-4 bg-[#0D1119] border-b border-white/10 flex flex-col gap-3">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                  {/* 왼쪽 6칸: F1 ~ F6 개인 상용구 */}
                  <div className="p-3 rounded-2xl bg-zinc-950/90 border border-teal-500/35 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-black text-teal-300">
                        💻 F1 ~ F6 내 개인 상용구
                      </span>
                      <span className="text-[10.5px] text-zinc-400 font-bold">
                        클릭 시 바로 입력
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
                                편집
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
                        💼 F7 ~ F12 팀 공유 상용구
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-400/15 text-amber-200 text-[10px] font-extrabold">
                        팀원 전체 동기화
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
                                편집
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
                      [{editingSlot}] 수정:
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
                      저장
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

            {/* [펼침 2] 클립보드 (최근 5개 + 30일 검색) */}
            {openHeaderDrawer === 'clipboard' && (
              <div className="p-4 bg-[#0D1119] border-b border-white/10 flex flex-col gap-3">
                <div className="w-full max-w-[460px] mx-auto p-3.5 rounded-2xl bg-zinc-950 border-2 border-amber-400/60 shadow-2xl flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-black text-amber-300">
                      📋 최근 복사 내역 (30일 검색)
                    </span>
                    <span className="text-[10.5px] text-zinc-400 font-bold">
                      클릭 시 즉시 붙여넣기
                    </span>
                  </div>

                  <input
                    type="text"
                    value={clipboardQuery}
                    onChange={(e) => setClipboardQuery(e.target.value)}
                    placeholder="🔍 복사 내역 검색 (예: 계좌, 홈택스, 단가...)"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/15 text-white text-[12px] font-bold outline-none focus:border-amber-400"
                  />

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
                          입력 ↵
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 하단 작업창 입력 확인 */}
            <div className="p-3.5 bg-zinc-950 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] font-extrabold text-zinc-400">
                  💬 내 작업 입력창 (위 버튼을 누르면 커서 위치에 바로 입력됩니다)
                </span>
                <button
                  type="button"
                  onClick={() => setUi1EditorText('')}
                  className="text-[11px] text-zinc-400 hover:text-white cursor-pointer"
                >
                  비우기
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
          [창 UI ②] 귀신 미니 탐색기 (현장 문서·사진·영상 소환)
         ════════════════════════════════════════════════════════════════════════ */}
      {windowTab === 'ui2_summon' && (
        <div className="p-4 sm:p-5 rounded-3xl bg-[#111318] border-2 border-teal-400/50 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[15px] font-black text-white">
              👻 귀신 미니 탐색기
            </span>

            <div className="flex flex-wrap items-center gap-1.5">
              {SUMMON_SCENARIOS.map((scen, idx) => (
                <button
                  key={scen.id}
                  type="button"
                  onClick={() => setScenarioIdx(idx)}
                  className={`px-3 py-1 rounded-xl text-[11.5px] font-extrabold border cursor-pointer transition-all ${
                    scenarioIdx === idx
                      ? 'bg-teal-400 text-zinc-950 border-teal-300'
                      : 'bg-zinc-900 text-zinc-300 border-white/15 hover:bg-zinc-800'
                  }`}
                >
                  {scen.shortLabel}
                </button>
              ))}
            </div>
          </div>

          {/* 1) 현재 작성 중인 작업창 */}
          <div className="p-3.5 rounded-2xl bg-zinc-950 border border-white/15 flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[12px] font-extrabold text-zinc-300">
                💬 작업 중인 창 ({currentScenario.windowContextTitle})
              </span>
              <button
                type="button"
                onClick={() => {
                  setUi2EditorText(currentScenario.initialEditorText);
                  setAttachedFileBadge(null);
                  setSummonReplacedNotice(null);
                }}
                className="text-[11px] text-zinc-400 hover:text-white cursor-pointer"
              >
                ↺ 초기화
              </button>
            </div>

            <input
              type="text"
              value={ui2EditorText}
              onChange={(e) => setUi2EditorText(e.target.value)}
              placeholder="여기에 찾은 문서 수치나 사진이 바로 들어갑니다..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-teal-400/50 text-white text-[13.5px] font-extrabold outline-none"
            />

            {(summonReplacedNotice || attachedFileBadge) && (
              <div className="flex flex-wrap items-center gap-2">
                {summonReplacedNotice && (
                  <span className="text-[12px] text-emerald-300 font-extrabold">
                    {summonReplacedNotice}
                  </span>
                )}
                {attachedFileBadge && (
                  <span className="px-2.5 py-0.5 rounded-lg bg-amber-400/20 border border-amber-300/50 text-amber-200 text-[11.5px] font-black">
                    {attachedFileBadge}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* 2) 미니 탐색기 본체 */}
          <div className="rounded-2xl bg-[#090B10] border-2 border-teal-400/60 overflow-hidden flex flex-col">
            {/* 상단 검색창 + 분류 탭 */}
            <div className="p-3 bg-zinc-900/95 border-b border-white/10 flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex-1 min-w-[220px] flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-950 border border-teal-400/60">
                  <span className="text-teal-300 text-[13px]">🔍</span>
                  <input
                    type="text"
                    value={miniExplorerQuery}
                    onChange={(e) => setMiniExplorerQuery(e.target.value)}
                    placeholder="찾을 단어 입력 (예: 계약서, 사업자등록증, 제주도, 시공...)"
                    className="w-full bg-transparent text-white text-[12.5px] font-extrabold outline-none"
                  />
                  {miniExplorerQuery && (
                    <button
                      type="button"
                      onClick={() => setMiniExplorerQuery('')}
                      className="text-[11px] text-zinc-400 hover:text-white cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {(
                    [
                      { id: 'all' as const, label: '전체' },
                      { id: 'doc' as const, label: '📄 문서' },
                      { id: 'photo' as const, label: '🖼️ 사진' },
                      { id: 'video' as const, label: '🎬 영상' },
                    ]
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setMiniMediaFilter(tab.id)}
                      className={`px-2.5 py-1.5 rounded-xl text-[11.5px] font-black border cursor-pointer transition-all ${
                        miniMediaFilter === tab.id
                          ? 'bg-teal-400 text-zinc-950 border-teal-300'
                          : 'bg-zinc-950 text-zinc-300 border-white/10 hover:bg-zinc-800'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 방금 찍은 폰 사진 1줄 바 */}
              {showRow0PhoneOcrDock && (
                <div className="px-3 py-2 rounded-xl bg-teal-950/50 border border-teal-400/40 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded bg-teal-400 text-zinc-950 font-mono text-[10.5px] font-black">
                      📱 방금 찍은 폰 사진 ({phoneOcrDockSeconds}초)
                    </span>
                    {ROW0_PHONE_OCR_DOCK_CHIPS.map((chip) => (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => {
                          setUi2EditorText((prev) =>
                            prev ? `${prev} ${chip.value}` : chip.value
                          );
                          setSummonReplacedNotice(`⚡ [${chip.label}] 바로 입력됨`);
                        }}
                        className="px-2 py-0.5 rounded-lg bg-zinc-900 hover:bg-teal-400 text-teal-200 hover:text-zinc-950 border border-teal-400/40 text-[11px] font-extrabold transition-colors cursor-pointer"
                      >
                        {chip.label} ↵
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setWindowTab('ui3_ocr')}
                    className="text-[11px] text-amber-300 hover:underline font-extrabold cursor-pointer"
                  >
                    사진 위에서 직접 찍기 ➔
                  </button>
                </div>
              )}
            </div>

            {/* 좌측 검색 결과 리스트 + 우측 미리보기 */}
            <div className="grid grid-cols-1 lg:grid-cols-12">
              <div className="lg:col-span-6 p-3 border-b lg:border-b-0 lg:border-r border-white/10 flex flex-col gap-2">
                {filteredMiniExplorerItems.map((cand, idx) => {
                  const isHovered = activeCandidate.id === cand.id;
                  const typeIcon =
                    cand.mediaType === 'doc'
                      ? '📄'
                      : cand.mediaType === 'photo'
                      ? '🖼️'
                      : '🎬';
                  return (
                    <div
                      key={cand.id}
                      onMouseEnter={() => setHoveredCandidateId(cand.id)}
                      onClick={() => setHoveredCandidateId(cand.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                        isHovered
                          ? 'bg-teal-500/15 border-teal-400'
                          : 'bg-zinc-900/90 hover:bg-zinc-800 border-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="px-1.5 py-0.5 rounded bg-teal-400 text-zinc-950 font-mono text-[10px] font-black shrink-0">
                            {idx + 1}
                          </span>
                          <span className="text-[12.5px] font-extrabold text-white truncate">
                            {typeIcon} {cand.fileName}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-black shrink-0 bg-zinc-800 text-zinc-300">
                          {cand.sourceBadge}
                        </span>
                      </div>

                      <div className="text-[12px] text-amber-200 font-bold truncate">
                        {cand.matchedValueShort}
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-1.5 pt-1 border-t border-white/10">
                        {cand.mediaType === 'photo' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOcrPresetIdx(0);
                              setWindowTab('ui3_ocr');
                            }}
                            className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-amber-400 text-amber-200 hover:text-zinc-950 text-[10.5px] font-black transition-colors cursor-pointer"
                          >
                            📝 글자 따기
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSummonReplace(cand);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-teal-400 hover:bg-teal-300 text-zinc-950 text-[11px] font-black cursor-pointer"
                        >
                          {cand.mediaType === 'doc'
                            ? '핵심값 넣기 ↵'
                            : cand.mediaType === 'photo'
                            ? '사진 첨부 ↵'
                            : '장면 넣기 ↵'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 우측: 호버 미리보기 */}
              <div className="lg:col-span-6 p-4 bg-[#07090E] flex flex-col justify-between gap-3">
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
                    <span className="text-[12.5px] font-black text-teal-300 truncate">
                      {activeCandidate.ghostPreviewTitle}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-zinc-900 border border-white/10 text-[10px] text-zinc-400 font-mono shrink-0">
                      열지 않고 바로보기
                    </span>
                  </div>

                  {(activeCandidate.mediaType === 'photo' ||
                    activeCandidate.mediaType === 'video') &&
                    activeCandidate.thumbUrl && (
                      <div className="relative h-36 rounded-xl overflow-hidden bg-zinc-950 border border-white/15">
                        <img
                          src={activeCandidate.thumbUrl}
                          alt={activeCandidate.fileName}
                          className="w-full h-full object-cover"
                        />
                        {activeCandidate.videoTimestamp && (
                          <div className="absolute inset-0 bg-black/35 flex items-center justify-center">
                            <span className="px-3 py-1.5 rounded-full bg-amber-400 text-zinc-950 font-mono text-[12px] font-black shadow-lg">
                              ▶ {activeCandidate.videoTimestamp} 핵심장면
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                  <div className="p-3 rounded-xl bg-zinc-900/90 border border-white/10 flex flex-col gap-1.5 font-mono text-[11.5px]">
                    {activeCandidate.ghostPreviewLines.map((line, i) => {
                      const isTargetRow = i === activeCandidate.highlightRowIndex;
                      return (
                        <div
                          key={i}
                          className={`p-1.5 rounded-lg transition-all ${
                            isTargetRow
                              ? 'bg-amber-400/20 border border-amber-300 text-amber-200 font-black'
                              : 'text-zinc-400'
                          }`}
                        >
                          {line}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
                  <span className="text-[11px] text-zinc-400 truncate">
                    📁 {activeCandidate.folderPath}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSummonReplace(activeCandidate)}
                    className="px-3.5 py-1.5 rounded-xl bg-teal-400 hover:bg-teal-300 text-zinc-950 text-[11.5px] font-black cursor-pointer shrink-0"
                  >
                    작업창에 바로 넣기 ↵
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          [창 UI ③] 사진·스샷 글자 톡톡 찍기 (Live Text)
         ════════════════════════════════════════════════════════════════════════ */}
      {windowTab === 'ui3_ocr' && (
        <div className="p-4 sm:p-5 rounded-3xl bg-[#111318] border-2 border-amber-400/50 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-black text-white">
                📸 사진 위 글자 톡톡 찍기
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[11px] font-extrabold">
                ⏱️ {ttlSecondsLeft}초 남음
              </span>
            </div>

            {!externalOcrPhoto && (
              <div className="flex items-center gap-1.5">
                {OCR_PRESETS.map((preset, idx) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setOcrPresetIdx(idx);
                      setClickedSpotIds([]);
                    }}
                    className={`px-3 py-1 rounded-xl text-[11.5px] font-extrabold border cursor-pointer transition-all ${
                      ocrPresetIdx === idx
                        ? 'bg-amber-400 text-zinc-950 border-amber-300'
                        : 'bg-zinc-900 text-zinc-300 border-white/15 hover:bg-zinc-800'
                    }`}
                  >
                    {idx === 0 ? '🧾 영수증 예시' : '📑 계약서 예시'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 원본 화면 위 글자 톡톡 찍기 캔버스 */}
          <div className="rounded-2xl bg-[#090B10] border-2 border-teal-400/60 overflow-hidden flex flex-col">
            {/* 상단 액션 바 */}
            <div className="px-4 py-2.5 bg-zinc-900 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[12.5px] font-extrabold text-zinc-200">
                원하는 글자를 누르면 작업창 커서에 바로 들어갑니다
              </span>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setOneTimePopUsed(true);
                    setUi3CursorEditorText((prev) => `${prev} [사진 원본 첨부됨]`);
                    setLastInsertedSpotNotice('🖼️ 사진 원본이 클립보드에 복사되었습니다.');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-teal-400 hover:bg-teal-300 text-zinc-950 text-[11px] font-black cursor-pointer"
                >
                  🖼️ 사진 원본 넣기
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOneTimePopUsed(true);
                    setUi3CursorEditorText(activeOcrPreset.tsvTableText.replace(/\n/g, ' | '));
                    setLastInsertedSpotNotice('📊 표 전체가 엑셀 규격으로 복사되었습니다.');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 text-[11px] font-black cursor-pointer"
                >
                  📊 표 엑셀 복사
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOneTimePopUsed(true);
                    setUi3CursorEditorText(activeOcrPreset.fullText);
                    setLastInsertedSpotNotice('📋 전체 문장이 복사되었습니다.');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-white/15 text-zinc-200 text-[11px] font-extrabold cursor-pointer"
                >
                  📋 전체 복사
                </button>
              </div>
            </div>

            {/* 중앙: 원본 문서/사진 캔버스 */}
            <div className="relative min-h-[340px] sm:min-h-[370px] w-full bg-zinc-950 overflow-hidden p-4 flex flex-col justify-between">
              <img
                src={activeOcrPreset.thumbUrl}
                alt={activeOcrPreset.title}
                className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/80 via-zinc-950/65 to-zinc-950/90 pointer-events-none" />

              <div className="relative z-10 w-full max-w-3xl mx-auto my-auto rounded-2xl bg-[#12161F]/90 border border-white/20 p-4 sm:p-5 shadow-2xl flex flex-col gap-2">
                {activeOcrPreset.liveTextSpots.map((spot) => {
                  const wasClicked = clickedSpotIds.includes(spot.id);
                  return (
                    <button
                      key={spot.id}
                      type="button"
                      onClick={() => handleClickLiveSpot(spot)}
                      className={`group w-full text-left px-3.5 py-2 rounded-xl border transition-all cursor-pointer flex flex-wrap items-center justify-between gap-2 ${
                        wasClicked
                          ? 'bg-emerald-500/25 border-2 border-emerald-400 text-white'
                          : spot.isPrimaryHighlight
                          ? 'bg-amber-400/15 hover:bg-amber-400/25 border border-amber-300/60 text-amber-100'
                          : 'bg-zinc-900/90 hover:bg-zinc-800 border border-white/15 text-zinc-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-black shrink-0 ${
                            wasClicked
                              ? 'bg-emerald-400 text-zinc-950'
                              : spot.isPrimaryHighlight
                              ? 'bg-amber-400 text-zinc-950'
                              : 'bg-zinc-800 text-zinc-300'
                          }`}
                        >
                          {wasClicked ? '✓ 입력됨' : spot.categoryHint}
                        </span>
                        <span className="font-mono text-[12.5px] font-extrabold tracking-tight truncate">
                          {spot.displayText}
                        </span>
                      </div>

                      <span className="px-2 py-0.5 rounded-lg bg-teal-400/20 group-hover:bg-teal-400 text-teal-200 group-hover:text-zinc-950 text-[10.5px] font-black shrink-0 transition-colors">
                        톡 찍어 넣기 ↵
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 하단: 실시간 커서 입력 확인창 */}
            <div className="p-3.5 bg-zinc-950 border-t border-white/10 flex flex-col gap-2">
              {lastInsertedSpotNotice && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] font-extrabold text-emerald-300">
                  <span>{lastInsertedSpotNotice}</span>
                  <button
                    type="button"
                    onClick={() => setWindowTab('ui1_basic')}
                    className="text-[11px] text-amber-300 hover:underline cursor-pointer"
                  >
                    기본 귀신창으로 돌아가기 ➔
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between gap-2">
                <span className="text-[11.5px] font-extrabold text-zinc-400">
                  💬 내 작업 현장 커서
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setUi3CursorEditorText('');
                    setClickedSpotIds([]);
                  }}
                  className="text-[11px] text-zinc-400 hover:text-white cursor-pointer"
                >
                  비우기
                </button>
              </div>

              <input
                type="text"
                value={ui3CursorEditorText}
                onChange={(e) => setUi3CursorEditorText(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-teal-400/60 text-white text-[13px] font-extrabold outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          [하단 확장 유틸리티 토글] 기본은 1줄로 접어두고 관심 있을 때 클릭해 펼침
         ════════════════════════════════════════════════════════════════════════ */}
      <div className="rounded-2xl bg-zinc-950/90 border border-white/10 overflow-hidden">
        <div
          onClick={() => setShowAdvancedUtils((v) => !v)}
          className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 cursor-pointer hover:bg-zinc-900/60 transition-colors select-none"
        >
          <div className="flex flex-wrap items-center gap-2 text-[12.5px] font-extrabold text-zinc-200">
            <span className="text-teal-300">{showAdvancedUtils ? '▾' : '▸'}</span>
            <span>🏷️ 자동 파일명 정리(귀신 라벨러) · 💬 탐색기 3줄 요약 미리보기</span>
          </div>
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setActivePromoModal('training_dojo')}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-[11px] font-bold text-teal-200 cursor-pointer"
            >
              🎮 60초 수련장
            </button>
            <button
              type="button"
              onClick={() => setActivePromoModal('loss_aversion_3limit')}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-[11px] font-bold text-amber-200 cursor-pointer"
            >
              📊 절약 리포트
            </button>
            <button
              type="button"
              onClick={() => setShowAdvancedUtils((v) => !v)}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-[11px] font-bold text-zinc-300 cursor-pointer"
            >
              {showAdvancedUtils ? '접기 ▴' : '펼치기 ▾'}
            </button>
          </div>
        </div>

        {showAdvancedUtils && (
          <div className="p-4 border-t border-white/10 grid grid-cols-1 lg:grid-cols-2 gap-3.5">
            {/* 카드 1: 🏷️ 귀신 라벨러 */}
            <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-white/10 flex flex-col justify-between gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12.5px] font-black text-teal-300">
                  🏷️ 귀신 라벨러🔒 — 👻 귀신검색창 유료 티어 소속 (사진·카톡·문서 날짜별 파일명 자동 정리)
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setLabelerScopeMode('personal')}
                    className={`px-2 py-0.5 rounded text-[10.5px] font-extrabold cursor-pointer ${
                      labelerScopeMode === 'personal'
                        ? 'bg-teal-400 text-zinc-950'
                        : 'bg-zinc-950 text-zinc-400'
                    }`}
                  >
                    개인
                  </button>
                  <button
                    type="button"
                    onClick={() => setLabelerScopeMode('work_s')}
                    className={`px-2 py-0.5 rounded text-[10.5px] font-extrabold cursor-pointer ${
                      labelerScopeMode === 'work_s'
                        ? 'bg-amber-400 text-zinc-950'
                        : 'bg-zinc-950 text-zinc-400'
                    }`}
                  >
                    팀 S:
                  </button>
                </div>
              </div>

              <div className="px-3 py-2 rounded-lg bg-teal-500/10 border border-teal-400/30 text-[11.5px] text-zinc-200 leading-relaxed">
                <div className="font-extrabold text-teal-200">
                  💡 어떻게 쓰나요? ➔ 『👻 귀신검색창』에서 사진·카톡사진·문서를 선택 후 <span className="underline text-amber-300">[🏷️ 귀신 라벨러🔒]</span> 클릭!
                </div>
                <div className="text-[11px] text-zinc-300 mt-0.5">
                  • 직접 찍은 사진: <b>YYMMDD_장소/내용</b> | 카톡 수신 사진: <b>YYMMDD_카톡_내용</b> | 일반 문서: <b>YYMMDD_내용_제목</b>
                  <br />• 🛡️ <b>전화번호·금액 오인 방지</b>: 문서 안에 <code>010-2026-1234</code>나 <code>145,000원</code>이 있어도 가짜 날짜로 착각하지 않고 진짜 날짜만 찾아냅니다.
                </div>
              </div>

              <div className="flex flex-col gap-1.5 font-mono text-[11.5px]">
                <div className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-white/5 flex items-center justify-between gap-2">
                  <span className="text-zinc-400 truncate">IMG_4829.jpg</span>
                  <span className="text-teal-300 font-bold truncate">
                    ➔ {labelerScopeMode === 'personal' ? '261107_제주애월_가족산책.jpg' : '261107_김대리_역삼동_욕실타일.jpg'}
                  </span>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-white/5 flex items-center justify-between gap-2">
                  <span className="text-zinc-400 truncate">KakaoTalk_2026...jpg</span>
                  <span className="text-amber-200 font-bold truncate">
                    ➔ {labelerScopeMode === 'personal' ? '261106_카톡_할머니생신.jpg' : '261106_김대리_카톡_사업자등록증.jpg'}
                  </span>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-white/5 flex items-center justify-between gap-2">
                  <span className="text-zinc-400 truncate">스캔_001.pdf</span>
                  <span className="text-emerald-300 font-bold truncate">
                    ➔ {labelerScopeMode === 'personal' ? '250315_내용_임대차계약서.pdf' : '261105_김대리_내용_영수증_145,000원.pdf'}
                  </span>
                </div>
              </div>
            </div>

            {/* 카드 2: 💬 귀신 말풍선 */}
            <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-white/10 flex flex-col justify-between gap-2.5">
              <span className="text-[12.5px] font-black text-amber-300">
                💬 탐색기 마우스 오버 3줄 요약
              </span>

              <div className="p-3 rounded-xl bg-[#141821] border border-amber-300/40 text-[11.5px] font-mono flex flex-col gap-1">
                <div className="text-amber-200 font-sans font-extrabold">
                  👻 250315_내용_임대차계약서_역삼빌딩.pdf
                </div>
                <div className="text-zinc-200">
                  • 보증금 5,000만 원 / 월세 320만 원 · 만기 2028.11.14
                  <br />• 특약: 퇴실 시 기본 칸막이 원상복구 면제
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 조건부 팝업 모달들 (클릭 시에만 깔끔하게 표시) */}
      {activePromoModal === 'opt_in_30d' && (
        <div className="p-4 rounded-2xl bg-zinc-900 border-2 border-teal-400 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-black text-teal-300">
              🎁 모든 🔒 유료 티어 초능력 30일 무제한 무료체험 (Opt-in)
            </span>
            <button
              type="button"
              onClick={() => setActivePromoModal('none')}
              className="text-zinc-400 hover:text-white text-[12px] font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
          <p className="text-[12.5px] text-zinc-200">
            매일 쓰는 기본기(내 PC 검색 · 귀신비서 · 자동 한영·띄어쓰기 · Ctrl+V 순차붙여넣기 · [1] 서식·줄바꿈 · F1~F6 · ZIP 압축)는 언제나 평생 무료입니다. 🔒 유료 티어 기능은 동의 시 카드 등록·자동 결제 없이 30일간 무제한 무료체험 후 일 3회 무료 없이 깔끔하게 잠기며, 체험 중 내 PC 로컬 폴더에 복사된 사진·파일은 영구 보존됩니다.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setTrialOptInAccepted(true);
                setActivePromoModal('none');
                playExistingGhostSound('success');
              }}
              className="px-4 py-2 rounded-xl bg-teal-400 text-zinc-950 text-[12px] font-black cursor-pointer"
            >
              🚀 30일 무제한 체험 시작하기
            </button>
            <button
              type="button"
              onClick={() => {
                setTrialOptInAccepted(false);
                setActivePromoModal('none');
              }}
              className="px-3 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-[12px] font-bold cursor-pointer"
            >
              평생 무료 기본기부터 쓰기
            </button>
          </div>
        </div>
      )}

      {activePromoModal === 'loss_aversion_3limit' && (
        <div className="p-4 rounded-2xl bg-zinc-900 border-2 border-amber-400 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-black text-amber-300">
              📊 내 귀신초능력 시간 절약 리포트 &amp; 30일 체험 만료 안내
            </span>
            <button
              type="button"
              onClick={() => setActivePromoModal('none')}
              className="text-zinc-400 hover:text-white text-[12px] font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
          <p className="text-[12.5px] text-zinc-200">
            지금까지 총 <strong className="text-amber-300">412번</strong>의 복붙을 줄여 약{' '}
            <strong className="text-teal-300">6시간 50분</strong>을 아끼셨습니다! 30일 무료체험 만료 후에는 평생 무료 기본기만 유지되고 🔒 유료 기능은 잠기며, 이미 내 PC 로컬 폴더에 복사된 원본 파일은 그대로 보존됩니다.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setActivePromoModal('none');
                playExistingGhostSound('success');
              }}
              className="px-4 py-2 rounded-xl bg-amber-400 text-zinc-950 text-[12px] font-black cursor-pointer"
            >
              ☕ 월 3,900원 (10년 특판 3.9만) 전 기능 무제한 풀기
            </button>
            <button
              type="button"
              onClick={() => setActivePromoModal('none')}
              className="px-3 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-[12px] font-bold cursor-pointer"
            >
              평생 무료 기본기 계속 쓰기
            </button>
          </div>
        </div>
      )}

      {activePromoModal === 'training_dojo' && (
        <div className="p-4 rounded-2xl bg-zinc-900 border-2 border-teal-400 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-black text-teal-300">
              🎮 60초 애기귀신 소환 수련장
            </span>
            <button
              type="button"
              onClick={() => setActivePromoModal('none')}
              className="text-zinc-400 hover:text-white text-[12px] font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { step: 1 as const, label: '1단계: 우클릭 꾹 소환' },
              { step: 2 as const, label: '2단계: 1·2·3 연속 붙여넣기' },
              { step: 3 as const, label: '3단계: 문서 숫자 바로 소환' },
            ].map((st) => (
              <button
                key={st.step}
                type="button"
                onClick={() => {
                  setTrainingStage(st.step);
                  playExistingGhostSound(st.step === 1 ? 'summon' : 'success');
                }}
                className={`px-3 py-1.5 rounded-xl text-[11.5px] font-black cursor-pointer ${
                  trainingStage === st.step
                    ? 'bg-teal-400 text-zinc-950'
                    : 'bg-zinc-950 text-zinc-300 border border-white/10'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
          <p className="text-[12px] text-zinc-200">
            {trainingStage === 1 && '마우스 우클릭을 0.35초 지그시 누르면 효과음과 함께 귀신창이 열립니다.'}
            {trainingStage === 2 && '여러 줄을 차례대로 복사한 뒤 순서대로 톡톡 붙여넣습니다.'}
            {trainingStage === 3 && '문장 끝에 ?를 치고 우클릭 꾹을 누르면 계약서·단가표 숫자가 바로 들어갑니다.'}
          </p>
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
            <GhostBabyMascotBadge subtitle="📝 사진·표 OCR 창 (창 UI ③ 별도 독립 창 · 글자·단어칩 톡톡 찍기)" />
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
