import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { basename, dirname, extname, join, resolve, sep } from 'node:path';
import { setTimeout as Delay } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { GapFor, ModelFor, Severity, Simulate } from '../apps/rehabtrainerhub/games/brake-reaction/src/physics.ts';

const viewports = [[320, 568], [360, 640], [390, 844], [768, 1024], [1024, 768], [1280, 800],
  [1440, 900], [1920, 1080], [2560, 1080], [844, 390], [667, 375]];
const copy = {
  zh: { locale: 'zh-TW', title: '跟車煞車反應練習', swerve: '前車換道閃避', timeout: '逾時' },
  en: { locale: 'en-US', title: 'Brake Reaction Practice', swerve: 'Lead vehicle moves aside', timeout: 'Timed out' },
};
const { values } = parseArgs({ options: { viewport: { type: 'string' }, language: { type: 'string' } } });
const selected = viewports.filter(([width, height]) => !values.viewport || values.viewport === width + 'x' + height);
const languages = values.language ? [values.language] : ['zh', 'en'];
assert.ok(selected.length, 'Choose a supported --viewport, for example 390x844.');
assert.ok(languages.every(language => Object.hasOwn(copy, language)), 'Use --language zh or --language en.');

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'apps/rehabtrainerhub/games/brake-reaction/dist');
const output = join(root, '.tmp/brake-reaction-layout');
assert.ok(existsSync(join(dist, 'index.html')), 'Build the brake-reaction game before running this layout check.');
const brave = process.env.BRAVE_BIN || [
  'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', 'brave-browser', 'brave',
].find(candidate => candidate.includes('/') ? existsSync(candidate) : spawnSync(candidate, ['--version'], { stdio: 'ignore' }).status === 0);
assert.ok(brave, 'Install Brave or set BRAVE_BIN to its executable.');

const contentTypes = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(dist, '.' + (pathname === '/' ? '/index.html' : pathname));
    const type = contentTypes[extname(file)];
    if (!file.startsWith(dist + sep) || !type) throw new Error('Unknown asset');
    const bytes = await readFile(file);
    response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }).end(bytes);
  } catch {
    response.writeHead(404).end();
  }
});
await mkdir(output, { recursive: true });
const profile = await mkdtemp(join(output, '.profile-'));
let browser;
let closeDebugger;
try {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = 'http://127.0.0.1:' + server.address().port;
  const pageUrl = origin + '/';
  browser = spawn(brave, [
    '--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--remote-debugging-port=0', '--remote-allow-origins=' + origin, '--user-data-dir=' + profile, pageUrl,
  ], { stdio: ['ignore', 'ignore', 'inherit'], windowsHide: true });
  const connection = await Connect(await WaitForPageDebugger(browser, profile, pageUrl), origin);
  const { Send, Evaluate, errors } = connection;
  closeDebugger = connection.Close;
  await Send('Page.enable');
  await Send('Runtime.enable');
  await Send('Page.addScriptToEvaluateOnNewDocument', {
    source: `(${InstallFixtureClock.toString()})(${JSON.stringify(origin)})`,
  });
  const userAgent = await Evaluate('navigator.userAgent');

  for (const [width, height] of selected) {
    const viewport = width + 'x' + height;
    const outcomes = [];
    for (const language of languages) {
      const tag = viewport + '-' + language;
      const firstError = errors.length;
      const issues = [];
      try {
        const phone = width <= 390 || height <= 390;
        const landscape = width > height;
        await Send('Emulation.setDeviceMetricsOverride', {
          width, height, screenWidth: width, screenHeight: height, deviceScaleFactor: 1, mobile: phone,
          screenOrientation: { type: landscape ? 'landscapePrimary' : 'portraitPrimary', angle: landscape ? 90 : 0 },
        });
        await Send('Emulation.setTouchEmulationEnabled', { enabled: phone });
        await SetReducedMotionPreference(Send, 'no-preference');
        await Send('Network.setUserAgentOverride', { userAgent, acceptLanguage: copy[language].locale });
        await Send('Page.navigate', { url: 'about:blank' });
        await Send('Page.navigate', { url: pageUrl });
        await CheckFlow(connection, { width, height, language, tag }, issues);
      } catch (error) {
        issues.push(error.message);
        await Capture(Send, tag, 'failure').catch(() => undefined);
      }
      issues.push(...errors.slice(firstError).map(error => 'Uncaught page exception: ' + error));
      if (issues.length) {
        process.exitCode = 1;
        outcomes.push(language + ' FAIL (' + issues.map(issue => issue.replace(/\s+/g, ' ')).join(' | ') + ')');
      } else {
        outcomes.push(language + ' PASS');
      }
    }
    console.log(viewport + ' ' + outcomes.join(' | '));
  }
} finally {
  closeDebugger?.();
  if (browser?.exitCode === null) {
    const exited = once(browser, 'exit');
    browser.kill();
    await Promise.race([exited, Delay(2000)]).catch(() => undefined);
  }
  server.close();
  if (dirname(resolve(profile)) === output && basename(profile).startsWith('.profile-')) {
    await rm(profile, { recursive: true, force: true, maxRetries: 5 }).catch(error => {
      console.warn('Could not remove the temporary Brave profile. ' + error.message);
    });
  }
}

