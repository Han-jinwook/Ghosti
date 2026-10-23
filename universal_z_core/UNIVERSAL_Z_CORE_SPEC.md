# 🦾 범용 만능 멀린 Z 코어 (`Universal Merlin Z-Core`) 전사 표준 명세서 (`UNIVERSAL_Z_CORE_SPEC.md`)

> **공식 마스터 고정 경로:** `D:\Z-Eye\universal_z_core\`  
> **직통 피드백 우체통:** `D:\Z-Eye\universal_z_core\inbox\`  
> **적용 범위:** 멀린 패밀리 16개 전 프로젝트 (`Z-Eye`, `Secretary`, `CafeBreaker`, `CafeScraper`, `SensTalk`, `AggroFilter`, `Vaulter`, `WhatEat`, `LumiNote`, `AutoNote` 등)

---

## 🚨 1. 전사 코딩강령 제14조 3대 절대 운영 원칙

1. **복사 배포 금지 ➔ 고정 경로(`D:\Z-Eye\universal_z_core\`) 단일 참조**:
   - 각 프로젝트 폴더마다 코어 파일을 복사해 넣으면 버전 파편화와 중복 커밋이 발생합니다.
   - 모든 프로젝트는 파일을 복사하지 않고 오직 **`D:\Z-Eye\universal_z_core\`** 고정 위치와 로컬 브릿지(`http://127.0.0.1:5198` 및 `http://127.0.0.1:5199/__merlin/query`)를 직접 참조합니다.
