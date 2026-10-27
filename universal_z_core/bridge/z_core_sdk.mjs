/**
 * 멀린 Z 코어 (Universal Merlin Z-Core) 전사 Node.js 공용 SDK (z_core_sdk.mjs)
 * - 고정 위치: D:\Ghosti\universal_z_core\bridge\z_core_sdk.mjs
 * - 사용법 (타 프로젝트에서 파일 복사 없이 바로 import):
 *   import { ZCore } from 'file:///D:/Ghosti/universal_z_core/bridge/z_core_sdk.mjs';
 *   await ZCore.trustedClick({ selector: 'button.publish' });
 */

const BRIDGE_URL = 'http://127.0.0.1:5198/__zcore/command';

export const ZCore = {
  async call(command, params = {}, timeoutSec = 15) {
    const res = await fetch(BRIDGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, params, timeoutSec }),
    });
    return res.json();
  },

  trustedClick(params = {}) {
    return this.call('trustedClick', params);
  },

  trustedType(params = {}) {
    return this.call('trustedType', params);
  },

  trustedKey(params = {}) {
    return this.call('trustedKey', params);
  },

  trustedPaste(params = {}) {
    return this.call('trustedPaste', params);
  },

  pierceShadowDOM(params = {}) {
    return this.call('pierceShadowDOM', params);
  },

  navigate(params = {}) {
    return this.call('navigate', params);
  },

  evalJs(params = {}) {
    return this.call('evalJs', params);
  },

  listTabs() {
    return this.call('listTabs', {});
  },
};
