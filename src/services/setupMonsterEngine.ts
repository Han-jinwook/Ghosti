import type {
  SetupDiagnosisPlan,
  SetupMonsterPlatform,
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
  query: string;
}

export const PC_SYMPTOM_CHIPS: SetupSymptomChip[] = [
  {
    id: 'pc_boot_ads',
    platform: 'pc',
    label: '🚀 부팅 시 뜨는 광고/유령앱 차단',
    trackBadge: 'Track A · 1초 자동 수리',
    query: '부팅할 때마다 뜨는 광고 팝업이랑 느려지게 만드는 유령 시작프로그램 싹 차단해줘',
  },
  {
    id: 'pc_printer_spooler',
    platform: 'pc',
    label: '🖨️ 프린터 인쇄 먹통 1초 해결',
    trackBadge: 'Track A · 1초 자동 수리',
    query: '프린터가 대기 중으로만 뜨고 인쇄가 먹통인데 1초 만에 고쳐줘',
  },
  {
    id: 'pc_laptop_lid',
    platform: 'pc',
    label: '🔋 노트북 덮어도 안 꺼지게 설정',
    trackBadge: 'Track A · 1초 자동 수리',
    query: '노트북 뚜껑 덮어도 절전으로 안 꺼지고 마스터 서버 계속 돌아가게 설정해줘',
  },
  {
    id: 'pc_parent_display',
    platform: 'pc',
    label: '👀 부모님용 큰 글씨/야간모드',
    trackBadge: 'Track A · 1초 자동 수리',
    query: '부모님 보시기 편하게 PC 화면 글씨 크기 키우고 눈 안 부시게 야간모드 켜줘',
  },
  {
    id: 'pc_work_s_drive',
    platform: 'pc',
    label: '💽 업무 라운지 S: 드라이브 연결 복구',
    trackBadge: 'Track A · 1초 자동 수리',
    query: '윈도우 탐색기에서 업무 라운지 S: 드라이브 연결이 풀렸는데 즉시 복구해줘',
  },
  {
    id: 'pc_excel_overlay',
    platform: 'pc',
    label: '👆 엑셀·PC카톡 내부 기능 (손가락 가이드)',
    trackBadge: 'Track B · 모니터 오버레이',
    query: '엑셀에서 스크롤 내려도 첫 줄 고정하는 거랑 PC카톡 알림 끄는 위치 손가락 화살표로 짚어줘',
  },
];

export const MOBILE_SYMPTOM_CHIPS: SetupSymptomChip[] = [
  {
    id: 'mobile_evening_dnd',
    platform: 'mobile',
    label: '🔕 저녁 7~8시 운동 시간 무음 스케줄',
    trackBadge: '시스템 직접 변경',
    query: '운동하는 저녁 7~8시엔 카톡이나 전화 소리 안 나게 해줘',
  },
  {
    id: 'mobile_font_eye',
    platform: 'mobile',
    label: '👀 침침한 눈 큰 글씨 & 블루라이트 차단',
    trackBadge: '시스템 직접 변경',
    query: '글씨가 너무 작아서 눈이 침침해, 글씨 키우고 눈 보호 모드 켜줘',
  },
  {
    id: 'mobile_zombie_sleep',
    platform: 'mobile',
    label: '🔋 미사용 앱 15개 배터리 소모 차단',
    trackBadge: '시스템 직접 변경',
    query: '안 쓰는 앱 15개 배터리 빨리 안 닳게 초절전으로 묶어줘',
  },
  {
    id: 'mobile_kakao_overlay',
    platform: 'mobile',
    label: '👆 카톡·유튜브 앱 내부 설정 (손가락 동행 가이드)',
    trackBadge: '실시간 오버레이 👆',
    query: '카톡 앱 안에서 알림 소리 끄는 버튼 위치를 화면 위 손가락 화살표로 직접 짚어줘',
  },
];

