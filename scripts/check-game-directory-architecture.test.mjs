import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { access, mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, relative, resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import { ParseGameSettingsDefinition } from '../packages/game-settings/src/index.js';

const repositoryRoot = resolve(import.meta.dirname, '..');
const hubRoot = resolve(repositoryRoot, 'apps/rehabtrainerhub');
const gamesRoot = resolve(hubRoot, 'games');
const catalogPath = resolve(hubRoot, 'games/catalog.ts');
const migratedGames = JSON.parse(await readFile(resolve(repositoryRoot, 'packages/ui/src/officialGameReleases.json'), 'utf8'));
// The R2 release registry is the game inventory: a newly registered game joins every check below, and
// the catalog test fails when the game folders, catalog entries and registry entries differ.
const expectedOfficialGameIds = Object.freeze(Object.keys(migratedGames).sort());

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
    if (Object.hasOwn(migratedGames, gameId)) {
      await assert.rejects(access(resolve(gamesRoot, gameId, 'settings.json')));
      await assert.rejects(access(resolve(gamesRoot, gameId, 'score.json')));
      continue;
    }
    const settingsPath = resolve(gamesRoot, gameId, 'settings.json');
    const definition = ParseGameSettingsDefinition(
      JSON.parse(await readFile(settingsPath, 'utf8')),
      gameId,
    );
    for (const section of definition.sections) {
      for (const field of section.fields) fieldTypes.add(field.type);
    }
  }
  // Tongue Catch took the last settings.json with it; every official game now shows its own settings form.
  assert.deepEqual([...fieldTypes], []);
});

test('the developer guide describes built-in games as self-contained R2 packages', async () => {
  for (const file of ['app/developer/DeveloperGuide.tsx', 'app/developer/developerCopy.ts']) {
    const source = await ReadHub(file);
    // settings.json and score.json now belong to third-party packages only.
    for (const stale of [/OfficialGameShell/, /必須同時擁有 settings\.json/, /owns both settings\.json/, /兩條開發路徑都需要/, /Both development paths use settings\.json/,
      /原生與內建遊戲/, /native and built-in results/, /Native submissions and built-in games use score\.json/, /Built-in games only/, /共用 Hub 結果畫面/, /shared Hub result view/]) {
      assert.doesNotMatch(source, stale, `${file} still describes built-in games with the legacy files: ${stale}`);
    }
    assert.match(source, /public\/game\.json/, `${file} names the catalog file a built-in game owns`);
  }
});

