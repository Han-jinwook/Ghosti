# 🟠 `[3귀신]` 세션 인계장 (`SESSION_HANDOVER_3.md` — 사진 공유 · 내 기기 통합 · 모바일 앱)

- **최종 갱신 일시**: 2026-11-26 13:33 (KST)
- **담당 역할**: `[3귀신]` (사진 공유 · 내 기기 통합 Pro · 모바일 웹 브릿지 · 양대 스토어 앱)
- **QA 담당 테스터**: **달나라님** (노션 `담당 = 달나라` 고정)
- **최신 배포 버전**: **`Merlin Z-Core v2.9.20`** (1~6호기 전 클러스터 반영 완료) · 양대 스토어 **`v1.0.114 (114)`** (Google Play 내부 테스트 & Apple TestFlight 동시 출시)
- **세션 창 제목**: `3귀신 방관리·v1.0.114`

## 완료 내역 (2026-11-25 ~ 11-26)
1. **사진 공유 `[방 관리]` 정식 서버 브릿지 멤버 목록(`photo_list_room_members` · `photo_kick_room_member`) 직결 연동 + 허브 닉네임 정합화 & 동명이인 이메일 구분 표시 + 양대 스토어 `v1.0.114 (114)` 배포 (카드 `424f9ffd` `'재테스트 대기'`) (2026-11-26)**
   - 1차 클라이언트 직접 `ghosti_lounge_members` 조회가 RLS(`ghosti_is_room_member`) 환경에서 방장 외 참여 회원을 누락하던 근본 원인을 `workAndDeviceBridgeOps.mjs` `photo_list_room_members`·`photo_kick_room_member` 서버 브릿지로 전환해 해결.
   - 2차 재제보(`'디자이너' 2명 중복 표시`) 근본 처치: `photo_list_room_members`에서 과거 합류 시점 잔상(`room_persona_nickname`)보다 매 로그인 동기화되는 허브 최신 닉네임(`public.users.nickname`)을 1순위로 우선하고 타 계정 정식 닉네임을 복제하는 오염 스냅샷을 차단, 실제 동명이인 계정 2명 이상 시 `[방 관리]` 칩에 이메일 식별자(`닉네임 (email)`)를 자동 병기하고 `photo_kick_room_member`가 중복 방 전체에서 일괄 강퇴하도록 완결.
   - 3차 모바일 앱 재제보(`PC 정상, 모바일 1명 표시`): 설치형 앱(`v1.0.113`)에 구 `dist/` 번들이 내장되어 있던 원인을 해결하기 위해 `LoungeCustomSettingsHeader.tsx`에 로그인 동기화(`ghostiSupabaseUserSynced`)·포그라운드 복귀(`visibilitychange`) 자동 재조회까지 보강하고 양대 스토어 `v1.0.114 (114)` 정식 동시 출시 완료.
2. **아이폰·안드로이드 기기 연결 해제 시 `[다시 연결]` 미노출 & 상단 `연결된 기기 2대` 거짓 표시 근본 해결 및 양대 스토어 `v1.0.112 (112)` 배포 (카드 `422f9ffd` `'재테스트 대기'`) (2026-11-26)**
   - 아이폰에서 PC 기기를 `[연결 해제]`했을 때 PC 화면에만 `[다시 연결]`이 뜨고 아이폰 화면에는 안 보이던 문제와, 폰 1대만 남았는데 `pcAgentPairedMobile = hasMobile || devices.length >= 2` 조건으로 상단에 `연결된 기기 2대`가 잘못 표시되던 버그를 동시 해결.
   - 서버 `workAndDeviceBridgeOps.mjs`에 `device_reconnect_device` 추가 + `deviceIntegrationService.ts`(`reconnectConnectedDevice` + Realtime 브로드캐스트) + `paidDeviceSyncSlice.ts`(`lastRevokedPeerDevice` · `reconnectPeerDevice` · `hasMobile && devices.length >= 2`) + `CrossDeviceClipboardAndPairingBar.tsx`/`MobileAppView.tsx` 수정으로 아이폰에서 PC를 해제하든 본인 기기를 해제하든 어느 쪽이든 즉시 `[다시 연결]` 버튼이 노출되어 2~3초 내 양쪽 기기가 자동 복구되도록 완결.
