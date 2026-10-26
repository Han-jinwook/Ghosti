# 🛡️ 제트아이 (Z-Eye) 허브 SDK v2.19.0 인프라 이식 및 자체 점검 가이드

- **작성일**: 2026-10-27
- **작성자**: `MerlinFamilyOS` (허브 총괄 에이전트)
- **수신자**: `Z-Eye` 전담 에이전트
- **공식 앱 ID**: `ZEye` (호환 허용: `Z-Eye`, `ZEYE`, 한글명: `제트아이`)
- **공식 도메인**: `https://z-eye.sundreamer.app`

---

## 1. 이식 완료된 허브 인프라 구성도

1. **SDK 및 가이드 문서 전수 이식 (`src/services/merlin-hub-sdk/`)**:
   - **6대 핵심 모듈 + 고객센터/블랙박스**:
     - `Auth/` (`HubAuthModal.tsx` v2.1.1 — 일반 패밀리 앱 단일 이메일 6자리 OTP 표준)
     - `Session/` (`HubProfileWidget.tsx` 3D 곰발바닥 아바타, `HubProfileCards.tsx` 내 선물함·알림·로그아웃)
     - `CoreLogic/` (`HubProvider.tsx` v2.10.0 인앱 브라우저 0.1초 자동 탈출, `.sundreamer.app` 30일 공용 루트 쿠키 & 자가 치유)
     - `Navigation/` (`HubAppSwitcher.tsx` v2.8.0 노션형 좌측 사이드바 하단 모드 `variant="sidebar"`, `placement="bottom-up"` 및 5대 패밀리 공식 로고 번들 내장)
     - `Wallet/` (`HubPurchaseWidget.tsx` 3몬스터 패밀리 코인 충전소 v1.4.0, `HubGiftBoxModal.tsx` 패밀리 선물함 v2.3.0)
     - `Referral/` & `Ads/` (`HubShareSquare.tsx` v3.0.0, `HubResponsiveWing.tsx` v3.0.0 — 전사 정책에 따라 PC 우측 공유 카드·모바일 1분 플로팅 구슬·`?ref=` 추천코드 영구 폐지, 100% 기능 기반 공유 체제)
     - `Support/` (`HubErrorBoundary.tsx`, `HubBugReporter.tsx` 1초 오류신고, `HubSupportLink.tsx` 스튜디오 1:1 문의방 직결)
   - **전사 가이드 문서 일체 (`src/services/merlin-hub-sdk/guides/`)**:
     - `라이브러리_대장.md`, `라이브러리_활용가이드.md`, `작업_강령.md`, `허브_DB_스키마.md`, `3몬스터_고객센터_자율버그수리_연동가이드.md`, `개별앱주도_개별앱_UI_UX가이드2.md` 외 전수 포함.
   - **공식 에셋 (`public/hub_assets/`, `public/images/`)**:
     - `guest_paw.png`, `guest_paw_bg.png`, `3Monster_logo.png`, `card_1000.png`, `card_5000.png`, `card_10000.png` 및 iOS 인앱 탈출 가이드 그래픽 완비.

2. **제트아이 전용 브릿지 컴포넌트 (`src/components/ZEyeHubInfraBridge.tsx`)**:
   - **`ZEyeHubRootProvider`**: `src/App.tsx` 최상위를 `<HubErrorBoundary appId="ZEye">` 및 `<HubProvider appId="ZEye">`로 감싸고 전역 모달(로그인, 프로필 설정, 3몬스터 충전소, 선물함, 1초 오류신고, 토스트)을 자동 마운트합니다.
   - **`ZEyeTopRightHubAnchor`**: `DesktopDashboard.tsx` 우측 상단 헤더에 배치되어 **`🪙 코인 지갑` 버튼 + `🐾 3D 곰발바닥 프로필 위젯`**을 렌더링합니다.
     - ⚠️ **공유 아이콘 전사 표준(A안) 반영**: 우상단 헤더의 표준 공유(`share`) 아이콘은 **PC 화면에서만 노출(`hidden lg:flex`)**되며, 클릭 시 별도 팝업 없이 **제트아이 순수 링크(`?ref=` 없음)를 1클릭 클립보드 복사 + 토스트 안내**로 처리합니다. 모바일에서는 일반 공유 아이콘을 숨기고 100% 기능 기반 공유(방 초대, 파일 공유 등)만 사용합니다.
   - **`ZEyeSidebarBottomFamilyLauncher`**: `DesktopDashboard.tsx` 좌측 노션 스타일 세로 사이드바 최하단에서 허브 공식 SDK `<HubAppSwitcher currentAppId="zeye" variant="sidebar" placement="bottom-up" />`를 렌더링하여, 클릭 시 화이트 카드 팝업(가입된 앱 3열 그리드 + 미가입 앱 상세 리스트)이 펼쳐지고 `?sso_token=` 무로그인 점핑을 지원합니다.

---

