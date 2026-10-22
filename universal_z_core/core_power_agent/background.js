/**
 * Merlin Z-Core (Track B: Power Agent CDP Edition) - Background Service Worker
 * - 크롬(Chrome), 엣지(Edge), 네이버 웨일(Whale), 브레이브(Brave) 100% 호환 MV3 규격
 * - chrome.debugger (CDP 1.3) 기반 물리 신호(isTrusted: true) 4대 핵심 API 탑재:
 *   1. trustedClick(params)      : Input.dispatchMouseEvent 물리 마우스 이동·클릭
 *   2. trustedType(params)       : Input.dispatchKeyEvent + Input.insertText 물리 타이핑
 *   3. trustedKey(params)        : 엔터/탭/방향키/단축키 물리 키 입력
 *   4. trustedPaste(params)      : 리치 HTML/텍스트 클립보드 주입 후 CDP Ctrl+V 발사
 *   5. pierceShadowDOM(params)   : 중첩 Shadow DOM 및 iframe 내부 요소 좌표/텍스트 탐색
 * - 로컬 브릿지 서버(http://127.0.0.1:5198)와 자동 폴링 연동되어 외부 Python/Node.js 에이전트 명령 즉시 수행
 */

const CDP_VERSION = '1.3';
const BRIDGE_BASE_URL = 'http://127.0.0.1:5198';
const attachedTabs = new Set();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ============================================================================
// 1. CDP 세션 관리 및 명령 전송 래퍼
// ============================================================================
async function resolveTargetTabId(explicitTabId) {
  if (explicitTabId && typeof explicitTabId === 'number') {
    return explicitTabId;
  }
  const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (activeTab?.id) return activeTab.id;
  const allTabs = await chrome.tabs.query({});
  const validTab = allTabs.find((t) => t.id && t.url && !t.url.startsWith('chrome://'));
  if (!validTab?.id) {
    throw new Error('제어할 활성 브라우저 탭을 찾을 수 없습니다.');
  }
  return validTab.id;
}

async function ensureDebuggerAttached(tabId) {
  if (attachedTabs.has(tabId)) return;
  try {
    await chrome.debugger.attach({ tabId }, CDP_VERSION);
    attachedTabs.add(tabId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Already attached') || msg.includes('already attached')) {
      attachedTabs.add(tabId);
      return;
    }
    throw err;
  }
}

chrome.debugger.onDetach.addListener((source) => {
  if (source?.tabId) {
    attachedTabs.delete(source.tabId);
  }
});

async function sendCdpCommand(tabId, method, commandParams = {}) {
  await ensureDebuggerAttached(tabId);
  return chrome.debugger.sendCommand({ tabId }, method, commandParams);
}

// ============================================================================
// 2. 핵심 API 1: pierceShadowDOM (중첩 Shadow DOM & iframe 탐색기)
// ============================================================================
async function pierceShadowDOM({ tabId, selector, index = 0 }) {
  const targetTabId = await resolveTargetTabId(tabId);
  const frameResults = await chrome.scripting.executeScript({
    target: { tabId: targetTabId, allFrames: true },
    func: (sel, idx) => {
      if (window.__MerlinZCore && typeof window.__MerlinZCore.pierceShadowDOM === 'function') {
        return window.__MerlinZCore.pierceShadowDOM(sel, idx);
      }
      const el = document.querySelector(sel);
      if (!el) return { found: false, count: 0, selector: sel };
      el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
      const rect = el.getBoundingClientRect();
      return {
        found: true,
        count: 1,
        tagName: el.tagName,
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
    },
    args: [selector, index],
  });

  for (const frame of frameResults) {
    if (frame?.result?.found) {
      return {
        ok: true,
        tabId: targetTabId,
        frameId: frame.frameId,
        ...frame.result,
      };
    }
  }

  return {
    ok: false,
    tabId: targetTabId,
    found: false,
    selector,
    error: `요소를 찾지 못했습니다: ${selector}`,
  };
}

// ============================================================================
// 3. 핵심 API 2: trustedClick (CDP Input.dispatchMouseEvent 물리 클릭)
// ============================================================================
async function trustedClick({
  tabId,
  x,
  y,
  selector,
  index = 0,
  button = 'left',
  clickCount = 1,
}) {
  const targetTabId = await resolveTargetTabId(tabId);
  let clickX = x;
  let clickY = y;
  let matchedElement = null;

  if (selector && (typeof clickX !== 'number' || typeof clickY !== 'number')) {
    const found = await pierceShadowDOM({ tabId: targetTabId, selector, index });
    if (!found.ok || !found.found) {
      return found;
    }
    clickX = found.x;
    clickY = found.y;
    matchedElement = found;
  }

  if (typeof clickX !== 'number' || typeof clickY !== 'number') {
    throw new Error('trustedClick 호출 시 (x, y) 좌표 또는 selector가 필요합니다.');
  }

  await sendCdpCommand(targetTabId, 'Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: clickX,
    y: clickY,
  });
  await sleep(25);

  await sendCdpCommand(targetTabId, 'Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: clickX,
    y: clickY,
    button,
    buttons: 1,
    clickCount,
  });
  await sleep(35);

  await sendCdpCommand(targetTabId, 'Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: clickX,
    y: clickY,
    button,
    buttons: 0,
    clickCount,
  });

  return {
    ok: true,
    tabId: targetTabId,
    x: clickX,
    y: clickY,
    selector: selector || null,
    element: matchedElement,
  };
}