async function WaitForPageDebugger(browser, profile, pageUrl) {
  let launchError;
  browser.once('error', error => { launchError = error; });
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (launchError) throw launchError;
    if (browser.exitCode !== null) throw new Error('Brave exited before opening its debugger (' + browser.exitCode + ').');
    try {
      const [port] = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n');
      const response = await fetch('http://127.0.0.1:' + port + '/json/list', { signal: AbortSignal.timeout(1000) });
      const pages = await response.json();
      const page = pages.find(target => target.type === 'page' && target.url === pageUrl);
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      // Brave may publish its port before the debugger accepts requests.
    }
    await Delay(100);
  }
  throw new Error('Timed out waiting for the headless Brave page debugger.');
}

async function Connect(debuggerUrl, origin) {
  const socket = new WebSocket(debuggerUrl, { headers: { origin } });
  const pending = new Map();
  const errors = [];
  let id = 0;
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') {
      const details = message.params.exceptionDetails;
      errors.push(details.exception?.description ?? details.text);
    }
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    clearTimeout(request.timer);
    if (message.error) request.reject(new Error(request.method + ': ' + message.error.message));
    else request.resolve(message.result);
  });
  socket.addEventListener('close', () => {
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(new Error('Brave closed the debugger during ' + request.method));
    }
    pending.clear();
  });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out connecting to the Brave debugger.')), 8000);
      socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      socket.addEventListener('error', () => {
        clearTimeout(timer);
        reject(new Error('Could not connect to the Brave debugger.'));
      }, { once: true });
    });
  } catch (error) {
    socket.close();
    throw error;
  }

  function Send(method, params = {}) {
    if (socket.readyState !== WebSocket.OPEN) throw new Error('Brave debugger is disconnected.');
    return new Promise((resolve, reject) => {
      const command = ++id;
      const timer = setTimeout(() => {
        pending.delete(command);
        reject(new Error('Brave command timed out: ' + method));
      }, 10000);
      pending.set(command, { method, timer, resolve, reject });
      socket.send(JSON.stringify({ id: command, method, params }));
    });
  }

  async function Evaluate(expression, userGesture = false) {
    const result = await Send('Runtime.evaluate', { expression, userGesture, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
  }

  return { Send, Evaluate, errors, Close: () => socket.close() };
}

function ReactionFor(model, roundIndex, grade) {
  const gap = GapFor(model, roundIndex);
  const matches = [];
  for (let ms = 100; ms < 2500; ms++) {
    const { rel } = Simulate(model, gap, ms / 1000 + .2);
    if (rel !== null && Severity(rel) === grade) matches.push(ms);
  }
  assert.ok(matches.length, `Round ${roundIndex + 1} has no reaction time for ${grade} contact.`);
  return matches[Math.floor(matches.length / 2)];
}

function SetReducedMotionPreference(send, value) {
  return send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value }] });
}

function InstallFixtureClock(origin) {
  if (location.origin !== origin || window.top !== window) return;

  const nativeNow = performance.now.bind(performance);
  const epoch = Date.now() - nativeNow();
  const nativeFrame = window.requestAnimationFrame.bind(window);
  const nativeCancelFrame = window.cancelAnimationFrame.bind(window);
  const nativeTimeout = window.setTimeout.bind(window);
  const nativeClearTimeout = window.clearTimeout.bind(window);
  const frames = new Map();
  const timers = new Map();
  let frameId = 0;
  let timerId = 0;
  let frameRequest;
  let pausedAt;
  let pausedDuration = 0;

  function Now() {
    return (pausedAt ?? nativeNow()) - pausedDuration;
  }

  function RequestFrame() {
    if (pausedAt !== undefined || frameRequest !== undefined || !frames.size) return;
    frameRequest = nativeFrame(() => {
      frameRequest = undefined;
      const time = Now();
      for (const id of [...frames.keys()]) {
        if (pausedAt !== undefined) break;
        const callback = frames.get(id);
        if (!callback) continue;
        frames.delete(id);
        try { callback(time); }
        catch (error) { window.reportError(error); }
      }
      RequestFrame();
    });
  }

  function ArmTimer(id, timer) {
    const remaining = Math.max(0, Math.ceil(timer.due - Now()));
    timer.request = nativeTimeout(() => {
      timer.request = undefined;
      if (pausedAt !== undefined || !timers.has(id)) return;
      if (timer.due > Now()) {
        ArmTimer(id, timer);
        return;
      }
      if (timer.repeat) {
        timer.due = Now() + timer.delay;
        ArmTimer(id, timer);
      } else timers.delete(id);
      timer.callback.apply(window, timer.args);
    }, remaining);
  }

  function AddTimer(callback, delay, args, repeat) {
    delay = Math.max(0, Number(delay) | 0);
    const id = ++timerId;
    const timer = { callback, delay, args, repeat, due: Now() + delay, request: undefined };
    timers.set(id, timer);
    if (pausedAt === undefined) ArmTimer(id, timer);
    return id;
  }

  function CancelTimer(id) {
    const timer = timers.get(Number(id));
    if (timer?.request !== undefined) nativeClearTimeout(timer.request);
    timers.delete(Number(id));
  }

  function Pause() {
    if (pausedAt !== undefined) return;
    pausedAt = nativeNow();
    if (frameRequest !== undefined) nativeCancelFrame(frameRequest);
    frameRequest = undefined;
    for (const timer of timers.values()) {
      if (timer.request !== undefined) nativeClearTimeout(timer.request);
      timer.request = undefined;
    }
  }

  function Resume() {
    if (pausedAt === undefined) return;
    pausedDuration += nativeNow() - pausedAt;
    pausedAt = undefined;
    for (const [id, timer] of timers) ArmTimer(id, timer);
    RequestFrame();
  }

  function AfterPaint() {
    return new Promise(resolve => nativeFrame(() => nativeFrame(resolve)));
  }

  Object.defineProperty(performance, 'now', { value: Now, configurable: true });
  Date.now = () => Math.floor(epoch + Now());
  window.requestAnimationFrame = callback => {
    const id = ++frameId;
    frames.set(id, callback);
    RequestFrame();
    return id;
  };
  window.cancelAnimationFrame = id => frames.delete(id);
  window.setTimeout = (callback, delay, ...args) => AddTimer(callback, delay, args, false);
  window.setInterval = (callback, delay, ...args) => AddTimer(callback, delay, args, true);
  window.clearTimeout = window.clearInterval = CancelTimer;
  window.__fixtureClock = { pause: Pause, resume: Resume, afterPaint: AfterPaint };
}

