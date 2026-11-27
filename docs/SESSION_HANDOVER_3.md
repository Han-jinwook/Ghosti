# 🟠 `[3귀신]` 세션 인계장 (`SESSION_HANDOVER_3.md` — 사진 공유 · 내 기기 통합 · 모바일 앱)

- **최종 갱신 일시**: 2026-11-27 22:48 (KST)
- **담당 역할**: `[3귀신]` (사진 공유 · 내 기기 통합 Pro · 모바일 웹 브릿지 · 양대 스토어 앱)
- **QA 담당 테스터**: **달나라님** (노션 `담당 = 달나라` 고정 · 3·4귀신 테스터는 해나라님이 아닌 달나라님으로 호칭)
- **최신 배포 버전**: **`Merlin Z-Core v2.12.9`** · 양대 스토어 **`v1.0.130 (130)`** (Google Play 내부 테스트 & Apple TestFlight 동시 출시)
- **세션 창 제목**: `3귀신 사진공유·모바일통합`

## 완료 내역 (2026-11-25 ~ 11-27)
1. **Apple APNs HTTP/2 · Google FCM HTTP v1 정식 백그라운드 & 앱종료 푸시 직결 (`v1.0.130 (130)` 양대 스토어 출시, 카드 `423f9ffd-2c1d-8060-a898-e06972a3376c` `'재테스트 대기'`) (2026-11-27)**
   - 멀린님 지침 1안 승인에 따라 1호컴 비서(`Secretary`)와 협업하여 `APNs Key (.p8 / 39TQVWY2YM)` 및 `Firebase FCM(google-services.json + 서비스 계정)` 전사 키 확보 및 Netlify 환경변수 4종 세팅 완료.
   - 외부 의존성 0개의 정식 서버 발송 엔진(`netlify/functions/lib/mobilePushDispatcher.mjs`) 탑재. PC `[📱 폰으로 보내기]` 클릭 시 기기별 `APNs / FCM` 토큰으로 즉시 원격 신호 발사.
   - Android `GhostiFirebaseMessagingService` + iOS `AppDelegate.swift` 백그라운드 수신기 구현으로 앱이 닫혀 있거나 화면이 꺼져 있어도 0.5초 내 기기 내 복호화 후 `[📋 복사]` 1탭 알림 표시 완결.
   - `MerlinHub` 전담 에이전트에 우체국 공문 발송(`MerlinHub_Ghosti_3귀신_전사모바일백그라운드푸시_원소스규격및허브SDK통합제안_20261127_1519.md`)하여 전사 24개 앱 공용 푸시 SDK 관제 이관 준비 완료.
2. **모바일 `[모니터로 크게 보기]` 라이트모드 팝업 배경 복원 및 `고스트 모니터 캐스트 (Ghost Monitor Cast)` 알약 배지 1줄 정합화 (`v1.0.130 (130)` 양대 스토어 동시 출시, 카드 `425f9ffd-2c1d-81b3-a578-eafec6ee5822` `'재테스트 대기'`) (2026-11-27)**
   - 달나라님 피드백 반영: 화면 전체가 까맣게 덮여 앱이 멈춘 것처럼 보이던 전역 다크 오버레이를 라이트모드 반투명 딤드 + 흰색 카드 팝업으로 정상 복원(사진 뷰어 내부만 다크 유지).
   - 달나라님이 언급하셨던 `고스트 모니터 캐스트 (Ghost Monitor Cast)` 원본 배지명을 복원하고 모바일 360px에서도 단어 쪼개짐 없이 1줄로 표시되도록 UI 정합화 완료.
3. **달나라님 전용 100% 완결 QA 테스트 미션 3건 신설 (2026-11-27)**
   - 미션 1 (`425f9ffd-2c1d-819e-bb02-f361fa6d3126`): `⚡ [정식 APNs·FCM] 앱 종료·화면 꺼짐 시 PC ➔ 폰 선택 푸시 & [📋 복사] 1탭 검증 (앱 v1.0.130)`
   - 미션 2 (`425f9ffd-2c1d-81ee-976e-c52532bd1b10`): `💻 [모니터로 크게 보기] 밝은 팝업 배경 및 '고스트 모니터 캐스트' 알약 배지 1줄 확인 (앱 v1.0.130)`
   - 미션 3 (`425f9ffd-2c1d-8175-a783-db7104e7e451`): `🚀 [4. 내 기기 통합] Before/After 4대 실전 사례 펼치기 & 비즈니스 관문 점검`
