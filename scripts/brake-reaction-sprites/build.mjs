import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { setTimeout as Delay } from 'node:timers/promises';
import { parseArgs } from 'node:util';

const { values: options } = parseArgs({ options: { kits: { type: 'string' }, preview: { type: 'string' } } });
if (!options.kits) throw new Error('Pass --kits <dir> containing the extracted Kenney Car Kit.');

const carKit = resolve(options.kits, 'car-kit');
const license = join(carKit, 'License.txt');
if (!existsSync(license)) throw new Error(`Missing ${license}`);

const repoRoot = resolve(import.meta.dirname, '../..');
const outputDirectory = join(repoRoot, 'apps/rehabtrainerhub/games/brake-reaction/sprites');
const previewPath = options.preview && resolve(options.preview);
if (previewPath && (extname(previewPath).toLowerCase() !== '.png' || previewPath.toLowerCase() === join(outputDirectory, 'cars.png').toLowerCase())) {
  throw new Error('Pass a separate .png path for --preview.');
}
const threeRoot = join(repoRoot, 'node_modules/three');
if (!existsSync(join(threeRoot, 'build/three.module.js'))) throw new Error('Install the repository dependencies to load Three.js.');

const brave = process.env.BRAVE_BIN || [
  'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  'brave-browser',
  'brave',
].find(candidate => candidate.includes('/') ? existsSync(candidate) : spawnSync(candidate, ['--version'], { stdio: 'ignore' }).status === 0);
if (!brave) throw new Error('Install Brave or set BRAVE_BIN to its executable.');

const routes = [
  ['/three/', threeRoot],
  ['/models/', join(carKit, 'Models/GLB format')],
];
const contentTypes = { '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.png': 'image/png' };
const server = createServer(async (request, response) => {
  try {
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (path === '/') {
      response.writeHead(200, { 'Content-Type': 'text/html' });
      response.end(`<!doctype html><meta charset="utf-8"><script type="importmap">
        {"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}
      </script><script>window.spritePage = import('/render-page.js');</script>`);
      return;
    }

    let file;
    if (path === '/render-page.js') file = join(import.meta.dirname, 'render-page.js');
    for (const [prefix, root] of routes) {
      if (!path.startsWith(prefix)) continue;
      const candidate = resolve(root, path.slice(prefix.length));
      if (candidate.startsWith(root + sep)) file = candidate;
      break;
    }
    const contentType = file && contentTypes[extname(file)];
    if (!contentType) throw new Error('Unknown resource');
    const bytes = await readFile(file);
    response.writeHead(200, { 'Content-Type': contentType });
    response.end(bytes);
  } catch {
    response.writeHead(404);
    response.end();
  }
});

const profilePrefix = resolve(tmpdir(), 'brake-sprites-');
const profile = await mkdtemp(profilePrefix);
let browser;
try {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  const pageUrl = `${origin}/`;
  browser = spawn(brave, [
    '--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--remote-debugging-port=0', `--remote-allow-origins=${origin}`, `--user-data-dir=${profile}`, pageUrl,
  ], { stdio: ['ignore', 'ignore', 'inherit'], windowsHide: true });
  const debuggerUrl = await WaitForPageDebugger(browser, profile, pageUrl);
  const result = await BakeInBrowser(debuggerUrl, origin, Boolean(previewPath));

  const { width, height, frames, atlas, extension, preview, pngBytes, webpBytes } = result;
  const atlasBytes = Buffer.from(atlas, 'base64');
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(join(outputDirectory, `cars.${extension}`), atlasBytes);
  await writeFile(join(outputDirectory, 'cars.json'), `${JSON.stringify({ width, height, frames }, null, 2)}\n`);
  await rm(join(outputDirectory, extension === 'webp' ? 'cars.png' : 'cars.webp'), { force: true });
  if (previewPath) await writeFile(previewPath, Buffer.from(preview, 'base64'));
  console.log(`Wrote ${Object.keys(frames).length} frames into cars.${extension} (${width}x${height}, ${atlasBytes.length} bytes).`);
  if (webpBytes !== null) console.log(`PNG ${pngBytes} bytes, WebP ${webpBytes} bytes at quality 0.9.`);
} finally {
  browser?.kill();
  server.close();
  if (resolve(profile).startsWith(profilePrefix)) {
    await rm(profile, { recursive: true, force: true, maxRetries: 5 }).catch(error => {
      console.warn(`Could not remove the temporary Brave profile: ${error.message}`);
    });
  }
}

async function WaitForPageDebugger(browser, profile, pageUrl) {
  let launchError;
  browser.once('error', error => { launchError = error; });
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (launchError) throw launchError;
    if (browser.exitCode !== null) throw new Error(`Brave exited before opening its debugger (${browser.exitCode}).`);
    try {
      const [port] = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n');
      const response = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(1000) });
      const pages = await response.json();
      const page = pages.find(target => target.type === 'page' && target.url === pageUrl);
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      // Brave can publish the debugger port before it accepts requests.
    }
    await Delay(100);
  }
  throw new Error('Timed out waiting for the headless Brave page debugger.');
}

async function BakeInBrowser(debuggerUrl, origin, includePreview) {
  const socket = new WebSocket(debuggerUrl, { headers: { origin } });
  let timer;
  try {
    return await new Promise((done, fail) => {
      timer = setTimeout(() => fail(new Error('Timed out baking car sprites in Brave.')), 60000);
      socket.addEventListener('error', () => fail(new Error('Could not connect to the Brave debugger.')), { once: true });
      socket.addEventListener('close', () => fail(new Error('Brave closed the debugger before returning the atlas.')), { once: true });
      socket.addEventListener('open', () => socket.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: {
          expression: `(async () => {
            while (!window.spritePage) await new Promise(resolve => setTimeout(resolve, 50));
            const { BakeCars } = await window.spritePage;
            return BakeCars(${includePreview});
          })()`,
          awaitPromise: true,
          returnByValue: true,
        },
      })), { once: true });
      socket.addEventListener('message', event => {
        const message = JSON.parse(event.data);
        if (message.id !== 1) return;
        if (message.error) fail(new Error(message.error.message));
        else if (message.result.exceptionDetails) {
          const { exception, text } = message.result.exceptionDetails;
          fail(new Error(exception?.description ?? text));
        } else done(message.result.result.value);
      });
    });
  } finally {
    clearTimeout(timer);
    socket.close();
  }
}
