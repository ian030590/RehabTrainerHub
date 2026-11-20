import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { setTimeout as Delay } from 'node:timers/promises';

const output = resolve(process.env.HUB_OUTPUT_ROOT || join(import.meta.dirname, '../apps/rehabtrainerhub/out'));
const brave = [process.env.BRAVE_BIN, 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', '/usr/bin/brave-browser', '/usr/bin/brave',
].find(path => path && existsSync(path));
assert.ok(brave, 'Install Brave or set BRAVE_BIN for the local activity map check.');
assert.ok(existsSync(join(output, 'activity-map/index.html')), 'Build the Hub first with npm run build:hub.');

const artifacts = await mkdtemp(join(tmpdir(), 'activity-map-'));
const profile = join(artifacts, 'profile');
const contentTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.txt': 'text/plain', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(output, `.${pathname.endsWith('/') ? `${pathname}index.html` : pathname}`);
    assert.ok(file.startsWith(output + sep));
    const bytes = await readFile(file);
    response.writeHead(200, { 'Content-Type': contentTypes[extname(file)] ?? 'application/octet-stream' }).end(bytes);
  } catch {
    response.writeHead(404).end();
  }
});

const marker = '[data-map-marker]';
const dot = '[data-map-dot]';
const item = '[data-map-list-item]';
const chip = 'input[data-map-filter]';
const details = '[data-map-details]';
const keyCodes = { Tab: 9, Enter: 13, End: 35, Home: 36, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40 };
const pending = new Map();
let browser, socket, session, origin, browserExit;
let serial = 0;
let browserStderr = '';

function Send(method, params = {}, sessionId = session) {
  return new Promise((done, reject) => {
    const id = ++serial;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error([`CDP timeout for ${method}.`, browserExit, browserStderr.trim()].filter(Boolean).join('\n')));
    }, 15000);
    pending.set(id, { done, reject, timer });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}

function OnMessage(event) {
  const { id, result, error, method, params } = JSON.parse(event.data);
  if (method === 'Fetch.requestPaused') {
    const allowed = new URL(params.request.url).origin === origin;
    void Send(allowed ? 'Fetch.continueRequest' : 'Fetch.failRequest', {
      requestId: params.requestId, ...(allowed ? {} : { errorReason: 'BlockedByClient' }),
    }).catch(error => console.error(error.message));
  }
  const entry = pending.get(id);
  if (!entry) return;
  clearTimeout(entry.timer);
  pending.delete(id);
  if (error) entry.reject(new Error(JSON.stringify(error)));
  else entry.done(result);
}

async function Evaluate(expression) {
  const result = await Send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
}

async function WaitFor(expression) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await Evaluate(expression)) return;
    await Delay(100);
  }
  throw new Error(`Browser condition timed out: ${expression}`);
}

async function WaitForPaint() {
  await Evaluate(`(async () => {
    await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
    await Promise.allSettled(document.getAnimations().filter(animation => Number.isFinite(animation.effect?.getComputedTiming().endTime))
      .map(animation => animation.finished));
  })()`);
}

async function WaitForDebugger() {
  for (let attempt = 0; attempt < 100 && !browserExit; attempt++) {
    const endpoint = await readFile(join(profile, 'DevToolsActivePort'), 'utf8').catch(() => '');
    const [port, path] = endpoint.trim().split(/\r?\n/);
    if (port && path) return `ws://127.0.0.1:${port}${path}`;
    await Delay(100);
  }
  throw new Error(['Brave debugger did not start.', browserExit, browserStderr.trim()].filter(Boolean).join('\n'));
}

async function Key(key) {
  const input = { key, code: key, windowsVirtualKeyCode: keyCodes[key] };
  const down = key === 'Enter' ? { type: 'keyDown', text: '\r' } : { type: 'rawKeyDown' };
  await Send('Input.dispatchKeyEvent', { ...input, ...down });
  await Send('Input.dispatchKeyEvent', { ...input, type: 'keyUp' });
}

