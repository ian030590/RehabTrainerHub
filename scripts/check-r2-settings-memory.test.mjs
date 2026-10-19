import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';

// Each R2 game's last confirmed settings stay on this device. The sandboxed game has an opaque
// origin and cannot use localStorage, so its container (Hub or standalone launcher) keeps them
// and hands them back on the private channel; the game validates them and falls back to defaults.
const root = resolve(import.meta.dirname, '..');
const gamesRoot = resolve(root, 'apps/rehabtrainerhub/games');
const games = {
  'hart-chart': { version: '2.0.2', file: 'HartChartPage.tsx', settings: 'settings.ts' },
  'driving-rehab': { version: '2.0.3', file: 'DrivingRehabGame.tsx', settings: 'settings.ts' },
  'reading-training': { version: '2.0.2', file: 'ReadingTrainingGame.tsx', settings: 'settings.ts' },
  'gabor-patching': { version: '2.0.3', file: 'GaborPatchingGame.tsx', settings: 'settings.ts' },
  'asteroid-shield': { version: '2.0.11', file: 'AsteroidShieldGame.tsx', settings: 'settings.ts' },
  'gesture-battler': { version: '2.0.6', file: 'GestureBattlerGame.tsx', settings: 'config.ts' },
  'motor-cortex-rehab': { version: '2.0.4', file: 'MotorCortexRehabGame.tsx', settings: 'config.ts' },
  'drawing-defense': { version: '2.0.8', file: 'DrawingTowerDefenseGame.tsx', settings: 'settings.ts' },
  'moving-card': { version: '2.0.4', file: 'MovingCardGame.tsx', settings: 'settings.ts' },
  'oculomotor-training': { version: '2.1.3', file: 'OculomotorTrainingGame.tsx', settings: 'settings.ts' },
};
const nonce = 'a'.repeat(64);

function MemoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) };
}

function Message(type, payload, sequence = 0) {
  return { schema: 'trainerhub.game/v1', gameId: 'reading-training', version: '2.0.1', sessionNonce: nonce, sequence, type, payload };
}

test('settings messages are accepted only for games that declare settings storage, with bounded primitive values', async () => {
  const { AcceptGameMessage, IsGameSettings } = await import('../packages/ui/src/selfContainedGame.js');
  const state = () => ({ gameId: 'reading-training', version: '2.0.1', sessionNonce: nonce, sequence: -1, complete: false, capabilities: ['settings-storage'] });
  const settings = { passage: 2, wordsPerMinute: 300, crowding: 200, contrast: 80 };
  assert.equal(IsGameSettings(settings), true);
  assert.equal(AcceptGameMessage(Message('settings', settings), state()), true);
  assert.equal(AcceptGameMessage(Message('settings', settings), { ...state(), capabilities: [] }), false, 'Old games never get a settings slot.');
  for (const invalid of [{}, { nested: { value: 1 } }, { list: [1] }, { userName: 'x' }, { authToken: 'x' },
    { note: 'x'.repeat(81) }, { value: Infinity }, Object.fromEntries(Array.from({ length: 65 }, (_, index) => [`key${index}`, index]))]) {
    assert.equal(AcceptGameMessage(Message('settings', invalid), state()), false, JSON.stringify(invalid).slice(0, 40));
  }
  const finished = state();
  finished.complete = true;
  assert.equal(AcceptGameMessage(Message('settings', settings), finished), true, 'Choosing new settings after a result is still remembered.');
  const ordered = state();
  assert.equal(AcceptGameMessage(Message('settings', settings, 3), ordered), true);
  assert.equal(AcceptGameMessage(Message('settings', settings, 3), ordered), false, 'Replay is rejected.');
});

test('saved settings are read and written per game, and unreadable storage falls back to nothing', async () => {
  const { ReadSavedGameSettings, WriteSavedGameSettings } = await import('../packages/ui/src/selfContainedGame.js');
  const storage = MemoryStorage();
  WriteSavedGameSettings(storage, 'reading-training', { passage: 1, contrast: 60 });
  assert.deepEqual([...storage.values.keys()], ['trainerhub.game-settings/v1:reading-training']);
  assert.deepEqual(ReadSavedGameSettings(storage, 'reading-training'), { passage: 1, contrast: 60 });
  assert.equal(ReadSavedGameSettings(storage, 'gabor-patching'), null, 'Games do not share settings.');
  WriteSavedGameSettings(storage, 'reading-training', { authToken: 'secret' });
  assert.deepEqual(ReadSavedGameSettings(storage, 'reading-training'), { passage: 1, contrast: 60 }, 'Unsafe settings are not stored.');
  for (const text of ['not json', '[1]', '{"userName":"x"}', JSON.stringify({ value: 'x'.repeat(20000) })]) {
    assert.equal(ReadSavedGameSettings(MemoryStorage({ 'trainerhub.game-settings/v1:reading-training': text }), 'reading-training'), null, text.slice(0, 20));
  }
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('full'); } };
  assert.equal(ReadSavedGameSettings(broken, 'reading-training'), null);
  assert.doesNotThrow(() => WriteSavedGameSettings(broken, 'reading-training', { passage: 1 }));
  assert.equal(ReadSavedGameSettings(null, 'reading-training'), null);
});

