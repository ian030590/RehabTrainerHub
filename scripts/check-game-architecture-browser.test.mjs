import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { extname, relative, resolve } from 'node:path';
import test from 'node:test';

const repositoryRoot = resolve(import.meta.dirname, '..');
const outputRoot = resolve(process.env.HUB_OUTPUT_ROOT || resolve(repositoryRoot, 'apps/rehabtrainerhub/out'));
const browserSmokeScript = resolve(repositoryRoot, 'scripts/check-browser-route-smoke.mjs');
const bravePath = FindBravePath();
const expFactoryGameIds = [
  'stroop',
  'flanker',
  'go-nogo',
  'stop-signal',
  'attention-network-task',
  'antisaccade',
  'n-back',
  'digit-span',
  'spatial-span',
  'letter-memory',
  'keep-track',
  'tower-of-london',
  'number-letter',
  'plus-minus',
];

test('Brave renders the settings-driven config UI before mounting an official game', async (context) => {
  assert.ok(bravePath, 'Brave is required. Install it in the standard Windows/macOS location or set BRAVE_BIN.');
  assert.equal((await stat(resolve(outputRoot, 'index.html'))).isFile(), true);

  const server = createServer((request, response) => {
    void ServeStaticOutput(request, response);
  });
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  context.after(() => new Promise((resolveClose) => server.close(resolveClose)));
  const address = server.address();
  assert.ok(address && typeof address === 'object');

  const result = await Run(process.execPath, [
    browserSmokeScript,
    '--url', `http://127.0.0.1:${address.port}/`,
    '--storage', 'rehab_hub_tour_seen=1',
    '--clickSelectors', '.official-game-card button',
    '--allSelectors', [
      'dialog.training-overlay-config form',
      'input[type="range"]',
      'input[type="checkbox"]',
      'select',
      'button[type="submit"]',
    ].join(','),
    '--timeoutMs', '5000',
  ], {
    ...process.env,
    BROWSER_EXECUTABLE_PATH: bravePath,
    BRAVE_BIN: bravePath,
  });

  assert.equal(result.exitCode, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /Browser route smoke passed/);
  const fullscreen = await Run(process.execPath, [
    browserSmokeScript,
    '--url', `http://127.0.0.1:${address.port}/`,
    '--storage', 'rehab_hub_tour_seen=1',
    '--clickSelectors', '.official-game-card button,dialog.training-overlay-config button[type="submit"]',
    '--fullscreenSelector', 'html',
    '--allSelectors', 'dialog.training-overlay-runtime iframe',
    '--timeoutMs', '10000',
  ], { ...process.env, BROWSER_EXECUTABLE_PATH: bravePath, BRAVE_BIN: bravePath });
  assert.equal(fullscreen.exitCode, 0, `Hub fullscreen: ${fullscreen.stdout}\n${fullscreen.stderr}`);
  for (const gameId of ['tower-of-london', 'number-letter']) {
    const overlay = await Run(process.execPath, [
      browserSmokeScript,
      '--url', `http://127.0.0.1:${address.port}/`,
      '--storage', 'rehab_hub_tour_seen=1',
      '--clickSelectors', `.official-game-card[data-runtime-id="${gameId}"] button,dialog.training-overlay-config button[type="submit"]`,
      '--allSelectors', 'dialog.training-overlay-runtime iframe',
      '--fullscreenSelector', 'html',
      '--foregroundSelector', 'dialog.training-overlay-runtime',
      '--timeoutMs', '10000',
    ], { ...process.env, BROWSER_EXECUTABLE_PATH: bravePath, BRAVE_BIN: bravePath });
    assert.equal(overlay.exitCode, 0, `${gameId}: ${overlay.stdout}\n${overlay.stderr}`);
  }
  for (const gameId of expFactoryGameIds) {
    const guidedGame = await Run(process.execPath, [
      browserSmokeScript,
      '--url', `http://127.0.0.1:${address.port}/games/${gameId}/`,
      '--clickSelectors', '.game-settings-form button[type="submit"]',
      '--keyPress', 'Enter',
      '--keyPressReadySelector', '.display_stage',
      '--keyPressReadyTimeoutMs', '10000',
      '--allSelectors', '.cognitive-reference-game .display_stage,.jspsych-display-element .bilingual-copy-zh',
      '--fullscreenSelector', 'html',
      '--timeoutMs', '3000',
    ], { ...process.env, BROWSER_EXECUTABLE_PATH: bravePath, BRAVE_BIN: bravePath });
    assert.equal(guidedGame.exitCode, 0, `${gameId}: ${guidedGame.stdout}\n${guidedGame.stderr}`);
  }

  for (const gameId of ['reaction-time', 'asteroid-shield']) {
    const standalone = await Run(process.execPath, [
      browserSmokeScript,
      '--url', `http://127.0.0.1:${address.port}/games/${gameId}/`,
      '--clickSelectors', '.game-settings-form button[type="submit"],.training-rules .btn-ghost,.game-settings-form button[type="submit"]',
      '--allSelectors', '.training-rules,.training-rules button',
      '--timeoutMs', '10000',
    ], { ...process.env, BROWSER_EXECUTABLE_PATH: bravePath, BRAVE_BIN: bravePath });
    assert.equal(standalone.exitCode, 0, `${gameId}: ${standalone.stdout}\n${standalone.stderr}`);
  }
});

function FindBravePath() {
  const candidates = [
    process.env.BRAVE_BIN,
    process.env.BROWSER_EXECUTABLE_PATH,
    'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',
    'C:/Program Files (x86)/BraveSoftware/Brave-Browser/Application/brave.exe',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    resolve(homedir(), 'Applications/Brave Browser.app/Contents/MacOS/Brave Browser'),
  ];

  return candidates.find((candidate) => candidate && existsSync(candidate)) ?? null;
}

test('Brave keeps reaction-time playable on phone and tablet without canvas support', async (context) => {
  assert.ok(bravePath, 'Brave is required for the reaction-time browser check.');
  assert.equal((await stat(resolve(outputRoot, 'games/reaction-time/index.html'))).isFile(), true);
  const server = createServer((request, response) => { void ServeStaticOutput(request, response); });
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  context.after(() => new Promise((resolveClose) => server.close(resolveClose)));

  for (const width of [390, 768]) {
    const result = await Run(process.execPath, [browserSmokeScript,
    '--url', `http://127.0.0.1:${server.address().port}/games/reaction-time/`,
    '--viewportWidth', String(width), '--viewportHeight', '844', '--viewportBeforeClick', 'true',
    '--startupScript', 'HTMLCanvasElement.prototype.getContext = () => null; Math.random = () => 0;',
    '--clickSelectors', '.game-settings-form button[type="submit"],.training-rules .config-start-btn,[data-reaction-target]',
    '--browserScenario', `(async () => {
      const target = document.querySelector('[data-reaction-target]');
      if (!(target instanceof HTMLButtonElement) || target.dataset.reactionState !== 'ready') return false;
      const rect = target.getBoundingClientRect();
      if (rect.width < 44 || rect.height < 44 || document.documentElement.scrollWidth > innerWidth + 1) return false;
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const deadline = Date.now() + 6000;
        while (target.dataset.reactionState !== 'go' && Date.now() < deadline) {
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        if (target.dataset.reactionState !== 'go') return false;
        target.click();
        await new Promise(resolve => setTimeout(resolve, 50));
        if (attempt < 9) target.click();
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      return Boolean(document.querySelector('.experiment-results'));
    })()`,
    '--allSelectors', '.cognitive-reference-game,.experiment-results,.cognitive-trial-results-table',
    '--visibleSelectors', '.experiment-results',
    '--browserAssertion', `(() => {
      const rows = document.querySelectorAll('.cognitive-trial-results-table tbody tr');
      const actions = [...document.querySelectorAll('.experiment-results button')].filter(button => button.offsetParent !== null);
      return rows.length === 10 && actions.length === 1 && document.documentElement.scrollWidth <= innerWidth + 1;
    })()`,
    '--timeoutMs', '5000',
    ], { ...process.env, BROWSER_EXECUTABLE_PATH: bravePath, BRAVE_BIN: bravePath });
    assert.equal(result.exitCode, 0, `${width}px reaction-time canvas fallback: ${result.stdout}\n${result.stderr}`);
  }
});

const startWhackWithoutCanvas = `
  const waitFor = async (selector, timeoutMs = 5000) => {
    const deadline = Date.now() + timeoutMs;
    while (!document.querySelector(selector) && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    return document.querySelector(selector);
  };
  const slider = await waitFor('.game-settings-form input[type="range"]');
  if (!slider) return 'duration slider missing';
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(slider, '30');
  slider.dispatchEvent(new Event('input', { bubbles: true }));
  slider.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 50));
  document.querySelector('.game-settings-form button[type="submit"]').click();
  const start = await waitFor('.training-rules .config-start-btn');
  if (!start) return 'rules start missing';
  start.click();
  const cell = await waitFor('[data-whack-cell]');
  if (!cell) return 'native board missing';
  if (!await waitFor('[data-whack-active="true"]')) return 'active target missing';
`;