test('the settings scaffold cannot put a settings.json back into an R2 game', async () => {
  // Every official game is on R2, so running the old scaffold must write nothing.
  const scaffold = await readFile(resolve(repositoryRoot, 'scripts/scaffold-official-game-settings.mjs'), 'utf8');
  assert.match(scaffold, /officialGameReleases\.json/);
  assert.match(scaffold, /if \(Object\.hasOwn\(officialGameReleases, gameId\)\) continue;/);
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
    'tsc -p apps/rehabtrainerhub/tsconfig.games.json && node --test scripts/check-game-directory-architecture.test.mjs scripts/check-drawing-defense-input.test.mjs scripts/check-game-input-layouts.test.mjs scripts/check-self-contained-game.test.mjs scripts/check-asteroid-shield-migration.test.mjs scripts/check-moving-card-migration.test.mjs scripts/check-moving-card-tutorial.test.mjs scripts/check-gesture-battler-tutorial.test.mjs scripts/check-gesture-battler-migration.test.mjs scripts/check-motor-cortex-migration.test.mjs scripts/check-motor-cortex-tutorial.test.mjs scripts/check-motor-cortex-bridge.test.mjs scripts/check-game-catalog-metadata.test.mjs scripts/publish-official-game.test.mjs scripts/check-oculomotor-migration.test.mjs scripts/check-oculomotor-tutorial.test.mjs scripts/check-gabor-patching-migration.test.mjs scripts/check-gabor-patching-tutorial.test.mjs scripts/check-reading-training-migration.test.mjs scripts/check-reading-training-tutorial.test.mjs scripts/check-r2-settings-controls.test.mjs scripts/check-r2-settings-memory.test.mjs scripts/check-driving-rehab-migration.test.mjs scripts/check-driving-pixel-view.test.mjs scripts/check-driving-rehab-tutorial.test.mjs',
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

const ciWorkflowPaths = ['.github/workflows/ci.yml', '.github/workflows/deploy-cloudflare-pages.yml'];

test('CI test discovery follows what a workflow runs and ignores comments, strings and script arguments', async () => {
  const { FindCiTestFiles } = await import('./ci-test-files.mjs');
  const fixture = await mkdtemp(resolve(tmpdir(), 'ci-test-files-'));
  const files = {
    'package.json': JSON.stringify({ scripts: {
      'test:all': 'node --test scripts/a.test.mjs "lib/**/*.test.mjs" && node --test-reporter spec --test scripts/reporter.test.mjs && npm run test:more',
      'test:more': 'node scripts/runner.mjs scripts/argument.test.mjs --test scripts/after.test.mjs',
      'test:local': 'node --test scripts/local.test.mjs',
      'test:other': 'node --test scripts/other.test.mjs',
    } }),
    // CRLF, as in the checked-in deploy workflow.
    '.github/workflows/ci.yml': ('jobs:\n  verify:\n    strategy:\n      matrix:\n        include:\n          - name: all\n            command: npm run test:all\n'
      + '          # - name: local\n          #   command: npm run test:local\n').replaceAll('\n', '\r\n'),
    '.github/workflows/other.yml': 'jobs:\n  verify:\n    strategy:\n      matrix:\n        include:\n          - name: other\n            command: npm run test:other\n',
    'scripts/a.test.mjs': "import './b.test.mjs';\n// import './commented.test.mjs';\n/* import './block.test.mjs'; */\n"
      + "const text = \"import './string.test.mjs'\";\nconst pattern = /import('.\\/regex.test.mjs')/;\n",
    'scripts/b.test.mjs': '',
    'lib/deep/c.test.mjs': '',
    'scripts/runner.mjs': "await import('./d.test.mjs');\n",
    'scripts/d.test.mjs': '',
    'scripts/reporter.test.mjs': '',
    'scripts/argument.test.mjs': '',
    'scripts/after.test.mjs': '',
    'scripts/regex.test.mjs': '',
    'scripts/commented.test.mjs': '',
    'scripts/block.test.mjs': '',
    'scripts/string.test.mjs': '',
    'scripts/local.test.mjs': '',
    'scripts/other.test.mjs': '',
    'scripts/orphan.test.mjs': '',
  };
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(resolve(fixture, path)), { recursive: true });
    await writeFile(resolve(fixture, path), content);
  }
  const reached = FindCiTestFiles(fixture, '.github/workflows/ci.yml');
  for (const path of ['scripts/a.test.mjs', 'scripts/b.test.mjs', 'lib/deep/c.test.mjs', 'scripts/d.test.mjs', 'scripts/reporter.test.mjs']) {
    assert.ok(reached.has(path), `${path} runs in CI`);
  }
  for (const path of ['scripts/argument.test.mjs', 'scripts/after.test.mjs', 'scripts/regex.test.mjs', 'scripts/commented.test.mjs', 'scripts/block.test.mjs', 'scripts/string.test.mjs',
    'scripts/local.test.mjs', 'scripts/other.test.mjs', 'scripts/orphan.test.mjs']) {
    assert.equal(reached.has(path), false, `${path} does not run in this workflow`);
  }
  assert.ok(FindCiTestFiles(fixture, '.github/workflows/other.yml').has('scripts/other.test.mjs'));
});

