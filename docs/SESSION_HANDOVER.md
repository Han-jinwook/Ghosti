# 📋 귀신같이 (Ghosti) 1~4귀신 통합 세션 인계장 (`SESSION_HANDOVER.md` — 자동 합본)

> ⚠️ **[자동 합본 안내 — 직접 수정 금지]**: 본 파일은 `z_core_watcher.py`가 `SESSION_HANDOVER_1.md` ~ `SESSION_HANDOVER_4.md` 4개 파일을 기계적으로 이어붙여 생성합니다. 체크아웃 시 각 창은 **오직 자기 번호 파일(`docs/SESSION_HANDOVER_N.md`)만 수정**하세요.

---

# 🟢 `[1귀신]` 세션 인계장 (`SESSION_HANDOVER_1.md` — 온보딩 · 귀신비서 · 여권)

- **최종 갱신 일시**: 2026-11-25 01:46 (KST)
- **담당 역할**: `[1귀신]` (온보딩 · 귀신비서 · 사진 정리 · 얼굴 여권)
- **세션 창 제목**: `1귀신 여권4대기획·전영역FAQ`

## 완료 내역 (2026-11-24 ~ 11-25)
1. **가족 여권 인물 누락 버그(`422f9ffd-2c1d-805b-a957-dcbfbb1171b4`) 해결 및 기획서 누락 4대 여권 스펙 100% 완결 (`8728ac7`, `5f7ab52`)**
   - **연도별 층화 샘플링 & 단체사진 검출 강화**: `selectStratifiedFaceScanCandidates`(`MAX_SCAN_PHOTOS = 260`), 파일명 촬영일(`YYYYMMDD`·13자리 Unix epoch) 최우선 파싱, `MIN_PASSPORT_FACE_PX = 19`, 사진당 NMS 상한 `12명`, 후보 `MAX_CLUSTERS = 18` / `MAX_FACES = 12` 상향 및 20장 조기 방출 제거로 4호기 실데이터(1,772장)에서 가족 전원이 후보로 노출되도록 해결 후 `'재테스트 대기'` 전환 완료.
   - **기획서 4대 여권 스펙 완전 구현**: ① **Pass 2 시공간 연속성 + 동반 등장 가족 맥락 족쇄**(선글라스·모자·측면 클러스터가 `Cannot-Link` 0건 + 확정 가족 동반 등장/동일 촬영일 + `cent >= 0.34` & `top3 >= 0.44` 충족 시 맨얼굴 여권으로 자동 흡수), ② **5대 스타일 슬롯(`정면·선명`, `측면·미소`, `야외·노을`, `선글라스·역광`, `야간·실내`) 광학 실측 분류 및 연령 바구니(`성인 10년` / `미성년 5년`) 태깅**, ③ **Supabase `ghost_passports` 128D 벡터 온전 업로드 및 기기 간 자동 매칭(`reconcileCloudPassportsWithFaceClusters`, `cosine >= 0.44`)**, ④ **본인(`self`) `[실명 + 프로필 별명]` 검색 바인딩 영구 유지 및 `docs/기능명세.md` In-Place 현행화**.
2. **전 영역(`1·2·3·4귀신`) 귀신비서 FAQ 마스터 원본(`docs/귀신비서_FAQ_원본.md` v2.0, 28문 28답) 신설 및 0토큰 즉답·LLM 프롬프트 3중 탑재 (`5f7ab52`, `e221ab3`)**
   - `docs/귀신비서_FAQ_원본.md` 신설 및 `docs/README.md` `08-B` 등록, `ghostSecretaryEngine.ts` `matchAllDomainGhostiFaq()` 0토큰 즉답 매처 + `ghost_secretary_playbook.json`(`v1.3.6`) + `monsterChatRouter.ts` LLM 시스템 프롬프트 주입 및 로컬 폴더 정리 오인식 가드 적용, `Ghosti4` 우체국 회신 2건 완결.
