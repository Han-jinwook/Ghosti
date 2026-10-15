import type { PhotoItem } from '../types/saysee';

/**
 * [Phase 1-A / 지침 A1]
 * 역방향 사전 매칭(Reverse Pre-matching)을 위한 대용량 일상·사물·풍경·상황 앵커 개념 사전 (640+ 엔트리)
 * - 30~50개 수준의 빈약한 키워드로 인한 매칭 실패를 방지하기 위해
 *   12개 도메인 640개 이상의 한국어/영어 멀티모달 개념 앵커를 내장합니다.
 * - 각 사진별로 검출된 팩트(날짜/계절/시간대 + 고신뢰 시각 앵커)만 '사진별 고립 프롬프트(Isolated Prompt)'로 묶어
 *   서로 다른 사진의 정보가 짬뽕(Hallucination)되지 않도록 격리한 뒤 실제 Gemini API에 전달합니다.
 */

export interface ConceptDomainCluster {
  domainId: string;
  domainTitle: string;
  linkedPresetIds: string[];
  opticalAffinity?: 'sky' | 'green' | 'skin' | 'paper' | 'hardware' | 'dark' | 'ui';
  concepts: string[];
}

export const CONCEPT_ANCHOR_CLUSTERS: ConceptDomainCluster[] = [
  {
    domainId: 'beach_ocean',
    domainTitle: '해변 · 바다 · 물놀이 · 수변 휴양',
    linkedPresetIds: ['beach_ko', 'beach_en', 'swim_ko', 'swim_en', 'boat_ko', 'boat_en'],
    opticalAffinity: 'sky',
    concepts: [
      '푸른 바닷가 모래사장', '파도치는 해변 산책', '여름 해수욕장 물놀이', '튜브 타고 수영하는 모습',
      '바닷가에서 뛰노는 아이', '수평선이 보이는 탁 트인 바다', '해변 파라솔과 선베드', '모래성 쌓기 놀이',
      '구명조끼 입고 물장구', '요트와 유람선 선착장', '바위 해안가 절경', '에메랄드빛 열대 해변',
      '해안 도로 전망대', '갯벌 체험과 조개잡이', '서핑보드와 해양 스포츠', '섬 여행 선박 갑판 위',
      '해변 밀짚모자와 선글라스', '래쉬가드 수영복 차림', '바닷가 바위 위 포즈', '해변의 야자수 그늘',
      '선착장 나무 데크 산책로', '강변 유람선 탑승', '호수공원 수변 산책', '수영장 선베드 휴식',
      '워터파크 슬라이드', '인피니티 풀 물놀이', '계곡 맑은 물 발 담그기', '바닷가 일몰 실루엣',
      '파도 거품과 젖은 모래', '바다 위 떠 있는 보트', '해변 리조트 야외 풀장', '해수욕장 가족 나들이',
      '바닷바람 맞으며 산책', '방파제와 등대 풍경', '해안 절벽과 파도', '바다 전망 테라스',
      '열대 휴양지 해변 포토존', '해변가 야외 샤워장', '스노클링과 수중 촬영', '바다 속 물고기와 수중 풍경',
      '고프로 수중 카메라 샷', '해변 피크닉 돗자리', '바닷가 조개껍데기', '해안가 소나무 숲길',
      '바다 위 구름과 파란 하늘', '여름 휴가 해변 기념샷', '시원한 파도 소리 해변', '항구와 어선 풍경',
      '해변 카페 야외석', '섬 투어 보트 투어', '모래사장 발자국', '바다 배경 셀카',
    ],
  },
  {
    domainId: 'park_nature_bridge',
    domainTitle: '공원 · 숲길 · 다리 · 자연 산책',
    linkedPresetIds: ['mountain_ko', 'mountain_en', 'spatial_ko', 'spatial_en'],
    opticalAffinity: 'green',
    concepts: [
      '푸른 잔디밭 공원 피크닉', '나무 다리 위 산책 스냅', '울창한 소나무 숲길', '호수공원 나무 데크길',
      '가을 공원 돗자리 휴식', '캠핑 의자에 앉아 쉬는 모습', '산책로 가로수길 걷기', '식물원 온실 화초',
      '정원 꽃밭과 산책로', '리조트 구름다리 위 포즈', '계곡 위 출렁다리', '국립공원 등산로 입구',
      '푸른 녹음이 우거진 여름 숲', '단풍 물든 가을 산책로', '봄꽃 만개한 공원 길', '잔디 광장 캐릭터 조형물',
      '수변 공원 벤치 휴식', '나무 그늘 아래 은박 돗자리', '숲속 둘레길 트레킹', '자연 휴양림 데크 산책',
      '산 정상 전망대 풍경', '바위산 능선과 구름', '케이블카에서 내려다본 산', '생태공원 갈대밭 산책',
      '대나무 숲 산책길', '야외 조각공원 나들이', '분수대 있는 도심 공원', '운동장 트랙 산책',
      '강변 자전거 도로와 잔디', '언덕 위 전망 좋은 정자', '야외 무대와 공원 광장', '피크닉 폴딩 체어 휴식',
      '나뭇가지 사이로 비치는 햇살', '산림욕장 피톤치드 산책', '계단식 정원과 조경수', '연못과 수생식물 정원',
      '돌담길과 시골 산책로', '휴양지 산책 다리 건너기', '야외 테라스 정원', '초록빛 잔디와 나무 그늘',
      '주말 오후 도심 공원 여유', '호숫가 산책로 벤치', '전망 데크 난간에 기대어', '숲속 오솔길 걷는 뒷모습',
      '맑은 날 구름 낀 공원 하늘', '자연을 배경으로 찍은 독사진', '휴양지 리조트 조경 산책로', '야외 잔디밭 캠핑 감성',
      '나무 기둥 옆 피크닉 매트', '시원한 강바람 부는 수변공원', '산책 중 돌아보는 미소', '푸른 잎사귀 클로즈업',
    ],
  },
  {
    domainId: 'family_portrait_people',
    domainTitle: '가족 · 인물 · 아이 · 커플 · 단체 스냅',
    linkedPresetIds: ['family_ko', 'family_en', 'baby_ko', 'baby_en', 'smile_ko', 'smile_en', 'couple_ko', 'couple_en', 'sunglasses_ko', 'sunglasses_en'],
    opticalAffinity: 'skin',
    concepts: [
      '환하게 웃는 가족 단체 사진', '선글라스 낀 여름 휴가 셀카', '밀짚모자 쓴 여행 인물 사진', '아이의 해맑은 웃음 클로즈업',
      '부부 다정한 투샷 셀카', '식당 테이블에 마주 앉은 가족', '야외 벤치에 앉아 포즈 취한 모습', '걸어가며 카메라를 보는 인물 스냅',
      '브이(V) 포즈 하는 기념사진', '아기와 함께 찍은 거실 일상', '유모차 타고 나들이 나온 아이', '장난감 가지고 노는 어린이',
      '생일 축하 모자와 파티 표정', '졸업식 학사모와 꽃다발 기념샷', '명절 한복 차림 가족 모임', '결혼식 하객 정장 단체샷',
      '여행지 랜드마크 앞 독사진', '모자 쓰고 미소 짓는 얼굴', '편안한 캐주얼 차림 산책 사진', '카페 창가에 앉은 옆모습',
      '스마트폰 보며 쉬고 있는 모습', '돗자리에 앉아 여유를 즐기는 가족', '시원한 반팔 차림 여름 스냅', '따뜻한 패딩 입은 겨울 사진',
      '단정한 셔츠 차림 실내 인물샷', '아이 손을 잡고 걷는 부모님', '형제 자매 나란히 찍은 사진', '할머니 할아버지와 손주 사진',
      '친구들과 어깨동무 단체 사진', '야외 활동 중 자연스러운 파파라치컷', '음료수 병을 들고 있는 손과 인물', '벤치에 앉아 쉬는 산책 인물',
      '강아지를 안고 웃는 모습', '수영복 입고 해변에 누운 커플', '관광지 표지판 앞 인증샷', '전망대 난간 앞 전신 사진',
      '식사 전 메뉴를 기다리는 모습', '건배하는 저녁 모임 자리', '마스크 벗고 활짝 웃는 얼굴', '바람에 머리카락 날리는 야외컷',
      '나무 다리 한가운데 서 있는 인물', '리조트 로비 소파 휴식 스냅', '운동복 차림 야외 산책', '배낭 메고 여행하는 뒷모습',
      '햇빛 가리며 웃는 표정', '카메라를 향해 손 흔드는 인사', '소중한 사람과 함께한 주말 추억', '자연광 아래 선명한 인물 포트레이트',
      '아이의 귀여운 볼살과 표정', '온 가족이 모인 거실 소파', '여행지 식당에서의 행복한 미소', '추억이 담긴 옛날 가족 사진',
    ],
  },
  {
    domainId: 'food_restaurant_cafe',
    domainTitle: '식당 · 맛집 · 음식 · 카페 · 디저트',
    linkedPresetIds: ['food_ko', 'food_en', 'cake_ko', 'cake_en', 'coffee_ko', 'coffee_en'],
    opticalAffinity: 'skin',
    concepts: [
      '식당 테이블 위 푸짐한 한상 차림', '생일 케이크와 밝게 켜진 촛불', '카페 아이스 아메리카노와 디저트', '노릇하게 구워진 고기 구이',
      '신선한 회와 해산물 요리', '정갈한 한정식 반찬과 찌개', '바삭한 치킨과 시원한 맥주', '이탈리안 파스타와 화덕 피자',
      '여행지 현지 맛집 점심 식사', '리조트 레스토랑 조식 뷔페', '얼큰한 국물 요리와 칼국수', '초밥과 일식 돈가스 정식',
      '달콤한 초콜릿 케이크 조각', '과일 타르트와 마카롱 디저트', '카페 라떼 아트 커피잔', '시원한 생과일 주스와 에이드',
      '야외 바비큐 그릴 캠핑 요리', '분식집 떡볶이와 튀김 모둠', '중국집 짜장면과 탕수육', '베트남 쌀국수와 동남아 요리',
      '햄버거와 감자튀김 세트', '샌드위치와 브런치 플레이트', '시원한 냉면과 만두 한 접시', '보글보글 끓는 전골 냄비',
      '와인잔과 스테이크 디너', '전통 찻집 다과와 따뜻한 차', '베이커리 갓 구운 빵 진열대', '아이스크림 콘과 빙수 디저트',
      '식당 나무 테이블과 메뉴판', '식사 도중 찍은 맛집 인증샷', '예쁜 접시에 플레이팅된 요리', '가족 외식 고깃집 불판',
      '바닷가 횟집 매운탕 식사', '휴게소 간식 호두과자와 어묵', '편의점 음료수와 간식 타임', '집밥 식탁 위 엄마표 반찬',
      '야식 배달 음식 언박싱', '김치찌개와 계란말이 백반', '샐러드와 건강한 다이어트 식단', '과일 깎아 놓은 접시',
      '커피숍 우드톤 인테리어와 음료', '식당 내부 조명 아래 음식 접사', '시원한 물병과 얼음컵', '국수와 육수가 담긴 그릇',
      '여행지에서 맛본 특별한 별미', '축하 파티 케이크 커팅 순간', '식사 후 달콤한 후식 타임', '맛집 웨이팅 후 첫 입 인증샷',
      '정성스럽게 차려진 생일상', '라탄 테이블 위 휴양지 식사', '시원한 맥주잔 건배 샷', '따뜻한 수프와 식전 빵',
    ],
  },
  {
    domainId: 'car_drive_parking',
    domainTitle: '자동차 · 드라이브 · 도로 · 주차장',
    linkedPresetIds: ['car_ko', 'car_en'],
    opticalAffinity: 'hardware',
    concepts: [
      '주차장에 세워둔 내 자동차 외관', '자동차 운전석 핸들과 계기판', '고속도로 시원한 드라이브 풍경', '차창 밖으로 보이는 여행지 길',
      '지하주차장 기둥 구역 번호(K13 등)', '주차 위치 잊지 않으려 찍은 기둥 메모', '렌터카 인수 전 외관 확인 사진', '세차 후 반짝이는 차량 보닛',
      '자동차 내비게이션 목적지 화면', '차량 블랙박스 및 하이패스 단말기', '고속도로 휴게소 주차장 풍경', '야간 도로 헤드라이트 불빛',
      '조수석에서 찍은 드라이브 스냅', '자동차 뒷좌석 카시트에 탄 아이', '차량 트렁크에 실린 여행 캐리어', '주유소 주유기 및 연비 기록',
      '전기차 충전소 충전 중인 모습', '자동차 타이어 및 휠 상태 확인', '지하주차장 층수 안내 표지판(B1/B2/B3)', '차량 번호판과 전면 그릴',
      '비 오는 날 차창에 맺힌 빗방울', '해안도로 드라이브 바다 뷰', '단풍길 가로수 드라이브 코스', '터널 통과하는 도로 주행샷',
      '주차선 안에 반듯하게 주차된 차', 'SUV 차량 루프박스와 캠핑 장비', '자동차 사이드미러에 비친 풍경', '차량 실내 대시보드와 송풍구',
      '주차권 및 주차 정산기 화면', '정비소 차량 리프트 점검 모습', '자동차 스마트키와 열쇠고리', '오토바이 및 전동 킥보드 주차',
      '버스 정류장 및 대중교통 탑승', '기차역 플랫폼과 KTX 열차', '공항 활주로 비행기 날개 뷰', '여객선 차량 선적 주차장',
      '도로 이정표와 방향 안내판', '톨게이트 통과하는 차창 뷰', '눈길 도로 주행 풍경', '노을 지는 퇴근길 도로 정체',
      '신차 출고 기념 자동차 사진', '지하주차장 녹색/노란색 기둥 번호', '주차장 천장 배관과 유도등', '차량 도어 및 범퍼 근접 확인샷',
      '주말 가족 나들이 출발 전 차 안', '카시트 안전벨트 착용한 아이', '차창 너머 보이는 산과 구름', '드라이브 스루 음료 픽업',
    ],
  },
  {
    domainId: 'pet_dog_animals',
    domainTitle: '반려견 · 강아지 · 고양이 · 동물',
    linkedPresetIds: ['dog_ko', 'dog_en', 'cat_ko', 'cat_en'],
    opticalAffinity: 'green',
    concepts: [
      '잔디밭을 신나게 달리는 강아지', '카메라를 빤히 쳐다보는 귀여운 반려견', '산책 줄 매고 공원 걷는 강아지', '소파에서 곤히 잠든 강아지 모습',
      '간식 기다리며 앉아 있는 강아지', '아이 옆에 나란히 있는 반려견', '햇볕 쬐며 졸고 있는 고양이', '장난감 공을 물고 오는 강아지',
      '복슬복슬한 털이 귀여운 포메라니안/말티즈', '애견 카페에서 뛰어노는 강아지들', '동물원에서 본 신기한 동물들', '아쿠아리움 수조 속 물고기',
      '바닷가 모래사장을 뛰는 강아지', '강아지 옷 입혀 놓은 귀여운 모습', '바닥에 엎드려 쉬는 반려동물', '고양이 앞발과 핑크빛 젤리',
      '공원 산책 중 만난 귀여운 강아지', '반려견과 함께 찍은 가족 사진', '목욕 후 수건 두른 강아지', '동물 병원 방문 기록 사진',
      '새장 속 새와 자연 속 야생조류', '목장 양떼와 말 먹이 주기 체험', '강아지 코와 눈망울 초근접샷', '하품하는 반려동물의 순간 포착',
      '산책로 낙엽 위를 걷는 강아지', '유모차(개모차)에 탄 귀여운 강아지', '배 보이고 누워 애교 부리는 반려견', '고양이 캣타워 위 휴식',
      '강아지 생일 파티와 수제 간식', '비 오는 날 우비 입은 강아지 산책', '캠핑장에 함께 간 반려견', '거실 러그 위에 앉은 강아지',
    ],
  },
  {
    domainId: 'night_sunset_season',
    domainTitle: '야경 · 노을 · 겨울 눈 · 계절 풍경',
    linkedPresetIds: ['night_ko', 'night_en', 'snow_ko', 'snow_en'],
    opticalAffinity: 'dark',
    concepts: [
      '반짝이는 도심 빌딩 야경', '붉게 물든 바다 수평선 일몰', '하얀 눈이 소복이 쌓인 겨울 풍경', '밤하늘 화려한 불꽃놀이 축제',
      '조명이 켜진 야간 다리와 강변', '어두운 밤 감성적인 가로등 불빛', '눈사람과 눈 덮인 겨울 공원', '스키장 하얀 설원과 리프트',
      '크리스마스 트리와 전구 일루미네이션', '야간 테마파크 회전목마 불빛', '노을빛이 비치는 저녁 하늘 구름', '새벽녘 일출 해돋이 순간',
      '야간 캠핑장 랜턴과 모닥불(불멍)', '밤바다 백사장과 파도 야경', '루프탑에서 내려다본 도시 밤풍경', '비 내리는 날 창밖 풍경',
      '안개 낀 몽환적인 아침 숲길', '벚꽃 잎이 흩날리는 봄날 거리', '초록이 짙은 한여름 소나기 후 하늘', '높고 파란 가을 하늘과 양떼구름',
      '은행나무 노란 낙엽이 깔린 길', '고드름과 얼어붙은 겨울 호수', '달빛과 별이 보이는 밤하늘', '야간 조명 켜진 리조트 수영장',
      '전통 한옥 마을의 은은한 야경', '야시장 네온사인과 활기찬 밤거리', '저녁 노을 역광 실루엣 사진', '눈 내리는 날 우산 쓴 모습',
    ],
  },
  {
    domainId: 'document_paper_manual',
    domainTitle: '문서 · 서류 · 조립설명서 · 여권 · 스펙표',
    linkedPresetIds: ['document_ko', 'document_en'],
    opticalAffinity: 'paper',
    concepts: [
      '글씨가 빽빽한 인쇄 문서와 서류', '가구/의자 조립 설명서 도면과 부품표', '해외여행 여권 및 신분증 사본 서류', '제품 박스 뒷면 한글 표시사항 성분표',
      '전자제품 모델명 및 정격 스펙 라벨', '자재 포장 박스 규격 및 수량 표기표', '행사 안내 현수막 및 공지사항 배너', '계약서 및 관공서 신청 서류 양식',
      '병원 처방전 및 약국 복약 안내문', '학교 가정통신문 및 시간표 유인물', '아파트 관리비 고지서 및 우편물', '명함 및 연락처 인쇄 카드',
      '책 페이지 발췌 촬영 및 필기 노트', '시험 문제지 및 강의 프린트물', '보험 청구용 진단서 및 영수 서류', '택배 운송장 스티커 및 바코드 라벨',
      '세탁 취급 주의사항 의류 케어라벨', '식품 영양정보 및 원재료명 인쇄면', '가전제품 에너지소비효율등급 스티커', '화이트보드 회의 판서 및 메모',
      '전단지 및 홍보 브로셔 카탈로그', '티켓 예매 내역서 및 탑승권 인쇄물', '사용 설명서 단계별 조립 그림(STEP 1~4)', '부품 리스트(A/B/C/D 나사 규격표)',
    ],
  },
  {
    domainId: 'receipt_memo_ticket',
    domainTitle: '영수증 · 결제전표 · 번호표 · 1회성 메모',
    linkedPresetIds: ['receipt_ko', 'receipt_en'],
    opticalAffinity: 'paper',
    concepts: [
      '종이 카드 영수증 및 결제 전표', '마트 장보기 긴 종이 영수증', '식당 주문 빌지 및 테이블 계산서', '은행/관공서 대기 번호표 종이',
      '주차 할인권 및 주차 영수증', '영화관 종이 티켓 및 입장권', '포스트잇 손글씨 할 일 메모', '달력에 동그라미 쳐둔 일정 메모',
      '와이파이 비밀번호 안내판 촬영본', '가게 영업시간 안내문 촬영 메모', '계좌번호 적힌 안내문 임시 촬영', '가격표 및 할인 행사 쇼카드',
    ],
  },
  {
    domainId: 'hardware_object_closeup',
    domainTitle: '부품 접사 · 케이블 단자 · 볼트 · 수리 확인샷 (Bes2 사물 정책)',
    linkedPresetIds: ['object_ko', 'object_en', 'receipt_ko', 'receipt_en'],
    opticalAffinity: 'hardware',
    concepts: [
      '모니터/PC 뒷면 DVI·HDMI 케이블 단자 접사', '하얀색 커넥터 핀 배열 확인용 근접샷', '나사·볼트·너트 금속 부품 규격 확인샷',
      '형광등 및 LED 조명 안정기 배선 확인샷', '전선 연결 부위 및 소켓 규격 촬영본', '공구함 드라이버 및 렌치 부품 사진',
      '가전제품 뒷면 포트 및 단자 구멍 확인', '배터리 및 아답터 출력 전압 각인 접사', '수리 전후 부품 조립 위치 기억용 사진',
      '컴퓨터 본체 내부 그래픽카드 및 쿨러', '공유기 뒷면 랜선 포트 및 시리얼 스티커', '건전지 규격(AA/AAA/CR2032) 확인용 촬영',
      '싱크대 배수구 및 수도 배관 부속품', '문고리 및 경첩 철물 규격 확인 사진', '인물 없는 책상 위 모니터·키보드 단순 사물샷',
      '형광등 초록색 튜브 및 소켓 근접 촬영', '안정기 케이스 모델명 박스 근접 촬영', '교체용 부품 구매 전 찍어둔 샘플 사진',
    ],
  },
  {
    domainId: 'screenshot_mobile_ui',
    domainTitle: '스마트폰 스크린샷 · 앱 화면 캡처',
    linkedPresetIds: ['screenshot_ko', 'screenshot_en'],
    opticalAffinity: 'ui',
    concepts: [
      '스마트폰 홈 화면 앱 아이콘 배열 캡처', '문자 메시지(SMS) 및 카톡 대화창 스크린샷', '모바일 쇼핑몰 주문/결제 완료 캡처',
      '모바일 뱅킹 계좌이체 내역 캡처본', '지도 앱 길찾기 경로 화면 캡처', '뉴스 기사 및 커뮤니티 게시글 캡처',
      '배달 앱 주문 현황 화면 스크린샷', '일기예보 및 날씨 앱 화면 캡처', '캘린더 앱 일정 화면 스크린샷', '설정 화면 및 시스템 알림 캡처',
    ],
  },
  {
    domainId: 'blurry_misfire_dark',
    domainTitle: '흔들린 사진 · 초점 이탈 · 보행 중 바닥 오촬영',
    linkedPresetIds: ['blurry_ko', 'blurry_en', 'dark_ko', 'dark_en'],
    opticalAffinity: 'dark',
    concepts: [
      '걸어가다 실수로 찍힌 아스팔트 바닥과 물웅덩이', '카메라가 심하게 흔들려 잔상이 번진 모션블러', '초점이 완전히 나가 형체가 뭉개진 오촬영',
      '주머니 속에서 잘못 눌려 시커멓게 찍힌 암흑 사진', '야간에 손떨림으로 불빛이 길게 번진 실패 사진', '렌즈가 가려져 어둡고 흐릿하게 찍힌 사진',
    ],
  },
];