4. **스마트폰 사진 `[PC로 텍스트 전송]`(`Ctrl+V`·7일 보관함 직송 정합화) & `[모니터로 크게 보기]` 무선 리모컨 정합화 (`v1.0.128 (128)` 양대 스토어 동시 출시, 카드 `425f9ffd-2c1d-81b3-a578-eafec6ee5822`) (2026-11-27)**
   - **① `[PC로 텍스트 전송]` (`PhotoDetailModal.tsx` · `기능명세.md`)**: 구 `귀신Key` 분리 정책(`4. 내 기기 통합` 웹 화면 & `Ctrl+V` 표준)에 맞춰 구 `'Ctrl+0 폰 전송 도착 안내줄'` 오안내를 제거하고, 모바일 미인덱싱 사진 온디바이스 OCR(`recognizeDataUrlWithPaddleOcr`) 폴백 + 7일 E2EE 우체통(`pushCrossDeviceClipboardText`) 동시 전송으로 PC 크롬 실행 여부와 무관하게 `Ctrl+V`와 `[4. 내 기기 통합]` 7일 보관함 최상단에 즉시 도착하도록 완결.
   - **② `[모니터로 크게 보기]` 모바일 알약 글자 끊김 해결 (`GhostCastAndLiveSystem.tsx`)**: 라이트 테마 전역 오버라이드 누락(`data-keep-dark="true"` 추가 및 1167행 속성 따옴표 오타 교정)과 비-래핑 행 압착으로 `고스트 모니터 캐스 / 트`가 어색하게 쪼개지던 현상을 `flex-wrap` + `shrink-0 whitespace-nowrap` 1줄 고정(`모니터로 크게 보기`) 및 `break-keep`으로 깔끔히 해결.
1. **`4. 내 기기 통합` 탭 상단 `[💡 이런 순간, 이렇게 달라집니다 (Before vs After)]` 접기/펼치기 실전 사례 탑재 (`[즉시실행]` 공문 완결, `DeviceIntegrationBeforeAfterShowcase.tsx`) (2026-11-27)**
   - 평소 1줄 배너로 접혀 있다가 클릭 시 펼쳐지는 Before vs After 아코디언 4대 시나리오(① 폰➔PC 무화면 1~2탭 직송, ② 외출 중 회사 PC·클라우드 드라이브 문서 1초 소환, ③ PC➔폰 선택 푸시 알림 `[📋 복사]` 1탭 복사, ④ 사진 원본 백업·다중 PC 상용구 동기화)를 데스크톱·모바일에 탑재하고 스토어 심사 모드(`isStoreAppMode`)에서 과금/월세 언급을 100% 분리 후 우체국 회신 완료.
1. **PC ➔ 폰 `[📱 폰으로 보내기]` 아이폰·안드로이드 푸시 알림 미표시 근본 해결 (`v1.0.127 (127)` 양대 스토어 동시 출시, 카드 `423f9ffd-2c1d-8060-a898-e06972a3376c` `'재테스트 대기'`) (2026-11-27)**
   - **근본 원인 4중 해부**: ① PC `sendClipToPhonePush`가 활성 `activePairChannel` WebSocket으로 `PC_TO_PHONE_CLIP_PUSH`를 직접 보내지 않고 서버 REST 브로드캐스트에만 의존해 실시간 전파가 누락됨, ② 모바일 `deviceIntegrationService.ts`(부팅·포그라운드·복귀) 및 iOS `SceneDelegate.sceneDidBecomeActive`가 `device_pull_phone_push_inbox`를 전혀 조회하지 않고 백그라운드 타이머만 정지시켜 앱 활성 중에도 알림이 뜨지 않음, ③ iOS `AppDelegate.swift`에서 비동기 `getNotificationCategories` 경합 및 `CAPNotificationRouter.localNotificationHandler` 미연결로 전면 배너가 무음 소거됨, ④ Android에서 스토어 업데이트 직후(`MY_PACKAGE_REPLACED`) 프로세스 미기동·화면 꺼짐/캐시 정지 후 워처 미복구 및 `nativePushRouter.ts`의 비-Firebase 환경 `POST_NOTIFICATIONS` 권한 요청 생략이 겹침.
   - **정공법 해결**: ① PC `sendClipToPhonePush`에서 서버 `pushId` 발급 즉시 `activePairChannel` WebSocket으로 35ms 직통 브로드캐스트 병행 + 모바일 부팅·복귀·가시 타이머에서 `pullPendingPhonePushInboxToMobile`(10분 캐치업, `pushId` 멱등 중복 제거) 상시 동기화, ② iOS `GhostiLocalClipNotificationHandler`(`CAPNotificationRouter.localNotificationHandler` 직결) + 메인 스레드 동기 카테고리 등록 + 포그라운드·백그라운드 듀얼 워처 가동, ③ Android `GhostiBridgeUpdateReceiver`(`MY_PACKAGE_REPLACED`·`BOOT_COMPLETED` 즉시 기동) + `GhostiPushKeepAliveJobService` 자가 치유 + 화면 켜짐(`ACTION_SCREEN_ON`/`USER_PRESENT`) 0ms 즉시 수신 + `nativePushRouter.ts` `POST_NOTIFICATIONS` 선행 권한 확보 완결.
