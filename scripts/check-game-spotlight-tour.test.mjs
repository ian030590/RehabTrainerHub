import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { CheckGameSpotlightTour, ListGameWorkspaceIds, MapChangedGameFiles } from './lib/game-spotlight-tour.mjs';

const repoRoot = resolve(import.meta.dirname, '..');
const hookPath = resolve(repoRoot, '.claude/hooks/require-game-spotlight-tour.mjs');
const gamesPath = 'apps/rehabtrainerhub/games';
const gamePath = `${gamesPath}/demo`;
const steps = `lang === 'en'
  ? [{ target: '.start', title: 'Start', text: 'Press Space to start.', place: 'bottom' }]
  : [{ target: '.start', title: '開始', text: '按空白鍵開始。', place: 'bottom' }]`;
const tourRuntime = `export function StartTour(steps) {
  const spotlight = document.createElement('div');
  spotlight.className = 'game-tour-spotlight';
}`;
const tourCss = '.game-tour-spotlight { position: absolute; }';

function WriteFixtureFile(root, path, source) {
  const file = resolve(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, source);
}

function MakeFixture(context) {
  const root = mkdtempSync(resolve(tmpdir(), 'game-spotlight-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const WriteGameFile = (path, source) => WriteFixtureFile(root, `${gamePath}/${path}`, source);
  WriteGameFile('package.json', '{}');
  return { root, WriteGameFile };
}

function AddTour(writeGameFile) {
  writeGameFile('runtime/tour.ts', tourRuntime);
  writeGameFile('rules.css', tourCss);
  writeGameFile('rules/Tutorial.tsx', `import { StartTour } from '../runtime/tour';
    StartTour(${steps});`);
}

function Git(root, ...args) {
  return execFileSync('git', args, { cwd: root, stdio: 'pipe' });
}

function RunHook(root, command, toolName = 'Bash') {
  const result = spawnSync(process.execPath, [hookPath], {
    input: JSON.stringify({ tool_name: toolName, tool_input: { command } }),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
  });
  if (result.error) throw result.error;
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

const silent = { status: 0, stdout: '', stderr: '' };

test('every game workspace ships a bilingual spotlight tutorial', () => {
  const ids = ListGameWorkspaceIds(repoRoot);
  assert.ok(ids.length > 0, 'no game workspaces discovered');
  const failures = ids.flatMap(id => CheckGameSpotlightTour(repoRoot, id).map(problem => `${id} | ${problem}`));
  assert.deepEqual(failures, [], failures.join('\n'));
});

test('paths map only to workspaces and skip generated files', context => {
  const { root } = MakeFixture(context);
  WriteFixtureFile(root, `${gamesPath}/second/package.json`, '{}');
  WriteFixtureFile(root, `${gamesPath}/unregistered/main.tsx`, '');
  const ids = ListGameWorkspaceIds(root);
  assert.deepEqual(ids, ['demo', 'second']);
  const touched = MapChangedGameFiles([
    `${gamePath}/main.tsx`,
    `./${gamePath}/main.tsx`,
    `${gamePath}/rules/Steps.ts`.replaceAll('/', '\\'),
    `${gamesPath}/second/package.json`,
    `${gamePath}/dist/bundle.css`,
    `${gamePath}/runtime/node_modules/package/index.js`,
    `${gamePath}/../catalog.ts`,
    `${gamesPath}/catalog.ts`,
    `${gamesPath}/unregistered/main.tsx`,
    'scripts/demo.ts',
  ], ids);
  assert.deepEqual(touched, new Map([
    ['demo', ['main.tsx', 'rules/Steps.ts']],
    ['second', ['package.json']],
  ]));
});

test('the checker reports missing runtime, tutorial and CSS', context => {
  const { root } = MakeFixture(context);
  const problems = CheckGameSpotlightTour(root, 'demo').join('\n');
  assert.match(problems, /runtime\/tour\.ts/);
  assert.match(problems, /rules\//);
  assert.match(problems, /\.game-tour-spotlight/);
});

test('the checker accepts a page that launches a tour with steps imported from rules', context => {
  const { root, WriteGameFile } = MakeFixture(context);
  WriteGameFile('runtime/tour.ts', tourRuntime);
  WriteGameFile('runtime/tour.css', tourCss);
  WriteGameFile('GamePage.tsx', `import { StartTour } from './runtime/tour';
    import { GetSteps } from './rules/tutorialSteps';
    StartTour(GetSteps(lang));`);
  WriteGameFile('rules/tutorialSteps.ts', `export function GetSteps(lang) { return ${steps}; }`);
  assert.deepEqual(CheckGameSpotlightTour(root, 'demo'), []);
});

test('the checker accepts bilingual title and description pairs mapped into steps', context => {
  const { root, WriteGameFile } = MakeFixture(context);
  AddTour(WriteGameFile);
  WriteGameFile('rules/Tutorial.tsx', `import { StartTour } from '../runtime/tour';
    import { GetSteps } from './tutorialSteps';
    StartTour(GetSteps(lang));`);
  WriteGameFile('rules/tutorialSteps.ts', `export function GetSteps(lang) {
    const copy = lang === 'en' ? [['Start', 'Press Space to start.']] : [['開始', '按空白鍵開始。']];
    return ['.start'].map((target, index) => ({
      target: target, title: copy[index][0], text: copy[index][1], place: 'bottom',
    }));
  }`);
  assert.deepEqual(CheckGameSpotlightTour(root, 'demo'), []);
});

test('comments, unrelated files and one-language steps cannot satisfy the checker', context => {
  const { root, WriteGameFile } = MakeFixture(context);
  AddTour(WriteGameFile);
  WriteGameFile('runtime/tour.ts', `// ${tourRuntime.split('\n')[0]}
    const spotlight = 'game-tour-spotlight';`);
  WriteGameFile('rules.css', `/* ${tourCss} */ .game-tour-spotlight-preview { color: red; }`);
  WriteGameFile('rules/Tutorial.tsx', `import { StartTour } from '../runtime/tour';
    StartTour([{target: '.start', title: '開始', text: '按 Space 開始。', place: 'bottom'}]);`);
  WriteGameFile('rules/Unrelated.ts', `export const copy = ${steps};`);
  const problems = CheckGameSpotlightTour(root, 'demo').join('\n');
  assert.match(problems, /StartTour/);
  assert.match(problems, /\.game-tour-spotlight/);
  assert.match(problems, /\ben\b/);
  assert.doesNotMatch(problems, /\bzh\b/);
});

test('an empty tutorial and an English-only tutorial report their own missing requirements', context => {
  const { root, WriteGameFile } = MakeFixture(context);
  AddTour(WriteGameFile);
  const prefix = "import { StartTour } from '../runtime/tour';";
  WriteGameFile('rules/Tutorial.tsx', `${prefix} StartTour([]);`);
  assert.match(CheckGameSpotlightTour(root, 'demo').join('\n'), /target.*title.*text/);
  WriteGameFile('rules/Tutorial.tsx', `${prefix}
    StartTour([{target: '.start', title: 'Start', text: 'Press Space to start.', place: 'bottom'}]);`);
  assert.match(CheckGameSpotlightTour(root, 'demo').join('\n'), /\bzh\b/);
});

test('the hook ignores other tools, non-commit commands and an empty Git index', context => {
  const { root } = MakeFixture(context);
  assert.deepEqual(RunHook(root, 'ls'), silent);
  assert.deepEqual(RunHook(root, 'git commit -m x', 'Read'), silent);
  Git(root, 'init', '--quiet');
  assert.deepEqual(RunHook(root, 'git commit -m x'), silent);
  Git(root, 'add', '--', gamePath);
  assert.deepEqual(RunHook(root, 'Write-Output "text; git commit -a"; git status', 'PowerShell'), silent);
  assert.deepEqual(RunHook(root, 'git log --grep "git commit"'), silent);
});

test('the hook blocks a staged game without a tour in a chained git -C commit', context => {
  const { root, WriteGameFile } = MakeFixture(context);
  Git(root, 'init', '--quiet');
  WriteGameFile('main.tsx', 'export {};');
  Git(root, 'add', '--', gamePath);
  for (const [toolName, command] of [
    ['Bash', 'git status && git -C "." commit -m x'],
    ['PowerShell', 'Get-Location; & "C:\\Program Files\\Git\\cmd\\git.exe" -C "." commit -m x'],
  ]) {
    const result = RunHook(root, command, toolName);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /demo[\s\S]*runtime\/tour\.ts[\s\S]*聚光燈/);
  }
  AddTour(WriteGameFile);
  assert.equal(RunHook(root, 'git commit -m x').status, 2, 'unstaged tutorial files cannot satisfy a staged commit');
});

test('commit --all and its short form check the tracked working-tree tour', context => {
  const { root, WriteGameFile } = MakeFixture(context);
  AddTour(WriteGameFile);
  Git(root, 'init', '--quiet');
  Git(root, 'add', '--', gamePath);
  WriteGameFile('runtime/tour.ts', 'export {};');
  assert.deepEqual(RunHook(root, 'git commit -m "--all"'), silent);
  for (const command of ['git commit --all -m x', 'git commit -am x', 'git commit -a -m x']) {
    const result = RunHook(root, command);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /StartTour/);
  }
});

test('a preceding git add checks new game files before the command stages them', context => {
  const { root, WriteGameFile } = MakeFixture(context);
  Git(root, 'init', '--quiet');
  WriteGameFile('main.tsx', 'export {};');
  const command = 'git -C "." add -- ' + gamePath + ' && git commit -m x';

  const result = RunHook(root, command);
  assert.equal(result.status, 2, JSON.stringify(result));
  assert.match(result.stderr, /demo[\s\S]*runtime\/tour\.ts/);
  assert.equal(Git(root, 'diff', '--cached', '--name-only').toString(), '');

  AddTour(WriteGameFile);
  WriteFixtureFile(root, gamesPath + '/other/package.json', '{}');
  assert.deepEqual(RunHook(root, command), silent);
  assert.match(RunHook(root, 'git add -A && git commit -m x').stderr, /other[\s\S]*runtime\/tour\.ts/);
  assert.deepEqual(RunHook(root, 'git add -A'), silent);
  assert.deepEqual(RunHook(root, 'git commit -a -m x'), silent);
});

test('a commit with selected paths checks their working-tree files', context => {
  const { root, WriteGameFile } = MakeFixture(context);
  AddTour(WriteGameFile);
  Git(root, 'init', '--quiet');
  Git(root, 'add', '--', gamePath);
  WriteGameFile('runtime/tour.ts', 'export {};');
  const path = gamePath + '/runtime/tour.ts';

  assert.deepEqual(RunHook(root, 'git commit -m "' + path + '"'), silent);
  for (const command of ['git commit -m x ' + path, 'git commit -m x -- "' + path + '"']) {
    const result = RunHook(root, command);
    assert.equal(result.status, 2, JSON.stringify(result));
    assert.match(result.stderr, /runtime\/tour\.ts.*StartTour/);
  }
});

test('the hook advises on player-facing changes and stays silent for tests or tutorial edits', context => {
  const { root, WriteGameFile } = MakeFixture(context);
  AddTour(WriteGameFile);
  Git(root, 'init', '--quiet');
  Git(root, 'add', '--', gamePath);
  Git(root, 'update-ref', 'refs/test/spotlight-base', Git(root, 'write-tree').toString().trim());
  Git(root, 'symbolic-ref', 'HEAD', 'refs/test/spotlight-base');
  WriteGameFile('tests/logic.ts', 'export {};');
  WriteGameFile('logic.test.tsx', 'export {};');
  Git(root, 'add', '--', gamePath);
  assert.deepEqual(RunHook(root, 'git commit -m x'), silent);

  WriteGameFile('public/game.json', '{}');
  Git(root, 'add', '--', `${gamePath}/public/game.json`);
  const result = RunHook(root, 'git commit -m x');
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  const output = JSON.parse(result.stdout).hookSpecificOutput;
  assert.equal(output.hookEventName, 'PreToolUse');
  assert.match(output.additionalContext, /demo[\s\S]*聚光燈[\s\S]*更新/);

  const unstagedContent = 'main.tsx';
  WriteGameFile(unstagedContent, 'export {};');
  Git(root, 'add', '--', `${gamePath}/${unstagedContent}`);
  Git(root, 'update-ref', 'refs/test/spotlight-base', Git(root, 'write-tree').toString().trim());
  WriteGameFile(unstagedContent, 'export const speed = 2;');
  assert.deepEqual(RunHook(root, 'git commit -m x'), silent);
  assert.match(RunHook(root, 'git commit -a -m x').stdout, /demo/);

  WriteGameFile('rules/Tutorial.tsx', `import { StartTour } from '../runtime/tour';
    StartTour(${steps.replace('Press Space to start.', 'Press the Space key to start.')});`);
  Git(root, 'add', '--', `${gamePath}/rules/Tutorial.tsx`);
  assert.deepEqual(RunHook(root, 'git commit -a -m x'), silent);
});

test('a Git error warns without blocking the tool call', context => {
  const { root } = MakeFixture(context);
  const result = RunHook(resolve(root, 'missing'), 'git commit -m x');
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /聚光燈[\s\S]*無法/);
});