test('every test file runs in each CI workflow except the documented local-only suites', async () => {
  const { FindCiTestFiles } = await import('./ci-test-files.mjs');
  const rootPackage = JSON.parse(await readFile(resolve(repositoryRoot, 'package.json'), 'utf8'));
  // These need a local Brave or the SEO build and stay out of the Linux matrix (AGENTS.md, CI/CD).
  const localOnly = {
    'scripts/check-article-prerender.test.mjs': 'test:seo',
    'scripts/check-game-architecture-browser.test.mjs': 'test:game-architecture:browser',
  };
  const testFiles = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', '*.test.mjs'],
    { cwd: repositoryRoot, encoding: 'utf8' }).split('\0').filter(path => path && existsSync(resolve(repositoryRoot, path)));
  for (const workflowPath of ciWorkflowPaths) {
    const reached = FindCiTestFiles(repositoryRoot, workflowPath);
    assert.deepEqual(
      testFiles.filter(path => !reached.has(path)).sort(),
      Object.keys(localOnly).sort(),
      `${workflowPath}: run each new test file from a CI gate command, or import it from a suite that already runs there.`,
    );
  }
  for (const [path, script] of Object.entries(localOnly)) assert.ok(rootPackage.scripts[script].includes(path), `${script} runs ${path}`);
});

test('every R2 game has its own test suite in each CI workflow', async () => {
  const { FindCiTestFiles } = await import('./ci-test-files.mjs');
  // Games migrated before the scripts/check-<gameId>-game.test.mjs convention keep their migration suite.
  const ownSuites = {
    'asteroid-shield': 'scripts/check-asteroid-shield-migration.test.mjs',
    'drawing-defense': 'scripts/check-drawing-defense-input.test.mjs',
    'driving-rehab': 'scripts/check-driving-rehab-migration.test.mjs',
    'gabor-patching': 'scripts/check-gabor-patching-migration.test.mjs',
    'gesture-battler': 'scripts/check-gesture-battler-migration.test.mjs',
    'hart-chart': 'scripts/check-hart-chart-migration.test.mjs',
    'motor-cortex-rehab': 'scripts/check-motor-cortex-migration.test.mjs',
    'moving-card': 'scripts/check-moving-card-migration.test.mjs',
    'oculomotor-training': 'scripts/check-oculomotor-migration.test.mjs',
    'reading-training': 'scripts/check-reading-training-migration.test.mjs',
  };
  for (const workflowPath of ciWorkflowPaths) {
    const reached = FindCiTestFiles(repositoryRoot, workflowPath);
    const missing = expectedOfficialGameIds.filter(gameId => !reached.has(ownSuites[gameId] ?? `scripts/check-${gameId}-game.test.mjs`));
    assert.deepEqual(missing, [], `${workflowPath}: add scripts/check-<gameId>-game.test.mjs and run it from a CI gate.`);
  }
});

