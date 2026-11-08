# 📋 귀신같이 (Ghosti) 세션 릴레이 인계장 (`SESSION_HANDOVER.md`)

---

## 🕒 [2026-11-09 00:20 KST 체크아웃 인계 기록]

- **세션 제목**: 귀신3총사v1.3완결

### 1. 이번 세션에서 완료한 핵심 작업 요약
1. **[귀신 3총사 v1.3 대개편 전 항목(12/12) 100% 구현·검증·배포 완결]** (commits `3de63d9` ~ `07e8d80`):
   - **좌측 무료 4대 핵심 메뉴 개편**: `👻 귀신비서` (1관문: 손보기·복원·귀신계 여권 + 전사 대표 슬로건 부제 상시 노출) ➔ `👻 귀신검색` (2관문: 웹 검색 입력창 폐지 ➔ STEP1 소환술 3단 + STEP2 도장깨기 게임 + 3단 변신 로컬 귀신검색창) ➔ `⚡ 귀신창 초능력` (3관문: `4분 30초` ROI 배너 + 9종 초능력 상시 연습장 + 30일 무제한 체험 명시적 동의) ➔ `📸 사진 공유` (4관문).
   - **👻 귀신비서 & 마스터 대본집(`src/data/ghost_secretary_playbook.json` v1.3.1)**:
     - 첫인사 별명 등록(`ask_nickname_first` ➔ `🪪 귀신계 여권(나)` 자동 각인) + JS 실측(시간대·해상도·CPU 코어·배터리) 기반 매운맛 콜드리딩 점괘(`ghostSecretaryEngine.ts`).
     - 부품 구매처/쇼핑몰 링크 요구 시 절대 거절 및 외부 AI 바톤터치 방어, 급한 유저 채팅 응대(스킵 버튼 없음), 홀림 세팅 퀘스트 3종, Wave 2~4 로드맵 희망 답변, 영역 ⑦ 보안·요금·환불 FAQ 3종(손보기 명령어 가로채기 방지 가드 포함), 미등록 질문(`unmatched_questions`) 자동 포집.
     - 귀신비서 채팅에서 파일·사진 검색 요청(`onJumpToSearch`) 시 `👻 귀신검색` 탭 이동과 동시에 중형 귀신검색창(`?preview=legacy&ghostSearchWindow=medium&q=...`)이 즉시 열려 검색 결과가 바로 노출되도록 직결(`41d2092`).
   - **🪪 귀신계 여권 (관계도 꼬리표 폐지 & 실명 원칙 & 모바일 징검다리 스캔 & Supabase Production 적용 완료)**:
     - 관계도 꼬리표(`와이프`, `아들`, `처남(민수)` 등) 및 관계 칩 버튼을 전면 폐지하고, 데모 데이터의 `roomPersonas`까지 실제 이름(`백은숙`, `한치우`, `한지우`, `한천우`, `한민수`, `박준호` / 본인만 별명 `'멀린'` + 실명 `'한진욱'` 세트)으로 100% 통일(`07e8d80`).
     - 모바일 단독(무료) 환경에서 `executeMobileSteppingStoneScan`(`nextMobileScanWindow`: `100 ➔ 300 ➔ 500장`) 징검다리 스캔 루프를 스토어 스캔 진입(`useSaySeeStore.startOnboardingIndexing`) 및 여권 진입(`MonsterStandardChatColumn.tsx`)에 직결하고, 1차 여권 발급 직후 남은 옛날 사진 스캔 시점(`"지금 천천히 돌려줘 (30분 뒤 안내)"` vs `"저녁에 쉴 때 조용히 해줘"`) 선택권을 자동 제안하도록 완결(`07e8d80`).
     - `supabase/ghosti_zero_cloud_schema.sql` 하단 `ghost_passports`(128차원 얼굴 벡터 + 10KB 미니 썸네일 포함) 및 `unmatched_questions` DDL을 멀린님께서 Supabase Production SQL Editor에서 직접 실행 완료(`Success. No rows returned`).
   - **👻 귀신검색창 3단 변신 (`small 520×380` / `medium 960×640` / `large 1440×900`) & 데몬 프레임리스 팝업 동기화**:
     - 기존 웹 `찾기`(`?preview=legacy`) UI·기능·버튼을 100% 그대로 승계하는 `?ghostSearchWindow=small|medium|large` 전용 프레임리스 라우트 구축(`da929da`).
     - 비서실 정본 `universal_z_core/seq_paste_daemon.py`(`build_ghost_search_window_url`, `_open_ghost_search_window_popup`, 30일 쿼터 주석·출력 통일) 동기화 및 `--test-quota` (`ALL PASS`) 확인.
   - **⚡ 원패스 스캔 성능 등급 분류 (`scanPerformanceTier.ts` & `plugin_ghosti_os.py`)**:
     - 저사양(`코어 <= 4 OR RAM <= 8GB OR HDD`) vs 고성능(`코어 >= 6 AND RAM > 8GB AND SSD`, Windows `DeviceIoControl` `StorageDeviceSeekPenaltyProperty` 0.01초 판정) 분기 및 500MB 메모리 상한 안전망 유지.
2. **[노션 QA 2-Track 운영 명세 수립 & 기존 알바생 미션 카드 6건 등록·정비 완료]**:
   - 11월 16일 합류 예정 신규 요원(한소희님, `[UX]`)과 기존 요원(해나라/조은호님, `[로직]`) 2-Track 운영 명세서(`docs/GHOSTI_QA_TWO_TRACK_OPERATION_SPEC.md`) 및 전사 온보딩 앱 소개 가이드(`D:\Secretary\docs\파트_1\Ghosti_귀신같이\GHOSTI_APP_INTRO_AND_VISION_GUIDE.md`) 작성 완료.
   - 노션 `[테스트 미션]` 컬럼의 귀신같이 카드 6건(`411f9ffd...`, `412f9ffd...` 5종)을 v1.3 최신 메뉴명·체크리스트로 업데이트하고 기존 카드 4건에 v1.3 메뉴 이동 안내 콜아웃을 추가 완료.

### 2. 다음 세션 최우선 인계 사항 (Next Action)
1. **노션 QA 테스터(해나라님) v1.3 미션 검증 모니터링**:
   - `[발견된 버그]` 컬럼으로 이동하는 카드가 발생하는 즉시 단품 완결(Single-Piece Flow)로 패치·검증 후 `[재테스트 대기]`로 반환.
2. **실시간 감시병(`python z_core_watcher.py --watch`, `IsDaemon=true`) 단일 유지**.