function DispatchBrake(brake, timeStamp = performance.now()) {
  if (!brake?.isConnected || brake.disabled) return false;
  const event = new MouseEvent('click', { bubbles: true });
  Object.defineProperty(event, 'timeStamp', { value: timeStamp });
  brake.dispatchEvent(event);
  return true;
}

function ObserveReviewFrame(selector, sample) {
  const deadline = performance.now() + 9000;
  return new Promise(resolve => {
    function Observe() {
      const now = performance.now();
      const scene = document.querySelector(selector);
      const frame = scene && sample(scene, now);
      if (frame) window.__fixtureClock.pause();
      if (frame || now >= deadline || document.querySelector('.round-feedback')) resolve(frame);
      else requestAnimationFrame(Observe);
    }
    requestAnimationFrame(Observe);
  });
}

async function CheckFlow({ Send, Evaluate }, { width, height, language, tag }, issues) {
  let stage = 'settings';
  const feedbackPanel = '.round-feedback';
  const activeScene = '.brake-reaction-phase-playing .driving:not([inert])';

  async function WaitFor(expression, label, timeout = 12000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      try {
        const result = await Evaluate(expression);
        if (result) return result;
      } catch (error) {
        if (!/execution context.*destroyed|cannot find context|inspected target navigated/i.test(error.message)) throw error;
      }
      await Delay(40);
    }
    throw new Error('Timed out waiting for ' + label);
  }

  async function Click(selector) {
    const clicked = await Evaluate(`(() => {
      const button = document.querySelector(${JSON.stringify(selector)});
      if (!button || button.disabled) return false;
      button.click();
      return true;
    })()`, true);
    assert.ok(clicked, 'Could not click ' + selector);
  }

  async function Layout(kind) {
    const phase = stage === kind ? stage : stage + ' ' + kind;
    const problems = await Evaluate(`(${InspectLayout.toString()})(${JSON.stringify(kind)}, ${width}, ${height})`)
      .catch(error => ['Layout inspection failed: ' + error.message]);
    issues.push(...problems.map(problem => phase + ': ' + problem));
  }

  async function Screenshot(name, selectFrame = () => Evaluate('window.__fixtureClock.pause()'), checkLayout) {
    try {
      await selectFrame();
      await Evaluate('window.__fixtureClock.afterPaint()');
      await Promise.all([
        Capture(Send, tag, name).catch(error => issues.push(name + ' screenshot: ' + error.message)),
        checkLayout?.(),
      ]);
    } finally {
      await Evaluate('window.__fixtureClock.resume()');
    }
  }

  async function PressKey(key, windowsVirtualKeyCode, modifiers = 0) {
    const input = { key, code: key, windowsVirtualKeyCode, modifiers };
    const down = key === 'Enter' ? { type: 'keyDown', text: '\r', unmodifiedText: '\r' } : { type: 'rawKeyDown' };
    await Send('Input.dispatchKeyEvent', { ...input, ...down });
    await Send('Input.dispatchKeyEvent', { ...input, type: 'keyUp' });
  }

  async function CompleteTour() {
    const targets = ['.tutorial-lead-car', '.brake-controls', '.road-caption', '.drive-speed', '.messages', '.tutorial-round', '#stop'];
    await WaitFor("!!document.querySelector('.brake-tutorial-scene canvas[data-target-rect]')", 'drawn road preview');
    assert.ok(await Evaluate("document.activeElement.matches('.game-tour .btn-primary')"), 'The first tour action receives focus.');
    await PressKey('Tab', 9, 8);
    assert.ok(await Evaluate("document.activeElement.matches('.game-tour-actions button:last-child')"), 'Tab wraps backward in the tour.');
    await PressKey('Tab', 9);
    assert.ok(await Evaluate("document.activeElement.matches('.game-tour .btn-primary')"), 'Tab wraps forward in the tour.');

    for (const target of targets) {
      const layout = await Evaluate(`(() => {
        const scene = document.querySelector('.brake-tutorial-scene');
        const panel = document.querySelector('.game-tour');
        const spotlight = document.querySelector('.game-tour-spotlight');
        const point = scene.querySelector(${JSON.stringify(target)}).getBoundingClientRect();
        const bounds = spotlight.getBoundingClientRect();
        const rect = panel.getBoundingClientRect();
        return {
          targetLit: point.width > 0 && point.height > 0 && !spotlight.hidden &&
            bounds.left <= point.left && bounds.right >= point.right &&
            bounds.top <= point.top && bounds.bottom >= point.bottom,
          targetClear: rect.right <= point.left || rect.left >= point.right ||
            rect.bottom <= point.top || rect.top >= point.bottom,
          fits: rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight &&
            document.documentElement.scrollWidth === innerWidth && panel.scrollWidth <= panel.clientWidth,
          buttons: [...panel.querySelectorAll('button')].every(button => {
            const box = button.getBoundingClientRect();
            return box.width >= 44 && box.height >= 44;
          }),
          inert: scene.inert && document.fullscreenElement === null,
        };
      })()`);
      assert.ok(Object.values(layout).every(Boolean), target + ': ' + JSON.stringify(layout));
      if (target === targets[0]) await Screenshot('tutorial');
      await Click('.game-tour .btn-primary');
    }
    await WaitFor("!!document.querySelector('.training-confirmation #start')", 'confirmation after completing the tour');
    assert.ok(await Evaluate("!document.querySelector('.game-tour, .game-tour-spotlight, .game-tour-blocker')"), 'Tour overlays are removed.');
    assert.ok(await Evaluate("document.activeElement.id === 'start'"), 'Start practice receives focus.');
    await PressKey('Tab', 9);
    assert.ok(await Evaluate("document.activeElement.matches('.training-confirmation footer button:first-child')"), 'Tab wraps forward in confirmation.');
    await PressKey('Tab', 9, 8);
    assert.ok(await Evaluate("document.activeElement.id === 'start'"), 'Tab wraps backward in confirmation.');
  }

  async function ReadyToBrake(pause = false) {
    const caption = await WaitFor(`(() => {
      const change = document.querySelector('${activeScene} canvas[data-brake-lit-at]')?.fixtureCueCaption;
      if (change && ${pause}) window.__fixtureClock.pause();
      return change;
    })()`, 'the brake cue in the active round', 15000);
    assert.equal(caption.after, caption.before, 'The banner must not change when the target brake lights come on.');
    assert.equal(caption.mutated, false, 'The banner must not update its live status at brake-light onset.');
  }

  async function ArmBrake(reactionMs = null, waitForScreenshot = false) {
    await WaitFor(`!!document.querySelector('${activeScene} #brake:not(:disabled)')`, 'active brake control');
    const armed = await Evaluate(`(() => {
      const scene = document.querySelector('${activeScene}');
      const canvas = scene?.querySelector('canvas');
      const banner = scene?.querySelector('#banner');
      const brake = scene?.querySelector('#brake');
      if (!canvas || !banner || !brake || canvas.dataset.brakeLitAt !== undefined) return false;
      let before = banner.textContent;
      const observer = new MutationObserver(records => {
        const cue = canvas.dataset.brakeLitAt;
        if (cue === undefined) {
          before = banner.textContent;
          return;
        }
        observer.disconnect();
        canvas.fixtureCueCaption = { before, after: banner.textContent, mutated: records.some(record => record.target !== canvas) };
        const delay = ${reactionMs};
        if (delay === null) return;
        const cueTime = Number(cue);
        const scheduledTime = cueTime + delay;
        function ScheduleBrake() {
          const now = performance.now();
          delete brake.fixtureBrake;
          if (!brake.isConnected || brake.disabled || now - cueTime >= 2500) return false;
          setTimeout(${DispatchBrake.toString()}, Math.max(0, scheduledTime - now), brake, scheduledTime);
          return true;
        }
        if (${waitForScreenshot}) brake.fixtureBrake = ScheduleBrake;
        else ScheduleBrake();
      });
      observer.observe(canvas, { attributes: true, attributeFilter: ['data-brake-lit-at'] });
      observer.observe(banner, { childList: true, characterData: true, subtree: true });
      return true;
    })()`);
    assert.ok(armed, 'Could not schedule the reaction before the cue.');
  }

  async function CaptureMidBraking(speedKmh) {
    await Screenshot('mid-braking', async () => {
      const frame = await Evaluate(`(${ObserveReviewFrame.toString()})(${JSON.stringify(activeScene)}, scene => {
        const speed = parseInt(scene.querySelector('#speed')?.textContent, 10);
        return speed > 0 && speed < ${speedKmh * .75} && scene.querySelector('#brake')?.disabled ? speed : false;
      })`);
      assert.ok(frame, 'The round ended before a mid-braking frame was observed.');
    });
  }

  async function CaptureImpact(grade) {
    const name = (grade === 'light' ? 'minor' : grade) + '-contact';
    let firstImpact;

    async function CaptureImpactFrame(suffix, elapsed, reduced = false, checkLayout) {
      await Screenshot(name + suffix, async () => {
        const frame = await Evaluate(`(() => {
          let firstImpact = ${firstImpact};
          return (${ObserveReviewFrame.toString()})(${JSON.stringify(activeScene)}, (scene, now) => {
            const canvas = scene.querySelector('canvas');
            const impact = canvas?.dataset.impact;
            if (!impact) return false;
            if (impact !== ${JSON.stringify(grade)}) return { impact };
            firstImpact ??= now;
            const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
            const staticEnd = Number(canvas.dataset.cameraZoom) === .42;
            return now - firstImpact >= ${elapsed} && reduced === ${reduced} &&
              (!reduced || staticEnd) && { impact, firstImpact };
          });
        })()`);
        assert.equal(frame?.impact, grade, 'The simulated reaction must show the planned contact grade before feedback.');
        firstImpact = frame.firstImpact;
      }, checkLayout);
    }

    if (grade !== 'light') await CaptureImpactFrame('-early', 250);
    await CaptureImpactFrame('', 400, false, grade === 'severe' ? () => Layout('close-range') : undefined);
    if (grade === 'severe') {
      try {
        await SetReducedMotionPreference(Send, 'reduce');
        await CaptureImpactFrame('-reduced', 400, true);
      } finally {
        await SetReducedMotionPreference(Send, 'no-preference');
      }
    }
  }

  async function CaptureDistractionNotification() {
    await WaitFor(`!!document.querySelector('${activeScene} #answers button:not(:disabled)')`, 'the distraction notification');
    const responses = await Evaluate("document.querySelectorAll('#answers button:not(:disabled)').length");
    if (responses !== 3) issues.push(stage + ': expected three enabled responses to the distraction message, got ' + responses);
    await Screenshot('distraction-notification');
  }

  async function Feedback() {
    await WaitFor(`(() => {
      const card = document.querySelector(${JSON.stringify(feedbackPanel)});
      return card && document.activeElement.id === 'continue' && !card.getAnimations().some(animation => animation.playState === 'running');
    })()`, 'round feedback and next-button focus');
    const still = await Evaluate(`(async () => {
      const scene = document.querySelector('.driving[inert]');
      const canvas = scene?.querySelector('canvas');
      if (!canvas?.dataset.worldDistance) return false;
      const frame = canvas.toDataURL();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return frame === canvas.toDataURL();
    })()`);
    assert.ok(still, 'The same canvas must keep its final frame while the card is open.');
  }

  try {
    await WaitFor(`document.documentElement.lang === ${JSON.stringify(language === 'zh' ? 'zh-TW' : 'en')} &&
      !!document.querySelector('dialog[open] .btn-primary:not(:disabled)')`, 'localized settings for ' + language);
    assert.ok(await Evaluate("matchMedia('(prefers-reduced-motion: no-preference)').matches"), 'Gameplay review needs full movement.');
    const title = await Evaluate("document.querySelector('dialog[open] h2')?.textContent");
    if (title !== copy[language].title) issues.push('settings: expected the localized heading ' + copy[language].title);
    const settings = await Evaluate("Object.fromEntries(new FormData(document.querySelector('form.training-config')))");
    const speedKmh = Number(settings.speedKmh);
    const model = ModelFor({ ...settings, speedKmh });
    const contactRounds = ['light', 'moderate'];
    await Layout('settings');
    await Screenshot('settings');
    await Click('dialog[open] .btn-primary');

    stage = 'tutorial';
    await WaitFor("!!document.querySelector('.game-tour-actions')", 'spotlight tour');
    await Click('.game-tour-actions button:last-child');
    await WaitFor("!!document.querySelector('dialog[open]')", 'settings after leaving the tour');
    await Click('dialog[open] .btn-primary');
    await CompleteTour();

    stage = 'demo';
    await WaitFor("!!document.querySelector('#demo')", 'demo button');
    await Click('#demo');
    await WaitFor("!!document.querySelector('.brake-reaction-phase-playing #brake')", 'demo brake control');
    await Layout('demo');
    assert.ok(await Evaluate(`(${DispatchBrake.toString()})(document.querySelector('${activeScene} #brake'))`), 'The early brake must reach the demo.');
    await Feedback();
    assert.ok(await Evaluate("!!document.querySelector('.round-feedback[data-verdict=earlyPress]')"), 'Early presses use the feedback card.');
    await PressKey('Enter', 13);
    await WaitFor("!!document.querySelector('.brake-reaction-phase-playing #brake')", 'demo restarted by Enter');
    await ArmBrake(450, true);
    await WaitFor(`!!document.querySelector('${activeScene} canvas[data-world-distance]:not([data-brake-lit-at])')`, 'cruising with brake lights off');
    await Screenshot('cruising');
    await Screenshot('brake-lights', () => ReadyToBrake(true));
    await Promise.all([
      CaptureMidBraking(speedKmh),
      Evaluate(`document.querySelector('${activeScene} #brake:not(:disabled)')?.fixtureBrake?.()`).then(applied => {
        assert.ok(applied, 'The demo brake must be available after the paused cue capture.');
      }),
    ]);
    await Feedback();
    await Layout('feedback');
    assert.ok(await Evaluate("!!document.querySelector('.round-feedback[data-verdict=stopped]')"), 'The demo should stop safely.');
    await Screenshot('stopped-feedback');
    await PressKey('Enter', 13);
    await WaitFor("!!document.querySelector('.training-confirmation .btn-ghost')", 'settings confirmation');

    stage = 'scored settings';
    await PressKey('Escape', 27);
    await WaitFor("!!document.querySelector('dialog[open] select[name=scenario]')", 'reopened settings');
    await Evaluate(`(() => {
      const scenario = document.querySelector('select[name=scenario]');
      scenario.value = 'swerve-away';
      scenario.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await Click('dialog[open] .btn-primary');
    await WaitFor("!!document.querySelector('.game-tour')", 'spotlight after settings change');
    await PressKey('Escape', 27);
    await WaitFor("!!document.querySelector('.training-confirmation #start')", 'Start practice button');
    if (!await Evaluate(`[...document.querySelectorAll('.training-config-summary-item')].some(item =>
      item.textContent.includes(${JSON.stringify(copy[language].swerve)}))`)) {
      issues.push('scored settings: the scored run must use the lane-change scenario');
    }
    await Click('#start');

    stage = 'pause';
    await WaitFor("!!document.querySelector('#stop')", 'Stop button');
    await Click('#stop');
    await WaitFor("!!document.querySelector('.game-interrupt-panel #resume')", 'pause panel');
    await Layout('pause');
    await Screenshot('pause');
    await Click('#resume');

    for (let index = 0; index < 6; index++) {
      stage = 'scored round ' + (index + 1);
      const grade = contactRounds[index];
      if (index === 5) {
        await ArmBrake();
        await CaptureDistractionNotification();
        await ReadyToBrake();
        await Promise.all([CaptureImpact('severe'), Layout('distraction')]);
        await Feedback();
        const timedOut = await Evaluate(`document.querySelector(${JSON.stringify(feedbackPanel + ' .metrics')})?.textContent
          .includes(${JSON.stringify(copy[language].timeout)})`);
        if (!timedOut) issues.push(stage + ': expected a timed-out round record');
        if (!await Evaluate("!!document.querySelector('.round-distraction')")) issues.push(stage + ': missing distraction comparison');
        await Layout('feedback');
        await Screenshot('severe-feedback');
      } else {
        await ArmBrake(grade ? ReactionFor(model, index, grade) : 160);
        await ReadyToBrake();
        await Promise.all([
          grade && CaptureImpact(grade),
          Evaluate("!!document.querySelector('.road-frame canvas')?.dataset.targetRect").then(visible => {
            if (!visible) issues.push(stage + ': the target car has no drawn rectangle at the brake cue');
          }),
        ]);
        await Feedback();
      }
      await Click('#continue');
    }
    await WaitFor("!!document.querySelector('.experiment-results') && !document.fullscreenElement", 'results and fullscreen exit');
  } catch (error) {
    throw new Error(stage + ': ' + error.message, { cause: error });
  }
}

async function Capture(send, tag, phase) {
  const { data } = await send('Page.captureScreenshot', {
    format: 'png', fromSurface: true, captureBeyondViewport: false, optimizeForSpeed: true,
  });
  await writeFile(join(output, tag + '-' + phase + '.png'), Buffer.from(data, 'base64'));
}

function InspectLayout(kind, width, height) {
  const issues = [];
  const viewport = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
  const epsilon = .5;
  const inside = (rect, area) => rect.left >= area.left - epsilon && rect.top >= area.top - epsilon &&
    rect.right <= area.right + epsilon && rect.bottom <= area.bottom + epsilon;
  const intersects = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > epsilon &&
    Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > epsilon;
  const describe = rect => [rect.left, rect.top, rect.width, rect.height].map(value => value.toFixed(1)).join(',');
  const clips = overflow => overflow === 'hidden' || overflow === 'clip';
  if (innerWidth !== width || innerHeight !== height) issues.push('viewport is ' + innerWidth + 'x' + innerHeight + ', expected ' + width + 'x' + height);
  if (document.documentElement.scrollWidth > innerWidth) issues.push('document scrolls horizontally');

  function Visible(selector, text = false, target = false) {
    const element = document.querySelector(selector);
    if (!element) {
      issues.push(selector + ' is missing');
      return;
    }
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    if (!rect.width || !rect.height || style.visibility !== 'visible' || style.display === 'none' || Number(style.opacity) === 0) {
      issues.push(selector + ' is hidden');
      return;
    }
    if (!inside(rect, viewport)) issues.push(selector + ' is outside viewport (' + describe(rect) + ')');
    if (target && (rect.width < 44 - epsilon || rect.height < 44 - epsilon)) issues.push(selector + ' is smaller than 44x44');
    if (text) {
      const range = document.createRange();
      range.selectNodeContents(element);
      const bounds = [...range.getClientRects()];
      const glyphSlack = .25 * Number.parseFloat(style.fontSize);
      if (!element.textContent.trim()) issues.push(selector + ' text is empty');
      if (bounds.some(box => box.left < rect.left - 1 || box.right > rect.right + 1) ||
          (clips(style.overflowX) && element.scrollWidth > element.clientWidth + 1)) {
        issues.push(selector + ' text escapes its box horizontally');
      }
      if (bounds.some(box => box.top < rect.top - glyphSlack || box.bottom > rect.bottom + glyphSlack) ||
          (clips(style.overflowY) && element.scrollHeight > element.clientHeight + 1)) {
        issues.push(selector + ' text escapes its box vertically');
      }
    }
    return { selector, rect };
  }

  function NonOverlapping(entries) {
    const visible = entries.filter(Boolean);
    for (const [index, first] of visible.entries()) {
      for (const second of visible.slice(index + 1)) {
        if (intersects(first.rect, second.rect)) {
          issues.push(first.selector + ' overlaps ' + second.selector + ' (' + describe(first.rect) + ' vs ' + describe(second.rect) + ')');
        }
      }
    }
  }

  if (kind === 'settings' || kind === 'pause' || kind === 'feedback') {
    const selector = { settings: 'dialog[open]', pause: '.game-interrupt-panel', feedback: '.round-feedback' }[kind];
    const panel = Visible(selector);
    const children = [Visible(selector + ' h2', true),
      ...[...document.querySelectorAll(selector + ' footer button')].map((button, index) =>
        Visible(selector + ' footer button:nth-of-type(' + (index + 1) + ')', true, true))];
    if (children.length !== 3) issues.push(selector + ' must have a heading and two footer buttons');
    for (const child of children.filter(Boolean)) {
      if (panel && !inside(child.rect, panel.rect)) issues.push(child.selector + ' escapes the panel');
      const x = child.rect.left + child.rect.width / 2;
      const y = child.rect.top + child.rect.height / 2;
      if (!document.querySelector(child.selector)?.contains(document.elementFromPoint(x, y))) issues.push(child.selector + ' is covered');
    }
    NonOverlapping(children);
    if (kind === 'feedback' && panel) {
      const body = document.querySelector(selector + ' .training-config-body');
      if (body && ((width >= 1024 && height >= 768) || (width >= 390 && height >= 844)) &&
          body.scrollHeight > body.clientHeight + 1) issues.push('feedback content scrolls at a review viewport');
      if (panel.rect.top < height * .40 || panel.rect.bottom < height - 24) issues.push('feedback is not anchored to the bottom with room above');
      if (!document.querySelector('.driving[inert] canvas[data-world-distance]')) issues.push('feedback is missing its frozen road');
      if (document.activeElement.id !== 'continue') issues.push('feedback primary action does not have focus');
    }
    return issues;
  }

  const canvas = Visible('.road-frame canvas');
  if (canvas && !inside(viewport, canvas.rect)) issues.push('the road canvas does not fill the viewport (' + describe(canvas.rect) + ')');
  if (canvas && width === 2560) {
    const element = document.querySelector(canvas.selector);
    const context = element.getContext('2d');
    const pixels = [[0, 0], [element.width - 1, 0], [0, element.height - 1], [element.width - 1, element.height - 1]];
    if (!context || pixels.some(([x, y]) => context.getImageData(x, y, 1, 1).data[3] !== 255)) {
      issues.push('the ultrawide canvas has an unpainted corner');
    }
  }
  const closeRange = kind === 'close-range';
  const topEntries = [Visible('.drive-toolbar h2', true), Visible('#speed', true),
    Visible('#sound', true, true), Visible('#stop', true, true)];
  if (!closeRange && document.querySelector('#banner')?.textContent.trim()) topEntries.push(Visible('#banner', true));
  const panel = kind === 'distraction' ? Visible('.drive-notification') : undefined;
  if (panel) {
    const toolbar = document.querySelector('.drive-toolbar').getBoundingClientRect();
    const gutter = width <= 560 ? 12 : 16;
    if (Math.abs(panel.rect.top - toolbar.bottom - 6) > 1 ||
        Math.abs(panel.rect.left + panel.rect.width / 2 - width / 2) > 1 ||
        Math.abs(panel.rect.width - Math.min(560, width - 2 * gutter)) > 1) {
      issues.push('notification is not centered at the expected size directly below the toolbar');
    }
    topEntries.push(panel);
  }
  const bottomZone = Visible('.drive-bottom');
  const brake = Visible('#brake', true, true);
  const help = Visible('#brake-help', true);
  const bottomEntries = [brake, help];
  if (brake && bottomZone && brake.rect.width < Math.min(240, bottomZone.rect.width) - epsilon) {
    issues.push('#brake is narrower than its minimum available width (' + brake.rect.width.toFixed(1) + 'px)');
  }
  if (help) {
    const lineHeight = Number.parseFloat(getComputedStyle(document.querySelector(help.selector)).lineHeight);
    if (!Number.isFinite(lineHeight) || help.rect.height > 2 * lineHeight + epsilon) {
      issues.push('#brake-help exceeds two lines');
    }
  }
  const dataset = document.querySelector('.road-frame canvas')?.dataset;
  const dashboardTop = Number(dataset?.dashboardTop);
  if (!Number.isFinite(dashboardTop) || dashboardTop <= 0 || dashboardTop >= innerHeight) {
    issues.push('missing or invalid dashboardTop (' + dataset?.dashboardTop + ')');
  }
  const raw = dataset?.targetRect;
  const [x, y, carWidth, carHeight] = raw?.split(',').map(Number) ?? [];
  let carRect;
  if (![x, y, carWidth, carHeight].every(Number.isFinite) || carWidth <= 0 || carHeight <= 0) {
    issues.push('missing or invalid targetRect (' + raw + ')');
  } else {
    carRect = { left: x, top: y, right: x + carWidth, bottom: y + carHeight, width: carWidth, height: carHeight };
    if (!inside(carRect, viewport)) issues.push('drawn targetRect is outside the viewport (' + describe(carRect) + ')');
    if (closeRange && canvas) {
      const zoom = Number(dataset.cameraZoom);
      const referenceWidth = Math.min(canvas.rect.width, .7 * canvas.rect.height) * zoom;
      if (!(zoom >= .42 && zoom <= 1) || carWidth < .85 * referenceWidth || carWidth > 1.1 * referenceWidth) {
        issues.push('close-range target falls outside its projected crash width (' + carWidth.toFixed(1) + 'px)');
      }
    }
  }

  if (closeRange && carRect) {
    let lamps;
    try { lamps = JSON.parse(dataset.targetLamps ?? 'null'); }
    catch { lamps = null; }
    if (!Array.isArray(lamps) || lamps.length !== 3) {
      issues.push('expected three target lamp bounds at contact');
    } else {
      for (const [index, bounds] of lamps.entries()) {
        if (!Array.isArray(bounds) || bounds.length !== 4 || !bounds.every(Number.isFinite) || bounds[2] <= 0 || bounds[3] <= 0) {
          issues.push('target lamp ' + (index + 1) + ' has invalid bounds');
          continue;
        }
        const [left, top, lampWidth, lampHeight] = bounds;
        const lamp = { left, top, right: left + lampWidth, bottom: top + lampHeight };
        if (!inside(lamp, carRect) || lamp.bottom > dashboardTop + epsilon ||
            topEntries.some(entry => entry && intersects(entry.rect, lamp))) {
          issues.push('target lamp ' + (index + 1) + ' is outside the unobstructed car area');
        }
      }
    }
  }

  if (panel && brake && bottomZone && (width < 560 || width <= height)) {
    if (panel.rect.bottom > brake.rect.top + epsilon || brake.rect.width < bottomZone.rect.width - epsilon) {
      issues.push('the top notification must clear the full-width portrait brake button');
    }
  }
  for (const entry of bottomEntries.filter(Boolean)) {
    if (entry.rect.top < dashboardTop - epsilon) issues.push(entry.selector + ' is above dashboardTop');
    if (carRect && intersects(entry.rect, carRect)) issues.push(entry.selector + ' overlaps the visible target above the dashboard');
    const hit = document.elementFromPoint(entry.rect.left + entry.rect.width / 2, entry.rect.top + entry.rect.height / 2);
    if (!document.querySelector(entry.selector)?.contains(hit)) issues.push(entry.selector + ' is covered');
  }
  NonOverlapping([...topEntries, ...bottomEntries]);
  // At contact the car can fill the scene behind the HUD. Its lamps still need a clear view.
  if (carRect && !closeRange) {
    for (const entry of topEntries.filter(Boolean)) {
      if (intersects(entry.rect, carRect)) issues.push(entry.selector + ' overlaps target car');
    }
  }
  if (kind === 'distraction') {
    const sender = Visible('.notification-sender', true);
    const question = Visible('#message', true);
    const answers = [1, 2, 3].map(index => Visible('#answers button:nth-of-type(' + index + ')', true, true));
    const messages = [sender, question, ...answers];
    if (question) {
      const style = getComputedStyle(document.querySelector('.notification-question'));
      if (Number.parseFloat(style.fontSize) < (width <= 560 ? 22 : 24)) issues.push('the notification question is too small');
      if (!(Number(style.fontWeight) >= 800)) issues.push('notification question font weight is ' + style.fontWeight + ', expected at least 800');
    }
    const weights = [...document.querySelectorAll('.drive-notification .answers .btn')].map(button => getComputedStyle(button).fontWeight);
    if (weights.length !== 3 || weights.some(weight => !(Number(weight) >= 700))) {
      issues.push('notification answer weights must be at least 700, found ' + weights.join(', '));
    }
    if (answers[0] && answers.some(answer => answer && (Math.abs(answers[0].rect.top - answer.rect.top) > epsilon ||
        Math.abs(answers[0].rect.width - answer.rect.width) > epsilon || answer.rect.height < 48 - epsilon ||
        (question && answer.rect.top < question.rect.bottom - epsilon)))) {
      issues.push('the three notification answers must be equally sized below the question');
    }
    if (question && document.querySelectorAll('#message strong').length !== 2) issues.push('notification numbers are not emphasized');
    for (const child of messages.filter(Boolean)) {
      if (panel && !inside(child.rect, panel.rect)) issues.push(child.selector + ' escapes the distraction panel');
    }
    NonOverlapping(messages);
  }
  return issues;
}
