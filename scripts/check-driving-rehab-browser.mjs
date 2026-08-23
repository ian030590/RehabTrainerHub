#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import http from 'node:http';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const appDir = resolve(repoRoot, 'apps', 'rehabtrainerhub', 'training-runtimes', 'vision');
const distDir = resolve(appDir, 'dist');
const distIndex = resolve(distDir, 'index.html');
const viteBin = resolve(repoRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const browserPath = FindBrowserPath();
const timeoutMs = 45_000;

if (!existsSync(distIndex)) {
  throw new Error(`Hub vision runtime output is missing: ${distIndex}\nRun npm run build:hub first.`);
}
if (!existsSync(viteBin)) {
  throw new Error(`Vite preview executable is missing: ${viteBin}`);
}
if (!browserPath) {
  throw new Error('No Chromium-based browser executable was found for the driving browser smoke test.');
}

const previewPort = await GetAvailablePort();
const debugPort = await GetAvailablePort();
const browserProfileDir = mkdtempSync(join(tmpdir(), 'driving-rehab-browser-'));
const route = '/#/training?module=driving-rehab&redFlash=true&drivingDifficulty=beginner&controlMode=arrow&renderQuality=high';
const navigationUrl = `http://127.0.0.1:${previewPort}/?drivingSmoke=runtime${route}`;
const touchNavigationUrl = `http://127.0.0.1:${previewPort}/?drivingSmoke=touch#/training?module=driving-rehab&redFlash=true&drivingDifficulty=beginner&controlMode=touch&renderQuality=high`;
const homeUrl = `http://127.0.0.1:${previewPort}/#/`;

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
    distDir,
    '--logLevel',
    'warn',
  ], {
    cwd: appDir,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  previewProcess.stdout.on('data', (chunk) => { previewLogs += chunk; });
  previewProcess.stderr.on('data', (chunk) => { previewLogs += chunk; });
  await WaitForHttp(`http://127.0.0.1:${previewPort}/`, 'VisionTrainer production preview');

  browserProcess = spawn(browserPath, [
    '--headless=new',
    '--no-sandbox',
    '--no-first-run',
    '--disable-dev-shm-usage',
    '--enable-webgl',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--use-angle=swiftshader',
    '--window-size=1500,1000',
    `--user-data-dir=${browserProfileDir}`,
    `--remote-debugging-port=${debugPort}`,
    'about:blank',
  ], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
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
  await SetViewport(cdp, sessionId, 1500, 1000);
  await cdp.Send('Page.addScriptToEvaluateOnNewDocument', {
    source: CreateBootstrapSource(),
  }, sessionId);

  await cdp.Send('Page.navigate', { url: homeUrl }, sessionId);
  await WaitForSelector(cdp, sessionId, '.selection-card', timeoutMs);
  await ClickDrivingModuleCard(cdp, sessionId, timeoutMs);
  await WaitForSelector(
    cdp,
    sessionId,
    '.config-modal-panel[role="dialog"] .training-option-grid-four',
    timeoutMs,
  );
  await WaitForAnimationFrames(cdp, sessionId, 2);

  const lockedConfigState = await ReadDrivingConfigState(cdp, sessionId);
  AssertDrivingConfigState(lockedConfigState, {
    label: 'before keyboard confirmation',
    disabledControls: [true, true, true, true],
    actionDisabled: true,
    keyboardEventExpected: false,
  });

  await DispatchTrustedKeyboardEvent(cdp, sessionId);
  await WaitForDrivingConfigControls(
    cdp,
    sessionId,
    [false, false, true, true],
    timeoutMs,
  );
  const keyboardConfigState = await ReadDrivingConfigState(cdp, sessionId);
  AssertDrivingConfigState(keyboardConfigState, {
    label: 'after trusted keyboard confirmation',
    disabledControls: [false, false, true, true],
    actionDisabled: false,
    keyboardEventExpected: true,
  });

  await cdp.Send('Page.navigate', { url: navigationUrl }, sessionId);

  await WaitForSelector(cdp, sessionId, '.experiment-container section[role="alert"]', timeoutMs);
  const guardedBeforeKeyboard = await Evaluate(cdp, sessionId, `({
    gate: Boolean(document.querySelector('.experiment-container section[role="alert"]')),
    canvas: Boolean(document.querySelector('.driving-rehab-root canvas')),
  })`);
  assert.deepEqual(guardedBeforeKeyboard, { gate: true, canvas: false });
  await DispatchTrustedKeyboardEvent(cdp, sessionId);
  await WaitForDrivingReady(cdp, sessionId, timeoutMs);
  await WaitForAnimationFrames(cdp, sessionId, 3);
  const initialState = await ReadDrivingViewportState(cdp, sessionId);
  AssertDrivingViewport(initialState, {
    label: '3:2 at DPR 1.5',
    cssWidth: 1500,
    cssHeight: 1000,
    pixelRatio: 1.5,
  });

  await SetViewport(cdp, sessionId, 1200, 900);
  await Evaluate(cdp, sessionId, `window.dispatchEvent(new Event('resize')); true`);
  await WaitForDrivingLayout(cdp, sessionId, {
    cssWidth: 1200,
    cssHeight: 900,
    pixelRatio: 1.5,
  }, timeoutMs);
  await WaitForAnimationFrames(cdp, sessionId, 3);
  const resizedState = await ReadDrivingViewportState(cdp, sessionId);
  AssertDrivingViewport(resizedState, {
    label: '4:3 after resize at DPR 1.5',
    cssWidth: 1200,
    cssHeight: 900,
    pixelRatio: 1.5,
  });

  await SetViewport(cdp, sessionId, 1001, 667);
  await Evaluate(cdp, sessionId, `window.dispatchEvent(new Event('resize')); true`);
  await WaitForDrivingLayout(cdp, sessionId, {
    cssWidth: 1001,
    cssHeight: 667,
    pixelRatio: 1.5,
  }, timeoutMs);
  await WaitForAnimationFrames(cdp, sessionId, 3);
  const fractionalState = await ReadDrivingViewportState(cdp, sessionId);
  AssertDrivingViewport(fractionalState, {
    label: 'fractional backing buffer after resize at DPR 1.5',
    cssWidth: 1001,
    cssHeight: 667,
    pixelRatio: 1.5,
  });

  await SetViewport(cdp, sessionId, 360, 640);
  await cdp.Send('Page.navigate', { url: touchNavigationUrl }, sessionId);
  await WaitForDrivingReady(cdp, sessionId, timeoutMs);
  await WaitForAnimationFrames(cdp, sessionId, 3);
  const portraitViewportState = await ReadDrivingViewportState(cdp, sessionId);
  AssertDrivingViewport(portraitViewportState, {
    label: 'portrait 9:16 touch layout at DPR 1.5',
    cssWidth: 360,
    cssHeight: 640,
    pixelRatio: 1.5,
    maxTouchPoints: 5,
    touchControls: 1,
  });
  const portraitTouchState = await ReadTouchControlState(cdp, sessionId);
  AssertPortraitTouchControls(portraitTouchState);
  const wheelPressState = await PressTouchControl(cdp, sessionId, 'Steer left', '[data-driving-control-visual="wheel"]');
  assert.match(wheelPressState.pressedTransform, /rotate\(-28deg\)/, 'steering wheel must turn left while pressed');
  assert.match(wheelPressState.releasedTransform, /rotate\(0deg\)/, 'steering wheel must return after release');
  const brakePressState = await PressTouchControl(cdp, sessionId, 'Brake', 'button[aria-label="Brake"]');
  assert.match(brakePressState.pressedTransform, /rotateX\(-14deg\)/, 'brake pedal must depress while pressed');
  assert.equal(brakePressState.releasedTransform, 'none', 'brake pedal must return after release');
  const cameraPressState = await PressTouchCameraControl(cdp, sessionId);
  assert.ok(
    NearlyEqual(cameraPressState.beforeCenterX, cameraPressState.afterCenterX, 0.5),
    `CAM control shifted horizontally after press: ${JSON.stringify(cameraPressState)}`,
  );
  assert.match(
    cameraPressState.transform,
    /translateX\(-50%\)/,
    'CAM press must preserve its centering transform',
  );
  await SetViewport(cdp, sessionId, 320, 568);
  await Evaluate(cdp, sessionId, `window.dispatchEvent(new Event('resize')); true`);
  await WaitForDrivingLayout(cdp, sessionId, {
    cssWidth: 320,
    cssHeight: 568,
    pixelRatio: 1.5,
  }, timeoutMs);
  await WaitForAnimationFrames(cdp, sessionId, 3);
  const narrowPortraitViewportState = await ReadDrivingViewportState(cdp, sessionId);
  AssertDrivingViewport(narrowPortraitViewportState, {
    label: 'narrow portrait touch layout at DPR 1.5',
    cssWidth: 320,
    cssHeight: 568,
    pixelRatio: 1.5,
    maxTouchPoints: 5,
    touchControls: 1,
  });
  const narrowPortraitTouchState = await ReadTouchControlState(cdp, sessionId);
  AssertPortraitTouchControls(narrowPortraitTouchState);

  AssertNoCriticalBrowserFailures(cdp.events, sessionId, navigationUrl);

  console.log([
    'Driving rehab browser smoke passed.',
    `3:2: ${FormatStateSummary(initialState)}`,
    `4:3: ${FormatStateSummary(resizedState)}`,
    `Fractional buffer: ${FormatStateSummary(fractionalState)}`,
    `Portrait: ${FormatStateSummary(portraitViewportState)}`,
    `Narrow portrait: ${FormatStateSummary(narrowPortraitViewportState)}`,
    `WebGL: ${initialState.webgl.renderer}`,
    'Touch controls: absent with coarse pointer and maxTouchPoints=0.',
    `Config before keyboard: ${FormatConfigSummary(lockedConfigState)}.`,
    `Config after trusted keyboard: ${FormatConfigSummary(keyboardConfigState)}.`,
    `Portrait touch controls: ${portraitTouchState.buttons.length} non-overlapping buttons.`,
    'CAM touch press: centering transform preserved.',
    `Narrow portrait touch controls: ${narrowPortraitTouchState.buttons.length} non-overlapping buttons.`,
  ].join('\n'));
} catch (error) {
  console.error(error.stack || error);
  if (previewLogs.trim()) console.error(`\nPreview logs:\n${previewLogs.slice(-4000)}`);
  if (browserLogs.trim()) console.error(`\nBrowser logs:\n${browserLogs.slice(-4000)}`);
  process.exitCode = 1;
} finally {
  if (cdp?.ws.readyState === WebSocket.OPEN) {
    try {
      await cdp.Send('Browser.close');
    } catch {}
  }
  cdp?.ws.close();
  await StopProcess(browserProcess);
  await StopProcess(previewProcess);
  rmSync(browserProfileDir, {
    recursive: true,
    force: true,
    maxRetries: 8,
    retryDelay: 250,
  });
}

function CreateBootstrapSource() {
  const tokenPayload = Buffer.from(JSON.stringify({
    sub: 'driving-browser-smoke-user',
    name: 'Driving Browser Smoke',
    email: 'driving-browser-smoke@example.test',
  })).toString('base64url');
  const token = `${tokenPayload}.driving-browser-smoke-signature`;
  const user = {
    id: 'driving-browser-smoke-user',
    displayName: 'Driving Browser Smoke',
    email: 'driving-browser-smoke@example.test',
    profileCompleted: true,
    privacyAcceptedAt: '2026-01-01T00:00:00.000Z',
  };

  return `
    history.replaceState({ usr: { configAndRulesCompleted: true } }, '', location.href);
    localStorage.setItem('rehabtrainerhub.auth.token', ${JSON.stringify(token)});
    localStorage.setItem('vision_trainer_active_user', 'Driving Browser Smoke');
    localStorage.setItem('vision_trainer_language', 'en');
    localStorage.setItem('vision_trainer_oculomotorEnableWebgazer', 'false');
    localStorage.setItem('vision_trainer_drivingControlMode', 'arrow');
    localStorage.setItem('vision_trainer_drivingRenderQuality', 'high');

    Object.defineProperty(navigator, 'maxTouchPoints', {
      configurable: true,
      get: () => location.hash.includes('controlMode=touch') ? 5 : 0,
    });
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: () => [],
    });
    const drivingSmokeMatchMedia = window.matchMedia.bind(window);
    window.matchMedia = (query) => {
      const result = drivingSmokeMatchMedia(query);
      if (String(query).replace(/\\s+/g, ' ').trim() !== '(pointer: coarse)') return result;
      return new Proxy(result, {
        get(target, property) {
          if (property === 'matches') return true;
          const value = Reflect.get(target, property, target);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
    };

    const drivingSmokeUser = ${JSON.stringify(user)};
    const drivingSmokeToken = ${JSON.stringify(token)};
    const drivingSmokeFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const rawUrl = typeof input === 'string' ? input : input?.url;
      const url = new URL(rawUrl || '', location.href);
      if (url.origin === 'https://trainerhub.cc' && url.pathname === '/api/auth/me') {
        return Promise.resolve(new Response(JSON.stringify({ user: drivingSmokeUser }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }));
      }
      if (url.origin === 'https://trainerhub.cc' && url.pathname === '/api/auth/session') {
        return Promise.resolve(new Response(JSON.stringify({ token: drivingSmokeToken, user: drivingSmokeUser }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }));
      }
      if (url.origin === 'https://trainerhub.cc' && url.pathname === '/api/records') {
        return Promise.resolve(new Response(JSON.stringify({ ok: true, records: [], count: 0 }), {
          status: init?.method === 'POST' ? 201 : 200,
          headers: { 'Content-Type': 'application/json' },
        }));
      }
      return drivingSmokeFetch(input, init);
    };

    window.__drivingSmokeKeyboardEvent = null;
    window.addEventListener('keydown', (event) => {
      window.__drivingSmokeKeyboardEvent = {
        code: event.code,
        isTrusted: event.isTrusted,
        key: event.key,
      };
    }, true);

    HTMLElement.prototype.requestFullscreen = function () { return Promise.resolve(); };
    document.exitFullscreen = function () { return Promise.resolve(); };
  `;
}

async function SetViewport(cdpClient, targetSessionId, width, height) {
  await cdpClient.Send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1.5,
    mobile: false,
    screenWidth: width,
    screenHeight: height,
  }, targetSessionId);
}

