# 📋 귀신같이 (Ghosti) 세션 릴레이 인계장 (`SESSION_HANDOVER.md`)

- **최종 갱신 일시**: 2026-11-24 15:07 (KST)
- **담당 역할**: `1~4귀신 통합` (`main` 최신 동기화 완료)
- **브랜치 / 기준 커밋**: `main` (`c1970e9` + `Z-Core v2.7.69` 반영, `origin/main` 동기화 완료)
- **로컬 엔진 버전**: `Merlin Z-Core v2.7.69` (전 클러스터 1·2·3·4호기 윈도우 10 + 로컬 6호기 윈도우 11 배포 및 헬스체크 완료)

---

## 0-A. 오늘 완료 내역 (2026-11-24 — `[1귀신]` 크롬 1.9GB RAM 폭주 근본 패치 · 온디바이스 얼굴 여권 정석화 · 첫 화면 무깜빡임 · 보안모듈 보강 · 30일 고아 캐시 GC 완결)

1. **크롬 단일 탭 1.9GB RAM·CPU 폭주 근본 패치 및 [`docs/기능명세.md`](docs/기능명세.md) 8.4절 5대 정공법 명문화 (`96e9c7b`)**
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

---

## 0-B. 오늘 완료 내역 (2026-11-24 — `[2귀신]` 귀신검색 · 귀신창 · 귀신라벨링 · 동영상 재생 집중 완결)

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
5. **윈도우 10/11 공통 `Ctrl+0`/`Ctrl+우클릭` 선택 파일(`.jfif`·사진앱 포함) `[1]`번 고정 · `WH_MOUSE_LL` 0.01ms 무지연 훅 · 탐색기 COM 0.45초 워커 격리/이중 트리거 차단 · 귀신검색창 전 하드 드라이브(C:~Z:) 스캔/입력 중 크기 요요 차단 & 사진 촬영일(13자리 epoch 포함) 최신순 정렬 (`cf5eace`, `4d2af5d`, `9000ee2`, `2d6feb5`, `c0c8e6d`, `1f796d9`, `c1970e9`, `Z-Core v2.7.69`)**
   - `seq_paste_daemon.py` · `ghost_search_window_ui2.py`: 탐색기·바탕화면(`summon_by_rclick` 커서 아래 창 우선 판별 포함) 선택 파일 및 윈도우 10/11 사진앱(`ApplicationFrameHost.exe`/`Microsoft.Photos.exe`/`Photos.exe`) 열람 파일(`.jfif` 포함) `[1]`번+우측 큰 미리보기 고정, `Ctrl+0` 키업(`<KeyRelease>`) 축소 차단 및 `manual_stage="medium"` 보존, `WH_MOUSE_LL` `0.01ms` 무지연(`_CACHED_RCLICK_BYPASS`·`WM_RBUTTONUP` Ctrl 방어·`GetModuleHandleW` 3중 등록), 탐색기 `Shell.Application` COM `0.45초` 워커 스레드 격리 + `last_summon_ts` 완료 후 재갱신/`was_ctrl0_down` 동기화 + `_is_ui_window_actually_open()` Win32 실창 검증으로 폴더 첫 호출 시 열리자마자 닫힘 및 18초 행 재기동 원천 차단. 귀신검색창 타이핑 중 `small` 높이 `330px` 고정 + 입력 멈춤(`260ms`) 후 단 1회 `medium` 확장 + 입력 중 `medium ➔ small` 역축소 차단으로 요요 제거. 또한 `_get_known_user_folders_for_search`·`_collect_search_scan_dirs`를 `C:` 외 모든 고정·이동식 하드 드라이브(`D:~Z:`, `GetDriveTypeW in (2,3)`) 및 사용자 지정 폴더(`ghosti_custom_scan_roots.json`) + `C:\` 사용자 폴더까지 3단계 BFS(`0.55초` 시간 예산·최대 `2,400건` 인덱싱·`.jfif/.heic/.heif` 포함)로 확장 완료(`1·2·3·4호기 + 6호기` `v2.7.69` 배포 완료).
   - `aiPhotoFaceEngine.ts`: 귀신검색 전체 보기 사진 목록을 파일 복사일(`st_mtime`)이 아닌 카드 표시 실제 촬영일(`canonicalDate`·`canonicalMtimeMs`, `19xx`/`20xx` 및 13자리 Unix epoch ms 파일명 포함) 최신순 내림차순으로 일관 정렬 교정.

---

## 1. 오늘 완료 내역 (2026-11-24 — `[4귀신]` 업무 공유 `S:` 집중 완결)

1. **업무 공유(`S:`) 파일탐색기 미노출 근본 수정 (`3b1a7c3`, `Z-Core v2.7.59`)**
   - `WorkLoungeB2BHub.tsx`의 권한 동기화(`/__work/entitlement`)와 `S:` 마운트(`/__work/s-drive`) 병렬 경합을 순차 직렬화로 해소하고, 초대 팀원(`work_invited_member`)이 본인 미구독으로 `workEntitlementLocked`에 막히던 잠금 버그를 해결.
   - `plugin_paid_work_sdrive.py`의 `sync_work_entitlement_state(unlocked=True)` 즉시 마운트 및 `merlin_z_core_daemon.py` 기동 시 `auto_mount_s_drive_if_unlocked()` 자동 복원 탑재(1~4호기 클러스터 배포 완료).
2. **크롬 "브라우저 속도를 저하시키는 탭 수정" 경고창 `[4귀신]` 사각지대 근본 제거 (`33ce504`, `Z-Core v2.7.60`)**
   - `WorkLoungeB2BHub.tsx` 4대 타이머(`fastLock` 2초 · `fullSync` 10초 · `loadRemoteState` 15초 · `ensureTunnel` 30초) 전원 `document.visibilityState === 'hidden'` 시 **0회 호출(완전 정지)** 전환 및 `backupServers` 참조 비교로 12초 연쇄 재기동 차단.
   - `workRoomSyncService.ts` + `plugin_paid_work_sdrive.py`에 `knownSig` 변경 감지(`unchanged: true`)를 활성화해 파일 미변경 시 Base64 인코딩·JSON 재전송·React 리렌더링 **0회** 달성 및 [`docs/기능명세.md`](docs/기능명세.md) 8.4절 반영.
3. **초대 팀원 업무방 DB 영구 복원(`work_list_my_rooms`) & 모바일 웹 `[앱에서 열기]` 브릿지 (`cc065ef`)**
   - `netlify/functions/lib/workAndDeviceBridgeOps.mjs`에 `work_list_my_rooms` 신설 및 `WorkLoungeB2BHub.tsx` 자동 복원 연동 ➔ PC 재로그인/F5 및 모바일 웹 초대 수락 후 모바일 앱 재접속 시 초대 링크 없이 소속 업무방·권한 자동 복원 + 모바일 웹 상단 `ghosti://work?...` 버튼 추가.
