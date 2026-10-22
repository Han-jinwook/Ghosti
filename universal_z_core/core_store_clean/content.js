/**
 * Merlin Z-Core (Track A: Store Clean Edition) - Content Script
 * - 일반 소비자용 스토어 안전 가이드 및 자막/화면 텍스트 읽기 보조
 * - 무인 자동 제출(Bot) 대신 유저가 마지막 1-Tap을 직접 수행하는 Zero-Auto-Action 원칙 준수
 */

(() => {
  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || event.data.source !== 'MERLIN_WEB_APP') {
      return;
    }

    const { requestId, action, payload } = event.data;
    chrome.runtime.sendMessage({ action, payload }, (response) => {
      window.postMessage(
        {
          source: 'MERLIN_Z_CORE_CLEAN',
          requestId,
          response,
        },
        '*'
      );
    });
  });
})();