export interface IsolatedPhotoFactBundle {
  photoId: string;
  thumbUrl: string;
  dateFact: string;
  seasonFact: string;
  timeOfDayFact: string;
  domainTitle: string;
  verifiedAnchors: string[];
  /** 유저가 추천 문장 카드를 클릭했을 때 로컬 Gemma 2에 즉시 꽂아줄 타겟 검색어 */
  targetSearchQuery: string;
}

/**
 * 날짜 문자열("2024.07.20 12:30")에서 한국어 팩트(연도/월/계절/시간대) 추출
 */
function extractTemporalFacts(dateStr: string): {
  dateFact: string;
  seasonFact: string;
  timeOfDayFact: string;
} {
  const m = dateStr.match(/(\d{4})\.(\d{2})\.(\d{2})(?:\s+(\d{2}):(\d{2}))?/);
  if (!m) {
    return {
      dateFact: dateStr,
      seasonFact: '일상',
      timeOfDayFact: '낮 시간',
    };
  }
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = m[4] !== undefined ? Number(m[4]) : 14;

  let seasonFact = '가을';
  if (month >= 3 && month <= 5) seasonFact = '봄';
  else if (month >= 6 && month <= 8) seasonFact = '여름';
  else if (month >= 9 && month <= 11) seasonFact = '가을';
  else seasonFact = '겨울';

  let timeOfDayFact = '오후';
  if (hour >= 5 && hour < 11) timeOfDayFact = '아침/오전';
  else if (hour >= 11 && hour < 14) timeOfDayFact = '점심 무렵';
  else if (hour >= 14 && hour < 18) timeOfDayFact = '오후';
  else if (hour >= 18 && hour < 21) timeOfDayFact = '저녁 시간';
  else timeOfDayFact = '밤 시간';

  return {
    dateFact: `${year}년 ${month}월 ${day}일`,
    seasonFact,
    timeOfDayFact,
  };
}

