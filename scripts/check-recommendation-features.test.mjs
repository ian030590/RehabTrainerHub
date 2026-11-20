import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import * as features from '../apps/rehabtrainerhub/recommendation/features.js';

const { DeriveTagLevels, featureSpaceVersion, GameSimilarity, SimilarGames, similarityWeights, ValidateRecommendationData } = features;
const gamesRoot = new URL('../apps/rehabtrainerhub/games/', import.meta.url);
const labels = { 'zh-TW': '測試', en: 'Test' };
const taxonomy = {
  taxonomyVersion: '2.0.0',
  frameworks: [{ id: 'icf', name: 'ICF', citation: 'WHO (2001)', edition: '2001' }],
  icfCodes: [{ code: 'b140', title: { en: 'Attention functions', 'zh-TW': '注意力功能' } }],
  dimensions: [
    { id: 'focus', group: 'function', frameworkId: 'icf', labels: { 'zh-TW': '注意力', en: 'Attention' }, selection: 'multiple', required: false },
    { id: 'pacing', group: 'taskDemand', frameworkId: 'icf', labels: { 'zh-TW': '作答節奏', en: 'Pacing' }, selection: 'single', required: true },
    { id: 'response_modality', group: 'taskDemand', frameworkId: 'icf', labels, selection: 'multiple', required: true },
  ],
  tags: [
    { id: 'focus.control', icfCode: 'b140', labels: { 'zh-TW': '注意控制', en: 'Attention control' } },
    { id: 'focus.control.a', parent: 'focus.control', icfCode: 'b140', labels: { 'zh-TW': '目標選取', en: 'Target selection' } },
    { id: 'focus.control.b', parent: 'focus.control', icfCode: 'b140' },
    { id: 'focus.other', icfCode: 'b140', labels: { 'zh-TW': '持續注意', en: 'Sustained attention' } },
    { id: 'focus.old', icfCode: 'b140', status: 'deprecated', replacementTagId: 'focus.control.a' },
    { id: 'pacing.self', labels: { 'zh-TW': '自行掌握', en: 'Self-paced' } },
    { id: 'pacing.external', labels: { 'zh-TW': '外部節奏', en: 'Externally paced' } },
    { id: 'response_modality.manual', requiresAnyCapability: ['input.pointer'] },
    { id: 'response_modality.camera', requiresAnyCapability: ['camera'] },
    { id: 'response_modality.voice', requiresAnyCapability: ['microphone'] },
  ].map(tag => ({ dimension: tag.id.split('.')[0], labels, definition: labels, status: 'active', ...tag })),
  capabilities: ['input.pointer', 'camera', 'microphone'].map(id => ({ id, labels })),
};
const catalog = [{ id: 'example', mediaPermission: 'none' }];
const defaultDemands = {
  'pacing.self': 2, 'pacing.external': 0,
  'response_modality.manual': 2, 'response_modality.camera': 0, 'response_modality.voice': 0,
};

function Game(functionTags = { 'focus.control.a': 2 }, taskDemandTags = defaultDemands) {
  return {
    reviewStatus: 'draft',
    functionTags,
    taskDemandTags: { ...taskDemandTags },
    evidence: Object.fromEntries(Object.entries(functionTags).filter(([, level]) => level === 2)
      .map(([id]) => [id, '玩家依提示選擇目標。'])),
    supportedSetups: [{ id: 'pointer', allCapabilities: ['input.pointer'] }],
  };
}

function ReadData(name) {
  return JSON.parse(readFileSync(new URL(`../apps/rehabtrainerhub/recommendation/${name}.json`, import.meta.url), 'utf8'));
}

