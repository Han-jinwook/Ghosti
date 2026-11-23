# 🔑 『귀신Key (GhostKey)』 전용 워크스페이스 지침 (`D:\Ghosti\ghostkey\`)

> **상위 본진 헌법**: 본 폴더는 **`D:\Ghosti` 단일 Git 레포(`Han-jinwook/Ghosti`)의 Door 2 하위폴더**입니다.
> 체크인 시 상위 [`../AGENTS.md`](../AGENTS.md)의 전사 공통 강령 및 `5번 창: 🔑 [귀신Key]` 규격을 함께 적용합니다.

---

## 1. 핵심 운영 원칙 (2026-11-24 멀린님 확정)
1. **🌱 뿌리 주권 절대 원칙**:
   - 뿌리가 `귀신Key` 기능(한영 오타 교정 · 연속복사 · `1→2→3` 순차 붙여넣기 · 7일 클립보드 · `F1~F6` 개인 상용구 · `F7~F12` 팀 공유 상용구)이면 **무조건 여기 `귀신Key`가 원소스·기획 주인**으로서 직접 담당합니다.
   - `내 기기 통합(3귀신)`·`업무 공유(4귀신)`는 그 기능이 확장되는 환경(페어링·팀방 연결·권한·환경설정)으로 협업합니다.
2. **📂 직접 수정 가능한 소유권 파일 (상위 `D:\Ghosti` 본진 내부 포함 — 월권 아님!)**:
   - `D:\Ghosti\ghostkey\**` (웹 UI · 온보딩 · **`docs/` 전용 문서 별도 보관**)
   - `D:\Ghosti\universal_z_core\seq_paste_daemon.py` (PC 귀신Key 코어 데몬)
   - `D:\Ghosti\android\app\src\main\java\app\sundreamer\ghosti\GhostiClipboardImeService.java`, `GhostiSharedClipboardStore.java`, `GhostiQuickClipActivity.java`
   - `D:\Ghosti\ios\App\GhostKeyKeyboardExtension\**`, `D:\Ghosti\ios\App\GhostKeyShareExtension\**`
   - *(주의: 커밋 전 `git status`로 타 귀신(`1~4귀신`) 수정 파일을 섞지 않도록 본인 수정 파일만 핀셋 `git add`)*
3. **🚪 원엔진·투도어 단일 앱 & 문서 별도 보관**:
   - 모바일 앱은 별도 앱이 아니라 `귀신같이(Door 1)`와 `귀신Key(Door 2)`가 문만 2개일 뿐 똑같은 하나의 앱(`app.sundreamer.ghosti`)으로 들어오는 구조입니다.
   - 귀신Key 소속 오리지널 문서는 본체 `D:\Ghosti\docs\`와 합치지 않고 **`D:\Ghosti\ghostkey\docs\`에만 별도 보관**합니다.
4. **🍏 아이폰(iOS) OS 제한 확정 기준**:
   - PC·갤럭시·아이폰 모두 7일 치 클립보드 꺼내쓰기 및 1건 복사 전송을 지원합니다.
   - 단, **아이폰(iOS)은 OS 보안 한계로 연속 복사는 미지원(포기)**하며 온보딩·QA 카드에 명확히 고지합니다.
5. **🫡 체크인 & 감시병 (`"체크인"` / `"귀신키"` / `"귀신Key"`)**:
   - `git pull --rebase origin main`
   - [`docs/SESSION_HANDOVER.md`](./docs/SESSION_HANDOVER.md) 및 `D:\Secretary\post_office\` 확인
   - `run_command(CommandLine="python z_core_watcher.py --watch", IsDaemon=true, WaitMsBeforeAsync=500)` 단 1개 기동
   - 빌드 검증: `D:\Ghosti\ghostkey`에서 `npm run build` (`tsc --noEmit && vite build`)
