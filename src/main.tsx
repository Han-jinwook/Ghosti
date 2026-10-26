import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { initNativePushRouter } from './services/nativePushRouter';

// Register PWA Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* ignore sw error in dev */
    });
  });
}

// [스토어 앱] 네이티브(Capacitor) 구동 시에만 패밀리 공용 동적 푸시 라우팅 초기화 (웹에서는 즉시 반환)
void initNativePushRouter();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
