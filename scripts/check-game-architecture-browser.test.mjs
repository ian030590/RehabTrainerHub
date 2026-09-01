import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, relative, resolve } from 'node:path';
import test from 'node:test';

const repositoryRoot = resolve(import.meta.dirname, '..');
const outputRoot = resolve(repositoryRoot, 'apps/rehabtrainerhub/out');
const browserSmokeScript = resolve(repositoryRoot, 'scripts/check-browser-route-smoke.mjs');
const bravePath = 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe';

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
