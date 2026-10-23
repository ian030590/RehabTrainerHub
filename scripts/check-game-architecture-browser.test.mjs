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

test('Brave smoke rejects asynchronous assertion failures', async context => {
  assert.ok(bravePath, 'Brave is required for browser assertions.');
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html' }).end('<main id="main-content">Browser assertion fixture</main>');
  });
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  context.after(() => new Promise(resolveClose => server.close(resolveClose)));
  const result = await Run(process.execPath, [browserSmokeScript,
    '--url', `http://127.0.0.1:${server.address().port}/`, '--selector', '#main-content',
    '--browserAssertion', 'Promise.reject(new Error("Rejected sheet assertion"))', '--timeoutMs', '100',
  ], { ...process.env, BROWSER_EXECUTABLE_PATH: bravePath, BRAVE_BIN: bravePath });
  assert.equal(result.exitCode, 1, 'An async assertion error must fail the smoke test.');
  assert.match(result.stderr, /Browser assertion failed: Error: Rejected sheet assertion/);
});

test('Brave mobile filters resize, dismiss, preserve values and restore modal focus and scroll', async context => {
  assert.ok(bravePath, 'Brave is required for mobile filter checks.');
  const server = createServer((request, response) => {
    if (request.url === '/api/games') {
      response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ games: [] }));
      return;
    }
    void ServeStaticOutput(request, response);
  });
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  context.after(() => new Promise(resolveClose => server.close(resolveClose)));
  for (const [width, height, reducedMotion] of [[600, 844, false], [390, 844, false], [390, 844, true], [820, 844, false], [390, 390, false]]) {
    const result = await Run(process.execPath, [browserSmokeScript,
      '--url', `http://127.0.0.1:${server.address().port}/`, '--storage', 'rehab_hub_tour_seen=1',
      '--viewportWidth', String(width), '--viewportHeight', String(height), '--viewportBeforeClick', 'true',
      '--reducedMotion', String(reducedMotion),
      '--allSelectors', '.module-grid,.filter-panel',
      '--browserAssertion', `(async () => {
        const check = (condition, message) => { if (!condition) throw new Error(message); };
        const wait = () => new Promise(resolveWait => setTimeout(resolveWait, 700));
        const panel = document.querySelector('.filter-panel');
        const trigger = document.querySelector('.filter-mobile-trigger');
        const grabber = document.querySelector('.filter-sheet-handle');
        const content = document.querySelector('.filter-category-groups');
        const input = content.querySelector('input');
        const fullCount = document.querySelectorAll('.module-card').length;
        check(innerWidth <= 720 || ${width} > 720, 'Mobile viewport does not expand horizontally');
        check(matchMedia('(prefers-reduced-motion: reduce)').matches === ${reducedMotion}, 'Motion preference is applied');
        if (innerWidth > 720) {
          check(panel.open && !panel.matches(':modal'), 'Tablet keeps the inline filter');
          input.click(); await wait();
          check(document.querySelectorAll('.module-card').length < fullCount, 'Tablet filters still work');
          check(document.documentElement.scrollWidth <= innerWidth, 'Tablet has no horizontal overflow');
          return true;
        }
        const open = async () => { trigger.focus({ preventScroll: true }); trigger.click(); await wait(); };
        const swipe = async (target, distance) => {
          const bounds = target.getBoundingClientRect();
          const x = bounds.left + bounds.width / 2;
          const y = bounds.top + Math.min(22, bounds.height / 2);
          const send = (type, offset) => {
            const touch = new Touch({ identifier: 1, target, clientX: x, clientY: y + offset });
            target.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true,
              touches: type === 'touchend' ? [] : [touch], changedTouches: [touch] }));
          };
          send('touchstart', 0);
          for (let step = 1; step <= 10; step++) {
            send('touchmove', distance * step / 10);
            await new Promise(resolveWait => setTimeout(resolveWait, 25));
          }
          await new Promise(resolveWait => setTimeout(resolveWait, 130));
          send('touchend', distance); await wait();
        };
        check(!panel.open, 'Closed mobile filters leave no focusable hidden controls');
        scrollTo({ top: 260, behavior: 'instant' }); await wait();
        const scrollBefore = scrollY;
        await open();
        check(panel.matches(':modal') && panel.contains(document.activeElement), 'Native focus trap is active');
        check(new DOMMatrix(getComputedStyle(document.querySelector('.hub-shell')).transform).a < 0.99 || matchMedia('(prefers-reduced-motion: reduce)').matches, 'Presenting page recedes behind the sheet');
        check(document.body.style.position === 'fixed', 'Lobby is locked against iOS background scrolling');
        check(panel.dataset.sheetDetent === 'medium', 'Sheet opens at medium height');
        const mediumHeight = panel.getBoundingClientRect().height;
        check(mediumHeight >= Math.min(320, innerHeight - 24) && mediumHeight < innerHeight - 12, 'Medium sheet height');
        const footer = panel.querySelector('.filter-sheet-footer').getBoundingClientRect();
        check(footer.bottom <= innerHeight && footer.top > 0, 'Action footer remains in the viewport');
        input.click(); await wait();
        check(input.checked && document.querySelectorAll('.module-card').length < fullCount, 'Live category filtering');
        await swipe(input, -330);
        const largeHeight = panel.getBoundingClientRect().height;
        check(panel.dataset.sheetDetent === 'large' && largeHeight > mediumHeight + 20, 'Upward drag expands');
        check(input.checked, 'Dragging a checkbox does not toggle its selection');
        content.scrollTop = 100;
        await swipe(content, 40);
        check(panel.dataset.sheetDetent === 'large', 'Scrolling content does not dismiss the sheet');
        content.scrollTop = 0;
        await swipe(content, largeHeight - mediumHeight);
        check(panel.dataset.sheetDetent === 'medium', 'Downward drag at content top collapses');
        await swipe(grabber, 20);
        check(panel.open && panel.dataset.sheetDetent === 'medium', 'Short drag springs back');
        await swipe(grabber, 240);
        check(!panel.open && document.body.style.position === '', 'Downward drag dismisses and unlocks');
        check(new DOMMatrix(getComputedStyle(document.querySelector('.hub-shell')).transform).a === 1, 'Presenting page returns to full size');
        check(document.activeElement === trigger && Math.abs(scrollY - scrollBefore) < 2, 'Focus and lobby scroll restored: ' + JSON.stringify({ focus: document.activeElement.className, actual: scrollY, expected: scrollBefore }));
        await open();
        check(input.checked, 'Selections survive dismissal');
        grabber.click(); await wait();
        check(panel.dataset.sheetDetent === 'large', 'Grabber supports keyboard and assistive technology');
        panel.dispatchEvent(new Event('cancel', { cancelable: true })); await wait();
        check(!panel.open, 'Escape dismisses');
        await open();
        panel.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 5, clientY: 5 })); await wait();
        check(!panel.open, 'Backdrop dismisses');
        await open();
        panel.querySelector('.filter-header-actions button:not(.filter-sheet-close)').click(); await wait();
        check(!input.checked && document.querySelectorAll('.module-card').length === fullCount, 'Clear preserves all games');
        panel.querySelector('.filter-sheet-apply-btn').click();
        await new Promise(resolveWait => setTimeout(resolveWait, 50));
        grabber.click(); await wait();
        check(!panel.open && document.activeElement === trigger, 'View results closes and restores focus');
        check(document.documentElement.scrollWidth <= innerWidth, 'Mobile has no horizontal overflow');
        return true;
      })()`,
      '--timeoutMs', '5000',
    ], { ...process.env, BROWSER_EXECUTABLE_PATH: bravePath, BRAVE_BIN: bravePath });
    assert.equal(result.exitCode, 0, `${width}x${height}, reduced motion ${reducedMotion}: ${result.stdout}\n${result.stderr}`);
  }
  const touch = await Run(process.execPath, [browserSmokeScript,
    '--url', `http://127.0.0.1:${server.address().port}/`, '--storage', 'rehab_hub_tour_seen=1',
    '--viewportWidth', '390', '--viewportHeight', '700', '--viewportBeforeClick', 'true',
    '--allSelectors', '.filter-panel', '--clickSelectors', '.filter-mobile-trigger,.filter-sheet-handle',
    '--touchScrollSelector', '.filter-category-groups',
    '--browserAssertion', `document.querySelector('.filter-panel').matches(':modal')
      && document.querySelector('.filter-panel').dataset.sheetDetent === 'large'
      && document.querySelector('.filter-category-groups').scrollTop > 0`,
    '--timeoutMs', '5000',
  ], { ...process.env, BROWSER_EXECUTABLE_PATH: bravePath, BRAVE_BIN: bravePath });
  assert.equal(touch.exitCode, 0, `Native mouse grabber and touch scroll: ${touch.stdout}\n${touch.stderr}`);
});