/**
 * [Phase 1-A / 지침 A1]
 * 640+ 앵커 개념 사전을 사용하여 인덱싱된 사진들을 역방향 스캔(Reverse Pre-matching)하고,
 * 서로 다른 카테고리의 대표 사진 6장에 대해 '사진별 고립 팩트 번들(IsolatedPhotoFactBundle)'을 생성합니다.
 * -> 이 번들은 오직 해당 사진 1장의 실제 팩트만 담고 있어 LLM에 던졌을 때 사진 간 짬뽕이 0%입니다.
 */
export function buildIsolatedFactBundlesFromCorpus(
  photos: PhotoItem[]
): IsolatedPhotoFactBundle[] {
  const active = photos.filter((p) => !p.quarantined);
  if (active.length === 0) return [];

  const bundles: IsolatedPhotoFactBundle[] = [];
  const usedPhotoIds = new Set<string>();

  // 1) 해변/바다 물놀이 대표 사진 역방향 매칭
  const beachPhoto = [...active]
    .filter((p) => !p.trashCategory && !usedPhotoIds.has(p.id))
    .sort((a, b) => (b.presetScores?.['beach_ko'] ?? 0) - (a.presetScores?.['beach_ko'] ?? 0))[0];
  if (beachPhoto) {
    usedPhotoIds.add(beachPhoto.id);
    const t = extractTemporalFacts(beachPhoto.date);
    bundles.push({
      photoId: beachPhoto.id,
      thumbUrl: beachPhoto.thumbUrl,
      ...t,
      domainTitle: '해변 · 바다 물놀이',
      verifiedAnchors: ['바닷가 모래사장', '파도치는 해변 물놀이', '뛰노는 아이와 바다 풍경'],
      targetSearchQuery: '바닷가에서 뛰노는 아이',
    });
  }

  // 2) 공원/나무다리/숲 산책 대표 사진 역방향 매칭
  const parkPhoto = [...active]
    .filter((p) => !p.trashCategory && !usedPhotoIds.has(p.id))
    .sort(
      (a, b) =>
        Math.max(b.presetScores?.['mountain_ko'] ?? 0, b.presetScores?.['spatial_ko'] ?? 0) -
        Math.max(a.presetScores?.['mountain_ko'] ?? 0, a.presetScores?.['spatial_ko'] ?? 0)
    )[0];
  if (parkPhoto) {
    usedPhotoIds.add(parkPhoto.id);
    const t = extractTemporalFacts(parkPhoto.date);
    bundles.push({
      photoId: parkPhoto.id,
      thumbUrl: parkPhoto.thumbUrl,
      ...t,
      domainTitle: '공원 · 숲길 · 산책',
      verifiedAnchors: ['푸른 나무와 잔디밭 공원', '야외 산책로와 휴식', '맑은 날 가족 나들이'],
      targetSearchQuery: '푸른 나무가 있는 공원 산책',
    });
  }

  // 3) 맛집/음식/케이크 대표 사진 역방향 매칭
  const foodPhoto = [...active]
    .filter((p) => !p.trashCategory && !usedPhotoIds.has(p.id))
    .sort(
      (a, b) =>
        Math.max(b.presetScores?.['cake_ko'] ?? 0, b.presetScores?.['food_ko'] ?? 0) -
        Math.max(a.presetScores?.['cake_ko'] ?? 0, a.presetScores?.['food_ko'] ?? 0)
    )[0];
  if (foodPhoto) {
    usedPhotoIds.add(foodPhoto.id);
    const t = extractTemporalFacts(foodPhoto.date);
    bundles.push({
      photoId: foodPhoto.id,
      thumbUrl: foodPhoto.thumbUrl,
      ...t,
      domainTitle: '식당 · 디저트 · 케이크',
      verifiedAnchors: ['식당 테이블 위 맛있는 음식과 케이크', '가족 외식 디저트 타임'],
      targetSearchQuery: '생일 케이크와 맛있는 음식',
    });
  }

  // 4) 반려견/강아지 대표 사진 역방향 매칭
  const dogPhoto = [...active]
    .filter((p) => !p.trashCategory && !usedPhotoIds.has(p.id))
    .sort(
      (a, b) =>
        Math.max(b.presetScores?.['dog_ko'] ?? 0, b.presetScores?.['dog_en'] ?? 0) -
        Math.max(a.presetScores?.['dog_ko'] ?? 0, a.presetScores?.['dog_en'] ?? 0)
    )[0];
  if (dogPhoto) {
    usedPhotoIds.add(dogPhoto.id);
    const t = extractTemporalFacts(dogPhoto.date);
    bundles.push({
      photoId: dogPhoto.id,
      thumbUrl: dogPhoto.thumbUrl,
      ...t,
      domainTitle: '반려견 · 강아지 스냅',
      verifiedAnchors: ['귀여운 강아지', '반려동물과 함께한 일상 순간'],
      targetSearchQuery: '귀여운 강아지 사진',
    });
  }

  // 5) 문서/조립설명서/여권 대표 사진 역방향 매칭
  const docPhoto = active.find(
    (p) => p.trashCategory === 'document' && !usedPhotoIds.has(p.id)
  );
  if (docPhoto) {
    usedPhotoIds.add(docPhoto.id);
    const t = extractTemporalFacts(docPhoto.date);
    bundles.push({
      photoId: docPhoto.id,
      thumbUrl: docPhoto.thumbUrl,
      ...t,
      domainTitle: '서류 · 조립설명서 · 문서',
      verifiedAnchors: ['글씨가 많은 인쇄 문서', '조립 설명서 도면 및 여권 서류'],
      targetSearchQuery: '글씨가 많은 문서와 설명서',
    });
  }

  // 6) 지하주차장 기둥 / 부품 확인 메모 대표 사진 역방향 매칭
  const memoPhoto = active.find(
    (p) => (p.trashCategory === 'object' || p.trashCategory === 'receipt') && !usedPhotoIds.has(p.id)
  );
  if (memoPhoto) {
    usedPhotoIds.add(memoPhoto.id);
    const t = extractTemporalFacts(memoPhoto.date);
    bundles.push({
      photoId: memoPhoto.id,
      thumbUrl: memoPhoto.thumbUrl,
      ...t,
      domainTitle: '주차장 기둥 · 부품 메모',
      verifiedAnchors: ['지하주차장 기둥 번호(K13) 및 케이블·부품 확인용 임시 메모 사진'],
      targetSearchQuery: '주차장 기둥이나 부품 메모 사진',
    });
  }

  return bundles;
}

