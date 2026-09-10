import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const compilerOptions = { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 };
const embeddedSource = await readFile(new URL('../packages/ui/src/embeddedTraining.ts', import.meta.url), 'utf8');
const resultActionsSource = await readFile(
  new URL('../packages/ui/src/components/TrainingResultActions.tsx', import.meta.url),
  'utf8',
);
const scoreSource = await readFile(new URL('../packages/ui/src/gameScore.ts', import.meta.url), 'utf8');
const scoreUrl = `data:text/javascript;base64,${Buffer.from(ts.transpileModule(scoreSource, { compilerOptions }).outputText).toString('base64')}`;
const gameScore = await import(scoreUrl);
const embeddedCode = ts.transpileModule(embeddedSource, { compilerOptions }).outputText.replaceAll("'./gameScore'", JSON.stringify(scoreUrl));
const embeddedUrl = `data:text/javascript;base64,${Buffer.from(embeddedCode).toString('base64')}`;
const embeddedTraining = await import(embeddedUrl);

test('all 40 score contracts accept bounded numeric rounds and reject unsafe data', async () => {
  const { readdir } = await import('node:fs/promises');
  const root = new URL('../apps/rehabtrainerhub/games/', import.meta.url);
  const games = (await readdir(root, { withFileTypes: true })).filter(entry => entry.isDirectory());
  assert.equal(games.length, 40);
  for (const game of games) {
    const definition = gameScore.ParseGameScoreDefinition(JSON.parse(await readFile(new URL(`${game.name}/score.json`, root), 'utf8')), game.name);
    const row = Object.fromEntries(definition.columns.map((field, index) => [field.sources[0], index === 0 ? 0 : 12]));
    const score = gameScore.BuildGameScore(definition, { detailRows: [row, { ...row, userName: 'private' }], details: {} });
    assert.equal(score.rounds.length, 2, game.name);
    assert.equal(score.rounds[0][definition.columns[0].key], 0);
    assert.equal(gameScore.IsGameScore(score, definition), true);
    const message = { type: embeddedTraining.hubGameScoreMessageType, sessionNonce: 'a'.repeat(64), sequence: 1, score };
    assert.equal(embeddedTraining.IsHubGameScoreMessage(message, definition, message.sessionNonce), true);
    assert.equal(embeddedTraining.IsHubGameScoreMessage(message, definition, 'b'.repeat(64)), false);
    assert.equal(embeddedTraining.IsHubGameScoreMessage({ ...message, sequence: 2 }, definition, message.sessionNonce), false);
    assert.equal(embeddedTraining.IsHubGameScoreMessage({ ...message, extra: 1 }, definition, message.sessionNonce), false);
    assert.equal(JSON.stringify(score).includes('private'), false);
    assert.equal(gameScore.IsGameScore({ ...score, gameId: 'wrong-game' }, definition), false);
    assert.equal(gameScore.IsGameScore({ ...score, rounds: [{ ...score.rounds[0], authToken: 1 }] }, definition), false);
    assert.equal(gameScore.IsGameScore({ ...score, rounds: [{ ...score.rounds[0], [definition.columns[0].key]: Infinity }] }, definition), false);
    assert.equal(gameScore.IsGameScore({ ...score, rounds: Array(4001).fill(score.rounds[0]) }, definition), false);
    assert.throws(() => gameScore.ParseGameScoreDefinition({ ...definition, columns: [{ ...definition.columns[0], key: 'userName' }] }));
  }
});

test('only canonical Hub, previews, and local development are trusted Hub origins', () => {
  assert.equal(embeddedTraining.IsHubOrigin('https://trainerhub.cc/train/'), true);
  assert.equal(
    embeddedTraining.IsHubOrigin('https://deployment-id.rehabtrainerhub.pages.dev/train/'),
    true,
  );
  assert.equal(embeddedTraining.IsHubOrigin('https://rehabtrainerhub.pages.dev/train/'), false);
  assert.equal(embeddedTraining.IsHubOrigin('https://visiontrainer.pages.dev/'), false);
  assert.equal(embeddedTraining.IsHubOrigin('http://127.0.0.1:4173/train/'), true);
});