// ============================================================================
// 4. 핵심 API 3: trustedKey & trustedType (물리 키보드 타이핑 및 단축키)
// ============================================================================
const KEY_MAP = {
  Enter: { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 },
  Tab: { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 },
  Backspace: { key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 },
  Escape: { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 },
  Space: { key: ' ', code: 'Space', windowsVirtualKeyCode: 32 },
  ArrowUp: { key: 'ArrowUp', code: 'ArrowUp', windowsVirtualKeyCode: 38 },
  ArrowDown: { key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 },
  ArrowLeft: { key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 },
  ArrowRight: { key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 },
};

async function trustedKey({
  tabId,
  key = 'Enter',
  code,
  windowsVirtualKeyCode,
  modifiers = 0,
}) {
  const targetTabId = await resolveTargetTabId(tabId);
  const preset = KEY_MAP[key] || {
    key,
    code: code || `Key${key.toUpperCase()}`,
    windowsVirtualKeyCode: windowsVirtualKeyCode || key.toUpperCase().charCodeAt(0),
  };

  await sendCdpCommand(targetTabId, 'Input.dispatchKeyEvent', {
    type: 'rawKeyDown',
    key: preset.key,
    code: preset.code,
    windowsVirtualKeyCode: preset.windowsVirtualKeyCode,
    nativeVirtualKeyCode: preset.windowsVirtualKeyCode,
    modifiers,
  });
  await sleep(20);

  if (preset.key === 'Enter') {
    await sendCdpCommand(targetTabId, 'Input.dispatchKeyEvent', {
      type: 'char',
      text: '\r',
      unmodifiedText: '\r',
      key: 'Enter',
      code: 'Enter',
      windowsVirtualKeyCode: 13,
      modifiers,
    });
  }

  await sendCdpCommand(targetTabId, 'Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: preset.key,
    code: preset.code,
    windowsVirtualKeyCode: preset.windowsVirtualKeyCode,
    nativeVirtualKeyCode: preset.windowsVirtualKeyCode,
    modifiers,
  });

  return { ok: true, tabId: targetTabId, key: preset.key, modifiers };
}

async function trustedType({
  tabId,
  text = '',
  selector,
  delayMs = 15,
  pressEnter = false,
}) {
  const targetTabId = await resolveTargetTabId(tabId);
  if (selector) {
    const clickRes = await trustedClick({ tabId: targetTabId, selector });
    if (!clickRes.ok) return clickRes;
    await sleep(60);
  }

  for (const ch of String(text)) {
    if (ch === '\n') {
      await trustedKey({ tabId: targetTabId, key: 'Enter' });
    } else {
      // 한글/유니코드 및 영문 모두 깨짐 없이 물리 입력 처리
      await sendCdpCommand(targetTabId, 'Input.insertText', { text: ch });
    }
    if (delayMs > 0) await sleep(delayMs);
  }

  if (pressEnter) {
    await sleep(40);
    await trustedKey({ tabId: targetTabId, key: 'Enter' });
  }

  return { ok: true, tabId: targetTabId, typedLength: String(text).length };
}