test('Brave keeps whack-a-mole playable at 390px and 768px without canvas', async (context) => {
  assert.ok(bravePath, 'Brave is required for the whack-a-mole browser check.');
  assert.equal((await stat(resolve(outputRoot, 'games/whack-a-mole/index.html'))).isFile(), true);
  const server = createServer((request, response) => { void ServeStaticOutput(request, response); });
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  context.after(() => new Promise(resolveClose => server.close(resolveClose)));

  for (const width of [390, 768]) {
    const result = await Run(process.execPath, [browserSmokeScript,
      '--url', `http://127.0.0.1:${server.address().port}/games/whack-a-mole/`,
      '--viewportWidth', String(width), '--viewportHeight', '844', '--viewportBeforeClick', 'true',
      '--startupScript', 'HTMLCanvasElement.prototype.getContext = () => null; Math.random = () => 0;',
      '--browserScenario', `(async () => {
        ${startWhackWithoutCanvas}
        const cells = [...document.querySelectorAll('[data-whack-cell]')];
        const active = cells.filter(cell => cell.dataset.whackActive === 'true');
        if (cells.length !== 9 || active.length !== 1 || cells.some(cell => {
          const rect = cell.getBoundingClientRect();
          return !(cell instanceof HTMLButtonElement) || rect.width < 44 || rect.height < 44;
        }) || document.documentElement.scrollWidth > innerWidth + 1) return JSON.stringify({
          cells: cells.length, active: active.length,
          rect: cells[0]?.getBoundingClientRect().toJSON(),
          scrollWidth: document.documentElement.scrollWidth, viewport: innerWidth,
        });
        active[0].focus();
        if (document.activeElement !== active[0]) return 'cell focus failed';
        active[0].addEventListener('click', () => { window.__whackKeyboardClicks = (window.__whackKeyboardClicks ?? 0) + 1; }, { once: true });
        return true;
      })()`,
      '--keyPress', 'Enter', '--keyPressReadySelector', '[data-whack-active="true"]',
      '--allSelectors', '.cognitive-reference-game,[data-whack-cell]',
      '--browserAssertion', 'window.__whackKeyboardClicks === 1 && document.documentElement.scrollWidth <= innerWidth + 1',
      '--timeoutMs', '5000',
    ], { ...process.env, BROWSER_EXECUTABLE_PATH: bravePath, BRAVE_BIN: bravePath });
    assert.equal(result.exitCode, 0, `${width}px whack-a-mole canvas fallback: ${result.stdout}\n${result.stderr}`);
  }
});

test('Brave ends a canvas-free whack-a-mole session at its 30 second setting', async (context) => {
  assert.ok(bravePath, 'Brave is required for the whack-a-mole duration check.');
  const server = createServer((request, response) => { void ServeStaticOutput(request, response); });
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  context.after(() => new Promise(resolveClose => server.close(resolveClose)));
  const result = await Run(process.execPath, [browserSmokeScript,
    '--url', `http://127.0.0.1:${server.address().port}/games/whack-a-mole/`,
    '--viewportWidth', '390', '--viewportHeight', '844', '--viewportBeforeClick', 'true',
    '--startupScript', 'HTMLCanvasElement.prototype.getContext = () => null; Math.random = () => 0;',
    '--browserScenario', `(async () => {
      ${startWhackWithoutCanvas}
      const startedAt = performance.now();
      const results = await waitFor('.experiment-results', 32000);
      const elapsed = performance.now() - startedAt;
      const actions = [...(results?.querySelectorAll('button') ?? [])].filter(button => button.offsetParent !== null);
      return Boolean(results) && elapsed >= 28000 && elapsed <= 32000
        && actions.length === 1
        && document.documentElement.scrollWidth <= innerWidth + 1;
    })()`,
    '--allSelectors', '.experiment-results,.cognitive-trial-results-table',
    '--timeoutMs', '5000',
  ], { ...process.env, BROWSER_EXECUTABLE_PATH: bravePath, BRAVE_BIN: bravePath });
  assert.equal(result.exitCode, 0, `30 second whack-a-mole session: ${result.stdout}\n${result.stderr}`);
});

test('Brave plays Simon Says on phone and tablet without canvas', async (context) => {
  assert.ok(bravePath, 'Brave is required for the Simon Says browser check.');
  const server = createServer((request, response) => { void ServeStaticOutput(request, response); });
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  context.after(() => new Promise(resolveClose => server.close(resolveClose)));

  for (const width of [390, 768]) {
    const result = await Run(process.execPath, [browserSmokeScript,
      '--url', `http://127.0.0.1:${server.address().port}/games/simon-says/`,
      '--viewportWidth', String(width), '--viewportHeight', '844', '--viewportBeforeClick', 'true',
      '--startupScript', 'HTMLCanvasElement.prototype.getContext = () => null; Math.random = () => 0;',
      '--browserScenario', `(async () => {
        const waitFor = async (selector, timeoutMs = 10000) => {
          const deadline = Date.now() + timeoutMs;
          while (!document.querySelector(selector) && Date.now() < deadline) {
            await new Promise(resolve => setTimeout(resolve, 20));
          }
          return document.querySelector(selector);
        };
        const difficulty = await waitFor('.game-settings-form select');
        if (!difficulty) return 'settings missing';
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(difficulty, '0');
        difficulty.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 50));
        document.querySelector('.game-settings-form button[type="submit"]').click();
        const start = await waitFor('.training-rules .config-start-btn');
        if (!start) return 'rules missing';
        const ruleCopy = document.querySelector('.training-rules')?.innerText || '';
        if (/neon bounce|hover and click|shakes the board/i.test(ruleCopy)) return 'rules promise missing effects';
        start.click();
        if (!await waitFor('[data-simon-button]')) return 'native buttons missing';
        const buttons = [...document.querySelectorAll('[data-simon-button]')];
        if (buttons.length !== 4 || buttons.some(button => {
          const rect = button.getBoundingClientRect();
          return !(button instanceof HTMLButtonElement) || rect.width < 44 || rect.height < 44;
        }) || document.documentElement.scrollWidth > innerWidth + 1) return 'board layout';
        if (${width} === 768) return true;
        for (let length = 1; length <= 5; length += 1) {
          if (!await waitFor('[data-simon-phase="input"]')) return 'input missing at length ' + length;
          for (let index = 0; index < length; index += 1) {
            buttons[0].click();
            await new Promise(resolve => setTimeout(resolve, 30));
          }
          if (length < 5 && !await waitFor('[data-simon-phase="showing"]')) return 'next sequence missing';
        }
        const results = await waitFor('.experiment-results');
        return Boolean(results) && results.querySelectorAll('.cognitive-trial-results-table tbody tr').length === 5
          && [...results.querySelectorAll('button')].filter(button => button.offsetParent !== null).length === 1;
      })()`,
      '--allSelectors', width === 390 ? '.experiment-results,.cognitive-trial-results-table' : '[data-simon-button]',
      '--timeoutMs', '5000',
    ], { ...process.env, BROWSER_EXECUTABLE_PATH: bravePath, BRAVE_BIN: bravePath });
    assert.equal(result.exitCode, 0, `${width}px Simon Says canvas fallback: ${result.stdout}\n${result.stderr}`);
  }
});