test('the ICF registry pins the code and bilingual titles to the owner-supplied 2001 edition', () => {
  const data = ReadData('taxonomy');
  const expectedTitles = [
    ['b140', 'Attention functions', '注意力功能'],
    ['b1400', 'Sustaining attention', '持續注意力'],
    ['b1401', 'Shifting attention', '轉移注意力'],
    ['b1402', 'Dividing attention', '分配注意力'],
    ['b144', 'Memory functions', '記憶功能'],
    ['b1440', 'Short-term memory', '短期記憶'],
    ['b147', 'Psychomotor functions', '心理動作功能'],
    ['b1470', 'Psychomotor control', '心理動作控制'],
    ['b1560', 'Auditory perception', '聽覺'],
    ['b1561', 'Visual perception', '視覺'],
    ['b1565', 'Visuospatial perception', '視覺空間感'],
    ['b164', 'Higher-level cognitive functions', '高階認知功能'],
    ['b1641', 'Organization and planning', '組織和規劃'],
    ['b1643', 'Cognitive flexibility', '認知彈性'],
    ['b1646', 'Problem-solving', '解決問題'],
    ['b16700', 'Reception of spoken language', '口語語言接受'],
    ['b16701', 'Reception of written language', '書寫語言接受'],
    ['b16710', 'Expression of spoken language', '口語語言表達'],
    ['b16711', 'Expression of written language', '書面語言表達'],
    ['b172', 'Calculation functions', '計算功能'],
    ['b1802', 'Experience of time', '時間經驗'],
    ['b2101', 'Visual field functions', '視野功能'],
    ['b21022', 'Contrast sensitivity', '對比敏感度'],
    ['b215', 'Functions of structures adjoining the eye', '眼睛鄰近結構的功能'],
    ['b2152', 'Functions of external muscles of the eye', '眼外肌功能'],
    ['b310', 'Voice functions', '嗓音功能'],
    ['b320', 'Articulation functions', '構音功能'],
    ['b5102', 'Chewing', '咀嚼'],
    ['b5103', 'Manipulation of food in the mouth', '口中處理食物'],
    ['b51050', 'Oral swallowing', '口腔吞嚥'],
    ['b51051', 'Pharyngeal swallowing', '咽部吞嚥'],
    ['b760', 'Control of voluntary movement functions', '隨意動作控制功能'],
    ['b7602', 'Coordination of voluntary movements', '隨意動作協調'],
    ['d440', 'Fine hand use', '精細手部使用'],
    ['d445', 'Hand and arm use', '手和臂使用'],
    ['d4452', 'Reaching', '伸'],
    ['d4350', 'Pushing with lower extremities', '用下肢推動'],
  ];
  assert.equal(data.icfCodes.length, expectedTitles.length);
  assert.deepEqual(
    Object.fromEntries(data.icfCodes.map(({ code, title }) => [code, title])),
    Object.fromEntries(expectedTitles.map(([code, en, zh]) => [code, { en, 'zh-TW': zh }])),
  );
  const icf = data.frameworks.find(framework => framework.id === 'icf');
  assert.equal(icf?.edition, '2001');
  assert.equal(icf.url, 'https://www.pmr.org.tw/files/papers/ICF.pdf');
  assert.match(icf.citation, /王顏和.*國際機能、失能和健康分類.*99M4073/);
});

test('foot function and response tags use the 2001 lower-extremity push code', () => {
  const { tags } = ReadData('taxonomy');
  for (const id of ['motor.foot_use', 'response_modality.foot']) {
    assert.equal(tags.find(tag => tag.id === id)?.icfCode, 'd4350');
  }
});

test('every official catalog seed has a valid recommendation profile', async () => {
  const { ReadCatalog } = await import('./recommendation-pipeline.mjs');
  const catalog = await ReadCatalog(gamesRoot);
  const source = ts.createSourceFile('catalog.ts', readFileSync(new URL('catalog.ts', gamesRoot), 'utf8'), ts.ScriptTarget.Latest, true);
  const seeds = source.statements.filter(ts.isVariableStatement)
    .flatMap(statement => [...statement.declarationList.declarations])
    .find(declaration => declaration.name.getText() === 'seeds')?.initializer;
  const array = seeds && ts.isAsExpression(seeds) ? seeds.expression : seeds;
  assert.ok(array && ts.isArrayLiteralExpression(array));
  const ids = array.elements.map(element => {
    assert.ok(ts.isObjectLiteralExpression(element));
    const id = element.properties.find(property => ts.isPropertyAssignment(property) && property.name.getText() === 'id');
    assert.ok(id && ts.isStringLiteral(id.initializer));
    return id.initializer.text;
  });
  assert.deepEqual(catalog.map(game => game.id), ids);
  assert.equal(catalog.find(game => game.id === 'every-ball-response')?.mediaPermission, 'camera-or-microphone');
  assert.deepEqual(ValidateRecommendationData(ReadData('taxonomy'), ReadData('gameFeatures'), catalog), { ok: true, errors: [] });
});

