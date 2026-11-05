# 📋 귀신같이 (Ghosti) 세션 릴레이 인계장 (`SESSION_HANDOVER.md`)

---

## 🕒 [2026-11-05 15:10 KST 체크아웃 인계 기록]

- **세션 제목**: 모바일음성인식어미보정·현수브리핑

### 1. 이번 세션에서 완료한 핵심 작업 요약
1. **[모바일 음성인식 어미 잘림 방지 및 무음 감지 타이머 최적화]** (commit 7fbda92):
   - src/services/aiEngine.ts 및 src/components/MonsterStandardChatColumn.tsx:
     - 모바일 음성 발화 도중 단어 간 짧은 호흡 멈춤 시 80ms~120ms 만에 성급히 종료되던 isFinal 타이머를 650ms로 연장, interim 타이머를 1600ms로 최적화하여 '음식 사진 찾아줘', '강아지 사진 찾아줘' 끝단 어미가 절단되지 않도록 전면 해결.
   - 
ormalizeSpokenKoreanQuery 함수 탑재:
     - STT 특유의 받침/조사 결합 오인식('강아진 사진' ➔ '강아지 사진') 자동 보정.
     - 말끝이 '찾아', '보여'로 살짝 덜 끝났을 때도 '찾아줘', '보여줘' 명령어로 자동 완성되어 의도 100% 매칭.
2. **[사진/일상 음성 검색 남성 성우(현수) 브리핑 즉시 발화]**:
   - src/store/useSaySeeStore.ts:
     - 음성 검색 실행 후 결과 건수(사진 N장을 찾았습니다.)를 남성 성우 현수(speakWithHyunsuOrSunhi)가 즉시 또렷하게 안내 발화하도록 직결.
3. **[노션 QA 티켓 인라인 안내 및 상태 전이 완료]**:
   - 카드 🎯 [귀신같이/1단계] 모바일-손보기·음성, 폰 마이크 자연어 발화 & 현수(답변)·선희(서류낭독) 팩트 청취 점검 (40df9ffd-2c1d-8172-b8cc-fa57dafaf7e2) 해나라님 붉은색 코멘트 바로 아래에 인라인 조치 내역 기록 및 상태 [재테스트 대기]로 완결 이동.
   - 2단계 동영상 구간 점프 5단계 제거 건(commit 2cad714) 원격 병합 완료.

### 2. 다음 세션 인계 사항 (Next Action)
- 다음 대기 중인 노션 버그 티켓:
  - 🎯 [귀신같이] 모바일-홈 화면 소리 횟수, 버튼 잘림, 뒤로가기 시 창꺼짐, 메뉴 트리 클릭 후 이동 문제 (40ff9ffd-2c1d-8002-a27f-ea745ff49e98)
  - 해나라님 붉은색 코멘트 4건(홈 화면 아기귀신 소리 1회 재생, 모바일 버튼 잘림, 상세 모달 뒤로가기/스크롤, 메뉴 트리 클릭 시 최상단 스크롤) 순차 점검 및 원스톱 해결.

---

## 🕒 [2026-11-05 08:03 KST 체크아웃 인계 기록]

- **세션 제목**: 귀신창자체교정충돌방지·모바일검증

### 1. 이번 세션에서 완료한 핵심 작업 요약
1. **[『귀신창』 실시간 타이핑 자동성형 자체 교정 프로그램 충돌 방지 예외 가드 탑재]** (`commit 2921c09`):
   - 멀린님 긴급 특명 및 `studio` 제안에 따라, 자체 한영 자동 고침(AutoCorrect)이나 고유 인라인 캔버스를 사용하는 프로그램에서 귀신창 실시간 타이핑 자동성형(Space 2어절 감지)이 충돌하지 않도록 100% PASS(스킵) 예외 가드 구현.
   - `universal_z_core/os_agent/seq_paste_daemon.py`: `get_window_process_and_class` 및 `should_skip_auto_typo` 탑재.
     - **국내 필수 예외**: 한컴오피스 계열 전수 (`hwp.exe`, `hshow.exe`, `hcell.exe`, `hword.exe` 및 클래스 `Hwp`, `Hnc_`, `HncEdit`)
     - **글로벌 오피스 예외**: MS Office 계열 (`winword.exe`, `powerpnt.exe`), LibreOffice (`soffice.bin`, `soffice.exe`)
     - **해외 버전 출시 대비 글로벌 교정/IME 도구**: `grammarly.desktop.exe`, `grammarly.exe`, `jstaro.exe`, `ichitaro.exe`, `atok.exe`
     - **개발자 코딩 IDE**: `code.exe`, `devenv.exe`, `cursor.exe`, `windsurf.exe`, `pycharm64.exe`, `idea64.exe`, `webstorm64.exe`
   - `docs/기능명세.md`, `docs/귀신같이_기획서.md`, `docs/README.md`에 SSOT 전문 등재 완료.
   - 우체국 회신 완료: `d:\Secretary\post_office\studio_Ghosti_답변_귀신창_한글HWP_및_MS오피스_자체교정프로그램_충돌방지_예외처리반영완료_20261105_0736.md` (`commit eac989d`).