test('browser smoke checks retain Brave support on Windows and macOS', async () => {
  const windowsBravePath = 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe';
  const macBravePath = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
  for (const scriptPath of [
    'scripts/check-browser-route-smoke.mjs',
    'scripts/check-driving-rehab-browser.mjs',
    'scripts/check-r2-game-browser.mjs',
  ]) {
    const source = await readFile(resolve(repositoryRoot, scriptPath), 'utf8');
    assert.match(source, /process\.env\.BRAVE_BIN/);
    assert.ok(source.includes(windowsBravePath), `${scriptPath} must recognize Windows Brave.`);
    assert.ok(source.includes(macBravePath), `${scriptPath} must recognize macOS Brave.`);
    assert.match(source, /\['brave',\s*'msedge'/);
  }

  const architectureBrowser = await readFile(
    resolve(repositoryRoot, 'scripts/check-game-architecture-browser.test.mjs'),
    'utf8',
  );
  assert.match(architectureBrowser, /process\.env\.BRAVE_BIN/);
  assert.ok(architectureBrowser.includes(windowsBravePath));
  assert.ok(architectureBrowser.includes(macBravePath));
});

test('unified config UI remains Tailwind with native accessible controls', async () => {
  const form = await ReadUi('components/GameSettingsForm.tsx');
  for (const fieldType of ['checkbox', 'slider']) {
    assert.match(form, new RegExp(`field\\.type === '${fieldType}'`));
  }
  assert.match(form, /type="checkbox"/);
  assert.match(form, /type="range"/);
  assert.match(form, /<select\b/);
  assert.match(form, /NormalizeGameSettingsValues\(definition, values\)/);
  assert.match(form, /var\(--(?:background|surface|primary|border|text)/);

  const button = await ReadUi('components/ui/button.tsx');
  assert.match(button, /variantClassNames/);
  assert.doesNotMatch(button, /class-variance-authority/);

  const postcss = await ReadHub('postcss.config.mjs');
  const globals = await ReadHub('app/globals.css');
  assert.match(postcss, /['"]@tailwindcss\/postcss['"]/);
  assert.match(globals, /@import "tailwindcss\/theme\.css" layer\(theme\)/);
  assert.match(globals, /@import "tailwindcss\/utilities\.css" layer\(utilities\)/);
  assert.doesNotMatch(globals, /tailwindcss\/preflight|@import\s+["']tailwindcss["']/);
});

test('legacy game pages define every token the settings form uses', async () => {
  // GameSettingsForm is written with the Hub's token names; the two legacy game pages only have the trainer theme.
  const used = new Set();
  for (const file of ['components/GameSettingsForm.tsx', 'components/ui/button.tsx']) {
    for (const match of (await ReadUi(file)).matchAll(/var\(--([a-z0-9-]+)/g)) used.add(match[1]);
  }
  const defined = new Set([...(await ReadUi('trainerTheme.ts')).matchAll(/'--([a-z0-9-]+)':/g)].map(match => match[1]));
  for (const match of (await ReadUi('components/GameSettings.css')).matchAll(/--([a-z0-9-]+):/g)) defined.add(match[1]);
  assert.deepEqual([...used].filter(name => !defined.has(name)).sort(), []);
  // These pages load no icon font, so a decorative icon would show its ligature name ("play_arrow") as text.
  assert.match(await ReadUi('components/GameSettings.css'), /\.game-settings-form \.material-symbols-outlined \{\s*display: none;/);
  assert.match(await ReadUi('components/OfficialGameShell.tsx'), /ApplyThemeTokens\(document\.documentElement, theme\)/);
});

test('legacy game pages head the settings form with the catalog name in the page language', async () => {
  // The browser tab title is Chinese only; the form heading comes from the game's own dictionaries instead.
  const catalog = await ReadHub('games/catalog.ts');
  // No legacy page is left; the check stays for any game that goes back to the shell.
  const legacyPages = [];
  for (const gameId of expectedOfficialGameIds) {
    if ((await ReadHub(`games/${gameId}/main.tsx`)).includes('<OfficialGameShell')) legacyPages.push(gameId);
  }
  assert.deepEqual(legacyPages, []);
  for (const gameId of legacyPages) {
    const titleKey = (await ReadHub(`games/${gameId}/main.tsx`)).match(/<OfficialGameShell\b[^>]*\btitleKey="([^"]+)"/)?.[1];
    assert.ok(titleKey, `${gameId} names its heading key`);
    const names = catalog.match(new RegExp(`id: '${gameId}',[\\s\\S]*?zh: \\['([^']+)'[\\s\\S]*?en: \\['([^']+)'`));
    for (const [language, expected] of [['zh', names[1]], ['en', names[2]]]) {
      const dictionary = await ReadHub(`games/${gameId}/i18n/${language}.ts`);
      assert.equal(dictionary.match(new RegExp(`"${titleKey.replaceAll('.', '\\.')}": "([^"]+)"`))?.[1], expected, `${gameId} ${language}`);
    }
  }
  assert.match(await ReadUi('components/OfficialGameShell.tsx'), /title=\{t\(titleKey\)\}/);
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
  // The settings form says why the game went back (for example a blocked camera), in the Hub's own wording.
  assert.match(officialOverlay, /setConfigureReason\(GetHubTrainingConfigureReason\(event\.data\)\)/);
  assert.match(officialOverlay, /<GameSettingsForm[\s\S]*?notice=\{configureReason\}/);
  const shell = await ReadUi('components/OfficialGameShell.tsx');
  assert.match(shell, /IsHubTrainingConfigureReason\(reason\)/);
  assert.match(shell, /<GameSettingsForm[\s\S]*?notice=\{notice\}/);
  const form = await ReadUi('components/GameSettingsForm.tsx');
  assert.match(form, /role="alert"/);
  assert.match(officialOverlay, /new URL\(BuildTrainingModuleHref\(module\), window\.location\.origin\)/);

  assert.equal((packageOverlay.match(/<iframe\b/g) ?? []).length, 1);
  assert.match(packageOverlay, /const settingsUrl = game\.release\.settingsUrl/);
  assert.match(packageOverlay, /if \(!settingsUrl\)[\s\S]*?setSettingsError\(true\)/);
  assert.match(packageOverlay, /fetch\(settingsUrl/);
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
    if (Object.hasOwn(migratedGames, gameId)) {
      assert.match(main, /InstallHubBridge\(\)/);
      assert.doesNotMatch(main, /@rehab-trainer\/|settings\.json|score\.json/);
      continue;
    }
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
      await access(resolve(gamesRoot, gameId, 'public/runtime/manifest.json'));
    }
  }
  await access(resolve(hubRoot, 'app/tour/hubTour.ts'));
});

test('tutorial copies of buttons share the base button border', async () => {
  for (const gameId of expectedOfficialGameIds) {
    const rulesRoot = resolve(gamesRoot, gameId, 'rules');
    const files = await readdir(rulesRoot).catch(() => []);
    const sources = await Promise.all(files.filter((file) => file.endsWith('.tsx')).map((file) => readFile(resolve(rulesRoot, file), 'utf8')));
    if (!sources.some((source) => /<span className="btn\b/.test(source))) continue;
    const css = await readFile(resolve(gamesRoot, gameId, 'game.css'), 'utf8');
    assert.match(css, /^button, span\.btn \{[^}]*border:/m, `${gameId}: the tutorial span.btn must get the base button border.`);
  }
});

test('the retired ExpFactory shell stays out of the shared UI package', async () => {
  const uiPackage = JSON.parse(await readFile(resolve(repositoryRoot, 'packages/ui/package.json'), 'utf8'));
  assert.ok(!Object.keys(uiPackage.exports).some((path) => /ExpFactory/i.test(path)), 'packages/ui must not export the ExpFactory shell.');
  for (const file of ['components/ExpFactoryGame.tsx', 'expFactoryRuntime.ts']) {
    await assert.rejects(access(resolve(repositoryRoot, 'packages/ui/src', file)), `${file} must stay removed.`);
  }
  const rootPackage = JSON.parse(await readFile(resolve(repositoryRoot, 'package.json'), 'utf8'));
  assert.doesNotMatch(rootPackage.scripts['test:training-flow'], /check-expfactory-originals/);
  assert.match(rootPackage.scripts['test:training-flow'], /check-tour\.test\.mjs/, 'The Toutour style check must stay in a CI gate.');
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
      if (Object.hasOwn(migratedGames, gameId)) {
        assert.ok(!relative(resolve(gamesRoot, gameId), file).startsWith('..'),
          `${gameId} is a self-contained R2 package and imports code outside its folder: ${relative(repositoryRoot, file).replaceAll('\\', '/')}`);
      }
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
        // Vite query imports (`?worker`, `?url`, `?raw`) still bundle the file named before the query.
        const path = specifier.replace(/\?.*$/, '');
        const target = ts.resolveModuleName(path, file, options, ts.sys).resolvedModule?.resolvedFileName
          ?? (path.startsWith('.') && ts.sys.fileExists(resolve(dirname(file), path)) ? resolve(dirname(file), path) : null);
        if (Object.hasOwn(migratedGames, gameId) && path.startsWith('.')) {
          assert.ok(target, `${gameId}: cannot resolve ${specifier} from ${relative(repositoryRoot, file).replaceAll('\\', '/')} to check its folder`);
        }
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
  const definitions = new Map(await Promise.all(expectedOfficialGameIds.filter(id => !Object.hasOwn(migratedGames, id)).map(async id => [id, JSON.parse(await readFile(resolve(gamesRoot, id, 'settings.json'), 'utf8')).sections.flatMap(section => section.fields)])));
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
