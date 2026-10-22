/**
 * Merlin Z-Core (Track B: Power Agent CDP Edition) - Content Script
 * - 중첩 Shadow DOM 및 iframe 내부 요소 정밀 탐색 (pierceShadowDOM)
 * - 리치 텍스트(HTML) 및 일반 텍스트 클립보드 주입 헬퍼 (trustedPaste 연동)
 * - 페이지 내 스크립트(window.postMessage)와 Background CDP 엔진 간 브릿지
 */

(() => {
  /**
   * 중첩된 Shadow Root 및 동일 출처 iframe 내부까지 재귀 탐색하여 요소 리스트를 반환합니다.
   */
  function querySelectorAllDeep(selector, root = document) {
    const results = [];

    function traverse(node) {
      if (!node) return;
      try {
        if (node.querySelectorAll) {
          const matched = node.querySelectorAll(selector);
          for (const el of matched) {
            results.push(el);
          }
        }
      } catch (_e) {
        // 특수 셀렉터 예외 무시
      }

      const children = node.querySelectorAll ? node.querySelectorAll('*') : [];
      for (const el of children) {
        if (el.shadowRoot) {
          traverse(el.shadowRoot);
        }
        if (el.tagName === 'IFRAME') {
          try {
            if (el.contentDocument) {
              traverse(el.contentDocument);
            }
          } catch (_err) {
            // Cross-origin iframe은 all_frames content_script가 별도 처리
          }
        }
      }
    }

    traverse(root);
    return results;
  }

  function getElementMetadata(el) {
    if (!el) return null;
    el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    const rect = el.getBoundingClientRect();
    return {
      found: true,
      tagName: el.tagName,
      id: el.id || '',
      className: typeof el.className === 'string' ? el.className : '',
      text: (el.innerText || el.textContent || el.value || '').trim().slice(0, 500),
      x: Math.round(rect.left + rect.width / 2),
      y: Math.round(rect.top + rect.height / 2),
      rect: {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
    };
  }

  async function writeRichClipboard({ text = '', html = '' }) {
    try {
      if (html && typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        const itemData = {
          'text/plain': new Blob([text || html.replace(/<[^>]+>/g, '')], { type: 'text/plain' }),
          'text/html': new Blob([html], { type: 'text/html' }),
        };
        await navigator.clipboard.write([new ClipboardItem(itemData)]);
        return { ok: true, mode: 'rich_html' };
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return { ok: true, mode: 'plain_text' };
      }
    } catch (_err) {
      // Fallback: textarea + copy event
    }

    return new Promise((resolve) => {
      const listener = (e) => {
        e.preventDefault();
        if (e.clipboardData) {
          if (html) e.clipboardData.setData('text/html', html);
          e.clipboardData.setData('text/plain', text || html.replace(/<[^>]+>/g, ''));
        }
      };
      document.addEventListener('copy', listener, { once: true });
      document.execCommand('copy');
      document.removeEventListener('copy', listener);
      resolve({ ok: true, mode: 'execCommand_fallback' });
    });
  }

  // 전역 헬퍼 노출 (scripting.executeScript에서도 직접 호출 가능)
  window.__MerlinZCore = {
    querySelectorAllDeep,
    pierceShadowDOM(selector, index = 0) {
      const list = querySelectorAllDeep(selector);
      const target = list[index] || null;
      if (!target) {
        return { found: false, count: 0, selector };
      }
      return {
        ...getElementMetadata(target),
        count: list.length,
      };
    },
    writeRichClipboard,
  };

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || !msg.type) return false;

    if (msg.type === 'Z_CORE_PIERCE_SHADOW_DOM') {
      const res = window.__MerlinZCore.pierceShadowDOM(msg.selector, msg.index || 0);
      sendResponse(res);
      return true;
    }

    if (msg.type === 'Z_CORE_WRITE_CLIPBOARD') {
      writeRichClipboard({ text: msg.text || '', html: msg.html || '' })
        .then((res) => sendResponse(res))
        .catch((err) => sendResponse({ ok: false, error: String(err) }));
      return true;
    }

    return false;
  });

  // 웹페이지 스크립트에서 직접 호출할 수 있는 postMessage 브릿지
  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || event.data.source !== 'MERLIN_AGENT_CLIENT') {
      return;
    }
    const { requestId, command, params } = event.data;
    chrome.runtime.sendMessage({ command, params }, (response) => {
      window.postMessage(
        {
          source: 'MERLIN_Z_CORE_POWER',
          requestId,
          response,
        },
        '*'
      );
    });
  });
})();
