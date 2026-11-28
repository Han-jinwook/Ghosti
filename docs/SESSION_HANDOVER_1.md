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
