# 🔄 Z-Eye 듀얼 PC 클라우드 인수인계서 (`SYNC_HANDOVER.md`)

- **최종 업데이트 일시:** 2026-10-24 16:05 (KST)
- **최종 작업 브랜치:** `main`
- **최종 핵심 과제:** `v2.1 대내외 슬로건·요금제·공유방 동기화/권한/탈퇴 6대 정책(24시간 내 본인 삭제 + 방 개설 시 방장 숨기기 옵션 · EXIF 진짜 원본 검증 · 숨김 썸네일 DB & 내 기기 원본 동기화 자체 해결 · 업무방 읽기모드 안내 · OS 기본 휴지통 일원화 · 탈퇴 시 썸네일 DB 즉시 자동 삭제 및 약관 명시) 완비`

---

## 1. 직전 세션 완료 핵심 내역 요약

1. **대내외 대표 슬로건 확정 · `[💻 내 기기]` 무료 워딩 제거(`🩺 AI 주치의 진단`) · 통합 가격표 마스터 ([`docs/Z-Eye_통합_가격표_마스터.md`](file:///d:/Z-Eye/docs/Z-Eye_통합_가격표_마스터.md), [`PricingModal.tsx`](file:///d:/Z-Eye/src/components/PricingModal.tsx), [`DesktopDashboard.tsx`](file:///d:/Z-Eye/src/components/DesktopDashboard.tsx)):**
   - 내 기기(언제나 0원 · 무료 워딩 제거 후 `🩺 AI 주치의 진단` 즉시 실행), 동호회·동창회 인원 무제한 단일가 `월 4,900원 (10년 마스터권 49,000원)`, 양방향 교차 무료 구독권(`모임 연구독 ➔ 가족방 1개월권 3장` / `가족 연구독 ➔ 모임방 3개월권 1장`), 5단계 마스터권 1줄 깔끔 노출 반영 완료.
2. **v2.1 공유방 데이터 흐름 · 동기화 · 권한 · 탈퇴 6대 원칙 확정 ([`LoungeView.tsx`](file:///d:/Z-Eye/src/components/LoungeView.tsx), [`docs/기능명세.md`](file:///d:/Z-Eye/docs/기능명세.md), [`docs/정책_및_핵심원칙.md`](file:///d:/Z-Eye/docs/정책_및_핵심원칙.md)):**
   - **사진방:** 구 ‘원본 1초 소환 / 24시간 클라우드 도우미’ 전면 폐기 ➔ 평소 숨김 영역(`%LOCALAPPDATA%\Merlin\thumb_db`)에 13KB 썸네일 DB만 보관하다가 `[🔄 원본 동기화]` 시 경로 지정 및 안내 후 내 기기에서 100% 자체 해결. `64-bit dHash`는 `EXIF 원본 메타데이터 + 실제 고해상도` 진짜 원본일 때만 자동 교체. 업로드 후 **24시간 내 올린 본인 삭제 + 방장은 올라오는 처음부터 상시 숨기기 권한 보유 여부 방 개설 설정 옵션** 탑재. **탈퇴(자퇴·강퇴 동일) 시 그 공유방의 숨김 썸네일 DB · 공유방 검색 인덱스 · 해당 방 내부 타 멤버 여권 목록만 즉시 자동 삭제**(※ 내 PC의 ‘나 자신의 Z-Eye 여권’ 및 ‘내 기기 개인 인덱스’는 100% 보존되며, 기동기화된 로컬 원본 폴더도 자율 관리).
   - **업무방:** 여권 미발동(검색 제외) + `공용 PC(S:) 1대 + 백업 PC 1·2호` + `[🌙 야간·퇴근 초절전 모드 (월 1,800원)]` + 웹/앱 검색 열람 시 `"🔒 현재 [OOO]님이 사용 중입니다. 읽기 모드로 열립니다."` 안내.
   - **OS 기본 `[휴지통]` 일원화 & 랜섬웨어 서킷 브레이커:** `[30일 안전 보관함]` 폐기 ➔ `OS 기본 [휴지통]`(`+ 1초 실행 취소`) 직행, 1분 30개 대량 삭제 서킷 브레이커 + 미끼 파일(`_000_zeye_guard.docx`).
3. **AI 모델 가중치 마스터 사본 자체 스토리지(백업 HDD & R2 CDN) 영구 보관 강령 & 이용약관(ToS) 면책 3대 조항(탈퇴 시 썸네일 DB 삭제 조항 포함) 문서화 완료.**

---

## 2. 이전 단계 누적 완료 내역 (설정몬스터 실물 수리 & 필재 성우 캐싱)

### ① 1단계: 오피스·파일 증발 3초 결정론적 포렌식 & 탐색기 검색창 직결 (`완료`)
- **파일 위치:** [`universal_z_core/os_agent/merlin_z_core_os.py`](file:///d:/Z-Eye/universal_z_core/os_agent/merlin_z_core_os.py), [`src/components/SetupMonsterModal.tsx`](file:///d:/Z-Eye/src/components/SetupMonsterModal.tsx)
- **핵심 구현:**
  - 폴더 안 파일이 많아 찾기 어려운 문제를 해결하기 위해 `search-ms:query=<파일명>&crumb=location:<부모폴더>` 프로토콜(`open_file_search`)을 적용하여, 클릭 즉시 탐색기 검색창에 파일명이 자동 입력된 상태로 해당 파일만 1초 만에 필터링되어 뜨도록 구현 완료.
  - 유저 혼선을 막기 위해 불필요한 `[문서 바로 실행]` 버튼을 제거하고 **`[📂 탐색기 검색창에 넣어 띄우기]`** 단일 버튼으로 일원화.

### ② 2단계: 설정몬스터 실물 수리 UI 고정 & 순수 손가락(`👈`) 지목 (`완료`)
- **파일 위치:** [`src/components/SetupMonsterModal.tsx`](file:///d:/Z-Eye/src/components/SetupMonsterModal.tsx), [`src/store/useSaySeeStore.ts`](file:///d:/Z-Eye/src/store/useSaySeeStore.ts)
- **핵심 구현:**
  - 비동기 포렌식/OS 진단 데이터 로드로 인해 화면이 3번 밀려 내려가던 레이아웃 시프트를 0px로 차단하기 위해, **`4. 자주 찾는 증상 선택` 및 `5. 대화형 수리 창구`를 모달 최상단(1순위)**에 배치.
  - 붉은 바탕의 안내 배너와 텍스트 박스를 전면 삭제하고, 버튼 옆에 **순수 손가락 아이콘(`👈`)만** 표시하도록 정돈.
  - 대화창에 이전 카드가 쌓여 새 버튼이 스크롤 아래로 가려지던 문제를 해결하여, 항상 **현재 단계 카드 1개만** 스크롤 없이 제자리에서 즉시 교체되도록 개선.

### ③ 카페브레이크 전속 성우 '필재(Piljae)' 전면 체인지 및 무지연 무과금 캐싱 (`완료`)
- **파일 위치:** [`universal_z_core/os_agent/merlin_tts_engine.py`](file:///d:/Z-Eye/universal_z_core/os_agent/merlin_tts_engine.py), [`src/services/setupMonsterTts.ts`](file:///d:/Z-Eye/src/services/setupMonsterTts.ts), [`vite.config.ts`](file:///d:/Z-Eye/vite.config.ts)
- **핵심 구현:**
  - **카페브레이크 전속 시그니처 성우 필재(Piljae) 적용:**
    - Typecast 최고음질 모델 `ssfm-v30`, Voice ID: `tc_68257f68bc6e3c161ab5078d`
    - `imageio_ffmpeg`를 연동하여 방송 음향 기준 음량 정규화(`loudnorm=I=-16:TP=-1.5:LRA=11`) 및 고음질 192k MP3 변환.
  - **전사 키 연동 & 3단 무지연 무과금 캐시 큐:**
    1. **Cache Hit (0.3~1.8ms):** `tts_cache/{hash}.mp3` 존재 시 네트워크/API 호출 0회, 비용 0원으로 즉시 재생.
    2. **Cache Miss:** 최초 발화 시 1회 유료 합성 후 고음질 MP3로 캐싱(Write-Through), 이후 영구 무과금 재활용.
    3. **Pre-warming 13종 일괄 합성 완료:** 설정몬스터 13종 고정 안내 멘트를 백그라운드에서 사전 합성하여 `tts_cache/`에 100% 저장 완료.
  - **2중 안전망 Fallback Defense:**
    - Typecast API 키 부재 또는 크레딧 부족 시 ➔ `edge-tts` (`ko-KR-InJoonNeural`) 즉시 자동 대체.
    - 네트워크 완전 단절 시 ➔ `speechSynthesis` 자연어 폴백 (Heami 구형 기계음 원천 차단).

---

## 2. 실전 확인 및 다음 작업 (`Next Action`)

1. **브라우저 테스트:**
   - [**http://localhost:5199**](http://localhost:5199) 접속 후, 설정몬스터 상단 손가락(`👈`)이 가리키는 **`[↩️ 원래 설정으로 되돌리기]`** 또는 **`[🛠️ 1초 만에 바로 고치기]`** 클릭.
   - 카페브레이크 전속 성우 **필재**의 깊고 또렷한 톤앤매너 음성이 0.001초 만에 재생되는지 확인.
2. **이후 단계:**
   - 필재 성우 음성 확인 후 멀린님 지시에 따라 다음 작업 단계로 진행.
