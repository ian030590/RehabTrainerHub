import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import test from 'node:test';

const repoRoot = resolve(import.meta.dirname, '..');
const tempRoot = resolve(repoRoot, '.tmp');

test('naming check ignores generated R2 release bundles', (context) => {
  const fixtureRoot = CreateFixture(context, {
    'apps/game/src/main.ts': 'export function StartGame(score) { const totalScore = score; return totalScore; }',
  });
  const result = RunChecker(fixtureRoot);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Identifier naming check passed/);
});

test('naming check still rejects authored source violations', (context) => {
  const sourceFiles = [
    'apps/game/src/main.ts',
    'apps/game/src/View.tsx',
    'apps/game/assets/helper.js',
    '.source/helper.mjs',
  ];
  const invalidSource = 'function invalidFunction(BadParameter) { const BadVariable = BadParameter; return BadVariable; }';
  const fixtureRoot = CreateFixture(context, Object.fromEntries(sourceFiles.map((fileName) => [fileName, invalidSource])));
  const result = RunChecker(fixtureRoot);
  const output = result.stderr.replaceAll('\\', '/');

  assert.equal(result.status, 1, result.stdout);
  for (const fileName of sourceFiles) {
    assert.ok(output.includes(`${fileName}:1:`), output);
  }
  assert.match(output, /named functions must use PascalCase \(invalidFunction\)/);
  assert.match(output, /parameters must use camelCase \(BadParameter\)/);
  assert.match(output, /variables must use camelCase \(BadVariable\)/);
  assert.doesNotMatch(output, /\.dist-releases/);
});

function CreateFixture(context, sourceFiles) {
  mkdirSync(tempRoot, { recursive: true });
  const fixtureRoot = mkdtempSync(resolve(tempRoot, 'naming-test-'));
  context.after(() => {
    assert.ok(fixtureRoot.startsWith(`${tempRoot}${sep}`));
    rmSync(fixtureRoot, { recursive: true, force: true });
  });
  const checkerPath = resolve(fixtureRoot, 'scripts/check-identifier-names.mjs');
  mkdirSync(dirname(checkerPath), { recursive: true });
  copyFileSync(resolve(repoRoot, 'scripts/check-identifier-names.mjs'), checkerPath);
  const files = {
    ...sourceFiles,
    '.dist-releases/antisaccade/1.0.0/files/assets/index-B5Mo4TSb.js': 'function f(S){const Tu=S;return Tu}',
  };
  for (const [fileName, source] of Object.entries(files)) {
    const filePath = resolve(fixtureRoot, fileName);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, source);
  }
  return fixtureRoot;
}

function RunChecker(fixtureRoot) {
  const result = spawnSync(process.execPath, [resolve(fixtureRoot, 'scripts/check-identifier-names.mjs')], {
    cwd: fixtureRoot,
    encoding: 'utf8',
    timeout: 30_000,
  });
  assert.ifError(result.error);
  return result;
}