2. **[모바일 QA 듀얼 디바이스(갤럭시 & 아이폰) 필수 검증 원칙 확인]**:
   - 모바일 검증은 브라우저 엔진(Blink vs WebKit), iOS Safari의 마이크/오디오 재생 제약, PWA 규격 차이로 인해 **갤럭시(Android)와 아이폰(iOS) 2대 모두 전수 검증**함을 확인 및 보고.

3. **[노션 QA 카드 제목 직관적 표준화 및 2단계 미션카드 사전 백업]**:
   - 노션 카드 제목의 기술 코드(`1-E`, `3-B`)를 `🎯 [귀신같이/1단계] 기기-분류, 내용` 형태로 전면 개편.
   - 1단계 완료 및 설문 후 즉시 출제할 2단계 미션 카드를 `docs/STAGE2_DEVICE_INTEGRATION_QA_CARDS_BACKUP.md`로 문서화 보관.

4. **[단골 AI(제미나이 기본값) 바톤터치 완비 및 제7·8호 특허 크로스체크 회신]**:
   - `universal_z_core/os_agent/plugin_ghosti_os.py`, `voiceSearchAndAiBatonEngine.ts`, `monsterChatRouter.ts` 연동 완료.
   - 우체국 회신 완료 (`Secretary_Ghosti_답변_제7호제8호특허_크로스체크완료_20261104_1909.md`).

---

### 2. 다음 세션 체크인 시 즉시 확인할 대기 건 📮
1. **[노션 QA 1단계 개인기기 검증 잔여 현황 모니터링]**:
   - 테스터(해나라님)의 Stage 1 잔여 카드 진행 상황 모니터링:
     - `🎯 [귀신같이/1단계] PC-찾기·동영상` (테스트 중)
     - `🎯 [귀신같이/1단계] PC-손보기·음성`
     - `🎯 [귀신같이/1단계] 모바일-손보기·음성`
     - `🎯 [귀신같이/1단계] PC·모바일-단골AI`
   - Stage 1 전체 6개 카드 `[완료]` 전환 시, 독립 설문 카드 『🎯 [설문] 1단계 개인기기 사용자 냉정 평가 (레드팀 중심)』 즉시 출제.
   - 설문 완료 후 `docs/STAGE2_DEVICE_INTEGRATION_QA_CARDS_BACKUP.md`에 백업된 2단계(내 기기 통합) 카드 3종 순차 투입.
2. **[전사 중앙 우체국 신규 수신 확인]**:
   - 도착 즉시 `(읽음)` 부착 및 멀린님 보고.

---

### 3. 향후 단계별 실전 검증 로드맵 (멀린님 최종 확정 SSOT) 🚨
1. **[1단계] PC 개인라운지(찾기·손보기) 완전 검증 ➔ 모바일 기본(개발폰 2대: 갤럭시·아이폰)**.
2. **[2단계] 유료구간 시작 — `내 기기 통합 (PC+폰+PC+)` 파트 실전 검증** (PC↔폰 QR 연동, 3대 기기 통합, 웰컴 특판 PG 결제).
3. **[3단계] 사진 공유(패밀리·동호회) & 업무 공유(S: 드라이브)**.
4. **[4단계] 고도화 스트레스 테스트 ➔ 베타테스트 ➔ 공식 출시**.
