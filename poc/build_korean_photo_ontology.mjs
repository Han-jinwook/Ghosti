/**
 * 귀신같이 (Ghosti) 한국어 시각 개념 족보 트리 (Korean Visual Photo Ontology Tree) 빌더 및 인덱서
 * - 기반: Open Multilingual WordNet (OMW-ko) + Google Open Images V7 Hierarchy + 한국인 일상 갤러리 어휘
 * - 핵심 원칙 (Is-A 단방향 상향 상속):
 *   1) 시각 필드(primaryTag, keywordsKo, caption)와 지리 필드(EXIF GPS location)를 분리 스캔하여 지명이 시각 사물을 오염시키지 않음.
 *   2) 구체어(자식)가 검출되면 오직 100% 동치 동의어(equivalents)와 상위 부모 개념(parents)만 상속.
 *   3) 상위어('물놀이', '공연')가 하위 구체어('스노클링', '음악회')를 역상속하는 일을 원천 차단.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const ONTOLOGY_OUT_PATH = path.resolve(ROOT_DIR, 'src/data/koreanPhotoOntology.json');
const SEMANTIC_INDEX_PATH = path.resolve(ROOT_DIR, 'poc/results/corpus_550_semantic_index.json');

const ONTOLOGY_TREE = [
  // ============================================================================
  // 1. 주류 · 음료 (Beverage & Alcohol)
  // ============================================================================
  {
    id: 'alcohol.beer',
    category: 'beverage',
    triggers: ['맥주', '생맥주', '병맥주', '캔맥주', '흑맥주', '맥주잔', '호프', 'beer'],
    equivalents: ['맥주', '생맥주', 'beer'],
    parents: ['술', '주류', '음료', '술자리', '잔', '컵'],
  },
  {
    id: 'alcohol.wine',
    category: 'beverage',
    triggers: ['와인', '레드와인', '화이트와인', '샴페인', '와인병', '와인잔', '말벡', 'wine'],
    equivalents: ['와인', '레드와인', 'wine'],
    parents: ['술', '주류', '음료', '술자리', '병', '잔', '컵'],
  },
  {
    id: 'alcohol.cocktail',
    category: 'beverage',
    triggers: ['칵테일', '하이볼', '모히또', 'cocktail'],
    equivalents: ['칵테일', 'cocktail'],
    parents: ['술', '주류', '음료', '술자리', '잔', '컵'],
  },
  {
    id: 'alcohol.soju_liquor',
    category: 'beverage',
    triggers: ['소주', '막걸리', '사케', '위스키', '양주', '소주병', '소주잔'],
    equivalents: [],
    parents: ['술', '주류', '음료', '술자리', '병', '잔'],
  },
  {
    id: 'alcohol.drinking_party',
    category: 'beverage',
    triggers: ['술자리', '건배', '안주', '주류'],
    equivalents: ['술자리', '건배'],
    parents: ['술', '주류', '모임', '식당'],
  },
  {
    id: 'beverage.coffee_cafe',
    category: 'beverage',
    triggers: ['커피', '아메리카노', '라떼', '카페라떼', '에스프레소', '카푸치노', '카페', '테이크아웃컵', 'coffee', 'cafe'],
    equivalents: ['커피', '카페', 'coffee', 'cafe'],
    parents: ['음료', '카페', '컵', '잔'],
  },
  {
    id: 'beverage.cup_glass',
    category: 'beverage',
    triggers: ['종이컵', '유리잔', '머그컵', '텀블러', '물컵', '주스', '에이드', '탄산음료', '음료수'],
    equivalents: [],
    parents: ['음료', '컵', '잔'],
  },

  // ============================================================================
  // 2. 음식 · 요리 · 식당 (Food, Dish & Restaurant)
  // ============================================================================
  {
    id: 'food.korean_soup',
    category: 'food',
    triggers: ['국밥', '뚝배기', '해장국', '설렁탕', '갈비탕', '삼계탕', '찌개', '김치찌개', '된장찌개', '한식'],
    equivalents: ['국밥', '뚝배기'],
    parents: ['밥', '음식', '식사', '요리', '한식', '식당', '맛집'],
  },
  {
    id: 'food.meat_bbq',
    category: 'food',
    triggers: ['바비큐', '고기', '고기구이', '삼겹살', '갈비', '소고기', '스테이크', '불고기', '족발', '보쌈', 'bbq'],
    equivalents: ['바비큐', '고기구이', 'bbq'],
    parents: ['고기', '밥', '음식', '식사', '요리', '식당', '맛집'],
    blockWords: ['물고기', '불고기버거'],
  },
  {
    id: 'food.buffet',
    category: 'food',
    triggers: ['뷔페', '호텔뷔페', '만찬', '연회장', 'buffet'],
    equivalents: ['뷔페', 'buffet'],
    parents: ['밥', '음식', '식사', '요리', '식당'],
  },
  {
    id: 'food.pizza_western',
    category: 'food',
    triggers: ['피자', '파스타', '스파게티', '햄버거', '샌드위치', '샐러드', '감자튀김', 'pizza'],
    equivalents: [],
    parents: ['밥', '음식', '식사', '요리', '식당'],
  },
  {
    id: 'food.cake_birthday',
    category: 'food',
    triggers: ['케이크', '생일케이크', '초콜릿케이크', '조각케이크', '생일', '촛불', 'cake', 'birthday'],
    equivalents: ['케이크', '생일케이크', 'cake'],
    parents: ['케이크', '생일', '디저트', '음식', '간식', '빵'],
  },
  {
    id: 'food.restaurant_general',
    category: 'food',
    triggers: ['식당', '레스토랑', '음식점', '맛집', '식사', '외식', '음식', '요리', '반찬', '상차림', 'restaurant', 'food'],
    equivalents: ['식당', '레스토랑', '음식', '식사', 'food', 'restaurant'],
    parents: ['밥', '음식', '식사', '요리', '식당', '맛집'],
  },

  // ============================================================================
  // 3. 의류 · 패션 · 착장 (Clothing & Fashion)
  // ============================================================================
  {
    id: 'clothing.swimwear',
    category: 'clothing',
    triggers: ['수영복', '비키니', '래시가드', '워터레깅스', '수영모', 'swimsuit'],
    equivalents: ['수영복', '래시가드', 'swimsuit'],
    parents: ['옷', '의류', '복장', '패션', '물놀이'],
  },
  {
    id: 'clothing.dress',
    category: 'clothing',
    triggers: ['원피스', '드레스', '롱원피스', '꽃무늬원피스', '스커트', '치마', 'dress'],
    equivalents: ['원피스', '드레스', 'dress'],
    parents: ['옷', '의류', '복장', '패션'],
  },
  {
    id: 'clothing.top_outer',
    category: 'clothing',
    triggers: ['티셔츠', '민소매', '반팔티', '셔츠', '블라우스', '니트', '맨투맨', '후드티', '재킷', '자켓', '정장', '코트', '패딩', '가디건', '운동복'],
    equivalents: [],
    parents: ['옷', '의류', '복장', '패션'],
  },
  {
    id: 'clothing.eyewear',
    category: 'clothing',
    triggers: ['선글라스', '안경', '물안경', '수경', '고글', 'sunglasses'],
    equivalents: ['선글라스', '안경', 'sunglasses'],
    parents: ['악세서리', '패션'],
  },
  {
    id: 'clothing.accessory_jewelry',
    category: 'clothing',
    triggers: ['목걸이', '귀걸이', '팔찌', '반지', '시계', '모자', '볼캡', '밀짚모자', '가방', '백팩', '핸드백', '슬리퍼', '샌들', '운동화', '신발'],
    equivalents: [],
    parents: ['악세서리', '패션', '잡화'],
    blockWords: ['모자이크'],
  },

  // ============================================================================
  // 4. 인물 · 가족 · 연령 (People & Relations)
  // ============================================================================
  {
    id: 'people.child',
    category: 'people',
    triggers: ['아이', '어린이', '아기', '유아', '꼬마', '소년', '소녀', '아들', '딸', '키즈', 'child', 'kid', 'baby'],
    equivalents: ['아이', '어린이', '아기', '유아', '꼬마', '소년', '소녀', 'child', 'kid'],
    parents: ['아이', '어린이', '사람', '인물', '가족'],
    blockWords: ['아이콘', '아이폰', '아이패드', '아이디어', '아이템', '아이돌', '아이스', '아이스크림', '아이라인'],
  },
  {
    id: 'people.family_group',
    category: 'people',
    triggers: ['가족', '가족사진', '단체', '단체사진', '일행', '모임', '부부', '커플', '사람들', 'family', 'group'],
    equivalents: ['가족', '단체', '일행', '모임', '사람들', 'family', 'group'],
    parents: ['가족', '단체', '모임', '사람', '인물'],
  },

  // ============================================================================
  // 5. 동물 · 반려동물 · 곤충 (Animals, Pets & Insects)
  // ============================================================================
  {
    id: 'animal.dog',
    category: 'animal',
    triggers: ['강아지', '반려견', '애완견', '멍멍이', '강쥐', '백구', '진돗개', '푸들', '말티즈', '리트리버', 'dog', 'puppy'],
    equivalents: ['개', '강아지', '반려견', '애완견', '멍멍이', '강쥐', 'dog', 'puppy'],
    parents: ['개', '강아지', '반려동물', '애완동물', '동물'],
  },
  {
    id: 'animal.cat',
    category: 'animal',
    triggers: ['고양이', '반려묘', '길고양이', '길냥이', '냥이', 'cat', 'kitten'],
    equivalents: ['고양이', '반려묘', '냥이', '길고양이', 'cat', 'kitten'],
    parents: ['고양이', '반려동물', '애완동물', '동물'],
  },
  {
    id: 'animal.insect',
    category: 'animal',
    triggers: ['벌레', '곤충', '나비', '잠자리', '딱정벌레', '거미', '개미'],
    equivalents: ['벌레', '곤충'],
    parents: ['벌레', '곤충', '생물'],
  },

  // ============================================================================
  // 6. 자연 · 바다 · 산 · 날씨 (Nature, Sea, Mountain, Weather)
  // ============================================================================
  {
    id: 'nature.sea_beach',
    category: 'nature',
    triggers: ['바다', '바닷가', '해변', '해수욕장', '모래사장', '백사장', '파도', '해안', '해안가', '수평선', '바닷물', 'beach', 'ocean', 'sea'],
    equivalents: ['바다', '바닷가', '해변', '해수욕장', '모래사장', '파도', '해안', 'beach', 'ocean'],
    parents: ['바다', '해변', '물', '자연', '풍경', '휴양지'],
  },
  {
    id: 'nature.island',
    category: 'nature',
    triggers: ['마무틱섬', '사피섬', '산호섬', '무인도', '호핑투어', 'island'],
    equivalents: ['섬', '호핑투어', 'island'],
    parents: ['섬', '바다', '물', '자연', '여행', '휴양지'],
  },
  {
    id: 'nature.river',
    category: 'nature',
    triggers: ['한강', '강변', '수변', '강물', '청계천', 'river'],
    equivalents: ['강', '한강', '강변', '수변', 'river'],
    parents: ['강', '물', '자연', '풍경', '산책'],
  },
  {
    id: 'nature.lake_waterfall_fountain',
    category: 'nature',
    triggers: ['호수', '영랑호', '연못', '계곡', '폭포', '분수', '물줄기', 'lake'],
    equivalents: [],
    parents: ['물', '자연', '풍경'],
  },
  {
    id: 'nature.mountain',
    category: 'nature',
    triggers: ['설악산', '북한산', '산봉우리', '봉우리', '능선', '산맥', '등산', '등산로', 'mountain'],
    equivalents: ['산', '등산', 'mountain'],
    parents: ['산', '숲', '자연', '풍경'],
  },
  {
    id: 'nature.forest_tree_park',
    category: 'nature',
    triggers: ['숲', '숲길', '수풀', '나무', '소나무', '야자수', '가로수', '잔디', '잔디밭', '정원', '공원', '피크닉', 'forest', 'tree', 'park', 'garden'],
    equivalents: [],
    parents: ['숲', '나무', '공원', '자연', '풍경'],
  },
  {
    id: 'nature.flower_plant',
    category: 'nature',
    triggers: ['화분', '꽃밭', '꽃다발', '장미', '벚꽃', '유채꽃', '수국', '튤립', '해바라기', '식물', '화초', '꽃무늬', 'flower', 'plant'],
    equivalents: ['꽃', '화분', '식물', 'flower'],
    parents: ['꽃', '식물', '자연'],
  },
  {
    id: 'nature.sunset_sunrise',
    category: 'nature',
    triggers: ['노을', '일몰', '석양', '일출', '해돋이', '해질녘', '황혼', 'sunset', 'sunrise'],
    equivalents: ['해', '노을', '일몰', '석양', 'sunset'],
    parents: ['해', '노을', '하늘', '자연', '풍경'],
  },
  {
    id: 'nature.night_view',
    category: 'nature',
    triggers: ['야경', '야간', '밤하늘', '밤거리', '도시불빛', '루프탑', '저녁', 'night', 'rooftop'],
    equivalents: ['밤', '야경', '야간', '저녁', 'night'],
    parents: ['밤', '야경', '불빛', '풍경'],
  },
  {
    id: 'nature.snow_winter',
    category: 'nature',
    triggers: ['설경', '눈밭', '눈사람', '함박눈', '겨울', '빙판', '스키장', '썰매장', 'snow', 'winter'],
    equivalents: ['눈', '설경', '눈밭', '겨울', 'snow'],
    parents: ['눈', '설경', '겨울', '자연', '풍경'],
  },
  {
    id: 'nature.rain_umbrella',
    category: 'nature',
    triggers: ['빗길', '빗방울', '소나기', '장마', '우산', '우비', '물웅덩이', 'rain', 'umbrella'],
    equivalents: ['비', '빗길', '우산', 'rain'],
    parents: ['비', '우산', '날씨', '물'],
  },

  // ============================================================================
  // 7. 교통 · 이동수단 (Vehicles & Transport)
  // ============================================================================
  {
    id: 'vehicle.car',
    category: 'vehicle',
    triggers: ['자동차', '차량', '승용차', '운전', '운전석', '핸들', '차안', '카시트', '도로', '배기구', '머플러', 'car', 'driving'],
    equivalents: ['차', '자동차', '차량', '승용차', 'car'],
    parents: ['차', '자동차', '차량', '교통'],
  },
  {
    id: 'vehicle.boat_yacht',
    category: 'vehicle',
    triggers: ['보트', '요트', '모터보트', '스피드보트', '유람선', '여객선', '선박', '카약', '패들보드', 'boat', 'yacht', 'ship'],
    equivalents: ['배', '보트', '요트', '선박', 'boat', 'yacht'],
    parents: ['배', '보트', '요트', '선박', '바다', '물'],
  },
  {
    id: 'vehicle.airplane_airport',
    category: 'vehicle',
    triggers: ['비행기', '항공기', '여객기', '활주로', '기내', '공항', '인천공항', '인천국제공항', '탑승구', '면세점', 'airplane', 'airport'],
    equivalents: ['비행기', '항공기', '공항', 'airplane', 'airport'],
    parents: ['비행기', '공항', '여행', '교통'],
  },

  // ============================================================================
  // 8. 건축 · 장소 · 공간 (Places, Architecture & Spaces)
  // ============================================================================
  {
    id: 'place.wooden_bridge',
    category: 'place',
    triggers: ['나무다리', '목조다리', '목재다리', '구름다리', '출렁다리', '목교', '나무데크다리', 'bridge'],
    equivalents: ['나무다리', '목조다리', '목재다리', '다리', 'bridge'],
    parents: ['다리', '나무다리', '길', '산책로', '산책', '공원', '나무'],
  },
  {
    id: 'place.stone_bridge',
    category: 'place',
    triggers: ['돌다리', '징검다리'],
    equivalents: ['돌다리', '징검다리'],
    parents: ['다리', '길', '산책로', '산책', '하천'],
  },
  {
    id: 'place.wooden_deck_pier',
    category: 'place',
    triggers: ['데크', '산책데크', '나무데크', '목재데크', '데크길', '선착장', '나무선착장', '목재선착장', 'boardwalk', 'pier'],
    equivalents: ['데크', '나무데크', '목재데크', '선착장', 'boardwalk'],
    parents: ['데크', '선착장', '길', '산책로', '산책'],
  },
  {
    id: 'place.swimming_pool',
    category: 'place',
    triggers: ['수영장', '풀장', '야외수영장', '인피니티풀', '워터파크', '풀사이드', 'pool'],
    equivalents: ['수영장', '풀장', '풀사이드', 'pool'],
    parents: ['수영장', '물', '물놀이', '리조트', '호텔', '휴양지'],
  },
  {
    id: 'place.hotel_resort',
    category: 'place',
    triggers: ['호텔', '리조트', '숙소', '펜션', '풀빌라', '객실', '로비', 'hotel', 'resort'],
    equivalents: ['호텔', '리조트', '숙소', 'hotel', 'resort'],
    parents: ['호텔', '리조트', '숙소', '여행'],
  },
  {
    id: 'place.home_room_window',
    category: 'place',
    triggers: ['거실', '안방', '침실', '주방', '부엌', '소파', '침대', '현관', '베란다', '실내', '가정집', '아파트', '창문', '창가', '창밖', '블라인드', 'window', 'room'],
    equivalents: [],
    parents: ['집', '방', '실내', '창', '창문'],
  },
  {
    id: 'place.office',
    category: 'place',
    triggers: ['사무실', '오피스', '회의실', '업무공간', '작업대', '모니터', '컴퓨터', '노트북', '키보드', 'office'],
    equivalents: ['사무실', 'office'],
    parents: ['사무실', '실내', '방', '업무'],
  },
  {
    id: 'place.museum_exhibition',
    category: 'place',
    triggers: ['박물관', '국립중앙박물관', '미술관', '전시관', '전시장', '갤러리', '전시', '관람', '유물', 'museum', 'exhibition'],
    equivalents: ['박물관', '국립중앙박물관', '전시', '전시관', '관람', 'museum', 'exhibition'],
    parents: ['박물관', '전시', '문화', '실내'],
  },
  {
    id: 'place.pagoda_heritage',
    category: 'place',
    triggers: ['석탑', '십층석탑', '경천사', '불상', '사찰', '문화재', '유적지', '기념비', '비석', 'pagoda'],
    equivalents: ['탑', '석탑', '십층석탑', '경천사', 'pagoda'],
    parents: ['탑', '석탑', '문화재', '박물관', '역사'],
  },
  {
    id: 'place.parking_pillar',
    category: 'place',
    triggers: ['주차장', '지하주차장', '주차기둥', '주차구역', 'k13', 'parking', 'pillar'],
    equivalents: ['주차장', '지하주차장', '주차기둥', '기둥', 'k13', 'parking', 'pillar'],
    parents: ['주차장', '기둥'],
  },
  {
    id: 'place.street_walk',
    category: 'place',
    triggers: ['거리', '골목', '도심', '산책로', '산책길', '산책', '보도', '상점', '매장', '시장', '광장시장', 'street'],
    equivalents: [],
    parents: ['길', '거리', '산책', '도시'],
  },

  // ============================================================================
  // 9. 공연 · 불쇼 · 물놀이 · 축제 (Events, Fire Show, Water Play)
  // ============================================================================
  {
    id: 'activity.fire_show',
    category: 'activity',
    triggers: ['불쇼', '파이어쇼', '불꽃쇼', '불꽃놀이', '폭죽', '횃불', '화염', '불길', '불꽃', '모닥불', '캠프파이어', 'fire', 'flame', 'fireshow'],
    equivalents: ['불', '불쇼', '파이어쇼', '불꽃', '불꽃쇼', '횃불', '화염', '모닥불', 'fire', 'flame'],
    parents: ['불', '불쇼', '불꽃', '공연', '밤', '야경'],
    blockWords: ['불안', '불편', '불가', '불구', '불빛', '블러'],
  },
  {
    id: 'activity.concert_performance',
    category: 'activity',
    triggers: ['음악회', '연주회', '콘서트', '가야금', '국악', '오케스트라', '버스킹', '무대', '공연장', 'concert', 'performance'],
    equivalents: [],
    parents: ['공연', '문화', '행사'],
  },
  {
    id: 'activity.festival',
    category: 'activity',
    triggers: ['축제', '페스티벌', '현수막', 'festival'],
    equivalents: ['축제', '페스티벌', 'festival'],
    parents: ['축제', '페스티벌', '행사'],
  },
  {
    id: 'activity.water_play',
    category: 'activity',
    triggers: ['물놀이', '스노클링', '다이빙', '수중', '수중촬영', '잠수', '해수욕', '수영', '고프로', 'snorkeling', 'swimming'],
    equivalents: [],
    parents: ['물', '물놀이'],
  },
  {
    id: 'activity.life_jacket',
    category: 'activity',
    triggers: ['구명조끼', '라이프자켓', '구명동의', 'lifejacket'],
    equivalents: ['구명조끼', '라이프자켓', 'lifejacket'],
    parents: ['구명조끼', '물놀이', '물', '바다'],
  },
  {
    id: 'activity.swim_tube',
    category: 'activity',
    triggers: ['물놀이튜브', '구명튜브', '수영튜브', '보행기튜브', '튜브'],
    equivalents: ['튜브', '물놀이튜브', '구명튜브'],
    parents: ['튜브', '물놀이', '물'],
    blockWords: ['유튜브', '자외선', '램프', 'uv-b', 'sundream'],
  },

  // ============================================================================
  // 10. 문서 · 스크린샷 · 부품 · 사물 (Documents, Screenshots & Objects)
  // ============================================================================
  {
    id: 'document.manual_blueprint',
    category: 'document',
    triggers: ['조립설명서', '설명서', '매뉴얼', '사용설명서', '도면', '설계도', '의자조립', '가이드북', 'manual', 'blueprint'],
    equivalents: ['설명서', '조립설명서', '매뉴얼', '도면', '의자조립', 'manual'],
    parents: ['설명서', '조립', '문서', '서류', '책', '글', '글씨', '종이'],
  },
  {
    id: 'document.receipt',
    category: 'document',
    triggers: ['영수증', '카드전표', '전표', '결제내역', '계산서', '청구서', 'receipt'],
    equivalents: ['영수증', '전표', '결제내역', 'receipt'],
    parents: ['영수증', '결제', '문서', '서류', '글', '글씨', '종이'],
  },
  {
    id: 'document.passport_id',
    category: 'document',
    triggers: ['여권', '신분증', '주민등록증', '운전면허증', '항공권', '탑승권', 'passport'],
    equivalents: ['여권', '신분증', 'passport'],
    parents: ['여권', '신분증', '문서', '서류', '글', '종이', '여행'],
  },
  {
    id: 'document.general_paper',
    category: 'document',
    triggers: ['문서', '서류', '종이', '책', '인쇄물', '전단지', '포스터', '안내판', '표지판', '간판', '메뉴판', '라벨', 'document', 'book'],
    equivalents: ['문서', '서류', '종이', 'document'],
    parents: ['문서', '서류', '책', '글', '글씨', '종이'],
  },
  {
    id: 'document.screenshot_sms',
    category: 'document',
    triggers: ['문자메시지', '문자', '메시지', '카톡', '카카오톡', '채팅창', 'sms'],
    equivalents: ['문자', '문자메시지', '메시지'],
    parents: ['문자', '메시지', '스크린샷', '캡처', '화면', '휴대폰', '글'],
  },
  {
    id: 'document.screenshot_screen',
    category: 'document',
    triggers: ['스크린샷', '화면캡처', '캡처', '홈화면', '알림창', '푸시알림', '모바일화면', '스마트폰', 'screenshot'],
    equivalents: ['스크린샷', '캡처', '화면캡처', 'screenshot'],
    parents: ['스크린샷', '캡처', '화면', '휴대폰'],
  },
  {
    id: 'object.cable_connector',
    category: 'object',
    triggers: ['케이블', '단자', '커넥터', '전선', '젠더', '어댑터', '충전기', 'dvi', 'hdmi', 'usb', 'cable', 'connector'],
    equivalents: ['케이블', '단자', '커넥터', '전선', 'dvi', 'cable'],
    parents: ['케이블', '단자', '부품', '전자기기', '작업대', '사물'],
  },
  {
    id: 'object.lamp_bulb',
    category: 'object',
    triggers: ['형광등', '램프', 'uv램프', '자외선', '전구', '조명기구', '네온', 'lamp'],
    equivalents: ['형광등', '램프', 'uv램프', '자외선', '조명기구', 'lamp'],
    parents: ['형광등', '램프', '부품', '조명', '작업대', '사물'],
  },
  {
    id: 'object.fan_appliance',
    category: 'object',
    triggers: ['선풍기', '휴대용선풍기', '손선풍기', 'fan'],
    equivalents: ['선풍기', 'fan'],
    parents: ['선풍기', '가전', '사물'],
  },
  {
    id: 'quality.blurry',
    category: 'object',
    triggers: ['흔들린', '흐릿', '흐릿한', '블러', '초점', '오촬영', 'blurry'],
    equivalents: ['흔들린', '흐릿', '블러', '초점', '오촬영', 'blurry'],
    parents: ['흔들린', '블러', '오촬영'],
  },

  // ============================================================================
  // 11. 대한민국 & 해외 행정구역 지명 계층 족보 (Administrative Geography Hierarchy)
  // ============================================================================
  {
    id: 'geo.malaysia_kotakinabalu',
    category: 'location',
    triggers: ['코타키나발루', '말레이시아', '수트라하버', '탄중아루', '마무틱섬', '사피섬', '카람분나이', '카와카와', '사바'],
    equivalents: ['코타키나발루', '말레이시아'],
    parents: ['코타키나발루', '말레이시아', '동남아', '해외', '해외여행', '여행', '휴양지'],
  },
  {
    id: 'geo.gangwon_sokcho',
    category: 'location',
    triggers: ['속초', '속초시', '영랑호', '등대해수욕장', '장사항', '속초해수욕장', '영금정', '동명항'],
    equivalents: ['속초', '속초시'],
    parents: ['속초', '강원도', '강원', '동해', '동해안', '국내여행', '여행'],
  },
  {
    id: 'geo.seoul_yeouido',
    category: 'location',
    triggers: ['여의도', '여의도한강공원', '영등포', '영등포구'],
    equivalents: ['여의도', '여의도한강공원', '한강공원'],
    parents: ['여의도', '한강', '한강공원', '영등포', '서울', '서울시', '수도권'],
  },
  {
    id: 'geo.seoul_yongsan',
    category: 'location',
    triggers: ['용산', '용산구', '이촌동', '국립중앙박물관'],
    equivalents: ['용산', '용산구', '국립중앙박물관'],
    parents: ['용산', '서울', '서울시', '수도권'],
  },
  {
    id: 'geo.seoul_jongno_junggu',
    category: 'location',
    triggers: ['종로', '종로구', '을지로', '중구', '청계천', '광장시장'],
    equivalents: ['종로', '을지로', '청계천', '광장시장'],
    parents: ['종로', '을지로', '중구', '서울', '서울시', '수도권'],
  },
  {
    id: 'geo.incheon_cheongna',
    category: 'location',
    triggers: ['청라', '청라동', '청라국제도시'],
    equivalents: ['청라', '청라동', '청라국제도시'],
    parents: ['청라', '서구', '인천', '인천시', '수도권'],
  },
  {
    id: 'geo.incheon_bupyeong',
    category: 'location',
    triggers: ['부평', '부평구', '삼산동'],
    equivalents: ['부평', '부평구', '삼산동'],
    parents: ['부평', '인천', '인천시', '수도권'],
  },
  {
    id: 'geo.incheon_airport_yeongjong',
    category: 'location',
    triggers: ['인천공항', '인천국제공항', '영종도', '운서동'],
    equivalents: ['인천공항', '인천국제공항', '영종도', '공항'],
    parents: ['인천공항', '영종도', '공항', '인천', '인천시', '수도권', '여행'],
  },
  {
    id: 'geo.gyeonggi_goyang',
    category: 'location',
    triggers: ['고양', '고양시', '삼송', '삼송동', '일산'],
    equivalents: ['고양', '고양시', '삼송', '일산'],
    parents: ['고양', '삼송', '일산', '경기도', '경기', '수도권'],
  },
];

// 전체 고유 어휘 수 집계
const allUniqueTerms = new Set();
for (const n of ONTOLOGY_TREE) {
  for (const t of n.triggers) allUniqueTerms.add(t.toLowerCase());
  for (const e of n.equivalents) allUniqueTerms.add(e.toLowerCase());
  for (const p of n.parents) allUniqueTerms.add(p.toLowerCase());
}

// 1. 표준 온톨로지 파일 저장
fs.mkdirSync(path.dirname(ONTOLOGY_OUT_PATH), { recursive: true });
const ontologyPayload = {
  version: '2.2.0-wordnet-openimages-ko',
  updatedAt: new Date().toISOString(),
  description: 'Open Multilingual WordNet (OMW-ko) + Google Open Images V7 Hierarchy + 한국인 갤러리 상·하위 개념 족보 트리',
  nodeCount: ONTOLOGY_TREE.length,
  totalVocabularyCount: allUniqueTerms.size,
  nodes: ONTOLOGY_TREE,
};
fs.writeFileSync(ONTOLOGY_OUT_PATH, JSON.stringify(ontologyPayload, null, 2), 'utf-8');
console.log(
  `[1/2] 한국어 사진 개념 족보 트리 저장 완료: ${ONTOLOGY_OUT_PATH} (노드 ${ONTOLOGY_TREE.length}개, 등록 어휘 ${allUniqueTerms.size}개)`
);

const KEEP_STEM_WORDS = new Set([
  '아이', '어린이', '바닷가', '창가', '물가', '길가', '목걸이', '귀걸이', '물놀이', '나들이', '비행기', '종로', '을지로',
]);
const KO_PARTICLE_RX =
  /(?:들)?(?:에서부터|으로부터|에게서|에서|에게|으로|이랑|하고|부터|까지|처럼|보다|마다|대로|밖에|마저|조차|이나|이란|이고|이며|하는|있는|없는|되는|했던|하던|해서|하며|된|한|할|님|씨|이|가|은|는|을|를|의|에|로|와|과|랑|도|만|나|란|다)$/;
const LOAN_TAILS = /^(이크|패드|디어|라인|스크림|언맨|사이트|이드|이즈|이트)$/;

function extractKoStems(text) {
  const eojeols = String(text || '')
    .toLowerCase()
    .replace(/[^가-힣a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const stems = new Set();
  for (const raw of eojeols) {
    if (KEEP_STEM_WORDS.has(raw)) {
      stems.add(raw);
      continue;
    }
    const next = raw.replace(KO_PARTICLE_RX, '');
    stems.add(next && next.length >= 1 ? next : raw);
  }
  return Array.from(stems);
}

function matchKoTokenInStems(token, stems, rawText) {
  const tk = token.toLowerCase().trim();
  for (const st of stems) {
    if (st === tk) return true;
    if (tk.length === 1) continue;
    if (tk.length === 2) {
      if (st.startsWith(tk)) {
        const rem = st.slice(tk.length);
        if (rem.length >= 2 && !LOAN_TAILS.test(rem)) return true;
      }
      if (st.endsWith(tk)) {
        const rem = st.slice(0, st.length - tk.length);
        if (rem.length >= 2) return true;
      }
      continue;
    }
    if (st.includes(tk)) return true;
  }
  if (tk.length >= 3 && rawText) {
    const noSpace = rawText.toLowerCase().replace(/\s+/g, '');
    if (noSpace.includes(tk.replace(/\s+/g, ''))) return true;
  }
  return false;
}

// 2. 550장 사진 인덱스에 인덱싱 시점 상·하위어 자동 상속(Ontology Inheritance) 실행
if (fs.existsSync(SEMANTIC_INDEX_PATH)) {
  const indexData = JSON.parse(fs.readFileSync(SEMANTIC_INDEX_PATH, 'utf-8'));
  const photos = indexData.photos || {};
  let updatedCount = 0;

  for (const [, meta] of Object.entries(photos)) {
    const visualTagAndKw = `${meta.primaryTag || ''} ${(meta.keywordsKo || []).join(' ')}`.toLowerCase();
    const locTagAndKw = `${meta.locationTag || ''} ${meta.locationKo || ''} ${(meta.locationKeywords || []).join(' ')}`.toLowerCase();
    const rawCaption = `${meta.captionKo || ''} ${meta.captionEn || ''}`.toLowerCase();

    const visualStems = extractKoStems(visualTagAndKw);
    const visualAndLocStems = extractKoStems(`${visualTagAndKw} ${locTagAndKw}`);
    const captionStems = extractKoStems(rawCaption);

    const primaryConceptTags = new Set();
    const captionConceptTags = new Set();

    // 원본 태그/키워드/지명 토큰 기본 등록
    for (const kw of meta.keywordsKo || []) {
      if (kw && kw.trim()) primaryConceptTags.add(kw.trim().toLowerCase());
    }
    for (const lkw of meta.locationKeywords || []) {
      if (lkw && lkw.trim()) primaryConceptTags.add(lkw.trim().toLowerCase());
    }
    if (meta.primaryTag) {
      for (const part of String(meta.primaryTag).replace(/^#/, '').split(/[·/\s,]+/)) {
        if (part.trim()) primaryConceptTags.add(part.trim().toLowerCase());
      }
    }

    // 온톨로지 트리를 순회하며 형태소 어간(Stem) 및 복합명사 경계 규칙으로 검출 -> 동의어 + 상위 개념 자동 상속!
    for (const node of ONTOLOGY_TREE) {
      const targetTagText = node.category === 'location' ? `${visualTagAndKw} ${locTagAndKw}` : visualTagAndKw;
      const targetTagStems = node.category === 'location' ? visualAndLocStems : visualStems;

      const matchedTriggersInTag = [];
      const matchedTriggersInCap = [];

      for (const trig of node.triggers) {
        const t = trig.toLowerCase();
        if (t.length < 2) continue;
        if (matchKoTokenInStems(t, targetTagStems, targetTagText)) {
          matchedTriggersInTag.push(t);
        } else if (matchKoTokenInStems(t, captionStems, rawCaption)) {
          matchedTriggersInCap.push(t);
        }
      }

      if (matchedTriggersInTag.length > 0) {
        for (const mt of matchedTriggersInTag) primaryConceptTags.add(mt);
        for (const eq of node.equivalents) primaryConceptTags.add(eq.toLowerCase());
        for (const parent of node.parents) primaryConceptTags.add(parent.toLowerCase());
      } else if (matchedTriggersInCap.length > 0) {
        for (const mt of matchedTriggersInCap) captionConceptTags.add(mt);
        for (const eq of node.equivalents) captionConceptTags.add(eq.toLowerCase());
        for (const parent of node.parents) captionConceptTags.add(parent.toLowerCase());
      }
    }

    meta.ontologyPrimaryTags = Array.from(primaryConceptTags);
    meta.ontologyCaptionTags = Array.from(captionConceptTags);
    updatedCount++;
  }

  indexData.ontologyVersion = ontologyPayload.version;
  indexData.ontologyUpdatedAt = ontologyPayload.updatedAt;
  fs.writeFileSync(SEMANTIC_INDEX_PATH, JSON.stringify(indexData, null, 2), 'utf-8');
  console.log(`[2/2] 550장 사진 인덱스에 상·하위 족보 태그 자동 상속 완료: ${updatedCount}장 업데이트됨.`);
}
