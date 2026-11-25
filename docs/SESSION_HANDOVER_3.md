# 🟠 `[3귀신]` 세션 인계장 (`SESSION_HANDOVER_3.md` — 사진 공유 · 내 기기 통합 · 모바일 앱)

- **최종 갱신 일시**: 2026-11-25 16:35 (KST)
- **담당 역할**: `[3귀신]` (사진 공유 · 내 기기 통합 Pro · 모바일 웹 브릿지 · 양대 스토어 앱)
- **QA 담당 테스터**: **달나라님** (노션 `담당 = 달나라` 고정)
- **최신 배포 버전**: **`Merlin Z-Core v2.9.20`** (1~6호기 전 클러스터 반영 완료) · 양대 스토어 **`v1.0.110 (110)`** (Google Play 내부 테스트 활성 & Apple TestFlight `VALID` 확인 완료, 커밋 `4061e83` · `f179fb6`)
- **세션 창 제목**: `3귀신 클립직결·v110`

## 완료 내역 (2026-11-25)
1. **PC ↔ 모바일 양방향 클립보드 10초 지연·누락·iOS 키보드 근본 해결 및 양대 스토어 `v1.0.110` 출시 (`4061e83`, `f179fb6`, `Z-Core v2.9.20`, 카드 `423f9ffd-2c1d-8060-a898-e06972a3376c` `'재테스트 대기'`)**
   - **PC 메모장 복사 `0.2초` 직통 E2EE 데몬 (`plugin_paid_sync_ghostwin.py` · `merlin_z_core_daemon.py` `v2.9.20`)**: 크롬 창이 메모장 등에 가려져 백그라운드 절전(`~10초` 스로틀링)이 걸리거나 최소화되어도 즉시 전송되도록, 웹 로그인·토큰 갱신 시 `POST /__sync/auth-context`(로그아웃 시 `clear: true` 즉시 파기)로 인증 컨텍스트를 전달받아 외부 패키지 없이 순수 Win32 `bcrypt.dll` `AES-256-GCM`(`PBKDF2` 60,000회) 스레드가 `0.22초` 주기로 `GetClipboardSequenceNumber()`를 직접 감시·직통 발송하고 `1.5초` 주기로 스마트폰 복사본을 자동 주입하도록 구현 (1~6호기 전 클러스터 무중단 스왑 완료).
   - **서버 우체통 직렬화 & 모바일 복귀 누락 차단 (`workAndDeviceBridgeOps.mjs` · `deviceIntegrationService.ts`)**: `device_push_e2ee_clip`에 계정별(`emailHash`) 비동기 직렬화 락 + `createdAt` 최신순 정렬을 적용해 `Test 1 ➔ Test 2 ➔ Test 3` 고속 연속 복사 시 덮어쓰기를 제거하고, 모바일 포그라운드 복귀 타이머 밀림 제거(`45ms` 즉시 감지) 및 실제 OS 클립보드 쓰기(`writeTextToLocalOsClipboard === true`) 성공 시에만 봉투를 완료 각인하도록 수정.
   - **iOS `GhostKeyKeyboardExtension` 정식 타겟 탑재 (`project.pbxproj` · `GhostKeySharedClipboardStore.swift` · `KeyboardViewController.swift` · `SceneDelegate.swift` · `ghosti_ios_testflight.yml`)**: App Store Connect에 `app.sundreamer.ghosti.keyboard` 번들 ID 및 `Ghosti Keyboard App Store` 프로비저닝을 등록하고, 본체 프로필 무결성을 유지하는 Shared Keychain(`7K5PPQDZ5L.app.sundreamer.ghosti`) + Swift 직통 E2EE 키보드를 연결해 Google Play(`110 / 1.0.110`)·TestFlight(`110 / VALID`) 모두 정식 업로드 완료 확인 후 노션 카드를 전환.
2. **동일 PC 동시 1계정 단독 점유 정책 확정 · 백업 폴더 계정별 하위 격리 (`cd76f18`, `d6e4a16`, `Z-Core v2.9.10`)**
   - `docs/정책_및_핵심원칙.md` §5.4-⑨ 외 6대 문서에 카카오톡 PC 방식 **‘1PC 동시 1계정 단독 점유(순차 교대 로그인 무제한 허용)’** 원칙을 박제하고 `4귀신`과 공동 적용.
   - 내 기기 통합 백업 경로를 `Pictures\Ghosti_Phone_Backup\<계정폴더>`로 계정별 격리하고 타 계정 하위 백업 폴더가 로컬 사진 스캔에 섞이지 않도록(`_is_other_account_phone_backup_dir`) 방어.
3. **1~4귀신 공용 엔진 작업 문패 장부(`zcore_board.py`) 구축 및 전파 (`c74ffeb`)**
   - `msvcrt.locking` 파일 락 기반 `claim` / `heartbeat` / `release` / `status` 장부와 `z_core_watcher.py` 0초 미해제 차단·대기열 자동 기상 가드를 구축하고 `AGENTS.md` 및 아키텍처 명세서에 반영 완료.
4. **안드로이드 2회차 사진 동기화 90초 지연 0.5초 단축 (`d6cd271`, `v1.0.107`, 카드 `423f9ffd-2c1d-80a4-b074-dcf693ad54d5` `'재테스트 대기'`)**
   - 서버 `mirror_blobs/` 기보유 선대조(`skipExisting`), 클라이언트 `x-upsert: true`, `shadow_catalog` 중복 `thumbWebp` 페이로드 제거로 2회차 동기화를 `0.5초` 내로 단축.

## 직전 대화 맥락 및 결정사항
- 한 PC 다중 프로필 동시 로그인은 카카오톡 PC 방식의 **동시 1계정 단독 점유**(전환 모달 1클릭 인수인계)로 통일하고, 부부·개인/업무 순차 교대 로그인 시 사진 백업 폴더는 계정별 하위 폴더로 100% 분리 보존.
- 1~4귀신이 공용 엔진(`universal_z_core/`)·브릿지(`workAndDeviceBridgeOps.mjs`)를 수정할 때는 반드시 `zcore_board.py` 문패를 걸고 커밋·푸시 직후 즉시 내리는 원칙 확립.

## 다음 체크인 시 바로 이어할 1순위 과제
- [ ] `python d:\Ghosti\z_core_watcher.py --watch --role 3` 기동 후 달나라님 `'재테스트 대기'` 카드(`PC ↔ 모바일 양방향 클립보드 v1.0.110`, `안드로이드 2회차 사진 동기화 v1.0.107` 등) 및 남은 실기기 테스트 미션 피드백 즉시 대응 (`발견된 버그` 현재 `0건`).
