import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { basename, dirname, extname, join, resolve, sep } from 'node:path';
import { setTimeout as Delay } from 'node:timers/promises';
import { parseArgs } from 'node:util';

const viewports = [[320, 568], [360, 640], [390, 844], [768, 1024], [1024, 768], [1280, 800],
  [1440, 900], [1920, 1080], [2560, 1080], [844, 390], [667, 375]];
const copy = {
  zh: { locale: 'zh-TW', title: '跟車煞車反應練習', cue: '同車道煞車燈亮起', swerve: '前車換道閃避', timeout: '逾時' },
  en: { locale: 'en-US', title: 'Brake Reaction Practice', cue: 'Brake lights in your lane', swerve: 'Lead vehicle moves aside', timeout: 'Timed out' },
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

async function CheckFlow({ Send, Evaluate }, { width, height, language, tag }, issues) {
  let stage = 'settings';
  const feedbackPanel = '.brake-reaction-phase-feedback .training-panel';

  async function WaitFor(expression, label, timeout = 12000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      try {
        if (await Evaluate(expression)) return;
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

  async function Screenshot(name) {
    await Capture(Send, tag, name).catch(error => issues.push(name + ' screenshot: ' + error.message));
  }

  async function ReadyToBrake() {
    await WaitFor(`document.querySelector('#banner')?.textContent === ${JSON.stringify(copy[language].cue)} &&
      !!document.querySelector('#brake:not(:disabled)')`, 'the brake cue and an enabled brake button', 15000);
  }

  async function Feedback() {
    await WaitFor(`!!document.querySelector(${JSON.stringify(feedbackPanel)})`, 'round feedback');
  }

  async function Brake(screenshot) {
    const pendingBrake = Evaluate(`(async () => {
      await new Promise(resolve => setTimeout(resolve, 160));
      const brake = document.querySelector('#brake:not(:disabled)');
      if (!brake) return false;
      brake.click();
      return true;
    })()`, true);
    const [pressed] = await Promise.all([pendingBrake, screenshot ? Screenshot(screenshot) : undefined]);
    assert.ok(pressed, 'Brake was unavailable after the cue.');
    await Feedback();
  }

  try {
    await WaitFor(`document.documentElement.lang === ${JSON.stringify(language === 'zh' ? 'zh-TW' : 'en')} &&
      !!document.querySelector('dialog[open] .btn-primary:not(:disabled)')`, 'localized settings for ' + language);
    const title = await Evaluate("document.querySelector('dialog[open] h2')?.textContent");
    if (title !== copy[language].title) issues.push('settings: expected the localized heading ' + copy[language].title);
    await Layout('settings');
    await Screenshot('settings');
    await Click('dialog[open] .btn-primary');

    stage = 'demo';
    await WaitFor("!!document.querySelector('#demo')", 'demo button');
    await Click('#demo');
    await ReadyToBrake();
    await Layout('demo');
    await Brake('demo-cue');
    await Layout('feedback');
    await Screenshot('demo-feedback');
    await Click('#continue');
    await WaitFor("!!document.querySelector('.training-confirmation .btn-ghost')", 'settings confirmation');

    stage = 'scored settings';
    await Click('.training-confirmation .btn-ghost');
    await WaitFor("!!document.querySelector('dialog[open] select[name=scenario]')", 'reopened settings');
    await Evaluate(`(() => {
      const scenario = document.querySelector('select[name=scenario]');
      scenario.value = 'swerve-away';
      scenario.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await Click('dialog[open] .btn-primary');
    await WaitFor("!!document.querySelector('#continue')", 'skip demo button');
    await Click('#continue');
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
      await ReadyToBrake();
      if (index === 5) {
        const responses = await Evaluate("document.querySelectorAll('#answers button:not(:disabled)').length");
        if (responses !== 3) issues.push(stage + ': expected three enabled responses to the distraction message, got ' + responses);
        await Layout('distraction');
        await Screenshot('distraction-cue');
        await WaitFor("!!document.querySelector('.road-frame[data-contact]')", 'contact after the brake timeout');
        await Promise.all([Layout('close-range'), Screenshot('close-range')]);
        await Feedback();
        const timedOut = await Evaluate(`document.querySelector(${JSON.stringify(feedbackPanel + ' .metrics')})?.textContent
          .includes(${JSON.stringify(copy[language].timeout)})`);
        if (!timedOut) issues.push(stage + ': expected a timed-out round record');
        await Layout('feedback');
        await Screenshot('distraction-feedback');
      } else {
        if (!await Evaluate("!!document.querySelector('.road-frame canvas')?.dataset.targetRect")) {
          issues.push(stage + ': the target car has no drawn rectangle at the brake cue');
        }
        await Brake();
      }
      await Click('#continue');
    }
    await WaitFor("!!document.querySelector('.experiment-results') && !document.fullscreenElement", 'results and fullscreen exit');
  } catch (error) {
    throw new Error(stage + ': ' + error.message, { cause: error });
  }
}

async function Capture(send, tag, phase) {
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
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
    const selector = { settings: 'dialog[open]', pause: '.game-interrupt-panel', feedback: '.brake-reaction-phase-feedback .training-panel' }[kind];
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
  const topEntries = [
    Visible('.drive-toolbar h2', true), Visible('#speed', true), Visible('#banner', true),
    Visible('#sound', true, true), Visible('#stop', true, true),
  ];
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
  const closeRange = kind === 'close-range';
  const raw = dataset?.targetRect;
  const [x, y, carWidth, carHeight] = raw?.split(',').map(Number) ?? [];
  let carRect;
  if (![x, y, carWidth, carHeight].every(Number.isFinite) || carWidth <= 0 || carHeight <= 0) {
    issues.push('missing or invalid targetRect (' + raw + ')');
  } else {
    carRect = { left: x, top: y, right: x + carWidth, bottom: y + carHeight, width: carWidth, height: carHeight };
    if (!inside(carRect, viewport)) issues.push('drawn targetRect is outside the viewport (' + describe(carRect) + ')');
    if (closeRange && canvas) {
      const referenceWidth = Math.min(canvas.rect.width, .7 * canvas.rect.height);
      if (carWidth < .9 * referenceWidth || carWidth > 1.1 * referenceWidth) {
        issues.push('close-range target is outside 90–110% of the reference width (' + carWidth.toFixed(1) + 'px)');
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

  const panel = (kind === 'distraction' || closeRange) ? Visible('.messages') : undefined;
  if (panel) bottomEntries.push(panel);
  if (panel && brake && bottomZone && (width < 560 || width <= height)) {
    if (panel.rect.bottom > brake.rect.top + epsilon || brake.rect.width < bottomZone.rect.width - epsilon) {
      issues.push('portrait distraction controls must stack above a full-width brake button');
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
  if (kind === 'distraction' || closeRange) {
    const question = Visible('#message', true);
    const answers = [1, 2, 3].map(index => Visible('#answers button:nth-of-type(' + index + ')', true, true));
    const messages = [question, ...answers];
    if (question && answers.some(answer => answer && (question.rect.right > answer.rect.left + epsilon ||
      Math.abs(question.rect.top + question.rect.height / 2 - answer.rect.top - answer.rect.height / 2) > epsilon))) {
      issues.push('the distraction question and answers are not in one row');
    }
    for (const child of messages.filter(Boolean)) {
      if (panel && !inside(child.rect, panel.rect)) issues.push(child.selector + ' escapes the distraction panel');
    }
    NonOverlapping(messages);
  }
  return issues;
}
