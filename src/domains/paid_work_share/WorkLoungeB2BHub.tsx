import React, { useEffect, useState } from 'react';
import {
  buildWindowsNativeWebDavMountCommand,
  verifyHybridP2PBridgeConnection,
  type P2PHybridConnectionDiagnostics,
} from '../../services/p2pHybridBridge';
import { useSaySeeStore } from '../../store/useSaySeeStore';
import { zCoreBridge } from '../../services/zCoreBridge';
import { HostThreeBodyControlPanel, PLAN_BADGE_LABELS } from '../shared/loungeHelpers';

interface WorkLoungeDocItem {
  id: string;
  folderId: string;
  folderPath: string;
  fileName: string;
  ext: string;
  sizeLabel: string;
  updatedAt: string;
  author: string;
  lockedBy: string | null;
  cacheSizeLabel: string;
  summaryTitle: string;
  matchedSnippet: string;
  tableHeaders: string[];
  tableRows: string[][];
  fullTextPreview: string;
  isImage?: boolean;
  imageBase64?: string;
}

const WORK_LOUNGE_FOLDERS = [
  { id: 'all', name: 'S:\\ (업무 드라이브 전체)', count: 6, path: 'S:\\' },
  { id: 'root', name: 'S:\\ 루트 (최상단 파일)', count: 1, path: 'S:\\' },
  { id: 'contracts', name: '01_계약서_법무문서', count: 2, path: 'S:\\01_계약서_법무문서' },
  { id: 'quotes', name: '02_견적서_단가표_엑셀', count: 2, path: 'S:\\02_견적서_단가표_엑셀' },
  { id: 'tax', name: '03_세금계산서_회계증빙', count: 1, path: 'S:\\03_세금계산서_회계증빙' },
  { id: 'site', name: '04_현장시공_도면_미디어', count: 1, path: 'S:\\04_현장시공_도면_미디어' },
];