test('embedded training reports active state to its verified Hub origin', (context) => {
  const messages = [];
  const windowMock = {
    location: { search: '?embed=hub' },
    parent: {
      postMessage: (...args) => messages.push(args),
    },
    top: {},
  };
  windowMock.self = windowMock;

  Object.defineProperty(globalThis, 'window', { configurable: true, value: windowMock });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      documentElement: {},
      fullscreenElement: null,
      referrer: 'https://trainerhub.cc/train/?module=motor%3Aasteroid-shield',
    },
  });
  context.after(() => {
    delete globalThis.document;
    delete globalThis.window;
  });

  embeddedTraining.NotifyHubTrainingActive(true);
  assert.deepEqual(messages.shift(), [
    { type: 'rehab-trainer:training-active', active: true },
    'https://trainerhub.cc',
  ]);

  embeddedTraining.NotifyHubTrainingActive(false);
  assert.deepEqual(messages.shift(), [
    { type: 'rehab-trainer:training-active', active: false },
    'https://trainerhub.cc',
  ]);
  assert.equal(embeddedTraining.IsHubTrainingActiveMessage({
    type: 'rehab-trainer:training-active',
    active: true,
  }), true);
  assert.equal(embeddedTraining.IsHubTrainingActiveMessage({
    type: 'rehab-trainer:training-active',
    active: 'true',
  }), false);

  embeddedTraining.NotifyHubTrainingReady();
  assert.deepEqual(messages.shift(), [
    { type: 'rehab-trainer:training-ready' },
    'https://trainerhub.cc',
  ]);
  assert.equal(embeddedTraining.IsHubTrainingReadyMessage({
    type: 'rehab-trainer:training-ready',
  }), true);

  embeddedTraining.NotifyHubTrainingComplete();
  assert.deepEqual(messages.shift(), [
    { type: 'rehab-trainer:training-complete' },
    'https://trainerhub.cc',
  ]);
  assert.equal(embeddedTraining.IsHubTrainingCompleteMessage({
    type: 'rehab-trainer:training-complete',
  }), true);
  assert.equal(embeddedTraining.IsHubTrainingCompleteMessage({
    type: 'rehab-trainer:training-ready',
  }), false);

  embeddedTraining.NotifyHubTrainingAbort();
  assert.deepEqual(messages.shift(), [
    { type: 'rehab-trainer:training-active', active: false },
    'https://trainerhub.cc',
  ]);
  assert.deepEqual(messages.shift(), [
    { type: 'rehab-trainer:training-exit' },
    'https://trainerhub.cc',
  ]);

  embeddedTraining.NotifyHubTrainingExit();
  assert.deepEqual(messages.shift(), [
    { type: 'rehab-trainer:training-exit' },
    'https://trainerhub.cc',
  ]);
  assert.equal(embeddedTraining.IsHubTrainingExitMessage({
    type: 'rehab-trainer:training-exit',
  }), true);
  assert.equal(embeddedTraining.IsHubTrainingExitMessage({
    type: 'rehab-trainer:training-complete',
  }), false);

  assert.equal(embeddedTraining.RequestHubTrainingConfiguration(), true);
  assert.deepEqual(messages.shift(), [
    { type: 'rehab-trainer:training-active', active: false },
    'https://trainerhub.cc',
  ]);
  assert.deepEqual(messages.shift(), [
    { type: 'rehab-trainer:training-configure' },
    'https://trainerhub.cc',
  ]);
  assert.equal(embeddedTraining.IsHubTrainingConfigureMessage({
    type: 'rehab-trainer:training-configure',
  }), true);
  assert.equal(embeddedTraining.IsHubTrainingConfigureMessage({
    type: 'rehab-trainer:training-exit',
  }), false);
});

test('Hub accepts messages only from the expected same-origin runtime frame', () => {
  const expectedSource = {};
  assert.equal(embeddedTraining.IsTrustedTrainingFrameMessage(
    { origin: 'https://trainerhub.cc', source: expectedSource },
    'https://trainerhub.cc',
    expectedSource,
  ), true);
  assert.equal(embeddedTraining.IsTrustedTrainingFrameMessage(
    { origin: 'https://attacker.example', source: expectedSource },
    'https://trainerhub.cc',
    expectedSource,
  ), false);
  assert.equal(embeddedTraining.IsTrustedTrainingFrameMessage(
    { origin: 'https://trainerhub.cc', source: {} },
    'https://trainerhub.cc',
    expectedSource,
  ), false);
  assert.equal(embeddedTraining.IsTrustedTrainingFrameMessage(
    { origin: 'https://trainerhub.cc', source: null },
    'https://trainerhub.cc',
    null,
  ), false);
});

