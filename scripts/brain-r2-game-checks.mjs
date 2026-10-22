import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import ts from 'typescript';
import { AcceptGameMessage } from '../packages/ui/src/selfContainedGame.js';

// Shared checks for the brain activities written directly as R2 packages.
export const root = resolve(import.meta.dirname, '..');
export const GameRoot = gameId => resolve(root, 'apps/rehabtrainerhub/games', gameId);

export async function LoadGameModule(gameId, path, dependencies = {}) {
  const module = { exports: {} };
  const output = ts.transpileModule(await readFile(resolve(GameRoot(gameId), path), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', output)(name => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  }, module, module.exports);
  return module.exports;
}

// A manual clock: timers fire only when the test advances time.
export function FakeClock() {
  let now = 0, id = 0;
  const timers = new Map();
  return {
    now: () => now,
    set: (callback, ms) => { timers.set(++id, { at: now + Math.max(0, ms), callback }); return id; },
    clear: timer => timers.delete(timer),
    advance(ms) {
      const end = now + ms;
      for (;;) {
        const due = [...timers.entries()].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]); now = due[1].at; due[1].callback();
      }
      now = end;
    },
    pending: () => timers.size,
  };
}

export function AcceptsResult(gameId, config, score) {
  const state = { gameId, version: '1.0.0', sessionNonce: 'a'.repeat(64), sequence: -1, complete: false };
  const message = { schema: 'trainerhub.game/v1', gameId, version: '1.0.0', sessionNonce: state.sessionNonce, sequence: 0, type: 'result',
    payload: { config, score } };
  return AcceptGameMessage(message, state) && !AcceptGameMessage(message, state);
}

export async function CheckGamePackaging(gameId, { component, trainer = 'brain', category, version = '1.0.0' }) {
  const gameRoot = GameRoot(gameId);
  const pkg = JSON.parse(await readFile(resolve(gameRoot, 'package.json'), 'utf8'));
  assert.equal(pkg.name, `@rehab-trainer/game-${gameId}`);
  assert.equal(pkg.version, version);
  for (const name of ['react', 'react-dom', 'jspsych', 'tone']) assert.ok(pkg.dependencies[name], name);
  for (const capability of ['settings-storage', 'keyboard', 'touch', 'fullscreen']) assert.ok(pkg.rehabTrainer.capabilities.includes(capability), capability);
  for (const file of await readdir(gameRoot, { recursive: true })) {
    if (!/\.(tsx?|css)$/.test(file) || /^(dist|node_modules)[\\/]/.test(file)) continue;
    assert.doesNotMatch(await readFile(resolve(gameRoot, file), 'utf8'), /@rehab-trainer\/|localStorage|SaveTrainingRecord|react-router-dom|fetch\(/, file);
  }
  for (const name of ['settings.json', 'score.json']) await assert.rejects(access(resolve(gameRoot, name)));
  const registry = JSON.parse(await readFile(resolve(root, 'packages/ui/src/officialGameReleases.json'), 'utf8'));
  assert.equal(registry[gameId]?.origin, 'https://trainerhubgames.rainbowh9490.workers.dev');
  const hub = JSON.parse(await readFile(resolve(root, 'apps/rehabtrainerhub/package.json'), 'utf8'));
  assert.equal(hub.dependencies[pkg.name], undefined);
  const metadata = JSON.parse(await readFile(resolve(gameRoot, 'public/game.json'), 'utf8'));
  assert.deepEqual([metadata.gameId, metadata.trainer, metadata.category], [gameId, trainer, category]);
  await access(resolve(gameRoot, 'public', metadata.preview));
  for (const copy of Object.values(metadata.copy)) {
    assert.doesNotMatch(`${copy.title} ${copy.description}`, /治療|診斷|療效|改善|ADHD|過動|測驗|評估|treat|diagnos|improve|assess/i);
  }
  const source = await readFile(resolve(gameRoot, `${component}.tsx`), 'utf8');
  assert.match(source, /<ScoreAnalysis rounds=\{score\.rounds\}/);
  assert.match(source, /ValidateSettings\(settings\)/);
  assert.match(source, /SendGameResult\(/);
  const title = (await readFile(resolve(gameRoot, 'i18n/zh.ts'), 'utf8')).match(/'game\.title': '([^']+)'/)?.[1];
  assert.equal(title, metadata.copy['zh-TW'].title, 'The game title matches its catalogue copy.');
}

export async function CheckGameBridge(gameId) {
  const listeners = new Map(), sent = [], parent = {};
  const window = { parent, addEventListener: (name, listener) => listeners.set(name, listener),
    removeEventListener: name => listeners.delete(name), dispatchEvent() {} };
  const module = { exports: {} };
  const document = { referrer: 'https://trainerhub.cc/', fullscreenElement: null };
  new Function('require', 'module', 'exports', 'window', 'document', ts.transpileModule(await readFile(resolve(GameRoot(gameId), 'runtime/hubBridge.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)(name => name.endsWith('package.json') ? { version: '1.0.0' } : { DisposeAudioFeedback() {} }, module, module.exports, window, document);
  const api = module.exports;
  api.InstallHubBridge();
  const port = { start() {}, postMessage: message => sent.push(message) };
  const event = { source: parent, origin: 'https://trainerhub.cc', ports: [port], data: {
    schema: 'trainerhub.game/v1', type: 'init', gameId, version: '1.0.0', sessionNonce: 'a'.repeat(64),
    language: 'en', settings: { rounds: 2 } } };
  for (const change of [{ source: {} }, { origin: 'https://evil.example' }, { ports: [] },
    { data: { ...event.data, gameId: 'another-game' } }, { data: { ...event.data, version: '0.9.0' } }]) {
    listeners.get('message')({ ...event, ...change }); assert.equal(api.IsHubGame(), false);
  }
  listeners.get('message')(event);
  assert.equal(api.IsHubGame(), true); assert.equal(api.GetGameLanguage(), 'en');
  let restored; api.OnSavedSettings(settings => { restored = settings; });
  assert.deepEqual(restored, { rounds: 2 });
  api.SaveGameSettings(restored); await api.ExitGame();
  assert.deepEqual(sent.map(message => message.type), ['ready', 'settings', 'exit']);
}
