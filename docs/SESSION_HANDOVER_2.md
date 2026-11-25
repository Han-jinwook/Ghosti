# 🔵 `[2귀신]` 세션 인계장 (`SESSION_HANDOVER_2.md` — 귀신검색 · 귀신창 · OCR · 라벨러)

- **최종 갱신 일시**: 2026-11-25 16:32 (KST)
- **담당 역할**: `[2귀신]` (귀신검색 · `Ctrl+0` 귀신창 · 사진/표 OCR · 귀신라벨링 · 동영상 재생)
- **공정 달성률**: 코드 완성도 **`94%`** (`Z-Core v2.9.9` / 커밋 `8486b00`) · 테스팅 완성도 **`45%`** (완료 5건 / 테스트 중 1건 / 재테스트 대기 3건 / 테스트 미션 9건 / 미결 버그 0건)
- **세션 창 제목**: `2귀신 Z코어v2.9.9·문서최신화`

## 완료 내역
1. **귀신검색창(`51988`) 5대 먹통·부팅 공백 근본 처치 & 전 클러스터 배포 (`Z-Core v2.8.61 ~ v2.9.9`, `d463420` · `ff11622` · `9ab4b47` · `ab35d0f`)**
   - PyInstaller `--onefile` ➔ **`--onedir`** 전환(`Merlin_Z_Core_Setup.exe` + `_internal/`)으로 123초 `_MEI` 2차 압축해제/Defender 지연을 제거하고 부팅을 `1~2초`로 단축.
   - `seq_paste_daemon.py` 기동 순서 역전(`0.1초` `RegisterHotKey(Ctrl+0)`·`WH_MOUSE_LL`·`PeekMessageW` 최우선 바인딩, 무거운 `Tkinter/PIL/OCR` 에셋 예열은 `root.mainloop()` 진입 후 `root.after(80)` 및 백그라운드 스레드로 지연).
   - 초기 부팅 중 워치독 오판 자살(`ui_stage=init` 19.7초 킬) 원천 차단(초기 워밍업 스테이지 45초 부팅 유예 + `plugin_ghosti_superpowers.py` `--onedir` 재스폰 유예 `45초 ➔ 12초` 단축).
   - Win32 Named Mutex(`Local\MerlinGhostiSeqPasteDaemon_v1`) 원자적 핸드오프(`_release_single_instance_mutex` 선반납 + `WaitForSingleObject(2.5s)`), 28개 전 구역 동기 `SendMessageW` `0건` 전수 박멸(`_send_msg_timeout_val`), `WH_MOUSE_LL` 90초 주기 무중단 `Hook-Swap`(`WM_APP_REHOOK`), 롤링 블랙박스 진단 로그(`%LOCALAPPDATA%\Ghosti\data\seq_paste_diag.log`, 512KB), `WM_RBUTTONUP` 중복 발화 억제 적용.
   - 1~6호기 전 클러스터 `Z-Core v2.9.9` 무중단 배포 및 `zcore_board.py` 공용 엔진 작업 문패 반납 완료.
2. **2계층 전 드라이브 공정 라운드-로빈 BFS 스캔 & `바다`/`캠핑`/`우루과이` 누락 근본 해결 (`2046ef8` · `811050c`, `v2.8.64 ~ v2.8.91`)**
   - `ghosti_setup_parity.py`: 드라이브 간(`C:`·`D:`·`E:`) 1:1 교차 + 드라이브 내 주요 폴더(`Desktop`/`Downloads`/`Documents`/`Pictures`/`Videos`/`카카오톡 받은 파일`) 1:1 교차 스캔으로 특정 대용량 폴더의 1,200폴더 상한 독점 원천 차단.
   - `C:\` 직하 개발 레포(`.git`/`package.json` 등) 및 보안 폴더(`xecuressl`/`wizvera` 등) 자동 배제, `C:\MerlinTools\Ghosti_Test_Corpus` 자동 포함, 드라이브별 공정 쿼터(`_select_fair_by_drive`, 최대 14,000건) 적용 (4호기 실측: `C:` 스캔 폴더 `1,212 ➔ 84개`, `바다` `1 ➔ 47건`, `캠핑` `2 ➔ 54건`, `우루과이` `0 ➔ 3건`).
3. **한글 IME 실시간 미확정 음절(`ImmGetCompositionStringW`) · 활성 창 한/영 상태 자동 계승 · `UI2` `0.72ms` 스템 캐시 · `[원본 열기]` 3중 폴백 (`fd174a0` · `66e2420`, `v2.8.79 ~ v2.8.94`)**
   - `ghost_search_window_ui2.py` · `seq_paste_daemon.py`: 스페이스바/엔터 확정 전 조합 중인 마지막 한글 음절(`'바'` + `'다'` ➔ `'바다'`) 실시간 결합 검색 + 소환 직전 활성 창의 한/영 상태(`ImmGetConversionStatus` & `WM_IME_CONTROL`, 바탕화면 경유 시 직전 0.45초 사용자 창 상태 유지) 자동 동기화.
   - `UI2` 14,000건 사전 토크나이즈 스템 캐시(`_s_title`/`_s_sub`/`_s_tags`)로 타이핑 1글자당 필터링 `94.2ms ➔ 0.72ms`(130배 단축), `[원본 열기]` STA COM `CoInitializeEx` + `os.startfile` + `ShellExecuteW("open")` 3중 폴백 및 `selected_fp_lock` 적용.
4. **상단 타이틀바·필터바 자유 드래그 이동 (`4c55e23`, `v2.8.93` — 해나라님 테스트 통과 `완료`!) & `[조용한 정리 | 빠른 정리]` 토글 안내 일원화 (`f7ea54d`)**
   - 다중 모니터 클램핑, 드래그 중 외부 클릭 오닫힘 방어(`ui_dragging`), 드래그 후 `small ➔ medium` 확장 시 이동 위치 유지 및 닫은 뒤 재소환 시 마우스 커서 위치 초기화.
   - `SilentIndexingStatusBar.tsx` 토글 명칭 통일 및 인라인 한 줄/툴팁 차이점 설명 추가.
5. **문서 3종 In-Place 최신화 (`8486b00`)**
   - `docs/기능명세.md`, `docs/멀린_Z_코어_통합_아키텍처_명세서.md`, `docs/README.md`에 `Z-Core v2.9.9` 아키텍처 및 `[2귀신]` 5대 핵심 변경사항 100% 반영 완료.

## 다음 체크인 Todo
- [ ] `python d:\Ghosti\z_core_watcher.py --watch --role 2` 기동 후 해나라님 `테스트 중`(1건: `C드라이브만 검색`), `재테스트 대기`(3건: `귀신검색창 실행 안됨 재발생` · `검색창 언어 문제` · `작은 귀신검색창 무관 파일 노출`), `테스트 미션`(9건) 피드백/버그 즉시 대응 (테스팅 `45% ➔ 100%` 완주).
