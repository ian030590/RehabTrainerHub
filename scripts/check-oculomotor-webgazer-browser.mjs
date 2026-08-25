#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import http from 'node:http';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const appDir = resolve(repoRoot, 'apps', 'rehabtrainerhub', 'training-runtimes', 'vision');
const outputDir = resolve(repoRoot, 'apps', 'rehabtrainerhub', 'out', 'runtimes', 'vision');
const outputIndex = resolve(outputDir, 'index.html');
const viteBin = resolve(repoRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const browserPath = FindBrowserPath();
const timeoutMs = 60_000;

if (!existsSync(outputIndex)) {
  throw new Error(`Built Vision runtime is missing: ${outputIndex}\nRun npm run build:hub first.`);
}
if (!existsSync(viteBin)) throw new Error(`Vite preview executable is missing: ${viteBin}`);
if (!browserPath) throw new Error('No Chromium-based browser executable was found.');

const previewPort = await GetAvailablePort();
const debugPort = await GetAvailablePort();
const browserProfileDir = mkdtempSync(join(tmpdir(), 'oculomotor-webgazer-browser-'));
const baseUrl = `http://127.0.0.1:${previewPort}/runtimes/vision/`;
const navigationUrl = `${baseUrl}#/training?module=oculomotor-training&mode=lilac-chaser&duration=5`;

let previewProcess;
let browserProcess;
let cdp;
let sessionId;
let previewLogs = '';
let browserLogs = '';

try {
  previewProcess = spawn(process.execPath, [
    viteBin,
    'preview',
    '--host',
    '127.0.0.1',
    '--port',
    String(previewPort),
    '--strictPort',
    '--outDir',
    outputDir,
    '--logLevel',
    'warn',
  ], {
    cwd: appDir,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  previewProcess.stdout.on('data', (chunk) => { previewLogs += chunk; });
  previewProcess.stderr.on('data', (chunk) => { previewLogs += chunk; });
  await WaitForHttp(baseUrl, 'Vision runtime production preview');

  browserProcess = spawn(browserPath, [
    '--headless=new',
    '--no-sandbox',
    '--no-first-run',
    '--disable-background-networking',
    '--disable-dev-shm-usage',
    '--enable-webgl',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--use-angle=swiftshader',
    '--window-size=1440,900',
    `--user-data-dir=${browserProfileDir}`,
    `--remote-debugging-port=${debugPort}`,
    'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  browserProcess.stdout.on('data', (chunk) => { browserLogs += chunk; });
  browserProcess.stderr.on('data', (chunk) => { browserLogs += chunk; });

  const version = await WaitForHttp(
    `http://127.0.0.1:${debugPort}/json/version`,
    'Chromium debugger',
  );
  cdp = await ConnectCdp(JSON.parse(version.body).webSocketDebuggerUrl);
  const target = await cdp.Send('Target.createTarget', { url: 'about:blank' });
  const attached = await cdp.Send('Target.attachToTarget', {
    targetId: target.targetId,
    flatten: true,
  });
  sessionId = attached.sessionId;

  await cdp.Send('Page.enable', undefined, sessionId);
  await cdp.Send('Runtime.enable', undefined, sessionId);
  await cdp.Send('Network.enable', undefined, sessionId);
  await cdp.Send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
    screenWidth: 1440,
    screenHeight: 900,
  }, sessionId);

  const vendoredRuntime = await Evaluate(cdp, sessionId, `new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = ${JSON.stringify(`${baseUrl}assets/webgazer/3.5.3/webgazer.js`)};
    script.onload = () => resolve({
      begin: typeof window.webgazer?.begin,
      prediction: typeof window.webgazer?.getCurrentPrediction,
      listener: typeof window.webgazer?.setGazeListener,
      faceMeshPath: window.webgazer?.params?.faceMeshSolutionPath ?? null,
    });
    script.onerror = () => reject(new Error('Unable to execute the vendored WebGazer runtime'));
    document.head.appendChild(script);
  })`);
  assert.deepEqual(vendoredRuntime, {
    begin: 'function',
    prediction: 'function',
    listener: 'function',
    faceMeshPath: './mediapipe/face_mesh',
  }, 'vendored WebGazer 3.5.3 browser API');

  await cdp.Send('Page.addScriptToEvaluateOnNewDocument', {
    source: CreateBootstrapSource(),
  }, sessionId);

  await cdp.Send('Page.navigate', { url: navigationUrl }, sessionId);

  await WaitForSelector(cdp, sessionId, '#webgazer-init-container #jspsych-wg-cont', timeoutMs);
  const nativeInitState = await WaitForHeadState(cdp, sessionId, 'too-far', timeoutMs);
  assert.equal(nativeInitState.hasNativeContainer, true, 'native jsPsych camera-init DOM is missing');
  assert.equal(nativeInitState.state, 'too-far', 'initial head state must request moving closer');
  assert.equal(nativeInitState.disabled, true, 'camera continue must be gated while too far');
  assert.match(nativeInitState.text, /too far|move closer/i);

  const bypassBlocked = await Evaluate(cdp, sessionId, `(() => {
    const button = document.querySelector('#jspsych-wg-cont');
    button.disabled = false;
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return {
      disabled: button.disabled,
      stillInInit: Boolean(document.querySelector('#webgazer-init-container')),
    };
  })()`);
  assert.deepEqual(bypassBlocked, { disabled: true, stillInInit: true }, 'head gate was bypassed');

  await SetHeadState(cdp, sessionId, 'too-close');
  const tooCloseState = await WaitForHeadState(cdp, sessionId, 'too-close', timeoutMs);
  assert.equal(tooCloseState.disabled, true, 'camera continue must be gated while too close');
  assert.match(tooCloseState.text, /too close|farther/i);

  await SetHeadState(cdp, sessionId, 'ready');
  const readyState = await WaitForHeadState(cdp, sessionId, 'ready', timeoutMs);
  assert.equal(readyState.disabled, false, 'camera continue must unlock at a stable distance');
  await ClickDomSelector(cdp, sessionId, '#jspsych-wg-cont');

  await WaitForSelector(cdp, sessionId, '#webgazer-calibrate-container #calibration-point', timeoutMs);
  for (let index = 0; index < 18; index += 1) {
    await ClickDomSelector(cdp, sessionId, '#webgazer-calibrate-container #calibration-point');
    if (index < 17) {
      await WaitForValue(cdp, sessionId, `window.__wgSmoke.calibrationClicks >= ${index + 1}`, timeoutMs);
    }
  }
  const calibrationState = await Evaluate(cdp, sessionId, `({
    clicks: window.__wgSmoke.calibrationClicks,
    starts: window.__wgSmoke.mouseCalibrationStarts,
  })`);
  assert.equal(calibrationState.clicks, 18, 'native 9-point x2 click calibration count');
  assert.equal(calibrationState.starts, 1, 'native mouse calibration must start exactly once');

  await WaitForSelector(cdp, sessionId, '#webgazer-validate-container .validation-point', timeoutMs);
  await WaitForSelector(
    cdp,
    sessionId,
    '#webgazer-validate-container [data-webgazer-validation-result]',
    timeoutMs,
  );
  const validationState = await Evaluate(cdp, sessionId, `(() => ({
    centroids: document.querySelectorAll('#webgazer-validate-container .validation-centroid').length,
    points: document.querySelectorAll('#webgazer-validate-container .raw-data-point').length,
    panel: Boolean(document.querySelector('[data-webgazer-validation-result]')),
    title: document.querySelector('[data-webgazer-validation-result] h2')?.textContent?.trim() ?? '',
  }))()`);
  assert.equal(validationState.centroids, 9, 'native validation must draw all 9 ROI centroids');
  assert.ok(validationState.points > 0, 'native validation must draw raw gaze points');
  assert.equal(validationState.panel, true, 'calibration result panel is missing');
  assert.match(validationState.title, /calibration results/i);
  await ClickDomSelector(cdp, sessionId, '#webgazer-validate-container #cont');

  await WaitForSelector(cdp, sessionId, '.oculomotor-training-trial canvas', timeoutMs);
  await WaitForValue(cdp, sessionId, `window.__wgSmoke.predictionPointCalls.some(
    (entry) => entry.show === true && entry.phase === 'training'
  )`, timeoutMs);
  const liveGazePoint = await Evaluate(cdp, sessionId, `(() => ({
    display: document.querySelector('#webgazerGazeDot')?.style.display ?? null,
    hasCanvas: Boolean(document.querySelector('.oculomotor-training-trial canvas')),
  }))()`);
  assert.equal(liveGazePoint.hasCanvas, true, 'oculomotor training canvas is missing');
  assert.notEqual(liveGazePoint.display, 'none', 'configured gaze point is not visible during training');

  // The first mock blink occurs while paused and must not be counted. A second
  // blink occurs after resume and must exist in both raw data and the summary.
  await WaitForValue(cdp, sessionId, 'window.__wgSmoke.trainingTick >= 5', timeoutMs);
  await ClickDomSelector(cdp, sessionId, '.oculomotor-pause-button');
  await WaitForValue(cdp, sessionId, 'window.__wgSmoke.trainingTick >= 16', timeoutMs);
  await ClickDomSelector(cdp, sessionId, '.oculomotor-pause-button');

  await WaitForValue(cdp, sessionId, 'window.__wgSmoke.savedPayloads.length === 1', timeoutMs);
  await WaitForSelector(cdp, sessionId, '.results-summary', timeoutMs);
  const resultState = await Evaluate(cdp, sessionId, `(() => {
    const payload = window.__wgSmoke.savedPayloads[0];
    return {
      appId: payload?.appId ?? null,
      runtimeId: payload?.runtimeId ?? null,
      result: payload?.record?.results?.[0] ?? null,
      resultCount: payload?.record?.results?.length ?? 0,
      resultText: document.querySelector('.results-summary')?.textContent ?? '',
      predictionPointCalls: window.__wgSmoke.predictionPointCalls,
      gazeDotDisplay: document.querySelector('#webgazerGazeDot')?.style.display ?? null,
    };
  })()`);
  AssertSavedResult(resultState);
  AssertNoCriticalBrowserFailures(cdp.events, sessionId, navigationUrl);

  console.log([
    'Oculomotor WebGazer browser smoke passed.',
    'Vendored WebGazer 3.5.3 production bundle executed in Chromium.',
    'Native jsPsych camera init: too-far -> too-close -> ready with guarded continue.',
    'Native jsPsych calibration: 9 points x 2 clicks.',
    `Native jsPsych validation: ${validationState.points} raw points, 9 centroids, result panel shown.`,
    `Training: ${resultState.result.gaze_sample_count} paired gaze/target samples; gaze point shown then hidden.`,
    `Metrics: mean=${resultState.result.mean_target_distance_px}px, SD=${resultState.result.target_distance_sd_px}px, TTFF=${resultState.result.time_to_first_fixation_ms}ms, pupil=${resultState.result.average_pupil_size_px}px, blinks=${resultState.result.blink_count}.`,
  ].join('\n'));
} catch (error) {
  console.error(error.stack || error);
  if (previewLogs.trim()) console.error(`\nPreview logs:\n${previewLogs.slice(-4000)}`);
  if (browserLogs.trim()) console.error(`\nBrowser logs:\n${browserLogs.slice(-4000)}`);
  process.exitCode = 1;
} finally {
  if (cdp?.ws.readyState === WebSocket.OPEN) {
    try { await cdp.Send('Browser.close'); } catch {}
  }
  cdp?.ws.close();
  await StopProcess(browserProcess);
  await StopProcess(previewProcess);
  rmSync(browserProfileDir, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
}

function AssertSavedResult(state) {
  assert.equal(state.appId, 'rehabtrainerhub', 'record must use the canonical Hub app id');
  assert.equal(state.runtimeId, 'vision', 'record must use the Hub vision runtime scope');
  assert.equal(state.resultCount, 1, 'only the Pixi oculomotor trial should be saved');
  const result = state.result;
  assert.ok(result, 'saved oculomotor result is missing');
  assert.equal(result.trial_type, 'pixi-oculomotor-training');
  assert.ok(Number.isFinite(result.mean_target_distance_px), 'mean target distance');
  assert.ok(result.mean_target_distance_px > 0 && result.mean_target_distance_px < 20);
  assert.ok(Number.isFinite(result.target_distance_sd_px), 'target distance SD');
  assert.ok(result.target_distance_sd_px > 0, 'target distance SD must reflect changing gaze');
  assert.ok(Number.isFinite(result.time_to_first_fixation_ms), 'Time to First Fixation');
  assert.ok(result.time_to_first_fixation_ms >= 0 && result.time_to_first_fixation_ms < 1000);
  assert.ok(Number.isFinite(result.average_pupil_size_px) && result.average_pupil_size_px > 0);
  assert.equal(result.blink_count, 1, 'only the in-training blink should be counted');
  assert.ok(Number.isInteger(result.gaze_sample_count) && result.gaze_sample_count >= 20);
  assert.deepEqual(result.gaze_sample_columns, [
    't_ms',
    'gaze_x',
    'gaze_y',
    'target_x',
    'target_y',
    'distance_px',
    'pupil_size_px_estimate',
    'blink_event',
    'fixation_segment',
  ]);
  assert.equal(result.gaze_samples.length, result.gaze_sample_count);
  result.gaze_samples.forEach((sample, index) => {
    assert.equal(sample.length, 9, `gaze sample ${index} compact field count`);
    for (const column of [0, 1, 2, 3, 4, 5]) {
      assert.ok(Number.isFinite(sample[column]), `gaze sample ${index} column ${column}`);
    }
    assert.ok(sample[6] === null || Number.isFinite(sample[6]), `gaze sample ${index} pupil`);
    assert.ok(sample[7] === 0 || sample[7] === 1, `gaze sample ${index} blink event`);
    assert.ok(Number.isInteger(sample[8]) && sample[8] >= 0, `gaze sample ${index} fixation segment`);
  });
  assert.equal(
    result.gaze_samples.filter((sample) => sample[7] === 1).length,
    1,
    'raw blink events and summary blink count must agree',
  );
  assert.deepEqual(
    [...new Set(result.gaze_samples.map((sample) => sample[8]))],
    [0, 1],
    'pause/resume must start a new fixation segment',
  );
  for (const label of [
    'Mean target distance',
    'Target distance standard deviation',
    'Time to First Fixation',
    'Mean pupil size',
    'Estimated blink count',
    'Gaze sample count',
  ]) {
    assert.match(state.resultText, new RegExp(label, 'i'), `result UI label: ${label}`);
  }
  assert.ok(
    state.predictionPointCalls.some((entry) => entry.show && entry.phase === 'training'),
    'gaze point must be enabled during training',
  );
  assert.ok(
    state.predictionPointCalls.some((entry) => !entry.show && entry.phase === 'training'),
    'gaze point must be disabled when training finishes',
  );
  assert.equal(state.gazeDotDisplay, 'none', 'gaze point DOM must be hidden on results');
}

function CreateBootstrapSource() {
  const tokenPayload = Buffer.from(JSON.stringify({
    sub: 'oculomotor-webgazer-smoke-user',
    name: 'WebGazer Browser Smoke',
    email: 'webgazer-smoke@example.test',
  })).toString('base64url');
  const token = `${tokenPayload}.webgazer-browser-smoke-signature`;
  const user = {
    id: 'oculomotor-webgazer-smoke-user',
    displayName: 'WebGazer Browser Smoke',
    email: 'webgazer-smoke@example.test',
    role: 'patient',
    profileCompleted: true,
    privacyAcceptedAt: '2026-01-01T00:00:00.000Z',
  };

  return `
    history.replaceState({ usr: { configAndRulesCompleted: true } }, '', location.href);
    localStorage.setItem('rehabtrainerhub.auth.token', ${JSON.stringify(token)});
    localStorage.setItem('rehabtrainerhub.vision.active_user', 'WebGazer Browser Smoke');
    localStorage.setItem('rehabtrainerhub.vision.language', 'en');
    localStorage.setItem('rehabtrainerhub.vision.oculomotorEnableWebgazer', 'true');
    localStorage.setItem('rehabtrainerhub.vision.oculomotorShowGazepoint', 'true');

    const smokeState = window.__wgSmoke = {
      active: false,
      calibrationClicks: 0,
      gazeListener: null,
      headState: 'too-far',
      mouseCalibrationStarts: 0,
      predictionCounter: 0,
      predictionPointCalls: [],
      savedPayloads: [],
      trainingTick: 0,
    };

    const originalFetch = window.fetch.bind(window);
    const smokeUser = ${JSON.stringify(user)};
    const smokeToken = ${JSON.stringify(token)};
    window.fetch = async (input, init) => {
      const rawUrl = typeof input === 'string' ? input : input?.url;
      const url = new URL(rawUrl || '', location.href);
      if (url.origin === 'https://trainerhub.cc' && url.pathname === '/api/auth/me') {
        return new Response(JSON.stringify({ user: smokeUser }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.origin === 'https://trainerhub.cc' && url.pathname === '/api/auth/session') {
        return new Response(JSON.stringify({ token: smokeToken, user: smokeUser }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.origin === 'https://trainerhub.cc' && url.pathname === '/api/records') {
        if (String(init?.method || 'GET').toUpperCase() === 'POST') {
          smokeState.savedPayloads.push(JSON.parse(String(init?.body || '{}')));
          return new Response(JSON.stringify({ ok: true }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ records: [], count: 0 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return originalFetch(input, init);
    };

    const eyePatchData = new Uint8ClampedArray(20 * 12 * 4);
    for (let y = 0; y < 12; y += 1) {
      for (let x = 0; x < 20; x += 1) {
        const index = (y * 20 + x) * 4;
        const dark = Math.hypot(x - 9.5, y - 5.5) <= 3;
        const value = dark ? 18 : 220;
        eyePatchData[index] = value;
        eyePatchData[index + 1] = value;
        eyePatchData[index + 2] = value;
        eyePatchData[index + 3] = 255;
      }
    }
    const eyeFeatures = {
      left: { patch: { data: eyePatchData, width: 20, height: 12 }, width: 20, height: 12 },
      right: { patch: { data: eyePatchData, width: 20, height: 12 }, width: 20, height: 12 },
    };

    const EnsureWebGazerDom = () => {
      let container = document.querySelector('#webgazerVideoContainer');
      if (container) return container;
      container = document.createElement('div');
      container.id = 'webgazerVideoContainer';
      container.style.cssText = 'position:fixed;z-index:99999;top:20px;left:20px;width:320px;height:240px';
      const video = document.createElement('video');
      video.id = 'webgazerVideoFeed';
      Object.defineProperty(video, 'videoWidth', { configurable: true, value: 640 });
      Object.defineProperty(video, 'videoHeight', { configurable: true, value: 480 });
      const canvas = document.createElement('canvas');
      canvas.id = 'webgazerVideoCanvas';
      canvas.width = 640;
      canvas.height = 480;
      const overlay = document.createElement('canvas');
      overlay.id = 'webgazerFaceOverlay';
      overlay.width = 640;
      overlay.height = 480;
      const feedback = document.createElement('div');
      feedback.id = 'webgazerFaceFeedbackBox';
      feedback.style.cssText = 'position:absolute;inset:20px;border:3px solid green';
      container.append(video, canvas, overlay, feedback);
      document.body.appendChild(container);
      const gazeDot = document.createElement('div');
      gazeDot.id = 'webgazerGazeDot';
      gazeDot.style.cssText = 'display:none;position:fixed;width:12px;height:12px;border-radius:50%;background:red;z-index:100000';
      document.body.appendChild(gazeDot);
      return container;
    };

    const SetEye = (positions, indexes, originX, closed) => {
      const vertical = closed ? 0.0015 : 0.012;
      positions[indexes[0]] = [originX, 0.42, 0];
      positions[indexes[1]] = [originX + 0.06, 0.42, 0];
      positions[indexes[2]] = [originX + 0.018, 0.42 - vertical / 2, 0];
      positions[indexes[3]] = [originX + 0.018, 0.42 + vertical / 2, 0];
      positions[indexes[4]] = [originX + 0.042, 0.42 - vertical / 2, 0];
      positions[indexes[5]] = [originX + 0.042, 0.42 + vertical / 2, 0];
    };
    const GetPositions = () => {
      const positions = Array.from({ length: 468 }, () => [0, 0, 0]);
      const span = smokeState.headState === 'too-far'
        ? 0.12
        : smokeState.headState === 'too-close'
          ? 0.62
          : 0.38;
      positions[234] = [0.5 - span / 2, 0.5, 0];
      positions[454] = [0.5 + span / 2, 0.5, 0];
      const closed = (
        smokeState.trainingTick >= 12 && smokeState.trainingTick <= 14
      ) || (
        smokeState.trainingTick >= 24 && smokeState.trainingTick <= 26
      );
      SetEye(positions, [33, 133, 159, 145, 158, 153], 0.29, closed);
      SetEye(positions, [362, 263, 386, 374, 385, 380], 0.65, closed);
      return positions;
    };
    const PredictionTarget = () => {
      const canvas = document.querySelector('.oculomotor-training-trial canvas');
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const hudHeight = Math.max(58, Math.min(72, rect.height * 0.09));
        return { x: rect.left + rect.width / 2, y: rect.top + (rect.height + hudHeight) / 2 };
      }
      const point = document.querySelector('#webgazer-validate-container .validation-point');
      if (point) {
        const rect = point.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      }
      return { x: innerWidth / 2, y: innerHeight / 2 };
    };
    const MakePrediction = () => {
      const target = PredictionTarget();
      // Seven deliberately different offsets keep the accepted 10 Hz samples
      // from phase-locking with this mock's 25 Hz callback interval.
      const offsets = [[-4, -1], [-1, 3], [2, -2], [4, 1], [1, 2], [-2, -3], [0, 1]];
      const offset = offsets[smokeState.predictionCounter % offsets.length];
      smokeState.predictionCounter += 1;
      return {
        x: target.x + offset[0],
        y: target.y + offset[1],
        t: performance.now(),
        eyeFeatures,
      };
    };

    let mouseCalibrationListener = null;
    let gazeTimer = null;
    const webgazer = window.webgazer = {
      params: {},
      begin() {
        EnsureWebGazerDom();
        if (!gazeTimer) {
          gazeTimer = setInterval(() => {
            if (!smokeState.active || typeof smokeState.gazeListener !== 'function') return;
            smokeState.trainingTick += 1;
            const prediction = MakePrediction();
            const dot = document.querySelector('#webgazerGazeDot');
            if (dot) {
              dot.style.left = prediction.x + 'px';
              dot.style.top = prediction.y + 'px';
            }
            smokeState.gazeListener(prediction, performance.now());
          }, 40);
        }
        return Promise.resolve(webgazer);
      },
      pause() { smokeState.active = false; return webgazer; },
      resume() { smokeState.active = true; return webgazer; },
      clearData() { smokeState.calibrationClicks = 0; return Promise.resolve(); },
      getCurrentPrediction() { return Promise.resolve(MakePrediction()); },
      getTracker() { return { predictionReady: true, getPositions: GetPositions }; },
      getVideoElementCanvas() { return document.querySelector('#webgazerVideoCanvas'); },
      showVideo(show) { EnsureWebGazerDom().style.display = show ? 'block' : 'none'; return webgazer; },
      showFaceOverlay(show) {
        const overlay = EnsureWebGazerDom().querySelector('#webgazerFaceOverlay');
        overlay.style.display = show ? 'block' : 'none';
        return webgazer;
      },
      showFaceFeedbackBox(show) {
        const box = EnsureWebGazerDom().querySelector('#webgazerFaceFeedbackBox');
        box.style.display = show ? 'block' : 'none';
        box.style.borderColor = 'green';
        return webgazer;
      },
      showPredictionPoints(show) {
        const phase = document.querySelector('.oculomotor-training-trial') ? 'training'
          : document.querySelector('#webgazer-validate-container') ? 'validation'
            : document.querySelector('#webgazer-calibrate-container') ? 'calibration'
              : 'other';
        smokeState.predictionPointCalls.push({ show: Boolean(show), phase });
        const dot = document.querySelector('#webgazerGazeDot');
        if (dot) dot.style.display = show ? 'block' : 'none';
        return webgazer;
      },
      addMouseEventListeners() {
        smokeState.mouseCalibrationStarts += 1;
        mouseCalibrationListener = (event) => {
          if (event.target?.id === 'calibration-point') smokeState.calibrationClicks += 1;
        };
        document.addEventListener('click', mouseCalibrationListener, true);
        return webgazer;
      },
      removeMouseEventListeners() {
        if (mouseCalibrationListener) document.removeEventListener('click', mouseCalibrationListener, true);
        mouseCalibrationListener = null;
        return webgazer;
      },
      recordScreenPosition() { smokeState.calibrationClicks += 1; return webgazer; },
      setGazeListener(listener) {
        smokeState.gazeListener = listener;
        smokeState.trainingTick = 0;
        return webgazer;
      },
      clearGazeListener() { smokeState.gazeListener = null; return webgazer; },
      stopVideo() { return webgazer; },
      end() {
        smokeState.active = false;
        smokeState.gazeListener = null;
        if (gazeTimer) clearInterval(gazeTimer);
        gazeTimer = null;
        return webgazer;
      },
    };

    HTMLElement.prototype.requestFullscreen = function () { return Promise.resolve(); };
    document.exitFullscreen = function () { return Promise.resolve(); };
  `;
}

async function ReadHeadState(cdpClient, targetSessionId) {
  return Evaluate(cdpClient, targetSessionId, `(() => {
    const button = document.querySelector('#jspsych-wg-cont');
    const status = document.querySelector('#webgazer-init-status');
    return {
      disabled: button?.disabled ?? null,
      hasNativeContainer: Boolean(document.querySelector('#webgazer-init-container')),
      state: status?.dataset.state ?? null,
      text: status?.textContent?.trim() ?? '',
    };
  })()`);
}

async function SetHeadState(cdpClient, targetSessionId, state) {
  await Evaluate(cdpClient, targetSessionId, `window.__wgSmoke.headState = ${JSON.stringify(state)}; true`);
}

async function WaitForHeadState(cdpClient, targetSessionId, state, waitTimeoutMs) {
  const startedAt = Date.now();
  let lastState;
  while (Date.now() - startedAt < waitTimeoutMs) {
    lastState = await ReadHeadState(cdpClient, targetSessionId);
    if (lastState.state === state) return lastState;
    await Wait(80);
  }
  throw new Error(`Timed out waiting for head state ${state}.\n${JSON.stringify(lastState, null, 2)}`);
}

async function ClickDomSelector(cdpClient, targetSessionId, selector) {
  const state = await Evaluate(cdpClient, targetSessionId, `(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!(element instanceof HTMLElement)) return null;
    const disabled = element instanceof HTMLButtonElement && element.disabled;
    if (!disabled) element.click();
    return { disabled };
  })()`);
  assert.ok(state, `Unable to find clickable selector ${selector}`);
  assert.equal(state.disabled, false, `${selector} is disabled`);
  await Wait(25);
}

async function WaitForSelector(cdpClient, targetSessionId, selector, waitTimeoutMs) {
  await WaitForValue(
    cdpClient,
    targetSessionId,
    `Boolean(document.querySelector(${JSON.stringify(selector)}))`,
    waitTimeoutMs,
    selector,
  );
}

async function WaitForValue(cdpClient, targetSessionId, expression, waitTimeoutMs, label = expression) {
  const startedAt = Date.now();
  let lastState;
  while (Date.now() - startedAt < waitTimeoutMs) {
    lastState = await Evaluate(cdpClient, targetSessionId, `(() => ({
      matched: Boolean(${expression}),
      href: location.href,
      bodyText: document.body.innerText.slice(0, 1200),
    }))()`);
    if (lastState?.matched) return;
    await Wait(100);
  }
  throw new Error(`Timed out waiting for ${label}.\n${JSON.stringify(lastState, null, 2)}`);
}

function AssertNoCriticalBrowserFailures(events, targetSessionId, targetUrl) {
  const exceptions = events
    .filter((event) => event.sessionId === targetSessionId && event.method === 'Runtime.exceptionThrown')
    .map((event) => event.params.exceptionDetails.exception?.description
      ?? event.params.exceptionDetails.text);
  const requests = new Map(events
    .filter((event) => event.sessionId === targetSessionId && event.method === 'Network.requestWillBeSent')
    .map((event) => [event.params.requestId, {
      type: event.params.type,
      url: event.params.request.url,
    }]));
  const failedResources = events
    .filter((event) => event.sessionId === targetSessionId && event.method === 'Network.loadingFailed')
    .map((event) => ({ ...event.params, request: requests.get(event.params.requestId) }))
    .filter((event) => ['Document', 'Script', 'Stylesheet'].includes(event.request?.type))
    .filter((event) => IsSameOrigin(event.request?.url, targetUrl))
    .map((event) => `${event.request.url}: ${event.errorText}`);
  const errorResponses = events
    .filter((event) => event.sessionId === targetSessionId && event.method === 'Network.responseReceived')
    .filter((event) => ['Document', 'Script', 'Stylesheet'].includes(event.params.type))
    .filter((event) => event.params.response.status >= 400)
    .filter((event) => IsSameOrigin(event.params.response.url, targetUrl))
    .map((event) => `${event.params.response.url}: HTTP ${event.params.response.status}`);

  assert.deepEqual(exceptions, [], `Runtime exceptions:\n${exceptions.join('\n')}`);
  assert.deepEqual(failedResources, [], `Failed critical resources:\n${failedResources.join('\n')}`);
  assert.deepEqual(errorResponses, [], `Critical HTTP errors:\n${errorResponses.join('\n')}`);
}

async function Evaluate(cdpClient, targetSessionId, expression) {
  const result = await cdpClient.Send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  }, targetSessionId);
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  }
  return result.result.value;
}

function FindBrowserPath() {
  const candidates = [
    process.env.BROWSER_EXECUTABLE_PATH,
    process.env.EDGE_BIN,
    process.env.CHROME_BIN,
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    ...FindWindowsVersionedBrowsers('C:/Program Files (x86)/Microsoft/EdgeCore'),
    ...FindWindowsVersionedBrowsers('C:/Program Files (x86)/Microsoft/EdgeWebView/Application'),
  ];
  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  for (const command of ['brave', 'msedge', 'microsoft-edge', 'google-chrome', 'chrome', 'chromium']) {
    const result = spawnSync(command, ['--version'], { encoding: 'utf8' });
    if (!result.error && result.status === 0) return command;
  }
  return null;
}

function FindWindowsVersionedBrowsers(parentDir) {
  if (!existsSync(parentDir)) return [];
  return readdirSync(parentDir)
    .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }))
    .map((entry) => join(parentDir, entry, 'msedge.exe'))
    .filter((candidate) => existsSync(candidate));
}

function GetAvailablePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => {
        if (typeof address === 'object' && address?.port) resolvePort(address.port);
        else reject(new Error('Unable to allocate a local port.'));
      });
    });
    server.on('error', reject);
  });
}

function GetHttp(url) {
  return new Promise((resolveResponse, reject) => {
    const request = http.get(url, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => resolveResponse({ status: response.statusCode, body }));
    });
    request.on('error', reject);
    request.setTimeout(1500, () => request.destroy(new Error(`Timed out requesting ${url}`)));
  });
}

async function WaitForHttp(url, label) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 20_000) {
    try {
      const response = await GetHttp(url);
      if (response.status) return response;
    } catch {}
    await Wait(200);
  }
  throw new Error(`${label} did not become ready at ${url}`);
}

function IsSameOrigin(candidate, target) {
  if (!candidate) return false;
  try { return new URL(candidate).origin === new URL(target).origin; } catch { return false; }
}

function Wait(durationMs) {
  return new Promise((resolveWait) => setTimeout(resolveWait, durationMs));
}

function StopProcess(childProcess) {
  if (!childProcess || childProcess.exitCode !== null) return Promise.resolve();
  return new Promise((resolveStop) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolveStop();
    };
    childProcess.once('exit', finish);
    childProcess.kill();
    setTimeout(() => {
      if (childProcess.exitCode === null) childProcess.kill('SIGKILL');
      finish();
    }, 2500);
  });
}

async function ConnectCdp(webSocketDebuggerUrl) {
  const ws = new WebSocket(webSocketDebuggerUrl);
  await new Promise((resolveOpen, reject) => {
    ws.addEventListener('open', resolveOpen, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  let nextId = 0;
  const pending = new Map();
  const events = [];
  ws.addEventListener('message', (message) => {
    const data = JSON.parse(message.data);
    if (data.id && pending.has(data.id)) {
      const item = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) item.reject(new Error(`${item.method}: ${JSON.stringify(data.error)}`));
      else item.resolve(data.result);
      return;
    }
    events.push(data);
  });

  const Send = (method, params, targetSessionId) => {
    nextId += 1;
    ws.send(JSON.stringify(targetSessionId
      ? { id: nextId, sessionId: targetSessionId, method, params }
      : { id: nextId, method, params }));
    return new Promise((resolveSend, reject) => {
      pending.set(nextId, { resolve: resolveSend, reject, method });
    });
  };

  return { Send, events, ws };
}
