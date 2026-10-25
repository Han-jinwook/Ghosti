# 🦾 범용 만능 멀린 Z 코어 (`Universal Merlin Z-Core`) 전사 표준 명세서 (`UNIVERSAL_Z_CORE_SPEC.md`)

> **공식 마스터 고정 경로:** `D:\Z-Eye\universal_z_core\`  
> **전사 통합 중앙 우체국:** `D:\Secretary\post_office\` (기존 `universal_z_core/inbox/` 폐지 ➔ 비서방 중앙 우체국 하나로 단일화)  
> **단일 표준 로컬 포트:** `http://127.0.0.1:5199` (구형 `28888` 등 파편화 포트 전면 폐기)  
> **적용 범위:** 멀린 패밀리 16개 전 프로젝트 (`Z-Eye`, `Secretary`, `CafeBreaker`, `CafeScraper`, `SensTalk`, `AggroFilter`, `Vaulter`, `WhatEat`, `LumiNote`, `AutoNote` 등)

---

## 🚨 1. 전사 코딩강령 제14조 4대 절대 운영 원칙

1. **복사 배포 금지 ➔ 고정 경로(`D:\Z-Eye\universal_z_core\`) 및 단일 포트(`127.0.0.1:5199`) 참조**:
   - 각 프로젝트 폴더마다 코어 파일을 복사해 넣거나 앱마다 별도 로컬 포트(`28888` 등)를 열면 버전 파편화와 포트 충돌이 발생합니다.
   - 모든 PC/웹 프로젝트는 오직 **`D:\Z-Eye\universal_z_core\`** 고정 위치와 **단일 표준 포트 `http://127.0.0.1:5199`**를 직접 참조합니다.
2. **전사 중앙 우체국 단일화 (`D:\Secretary\post_office\`)**:
   - 코어 사용 중 막히는 보안 장벽이나 신규 플러그인/API 요청이 생기면, **`D:\Secretary\post_office\Z-Eye_[보낸앱]_[이슈요약]_[YYYYMMDD_HHMM].md`**로 투함하십시오.
   - `Z-Eye` 에이전트가 이를 읽고 **① 원 코어 내장 플러그인 vs 사내 파워 코어 분류, ② 모바일 스토어 심사 패스 리스크 검열** 후 멀린님께 보고하여 업그레이드합니다.
3. **원 코어(`Merlin_Z_Core_Setup.exe`) + 내장 소프트웨어 플러그인(`Built-in Software Plugins`) 아키텍처**:
   - 유저가 프로그램을 2중으로 다운로드받지 않도록 **단 1개의 실행파일(`Merlin_Z_Core_Setup.exe`, MS 코드 서명 적용)** 내부에 소프트웨어 플러그인 모듈들을 내장하여 `127.0.0.1:5199` 단일 포트로 라우팅합니다:
     - **`plugin_zeye_os.py` (`/api/zeye/*`, `/__zcore/*`)**: 제트아이 & 3몬스터(설치·수리·정리) 전용 OS 제어, 5대 은닉 금고 3초 포렌식, 대화형 폴더 정리 & **`[복원 기록]` (`restore_points.json`) 3단계 무결성 사전 검진(Pre-Check)**, TopMost 화살표 오버레이.
     - **`plugin_senstalk.py` (`/api/senstalk/*`)**: 센스톡 6대 메신저(`kakao`, `line`, `telegram`, `whatsapp`, `wechat`, `insta`) 창 자동 탐지, `CF_DIB` 카드 이미지/유니코드 클립보드 장전, `[Enter]` 키업 감응 연속 발송, `F8`(일시정지)/`F9`(건너뛰기) 핫키 (평소 CPU 0.0%, 발송 시에만 On-Demand 기동).
     - **`plugin_aggrofilter.py` (`/api/aggrofilter/*`)**: 어그로필터 전용 유튜브 자막 추출 플러그인. 크롬 확장팩(0개) 없이 **유저 본인의 로컬 기기 IP(가정용/모바일 IP)**로 유튜브 `captionTracks`/`TimedText`를 직접 추출하여 서버 IP 차단을 100% 우회.
4. **PC vs 모바일 스토어 심사 100% 프리패스 분리 원칙**:
   - **PC 버전 (`Merlin_Z_Core_Setup.exe`)**: 구글/애플 앱스토어 심사 대상이 아닌 일반 윈도우 설치 프로그램이므로 시계 옆 트레이 상주(`pystray`), 윈도우 시작 시 자동실행(`HKCU\...\Run`), 무중단 자동 업데이트(`/self-update`), MS 코드 서명(`signtool.exe` Azure Trusted Signing)을 100% 탑재합니다.
   - **모바일 버전 (1MB APK / iOS 앱)**: 스토어 심사 리젝 사유가 되는 자체 바이너리 교체(`self-update`)나 타사 앱 화면 해킹(`AccessibilityService` 유튜브 화면 읽기)을 절대 넣지 않습니다. 모바일 어그로필터는 **OS 표준 공유 시트(`[공유 📤 ➔ 어그로필터]`, `ACTION_SEND`) + 유저 스마트폰 로컬 IP(`LTE/5G/Wi-Fi`) 기반 공개 자막 트랙 추출**로 스토어 심사 통과율 100%를 보장합니다.

---

## ⚡ 2. 단일 표준 포트 (`127.0.0.1:5199`) 내장 플러그인 엔드포인트 규격

| 내장 플러그인 | HTTP 엔드포인트 (`127.0.0.1:5199`) | 설명 |
|---|---|---|
| **통합 코어 게이트웨이** | `GET /__merlin/health`<br>`POST /__merlin/query` | 코어 버전, 자동실행 여부, 내장 플러그인 3종 상태 확인 및 단일 진입점 호출 (`plugin: "zeye" \| "senstalk" \| "aggrofilter"`) |
| **제트아이 & 3몬스터 (`plugin_zeye_os`)** | `GET /__zcore/os-inspect`<br>`POST /__zcore/forensic-scan`<br>`POST /__zcore/os-overlay`<br>`GET /__zcore/restore-points`<br>`POST /__zcore/restore-rollback`<br>`POST /__zcore/folder-tree-summary` | 실물 Windows OS 진단, 3초 포렌식, TopMost 화살표 오버레이, 최근 한 달 **`[복원 기록]` 0.01초 3단계 무결성 사전 검진(`🟢 100% 복원 가능` / `🟡 부분 복원 가능` / `🔴 복원 불가`)** 및 1초 원복, Zero-LLM 폴더 트리 요약 |
| **센스톡 (`plugin_senstalk`)** | `GET /api/senstalk/health`<br>`GET /api/senstalk/poll`<br>`POST /api/senstalk/sync`<br>`POST /api/senstalk/start`<br>`POST /api/senstalk/pause`<br>`POST /api/senstalk/skip`<br>`POST /api/senstalk/dispatch` | 6대 메신저 발송 대기열 동기화, 클립보드 자동 장전, `[Enter]` 연속 발송 및 `F8`/`F9` 제어 (구 `28888` 포트 완전 대체) |
| **어그로필터 (`plugin_aggrofilter`)** | `GET /api/aggrofilter/health`<br>`POST /api/aggrofilter/extract` | 크롬 확장팩 없이 유저 로컬 IP로 유튜브 URL(`watch?v=`, `youtu.be/`, `shorts/`)의 자막 트랙(`TimedText`) 및 메타데이터 즉시 추출 |

---

## 🛡️ 3. MS 코드 서명 (`build_signed_merlin_z_core.py`) 및 사내 CDP 브릿지 (`5198`)

- **MS 코드 서명 파이프라인**: `python D:\Z-Eye\universal_z_core\os_agent\build_signed_merlin_z_core.py --check`를 통해 `Merlin_Z_Core_Setup.exe` 단일 바이너리 패키징 및 Microsoft Artifact Signing(`Azure.CodeSigning.Dlib.dll` + SHA-256 + RFC3161 타임스탬프) 서명 검증을 수행합니다.
- **사내 자동화 전용 브라우저 CDP 브릿지 (`core_power_agent`, `127.0.0.1:5198`)**: 스토어 비출시 사내 무인 자동화 에이전트(`CafeBreaker` 등)가 사용할 때만 `D:\Z-Eye\universal_z_core\bridge\z_core_bridge_server.py`를 기동합니다.

---

## 📦 4. 로컬 AI 모델 가중치(Weights) 자체 스토리지 ‘마스터 사본’ 영구 보관 강령

> **🚨 전사 인프라 절대 원칙:**  
> **“현재 로컬 서버와 PC 코어에 사용 중인 젬마 2 및 비전/임베딩 모델 가중치 원본 파일들을 외부(HuggingFace 등)에서 매번 당겨오지 말고, 우리 자체 스토리지(백업 하드디스크 및 R2 CDN)에 ‘마스터 사본’으로 영구 보관해 두어라.”**