async function Click(selector, touch) {
  const point = await Evaluate(`(() => {
    const target = document.querySelector(${JSON.stringify(selector)});
    target.scrollIntoView({ block: 'center', behavior: 'instant' });
    const rect = target.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
  if (touch) {
    await Send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await Send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    for (const type of ['mousePressed', 'mouseReleased']) {
      await Send('Input.dispatchMouseEvent', { type, ...point, button: 'left', clickCount: 1 });
    }
  }
}

async function CheckViewport(width, height, touch) {
  await Send('Emulation.setDeviceMetricsOverride', { width, height, mobile: touch, deviceScaleFactor: 1 });
  await Send('Emulation.setTouchEmulationEnabled', { enabled: touch, maxTouchPoints: 1 });
  await Send('Page.navigate', { url: `${origin}/activity-map/?width=${width}` });
  await WaitFor(`location.search === '?width=${width}' && document.readyState === 'complete' && !!document.querySelector('${marker}')`);
  await Evaluate('document.fonts.ready.then(() => true)');
  await WaitForPaint();

  const layout = await Evaluate(`(() => {
    const markers = [...document.querySelectorAll('${marker}')];
    const shapes = [...document.querySelectorAll('${dot} path')];
    const drawingById = new Map(shapes.map(shape => [shape.parentElement.dataset.mapDot, shape.parentElement.getScreenCTM()]));
    const main = document.querySelector('main');
    const mainStyle = getComputedStyle(main);
    return { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth,
      first: markers[0].dataset.mapMarker, last: markers.at(-1).dataset.mapMarker,
      ids: markers.map(button => button.dataset.mapMarker).sort(),
      items: [...document.querySelectorAll('${item}')].map(button => button.dataset.mapListItem).sort(),
      initiallySelected: markers.some(button => button.getAttribute('aria-pressed') === 'true') || !!document.querySelector('${details}'),
      introGap: document.querySelector('main fieldset legend').getBoundingClientRect().top - main.querySelector('header p').getBoundingClientRect().bottom,
      contentWidth: main.clientWidth - parseFloat(mainStyle.paddingLeft) - parseFloat(mainStyle.paddingRight),
      svgWidth: shapes[0].ownerSVGElement.getBoundingClientRect().width,
      smallestGlyph: Math.min(...shapes.map(shape => {
        const { width, height } = shape.getBoundingClientRect();
        return Math.min(width, height);
      })),
      aligned: markers.every(button => {
        const { left, top, width, height } = button.getBoundingClientRect();
        const drawing = drawingById.get(button.dataset.mapMarker);
        return drawing && Math.hypot(drawing.e - left - width / 2, drawing.f - top - height / 2) <= 1;
      }),
      targets: markers.every(button => {
        const { width, height } = button.getBoundingClientRect();
        return width >= 44 && height >= 44 && button.getAttribute('aria-label');
      }), tabStops: markers.filter(button => button.tabIndex === 0).length };
  })()`);
  assert.deepEqual([layout.width, layout.height], [width, height]);
  assert.ok(layout.scrollWidth <= width, `Page scroll width ${layout.scrollWidth} exceeds ${width}px.`);
  assert.ok(layout.ids.length > 0 && layout.targets);
  assert.deepEqual(layout.ids, layout.items);
  assert.ok(layout.aligned, 'SVG marker centers must match their hit targets.');
  assert.equal(layout.tabStops, 1);
  assert.equal(layout.initiallySelected, false, 'The details panel starts with a prompt and no selected activity.');
  assert.ok(layout.introGap <= 32, `Intro-to-filter gap is ${layout.introGap}px.`);
  if (touch) {
    assert.ok(Math.abs(layout.svgWidth - layout.contentWidth) <= 1, `SVG width ${layout.svgWidth}px does not fill ${layout.contentWidth}px of content.`);
    assert.ok(layout.smallestGlyph >= 12, `Smallest marker glyph is ${layout.smallestGlyph}px.`);
  }

  await Evaluate(`Array.from(document.querySelectorAll('${chip}')).at(-1).focus()`);
  await Key('Tab');
  assert.equal(await Evaluate('document.activeElement.dataset.mapMarker'), layout.first);
  assert.ok(await Evaluate(`document.activeElement.matches(':focus-visible') && parseFloat(getComputedStyle(document.activeElement).outlineWidth) >= 3`));
  await Key('End');
  assert.equal(await Evaluate('document.activeElement.dataset.mapMarker'), layout.last);
  await Key('Home');
  const arrow = await Evaluate(`(() => {
    const center = document.activeElement.getBoundingClientRect();
    return [...document.querySelectorAll('${marker}')].some(button => button.getBoundingClientRect().left > center.left) ? 'ArrowRight' : 'ArrowLeft';
  })()`);
  await Key(arrow);
  const selected = await Evaluate('document.activeElement.dataset.mapMarker');
  assert.ok(selected && selected !== layout.first, 'An arrow key moves focus to a different marker.');
  await Key('Enter');
  await CheckDetails(selected);

  if (touch) {
    await Click(`${marker}[data-map-marker="${layout.first}"]`, true);
    await CheckDetails(layout.first);
  }

  const filter = await Evaluate(`document.querySelector('${chip}').dataset.mapFilter`);
  const filterSelector = `${chip}[data-map-filter="${filter}"]`;
  const filterSnapshot = `(() => {
    const input = document.querySelector('${filterSelector}');
    const chipStyle = getComputedStyle(input.closest('label'));
    const dots = [...document.querySelectorAll('${dot}[data-category="${filter}"]')];
    const items = [...document.querySelectorAll('${item}')];
    return { checked: input.checked, border: chipStyle.borderColor, weight: Number(chipStyle.fontWeight),
      dots: dots.map(dot => ({ id: dot.dataset.mapDot, state: dot.dataset.dimmed, opacity: Number(getComputedStyle(dot).opacity) })),
      matchingItems: items.filter(button => button.dataset.category === '${filter}').map(button => button.dataset.mapListItem),
      count: items.length };
  })()`;
  const included = await Evaluate(filterSnapshot);
  assert.ok(included.checked && included.matchingItems.length > 0);
  assert.deepEqual(included.dots.map(dot => dot.id).sort(), included.matchingItems.toSorted(), `${filter} marker and list category IDs differ.`);
  await Click(filterSelector, touch);
  await WaitFor(`!document.querySelector('${filterSelector}').checked`);
  const beforePaint = await Evaluate(filterSnapshot);
  // The Hub applies a short transition even under reduced motion.
  await WaitForPaint();
  const filtered = await Evaluate(filterSnapshot);
  const expectedCount = layout.items.length - included.matchingItems.length;
  const outcomes = state => ({
    dimmed: state.dots.length === included.dots.length && state.dots.every(dot => dot.state === 'true' && dot.opacity < 1),
    noFilteredItem: state.matchingItems.length === 0,
    expectedListCount: state.count === expectedCount,
  });
  const beforeOutcomes = outcomes(beforePaint);
  const failed = Object.entries(outcomes(filtered)).filter(([, pass]) => !pass).map(([name]) => name);
  assert.equal(failed.length, 0, `${filter} filter failed ${failed.join(', ')} (expected ${expectedCount} list items). Before paint ${JSON.stringify(beforePaint)}. After paint ${JSON.stringify(filtered)}.`);
  if (Object.values(beforeOutcomes).includes(false)) console.log(`Filter ${filter} at ${width}px before paint: ${JSON.stringify(beforeOutcomes)}`);
  assert.equal(filtered.checked, false);
  assert.ok(included.border !== filtered.border && included.weight > filtered.weight, 'The included chip has a distinct border and stronger label.');
  const listId = await Evaluate(`document.querySelector('${item}').dataset.mapListItem`);
  await Click(`${item}[data-map-list-item="${listId}"]`, touch);
  await CheckDetails(listId);
  const neighborId = await Evaluate(`document.querySelector('[data-map-neighbor]').dataset.mapNeighbor`);
  await Click(`[data-map-neighbor="${neighborId}"]`, touch);
  await CheckDetails(neighborId);
}

async function CheckDetails(id) {
  await WaitFor(`document.querySelector('${details}')?.dataset.mapDetails === ${JSON.stringify(id)}`);
  const category = await Evaluate(`document.querySelector('${marker}[data-map-marker="${id}"]').dataset.category`);
  assert.equal(await Evaluate(`document.querySelector('${details} a').getAttribute('href')`), `/train/?module=${encodeURIComponent(`${category}:${id}`)}`);
  assert.equal(await Evaluate(`document.querySelectorAll('[data-map-neighbor]').length`), 3);
  assert.equal(await Evaluate(`document.querySelectorAll('[data-map-line]').length`), 3);
}

try {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = spawn(brave, ['--headless=new', '--no-first-run', '--disable-gpu', '--remote-debugging-port=0',
    `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
  browser.stderr.on('data', chunk => { browserStderr = (browserStderr + chunk).slice(-4000); });
  browser.once('error', error => { browserExit = error.message; });
  browser.once('exit', (code, signal) => { browserExit = `Brave exited with ${code ?? signal}.`; });
  socket = new WebSocket(await WaitForDebugger());
  await once(socket, 'open');
  socket.addEventListener('message', OnMessage);
  const { targetId } = await Send('Target.createTarget', { url: 'about:blank' }, null);
  session = (await Send('Target.attachToTarget', { targetId, flatten: true }, null)).sessionId;
  await Send('Page.enable');
  await Send('Runtime.enable');
  await Send('Network.enable');
  await Send('Network.setBypassServiceWorker', { bypass: true });
  await Send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await Send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
  for (const [width, height, touch] of [[360, 740, true], [800, 900, false], [1280, 800, false]]) {
    try {
      await CheckViewport(width, height, touch);
      console.log(`PASS ${width}x${height}${touch ? ' (touch emulation)' : ''}`);
    } catch (error) {
      process.exitCode = 1;
      console.error(`FAIL ${width}x${height}: ${error.message}`);
      const screenshot = await Send('Page.captureScreenshot', { format: 'png' }).catch(() => null);
      if (screenshot) {
        const path = join(artifacts, `${width}x${height}-failure.png`);
        await writeFile(path, Buffer.from(screenshot.data, 'base64'));
        console.error(`Screenshot: ${path}`);
      }
    }
  }
} finally {
  if (socket?.readyState === WebSocket.OPEN) await Send('Browser.close', {}, null).catch(() => {});
  socket?.close();
  browser?.kill();
  server.closeAllConnections();
  await new Promise(done => server.close(done));
}
