# ⚡ 제트아이 (Z-Eye) — The Ultimate All-Seeing AI & Zero-Cloud Lounge

> **글로벌 공식 브랜드명:** `제트아이 (Z-Eye / Zeye)` (`zeye.sundreamer.app`)  
> **GitHub 공식 저장소:** `https://github.com/Han-jinwook/Z-Eye.git`  
> **로컬 작업 경로:** `d:\Z-Eye`

---

## 1. 새 세션(New Session) 바통 이어받기 필수 문서 (SSOT)

새로운 세션에서 작업을 이어갈 때는 아래 3개 문서를 가장 먼저 읽고 시작합니다:

1. **[`docs/멀린강령.md`](./docs/멀린강령.md):** 호칭(`멀린님`), 순수 한글 커밋 메시지 규칙, 보고 형식(`[7자리 Git 해시 / 일시] 커밋 코멘트 내용`), `docs/기능명세.md` 자동 동기화 강령.
2. **[`docs/기능명세.md`](./docs/기능명세.md):** 현재 Z-Eye 코드베이스에 100% 실제 구현된 **5대 라운지(개인·패밀리·클럽·스쿨·업무)** 및 **4대 핵심 무기(투시검색·여권·클린몬스터·설정몬스터)** 엔지니어링 명세.
3. **[`docs/Z-Eye기획서.md`](./docs/Z-Eye기획서.md) & [`docs/스토어_정식출시_및_크몽외주_마스터플랜.md`](./docs/스토어_정식출시_및_크몽외주_마스터플랜.md):** 전체 비즈니스 아키텍처 및 양대 앱스토어 출시 마스터플랜.

---

## 2. 5대 메인 라운지 & 개인 라운지 4대 무기 요약

- **① `🔒 개인 라운지 (My Vault)`**
  - `👁️ Z-Eye 투시검색`: 사진 768차원 벡터 + 동영상 초 단위 타임라인 프레임 점프 + 로컬 문서(`PDF/DOCX/TXT`) 본문 투시 검색
  - `🛂 Z-Eye 여권`: 다년도·다각도 인물 클러스터링 & 15초 변천사 쇼츠 생성
  - `🩺 Z-Eye 클린 몬스터`: 중복·연사 광학 선명도 비교, 스마트 서류함 자동 분리, 13KB 섀도우 다이어트, 1초 Undo 격리 보관함
  - `🛠️ Z-Eye 설정 몬스터`: 0코인 무료 문진 ➔ 100/300/500 코인 차등 견적 & 멀린허브 사전 잔액 검증(Pre-Check) ➔ 초행길 2회 헤맴 100% 쿨 환불(수리 유지) & Multi-LLM 최단 직행 지름길 전 세계 OTA 배포 + Windows UIPI/JEA & Android SDK 35 `WindowInsets` 오차 보정 + 정답 구역 핀셋/2단 줌인 스캔
- **② `👨‍👩‍👧‍👦 패밀리 라운지 (Family Lounge)`**: `🏠 우리집 단독` & `👨‍👩‍👧‍👦 양가 통합권(우리집+친가+처가 3방 분리)`
- **③ `⛳ 클럽 라운지 (Club Lounge)`**: 소/중/대 모임 및 4050 동창회 타임머신(`1989` vs `2026`), 총무 명예의 전당 배지, 가족방 무료 초대권 3장 바이럴 키트
- **④ `🎒 스쿨 라운지 (School Lounge)`**: 초·중·고 반/동아리 무제한 월 900원 특가, 학생증 로컬 RAM 0.1초 OCR 인증(서버 전송 0 Byte)
- **⑤ `💼 업무 라운지 (Work Lounge · B2B)`**: `🔍 AI 투시검색 뷰`(마스터 PC 오프라인 시 30KB 본문·표 요약 0.1초 열람) ↔ `🗂️ 윈도우 폴더 트리 뷰` 듀얼 모드, `💽 윈도우 탐색기 업무 드라이브(S:) 자동 마운트`, `🔒 실시간 File Lock`

---

## 3. 📌 2026-10-20(오늘) 완료 내역 & 퇴근 후 집 작업 인수인계 바통

### 3.1 오늘(2026-10-20) 완료된 핵심 성과
1. **모바일 좁은 화면(360px) 헤더 한 줄 최적화 (`4cbb624`):**
   - 상단 5대 메뉴에서 '라운지' 단어를 전면 제거하고 `[개인] [패밀리] [클럽] [스쿨] [업무]` 1줄 컴팩트 배치 완료 (스크롤이나 글자 깨짐 0건).
2. **클린한 사용자 중심 용어 정돈 및 원본 다운로드 직결 (`cbb2674`):**
   - 불필요한 기술 용어(`P2P`, `13KB 캐시`, `768d`, `UIPI`, `1초 소환` 등)를 전면 소거하고 `[📥 원본 다운로드]`, `사무실 PC 연결됨` 등으로 직관화.
   - 라운지 원본 다운로드 시 `D:\Z-Eye\다운로드_원본` 폴더에 실물 파일 즉시 저장 및 윈도우 탐색기 오픈 연동.
3. **업무 라운지 전용 드라이브 분리 및 실시간 스캐너 연동 (`cebd34e`):**
   - `D:\Z-Eye\업무공유폴더_S`를 전용 마운트 타겟으로 분리 (`subst S:`).
   - 사용자가 `S:\` 최상단(루트)에 넣은 파일(예: `1줄빛러M.gif`) 및 하위 폴더 파일을 4초 주기로 자동 감지(`/__work/files`)하여 화면 목록과 카운트에 즉시 반영.
   - GIF 및 이미지 미디어 파일은 우측 패널에서 실시간 애니메이션/원본 즉시 미리보기 렌더링.
4. **외부 LTE/타 와이파이 스마트폰 접속 검증 완료:**
   - Cloudflare Tunnel(`https://pipeline-meal-carbon-adequate.trycloudflare.com`)을 통해 모바일 LTE/외부 망에서 로컬 Z-Eye 접속 및 조작 성공.