test('Brave completes Lights Out on phone and tablet without canvas', async (context) => {
  assert.ok(bravePath, 'Brave is required for the Lights Out browser check.');
  assert.equal((await stat(resolve(outputRoot, 'games/lights-out/index.html'))).isFile(), true);
  const server = createServer((request, response) => { void ServeStaticOutput(request, response); });
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  context.after(() => new Promise(resolveClose => server.close(resolveClose)));

  for (const width of [390, 768, 320]) {
    const compact = width === 320;
    const centerIndex = compact ? 12 : 4;
    const result = await Run(process.execPath, [browserSmokeScript,
      '--url', `http://127.0.0.1:${server.address().port}/games/lights-out/`,
      '--viewportWidth', String(width), '--viewportHeight', compact ? '568' : '844', '--viewportBeforeClick', 'true',
      '--startupScript', `HTMLCanvasElement.prototype.getContext = () => null;
        Math.random = () => 0;
        HTMLElement.prototype.requestFullscreen = () => {
          window.__lightsFullscreenRequested = true;
          return Promise.reject(new DOMException('Denied', 'NotAllowedError'));
        };`,
      '--browserScenario', `(async () => {
        const waitFor = async (selector, timeoutMs = 10000) => {
          const deadline = Date.now() + timeoutMs;
          while (!document.querySelector(selector) && Date.now() < deadline) {
            await new Promise(resolve => setTimeout(resolve, 20));
          }
          return document.querySelector(selector);
        };
        const settings = await waitFor('.game-settings-form');
        const selects = [...(settings?.querySelectorAll('select') ?? [])];
        if (selects.length < 2) return 'difficulty or time limit missing';
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(selects[0], '${compact ? '2' : '0'}');
        selects[0].dispatchEvent(new Event('change', { bubbles: true }));
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(selects[1], '1');
        selects[1].dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 50));
        settings.querySelector('button[type="submit"]').click();
        const start = await waitFor('.training-rules .config-start-btn');
        if (!start) return 'rules missing';
        start.click();
        if (!await waitFor('[data-lights-cell]')) return 'native board missing';
        const cells = [...document.querySelectorAll('[data-lights-cell]')];
        if (cells.length !== ${compact ? 25 : 9} || cells.some(cell => {
          const rect = cell.getBoundingClientRect();
          return !(cell instanceof HTMLButtonElement) || rect.width < 44 || rect.height < 44;
        }) || document.documentElement.scrollWidth > innerWidth + 1) return 'board layout';
        if (getComputedStyle(cells[0]).backgroundColor === 'rgba(0, 0, 0, 0)') return 'board theme missing';
        if (!document.querySelector('.lights-progress')?.textContent.includes('60')) return 'timed setting missing';
        const nativeNow = Date.now;
        Date.now = () => nativeNow() + 120000;
        await new Promise(resolve => setTimeout(resolve, 350));
        Date.now = nativeNow;
        if (!document.querySelector('[data-lights-cell]')) return 'clock adjustment ended session';
        if (!window.__lightsFullscreenRequested) return 'fullscreen denial was not exercised';
        const lit = cells.filter(cell => cell.dataset.lightsOn === 'true');
        if (lit.length !== 5 || cells[${centerIndex}].dataset.lightsOn !== 'true') return 'deterministic puzzle changed';
        if (${width} === 768) {
          cells[0].focus();
          if (document.activeElement !== cells[0]) return 'cell focus failed';
          window.__lightsKeyBefore = cells[0].dataset.lightsOn;
          cells[0].addEventListener('click', () => {
            window.__lightsKeyboardClicks = (window.__lightsKeyboardClicks ?? 0) + 1;
            setTimeout(() => {
              window.__lightsKeyboardChanged = cells[0].dataset.lightsOn !== window.__lightsKeyBefore;
              cells[0].click();
              setTimeout(() => cells[${centerIndex}].click(), 40);
            }, 40);
          }, { once: true });
          return true;
        }
        cells[${centerIndex}].click();
        const results = await waitFor('.experiment-results');
        const actions = [...(results?.querySelectorAll('button') ?? [])].filter(button => button.offsetParent !== null);
        return Boolean(results) && actions.length === 1 && document.documentElement.scrollWidth <= innerWidth + 1;
      })()`,
      ...(width === 768 ? [
        '--keyPress', 'Enter', '--keyPressReadySelector', '[data-lights-cell]',
        '--browserAssertion', `window.__lightsKeyboardClicks === 1
          && window.__lightsKeyboardChanged === true
          && document.querySelectorAll('.experiment-results button').length === 1
          && document.documentElement.scrollWidth <= innerWidth + 1`,
      ] : []),
      '--allSelectors', '.experiment-results',
      '--timeoutMs', '5000',
    ], { ...process.env, BROWSER_EXECUTABLE_PATH: bravePath, BRAVE_BIN: bravePath });
    assert.equal(result.exitCode, 0, `${width}px Lights Out canvas fallback: ${result.stdout}\n${result.stderr}`);
  }
});

test('Brave completes Memory Match on phone and tablet without canvas', async (context) => {
  assert.ok(bravePath, 'Brave is required for the Memory Match browser check.');
  assert.equal((await stat(resolve(outputRoot, 'games/memory-match/index.html'))).isFile(), true);
  const server = createServer((request, response) => { void ServeStaticOutput(request, response); });
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  context.after(() => new Promise(resolveClose => server.close(resolveClose)));

  for (const width of [390, 768]) {
    const result = await Run(process.execPath, [browserSmokeScript,
      '--url', `http://127.0.0.1:${server.address().port}/games/memory-match/`,
      '--viewportWidth', String(width), '--viewportHeight', '844', '--viewportBeforeClick', 'true',
      '--startupScript', 'HTMLCanvasElement.prototype.getContext = () => null; Math.random = () => 0;',
      '--browserScenario', `(async () => {
        const waitFor = async (selector, timeoutMs = 10000) => {
          const deadline = Date.now() + timeoutMs;
          while (!document.querySelector(selector) && Date.now() < deadline) {
            await new Promise(resolve => setTimeout(resolve, 20));
          }
          return document.querySelector(selector);
        };
        const waitUntil = async (check, timeoutMs = 2000) => {
          const deadline = Date.now() + timeoutMs;
          while (!check() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
          return check();
        };
        const difficulty = await waitFor('.game-settings-form select');
        if (!difficulty) return 'settings missing';
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(difficulty, '0');
        difficulty.dispatchEvent(new Event('change', { bubbles: true }));
        const limit = document.querySelectorAll('.game-settings-form select')[1];
        if (!limit) return 'limit setting missing';
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(limit, '1');
        limit.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 50));
        document.querySelector('.game-settings-form button[type="submit"]').click();
        const start = await waitFor('.training-rules .config-start-btn');
        if (!start) return 'rules missing';
        start.click();
        if (!await waitFor('[data-memory-card]')) return 'native board missing';
        const cards = [...document.querySelectorAll('[data-memory-card]')];
        if (cards.length !== 12 || cards.some(card => {
          const rect = card.getBoundingClientRect();
          return !(card instanceof HTMLButtonElement) || rect.width < 44 || rect.height < 44;
        }) || document.documentElement.scrollWidth > innerWidth + 1) return 'board layout';
        const progress = document.querySelector('.memory-progress');
        if (progress?.getAttribute('aria-live') === 'polite') return 'countdown announces every second';
        if (!document.querySelector('.memory-progress')?.textContent.includes('60')) {
          return 'timed setting missing: ' + limit.value + ' / ' + document.querySelector('.memory-progress')?.textContent;
        }
        const nativeNow = Date.now;
        Date.now = () => nativeNow() + 120000;
        await new Promise(resolve => setTimeout(resolve, 350));
        Date.now = nativeNow;
        if (!document.querySelector('[data-memory-card]')) return 'clock adjustment ended session';
        const cardStyle = getComputedStyle(cards[0]);
        if (cardStyle.backgroundColor === 'rgba(0, 0, 0, 0)' || parseFloat(cardStyle.borderRadius) === 0) {
          return 'card theme missing';
        }
        const remembered = new Map();
        const seen = new Set();
        for (let attempt = 0; attempt < 40; attempt += 1) {
          if (document.querySelector('.experiment-results')) break;
          if (cards.every(card => card.dataset.memoryState === 'matched')) break;
          const hidden = cards.map((card, index) => card.dataset.memoryState === 'hidden' ? index : -1).filter(index => index >= 0);
          const first = hidden[0];
          if (first === undefined) return 'hidden cards missing';
          cards[first].click();
          if (!await waitUntil(() => cards[first].dataset.memoryState === 'revealed')) return 'first card did not reveal';
          const firstValue = cards[first].textContent.trim();
          seen.add(first);
          remembered.set(firstValue, [...new Set([...(remembered.get(firstValue) || []), first])]);
          const second = remembered.get(firstValue).find(index => index !== first && cards[index].dataset.memoryState === 'hidden')
            ?? hidden.find(index => index !== first && !seen.has(index))
            ?? hidden.find(index => index !== first);
          if (second === undefined) return 'second card missing';
          cards[second].click();
          if (!await waitUntil(() => document.querySelector('.experiment-results') || cards[second].dataset.memoryState !== 'hidden')) return 'second card did not reveal';
          if (document.querySelector('.experiment-results')) break;
          const secondValue = cards[second].textContent.trim();
          seen.add(second);
          remembered.set(secondValue, [...new Set([...(remembered.get(secondValue) || []), second])]);
          if (firstValue !== secondValue && !await waitUntil(() => cards[first].dataset.memoryState === 'hidden' && cards[second].dataset.memoryState === 'hidden', 1500)) return 'mismatch did not flip back';
        }
        const results = await waitFor('.experiment-results');
        const actions = [...(results?.querySelectorAll('button') ?? [])].filter(button => button.offsetParent !== null);
        return Boolean(results) && actions.length === 1 && document.documentElement.scrollWidth <= innerWidth + 1;
      })()`,
      '--allSelectors', '.experiment-results',
      '--timeoutMs', '5000',
    ], { ...process.env, BROWSER_EXECUTABLE_PATH: bravePath, BRAVE_BIN: bravePath });
    assert.equal(result.exitCode, 0, `${width}px Memory Match canvas fallback: ${result.stdout}\n${result.stderr}`);
  }
});

