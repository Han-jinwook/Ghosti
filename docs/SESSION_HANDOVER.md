# 📋 귀신같이 (Ghosti) 1~4귀신 통합 세션 인계장 (`SESSION_HANDOVER.md` — 자동 합본)

> ⚠️ **[자동 합본 안내 — 직접 수정 금지]**: 본 파일은 `z_core_watcher.py`가 `SESSION_HANDOVER_1.md` ~ `SESSION_HANDOVER_4.md` 4개 파일을 기계적으로 이어붙여 생성합니다. 체크아웃 시 각 창은 **오직 자기 번호 파일(`docs/SESSION_HANDOVER_N.md`)만 수정**하세요.

---

# 🟢 `[1귀신]` 세션 인계장 (`SESSION_HANDOVER_1.md` — 온보딩 · 귀신비서 · 여권)

- **최종 갱신 일시**: 2026-11-28 15:25 (KST)
- **담당 역할**: `[1귀신]` (온보딩 · 귀신비서 · 사진 정리 · 얼굴 여권 · 전 영역 FAQ · 3대 모드 전환기 · Z-코어 총괄)
- **세션 창 제목**: `1귀신 모바일손보기·온보딩`
- **배포 버전**: **`Z-Core v2.13.89`**, **`3대 모드 전환기 v1.3.0`** (1~6호컴 전 기기 바탕화면 수동 설치 완료), 양대 스토어 모바일 앱 **`v1.0.131 (131)`**
- **노션 QA 상태**: `[발견된 버그]` 0건, 해나라·달나라 2인 모바일 스토어 자동 업데이트 ON 설정 미션 카드(`426f9ffd-2c1d-8129-ac5f-e720deb688a5`, `426f9ffd-2c1d-81cd-83cb-ce64f265be71`) 및 `안 쓰는 앱 솎아내기` 미션 카드(`425f9ffd-2c1d-81bb-94a2-fe6e0d77c172`) 등록 완료

---

## 🚀 완료 내역 (2026-11-27 ~ 2026-11-28)

### 0. Wave 1 `귀신Key` 하드락 · 일반화된 구버전 자동 정리 SSOT · 원격 SSH 직결 배포 완전 폐지 & GitHub Releases 단일 자동 업데이트 (`사내 45초` / `일반 유저 1시간`, `Z-Core v2.13.89`) · `3대 모드 전환기 v1.3.0` 1~6호컴 일괄 설치
- **Wave 1 `귀신Key`(구 귀신창) 하드락 & 자가업데이트 무소음**: `seq_paste_daemon.py`의 `is_ghostkey_active_mode()`를 `False`로 하드락하여 복사(`Ctrl+C`) 시 토스트 팝업이나 한영 타이핑 시 자동 변환·효과음 개입을 0%로 차단하고, 데몬 기동·자가업데이트 직후 15초간 브라우저 진입 효과음 무소음 가드를 적용.
- **하드코딩 0건 일반화된 구버전/타 경로 잔재 자동 정리 SSOT (`_self_purge_legacy_conflicts`)**: 상용 엔진 내 8초 주기 워치독 방어나 특정 스케줄러 이름 11종 하드코딩을 제거하고, 새 버전 기동 시 1회 정식 설치 경로(`%LOCALAPPDATA%\Programs\MerlinFamily\Merlin_Z_Core_Setup.exe`) 및 현재 프로세스 트리를 제외한 모든 타 경로/이전 버전 프로세스, 설치·임시 폴더 내 백업·스테이징 잔재(`_bak_dir`, `_staging_dir`, `*.zombie_*`, `*.old.*`, `*.bak.*`), 구형 자동실행 항목을 일반화 규칙으로 자동 정리.
- **원격 SSH 직결 배포 완전 폐지 & GitHub Releases 단일 파이프라인(`사내 45초` / `일반 유저 1시간`)**: `deploy_z_core_cluster.py`에서 원격 PC에 SSH/SCP로 파일을 직접 찔러넣던 코드를 영구 삭제하고 오직 GitHub Releases(`z-core-latest/Merlin_Z_Core.zip`) 업로드만 수행하도록 통일. 상주 데몬 버전 감지기(`start_periodic_remote_version_watcher`)는 사내 1~6호컴 `45초` 주기 / 일반 외부 유저 PC `1시간(3600초)` 주기로 무중단 감지해 스스로 자동 업데이트 완결.
- **`3대 모드 전환기 v1.3.0` 1~6호컴 전 기기 수동 설치 & 구버전 정리**: 웹 내 구 `LoungeModeSwitcherBar` 더미를 영구 제거하고 `python tools/deploy_mode_switcher_cluster.py`로 1~6호컴 전 기기 바탕화면에 `v1.3.0`을 수동 설치하며 구버전 프로세스·캐시를 정리 완료. 아울러 해나라·달나라 두 테스터에게 모바일 스토어(TestFlight/Play 스토어) 자동 업데이트 ON 설정 노션 미션 카드를 각각 출제 완료.