test('a new catalog seed with a flow manifest and no feature entry fails R10', async t => {
  const { ReadCatalog } = await import('./recommendation-pipeline.mjs');
  const directory = mkdtempSync(join(tmpdir(), 'recommendation-catalog-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const fixtureRoot = pathToFileURL(directory + sep);
  const catalogSource = readFileSync(new URL('catalog.ts', gamesRoot), 'utf8');
  const manifestSource = readFileSync(new URL('moduleFlowManifest.ts', gamesRoot), 'utf8');
  writeFileSync(new URL('catalog.ts', fixtureRoot), catalogSource.replace(
    'const seeds: readonly TrainingCatalogSeed[] = [',
    "const seeds: readonly TrainingCatalogSeed[] = [\n  {\n    id: 'untagged-fixture',\n    trainer: 'brain',\n  },",
  ));
  writeFileSync(new URL('moduleFlowManifest.ts', fixtureRoot), manifestSource.replace(
    ']> = [',
    "]> = [\n  ['brain:untagged-fixture', 'untagged-fixture/Game.tsx', 'none'],",
  ));

  const catalog = await ReadCatalog(fixtureRoot);
  assert.ok(catalog.some(({ id }) => id === 'untagged-fixture'));
  const result = ValidateRecommendationData(ReadData('taxonomy'), ReadData('gameFeatures'), catalog);
  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /^\[R10\] gameFeatures\.games\.untagged-fixture /);
});

const invalidCases = [
  ['R01', 'taxonomy version syntax', ({ taxonomy }) => { taxonomy.taxonomyVersion = 'v2'; }],
  ['R01', 'mismatched taxonomy version', ({ data }) => { data.taxonomyVersion = '2.1.0'; }],
  ['R01', 'schema version', ({ data }) => { data.schemaVersion = 1; }],
  ['R02', 'framework citation', ({ taxonomy }) => { delete taxonomy.frameworks[0].citation; }],
  ['R02', 'missing dimension framework', ({ taxonomy }) => { taxonomy.dimensions[0].frameworkId = 'missing'; }],
  ['R03', 'unknown dimension', ({ taxonomy }) => { taxonomy.tags[1].dimension = 'missing'; }],
  ['R03', 'incorrect tag prefix', ({ taxonomy }) => { taxonomy.tags[1].id = 'other.a'; }],
  ['R03', 'duplicate tag', ({ taxonomy }) => { taxonomy.tags.push(taxonomy.tags[1]); }],
  ['R04', 'missing function code', ({ taxonomy }) => { delete taxonomy.tags[1].icfCode; }],
  ['R04', 'unknown function code', ({ taxonomy }) => { taxonomy.tags[1].icfCode = 'b999'; }],
  ['R04', 'ICF title in the legacy string format', ({ taxonomy }) => { taxonomy.icfCodes[0].title = 'Attention functions'; }],
  ['R04', 'ICF title without English', ({ taxonomy }) => { delete taxonomy.icfCodes[0].title.en; }],
  ['R04', 'ICF title without Traditional Chinese', ({ taxonomy }) => { delete taxonomy.icfCodes[0].title['zh-TW']; }],
  ['R04', 'ICF title with a blank Traditional Chinese value', ({ taxonomy }) => { taxonomy.icfCodes[0].title['zh-TW'] = ' '; }],
  ['R05', 'missing parent', ({ taxonomy }) => { taxonomy.tags[1].parent = 'focus.missing'; }],
  ['R05', 'different-dimension parent', ({ taxonomy }) => { taxonomy.tags[1].parent = 'pacing.self'; }],
  ['R05', 'parent cycle', ({ taxonomy }) => { taxonomy.tags[0].parent = taxonomy.tags[1].id; }],
  ['R06', 'missing bilingual definition', ({ taxonomy }) => { taxonomy.tags[1].definition = { en: 'Test' }; }],
  ['R06', 'missing bilingual dimension labels', ({ taxonomy }) => { delete taxonomy.dimensions[0].labels; }],
  ['R07', 'banned English term', ({ taxonomy }) => { taxonomy.tags[1].definition = { ...labels, en: 'Improvement' }; }],
  ['R07', 'banned Chinese term', ({ taxonomy }) => { taxonomy.dimensions[0].labels = { ...labels, 'zh-TW': '矯正' }; }],
  ['R08', 'missing replacement', ({ taxonomy }) => { delete taxonomy.tags[4].replacementTagId; }],
  ['R08', 'wrong replacement dimension', ({ taxonomy }) => { taxonomy.tags[4].replacementTagId = 'pacing.self'; }],
  ['R10', 'missing game', ({ data }) => { delete data.games.example; }],
  ['R10', 'extra game', ({ data }) => { data.games.extra = Game(); }],
  ['R11', 'unknown tag', ({ game }) => { game.functionTags['focus.missing'] = 1; }],
  ['R11', 'deprecated tag', ({ game }) => { game.functionTags['focus.old'] = 0; }],
  ['R11', 'wrong group', ({ game }) => { game.functionTags['pacing.self'] = 0; }],
  ['R11', 'parent tag', ({ game }) => { game.functionTags['focus.control'] = 0; }],
  ['R11', 'invalid level', ({ game }) => { game.functionTags['focus.control.b'] = '1'; }],
  ['R11', 'invalid tag map', ({ game }) => { game.functionTags = null; }],
  ['R12', 'incomplete task demand', ({ game }) => { delete game.taskDemandTags['response_modality.camera']; }],
  ['R13', 'two primary tags', ({ game }) => { game.taskDemandTags['pacing.external'] = 2; }],
  ['R13', 'secondary single-selection tag', ({ game }) => { game.taskDemandTags['pacing.external'] = 1; }],
  ['R14', 'no primary function', ({ game }) => { game.functionTags['focus.control.a'] = 1; }],
  ['R15', 'missing evidence', ({ game }) => { delete game.evidence['focus.control.a']; }],
  ['R15', 'evidence without Chinese text', ({ game }) => { game.evidence['focus.control.a'] = 'Look at the target.'; }],
  ['R15', 'extra evidence', ({ game }) => { game.evidence['focus.control.b'] = '玩家點選目標。'; }],
  ['R16', 'response has no compatible setup', ({ game }) => { game.taskDemandTags['response_modality.camera'] = 1; }],
  ['R16', 'setup capability is unjustified', ({ game }) => { game.supportedSetups[0].allCapabilities.push('camera'); }],
  ['R16', 'setup capability is unknown', ({ game }) => { game.supportedSetups[0].allCapabilities.push('unknown'); }],
  ['R16', 'no supported setup', ({ game }) => { game.supportedSetups = []; }],
  ['R16', 'duplicated setup', ({ game }) => { game.supportedSetups.push(game.supportedSetups[0]); }],
  ['R17', 'catalog requires missing camera', ({ catalog }) => { catalog[0].mediaPermission = 'camera'; }],
  ['R17', 'catalog does not permit setup camera', ({ game }) => {
    game.taskDemandTags['response_modality.camera'] = 1;
    game.supportedSetups.push({ id: 'camera', allCapabilities: ['camera'] });
  }],
  ['R17', 'optional camera lacks a media-free setup', ({ game, catalog }) => {
    catalog[0].mediaPermission = 'camera-optional';
    game.taskDemandTags['response_modality.manual'] = 0;
    game.taskDemandTags['response_modality.camera'] = 2;
    game.supportedSetups = [{ id: 'camera', allCapabilities: ['camera'] }];
  }],
  ['R18', 'unknown review status', ({ game }) => { game.reviewStatus = 'reviewed'; }],
];

for (const [rule, name, mutate] of invalidCases) {
  test(`validator rejects ${name} with ${rule}`, () => {
    const game = Game();
    const data = { schemaVersion: 2, taxonomyVersion: '2.0.0', games: { example: game } };
    const fixture = { taxonomy: structuredClone(taxonomy), catalog: structuredClone(catalog), game, data };
    mutate(fixture);
    const result = ValidateRecommendationData(fixture.taxonomy, data, fixture.catalog);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(error => error.startsWith(`[${rule}] `)), result.errors.join('\n'));
  });
}