3. **`1귀신` 100% 커버리지 노션 미션 카드 12장 + 해나라·달나라 긴급 필독 미션 카드 2장 출제 및 `담당(해나라/달나라)` 체계 전환 (`ec446fb`)**
   - `notion_qa.py`에서 `[UX]`/`[로직]` 말머리를 폐지하고 `"담당"` 속성을 `1·2귀신(🟢) = 해나라`, `3·4귀신(🟣) = 달나라`로 자동 매핑하도록 개편.
   - 테스터가 모든 미션 테스트 중 궁금한 점을 `[1. 👻 귀신비서]` 화면의 **우측 귀신비서 채팅창**에 먼저 질문하고, 엉뚱한 답변이 나오면 `[질문 + 답변 화면]`을 캡처해 `[1귀신]` 수신자로 버그 신고하도록 해나라(`422f9ffd-2c1d-8175-aaca-fef2a60d329a`)·달나라(`422f9ffd-2c1d-8130-b97f-e88edf9c3efa`) 긴급 필독 미션 카드 각 1장씩 출제 완료.

## 다음 체크인 Todo
- [ ] **테스터 귀신비서 질문/답변 캡처 버그(`[1귀신]`) 실시간 대응**: 명백한 FAQ·프롬프트 누락 건은 `docs/귀신비서_FAQ_원본.md` + `ghostSecretaryEngine.ts` + `monsterChatRouter.ts` 즉시 보강 후 `'재테스트 대기'` 전환, 애매한 사안(비서 역량 밖 우회 분기 vs 정공법 기능 해결)은 즉시 `🚨`로 멀린님께 상의.
- [ ] **MS 코드서명 답장 확인 후 재서명**: 멀린님 답장 대기 중 (`Merlin_Z_Core_Setup.exe` 재서명 및 `z-core-latest` GitHub Release 동시 교체).

---

# 🔵 `[2귀신]` 세션 인계장 (`SESSION_HANDOVER_2.md` — 귀신검색 · 귀신창 · OCR · 라벨러)

- **최종 갱신 일시**: 2026-11-25 01:46 (KST)
- **담당 역할**: `[2귀신]` (귀신검색 · `Ctrl+0` 귀신창 · 사진/표 OCR · 귀신라벨링 · 동영상 재생)
- **공정 달성률**: 코드 완성도 **`100%`** (`Z-Core v2.7.72` / 커밋 `10eb694`) · 테스팅 완성도 **`76%`** (완료 17건 / 재테스트 대기 2건 / 미결 버그 0건 / 신규 미션 8건)
- **세션 창 제목**: `2귀신 코드100%·미션8건출제`

## 완료 내역
1. **안드로이드 네이티브 뒤로가기 앱 종료 방지 & 연사 묶음 전역 Union-Find 병합 (`52b06be`, 모바일 `v1.0.77`)**
   - `@capacitor/app` 미설치로 무동작하던 뒤로가기를 `MainActivity.java` `OnBackPressedCallback` ➔ `App.tsx` `window.__ghostiHandleNativeBack()` 직결로 해결.
   - `aiPhotoFaceEngine.ts` `groupBurstSearchResults`를 전역 Union-Find 병합(동일 `duplicateGroupId`·동일/근접 `dHash`·동일 파일명/용량·확장 멤버 교차 병합)으로 전면 교체해 배지 없는 중복 카드 분리 노출 제거.
2. **동영상 상세보기 자동 재생 복원 & 무복사 즉시 HTTP 206 스트리밍 (`d9c440c`, 모바일 `v1.0.78`)**
   - `MainActivity.java` `setMediaPlaybackRequiresUserGesture(false)` 해제 + 1ms 후미 `FileChannel` 프로브 무복사 HTTP 206 스트리밍(`180MB` 이하 강제 전체 복사 제거), `ghostiMobileCareBridge.ts` 12MB 초과 영상 통째 Blob 다운로드 제거, `VideoScenePreviewModal.tsx` 일반 재생(`0초`) 자동 재생 분리 및 웹 정책 차단 시 음소거 즉시 재생(`소리 켜기` 버튼) 적용.