4. **PC 연속 새로고침(`F5`) 시 자동 로그아웃 4중 차단 + `MerlinHub` 서버 교차 보강 완결 (`2708837`, `f198897`)**
   - 클라이언트 4중 방어(`main.tsx` 유효 JWT 보유 시 잔류 `sessionStorage.merlin_logged_out`·`GHOSTI_POST_LOGOUT_WORKSPACE_KEY` 자가 치유, `GhostiHubInfraBridge.tsx` `beforeunload finalWipe` 유효 JWT 보호, `merlin-hub-sdk` `client.ts` 부가 API 단발 `401` 세션 삭제 격리·롤링 토큰 재시도, `auth.ts` `/api/auth/me` `350ms` 2회 연속 확정 검증).
   - 중앙 우체국으로 `MerlinHub` 교차 점검 공문 발송 ➔ `MerlinHub` 서버측 `GET /api/auth/me` `userId` PK 1순위 조회·`150ms` 내부 재시도 보강 및 허브 공식 원본 SDK(`허브_라이브러리`) 동기화 회신 수령 완료.

---

## 1-A. 오늘 완료 내역 (2026-11-24 — `[3귀신]` 사진 공유 · 내 기기 통합 · 모바일 웹 다리 전용 확정 · 양대 스토어 `v1.0.89`)