test('Brave plays Sliding Puzzle on phone and tablet without canvas', async (context) => {
  assert.ok(bravePath, 'Brave is required for the Sliding Puzzle browser check.');
  assert.equal((await stat(resolve(outputRoot, 'games/sliding-puzzle/index.html'))).isFile(), true);
  const server = createServer((request, response) => { void ServeStaticOutput(request, response); });
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  context.after(() => new Promise(resolveClose => server.close(resolveClose)));

  for (const width of [390, 768, 320]) {
    const compact = width === 320;
    const result = await Run(process.execPath, [browserSmokeScript,
      '--url', `http://127.0.0.1:${server.address().port}/games/sliding-puzzle/`,
      '--viewportWidth', String(width), '--viewportHeight', compact ? '568' : '844', '--viewportBeforeClick', 'true',
      '--startupScript', `HTMLCanvasElement.prototype.getContext = () => null;
        Math.random = () => 0;
        HTMLElement.prototype.requestFullscreen = () => {
          window.__slidingFullscreenRequested = true;
          return Promise.reject(new DOMException('Denied', 'NotAllowedError'));
        };`,
      '--browserScenario', `(async () => {
        const waitFor = async (selector, timeoutMs = 10000) => {
          const deadline = Date.now() + timeoutMs;
          while (!document.querySelector(selector) && Date.now() < deadline) {
            await new Promise(resolve => setTimeout(resolve, 20));
          }
          return document.querySelector(selector);
        };
        const settings = await waitFor('.game-settings-form');
        const selects = [...(settings?.querySelectorAll('select') ?? [])];
        if (selects.length < 2) return 'difficulty or time limit missing';
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(selects[0], '${compact ? '2' : '0'}');
        selects[0].dispatchEvent(new Event('change', { bubbles: true }));
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(selects[1], '1');
        selects[1].dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 50));
        settings.querySelector('button[type="submit"]').click();
        const start = await waitFor('.training-rules .config-start-btn');
        if (!start) return 'rules missing';
        start.click();
        if (!await waitFor('[data-sliding-cell]')) return 'native board missing';
        const cells = [...document.querySelectorAll('[data-sliding-cell]')];
        if (cells.length !== ${compact ? 25 : 9} || cells.some(cell => {
          const rect = cell.getBoundingClientRect();
          return rect.width < 44 || rect.height < 44
            || (cell.dataset.slidingValue !== '0' && (!(cell instanceof HTMLButtonElement) || cell.disabled));
        }) || document.documentElement.scrollWidth > innerWidth + 1) return 'board layout';
        if (getComputedStyle(cells[0]).backgroundColor === 'rgba(0, 0, 0, 0)') return 'board theme missing';
        if (!document.querySelector('.sliding-progress')?.textContent.includes('60')) return 'timed setting missing';
        const nativeNow = Date.now;
        Date.now = () => nativeNow() + 120000;
        await new Promise(resolve => setTimeout(resolve, 350));
        Date.now = nativeNow;
        if (!document.querySelector('[data-sliding-cell]')) return 'clock adjustment ended session';
        if (!window.__slidingFullscreenRequested) return 'fullscreen denial was not exercised';
        if (${compact}) return true;
        if (cells[6].dataset.slidingValue !== '0') return 'deterministic puzzle changed';
        if (${width} === 768) {
          cells[7].focus();
          if (document.activeElement !== cells[7]) return 'tile focus failed';
          window.__slidingKeyboardBefore = cells[7].dataset.slidingValue;
          cells[7].addEventListener('click', () => {
            window.__slidingKeyboardClicks = (window.__slidingKeyboardClicks ?? 0) + 1;
            setTimeout(() => {
              window.__slidingKeyboardChanged = cells[7].dataset.slidingValue !== window.__slidingKeyboardBefore;
              for (const index of [4, 1, 2, 5, 8]) cells[index].click();
            }, 40);
          }, { once: true });
          return true;
        }
        for (const index of [7, 4, 1, 2, 5, 8]) cells[index].click();
        const results = await waitFor('.experiment-results');
        const actions = [...(results?.querySelectorAll('button') ?? [])].filter(button => button.offsetParent !== null);
        return Boolean(results) && actions.length === 1 && document.documentElement.scrollWidth <= innerWidth + 1;
      })()`,
      ...(width === 768 ? [
        '--keyPress', 'Enter', '--keyPressReadySelector', '[data-sliding-cell]',
        '--browserAssertion', `window.__slidingKeyboardClicks === 1
          && window.__slidingKeyboardChanged === true
          && document.querySelectorAll('.experiment-results button').length === 1
          && document.documentElement.scrollWidth <= innerWidth + 1`,
      ] : []),
      '--allSelectors', compact ? '[data-sliding-cell]' : '.experiment-results',
      '--timeoutMs', '5000',
    ], { ...process.env, BROWSER_EXECUTABLE_PATH: bravePath, BRAVE_BIN: bravePath });
    assert.equal(result.exitCode, 0, `${width}px Sliding Puzzle canvas fallback: ${result.stdout}\n${result.stderr}`);
  }
});

test('Brave plays number grids on phone and tablet without canvas', async (context) => {
  assert.ok(bravePath, 'Brave is required for the number-grid browser check.');
  assert.equal((await stat(resolve(outputRoot, 'games/sudoku/index.html'))).isFile(), true);
  const server = createServer((request, response) => { void ServeStaticOutput(request, response); });
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  context.after(() => new Promise(resolveClose => server.close(resolveClose)));

  for (const width of [390, 768, 320]) {
    const compact = width === 320;
    const result = await Run(process.execPath, [browserSmokeScript,
      '--url', `http://127.0.0.1:${server.address().port}/games/sudoku/`,
      '--viewportWidth', String(width), '--viewportHeight', compact ? '568' : '844', '--viewportBeforeClick', 'true',
      '--startupScript', `HTMLCanvasElement.prototype.getContext = () => null;
        Math.random = () => 0;
        HTMLElement.prototype.requestFullscreen = () => {
          window.__numberFullscreenRequested = true;
          return Promise.reject(new DOMException('Denied', 'NotAllowedError'));
        };`,
      '--browserScenario', `(async () => {
        const waitFor = async (selector, timeoutMs = 10000) => {
          const deadline = Date.now() + timeoutMs;
          while (!document.querySelector(selector) && Date.now() < deadline) {
            await new Promise(resolve => setTimeout(resolve, 20));
          }
          return document.querySelector(selector);
        };
        const settings = await waitFor('.game-settings-form');
        const selects = [...(settings?.querySelectorAll('select') ?? [])];
        if (selects.length < 2) return 'difficulty or time limit missing';
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(selects[0], '${compact ? '2' : '0'}');
        selects[0].dispatchEvent(new Event('change', { bubbles: true }));
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(selects[1], '1');
        selects[1].dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 50));
        settings.querySelector('button[type="submit"]').click();
        const start = await waitFor('.training-rules .config-start-btn');
        if (!start) return 'rules missing';
        start.click();
        if (!await waitFor('[data-number-cell]')) return 'native board missing';
        const cells = [...document.querySelectorAll('[data-number-cell]')];
        const editable = cells.filter(cell => cell.dataset.numberGiven === 'false');
        const given = cells.find(cell => cell.dataset.numberGiven === 'true');
        if (cells.length !== ${compact ? 81 : 16} || editable.length !== ${compact ? 50 : 6}
          || !given || editable.some(cell => !(cell instanceof HTMLButtonElement)
            || cell.getBoundingClientRect().width < 44 || cell.getBoundingClientRect().height < 44)
          || document.documentElement.scrollWidth > innerWidth + 1) return 'board layout';
        if (getComputedStyle(editable[0]).backgroundColor === 'rgba(0, 0, 0, 0)') return 'board theme missing';
        if (!document.querySelector('.number-grid-progress')?.textContent.includes('60')) return 'timed setting missing';
        if (${compact}) {
          const scroller = document.querySelector('[data-number-board-scroll]');
          if (!scroller || scroller.scrollWidth <= scroller.clientWidth) return 'hard board internal scroll missing';
        }
        const givenBefore = given.dataset.numberValue;
        given.click();
        if (given.dataset.numberValue !== givenBefore) return 'given changed';
        const nativeNow = Date.now;
        Date.now = () => nativeNow() + 120000;
        await new Promise(resolve => setTimeout(resolve, 350));
        Date.now = nativeNow;
        if (!document.querySelector('[data-number-cell]')) return 'clock adjustment ended session';
        if (!window.__numberFullscreenRequested) return 'fullscreen denial was not exercised';
        const first = document.querySelector('[data-number-cell][data-number-given="false"]');
        if (${width} === 768) {
          first.focus();
          if (document.activeElement !== first) return 'cell focus failed';
          window.__numberValueBefore = first.dataset.numberValue;
          first.addEventListener('click', () => {
            window.__numberKeyboardClicks = (window.__numberKeyboardClicks ?? 0) + 1;
            setTimeout(() => { window.__numberKeyboardChanged = first.dataset.numberValue !== window.__numberValueBefore; }, 50);
          }, { once: true });
          return true;
        }
        first.click();
        await new Promise(resolve => setTimeout(resolve, 50));
        if (first.dataset.numberValue !== '1') return 'editable cell did not cycle: ' + first.dataset.numberValue;
        if (document.documentElement.scrollWidth > innerWidth + 1) return 'page overflow after tap';
        return true;
      })()`,
      ...(width === 768 ? [
        '--keyPress', 'Enter', '--keyPressReadySelector', '[data-number-cell][data-number-given="false"]',
        '--browserAssertion', `window.__numberKeyboardClicks === 1 && window.__numberKeyboardChanged === true
          && document.documentElement.scrollWidth <= innerWidth + 1`,
      ] : []),
      '--allSelectors', '[data-number-cell]',
      '--timeoutMs', '5000',
    ], { ...process.env, BROWSER_EXECUTABLE_PATH: bravePath, BRAVE_BIN: bravePath });
    assert.equal(result.exitCode, 0, `${width}px number grid: ${result.stdout}\n${result.stderr}`);
  }
});