3. **귀신라벨링 원본 EXIF 촬영일 우선 · 0.5초 초고속화 & 클립보드 경합 원천 차단 (`93a211a`, `236a5c6`, `167792a`)**
   - `aiSharedRuntime.ts`: 원본 JPEG 64KB 헤더 초고속 EXIF `DateTimeOriginal`/`DateTimeDigitized`(`0x9003`/`0x9004`, IFD0 수정일 `0x0132` 제외) 1순위 ➔ 파일명 촬영 타임스탬프 2순위 ➔ `dateStr` ➔ `mtimeMs` 최후 폴백으로 교정.
   - `proFeatureGate.ts` · `aiPhotoFaceEngine.ts` · `GhostLabelerActionButton.tsx`: 활성 Pro/체험 `0ms` 통과, OCR+캐시벡터 병렬 실행(중복 이미지 fetch 제거), 결과 메모이제이션, 연속 클릭 시 이전 요청 `AbortController` 즉시 중단(`0.95초` 상한), 브라우저 Clipboard `1ms` 우선 + 단조 `seq`/Z-코어 `Abort` 경합 차단.
4. **귀신검색 체험판 2단계 도장 오표시 제거 · 최소화 귀신검색창 복원 & 구버전 Z-코어 무한 열림 차단 (`a3dd0bb`, `4182b27`, `5a78972`, `1dacdb1`)**
   - `[귀신검색창 열기]` 단순 호출 시 `'작게 모드'` 도장이 오표시되던 로직을 제거하고 명시 전환 시에만 `markGhostDojoStep` SSOT 기록.
   - `DesktopDashboard.tsx`의 `open_search_window` 2.5초 하트비트 호출을 제거해 구버전 Z-코어(`<v2.7.53`) 무한 창 열림을 원천 차단하고, OS 창 타이틀 호환(`👻 귀신검색창`/`귀신검색창`)으로 최소화 창 즉시 전면 복원 보장.
5. **윈도우 10/11 공통 `Ctrl+0`/`Ctrl+우클릭` 선택 파일(`.jfif`·사진앱 포함) `[1]`번 고정 · `WH_MOUSE_LL` 0.01ms 무지연 훅 · 내장 하드 순차 렌더링 & USB/외장 볼륨 생애 1회 질문 · 사진 촬영일 최신순 정렬 (`cf5eace` ~ `48e34e9`)**
   - `seq_paste_daemon.py` · `ghost_search_window_ui2.py` · `plugin_ghosti_os.py`: 탐색기·바탕화면·사진앱 선택 파일 `[1]`번+우측 큰 미리보기 고정, `Ctrl+0` 키업 축소 차단, `Shell.Application` COM `0.45초` 워커 격리, 타이핑 중 요요 제거, 3단계 드라이브 정책(C: 즉시 ➔ 내장 D:~Z: 유휴 ➔ USB 생애 1회 질문·Read-Only 0바이트·로컬 `%LOCALAPPDATA%\Merlin\external_cache\<VOL_ID>` 격리·분리 시 즉시 숨김) 완결.
   - `aiPhotoFaceEngine.ts`: 귀신검색 전체 보기 사진 목록을 파일 복사일이 아닌 실제 촬영일(`canonicalDate`·`canonicalMtimeMs`, 13자리 Unix epoch ms 포함) 최신순 내림차순으로 일관 정렬 교정.
6. **웹 `2. 귀신검색` 외장 드라이브 배너 연동 · 30일 외장 캐시 GC (`10eb694`, 코드 100%) & 노션 100% 완주 미션 8건 출제**
   - `ExternalDrivePromptBanner.tsx` · `Stage1MinimalSearchPreview.tsx` · `merlin_z_core_daemon.py` (`GET /__zcore/external-drives`, `POST /__zcore/external-drives/decide`): 네이티브 UI2 배너와 1:1 동등 UX(유휴 0px·hidden 0폴링) + `_trigger_monthly_orphan_cache_gc_once()` 내 30일 미접속 외장 캐시 자동 정리 완결.
   - 노션 `[테스트 미션]` 신규 8건 출제 (USB 1/2·2/2, 윈도우10 실전, 모바일 `v1.0.78`, 100% 완주 1/4~4/4).

