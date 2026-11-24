# 🔵 `[2귀신]` 세션 인계장 (`SESSION_HANDOVER_2.md` — 귀신검색 · 귀신창 · OCR · 라벨러)

- **최종 갱신 일시**: 2026-11-25 01:46 (KST)
- **담당 역할**: `[2귀신]` (귀신검색 · `Ctrl+0` 귀신창 · 사진/표 OCR · 귀신라벨링 · 동영상 재생)
- **공정 달성률**: 코드 완성도 **`100%`** (`Z-Core v2.7.72` / 커밋 `10eb694`) · 테스팅 완성도 **`76%`** (완료 17건 / 재테스트 대기 2건 / 미결 버그 0건 / 신규 미션 8건)
- **세션 창 제목**: `2귀신 코드100%·미션8건출제`

## 완료 내역
1. **안드로이드 네이티브 뒤로가기 앱 종료 방지 & 연사 묶음 전역 Union-Find 병합 (`52b06be`, 모바일 `v1.0.77`)**
   - `@capacitor/app` 미설치로 무동작하던 뒤로가기를 `MainActivity.java` `OnBackPressedCallback` ➔ `App.tsx` `window.__ghostiHandleNativeBack()` 직결로 해결.
   - `aiPhotoFaceEngine.ts` `groupBurstSearchResults`를 전역 Union-Find 병합(동일 `duplicateGroupId`·동일/근접 `dHash`·동일 파일명/용량·확장 멤버 교차 병합)으로 전면 교체해 배지 없는 중복 카드 분리 노출 제거.
2. **동영상 상세보기 자동 재생 복원 & 무복사 즉시 HTTP 206 스트리밍 (`d9c440c`, 모바일 `v1.0.78`)**
   - `MainActivity.java` `setMediaPlaybackRequiresUserGesture(false)` 해제 + 1ms 후미 `FileChannel` 프로브 무복사 HTTP 206 스트리밍(`180MB` 이하 강제 전체 복사 제거), `ghostiMobileCareBridge.ts` 12MB 초과 영상 통째 Blob 다운로드 제거, `VideoScenePreviewModal.tsx` 일반 재생(`0초`) 자동 재생 분리 및 웹 정책 차단 시 음소거 즉시 재생(`소리 켜기` 버튼) 적용.
3. **귀신라벨링 원본 EXIF 촬영일 우선 · 0.5초 초고속화 & 클립보드 경합 원천 차단 (`93a211a`, `236a5c6`, `167792a`)**
   - `aiSharedRuntime.ts`: 원본 JPEG 64KB 헤더 초고속 EXIF `DateTimeOriginal`/`DateTimeDigitized`(`0x9003`/`0x9004`, IFD0 수정일 `0x0132` 제외) 1순위 ➔ 파일명 촬영 타임스탬프 2순위 ➔ `dateStr` ➔ `mtimeMs` 최후 폴백으로 교정.
   - `proFeatureGate.ts` · `aiPhotoFaceEngine.ts` · `GhostLabelerActionButton.tsx`: 활성 Pro/체험 `0ms` 통과, OCR+캐시벡터 병렬 실행(중복 이미지 fetch 제거), 결과 메모이제이션, 연속 클릭 시 이전 요청 `AbortController` 즉시 중단(`0.95초` 상한), 브라우저 Clipboard `1ms` 우선 + 단조 `seq`/Z-코어 `Abort` 경합 차단.
4. **귀신검색 체험판 2단계 도장 오표시 제거 · 최소화 귀신검색창 복원 & 구버전 Z-코어 무한 열림 차단 (`a3dd0bb`, `4182b27`, `5a78972`, `1dacdb1`)**
   - `[귀신검색창 열기]` 단순 호출 시 `'작게 모드'` 도장이 오표시되던 로직을 제거하고 명시 전환 시에만 `markGhostDojoStep` SSOT 기록.
   - `DesktopDashboard.tsx`의 `open_search_window` 2.5초 하트비트 호출을 제거해 구버전 Z-코어(`<v2.7.53`) 무한 창 열림을 원천 차단하고, OS 창 타이틀 호환(`👻 귀신검색창`/`귀신검색창`)으로 최소화 창 즉시 전면 복원 보장.
5. **윈도우 10/11 공통 `Ctrl+0`/`Ctrl+우클릭` 선택 파일(`.jfif`·사진앱 포함) `[1]`번 고정 · `WH_MOUSE_LL` 0.01ms 무지연 훅 · 내장 하드 순차 렌더링 & USB/외장 볼륨 생애 1회 질문 · 사진 촬영일 최신순 정렬 (`cf5eace` ~ `48e34e9`)**
   - `seq_paste_daemon.py` · `ghost_search_window_ui2.py` · `plugin_ghosti_os.py`: 탐색기·바탕화면·사진앱 선택 파일 `[1]`번+우측 큰 미리보기 고정, `Ctrl+0` 키업 축소 차단, `Shell.Application` COM `0.45초` 워커 격리, 타이핑 중 요요 제거, 3단계 드라이브 정책(C: 즉시 ➔ 내장 D:~Z: 유휴 ➔ USB 생애 1회 질문·Read-Only 0바이트·로컬 `%LOCALAPPDATA%\Merlin\external_cache\<VOL_ID>` 격리·분리 시 즉시 숨김) 완결.
   - `aiPhotoFaceEngine.ts`: 귀신검색 전체 보기 사진 목록을 파일 복사일이 아닌 실제 촬영일(`canonicalDate`·`canonicalMtimeMs`, 13자리 Unix epoch ms 포함) 최신순 내림차순으로 일관 정렬 교정.
6. **웹 `2. 귀신검색` 외장 드라이브 배너 연동 · 30일 외장 캐시 GC (`10eb694`, 코드 100%) & 노션 100% 완주 미션 8건 출제**
   - `ExternalDrivePromptBanner.tsx` · `Stage1MinimalSearchPreview.tsx` · `merlin_z_core_daemon.py` (`GET /__zcore/external-drives`, `POST /__zcore/external-drives/decide`): 네이티브 UI2 배너와 1:1 동등 UX(유휴 0px·hidden 0폴링) + `_trigger_monthly_orphan_cache_gc_once()` 내 30일 미접속 외장 캐시 자동 정리 완결.
   - 노션 `[테스트 미션]` 신규 8건 출제 (USB 1/2·2/2, 윈도우10 실전, 모바일 `v1.0.78`, 100% 완주 1/4~4/4).

## 다음 체크인 Todo
- [ ] `python d:\Ghosti\z_core_watcher.py --watch --role 2` 기동 후 해나라님 재테스트 대기 2건(`귀신창 크기 요요` · `C드라이브 외 검색`) 및 신규 미션 8건 피드백/버그 즉시 대응 (테스팅 `76% ➔ 100%` 마감).