### 1. 모바일 손보기(정리) 3대 실버그 수정 & 무질문 유휴·충전 자동 확장 스캔 전환 (`c4a47c93`, `786a0820`)
- **모바일 대화창 PC Z-코어(`5199`) · 가짜 `Windows 10/11` 사양 카드 오호출 원천 차단**: `monsterChatRouter.ts`에 모바일 전용 손보기·사진정리·속도/용량·광고 점검 SSOT 핸들러를 신설하고, `Stage1MinimalCarePreview.tsx`의 `ghosti_focus_photo_care_tab` 이벤트로 하단 4대 사진 정리 탭 및 복원 서랍 자동 펼침·스무스 스크롤 연결.
- **모바일 「수요 손 없는 날 / 정기 점검」 실측 사진 후보 연동**: `weeklyCareAndPlaceholderEngine.ts` · `MonsterInteractiveCards.tsx` · `MonsterStandardChatColumn.tsx`에 `computeLocalPhotoCleanupSummary` 실측 후보 장수·용량(MB) 연동 및 승인 시 PC 액션 대신 4대 정리 탭 오픈(+ Android 클리너 점검) 직결.
- **불필요한 질문 제거 & 무질문 유휴·충전 자동 확장 인덱싱**: 480장 스캔 후 *"30분 뒤 vs 저녁"* 질문 말풍선·칩을 제거하고, 충전 중(4초) 또는 유휴 시(12초) 백그라운드에서 무소음 자동 확장 스캔(`maxTargetCount: 2500`, 배터리 20% 미만 비충전 시 자동 보호 보류)하도록 개선.

### 2. Wave 1 Android 전용 『📱 안 쓰는 앱 솎아내기 (바탕화면 아이콘 다이어트)』 구현 & 양대 스토어 `v1.0.131 (131)` 배포 (`4a57867b`, `e769aeda`)
- **Android 네이티브 브릿지 (`AndroidManifest.xml`, `GhostiMobileCarePlugin.java`)**: `QUERY_ALL_PACKAGES` 없이 합법 `<queries>`(`ACTION_MAIN`+`CATEGORY_LAUNCHER`) + `PACKAGE_USAGE_STATS` 기반으로 `checkUsageStatsPermission`, `openUsageStatsSettings`, `scanUnusedUserApps`(최근 14개월 `UsageStatsManager` 실측 + 48px PNG 아이콘 + APK 용량), `uninstallAppWithResult`(`ACTION_DELETE` 결과 대기 순차 연타 삭제) 4종 구현.
- **TS 3대 안심 힌트 & UI (`ghostiMobileCareBridge.ts`, `MobileUnusedAppsCleanerCard.tsx`, `MobileAppView.tsx`, `monsterChatRouter.ts`)**: `1년 이상 안 씀 / 3개월 이상 / 최근 사용` 3단 분류 + 용도·마지막 실행일·안전 배지 + 체크 후 연타 삭제 및 완료 성적표 제공 (iOS는 0px 영구 비노출).
- **양대 스토어 무인 동시 출시 & 노션 QA 출제**: `v1.0.131 (131)` Google Play 내부 테스트 + Apple TestFlight 클라우드 빌드·업로드 발사 완료 및 해나라님용 노션 미션 카드(`425f9ffd-2c1d-81bb-94a2-fe6e0d77c172`) 등록.

