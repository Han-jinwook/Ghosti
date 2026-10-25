# 📘 멀린 Z 코어 (`Merlin_Z_Core`) 전사 통합 가이드북 (`멀린Z코어_전사가이드북.md`)

> **🚨 [전사 에이전트 필독 — 파일 복사(Copy) 절대 금지!]**  
> 패밀리 앱(`SensTalk`, `AggroFilter`, `Secretary`, `CafeBreaker`, `Vaulter`, `WhatEat`, `SunDreamer` 등)은 이 폴더의 파일들을 자기 프로젝트로 복사해 가지 마십시오.  
> 모든 프로젝트는 **`D:\Z-Eye\universal_z_core\` 고정 경로**와 **단일 표준 포트 `http://127.0.0.1:5199`**를 그 자리에서 그대로 호출하여 사용합니다.  
> 추가 기능이나 새 플러그인이 필요하면 비서방 전사 중앙 우체국(**`D:\Secretary\post_office\Z-Eye_[보낸앱]_[주제]_[날짜].md`**)으로 요청서를 보내주십시오.

---

## 1. 🏗️ 멀린 Z 코어 전체 아키텍처 & 기술 스택 요약

| 구분 | 구성 모듈 / 경로 | 포트 / 프로토콜 | 핵심 역할 및 기술 스택 |
| :--- | :--- | :--- | :--- |
| **원 코어 마스터 데몬** | `os_agent/merlin_z_core_daemon.py`<br>(`Merlin_Z_Core_Setup.exe`) | **`127.0.0.1:5199`**<br>(`ThreadingHTTPServer`) | • 시계 옆 시스템 트레이 상주 (`pystray`)<br>• 윈도우 시작 시 자동 실행 (`HKCU\...\Run\Merlin_Z_Core`)<br>• 다중 웹앱 동시 요청 멀티스레드 비동기 처리<br>• MS 코드 서명 (`build_signed_merlin_z_core.py`, SmartScreen 방어) |
| **내장 플러그인 ①**<br>*(제트아이·3몬스터)* | `os_agent/plugin_zeye_os.py`<br>`os_agent/merlin_z_core_os.py` | `127.0.0.1:5199`<br>`/__zcore/*`<br>`/api/zeye/*` | • 실물 Windows OS 레지스트리/스풀러/프로세스 진단<br>• 5대 은닉 금고 3초 오피스 포렌식 + 윈도우 휴지통(`$Recycle.Bin`) 추적<br>• Zero-LLM 폴더 트리 초경량 요약 (`folder-tree-summary`)<br>• **`[복원 기록]`(`restore_points.json`) 0.01초 3단계 무결성 Pre-Check & 1초 원복**<br>• 브라우저 밖 모니터 최상단(`TopMost`) 투명 화살표(`👆`) 오버레이 |
| **내장 플러그인 ②**<br>*(센스톡 메신저)* | `os_agent/plugin_senstalk.py` | `127.0.0.1:5199`<br>`/api/senstalk/*` | • 6대 메신저(`kakao`, `line`, `telegram`, `whatsapp`, `wechat`, `insta`) 창 탐지<br>• `CF_DIB` 카드 이미지 / 유니코드 텍스트 클립보드 자동 장전<br>• `[Enter]` 키업 감응 연속 발송 + `F8`(일시정지)/`F9`(건너뛰기) 핫키<br>• 평상시 CPU 점유율 **0.0%** (`/sync` 또는 `/start` 시에만 On-Demand 기동) |
| **내장 플러그인 ③**<br>*(어그로필터 자막)* | `os_agent/plugin_aggrofilter.py` | `127.0.0.1:5199`<br>`/api/aggrofilter/*` | • **크롬 확장팩 0%!** 유저 로컬 기기 IP(가정용/모바일 IP)로 유튜브 `captionTracks`/`TimedText` 자막 직접 추출 (서버 IP 차단 100% 우회)<br>• 모바일은 **OS 표준 공유 시트(`ACTION_SEND`) + 스마트폰 로컬 IP** 방식으로 스토어 심사 100% 프리패스 |
| **공용 Win32 네이티브** | `os_agent/core_win32.py` | In-Process (`ctypes`) | • `WinSta0\Default` 대화형 데스크톱 바인딩, 창 강제 포커스(`AttachThreadInput`), 유니코드/DIB 클립보드 제어, 자동실행 레지스트리 제어 |
| **사내 자동화 CDP 브릿지** | `bridge/z_core_bridge_server.py`<br>`core_power_agent/` | `127.0.0.1:5198` | • 스토어 비출시 사내 무인 자동화(`CafeBreaker` 등) 전용 크로미움 CDP 1.3 물리 클릭(`isTrusted: true`), 타이핑, Shadow DOM 관통 |

---

## 2. 📂 폴더 구조 안내 (`D:\Z-Eye\universal_z_core\`)