1. **무료 `[3. 사진 공유]` 전 영역 업무 문서 드래그 차단 및 `[사내 공용 폴더(S:)로 바로 이동]` 안내 배너 전역 바인딩 (카드 `425f9ffd-2c1d-8127-aa44-f3869b6302b0` `'재테스트 대기'`) (2026-11-27)**
   - **원인**: 기존 드래그앤드롭 핸들러가 `[정리 대기실]`(`LoungeIndexingWaitingRoom.tsx`)에만 걸려 있어, 기본 `[사진 공유]` 앨범 메인(`GhostSearchPane.tsx`)·`[방 관리]`·여백에 엑셀·PDF·한글 파일을 놓으면 브라우저 기본 동작(파일 다운로드/열기)이 발화되던 누락 규명.
   - **해결**: 사진 공유 전 화면 상시 마운트 컴포넌트인 `FreePhotoShareOverlays.tsx`에 캡처 단계 `window` `dragover`/`drop` 전역 가드를 구축하여 비사진·비영상 업무 문서 드래그 시 브라우저 다운로드·업로드를 100% 차단하고 최상단 `[사내 공용 폴더(S:)로 바로 이동]` 안내 배너를 즉시 표출하도록 완결.
1. **폰↔PC 무화면 직송 및 PC➔폰 선택 푸시 실기기 피드백 4건 근본 해결 (`v1.0.126 (126)` 양대 스토어 출시, 카드 `423f9ffd-2c1d-8060-a898-e06972a3376c` `'재테스트 대기'`) (2026-11-27)**
   - **① Android 웹 드래그 `[공유 ➔ 귀신같이]` 시 링크 동반 부착 제거 (`GhostiQuickClipActivity.java`)**: 크롬 Highlight Share(`"본문"\nhttps://...#:~:text=...`) 감지 시 말미 페이지 링크와 감싸는 따옴표를 자동 정제해 드래그한 순수 글자만 전송(단독 URL 공유 시에는 URL 유지).
   - **② iOS `[공유... ➔ 귀신같이]` 거대 시트 축소 및 3초 지연 해소 (`ShareViewController.swift` · `GhostKeySharedClipboardStore.swift`)**: `78pt` 초소형 커스텀 시트 Detent 적용 + `viewDidLoad` `0ms` 즉시 발사(`viewDidAppear` 애니메이션 대기 제거) + Keychain 파생키 캐시(60,000회 PBKDF2 재연산 제거) + 로컬 히스토리 저장 백그라운드 병렬화로 즉시 전송·종료.
   - **③ iOS 선택 푸시 `[📋 복사]` 버튼 누락 해소 (`AppDelegate.swift` · `SceneDelegate.swift`)**: Capacitor NotificationRouter가 `UNUserNotificationCenter.delegate` 및 카테고리를 덮어쓰던 문제를 `GhostiPcClipNotificationProxy` 위임 프록시 + 발송 직전 카테고리 병합 등록으로 해결하여 알림을 아래로 당길 때 `[📋 복사]` 무화면 버튼 노출 및 배너 1탭 터치 즉시 복사 동시 보장.
   - **④ Android `[📱 폰으로 보내기]` 푸시 미표시 해결 (`GhostiNativeClipboardSync.java` · `ic_stat_ghosti_clip.xml` · `MainActivity.java`)**: Android 12~15에서 `AdaptiveIconDrawable`을 알림 `smallIcon`으로 거부하던 예외 및 `Notification.Action(0)` 예외를 단색 벡터 아이콘(`ic_stat_ghosti_clip`) + `NotificationCompat.Builder`(`PRIORITY_MAX` 헤드업 채널 `v2`)로 근본 해결.
