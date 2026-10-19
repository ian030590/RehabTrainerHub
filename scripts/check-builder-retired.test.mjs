import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import test from 'node:test';

// RehabBuilder was retired on 2026-10-19; the Hub must not advertise it or keep its handoff API.
const repoRoot = resolve(import.meta.dirname, '..');
const hubApp = join(repoRoot, 'apps/rehabtrainerhub');
const publicSources = [
  'apps/rehabtrainerhub/app/HubNavigation.tsx',
  'apps/rehabtrainerhub/app/developer/developerCopy.ts',
  'apps/rehabtrainerhub/app/developer/DeveloperGuide.tsx',
  'apps/rehabtrainerhub/app/developer/DeveloperPortal.tsx',
  'docs/developer-game-packages.md',
  'README.md',
  'AGENTS.md',
];

function ListFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? ListFiles(path) : [path];
  });
}

test('Hub pages and docs no longer mention or link to RehabBuilder', () => {
  for (const file of publicSources) {
    const source = readFileSync(join(repoRoot, file), 'utf8');
    assert.doesNotMatch(source, /RehabBuilder|builder\.trainerhub\.cc|builder_ticket|\/api\/builder\//i, file);
  }
});

test('Hub Functions no longer expose the Builder handoff or read its shared secret', () => {
  assert.equal(existsSync(join(hubApp, 'functions/api/builder')), false, 'functions/api/builder must be removed');
  const readers = ListFiles(join(hubApp, 'functions'))
    .filter((path) => path.endsWith('.js') && /BUILDER_CLIENT_SECRET|BUILDER_ORIGIN/.test(readFileSync(path, 'utf8')))
    .map((path) => relative(repoRoot, path).replaceAll('\\', '/'));
  assert.deepEqual(readers, []);
});

test('native HTML packages stay a supported submission contract', () => {
  const portal = readFileSync(join(hubApp, 'app/developer/DeveloperPortal.tsx'), 'utf8');
  assert.match(portal, /<option value="none">/);
  assert.match(portal, /jsPsychVersion: nativePackage \? 'none'/);
});
