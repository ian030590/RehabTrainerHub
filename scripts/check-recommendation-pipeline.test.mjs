import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { GameSimilarity, lobbySimilarityThreshold } from '../apps/rehabtrainerhub/recommendation/features.js';
import * as pipeline from './recommendation-pipeline.mjs';

const script = 'scripts/recommendation-pipeline.mjs';
const recommendation = 'apps/rehabtrainerhub/recommendation';
const games = 'apps/rehabtrainerhub/games';
const indexFile = `${recommendation}/generated/featureIndex.json`;
const mapFile = `${recommendation}/generated/activityMap.json`;

function Distance([x1, y1], [x2, y2]) {
  return Math.hypot(x1 - x2, y1 - y2);
}

function CheckCoordinates(map) {
  const points = Object.values(map);
  for (const [index, point] of points.entries()) {
    assert.equal(point.length, 2);
    assert.ok(point.every(value => value >= 0 && value <= 1 && value === Number(value.toFixed(4))));
    for (const other of points.slice(index + 1)) {
      assert.ok(Distance(point, other) >= pipeline.activityMapMinDistance);
    }
  }
}

test('activity map is deterministic and separates identical profiles without losing their neighborhood', () => {
  const ids = ['near-a', 'near-b', 'far'];
  const similarity = (a, b) => a.startsWith('near') && b.startsWith('near') ? 1 : null;
  const { map, stress, varianceExplained } = pipeline.BuildActivityMap(ids, similarity);
  assert.deepEqual(pipeline.BuildActivityMap(ids.toReversed(), similarity), { map, stress, varianceExplained });
  assert.deepEqual(Object.keys(map), ['far', 'near-a', 'near-b']);
  CheckCoordinates(map);
  assert.ok(Distance(map['near-a'], map['near-b']) < 0.1);
  assert.ok(Distance(map['near-a'], map.far) > 0.6 && Distance(map['near-b'], map.far) > 0.6);
  assert.ok(stress < 1e-8 && Math.abs(varianceExplained - 1) < 1e-8);
});

test('activity map signs use the largest absolute coordinate and break ties by id', () => {
  assert.deepEqual(pipeline.OrientActivityMapAxis([-3, 1, 2]), [3, -1, -2]);
  assert.deepEqual(pipeline.OrientActivityMapAxis([-2, 1, 2]), [2, -1, -2]);
  assert.deepEqual(pipeline.OrientActivityMapAxis([2, -2, 1]), [2, -2, 1]);
});

test('pipeline checks every generated activity map coordinate and rejects tampering', t => {
  const root = CopyPipeline(t);
  const build = RunPipeline(root);
  assert.equal(build.status, 0, build.stderr);
  assert.match(build.stdout, /2D stress.*variance/i);
  const path = join(root, mapFile);
  const bytes = readFileSync(path);
  const data = JSON.parse(bytes);
  const index = JSON.parse(readFileSync(join(root, indexFile), 'utf8'));
  assert.equal(data.featureInputSha256, index.inputSha256);
  assert.deepEqual(Object.keys(data.map), Object.keys(index.games));
  CheckCoordinates(data.map);
  const sourcePath = join(root, recommendation, 'gameFeatures.json');
  const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
  source.games = Object.fromEntries(Object.entries(source.games).reverse());
  writeFileSync(sourcePath, JSON.stringify(source));
  const rebuilt = RunPipeline(root);
  assert.equal(rebuilt.status, 0, rebuilt.stderr);
  assert.deepEqual(readFileSync(path), bytes);
  data.map[Object.keys(data.map)[0]][0] = 0;
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
  const stale = RunPipeline(root, '--check');
  assert.equal(stale.status, 1, stale.stderr);
  assert.match(stale.stderr, /activityMap\.json is stale/);
});

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
  assert.equal(build.stdout.trim().split(/\r?\n/).length, 7);
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
  const taxonomy = JSON.parse(readFileSync(join(root, recommendation, 'taxonomy.json'), 'utf8'));
  const ids = Object.keys(index.games);
  for (const [position, gameId] of ids.entries()) {
    const expected = {};
    for (const otherId of ids.slice(position + 1)) {
      const { score } = GameSimilarity(taxonomy, sourceGames[gameId], sourceGames[otherId]);
      if (score !== null && score >= lobbySimilarityThreshold) expected[otherId] = Number(score.toFixed(4));
    }
    assert.deepEqual(index.similarityScores[gameId] ?? {}, expected);
  }
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