## 다음 체크인 Todo
- [ ] `python d:\Ghosti\z_core_watcher.py --watch --role 2` 기동 후 해나라님 재테스트 대기 2건(`귀신창 크기 요요` · `C드라이브 외 검색`) 및 신규 미션 8건 피드백/버그 즉시 대응 (테스팅 `76% ➔ 100%` 마감).

---

# 🟠 `[3귀신]` 세션 인계장 (`SESSION_HANDOVER_3.md` — 사진 공유 · 내 기기 통합 · 모바일 앱)

- **최종 갱신 일시**: 2026-11-25 01:46 (KST)
- **담당 역할**: `[3귀신]` (사진 공유 · 내 기기 통합 Pro · 모바일 웹 브릿지 · 양대 스토어 앱)
- **QA 담당 테스터**: **달나라님** (노션 `담당 = 달나라` 고정)
- **최신 모바일 빌드**: 양대 스토어 **`v1.0.90 (90)`** (`android/app/build.gradle`, Google Play Cloud · iOS TestFlight 발송 완료)
- **세션 창 제목**: `3귀신 14일초대·미션5건·v1.0.90`

## 완료 내역
1. **모바일 웹 = 온보딩 쇼룸 & 앱 이동 다리 전용 확정 (`f87b1b3`, `c11db33`, `6b9ef44`, `0797454`)**
   - PC(엔진 설치)와 설치된 모바일 정식 앱(Android/iOS)만 실사용 기기로 취급(`계정 + 설치된 앱 = 1대`), 모바일 웹 브라우저 기기 등록 원천 차단 및 기존 유령 모바일 웹 기기 자동 정리.
   - **전용 모바일 웹 브릿지 2종 구축 (`MobileQrPairBridgeOverlay.tsx`, `MobileShareInviteBridgeOverlay.tsx`):** QR 기기 통합 및 사진 공유방 초대 링크(`preview=guest` 포함) 접속 시 최상단 전용 브릿지 창으로 자동 앱 열기, 미설치 시 스토어 이동(Android `InstallReferrer` · iOS 클립보드 `GHOSTI_PAIR_V1`/`GHOSTI_INVITE_V1` Deferred Deep Link), QR 계정 충돌 시 계정 선택·전환 후 앱 연결 단계 자동 진입 구현 및 기획서·기능명세 박제 완료.
2. **내 기기 통합 달나라님 QA 완결 (`ee3b86b`, `e6970b8`, `ca19884`, `4581fa0`, `5abb76b`)**
   - PC 새로고침 시 해제된 스마트폰 2초 잔상 제거, 스마트폰 연결 해제 시 `[내 기기 통합]` 우측 `[다시 연결]` 버튼 즉시 노출, QR 연결 2~3초 정상 통신 텀 구간 `⏳ PC와 연결하는 중입니다...` 안내 및 PC 웹 새로고침 없는 2~3초 자동 전환, PC 게스트 화면 로그인 안내 문구 자연스럽게 분리.
3. **업무 공유방 초대 링크 격리 패치 & 양대 스토어 `v1.0.90 (90)` 배포 (`a1d40e7`)**
   - 업무 공유방 초대 링크(`?workRoom=...&inviteToken=...`)를 사진 공유 탭으로 오인식하던 버그(`422f9ffd-2c1d-8079-ab89-f15f2e17a95f`)를 `shareInviteDeepLinkBridge.ts`, `MobileShareInviteBridgeOverlay.tsx`, `freePhotoShareSlice.ts` 3중 차단으로 수정하고 양대 스토어 `v1.0.90 (90)` 동시 발송 완료.
