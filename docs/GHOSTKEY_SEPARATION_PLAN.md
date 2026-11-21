# 🔑 『귀신키 (GhostKey)』 프로젝트 분리 및 독립 실행 마스터 플랜

> **작성일**: 2026-11-21  
> **목적**: `Ghosti(귀신같이)`를 통째로 복제해 `D:\GhostKey` 프로젝트를 선제 분리하고, 불필요한 본체 UI(사진방·동창회·주치의·검색)를 걷어낸 뒤 **온보딩 + Z-Core 설치 + 구독 결제 + 귀신키 설정**만 남겨 100% 완성·대기(`+3~4주 후` 출격)시킵니다. 동시에 본체(`Ghosti`)에서는 귀신창 UI 흔적을 깔끔히 분리합니다.

---

## 1. 새 프로젝트 생성 방식 (복사 후 걷어내기)
1. **로컬 폴더 복제**: `D:\Ghosti` 전체를 `D:\GhostKey`로 복사 (`.git` 폴더는 삭제 후 새 Git 저장소로 초기화 권장).
2. **원엔진 단일화 철칙**: `D:\GhostKey\universal_z_core\`는 **직접 수정·빌드하지 않고 삭제(또는 참조 금지)**합니다. 모든 Z-Core 엔진 수정·빌드는 오직 `D:\Ghosti\universal_z_core\` 한 곳에서만 수행하며, `GhostKey` 웹은 `127.0.0.1:5199` 통신과 `https://ghosti.sundreamer.app/Merlin_Z_Core.zip` 다운로드만 공유합니다.

---

## 2. 인프라 분리 & 재사용 체크리스트
| 항목 | 처리 방식 | 세부 내용 |
| :--- | :--- | :--- |
| **GitHub** | 신규 생성 | `GhostKey` 새 리포지토리 생성 후 `D:\GhostKey` 푸시 |
| **Netlify** | 신규 생성 | `GhostKey` 리포지토리 연결 (`npm run build` / `dist`), `Ghosti`와 동일한 환경변수(`VITE_MERLIN_HUB_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) 재사용 |
| **DB / 인증 / 결제** | **기존 공유** | 새 DB 생성 없음. 기존 `MerlinHub` + `Ghosti` Supabase 공유. 상품 코드 `ghostkey_sub_1900`(월 1,900원), `ghostkey_year_19000`(연 19,000원) 추가 및 `Pro(3,900원)` 유저 자동 활성화 연결 |
| **도메인** | DNS 추가 | `sundreamer.app` DNS에 `ghostkey.sundreamer.app` (CNAME) 추가 ➔ 신규 Netlify 연결 |
| **Z-Core** | 단일 공유 | `https://ghosti.sundreamer.app/Merlin_Z_Core.zip` 공통 다운로드 + `127.0.0.1:5199` 연결 |

---

## 3. `D:\GhostKey` 코드 정리 범위 (남길 것 vs 걷어낼 것)
- **반드시 남길 것 (인프라·핵심)**:
  - `MerlinHub SDK` 로그인(SSO), `GhostiSubscriptionCheckoutModal`(결제창), `PricingModal`(귀신키 요금표 반영)
  - `zCoreBridge.ts` (5199 연결·설치 안내·버전 체크)
  - 귀신키 전용 온보딩 랜딩(`ko`/`en`/`ja` 다국어 스위치 포함) + 귀신키 단축키(`Ctrl+0`/`Ctrl+우클릭`) 켜기/끄기·상용구 설정 UI
- **걷어낼 것 (본체 전용)**:
  - 사진방/동창회(`FreePhotoShareLounge` 등), PC/모바일 주치의, 온디바이스 AI 검색 모델/페이지(`GhostSearchPane`, `Stage1MinimalPreview`, `aiPhotoFaceEngine`, `aiVideoEngine` 등), `universal_z_core/` 로컬 빌드물

---

## 4. 새 에이전트 필독 문서 목록
1. `D:\Secretary\docs\프로젝트별_문서\Ghosti_귀신같이\원엔진_투도어_귀신같이x귀신키_마스터기획안.md` (최종 확정 마스터 기획서)
2. `D:\Ghosti\docs\GHOSTKEY_SEPARATION_PLAN.md` (본 분리 플랜)
3. `D:\Ghosti\AGENTS.md` (전사 코딩 강령 및 우체국 규칙)
4. `D:\Secretary\docs\ECOSYSTEM_APPS_SUMMARY.md` (전사 생태계 요약)