const INITIAL_WORK_DOCS: WorkLoungeDocItem[] = [
  {
    id: 'work-doc-1',
    folderId: 'quotes',
    folderPath: 'S:\\02_견적서_단가표_엑셀',
    fileName: '2026_상반기_을지로현장_실내건축_표준단가표_v4.xlsx',
    ext: 'XLSX',
    sizeLabel: '4.8 MB',
    updatedAt: '방금 전 (14:22)',
    author: '박과장 (공무팀)',
    lockedBy: '박과장',
    cacheSizeLabel: '29.4 KB 선행 캐싱됨',
    summaryTitle: '[엑셀 시트 1~3 통합 내용 요약] 을지로 오피스 리모델링 철거·목공·전기 공정별 일위대가 및 협력사 네고 단가표',
    matchedSnippet:
      '표(Sheet2_철거단가) C14셀: "야간 방음 가설벽 설치 및 폐기물 반출 일식 — 단가 4,850,000원 (부자재 포함, 안전관리비 8% 별도)"',
    tableHeaders: ['공종 코드', '세부 내역 (규격)', '단위', '2026 표준 단가', '비고 / 협력사'],
    tableRows: [
      ['DEM-101', '야간 방음 가설벽 설치 및 철거 반출', '일식', '4,850,000원', '성수건업 (야간 할증 포함)'],
      ['CAR-204', '친환경 방염 석고보드 2P 시공 (9.5T)', '㎡', '38,500원', 'KCC 방염 인증필'],
      ['ELC-309', '회의실 라인조명 매립 타공 및 배선', 'M', '64,000원', 'SMPS 안정기 별도'],
      ['TOT-999', '총 직접공사비 합계 (VAT 별도)', '식', '68,420,000원', '대표님 결재 완료 (10% 네고 반영)'],
    ],
    fullTextPreview:
      '1. 현장명: 을지로 3가 프라임타워 8층 오피스 인테리어 공사\n2. 발주처: (주)메타솔루션파트너스 / 담당: 이팀장\n3. 핵심 특기사항: 주간 소음 민원으로 인해 철거 및 폐기물 반출은 금요일 22:00 ~ 일요일 18:00 야간 집중 공정으로 진행함. 단가표 Sheet 2의 C14~F18 구간에 협력사 네고 단가(-7.5%)가 최종 반영되어 있음.',
  },
  {
    id: 'work-doc-2',
    folderId: 'contracts',
    folderPath: 'S:\\01_계약서_법무문서',
    fileName: '2026_외주개발_및_유지보수_표준도급계약서_최종.docx',
    ext: 'DOCX',
    sizeLabel: '2.1 MB',
    updatedAt: '오늘 11:40',
    author: '이팀장 (전략기획)',
    lockedBy: '이팀장',
    cacheSizeLabel: '28.1 KB 선행 캐싱됨',
    summaryTitle: '[계약서 본문 + 별첨 과업지시서 내용 요약] 제14조 지체상금(1일 0.15%) 및 제19조 지식재산권 공동귀속 특약 조항',
    matchedSnippet:
      '본문 제14조(지체상금 및 위약금) 제2항: "을이 정당한 사유 없이 납기를 지연할 경우 매 지체일수당 계약금액의 1,000분의 1.5(0.15%)를 공제하며, 최대 한도는 총 계약금액의 10%로 한다."',
    tableHeaders: ['조항', '핵심 규정 항목', '적용 기준 / 비율', '법무 검토 의견'],
    tableRows: [
      ['제4조 (대금지급)', '선금 30% / 중도금 40% / 잔금 30%', '검수 완료 후 7영업일 이내 현금', '적정 (표준하도급 준수)'],
      ['제14조 (지체상금)', '납기 지연 시 일할 위약금', '1일당 0.15% (상한 10%)', '특약 반영 완료'],
      ['제19조 (지재권)', '산출물 원본 소스코드 및 특허권', '갑·을 공동 소유 (제3자 라이선스 제한)', '대표님 확인 필'],
    ],
    fullTextPreview:
      '제1조(목적) 본 계약은 갑이 위탁하는 클라우드 대체형 로컬 P2P 문서 검색 인프라 구축 과업을 을이 수행함에 있어 필요한 권리·의무를 규정한다.\n제14조(지체상금) 납기 지연 시 일 0.15%를 적용하되, 갑의 요구사항 변경으로 인한 일정 연장은 지체일수에서 제외한다.\n제21조(하자보수) 무상 하자보수 기간은 최종 검수 완료일로부터 12개월로 한다.',
  },
  {
    id: 'work-doc-3',
    folderId: 'tax',
    folderPath: 'S:\\03_세금계산서_회계증빙',
    fileName: '2026_3분기_거래처별_미수금_및_세금계산서_정산원장.xlsx',
    ext: 'XLSX',
    sizeLabel: '6.4 MB',
    updatedAt: '어제 18:15',
    author: '정실장 (재무회계)',
    lockedBy: null,
    cacheSizeLabel: '30.0 KB 선행 캐싱됨',
    summaryTitle: '[회계원장 시트 내용 요약] 3분기 전자세금계산서 발행분 18건 중 미수금 2건(한빛테크·청담디자인) 입금 독촉 일정',
    matchedSnippet:
      '표(3Q_미수금현황) 행 8~9: "(주)한빛테크 잔금 13,200,000원 (세금계산서 09/25 발행, 입금약정일 10/25) · 청담디자인스튜디오 5,500,000원 (10/20 입금예정)"',
    tableHeaders: ['거래처명', '품목 / 프로젝트', '공급가액 (VAT포함)', '계산서 발행일', '수금 상태'],
    tableRows: [
      ['(주)한빛테크', '본사 서버랙 및 내부망 구축 잔금', '13,200,000원', '2026-09-25', '미수 (10/25 입금약정)'],
      ['청담디자인스튜디오', '브랜드 쇼룸 영상 납품 중도금', '5,500,000원', '2026-09-30', '미수 (10/20 입금예정)'],
      ['성동메디컬의원', '원내 안내 키오스크 납품 완납', '24,200,000원', '2026-09-12', '수금완료 (09/18)'],
    ],
    fullTextPreview:
      '■ 2026년 3분기 매출 세금계산서 총괄: 총 발행액 1억 8,450만 원 중 수금 완료 1억 6,580만 원 (수금률 89.8%).\n■ 미수 거래처 조치 내역: 한빛테크 재무팀 김차장 통화 완료(10월 25일 정기결제일 전액 입금 확정), 청담디자인스튜디오는 금주 금요일 오전 입금 예정.',
  },
  {
    id: 'work-doc-4',
    folderId: 'contracts',
    folderPath: 'S:\\01_계약서_법무문서',
    fileName: '2026_신규입사자_표준근로계약서_및_비밀유지서약서(NDA).hwp',
    ext: 'HWP',
    sizeLabel: '1.4 MB',
    updatedAt: '2026-10-16',
    author: '정실장 (인사총무)',
    lockedBy: null,
    cacheSizeLabel: '26.8 KB 선행 캐싱됨',
    summaryTitle: '[한글(HWP) 본문 내용 요약] 포괄산정 연장근로수당 기준, 식대 비과세 20만 원 항목 및 영업비밀 보호 특약',
    matchedSnippet:
      '제6조(임금의 구성항목) 표2: "기본급 및 직무수당 외 식대 월 200,000원(비과세)을 별도 지급하며, 퇴직금 산정 기준은 근로기준법 제34조를 따른다."',
    tableHeaders: ['급여 항목', '산정 기준', '과세 여부', '지급일'],
    tableRows: [
      ['기본급', '주 40시간 (월 209시간 기준)', '과세', '매월 25일'],
      ['식대 보조비', '월 고정 지급 (200,000원)', '비과세 한도 적용', '매월 25일'],
      ['자가운전보조금', '외근직 차량 업무 사용 시 (200,000원)', '비과세 요건 충족 시', '매월 25일'],
    ],
    fullTextPreview:
      '본 근로계약서는 2026년 개정 노동관계법령을 준수하여 작성되었으며, 부속 서류인 [별첨1] 영업비밀 및 고객DB 보호 서약서(NDA)에 서명함으로써 효력이 발생한다.',
  },
  {
    id: 'work-doc-5',
    folderId: 'quotes',
    folderPath: 'S:\\02_견적서_단가표_엑셀',
    fileName: '성수동_팝업스토어_집기제작_비교견적서_3개사비교.pdf',
    ext: 'PDF',
    sizeLabel: '8.7 MB',
    updatedAt: '2026-10-15',
    author: '최대리 (공간기획)',
    lockedBy: null,
    cacheSizeLabel: '29.9 KB 선행 캐싱됨',
    summaryTitle: '[스캔 PDF OCR + 표 내용 요약] A사(다온팩토리) vs B사(성수목공) vs C사(아크릴랩) 쇼케이스 제작 단가 및 납기 비교표',
    matchedSnippet:
      '비교표 4행: "B사(성수목공) — SUS 헤어라인 쇼케이스 + LED 간접조명 일체형 1,280만 원 (납기 10일, 무상 A/S 1년) ★최종 선정 추천"',
    tableHeaders: ['비교 항목', 'A사 (다온팩토리)', 'B사 (성수목공 ★추천)', 'C사 (아크릴랩)'],
    tableRows: [
      ['총 견적금액 (VAT별도)', '14,500,000원', '12,800,000원 (최저가)', '15,200,000원'],
      ['제작 및 설치 납기', '발주 후 14일', '발주 후 10일 (야간설치 포함)', '발주 후 12일'],
      ['특장점 / 비고', '도장 마감 우수', '성수동 인근 공장으로 즉시 대응 가능', '특수 아크릴 가공 포함'],
    ],
    fullTextPreview:
      '성수동 연무장길 팝업스토어 메인 디스플레이 집기 제작을 위해 3개 협력사로부터 입수한 견적서 스캔본을 AI OCR 및 표 구조 추출로 통합 비교함. B사(성수목공)가 단가(-170만 원 절감) 및 현장 긴급 대응력 면에서 가장 우수함.',
  },
  {
    id: 'work-doc-6',
    folderId: 'site',
    folderPath: 'S:\\04_현장시공_도면_미디어',
    fileName: '성수동_쇼룸_천장배선_및_분전반_시공도면_현장검수본.dwg',
    ext: 'DWG',
    sizeLabel: '18.2 MB',
    updatedAt: '2026-10-14',
    author: '강사원 (현장감리)',
    lockedBy: null,
    cacheSizeLabel: '27.5 KB 선행 캐싱됨',
    summaryTitle: '[도면 주기(Note) & 레이어 텍스트 내용 요약] 메인 분전반(MCCB 100A) 증설 위치 및 에스프레소 머신 전용 단독 회로(30A) 배선 지시',
    matchedSnippet:
      '도면 우측 하단 특기시방 주기(Note #4): "바리스타 바(Bar) 하부 에스프레소 머신(7.2kW) 및 제빙기는 반드시 30A 누전차단기 단독 회로로 직결 시공할 것 (타 콘센트 분기 절대 금지)"',
    tableHeaders: ['회로 번호', '부하 명칭', '차단기 용량', '전선 규격 / 배관'],
    tableRows: [
      ['M-01 (Main)', '쇼룸 통합 주분전반 메인', 'MCCB 4P 100A', 'F-CV 35sq / 강제전선관'],
      ['P-04 (단독)', '에스프레소 머신 (7.2kW 전용)', 'ELCB 2P 30A (감도 30mA)', 'HIV 6.0sq 단독 직결'],
      ['L-02 (조명)', '매장 메인 트랙조명 & 간판', 'ELCB 2P 20A', 'HIV 2.5sq / CD관 매립'],
    ],
    fullTextPreview:
      '현장 감리 메모: 기존 건물 분전반 용량이 50A로 부족하여 한전 승압 신청 완료(100A). 바리스타존 커피머신 가동 시 차단기 트립 방지를 위해 P-04 단독 회로를 천장 트레이 경유하여 바 하부 점검구로 인출 완료함.',
  },
  {
    id: 'work-doc-7',
    folderId: 'site',
    folderPath: 'S:\\04_현장시공_도면_미디어',
    fileName: '성수동_쇼룸_분전반_30A단독차단기_시공완료_현장사진.jpg',
    ext: 'JPG',
    sizeLabel: '3.6 MB',
    updatedAt: '2026-10-14',
    author: '강사원 (현장감리)',
    lockedBy: null,
    cacheSizeLabel: '18.2 KB 시각 분석 캐싱됨',
    summaryTitle: '[현장 시공 사진 AI 시각·OCR 분석] 분전반 내부 ELCB 30A 단독 차단기 라벨(P-04 에스프레소 전용) 및 접지선 결선 상태 검수 사진',
    matchedSnippet:
      '사진 시각·라벨 OCR 분석: "분전반 우측 하단 P-04 에스프레소 머신 전용 ELCB 2P 30A 누전차단기 장착 및 녹색 접지선(HIV 6.0sq) 직결 시공 확인 완료 (※ 업무방: 인물 여권 미발동 · 현장 사물/라벨만 분석)"',
    tableHeaders: ['분석 항목', 'AI 시각·OCR 판독 결과', '검수 상태'],
    tableRows: [
      ['차단기 명판 OCR', 'ELCB 2P 30A (정격감도전류 30mA) · P-04 에스프레소 전용', '도면 일치 (정상)'],
      ['배선 및 접지 시각 분석', 'HIV 6.0sq 흑·적·녹 3선 압착단자 체결 완료', '합격'],
      ['인물 여권 보호 정책', '업무 공유방 내 인물 얼굴 여권 미발동 (검색 대상 제외)', '적용됨'],
    ],
    fullTextPreview:
      '업무 공유방 사진 분석 리포트: 현장 시공 사진, 자재 명판, 영수증·증빙 사진의 사물 및 텍스트(OCR)는 100% 시각 분석되어 검색되지만, 귀신같이 인물 여권(얼굴 클러스터링·인물 바구니)은 업무 프라이버시 원칙에 따라 발동하지 않으며 검색 대상에서도 제외됩니다.',
  },
];