### 3. 기획서·기능명세서·손보기 문서 구버전 In-Place 대청소 & 온보딩 코드 2건 정비 (`1da9650f`, `521c9564` · 비서실 최종 검수 `PASS`)
- `docs/귀신같이_기획서.md`, `docs/기능명세.md`, `docs/손보기_최종기획안.md`에서 구버전 `0.1 변경 이력`, 취소선 항목, 구 `귀신 3총사 / 3. ⚡ 귀신창 초능력 / 9종 도장깨기`, `Phase 0 PoC / Stitch 시안`, `300장 온보딩 데모`, `100➔300➔500장 징검다리`, `3탭 온보딩` 잔재를 전량 제거하고 현행 **본체 5단 메뉴 · 웹 쇼룸 대문 · 2탭 시작 가이드(귀신검색 4단계 공용 도장깨기)** 기준으로 In-Place 통합.
- `OnboardingModal.tsx`의 외부 QR API(`api.qrserver.com`)를 내장 로컬 `<QrCodeSvg />`로 교체하고, 구버전 가짜 `'연결 상태 전환'` 토글을 `4. 내 기기 통합` 탭 직행으로 교체. `showroomDataAndUtils.ts`에 Android 안 쓰는 앱 솎아내기 & 악성 클리너 구출 사례 반영.

---

## 📌 다음 체크인 Todo (매일 체크인 시 최우선 의무)
- [ ] **🛡️ [1귀신 매일 체크인 필수 의무] 1~6호컴 전 컴퓨터 Z-코어 엔진 버전 일치(`public/z_core_version.json` 대비) 및 구버전 프로세스 충돌 유무 전수 확인·보고** (`python z_core_watcher.py --role 1` 실행 시 자동 출력).
- [ ] 양대 스토어 `v1.0.131 (131)` 반영 후 해나라님 노션 QA 미션(`안 쓰는 앱 솎아내기` 포함) 피드백 모니터링 및 `[발견된 버그]` 발생 시 Single-Piece Flow 즉시 수정.
- [ ] Google Play Console 정식 심사 제출 시 `PACKAGE_USAGE_STATS` 권한 소명 자료(1회) 준비·제출 확인.

---

# 🔵 `[2귀신]` 세션 인계장 (`SESSION_HANDOVER_2.md` — 귀신검색 · OCR · 라벨러 · 동영상 미디어)

- **최종 갱신 일시**: 2026-11-28 00:33 (KST)
- **담당 역할**: `[2귀신]` (귀신검색 · `Ctrl+0`/`Ctrl+우클릭` 귀신검색창 · 사진/표/영상 OCR · 귀신라벨링 · 동영상 재생/배속/상세)
- **세션 창 제목**: `2귀신 6종배포완결`
- **배포 버전 현황**:
  - **데스크톱 Z-코어**: **`v2.13.39`** (Track A 3·4호기 무중단 스왑 및 Track B 1·2·5·6호기 GitHub Releases Auto-Update 배포 완료, 커밋 `fbbadc8d` · `4bb4fda3`)
  - **웹 앱 (Netlify)**: 실시간 최신 번들 빌드 및 배포 완료
  - **모바일 양대 스토어**: **`v1.0.119 (119)`** 출시 유지 중 (Android 번들 동기화 완료)

## 금일 완료 내역 (2026-11-27)
1. **64비트 Windows ctypes 핸들 절단 버그 해결 및 검색창 프리징 원천 박멸 (`Z-Core v2.12.79`)**
   - **근본 원인**: `kernel32.GetCurrentProcess()`가 64비트에서 포인터(HANDLE)를 반환하지만 ctypes 기본 반환형(32비트 int)으로 잘리며(`0xFFFFFFFF -> 0xFFFFFFFF7FFFFFFF`), 작업스케줄러 기동 시 `prio=7 (BelowNormal + LowMem + LowIO)`에 영구 고착. 크롬 다중 탭 구동 시 Z-코어 워킹셋이 0~6MB로 디스크 스왑아웃되어 `Ctrl+0` 입력 시 수 초간 프리징 발생.
   - **조치 내용**: `k32.GetCurrentProcess.restype = wintypes.HANDLE` 명시, `AboveNormal(0x8000)` 우선순위 복원, 메모리/IO 우선순위 정상화 (`ws 76~98MB` 안정 확보).