2. **직통 우체통 일원화 (`D:\Z-Eye\universal_z_core\inbox\`)**:
   - 코어 사용 중 막히는 보안 장벽이나 신규 API 요청이 생기면, 임의로 코어를 개조하거나 무거운 Playwright로 회귀하지 말고 **`D:\Z-Eye\universal_z_core\inbox\[프로젝트명]_[날짜]_[이슈요약].md`**에 보고서를 작성하십시오.
   - `Z-Eye` 에이전트가 이를 직접 읽고 **① 원 코어 vs 파워 코어 분류, ② 스토어 심사 패스 리스크 검열** 후 멀린님께 보고하여 업그레이드합니다.
3. **스토어 심사 보호를 위한 2트랙(`Two-Track`) 엄격 분리**:
   - **`core_store_clean\` (트랙 A — 스토어 심사 100% 프리패스용 순정 원 코어):** 일반 소비자 대상 스토어 출시 앱용. `chrome.debugger` 등 스토어 리젝 위험 권한과 상단 디버깅 경고바를 원천 배제한 안전 코어.
   - **`core_power_agent\` (트랙 B — 사내 에이전트/자동화 공용 파워 코어):** 스토어 비출시 사내 무인 자동화용. `chrome.debugger`(CDP 1.3) 기반 물리 클릭(`isTrusted: true`), 타이핑, 리치 HTML 붙여넣기, 중첩 Shadow DOM/iframe 관통 엔진 100% 탑재.

---

## 🌐 2. 크롬·엣지·웨일·브레이브 100% 호환 장착 방법 (딱 1회 등록)

크로미움 계열 모든 브라우저(`Chrome`, `MS Edge`, `Naver Whale`, `Brave`)에서 100% 동일하게 작동합니다:

1. 브라우저 주소창에 `chrome://extensions` (엣지는 `edge://extensions`, 웨일은 `whale://extensions`) 입력
2. 우측 상단 **[개발자 모드]** 켜기
3. **[압축해제된 확장 프로그램을 로드합니다]** 클릭 후 아래 경로 선택:
   - 사내 에이전트/무인 자동화 작업 시: **`D:\Z-Eye\universal_z_core\core_power_agent`**
   - 스토어 출시 앱 연동 테스트 시: **`D:\Z-Eye\universal_z_core\core_store_clean`**

---

## ⚡ 3. 전사 에이전트 공용 호출 인터페이스 (Python & Node.js SDK)

### 3.1 로컬 브릿지 서버 기동 (`127.0.0.1:5198`)
```bash
python D:\Z-Eye\universal_z_core\bridge\z_core_bridge_server.py
```

### 3.2 Python 프로젝트에서 즉시 호출 (`Secretary`, `CafeBreaker` 등)
파일을 복사하지 말고 고정 경로를 `sys.path`에 추가해 바로 호출합니다:

```python
import sys
sys.path.append(r"D:\Z-Eye\universal_z_core\bridge")
from z_core_sdk import ZCore

# 1) 중첩 Shadow DOM / iframe 내부 요소 탐색
info = ZCore.pierce_shadow_dom("button.se-publish-btn")

# 2) CDP 물리 마우스 클릭 (isTrusted: true -> 스마트에디터/보안사이트 100% 통과)
ZCore.trusted_click(selector="button.se-publish-btn")

# 3) CDP 물리 키보드 타이핑 + 엔터
ZCore.trusted_type("제트아이 만능 코어 테스트입니다.", selector="input.title", press_enter=True)

# 4) 리치 텍스트(HTML) 클립보드 주입 후 물리 Ctrl+V 발사
ZCore.trusted_paste(
    html="<h3>공지사항</h3><p>리치 텍스트와 링크카드가 그대로 붙여넣어집니다.</p>",
    selector=".se-content"
)
```

### 3.3 Node.js / TypeScript 프로젝트에서 즉시 호출
```js
import { ZCore } from 'file:///D:/Z-Eye/universal_z_core/bridge/z_core_sdk.mjs';

await ZCore.trustedClick({ selector: '#submit-btn' });
await ZCore.trustedPaste({
  html: '<b>굵은 글씨 본문</b>',
  selector: '.editor-body',
});
```

---

## 🛠️ 4. 지원 명령(`command`) 전체 명세

| 명령 (`command`) | 주요 파라미터 (`params`) | 설명 |
|---|---|---|
| `trustedClick` | `selector` (또는 `x`, `y`), `index`, `tabId` | `Input.dispatchMouseEvent` 물리 클릭 (`isTrusted: true`) |
| `trustedType` | `text`, `selector`, `delayMs`, `pressEnter` | `Input.insertText` 기반 한글/유니코드 무손실 물리 타이핑 |
| `trustedKey` | `key` (`Enter`, `Tab`, `Escape` 등), `modifiers` | `Input.dispatchKeyEvent` 물리 특수키/단축키 입력 |
| `trustedPaste` | `text`, `html`, `selector`, `tabId` | 클립보드에 리치 HTML/텍스트 주입 후 CDP 물리 `Ctrl+V` 발사 |
| `pierceShadowDOM` | `selector`, `index`, `tabId` | 중첩 Shadow DOM 및 iframe 내부 요소의 화면 중심 좌표 `(x, y)` 및 텍스트 추출 |
| `navigate` | `url`, `tabId` | 대상 탭을 지정된 URL로 즉시 이동 |
| `evalJs` | `expression`, `tabId` | CDP `Runtime.evaluate`로 페이지 내 JS 표현식 실행 후 결과 반환 |
| `listTabs` | 없음 | 현재 열려 있는 모든 브라우저 탭의 `id`, `title`, `url` 목록 조회 |

---

## 📦 5. 로컬 AI 모델 가중치(Weights) 자체 스토리지 ‘마스터 사본’ 영구 보관 강령

> **🚨 전사 인프라 절대 원칙:**  
> **“현재 로컬 서버와 PC 코어에 사용 중인 젬마 2 및 비전/임베딩 모델 가중치 원본 파일들을 외부(HuggingFace 등)에서 매번 당겨오지 말고, 우리 자체 스토리지(백업 하드디스크 및 R2 CDN)에 ‘마스터 사본’으로 영구 보관해 두어라.”**

- 로컬 서버와 PC 코어(`universal_z_core`)에서 구동되는 모든 AI 모델(Gemma 2, 비전/OCR, 768차원 임베딩 모델 등)의 가중치 원본은 외부 레지스트리(HuggingFace 등)에서 런타임에 풀(Pull)하지 않고, 당사 **백업 하드디스크 및 자체 R2 CDN에 보관된 ‘마스터 사본(SHA-256 고정)’**에서만 로드·배포합니다.