1. **모바일 웹 = 온보딩 쇼룸 & 앱 이동 다리 전용 확정 (`f87b1b3`, `c11db33`, `6b9ef44`, `0797454`)**
   - PC(엔진 설치)와 설치된 모바일 정식 앱(Android/iOS)만 실사용 기기로 취급(`계정 + 설치된 앱 = 1대`), 모바일 웹 브라우저 기기 등록 원천 차단 및 기존 유령 모바일 웹 기기 자동 정리.
   - **전용 모바일 웹 브릿지 2종 구축 (`MobileQrPairBridgeOverlay.tsx`, `MobileShareInviteBridgeOverlay.tsx`):** QR 기기 통합 및 사진 공유방 초대 링크(`preview=guest` 포함) 접속 시 최상단 전용 브릿지 창으로 자동 앱 열기, 미설치 시 스토어 이동(Android `InstallReferrer` · iOS 클립보드 `GHOSTI_PAIR_V1`/`GHOSTI_INVITE_V1` Deferred Deep Link), QR 계정 충돌 시 계정 선택·전환 후 앱 연결 단계 자동 진입 구현 및 [`docs/귀신같이_기획서.md`](docs/귀신같이_기획서.md)·[`docs/기능명세.md`](docs/기능명세.md) 박제 완료.
2. **내 기기 통합 달나라님 QA 완결 (`ee3b86b`, `e6970b8`, `ca19884`, `4581fa0`, `5abb76b`)**
   - PC 새로고침 시 해제된 스마트폰 2초 잔상 제거, 스마트폰 연결 해제 시 `[내 기기 통합]` 우측 `[다시 연결]` 버튼 즉시 노출, QR 연결 2~3초 정상 통신 텀 구간 `⏳ PC와 연결하는 중입니다...` 안내 및 PC 웹 새로고침 없는 2~3초 자동 전환, PC 게스트 화면 로그인 안내 문구 자연스럽게 분리.
3. **사진 공유방 · 웹 로그인/로그아웃 세션 · 화이트·청록(틸) UI 통일 (`3b440df`, `96a8eb1`, `e2d2693`, `a6b0ed3`, `154a18b`, `7ac007f`, `74249c0`)**
   - 모바일 앱 완전 종료 후 홈 아이콘 재실행 시 항상 귀신비서 첫 화면 진입, PC 공유방 삭제 시 모바일 로컬 금고 최근 14일 사진 즉시 정리 + 당겨서 새로고침 시 공유방·기기 통합 동시 동기화 + 권한 없는 멤버 삭제 시도 시 서버 거부 즉시 모바일 로컬 롤백.
   - 웹 로그아웃 시 귀신비서 대화창 즉시 초기화 및 게스트→로그인 전환 시 계정 데이터 즉시 동기화, PC·모바일 사진 공유방 및 사진 올리기 창의 검은색 버튼·스위치 뱃지를 화이트·청록(틸) 디자인으로 전면 통일 후 양대 스토어 **`v1.0.89 (89)`** 동시 배포 완료.

---

## 1-B. 직전 완료 내역 (2026-11-23)

1. **크롬 "이 사이트가 브라우저를 느리게 함" 경고창 원천 박멸 3대 정공법 구현 및 명세 반영 (`2059023`, `7783d73`)**
   - `EmbeddingGemma 2`(8비트 `q8` 무손실)와 `PaddleOCR`을 전용 ES Module Web Worker(`embeddingAiWorker.ts`, `paddleOcrWorker.ts`)로 완전 격리해 메인 UI 블로킹 `0ms` 달성.
   - `hidden` 탭 전환 즉시 백그라운드 인덱싱 일시정지 + 데스크톱 20초 유휴 시 워커/ONNX RAM 자동 반환(`onBgFree`) + 중복 단독 `textQueryModel` 즉시 해제.
   - 백그라운드 `0.35초` 강제 워커 타이머 폐지 ➔ `createVisibilityAwareInterval`(`hidden` 시 0회 호출, 복귀 시 즉시 동기화) 전면 전환 및 [`docs/기능명세.md`](docs/기능명세.md) 8.4절 반영 완료.
2. **UI 정화 유지 + 고스트키 기준 고유 틸·에메랄드 컬러 톤 복원 (`6c51a21`, `f828ef3`)**
   - 이모지·홍보성 수식어·내부 기술용어·`귀신창` 잔재 제거 상태는 유지하면서, 흑백화되었던 사이드바·귀신비서 카드·버튼·대화창을 고스트키와 동일한 차분한 **틸(`bg-teal-600`/`bg-teal-50`)·에메랄드·시맨틱 파스텔 톤**으로 복원.
   - `App.tsx` 하단 안내창 `실행 취소` 백지 버튼 및 `index.css` 라이트 테마의 틸 버튼 흰 글씨 시인성 보정 완료.