// ============================================================================
// 5. 핵심 API 4: trustedPaste (클립보드 주입 후 물리 Ctrl+V 발사)
// ============================================================================
async function trustedPaste({ tabId, text = '', html = '', selector }) {
  const targetTabId = await resolveTargetTabId(tabId);

  if (selector) {
    const clickRes = await trustedClick({ tabId: targetTabId, selector });
    if (!clickRes.ok) return clickRes;
    await sleep(80);
  }

  // 1단계: 탭 내부에서 클립보드에 리치 HTML / 텍스트 주입
  await chrome.scripting.executeScript({
    target: { tabId: targetTabId },
    func: async (plainText, richHtml) => {
      if (window.__MerlinZCore && typeof window.__MerlinZCore.writeRichClipboard === 'function') {
        return window.__MerlinZCore.writeRichClipboard({ text: plainText, html: richHtml });
      }
      await navigator.clipboard.writeText(plainText);
      return { ok: true };
    },
    args: [text, html],
  });

  await sleep(50);

  // 2단계: CDP 물리 Ctrl+V (modifiers: 2 = Ctrl, keyCode: 86 = 'V') 신호 발사
  await sendCdpCommand(targetTabId, 'Input.dispatchKeyEvent', {
    type: 'rawKeyDown',
    modifiers: 2,
    key: 'v',
    code: 'KeyV',
    windowsVirtualKeyCode: 86,
    nativeVirtualKeyCode: 86,
    commands: ['paste'],
  });
  await sleep(30);
  await sendCdpCommand(targetTabId, 'Input.dispatchKeyEvent', {
    type: 'keyUp',
    modifiers: 2,
    key: 'v',
    code: 'KeyV',
    windowsVirtualKeyCode: 86,
    nativeVirtualKeyCode: 86,
  });

  return {
    ok: true,
    tabId: targetTabId,
    pastedTextLength: text.length,
    pastedHtmlLength: html.length,
  };
}

// ============================================================================
// 6. 부가 만능 명령: 페이지 이동(navigate), DOM/스크립트 평가(evalJs), 탭 목록 조회
// ============================================================================
async function executeUniversalCommand(command, params = {}) {
  switch (command) {
    case 'trustedClick':
      return trustedClick(params);
    case 'trustedType':
      return trustedType(params);
    case 'trustedKey':
      return trustedKey(params);
    case 'trustedPaste':
      return trustedPaste(params);
    case 'pierceShadowDOM':
      return pierceShadowDOM(params);
    case 'navigate': {
      const targetTabId = await resolveTargetTabId(params.tabId);
      await chrome.tabs.update(targetTabId, { url: params.url, active: true });
      return { ok: true, tabId: targetTabId, url: params.url };
    }
    case 'evalJs': {
      const targetTabId = await resolveTargetTabId(params.tabId);
      await ensureDebuggerAttached(targetTabId);
      const evalRes = await sendCdpCommand(targetTabId, 'Runtime.evaluate', {
        expression: params.expression || 'document.title',
        returnByValue: true,
        awaitPromise: true,
      });
      return {
        ok: true,
        tabId: targetTabId,
        value: evalRes?.result?.value,
      };
    }
    case 'listTabs': {
      const tabs = await chrome.tabs.query({});
      return {
        ok: true,
        tabs: tabs.map((t) => ({
          id: t.id,
          title: t.title,
          url: t.url,
          active: t.active,
        })),
      };
    }
    default:
      throw new Error(`알 수 없는 Z-Core 명령입니다: ${command}`);
  }
}

// 내부 메시지 리스너
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || !message.command) return false;
  executeUniversalCommand(message.command, message.params || {})
    .then((res) => sendResponse(res))
    .catch((err) =>
      sendResponse({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      })
    );
  return true;
});

// ============================================================================
// 7. 로컬 브릿지 서버(http://127.0.0.1:5198) 실시간 명령 폴링 루프
// ============================================================================
let isPollingBridge = false;

async function pollLocalBridgeLoop() {
  if (isPollingBridge) return;
  isPollingBridge = true;

  while (true) {
    try {
      const res = await fetch(`${BRIDGE_BASE_URL}/__zcore/next-task`, {
        method: 'GET',
        cache: 'no-store',
      });
      if (res.ok) {
        const task = await res.json();
        if (task && task.taskId && task.command) {
          let resultPayload;
          try {
            resultPayload = await executeUniversalCommand(task.command, task.params || {});
          } catch (err) {
            resultPayload = {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            };
          }
          await fetch(`${BRIDGE_BASE_URL}/__zcore/complete-task`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              taskId: task.taskId,
              result: resultPayload,
            }),
          });
          continue;
        }
      }
    } catch (_e) {
      // 브릿지 서버 미실행 시 조용히 대기
    }
    await sleep(800);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('zcore_bridge_keepalive', { periodInMinutes: 0.5 });
  pollLocalBridgeLoop();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'zcore_bridge_keepalive') {
    pollLocalBridgeLoop();
  }
});

pollLocalBridgeLoop();
