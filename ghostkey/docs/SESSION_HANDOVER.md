# 📋 『귀신Key (GhostKey)』 세션 인계장 (SESSION_HANDOVER)

- **최종 체크아웃 일시**: `2026-11-24 00:25 (KST)`
- **세션 제목 (직전 세션 마지막 작업)**: `Ghosti하위폴더단일화`
- **현재 본진 / 브랜치 / 배포**: **`D:\Ghosti\ghostkey\`** (`Han-jinwook/Ghosti` `main` · 배포: `https://ghostkey.sundreamer.app` `Published` 확인 완료 · 구형 `D:\GhostKey` 로컬 폴더 삭제 완료)

---

## 1. 오늘 완료한 핵심 작업
1. **`D:\Ghosti\ghostkey\` 하위폴더 단일화 이관 완료 (`4ebb11b`, `19f7548`, `9424bb7`)**:
   - 중복 코드 전면 제거: 서버 브릿지(`netlify/functions/`), `merlin-hub-sdk/`, 공통 서비스 7종(`deviceIntegrationService`, `supabaseClient`, `merlinAuth`, `zCoreBridge`, `babyGhostSound`, `qrCodeSvg`, `saysee.ts`), 본체 `docs/` 복사본 22개 전량 제거.
   - `ghostkey/vite.config.ts` & `tsconfig.json`에서 `@shared/*` ➔ `../src/*` 직결, `ghostkey/netlify.toml`에서 `/api/*` ➔ `https://ghosti.sundreamer.app/.netlify/functions/:splat` 단일 브릿지 직결 (`src/services/supabaseClient.ts` `ghostkey.sundreamer.app` 호스트 대응 포함).
   - Netlify `ghostkey.sundreamer.app` 연결 레포를 `Han-jinwook/Ghosti` (`Base directory: ghostkey`)로 전환 및 **`Published` 정상 배포 확인 완료**.
2. **귀신Key 소속 문서 별도 보관 원칙 수립 (`D:\Ghosti\ghostkey\docs\`)**:
   - 본체 `D:\Ghosti\docs\`와 통합하지 않고, 순수 귀신Key 오리지널 문서 5종(`귀신Key_기능소속_최종확정안`, `글로벌현지화_기획안`, `GHOSTKEY_SEPARATION_PLAN`, `SESSION_HANDOVER`, 전용 `README`)만 단독 보관.
3. **온보딩·확장 UI 정비 (`GhostKeyOnboardingView.tsx`, `App.tsx`)**:
   - `내 기기 통합 (Pro 확장)` 영역에서 **`연속복사·7일 클립보드 폰↔PC 확장`**과 **`F1~F6 개인 상용구 내 모든 PC 동기화`**를 별개 항목으로 명확히 분리.
   - **아이폰(iOS) OS 제한으로 연속 복사 미지원(1건 복사 전송·7일 꺼내쓰기 지원)** 확정 기준 명시.
4. **뿌리 주권 & 원엔진·투도어 원칙 `D:\Ghosti\AGENTS.md` 박제 및 전사 우체국 공문 3통 발송 완료**:
   - `D:\Ghosti\AGENTS.md`에 `5번 창: 🔑 [귀신Key]` 소유권 파일(`ghostkey/**`, `seq_paste_daemon.py`, 모바일 `GhostiClipboardImeService`/`GhostKeyKeyboardExtension`/`ShareExtension`) 및 `3·4귀신` 협업 경계(환경설정·연결 협업) 공식 반영.
   - 전사 중앙 우체국(`D:\Secretary\post_office\`)으로 `Secretary`, `Ghosti(1·2·3·4귀신)`, `MerlinHub` 앞 핀셋 공문 3통 발송 완료.
5. **`3귀신` 모바일 클립보드 7일/500건 통일 & 안드로이드 IME/공유시트 정공법 UX 완료 회신 수신 (`v1.0.72`)**.

---

## 2. 다음 체크인 시 바로 이어할 사항 (`D:\Ghosti\ghostkey` 새 창에서 `"체크인"` 입력)
1. **미푸시 문서 2건 즉시 커밋·푸시**: `ghostkey/AGENTS.md` + `ghostkey/docs/SESSION_HANDOVER.md` (`git add ghostkey/AGENTS.md ghostkey/docs/SESSION_HANDOVER.md` ➔ `commit` ➔ `push`).
2. **감시병 기동**: `python z_core_watcher.py --watch` 기동 및 `귀신Key` UX 고도화·QA 대기 (`12/17` 본체 출시 집중기 동안 노션 `귀신키` 신규 카드 추가 보류, 기존 카드 현행 보존).
3. *(참고)* GitHub 구형 `Han-jinwook/GhostKey` 레포 Archive 처리 여부 확인, 향후 Apple Developer Portal 프로파일 등록 시 iOS Extension 타겟 연결.
