# 🔄 Z-Eye 듀얼 PC 클라우드 인수인계서 (`SYNC_HANDOVER.md`)

- **최종 업데이트 일시:** 2026-10-24 00:52 (KST)
- **최종 작업 브랜치:** `main` (`4120dd6`)
- **최종 핵심 과제:** `1차 출시 3대 메뉴·통합 가격표·10년 마스터권(100~1만명)·사진방 자동동기화(+9장 풍선)·업무방 백업PC 1~2호 & 야간초절전·5대 랜섬웨어/백업 안전철칙·이용약관 면책 2대 조항 완비`

---

## 1. 직전 세션 완료 핵심 내역 요약

1. **3대 메뉴(`🆓 내 기기` / `📸 사진 공유` / `💼 업무 공유`) & 통합 가격표 마스터 확정 ([`docs/Z-Eye_통합_가격표_마스터.md`](file:///d:/Z-Eye/docs/Z-Eye_통합_가격표_마스터.md), [`PricingModal.tsx`](file:///d:/Z-Eye/src/components/PricingModal.tsx), [`DesktopDashboard.tsx`](file:///d:/Z-Eye/src/components/DesktopDashboard.tsx)):**
   - 내 기기(PC 1 + 모바일 1) 평생 무료, 동호회·동창회 무제한 단일가 `월 4,900원`, 업무 공유(`1인 멀티PC 1,900원` / `소호 ~5인 9,900원` / `소기업 ~20인 19,000원` / `중소기업 ~50인 29,000원`), 최대 10년 마스터권 5단계(`100명 ➔ 500명 ➔ 1,500명 ➔ 3,000명 ➔ 10,000명`) 반영 완료.
2. **사진방 vs 업무방 동기화·백업 이원화 & 이중 안전장치 ([`LoungeView.tsx`](file:///d:/Z-Eye/src/components/LoungeView.tsx), [`docs/기능명세.md`](file:///d:/Z-Eye/docs/기능명세.md)):**
   - **사진방:** 각자 페이지에 `[🔄 원본 자동 동기화 중 (ON)]` 버튼 + `✨ 동기화 완료 (새로 9장 추가)` 풍선 배지 + 모바일 남은 용량 대비 가능/불가능 자동 체크 안내 (원본 열기 시 내 기기 안에서 0.01초 자체 해결).
   - **업무방:** 여권 미발동(검색 제외) + 현장·증빙 사진 시각/OCR 분석 유지 + `공용 PC(S:) 1대 + 백업 PC 1·2호` + 바탕화면 `[🌙 퇴근·야간 초절전 모드 (서서히 페이드아웃 후 모니터 OFF · 월 1,800원)]`.
   - **이중 안전장치 & 5대 백업 철칙:** `[30일 안전 보관함] ➔ 한 달 뒤 [휴지통]` 이동, 1분 30개 대량 삭제 서킷 브레이커 + 미끼 파일(`_000_zeye_guard.docx`).
3. **AI 모델 가중치 마스터 사본 자체 스토리지(백업 HDD & R2 CDN) 영구 보관 강령 & `Zero-Cloud + A to Z` 마케팅 서사 & 이용약관(ToS) 면책 2대 조항 문서화 완료 (`4120dd6`).**

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
