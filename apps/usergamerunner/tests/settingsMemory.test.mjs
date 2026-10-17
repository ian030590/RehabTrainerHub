import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { HandleRequest } from '../functions/[[path]].js';
import { ValidateRelease } from '../functions/_lib/release.js';

// Standalone official games keep each game's last settings in the runner origin's localStorage.
// The game itself stays in an opaque sandbox and only receives them on its private channel.
const bytes = Buffer.from('<!doctype html><title>Reading</title>');
const files = [{ path: 'index.html', size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }];
const release = (overrides = {}) => ({ schemaVersion: 1, status: 'approved', gameId: 'reading-training', version: '2.0.1',
  name: 'Reading', entry: 'index.html', runtime: { name: 'native', major: 1 }, presentation: 'game',
  capabilities: ['audio', 'fullscreen', 'keyboard', 'pointer', 'touch', 'settings-storage'], files,
  contentSha256: createHash('sha256').update(JSON.stringify(files)).digest('hex'), ...overrides });

test('settings storage is an official-game capability only', () => {
  assert.doesNotThrow(() => ValidateRelease(release(), 'reading-training', '2.0.1'));
  const thirdParty = release({ presentation: undefined, runtime: { name: 'native', major: 1 } });
  delete thirdParty.presentation;
  assert.throws(() => ValidateRelease(thirdParty, 'reading-training', '2.0.1'));
});

test('official games with settings storage open in the official launcher without camera access', async () => {
  let official = true;
  const manifest = release();
  const catalog = { schemaVersion: 1, gameId: manifest.gameId, currentVersion: manifest.version,
    releases: { [manifest.version]: { contentSha256: manifest.contentSha256 } } };
  const bucket = { get: async key => {
    const source = key.startsWith('official-games/') ? (official ? JSON.stringify(catalog) : null)
      : key.endsWith('/release.json') ? JSON.stringify(manifest) : null;
    return source ? { size: Buffer.byteLength(source), text: async () => source } : null;
  } };
  const Read = path => HandleRequest({ request: new Request('https://runner.example/games/reading-training/2.0.1/' + path),
    env: { GAME_RELEASE_BUCKET: bucket } });
  const launcher = await Read('?lang=en');
  assert.equal(launcher.status, 200);
  assert.match(launcher.headers.get('permissions-policy'), /camera=\(\)/);
  assert.doesNotMatch(launcher.headers.get('content-security-policy'), /wasm-unsafe-eval|'self' 'wasm/);
  const html = await launcher.text();
  assert.match(html, /mode:'standalone'/);
  assert.match(html, /sandbox="allow-scripts"/);
  assert.doesNotMatch(html, /allow-same-origin|\/input\/(hand|eye)-tracking/);
  official = false;
  assert.equal((await Read('')).status, 404, 'Only the approved official release opens this launcher.');
});

test('production-bundled launcher hands saved settings to the game and keeps confirmed settings', async () => {
  const output = await build({ entryPoints: [resolve(import.meta.dirname, '../functions/_lib/handTrackingLauncher.js')],
    bundle: true, keepNames: true, format: 'esm', platform: 'neutral', write: false });
  const { RenderHandTrackingLauncher } = await import('data:text/javascript;base64,' + Buffer.from(output.outputFiles[0].text).toString('base64'));
  const html = RenderHandTrackingLauncher(release(), '/games/reading-training/2.0.1/', 'test-nonce');
  const inline = html.match(/<script nonce="test-nonce">([\s\S]*?)<\/script>/)[1];
  const key = 'trainerhub.game-settings/v1:reading-training';
  const stored = new Map([[key, JSON.stringify({ passage: 2, contrast: 60 })]]);
  const localStorage = { getItem: name => stored.get(name) ?? null, setItem: (name, value) => stored.set(name, value) };
  const events = new Map();
  const posted = [];
  const frame = { addEventListener: (type, listener) => events.set(type, listener),
    contentWindow: { postMessage: (message, _origin, ports) => posted.push({ message, port: ports[0] }) } };
  const elements = new Map([['game-frame', frame], ['camera-consent', {}], ['camera-enable', {}], ['camera-cancel', {}], ['install-button', {}], ['runner-error', {}]]);
  let ready;
  // Messages are rebuilt inside the launcher's realm, as a browser's structured clone would do.
  const channel = `class MessageChannel { constructor() {
    const pair = [{}, {}];
    pair.forEach((port, index) => Object.assign(port, { start() {}, close() {},
      postMessage: data => pair[1 - index].onmessage?.({ data: JSON.parse(JSON.stringify(data)) }) }));
    [this.port1, this.port2] = pair;
  } }
`;
  runInNewContext(channel + inline, {
    document: { addEventListener: (_type, listener) => { ready = listener; }, getElementById: id => elements.get(id), activeElement: null },
    crypto, Uint8Array, URLSearchParams, Blob, TextEncoder, location: { search: '' },
    navigator: {}, window: { addEventListener() {}, localStorage, top: null }, setInterval: () => 0, clearInterval() {},
  });
  ready();
  events.get('load')();
  assert.equal(posted.length, 1);
  const { message, port } = posted[0];
  assert.equal(message.mode, 'standalone');
  assert.deepEqual(JSON.parse(JSON.stringify(message.settings)), { passage: 2, contrast: 60 });
  const replies = [];
  port.onmessage = ({ data }) => replies.push(data);
  const send = (sequence, type, payload) => port.postMessage({ schema: 'trainerhub.game/v1', gameId: 'reading-training',
    version: '2.0.1', sessionNonce: message.sessionNonce, sequence, type, payload });
  send(0, 'ready', {});
  send(1, 'settings', { passage: 3, wordsPerMinute: 300, crowding: 200, contrast: 80 });
  send(2, 'settings', { authToken: 'secret' });
  send(3, 'exit', {});
  assert.deepEqual(JSON.parse(stored.get(key)), { passage: 3, wordsPerMinute: 300, crowding: 200, contrast: 80 });
  assert.equal(replies.at(-1)?.type, 'configure', 'Standalone exit returns to the game settings.');
});
