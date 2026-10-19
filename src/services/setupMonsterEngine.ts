import type {
  SetupDiagnosisPlan,
  SetupMonsterPlatform,
  SetupPreTriageQuestion,
  SetupProactiveHint,
} from '../types/saysee';

export const INITIAL_PROACTIVE_HINTS: SetupProactiveHint[] = [
  {
    id: 'hint_night_youtube',
    platform: 'mobile',
    badgeText: 'UsageStatsManager · 시력 보호 진단',
    title: '🌙 야간 유튜브 시청이 많으신데 눈 보호 모드가 꺼져 있습니다',
    telemetrySource: '밤 10시~새벽 1시 유튜브 일평균 84분 시청 · 블루라이트 필터 OFF 감지',
    userProfileContext: '4050 중장년 시력 피로도 고위험 패턴',
    presetQuery: '야간 눈 보호 모드 켜주고 글씨가 너무 작아서 눈이 침침한데 시원하게 키워줘',
    presetId: 'mobile_font_eye',
    resolved: false,
  },
  {
    id: 'hint_zombie_battery',
    platform: 'mobile',
    badgeText: 'UsageStatsManager · 배터리 누수 진단',
    title: '🔋 안 쓰는 앱 15개가 배터리를 20% 소모 중입니다',
    telemetrySource: '최근 30일 미실행 유령앱 15개 백그라운드 WakeLock · 위치 호출 감지',
    userProfileContext: '외출 시 오후 배터리 급감 원인 1위',
    presetQuery: '안 쓰는 앱 15개 배터리 빨리 안 닳게 초절전으로 묶어줘',
    presetId: 'mobile_zombie_sleep',
    resolved: false,
  },
  {
    id: 'hint_evening_dnd',
    platform: 'mobile',
    badgeText: 'NotificationPolicy · 생활 리듬 진단',
    title: '🔕 저녁 7~8시 운동·휴식 시간대에 알림이 평균 28회 울립니다',
    telemetrySource: '19:00~20:00 단체 카톡방·쇼핑앱 푸시 알림 집중 발생',
    userProfileContext: '저녁 운동 및 개인 휴식 집중 방해',
    presetQuery: '운동하는 저녁 7~8시엔 카톡이나 전화 소리 안 나게 해줘',
    presetId: 'mobile_evening_dnd',
    resolved: false,
  },
];

export interface SetupSymptomChip {
  id: string;
  platform: SetupMonsterPlatform;
  label: string;
  trackBadge: string;
  levelBadge: string;
  query: string;
}

export const PC_SYMPTOM_CHIPS: SetupSymptomChip[] = [
  {
    id: 'pc_boot_ads',
    platform: 'pc',
    label: '🚀 부팅 시 뜨는 광고/유령앱 차단',
    trackBadge: 'Track A · 1단계 제어',
    levelBadge: '🟢 Level 1 · 100 코인',
    query: '부팅할 때마다 뜨는 광고 팝업이랑 느려지게 만드는 유령 시작프로그램 싹 차단해줘',
  },
  {
    id: 'pc_laptop_lid',
    platform: 'pc',
    label: '🔋 노트북 덮어도 안 꺼지게 설정',
    trackBadge: 'Track A · 1단계 제어',
    levelBadge: '🟢 Level 1 · 100 코인',
    query: '노트북 뚜껑 덮어도 절전으로 안 꺼지고 마스터 서버 계속 돌아가게 설정해줘',
  },
  {
    id: 'pc_parent_display',
    platform: 'pc',
    label: '👀 부모님용 큰 글씨/야간모드',
    trackBadge: 'Track A · 1단계 제어',
    levelBadge: '🟢 Level 1 · 100 코인',
    query: '부모님 보시기 편하게 PC 화면 글씨 크기 키우고 눈 안 부시게 야간모드 켜줘',
  },
  {
    id: 'pc_printer_spooler',
    platform: 'pc',
    label: '🖨️ 프린터 인쇄 먹통 1초 해결',
    trackBadge: 'Track A · 중급 장치/포트',
    levelBadge: '🟡 Level 2 · 300 코인',
    query: '프린터가 대기 중으로만 뜨고 인쇄가 먹통인데 1초 만에 고쳐줘',
  },
  {
    id: 'pc_excel_overlay',
    platform: 'pc',
    label: '👆 엑셀·PC카톡 내부 기능 (손가락 가이드)',
    trackBadge: 'Track B · 다단계 오버레이',
    levelBadge: '🟡 Level 2 · 300 코인',
    query: '엑셀에서 스크롤 내려도 첫 줄 고정하는 거랑 PC카톡 알림 끄는 위치 손가락 화살표로 짚어줘',
  },
  {
    id: 'pc_work_s_drive',
    platform: 'pc',
    label: '💽 업무 라운지 S: 드라이브 복합 복구',
    trackBadge: 'Track A · 고난도 3단계 수리',
    levelBadge: '🔴 Level 3 · 500 코인',
    query: '윈도우 탐색기에서 업무 라운지 S: 드라이브 연결이 풀리고 권한 오류가 뜨는데 복합 복구해줘',
  },
  {
    id: 'pc_security_plugin',
    platform: 'pc',
    label: '🏦 관공서·금융 보안 플러그인 충돌 정리',
    trackBadge: 'Track A · 고난도 3단계 수리',
    levelBadge: '🔴 Level 3 · 500 코인',
    query: '은행이랑 홈택스 들어갔다 나온 뒤로 PC가 버벅거리고 키보드 충돌이 나는데 보안 플러그인 정리해줘',
  },
];

