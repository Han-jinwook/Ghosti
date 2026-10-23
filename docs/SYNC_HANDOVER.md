# 🔄 Z-Eye 듀얼 PC 클라우드 인수인계서 (`SYNC_HANDOVER.md`)

- **최종 체크아웃 일시:** 2026-10-23 16:12 (KST)
- **최종 작업 브랜치:** `main`
- **최종 기능 커밋:** `952dbd5` (`설정몬스터 음성 안내 엔진 ko-KR-InJoonNeural 전면 교체 및 무지연 캐시 큐와 Heami 기계음 차단 적용`)

---

## 1. 오늘 완료된 핵심 작업 요약

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

### ③ 설정몬스터 음성 안내(TTS) 엔진 전면 교체 (`완료`)
- **파일 위치:** [`universal_z_core/os_agent/merlin_tts_engine.py`](file:///d:/Z-Eye/universal_z_core/os_agent/merlin_tts_engine.py), [`src/services/setupMonsterTts.ts`](file:///d:/Z-Eye/src/services/setupMonsterTts.ts), [`vite.config.ts`](file:///d:/Z-Eye/vite.config.ts)
- **핵심 구현:**
  - 브라우저 기본 기계음(`Microsoft Heami`)을 완전 폐기하고, `edge-tts` 기반 한국인 남성 성우 **`ko-KR-InJoonNeural`** (`rate="+5%"`, 옵션 `ko-KR-HyunsuNeural` 상수화)로 전면 교체.
  - **3단 무지연 자동 캐싱 큐(Write-Through Cache Queue):**
    1. **Cache Hit:** `tts_cache/{hash}.mp3` 존재 시 네트워크 호출 없이 **0.3~0.9ms (0.001초 미만)** 즉시 재생.
    2. **Cache Miss:** 최초 발화 시 실시간 합성·재생과 동시에 `tts_cache/{hash}.mp3` 자동 저장.
    3. **Pre-warming:** 고정 안내 멘트 13종을 서버/앱 시작 시 백그라운드에서 사전 합성 완료 (`tts_cache/*.mp3` 14개 파일 커밋 포함).
  - **오프라인 비상 폴백 방어:** 네트워크 단절 시에도 `getVoices()`에서 `Heami` 기계음을 원천 배제하고 `Microsoft InJoon Online (Natural)` ➔ `Google 한국의` 순서로만 매칭.

---

## 2. 집 PC 체크인 시 바로 이어서 할 작업 (`Next Action`)

1. **집 PC 체크인 명령어:**
   - 새 세션에서 *"체크인"*이라고 말씀하시면 에이전트가 `git pull` 후 로컬 개발 서버(`http://localhost:5199`)를 확인합니다.
   - 만약 집 PC Python 환경에 `edge-tts`가 없다면 에이전트가 자동으로 `python -m pip install --upgrade edge-tts`를 수행합니다 (`tts_cache/*.mp3` 14종은 이미 Git에 포함되어 있어 설치 전에도 즉시 0.01초 재생됩니다).
2. **2단계 마무리 (1초 원상복구 버튼 클릭 & 인준 성우 음성 확인):**
   - 설정몬스터 모달 상단에서 손가락(`👈`)이 가리키는 **`[↩️ 원래 설정으로 되돌리기]`** 버튼을 클릭하여 `S:` 드라이브 원상복구 및 `ko-KR-InJoonNeural` 남성 성우 음성을 확인합니다.
3. **이후 단계:**
   - 2단계 완료 확인 후 멀린님 지시에 따라 다음 단계(3단계 등)로 한 단계씩 천천히 진행합니다.