test('Brave plays Tic Tac Toe on phone and tablet without canvas', async (context) => {
  assert.ok(bravePath, 'Brave is required for the Tic Tac Toe browser check.');
  assert.equal((await stat(resolve(outputRoot, 'games/tic-tac-toe/index.html'))).isFile(), true);
  const server = createServer((request, response) => { void ServeStaticOutput(request, response); });
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  context.after(() => new Promise(resolveClose => server.close(resolveClose)));

  for (const [width, difficulty, size] of [[390, '0', 3], [768, '1', 4], [320, '2', 5]]) {
    const result = await Run(process.execPath, [browserSmokeScript,
      '--url', `http://127.0.0.1:${server.address().port}/games/tic-tac-toe/`,
      '--viewportWidth', String(width), '--viewportHeight', width === 320 ? '568' : '844', '--viewportBeforeClick', 'true',
      '--startupScript', `HTMLCanvasElement.prototype.getContext = () => null;
        Math.random = () => 0;
        window.AudioContext = class { constructor() { throw new Error('Audio denied'); } };
        HTMLElement.prototype.requestFullscreen = () => {
          window.__ticFullscreenRequested = true;
          return Promise.reject(new DOMException('Denied', 'NotAllowedError'));
        };`,
      '--browserScenario', `(async () => {
        const waitFor = async (find, timeoutMs = 10000) => {
          const deadline = Date.now() + timeoutMs;
          while (!find() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
          return find();
        };
        const settings = await waitFor(() => document.querySelector('.game-settings-form'));
        const select = settings?.querySelector('select');
        if (!select) return 'difficulty setting missing';
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, '${difficulty}');
        select.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 50));
        settings.querySelector('button[type="submit"]').click();
        const start = await waitFor(() => document.querySelector('.training-rules .config-start-btn'));
        if (!start) return 'rules missing';
        start.click();
        const cells = await waitFor(() => {
          const found = [...document.querySelectorAll('[data-tic-cell]')];
          return found.length ? found : null;
        });
        if (!cells) return 'native board missing';
        const board = document.querySelector('.tic-board');
        const status = document.querySelector('.tic-status');
        if (cells.length !== ${size * size} || !board || !status?.textContent?.trim()
          || getComputedStyle(board).display !== 'grid'
          || cells.some(cell => !(cell instanceof HTMLButtonElement)
            || cell.getBoundingClientRect().width < 44 || cell.getBoundingClientRect().height < 44)
          || document.documentElement.scrollWidth > innerWidth + 1) return 'board layout';
        if (getComputedStyle(cells[0]).backgroundColor === 'rgba(0, 0, 0, 0)') return 'board theme missing';
        if (!window.__ticFullscreenRequested) return 'fullscreen denial was not exercised';
        const first = cells[0];
        if (${width} === 768) {
          first.focus();
          if (document.activeElement !== first) return 'cell focus failed';
          first.addEventListener('click', () => {
            setTimeout(() => { window.__ticKeyboardChanged = first.dataset.ticMark === 'X'; }, 50);
          }, { once: true });
          return true;
        }
        first.click();
        if (!await waitFor(() => first.dataset.ticMark === 'X', 2000)) return 'X did not move';
        if (!await waitFor(() => cells[Math.floor(cells.length / 2)].dataset.ticMark === 'O', 2500))
          return 'O did not move after one second';
        return document.querySelectorAll('[data-tic-mark="X"]').length === 1
          && document.querySelectorAll('[data-tic-mark="O"]').length === 1
          && document.documentElement.scrollWidth <= innerWidth + 1;
      })()`,
      ...(width === 768 ? [
        '--keyPress', 'Enter', '--keyPressReadySelector', '[data-tic-cell]',
        '--browserAssertion', 'window.__ticKeyboardChanged === true && document.documentElement.scrollWidth <= innerWidth + 1',
      ] : []),
      '--allSelectors', '[data-tic-cell],.tic-status',
      '--timeoutMs', '5000',
    ], { ...process.env, BROWSER_EXECUTABLE_PATH: bravePath, BRAVE_BIN: bravePath });
    assert.equal(result.exitCode, 0, `${width}px Tic Tac Toe: ${result.stdout}\n${result.stderr}`);
  }
});

test('Brave records one Tic Tac Toe victory inside Hub without canvas', async (context) => {
  assert.ok(bravePath, 'Brave is required for the Hub Tic Tac Toe check.');
  const uploads = [];
  const server = createServer((request, response) => {
    if (request.url === '/api/records' && request.method === 'POST') {
      let body = '';
      request.on('data', chunk => { body += chunk; });
      request.on('end', () => {
        uploads.push(JSON.parse(body));
        response.writeHead(201, { 'Content-Type': 'application/json' }).end('{"ok":true}');
      });
      return;
    }
    void ServeStaticOutput(request, response);
  });
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  context.after(() => new Promise(resolveClose => server.close(resolveClose)));

  const result = await Run(process.execPath, [browserSmokeScript,
    '--url', `http://127.0.0.1:${server.address().port}/`,
    '--storage', 'rehab_hub_tour_seen=1,rehab-trainer-hub-language=en',
    '--viewportWidth', '390', '--viewportHeight', '844', '--viewportBeforeClick', 'true',
    '--startupScript', `HTMLCanvasElement.prototype.getContext = () => null;
      Math.random = () => 0;
      window.AudioContext = class { constructor() { throw new Error('Audio denied'); } };
      HTMLElement.prototype.requestFullscreen = () => Promise.reject(new DOMException('Denied', 'NotAllowedError'));`,
    '--browserScenario', `(async () => {
      const waitFor = async (find, timeoutMs = 10000) => {
        const deadline = Date.now() + timeoutMs;
        while (!find() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
        return find();
      };
      const launch = await waitFor(() => document.querySelector('.official-game-card[data-runtime-id="tic-tac-toe"] button'));
      if (!launch) return 'lobby card missing';
      launch.click();
      const settings = await waitFor(() => document.querySelector('dialog.training-overlay-config form'));
      const difficulty = settings?.querySelector('select');
      if (!difficulty) return 'Hub difficulty missing';
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(difficulty, '0');
      difficulty.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 50));
      settings.querySelector('button[type="submit"]').click();
      const start = await waitFor(() => document.querySelector('dialog.training-overlay-runtime iframe')?.contentDocument
        ?.querySelector('.training-rules .config-start-btn'));
      if (!start) return 'rules missing';
      const game = start.ownerDocument;
      start.click();
      const cells = await waitFor(() => {
        const found = [...game.querySelectorAll('[data-tic-cell]')];
        return found.length ? found : null;
      });
      if (!cells || cells.length !== 9) return 'native board missing';
      for (const [turn, index] of [0, 7, 6, 8].entries()) {
        cells[index].click();
        if (turn === 3) break; // Winning tap unmounts the board before its DOM attributes update.
        if (!await waitFor(() => cells[index].dataset.ticMark === 'X', 2000))
          return 'X move failed at ' + index;
        if (!await waitFor(() => [...cells].filter(cell => cell.dataset.ticMark === 'O').length === turn + 1, 2500))
          return 'O turn failed at ' + index;
      }
      const score = await waitFor(() => document.querySelector('.training-overlay-score table'));
      if (!score) return 'Hub score missing';
      if (!await waitFor(() => document.querySelector('.training-score-toolbar [role="status"]')
        ?.textContent.includes('Session record saved.'))) return 'Hub save incomplete';
      return score.querySelectorAll('thead th').length === 7
        && !document.querySelector('.training-overlay-score iframe')
        && document.documentElement.scrollWidth <= innerWidth + 1;
    })()`,
    '--allSelectors', '.training-overlay-score table',
    '--timeoutMs', '5000',
  ], { ...process.env, BROWSER_EXECUTABLE_PATH: bravePath, BRAVE_BIN: bravePath });
  assert.equal(result.exitCode, 0, `Hub Tic Tac Toe: ${result.stdout}\n${result.stderr}`);
  assert.equal(uploads.length, 1, 'a Hub game saves exactly once');
  const score = uploads[0]?.record?.score;
  assert.deepEqual(Object.keys(score?.summary ?? {}), [
    'duration', 'moves', 'completed', 'errors', 'opponentMoves', 'boardSize',
  ]);
  assert.ok(Object.values(score.summary).every(value => typeof value === 'number' && Number.isFinite(value)));
  assert.deepEqual([score.summary.moves, score.summary.completed, score.summary.errors,
    score.summary.opponentMoves, score.summary.boardSize], [4, 1, 0, 3, 3]);
});

