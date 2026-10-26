import type { CapacitorConfig } from '@capacitor/cli';

/**
 * 제트아이 (Z-Eye) 양대 스토어 네이티브 래퍼 설정
 * - 웹 빌드 결과물(dist)을 그대로 앱에 탑재합니다 (`npm run build` → `npx cap sync`).
 * - 네이티브 구동 시 `window.Capacitor.isNativePlatform()`이 true가 되어
 *   스토어 심사 클린 모드(isStoreAppMode = true, 코인·외부결제 노출 0%)가 자동 활성화됩니다 (useSaySeeStore 초기값).
 * - allowNavigation: 푸시 동적 라우팅(nativePushRouter)의 화이트리스트와 동일하게 *.sundreamer.app 만 웹뷰 내 이동 허용.
 */
const config: CapacitorConfig = {
  appId: 'app.sundreamer.zeye',
  appName: 'Z-Eye',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    allowNavigation: ['sundreamer.app', '*.sundreamer.app'],
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
