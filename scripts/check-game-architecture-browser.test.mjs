import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, relative, resolve } from 'node:path';
import test from 'node:test';

const repositoryRoot = resolve(import.meta.dirname, '..');
const outputRoot = resolve(process.env.HUB_OUTPUT_ROOT || resolve(repositoryRoot, 'apps/rehabtrainerhub/out'));
const browserSmokeScript = resolve(repositoryRoot, 'scripts/check-browser-route-smoke.mjs');
const bravePath = 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe';
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
  assert.equal(existsSync(bravePath), true, `Brave is required at ${bravePath}.`);
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
      '[role="slider"]',
      '[role="checkbox"]',
      '[role="combobox"]',
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
  for (const gameId of expFactoryGameIds) {
    const guidedGame = await Run(process.execPath, [
      browserSmokeScript,
      '--url', `http://127.0.0.1:${address.port}/games/${gameId}/`,
      '--clickSelectors', '.game-settings-form button[type="submit"]',
      '--allSelectors', '.cognitive-reference-game iframe[src="./legacy/index.html"]',
      '--iframeSelectors', '.jspsych-display-element .block-text',
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

test('Brave shows shared score charts and uploads only signed-in sessions', async (context) => {
  const uploads = [];
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname === '/api/records' && request.method === 'POST') {
      let body = '';
      request.on('data', chunk => { body += chunk; });
      request.on('end', () => {
        uploads.push(JSON.parse(body));
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
      '--storage', 'rehab_hub_tour_seen=1,rehab-trainer-hub-language=zh', '--mockAuthUser', String(signedIn),
      '--clickSelectors', '.official-game-card button,.game-settings-form button[type="submit"]',
      '--allSelectors', '.training-overlay-score table,.training-overlay-score [data-slot="chart"] svg,dialog.training-overlay-score:not(:has(iframe))',
      '--text', signedIn ? '已儲存至帳號' : '未登入，本次紀錄不會上傳', '--timeoutMs', '5000',
    ], { ...process.env, BROWSER_EXECUTABLE_PATH: bravePath, BRAVE_BIN: bravePath });
    assert.equal(result.exitCode, 0, `${result.stdout}\n${result.stderr}`);
    assert.equal(uploads.length, signedIn ? 1 : 0);
  }
  assert.equal(uploads[0].runtimeId, 'hub');
  assert.equal(uploads[0].record.score.rounds.length, 3);
});

async function ServeStaticOutput(request, response) {
  try {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
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