export const MOBILE_SYMPTOM_CHIPS: SetupSymptomChip[] = [
  {
    id: 'mobile_evening_dnd',
    platform: 'mobile',
    label: '🔕 저녁 7~8시 운동 시간 무음 스케줄',
    trackBadge: '시스템 직접 변경',
    levelBadge: '🟢 단일 100 코인',
    query: '운동하는 저녁 7~8시엔 카톡이나 전화 소리 안 나게 해줘',
  },
  {
    id: 'mobile_font_eye',
    platform: 'mobile',
    label: '👀 침침한 눈 큰 글씨 & 블루라이트 차단',
    trackBadge: '시스템 직접 변경',
    levelBadge: '🟢 단일 100 코인',
    query: '글씨가 너무 작아서 눈이 침침해, 글씨 키우고 눈 보호 모드 켜줘',
  },
  {
    id: 'mobile_zombie_sleep',
    platform: 'mobile',
    label: '🔋 미사용 앱 15개 배터리 소모 차단',
    trackBadge: '시스템 직접 변경',
    levelBadge: '🟢 단일 100 코인',
    query: '안 쓰는 앱 15개 배터리 빨리 안 닳게 초절전으로 묶어줘',
  },
  {
    id: 'mobile_kakao_overlay',
    platform: 'mobile',
    label: '👆 카톡·유튜브 앱 내부 설정 (손가락 동행 가이드)',
    trackBadge: '실시간 오버레이 👆',
    levelBadge: '🟢 단일 100 코인',
    query: '카톡 앱 안에서 알림 소리 끄는 버튼 위치를 화면 위 손가락 화살표로 직접 짚어줘',
  },
];

export function resolvePresetIdFromQuery(
  platform: SetupMonsterPlatform,
  rawQuery: string,
  presetIdHint?: string
): string {
  if (presetIdHint) return presetIdHint;
  const lower = rawQuery.trim().toLowerCase();

  if (platform === 'pc') {
    if (/보안|은행|관공서|홈택스|키보드|플러그인|충돌/.test(lower)) return 'pc_security_plugin';
    if (/s:|드라이브|탐색기|마운트|업무|공유폴더/.test(lower)) return 'pc_work_s_drive';
    if (/프린터|인쇄|스풀러|출력|먹통/.test(lower)) return 'pc_printer_spooler';
    if (/엑셀|한글|카톡|카카오톡|틀고정|손가락|어디/.test(lower)) return 'pc_excel_overlay';
    if (/노트북|뚜껑|덮개|덮어도|절전/.test(lower)) return 'pc_laptop_lid';
    if (/글씨|크게|부모님|야간|눈/.test(lower)) return 'pc_parent_display';
    return 'pc_boot_ads';
  }

  if (/손가락|화살표|짚어|오버레이|유튜브|앱 안|어디/.test(lower)) return 'mobile_kakao_overlay';
  if (/운동|저녁|7시|8시|방해금지|소리 안|무음|알림/.test(lower)) return 'mobile_evening_dnd';
  if (/배터리|15개|절전|안 쓰는 앱/.test(lower)) return 'mobile_zombie_sleep';
  return 'mobile_font_eye';
}

/**
 * [1단계: 선(先) 무료 문진 & Z-Eye_PC_Setup.exe 백그라운드 사태 파악]
 * PC 환경에서 유저가 증상을 말하면 곧바로 결제창을 띄우지 않고,
 * LLM이 1~2회 추가 질문을 거치며 .exe를 통해 백그라운드에서 해결 가능 여부와 작업 복잡도를 먼저 스캔합니다.
 */