```text
D:\Z-Eye\universal_z_core\
├── 멀린Z코어_전사가이드북.md          👈 [현재 문서] 파일 가져가기 전 필독 가이드북
├── UNIVERSAL_Z_CORE_SPEC.md          👈 전사 표준 명세서
├── os_agent\                         👈 [핵심] 단일 포트(5199) PC 상주 데몬 & 내장 소프트웨어 플러그인
│   ├── merlin_z_core_daemon.py       (마스터 데몬: 127.0.0.1:5199 멀티스레드 라우터)
│   ├── core_win32.py                 (공용 Win32 API: 창 포커스, 클립보드, 레지스트리)
│   ├── plugin_zeye_os.py             (플러그인 1: Z-Eye & 3몬스터 OS 제어 · [복원 기록] Pre-Check)
│   ├── plugin_senstalk.py            (플러그인 2: 센스톡 6대 메신저 릴레이 발송 엔진)
│   ├── plugin_aggrofilter.py         (플러그인 3: 어그로필터 로컬 IP 유튜브 자막 추출기)
│   ├── merlin_z_core_os.py           (Windows 실물 포렌식 · TopMost 화살표 오버레이 워커)
│   ├── merlin_tts_engine.py          (로컬 캐싱 TTS 음성 합성기)
│   └── build_signed_merlin_z_core.py (PyInstaller 단일 .exe 빌드 + MS 코드 서명 스크립트)
├── bridge\                           👈 사내 에이전트용 Python / Node.js SDK
│   ├── z_core_sdk.py
│   ├── z_core_sdk.mjs
│   └── z_core_bridge_server.py
├── core_store_clean\                 👈 스토어 심사 100% 통과용 순정 확장 코어 (디버거 권한 0%)
└── core_power_agent\                 👈 사내 무인 자동화 전용 파워 코어 (CDP 1.3 물리 이벤트)
```

---

## 3. ⚡ 패밀리 앱별 1분 연동 레시피 (복붙용 예제)

### ① 공통 헬스체크 (코어 실행 여부 확인)
```javascript
const res = await fetch('http://127.0.0.1:5199/__merlin/health');
const health = await res.json();
// health.ok === true, health.builtinPlugins: { zeye_os, senstalk, aggrofilter }
```

### ② 센스톡 (`SensTalk`) — 6대 메신저 대기열 동기화 및 `[Enter]` 연속 발송
```javascript
// 1) 발송 명단 동기화
await fetch('http://127.0.0.1:5199/api/senstalk/sync', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    queue: [
      { name: '김철수 대표님', channel: 'kakao', msg: '대표님, 안부 인사드립니다!' },
      { name: '이영희 팀장님', channel: 'line', msg: '팀장님, 요청하신 자료 전달드립니다.' }
    ]
  })
});

// 2) 발송 시작 (첫 번째 수신자 클립보드 자동 장전 + 메신저 창 포커스 + Enter 감응 시작)
await fetch('http://127.0.0.1:5199/api/senstalk/start', { method: 'POST' });

// 3) 진행 상태 폴링
const poll = await (await fetch('http://127.0.0.1:5199/api/senstalk/poll')).json();
```

### ③ 어그로필터 (`AggroFilter`) — 크롬 확장팩 없이 로컬 IP 유튜브 자막 추출
```javascript
const res = await fetch('http://127.0.0.1:5199/api/aggrofilter/extract', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })
});
const data = await res.json();
// data.title, data.channelName, data.segments ([{ startSec, durationSec, text }]), data.fullTranscript
```

### ④ 제트아이 & 3몬스터 (`Z-Eye`) — `[복원 기록]` 3단계 무결성 사전 검진(Pre-Check) 및 1초 원복
```javascript
// 1) 최근 한 달 [복원 기록] 조회 (0.01초 파일 존재 여부 Pre-Check 배지 포함)
const rp = await (await fetch('http://127.0.0.1:5199/__zcore/restore-points')).json();
// rp.restorePoints[0].statusBadge -> "🟢 [100% 완벽 복원 가능]" | "🟡 [부분 복원 가능]" | "🔴 [복원 불가]"

// 2) 특정 복원 지점(#104)으로 1초 원복
await fetch('http://127.0.0.1:5199/__zcore/restore-rollback', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ restoreId: '#104' })
});
```

---

## 4. 🔒 다중 패밀리 앱 동시 실행 시 충돌 방지(Concurrency) 설계
1. **HTTP 멀티스레딩 (`ThreadingHTTPServer`)**: 여러 패밀리 웹앱 탭이 동시에 `127.0.0.1:5199`로 요청을 보내도 각각 독립 스레드에서 병렬 처리되어 블로킹이 발생하지 않습니다.
2. **플러그인별 네임스페이스 격리**: `/__zcore/*`, `/api/senstalk/*`, `/api/aggrofilter/*`로 경로와 상태 파일이 완전히 분리되어 있습니다.
3. **물리적 클립보드/포커스 충돌 방지 (`Clipboard Lock`)**: 센스톡이 `[Enter]` 연속 발송을 진행 중일 때는 클립보드 보호 잠금이 작동하여 다른 플러그인이 발송 도중 클립보드를 덮어쓰지 못하도록 보호합니다.
