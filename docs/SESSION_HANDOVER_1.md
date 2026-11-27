# 🟢 `[1귀신]` 세션 인계장 (`SESSION_HANDOVER_1.md` — 온보딩 · 귀신비서 · 여권)

- **최종 갱신 일시**: 2026-11-28 00:33 (KST)
- **담당 역할**: `[1귀신]` (온보딩 · 귀신비서 · 사진 정리 · 얼굴 여권 · 전 영역 FAQ · 3대 모드 전환기 · Z-코어 총괄)
- **세션 창 제목**: `1귀신 모바일손보기·온보딩`
- **배포 버전**: `Z-Core v2.13.09`, 양대 스토어 모바일 앱 **`v1.0.131 (131)`** (Google Play 내부 테스트 & Apple TestFlight 동시 출시)
- **노션 QA 상태**: `[발견된 버그]` 0건, 신규 미션 카드 `🟢 [1귀신][모바일앱] 안 쓰는 앱 솎아내기 (1년·3개월 분류 & 연타 삭제)` (`425f9ffd-2c1d-81bb-94a2-fe6e0d77c172`) 등록 완료

---

## 🚀 완료 내역 (2026-11-27 ~ 2026-11-28)

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

## 📌 다음 체크인 Todo
- [ ] 양대 스토어 `v1.0.131 (131)` 반영 후 해나라님 노션 QA 미션(`안 쓰는 앱 솎아내기` 포함) 피드백 모니터링 및 `[발견된 버그]` 발생 시 Single-Piece Flow 즉시 수정.
- [ ] Google Play Console 정식 심사 제출 시 `PACKAGE_USAGE_STATS` 권한 소명 자료(1회) 준비·제출 확인.