## 2. 스토어 앱 심사 방어 (Apple 3.1.3(b) / Google Play IAP 규정 준수)

- `useIsCoinHiddenInStore()` (`src/components/ZEyeHubInfraBridge.tsx`):
  - `window.Capacitor?.isNativePlatform()`이 `true`이거나 `isStoreAppMode && !enableMobileCoinDisplay`일 때 자동으로 `hideCoin = true`가 됩니다.
  - `hideCoin === true`일 때는:
    1. 우측 상단 헤더의 `🪙 코인` 버튼이 DOM에서 아예 렌더링되지 않습니다.
    2. 프로필 설정 모달(`HubProfileCard`) 내부의 코인 잔액 배너 및 내 선물함 배너가 `hideCoinSection={true}`로 완전 숨김 처리됩니다.
    3. `HubPurchaseWidget`(3몬스터 코인 충전소) 및 `HubGiftBoxModal`(선물함) 모달 컴포넌트 자체가 DOM에 마운트되지 않습니다.
  - 반면 일반 PC/모바일 웹(`https://z-eye.sundreamer.app`)에서 `isStoreAppMode`를 해제하거나 웹 모드로 진입할 때는 3몬스터 코인 충전소와 패밀리 선물함이 100% 정상 작동합니다.

---

## 3. 제트아이 단독 Supabase ↔ 허브 SSOT 계정 매핑 브릿지 (`src/services/supabaseClient.ts`)

- 허브 로그인 또는 세션 복원 시 `ZEyeHubInfraBridge.tsx`가 자동으로 `syncHubUserToLocalSupabase({ userId: user.id, email: user.email, nickname: user.nickname })`를 호출합니다.
- **핵심 규칙**:
  - 로컬 `public.users.id` = 허브 `family_users.id` (UUID 1:1 일치).
  - 비로그인 게스트 상태에서는 `merlinAuth.coinBalance`를 `0`으로 고정하여 과거 목업 캐시(`5,200 C`)로 인한 오표시를 원천 차단합니다.
  - 네이티브 푸시 토큰(`localStorage['zeye_native_push_token']`)이 존재하면 `users.app_settings`에 `{ native_push_token, push_channel_id: 'zeye' }`로 함께 기록됩니다.
  - ⚠️ **무인 DB 백업 제외**: 전사 방침에 따라 `.github/workflows/daily-db-backup.yml`은 구축하지 않습니다.

---

## 4. 제트아이(Z-Eye) 에이전트 자체 확인 및 후속 점검 체크리스트

제트아이 에이전트는 아래 항목을 기준으로 인프라 작동 여부를 확인하고, 제트아이 고유 기능(방장 구독제, 라운지 공유방, 설정몬스터 정산 등)에 맞춰 세부 연동을 보완하십시오:

- [ ] **1. 우상단 곰발바닥 프로필 & OTP 로그인 확인**:
  - 우측 상단 `[게스트]`(곰발바닥) 클릭 시 6자리 이메일 OTP 로그인 모달(`HubAuthModal`)이 정상 오픈되는지 확인.
  - 로그인 성공 시 `useSaySeeStore.getState().merlinAuth`에 실제 `userId`(UUID), `email`, `coinBalance`가 즉시 반영되는지 확인.
- [ ] **2. 통합 프로필 설정 모달 확인**:
  - 로그인 후 우상단 곰발바닥 프로필 클릭 시 `[🐾 내 프로필 · 계정 설정]` 모달이 열리고, 별명 수정·알림 스위치·`1:1 고객문의 · 나의 문의방`(`appId="ZEye"`)·`1초 오류 즉시 신고`·`로그아웃`이 정상 작동하는지 확인.
- [ ] **3. 코인 충전소 & 선물함 (웹 vs 스토어 모드) 확인**:
  - 웹 모드(`isStoreAppMode = false` 또는 `enableMobileCoinDisplay = true`)에서 우상단 `🪙 코인` 클릭 시 `3몬스터 패밀리 코인 충전소`(`HubPurchaseWidget`) 및 `패밀리 선물함`(`HubGiftBoxModal`)이 열리는지 확인.
  - 스토어 심사 모드(`isStoreAppMode = true, enableMobileCoinDisplay = false`)에서 코인 버튼 및 충전소가 DOM에서 완전히 사라지는지 확인.
- [ ] **4. 좌하단 노션형 사이드바 `[F] 멀린 패밀리 앱` 확인**:
  - 좌측 사이드바 하단 `[F] 멀린 패밀리 앱`을 펼쳤을 때 타 패밀리 앱 클릭 시 `?sso_token=`이 포함된 새 탭으로 열리는지 확인.
- [ ] **5. 기존 제트아이 기능 무결성 확인**:
  - 우상단 `👑 여권 문패`, `🛠️ 설정몬스터`, `공유`, `🌙 테마 토글` 및 좌측 3대 메뉴(`[내 기기]`, `[사진 공유]`, `[업무 공유]`)가 기존과 100% 동일하게 작동하는지 확인.