test('draft and confirmed are accepted and unannotated function leaves remain optional', () => {
  for (const status of ['draft', 'confirmed']) {
    const game = { ...Game(), reviewStatus: status };
    const data = { schemaVersion: 2, taxonomyVersion: '2.0.0', games: { example: game } };
    assert.deepEqual(ValidateRecommendationData(taxonomy, data, catalog), { ok: true, errors: [] });
  }
});

test('media alternatives and a non-camera fallback follow the catalog media permission', () => {
  const game = Game();
  game.taskDemandTags['response_modality.camera'] = 1;
  game.supportedSetups.push({ id: 'camera', allCapabilities: ['camera'] });
  const data = { schemaVersion: 2, taxonomyVersion: '2.0.0', games: { example: game } };
  const entries = [{ id: 'example', mediaPermission: 'camera-optional' }];
  assert.equal(ValidateRecommendationData(taxonomy, data, entries).ok, true);
  entries[0].mediaPermission = 'camera-or-microphone';
  game.taskDemandTags['response_modality.manual'] = 0;
  game.taskDemandTags['response_modality.voice'] = 1;
  game.supportedSetups[0] = { id: 'voice', allCapabilities: ['microphone'] };
  assert.equal(ValidateRecommendationData(taxonomy, data, entries).ok, true);
});

test('parent levels use the maximum known active child, propagate, and preserve known zero', () => {
  const tree = structuredClone(taxonomy);
  tree.tags.push({ ...tree.tags[0], id: 'focus.root' });
  tree.tags[0].parent = 'focus.root';
  for (const level of [0, 1, 2]) {
    const input = { 'focus.control.a': level, 'focus.control.b': 0 };
    assert.deepEqual(DeriveTagLevels(tree, input), { ...input, 'focus.control': level, 'focus.root': level });
  }
  assert.deepEqual(DeriveTagLevels(tree, {}), {});
});