async function WaitForDrivingReady(cdpClient, targetSessionId, waitTimeoutMs) {
  const startedAt = Date.now();
  let lastState;
  while (Date.now() - startedAt < waitTimeoutMs) {
    lastState = await Evaluate(cdpClient, targetSessionId, `(() => {
      const root = document.querySelector('.driving-rehab-root');
      const canvas = root?.querySelector(':scope > canvas');
      return {
        href: location.href,
        ready: root instanceof HTMLElement
          && canvas instanceof HTMLCanvasElement
          && root.getAttribute('aria-busy') === 'false',
        rootBusy: root?.getAttribute('aria-busy') ?? null,
        hasCanvas: canvas instanceof HTMLCanvasElement,
        hasLoadingStatus: Boolean(root?.querySelector(':scope > [role="status"]')),
        bodyText: document.body.innerText.slice(0, 1200),
      };
    })()`);
    if (lastState?.ready) return;
    await Wait(100);
  }
  throw new Error(`Timed out waiting for the driving canvas and loading completion.\n${JSON.stringify(lastState, null, 2)}`);
}

async function WaitForDrivingLayout(cdpClient, targetSessionId, expected, waitTimeoutMs) {
  const startedAt = Date.now();
  let lastState;
  while (Date.now() - startedAt < waitTimeoutMs) {
    lastState = await ReadDrivingViewportState(cdpClient, targetSessionId);
    const expectedBufferWidth = Math.floor(expected.cssWidth * expected.pixelRatio);
    const expectedBufferHeight = Math.floor(expected.cssHeight * expected.pixelRatio);
    if (
      NearlyEqual(lastState.root.width, expected.cssWidth)
      && NearlyEqual(lastState.root.height, expected.cssHeight)
      && NearlyEqual(lastState.canvas.cssWidth, expected.cssWidth)
      && NearlyEqual(lastState.canvas.cssHeight, expected.cssHeight)
      && lastState.canvas.width === expectedBufferWidth
      && lastState.canvas.height === expectedBufferHeight
      && NearlyEqual(Number(lastState.dataset.aspect), expected.cssWidth / expected.cssHeight, 0.000001)
      && NearlyEqual(Number(lastState.dataset.pixelRatio), expected.pixelRatio, 0.000001)
    ) return;
    await Wait(100);
  }
  throw new Error(`Timed out waiting for the resized driving viewport.\n${JSON.stringify(lastState, null, 2)}`);
}

