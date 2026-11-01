import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const gates = ['test:naming', 'test:pwa', 'test:game-architecture', 'test:hub-functions', 'test:gamerunner', 'test:entrypoints', 'test:cloudflare-deploy'];

test('pre-push runs every former CI gate and Cloudflare keeps only deployment jobs', () => {
  assert.equal(pkg.scripts['test:ci'], gates.map(name => `npm run ${name}`).join(' && '));
  assert.equal(pkg.scripts.prepare, 'node scripts/install-git-hooks.mjs');
  assert.ok(pkg.scripts['test:cloudflare-deploy'].includes('scripts/check-git-hooks.test.mjs'));
  assert.equal(existsSync(resolve(root, '.github/workflows/ci.yml')), false);
  const workflow = readFileSync(resolve(root, '.github/workflows/deploy-cloudflare-pages.yml'), 'utf8');
  assert.doesNotMatch(workflow, /^  verify:|matrix\.command|npm run test:/m);
  assert.match(workflow, /needs: \[deployment_scope\]/);
  assert.match(workflow, /run: npm run build:cloudflare:only/);
  assert.match(workflow, /run: node scripts\/deploy-cloudflare-workers\.mjs/);
});

test('an actual local push runs all gates, and a failing gate blocks the remote update', (t) => {
  assert.ok(pkg.scripts['test:ci'], 'The shared CI test command must exist.');
  const fixture = CreateFixture(t);
  const remote = resolve(fixture, 'remote.git');
  RunGit(fixture, ['init', '--bare', remote]);
  RunGit(fixture, ['init', '--initial-branch=main']);
  for (const path of ['.githooks/pre-push', 'scripts/install-git-hooks.mjs']) {
    const target = resolve(fixture, path);
    mkdirSync(resolve(target, '..'), { recursive: true });
    copyFileSync(resolve(root, path), target);
  }
  writeFileSync(resolve(fixture, 'package.json'), JSON.stringify({ private: true, scripts: {
    'test:ci': pkg.scripts['test:ci'],
    ...Object.fromEntries(gates.map(name => [name, `node scripts/gate.cjs ${name}`])),
  } }));
  writeFileSync(resolve(fixture, 'scripts/gate.cjs'),
    "require('node:fs').appendFileSync('gates.log', process.argv[2] + '\\n'); process.exit(process.env.FAIL_GATE === process.argv[2] ? 1 : 0);\n");

  const installed = spawnSync(process.execPath, ['scripts/install-git-hooks.mjs'], {
    cwd: fixture, encoding: 'utf8', env: { ...process.env, CI: '' },
  });
  assert.equal(installed.status, 0, installed.stderr || installed.stdout);
  assert.equal(RunGit(fixture, ['config', '--local', '--get', 'core.hooksPath']).stdout.trim(), '.githooks');
  RunGit(fixture, ['add', 'package.json']);
  RunGit(fixture, ['-c', 'user.name=Hook Test', '-c', 'user.email=hook@example.invalid', 'commit', '-m', 'fixture']);
  RunGit(fixture, ['push', remote, 'HEAD:refs/heads/main']);
  assert.deepEqual(readFileSync(resolve(fixture, 'gates.log'), 'utf8').trim().split(/\r?\n/), gates);
  const published = RunGit(fixture, ['--git-dir', remote, 'rev-parse', 'refs/heads/main']).stdout.trim();

  RunGit(fixture, ['-c', 'user.name=Hook Test', '-c', 'user.email=hook@example.invalid', 'commit', '--allow-empty', '-m', 'blocked']);
  writeFileSync(resolve(fixture, 'gates.log'), '');
  const blocked = spawnSync('git', ['push', remote, 'HEAD:refs/heads/main'], {
    cwd: fixture, encoding: 'utf8', env: { ...process.env, FAIL_GATE: 'test:pwa' },
  });
  assert.notEqual(blocked.status, 0, blocked.stderr || blocked.stdout);
  assert.deepEqual(readFileSync(resolve(fixture, 'gates.log'), 'utf8').trim().split(/\r?\n/), gates.slice(0, 2));
  assert.equal(RunGit(fixture, ['--git-dir', remote, 'rev-parse', 'refs/heads/main']).stdout.trim(), published);
});

test('hook installation skips CI and source archives without Git metadata', (t) => {
  assert.ok(existsSync(resolve(root, 'scripts/install-git-hooks.mjs')), 'The hook installer must exist.');
  const fixture = CreateFixture(t);
  mkdirSync(resolve(fixture, 'scripts'));
  copyFileSync(resolve(root, 'scripts/install-git-hooks.mjs'), resolve(fixture, 'scripts/install-git-hooks.mjs'));
  const archive = spawnSync(process.execPath, ['scripts/install-git-hooks.mjs'], {
    cwd: fixture, encoding: 'utf8', env: { ...process.env, CI: '' },
  });
  assert.equal(archive.status, 0, archive.stderr || archive.stdout);
  RunGit(fixture, ['init']);
  const ci = spawnSync(process.execPath, ['scripts/install-git-hooks.mjs'], {
    cwd: fixture, encoding: 'utf8', env: { ...process.env, CI: 'true' },
  });
  assert.equal(ci.status, 0, ci.stderr || ci.stdout);
  assert.notEqual(spawnSync('git', ['config', '--local', '--get', 'core.hooksPath'], { cwd: fixture }).status, 0);
});

function CreateFixture(t) {
  const fixture = mkdtempSync(resolve(tmpdir(), 'rehab-pre-push-'));
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  return fixture;
}

function RunGit(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result;
}
