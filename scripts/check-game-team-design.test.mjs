import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

const repoRoot = resolve(import.meta.dirname, '..');
const headings = ['Summary', 'Overview', 'Detailed Design', 'Edge Cases', 'Dependencies', 'Acceptance Criteria'];
const completeGdd = headings.map(heading => `## ${heading}\n\nDesign details.\n`).join('\n');

function Write(root, path, text) {
  const target = resolve(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text, 'utf8');
}

function Fixture(t, legacy = ['old-game']) {
  const root = mkdtempSync(resolve(tmpdir(), 'game-team-design-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const id of legacy) mkdirSync(resolve(root, `apps/rehabtrainerhub/games/${id}`), { recursive: true });
  Write(root, 'scripts/game-team-legacy-games.json', JSON.stringify(legacy));
  Write(root, 'apps/rehabtrainerhub/games/catalog.ts', "const seeds = [{ id: 'old-game', trainer: 'test' }];\n");
  return root;
}

async function Check(root) {
  const { CheckGameTeamDesign } = await import('./check-game-team-design.mjs');
  return CheckGameTeamDesign(root);
}

function ExpectGuidance(problems) {
  assert.ok(problems.length > 0);
  for (const problem of problems) {
    assert.match(problem, /run the game team/i);
    assert.ok(problem.includes('.claude/docs/rehab-game-team.md'));
  }
}

test('existing repository games pass the frozen game-team exemption check', async () => {
  assert.deepEqual(await Check(repoRoot), []);
});

test('a new workspace needs a GDD and receives actionable team guidance', async t => {
  const root = Fixture(t);
  mkdirSync(resolve(root, 'apps/rehabtrainerhub/games/new-game'));
  const problems = await Check(root);
  ExpectGuidance(problems);
  assert.ok(problems.some(problem => problem.includes('design/gdd/new-game.md')));
});

test('a new game GDD must contain every required level-two heading', async t => {
  const root = Fixture(t);
  mkdirSync(resolve(root, 'apps/rehabtrainerhub/games/new-game'));
  for (const missing of headings) {
    Write(root, 'design/gdd/new-game.md', completeGdd.replace(`## ${missing}\n`, `### ${missing}\n`));
    const problems = await Check(root);
    ExpectGuidance(problems);
    assert.ok(problems.some(problem => problem.includes(`## ${missing}`)));
  }
});

test('a complete GDD passes for a new workspace', async t => {
  const root = Fixture(t);
  mkdirSync(resolve(root, 'apps/rehabtrainerhub/games/new-game'));
  Write(root, 'design/gdd/new-game.md', completeGdd);
  assert.deepEqual(await Check(root), []);
});

test('a removed game must also be removed from the legacy list', async t => {
  const root = Fixture(t);
  rmSync(resolve(root, 'apps/rehabtrainerhub/games/old-game'), { recursive: true });
  const problems = await Check(root);
  ExpectGuidance(problems);
  assert.ok(problems.some(problem => /old-game.*(removed|exist)/i.test(problem)));
});

test('the frozen legacy list must be sorted and unique', async t => {
  const root = Fixture(t, ['z-game', 'old-game']);
  let problems = await Check(root);
  ExpectGuidance(problems);
  assert.ok(problems.some(problem => /sorted/i.test(problem)));
  Write(root, 'scripts/game-team-legacy-games.json', '["old-game", "old-game", "z-game"]');
  problems = await Check(root);
  assert.ok(problems.some(problem => /unique|duplicate/i.test(problem)));
});

test('a catalog-only new game also needs a complete GDD', async t => {
  const root = Fixture(t);
  Write(root, 'apps/rehabtrainerhub/games/catalog.ts', [
    "const themes = { default: { id: 'default' } };",
    "const seeds: readonly TrainingCatalogSeed[] = [{ trainer: 'test', id: 'catalog-only' }];",
  ].join('\n'));
  const problems = await Check(root);
  ExpectGuidance(problems);
  assert.equal(problems.length, 1);
  assert.ok(problems[0].includes('design/gdd/catalog-only.md'));
  Write(root, 'design/gdd/catalog-only.md', completeGdd);
  assert.deepEqual(await Check(root), []);
});

test('catalog shape changes fail loudly instead of silently skipping catalog games', async t => {
  const root = Fixture(t);
  Write(root, 'apps/rehabtrainerhub/games/catalog.ts', 'const seeds = GetSeeds();\n');
  const problems = await Check(root);
  ExpectGuidance(problems);
  assert.ok(problems.some(problem => /catalog.*array literal/i.test(problem)));
});