test('official games accept settings only from their verified Hub parent', (context) => {
  const parent = {};
  const listeners = new Map();
  const dispatchedEvents = [];
  const windowMock = {
    location: {
      pathname: '/games/drawing-defense/',
      search: '?embed=hub',
    },
    parent,
    top: {},
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
    dispatchEvent(event) {
      dispatchedEvents.push(event);
      return true;
    },
  };
  windowMock.self = windowMock;
  class TestCustomEvent {
    constructor(type, init) {
      this.detail = init?.detail;
      this.type = type;
    }
  }

  Object.defineProperty(globalThis, 'CustomEvent', {
    configurable: true,
    value: TestCustomEvent,
  });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: windowMock });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { referrer: 'https://trainerhub.cc/train/?module=motor%3Adrawing-defense' },
  });
  context.after(() => {
    delete globalThis.CustomEvent;
    delete globalThis.document;
    delete globalThis.window;
  });

  const sessionNonce = 'b'.repeat(64);
  const message = embeddedTraining.CreateHubGameSettingsMessage(
    'drawing-defense',
    sessionNonce,
    { difficulty: 'medium', durationSec: 60, soundEnabled: true },
  );
  assert.equal(embeddedTraining.IsHubGameSettingsMessage(message, 'drawing-defense'), true);
  assert.equal(embeddedTraining.IsHubGameSettingsMessage(
    { ...message, token: 'never-allowed' },
    'drawing-defense',
  ), false);
  assert.throws(() => embeddedTraining.CreateHubGameSettingsMessage(
    'drawing-defense',
    sessionNonce,
    { authToken: 'never-allowed' },
  ));

  const remove = embeddedTraining.InstallHostedGameSettingsReceiver();
  const handleMessage = listeners.get('message');
  assert.equal(typeof handleMessage, 'function');
  handleMessage({ data: message, origin: 'https://attacker.example', source: parent });
  handleMessage({ data: message, origin: 'https://trainerhub.cc', source: {} });
  assert.equal(embeddedTraining.GetHostedGameSettings(), null);

  handleMessage({ data: message, origin: 'https://trainerhub.cc', source: parent });
  assert.deepEqual(embeddedTraining.GetHostedGameSettings(), message.settings);
  assert.equal(dispatchedEvents.at(-1)?.type, 'rehab-trainer:game-settings-ready');
  assert.deepEqual(dispatchedEvents.at(-1)?.detail, message.settings);
  remove();
  assert.equal(listeners.has('message'), false);
});

test('training results expose exactly one source-aware navigation button', () => {
  assert.equal((resultActionsSource.match(/<button\b/g) ?? []).length, 1);
  assert.equal(resultActionsSource.includes('downloadLabel'), false);
  assert.equal(resultActionsSource.includes('restartLabel'), false);
  assert.match(resultActionsSource, /isEmbeddedHubTraining \? NotifyHubTrainingExit :/);
  assert.match(resultActionsSource, /if \(!RequestHubTrainingConfiguration\(\)\) onBackHome\(\)/);
});

test('standalone games reopen their own configuration without browser history', (context) => {
  const dispatched = [];
  const windowMock = { location: { pathname: '/games/n-back/', search: '' }, dispatchEvent: event => dispatched.push(event.type) };
  windowMock.self = windowMock;
  windowMock.top = windowMock;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: windowMock });
  context.after(() => { delete globalThis.window; });
  assert.equal(embeddedTraining.RequestHubTrainingConfiguration(), true);
  assert.deepEqual(dispatched, ['rehab-trainer:standalone-configure']);
  windowMock.location.pathname = '/qa/';
  assert.equal(embeddedTraining.RequestHubTrainingConfiguration(), false);
});