4. **초대 링크 14일 고정 유효기간 확정 · 복사 안내 문구 추가 · 문서 현행화 (`64c9e05`)**
   - 사진 공유·업무 공유 초대 링크 모두 **발급 후 14일 고정(자동 연장 없음)**으로 단순화 확정 (`workAndDeviceBridgeOps.mjs` 방장 입장 자동 연장 로직 제거).
   - 사진 공유 `[초대 링크 복사]` 전체 버튼(`LoungeFeedContextBanner.tsx`, `AlumniRetroBannerAndTwoTrackBar.tsx`, `LoungeCustomSettingsHeader.tsx`)에 `(발급 후 14일간 유효)` 안내 추가, `docs/기능명세.md` 현행화 및 노션 카드 `재테스트 대기` 전환 완료.
5. **3귀신 QA 공정 점검 & 누락 테스트 미션 카드 5건 추가 출제 (`담당: 달나라`)**
   - 현 시점 공정률: 코드 약 88% · 테스팅 약 55% (완료 11건, 재테스트 대기 3건, 테스트 미션 9건).
   - 달나라님 눈높이 일상어로 누락 미션 5건 신규 출제: ① 모바일 웹 브릿지(앱 열기/미설치 설치 후 이어지기), ② 기기 연결 해제 & 재연결, ③ 사진 공유 권한·삭제 동기화 & 14일 안내, ④ 아이폰 최종 점검, ⑤ 14일 만료 최종 확인(12/4 이후).
6. **4호기(`office-qa4`) 성능 진단 & 금융 보안모듈 8종 잠재우기**
   - SSH 실측으로 금융 보안모듈 8종 안전 비활성화 및 크롬 단일 탭 3.85GB RAM 폭주 원인 파악 후 `1귀신`에 우체국 이관 완료.

## 다음 체크인 Todo
- [ ] 양대 스토어 `v1.0.90 (90)` 실기기 QA 및 달나라님 테스트 미션 9건 · 재테스트 대기 3건 피드백 대응.
- [ ] `아이폰 최종 점검` 및 `14일 만료 최종 확인(12/4 이후)` 통과 후 3귀신 100% 출시 확정.

---

# 🟣 `[4귀신]` 세션 인계장 (`SESSION_HANDOVER_4.md` — 업무 공유 `S:` · 귀신비서 에이전트 1·2차 고도화)

- **최종 갱신 일시**: 2026-11-25 01:41 (KST)
- **담당 역할**: `[4귀신]` (업무 공유 `S:` + 귀신비서 제미니 에이전트 PC 자가케어 1·2차 고도화 전담)
- **로컬 엔진 버전**: `Merlin Z-Core v2.8.01` (`684c1eb` · `df1da5a`, 로컬 6호기 · 1~4호기 클러스터 배포 및 `SYSTEM` 헬퍼 실측 통과)
- **세션 창 제목**: `4귀신 비서고도화·v2.8.01완결`

## 완료 내역 (2026-11-24 ~ 11-25)
1. **업무 공유(`S:`) 마운트·초절전·팀원 DB 복원 · PC 연속 F5 로그아웃 4중 차단 (`3b1a7c3`, `33ce504`, `cc065ef`, `2708837`, `f198897`)**
   - `WorkLoungeB2BHub.tsx` 직렬 마운트 및 재부팅 자동 복원, 4대 타이머 `hidden` 시 0회 정지 + `knownSig` 유휴 Base64/리렌더링 0회, `work_list_my_rooms` 초대 팀원 영구 복원, F5 자동 로그아웃 4중 차단 및 `MerlinHub` 교차 보강 완결.
2. **3호기(달나라)·4호기(해나라) PC 실측 전수 진단 기준서 작성 (`docs/3호4호_PC정밀진단_및_귀신비서_자가케어_대조기준서.md`)**
   - 내일 점심 실전 자가케어 대조용 Before 원본 보존 (**원격 정리·삭제 0건 유지**).
