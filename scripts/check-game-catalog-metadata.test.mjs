import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import ts from 'typescript';
import { MergeHubGames } from '../apps/rehabtrainerhub/app/hubGames.js';
import './game-preview-capture.test.mjs';

const gameRoot = new URL('../apps/rehabtrainerhub/games/drawing-defense/', import.meta.url);

async function HubCatalog() {
  const dependencies = {
    '@rehab-trainer/hub-modules/catalog': {
      BuildTrainingGameInstallHref: module => `/games/${module.runtimeId}/`,
      GetTrainingModuleCopy: (module, locale) => module.copy[locale],
      GetTrainingModuleCategoryLabel: module => module.category,
      GetTrainingModuleSubcategoryLabel: module => module.purpose,
      GetPublishedGameCategoryLabel: category => category,
      GetPublishedGameSubcategoryLabel: category => category,
      GetTrainingModuleTheme: () => ({}),
      GetTrainingThemeId: category => category,
    },
    './hubGames.js': { MergeHubGames },
    './hubBrand': { hubName: 'Hub', hubLocalName: 'Hub' },
    '@rehab-trainer/ui/officialGameReleases.json': { default: { 'drawing-defense': {} } },
  };
  const source = await readFile(new URL('../apps/rehabtrainerhub/app/gameCatalog.ts', import.meta.url), 'utf8');
  const loaded = { exports: {} };
  new Function('exports', 'require', ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)(loaded.exports, name => dependencies[name]);
  return loaded.exports.BuildHubGameCatalog;
}

for (const mediaPermission of ['none', 'camera', 'camera-optional', 'camera-or-microphone']) {
  test(`official cards use ${mediaPermission} from their launch module even when reviewed metadata is present`, async () => {
    const build = await HubCatalog();
    const module = { runtimeId: 'drawing-defense', mediaPermission, purpose: 'attention', category: 'brain',
      copy: { en: { title: 'Drawing', description: 'Practice' } } };
    const reviewed = { slug: 'drawing-defense', trainer: 'motor', category: 'hand', developerName: 'Studio',
      copy: { en: { title: 'Reviewed drawing', description: 'Reviewed practice' } },
      release: { presentation: 'game', capabilities: ['eye-tracking', 'microphone-level'], installUrl: '/install/' } };
    for (const releases of [[], [reviewed]]) {
      const [game] = build([module], releases, 'en');
      assert.equal(game.requirement, mediaPermission);
      assert.equal(game.requirement, game.launch.module.mediaPermission);
      assert.equal(game.launch.contract, 'catalog-v1');
    }
  });
}

test('developer cards derive camera and microphone requirements from approved release capabilities', async () => {
  const build = await HubCatalog();
  const cameraCapabilities = ['hand-tracking', 'eye-tracking', 'pose-tracking', 'tongue-tracking', 'head-tracking'];
  const cases = [[[], 'none'], [['pointer', 'keyboard'], 'none'], [['microphone-level'], 'microphone'],
    ...cameraCapabilities.flatMap(capability => [
      [[capability], 'camera'], [[capability, 'microphone-level'], 'camera-and-microphone'],
    ])];
  for (const [capabilities, expected] of cases) {
    const release = { slug: 'developer-activity', title: 'Activity', summary: 'Practice', category: 'attention',
      release: { capabilities, installUrl: '/install/', version: '1.0.0' } };
    const [game] = build([], [release], 'en');
    assert.equal(game.requirement, expected, `Capabilities ${capabilities.join(', ')} must describe the required equipment.`);
    assert.equal(game.launch.contract, 'package-v1');
  }
});

test('every official Hub preview has a matching gameplay capture', async () => {
  const registry = JSON.parse(await readFile(new URL('../packages/ui/src/officialGameReleases.json', import.meta.url), 'utf8'));
  const captures = JSON.parse(await readFile(new URL('../docs/game-preview-captures.json', import.meta.url), 'utf8'));
  assert.deepEqual(captures.map(capture => capture.gameId).sort(), Object.keys(registry).sort());
  for (const capture of captures) {
    assert.match(capture.phase, /^(gameplay|playing|combat|go|answer)/, capture.gameId);
    assert.match(capture.screenshotSha256, /^[a-f0-9]{64}$/, capture.gameId);
    assert.equal(capture.screenshotWidth, 1280, capture.gameId);
    assert.equal(capture.screenshotHeight, 720, capture.gameId);
    const preview = await readFile(new URL(`../apps/rehabtrainerhub/games/${capture.gameId}/public/preview.webp`, import.meta.url));
    assert.equal(createHash('sha256').update(preview).digest('hex'), capture.previewSha256, capture.gameId);
    const metadata = await sharp(preview).metadata();
    assert.deepEqual([metadata.width, metadata.height], [640, 360], capture.gameId);
  }
});

test('drawing-defense owns its upper-limb tags, localized copy and gameplay preview', async () => {
  const metadata = JSON.parse(await readFile(new URL('public/game.json', gameRoot), 'utf8'));
  assert.equal(metadata.gameId, 'drawing-defense');
  assert.equal(metadata.trainer, 'motor');
  assert.equal(metadata.category, 'upper-limb');
  assert.equal(metadata.copy['zh-TW'].title, '畫畫塔防');
  const preview = await readFile(new URL(`public/${metadata.preview}`, gameRoot));
  assert.equal(preview.subarray(0, 4).toString(), 'RIFF');
  assert.equal(preview.subarray(8, 12).toString(), 'WEBP');
  const source = await readFile(new URL('catalog.ts', new URL('../', gameRoot)), 'utf8');
  assert.match(source, /drawingDefenseCatalog\.category/);
  assert.match(source, /drawingDefenseCatalog\.preview/);
});

test('game catalog metadata rejects incompatible tags and previews outside the release', async () => {
  const { ParseGameCatalogMetadata } = await import('../apps/rehabtrainerhub/games/gameCatalogMetadata.js');
  const value = { schemaVersion: 1, gameId: 'drawing-defense', trainer: 'motor', category: 'upper-limb',
    author: 'Studio', preview: 'preview.webp', copy: {
      'zh-TW': { title: '畫畫塔防', description: '上肢動作練習。' },
      en: { title: 'Drawing defense', description: 'Upper-limb practice.' },
    } };
  const paths = new Set(['preview.webp', 'index.html']);
  assert.deepEqual(ParseGameCatalogMetadata(value, 'drawing-defense', paths), value);
  for (const patch of [{ gameId: 'other-game' }, { category: 'higher-cognition' },
    { preview: 'https://example.com/preview.webp' }, { preview: '../preview.webp' },
    { preview: 'missing.webp' }, { preview: 'index.html' }, { copy: { en: value.copy.en } }]) {
    assert.throws(() => ParseGameCatalogMetadata({ ...value, ...patch }, 'drawing-defense', paths));
  }
});
