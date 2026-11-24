# 📋 귀신같이 (Ghosti) 1~4귀신 통합 세션 인계장 (`SESSION_HANDOVER.md` — 자동 합본)

> ⚠️ **[자동 합본 안내 — 직접 수정 금지]**: 본 파일은 `z_core_watcher.py`가 `SESSION_HANDOVER_1.md` ~ `SESSION_HANDOVER_4.md` 4개 파일을 기계적으로 이어붙여 생성합니다. 체크아웃 시 각 창은 **오직 자기 번호 파일(`docs/SESSION_HANDOVER_N.md`)만 수정**하세요.

---

# 🟢 `[1귀신]` 세션 인계장 (`SESSION_HANDOVER_1.md` — 온보딩 · 귀신비서 · 여권)

- **최종 갱신 일시**: 2026-11-24 16:42 (KST)
- **담당 역할**: `[1귀신]` (온보딩 · 귀신비서 · 사진 정리 · 얼굴 여권)
- **세션 창 제목**: `1귀신 1.9GB패치·여권완결`

## 완료 내역
1. **크롬 단일 탭 1.9GB RAM·CPU 폭주 근본 패치 및 [`docs/기능명세.md`](기능명세.md) 8.4절 5대 정공법 명문화 (`96e9c7b`)**
   - 3·4호기 속도 저하 원인이 Z-코어(42~80MB)가 아닌 크롬 단일 탭 ONNX/WASM 동시 기동 및 미종료(1.9GB RAM)임을 SSH 실측으로 규명.
   - `assistantOnboardingSlice.ts`: 기동 시 `1단계 광학 감사(dHash) ➔ 2단계 얼굴 여권(YuNet+SFace) ➔ 3단계 비전/OCR(768D)` 100% 순차 직렬 실행(동시 워커 최대 1개).
   - `aiSharedRuntime.ts` · `aiPhotoFaceEngine.ts` · `onDeviceFacePassportEngine.ts`: 비전 유휴 `10~12초` 시 `terminateEmbeddingWorkerNow()` 강제 종료 및 Pass 2 OCR 직후 데스크톱·모바일 공통 `releasePaddleOcrRuntime()` 호출로 OS RAM 즉시 회수, 세션당 스캔 상한 통제(데스크톱 비전 `120장` / 모바일 `80장` / 얼굴 `160장`).
2. **온디바이스 얼굴 여권(`YuNet + SFace int8`) 정석 파이프라인 및 QA 이슈 전수 완결 (`9219edd`, `11d27eb`, `75f3014`, `3a04377`, `68a8bc6`, `5e6b1d9`)**
   - **5점 정면 정렬 & 오탐 차단**: `SFace int8` 입력 전 ArcFace 5점 랜드마크 2D 유사변환(`112×112`) + 중심 벡터(`0.42`) 재병합으로 동일인 분리·타인 혼입 해결, `YuNet` 임계치 `0.82` 상향 + YCbCr 피부톤 및 고채도 국물/찌개/캐릭터·시스템 `Temp` 폴더 배제(4호기 임시파일 ~500건 청소 포함).
   - **고유 `clusterId` & 영구 스냅샷 SSOT**: 단체사진 동반 등장 시에도 충돌 없는 `대표사진+얼굴좌표` 고유 `clusterId`(`v9`), 두 번째 이후 인물 클릭 시 이전 제외/거절 키 자동 해제 + `[다른 얼굴 고르기]` 버튼 + 0장 선택 시 `[1장 이상 선택]` 비활성화, 확정 여권 사진 영구 스냅샷(`confirmedSelfCuts`) 보존 및 프로필 여권 모달·채팅 단일 조회(`getConfirmedSelfPassportView`) 통합, 스캔 중 `'여권 등록'` 요청 시 완료 즉시 자동 후속 안내(`queuedUserPassportWait`), `data:image/` 아바타 이중 캔버스 덧그리기 생략(겹침 깜빡임 제거).
