#!/usr/bin/env node
// Renders Kenney CC0 3D kits into the driving game's pixel sprite atlas.
// The game never loads 3D models: this offline step bakes fixed view angles
// into one PNG plus a JSON frame map, the way pseudo-3D racers ship sprites.
//
// Usage:
//   node scripts/driving-pixel-sprites/build.mjs --kits <dir> [--preview <file.png>]
// <dir> holds the extracted kits in these folders (sources in
// apps/rehabtrainerhub/games/driving-rehab/sprites/SOURCES.md):
//   car-kit/ city-kit-commercial/ city-kit-roads/ nature-kit/ mini-characters/
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '../..');
const outputDirectory = resolve(repoRoot, 'apps/rehabtrainerhub/games/driving-rehab/sprites');
const kitsArgument = process.argv.indexOf('--kits');
const previewArgument = process.argv.indexOf('--preview');
if (kitsArgument < 0 || !process.argv[kitsArgument + 1]) throw new Error('Pass --kits <dir> with the extracted Kenney kits.');
const kitsRoot = resolve(process.argv[kitsArgument + 1]);
for (const kit of ['car-kit', 'city-kit-commercial', 'city-kit-roads', 'nature-kit', 'mini-characters']) {
  if (!existsSync(join(kitsRoot, kit, 'License.txt'))) throw new Error(`Missing ${kit}/License.txt under ${kitsRoot}`);
}
const threeRoot = resolve(repoRoot, 'node_modules/three');
const contentTypes = { '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.png': 'image/png', '.html': 'text/html', '.json': 'application/json' };

const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const routes = [['/three/', threeRoot], ['/kits/', kitsRoot], ['/page/', import.meta.dirname]];
  if (path === '/') {
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end(`<!doctype html><meta charset="utf-8"><script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script><script type="module" src="/page/render-page.js"></script>`);
    return;
  }
  for (const [prefix, base] of routes) {
    if (!path.startsWith(prefix)) continue;
    const file = resolve(base, path.slice(prefix.length));
    if (!file.startsWith(base + sep) || !existsSync(file)) break;
    response.writeHead(200, { 'Content-Type': contentTypes[extname(file)] ?? 'application/octet-stream' });
    response.end(readFileSync(file));
    return;
  }
  response.writeHead(404);
  response.end();
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const pageUrl = `http://127.0.0.1:${server.address().port}/${process.argv.includes('--debug') ? '?debug' : ''}`;

const browserPath = process.env.BRAVE_BIN || [
  'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  'brave', 'msedge',
].find(candidate => candidate.includes('/') ? existsSync(candidate) : spawnSync(candidate, ['--version'], { stdio: 'ignore' }).status === 0);
if (!browserPath) throw new Error('Install Brave or set BRAVE_BIN.');
const profile = mkdtempSync(join(tmpdir(), 'driving-sprites-'));
const debugPort = 9300 + Math.floor(Math.random() * 400);
const browser = spawn(browserPath, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-allow-origins=*',
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });

try {
  let connection;
  for (let attempt = 0; attempt < 100 && !connection; attempt++) {
    try { connection = await (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).json(); } catch { await new Promise(done => setTimeout(done, 100)); }
  }
  if (!connection) throw new Error('Browser debugger did not start.');
  const socket = new WebSocket(connection.webSocketDebuggerUrl);
  await new Promise((done, fail) => { socket.addEventListener('open', done, { once: true }); socket.addEventListener('error', fail, { once: true }); });
  let commandId = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') console.error(message.params.exceptionDetails.exception?.description);
    if (message.method === 'Runtime.consoleAPICalled') console.log('[page]', message.params.args.map(item => item.value ?? item.description).join(' '));
    if (!message.id || !pending.has(message.id)) return;
    const { done, fail } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) fail(new Error(JSON.stringify(message.error))); else done(message.result);
  });
  const send = (method, params = {}, sessionId) => new Promise((done, fail) => {
    const id = ++commandId;
    pending.set(id, { done, fail });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Runtime.enable', {}, sessionId);
  await send('Page.enable', {}, sessionId);
  await send('Page.navigate', { url: pageUrl }, sessionId);
  const evaluation = await send('Runtime.evaluate', {
    expression: `new Promise((done, fail) => { const check = () => window.spriteBuild ? window.spriteBuild.then(done, error => fail(String(error && error.stack || error))) : setTimeout(check, 50); check(); })`,
    awaitPromise: true, returnByValue: true, timeout: 600000,
  }, sessionId);
  if (evaluation.exceptionDetails) throw new Error(evaluation.exceptionDetails.exception?.description ?? 'Sprite build failed.');
  const { atlasPng, previewPng, frames, width, height } = evaluation.result.value;
  const target = process.argv.includes('--debug') ? resolve(process.argv[previewArgument + 1] + '.debug') : join(outputDirectory, 'driving-sprites');
  writeFileSync(`${target}.png`, Buffer.from(atlasPng, 'base64'));
  writeFileSync(`${target}.json`, `${JSON.stringify({ width, height, frames }, null, 1)}\n`);
  if (previewArgument > 0 && process.argv[previewArgument + 1]) writeFileSync(resolve(process.argv[previewArgument + 1]), Buffer.from(previewPng, 'base64'));
  console.log(`Wrote ${Object.keys(frames).length} frames into a ${width}x${height} atlas.`);
  socket.close();
} finally {
  browser.kill();
  server.close();
  setTimeout(() => { try { rmSync(profile, { recursive: true, force: true }); } catch { /* Brave may still hold the profile briefly. */ } }, 500).unref();
}
