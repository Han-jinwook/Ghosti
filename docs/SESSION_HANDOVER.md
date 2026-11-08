# 📋 귀신같이 (Ghosti) 세션 릴레이 인계장 (`SESSION_HANDOVER.md`)

---

## 🕒 [2026-11-09 01:05 KST 체크아웃 인계 기록]

- **세션 제목**: 전환율4대핀셋보강완결

### 1. 이번 세션에서 완료한 핵심 작업 요약
1. **[전환율 4대 핀셋 보강 (공문 `20261109_0046`) 100% 무인 구현·검증·배포 완결]**:
   - **🚫 3대 엄금 원칙 철저 준수**:
     1) 별명/채팅 단계에 원터치 추천 알약(`Quick-Reply Chip`) 추가 금지 (직접 타이핑·음성 대화 감성 유지).
     2) 첫날 온보딩 풀코스(`별명 ➔ 매운맛 점괘·손보기 ➔ 홀림 퀘스트 ➔ 귀신계 여권 ➔ 귀신검색`) 3턴 압축 및 `🪪 귀신계 여권` 뒤로 미루기 금지 (원패스 스텔스 인덱싱 시간 확보 및 인물 검색 감동 유지).
     3) 설치 전 드래그 앤 드롭 1장 맛보기 박스 추가 금지.
   - **① 설치 모달 『브라우저 우측 상단 화살표 오버레이 + 솔직·명쾌한 2단계 안내』 (`src/components/MerlinZCoreGuideModal.tsx`)**:
     - `step === 'waiting_engine'` 진입 시 화면 우측 최상단(`fixed top-4 right-6 z-[140]`)에 브라우저 다운로드 영역을 가리키는 애니메이션 배너(`👆 우측 상단 다운로드 창에서 [열기] ➔ [Merlin_Z_Core_Setup.exe] 실행(더블클릭)까지 딱 한 번만 해주세요!`)와 `① 우측 상단 다운로드 파일 열기(압축 풀기) ➔ ② 폴더 안의 Merlin_Z_Core_Setup.exe 더블클릭 실행` 2단계 1줄 안내를 선명하게 표시하고, `127.0.0.1:5199` 하트비트 감지 즉시 화살표 배너 자동 소멸 및 환영 토스트 출력.
   - **② 엔진 연결 완료 시 『가짜 웹 시뮬레이터 ➔ 진짜 로컬 👻 귀신검색창 즉시 팝업』 직결 (`universal_z_core/os_agent/seq_paste_daemon.py`, `plugin_ghosti_superpowers.py`, `merlin_z_core_daemon.py`, `src/components/ghostDojo/GhostSearchTrainingPage.tsx`)**:
     - `universal_z_core/seq_paste_daemon.py` 정본을 `universal_z_core/os_agent/seq_paste_daemon.py`에 동기화하고, `plugin_ghosti_superpowers.py`에 `open_ghost_search_window_api` 추가 및 30일 타이머(`ACTIVE_30D`, `days=30`) 전면 통일.
     - `merlin_z_core_daemon.py`(포트 5199)에 `GET/POST /__merlin/open-ghost-search` 및 `/api/superpower/open_search_window` 엔드포인트 개통.
     - `GhostSearchTrainingPage.tsx`에서 `connected === true`일 때 `Ctrl + 0`, `우클릭 꾹~`, 또는 `[👻 내 진짜 파일로 리얼 귀신검색창 바로 띄우기]` 클릭 시 실제 모니터 위에 프레임리스 로컬 `👻 귀신검색창`이 즉시 팝업되도록 직결 (미연결 시에만 웹 가상 모니터 시뮬레이터 폴백).
   - **③ 모바일 온보딩 말미 『모바일 ➔ PC 회수 브릿지 (카톡 나에게 PC 링크 보내기 / 주소 복사)』 (`src/services/ghostSecretaryEngine.ts`, `src/components/MonsterStandardChatColumn.tsx`)**:
     - 모바일 온보딩 대화 말미에 `buildMobileToPcBridgePrompt` 안내 멘트와 `[💬 카톡(나에게 보내기)에 PC 실행 링크 넣어두기 / 📋 주소 복사]` 버튼을 노출하여 `useSaySeeStore.getState().sharePcMasterUrlToKakao()`와 직결.
   - **④ 『🪪 귀신계 여권 발급 완료 ➔ 가족 사진 카톡방 1초 구경시켜 주기』 주력 바이럴 연결 + 보조 PC 점괘·청소 카드 저장/공유 (`src/services/ghostSecretaryEngine.ts`, `src/components/MonsterStandardChatColumn.tsx`, `src/components/MonsterInteractiveCards.tsx`)**:
     - `🪪 귀신계 여권`에 가족 실명(예: `한치우`) 등록 직후 *"방금 찾아낸 『한치우』 사진들을 가족 카톡방에 로그인 없이 1초 만에 구경시켜 드릴까요?"* 제안 및 `[👨‍👩‍👧‍👦 방금 찾아낸 『한치우』 사진 가족 카톡방에 1초 구경시켜 주기]` 원클릭 액션(가족 사진방 전환 + `?preview=guest` 1초 미리보기 링크 공유/복사) 직결.
     - PC 손보기 완료 카드(`healthRecordIssued`) 우측 하단에 은은한 `[📋 내 PC 점괘·청소 결과 카드 저장/공유]` 버튼 탑재.
2. **[이전 완료 사항 — 귀신 3총사 v1.3 전 항목(12/12) & 노션 QA 미션 6건 정비 완료]**:
   - 데모 `roomPersonas` 전면 실명화(`백은숙`, `한치우`, `한지우`, `한천우`, `한민수`, `박준호` / 본인 `'멀린'`+`'한진욱'`), 모바일 `100 ➔ 300 ➔ 500장` 징검다리 스캔 루프 직결, Supabase Production `ghost_passports`·`unmatched_questions` 직접 적용 완료.

### 2. 다음 세션 최우선 인계 사항 (Next Action)
1. **노션 QA 테스터(해나라님) v1.3 & 전환율 4대 보강 미션 검증 모니터링**:
   - `[발견된 버그]` 컬럼으로 이동하는 카드가 발생하는 즉시 단품 완결(Single-Piece Flow)로 패치·검증 후 `[재테스트 대기]`로 반환.
2. **체크인 시 실시간 감시병(`python z_core_watcher.py --watch`, `IsDaemon=true`) 단일 기동**.