test('masked cosine distinguishes unknown from known zero and keeps fixed weights with absent groups', () => {
  const target = Game({ 'focus.control.a': 2, 'focus.other': 2 }, {});
  const unknown = Game({ 'focus.control.a': 2 }, {});
  const zero = Game({ 'focus.control.a': 2, 'focus.other': 0 }, {});
  assert.deepEqual(GameSimilarity(taxonomy, target, unknown), {
    score: 0.7 * (4 / 5), function: 4 / 5, taskDemand: null, coverage: { function: 4 / 5, taskDemand: null },
  });
  const known = GameSimilarity(taxonomy, target, zero);
  assert.equal(known.coverage.function, 1);
  assert.ok(Math.abs(known.score - 0.7 * Math.sqrt(2 / 3)) < 1e-12);
  assert.notEqual(known.score, 0.7 * (4 / 5));

  assert.equal(featureSpaceVersion, '2.0.0');
  assert.deepEqual(similarityWeights, { function: 0.7, taskDemand: 0.3 });
  assert.equal(GameSimilarity(taxonomy, Game(), Game({}, {})).score, null);
  assert.equal(GameSimilarity(taxonomy, Game(), Game({})).score, 0.3);
  const secondary = Game({ 'focus.control.a': 2, 'focus.other': 1 });
  const combined = GameSimilarity(taxonomy, secondary, Game());
  assert.equal(combined.score, 0.7 * (16 / 17) + 0.3);
});

test('identical task demands score at most 0.3 when the function group has no shared evidence', () => {
  const { games } = ReadData('gameFeatures');
  const result = GameSimilarity(ReadData('taxonomy'), games['digit-span'], games['memory-match']);
  assert.equal(result.function, null);
  assert.equal(result.taskDemand, 1);
  assert.equal(result.score, 0.3);
});

test('real catalog pair scores are symmetric and bounded, including identical profiles', () => {
  const realTaxonomy = ReadData('taxonomy');
  const games = Object.values(ReadData('gameFeatures').games);
  for (const first of games) {
    assert.equal(GameSimilarity(realTaxonomy, first, first).score, 1);
    for (const second of games) {
      const result = GameSimilarity(realTaxonomy, first, second);
      assert.deepEqual(result, GameSimilarity(realTaxonomy, second, first));
      const { coverage, ...scores } = result;
      for (const value of [...Object.values(scores), ...Object.values(coverage)]) {
        assert.ok(value === null || (value >= 0 && value <= 1));
      }
    }
  }
});

test('neighbors omit self and nulls, sort score ties by id, and share only function tags', () => {
  const same = Game({ 'focus.control.a': 2, 'focus.other': 1 });
  const gameFeatures = { games: {
    zulu: same, current: same, unknown: Game({}, {}), lower: Game(),
    delta: same, charlie: same, bravo: same, alpha: same,
  } };
  assert.deepEqual(SimilarGames(taxonomy, gameFeatures, 'current').map(match => match.gameId),
    ['alpha', 'bravo', 'charlie', 'delta', 'zulu']);
  assert.deepEqual(SimilarGames(taxonomy, gameFeatures, 'current', { limit: 1 }),
    [{ gameId: 'alpha', score: 1, sharedTags: ['focus.control', 'focus.control.a', 'focus.other'] }]);
  assert.deepEqual(SimilarGames(taxonomy, gameFeatures, 'missing'), []);
  assert.deepEqual(SimilarGames(taxonomy, gameFeatures, 'unknown'), []);
  assert.deepEqual(SimilarGames(taxonomy, gameFeatures, 'current', { limit: 0 }), []);
});

function LoadAdminComponent(file, dependencies, window = {}) {
  const path = new URL(`../apps/rehabtrainerhub/app/admin/${file}.tsx`, import.meta.url);
  const { outputText } = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  });
  const jsx = (type, props) => ({ type, props });
  const imports = { 'react/jsx-runtime': { jsx, jsxs: jsx }, ...dependencies };
  const exports = {};
  runInNewContext(outputText, { exports, require: name => imports[name] ?? {}, window });
  return exports[file];
}

const fixtureCatalog = {
  trainingCatalog: [
    { runtimeId: 'first', trainer: 'brain', mediaPermission: 'none', copy: { 'zh-TW': { title: '第一項' } } },
    { runtimeId: 'second', trainer: 'vision', mediaPermission: 'none', copy: { 'zh-TW': { title: '第二項' } } },
  ],
  GetTrainingModuleCategoryLabel: module => module.trainer,
};

function RenderReview(sourceData, neighbors = SimilarGames, reviewCatalog = fixtureCatalog, reviewTaxonomy = taxonomy) {
  let selected;
  let pickerFocused = false;
  const render = LoadAdminComponent('GameSimilarityReview', {
    react: {
      useState: initial => [selected ?? initial, value => { selected = value; }],
      useRef: () => ({ current: { focus() { pickerFocused = true; } } }),
    },
    '../../games/catalog': reviewCatalog,
    '../../recommendation/taxonomy.json': reviewTaxonomy,
    '../../recommendation/gameFeatures.json': sourceData,
    '../../recommendation/features.js': { ...features, SimilarGames: neighbors },
  }, { requestAnimationFrame: callback => callback() });
  return { render, focused: () => pickerFocused };
}

function Elements(tree) {
  if (Array.isArray(tree)) return tree.flatMap(Elements);
  return tree?.props ? [tree, ...Elements(tree.props.children)] : [];
}