test('Brave records one Sudoku entry victory inside Hub without canvas', async (context) => {
  assert.ok(bravePath, 'Brave is required for the Hub number-grid check.');
  const uploads = [];
  const server = createServer((request, response) => {
    if (request.url === '/api/records' && request.method === 'POST') {
      let body = '';
      request.on('data', chunk => { body += chunk; });
      request.on('end', () => {
        uploads.push(JSON.parse(body));
        response.writeHead(201, { 'Content-Type': 'application/json' }).end('{"ok":true}');
      });
      return;
    }
    void ServeStaticOutput(request, response);
  });
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  context.after(() => new Promise(resolveClose => server.close(resolveClose)));

  const result = await Run(process.execPath, [browserSmokeScript,
    '--url', `http://127.0.0.1:${server.address().port}/`,
    '--storage', 'rehab_hub_tour_seen=1,rehab-trainer-hub-language=en',
    '--viewportWidth', '390', '--viewportHeight', '844', '--viewportBeforeClick', 'true',
    '--startupScript', `HTMLCanvasElement.prototype.getContext = () => null;
      Math.random = () => 0;
      HTMLElement.prototype.requestFullscreen = () => Promise.reject(new DOMException('Denied', 'NotAllowedError'));`,
    '--browserScenario', `(async () => {
      const waitFor = async (find, timeoutMs = 10000) => {
        const deadline = Date.now() + timeoutMs;
        while (!find() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
        return find();
      };
      const launch = await waitFor(() => document.querySelector('.official-game-card[data-runtime-id="sudoku"] button'));
      if (!launch) return 'lobby card missing';
      launch.click();
      const settings = await waitFor(() => document.querySelector('dialog.training-overlay-config form'));
      if (!settings) return 'Hub settings missing';
      const difficulty = settings.querySelector('select');
      if (!difficulty) return 'difficulty missing';
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(difficulty, '0');
      difficulty.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 50));
      settings.querySelector('button[type="submit"]').click();
      const start = await waitFor(() => document.querySelector('dialog.training-overlay-runtime iframe')?.contentDocument
        ?.querySelector('.training-rules .config-start-btn'));
      if (!start) return 'rules missing';
      const game = start.ownerDocument;
      start.click();
      const cells = await waitFor(() => {
        const found = [...game.querySelectorAll('[data-number-cell]')];
        return found.length ? found : null;
      });
      if (!cells || cells.length !== 16 || cells.filter(cell => cell.dataset.numberGiven === 'false').length !== 6)
        return 'Latin board missing';
      for (const index of [1, 2, 3, 4, 5, 6]) {
        const expected = String((Math.floor(index / 4) + index % 4) % 4 + 1);
        for (let tap = 0; tap < 5 && cells[index].dataset.numberValue !== expected; tap += 1) {
          cells[index].click();
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        if (cells[index].dataset.numberValue !== expected && index !== 6)
          return 'number cycling failed at ' + index + ': ' + cells[index].dataset.numberValue + ' != ' + expected;
      }
      const score = await waitFor(() => document.querySelector('.training-overlay-score table'));
      if (!score) return 'Hub score missing';
      if (!await waitFor(() => document.querySelector('.training-score-toolbar [role="status"]')
        ?.textContent.includes('Session record saved.'))) return 'Hub save incomplete';
      return score.querySelectorAll('thead th').length === 8
        && !document.querySelector('.training-overlay-score iframe')
        && document.documentElement.scrollWidth <= innerWidth + 1;
    })()`,
    '--allSelectors', '.training-overlay-score table',
    '--timeoutMs', '5000',
  ], { ...process.env, BROWSER_EXECUTABLE_PATH: bravePath, BRAVE_BIN: bravePath });
  assert.equal(result.exitCode, 0, `Hub Sudoku entry: ${result.stdout}\n${result.stderr}`);
  assert.equal(uploads.length, 1, 'a Hub game saves exactly once');
  const score = uploads[0]?.record?.score;
  assert.deepEqual(Object.keys(score?.summary ?? {}), [
    'duration', 'moves', 'completed', 'errors', 'boardSize', 'puzzleKind', 'initialBlanks',
  ]);
  assert.ok(Object.values(score.summary).every(value => typeof value === 'number' && Number.isFinite(value)));
  assert.deepEqual([score.summary.moves, score.summary.completed, score.summary.errors,
    score.summary.boardSize, score.summary.puzzleKind, score.summary.initialBlanks],
  [18, 1, 3, 4, 0, 6]);
});

test('Brave shows a retry when an embedded game never reports ready', async (context) => {
  assert.ok(bravePath, 'Brave is required for the embedded loading check.');
  const server = createServer((request, response) => {
    if (new URL(request.url, 'http://127.0.0.1').pathname === '/games/reaction-time/') {
      response.writeHead(200, { 'Content-Type': 'text/html' }).end('<!doctype html><title>Game unavailable</title>');
      return;
    }
    void ServeStaticOutput(request, response);
  });
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  context.after(() => new Promise(resolveClose => server.close(resolveClose)));

  const result = await Run(process.execPath, [browserSmokeScript,
    '--url', `http://127.0.0.1:${server.address().port}/`,
    '--storage', 'rehab_hub_tour_seen=1,rehab-trainer-hub-language=en',
    '--viewportWidth', '390', '--viewportHeight', '844', '--viewportBeforeClick', 'true',
    '--clickSelectors', '.official-game-card[data-runtime-id="reaction-time"] button,dialog.training-overlay-config button[type="submit"]',
    '--browserScenario', `(async () => {
      const deadline = Date.now() + 10000;
      while (!document.querySelector('.embedded-training-frame [role="alert"]') && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      const frame = document.querySelector('.embedded-training-frame');
      const retry = frame?.querySelector('[data-training-retry]');
      if (!retry || frame.classList.contains('is-ready')) return false;
      const oldIframe = frame.querySelector('iframe');
      retry.click();
      await new Promise(resolve => setTimeout(resolve, 100));
      return frame.querySelector('iframe') !== oldIframe
        && !frame.querySelector('[role="alert"]')
        && Boolean(frame.querySelector('[role="status"]'));
    })()`,
    '--allSelectors', '.embedded-training-frame iframe',
    '--timeoutMs', '5000',
  ], { ...process.env, BROWSER_EXECUTABLE_PATH: bravePath, BRAVE_BIN: bravePath });
  assert.equal(result.exitCode, 0, `${result.stdout}\n${result.stderr}`);
});

test('Brave records one real Lights Out victory inside Hub without canvas', async (context) => {
  assert.ok(bravePath, 'Brave is required for the Hub Lights Out check.');
  const uploads = [];
  const server = createServer((request, response) => {
    if (request.url === '/api/records' && request.method === 'POST') {
      let body = '';
      request.on('data', chunk => { body += chunk; });
      request.on('end', () => {
        uploads.push(JSON.parse(body));
        response.writeHead(201, { 'Content-Type': 'application/json' }).end('{"ok":true}');
      });
      return;
    }
    void ServeStaticOutput(request, response);
  });
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  context.after(() => new Promise(resolveClose => server.close(resolveClose)));

  const result = await Run(process.execPath, [browserSmokeScript,
    '--url', `http://127.0.0.1:${server.address().port}/`,
    '--storage', 'rehab_hub_tour_seen=1,rehab-trainer-hub-language=en',
    '--viewportWidth', '390', '--viewportHeight', '844', '--viewportBeforeClick', 'true',
    '--startupScript', `HTMLCanvasElement.prototype.getContext = () => null;
      Math.random = () => 0;
      HTMLElement.prototype.requestFullscreen = () => Promise.reject(new DOMException('Denied', 'NotAllowedError'));`,
    '--browserScenario', `(async () => {
      const waitFor = async (find, timeoutMs = 10000) => {
        const deadline = Date.now() + timeoutMs;
        while (!find() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
        return find();
      };
      const launch = await waitFor(() => document.querySelector('.official-game-card[data-runtime-id="lights-out"] button'));
      if (!launch) return 'lobby card missing';
      launch.click();
      const settings = await waitFor(() => document.querySelector('dialog.training-overlay-config form'));
      if (!settings) return 'Hub settings missing';
      const difficulty = settings.querySelector('select');
      if (!difficulty) return 'difficulty missing';
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(difficulty, '0');
      difficulty.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 50));
      settings.querySelector('button[type="submit"]').click();
      const start = await waitFor(() => document.querySelector('dialog.training-overlay-runtime iframe')?.contentDocument
        ?.querySelector('.training-rules .config-start-btn'));
      if (!start) return 'rules missing';
      const game = start.ownerDocument;
      start.click();
      const cells = await waitFor(() => {
        const found = [...game.querySelectorAll('[data-lights-cell]')];
        return found.length ? found : null;
      });
      if (cells.length !== 9 || cells[4].dataset.lightsOn !== 'true') return 'board missing';
      cells[4].click();
      const score = await waitFor(() => document.querySelector('.training-overlay-score table'));
      if (!score) return 'Hub score missing';
      if (!await waitFor(() => document.querySelector('.training-score-toolbar [role="status"]')
        ?.textContent.includes('Session record saved.'))) return 'Hub save incomplete';
      const summary = document.querySelector('.training-overlay-score');
      const heads = [...score.querySelectorAll('thead th')];
      const primary = summary.querySelectorAll('.training-score-key-grid > div');
      const context = summary.querySelectorAll('.training-score-secondary-grid section:first-child .training-score-compact-list > div');
      return heads.length === 5 && primary.length === 3 && context.length === 1
        && !summary.querySelector('iframe')
        && document.documentElement.scrollWidth <= innerWidth + 1;
    })()`,
    '--allSelectors', '.training-overlay-score table',
    '--timeoutMs', '5000',
  ], { ...process.env, BROWSER_EXECUTABLE_PATH: bravePath, BRAVE_BIN: bravePath });
  assert.equal(result.exitCode, 0, `Hub Lights Out: ${result.stdout}\n${result.stderr}`);
  assert.equal(uploads.length, 1, 'a Hub game saves exactly once');
  const score = uploads[0]?.record?.score;
  assert.deepEqual(Object.keys(score?.summary ?? {}), ['duration', 'moves', 'completed', 'boardSize']);
  assert.ok(Object.values(score.summary).every(value => typeof value === 'number' && Number.isFinite(value)));
  assert.equal(score.summary.completed, 1);
  assert.equal(score.summary.moves, 1);
  assert.equal(score.summary.boardSize, 3);
});