export const WorkLoungeB2BHub: React.FC = () => {
  const { isStoreAppMode, setShowProModal, activatePricingPlan, subscribedLounges, faceClusters } =
    useSaySeeStore();
  const [viewMode, setViewMode] = useState<'semantic' | 'explorer'>('semantic');
  const [driveTargetPath, setDriveTargetPath] = useState('D:\\Ghosti\\업무공유폴더_S');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('all');
  const [docs, setDocs] = useState<WorkLoungeDocItem[]>(INITIAL_WORK_DOCS);
  const [selectedDocId, setSelectedDocId] = useState<string>('work-doc-1');
  const [isSidePeekOpen, setIsSidePeekOpen] = useState<boolean>(false);
  const [showBackupManager, setShowBackupManager] = useState<boolean>(false);
  const [masterWorkPcName, setMasterWorkPcName] = useState<string>('사무실 메인 공용 PC (S: 드라이브)');
  const [backupPcNodes, setBackupPcNodes] = useState<
    Array<{ id: string; name: string; mirrorPath: string; status: string; active: boolean }>
  >([
    {
      id: 'backup-1',
      name: '대표님 집 데스크탑 (백업 1호)',
      mirrorPath: 'D:\\Ghosti_업무백업_원본미러',
      status: '✓ 원본 100% 실시간 동기화됨',
      active: true,
    },
    {
      id: 'backup-2',
      name: '정실장 재무회계 PC (백업 2호)',
      mirrorPath: 'E:\\Ghosti_안전백업_금고',
      status: '✓ 원본 100% 실시간 동기화됨',
      active: true,
    },
  ]);
  const [newBackupPcName, setNewBackupPcName] = useState<string>('');
  const [newBackupPcPath, setNewBackupPcPath] = useState<string>('D:\\Ghosti_추가백업_폴더');
  const [nightSleepBannerPhase, setNightSleepBannerPhase] = useState<'hidden' | 'visible' | 'fading'>('hidden');
  const [showMemberPermissions, setShowMemberPermissions] = useState<boolean>(true);
  const [hiddenDocIds, setHiddenDocIds] = useState<string[]>([]);
  const [docActionNotice, setDocActionNotice] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<
    Array<{
      id: string;
      name: string;
      dept: string;
      role: 'host' | 'editor' | 'viewer';
      sDriveConnected: boolean;
      statusText: string;
    }>
  >([
    {
      id: 'm-1',
      name: '김대표 (방장)',
      dept: '대표이사 · 마스터 PC',
      role: 'host',
      sDriveConnected: true,
      statusText: 'S:\\ 마스터 연결됨 (방장 1인 결제 · 전체 관리)',
    },
    {
      id: 'm-2',
      name: '박과장',
      dept: '공무·계약팀',
      role: 'editor',
      sDriveConnected: true,
      statusText: 'S:\\ 실시간 연결됨 (초대 팀원 평생 0원)',
    },
    {
      id: 'm-3',
      name: '이팀장',
      dept: '전략기획팀',
      role: 'editor',
      sDriveConnected: true,
      statusText: 'S:\\ 실시간 연결됨 (초대 팀원 평생 0원)',
    },
    {
      id: 'm-4',
      name: '정실장',
      dept: '재무회계팀 (백업 2호)',
      role: 'editor',
      sDriveConnected: true,
      statusText: 'S:\\ 실시간 연결됨 (초대 팀원 평생 0원)',
    },
    {
      id: 'm-5',
      name: '최대리',
      dept: '공간기획·설계팀',
      role: 'editor',
      sDriveConnected: true,
      statusText: 'S:\\ 실시간 연결됨 (초대 팀원 평생 0원)',
    },
    {
      id: 'm-6',
      name: '강사원',
      dept: '현장감리·외주협업',
      role: 'viewer',
      sDriveConnected: true,
      statusText: 'S:\\ 읽기 전용 연결됨 (초대 팀원 평생 0원)',
    },
  ]);

  const triggerNightSleepMode = () => {
    setNightSleepBannerPhase('visible');
    window.setTimeout(() => {
      setNightSleepBannerPhase('fading');
    }, 1800);
    window.setTimeout(() => {
      setNightSleepBannerPhase('hidden');
    }, 3800);
  };

  const workPlan = subscribedLounges.work;
  const [folderCounts, setFolderCounts] = useState<Record<string, number>>({
    all: 7,
    root: 1,
    contracts: 2,
    quotes: 2,
    tax: 1,
    site: 2,
  });

  // 실제 S: 드라이브 폴더 스캔 및 문서 목록 실시간 동기화
  const syncRealWorkFiles = () => {
    fetch('/__work/files')
      .then((r) => r.json())
      .then((data: { ok: boolean; files: any[] }) => {
        if (!data?.ok || !Array.isArray(data.files)) return;
        const realFiles = data.files;
        if (realFiles.length === 0) return;

        // 실제 파일들을 WorkLoungeDocItem 구조로 매핑
        const mappedRealDocs: WorkLoungeDocItem[] = realFiles.map((rf: any, idx: number) => {
          const isGifOrImg = rf.isImage;
          const defaultSnippet = isGifOrImg
            ? `이미지/미디어 파일: ${rf.name} (${rf.sizeFormatted}) — 실시간 미리보기 가능`
            : rf.previewText
            ? rf.previewText.slice(0, 160).replace(/\n/g, ' ')
            : `S: 드라이브 보관 파일 — ${rf.relPath}`;

          return {
            id: `real-file-${idx}-${rf.name}`,
            folderId: rf.folderId || 'root',
            folderPath: rf.folderPath || 'S:\\',
            fileName: rf.name,
            ext: rf.ext || 'FILE',
            sizeLabel: rf.sizeFormatted || '0 KB',
            updatedAt: rf.mtimeFormatted || '최근',
            author: '멀린님 (로컬)',
            lockedBy: null,
            cacheSizeLabel: '실시간 로컬 동기화',
            summaryTitle: isGifOrImg
              ? `[이미지 파일 미리보기] ${rf.name}`
              : `[문서 미리보기] ${rf.name}`,
            matchedSnippet: defaultSnippet,
            tableHeaders: rf.tableHeaders && rf.tableHeaders.length > 0 ? rf.tableHeaders : ['속성', '상세 정보'],
            tableRows:
              rf.tableRows && rf.tableRows.length > 0
                ? rf.tableRows
                : [
                    ['파일명', rf.name],
                    ['위치', rf.folderPath],
                    ['용량', rf.sizeFormatted],
                    ['최근 수정일', rf.mtimeFormatted],
                  ],
            fullTextPreview: rf.previewText || (isGifOrImg ? `[이미지 미리보기 지원] ${rf.name}` : `S: 드라이브 로컬 원본 파일입니다.`),
            isImage: rf.isImage,
            imageBase64: rf.imageBase64,
          };
        });

        // 실제 파일(예: 1줄빛러M.gif 등)을 최상단에 배치하고 기존 표준 업무 문서 템플릿과 병합
        const combinedDocs = [
          ...mappedRealDocs,
          ...INITIAL_WORK_DOCS.filter((initDoc) => !mappedRealDocs.some((r) => r.fileName === initDoc.fileName)),
        ];

        // 폴더별 카운트 계산
        const counts: Record<string, number> = { all: combinedDocs.length, root: 0, contracts: 0, quotes: 0, tax: 0, site: 0 };
        combinedDocs.forEach((d) => {
          if (counts[d.folderId] !== undefined) {
            counts[d.folderId]++;
          }
        });
        setFolderCounts(counts);
        setDocs(combinedDocs);
      })
      .catch(() => {});
  };

  // 라운지 진입 시 100% 무인 자동으로 연결 개통 및 윈도우 S: 드라이브 자동 연결 + 파일 스캔
  useEffect(() => {
    void verifyHybridP2PBridgeConnection({
      roomId: 'lounge-work-b2b',
      simulateSymmetricNatBlock: false,
    });

    void fetch('/__work/s-drive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mount', openExplorer: false }),
    })
      .then((r) => r.json())
      .then((data: { targetDir?: string }) => {
        if (data?.targetDir) setDriveTargetPath(data.targetDir);
      })
      .catch(() => {});

    syncRealWorkFiles();
    const interval = setInterval(syncRealWorkFiles, 4000);
    return () => clearInterval(interval);
  }, []);

  // 업무 공유(work)에서는 귀신같이 인물 여권(얼굴 클러스터링·인물 별명)이 발동하지 않으며 검색 대상에서도 제외됨
  const passportPersonTokens = React.useMemo(() => {
    const s = new Set<string>();
    for (const fc of faceClusters) {
      if (fc.registeredName?.trim()) s.add(fc.registeredName.trim().toLowerCase());
      for (const pv of Object.values(fc.roomPersonas ?? {})) {
        const clean = (pv || '').trim();
        if (clean) {
          s.add(clean.toLowerCase());
          const short = clean.replace(/\([^)]*\)/g, '').trim();
          if (short.length >= 2) s.add(short.toLowerCase());
        }
      }
    }
    return s;
  }, [faceClusters]);

  // 어절(단어) 단위 스마트 매칭: "지체상금 0.15%" 클릭 시 "지체상금(1일 0.15%)"도 100% 매칭 (단, 여권 인물명은 검색 제외)
  const filteredDocs = docs.filter((doc) => {
    const folderMatch =
      viewMode === 'semantic'
        ? true
        : selectedFolderId === 'all' || doc.folderId === selectedFolderId;
    if (!folderMatch) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const rawTokens = q.split(/\s+/).filter(Boolean);
    const nonPassportTokens = rawTokens.filter((tk) => !passportPersonTokens.has(tk));
    if (nonPassportTokens.length === 0) return false;
    const combinedText = [
      doc.fileName,
      doc.summaryTitle,
      doc.matchedSnippet,
      doc.fullTextPreview,
      ...doc.tableRows.flat(),
    ]
      .join(' ')
      .toLowerCase();
    return nonPassportTokens.every((token) => combinedText.includes(token));
  });

  // 검색 결과(filteredDocs) 중에서 우선 선택하여 좌측 리스트와 우측 프리뷰가 항상 100% 동기화되도록 보장
  const selectedDoc =
    filteredDocs.find((d) => d.id === selectedDocId) || filteredDocs[0] || docs[0];

  const handleToggleLockSimulation = (docId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDocs((prev) =>
      prev.map((d) => {
        if (d.id !== docId) return d;
        const nextLock = d.lockedBy ? null : '김대표(나)';
        return { ...d, lockedBy: nextLock };
      })
    );
  };

  const QUICK_WORK_QUERIES = [
    '철거 단가 4,850,000원',
    '지체상금 0.15%',
    '한빛테크 미수금',
    '성수목공 비교견적',
    '에스프레소 30A 단독 회로',
    '분전반 시공완료 현장사진',
  ];

  return (
    <section className="flex flex-col gap-5">
      {/* 1. 노션형 보더리스(Borderless) 업무 도화지 헤더 + 검색창 + 폴더 필터 칩 */}
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="font-headline-sm text-[20px] md:text-[22px] text-slate-900 dark:text-white font-extrabold tracking-tight">
              💼 사무실 업무 문서·현장사진함 (S:\)
            </h2>
            {workPlan && (
              <span className="text-[12px] text-emerald-400 font-bold">
                · ✓ {PLAN_BADGE_LABELS[workPlan]}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-400/25 text-[11.5px] text-emerald-300 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              사무실 PC 연결됨 · 팀원 6명
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-400/25 text-[11px] text-cyan-300 font-bold">
              📸 현장·증빙 사진 AI 분석 · 🛂 인물 여권 미발동(검색 제외)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowMemberPermissions((v) => !v)}
              className="px-3 py-1 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-cyan-200 font-label-sm text-[11.5px] font-extrabold cursor-pointer flex items-center gap-1 shadow-xs"
            >
              <span>👥 팀원 권한 &amp; S: 드라이브 연결 설정 ({teamMembers.length}명)</span>
              <span>{showMemberPermissions ? '▴' : '▾'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowBackupManager((v) => !v)}
              className="px-3 py-1 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 text-emerald-300 font-label-sm text-[11.5px] font-extrabold cursor-pointer flex items-center gap-1"
            >
              <span>🛡️ 공용 S: PC 1대 + 백업 PC ({backupPcNodes.filter((b) => b.active).length}대 가동 중)</span>
              <span>{showBackupManager ? '▴' : '▾'}</span>
            </button>
            <button
              type="button"
              onClick={triggerNightSleepMode}
              className="px-3 py-1 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/45 text-indigo-200 font-label-sm text-[11.5px] font-extrabold cursor-pointer flex items-center gap-1"
              title="바탕화면 단축아이콘과 동일: 퇴근·취침 시 모니터 즉시 OFF + 15W 초절전 대기 + 메모리 유휴 캐시 정리"
            >
              <span>🌙 퇴근·야간 초절전 모드 (월 1,800원)</span>
            </button>
            <span className="px-2.5 py-1 rounded-xl bg-zinc-900 border border-amber-400/30 text-[11px] text-amber-200 font-bold">
              🛡️ 마스터 PC 기본 [휴지통] 직행 + 백업 PC 1·2호 랜섬웨어 서킷 브레이커
            </span>
          </div>
        </div>

        {/* ⚡ 호스트(방장) PC 전용: 사무실 연결 PC 삼체(Three-Body) 실시간 관제 목록 & 마스터/개별 ON·OFF 제어 */}
        <HostThreeBodyControlPanel contextMode="work" />

        {/* 🌙 퇴근·취침 시 실행되는 야간 초절전 모드 페이드아웃 안내 메시지 */}
        {nightSleepBannerPhase !== 'hidden' && (
          <div
            className={`p-4 rounded-2xl bg-gradient-to-r from-indigo-950/95 via-zinc-950/95 to-slate-950/95 border border-indigo-400/60 shadow-2xl flex flex-wrap items-center justify-between gap-3 transition-opacity duration-[1800ms] ${
              nightSleepBannerPhase === 'fading' ? 'opacity-0' : 'opacity-100'
            }`}
          >
            <div className="flex flex-col gap-1">
              <span className="font-headline-sm text-[15px] text-indigo-200 font-black">
                🌙 Ghosti 초절전·무소음 야간모드가 가동되었습니다 — 편히 퇴근·취침하세요!
              </span>
              <span className="text-[12px] text-zinc-300">
                ✓ 램(RAM) 유휴 캐시 정리 완료 · ✓ CPU 15W 초저전력 대기 전환(한 달 전기요금 약 1,800원) · <strong className="text-amber-300">이 안내 메시지는 서서히 사라진 뒤 모니터 전원이 꺼집니다...</strong>
              </span>
            </div>
            <span className="px-3 py-1 rounded-full bg-indigo-500/30 border border-indigo-300/50 text-indigo-100 font-mono text-[11px] font-bold">
              화면 페이드아웃 중...
            </span>
          </div>
        )}

        {/* 🛡️ 방장(대표) 전용: 공용 업무 PC(S: 1대) 지정 & 다중 백업 PC 실시간 원본 미러링 관리 패널 */}
        {showBackupManager && (
          <div className="p-4 rounded-2xl bg-[#18181B] border border-emerald-400/40 flex flex-col gap-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="font-headline-sm text-[14.5px] text-white font-extrabold">
                  🛡️ 클라우드 불신 제로! 공용 업무 PC(S: 드라이브 1대) + 백업 PC 1·2호 실시간 미러링 &amp; 랜섬웨어 서킷 브레이커
                </span>
                <span className="text-[12px] text-zinc-300">
                  구글 드라이브·네이버 MYBOX 동기화 폴더 위에 그대로 중첩 지정해도 충돌 없는 <code className="text-emerald-300">%LOCALAPPDATA%\Merlin\</code> 외부 격리(Zero-Footprint) 구조이며, 1분 내 30개 이상 대량 삭제·미끼 파일 변조 감지 시 <strong>백업 PC 1·2호 미러링을 0.01초 만에 즉시 차단</strong>해 랜섬웨어를 완벽 방어합니다.
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-400 text-zinc-950 font-label-sm text-[11px] font-extrabold">
                ✓ 마스터 PC 기본 [휴지통] 직행 + ↩️ 1초 실행 취소
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {/* 1) 공용 업무 PC (S: 드라이브 1대) */}
              <div className="p-3.5 rounded-xl bg-zinc-950 border border-cyan-400/45 flex flex-col justify-between gap-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-cyan-400 text-zinc-950 font-label-sm text-[10.5px] font-extrabold">
                    👑 메인 공용 업무 PC (1대)
                  </span>
                  <span className="text-[11px] text-cyan-300 font-mono font-bold">S:\ 마운트 마스터</span>
                </div>
                <div className="font-headline-sm text-[14px] text-white font-bold">
                  {masterWorkPcName}
                </div>
                <p className="text-[11px] text-zinc-400">
                  원본 경로: <code className="text-zinc-200">{driveTargetPath}</code> (전 직원 탐색기 S: 드라이브 직결)
                </p>
                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      setMasterWorkPcName((prev) =>
                        prev.includes('사무실')
                          ? '대표님 메인 워크스테이션 (S: 드라이브)'
                          : '사무실 메인 공용 PC (S: 드라이브)'
                      )
                    }
                    className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-cyan-300 text-[11px] font-bold cursor-pointer"
                  >
                    🔄 공용 업무 PC 변경 지정
                  </button>
                </div>
              </div>

              {/* 2) 다중 백업 PC 목록 (여러 대 마음대로 지정) */}
              <div className="lg:col-span-2 p-3.5 rounded-xl bg-zinc-950 border border-white/10 flex flex-col justify-between gap-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-label-sm text-[12px] text-emerald-300 font-extrabold">
                    💾 실시간 원본 백업 PC 목록 ({backupPcNodes.length}대 지정됨 · 대수 제한 없음)
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    각 백업 PC의 별도 지정 폴더에 S: 드라이브 원본이 1:1 실시간 복제됩니다
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {backupPcNodes.map((node) => (
                    <div
                      key={node.id}
                      className="p-2.5 rounded-lg bg-zinc-900 border border-emerald-400/30 flex items-center justify-between gap-2"
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="text-[12px] text-white font-bold truncate">
                          🖥️ {node.name}
                        </span>
                        <span className="text-[10.5px] text-zinc-400 font-mono truncate">
                          백업 경로: {node.mirrorPath}
                        </span>
                        <span className="text-[10.5px] text-emerald-300 font-bold">
                          {node.status}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setBackupPcNodes((prev) => prev.filter((item) => item.id !== node.id))
                        }
                        className="px-2 py-1 rounded bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-white text-[10.5px] font-bold shrink-0 cursor-pointer"
                      >
                        해제
                      </button>
                    </div>
                  ))}
                </div>

                {/* 새 백업 PC 추가 지정 폼 */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/10">
                  <input
                    type="text"
                    value={newBackupPcName}
                    onChange={(e) => setNewBackupPcName(e.target.value)}
                    placeholder="추가할 백업 PC 이름 (예: 김이사 노트북)"
                    className="flex-1 min-w-[160px] px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-white/15 text-white text-[11.5px]"
                  />
                  <input
                    type="text"
                    value={newBackupPcPath}
                    onChange={(e) => setNewBackupPcPath(e.target.value)}
                    placeholder="백업 저장 폴더 경로 (예: D:\Ghosti_원본백업)"
                    className="flex-1 min-w-[180px] px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-white/15 text-white text-[11.5px] font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const name = newBackupPcName.trim() || `추가 백업 PC ${backupPcNodes.length + 1}호`;
                      const path = newBackupPcPath.trim() || 'D:\\Ghosti_추가백업_폴더';
                      setBackupPcNodes((prev) => [
                        ...prev,
                        {
                          id: `backup-${Date.now()}`,
                          name,
                          mirrorPath: path,
                          status: '✓ 원본 100% 실시간 동기화됨',
                          active: true,
                        },
                      ]);
                      setNewBackupPcName('');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-label-sm text-[11.5px] font-extrabold cursor-pointer shrink-0"
                  >
                    + 백업 PC 추가 지정
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 👥 팀원 권한 & S: 드라이브 연결 설정 화면 (멤버별 읽기/편집/방장 권한 및 0원 무료 연결 상태) */}
        {showMemberPermissions && (
          <div className="p-4 rounded-2xl bg-[#18181B] border border-cyan-400/45 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="font-headline-sm text-[14.5px] text-white font-extrabold">
                  👥 [팀원 권한 &amp; S: 드라이브 연결] 멤버별 권한 설정 화면
                </span>
                <span className="text-[12px] text-zinc-300">
                  📢 <strong className="text-emerald-300">방장 1명만 구독하면 초대받은 가족·모임원·팀원은 평생 0원(무료)</strong>으로 윈도우 S: 드라이브에 직결되며, 멤버별로 편집·읽기 전용·숨기기 권한을 즉시 변경할 수 있습니다.
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-cyan-400 text-zinc-950 font-label-sm text-[11px] font-extrabold">
                ✓ 팀원 6명 S:\ 연결됨 (초대 팀원 전원 0원)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {teamMembers.map((member) => (
                <div
                  key={member.id}
                  className="p-3 rounded-xl bg-zinc-950 border border-white/10 flex flex-col justify-between gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-col min-w-0">
                      <span className="text-[13px] text-white font-extrabold truncate">
                        {member.role === 'host' ? '👑 ' : '👤 '}
                        {member.name}
                      </span>
                      <span className="text-[11px] text-zinc-400 truncate">{member.dept}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/35 text-emerald-300 text-[10.5px] font-extrabold shrink-0">
                      {member.role === 'host' ? '방장 (구독 호스트)' : '팀원 0원 (평생 무료)'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-white/10">
                    <span className="text-[10.5px] text-cyan-300 font-bold truncate">
                      🔗 {member.statusText}
                    </span>
                    {member.role === 'host' ? (
                      <span className="px-2 py-1 rounded-lg bg-amber-400/20 border border-amber-400/40 text-amber-200 text-[10.5px] font-extrabold shrink-0">
                        👑 전체 관리·숨기기
                      </span>
                    ) : (
                      <select
                        value={member.role}
                        onChange={(e) => {
                          const nextRole = e.target.value as 'editor' | 'viewer';
                          setTeamMembers((prev) =>
                            prev.map((m) =>
                              m.id === member.id
                                ? {
                                    ...m,
                                    role: nextRole,
                                    statusText:
                                      nextRole === 'editor'
                                        ? 'S:\\ 실시간 연결됨 (초대 팀원 평생 0원)'
                                        : 'S:\\ 읽기 전용 연결됨 (초대 팀원 평생 0원)',
                                  }
                                : m
                            )
                          );
                        }}
                        className="px-2 py-1 rounded-lg bg-zinc-900 border border-cyan-400/40 text-white text-[11px] font-bold cursor-pointer"
                      >
                        <option value="editor">✏️ 편집·업로드 허용</option>
                        <option value="viewer">👁️ 읽기·다운로드 전용</option>
                      </select>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 노션형 깔끔한 검색창 + 예시 검색어 칩 */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 bg-[#18181B] border border-white/15 focus-within:border-primary-container rounded-2xl px-4 py-2.5 shadow-sm transition-colors">
            <span className="text-zinc-400 text-sm">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value.trim()) setIsSidePeekOpen(true);
              }}
              placeholder="계약서 조항, 엑셀 단가표 숫자, 현장 시공 사진(차단기·배선·자재 라벨), 파일명 검색... (인물 여권 제외)"
              className="w-full bg-transparent text-white placeholder-zinc-500 font-body-sm text-[13.5px] focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-zinc-400 hover:text-white text-[11.5px] font-bold shrink-0 cursor-pointer"
              >
                ✕ 지우기
              </button>
            )}
          </div>

          {/* 1줄 폴더 필터 알약 + 예시 검색어 */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {WORK_LOUNGE_FOLDERS.map((folder) => {
                const active = selectedFolderId === folder.id && viewMode === 'explorer';
                const isAllActive = folder.id === 'all' && (selectedFolderId === 'all' || viewMode === 'semantic');
                const highlight = active || isAllActive;
                const count = folderCounts[folder.id] ?? folder.count;
                return (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => {
                      setSelectedFolderId(folder.id);
                      setViewMode(folder.id === 'all' ? 'semantic' : 'explorer');
                    }}
                    className={`px-3 py-1.5 rounded-full font-label-sm text-[11.5px] flex items-center gap-1.5 transition-all shrink-0 cursor-pointer border ${
                      highlight
                        ? 'bg-primary-container text-zinc-950 border-primary-container font-extrabold'
                        : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border-white/10 font-bold'
                    }`}
                  >
                    <span>
                      {folder.id === 'all' ? '💽 전체' : folder.id === 'root' ? '📄 S:\\ 최상단' : `📁 ${folder.name.replace(/^\d+_/, '')}`}
                    </span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                        highlight ? 'bg-black/15 text-zinc-950 font-black' : 'text-zinc-400'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-slate-500 dark:text-zinc-400">
              <span>빠른 검색:</span>
              {QUICK_WORK_QUERIES.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => {
                    const nextQ = searchQuery === q ? '' : q;
                    setSearchQuery(nextQ);
                    if (nextQ) {
                      setViewMode('semantic');
                      const tokens = nextQ.toLowerCase().split(/\s+/).filter(Boolean);
                      const matched = docs.find((d) => {
                        const text = [
                          d.fileName,
                          d.summaryTitle,
                          d.matchedSnippet,
                          d.fullTextPreview,
                          ...d.tableRows.flat(),
                        ]
                          .join(' ')
                          .toLowerCase();
                        return tokens.every((t) => text.includes(t));
                      });
                      if (matched) {
                        setSelectedDocId(matched.id);
                        setIsSidePeekOpen(true);
                      }
                    }
                  }}
                  className={`underline cursor-pointer transition-colors ${
                    searchQuery === q
                      ? 'text-teal-600 dark:text-cyan-300 font-extrabold'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 2. 노션 데이터베이스형 깔끔한 리스트 + 파일 클릭 시 우측에서 열리는 Side Peek 프리뷰 */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        <div className={`${isSidePeekOpen ? 'xl:col-span-7' : 'xl:col-span-12'} flex flex-col transition-all`}>
          <div className="rounded-2xl bg-white dark:bg-[#18181B] border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
            {/* 테이블 헤더 */}
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-zinc-950/70 border-b border-slate-200 dark:border-white/10 flex items-center justify-between text-[11.5px] text-slate-600 dark:text-zinc-400 font-bold">
              <span>
                문서 및 미디어 ({filteredDocs.length}건) · 항목을 클릭하면 우측에 상세 표·미리보기가 열립니다
              </span>
              {isSidePeekOpen && (
                <button
                  type="button"
                  onClick={() => setIsSidePeekOpen(false)}
                  className="text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-white text-[11px] font-bold cursor-pointer"
                >
                  우측 미리보기 닫기 ✕
                </button>
              )}
            </div>

            {/* 노션 데이터베이스 행(Row) 리스트 */}
            <div className="flex flex-col divide-y divide-slate-100 dark:divide-white/8">
              {filteredDocs.map((doc) => {
                const isSelected = isSidePeekOpen && doc.id === selectedDoc.id;
                return (
                  <div
                    key={doc.id}
                    onClick={() => {
                      if (isSelected) {
                        setIsSidePeekOpen(false);
                      } else {
                        setSelectedDocId(doc.id);
                        setIsSidePeekOpen(true);
                      }
                    }}
                    className={`px-4 py-3 flex flex-col gap-1.5 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-teal-50/80 dark:bg-cyan-950/35'
                        : 'hover:bg-slate-50 dark:hover:bg-zinc-900/70'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span
                          className={`px-2 py-0.5 rounded font-label-sm text-[10px] font-extrabold shrink-0 ${
                            doc.ext === 'XLSX' || doc.ext === 'CSV'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                              : doc.ext === 'DOCX' || doc.ext === 'HWP' || doc.ext === 'TXT'
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-400/40'
                              : doc.ext === 'PDF'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-400/40'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                          }`}
                        >
                          {doc.ext}
                        </span>
                        <span className="font-label-md text-[13.5px] text-slate-900 dark:text-white font-bold truncate">
                          {doc.fileName}
                        </span>
                        <span className="hidden md:inline text-[11.5px] text-slate-500 dark:text-zinc-400 truncate">
                          · {doc.summaryTitle.replace(/\[.*?\]\s*/g, '')}
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className="hidden sm:inline text-[11px] text-slate-500 dark:text-zinc-400">
                          {doc.folderPath} · {doc.sizeLabel} · {doc.updatedAt}
                        </span>
                        {doc.lockedBy ? (
                          <span className="px-2.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/60 text-amber-200 font-label-sm text-[10.5px] font-extrabold">
                            🔒 {doc.lockedBy} 수정 중
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 font-label-sm text-[10.5px] font-bold">
                            🔓 수정 가능
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 검색어가 입력되었을 때만 해당 행 아래에 매칭된 핵심 스니펫 1줄 표시 */}
                    {searchQuery.trim() && (
                      <div className="pl-11 text-[12px] text-cyan-200 truncate">
                        📌 {doc.matchedSnippet}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 우측 Side Peek 패널: 문서를 클릭했을 때만 우측에서 스르륵 열림 */}
        {isSidePeekOpen && selectedDoc && (
          <div className="xl:col-span-5 p-4 md:p-5 rounded-2xl bg-[#18181B] border border-cyan-400/40 shadow-xl flex flex-col gap-3.5 sticky top-16">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-400 text-zinc-950 font-label-sm text-[11px] font-extrabold">
                  📄 문서 내용 미리보기
                </span>
                <span className="text-[11px] text-zinc-400 font-bold">
                  {selectedDoc.author} · {selectedDoc.updatedAt}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsSidePeekOpen(false)}
                className="px-2 py-0.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-[11.5px] font-bold cursor-pointer"
              >
                ✕ 닫기
              </button>
            </div>

            <div className="flex flex-col gap-1">
              <span className="font-label-sm text-[11px] text-cyan-300 font-bold">
                {selectedDoc.folderPath}\{selectedDoc.fileName}
              </span>
              <h3 className="font-headline-sm text-[16px] text-white font-extrabold leading-snug">
                {selectedDoc.summaryTitle.replace(/\[.*?\]\s*/g, '')}
              </h3>
            </div>

            {selectedDoc.lockedBy ? (
              <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-400/50 flex flex-col gap-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-label-sm text-[12.5px] text-amber-200 font-extrabold">
                      🔒 현재 [{selectedDoc.lockedBy}]님이 사용 중입니다. 읽기 모드로 열립니다.
                    </span>
                    <span className="font-body-sm text-[11px] text-zinc-300">
                      (윈도우 탐색기 S: 드라이브에서 열 때는 엑셀·오피스 기본 읽기 전용 규칙대로 자동 작동하며, 사본 저장은 파일 내에서 각자 처리합니다.)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleLockSimulation(selectedDoc.id)}
                    className="px-2 py-1 rounded-lg bg-zinc-950/80 hover:bg-zinc-900 border border-white/15 text-zinc-400 hover:text-white font-label-sm text-[10.5px] font-bold shrink-0 cursor-pointer"
                  >
                    잠금 시뮬레이션 해제
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      window.alert(
                        `현재 [${selectedDoc.lockedBy}]님이 사용 중이므로 [${selectedDoc.fileName}] 문서를 읽기 모드로 열었습니다.`
                      )
                    }
                    className="w-full py-1.5 px-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-sm text-[11.5px] font-extrabold cursor-pointer text-center"
                  >
                    👁️ 읽기 모드로 열기
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-400/30 flex items-center justify-between gap-2">
                <span className="font-label-sm text-[11.5px] text-emerald-300 font-bold">
                  🔓 현재 사용 중인 팀원이 없습니다 — 바로 편집 가능
                </span>
                <button
                  type="button"
                  onClick={() => handleToggleLockSimulation(selectedDoc.id)}
                  className="px-2.5 py-1 rounded-lg bg-zinc-950 hover:bg-zinc-900 border border-emerald-400/40 text-emerald-300 font-label-sm text-[11px] font-bold shrink-0 cursor-pointer"
                >
                  잠금 시뮬레이션
                </button>
              </div>
            )}

            {/* 이미지 미리보기 (GIF / PNG / JPG 등 미디어 파일 지원) */}
            {selectedDoc.isImage && selectedDoc.imageBase64 && (
              <div className="p-3 rounded-xl bg-zinc-950 border border-cyan-400/30 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-label-sm text-[11.5px] text-cyan-300 font-extrabold">
                    🖼️ 이미지 원본 실시간 미리보기
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    {selectedDoc.ext} · {selectedDoc.sizeLabel}
                  </span>
                </div>
                <div className="w-full flex items-center justify-center p-2 rounded-lg bg-black/40 border border-white/5 overflow-hidden">
                  <img
                    src={selectedDoc.imageBase64}
                    alt={selectedDoc.fileName}
                    className="max-h-64 object-contain rounded"
                  />
                </div>
              </div>
            )}

            {/* 표 핵심 데이터 */}
            <div className="flex flex-col gap-1.5">
              <span className="font-label-sm text-[11.5px] text-zinc-300 font-extrabold">
                📊 표 핵심 내용
              </span>
              <div className="overflow-x-auto rounded-xl border border-white/10 bg-zinc-950">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-900 border-b border-white/10">
                      {selectedDoc.tableHeaders.map((h) => (
                        <th
                          key={h}
                          className="px-2.5 py-2 font-label-sm text-[11px] text-cyan-300 font-extrabold whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {selectedDoc.tableRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-zinc-900/50">
                        {row.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            className="px-2.5 py-1.5 font-body-sm text-[11.5px] text-zinc-200"
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 본문 요약 */}
            <div className="p-3 rounded-xl bg-zinc-950 border border-white/10 flex flex-col gap-1">
              <span className="font-label-sm text-[11px] text-emerald-300 font-extrabold">
                📄 본문 주요 내용
              </span>
              <p className="font-body-sm text-[12px] text-zinc-200 whitespace-pre-line leading-relaxed">
                {selectedDoc.fullTextPreview}
              </p>
            </div>

            {/* 원본 다운로드 / 방장 숨기기(실수 삭제 방지) / 본인 업로드 파일 관리 버튼 바 */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() =>
                  setDocActionNotice(
                    `⬇️ '${selectedDoc.fileName}' 원본 파일(${selectedDoc.sizeLabel}) 무손실 다운로드가 시작되었습니다!`
                  )
                }
                className="px-3 py-1.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-label-sm text-[11.5px] font-extrabold cursor-pointer flex items-center gap-1"
              >
                <span>⬇️ 원본 파일 다운로드</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const isCurrentlyHidden = hiddenDocIds.includes(selectedDoc.id);
                  setHiddenDocIds((prev) =>
                    isCurrentlyHidden
                      ? prev.filter((id) => id !== selectedDoc.id)
                      : [...prev, selectedDoc.id]
                  );
                  setDocActionNotice(
                    isCurrentlyHidden
                      ? `👁️ '${selectedDoc.fileName}' 파일의 숨김을 해제하여 공유 목록에 다시 표시합니다.`
                      : `🙈 [실수 삭제 방지] '${selectedDoc.fileName}' 파일을 공유방 목록에서 안전하게 숨겼습니다. (S: 드라이브 원본은 삭제되지 않고 보존됩니다)`
                  );
                }}
                className={`px-3 py-1.5 rounded-xl border font-label-sm text-[11.5px] font-extrabold cursor-pointer flex items-center gap-1 ${
                  hiddenDocIds.includes(selectedDoc.id)
                    ? 'bg-amber-400 text-zinc-950 border-amber-300'
                    : 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-400/50 text-amber-200'
                }`}
              >
                <span>
                  {hiddenDocIds.includes(selectedDoc.id)
                    ? '👁️ 숨김 해제'
                    : '🙈 숨기기 (실수 삭제 방지)'}
                </span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setDocActionNotice(
                    `🗂️ [본인 업로드 파일 관리] '${selectedDoc.fileName}' (업로더: ${selectedDoc.author}) — 업로더 본인 및 방장만 버전 변경·숨기기가 가능하여 팀원의 실수 삭제를 원천 방지합니다.`
                  )
                }
                className="px-3 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-400/50 text-purple-200 font-label-sm text-[11.5px] font-extrabold cursor-pointer flex items-center gap-1"
              >
                <span>🗂️ 본인 업로드 파일 관리</span>
              </button>
            </div>

            {docActionNotice && (
              <div className="p-2.5 rounded-xl bg-emerald-950/90 border border-emerald-400/50 text-emerald-200 font-body-sm text-[11.5px] font-bold flex items-center justify-between gap-2">
                <span>{docActionNotice}</span>
                <button
                  type="button"
                  onClick={() => setDocActionNotice(null)}
                  className="text-[11px] text-emerald-300 hover:text-white font-extrabold px-2 py-0.5 rounded bg-emerald-900/60 shrink-0"
                >
                  닫기
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="font-body-sm text-[11px] text-zinc-400">
                파일 크기: {selectedDoc.sizeLabel} · 위치: {selectedDoc.folderPath}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {!isStoreAppMode && !workPlan && (
                  <>
                    <button
                      type="button"
                      onClick={() => activatePricingPlan('work_soho_9900')}
                      className="px-3 py-1.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-zinc-950 font-label-sm text-[11.5px] font-extrabold cursor-pointer"
                    >
                      💼 소호(~5인) 월 9,900원 개통
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowProModal(true)}
                      className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-200 font-label-sm text-[11.5px] font-bold cursor-pointer"
                    >
                      요금제 안내 보기
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

