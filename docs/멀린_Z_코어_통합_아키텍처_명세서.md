# 🏗️ 멀린 Z 코어 (Merlin Z-Core) 통합 아키텍처 및 OS 에이전트 마스터 명세서

> **문서 버전:** v2.2 (SSOT 통합 정본)  
> **최종 업데이트:** 2026-10-26 (인수인계장 및 구형 강령 풀칠 제거, 원 코어+내장 플러그인 단일 포트 5199 표준 통합)  
> **공식 마스터 고정 경로:** `D:\Ghosti\universal_z_core\`  
> **전사 통합 중앙 우체국:** `D:\Secretary\post_office\`  
> **단일 표준 로컬 포트:** `http://127.0.0.1:5199`  
> **적용 범위:** 멀린 패밀리 16개 전 프로젝트 (`Ghosti`, `Secretary`, `CafeBreaker`, `SensTalk`, `AggroFilter`, `Vaulter` 등)

---

## 1. 전사 Z 코어 통합 아키텍처 및 4대 운영 원칙

1. **복사 배포 금지 ➔ 단일 경로(`D:\Ghosti\universal_z_core\`) 및 단일 포트(`127.0.0.1:5199`) 직결:**
   - 프로젝트마다 코어를 복사해 배포하거나 별도 포트(`28888` 등)를 운영하지 않습니다.
   - 모든 앱은 단일 로컬 포트 `http://127.0.0.1:5199`로 통신하여 리소스 점유율 0.1% 미만을 달성합니다.
2. **원 코어(`Merlin_Z_Core_Setup.exe`) + 내장 소프트웨어 플러그인 아키텍처:**
   - 단 1개의 설치 파일 내부에 핵심 서비스 플러그인을 탑재하여 단일 포트에서 직결 작동합니다:
     - **`plugin_ghosti_os.py` (`/__zcore/*`, `/api/ghosti/*`)**: 귀신같이 OS 제어, 5대 은닉 금고 3초 포렌식, 윈도우 휴지통 `$I` 바이너리 해독, `[복원 기록]` 3단계 사전 검진 및 1초 원복, TopMost 손가락(`👆`) 오버레이.
     - **`plugin_senstalk.py` (`/api/senstalk/*`)**: 6대 메신저 릴레이 발송 엔진 (평소 CPU 0.0%, 필요 시에만 발송 큐 가동).
     - **`plugin_aggrofilter.py` (`/api/aggrofilter/*`)**: 크롬 확장팩 없이 유저 로컬 IP로 유튜브 자막 트랙(`TimedText`) 직접 추출.
3. **PC vs 모바일 스토어 심사 100% 프리패스 분리 원칙:**
   - **PC 버전 (`Merlin_Z_Core_Setup.exe`)**: 윈도우 트레이 상주(`pystray`), 시작 시 자동실행, 무중단 자동 업데이트, Microsoft Artifact Signing 디지털 서명 완료.
   - **모바일 버전 (1MB APK / iOS 앱)**: 스토어 심사 리젝 요소(자체 바이너리 교체, 화면 해킹 권한)를 배제하고, 표준 공유 시트(`ACTION_SEND`) 및 로컬 통신을 통해 심사 통과율 100% 보장.
4. **전사 중앙 우체국 단일 소통 (`D:\Secretary\post_office\`):**
   - 코어 개선이나 신규 API 요청은 비서실 우체국을 통해서만 교신하며 임의의 월권 수정을 차단합니다.

---

## 2. 단일 표준 포트 (`127.0.0.1:5199`) 내장 플러그인 API 엔드포인트 규격

| 내장 플러그인 | HTTP 엔드포인트 (`127.0.0.1:5199`) | 상세 기능 및 스펙 |
|---|---|---|
| **통합 코어 게이트웨이** | `GET /__merlin/health`<br>`POST /__merlin/query` | 코어 버전, 자동실행 상태, 내장 플러그인 3종 상태 확인 및 단일 진입점 라우팅 |
| **귀신같이 OS 제어 (`plugin_ghosti_os`)** | `GET /__zcore/os-inspect`<br>`POST /__zcore/forensic-scan`<br>`POST /__zcore/os-overlay`<br>`GET /__zcore/restore-points`<br>`POST /__zcore/restore-rollback`<br>`POST /__zcore/gdrive-smart-scan`<br>`POST /__zcore/ai-baton-touch` | 실물 Windows OS 진단, 3초 오피스 포렌식, TopMost 손가락 오버레이, 최근 1달 `[복원 기록]` 3단계 사전 검진(`🟢 100% 복원 가능` / `🟡 부분 복원 가능` / `🔴 복원 불가`), `G:` 드라이브 무설정 스마트 색인, 최근 사용 AI 감지 및 제미나이 기본 바톤터치 |
| **센스톡 (`plugin_senstalk`)** | `GET /api/senstalk/health`<br>`POST /api/senstalk/sync`<br>`POST /api/senstalk/dispatch` | 6대 메신저 발송 대기열 동기화, `CF_DIB` 클립보드 장전 및 `[Enter]` 연속 발송 제어 |
| **어그로필터 (`plugin_aggrofilter`)** | `GET /api/aggrofilter/health`<br>`POST /api/aggrofilter/extract` | 유저 로컬 IP 기반 유튜브 자막 트랙(`TimedText`) 및 메타데이터 추출 |

---

## 3. 설정몬스터 실물 진단 및 오피스 포렌식 아키텍처

1. **오피스·문서 증발 3초 결정론적 포렌식 (`/__zcore/forensic-scan`):**
   - Excel, Word, HWP 자동복구 금고(`UnsavedFiles`, `ShadowVault`, `Documents` 등) 10대 경로를 3초 이내에 스캔하여 실물 텍스트 5줄 미리보기를 추출합니다.
   - 불필요한 다중 버튼을 배제하고 **`[📂 탐색기 검색창에 넣어 띄우기]`** 단일 버튼으로 일원화하여, 탐색기 실행 즉시 파일명을 자동 검색창에 입력해 타겟 파일 단 1개만 하이라이트합니다.
2. **레이아웃 시프트 0px 모달 UI 및 순수 손가락(`👈`) 가이드:**
   - 비동기 진단 로드로 인한 화면 밀림을 원천 차단하기 위해 증상 선택 및 대화창을 모달 최상단에 고정 배치합니다.
   - 장황한 경고 배너 대신 버튼 옆에 순수 손가락(`👈`) 아이콘만 노출하여 집중도를 극대화합니다.
3. **MS 신경망 성우 투톱(`현수` & `선희`) 무지연·무과금 캐싱 체계:**
   - **`현수(ko-KR-HyunsuNeural)`**: 기본 설정몬스터 안내 및 시스템 브리핑.
   - **`선희(ko-KR-SunHiNeural)`**: 문서 요약 및 키워드 문장 발췌 낭독.
   - `imageio_ffmpeg` 연동으로 음량 정규화(`loudnorm=-16LUFS`) 및 192k MP3 변환 적용.
   - 고정 안내 멘트 13종을 `tts_cache/*.mp3`로 사전 합성 완료하여 0.001초 무지연 재생 보장 (API 종량제 비용 0원).

---

## 4. Microsoft Artifact Signing 디지털 코드 서명 파이프라인

1. **인프라 원장:**
   - 조직명: **썬드림주식회사**
   - 테넌트: `beakessundreamer.onmicrosoft.com`
   - 인증서 프로필: `sundream-public-cert` (공용 신뢰 Public Trust)
   - 서명 도구: `Azure.CodeSigning.Dlib.dll` + Windows SDK `SignTool.exe`
2. **자동 서명 명령어:**
   ```powershell
   signtool.exe sign /v /fd SHA256 /tr "http://timestamp.acs.microsoft.com" /td SHA256 /dlib "Azure.CodeSigning.Dlib.dll" /dmc metadata.json "dist\Merlin_Z_Core_Setup.exe"
   ```
3. **효과:**
   - Windows Defender SmartScreen 파란색 경고창을 원천 제거하고, 썬드림주식회사 공인 서명으로 100% 실행 신뢰를 확보합니다.

---

## 5. 로컬 AI 모델 가중치 자체 스토리지 영구 보관 원칙

> **🚨 전사 인프라 절대 원칙:**  
> 로컬 서버 및 PC 코어에 사용되는 `EmbeddingGemma 2` 및 비전/임베딩 모델 가중치 원본은 외부(HuggingFace 등)에서 매번 다운로드하지 않고, 당사 자체 스토리지(백업 하드디스크 및 R2 CDN)에 '마스터 사본'으로 영구 보관하여 인프라 독립성을 유지합니다.