2. **클립보드 무한 블로킹 격리 및 캡처 도구 GIL 점유 해소 (`Z-Core v2.12.29 ~ v2.12.49`)**
   - **근본 원인**: 윈도우 SnippingTool 캡처 직후 클립보드 지연 렌더링(Delayed Rendering)으로 인해 PIL `ImageGrab.grabclipboard()` 호출 시 파이썬 GIL을 최대 30초 점유하여 소켓 accept 기아 현상 발생.
   - **조치 내용**: `_run_clipboard_read_bounded` 비동기 워커 격리, ctypes 기반 논블로킹(`_grab_clipboard_image_raw`) 전면 전환, 워치독 1초 폴링 + 10초 자가복구 안전망 구축.

3. **구글 드라이브(G:) 가상 드라이브 탐색 및 검색 웹+`Ctrl+0` 완전 연동 (`Z-Core v2.12.69 ~ v2.13.09`)**
   - **근본 원인**: Google DriveFS(`G:`) 공유 바로가기 실폴더(`.shortcut-targets-by-id`) 탐색 차단 문제 및 5199(웹)와 51988(`Ctrl+0` 데몬) 간 프로세스 분리로 인한 G드라이브 색인 미공유 현상.
   - **조치 내용**: `.shortcut-targets-by-id` 실폴더 탐색 허용, 온라인 전용 파일(`cloudOnly`) 대량 다운로드 방지 + 셸 썸네일(`SIIGBF_THUMBNAILONLY`) 전용 처리. `virtual_drive_listing_cache_v1.json` 디스크 SSOT 캐시를 구축하여 5199와 51988 간 10,353개 파일 즉시 공유 연동 완료.

4. **검색 결과 오인 방지 상태바 알약 제거 및 외장 드라이브(USB 2/2) 정책 초기화**
   - 상태바에 '방금 본 파일' 알약이 떠서 실제 검색 결과로 혼동되던 문제를 멀린님 지침(옵션 3)에 따라 완전 제거 (`SilentIndexingStatusBar.tsx`).
   - 외장 드라이브 정책 파일(`external_drive_policy.json`) 리셋 후 재테스트 대기 상태 전환 완료.

5. **2귀신 누락 6종 최종 확정 스펙 완전 구현 및 문서 In-Place 동기화 (전사 우체국 회신 완료)**
   - **비밀번호 문서 카드 `📋` 인라인 복사**: 아이디/패스워드 패턴 1클릭 복사 버튼 탑재. (기획 변경 반영: TTS 비번 낭독 차단 문구는 기획서/가격표/명세서에서 In-Place 삭제).
   - **검색창 `⏱️ 최근 검색어` 5개 FIFO**: `ghost_search_window_ui2.py`에 별도 삭제 버튼 없는 자동 밀어내기 1줄 칩 바 탑재.
   - **동영상 `📸 이 장면(MM:SS) 캡처 이미지 복사`**: 네이티브 `Ctrl+0` 미리보기 창에 버튼 탑재하여 DIB 비트맵 클립보드 즉시 복사 연동.
   - **인물 검색 시 가족방 연결 분기**: 기존 방 유무에 따른 `[👨‍👩‍👧‍👦 '우리집' 가족방에 담기]` vs `[👨‍👩‍👧‍👦 이 사진들로 가족방 만들기]` 자동 전환 및 dHash/중복 자동 스킵 토스트 연동.
   - **30일 무료체험 만료 특정 손실회피 성적표**: OCR(`feat_6_screen_ocr`) 및 라벨러(`feat_ghost_labeler`) 실제 1회 이상 사용 시 동적 성적표 노출 연동.
   - **라벨러 `Ctrl+Z` 원복**: 네이티브 UI 버튼 없이 `Ctrl+Z` 1초 원복 로직 유지 및 토스트 안내(`(되돌리기: Ctrl+Z)`).

