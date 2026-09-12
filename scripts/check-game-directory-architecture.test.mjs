import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import { ParseGameSettingsDefinition } from '../packages/game-settings/src/index.js';

const repositoryRoot = resolve(import.meta.dirname, '..');
const hubRoot = resolve(repositoryRoot, 'apps/rehabtrainerhub');
const gamesRoot = resolve(hubRoot, 'games');
const catalogPath = resolve(hubRoot, 'games/catalog.ts');
const expectedOfficialGameIds = Object.freeze([
  'antisaccade',
  'asteroid-shield',
  'attention-network-task',
  'connect4',
  'digit-span',
  'dots-and-boxes',
  'drawing-defense',
  'driving-rehab',
  'every-ball-response',
  'flanker',
  'gabor-patching',
  'gesture-battler',
  'go-nogo',
  'hart-chart',
  'hex',
  'keep-track',
  'letter-memory',
  'lights-out',
  'maze',
  'memory-match',
  'minesweeper',
  'motor-cortex-rehab',
  'moving-card',
  'n-back',
  'number-letter',
  'oculomotor-training',
  'plus-minus',
  'reaction-time',
  'reading-training',
  'simon-says',
  'sliding-puzzle',
  'spatial-span',
  'stop-signal',
  'stroop',
  'sudoku',
  'tic-tac-toe',
  'tongue-catch',
  'tower-of-london',
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
  await assert.rejects(access(resolve(gamesRoot, '_shared')), 'games/_shared directory must not exist');
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
  assert.deepEqual([...fieldTypes].sort(), ['checkbox', 'color', 'list', 'slider']);
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

  await assert.rejects(access(resolve(hubRoot, 'training-modules')));
  await assert.rejects(access(resolve(hubRoot, 'training-runtimes')));

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
    'tsc -p apps/rehabtrainerhub/tsconfig.games.json && node --test scripts/check-game-directory-architecture.test.mjs scripts/check-drawing-defense-input.test.mjs scripts/check-game-input-layouts.test.mjs',
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
  const form = await ReadUi('components/GameSettingsForm.tsx');
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

  const button = await ReadUi('components/ui/button.tsx');
  const checkbox = await ReadUi('components/ui/checkbox.tsx');
  const select = await ReadUi('components/ui/select.tsx');
  const slider = await ReadUi('components/ui/slider.tsx');
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
  assert.match(officialOverlay, /\{configuredSettings && !score && \([\s\S]*?<iframe/);
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

test('all official games install the verified settings receiver', async () => {
  for (const gameId of expectedOfficialGameIds) {
    const main = await readFile(resolve(gamesRoot, gameId, 'main.tsx'), 'utf8');
    assert.match(main, /InstallHostedGameSettingsReceiver\(\)/);
    assert.match(main, /<OfficialGameShell settings=\{settings\} score=\{score\}/);
    assert.match(main, /from ['"]\.\/score\.json['"]/);
    await access(resolve(gamesRoot, gameId, 'score.json'));
    assert.match(main, /<LanguageProvider dictionaries=\{dictionaries\}/);
    assert.match(main, /from ['"]\.\/settings\.json['"]/);
    await access(resolve(gamesRoot, gameId, 'i18n/zh.ts'));
    await access(resolve(gamesRoot, gameId, 'i18n/en.ts'));
  }
});

test('official games have no Toutour dependency and own their rules styles', async () => {
  const nativeRules = ['moving-card', 'oculomotor-training', 'gabor-patching', 'reading-training', 'hart-chart', 'ufov'];
  assert.doesNotMatch(await ReadUi('components/TrainerApp.css'), /\.training-rule/);
  for (const gameId of expectedOfficialGameIds) {
    const main = await readFile(resolve(gamesRoot, gameId, 'main.tsx'), 'utf8');
    assert.doesNotMatch(main, /GameTour|from ['"]\.\/tour['"]/);
    await assert.rejects(access(resolve(gamesRoot, gameId, 'tour.tsx')));
    const files = await readdir(resolve(gamesRoot, gameId));
    if (files.includes('rules.css')) {
      assert.match(main, /import ['"]\.\/rules.css['"]/);
      await access(resolve(gamesRoot, gameId, 'rules.css'));
    } else if (!nativeRules.includes(gameId)) {
      await access(resolve(gamesRoot, gameId, 'public/legacy/rehab-bridge.js'));
    }
  }
  const shell = await ReadUi('components/ExpFactoryGame.tsx');
  assert.doesNotMatch(shell, /tourComplete|game-tour-complete/);
  await access(resolve(hubRoot, 'app/tour/hubTour.ts'));
});

test('transitive game imports keep engines and dictionaries within their game', async () => {
  const configPath = resolve(hubRoot, 'tsconfig.games.json');
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  const { options } = ts.parseJsonConfigFileContent(config.config, ts.sys, hubRoot);
  for (const gameId of expectedOfficialGameIds) {
    const seen = new Set();
    async function Visit(file) {
      file = resolve(file);
      if (seen.has(file) || file.includes('node_modules')) return;
      seen.add(file);
      const fromGames = relative(gamesRoot, file).replaceAll('\\', '/');
      if (!fromGames.startsWith('../') && fromGames.includes('/')) {
        assert.equal(fromGames.split('/')[0], gameId, `${gameId} imports another game: ${fromGames}`);
      }
      if (!/\.[cm]?[jt]sx?$/.test(file)) return;
      const source = await readFile(file, 'utf8');
      const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
      const imports = [];
      const assets = [];
      function Walk(node) {
        let specifier;
        if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) specifier = node.moduleSpecifier;
        if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) specifier = node.arguments[0];
        if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) specifier = node.argument.literal;
        if (specifier && ts.isStringLiteralLike(specifier)) imports.push(specifier.text);
        if (ts.isNewExpression(node) && node.expression.getText(tree) === 'URL' && node.arguments?.length === 2
          && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text.startsWith('.')
          && node.arguments[1].getText(tree) === 'import.meta.url') assets.push(node.arguments[0].text);
        ts.forEachChild(node, Walk);
      }
      Walk(tree);
      for (const asset of assets) {
        const target = resolve(dirname(file), asset);
        if (!fromGames.startsWith('../')) assert.ok(!relative(resolve(gamesRoot, gameId), target).startsWith('..'), `${gameId} imports another game's asset: ${target}`);
        await access(target);
      }
      for (const specifier of imports) {
        if (file.includes(`${resolve(repositoryRoot, 'packages/ui/src')}`)) {
          assert.doesNotMatch(specifier, /^(?:pixi\.js|jspsych|three|@jspsych\/|@mediapipe\/|@tensorflow\/)/, `Shared shell imports a game engine: ${file}`);
        }
        const target = ts.resolveModuleName(specifier, file, options, ts.sys).resolvedModule?.resolvedFileName
          ?? (specifier.startsWith('.') && ts.sys.fileExists(resolve(dirname(file), specifier)) ? resolve(dirname(file), specifier) : null);
        if (target) await Visit(target);
      }
    }
    await Visit(resolve(gamesRoot, gameId, 'main.tsx'));
  }
  for (const retired of ['cognitive/ReferenceCognitiveGame.tsx', 'pixiPool.ts', 'jsPsychLifecycle.ts', 'i18n/games/vision/zh.ts']) {
    await assert.rejects(access(resolve(repositoryRoot, 'packages/ui/src', retired)));
  }
});

async function ReadHub(relativePath) {
  return readFile(resolve(hubRoot, relativePath), 'utf8');
}

test('settings getters declare the JSON value type before runtime conversion', async () => {
  const config = ts.readConfigFile(resolve(hubRoot, 'tsconfig.games.json'), ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, hubRoot);
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const checker = program.getTypeChecker();
  const definitions = new Map(await Promise.all(expectedOfficialGameIds.map(async id => [id, JSON.parse(await readFile(resolve(gamesRoot, id, 'settings.json'), 'utf8')).sections.flatMap(section => section.fields)])));
  for (const source of program.getSourceFiles()) {
    const gameId = relative(gamesRoot, source.fileName).replaceAll('\\', '/').split('/')[0];
    const fields = definitions.get(gameId);
    if (!fields) continue;
    function Visit(node) {
      if (ts.isCallExpression(node) && node.expression.getText(source) === 'GetHostedGameSetting' && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
        const key = node.arguments[0].text;
        const field = fields.find(candidate => candidate.key === key);
        assert.ok(field, `${gameId}: unknown settings key ${key}`);
        const type = checker.getTypeAtLocation(node);
        const types = type.isUnion() ? type.types : [type];
        for (const value of field.options?.map(option => option.value) ?? [field.default]) {
          const accepts = types.some(item => item.isLiteral() ? item.value === value
            : (item.flags & ts.TypeFlags.String) && typeof value === 'string'
              || (item.flags & ts.TypeFlags.Number) && typeof value === 'number'
              || (item.flags & ts.TypeFlags.BooleanLike) && typeof value === 'boolean');
          assert.ok(accepts, `${gameId}.${key}: JSON ${JSON.stringify(value)} is not ${checker.typeToString(type)}`);
        }
      }
      ts.forEachChild(node, Visit);
    }
    Visit(source);
  }
});

async function ReadUi(relativePath) {
  return readFile(resolve(repositoryRoot, 'packages/ui/src', relativePath), 'utf8');
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