1. **사진 공유 `[내 기기 원본 폴더 열기]` 윈도우 탐색기 미오픈 근본 해결 (`Z-Core v2.12.9`, 카드 `425f9ffd-2c1d-8149-ade8-f53e486b8365` `'재테스트 대기'`) (2026-11-27)**
   - **원인**: `LoungeFeedContextBanner.tsx`가 상대 경로 `fetch('/__club/download-originals')`(로컬 Vite 개발서버 전용 목업) 및 하드코딩 `D:\Ghosti\다운로드_원본`을 호출해 실운영(`https://ghosti.sundreamer.app`)에서 Netlify 404로 무응답 처리되던 문제 규명.
   - **해결**: `plugin_ghosti_os.py`(`sync_and_open_shared_room_originals`) 및 `merlin_z_core_daemon.py`(`POST /__club/download-originals`, `v2.12.9`)에 내 PC 공식 `[사진]\Ghosti_Shared_Rooms\<방이름>`(또는 사용자 지정 경로) 실물 폴더 생성·공유방 사진 자동 저장 및 `open_file_location_on_interactive_desktop` 윈도우 탐색기 `0.05초` 즉시 오픈을 정식 구현하고, `LoungeFeedContextBanner.tsx`에서 `getZCoreUrl('/__club/download-originals')` 직결 및 방별 경로 영속화 반영 완료.
1. **폰↔PC 무화면 OS 직송(텍스트·링크·사진 `CF_DIB`+`CF_HDROP`) & PC➔폰 `[📱 폰으로 보내기]` 선택 푸시 ➔ 알림 `[📋 복사]` 1탭 복사 전면 개통 · 노션 QA 미션카드 개편 및 사진 공유 직송 미션 신설 (`Z-Core v2.11.99` · 양대 스토어 `v1.0.124 (124)`) (2026-11-27)**
   - **"앱 열었다 닫기 / iOS `[붙여넣기 허용]` 터치" 억지 동선 및 폐기 커스텀 키보드(`GhostiClipboardImeService` · `GhostKeyKeyboardExtension`) 100% 제거**: 모바일 포그라운드 복귀 시 OS 클립보드 자동 읽기·덮어쓰기를 영구 제거해 iOS `[붙여넣기 허용]` 팝업과 Android 클립보드 읽기 알림을 0회로 소멸.
   - **① `[폰 ➔ PC]` 무화면 직송**: Android `GhostiQuickClipActivity`(`ACTION_PROCESS_TEXT` `[PC로 보내기]` 1탭 + `ACTION_SEND` `[귀신같이]` 2탭 텍스트·사진 직송) 및 iOS `GhostKeyShareExtension`(`app.sundreamer.ghosti.share` 프로비저닝 개통 · `[공유... ➔ 귀신같이]` 2탭 텍스트·링크·사진 무화면 직송) 완결. PC Z-Core(`plugin_paid_sync_ghostwin.py` · `merlin_z_core_daemon.py`)는 Windows `gdiplus.dll` 기반 `CF_DIB` 비트맵 + `CF_HDROP` 파일 핸들을 동시에 장전해 카톡·엑셀·워드·탐색기 `Ctrl+V` 및 웹 `4. 내 기기 통합` 화면 도착 카드로 직결.
   - **② `[PC ➔ 폰]` 알림 폭탄 0건 & `4. 내 기기 통합` 선택 푸시 `[📋 복사]` 1탭 복사**: 일반 PC `Ctrl+C`는 7일 보관함(`PC↔PC` 무버튼 직결)만 기록하고 폰 알림은 0건 유지. 귀신같이 PC 웹 `4. 내 기기 통합` 화면(7일 클립보드 보관함)에서 `[📱 폰으로 보내기]` 클릭 시에만 폰 상단 푸시 알림 1건 발송 ➔ Android `GhostiNotificationCopyActivity`(0ms 투명 포커스 복사) · iOS `GHOSTI_PC_CLIP`(`COPY_PC_CLIP`) 1탭으로 앱을 열지 않고 즉시 복사 (홀딩 중인 귀신Key/귀신창 관련 표현 일체 배제 완료).
   - **전사 오리지널 문서 9종(`상황별_슬로건`, `귀신같이_통합_가격표_마스터`, `귀신Key_기능소속_최종확정안`, `기능명세`, `귀신같이_기획서`, `귀신같이_가치명세서`, `귀신비서_FAQ_원본`, `정책_및_핵심원칙`, `docs/README.md`) In-Place 정합화 완료.**