3. **사진 분류 정확도·로드 속도·미리보기 깨짐·복원 미작동 근본 해결 (`7783d73`, `8815bd5`, `2d6c538`, `f828ef3`)**
   - **흔들림 판별 고도화:** JPEG·썸네일(280px/448px)에 불변인 **Crete 지각적 재블러링 지표 + 8×8 강경계 보케 보호** 적용 (`ghosti_optical_audit_v6`, 스키마 `v11`).
   - **미리보기 전체 깨짐 & 속도 해결:** `merlin_z_core_daemon.py`에서 `<img>` 요청이 `Sec-Fetch-Site: cross-site`로 403 차단되던 순서를 교정하고 웹 `<img>`에 `crossOrigin="anonymous"` 이중 보강 + 썸네일 8장 병렬(`BATCH=8`) 고속 스캔 적용.
   - **기존 정리 사진 복원 무반응 해결:** `restoreFromQuarantine`이 동명 활성 사진을 먼저 잡아 빈 배열로 종료되던 버그를 `p.quarantined === true` 최우선 매칭으로 교정하고, Z-코어 `ghosti_safe_ops.py`에 `$I` 유실 시 `$R` 직접 복원 폴백 추가.
4. **중복·연사 `세트 바로가기` 심플 점프 바 개편 (`0d8a796`)**
   - `1~6세트` 칩 줄 및 `[+N세트 번호 더 보기]`를 제거하고 **`[‹ 이전] · [ 번호 입력 / 전체 세트 + 이동 ] · [다음 ›]`** 1줄 점프 바로 단순화 (`421f9ffd` 등 `1귀신` 노션 버그 카드 전원 `재테스트 대기` 전환 완료).
5. **제트코어 ZIP GitHub Releases 고속 CDN(`z-core-latest`) 운영 문서 동기화 (`47fc853`)**
   - `MerlinHub` `[즉시실행]` 요청에 따라 `docs/기능명세.md`, `docs/멀린_Z_코어_통합_아키텍처_명세서.md`, `docs/GHOSTKEY_SEPARATION_PLAN.md`의 구 Netlify ZIP 경로를 `0건`으로 교체하고 `z-core-latest` 에셋 교체 의무를 명시 후 회신 완료.
6. **`[3귀신]` 사진 공유 · 내 기기 통합 · Netlify 배포 복구 · JS 스플래시 제거 & 양대 스토어 클라우드 동시 출시 (`bd793a8` ~ `04d1ae8`)**
   - **Netlify 실서버 배포 장애 복구 (`8404411`):** `.gitignore`의 `*secret*` 규칙에 `SecretarySamplePcCarePanel.tsx`가 오탐 차단되어 빌드가 멈춰 있던 문제를 예외 추가·커밋으로 즉시 복구.
   - **사진 공유 QA 완결 (`848d124`, `f9d5bcb`, `2c35f75`, `72d948e`, `51894fa`, `6c16f64`):** 동호회·동창회 하위 탭 `feed_track` 정식 컬럼·로컬 동기 보존 맵 기반 엄격 분리(빈 탭 업로드 깜빡임·재클릭 사진 사라짐 해소), `스틱(Chip)` ➔ `스티커` 통일, 앨범/상세창 삭제·숨기기 ➔ `[공유방 휴지통 · 숨긴 사진함]` 통합 및 `desktopTab('trash')` 직결·상단 `[휴지통 · 숨긴 사진 (N장)]` 바로가기 추가.
   - **내 기기 통합 & 모바일 앱 부팅 개편 (`bd793a8`, `16e5d80`, `6c16f64`, `04d1ae8`):** 6자리 번호 30분 유효·자동 갱신·오류 사유 세분화, 모바일 웹 QR ➔ `[귀신같이 앱에서 연결]` 브릿지, 동일 플랫폼 10분 비활성 유령 세션 자동 교체, 연결 대기 시 PC 4.8초 자동 동기화 + iOS 기기 뱃지 세로 정렬, JS 이중 스플래시(`GhostiLoadingSplash.tsx` · `#ghosti-boot-splash`) 코드 찌꺼기 0건 완전 제거 및 양대 스토어 **`v1.0.71 (71)`** 클라우드 동시 출시 발사 완료.