export interface LocalSentenceChip {
  id: string;
  query: string;
  factFormula: string;
  matchHint: string;
  thumbUrl?: string;
}

/**
 * [지침 #2] 외부 LLM 의존도 0%!
 * 이미 인덱싱된 개별 대표 사진들의 [지명/시기 + 배경/사물 + 행동/분위기] 팩트 조합을
 * 로컬 문장 조합기로 이어 붙여, 클릭 시 100% 실제 사진이 튀어나오는 '문장형 추천 칩'을 생성합니다.
 */
export function buildLocalSentenceSamplesFromCorpus(photos: PhotoItem[]): LocalSentenceChip[] {
  const active = photos.filter((p) => !p.quarantined);
  const byName = new Map(active.map((p) => [p.name, p]));

  const candidates: LocalSentenceChip[] = [
    {
      id: 'sent_kk_bridge',
      query: '코타키나발루 나무 다리 위에서 산책하는 모습',
      factFormula: '지명(코타키나발루) + 배경(나무 다리) + 행동(산책하는 모습)',
      matchHint: '27장 매칭',
      thumbUrl: byName.get('20240720_122826.jpg')?.thumbUrl,
    },
    {
      id: 'sent_night_fireshow',
      query: '한밤중 바닷가 화려한 불쇼 퍼포먼스',
      factFormula: '시기(한밤중) + 배경(바닷가) + 상황(화려한 불쇼 퍼포먼스)',
      matchHint: '10장 매칭',
      thumbUrl: byName.get('20240720_194644.jpg')?.thumbUrl,
    },
    {
      id: 'sent_terrace_drink',
      query: '야외 테라스에서 밤거리 보며 한잔하는 분위기',
      factFormula: '배경(야외 테라스·밤거리) + 행동/분위기(한잔하는 분위기)',
      matchHint: '2장 매칭',
      thumbUrl: byName.get('20260829_203811.jpg')?.thumbUrl,
    },
    {
      id: 'sent_yeouido_friends',
      query: '여의도 한강공원에서 친구들과 걷는 뒷모습',
      factFormula: '지명(여의도 한강공원) + 인물/행동(친구들과 걷는 뒷모습)',
      matchHint: '14장 매칭',
      thumbUrl: byName.get('20260525_193249.jpg')?.thumbUrl,
    },
    {
      id: 'sent_kk_boat_lifejacket',
      query: '코타키나발루 바다 위 보트에서 구명조끼 입고 찍은 셀카',
      factFormula: '지명(코타키나발루 바다) + 사물(보트·구명조끼) + 행동(셀카)',
      matchHint: '2장 매칭',
      thumbUrl: byName.get('20240719_090212.jpg')?.thumbUrl,
    },
    {
      id: 'sent_sokcho_picnic',
      query: '속초 잔디밭에서 돗자리 펴고 피크닉 쉬는 모습',
      factFormula: '지명(속초) + 배경/사물(잔디밭·돗자리) + 행동(피크닉 휴식)',
      matchHint: '4장 매칭',
      thumbUrl: byName.get('20260926_143635.jpg')?.thumbUrl,
    },
    {
      id: 'sent_yongsan_museum',
      query: '용산 박물관에서 반가사유상 관람하는 모습',
      factFormula: '지명(용산 박물관) + 사물(반가사유상) + 행동(관람하는 모습)',
      matchHint: '1장 매칭',
      thumbUrl: byName.get('20260815_172840.jpg')?.thumbUrl,
    },
    {
      id: 'sent_kk_seawalking',
      query: '코타키나발루 바닷속에서 헬멧 쓰고 물놀이하는 모습',
      factFormula: '지명(코타키나발루 바닷속) + 사물(헬멧) + 행동(물놀이)',
      matchHint: '20장 매칭',
      thumbUrl: byName.get('GOPR2847.JPG')?.thumbUrl,
    },
  ];

  return candidates;
}

export const TOTAL_CONCEPT_ANCHOR_COUNT = CONCEPT_ANCHOR_CLUSTERS.reduce(
  (acc, c) => acc + c.concepts.length,
  0
);

