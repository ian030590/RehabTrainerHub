import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, readdir, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { createHash } from 'node:crypto';
import './check-r2-game-results.test.mjs';
import './check-r2-game-ui.test.mjs';
import './check-r2-game-fullscreen.test.mjs';

const root = resolve(import.meta.dirname, '..');
const gameRoot = resolve(root, 'apps/rehabtrainerhub/games/drawing-defense');

test('obsolete local release staging is removed and ignored without ignoring publication receipts', () => {
  const stagingPath = '.dist-releases/generated.js';
  const result = spawnSync('git', ['check-ignore', '--no-index', '--stdin'], {
    cwd: root,
    encoding: 'utf8',
    input: `${stagingPath}\ndocs/releases/drawing-defense-2.0.1.json\n`,
  });
  assert.ifError(result.error);
  assert.deepEqual({
    stagingExists: existsSync(resolve(root, '.dist-releases')),
    ignoredPaths: result.stdout.trim(),
    status: result.status,
  }, { stagingExists: false, ignoredPaths: stagingPath, status: 0 });
});

test('drawing defense owns its configuration and results without Hub dependencies', async () => {
  const files = await readdir(gameRoot, { recursive: true });
  for (const file of files.filter(file => /\.(tsx?|css)$/.test(file) && !file.startsWith('dist'))) {
    const source = await readFile(resolve(gameRoot, file), 'utf8');
    assert.doesNotMatch(source, /@rehab-trainer\/|packages\/ui|SaveTrainingSessionRecord|VITE_.*TOKEN/, file);
  }
  for (const file of ['settings.json', 'score.json']) await assert.rejects(access(resolve(gameRoot, file)));
  const source = await readFile(resolve(gameRoot, 'DrawingTowerDefenseGame.tsx'), 'utf8');
  for (const label of ['maxHp', 'speed', 'strictness', 'strokeWaitMs', 'gameDurationSec', 'backgroundMode']) {
    assert.match(source, new RegExp(`value=\\{${label}(?: \\?\\? 0)?\\}`));
  }
  assert.match(source, /SendGameResult/);
  assert.match(source, /<ScoreAnalysis rounds=\{BuildGameScore\(result\)\.rounds\}/);
  assert.match(await readFile(resolve(gameRoot, 'ScoreAnalysis.tsx'), 'utf8'), /results-table/);
  const hub = JSON.parse(await readFile(resolve(root, 'apps/rehabtrainerhub/package.json'), 'utf8'));
  assert.equal(hub.dependencies['@rehab-trainer/game-drawing-defense'], undefined);
});

test('private game channel rejects invalid identity, replay, and unsafe result fields', async () => {
  const { AcceptGameMessage } = await import('../packages/ui/src/selfContainedGame.js');
  const state = { gameId: 'drawing-defense', version: '1.0.0', sessionNonce: 'a'.repeat(64), sequence: -1, complete: false };
  const message = { schema: 'trainerhub.game/v1', gameId: state.gameId, version: state.version,
    sessionNonce: state.sessionNonce, sequence: 0, type: 'result', payload: {
      config: { difficulty: 'Beginner', durationSec: 30 },
      score: { schema: 'rehab-trainer.game-score/v1', gameId: state.gameId,
        summary: { defeated: 1 }, rounds: [{ reactionSeconds: 0.2, defeated: 1 }] },
    } };
  for (const changes of [{ sessionNonce: 'b'.repeat(64) }, { version: '2.0.0' }, { gameId: 'different' }]) {
    assert.equal(AcceptGameMessage({ ...message, ...changes }, { ...state }), false);
  }
  for (const value of [Infinity, '1', { value: 1 }]) {
    const invalid = structuredClone(message);
    invalid.payload.score.summary.defeated = value;
    assert.equal(AcceptGameMessage(invalid, { ...state }), false);
  }
  const sensitive = structuredClone(message);
  sensitive.payload.config.authToken = 'secret';
  assert.equal(AcceptGameMessage(sensitive, { ...state }), false);
  assert.equal(AcceptGameMessage(message, state), true);
  assert.equal(AcceptGameMessage(message, state), false);
  assert.equal(AcceptGameMessage({ ...message, sequence: 1 }, state), false);
  assert.equal(AcceptGameMessage({ ...message, sequence: 2, type: 'exit', payload: {} }, state), true);
});

test('published game packages include only self-contained, local resources', async () => {
  const { ValidatePackageResources } = await import('./publish-official-game.mjs');
  assert.doesNotThrow(() => ValidatePackageResources(new Map([
    ['index.html', Buffer.from('<script src="./game.js"></script><link rel="stylesheet" href="./style.css">')],
    ['game.js', Buffer.from('console.log("ready")')], ['style.css', Buffer.from('body{background:url(./sky.png)}')],
    ['sky.png', Buffer.from('png')],
  ])));
  for (const html of ['<script src="https://cdn.example/game.js"></script>', '<script src="/game.js"></script>', '<script src="./missing.js"></script>']) {
    assert.throws(() => ValidatePackageResources(new Map([['index.html', Buffer.from(html)]])));
  }
});

test('R2 serves self-contained game files only after checking their actual digest', async () => {
  const { HandleRequest } = await import('../apps/usergamerunner/functions/[[path]].js');
  const bytes = new TextEncoder().encode('<!doctype html><title>Game</title>');
  const digest = createHash('sha256').update(bytes).digest('hex');
  const release = { schemaVersion: 1, status: 'approved', gameId: 'drawing-defense', version: '1.0.0',
    name: 'Game', runtime: { name: 'native', major: 1 }, presentation: 'game', entry: 'index.html',
    files: [{ path: 'index.html', size: bytes.length, sha256: digest }] };
  let corrupt = false;
  const bucket = { get: async key => {
    if (key.endsWith('release.json')) return { size: JSON.stringify(release).length, text: async () => JSON.stringify(release) };
    const body = corrupt ? bytes.map(value => value ^ 1) : bytes;
    return { size: body.length, body, arrayBuffer: async () => body.buffer };
  } };
  const context = { request: new Request('https://runner.example/games/drawing-defense/1.0.0/package/index.html'), env: { GAME_RELEASE_BUCKET: bucket } };
  const response = await HandleRequest(context);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('Content-Security-Policy'), /connect-src 'none'/);
  assert.match(response.headers.get('Content-Security-Policy'), /sandbox allow-scripts/);
  corrupt = true;
  assert.equal((await HandleRequest(context)).status, 404);
});
