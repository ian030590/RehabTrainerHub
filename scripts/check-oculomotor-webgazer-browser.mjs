#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import http from 'node:http';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'apps/rehabtrainerhub/out');
const browser = FindBrowserPath();
assert.ok(browser, 'Brave or another Chromium browser is required.');
assert.ok(existsSync(resolve(output, 'games/oculomotor-training/reference/experiment.js')), 'Run npm run build:hub first.');

const previewPort = await FreePort();
const debugPort = await FreePort();
const profile = mkdtempSync(join(tmpdir(), 'oculomotor-reference-'));
const origin = `http://127.0.0.1:${previewPort}`;
const cameraOnly = process.argv.includes('--camera-only');
const uploadOnly = process.argv.includes('--upload-only');
let preview;
let brave;
let cdp;
let session;
let logs = '';

try {
  preview = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), 'preview',
    '--host', '127.0.0.1', '--port', String(previewPort), '--strictPort', '--outDir', output],
  { cwd: resolve(root, 'apps/rehabtrainerhub'), stdio: ['ignore', 'pipe', 'pipe'] });
  preview.stdout.on('data', chunk => { logs += chunk; });
  preview.stderr.on('data', chunk => { logs += chunk; });
  await WaitForHttp(`${origin}/games/oculomotor-training/`);
  console.log('Preview ready.');

  brave = spawn(browser, ['--headless=new', '--no-sandbox', '--no-first-run', '--disable-background-networking',
    '--disable-dev-shm-usage', '--enable-webgl', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
    '--use-angle=swiftshader', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--window-size=1440,900',
    `--user-data-dir=${profile}`, `--remote-debugging-port=${debugPort}`, 'about:blank'],
  { stdio: 'ignore' });
  const info = await WaitForHttp(`http://127.0.0.1:${debugPort}/json/version`);
  console.log('Browser debugger ready.');
  cdp = await ConnectCdp(JSON.parse(info).webSocketDebuggerUrl);
  const target = await cdp.send('Target.createTarget', { url: 'about:blank' });
  session = (await cdp.send('Target.attachToTarget', { targetId: target.targetId, flatten: true })).sessionId;
  await cdp.send('Page.enable', {}, session);
  await cdp.send('Runtime.enable', {}, session);
  await cdp.send('Page.navigate', { url: `${origin}/games/oculomotor-training/` }, session);
  console.log('Navigated to game.');

  await WaitFor(() => Evaluate('Boolean(document.querySelector("#game-setting-module"))'), 'settings form');
  console.log('Settings form ready.');
  assert.equal(await Evaluate('Array.from(document.querySelector("#game-setting-eyeTrackingSource").options).map(o => o.value).join(",")'), '0,1');
  if (cameraOnly) {
    const cameraResult = await Evaluate(`(async () => {
      const outer = document.createElement('iframe');
      outer.allow = 'camera; fullscreen';
      outer.src = '/games/oculomotor-training/';
      document.body.append(outer);
      await new Promise((resolve, reject) => {
        outer.addEventListener('load', resolve, { once: true });
        outer.addEventListener('error', reject, { once: true });
      });
      const frame = outer.contentDocument.createElement('iframe');
      frame.allow = 'camera; fullscreen';
      frame.src = '/games/oculomotor-training/reference/index.html';
      outer.contentDocument.body.append(frame);
      await new Promise((resolve, reject) => {
        frame.addEventListener('load', resolve, { once: true });
        frame.addEventListener('error', reject, { once: true });
      });
      const stream = await frame.contentWindow.navigator.mediaDevices.getUserMedia({ video: true });
      const result = { tracks: stream.getVideoTracks().length, active: stream.active };
      stream.getTracks().forEach(track => track.stop());
      outer.remove();
      return result;
    })()`);
    assert.deepEqual(cameraResult, { tracks: 1, active: true });
    console.log('Nested same-origin iframe camera permission smoke passed.');
  } else {
  await Evaluate(`(() => {
    const change = (selector, value) => {
      const element = document.querySelector(selector);
      const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    };
    change('#game-setting-module', '0');
    change('#game-setting-eyeTrackingSource', '1');
    change('#game-setting-vorTotalSec', '${uploadOnly ? '30' : '5'}');
    return true;
  })()`);
  await Wait(100);
  await Evaluate('document.querySelector("form.game-settings-form button[type=submit]").click()');
  await WaitFor(() => Evaluate('Boolean(document.querySelector(".training-panel .training-rules"))'), 'rules panel');
  console.log('Rules ready.');
  await Evaluate('document.querySelector(".training-panel .training-rules button.btn-primary").click()');
  await WaitFor(() => Evaluate('Boolean(document.querySelector(".oculomotor-experiment-frame")?.contentDocument?.querySelector("#training-stage"))'), 'reference stimulus stage');
  console.log('Stimulus stage ready.');
  if (uploadOnly) {
    await Evaluate(`(() => {
      const originalFetch = window.fetch.bind(window);
      window.__gazeUploads = [];
      window.__scoreWrites = [];
      window.fetch = (input, init) => {
        if (String(input).endsWith('/api/oculomotor-data')) {
          window.__gazeUploads.push(JSON.parse(init.body));
          return Promise.resolve(new Response('{}', { status: window.__gazeUploads.length === 1 ? 503 : 201 }));
        }
        if (String(input).endsWith('/api/records')) {
          window.__scoreWrites.push(JSON.parse(init.body));
          return Promise.resolve(new Response('{"ok":true}', { status: 201 }));
        }
        return originalFetch(input, init);
      };
      const message = {
        type: 'oculomotor:complete',
        result: {
          actual_duration_ms: 1000, completed_targets: 3, accuracy_rate: 50,
          in_threshold_sec: 0.5, valid_sec: 1, blink_sec: 0, gaze_sample_count: 1,
          threshold_deg: 2.4, validation_error_deg: 1.2, estimated_refresh_hz: 60,
          end_reason: 'duration_complete', module: 'vor', eye_tracking_source: 'webgazer',
        },
        upload: {
          records: [{
            sample_index: 1, trial_time_ms: 12.6, device_timestamp_us: 1000000,
            delta_t_ms: 30.3, instant_hz: 33, gaze_valid: 1,
            gaze_x_px: 320, gaze_y_px: 240, stimulus_x_px: 330, stimulus_y_px: 245,
            distance_error_px: 11.18, distance_error_deg: 0.2,
            is_within_threshold: 1, phase: 'movement', direction: 'rightUp',
          }],
          metadata: { mode: 'vor', run_mode: 'continuous', stimulus_type: 'numbers_dot', eye_tracking_source: 'webgazer' },
        },
      };
      document.querySelector('.oculomotor-experiment-frame').contentWindow.eval(
        'window.parent.postMessage(' + JSON.stringify(message) + ', window.location.origin)'
      );
      return true;
    })()`);
    await WaitFor(() => Evaluate('Boolean(document.querySelector(".oculomotor-results [role=alert] button"))'), 'CSV retry button');
    const upload = await Evaluate('window.__gazeUploads[0]');
    assert.equal(upload.source, 'webgazer');
    assert.equal(upload.records[0][1], 13);
    assert.equal(upload.records[0][14], 'up_right');
    assert.match(upload.recordId, /^(?:[0-9a-f]{64}|[0-9a-f-]{36})$/);
    assert.equal(await Evaluate('window.__scoreWrites.length'), 0);
    await Evaluate('document.querySelector(".oculomotor-results [role=alert] button").click()');
    await WaitFor(() => Evaluate('window.__gazeUploads.length === 2'), 'CSV retry request');
    await WaitFor(() => Evaluate('Boolean(document.querySelector(".oculomotor-results [role=status]"))'), 'CSV saved state');
    assert.equal(await Evaluate('window.__gazeUploads[0].recordId === window.__gazeUploads[1].recordId'), true);
    await WaitFor(() => Evaluate('window.__scoreWrites.length === 1'), 'score saved after CSV');
    assert.equal(await Evaluate('window.__scoreWrites[0].record.id === window.__gazeUploads[1].recordId'), true);
    console.log('Reference oculomotor private CSV upload and retry smoke passed.');
  } else {
    await WaitFor(() => Evaluate('Boolean(document.querySelector(".oculomotor-results h2"))'), 'result page', 15_000);
    console.log('Reference oculomotor settings, stimulus, and score smoke passed.');
  }
  }
} catch (error) {
  throw new Error(`${error.message}\nPreview logs: ${logs.slice(-2000)}`);
} finally {
  try { await cdp?.send('Browser.close'); } catch {}
  cdp?.socket.close();
  brave?.kill();
  preview?.kill();
  if (!resolve(profile).startsWith(`${resolve(tmpdir())}${sep}`)) throw new Error('Unsafe browser profile path.');
  try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); }
  catch (cleanupError) { console.warn(`Browser profile cleanup deferred: ${cleanupError.code}`); }
}

