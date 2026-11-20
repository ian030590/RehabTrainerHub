import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

const script = 'scripts/recommendation-pipeline.mjs';
const recommendation = 'apps/rehabtrainerhub/recommendation';
const games = 'apps/rehabtrainerhub/games';
const indexFile = `${recommendation}/generated/featureIndex.json`;

function CopyPipeline(t) {
  const root = mkdtempSync(join(tmpdir(), 'recommendation-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const path of [
    script, `${recommendation}/features.js`, `${recommendation}/gameFeatures.json`,
    `${recommendation}/taxonomy.json`, `${games}/catalog.ts`, `${games}/moduleFlowManifest.ts`,
  ]) {
    const destination = join(root, path);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(new URL(`../${path}`, import.meta.url), destination);
  }
  writeFileSync(join(root, 'package.json'), '{"type":"module"}\n');
  return root;
}

function RunPipeline(root, ...args) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8' });
  assert.ifError(result.error);
  return result;
}

test('pipeline writes identical LF bytes and --check detects a missing or stale index', t => {
  const root = CopyPipeline(t);
  const indexPath = join(root, indexFile);
  const missing = RunPipeline(root, '--check');
  assert.equal(missing.status, 1, missing.stderr);
  assert.match(missing.stderr, /featureIndex\.json is stale; run npm run recommendation:build/);
  const build = RunPipeline(root);
  assert.equal(build.status, 0, build.stderr);
  assert.equal(build.stdout.trim().split(/\r?\n/).length, 6);
  const { games: sourceGames } = JSON.parse(readFileSync(join(root, recommendation, 'gameFeatures.json'), 'utf8'));
  const gameCount = Object.keys(sourceGames).length;
  const draftCount = Object.values(sourceGames).filter(game => game.reviewStatus === 'draft').length;
  assert.ok(build.stdout.includes(`Summary: ${gameCount} games, ${draftCount} draft, ${gameCount - draftCount} confirmed.`));
  const bytes = readFileSync(indexPath);
  assert.doesNotMatch(bytes.toString(), /\r/);
  assert.match(bytes.toString(), /\n$/);
  const index = JSON.parse(bytes);
  assert.equal(index.taxonomyVersion, '2.0.0');
  assert.equal(index.featureSpaceVersion, '2.0.0');
  assert.match(index.inputSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(Object.keys(index.games), Object.keys(index.games).sort());
  for (const [id, game] of Object.entries(index.games)) {
    assert.equal(game.reviewStatus, sourceGames[id].reviewStatus);
    assert.equal(game.neighbors.length, 5);
    assert.deepEqual(Object.keys(game.derivedFunctionTags), Object.keys(game.derivedFunctionTags).sort());
    for (const neighbor of game.neighbors) {
      assert.notEqual(neighbor.gameId, id);
      assert.equal(neighbor.score, Number(neighbor.score.toFixed(4)));
    }
  }
  assert.equal(index.games['oculomotor-training'].derivedFunctionTags['visual_perception.oculomotor'], 2);
  const rebuilt = RunPipeline(root);
  assert.equal(rebuilt.status, 0, rebuilt.stderr);
  assert.deepEqual(readFileSync(indexPath), bytes);
  const check = RunPipeline(root, '--check');
  assert.equal(check.status, 0, check.stderr);
  writeFileSync(indexPath, '{}\n');
  const stale = RunPipeline(root, '--check');
  assert.equal(stale.status, 1, stale.stderr);
  assert.match(stale.stderr, /featureIndex\.json is stale; run npm run recommendation:build/);
  assert.equal(readFileSync(indexPath, 'utf8'), '{}\n');
});

test('LF and CRLF JSON inputs produce the same canonical hash and output bytes', t => {
  const outputs = ['\n', '\r\n'].map(lineEnding => {
    const root = CopyPipeline(t);
    for (const name of ['taxonomy.json', 'gameFeatures.json']) {
      const path = join(root, recommendation, name);
      const text = readFileSync(path, 'utf8');
      writeFileSync(path, text.replace(/\r?\n/g, lineEnding));
    }
    const result = RunPipeline(root);
    assert.equal(result.status, 0, result.stderr);
    return readFileSync(join(root, indexFile));
  });
  assert.equal(JSON.parse(outputs[0]).inputSha256, JSON.parse(outputs[1]).inputSha256);
  assert.deepEqual(outputs[0], outputs[1]);
});

test('--check reports taxonomy and game errors with stable rule IDs', t => {
  const root = CopyPipeline(t);
  const taxonomyPath = join(root, recommendation, 'taxonomy.json');
  const taxonomyText = readFileSync(taxonomyPath, 'utf8');
  const taxonomy = JSON.parse(taxonomyText);
  taxonomy.frameworks[0].citation = '';
  writeFileSync(taxonomyPath, JSON.stringify(taxonomy));
  const taxonomyError = RunPipeline(root, '--check');
  assert.equal(taxonomyError.status, 1, taxonomyError.stderr);
  assert.match(taxonomyError.stderr, /\[R02\]/);
  writeFileSync(taxonomyPath, taxonomyText);
  const featuresPath = join(root, recommendation, 'gameFeatures.json');
  const features = JSON.parse(readFileSync(featuresPath, 'utf8'));
  delete features.games['oculomotor-training'];
  writeFileSync(featuresPath, JSON.stringify(features));
  const gameError = RunPipeline(root, '--check');
  assert.equal(gameError.status, 1, gameError.stderr);
  assert.match(gameError.stderr, /\[R10\].*oculomotor-training/);
});