3. **귀신비서 제미니 에이전트 자유 문답 + 다중 PC 정리 1차(5대 기둥) · 2차(미등록 숨은 쥐새끼 전수 수색 & 무삭제 서비스 수동 전환) 구현 (`394a66b`, `a381f07`, `d1cf567`, `e5811b5`)**
   - `plugin_ghosti_agent_care.py` · `plugin_ghosti_care_suite.py` · `ghostCareAgentEngine.ts` · `monsterChatRouter.ts` · `MonsterInteractiveCards.tsx`: `C:` 공간 도둑 3초 스캔 + `D:\귀신비서_보관함` 안전 이사, 데스크톱 배터리 가드(`hiberfil.sys`/고성능), 보안모듈·애드웨어 2분류 + Zero-Trust 2-Pass 배치 언인스톨 + `.disabled_by_ghosti` 잠금 DLL 적출, 바탕화면 상세 분석 & `WD` 시스템 아이콘 안전 숨김, `cloudflared.exe` 단일 락, `GET /api/care/hidden-rats-scan`(PowerShell `-EncodedCommand`) + 제미니 3단계 정체 해석(`enrichUnknownRatsWithGemini`) + `[이게 뭐예요?]` Q&A + `POST /api/care/hidden-rats-apply`(무삭제 `Manual` 전환 + 1초 원복).
4. **`MerlinHub` 정밀 크로스체크 `P0 6건 + P1 4건` 전량 패치 · `Z-Core v2.8.01` 배포 · 2차 재검증 최종 `PASS (Sign-Off)` 획득 (`684c1eb`)**
   - `P0-1` `MULTI` 5대 버킷 순차 실행 & 중복 행 제거, `P0-2` `0-0A` 조건부 제외·이사 가로채기 차단, `P0-3` 일반 사무직원 자유 발화(조사 `이/가`·`답답`·`이상한 창`·`모자라`) SSOT 통합 & 별명 오인 차단, `P0-4` 현역 `SenseTalk_Engine.exe(:28888)` 완전 보호(2개 이상 중복 시 초과분만 종료), `P0-5` `incIdSet.size === 0` 시 `defaultSelected` 안전 모수 한정, `P0-6` UAC `35초` · 공용 큐(`C:\ProgramData\Merlin\care_queue`) · `SYSTEM` 헬퍼 `Users` 실행 SDDL · `ghosti_safe_ops` 승격 원복 · 단일 복원 지점 통합, `P1-1~4` 완결.
   - 3·4호기 Read-Only 실측 통과 (`3호기 VER=2.8.01 TOTAL=10 HELPER=True|SYSTEM`, `4호기 VER=2.8.01 TOTAL=20 HELPER=True|SYSTEM`).
5. **점심 직후 자유 발화형 노션 실전 QA 미션 카드 2장(해나라·달나라) 출제 · 레거시 껍데기 폴더(`Ghosti_Search`, `Ghosti_Share`) 영구 삭제 · 1~4귀신 개별 인계장 분리 및 `z_core_watcher.py` 자동 합본 세팅 (`df1da5a`, `fa66b1a`)**
   - 정해진 명령어 예시 없이 목적만 제시해 일반 사무직원 말투로 자유 대화 ➔ 비서 가이드 순응 검증하도록 개편.
   - 4개 창 동시 체크아웃 충돌 0%를 위해 `SESSION_HANDOVER_1~4.md` 개별 저장 + 체크인 시 파이썬 0.01초 자동 합본(`SESSION_HANDOVER.md`) 세팅 및 `AGENTS.md`·`docs/README.md` 명문화 완료.

## 다음 체크인 Todo
- [ ] **점심 직후 3호기(달나라)·4호기(해나라) 귀신비서 실전 자가케어 결과 대조**: `docs/3호4호_PC정밀진단_및_귀신비서_자가케어_대조기준서.md` 10대 지표 전/후 검증 및 피드백 반영.
- [ ] **제미니 2층 응답·오류(`👎`) 피드백 DB 고도화**: 필요 시 `ghosti_gemini_feedback_logs` 정식 테이블 + 말풍선 `👍/👎` 버튼 + 주간 정규식 승격 감사 스크립트(`audit_gemini_feedback.py`) 구축.