export function buildSetupDiagnosisPlan(
  platform: SetupMonsterPlatform,
  rawQuery: string,
  presetIdHint?: string
): SetupDiagnosisPlan {
  const q = rawQuery.trim();
  const lower = q.toLowerCase();
  const planId = `plan_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  // 1) PC 프리셋 및 자연어 매칭
  if (
    presetIdHint === 'pc_printer_spooler' ||
    (platform === 'pc' && /프린터|인쇄|스풀러|출력|먹통/.test(lower))
  ) {
    return {
      planId,
      presetId: 'pc_printer_spooler',
      platform: 'pc',
      track: 'TRACK_A_DIRECT_REPAIR',
      symptomQuery: q,
      title: '🖨️ Windows 인쇄 스풀러(Spooler) 유령 큐 초기화 및 포트 1초 복구',
      rootCause:
        '눈(Eye) 스캔 결과: Windows Spooler 서비스에 응답 없는 손상된 스풀 파일(.SPL/.SHD) 4건이 큐를 가로막고 있으며 WSD 포트가 오프라인으로 잠겨 있습니다.',
      agentModuleName: 'Z-Eye_PC_Setup.exe (PowerShell & Service Control)',
      systemCommandOrApi:
        'Stop-Service -Name Spooler -Force; Remove-Item "$env:SystemRoot\\System32\\spool\\PRINTERS\\*.*" -Force; Start-Service -Name Spooler',
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
        '✅ 수리 완료! 멈춰 있던 Windows 인쇄 스풀러(Spooler) 대기열의 유령 문서 4건을 강제 삭제하고 서비스를 재기동하여 프린터 인쇄가 즉시 출력되도록 해결했습니다.',
      voiceTtsSummary:
        '멈춰 있던 프린터 인쇄 대기열을 깨끗이 비우고 인쇄 서비스를 다시 켜서 바로 출력되도록 수리했습니다.',
      creditCost: 100,
    };
  }

  if (
    presetIdHint === 'pc_laptop_lid' ||
    (platform === 'pc' && /노트북|뚜껑|덮개|덮어도|절전/.test(lower))
  ) {
    return {
      planId,
      presetId: 'pc_laptop_lid',
      platform: 'pc',
      track: 'TRACK_A_DIRECT_REPAIR',
      symptomQuery: q,
      title: '🔋 노트북 덮개(Lid) 닫음 시 절전 진입 방지 & 24시간 마스터 서버 유지',
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
        '✅ 수리 완료! 노트북 덮개를 덮어도 전원이 꺼지거나 절전 모드로 들어가지 않고 Z-Eye 마스터 PC 서버가 24시간 내내 돌아가도록 설정했습니다.',
      voiceTtsSummary:
        '노트북 뚜껑을 덮어도 꺼지지 않고 계속 작동하도록 전원 설정을 변경했습니다.',
      creditCost: 100,
    };
  }

  if (
    presetIdHint === 'pc_work_s_drive' ||
    (platform === 'pc' && /s:|드라이브|탐색기|마운트|업무/.test(lower))
  ) {
    return {
      planId,
      presetId: 'pc_work_s_drive',
      platform: 'pc',
      track: 'TRACK_A_DIRECT_REPAIR',
      symptomQuery: q,
      title: '💽 윈도우 탐색기 업무 드라이브(S:) 자동 재마운트 & File Lock 브릿지 복구',
      rootCause:
        '눈(Eye) 스캔 결과: Windows 네트워크 자격 증명 세션 만료로 인해 가상 드라이브(S:) 매핑이 끊어져 탐색기에서 보이지 않는 상태입니다.',
      agentModuleName: 'Z-Eye_PC_Setup.exe (Virtual Drive & SMB Bridge)',
      systemCommandOrApi:
        'net use S: /delete /y; net use S: "\\\\127.0.0.1\\Z-Eye_Work_Vault" /persistent:yes',
      beforeSnapshot: {
        driveLetter: 'S:',
        mounted: false,
        smbSessionState: 'Expired',
      },
      afterSnapshot: {
        driveLetter: 'S:',
        mounted: true,
        smbSessionState: 'Connected (Persistent)',
      },
      completionMessage:
        '✅ 수리 완료! 내 PC 윈도우 탐색기에 [업무 드라이브(S:)]를 즉시 재연결하고 팀원 동시 편집 충돌 방지(File Lock) 감시를 활성화했습니다.',
      voiceTtsSummary:
        '윈도우 탐색기에 업무용 S 드라이브를 다시 연결해 두었습니다.',
      creditCost: 100,
    };
  }

  if (
    presetIdHint === 'pc_parent_display' ||
    (platform === 'pc' && /글씨|크게|부모님|야간|눈/.test(lower))
  ) {
    return {
      planId,
      presetId: 'pc_parent_display',
      platform: 'pc',
      track: 'TRACK_A_DIRECT_REPAIR',
      symptomQuery: q,
      title: '👀 부모님 맞춤형 큰 글씨 배율(125%) & 청색광 차단 야간 보호 모드 적용',
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
        '✅ 수리 완료! 부모님께서 돋보기 없이도 시원하게 보실 수 있도록 화면 글자 크기를 키우고 따뜻한 색감의 야간 눈 보호 모드를 켰습니다.',
      voiceTtsSummary:
        '어르신께서 보시기 편하도록 글자 크기를 시원하게 키우고 눈 보호 모드를 켰습니다.',
      creditCost: 100,
    };
  }

  if (
    presetIdHint === 'pc_excel_overlay' ||
    (platform === 'pc' && /엑셀|한글|카톡|카카오톡|틀고정|손가락|어디/.test(lower))
  ) {
    return {
      planId,
      presetId: 'pc_excel_overlay',
      platform: 'pc',
      track: 'TRACK_B_OVERLAY_GUIDE',
      symptomQuery: q,
      title: '👆 타사 프로그램(엑셀·PC카톡) 모니터 최상단 손가락 화살표 동행 가이드',
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
        '✅ 모니터 최상단 투명 유리판(Overlay)에 빨간 손가락 화살표 가이드(👆)를 띄웠습니다! 화살표가 가리키는 순서대로 클릭만 하시면 됩니다.',
      voiceTtsSummary:
        '화면 위에 손가락 화살표를 띄워 드렸습니다. 먼저 오른쪽 위 보기 메뉴를 누르신 뒤 틀 고정을 눌러주세요.',
      creditCost: 100,
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

  if (platform === 'pc') {
    return {
      planId,
      presetId: 'pc_boot_ads',
      platform: 'pc',
      track: 'TRACK_A_DIRECT_REPAIR',
      symptomQuery: q || '부팅 시 뜨는 광고/유령앱 차단 및 PC 속도 최적화',
      title: '🚀 시작프로그램 광고·유령앱 7종 백그라운드 즉시 차단 (1초 수리기사)',
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
          ' SponsorTray.exe',
        ],
        bootTimeSec: 48.4,
      },
      afterSnapshot: {
        startupAppsCount: 7,
        ghostProcesses: [],
        bootTimeSec: 11.2,
      },
      completionMessage:
        '✅ 수리 완료! 시작프로그램 중 불필요한 자동실행 앱 7개를 비활성화하여 부팅 속도를 48.4초 ➔ 11.2초로 높였습니다.',
      voiceTtsSummary:
        '컴퓨터를 켤 때 몰래 실행되던 광고 프로그램 일곱 개를 모두 차단해서 부팅 속도를 빠르게 고쳤습니다.',
      creditCost: 100,
    };
  }

  // 2) 모바일 프리셋 및 자연어 매칭
  if (
    presetIdHint === 'mobile_kakao_overlay' ||
    /손가락|화살표|짚어|오버레이|유튜브|앱 안|어디/.test(lower)
  ) {
    return {
      planId,
      presetId: 'mobile_kakao_overlay',
      platform: 'mobile',
      track: 'TRACK_B_OVERLAY_GUIDE',
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

  if (
    presetIdHint === 'mobile_evening_dnd' ||
    /운동|저녁|7시|8시|방해금지|소리 안|무음|알림/.test(lower)
  ) {
    return {
      planId,
      presetId: 'mobile_evening_dnd',
      platform: 'mobile',
      track: 'TRACK_A_DIRECT_REPAIR',
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

  if (
    presetIdHint === 'mobile_zombie_sleep' ||
    /배터리|15개|절전|안 쓰는 앱/.test(lower)
  ) {
    return {
      planId,
      presetId: 'mobile_zombie_sleep',
      platform: 'mobile',
      track: 'TRACK_A_DIRECT_REPAIR',
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
