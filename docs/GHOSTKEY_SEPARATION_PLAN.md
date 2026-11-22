# 🔑 『귀신키 (GhostKey)』 프로젝트 분리 및 『원엔진 · 투도어 (귀신같이 × 귀신키)』 확정 마스터 플랜

> **최종 확정일**: 2026-11-23 (`Z-Core v2.7.9` 보안 하드닝 · 노션 스타일 미니멀 UI 정화 반영)  
> **목적**: 하나의 통합 로컬 엔진(`Merlin Z-Core`, `127.0.0.1:5199`)과 하나의 공유 인프라(`MerlinHub SSO` + `Ghosti Supabase` + `공통 결제 브릿지`) 위에서 진입 대문(제품 역할)만 명쾌하게 투도어로 분리합니다.
> - **Door 1 — `귀신같이 (Ghosti)` (`ghosti.sundreamer.app`, `12/17` 본체 선출시)**: 일반 국민 · 사무직 · 대학생 · 연구직 · 사장님 모두를 주 대상으로 하는 **1초 AI 내용검색(`귀신검색`) · PC/폰 통합 케어(`귀신비서`) · 무제한 사진 공유 · 내 기기 통합 Pro(`월 3,900원`) · 업무 공유(`S: 드라이브 · 월 9,900원~`)** 본체 서비스. 본체 화면·설명란에서 `귀신창 / 귀신키` 메뉴·문구는 100% 분리 제거하며(정식 교차 출시 후 연동), `Ctrl + 0` 기본 동작은 어느 화면에서든 **`👻 귀신검색창(UI ②)`** 소환으로 통일합니다.
> - **Door 2 — `귀신키 (GhostKey)` (`ghostkey.sundreamer.app`, `+3~4주` 후 별도 출격)**: 타이핑·복붙·상용구 자동화 입력기 유틸리티(`단독 월 1,900원 / 연 19,000원`, 본체 `Pro 월 3,900원` 구독자는 무료 자동 포함).

---