3. **새로고침(`F5`) 첫 화면 지연·임시 사진 깜빡임 및 프로필 `'회'` 깜빡임 원천 제거 (`fed6795`, `08df1f3`)**
   - 데스크톱 본 화면 `initApp` 초입 Z-코어 헬스체크 선대기 및 원격 호출 `700ms` 분리 + 첫 렌더링 직전 IndexedDB 광학 캐시(`applyCachedPcOpticalAuditInstant`) `0.01초` 선복원으로 임시 `4세트` 깜빡임 없이 최종 `56세트` 원샷 표시, `HubProfileCard` 닉네임 동기 초기화로 프로필 원 안 `'회'` 깜빡임 제거.
4. **자체보호 보안모듈 대화형 선택지 · 30일 고아 캐시 GC · Z-코어 무인 자가업데이트 완결 (`510172c`, `ee17b69`, `8d803a0`, `d3b0ef8`)**
   - `AhnLab Safe Transaction`·`nProtect` 자체보호 보안모듈 감지 포함 + `[안 지우고 잠재우기]` / `[안 쓰는 보안앱 완전 삭제]` 나란히 칩 및 공식 언인스톨러 UAC 직결, 원본 이동·삭제 사진의 고아 캐시 **30일 1회** 저우선순위 자동 청소(`_trigger_monthly_orphan_cache_gc_once`), `zCoreBridge.ts` 자가업데이트 이중 URL 수정 및 `build_signed_merlin_z_core.py` `z-core-latest` GitHub Release 자동 업로드 일원화, 슬로건 v3.0·마스터바이블 오리지널 문서 단독 이관 완료.

## 다음 체크인 Todo
- [ ] **MS 코드서명 답장 확인 후 재서명**: 멀린님 답장 대기 중 (`Merlin_Z_Core_Setup.exe` 재서명 및 `z-core-latest` GitHub Release 동시 교체).
- [ ] **색상 톤 최종 눈검수**: 복원 완료(`6c51a21`·`f828ef3`)된 틸·에메랄드 컬러 톤에 대한 멀린님 눈검수 피드백 반영 대기.

---

# 🔵 `[2귀신]` 세션 인계장 (`SESSION_HANDOVER_2.md` — 귀신검색 · 귀신창 · OCR · 라벨러)

- **최종 갱신 일시**: 2026-11-24 16:42 (KST)
- **담당 역할**: `[2귀신]` (귀신검색 · `Ctrl+0` 귀신창 · 사진/표 OCR · 귀신라벨링 · 동영상 재생)
- **세션 창 제목**: `2귀신 귀신창·라벨러·외장하드`

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
5. **윈도우 10/11 공통 `Ctrl+0`/`Ctrl+우클릭` 선택 파일(`.jfif`·사진앱 포함) `[1]`번 고정 · `WH_MOUSE_LL` 0.01ms 무지연 훅 · 내장 하드 순차 렌더링 & USB/외장 볼륨 생애 1회 질문 · 사진 촬영일 최신순 정렬 (`cf5eace` ~ `d4d3b18`)**
   - `seq_paste_daemon.py` · `ghost_search_window_ui2.py` · `plugin_ghosti_os.py`: 탐색기·바탕화면·사진앱 선택 파일 `[1]`번+우측 큰 미리보기 고정, `Ctrl+0` 키업 축소 차단, `Shell.Application` COM `0.45초` 워커 격리, 타이핑 중 요요 제거, 3단계 드라이브 정책(C: 즉시 ➔ 내장 D:~Z: 유휴 ➔ USB 생애 1회 질문 및 로컬 캐시 격리) 완결.
   - `aiPhotoFaceEngine.ts`: 귀신검색 전체 보기 사진 목록을 파일 복사일이 아닌 실제 촬영일(`canonicalDate`·`canonicalMtimeMs`, 13자리 Unix epoch ms 포함) 최신순 내림차순으로 일관 정렬 교정.

## 다음 체크인 Todo
- [ ] `2귀신` 노션 QA 잔여 카드 확인 및 신규 피드백 대응.

---

# 🟠 `[3귀신]` 세션 인계장 (`SESSION_HANDOVER_3.md` — 사진 공유 · 내 기기 통합 · 모바일 앱)

- **최종 갱신 일시**: 2026-11-24 16:42 (KST)
- **담당 역할**: `[3귀신]` (사진 공유 · 내 기기 통합 Pro · 모바일 웹 브릿지 · 양대 스토어 앱)
- **세션 창 제목**: `3귀신 모바일웹다리·스토어v1.0.89`

