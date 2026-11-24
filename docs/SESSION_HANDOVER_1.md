# 🟢 `[1귀신]` 세션 인계장 (`SESSION_HANDOVER_1.md` — 온보딩 · 귀신비서 · 여권)

- **최종 갱신 일시**: 2026-11-24 16:42 (KST)
- **담당 역할**: `[1귀신]` (온보딩 · 귀신비서 · 사진 정리 · 얼굴 여권)
- **세션 창 제목**: `1귀신 1.9GB패치·여권완결`

## 완료 내역
1. **크롬 단일 탭 1.9GB RAM·CPU 폭주 근본 패치 및 [`docs/기능명세.md`](기능명세.md) 8.4절 5대 정공법 명문화 (`96e9c7b`)**
   - 3·4호기 속도 저하 원인이 Z-코어(42~80MB)가 아닌 크롬 단일 탭 ONNX/WASM 동시 기동 및 미종료(1.9GB RAM)임을 SSH 실측으로 규명.
   - `assistantOnboardingSlice.ts`: 기동 시 `1단계 광학 감사(dHash) ➔ 2단계 얼굴 여권(YuNet+SFace) ➔ 3단계 비전/OCR(768D)` 100% 순차 직렬 실행(동시 워커 최대 1개).
   - `aiSharedRuntime.ts` · `aiPhotoFaceEngine.ts` · `onDeviceFacePassportEngine.ts`: 비전 유휴 `10~12초` 시 `terminateEmbeddingWorkerNow()` 강제 종료 및 Pass 2 OCR 직후 데스크톱·모바일 공통 `releasePaddleOcrRuntime()` 호출로 OS RAM 즉시 회수, 세션당 스캔 상한 통제(데스크톱 비전 `120장` / 모바일 `80장` / 얼굴 `160장`).
2. **온디바이스 얼굴 여권(`YuNet + SFace int8`) 정석 파이프라인 및 QA 이슈 전수 완결 (`9219edd`, `11d27eb`, `75f3014`, `3a04377`, `68a8bc6`, `5e6b1d9`)**
   - **5점 정면 정렬 & 오탐 차단**: `SFace int8` 입력 전 ArcFace 5점 랜드마크 2D 유사변환(`112×112`) + 중심 벡터(`0.42`) 재병합으로 동일인 분리·타인 혼입 해결, `YuNet` 임계치 `0.82` 상향 + YCbCr 피부톤 및 고채도 국물/찌개/캐릭터·시스템 `Temp` 폴더 배제(4호기 임시파일 ~500건 청소 포함).
   - **고유 `clusterId` & 영구 스냅샷 SSOT**: 단체사진 동반 등장 시에도 충돌 없는 `대표사진+얼굴좌표` 고유 `clusterId`(`v9`), 두 번째 이후 인물 클릭 시 이전 제외/거절 키 자동 해제 + `[다른 얼굴 고르기]` 버튼 + 0장 선택 시 `[1장 이상 선택]` 비활성화, 확정 여권 사진 영구 스냅샷(`confirmedSelfCuts`) 보존 및 프로필 여권 모달·채팅 단일 조회(`getConfirmedSelfPassportView`) 통합, 스캔 중 `'여권 등록'` 요청 시 완료 즉시 자동 후속 안내(`queuedUserPassportWait`), `data:image/` 아바타 이중 캔버스 덧그리기 생략(겹침 깜빡임 제거).
3. **새로고침(`F5`) 첫 화면 지연·임시 사진 깜빡임 및 프로필 `'회'` 깜빡임 원천 제거 (`fed6795`, `08df1f3`)**
   - 데스크톱 본 화면 `initApp` 초입 Z-코어 헬스체크 선대기 및 원격 호출 `700ms` 분리 + 첫 렌더링 직전 IndexedDB 광학 캐시(`applyCachedPcOpticalAuditInstant`) `0.01초` 선복원으로 임시 `4세트` 깜빡임 없이 최종 `56세트` 원샷 표시, `HubProfileCard` 닉네임 동기 초기화로 프로필 원 안 `'회'` 깜빡임 제거.
4. **자체보호 보안모듈 대화형 선택지 · 30일 고아 캐시 GC · Z-코어 무인 자가업데이트 완결 (`510172c`, `ee17b69`, `8d803a0`, `d3b0ef8`)**
   - `AhnLab Safe Transaction`·`nProtect` 자체보호 보안모듈 감지 포함 + `[안 지우고 잠재우기]` / `[안 쓰는 보안앱 완전 삭제]` 나란히 칩 및 공식 언인스톨러 UAC 직결, 원본 이동·삭제 사진의 고아 캐시 **30일 1회** 저우선순위 자동 청소(`_trigger_monthly_orphan_cache_gc_once`), `zCoreBridge.ts` 자가업데이트 이중 URL 수정 및 `build_signed_merlin_z_core.py` `z-core-latest` GitHub Release 자동 업로드 일원화, 슬로건 v3.0·마스터바이블 오리지널 문서 단독 이관 완료.

## 다음 체크인 Todo
- [ ] **MS 코드서명 답장 확인 후 재서명**: 멀린님 답장 대기 중 (`Merlin_Z_Core_Setup.exe` 재서명 및 `z-core-latest` GitHub Release 동시 교체).
- [ ] **색상 톤 최종 눈검수**: 복원 완료(`6c51a21`·`f828ef3`)된 틸·에메랄드 컬러 톤에 대한 멀린님 눈검수 피드백 반영 대기.