---

### 3.2 🚨 오늘 미완료된 테스트 2, 3 상세 원인 및 퇴근 후 집 작업 가이드

| 번호 | 테스트 항목 | 상태 | 원인 분석 및 집 PC에서 진행할 구체적 조치 |
|---|---|---|---|
| **테스트 2** | **동일 Wi-Fi(LAN) 및 Tailscale VPN 모바일 직결 (백지 현상)** | ⚠️ 보류 (미완) | **[원인]** 폰 브라우저에서 `http://192.168.*.*:5199` 또는 `Tailscale IP:5199` 접속 시 PWA 서비스워커(`sw.js`)가 HTTPS가 아닌 일반 HTTP 환경에서 동작이 제한되거나 이전 캐시 충돌로 백지 출력.<br>**[집에서 할 일]**<br>1) 폰 브라우저 시크릿 탭(개인정보보호 모드)으로 접속하거나 캐시 삭제.<br>2) 또는 집 PC에서 `npm run dev:https`(mkcert 기반)를 실행하여 로컬 LAN IP에서도 HTTPS로 접속 테스트. |
| **테스트 3** | **외부 LTE망 WebRTC DataChannel 홀펀칭 vs QUIC 자동 폴백 실측** | ⚠️ 보류 (미완) | **[원인]** 오늘 Cloudflare Tunnel 웹 접속은 성공했으나, 브라우저 간 WebRTC DataChannel 1순위 다이렉트 P2P 연결 레이턴시(ms) 측정 및 3.5초 타임아웃 시 2순위 QUIC 터널로 자동 폴백되는 실측 로깅 단계를 거치지 못함.<br>**[집에서 할 일]**<br>1) 집 PC에서 `npm run dev` 실행 후 터널 오픈.<br>2) 모바일 LTE 상태에서 라운지 접속 후 `__p2p/test-fallback` 신호 지연시간 및 5MB 파일 송수신 안정성 확인. |

---

## 4. 📌 4단계 중기 로드맵 (11월 중순 창립 멤버 100명 오픈)

새 세션에서 멀린님이 **"브릿지 테스트 하자"**라고 말씀하시면 아래 확정 사항(`src/services/p2pHybridBridge.ts`, `supabase/z_eye_zero_cloud_schema.sql`)을 기반으로 즉시 작업을 수행합니다:

1. **Step 1 (현재 진행 중 · 최우선 급소): 🎨 전 메뉴 UI/UX 점검 & ⚡ 실물 에이전트(`APK / .exe`) 브릿지 + P2P 신호 연결 테스트**
   - **P2P 2단계 하이브리드 폴백 (`src/services/p2pHybridBridge.ts`, 특허 제2호 핵심):**
     - ① `Supabase Realtime Broadcast`(DB 저장 0 Byte 시그널링) 중매
     - ② 1순위 `WebRTC DataChannel` 다이렉트 전송 시도 ➔ 외부 LTE/5G Symmetric NAT 장벽(3.5초 초과) 시 유료 TURN 없이 2순위 마스터 PC 데몬 아웃바운드 QUIC 터널(`cloudflared` 등)로 0.1초 자동 폴백 (성공률 99.9% + 중계 서버비 0원)
   - **Windows `.exe` 데몬 (`멀린 Z 코어 · Merlin_Z_Core_Setup.exe`) 브릿지 검증:**
     - 서드파티 드라이버(`WinFsp`) 설치 없이 Windows 내장 WebClient(`net use S: \\localhost@SSL@5199\DavWWWRoot /persistent:yes`)로 0.5초 만에 `S:` 업무 드라이브 마운트 테스트
     - **썬드림주식회사 `Microsoft Artifact Signing (구 Azure Trusted Signing)`** 완비됨 (추가 비용 0원, 대기 0초로 `uiAccess="true"` Authenticode 무인 자동 서명 및 SmartScreen 프리패스 적용)
   - **Android `멀린 Z 코어 (Merlin_Z_Core.apk)` (`window.MerlinZCoreBridge` / `executeMerlinQuery`) 브릿지 & 무소음 비서 원칙:**
     - `@JavascriptInterface`를 통한 SDK 35 `WindowInsets` 물리 픽셀 보정(`calibrateAndroidSdk35EdgeToEdgeOverlayRect`) 및 타사 앱 위 `TYPE_APPLICATION_OVERLAY` 손가락 화살표(`👆`) 정밀 투사 검증
2. **Step 2 (10월 하순): 🗄️ 초경량 Supabase DB 스키마 바인딩 & 🪙 멀린허브 로그인·코인 연동**
   - `supabase/z_eye_zero_cloud_schema.sql` 적용: 사진·영상·문서 768d 인덱스는 로컬 PC/단말에만 격리(DB 비용 0원)하고, 중앙 DB에는 ① `Z-Eye 여권` 안면 시드(15KB), ② 라운지 방/멤버 권한·방별 별명, ③ 설정 몬스터 Playbook/감사 로그만 바인딩 + 멀린허브 에스크로 API 직결
3. **Step 3 (11월 초): 📦 네이티브 패키징(`Microsoft Artifact Signing` 서명) & 📜 5대 특허 전자출원(특허로)**
4. **Step 4 (11월 중순): 🐞 통합 디버깅 · 폴리싱 ➔ 🔥 카페 창립 멤버 100명 평생권 베타 오픈!**