test('Brave presents reviewed releases and all existing games in one grid on desktop and mobile', async context => {
  assert.ok(bravePath, 'Brave is required for local Hub UI browser checks.');
  const game = { id: 'reviewed-game', slug: 'reviewed-game', title: 'Reviewed game', summary: 'A practice activity.',
    trainer: 'brain', category: 'attention', developerName: 'Sample studio', updatedAt: '2026-10-08',
    release: { id: 'reviewed-release', version: '1.0.0', contentSha256: 'a'.repeat(64), capabilities: ['keyboard'],
      approvedAt: '2026-10-08', launchUrl: 'https://trainerhubgames.rainbowh9490.workers.dev/games/reviewed-game/1.0.0/',
      installUrl: 'https://trainerhubgames.rainbowh9490.workers.dev/games/reviewed-game/1.0.0/',
      settingsUrl: 'https://trainerhubgames.rainbowh9490.workers.dev/games/reviewed-game/1.0.0/package/settings.json' } };
  const server = createServer((request, response) => {
    if (request.url === '/api/games') {
      response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ games: [game,
        { ...game, id: 'legacy-slug-collision', slug: 'moving-card', title: 'Collision sample' },
        { ...game, id: 'migrated-slug-collision', slug: 'drawing-defense', title: 'Obsolete settings shell', category: 'higher-cognition' },
      ] }));
      return;
    }
    void ServeStaticOutput(request, response);
  });
  await new Promise((resolveListen, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolveListen); });
  context.after(() => new Promise(resolveClose => server.close(resolveClose)));
  for (const width of [1024, 390]) {
    const result = await Run(process.execPath, [browserSmokeScript,
      '--url', `http://127.0.0.1:${server.address().port}/`, '--storage', 'rehab_hub_tour_seen=1',
      '--viewportWidth', String(width), '--viewportHeight', '844', '--viewportBeforeClick', 'true',
      '--allSelectors', '.module-grid,.module-card[data-runtime-id="reviewed-game"]',
      '--browserAssertion', `(() => {
        const drawing = document.querySelector('.module-card[data-runtime-id="drawing-defense"]');
        drawing?.scrollIntoView();
        const preview = drawing?.querySelector('img');
        return document.querySelectorAll('.module-grid').length === 1
        && document.querySelectorAll('.module-grid .module-card').length === 51
        && !!document.querySelector('.module-card[data-runtime-id="asteroid-shield"]')
        && !document.querySelector('.module-card[data-runtime-id="moving-card"]').textContent.includes('Collision sample')
        && !document.querySelector('.module-card[data-runtime-id="drawing-defense"]').textContent.includes('Obsolete settings shell')
        && drawing.querySelector('.module-subcategory-tag').textContent === '上肢動作'
        && preview?.complete && preview.naturalWidth > 0
        && new URL(preview.src).pathname === '/assets/game-previews/drawing-defense/preview.webp'
        && document.documentElement.scrollWidth <= innerWidth + 1;
      })()`,
      '--timeoutMs', '5000',
    ], { ...process.env, BROWSER_EXECUTABLE_PATH: bravePath, BRAVE_BIN: bravePath });
    assert.equal(result.exitCode, 0, `${width}px: ${result.stdout}\n${result.stderr}`);
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