7. **`[2귀신]` 귀신검색 · 사진/표 OCR · 동영상 재생/OCR · 귀신라벨링 · 썸네일 초고속화 노션 QA 전수 완결 (`62eb30b`, `148ff2d`, `db7945c`, `27f2ad4`, `589cc7c`, `Z-Core v2.7.49`)**
   - **수련장 도장판 실시간 연동 (`62eb30b`):** `Ctrl+0` 귀신검색창에서 `[⤢ 크게(갤러리)]`·`[⤡ 작게]` 클릭 즉시 웹 2단계 도장판에 완료(`✓`)가 찍히고 `[초기화]`도 즉시 연동되도록 해결.
   - **사진·표 OCR 독립 창 복사 버튼 통일 & 탐색기 선택 파일 `Ctrl+0` `[1]번` 고정 (`148ff2d`, `27f2ad4`):** 웹과 `Ctrl+0` OCR 창의 버튼명을 **`[📊 표 전체 엑셀(TSV)로 복사]` · `[📋 전체 텍스트 복사]` · `[🖼️ 원본 사진 복사]`**로 통일(일반 화면에서도 클립보드 즉시 복사)하고, 파일탐색기·바탕화면에서 파일을 선택한 채 `Ctrl+0`/`Ctrl+우클릭` 호출 시 해당 파일이 `[1]번` 최상단에 고정되며 우측 상세 미리보기(`[📝 사진·표 OCR 창으로 열기]`)가 바로 열리도록 개선. 또한 백그라운드 스레드의 Tcl `win.after` 직접 호출을 전면 제거하고 메인 스레드 시퀀스 폴링으로 전환.
   - **모바일 동영상 0.0초 정밀 시크(`SEEK_CLOSEST`) & 1920px NPU 한글 OCR 신뢰도·선명도 고도화 (`db7945c`):** Android `MediaPlayer.SEEK_CLOSEST` 및 1920px 정수 초 추출·신뢰도 필터링(`>= 0.68`)으로 영상 멈춤 및 오타 텍스트(`"띰 2824..."`)를 제거하고 양대 스토어 배포 확인 완료.
   - **무(無)-FFmpeg PC 동영상(`.wmv`/`.avi`/`.mov`) `Win32 IShellItemImageFactory` 무프로세스 초고속 썸네일(`30~150ms`) · WinRT 하드웨어 가속 재생 & `[🏷️ 귀신라벨링]` 통일 (`589cc7c`, `Z-Core v2.7.49`):** FFmpeg 미설치 PC에서 PowerShell 콜드 스폰 없이 인프로세스 COM `IShellItemImageFactory`로 `.mp4`·`.mov`·`.wmv`·`.avi`·`.mkv`·`.heic` 썸네일을 `30~150ms` 내에 즉시 추출(웹 `/__videos/thumb` 백그라운드 선행 예열 및 네이티브 `Ctrl+0` 검색창 행 썸네일·우측 상세 미리보기 공통 적용)하고, `Origin` 헤더가 생략된 `<img crossOrigin="anonymous">` 요청에도 `Access-Control-Allow-Origin: *`을 상시 반환하여 사진·동영상 썸네일 깨짐과 로딩 지연을 원천 해소. 아울러 Windows 내장 `WinRT MediaTranscoder`로 `.wmv` 등 모든 영상의 H.264 스트리밍 재생을 지원하고, 버튼명을 `[🏷️ 귀신라벨링]`으로 통일하며 `#바탕 #화면` 분리 태그 오염을 제거해 사진 속 실제 피사체·글자 기반 한글 파일명(`261123_반려견_강아지.jpg` 등)이 복사되도록 완결.