async function WaitForAnimationFrames(cdpClient, targetSessionId, frameCount) {
  await Evaluate(cdpClient, targetSessionId, `new Promise((resolve) => {
    let remaining = ${JSON.stringify(frameCount)};
    const next = () => {
      remaining -= 1;
      if (remaining <= 0) resolve(true);
      else requestAnimationFrame(next);
    };
    requestAnimationFrame(next);
  })`);
}

async function WaitForSelector(cdpClient, targetSessionId, selector, waitTimeoutMs) {
  const startedAt = Date.now();
  let lastState;
  while (Date.now() - startedAt < waitTimeoutMs) {
    lastState = await Evaluate(cdpClient, targetSessionId, `({
      href: location.href,
      readyState: document.readyState,
      matched: Boolean(document.querySelector(${JSON.stringify(selector)})),
      bodyText: document.body.innerText.slice(0, 1200),
    })`);
    if (lastState?.readyState !== 'loading' && lastState?.matched) return;
    await Wait(100);
  }
  throw new Error(`Timed out waiting for ${selector}.\n${JSON.stringify(lastState, null, 2)}`);
}

async function ClickDrivingModuleCard(cdpClient, targetSessionId, waitTimeoutMs) {
  const startedAt = Date.now();
  let lastState;
  while (Date.now() - startedAt < waitTimeoutMs) {
    lastState = await Evaluate(cdpClient, targetSessionId, `(() => {
      const cards = Array.from(document.querySelectorAll('button.selection-card'));
      const card = cards.find((candidate) => (
        candidate.querySelector('img')?.src.includes('/driving-rehab.webp')
      ));
      if (!(card instanceof HTMLButtonElement)) {
        return {
          found: false,
          cards: cards.map((candidate) => ({
            image: candidate.querySelector('img')?.src ?? '',
            title: candidate.querySelector('.card-title')?.textContent?.trim() ?? '',
          })),
        };
      }
      card.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
      const rect = card.getBoundingClientRect();
      return {
        found: true,
        disabled: card.disabled,
        height: rect.height,
        title: card.querySelector('.card-title')?.textContent?.trim() ?? '',
        width: rect.width,
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    })()`);
    if (lastState?.found && !lastState.disabled && lastState.width > 1 && lastState.height > 1) {
      await cdpClient.Send('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x: lastState.x,
        y: lastState.y,
        button: 'left',
        clickCount: 1,
      }, targetSessionId);
      await cdpClient.Send('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x: lastState.x,
        y: lastState.y,
        button: 'left',
        clickCount: 1,
      }, targetSessionId);
      return;
    }
    await Wait(100);
  }
  throw new Error(`Unable to click the driving module card.\n${JSON.stringify(lastState, null, 2)}`);
}

