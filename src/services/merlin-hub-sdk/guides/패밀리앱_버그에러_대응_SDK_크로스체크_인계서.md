# 🛰️ [크로스체크 & 배포 인계서] Merlin Hub SDK `v2.15.0` — 통합 고객센터(CS) 직결 & 블랙박스 에러 바운더리 모듈 (`Support/`)

| 문서 버전 | 작성 일시 | 발신 | 수신 | 대상 샘플 앱 |
| :---: | :---: | :--- | :--- | :--- |
| **v2.15.0** | **2026-10-20** | **☀️ 썬드리머 스튜디오 총괄 에이전트 (`d:\Studio`)** | **🏛️ 멀린 패밀리 OS 허브 총괄 에이전트 (`D:\MerlinFamilyOS`)** | **🛡️ 어그로필터 (`D:\AggroFilter`) 1차 실전 탑재 완료** |

---

## 🎯 1. 작업 배경 및 대표님 지시사항 요약

1. **실서비스 중인 썬드리머(`D:\LumiNote\sundream`) 보호 원칙**:
   - 현재 썬드리머는 실유저가 활발히 이용 중이므로 직접 건드리지 않고, **`D:\AggroFilter`(어그로필터)**를 깨끗이 `git pull` 한 뒤 1차 샘플로 완벽히 세팅 및 검증했습니다.
2. **이질감 없는 개별 앱 전용 1:1 라운지 경험 (스튜디오 `/support`)**:
   - 개별 앱 프로필 하단(`로그아웃` 바로 위)에서 `[🛠️ 1:1 고객문의 · 나의 문의방]` 클릭 시 스튜디오(`https://studio.sundreamer.app/support?app=AggroFilter`)로 즉시 이동하되, 상단에 **해당 앱 전용 웰컴 라운지 배너**(예: `🛡️ 어그로필터 전용 1:1 문의방`, `[← 어그로필터 앱으로 돌아가기]`, `[✨ 패밀리 앱 둘러보기]`)가 노출되고 문의 대상 앱이 자동 선택되도록 구현했습니다.
   - 스튜디오 문의 등록 폼에서 레거시 **`크몽 ID (*2차 매칭용)` 입력란 및 수동 연동 안내 문구를 완전 제거**하고, 패밀리 앱(`썬드리머`, `어그로필터`, `세이씨`, `뭐먹지?`) 선택 그룹을 최상단에 배치했습니다.
3. **자동 블랙박스 수집 & 1초 미니 오류 접수창 & 답변 도착 시 점핑**:
   - 앱 크래시나 런타임 에러 시 하얀 화면(White Screen)을 막는 `<HubErrorBoundary>`, 1초 만에 직전 20개 브레드크럼과 기기/에러 스택을 동봉해 스튜디오 CS로 쏘는 `<HubBugReporter>`, 그리고 관리자 답변이 달리면 프로필 버튼에 `[🔴 새 답변 N건 도착!]` 배지를 띄워 해당 티켓(`?ticket_id=...&app=...`)으로 직행시키는 `<HubSupportLink>`를 **`Support/` 모듈**로 완성했습니다.

---

## 📦 2. 신규 구축 및 동기화 완료된 파일 목록