export function buildSetupPreTriageQuestion(
  platform: SetupMonsterPlatform,
  rawQuery: string,
  presetIdHint?: string
): SetupPreTriageQuestion {
  const resolvedId = resolvePresetIdFromQuery(platform, rawQuery, presetIdHint);
  const qId = `triage_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  if (resolvedId === 'pc_printer_spooler') {
    return {
      questionId: qId,
      presetId: 'pc_printer_spooler',
      platform: 'pc',
      symptomQuery: rawQuery,
      exeBackgroundScanNote:
        '🔍 Z-Eye_PC_Setup.exe 백그라운드 사전 스캔(무료): Windows Spooler 큐에 멈춘 문서 4건 및 WSD 네트워크 포트 지연 감지됨 (해결 가능 판정 · Level 2 중급 수리 대상)',
      questionText:
        '정확한 수리 레시피 선택을 위해 한 가지만 여쭤볼게요! 현재 프린터 증상이 아래 중 어느 쪽에 가장 가까운가요?',
      options: [
        {
          label: '① "인쇄 대기 중"으로만 멈춰 있고 종이가 한 장도 안 나와요',
          detailAnswer: '인쇄 대기 중으로만 멈춰 있고 종이가 안 나와요 (Spooler 큐 초기화 필요)',
        },
        {
          label: '② 프린터 전원은 켜져 있는데 PC에서 "오프라인"으로 떠요',
          detailAnswer: '프린터 전원은 켜져 있는데 오프라인으로 떠요 (WSD 포트 → TCP/IP 포트 재연결 필요)',
        },
        {
          label: '③ 둘 다 해당돼요 (스풀러 초기화 + 포트 재연결 동시 진행)',
          detailAnswer: '대기열 먹통과 오프라인 증상 둘 다 한 번에 해결해 주세요',
        },
      ],
    };
  }

  if (resolvedId === 'pc_work_s_drive') {
    return {
      questionId: qId,
      presetId: 'pc_work_s_drive',
      platform: 'pc',
      symptomQuery: rawQuery,
      exeBackgroundScanNote:
        '🔍 Z-Eye_PC_Setup.exe 백그라운드 사전 스캔(무료): SMB 자격 증명 캐시 만료 + LanmanWorkstation 레지스트리 보안 서명 충돌 감지됨 (해결 가능 판정 · Level 3 고난도 3단계 복합 수리 대상)',
      questionText:
        '업무 라운지 S: 드라이브 복구를 위해 현재 탐색기 상태를 확인해 주세요 (선택 즉시 맞춤형 견적 카드가 생성됩니다):',
      options: [
        {
          label: '① S: 드라이브에 빨간 X 표시가 뜨면서 안 열려요',
          detailAnswer: '탐색기에서 S: 드라이브에 빨간 X 표시가 뜨면서 연결이 끊겼어요',
        },
        {
          label: '② "네트워크 자격 증명/권한이 없습니다" 팝업이 떠요',
          detailAnswer: '네트워크 자격 증명 권한 오류 팝업이 뜨면서 접속이 거부돼요',
        },
        {
          label: '③ 내 컴퓨터에서 S: 드라이브 아이콘 자체가 사라졌어요',
          detailAnswer: '탐색기에서 S: 드라이브 자체가 아예 안 보여요 (3단계 전체 재마운트 요청)',
        },
      ],
    };
  }

  if (resolvedId === 'pc_security_plugin') {
    return {
      questionId: qId,
      presetId: 'pc_security_plugin',
      platform: 'pc',
      symptomQuery: rawQuery,
      exeBackgroundScanNote:
        '🔍 Z-Eye_PC_Setup.exe 백그라운드 사전 스캔(무료): 관공서·금융권 보안 서비스(TouchEn, AhnLab Safe Transaction, ASTx, IPInside, Veraport 등 11종)가 상주하며 CPU 28% 점유 및 키보드 필터 드라이버 충돌 중 (해결 가능 판정 · Level 3 고난도 복합 수리 대상)',
      questionText:
        '은행·관공서 이용 후 언제부터 불편하셨나요? 원하시는 정리 범위를 선택해 주세요:',
      options: [
        {
          label: '① 평소엔 보안 서비스 11종을 완전히 꺼두고 은행 쓸 때만 켜고 싶어요',
          detailAnswer: '평소엔 보안 플러그인 11종 백그라운드 자동실행을 싹 끄고 키보드 충돌을 잡아주세요',
        },
        {
          label: '② 인터넷 창이 버벅거리고 한글/영문 키보드 입력이 자꾸 씹혀요',
          detailAnswer: '키보드 보안 드라이버 충돌이랑 브라우저 렉을 3단계로 완전 수리해 주세요',
        },
      ],
    };
  }

  if (resolvedId === 'pc_excel_overlay') {
    return {
      questionId: qId,
      presetId: 'pc_excel_overlay',
      platform: 'pc',
      symptomQuery: rawQuery,
      exeBackgroundScanNote:
        '🔍 Z-Eye_PC_Setup.exe 백그라운드 사전 스캔(무료): 현재 모니터에 실행 중인 타사 프로그램(Excel / KakaoTalk) 창 핸들(HWND) 및 리본 메뉴 UI Automation 트리 스캔 성공 (해결 가능 판정 · Level 2 다단계 오버레이 가이드)',
      questionText:
        '모니터 화면 위에 빨간 손가락 화살표(👆)를 띄워 한 걸음씩 짚어드릴게요. 어떤 기능을 먼저 찾으시나요?',
      options: [
        {
          label: '① 엑셀에서 스크롤 내려도 첫째 줄(제목 행)이 고정되게 하고 싶어요',
          detailAnswer: '엑셀 첫 행 틀 고정 메뉴 위치를 모니터 위 손가락 화살표로 짚어주세요',
        },
        {
          label: '② PC카톡 부팅 자동실행 및 알림 팝업 끄는 위치를 찾고 싶어요',
          detailAnswer: 'PC카톡 설정과 알림 끄는 위치를 손가락 화살표로 차례대로 알려주세요',
        },
      ],
    };
  }

  if (resolvedId === 'pc_laptop_lid') {
    return {
      questionId: qId,
      presetId: 'pc_laptop_lid',
      platform: 'pc',
      symptomQuery: rawQuery,
      exeBackgroundScanNote:
        '🔍 Z-Eye_PC_Setup.exe 백그라운드 사전 스캔(무료): 현재 Windows PowerCfg 전원 정책이 덮개 닫음 시 "절전(Sleep)"으로 되어 있어 서버가 끊깁니다 (해결 가능 판정 · Level 1 단순 OS 설정)',
      questionText:
        '노트북 덮개를 닫았을 때 어떤 상태로 작동하길 원하시나요?',
      options: [
        {
          label: '① 충전기 꽂혀 있을 때만 덮어도 안 꺼지게 해주세요 (권장)',
          detailAnswer: '전원 어댑터 연결 시에는 노트북 뚜껑을 덮어도 절전으로 안 꺼지게 설정해 주세요',
        },
        {
          label: '② 배터리 모드일 때도 덮어도 절대 안 꺼지게 해주세요',
          detailAnswer: '배터리와 전원 연결 모두 덮개를 닫아도 항상 켜져 있도록 설정해 주세요',
        },
      ],
    };
  }

  if (resolvedId === 'pc_parent_display') {
    return {
      questionId: qId,
      presetId: 'pc_parent_display',
      platform: 'pc',
      symptomQuery: rawQuery,
      exeBackgroundScanNote:
        '🔍 Z-Eye_PC_Setup.exe 백그라운드 사전 스캔(무료): 현재 디스플레이 배율 100%(기본 작은 글씨) 및 청색광 야간 모드 OFF 상태 확인됨 (해결 가능 판정 · Level 1 단순 OS 설정)',
      questionText:
        '부모님(또는 사용자분) 눈이 가장 편안하시도록 어느 정도로 맞춰 드릴까요?',
      options: [
        {
          label: '① 글자 크기 125% 시원하게 확대 + 눈 시림 방지 따뜻한 야간모드 동시 적용',
          detailAnswer: '글자 크기 125% 확대와 따뜻한 야간 보호 모드를 동시에 적용해 주세요',
        },
        {
          label: '② 색감은 그대로 두고 글자 크기만 큼직하게 키워 주세요',
          detailAnswer: '모니터 글자 배율만 큼직하게 키워 주세요',
        },
      ],
    };
  }

  return {
    questionId: qId,
    presetId: 'pc_boot_ads',
    platform: 'pc',
    symptomQuery: rawQuery,
    exeBackgroundScanNote:
      '🔍 Z-Eye_PC_Setup.exe 백그라운드 사전 스캔(무료): 레지스트리(HKCU\\...\\Run) 및 작업 스케줄러에서 부팅 시 자동 실행되는 광고·유령 프로세스 7종 발견 (해결 가능 판정 · Level 1 단순 OS 설정)',
    questionText:
      '부팅 속도를 늦추는 유령 시작프로그램 7개가 발견되었습니다. 어떻게 정리해 드릴까요?',
    options: [
      {
        label: '① 백신·카톡·Z-Eye만 남기고 불필요한 광고·유령앱 7개 전부 차단 (권장)',
        detailAnswer: '필수 앱만 남기고 부팅 시 뜨는 광고·유령 자동실행 앱 7개를 모두 차단해 주세요',
      },
      {
        label: '② 우측 하단 쇼핑/뉴스 광고 팝업 프로세스만 선별 차단',
        detailAnswer: '부팅 후 우측 하단에 뜨는 광고 팝업 프로그램들을 집중 차단해 주세요',
      },
    ],
  };
}

export function buildSetupDiagnosisPlan(
  platform: SetupMonsterPlatform,
  rawQuery: string,
  presetIdHint?: string
): SetupDiagnosisPlan {
  const q = rawQuery.trim();
  const resolvedId = resolvePresetIdFromQuery(platform, q, presetIdHint);
  const planId = `plan_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  // ─────────────── [PC Level 3 (고난도 복합 수리 - 500 코인)] ───────────────
  if (resolvedId === 'pc_work_s_drive') {
    return {
      planId,
      presetId: 'pc_work_s_drive',
      platform: 'pc',
      track: 'TRACK_A_DIRECT_REPAIR',
      difficultyLevel: 'LEVEL_3_ADVANCED_500',
      difficultyBadgeKo: '🔴 Level 3 (고난도 복합 수리 - 500 코인)',
      feasibilityCheckKo:
        '✅ Z-Eye_PC_Setup.exe 정밀 진단 완료: 3단계 복합 처치(① 좀비 세션 강제 해제 ➔ ② LanmanWorkstation 보안 서명 레지스트리 교정 ➔ ③ S: 영구 마운트 및 File Lock 데몬 복구)로 100% 해결 가능합니다.',
      symptomQuery: q,
      title: '💽 [Level 3 복합 수리] 업무 드라이브(S:) 레지스트리·SMB 자격증명·권한 3단계 완전 복구',
      rootCause:
        '눈(Eye) 스캔 결과: 단순 연결 끊김이 아니라 ① Windows 자격 증명 관리자 세션 충돌, ② SMBv2/v3 게스트 보안 서명 레지스트리(RequireSecuritySignature) 차단, ③ 탐색기 드라이브 문자 캐시 잠금이 겹친 3중 복합 장애입니다.',
      agentModuleName: 'Z-Eye_PC_Setup.exe (3-Stage Registry + CredMan + SMB Mount Engine)',
      systemCommandOrApi:
        '[Stage 1] cmdkey /delete:127.0.0.1 && net use S: /delete /y; [Stage 2] Set-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\LanmanWorkstation\\Parameters" -Name "AllowInsecureGuestAuth" -Value 1; [Stage 3] net use S: "\\\\127.0.0.1\\Z-Eye_Work_Vault" /persistent:yes',
      beforeSnapshot: {
        driveLetter: 'S:',
        mounted: false,
        smbRegistryGuestAuth: 0,
        credManSession: 'Corrupted_Token',
        fileLockDaemon: 'Stopped',
      },
      afterSnapshot: {
        driveLetter: 'S:',
        mounted: true,
        smbRegistryGuestAuth: 1,
        credManSession: 'Refreshed_Verified',
        fileLockDaemon: 'Running (Real-time Lock Sync)',
      },
      completionMessage:
        '✅ [Level 3 고난도 3단계 수리 완료] ① 충돌난 네트워크 자격 증명 초기화 ➔ ② Windows SMB 레지스트리 보안 정책 교정 ➔ ③ 윈도우 탐색기 [업무 드라이브(S:)] 영구 마운트 및 동시 편집 잠금(File Lock) 복구를 완료했습니다!',
      voiceTtsSummary:
        '고난도 삼 단계 복합 수리로 윈도우 레지스트리와 네트워크 권한을 복구하고 업무용 S 드라이브를 다시 연결했습니다.',
      creditCost: 500,
    };
  }

  if (resolvedId === 'pc_security_plugin') {
    return {
      planId,
      presetId: 'pc_security_plugin',
      platform: 'pc',
      track: 'TRACK_A_DIRECT_REPAIR',
      difficultyLevel: 'LEVEL_3_ADVANCED_500',
      difficultyBadgeKo: '🔴 Level 3 (고난도 복합 수리 - 500 코인)',
      feasibilityCheckKo:
        '✅ Z-Eye_PC_Setup.exe 정밀 진단 완료: 3단계 복합 처치(① 금융/관공서 보안 서비스 11종 수동 전환 ➔ ② UpperFilters 키보드 후킹 드라이버 충돌 해제 ➔ ③ WMI/브라우저 포트 점유 정리)로 해결 가능합니다.',
      symptomQuery: q,
      title: '🏦 [Level 3 복합 수리] 관공서·금융 보안 플러그인 11종 충돌 제어 & 키보드 먹통 3단계 복구',
      rootCause:
        '눈(Eye) 스캔 결과: 은행·관공서 사이트 방문 시 설치된 11개의 보안 서비스가 평상시에도 백그라운드에서 서로 키보드 입력 후킹(UpperFilters)과 로컬 루프백 포트를 다투며 CPU 28% 점유 및 타이핑 지연을 유발하고 있습니다.',
      agentModuleName: 'Z-Eye_PC_Setup.exe (3-Stage Service + Driver Filter + Port Resolver)',
      systemCommandOrApi:
        '[Stage 1] Get-Service ASTx,TouchEnNx,AnySign4PC,IPInside,Veraport | Stop-Service -Force | Set-Service -StartupType Manual; [Stage 2] Repair-KeyboardClassFilter -Hive HKLM\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e96b-e325-11ce-bfc1-08002be10318}; [Stage 3] Clear-LoopbackSocketConflict',
      beforeSnapshot: {
        activeSecurityServices: 11,
        cpuBackgroundUsagePct: 28.4,
        keyboardUpperFilters: ['kbdclass', 'ankbdflt_conflict', 'te_hook_legacy'],
        startupMode: 'Automatic (Always Running)',
      },
      afterSnapshot: {
        activeSecurityServices: 0,
        cpuBackgroundUsagePct: 1.4,
        keyboardUpperFilters: ['kbdclass (Clean Standard)'],
        startupMode: 'On-Demand Only (은행 접속 시에만 작동)',
      },
      completionMessage:
        '✅ [Level 3 고난도 3단계 수리 완료] 상주하던 관공서·금융 보안 플러그인 11종을 "은행 접속 시에만 수동 실행"으로 전환하고 키보드 필터 드라이버 충돌을 교정하여 PC 속도와 타이핑 반응성을 완벽히 되살렸습니다!',
      voiceTtsSummary:
        '컴퓨터를 느리게 만들던 열한 개의 보안 프로그램 충돌을 정리하고 키보드 입력이 매끄럽게 되도록 삼 단계 수리를 마쳤습니다.',
      creditCost: 500,
    };
  }

  // ─────────────── [PC Level 2 (중급 장치·네트워크·앱 가이드 - 300 코인)] ───────────────
  if (resolvedId === 'pc_printer_spooler') {
    return {
      planId,
      presetId: 'pc_printer_spooler',
      platform: 'pc',
      track: 'TRACK_A_DIRECT_REPAIR',
      difficultyLevel: 'LEVEL_2_INTERMEDIATE_300',
      difficultyBadgeKo: '🟡 Level 2 (중급 장치·네트워크·앱 가이드 - 300 코인)',
      feasibilityCheckKo:
        '✅ Z-Eye_PC_Setup.exe 진단 완료: 인쇄 스풀러 유령 문서 강제 퍼지(Purge) 및 WSD 포트를 표준 TCP/IP 포트로 재바인딩하여 즉시 해결 가능합니다.',
      symptomQuery: q,
      title: '🖨️ [Level 2 중급 수리] Windows 인쇄 스풀러(Spooler) 유령 큐 초기화 및 포트 재바인딩',
      rootCause:
        '눈(Eye) 스캔 결과: Windows Spooler 서비스에 응답 없는 손상된 스풀 파일(.SPL/.SHD) 4건이 큐를 가로막고 있으며 WSD 포트가 오프라인으로 잠겨 있습니다.',
      agentModuleName: 'Z-Eye_PC_Setup.exe (PowerShell Spooler & TCP/IP Port Reset)',
      systemCommandOrApi:
        'Stop-Service -Name Spooler -Force; Remove-Item "$env:SystemRoot\\System32\\spool\\PRINTERS\\*.*" -Force; Reset-PrinterPort -Mode StandardTCPIP; Start-Service -Name Spooler',
      beforeSnapshot: {
        service: 'Spooler',
        status: 'Stuck (4 Dead Jobs in PRINTERS)',
        portMode: 'WSD-Offline',
      },
      afterSnapshot: {
        service: 'Spooler',
        status: 'Running (Queue Cleared: 0 Jobs)',
        portMode: 'Standard_TCP_IP_Active',
      },
      completionMessage:
        '✅ [Level 2 중급 수리 완료] 멈춰 있던 Windows 인쇄 스풀러(Spooler) 대기열의 유령 문서 4건을 강제 삭제하고 프린터 포트를 표준 TCP/IP로 재기동하여 인쇄가 즉시 출력되도록 해결했습니다.',
      voiceTtsSummary:
        '멈춰 있던 프린터 인쇄 대기열을 깨끗이 비우고 인쇄 포트와 서비스를 다시 켜서 바로 출력되도록 수리했습니다.',
      creditCost: 300,
    };
  }

  if (resolvedId === 'pc_excel_overlay') {
    return {
      planId,
      presetId: 'pc_excel_overlay',
      platform: 'pc',
      track: 'TRACK_B_OVERLAY_GUIDE',
      difficultyLevel: 'LEVEL_2_INTERMEDIATE_300',
      difficultyBadgeKo: '🟡 Level 2 (중급 장치·네트워크·앱 가이드 - 300 코인)',
      feasibilityCheckKo:
        '✅ Z-Eye_PC_Setup.exe UI Automation 스캔 완료: 타사 프로그램 내부 메뉴 좌표를 실시간 추적하여 모니터 최상단 손가락 화살표 가이드로 안내 가능합니다.',
      symptomQuery: q,
      title: '👆 [Level 2 다단계 가이드] 타사 프로그램(엑셀·PC카톡) 모니터 최상단 손가락 화살표 동행 가이드',
      rootCause:
        '눈(Eye) UI Automation 스캔 완료: 타사 프로그램 내부 메뉴 좌표를 0.01초 만에 추출했습니다 ([보기(V) rect: 240,48] ➔ [틀 고정(F) rect: 520,96]). 모니터 최상단에 반투명 손가락 화살표를 띄워 안내합니다.',
      agentModuleName: 'Z-Eye_PC_Setup.exe (UI Automation & Topmost Overlay)',
      systemCommandOrApi:
        'Z-Eye_Overlay.DrawTopmostArrow(targetHwnd="EXCEL.EXE", coords=[[240,48],[520,96]])',
      beforeSnapshot: {
        overlayActive: false,
        targetApp: 'Microsoft Excel / KakaoTalk PC',
      },
      afterSnapshot: {
        overlayActive: true,
        guidedStepsCompleted: 2,
      },
      completionMessage:
        '✅ [Level 2 오버레이 가이드 가동] 모니터 최상단 투명 유리판(Overlay)에 빨간 손가락 화살표 가이드(👆)를 띄웠습니다! 화살표가 가리키는 순서대로 클릭만 하시면 됩니다.',
      voiceTtsSummary:
        '화면 위에 손가락 화살표를 띄워 드렸습니다. 먼저 오른쪽 위 보기 메뉴를 누르신 뒤 틀 고정을 눌러주세요.',
      creditCost: 300,
      overlaySteps: [
        {
          step: 1,
          screenTitle: 'PC 모니터 최상단 오버레이 (0.01초 UI Automation 좌표 인식 완료)',
          scrapedElements: [
            { text: '파일(F)', rect: [80, 48] },
            { text: '홈(H)', rect: [140, 48] },
            { text: '보기(V)', rect: [240, 48] },
            { text: '⚙️ 설정', rect: [920, 48] },
          ],
          fingerCoordPct: [38, 22],
          targetLabel: '상단 리본 메뉴 [보기(V)] (좌표 240, 48)',
          bubbleMessage: '👆 오른쪽 위 세 번째 [보기(V)] 메뉴를 누르세요!',
          voiceGuideText: '화살표가 가리키는 상단 보기 메뉴를 먼저 클릭해 주세요.',
        },
        {
          step: 2,
          screenTitle: '다음 화면 이동 감지 완료 ➔ 2단계 좌표 자동 추적',
          scrapedElements: [
            { text: '기본(N)', rect: [120, 96] },
            { text: '틀 고정(F)', rect: [520, 96] },
            { text: '첫 행 고정(R)', rect: [520, 148] },
          ],
          fingerCoordPct: [66, 56],
          targetLabel: '[틀 고정(F)] ➔ [첫 행 고정(R)] (좌표 520, 148)',
          bubbleMessage: '👆 이제 화살표가 가리키는 [첫 행 고정]을 누르시면 완료됩니다!',
          voiceGuideText: '이제 바로 아래에 열린 첫 행 고정 버튼을 누르시면 세팅이 끝납니다.',
        },
      ],
    };
  }

  // ─────────────── [PC Level 1 (단순 OS 설정 변경 - 100 코인)] ───────────────
  if (resolvedId === 'pc_laptop_lid') {
    return {
      planId,
      presetId: 'pc_laptop_lid',
      platform: 'pc',
      track: 'TRACK_A_DIRECT_REPAIR',
      difficultyLevel: 'LEVEL_1_SIMPLE_100',
      difficultyBadgeKo: '🟢 Level 1 (단순 OS 설정 변경 - 100 코인)',
      feasibilityCheckKo:
        '✅ Z-Eye_PC_Setup.exe 진단 완료: Windows PowerCfg 전원 구성표 1단계 명령으로 즉시 설정 변경 가능합니다.',
      symptomQuery: q,
      title: '🔋 [Level 1 단순 설정] 노트북 덮개(Lid) 닫음 시 절전 진입 방지 & 24시간 마스터 서버 유지',
      rootCause:
        '눈(Eye) 스캔 결과: 현재 Windows 전원 옵션(SUB_BUTTONS -> LIDACTION)이 AC 전원 연결 시에도 "절전(Sleep=1)"으로 설정되어 덮개를 닫으면 Z-Eye 서버가 중단됩니다.',
      agentModuleName: 'Z-Eye_PC_Setup.exe (Windows PowerCfg Engine)',
      systemCommandOrApi:
        'powercfg /setacvalueindex SCHEME_CURRENT SUB_BUTTONS LIDACTION 0; powercfg /setactive SCHEME_CURRENT',
      beforeSnapshot: {
        powerScheme: 'Balanced_Default',
        acLidCloseAction: 1,
        acLidCloseLabel: '절전(Sleep)',
      },
      afterSnapshot: {
        powerScheme: 'Z-Eye_Master_AlwaysOn',
        acLidCloseAction: 0,
        acLidCloseLabel: '아무 작업도 안 함 (서버 상시 가동)',
      },
      completionMessage:
        '✅ [Level 1 수리 완료] 노트북 덮개를 덮어도 전원이 꺼지거나 절전 모드로 들어가지 않고 Z-Eye 마스터 PC 서버가 24시간 내내 돌아가도록 설정했습니다.',
      voiceTtsSummary:
        '노트북 뚜껑을 덮어도 꺼지지 않고 계속 작동하도록 전원 설정을 변경했습니다.',
      creditCost: 100,
    };
  }

  if (resolvedId === 'pc_parent_display') {
    return {
      planId,
      presetId: 'pc_parent_display',
      platform: 'pc',
      track: 'TRACK_A_DIRECT_REPAIR',
      difficultyLevel: 'LEVEL_1_SIMPLE_100',
      difficultyBadgeKo: '🟢 Level 1 (단순 OS 설정 변경 - 100 코인)',
      feasibilityCheckKo:
        '✅ Z-Eye_PC_Setup.exe 진단 완료: 디스플레이 가독성 배율 및 청색광 필터 1단계 제어로 즉시 적용 가능합니다.',
      symptomQuery: q,
      title: '👀 [Level 1 단순 설정] 부모님 맞춤형 큰 글씨 배율(125%) & 청색광 차단 야간 보호 모드',
      rootCause:
        '눈(Eye) 스캔 결과: 모니터 DPI 텍스트 배율이 기본 100%(작은 글씨)로 되어 있고 야간 청색광 필터가 비활성화되어 눈 피로도가 높습니다.',
      agentModuleName: 'Z-Eye_PC_Setup.exe (Display DPI & Night Light Registry)',
      systemCommandOrApi:
        'Set-ItemProperty -Path "HKCU:\\Control Panel\\Desktop" -Name "LogPixels" -Value 120; Enable-NightLight -ColorTemp 3800K',
      beforeSnapshot: {
        dpiScalePercent: 100,
        nightLightEnabled: false,
        colorTempK: 6500,
      },
      afterSnapshot: {
        dpiScalePercent: 125,
        nightLightEnabled: true,
        colorTempK: 3800,
      },
      uiFontScalePercent: 112,
      uiNightProtection: true,
      completionMessage:
        '✅ [Level 1 수리 완료] 부모님께서 돋보기 없이도 시원하게 보실 수 있도록 화면 글자 크기를 키우고 따뜻한 색감의 야간 눈 보호 모드를 켰습니다.',
      voiceTtsSummary:
        '어르신께서 보시기 편하도록 글자 크기를 시원하게 키우고 눈 보호 모드를 켰습니다.',
      creditCost: 100,
    };
  }

  if (platform === 'pc') {
    return {
      planId,
      presetId: 'pc_boot_ads',
      platform: 'pc',
      track: 'TRACK_A_DIRECT_REPAIR',
      difficultyLevel: 'LEVEL_1_SIMPLE_100',
      difficultyBadgeKo: '🟢 Level 1 (단순 OS 설정 변경 - 100 코인)',
      feasibilityCheckKo:
        '✅ Z-Eye_PC_Setup.exe 진단 완료: 시작프로그램 레지스트리 Run 키 1단계 정리로 부팅 속도를 즉시 개선할 수 있습니다.',
      symptomQuery: q || '부팅 시 뜨는 광고/유령앱 차단 및 PC 속도 최적화',
      title: '🚀 [Level 1 단순 설정] 시작프로그램 광고·유령앱 7종 백그라운드 즉시 차단',
      rootCause:
        '눈(Eye) 스캔 결과: 레지스트리(HKCU\\...\\Run) 및 작업 스케줄러에 부팅 시 몰래 켜지는 광고 팝업 도우미·유령 업데이터 7개가 상주하여 부팅 시간을 37초 지연시키고 있습니다.',
      agentModuleName: 'Z-Eye_PC_Setup.exe (Registry Run & ScheduledTask Cleaner)',
      systemCommandOrApi:
        'Remove-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" -Name "AdPopupHelper","ShoppingToast","GhostUpdater" -Force',
      beforeSnapshot: {
        startupAppsCount: 14,
        ghostProcesses: [
          'AdPopupHelper.exe',
          'ShoppingToast.exe',
          'GhostUpdater.exe',
          'ToolbarInject.exe',
          'WebHelperService.exe',
          'ClipAdDaemon.exe',
          'SponsorTray.exe',
        ],
        bootTimeSec: 48.4,
      },
      afterSnapshot: {
        startupAppsCount: 7,
        ghostProcesses: [],
        bootTimeSec: 11.2,
      },
      completionMessage:
        '✅ [Level 1 수리 완료] 시작프로그램 중 불필요한 자동실행 앱 7개를 비활성화하여 부팅 속도를 48.4초 ➔ 11.2초로 높였습니다.',
      voiceTtsSummary:
        '컴퓨터를 켤 때 몰래 실행되던 광고 프로그램 일곱 개를 모두 차단해서 부팅 속도를 빠르게 고쳤습니다.',
      creditCost: 100,
    };
  }

  // ─────────────── [모바일 설정 몬스터 (단일 요금 100 코인)] ───────────────
  if (resolvedId === 'mobile_kakao_overlay') {
    return {
      planId,
      presetId: 'mobile_kakao_overlay',
      platform: 'mobile',
      track: 'TRACK_B_OVERLAY_GUIDE',
      difficultyLevel: 'LEVEL_1_SIMPLE_100',
      difficultyBadgeKo: '🟢 모바일 단일 요금 (100 코인 · 실패 시 100% 환불)',
      feasibilityCheckKo:
        '✅ 1MB APK 진단 완료: 타사 앱 Deep Link 이동 및 최상단 손가락 화살표 오버레이 가이드가 즉시 작동합니다.',
      symptomQuery: q,
      title: '👆 타사 앱(카카오톡·유튜브) 딥링크 순간이동 + 실시간 플로팅 손가락 화살표 가이드',
      rootCause:
        '보안상 백그라운드에서 타사 앱 내부 스위치를 대신 누를 수 없으므로, 해당 설정 화면으로 즉시 순간이동(Deep Link)한 뒤 APK가 화면 좌표([{text:"설정", rect:[980,120]}])를 0.01초 만에 읽어 최상단 투명 유리판(SYSTEM_ALERT_WINDOW)에 손가락 화살표를 띄웁니다.',
      agentModuleName: 'Z-Eye_Mobile_1MB.apk (DeepLink + SYSTEM_ALERT_WINDOW Overlay)',
      systemCommandOrApi:
        'Intent.ACTION_VIEW("kakaotalk://settings/notifications") + WindowManager.addView(FloatingFingerOverlay)',
      beforeSnapshot: {
        targetPackage: 'com.kakao.talk',
        deepLinkLaunched: false,
        overlayWindowAttached: false,
      },
      afterSnapshot: {
        targetPackage: 'com.kakao.talk',
        deepLinkLaunched: true,
        overlayWindowAttached: true,
        guidedCoords: [
          { text: '설정(톱니바퀴)', rect: [980, 120] },
          { text: '메시지 알림음', rect: [840, 560] },
        ],
      },
      completionMessage:
        '✅ 카카오톡 설정 화면으로 순간이동 후, 화면 최상단 투명 유리판(Overlay)에 빨간 손가락 화살표(👆)와 음성 안내를 띄웠습니다!',
      voiceTtsSummary:
        '카카오톡 화면 오른쪽 위 톱니바퀴를 누르신 뒤, 세 번째 알림 스위치를 꺼주세요.',
      creditCost: 100,
      overlaySteps: [
        {
          step: 1,
          screenTitle: '카카오톡 메인 화면 (APK 눈이 0.01초 만에 좌표 [{text:"설정", rect:[980,120]}] 추출)',
          scrapedElements: [
            { text: '친구', rect: [140, 120] },
            { text: '🔍 검색', rect: [820, 120] },
            { text: '⚙️ 설정', rect: [980, 120] },
          ],
          fingerCoordPct: [84, 18],
          targetLabel: '⚙️ 오른쪽 위 톱니바퀴 [설정] (좌표 980, 120)',
          bubbleMessage: '👆 오른쪽 위 톱니바퀴를 누르세요!',
          voiceGuideText: '오른쪽 위에 있는 톱니바퀴 모양 버튼을 눌러주세요.',
        },
        {
          step: 2,
          screenTitle: '카카오톡 > 설정 > 알림 화면 (다음 화면 이동 즉시 좌표 자동 갱신)',
          scrapedElements: [
            { text: '공지사항', rect: [220, 260] },
            { text: '개인/보안', rect: [220, 410] },
            { text: '🔔 알림 스위치', rect: [840, 560] },
          ],
          fingerCoordPct: [78, 60],
          targetLabel: '🔔 세 번째 [알림] 스위치 (좌표 840, 560)',
          bubbleMessage: '👆 세 번째 [알림] 스위치를 끄세요!',
          voiceGuideText: '세 번째 줄에 있는 알림 스위치를 눌러 꺼주시면 완료됩니다.',
        },
      ],
    };
  }

  if (resolvedId === 'mobile_evening_dnd') {
    return {
      planId,
      presetId: 'mobile_evening_dnd',
      platform: 'mobile',
      track: 'TRACK_A_DIRECT_REPAIR',
      difficultyLevel: 'LEVEL_1_SIMPLE_100',
      difficultyBadgeKo: '🟢 모바일 단일 요금 (100 코인 · 실패 시 100% 환불)',
      feasibilityCheckKo:
        '✅ 1MB APK 진단 완료: NotificationPolicy API를 통해 저녁 운동 시간대 자동 무음 규칙을 직접 세팅할 수 있습니다.',
      symptomQuery: q,
      title: '🔕 저녁 7시~8시 운동 시간대 자동 방해금지(DND) 스케줄 백그라운드 직접 세팅',
      rootCause:
        '눈(Eye) 진단 결과: 현재 스마트폰 NotificationPolicy에 저녁 운동 시간대 자동 무음 규칙(AutomaticZenRule)이 등록되어 있지 않아 운동 중 단체방·스팸 알림이 계속 울립니다.',
      agentModuleName: 'Z-Eye_Mobile_1MB.apk (NotificationManager Policy API)',
      systemCommandOrApi:
        'NotificationManager.addAutomaticZenRule(ZenRule(name="저녁 운동 집중", time="19:00-20:00", allowStarredFamily=true))',
      beforeSnapshot: {
        zenModeSchedule: 'None (24h All Alerts Active)',
        evening19to20RingVolume: 12,
        familyBypassStarred: false,
      },
      afterSnapshot: {
        zenModeSchedule: 'Daily 19:00 ~ 20:00 Auto Silence',
        evening19to20RingVolume: 0,
        familyBypassStarred: true,
      },
      completionMessage:
        '✅ 처치 완료! 매일 저녁 7시~8시 운동 시간에는 카톡·쇼핑앱·일반 전화 소리가 자동으로 울리지 않도록 스마트폰 시스템 방해금지 스케줄을 직접 세팅했습니다 (긴급 가족 연락처만 예외 허용).',
      voiceTtsSummary:
        '운동하시는 저녁 일곱 시부터 여덟 시까지는 카톡과 일반 전화 소리가 나지 않도록 스마트폰 설정을 직접 바꿔 드렸습니다.',
      creditCost: 100,
    };
  }

  if (resolvedId === 'mobile_zombie_sleep') {
    return {
      planId,
      presetId: 'mobile_zombie_sleep',
      platform: 'mobile',
      track: 'TRACK_A_DIRECT_REPAIR',
      difficultyLevel: 'LEVEL_1_SIMPLE_100',
      difficultyBadgeKo: '🟢 모바일 단일 요금 (100 코인 · 실패 시 100% 환불)',
      feasibilityCheckKo:
        '✅ 1MB APK 진단 완료: UsageStatsManager 미사용 앱 15개를 초절전 버킷으로 즉시 격리 가능합니다.',
      symptomQuery: q,
      title: '🔋 배터리를 20% 갉아먹는 미사용 유령앱 15개 초절전(Deep Sleep) 일괄 격리',
      rootCause:
        '눈(Eye) UsageStatsManager 분석 결과: 최근 30일 동안 한 번도 열지 않은 앱 15개가 백그라운드에서 위치·네트워크 WakeLock을 잡고 배터리의 20.4%를 소모 중입니다.',
      agentModuleName: 'Z-Eye_Mobile_1MB.apk (UsageStats & AppStandby Controller)',
      systemCommandOrApi:
        'UsageStatsManager.setAppStandbyBuckets(unused15Packages, STANDBY_BUCKET_RESTRICTED)',
      beforeSnapshot: {
        backgroundActiveUnusedApps: 15,
        dailyBatteryDrainPct: 20.4,
        wakeLockStatus: 'Unrestricted',
      },
      afterSnapshot: {
        backgroundActiveUnusedApps: 0,
        dailyBatteryDrainPct: 1.2,
        wakeLockStatus: 'DeepSleep_Restricted (15 Apps)',
      },
      completionMessage:
        '✅ 처치 완료! 안 쓰는 앱 15개의 백그라운드 배터리 소모를 즉시 차단하여 하루 배터리 지속 시간을 약 3시간 40분 늘렸습니다.',
      voiceTtsSummary:
        '뒤에서 몰래 배터리를 쓰던 안 쓰는 앱 열다섯 개를 모두 절전 상태로 묶어 배터리가 오래 가도록 조치했습니다.',
      creditCost: 100,
    };
  }

  return {
    planId,
    presetId: 'mobile_font_eye',
    platform: 'mobile',
    track: 'TRACK_A_DIRECT_REPAIR',
    difficultyLevel: 'LEVEL_1_SIMPLE_100',
    difficultyBadgeKo: '🟢 모바일 단일 요금 (100 코인 · 실패 시 100% 환불)',
    feasibilityCheckKo:
      '✅ 1MB APK 진단 완료: 시스템 글자 배율(FONT_SCALE) 및 블루라이트 차단 필터를 백그라운드에서 즉시 적용할 수 있습니다.',
    symptomQuery: q || '글씨가 너무 작아서 눈이 침침해, 글씨 키우고 눈 보호 모드 켜줘',
    title: '👀 스마트폰 시스템 글자 크기 135% 확대 & 야간 블루라이트 차단 직접 세팅',
    rootCause:
      '눈(Eye) 진단 결과: 시스템 글자 배율(FONT_SCALE=1.0)이 작게 설정되어 있고 야간 눈 보호 모드가 꺼져 있어 야간 유튜브·카톡 열람 시 시력 피로가 발생합니다.',
    agentModuleName: 'Z-Eye_Mobile_1MB.apk (android.provider.Settings.System.WRITE_SETTINGS)',
    systemCommandOrApi:
      'Settings.System.putFloat(FONT_SCALE, 1.35f); Settings.Secure.putInt(NIGHT_DISPLAY_ACTIVATED, 1)',
    beforeSnapshot: {
      fontScale: 1.0,
      screenZoomDpi: 'Default (420dpi)',
      nightEyeShield: false,
    },
    afterSnapshot: {
      fontScale: 1.35,
      screenZoomDpi: 'Large (540dpi)',
      nightEyeShield: true,
    },
    uiFontScalePercent: 112,
    uiNightProtection: true,
    completionMessage:
      '✅ 처치 완료! 스마트폰 시스템 글자 크기를 135%로 시원하게 키우고 눈이 침침하지 않도록 블루라이트 차단 눈 보호 모드를 즉시 켰습니다.',
    voiceTtsSummary:
      '눈이 편하시도록 스마트폰 글자 크기를 시원하게 키우고 눈 보호 모드를 바로 켜 드렸습니다.',
    creditCost: 100,
  };
}