test('Brave records one Sliding Puzzle victory inside Hub without canvas', async (context) => {
  assert.ok(bravePath, 'Brave is required for the Hub Sliding Puzzle check.');
  const uploads = [];
  const server = createServer((request, response) => {
    if (request.url === '/api/records' && request.method === 'POST') {
      let body = '';
      request.on('data', chunk => { body += chunk; });
      request.on('end', () => {
        uploads.push(JSON.parse(body));
        response.writeHead(201, { 'Content-Type': 'application/json' }).end('{"ok":true}');
      });
      return;
    }
    void ServeStaticOutput(request, response);
  });
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  context.after(() => new Promise(resolveClose => server.close(resolveClose)));

  const result = await Run(process.execPath, [browserSmokeScript,
    '--url', `http://127.0.0.1:${server.address().port}/`,
    '--storage', 'rehab_hub_tour_seen=1,rehab-trainer-hub-language=en',
    '--viewportWidth', '390', '--viewportHeight', '844', '--viewportBeforeClick', 'true',
    '--startupScript', `HTMLCanvasElement.prototype.getContext = () => null;
      Math.random = () => 0;
      HTMLElement.prototype.requestFullscreen = () => Promise.reject(new DOMException('Denied', 'NotAllowedError'));`,
    '--browserScenario', `(async () => {
      const waitFor = async (find, timeoutMs = 10000) => {
        const deadline = Date.now() + timeoutMs;
        while (!find() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
        return find();
      };
      const launch = await waitFor(() => document.querySelector('.official-game-card[data-runtime-id="sliding-puzzle"] button'));
      if (!launch) return 'lobby card missing';
      launch.click();
      const settings = await waitFor(() => document.querySelector('dialog.training-overlay-config form'));
      if (!settings) return 'Hub settings missing';
      const difficulty = settings.querySelector('select');
      if (!difficulty) return 'difficulty missing';
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(difficulty, '0');
      difficulty.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 50));
      settings.querySelector('button[type="submit"]').click();
      const start = await waitFor(() => document.querySelector('dialog.training-overlay-runtime iframe')?.contentDocument
        ?.querySelector('.training-rules .config-start-btn'));
      if (!start) return 'rules missing';
      const game = start.ownerDocument;
      start.click();
      const cells = await waitFor(() => {
        const found = [...game.querySelectorAll('[data-sliding-cell]')];
        return found.length ? found : null;
      });
      if (!cells || cells.length !== 9 || cells[6].dataset.slidingValue !== '0') return 'board missing';
      cells[0].click();
      if (cells[0].dataset.slidingValue === '0') return 'nonadjacent tile moved';
      for (const index of [7, 4, 1, 2, 5, 8]) cells[index].click();
      const score = await waitFor(() => document.querySelector('.training-overlay-score table'));
      if (!score) return 'Hub score missing';
      if (!await waitFor(() => document.querySelector('.training-score-toolbar [role="status"]')
        ?.textContent.includes('Session record saved.'))) return 'Hub save incomplete';
      return score.querySelectorAll('thead th').length === 6
        && !document.querySelector('.training-overlay-score iframe')
        && document.documentElement.scrollWidth <= innerWidth + 1;
    })()`,
    '--allSelectors', '.training-overlay-score table',
    '--timeoutMs', '5000',
  ], { ...process.env, BROWSER_EXECUTABLE_PATH: bravePath, BRAVE_BIN: bravePath });
  assert.equal(result.exitCode, 0, `Hub Sliding Puzzle: ${result.stdout}\n${result.stderr}`);
  assert.equal(uploads.length, 1, 'a Hub game saves exactly once');
  const score = uploads[0]?.record?.score;
  assert.deepEqual(Object.keys(score?.summary ?? {}), ['duration', 'moves', 'completed', 'errors', 'boardSize']);
  assert.ok(Object.values(score.summary).every(value => typeof value === 'number' && Number.isFinite(value)));
  assert.deepEqual([score.summary.moves, score.summary.completed, score.summary.errors, score.summary.boardSize],
    [6, 1, 1, 3]);
});

test('Brave completes the real reaction-time game inside Hub without canvas', async (context) => {
  assert.ok(bravePath, 'Brave is required for the Hub reaction-time check.');
  const server = createServer((request, response) => {
    if (request.url === '/api/records' && request.method === 'POST') {
      request.resume();
      response.writeHead(201, { 'Content-Type': 'application/json' }).end('{"ok":true}');
      return;
    }
    void ServeStaticOutput(request, response);
  });
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  context.after(() => new Promise(resolveClose => server.close(resolveClose)));

  const result = await Run(process.execPath, [browserSmokeScript,
    '--url', `http://127.0.0.1:${server.address().port}/`,
    '--storage', 'rehab_hub_tour_seen=1',
    '--viewportWidth', '390', '--viewportHeight', '844', '--viewportBeforeClick', 'true',
    '--startupScript', 'HTMLCanvasElement.prototype.getContext = () => null; Math.random = () => 0;',
    '--clickSelectors', '.official-game-card[data-runtime-id="reaction-time"] button,dialog.training-overlay-config button[type="submit"]',
    '--browserScenario', `(async () => {
      const iframe = document.querySelector('dialog.training-overlay-runtime iframe');
      const deadline = Date.now() + 10000;
      while (!iframe?.contentDocument?.querySelector('.training-rules .config-start-btn') && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      const game = iframe?.contentDocument;
      if (!game?.querySelector('.training-rules .config-start-btn')) return 'rules missing';
      game.querySelector('.training-rules .config-start-btn').click();
      const targetDeadline = Date.now() + 5000;
      while (!game.querySelector('[data-reaction-target]') && Date.now() < targetDeadline) {
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      const target = game.querySelector('[data-reaction-target]');
      if (!target) return 'target missing';
      target.click();
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const goDeadline = Date.now() + 6000;
        while (target.dataset.reactionState !== 'go' && Date.now() < goDeadline) {
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        if (target.dataset.reactionState !== 'go') return 'GO missing at attempt ' + attempt;
        target.click();
        await new Promise(resolve => setTimeout(resolve, 50));
        if (attempt < 9) target.click();
      }
      const scoreDeadline = Date.now() + 5000;
      while (!document.querySelector('.training-overlay-score table') && Date.now() < scoreDeadline) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      return Boolean(document.querySelector('.training-overlay-score table'))
        && !document.querySelector('.training-overlay-score iframe')
        && document.documentElement.scrollWidth <= innerWidth + 1;
    })()`,
    '--allSelectors', '.training-overlay-score table',
    '--timeoutMs', '5000',
  ], { ...process.env, BROWSER_EXECUTABLE_PATH: bravePath, BRAVE_BIN: bravePath });
  assert.equal(result.exitCode, 0, `${result.stdout}\n${result.stderr}`);
});