### A. 멀린 허브 마스터 라이브러리 (`D:\MerlinFamilyOS\허브_라이브러리\`)
- [`허브_라이브러리/Support/blackbox.ts`](file:///D:/MerlinFamilyOS/허브_라이브러리/Support/blackbox.ts):
  - 최근 20개 행동 브레드크럼(`ui.click`, `ui.input`, `navigation`, `network.error`) 링버퍼 수집기.
  - 비밀번호(`type="password"`), 주민번호, 카드번호, OTP 등 민감정보 자동 `[FILTERED]` 마스킹.
  - 기기/OS/인앱 브라우저(카카오톡·네이버·인스타그램·Safari·Chrome)/해상도/PWA(standalone) 자동 감지.
  - 스튜디오 중앙 DB(`https://suwinftalfgybvrnzruz.supabase.co/rest/v1/support_tickets`)로 별도 백엔드 프록시 없이 직접 티켓을 생성하는 `submitStudioSupportTicket()` 및 SSO 토큰 포함 점핑 URL 빌더 `buildStudioSupportJumpUrl()` 내장.
- [`허브_라이브러리/Support/HubErrorBoundary.tsx`](file:///D:/MerlinFamilyOS/허브_라이브러리/Support/HubErrorBoundary.tsx):
  - 하위 컴포넌트 렌더링 크래시 포착 시 폴백 화면 표출 + 0.1초 만에 `openBugReporter({ category: 'CRASH', error })` 자동 실행.
- [`허브_라이브러리/Support/HubBugReporter.tsx`](file:///D:/MerlinFamilyOS/허브_라이브러리/Support/HubBugReporter.tsx):
  - 1초 미니 오류/불편 접수 팝업 모달.
  - 메모 생략 시에도 자동 진단 로그만으로 접수 가능하며, 접수 직후 `[계속 앱 이용하기]` 또는 `[나의 문의방 확인하기 ↗]` 선택 가능.
- [`허브_라이브러리/Support/HubSupportLink.tsx`](file:///D:/MerlinFamilyOS/허브_라이브러리/Support/HubSupportLink.tsx):
  - 각 앱 프로필 페이지 하단 `<HubLogoutCard />` 바로 위에 배치하는 표준 고객센터 카드.
  - 스튜디오 `support_tickets`에서 현재 로그인 유저 이메일의 미읽음 관리자 답변을 실시간 체크하여 **`[새 답변 N건 도착!]`** 뱃지를 띄우고, 클릭 시 해당 티켓 상세(`?ticket_id=...&app=...`)로 즉시 점핑.
  - 카드 하단에 `[🐛 1초 오류 즉시 신고]` 보조 트리거 버튼 내장.
- [`허브_라이브러리/Support/index.ts`](file:///D:/MerlinFamilyOS/허브_라이브러리/Support/index.ts) & [`허브_라이브러리/react.ts`](file:///D:/MerlinFamilyOS/허브_라이브러리/react.ts):
  - `HubErrorBoundary`, `HubBugReporter`, `HubSupportLink`, `initBlackbox`, `openBugReporter` 등 공식 export 등록 완료.

### B. 1차 샘플 앱 실전 적용 (`D:\AggroFilter\`)
- [`D:\AggroFilter\app\layout.tsx`](file:///D:/AggroFilter/app/layout.tsx):
  - `<HubProvider appId="AggroFilter">` 내부를 `<HubErrorBoundary appId="AggroFilter" appVersion="v2.15.0">`로 감싸고 `<HubBugReporter appId="AggroFilter" appVersion="v2.15.0" />` 장착 완료.
- [`D:\AggroFilter\app\p-settings\page.tsx`](file:///D:/AggroFilter/app/p-settings/page.tsx):
  - `<HubNotificationCard />` 아래, `<HubLogoutCard />` 바로 위에 `<HubSupportLink appId="AggroFilter" />` 장착 완료.
  - ⚠️ **절대 안전 코딩 준수**: KCP 심사 중인 하단 푸터(`3몬스터` 상호) 및 기존 결제/인증 코드는 단 1바이트도 건드리지 않았습니다.

### C. 썬드리머 스튜디오 고객센터 (`d:\Studio\admin-dashboard\`)
- [`d:\Studio\admin-dashboard\src\pages\CustomerSupport.tsx`](file:///d:/Studio/admin-dashboard/src/pages/CustomerSupport.tsx):
  - `?app=AggroFilter` / `SunDreamer` / `SaySee` / `WhatEat` 유입 시 앱별 맞춤 테마 배너 & `[← 앱으로 돌아가기]` & `[✨ 패밀리 앱 둘러보기]` 상단 바 자동 렌더링.
  - `크몽 ID` 입력 필드 완전 삭제 및 패밀리 앱 드롭다운 옵션 추가.
  - `[블랙박스 자동 진단 로그]`가 포함된 티켓 열람 시 일반 본문과 분리하여 다크모드 터미널 스타일의 **접이식(Collapsible) 블랙박스 진단 리포트 뷰어** 제공.
  - 관리자가 답변 등록 시 `MerlinHubClient().sendNotification()`을 호출해 고객 이메일로 `?ticket_id=...&app=...` 직행 점핑 링크 자동 발송.

---

## 🔍 3. 멀린 허브 에이전트 크로스체크 요청 항목 (Checklist)

멀린 허브 에이전트는 아래 사항을 크로스체크한 뒤, 이상이 없으면 **썬드리머(`D:\LumiNote\sundream`), 뭐먹지(`D:\WhatEat`), 세이씨(`D:\SaySee`)** 등 전 패밀리 앱으로 `v2.15.0` SDK 배포(대출)를 진행해 주세요.

1. **안전 격리(Try/Catch) 검증**:
   - `Support/blackbox.ts` 및 `HubSupportLink.tsx`의 모든 이벤트 리스너와 `fetch` 호출이 실패하더라도 호스트 앱의 렌더링이나 비즈니스 로직에 영향을 주지 않는지 확인.
2. **민감정보 마스킹 검증**:
   - `maskSensitiveValue()`에서 비밀번호, OTP, 카드번호, 주민번호 패턴이 `[FILTERED]` 처리되어 브레드크럼에 평문 노출되지 않는지 확인.
3. **SSO 및 로컬 읽음 상태(`read_ticket_{id}`) 호환성**:
   - 스튜디오 `CustomerSupport.tsx`와 `PublicLayout.tsx`가 사용하는 `localStorage.getItem('read_ticket_' + ticket.id)` 규격과 `HubSupportLink.tsx`의 미읽음 판별 로직이 100% 동일한지 확인.
4. **전 패밀리 앱 확산 적용 표준 코드**:
   - 각 앱의 `layout.tsx` (또는 `App.tsx`)에 `<HubErrorBoundary appId="..." />` + `<HubBugReporter appId="..." />` 추가.
   - 각 앱의 프로필/설정 페이지 `<HubLogoutCard />` 바로 위에 `<HubSupportLink appId="..." />` 추가.