async function PressTouchCameraControl(cdpClient, targetSessionId) {
  const before = await Evaluate(cdpClient, targetSessionId, `(() => {
    const camera = document.querySelector('[data-driving-control-group="camera"]');
    if (!(camera instanceof HTMLButtonElement)) return null;
    const rect = camera.getBoundingClientRect();
    return { centerX: rect.left + rect.width / 2, centerY: rect.top + rect.height / 2 };
  })()`);
  assert.ok(before, 'CAM touch control is missing');
  await cdpClient.Send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: before.centerX,
    y: before.centerY,
    button: 'left',
    clickCount: 1,
  }, targetSessionId);
  await cdpClient.Send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: before.centerX,
    y: before.centerY,
    button: 'left',
    clickCount: 1,
  }, targetSessionId);
  await WaitForAnimationFrames(cdpClient, targetSessionId, 1);
  const after = await Evaluate(cdpClient, targetSessionId, `(() => {
    const camera = document.querySelector('[data-driving-control-group="camera"]');
    if (!(camera instanceof HTMLButtonElement)) return null;
    const rect = camera.getBoundingClientRect();
    return {
      centerX: rect.left + rect.width / 2,
      scale: camera.style.scale,
      transform: camera.style.transform,
    };
  })()`);
  assert.ok(after, 'CAM touch control disappeared after press');
  return {
    beforeCenterX: before.centerX,
    afterCenterX: after.centerX,
    scale: after.scale,
    transform: after.transform,
  };
}