2. **사진 공유 `[방 관리]` 동일 유저 2명 중복 표시 근본 해결 (카드 `41ef9ffd` `'재테스트 대기'`) (2026-11-26)**
   - `loungeRoomPermissions.ts`(`resolveCurrentUserIdentityTokens`에 여권 실명·별명·허브 닉네임·이메일 원문/아이디 통합 SSOT 보강) 및 `LoungeCustomSettingsHeader.tsx`(`sharedUploaderEmail` 이메일 기준 + 신원 토큰 기준 1인 단일 집계) 수정으로, 별명 등록 전 이메일 아이디(`sundream7879`)로 올린 사진과 이후 등록한 별명(`썬드림`)이 2명의 회원으로 중복 집계되던 버그를 원천 차단.
2. **시크릿 창 비로그인 초대 링크 모임방 10초 로딩 지연 근본 처치 (`10.4초 ➔ 0.79초`, 카드 `420f9ffd` `'재테스트 대기'`) (2026-11-26)**
   - **근본 원인 2건 규명 및 제거**: ① `public/sw.js` 최초 활성화 시 `client.navigate(client.url)`가 시크릿 창·신규 방문자의 페이지를 9.6초 시점에 강제 리로드하던 2중 로딩 제거(`CACHE_NAME v16`), ② `App.tsx`의 11개 lazy 모달 단일 `<Suspense>` 직렬 워터폴을 조건부 마운트·독립 `<Suspense>`로 해체하고 URL 초대 링크 RPC(`applyShareInviteDeepLink`)를 `App.tsx` 마운트 `0ms`에 최우선 발사 + `DesktopSidebarAndHeader.tsx` 로딩 상태 구독 보강(헤드리스 시크릿 창 실측 `10,369ms ➔ 793ms`).
2. **`4. 내 기기 통합 Pro` 모바일 클립보드 3박자 정공법 최종 확정 반영 · 오리지널 기획서 7종 & 인앱 UI 전면 In-Place 동기화 (2026-11-26)**
   - **① 기술·UX 확정**: 커스텀 키보드(`전체 접근 허용`) 영구 폐기 ➔ **`설정 0개 기본(방식 A)` + `앱 안 여는 OS 순정 1탭 전송(방식 B: Android 드래그 [귀신 클립보드 저장]·알림바 / iOS [공유 ➔ 귀신같이 PC로 바로 보내기])` 투트랙 결합** 확정 (`PC↔PC`는 0.2초 무버튼 직결, `PC➔폰`은 7일 보관함·앱 열기 45ms 자동 장전, iOS 팝업 해제 선택 1줄 팁 제공).
   - **② 네이밍·카피 확정**: 과장된 `"폰↔PC 무버튼 실시간 양방향 클립보드"` 워딩 전면 폐기 ➔ **`7일 통합 클립보드 보관함 (PC↔PC 무버튼 직결 · 폰↔PC 1탭 전송)`**으로 통일.
   - **③ `4. 내 기기 통합 Pro` 가치 서열 1~4순위 전면 재배치**: ① `1초 사진·표 OCR 엑셀 직행 & 귀신 라벨러 무제한` ➔ ② `내 폰+집컴+회사컴 통합 1초 내용 검색 & E2EE 우체통` ➔ ③ `클라우드 월세 0원 원본 사진 통합 정리·백업` ➔ ④ `7일 통합 클립보드 보관함 & PC 상용구(F1~F6) 동기화`.
   - **반영 파일**: `CrossDeviceClipboardAndPairingBar.tsx`, `PricingModal.tsx`, `subscriptionPlanCatalog.ts`, `ShowroomLowerSections.tsx`, `docs/상황별_슬로건_20261124_0110_Ghosti.md`, `docs/귀신같이_통합_가격표_마스터.md`, `ghostkey/docs/귀신Key_기능소속_최종확정안_20261123_0130_GhostKey.md`, `docs/귀신같이_가치명세서.md`, `docs/귀신같이_기획서.md`, `docs/기능명세.md`, `docs/귀신비서_FAQ_원본.md`, `docs/정책_및_핵심원칙.md`, `docs/README.md`.
   - **노션 QA 카드(`423f9ffd-2c1d-8060-a898-e06972a3376c`)**: 멀린님 지시대로 현재 배포된 `v1.0.110` 기준 단순화(설정 0개 · 앱 열기 + 간단한 허용 팝업) 테스트 진행 중 (추후 차기 스토어 릴리즈 시 iOS `GhostKeyKeyboardExtension` 제거 ➔ `GhostKeyShareExtension` 정식 타겟 교체 및 Android 알림바 빠른 전송 버튼 탑재 예정).
