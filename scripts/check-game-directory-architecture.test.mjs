import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import { ParseGameSettingsDefinition } from '../packages/game-settings/src/index.js';

const repositoryRoot = resolve(import.meta.dirname, '..');
const hubRoot = resolve(repositoryRoot, 'apps/rehabtrainerhub');
const gamesRoot = resolve(hubRoot, 'games');
const catalogPath = resolve(hubRoot, 'training-modules/catalog.ts');
const expectedOfficialGameIds = Object.freeze([
  'asteroid-shield',
  'connect4',
  'dots-and-boxes',
  'drawing-defense',
  'driving-rehab',
  'every-ball-response',
  'gabor-patching',
  'gesture-battler',
  'hart-chart',
  'hex',
  'lights-out',
  'maze',
  'memory-match',
  'minesweeper',
  'motor-cortex-rehab',
  'moving-card',
  'oculomotor-training',
  'reaction-time',
  'reading-training',
  'simon-says',
  'sliding-puzzle',
  'sudoku',
  'tic-tac-toe',
  'tongue-catch',
  'ufov',
  'whack-a-mole',
].sort());

test('catalog and game roots retain one exact settings definition per official game', async () => {
  const catalogSource = await readFile(catalogPath, 'utf8');
  const catalogGameIds = ReadCatalogGameIds(catalogSource).sort();
  const gameDirectories = (await readdir(gamesRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  assert.deepEqual(catalogGameIds, expectedOfficialGameIds);
  assert.deepEqual(gameDirectories, expectedOfficialGameIds);
  assert.doesNotMatch(catalogSource, /\/runtimes\//);
  assert.match(catalogSource, /settingsPath: `\/games\/\$\{seed\.id\}\/settings\.json`/);
  assert.match(catalogSource, /return `\/games\/\$\{encodeURIComponent\(module\.runtimeId\)\}\//);

  const fieldTypes = new Set();
  for (const gameId of gameDirectories) {
    const settingsPath = resolve(gamesRoot, gameId, 'settings.json');
    const definition = ParseGameSettingsDefinition(
      JSON.parse(await readFile(settingsPath, 'utf8')),
      gameId,
    );
    for (const section of definition.sections) {
      for (const field of section.fields) fieldTypes.add(field.type);
    }
  }
  assert.deepEqual([...fieldTypes].sort(), ['checkbox', 'list', 'slider']);
});

test('Hub builds per-game outputs and cannot restore a public trainer runtime', async () => {
  const hubPackage = JSON.parse(await readFile(resolve(hubRoot, 'package.json'), 'utf8'));
  assert.match(
    hubPackage.scripts.build,
    /build-official-game-shells\.mjs.*emit-official-game-pwas\.mjs out.*check-built-game-architecture\.mjs out/,
  );
  await assert.rejects(access(resolve(hubRoot, 'scripts/build-training-runtimes.mjs')));

  const buildSource = await readFile(resolve(hubRoot, 'scripts/build-official-game-shells.mjs'), 'utf8');
  assert.match(buildSource, /\.official-game-shells/);
  assert.doesNotMatch(
    buildSource,
    /out[\\/]runtimes|resolve\(outputRoot,\s*['"]runtimes['"]\)/,
  );

  for (const adapter of ['brain', 'motor', 'mouth', 'vision']) {
    const config = await readFile(
      resolve(hubRoot, 'training-runtimes', adapter, 'vite.config.ts'),
      'utf8',
    );
    assert.match(config, /base:\s*['"]\.\/['"]/);
    assert.match(config, new RegExp(`out/\\.official-game-shells/${adapter}`));
    assert.doesNotMatch(config, /out[\\/]runtimes|\/runtimes\//);
  }

  const emitter = await readFile(resolve(repositoryRoot, 'scripts/emit-official-game-pwas.mjs'), 'utf8');
  assert.match(emitter, /const gamesDirectory = resolve\(outputDirectory, 'games'\)/);
  assert.match(emitter, /ParseGameSettingsDefinition\(JSON\.parse\(settingsSource\), game\.id\)/);
  assert.match(emitter, /writeFile\(resolve\(gameDirectory, 'settings\.json'\), settingsSource\)/);
  assert.match(emitter, /await rm\(shellsDirectory, \{ recursive: true, force: true \}\)/);
  assert.doesNotMatch(emitter, /resolve\(outputDirectory, 'runtimes'\)/);
});

test('root builds and both Cloudflare workflows retain the architecture gate', async () => {
  const rootPackage = JSON.parse(await readFile(resolve(repositoryRoot, 'package.json'), 'utf8'));
  assert.match(rootPackage.scripts.build, /npm run test:game-architecture/);
  assert.match(rootPackage.scripts['build:cloudflare'], /npm run test:game-architecture/);
  assert.equal(
    rootPackage.scripts['test:game-architecture'],
    'node --test scripts/check-game-directory-architecture.test.mjs',
  );
  assert.equal(
    rootPackage.scripts['test:game-architecture:built'],
    'node scripts/check-built-game-architecture.mjs apps/rehabtrainerhub/out',
  );
  assert.equal(
    rootPackage.scripts['test:game-architecture:browser'],
    'node --test scripts/check-game-architecture-browser.test.mjs',
  );

  for (const workflowPath of [
    '.github/workflows/ci.yml',
    '.github/workflows/deploy-cloudflare-pages.yml',
  ]) {
    const workflow = await readFile(resolve(repositoryRoot, workflowPath), 'utf8');
    assert.equal((workflow.match(/command: npm run test:game-architecture/g) ?? []).length, 1);
    const installSteps = workflow.match(/run: npm ci[^\r\n]*/g) ?? [];
    assert.ok(installSteps.length > 0, `${workflowPath} must install dependencies.`);
    assert.equal(
      installSteps.every((step) => step === 'run: npm ci --workspaces --include-workspace-root'),
      true,
      `${workflowPath} must install root Vite/runtime dependencies as well as workspaces.`,
    );
    assert.match(workflow, /- "scripts\/\*\*"/);
    assert.match(workflow, /- "\.github\/workflows\/\*\*"/);
  }
});

test('browser smoke checks retain Brave support on Windows', async () => {
  for (const scriptPath of [
    'scripts/check-browser-route-smoke.mjs',
    'scripts/check-driving-rehab-browser.mjs',
    'scripts/check-oculomotor-webgazer-browser.mjs',
  ]) {
    const source = await readFile(resolve(repositoryRoot, scriptPath), 'utf8');
    const bravePath = 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe';
    assert.match(source, /process\.env\.BRAVE_BIN/);
    assert.ok(source.indexOf(bravePath) >= 0, `${scriptPath} must recognize Windows Brave.`);
    assert.match(source, /\['brave',\s*'msedge'/);
  }
});

test('unified config UI remains Tailwind plus shadcn/Radix and mounts inside dialogs', async () => {
  const form = await ReadHub('app/train/GameSettingsForm.tsx');
  for (const component of ['Button', 'Checkbox', 'Select', 'Slider']) {
    assert.match(form, new RegExp(`\\b${component}\\b`));
  }
  for (const fieldType of ['checkbox', 'slider']) {
    assert.match(form, new RegExp(`field\\.type === '${fieldType}'`));
  }
  assert.match(form, /<Select\b/);
  assert.match(form, /NormalizeGameSettingsValues\(definition, values\)/);
  assert.match(form, /portalContainer=\{portalContainer\}/);
  assert.match(form, /var\(--(?:background|surface|primary|border|text)/);

  const button = await ReadHub('app/components/ui/button.tsx');
  const checkbox = await ReadHub('app/components/ui/checkbox.tsx');
  const select = await ReadHub('app/components/ui/select.tsx');
  const slider = await ReadHub('app/components/ui/slider.tsx');
  assert.match(button, /class-variance-authority/);
  assert.match(button, /buttonVariants = cva/);
  assert.match(checkbox, /@radix-ui\/react-checkbox/);
  assert.match(select, /@radix-ui\/react-select/);
  assert.match(select, /SelectPrimitive\.Portal container=\{portalContainer \?\? undefined\}/);
  assert.match(slider, /@radix-ui\/react-slider/);

  const postcss = await ReadHub('postcss.config.mjs');
  const globals = await ReadHub('app/globals.css');
  assert.match(postcss, /['"]@tailwindcss\/postcss['"]/);
  assert.match(globals, /@import "tailwindcss\/theme\.css" layer\(theme\)/);
  assert.match(globals, /@import "tailwindcss\/utilities\.css" layer\(utilities\)/);
  assert.doesNotMatch(globals, /tailwindcss\/preflight|@import\s+["']tailwindcss["']/);
});

test('both official and developer overlays configure before mounting their iframe', async () => {
  const officialOverlay = await ReadHub('app/train/TrainingOverlay.tsx');
  const packageOverlay = await ReadHub('app/train/PackageGameOverlay.tsx');

  assert.equal((officialOverlay.match(/<iframe\b/g) ?? []).length, 1);
  assert.match(officialOverlay, /fetch\(BuildTrainingModuleSettingsHref\(module\)/);
  assert.match(officialOverlay, /ParseGameSettingsDefinition\(await response\.json\(\), module\.runtimeId\)/);
  assert.match(officialOverlay, /\{!configuredSettings && definition && \([\s\S]*?<GameSettingsForm/);
  assert.match(officialOverlay, /\{configuredSettings && \([\s\S]*?<iframe/);
  assert.match(officialOverlay, /CreateHubGameSettingsMessage\(module\.runtimeId, sessionNonce, configuredSettings\)/);
  assert.match(officialOverlay, /IsHubTrainingConfigureMessage\(event\.data\)/);
  assert.match(officialOverlay, /setConfiguredSettings\(null\)/);
  assert.match(officialOverlay, /new URL\(BuildTrainingModuleHref\(module\), window\.location\.origin\)/);

  assert.equal((packageOverlay.match(/<iframe\b/g) ?? []).length, 1);
  assert.match(packageOverlay, /fetch\(game\.release\.settingsUrl/);
  assert.match(packageOverlay, /ParseGameSettingsDefinition\(await response\.json\(\), game\.slug\)/);
  assert.match(packageOverlay, /\{!configuredSettings && definition && \([\s\S]*?<GameSettingsForm/);
  assert.match(packageOverlay, /\{configuredSettings && <>[\s\S]*?<iframe/);
  assert.match(packageOverlay, /CreateGamePlatformRunnerSettingsMessage\([\s\S]*configuredSettings/);
  assert.match(packageOverlay, /sandbox="allow-scripts"/);
  assert.doesNotMatch(GetIframeOpeningTag(packageOverlay), /allow-same-origin|allow-top-navigation/);
});

test('all four compatibility adapters install the verified settings receiver', async () => {
  for (const adapter of ['brain', 'motor', 'mouth', 'vision']) {
    const main = await ReadHub(`training-runtimes/${adapter}/src/main.tsx`);
    assert.match(main, /InstallHostedGameSettingsReceiver\(\)/);
  }
});

async function ReadHub(relativePath) {
  return readFile(resolve(hubRoot, relativePath), 'utf8');
}

function GetIframeOpeningTag(source) {
  const match = source.match(/<iframe\b[\s\S]*?\/>/);
  assert.ok(match, 'Expected one iframe opening tag.');
  return match[0];
}

function ReadCatalogGameIds(source) {
  const sourceFile = ts.createSourceFile('catalog.ts', source, ts.ScriptTarget.Latest, true);
  let seedArray = null;
  sourceFile.forEachChild((node) => {
    if (!ts.isVariableStatement(node)) return;
    for (const declaration of node.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === 'seeds') {
        seedArray = UnwrapExpression(declaration.initializer);
      }
    }
  });
  assert.ok(seedArray && ts.isArrayLiteralExpression(seedArray), 'Catalog seeds must be an array literal.');
  return seedArray.elements.map((element) => {
    const object = UnwrapExpression(element);
    assert.ok(ts.isObjectLiteralExpression(object), 'Each catalog seed must be an object literal.');
    const property = object.properties.find((candidate) => (
      ts.isPropertyAssignment(candidate)
      && ts.isIdentifier(candidate.name)
      && candidate.name.text === 'id'
    ));
    assert.ok(property && ts.isPropertyAssignment(property), 'Each catalog seed must have an id.');
    const value = UnwrapExpression(property.initializer);
    assert.ok(ts.isStringLiteral(value), 'Catalog game IDs must be string literals.');
    return value.text;
  });
}

function UnwrapExpression(node) {
  let current = node;
  while (current && (ts.isAsExpression(current)
    || ts.isSatisfiesExpression(current)
    || ts.isParenthesizedExpression(current)
    || ts.isTypeAssertionExpression(current))) {
    current = current.expression;
  }
  return current;
}
