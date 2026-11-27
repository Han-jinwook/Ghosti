# 🟣 `[4귀신]` 세션 인계장 (`SESSION_HANDOVER_4.md` — 업무 공유 `S:` · 1PC 단일 계정 점유 · 배포 트랙 이원화)

- **최종 갱신 일시**: 2026-11-27 11:11 (KST)
- **담당 역할**: `[4귀신]` (`5. 업무 공유 (S:)` 전담 + 귀신비서 제미니 에이전트 PC 자가케어 1·2차 고도화)
- **QA 담당 테스터**: **달나라님** (`담당 = 달나라` 고정)
- **최신 배포 버전**: **`Merlin Z-Core v2.11.29+`** (MS 공인 코드서명 `CN=썬드림주식회사` · `https://krc.codesigning.azure.net/` 개통) · `3대 모드 전환기 v1.2.0` · 양대 모바일 스토어 **`v1.0.122 (122)`**
- **세션 창 제목**: `4귀신 정원차단·배포이원화`

## 완료 내역 (2026-11-26 ~ 11-27)
1. **전 기기 배포 트랙 이원화(`Track A: 3·4호컴 QA 직결` vs `Track B: 1·2·5·6호컴 GitHub Releases 실유저 Auto-Update`) 전환 확정 & MS 공인 코드서명(`krc`) 개통 반영 (2026-11-27)**
   - **Track A (`3호컴` · `4호컴`)**: QA 테스트 전용 기기로 코드 수정·빌드 즉시 AI 직결 0초 쾌속 원자적 스왑 배포 유지.
   - **Track B (`1호컴` · `2호컴` · `5호컴` · `6호컴`)**: 기존 `2호컴` 직결 배포 규칙을 전면 전환·정합화하여 AI 강제 덮어쓰기를 영구 금지하고, `3·4호컴` 검증 완료 빌드를 **GitHub Releases(`z-core-latest`)**에 정식 버전 상향 업로드한 뒤 실제 고객과 100% 동일하게 자체 백그라운드 Auto-Update(`/__merlin/self-update`)로만 교체·기동되도록 운용.
   - **MS 공인 코드서명(`sundream-public-cert`, `CN=썬드림주식회사`)**: 정식 엔드포인트 `https://krc.codesigning.azure.net/` 및 영구 Service Principal(`AZURE_TENANT_ID`/`AZURE_CLIENT_ID`/`AZURE_CLIENT_SECRET`, `local_secrets.json` `utf-8-sig` 폴백) 연동 및 GitHub Releases 업로드 전 Authenticode `Valid` 필수 서명 게이트 준수.
2. **업무 공유 `S:` 소호·무료체험(5인) 정원 초과 시 미검증 초대 선해금·가짜 1인 목록 원천 차단 및 전용 확인 모달 적용 (`cac4792`, 카드 `422f9ffd-2c1d-8127-a6bf-da89de78afac` `'재테스트 대기'`) (2026-11-27)**
   - 초대 URL 파라미터만으로 `work_accept_invite` 서버 검증 전에 선해금(`S:` 오마운트 및 `sundream7879 (방장)` 1인 폴백 목록 노출)되던 결함과 정원 초과 토스트가 엔진 연결 토스트에 덮이던 문제를 `WorkLoungeB2BHub.tsx`, `workRoomSyncService.ts`, `deviceIntegrationService.ts`, `workAndDeviceBridgeOps.mjs`에서 근본 해결.
   - 6번째 계정 합류 시도 시 `403 WORK_SEAT_LIMIT_EXCEEDED`와 함께 초대 잔상 소거·`S:` 마운트 차단 및 사용자가 `[확인]`을 누를 때까지 유지되는 **전용 정원 초과 안내 모달(`work-room-seat-limit-modal`)·상단 배너** 표시.
3. **업무 공유 `S:` 팀원 자발적 방 나가기 후 초기 안내 화면 정합성 검증 및 `'재테스트 대기'` 회신 (`36ace6a`, 카드 `422f9ffd-2c1d-81f3-ae98-fd0d05fa0a59`) (2026-11-26 ~ 11-27)**
   - 엔진 금고 격리(`_isolate_invited_room_local_vault`), 웹 UI 폴더 잔상 소거(`roomCleanupEpochRef`), 오프라인 PC 사후 치유(`markPendingInvitedVaultPurge`) 적용 후 달나라님 재테스트 캡처 2건(PC 이용권 시작 안내 단독 노출 / 모바일 `'참여 중인 업무 공유방 없음'` 단독 노출)이 확정 설계 기준 100% 정상 화면임을 확인·회신 완료.
4. **`3대 모드 전환기 v1.2.0` 구버전(`v2.8.19`) 금고 역주입 원천 차단 (`5ba8bb5`) (2026-11-26)**
   - `--onedir` 번들(`exe + _internal/`) 유효성 검증(`_is_valid_onedir_bundle`) 및 최신 번들 금고 동기화 적용 완료.

## 다음 체크인 Todo
- [ ] **노션 QA `422f9ffd-8127`(`5인 정원 초과 합류 차단`) 및 `422f9ffd-81f3`(`팀원 방 나가기 격리`) 달나라님 최종 재테스트 확인 및 피드백 즉시 대응 (`발견된 버그` 현재 `0건`)**.
- [ ] **Z-코어 빌드·배포 시 `zcore_board.py` 문패 준수 및 `Track A(3·4호컴 직결)` / `Track B(1·2·5·6호컴 GitHub Releases Auto-Update)` + MS 공인 코드서명(`krc`) 원칙 엄수**.