6. **노션 QA 신규 미션 출제 완료 (제16조 2항목 이하 · 노란 콜아웃 박스 준수, 담당: `해나라`)**
   - `🟢 [귀신같이] [2귀신] 비밀번호 옆 복사 아이콘(📋) · 최근 검색어 5개`
   - `🟢 [귀신같이] [2귀신] 동영상 장면 캡처 복사 · 갤러리 가족방 담기`
   - `🟢 [귀신같이] [2귀신] 라벨링 Ctrl+Z 되돌리기 · 체험 만료 기능별 성적표`
   - `Z-Core v2.13.39` 빌드·서명·GitHub Releases 업로드 및 3·4호기 Track A 무중단 배포 + 1·2·5·6호기 Track B Auto-Update 완료

## 노션 QA 현황
- **발견된 버그**: **`0건`**
- **버그 수정중**: **`0건`**
- **재테스트 대기**: 총 **9건** (해나라님 확인 대기 중)
- **테스트 미션**: 신규 3장 추가 등록 완료
- **문패 상태**: `zcore_board.py` 락 정상 반납 완료 (점유 0건)

## 다음 체크인 Todo
- [ ] 해나라님의 `[테스트 미션]` 및 `[재테스트 대기]` 피드백 실시간 확인 및 필요 시 핀셋 보강
- [ ] 신규 버그 발생 시 Single-Piece Flow(`1카드 = 1턴`) 즉시 착수

---

﻿# 🟠 `[3귀신]` 세션 인계장 (`SESSION_HANDOVER_3.md` — 사진 공유 · 내 기기 통합 · 모바일 앱)

- **최종 갱신 일시**: 2026-11-28 00:33 (KST)
- **담당 역할**: `[3귀신]` (사진 공유 · 내 기기 통합 Pro · 모바일 웹 브릿지 · 양대 스토어 앱)
- **QA 담당 테스터**: **달나라님** (노션 `담당 = 달나라` 고정 · 3·4귀신 테스터는 해나라님이 아닌 달나라님으로 호칭)
- **최신 배포 버전**: **`Merlin Z-Core v2.13.39`** · 양대 스토어 **`v1.0.130 (130)`** (Google Play 내부 테스트 & Apple TestFlight 동시 출시)
- **세션 창 제목**: `3귀신 사진공유·모바일통합`

## 완료 내역 (2026-11-25 ~ 11-28)
1. **사진 공유 누락 4건 멀린님 최종 확정 정공법 일괄 완결 & 달나라님 노션 QA 미션 카드 2건 분할 출제 (`49a1a828`, `Z-Core v2.13.39`) (2026-11-27~28)**
   - **① 중복 사진 `EXIF + 픽셀 해상도(width × height)` 비교·고화질 자동 교체**: `sharedPhotoRoomSupabase.ts`(`isHigherQualityOriginalCandidate` · `upgradeHigherQualitySharedPhoto`), `workAndDeviceBridgeOps.mjs`(`photo_upgrade_higher_quality`), `FreePhotoShareOverlays.tsx`, `freePhotoShareSlice.ts` 구현으로 `dHash` 일치 시 기존 댓글·하트 100% 보존하며 고화질 원본 자동 교체.
   - **② 모바일 24시간 삭제 제한 적용 & 방장 권한 설정 서버 동기화**: `MobileAppView.tsx`에 PC와 동일한 `evaluateSharedPhotoDeletePermission` 연결 + `workAndDeviceBridgeOps.mjs`(`photo_get_room_settings` / `photo_set_room_settings`) · `ghosti_zero_cloud_schema.sql`(`host_retains_hide_permission`) · `LoungeCustomSettingsHeader.tsx` · `GhostSearchPane.tsx` 방별 서버 동기화 완결.
   - **③ 동창회 연도 제보 반쪽 버튼 1차 출시 숨김(2웨이브 이관)**: `AlumniRetroBannerAndTwoTrackBar.tsx` 미작동 `연도 제보 승인` 버튼 제거 및 `기능명세.md` In-Place 반영.
   - **④ 타 멤버 `[원본 동기화]` 듀얼 엔진 아웃바운드 HTTPS 직통 터널 고화질 원본(5~20MB) 스트리밍 다운로드 (`Z-Core v2.13.39`)**: `plugin_ghosti_os.py`(`ensure_photo_room_outbound_tunnel` · `resolve_shared_room_original_file` · `_save_shared_room_items_to_dir` 13KB 썸네일 저장 금지), `merlin_z_core_daemon.py`(`POST /__club/tunnel` · `GET /__club/original-file` `X-Ghosti-Photo-Key` 256-bit 인증), `workAndDeviceBridgeOps.mjs`(`photo_register_room_tunnel` · `photo_get_room_tunnel`), `LoungeFeedContextBanner.tsx`(방장 PC 오프라인 시 정직한 대기 안내 + 45초 자동 이어받기) 완결.
   - **⑤ `PaidDeviceSyncPane.tsx` 하단 미사용 `else` 죽은 코드 청소** 및 `tsc --noEmit` · `vite build` · `node --check` · `py_compile` 전수 통과.
   - **⑥ 노션 QA 미션 카드 2건 출제 (`담당 = 달나라` · 카드당 2항목 준수)**:
     - `🟣 [3귀신] 📸 [사진 공유: 고화질 원본 직통 동기화 & 방장 PC 꺼짐 대기 안내]` (`425f9ffd-2c1d-81c5-92cc-cdc39f58fd4b`)
     - `🟣 [3귀신] 📸 [사진 공유: 중복 사진 고화질 자동 교체 & PC↔폰 삭제 권한 동기화]` (`425f9ffd-2c1d-81ab-b9c9-f4a778341ec2`)