test('Brave shows shared score charts and uploads guest and signed-in sessions', async (context) => {
  const uploads = [];
  const guestSubjectId = '550e8400-e29b-41d4-a716-446655440000';
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname === '/api/records' && request.method === 'POST') {
      let body = '';
      request.on('data', chunk => { body += chunk; });
      request.on('end', () => {
        uploads.push({
          authorization: request.headers.authorization ?? null,
          body: JSON.parse(body),
        });
        response.writeHead(201, { 'Content-Type': 'application/json' }).end('{"ok":true}');
      });
      return;
    }
    const gameId = url.pathname.match(/^\/games\/([a-z0-9-]+)\/$/)?.[1];
    if (gameId) {
      void readFile(resolve(outputRoot, 'games', gameId, 'score.json'), 'utf8').then(source => {
        const definition = JSON.parse(source);
        const score = { schema: definition.schema, gameId,
          rounds: [0, 1, 2].map(value => Object.fromEntries(definition.columns.map(field => [field.key, value]))),
          summary: Object.fromEntries(definition.summary.map(field => [field.key, 3])),
        };
        response.writeHead(200, { 'Content-Type': 'text/html' }).end(`<script>
          let sent = false;
          addEventListener('message', event => {
            if (sent || event.source !== parent || event.data.type !== 'rehab-trainer:game-settings') return;
            sent = true;
            const message = { type: 'rehab-trainer:game-score', sessionNonce: event.data.sessionNonce, sequence: 1, score: ${JSON.stringify(score)} };
            parent.postMessage(message, location.origin);
            parent.postMessage(message, location.origin);
            parent.postMessage({ type: 'rehab-trainer:training-exit' }, location.origin);
          });
          parent.postMessage({ type: 'rehab-trainer:training-ready' }, location.origin);
        </script>`);
      }).catch(error => response.writeHead(500).end(String(error)));
      return;
    }
    void ServeStaticOutput(request, response);
  });
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  context.after(() => new Promise(resolveClose => server.close(resolveClose)));
  for (const signedIn of [false, true]) {
    const result = await Run(process.execPath, [browserSmokeScript,
      '--url', `http://127.0.0.1:${server.address().port}/`,
      '--storage', `rehab_hub_tour_seen=1,rehab-trainer-hub-language=zh,rehabtrainerhub.subject-id.v1=${guestSubjectId}`, '--mockAuthUser', String(signedIn),
      '--clickSelectors', '.official-game-card button,.game-settings-form button[type="submit"]',
      '--allSelectors', '.training-overlay-score table,.training-overlay-score [data-slot="chart"] svg,dialog.training-overlay-score:not(:has(iframe)),.training-score-priority,.training-score-quality,.training-score-stat-strip',
      ...(!signedIn ? [
        '--viewportWidth', '390', '--viewportHeight', '844',
        '--touchScrollSelector', '.training-overlay-score',
        '--visibleSelectors', '.training-score-return',
      ] : []),
      '--text', '當次紀錄已儲存', '--timeoutMs', '5000',
    ], { ...process.env, BROWSER_EXECUTABLE_PATH: bravePath, BRAVE_BIN: bravePath });
    assert.equal(result.exitCode, 0, `${result.stdout}\n${result.stderr}`);
    assert.equal(uploads.length, signedIn ? 2 : 1);
    const upload = uploads.at(-1);
    assert.match(upload.body.subjectId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.equal(upload.body.subjectId === guestSubjectId, !signedIn);
    assert.equal(Boolean(upload.authorization), signedIn);
  }
  assert.equal(uploads[0].body.runtimeId, 'hub');
  assert.equal(uploads[0].body.record.score.rounds.length, 3);
});

test('Brave Hub header actions have 44px targets at 390px', async (context) => {
  assert.ok(bravePath, 'Brave is required for local Hub UI browser checks.');
  const server = createServer((request, response) => { void ServeStaticOutput(request, response); });
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  context.after(() => new Promise((resolveClose) => server.close(resolveClose)));
  const result = await Run(process.execPath, [browserSmokeScript,
    '--url', `http://127.0.0.1:${server.address().port}/`,
    '--storage', 'rehab_hub_tour_seen=1',
    '--viewportWidth', '390', '--viewportHeight', '844', '--viewportBeforeClick', 'true',
    '--allSelectors', '.hub-guide-button,.hub-language-toggle,.account-menu-button',
    '--browserAssertion', `['.hub-guide-button','.hub-language-toggle','.account-menu-button'].every(selector => {
      const rect = document.querySelector(selector)?.getBoundingClientRect();
      return rect && rect.width >= 44 && rect.height >= 44;
    })`,
    '--timeoutMs', '5000',
  ], { ...process.env, BROWSER_EXECUTABLE_PATH: bravePath, BRAVE_BIN: bravePath });
  assert.equal(result.exitCode, 0, `${result.stdout}\n${result.stderr}`);
});

test('Brave keeps one Hub navigation usable at 320px, 390px, 768px, and 1024px', async (context) => {
  assert.ok(bravePath, 'Brave is required for local Hub UI browser checks.');
  assert.equal((await stat(resolve(outputRoot, 'index.html'))).isFile(), true);
  const server = createServer((request, response) => { void ServeStaticOutput(request, response); });
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  context.after(() => new Promise((resolveClose) => server.close(resolveClose)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const routes = ['/', '/progress/', '/qa/', '/download/'];
  const env = { ...process.env, BROWSER_EXECUTABLE_PATH: bravePath, BRAVE_BIN: bravePath };

  for (const width of [320, 390, 768, 1024]) {
    for (const route of routes) {
      const browserAssertion = `(() => {
        const navs = [...document.querySelectorAll('nav.hub-nav')];
        const nav = navs[0];
        const main = document.querySelector('main#main-content');
        if (navs.length !== 1 || !main) return false;
        const hrefs = [...nav.querySelectorAll('a[href]')].map(link => new URL(link.href).pathname);
        const current = [...nav.querySelectorAll('a[aria-current="page"]')];
        if (hrefs.join('|') !== '/|/progress/|/qa/|/download/' || current.length !== 1
          || new URL(current[0].href).pathname !== ${JSON.stringify(route)}
          || document.documentElement.scrollWidth > innerWidth + 1) return false;
        const rect = nav.getBoundingClientRect();
        if (${width} >= 768) {
          return getComputedStyle(nav).position !== 'fixed' && rect.top < 160
            && main.getBoundingClientRect().top >= nav.closest('header').getBoundingClientRect().bottom - 2;
        }
        const headerButtons = ['.hub-guide-button', '.hub-language-toggle', '.account-menu-button']
          .map(selector => document.querySelector(selector));
        if (headerButtons.some(button => !button || button.getBoundingClientRect().width < 44
          || button.getBoundingClientRect().height < 44)) return false;
        if (getComputedStyle(nav).position !== 'fixed' || Math.abs(rect.bottom - innerHeight) > 2
          || rect.height < 44 || [...nav.querySelectorAll('a')].some(link => link.getBoundingClientRect().height < 44
            || parseFloat(getComputedStyle(link).fontSize) < 14)) return false;
        document.scrollingElement.scrollTop = document.scrollingElement.scrollHeight;
        return main.lastElementChild.getBoundingClientRect().bottom <= rect.top - 8;
      })()`;
      const result = await Run(process.execPath, [browserSmokeScript,
        '--url', `${origin}${route}`,
        '--storage', 'rehab_hub_tour_seen=1',
        '--viewportWidth', String(width), '--viewportHeight', '844', '--viewportBeforeClick', 'true',
        '--allSelectors', 'nav.hub-nav,main#main-content',
        '--browserAssertion', browserAssertion,
        '--timeoutMs', '5000',
      ], env);
      assert.equal(result.exitCode, 0, `${width}px ${route}: ${result.stdout}\n${result.stderr}`);
    }
  }

  const clicked = await Run(process.execPath, [browserSmokeScript,
    '--url', `${origin}/`,
    '--storage', 'rehab_hub_tour_seen=1',
    '--viewportWidth', '390', '--viewportHeight', '844', '--viewportBeforeClick', 'true',
    '--clickSelectors', '.hub-nav a[href="/qa/"]',
    '--allSelectors', 'main#main-content.qa-page,.hub-nav a[href="/qa/"][aria-current="page"]',
    '--browserAssertion', `location.pathname.replace(/\\/$/, '') === '/qa' && getComputedStyle(document.querySelector('.hub-nav')).position === 'fixed'`,
    '--timeoutMs', '5000',
  ], env);
  assert.equal(clicked.exitCode, 0, `390px navigation click: ${clicked.stdout}\n${clicked.stderr}`);

  const training = await Run(process.execPath, [browserSmokeScript,
    '--url', `${origin}/train/`,
    '--storage', 'rehab_hub_tour_seen=1',
    '--viewportWidth', '390', '--viewportHeight', '844', '--viewportBeforeClick', 'true',
    '--allSelectors', '.hub-shell-training',
    '--browserAssertion', `!document.querySelector('.hub-nav,.hub-header,.hub-footer')`,
    '--timeoutMs', '5000',
  ], env);
  assert.equal(training.exitCode, 0, `Training route: ${training.stdout}\n${training.stderr}`);
});

async function ServeStaticOutput(request, response) {
  try {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    // Match Cloudflare Pages so a local smoke test cannot hide index redirects.
    if (url.pathname.endsWith('/index.html')) {
      response.writeHead(308, { Location: url.pathname.slice(0, -'index.html'.length) + url.search }).end();
      return;
    }
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    let filePath = resolve(outputRoot, `.${pathname}`);
    if (relative(outputRoot, filePath).startsWith('..')) {
      response.writeHead(404).end();
      return;
    }
    const metadata = await stat(filePath).catch(() => null);
    if (metadata?.isDirectory()) filePath = resolve(filePath, 'index.html');
    const body = await readFile(filePath);
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Type': ContentType(filePath),
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
}

function ContentType(filePath) {
  return ({
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.woff2': 'font/woff2',
  })[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

function Run(command, args, env) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      cwd: repositoryRoot,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('exit', (exitCode) => resolveRun({ exitCode, stderr, stdout }));
  });
}