2. **PC ↔ 모바일 양방향 클립보드 10초 지연·누락 근본 해결 (`4061e83`, `f179fb6`, `Z-Core v2.9.20`, `v1.0.110`)**
   - **PC 메모장 복사 `0.2초` 직통 E2EE 데몬 (`plugin_paid_sync_ghostwin.py` · `merlin_z_core_daemon.py` `v2.9.20`)**: 크롬 창이 메모장 등에 가려져 백그라운드 절전(`~10초` 스로틀링)이 걸리거나 최소화되어도 즉시 전송되도록, 웹 로그인·토큰 갱신 시 `POST /__sync/auth-context`(로그아웃 시 `clear: true` 즉시 파기)로 인증 컨텍스트를 전달받아 외부 패키지 없이 순수 Win32 `bcrypt.dll` `AES-256-GCM`(`PBKDF2` 60,000회) 스레드가 `0.22초` 주기로 `GetClipboardSequenceNumber()`를 직접 감시·직통 발송하고 `1.5초` 주기로 스마트폰 복사본을 자동 주입하도록 구현 (1~6호기 전 클러스터 무중단 스왑 완료).
   - **서버 우체통 직렬화 & 모바일 복귀 누락 차단 (`workAndDeviceBridgeOps.mjs` · `deviceIntegrationService.ts`)**: `device_push_e2ee_clip`에 계정별(`emailHash`) 비동기 직렬화 락 + `createdAt` 최신순 정렬을 적용해 `Test 1 ➔ Test 2 ➔ Test 3` 고속 연속 복사 시 덮어쓰기를 제거하고, 모바일 포그라운드 복귀 타이머 밀림 제거(`45ms` 즉시 감지) 및 실제 OS 클립보드 쓰기(`writeTextToLocalOsClipboard === true`) 성공 시에만 봉투를 완료 각인하도록 수정.
3. **동일 PC 동시 1계정 단독 점유 정책 확정 · 백업 폴더 계정별 하위 격리 (`cd76f18`, `d6e4a16`, `Z-Core v2.9.10`)**
   - `docs/정책_및_핵심원칙.md` §5.4-⑨ 외 6대 문서에 카카오톡 PC 방식 **‘1PC 동시 1계정 단독 점유(순차 교대 로그인 무제한 허용)’** 원칙을 박제하고 `4귀신`과 공동 적용.
   - 내 기기 통합 백업 경로를 `Pictures\Ghosti_Phone_Backup\<계정폴더>`로 계정별 격리하고 타 계정 하위 백업 폴더가 로컬 사진 스캔에 섞이지 않도록(`_is_other_account_phone_backup_dir`) 방어.
4. **1~4귀신 공용 엔진 작업 문패 장부(`zcore_board.py`) 구축 및 전파 (`c74ffeb`)**
   - `msvcrt.locking` 파일 락 기반 `claim` / `heartbeat` / `release` / `status` 장부와 `z_core_watcher.py` 0초 미해제 차단·대기열 자동 기상 가드를 구축하고 `AGENTS.md` 및 아키텍처 명세서에 반영 완료.
5. **안드로이드 2회차 사진 동기화 90초 지연 0.5초 단축 (`d6cd271`, `v1.0.107`, 카드 `423f9ffd-2c1d-80a4-b074-dcf693ad54d5` `'재테스트 대기'`)**
   - 서버 `mirror_blobs/` 기보유 선대조(`skipExisting`), 클라이언트 `x-upsert: true`, `shadow_catalog` 중복 `thumbWebp` 페이로드 제거로 2회차 동기화를 `0.5초` 내로 단축.

## 직전 대화 맥락 및 결정사항
- 모바일 클립보드는 복잡한 시스템 키보드 설정을 일반 유저에게 요구하지 않고 **간단한 `[붙여넣기 허용]` 팝업 + 앱 열기 기본 연동**으로 확정.
- 한 PC 다중 프로필 동시 로그인은 카카오톡 PC 방식의 **동시 1계정 단독 점유**(전환 모달 1클릭 인수인계)로 통일하고, 부부·개인/업무 순차 교대 로그인 시 사진 백업 폴더는 계정별 하위 폴더로 100% 분리 보존.
- 1~4귀신이 공용 엔진(`universal_z_core/`)·브릿지(`workAndDeviceBridgeOps.mjs`)를 수정할 때는 반드시 `zcore_board.py` 문패를 걸고 커밋·푸시 직후 즉시 내리는 원칙 확립.

## 다음 체크인 시 바로 이어할 1순위 과제
- [ ] `python d:\Ghosti\z_core_watcher.py --watch --role 3` 기동 후 달나라님 `'재테스트 대기'` 카드(`PC ↔ 모바일 양방향 클립보드 v1.0.110`, `안드로이드 2회차 사진 동기화 v1.0.107` 등) 및 남은 실기기 테스트 미션 피드백 즉시 대응 (`발견된 버그` 현재 `0건`).