2. **Apple APNs HTTP/2 · Google FCM HTTP v1 정식 백그라운드 & 앱종료 푸시 직결 (`v1.0.130 (130)` 양대 스토어 출시, 카드 `423f9ffd-2c1d-8060-a898-e06972a3376c` `'재테스트 대기'`) (2026-11-27)**
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

---

# 🟣 `[4귀신]` 세션 인계장 (`SESSION_HANDOVER_4.md` — 업무 공유 `S:` · 1PC 단일 계정 점유 · 배포 트랙 이원화)

- **최종 갱신 일시**: 2026-11-28 00:34 (KST)
- **담당 역할**: `[4귀신]` (`5. 업무 공유 (S:)` 전담 + 귀신비서 제미니 에이전트 PC 자가케어 1·2차 고도화)
- **QA 담당 테스터**: **달나라님** (`담당 = 달나라` 고정)
- **최신 배포 버전**: **`Merlin Z-Core v2.13.50`** (MS 공인 코드서명 `CN=썬드림주식회사` · `https://krc.codesigning.azure.net/` 개통) · Netlify 웹 배포 실시간 최신 번들 빌드 완료 · 양대 모바일 스토어 **`v1.0.129 (129)`**
- **세션 창 제목**: `4귀신 7종완결체크아웃`

## 1. 금일(2026-11-27) 주요 해결 이슈 및 완료 내역
1. **업무 공유 누락 7건 멀린님 최종 확정안 정공법 완결 및 엣지 무결성 검증 (`v2.13.50`)**
   - **① 🛡️ 백업 PC(예비 서버 1·2호) 정공법 완결**: 로컬/외장/NAS 및 팀원 PC(1·2호) P2P 단방향 자동 백업 미러링(`mirror-from-tunnel`) + 파일당 최근 5개 버전 타임머신(`_versions/` 보관 및 목록·1클릭 복원 UI) + `<10GB` 사전 경고 및 2호 경로 자동 우회 + Split-Brain 방지를 위한 **`[⚡ 이 백업 PC를 대장 PC로 즉시 승격]` 1클릭 수동 승격**(`promote-master` 로컬 `S:` 마운트·아웃바운드 터널 기동 + 서버 `work_promote_backup_to_master` 전파) 완비.
   - **② `[↩️ 1초 실행 취소(Undo)]` 용량 무관 100% 실물 파일 복원**: `/__work/restore-deleted` + 서버 `work_restore_deleted_file` 연동으로 512KB 초과 대용량 문서 및 원격 삭제 파일까지 OS 휴지통·임시 금고에서 100% 실물 복원 및 재삭제 방지 완비.
   - **③ `S:` 점유 폴백(`Y:`~`P:`) 및 실제 업무 폴더 `🏷️ 귀신 라벨러` 무료 예외 보장**: `proFeatureGate.ts` 활성 `driveLetter`(콜론 정규화)·`driveTargetPath` 통합 판별 및 `라벨러 무료` vs `사진·표 OCR Pro 게이트` 엄격 분리.
   - **④ `5. 업무 공유` 우측 미리보기(Side Peek)에 `[🏷️ 귀신 라벨링]`(팀원 무료) · `[📝 사진·표 OCR]`(Pro 게이트) 버튼 직결**.
   - **⑤ `5. 업무 공유` 검색창 `최근 검색어` 전사 표준(`recentSearchHistory.ts`) 통일**: 최대 5개 FIFO 자동 밀어내기, 검색어 미입력 시에만 1줄 노출, 타이핑 즉시 숨김 연동.
   - **⑥ `[팀원 초대 링크 복사]` 토스트 문구 보강**: `(발급 후 14일간 유효)` 안내 명시.
   - **⑦ 구버전 잔재 3곳 일괄 교정**: `WorkLoungeHostAdminPanels.tsx`(`'👑 방장'`), `workAndDeviceBridgeOps.mjs`(`[4. 내 기기 통합] / [5. 업무 공유]`), `docs/기능명세.md`(`[2웨이브 예정]` 배지 표기).
