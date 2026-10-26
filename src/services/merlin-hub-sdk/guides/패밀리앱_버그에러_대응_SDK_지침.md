# 🛠️ 멀린 패밀리 앱 버그·에러 대응 및 SDK 연동 지침서

| 문서 버전 | 제정 일자 | 주관 부서 | 적용 대상 |
| :---: | :---: | :---: | :--- |
| **v1.0.0** | **2026-10-18** | **🏛️ 멀린 패밀리 OS 허브 총괄** | **썬드리머, 어그로필터, 뭐먹지, 리얼픽 등 전 패밀리 앱** |

---

## 1. 지침 제정 배경 및 철학

1. **무반응 백화현상(White Screen) 제로화**:
   - 모바일 웹앱에서 자바스크립트 런타임 에러가 발생했을 때 화면이 하얗게 멈추거나 침묵형 무반응 상태가 되면 고객은 앱을 강제 종료하고 이탈합니다.
   - 에러가 발생한 순간 0.1초 만에 튕김을 안전하게 가로채고(Catch), 고객에게는 당황하지 않도록 **1초 미니 오류 접수창**을 표출하여 심리적 안정감을 제공합니다.
2. **개발자가 묻지 않아도 되는 100% 자동 블랙박스 수집**:
   - 고객에게 "어디서 에러가 났나요?", "기종이 무엇인가요?"를 되물을 필요 없이, 에러가 난 **정확한 소스 파일 경로, 줄 번호, 스택트레이스, 직전 20개 행동 브레드크럼(클릭·입력·화면전환), 기기/OS 정보**를 클라이언트 SDK가 스스로 캡처하여 동봉합니다.
3. **고객 접점과 쇼룸의 분업 (Hub SDK ➔ 3몬스터)**:
   - **에러가 터진 순간의 1차 접수**: 고객의 흐름을 끊지 않기 위해 **해당 앱 내부 미니창**에서 1초 만에 해결.
   - **평상시 문의 및 답변 확인**: SSO(단일 로그인)를 통해 **3몬스터 통합 고객센터(`[나의 문의방]` & 전체 앱 쇼룸)**으로 안내하여 생태계 전반의 교차 유입 극대화.

---

## 2. 허브 SDK 3대 공통 컴포넌트 사양

멀린 Hub SDK (`UI/BugReporter` 모듈)는 아래 3대 요소를 표준으로 제공합니다.

### 1) `<HubErrorBoundary>` (안전 격리 가드)
- **역할**: 하위 리액트 컴포넌트 트리에서 렌더링 크래시나 치명적 언핸들드 에러가 발생해도 전체 앱이 하얗게 죽지 않도록 방어.
- **동작**: 에러 발생 시 앱을 안전한 폴백 UI로 감싸고, 즉시 `<HubBugReporter>` 모달을 트리거합니다.

### 2) `<HubBugReporter>` (1초 미니 오류 접수창)
- **역할**: 팝업 형태로 부드럽게 노출되는 초경량 접수 모달.
- **주요 UI 요소**:
  - 간결한 상황 안내: *"일시적인 오류가 감지되었습니다. 1초 만에 접수해 주시면 즉시 해결해 드립니다!"*
  - 고객 입력란: 한 줄 간단 메모 (선택사항, 생략 시에도 자동 로그만으로 접수 가능)
  - `[즉시 접수하기]` 버튼: 클릭 즉시 블랙박스 로그를 패키징하여 3몬스터 중앙 CS API(`POST /api/support/tickets`)로 전송
  - **1차 안심 즉시 응답**: 전송 완료 즉시 *"소중한 제보 감사합니다! 즉시 분석에 착수했습니다. 진행 상황은 언제든 [나의 문의방]에서 확인하실 수 있습니다^^"* 멘트 노출 후 자동 닫힘.

### 3) `<HubSupportLink>` (프로필 고객센터 고정 버튼)
- **위치**: 마이페이지 / 프로필 카드 하단 `'로그아웃'` 바로 윗 라인에 필수 고정 배치.
- **동작**: 클릭 시 동일 이메일 SSO 토큰을 유지한 채 `https://3monster.sundreamer.app/cs?app={app_id}`로 이동하여 **[나의 문의방]** 및 **[전체 앱 쇼룸]**으로 직행.

---

## 3. 개별 서비스 앱 표준 적용 가이드 (썬드리머 기준 예시)

