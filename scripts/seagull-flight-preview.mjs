import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import ts from 'typescript';
import sharp from 'sharp';

// Renders the game's actual scene before its first release has a preview or a dist directory.
const root = resolve(import.meta.dirname, '..');
const gameRoot = resolve(root, 'apps/rehabtrainerhub/games/seagull-flight');
const browserPath = process.env.BRAVE_BIN || 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe';
assert.ok(existsSync(browserPath), 'Install Brave or set BRAVE_BIN.');
const html = `<!doctype html><html><head><link rel="stylesheet" href="/game.css"></head><body>
<div id="scene" style="width:100vw;height:100vh"></div><script type="module">
import {CreateSeagullScene} from '/scene.js';
import {CreateFlightSession} from '/logic/flight.js';
import {defaultSettings,ToPlayConfig} from '/settings.js';
const scene=CreateSeagullScene(document.documentElement,document.querySelector('#scene'));
const session=CreateFlightSession(ToPlayConfig({...defaultSettings,inputMode:'keyboard'}),()=>0.7);
session.elapsed=1.6;session.altitude=0.65;
scene.update(session,0);
window.sceneReady=true;
</script></body></html>`;
const modules = { '/scene.js': 'scene.ts', '/logic/flight.js': 'logic/flight.ts', '/settings.js': 'settings.ts' };
const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url, 'http://localhost').pathname;
    let body;
    let type = 'text/javascript';
    if (path === '/') { body = html; type = 'text/html'; }
    else if (path === '/game.css') { body = await readFile(resolve(gameRoot, 'game.css')); type = 'text/css'; }
    else if (['/three.module.js', '/three.core.js'].includes(path)) body = await readFile(resolve(root, 'node_modules/three/build', path.slice(1)));
    else if (Object.hasOwn(modules, path)) {
      body = ts.transpileModule(await readFile(resolve(gameRoot, modules[path]), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      }).outputText.replace("from 'three'", "from '/three.module.js'").replace("from './logic/flight'", "from './logic/flight.js'");
    } else { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { 'content-type': type });
    response.end(body);
  } catch (error) { response.writeHead(500); response.end(String(error)); }
});
const listen = host => new Promise(done => host.listen(0, '127.0.0.1', () => done(host.address().port)));
const serverPort = await listen(server);
const probe = createServer();
const debugPort = await listen(probe);
await new Promise(done => probe.close(done));
const profile = resolve(root, '.tmp', `seagull-preview-${crypto.randomUUID()}`);
await mkdir(profile, { recursive: true });
let browser;
let socket;
try {
  browser = spawn(browserPath, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-allow-origins=*',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore', windowsHide: true });
  let launchError;
  browser.on('error', error => { launchError = error; });
  browser.on('exit', code => { launchError = new Error(`Brave exited before the screenshot (code ${code}).`); });
  let connection;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (launchError) throw launchError;
    try {
      connection = await (await fetch(`http://127.0.0.1:${debugPort}/json/version`, { signal: AbortSignal.timeout(1000) })).json();
      break;
    } catch { await new Promise(done => setTimeout(done, 100)); }
  }
  assert.ok(connection, 'Brave debugger did not start.');
  socket = new WebSocket(connection.webSocketDebuggerUrl);
  await new Promise((done, reject) => { socket.addEventListener('open', done, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  const pending = new Map();
  let sequence = 0;
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    const callback = pending.get(message.id);
    if (!callback) return;
    pending.delete(message.id);
    clearTimeout(callback.timer);
    if (message.error) callback.reject(new Error(JSON.stringify(message.error))); else callback.resolve(message.result);
  });
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Brave command timed out: ${method}`)); }, 15000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId);
  await send('Runtime.enable', {}, sessionId);
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false }, sessionId);
  await send('Page.navigate', { url: `http://127.0.0.1:${serverPort}/` }, sessionId);
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (launchError) throw launchError;
    const result = await send('Runtime.evaluate', { expression: 'window.sceneReady === true', returnByValue: true }, sessionId);
    if (result.result.value) { ready = true; break; }
    await new Promise(done => setTimeout(done, 100));
  }
  assert.ok(ready, 'The scene did not render.');
  const screenshot = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
  const png = Buffer.from(screenshot.data, 'base64');
  await writeFile(resolve(root, '.tmp/seagull-preview.png'), png);
  await sharp(png).resize(640, 360).webp({ quality: 88 }).toFile(resolve(gameRoot, 'public/preview.webp'));
  console.log('Rendered the game scene to public/preview.webp (640 x 360).');
} finally {
  socket?.close();
  browser?.kill();
  server.closeAllConnections();
  await new Promise(done => server.close(done));
}