test('Hub hands saved settings to games that declare storage and keeps what the game confirms', async () => {
  const source = await readFile(resolve(root, 'apps/rehabtrainerhub/app/train/R2GameOverlay.tsx'), 'utf8');
  assert.match(source, /ReadSavedGameSettings\(/);
  assert.match(source, /message\.type === 'settings'\) WriteSavedGameSettings\(/);
  assert.match(source, /capabilities\.includes\('settings-storage'\)/);
  assert.match(source, /window\.localStorage/);
  assert.match(source, /sandbox="allow-scripts"/, 'The game stays in an opaque sandbox.');
  assert.doesNotMatch(source, /allow-same-origin/);
});

for (const [gameId, game] of Object.entries(games)) {
  test(`${gameId}: restores the device's last settings and reports confirmed settings to its container`, async () => {
    const directory = resolve(gamesRoot, gameId);
    const manifest = JSON.parse(await readFile(resolve(directory, 'package.json'), 'utf8'));
    assert.equal(manifest.version, game.version);
    assert.ok(manifest.rehabTrainer?.capabilities?.includes('settings-storage'), 'The release declares settings storage.');
    const bridge = await readFile(resolve(directory, 'runtime/hubBridge.ts'), 'utf8');
    assert.match(bridge, /export function OnSavedSettings\(/);
    assert.match(bridge, /export function SaveGameSettings\(/);
    assert.match(bridge, /SendGameEvent\('settings'/);
    assert.match(bridge, /\.mode === 'standalone'/, 'Standalone play keeps local results and its own configure flow.');
    const component = await readFile(resolve(directory, game.file), 'utf8');
    assert.match(component, /OnSavedSettings\(/);
    assert.match(component, /SaveGameSettings\(/);
    const memory = await readFile(resolve(directory, 'runtime/settingsMemory.ts'), 'utf8');
    assert.doesNotMatch(memory, /localStorage/, 'The opaque game never touches storage itself.');
  });

  test(`${gameId}: saved settings are validated by the game and unknown or invalid values fall back to defaults`, async () => {
    const directory = resolve(gamesRoot, gameId);
    const { RestoreSettings } = await LoadModule(resolve(directory, 'runtime/settingsMemory.ts'));
    const settingsModule = await LoadModule(resolve(directory, game.settings));
    const defaults = settingsModule.defaultSettings ?? settingsModule.defaultConfig ?? settingsModule.defaultGestureConfig;
    const validate = settingsModule.ValidateSettings ?? settingsModule.IsMotorConfig ?? settingsModule.IsGestureConfig;
    assert.ok(defaults && validate, 'The game exposes its defaults and validation.');
    const { IsGameSettings } = await import('../packages/ui/src/selfContainedGame.js');
    assert.equal(IsGameSettings(defaults), true, 'The full settings fit what the container may store.');
    assert.equal(RestoreSettings({ ...defaults, extra: 1 }, defaults, validate).extra, undefined, 'Unknown keys are dropped.');
    const [key] = Object.keys(defaults).filter(item => typeof defaults[item] === 'number' || (gameId === 'driving-rehab' && item === 'difficulty'));
    assert.equal(RestoreSettings({ [key]: gameId === 'driving-rehab' ? 'invalid' : -999999 }, defaults, validate), null, 'Out-of-range values are rejected.');
    assert.equal(RestoreSettings({ [key]: gameId === 'driving-rehab' ? 123 : 'text' }, defaults, validate)?.[key], defaults[key], 'Wrong types keep the default.');
    assert.deepEqual(RestoreSettings({}, defaults, validate), defaults, 'Missing values use the defaults.');
  });
}

async function LoadModule(file) {
  const source = await readFile(file, 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', 'require', output)(module, module.exports, () => ({}));
  return module.exports;
}