## 완료 내역
1. **모바일 웹 = 온보딩 쇼룸 & 앱 이동 다리 전용 확정 (`f87b1b3`, `c11db33`, `6b9ef44`, `0797454`)**
   - PC(엔진 설치)와 설치된 모바일 정식 앱(Android/iOS)만 실사용 기기로 취급(`계정 + 설치된 앱 = 1대`), 모바일 웹 브라우저 기기 등록 원천 차단 및 기존 유령 모바일 웹 기기 자동 정리.
   - **전용 모바일 웹 브릿지 2종 구축 (`MobileQrPairBridgeOverlay.tsx`, `MobileShareInviteBridgeOverlay.tsx`):** QR 기기 통합 및 사진 공유방 초대 링크(`preview=guest` 포함) 접속 시 최상단 전용 브릿지 창으로 자동 앱 열기, 미설치 시 스토어 이동(Android `InstallReferrer` · iOS 클립보드 `GHOSTI_PAIR_V1`/`GHOSTI_INVITE_V1` Deferred Deep Link), QR 계정 충돌 시 계정 선택·전환 후 앱 연결 단계 자동 진입 구현 및 기획서·기능명세 박제 완료.
2. **내 기기 통합 달나라님 QA 완결 (`ee3b86b`, `e6970b8`, `ca19884`, `4581fa0`, `5abb76b`)**
   - PC 새로고침 시 해제된 스마트폰 2초 잔상 제거, 스마트폰 연결 해제 시 `[내 기기 통합]` 우측 `[다시 연결]` 버튼 즉시 노출, QR 연결 2~3초 정상 통신 텀 구간 `⏳ PC와 연결하는 중입니다...` 안내 및 PC 웹 새로고침 없는 2~3초 자동 전환, PC 게스트 화면 로그인 안내 문구 자연스럽게 분리.
3. **사진 공유방 · 웹 로그인/로그아웃 세션 · 화이트·청록(틸) UI 통일 (`3b440df` ~ `74249c0`, 양대 스토어 `v1.0.89 (89)`)**
   - 모바일 앱 완전 종료 후 홈 아이콘 재실행 시 항상 귀신비서 첫 화면 진입, PC 공유방 삭제 시 모바일 로컬 금고 최근 14일 사진 즉시 정리 + 당겨서 새로고침 시 공유방·기기 통합 동시 동기화 + 권한 없는 멤버 삭제 시도 시 서버 거부 즉시 모바일 로컬 롤백.
   - 웹 로그아웃 시 귀신비서 대화창 즉시 초기화 및 게스트→로그인 전환 시 계정 데이터 즉시 동기화, PC·모바일 사진 공유방 및 사진 올리기 창의 검은색 버튼·스위치 뱃지를 화이트·청록(틸) 디자인으로 전면 통일 후 양대 스토어 **`v1.0.89 (89)`** 동시 배포 완료.

## 다음 체크인 Todo
- [ ] 양대 스토어 `v1.0.89 (89)` 실기기 QA 피드백 대응 및 후속 배치 관리.

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
5. **점심 직후 자유 발화형 노션 실전 QA 미션 카드 2장(해나라·달나라) 출제 및 레거시 껍데기 폴더(`Ghosti_Search`, `Ghosti_Share`) 영구 삭제 (`df1da5a`)**
   - 정해진 명령어 예시 없이 목적만 제시해 일반 사무직원 말투로 자유 대화 ➔ 비서 가이드 순응 검증하도록 개편.

## 다음 체크인 Todo
- [ ] **점심 직후 3호기(달나라)·4호기(해나라) 귀신비서 실전 자가케어 결과 대조**: `docs/3호4호_PC정밀진단_및_귀신비서_자가케어_대조기준서.md` 10대 지표 전/후 검증 및 피드백 반영.
- [ ] **제미니 2층 응답·오류(`👎`) 피드백 DB 고도화**: 필요 시 `ghosti_gemini_feedback_logs` 정식 테이블 + 말풍선 `👍/👎` 버튼 + 주간 정규식 승격 감사 스크립트(`audit_gemini_feedback.py`) 구축.