function VisibleText(tree) {
  if (Array.isArray(tree)) return tree.map(VisibleText).join(' ');
  if (typeof tree === 'string') return tree;
  return tree?.props ? VisibleText(tree.props.children) : '';
}

function LoadRuntimeCatalog() {
  const catalogPath = new URL('catalog.ts', gamesRoot);
  const requireCatalog = createRequire(catalogPath);
  const resolveImports = {
    '@rehab-trainer/ui/siteUrls': new URL('../packages/ui/src/siteUrls.ts', import.meta.url),
    '@rehab-trainer/ui/officialGameReleases.json': new URL('../packages/ui/src/officialGameReleases.json', import.meta.url),
    './moduleFlowManifest': new URL('moduleFlowManifest.ts', gamesRoot),
  };
  const { outputText } = ts.transpileModule(readFileSync(catalogPath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  const exports = {};
  runInNewContext(outputText, {
    exports,
    require: name => requireCatalog(resolveImports[name] ? fileURLToPath(resolveImports[name]) : name),
  });
  return exports;
}

function LoadActivityMapModule(path, imports = {}) {
  const url = new URL(`../apps/rehabtrainerhub/app/${path}`, import.meta.url);
  const require = createRequire(url);
  const { outputText } = ts.transpileModule(readFileSync(url, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  });
  const exports = {};
  new Function('exports', 'require', outputText)(exports, name => imports[name] ?? require(name));
  return exports;
}

test('activity map keyboard moves to the nearest point in the chosen direction with catalog-order ties', () => {
  const { GetDirectionalActivityId, GetNearestActivityId, ReadActivityMapPoints } = LoadActivityMapModule('activity-map/activityMapModel.ts');
  const points = [
    { id: 'start', point: [0.5, 0.5] }, { id: 'right', point: [0.75, 0.5] },
    { id: 'right-tie', point: [0.75, 0.5] }, { id: 'left', point: [0.25, 0.5] },
    { id: 'up', point: [0.5, 0.375] }, { id: 'down', point: [0.5, 0.75] },
    { id: 'diagonal', point: [0.625, 0.875] },
  ];
  for (const [key, id] of Object.entries({ ArrowUp: 'up', ArrowDown: 'down', ArrowRight: 'right', ArrowLeft: 'left', Home: 'start', End: 'diagonal' })) {
    assert.equal(GetDirectionalActivityId(points, 'start', key), id);
  }
  assert.equal(GetDirectionalActivityId(points, 'up', 'ArrowUp'), 'up');
  assert.equal(GetDirectionalActivityId(points, 'start', 'Enter'), null);
  assert.equal(GetNearestActivityId(points, [0.71, 0.5], 0.3), 'right');
  assert.equal(GetNearestActivityId(points, [0.71, 0.5], 0.03), null);
  assert.equal(ReadActivityMapPoints({ a: [0.2, 0.3], b: [0.2, 0.3] }, ['a', 'b']), null);
  assert.equal(ReadActivityMapPoints({ a: [1.1, 0.3] }, ['a']), null);
  assert.equal(ReadActivityMapPoints({ a: [0.00001, 0.3] }, ['a']), null);
});

test('public activity map renders every catalog marker and list item once with matching launch paths and bilingual caption', () => {
  const catalog = LoadRuntimeCatalog();
  const model = LoadActivityMapModule('activity-map/activityMapModel.ts');
  const { zhTW } = LoadActivityMapModule('i18n/zh-TW.ts');
  const { en } = LoadActivityMapModule('i18n/en.ts');
  for (const [language, dictionary] of [['zh', zhTW], ['en', en]]) {
    const { ActivityMap } = LoadActivityMapModule('activity-map/ActivityMap.tsx', {
      '../i18n': { GetHubUiCopy: () => dictionary.hubUi },
      '../i18n/HubLanguage': { useHubLanguage: () => ({ language, locale: language === 'en' ? 'en' : 'zh-TW' }) },
      './activityMapModel': model,
      './ActivityMap.module.css': {},
    });
    const page = LoadActivityMapModule('activity-map/page.tsx', {
      '@rehab-trainer/hub-modules/catalog': catalog,
      '../i18n': { zhTW },
      '../seo': { CreateSeoMetadata: ({ path, title, noIndex = false }) => ({ path, title, noIndex }) },
      '../trainingThemeStyle': LoadActivityMapModule('trainingThemeStyle.ts'),
      './ActivityMap': { ActivityMap },
      './activityMapModel': model,
    });
    const view = page.default();
    const html = renderToStaticMarkup(view);
    const ids = Array.from(catalog.trainingCatalog, module => module.runtimeId).sort();
    for (const attribute of ['marker', 'list-item']) {
      assert.deepEqual([...html.matchAll(new RegExp(`data-map-${attribute}="([^"]+)"`, 'g'))].map(match => match[1]).sort(), ids);
    }
    assert.equal([...html.matchAll(/data-map-marker="[^"]+"[^>]*tabindex="0"/g)].length, 1);
    assert.ok(html.includes(dictionary.hubUi.activityMap.selectActivity));
    assert.doesNotMatch(html, /data-map-details=|aria-pressed="true"/);
    for (const entry of view.props.activities) {
      const module = catalog.trainingCatalog.find(game => game.runtimeId === entry.id);
      assert.equal(entry.href, catalog.BuildHubTrainingHref(module));
      assert.equal(entry.neighborIds.length, 3);
      assert.ok(entry.primaryTags.length > 0);
    }
    assert.match(html, language === 'en'
      ? /Closer points represent activities with more similar content\. Positions are calculated from activity tags and do not represent your abilities or practice advice\./
      : /距離越近，活動內容越相近。位置由活動標籤計算，不代表個人能力或練習建議。/);
    assert.doesNotMatch(JSON.stringify(dictionary.hubUi.activityMap), /治療|診斷|療效|改善|提升|處方|評估你的|\b(?:treat(?:ment)?|diagnos\w*|prescri\w*|improv\w*|efficacy|assess your)\b/i);
    assert.deepEqual(page.metadata, { path: '/activity-map/', title: '活動地圖', noIndex: false });
    const error = renderToStaticMarkup(React.createElement(ActivityMap, { activities: null, categories: view.props.categories }));
    assert.match(error, /role="alert"/);
    assert.doesNotMatch(error, /data-map-marker/);
  }
});

test('activity map is included in the public sitemap and built SEO checks', () => {
  const sitemap = LoadActivityMapModule('sitemap.ts', {
    './seo': { siteContentLastModified: '2026-09-02' }, './siteUrls': { siteUrls: { hub: 'https://trainerhub.cc' } },
  });
  assert.equal(sitemap.publicSitemapPaths.filter(path => path === '/activity-map/').length, 1);
  assert.ok(sitemap.default().some(({ url }) => url === 'https://trainerhub.cc/activity-map/'));
  assert.match(readFileSync(new URL('check-seo-output.mjs', import.meta.url), 'utf8'), /['"]activity-map\/['"]/);
});

test('the real admin picker groups every runtime game once and displays its known function tags', async () => {
  const { ReadCatalog } = await import('./recommendation-pipeline.mjs');
  const pipelineCatalog = await ReadCatalog(gamesRoot);
  const runtimeCatalog = LoadRuntimeCatalog();
  const realTaxonomy = ReadData('taxonomy');
  const gameFeatures = ReadData('gameFeatures');
  const { render } = RenderReview(gameFeatures, SimilarGames, runtimeCatalog, realTaxonomy);
  const initial = Elements(render());
  assert.equal(initial.some(element => element.props.role === 'alert'), false);
  const select = initial.find(element => element.type === 'select');
  assert.ok(select);
  const groups = Elements(select).filter(element => element.type === 'optgroup');
  const options = Elements(select).filter(element => element.type === 'option');
  const groupedIds = groups.flatMap(group => {
    assert.ok(group.props.label, 'Every optgroup has a category label');
    return Elements(group).filter(element => element.type === 'option').map(element => element.props.value);
  }).sort();
  assert.deepEqual(groupedIds, options.map(element => element.props.value).sort());
  assert.deepEqual(groupedIds, Array.from(runtimeCatalog.trainingCatalog, game => game.runtimeId).sort());
  assert.deepEqual(groupedIds, pipelineCatalog.map(game => game.id).sort());
  assert.deepEqual(groupedIds, Object.keys(gameFeatures.games).sort());

  const functionDimensions = new Set(realTaxonomy.dimensions.filter(({ group }) => group === 'function').map(({ id }) => id));
  const activeFunctionTags = realTaxonomy.tags.filter(tag => tag.status === 'active' && functionDimensions.has(tag.dimension));
  for (const id of groupedIds) {
    const game = gameFeatures.games[id];
    const primary = activeFunctionTags.find(tag => game.functionTags[tag.id] === 2);
    assert.ok(primary, `${id} needs a known primary function tag`);
    select.props.onChange({ target: { value: id } });
    const selected = VisibleText(render());
    assert.ok(selected.includes(game.evidence[primary.id]), `${id} must display its primary tag evidence`);
    assert.doesNotMatch(selected, /尚無已標註項目/, id);
  }
});

test('admin review picker selects the first game and selecting a neighbor updates the picker and returns focus', () => {
  const review = RenderReview({
    schemaVersion: 2, taxonomyVersion: '2.0.0',
    games: {
      first: { ...Game({ 'focus.control.a': 2, 'focus.control.b': 0 }), reviewStatus: 'confirmed' },
      second: Game({ 'focus.control.a': 2 }),
    },
  });
  const initial = review.render();
  const elements = Elements(initial);
  assert.equal(elements.find(element => element.type === 'select').props.value, 'first');
  assert.equal(elements.filter(element => element.type === 'optgroup').length, 2);
  assert.equal(VisibleText(elements.find(element => element.type === 'p')), '標籤描述活動內容，草稿待確認。');
  assert.match(VisibleText(initial), /審閱狀態 已確認/);
  const functionProfile = elements.find(element => element.type === 'section' && VisibleText(element).includes('功能標籤'));
  const functionText = VisibleText(functionProfile);
  assert.match(functionText, /注意力.*ICF/);
  assert.match(functionText, /注意控制.*主要.*推導.*b140 注意力功能/);
  assert.match(functionText, /目標選取.*主要.*b140 注意力功能.*玩家依提示選擇目標。/);
  assert.match(functionText, /確認未涉及/);
  assert.match(functionText, /尚未標註.*持續注意（b140 注意力功能）/);
  const demandProfile = elements.find(element => element.type === 'section' && VisibleText(element).includes('任務需求'));
  assert.match(VisibleText(demandProfile), /作答節奏.*自行掌握/);
  assert.doesNotMatch(VisibleText(demandProfile), /外部節奏/);
  assert.match(VisibleText(initial), /操作所需裝置/);
  const choice = elements.find(element => element.type === 'button');
  assert.match(VisibleText(choice), /第二項/);
  assert.match(VisibleText(choice), /1\.00/);
  assert.match(VisibleText(initial), /共同標籤.*注意控制.*目標選取/);
  choice.props.onClick();
  assert.equal(review.focused(), true);
  const next = review.render();
  assert.equal(Elements(next).find(element => element.type === 'select').props.value, 'second');
  assert.match(VisibleText(next), /審閱狀態 草稿/);
});

test('admin review shows validation errors and the no-neighbors state', () => {
  const error = RenderReview({ schemaVersion: 2, taxonomyVersion: '2.0.0', games: {} }).render();
  const alert = Elements(error).find(element => element.props.role === 'alert');
  assert.match(VisibleText(alert), /first.*second/);
  assert.equal(Elements(error).some(element => element.type === 'select'), false);
  const confirmed = { ...Game(), reviewStatus: 'confirmed' };
  const empty = RenderReview({
    schemaVersion: 2, taxonomyVersion: '2.0.0', games: { first: confirmed, second: confirmed },
  }, () => []).render();
  assert.equal(VisibleText(Elements(empty).find(element => element.type === 'p')), '標籤描述活動內容，依理論框架標註並已確認。');
  assert.match(VisibleText(empty), /沒有可比較的活動/);
  assert.equal(Elements(empty).some(element => element.type === 'button'), false);
});

test('the similarity tab and its panel are available only to administrators', () => {
  const states = [];
  let hookIndex = 0;
  let role = 'admin';
  const dashboard = LoadAdminComponent('AdminDashboard', {
    react: {
      useState: initial => {
        const index = hookIndex++;
        if (!(index in states)) states[index] = initial;
        return [states[index], value => { states[index] = value; }];
      },
      useRef: () => ({ current: null }),
      useEffect: () => {},
      useCallback: callback => callback,
    },
    '../HubNavigation': { useHubAuth: () => ({ user: role ? { id: 'fixture', role } : null }) },
    '../i18n/HubLanguage': { useHubLanguage: () => ({ language: 'zh-TW' }) },
    '../i18n': { GetHubUiCopy: () => ({ practicePlans: {} }) },
    './GameSimilarityReview.module.css': { adminTabs: 'admin-tabs-module' },
  });
  const render = () => {
    hookIndex = 0;
    return Elements(dashboard());
  };
  const get = (elements, id) => elements.find(element => element.props.id === id);
  const initial = render();
  const tab = get(initial, 'admin-tab-similarity');
  assert.equal(tab.props.role, 'tab');
  assert.equal(tab.props['aria-controls'], 'admin-panel-similarity');
  const icon = Elements(tab).find(element => element.props.className === 'material-symbols-outlined');
  assert.equal(icon?.props.children, 'explore');
  assert.equal(icon.props['aria-hidden'], 'true');
  assert.equal(get(initial, 'admin-panel-similarity').props.hidden, true);
  tab.props.onClick();
  assert.equal(get(render(), 'admin-panel-similarity').props.hidden, false);

  role = 'therapist';
  const staff = render();
  assert.equal(get(staff, 'admin-tab-similarity'), undefined);
  assert.equal(get(staff, 'admin-panel-similarity'), undefined);
  assert.equal(get(staff, 'admin-tab-overview').props['aria-selected'], true);
  for (const tabs of [initial, staff]) {
    assert.equal(
      tabs.find(element => element.props.role === 'tablist')?.props.className,
      'admin-tabs admin-tabs-module',
    );
  }

  role = null;
  const guest = render();
  assert.equal(get(guest, 'admin-tab-similarity'), undefined);
  assert.equal(get(guest, 'admin-panel-similarity'), undefined);
});
