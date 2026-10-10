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

test('Brave presents reviewed releases and all existing games in one grid on desktop and mobile', async context => {
  assert.ok(bravePath, 'Brave is required for local Hub UI browser checks.');
  const game = { id: 'reviewed-game', slug: 'reviewed-game', title: 'Reviewed game', summary: 'A practice activity.',
    trainer: 'brain', category: 'attention', developerName: 'Sample studio', updatedAt: '2026-10-08',
    release: { id: 'reviewed-release', version: '1.0.0', contentSha256: 'a'.repeat(64), capabilities: ['keyboard'],
      approvedAt: '2026-10-08', launchUrl: 'https://trainerhub-user-games.pages.dev/games/reviewed-game/1.0.0/',
      installUrl: 'https://trainerhub-user-games.pages.dev/games/reviewed-game/1.0.0/',
      settingsUrl: 'https://trainerhub-user-games.pages.dev/games/reviewed-game/1.0.0/package/settings.json' } };
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
        && document.querySelectorAll('.module-grid .module-card').length === 41
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
    '--clickSelectors', '.official-game-card[data-runtime-id="oculomotor-training"] button',
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
    '--clickSelectors', '.official-game-card[data-runtime-id="oculomotor-training"] button,dialog.training-overlay-config button[type="submit"]',
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

  for (const gameId of ['reaction-time', 'lights-out']) {
    const rulesSelector = '.training-rules';
    const backSelectors = '.training-rules .btn-ghost';
    const standalone = await Run(process.execPath, [
      browserSmokeScript,
      '--url', `http://127.0.0.1:${address.port}/games/${gameId}/`,
      '--clickSelectors', `.game-settings-form button[type="submit"],${backSelectors},.game-settings-form button[type="submit"]`,
      '--allSelectors', `${rulesSelector},${rulesSelector} button`,
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
      '--clickSelectors', '.official-game-card[data-runtime-id="reading-training"] button,.game-settings-form button[type="submit"]',
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