8. **`[2귀신]` 연사 배지 복원(`43a51bd`) & 동영상 OCR 구간 점프·귀신라벨링/PC 텍스트 전송 클립보드 복사 근본 수정**
   - **동영상 키워드 포착 & `MM:SS` 즉시 점프 (`aiVideoEngine.ts`, `VideoScenePreviewModal.tsx`):** `normalizeLocalVideoSceneItem`이 OCR 프레임 초(`timeSec`)를 `00:00` 체크포인트로 흡수·초기화하고 `syncRealVideoDuration`이 `matchedSeekSec`를 `0`으로 덮어쓰던 버그를 근본 교정, `vid.ocrLines` 직접 스캔 및 공백 없는 2글자 이상 한글 OCR 부분일치 + `onLoadedMetadata`/`onLoadedData`/`onCanPlay` 3중 시크 점프 적용.
   - **`[🏷️ 귀신라벨링]` 멈춤 & 클립보드 복사 실패 해결 (`proFeatureGate.ts`, `aiPhotoFaceEngine.ts`, `GhostLabelerActionButton.tsx`):** `copyTextSafeToClipboard`에 Z-코어 OS 네이티브 클립보드(`POST /__merlin/clipboard`) 최우선 경로를 추가해 비동기 AI 대기 후 브라우저 제스처 만료로 복사가 무시되던 원인을 제거하고, 비전 폴백 `4.5초`·라벨러 전체 `6.5초` 타임아웃 및 안전 폴백으로 무한 대기 원천 차단.
   - **사진 상세보기 `[PC로 텍스트 전송]` 클립보드 즉시 복사 (`PhotoDetailModal.tsx`):** Supabase 교차 기기 브로드캐스트에만 의존하던 기존 방식을 고쳐 로컬 Z-코어 OS 클립보드(`/ __merlin/clipboard`)·`/api/teleport/ocr-vanguard`·브라우저 클립보드에 즉시 복사(필요 시 `/__photos/ocr` 실시간 추출 포함)하도록 개선.
9. **`[2귀신]` 온보딩·도장깨기 공용 4단계 보드 통합 · 귀신라벨링 `YYMMDD_HHMMSS`(+ `_2` 일련번호) · 동영상 전 키워드 점프 & 귀신검색창 3중 싱글톤 락 (`aff6dbb` ~ `9275c55`, `Z-Core v2.7.53`)**
   - **온보딩·`[2. 귀신검색]` 공용 4단계 도장깨기 통합 (`1193c0d`, `ghostSearchDojoShared.tsx`):** `작게 모드` · `크게(갤러리)` · `사진·표 OCR` · `귀신라벨링` 4단계를 단일 저장소(`ghosti_search_game_v1`)와 `BroadcastChannel`로 통합해 온보딩 모달과 귀신검색 체험판 양쪽에 탑재(실사용 시 자동 도장 연동).
   - **귀신라벨링 무충돌 작명 & 경합 제거 (`aff6dbb`, `48b323a`, `e0c1593`, `f090ca6`):** `YYMMDD_HHMMSS_한글내용.ext` + 동시각 중복 시 `_2`, `_3` 일련번호 자동 부여, 연속 클릭 시퀀스 경합 차단(`_latestGhostLabelerSeq`), 불분명 사진 오라벨링 방지(`0.65+0.015 / 0.68`), Pro 권한 `60초` 검증 캐시 및 활성 구독/체험 안전 폴백, 검색창 상단 1줄 안내 문구 및 전체화면 버튼 줄바꿈 방지(`whitespace-nowrap shrink-0`) 적용.
   - **동영상 전 키워드 OCR 포착 구간(`MM:SS`) 즉시 점프 & 검색어 단독 하이라이트 (`fb481ce`, `f090ca6`):** `openingOcrLineScore` 분리로 `00:00` 프레임 상속 오염을 제거하고 `#t={초}` 미디어 프래그먼트 + 검색어 단독 하이라이트·일치 키워드 중심 발췌 적용.
   - **귀신검색창 3중 싱글톤 락 (`9275c55`, `Z-Core v2.7.53`) & 연사 배지/모달 뒤로가기 (`5781702`):** `localStorage` 1초 생존 하트비트 + `BroadcastChannel` + Z-코어 서버측 5.5초 하트비트/5초 기동 락 적용, `refreshLiveLocalFilesInSearchWindow`의 `duplicateGroupId` 보존 및 `PhotoDetailModal` `popstate`/`Backspace` 뒤로가기 지원.

