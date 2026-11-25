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

---

# 🟣 `[4귀신]` 세션 인계장 (`SESSION_HANDOVER_4.md` — 업무 공유 `S:` · 1PC 단일 계정 점유 · 귀신비서 고도화)

- **최종 갱신 일시**: 2026-11-25 15:37 (KST)
- **담당 역할**: `[4귀신]` (`5. 업무 공유 (S:)` 전담 + 귀신비서 제미니 에이전트 PC 자가케어 1·2차 고도화)
- **최신 배포 버전**: **`Merlin Z-Core v2.9.19`** (전 클러스터 1~6호기 무중단 원자적 스왑 완료) · 양대 모바일 스토어 **`v1.0.109 (109)`** (`e1c4548`)
- **세션 창 제목**: `4귀신 비서고도화·v2.8.01완결`

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
4. **귀신비서 제미니 에이전트 자유 문답 + 다중 PC 정리 1·2차 고도화 및 `MerlinHub` 크로스체크 `PASS` (`394a66b` ~ `684c1eb`)**
   - `C:` 공간 도둑 3초 스캔·`D:\귀신비서_보관함` 이사, 데스크톱 배터리 가드, 보안모듈·애드웨어 2분류, 미등록 숨은 쥐새끼 전수 수색(`GET /api/care/hidden-rats-scan`) + 제미니 3단계 해석 + 무삭제 `Manual` 전환(`POST /api/care/hidden-rats-apply`) 완결.
5. **현 시점 `[4귀신]` 공정 달성률 (2026-11-25 15:37 기준)**
   - **코드 완성도 `94%` / 실기기 테스팅 완성도 `35%`** (노션 카드 완료 5건, 재테스트 대기 2건, 발견된 버그 0건, 미착수 실전 테스트 미션 10건 대기).

## 다음 체크인 Todo
- [ ] **재테스트 대기 2건(`팀원 내보내기 S: 보호`, `실전 연동 1/2 별명·업로드·동기화`) 테스터 확인 결과 대응**.
- [ ] **미착수 실전 미션 10건(`G:` 구글드라이브·`MYBOX` 동시 연결, `.gsheet` 검색, 외부망 LTE 직통 터널·모바일 현장 업로드, 5인 정원 초과 차단, 야간 초절전 하룻밤 가동, 달나라 PC 대화형 자가케어) 피드백 즉시 패치**.
