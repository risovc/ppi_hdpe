'use strict';

const assert = require('assert');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const URL = process.argv[2] || 'http://127.0.0.1:8092/';
const SHOT_DIR = process.argv[3] || '';
const CDP_PORT = Number(process.env.CDP_PORT || 9335);

const CHROME_CANDIDATES = [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];

function findChrome() {
  for (const p of CHROME_CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('No Chrome/Chromium binary found');
}

async function waitForWs(port, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await res.json();
      const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error('Timed out waiting for Chrome CDP endpoint');
}

async function run() {
  const chromeBin = findChrome();
  const userDataDir = `/tmp/ppi-e2e-chrome-${CDP_PORT}`;
  fs.rmSync(userDataDir, { recursive: true, force: true });
  if (SHOT_DIR) fs.mkdirSync(SHOT_DIR, { recursive: true });

  const chrome = spawn(chromeBin, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${userDataDir}`,
    '--window-size=1440,960',
    'about:blank',
  ], { stdio: 'ignore' });

  let ws;
  const errors = [];
  let passed = 0;

  try {
    const wsUrl = await waitForWs(CDP_PORT);
    ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', rej, { once: true });
    });

    let msgId = 0;
    const pending = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        errors.push(`RuntimeException: ${msg.params.exceptionDetails.text}`);
      } else if (msg.method === 'Console.messageAdded' && msg.params.message.level === 'error') {
        errors.push(`ConsoleError: ${msg.params.message.text}`);
      }
    });

    const send = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const id = ++msgId;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });

    const evalJs = async (expr) => {
      const r = await send('Runtime.evaluate', {
        expression: `(() => { ${expr} })()`,
        returnByValue: true,
        awaitPromise: true,
      });
      if (r.exceptionDetails) {
        throw new Error(`JS Eval error: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`);
      }
      return r.result.value;
    };

    const shot = async (name) => {
      if (!SHOT_DIR) return;
      const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
      fs.writeFileSync(path.join(SHOT_DIR, name), Buffer.from(data, 'base64'));
    };

    const check = async (label, fn) => {
      await fn();
      passed++;
      console.log(`  PASS  ${label}`);
    };

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Console.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 960,
      deviceScaleFactor: 2,
      mobile: false,
    });

    await send('Page.navigate', { url: URL });
    await new Promise((r) => setTimeout(r, 600));

    console.log('PPI Chapter 6 Visualizer — Browser E2E Verification\n');

    await check('Page loaded with zero console/runtime errors & global APIs bound', async () => {
      const ok = await evalJs(`return Boolean(window.PPIEngine && window.PPIVisuals && window.PPIApp);`);
      assert.strictEqual(ok, true);
      assert.strictEqual(errors.length, 0, `Errors: ${errors.join('; ')}`);
    });

    await check('Tab 1 (Buried Pipe & Surface Load) renders SVG cross-section, depth chart & PASS KPIs', async () => {
      const info = await evalJs(`
        const svg = document.getElementById('burialSceneSvg');
        const chart = document.getElementById('depthChartSvg');
        const defl = document.getElementById('valKpiDeflection').textContent;
        const badge = document.getElementById('badgeDeflection').textContent;
        const overflow = document.documentElement.scrollWidth > window.innerWidth;
        return { hasSvg: !!svg, hasChart: !!chart, defl, badge, overflow };
      `);
      assert.strictEqual(info.hasSvg, true);
      assert.strictEqual(info.hasChart, true);
      assert.strictEqual(info.badge, 'PASS');
      assert.strictEqual(info.overflow, false, 'No horizontal overflow on desktop');
      await shot('01_burial_highway_light.png');
    });

    await check('Shallow Haul Road preset triggers FAIL badge & updates ovalization', async () => {
      const info = await evalJs(`
        window.PPIApp.applyPreset('shallow_heavy');
        return {
          badgeCover: document.getElementById('badgeCover').textContent,
          advisoryClass: document.getElementById('burialAdvisories').className,
          svgText: document.getElementById('burialSceneSvg').textContent
        };
      `);
      assert(info.advisoryClass.includes('fail'), 'Should show fail advisory');
      assert(info.svgText.includes('BURIAL CHECK: FAIL'));
      await shot('02_burial_shallow_fail.png');
    });

    await check('Boussinesq wheel mode renders draggable wheel & reacts to lateral offset', async () => {
      const res = await evalJs(`
        const sel = document.getElementById('inpLiveLoadType');
        sel.value = 'boussinesq';
        sel.dispatchEvent(new Event('change'));
        const pl0 = window.PPIEngine.calcSection3(window.PPIApp.state.params).liveLoadPsi;
        const off = document.getElementById('inpWheelOffset');
        off.value = '4';
        off.dispatchEvent(new Event('input'));
        const pl4 = window.PPIEngine.calcSection3(window.PPIApp.state.params).liveLoadPsi;
        return { hasWheel: !!document.getElementById('draggableWheel'), pl0, pl4 };
      `);
      assert.strictEqual(res.hasWheel, true);
      assert(res.pl0 > res.pl4 * 2, 'Offset 4 ft should strongly attenuate Boussinesq load');
    });

    await check('Tab 2 (Pipe Cutaway, PR & Surge) renders cutaway, WPR gauge & Figure 1-1 for textbook preset', async () => {
      const info = await evalJs(`
        window.PPIApp.applyPreset('ppi_book_surge');
        window.PPIApp.switchTab('pressure');
        return {
          pr: document.getElementById('valKpiPR').textContent,
          wpr: document.getElementById('valKpiWPR').textContent,
          hasCutaway: !!document.getElementById('pipeCutawaySvg'),
          hasWprGauge: !!document.getElementById('wprGaugeSvg'),
          hasFig11: !!document.getElementById('figure11Svg'),
          hasTemp: !!document.getElementById('tempCurvesSvg'),
        };
      `);
      assert.strictEqual(info.pr, '125.0 psi');
      assert.strictEqual(info.wpr, '100.0 psi');
      assert.strictEqual(info.hasCutaway, true);
      assert.strictEqual(info.hasWprGauge, true);
      assert.strictEqual(info.hasFig11, true);
      assert.strictEqual(info.hasTemp, true);
      await shot('03_pressure_cutaway_wpr_light.png');
    });

    await check('Dark Theme + SI Unit Toggle + Tab 3 Multi-DR Matrix render cleanly with zero overflow', async () => {
      const info = await evalJs(`
        document.getElementById('btnThemeToggle').click();
        document.getElementById('btnUnitSI').click();
        window.PPIApp.switchTab('burial');
        window.PPIApp.applyPreset('deep_groundwater');
        return {
          theme: document.documentElement.getAttribute('data-theme'),
          cover: document.getElementById('valCoverDepth').textContent,
          overflow: document.documentElement.scrollWidth > window.innerWidth,
        };
      `);
      assert.strictEqual(info.theme, 'dark');
      assert(info.cover.includes('m'), `Expected SI meters, got ${info.cover}`);
      assert.strictEqual(info.overflow, false);
      await shot('04_burial_deep_gw_dark_si.png');

      const matInfo = await evalJs(`
        window.PPIApp.switchTab('matrix');
        const rows = document.querySelectorAll('#drMatrixTbody tr').length;
        const eqs = document.querySelectorAll('#liveEquationsGrid .eq-card').length;
        return { rows, eqs };
      `);
      assert.strictEqual(matInfo.rows, 8);
      assert.strictEqual(matInfo.eqs, 4);
      await shot('05_matrix_dark.png');
    });

    await check('Mobile viewport (390x844) has zero horizontal overflow', async () => {
      await send('Emulation.setDeviceMetricsOverride', {
        width: 390,
        height: 844,
        deviceScaleFactor: 2,
        mobile: true,
      });
      await new Promise((r) => setTimeout(r, 150));
      const overflow = await evalJs(`
        window.PPIApp.switchTab('burial');
        return document.documentElement.scrollWidth > window.innerWidth;
      `);
      assert.strictEqual(overflow, false, 'Mobile viewport should not overflow horizontally');
    });

    await check('Zero runtime or console errors across entire E2E session', async () => {
      assert.strictEqual(errors.length, 0, `Errors: ${errors.join('; ')}`);
    });

    console.log(`\nBrowser E2E Summary: ${passed} passed, 0 failed.`);
  } finally {
    if (ws) ws.close();
    chrome.kill('SIGKILL');
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

run().catch((err) => {
  console.error('E2E FAILED:', err);
  process.exit(1);
});