1. **PC 연속 복사 ➔ 모바일 앱 열기 시 클립보드 도착 알림 누락 및 수 초 지연 근본 해결 (카드 `423f9ffd-2c1d-8060-a898-e06972a3376c` `'재테스트 대기'`, `Z-Core v2.10.99` · 양대 스토어 `v1.0.122 (122)`) (2026-11-27)**
   - 안드로이드 비포커스(`!act.hasWindowFocus()`) 거짓 성공 차단(`GhostiMobileCarePlugin.java`), 백그라운드 Realtime 수신 시 토스트 조기 소모 제거 및 포커스 확보 직후 주입·토스트 동시 보장 + 앱 복귀 `0ms` 병렬 원격 우체통 선행 수신(`deviceIntegrationService.ts`), PC Z-Core `0.12초` FIFO 배치 직렬화·Keep-Alive(`plugin_paid_sync_ghostwin.py`), 서버 단조 시각 및 Realtime HTTP 브로드캐스트(`workAndDeviceBridgeOps.mjs`) 반영 완료.
2. **전 기기 배포 트랙 이원화(`3·4호컴` QA 직결 vs `1·2·5·6호컴` GitHub Releases Auto-Update) 및 MS 공인 코드서명(`https://krc.codesigning.azure.net/`, `sundream-public-cert`) 개통 지침 숙지·적용 (2026-11-27)**
   - `[3귀신]` Z-코어 빌드·배포 시에도 `3·4호컴`만 QA 쾌속 배포하고 `1·2·5·6호컴`은 강제 덮어쓰기 없이 GitHub Releases 정식 버전 업로드를 통한 자체 Auto-Update로만 갱신하며, MS 공인 코드서명(`CN=썬드림주식회사`, `krc` 엔드포인트) 적용 원칙 준수 확정.
3. **동호회·동창회 `[추억]`/`[최근 근황]` 탭 PC↔모바일 분리 및 크게 보기·다 같이 보기 현재 탭 연동 (카드 `423f9ffd-2c1d-814d-8b46-d7f1ab89a476` `'재테스트 대기'`) (2026-11-26)**
   - 원인: 실운영 Supabase `ghosti_room_shared_photos.feed_track` 정식 컬럼 미생성(`42703`)으로 타 기기(모바일)가 서버에서 받을 때 동창회 기본값 `[추억]`으로 쏠림 ➔ 멀린님이 SQL Editor에서 `add column if not exists feed_track` 실행 완료(검증 `200`).
   - 멀린님 확정 1안: `GhostCastAndLiveSystem.tsx`에서 `[모니터로 크게 보기]`·`[다 같이 보기]`가 현재 탭 사진만 연동하고, 발표자가 다른 탭 사진을 보면 참여 멤버 화면도 같은 탭으로 자동 전환. `기능명세.md` §13.1 In-Place 반영, 양대 스토어 `v1.0.117 (117)` 출시.
   - 참고: 컬럼 추가 이전에 올린 사진은 서버 기본값(`recent_now`)으로 채워져 있으므로 재테스트는 새로 올린 사진 기준.