async function Evaluate(expression) {
  const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, session);
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}

async function WaitFor(predicate, label, timeout = 12_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await Wait(100);
  }
  const state = await Evaluate('({ href: location.href, text: document.body?.innerText.slice(0, 600), frame: document.querySelector(".oculomotor-experiment-frame")?.contentDocument?.body?.innerText.slice(0, 600) })');
  throw new Error(`Timed out waiting for ${label}: ${JSON.stringify(state)}`);
}

function Wait(ms) { return new Promise(done => setTimeout(done, ms)); }

async function FreePort() {
  const server = createServer();
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  const port = server.address().port;
  await new Promise(done => server.close(done));
  return port;
}

async function WaitForHttp(url) {
  for (let i = 0; i < 100; i++) {
    try {
      const body = await new Promise((done, fail) => {
        http.get(url, response => {
          let value = '';
          response.on('data', chunk => { value += chunk; });
          response.on('end', () => response.statusCode === 200 ? done(value) : fail(new Error(String(response.statusCode))));
        }).on('error', fail);
      });
      return body;
    } catch { await Wait(200); }
  }
  throw new Error(`HTTP endpoint did not become available: ${url}`);
}

async function ConnectCdp(url) {
  const socket = new WebSocket(url);
  await new Promise((done, fail) => {
    socket.addEventListener('open', done, { once: true });
    socket.addEventListener('error', fail, { once: true });
  });
  let nextId = 0;
  const pending = new Map();
  socket.addEventListener('message', message => {
    const data = JSON.parse(message.data);
    if (!pending.has(data.id)) return;
    const item = pending.get(data.id);
    pending.delete(data.id);
    if (data.error) item.reject(new Error(`${item.method}: ${JSON.stringify(data.error)}`));
    else item.resolve(data.result);
  });
  const send = (method, params = {}, targetSession) => new Promise((resolveCall, reject) => {
    const id = ++nextId;
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP ${method} timed out.`));
    }, 45_000);
    pending.set(id, {
      resolve: result => { clearTimeout(timeout); resolveCall(result); },
      reject: error => { clearTimeout(timeout); reject(error); },
      method,
    });
    socket.send(JSON.stringify({ id, method, params, ...(targetSession ? { sessionId: targetSession } : {}) }));
  });
  return { send, socket };
}

function FindBrowserPath() {
  for (const candidate of [process.env.BRAVE_BIN, process.env.BROWSER_EXECUTABLE_PATH,
    'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe']) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  for (const name of ['brave', 'msedge', 'chromium', 'google-chrome']) {
    if (spawnSync(name, ['--version'], { stdio: 'ignore' }).status === 0) return name;
  }
  return null;
}
