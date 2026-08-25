import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const catalogPath = 'apps/rehabtrainerhub/training-modules/catalog.ts';
const lobbyPath = 'apps/rehabtrainerhub/app/TrainingLobby.tsx';
const lobbyCssPath = 'apps/rehabtrainerhub/app/globals.css';
const themeStylePath = 'apps/rehabtrainerhub/app/trainingThemeStyle.ts';

function TranspileStandaloneModule(source) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

async function ImportCatalogThemeContract() {
  const source = await readFile(catalogPath, 'utf8');
  const registryStart = source.indexOf('export type ThemeIconType');
  const registryEndMarker = 'export const trainingPurposes = Object.values(trainingThemes);';
  const registryEnd = source.indexOf(registryEndMarker, registryStart) + registryEndMarker.length;
  const resolverStart = source.indexOf('export type TrainingThemeLookup');
  const resolverEnd = source.indexOf('export function GetTrainingPurpose', resolverStart);
  assert.ok(registryStart >= 0 && registryEnd > registryStart && resolverStart >= 0 && resolverEnd > resolverStart);
  return TranspileStandaloneModule([
    source.slice(registryStart, registryEnd),
    source.slice(resolverStart, resolverEnd),
  ].join('\n'));
}

test('theme resolver handles IDs, aliases, and absent metadata', async () => {
  const {
    defaultTrainingTheme,
    GetTrainingModuleTheme,
    GetTrainingThemeId,
    trainingPurposes,
    trainingThemes,
  } = await ImportCatalogThemeContract();

  assert.equal(GetTrainingThemeId('upper-limb'), 'upper-limb');
  assert.equal(GetTrainingThemeId('movement'), 'upper-limb');
  assert.equal(GetTrainingThemeId('general'), 'higher-cognition');
  assert.equal(GetTrainingThemeId({ purpose: 'vision' }), 'vision');
  assert.equal(GetTrainingThemeId('not-registered'), null);
  assert.equal(GetTrainingThemeId(), null);
  assert.equal(GetTrainingThemeId(null), null);
  assert.equal(GetTrainingThemeId({}), null);
  assert.equal(GetTrainingModuleTheme('not-registered'), defaultTrainingTheme);
  assert.equal(GetTrainingModuleTheme(), defaultTrainingTheme);
  assert.deepEqual(
    trainingPurposes.map((theme) => theme.id),
    Object.keys(trainingThemes),
  );
});

test('theme style builder applies color fallbacks and bounded surface ratios', async () => {
  const { BuildTrainingThemeStyle } = await TranspileStandaloneModule(
    await readFile(themeStylePath, 'utf8'),
  );
  const baseTheme = {
    id: 'test',
    label: { 'zh-TW': '測試', en: 'Test' },
    icon: { type: 'material-symbol', value: 'science' },
    colors: { primary: '#123456' },
  };

  assert.deepEqual(BuildTrainingThemeStyle(baseTheme), {
    '--trainer-color': '#123456',
    '--trainer-color-dark': '#123456',
    '--trainer-surface': 'color-mix(in srgb, #123456 8%, var(--surface))',
  });
  assert.equal(
    BuildTrainingThemeStyle({ ...baseTheme, colors: { ...baseTheme.colors, surfaceMixRatio: 120 } })['--trainer-surface'],
    'color-mix(in srgb, #123456 100%, var(--surface))',
  );
  assert.equal(
    BuildTrainingThemeStyle({ ...baseTheme, colors: { ...baseTheme.colors, surfaceMixRatio: -4 } })['--trainer-surface'],
    'color-mix(in srgb, #123456 0%, var(--surface))',
  );
  assert.equal(
    BuildTrainingThemeStyle({ ...baseTheme, colors: { ...baseTheme.colors, surfaceMixRatio: Number.NaN } })['--trainer-surface'],
    'color-mix(in srgb, #123456 8%, var(--surface))',
  );
});

test('nested Material Symbol theme icons retain lobby sizing and theme color', async () => {
  const [lobbySource, lobbyCssSource] = await Promise.all([
    readFile(lobbyPath, 'utf8'),
    readFile(lobbyCssPath, 'utf8'),
  ]);

  assert.match(
    lobbySource,
    /module-card-theme-adornments[\s\S]*?<TrainingThemeIcon/,
  );
  assert.match(
    lobbyCssSource,
    /\.module-card-meta \.module-card-theme-icon\s*\{[\s\S]*?color:\s*var\(--trainer-color-dark\)/,
  );
  assert.doesNotMatch(lobbyCssSource, /\.module-card-meta\s*>\s*\.module-card-theme-icon/);
});