async function PressTouchControl(cdpClient, targetSessionId, label, visualSelector) {
  const center = await Evaluate(cdpClient, targetSessionId, `(() => {
    const button = document.querySelector('button[aria-label=${JSON.stringify(label)}]');
    if (!(button instanceof HTMLButtonElement)) return null;
    const rect = button.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
  assert.ok(center, `${label} touch control is missing`);
  await cdpClient.Send('Input.dispatchMouseEvent', {
    type: 'mousePressed', x: center.x, y: center.y, button: 'left', clickCount: 1,
  }, targetSessionId);
  const pressedTransform = await Evaluate(cdpClient, targetSessionId, `document.querySelector(${JSON.stringify(visualSelector)})?.style.transform`);
  await cdpClient.Send('Input.dispatchMouseEvent', {
    type: 'mouseReleased', x: center.x, y: center.y, button: 'left', clickCount: 1,
  }, targetSessionId);
  const releasedTransform = await Evaluate(cdpClient, targetSessionId, `document.querySelector(${JSON.stringify(visualSelector)})?.style.transform`);
  return { pressedTransform, releasedTransform };
}

async function DispatchTrustedKeyboardEvent(cdpClient, targetSessionId) {
  await cdpClient.Send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'a',
    code: 'KeyA',
    text: 'a',
    unmodifiedText: 'a',
    windowsVirtualKeyCode: 65,
    nativeVirtualKeyCode: 65,
  }, targetSessionId);
  await cdpClient.Send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'a',
    code: 'KeyA',
    windowsVirtualKeyCode: 65,
    nativeVirtualKeyCode: 65,
  }, targetSessionId);
}

async function WaitForDrivingConfigControls(
  cdpClient,
  targetSessionId,
  expectedDisabled,
  waitTimeoutMs,
) {
  const startedAt = Date.now();
  let lastState;
  while (Date.now() - startedAt < waitTimeoutMs) {
    lastState = await ReadDrivingConfigState(cdpClient, targetSessionId);
    if (
      lastState.controls?.length === expectedDisabled.length
      && lastState.controls.every((control, index) => (
        control.disabled === expectedDisabled[index]
      ))
    ) return;
    await Wait(50);
  }
  throw new Error(`Timed out waiting for driving input capability UI.\n${JSON.stringify(lastState, null, 2)}`);
}

async function ReadDrivingConfigState(cdpClient, targetSessionId) {
  return Evaluate(cdpClient, targetSessionId, `(() => {
    const dialog = document.querySelector('.config-modal-panel[role="dialog"]');
    const group = dialog?.querySelector('.training-option-grid-four');
    const controls = Array.from(group?.querySelectorAll('button.training-option') ?? []);
    const action = dialog?.querySelector('.config-start-btn');
    const ReadButton = (button) => {
      if (!(button instanceof HTMLButtonElement)) return null;
      const style = getComputedStyle(button);
      return {
        active: button.classList.contains('active'),
        cursor: style.cursor,
        disabled: button.disabled,
        matchesDisabled: button.matches(':disabled'),
        opacity: Number.parseFloat(style.opacity),
        tagName: button.tagName,
        text: button.querySelector('.training-option-title')?.textContent?.trim()
          ?? button.textContent?.trim()
          ?? '',
      };
    };
    return {
      dialogFound: dialog instanceof HTMLElement,
      controls: controls.map(ReadButton),
      action: ReadButton(action),
      gamepadCount: typeof navigator.getGamepads === 'function'
        ? Array.from(navigator.getGamepads()).filter(Boolean).length
        : null,
      keyboardEvent: window.__drivingSmokeKeyboardEvent,
      pointer: {
        coarse: window.matchMedia('(pointer: coarse)').matches,
        maxTouchPoints: navigator.maxTouchPoints,
      },
    };
  })()`);
}

async function ReadDrivingViewportState(cdpClient, targetSessionId) {
  return Evaluate(cdpClient, targetSessionId, `(() => {
    const root = document.querySelector('.driving-rehab-root');
    const canvas = root?.querySelector(':scope > canvas');
    if (!(root instanceof HTMLElement) || !(canvas instanceof HTMLCanvasElement)) {
      return {
        missing: true,
        href: location.href,
        bodyText: document.body.innerText.slice(0, 1200),
      };
    }
    const rootRect = root.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    const rendererInfo = gl?.getExtension('WEBGL_debug_renderer_info');
    const renderer = gl
      ? String(rendererInfo
        ? gl.getParameter(rendererInfo.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER))
      : '';
    return {
      missing: false,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
      },
      root: {
        width: rootRect.width,
        height: rootRect.height,
        busy: root.getAttribute('aria-busy'),
      },
      canvas: {
        cssWidth: canvasRect.width,
        cssHeight: canvasRect.height,
        width: canvas.width,
        height: canvas.height,
      },
      dataset: {
        aspect: root.dataset.drivingAspect ?? null,
        pixelRatio: canvas.dataset.drivingPixelRatio ?? null,
        refreshHz: root.dataset.drivingRefreshHz ?? null,
        refreshSamples: root.dataset.drivingRefreshSamples ?? null,
      },
      webgl: {
        available: Boolean(gl),
        viewport: gl ? Array.from(gl.getParameter(gl.VIEWPORT)) : null,
        renderer,
      },
      pointer: {
        coarse: window.matchMedia('(pointer: coarse)').matches,
        maxTouchPoints: navigator.maxTouchPoints,
      },
      touchControls: document.querySelectorAll('.driving-touch-controls').length,
    };
  })()`);
}

async function ReadTouchControlState(cdpClient, targetSessionId) {
  return Evaluate(cdpClient, targetSessionId, `(() => {
    const root = document.querySelector('.driving-rehab-root');
    const controls = root?.querySelector('.driving-touch-controls');
    const toRect = (element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
    };
    return {
      root: root ? toRect(root) : null,
      maxTouchPoints: navigator.maxTouchPoints,
      userSelect: controls ? getComputedStyle(controls).userSelect : null,
      buttons: controls ? Array.from(controls.querySelectorAll('button')).map((button) => ({
        label: button.getAttribute('aria-label'),
        ...toRect(button),
      })) : [],
    };
  })()`);
}

function AssertDrivingViewport(state, expected) {
  assert.equal(state.missing, false, `${expected.label}: driving root/canvas is missing`);
  const expectedAspect = expected.cssWidth / expected.cssHeight;
  const expectedBufferWidth = Math.floor(expected.cssWidth * expected.pixelRatio);
  const expectedBufferHeight = Math.floor(expected.cssHeight * expected.pixelRatio);

  assert.equal(state.viewport.width, expected.cssWidth, `${expected.label}: viewport width`);
  assert.equal(state.viewport.height, expected.cssHeight, `${expected.label}: viewport height`);
  assert.ok(
    NearlyEqual(state.viewport.devicePixelRatio, expected.pixelRatio, 0.000001),
    `${expected.label}: expected DPR ${expected.pixelRatio}, received ${state.viewport.devicePixelRatio}`,
  );
  const refreshSamples = Number(state.dataset.refreshSamples);
  if (state.dataset.refreshHz === 'fallback') {
    assert.equal(
      refreshSamples,
      0,
      `${expected.label}: an unreliable headless refresh sample must be reported as unknown`,
    );
  } else {
    assert.ok(Number(state.dataset.refreshHz) > 0, `${expected.label}: measured refresh rate`);
    assert.ok(refreshSamples >= 12, `${expected.label}: refresh sample count`);
  }
  assert.ok(
    NearlyEqual(state.root.width, expected.cssWidth),
    `${expected.label}: root CSS width ${state.root.width}`,
  );
  assert.ok(
    NearlyEqual(state.root.height, expected.cssHeight),
    `${expected.label}: root CSS height ${state.root.height}`,
  );
  assert.ok(
    NearlyEqual(state.canvas.cssWidth, expected.cssWidth),
    `${expected.label}: canvas CSS width ${state.canvas.cssWidth}`,
  );
  assert.ok(
    NearlyEqual(state.canvas.cssHeight, expected.cssHeight),
    `${expected.label}: canvas CSS height ${state.canvas.cssHeight}`,
  );
  assert.equal(state.canvas.width, expectedBufferWidth, `${expected.label}: canvas buffer width`);
  assert.equal(state.canvas.height, expectedBufferHeight, `${expected.label}: canvas buffer height`);
  assert.ok(
    NearlyEqual(Number(state.dataset.aspect), expectedAspect, 0.000001),
    `${expected.label}: dataset aspect ${state.dataset.aspect}`,
  );
  assert.ok(
    NearlyEqual(Number(state.dataset.pixelRatio), expected.pixelRatio, 0.000001),
    `${expected.label}: dataset pixel ratio ${state.dataset.pixelRatio}`,
  );
  assert.equal(state.webgl.available, true, `${expected.label}: WebGL context is unavailable`);
  assert.match(state.webgl.renderer, /SwiftShader/i, `${expected.label}: WebGL must use SwiftShader`);
  assert.deepEqual(
    state.webgl.viewport,
    [0, 0, expectedBufferWidth, expectedBufferHeight],
    `${expected.label}: WebGL VIEWPORT leaked a DPR-scaled render pass`,
  );
  assert.equal(state.pointer.coarse, true, `${expected.label}: coarse-pointer test preload`);
  assert.equal(
    state.pointer.maxTouchPoints,
    expected.maxTouchPoints ?? 0,
    `${expected.label}: maxTouchPoints test preload`,
  );
  assert.equal(
    state.touchControls,
    expected.touchControls ?? 0,
    `${expected.label}: touch control container count`,
  );
}

function AssertDrivingConfigState(state, expected) {
  const expectedLabels = ['Arrow keys', 'WASD', 'USB steering wheel', 'Touchscreen'];
  assert.equal(state.dialogFound, true, `${expected.label}: driving config dialog is missing`);
  assert.equal(state.gamepadCount, 0, `${expected.label}: expected no connected gamepad`);
  assert.equal(state.pointer.coarse, true, `${expected.label}: coarse-pointer test preload`);
  assert.equal(state.pointer.maxTouchPoints, 0, `${expected.label}: maxTouchPoints test preload`);
  assert.deepEqual(
    state.controls.map((control) => control?.text),
    expectedLabels,
    `${expected.label}: driving control option order`,
  );
  assert.deepEqual(
    state.controls.map((control) => control?.disabled),
    expected.disabledControls,
    `${expected.label}: native disabled control states`,
  );
  assert.deepEqual(
    state.controls.map((control) => control?.matchesDisabled),
    expected.disabledControls,
    `${expected.label}: :disabled control states`,
  );
  assert.ok(
    state.controls.every((control) => control?.tagName === 'BUTTON'),
    `${expected.label}: every control option must be a native button`,
  );
  state.controls.forEach((control, index) => {
    if (!expected.disabledControls[index]) return;
    assert.equal(
      control.cursor,
      'not-allowed',
      `${expected.label}: ${control.text} disabled cursor`,
    );
    assert.ok(
      Number.isFinite(control.opacity) && control.opacity < 1,
      `${expected.label}: ${control.text} must look visually disabled`,
    );
  });

  assert.ok(state.action, `${expected.label}: next/start action is missing`);
  assert.equal(state.action.tagName, 'BUTTON', `${expected.label}: action must be a native button`);
  assert.equal(
    state.action.disabled,
    expected.actionDisabled,
    `${expected.label}: next/start native disabled state`,
  );
  assert.equal(
    state.action.matchesDisabled,
    expected.actionDisabled,
    `${expected.label}: next/start :disabled state`,
  );
  if (expected.actionDisabled) {
    assert.equal(state.action.cursor, 'not-allowed', `${expected.label}: next/start disabled cursor`);
    assert.ok(
      Number.isFinite(state.action.opacity) && state.action.opacity < 1,
      `${expected.label}: next/start must look visually disabled`,
    );
  }

  if (expected.keyboardEventExpected) {
    assert.deepEqual(state.keyboardEvent, {
      code: 'KeyA',
      isTrusted: true,
      key: 'a',
    }, `${expected.label}: CDP keyboard event must be trusted`);
  } else {
    assert.equal(state.keyboardEvent, null, `${expected.label}: keyboard must not be confirmed yet`);
  }
}

function AssertPortraitTouchControls(state) {
  assert.equal(state.maxTouchPoints, 5, 'portrait touch preload');
  assert.ok(state.root, 'portrait driving root is missing');
  assert.equal(state.userSelect, 'none', 'touch-control text must not be selectable');
  assert.equal(state.buttons.length, 5, 'portrait touch button count');
  for (const button of state.buttons) {
    assert.ok(button.width >= 40 && button.height >= 40, `${button.label}: minimum touch target`);
    assert.ok(button.left >= state.root.left && button.right <= state.root.right, `${button.label}: horizontal bounds`);
    assert.ok(button.top >= state.root.top && button.bottom <= state.root.bottom, `${button.label}: vertical bounds`);
  }
  for (let leftIndex = 0; leftIndex < state.buttons.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < state.buttons.length; rightIndex += 1) {
      const left = state.buttons[leftIndex];
      const right = state.buttons[rightIndex];
      const overlaps = left.left < right.right
        && left.right > right.left
        && left.top < right.bottom
        && left.bottom > right.top;
      assert.equal(overlaps, false, `${left.label} overlaps ${right.label}`);
    }
  }
}

function AssertNoCriticalBrowserFailures(events, targetSessionId, targetUrl) {
  const exceptions = events
    .filter((event) => event.sessionId === targetSessionId && event.method === 'Runtime.exceptionThrown')
    .map((event) => event.params.exceptionDetails.exception?.description
      ?? event.params.exceptionDetails.text);
  const requests = new Map(
    events
      .filter((event) => event.sessionId === targetSessionId && event.method === 'Network.requestWillBeSent')
      .map((event) => [event.params.requestId, {
        type: event.params.type,
        url: event.params.request.url,
      }]),
  );
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

function FormatStateSummary(state) {
  return [
    `CSS ${state.canvas.cssWidth}x${state.canvas.cssHeight}`,
    `buffer ${state.canvas.width}x${state.canvas.height}`,
    `aspect ${state.dataset.aspect}`,
    `DPR ${state.dataset.pixelRatio}`,
    `GL viewport [${state.webgl.viewport.join(',')}]`,
  ].join(', ');
}

function FormatConfigSummary(state) {
  const controls = state.controls
    .map((control) => `${control.text}=${control.disabled ? 'disabled' : 'enabled'}`)
    .join(', ');
  return `${controls}; action=${state.action.disabled ? 'disabled' : 'enabled'}`;
}

function NearlyEqual(actual, expected, tolerance = 0.5) {
  return Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance;
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
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ...FindWindowsVersionedBrowsers('C:/Program Files (x86)/Microsoft/EdgeCore'),
    ...FindWindowsVersionedBrowsers('C:/Program Files (x86)/Microsoft/EdgeWebView/Application'),
  ];
  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  for (const command of ['msedge', 'microsoft-edge', 'google-chrome', 'chrome', 'chromium']) {
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
  try {
    return new URL(candidate).origin === new URL(target).origin;
  } catch {
    return false;
  }
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
