/**
 * Merlin Z-Core (Track A: Store Clean Edition) - Background Service Worker
 * - 스토어 심사 리젝 사유가 되는 chrome.debugger 권한을 원천 배제한 100% 안전 버전
 * - 로컬 네이티브 데몬(Merlin_Z_Core.exe / http://127.0.0.1:5199/__merlin/query)과 안전하게 통신
 */

const LOCAL_NATIVE_CORE_URL = 'http://127.0.0.1:5199/__merlin/query';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || !message.action) return false;

  if (message.action === 'Z_CORE_CLEAN_PING') {
    sendResponse({
      ok: true,
      edition: 'core_store_clean',
      version: '1.0.0',
      storeSafe: true,
    });
    return true;
  }

  if (message.action === 'Z_CORE_NATIVE_QUERY') {
    fetch(LOCAL_NATIVE_CORE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message.payload || {}),
    })
      .then((res) => res.json())
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) =>
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        })
      );
    return true;
  }

  return false;
});
