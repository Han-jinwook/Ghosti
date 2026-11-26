# 📋 귀신같이 (Ghosti) 1~4귀신 통합 세션 인계장 (`SESSION_HANDOVER.md` — 자동 합본)

> ⚠️ **[자동 합본 안내 — 직접 수정 금지]**: 본 파일은 `z_core_watcher.py`가 `SESSION_HANDOVER_1.md` ~ `SESSION_HANDOVER_4.md` 4개 파일을 기계적으로 이어붙여 생성합니다. 체크아웃 시 각 창은 **오직 자기 번호 파일(`docs/SESSION_HANDOVER_N.md`)만 수정**하세요.

---

# 🟢 `[1귀신]` 세션 인계장 (`SESSION_HANDOVER_1.md` — 온보딩 · 귀신비서 · 여권)

- **최종 갱신 일시**: 2026-11-25 23:15 (KST)
- **담당 역할**: `[1귀신]` (온보딩 · 귀신비서 · 사진 정리 · 얼굴 여권 · 전 영역 FAQ · 3대 모드 전환기 · Z-코어 총괄)
- **세션 창 제목**: `1귀신 손보기4+1정규화`

## 완료 내역 (2026-11-25)
1. **『PC 손보기 4 + 1 정규 카테고리』 헌법화 · 동적 4칸 성적표(아코디언 펼침) UI · 잊고 있던 앱 3대 안심 힌트 실구현 및 6대 공식 문서 동기화 (`23aff53`, `Z-Core v2.9.29`)**
   - **4+1 정규 카테고리 단일화**: ① `⚡ 속도 높이기`(실시간 CPU·RAM·시작프로그램·서비스 수동전환·고성능 전원) · ② `🛡️ 광고·보안앱`(애드웨어/그리드 적출·은행보안 무삭제 수면·순정 백신) · ③ `💾 용량·묵은 앱`(안전 캐시·`hiberfil.sys`·잊고 있던 미사용 앱·`D:` 이사) · ④ `🗂️ 바탕화면·사진`(화면 파일 정돈·특수 아이콘 숨김·사진 4대 탭) + 상시 안전핀 `🕰️ 구출·1초 되돌리기`(`ghostCareAgentEngine.ts`, `MonsterInteractiveCards.tsx`).
   - **잊고 있던 설치 프로그램 3대 안심 힌트 실측 (`plugin_ghosti_care_suite.py` `list_installed_programs`)**: 무관리자 Read-Only로 실행 중 프로세스·`Recent`·앱 폴더/`AppData` 최근 수정 시각(`mtime`, 회사명 불용어 오탐 배제)·설치일을 교차 실측해 `📌 용도(plainRoleKo)` · `🕒 마지막 사용 시점(lastUsedLabelKo)` · `🛡️ 안전 배지 + [이게 뭐예요?]`를 함께 표시하고 오래 안 쓴 큰 앱부터 우선 정렬.
   - **6대 공식 문서 전수 반영 & 전 클러스터(`1·2·3·4·5·6호컴`) `Z-Core v2.9.29` 배포 완료**: `docs/손보기_최종기획안.md`(`§0-11`), `docs/귀신같이_기획서.md`, `docs/기능명세.md`(`§5.9-6`), `docs/귀신같이_가치명세서.md`, `docs/귀신비서_FAQ_원본.md`(`Q1-12`), `docs/README.md` In-Place 동기화 및 1~6호컴 무중단 배포 완료.
   - **노션 QA 미션 카드 전면 갱신**: 구버전 실전 손보기 카드 2장 제거(`archived`) 후 해나라(`423f9ffd-2c1d-81e8-8a83-fcbe30a7d6df`)·달나라(`423f9ffd-2c1d-8171-ae20-e120f2a970d5`) 각 1장씩 정해진 예시 문구 없이 본인 평소 말투로 4대 영역을 테스트하는 새 미션 카드 배치 완료.
