import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import {
  GHOSTI_LOGOUT_LOCK_UNTIL_KEY,
  clearGhostiSupabaseSession,
  purgeAllGhostiLocalAuthArtifacts,
} from '@shared/services/supabaseClient';

if (typeof window !== 'undefined') {
  try {
    const pendingLogoutLockUntil = Number(localStorage.getItem(GHOSTI_LOGOUT_LOCK_UNTIL_KEY) || 0);
    if (pendingLogoutLockUntil > 0) {
      if (Date.now() <= pendingLogoutLockUntil) {
        purgeAllGhostiLocalAuthArtifacts({ clearLogoutLock: true });
      } else {
        localStorage.removeItem(GHOSTI_LOGOUT_LOCK_UNTIL_KEY);
      }
    } else if (
      localStorage.getItem('merlin_logged_out') === '1' &&
      !(localStorage.getItem('merlin_session_token') || '').trim()
    ) {
      clearGhostiSupabaseSession();
    }

    const storedHubSession = (localStorage.getItem('merlin_session_token') || '').trim();
    if (storedHubSession && !storedHubSession.includes('.') && /^[a-f0-9]{28,48}$/i.test(storedHubSession)) {
      localStorage.removeItem('merlin_session_token');
      document.cookie = 'merlin_session_token=; path=/; max-age=0;';
    }
  } catch {
    /* ignore URL/storage guard error */
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        void reg.update();
      })
      .catch(() => {
        /* ignore sw error in dev */
      });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