2. **외부망(LTE/외부 WiFi) 직통 터널 & 모바일 현장 업로드 / 진행률·저장경로 안내 완료 (`8cf9b8fb`, 카드 `422f9ffd-2c1d-81e6-8dc3-ca38d35aae0e` `'재테스트 대기'`)**
3. **구글 드라이브 ➔ PC 로컬 폴더 원클릭 이전 및 가상 스텁 정리 기능 구현 (`0e87bbc`, `Z-Core v2.12.99`)**
4. **B2B 랜딩/비교 쇼케이스 구현 (`a78dbcb`)**
5. **동적 폴더 탭 0초 즉시 렌더링 & 하드코딩 제거 (`1b5eb9d`)**
6. **팀원 PC 윈도우 탐색기 `S:\` 1:1 권위 미러링 및 고스트 폴더 자동 가지치기 (`86a2121`, `Z-Core v2.12.59`)**
7. **소호·무료체험(5인) 정원 초과 시 미검증 초대 선해금 차단 (`cac4792`, 카드 `422f9ffd-2c1d-8127-a6bf-da89de78afac` `'재테스트 대기'`)**

## 2. 4귀신 QA 테스트 커버리지 100% 미션 구성 완비 (기존 4건 + 금일 신규 7종 검증 3건 출제 완료)
- `🟣 [4귀신] 🛡️ [업무 공유 S: 백업 5버전 타임머신 & 1클릭 대장 승격]` (`425f9ffd-2c1d-8115-94f3-f59c44507f7b`)
- `🟣 [4귀신] ↩️ [업무 공유 S: 대용량 문서 1초 실행 취소 & 우측 미리보기 라벨링·OCR]` (`425f9ffd-2c1d-81ed-a0f6-e5f8f5c302b5`)
- `🟣 [4귀신] 🔍 [업무 공유 S: 최근 검색어 5개 슬림바 · 14일 초대 안내 · 👑 방장 표기]` (`425f9ffd-2c1d-8113-bcb1-c6423fbb2c20`)
- `🟣 [4귀신] 💼 [업무 공유 S: 동시 편집 및 잠금 충돌 검증]` (`425f9ffd-8153`)
- `🟣 [4귀신] 📱 [모바일 업무 공유: 대용량 LTE 업로드 및 파일 보존]` (`425f9ffd-810e`)
- `🟣 [4귀신] 🛡️ [업무 공유 S: 대량 삭제 안전핀 및 휴지통 복구 검증]` (`425f9ffd-810b`)
- `🟣 [4귀신] 🌙 [업무 공유 S: 야간 절전 모드 중 외부망 터널 상시 유지]` (`425f9ffd-813e`)

## 3. 다음 체크인 Todo
- [ ] 노션 QA `'재테스트 대기'` 3건(정원 차단, 방 나가기 잔상 소거, LTE 터널/모바일 다운로드) 달나라님 최종 피드백 확인.
- [ ] 신규 구현된 7종 스펙(백업 PC 1클릭 대장 승격, 100% 실물 파일 Undo, Side Peek OCR/라벨링 버튼) 동작 확인.
