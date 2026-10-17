import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import ts from 'typescript';
import { GetGameSettingsDefaults } from '../packages/game-settings/src/index.js';

// Third-party games use the Hub's settings form. The Hub remembers the last submitted values on
// this device and shows them next time; the game's own settings.json still decides what is valid.
// Unmigrated official games keep their existing flow unchanged.
const root = resolve(import.meta.dirname, '..');
const helperPath = resolve(root, 'apps/rehabtrainerhub/app/train/packageSettingsMemory.ts');
const key = 'trainerhub.package-settings/v1:sample-game';
const definition = Object.freeze({ schemaVersion: 1, gameId: 'sample-game', sections: [{ id: 'main', title: { en: 'Main', 'zh-TW': '主要' }, fields: [
  { key: 'speed', type: 'slider', label: { en: 'Speed', 'zh-TW': '速度' }, default: 5, min: 1, max: 10, step: 1 },
  { key: 'mode', type: 'list', label: { en: 'Mode', 'zh-TW': '模式' }, default: 'easy', options: [
    { value: 'easy', label: { en: 'Easy', 'zh-TW': '簡單' } }, { value: 'hard', label: { en: 'Hard', 'zh-TW': '困難' } }] },
  { key: 'sound', type: 'checkbox', label: { en: 'Sound', 'zh-TW': '聲音' }, default: true },
] }] });

async function LoadHelper() {
  const source = await readFile(helperPath, 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
    .replace("'@rehab-trainer/game-settings'", JSON.stringify(pathToFileURL(resolve(root, 'packages/game-settings/src/index.js')).href));
  return import('data:text/javascript;base64,' + Buffer.from(output).toString('base64'));
}

function MemoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { values, getItem: name => values.get(name) ?? null, setItem: (name, value) => values.set(name, String(value)) };
}

test('the settings form starts from this device\'s last submitted values', async () => {
  const { ApplySavedPackageSettings, SavePackageSettings } = await LoadHelper();
  const storage = MemoryStorage();
  assert.equal(ApplySavedPackageSettings(storage, definition), definition, 'Without saved values the defaults stay.');
  SavePackageSettings(storage, 'sample-game', { speed: 8, mode: 'hard', sound: false });
  assert.deepEqual([...storage.values.keys()], [key], 'Saved per game, apart from R2 games\' keys.');
  const restored = ApplySavedPackageSettings(storage, definition);
  assert.deepEqual(GetGameSettingsDefaults(restored), { speed: 8, mode: 'hard', sound: false });
  assert.deepEqual(GetGameSettingsDefaults(definition), { speed: 5, mode: 'easy', sound: true }, 'The fetched definition is not changed.');
  const partial = ApplySavedPackageSettings(MemoryStorage({ [key]: JSON.stringify({ speed: 3 }) }), definition);
  assert.deepEqual(GetGameSettingsDefaults(partial), { speed: 3, mode: 'easy', sound: true }, 'Fields added later use their defaults.');
});

test('invalid or unreadable saved values fall back to the game\'s defaults', async () => {
  const { ApplySavedPackageSettings, SavePackageSettings } = await LoadHelper();
  for (const text of ['not json', '[1]', JSON.stringify({ speed: 99 }), JSON.stringify({ speed: 2.5 }), JSON.stringify({ mode: 'other' }),
    JSON.stringify({ sound: 'yes' }), JSON.stringify({ unknown: 1 }), JSON.stringify({ speed: 3, padding: 'x'.repeat(20000) })]) {
    assert.equal(ApplySavedPackageSettings(MemoryStorage({ [key]: text }), definition), definition, text.slice(0, 30));
  }
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('full'); } };
  assert.equal(ApplySavedPackageSettings(blocked, definition), definition);
  assert.equal(ApplySavedPackageSettings(null, definition), definition);
  assert.doesNotThrow(() => SavePackageSettings(blocked, 'sample-game', { speed: 3 }));
});

test('only the third-party overlay remembers settings; unmigrated official games are unchanged', async () => {
  const overlay = await readFile(resolve(root, 'apps/rehabtrainerhub/app/train/PackageGameOverlay.tsx'), 'utf8');
  assert.match(overlay, /ApplySavedPackageSettings\(/);
  assert.match(overlay, /SavePackageSettings\(/);
  for (const file of ['apps/rehabtrainerhub/app/train/TrainingOverlay.tsx', 'packages/ui/src/components/GameSettingsForm.tsx', 'packages/ui/src/components/OfficialGameShell.tsx']) {
    assert.doesNotMatch(await readFile(resolve(root, file), 'utf8'), /packageSettingsMemory|package-settings\/v1|localStorage/, file);
  }
});
