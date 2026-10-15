/**
 * SaySee PoC — 헤드리스 자동 벤치마크 (PC)
 *
 * 사용: node scripts/run-bench.mjs [--cold] [--max=300] [--budget=280] [--headful] [--label=xxx]
 *  - 실행 중인 dev 서버(https://localhost:5199)에 Chrome으로 접속해 자동 측정
 *  - 결과 JSON은 페이지가 poc/results/에 저장, 검색 결과 스크린샷은 poc/results/shots/
 *  - 프로필(poc/.chrome-profile)을 유지하므로 두 번째 실행부터 OPFS 캐시(웜 로드)를 측정함
 */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? '1'];
  }),
);

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => fs.existsSync(p));

const qs = new URLSearchParams({ auto: '1', max: args.max ?? '300', budget: args.budget ?? '280' });
for (const k of ['batch', 'text', 'vision', 'audio', 'device', 'dim', 'cache', 'voice', 'indexonly']) if (args[k]) qs.set(k, args[k]);
if (args.cold) qs.set('cold', '1');
const url = `https://localhost:5199/?${qs}`;

const SHOT_QUERIES = (args.shots ?? 'beach_ko,dog_ko,cake_ko,screenshot_ko,receipt_ko,document_ko,object_ko,night_ko,blurry_ko').split(',');

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: args.headful ? false : true,
  userDataDir: path.join(ROOT, '.chrome-profile'),
  protocolTimeout: 60 * 60 * 1000,
  args: [
    '--ignore-certificate-errors',
    '--enable-unsafe-webgpu',
    '--enable-features=Vulkan,WebGPU',
    '--use-fake-ui-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
    '--window-size=1280,1600',
  ],
  defaultViewport: { width: 1100, height: 1500 },
});

const page = await browser.newPage();
page.on('console', (m) => {
  const t = m.text();
  if (t.startsWith('[SaySee PoC]')) console.log(t.slice(13));
  else if (m.type() === 'error') console.log('  [console.error]', t.slice(0, 300));
});
page.on('pageerror', (e) => console.log('  [pageerror]', String(e).slice(0, 300)));

console.log(`▶ ${url}\n  브라우저: ${CHROME}`);
const t0 = Date.now();
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__saysee?.done === true, { timeout: 60 * 60 * 1000, polling: 2000 });
const state = await page.evaluate(() => ({ error: window.__saysee.error, savedAs: window.__saysee.report?.savedAs, env: window.__saysee.report?.env }));
console.log(`\n■ 완료 ${((Date.now() - t0) / 1000).toFixed(0)}초 · 리포트: ${state.savedAs ?? '(저장 안 됨)'}`);
if (state.error) console.log('  오류:', state.error.slice(0, 1500));

if (!state.error && !args.noshots) {
  const dir = path.join(ROOT, 'results', 'shots', args.label ?? new Date().toISOString().replace(/[:.]/g, '-'));
  fs.mkdirSync(dir, { recursive: true });
  const el = async () => page.$('#results');
  for (const id of SHOT_QUERIES) {
    for (const kind of ['text', 'audio']) {
      try {
        await page.evaluate((id, kind) => (kind === 'text' ? window.__showText(id) : window.__showAudio(id)), id, kind);
        await new Promise((r) => setTimeout(r, 400));
        const info = await page.$eval('#searchInfo', (e) => e.textContent);
        await (await el()).screenshot({ path: path.join(dir, `${id}_${kind}.png`) });
        console.log(`  📸 ${id}_${kind}: ${info}`);
      } catch (e) {
        console.log(`  📸 ${id}_${kind} 실패: ${String(e).slice(0, 200)}`);
      }
    }
  }
  console.log(`  스크린샷: ${dir}`);
}
await browser.close();
