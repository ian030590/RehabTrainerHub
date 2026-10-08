import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const gamePath = 'apps/rehabtrainerhub/games/drawing-defense';
test('R2 content and version metadata skip Pages while platform and legacy games deploy', async () => {
  const { NeedsPagesDeployment } = await import('./pages-deployment-scope.mjs');
  const before = { packages: { [gamePath]: { version: '2.0.2', dependencies: { 'pixi.js': '8' } }, root: { version: '1' } } };
  const after = structuredClone(before);
  after.packages[gamePath].version = '2.0.3';
  const packages = { before: { version: '2.0.2', name: 'game' }, after: { version: '2.0.3', name: 'game' } };
  const readJson = (revision, path) => path === 'package-lock.json' ? ({ before, after })[revision] : packages[revision];
  const migratedIds = ['drawing-defense'];
  const check = paths => NeedsPagesDeployment(paths, { migratedIds, readJson });
  assert.equal(check([`${gamePath}/runtime/tour.ts`, `${gamePath}/package.json`, 'package-lock.json', 'docs/releases/new.json']), false);
  for (const path of ['apps/rehabtrainerhub/games/stroop/StroopGame.tsx', 'apps/rehabtrainerhub/app/page.tsx',
    'apps/usergamerunner/functions/_lib/release.js', 'packages/ui/src/officialGameReleases.json', 'scripts/publish-official-game.mjs',
    '.github/workflows/deploy-cloudflare-pages.yml', 'package.json']) assert.equal(check([path]), true, path);
  after.packages[gamePath].dependencies['pixi.js'] = '9';
  assert.equal(check(['package-lock.json']), true);
  packages.after.name = 'renamed';
  assert.equal(check([`${gamePath}/package.json`]), true);
  assert.equal(NeedsPagesDeployment(['package-lock.json'], { migratedIds, readJson: () => { throw new Error('Missing'); } }), true);
});

test('Cloudflare build excludes migrated R2 bundles and workflow gates deployment after verification', async () => {
  const result = spawnSync(process.execPath, ['scripts/build-apps.mjs', '--cloudflare-pages', '--dry-run'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /--filter=!@rehab-trainer\/game-drawing-defense/);
  const workflow = await readFile(new URL('../.github/workflows/deploy-cloudflare-pages.yml', import.meta.url), 'utf8');
  assert.match(workflow, /needs: \[verify, deployment_scope\]/);
  assert.match(workflow, /needs\.deployment_scope\.outputs\.pages_required == 'true'/);
});