10. **`[1귀신]` 오후 QA 완결 · 온디바이스 얼굴 여권(`YuNet + SFace int8`) 정공법 탑재 · `Z-Core v2.7.51` 영구 충돌 방지 & 『4귀신 × 2인 QA』 `--role 4` 체제 전환 (`a2d40b4` ~ `cdbca4c`)**
    - **노션 QA 단건 완결 (`a2d40b4`, `42345b8`, `e5e3023`, `dec133a`, `750ad32`):** 시작프로그램 스위치 카드 최우선 라우팅, 모바일 하단 안내창 노출 중 맨 위로 가기 원형 버튼 일시 숨김, iOS 당겨서 새로고침 `touchcancel` 보존·동기화 완료 대기·상단 잘림 여백 보정, 실행 취소/복원 즉시 스피너 표시, iOS `'최근 삭제된 항목'` 2줄 깔끔 줄바꿈 적용.
    - **온디바이스 얼굴 여권 정공법 탑재 (`681c14f`, `70a71e4`, `a432c59`, `8d8a559`, `c0cab77`):** `facePassportWorker.ts`에 `YuNet(0.23MB)` + `SFace int8(9.4MB)` 탑재(로컬 우선 ➔ Cache API 영구 캐시 ➔ 무료 CDN 폴백 3단계 보완재), 본인·가족 공통 **동일 인물 3장 이상 등장** 단일 기준 통일 및 비서 선(先) 제안 연결.
    - **`Merlin_Z_Core v2.7.51` 영구 충돌 방지 & 3·4호컴 실측 검증 (`0237ded`):** 메인 + `--seq-paste-daemon` 양쪽 Named Mutex, `--replace` 프로세스 트리(`taskkill /F /T`) 완전 정리, 구형 `seq_paste_daemon.py`·중복 스케줄러 3종 자동 숙청(`SenseTalk_Engine.exe` 100% 보호) 및 3·4호컴 SSH 단일 기동 실측 검증 완료.
    - **『4귀신 × 2인 QA(해나라·달나라)』 `--role 4` 지원 반영 (`cdbca4c`):** `z_core_watcher.py`·`notion_qa.py`에 `--role 4` (`5. 업무 공유 S:`) 지원 추가, `AGENTS.md` 단일 본진(`D:\Ghosti`) + 파일 소유권 격리 규격으로 In-Place 교체 및 `Secretary` 회신 완료.
11. **`[1귀신]` 공정 진척 보고 절대 기준 영구 박제 (`40c5a9c`) & 2인 QA 실전 출시 완성도 현실 재산정**
    - [`AGENTS.md`](file:///d:/Ghosti/AGENTS.md) 하단에 **'노션 카드 개수 나열 금지 ➔ 전체 앱 파트별 완성도(%) + 출시 100%까지 남은 갭 최우선 보고'** 규칙 영구 박제 및 커밋·푸시 완료.
    - 2026-11-23 기준 노션 QA 보드 잔여 36건(`재테스트 대기` 13건 · `테스트 중` 2건 · `테스트 미션` 21건) 및 숨은 엣지(백지 설치·대용량·결제·장시간)를 반영해 **현실 실전 출시 완성도 `55~62%`**(공통 65% · 1귀신 65% · 2귀신 60% · 3귀신 50% · 4귀신 35%)로 냉정 재산정 보고 완료.
    - *(참고: 동일 본진 내 야간 작업으로 `3귀신` 모바일 클립보드·Android IME 직결 UX `0b1025f` 및 `귀신Key` `D:\Ghosti\ghostkey` 단일화 이관 `4ebb11b`~`4e206fe`가 추가 반영됨.)*

---

## 2. 체크인 시 확인 Todo 리스트

- [ ] **MS 코드서명 답장 확인 후 재서명**: 멀린님 답장 대기 중 (`Merlin_Z_Core_Setup.exe` 재서명 및 `z-core-latest` GitHub Release 동시 교체).
- [ ] **2인 QA(해나라·달나라) 잔여 36건 및 숨은 엣지 검증 돌입**: 특히 `재테스트 대기` 13건 우선 통과 및 `4귀신 업무 공유 S:` 실전 검증 착수.
- [ ] **색상 톤 최종 눈검수**: 복원 완료(`6c51a21`·`f828ef3`)된 틸·에메랄드 컬러 톤에 대한 멀린님 눈검수 피드백 반영 대기.
- [x] **모바일 앱(`AOS`·`iOS`) 스토어 빌드(`v1.0.71`) 동시 탑재 완료**: `ghosti-ios-runner` Public 0원 클라우드 러너를 통해 Crete 블러 엔진·스플래시 제거·기기 통합 패치까지 AOS/iOS 1:1 동시 출시 완료.