2. **단일 탭 로그아웃 후 다른 계정 로그인 시 `1 PC 1계정 보호` 충돌 안내창 오표시 근본 해결 (카드 `424f9ffd-2c1d-8061-961f-ced769e4c909` `'재테스트 대기'`) (2026-11-26)**
   - `GhostiHubInfraBridge.tsx`의 `performGhostiCleanLogout`에서 `purgeAllGhostiLocalAuthArtifacts()`로 로컬 이메일을 먼저 삭제한 직후 `clearWorkRoomLocalCachesOnLogout()`을 호출해 이전 계정 이메일이 `'anonymous'`로 판별되어 Z-코어 PC 점유 해제(`releaseLocalPcAccountOwner`)가 전혀 전송되지 않던 순서 역전 버그를 규명·수정.
   - 로그아웃 최상단에서 이전 이메일을 선확보해 Z-코어 `/__merlin/account-owner` `release`를 즉시 전송하고(`skipPcOwnerRelease`로 차단된 2번 탭의 로그아웃이 1번 탭 점유를 풀지 않게 보호), `pcSingleAccountGuard.ts`에서 `claim` 호출 전 진행 중인 `pendingReleasePromise` 완료를 직렬 대기시켜 단일 창 순차 교대 로그인 시 오경고 0% 보장.
2. **사진 공유 `[방 관리]` 정식 서버 브릿지 멤버 목록(`photo_list_room_members` · `photo_kick_room_member`) 직결 연동 + `0ms` SWR 선행 예열·콜드 로딩 `"1명"` 오표시 차단 + 양대 스토어 `v1.0.115 (115)` 배포 (카드 `424f9ffd` `'재테스트 대기'`) (2026-11-26)**
   - 1~3차: 서버 브릿지 `photo_list_room_members`·`photo_kick_room_member` 직결, 허브 최신 닉네임(`public.users.nickname`) 1순위 정합화, 동명이인 이메일 병기, 모바일 앱 번들 반영(`v1.0.114`).
   - 4차 UX 개선(`처음 3초간 썬드림(방장) 1명만 보이다가 뒤늦게 참여 멤버 표시`): `sharedPhotoRoomSupabase.ts`에 계정·방 단위 `0ms` SWR 캐시(`getCachedSharedPhotoRoomMembersSync`) 및 사진 공유 진입 즉시 가족·동호회·동창회 백그라운드 선행 예열(`prewarmMySharedPhotoRoomMembers`)을 추가하고, `LoungeCustomSettingsHeader.tsx`의 불필요한 직렬 방 생성 대기(`ensureMyRoomAndInviteToken`)를 제거해 `0ms` 즉시 조회로 단축하며 콜드 로딩 중에는 거짓 `(1명)` 대신 `불러오는 중...` 안내를 표시하도록 개선 후 양대 스토어 `v1.0.115 (115)` 동시 출시 완료.
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
- **"앱 열었다 닫기 / iOS `[붙여넣기 허용]` 터치" 동선 영구 폐기 확정**: ① `[폰 ➔ PC]`는 Android `[드래그 ➔ PC로 보내기]` 1탭 / iOS `[공유... ➔ 귀신같이]` 2탭(사진·스크린샷은 공통 `[공유 ➔ 귀신같이]` 2탭) 무화면 직송, ② `[PC ➔ 폰]`은 평소 `Ctrl+C` 알림 0건 + `[📱 폰으로 보내기]` 선택 푸시 ➔ 폰 알림 `[📋 복사]` 1탭 복사로 전면 재정립.
- 한 PC 다중 프로필 동시 로그인은 카카오톡 PC 방식의 **동시 1계정 단독 점유**(전환 모달 1클릭 인수인계)로 통일하고, 부부·개인/업무 순차 교대 로그인 시 사진 백업 폴더는 계정별 하위 폴더로 100% 분리 보존.
- 1~4귀신이 공용 엔진(`universal_z_core/`)·브릿지(`workAndDeviceBridgeOps.mjs`)를 수정할 때는 반드시 `zcore_board.py` 문패를 걸고 커밋·푸시 직후 즉시 내리는 원칙 확립.

## 다음 체크인 시 바로 이어할 1순위 과제
- [ ] `python d:\Ghosti\z_core_watcher.py --watch --role 3` 기동 후 달나라님 `'재테스트 대기'` 카드(`PC ↔ 모바일 양방향 클립보드 v1.0.110`, `안드로이드 2회차 사진 동기화 v1.0.107` 등) 및 남은 실기기 테스트 미션 피드백 즉시 대응 (`발견된 버그` 현재 `0건`).