## 1. 새 프로젝트 생성 및 원엔진 단일화 철칙
1. **로컬 폴더 분리**: `D:\Ghosti`(본체 및 원엔진 정본)와 `D:\GhostKey`(독립 프론트엔드 웹앱, 별도 Git 저장소)로 물리 분리하며, 각 전담 에이전트는 타 프로젝트 폴더를 직접 수정하지 않고 우체국(`D:\Secretary\post_office\`) 명세로만 소통합니다.
2. **원엔진(`Merlin Z-Core v2.7.9+`) 무결성 및 동의 기반 활성화**:
   - `D:\GhostKey`는 자체 `universal_z_core/` 사본을 빌드하지 않으며, 오직 `D:\Ghosti\universal_z_core\` 단일 엔진(`127.0.0.1:5199`) 및 `https://ghosti.sundreamer.app/Merlin_Z_Core.zip`만 공유합니다.
   - Z-Core 통합 엔진 자체에는 어떠한 구조적 충돌도 없으며, 사용자 동의 기반 모듈 활성화 및 `12/17` 본체 QA 집중을 위해 기본 설정값만 `ghostkey_enabled = false`로 시작합니다 (`GhostKey` 정식 출시 후 권한 보유 유저가 `ghostkey_enabled = true`를 켰을 때만 `입력창 = 귀신키(UI ①)` / `바탕화면 = 귀신검색창(UI ②)` 문맥 분기가 작동하고, 그 외 모든 사용자의 `Ctrl + 0` / `Ctrl + 우클릭`은 언제 어디서나 **`👻 귀신검색창(UI ②)`**을 즉시 소환합니다 — 탐색기 `.zip/.7z` 선택 시 `UI ④` 압축 프리뷰는 그대로 유지).

---

## 2. 인프라 · 공유 DB 정식 분리 · 과금 사다리 확정표 (제18조 준수)
| 항목 | 처리 방식 | 세부 확정 규격 |
| :--- | :--- | :--- |
| **GitHub / Netlify** | 별도 사이트 | `GhostKey` 전용 리포지토리 + 신규 Netlify 사이트(`ghostkey.sundreamer.app`), `VITE_MERLIN_HUB_URL` · `VITE_SUPABASE_URL` · `VITE_SUPABASE_ANON_KEY` 동일 사용 (`hub-supabase-bridge` 호출 시 `appId: 'ghostkey'` 전달) |
| **DB 테이블·컬럼 정식 분리** | **공유 DB 내 명확 분리** | 임시 JSON 기생 없이 정식 SQL로 분리 (`supabase/ghosti_zero_cloud_schema.sql`):<br>① `public.users`: `first_signup_app` (`'ghosti'` \| `'ghostkey'`, 최초 가입 출처 영구 보존), `ghosti_last_login_at`, `ghostkey_last_login_at`, `ghostkey_notify_opt_in` 분리 기록<br>② `public.ghosti_product_subscriptions`: `PRIMARY KEY (email, product_code)` (`product_code IN ('ghosti_pro', 'ghosti_work', 'ghostkey')`) 정식 구독 원장 테이블 격리 |
| **공통 결제 브릿지 & 본체 비노출** | **백엔드 개방 / 본체 UI 은닉** | `workAndDeviceBridgeOps.mjs` 서버 브릿지에 `ghostkey_trial_opt_in_30d`(30일 무료체험), `ghostkey_sub_1900`(1,900C / 30일), `ghostkey_year_19000`(19,000C / 365일) 및 `MerlinHub` 지갑 `app_id: 'GhostKey'` 정식 개통 완료. **단, 본체(`D:\Ghosti`)의 구독창·가격표 UI에는 `ghostkey` 구독코드와 문구를 일절 노출하지 않음** |
| **Pro 전용 OCR · 라벨러 양방향 동인** | **`Pro (월 3,900원)` 단독 고정** | **`📝 사진·표 OCR 창🔒`** 및 **`🏷️ 귀신 라벨러🔒`**는 단독 `귀신키(월 1,900원)`에 포함하지 않고 **오직 `본체 Pro (내 기기 통합 · 월 3,900원 / 연 39,000원)`에만 귀속** (`ocrAndLabelerUnlocked = proUnlocked`). 이를 통해 `귀신같이` 무료 유저와 `귀신키(1,900원)` 구독자 양쪽 모두가 `Pro(3,900원)`로 올라올 명확한 업그레이드 동인을 가짐 (`귀신키` 구독자도 본체의 무료 `귀신비서·귀신검색·사진공유`는 언제나 0원 사용 가능) |
| **Z-Core 로컬 엔진** | **단일 공유 (`v2.7.9+`)** | `_ALLOWED_NETLIFY_SITES`에 `ghostkey`, `ghostkey-app` 정식 등록, `GET/POST /api/superpower/*` 및 `/__merlin/open-ghost-search`에 `_reject_untrusted()` 선검증 강제, `_verify_hub_entitlements()`에서 `proPaid`(`isSubscribed`)와 `ghostkeyUnlocked`(`isGhostkeyUnlocked`)를 엄격히 분리 검증 |

---

## 3. `D:\Ghosti` vs `D:\GhostKey` 역할 경계
- **`D:\Ghosti` (본체 — `ghosti.sundreamer.app`)**:
  - 좌측 5단 메뉴: `1. 👻 귀신비서` · `2. 👻 귀신검색` · `3. 📸 사진 공유` · `4. 📱 내 기기 통합 Pro (월 3,900원)` · `5. 💼 업무 공유 (공용 폴더 S: · 월 9,900원~)`.
  - 사이드바·온보딩 쇼룸·가이드 모달·요금제 모달·비서 대본집에서 `귀신창 / 귀신키 / 상용구` UI 및 설명 문구 100% 분리 제거 완료 (`GhostPhotoOcrTeleportModal` 독립 OCR 모달만 `2. 귀신검색`의 `📝 사진·표 OCR 창🔒` 용도로 유지).
- **`D:\GhostKey` (자매 입력기 — `ghostkey.sundreamer.app`)**:
  - `MerlinHub SDK` SSO + `appId: 'ghostkey'` 브릿지 연동 + `ghostkey_sub_1900` / `ghostkey_year_19000` / `personal_sub_3900(Pro 통합 업그레이드)` 결제창 + `zCoreBridge.ts`(`5199` 연결 및 `POST /api/superpower/settings { "ghostkey_enabled": true }`) + 다국어(`ko`/`en`/`ja`) 입력기 온보딩 및 `F1~F6` 상용구 설정 전담.

---

## 4. 필독 참조 문서
1. `D:\Ghosti\docs\GHOSTKEY_SEPARATION_PLAN.md` (본 확정 마스터 플랜)
2. `D:\Ghosti\supabase\ghosti_zero_cloud_schema.sql` (공유 DB 정식 분리 SQL 스키마)
3. `D:\Ghosti\AGENTS.md` (전사 코딩 강령 및 우체국 규칙)
4. `D:\Secretary\docs\ECOSYSTEM_APPS_SUMMARY.md` (전사 생태계 요약)