모든 패밀리 앱 개발자(또는 개별 앱 AI)는 아래 3단계 코드를 필수로 반영해야 합니다.

### Step 1. 최상위 엔트리 `App.tsx` 에러 바운더리 감싸기
```tsx
import { HubErrorBoundary, HubBugReporter, HubNotifier } from './services/merlin-hub-sdk/react';

export default function App() {
  return (
    <HubErrorBoundary appId="sundreamer" appVersion="v12.2">
      <MainLayout>
        {/* 앱 메인 뷰 및 라우팅 */}
      </MainLayout>

      {/* 1초 미니 오류 접수창 (전역 팝업) */}
      <HubBugReporter appId="sundreamer" appVersion="v12.2" />
      <HubNotifier />
    </HubErrorBoundary>
  );
}
```

### Step 2. 프로필(내 정보) 페이지 내 고객센터 직행 버튼 배치
```tsx
import { HubSupportLink, HubLogoutCard } from './services/merlin-hub-sdk/react';

export function ProfileView() {
  return (
    <div className="space-y-4">
      {/* 회원 프로필 정보 카드들 */}
      
      {/* 🛠️ 3몬스터 고객센터 직행 링크 (로그아웃 바로 위 고정) */}
      <HubSupportLink 
        appId="sundreamer"
        label="🛠️ 고객센터 / 나의 문의방 (공지·문의내역)" 
      />

      {/* 로그아웃 버튼 */}
      <HubLogoutCard />
    </div>
  );
}
```

### Step 3. 클라이언트 행동 브레드크럼 자동 수집 (최근 20개)
- 허브 SDK 내부의 `HubBreadcrumbTracker`가 브라우저의 주요 이벤트(`click`, `input change`, `navigation`)를 리스닝하여 메모리 링 버퍼(최대 20개)에 실시간 보관합니다.
- 개인정보 보호를 위해 비밀번호(`type="password"`), 주민번호/계좌번호 양식, 결제 카드 번호는 자동 `[FILTERED]` 처리되어 전송되지 않습니다.

---

## 4. 블랙박스 로그 전송 데이터 스키마

허브 SDK에서 3몬스터 백엔드로 전송하는 표준 데이터 규격은 다음과 같습니다:

```typescript
export interface HubBugReportPayload {
  app_id: string;               // 예: "sundreamer", "aggrofilter", "whateat"
  app_version: string;          // 예: "v12.2"
  user_email?: string;          // 로그인된 회원 이메일 (비로그인 시 생략 가능)
  user_hub_id?: string;         // 허브 UUID
  category: 'BUG' | 'CRASH' | 'INQUIRY';
  user_comment?: string;        // 고객이 직접 입력한 메모
  error_metadata?: {
    error_message: string;      // error.message
    file_path?: string;         // 소스 파일명 (예: Records.tsx)
    line_number?: number;       // 에러 발생 행 번호
    column_number?: number;     // 열 번호
    stack_trace: string;        // error.stack
  };
  device_context: {
    os: string;                 // "iOS", "Android", "Windows", "macOS"
    os_version: string;         // "17.4.1"
    browser: string;            // "Safari", "Chrome", "Naver In-App", "Kakao In-App"
    screen_resolution: string;  // "393x852"
    display_mode: 'standalone' | 'browser';
  };
  breadcrumbs: Array<{
    timestamp: string;          // ISO 8601
    category: 'ui.click' | 'ui.input' | 'navigation' | 'network.error';
    target: string;             // 클릭 요소 선택자 또는 URL
    value?: string;             // 입력 요약값 (민감정보 마스킹됨)
  }>;
}
```

---

## 5. 단계별 롤아웃 로드맵

1. **1단계 (허브 SDK 모듈 패키징)**:
   - `d:\MerlinFamilyOS\허브_라이브러리\` 내 `HubBugReporter.tsx`, `HubErrorBoundary.tsx`, `HubSupportLink.tsx` 표준화 및 대장 등록.
2. **2단계 (1호 앱 썬드리머 우선 적용 및 실전 검증)**:
   - `D:\LumiNote\sundream`에 SDK v2.14.0 탑재, 프로필 고객센터 링크 연결 및 미니 접수창 동작 테스트.
3. **3단계 (3몬스터 고객센터 오픈과 동시 전체 패밀리 앱 확산)**:
   - 내일 3몬스터 고객센터 API 및 쇼룸이 가동되면, 어그로필터, 리얼픽, 뭐먹지 등 전 패밀리 앱으로 일괄 확대.
