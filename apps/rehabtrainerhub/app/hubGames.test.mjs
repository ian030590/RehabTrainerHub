import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import { MergeHubGames } from './hubGames.js';
import { IsGameTagPair } from '../games/gameTags.js';

async function ImportHubModule(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const registry = JSON.parse(await readFile(new URL('../../../packages/ui/src/officialGameReleases.json', import.meta.url), 'utf8'));
  const dependencies = {
    '@rehab-trainer/hub-modules/catalog': {
      BuildTrainingGameInstallHref: module => `/games/${module.runtimeId}/`,
      BuildTrainingModuleImageSrc: module => `https://trainerhub.cc${module.imagePath}`,
      GetTrainingModuleCopy: (module, locale) => module.copy[locale],
      GetTrainingModuleCategoryLabel: module => module.category,
      GetTrainingModuleSubcategoryLabel: module => module.purpose,
      GetPublishedGameCategoryLabel: category => category,
      GetPublishedGameSubcategoryLabel: category => category,
      GetTrainingModuleTheme: input => ({ id: typeof input === 'string' ? input : input.purpose }),
      GetTrainingThemeId: value => ['upper-limb', 'higher-cognition'].includes(value) ? value : null,
      IsTrainerCategoryId: value => ['motor', 'brain'].includes(value),
    },
    './hubGames.js': { MergeHubGames }, './hubBrand': { hubName: 'Hub', hubLocalName: 'Hub' },
    '@rehab-trainer/ui/officialGameReleases.json': registry,
    '../games/gameTags.js': { IsGameTagPair },
  };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText)(name => { assert.ok(name in dependencies, name); return dependencies[name]; }, module, module.exports);
  return module.exports;
}

function CurrentGame() {
  return { id: 'drawing-defense', slug: 'drawing-defense', title: 'Reviewed drawing', summary: 'Upper-limb practice.',
    trainer: 'motor', category: 'upper-limb', developerName: 'Studio', copy: {
      'zh-TW': { title: '畫畫塔防', description: '上肢動作練習。' },
      en: { title: 'Reviewed drawing', description: 'Upper-limb practice.' },
    }, previewUrl: 'https://trainerhub-user-games.pages.dev/games/drawing-defense/2.0.3/package/preview.webp',
    release: { id: 'drawing-defense@2.0.3', version: '2.0.3', presentation: 'game', contentSha256: 'a'.repeat(64),
      capabilities: ['pointer'], launchUrl: 'https://trainerhub-user-games.pages.dev/games/drawing-defense/2.0.3/',
      installUrl: 'https://trainerhub-user-games.pages.dev/games/drawing-defense/' } };
}

test('reviewed game metadata updates its card and filters while preserving the R2 session launch', async () => {
  const { BuildHubGameCatalog } = await ImportHubModule('./gameCatalog.ts');
  const module = { runtimeId: 'drawing-defense', trainer: 'brain', category: 'brain', purpose: 'higher-cognition',
    imagePath: '/old-preview.webp', copy: { en: { title: 'Old title', description: 'Old summary' } } };
  const [game] = BuildHubGameCatalog([module], [CurrentGame()], 'en');
  assert.equal(game.purpose, 'upper-limb');
  assert.equal(game.imageSrc, CurrentGame().previewUrl);
  assert.equal(game.title, 'Reviewed drawing');
  assert.equal(game.version, '2.0.3');
  assert.equal(game.launch.contract, 'catalog-v1');
  assert.equal(game.launch.module.runtimeId, 'drawing-defense');
  assert.equal(game.launch.module.purpose, 'upper-limb');
});

test('published catalog accepts game-owned metadata and rejects previews outside that version', async context => {
  const { FetchPublishedGames } = await ImportHubModule('./publishedGames.ts');
  let games = [CurrentGame()];
  context.mock.method(globalThis, 'fetch', async () => Response.json({ games }));
  assert.equal((await FetchPublishedGames()).length, 1);
  for (const previewUrl of ['https://evil.example/preview.webp',
    'https://trainerhub-user-games.pages.dev/games/drawing-defense/1.0.0/package/preview.webp',
    'https://trainerhub-user-games.pages.dev/games/other-game/2.0.3/package/preview.webp']) {
    games = [{ ...CurrentGame(), previewUrl }];
    assert.equal((await FetchPublishedGames()).length, 0);
  }
});

test('older releases load the game-owned compatibility preview on the current Hub origin', async () => {
  const { BuildHubGameCatalog } = await ImportHubModule('./gameCatalog.ts');
  const module = { runtimeId: 'drawing-defense', trainer: 'motor', category: 'motor', purpose: 'upper-limb',
    imagePath: '/assets/game-previews/drawing-defense/preview.webp',
    copy: { en: { title: 'Drawing defense', description: 'Upper-limb practice.' } } };
  const [game] = BuildHubGameCatalog([module], [], 'en');
  assert.equal(game.imageSrc, module.imagePath);
});

test('one catalog includes existing games and reviewed releases without replacing their launch contracts', () => {
  const legacy = [{ id: 'moving-card', launch: 'legacy' }, { id: 'drawing-defense', launch: 'catalog' }];
  const published = [{ id: 'drawing-defense', launch: 'release' }, { id: 'new-game', launch: 'release' }];
  const games = MergeHubGames(legacy, published);
  assert.deepEqual(games.map(game => game.id), ['moving-card', 'drawing-defense', 'new-game']);
  assert.equal(games.find(game => game.id === 'moving-card'), legacy[0]);
  assert.equal(games.find(game => game.id === 'drawing-defense'), legacy[1]);
  assert.equal(legacy.length, 2);
});

test('catalog outages preserve existing game navigation and installation entries', () => {
  const games = [{ id: 'legacy-game', installUrl: '/games/legacy-game/', launch: { module: 'original' } }];
  assert.deepEqual(MergeHubGames(games, []), games);
});

test('a published slug collision cannot replace a retained legacy game during the Hub-only stage', () => {
  const existing = { id: 'moving-card', launch: { module: 'original' }, installUrl: '/games/moving-card/' };
  const published = { id: 'moving-card', launch: { module: 'uploaded' }, installUrl: '/uploaded/' };
  const games = MergeHubGames([existing], [published]);
  assert.deepEqual(games, [existing]);
});

test('an old drawing-defense publication cannot replace the R2 current session entry', () => {
  const current = { id: 'drawing-defense', title: 'Drawing defense',
    installUrl: '/games/drawing-defense/', launch: { contract: 'catalog-v1', module: { runtimeId: 'drawing-defense' } } };
  const oldRelease = { id: 'drawing-defense', title: 'Obsolete settings shell', version: '1.0.0',
    installUrl: 'https://trainerhub-user-games.pages.dev/games/drawing-defense/1.0.0/',
    launch: { contract: 'package-v1', game: { release: { version: '1.0.0' } } } };
  const [game] = MergeHubGames([current], [oldRelease]);
  assert.equal(game, current);
  assert.equal(game.launch.contract, 'catalog-v1');
  assert.equal(game.installUrl, '/games/drawing-defense/');
});

test('the lobby presents one result grid and one launch entry while retaining its mobile controls', async () => {
  const source = await readFile(new URL('./TrainingLobby.tsx', import.meta.url), 'utf8');
  assert.equal((source.match(/className="module-grid"/g) ?? []).length, 1);
  assert.doesNotMatch(source, /Official library|Developer library|officialLibrary|developerLibrary/);
  assert.match(source, /<GameOverlay /);
  assert.match(source, /aria-expanded=\{isMobileFilterOpen\}/);
  assert.match(source, /aria-controls="filter-panel"/);
});