2. **당일 `[1귀신]` 노션 QA 버그 10건 전량 수정·배포 및 `'재테스트 대기'` / `'완료'` 전환 (`fd174a0` ~ `84f374a`)**
   - `내 프로필 닉네임 ↔ 귀신비서 별명` 양방향 단일 통일(`2c00c56`), 전사 `Merlin Hub SDK v2.26.5`(`1-A`) 순정 블루 로그아웃 동기화(`8651fc6`), 첫 화면 부팅 경량화(`/__docs/list` 지연 로딩·번들 `-64%` 분할) 및 실시간 CPU/RAM 속도 진단(`119d5ac`), 시작프로그램 제자리 스위치·공용 `HKLM` 1회 UAC 토글(`af16ecb`), 개인 사진 정리 `S:\` 업무 드라이브 분리(`63444c3`), 시기별 여권 5장 충족 가드(`bb700cd`), 3대 모드 전환기 `v1.1.0`(`0b742fa`), `'정기 점검'` 단독 입력 즉시 실행(`84f374a`).

## 다음 체크인 Todo
- [ ] **해나라·달나라 『PC 손보기 4+1 새 표준』 및 `[재테스트 대기]` 8건 피드백 대응**: 테스터 자유 말투 명령 중 미인식 표현이나 엣지 케이스 발생 시 즉시 보강.
- [ ] **남은 `[1귀신]` 미착수 미션 15건(모바일 실기기·모드전환 왕복·백신·압축·구출·FAQ) 완주 모니터링**.

---

# 🔵 `[2귀신]` 세션 인계장 (`SESSION_HANDOVER_2.md` — 귀신검색 · 귀신창 · OCR · 라벨러)

- **최종 갱신 일시**: 2026-11-25 16:32 (KST)
- **담당 역할**: `[2귀신]` (귀신검색 · `Ctrl+0` 귀신창 · 사진/표 OCR · 귀신라벨링 · 동영상 재생)
- **공정 달성률**: 코드 완성도 **`94%`** (`Z-Core v2.9.9` / 커밋 `8486b00`) · 테스팅 완성도 **`45%`** (완료 5건 / 테스트 중 1건 / 재테스트 대기 3건 / 테스트 미션 9건 / 미결 버그 0건)
- **세션 창 제목**: `2귀신 Z코어v2.9.9·문서최신화`

## 완료 내역
1. **귀신검색창(`51988`) 5대 먹통·부팅 공백 근본 처치 & 전 클러스터 배포 (`Z-Core v2.8.61 ~ v2.9.9`, `d463420` · `ff11622` · `9ab4b47` · `ab35d0f`)**
   - PyInstaller `--onefile` ➔ **`--onedir`** 전환(`Merlin_Z_Core_Setup.exe` + `_internal/`)으로 123초 `_MEI` 2차 압축해제/Defender 지연을 제거하고 부팅을 `1~2초`로 단축.
   - `seq_paste_daemon.py` 기동 순서 역전(`0.1초` `RegisterHotKey(Ctrl+0)`·`WH_MOUSE_LL`·`PeekMessageW` 최우선 바인딩, 무거운 `Tkinter/PIL/OCR` 에셋 예열은 `root.mainloop()` 진입 후 `root.after(80)` 및 백그라운드 스레드로 지연).
   - 초기 부팅 중 워치독 오판 자살(`ui_stage=init` 19.7초 킬) 원천 차단(초기 워밍업 스테이지 45초 부팅 유예 + `plugin_ghosti_superpowers.py` `--onedir` 재스폰 유예 `45초 ➔ 12초` 단축).
   - Win32 Named Mutex(`Local\MerlinGhostiSeqPasteDaemon_v1`) 원자적 핸드오프(`_release_single_instance_mutex` 선반납 + `WaitForSingleObject(2.5s)`), 28개 전 구역 동기 `SendMessageW` `0건` 전수 박멸(`_send_msg_timeout_val`), `WH_MOUSE_LL` 90초 주기 무중단 `Hook-Swap`(`WM_APP_REHOOK`), 롤링 블랙박스 진단 로그(`%LOCALAPPDATA%\Ghosti\data\seq_paste_diag.log`, 512KB), `WM_RBUTTONUP` 중복 발화 억제 적용.
   - 1~6호기 전 클러스터 `Z-Core v2.9.9` 무중단 배포 및 `zcore_board.py` 공용 엔진 작업 문패 반납 완료.
2. **2계층 전 드라이브 공정 라운드-로빈 BFS 스캔 & `바다`/`캠핑`/`우루과이` 누락 근본 해결 (`2046ef8` · `811050c`, `v2.8.64 ~ v2.8.91`)**
   - `ghosti_setup_parity.py`: 드라이브 간(`C:`·`D:`·`E:`) 1:1 교차 + 드라이브 내 주요 폴더(`Desktop`/`Downloads`/`Documents`/`Pictures`/`Videos`/`카카오톡 받은 파일`) 1:1 교차 스캔으로 특정 대용량 폴더의 1,200폴더 상한 독점 원천 차단.
   - `C:\` 직하 개발 레포(`.git`/`package.json` 등) 및 보안 폴더(`xecuressl`/`wizvera` 등) 자동 배제, `C:\MerlinTools\Ghosti_Test_Corpus` 자동 포함, 드라이브별 공정 쿼터(`_select_fair_by_drive`, 최대 14,000건) 적용 (4호기 실측: `C:` 스캔 폴더 `1,212 ➔ 84개`, `바다` `1 ➔ 47건`, `캠핑` `2 ➔ 54건`, `우루과이` `0 ➔ 3건`).
3. **한글 IME 실시간 미확정 음절(`ImmGetCompositionStringW`) · 활성 창 한/영 상태 자동 계승 · `UI2` `0.72ms` 스템 캐시 · `[원본 열기]` 3중 폴백 (`fd174a0` · `66e2420`, `v2.8.79 ~ v2.8.94`)**
   - `ghost_search_window_ui2.py` · `seq_paste_daemon.py`: 스페이스바/엔터 확정 전 조합 중인 마지막 한글 음절(`'바'` + `'다'` ➔ `'바다'`) 실시간 결합 검색 + 소환 직전 활성 창의 한/영 상태(`ImmGetConversionStatus` & `WM_IME_CONTROL`, 바탕화면 경유 시 직전 0.45초 사용자 창 상태 유지) 자동 동기화.
   - `UI2` 14,000건 사전 토크나이즈 스템 캐시(`_s_title`/`_s_sub`/`_s_tags`)로 타이핑 1글자당 필터링 `94.2ms ➔ 0.72ms`(130배 단축), `[원본 열기]` STA COM `CoInitializeEx` + `os.startfile` + `ShellExecuteW("open")` 3중 폴백 및 `selected_fp_lock` 적용.
4. **상단 타이틀바·필터바 자유 드래그 이동 (`4c55e23`, `v2.8.93` — 해나라님 테스트 통과 `완료`!) & `[조용한 정리 | 빠른 정리]` 토글 안내 일원화 (`f7ea54d`)**
   - 다중 모니터 클램핑, 드래그 중 외부 클릭 오닫힘 방어(`ui_dragging`), 드래그 후 `small ➔ medium` 확장 시 이동 위치 유지 및 닫은 뒤 재소환 시 마우스 커서 위치 초기화.
   - `SilentIndexingStatusBar.tsx` 토글 명칭 통일 및 인라인 한 줄/툴팁 차이점 설명 추가.
5. **문서 3종 In-Place 최신화 (`8486b00`)**
   - `docs/기능명세.md`, `docs/멀린_Z_코어_통합_아키텍처_명세서.md`, `docs/README.md`에 `Z-Core v2.9.9` 아키텍처 및 `[2귀신]` 5대 핵심 변경사항 100% 반영 완료.

## 다음 체크인 Todo
- [ ] `python d:\Ghosti\z_core_watcher.py --watch --role 2` 기동 후 해나라님 `테스트 중`(1건: `C드라이브만 검색`), `재테스트 대기`(3건: `귀신검색창 실행 안됨 재발생` · `검색창 언어 문제` · `작은 귀신검색창 무관 파일 노출`), `테스트 미션`(9건) 피드백/버그 즉시 대응 (테스팅 `45% ➔ 100%` 완주).

---

# 🟠 `[3귀신]` 세션 인계장 (`SESSION_HANDOVER_3.md` — 사진 공유 · 내 기기 통합 · 모바일 앱)

- **최종 갱신 일시**: 2026-11-26 13:45 (KST)
- **담당 역할**: `[3귀신]` (사진 공유 · 내 기기 통합 Pro · 모바일 웹 브릿지 · 양대 스토어 앱)
- **QA 담당 테스터**: **달나라님** (노션 `담당 = 달나라` 고정)
- **최신 배포 버전**: **`Merlin Z-Core v2.9.20`** (1~6호기 전 클러스터 반영 완료) · 양대 스토어 **`v1.0.115 (115)`** (Google Play 내부 테스트 & Apple TestFlight 동시 출시)
- **세션 창 제목**: `3귀신 방관리·v1.0.115`

## 완료 내역 (2026-11-25 ~ 11-26)
1. **사진 공유 `[방 관리]` 정식 서버 브릿지 멤버 목록(`photo_list_room_members` · `photo_kick_room_member`) 직결 연동 + `0ms` SWR 선행 예열·콜드 로딩 `"1명"` 오표시 차단 + 양대 스토어 `v1.0.115 (115)` 배포 (카드 `424f9ffd` `'재테스트 대기'`) (2026-11-26)**
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
- 모바일 클립보드는 복잡한 시스템 키보드 설정을 일반 유저에게 요구하지 않고 **간단한 `[붙여넣기 허용]` 팝업 + 앱 열기 기본 연동**으로 확정.
- 한 PC 다중 프로필 동시 로그인은 카카오톡 PC 방식의 **동시 1계정 단독 점유**(전환 모달 1클릭 인수인계)로 통일하고, 부부·개인/업무 순차 교대 로그인 시 사진 백업 폴더는 계정별 하위 폴더로 100% 분리 보존.
- 1~4귀신이 공용 엔진(`universal_z_core/`)·브릿지(`workAndDeviceBridgeOps.mjs`)를 수정할 때는 반드시 `zcore_board.py` 문패를 걸고 커밋·푸시 직후 즉시 내리는 원칙 확립.

## 다음 체크인 시 바로 이어할 1순위 과제
- [ ] `python d:\Ghosti\z_core_watcher.py --watch --role 3` 기동 후 달나라님 `'재테스트 대기'` 카드(`PC ↔ 모바일 양방향 클립보드 v1.0.110`, `안드로이드 2회차 사진 동기화 v1.0.107` 등) 및 남은 실기기 테스트 미션 피드백 즉시 대응 (`발견된 버그` 현재 `0건`).

---

# 🟣 `[4귀신]` 세션 인계장 (`SESSION_HANDOVER_4.md` — 업무 공유 `S:` · 1PC 단일 계정 점유 · 기본 QA 미션 완비)

- **최종 갱신 일시**: 2026-11-25 16:40 (KST) — 정상 체크아웃 완료
- **담당 역할**: `[4귀신]` (`5. 업무 공유 (S:)` 전담 + 귀신비서 제미니 에이전트 PC 자가케어 1·2차 고도화)
- **최신 배포 버전**: **`Merlin Z-Core v2.9.19`** (전 클러스터 1~6호기 무중단 원자적 스왑 완료) · 양대 모바일 스토어 **`v1.0.109 (109)`** (`e1c4548`)
- **세션 창 제목**: `4귀신 1PC단일계정·S안정`

## 완료 내역 (2026-11-24 ~ 11-25)
1. **동일 PC 동시 1계정 단독 점유(카카오톡 PC 방식) SSOT 구축·검증·배포 (`d4dd45d`, `v1.0.108` / `Z-Core v2.8.99`)**
   - 구 다중 계정 공존 임시 코드(`accountWorkEntitlements` 등) 전면 폐기 후 `docs/정책_및_핵심원칙.md` §5.4-⑨ 확정안 반영.
   - Z-코어 `GET/POST /__merlin/account-owner`(`%LOCALAPPDATA%\Merlin\active_pc_account_owner.json`, 탭별 `sessions` 추적 · `75s` TTL · `pagehide` 시 세션 슬롯만 즉시 반납하여 대장 PC 24시간 `S:` 유지와 순차 교대 로그인 마찰 0초 양립) + 프론트 공용 SSOT `src/services/pcSingleAccountGuard.ts` + `GhostiHubInfraBridge.tsx` 충돌 전환 모달(`[이 계정으로 전환하기]` 클릭 시 기존 창 4초 내 `DISPLACED_BY_OTHER_ACCOUNT` 자동 로그아웃·`S:` 해제) 완결 및 `3귀신` 연동 인계 완료.
2. **업무 공유(`S:`) 팀원 내보내기(Kick) 보안·UX·모바일 미참여 화면 정합화 (`906b6cd`, `7dc39a1`, `f138275`, `1e50cb8`)**
   - 내보내기 재확인 모달 단순화, 확인 즉시 팀원 카드 제거·초대 토큰 자동 회전, 피추방 팀원 화면에서 사용자가 `[확인]`을 누를 때까지 유지되는 `[공유방 연결 해제 안내]` 모달 적용.
   - `_TUNNEL_LOCK` 재진입 교착(`Lock` ➔ `RLock`) 근본 수정, 비활성 본인 방장방(`isHost && !ownerGate.ok`)을 `work_list_my_rooms`에서 제외해 모바일 앱이 항상 `'현재 연결된 업무 공유방이 없습니다'`로 일관 표시되도록 교정, 새 초대 링크 재합류 시 이전 해제 안내 기록 즉시 소거.
3. **업무 공유(`S:`) 실전 연동 4대 버그 근본 처치 (`e1c4548`, `v1.0.109` / `Z-Core v2.9.19`, 카드 `41df9ffd`)**
   - **별명 자가 치유**: 초대 수락 직후 허브 세션 동기화 틈새에 `'초대 팀원'` 임시 문자열이 DB에 저장되던 버그를 클라이언트·서버 양단에서 원천 차단하고, 기존 `'초대 팀원'` DB 레코드도 허브 실닉네임/이메일 아이디로 자동 PATCH 치유.
   - **팀원 PC `.jpg` `[⏳ 업로드 중...]` 무한 대기 해소**: 비방장(팀원 PC)에서 `upsertWorkFilesToSupabase`가 방장 전용 아웃바운드 터널을 오기동해 자기 터널로 덮어쓰던 근본 원인을 `isHost` 가드 + Z-코어 `WORK_HOST_ONLY_TUNNEL` 차단으로 박멸하고, 업로드 `AbortController` 타임아웃(12~15초) 및 터널 회전 시 1회 자동 재획득 + `try/finally` 상태 해제 적용.
   - **`(n건 동기화됨)` 숫자 반복 증가 차단**: `mapRawWorkFileToDto` 가짜 해시 문자열 제거, `pull_sync_work_files` 크기·수정시각(`±3초`)·바이트 해시 3중 멱등성 검증 및 `pullSig` 변경 시에만 동기화 실행하도록 교정.
   - **팀원 카드 깜빡임(생겼다 사라짐) 해소**: `REQUEST_WORK_SNAPSHOT` 시 방장의 구 메모리 멤버 목록 브로드캐스트 제거, 초대 수락 즉시 `WORK_MEMBERS_UPDATED` 전파, `joinedInvitedRoom`/`serverMembers` 참조 안정화로 불필요한 Realtime 재연결 루프 제거.
4. **오늘 중요 이슈 공식 문서 4종 최신화 (`de0afa1`) 및 빠진 기본 테스트 미션 4장 신규 출제 완료**
   - `docs/정책_및_핵심원칙.md`, `docs/기능명세.md`, `docs/멀린_Z_코어_통합_아키텍처_명세서.md`, `docs/README.md` 현행화 완료.
   - 기본 테스트 100% 완주를 위해 누락되어 있던 핵심 검증 미션 4장 노션 `테스트 미션`(`담당: 달나라`) 등록 완료:
     - `423f9ffd-2c1d-8171-91e4-c1d75a3f2aad`: `🟣 [4귀신] 🔒 [신규 정책 · 한 컴퓨터 1계정 단독 사용]`
     - `423f9ffd-2c1d-8193-bc71-f327c72660fe`: `🟣 [4귀신] 💼 [업무 공유 S: 실전 연동 2/2]` (열람 중 잠금 & 휴지통 삭제·아이폰 확인)
     - `423f9ffd-2c1d-8149-962c-c6fd4fa542e7`: `🟣 [3귀신] 📂 [신규 정책 · 계정별 백업 폴더 분리]`
     - `423f9ffd-2c1d-814d-8b46-d7f1ab89a476`: `🟣 [3귀신] 🎓 [사진 공유 · 모임 탭 분리 & 같이 보기]`
5. **현 시점 `[4귀신]` 공정 달성률 (2026-11-25 16:40 기준)**
   - **코드 완성도 `94%` / 실기기 테스팅 완성도 `35%`** (완료 5건, 재테스트 대기 2건, 발견된 버그 0건, 기본 테스트 완주용 미션 12건 대기).

## 다음 체크인 Todo
- [ ] **재테스트 대기 2건(`팀원 내보내기 S: 보호`, `실전 연동 1/2 별명·업로드·동기화`) 및 신규 미션(`1PC 1계정 단독 사용`, `실전 연동 2/2 열람 잠금·삭제`) 테스터 결과 대응**.
- [ ] **실전 미션(`G:` 구글드라이브·`MYBOX` 동시 연결, `.gsheet` 검색, 외부망 LTE 직통 터널·모바일 현장 업로드, 5인 정원 초과 차단, 야간 초절전 하룻밤 가동) 피드백 즉시 패치**.
