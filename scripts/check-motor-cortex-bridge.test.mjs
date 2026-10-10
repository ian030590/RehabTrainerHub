import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');
const gameRoot = resolve(root, 'apps/rehabtrainerhub/games/motor-cortex-rehab');

test('input frames require private nonce, increasing sequence and bounded xyz coordinates', async () => {
  const { AcceptHandInput } = await LoadModule('runtime/handInput.ts');
  const state = { sessionNonce: 'a'.repeat(64), sequence: -1 };
  const message = { schema: 'trainerhub.input/v1', sessionNonce: state.sessionNonce, sequence: 0, type: 'frame',
    payload: { timestamp: 100, landmarks: Array.from({ length: 21 }, () => ({ x: 0.1, y: 0.2, z: -0.3 })) } };
  assert.equal(AcceptHandInput(message, { ...state }), true);
  for (const change of [{ sessionNonce: 'b'.repeat(64) }, { sequence: -1 }, { schema: 'unknown' },
    { payload: { ...message.payload, image: 'private' } },
    { payload: { ...message.payload, landmarks: [{ x: NaN, y: 0, z: 0 }] } },
    { payload: { ...message.payload, landmarks: Array.from({ length: 21 }, () => ({ x: 100, y: 0, z: 0 })) } }]) {
    assert.equal(AcceptHandInput({ ...message, ...change }, { ...state }), false);
  }
  assert.equal(AcceptHandInput(message, state), true);
  assert.equal(AcceptHandInput(message, state), false);
  assert.equal(AcceptHandInput({ ...message, sequence: 1, payload: { timestamp: 200, landmarks: [] } }, state), true);
});

test('motor tracking bridge accepts one parent port, rejects forged input and cancels unfinished startup', async () => {
  const { AcceptHandInput } = await LoadModule('runtime/handInput.ts');
  const listeners = new Map();
  const events = [];
  const sent = [];
  const parent = {};
  const window = { parent, setTimeout, clearTimeout,
    addEventListener: (type, listener) => listeners.set(type, listener),
    removeEventListener: type => listeners.delete(type),
    dispatchEvent: event => { events.push(event); listeners.get(event.type)?.(event); },
  };
  const module = { exports: {} };
  const source = ts.transpileModule(await readFile(resolve(gameRoot, 'runtime/hubBridge.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('module', 'exports', 'require', 'window', 'document', source)(module, module.exports,
    path => path.endsWith('package.json') ? { version: '2.0.0' } : { AcceptHandInput }, window,
    { referrer: 'https://trainerhub.cc/' });
  const bridge = module.exports;
  bridge.InstallHubBridge();
  const init = listeners.get('message');
  const port = { postMessage: message => sent.push(message), start() {} };
  const message = { schema: 'trainerhub.game/v1', type: 'init', gameId: 'motor-cortex-rehab',
    version: '2.0.0', sessionNonce: 'a'.repeat(64), language: 'en' };
  init({ data: message, source: {}, origin: 'https://trainerhub.cc', ports: [port] });
  init({ data: message, source: parent, origin: 'https://evil.example', ports: [port] });
  assert.deepEqual(sent, []);
  init({ data: message, source: parent, origin: 'https://trainerhub.cc', ports: [port] });
  assert.equal(bridge.GetGameLanguage(), 'en');
  assert.equal(bridge.IsHubGame(), true);
  assert.equal(sent[0].type, 'ready');
  assert.equal(listeners.has('message'), false);
  const frame = { schema: 'trainerhub.input/v1', sessionNonce: message.sessionNonce,
    sequence: 0, type: 'frame', payload: { timestamp: 100, landmarks: [] } };
  port.onmessage({ data: { ...frame, sessionNonce: 'b'.repeat(64) } });
  port.onmessage({ data: frame });
  port.onmessage({ data: frame });
  assert.equal(events.filter(event => event.type === 'game:input').length, 1);
  const pending = bridge.StartHandInput();
  bridge.StopHandInput();
  await assert.rejects(pending, /cancelled/);
  assert.equal(listeners.has('game:input'), false);
  assert.deepEqual(sent.slice(-2).map(message => message.type), ['input-start', 'input-stop']);
});

async function LoadModule(path) {
  const source = await readFile(resolve(gameRoot, path), 'utf8');
  const module = { exports: {} };
  new Function('module', 'exports', ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)(module, module.exports);
  return module.exports;
}
